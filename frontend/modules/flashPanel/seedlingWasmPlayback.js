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
 *      failure (`divergenceFailure` → `playback:walkFailed`). A
 *      `SealController` freeze drains NO rows, so it is never a divergence
 *      (⚖ W0-Q2).
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

import { arrivalSolveRequest, arrivalSolverGoal, isArrival, stagingFromWasmArrival } from '../seedlingDemo/wasmArrival.js';
import {
    divergenceAction, divergenceFailure, exactDeclarationRefusal, firstDivergence, foldDrain, goalAction, MAX_RECOVERIES,
    keysHeldAtReset, MID_ROOM_POLICY, shippedTape, TAPE_KEY_RELEASES, wasmGoalRefusal,
} from '../seedlingDemo/wasmPlayback.js';
import { LOAD_BUDGET_MS, SOLVER_BUDGET_MS } from '../seedlingDemo/jsRuntimeSolver.js';
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
    getGame, getWin = () => null, teleport, getCheckBinding = () => null, records, generated = false, solveService = null, timers = null,
    now = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now()),
    onNote = () => {}, onFailed = () => {}, onDone = () => {}, log = () => {}, budgetMs = SOLVER_BUDGET_MS,
}) {
    const levelSource = levelSourceFromAtlas(records);
    let service = solveService;
    const svc = () => { service ??= createWorkerSolveService(); return service; };

    /** idle | await-arrival | solving | playing */
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
    /** Warm the worker now, so the first solve does not pay the module load inside its budget (S2). */
    try { svc().warm?.(); } catch { /* no Worker here: the first start says so */ }
    const stats = { arrivals: 0, forced: 0, solves: 0, ships: 0, hostStarts: [], done: 0, failed: 0, divergences: 0,
        recoveries: 0, keyReleases: [] };
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

    /**
     * Release whatever tape we started (hold or armed) — `botReset` (W0 i.9) —
     * and then the KEYS a plan tape was holding mid-span (`keysHeldAtReset`:
     * a reset leaves them down, and the next tape's press on them is lost).
     * `st` = a `botStatus` read in this same JS turn (no tick runs between it
     * and the reset); without one, a PLAYING plan pays one read here.
     */
    function release(st = undefined) {
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
        const action = goalAction({ goal: g, liveLevel: live.level, playing: phase === 'playing' });
        if (action === 'queue') {
            queued = { goal: g, since: now() };
            note(`queued behind the playing tape (${goal?.name ?? 'the last goal'})`);
            return { ok: true, action };
        }
        // A goal replacing one mid-solve: the freeze is ours, release it first.
        release();
        reset();
        goal = g;
        recoveries = 0;
        spawn = action === 'force-re-arrival' ? { x: live.playerPositionX, y: live.playerPositionY } : null;
        if (action === 'force-re-arrival') {
            reArrive(`re-entering level ${g.level} to solve from an arrival (${MID_ROOM_POLICY})`);
        } else {
            baseline = seam().beginEntry ?? null;
            phase = 'await-arrival';
            deadline = now() + ARRIVAL_WAIT_MS;
            note(`waiting to arrive in level ${g.level}`);
            schedule(sample, 0);
        }
        return { ok: true, action };
    }

    /**
     * A FORCED RE-ARRIVAL into the goal's room at `spawn` (`MID_ROOM_POLICY`;
     * W3's recovery). The baseline is read BEFORE the teleport, so the arrival
     * is the begin record CHANGING (a same-level rebuild included). The caller
     * has released our tape: a `new Game` queued under a hold never lands (W0 i.11).
     */
    function reArrive(why) {
        baseline = seam().beginEntry ?? null;
        phase = 'await-arrival';
        deadline = now() + ARRIVAL_WAIT_MS;
        stats.forced += 1;
        const ok = spawn ? teleport({ level: goal.level, x: spawn.x, y: spawn.y }) : false;
        if (ok === false) { fail('the panel could not queue the forced re-arrival (no teleport recipe, or no spawn recorded)'); return; }
        note(why);
        schedule(sample, 0);
    }

    function sample() {
        if (phase !== 'await-arrival') return;
        const se = seam();
        if (isArrival(baseline, se)) {
            baseline = se.beginEntry;
            if (se.beginEntry['begin.level'] === goal.level) { arrive(se); return; }
        }
        if (now() > deadline) {
            fail(`no arrival in level ${goal.level} within ${ARRIVAL_WAIT_MS / 1000} s`);
            return;
        }
        schedule(sample, 0);
    }

    // ── 3/4: stage, freeze, solve ─────────────────────────────────────────

    function arrive(se) {
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
        let request;
        if (generated) {
            // ⛓ WG — the walker producer: the goal as the controller resolved it, the same staging.
            request = { producer: WALK_TAPE_PRODUCER, staging, goal: { ...goal }, name: `wasm-walk-${goal.kind}-${goal.level}`,
                scratchPersistence: true, levelSource, source: { records } };
        } else {
            const mapped = arrivalSolverGoal(goal, { staging, levelSource, record });
            if (!mapped.goal) { fail(`the solver has no goal for ${goal.name ?? goal.kind}: ${mapped.walker}`); return; }
            request = arrivalSolveRequest({ staging, solverGoal: mapped.goal, levelSource, records,
                name: `wasm-${goal.kind}-${goal.level}`, scratchPersistence: true });
        }
        stats.solves += 1;
        play = { staging, arrivalStatus: st, t0: now() };
        handle = svc().start(request);
        phase = 'solving';
        note(`${generated ? 'walking a tape' : 'solving'}… (budget ${Math.round(budgetMs / 1000)} s)`);
        schedule(pollSolve, SOLVE_POLL_MS);
    }

    function pollSolve() {
        if (phase !== 'solving') return;
        const t = now();
        if (!handle.settled) {
            const over = handle.started ? t - (handle.startedAt ?? play.t0) > budgetMs : t - play.t0 > LOAD_BUDGET_MS;
            if (over) {
                handle.cancel();
                fail(`the solver exceeded ${handle.started ? `${budgetMs / 1000} s` : `the ${LOAD_BUDGET_MS / 1000} s load budget`} `
                    + `on ${goal.kind} in level ${goal.level} (terminated)`);
                return;
            }
            schedule(pollSolve, SOLVE_POLL_MS);
            return;
        }
        const res = handle.result;
        if (!res?.ok) {
            fail(`the ${generated ? 'walker producer' : 'solver'} declined ${goal.name ?? goal.kind} in level ${goal.level} `
                + `(${res?.kind}): ${res?.message}`);
            return;
        }
        play.plan = res.plan;
        play.solvedMs = Math.round(t - play.t0);
        ship();
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
        let tape;
        try { tape = shippedTape({ staging, keys: plan.solution, name: `wasm-${goal.kind}-${goal.level}` }); } catch (err) { fail(err.message); return; }
        const decl = exactDeclarationRefusal(tape, st);
        if (decl) { fail(`the plan tape was not shipped — ${decl}`); return; }
        const started = hostStart(tape, 'plan');
        if (started) { fail(started); return; }
        stats.ships += 1;
        play.ticks = plan.solution.length;
        play.progress = foldDrain(null, null);
        play.divergence = null;
        play.lastStatusAt = 0;
        phase = 'playing';
        note(`playing ${play.ticks} ticks (${(plan.verbs ?? []).join(',') || 'walk'})`);
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
            if (st?.finished && !st?.armed) { finish(st); return; }
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
        const action = divergenceAction({ goal, recoveries, status: st });
        if (action === 'done') {
            log(`[wasm playback] ${goal.name ?? goal.kind}: its clear already landed — done despite the divergence`, 'warn');
            release(st); // the tape is still armed; the room is the player's again
            finish(st ?? {});
            return;
        }
        if (action === 'fail') { fail(divergenceFailure({ goal, recoveries, divergence: d })); return; }
        recoveries += 1;
        stats.recoveries += 1;
        history.push({ goal, outcome: 'diverged', producer: play.plan.producer ?? 'solver', recovery: recoveries, ticks: play.ticks, drained: play.progress.ticks,
            verbs: play.plan.verbs ?? null, solvedMs: play.solvedMs, divergence: d, input: st?.input ?? null });
        const queuedGoal = queued;
        release(st);
        reset();
        queued = queuedGoal; // a goal waiting on this tape keeps waiting for the recovered one
        reArrive(`left the plan at tick ${d.t} — recovery ${recoveries}/${MAX_RECOVERIES}: re-entering level ${goal.level} to re-solve`);
    }

    function finish(st) {
        const done = { goal, producer: play.plan.producer ?? 'solver', ticks: play.ticks, drained: play.progress.ticks, verbs: play.plan.verbs,
            solvedMs: play.solvedMs, divergence: play.divergence, recoveries, end: { level: st.level, x: st.x, y: st.y },
            expectedEnd: play.plan.expected.at(-1) };
        ours = false; // finished and un-held: nothing of ours is armed
        reset();
        goal = null;
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

    return {
        /** `{ok:true, action}` or `{ok:false, reason}` — a refusal before anything moved. */
        walkTo(g) {
            try { return begin(g); } catch (err) { return { ok: false, reason: `the wasm playback threw: ${err.message}` }; }
        },
        /**
         * Stop: cancel any solve, release our tape (`botReset`), drop a queued goal.
         * ⛓ The bot calls it on EVERY region move that changes substrate
         * (`playbackBotUI.onRegionMove`) — so an exit tape is normally stopped
         * just after its crossing, before its finish latch; the leg is then
         * recorded `stopped` with what had drained.
         */
        stop() {
            if (goal && phase !== 'idle') {
                if (phase === 'playing') {
                    const d = J(game()?.botDrain?.());
                    if (d) play.progress = foldDrain(play.progress, d);
                }
                const last = play?.progress?.rows?.at(-1) ?? null;
                history.push({ goal, outcome: 'stopped', producer: play?.plan?.producer ?? null, phase, ticks: play?.ticks ?? null,
                    drained: play?.progress?.ticks ?? null, verbs: play?.plan?.verbs ?? null, solvedMs: play?.solvedMs ?? null,
                    divergence: play?.divergence ?? null, recoveries, lastRow: last, expectedEnd: play?.plan?.expected?.at(-1) ?? null });
            }
            queued = null;
            release();
            reset();
            goal = null;
            note(null);
        },
        liveLevel() { const l = readState().level; return Number.isInteger(l) ? l : null; },
        /** ⛓ WG — whether this engine stages a mounted generated set. */
        get generated() { return generated; },
        status() {
            return { phase, goal, generated, queued: queued?.goal ?? null, ticks: play?.ticks ?? null,
                drained: play?.progress?.ticks ?? null, divergence: play?.divergence ?? null, recoveries };
        },
        get stats() { return { ...stats, hostStarts: [...stats.hostStarts], keyReleases: [...stats.keyReleases], history: [...history] }; },
        /** ⛓ WG — the last arrivals' raw reads (`{seam, status, state}`), for a fixture recorder. */
        get arrivalReads() { return arrivalReads.map((a) => structuredClone(a)); },
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
