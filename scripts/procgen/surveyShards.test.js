/**
 * surveyShards — the partition, the merge's refusals, the comparison
 * (slice `rules-survey-ci`). Synthetic routes: the survey's own shape, no solve.
 */

import { describe, expect, it } from 'vitest';
import { compareSurveys, mergeShards, partitionSteps, stepCosts, stepIdentity } from './surveyShards.js';

const step = (n, level = n) => ({ step: n, level, arrival: { x: 16 * n, y: 32 }, goals: [{ kind: 'reach-exit', exit: { x: n, y: 0 } }] });
const route = (n = 6, mode = 'route-only', through = '3.1') => ({
    generator: 'scripts/procgen/survey-seedling-route.mjs',
    routeMode: { mode, through },
    steps: Array.from({ length: n }, (_, i) => step(i + 1)),
    alternative: null,
});
const row = (n, verdict = 'SOLVED', ms = 100, family = null) => ({ step: n, level: n, verdict, ms, family });
const shard = (name, r, ids) => ({ name, survey: { generator: r.generator, route: r, rows: ids.map((n) => row(n)) } });

describe('partitionSteps — longest first onto the least-loaded shard', () => {
    it('balances by price and keeps each shard in route order', () => {
        const costs = new Map([['1', 1], ['2', 50], ['3', 2], ['4', 40], ['5', 3], ['6', 10]]);
        const p = partitionSteps(['1', '2', '3', '4', '5', '6'], 2, costs);
        expect(p.map((s) => s.steps)).toEqual([['2', '5'], ['1', '3', '4', '6']]);
        expect(p.map((s) => s.cost)).toEqual([53, 53]);
    });
    it('never makes more shards than steps, and covers every step once', () => {
        const ids = ['1', '2', '3'];
        const p = partitionSteps(ids, 10, new Map(ids.map((i) => [i, 1])));
        expect(p).toHaveLength(3);
        expect(p.flatMap((s) => s.steps).sort()).toEqual(ids);
    });
    it('refuses a non-positive shard count and a repeated id', () => {
        expect(() => partitionSteps(['1'], 0, new Map())).toThrow(/positive integer/);
        expect(() => partitionSteps(['1', '1'], 2, new Map())).toThrow(/repeats/);
    });
});

describe('stepCosts — the survey\'s own ms, matched by identity', () => {
    it('prices by IDENTITY, so a renumbered route keeps its prices', () => {
        const prior = route(3);
        const priorSurvey = { route: prior, rows: [row(1, 'SOLVED', 10), row(2, 'TIMEOUT', 9000), row(3, 'SOLVED', 30)] };
        // the new route inserts a step before the old step 2: old 2 is new 3
        const now = [step(1), { ...step(9), step: 2 }, { ...step(2), step: 3 }, { ...step(3), step: 4 }];
        const { costs, known, source } = stepCosts(now, priorSurvey);
        expect(known).toBe(3);
        expect(costs.get('3')).toBe(9000);
        expect(costs.get('2')).toBe(30); // unpriced → median of 10, 30, 9000
        expect(source).toMatch(/3\/4 steps priced/);
    });
    it('is uniform, and says so, without a prior survey', () => {
        const { costs, source } = stepCosts(route(2).steps, null);
        expect([...costs.values()]).toEqual([1, 1]);
        expect(source).toMatch(/^uniform/);
    });
    it('identity is room, arrival and goals', () => {
        expect(stepIdentity(step(2))).toBe('L2@32,32:reach-exit({"x":2,"y":0})');
    });
});

describe('mergeShards — the survey the unsharded run writes, or a refusal BY NAME', () => {
    const r = route();
    it('assembles rows in route order, the unsharded shape', () => {
        const { survey, refusals } = mergeShards(r, [shard('2', r, [5, 2, 6]), shard('1', r, [1, 3, 4])]);
        expect(refusals).toEqual([]);
        expect(Object.keys(survey)).toEqual(['generator', 'route', 'rows']);
        expect(survey.rows.map((x) => x.step)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(survey.route).toBe(r);
    });
    it('refuses a MISSING step (a dead shard is not a shorter survey)', () => {
        const { survey, refusals } = mergeShards(r, [shard('1', r, [1, 2, 3])]);
        expect(survey).toBeUndefined();
        expect(refusals).toEqual(['MISSING-STEP: 3 of 6 route step(s) have no row: 4,5,6']);
    });
    it('refuses a DUPLICATED step, naming both shards', () => {
        const { refusals } = mergeShards(r, [shard('1', r, [1, 2, 3]), shard('2', r, [3, 4, 5, 6])]);
        expect(refusals).toEqual(['DUPLICATE-STEP: step 3 is carried by shard 1 and shard 2']);
    });
    it('refuses a step that is not on the route', () => {
        const { refusals } = mergeShards(r, [shard('1', r, [1, 2, 3, 4, 5, 6, 7])]);
        expect(refusals).toEqual(['UNKNOWN-STEP: shard 1 carries step 7, which is not on the route']);
    });
    it('refuses a shard from another route mode, bound or derivation', () => {
        const full = route(6, 'full');
        const { refusals } = mergeShards(r, [shard('1', r, [1, 2, 3]), shard('2', full, [4, 5, 6])]);
        expect(refusals[0]).toMatch(/^FOREIGN-ROUTE: shard 2 .*'routeMode'.*full through 3\.1, the plan's is route-only through 3\.1/);
        const moved = { ...r, steps: r.steps.map((s) => (s.step === 6 ? { ...s, level: 99 } : s)) };
        expect(mergeShards(r, [shard('1', moved, [1, 2, 3, 4, 5, 6])]).refusals[0]).toMatch(/first difference: 'steps'/);
    });
    it('fills from a BASE survey of the same route (the only= re-run), shard rows winning', () => {
        const base = { route: r, rows: [1, 2, 3, 4, 5, 6].map((n) => row(n, 'TIMEOUT')) };
        const { survey } = mergeShards(r, [shard('1', r, [4])], { base });
        expect(survey.rows.map((x) => x.verdict)).toEqual(['TIMEOUT', 'TIMEOUT', 'TIMEOUT', 'SOLVED', 'TIMEOUT', 'TIMEOUT']);
        expect(mergeShards(r, [shard('1', r, [4])], { base: { ...base, route: route(6, 'full') } }).refusals[0])
            .toMatch(/^FOREIGN-ROUTE: the base survey/);
    });
    it('a declared partial merge writes what it has and lists the rest', () => {
        const { survey, missing } = mergeShards(r, [shard('1', r, [2])], { partial: true });
        expect(survey.rows.map((x) => x.step)).toEqual([2]);
        expect(missing).toEqual(['1', '3', '4', '5', '6']);
    });
});

describe('compareSurveys — verdict and family, ms reported not compared', () => {
    it('names each disagreement', () => {
        const r = route(3);
        const a = { route: r, rows: [row(1, 'SOLVED', 5), row(2, 'TIMEOUT', 1500000), row(3, 'REFUSED', 9, 'ITEM-GATE')] };
        const b = { route: r, rows: [row(1, 'SOLVED', 50), row(2, 'SOLVED', 900000), row(3, 'REFUSED', 9, 'VERB-APPLY')] };
        const c = compareSurveys(a, b);
        expect(c.disagreements).toBe(2);
        expect(c.rows.map((x) => x.agree)).toEqual([true, false, false]);
        expect(compareSurveys(a, { ...b, route: route(3, 'full') }).refusals[0]).toMatch(/^FOREIGN-ROUTE/);
    });
});
