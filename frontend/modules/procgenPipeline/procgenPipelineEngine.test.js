import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
import {
    ScenarioPool, SIDES, OPPOSITE_SIDE,
    Grid, cellKey,
    stitchGrid, accumulatedInventory,
    wallOffUnusedExits, growMaze, compileRegionGraph,
    buildPresetSidecars, buildRulesJson, stringifyRulesJson,
    findDisconnectedCell,
} from './procgenPipelineEngine.js';
import { deserializeMazeWorld } from '../mazeRoom/mazeRoomEngine.js';

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

describe('wallOffUnusedExits', () => {
    it('removes exits whose target_region is null', () => {
        const g = new Grid({ width: 2, height: 1 });
        g.placeRegion({ gx: 0, gy: 0 }, makeRegionStub({
            region_id: 'A',
            exits: [
                { id: 'exit_a', position: { x: 0, y: 0 } },
                { id: 'exit_b', position: { x: 1, y: 1 } },
            ],
            exits_placed: [
                { side: 'E', tile_position: { x: 0, y: 0 } },
                { side: 'S', tile_position: { x: 1, y: 1 } },
            ],
        }));
        // stitchGrid leaves both target_region null (no neighbors built).
        stitchGrid(g);
        wallOffUnusedExits(g);
        expect(g.getRegion({ gx: 0, gy: 0 }).extracted_rules.exits).toEqual([]);
    });

    it('preserves exits whose target_region is resolved', () => {
        const g = new Grid({ width: 2, height: 1 });
        g.placeRegion({ gx: 0, gy: 0 }, makeRegionStub({
            region_id: 'A',
            exits: [{ id: 'exit', position: { x: 9, y: 3 } }],
            exits_placed: [{ side: 'E', tile_position: { x: 9, y: 3 } }],
        }));
        g.placeRegion({ gx: 1, gy: 0 }, makeRegionStub({ region_id: 'B' }));
        stitchGrid(g);
        wallOffUnusedExits(g);
        expect(g.getRegion({ gx: 0, gy: 0 }).extracted_rules.exits).toHaveLength(1);
        expect(g.getRegion({ gx: 0, gy: 0 }).extracted_rules.exits[0].target_region).toBe('B');
    });
});

describe('Grid teleporters', () => {
    it('records and resolves a teleporter mapping', () => {
        const g = new Grid({ width: 3, height: 3 });
        g.setTeleporter({ gx: 0, gy: 0 }, 'E', { gx: 2, gy: 2 });
        expect(g.getTeleporter({ gx: 0, gy: 0 }, 'E')).toEqual({ gx: 2, gy: 2 });
        expect(g.getTeleporter({ gx: 0, gy: 0 }, 'N')).toBeNull();
    });
});

describe('findDisconnectedCell', () => {
    it('returns the grid center when no regions exist', () => {
        const g = new Grid({ width: 5, height: 5 });
        const cell = findDisconnectedCell(g, createRng(1));
        expect(cell).toEqual({ gx: 2, gy: 2 });
    });

    it('only returns cells at least minGap=2 from any built region', () => {
        const g = new Grid({ width: 7, height: 1 });
        g.placeRegion({ gx: 0, gy: 0 }, { region_id: 'r', exits_placed: [] });
        // Run a bunch of times to exercise rng — every result must be
        // ≥ 2 cells from gx=0.
        for (let i = 0; i < 20; i++) {
            const cell = findDisconnectedCell(g, createRng(i));
            expect(cell).toBeTruthy();
            expect(cell.gx).toBeGreaterThanOrEqual(2);
        }
    });

    it('returns null when no cell satisfies the minGap', () => {
        const g = new Grid({ width: 2, height: 1 });
        g.placeRegion({ gx: 0, gy: 0 }, { region_id: 'r', exits_placed: [] });
        // Only cell left is (1,0), at distance 1 — fails minGap=2.
        expect(findDisconnectedCell(g, createRng(1))).toBeNull();
    });
});

describe('stitchGrid (teleporters)', () => {
    it('routes target_region through grid.teleporters when set', () => {
        const grid = new Grid({ width: 5, height: 1 });
        // Two regions placed non-adjacently. A's east "exit" routes
        // to B via teleporter (geographic east of A is empty).
        grid.placeRegion({ gx: 0, gy: 0 }, {
            region_id: 'A',
            playable_payload: {
                exits: new Map([['exit', { exit_id: 'exit', x: 5, y: 2, side: 'E', targetRegion: null }]]),
            },
            extracted_rules: {
                exits: [{ id: 'exit', position: { x: 5, y: 2 }, target_region: null }],
            },
            exits_placed: [{ exit_id: 'exit', side: 'E', tile_position: { x: 5, y: 2 } }],
        });
        grid.placeRegion({ gx: 4, gy: 0 }, {
            region_id: 'B',
            playable_payload: { exits: new Map() },
            extracted_rules: { exits: [] },
            exits_placed: [],
        });
        grid.setTeleporter({ gx: 0, gy: 0 }, 'E', { gx: 4, gy: 0 });

        stitchGrid(grid);

        const a = grid.getRegion({ gx: 0, gy: 0 });
        expect(a.extracted_rules.exits[0].target_region).toBe('B');
        // isTeleporter flag rides on the world.exits entry too.
        expect(a.playable_payload.exits.get('exit').isTeleporter).toBe(true);
    });

    it('does not flag normal adjacent exits as teleporters', () => {
        const grid = new Grid({ width: 2, height: 1 });
        grid.placeRegion({ gx: 0, gy: 0 }, {
            region_id: 'A',
            playable_payload: {
                exits: new Map([['exit', { exit_id: 'exit', x: 5, y: 2, side: 'E', targetRegion: null }]]),
            },
            extracted_rules: {
                exits: [{ id: 'exit', position: { x: 5, y: 2 }, target_region: null }],
            },
            exits_placed: [{ exit_id: 'exit', side: 'E', tile_position: { x: 5, y: 2 } }],
        });
        grid.placeRegion({ gx: 1, gy: 0 }, {
            region_id: 'B',
            playable_payload: { exits: new Map() },
            extracted_rules: { exits: [] },
            exits_placed: [],
        });

        stitchGrid(grid);

        const a = grid.getRegion({ gx: 0, gy: 0 });
        expect(a.playable_payload.exits.get('exit').isTeleporter).toBe(false);
    });
});

describe('growMaze', () => {
    it('requires gridDims and regionSize', () => {
        expect(() => growMaze({})).toThrow(/gridDims/);
        expect(() => growMaze({ gridDims: { width: 3, height: 3 } })).toThrow(/regionSize/);
    });

    it('builds at least the start region', () => {
        const { grid, stats } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: {}, obstaclePool: {},
            seed: 1,
        });
        expect(stats.regionsBuilt).toBeGreaterThanOrEqual(1);
        expect(grid.hasRegion({ gx: 1, gy: 1 })).toBe(true);
    });

    it('stops when the scenario pool is empty', () => {
        // 2 keys + 2 doors — should build ~2-3 regions.
        const { stats, pool } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 7,
            regionParams: { minSuccessPct: 0.3, maxSuccessPct: 0.6 },
        });
        expect(['pool_empty', 'frontier_empty']).toContain(stats.stopReason);
        // Pool may be fully drained or partially — but not over-drained.
        expect(pool.itemsRemaining()).toBeGreaterThanOrEqual(0);
    });

    it('respects maxRegions cap', () => {
        const { stats } = growMaze({
            gridDims: { width: 5, height: 5 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 99 },
            obstaclePool: { door_red: 99 },
            seed: 1,
            growthParams: { maxRegions: 3 },
        });
        expect(stats.regionsBuilt).toBe(3);
        expect(stats.stopReason).toBe('max_regions');
    });

    it('produces multi-exit regions when branchProbability > 0', () => {
        const { grid } = growMaze({
            gridDims: { width: 5, height: 5 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 99 },
            obstaclePool: { door_red: 99 },
            seed: 1,
            growthParams: { maxRegions: 6, branchProbability: 1.0 },
        });
        // With branchProbability=1, the start region offers all of
        // its in-bounds sides — at least 2 exits given a 5×5 grid.
        const start = grid.getRegion({ gx: 2, gy: 2 });
        expect(start.exits_placed.length).toBeGreaterThanOrEqual(2);
    });

    it('collapses to single-exit regions when branchProbability = 0', () => {
        const { grid } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 99 },
            obstaclePool: { door_red: 99 },
            seed: 1,
            growthParams: { maxRegions: 4, branchProbability: 0 },
        });
        for (const region of grid.allRegions()) {
            // Every region has exactly one exit (post-wallOff).
            expect(region.extracted_rules.exits.length).toBeLessThanOrEqual(1);
        }
    });

    it('routes via teleporter when the geographic neighbor is OOB', () => {
        // Start at the center of a tight 3x3 grid with branchProbability=1
        // so all sides are exited; the neighbor in (2, 2)'s east direction
        // is out of bounds, so the corresponding child region must
        // route via teleporter.
        const { grid, stats } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 99 },
            obstaclePool: { door_red: 99 },
            seed: 1,
            growthParams: { maxRegions: 9, branchProbability: 1.0 },
        });
        // Some teleporter mappings should have been recorded (at
        // least one OOB child got placed elsewhere).
        // It's possible no teleporter fires if every non-center cell
        // gets built first; check by looking at the resolved targets
        // of edge regions instead.
        let teleportersSeen = stats.teleportersPlaced;
        if (teleportersSeen === 0) {
            // Fallback: check via the grid teleporter map.
            teleportersSeen = grid.teleporters.size;
        }
        expect(teleportersSeen).toBeGreaterThan(0);
    });

    it('all placed exits resolve to a built region (or get walled off)', () => {
        const { grid } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 3 },
            obstaclePool: { door_red: 3 },
            seed: 11,
            regionParams: { minSuccessPct: 0.3, maxSuccessPct: 0.6 },
        });
        for (const region of grid.allRegions()) {
            for (const exit of region.extracted_rules.exits) {
                expect(exit.target_region).not.toBeNull();
                expect(grid.cells.has(/* cellKey — look up target_region */
                    [...grid.cells.values()]
                        .find((r) => r.region_id === exit.target_region)
                        ?.cell
                        ? cellKey([...grid.cells.values()]
                            .find((r) => r.region_id === exit.target_region).cell)
                        : 'nonexistent',
                )).toBe(true);
            }
        }
    });

    it('is deterministic for a fixed seed', () => {
        const cfg = {
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 42,
            regionParams: { minSuccessPct: 0.3, maxSuccessPct: 0.6 },
        };
        const a = growMaze(cfg);
        const b = growMaze(cfg);
        expect(a.stats).toEqual(b.stats);
        expect(a.grid.cells.size).toBe(b.grid.cells.size);
        for (const [key, regA] of a.grid.cells) {
            const regB = b.grid.cells.get(key);
            expect(regB).toBeDefined();
            expect(regA.placed_items).toEqual(regB.placed_items);
            expect(regA.placed_obstacles).toEqual(regB.placed_obstacles);
        }
    });

    it('regions grow out from the center', () => {
        const { grid, startCell } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 3 },
            obstaclePool: { door_red: 3 },
            seed: 3,
            regionParams: { minSuccessPct: 0.3, maxSuccessPct: 0.6 },
        });
        expect(startCell).toEqual({ gx: 1, gy: 1 });
        expect(grid.hasRegion(startCell)).toBe(true);
        // Start region has no items or obstacles.
        const startRegion = grid.getRegion(startCell);
        expect(startRegion.placed_items).toEqual([]);
        expect(startRegion.placed_obstacles).toEqual([]);
    });

    it('each built region carries the expected composition shape', () => {
        const { grid } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 9,
            regionParams: { minSuccessPct: 0.3, maxSuccessPct: 0.6 },
        });
        for (const region of grid.allRegions()) {
            expect(region).toHaveProperty('region_id');
            expect(region).toHaveProperty('playable_payload');
            expect(region).toHaveProperty('extracted_rules');
            expect(region).toHaveProperty('placed_items');
            expect(region).toHaveProperty('placed_obstacles');
            expect(region).toHaveProperty('exits_placed');
            expect(region.render_hint).toBe('maze');
            expect(region.sidecar_filename).toBe(`${region.region_id}.json`);
        }
    });
});

describe('compileRegionGraph', () => {
    function smallGridWithItems() {
        return growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 17,
            regionParams: { minSuccessPct: 0.3, maxSuccessPct: 0.6 },
        });
    }

    it('requires startCell', () => {
        const { grid } = smallGridWithItems();
        expect(() => compileRegionGraph(grid, {})).toThrow(/startCell/);
    });

    it('emits one regions entry per built region', () => {
        const { grid, startCell } = smallGridWithItems();
        const out = compileRegionGraph(grid, { startCell });
        expect(Object.keys(out.regions).length).toBe(grid.cells.size);
    });

    it('start_region_name matches the start cell region', () => {
        const { grid, startCell } = smallGridWithItems();
        const out = compileRegionGraph(grid, { startCell });
        expect(out.start_region_name).toBe(grid.getRegion(startCell).region_id);
    });

    it('every exit references a region that exists in regions dict', () => {
        const { grid, startCell } = smallGridWithItems();
        const out = compileRegionGraph(grid, { startCell });
        for (const region of Object.values(out.regions)) {
            for (const ex of region.exits) {
                expect(ex.connected_region).not.toBeNull();
                expect(out.regions[ex.connected_region]).toBeDefined();
            }
        }
    });

    it('location names are globally unique', () => {
        const { grid, startCell } = smallGridWithItems();
        const out = compileRegionGraph(grid, { startCell });
        const names = [];
        for (const region of Object.values(out.regions)) {
            for (const loc of region.locations) names.push(loc.name);
        }
        expect(new Set(names).size).toBe(names.length);
    });

    it('itempool_counts matches the total items placed across the grid', () => {
        const { grid, startCell } = smallGridWithItems();
        const out = compileRegionGraph(grid, { startCell });
        const totalPlaced = [...grid.cells.values()]
            .reduce((sum, r) => sum + r.placed_items.length, 0);
        const totalInPool = Object.values(out.itempool_counts).reduce((a, b) => a + b, 0);
        expect(totalInPool).toBe(totalPlaced);
    });

    it('canonical_placements has one entry per placed item location', () => {
        const { grid, startCell } = smallGridWithItems();
        const out = compileRegionGraph(grid, { startCell });
        const placements = Object.keys(out.canonical_placements).length;
        const totalPlaced = [...grid.cells.values()]
            .reduce((sum, r) => sum + r.placed_items.length, 0);
        expect(placements).toBe(totalPlaced);
    });

    it('compiled exit rules are Rule Builder JSON', () => {
        const { grid, startCell } = smallGridWithItems();
        const out = compileRegionGraph(grid, { startCell });
        // At least one exit should have a Has or True_ rule.
        let sawRule = false;
        for (const region of Object.values(out.regions)) {
            for (const ex of region.exits) {
                expect(ex.access_rule).toBeTypeOf('object');
                expect(ex.access_rule).toHaveProperty('rule');
                if (ex.access_rule.rule === 'Has' || ex.access_rule.rule === 'True_') sawRule = true;
            }
        }
        expect(sawRule).toBe(true);
    });

    it('is deterministic for a fixed seed', () => {
        const a = smallGridWithItems();
        const b = smallGridWithItems();
        const outA = compileRegionGraph(a.grid, { startCell: a.startCell });
        const outB = compileRegionGraph(b.grid, { startCell: b.startCell });
        expect(outA).toEqual(outB);
    });

    it('emits an itemPlacement object on each item-bearing location', () => {
        const { grid, startCell } = smallGridWithItems();
        const out = compileRegionGraph(grid, { startCell });

        let itemLocationsChecked = 0;
        for (const region of Object.values(out.regions)) {
            for (const loc of region.locations) {
                if (!loc.item) continue;
                // Shape must match rules.schema.json $defs/itemPlacement
                // so stateManager's checkLocation can actually grant the
                // item at runtime.
                expect(loc.item).toMatchObject({
                    name: expect.any(String),
                    player: 1,
                    advancement: expect.any(Boolean),
                });
                expect(loc.item.type).toBeDefined();
                // Consistent with canonical_placements (same name).
                expect(loc.item.name).toBe(out.canonical_placements[loc.name]);
                itemLocationsChecked++;
            }
        }
        expect(itemLocationsChecked).toBeGreaterThan(0);
    });

    it('uses the supplied playerId in itemPlacement.player', () => {
        const { grid, startCell } = smallGridWithItems();
        const out = compileRegionGraph(grid, { startCell, playerId: 3 });
        for (const region of Object.values(out.regions)) {
            for (const loc of region.locations) {
                if (loc.item) expect(loc.item.player).toBe(3);
            }
        }
    });
});

describe('buildPresetSidecars', () => {
    function smallGrid() {
        return growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 5,
            regionParams: { minSuccessPct: 0.3, maxSuccessPct: 0.6 },
        });
    }

    it('emits one sidecar per built region, keyed by region_id', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        const regionNames = grid.allRegions().map((r) => r.region_id);
        expect(Object.keys(sidecars['1']).sort()).toEqual(regionNames.sort());
    });

    it('each sidecar has substrate, render_hint, and playable_payload', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        for (const side of Object.values(sidecars['1'])) {
            expect(side.substrate).toBe('maze');
            expect(side.render_hint).toBe('maze');
            expect(side.playable_payload).toBeDefined();
        }
    });

    it('playable_payload serializes tiles, obstacles, and items into JSON-safe shapes', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        for (const side of Object.values(sidecars['1'])) {
            const p = side.playable_payload;
            // tiles is a plain array, not Int8Array
            expect(Array.isArray(p.tiles)).toBe(true);
            expect(p.tiles.length).toBe(p.width * p.height);
            // obstacles/items are arrays of {x, y, id}
            expect(Array.isArray(p.obstacles)).toBe(true);
            for (const o of p.obstacles) {
                expect(Number.isInteger(o.x)).toBe(true);
                expect(Number.isInteger(o.y)).toBe(true);
                expect(typeof o.id).toBe('string');
            }
            expect(Array.isArray(p.items)).toBe(true);
            for (const i of p.items) {
                expect(Number.isInteger(i.x)).toBe(true);
                expect(Number.isInteger(i.y)).toBe(true);
                expect(typeof i.id).toBe('string');
            }
            // obstacleLib extras — standard library entries must not
            // be duplicated.
            expect(p.obstacleLib.door_red).toBeUndefined();
        }
    });

    it('whole sidecars payload round-trips through JSON.stringify', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        const reparsed = JSON.parse(JSON.stringify(sidecars));
        expect(reparsed).toEqual(sidecars);
    });

    it('uses a custom playerId when supplied', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid, { playerId: '2' });
        expect(sidecars['2']).toBeDefined();
        expect(sidecars['1']).toBeUndefined();
    });

    it('bakes locationName into each item entry, matching the compiled location name', () => {
        const { grid, startCell } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        const compiled = compileRegionGraph(grid, { startCell });

        // Build a position-keyed lookup of compiled location names per
        // region so we can cross-check what landed in the sidecar.
        const nameLookup = new Map();
        for (const region of grid.allRegions()) {
            for (const loc of region.extracted_rules.locations ?? []) {
                if (!loc.position || !loc.item) continue;
                const compiledRegion = compiled.regions[region.region_id];
                const expected = compiledRegion.locations.find((l) => l.name.endsWith(`__${loc.position.x}_${loc.position.y}`));
                expect(expected).toBeDefined();
                nameLookup.set(`${region.region_id}|${loc.position.x},${loc.position.y}`, expected.name);
            }
        }

        // Smoke check: at least one item with an expected name was
        // placed somewhere in the grid (otherwise this test would
        // pass vacuously).
        let itemsChecked = 0;
        for (const [regionId, side] of Object.entries(sidecars['1'])) {
            for (const item of side.playable_payload.items) {
                expect(typeof item.locationName).toBe('string');
                const expected = nameLookup.get(`${regionId}|${item.x},${item.y}`);
                expect(item.locationName).toBe(expected);
                itemsChecked++;
            }
        }
        expect(itemsChecked).toBeGreaterThan(0);
    });

    it('round-trips through deserializeMazeWorld back to a playable world shape', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        for (const region of grid.allRegions()) {
            const sidecar = sidecars['1'][region.region_id].playable_payload;
            const restored = deserializeMazeWorld(sidecar);

            const original = region.playable_payload;
            expect(restored.width).toBe(original.width);
            expect(restored.height).toBe(original.height);
            expect(Array.from(restored.tiles)).toEqual(Array.from(original.tiles));
            expect(restored.entrance).toEqual({ x: original.entrance.x, y: original.entrance.y });
            // Compare exits Map content. v1 grid-growth still emits one
            // exit per region so the keys match exactly.
            expect([...restored.exits.keys()].sort())
                .toEqual([...original.exits.keys()].sort());
            for (const [id, originalExit] of original.exits) {
                const restoredExit = restored.exits.get(id);
                expect(restoredExit.x).toBe(originalExit.x);
                expect(restoredExit.y).toBe(originalExit.y);
            }
            // Maps content equal — same keys, same values
            expect([...restored.obstacles.entries()].sort())
                .toEqual([...original.obstacles.entries()].sort());
            expect([...restored.items.entries()].sort())
                .toEqual([...original.items.entries()].sort());
            // AP metadata preserved through the round-trip. A region
            // whose every exit got walled off has no exits at all,
            // and that's fine — verify only when the original region
            // still has at least one exit.
            const expectedExit = region.extracted_rules.exits?.[0];
            if (expectedExit) {
                const restoredExit = restored.exits.get(expectedExit.id);
                expect(restoredExit?.exitName).toBe(expectedExit.id);
                expect(restoredExit?.targetRegion).toBe(expectedExit.target_region);
            } else {
                expect(restored.exits.size).toBe(0);
            }
            for (const [key] of restored.items) {
                // For every item, the locationName Map should have an entry
                // matching what the sidecar carried.
                const sidecarItem = sidecar.items.find((i) => `${i.x},${i.y}` === key);
                if (sidecarItem?.locationName) {
                    expect(restored.itemLocationNames.get(key)).toBe(sidecarItem.locationName);
                }
            }
        }
    });

    it('bakes exitName and targetRegion into each exit entry', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);

        // Locate at least one region whose exit was stitched to a
        // neighbor (target_region != null) and check its sidecar.
        let stitchedExitsChecked = 0;
        for (const region of grid.allRegions()) {
            const exits = sidecars['1'][region.region_id].playable_payload.exits;
            // Build a quick lookup from extracted_rules to compare against.
            const extractedById = new Map();
            for (const e of region.extracted_rules.exits ?? []) {
                extractedById.set(e.id, e);
            }
            for (const sideExit of exits) {
                const ext = extractedById.get(sideExit.exit_id);
                expect(sideExit.exitName).toBe(ext?.id ?? null);
                expect(sideExit.targetRegion).toBe(ext?.target_region ?? null);
                if (ext?.target_region) stitchedExitsChecked++;
            }
        }
        expect(stitchedExitsChecked).toBeGreaterThan(0);
    });
});

describe('buildRulesJson', () => {
    function smallGrid() {
        return growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 5,
            regionParams: { minSuccessPct: 0.3, maxSuccessPct: 0.6 },
        });
    }

    it('requires startCell', () => {
        const { grid } = smallGrid();
        expect(() => buildRulesJson(grid, {})).toThrow(/startCell/);
    });

    it('produces a schema-v3 rules.json with the expected top-level fields', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        expect(out.schema_version).toBe(3);
        for (const key of [
            'game_name', 'game_directory', 'archipelago_version',
            'generation_seed', 'seed_name', 'player_names',
            'world_classes', 'regions', 'start_regions', 'items',
            'itempool_counts', 'canonical_placements', 'world',
            'game_info', 'helpers', 'preset_sidecars',
        ]) {
            expect(out).toHaveProperty(key);
        }
    });

    it('plugs compiled substructures under player id 1', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        expect(Object.keys(out.regions['1']).length).toBeGreaterThan(0);
        // Menu is the advertised start region.
        expect(out.regions['1'][out.start_regions['1'].default[0]]).toBeDefined();
    });

    it('wraps the compiled graph in a virtual Menu start region', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        expect(out.start_regions['1'].default).toEqual(['Menu']);
        const menu = out.regions['1'].Menu;
        expect(menu).toBeDefined();
        expect(menu.locations).toEqual([]);
        expect(menu.exits).toHaveLength(1);
        expect(menu.exits[0].connected_region)
            .toBe(grid.getRegion(startCell).region_id);
        expect(menu.exits[0].access_rule).toEqual({ rule: 'True_' });
        // Menu itself must show up first in the regions dict.
        expect(Object.keys(out.regions['1'])[0]).toBe('Menu');
    });

    it('sets item_groups["1"] to ["Everything"]', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        expect(out.item_groups['1']).toEqual(['Everything']);
    });

    it('tags every emitted item with groups: ["Everything"]', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        const items = out.items['1'];
        expect(Object.keys(items).length).toBeGreaterThan(0);
        for (const def of Object.values(items)) {
            expect(def.groups).toEqual(['Everything']);
        }
    });

    it('assigns numeric ids to every item (unique within the game)', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        const items = out.items['1'];
        const ids = Object.values(items).map((def) => def.id);
        expect(ids.length).toBeGreaterThan(0);
        for (const id of ids) {
            expect(Number.isInteger(id)).toBe(true);
        }
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('embeds per-region sidecars keyed by region name (Menu excluded)', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        const regionNames = grid.allRegions().map((r) => r.region_id);
        const sidecarNames = Object.keys(out.preset_sidecars['1']);
        expect(sidecarNames.sort()).toEqual(regionNames.sort());
        // Menu is virtual and must not have a sidecar.
        expect(out.preset_sidecars['1'].Menu).toBeUndefined();
    });

    it('entire rules.json round-trips through JSON.stringify', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        const reparsed = JSON.parse(JSON.stringify(out));
        expect(reparsed).toEqual(out);
    });

    it('is deterministic for a fixed seed', () => {
        const a = smallGrid();
        const b = smallGrid();
        expect(buildRulesJson(a.grid, { startCell: a.startCell }))
            .toEqual(buildRulesJson(b.grid, { startCell: b.startCell }));
    });
});

describe('stringifyRulesJson', () => {
    function smallGrid() {
        return growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 5,
            regionParams: { minSuccessPct: 0.3, maxSuccessPct: 0.6 },
        });
    }

    it('collapses each sidecar tiles array onto a single line', () => {
        const { grid, startCell } = smallGrid();
        const rules = buildRulesJson(grid, { startCell });
        const out = stringifyRulesJson(rules);
        // The default pretty-print puts each tile integer on its own
        // line. The compact form keeps them all on one line each. Count
        // lines that look like tile arrays.
        const tilesLines = out.split('\n').filter((l) => /^\s*"tiles":\s*\[/.test(l));
        expect(tilesLines.length).toBe(Object.keys(rules.preset_sidecars['1']).length);
        for (const line of tilesLines) {
            // Each tiles line must end with `]` or `],` on the same line.
            expect(/\][,\s]*$/.test(line.trimEnd())).toBe(true);
        }
    });

    it('output parses back to the same object', () => {
        const { grid, startCell } = smallGrid();
        const rules = buildRulesJson(grid, { startCell });
        const reparsed = JSON.parse(stringifyRulesJson(rules));
        expect(reparsed).toEqual(rules);
    });

    it('is meaningfully smaller than the default JSON.stringify(obj, null, 2)', () => {
        const { grid, startCell } = smallGrid();
        const rules = buildRulesJson(grid, { startCell });
        const defaultOut = JSON.stringify(rules, null, 2);
        const compactOut = stringifyRulesJson(rules);
        // Not bit-exact, but should save a non-trivial number of bytes.
        expect(compactOut.length).toBeLessThan(defaultOut.length);
    });

    it('handles missing preset_sidecars cleanly', () => {
        const rules = { schema_version: 3, regions: {} };
        const out = stringifyRulesJson(rules);
        expect(JSON.parse(out)).toEqual(rules);
    });
});
