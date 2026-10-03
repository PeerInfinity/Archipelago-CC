/**
 * ⛓⛓ **THE PLAYBACK BOT'S FEET ON THE WASM RUNTIME** (solver-walk W2; plan
 * `NewDocs/plans/seedling-js-solver-walk-plan.md` §5.3 W2). The engine behind
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
 *   4. SOLVE in the S2 Worker (`createWorkerSolveService`), budget
 *      `SOLVER_BUDGET_MS` from the worker's own start (a cold module load is
 *      not charged, `LOAD_BUDGET_MS` bounds it).
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
 * ⛓ W4 — ARRIVAL COMPOSITES. A PIT exit maps to `reach-pit` (the fall is the
 * game's crossing). An arrival LATCHED ON its goal door is solved by the
 * worker's `step-off` producer: the walker's step-off ++ the solver's walk
 * back, ONE plan and ONE tape from the arrival (`wasmWalkTape.stepOffSolveFromStaging`).
 *
 * ⛓ WG — GENERATED ROOMS (`flash_seedling_gen`, `generated: true`). The
 * rooms are a MOUNTED level set, so the engine's level source is the set the
 * generated arm delivered (`wasmWalkTape.mountedRecordsOf`: the delivery's
 * own chunk plan, the level ids as mounted), never the preset's map document.
 * Every step above is unchanged except step 4's PRODUCER: the solver has no
 * goal kind for an `apitem`, so the S2 worker runs the J2 WALKER on a fresh
 * run from the same staging (`producer: 'walker'`, `wasmWalkTape.js`) and its
 * held keys are the plan — the same `{solution, expected}` shape, shipped,
 * watched and recovered exactly as a solver plan is.
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
    adoptionRefusal, arrivalHoldBlocker, divergenceAction, divergenceFailure, divergenceRepeatFailure, endsHeld, exactDeclarationRefusal, FALLBACK_POLICY,
    firstDivergence, foldDrain, goalAction, keysHeldAtReset, liveDeclarations, MAX_RECOVERIES, primarySplitRefusal, shadowMismatch,
    talkCircleGuard, talkCirclesAt,
    shippedTape, TAPE_KEY_RELEASES, wasmGoalRefusal,
} from '../seedlingDemo/wasmPlayback.js';
import { LOAD_BUDGET_MS, replayTape, SOLVER_BUDGET_MS } from '../seedlingDemo/jsRuntimeSolver.js';
import { createWorkerSolveService } from '../seedlingDemo/jsRuntimeSolveService.js';
import { indexLevels, levelSourceFromAtlas } from '../seedlingDemo/atlasSource.js';
import { parsePendingCheck } from './seedlingCheckBinding.js';
import { mountedRecordsOf, WALK_TAPE_PRODUCER } from '../seedlingDemo/wasmWalkTape.js';

/** How long a goal waits for its arrival (a crossing, or the forced re-arrival) before it fails by name. */
export const ARRIVAL_WAIT_MS = 15000;
/** How long a QUEUED goal waits for the playing tape (a seal reveal is ~16 s, W0 i.13). */
export const QUEUE_WAIT_MS = 60000;
/** Solve poll, drain poll, and the `finished` read's cadence once every planned tick drained. */
export const SOLVE_POLL_MS = 20;
export const DRAIN_MS = 100;
export const STATUS_MS = 500;

const J = (s) => { try { return JSON.parse(s); } catch { return null; } };

/**
 * @param {object} deps
 * @param {() => object|null} deps.getGame  the game's callback surface (`adapter._getFlash()`)
 * @param {() => Window|null} [deps.getWin]  the game's window — its timers run the sampler (W0/W1's arrangement)
 * @param {(p:{level:number, x:number, y:number}) => boolean} deps.teleport  the panel's teleport recipe
 * @param {() => object|null} [deps.getCheckBinding]  the glue's `SeedlingCheckBinding`
 * @param {Map} deps.records  level → record (the preset's map document; ⛓ WG the mounted set's)
 * @param {boolean} [deps.generated]  ⛓ WG — `records` are a MOUNTED generated set: goals go to the walker producer
 * @param {object} [deps.solveService]  default `createWorkerSolveService()`
 * @param {object} [deps.timers]  `{setTimeout, clearTimeout}` — default the GAME window's
 * @param {() => number} [deps.now]
 * @param {(note:string|null) => void} [deps.onNote]
 * @param {(reason:string) => void} [deps.onFailed]
 * @param {(e:object) => void} [deps.onDone]
 * @param {(msg:string, level?:string) => void} [deps.log]
 * @param {number} [deps.budgetMs]
 */
export function createWasmPlayback({
    getGame, getWin = () => null, teleport, getCheckBinding = () => null, getSwapState = null, records, generated = false,
    solveService = null, timers = null,
    now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now()),
    onNote = () => {}, onFailed = () => {}, onDone = () => {}, log = () => {}, budgetMs = SOLVER_BUDGET_MS,
}) {
    const levelSource = levelSourceFromAtlas(records);
    let service = solveService;
    const svc = () => { service ??= createWorkerSolveService(); return service; };
    /** ⛓ W7 — held rooms and continuations serve the SOLVER (vanilla) rooms; a generated set keeps W2's flow. */
    const holds = !generated;
    /**
     * ⛓ W7 — the arrival watch (holding the arrival an exit plan's crossing leads to) needs the GLUE QUERY:
     * an engine built without `getSwapState` cannot know a redirect is in flight, so it holds no arrival
     * between goals (W2's flow there); its held location ends and continuations are unaffected.
     */
    const glueQuery = holds && typeof getSwapState === 'function';

    /** idle | await-arrival | ⛓ W8 adopting (the adoption's freeze latching) | solving | playing | held (⛓ W7: our tape holds a room, no goal) */
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
    /** ⛓ W7 — the bot is driving (a walkTo since the last stop()): arrivals are held. */
    let driving = false;
    /** ⛓ W7 — an exit plan's crossing is in flight: the next held arrival is where the next goal starts. */
    let arriving = false;
    /** ⛓ W7 — the arrival watch: its own timer chain beside the goal's (the sampler of W0/W1, between goals). */
    let watchTimer = null;
    let watchToken = 0;
    let watchBaseline = null;
    /** Warm the worker now, so the first solve does not pay the module load inside its budget (S2). */
    try { svc().warm?.(); } catch { /* no Worker here: the first start says so */ }
    const stats = { arrivals: 0, forced: 0, solves: 0, ships: 0, hostStarts: [], done: 0, failed: 0, divergences: 0,
        recoveries: 0, keyReleases: [],
        // ⛓ W7 — why each forced re-arrival was spent, the held arrivals, the continuations, the glue query's refusals
        forcedBy: {}, held: 0, continuations: 0, fallbacks: [], heldChecks: [], holdBlocked: [], releasedForSwap: 0,
        // ⛓ W8 — cold starts adopted as they stand, and the clause each refused one failed
        adopted: 0, adoptRefused: [] };
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
        if (!ours) return;
        ours = false;
        let held = [];
        if (phase === 'playing' && play?.plan) {
            const s = st === undefined ? status() : st;
            held = keysHeldAtReset({ status: s, solution: play.plan.solution });
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
        let win = null;
        try { win = getWin?.() ?? null; } catch { win = null; }
        const canvas = win?.document?.querySelector?.('canvas') ?? null;
        const Ctor = win?.KeyboardEvent;
        if (!canvas || typeof Ctor !== 'function') return;
        for (const k of TAPE_KEY_RELEASES.filter((x) => names.includes(x.name))) {
            for (const type of ['keydown', 'keyup']) {
                try {
                    canvas.dispatchEvent(new Ctor(type, { key: k.key, code: k.code, keyCode: k.keyCode, which: k.keyCode,
                        bubbles: true, cancelable: true }));
                } catch { /* the page is gone */ }
            }
        }
        stats.keyReleases.push(names);
    }

    function reset() {
        token += 1;
        cancelTimer();
        if (handle && !handle.settled) handle.cancel();
        handle = null;
        play = null;
        phase = 'idle';
    }

    function fail(reason) {
        const g = goal;
        release();
        reset();
        stopWatch();
        arriving = false;
        goal = null;
        stats.failed += 1;
        history.push({ goal: g, outcome: 'failed', reason, recoveries });
        log(`[wasm playback] ${reason}`, 'warn');
        note(null);
        try { onFailed(reason); } catch { /* a listener's bug */ }
    }

    /**
     * `botLoadTape` + `botStart`, bracketed by the seq reads and handed to the
     * binding. Returns null or the refusal.
     */
    function hostStart(tape, label) {
        const g = game();
        if (!g?.botLoadTape || !g?.botStart) return 'the game exposes no botLoadTape/botStart';
        const from = seqNow();
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
            reArrive(`re-entering level ${g.level} to solve from an arrival (${FALLBACK_POLICY}: the cold start — the room ran `
                + `before the bot drove${adopted ? `, and it cannot be adopted: ${adopted}` : ', so no arrival staging of it exists'})`, 'cold-start');
        } else {
            phase = 'await-arrival';
            deadline = now() + ARRIVAL_WAIT_MS;
            note(`waiting to arrive in level ${g.level}`);
            if (glueQuery) startWatch();
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
     */
    function adoptLive(g) {
        const se = seam();
        const be = se.beginEntry ?? null;
        const st = status();
        const state = readState();
        const record = records.get(g.level) ?? null;
        const refused = (clause, why) => { stats.adoptRefused.push({ level: g.level, clause, why }); return `${clause}: ${why}`; };
        if (!st) return refused('begin', 'botStatus answered nothing');
        let staging = null;
        let shadow = null;
        if (be && be['begin.level'] === st.level) {
            try {
                ({ staging } = stagingFromWasmArrival({ seam: se, status: st, state, record }));
                const one = replayTape({ staging, perTick: [new Set()], levelSource, scratchPersistence: true });
                shadow = { x: one.state.x, y: one.state.y, direction: one.state.direction };
            } catch (err) { return refused('staging', String(err?.message ?? err).split('\n')[0]); }
        }
        const mobiles = J(game()?.botMobiles?.());
        const r = adoptionRefusal({ beginEntry: be, status: st, mobiles, record, shadow });
        if (r) return refused(r.clause, r.why);
        const sw = swapState();
        const blocked = sw ? arrivalHoldBlocker(sw, be) : 'the glue answered no swap state (a redirect cannot be ruled out)';
        if (blocked) return refused('glue', blocked);
        let freeze;
        try { freeze = shippedTape({ staging, keys: [], hold: true, name: `wasm-adopt-${g.level}` }); } catch (err) { return refused('tape', err.message); }
        const decl = exactDeclarationRefusal(freeze, st);
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
        room = { level: g.level, staging, shipped: [[]], spawn: { x: state.playerPositionX, y: state.playerPositionY }, begin: be,
            pushes: sw?.pushes ?? null, adopted: true,
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

    /** ⛓ W8 — the adoption's freeze latched → the held check + the continuation solve; never latched → failed by name. */
    function adoptLatched() {
        if (phase !== 'adopting') return;
        const st = status();
        if (st?.held) { phase = 'held'; solveInRoom(); return; }
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
        note(why);
        schedule(sample, 0);
    }

    /** The goal's own arrival sampler (a forced re-arrival, or W2's crossing wait). */
    function sample() {
        if (phase !== 'await-arrival') return;
        const se = seam();
        if (isArrival(baseline, se)) {
            baseline = se.beginEntry;
            if (se.beginEntry['begin.level'] === goal.level) {
                // ⛓ W7 — the glue query: an arrival the glue is about to redirect is not the room to hold.
                const sw = holds ? swapState() : null;
                const blocked = sw ? arrivalHoldBlocker(sw, se.beginEntry) : null;
                if (blocked) stats.holdBlocked.push({ level: goal.level, why: blocked });
                else { arrive(se); return; }
            }
        }
        if (now() > deadline) {
            fail(`no arrival in level ${goal.level} within ${ARRIVAL_WAIT_MS / 1000} s`);
            return;
        }
        schedule(sample, 0);
    }

    // ── ⛓ W7: the arrival watch — every arrival while the bot drives is HELD ──

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
    function startWatch() {
        stopWatch();
        watchBaseline = seam().beginEntry ?? null;
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
            watchBaseline = se.beginEntry;
            const level = se.beginEntry['begin.level'];
            const sw = swapState();
            const blocked = sw ? arrivalHoldBlocker(sw, se.beginEntry) : 'the glue answered no swap state (a redirect cannot be ruled out)';
            if (blocked) stats.holdBlocked.push({ level, why: blocked });
            else if (!records.has(level)) stats.holdBlocked.push({ level, why: 'the vanilla map has no such level' });
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
        } catch (err) { stats.holdBlocked.push({ level, why: err.message }); return false; }
        let freeze;
        try { freeze = shippedTape({ staging, keys: [], hold: true, name: `wasm-hold-${level}` }); } catch (err) {
            stats.holdBlocked.push({ level, why: err.message });
            return false;
        }
        const decl = exactDeclarationRefusal(freeze, st);
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
            const done = { goal: g, producer: leg.plan.producer ?? 'solver', stepOff: leg.plan.stepOff ?? null, ticks: leg.ticks,
                drained: leg.progress.ticks, verbs: leg.plan.verbs, solvedMs: leg.solvedMs, divergence: leg.divergence, recoveries,
                end: { level, x: st.x, y: st.y }, expectedEnd: leg.plan.expected.at(-1), heldArrival: level };
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

    /** W2's arrival for the goal (a forced re-arrival's landing, or the generated flow): hold it, then solve. */
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
        } catch (err) { fail(err.message); return; }
        let freeze;
        try { freeze = shippedTape({ staging, keys: [], hold: true, name: `wasm-freeze-${goal.level}` }); } catch (err) { fail(err.message); return; }
        const decl = exactDeclarationRefusal(freeze, st);
        if (decl) { fail(`the freeze tape was not shipped — ${decl}`); return; }
        const started = hostStart(freeze, 'freeze');
        if (started) { fail(started); return; }
        // ⛓ WG — the walker producer: the goal as the controller resolved it, the same staging.
        const request = { producer: WALK_TAPE_PRODUCER, staging, goal: { ...goal }, name: `wasm-walk-${goal.kind}-${goal.level}`,
            scratchPersistence: true, levelSource, source: { records } };
        startSolve(request, { staging, arrivalStatus: st, continuation: false });
    }

    /**
     * ⛓ W7 — solve the goal in the room our tape HOLDS: from the arrival when
     * nothing was shipped since (W2's solve, W4's step-off composite), else a
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
            // ⛓ W4 — latched on the goal door: the worker's step-off composite (one tape from the arrival).
            const request = arrivalSolveRequest({ staging: r.staging, solverGoal: mapped.goal, levelSource, records,
                name: `wasm-${goal.kind}-${goal.level}`, scratchPersistence: true, stepOffGoal: mapped.stepOff ? goal : null });
            startSolve(request, { staging: r.staging, continuation: false });
            return;
        }
        const st = status();
        let c;
        try {
            c = continuationSolveRequest({ staging: r.staging, shipped: r.shipped, goal, levelSource, records, record,
                name: `wasm-continue-${goal.kind}-${goal.level}` });
        } catch (err) {
            fallback(`the continuation could not be built: ${String(err?.message ?? err).split('\n')[0]}`, 'continuation-error');
            return;
        }
        const mismatch = shadowMismatch(c.shadowRow, st);
        stats.heldChecks.push({ level: r.level, shipped: r.shipped.length, shadow: c.shadowRow, game: st && { level: st.level, x: st.x, y: st.y },
            held: st?.held ?? null, equal: !mismatch });
        if (mismatch) {
            // ⛔ The plan's STOP condition: the held game is not the shadow — a staging bug, named, never solved past.
            log(`[wasm playback] the HELD game is not the shadow in level ${r.level} after ${r.shipped.length} shipped tick(s): `
                + `shadow ${JSON.stringify(mismatch.expected)}, game ${JSON.stringify(mismatch.got)}`, 'warn');
            fallback(`the held game is not the shadow (shadow ${JSON.stringify(mismatch.expected)}, game ${JSON.stringify(mismatch.got)})`,
                'shadow-mismatch');
            return;
        }
        if (c.refusal) { fallback(c.refusal, 'continuation-refused'); return; }
        stats.continuations += 1;
        startSolve(c.request, { staging: r.staging, continuation: true, prefix: r.shipped.length });
    }

    function startSolve(request, playInit) {
        stats.solves += 1;
        play = { ...playInit, t0: now() };
        handle = svc().start(request);
        phase = 'solving';
        note(`${generated ? 'walking a tape' : playInit.continuation ? 'solving on from the held room' : 'solving'}… `
            + `(budget ${Math.round(budgetMs / 1000)} s)`);
        schedule(pollSolve, SOLVE_POLL_MS);
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

    function pollSolve() {
        if (phase !== 'solving') return;
        const t = now();
        // ⛓ W7 — the glue asked for a swap while we hold (a redirect that raced the hold): let it land.
        if (holds && room && releaseForSwap()) return;
        if (!handle.settled) {
            const over = handle.started ? t - (handle.startedAt ?? play.t0) > budgetMs : t - play.t0 > LOAD_BUDGET_MS;
            if (over) {
                handle.cancel();
                const why = `the solver exceeded ${handle.started ? `${budgetMs / 1000} s` : `the ${LOAD_BUDGET_MS / 1000} s load budget`} `
                    + `on ${goal.kind} in level ${goal.level} (terminated)`;
                if (play.continuation) { fallback(why, 'continuation-budget'); return; }
                fail(why);
                return;
            }
            schedule(pollSolve, SOLVE_POLL_MS);
            return;
        }
        const res = handle.result;
        if (!res?.ok) {
            const why = `the ${generated ? 'walker producer' : 'solver'} declined ${goal.name ?? goal.kind} in level ${goal.level} `
                + `(${res?.kind}): ${res?.message}`;
            if (play.continuation) { fallback(why, 'continuation-declined'); return; }
            fail(why);
            return;
        }
        play.plan = res.plan;
        play.solvedMs = Math.round(t - play.t0);
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
        release();
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
        if (st?.armed && !st?.finished) {
            // The solve beat the fade: the freeze tape has not latched yet. Wait for it.
            schedule(ship, DRAIN_MS);
            return;
        }
        if (!st?.held) {
            fail('the room was not held when the plan was ready — the freeze tape did not latch (it is the only '
                + 'thing that keeps the game where the solve started)');
            return;
        }
        const { plan, staging } = play;
        // ⛓ W7 — the X-split rule: a continuation may not open with a re-press of an X the last tape held.
        const split = play.continuation ? primarySplitRefusal(room?.shipped, plan.solution) : null;
        if (split) { fallback(split, 'x-split'); return; }
        // ⛓ W8b — adopted inside a talk circle: no X until the plan has left it.
        const talk = room?.talkCircles?.length ? talkCircleGuard({ circles: room.talkCircles, solution: plan.solution, expected: plan.expected }) : null;
        if (talk?.refusal) { fallback(talk.refusal, 'adopt-talk'); return; }
        const hold = holds && endsHeld(goal);
        let tape;
        try {
            tape = shippedTape({ staging: play.continuation ? liveDeclarations(staging, st) : staging, keys: plan.solution, hold,
                name: `wasm-${play.continuation ? 'continue-' : ''}${goal.kind}-${goal.level}` });
        } catch (err) { fail(err.message); return; }
        const decl = exactDeclarationRefusal(tape, st);
        if (decl) { fail(`the plan tape was not shipped — ${decl}`); return; }
        const started = hostStart(tape, play.continuation ? 'continuation' : 'plan');
        if (started) { fail(started); return; }
        stats.ships += 1;
        play.ticks = plan.solution.length;
        play.hold = hold;
        play.progress = foldDrain(null, null);
        play.divergence = null;
        play.lastStatusAt = 0;
        phase = 'playing';
        if (room) {
            room.shipped = [...room.shipped, ...plan.solution.map((h) => [...h])];
            room.plans = (room.plans ?? 0) + 1;
            if (talk?.left) room.talkCircles = [];
        }
        note(`playing ${play.ticks} ticks (${(plan.verbs ?? []).join(',') || 'walk'})`);
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
            continuation: play.continuation ?? false });
        const queuedGoal = queued;
        // The spawn the room's ARRIVAL recorded (W3), whatever the divergence carried the player to.
        if (room?.spawn) spawn = room.spawn;
        release(st);
        reset();
        queued = queuedGoal; // a goal waiting on this tape keeps waiting for the recovered one
        reArrive(`left the plan at tick ${d.t} — recovery ${recoveries}/${MAX_RECOVERIES}: re-entering level ${goal.level} to re-solve`, 'recovery');
    }

    function finish(st) {
        const done = { goal, producer: play.plan.producer ?? 'solver', stepOff: play.plan.stepOff ?? null, ticks: play.ticks, drained: play.progress.ticks, verbs: play.plan.verbs,
            solvedMs: play.solvedMs, divergence: play.divergence, recoveries, end: { level: st.level, x: st.x, y: st.y },
            expectedEnd: play.plan.expected.at(-1), continuation: play.continuation ?? false, prefix: play.prefix ?? 0, heldEnd: !!(play.hold && st.held) };
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
                    stepOff: play?.plan?.stepOff ?? null, phase, ticks: play?.ticks ?? null,
                    drained: play?.progress?.ticks ?? null, verbs: play?.plan?.verbs ?? null, solvedMs: play?.solvedMs ?? null,
                    divergence: play?.divergence ?? null, recoveries, lastRow: last, expectedEnd: play?.plan?.expected?.at(-1) ?? null,
                    continuation: play?.continuation ?? false, prefix: play?.prefix ?? 0 });
            }
            queued = null;
            release();
            reset();
            stopWatch();
            driving = false;
            arriving = false;
            goal = null;
            note(null);
        },
        liveLevel() { const l = readState().level; return Number.isInteger(l) ? l : null; },
        /** ⛓ WG — whether this engine stages a mounted generated set. */
        get generated() { return generated; },
        status() {
            return { phase, goal, generated, queued: queued?.goal ?? null, ticks: play?.ticks ?? null,
                drained: play?.progress?.ticks ?? null, divergence: play?.divergence ?? null, recoveries,
                // ⛓ W7 — the held room (its level and how many key sets the shadow replays), and whether a crossing is in flight
                room: room ? { level: room.level, shipped: room.shipped.length, plans: room.plans ?? 0, talkCircles: room.talkCircles?.length ?? 0 } : null, driving, arriving };
        },
        get stats() {
            return { ...stats, hostStarts: [...stats.hostStarts], keyReleases: [...stats.keyReleases], history: [...history],
                forcedBy: { ...stats.forcedBy }, fallbacks: [...stats.fallbacks], heldChecks: [...stats.heldChecks],
                holdBlocked: [...stats.holdBlocked], adoptRefused: [...stats.adoptRefused] };
        },
        /** ⛓ WG — the last arrivals' raw reads (`{seam, status, state}`), for a fixture recorder. */
        get arrivalReads() { return arrivalReads.map((a) => structuredClone(a)); },
        /** ⛓ W7 — the held room's recipe (the probe rebuilds the shadow from it); null when none. */
        get room() { return room ? structuredClone({ level: room.level, staging: room.staging, shipped: room.shipped, spawn: room.spawn }) : null; },
        dispose() { this.stop(); try { service?.dispose?.(); } catch { /* gone */ } },
    };
}

/**
 * Load the preset's map document and build the engine. `mapPath` is the one
 * the preset NAMES (`mapDocumentPath`), resolved against `baseUrl`.
 * ⛓ WG — given `levelSet` (the generated arm's assembled set), the engine's
 * rooms are that MOUNTED set instead (`mountedRecordsOf`), and no map is fetched.
 */
export async function loadWasmPlaybackEngine({ mapPath, levelSet = null, baseUrl, fetchImpl = globalThis.fetch, ...deps }) {
    if (levelSet) return createWasmPlayback({ ...deps, records: mountedRecordsOf(levelSet), generated: true });
    if (!mapPath) throw new Error('no map document named by the preset (region_atlas) — the wasm playback has no rooms to solve');
    const res = await fetchImpl(new URL(mapPath, baseUrl).href);
    if (!res.ok) throw new Error(`the map document ${mapPath} did not load: ${res.status} ${res.statusText}`);
    const records = indexLevels(await res.json());
    const engine = createWasmPlayback({ ...deps, records });
    return engine;
}
