/**
 * fullTierShards — **THE TIER'S ROSTER, SPLIT INTO EXACTLY `n` SHARDS BY PRICE**
 * (slice seedling-headless-H3; plan §13–§14).
 *
 * ⚖ User, 2026-09-13: *"I'll want to set up CI to split the tapes between
 * multiple shards. 10 seems like a good default. … if possible I'll want the
 * long tapes to not all be on the same shard."*
 *
 * ── THE PRICE ───────────────────────────────────────────────────────────
 * One tape costs `FIXED_SEC_PER_TAPE + SEC_PER_KILOTICK × tick_count / 1000`
 * — `fullTierEstimate.js`'s constants, spent here, never re-typed. ⚠ It is a
 * PRICE, not a wall. H2's single-job CI run (34729518557) measured the runner
 * at 0.28–1.33 × the price per tape (the fixed 8 s over-prices the short
 * tapes), but 0.58–0.78 × on every tape of ≥ 1000 ticks — and those are what
 * a bin is made of: packing by this price gave measured bins of 530–612 s
 * where packing by the measured seconds gave 578–581 s. 31 s of slowest-shard
 * wall is not worth a second cost file that goes stale (plan §14).
 *
 * ── THE PACKING ─────────────────────────────────────────────────────────
 * Longest-first into EXACTLY `n` bins: tapes by price descending, ties by
 * name; each goes to the bin with the smallest priced sum, ties to the lowest
 * index. Deterministic, so the plan job and each shard job — two processes
 * that never talk — compute the same partition. The first `n` tapes each
 * open an empty bin, so **the `n` most expensive tapes land in `n` different
 * shards by construction** (the user's "not all on the same shard").
 * `ciGatePlan.planCiShards` is the same idea packed to a BUDGET; the tier
 * wants a COUNT, so it is not reused.
 */
import { FIXED_SEC_PER_TAPE, SEC_PER_KILOTICK } from './fullTierEstimate.js';

/** The price of one tape, in seconds, from its tick count. */
export function tapePriceSec(ticks) {
    return FIXED_SEC_PER_TAPE + (SEC_PER_KILOTICK * ticks) / 1000;
}

/**
 * ⛓ THE SHARD JOB'S `timeout-minutes`, derived from the biggest bin's price.
 *
 * `SHARD_TIMEOUT_MULTIPLIER` = 2 over the PRICE: H2's runner drove the whole
 * roster at 0.674 × its price, the ≥ 1000-tick tapes at ≤ 0.78 ×, so 2× the
 * price is ~2.6× the runner's own measured rate on the tapes that fill a bin.
 * `SHARD_SETUP_MINUTES` = 5: that run's setup (checkout with submodules, node,
 * npm ci, the cached Chromium) took 16 s, and the boot + roster-wide checks
 * outside the tapes 59 s; 5 minutes covers a cold cache several times over and
 * is the floor for a tiny bin. Clamped to GitHub's hosted-job maximum.
 */
export const SHARD_TIMEOUT_MULTIPLIER = 2;
export const SHARD_SETUP_MINUTES = 5;
export const HOSTED_JOB_MAX_MINUTES = 360;

export function shardTimeoutMinutes(maxBinPriceSec) {
    return Math.min(HOSTED_JOB_MAX_MINUTES,
        Math.ceil((maxBinPriceSec * SHARD_TIMEOUT_MULTIPLIER) / 60) + SHARD_SETUP_MINUTES);
}

/**
 * `--shard=i/n` → `{ index, count }`, 1-based. ⛔ Refused BY NAME outside
 * `1 ≤ i ≤ n`, and for anything that is not two positive integers: a shard
 * index that silently wrapped or clamped would run some other shard's tapes
 * and leave its own unreplayed.
 */
export function parseShardArg(value) {
    const m = /^(\d+)\/(\d+)$/.exec(String(value ?? '').trim());
    if (!m) {
        throw new Error(`--shard must be i/n (1-based, e.g. --shard=3/10); got "${value}"`);
    }
    const index = Number(m[1]);
    const count = Number(m[2]);
    if (count < 1 || index < 1 || index > count) {
        throw new Error(`--shard=${value} is outside 1 ≤ i ≤ n (i = ${index}, n = ${count})`);
    }
    return { index, count };
}

/** `--shard-plan=<n>` → `n`, a positive integer, refused by name otherwise. */
export function parseShardCount(value) {
    const s = String(value ?? '').trim();
    if (!/^\d+$/.test(s) || Number(s) < 1) {
        throw new Error(`--shard-plan must be a positive shard count (e.g. --shard-plan=10); got "${value}"`);
    }
    return Number(s);
}

/**
 * Partition `tapes` (`[{ name, ticks }]`) into exactly `count` shards.
 *
 * Returns `{ count, tapes, priceSec, meanSec, maxSec, maxOverMean, timeoutMinutes,
 * shards: [{ shard, tapes: [names, heaviest first], ticks, priceSec }] }`, shards
 * 1-based. A shard can be EMPTY when `count` exceeds the roster; it is kept, so
 * `--shard=i/n` means the same thing for every `i`.
 */
export function partitionTapes(tapes, count) {
    if (!Number.isInteger(count) || count < 1) {
        throw new Error(`partitionTapes: count must be a positive integer; got ${count}`);
    }
    const seen = new Set();
    for (const t of tapes) {
        if (seen.has(t.name)) throw new Error(`partitionTapes: ${t.name} appears twice`);
        seen.add(t.name);
        if (!Number.isInteger(t.ticks)) {
            throw new Error(`partitionTapes: ${t.name} carries no integer tick count`);
        }
    }
    const priced = tapes.map((t) => ({ ...t, price: tapePriceSec(t.ticks) }))
        .sort((a, b) => (b.price - a.price) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const bins = Array.from({ length: count }, (_, i) => ({
        shard: i + 1, tapes: [], ticks: 0, priceSec: 0,
    }));
    for (const t of priced) {
        let k = 0;
        for (let i = 1; i < count; i++) if (bins[i].priceSec < bins[k].priceSec) k = i;
        bins[k].tapes.push(t.name);
        bins[k].ticks += t.ticks;
        bins[k].priceSec += t.price;
    }
    const priceSec = bins.reduce((a, b) => a + b.priceSec, 0);
    const meanSec = priceSec / count;
    const maxSec = Math.max(...bins.map((b) => b.priceSec));
    return {
        count,
        tapes: tapes.length,
        priceSec,
        meanSec,
        maxSec,
        maxOverMean: meanSec > 0 ? maxSec / meanSec : 1,
        timeoutMinutes: shardTimeoutMinutes(maxSec),
        shards: bins,
    };
}

/** The lines a shard run prints FIRST, so its log names what it ran. */
export function describeShard(plan, index, { tier }) {
    const s = plan.shards[index - 1];
    return [
        `SHARD ${index}/${plan.count} of tier ${tier}: ${s.tapes.length} tape(s) of ${plan.tapes}, `
            + `${s.ticks} tick(s), priced ${s.priceSec.toFixed(1)} s `
            + `(bins: max ${plan.maxSec.toFixed(1)} s / mean ${plan.meanSec.toFixed(1)} s = `
            + `${plan.maxOverMean.toFixed(3)}; ${FIXED_SEC_PER_TAPE} s + ${SEC_PER_KILOTICK} s × ticks/1000 per tape)`,
        `SHARD ${index}/${plan.count} tapes (heaviest first): ${s.tapes.join(', ') || '(none)'}`,
    ];
}

/** The whole partition as text, one line per shard. */
export function describePartition(plan, { tier }) {
    return [
        `SHARD PLAN: tier ${tier}, ${plan.tapes} tape(s) into ${plan.count} shard(s), priced `
            + `${plan.priceSec.toFixed(1)} s; max bin ${plan.maxSec.toFixed(1)} s / mean `
            + `${plan.meanSec.toFixed(1)} s = ${plan.maxOverMean.toFixed(3)}; shard timeout `
            + `${plan.timeoutMinutes} min`,
        ...plan.shards.map((s) => `  shard ${s.shard}: ${s.tapes.length} tape(s), ${s.ticks} tick(s), `
            + `${s.priceSec.toFixed(1)} s — ${s.tapes.join(', ') || '(none)'}`),
    ];
}

/**
 * ⛓ THE CHECK LINES OF A LOG AS A MULTISET of `STATUS: name` — for the set
 * identity (plan §14): the merge's lines against an unsharded run's. The name
 * is the text before the first ` — ` (details carry wall seconds and
 * free-running clocks); a resumed line's ` [checkpoint]` suffix is dropped.
 * ⚠ A MULTISET, because grouping REORDERS: shards and the merge print in a
 * different order from one serial run, so order is never compared.
 */
export function checkLineMultiset(text) {
    const out = new Map();
    for (const raw of String(text).split('\n')) {
        const m = /^(PASS|FAIL|SKIP): (.*)$/.exec(raw);
        if (!m) continue;
        const body = m[2].replace(/ \[checkpoint\]$/, '');
        const cut = body.indexOf(' — ');
        const key = `${m[1]}: ${cut < 0 ? body : body.slice(0, cut)}`;
        out.set(key, (out.get(key) ?? 0) + 1);
    }
    return out;
}

/** The difference of two multisets: `{ onlyA: [[key, n]], onlyB: [[key, n]] }`. */
export function multisetDifference(a, b) {
    const onlyA = [];
    const onlyB = [];
    for (const [k, n] of a) { const d = n - (b.get(k) ?? 0); if (d > 0) onlyA.push([k, d]); }
    for (const [k, n] of b) { const d = n - (a.get(k) ?? 0); if (d > 0) onlyB.push([k, d]); }
    return { onlyA, onlyB };
}
