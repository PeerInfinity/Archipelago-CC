/**
 * ⛓⛓ **THE PLAYBACK BOT'S FEET ON THE WASM RUNTIME** (solver-walk W2). The engine behind
 * `SeedlingPlaybackController`'s wasm branch, for REAL atlas rooms
 * (`flash_seedling`). It is loaded by a COMPUTED-URL dynamic import
 * (`loadWasmPlaybackEngine`), so the panel's static import closure stays
 * model-free (the controller's ⛔) and the bundle never inlines the solver.
 *
 * One goal, one room (⚖ Q5), served at an ARRIVAL (⚖ W-Q3):
 *
 *   1. ARRIVE. The player is not in the goal's room → wait for the crossing
 *      that lands there. The player IS in the room → `MID_ROOM_POLICY`: a
 *      FORCED RE-ARRIVAL, a host `new Game(level, spawn)` through the panel's
 *      own teleport recipe (the room resets like a death). A plan tape still
 *      playing → the goal QUEUES until it finishes (⚖ W0-Q2: a SealController
 *      freeze is waited out, never cut by a teleport).
 *   2. DETECT. `botSeam()` sampled on a 0 ms timer IN THE GAME'S WINDOW (W0/W1's
 *      measured arrangement, 0.1–0.2 ms a call); an arrival is the
 *      `beginEntry` record CHANGING (`wasmArrival.isArrival`), never the
 *      level report (the 12g race).
 *   3. STAGE + FREEZE, IN THAT SAME JS TURN. `botStatus` ONCE (14–16 ms) +
 *      `readState` → `stagingFromWasmArrival`; then a ZERO-TICK `hold` tape
 *      (`shippedTape`) is started: it waits out the fade and holds on the
 *      first live frame, before that frame steps (W0 i.3–i.6), so the room
 *      stands still while the worker thinks (⚖ W-Q2).
 *   4. SOLVE in the S2 Worker (`createWorkerSolveService`). ⛓ DETERMINISTIC
 *      BUDGET: the budget is WORK (`SOLVER_BUDGET_WORK` units, counted in the
 *      worker by `jsRuntimeSolver.passShouldStop`), so the answer is the same
 *      on every machine and the engine only WAITS for it. ⛓ ANYTIME: the
 *      worker runs the solver's passes cheapest first (`ANYTIME_PASSES`:
 *      dashless, then full); a later pass cut at the work budget leaves the
 *      plan an earlier pass found (`expired`; the room is held, so it is from
 *      this very staging); a refusal whose cut pass did not answer keeps ⛓ O2
 *      the room held and asks AGAIN once at `SOLVE_RETRY_BUDGET_FACTOR`× the
 *      units, resuming at the first unanswered pass; only that retry's cut
 *      ends the goal, by name (`expiryFailure`, a pass's decline first). The
 *      budget is the `flashPanel.seedlingWasmSolverBudgetWork` knob when set
 *      (`getBudgetWork`); the upgrade window `getUpgradeWindowWork`
 *      (`flashPanel.seedlingSolverUpgradeWindowWork`; 0 = the whole budget).
 *      ⛔ The wall clock is only a BACKSTOP (`SOLVE_BACKSTOP_MS`, and
 *      `LOAD_BUDGET_MS` for a worker that never starts): past it the goal FAILS
 *      by name, and a plan in hand is never played instead.
 *   5. SHIP the plan as ONE tape from the same staging, declarations re-checked
 *      against a fresh `botStatus` (`exactDeclarationRefusal`); `botLoadTape`
 *      keeps the hold, `botStart` releases it and arms on the SAME world.
 *   6. WATCH. `botDrain()` every `DRAIN_MS` (cheap) for the progress readout
 *      and the trajectory compare (`firstDivergence`, 0 px); one `botStatus`
 *      per `STATUS_MS` only once every planned tick has drained, to see
 *      `finished`. ⛔ Never `botStatus` per frame (W0: it halves the frame
 *      rate).
 *   7. RECOVER (W3, ⚖ W-Q3). A drained row off the plan → ONE `botStatus`
 *      (`divergenceAction`): the goal's clear already landed → done; else
 *      `botReset` + a FORCED RE-ARRIVAL at the spawn the arrival recorded +
 *      a fresh solve from the new arrival (steps 2–6 again), at most
 *      `MAX_RECOVERIES` per goal; the divergence after the last is a named
 *      failure (`divergenceFailure` → `playback:walkFailed`). ⛓ W4: a
 *      divergence that EXACTLY repeats the goal's previous one (same tick,
 *      same game row — a deterministic residue a re-solve replays) fails at
 *      once (`divergenceRepeatFailure`). A `SealController` freeze drains NO
 *      rows, so it is never a divergence (⚖ W0-Q2).
 *
 * ⛓ W8 — THE COLD START IS ADOPTED, not re-entered, when the room provably IS
 * "its arrival + N idle ticks" (`wasmPlayback.adoptionRefusal`'s clauses + the
 * glue query): held where it stands, the goal a continuation from the shadow
 * "arrival + 1 idle tick". Any refusal → the named `cold-start` re-arrival.
 * ⛓ W8c — a NEW GAME's room (the host's level-set reset boots the game's
 * new-game arm, whose begin record reads level −1: `newGameBeginEntry`
 * resolves it to the set's start level) is adopted too, AFTER its ceremony:
 * the wind cutscene is waited out (a re-arrival would replay it), the
 * arrow-key tutorial it ends with is dismissed by one arrow pair
 * (`awaitCeremony`), and a `freeze` no `botStatus` row shows refuses any
 * adoption (`readState().freezeObjects`).
 * ⛓ W4 — A PIT exit maps to `reach-pit` (the fall is the game's crossing).
 * ⛓ STEP-OFF RETIRE — an arrival LATCHED ON its goal door is a plain solve:
 * `solveSegment` steps off it and walks back (a `step-off` verb, fidelity
 * STEP-OFF), ONE plan and ONE tape from the arrival. W4's walker-prefix
 * composite (the worker's `step-off` producer) is gone.
 *
 * ⛓ WG → §5.36 — GENERATED ROOMS (`flash_seedling_gen`). The rooms are a
 * MOUNTED level set, so the engine's level source is the set the generated
 * arm delivered (`mountedRecords.mountedRecordsOf`: the delivery's own chunk
 * plan, the level ids as mounted), never the preset's map document. Since
 * §5.36 (⚖ the user: the SOLVER for everything) they are SOLVER rooms exactly
 * as a delivered set of real rooms is — holds, continuations, the adoption,
 * the anytime passes and the held retry; an `apitem` is F2's strategy
 * `apitem`; a decline fails the goal by name. `generated` only LABELS them.
 *
 * ⛓ THE WALKER PRODUCER is an INSTRUMENT now (`producer: 'walker'`), never a
 * production path: the divergence sweep's `--producer=walker` builds an
 * engine with it to get the GAME's evidence for a leg the solver refuses
 * (the J2 walker on a fresh run from the arrival's staging, `wasmWalkTape.js`,
 * its held keys shipped and watched as a plan). Nothing the panel builds sets it.
 *
 * Every `botStart` is bracketed by two `pendingCheck` seq reads and handed to
 * the check binding (`ignoreHostStart`, ⚖ W0-Q1), so a declaration's echo can
 * never become an AP check.
 *
 * The check and the crossing are the GAME's: a location tape opens the chest
 * for real (the binding reports it), an exit tape walks through the door (the
 * region binding sees the crossing, the glue redirects it). Nothing here
 * reports either.
 */

import {
    arrivalSolveRequest, arrivalSolverGoal, continuationSolveRequest, isArrival, stagingFromWasmArrival,
} from '../seedlingDemo/wasmArrival.js';
import {
    adoptedClockStaging, adoptionRefusal, adoptRefusalIsTransient, arrivalHoldBlocker, queuedSwapPush, CEREMONY_QUIET_FRAMES, CEREMONY_WAIT_MS, divergenceAction, divergenceFailure, divergenceRepeatFailure, endsHeld, exactDeclarationRefusal, FALLBACK_POLICY,
    firstDivergence, foldDrain, goalAction, keysHeldAtReset, locationGoalServed, liveDeclarations, MAX_RECOVERIES, newGameBeginEntry, newGameCeremony,
    primarySplitRefusal, shadowMismatch, talkCircleGuard, talkCirclesAt, TUTORIAL_DISMISS_KEY, TUTORIAL_FADE_FRAMES,
    shippedTape, tapeEquips, TAPE_KEY_RELEASES, wasmGoalRefusal, expiryAction, expiryFailure, SOLVE_RETRY_BUDGET_FACTOR,
} from '../seedlingDemo/wasmPlayback.js';
import {
    ANYTIME_PASSES, betterAnswer, budgetCut, LOAD_BUDGET_MS, passesAfter, replayTape, SOLVE_BACKSTOP_MS, SOLVER_BUDGET_WORK,
    SOLVER_UPGRADE_WINDOW_WORK,
} from '../seedlingDemo/jsRuntimeSolver.js';
import { createWorkerSolveService } from '../seedlingDemo/jsRuntimeSolveService.js';
import { indexLevels, levelSourceFromAtlas } from '../seedlingDemo/atlasSource.js';
import { parsePendingCheck } from './seedlingCheckBinding.js';
import { mountedRecordsOf, WALK_TAPE_PRODUCER } from '../seedlingDemo/wasmWalkTape.js';
import {
    deliveredSaveArrays, deliveryRefusal, DELIVERY_FALLBACK, DELIVERY_POLICY, equipSlotRefusal, firstTickSlotRefusal, itemDelta, itemsAfterWrites,
    liveSaveArrays, mergeSaveArrays, saveArraysOfWrites, saveDelta, slotsAfterDelivery, stageItems, stageSaveArrays,
} from '../seedlingDemo/wasmDelivery.js';

/** How long a goal waits for its arrival (a crossing, or the forced re-arrival) before it fails by name. */
export const ARRIVAL_WAIT_MS = 15000;
/** How long a QUEUED goal waits for the playing tape (a seal reveal is ~16 s, W0 i.13). */
export const QUEUE_WAIT_MS = 60000;
/** ⛓ WALK IDENTITY (b) — how long the bot's Restart waits for a playing tape to reach its end (a seal reveal is ~16 s). */
export const RESTART_LEG_WAIT_MS = 30000;
/** Solve poll, drain poll, and the `finished` read's cadence once every planned tick drained. */
export const SOLVE_POLL_MS = 20;
/** ⛓ W8c — the new-game ceremony's poll (`awaitCeremony`). */
export const CEREMONY_POLL_MS = 100;
export const DRAIN_MS = 100;
/** ⛓ §5.19 — how long a cold start waits on a TRANSIENT adoption clause (`ADOPT_TRANSIENT_CLAUSES`), and its poll. */
export const ADOPT_WAIT_MS = 15000;
export const ADOPT_POLL_MS = 100;
export const STATUS_MS = 500;
/** ⛓ MID-ROOM REPLAN — how long a delivery the gate let through may take to show in `botStatus.items`, and the poll. */
export const DELIVERY_LAND_MS = 3000;
export const DELIVERY_POLL_MS = 20;

const J = (s) => { try { return JSON.parse(s); } catch { return null; } };
const secs = (ms) => `${Math.round(ms / 100) / 10} s`;
/** ⛓ WASM EQUIPS — `[{t, slot}]` (room ticks) → the Map `replayTape` / `deliveryRefusal` read; null when empty. */
const equipsMap = (rows) => (rows?.length ? new Map(rows.map((e) => [e.t, e.slot])) : null);
/** The slot selections a room's shipped ticks made. */
const roomEquips = (r) => equipsMap(r?.equips);

/**
 * @param {object} deps
 * @param {() => object|null} deps.getGame  the game's callback surface (`adapter._getFlash()`)
 * @param {() => Window|null} [deps.getWin]  the game's window — its timers run the sampler (W0/W1's arrangement)
 * @param {(p:{level:number, x:number, y:number}) => boolean} deps.teleport  the panel's teleport recipe
 * @param {() => object|null} [deps.getCheckBinding]  the glue's `SeedlingCheckBinding`
 * @param {Map} deps.records  level → record (the preset's map document; ⛓ WG the mounted set's)
 * @param {boolean} [deps.generated]  `records` are a MOUNTED generated set — a LABEL (status, notes); ⛓ §5.36 it picks no producer
 * @param {string|null} [deps.producer]  ⛓ an INSTRUMENT only: `'walker'` = every goal by the J2 walker producer
 *   (W2's flow: no holds, no continuations) — the divergence sweep's `--producer=walker`; production never sets it
 * @param {object} [deps.solveService]  default `createWorkerSolveService()`
 * @param {object} [deps.timers]  `{setTimeout, clearTimeout}` — default the GAME window's
 * @param {() => number} [deps.now]
 * @param {(note:string|null) => void} [deps.onNote]
 * @param {(reason:string, extra:({obstacle:object}|null)) => void} [deps.onFailed]  ⛓ WAVE-6 CONSUMER — `extra.obstacle`
 *        = a solver decline's `SolverRefusal.obstacle` (plain data), when it carried one
 * @param {(e:object) => void} [deps.onDone]
 * @param {(msg:string, level?:string) => void} [deps.log]
 * @param {number} [deps.budgetWork]  one solve's budget, in work units (`SOLVER_BUDGET_WORK`)
 * @param {() => number|null} [deps.getBudgetWork]  ⛓ O3 — the live knob (`flashPanel.seedlingWasmSolverBudgetWork`),
 *   read at each solve's start; a non-positive / non-finite answer = `budgetWork`
 * @param {() => number|null} [deps.getUpgradeWindowWork]  the upgrade window in work units
 *   (`flashPanel.seedlingSolverUpgradeWindowWork`), read at each solve's start; null = the engine's own
 *   (`SOLVER_UPGRADE_WINDOW_WORK`), 0 = the whole budget
 * @param {number} [deps.backstopMs]  the wall-clock backstop (`SOLVE_BACKSTOP_MS`): a named failure, never an answer
 * @param {() => object|null} [deps.getDelivery]  ⛓ MID-ROOM REPLAN — the panel adapter's delivery gate
 *   (`{setItemGate, writesOf, inventory, push}`); absent = items reach the game as they arrive (no gate)
 */
export function createWasmPlayback({
    getGame, getWin = () => null, teleport, getCheckBinding = () => null, getSwapState = null, pushSwapNow = null, records, generated = false, producer = null,
    solveService = null, timers = null,
    now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now()),
    onNote = () => {}, onFailed = () => {}, onDone = () => {}, log = () => {}, budgetWork = SOLVER_BUDGET_WORK,
    getBudgetWork = null, getUpgradeWindowWork = null, getDelivery = null, backstopMs = SOLVE_BACKSTOP_MS,
}) {
    /** ⛓ O3 — the budget (work units) a solve starts with: the knob's live value, else the engine's own. */
    let ownBudget = budgetWork;
    const baseBudget = () => {
        let v = null;
        try { v = getBudgetWork?.() ?? null; } catch { v = null; }
        const n = Number(v);
        return v !== null && Number.isFinite(n) && n > 0 ? n : ownBudget;
    };
    /** The upgrade window (work units) a solve starts with: the knob, else the engine's own; ≤ 0 = the whole budget. */
    const upgradeWindow = () => {
        let v = null;
        try { v = getUpgradeWindowWork?.() ?? null; } catch { v = null; }
        const n = Number(v);
        if (v === null || v === '' || !Number.isFinite(n)) return SOLVER_UPGRADE_WINDOW_WORK;
        return n > 0 ? n : null;
    };
    const levelSource = levelSourceFromAtlas(records);
    let service = solveService;
    const svc = () => { service ??= createWorkerSolveService(); return service; };
    /** ⛓ the walker INSTRUMENT (`producer: 'walker'`) keeps W2's flow; every SOLVER engine holds (⛓ §5.36 — generated rooms too). */
    if (producer !== null && producer !== WALK_TAPE_PRODUCER) throw new Error(`no tape producer ${JSON.stringify(producer)} (only the '${WALK_TAPE_PRODUCER}' instrument)`);
    const walkerInstrument = producer === WALK_TAPE_PRODUCER;
    const holds = !walkerInstrument;
    /**
     * ⛓ W7 — the arrival watch (holding the arrival an exit plan's crossing leads to) needs the GLUE QUERY:
     * an engine built without `getSwapState` cannot know a redirect is in flight, so it holds no arrival
     * between goals (W2's flow there); its held location ends and continuations are unaffected.
     */
    const glueQuery = holds && typeof getSwapState === 'function';

    /**
     * idle | await-arrival | ⛓ W8 adopting (the adoption's freeze latching) | ⛓ W8c ceremony (the new-game arm's
     * cutscene / tutorial, waited out before the adoption) | solving | playing | held (⛓ W7: our tape holds a room, no goal)
     */
    let phase = 'idle';
    let goal = null;
    let queued = null;
    let timer = null;
    let token = 0;
    let baseline = null;
    let deadline = 0;
    let handle = null;
    let ours = false; // a tape WE started may be armed or holding
    let play = null;
    /** W3: the forced re-arrivals this goal has spent, and the spawn its arrival recorded. */
    let recoveries = 0;
    let spawn = null;
    /** ⛓ W4 — this goal's last divergence (an exact repeat fails at once). */
    let lastDivergence = null;
    /**
     * ⛓ W7 — the room our tape HOLDS (or is playing in since it held it):
     * `{level, staging, shipped, spawn, begin}` — the arrival's staging and
     * every key set shipped since, i.e. the SHADOW's recipe. null = no exact
     * staging of the room the player is in (the cold start, a fallback, a
     * crossing in flight).
     */
    let room = null;
    /**
     * ⛓ §5.19 — the begin record OUR last `botLoadTape` cleared (`flash.md` § Wasm playback: a tape load clears
     * `beginEntry`), with the glue's push count then: `{entry, pushes}`. A null `beginEntry` after it is OUR
     * doing, not a pending swap — while no later begin landed (the game sets a new one) and no teleport was
     * pushed since, the room is still the one that record describes, and an adoption may read it.
     */
    let cleared = null;
    /** ⛓ W7 — the bot is driving (a walkTo since the last stop()): arrivals are held. */
    let driving = false;
    /** ⛓ W7 — an exit plan's crossing is in flight: the next held arrival is where the next goal starts. */
    let arriving = false;
    /** ⛓ W7 — the arrival watch: its own timer chain beside the goal's (the sampler of W0/W1, between goals). */
    let watchTimer = null;
    let watchToken = 0;
    let watchBaseline = null;
    /**
     * ⛓ MID-ROOM REPLAN — the DELIVERY GATE (`getDelivery`): installed on the panel adapter while the bot
     * drives a solver room. `admitted` = the inventory the game may hold; `pending` = a delivery the game
     * would SEE, held back until a safe point; `deferred` = the room a refused delivery waits out
     * (`DELIVERY_FALLBACK`). `handle` = the adapter handle it was installed on.
     */
    let gate = null;
    /** ⛓ the tape `botHold("on")` froze mid-span for a delivery: `{tick, solution, heldKeys, at, slots…}`. */
    let frozen = null;
    /** ⛓ a delivery let through, waiting to show in `botStatus.items`: `{items, since, then, row}`. */
    let landing = null;
    let deliveryTimer = null;
    let deliveryToken = 0;
    /** Warm the worker now, so the first solve does not pay the module load inside its budget (S2). */
    try { svc().warm?.(); } catch { /* no Worker here: the first start says so */ }
    const stats = { arrivals: 0, forced: 0, solves: 0, ships: 0, hostStarts: [], done: 0, failed: 0, divergences: 0,
        recoveries: 0, keyReleases: [],
        // ⛓ W7 — why each forced re-arrival was spent, the held arrivals, the continuations, the glue query's refusals
        forcedBy: {}, held: 0, continuations: 0, fallbacks: [], heldChecks: [], holdBlocked: [], releasedForSwap: 0,
        // ⛓ W8 — cold starts adopted as they stand, and the clause each refused one failed
        adopted: 0, adoptRefused: [],
        // ⛓ WALK IDENTITY (a) — each adoption put on the live clock: begin-staged, shadow and held clocks, the shift (or why not)
        adoptClock: [],
        // ⛓ WALK IDENTITY — arrivals the glue told the engine to expect (a Restart's start hop)
        expectedArrivals: 0,
        // ⛓ W8c — the new-game arm's ceremonies waited out, and the tutorial Helps dismissed (one arrow pair each)
        ceremonies: [], dismissed: [],
        // ⛓ ANYTIME / O2 — expiries, the provisional plans they played, the held retries, and each plan's pass
        expiries: 0, provisionalPlays: 0, retries: 0, passes: {}, backstops: 0,
        // ⛓ MID-ROOM REPLAN — deliveries the gate held back, each one's outcome (freeze, land, replan), and the refused
        deliveries: [], deliveryDeferred: [], gateHeld: 0,
        // ⛓ SERVED LOCATION — deliveries that met a location goal whose own check had fired: no freeze, no re-solve
        deliveryServed: [],
        // ⛓ ARRIVAL JITTER — the glue teleports pushed in the turn their door's begin record was seen
        swapPushes: [],
        // ⛓ ARRIVAL JITTER — every plan ship's clock: staged, shipped prefix, the game's (a diagnostic, never acted on)
        shipClock: [],
        // ⛓ RESTART HOLD (diagnostic) — the arrival watch's life around an expected arrival: armed, dropped, re-based, seen
        arrivalWatch: [] };
    const history = [];
    /** ⛓ WG — the reads of the last few arrivals (the probe's fixture recorder; never read back here). */
    const arrivalReads = [];

    const game = () => getGame?.() ?? null;
    const T = () => {
        if (timers) return timers;
        let win = null;
        try { win = getWin?.() ?? null; } catch { win = null; }
        return win?.setTimeout ? win : globalThis;
    };
    function schedule(fn, ms) {
        const my = token;
        const t = T();
        timer = { t, h: t.setTimeout(() => { if (my === token) fn(); }, ms) };
    }
    function cancelTimer() {
        if (timer) { try { timer.t.clearTimeout(timer.h); } catch { /* gone */ } timer = null; }
    }
    function note(n) { try { onNote(n); } catch { /* a listener's bug */ } }
    const readState = () => J(game()?.readState?.()) ?? {};
    const seam = () => J(game()?.botSeam?.()) ?? {};
    const status = () => J(game()?.botStatus?.());
    const seqNow = () => parsePendingCheck(readState().pendingCheck)?.seq ?? 0;
    const swapState = () => { try { return glueQuery ? (getSwapState() ?? null) : null; } catch { return null; } };

    /**
     * Release whatever tape we started (hold or armed) — `botReset` (W0 i.9) —
     * and then the KEYS a plan tape was holding mid-span (`keysHeldAtReset`:
     * a reset leaves them down, and the next tape's press on them is lost).
     * `st` = a `botStatus` read in this same JS turn (no tick runs between it
     * and the reset); without one, a PLAYING plan pays one read here.
     * ⛓ W7 — a released room is no longer the shadow's: `room` is dropped.
     */
    function release(st = undefined) {
        room = null;
        const wasFrozen = frozen;
        frozen = null;
        if (!ours) return;
        ours = false;
        let held = [];
        if (phase === 'playing' && play?.plan) {
            const s = st === undefined ? status() : st;
            held = keysHeldAtReset({ status: s, solution: play.plan.solution });
        } else if (wasFrozen) {
            // ⛓ MID-ROOM REPLAN — a tape frozen for a delivery still holds what it held at the freeze.
            held = wasFrozen.heldKeys;
        }
        try { game()?.botReset?.(); } catch { /* the page is gone */ }
        if (held.length) releaseKeys(held);
    }

    /**
     * A keydown + keyup PAIR per key on the game canvas. A lone keyup is
     * DROPPED by the runtime (Ruffle's physical-key rule: a KeyUp needs a
     * KeyDown it saw — `avm2_display.c` IN_KEY_UP, measured 0/4); the pair is
     * queued in order and delivered on the next tick (`avm2_input_pump_tick`),
     * where the keydown is a no-op on a key Flash already holds.
     */
    function releaseKeys(names) {
        if (pressPairs(names)) stats.keyReleases.push(names);
    }

    /** The keydown + keyup pairs `releaseKeys` describes; false when there is no canvas to dispatch on. */
    function pressPairs(names) {
        let win = null;
        try { win = getWin?.() ?? null; } catch { win = null; }
        const canvas = win?.document?.querySelector?.('canvas') ?? null;
        const Ctor = win?.KeyboardEvent;
        if (!canvas || typeof Ctor !== 'function') return false;
        for (const k of TAPE_KEY_RELEASES.filter((x) => names.includes(x.name))) {
            for (const type of ['keydown', 'keyup']) {
                try {
                    canvas.dispatchEvent(new Ctor(type, { key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode,
                        bubbles: true, cancelable: true }));
                } catch { /* the page is gone */ }
            }
        }
        return true;
    }

    function reset() {
        token += 1;
        cancelTimer();
        if (handle && !handle.settled) handle.cancel();
        handle = null;
        play = null;
        phase = 'idle';
    }

    function fail(reason, extra = null) {
        const g = goal;
        release();
        reset();
        stopWatch();
        arriving = false;
        goal = null;
        stats.failed += 1;
        history.push({ goal: g, outcome: 'failed', reason, recoveries, ...(extra?.obstacle ? { obstacle: extra.obstacle } : {}) });
        log(`[wasm playback] ${reason}`, 'warn');
        note(null);
        try { onFailed(reason, extra); } catch { /* a listener's bug */ }
    }

    /**
     * `botLoadTape` + `botStart`, bracketed by the seq reads and handed to the
     * binding. Returns null or the refusal.
     */
    function hostStart(tape, label) {
        const g = game();
        if (!g?.botLoadTape || !g?.botStart) return 'the game exposes no botLoadTape/botStart';
        const from = seqNow();
        const live = seam().beginEntry ?? null;
        if (live) cleared = { entry: live, pushes: swapState()?.pushes ?? null };
        const loaded = g.botLoadTape(JSON.stringify(tape));
        if (loaded !== 'ok') return `botLoadTape refused the ${label} tape: ${loaded}`;
        const started = g.botStart();
        const to = seqNow();
        ours = true;
        stats.hostStarts.push({ label, from, to });
        if (to > from) getCheckBinding?.()?.ignoreHostStart?.({ from, to });
        if (started !== 'ok') return `botStart refused the ${label} tape: ${started}`;
        return null;
    }

    // ── 1/2: arrive ───────────────────────────────────────────────────────

    function begin(g) {
        const record = records.get(g.level);
        const refusal = wasmGoalRefusal(g, record ?? null, { source: generated ? 'mounted generated set' : 'vanilla map' });
        if (refusal) return { ok: false, reason: refusal };
        const live = readState();
        if (!Number.isInteger(live.level)) return { ok: false, reason: 'the game reports no level (is it started?)' };
        driving = true;
        engageGate();
        // ⛓ MID-ROOM REPLAN — a delivery is landing in the held room: the goal waits for it (then is served from it).
        if (phase === 'delivering') {
            queued = { goal: g, since: now() };
            note('queued behind an item delivery');
            return { ok: true, action: 'queue' };
        }
        // ⛓ W7 — a goal replacing one mid-solve in the HELD room keeps the hold (the room is still the shadow).
        if (holds && phase === 'solving' && room) {
            token += 1;
            cancelTimer();
            if (handle && !handle.settled) handle.cancel();
            handle = null;
            play = null;
            phase = 'held';
        }
        const heldLevel = holds && room && phase === 'held' ? room.level : null;
        let action = goalAction({ goal: g, liveLevel: live.level, playing: phase === 'playing', heldLevel });
        // ⛓ W7 — an exit plan's crossing is in flight: the goal waits for the HELD arrival, never a teleport back.
        if (action === 'force-re-arrival' && glueQuery && arriving) action = 'await-arrival';
        if (arriving || action !== 'continue') watchRow('walkTo', { goal: g.level, action, seamLevel: seam().beginEntry?.['begin.level'] ?? null });
        if (action === 'queue') {
            queued = { goal: g, since: now() };
            note(`queued behind the playing tape (${goal?.name ?? 'the last goal'})`);
            return { ok: true, action };
        }
        goal = g;
        recoveries = 0;
        lastDivergence = null;
        if (action === 'continue') {
            token += 1;
            cancelTimer();
            stopWatch();
            solveInRoom();
            return { ok: true, action };
        }
        // A goal replacing one mid-solve (no held room): the freeze is ours, release it first.
        const keepWatch = action === 'await-arrival' && glueQuery && arriving;
        release();
        reset();
        if (!keepWatch) stopWatch();
        spawn = action === 'force-re-arrival' ? { x: live.playerPositionX, y: live.playerPositionY } : null;
        if (action === 'force-re-arrival') {
            // ⛓ W8 — the cold start: ADOPT the unwatched room when it provably is "its arrival + idle ticks".
            const adopted = holds && glueQuery && !room ? adoptLive(g) : null;
            if (adopted === true) return { ok: true, action: 'adopt' };
            if (adopted?.transient) { awaitAdoption(adopted.transient); return { ok: true, action: 'await-adoption' }; }
            if (adopted && typeof adopted === 'object') { awaitCeremony(adopted); return { ok: true, action: 'await-ceremony' }; }
            reArrive(`re-entering level ${g.level} to solve from an arrival (${FALLBACK_POLICY}: the cold start — the room ran `
                + `before the bot drove${adopted ? `, and it cannot be adopted: ${adopted}` : ', so no arrival staging of it exists'})`, 'cold-start');
        } else {
            phase = 'await-arrival';
            deadline = now() + ARRIVAL_WAIT_MS;
            note(`waiting to arrive in level ${g.level}`);
            if (glueQuery) startWatch('begin');
            else {
                baseline = seam().beginEntry ?? null;
                schedule(sample, 0);
            }
        }
        return { ok: true, action };
    }

    /**
     * ⛓ W8 — ADOPT the room the player is in (the cold start), with no re-arrival:
     * stage it from its begin record + the live reads, check `adoptionRefusal`
     * (the room IS "its arrival + N idle ticks", N ≥ 1, and the shadow does not
     * depend on N), then HOLD it and serve the goal as a continuation from the
     * shadow `arrival + 1 idle tick` (`room.shipped = [[]]`). The glue query
     * must rule out a redirect in flight, as for a held arrival.
     * Returns true (adopted, or failed by name) or the refusal, `clause: why`.
     * ⛓ §5.19 — or `{transient: {clause, why}}` for a clause time cures (`ADOPT_TRANSIENT_CLAUSES`): the
     * caller WAITS (`awaitAdoption`) and records it only if it outlives the wait (`transient: false`).
     */
    function adoptLive(g, { ceremonyOver = false, transient = true } = {}) {
        const live = seam();
        // ⛓ §5.19 — a begin record OUR tape load cleared is read back (`cleared`): no begin landed since (the
        // seam would hold it) and no teleport was pushed since (its swap would land a new room).
        const sw0 = swapState();
        const mine = !live.beginEntry && cleared && (cleared.pushes ?? null) === (sw0?.pushes ?? null) ? cleared.entry : null;
        const arrived = mine ? { ...live, beginEntry: mine } : live;
        const st = status();
        const state = readState();
        const record = records.get(g.level) ?? null;
        const refused = (clause, why) => {
            if (transient && adoptRefusalIsTransient(clause, arrived.beginEntry)) return { transient: { clause, why } };
            stats.adoptRefused.push({ level: g.level, clause, why });
            return `${clause}: ${why}`;
        };
        if (!st) return refused('begin', 'botStatus answered nothing');
        // ⛓ W8c — the new-game arm's record reads begin.level −1: resolved to the set's start level
        // (`newGameBeginEntry`), and its ceremony is waited out (`awaitCeremony`) before any clause is asked.
        const newGame = newGameBeginEntry(arrived.beginEntry ?? null, { status: st, startLevel: J(game()?.botLevelSet?.())?.start_level });
        const se = newGame ? { ...arrived, beginEntry: newGame } : arrived;
        const be = se.beginEntry ?? null;
        // Always through `awaitCeremony`, even when none shows now: the scene's last frame queues the tutorial's Help.
        if (newGame && !ceremonyOver) return { ceremony: newGameCeremony({ status: st, state }), begin: arrived.beginEntry };
        let staging = null;
        let shadow = null;
        if (be && be['begin.level'] === st.level) {
            try {
                ({ staging } = stagingFromWasmArrival({ seam: se, status: st, state, record }));
                staging = withApSave(staging);
                const one = replayTape({ staging, perTick: [new Set()], levelSource, scratchPersistence: true });
                shadow = { x: one.state.x, y: one.state.y, direction: one.state.direction };
            } catch (err) { return refused('staging', String(err?.message ?? err).split('\n')[0]); }
        }
        const mobiles = J(game()?.botMobiles?.());
        let r = adoptionRefusal({ beginEntry: be, status: st, mobiles, record, shadow, state });
        // ⛓ §5.19 — the fade is waited out only when nothing ELSE refuses: a permanent clause refuses now.
        if (r?.clause === 'fade') r = adoptionRefusal({ beginEntry: be, status: st, mobiles, record, shadow, state, waitingOutFade: true }) ?? r;
        if (r) return refused(r.clause, r.why);
        const sw = swapState();
        // The glue stamps pushes with the record AS LATCHED (⛓ W8c: the arm's, unresolved).
        const blocked = sw ? arrivalHoldBlocker(sw, arrived.beginEntry ?? null) : 'the glue answered no swap state (a redirect cannot be ruled out)';
        if (blocked) return refused('glue', blocked);
        let freeze;
        try { freeze = shippedTape({ staging, keys: [], hold: true, name: `wasm-adopt-${g.level}` }); } catch (err) { return refused('tape', err.message); }
        const decl = exactDeclarationRefusal(freeze, st, { granted: apSave() });
        if (decl) return refused('declaration', decl);
        const started = hostStart(freeze, 'adopt');
        if (started) { fail(started); return true; }
        stats.adopted += 1;
        // An adoption is the room's STAGING, taken late: it counts as its arrival (one hold per arrival + one tape per ship),
        // and its reads are recorded like an arrival's (⛓ W8b: W5's level-0 probe restages them).
        stats.arrivals += 1;
        arrivalReads.push({ seam: se, status: st, state });
        if (arrivalReads.length > 8) arrivalReads.shift();
        stats.held += 1;
        room = { level: g.level, staging, shipped: [[]], spawn: { x: state.playerPositionX, y: state.playerPositionY }, begin: arrived.beginEntry,
            pushes: sw?.pushes ?? null, adopted: true, newGame: !!newGame,
            // ⛓ W8b — talk circles the player was adopted in: their NPC's `talked` is unread (`talkCircleGuard`).
            talkCircles: talkCirclesAt(mobiles?.mobiles, shadow) };
        spawn = room.spawn;
        arriving = false;
        note(`adopted level ${g.level} as it stands (no re-arrival)`);
        // The held check reads a HELD game (W7's invariant): wait for the freeze to latch (one frame), then solve.
        phase = 'adopting';
        deadline = now() + ARRIVAL_WAIT_MS;
        schedule(adoptLatched, SOLVE_POLL_MS);
        return true;
    }

    /**
     * ⛓ W8c — THE NEW-GAME ARM'S CEREMONY, waited out in the room it built
     * (`wasmPlayback.newGameCeremony`): the wind cutscene ends on its own; the
     * tutorial `Help(2)` that follows is dismissed with ONE arrow pair (no tape
     * can: its frames are dead and `autoAdvance` presses X), then the Help's fade
     * runs out and the room is adopted as it stands — the same clauses, the
     * position / facing / velocity ones catching a press that moved anything.
     * ⛔ Only after `CEREMONY_QUIET_FRAMES` game frames with NO ceremony: the
     * scene's last frame clears the freeze and QUEUES `add(new Help(2))`, whose
     * first update raises it again a frame later. Measured: a poll in that
     * window adopted with the Help still pending, and only the plan's first
     * key happening to be an arrow (it dismissed the Help on a live frame)
     * kept the walk on plan — an idle first tick would have left every frame
     * dead.
     * Nothing here re-enters the room: a re-arrival REPLAYS the cutscene
     * (`cutscene` is a static), so the fallback is only for a ceremony that
     * never ends (`CEREMONY_WAIT_MS`), a Help an arrow did not dismiss, or a
     * clause that still refuses.
     */
    function awaitCeremony(first) {
        phase = 'ceremony';
        deadline = now() + CEREMONY_WAIT_MS;
        const c = { level: goal.level, began: first.ceremony ?? 'none', cutscene: first.ceremony === 'cutscene', dismissedAt: null, quietSince: null, adopted: false };
        stats.ceremonies.push(c);
        note(first.ceremony === 'cutscene' ? 'waiting out the new game\'s opening cutscene (no re-arrival: it would replay it)'
            : first.ceremony === 'tutorial' ? 'dismissing the new game\'s arrow-key tutorial' : 'checking the new game\'s room is past its ceremony');
        const step = () => {
            if (phase !== 'ceremony') return;
            const st = status();
            const state = readState();
            if (now() > deadline) {
                reArrive(`re-entering level ${goal.level} (${FALLBACK_POLICY}: the new game's ceremony did not end within `
                    + `${CEREMONY_WAIT_MS / 1000} s — ${newGameCeremony({ status: st, state }) ?? 'the Help never faded'})`, 'cold-start');
                return;
            }
            const ceremony = newGameCeremony({ status: st, state });
            if (ceremony) c.quietSince = null;
            if (ceremony === 'cutscene') { c.cutscene = true; schedule(step, CEREMONY_POLL_MS); return; }
            if (ceremony === 'tutorial') {
                if (c.dismissedAt !== null) {
                    if (st.game_time - c.dismissedAt > TUTORIAL_FADE_FRAMES) {
                        reArrive(`re-entering level ${goal.level} (${FALLBACK_POLICY}: the freeze outlived the arrow that dismisses `
                            + 'the new game\'s tutorial — it is not that Help)', 'cold-start');
                        return;
                    }
                    schedule(step, CEREMONY_POLL_MS);
                    return;
                }
                if (!pressPairs([TUTORIAL_DISMISS_KEY])) { reArrive(`re-entering level ${goal.level} (${FALLBACK_POLICY}: no canvas to dismiss the tutorial on)`, 'cold-start'); return; }
                c.dismissedAt = st.game_time;
                stats.dismissed.push({ level: goal.level, key: TUTORIAL_DISMISS_KEY, gameTime: st.game_time });
                schedule(step, CEREMONY_POLL_MS);
                return;
            }
            // No ceremony shows: it must stay so for CEREMONY_QUIET_FRAMES (a queued Help surfaces), and a dismissed Help must fade out.
            if (c.quietSince === null) c.quietSince = st.game_time;
            if (st.game_time - c.quietSince < CEREMONY_QUIET_FRAMES
                || (c.dismissedAt !== null && !(st.game_time - c.dismissedAt > TUTORIAL_FADE_FRAMES))) { schedule(step, CEREMONY_POLL_MS); return; }
            const adopted = adoptLive(goal, { ceremonyOver: true });
            if (adopted === true) { c.adopted = true; return; }
            if (adopted?.transient) { awaitAdoption(adopted.transient, { ceremonyOver: true, ceremony: c }); return; }
            reArrive(`re-entering level ${goal.level} to solve from an arrival (${FALLBACK_POLICY}: the new game's room, after `
                + `its ceremony, cannot be adopted: ${adopted})`, 'cold-start');
        };
        schedule(step, CEREMONY_POLL_MS);
    }

    /**
     * ⛓ §5.19 — a cold start refused by a TRANSIENT clause (`adoptRefusalIsTransient`: the fade not over, a
     * begin record not landed) WAITS for it, re-asking every clause each `ADOPT_POLL_MS`: adopted the moment
     * they all pass; a permanent clause refusing meanwhile, or the transient one outliving `ADOPT_WAIT_MS`, is
     * recorded (`adoptRefused`) and the named cold-start re-arrival serves the goal, as before.
     */
    function awaitAdoption(first, { ceremonyOver = false, ceremony = null } = {}) {
        phase = 'adopt-wait';
        deadline = now() + ADOPT_WAIT_MS;
        let last = first;
        note(`waiting to adopt level ${goal.level} (${first.clause}: ${first.why})`);
        const step = () => {
            if (phase !== 'adopt-wait') return;
            const timedOut = now() > deadline;
            const adopted = adoptLive(goal, { ceremonyOver, transient: !timedOut });
            if (adopted === true) { if (ceremony) ceremony.adopted = true; return; }
            if (adopted?.transient) { last = adopted.transient; schedule(step, ADOPT_POLL_MS); return; }
            if (adopted && typeof adopted === 'object') { awaitCeremony(adopted); return; }
            reArrive(`re-entering level ${goal.level} to solve from an arrival (${FALLBACK_POLICY}: the cold start — `
                + `${timedOut ? `the adoption waited ${ADOPT_WAIT_MS / 1000} s on "${last.clause}"` : 'the room changed while the adoption waited'}, `
                + `and it cannot be adopted: ${adopted})`, 'cold-start');
        };
        schedule(step, ADOPT_POLL_MS);
    }

    /** ⛓ W8 — the adoption's freeze latched → the held check + the continuation solve; never latched → failed by name. */
    function adoptLatched() {
        if (phase !== 'adopting') return;
        const st = status();
        if (st?.held) {
            // ⛓ WALK IDENTITY (a) — the held clock is the one the plan's first tick sees: the shadow is put on it.
            let modelTime = null;
            try {
                modelTime = replayTape({ staging: room.staging, perTick: room.shipped.map((h) => new Set(h)), levelSource, scratchPersistence: true }).gameTime;
            } catch { modelTime = null; }
            const clock = adoptedClockStaging({ staging: room.staging, modelTime, liveTime: st.game_time });
            stats.adoptClock.push({ level: room.level, begin: room.staging?.seam?.time ?? null, model: modelTime, live: st.game_time ?? null,
                shift: clock.shift ?? null, refusal: clock.refusal ?? null });
            if (clock.refusal) {
                release();
                reArrive(`re-entering level ${goal.level} to solve from an arrival (${FALLBACK_POLICY}: the adopted room cannot be `
                    + `put on the live clock — ${clock.refusal})`, 'cold-start');
                return;
            }
            room.staging = clock.staging;
            phase = 'held';
            solveInRoom();
            return;
        }
        if (st?.error) { fail(`the adoption's freeze tape errored: ${st.error}`); return; }
        if (now() > deadline) { fail(`the adoption's freeze never latched in level ${goal.level} within ${ARRIVAL_WAIT_MS / 1000} s`); return; }
        schedule(adoptLatched, SOLVE_POLL_MS);
    }

    /**
     * A FORCED RE-ARRIVAL into the goal's room at `spawn` (`FALLBACK_POLICY`;
     * W3's recovery). The baseline is read BEFORE the teleport, so the arrival
     * is the begin record CHANGING (a same-level rebuild included). The caller
     * has released our tape: a `new Game` queued under a hold never lands (W0 i.11).
     * ⛓ W7 — `why` is counted in `stats.forcedBy` (cold-start / recovery / a named fallback).
     */
    function reArrive(why, kind = 'recovery') {
        room = null;
        arriving = false;
        stopWatch();
        baseline = seam().beginEntry ?? null;
        phase = 'await-arrival';
        deadline = now() + ARRIVAL_WAIT_MS;
        stats.forced += 1;
        stats.forcedBy[kind] = (stats.forcedBy[kind] ?? 0) + 1;
        const ok = spawn ? teleport({ level: goal.level, x: spawn.x, y: spawn.y }) : false;
        if (ok === false) { fail('the panel could not queue the forced re-arrival (no teleport recipe, or no spawn recorded)'); return; }
        // ⛓ ARRIVAL JITTER — the room was released for this teleport: it lands without the timer's share.
        pushQueuedNow('re-arrival', goal.level);
        note(why);
        schedule(sample, 0);
    }

    /** The goal's own arrival sampler (a forced re-arrival, or W2's crossing wait). */
    function sample() {
        if (phase !== 'await-arrival') return;
        const se = seam();
        if (isArrival(baseline, se)) {
            baseline = se.beginEntry;
            const sw = holds ? swapState() : null;
            if (se.beginEntry['begin.level'] === goal.level) {
                // ⛓ W7 — the glue query: an arrival the glue is about to redirect is not the room to hold.
                const blocked = sw ? arrivalHoldBlocker(sw, se.beginEntry) : null;
                if (blocked) stats.holdBlocked.push({ level: goal.level, why: blocked });
                else { arrive(se); return; }
            }
            // ⛓ ARRIVAL JITTER — any landing with the glue's teleport still queued (the goal's room or not): push it now.
            if (sw) pushQueuedSwap(sw, se, se.beginEntry['begin.level'], 'sample');
        }
        if (now() > deadline) {
            fail(`no arrival in level ${goal.level} within ${ARRIVAL_WAIT_MS / 1000} s`);
            return;
        }
        schedule(sample, 0);
    }

    // ── ⛓ W7: the arrival watch — every arrival while the bot drives is HELD ──

    const beginTag = (be) => (be ? `${be['begin.level']}@${be['save.time']}` : null);
    function watchRow(at, extra = {}) {
        let live = null;
        try { live = readState().level ?? null; } catch { live = null; }
        stats.arrivalWatch.push({ at, t: Math.round(now()), phase, arriving, base: beginTag(watchBaseline), live, ...extra });
        if (stats.arrivalWatch.length > 64) stats.arrivalWatch.shift();
    }
    function stopWatch() {
        watchToken += 1;
        if (watchTimer) { try { watchTimer.t.clearTimeout(watchTimer.h); } catch { /* gone */ } watchTimer = null; }
    }
    function scheduleWatch(fn, ms) {
        const my = watchToken;
        const t = T();
        watchTimer = { t, h: t.setTimeout(() => { if (my === watchToken) fn(); }, ms) };
    }
    /** Start watching for arrivals from the begin record live NOW (after a `botLoadTape` it reads null). */
    function startWatch(at = null) {
        const prev = watchTimer ? watchBaseline : undefined;
        stopWatch();
        watchBaseline = seam().beginEntry ?? null;
        if (at) watchRow(at, { prev: prev === undefined ? 'idle' : beginTag(prev), swallowed: prev !== undefined && isArrival(prev, { beginEntry: watchBaseline }) });
        scheduleWatch(watchArrivals, 0);
    }

    /**
     * The between-goals sampler, on the game window's 0 ms timer (W0/W1's
     * arrangement): a begin record CHANGE that the glue will not redirect
     * (`arrivalHoldBlocker`) is staged and HELD in the same JS turn — the
     * room stands still until the bot's next goal, and that goal is solved
     * from it without a teleport back. Runs from an exit plan's ship until an
     * arrival is held (or `stop()`); ⛓ a goal awaiting its arrival rides it too.
     */
    function watchArrivals() {
        const se = seam();
        if (isArrival(watchBaseline, se)) {
            if (arriving) watchRow('seen', { landed: beginTag(se.beginEntry) });
            watchBaseline = se.beginEntry;
            const level = se.beginEntry['begin.level'];
            const sw = swapState();
            const blocked = sw ? arrivalHoldBlocker(sw, se.beginEntry) : 'the glue answered no swap state (a redirect cannot be ruled out)';
            if (blocked) {
                stats.holdBlocked.push({ level, why: blocked });
                pushQueuedSwap(sw, se, level);
            } else if (!records.has(level)) stats.holdBlocked.push({ level, why: 'the vanilla map has no such level' });
            else if (holdArrival(se)) return;
        }
        if (phase === 'await-arrival' && now() > deadline) {
            const live = readState();
            if (goal && live.level === goal.level) {
                spawn = { x: live.playerPositionX, y: live.playerPositionY };
                fallback(`no held arrival in level ${goal.level} within ${ARRIVAL_WAIT_MS / 1000} s`, 'no-held-arrival');
            } else fail(`no arrival in level ${goal?.level} within ${ARRIVAL_WAIT_MS / 1000} s`);
            return;
        }
        scheduleWatch(watchArrivals, 0);
    }

    /**
     * ⛓ ARRIVAL JITTER — the door's own arrival, refused because the glue's teleport is still queued: push it in
     * THIS turn (`queuedSwapPush`), so the door's room runs a fixed number of frames, not the adapter timer's
     * wall-clock share, before the swap lands — the swap's arrival then stages the same `Game.time` on every run.
     * Each push is a `swapPushes` row (`late` = the room had already stepped when the watch saw it).
     */
    function pushQueuedSwap(sw, se, level, at = 'door') {
        if (typeof pushSwapNow !== 'function') return;
        const d = queuedSwapPush(sw, se.sinceBegin ?? null, se.beginEntry ?? null);
        if (!d) return;
        let pushed = false;
        try { pushed = pushSwapNow() === true; } catch { pushed = false; }
        stats.swapPushes.push({ level, time: se.beginEntry?.['save.time'] ?? null, late: d.late, pushed, at });
    }

    /**
     * ⛓ ARRIVAL JITTER — a room the engine just LET GO (a release for a swap, `stop()`, the forced re-arrival's
     * own teleport) runs unheld until the queued teleport lands: push it in the turn of the release, so the
     * frames it runs are the game's, not the adapter timer's wall-clock share. `sw` = a swapState read (re-read
     * when absent). A `swapPushes` row per push (`at` = the site).
     */
    function pushQueuedNow(at, level, sw = swapState()) {
        if (typeof pushSwapNow !== 'function' || !sw) return;
        if (!((sw.queued ?? 0) > 0) || (sw.marks ?? []).includes('parked')) return;
        let pushed = false;
        try { pushed = pushSwapNow() === true; } catch { pushed = false; }
        stats.swapPushes.push({ level, time: null, late: false, pushed, at });
    }

    /**
     * ⛓ W7 — HOLD the arrival `se`: stage it (`botStatus` + `readState` in this
     * turn), ship the zero-tick freeze, and keep the staging as `room`. A plan
     * tape still armed (an exit plan whose trailing ticks would play in the new
     * room) is replaced; its held keys are released (W3's pair). Ends the exit
     * leg as done, then serves the goal waiting for this room, if any.
     * Returns false when the arrival cannot be staged exactly (named; the watch goes on).
     */
    function holdArrival(se) {
        const st = status();
        const state = readState();
        const be = se.beginEntry;
        const level = be['begin.level'];
        if (phase === 'await-arrival' && goal && goal.level !== level) {
            stats.holdBlocked.push({ level, why: `not the goal's room (level ${goal.level}) — the bot plans one goal in one room` });
            return false;
        }
        if (!st || st.game_time !== be['save.time']) {
            stats.holdBlocked.push({ level, why: `read after a stepped tick (game_time ${st?.game_time}, begin ${be['save.time']})` });
            return false;
        }
        let staging;
        try {
            ({ staging } = stagingFromWasmArrival({ seam: se, status: st, state, record: records.get(level) ?? null }));
            staging = withApSave(staging);
        } catch (err) { stats.holdBlocked.push({ level, why: err.message }); return false; }
        let freeze;
        try { freeze = shippedTape({ staging, keys: [], hold: true, name: `wasm-hold-${level}` }); } catch (err) {
            stats.holdBlocked.push({ level, why: err.message });
            return false;
        }
        const decl = exactDeclarationRefusal(freeze, st, { granted: apSave() });
        if (decl) { stats.holdBlocked.push({ level, why: `the hold tape was not shipped — ${decl}` }); return false; }
        // The exit plan that crossed: its tape may still be armed (the trailing ticks after the crossing).
        const exitLeg = phase === 'playing' && play?.plan ? play : null;
        const held = exitLeg && st.armed && !st.finished ? keysHeldAtReset({ status: st, solution: exitLeg.plan.solution }) : [];
        if (exitLeg) {
            const d = J(game()?.botDrain?.());
            if (d) exitLeg.progress = foldDrain(exitLeg.progress, d);
        }
        const started = hostStart(freeze, 'freeze');
        if (held.length) releaseKeys(held);
        if (started) { fail(started); return true; }
        stopWatch();
        stats.arrivals += 1;
        stats.held += 1;
        arrivalReads.push({ seam: se, status: st, state });
        if (arrivalReads.length > 8) arrivalReads.shift();
        room = { level, staging, shipped: [], spawn: { x: state.playerPositionX, y: state.playerPositionY }, begin: be,
            pushes: swapState()?.pushes ?? null };
        arriving = false;
        if (exitLeg) {
            // The exit leg is DONE: the crossing reached the glue and its arrival is held.
            const leg = exitLeg;
            const g = goal;
            token += 1;
            cancelTimer();
            play = null;
            goal = null;
            enterHeld();
            const done = { goal: g, producer: leg.plan.producer ?? 'solver', ticks: leg.ticks,
                drained: leg.progress.ticks, verbs: leg.plan.verbs, solvedMs: leg.solvedMs, divergence: leg.divergence, recoveries,
                end: { level, x: st.x, y: st.y }, expectedEnd: leg.plan.expected.at(-1), heldArrival: level,
                // ⛓ MID-ROOM REPLAN — an exit leg ended by its held arrival names its continuation like `finish()` does.
                continuation: leg.continuation ?? false, prefix: leg.prefix ?? 0, ...solvedBy(leg) };
            stats.done += 1;
            history.push({ ...done, outcome: 'done' });
            try { onDone(done); } catch { /* a listener's bug */ }
        } else if (phase !== 'await-arrival') {
            enterHeld();
        }
        if (phase === 'await-arrival' && goal) { spawn = room.spawn; solveInRoom(); return true; }
        note(null);
        if (queued) {
            const q = queued;
            queued = null;
            const r = begin(q.goal);
            if (!r.ok) fail(r.reason);
        }
        return true;
    }

    // ── 3/4: stage, freeze, solve ─────────────────────────────────────────

    /** W2's arrival for the goal (a forced re-arrival's landing, or the walker instrument's flow): hold it, then solve. */
    function arrive(se) {
        if (holds) {
            if (!holdArrival(se)) { fail(`the arrival in level ${goal.level} could not be held: ${stats.holdBlocked.at(-1)?.why}`); }
            return;
        }
        stats.arrivals += 1;
        const st = status();
        const state = readState();
        const be = se.beginEntry;
        if (!st) { fail('botStatus answered nothing at the arrival'); return; }
        arrivalReads.push({ seam: se, status: st, state });
        if (arrivalReads.length > 8) arrivalReads.shift();
        if (st.game_time !== be['save.time']) {
            fail(`the arrival was read after a stepped tick (game_time ${st.game_time}, begin ${be['save.time']}) — `
                + 'the staging would not be the room the game is in');
            return;
        }
        // The arrival's own spawn — what a W3 recovery re-enters at, even if a divergence carried the player out.
        if (Number.isFinite(state.playerPositionX) && Number.isFinite(state.playerPositionY)) {
            spawn = { x: state.playerPositionX, y: state.playerPositionY };
        }
        const record = records.get(goal.level) ?? null;
        let staging;
        try {
            ({ staging } = stagingFromWasmArrival({ seam: se, status: st, state, record }));
            staging = withApSave(staging);
        } catch (err) { fail(err.message); return; }
        let freeze;
        try { freeze = shippedTape({ staging, keys: [], hold: true, name: `wasm-freeze-${goal.level}` }); } catch (err) { fail(err.message); return; }
        const decl = exactDeclarationRefusal(freeze, st, { granted: apSave() });
        if (decl) { fail(`the freeze tape was not shipped — ${decl}`); return; }
        const started = hostStart(freeze, 'freeze');
        if (started) { fail(started); return; }
        // ⛓ the walker INSTRUMENT (`producer: 'walker'`): the goal as the controller resolved it, the same staging.
        const request = { producer: WALK_TAPE_PRODUCER, staging, goal: { ...goal }, name: `wasm-walk-${goal.kind}-${goal.level}`,
            scratchPersistence: true, levelSource, source: { records } };
        startSolve(request, { staging, arrivalStatus: st, continuation: false });
    }

    /**
     * ⛓ W7 — solve the goal in the room our tape HOLDS: from the arrival when
     * nothing was shipped since (W2's solve), else a
     * CONTINUATION (`continuationSolveRequest`: the arrival staging + every key
     * shipped since as S0's prefix), after checking the held game IS the shadow.
     */
    function solveInRoom() {
        const r = room;
        const record = records.get(goal.level) ?? null;
        spawn = r.spawn;
        if (r.shipped.length === 0) {
            const mapped = arrivalSolverGoal(goal, { staging: r.staging, levelSource, record });
            if (!mapped.goal) { fail(`the solver has no goal for ${goal.name ?? goal.kind}: ${mapped.walker}`); return; }
            const request = arrivalSolveRequest({ staging: r.staging, solverGoal: mapped.goal, levelSource, records,
                name: `wasm-${goal.kind}-${goal.level}`, scratchPersistence: true });
            startSolve(request, { staging: r.staging, continuation: false });
            return;
        }
        const st = status();
        let c;
        // ⛓ MID-ROOM REPLAN — a room frozen MID-SPAN continues with a LEAD tick holding exactly the keys the frozen
        // tape held (`room.lead`): the new tape owns them (its DOWN on a held key is no edge) and its own span
        // releases them, so the solve starts from the shadow one tick later. The held check reads the shadow BEFORE it.
        const lead = r.lead ?? [];
        let heldRow = null;
        try {
            c = continuationSolveRequest({ staging: r.staging, shipped: [...r.shipped, ...lead], goal, levelSource, records, record,
                name: `wasm-continue-${goal.kind}-${goal.level}`, equips: roomEquips(r) });
            if (lead.length) {
                const before = replayTape({ staging: r.staging, perTick: r.shipped.map((h) => new Set(h)), levelSource, scratchPersistence: true,
                    equips: roomEquips(r) });
                heldRow = { level: before.level, x: before.state.x, y: before.state.y, deaths: before.playerDeaths.length, primary: before.primary };
            }
        } catch (err) {
            contFallback(`the continuation could not be built: ${String(err?.message ?? err).split('\n')[0]}`, 'continuation-error');
            return;
        }
        const mismatch = shadowMismatch(heldRow ?? c.shadowRow, st);
        stats.heldChecks.push({ level: r.level, shipped: r.shipped.length, shadow: heldRow ?? c.shadowRow, game: st && { level: st.level, x: st.x, y: st.y },
            held: st?.held ?? null, frozen: st?.frozen ?? null, equal: !mismatch });
        if (mismatch) {
            // ⛔ The plan's STOP condition: the held game is not the shadow — a staging bug, named, never solved past.
            log(`[wasm playback] the HELD game is not the shadow in level ${r.level} after ${r.shipped.length} shipped tick(s): `
                + `shadow ${JSON.stringify(mismatch.expected)}, game ${JSON.stringify(mismatch.got)}`, 'warn');
            fallback(`the held game is not the shadow (shadow ${JSON.stringify(mismatch.expected)}, game ${JSON.stringify(mismatch.got)})`,
                'shadow-mismatch');
            return;
        }
        if (c.refusal) { contFallback(c.refusal, 'continuation-refused'); return; }
        stats.continuations += 1;
        startSolve(c.request, { staging: r.staging, continuation: true, prefix: r.shipped.length, lead, heldRow });
    }

    /**
     * ⛓ ANYTIME — how a leg's plan was made, for its history row: the PASS (`dashless` / `full`; null for
     * the walker producer), whether a later pass was cut at the budget (`expired`), the held
     * retries spent, and every budget the solve ran under.
     */
    function solvedBy(p) {
        return { pass: p.pass ?? null, expired: p.expired === true, retries: p.retries ?? 0, budgets: p.budgets ? [...p.budgets] : [],
            passes: p.plan?.passes ?? null,
            // ⛓ SHOULD-STOP — the plan's own pass stopped at its deadline (`{tripped, first, sites}`), else null
            deadline: p.plan?.deadline ?? null };
    }

    function startSolve(request, playInit) {
        stats.solves += 1;
        const budget = baseBudget();
        // ⛓ ANYTIME — a solver request carries its passes (a held retry sends the ones not yet answered).
        // ⛓ SHOULD-STOP — and the deadlines its passes run under (`passShouldStop`).
        const req = request.producer ? request
            : { ...request, passes: request.passes ?? ANYTIME_PASSES, budgetWork: budget, upgradeWindowWork: upgradeWindow() };
        play = { ...playInit, t0: now(), request: req, budget, budgets: [budget], retries: 0, best: null };
        handle = svc().start(req);
        phase = 'solving';
        note(`${walkerInstrument ? 'walking a tape' : playInit.continuation ? 'solving on from the held room' : 'solving'}… `
            + `(budget ${budget} work units)`);
        schedule(pollSolve, SOLVE_POLL_MS);
    }

    /**
     * ⛓ O2 — the HELD RETRY: the freeze (or the held end) still holds the room, so the same
     * staging is asked again with `SOLVE_RETRY_BUDGET_FACTOR`× the budget, resuming at the first
     * pass that had not answered. What a pass answered before the cut is kept (`play.best`).
     */
    function retrySolve(cut) {
        stats.retries += 1;
        play.retries += 1;
        if (betterAnswer(play.best, cut.provisional)) play.best = cut.provisional;
        const budget = play.budget * SOLVE_RETRY_BUDGET_FACTOR;
        // ⛓ SHOULD-STOP — the retry's passes run under the RETRY's budget (a dashless pass cut by its deadline
        // was not answered: `answered` leaves it in, so it runs again with 4× the time).
        const req = play.request.producer ? play.request
            : { ...play.request, passes: passesAfter(play.request.passes, cut.answered), budgetWork: budget };
        if (!req.producer && req.passes.length === 0) return false;
        play.request = req;
        play.budget = budget;
        play.budgets.push(play.budget);
        play.t0 = now();
        handle = svc().start(req);
        log(`[wasm playback] ${goal.name ?? goal.kind}: the solver ran out of ${play.budgets.at(-2)} work units in level ${goal.level} `
            + `— asking again with ${play.budget}, the room held (retry ${play.retries})`, 'warn');
        note(`solving again, the room held… (budget ${play.budget} work units, retry ${play.retries})`);
        schedule(pollSolve, SOLVE_POLL_MS);
        return true;
    }

    /**
     * ⛓ W7 — a continuation that cannot be served (declined, out of budget, the
     * X-split rule, a shadow mismatch, …) falls back to W2's FORCED RE-ARRIVAL,
     * named in the history — never a failure on its own.
     */
    function fallback(why, kind) {
        const r = room;
        stats.fallbacks.push({ goal: goal?.name ?? goal?.kind, kind, why });
        history.push({ goal, outcome: 'fallback', kind, reason: why, shipped: r?.shipped.length ?? null });
        log(`[wasm playback] ${goal?.name ?? goal?.kind}: ${why} — falling back to a forced re-arrival`, 'warn');
        if (r?.spawn) spawn = r.spawn;
        const g = goal;
        const keepQueued = queued;
        release();
        reset();
        goal = g;
        queued = keepQueued;
        reArrive(`re-entering level ${g.level} (${FALLBACK_POLICY}: ${why})`, kind);
    }

    /**
     * ⛓ MID-ROOM REPLAN — a continuation that cannot be served while a delivery froze the tape: the INTERRUPTED
     * plan resumes (`botHold("off")`, the same tape, no seam) when the model, with the items staged, still plays it
     * exactly (`deliveryRefusal` over the whole plan); otherwise W7's fallback, by name.
     */
    function contFallback(why, kind) {
        if (frozen && resumeFrozen(why)) return;
        fallback(why, kind);
    }

    function resumeFrozen(why) {
        const f = frozen;
        const g = game();
        const full = [...f.shippedBefore];
        const refusal = deliveryRefusal({ staging: f.stagingBefore, shipped: full, items: f.items, status: f.statusAt, levelSource,
            equips: equipsMap(f.equipsBefore) });
        if (refusal) {
            log(`[wasm playback] the interrupted plan cannot resume with the delivered item (${refusal.clause}: ${refusal.why})`, 'warn');
            return false;
        }
        try { if (g?.botHold?.('off') !== 'ok') return false; } catch { return false; }
        token += 1;
        cancelTimer();
        if (handle && !handle.settled) handle.cancel();
        handle = null;
        room.shipped = f.shippedBefore;
        room.equips = f.equipsBefore;
        room.lead = null;
        room.slotLag = null;
        play = f.leg;
        frozen = null;
        const row = stats.deliveries.at(-1);
        if (row && row.outcome === 'replanning') { row.outcome = 'resumed'; row.freezeMs = Math.round(now() - f.at); row.why = why; }
        history.push({ goal, outcome: 'resumed', why });
        log(`[wasm playback] ${goal?.name ?? goal?.kind}: ${why} — the interrupted plan resumes (the delivered item changes none of its ticks)`, 'warn');
        phase = 'playing';
        note(`playing tick ${play.progress.ticks}/${play.ticks} (resumed after an item delivery)`);
        if (glueQuery && !play.hold) { arriving = true; startWatch(); }
        schedule(watch, DRAIN_MS);
        return true;
    }

    function pollSolve() {
        if (phase !== 'solving') return;
        const t = now();
        // ⛓ W7 — the glue asked for a swap while we hold (a redirect that raced the hold): let it land.
        if (holds && room && releaseForSwap()) return;
        if (!handle.settled) {
            // ⛓ DETERMINISTIC BUDGET — the engine WAITS for the worker's answer (its budget is work, counted in the
            // worker). The wall clock is only a BACKSTOP: past it the goal FAILS by name, and whatever a pass had
            // already found is NOT played — a machine that is too slow ends the walk, it never changes the plan.
            const why = !handle.started && t - play.t0 > LOAD_BUDGET_MS
                ? `the solver did not start within the ${LOAD_BUDGET_MS / 1000} s load backstop on this machine on ${goal.kind} in level ${goal.level} (terminated)`
                : handle.started && t - (handle.startedAt ?? play.t0) > backstopMs
                    ? `the solve exceeded the backstop on this machine (${secs(backstopMs)}) on ${goal.kind} in level ${goal.level} `
                        + `(terminated; the solve's own budget is ${play.budget} work units)`
                    : null;
            if (!why) {
                schedule(pollSolve, SOLVE_POLL_MS);
                return;
            }
            handle.cancel();
            stats.backstops += 1;
            fail(why);
            return;
        }
        let res = handle.result;
        // ⛓ DETERMINISTIC BUDGET / O2 — the cut is the ANSWER's (a pass cut at the work budget), never the clock's.
        if (!play.request.producer && budgetCut(res)) {
            stats.expiries += 1;
            const cut = { provisional: res, answered: handle.answered ?? 0, passes: handle.passes ?? [] };
            const unanswered = (handle.answered ?? 0) < (play.request.passes?.length ?? 0);
            const action = expiryAction({ provisional: res, retries: play.retries, unanswered });
            if (action === 'retry' && retrySolve(cut)) return;
            if (action === 'provisional') {
                stats.provisionalPlays += 1;
                play.expired = true;
                log(`[wasm playback] ${goal.name ?? goal.kind}: a later pass ran out of ${play.budget} work units in level ${goal.level} `
                    + `— playing the ${res.pass} pass's plan`, 'warn');
            } else {
                const refusal = betterAnswer(play.best, res) ? res : play.best;
                const why = expiryFailure({ goal, budgets: play.budgets, refusal });
                if (play.continuation) { contFallback(why, 'continuation-budget'); return; }
                fail(why);
                return;
            }
        }
        // ⛓ O2 — a retry's answer against what the cut attempt's passes had answered.
        if (play.best && !betterAnswer(play.best, res)) res = play.best;
        if (!res?.ok) {
            const why = `the ${walkerInstrument ? 'walker producer' : 'solver'} declined ${goal.name ?? goal.kind} in level ${goal.level} `
                + `(${res?.kind}): ${res?.message}`;
            if (play.continuation) { contFallback(why, 'continuation-declined'); return; }
            // ⛓ WAVE-6 CONSUMER — the refusal's `obstacle` (an `arrival-inside-solid` and its `wayOut`) goes with
            // the failure, as data, so the host reads the NAME and the way out rather than the words.
            fail(why, res?.obstacle ? { obstacle: res.obstacle } : null);
            return;
        }
        play.plan = res.plan;
        play.solvedMs = Math.round(t - play.t0);
        // ⛓ ANYTIME — which pass made the plan (a walker producer has none).
        play.pass = res.plan.pass ?? null;
        if (play.pass) stats.passes[play.pass] = (stats.passes[play.pass] ?? 0) + 1;
        ship();
    }

    /**
     * ⛓ W7 — while a room is HELD: a swap the glue asked for after the hold
     * (its redirect raced the arrival read) would never land under the hold
     * (W0 i.11). Release, drop the room, and watch for the swap's own arrival.
     */
    function releaseForSwap() {
        const sw = swapState();
        // A swap asked for SINCE the hold: a mark, a queued teleport, or a push after it (after the hold's
        // `botLoadTape` the begin record reads null, so the push COUNT is what can see it).
        const pushedSince = Number.isInteger(sw?.pushes) && Number.isInteger(room?.pushes) && sw.pushes > room.pushes;
        if (!sw || !((sw.queued ?? 0) > 0 || sw.marks?.length || pushedSince)) return false;
        stats.releasedForSwap += 1;
        log(`[wasm playback] the glue asked for a world swap while level ${room.level} was held — released so it can land`, 'warn');
        const g = goal;
        const keepQueued = queued;
        const heldLevel = room?.level ?? null;
        release();
        // ⛓ ARRIVAL JITTER — the released room runs unheld until the swap lands: push it in THIS turn.
        pushQueuedNow('release', heldLevel, sw);
        reset();
        goal = g;
        queued = keepQueued;
        arriving = true;
        if (g) { phase = 'await-arrival'; deadline = now() + ARRIVAL_WAIT_MS; }
        startWatch();
        return true;
    }

    // ── 5: ship ───────────────────────────────────────────────────────────

    function ship() {
        const st = status();
        // ⛓ MID-ROOM REPLAN — a tape frozen mid-span for a delivery IS the held room (armed, `frozen`).
        const isFrozen = !!(frozen && st?.frozen);
        if (st?.armed && !st?.finished && !isFrozen) {
            // The solve beat the fade: the freeze tape has not latched yet. Wait for it.
            schedule(ship, DRAIN_MS);
            return;
        }
        if (!st?.held && !isFrozen) {
            fail('the room was not held when the plan was ready — the freeze tape did not latch (it is the only '
                + 'thing that keeps the game where the solve started)');
            return;
        }
        // ⛓ MID-ROOM REPLAN — the lead tick (`solveInRoom`) goes first, its row the held one.
        const lead = play.lead ?? [];
        if (lead.length && !play.leadShipped) {
            const shift = (m) => new Map([...(m ?? [])].map(([t, v]) => [t + lead.length, v]));
            // ⛓ WASM EQUIPS — the plan's slot selections move with its ticks (the tape's t counts the lead tick).
            play.plan = { ...play.plan, solution: [...lead.map((h) => new Set(h)), ...play.plan.solution], expected: [play.heldRow, ...play.plan.expected],
                equipsAt: shift(play.plan.equipsAt), equipItems: shift(play.plan.equipItems) };
            play.leadShipped = true;
        }
        const { plan } = play;
        const { staging } = play;
        // ⛓ W7 — the X-split rule: a continuation may not open with a re-press of an X the last tape held.
        // ⛓ A frozen tape's keys are NOT released at the seam (the lead tick keeps them): no re-press to refuse.
        const split = play.continuation && !isFrozen ? primarySplitRefusal(room?.shipped, plan.solution) : null;
        if (split) { fallback(split, 'x-split'); return; }
        // ⛓ MID-ROOM REPLAN — a slot item delivered into this room reaches `useItem` one frame late.
        const lag = room?.slotLag ? firstTickSlotRefusal({ ...room.slotLag, solution: [pressesOf(plan.solution[0], room.slotLag.held)] }) : null;
        if (lag) { fallback(lag, 'delivery-first-tick'); return; }
        // ⛓ W8b — adopted inside a talk circle: no X until the plan has left it.
        const talk = room?.talkCircles?.length ? talkCircleGuard({ circles: room.talkCircles, solution: plan.solution, expected: plan.expected }) : null;
        if (talk?.refusal) { fallback(talk.refusal, 'adopt-talk'); return; }
        // ⛓ WASM EQUIPS — a selection of a slot the game will not hold is refused BY NAME, before anything ships.
        // (⛓ SLOTS CONSUMER: the ORDER needs no check — the staging carries the game's array and the solver indexes it.)
        const slotWhy = equipSlotRefusal({ equipsAt: plan.equipsAt, equipItems: plan.equipItems, slots: st?.inventory_slots ?? [] });
        if (slotWhy) { fail(`the plan tape was not shipped — ${slotWhy}`); return; }
        const equips = tapeEquips(plan.equipsAt);
        const hold = holds && endsHeld(goal);
        let tape;
        try {
            tape = shippedTape({ staging: play.continuation ? liveDeclarations(staging, st, { granted: apSave() }) : staging, keys: plan.solution, hold, equips,
                name: `wasm-${play.continuation ? 'continue-' : ''}${goal.kind}-${goal.level}` });
        } catch (err) { fail(err.message); return; }
        const decl = exactDeclarationRefusal(tape, st, { granted: apSave() });
        if (decl) { fail(`the plan tape was not shipped — ${decl}`); return; }
        const started = hostStart(tape, play.continuation ? 'continuation' : 'plan');
        if (started) { fail(started); return; }
        // ⛓ ARRIVAL JITTER — the game's clock at the ship against the staged one + the ticks the shadow replays
        // (`gap` ≠ 0 = frames ran in the room between its staging read and this plan that no tape accounts for).
        const stagedTime = staging?.seam?.time ?? null;
        const prefixTicks = play.continuation ? (play.prefix ?? 0) : 0;
        stats.shipClock.push({ name: tape.name, level: goal.level, staged: stagedTime, prefix: prefixTicks, game: st?.game_time ?? null,
            gap: Number.isFinite(stagedTime) && Number.isFinite(st?.game_time) ? st.game_time - stagedTime - prefixTicks : null });
        // ⛓ MID-ROOM REPLAN — the frozen tape is replaced (`botLoadTape` disarms it, `botStart` lifts the freeze).
        if (frozen) {
            const row = stats.deliveries.at(-1);
            if (row && row.outcome === 'replanning') {
                row.outcome = 'replanned';
                row.freezeMs = Math.round(now() - frozen.at);
                row.replanMs = play.solvedMs ?? null;
                row.ticks = plan.solution.length;
                row.lead = lead.map((h) => [...h]);
            }
            frozen = null;
        } else if (room?.slotLag) {
            const row = stats.deliveries.at(-1);
            if (row && row.outcome === 'replanning') { row.outcome = 'replanned'; row.replanMs = play.solvedMs ?? null; row.ticks = plan.solution.length; }
        }
        if (room) room.slotLag = null;
        stats.ships += 1;
        play.ticks = plan.solution.length;
        play.hold = hold;
        play.equips = equips;
        play.progress = foldDrain(null, null);
        play.divergence = null;
        play.lastStatusAt = 0;
        phase = 'playing';
        if (room) {
            room.lead = null;
            // ⛓ WASM EQUIPS — indexed by the room's shipped ticks, as the shadow replays them.
            room.equips = [...(room.equips ?? []), ...tapeEquips(plan.equipsAt, room.shipped.length)];
            room.shipped = [...room.shipped, ...plan.solution.map((h) => [...h])];
            room.plans = (room.plans ?? 0) + 1;
            if (talk?.left) room.talkCircles = [];
        }
        note(`playing ${play.ticks} ticks (${(plan.verbs ?? []).join(',') || 'walk'}`
            + `${play.pass ? `; ${play.pass} pass${play.expired ? ', the later pass ran out of budget' : ''}` : ''}`
            // ⛓ SHOULD-STOP — a pass whose deadline tripped, by name (the site that tripped first)
            + `${(plan.passes ?? []).filter((r) => r.deadline).map((r) => `; ${r.pass} stopped at its deadline (${r.deadline})`).join('')})`);
        // ⛓ W7 — an exit plan's crossing: hold the arrival it leads to (the glue's redirect landing, if any).
        if (glueQuery && !hold) { arriving = true; startWatch(); }
        schedule(watch, DRAIN_MS);
    }

    // ── 6: watch ──────────────────────────────────────────────────────────

    function watch() {
        if (phase !== 'playing') return;
        const d = J(game()?.botDrain?.());
        if (d) play.progress = foldDrain(play.progress, d);
        if (!play.divergence) {
            play.divergence = firstDivergence(play.plan.expected, play.progress.rows, { roomLevel: goal.level });
            if (play.divergence) {
                stats.divergences += 1;
                log(`[wasm playback] the game left the plan at tick ${play.divergence.t}: expected `
                    + `${JSON.stringify(play.divergence.expected)}, game ${JSON.stringify(play.divergence.got)}`, 'warn');
                diverged();
                return;
            }
        }
        const k = Math.min(play.progress.ticks, play.ticks);
        note(`playing tick ${k}/${play.ticks}`);
        const t = now();
        if (play.progress.ticks >= play.ticks && t - play.lastStatusAt >= STATUS_MS) {
            play.lastStatusAt = t;
            const st = status();
            if (st?.error) { fail(`the game's tape errored: ${st.error}`); return; }
            if (st?.finished && !st?.armed && (!play.hold || st.held)) { finish(st); return; }
        }
        if (queued && t - queued.since > QUEUE_WAIT_MS) {
            const q = queued;
            queued = null;
            fail(`the queued goal ${q.goal.name ?? q.goal.kind} waited ${QUEUE_WAIT_MS / 1000} s for the playing tape`);
            return;
        }
        schedule(watch, DRAIN_MS);
    }

    /** W3 — act on `play.divergence` (`divergenceAction`): done, a recovery, or the named failure. */
    function diverged() {
        const d = play.divergence;
        const st = status();
        const action = divergenceAction({ goal, recoveries, status: st, divergence: d, previous: lastDivergence });
        lastDivergence = d;
        if (action === 'done') {
            log(`[wasm playback] ${goal.name ?? goal.kind}: its clear already landed — done despite the divergence`, 'warn');
            release(st); // the tape is still armed; the room is the player's again
            finish(st ?? {});
            return;
        }
        if (action === 'fail') { fail(divergenceFailure({ goal, recoveries, divergence: d })); return; }
        if (action === 'repeat') { fail(divergenceRepeatFailure({ goal, recoveries, divergence: d })); return; }
        recoveries += 1;
        stats.recoveries += 1;
        history.push({ goal, outcome: 'diverged', producer: play.plan.producer ?? 'solver', recovery: recoveries, ticks: play.ticks, drained: play.progress.ticks,
            verbs: play.plan.verbs ?? null, solvedMs: play.solvedMs, divergence: d, input: st?.input ?? null,
            continuation: play.continuation ?? false, equips: play.equips ?? [] });
        const queuedGoal = queued;
        // The spawn the room's ARRIVAL recorded (W3), whatever the divergence carried the player to.
        if (room?.spawn) spawn = room.spawn;
        release(st);
        reset();
        queued = queuedGoal; // a goal waiting on this tape keeps waiting for the recovered one
        reArrive(`left the plan at tick ${d.t} — recovery ${recoveries}/${MAX_RECOVERIES}: re-entering level ${goal.level} to re-solve`, 'recovery');
    }

    function finish(st) {
        const done = { goal, producer: play.plan.producer ?? 'solver', ticks: play.ticks, drained: play.progress.ticks, verbs: play.plan.verbs,
            solvedMs: play.solvedMs, divergence: play.divergence, recoveries, end: { level: st.level, x: st.x, y: st.y },
            expectedEnd: play.plan.expected.at(-1), continuation: play.continuation ?? false, prefix: play.prefix ?? 0, heldEnd: !!(play.hold && st.held),
            // ⛓ WASM EQUIPS — the slot selections the tape shipped (`[{t, slot}]`, its own ticks)
            equips: play.equips ?? [], ...solvedBy(play) };
        const heldEnd = done.heldEnd && room !== null;
        if (!heldEnd) {
            ours = false; // finished and un-held: nothing of ours is armed
            room = null;
        }
        reset();
        goal = null;
        if (heldEnd) enterHeld();
        stats.done += 1;
        history.push({ ...done, outcome: 'done' });
        note(null);
        try { onDone(done); } catch { /* a listener's bug */ }
        if (queued) {
            const q = queued;
            queued = null;
            const r = begin(q.goal);
            if (!r.ok) fail(r.reason);
        }
    }

    /** ⛓ W7 — the room is HELD and no goal runs: the guard below watches the glue meanwhile. */
    function enterHeld() {
        phase = 'held';
        schedule(heldGuard, DRAIN_MS);
    }

    /** ⛓ W7 — a HELD room with no goal: watch the glue (a raced redirect is let through). */
    function heldGuard() {
        if (phase !== 'held') return;
        if (releaseForSwap()) return;
        schedule(heldGuard, DRAIN_MS);
    }


    // ── ⛓ MID-ROOM REPLAN: the delivery gate ─────────────────────────────

    /** The keys a tick PRESSES (an edge): those it holds that were not held going in. */
    function pressesOf(keys, held = []) {
        const h = new Set(held);
        return [...(keys ?? [])].filter((k) => !h.has(k));
    }

    function delivery() { try { return getDelivery?.() ?? null; } catch { return null; } }

    /**
     * ⛓ KEY DELIVERY — the save arrays AP has let through to the game (`{keys: [...]}`): what the panel's
     * writes for the ADMITTED inventory declare (`save_array`, `games/seedling.json`'s method-call keys).
     * A delivery the gate still holds is not in it. No delivery handle (an engine built without one: a test, the walker instrument) = none.
     */
    function apSave() {
        const d = delivery();
        if (typeof d?.writesOf !== 'function') return {};
        let inv = gate?.admitted ?? null;
        if (!inv) { try { inv = d.inventory?.() ?? null; } catch { inv = null; } }
        if (!inv) return {};
        try { return saveArraysOfWrites(d.writesOf(inv)); } catch { return {}; }
    }
    /**
     * Every staging the engine takes (arrival, hold, adoption) carries the AP-held keys (`SAVE_ARRAY_MERGE`,
     * union): its tape boot then hands them to the game, and the model sees what the game will hold.
     */
    const withApSave = (staging) => stageSaveArrays(staging, apSave());

    /**
     * Install the gate on the panel adapter (once per drive): the inventory as it stands is admitted; from now
     * on a delivery the game would SEE is held back (`gateFilter`) until `deliveryStep` finds a safe point.
     */
    function engageGate() {
        if (!holds || gate) return;
        const d = delivery();
        if (typeof d?.setItemGate !== 'function') return;
        let inv = null;
        try { inv = d.inventory?.() ?? null; } catch { inv = null; }
        gate = { handle: d, admitted: inv ? { ...inv } : null, pending: null, since: null, deferred: null, waiting: null };
        d.setItemGate(gateFilter);
    }

    /** Remove the gate (the bot stopped): the adapter's next push writes the inventory as it stands, as before. */
    function disengageGate() {
        const g = gate;
        gate = null;
        stopDelivery();
        landing = null;
        try { g?.handle?.setItemGate?.(null); } catch { /* the panel is gone */ }
    }

    // (⛓ KEY DELIVERY: a key's method-call write has no property; the held inventory is a sub-multiset of the
    // live one, so a key it holds back still SHORTENS the list — visible without naming the call.)
    const sameWrites = (d, a, b) => {
        const key = (inv) => JSON.stringify((d.writesOf(inv) ?? []).map((w) => [w.property, w.value]).sort());
        return key(a) === key(b);
    };

    /**
     * The gate itself — the adapter calls it on every push with the live inventory and writes what it returns.
     * A change the game cannot see (a totem shard, a Seal, nothing: no write differs) is admitted at once; one it can
     * see (⛓ KEY DELIVERY: a key's `hasKeySet` call included) is held
     * back (what was admitted, with any count that FELL passed through) and `deliveryStep` is started.
     */
    function gateFilter(live) {
        const g = gate;
        if (!g) return live;
        if (!g.admitted) { g.admitted = { ...live }; return live; }
        const held = {};
        for (const [k, v] of Object.entries(live)) held[k] = Math.min(v || 0, g.admitted[k] || 0);
        let visible = true;
        try { visible = !sameWrites(g.handle, live, held); } catch { visible = true; }
        if (!visible) { g.admitted = { ...live }; g.pending = null; return live; }
        if (!g.pending || JSON.stringify(g.pending) !== JSON.stringify(live)) {
            if (!g.pending) { g.since = now(); stats.gateHeld += 1; }
            g.pending = { ...live };
            kickDelivery();
        }
        return held;
    }

    function stopDelivery() {
        deliveryToken += 1;
        if (deliveryTimer) { try { deliveryTimer.t.clearTimeout(deliveryTimer.h); } catch { /* gone */ } deliveryTimer = null; }
    }
    function scheduleDelivery(fn, ms) {
        const my = deliveryToken;
        const t = T();
        deliveryTimer = { t, h: t.setTimeout(() => { if (my === deliveryToken) fn(); }, ms) };
    }
    function kickDelivery() { if (!deliveryTimer && !landing) scheduleDelivery(deliveryStep, 0); }
    const later = () => scheduleDelivery(deliveryStep, DRAIN_MS);

    /**
     * Where is the next SAFE POINT for the held delivery? A tape playing in a room we staged → freeze it NOW
     * (`botHold("on")`); a room we hold (between goals, or a solve in flight) → at once; anything else (a
     * crossing, an adoption, a re-arrival, a ceremony) → wait: the room the next arrival holds is staged
     * from the game as it is then.
     */
    function deliveryStep() {
        deliveryTimer = null;
        const g = gate;
        if (!g?.pending || landing) return;
        if (g.deferred && g.deferred.room === room && room) { later(); return; }
        if (g.deferred) g.deferred = null;
        if (room && phase === 'playing' && play?.plan) { freezeAndDeliver(); return; }
        if (room && (phase === 'held' || phase === 'solving')) { deliverHeld(); return; }
        later();
    }

    /** The items the held delivery would write, over the game's live readout. */
    function predicted(st) {
        return itemsAfterWrites(st?.items ?? {}, gate.handle.writesOf(gate.pending) ?? []);
    }
    /** ⛓ KEY DELIVERY — the save arrays after the held delivery: the game's ∪ AP's admitted ∪ the pending ones. */
    function predictedSave(st) {
        return mergeSaveArrays(liveSaveArrays(st), apSave(), saveArraysOfWrites(gate.handle.writesOf(gate.pending) ?? []));
    }

    /** A delivery the model cannot take mid-run waits out the room (`DELIVERY_FALLBACK`): the next arrival stages it. */
    function deferDelivery(refusal, at) {
        gate.deferred = { room, ...refusal };
        stats.deliveryDeferred.push({ level: room?.level ?? null, at, clause: refusal.clause, why: refusal.why });
        log(`[wasm playback] an item delivery waits for the room's end (${DELIVERY_FALLBACK}) — ${refusal.clause}: ${refusal.why}`, 'warn');
        later();
    }

    /** Let the held delivery through and wait for the game to show it; `then()` runs once it has. */
    function admit(items, row, then, save = {}) {
        const g = gate;
        g.admitted = { ...g.pending };
        g.pending = null;
        g.deferred = null;
        g.waiting = null;
        landing = { items, save, since: now(), row, then };
        try { g.handle.push?.(); } catch { /* the next tick pushes it */ }
        scheduleDelivery(awaitLanded, 0);
    }

    function awaitLanded() {
        deliveryTimer = null;
        const l = landing;
        if (!l) return;
        const st = status();
        if (st && itemDelta(st.items, l.items).length === 0 && saveDelta(liveSaveArrays(st), l.save).length === 0) {
            l.row.landMs = Math.round(now() - l.since);
            landing = null;
            l.then(st);
            if (gate?.pending) kickDelivery();
            return;
        }
        if (now() - l.since > DELIVERY_LAND_MS) {
            landing = null;
            l.row.outcome = 'unlanded';
            const missing = [...itemDelta(st?.items, l.items).map((d) => d.property),
                ...saveDelta(liveSaveArrays(st), l.save).map((k) => `save.${k.array}[${k.index}]`)];
            fail(`an item delivery did not show in the game within ${DELIVERY_LAND_MS / 1000} s (${missing.join(', ')})`);
            return;
        }
        scheduleDelivery(awaitLanded, DELIVERY_POLL_MS);
    }

    /**
     * A plan tape is PLAYING: freeze it at the frame boundary (`botHold("on")`), ask the model whether it can take
     * the items from this room's arrival (`deliveryRefusal`, with the PREDICTED items, before any write), then
     * write them and replan the goal as a continuation from the frozen tick. A refusal (or a moment that is not
     * mid-room: a dead frame, a crossing, the tape's own end) lets the tape go on untouched.
     */
    function freezeAndDeliver() {
        const g = game();
        if (typeof g?.botHold !== 'function') { deferDelivery({ clause: 'no-freeze', why: 'this build has no botHold' }, 'playing'); return; }
        const wait = (why) => {
            if (gate.waiting !== why) { gate.waiting = why; log(`[wasm playback] an item delivery waits: ${why}`); }
            later();
        };
        // ⛓ SERVED LOCATION — the goal's own check already fired (its flag is in the game's cleared set: a Boss Key
        // location's key lands AT contact). Nothing is left to replan, so nothing is frozen: the tape plays on to
        // its end and the goal is done; the delivery lands in the room that end holds (`deliverHeld`). Freezing here
        // re-solved a goal whose apitem was gone ("resolves to NOTHING").
        const pre = status();
        if (locationGoalServed(goal, pre)) {
            const why = `${goal.name ?? goal.kind} is served (its check fired) — the delivery lands after its tape ends`;
            if (gate.waiting !== why) stats.deliveryServed.push({ level: room.level, goal: goal.name ?? goal.kind, tick: pre.tick ?? null });
            wait(why);
            return;
        }
        // Cheap reads first: a dead frame (a seal / dialogue freeze) or a crossing within reach is not mid-room.
        if (readState().freezeObjects === true) { wait('the game is in a freeze (dead frames)'); return; }
        const near = play.progress?.ticks ?? 0;
        if (play.plan.expected.slice(0, near + 4).some((r) => r.level !== room.level)) { wait('a crossing is in flight'); return; }
        const t0 = now();
        if (g.botHold('on') !== 'ok') { deferDelivery({ clause: 'no-freeze', why: 'botHold("on") refused' }, 'playing'); return; }
        const st = status();
        const resume = (why) => { try { g.botHold('off'); } catch { /* gone */ } wait(why); };
        if (!st?.frozen || !st.armed || st.finished) { resume('the tape is not mid-span'); return; }
        const d = J(g.botDrain?.());
        if (d) play.progress = foldDrain(play.progress, d);
        const k = st.tick;
        const plan = play.plan;
        if (!Number.isInteger(k) || k > plan.solution.length || play.progress.ticks !== k) { resume(`the drained rows (${play.progress.ticks}) are not the tape's tick (${k})`); return; }
        if (firstDivergence(plan.expected, play.progress.rows, { roomLevel: goal.level })) { resume('the tape already left the plan'); return; }
        if (readState().freezeObjects === true) { resume('the game is in a freeze (dead frames)'); return; }
        if (st.level !== room.level || plan.expected.slice(0, k + 2).some((r) => r.level !== room.level)) { resume('a crossing is in flight'); return; }
        const items = predicted(st);
        const save = predictedSave(st);
        // `room.shipped` already holds this whole plan (`ship()` appends it): the prefix is what came before it + its first k.
        const prefix = [...room.shipped.slice(0, room.shipped.length - plan.solution.length), ...plan.solution.slice(0, k).map((h) => [...h])];
        // ⛓ WASM EQUIPS — the selections the prefix made (an equip AT the frozen tick has not fired: the game drained k ticks).
        const prefixEquips = (room.equips ?? []).filter((e) => e.t < prefix.length);
        const refusal = deliveryRefusal({ staging: room.staging, shipped: prefix, items, save, status: st, levelSource, equips: equipsMap(prefixEquips) });
        if (refusal) { try { g.botHold('off'); } catch { /* gone */ } deferDelivery(refusal, 'playing'); return; }
        const heldKeys = keysHeldAtReset({ status: st, solution: plan.solution });
        const leg = play;
        // What a resume needs (`resumeFrozen`): the room as it stood, the interrupted leg, the freeze-time readout.
        frozen = { tick: k, solution: plan.solution, heldKeys, at: t0, leg, items, statusAt: st,
            stagingBefore: room.staging, shippedBefore: room.shipped, equipsBefore: room.equips ?? [] };
        const post = slotsAfterDelivery({ slots: st.inventory_slots ?? [], primary: st.primary, secondary: st.secondary }, items);
        const added = deliveredSaveArrays({ staging: room.staging, status: st, save });
        const row = { level: room.level, goal: goal?.name ?? goal?.kind, phase: 'playing', tick: k, of: plan.solution.length,
            items: itemDelta(st.items, items), save: saveDelta(liveSaveArrays(st), save), heldKeys, outcome: 'replanning', policy: DELIVERY_POLICY };
        stats.deliveries.push(row);
        // The interrupted leg: its tape stops at k (frozen); the goal is served by the continuation.
        token += 1;
        cancelTimer();
        stopWatch();
        history.push({ goal, outcome: 'interrupted', why: 'item delivery', producer: leg.plan.producer ?? 'solver', ticks: leg.ticks,
            drained: k, continuation: leg.continuation ?? false, prefix: leg.prefix ?? 0, ...solvedBy(leg) });
        play = null;
        phase = 'delivering';
        note('an item arrived — the room is frozen while it lands and the plan is redone');
        admit(items, row, (landed) => {
            room.shipped = prefix;
            room.equips = prefixEquips;
            room.lead = heldKeys.length ? [heldKeys] : null;
            // ⛓ SLOTS CONSUMER — the game's array as it stood before the write: the model appends the delivered slot.
            // ⛓ KEY DELIVERY — a delivered key is staged at the arrival too (only what is new to the staging and the game).
            room.staging = stageItems(room.staging, landed.items, { slots: st.inventory_slots, save: added });
            room.slotLag = { before: st.inventory_slots ?? [], after: post.slots, primary: st.primary, secondary: st.secondary, held: heldKeys };
            phase = 'held';
            if (goal) { solveInRoom(); return; }
            enterHeld();
        }, save);
    }

    /**
     * The room is HELD (between goals, or a solve in flight on it): ask, write, re-stage; a solve in flight is
     * asked again from the re-staged room. A refusal at an ARRIVAL (nothing shipped: the item shapes the room
     * itself, or its slots) is written anyway and the goal served by today's forced re-arrival, by name.
     */
    function deliverHeld() {
        const st = status();
        if (!st) { later(); return; }
        const items = predicted(st);
        const save = predictedSave(st);
        const added = deliveredSaveArrays({ staging: room.staging, status: st, save });
        const refusal = deliveryRefusal({ staging: room.staging, shipped: room.shipped, items, save, status: st, levelSource, equips: roomEquips(room) });
        const atArrival = room.shipped.length === 0 || (room.adopted && room.shipped.length === 1 && room.shipped[0].length === 0);
        if (refusal && !atArrival) { deferDelivery(refusal, phase); return; }
        const row = { level: room.level, goal: goal?.name ?? goal?.kind ?? null, phase, tick: room.shipped.length, items: itemDelta(st.items, items),
            save: saveDelta(liveSaveArrays(st), save), heldKeys: [], outcome: refusal ? 'forced' : 'replanning', policy: DELIVERY_POLICY, ...(refusal ? { clause: refusal.clause, why: refusal.why } : {}) };
        stats.deliveries.push(row);
        const solving = phase === 'solving';
        if (solving) {
            token += 1;
            cancelTimer();
            if (handle && !handle.settled) handle.cancel();
            handle = null;
            play = null;
        }
        const post = slotsAfterDelivery({ slots: st.inventory_slots ?? [], primary: st.primary, secondary: st.secondary }, items);
        phase = 'delivering';
        note('an item arrived — it lands in the held room before the plan is made');
        admit(items, row, (landed) => {
            if (refusal) {
                // The room was built without the item (or holds its slots in another order): enter it again.
                phase = 'held';
                if (goal) { fallback(`an item arrived that this room's arrival cannot take — ${refusal.clause}: ${refusal.why}`, 'delivery-refused'); return; }
                const why = `${refusal.clause}: ${refusal.why}`;
                release();
                reset();
                log(`[wasm playback] the held room was released: an item arrived it cannot take (${why}) — the next goal re-enters it`, 'warn');
                return;
            }
            room.staging = stageItems(room.staging, landed.items, { slots: st.inventory_slots, save: added });
            room.slotLag = { before: st.inventory_slots ?? [], after: post.slots, primary: st.primary, secondary: st.secondary, held: [] };
            if (!solving) row.outcome = 'staged';
            phase = 'held';
            if (goal) { solveInRoom(); return; }
            enterHeld();
            if (queued) { const q = queued; queued = null; const r = begin(q.goal); if (!r.ok) fail(r.reason); }
        }, save);
    }

    return {
        /** `{ok:true, action}` or `{ok:false, reason}` — a refusal before anything moved. */
        walkTo(g) {
            try {
                const r = begin(g);
                return r;
            } catch (err) { return { ok: false, reason: `the wasm playback threw: ${err.message}` }; }
        },
        /**
         * Stop: cancel any solve, release our tape (`botReset`), drop a queued goal.
         * ⛓ W7 — and the HOLD: a held room ignores the keyboard, so a stopped or
         * paused bot (`playbackBotUI.stop`, its `finished`/`error:` stop, the
         * substrate change on a crossing) always hands the room back to the player.
         * ⛓ The bot calls it on EVERY region move that changes substrate
         * (`playbackBotUI.onRegionMove`) — so an exit tape is normally stopped
         * just after its crossing, before its finish latch; the leg is then
         * recorded `stopped` with what had drained.
         */
        stop() {
            if (goal && phase !== 'idle' && phase !== 'held') {
                if (phase === 'playing') {
                    const d = J(game()?.botDrain?.());
                    if (d) play.progress = foldDrain(play.progress, d);
                }
                const last = play?.progress?.rows?.at(-1) ?? null;
                history.push({ goal, outcome: 'stopped', producer: play?.plan ? (play.plan.producer ?? 'solver') : null,
                    phase, ticks: play?.ticks ?? null,
                    drained: play?.progress?.ticks ?? null, verbs: play?.plan?.verbs ?? null, solvedMs: play?.solvedMs ?? null,
                    divergence: play?.divergence ?? null, recoveries, lastRow: last, expectedEnd: play?.plan?.expected?.at(-1) ?? null,
                    continuation: play?.continuation ?? false, prefix: play?.prefix ?? 0 });
            }
            queued = null;
            const heldLevel = room?.level ?? null;
            release();
            // ⛓ ARRIVAL JITTER — the bot stops on a region move whose teleport the glue has queued: push it now.
            pushQueuedNow('stop', heldLevel);
            reset();
            watchRow(arriving && watchTimer ? 'stop-drop' : 'stop');
            stopWatch();
            // ⛓ MID-ROOM REPLAN — the gate comes off: whatever it held reaches the game on the adapter's next push.
            disengageGate();
            driving = false;
            arriving = false;
            goal = null;
            note(null);
        },
        /**
         * ⛓ WALK IDENTITY (b) — the bot's RESTART waits for the leg: null when no tape is PLAYING (held, idle,
         * solving — the room is frozen, so a stop releases it at a fixed clock), else a promise that resolves
         * `{ended, phase, waitedMs}` once the tape leaves `playing` (its held end; or idle / failed / stopped), or
         * `{ended: false, timedOut: true}` after `waitMs`. Measured (§5.39): the Restart after L17's chest stopped
         * the 42-tick tape ~1.15 s in, at a WALL-CLOCK tick — the room's clock then differed run to run.
         */
        legEnd({ waitMs = RESTART_LEG_WAIT_MS } = {}) {
            if (phase !== 'playing') return null;
            const t = T();
            const from = now();
            const leg = play;
            return new Promise((resolve) => {
                const poll = () => {
                    if (phase !== 'playing' || play !== leg) { resolve({ ended: true, phase, waitedMs: now() - from }); return; }
                    if (now() - from > waitMs) { resolve({ ended: false, timedOut: true, phase, waitedMs: now() - from }); return; }
                    t.setTimeout(poll, SOLVE_POLL_MS);
                };
                t.setTimeout(poll, SOLVE_POLL_MS);
            });
        },
        /**
         * ⛓ WALK IDENTITY — a Restart's start hop is an ARRIVAL the engine did not cause: the glue stopped the walk
         * (so nothing watches), then queues the hop's teleport. Watch for it as for a crossing in flight, so its
         * landing is HELD and staged whatever turn the bot's next goal comes in. Measured without it: when the
         * landing beat the bot's next walkTo, the goal found an unwatched room, the adoption refused it (the
         * player holds the Sword) and a forced re-arrival spent 2 more frames (2 of 14 CI runs). False when this
         * engine holds no arrivals (no glue query) or a goal is in flight.
         */
        expectArrival() {
            if (!holds || !glueQuery || goal) return false;
            arriving = true;
            startWatch('expect');
            stats.expectedArrivals += 1;
            return true;
        },
        liveLevel() { const l = readState().level; return Number.isInteger(l) ? l : null; },
        /** ⛓ O3 — the budget the next solve starts with (the knob's live value, else the engine's own), in work units. */
        get budgetWork() { return baseBudget(); },
        /** The upgrade window the next solve starts with, in work units (null = the whole budget). */
        get upgradeWindowWork() { return upgradeWindow(); },
        /** ⛓ O3 — the engine's own budget (the twin of the JS page's `setSolverBudgetWork`); the knob, when set, wins. */
        setBudgetWork(n) { const v = Number(n); if (Number.isFinite(v) && v > 0) ownBudget = v; },
        /** The wall-clock backstop, in ms (a named failure, never an answer). */
        get backstopMs() { return backstopMs; },
        /** ⛓ WG — whether this engine stages a mounted generated set (a label: ⛓ §5.36 they are solver rooms). */
        get generated() { return generated; },
        /** The tape producer: `'solver'`, or the `'walker'` INSTRUMENT. */
        get producer() { return walkerInstrument ? WALK_TAPE_PRODUCER : 'solver'; },
        status() {
            return { phase, goal, generated, producer: walkerInstrument ? WALK_TAPE_PRODUCER : 'solver', queued: queued?.goal ?? null, ticks: play?.ticks ?? null,
                drained: play?.progress?.ticks ?? null, divergence: play?.divergence ?? null, recoveries,
                // ⛓ W7 — the held room (its level and how many key sets the shadow replays), and whether a crossing is in flight
                room: room ? { level: room.level, shipped: room.shipped.length, plans: room.plans ?? 0, talkCircles: room.talkCircles?.length ?? 0 } : null, driving, arriving,
                // ⛓ MID-ROOM REPLAN — the gate: installed, a delivery held back, the room a refused one waits out
                gate: gate ? { pending: !!gate.pending, deferred: gate.deferred ? { clause: gate.deferred.clause, why: gate.deferred.why } : null } : null,
                frozen: frozen ? { tick: frozen.tick, heldKeys: [...frozen.heldKeys] } : null };
        },
        get stats() {
            return { ...stats, hostStarts: [...stats.hostStarts], keyReleases: [...stats.keyReleases], history: [...history],
                forcedBy: { ...stats.forcedBy }, fallbacks: [...stats.fallbacks], heldChecks: [...stats.heldChecks],
                holdBlocked: [...stats.holdBlocked], adoptRefused: [...stats.adoptRefused],
                ceremonies: stats.ceremonies.map((c) => ({ ...c })), dismissed: [...stats.dismissed],
                deliveries: stats.deliveries.map((d) => ({ ...d })), deliveryDeferred: [...stats.deliveryDeferred],
                swapPushes: stats.swapPushes.map((r) => ({ ...r })), shipClock: stats.shipClock.map((r) => ({ ...r })),
                adoptClock: stats.adoptClock.map((r) => ({ ...r })) };
        },
        /** ⛓ WG — the last arrivals' raw reads (`{seam, status, state}`), for a fixture recorder. */
        get arrivalReads() { return arrivalReads.map((a) => structuredClone(a)); },
        /** ⛓ W7 — the held room's recipe (the probe rebuilds the shadow from it); null when none. */
        get room() {
            return room ? structuredClone({ level: room.level, staging: room.staging, shipped: room.shipped, equips: room.equips ?? [], spawn: room.spawn }) : null;
        },
        dispose() { this.stop(); try { service?.dispose?.(); } catch { /* gone */ } },
    };
}

/**
 * Load the preset's map document and build the engine. `mapPath` is the one
 * the preset NAMES (`mapDocumentPath`), resolved against `baseUrl`.
 * ⛓ WG — given `levelSet` (the generated arm's assembled set), the engine's
 * rooms are that MOUNTED set instead (`mountedRecordsOf`), and no map is fetched;
 * ⛓ §5.36 — a SOLVER engine like any other, labelled `generated`.
 * ⛓ VANILLA MAP — given `deliveredSet` (a REAL-room set an arm delivered: the vanilla arm's rewrite,
 * an atlas arm's retag), the rooms are that set too — the game plays them, not the map document (an
 * `apitem` stands where the map has a chest) — but they stay SOLVER rooms (holds, continuations, the
 * adoption). No engine this builds uses the walker producer (an instrument: `createWasmPlayback({producer})`).
 */
export async function loadWasmPlaybackEngine({ mapPath, levelSet = null, deliveredSet = null, baseUrl, fetchImpl = globalThis.fetch, ...deps }) {
    if (levelSet) return createWasmPlayback({ ...deps, records: mountedRecordsOf(levelSet), generated: true });
    if (deliveredSet) return createWasmPlayback({ ...deps, records: mountedRecordsOf(deliveredSet) });
    if (!mapPath) throw new Error('no map document named by the preset (region_atlas) — the wasm playback has no rooms to solve');
    const res = await fetchImpl(new URL(mapPath, baseUrl).href);
    if (!res.ok) throw new Error(`the map document ${mapPath} did not load: ${res.status} ${res.statusText}`);
    const records = indexLevels(await res.json());
    const engine = createWasmPlayback({ ...deps, records });
    return engine;
}
