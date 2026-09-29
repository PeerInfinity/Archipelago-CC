/**
 * `procgenCore/locationCapacity` — the vocabulary, and the realiser sizing a
 * room once from it (APWORLD SUBSTRATE CHANGE C2).
 *
 * The references are the realiser's own: the placer's occupied tiles for the
 * demand, `generateRegion` for the size. The declaration's AGREEMENT with the
 * realiser over the committed slots is `apworldEditor/locationCapacity.slow.test.js`.
 */
import { describe, it, expect } from 'vitest';

import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { REGION_GROW_STEP } from '../shared/procgen/spatialPrimitives.js';
import { createRng } from '../shared/rng.js';
import { generateRegionCore, placeFromRules } from '../mazeRoom/mazeRoomEngine.js';
import { generateRegion } from '../procgenPipeline/procgenPipelineEngine.js';
import {
    LOCATION_CAPACITY_KINDS, LOCATION_CEILING_WORDING, exceedsCeiling, locationCapacityKind, locationCeiling,
    locationCeilingRefusal, locationDemandOf, roomHolds, sizeForLocations, unboundedCapacityIds,
} from './locationCapacity.js';

const maze = () => substrateRegistry.get('maze');
const OPEN = Object.freeze({ maxIterations: 0 });
const GATE = Object.freeze({ rule: 'Has', args: { item_name: 'key_red' } });
const TRUE = Object.freeze({ rule: 'True_' });

/** A location list: `gated` with a blocking rule, `items` True_ with an item, `bare` True_ with none. */
function locs({ gated = 0, items = 0, bare = 0 }) {
    const out = [];
    for (let i = 0; i < gated; i++) out.push({ id: `g${i}`, item: 'key_blue', access_rule: GATE });
    for (let i = 0; i < items; i++) out.push({ id: `i${i}`, item: 'key_blue', access_rule: TRUE });
    for (let i = 0; i < bare; i++) out.push({ id: `b${i}`, access_rule: TRUE });
    return out;
}

describe('locationDemandOf — the tiles a room\'s locations TAKE, held to the placer', () => {
    it('⛓ demand.locations == the distinct tiles the placer occupies (an item-less True_ location shares one)', () => {
        for (const mix of [{ gated: 3, items: 4, bare: 5 }, { items: 6, bare: 9 }, { gated: 7 }, { bare: 4 }]) {
            const locations = locs(mix);
            const rng = createRng(3);
            const core = generateRegionCore({ region_id: 'r', size: { width: 12, height: 12 }, entrances: [],
                exits: [{ side: 'E' }], rng, params: OPEN });
            const location_rules = Object.fromEntries(locations.map((l) => [l.id, l.access_rule]));
            const item_placements = locations.filter((l) => l.item).map((l) => ({ item_id: l.item, location_id: l.id }));
            const placed = placeFromRules(core.world, { location_rules, item_placements, rng });
            expect(placed.placed_locations.length, JSON.stringify(mix)).toBe(locations.length);
            const tiles = new Set(placed.placed_locations.map((p) => `${p.position.x},${p.position.y}`));
            const demand = locationDemandOf({ locations, exits: [{}] });
            // Every tile-taking location has a tile of its own; the bare ones may stack.
            expect(tiles.size, JSON.stringify(mix)).toBeGreaterThanOrEqual(demand.locations);
            expect(demand.gated).toBe(mix.gated ?? 0);
            expect(demand.exits).toBe(1);
        }
        // …and the bare ones really DO stack: five bare locations in a roomy room share tiles
        // often enough that counting them would over-size a room.
        const rng = createRng(1);
        const core = generateRegionCore({ region_id: 'r', size: { width: 3, height: 3 }, entrances: [],
            exits: [], rng, params: OPEN });
        const bare = locs({ bare: 20 });
        const placed = placeFromRules(core.world,
            { location_rules: Object.fromEntries(bare.map((l) => [l.id, l.access_rule])), rng });
        expect(placed.placed_locations.length).toBe(20);
        expect(locationDemandOf({ locations: bare }).locations).toBe(0);
    });
});

describe('sizeForLocations — the realiser\'s own grow ladder', () => {
    it('⛓ the first rung that holds; the rung below does not; start when it already holds', () => {
        const start = { width: 8, height: 6 };
        for (const gated of [0, 10, 19, 20, 60, 200]) {
            const demand = { locations: gated, gated, exits: 1 };
            const sized = sizeForLocations(maze(), start, OPEN, demand);
            expect(sized.width - start.width).toBe(sized.steps * REGION_GROW_STEP);
            expect(sized.height - start.height).toBe(sized.steps * REGION_GROW_STEP);
            expect(roomHolds(maze(), sized, OPEN, demand)).toBe(true);
            if (sized.steps > 0) {
                const below = { width: sized.width - REGION_GROW_STEP, height: sized.height - REGION_GROW_STEP };
                expect(roomHolds(maze(), below, OPEN, demand), `gated=${gated}`).toBe(false);
            }
        }
        expect(sizeForLocations(maze(), start, OPEN, { locations: 1, gated: 0, exits: 1 }).steps).toBe(0);
    });

    it('⛓ unbounded holds any demand at the start; undeclared and walled answer null; a capacity that never grows answers null', () => {
        const ta = substrateRegistry.get('text_adventure');
        expect(locationCapacityKind(ta)).toBe(LOCATION_CAPACITY_KINDS.UNBOUNDED);
        expect(sizeForLocations(ta, { width: 8, height: 6 }, {}, { locations: 10_000, gated: 10_000, exits: 9 }))
            .toEqual({ width: 8, height: 6, steps: 0 });
        expect(sizeForLocations({ id: 'x' }, { width: 8, height: 6 }, {}, { locations: 1, gated: 0, exits: 0 })).toBeNull();
        expect(sizeForLocations(maze(), { width: 8, height: 6 }, {}, { locations: 1, gated: 0, exits: 1 })).toBeNull();
        const flat = { id: 'flat', locationCapacity: { kind: LOCATION_CAPACITY_KINDS.TILES, capacityAt: () => ({ locations: 3, gated: 3 }) } };
        expect(sizeForLocations(flat, { width: 8, height: 6 }, {}, { locations: 4, gated: 0, exits: 0 })).toBeNull();
    });

    it('⛓ unboundedCapacityIds reads the declaration, in the order given', () => {
        const ids = unboundedCapacityIds(substrateRegistry.getAll());
        expect(ids).toContain('text_adventure');
        expect(ids).not.toContain('maze');
    });
});

describe('generateRegion sizes a room ONCE from the declaration', () => {
    const spec = (locations, extra = {}) => ({
        substrate: 'maze', region_id: 'r', size: { width: 8, height: 6 }, entrances: [],
        exits: [{ exit_id: 'e', side: 'E' }], locations, rng: createRng(5), params: OPEN, ...extra,
    });
    const dims = (region) => ({ width: region.playable_payload.width, height: region.playable_payload.height });

    it('⛓ a room above the start\'s capacity starts at the declared size', () => {
        const locations = locs({ gated: 40 });
        const declared = sizeForLocations(maze(), { width: 8, height: 6 }, OPEN, locationDemandOf({ locations, exits: [{}] }));
        expect(declared.steps).toBeGreaterThan(0);
        const sized = generateRegion(spec(locations));
        expect(dims(sized).width).toBeGreaterThanOrEqual(declared.width);
        expect(dims(sized).height).toBeGreaterThanOrEqual(declared.height);
        expect(sized.extracted_rules.locations.length).toBe(40);
    });

    it('⛔ a room that fits is built byte-for-byte as without the sizing', () => {
        const locations = locs({ gated: 3, items: 4 });
        const a = generateRegion(spec(locations));
        const b = generateRegion(spec(locations, { sizeFromCapacity: false }));
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(dims(a)).toEqual({ width: 8, height: 6 });
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓ G9 (SEEDLING GENERATED; plan §15–§16) — A CEILING NO SIZE LIFTS. A
 * fixture whose floor grows with the room but whose budget does not: before
 * the signal, the grow ladder met the flat capacity and answered `null`, the
 * same "cannot say" an undeclared entry answers — so no caller could refuse
 * the room by name, and the refusal came after the build.
 * ══════════════════════════════════════════════════════════════════════ */
describe('G9 — a declared ceiling', () => {
    const BUDGET = 12;
    const floorOf = (size, demand) => size.width * size.height - 1 - (demand.exits ?? 0);
    const budgeted = (withCeiling = true) => ({
        id: 'budgeted',
        locationCapacity: {
            kind: LOCATION_CAPACITY_KINDS.TILES,
            capacityAt: (size, _params, demand) => {
                const n = Math.min(floorOf(size, demand), BUDGET);
                return { locations: n, gated: n, ...(withCeiling ? { ceiling: { locations: BUDGET, why: 'the budget' } } : {}) };
            },
        },
    });
    const start = { width: 3, height: 3 };

    it('⛓ within the ceiling the ladder still grows the room to the rung that holds', () => {
        const demand = { locations: 10, gated: 0, exits: 1, listed: 10 };
        const sized = sizeForLocations(budgeted(), start, {}, demand);
        expect(sized).toEqual({ width: 5, height: 5, steps: 1 });
        expect(roomHolds(budgeted(), sized, {}, demand)).toBe(true);
        expect(exceedsCeiling(budgeted(), start, {}, demand)).toBeNull();
    });

    it('⛓⛓ past it: no size, and the ceiling NAMED — the refusal sentence carries the id, N, why, the room and its ask', () => {
        const demand = { locations: 13, gated: 0, exits: 1, listed: 13 };
        expect(sizeForLocations(budgeted(), start, {}, demand)).toBeNull();
        expect(exceedsCeiling(budgeted(), start, {}, demand)).toEqual({ locations: BUDGET, why: 'the budget' });
        expect(locationCeiling(budgeted(), start, {}, demand)).toEqual({ locations: BUDGET, why: 'the budget' });
        expect(locationCeilingRefusal('budgeted', { locations: BUDGET, why: 'the budget' }, 'Ingame', demand))
            .toBe("budgeted: at most 12 locations per room (the budget) — 'Ingame' lists 13, and no room size holds "
                + 'more (growth does not lift this bound)');
        expect(LOCATION_CEILING_WORDING.limit('x', { locations: 1, why: '' })).toBe('x: at most 1 location per room');
    });

    it('⛔ THE DEFECT, PINNED: without the signal the same capacity answers the silent `null` an undeclared entry does', () => {
        const demand = { locations: 13, gated: 0, exits: 1, listed: 13 };
        expect(sizeForLocations(budgeted(false), start, {}, demand)).toBeNull();
        expect(sizeForLocations({ id: 'undeclared' }, start, {}, demand)).toBeNull();
        expect(exceedsCeiling(budgeted(false), start, {}, demand)).toBeNull();
    });

    it('⛓ a ceiling bounds EVERY listed location — an item-less True_ one takes no tile but spends the budget', () => {
        const locations = locs({ items: 5, bare: 8 });
        const demand = locationDemandOf({ locations, exits: [{}] });
        expect(demand).toEqual({ locations: 5, gated: 0, exits: 1, listed: 13 });
        expect(exceedsCeiling(budgeted(), start, {}, demand)).toEqual({ locations: BUDGET, why: 'the budget' });
        // a hand-built demand without `listed` is bounded by its `locations`
        expect(exceedsCeiling(budgeted(), start, {}, { locations: 13, gated: 0, exits: 1 })).not.toBeNull();
    });

    it('⛔ the maze and the text adventure declare no ceiling, so nothing of theirs refuses', () => {
        const big = { locations: 10_000, gated: 0, exits: 1, listed: 10_000 };
        expect(locationCeiling(maze(), { width: 8, height: 6 }, OPEN, big)).toBeNull();
        expect('ceiling' in maze().locationCapacity.capacityAt({ width: 8, height: 6 }, OPEN, big)).toBe(false);
        expect(exceedsCeiling(substrateRegistry.get('text_adventure'), { width: 8, height: 6 }, {}, big)).toBeNull();
        expect(exceedsCeiling({ id: 'x' }, { width: 8, height: 6 }, {}, big)).toBeNull();
    });

    it('⛓⛓ generateRegion refuses a room past the ceiling BY NAME, before the core runs', () => {
        const base = maze();
        let cores = 0;
        const capped = {
            ...base,
            id: 'capped_probe',
            generateRegionCore: (input) => { cores += 1; return base.generateRegionCore(input); },
            locationCapacity: {
                kind: LOCATION_CAPACITY_KINDS.TILES,
                capacityAt: (size, params, demand) => ({
                    ...base.locationCapacity.capacityAt(size, params, demand), ceiling: { locations: 5, why: 'five' },
                }),
            },
        };
        substrateRegistry.entries.set(capped.id, capped);
        try {
            const spec = (n) => ({
                substrate: capped.id, region_id: 'r', size: { width: 8, height: 6 }, entrances: [],
                exits: [{ exit_id: 'e', side: 'E' }], locations: locs({ items: n }), rng: createRng(5), params: OPEN,
            });
            expect(() => generateRegion(spec(6))).toThrow(
                "capped_probe: at most 5 locations per room (five) — 'r' lists 6, and no room size holds more");
            expect(cores).toBe(0);
            expect(generateRegion(spec(5)).extracted_rules.locations.length).toBe(5);
            expect(cores).toBe(1);
        } finally {
            substrateRegistry.entries.delete(capped.id);
        }
    });
});
