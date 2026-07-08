/**
 * Bridge — runs inside the JtA iframe. Injected by
 * jtaSubstrateWrapperPanel after the iframe's `load` event fires.
 *
 * Responsibilities:
 *   - On startup: confirm JtA is in managed mode (?managed=1 already
 *     flipped it pre-DOMContentLoaded; the game booted from its own
 *     substrate save slot — see the fork's getSaveLocation) and
 *     complete the iframeAdapter handshake. The game loop stays
 *     PAUSED until the player enters a jta region.
 *   - On every jta:loadRegion: catch-up sync any loop resets the
 *     host fired while JtA was inactive, sync JtA's energy/max
 *     from the shared pool, load the right zone (in completed
 *     state if the player already finished this region this loop),
 *     inject synthetic exit tasks for re-entries, resume the game
 *     loop.
 *   - On leaving the region (gameState:regionChanged away): pause the
 *     game loop — no unmirrored background play.
 *   - While active: poll JtA's energy and mirror BOTH directions into
 *     the shared loop-mode pool — drains via `jta:bridgeDeductMana`,
 *     gains (energy items etc.) via `jta:bridgeGainMana`. External
 *     pool changes (another substrate spent mana, max-mana recompute)
 *     are pushed back into JtA's energy; the bridge tells its own
 *     mirrored deltas apart from external changes by tracking the
 *     pool value it expects to be echoed (`_expectedPool`).
 *   - Reset propagation, both ways:
 *       game → host: the fork's energy-reset callback (fires on
 *         doEnergyReset AND doPrestige) publishes
 *         `jta:bridgeEnergyReset`; the host answers with a loop reset
 *         unless one already fired for this depletion.
 *       host → game: gameState:loopReset applies doEnergyReset
 *         immediately while a jta region is active (deferred to the
 *         next jta:loadRegion while inactive, as before).
 *   - On Travel-task completion: mark the region completed for this
 *     loop, dispatch user:regionMove for single-exit regions, or
 *     inject synthetic exit-choice tasks for multi-exit regions.
 *   - Playback control (jta:playbackControl, from the host-side
 *     PlaybackProxy): play/stop map to the game clock, step/instant to
 *     the fork's stepTick/setInstantMode, reset to doEnergyReset, and
 *     walkTo(exit) designates the exit to take once the zone's Travel
 *     task completes — the zone itself is played by the game's OWN
 *     automation engine (activated for the walk under the default
 *     'activate' host setting, or left entirely to the player's
 *     automation config under 'respect'). This is what loops'
 *     executeVia: 'playbackBot' queue execution calls into.
 *
 * Host-side counterpart wiring lives in
 *   ../jtaSubstrateWrapper/index.js — that module subscribes to
 *   `iframe:appReady` (to push the initial pool state to this bridge),
 *   `jta:bridgeDeductMana` / `jta:bridgeGainMana` (pool mirroring +
 *   the out-of-mana → triggerLoopReset path), and
 *   `jta:bridgeEnergyReset` (game-initiated reset → loop reset).
 */

import { IframeClient } from '../iframe-base/iframeClient.js';

function log(level, ...args) {
    const fn = console[level] || console.log;
    fn('[jta-bridge]', ...args);
}

// ────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 50;
const SYNTHETIC_TASK_ID_BASE = 10000;

// SkillType.Travel from journey-to-ascension/skills.ts. Hardcoded as
// an integer because the fork doesn't expose the SkillType enum on
// window. Position is stable — moving an existing entry would also
// invalidate the fork's save files. Update if the fork ever does.
const JTA_SKILL_TYPE_TRAVEL = 7;

const _w = /** @type {any} */ (window);   // JtA globals (set by the fork)
let _client = null;

// Active-region state
let _currentRegionId = null;
let _world = null;                          // From deserializeWorld in the substrate registry
let _isActive = false;                      // True when JtA is the current region's substrate

// Cached host state (kept up-to-date by event subscriptions)
let _hostCurrentMana = 100;
let _hostMaxMana = 100;
let _hostResetCount = 0;
let _lastAppliedResetCount = 0;             // How many resets we've applied to JtA

// Echo detection for two-way mana sync. After the bridge publishes a
// deduct/gain, the host's gameState:manaChanged echo carries exactly
// the value we predicted here; a manaChanged that DOESN'T match is an
// external pool change (another substrate spent mana, loops charged a
// cost, max-mana recompute) and gets pushed into JtA's energy.
// null ⇒ no prediction (treat the next manaChanged as external).
let _expectedPool = null;
const POOL_EPSILON = 0.001;

// True while the bridge itself is running doEnergyReset (host-reset
// propagation) — suppresses the fork's energy-reset callback so we
// don't report our own resets back to the host.
let _applyingHostReset = false;

// Polling
let _pollIntervalId = null;
let _lastSampledEnergy = null;              // JtA's energy at the last poll

// Per-loop completion tracking. Cleared on gameState:loopReset.
const _completedThisLoop = new Set();

// Playback walkTo state: the exit to take once the current zone's
// Travel task completes. Zone completion itself is played by the
// game's OWN automation engine (user ruling 2026-07-05) — under the
// default 'activate' policy the bridge turns the engine on for the
// walk (restoring the previous mode after); under 'respect' it relies
// entirely on the player's automation configuration. Cleared on
// region load/exit.
const JTA_AUTOMATION_MODE_ALL = 0;   // simulation.ts AutomationMode.All
let _pendingWalkExit = null;
let _walkPrevAutomationMode = null;  // mode to restore when the walk ends (null = we didn't change it)
let _playbackAutomationPolicy = 'activate';   // 'activate' | 'respect' (host setting)

// Energy-bonus sync (host setting, default off). When on, JtA owns its
// max_energy and reports its native starting-energy bonus up to the shared
// pool (jta:bridgeSetManaBonus → setSubstrateMaxManaBonus), and the bridge
// stops pinning max_energy from the pool (syncs current energy only). When
// off, the legacy pin applies (max_energy pinned to host maxMana).
let _energyBonusSync = false;
let _lastReportedBonus = null;   // last starting-energy bonus pushed to the host

// Synthetic-task id allocation. The fork's injectSyntheticTask expects
// unique ids ≥ 10000 — and they must be STABLE across re-entries and
// reloads: the game's per-zone automation priorities are lists of task
// ids (persisted in the substrate save), so a player who prioritizes
// an exit-choice task must find the same id there next loop. Derive
// the id from (zone, exit index in the region's sidecar exit order):
// both are fixed for a given world. Zones < 100 exits apiece; current
// drivers map each zone to at most one region, so zone-scoping is
// collision-free.
function _syntheticExitTaskId(exitIndex) {
    const zone = typeof _world?.jtaZone === 'number' ? _world.jtaZone : 0;
    return SYNTHETIC_TASK_ID_BASE + zone * 100 + exitIndex;
}

// ────────────────────────────────────────────────────────────────
// Polling — mirror JtA energy drain into the shared pool
// ────────────────────────────────────────────────────────────────

function _startPolling() {
    if (_pollIntervalId !== null) return;
    _pollIntervalId = setInterval(_pollTick, POLL_INTERVAL_MS);
}

function _stopPolling() {
    if (_pollIntervalId !== null) {
        clearInterval(_pollIntervalId);
        _pollIntervalId = null;
    }
}

function _pollTick() {
    if (!_isActive) return;
    if (typeof _w.getFullState !== 'function') return;

    const fullState = _w.getFullState();
    const currentEnergy = fullState.currentEnergy;

    // Report JtA's native starting-energy bonus up to the shared pool
    // (independent of the per-tick drain mirroring below).
    _reportStartingEnergyBonusIfChanged(fullState);

    if (_lastSampledEnergy === null) {
        _lastSampledEnergy = currentEnergy;
        return;
    }
    const delta = _lastSampledEnergy - currentEnergy;
    // Mirror energy changes into the shared pool only when this region
    // opts in (matches the maze / textAdventure pattern of gating on
    // world.manaEnabled). Does NOT also check loopModeActive — the
    // loop queue isn't wired to drive JtA yet. Both directions:
    // drains deduct from the pool, gains (energy items, perk refills)
    // add to it — NOT clamped: maxMana is the loop's STARTING mana (and
    // the mana-bar max), not a ceiling; the pool may exceed it.
    if (delta !== 0 && _client && _world?.manaEnabled) {
        if (delta > 0) {
            if (_expectedPool !== null) _expectedPool = Math.max(0, _expectedPool - delta);
            _client.publishEventBus('jta:bridgeDeductMana', { amount: delta });
        } else {
            // No clamp: maxMana is the loop's STARTING mana, not a
            // ceiling — the pool may grow beyond it.
            if (_expectedPool !== null) _expectedPool = _expectedPool - delta;
            _client.publishEventBus('jta:bridgeGainMana', { amount: -delta });
        }
    }
    _lastSampledEnergy = currentEnergy;
}

// ────────────────────────────────────────────────────────────────
// Activation sync — apply catch-up resets, sync energy from pool
// ────────────────────────────────────────────────────────────────

function _applyCatchUpResets() {
    // A host reset count BELOW what we've already applied means the
    // host started a new world (rules reload zeroes loopResetCount via
    // gameState.reset()) while this bridge kept living — re-baseline
    // so the next real loop reset computes a sane delta instead of a
    // negative one that silently skips the catch-up.
    if (_lastAppliedResetCount > _hostResetCount) {
        _lastAppliedResetCount = _hostResetCount;
    }
    const delta = _hostResetCount - _lastAppliedResetCount;
    if (delta <= 0) {
        _lastAppliedResetCount = _hostResetCount;
        return;
    }
    if (typeof _w.doEnergyReset !== 'function') {
        log('warn', 'doEnergyReset hook missing; cannot apply catch-up resets');
        _lastAppliedResetCount = _hostResetCount;
        return;
    }
    // Flag so the fork's energy-reset callback (which fires at the end
    // of every doEnergyReset) doesn't report our own resets back to
    // the host as game-initiated ones.
    _applyingHostReset = true;
    try {
        for (let i = 0; i < delta; i++) {
            _w.doEnergyReset();
        }
    } finally {
        _applyingHostReset = false;
    }
    _lastAppliedResetCount = _hostResetCount;
    // Note: not necessarily zone 0 afterwards — Minor Time Compression's
    // skipFreeZones can advance past free zones during the reset.
    log('debug', `applied ${delta} catch-up reset(s)`);
}

function _syncEnergyFromPool() {
    if (typeof _w.setEnergy !== 'function') return;
    if (_energyBonusSync) {
        // JtA owns its max_energy in bonus-sync mode; sync CURRENT energy
        // only (the max param is optional). Pinning max here would fight
        // JtA's own starting-energy growth and form a feedback loop with
        // the bonus we report back up.
        _w.setEnergy(_hostCurrentMana);
    } else {
        // Legacy pin: max_energy tracks the shared pool's max.
        _w.setEnergy(_hostCurrentMana, _hostMaxMana);
    }
    _lastSampledEnergy = _hostCurrentMana;
    _expectedPool = _hostCurrentMana;
}

// Push JtA's native starting-energy bonus (Energetic Memory + EnergySpell
// + Divine Supremacy + Energized, tracked by the fork's
// jta_starting_energy_bonus accumulator) up to the shared pool, but only
// when bonus-sync is on and the value actually changed. gameState sums
// per-substrate bonuses into maxMana.
function _reportStartingEnergyBonusIfChanged(fullState) {
    if (!_energyBonusSync || !_client) return;
    const bonus = fullState.jtaStartingEnergyBonus;
    if (typeof bonus !== 'number') return;
    if (_lastReportedBonus !== null
        && Math.abs(bonus - _lastReportedBonus) <= POOL_EPSILON) return;
    _lastReportedBonus = bonus;
    _client.publishEventBus('jta:bridgeSetManaBonus', { bonus });
}

// ────────────────────────────────────────────────────────────────
// Region loading + exit handling
// ────────────────────────────────────────────────────────────────

/**
 * Look up the current region's exits from the sidecar's
 * playable_payload.exits (delivered as `_world.exits` after
 * deserializeWorld converted the array into a Map<exitName, exit>).
 * The bridge's consumers want an array, so we materialize the Map's
 * values here. Sidecar exits carry a directional `side` (N/E/S/W)
 * that AP region-graph exits don't, which is why we prefer the
 * sidecar source over staticData.regions.
 *
 * Expected per-exit shape (a subset of the procgen sidecar format):
 *   { exit_id, exitName, targetRegion, side?, isBackExit?, isTeleporter? }
 */
function _getRegionExits() {
    if (!_world) {
        log('warn', '_getRegionExits: no _world (jta:loadRegion not yet handled)');
        return [];
    }
    const exits = _world.exits;
    if (exits instanceof Map) {
        return [...exits.values()];
    }
    if (Array.isArray(exits)) {
        return exits;
    }
    log('warn', `_getRegionExits: _world.exits is neither Map nor Array; type=${typeof exits}`);
    return [];
}

function _dispatchRegionMove(targetRegion, exitName) {
    if (!_client) return;
    _client.publishEventDispatcher('user:regionMove', {
        sourceRegion: _currentRegionId,
        targetRegion,
        exitName: exitName ?? null,
    }, { initialTarget: 'bottom' });
}

const SIDE_LABEL = { N: 'North', E: 'East', S: 'South', W: 'West' };

function _exitLabel(exit) {
    const target = exit?.targetRegion;
    const side = exit?.side;
    if (side && SIDE_LABEL[side] && target) return `Go ${SIDE_LABEL[side]} (to ${target})`;
    if (side && SIDE_LABEL[side]) return `Go ${SIDE_LABEL[side]}`;
    if (target) return `Take exit: ${exit?.exitName ?? '?'} (to ${target})`;
    return `Take exit: ${exit?.exitName ?? '?'}`;
}

/**
 * Inject one synthetic exit-choice task per exit. `free: true` makes
 * the fork's calcEnergyDrainPerTick return 0 for these (cost_multiplier
 * alone is not enough — the first tick still drains the per-zone amount
 * before the rep finishes). `skills: [Travel]` grants Travel XP on
 * completion and also avoids the empty-skills NaN in tooltips.
 */
function _injectExitTasks(exits) {
    if (typeof _w.injectSyntheticTask !== 'function') {
        log('warn', 'injectSyntheticTask hook missing; exit tasks not injected');
        return;
    }
    exits.forEach((exit, index) => {
        _w.injectSyntheticTask(
            {
                id: _syntheticExitTaskId(index),
                name: _exitLabel(exit),
                costMultiplier: 0,
                free: true,
                skills: [JTA_SKILL_TYPE_TRAVEL],
            },
            () => {
                _dispatchRegionMove(exit.targetRegion ?? null, exit.exitName);
            },
        );
    });
}

function _handleLoadRegion(payload) {
    if (!payload || !payload.region_id) {
        log('warn', 'jta:loadRegion with no region_id', payload);
        return;
    }
    const regionId = payload.region_id;
    const world = payload.world ?? {};
    const jtaZone = world.jtaZone;
    if (typeof jtaZone !== 'number') {
        log('warn', `jta:loadRegion for ${regionId} has no jtaZone in world`, world);
        return;
    }

    // Clear any synthetic tasks left over from a previous region. An
    // in-flight playback walk is cleared only when this is a DIFFERENT
    // region: a same-region reload is the loop-reset retry case (pool
    // emptied mid-walk, reset landed us back here) and the walk toward
    // this region's exit is still valid — clearing it would race
    // loops' parked-action re-dispatch against this handler.
    if (typeof _w.clearSyntheticTasks === 'function') {
        _w.clearSyntheticTasks();
    }
    if (regionId !== _currentRegionId) {
        _clearPendingWalk();
    }

    // Apply any loop resets the host fired while we were inactive,
    // then push the host pool's current/max into JtA.
    _applyCatchUpResets();
    _syncEnergyFromPool();

    const completed = _completedThisLoop.has(regionId);
    if (typeof _w.loadZone === 'function') {
        const res = _w.loadZone(jtaZone, { completed });
        if (!res?.success) {
            log('warn', `loadZone(${jtaZone}) failed:`, res?.error);
        }
    }

    _currentRegionId = regionId;
    _world = world;
    _isActive = true;
    _lastSampledEnergy = _hostCurrentMana;
    // Force the next poll to re-report our starting-energy bonus (the host
    // may have been reset — losing our bonus — while we were inactive).
    _lastReportedBonus = null;

    // Defensive: if static data isn't cached yet (e.g. the initial
    // post-connect request fired before rules were loaded and no
    // stateManager:rulesLoaded has arrived since), kick off another
    // request now. We don't await — the next exit lookup picks up
    // the populated cache.
    if (!_client?.getStaticData?.()) {
        _client?.requestStaticData?.();
    }

    // On re-entry to a completed region, inject exit tasks so the
    // player has something to click (the Travel task is already done).
    if (completed) {
        const exits = _getRegionExits();
        if (exits.length === 0) {
            log('warn', `Completed region ${regionId} has no exits`);
        } else {
            _injectExitTasks(exits);
        }
    }
    // For first-traversal regions: nothing to inject — the player
    // works through the zone normally; the Travel-task callback below
    // handles the exit choice when the zone's Travel task completes.

    // Entering a jta region resumes the game clock (paused since boot
    // or since the last region exit).
    if (typeof _w.resumeGameLoop === 'function') _w.resumeGameLoop();
    // A walk that survived a same-region reload needs the automation
    // engine re-armed (the catch-up reset may have been a prestige,
    // which zeroes automation_mode).
    if (_pendingWalkExit) _armWalkAutomation();
    _startPolling();
    log('debug', `loaded region ${regionId} (zone ${jtaZone}, completed=${completed})`);
}

// ────────────────────────────────────────────────────────────────
// Playback control — host proxy commands (jta:playbackControl)
// ────────────────────────────────────────────────────────────────

function _clearPendingWalk() {
    _pendingWalkExit = null;
    // If we activated the automation engine for this walk, restore the
    // mode the player had (automation_mode is session-transient in the
    // fork, so this can't corrupt their save either way).
    if (_walkPrevAutomationMode !== null) {
        if (typeof _w.setAutomationMode === 'function') {
            _w.setAutomationMode(_walkPrevAutomationMode);
        }
        _walkPrevAutomationMode = null;
    }
}

/**
 * Under the 'activate' policy: switch the automation engine on for the
 * in-flight walk (remembering what the player had so the walk's end
 * restores it) and give the zone a priority list if the player
 * configured none. Idempotent — called on walkTo and again when a
 * loop-reset reload re-enters the same region mid-walk.
 */
function _armWalkAutomation() {
    if (_playbackAutomationPolicy !== 'activate') return;
    if (typeof _w.getAutomationMode !== 'function'
        || typeof _w.setAutomationMode !== 'function') return;
    const current = _w.getAutomationMode();
    if (current !== JTA_AUTOMATION_MODE_ALL) {
        if (_walkPrevAutomationMode === null) _walkPrevAutomationMode = current;
        _w.setAutomationMode(JTA_AUTOMATION_MODE_ALL);
    }
    if (typeof _w.ensureZoneAutomationPriorities === 'function') {
        _w.ensureZoneAutomationPriorities();
    }
}

function _handleWalkTo(target) {
    if (!_isActive || !_currentRegionId) {
        log('warn', 'walkTo ignored — no active jta region');
        return;
    }
    if (target?.kind !== 'exit' || !target?.name) {
        // v1 jta regions have no locations/tiles; only exits are walkable.
        log('warn', 'walkTo ignored — unsupported target', target);
        return;
    }
    const exits = _getRegionExits();
    const exit = exits.find(e => e?.exitName === target.name || e?.exit_id === target.name);
    if (!exit) {
        log('warn', `walkTo: exit '${target.name}' not found in ${_currentRegionId}`);
        return;
    }
    // Completed region: the Travel requirement is already met this
    // loop; take the exit directly (the injected exit tasks are free).
    if (_completedThisLoop.has(_currentRegionId)) {
        _dispatchRegionMove(exit.targetRegion ?? null, exit.exitName);
        return;
    }
    // First traversal: the game's automation plays the zone (per the
    // player's mods/thresholds; auto-fill puts Travel last, so the
    // zone is genuinely completed, not just transited). When the
    // Travel task completes, THIS exit is taken (replace-on-walkTo:
    // last write wins). Under the default 'activate' policy the bridge
    // switches the automation engine on for the walk and gives the
    // zone a priority list if the player configured none; under
    // 'respect' the walk only designates the exit and completion is
    // entirely up to the player's own automation settings.
    _pendingWalkExit = exit;
    _armWalkAutomation();
    log('debug', `walkTo: zone playing toward exit '${exit.exitName}' (policy=${_playbackAutomationPolicy})`);
}

function _handlePlaybackControl(payload) {
    const method = payload?.method;
    const args = Array.isArray(payload?.args) ? payload.args : [];
    switch (method) {
        case 'play':
            if (typeof _w.resumeGameLoop === 'function') _w.resumeGameLoop();
            return;
        case 'stop':
            _clearPendingWalk();
            if (typeof _w.pauseGameLoop === 'function') _w.pauseGameLoop();
            return;
        case 'step':
            if (typeof _w.stepTick === 'function') _w.stepTick();
            return;
        case 'instant':
            if (typeof _w.setInstantMode === 'function') _w.setInstantMode(true);
            return;
        case 'reset':
            // Game-initiated reset semantics: flows through the
            // energy-reset callback → host loop reset, like a player
            // reset would.
            if (typeof _w.doEnergyReset === 'function') _w.doEnergyReset();
            return;
        case 'setRate':
            // The game owns its tick rate (calcTickRate); rate control
            // isn't meaningful here. Instant Mode is the fast path.
            log('debug', 'playback setRate ignored (game owns its tick rate)', args[0]);
            return;
        case 'walkTo':
            _handleWalkTo(args[0]);
            return;
        default:
            log('warn', 'playback control: unknown method', method);
    }
}

/**
 * Fired by the fork at the end of doEnergyReset() AND doPrestige().
 * When the GAME initiated the reset (overlay click, the
 * auto_continue_energy_reset mod, threshold End Run, Auto-Prestige),
 * ask the host to run the matching loop reset. Resets the bridge
 * applied itself (_applyingHostReset) are not reported back.
 */
function _handleGameEnergyReset(state) {
    if (_applyingHostReset) return;

    // Count the game's own reset as one applied host reset, so the
    // loop reset the host is about to fire (or the pool-exhaustion
    // one already in flight) isn't re-applied to the game.
    _lastAppliedResetCount += 1;

    // The game just refilled its own energy; re-baseline the poll so
    // the refill isn't mirrored as a gain. The host's loop reset will
    // arrive as a non-echo manaChanged and re-pin energy to the pool.
    _lastSampledEnergy = typeof state?.currentEnergy === 'number' ? state.currentEnergy : null;
    _expectedPool = null;

    // hostResetCount lets the host detect the exhaustion race: if a
    // loop reset already fired since we last synced (pool hit 0 and
    // the deduct path reset before this callback ran), the host skips
    // firing a second one.
    _client?.publishEventBus('jta:bridgeEnergyReset', { hostResetCount: _hostResetCount });
    log('debug', 'game-initiated reset reported to host');
}

function _handleTravelTaskCompleted(zone, task) {
    if (!_currentRegionId) {
        log('warn', `travel task ${task?.id} completed but no current region`);
        return;
    }
    // Mark the region completed for this loop. Subsequent re-entries
    // load it in completed state (only exit tasks visible).
    _completedThisLoop.add(_currentRegionId);

    // A playback walkTo is in flight: take ITS exit — no exit-choice
    // tasks, no single-exit fallthrough.
    if (_pendingWalkExit) {
        const exit = _pendingWalkExit;
        _clearPendingWalk();
        _dispatchRegionMove(exit.targetRegion ?? null, exit.exitName);
        return;
    }

    const exits = _getRegionExits();
    if (exits.length === 0) {
        log('warn', `Travel task in ${_currentRegionId} completed but region has no exits`);
        return;
    }
    if (exits.length === 1) {
        // Single exit: dispatch directly. No synthetic task needed.
        const exit = exits[0];
        _dispatchRegionMove(exit.targetRegion ?? null, exit.exitName);
        return;
    }
    // Multiple exits: inject one synthetic task per exit.
    _injectExitTasks(exits);
    log('debug', `injected ${exits.length} exit tasks for ${_currentRegionId}`);
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

async function main() {
    // Step 1: confirm JtA is in managed mode. The ?managed=1 URL param
    // (set by jtaSubstrateWrapperPanel) flips this on at module load,
    // before DOMContentLoaded — so GAMESTATE is already initialized
    // fresh under managed mode and the tick loop never started. The
    // setManagedMode + pauseGameLoop calls below are defensive no-ops
    // for that path; they still cover the case where the URL param
    // gets stripped somehow.
    if (typeof _w.setManagedMode !== 'function') {
        log('error', 'JtA managed-mode hook not present; aborting bridge');
        return;
    }
    _w.setManagedMode(true);
    if (typeof _w.pauseGameLoop === 'function') _w.pauseGameLoop();
    log('info', 'JtA in managed mode (loop paused)');

    // Step 2: complete the iframeAdapter handshake.
    _client = new IframeClient();
    const connected = await _client.connect();
    if (!connected) {
        log('error', 'IframeClient.connect() returned false');
        return;
    }

    // Step 3: subscribe to host events the bridge needs.
    //
    // Initial state — host module publishes this on iframe:appReady
    // with the current pool/reset state. We seed our caches from it.
    _client.subscribeEventBus('jtaSubstrateWrapper:initialState', (data) => {
        if (typeof data?.currentMana === 'number') _hostCurrentMana = data.currentMana;
        if (typeof data?.maxMana === 'number') _hostMaxMana = data.maxMana;
        if (typeof data?.loopResetCount === 'number') {
            _hostResetCount = data.loopResetCount;
            _lastAppliedResetCount = data.loopResetCount;
        }
        if (data?.playbackAutomation === 'activate' || data?.playbackAutomation === 'respect') {
            _playbackAutomationPolicy = data.playbackAutomation;
        }
        if (typeof data?.energyBonusSync === 'boolean' && data.energyBonusSync !== _energyBonusSync) {
            _energyBonusSync = data.energyBonusSync;
            // Flag flipped: re-report on the next poll, and re-pin max on
            // the next pool sync if it was just turned off.
            _lastReportedBonus = null;
            if (_isActive) _syncEnergyFromPool();
        }
        _expectedPool = _hostCurrentMana;
        log('debug', 'initial state received', { _hostCurrentMana, _hostMaxMana, _hostResetCount, _playbackAutomationPolicy, _energyBonusSync });
    });

    // Incremental updates. Echo detection: manaChanged caused by our
    // own mirrored deltas matches _expectedPool and is just recorded;
    // anything else is an external pool change and (while active on a
    // mana-enabled region) is pushed into JtA's energy so the two stay
    // continuously synchronized.
    _client.subscribeEventBus('gameState:manaChanged', (data) => {
        const prevMax = _hostMaxMana;
        if (typeof data?.current === 'number') _hostCurrentMana = data.current;
        if (typeof data?.max === 'number') _hostMaxMana = data.max;
        if (!_isActive || !_world?.manaEnabled) return;
        const isEcho = _expectedPool !== null
            && Math.abs(_hostCurrentMana - _expectedPool) <= POOL_EPSILON
            && _hostMaxMana === prevMax;
        if (isEcho) {
            _expectedPool = _hostCurrentMana; // resync to the exact float
        } else {
            _syncEnergyFromPool();
        }
    });

    _client.subscribeEventBus('gameState:loopReset', (data) => {
        if (typeof data?.resetCount === 'number') _hostResetCount = data.resetCount;
        // The payload carries the refilled pool; take it now so the
        // immediate-propagation path below pins energy to the fresh
        // values (the follow-up manaChanged then reads as an echo).
        if (typeof data?.mana?.current === 'number') _hostCurrentMana = data.mana.current;
        if (typeof data?.mana?.max === 'number') _hostMaxMana = data.mana.max;
        _completedThisLoop.clear();
        if (_isActive) {
            // Loop reset while standing in a jta region: propagate
            // immediately (an energy reset the game already ran itself
            // was pre-counted in _handleGameEnergyReset, so the
            // catch-up delta is 0 in that case).
            _applyCatchUpResets();
            _syncEnergyFromPool();
        }
        // While inactive: deferred to the next jta:loadRegion, as before.
    });

    _client.subscribeEventBus('gameState:regionChanged', (data) => {
        // If we move away from this jta region (or to a different
        // jta region — the next jta:loadRegion will re-activate),
        // stop polling and pause the game clock: no unmirrored
        // background play while another substrate is active.
        if (data?.newRegion && data.newRegion !== _currentRegionId) {
            _isActive = false;
            _stopPolling();
            _clearPendingWalk();
            if (typeof _w.pauseGameLoop === 'function') _w.pauseGameLoop();
        }
    });

    // PlaybackController commands from the host-side proxy (play /
    // stop / step / instant / reset / walkTo).
    _client.subscribeEventBus('jta:playbackControl', _handlePlaybackControl);

    // Region activation events (from procgenPlayer).
    _client.subscribeEventBus('jta:loadRegion', _handleLoadRegion);

    // Static data refresh — AdapterClient requests static data once
    // immediately after connect, but if rules weren't loaded yet at
    // that point, the host returns null and the cached value stays
    // null. Re-request whenever rules (re)load so subsequent exit
    // lookups (Travel-task callbacks) find populated regions.
    //
    // Rules loading also means a NEW WORLD: gameState.reset() zeroed
    // the pool state and restarted loopResetCount at 0 while this
    // bridge kept living. Re-baseline the reset bookkeeping (a stale
    // higher applied-count would make the next catch-up delta negative
    // and silently skip the reset — observed as is_in_energy_reset
    // stuck true after a mid-walk pool depletion) and drop per-world
    // state.
    _client.subscribeEventBus('stateManager:rulesLoaded', () => {
        log('debug', 'stateManager:rulesLoaded — re-requesting static data; re-baselining world state');
        _hostResetCount = 0;
        _lastAppliedResetCount = 0;
        _completedThisLoop.clear();
        _clearPendingWalk();
        _client?.requestStaticData?.();
    });

    // Step 4: register the game-side callbacks.
    if (typeof _w.setTravelTaskCallback === 'function') {
        _w.setTravelTaskCallback(_handleTravelTaskCompleted);
    } else {
        log('warn', 'setTravelTaskCallback hook missing — single-exit transitions will not work');
    }
    if (typeof _w.setEnergyResetCallback === 'function') {
        _w.setEnergyResetCallback(_handleGameEnergyReset);
    } else {
        log('warn', 'setEnergyResetCallback hook missing — game-initiated resets will desync the loop');
    }

    // Step 5: announce ready. The host module's iframe:appReady
    // subscriber will respond with jtaSubstrateWrapper:initialState.
    _client.notifyAppReady();
    log('info', 'connected to host; appReady sent');

    // The game loop stays PAUSED until the player enters a jta region
    // (jta:loadRegion resumes it; gameState:regionChanged away pauses
    // it again). A panel opened with no jta region active shows the
    // game frozen — by design: substrate play only ticks while its
    // region is the current one.
}

main().catch((err) => {
    log('error', 'fatal:', err);
});
