/**
 * seedlingDemo/solveProgressTap — ⛓ SOLVE PROGRESS (JS half): **THE WORKER'S END OF THE PROGRESS STREAM**.
 *
 * The solver's half (`solveProgress.js`, hammer-phase D1) calls `onProgress(site, peek)` at its own deterministic
 * points; this is the hook the solve worker installs around `solveAnytime` (`jsRuntimeSolveWorker.js`) when the page
 * asked for progress, and what it posts. The schema is `docs/json/developer/procgen/seedling-solve-progress.md`.
 *
 *  - THROTTLED BY THE WORKER'S WALL CLOCK: at most one post per `minIntervalMs` — ⚖ the panel's setting
 *    `flashPanel.seedlingSolveProgressIntervalMs` (`SOLVE_PROGRESS_INTERVALS_MS`, default 100 ms), carried on the
 *    solve's ENVELOPE as `progressIntervalMs` and clamped to the list by `progressIntervalMs()` — and `peek()` is called only
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
 *  - ⛓ SOLVE-PROGRESS S3 (Tier B) — four more stamps, every one read from the tap's own clock or from what the worker
 *    already holds (the request, `onPass`'s `best`, the envelope), so `v` stays 1:
 *     · `budget.wallBySite = {'<from>→<to>': ms}` — each hook call charges the gap since the previous one to the pair
 *       of sites it spans (`start` = the tap's creation, `end` = `finish()`), summed over the ATTEMPT (the tap cannot
 *       tell a segment apart without a `peek()`, which it saves for a post). Σ = the attempt's wall ms so far.
 *     · `budget.rate = {unitsPerSec, toWindowMs?, toLimitMs?}` — `budget.spent` over the attempt's wall clock, and the
 *       ms left at that rate to the window (only while it bounds the pass) and to the limit (only with a budget).
 *     · `best = {ok, ticks, pass}` — the plan in hand (`onPass`'s best so far); absent until a pass landed.
 *     · `request` — WHO is being solved, ONCE per solve (the first post only): `requestIdentity()` — the tape name,
 *       the boot level, `seam.time`, the passes, the budget and window, the off-default switch stamps the request
 *       carries, and the held retry (`attempt`, the envelope's `progressAttempt`: the service's label `640 → 2560`).
 *
 * The stamps go on the POSTED copy (a `peek()` is a fresh object): nothing is written back into the solver.
 */

// ⛔ IMPORT-FREE: the page side (`jsRuntimeSolveService.js`) imports this module's message name, and must not pull
// the solver's module graph in with it.

/**
 * ⚖ The refresh rates the user allowed (2026-10-17): one progress post per this many ms of the worker's own clock, at
 * most. The solver reports only at its own sites, so these are CEILINGS: a stretch with no site posts nothing.
 */
export const SOLVE_PROGRESS_INTERVALS_MS = Object.freeze([1000, 250, 100, 50]);

/** The default post ceiling (⚖ the user 2026-10-17: 100 ms, "for now"); the schema's default is this constant. */
export const SOLVE_PROGRESS_INTERVAL_MS = 100;

/**
 * An asked interval CLAMPED TO THE LIST: the fastest listed rate that is no faster than asked (an ask between two
 * values gets the slower one; past either end, the end). Not a finite number → the default.
 */
export function progressIntervalMs(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return SOLVE_PROGRESS_INTERVAL_MS;
    const slowestFirst = [...SOLVE_PROGRESS_INTERVALS_MS].sort((a, b) => b - a);
    let out = slowestFirst[0];
    for (const ms of slowestFirst) if (ms >= value) out = ms;
    return out;
}

/**
 * ⛓ S3 — the request stamps that name an OFF-DEFAULT switch (`jsRuntimeSolveService.stampHooks`: each is on the request
 * only off-default, so an absent key IS the default).
 */
export const SOLVE_PROGRESS_SWITCH_KEYS = Object.freeze(['killLockBodies', 'contactFidelity', 'axeDodgeAskPerPreview',
    'dashShape', 'dashOnlyWindow']);

/**
 * ⛓ S3 — a held retry's label: the work budgets the solve has run under, in order (`[640, 2560]` → `640 → 2560`).
 * @param {{retry?: number, budgets?: number[]}|null} attempt
 */
export const attemptLabel = (attempt) => (attempt?.budgets ?? []).join(' → ');

/**
 * ⛓ S3 — the `request` stamp: what the solve is, read from the request the worker received (never written back).
 * @param {object} tape  the request minus `source`/`levelSource`
 * @param {{passes?: ReadonlyArray<object>, windowAt?: ?number, attempt?: ?{retry:number, budgets:number[]}}} [o]
 */
export function requestIdentity(tape, { passes = null, windowAt = null, attempt = null } = {}) {
    const switches = {};
    for (const k of SOLVE_PROGRESS_SWITCH_KEYS) if (tape?.[k] !== undefined && tape[k] !== null) switches[k] = tape[k];
    const seamTime = tape?.staging?.seam?.time;
    return {
        name: tape?.name ?? null,
        level: tape?.staging?.boot?.level ?? null,
        seamTime: Number.isFinite(seamTime) ? seamTime : null,
        goal: tape?.solverGoal?.kind ?? null,
        passes: passes ? passes.map((p) => p?.pass ?? null) : null,
        budgetWork: tape?.budgetWork ?? null,
        windowAt: Number.isFinite(windowAt) ? windowAt : null,
        switches,
        ...(attempt ? { attempt: { retry: attempt.retry ?? 0, budgets: [...(attempt.budgets ?? [])], label: attemptLabel(attempt) } } : {}),
    };
}

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
 * @param {?object} [o.request]  ⛓ S3 — the `request` stamp (`requestIdentity`), posted once, on the first post
 */
export function createProgressTap({ post, clock, minIntervalMs = SOLVE_PROGRESS_INTERVAL_MS, passes,
    budgetWork = null, windowAt = null, request = null }) {
    // ⛓ S3 — the attempt's wall clock starts with the tap (the worker builds it just before the solve).
    const startedAt = clock();
    let lastCallAt = startedAt;
    let lastSite = 'start';
    /** `'<from>→<to>'` -> wall ms (⛓ S3 `budget.wallBySite`). */
    const wallBySite = new Map();
    let bestStamp = null;
    let requestSent = false;
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

    function charge(site, now) {
        const key = `${lastSite}→${site}`;
        wallBySite.set(key, (wallBySite.get(key) ?? 0) + (now - lastCallAt));
        lastCallAt = now;
        lastSite = site;
    }

    function rateOf(spent, limit, now) {
        const sec = (now - startedAt) / 1000;
        if (!(sec > 0)) return null;
        const unitsPerSec = Math.round((spent / sec) * 100) / 100;
        const left = (at) => (Number.isFinite(at) && spent / sec > 0 ? Math.round((Math.max(0, at - spent) / (spent / sec)) * 1000) : null);
        const toWindowMs = left(limit?.window);
        const toLimitMs = left(limit?.shouldStop);
        return { unitsPerSec, ...(toWindowMs !== null ? { toWindowMs } : {}), ...(toLimitMs !== null ? { toLimitMs } : {}) };
    }

    function stamp(snap, now) {
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
            snap.budget.wallBySite = Object.fromEntries(wallBySite);
            const rate = rateOf(spent, snap.budget.limit, now);
            if (rate) snap.budget.rate = rate;
        }
        if (bestStamp) snap.best = { ...bestStamp };
        if (request && !requestSent) {
            requestSent = true;
            snap.request = structuredClone(request);
        }
        return snap;
    }

    function send(snap, final, now) {
        stats.posts += 1;
        post(stamp(snap, now), final);
    }

    return {
        stats,
        /** The `onProgress(site, peek)` to install (`withSolveProgress`). */
        hook(site, peek) {
            stats.calls += 1;
            lastPeek = peek;
            const now = clock();
            charge(site, now);
            const due = now - lastPost >= minIntervalMs;
            if (site !== 'done' && !due) return;
            const snap = read(peek);
            if (snap === null) return;
            if (site === 'done') finals.set(snap.segment.index, snap.budget?.work?.shouldStop ?? 0);
            if (!due) return;
            lastPost = now;
            send(snap, false, now);
        },
        /** The solve's `onPass` (a pass landed): the pass and plan-in-hand the stamps read, and ⛓ S3 the plan in hand. */
        onPass(answer, best) {
            landed += 1;
            planInHand = best?.ok === true;
            if (best && best.kind !== 'skipped') {
                bestStamp = { ok: best.ok === true, ticks: best.ok === true ? best.plan?.solution?.length ?? null : null,
                    pass: best.pass ?? null };
            }
        },
        /** After the solve: post the FINAL snapshot (the finished state), if the solver ever reported one. */
        finish() {
            const now = clock();
            charge('end', now);
            if (lastPeek === null) return;
            const snap = read(lastPeek);
            if (snap !== null) send(snap, true, now);
        },
    };
}
