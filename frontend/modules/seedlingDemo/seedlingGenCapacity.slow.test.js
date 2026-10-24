/**
 * ⛓⛓ THE CEILING'S CENSUS (SEEDLING GENERATED G9; ⚖ planner 2026-09-29, design
 * B, condition (b)): `flash_seedling_gen`'s declared ceiling is the CERTAIN
 * bound — 30 locations, one persistence tag each — so at the default knobs
 * EVERY draw seed must seat 30 (a draw whose own elements spend tags, or whose
 * floor is short, re-rolls or grows), and 31 must be refused BY NAME at every
 * one. If a seed ever failed to seat 30 within its budget, the ceiling would be
 * a wrong number and would have to drop to what holds.
 *
 * Measured at G9 (10×10, 2 doors, drawn seeds 1–60, loaded box): pre-sword
 * 60/60 seat 30 — extra re-rolls 0×23, 1×16, 2×9, 3×7, 4×2, 6×1, two rooms
 * GREW once — and 31 is refused at 60/60, 83 s; post-sword: plan §16.
 * ⚠ ~3 min for both biomes: the slow tier (serial), never the default run.
 */
import { describe, it, expect } from 'vitest';

import * as room from './seedlingGenRoom.js';

const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const CEILING = 30;
const seededRng = (seed) => ({ next: () => (seed + 0.5) / 0x7fffffff });
const genRoom = (seed, biome) => room.generateGenRoom({
    region_id: 'census', exits: [{ exit_id: 'e0' }, { exit_id: 'e1' }], size: { width: 10, height: 10 },
    rng: seededRng(seed), params: { seedlingGen: { biome } },
}).world;
const items = (n) => ({ items_to_place: Array.from({ length: n }, (_, i) => `i${i}`) });

describe('⛓⛓ at the default knobs every draw seed seats the ceiling, and refuses one past it by name', () => {
    for (const biome of ['pre-sword', 'post-sword']) {
        it(`${biome}, drawn seeds 1–60: 30 locations seat (re-rolls reported), 31 is refused`, () => {
            const extra = {};
            const unseated = [];
            for (const seed of SEEDS) {
                const w = genRoom(seed, biome);
                const r0 = w.generation.rerolls;
                try {
                    room.placeGenItems(w, items(CEILING));
                } catch (e) {
                    unseated.push(`${seed}: ${e.message.slice(0, 160)}`);
                    continue;
                }
                expect(new Set(w.locations.map((l) => l.tag)).size, `seed ${seed}`).toBe(CEILING);
                const k = `${w.generation.rerolls - r0}${w.generation.grownFrom ? ' (grown)' : ''}`;
                extra[k] = (extra[k] ?? 0) + 1;
                expect(() => room.placeGenItems(genRoom(seed, biome), items(CEILING + 1)), `seed ${seed}`)
                    .toThrow(room.GEN_ROOM_REFUSALS.tagBudget('census', CEILING + 1, CEILING));
            }
            console.info(`G9 census ${biome}: extra re-rolls to seat ${CEILING} → ${JSON.stringify(extra)}`);
            expect(unseated).toEqual([]);
        }, 900_000);
    }
});
