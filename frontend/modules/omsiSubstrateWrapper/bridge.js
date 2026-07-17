/**
 * Bridge — runs inside the omsi-loops iframe. Injected by
 * OmsiSubstrateWrapperPanel after the iframe's `load` event fires.
 *
 * Responsibilities (cross-game R2 slice 2; jta bridge = the template):
 *   - On startup: wait for the fork's managed boot (?managed=1 makes
 *     index.html call IdleLoopsManaged.boot() — dedicated
 *     `idleLoops_substrate` save slot, game clock never starts) and
 *     complete the iframeAdapter handshake.
 *   - THE CLOCK: managed mode has no tick loop — the bridge owns a
 *     host-driven clock. While an omsi region is active, a setInterval
 *     advances the engine via IdleLoopsManaged.step() at the game's
 *     base rate (baseManaPerSecond = 50 ticks/s, 1 tick = 1 mana; v0
 *     runs flat base speed, no bonus-speed multipliers) and then
 *     drains the view's coalesced render queue (view.update() —
 *     nothing else calls it in managed mode). Strict jta pause
 *     semantics: the clock runs ONLY while an omsi region is active.
 *     Stepping is skipped while the game has no enabled queued actions
 *     — with an empty queue every singleTick would restart the loop
 *     (shouldRestart), ping-ponging resets with the host at 50/s.
 *   - Mana mirroring: after each interval the bridge samples the
 *     game's remaining loop budget (manaLeft = timeNeeded − timer, the
 *     §4 mapping) and publishes the signed delta as the generic
 *     channel event `substrate:resourceDelta { substrateId: 'omsi',
 *     resource: 'mana', amount }` — negative drains (1/tick), positive
 *     mirrors the game's own in-loop gains (Buy Mana etc. extend
 *     timeNeeded). External pool changes (another substrate spent
 *     mana, max-mana recompute) are told apart from our own mirrored
 *     deltas by the expected-pool echo pattern and pushed back into
 *     the game's budget via IdleLoopsManaged.addMana (signed:
 *     timeNeeded += amount).
 *   - Starting-budget bonus: the game's native per-loop budget
 *     (timeNeededInitial, 250 mana) is reported up as
 *     `substrate:resourceBonus` so an omsi loop's base budget raises
 *     the shared starting pool instead of starving against the host
 *     default — the omsi analogue of jta's default energyBonusSync
 *     posture. On entry/reset the budget is then pinned to the pool.
 *   - Reset propagation, both ways:
 *       game → host: driver restart() fires the managed onRestart
 *         callback; the bridge publishes `substrate:resourceReset
 *         { hostResetCount }` (suppressed while the bridge itself is
 *         applying a host reset). Because drains mirror 1:1 and the
 *         budget is pinned to the pool, the game's natural
 *         timer ≥ timeNeeded restart coincides with the pool hitting
 *         0 — the router's reset-count race guard collapses the two
 *         into exactly one loop reset per omsi loop.
 *       host → game: gameState:loopReset applies restartLoop()
 *         immediately while an omsi region is active; resets fired
 *         while inactive are caught up on the next omsi:loadRegion
 *         (applied-count bookkeeping, verbatim jta pattern).
 *   - Victory location (v0, slice 3): completing Start Journey
 *     unlocks town 1 (townsUnlocked is persistent), reported once as
 *     a user:locationCheck on the sidecar's ap_locations.start_journey
 *     name — the Victory item rides that check.
 *   - No-progress guard: a restart after a loop that consumed (almost)
 *     no effective time means no queued action could run (empty queue
 *     slips past the step gate only in exotic states; a queue whose
 *     actions all fail canStart restarts every tick). Such restarts
 *     are NOT reported to the host — no reset ping-pong; the game
 *     just idles locally until the player fixes the queue.
 *
 * Host-side counterpart: ../omsiSubstrateWrapper/index.js pushes the
 * initial pool state on iframe:appReady; the channel events are
 * handled by the generic resourceChannels router (validates the
 * substrate id against the registry's sharing.mana declaration, runs
 * the pool mirroring, the out-of-mana → triggerLoopReset path, and
 * the reset-count race guard).
 *
 * Engine globals (IdleLoopsManaged, actions, view, timeNeededInitial)
 * are top-level `const`s of the fork's classic scripts — global
 * LEXICAL bindings, not window properties. A module script shares the
 * global scope chain, so bare-identifier access behind `typeof`
 * guards is the correct pattern (mirrors how driver.js itself guards
 * IdleLoopsManaged for worker contexts).
 */

import { IframeClient } from '../iframe-base/iframeClient.js';

function log(level, ...args) {
    const fn = console[level] || console.log;
    fn('[omsi-bridge]', ...args);
}

// ────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────

const CLOCK_INTERVAL_MS = 100;
// The game's base rate: baseManaPerSecond = 50 (driver.js), 1 tick = 1
// mana. v0 deliberately ignores in-game bonus-speed multipliers.
const TICKS_PER_SECOND = 50;
// Cap on the catch-up burst a single callback may step (browsers
// throttle timers in occluded/background documents; stepping by
// ELAPSED time keeps the average rate at TICKS_PER_SECOND regardless,
// and the cap keeps a long-occluded iframe from replaying minutes of
// game time in one burst — same idea as the game's own tick()).
const MAX_TICKS_PER_CALLBACK = 100;
// The view's coalesced render queue is drained at most this often.
const VIEW_UPDATE_MIN_MS = 200;
const POOL_EPSILON = 0.001;
// A loop that ended after less than this much effective time (seconds;
// 1 tick = 1/50 s) made no real progress — see the no-progress guard.
const NO_PROGRESS_LOOP_S = 0.05;

let _client = null;

// Active-region state
let _currentRegionId = null;
let _world = null;                 // deserialized playable_payload
let _isActive = false;

// Cached host state (kept up-to-date by event subscriptions)
let _hostCurrentMana = 100;
let _hostMaxMana = 100;
let _hostResetCount = 0;
let _lastAppliedResetCount = 0;    // how many host resets we've applied to the game

// Echo detection for the two-way mana sync (jta _expectedPool pattern):
// after publishing a delta we predict the pool value the host's
// manaChanged echo will carry; a non-matching manaChanged is an
// external pool change and gets pushed into the game's budget.
// null ⇒ no prediction (treat the next manaChanged as external).
let _expectedPool = null;

// True while the bridge itself is running restartLoop() (host-reset
// propagation) — suppresses the managed onRestart callback so our own
// resets aren't reported back to the host.
let _applyingHostReset = false;

// Clock + sampling
let _clockWorker = null;           // Worker metronome (throttling-exempt)
let _clockIntervalId = null;       // setInterval fallback
let _lastClockTime = null;         // wall-clock ms of the last callback
let _lastViewUpdateTime = 0;
let _lastSampledManaLeft = null;   // manaLeft at the last sample
let _lastReportedBudget = null;    // last starting-budget bonus pushed up
let _ticksAtLastRestart = 0;       // totals.effectiveTime at the last restart (s)
// AP location names already reported this session (v0: the single
// Start Journey victory location). Re-seeded from checkedLocations on
// every region load; cleared on rules reload (a new world).
const _reportedLocationNames = new Set();

// Clock diagnostics, exposed via __omsiBridge.getDebugState().
const _clockStats = {
    messages: 0, inactiveSkips: 0, callbacks: 0,
    ticksStepped: 0, skippedNoQueue: 0, maxElapsedMs: 0,
};

// ────────────────────────────────────────────────────────────────
// Engine access (global lexical bindings — see header comment)
// ────────────────────────────────────────────────────────────────

function _managed() {
    // eslint-disable-next-line no-undef
    return typeof IdleLoopsManaged !== 'undefined' ? IdleLoopsManaged : null;
}

function _engineActions() {
    // eslint-disable-next-line no-undef
    return typeof actions !== 'undefined' ? actions : null;
}

function _engineView() {
    // eslint-disable-next-line no-undef
    return (typeof view !== 'undefined' && view) ? view : null;
}

function _nativeStartingBudget() {
    // restart() resets timeNeeded to this constant (saving.js: 5 * 50).
    // eslint-disable-next-line no-undef
    return typeof timeNeededInitial !== 'undefined' ? timeNeededInitial : null;
}

function _fullState() {
    const m = _managed();
    return m ? m.getFullState() : null;
}

/** The game's remaining loop budget — the §4 mana mapping. */
function _manaLeft() {
    const s = _fullState();
    return s ? s.timeNeeded - s.timer : null;
}

// ────────────────────────────────────────────────────────────────
// Clock — the bridge owns time in managed mode
// ────────────────────────────────────────────────────────────────

function _startClock() {
    if (_clockWorker !== null || _clockIntervalId !== null) return;
    _lastClockTime = null;
    // The metronome lives in a dedicated Worker: page timers are
    // subject to background/occlusion throttling (headless test runs
    // hit this hard — observed multi-second timer suspensions), while
    // worker timers keep firing. The elapsed-based stepping in
    // _clockTick absorbs whatever jitter remains.
    try {
        const src = `setInterval(() => postMessage(0), ${CLOCK_INTERVAL_MS});`;
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        _clockWorker = new Worker(url);
        URL.revokeObjectURL(url);
        _clockWorker.onmessage = () => _clockTick();
    } catch (err) {
        log('warn', 'clock worker unavailable; falling back to setInterval', err);
        _clockIntervalId = setInterval(_clockTick, CLOCK_INTERVAL_MS);
    }
}

function _stopClock() {
    if (_clockWorker !== null) {
        _clockWorker.terminate();
        _clockWorker = null;
    }
    if (_clockIntervalId !== null) {
        clearInterval(_clockIntervalId);
        _clockIntervalId = null;
    }
}

function _isClockRunning() {
    return _clockWorker !== null || _clockIntervalId !== null;
}

/**
 * True when the game's plan has at least one enabled action to run.
 * With nothing runnable, every singleTick would end the loop
 * (shouldRestart → restart), so the clock idles instead of stepping.
 */
function _hasRunnableQueue() {
    const next = _engineActions()?.next;
    if (!Array.isArray(next)) return false;
    return next.some((e) => e && !e.disabled && (e.loops ?? 0) > 0);
}

function _clockTick() {
    _clockStats.messages += 1;
    const m = _managed();
    if (!m || !_isActive) {
        _clockStats.inactiveSkips += 1;
        return;
    }
    const now = Date.now();
    const elapsedMs = _lastClockTime === null ? CLOCK_INTERVAL_MS : now - _lastClockTime;
    _lastClockTime = now;
    _clockStats.callbacks += 1;
    if (elapsedMs > _clockStats.maxElapsedMs) _clockStats.maxElapsedMs = elapsedMs;
    if (!_hasRunnableQueue()) _clockStats.skippedNoQueue += 1;
    if (_hasRunnableQueue()) {
        // Step by elapsed wall time so the average rate stays at the
        // game's base speed even when the browser throttles callbacks.
        const ticks = Math.min(
            MAX_TICKS_PER_CALLBACK,
            Math.round((elapsedMs * TICKS_PER_SECOND) / 1000),
        );
        if (ticks > 0) m.step(ticks);
        _clockStats.ticksStepped += ticks;
        // Managed mode never drains the coalesced render queue
        // (view.update is UPS-driven in normal boots) — do it here,
        // rate-limited, so the UI tracks the host-driven time.
        if (ticks > 0 && now - _lastViewUpdateTime >= VIEW_UPDATE_MIN_MS) {
            _lastViewUpdateTime = now;
            _engineView()?.update();
        }
    }
    // Sample OUTSIDE the stepping gate: host-visible drains/gains can
    // also come from direct engine manipulation (addMana — Buy Mana
    // effects, tests, future hooks), not just from our own stepping.
    _samplePoolMirror();
    _checkVictoryProgress();
}

// ────────────────────────────────────────────────────────────────
// Victory location (v0: complete Start Journey ⇔ town 1 unlocked)
// ────────────────────────────────────────────────────────────────

/**
 * Re-seed the location-check dedupe from the host's already-checked
 * locations, so a restored save / region revisit never re-dispatches a
 * check that already landed (jta pattern, reduced to v0's single
 * location).
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
 * v0 victory watch: completing Start Journey calls the game's own
 * unlockTown(1), growing townsUnlocked past the starting [0] —
 * townsUnlocked is PERSISTENT (not per-loop), so this is exactly the
 * "completed Start Journey at least once" milestone the §6 ruling
 * places the Victory item on. Reported as a normal AP location check;
 * the location name comes from the sidecar's ap_locations map.
 */
function _checkVictoryProgress() {
    const locationName = _world?.ap_locations?.start_journey;
    if (!locationName || _reportedLocationNames.has(locationName)) return;
    const s = _fullState();
    if (!s || !Array.isArray(s.townsUnlocked) || s.townsUnlocked.length <= 1) return;
    _reportedLocationNames.add(locationName);
    if (!_client) return;
    _client.publishEventDispatcher('user:locationCheck', {
        locationName,
        regionName: _currentRegionId,
        originator: 'omsiSubstrate',
    }, { initialTarget: 'bottom' });
    log('debug', `Start Journey complete -> user:locationCheck (${locationName})`);
}

// ────────────────────────────────────────────────────────────────
// Mana mirroring
// ────────────────────────────────────────────────────────────────

function _samplePoolMirror() {
    const left = _manaLeft();
    if (left === null) return;
    if (_lastSampledManaLeft === null) {
        _lastSampledManaLeft = left;
        return;
    }
    const delta = left - _lastSampledManaLeft;   // negative = drain, positive = gain
    _lastSampledManaLeft = left;
    if (delta === 0 || !_client || !_world?.manaEnabled) return;
    if (_expectedPool !== null) {
        // Predict the host pool after our delta lands. Drains clamp at
        // 0 (gameState reports depletion there); gains are unclamped —
        // maxMana is the loop's STARTING mana, not a ceiling.
        _expectedPool = delta < 0
            ? Math.max(0, _expectedPool + delta)
            : _expectedPool + delta;
    }
    _client.publishEventBus('substrate:resourceDelta', {
        substrateId: 'omsi',
        resource: 'mana',
        amount: delta,
    });
}

/**
 * Pin the game's remaining budget to the host pool (entry, loop reset,
 * external pool change). addMana is signed: timeNeeded += amount.
 */
function _syncBudgetFromPool() {
    const m = _managed();
    if (!m) return;
    const left = _manaLeft();
    if (left === null) return;
    const adjust = _hostCurrentMana - left;
    if (Math.abs(adjust) > POOL_EPSILON) m.addMana(adjust);
    _lastSampledManaLeft = _manaLeft();
    _expectedPool = _hostCurrentMana;
}

/**
 * Report the game's native per-loop starting budget up to the shared
 * pool's per-substrate accumulator (folded into maxMana by gameState),
 * so an omsi loop's base 250-mana budget raises the shared starting
 * pool. Re-reported after _lastReportedBudget is nulled (region load,
 * rules reload — the host side may have dropped the bonus).
 */
function _reportBudgetBonusIfChanged() {
    if (!_client || !_world?.manaEnabled) return;
    const budget = _nativeStartingBudget();
    if (typeof budget !== 'number') return;
    if (_lastReportedBudget !== null
        && Math.abs(budget - _lastReportedBudget) <= POOL_EPSILON) return;
    _lastReportedBudget = budget;
    _client.publishEventBus('substrate:resourceBonus', {
        substrateId: 'omsi',
        resource: 'mana',
        bonus: budget,
    });
}

// ────────────────────────────────────────────────────────────────
// Reset propagation
// ────────────────────────────────────────────────────────────────

function _applyCatchUpResets() {
    // A host reset count BELOW what we've already applied means the
    // host started a new world (rules reload zeroes loopResetCount)
    // while this bridge kept living — re-baseline so the next real
    // reset computes a sane delta.
    if (_lastAppliedResetCount > _hostResetCount) {
        _lastAppliedResetCount = _hostResetCount;
    }
    const delta = _hostResetCount - _lastAppliedResetCount;
    if (delta <= 0) {
        _lastAppliedResetCount = _hostResetCount;
        return;
    }
    const m = _managed();
    if (!m) {
        _lastAppliedResetCount = _hostResetCount;
        return;
    }
    _applyingHostReset = true;
    try {
        for (let i = 0; i < delta; i++) m.restartLoop();
    } finally {
        _applyingHostReset = false;
    }
    _lastAppliedResetCount = _hostResetCount;
    // restartLoop reset the budget to the native base — re-baseline so
    // the refill isn't mirrored as a gain; the caller pins to the pool.
    _lastSampledManaLeft = _manaLeft();
    log('debug', `applied ${delta} catch-up reset(s)`);
}

/**
 * Managed onRestart callback — fires at the end of EVERY driver
 * restart(): natural budget exhaustion (timer ≥ timeNeeded), queue-end
 * restarts (shouldRestart), our own catch-up restartLoop() calls, and
 * host-driven test calls alike.
 */
function _handleGameRestart() {
    const ticksNow = _fullState()?.totalTicks ?? 0;
    const loopDuration = ticksNow - _ticksAtLastRestart;
    _ticksAtLastRestart = ticksNow;

    // The restart reset timer/timeNeeded; drains from the in-flight
    // step batch can no longer be told apart from the refill, so
    // re-baseline (they wash out in the reset's pool refill).
    _lastSampledManaLeft = _manaLeft();
    _expectedPool = null;

    if (_applyingHostReset) return;

    // No-progress guard: a loop that consumed (almost) no effective
    // time means nothing could run — don't ping-pong resets with the
    // host over an unrunnable plan.
    if (loopDuration < NO_PROGRESS_LOOP_S) return;

    if (!_world?.manaEnabled || !_client) return;

    // Pre-count the game's own reset as one applied host reset, so the
    // loop reset the host is about to fire (or the pool-exhaustion one
    // already in flight) isn't re-applied to the game.
    _lastAppliedResetCount += 1;

    // hostResetCount lets the router detect the exhaustion race: if a
    // loop reset already fired since we last synced (pool hit 0 and
    // the delta path reset first), the router skips firing a second.
    _client.publishEventBus('substrate:resourceReset', {
        substrateId: 'omsi',
        resource: 'mana',
        hostResetCount: _hostResetCount,
    });
    log('debug', 'game restart reported to host');
}

// ────────────────────────────────────────────────────────────────
// Region loading
// ────────────────────────────────────────────────────────────────

function _handleLoadRegion(payload) {
    if (!payload || !payload.region_id) {
        log('warn', 'omsi:loadRegion with no region_id', payload);
        return;
    }
    const world = payload.world ?? {};
    if (typeof world.omsiTown !== 'number') {
        log('warn', `omsi:loadRegion for ${payload.region_id} has no omsiTown`, world);
        return;
    }
    if (world.omsiTown !== 0) {
        // v0 = Beginnersville only (omsi substrate plan §6). The game
        // is always in its own town flow; a non-zero ordinal means a
        // preset from a future multi-town world — play town 0 anyway.
        log('warn', `omsiTown ${world.omsiTown} not supported in v0; treating as town 0`);
    }

    // Apply any loop resets the host fired while we were inactive,
    // then report the native budget bonus and pin the game's remaining
    // budget to the pool (same ordering as the jta bridge).
    _applyCatchUpResets();

    _currentRegionId = payload.region_id;
    _world = world;
    _isActive = true;
    _lastReportedBudget = null;   // host may have been reset while inactive
    _ticksAtLastRestart = _fullState()?.totalTicks ?? 0;
    _reportBudgetBonusIfChanged();
    if (world.manaEnabled) {
        _syncBudgetFromPool();
    } else {
        _lastSampledManaLeft = _manaLeft();
    }

    // Victory-location bookkeeping: dedupe against already-checked
    // locations, then check immediately — a restored save may already
    // have town 1 unlocked with the location unchecked.
    _reseedReportedLocations();
    _checkVictoryProgress();

    _startClock();
    _engineView()?.update();
    log('debug', `loaded region ${payload.region_id} (town ${world.omsiTown}, manaEnabled=${!!world.manaEnabled})`);
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

/**
 * index.html boots the game inside Localization.ready.then(...), which
 * can resolve after the iframe's `load` event (when this bridge is
 * injected). Wait for the managed boot to have actually run — boot()
 * stamps the `managed-mode` class on <html>.
 */
async function _waitForManagedBoot(timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const managed = _managed();
        if (managed && !managed.active) return false;   // not ?managed=1 — refuse
        if (managed && document.documentElement.classList.contains('managed-mode')) {
            return true;
        }
        if (Date.now() > deadline) return false;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}

async function main() {
    const booted = await _waitForManagedBoot();
    if (!booted) {
        log('error', 'omsi-loops did not boot in managed mode; aborting bridge');
        return;
    }
    log('info', 'omsi-loops in managed mode (host-driven clock)');

    _client = new IframeClient();
    const connected = await _client.connect();
    if (!connected) {
        log('error', 'IframeClient.connect() returned false');
        return;
    }

    // Initial state — the host module publishes this on iframe:appReady
    // with the current pool / reset-count state. Seed our caches.
    _client.subscribeEventBus('omsiSubstrateWrapper:initialState', (data) => {
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
    // mana-enabled region) is pushed into the game's budget.
    _client.subscribeEventBus('gameState:manaChanged', (data) => {
        const prevMax = _hostMaxMana;
        if (typeof data?.current === 'number') _hostCurrentMana = data.current;
        if (typeof data?.max === 'number') _hostMaxMana = data.max;
        if (!_isActive || !_world?.manaEnabled) return;
        const isEcho = _expectedPool !== null
            && Math.abs(_hostCurrentMana - _expectedPool) <= POOL_EPSILON
            && _hostMaxMana === prevMax;
        if (isEcho) {
            _expectedPool = _hostCurrentMana;   // resync to the exact float
        } else {
            _syncBudgetFromPool();
        }
    });

    _client.subscribeEventBus('gameState:loopReset', (data) => {
        if (typeof data?.resetCount === 'number') _hostResetCount = data.resetCount;
        // The payload carries the refilled pool; take it now so the
        // immediate-propagation path pins the budget to the fresh
        // values (the follow-up manaChanged then reads as an echo).
        if (typeof data?.mana?.current === 'number') _hostCurrentMana = data.mana.current;
        if (typeof data?.mana?.max === 'number') _hostMaxMana = data.mana.max;
        if (_isActive) {
            // Loop reset while standing in an omsi region: propagate
            // immediately (a restart the game already ran itself was
            // pre-counted in _handleGameRestart, so the catch-up delta
            // is 0 in that case).
            _applyCatchUpResets();
            if (_world?.manaEnabled) _syncBudgetFromPool();
        }
        // While inactive: deferred to the next omsi:loadRegion.
    });

    _client.subscribeEventBus('gameState:regionChanged', (data) => {
        // Moving away from this omsi region: stop the clock — no
        // background play while another substrate is active. A move to
        // a different omsi region re-activates via omsi:loadRegion.
        if (data?.newRegion && data.newRegion !== _currentRegionId) {
            _isActive = false;
            _stopClock();
        }
    });

    // Rules reloading means a NEW WORLD: gameState.reset() zeroed the
    // pool state and loopResetCount while this bridge kept living.
    // Re-baseline the reset bookkeeping and drop per-world state.
    _client.subscribeEventBus('stateManager:rulesLoaded', () => {
        log('debug', 'stateManager:rulesLoaded — re-baselining world state');
        _hostResetCount = 0;
        _lastAppliedResetCount = 0;
        _expectedPool = null;
        _lastReportedBudget = null;
        _reportedLocationNames.clear();
    });

    // Region activation events (from procgenPlayer).
    _client.subscribeEventBus('omsi:loadRegion', _handleLoadRegion);

    // Game-side loop-reset callback (driver restart() dispatches it).
    const m = _managed();
    m.onRestart(_handleGameRestart);
    _ticksAtLastRestart = _fullState()?.totalTicks ?? 0;

    // Debug/test surface (the in-app substrate tests read this — the
    // clock is bridge-owned, so there is no fork hook to ask).
    window.__omsiBridge = {
        isClockRunning: _isClockRunning,
        getDebugState: () => ({
            isActive: _isActive,
            currentRegionId: _currentRegionId,
            manaLeft: _manaLeft(),
            hostCurrentMana: _hostCurrentMana,
            hostMaxMana: _hostMaxMana,
            hostResetCount: _hostResetCount,
            lastAppliedResetCount: _lastAppliedResetCount,
            clockRunning: _isClockRunning(),
            clockStats: { ..._clockStats },
        }),
    };

    // Announce ready. The host module answers with
    // omsiSubstrateWrapper:initialState, and procgenPlayer re-publishes
    // the active region's loadRegion event if the player is already
    // standing in an omsi region.
    _client.notifyAppReady();
    log('info', 'connected to host; appReady sent');

    // The clock stays STOPPED until the player enters an omsi region
    // (omsi:loadRegion starts it; gameState:regionChanged away stops
    // it). A panel opened with no omsi region active shows the game
    // frozen — by design.
}

main().catch((err) => {
    log('error', 'fatal:', err);
});
