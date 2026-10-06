/**
 * The divergence sweep's CI shape (⚖ user, 2026-10-05, via planner-3: the live sweep runs in CI, SHARDED, off the
 * box): the partition covers every leg exactly once and deterministically, a location page takes one arrival per
 * location, and `.github/workflows/seedling-divergence-sweep.yml` is `workflow_dispatch` ONLY (a `push:` would spend
 * ten browser shards on every commit).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { legPrice, orderLegs, partitionLegs } from './probe-seedling-divergence-sweep.mjs';
import { triggersOf } from './seedlingFullTierWorkflow.test.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const exit = (id, level, sphere = 0) => ({ id, level, goal: { kind: 'exit', name: `x${id}` }, sphere: { index: sphere } });
const loc = (id, level, name, sphere = 0) => ({ id, level, goal: { kind: 'location', name }, sphere: { index: sphere } });

describe('partitionLegs', () => {
    const area = (level) => (level === 9 ? 3000 : 200);
    const legs = [
        ...Array.from({ length: 40 }, (_, i) => exit(i, i % 5)),
        exit(40, 9), exit(41, 9), exit(42, 9),
        loc(43, 1, 'A'), loc(44, 1, 'A'), loc(45, 2, 'B'),
    ];

    it('covers every leg exactly once, into exactly n shards', () => {
        const shards = partitionLegs(legs, 4, area);
        expect(shards.map((s) => s.shard)).toEqual([1, 2, 3, 4]);
        const ids = shards.flatMap((s) => s.ids);
        expect(ids.length).toBe(legs.length);
        expect(new Set(ids).size).toBe(legs.length);
    });

    it('is deterministic (the plan job and every shard derive the same split)', () => {
        expect(partitionLegs(legs, 4, area)).toEqual(partitionLegs([...legs].reverse(), 4, area));
    });

    it('spreads the priciest legs: the three big-room legs land in three different shards', () => {
        const shards = partitionLegs(legs, 4, area);
        const holding = [40, 41, 42].map((id) => shards.findIndex((s) => s.ids.includes(id)));
        expect(new Set(holding).size).toBe(3);
        expect(legPrice(legs[40], area)).toBeGreaterThan(legPrice(legs[0], area));
    });

    it('n larger than the legs leaves empty shards, never a lost leg', () => {
        const shards = partitionLegs(legs.slice(0, 2), 4, area);
        expect(shards.flatMap((s) => s.ids).sort()).toEqual([0, 1]);
        expect(shards.filter((s) => s.ids.length === 0).length).toBe(2);
    });
});

describe('orderLegs', () => {
    it('a location page takes ONE arrival per location (an opened check stays open for the session)', () => {
        const pages = orderLegs([exit(0, 1), loc(1, 1, 'A'), loc(2, 1, 'A'), loc(3, 2, 'B')], 'inv', 60);
        expect(pages.map((p) => p.map((l) => l.id))).toEqual([[0], [1, 3], [2]]);
    });

    it('--page-legs=1 puts EVERY leg on its own page, location rounds included (one clean game per leg)', () => {
        const pages = orderLegs([exit(0, 1), loc(1, 1, 'A'), loc(2, 2, 'B'), loc(3, 1, 'A')], 'inv', 1);
        expect(pages.map((p) => p.map((l) => l.id))).toEqual([[0], [1], [2], [3]]);
    });

    it('inv mode orders the exits by sphere (the grants only ever grow)', () => {
        const pages = orderLegs([exit(0, 1, 5), exit(1, 1, 0), exit(2, 1, 2)], 'inv', 60);
        expect(pages[0].map((l) => l.id)).toEqual([1, 2, 0]);
    });
});

describe('seedling-divergence-sweep.yml', () => {
    const text = readFileSync(join(REPO, '.github/workflows/seedling-divergence-sweep.yml'), 'utf8');

    it('its only trigger is workflow_dispatch', () => {
        expect(triggersOf(text)).toEqual(['workflow_dispatch']);
    });

    it('the shard timeout and the leg count are DERIVED by the plan job, never typed', () => {
        expect(text).toMatch(/timeout-minutes: \$\{\{ fromJSON\(needs\.plan\.outputs\.timeout\) \}\}/);
        expect(text).toMatch(/LEGS: \$\{\{ needs\.plan\.outputs\.legs \}\}/);
    });
});
