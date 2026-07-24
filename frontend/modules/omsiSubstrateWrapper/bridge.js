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
 *     name — the Victory item rides that check. AP-V1 generalizes this
 *     to `townsUnlocked.includes(world.victoryTown)` on the last
 *     included town's `travel_onward`.
 *   - AP-V1 unlock randomization (plan §7): on an emission-ON world
 *     (payload carries `unlockMeta`), the bridge is the AP↔fork
 *     translator for discovery capacity. Boot order is RULED and load-
 *     bearing: register onUnlockAchieved (passive) → seed the rows the
 *     server already holds → push the whole overlay (its check() would
 *     otherwise re-report them) → grant the quantity-step deltas.
 *     Thereafter snapshotUpdated drives incremental grants. Prestige
 *     needs NO re-push — the overlay and the fork's achievedReported
 *     both survive it (U5-proven); only an iframe reload re-runs the
 *     bulk sequence, and that path re-enters via omsi:loadRegion anyway.
 *     A var's PRESENCE in qBatches is what makes it managed, so the
 *     overlay names every var of every included town, zeros included.
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
import { OMSI_FILLER_ITEM_NAME, qBatchesForCount } from './unlockPool.js';

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

// True while _syncBudgetFromPool() is pinning the budget — a flush
// publishes on the event bus, so this keeps a synchronously delivered
// echo from re-entering the pin (see _syncBudgetFromPool).
let _pinningBudget = false;

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

// AP-V1 unlock randomization. Only live on an emission-ON world (one
// whose payload carries `unlockMeta`); a v0 world leaves all of this
// untouched. How many 'Bonus Seconds' filler copies we have already
// spent on addOffline — count-based, so a re-sent item is a no-op.
// Reset on rulesLoaded (a new world).
let _fillerCopiesApplied = 0;

// One grant of the 'Bonus Seconds' filler = 60s of offline time.
const FILLER_OFFLINE_MS = 60_000;

// Region splitting (arc C). A world may carry `world.omsiRegion`, splitting
// ONE town into region overlays. The fork keeps exactly the ACTIVE region's
// value props live in the town object; the host holds the rest here, keyed by
// region id — a swap on every region entry (dump the outgoing, load the
// incoming, fresh on first entry). Absent `world.omsiRegion` ⇒ vanilla: no
// swap, no synthetic exits, byte-inert. Per-world state, cleared on rulesLoaded.
const _regionStore = new Map();          // regionId -> the fork's value-prop snapshot
let _activeRegionMeta = null;            // the region metadata currently installed
let _activeSyntheticExits = [];          // [{ name, targetRegion }] injected for the active region

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
 * Victory watch. Two shapes:
 *
 *   v0 (no unlock emission): completing Start Journey calls the game's
 *     own unlockTown(1), growing townsUnlocked past the starting [0].
 *     townsUnlocked is PERSISTENT (not per-loop), so this is exactly
 *     the "completed Start Journey at least once" milestone the §6
 *     ruling places the Victory item on.
 *
 *   AP-V1 (emission on): victory rides the LAST included town's
 *     `travel_onward` location, and the milestone is that town N
 *     JOINING townsUnlocked — `includes(N)`, not a length test. The
 *     game's alternate routes count, which is the point: an N=5 world
 *     completes via Open Rift (0→5) just as well as by walking.
 *     The zone payload carries `victoryTown`, so no config plumbing.
 *
 * The v0 length semantics are kept verbatim on the no-emission path so
 * existing worlds behave exactly as before.
 */
function _checkVictoryProgress() {
    const map = _world?.ap_locations;
    const locationName = map?.travel_onward ?? map?.start_journey;
    if (!locationName || _reportedLocationNames.has(locationName)) return;
    const s = _fullState();
    if (!s || !Array.isArray(s.townsUnlocked)) return;
    const victoryTown = _world?.victoryTown;
    const reached = typeof victoryTown === 'number'
        ? s.townsUnlocked.includes(victoryTown)
        : s.townsUnlocked.length > 1;
    if (!reached) return;
    _reportedLocationNames.add(locationName);
    if (!_client) return;
    _client.publishEventDispatcher('user:locationCheck', {
        locationName,
        regionName: _currentRegionId,
        originator: 'omsiSubstrate',
    }, { initialTarget: 'bottom' });
    log('debug', `victory milestone -> user:locationCheck (${locationName})`);
}

// ────────────────────────────────────────────────────────────────
// AP-V1 unlock randomization (unlock-discretization plan §7)
// ────────────────────────────────────────────────────────────────

/** True on an emission-ON world (the library stamps unlockMeta). */
function _hasUnlockPool() {
    return !!_world?.unlockMeta?.itemToVar;
}

function _inventory() {
    const inv = _client?.getStateSnapshot?.()?.inventory;
    return (inv && typeof inv === 'object') ? inv : {};
}

/**
 * The overlay's qBatches: `{var: copiesReceived}` for EVERY var of
 * every included town, ZEROS INCLUDED. Presence in qBatches is what
 * makes a var MANAGED — pushing `{Pots: 0}` pins Pots capacity to 0
 * until steps arrive, while OMITTING Pots would leave it running native
 * capacity. That is why unlockMeta is world-scoped rather than
 * per-zone.
 *
 * Supply-step items are progressive: the i-th copy is batch i, so only
 * the COUNT matters and arrival order never does.
 *
 * arc A: on a SCALED world the var carries `itemCount` (I_v) alongside
 * `rowCount` (R_v), and `I_v` supply-step copies must reach FULL native
 * capacity. `qBatchesForCount` (the multiplier's one home) maps
 * `batches = round(count × R_v / I_v)`. `itemCount` absent (scale 1) ⇒
 * I = R ⇒ the identity `count`, byte-identical to AP-V1.
 */
function _qBatchesFromInventory() {
    const itemToVar = _world?.unlockMeta?.itemToVar ?? {};
    const varMeta = _world?.unlockMeta?.vars ?? {};
    const inv = _inventory();
    const qBatches = {};
    for (const [itemName, varName] of Object.entries(itemToVar)) {
        const count = Number(inv[itemName]) || 0;
        qBatches[varName] = qBatchesForCount(
            count, varMeta[varName]?.rowCount, varMeta[varName]?.itemCount,
        );
    }
    return qBatches;
}

/**
 * Step 2 of the ruled boot order: tell the fork which rows the server
 * already holds, BEFORE the overlay push. setUnlockOverlay triggers a
 * full check(), and without the seed that pass's transition fan-out
 * would re-report every already-checked row.
 *
 * The map's KEYS are the fork's raw row ids (`q:0:Pots:1`); its values
 * are the AP location names. `travel_onward` is ours, not the fork's —
 * it has no row.
 */
/**
 * Drop the fork's reported-row ledger.
 *
 * `seedReportedLocations` is ADD-ONLY by design (surviving a prestige
 * is the point), and the ledger is engine module state — so it also
 * survives a RULES RELOAD, which a prestige is not. Without this, the
 * first world's reported rows would permanently silence those same
 * rows in every later world loaded into the same iframe: the second
 * world could never check them. Clearing here lets the next region
 * load rebuild the ledger from the NEW world's checkedLocations.
 *
 * `Unlocks` is an engine global (classic-script lexical binding) and
 * exports `achievedReported` deliberately; there is no narrower
 * clear API on the managed surface, and this phase makes no fork edits.
 */
function _clearForkReportedLedger() {
    // eslint-disable-next-line no-undef
    if (typeof Unlocks === 'undefined' || !Unlocks?.achievedReported?.clear) return;
    try {
        // eslint-disable-next-line no-undef
        Unlocks.achievedReported.clear();
        log('debug', 'cleared the fork reported-row ledger for the new world');
    } catch (err) {
        log('error', 'clearing achievedReported threw:', err);
    }
}

function _seedReportedRows() {
    const m = _managed();
    const map = _world?.ap_locations;
    if (typeof m?.seedReportedLocations !== 'function' || !map) return;
    const checked = new Set(_client?.getStateSnapshot?.()?.checkedLocations ?? []);
    const ids = [];
    for (const [rowId, apName] of Object.entries(map)) {
        if (!rowId.includes(':')) continue;   // travel_onward / legacy ids
        if (checked.has(apName)) ids.push(rowId);
    }
    m.seedReportedLocations(ids);
    if (ids.length) log('debug', `seeded ${ids.length} already-checked unlock row(s)`);
}

/**
 * Re-run the engine's own total recomputation.
 *
 * Load-bearing, not cosmetic: `Unlocks.applyManagedTotals()` — the
 * substitution that turns qBatches into real capacity — runs at the END
 * of `adjustAll()`, and NEITHER `setUnlockOverlay` nor
 * `grantQuantityStep` calls adjustAll themselves. Without this nudge a
 * fresh overlay would sit inert until some unrelated level-up happened
 * to trigger an adjustAll, and the player would smash pots at vanilla
 * capacity in the meantime.
 *
 * `adjustAll` is a top-level function of the fork's classic scripts —
 * a global lexical binding, so the bare-identifier-behind-typeof
 * pattern is the correct access (same as addResource / addOffline).
 */
function _refreshManagedTotals() {
    // eslint-disable-next-line no-undef
    if (typeof adjustAll !== 'function') {
        log('warn', 'engine adjustAll not available — managed capacity may lag');
        return;
    }
    try {
        // eslint-disable-next-line no-undef
        adjustAll();
    } catch (err) {
        log('error', 'adjustAll() threw:', err);
    }
}

/** Step 3: the bulk overlay push. Replace-whole, so no diffing. */
function _pushUnlockOverlay() {
    const m = _managed();
    if (typeof m?.setUnlockOverlay !== 'function') {
        log('warn', 'fork build has no setUnlockOverlay hook — unlock world plays vanilla');
        return;
    }
    const qBatches = _qBatchesFromInventory();
    try {
        // v1 manages QUANTITY steps only: predicate rows are not
        // locations yet, so both id halves stay empty.
        m.setUnlockOverlay({ suppressed: [], granted: [], qBatches });
        _refreshManagedTotals();
        log('debug', 'unlock overlay pushed', qBatches);
    } catch (err) {
        log('error', 'setUnlockOverlay rejected the overlay:', err);
    }
}

/**
 * Step 4: ongoing reconcile. Deltas only — grantQuantityStep is the
 * progressive path, and the fork's own getUnlockState().quantities is
 * the authority on what it currently holds (getFullState().unlocks is
 * counts-only and must NOT be used here).
 *
 * No own-vs-foreign split in v1: nothing wipes qBatches, so own and
 * foreign copies act identically and capacity is a pure AP-authoritative
 * meter fed from inventory counts. (jta's perkOrigin split exists only
 * because prestige wipes perks.)
 */
function _reconcileQuantitySteps() {
    const m = _managed();
    if (!_hasUnlockPool() || typeof m?.grantQuantityStep !== 'function') return;
    const target = _qBatchesFromInventory();
    const current = m.getUnlockState?.()?.quantities ?? {};
    let granted = 0;
    for (const [varName, want] of Object.entries(target)) {
        const have = Number(current[varName]?.batches) || 0;
        for (let i = have; i < want; i++) {
            try {
                m.grantQuantityStep(varName);
                granted += 1;
            } catch (err) {
                log('error', `grantQuantityStep('${varName}') threw:`, err);
                break;
            }
        }
    }
    if (granted) {
        _refreshManagedTotals();
        log('debug', `granted ${granted} quantity step(s)`);
    }
}

/**
 * The location trigger. ONE multiplexed callback serves both row
 * families; quantity rows are the `q:`-prefixed ids. Anything not in
 * this world's ap_locations map is silently ignored — predicate (`u:`)
 * rows DO fire for locally-earned action unlocks, and they are not
 * locations in v1.
 */
function _handleUnlockAchieved(id) {
    if (typeof id !== 'string') return;
    const locationName = _world?.ap_locations?.[id];
    if (!locationName || _reportedLocationNames.has(locationName)) return;
    _reportedLocationNames.add(locationName);
    if (!_client) return;
    _client.publishEventDispatcher('user:locationCheck', {
        locationName,
        regionName: _currentRegionId,
        originator: 'omsiSubstrate',
    }, { initialTarget: 'bottom' });
    log('debug', `unlock row ${id} -> user:locationCheck (${locationName})`);
}

/**
 * The declared filler/balancer: each newly-seen 'Bonus Seconds' copy
 * buys 60s of the game's own offline time. Count-based, so a reconnect
 * replay costs nothing. The base pool contains ZERO copies (supply
 * steps are 1:1 with locations) — this only fires if a fill ever opens
 * a filler slot.
 */
function _applyFillerFromInventory() {
    const copies = Number(_inventory()[OMSI_FILLER_ITEM_NAME]) || 0;
    if (copies <= _fillerCopiesApplied) return;
    const fresh = copies - _fillerCopiesApplied;
    _fillerCopiesApplied = copies;
    // eslint-disable-next-line no-undef
    if (typeof addOffline !== 'function') {
        log('warn', `'${OMSI_FILLER_ITEM_NAME}' x${fresh} dropped: engine addOffline not available`);
        return;
    }
    try {
        // eslint-disable-next-line no-undef
        for (let i = 0; i < fresh; i++) addOffline(FILLER_OFFLINE_MS);
        log('debug', `granted ${fresh}x '${OMSI_FILLER_ITEM_NAME}' (+${fresh * 60}s offline)`);
    } catch (err) {
        log('error', 'addOffline threw:', err);
    }
}

// ────────────────────────────────────────────────────────────────
// Cross-substrate item arrivals
// ────────────────────────────────────────────────────────────────

/**
 * Deposit a cross-substrate consumable grant (crossSubstrate:itemGranted,
 * the resourceChannels grant bus) into the engine's own resources bag.
 * The bus already validated the grant against the registry's
 * sharing.items declaration (the numeric bag entries), and addResource
 * is the engine's ONLY resource mutation path — a grant is exactly a
 * native gain, and resetResources wipes it at the next loop reset (the
 * ruled native-clearing semantics, not a bug). addResource queues a
 * render update but managed mode never drains the queue on its own, so
 * nudge view.update() for an idle game (the clock's rate-limited
 * update covers a running one).
 */
function _handleItemGranted(data) {
    if (data?.to !== 'omsi') return;
    const count = data.count ?? 1;
    if (typeof addResource !== 'function') {
        log('warn', `item grant '${data.itemType}' x${count} dropped: engine addResource not available`);
        return;
    }
    try {
        addResource(data.itemType, count);
        _engineView()?.update();
        log('debug', `granted ${count}x '${data.itemType}' from '${data.from}'`);
    } catch (err) {
        log('error', `addResource('${data.itemType}') threw:`, err);
    }
}

/**
 * Foreign-award outbound (P2 §2d): the fork's award carrier hands over a
 * schedule entry that belongs to another substrate — the local player
 * deliberately receives nothing, and the bridge forwards the award to the
 * resourceChannels grant bus. The router validates it against the
 * receiving substrate's sharing.items declaration (invalid grants
 * warn+drop host-side); delivery is eager per D8/S8 — the receiving
 * substrate's own arrival handler deposits it. Mirrors the jta bridge's
 * _handleForeignAward.
 */
function _handleForeignAward(info) {
    if (!_client) return;
    _client.publishEventBus('substrate:itemGrant', {
        to: info.substrate,
        from: 'omsi',
        itemType: info.type,
        count: info.count,
    });
    log('debug', `foreign award ${info.varName}[${info.resource}#${info.index}] -> ${info.substrate}/${info.type} x${info.count}`);
}

// ────────────────────────────────────────────────────────────────
// Mana mirroring
// ────────────────────────────────────────────────────────────────

/**
 * Publish the budget movement since the last sample as a pool delta.
 * Returns the delta actually published (0 when there was nothing to
 * publish) so a caller that is about to pin can predict where the host
 * pool lands once that delta arrives.
 */
function _samplePoolMirror() {
    const left = _manaLeft();
    if (left === null) return 0;
    if (_lastSampledManaLeft === null) {
        _lastSampledManaLeft = left;
        return 0;
    }
    const delta = left - _lastSampledManaLeft;   // negative = drain, positive = gain
    _lastSampledManaLeft = left;
    if (delta === 0 || !_client || !_world?.manaEnabled) return 0;
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
    return delta;
}

/**
 * Pin the game's remaining budget to the host pool (entry, loop reset,
 * external pool change). addMana is signed: timeNeeded += amount.
 *
 * `flushMirror` — sample the mirror BEFORE pinning. A pin re-baselines
 * `_lastSampledManaLeft`, so any game-side budget change that has not
 * been sampled yet would be erased (the session-67 re-pin clobber: a
 * re-pin landing within one clock tick of an addMana restored the
 * budget and the delta never reached the pool). Flushing publishes that
 * pending delta first, and the pin then targets the pool value the host
 * will hold once the delta lands — not the pre-delta value it is
 * reporting right now. ONLY the external-manaChanged call site flushes:
 * at the entry / loop-reset pins the budget jump is the pin's own doing
 * (or the reset's refill) and must NOT be mirrored back into the pool.
 */
function _syncBudgetFromPool({ flushMirror = false } = {}) {
    const m = _managed();
    if (!m) return;
    const left = _manaLeft();
    if (left === null) return;
    // Re-entrancy guard: the flush publishes on the event bus, and a
    // synchronous transport would land the echo back in the
    // manaChanged handler mid-pin. The outer pin owns the outcome.
    if (_pinningBudget) return;
    _pinningBudget = true;
    try {
        let target = _hostCurrentMana;
        if (flushMirror) {
            // Does not move `left` — it only publishes and re-baselines.
            const pending = _samplePoolMirror();
            if (pending !== 0) {
                // Same clamp the mirror predicts with: drains bottom out
                // at 0 (gameState reports depletion there), gains are
                // unclamped (maxMana is the loop's STARTING mana).
                target = pending < 0
                    ? Math.max(0, target + pending)
                    : target + pending;
            }
        }
        const adjust = target - left;
        if (Math.abs(adjust) > POOL_EPSILON) m.addMana(adjust);
        _lastSampledManaLeft = _manaLeft();
        _expectedPool = target;
    } finally {
        _pinningBudget = false;
    }
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

// ────────────────────────────────────────────────────────────────
// Region splitting (arc C) — overlay swap + synthetic exit actions
// ────────────────────────────────────────────────────────────────

const _SIDE_LABEL = { N: 'North', E: 'East', S: 'South', W: 'West' };

/**
 * The active region's graph exits, from `world.exits` (the same
 * spiral-adjacency exits procgenPlayer routes on). deserializeWorld hands
 * them over as a Map keyed by exitName; tolerate an Array too (jta pattern).
 */
function _getRegionExits(world) {
    const exits = world?.exits;
    if (exits instanceof Map) return [...exits.values()];
    if (Array.isArray(exits)) return exits;
    return [];
}

/** Human label for a synthetic exit action (jta _exitLabel port). */
function _exitLabel(exit) {
    const target = exit?.targetRegion;
    const side = exit?.side;
    if (side && _SIDE_LABEL[side] && target) return `Go ${_SIDE_LABEL[side]} (to ${target})`;
    if (side && _SIDE_LABEL[side]) return `Go ${_SIDE_LABEL[side]}`;
    if (target) return `Take exit: ${exit?.exitName ?? '?'} (to ${target})`;
    return `Take exit: ${exit?.exitName ?? '?'}`;
}

/**
 * Taking an exit dispatches a region move; the host moves the region and
 * re-fires omsi:loadRegion (jta _dispatchRegionMove shape). The omsi bridge
 * is otherwise publish-only on the dispatcher — this is an added publish, not
 * a subscribe.
 */
function _dispatchRegionMove(targetRegion, exitName) {
    if (!_client) return;
    _client.publishEventDispatcher('user:regionMove', {
        sourceRegion: _currentRegionId,
        targetRegion,
        exitName: exitName ?? null,
    }, { initialTarget: 'bottom' });
}

/**
 * Swap the fork's per-region value props: dump the outgoing region into the
 * host store, then load the incoming one (fresh — null — on first entry).
 * No-op on a vanilla world (no omsiRegion, no active split region). Must run
 * BEFORE the unlock-overlay push so applyManagedTotals re-pins for the
 * incoming region's levels.
 */
function _applyRegionSwap(world) {
    const m = _managed();
    const next = world?.omsiRegion ?? null;
    if (!m || typeof m.loadRegionState !== 'function') {
        if (next) log('warn', 'fork build has no region-overlay hooks — omsiRegion ignored');
        return;
    }
    if (_activeRegionMeta) {
        try {
            _regionStore.set(_activeRegionMeta.regionId,
                m.dumpRegionState(_activeRegionMeta.townIndex ?? 0));
        } catch (e) {
            log('warn', 'dumpRegionState failed', e);
        }
    }
    if (next) {
        const townIndex = next.townIndex ?? 0;
        const snapshot = _regionStore.has(next.regionId) ? _regionStore.get(next.regionId) : null;
        m.loadRegionState(townIndex, snapshot);
    }
}

/**
 * Register the incoming region's gate + synthetic exit actions (or clear
 * everything on a vanilla world). One synthetic exit action per GRAPH exit
 * (the same spiral-adjacency exits procgenPlayer routes on — jta derives its
 * exit tasks the same way), gated by the region's Explore threshold. Runs
 * near the end of a region load so the gate reads the freshly-swapped state.
 */
function _installRegionExits(world) {
    const m = _managed();
    if (!m || typeof m.setActiveRegion !== 'function') return;
    const next = world?.omsiRegion ?? null;
    m.setActiveRegion(next);           // clears prior synthetics + stores the gate meta (null = none)
    _activeRegionMeta = next;
    _activeSyntheticExits = [];
    if (!next) return;
    const townIndex = next.townIndex ?? 0;
    for (const exit of _getRegionExits(world)) {
        if (!exit?.targetRegion) continue;   // a dangling exit routes nowhere — skip it
        const name = _exitLabel(exit);
        const r = m.injectSyntheticAction({ name, townNum: townIndex }, () => {
            _dispatchRegionMove(exit.targetRegion, exit.exitName ?? name);
        });
        if (r?.ok) _activeSyntheticExits.push({ name, targetRegion: exit.targetRegion });
        else log('warn', `injectSyntheticAction('${name}') refused: ${r?.error}`);
    }
}

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

    // Award schedule (P2 §2d): world data rides the region payload.
    // Install-or-clear on every load — a region without a schedule must
    // clear one left by a previous world (the managed game outlives
    // worlds). Absent schedule ⇒ the fork carrier stays byte-inert.
    const m0 = _managed();
    if (typeof m0?.setAwardSchedule === 'function') {
        const ok = m0.setAwardSchedule(world.awardSchedule ?? null);
        if (world.awardSchedule && !ok) {
            log('warn', 'award schedule rejected by the fork carrier (world plays vanilla)');
        }
    } else if (world.awardSchedule) {
        log('warn', 'fork build has no setAwardSchedule hook — award schedule ignored');
    }

    // Region overlay swap (arc C): dump the outgoing region, load the
    // incoming one. BEFORE the unlock-overlay push below so applyManagedTotals
    // re-pins for the incoming levels; no-op on a vanilla world.
    _applyRegionSwap(world);

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

    // AP-V1 unlock randomization, in the RULED boot order (plan §7,
    // ruling (g)). onUnlockAchieved is already registered in main() —
    // passive, and safe before seeding because no check() runs until
    // the overlay push below.
    //   2. seed the rows the server already holds …
    //   3. … then push the overlay, whose check() would otherwise
    //      re-report every one of them.
    //   4. reconcile any copies the (possibly stale) snapshot missed.
    // No-ops entirely on a v0 world.
    if (_hasUnlockPool()) {
        _seedReportedRows();
        _pushUnlockOverlay();
        _reconcileQuantitySteps();
        _applyFillerFromInventory();
        // Starting items are applied to the worker before this iframe
        // subscribed, so the cached snapshot read above may predate
        // them. A fresh worker-pinged snapshot re-runs the reconcile
        // through the same path a mid-play item receipt uses (jta
        // precedent).
        _client?.requestStateSnapshot?.();
    }

    _checkVictoryProgress();

    // Register the incoming region's exit gate + synthetic exit actions (or
    // clear them on a vanilla world). Last, so the gate reads the swapped-in
    // explore state.
    _installRegionExits(world);

    _startClock();
    _engineView()?.update();
    log('debug', `loaded region ${payload.region_id} (town ${world.omsiTown}, manaEnabled=${!!world.manaEnabled}, split=${!!world.omsiRegion})`);
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
            // Flush here and ONLY here: an external pool change must not
            // swallow a game-side budget change we have not sampled yet.
            _syncBudgetFromPool({ flushMirror: true });
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
        _fillerCopiesApplied = 0;
        // Award schedule is per-world data — the next omsi:loadRegion
        // re-installs the new world's (or leaves the carrier inert).
        _managed()?.setAwardSchedule?.(null);
        // Same for the unlock overlay: clearing it returns every var to
        // native capacity, and the next omsi:loadRegion re-pushes the
        // new world's (ruled boot order) or leaves the fork vanilla.
        _managed()?.setUnlockOverlay?.(null);
        // …and the fork's reported-row ledger, which is per-WORLD state
        // even though it deliberately survives a prestige.
        _clearForkReportedLedger();
        // Region overlays are per-WORLD too: drop the host snapshot store and
        // clear the fork's gate + synthetic exits (the next omsi:loadRegion
        // re-installs the new world's, or leaves the fork vanilla).
        _regionStore.clear();
        _activeRegionMeta = null;
        _activeSyntheticExits = [];
        _managed()?.setActiveRegion?.(null);
    });

    // AP state changed (item received here or elsewhere, or a location
    // checked by a co-op partner / on reconnect). Grant any newly
    // received supply steps, re-derive the reported-row sets from the
    // fresh snapshot, and spend any new filler copies. Cheap and
    // idempotent on a v0 world (every branch gates on unlockMeta).
    _client.subscribeEventBus('stateManager:snapshotUpdated', () => {
        if (!_hasUnlockPool()) return;
        _reconcileQuantitySteps();
        // checkedLocations can grow outside our own completions, so
        // re-derive BOTH dedupe layers: ours (AP names) and the fork's
        // (row ids).
        _reseedReportedLocations();
        _seedReportedRows();
        _applyFillerFromInventory();
    });

    // Region activation events (from procgenPlayer).
    _client.subscribeEventBus('omsi:loadRegion', _handleLoadRegion);

    // Cross-substrate consumable grants (resourceChannels bus) — every
    // bridge sees the event; this one deposits grants addressed to
    // 'omsi'. Deliberately not gated on _isActive: the resources bag
    // is global engine state, and grants must land while the player
    // stands elsewhere (eager delivery, no queue).
    _client.subscribeEventBus('crossSubstrate:itemGranted', _handleItemGranted);

    // Game-side loop-reset callback (driver restart() dispatches it).
    const m = _managed();
    m.onRestart(_handleGameRestart);
    _ticksAtLastRestart = _fullState()?.totalTicks ?? 0;

    // Foreign-award outbound (P2). No warning when missing: a build old
    // enough to lack the hook also lacks the award carrier, so no
    // foreign award can ever fire there.
    if (typeof m.setForeignAwardCallback === 'function') {
        m.setForeignAwardCallback(_handleForeignAward);
    }

    // AP-V1 location trigger. Registered ONCE, here rather than per
    // region load: it is passive (no check() runs until an overlay
    // push), and step 1 of the ruled boot order wants it live before
    // any seeding happens. It self-filters on the active world's
    // ap_locations, so it stays inert on a v0 world.
    if (typeof m.onUnlockAchieved === 'function') {
        m.onUnlockAchieved(_handleUnlockAchieved);
    }

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
            // AP-V1 unlock randomization (null/0 on a v0 world).
            hasUnlockPool: _hasUnlockPool(),
            victoryTown: _world?.victoryTown ?? null,
            qBatches: _hasUnlockPool() ? _qBatchesFromInventory() : null,
            reportedLocationCount: _reportedLocationNames.size,
            fillerCopiesApplied: _fillerCopiesApplied,
            // Region splitting (arc C; null/false on an unsplit world).
            activeRegionId: _activeRegionMeta?.regionId ?? null,
            regionStoreKeys: [..._regionStore.keys()],
            regionExitAvailable: _managed()?.regionExitAvailable?.() ?? null,
            syntheticExits: _activeSyntheticExits.map((e) => ({ ...e })),
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
