/**
 * The maze entry's `locationCapacity` held to the realiser's own placer
 * (APWORLD SUBSTRATE CHANGE C2).
 *
 * The reference is the PLACER, never the declaration's arithmetic: a room is
 * built by `generateRegionCore` and handed to `placeFromRules` with more
 * item-bearing `True_` locations than it could hold (a `True_` rule places no
 * gate, so this measures the FLOOR alone; the item is what makes a location
 * take its tile — an item-less `True_` one can share a tile), and the count it
 * placed is the room's capacity.
 * The gated share is a threshold of a random layout and is held by the slow
 * census row (`locationCapacity.slow.test.js`), over the committed slots.
 */
import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
import { SIDES } from '../shared/procgen/spatialPrimitives.js';
import { generateRegionCore, placeFromRules } from './mazeRoomEngine.js';
import { GATED_FLOOR_SHARE, mazeCapacityAt, mazeRoomIsOpen } from './mazeLocationCapacity.js';
import { substrateRegistryEntry } from './mazeRoomLibrary.js';
import { LOCATION_CAPACITY_KINDS } from '../procgenCore/locationCapacity.js';

const OPEN = Object.freeze({ maxIterations: 0 });

/**
 * How many `True_` locations the placer lands in a freshly built room. With
 * `{ cut: true }`: `{ placed, cutCorners }` — the corners whose two neighbours
 * are both exits, which no walk reaches without crossing (an exit tile is a
 * dead end to the generator: mazeRoomEngine `isDeadEndExit`).
 */
function placerCapacity({ width, height }, exits, params, seed, { cut = false } = {}) {
    const rng = createRng(seed);
    const core = generateRegionCore({
        region_id: 'r', size: { width, height }, entrances: [],
        exits: SIDES.slice(0, exits).map((side) => ({ side })), rng, params,
    });
    const ask = width * height + 1; // more than any room of this size could hold
    const ids = Array.from({ length: ask }, (_, i) => `loc_${i}`);
    const location_rules = Object.fromEntries(ids.map((id) => [id, { rule: 'True_' }]));
    const item_placements = ids.map((location_id) => ({ item_id: 'key_red', location_id }));
    const placed = placeFromRules(core.world, { location_rules, item_placements, rng });
    if (!cut) return placed.placed_locations.length;
    const { world } = core;
    const exitAt = new Set([...world.exits.values()].map((e) => `${e.x},${e.y}`));
    const cutCorners = [[0, 0], [world.width - 1, 0], [0, world.height - 1], [world.width - 1, world.height - 1]]
        .filter(([x, y]) => !exitAt.has(`${x},${y}`)
            && [[x === 0 ? 1 : x - 1, y], [x, y === 0 ? 1 : y - 1]].every(([nx, ny]) => exitAt.has(`${nx},${ny}`)))
        .length;
    return { placed: placed.placed_locations.length, cutCorners };
}

describe('mazeLocationCapacity — an OPEN room holds its floor, exactly', () => {
    const SIZES = [[3, 3], [8, 6], [9, 7], [12, 12], [15, 11]];
    it('⛓ capacityAt(size).locations == what the placer lands, less the corners its exits cut off, over sizes × 0–4 exits × seeds', () => {
        let rooms = 0;
        let cut = 0;
        for (const [width, height] of SIZES) {
            for (let exits = 0; exits <= 4; exits++) {
                for (const seed of [1, 2, 3]) {
                    const declared = mazeCapacityAt({ width, height }, OPEN, { exits });
                    expect(declared, `${width}x${height} exits=${exits}`).not.toBeNull();
                    const { placed, cutCorners } = placerCapacity({ width, height }, exits, OPEN, seed, { cut: true });
                    expect(placed, `${width}x${height} exits=${exits} seed=${seed}`).toBe(declared.locations - cutCorners);
                    cut += cutCorners;
                    rooms++;
                }
            }
        }
        expect(rooms).toBe(SIZES.length * 5 * 3);
        // The population carries the case the declaration over-counts.
        expect(cut).toBeGreaterThan(0);
    });

    it('⛓ a room with NO exit is open under any params (wall generation is skipped) — and held', () => {
        const declared = mazeCapacityAt({ width: 8, height: 6 }, {}, { exits: 0 });
        expect(declared).not.toBeNull();
        expect(placerCapacity({ width: 8, height: 6 }, 0, {}, 1)).toBe(declared.locations);
    });

    it('⛓ the gated share is the percolation complement of the floor, rounded down', () => {
        const cap = mazeCapacityAt({ width: 12, height: 12 }, OPEN, { exits: 2 });
        expect(cap.gated).toBe(Math.floor(GATED_FLOOR_SHARE * cap.locations));
        expect(cap.gated).toBeLessThan(cap.locations);
    });
});

describe('mazeLocationCapacity — a WALLED room answers null (its floor is a draw)', () => {
    it('⛔ default params with an exit: null — and the placer measurably disagrees with any one function of the size', () => {
        expect(mazeCapacityAt({ width: 12, height: 12 }, {}, { exits: 1 })).toBeNull();
        const draws = new Set([1, 2, 3, 4, 5, 6].map((seed) => placerCapacity({ width: 12, height: 12 }, 1, {}, seed)));
        expect(draws.size).toBeGreaterThan(1);
    });
    it('⛔ a biome whose backend is not the open-capable one: null', () => {
        expect(mazeRoomIsOpen(OPEN, { exits: 1, biome: { id: 'corridor' } })).toBe(false);
        expect(mazeCapacityAt({ width: 12, height: 12 }, OPEN, { exits: 1, biome: { id: 'corridor' } })).toBeNull();
        expect(mazeRoomIsOpen(OPEN, { exits: 1, biome: { id: 'no-such-biome' } })).toBe(false);
    });
});

describe('the maze registry entry declares it', () => {
    it('⛓ kind tiles, capacityAt is this module\'s', () => {
        expect(substrateRegistryEntry.locationCapacity.kind).toBe(LOCATION_CAPACITY_KINDS.TILES);
        expect(substrateRegistryEntry.locationCapacity.capacityAt).toBe(mazeCapacityAt);
    });
});
