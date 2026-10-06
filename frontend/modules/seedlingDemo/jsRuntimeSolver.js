/**
 * seedlingDemo/jsRuntimeSolver — **THE PLAYBACK BOT'S SOLVER MODE ON THE
 * SEEDLING JS RUNTIME** (solver-walk S1).
 *
 * Opt-in (`flashPanel.seedlingSolverWalk`, default OFF — ⚖ Q3: the solve is
 * SYNCHRONOUS on the page's main thread until S2's Worker lands). With it on,
 * the walker asks this module for each tick's keys before walking itself:
 *
 *   1. MAP the goal (REAL rooms only: the vanilla map, or ⛓ §5.18 a
 *      delivered set of real rooms). A walker `exit` → `reach-exit
 *      {exit}` at the live teleporter the walker resolved (its OEL x, y), or
 *      ⛓ S4 `reach-pit {pit}` when it resolved a PIT tile (`out_pit_*`); a
 *      `location` → `collect-placement {placement}` at the entity's OEL x, y
 *      (a chest, a pickup, or an `apitem` — F2's strategy `apitem`).
 *      A `tile` goal, and EVERY goal of a mounted GENERATED set, stay on the
 *      J2 walker (the solver has no tile goal, and generated rooms are
 *      solver-certified and booted on scratch persistence).
 *   2. SHADOW. `createRunForStaging(session.staging)` replayed through the
 *      session's own `perTick`. Its digest MUST equal the live run's (§1.5):
 *      a mismatch is a PAGE bug and fails the walk by name — never a solve
 *      from a state the live page is not in.
 *   3. SOLVE. `solveSegment({prefix: session.perTick, boot: staging.boot})`
 *      over a RECORDING Proxy of the shadow: every `advance` the solver makes
 *      is a row of the EXPECTED trajectory, every `equipNow` an equip at
 *      that row. (The solver searches no run futures — `solverBot.js` header,
 *      "NO SEARCH OVER RUN FUTURES" — so the advances ARE the solution.)
 *   4. PLAY one key set per page tick (the page's clock stays the only clock;
 *      `jsRuntimeCore` passes `autoAdvanceText: false` while the solver
 *      drives — the solver already pressed every ceremony X), each equip on
 *      the tick the solver made it.
 *   5. CHECK every tick: the live (run, level, x, y, deaths) against the
 *      expected row. A mismatch (an item re-boot, a host teleport, a death the
 *      solver did not predict) REFUTES the plan and re-solves from the live
 *      state; the `MAX_REFUTATIONS`th refutation of one goal FAILS it by name.
 *   6. A REFUSAL (the solver's own, or the model's inside the solve) DECLINES:
 *      the walker walks that goal instead, carrying the solver's reason in
 *      its status — never silently.
 *   7. `instant` is the core's burst over the planned keys (a page tick each).
 *
 * ⛓ S2 — THE WORKER AND THE BUDGET. Steps 2–3 run behind a SOLVE SERVICE
 * (`solveService`): the page's is a module Worker
 * (`jsRuntimeSolveService.createWorkerSolveService` →
 * `jsRuntimeSolveWorker.js`), so the page never freezes; with none (node, and
 * every S1 row) the solve runs in place, exactly as S1 did. While a solve is
 * in flight `keysFor` answers `{solving}` and the page HOLDS the model — its
 * frame clock, paint, queue drain and reports keep running, but the run does
 * not step — so a plan is always played from the very state it was solved
 * from (an idle tick would move the enemies under it). A solve whose run was
 * replaced (a re-boot) or whose session moved meanwhile is STALE: refuted,
 * never played. ⛓ DETERMINISTIC BUDGET: the solve is bounded in WORK units
 * (`SOLVER_BUDGET_WORK`, `passShouldStop`) inside the worker, so its answer —
 * a plan, or a refusal that DECLINES by name (the walker walks and may RETRY,
 * `jsRuntimeWalker`, `SOLVER_RETRY_*`) — is the same on every machine; the
 * page only WAITS for it. A solve past the wall-clock backstop
 * (`SOLVE_BACKSTOP_MS`) FAILS the goal by name — never a different answer.
 *
 * ⛔ DOM-FREE AND CLOCK-FREE, like the walker. ⛔ It changes nothing in the
 * solver or the model: `prefix` (S0) is the only admission it uses.
 */

import { createRunForStaging } from './tapeRunner.js';
import { DEFAULT_DASH_MODE, solveSegment } from './solverBot.js';
import { levelSourceFromAtlas } from './atlasSource.js';
import { TILE_SIZE } from './levelWorld.js';

/** Refutations of one goal's plans before the goal FAILS, by name (§2.2 step 5). */
export const MAX_REFUTATIONS = 3;

/**
 * ⛓ S2 — a worker that has not STARTED a solve this long after it was asked (a module load that hangs).
 * ⛓ DETERMINISTIC BUDGET: a backstop like `SOLVE_BACKSTOP_MS` — it FAILS the goal by name, never walks it.
 */
export const LOAD_BUDGET_MS = 30000;
/**
 * ⛓ S2 — the decline-retry policy (S1 residue): a declined goal is walked,
 * and the solver is asked AGAIN after a death, a crossing, or this many
 * walker ticks — §1.6: from W=60 the solver refused the L6 leg (W=71 since swim R4), from W=150 it
 * solved it — at most `SOLVER_RETRY_MAX` times per goal, each retry named.
 */
export const SOLVER_RETRY_AFTER_TICKS = 90;
export const SOLVER_RETRY_MAX = 3;

const seconds = (ms) => `${Math.round(ms / 100) / 10} s`;

/**
 * The state a shadow must reproduce: §1.5's digest, plus the selected slot
 * (`primary`) — an equip rides on no key, so a shadow that missed one would
 * otherwise match until the next X press.
 */
export function runDigest(run) {
    return JSON.stringify({
        L: run.level, s: run.state, t: run.ticksCompleted, d: run.playerDeaths.length, p: run.primary,
        tr: run.transitions.length, c: run.entities('chasers'), sb: run.entities('strikeBodies'),
    });
}

/** The per-tick check's row: what the live run must be at, tick by tick. */
const rowOf = (run) => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
const sameRow = (a, b) => a.level === b.level && a.x === b.x && a.y === b.y && a.deaths === b.deaths;
const showRow = (r) => `level ${r.level} (${r.x}, ${r.y}) deaths ${r.deaths}`;

/** A shadow that is not the live run: a PAGE bug (step 2), never a solver verdict. */
export class ShadowDivergence extends Error {
    constructor(message) { super(message); this.name = 'ShadowDivergence'; }
}

/** ⛓ ANYTIME — a pass that would only repeat the one before it (its added strategy is unusable): not run, named. */
export class PassSkipped extends Error {
    constructor(message) { super(message); this.name = 'PassSkipped'; }
}

/**
 * ⛓ ANYTIME — the optional strategies a later pass ADDS, each with its
 * availability on the shadow at the solve's start: a reason it is unusable,
 * or null. Unusable → the pass would search exactly what the pass before it
 * searched, so it is skipped (a door-only L14 decline would otherwise be
 * paid twice, 4.9–8.2 s each, measured by slice `seedling-js-l16-budget`).
 * `sword-dash`: `planSwordDash` and `strikePolicyFor` act only with a sword
 * in hand (`solverBot.js`: `hasSword || hasGhostSword`), so without one
 * `dashMode` changes nothing.
 */
export const PASS_STRATEGIES = Object.freeze({
    'sword-dash': (run) => {
        const inv = run.progress('inventory') ?? {};
        return inv.hasSword || inv.hasGhostSword ? null : 'the run holds no sword';
    },
});

/**
 * ⛓ ANYTIME (the user, 2026-10-04: *"first search for solutions that don't
 * involve sword dashes, then if it finds a dashless solution, and runs out of
 * time while searching the dash options, it falls back on the solution it
 * already found. This same pattern might work for other expensive and
 * optional strategies."*) — the passes one solve runs, CHEAPEST FIRST. Each
 * later pass ADDS one expensive optional strategy (`adds`, `PASS_STRATEGIES`)
 * and keeps everything the passes before it had; its plan replaces the one in
 * hand only when it is BETTER (`betterAnswer`). Only what `solveSegment`
 * already exposes is a pass: today that is `dashMode` (R9 12i). Measured
 * (slice `seedling-js-l16-budget`, captured live arrivals): dash planning is 62–99 % of the
 * slow solves (L16, B L14, L71 kit) and in the plan on 9 of 24 legs, each
 * saving 8–95 ticks; dashless, 23 of 24 captured legs solve in ≤ 1.4 s.
 * `full` is `DEFAULT_DASH_MODE` — the one search every solve made before.
 */
export const ANYTIME_PASSES = Object.freeze([
    Object.freeze({ pass: 'dashless', dashMode: 'none', stop: 'all' }),
    Object.freeze({ pass: 'full', dashMode: DEFAULT_DASH_MODE, adds: 'sword-dash', stop: 'sword-dash' }),
]);

/**
 * ⛓ DETERMINISTIC BUDGET (⚖ the user, 2026-10-05: *"Yes, I want plans to be
 * identical on every machine. And we can increase the limit above one second
 * if necessary. It used to be at 5 seconds."*) — **A SOLVE'S BUDGETS ARE
 * WORK, NOT MILLISECONDS.** One WORK UNIT is one call of `solveSegment`'s
 * `shouldStop(site)` hook (fidelity SF2): the solver asks it before each
 * optional scan (`DEADLINE_SITES`), the solver reads no clock, so the call
 * sequence is a pure function of the request (measured by slice
 * `seedling-js-deterministic-budget`: identical per-site counts and sequence
 * hashes beside a 12-process CPU hog at 3–5× the wall time). A slow machine
 * takes LONGER to reach the same answer; it never reaches a different one.
 *
 * ⛓ RECALIBRATE — the unit is FINE (`FINE_CHECKPOINTS`, fidelity CHECKPOINTS):
 * the solver also asks inside its once-silent phases (the TIME rung, the core
 * `walk`, DETOUR's via set), so a pass that consults no optional scan still
 * spends units. The ms one unit costs on one box are in `flash.md` "Pass
 * deadlines".
 *
 * `SOLVER_BUDGET_WORK` — every pass of one solve attempt trips every site
 * once the attempt has spent this many units (the dashless pass's lossy
 * bound, so a slow refusal refuses by name; the full pass's, which a page
 * once cut by the wall clock). `SOLVER_UPGRADE_WINDOW_WORK` — once a plan is
 * in hand, the full pass's `sword-dash` site (the lossless one) trips at
 * this many units from the attempt's start: "upgrade briefly, then ship".
 *
 * ⛓ RECALIBRATED in fine units (slice `seedling-js-recalibrate`, node, the
 * captured B/D arrivals, the divergence sweep's legs and fidelity CHECKPOINTS'
 * D3 legs, re-measured on wave 7; was 500 / 40 coarse): 640 lets the slowest
 * SHIPPING dashless pass measured (swordless L14's DETOUR: 624 fine units,
 * 492 coarse) ship on its first attempt; 80 is the smallest window that keeps
 * every leg that upgraded inside the old 1000 ms window upgrading — the
 * largest, L40 (480,896) → its stairs, makes its last dash ask at unit 80
 * (28 dashless + 52); L30 (240,80) at 50. Pinned by
 * `jsRuntimeSolverCalibration.slow.test.js`.
 */
export const SOLVER_BUDGET_WORK = 640;
export const SOLVER_UPGRADE_WINDOW_WORK = 80;
/**
 * ⛓ RECALIBRATE (fidelity CHECKPOINTS) — every budgeted pass opts in to the solver's FINE checkpoints
 * (`solveSegment`'s `fineCheckpoints`): the `time` rung, the core `walk` (a trip there REFUSES the segment
 * by name) and the `detour` via set are asked too, so no stretch of the search runs unasked for long. The
 * work constants above are counted in these fine units. In place (no budget) nothing is asked at all.
 */
export const FINE_CHECKPOINTS = true;
/**
 * ⛓ DETERMINISTIC BUDGET — the WALL-CLOCK BACKSTOP of one solve attempt, from
 * the worker's start. It never decides an answer: when it fires the solve is
 * terminated and the goal FAILS BY NAME ("the solve exceeded the backstop on
 * this machine"); a plan in hand is NOT played. ~5× the calibrated worst
 * SHIPPING attempt (an L40 leg, 62 s on the calibration box; flash.md "Pass
 * deadlines"). A solve with a longer stretch the units cannot see ends here,
 * by name — measured: the sphere-2.2 leg L12 (16,80) → its pit, whose
 * kill-chaser stance scan ran 663 s with no ask on a loaded box (fidelity's to checkpoint).
 */
export const SOLVE_BACKSTOP_MS = 300000;

/**
 * ⛓ SHOULD-STOP → DETERMINISTIC BUDGET — the upgrade window a solve gives its
 * later passes, in work units from the attempt's start: a non-positive /
 * non-finite / absent window is the WHOLE budget, and a window is never
 * longer than the budget it runs under. The knob is
 * `flashPanel.seedlingSolverUpgradeWindowWork` (the JS page's
 * `?solverUpgradeWindowWork=`).
 */
export function upgradeWindowWork(budgetWork, windowWork = null) {
    const w = Number(windowWork);
    return windowWork !== null && Number.isFinite(w) && w > 0 ? Math.min(w, budgetWork) : budgetWork;
}

/** ⛓ DETERMINISTIC BUDGET — one attempt's work clock: the hook calls its passes have made. */
export function createWorkClock() {
    let units = 0;
    return { tick() { units += 1; return units; }, get units() { return units; } };
}

/**
 * ⛓ SHOULD-STOP → DETERMINISTIC BUDGET — one pass's `solveSegment` deadline
 * (`shouldStop`), or null (today's search exactly). It counts every call on
 * the attempt's `work` clock and answers from the count alone — ⛔ NO CLOCK:
 *   every pass        every site trips once the attempt has spent `budgetWork`
 *                     units — LOSSY (a slow refusal refuses by name, the ⏱
 *                     clause); with a plan in hand nothing a later pass says
 *                     can replace it but a shorter plan (`betterAnswer`);
 *   `stop: 'sword-dash'` (the full pass) with a plan IN HAND, also the dash
 *                     site at the UPGRADE WINDOW — the one LOSSLESS site (SF:
 *                     tripping every site early makes r8-solve-4 refuse), so
 *                     the pass RETURNS a partial dash schedule or dashless.
 * `limit` records which bound tripped first ('window' / 'budget'), for the
 * pass row. No budget (the in-place service) → no deadline at all.
 */
export function passShouldStop(p, { budgetWork = null, windowWork = null, planInHand = false, work, limit = {} }) {
    if (!(Number.isFinite(budgetWork) && budgetWork > 0)) return null;
    const windowAt = p.stop === 'sword-dash' && planInHand ? upgradeWindowWork(budgetWork, windowWork) : null;
    return (site) => {
        const n = work.tick();
        if (n > budgetWork) { limit.first ??= 'budget'; return true; }
        if (windowAt !== null && site === 'sword-dash' && n > windowAt) { limit.first ??= 'window'; return true; }
        return false;
    };
}

/** ⛓ SHOULD-STOP — the deadline a pass's answer tripped (`solveSegment`'s `deadline`), or null. */
export const deadlineOf = (answer) => (answer?.ok ? answer.plan?.deadline : answer?.deadline) ?? null;

/**
 * ⛓ ANYTIME — does the answer `next` (a later pass) replace `best` (the one in
 * hand)? A PLAN beats no plan; between two plans the later replaces the
 * earlier only with STRICTLY FEWER TICKS (`solution.length` = game ticks to
 * the goal) — a tie keeps the plan found first, which is the cheaper search's
 * (L71 kit: both passes the same 527 ticks, the dashless one is kept). With
 * no plan in hand, a later REFUSAL is the fuller search's word and replaces
 * an earlier one; a skipped pass never replaces anything.
 */
export function betterAnswer(best, next) {
    if (!next || next.kind === 'skipped') return false;
    if (!best || best.kind === 'skipped') return true;
    if (best.ok) return next.ok === true && next.plan.solution.length < best.plan.solution.length;
    // ⛓ DETERMINISTIC BUDGET — a refusal cut by its deadline is not the fuller search's word: it never
    // replaces a refusal that was not cut (the dashless decline leads, as when a page cut the full pass).
    if (!next.ok && next.deadline && !best.deadline) return false;
    return true;
}

/**
 * ⛓ ANYTIME — run `passes` in order, each a `solveFromTape` of the same tape,
 * and answer with the best (`betterAnswer`). `onPass(answer, best, index)`
 * hears every pass as it lands (the worker posts it: the page keeps `best` as
 * its PROVISIONAL plan, so a budget expiry in a later pass plays it). A
 * divergence ends at once (the page's bug — every later pass replays the same
 * shadow). Every answer is stamped with its `pass`, and the result carries
 * `passes`: one `{pass, ok, kind, ticks, ms}` row per pass that ran.
 */
export function solveAnytime(request, { passes = ANYTIME_PASSES, onPass = () => {}, clock = request.clock ?? (() => Date.now()) } = {}) {
    let best = null;
    let last = null;
    const rows = [];
    // ⛓ DETERMINISTIC BUDGET — the request's budget and upgrade window, in WORK units (absent in place), on
    // ONE work clock from this attempt's start. `clock` only times the rows (`ms`); it decides nothing.
    const { budgetWork = null, upgradeWindowWork: windowWork = null, ...tape } = request;
    const work = createWorkClock();
    for (let i = 0; i < passes.length; i += 1) {
        const p = passes[i];
        const t0 = clock();
        const w0 = work.units;
        const limit = {};
        const shouldStop = passShouldStop(p, { budgetWork, windowWork, planInHand: best?.ok === true, work, limit });
        // ⛓ RECALIBRATE — a budgeted pass always asks the FINE checkpoints (`FINE_CHECKPOINTS`): the constants
        // above are counted in fine units, so every production path (JS page, wasm arrival, continuation,
        // held retry — all of them requests to this function) spends the unit they were calibrated in.
        const answer = settleSolve(() => solveFromTape({ ...tape, clock, dashMode: p.dashMode, adds: p.adds ?? null, shouldStop,
            fineCheckpoints: shouldStop !== null && FINE_CHECKPOINTS }));
        answer.pass = p.pass;
        if (answer.ok) answer.plan.pass = p.pass;
        const tripped = deadlineOf(answer);
        rows.push({ pass: p.pass, ok: answer.ok, kind: answer.kind ?? null, ticks: answer.ok ? answer.plan.solution.length : null,
            ms: Math.round(clock() - t0), ...(shouldStop ? { work: work.units - w0 } : {}),
            ...(tripped ? { deadline: tripped.first, limit: limit.first ?? null } : {}) });
        last = answer;
        if (betterAnswer(best, answer)) best = answer;
        try { onPass(answer, best, i); } catch { /* a listener's bug is not the solve's */ }
        if (answer.kind === 'divergence') { best = answer; break; }
    }
    // Every pass skipped (a held retry resumed at a pass the run cannot use): the skip itself is the
    // answer — `betterAnswer` never lets it replace what an earlier attempt's passes said.
    best ??= last ?? { ok: false, kind: 'refusal', message: 'no solver pass ran' };
    const spent = budgetWork !== null ? { work: work.units } : {};
    return { ...best, passes: rows, ...spent, ...(best.ok ? { plan: { ...best.plan, passes: rows, ...spent } } : {}) };
}

/**
 * ⛓ DETERMINISTIC BUDGET — did any pass of this answer's attempt trip its work BUDGET (not the window)?
 * The deterministic successor of "a page expiry cut the later pass": a plan from an earlier pass is played
 * with `expired`; a refusal leaves the cut pass unanswered for a held retry.
 */
export const budgetCut = (answer) => (answer?.passes ?? answer?.plan?.passes ?? []).some((r) => r.limit === 'budget');

/** ⛓ ANYTIME — the passes not yet answered when a solve was cut (`answered` = how many landed). */
export const passesAfter = (passes, answered) => passes.slice(Math.max(0, answered | 0));

/** ⛓ ANYTIME — how a plan's pass reads in a note: `dashless` / `full`, and why when it was not the last word. */
export function passNote(plan, { expired = false } = {}) {
    if (!plan?.pass) return '';
    const stopped = (plan.passes ?? []).filter((r) => r.deadline).map((r) => `${r.pass} stopped at its deadline (${r.deadline})`);
    return [`pass ${plan.pass}`, ...stopped, ...(expired ? ['the later pass ran out of its work budget'] : [])].join(', ');
}

/**
 * Step 1 — the solver goal for a walker goal, or `{walker: why}` when the
 * goal stays on the J2 walker.
 *
 * @param {object} goal      the walker's goal (`{kind, level, …}`)
 * @param {object} ctx
 * @param {object} ctx.run       the live run
 * @param {object} ctx.resolved  the walker's resolution (`{target, allowTeleporter}`; ⛓ S5 `latched`
 *   while the run stands latched on the goal's teleporter — still the door's `reach-exit`: the solver
 *   steps off a latched door itself, fidelity STEP-OFF)
 * @param {object|null} ctx.placement  the location's entity (`{x, y}`, OEL), real rooms only
 * @param {boolean} ctx.generated  a GENERATED level set is mounted (⛓ §5.18 — a delivered set of real rooms is not)
 */
export function solverGoalFor(goal, { run, resolved, placement = null, generated = false }) {
    // ⛔ A GENERATED set keeps the J2 walker for every goal: its rooms are
    // solver-certified (no enemies, no puzzles to solve) and its sessions run
    // on scratch persistence. ⛓ §5.18 — a delivered set of REAL rooms does
    // not: it is the vanilla 116 rewritten only at their AP locations.
    if (generated) return { walker: 'a generated level set keeps the J2 walker' };
    if (goal?.kind === 'exit' && resolved?.pit) {
        // ⛓ S4 — a pit exit → `reach-pit` at the pit TILE the walker resolved (its rect origin = tile·16).
        const { tx, ty } = resolved.pit;
        return { goal: { kind: 'reach-pit', pit: { tx, ty, x: tx * TILE_SIZE, y: ty * TILE_SIZE } } };
    }
    if (goal?.kind === 'exit') {
        // ⛓ S5 → STEP-OFF RETIRE — latched ON the goal's teleporter (an arrival on the door) is the
        // door's `reach-exit` too: `solveSegment` steps off a latched door and walks back (a `step-off`
        // verb), or refuses a closed pocket by name (`closed — the run stands LATCHED …`).
        const tp = run?.world?.teleporters?.[resolved?.allowTeleporter];
        if (!tp) return { walker: 'no live teleporter resolved for the exit' };
        return { goal: { kind: 'reach-exit', exit: { x: tp.x, y: tp.y } } };
    }
    if (goal?.kind === 'location') {
        if (!placement) return { walker: 'the location names no entity of the room' };
        return { goal: { kind: 'collect-placement', placement: { x: placement.x, y: placement.y } } };
    }
    return { walker: `a ${goal?.kind ?? 'missing'} goal has no solver goal kind` };
}

/** The session's tape replayed into a fresh run — a shadow, NOT yet checked against anything. */
export function replayTape({ staging, perTick, levelSource, scratchPersistence = false, equips = null }) {
    const shadow = createRunForStaging(staging, levelSource, { scratchPersistence });
    perTick.forEach((h, i) => {
        // ⛓ An equip the PLAY made on the live run is not in the session's
        // keys (a tape carries an equip as a field) — re-made at its tick.
        const slot = equips?.get(i);
        if (slot !== undefined) shadow.equipNow(slot);
        shadow.advance(h);
    });
    return shadow;
}

/** A shadow whose digest is not the live one: the page's bug, by name. */
function assertShadow(shadow, live, ticks) {
    if (runDigest(shadow) !== live.digest) {
        throw new ShadowDivergence('the shadow replay of the page\'s own session does not reproduce the live run — '
            + `a page bug, not a solver verdict (${ticks} tick(s) replayed; `
            + `live ${showRow(live.row)}, shadow ${showRow(rowOf(shadow))})`);
    }
    return shadow;
}

/** What the shadow must reproduce, off the live run: its digest and its row. */
export const liveOf = (run) => ({ digest: runDigest(run), row: rowOf(run) });

/** Step 2 — the session's own tape replayed into a fresh run, asserted equal to the live run. */
export function replayShadow(session, levelSource, {
    // ⛓ S3 — by default the shadow carries the session's own persistence mode.
    scratchPersistence = session.run?.scratchPersistence === true, equips = null,
} = {}) {
    const shadow = replayTape({ staging: session.staging, perTick: session.perTick, levelSource, scratchPersistence, equips });
    return assertShadow(shadow, liveOf(session.run), session.perTick.length);
}

/**
 * ⛓ S2 — steps 2–3 from a TAPE (staging + the session's keys + the live
 * digest), the form a worker receives: nothing in it is the live run. The
 * plan it returns is structured-cloneable (Sets, a Map, plain rows).
 */
export function solveFromTape({ staging, perTick, live, levelSource, solverGoal, name = 'js-runtime-solve',
    scratchPersistence = false, equips = null, clock = () => Date.now(), dashMode = DEFAULT_DASH_MODE, adds = null,
    shouldStop = null, fineCheckpoints = false }) {
    const t0 = clock();
    const shadow = assertShadow(replayTape({ staging, perTick, levelSource, scratchPersistence, equips }), live, perTick.length);
    const replayMs = clock() - t0;
    // ⛓ ANYTIME — a pass whose added strategy the run cannot use would replay the pass before it exactly.
    const available = adds ? PASS_STRATEGIES[adds] : null;
    const unusable = !adds ? null : available ? available(shadow) : `no strategy is named ${adds}`;
    if (unusable) throw new PassSkipped(`${adds} is not available here: ${unusable}`);
    const expected = [rowOf(shadow)];
    const equipsAt = new Map();
    // ⛓ WASM EQUIPS — the model's inventory at each equip: a host that ships the equip checks the GAME's slot at
    // that index holds the same item (`wasmDelivery.equipSlotRefusal`; the game appends a late slot).
    const equipItems = new Map();
    const run = new Proxy(shadow, {
        get(target, prop) {
            const v = Reflect.get(target, prop);
            if (prop === 'advance') {
                return (...args) => {
                    const out = v.apply(target, args);
                    expected.push(rowOf(target));
                    return out;
                };
            }
            if (prop === 'equipNow') {
                return (slot) => {
                    const out = v.call(target, slot);
                    equipsAt.set(expected.length - 1, slot);
                    equipItems.set(expected.length - 1, { ...target.inventory });
                    return out;
                };
            }
            return typeof v === 'function' ? v.bind(target) : v;
        },
    });
    const t1 = clock();
    // ⛓ SHOULD-STOP — the pass's deadline (`passShouldStop`; null = today's search exactly).
    // ⛓ RECALIBRATE — and whether it also asks the fine sites (`time`, `walk`, the via-set `detour`; only with a hook).
    const out = solveSegment({ run, goals: [solverGoal], name, boot: staging.boot, prefix: perTick, dashMode, shouldStop,
        ...(shouldStop ? { fineCheckpoints: fineCheckpoints === true } : {}) });
    const solveMs = clock() - t1;
    const solution = out.perTick.slice(perTick.length).map((h) => new Set(h));
    if (solution.length !== expected.length - 1) {
        // The recording and the tape disagree — the plan cannot be checked tick by tick.
        throw new ShadowDivergence(`the solve returned ${solution.length} key set(s) but the shadow advanced `
            + `${expected.length - 1} time(s) — the expected trajectory cannot be checked`);
    }
    const verbs = [...new Set((out.trace?.rows ?? []).map((r) => r.strategy?.verb).filter(Boolean))].sort();
    return { solution, expected, equipsAt, equipItems, verbs, replayMs, solveMs, prefixLength: perTick.length, dashMode,
        // ⛓ SHOULD-STOP — `{tripped, first, sites}` when the pass's deadline tripped (named in the history), else null
        deadline: out.deadline ?? null };
}

/**
 * Steps 2–3 — solve `solverGoal` from the session's live state. Returns the
 * plan: `solution[i]` is the key set for the i-th tick after the solve,
 * `expected[i]` the row the live run must be at BEFORE that tick
 * (`expected[solution.length]` = where the solve ended), `equipsAt` maps a
 * tick index to the slot to equip before it. Throws the solver's refusal.
 */
export function solveFromLive({ session, levelSource, solverGoal, name = 'js-runtime-solve', scratchPersistence = false,
    equips = null, clock = () => Date.now() }) {
    return solveFromTape({ staging: session.staging, perTick: session.perTick, live: liveOf(session.run), levelSource,
        solverGoal, name, scratchPersistence, equips, clock });
}

/**
 * ⛓ S2 — the answer a solve service settles with: `{ok: true, plan}`, or
 * `{ok: false, kind, message}` where `kind` is `'divergence'` (the page's
 * bug — the walk fails), `'refusal'` (the solver's own — declines), or
 * `'budget'` (terminated — declines). A worker cannot throw a class across
 * the boundary, so the kind travels as data.
 */
export function settleSolve(fn) {
    try {
        return { ok: true, plan: fn() };
    } catch (err) {
        if (err instanceof ShadowDivergence) return { ok: false, kind: 'divergence', message: String(err.message) };
        if (err instanceof PassSkipped) return { ok: false, kind: 'skipped', message: String(err.message) };
        const pending = err?.name === 'PendingDeclaration' ? err.pending ?? null : null;
        if (pending) return { ok: false, kind: 'refusal', declaration: { ...pending, phases: undefined }, message: declarationRefusal(pending, err) };
        // ⛓ SHOULD-STOP — a refusal raised after the pass's deadline tripped carries it (and its ⏱ clause).
        // ⛓ SLOTS CONSUMER (fidelity STEPOFF2) — and the refusal's `obstacle` (`{kind, id, floors?, solids?}`: `closed` /
        // `hazard-floor` / `inside-solid` …), as plain data, so a consumer reads the NAME rather than the words.
        return { ok: false, kind: 'refusal', message: String(err?.message ?? err), ...(err?.deadline ? { deadline: err.deadline } : {}),
            ...(err?.obstacle ? { obstacle: plainObstacle(err.obstacle) } : {}) };
    }
}

/** A refusal's obstacle as data that crosses a worker boundary (its own fields; nothing it does not carry). */
function plainObstacle(o) {
    try { return JSON.parse(JSON.stringify(o)); } catch { return { kind: o?.kind ?? null, id: o?.id ?? null }; }
}

/**
 * ⛓ S3 — a `PendingDeclaration` the page cannot discharge, said by name.
 *
 * The page's runs are SCRATCH (`jsRuntimeCore`, ⚖ Q4), so a kill lock's
 * clear — the `model`-sourced declaration `twoPassSolve`'s discovery arm
 * exists for — is written by the run itself and never reaches here. What
 * does is `source: 'game'`: a static `"Enemy"` body whose death §11.4 refuses
 * to compute, so only the RUNNING GAME's `persistence_cleared` may name its
 * tick (`twoPassSolve`'s `gameTick` oracle). (L8's sandtrap was the one case
 * until fidelity F5 lifted §11.4 for the SandTrap; no committed room raises
 * one now.) The JS page has no game to ask, and a tick the page invented
 * would be the second writer of that slot — so it declines, and the walker
 * walks. A `model`-sourced one here would be a scratch run that did not
 * write its own clear: named as the defect it is.
 */
export function declarationRefusal(pending, err = null) {
    const what = `{${pending.level},${pending.tag}}${pending.body ? ` (${pending.body})` : pending.lock ? ` (${pending.lock})` : ''}`;
    if (pending.source === 'game') {
        return `the goal waits on a GAME-sourced declaration ${what}: §11.4 refuses to compute that body's `
            + 'death, so only the running game may name its tick, and the JS page has no game oracle';
    }
    return `the solver raised a ${pending.source}-sourced declaration ${what} on a scratch run, which should `
        + `have written that clear itself — ${String(err?.message ?? '').split('\n')[0]}`;
}

/**
 * ⛓ S2 — the in-place service (no worker): `start` solves synchronously and
 * returns an already-settled handle. S1's behaviour exactly; the node rows'
 * default. `request.levelSource` may be given directly here.
 */
export function createInPlaceSolveService({ clock = () => Date.now() } = {}) {
    return {
        kind: 'in-place',
        start(request) {
            const levelSource = request.levelSource ?? levelSourceFromAtlas(request.source.records);
            // ⛓ ANYTIME — no budget in place: every pass runs, the best answer is the result.
            // ⛓ SHOULD-STOP — so no deadline either (`passShouldStop` answers null without a budget).
            const { passes = ANYTIME_PASSES, budgetWork, upgradeWindowWork: windowWork, ...rest } = request;
            const result = solveAnytime({ ...rest, levelSource, clock }, { passes, clock });
            return { settled: true, started: true, result, cancel() {} };
        },
        warm() {},
        dispose() {},
    };
}

/**
 * The solver mode the walker consults (`createRuntimeWalker`'s `solver` dep).
 *
 * @param {object} deps
 * @param {() => object|null} deps.getSession   the page's live session
 * @param {() => object|null} deps.getLevelSource  the room source the session was booted from
 * @param {() => Map|null} [deps.getRecords]  ⛓ S2 — that source's records (level → record), what a worker is sent
 * @param {object|null} [deps.solveService]  ⛓ S2 — where steps 2–3 run (`createWorkerSolveService`); null = in place (S1)
 * @param {number} [deps.budgetWork]  ⛓ DETERMINISTIC BUDGET — one solve's budget in WORK units (`SOLVER_BUDGET_WORK`)
 * @param {number|null} [deps.upgradeWindowWork]  the full pass's dash deadline in work units from the solve's
 *   start (`upgradeWindowWork`); null = the whole budget
 * @param {number} [deps.backstopMs]  the wall-clock backstop (`SOLVE_BACKSTOP_MS`): past it the goal FAILS by name
 * @param {(goal:object) => ({x:number, y:number}|null)} deps.placementOf  a location's entity (OEL)
 * @param {() => boolean} deps.isGenerated  a GENERATED set is mounted (⛓ §5.18 — not a delivered set of real rooms)
 * @param {(e:object) => void} [deps.onEvent]  `{type, message, …}` per solve / refutation / decline
 */
export function createRuntimeSolver({
    getSession, getLevelSource, getRecords = () => null, placementOf = () => null, isGenerated = () => false,
    onEvent = () => {}, maxRefutations = MAX_REFUTATIONS, clock = () => Date.now(), solveService = null,
    budgetWork = SOLVER_BUDGET_WORK, loadBudgetMs = LOAD_BUDGET_MS, upgradeWindowWork: windowWork = SOLVER_UPGRADE_WINDOW_WORK,
    backstopMs = SOLVE_BACKSTOP_MS,
} = {}) {
    let enabled = false;
    let plan = null;
    /** ⛓ S2 — the solve in flight: `{handle, run, session, prefixLength, goal, solverGoal, askedAt}`, or null. */
    let pending = null;
    let refutations = 0;
    let lastRefutation = null;
    let budget = budgetWork;
    let upgradeWindow = windowWork;
    let service = solveService;
    const inPlace = createInPlaceSolveService({ clock });
    /** session -> Map(perTick index -> slot): the equips the play made on each live session. */
    const playedEquips = new WeakMap();
    const stats = { solves: 0, refutations: 0, declines: 0, played: 0, lastSolve: null, lastDecline: null, lastDeclineObstacle: null,
        expiries: 0, stale: 0, solving: false, lastWaitMs: null, provisionalPlays: 0, backstops: 0 };

    const emit = (e) => { try { onEvent(e); } catch { /* a listener's bug is not the solve's */ } };

    function refute(why) {
        refutations += 1;
        stats.refutations += 1;
        lastRefutation = why;
        plan = null;
        emit({ type: 'refuted', message: `[js runtime] solver plan refuted (${refutations}/${maxRefutations}) — ${why}` });
    }

    /** ⛓ S2 — drop the solve in flight: its worker is TERMINATED, its answer can never be played. */
    function cancel(why = null) {
        if (!pending) return;
        const p = pending;
        pending = null;
        stats.solving = false;
        try { p.handle.cancel(); } catch { /* a dead worker is already cancelled */ }
        if (why) emit({ type: 'cancelled', message: `[js runtime] solve cancelled — ${why}` });
    }

    function decline(why, obstacle = null) {
        stats.declines += 1;
        stats.lastDecline = why;
        stats.lastDeclineObstacle = obstacle;
        emit({ type: 'declined', message: `[js runtime] the solver declined — ${why}` });
        // ⛓ WAVE-6 CONSUMER — the refusal's obstacle rides with the decline, so the walker reads the NAME
        // (`arrival-inside-solid` fails the goal at once: walking instead from inside a solid is a stall).
        return obstacle ? { declined: why, obstacle } : { declined: why };
    }

    /** Start a solve of `solverGoal` from the session's live state (steps 2–3, behind the service). */
    function start(run, goal, solverGoal) {
        const session = getSession();
        if (!session || session.run !== run) throw new ShadowDivergence('the walker\'s run is not the page session\'s run');
        const request = {
            staging: session.staging, perTick: session.perTick, live: liveOf(run), solverGoal,
            name: `js-runtime-L${goal.level}-${goal.kind}`,
            // ⛓ S3 — the shadow carries the LIVE run's own persistence mode, never a second answer.
            scratchPersistence: run.scratchPersistence === true,
            equips: playedEquips.get(session) ?? null,
            // ⛓ DETERMINISTIC BUDGET — the worker's pass deadlines, in work units (the in-place service drops both).
            budgetWork: budget, upgradeWindowWork: upgradeWindow,
        };
        const handle = service
            ? service.start({ ...request, source: { records: getRecords() } })
            : inPlace.start({ ...request, levelSource: getLevelSource() });
        pending = { handle, run, session, prefixLength: session.perTick.length, goal, solverGoal, askedAt: clock(), startedAt: null };
        stats.solving = true;
        if (!handle.settled) {
            emit({ type: 'solving', message: `[js runtime] solving ${solverGoal.kind} in level ${goal.level} `
                + `(budget ${budget} work units) — the room is held while the solver thinks` });
        }
    }

    /** The answer in hand → a plan, a decline or a failure (null = keep waiting). */
    function take(run) {
        const p = pending;
        const now = clock();
        // ⛔ A plan is played only from the state it was solved from: a run
        // replaced while the solver thinks makes its answer STALE at once.
        if (p.run !== run || p.session !== getSession()) {
            cancel();
            stats.stale += 1;
            refute('the run was re-booted while the solver thought (an item flag or a host teleport) — its answer is stale');
            return null;
        }
        if (!p.handle.settled) {
            // ⛓ DETERMINISTIC BUDGET — the page WAITS for the worker's answer: its budget is work, bounded in
            // the worker (`passShouldStop`). The wall clock is only a BACKSTOP, and it never picks an answer —
            // past it the goal FAILS by name, and a plan already in hand is NOT played.
            if (p.startedAt === null && p.handle.started) p.startedAt = now;
            const startedAt = p.startedAt;
            if (startedAt !== null && now - startedAt > backstopMs) {
                cancel();
                stats.backstops += 1;
                stats.lastWaitMs = now - p.askedAt;
                return { failed: `the solve exceeded the backstop on this machine (${seconds(backstopMs)}) on `
                    + `${p.solverGoal.kind} in level ${p.goal.level} (terminated; the solve's own budget is ${budget} work units)` };
            }
            if (startedAt === null && now - p.askedAt > loadBudgetMs) {
                cancel();
                stats.backstops += 1;
                return { failed: `the solver did not start within ${seconds(loadBudgetMs)} on this machine (its worker never loaded)` };
            }
            return { solving: true };
        }
        pending = null;
        stats.solving = false;
        stats.lastWaitMs = now - p.askedAt;
        const r = p.handle.result;
        // ⛓ DETERMINISTIC BUDGET — a later pass cut at the work budget (the successor of a page expiry).
        const expired = budgetCut(r);
        if (expired) stats.expiries += 1;
        // ⛔ A plan is played only from the state it was solved from.
        if (p.session.perTick.length !== p.prefixLength) {
            stats.stale += 1;
            refute(`the session ticked while the solver thought (${p.prefixLength} → ${p.session.perTick.length} `
                + 'tick(s)) — its answer is stale');
            return null;
        }
        if (!r.ok) {
            if (r.kind === 'divergence') return { failed: r.message };
            return decline(String(r.message).split('\n')[0], r.obstacle ?? null);
        }
        const plan0 = r.plan;
        stats.solves += 1;
        if (expired) stats.provisionalPlays += 1;
        stats.lastSolve = { level: p.goal.level, goal: p.solverGoal, keys: plan0.solution.length, verbs: plan0.verbs,
            replayMs: plan0.replayMs, solveMs: plan0.solveMs, prefix: plan0.prefixLength, waitMs: stats.lastWaitMs,
            where: service ? service.kind : inPlace.kind,
            // ⛓ ANYTIME — which pass made the plan, whether a later pass was cut at the budget, and every pass's row
            pass: plan0.pass ?? null, expired, passes: plan0.passes ?? p.handle.passes ?? null,
            /** Where the solved shadow ended — the live run must end there too. */
            end: { ...plan0.expected[plan0.expected.length - 1] } };
        emit({ type: 'solved', message: `[js runtime] solved ${p.solverGoal.kind} in level ${p.goal.level}: `
            + `${plan0.solution.length} tick(s), verbs ${plan0.verbs.join(', ') || '—'} (replay ${plan0.replayMs} ms over `
            + `${plan0.prefixLength} tick(s), solve ${plan0.solveMs} ms${service ? `, ${service.kind}` : ''}`
            + `${plan0.pass ? `; ${passNote(plan0, { expired })}` : ''})` });
        plan = { ...plan0, run, i: 0 };
        return null;
    }

    return {
        get enabled() { return enabled; },
        set enabled(v) {
            enabled = Boolean(v);
            if (!enabled) { plan = null; cancel(); } else service?.warm?.();
        },
        /** True while a plan is being played (the core's burst and `autoAdvanceText` read it). */
        get planning() { return plan !== null; },
        /** ⛓ S2 — true while a solve is in flight (the page holds the model). */
        get solving() { return pending !== null; },
        /** Planned keys not yet played. */
        get remaining() { return plan ? plan.solution.length - plan.i : 0; },
        get stats() { return { ...stats, refutations: stats.refutations, current: refutations, lastRefutation, budgetWork: budget }; },
        /** ⛓ DETERMINISTIC BUDGET — one solve's budget, in work units (a test knob and the page's `?solverBudgetWork=`). */
        get budgetWork() { return budget; },
        set budgetWork(n) { if (Number.isFinite(n) && n > 0) budget = n; },
        /** The upgrade window in work units (`upgradeWindowWork`; null / non-positive = the whole budget). */
        get upgradeWindowWork() { return upgradeWindow; },
        set upgradeWindowWork(n) { const v = Number(n); upgradeWindow = n !== null && Number.isFinite(v) && v > 0 ? v : null; },
        /** The wall-clock backstop, in ms (a test knob; it only ever FAILS a goal by name). */
        get backstopMs() { return backstopMs; },
        set backstopMs(ms) { if (Number.isFinite(ms) && ms > 0) backstopMs = ms; },
        /** ⛓ S2 — swap the solve service (the page's worker; null = in place). Cancels a solve in flight. */
        setSolveService(next) { cancel(); service = next ?? null; if (enabled) service?.warm?.(); },
        get solveService() { return service; },
        /** A new goal (or none): forget the plan, the solve in flight and the refutation count. */
        clear() { plan = null; cancel(); refutations = 0; lastRefutation = null; },
        /** ⛓ S2 — the walk left this goal's room or settled: a solve in flight is dropped (named). */
        cancel(why) { cancel(why); },
        /**
         * This tick's keys: `{held}`; `{solving}` (⛓ S2 — hold the room, a
         * solve is in flight); `{declined: why}` (walk instead); `{failed:
         * why}` (the goal fails); or null (not the solver's goal — the walker
         * walks, nothing said).
         */
        keysFor(run, goal, resolved) {
            if (!enabled) return null;
            const generated = isGenerated();
            const mapped = solverGoalFor(goal, {
                run, resolved, generated, placement: goal?.kind === 'location' && !generated ? placementOf(goal) : null,
            });
            if (mapped.walker) { cancel(); return null; }
            if (plan) {
                if (plan.run !== run) refute('the run was re-booted (an item flag or a host teleport) — a new session');
                else if (plan.i >= plan.solution.length) refute('the plan played out and the goal is not complete');
                else if (!sameRow(rowOf(run), plan.expected[plan.i])) {
                    refute(`tick ${plan.i} of the plan: live ${showRow(rowOf(run))}, expected ${showRow(plan.expected[plan.i])}`);
                }
            }
            if (!plan && pending) {
                const out = take(run);
                if (out) return out;
            }
            if (!plan) {
                if (refutations >= maxRefutations) {
                    return { failed: `the solver's plan was refuted ${refutations} time(s) — last: ${lastRefutation}` };
                }
                try {
                    start(run, goal, mapped.goal);
                } catch (err) {
                    if (err instanceof ShadowDivergence) return { failed: err.message };
                    throw err;
                }
                const out = take(run);
                if (out) return out;
                if (!plan) {
                    // A stale in-place answer cannot happen (nothing moves inside a synchronous solve).
                    return { failed: `the solver's plan was refuted ${refutations} time(s) — last: ${lastRefutation}` };
                }
            }
            const slot = plan.equipsAt.get(plan.i);
            if (slot !== undefined) {
                run.equipNow(slot);
                const session = getSession();
                if (!playedEquips.has(session)) playedEquips.set(session, new Map());
                playedEquips.get(session).set(session.perTick.length, slot);
            }
            const held = new Set(plan.solution[plan.i]);
            plan.i += 1;
            stats.played += 1;
            return { held };
        },
    };
}
