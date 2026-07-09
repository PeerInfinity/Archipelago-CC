import { describe, it, expect } from 'vitest';

import { buildWalkOrder, repairBucketOrder } from './orderBuilder.js';
import { TASK_TYPE } from './balanceCore.js';

// Build a `state_update` log record for player 1. `locations` may be a single
// name or an array; `items` become the sphere's base_items (extractLocationEntries
// attributes them to the last location in the sphere).
function su(sphere_index, locations, items = {}) {
    const locs = locations == null ? [] : (Array.isArray(locations) ? locations : [locations]);
    return {
        type: 'state_update',
        sphere_index,
        player_data: {
            1: {
                sphere_locations: locs,
                new_inventory_details: { base_items: items },
            },
        },
    };
}

const byTaskId = (entries) => new Map(entries.map((e) => [e.taskId, e]));
const indexOf = (entries, taskId) => entries.findIndex((e) => e.taskId === taskId);

// ── Main pipeline fixture: buckets, perks, synthesis, grants, skips ─────────
const MAIN_LOG = [
    su('0'),                                        // header, no locations
    su('0.1', 'r0__10', { 'JtA Filler': 1 }),
    su('0.2', 'r0__11', { 'JtA Filler': 1 }),
    su('0.3', 'r0__12', { PerkA: 1 }),              // milestone in bucket 0
    su('0.4', 'other__99', { PerkX: 1 }),           // not a jta task -> skipped
    su('1.1', 'r1__20', { 'JtA Filler': 1 }),
    su('1.2', 'r1__22', { PerkB: 1 }),              // milestone in bucket 1
    su('2.1', 'r2__30', { 'JtA Filler': 1 }),
];
const MAIN_AP = {
    10: 'r0__10', 11: 'r0__11', 12: 'r0__12',
    20: 'r1__20', 22: 'r1__22', 30: 'r2__30',
    // absent from the log -> synthesized by gate count:
    40: 'r0__40', 41: 'r1__41', 42: 'r2__42',
};
const NORMAL = (zone) => ({ type: TASK_TYPE.Normal, zone, unlocksTask: null });
const MAIN_META = {
    10: NORMAL(0), 11: NORMAL(0), 12: NORMAL(0),
    20: NORMAL(1), 22: NORMAL(1), 30: NORMAL(2),
    40: NORMAL(0), 41: NORMAL(1), 42: NORMAL(2),
};
const MAIN_GATES = { 10: 0, 11: 0, 12: 0, 20: 1, 22: 1, 30: 2, 40: 0, 41: 1, 42: 2 };
const PERKS = ['PerkA', 'PerkB'];

function runMain(seed = 7) {
    return buildWalkOrder({
        sphereLog: MAIN_LOG, playerId: 1, apLocations: MAIN_AP,
        perkItemNames: PERKS, taskMeta: MAIN_META, gateCounts: MAIN_GATES, seed,
    });
}

describe('buildWalkOrder — buckets & universe completion', () => {
    it('reports covered/synthesized counts and the bucket total', () => {
        const { report } = runMain();
        expect(report).toEqual({
            buckets: 3, logCovered: 6, synthesized: 3, repairsApplied: 0,
        });
    });

    it('skips locations that map to no jta task', () => {
        const { entries } = runMain();
        expect(entries.some((e) => e.location === 'other__99')).toBe(false);
        expect(entries.every((e) => MAIN_AP[e.taskId] != null)).toBe(true);
    });

    it('places every universe task exactly once', () => {
        const { entries } = runMain();
        const ids = entries.map((e) => e.taskId).sort((a, b) => a - b);
        expect(ids).toEqual([10, 11, 12, 20, 22, 30, 40, 41, 42]);
    });

    it('synthesizes absent tasks into the bucket their gate count reaches', () => {
        const m = byTaskId(runMain().entries);
        // gate 0 -> first bucket; gate 1 -> after PerkA; gate 2 (both perks,
        // last granted in bucket 1) -> the last bucket.
        expect(m.get(40)).toMatchObject({ bucket: 0, synthesized: true, items: [] });
        expect(m.get(41)).toMatchObject({ bucket: 1, synthesized: true, items: [] });
        expect(m.get(42)).toMatchObject({ bucket: 2, synthesized: true, items: [] });
    });

    it('marks log-sourced entries and keeps their bucket', () => {
        const m = byTaskId(runMain().entries);
        expect(m.get(10)).toMatchObject({ bucket: 0, synthesized: false });
        expect(m.get(20)).toMatchObject({ bucket: 1, synthesized: false });
        expect(m.get(30)).toMatchObject({ bucket: 2, synthesized: false });
    });

    it('keeps grants attached to their log entry through the shuffle', () => {
        for (const seed of [1, 2, 99]) {
            const m = byTaskId(runMain(seed).entries);
            expect(m.get(12).items).toEqual(['PerkA']);
            expect(m.get(22).items).toEqual(['PerkB']);
            expect(m.get(10).items).toEqual(['JtA Filler']);
        }
    });

    it('emits entries grouped by bucket in ascending order', () => {
        const { entries } = runMain();
        const buckets = entries.map((e) => e.bucket);
        expect(buckets).toEqual([...buckets].sort((a, b) => a - b));
    });
});

describe('buildWalkOrder — gate-count edge placement', () => {
    // Three buckets, one perk granted per bucket (total 3).
    const log = [
        su('0.1', 'b0', { PerkA: 1 }),
        su('1.1', 'b1', { PerkB: 1 }),
        su('2.1', 'b2', { PerkC: 1 }),
    ];
    const ap = { 1: 'b0', 2: 'b1', 3: 'b2', 100: 's0', 101: 's1', 102: 's2', 103: 's3' };
    const meta = {
        1: NORMAL(0), 2: NORMAL(1), 3: NORMAL(2),
        100: NORMAL(0), 101: NORMAL(1), 102: NORMAL(2), 103: NORMAL(2),
    };
    const gates = { 100: 0, 101: 1, 102: 2, 103: 3 };
    const perks = ['PerkA', 'PerkB', 'PerkC'];

    it('gate 0 -> first bucket, and a gate met only by the last perk -> last bucket', () => {
        const { entries } = buildWalkOrder({
            sphereLog: log, playerId: 1, apLocations: ap, perkItemNames: perks,
            taskMeta: meta, gateCounts: gates, seed: 3,
        });
        const m = byTaskId(entries);
        expect(m.get(100).bucket).toBe(0);   // gate 0
        expect(m.get(101).bucket).toBe(1);   // 1 perk granted before bucket 1
        expect(m.get(102).bucket).toBe(2);   // 2 perks granted before bucket 2
        // gate 3 exceeds every bucket's preceding cumulative -> last bucket.
        expect(m.get(103).bucket).toBe(2);
    });
});

describe('buildWalkOrder — determinism & seeding', () => {
    // One bucket with eight tasks: 8! orderings, so distinct seeds practically
    // never collide.
    const log = Array.from({ length: 8 }, (_, i) => su(`0.${i + 1}`, `t${200 + i}`, {}));
    const ap = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [200 + i, `t${200 + i}`]));
    const meta = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [200 + i, NORMAL(0)]));
    const run = (seed) => buildWalkOrder({
        sphereLog: log, playerId: 1, apLocations: ap, perkItemNames: [],
        taskMeta: meta, gateCounts: {}, seed,
    }).entries.map((e) => e.taskId);

    it('is identical for the same seed', () => {
        expect(run(12345)).toEqual(run(12345));
    });

    it('differs within a bucket for different seeds', () => {
        expect(run(1)).not.toEqual(run(2));
    });
});

describe('buildWalkOrder — sphere_index conventions (Python vs JS)', () => {
    it('buckets 0-based fractional labels from either emitter identically', () => {
        // JS forwardSimulator: header "0" + fractional "0.M"/"1.M" (sphereIdx base 0).
        const jsLog = [su('0'), su('0.1', 'a', {}), su('0.2', 'b', {}), su('1.1', 'c', {})];
        // Python exporter: same 0-based fractional labels (main_counter - 1).
        const pyLog = [su('0'), su('0.1', 'a', {}), su('0.2', 'b', {}), su('1.1', 'c', {})];
        const ap = { 1: 'a', 2: 'b', 3: 'c' };
        const meta = { 1: NORMAL(0), 2: NORMAL(0), 3: NORMAL(1) };
        const opts = { playerId: 1, apLocations: ap, perkItemNames: [], taskMeta: meta, gateCounts: {}, seed: 5 };
        const jsB = byTaskId(buildWalkOrder({ ...opts, sphereLog: jsLog }).entries);
        const pyB = byTaskId(buildWalkOrder({ ...opts, sphereLog: pyLog }).entries);
        expect([jsB.get(1).bucket, jsB.get(2).bucket, jsB.get(3).bucket]).toEqual([0, 0, 1]);
        expect([pyB.get(1).bucket, pyB.get(2).bucket, pyB.get(3).bucket]).toEqual([0, 0, 1]);
    });

    it('normalizes a numeric sphere_index and multi-digit sub-index', () => {
        const log = [su(0), su('1.10', 'a', {}), su(2, 'b', {})];
        const ap = { 1: 'a', 2: 'b' };
        const meta = { 1: NORMAL(1), 2: NORMAL(2) };
        const m = byTaskId(buildWalkOrder({
            sphereLog: log, playerId: 1, apLocations: ap, perkItemNames: [],
            taskMeta: meta, gateCounts: {}, seed: 1,
        }).entries);
        expect(m.get(1).bucket).toBe(1);   // "1.10" -> floor(1.1) = 1
        expect(m.get(2).bucket).toBe(2);   // numeric 2 -> 2
    });

    it('dedups a Python integer-sphere summary entry that repeats fractional locations', () => {
        // Python may also log an integer entry (label = counter, here 1) whose
        // sphere_locations list ALL of the sphere's picks — one bucket higher
        // than the "0.M" fractionals. First-occurrence dedup must win.
        const log = [
            su('0.1', 'a', { PerkA: 1 }),
            su('0.2', 'b', {}),
            su(1, ['a', 'b'], { PerkA: 1 }),   // integer summary of the same sphere
        ];
        const ap = { 1: 'a', 2: 'b' };
        const meta = { 1: NORMAL(0), 2: NORMAL(0) };
        const { entries, report } = buildWalkOrder({
            sphereLog: log, playerId: 1, apLocations: ap, perkItemNames: ['PerkA'],
            taskMeta: meta, gateCounts: {}, seed: 1,
        });
        expect(report.logCovered).toBe(2);
        expect(entries).toHaveLength(2);
        expect(entries.every((e) => e.bucket === 0)).toBe(true);   // not bucket 1
    });
});

describe('buildWalkOrder — duplicate / log-only / synthesized-only', () => {
    it('keeps only the first entry when a task appears twice', () => {
        const log = [
            su('0.1', 'a', { PerkA: 1 }),
            su('2.1', 'a', {}),   // spurious repeat of the same location later
        ];
        const ap = { 1: 'a' };
        const meta = { 1: NORMAL(0) };
        const { entries, report } = buildWalkOrder({
            sphereLog: log, playerId: 1, apLocations: ap, perkItemNames: ['PerkA'],
            taskMeta: meta, gateCounts: {}, seed: 1,
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ bucket: 0, items: ['PerkA'] });
        expect(report.logCovered).toBe(1);
    });

    it('synthesizes everything into bucket 0 when the log is empty', () => {
        const ap = { 1: 'a', 2: 'b', 3: 'c' };
        const meta = { 1: NORMAL(0), 2: NORMAL(0), 3: NORMAL(1) };
        const { entries, report } = buildWalkOrder({
            sphereLog: [], playerId: 1, apLocations: ap, perkItemNames: [],
            taskMeta: meta, gateCounts: { 1: 0, 2: 0, 3: 0 }, seed: 4,
        });
        expect(report).toEqual({ buckets: 1, logCovered: 0, synthesized: 3, repairsApplied: 0 });
        expect(entries.every((e) => e.bucket === 0 && e.synthesized && e.items.length === 0)).toBe(true);
        expect(entries.map((e) => e.taskId).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    });
});

describe('buildWalkOrder — constraint invariants across seeds', () => {
    // One bucket: Travel(10) + Mandatory(11,12) in zone 0; 40 unlocks 41.
    const log = [
        su('0.1', 'z10', {}), su('0.2', 'z11', {}), su('0.3', 'z12', {}),
        su('0.4', 'z40', {}), su('0.5', 'z41', {}),
    ];
    const ap = { 10: 'z10', 11: 'z11', 12: 'z12', 40: 'z40', 41: 'z41' };
    const meta = {
        10: { type: TASK_TYPE.Travel, zone: 0, unlocksTask: null },
        11: { type: TASK_TYPE.Mandatory, zone: 0, unlocksTask: null },
        12: { type: TASK_TYPE.Mandatory, zone: 0, unlocksTask: null },
        40: { type: TASK_TYPE.Normal, zone: 0, unlocksTask: 41 },
        41: { type: TASK_TYPE.Normal, zone: 0, unlocksTask: null },
    };

    it('mandatory precedes travel and unlocker precedes unlockee for every seed', () => {
        for (let seed = 0; seed < 40; seed++) {
            const { entries } = buildWalkOrder({
                sphereLog: log, playerId: 1, apLocations: ap, perkItemNames: [],
                taskMeta: meta, gateCounts: {}, seed,
            });
            expect(indexOf(entries, 11)).toBeLessThan(indexOf(entries, 10));
            expect(indexOf(entries, 12)).toBeLessThan(indexOf(entries, 10));
            expect(indexOf(entries, 40)).toBeLessThan(indexOf(entries, 41));
        }
    });

    it('throws on an unlock cycle within a bucket', () => {
        const cyLog = [su('0.1', 'c50', {}), su('0.2', 'c51', {})];
        const cyAp = { 50: 'c50', 51: 'c51' };
        const cyMeta = {
            50: { type: TASK_TYPE.Normal, zone: 0, unlocksTask: 51 },
            51: { type: TASK_TYPE.Normal, zone: 0, unlocksTask: 50 },
        };
        expect(() => buildWalkOrder({
            sphereLog: cyLog, playerId: 1, apLocations: cyAp, perkItemNames: [],
            taskMeta: cyMeta, gateCounts: {}, seed: 1,
        })).toThrow(/cycle/);
    });
});

describe('repairBucketOrder', () => {
    it('leaves an already-valid order untouched (0 moves)', () => {
        const edges = new Map([[1, new Set([2])], [2, new Set([3])]]);
        const { order, moved } = repairBucketOrder([1, 2, 3], edges);
        expect(order).toEqual([1, 2, 3]);
        expect(moved).toBe(0);
    });

    it('repairs an adversarial order minimally, honoring the edges', () => {
        const edges = new Map([[1, new Set([2])]]);   // 1 must precede 2
        const { order, moved } = repairBucketOrder([2, 1], edges);
        expect(order).toEqual([1, 2]);
        expect(moved).toBe(2);
    });

    it('resolves a transitive chain from a fully-reversed order', () => {
        const edges = new Map([[1, new Set([2])], [2, new Set([3])]]);
        const { order } = repairBucketOrder([3, 2, 1], edges);
        expect(order).toEqual([1, 2, 3]);
    });

    it('preserves the shuffle order for unconstrained nodes', () => {
        // Only 1->3 is constrained; 2 keeps its position relative to the rest.
        const edges = new Map([[1, new Set([3])]]);
        const { order } = repairBucketOrder([3, 2, 1], edges);
        // 1 must precede 3; the stable pick keeps 2 as early as legal.
        expect(order.indexOf(1)).toBeLessThan(order.indexOf(3));
        expect(order).toEqual([2, 1, 3]);
    });

    it('throws on a cycle instead of looping', () => {
        const edges = new Map([[1, new Set([2])], [2, new Set([1])]]);
        expect(() => repairBucketOrder([1, 2], edges)).toThrow(/cycle/);
    });
});
