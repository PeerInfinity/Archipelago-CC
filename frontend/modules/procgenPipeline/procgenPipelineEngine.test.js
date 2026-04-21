import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
import {
    ScenarioPool, SIDES, OPPOSITE_SIDE,
    Grid, cellKey,
    stitchGrid, accumulatedInventory,
} from './procgenPipelineEngine.js';

const TEST_ITEM_LIB = {
    key_red: { id: 'key_red' },
    key_blue: { id: 'key_blue' },
    map: { id: 'map' },
};

const TEST_OBSTACLE_LIB = {
    door_red: { id: 'door_red', clear_set: [['key_red']] },
    door_blue: { id: 'door_blue', clear_set: [['key_blue']] },
    // Multi-item clear_set — v1 planner ignores it when pairing.
    two_lock: { id: 'two_lock', clear_set: [['key_red', 'key_blue']] },
};

describe('SIDES / OPPOSITE_SIDE', () => {
    it('covers all four sides', () => {
        expect(SIDES).toEqual(['N', 'S', 'E', 'W']);
    });

    it('OPPOSITE_SIDE is an involution', () => {
        for (const s of SIDES) {
            expect(OPPOSITE_SIDE[OPPOSITE_SIDE[s]]).toBe(s);
        }
    });
});

describe('ScenarioPool — counts', () => {
    it('reports remaining counts for items and obstacles', () => {
        const pool = new ScenarioPool({
            items: { key_red: 3, map: 1 },
            obstacles: { door_red: 2 },
            itemLib: TEST_ITEM_LIB,
            obstacleLib: TEST_OBSTACLE_LIB,
        });
        expect(pool.itemsRemaining()).toBe(4);
        expect(pool.obstaclesRemaining()).toBe(2);
        expect(pool.totalRemaining()).toBe(6);
    });

    it('empty pool reports zero', () => {
        const pool = new ScenarioPool();
        expect(pool.itemsRemaining()).toBe(0);
        expect(pool.obstaclesRemaining()).toBe(0);
    });

    it('snapshot is a deep copy (mutation does not leak)', () => {
        const pool = new ScenarioPool({
            items: { key_red: 2 }, obstacles: { door_red: 1 },
        });
        const snap = pool.snapshot();
        snap.items.key_red = 99;
        expect(pool.snapshot().items.key_red).toBe(2);
    });
});

describe('ScenarioPool — planPlacement', () => {
    const defaultPool = () => new ScenarioPool({
        items: { key_red: 2, key_blue: 1, map: 1 },
        obstacles: { door_red: 1, door_blue: 1 },
        itemLib: TEST_ITEM_LIB,
        obstacleLib: TEST_OBSTACLE_LIB,
    });

    it('requires rng', () => {
        const pool = defaultPool();
        expect(() => pool.planPlacement({})).toThrow(/rng/);
    });

    it('picks up to maxItems items', () => {
        const pool = defaultPool();
        const plan = pool.planPlacement({ rng: createRng(1), maxItems: 2 });
        expect(plan.items_to_place.length).toBeGreaterThan(0);
        expect(plan.items_to_place.length).toBeLessThanOrEqual(2);
    });

    it('returns empty plan when pool is empty', () => {
        const pool = new ScenarioPool({ items: {}, obstacles: {} });
        const plan = pool.planPlacement({ rng: createRng(1) });
        expect(plan.items_to_place).toEqual([]);
        expect(plan.obstacles_to_place).toEqual([]);
    });

    it('pairs gating items with matching obstacles', () => {
        // Rig the pool so only key_red + door_red are available.
        const pool = new ScenarioPool({
            items: { key_red: 1 },
            obstacles: { door_red: 1 },
            itemLib: TEST_ITEM_LIB,
            obstacleLib: TEST_OBSTACLE_LIB,
        });
        const plan = pool.planPlacement({ rng: createRng(1), maxItems: 2 });
        expect(plan.items_to_place).toEqual(['key_red']);
        expect(plan.obstacles_to_place).toEqual(['door_red']);
    });

    it('does not pair if no matching obstacle is in the pool', () => {
        const pool = new ScenarioPool({
            items: { key_red: 1 },
            obstacles: {},
            itemLib: TEST_ITEM_LIB,
            obstacleLib: TEST_OBSTACLE_LIB,
        });
        const plan = pool.planPlacement({ rng: createRng(1), maxItems: 2 });
        expect(plan.obstacles_to_place).toEqual([]);
    });

    it('ignores multi-item clear_sets when pairing (v1 limitation)', () => {
        // Only two_lock is in the pool; it requires key_red AND key_blue.
        // Planner should NOT pair it with a single key_red.
        const pool = new ScenarioPool({
            items: { key_red: 1 },
            obstacles: { two_lock: 1 },
            itemLib: TEST_ITEM_LIB,
            obstacleLib: TEST_OBSTACLE_LIB,
        });
        const plan = pool.planPlacement({ rng: createRng(1), maxItems: 2 });
        expect(plan.items_to_place).toEqual(['key_red']);
        expect(plan.obstacles_to_place).toEqual([]);
    });

    it('is deterministic for a fixed rng seed', () => {
        const pool1 = defaultPool();
        const pool2 = defaultPool();
        const plan1 = pool1.planPlacement({ rng: createRng(42), maxItems: 3 });
        const plan2 = pool2.planPlacement({ rng: createRng(42), maxItems: 3 });
        expect(plan1).toEqual(plan2);
    });
});

describe('ScenarioPool — markPlaced', () => {
    it('decrements counts for placed items and obstacles', () => {
        const pool = new ScenarioPool({
            items: { key_red: 3, map: 1 },
            obstacles: { door_red: 2 },
        });
        pool.markPlaced({
            placed_items: [
                { item_id: 'key_red', position: { x: 0, y: 0 } },
                { item_id: 'map', position: { x: 1, y: 1 } },
            ],
            placed_obstacles: [
                { obstacle_id: 'door_red', position: { x: 2, y: 2 } },
            ],
        });
        expect(pool.snapshot()).toEqual({
            items: { key_red: 2, map: 0 },
            obstacles: { door_red: 1 },
        });
    });

    it('never drops below zero', () => {
        const pool = new ScenarioPool({ items: { key_red: 1 } });
        pool.markPlaced({
            placed_items: [
                { item_id: 'key_red', position: { x: 0, y: 0 } },
                { item_id: 'key_red', position: { x: 1, y: 1 } },
            ],
        });
        expect(pool.snapshot().items.key_red).toBe(0);
    });

    it('ignores unknown ids silently', () => {
        const pool = new ScenarioPool({ items: { key_red: 1 } });
        pool.markPlaced({
            placed_items: [{ item_id: 'nonexistent', position: { x: 0, y: 0 } }],
        });
        expect(pool.snapshot().items.key_red).toBe(1);
    });
});

describe('ScenarioPool — plan + markPlaced round trip', () => {
    it('reports exactly what was offered going unused', () => {
        // Plan, then mark-placed only part of what was offered; remaining
        // items stay in the pool for later regions.
        const pool = new ScenarioPool({
            items: { key_red: 2 },
            obstacles: { door_red: 1 },
            itemLib: TEST_ITEM_LIB,
            obstacleLib: TEST_OBSTACLE_LIB,
        });
        const plan = pool.planPlacement({ rng: createRng(1), maxItems: 2 });
        pool.markPlaced({
            placed_items: [{ item_id: plan.items_to_place[0], position: { x: 0, y: 0 } }],
            placed_obstacles: [],
        });
        expect(pool.itemsRemaining()).toBe(1);
        expect(pool.obstaclesRemaining()).toBe(1);
    });
});

// --- Grid and stitcher ---

function makeRegionStub({ region_id, exits = [], items = [], exits_placed = [] }) {
    return {
        region_id,
        extracted_rules: {
            region_id,
            entrance: { x: 0, y: 0 },
            exits: exits.map((e) => ({
                id: e.id,
                position: e.position,
                target_region: null,
                paths: [{ path_id: 'p1', obstacles: e.obstacles ?? [] }],
            })),
            locations: [],
        },
        placed_items: items,
        placed_obstacles: [],
        exits_placed,
    };
}

describe('Grid', () => {
    it('rejects invalid dimensions', () => {
        expect(() => new Grid({ width: 0, height: 5 })).toThrow();
        expect(() => new Grid({ width: 5, height: -1 })).toThrow();
    });

    it('isInBounds matches the grid dimensions', () => {
        const g = new Grid({ width: 3, height: 3 });
        expect(g.isInBounds({ gx: 0, gy: 0 })).toBe(true);
        expect(g.isInBounds({ gx: 2, gy: 2 })).toBe(true);
        expect(g.isInBounds({ gx: 3, gy: 0 })).toBe(false);
        expect(g.isInBounds({ gx: -1, gy: 0 })).toBe(false);
    });

    it('placeRegion / hasRegion / getRegion round-trip', () => {
        const g = new Grid({ width: 3, height: 3 });
        const r = makeRegionStub({ region_id: 'A' });
        g.placeRegion({ gx: 1, gy: 1 }, r);
        expect(g.hasRegion({ gx: 1, gy: 1 })).toBe(true);
        expect(g.getRegion({ gx: 1, gy: 1 }).region_id).toBe('A');
        expect(g.hasRegion({ gx: 0, gy: 0 })).toBe(false);
    });

    it('rejects placing out of bounds or on an occupied cell', () => {
        const g = new Grid({ width: 2, height: 2 });
        const r = makeRegionStub({ region_id: 'A' });
        g.placeRegion({ gx: 0, gy: 0 }, r);
        expect(() => g.placeRegion({ gx: 0, gy: 0 }, r)).toThrow(/occupied/);
        expect(() => g.placeRegion({ gx: 5, gy: 5 }, r)).toThrow(/out of bounds/);
    });

    it('neighborCell returns the adjacent cell or null at grid edge', () => {
        const g = new Grid({ width: 3, height: 3 });
        expect(g.neighborCell({ gx: 1, gy: 1 }, 'N')).toEqual({ gx: 1, gy: 0 });
        expect(g.neighborCell({ gx: 1, gy: 1 }, 'S')).toEqual({ gx: 1, gy: 2 });
        expect(g.neighborCell({ gx: 1, gy: 1 }, 'E')).toEqual({ gx: 2, gy: 1 });
        expect(g.neighborCell({ gx: 1, gy: 1 }, 'W')).toEqual({ gx: 0, gy: 1 });
        expect(g.neighborCell({ gx: 0, gy: 0 }, 'N')).toBeNull();
        expect(g.neighborCell({ gx: 0, gy: 0 }, 'W')).toBeNull();
    });

    it('openSides returns unbuilt in-bounds sides', () => {
        const g = new Grid({ width: 3, height: 3 });
        g.placeRegion({ gx: 1, gy: 1 }, makeRegionStub({ region_id: 'center' }));
        expect(g.openSides({ gx: 1, gy: 1 }).sort()).toEqual(['E', 'N', 'S', 'W']);
        g.placeRegion({ gx: 1, gy: 0 }, makeRegionStub({ region_id: 'north' }));
        expect(g.openSides({ gx: 1, gy: 1 }).sort()).toEqual(['E', 'S', 'W']);
    });
});

describe('stitchGrid', () => {
    it('resolves exit target_region using grid adjacency', () => {
        const g = new Grid({ width: 3, height: 3 });
        const a = makeRegionStub({
            region_id: 'A',
            exits: [{ id: 'exit', position: { x: 9, y: 3 } }],
            exits_placed: [{ side: 'E', tile_position: { x: 9, y: 3 } }],
        });
        const b = makeRegionStub({
            region_id: 'B',
            exits: [{ id: 'exit', position: { x: 0, y: 3 } }],
            exits_placed: [{ side: 'W', tile_position: { x: 0, y: 3 } }],
        });
        g.placeRegion({ gx: 1, gy: 1 }, a);
        g.placeRegion({ gx: 2, gy: 1 }, b);
        stitchGrid(g);
        expect(g.getRegion({ gx: 1, gy: 1 }).extracted_rules.exits[0].target_region).toBe('B');
        expect(g.getRegion({ gx: 2, gy: 1 }).extracted_rules.exits[0].target_region).toBe('A');
    });

    it('leaves target_region null when the neighbor is unbuilt', () => {
        const g = new Grid({ width: 3, height: 3 });
        const a = makeRegionStub({
            region_id: 'A',
            exits: [{ id: 'exit', position: { x: 9, y: 3 } }],
            exits_placed: [{ side: 'E', tile_position: { x: 9, y: 3 } }],
        });
        g.placeRegion({ gx: 1, gy: 1 }, a);
        stitchGrid(g);
        expect(g.getRegion({ gx: 1, gy: 1 }).extracted_rules.exits[0].target_region).toBeNull();
    });

    it('is re-runnable: later builds update earlier regions target_region', () => {
        const g = new Grid({ width: 3, height: 3 });
        const a = makeRegionStub({
            region_id: 'A',
            exits: [{ id: 'exit', position: { x: 9, y: 3 } }],
            exits_placed: [{ side: 'E', tile_position: { x: 9, y: 3 } }],
        });
        g.placeRegion({ gx: 1, gy: 1 }, a);
        stitchGrid(g);
        expect(g.getRegion({ gx: 1, gy: 1 }).extracted_rules.exits[0].target_region).toBeNull();

        const b = makeRegionStub({ region_id: 'B' });
        g.placeRegion({ gx: 2, gy: 1 }, b);
        stitchGrid(g);
        expect(g.getRegion({ gx: 1, gy: 1 }).extracted_rules.exits[0].target_region).toBe('B');
    });
});

describe('accumulatedInventory', () => {
    it('is the union of placed_items across all built regions', () => {
        const g = new Grid({ width: 3, height: 3 });
        g.placeRegion({ gx: 0, gy: 0 }, makeRegionStub({
            region_id: 'A',
            items: [{ item_id: 'key_red', position: { x: 0, y: 0 } }],
        }));
        g.placeRegion({ gx: 1, gy: 0 }, makeRegionStub({
            region_id: 'B',
            items: [
                { item_id: 'map', position: { x: 0, y: 0 } },
                { item_id: 'key_blue', position: { x: 1, y: 1 } },
            ],
        }));
        const inv = accumulatedInventory(g);
        expect(inv).toEqual(new Set(['key_red', 'map', 'key_blue']));
    });

    it('is empty when no regions have been placed', () => {
        const g = new Grid({ width: 3, height: 3 });
        expect(accumulatedInventory(g)).toEqual(new Set());
    });
});

describe('cellKey', () => {
    it('produces a stable string for a cell', () => {
        expect(cellKey({ gx: 0, gy: 0 })).toBe('0,0');
        expect(cellKey({ gx: 3, gy: 7 })).toBe('3,7');
    });
});
