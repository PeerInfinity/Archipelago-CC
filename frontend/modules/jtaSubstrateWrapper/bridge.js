/**
 * Bridge — runs inside the JtA iframe. Injected by
 * jtaSubstrateWrapperPanel after the iframe's `load` event fires.
 *
 * Phase 5 scope (this commit):
 *   - On startup: switch JtA into managed mode (pause loop, wipe
 *     the briefly localStorage-loaded state, initialize fresh) and
 *     complete the iframeAdapter handshake.
 *   - On every jta:loadRegion: catch-up sync any loop resets the
 *     host fired while JtA was inactive, sync JtA's energy/max
 *     from the shared pool, load the right zone (in completed
 *     state if the player already finished this region this loop),
 *     inject synthetic exit tasks for re-entries.
 *   - While active: poll JtA's energy and mirror the drain into
 *     the shared loop-mode pool via `jta:bridgeDeductMana` events
 *     (the wrapper-host module handles the actual deduct + the
 *     out-of-mana → triggerLoopReset path).
 *   - On Travel-task completion: mark the region completed for this
 *     loop, dispatch user:regionMove for single-exit regions, or
 *     inject synthetic exit-choice tasks for multi-exit regions.
 *
 * Host-side counterpart wiring lives in
 *   ../jtaSubstrateWrapper/index.js — that module subscribes to
 *   `iframe:appReady` (to push the initial pool state to this bridge)
 *   and to `jta:bridgeDeductMana` (to deduct from gameState and
 *   trigger the loop reset when the pool hits ≤ 0).
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
    if (delta > 0 && _client) {
        // The host module handles the gameState mutation + the
        // out-of-mana → triggerLoopReset path.
        _client.publishEventBus('jta:bridgeDeductMana', { amount: delta });
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
    for (let i = 0; i < delta; i++) {
        _w.doEnergyReset();
    }
    _lastAppliedResetCount = _hostResetCount;
    log('debug', `applied ${delta} catch-up reset(s); JtA now at zone 0`);
}

function _syncEnergyFromPool() {
    if (typeof _w.setEnergy !== 'function') return;
    _w.setEnergy(_hostCurrentMana, _hostMaxMana);
    _lastSampledEnergy = _hostCurrentMana;
}

// ────────────────────────────────────────────────────────────────
// Region loading + exit handling
// ────────────────────────────────────────────────────────────────

/**
 * Look up the region's exits in the cached static data. Returns
 * an array of { name, connected_region } or an empty array if the
 * region or static data isn't available.
 */
function _getRegionExits(regionId) {
    const staticData = _client?.getStaticData?.();
    const regions = staticData?.regions;
    if (!regions || typeof regions.get !== 'function') return [];
    const region = regions.get(regionId);
    if (!region || !Array.isArray(region.exits)) return [];
    return region.exits;
}

function _dispatchRegionMove(targetRegion, exitName) {
    if (!_client) return;
    _client.publishEventDispatcher('user:regionMove', {
        sourceRegion: _currentRegionId,
        targetRegion,
        exitName: exitName ?? null,
    }, { initialTarget: 'bottom' });
}

/**
 * Inject one synthetic exit-choice task per exit. The fork accepts
 * cost_multiplier = 0 so exit tasks drain no energy in v1.
 */
function _injectExitTasks(exits) {
    if (typeof _w.injectSyntheticTask !== 'function') {
        log('warn', 'injectSyntheticTask hook missing; exit tasks not injected');
        return;
    }
    for (const exit of exits) {
        const taskId = _allocSyntheticId();
        const label = exit.connected_region
            ? `Take exit: ${exit.name} (to ${exit.connected_region})`
            : `Take exit: ${exit.name}`;
        _w.injectSyntheticTask(
            { id: taskId, name: label, costMultiplier: 0 },
            () => {
                _dispatchRegionMove(exit.connected_region ?? null, exit.name);
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

    // On re-entry to a completed region, inject exit tasks so the
    // player has something to click (the Travel task is already done).
    if (completed) {
        const exits = _getRegionExits(regionId);
        if (exits.length === 0) {
            log('warn', `Completed region ${regionId} has no exits`);
        } else {
            _injectExitTasks(exits);
        }
    }
    // For first-traversal regions: nothing to inject — the player
    // works through the zone normally; the Travel-task callback below
    // handles the exit choice when the zone's Travel task completes.

    _startPolling();
    log('debug', `loaded region ${regionId} (zone ${jtaZone}, completed=${completed})`);
}

function _handleTravelTaskCompleted(zone, task) {
    if (!_currentRegionId) {
        log('warn', `travel task ${task?.id} completed but no current region`);
        return;
    }
    // Mark the region completed for this loop. Subsequent re-entries
    // load it in completed state (only exit tasks visible).
    _completedThisLoop.add(_currentRegionId);

    const exits = _getRegionExits(_currentRegionId);
    if (exits.length === 0) {
        log('warn', `Travel task in ${_currentRegionId} completed but region has no exits`);
        return;
    }
    if (exits.length === 1) {
        // Single exit: dispatch directly. No synthetic task needed.
        const exit = exits[0];
        _dispatchRegionMove(exit.connected_region ?? null, exit.name);
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
    // Step 1: switch JtA into managed mode. See Phase 4 commit for
    // why this happens here (the iframe `load` injection point is
    // after JtA's own DOMContentLoaded; we wipe and re-init).
    if (typeof _w.setManagedMode !== 'function') {
        log('error', 'JtA managed-mode hook not present; aborting bridge');
        return;
    }
    _w.setManagedMode(true);
    if (typeof _w.pauseGameLoop === 'function') _w.pauseGameLoop();
    if (typeof _w.initializeHeadless === 'function') _w.initializeHeadless();
    log('info', 'JtA in managed mode (loop paused, state wiped)');

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
        log('debug', 'initial state received', { _hostCurrentMana, _hostMaxMana, _hostResetCount });
    });

    // Incremental updates.
    _client.subscribeEventBus('gameState:manaChanged', (data) => {
        if (typeof data?.current === 'number') _hostCurrentMana = data.current;
        if (typeof data?.max === 'number') _hostMaxMana = data.max;
    });

    _client.subscribeEventBus('gameState:loopReset', (data) => {
        if (typeof data?.resetCount === 'number') _hostResetCount = data.resetCount;
        // The host just reset the loop. Clear per-loop completion
        // tracking; the bridge's catch-up sync on next jta:loadRegion
        // will apply doEnergyReset and resync energy.
        _completedThisLoop.clear();
    });

    _client.subscribeEventBus('gameState:regionChanged', (data) => {
        // If we move away from this jta region (or to a different
        // jta region — the next jta:loadRegion will re-activate),
        // stop polling.
        if (data?.newRegion && data.newRegion !== _currentRegionId) {
            _isActive = false;
            _stopPolling();
        }
    });

    // Region activation events (from procgenPlayer).
    _client.subscribeEventBus('jta:loadRegion', _handleLoadRegion);

    // Step 4: register the Travel-task callback on the JtA side.
    if (typeof _w.setTravelTaskCallback === 'function') {
        _w.setTravelTaskCallback(_handleTravelTaskCompleted);
    } else {
        log('warn', 'setTravelTaskCallback hook missing — single-exit transitions will not work');
    }

    // Step 5: announce ready. The host module's iframe:appReady
    // subscriber will respond with jtaSubstrateWrapper:initialState.
    _client.notifyAppReady();
    log('info', 'connected to host; appReady sent');

    // Resume the JtA loop so the player can work tasks. Polling
    // starts on first jta:loadRegion.
    if (typeof _w.resumeGameLoop === 'function') _w.resumeGameLoop();
}

main().catch((err) => {
    log('error', 'fatal:', err);
});
