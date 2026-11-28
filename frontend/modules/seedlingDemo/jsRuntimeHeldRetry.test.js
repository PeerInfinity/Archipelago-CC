/**
 * ⛓ seedling-js-held-retry (⚖ Robert 2026-11-27: "Fix the retry only" → "Include the fallback") — the wasm page's two
 * solve policies on the JS page (`jsRuntimeSolver.createRuntimeSolver`, `jsRuntimeCore`'s `reArrive`):
 *   (a) THE HELD RETRY — a budget CUT whose answer is a refusal with a pass left unanswered is asked ONCE more, the room
 *       held, with the SAME request at `budget × SOLVE_RETRY_BUDGET_FACTOR`, resuming at the passes after; a second cut
 *       FAILS by `expiryFailure`'s name; no cut, no re-ask.
 *   (b) CONTINUATION → FRESH SOLVE (W7) — a refused continuation (the next goal's first solve on the run and in the level
 *       where a plan was played) falls back to ONE forced re-arrival (the room re-booted at its arrival) and a fresh
 *       solve, named in the events and counted in `stats.fallbacks`; a refused fresh solve takes the existing path.
 *
 * The solves are a SCRIPTED stub service (as `jsRuntimeLongPlanWalk.test.js`): the policies choose which requests the
 * page sends, never what the solver answers, so a script is the whole input. A plan is idle ticks whose rows are the
 * live row (the Starting House stands still), so it plays without a refutation.
 *
 * ── THE MUTATION LIST (measured; each row's reds, the rest green) ──
 *   base the port reverted (`102dcbeb16`'s jsRuntimeSolver.js + jsRuntimeCore.js) -> 8 of 9 red: every row but the
 *        constants row (one ask and a decline where a re-ask, a failure by name or a fallback is pinned)
 *   r2 the factor 2 instead of `SOLVE_RETRY_BUDGET_FACTOR`  -> (a) "a cut + …", (a) "a second cut …", (b) "… cut twice …"
 *   r3 the retry re-sends every pass (not `passesAfter`)    -> (a) "a cut + …"
 *   f2 the fallback unbounded — ALL THREE of its guards off (the per-goal count, "the goal's first ask", "the run the
 *        plan played on") -> (b) "a refused continuation …", (b) "a refused FRESH solve …". Any ONE guard alone holds
 *        the bound (measured: with only the count off, all 9 stay green — the fresh run is not the run a plan played on)
 *   f3 every goal's first solve a continuation              -> 8 of 9 red (the constants row stays green)
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createJsRuntime } from './jsRuntimeCore.js';
import { ANYTIME_PASSES, SOLVER_BUDGET_WORK } from './jsRuntimeSolver.js';
import { WALK_STATES } from './jsRuntimeWalker.js';
import { expiryFailure, MAX_SOLVE_RETRIES, SOLVE_RETRY_BUDGET_FACTOR } from './wasmPlayback.js';

const MAP = JSON.parse(readFileSync(new URL('../flashPanel/atlases/seedling-map.json', import.meta.url), 'utf8'));
const DOOR = { kind: 'exit', level: 86, tiles: [[3, 4]], name: 'stub door' };
const OTHER = { kind: 'exit', level: 86, tiles: [[3, 4]], name: 'stub door, the next goal' };
const IDLE = 40;

/** A plan of `n` idle ticks from the request's live row. */
const idlePlan = (request, n = IDLE) => ({ ok: true, plan: {
    solution: Array.from({ length: n }, () => []), expected: Array.from({ length: n + 1 }, () => ({ ...request.live.row })),
    equipsAt: new Map(), verbs: ['walk'], replayMs: 0, solveMs: 0, prefixLength: request.perTick.length, pass: 'dashless' } });
/** The worker's answer when the full pass is CUT at the budget after a dashless refusal (L22→L25's shape). */
const cutRefusal = () => ({ ok: false, kind: 'refusal', message: 'dashless: no corridor (stub)', pass: 'full',
    passes: [{ pass: 'dashless', ok: false, kind: 'refusal' }, { pass: 'full', ok: false, kind: 'refusal', limit: 'budget' }],
    deadline: { tripped: true, first: 'sword-dash' } });
/** A refusal by name, not cut (L40 item 2's shape: at any budget). */
const namedRefusal = (message = 'the combat ladder is EXHAUSTED (stub)') => ({ ok: false, kind: 'refusal', message, pass: 'full',
    passes: [{ pass: 'dashless', ok: false, kind: 'refusal' }, { pass: 'full', ok: false, kind: 'refusal' }] });

/**
 * A settled service answering the k-th start with `script[k](request)` (the last entry repeats). `answered` is the
 * service's count of leading passes with a final word: a cut answer's dashless refusal answered, its full pass did not.
 */
function scripted(script) {
    const asked = [];
    return {
        asked, kind: 'stub', warm() {}, dispose() {},
        start(request, { attempt } = {}) {
            // a SNAPSHOT: `perTick` is the live session's array, which grows after the ask
            asked.push({ request: { ...request, perTick: [...request.perTick] }, attempt, json: JSON.stringify(held(request)) });
            const result = script[Math.min(asked.length - 1, script.length - 1)](request);
            const answered = (result.passes ?? []).findIndex((r) => r.limit === 'budget');
            return { settled: true, started: true, result, answered: answered === -1 ? (result.passes ?? []).length : answered,
                passes: result.passes ?? [], cancel() {} };
        },
    };
}

function house(service) {
    const rt = createJsRuntime({ solveService: service });
    rt.setVanilla(MAP);
    rt.queueItems([{ invocation: 'new_instance', className: 'Game', args: [86, 48, 48] }]);
    rt.tick();
    rt.playback.setSolverWalk(true);
    return rt;
}
const ticks = (rt, n) => { for (let t = 0; t < n && ![WALK_STATES.DONE, WALK_STATES.FAILED].includes(rt.playback.state); t += 1) rt.tick(); };
/** The request minus what a retry may change (its budget and its passes). */
const held = ({ budgetWork, passes, ...rest }) => rest;
const boots = (rt) => rt.events.filter((e) => e.type === 'boot');
/** The walker said it declined with `why` and walks instead (the existing decline path). */
const declinedWalking = (rt, why) => rt.events.some((e) => e.type === 'walk' && (e.message ?? '').includes(`the solver declined — ${why}; walking instead`));

describe('⛓ (a) THE HELD RETRY — a cut refusal is asked once more, held, at 4×', () => {
    it('the policy is the wasm page\'s, imported: factor 4, one retry', () => {
        expect([SOLVE_RETRY_BUDGET_FACTOR, MAX_SOLVE_RETRIES, SOLVER_BUDGET_WORK]).toEqual([4, 1, 640]);
    });

    it('a cut + a refusal + a pass left → ONE re-ask at 4×, the same request (the room held), the passes after; its plan plays', () => {
        const service = scripted([cutRefusal, (q) => idlePlan(q)]);
        const rt = house(service);
        expect(rt.playback.walkTo(DOOR)).toEqual({ ok: true });
        rt.playback.play();
        const session = rt.session;
        ticks(rt, 10);
        expect(service.asked).toHaveLength(2);
        const [a0, a1] = service.asked;
        expect(a0.request.budgetWork).toBe(640);
        expect(a0.request.passes).toBeUndefined(); // the first ask is byte-for-byte the ask it was before the slice
        expect(a0.attempt).toEqual({ retry: 0, budgets: [640] });
        expect(a1.request.budgetWork).toBe(640 * SOLVE_RETRY_BUDGET_FACTOR);
        expect(a1.request.passes).toEqual([ANYTIME_PASSES[1]]); // the dashless pass answered: only `full` again
        expect(a1.attempt).toEqual({ retry: 1, budgets: [640, 2560] });
        expect(a1.json).toBe(a0.json); // the room held: same staging, prefix, live row, goal — byte for byte
        expect(rt.session).toBe(session);
        expect(rt.playback.state).toBe(WALK_STATES.WALKING);
        expect(rt.playback.solverStats).toMatchObject({ retries: 1, expiries: 1, declines: 0, solves: 1, fallbacks: [] });
        expect(rt.playback.solverStats.played).toBeGreaterThan(0);
        expect(rt.events.some((e) => /asking again with 2560, the room held \(retry 1\)/.test(e.message ?? ''))).toBe(true);
    });

    it('a second cut → the named failure (`expiryFailure`), no third ask', () => {
        const service = scripted([cutRefusal, cutRefusal]);
        const rt = house(service);
        rt.playback.walkTo(DOOR);
        rt.playback.play();
        ticks(rt, 10);
        expect(service.asked).toHaveLength(2);
        expect(rt.playback.state).toBe(WALK_STATES.FAILED);
        expect(rt.playback.reason).toBe(expiryFailure({ goal: { ...DOOR }, budgets: [640, 2560], refusal: cutRefusal() }));
        expect(rt.playback.reason).toMatch(/^the solver ran out of 640, then 2560 work units on its held retry on exit in level 86: /);
        expect(rt.playback.solverStats).toMatchObject({ retries: 1, expiries: 2, fallbacks: [] });
    });

    it('no cut → no re-ask (a named refusal is the existing decline)', () => {
        const service = scripted([() => namedRefusal()]);
        const rt = house(service);
        rt.playback.walkTo(DOOR);
        rt.playback.play();
        ticks(rt, 10);
        expect(service.asked).toHaveLength(1);
        expect(rt.playback.solverStats).toMatchObject({ retries: 0, expiries: 0, declines: 1 });
        expect(declinedWalking(rt, 'the combat ladder is EXHAUSTED (stub)')).toBe(true);
    });

    it('a cut with a PLAN in hand plays it (provisional), no re-ask; no work limit never re-asks', () => {
        const provisional = (q) => ({ ...idlePlan(q), passes: [{ pass: 'dashless', ok: true }, { pass: 'full', ok: false, limit: 'budget' }] });
        const service = scripted([provisional]);
        const rt = house(service);
        rt.playback.walkTo(DOOR);
        rt.playback.play();
        ticks(rt, 10);
        expect(service.asked).toHaveLength(1);
        expect(rt.playback.solverStats).toMatchObject({ retries: 0, expiries: 1, provisionalPlays: 1 });
        const off = scripted([cutRefusal, (q) => idlePlan(q)]);
        const rt0 = house(off);
        rt0.playback.setSolverBudgetWork(0);
        rt0.playback.walkTo(DOOR);
        rt0.playback.play();
        ticks(rt0, 10);
        expect(off.asked).toHaveLength(1);
        expect(rt0.playback.state).toBe(WALK_STATES.FAILED);
        expect(rt0.playback.reason).toBe(expiryFailure({ goal: { ...DOOR }, budgets: [], refusal: cutRefusal() }));
    });
});

/** Goal 1's plan plays `IDLE` ticks on this run in L86, then goal 2 is set: its first solve is a CONTINUATION. */
function continuation(script) {
    const service = scripted([(q) => idlePlan(q, IDLE), ...script]);
    const rt = house(service);
    const p0 = rt.session.perTick.length; // the boot's own tick
    rt.playback.walkTo(DOOR);
    rt.playback.play();
    ticks(rt, IDLE / 2);
    expect(rt.playback.solverStats.played).toBe(IDLE / 2);
    const prefix = rt.session.perTick.length;
    expect(prefix).toBe(p0 + IDLE / 2);
    const session = rt.session;
    rt.playback.walkTo(OTHER);
    rt.playback.play();
    return { rt, service, session, p0, prefix };
}

describe('⛓ (b) CONTINUATION → FRESH SOLVE (W7) — one forced re-arrival, then a fresh solve', () => {
    it('a refused continuation → ONE forced re-arrival (the room re-booted at its arrival) + a fresh solve, named and counted', () => {
        const { rt, service, session, prefix } = continuation([() => namedRefusal(), (q) => idlePlan(q)]);
        ticks(rt, 10);
        expect(service.asked).toHaveLength(3);
        const cont = service.asked[1].request;
        const fresh = service.asked[2].request;
        expect(cont.perTick.length).toBe(prefix); // solving on from the room
        expect(fresh.perTick.length).toBe(0); // a fresh solve from the new arrival
        expect(fresh.staging.boot).toEqual({ level: 86, x: 48, y: 48 });
        expect(rt.session).not.toBe(session);
        expect(rt.playback.solverStats).toMatchObject({ continuations: 1, declines: 0, solves: 2 });
        expect(rt.playback.solverStats.fallbacks).toEqual([{ goal: OTHER.name, level: 86, kind: 'continuation-declined',
            why: 'the solver declined stub door, the next goal in level 86 (refusal): the combat ladder is EXHAUSTED (stub)' }]);
        const b = boots(rt).at(-1);
        expect(b.message).toMatch(/^\[js runtime\] boot level 86 at \(48, 48\) — re-entering level 86 \(forced re-arrival: the solver declined /);
        expect(rt.events.some((e) => e.solver === 'fallback' && /falling back to a forced re-arrival$/.test(e.message))).toBe(true);
        expect(rt.playback.state).toBe(WALK_STATES.WALKING);
    });

    it('a continuation cut twice falls back too (`continuation-budget`), after its held retry', () => {
        const { rt, service, p0, prefix } = continuation([cutRefusal, cutRefusal, (q) => idlePlan(q)]);
        ticks(rt, 10);
        expect(service.asked.map((a) => [a.request.perTick.length, a.request.budgetWork]))
            .toEqual([[p0, 640], [prefix, 640], [prefix, 2560], [0, 640]]);
        expect(rt.playback.solverStats.fallbacks.map((f) => f.kind)).toEqual(['continuation-budget']);
        expect(rt.playback.solverStats.fallbacks[0].why)
            .toBe(expiryFailure({ goal: { ...OTHER }, budgets: [640, 2560], refusal: cutRefusal() }));
        expect(rt.playback.state).toBe(WALK_STATES.WALKING);
    });

    it('a refused FRESH solve → the existing path (a decline), never a second re-arrival', () => {
        const { rt, service } = continuation([() => namedRefusal(), () => namedRefusal('fresh: no corridor (stub)')]);
        const before = boots(rt).length;
        ticks(rt, 10);
        expect(service.asked).toHaveLength(3);
        expect(boots(rt).length).toBe(before + 1);
        expect(rt.playback.solverStats).toMatchObject({ continuations: 1, declines: 1 });
        expect(rt.playback.solverStats.fallbacks).toHaveLength(1);
        expect(declinedWalking(rt, 'fresh: no corridor (stub)')).toBe(true);
    });

    it('a goal\'s FIRST solve in a room no plan played in is not a continuation: its refusal is the existing decline', () => {
        const service = scripted([() => namedRefusal()]);
        const rt = house(service);
        rt.playback.walkTo(OTHER);
        rt.playback.play();
        const before = boots(rt).length;
        ticks(rt, 10);
        expect(service.asked).toHaveLength(1);
        expect(boots(rt).length).toBe(before);
        expect(rt.playback.solverStats).toMatchObject({ continuations: 0, declines: 1, fallbacks: [] });
    });
});
