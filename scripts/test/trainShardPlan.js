/**
 * trainShardPlan — which train-tier file runs in which `Train-tier Vitest` job.
 *
 * The train tier (`*.train.test.js`, vitest.train.config.js) runs as a matrix of
 * serial jobs (⚖ Robert 2026-11-08, "3 jobs, planned"). There is no plan job: each
 * shard recomputes the same partition from the same tree and the committed cost
 * table (train-shard-costs.json), the way `ciGatePlan.planFixedShards` does for the
 * headless gates. N is the workflow's matrix length, passed in as `--shard=k/N`.
 *
 * Rule: priced files go longest-first into the lightest shard. A file with no price
 * (a NEW `*.train.test.js`) is placed afterwards, in path order, into the lightest
 * shard at the median price, so adding one never moves a priced file.
 *
 * Pure apart from `loadTrainCosts`; no dependency beyond node.
 */
import { readFileSync } from 'node:fs';

export const TRAIN_COSTS_URL = new URL('./train-shard-costs.json', import.meta.url);

export function loadTrainCosts(url = TRAIN_COSTS_URL) {
    return JSON.parse(readFileSync(url, 'utf8')).seconds;
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : 0;
}

const byPath = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * @param {{files: string[], costs: Record<string, number>, bins: number}} input
 * @returns {{shard: number, files: string[], seconds: number, unpriced: string[]}[]}
 *   one entry per shard, `shard` is 1-based; ties go to the lower shard number
 */
export function planTrainShards({ files, costs, bins }) {
    if (!Number.isInteger(bins) || bins < 1) throw new Error(`bins must be a positive integer, got ${bins}`);
    const shards = Array.from({ length: bins }, (_, i) => ({ shard: i + 1, files: [], seconds: 0, unpriced: [] }));
    const lightest = () => shards.reduce((best, s) => (s.seconds < best.seconds ? s : best), shards[0]);
    const priced = files.filter((f) => Number.isFinite(costs[f]));
    const unpriced = files.filter((f) => !Number.isFinite(costs[f])).sort(byPath);
    for (const f of [...priced].sort((a, b) => (costs[b] - costs[a]) || byPath(a, b))) {
        const s = lightest();
        s.files.push(f);
        s.seconds += costs[f];
    }
    const assumed = median(priced.map((f) => costs[f]));
    for (const f of unpriced) {
        const s = lightest();
        s.files.push(f);
        s.unpriced.push(f);
        s.seconds += assumed;
    }
    return shards;
}

/**
 * Every file in exactly one shard, every shard non-empty (vitest with no path
 * filter would run the WHOLE tier), and no path a substring of another (vitest's
 * path filter is a substring match, so that file would run twice).
 * @returns {string[]} problems; empty means the partition is sound
 */
export function checkTrainPartition(shards, files) {
    const problems = [];
    const seen = new Map();
    for (const s of shards) {
        if (!s.files.length) problems.push(`shard ${s.shard} is empty`);
        for (const f of s.files) seen.set(f, [...(seen.get(f) ?? []), s.shard]);
    }
    for (const f of files) if (!seen.has(f)) problems.push(`unassigned: ${f}`);
    const known = new Set(files);
    for (const [f, where] of seen) {
        if (where.length > 1) problems.push(`doubly assigned: ${f} (shards ${where.join(', ')})`);
        if (!known.has(f)) problems.push(`assigned but not collected: ${f}`);
    }
    for (const a of files) {
        for (const b of files) {
            if (a !== b && b.includes(a)) problems.push(`path filter overlap: ${a} also matches ${b}`);
        }
    }
    return problems;
}

/** Cost rows whose file no longer exists: harmless to the partition, worth pruning. */
export function staleTrainCosts(files, costs) {
    const known = new Set(files);
    return Object.keys(costs).filter((f) => !known.has(f)).sort(byPath);
}

/** @returns {{k: number, n: number}} */
export function parseShardArg(value) {
    const m = /^(\d+)\/(\d+)$/.exec(value ?? '');
    const [k, n] = m ? [Number(m[1]), Number(m[2])] : [0, 0];
    if (!m || k < 1 || k > n) throw new Error(`--shard must be k/N with 1 <= k <= N, got ${value}`);
    return { k, n };
}
