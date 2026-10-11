/**
 * seedlingDemo/solveProgressTap — ⛓ SOLVE PROGRESS (JS half): **THE WORKER'S END OF THE PROGRESS STREAM**.
 *
 * The solver's half (`solveProgress.js`, hammer-phase D1) calls `onProgress(site, peek)` at its own deterministic
 * points; this is the hook the solve worker installs around `solveAnytime` (`jsRuntimeSolveWorker.js`) when the page
 * asked for progress, and what it posts. The schema is `docs/json/developer/procgen/seedling-solve-progress.md`.
 *
 *  - THROTTLED BY THE WORKER'S WALL CLOCK: at most one post per `minIntervalMs` (1 s), and `peek()` is called only
 *    for a post — plus once at each segment's `done` (to bank its work, below) and once after the solve
 *    (`finish()`, the FINAL snapshot, so the view shows the finished state). The hook calls come only at solver
 *    sites, so the interval is a CEILING, never a rate.
 *  - ⛔ THE CLOCK NEVER REACHES THE SOLVER: it is read here, in the hook, and decides only whether to post. The hook
 *    returns nothing and the solver reads nothing back (`solveProgress.js`'s contract).
 *  - THE METER. `budget.work.shouldStop` is cumulative per SEGMENT, while the page's work clock
 *    (`jsRuntimeSolver.createWorkClock`) runs per ATTEMPT across every pass's segments. So the tap banks each
 *    segment's final `shouldStop` at its `done` and stamps `budget.spent = {shouldStop: Σ earlier segments + this
 *    one's}` — the attempt's units, what `passShouldStop` compares — and `budget.limit = {shouldStop: budgetWork,
 *    window?}` (the solver writes no limit: the budget is the caller's). `window` is present only while the window
 *    bounds the pass running (`stop: 'window'` with a plan in hand — `passShouldStop`'s rule).
 *  - `segment.pass` is stamped with the anytime pass running (the passes landed so far = the index of the next).
 *
 * The stamps go on the POSTED copy (a `peek()` is a fresh object): nothing is written back into the solver.
 */

// ⛔ IMPORT-FREE: the page side (`jsRuntimeSolveService.js`) imports this module's message name, and must not pull
// the solver's module graph in with it.

/** The worker's post ceiling: one progress post per this many ms of its own clock. */
export const SOLVE_PROGRESS_INTERVAL_MS = 1000;

/** The message type the worker posts (`{type, id, snapshot, final?}`). */
export const SOLVE_PROGRESS_MESSAGE = 'solve-progress';

/**
 * @param {object} o
 * @param {(snapshot: object, final: boolean) => void} o.post
 * @param {() => number} o.clock  the worker's wall clock (ms) — the throttle's only input
 * @param {number} [o.minIntervalMs]
 * @param {ReadonlyArray<object>} o.passes  the anytime passes the solve runs (`ANYTIME_PASSES` or the request's own)
 * @param {?number} [o.budgetWork]  the request's budget, work units (null in place: no limit)
 * @param {?number} [o.windowAt]  the RESOLVED upgrade window, work units from the attempt's start
 *   (`jsRuntimeSolver.upgradeWindowWork(budgetWork, request's window)` — the worker resolves it)
 */
export function createProgressTap({ post, clock, minIntervalMs = SOLVE_PROGRESS_INTERVAL_MS, passes,
    budgetWork = null, windowAt = null }) {
    let lastPost = -Infinity;
    let lastPeek = null;
    let landed = 0;
    let planInHand = false;
    /** segment index -> its final `shouldStop` (banked at its `done`). */
    const finals = new Map();
    /**
     * segment index -> `{pass, windowed}` as of the first time the tap read it (a post, or at the latest its `done`,
     * which comes before its pass lands): a segment keeps the pass it RAN in, so the final snapshot — read after the
     * last pass landed — still names its own pass, not the last one.
     */
    const ofSegment = new Map();
    const stats = { calls: 0, peeks: 0, posts: 0 };

    const read = (peek) => { stats.peeks += 1; return peek(); };

    function stamp(snap) {
        const index = snap.segment?.index ?? 0;
        let spent = 0;
        for (const [i, n] of finals) if (i < index) spent += n;
        spent += snap.budget?.work?.shouldStop ?? 0;
        if (!ofSegment.has(index)) {
            const p = passes[Math.min(landed, passes.length - 1)] ?? null;
            ofSegment.set(index, { pass: p?.pass ?? null, windowed: p?.stop === 'window' && planInHand });
        }
        const { pass, windowed } = ofSegment.get(index);
        if (pass !== null && snap.segment && snap.segment.pass === undefined) snap.segment.pass = pass;
        if (snap.budget) {
            snap.budget.spent = { shouldStop: spent };
            if (Number.isFinite(budgetWork) && budgetWork > 0) {
                snap.budget.limit = { shouldStop: budgetWork,
                    ...(windowed && Number.isFinite(windowAt) ? { window: windowAt } : {}) };
            }
        }
        return snap;
    }

    function send(snap, final) {
        stats.posts += 1;
        post(stamp(snap), final);
    }

    return {
        stats,
        /** The `onProgress(site, peek)` to install (`withSolveProgress`). */
        hook(site, peek) {
            stats.calls += 1;
            lastPeek = peek;
            const now = clock();
            const due = now - lastPost >= minIntervalMs;
            if (site !== 'done' && !due) return;
            const snap = read(peek);
            if (snap === null) return;
            if (site === 'done') finals.set(snap.segment.index, snap.budget?.work?.shouldStop ?? 0);
            if (!due) return;
            lastPost = now;
            send(snap, false);
        },
        /** The solve's `onPass` (a pass landed): the pass and plan-in-hand the stamps read. */
        onPass(answer, best) {
            landed += 1;
            planInHand = best?.ok === true;
        },
        /** After the solve: post the FINAL snapshot (the finished state), if the solver ever reported one. */
        finish() {
            if (lastPeek === null) return;
            const snap = read(lastPeek);
            if (snap !== null) send(snap, true);
        },
    };
}
