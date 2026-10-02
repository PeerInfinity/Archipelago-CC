/**
 * seedlingDemo/jsRuntimeSolver — **THE PLAYBACK BOT'S SOLVER MODE ON THE
 * SEEDLING JS RUNTIME** (solver-walk S1; plan
 * `NewDocs/plans/seedling-js-solver-walk-plan.md` §2.2 "(C) in detail").
 *
 * Opt-in (`flashPanel.seedlingSolverWalk`, default OFF — ⚖ Q3: the solve is
 * SYNCHRONOUS on the page's main thread until S2's Worker lands). With it on,
 * the walker asks this module for each tick's keys before walking itself:
 *
 *   1. MAP the goal (vanilla rooms only). A walker `exit` → `reach-exit
 *      {exit}` at the live teleporter the walker resolved (its OEL x, y); a
 *      `location` → `collect-placement {placement}` at the entity's OEL x, y.
 *      A `tile` goal, and EVERY goal of a mounted GENERATED set, stay on the
 *      J2 walker (the solver has no apitem pickup and no tile goal — that
 *      would be a model change, not this arc — and generated rooms are
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
 * ⛔ DOM-FREE AND CLOCK-FREE, like the walker. ⛔ It changes nothing in the
 * solver or the model: `prefix` (S0) is the only admission it uses.
 */

import { createRunForStaging } from './tapeRunner.js';
import { solveSegment } from './solverBot.js';

/** Refutations of one goal's plans before the goal FAILS, by name (§2.2 step 5). */
export const MAX_REFUTATIONS = 3;

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

/**
 * Step 1 — the solver goal for a walker goal, or `{walker: why}` when the
 * goal stays on the J2 walker.
 *
 * @param {object} goal      the walker's goal (`{kind, level, …}`)
 * @param {object} ctx
 * @param {object} ctx.run       the live run
 * @param {object} ctx.resolved  the walker's resolution (`{target, allowTeleporter}`)
 * @param {object|null} ctx.placement  the location's entity (`{x, y}`, OEL), vanilla rooms only
 * @param {boolean} ctx.mounted  a generated level set is mounted
 */
export function solverGoalFor(goal, { run, resolved, placement = null, mounted = false }) {
    // ⛔ A GENERATED set keeps the J2 walker for every goal: its rooms are
    // solver-certified (no enemies, no puzzles to solve), its apitems are not
    // solver placements, and its sessions run on scratch persistence.
    if (mounted) return { walker: 'a generated level set keeps the J2 walker' };
    if (goal?.kind === 'exit') {
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

/** Step 2 — the session's own tape replayed into a fresh run, asserted equal to the live run. */
export function replayShadow(session, levelSource, { scratchPersistence = false, equips = null } = {}) {
    const shadow = createRunForStaging(session.staging, levelSource, { scratchPersistence });
    session.perTick.forEach((h, i) => {
        // ⛓ An equip the PLAY made on the live run is not in the session's
        // keys (a tape carries an equip as a field) — re-made at its tick.
        const slot = equips?.get(i);
        if (slot !== undefined) shadow.equipNow(slot);
        shadow.advance(h);
    });
    const live = runDigest(session.run);
    const mine = runDigest(shadow);
    if (mine !== live) {
        throw new ShadowDivergence('the shadow replay of the page\'s own session does not reproduce the live run — '
            + `a page bug, not a solver verdict (${session.perTick.length} tick(s) replayed; `
            + `live ${showRow(rowOf(session.run))}, shadow ${showRow(rowOf(shadow))})`);
    }
    return shadow;
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
    const t0 = clock();
    const shadow = replayShadow(session, levelSource, { scratchPersistence, equips });
    const replayMs = clock() - t0;
    const expected = [rowOf(shadow)];
    const equipsAt = new Map();
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
                    return out;
                };
            }
            return typeof v === 'function' ? v.bind(target) : v;
        },
    });
    const prefix = session.perTick;
    const t1 = clock();
    const out = solveSegment({ run, goals: [solverGoal], name, boot: session.staging.boot, prefix });
    const solveMs = clock() - t1;
    const solution = out.perTick.slice(prefix.length).map((h) => new Set(h));
    if (solution.length !== expected.length - 1) {
        // The recording and the tape disagree — the plan cannot be checked tick by tick.
        throw new ShadowDivergence(`the solve returned ${solution.length} key set(s) but the shadow advanced `
            + `${expected.length - 1} time(s) — the expected trajectory cannot be checked`);
    }
    const verbs = [...new Set((out.trace?.rows ?? []).map((r) => r.strategy?.verb).filter(Boolean))].sort();
    return { solution, expected, equipsAt, verbs, replayMs, solveMs, prefixLength: prefix.length };
}

/**
 * The solver mode the walker consults (`createRuntimeWalker`'s `solver` dep).
 *
 * @param {object} deps
 * @param {() => object|null} deps.getSession   the page's live session
 * @param {() => object|null} deps.getLevelSource  the room source the session was booted from
 * @param {(goal:object) => ({x:number, y:number}|null)} deps.placementOf  a location's entity (OEL)
 * @param {() => boolean} deps.isMounted  a generated set is mounted
 * @param {(e:object) => void} [deps.onEvent]  `{type, message, …}` per solve / refutation / decline
 */
export function createRuntimeSolver({
    getSession, getLevelSource, placementOf = () => null, isMounted = () => false, onEvent = () => {},
    maxRefutations = MAX_REFUTATIONS, clock = () => Date.now(),
} = {}) {
    let enabled = false;
    let plan = null;
    let refutations = 0;
    let lastRefutation = null;
    /** session -> Map(perTick index -> slot): the equips the play made on each live session. */
    const playedEquips = new WeakMap();
    const stats = { solves: 0, refutations: 0, declines: 0, played: 0, lastSolve: null, lastDecline: null };

    const emit = (e) => { try { onEvent(e); } catch { /* a listener's bug is not the solve's */ } };

    function refute(why) {
        refutations += 1;
        stats.refutations += 1;
        lastRefutation = why;
        plan = null;
        emit({ type: 'refuted', message: `[js runtime] solver plan refuted (${refutations}/${maxRefutations}) — ${why}` });
    }

    function solve(run, goal, solverGoal) {
        const session = getSession();
        if (!session || session.run !== run) throw new ShadowDivergence('the walker\'s run is not the page session\'s run');
        const p = solveFromLive({
            session, levelSource: getLevelSource(), solverGoal, clock, equips: playedEquips.get(session) ?? null,
            name: `js-runtime-L${goal.level}-${goal.kind}`,
        });
        stats.solves += 1;
        stats.lastSolve = { level: goal.level, goal: solverGoal, keys: p.solution.length, verbs: p.verbs,
            replayMs: p.replayMs, solveMs: p.solveMs, prefix: p.prefixLength,
            /** Where the solved shadow ended — the live run must end there too. */
            end: { ...p.expected[p.expected.length - 1] } };
        emit({ type: 'solved', message: `[js runtime] solved ${solverGoal.kind} in level ${goal.level}: `
            + `${p.solution.length} tick(s), verbs ${p.verbs.join(', ') || '—'} (replay ${p.replayMs} ms over `
            + `${p.prefixLength} tick(s), solve ${p.solveMs} ms)` });
        return { ...p, run, i: 0 };
    }

    return {
        get enabled() { return enabled; },
        set enabled(v) { enabled = Boolean(v); if (!enabled) plan = null; },
        /** True while a plan is being played (the core's burst and `autoAdvanceText` read it). */
        get planning() { return plan !== null; },
        /** Planned keys not yet played. */
        get remaining() { return plan ? plan.solution.length - plan.i : 0; },
        get stats() { return { ...stats, refutations: stats.refutations, current: refutations, lastRefutation }; },
        /** A new goal (or none): forget the plan and the refutation count. */
        clear() { plan = null; refutations = 0; lastRefutation = null; },
        /**
         * This tick's keys: `{held}`; `{declined: why}` (walk instead);
         * `{failed: why}` (the goal fails); or null (not the solver's goal —
         * the walker walks, nothing said).
         */
        keysFor(run, goal, resolved) {
            if (!enabled) return null;
            const mounted = isMounted();
            const mapped = solverGoalFor(goal, {
                run, resolved, mounted, placement: goal?.kind === 'location' && !mounted ? placementOf(goal) : null,
            });
            if (mapped.walker) return null;
            if (plan) {
                if (plan.run !== run) refute('the run was re-booted (an item flag or a host teleport) — a new session');
                else if (plan.i >= plan.solution.length) refute('the plan played out and the goal is not complete');
                else if (!sameRow(rowOf(run), plan.expected[plan.i])) {
                    refute(`tick ${plan.i} of the plan: live ${showRow(rowOf(run))}, expected ${showRow(plan.expected[plan.i])}`);
                }
            }
            if (!plan) {
                if (refutations >= maxRefutations) {
                    return { failed: `the solver's plan was refuted ${refutations} time(s) — last: ${lastRefutation}` };
                }
                try {
                    plan = solve(run, goal, mapped.goal);
                } catch (err) {
                    if (err instanceof ShadowDivergence) return { failed: err.message };
                    stats.declines += 1;
                    const why = String(err?.message ?? err).split('\n')[0];
                    stats.lastDecline = why;
                    emit({ type: 'declined', message: `[js runtime] the solver declined — ${why}` });
                    return { declined: why };
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
