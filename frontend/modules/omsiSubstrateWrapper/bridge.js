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
 *     (shouldRestart), ping-ponging resets with the host at 50/s — and,
 *     since arc D1 slice 2, while the loops STEP GATE is closed: the
 *     game advances only while the queue is parked on this region or a
 *     replay is in flight. Sampling and the victory watch stay ungated.
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
 *   - Loop-mode block support (arc D1): the host-side PlaybackProxy
 *     reaches this bridge over `omsi:playbackControl`. While a Playback
 *     replay is in flight, every publish is queue execution and carries
 *     `fromLoop: true` — location checks included, which is omsi-
 *     specific: a replay GRINDS the recorded queue across native
 *     resets, so it can cross a new unlock threshold and fire a
 *     first-time check that the strict action gate would otherwise
 *     swallow (killing the AP award, not just the capture).
 *   - Record / Playback (slice 4). RECORD: taking a synthetic exit
 *     publishes the region's authored plan as `omsi:visitRecording`
 *     BEFORE the departing regionMove (ruling 1 — the recording is a
 *     plan snapshot, not a performed-action log). PLAYBACK: the host
 *     sends the recorded plan back over the control channel; the bridge
 *     installs it with the recorded departure exit queued LAST, forces
 *     the loop to recompile, and lets the fork's own queue grind it
 *     until that exit fires. There is no separate executor because there
 *     is nothing to add: the fork's queue IS the executor for an omsi
 *     recording. ⚠ A fork loop boundary is NOT internal — it is reported
 *     and the host answers with a loop reset whose teleport ends the
 *     replay window; a replay spanning runs resumes through loops'
 *     queue-restart retry, not through this window (see _startReplay).
 *   - Instant (Instant-policy pass, slice 1). A Playback or Bot block
 *     flagged Instant runs the SAME stepping through a synchronous PUMP:
 *     `m.step()` in batches sized by the remaining loop budget instead of
 *     by elapsed wall time. Cadence only — same ticks, same order, same
 *     gate — so results are byte-identical to paced play by construction.
 *     It is a pump, NOT a skip: nothing here completes an action the
 *     economy could not afford. The pump yields at every run boundary,
 *     because a reset is a HOST round trip and nothing can round-trip
 *     mid-synchronous-pump; a multi-run replay under Instant is therefore
 *     round-trip-bound rather than tick-bound, which is the whole win.
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
import { planClockStep, planPumpBatch } from './clockGate.js';
import { dedupeViewRequests } from './viewRequests.js';

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
// ── Instant pump (Instant-policy pass, slice 1) ──────────────────────────
// One synchronous batch, bounded so the between-batch checks — held
// boundary, run end, window close, and the budget clamp's recompute — get to
// run often enough to matter.
//
// Deliberately EQUAL to MAX_TICKS_PER_CALLBACK, and that equality is the
// whole argument. The budget clamp lands a batch exactly on the TIMER
// boundary, but the other loop end — `shouldRestart`, a compiled plan
// running dry — is unpredictable from out here, so a batch that crosses it
// restarts in-tick and grinds the remainder into the NEXT run. Paced play has
// the identical overshoot, bounded by its own per-callback cap; matching that
// cap means the pump can never overshoot a boundary by more than the paced
// path already can, so Instant introduces no new exposure. It costs nothing:
// the pump's win comes from not WAITING between callbacks, not from the size
// of a batch — 10 batches of 100 are exactly as instant as 4 of 250.
const PUMP_BATCH_TICKS = MAX_TICKS_PER_CALLBACK;
// Ceiling on ONE pump invocation. Not a truncation: the pump's flag survives,
// so hitting this YIELDS to the event loop and the next clock callback picks
// the pump straight back up. It exists so a pathological run (a plan whose
// timeNeeded grows faster than it is spent) can't wedge the iframe's main
// thread forever. 200k ticks = 4000 s of game time in one go.
const PUMP_MAX_TICKS_PER_CALLBACK = 200_000;
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

// Per-region authored PLANS (arc D1 slice 3, ruling 4). The fork keeps exactly
// one plan (`actions.next`); on a split world each region keeps its own, so the
// plan joins the region swap above — dumped on exit, reinstalled on entry, and
// a region entered for the first time starts EMPTY.
//
// Deliberately a store of its OWN rather than a key inside `_regionStore`'s
// snapshots: those objects are handed verbatim to `m.loadRegionState`, which
// walks the town's value-prop keys, and the plan is host bookkeeping rather
// than fork town state. Per-world, cleared on rulesLoaded alongside the other.
const _regionQueueStore = new Map();     // regionId -> plain NextActionEntry-shaped entries

// Playback replay in flight (arc D1). Set by the host-side PlaybackProxy
// over `omsi:playbackControl` for the duration of a Playback block's
// replay; cleared when the replay's departure crosses, when the player
// leaves the region, and on a rules reload.
//
// While it is set, everything this bridge publishes is QUEUE EXECUTION and
// must carry `fromLoop: true` — under the M3b strict action gate a missing
// flag doesn't merely double-append, it gets the queue's own dispatch
// BLOCKED as unparked live play (livePlayRegion() is null during a replay
// park). Omsi needs this on its LOCATION CHECKS as well as on the
// departure, unlike jta: an omsi replay GRINDS the recorded queue across
// native resets, so it can cross a new unlock threshold and fire a
// first-time check mid-replay.
let _replayInFlight = false;
// The graph exit id the in-flight replay must cross to end (slice 4).
let _replayDepartureExitId = null;

// ── Instant (Instant-policy pass, slice 1) ───────────────────────────────
// Two independent flags because Instant reaches the bridge two ways, and
// they belong to different windows:
//
//   _replayInstant — the per-block Instant checkbox on a PLAYBACK block,
//     forwarded as `opts.instant` on the replayActions payload. Scoped to
//     the replay it arrived with, so _endReplay clears it.
//   _botInstantMode — the same checkbox on a BOT block, arriving as the
//     control channel's `instant` method before every walkTo. A MODE, not
//     an argument (the jta precedent): loopState sets it BOTH ways before
//     each walk precisely so one Instant block can't leave the substrate
//     instant for the next one. It is only ever READ under _botInFlight,
//     so a stale true can't leak into live play.
//
// Neither one is consulted for Manual/Record: Instant is an automation
// control, and live play is the player's own cadence.
let _replayInstant = false;
let _botInstantMode = false;
// Set by _handleGameRestart, cleared at pump entry: the pump yields on a run
// END as well as on a held boundary. A restart is reported to the host as
// `substrate:resourceReset` and answered with a real loop reset whose
// teleport ends the window — and NOTHING can round-trip mid-synchronous-pump.
// Without this the pump would grind run after run, minting resets faster than
// the host can consume them.
let _pumpRunEnded = false;

// Step gate (arc D1 slice 2, ruling 3). The bridge advances the game ONLY
// while the loops queue is parked on THIS region's Manual/Record block, or
// while a replay is in flight. Unparked ⇒ frozen — otherwise the game keeps
// grinding in the background and its mana mirror keeps draining the SHARED
// pool for play nobody is watching or paying for, which is the one economy
// hole the park-gated-stepping ruling closes.
//
// The host pushes the live-play half over `omsi:playbackControl` (it is the
// only side that can see the loops queue); the bridge owns the replay half.
// `enforced` mirrors loops' own staging: the gate applies only where loops
// enforces the strict action gate, so a hypothetical omsi world with no
// loop_costs (loop mode off) is never frozen. Both default to the OPEN
// position, so the game is never stuck waiting for a push that never comes.
let _stepGateEnforced = false;
let _stepGateLiveRegion = null;
// The solver half of the same push (arc D2 slice 1): the region a Bot block's
// solver is driving, which livePlayRegion() deliberately never reports.
let _stepGateBotRegion = null;

// ── Bot window (arc D2 slice 2) ──────────────────────────────────────────
// True between a `walkTo` from the parked Bot block and the departure that
// answers it. Mirrors _replayInFlight, with one deliberate difference: a
// replay carries its own script, while the bot has the FORK'S PLANNER write
// one loop at a time until the region's exit gate opens.
let _botInFlight = false;
let _botTargetExitName = null;
// Set once the exit-only plan is installed: from here the bot is no longer
// grinding, it is crossing, and the gate poll must not fire again.
let _botExitInstalled = false;
// Cold start: the engage asks the planner for a plan, but nothing is running
// to consume it. Cleared by the one recompile that starts it (see _clockTick).
let _botColdStartPending = false;
// Pre-engagement values of every option the engage writes, so a Manual visit
// after a Bot visit never finds the planner still armed.
let _botSavedOptions = null;

/**
 * What the bot engage writes, and why each one (ruling 1 + ruling 2):
 *   advancedAutomation / advancedAutomationEnabled — the planner masters.
 *   plannerMode 'auto' — install plans, don't merely suggest them.
 *   plannerPauseWhilePlanning — hold the boundary until the plan for the NEXT
 *     loop lands, so the fork plays exactly what it planned. Set explicitly
 *     rather than trusted as a default: the clock gate's cross-at-a-held-
 *     boundary path depends on boundaries actually being held.
 *   plannerPipeline false — v1 stays on the classic pause path.
 *   plannerMultiTown false — trap 6: the planner plans over the whole census
 *     and nothing structurally pins it to this region. Multi-town routing is
 *     the escape hatch we CAN close from out here.
 */
const _BOT_PLANNER_OPTIONS = Object.freeze({
    advancedAutomation: true,
    advancedAutomationEnabled: true,
    plannerMode: 'auto',
    plannerPauseWhilePlanning: true,
    plannerPipeline: false,
    plannerMultiTown: false,
});

// Clock diagnostics, exposed via __omsiBridge.getDebugState().
const _clockStats = {
    messages: 0, inactiveSkips: 0, callbacks: 0,
    ticksStepped: 0, skippedNoQueue: 0, skippedGated: 0,
    skippedHeldBoundary: 0, maxElapsedMs: 0,
    // Instant pump. `pumpTicks` is a SUBSET of ticksStepped (the pump steps
    // through the same counter), so a leg can assert "the pump really ran"
    // positively instead of inferring it from a duration.
    pumpInvocations: 0, pumpBatches: 0, pumpTicks: 0,
    pumpViewRequestsCollapsed: 0, pumpBudgetExhausted: 0,
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

/**
 * The engine's loop-END state — read straight off the fork's globals (the
 * `timeNeededInitial` pattern above) rather than through getFullState(),
 * which rebuilds the whole skills/buffs/towns readout. The clock gate
 * consults this on EVERY callback, and _samplePoolMirror already pays for one
 * full build per tick; a second would double that for three values.
 *
 * `shouldRestart` is the half getFullState does not carry at all (slice 1b):
 * a plan that finishes before its budget ends its loop through THAT flag,
 * with timer still short of timeNeeded.
 */
function _loopClock() {
    // eslint-disable-next-line no-undef
    const flag = typeof shouldRestart !== 'undefined' ? shouldRestart : undefined;
    // eslint-disable-next-line no-undef
    if (typeof timer !== 'undefined' && typeof timeNeeded !== 'undefined') {
        // eslint-disable-next-line no-undef
        return { shouldRestart: flag, timer, timeNeeded };
    }
    const s = _fullState();
    return s ? { ...s, shouldRestart: flag } : { shouldRestart: flag };
}

/** The fork's live options bag, or null (arc D2). */
function _forkOptions() {
    // eslint-disable-next-line no-undef
    return typeof options !== 'undefined' && options ? options : null;
}

/**
 * Write a fork option through its REAL setter, not by assignment: setOption
 * runs the `optionValueHandlers`, which is where the planner's own
 * engage/disengage bookkeeping lives (shutting the worker down, resuming a
 * planner pause, forgetting installedQueueJSON). All of them are DOM-guarded,
 * so this is safe from the bridge.
 */
function _setForkOption(name, value) {
    // eslint-disable-next-line no-undef
    if (typeof setOption !== 'function') return false;
    // eslint-disable-next-line no-undef
    setOption(name, value);
    return true;
}

/** The fork's Advanced Automation module, or null. */
function _automation() {
    // eslint-disable-next-line no-undef
    return typeof AdvancedAutomation !== 'undefined' ? AdvancedAutomation : null;
}

/** Is the active region's exit runnable right now? (managed regionExitAvailable) */
function _regionExitAvailable() {
    const m = _managed();
    if (typeof m?.regionExitAvailable !== 'function') return false;
    try {
        return m.regionExitAvailable() === true;
    } catch (err) {
        log('warn', 'regionExitAvailable threw:', err);
        return false;
    }
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

/**
 * Whether the game may ADVANCE right now (arc D1 slice 2, ruling 3).
 *
 * Open when the gate isn't enforced (loop mode off / before the host's
 * first push), while a replay is in flight, and while the loops queue is
 * parked for live play on the region this bridge currently has loaded.
 * Closed otherwise — an unparked omsi region is frozen, not idling.
 *
 * Note the region COMPARISON: loops may be parked on some other substrate's
 * region entirely, which must not license this one to run.
 *
 * Arc D2 slice 1 adds the BOT half. `livePlayRegion()` is null while a solver
 * drives (a solver park is not live play — its events pass the strict gate on
 * the 'queueExecution' exemption), so without the separate bot-park push a
 * Bot block would drive a frozen game. The region comparison applies here for
 * the same reason it does above: the park is per-action, with its own
 * sourceRegion.
 */
function _mayStepClock() {
    if (!_stepGateEnforced) return true;
    if (_replayInFlight) return true;
    if (_stepGateBotRegion !== null && _stepGateBotRegion === _currentRegionId) return true;
    return _stepGateLiveRegion !== null && _stepGateLiveRegion === _currentRegionId;
}

/**
 * Whether stepping should run as an Instant PUMP rather than paced.
 *
 * Each flag is paired with its own window, so an Instant checkbox can only
 * ever accelerate the block that set it — a replay that ended, or a bot walk
 * that was stopped, leaves nothing behind that live play could inherit.
 */
function _instantPumpActive() {
    return (_replayInFlight && _replayInstant) || (_botInFlight && _botInstantMode);
}

/**
 * Drain the current run in tight synchronous batches (Instant-policy pass,
 * slice 1).
 *
 * CADENCE ONLY. The same `singleTick` runs the same number of times as it
 * would paced, in the same order, against the same gate — what changes is
 * that the tick count comes from the remaining loop budget instead of from
 * wall time. That is the whole contract, and the paced-vs-instant byte
 * identity check is it made executable.
 *
 * Three things end a pump invocation, and the first two are the interesting
 * ones:
 *
 *   - A HELD BOUNDARY or a closed gate or an exhausted plan — whatever
 *     `planPumpBatch` withholds a batch for. The caller's normal async
 *     machinery then runs, which is where the bot's exit crossing and cold
 *     start already live.
 *   - A RUN END (`_pumpRunEnded`). A restart is reported to the host, the
 *     host answers with a loop reset, and that reset TELEPORTS — a host
 *     round trip that cannot happen while this function holds the thread.
 *     Multi-run replays therefore become round-trip-bound instead of
 *     tick-bound, which is exactly the win: the ticks stop costing anything
 *     and only the round trips remain.
 *   - The safety ceiling, which yields rather than truncates.
 *
 * The view queue is collapsed BETWEEN batches (see viewRequests.js — without
 * it the pump is quadratic in ticks) and rendered ONCE at yield: a pump that
 * repainted per batch would pay the rendering cost it exists to skip, and one
 * that never repainted would leave the panel showing pre-pump state.
 */
function _runInstantPump() {
    const m = _managed();
    if (!m) return;
    _pumpRunEnded = false;
    _clockStats.pumpInvocations += 1;
    let stepped = 0;
    let batches = 0;
    let reason = 'ceiling';
    while (stepped < PUMP_MAX_TICKS_PER_CALLBACK) {
        const { ticks, skip } = planPumpBatch({
            // Never let the last batch overshoot the invocation ceiling.
            maxBatch: Math.min(PUMP_BATCH_TICKS, PUMP_MAX_TICKS_PER_CALLBACK - stepped),
            hasRunnableQueue: _hasRunnableQueue(),
            gateOpen: _mayStepClock(),
            // Re-read EVERY batch: timer advances, and timeNeeded can grow
            // under the player's feet (Buy Mana, a host budget pin).
            state: _loopClock(),
        });
        if (skip !== null) {
            reason = skip;
            if (skip === 'noQueue') _clockStats.skippedNoQueue += 1;
            else if (skip === 'gated') _clockStats.skippedGated += 1;
            else if (skip === 'heldBoundary') _clockStats.skippedHeldBoundary += 1;
            break;
        }
        if (ticks <= 0) {
            // Budget clamp resolved to nothing without a skip reason — treat
            // it as a yield rather than spinning on a zero-width batch.
            reason = 'noBudget';
            _clockStats.pumpBudgetExhausted += 1;
            break;
        }
        m.step(ticks);
        stepped += ticks;
        batches += 1;
        _clockStats.pumpBatches += 1;
        _clockStats.pumpTicks += ticks;
        _clockStats.ticksStepped += ticks;
        _clockStats.pumpViewRequestsCollapsed += dedupeViewRequests(_engineView()?.requests);
        if (_pumpRunEnded) {
            reason = 'runEnd';
            break;
        }
        // The window can close INSIDE a batch: a replay's departure exit
        // fires mid-tick, which dispatches the region move and ends the
        // replay. Keeping the pump running past that would grind the queue
        // for a region the player has already left.
        if (!_instantPumpActive()) {
            reason = 'windowClosed';
            break;
        }
    }
    // One repaint for the whole pump, and re-baseline the paced path's
    // rate limiter so it doesn't immediately repaint again.
    if (stepped > 0) {
        _lastViewUpdateTime = Date.now();
        _engineView()?.update();
    }
    log('debug', `instant pump: ${stepped} tick(s) in ${batches} batch(es) `
        + `— yielded on ${reason}`);
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
    // Re-baselined on EVERY callback, gated or not: a closed gate must not
    // bank elapsed time and replay it as a burst when the block parks.
    _lastClockTime = now;
    _clockStats.callbacks += 1;
    if (elapsedMs > _clockStats.maxElapsedMs) _clockStats.maxElapsedMs = elapsedMs;
    // The mana mirror and the victory watch below stay UNGATED: they only
    // observe (a direct addMana — Buy Mana, a test, a future hook — must
    // still reach the pool), while stepping is what the gate withholds.
    // Step by elapsed wall time so the average rate stays at the game's base
    // speed even when the browser throttles callbacks — unless the queue is
    // empty, the loops gate is closed, or the engine is parked past a loop end
    // that never restarted (arc D2 slice 1: stepping a HELD boundary mints a
    // phantom loop per tick and inflates effectiveTime quadratically; see
    // clockGate.js for why the predicate is `timer >= timeNeeded` and
    // emphatically not `stoppedAt`).
    const { ticks, skip } = planClockStep({
        elapsedMs,
        ticksPerSecond: TICKS_PER_SECOND,
        maxTicks: MAX_TICKS_PER_CALLBACK,
        hasRunnableQueue: _hasRunnableQueue(),
        gateOpen: _mayStepClock(),
        state: _loopClock(),
    });
    if (skip === 'noQueue') _clockStats.skippedNoQueue += 1;
    else if (skip === 'gated') _clockStats.skippedGated += 1;
    else if (skip === 'heldBoundary') _clockStats.skippedHeldBoundary += 1;
    // Ruling 4: the exit crosses at the NEXT LOOP BOUNDARY after the gate
    // opens — never mid-loop. A held boundary IS that moment, and the best
    // one available: the engine is parked, the clock gate is shut, and
    // nothing is in flight to interrupt. With the engage's auto +
    // pauseWhilePlanning the planner holds EVERY boundary, so one always
    // comes. (Ruling 4's "let the in-flight loop finish" is why this waits
    // for the hold rather than acting the moment the gate flips.)
    if (skip === 'heldBoundary' && _botInFlight && !_botExitInstalled && _regionExitAvailable()) {
        _crossBotExit('gate opened, boundary held');
    } else if (skip === 'heldBoundary' && _botInFlight && _botColdStartPending) {
        // The engage's plan has landed (a held boundary implies a runnable
        // queue — 'noQueue' is checked first) but nothing is running it. One
        // suppressed recompile starts the grind; from here the planner's own
        // onResult → resume drives every later boundary.
        _botColdStartPending = false;
        _forceLoopRecompile();
        log('debug', 'bot cold start: recompiled the loop onto the planner\'s first plan');
    }
    if (ticks > 0) {
        // Instant (Instant-policy pass, slice 1): same decision layer, faster
        // clock. The gate above still decides WHETHER to advance — the pump
        // only replaces the paced tick count with batches sized by the
        // remaining budget, and so is reached only on a tick that would have
        // stepped anyway.
        if (_instantPumpActive()) {
            _runInstantPump();
        } else {
            m.step(ticks);
            _clockStats.ticksStepped += ticks;
            // Managed mode never drains the coalesced render queue
            // (view.update is UPS-driven in normal boots) — do it here,
            // rate-limited, so the UI tracks the host-driven time.
            if (now - _lastViewUpdateTime >= VIEW_UPDATE_MIN_MS) {
                _lastViewUpdateTime = now;
                _engineView()?.update();
            }
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
 * Publish an AP location check for the active region.
 *
 * The ONE publish site for both check families (victory milestone, unlock
 * rows) so the loop-mode stamping can't be applied to one and forgotten on
 * the other. `fromLoop` marks queue execution: a check fired while a
 * Playback replay grinds the recorded queue is the QUEUE's doing, and
 * without the flag the strict gate would swallow it — the award would
 * never reach AP (loopEvents blocks propagation, it doesn't just skip the
 * capture). Live play needs no flag: a parked Manual/Record block passes on
 * the `parkedLivePlay` exemption.
 */
function _publishLocationCheck(locationName) {
    if (!_client) return;
    _client.publishEventDispatcher('user:locationCheck', {
        locationName,
        regionName: _currentRegionId,
        originator: 'omsiSubstrate',
        ...(_replayInFlight ? { fromLoop: true } : {}),
    }, { initialTarget: 'bottom' });
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
    _publishLocationCheck(locationName);
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
    _publishLocationCheck(locationName);
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

    // Yield the Instant pump on EVERY restart, including the ones that go
    // unreported below. A reported one needs the host round trip it is about
    // to trigger; an unreported one (the no-progress guard) means the plan is
    // spinning, and a pump would spin it at full synchronous speed instead of
    // at 50/s. Both want the thread back.
    _pumpRunEnded = true;

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
 *
 * A move crossed while a Playback replay is in flight is the REPLAY's
 * departure — queue execution, so it carries `fromLoop: true` (the jta
 * `_crossExit` precedent) and the parked block advances on the wake instead
 * of the gate blocking the move outright. Crossing ends the replay: under
 * ruling 1 a replay runs the recorded queue until its departure exit fires,
 * and that firing is exactly this dispatch.
 *
 * Live play needs no flag — a parked Manual/Record block passes the gate on
 * `parkedLivePlay`, and a wrong exit there must stay a wrong exit.
 *
 * A BOT departure is deliberately NOT stamped (arc D2 slice 2), matching the
 * jta Bot leg: while a solver drives, `_botExecutedAction` is set, so the
 * strict gate exempts the move as `queueExecution` before any flag is
 * consulted. Stamping it would work by accident and hide which exemption is
 * really carrying the crossing. Crossing still ends the window — that
 * departure IS the answer to the walkTo.
 */
function _dispatchRegionMove(targetRegion, exitName) {
    if (!_client) return;
    const fromLoop = _replayInFlight;
    if (fromLoop) _endReplay('departure crossed');
    if (_botInFlight) _endBotWalk('departure crossed');
    _client.publishEventDispatcher('user:regionMove', {
        sourceRegion: _currentRegionId,
        targetRegion,
        exitName: exitName ?? null,
        ...(fromLoop ? { fromLoop: true } : {}),
    }, { initialTarget: 'bottom' });
}

/**
 * True when `name` is an action THIS BUILD knows — the save-restore guard
 * (saving.js:1362), which is the only thing standing between a stored plan and
 * a crash: a queue entry naming an unknown action makes the next loop start
 * throw out of `translateClassNames` (actionList.js:143), taking down the loop
 * rather than skipping the entry.
 *
 * Synthetic exit actions are injected AFTER initializeActions() and so are
 * never in `totalActionList` — which makes this the same filter twice over
 * (see _dumpRegionQueue), deliberately.
 */
function _isKnownActionName(name) {
    if (typeof name !== 'string' || !name) return false;
    // eslint-disable-next-line no-undef
    if (typeof totalActionList === 'undefined' || !Array.isArray(totalActionList)) return false;
    // eslint-disable-next-line no-undef
    return totalActionList.some((a) => a?.name === name);
}

/**
 * The active region's authored plan, as plain entries the host can stash
 * (arc D1 slice 3). Non-enumerable `actionId` is deliberately not copied —
 * the restore mints a fresh one.
 *
 * SYNTHETIC EXIT ENTRIES ARE STRIPPED HERE. Those actions are region-scoped:
 * `setActiveRegion` deletes the outgoing region's from the Action table and
 * `_installRegionExits` injects the incoming region's, so a stored exit name is
 * a name that no longer resolves on the next visit. Stripping at DUMP time
 * (rather than filtering at restore) is immune to the load-order question
 * entirely, and it is symmetric with the slice-4 Record capture, which
 * snapshots this same plan minus these same entries.
 */
function _dumpRegionQueue() {
    const next = _engineActions()?.next;
    if (!Array.isArray(next)) return [];
    const synthetic = new Set(_activeSyntheticExits.map((e) => e.name));
    return next
        .filter((e) => e && typeof e.name === 'string' && !synthetic.has(e.name))
        .map((e) => ({ ...e }));
}

/**
 * Publish the visit recording for a departure through `exitName` (arc D1
 * slice 4, ruling 1).
 *
 * What omsi records is the game's OWN authored plan for this region — a plan
 * SNAPSHOT, not a performed-action log — because omsi's genre is author-a-
 * queue-and-replay and a performed log of an N-loop visit is that same queue
 * repeated N times. `_dumpRegionQueue()` is exactly that snapshot (synthetic
 * exit entries stripped), which is why the two are one function: a recording
 * and a stashed per-region plan are the same object, captured for different
 * reasons.
 *
 * ORDERING IS A CONTRACT, not a preference. This must be published BEFORE the
 * departing `user:regionMove`: both cross the iframe→host boundary as ordered
 * postMessages, and the loops Record-exit wake pulls the stash when the move
 * lands. Publish the move first and the pull comes back empty — nothing
 * persists and no auto-switch happens.
 *
 * Published on EVERY synthetic-exit departure, not only during Record: the
 * host slot is pull-once and loops pulls only on a Record block's successful
 * exit, so a Manual departure just overwrites an un-pulled stash. A REPLAY's
 * departure re-publishes the plan it was replaying (the install strips back to
 * the same entries), so that case is idempotent rather than lossy.
 */
function _publishVisitRecording(exitName) {
    if (!_client) return;
    _client.publishEventBus('omsi:visitRecording', {
        actions: _dumpRegionQueue(),
        departureExitId: exitName ?? null,
    });
}

/**
 * Install a stashed plan into the fork's queue — or, for a region entered for
 * the first time, just clear it (ruling 4: a fresh region starts EMPTY).
 *
 * `addActionRecord(entry, -1, false)` — append at the end, no
 * closest-valid-index reshuffling — is exactly the call the save restore makes,
 * so a dump/restore round trip preserves the authored order.
 *
 * KNOWN BOUNDARY: this rewrites `actions.next` (the PLAN), not
 * `actions.current` (the loop already in flight, compiled at the last restart).
 * So a loop running when the swap happens finishes on the OUTGOING region's
 * compiled list — at most one loop of lag, and omsi restarts constantly. The
 * REPLAY install is the case that cannot tolerate the lag and forces the
 * recompile itself (_forceLoopRecompile).
 */
function _restoreRegionQueue(entries) {
    const a = _engineActions();
    if (typeof a?.clearActions !== 'function' || typeof a.addActionRecord !== 'function') {
        if (entries?.length) log('warn', 'fork build has no queue-write surface — stored plan dropped');
        return;
    }
    a.clearActions();
    let skipped = 0;
    for (const entry of entries ?? []) {
        if (!_isKnownActionName(entry?.name)) { skipped += 1; continue; }
        a.addActionRecord({ ...entry }, -1, false);
    }
    if (skipped) log('warn', `dropped ${skipped} stored queue entry/entries naming unknown actions`);
}

/**
 * Swap the fork's per-region value props AND authored plan: dump the outgoing
 * region into the host stores, then load the incoming one (fresh — null /
 * empty plan — on first entry). No-op on a vanilla world (no omsiRegion, no
 * active split region). Must run BEFORE the unlock-overlay push so
 * applyManagedTotals re-pins for the incoming region's levels.
 *
 * Two orderings this relies on, both inside `_handleLoadRegion`:
 *   - it runs BEFORE `_applyCatchUpResets`, so a catch-up restart compiles the
 *     INCOMING region's plan rather than the one we just stashed;
 *   - `_installRegionExits` runs after and clears synthetic actions with a
 *     NAME PREDICATE (managed.js clearSyntheticActions), so a restored plan of
 *     real actions passes through it untouched.
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
        _regionQueueStore.set(_activeRegionMeta.regionId, _dumpRegionQueue());
    }
    if (next) {
        const townIndex = next.townIndex ?? 0;
        const snapshot = _regionStore.has(next.regionId) ? _regionStore.get(next.regionId) : null;
        m.loadRegionState(townIndex, snapshot);
        _restoreRegionQueue(_regionQueueStore.get(next.regionId) ?? []);
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
        const exitName = exit.exitName ?? name;
        const r = m.injectSyntheticAction({ name, townNum: townIndex }, () => {
            // Slice 4: the visit recording goes out BEFORE the departing move
            // (the stash-before-regionMove contract) — see _publishVisitRecording.
            _publishVisitRecording(exitName);
            _dispatchRegionMove(exit.targetRegion, exitName);
        });
        // `exitName` is the GRAPH exit id the move carries (and therefore the
        // `departureExitId` a recording stores); `name` is the action label the
        // fork's queue knows it by. The replay install needs the mapping.
        if (r?.ok) _activeSyntheticExits.push({ name, exitName, targetRegion: exit.targetRegion });
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
// Playback control — host proxy commands (omsi:playbackControl)
// ────────────────────────────────────────────────────────────────

function _beginReplay() {
    if (_replayInFlight) return;
    _replayInFlight = true;
    log('debug', 'replay in flight — bridge publishes carry fromLoop');
}

function _endReplay(reason = 'unspecified') {
    if (!_replayInFlight) return;
    _replayInFlight = false;
    _replayDepartureExitId = null;
    // Instant is scoped to the replay that carried it: the next block sets
    // its own pacing, and live play in between is never pumped.
    _replayInstant = false;
    log('debug', `replay no longer in flight — ${reason}`);
}

/** The synthetic exit ACTION name whose crossing carries `exitName`, or null. */
function _syntheticExitActionFor(exitName) {
    if (!exitName) return null;
    return _activeSyntheticExits.find((e) => e.exitName === exitName)?.name ?? null;
}

/**
 * Force the fork to recompile its loop from the plan we just wrote.
 *
 * `actions.next` is the PLAN; `actions.current` is the loop in flight,
 * compiled at the last restart. A replay that only wrote the plan would run
 * whatever the region was doing before for up to a full loop — and since a
 * loop ends by exhausting its queue, "up to a full loop" can be the entire
 * replay. So the install restarts the loop itself.
 *
 * Two things this must NOT do:
 *   - report a run end to the host. `restartLoop()` fires the managed
 *     onRestart callback, and `_handleGameRestart` publishes
 *     `substrate:resourceReset` — which the host answers with a real loop
 *     reset and its teleport. `_applyingHostReset` is the same suppression
 *     the catch-up path uses: the bridge must not fabricate run-end signals
 *     for the sole reset authority (procgen gotchas, "A frozen substrate
 *     cannot generate the reset that unfreezes it").
 *   - mirror the restart's budget refill into the shared pool.
 *     `_handleGameRestart` re-baselines the sample for us even on the
 *     suppressed path; the pin afterwards is the loadRegion ordering
 *     verbatim (catch-up, then pin to the pool).
 *
 * `actions.current` is emptied first so the recompile is unconditional: with
 * `options.keepCurrentList` on (off by default) a restart REUSES the compiled
 * list, which is precisely the staleness being fixed.
 */
function _forceLoopRecompile() {
    const m = _managed();
    const a = _engineActions();
    if (typeof m?.restartLoop !== 'function') {
        log('warn', 'fork build has no restartLoop hook — the replay plan may lag one loop');
        return;
    }
    if (a && Array.isArray(a.current)) a.current = [];
    _applyingHostReset = true;
    try {
        m.restartLoop();
    } finally {
        _applyingHostReset = false;
    }
    _lastSampledManaLeft = _manaLeft();
    if (_world?.manaEnabled) _syncBudgetFromPool();
}

/**
 * Playback: install a recorded plan and let the fork RUN it (ruling 1).
 *
 * omsi has no separate replay executor and needs none — the recording IS a
 * plan and the fork's own queue is what executes plans. So the install is:
 * clear, add each recorded entry, then queue the recorded departure exit LAST,
 * and hold the replay window open while the game grinds.
 *
 * ⚠ WHAT "ACROSS RESETS" ACTUALLY MEANS. A fork loop boundary does NOT stay
 * inside the fork: `_handleGameRestart` reports it as `substrate:resourceReset`,
 * the host answers with a real loop reset, and that reset TELEPORTS the player
 * to the loop start (resourceChannels `fireLoopResetTeleport`) — which lands
 * here as a `gameState:regionChanged` away, ending this replay window
 * (`_endReplay('left the region')`) and stopping the clock. That is the
 * `requiresLoopMode` contract, not a bug: the fork's run IS the host's run, so
 * a replay that outlives one run outlives the run that was paying for it.
 * Only two loop boundaries are invisible to the host — our own suppressed
 * restarts (`_applyingHostReset`, including this install's recompile) and the
 * no-progress guard's zero-effective-time restarts.
 *
 * So a multi-loop replay continues NOT by this window surviving, but by loops'
 * generic queue-restart retry (loop-recording.md, M6): the reset restarts the
 * queue, it routes back to this region, re-enters the Playback block, and
 * dispatches `replayActions` again — at which point this whole install runs
 * again and lands in the same state, which is why it is written to be
 * idempotent. A replay whose gate needs more than one run's worth of resource
 * therefore depends on that retry, and the in-app leg deliberately does NOT
 * cover it (it sizes the pool so the whole replay fits in one loop).
 *
 * The departure is the TERMINATION CONDITION, so a replay that cannot resolve
 * one is refused outright rather than started: an unbounded grind with no exit
 * would drain the shared pool forever. A recorded queue whose exit GATE never
 * opens is a different thing and is allowed to park indefinitely — that is
 * Manual-equivalent behavior, and a timeout teleport "completing" it would be
 * a replay that crossed without replaying.
 */
function _startReplay(entries, opts = {}) {
    const departureExitId = opts?.departureExitId ?? null;
    const a = _engineActions();
    if (typeof a?.clearActions !== 'function' || typeof a.addActionRecord !== 'function') {
        log('error', 'Playback replay REFUSED: fork build has no queue-write surface. '
            + 'The block stays parked rather than crossing an exit it never replayed.');
        return;
    }
    const exitAction = _syntheticExitActionFor(departureExitId);
    if (!exitAction) {
        log('error', `Playback replay REFUSED: no synthetic exit action for departure `
            + `'${departureExitId}' in ${_currentRegionId} — refusing to grind a recording `
            + 'with no way to end it.');
        return;
    }
    _beginReplay();
    _replayDepartureExitId = departureExitId;
    // Instant (Instant-policy pass, slice 1): the per-block checkbox, ridden
    // in on the replay payload. Read AFTER the two refusals above — a replay
    // that never starts must not leave the flag set for the next one.
    _replayInstant = opts?.instant === true;
    // Same membership filter and append semantics the per-region restore uses.
    _restoreRegionQueue(entries);
    // …and the departure LAST, bypassing that filter: a synthetic exit action
    // is registered after initializeActions() and so is never in
    // `totalActionList`, but it IS in the Action table, which is what the
    // loop's own translateClassNames resolves against.
    a.addActionRecord({ name: exitAction, loops: 1, loopsType: 'actions', disabled: false }, -1, false);
    _forceLoopRecompile();
    log('debug', `replay installed: ${entries?.length ?? 0} entry/entries + exit `
        + `'${exitAction}' (departure '${departureExitId}')`);
}

// ────────────────────────────────────────────────────────────────
// Bot window (arc D2 slice 2) — the fork's planner IS the solver
// ────────────────────────────────────────────────────────────────

/**
 * Arm the fork's Advanced Automation planner for the grind.
 *
 * COLD ENGAGE. `interceptPrepareRestart` only fires at loop boundaries, and a
 * region whose plan is empty (or already exhausted) will never reach one — the
 * clock idles on `_hasRunnableQueue`, so no boundary, so no first plan. The
 * kick-start is `planNow()`: verified in slice-0 recon that an auto-mode result
 * installs its queue through `onResult` with no `applySuggestion` by hand.
 *
 * ⚠ THE PLAN LANDING IS NOT THE PLAN STARTING, and assuming otherwise
 * deadlocks the bot — measured, not theorised: 0 loops, 0 ticks, forever.
 * `onResult` writes the queue but only `resumeIfPlannerPaused` starts the
 * engine, and that acts solely on a pause the PLANNER took, which it can only
 * take at a boundary, which needs a step. Meanwhile the engine reaches the bot
 * already parked past a loop end (`shouldRestart` is init-true, and every
 * arrival here follows one), so the slice-1 gate is shut and nothing steps.
 * Frozen substrate, no reset of its own to unfreeze it.
 *
 * So the cold start needs ONE recompile, and `_clockTick` fires it the moment
 * a runnable plan exists. It must be `_forceLoopRecompile` — restarting under
 * `_applyingHostReset` — and never a bare `restartLoop()`/`pauseGame()`: those
 * report a run end to the host, inventing a reset and its teleport out of a
 * loop the game never actually finished.
 */
function _engagePlanner() {
    const opts = _forkOptions();
    const auto = _automation();
    if (!opts || !auto || typeof _setForkOption !== 'function') {
        log('error', 'Bot REFUSED the planner: fork build has no options/automation surface');
        return false;
    }
    _botSavedOptions = {};
    for (const key of Object.keys(_BOT_PLANNER_OPTIONS)) _botSavedOptions[key] = opts[key];
    for (const [key, value] of Object.entries(_BOT_PLANNER_OPTIONS)) _setForkOption(key, value);
    _botColdStartPending = true;
    try {
        auto.planNow();
    } catch (err) {
        log('warn', 'planNow threw:', err);
    }
    log('debug', `bot engaged the planner for exit '${_botTargetExitName}' `
        + `(gate ${_regionExitAvailable() ? 'OPEN' : 'closed'})`);
    return true;
}

/**
 * Put every option the engage wrote back the way the player had it.
 *
 * Runs when the WINDOW ends, not when the planner disengages: between those
 * two moments the exit-only plan is crossing, and restoring an
 * `advancedAutomationEnabled: true` that the player happened to have set would
 * re-arm the planner mid-crossing.
 */
function _restoreAutomationOptions() {
    if (!_botSavedOptions) return;
    const saved = _botSavedOptions;
    _botSavedOptions = null;
    for (const [key, value] of Object.entries(saved)) {
        if (value !== undefined) _setForkOption(key, value);
    }
    log('debug', 'bot restored the pre-engagement automation options');
}

/**
 * Hand the loop back: the planner stops writing plans, we write the last one.
 *
 * ORDER IS THE OPPOSITE of the kickoff's trap-3 advice, for a reason worth
 * keeping. Trap 3 says disengage before touching the queue, because
 * `interceptPrepareRestart` reads any queue it did not install as a manual
 * edit. But disengaging at a HELD boundary runs `resumeIfPlannerPaused` →
 * `pauseGame()`, and pauseGame restarts the loop when `shouldRestart ||
 * timer >= timeNeeded` — which is precisely the state a held boundary is in.
 * That restart is NOT suppressed, so it reports a run end, and the host
 * answers with a reset and a teleport out of the region we are mid-crossing.
 *
 * Installing first avoids it: `_forceLoopRecompile` restarts under
 * `_applyingHostReset` (suppressed) and leaves `timer` at 0 with
 * `shouldRestart` false, so the disengage that follows finds nothing to
 * restart. And trap 3's misfire cannot bite, because the disengage happens in
 * this same synchronous step — `isEnabled()` is already false before the next
 * boundary, so `interceptPrepareRestart` returns at its own gate without ever
 * reaching the manual-edit compare.
 */
function _crossBotExit(reason) {
    if (!_botInFlight || _botExitInstalled) return;
    if (!_installBotExit()) return;
    // Only disengage a planner THIS window engaged. `_startBotWalk` crosses
    // straight through when the gate is already open at dispatch — the common
    // case on the last re-dispatch of a multi-run walk — and there is nothing
    // to hand back on that path. Disabling anyway would switch off an Advanced
    // Automation the PLAYER turned on, with no saved value to restore it from
    // (slice-3 fix; `omsi-bot-crosses-region` pins it).
    if (_botSavedOptions) _setForkOption('advancedAutomationEnabled', false);
    log('debug', `bot installed the exit plan${_botSavedOptions ? ' and disengaged the planner' : ''}`
        + ` (${reason})`);
}

/**
 * Write the exit-only plan — the slice-4 replay install, minus the recording.
 *
 * The synthetic exit action's own `canStart()` is `regionExitAvailable()`, so
 * a plan installed while the gate is shut would simply be skipped and end the
 * loop by exhaustion. Every caller checks the gate first; this is the
 * belt-and-braces half.
 */
function _installBotExit() {
    const a = _engineActions();
    const exitAction = _syntheticExitActionFor(_botTargetExitName);
    if (!exitAction) {
        log('error', `Bot exit REFUSED: no synthetic exit action for '${_botTargetExitName}' `
            + `in ${_currentRegionId}`);
        return false;
    }
    if (typeof a?.clearActions !== 'function' || typeof a.addActionRecord !== 'function') {
        log('error', 'Bot exit REFUSED: fork build has no queue-write surface');
        return false;
    }
    a.clearActions();
    // Bypasses the totalActionList membership filter for the same reason the
    // replay install does: a synthetic exit action is registered after
    // initializeActions() and lives only in the Action table.
    a.addActionRecord({ name: exitAction, loops: 1, loopsType: 'actions', disabled: false }, -1, false);
    _forceLoopRecompile();
    _botExitInstalled = true;
    return true;
}

/**
 * A Bot block parked on a `regionMove` dispatched `walkTo` at us (M6 solver
 * contract). The target is an EXIT: omsi declares `queueActions: ['regionMove']`
 * only, so location targets never reach here.
 *
 * Two ways this ends, and the window covers both. If the exit gate is already
 * open — the usual case on a re-entry after a reset teleport and walk-back —
 * there is nothing to grind for and the exit plan goes in immediately. If not,
 * the planner grinds until it opens, across as many host runs as that takes:
 * each fork loop end reports a run end, the host resets and teleports, the M6
 * bot wake re-dispatches, and this runs again from the top. Written to be
 * idempotent for exactly that reason, like `_startReplay`.
 */
function _startBotWalk(target) {
    if (target?.kind !== 'exit' || typeof target?.name !== 'string' || !target.name) {
        log('warn', 'walkTo ignored — omsi solves exits only', target);
        return;
    }
    if (!_syntheticExitActionFor(target.name)) {
        log('error', `walkTo REFUSED: exit '${target.name}' has no synthetic action in `
            + `${_currentRegionId} — the block stays parked rather than crossing an exit `
            + 'it never walked to.');
        return;
    }
    // Re-dispatch of a walk already in flight (the retry path): re-assert the
    // target and let the state below decide afresh.
    _botInFlight = true;
    _botTargetExitName = target.name;
    _botExitInstalled = false;
    if (_regionExitAvailable()) {
        _crossBotExit('gate already open at dispatch');
        return;
    }
    _engagePlanner();
}

/**
 * Close the window: the departure landed, the host stopped us, or the region
 * went away under us. Restores the player's automation options — a Manual
 * visit after a Bot visit must not find the planner still armed.
 *
 * ⚠ ONLY A WINDOW THAT ENGAGED MAY DISABLE THE PLANNER (slice-3 fix, found by
 * `omsi-bot-crosses-region`). `_startBotWalk` returns early without engaging
 * when the gate is already open at dispatch — the common case on the LAST
 * re-dispatch of a multi-run walk, where the previous run finished the grind.
 * An unconditional disable here has nothing saved to restore afterwards, so it
 * would silently take Advanced Automation away from a player who had switched
 * it on themselves. Gating both halves on `_botSavedOptions` keeps "the bot
 * leaves the options exactly as it found them" true on every path.
 */
function _endBotWalk(reason) {
    if (!_botInFlight) return;
    _botInFlight = false;
    _botTargetExitName = null;
    _botExitInstalled = false;
    if (_botSavedOptions) {
        _setForkOption('advancedAutomationEnabled', false);
        _restoreAutomationOptions();
    }
    log('debug', `bot window closed — ${reason}`);
}

/**
 * Install the host's step-gate state (slice 2). Pushed on every CHANGE of
 * (loop mode active, loops' livePlayRegion) plus a force-push on region
 * load, so the bridge never has to ask.
 */
function _setStepGate(state) {
    const enforced = state?.enforced === true;
    const region = typeof state?.livePlayRegion === 'string' ? state.livePlayRegion : null;
    const botRegion = typeof state?.botSolverRegion === 'string' ? state.botSolverRegion : null;
    if (enforced === _stepGateEnforced && region === _stepGateLiveRegion
        && botRegion === _stepGateBotRegion) return;
    _stepGateEnforced = enforced;
    _stepGateLiveRegion = region;
    _stepGateBotRegion = botRegion;
    log('debug', `step gate: ${_mayStepClock() ? 'OPEN' : 'CLOSED'} `
        + `(enforced=${enforced}, livePlay=${region ?? 'none'}, `
        + `bot=${botRegion ?? 'none'}, here=${_currentRegionId ?? 'none'})`);
}

/**
 * Commands from the host-side PlaybackProxy (arc D1).
 *
 * Three things ride this channel today:
 *   `replayActions` — fine-grained Playback (slice 4): install the recorded
 *     plan plus its departure exit and run the game until that exit fires.
 *     Opens the replay window itself.
 *   `beginReplay` / `endReplay` — the REPLAY WINDOW (slice 1) on its own,
 *     inside which every publish is stamped as queue execution.
 *   `setStepGate` — the host's view of whether the game may advance
 *     (slice 2): loop mode active, and which region loops is parked on for
 *     live play.
 *   `walkTo` / `stop` — the Bot window (arc D2 slice 2).
 *   `instant` — the Bot half of Instant (Instant-policy pass, slice 1).
 *     Playback's half rides `replayActions`' opts instead, because it is
 *     scoped to one replay; this one is a mode spanning a walk.
 *
 * The PlaybackProxy's remaining generic pacing methods (play/stop/step/
 * setRate/reset) are still deliberately NOT wired: the clock is bridge-owned,
 * so honouring them would fight it rather than serve it. Instant is the
 * exception because it is not a rate — it is a request to stop consulting
 * wall time at all, which the bridge's own clock is free to grant.
 */
function _handlePlaybackControl(payload) {
    const method = payload?.method;
    const args = Array.isArray(payload?.args) ? payload.args : [];
    switch (method) {
        case 'replayActions':
            _startReplay(args[0], args[1]);
            return;
        case 'beginReplay':
            _beginReplay();
            return;
        case 'endReplay':
            _endReplay('host ended the replay');
            return;
        case 'setStepGate':
            _setStepGate(args[0]);
            return;
        case 'walkTo':
            _startBotWalk(args[0]);
            return;
        case 'stop':
            // loops' _stopBotExecutedAction calls stop() when it tears a bot
            // park down (pause, hard pause, an unexpected region). The clock
            // stays the bridge's — what stops is the WINDOW, and with it the
            // planner we armed.
            _endBotWalk('host stopped the walk');
            return;
        case 'instant':
            // The BOT half of Instant (Instant-policy pass, slice 1).
            // loopState sets this both ways before every walkTo — see
            // _botInstantMode for why the OFF direction is load-bearing.
            // Default ON matches PlaybackProxy.instant()'s own default.
            _botInstantMode = args.length === 0 ? true : args[0] === true;
            log('debug', `bot instant mode ${_botInstantMode ? 'ON' : 'OFF'}`);
            return;
        case 'play':
        case 'step':
        case 'setRate':
        case 'reset':
            log('debug', `playback control '${method}' ignored (arc D1: the bridge owns `
                + 'the clock, so the generic pacing methods would fight it rather than '
                + 'serve it — Instant is honoured, on its own path)');
            return;
        default:
            log('warn', 'playback control: unknown method', method);
    }
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
            // A replay whose region we just left is over either way (its
            // own departure, a reset teleport, or the player). Leaving the
            // flag latched would stamp fromLoop on a later LIVE check.
            _endReplay('left the region');
            // Same for the bot window — and here it also matters that the
            // planner gets disarmed: a reset teleport out of a grind must not
            // leave automation running for whoever visits next.
            _endBotWalk('left the region');
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
        _endReplay('rules reloaded');
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
        // …including the per-region authored plans (slice 3): a stored plan
        // names the OLD world's actions, and the queue the fork is holding right
        // now belongs to a region that no longer exists.
        _regionStore.clear();
        _regionQueueStore.clear();
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

    // PlaybackController commands from the host-side proxy (arc D1).
    _client.subscribeEventBus('omsi:playbackControl', _handlePlaybackControl);

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
            // Per-region authored plans (slice 3): regionId -> stashed entry
            // count, plus the length of the plan currently installed.
            regionQueueCounts: Object.fromEntries(
                [..._regionQueueStore].map(([id, q]) => [id, q.length])),
            queuedActionCount: _engineActions()?.next?.length ?? null,
            regionExitAvailable: _managed()?.regionExitAvailable?.() ?? null,
            syntheticExits: _activeSyntheticExits.map((e) => ({ ...e })),
            // Loop-mode replay window (arc D1): true while this bridge's
            // publishes are stamped fromLoop, plus the exit the in-flight
            // replay is grinding toward (slice 4).
            replayInFlight: _replayInFlight,
            replayDepartureExitId: _replayDepartureExitId,
            // Instant (Instant-policy pass, slice 1). Both raw flags plus the
            // resolved answer, so a leg can tell "the checkbox never arrived"
            // apart from "it arrived and the window was closed".
            instant: {
                replay: _replayInstant,
                botMode: _botInstantMode,
                pumpActive: _instantPumpActive(),
            },
            // Step gate (slice 2): whether the game may advance, and the
            // host state that decides it.
            mayStep: _mayStepClock(),
            stepGate: {
                enforced: _stepGateEnforced,
                livePlayRegion: _stepGateLiveRegion,
                botSolverRegion: _stepGateBotRegion,
            },
            bot: {
                inFlight: _botInFlight,
                targetExit: _botTargetExitName,
                exitInstalled: _botExitInstalled,
                exitGateOpen: _regionExitAvailable(),
                plannerArmed: !!_botSavedOptions,
                plannerStatus: (typeof document !== 'undefined'
                    ? document.getElementById('plannerStatus')?.textContent : null) ?? null,
            },
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
