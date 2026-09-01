/**
 * ciGatePlan — **THE PARTITION, INTERROGATED WITHOUT SPENDING A RUNNER**
 * (standing-values CI arc, slice S3; ⚖ 72).
 *
 * ⛔⛔ WHY THIS FILE EXISTS AT ALL. The rule it pins decides how many CI jobs
 * there are and which arm lands in which one — and the only other way to ask
 * it a question is to push and wait twenty minutes
 * (`feedback_ci_fix_untested_environment`: a CI-config change's first
 * execution is production). Everything here is pure: a roster stub, a bank
 * stub, no network, no box, no browser.
 *
 * ⛓ THE ROWS THAT USE THE LIVE ROSTER are the ones whose whole content is
 * *"and this agrees with the tree"*, and each is guarded against vacuity by a
 * non-empty assertion first (trap 824).
 */

import { describe, expect, it } from 'vitest';

import {
    CI_SHARD_BUDGET_MS, armName, ciGateArms, ciGatePlanFor, ciRunnable, planCiShards,
} from './ciGatePlan.js';
import { REPO, gateRoster } from './gateRoster.js';

/** ⛓ An arm shaped like `ciGateArms`' output, with only the fields the
 *  partition reads — the planner must not need a real gate to be asked. */
const arm = (key, file = `check-${key}.mjs`) => ({
    gate: { file }, label: null, argv: [], bankKey: key, key,
});
const bankOf = (msByKey) => ({
    rows: Object.fromEntries(Object.entries(msByKey).map(([k, ms]) => [k, { ms }])),
});

describe('ciRunnable — what a runner can answer', () => {
    it('rejects the Windows rows and NOTHING else', () => {
        const roster = gateRoster({ repo: REPO });
        expect(roster.length).toBeGreaterThan(20);
        const refused = roster.filter((g) => !ciRunnable(g));
        expect(refused.length).toBeGreaterThan(0);
        expect(refused.every((g) => g.windows)).toBe(true);
        expect(roster.filter((g) => g.windows).map((g) => g.file).sort())
            .toEqual(refused.map((g) => g.file).sort());
    });

    /**
     * ⛔ THE HALF THAT WOULD HAVE CAUGHT THE OLD REFUSAL. Before S3 a browser
     * gate was refused by `ci-summary` by name; if this predicate ever starts
     * rejecting browser rows again, every browser standing row silently loses
     * its CI answer while the workflow keeps printing lines for it.
     */
    it('accepts every browser gate — that is what S3 bought', () => {
        const browser = gateRoster({ repo: REPO }).filter((g) => g.browser && !g.windows);
        expect(browser.length).toBeGreaterThan(15);
        expect(browser.filter((g) => !ciRunnable(g))).toEqual([]);
    });
});

describe('ciGateArms — the arms, and BOTH of an arm\'s keys', () => {
    it('the browser set is the browser gates plus their declared arms', () => {
        const roster = gateRoster({ repo: REPO });
        const gates = roster.filter((g) => g.browser && !g.windows);
        const variants = gates.reduce((n, g) => n + (g.variants?.length ?? 0), 0);
        expect(gates.length).toBeGreaterThan(15);
        const arms = ciGateArms({ repo: REPO, set: 'browser' });
        expect(arms.length).toBe(gates.length + variants);
        /** ⛓ …and a declared arm is a SECOND standing row, keyed apart. */
        expect(new Set(arms.map((a) => a.key)).size).toBe(arms.length);
    });

    it('the headless set is unchanged, and a @ci-face still replaces the prefix', () => {
        const arms = ciGateArms({ repo: REPO, set: 'headless' });
        expect(arms.length).toBeGreaterThan(3);
        const faced = arms.filter((a) => a.gate.ciFace);
        expect(faced.length).toBeGreaterThan(0);
        for (const a of faced) {
            expect(a.key.startsWith(`${a.gate.ciFace.prefix}:`)).toBe(true);
            expect(a.bankKey.startsWith('gate:')).toBe(true);
            /** ⛔ the face's argv is what CI RUNS — a bounded claim, its own key. */
            expect(a.argv).toEqual(a.gate.ciFace.argv);
        }
    });

    it('a browser arm is pointed at the caller\'s host, both shapes of it', () => {
        const arms = ciGateArms({ repo: REPO, set: 'browser', host: 'http://h:1' });
        const hosted = arms.filter((a) => a.argv.some((x) => x.startsWith('--host=')));
        const rooted = arms.filter((a) => a.argv.some((x) => x.startsWith('--root=')));
        expect(hosted.length).toBeGreaterThan(0);
        expect(rooted.length).toBeGreaterThan(0);
        /** ⛔ `--root=` is the PAGES-shaped origin: getting this wrong is not a
         *  failure, it is a gate that passes against the wrong tree. */
        for (const a of rooted) expect(a.argv).toContain('--root=http://h:1/frontend');
        for (const a of hosted) expect(a.argv).toContain('--host=http://h:1');
    });

    it('refuses an unknown set BY NAME', () => {
        expect(() => ciGateArms({ repo: REPO, set: 'windows' })).toThrow(/unknown set/);
    });
});

describe('planCiShards — the partition', () => {
    it('is a COVER: every arm lands in exactly one shard', () => {
        const arms = ciGateArms({ repo: REPO, set: 'browser' });
        const shards = planCiShards({ arms, bank: null, budgetMs: 300000 });
        const placed = shards.flatMap((s) => s.keys);
        expect(placed.length).toBeGreaterThan(0);
        expect(placed.slice().sort()).toEqual(arms.map((a) => a.key).sort());
        expect(new Set(placed).size).toBe(placed.length);
    });

    /**
     * ⛔⛔ THE COVER IS LOAD-BEARING FOR SG1's DEMOS DEDUP, and this is where
     * that is asserted rather than hoped. `check-procgen-demos` skips a `cli`
     * row that invokes a roster gate on the licence that *"the battery runs it
     * as its own row"*; sharding splits the battery across JOBS, so the
     * licence now rests on every licensed sibling being somewhere in the plan.
     */
    it('holds every gate the demos catalogue dedups against', () => {
        const { arms } = ciGatePlanFor({ repo: REPO, set: 'browser' });
        const names = new Set(arms.map((a) => a.gate.file));
        for (const f of ['check-seedling-editor-generate.mjs', 'check-seedling-editor-sequence.mjs',
            'check-seedling-editor-arm.mjs', 'check-maze-lab.mjs']) {
            expect({ f, held: names.has(f) }).toEqual({ f, held: true });
        }
    });

    it('gives an arm at or above the budget a shard of its own', () => {
        const arms = [arm('a'), arm('big'), arm('b')];
        const bank = bankOf({ a: 10, big: 999, b: 10 });
        const shards = planCiShards({ arms, bank, budgetMs: 100 });
        const alone = shards.find((s) => s.keys.includes('big'));
        expect(alone.keys).toEqual(['big']);
    });

    /**
     * ⛔ THE UNPRICED ROW IS THE ONE A "0 ms" DEFAULT WOULD HAVE HIDDEN. A gate
     * added today has nothing banked; pricing that at zero packs it into a
     * shard for free and the shard silently becomes the slow one.
     */
    it('prices a row with NO banked ms at the whole budget, so it lands alone', () => {
        const arms = [arm('a'), arm('brand-new'), arm('b')];
        const bank = bankOf({ a: 10, b: 10 });
        const shards = planCiShards({ arms, bank, budgetMs: 100 });
        const alone = shards.find((s) => s.keys.includes('brand-new'));
        expect(alone.keys).toEqual(['brand-new']);
        expect(alone.unpriced).toBe(1);
        /** ⛓ …and the control: the priced pair still share one shard. */
        expect(shards.filter((s) => !s.keys.includes('brand-new'))
            .flatMap((s) => s.keys).sort()).toEqual(['a', 'b']);
    });

    it('an empty bank makes every arm its own shard, and never drops one', () => {
        const arms = [arm('a'), arm('b'), arm('c')];
        const shards = planCiShards({ arms, bank: null, budgetMs: 100 });
        expect(shards.length).toBe(3);
        expect(shards.flatMap((s) => s.keys).sort()).toEqual(['a', 'b', 'c']);
    });

    it('no shard exceeds the budget unless a single arm does', () => {
        const arms = [arm('a'), arm('b'), arm('c'), arm('d')];
        const bank = bankOf({ a: 60, b: 50, c: 40, d: 30 });
        const shards = planCiShards({ arms, bank, budgetMs: 100 });
        for (const s of shards) expect(s.ms).toBeLessThanOrEqual(100);
    });

    /**
     * ⛔⛔ THE PLAN IS COMPUTED TWICE BY TWO PROCESSES — the job that publishes
     * the matrix and the job that takes shard *i* out of it — and they must
     * agree without talking. A tie broken by iteration order would put a
     * different arm in shard 1 on the two sides.
     */
    it('is deterministic, ties broken by name', () => {
        const arms = [arm('z'), arm('y'), arm('x')];
        const bank = bankOf({ x: 50, y: 50, z: 50 });
        const a = planCiShards({ arms, bank, budgetMs: 100 });
        const b = planCiShards({ arms: arms.slice().reverse(), bank, budgetMs: 100 });
        expect(a.map((s) => s.keys)).toEqual(b.map((s) => s.keys));
        expect(a[0].keys).toEqual(['x', 'y']);
    });

    it('names a shard for its heaviest member', () => {
        const arms = [arm('a'), arm('b')];
        const shards = planCiShards({ arms, bank: bankOf({ a: 10, b: 80 }), budgetMs: 100 });
        expect(shards[0].name).toBe('b +1');
    });
});

describe('ciGatePlanFor — the live tree', () => {
    /**
     * ⛓ THE ONE ROW THAT ASSERTS A SHAPE OF TODAY'S ANSWER rather than a rule.
     * ⛔ It deliberately does NOT pin the shard COUNT or the arm count: those
     * move whenever a gate is added or the bank is re-measured, and a number
     * typed here is the wrong-and-green this arc has already produced three
     * times. What it pins is the PROPERTY the workflow depends on.
     */
    it('partitions the live browser set into shards that cover it', () => {
        const { arms, shards, budgetMs } = ciGatePlanFor({ repo: REPO, set: 'browser' });
        expect(arms.length).toBeGreaterThan(15);
        expect(shards.length).toBeGreaterThan(0);
        expect(shards.flatMap((s) => s.keys).sort()).toEqual(arms.map((a) => a.key).sort());
        expect(budgetMs).toBe(CI_SHARD_BUDGET_MS);
        /** ⛓ a multi-arm shard is inside the budget; a lone heavy arm may not be. */
        for (const s of shards) {
            if (s.keys.length > 1) expect(s.ms).toBeLessThanOrEqual(budgetMs);
        }
    });

    it('armName carries the declared arm\'s label', () => {
        expect(armName({ gate: { file: 'check-a-b.mjs' }, label: null })).toBe('a-b');
        expect(armName({ gate: { file: 'check-a-b.mjs' }, label: 'own server' }))
            .toBe('a-b (own server)');
    });
});
