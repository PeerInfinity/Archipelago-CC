/**
 * seedlingDemo/hammerHitPlanRetry.train.test — ⛓ hammer-phase L39-ARRIVAL-HIT (`HIT_PLAN_RETRY`, OFF): the witnesses.
 *
 * Re-measure-11's S1 18:11 (L39 "Totem Part 72,40", `wasm-location-39`, the page worker's own request,
 * `hammerHitPlanRetryRows.js`'s fixture) through the page's expiry branch (`wasmPlayback.expiryAction`, a held retry at
 * 4× the budget), at defaults (LHM ON):
 *  - seam 29994 (S1's own arrival): the dashless pass solves with one model hit, the full pass is cut at the budget.
 *    OFF plays the hit plan (the page's `719a637caca4`); ON asks the held retry, whose full pass solves hitless.
 *  - seam 30052 (L1 18:10's arrival, the one other field): the dashless plan is hitless — ON asks nothing.
 * Every shipped plan's keys are replayed on a FRESH run. Train tier: four whole-request solves (one of them at 2560 units).
 */
import { describe, expect, it } from 'vitest';

import { L39_SEAM, solveCapturedL39 } from './hammerHitPlanRetryRows.js';
import { withHitPlanRetry } from './jsRuntimeSolver.js';

describe('HIT_PLAN_RETRY — re-measure-11 S1 18:11 (L39 Totem 72,40, seam 29994)', () => {
    it('OFF: the budget-cut dashless plan plays with its hit — the page\'s answer', () => {
        const r = withHitPlanRetry(false, () => solveCapturedL39());
        expect(r).toMatchObject({ outcome: 'provisional', retries: 0, ok: true, pass: 'dashless', ticks: 2864, answer: '719a637caca4' });
        expect(r.hits).toEqual(['t1521 spinner-hammer:spinner@112,88']);
        expect(r.attempts[0].passes.find((p) => p.pass === 'full')).toMatchObject({ ok: false, limit: 'budget' });
    }, 240000);

    it('ON: the held retry\'s full pass ships a hitless plan — no hit and no death on a fresh replay, the goal reached in L39', () => {
        const r = withHitPlanRetry(true, () => solveCapturedL39());
        expect(r).toMatchObject({ outcome: 'retried', retries: 1, ok: true, pass: 'full', ticks: 2735, answer: '0d12fc018cab' });
        expect(r.hits).toEqual([]);
        expect(r.deaths).toBe(0);
        expect(r.modelHits).toEqual({ hits: 0, deaths: 0 });
        expect(r.end.level).toBe(39);
        expect(r.attempts.map((a) => [a.budget, a.passes.map((p) => p.pass)])).toEqual([[640, ['dashless', 'full', 'hit-avoid']], [2560, ['full']]]);
    }, 480000);
});

describe('HIT_PLAN_RETRY — a hitless budget-cut plan is never retried (L1 18:10\'s arrival, seam 30052)', () => {
    it('ON: the same answer as OFF — the hitless dashless plan, no retry', () => {
        const off = withHitPlanRetry(false, () => solveCapturedL39(L39_SEAM.L1));
        const on = withHitPlanRetry(true, () => solveCapturedL39(L39_SEAM.L1));
        expect(on).toEqual(off);
        expect(on).toMatchObject({ outcome: 'provisional', retries: 0, ok: true, pass: 'dashless', ticks: 3818, answer: '2e1603a6ae22' });
        expect(on.hits).toEqual([]);
    }, 480000);
});
