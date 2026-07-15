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
 *   - Perk grants, which are AP-authoritative (the fork's own grants are
 *     suppressed by task_patches). A perk on one of the player's OWN
 *     locations is granted on every full completion of the task holding
 *     it, like the vanilla perk it replaced; a perk from another
 *     player's world is granted when its item arrives and re-granted
 *     after a prestige, which has no task to re-run. See perkOrigin.js.
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
import {
    activePerkItemNames,
    buildOwnPlacements,
    forcedPerkCategoryIds,
    perkHolderTaskIds,
    staticDataMatchesRegion,
} from './perkOrigin.js';

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

// Zone-locations (Phase 2). AP location names already reported this
// session — dedupes loop-reset replays and region revisits (location
// semantics = first full completion). Re-seeded from checkedLocations on
// every region load. Item names already reconciled into perk grants (or
// found to be non-perks) — each processed once. Both cleared on rules
// reload (a new world / fresh inventory).
const _reportedLocationNames = new Set();
const _processedItems = new Set();

// Own-vs-foreign perk origin (see perkOrigin.js). Memoized from staticData on
// first use, dropped on rules reload. null ⇒ not resolvable yet: every grant
// falls back to inventory reconciliation, which is the pre-origin behaviour.
let _ownPlacements = null;
// AdapterClient caches staticData from the first response and keeps returning
// it until a new response overwrites it, so after a rules reload the cache
// still describes the OLD world. Remember that object and refuse to build
// placements from it; each response is a fresh reference, so an incoming one
// compares unequal. (Same staleness trap the textAdventure bridge's
// ensureStaticData() sidesteps.)
let _staleStaticData = null;
// Item names an own-world location holds that grantPerk rejected (filler, the
// Victory item). Saves a PERKS scan on every completion of those tasks.
const _nonPerkItemNames = new Set();
// Prestige detection. doPrestige() wipes every perk and — like doEnergyReset —
// ends by firing the fork's energy-reset callback; there is no dedicated
// prestige callback, so the two are told apart by prestige_count.
let _lastPrestigeCount = null;

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
    // A dataset world's skill table is its own — take the travel skill from
    // its roles instead of vanilla's fixed enum position.
    const travelSkill = _world?.jta_dataset?.roles?.travel_skill ?? JTA_SKILL_TYPE_TRAVEL;
    exits.forEach((exit, index) => {
        _w.injectSyntheticTask(
            {
                id: _syntheticExitTaskId(index),
                name: _exitLabel(exit),
                costMultiplier: 0,
                free: true,
                skills: [travelSkill],
            },
            () => {
                _dispatchRegionMove(exit.targetRegion ?? null, exit.exitName);
            },
        );
    });
}

// dataset_id the bridge has successfully applied via window.loadGameData.
// The fork hook is idempotent per dataset_id, so this is an optimization +
// the plan §3.2 "differs from the loaded one" guard, not a correctness gate.
let _loadedDatasetId = null;

/**
 * Apply the region world's synthetic dataset (resolved host-side by the
 * procgenPlayer warehouse: `jta_dataset` = the full document). Returns
 * false when the region must NOT be loaded: an unresolved ref, a missing
 * fork hook, or a rejected dataset all mean the fork's tables would not
 * match the region's locations/patches. Errors are surfaced, not
 * swallowed (plan §3.2).
 */
function _applyWorldDataset(world) {
    const ds = world?.jta_dataset;
    if (!ds) {
        if (world?.jta_dataset_ref) {
            log('error', `region references dataset '${world.jta_dataset_ref.dataset_id}' `
                + 'but the host did not resolve it — refusing to load the region');
            return false;
        }
        return true; // vanilla world — the hook stays dormant
    }
    if (_loadedDatasetId === ds.dataset_id) return true;
    if (typeof _w.loadGameData !== 'function') {
        log('error', `world carries dataset '${ds.dataset_id}' but the fork has no `
            + 'loadGameData hook (needs Fork 1.7+)');
        return false;
    }
    const res = _w.loadGameData(ds);
    if (!res?.ok) {
        log('error', `loadGameData('${ds.dataset_id}') failed:`, res?.errors ?? res);
        return false;
    }
    _loadedDatasetId = ds.dataset_id;
    log('info', `dataset '${ds.dataset_id}' applied (${ds.zones?.length} zones)`);
    return true;
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

    // Synthetic dataset application (Phase 5d, plan §3.2). Runs FIRST:
    // loadGameData swaps the content tables and re-initializes GAMESTATE
    // against the dataset-keyed save slot, so everything below — catch-up
    // resets, energy sync, loadZone, and crucially _applyTaskPatches (Pass-B
    // costs + grant suppression apply to the DATASET's tasks) — must operate
    // on the post-swap state. Refusing the region on failure beats silently
    // playing vanilla tables against dataset locations.
    if (!_applyWorldDataset(world)) return;

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

    // Zone-locations (Phase 2): suppress this zone's local perk grants
    // (perk → Count) BEFORE the game can complete any perk-task, re-seed
    // the location-check dedupe from already-checked locations, and grant
    // any foreign perks already received as AP items (own-world perks are
    // granted by their task's completion callback). No-ops when the payload
    // carries no ap_locations/task_patches (base scope).
    _applyTaskPatches();
    _reseedReportedLocations();
    // After the reseed, so already-checked perk tasks are retired immediately.
    _syncPerkCategoryTaskIds();
    _reconcilePerksFromInventory();

    // Defensive: if static data isn't cached yet (e.g. the initial
    // post-connect request fired before rules were loaded and no
    // stateManager:rulesLoaded has arrived since), kick off another
    // request now. We don't await — the next exit lookup picks up
    // the populated cache.
    if (!_client?.getStaticData?.()) {
        _client?.requestStaticData?.();
    }
    // Starting items are applied to the worker before this iframe
    // subscribed, so the cached snapshot the reconcile above read may
    // predate them. Request a fresh, worker-pinged snapshot: its
    // snapshotUpdated re-runs the perk reconciliation with the real
    // inventory (same path a mid-play item receipt uses).
    _client?.requestStateSnapshot?.();

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
// Zone-locations (Phase 2) — AP location checks + perk grants
// ────────────────────────────────────────────────────────────────

/**
 * Resolve a JtA task id to its AP *location name* via the region
 * payload's ap_locations map (task id → `${region_id}__${id}`, the
 * compileRegionGraph name). Returns null for tasks with no mapping
 * (synthetic exit tasks, SBtV-excluded tasks, or a base-scope region).
 */
function _resolveLocationName(taskId) {
    const map = _world?.ap_locations;
    if (!map) return null;
    const name = map[taskId];
    return (typeof name === 'string' && name.length > 0) ? name : null;
}

/**
 * Registered as the fork's task-completion callback: fires for EVERY full
 * task completion (reps == max_reps). Reports the matching AP location as
 * a check. Synthetic exit tasks and SBtV-excluded tasks have no
 * ap_locations entry and are skipped; deduped so loop-reset replays and
 * revisits report a location once (first-full-completion semantics).
 */
function _handleTaskCompleted(task) {
    if (!task || task.synthetic) return;
    const locationName = _resolveLocationName(task.id);
    if (locationName === null) return;
    // Before the check dedupe: a re-completion checks no new location, but it
    // is exactly what re-grants an own-world perk a prestige wiped.
    _grantOwnPerkForLocation(locationName);
    if (_reportedLocationNames.has(locationName)) return;
    _reportedLocationNames.add(locationName);
    if (!_client) return;
    _client.publishEventDispatcher('user:locationCheck', {
        locationName,
        regionName: _currentRegionId,
        originator: 'jtaSubstrate',
    }, { initialTarget: 'bottom' });
    log('debug', `task ${task.id} (${task.name}) -> user:locationCheck (${locationName})`);
    // The check has landed: this perk task no longer needs perk-category
    // treatment, so automation stops prioritizing it every run.
    _syncPerkCategoryTaskIds();
}

/**
 * Re-seed the location-check dedupe from the host's already-checked
 * locations for THIS region, so a re-completed task (loop-reset replay,
 * revisit) never re-dispatches a check that already landed.
 */
function _reseedReportedLocations() {
    _reportedLocationNames.clear();
    const map = _world?.ap_locations;
    if (!map) return;
    const checked = new Set(_client?.getStateSnapshot?.()?.checkedLocations ?? []);
    for (const locName of Object.values(map)) {
        if (checked.has(locName)) _reportedLocationNames.add(locName);
    }
}

/**
 * Tell the fork which suppressed perk tasks its automation must still judge
 * as unearned-perk tasks.
 *
 * Grant suppression patches a perk task's `perk` → the Count sentinel. But
 * BOTH of the fork's categorizers gate on `def.perk != Count && !hasPerk(...)`,
 * so suppression silently (a) drops the task into the `other` energy-threshold
 * category, whose energy-per-level metric perk tasks fail BY DESIGN — their
 * xp_mult is deliberately tiny because the perk is the reward — and (b) demotes
 * it out of the cheapest-first auto-fill "perk" priority band. Automation then
 * refuses the task at ANY cost, so its AP location is never checked. The
 * `!hasPerk` half bites too: in a multiworld the perk item routinely arrives
 * before its task is done.
 *
 * The set is the forced perk-category union defined in perkOrigin.js —
 * NATIVE perk tasks (the region's `perk` suppression patches) ∪ perk
 * HOLDERS (tasks whose own AP location holds a perk item, per the post-fill
 * placements) — restricted to tasks whose AP location is not yet checked;
 * an id is retired once its check lands, so a finished task stops being
 * prioritized every run. The holder leg is what keeps a perk milestone the
 * fill placed on a NON-perk task out of the `other` category, whose
 * cost-invariant energy-per-level metric would otherwise refuse it at any
 * cost. The Pass-B solver and the jta-stats model apply the same union —
 * keep the three in sync through perkOrigin.js, never by re-implementing.
 *
 * Placements resolve lazily from staticData: until they do, the set is
 * native-only, and the next snapshotUpdated sync (which follows every
 * region load's snapshot request) widens it. Dormant in base scope (no
 * task_patches AND no ap_locations).
 */
function _syncPerkCategoryTaskIds() {
    if (typeof _w.setPerkCategoryTaskIds !== 'function') return;
    const patches = Array.isArray(_world?.task_patches) ? _world.task_patches : [];
    const apLocations = _world?.ap_locations;
    const hasApLocations = apLocations && typeof apLocations === 'object'
        && Object.keys(apLocations).length > 0;
    if (patches.length === 0 && !hasApLocations) return;
    // Native leg: perk-suppression patches are exactly the ones carrying a
    // `perk` field.
    const nativeIds = patches
        .filter((p) => p != null && Object.prototype.hasOwnProperty.call(p, 'perk'))
        .map((p) => p.id);
    // Holder leg (own placements resolve lazily; null until staticData lands).
    let holderIds = [];
    const own = hasApLocations ? _ensureOwnPlacements() : null;
    if (own) {
        holderIds = perkHolderTaskIds({
            apLocations,
            // ownPlacements values are bare item names, already player-filtered.
            itemAtLocation: (name) => own.byLocation.get(name),
            perkNames: _activePerkNameSet(),
        });
    }
    const ids = [];
    for (const id of forcedPerkCategoryIds(nativeIds, holderIds)) {
        const locationName = _resolveLocationName(id);
        if (locationName !== null && _reportedLocationNames.has(locationName)) continue;
        ids.push(id);
    }
    try {
        _w.setPerkCategoryTaskIds(ids);
    } catch (err) {
        log('error', 'setPerkCategoryTaskIds threw:', err);
    }
}

// The active data source's perk item names (dataset's when this world carries
// one, vanilla snapshot's otherwise), memoized on the dataset document
// identity — _world changes per region, the document rides every region.
let _perkNameSetSource = null;
let _perkNameSet = null;
function _activePerkNameSet() {
    const dataset = _world?.jta_dataset ?? null;
    if (!_perkNameSet || _perkNameSetSource !== dataset) {
        _perkNameSet = new Set(activePerkItemNames(dataset));
        _perkNameSetSource = dataset;
    }
    return _perkNameSet;
}

/**
 * Resolve (and memoize) which item sits on each of the player's own locations,
 * from the post-fill placement in staticData. Returns null while staticData is
 * unavailable — callers then fall back to origin-blind reconciliation.
 */
function _ensureOwnPlacements() {
    if (_ownPlacements) return _ownPlacements;
    const staticData = _client?.getStaticData?.();
    if (!staticData) return null;
    // Two staleness guards, because a rules reload leaves the AdapterClient
    // cache describing the old world: skip the exact object we saw at reload,
    // and skip any staticData whose locations don't cover this region's — a
    // response that raced the host's own cache update is a fresh object with
    // stale content, and memoizing it would misclassify every perk.
    if (staticData === _staleStaticData) return null;
    if (!staticDataMatchesRegion(staticData, _world?.ap_locations)) return null;
    _ownPlacements = buildOwnPlacements(staticData);
    if (_ownPlacements) {
        log('debug', `own placements resolved: ${_ownPlacements.byLocation.size} locations`);
    }
    return _ownPlacements;
}

/**
 * Own-world leg of the grant semantics: the perk a task's own AP location holds
 * is granted on EVERY full completion of that task, exactly like the vanilla
 * perk the placement replaced. That is what carries a perk back across a
 * prestige — doPrestige() wipes the perk but not the location check, so the
 * task is re-run and re-grants. grantPerk is idempotent, so the ordinary
 * completions in between are no-ops.
 *
 * Non-perk placements (filler, Victory) self-reject once and are then skipped.
 */
function _grantOwnPerkForLocation(locationName) {
    if (typeof _w.grantPerk !== 'function') return;
    const own = _ensureOwnPlacements();
    const itemName = own?.byLocation.get(locationName);
    if (!itemName || _nonPerkItemNames.has(itemName)) return;
    try {
        const res = _w.grantPerk(itemName);
        if (!res?.success) {
            _nonPerkItemNames.add(itemName);
            return;
        }
        if (!res.alreadyHad) log('debug', `granted own-world perk '${itemName}' on task completion`);
    } catch (err) {
        log('error', `grantPerk('${itemName}') threw:`, err);
    }
}

/**
 * Foreign leg of the grant semantics: a perk the fill placed in another
 * player's world has no task to re-run, so the client owns its whole lifetime —
 * granted when the item arrives, and re-granted after a prestige wipes it.
 *
 * Own-world perks are deliberately NOT granted here; they belong to
 * _grantOwnPerkForLocation. Until staticData resolves the origin split we can't
 * tell the two apart, so we grant everything once (the pre-origin behaviour) —
 * grantPerk self-rejects non-perk items, so filler costs nothing but a lookup.
 *
 * `regrant` ignores the once-ever dedupe; it needs a resolved origin split, or
 * it would restore own-world perks a prestige was supposed to take.
 */
function _reconcilePerksFromInventory({ regrant = false } = {}) {
    if (typeof _w.grantPerk !== 'function') return;
    const inv = _client?.getStateSnapshot?.()?.inventory;
    if (!inv || typeof inv !== 'object') return;
    const own = _ensureOwnPlacements();
    if (regrant && !own) {
        log('warn', 'prestige: no placement data — foreign perks not re-granted');
        return;
    }
    for (const [name, count] of Object.entries(inv)) {
        if (Number(count) <= 0) continue;
        if (own?.itemNames.has(name)) continue;
        if (!regrant && _processedItems.has(name)) continue;
        _processedItems.add(name);
        try {
            const res = _w.grantPerk(name);
            if (res?.success && !res.alreadyHad) {
                log('debug', `granted foreign perk from AP item '${name}'`);
            }
        } catch (err) {
            log('error', `grantPerk('${name}') threw:`, err);
        }
    }
}

/**
 * A prestige just wiped every perk. Own-world perks come back when their task
 * next completes; foreign ones have no task, so restore them now.
 * Idempotent — safe to call on a reset that turned out not to be a prestige.
 */
function _handlePrestige() {
    _reconcilePerksFromInventory({ regrant: true });
}

/**
 * Detect a prestige. The fork's energy-reset callback fires for doEnergyReset
 * and doPrestige alike, and its payload carries no prestige flag, so compare
 * prestige_count across calls. Seeds itself on the first call (a bridge that
 * attaches to an already-prestiged save must not treat that as a fresh wipe).
 */
function _checkForPrestige() {
    if (typeof _w.getFullState !== 'function') return;
    const count = _w.getFullState()?.prestigeCount;
    if (typeof count !== 'number') return;
    const previous = _lastPrestigeCount;
    _lastPrestigeCount = count;
    if (previous !== null && count > previous) {
        log('debug', `prestige detected (count ${previous} -> ${count})`);
        _handlePrestige();
    }
}

/**
 * Apply this region's grant-suppression patches (perk → Count) so
 * completing a perk-task grants nothing locally — the perk arrives only as
 * an AP item. Idempotent; safe to re-apply on every region load. A task
 * can't complete before its region loads, so per-region suppression covers
 * every perk-task before it's reachable.
 */
function _applyTaskPatches() {
    const patches = _world?.task_patches;
    if (!Array.isArray(patches) || patches.length === 0) return;
    if (typeof _w.applyTaskPatches !== 'function') {
        log('warn', 'applyTaskPatches hook missing — local perk grants NOT suppressed (double-grant risk)');
        return;
    }
    try {
        _w.applyTaskPatches(patches);
    } catch (err) {
        log('error', 'applyTaskPatches threw:', err);
    }
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

// ────────────────────────────────────────────────────────────────
// Action-queue channel — host proxy commands (jta:queueAction)
// ────────────────────────────────────────────────────────────────
//
// The host-side JtA action-queue engine (jtaQueueEngine, via its
// BridgeTransport) drives the live fork through this request/response
// channel. Each command is {method, args, requestId}; the bridge calls the
// matching fork window API and — when requestId is set — publishes
// jta:queueActionResult {requestId, method, result, error} back to the host.
// Mirrors the playbackControl pattern; the bridge stays the sole owner of
// the fork's single-slot completion/reset callbacks, so the executor polls
// getStatus rather than registering one.

/** Light poll payload for completion tracking: active task + current-zone reps. */
function _queueStatus() {
    if (typeof _w.getFullState !== 'function') return null;
    const s = _w.getFullState();
    return {
        activeTaskId: s.activeTaskId ?? null,
        currentEnergy: s.currentEnergy,
        tasks: s.tasks,
        // A playback walk owns the zone's automation; the action queue must
        // not drive concurrently. The host executor watches this to pause.
        walkInFlight: !!_pendingWalkExit,
    };
}

/** Rejection payload returned to the executor while a playback walk owns the zone. */
const _WALK_IN_FLIGHT = Object.freeze({
    success: false,
    error: 'playback walk in flight',
    walkInFlight: true,
});

/**
 * Dispatch one queueAction method to the fork window API. Returns the fork's
 * result (or a small derived payload); throws on an unknown method or a
 * missing fork hook so the caller reports an error.
 *
 * While a playback walk is pending (_pendingWalkExit set), the driving
 * commands (performTask / useItem / setAutomationMode) are refused: the walk
 * is played by the game's own automation and must not be disturbed. Read-only
 * queries stay available so the executor can observe the walk and pause.
 */
function _dispatchQueueAction(method, args) {
    switch (method) {
        case 'performTask':
            if (_pendingWalkExit) return _WALK_IN_FLIGHT;
            if (typeof _w.performTask !== 'function') throw new Error('performTask hook missing');
            return _w.performTask(args[0]);
        case 'useItem':
            if (_pendingWalkExit) return _WALK_IN_FLIGHT;
            if (typeof _w.useItem !== 'function') throw new Error('useItem hook missing');
            return _w.useItem(args[0], !!args[1]);
        case 'getStatus':
            return _queueStatus();
        case 'getActions':
            // JtA reports its loaded actions for ALL zones (the live ZONES
            // table via getAllZoneActions) plus every item and artifact
            // (getAllItems). This is the catalog source — no static table — so
            // it stays correct when synthetic data replaces the zone tables.
            return {
                zones: typeof _w.getAllZoneActions === 'function' ? _w.getAllZoneActions() : [],
                items: typeof _w.getAllItems === 'function' ? _w.getAllItems() : [],
            };
        case 'getAllItems':
            // All item + artifact definitions ({type, name, isArtifact}).
            return typeof _w.getAllItems === 'function' ? _w.getAllItems() : [];
        case 'getFullState':
            return typeof _w.getFullState === 'function' ? _w.getFullState() : null;
        case 'getPreviousRunActions':
            // Ordered log of what actually ran during the run that ended at the
            // last reset (task reps + item uses, in sequence).
            return typeof _w.getPreviousRunActions === 'function' ? _w.getPreviousRunActions() : [];
        case 'getCurrentRunActions':
            return typeof _w.getCurrentRunActions === 'function' ? _w.getCurrentRunActions() : [];
        case 'getItemDefs':
            // Item-name sourcing is deferred to Phase 3: the fork exposes no
            // name table today and v1 makes no fork changes. Relay names if a
            // future hook appears; otherwise an empty list (callers fall back).
            return typeof _w.getItemDefs === 'function' ? _w.getItemDefs() : { items: [] };
        case 'getAutomationMode':
            return typeof _w.getAutomationMode === 'function' ? _w.getAutomationMode() : null;
        case 'setAutomationMode':
            // Refuse to touch automation mid-walk — the walk needs it On.
            if (_pendingWalkExit) return _WALK_IN_FLIGHT;
            if (typeof _w.setAutomationMode !== 'function') throw new Error('setAutomationMode hook missing');
            return _w.setAutomationMode(args[0]);
        default:
            throw new Error(`unknown queueAction method '${method}'`);
    }
}

function _handleQueueAction(payload) {
    const method = payload?.method;
    const requestId = payload?.requestId;
    const args = Array.isArray(payload?.args) ? payload.args : [];
    let result = null;
    let error = null;
    try {
        result = _dispatchQueueAction(method, args);
    } catch (err) {
        error = String(err?.message ?? err);
        log('warn', `queueAction '${method}' failed:`, error);
    }
    if (requestId != null && _client) {
        _client.publishEventBus('jta:queueActionResult', { requestId, method, result, error });
    }
}

/**
 * Fired by the fork at the end of doEnergyReset() AND doPrestige().
 * When the GAME initiated the reset (overlay click, the
 * auto_continue_energy_reset mod, threshold End Run, Auto-Prestige),
 * ask the host to run the matching loop reset. Resets the bridge
 * applied itself (_applyingHostReset) are not reported back.
 *
 * The prestige check runs BEFORE that suppression: a prestige wipes perks
 * whoever asked for the reset, and its re-grants are a game-state repair the
 * host has no part in.
 */
function _handleGameEnergyReset(state) {
    _checkForPrestige();
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
    // Seed the prestige counter from the loaded save, so a bridge attaching to
    // an already-prestiged game doesn't read its first reset as a fresh wipe.
    _checkForPrestige();
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

    // Action-queue commands from the host-side BridgeTransport
    // (performTask / useItem / getStatus / getFullState / getItemDefs /
    // get+set automation mode). Replies go back as jta:queueActionResult.
    _client.subscribeEventBus('jta:queueAction', _handleQueueAction);

    // AP state changed (item received here or elsewhere): grant any newly
    // received perk items. Perks are global, so this runs regardless of the
    // active region (grantPerk is persistence-safe even before a zone loads).
    _client.subscribeEventBus('stateManager:snapshotUpdated', () => {
        _reconcilePerksFromInventory();
        // checkedLocations can grow outside our own completions (reconnect,
        // co-op release), so re-derive the retirement set from the snapshot.
        _reseedReportedLocations();
        _syncPerkCategoryTaskIds();
    });

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
        // New world: drop per-world zone-locations bookkeeping so location
        // checks and perk grants re-derive from the new world's sphere log /
        // inventory (grantPerk stays idempotent against a shared save).
        _reportedLocationNames.clear();
        _processedItems.clear();
        // New placements too — but the cached staticData still describes the
        // old world until the response to the request below lands.
        _staleStaticData = _client?.getStaticData?.() ?? null;
        _ownPlacements = null;
        _nonPerkItemNames.clear();
        _clearPendingWalk();
        _client?.requestStaticData?.();
        _client?.requestStateSnapshot?.();
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
    // Zone-locations (Phase 2): report every full task completion as an AP
    // location check. Dormant when the region carries no ap_locations.
    if (typeof _w.setTaskCompletionCallback === 'function') {
        _w.setTaskCompletionCallback(_handleTaskCompleted);
    } else {
        log('warn', 'setTaskCompletionCallback hook missing — AP location checks will not fire');
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
