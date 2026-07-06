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

// Synthetic-task id allocation. The fork's injectSyntheticTask
// expects unique ids ≥ 10000.
let _nextSyntheticId = SYNTHETIC_TASK_ID_BASE;
function _allocSyntheticId() { return _nextSyntheticId++; }

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
    // add to it (clamped to maxMana host-side).
    if (delta !== 0 && _client && _world?.manaEnabled) {
        if (delta > 0) {
            if (_expectedPool !== null) _expectedPool = Math.max(0, _expectedPool - delta);
            _client.publishEventBus('jta:bridgeDeductMana', { amount: delta });
        } else {
            if (_expectedPool !== null) _expectedPool = Math.min(_hostMaxMana, _expectedPool - delta);
            _client.publishEventBus('jta:bridgeGainMana', { amount: -delta });
        }
    }
    _lastSampledEnergy = currentEnergy;
}

// ────────────────────────────────────────────────────────────────
// Activation sync — apply catch-up resets, sync energy from pool
// ────────────────────────────────────────────────────────────────

function _applyCatchUpResets() {
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
    _w.setEnergy(_hostCurrentMana, _hostMaxMana);
    _lastSampledEnergy = _hostCurrentMana;
    _expectedPool = _hostCurrentMana;
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
    for (const exit of exits) {
        const taskId = _allocSyntheticId();
        _w.injectSyntheticTask(
            {
                id: taskId,
                name: _exitLabel(exit),
                costMultiplier: 0,
                free: true,
                skills: [JTA_SKILL_TYPE_TRAVEL],
            },
            () => {
                _dispatchRegionMove(exit.targetRegion ?? null, exit.exitName);
            },
        );
    }
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

    // Clear any synthetic tasks left over from a previous region.
    if (typeof _w.clearSyntheticTasks === 'function') {
        _w.clearSyntheticTasks();
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
    _startPolling();
    log('debug', `loaded region ${regionId} (zone ${jtaZone}, completed=${completed})`);
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
        _expectedPool = _hostCurrentMana;
        log('debug', 'initial state received', { _hostCurrentMana, _hostMaxMana, _hostResetCount });
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
            if (typeof _w.pauseGameLoop === 'function') _w.pauseGameLoop();
        }
    });

    // Region activation events (from procgenPlayer).
    _client.subscribeEventBus('jta:loadRegion', _handleLoadRegion);

    // Static data refresh — AdapterClient requests static data once
    // immediately after connect, but if rules weren't loaded yet at
    // that point, the host returns null and the cached value stays
    // null. Re-request whenever rules (re)load so subsequent exit
    // lookups (Travel-task callbacks) find populated regions.
    _client.subscribeEventBus('stateManager:rulesLoaded', () => {
        log('debug', 'stateManager:rulesLoaded — re-requesting static data');
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
