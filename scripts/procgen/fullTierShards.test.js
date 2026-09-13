/**
 * fullTierShards — the tier's n-way partition (slice seedling-headless-H3).
 *
 * ⛓ The rows that carry the user's ruling are over the REAL roster, never a
 * fixture: "10 shards, the long tapes not all on one" is a claim about these
 * 150 tapes' prices, and a synthetic list would pass whatever the roster did.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { fixtureNames, loadTape } from '../../frontend/modules/seedlingDemo/fixtures/index.js';
import {
    checkLineMultiset, multisetDifference, parseShardArg, parseShardCount, partitionTapes,
    reDriveAdvice, shardTimeoutMinutes, tapePriceSec, tierCostsOf, SHARD_SETUP_MINUTES,
    SHARD_TIMEOUT_MULTIPLIER,
} from './fullTierShards.js';
import {
    FIXED_SEC_PER_TAPE, FULL_TIER_WORKFLOW_DEFAULT_SHARDS, SEC_PER_KILOTICK, describeTierCosts,
    reDriveCommands, tapeTicksOf,
} from './fullTierEstimate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIFFERENTIAL = join(HERE, 'check-seedling-bot-differential.mjs');
const ROSTER = fixtureNames().map((name) => ({ name, ticks: loadTape(name).tick_count }));
const byPriceDesc = (a, b) => (tapePriceSec(b.ticks) - tapePriceSec(a.ticks))
    || (a.name < b.name ? -1 : 1);
const shardOf = (plan, name) => plan.shards.find((s) => s.tapes.includes(name))?.shard;

describe('partitionTapes over the real roster', () => {
    it('prices a tape with fullTierEstimate\'s constants, never its own', () => {
        expect(tapePriceSec(1000)).toBe(FIXED_SEC_PER_TAPE + SEC_PER_KILOTICK);
        expect(tapePriceSec(0)).toBe(FIXED_SEC_PER_TAPE);
    });

    /**
     * ⛔ THE PLAN IS COMPUTED BY TWO PROCESSES — the plan job and each shard job
     * — that never talk (`ciGatePlan.test.js`'s determinism row, for a count).
     */
    it('is deterministic: the input order does not move a tape', () => {
        const a = partitionTapes(ROSTER, 10);
        const b = partitionTapes(ROSTER.slice().reverse(), 10);
        const c = partitionTapes([...ROSTER].sort(byPriceDesc), 10);
        expect(b.shards).toEqual(a.shards);
        expect(c.shards).toEqual(a.shards);
    });

    it('ties in price are broken by name', () => {
        const plan = partitionTapes([{ name: 'z', ticks: 100 }, { name: 'a', ticks: 100 }], 1);
        expect(plan.shards[0].tapes).toEqual(['a', 'z']);
    });

    it('puts every tape in exactly one shard, and makes exactly n shards', () => {
        for (const n of [1, 2, 3, 7, 10, 12]) {
            const plan = partitionTapes(ROSTER, n);
            expect(plan.shards.map((s) => s.shard)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
            const all = plan.shards.flatMap((s) => s.tapes);
            expect(all.length).toBe(ROSTER.length);
            expect([...all].sort()).toEqual(ROSTER.map((t) => t.name).sort());
        }
    });

    /** ⚖ "if possible I'll want the long tapes to not all be on the same shard." */
    it('the n most expensive tapes land in n DIFFERENT shards (n = 10)', () => {
        const plan = partitionTapes(ROSTER, 10);
        const top = [...ROSTER].sort(byPriceDesc).slice(0, 10).map((t) => t.name);
        expect(new Set(top.map((name) => shardOf(plan, name))).size).toBe(10);
    });

    /**
     * ⛓ THE BOUND, DERIVED. A tape joins the least-priced shard, whose sum at
     * that moment is at most the mean of what is placed so far, so no shard ends
     * above `mean + p`, where `p` is the price of the dearest tape that joined a
     * NON-EMPTY shard — the (n+1)-th dearest, because the first n each open one —
     * or above the dearest tape alone. On today's roster at n = 10 that is
     * (859.1 + 150.5) / 859.1 ≈ 1.175, computed here from the data, never typed.
     */
    it('max shard / mean shard at n = 10 stays under the derived least-loaded bound', () => {
        const n = 10;
        const plan = partitionTapes(ROSTER, n);
        const prices = ROSTER.map((t) => tapePriceSec(t.ticks)).sort((a, b) => b - a);
        const bound = Math.max(prices[0], plan.meanSec + prices[n]) / plan.meanSec;
        expect(bound).toBeLessThan(1.5);
        expect(plan.maxOverMean).toBeLessThanOrEqual(bound);
    });

    /**
     * ⛓⛓ …AND THE SHARP ONE, because the loose bound above cannot see a bad
     * packer: first-fit by name (capacity = the mean) balances today's roster to
     * 1.051 and passes it (measured, H3). The last tape a shard received joined
     * it while it was the LIGHTEST shard, whose sum can only have grown since, so
     * **no shard ends above the lightest shard by more than its own cheapest
     * tape** (placement is dearest-first, so the last tape is the cheapest). On
     * today's roster at n = 10: 865.1 ≤ 856.1 + 9.3, i.e. max/mean ≤ ≈ 1.007.
     */
    it('max shard / mean shard at n = 10 stays under min shard + the max shard\'s cheapest tape', () => {
        const plan = partitionTapes(ROSTER, 10);
        const price = Object.fromEntries(ROSTER.map((t) => [t.name, tapePriceSec(t.ticks)]));
        const minSec = Math.min(...plan.shards.map((s) => s.priceSec));
        for (const s of plan.shards) {
            if (s.tapes.length < 2) continue;
            const cheapest = Math.min(...s.tapes.map((n) => price[n]));
            expect(s.priceSec).toBeLessThanOrEqual(minSec + cheapest + 1e-9);
        }
        const heaviest = plan.shards.find((s) => s.priceSec === plan.maxSec);
        const bound = (minSec + Math.min(...heaviest.tapes.map((n) => price[n]))) / plan.meanSec;
        expect(plan.maxOverMean).toBeLessThanOrEqual(bound + 1e-12);
    });

    it('keeps an EMPTY shard when n exceeds the roster, so i/n means the same for every i', () => {
        const plan = partitionTapes([{ name: 'a', ticks: 10 }, { name: 'b', ticks: 20 }], 3);
        expect(plan.shards.map((s) => s.tapes)).toEqual([['b'], ['a'], []]);
    });

    it('refuses a duplicated tape and a tape with no tick count', () => {
        expect(() => partitionTapes([{ name: 'a', ticks: 1 }, { name: 'a', ticks: 1 }], 2)).toThrow(/twice/);
        expect(() => partitionTapes([{ name: 'a' }], 2)).toThrow(/tick count/);
    });

    it('derives the shard timeout from the biggest bin\'s price and the written multiplier', () => {
        const plan = partitionTapes(ROSTER, 10);
        expect(plan.timeoutMinutes).toBe(
            Math.ceil((plan.maxSec * SHARD_TIMEOUT_MULTIPLIER) / 60) + SHARD_SETUP_MINUTES);
        expect(shardTimeoutMinutes(1e9)).toBe(360);
    });
});

describe('parseShardArg / parseShardCount', () => {
    it('reads i/n, 1-based', () => {
        expect(parseShardArg('3/10')).toEqual({ index: 3, count: 10 });
        expect(parseShardArg('1/1')).toEqual({ index: 1, count: 1 });
    });
    it('refuses outside 1 ≤ i ≤ n, and anything that is not i/n', () => {
        for (const bad of ['0/10', '11/10', '1/0', '3', '-1/10', 'a/b', '']) {
            expect(() => parseShardArg(bad)).toThrow(/--shard/);
        }
    });
    it('reads a positive shard count', () => {
        expect(parseShardCount('10')).toBe(10);
        for (const bad of ['0', '-2', 'x', '']) expect(() => parseShardCount(bad)).toThrow(/--shard-plan/);
    });
});

describe('the differential spends this partition', () => {
    const run = (...args) => spawnSync(process.execPath, [DIFFERENTIAL, ...args], { encoding: 'utf8' });

    it('--shard-plan=10 --json prints THIS module\'s partition of the tier, and exits 0', () => {
        const r = run('--tier=full', '--shard-plan=10', '--json');
        expect(r.status).toBe(0);
        const plan = JSON.parse(r.stdout);
        expect(plan.shards).toEqual(partitionTapes(ROSTER, 10).shards);
        expect(plan.matrix).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(plan.tier).toBe('full');
    });

    it('--shard with --only= is refused BY NAME, before any lock or browser', () => {
        const r = run('--shard=1/10', '--only=friction-stop');
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/--shard is refused together with --only=/);
        const p = run('--shard-plan=10', '--only=friction-stop');
        expect(p.status).toBe(1);
        expect(p.stderr).toMatch(/--shard-plan is refused together with --only=/);
    });

    it('--shard outside 1 ≤ i ≤ n is refused', () => {
        const r = run('--shard=11/10');
        expect(r.status).toBe(1);
        expect(r.stderr).toMatch(/outside 1 ≤ i ≤ n/);
    });
});

describe('checkLineMultiset — the set identity of a merge against an unsharded run', () => {
    const serial = [
        'CHANNEL: headless logic-only',
        'PASS: a: live game matches — 12s',
        'PASS: b: live game matches — 30s',
        'SKIP: r5 pair — arm missing',
        'ALL CHECKS PASSED',
    ].join('\n');

    it('ignores order, details, and the [checkpoint] suffix', () => {
        const merged = [
            'PASS: b: live game matches — 31s [checkpoint]',
            'SKIP: r5 pair — arm missing',
            'PASS: a: live game matches — 11s [checkpoint]',
        ].join('\n');
        const d = multisetDifference(checkLineMultiset(serial), checkLineMultiset(merged));
        expect(d).toEqual({ onlyA: [], onlyB: [] });
    });

    it('sees a dropped line and a duplicated one', () => {
        const merged = [
            'PASS: a: live game matches — 11s [checkpoint]',
            'PASS: a: live game matches — 11s',
            'SKIP: r5 pair — arm missing',
        ].join('\n');
        const d = multisetDifference(checkLineMultiset(serial), checkLineMultiset(merged));
        expect(d.onlyA).toEqual([['PASS: b: live game matches', 1]]);
        expect(d.onlyB).toEqual([['PASS: a: live game matches', 1]]);
    });
});

/**
 * ⛓ F2 task 6 — THE ADVICE, ONE SPELLING for the owed gate and the re-record
 * pipeline: the CI dispatch, the box drive without `--win`, and the three
 * prices off the tapes' own ticks, partitioned the way the workflow will.
 */
describe('reDriveAdvice / tierCostsOf — the shared advice', () => {
    const TAPES = join(HERE, '../../frontend/modules/seedlingDemo/fixtures/tapes');
    const labels = ROSTER.slice(0, 12).map((t) => t.name);

    it('tierCostsOf is describeTierCosts over the default partition of those tapes', () => {
        const tapes = tapeTicksOf(labels, { tapesDir: TAPES });
        const shards = FULL_TIER_WORKFLOW_DEFAULT_SHARDS;
        expect(tierCostsOf(labels, { tapesDir: TAPES })).toBe(describeTierCosts({
            tapes: tapes.length, ticks: tapes.reduce((n, t) => n + t.ticks, 0),
            bins: partitionTapes(tapes, shards).shards, shards }));
    });

    it('prints the CI dispatch, then the box drive with no --win, then the prices', () => {
        const said = reDriveAdvice({ tier: 'campaign', labels, tapesDir: TAPES, repo: 'o/r' }).split('\n');
        const cmd = reDriveCommands({ tier: 'campaign', repo: 'o/r' });
        expect(said[0]).toBe(`⛓ RE-DRIVE IT — CI: ${cmd.ci}`);
        expect(said[1].trim()).toBe(`⛓            box: ${cmd.box}`);
        expect(said[1]).not.toContain('--win');
        expect(said[2].trim()).toBe(`⛓ ${tierCostsOf(labels, { tapesDir: TAPES })}`);
    });
});
