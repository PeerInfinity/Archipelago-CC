/**
 * THE COMPACT REACH CACHE (session tile-l12-one-world; measured by tile-l12-level-world; ⚖ Robert 2026-11-04 "A: Build after R-A3
 * (Recommended)"): a cached reach is the full reach minus the search's `seen` — the cells in BFS insertion order, `has` over the
 * grid, the cut keys, the exact `states` — and its LAZY plan (`planTo` / `planToCut`, a re-search of the same arrival and
 * inventory) is the original search's plan, byte for byte. Subjects: L40 laid (latches), the first committed world with blocks
 * and the first with ropes. The MUTANT (`COMPACT_REACH.mutant`: the lazy re-search at the EMPTY inventory) is shown RED here,
 * on the same subjects: the direct pin is the one that holds the lazy plan (through the derive, a replanned witness whose plan
 * the empty inventory reproduces lets it survive). L12 as one level world and the derive's on ≡ off arm are the slow tier's.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { deserializeMazeWorld } from '../mazeRoomEngine.js';
import { nativeReachUnder, compactReach, COMPACT_REACH, enteredAt } from './deriveLevelWorldLogic.js';
import { cutEvents } from './deriveTileLogic.js';
import { check } from './compactReach.fixture.js';
import { RULES } from './deriveLevelWorldLogic.fixture.js';

afterEach(() => { COMPACT_REACH.mutant = null; });

const payloads = Object.entries(RULES.preset_sidecars['1']).filter(([, sc]) => sc.playable_payload)
    .map(([name, sc]) => [name, deserializeMazeWorld(sc.playable_payload)]);
const L40 = payloads.find(([n]) => n === 'level_40__r0c53')[1];
const withBlocks = payloads.find(([, w]) => w.blocks?.size > 0);
const withRopes = payloads.find(([, w]) => cutEvents(w).length > 0);

describe('compact reach ≡ full reach (cells order, has, cuts, states; lazy plans byte-equal)', () => {
    const subjects = [['L40 laid (latches)', L40, 3], [`a world with blocks (${withBlocks[0]})`, withBlocks[1], 24],
        [`a world with ropes (${withRopes[0]})`, withRopes[1], 12]];
    for (const [label, world, per] of subjects) {
        it(label, () => { expect(check(world, per)).toBeGreaterThan(0); }, 120_000);
    }
    it('MUTANT (the lazy re-search at the EMPTY inventory) goes RED on L40 laid and on the rope world', () => {
        COMPACT_REACH.mutant = () => [];
        expect(() => check(L40, 3)).toThrow();
        expect(() => check(withRopes[1], 12)).toThrow();
    }, 120_000);
    it('a compact value holds no state keys: iterating `cells` itself refuses, by name', () => {
        const full = nativeReachUnder(enteredAt(L40, L40.sharedWorld.regions[0]), []);
        const c = compactReach(full, () => full);
        expect(() => [...c.cells]).toThrow(/compact reach: cells holds no state keys/);
        expect(c.cells.size).toBe(full.cells.size);
    });
});
