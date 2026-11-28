/**
 * seedlingDemo/hitPlanRetry.test — ⛓ hammer-phase L39-ARRIVAL-HIT (`HIT_PLAN_RETRY`, OFF): the decision, no solve.
 * `wasmPlayback.expiryAction` over a budget-cut answer, with the switch OFF and ON (`hitPlanRetryAsks`), and the solve
 * service's `answered` (`hitPlanHeldOpen`: a plan that bills a hit is not a final word, so the held retry re-runs it).
 * The witness (a captured L39 request through the page's expiry branch) is `hammerHitPlanRetry.train.test.js`.
 */
import { describe, expect, it } from 'vitest';

import { HIT_PLAN_RETRY, HIT_PLAN_RETRY_DEFAULT, hitPlanHeldOpen, hitPlanRetryAsks, withHitPlanRetry } from './hitPlanRetry.js';
import * as solver from './jsRuntimeSolver.js';
import { createWorkerSolveService } from './jsRuntimeSolveService.js';
import { expiryAction, MAX_SOLVE_RETRIES } from './wasmPlayback.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const plan = (modelHits) => ({ ok: true, kind: null, pass: 'dashless', plan: { solution: [], ...(modelHits ? { modelHits } : {}) } });
const HIT = plan({ hits: 1, deaths: 0 });
const DEATH = plan({ hits: 0, deaths: 1 });
const CLEAN = plan({ hits: 0, deaths: 0 });
const UNSTAMPED = plan(null);
const REFUSAL = { ok: false, kind: 'refusal', message: 'cut' };

describe('HIT_PLAN_RETRY — the switch', () => {
    it('ships OFF, is a channel name, and its wrapper restores the value', () => {
        expect(HIT_PLAN_RETRY_DEFAULT).toBe(false);
        expect(HIT_PLAN_RETRY.enabled).toBe(false);
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_HIT_PLAN_RETRY');
        expect(withHitPlanRetry(true, () => HIT_PLAN_RETRY.enabled)).toBe(true);
        expect(HIT_PLAN_RETRY.enabled).toBe(false);
        // the worker's closure holds the read (re-exported by the solver: the one table)
        expect(solver.HIT_PLAN_RETRY).toBe(HIT_PLAN_RETRY);
    });

    it('billsHit agrees with the solver\'s planTakesHit on every stamped plan', () => {
        withHitPlanRetry(true, () => {
            for (const a of [HIT, DEATH, CLEAN, UNSTAMPED]) expect(hitPlanRetryAsks(a)).toBe(solver.planTakesHit(a.plan) === true);
        });
    });
});

describe('HIT_PLAN_RETRY — hitPlanRetryAsks', () => {
    it('OFF: never', () => {
        for (const a of [HIT, DEATH, CLEAN, UNSTAMPED, REFUSAL, null]) expect(hitPlanRetryAsks(a)).toBe(false);
    });
    it('ON: a plan the model plays into a hit or a death; never a hitless, unstamped, refused or divergent answer', () => {
        withHitPlanRetry(true, () => {
            expect(hitPlanRetryAsks(HIT)).toBe(true);
            expect(hitPlanRetryAsks(DEATH)).toBe(true);
            expect(hitPlanRetryAsks(CLEAN)).toBe(false);
            expect(hitPlanRetryAsks(UNSTAMPED)).toBe(false);
            expect(hitPlanRetryAsks(REFUSAL)).toBe(false);
            expect(hitPlanRetryAsks({ ...HIT, kind: 'divergence' })).toBe(false);
            expect(hitPlanRetryAsks(null)).toBe(false);
        });
    });
});

describe('HIT_PLAN_RETRY — expiryAction', () => {
    const cases = [HIT, DEATH, CLEAN, UNSTAMPED, REFUSAL, null];
    const grid = () => cases.flatMap((provisional) => [0, MAX_SOLVE_RETRIES].flatMap((retries) => [true, false]
        .map((unanswered) => expiryAction({ provisional, retries, unanswered }))));

    it('OFF: every plan is played; a refusal retries while a retry is left and a pass is unanswered (unchanged)', () => {
        expect(expiryAction({ provisional: HIT, retries: 0, unanswered: true })).toBe('provisional');
        expect(expiryAction({ provisional: REFUSAL, retries: 0, unanswered: true })).toBe('retry');
        expect(expiryAction({ provisional: REFUSAL, retries: MAX_SOLVE_RETRIES, unanswered: true })).toBe('give-up');
        expect(expiryAction({ provisional: REFUSAL, retries: 0, unanswered: false })).toBe('give-up');
    });

    it('ON: a hit plan asks the held retry while one is left and a pass is unanswered — else it is played', () => {
        withHitPlanRetry(true, () => {
            expect(expiryAction({ provisional: HIT, retries: 0, unanswered: true })).toBe('retry');
            expect(expiryAction({ provisional: DEATH, retries: 0, unanswered: true })).toBe('retry');
            expect(expiryAction({ provisional: HIT, retries: MAX_SOLVE_RETRIES, unanswered: true })).toBe('provisional');
            expect(expiryAction({ provisional: HIT, retries: 0, unanswered: false })).toBe('provisional');
        });
    });

    it('ON differs from OFF only where a hit plan has a retry left and a pass unanswered (a hitless plan is never retried)', () => {
        const off = grid();
        const on = withHitPlanRetry(true, grid);
        const changed = off.map((a, i) => (a === on[i] ? null : [i, a, on[i]])).filter(Boolean);
        // cases × retries {0, max} × unanswered {true, false}: HIT is cell 0, DEATH cell 4 — each (retries 0, unanswered)
        expect(changed).toEqual([[0, 'provisional', 'retry'], [4, 'provisional', 'retry']]);
    });
});

describe('HIT_PLAN_RETRY — the solve service\'s `answered` (what a held retry runs again)', () => {
    const drive = () => {
        let w = null;
        const service = createWorkerSolveService({ createWorker: () => (w = { onmessage: null, onerror: null, postMessage() {}, terminate() {} }) });
        const post = (h, data) => w.onmessage({ data: { id: h.id, ...data } });
        const cut = { ok: false, kind: 'refusal', pass: 'full', message: '… ⏱ DEADLINE: …', deadline: { tripped: true, first: 'block-route', sites: { 'block-route': 1 } } };
        const out = [];
        for (const first of [HIT, CLEAN]) {
            const h = service.start({ source: { records: null } });
            post(h, { type: 'started' });
            post(h, { type: 'pass', index: 0, pass: 'dashless', answer: first, best: first });
            post(h, { type: 'pass', index: 1, pass: 'full', answer: cut, best: first });
            out.push(h.answered);
        }
        service.dispose();
        return out;
    };

    it('OFF: a dashless plan is answered whatever it bills (unchanged); ON: a hit plan is held open, a hitless one answered', () => {
        expect(drive()).toEqual([1, 1]);
        expect(withHitPlanRetry(true, drive)).toEqual([0, 1]);
    });

    it('hitPlanHeldOpen: ON only, a plan that bills a hit or a death', () => {
        for (const a of [HIT, DEATH, CLEAN, UNSTAMPED, REFUSAL, null]) expect(hitPlanHeldOpen(a)).toBe(false);
        withHitPlanRetry(true, () => {
            expect([HIT, DEATH, CLEAN, UNSTAMPED, REFUSAL, null].map(hitPlanHeldOpen)).toEqual([true, true, false, false, false, false]);
        });
    });
});
