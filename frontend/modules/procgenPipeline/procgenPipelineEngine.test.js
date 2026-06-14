import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
// Side-effect: registers the maze and text-adventure substrates.
// Driver tests below dispatch via substrateRegistry, which needs both
// available for the mixed-substrate end-to-end checks at the bottom.
import '../mazeRoom/mazeRoomLibrary.js';
import '../textAdventureSubstrate/textAdventureSubstrateLibrary.js';
import '../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import {
    ScenarioPool, SIDES, OPPOSITE_SIDE,
    Grid, cellKey,
    stitchGrid, accumulatedInventory,
    wallOffUnusedExits, growMaze, compileRegionGraph,
    buildPresetSidecars, buildRulesJson, stringifyRulesJson,
    findDisconnectedCell,
    topDownFromRulesJson,
    pickSubstrate, rollSubstrateMix,
    pickSubstrateWithQuota, totalRemainingQuota,
    reconcileBidirectionalExits,
    spiralCells, buildShuffledSubstrateSequence, arrangeShuffledSpiral,
    computeSourceCounts,
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
            exits: new Map([['exit', { exit_id: 'exit', x: 5, y: 2, side: 'E', targetRegion: null }]]),
            playable_payload: {},
            extracted_rules: {
                exits: [{ id: 'exit', position: { x: 5, y: 2 }, target_region: null }],
            },
            exits_placed: [{ exit_id: 'exit', side: 'E', tile_position: { x: 5, y: 2 } }],
        });
        grid.placeRegion({ gx: 4, gy: 0 }, {
            region_id: 'B',
            exits: new Map(),
            playable_payload: {},
            extracted_rules: { exits: [] },
            exits_placed: [],
        });
        grid.setTeleporter({ gx: 0, gy: 0 }, 'E', { gx: 4, gy: 0 });

        stitchGrid(grid);

        const a = grid.getRegion({ gx: 0, gy: 0 });
        expect(a.extracted_rules.exits[0].target_region).toBe('B');
        // isTeleporter flag rides on the world.exits entry too.
        expect(a.exits.get('exit').isTeleporter).toBe(true);
    });

    it('does not flag normal adjacent exits as teleporters', () => {
        const grid = new Grid({ width: 2, height: 1 });
        grid.placeRegion({ gx: 0, gy: 0 }, {
            region_id: 'A',
            exits: new Map([['exit', { exit_id: 'exit', x: 5, y: 2, side: 'E', targetRegion: null }]]),
            playable_payload: {},
            extracted_rules: {
                exits: [{ id: 'exit', position: { x: 5, y: 2 }, target_region: null }],
            },
            exits_placed: [{ exit_id: 'exit', side: 'E', tile_position: { x: 5, y: 2 } }],
        });
        grid.placeRegion({ gx: 1, gy: 0 }, {
            region_id: 'B',
            exits: new Map(),
            playable_payload: {},
            extracted_rules: { exits: [] },
            exits_placed: [],
        });

        stitchGrid(grid);

        const a = grid.getRegion({ gx: 0, gy: 0 });
        expect(a.exits.get('exit').isTeleporter).toBe(false);
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
            regionParams: {},
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

    it('collapses to single-exit regions when branchProbability = 0 (and bidirectional disabled)', () => {
        const { grid } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 99 },
            obstaclePool: { door_red: 99 },
            seed: 1,
            growthParams: { maxRegions: 4, branchProbability: 0, assumeBidirectional: false },
        });
        for (const region of grid.allRegions()) {
            // Every region has at most one exit (post-wallOff).
            expect(region.extracted_rules.exits.length).toBeLessThanOrEqual(1);
        }
    });

    it('adds a back-exit on each non-start region when bidirectional is on', () => {
        const { grid, startCell } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 99 },
            obstaclePool: { door_red: 99 },
            seed: 1,
            growthParams: { maxRegions: 4, branchProbability: 0, assumeBidirectional: true },
        });
        const startKey = `${startCell.gx},${startCell.gy}`;
        for (const region of grid.allRegions()) {
            const isStart = `${region.cell.gx},${region.cell.gy}` === startKey;
            const backExits = [...region.exits.values()]
                .filter((e) => e.isBackExit);
            if (isStart) {
                expect(backExits).toHaveLength(0);
            } else {
                // At least one back-exit (BFS parent). With branch
                // probability 0 there's no cross-branch asymmetry so
                // the post-pass adds nothing extra; the count is
                // exactly 1.
                expect(backExits.length).toBeGreaterThanOrEqual(1);
                // Back-exit's targetExitId points at the parent's
                // forward exit; reciprocal link is on the parent.
                expect(backExits[0].targetExitId).toBeTruthy();
            }
        }
    });

    describe('asymmetricExits post-pass', () => {
        // User's repro: 3x2 grid, quotas {maze:2, text_adventure:2},
        // start pinned to maze. Seed 1 produces a layout where the
        // start region's E forward exit gets stitched to a text-
        // adventure region built via a different BFS branch — so
        // without the post-pass that text-adventure region has no
        // back-exit to the start.
        const reproConfig = {
            gridDims: { width: 3, height: 2 },
            regionSize: { width: 8, height: 6 },
            itemPool: { key_red: 4 },
            obstaclePool: { door_red: 4 },
            seed: 1,
            growthParams: {
                substrateQuotas: { maze: 2, text_adventure: 2 },
                startSubstrate: 'maze',
                branchProbability: 0.5,
                assumeBidirectional: true,
            },
        };

        function exitPairs(grid) {
            // [{ from: regionId, to: regionId, isBackExit }, ...]
            const out = [];
            for (const region of grid.allRegions()) {
                const exits = region.exits;
                if (!exits) continue;
                for (const [, e] of exits) {
                    if (!e?.targetRegion) continue;
                    out.push({
                        from: region.region_id,
                        to: e.targetRegion,
                        isBackExit: !!e.isBackExit,
                    });
                }
            }
            return out;
        }

        it("'add' (default) inserts a reciprocal back-exit for every cross-branch one-way", () => {
            const { grid } = growMaze(reproConfig);
            const pairs = exitPairs(grid);
            // Every (A -> B) exit must have a matching (B -> A).
            for (const p of pairs) {
                const reciprocal = pairs.find(
                    (q) => q.from === p.to && q.to === p.from,
                );
                expect(reciprocal).toBeTruthy();
            }
        });

        it("'remove' drops the one-way forward exit so the asymmetry is gone", () => {
            const { grid } = growMaze({
                ...reproConfig,
                growthParams: { ...reproConfig.growthParams, asymmetricExits: 'remove' },
            });
            const pairs = exitPairs(grid);
            for (const p of pairs) {
                const reciprocal = pairs.find(
                    (q) => q.from === p.to && q.to === p.from,
                );
                expect(reciprocal).toBeTruthy();
            }
        });

        it("'add' back-exit carries side, targetExitId, and isBackExit", () => {
            const { grid } = growMaze(reproConfig);
            for (const region of grid.allRegions()) {
                for (const [, e] of region.exits) {
                    if (!e.isBackExit) continue;
                    expect(e.side).toBeTruthy();
                    expect(e.targetExitId).toBeTruthy();
                    expect(e.targetRegion).toBeTruthy();
                }
            }
        });

        it('no-op when assumeBidirectional is false', () => {
            const { grid } = growMaze({
                ...reproConfig,
                growthParams: {
                    ...reproConfig.growthParams,
                    assumeBidirectional: false,
                },
            });
            // With bidirectional off, no back-exits anywhere — including
            // the BFS parent ones — so post-pass never runs.
            for (const region of grid.allRegions()) {
                for (const [, e] of region.exits) {
                    expect(e.isBackExit).toBeFalsy();
                }
            }
        });
    });

    describe('reconcileBidirectionalExits (direct unit)', () => {
        it("'add' creates a reciprocal back-exit when only one direction exists", () => {
            // Build two regions with an asymmetric pair by hand.
            const grid = new Grid({ width: 2, height: 1 });
            const sizeXY = { width: 6, height: 6 };
            const A = {
                region_id: 'A', cell: { gx: 0, gy: 0 },
                exits: new Map([['a_to_b', {
                    exit_id: 'a_to_b',
                    x: 5, y: 3, side: 'E',
                    exitName: 'a_to_b',
                    targetRegion: 'B',
                    isBackExit: false,
                    isTeleporter: false,
                }]]),
                playable_payload: {},
                extracted_rules: { exits: [{
                    id: 'a_to_b',
                    position: { x: 5, y: 3 },
                    target_region: 'B',
                    paths: [{ path_id: 'p1', obstacles: [] }],
                }] },
                exits_placed: [],
            };
            const B = {
                region_id: 'B', cell: { gx: 1, gy: 0 },
                exits: new Map(),
                playable_payload: {},
                extracted_rules: { exits: [] },
                exits_placed: [],
            };
            grid.cells.set('0,0', A);
            grid.cells.set('1,0', B);

            reconcileBidirectionalExits(grid, sizeXY, 'add');

            const back = B.exits.get('A');
            expect(back).toBeTruthy();
            expect(back.isBackExit).toBe(true);
            expect(back.side).toBe('W');
            expect(back.targetRegion).toBe('A');
            expect(back.targetExitId).toBe('a_to_b');
            // Round-trip link on the forward exit.
            expect(A.exits.get('a_to_b').targetExitId).toBe('A');
            // extracted_rules mirrored.
            expect(B.extracted_rules.exits.find((e) => e.id === 'A')).toBeTruthy();
        });

        it("'remove' nulls the forward exit's target_region", () => {
            const grid = new Grid({ width: 2, height: 1 });
            const sizeXY = { width: 6, height: 6 };
            const A = {
                region_id: 'A', cell: { gx: 0, gy: 0 },
                exits: new Map([['a_to_b', {
                    exit_id: 'a_to_b', x: 5, y: 3, side: 'E',
                    targetRegion: 'B', isBackExit: false,
                }]]),
                playable_payload: {},
                extracted_rules: { exits: [{
                    id: 'a_to_b', position: { x: 5, y: 3 }, target_region: 'B',
                    paths: [{ path_id: 'p1', obstacles: [] }],
                }] },
                exits_placed: [],
            };
            const B = {
                region_id: 'B', cell: { gx: 1, gy: 0 },
                exits: new Map(),
                playable_payload: {},
                extracted_rules: { exits: [] },
                exits_placed: [],
            };
            grid.cells.set('0,0', A);
            grid.cells.set('1,0', B);

            reconcileBidirectionalExits(grid, sizeXY, 'remove');

            expect(A.exits.get('a_to_b').targetRegion).toBe(null);
            expect(A.extracted_rules.exits[0].target_region).toBe(null);
            expect(B.exits.size).toBe(0);
        });

        it('throws on unknown mode', () => {
            const grid = new Grid({ width: 1, height: 1 });
            expect(() => reconcileBidirectionalExits(grid, { width: 6, height: 6 }, 'flip'))
                .toThrow(/unknown mode/);
        });
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
            seed: 24,
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
            regionParams: {},
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
            regionParams: {},
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
            regionParams: {},
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
            regionParams: {},
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
            regionParams: {},
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
            regionParams: {},
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

    it('each sidecar carries grid_cell with the region\'s grid coordinates', () => {
        // grid_cell lets the Region Graph mirror the maze panel's
        // spatial layout via Cytoscape's preset layout, instead of
        // running its own force-directed pass. Per region.cell from
        // the in-memory Grid.
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        for (const region of grid.allRegions()) {
            const side = sidecars['1'][region.region_id];
            expect(side.grid_cell).toEqual({ gx: region.cell.gx, gy: region.cell.gy });
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

    it('serializeMazeWorld always includes longestShortestPath on the payload', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        for (const side of Object.values(sidecars['1'])) {
            expect(typeof side.playable_payload.longestShortestPath).toBe('number');
            expect(side.playable_payload.longestShortestPath).toBeGreaterThanOrEqual(1);
        }
    });

    it('omits manaEnabled by default (loop mode opt-in)', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        for (const side of Object.values(sidecars['1'])) {
            expect(side.playable_payload.manaEnabled).toBeUndefined();
        }
    });

    it('sets manaEnabled=true on every region payload when option is on', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid, { manaEnabled: true });
        for (const side of Object.values(sidecars['1'])) {
            expect(side.playable_payload.manaEnabled).toBe(true);
        }
    });

    it('emits fogEnabled: true by default and explicit false on opt-out', () => {
        const { grid } = smallGrid();
        // Default: fog on (substrates respect discovery settings).
        for (const side of Object.values(buildPresetSidecars(grid)['1'])) {
            expect(side.playable_payload.fogEnabled).toBe(true);
        }
        // Explicit opt-out emits the field as `false` so consumers can
        // disambiguate from "absent → default true".
        for (const side of Object.values(buildPresetSidecars(grid, { fogEnabled: false })['1'])) {
            expect(side.playable_payload.fogEnabled).toBe(false);
        }
    });

    it('decouples fogEnabled from manaEnabled', () => {
        const { grid } = smallGrid();
        // Mana on, fog explicitly off (debugging combo).
        for (const side of Object.values(
            buildPresetSidecars(grid, { manaEnabled: true, fogEnabled: false })['1'],
        )) {
            expect(side.playable_payload.manaEnabled).toBe(true);
            expect(side.playable_payload.fogEnabled).toBe(false);
        }
        // Mana off, fog on (the new default — but still fine to pass explicitly).
        for (const side of Object.values(
            buildPresetSidecars(grid, { manaEnabled: false, fogEnabled: true })['1'],
        )) {
            expect(side.playable_payload.manaEnabled).toBeUndefined();
            expect(side.playable_payload.fogEnabled).toBe(true);
        }
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

    it('omits hazards field when world.hazards is absent (no-hazard regions)', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        for (const side of Object.values(sidecars['1'])) {
            expect(side.playable_payload.hazards).toBeUndefined();
        }
    });

    it('serializes hazards on world.hazards into the sidecar (strip-progress)', () => {
        const { grid } = smallGrid();
        // Stamp a fake hazard onto one region's playable_payload to
        // simulate what applyHazardModule does during generation.
        const region = grid.allRegions()[0];
        region.playable_payload.hazards = [{
            shape: 'linear',
            length: 3,
            tiles: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
            cycleLength: 4,
            phase: 2, // intentionally non-zero; serializer strips it
        }];
        const sidecars = buildPresetSidecars(grid);
        const payload = sidecars['1'][region.region_id].playable_payload;
        expect(payload.hazards).toEqual([{
            shape: 'linear',
            length: 3,
            tiles: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
            cycleLength: 4,
        }]);
        // Phase must NOT be in the sidecar (runtime-only field).
        expect(payload.hazards[0].phase).toBeUndefined();
    });

    it('deserializeMazeWorld initializes hazard phases to 0 on load', () => {
        const { grid } = smallGrid();
        const region = grid.allRegions()[0];
        region.playable_payload.hazards = [{
            shape: 'loop',
            length: 4,
            tiles: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }],
            cycleLength: 4,
        }];
        const sidecars = buildPresetSidecars(grid);
        const sidecar = sidecars['1'][region.region_id].playable_payload;
        const restored = deserializeMazeWorld(sidecar);
        expect(restored.hazards).toHaveLength(1);
        expect(restored.hazards[0]).toEqual({
            shape: 'loop',
            length: 4,
            tiles: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 1, y: 2 }],
            cycleLength: 4,
            phase: 0,
        });
    });

    it('deserializeMazeWorld leaves world.hazards undefined when sidecar has none', () => {
        const { grid } = smallGrid();
        const sidecars = buildPresetSidecars(grid);
        const sidecar = Object.values(sidecars['1'])[0].playable_payload;
        const restored = deserializeMazeWorld(sidecar);
        expect(restored.hazards).toBeUndefined();
    });

    it('growMaze places hazards on regions when hazardOpts.enabled is true', () => {
        // A modest grid + plentiful pool to give the maze room for
        // hazards. count=3 per region, plenty of fail-budget.
        const result = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 8, height: 6 },
            itemPool: { key_red: 4 },
            obstaclePool: { door_red: 4 },
            seed: 7,
            hazardOpts: {
                enabled: true,
                count: 3,
                maxConsecutiveFails: 20,
                wallOverlapAllowed: false,
            },
        });
        let regionsWithHazards = 0;
        for (const region of result.grid.allRegions()) {
            const h = region.playable_payload.hazards;
            if (Array.isArray(h) && h.length > 0) {
                regionsWithHazards++;
                for (const hz of h) {
                    expect(hz.phase).toBe(0);
                    expect(Array.isArray(hz.tiles)).toBe(true);
                    expect(hz.tiles.length).toBeGreaterThanOrEqual(2);
                }
            }
        }
        // At least one region should have hazards on a non-trivial grid.
        expect(regionsWithHazards).toBeGreaterThan(0);
    });

    it('growMaze without hazardOpts produces no hazards (default)', () => {
        const result = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 3 },
            obstaclePool: { door_red: 3 },
            seed: 11,
        });
        for (const region of result.grid.allRegions()) {
            expect(region.playable_payload.hazards).toBeUndefined();
        }
    });

    it('growMaze never places hazards on entrance / exit / location tiles', () => {
        // Modest grid + plentiful pool + larger region size to give
        // hazards room to land far from the anchor tiles. Cycle
        // through several seeds to catch any chance overlap that a
        // single run would miss.
        for (const seed of [3, 11, 19, 23, 31, 41]) {
            const result = growMaze({
                gridDims: { width: 3, height: 3 },
                regionSize: { width: 8, height: 6 },
                itemPool: { key_red: 6 },
                obstaclePool: { door_red: 6 },
                seed,
                hazardOpts: {
                    enabled: true,
                    count: 4,
                    maxConsecutiveFails: 30,
                },
            });
            for (const region of result.grid.allRegions()) {
                const w = region.playable_payload;
                if (!Array.isArray(w.hazards) || w.hazards.length === 0) continue;
                const reserved = new Set();
                reserved.add(`${w.entrance.x},${w.entrance.y}`);
                for (const exit of w.exits.values()) {
                    reserved.add(`${exit.x},${exit.y}`);
                }
                for (const key of w.items.keys()) {
                    reserved.add(key);
                }
                for (const h of w.hazards) {
                    for (const t of h.tiles) {
                        const k = `${t.x},${t.y}`;
                        if (reserved.has(k)) {
                            throw new Error(
                                `Hazard tile ${k} overlaps anchor (entrance / exit / location) in region ${region.region_id} (seed ${seed})`,
                            );
                        }
                    }
                }
            }
        }
    });

    it('growMaze with hazardOpts.enabled=false produces no hazards', () => {
        const result = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 3 },
            obstaclePool: { door_red: 3 },
            seed: 11,
            hazardOpts: { enabled: false, count: 5 },
        });
        for (const region of result.grid.allRegions()) {
            expect(region.playable_payload.hazards).toBeUndefined();
        }
    });

    it('serializes only itemLib entries that are not in the base library', () => {
        // Construct a world where we manually add a foreign-item
        // entry to itemLib (mirrors what the top-down driver will
        // do when consuming a rules.json that uses items the maze
        // doesn't know about). The base-library entries must not
        // be re-emitted; the foreign one must travel.
        const { grid } = smallGrid();
        const region = grid.allRegions()[0];
        region.playable_payload.itemLib = {
            ...region.playable_payload.itemLib,
            ancient_compass: {
                id: 'ancient_compass',
                name: 'Ancient Compass',
                color: '#cc8866',
                symbol: 'compass',
                classification: 'progression',
            },
        };
        const sidecars = buildPresetSidecars(grid);
        const sidecar = sidecars['1'][region.region_id].playable_payload;
        // Standard items don't redundantly appear.
        expect(sidecar.itemLib.key_red).toBeUndefined();
        // The foreign one survived.
        expect(sidecar.itemLib.ancient_compass).toEqual({
            id: 'ancient_compass',
            name: 'Ancient Compass',
            color: '#cc8866',
            symbol: 'compass',
            classification: 'progression',
        });
        // Round-trips through deserialize back into the world's itemLib.
        const restored = deserializeMazeWorld(sidecar);
        expect(restored.itemLib.ancient_compass).toBeDefined();
        expect(restored.itemLib.key_red).toBeDefined(); // base library still merged in
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
            regionParams: {},
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

    it('emits assume_bidirectional_exits=true at the top level', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        expect(out.assume_bidirectional_exits).toBe(true);
    });

    it('omits procgen_metadata when the caller does not supply it', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        expect(out).not.toHaveProperty('procgen_metadata');
    });

    it('omits loop_costs by default (loop mode is opt-in)', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell });
        expect(out).not.toHaveProperty('loop_costs');
    });

    it('embeds loop_costs when enableLoopMode is true', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, { startCell, enableLoopMode: true });
        expect(out).toHaveProperty('loop_costs');
        expect(out.loop_costs.regions).toBeDefined();
        expect(out.loop_costs.locations).toBeDefined();
        // Start region (Menu) is always free
        expect(out.loop_costs.regions.Menu).toEqual({ moveCost: 0, xpEffect: 'cost' });
        // Default regionXpEffect is 'cost' and is also recorded at the
        // sidecar root for fallback.
        expect(out.loop_costs.defaultRegionXpEffect).toBe('cost');
        // Pipeline records the seed_name as the source
        expect(out.loop_costs.generatedFrom).toBeTruthy();
    });

    it('skips loop_costs when sphere log embedding is disabled', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, {
            startCell,
            enableLoopMode: true,
            embedSphereLog: false,
        });
        expect(out).not.toHaveProperty('loop_costs');
    });

    it('emits procgen_metadata with caller fields plus auto-derived region_count and grid_dims', () => {
        const { grid, startCell, stats } = smallGrid();
        const out = buildRulesJson(grid, {
            startCell,
            procgenMetadata: {
                driver: 'grid-growth',
                stop_reason: stats.stopReason,
            },
        });
        expect(out.procgen_metadata).toBeDefined();
        expect(out.procgen_metadata.driver).toBe('grid-growth');
        expect(out.procgen_metadata.stop_reason).toBe(stats.stopReason);
        // Auto-derived from the grid: region_count matches allRegions
        // length, grid_dims is max gx+1 by max gy+1 over occupied cells.
        const allRegions = [...grid.allRegions()];
        expect(out.procgen_metadata.region_count).toBe(allRegions.length);
        let maxGx = -1, maxGy = -1;
        for (const r of allRegions) {
            if (r.cell.gx > maxGx) maxGx = r.cell.gx;
            if (r.cell.gy > maxGy) maxGy = r.cell.gy;
        }
        expect(out.procgen_metadata.grid_dims).toEqual({
            width: maxGx + 1,
            height: maxGy + 1,
        });
    });

    it('passes through caller-supplied source_game and source_counts (top-down shape)', () => {
        const { grid, startCell } = smallGrid();
        const out = buildRulesJson(grid, {
            startCell,
            procgenMetadata: {
                driver: 'top-down',
                source_game: 'Adventure',
                source_counts: { regions: 6, locations: 25, exits: 17, logic_gates: 12 },
                stop_reason: 'all_placed',
            },
        });
        expect(out.procgen_metadata.driver).toBe('top-down');
        expect(out.procgen_metadata.source_game).toBe('Adventure');
        expect(out.procgen_metadata.source_counts).toEqual({
            regions: 6, locations: 25, exits: 17, logic_gates: 12,
        });
        expect(out.procgen_metadata.stop_reason).toBe('all_placed');
    });

    it('back-exits inherit their forward exit access_rule', () => {
        // Build a grid with key_red gates on every region — that
        // forces non-trivial forward rules. Without inheritance, the
        // back-exits would compile to True_ and let the player
        // re-enter A from B without re-satisfying the gate.
        const { grid, startCell } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 4 },
            obstaclePool: { door_red: 4 },
            seed: 3,
            regionParams: {},
            growthParams: { branchProbability: 0, assumeBidirectional: true },
        });
        const out = buildRulesJson(grid, { startCell });

        let inheritedPairs = 0;
        for (const region of grid.allRegions()) {
            for (const [exitId, worldExit] of region.exits) {
                if (!worldExit.isBackExit) continue;
                const compiledRegion = out.regions['1'][region.region_id];
                const compiledBack = compiledRegion.exits.find((e) => e.name === exitId);
                expect(compiledBack).toBeDefined();
                // Find the paired forward exit's compiled rule.
                const targetCompiled = out.regions['1'][worldExit.targetRegion];
                const compiledFwd = targetCompiled?.exits.find(
                    (e) => e.name === worldExit.targetExitId,
                );
                if (!compiledFwd) continue;
                expect(compiledBack.access_rule).toEqual(compiledFwd.access_rule);
                inheritedPairs += 1;
            }
        }
        // There should have been at least one bidirectional pair.
        expect(inheritedPairs).toBeGreaterThan(0);
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

describe('computeSourceCounts', () => {
    it('counts regions, locations, exits, and non-trivial logic gates', () => {
        const rulesJson = {
            start_regions: { '1': { default: ['Menu'] } },
            regions: {
                '1': {
                    Menu: {
                        name: 'Menu',
                        exits: [{ name: 'GameStart', connected_region: 'Overworld', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    Overworld: {
                        name: 'Overworld',
                        exits: [
                            { name: 'east', connected_region: 'Cave', access_rule: { rule: 'Has', args: { item_name: 'key_red' } } },
                            { name: 'west', connected_region: 'Castle', access_rule: { rule: 'True_' } },
                        ],
                        locations: [
                            { name: 'Slay Yorgle', access_rule: { rule: 'True_' } },
                            { name: 'Bridge Key' /* no access_rule */ },
                            { name: 'Hidden', access_rule: { rule: 'Has', args: { item_name: 'key_red' } } },
                        ],
                    },
                    Cave: {
                        name: 'Cave',
                        exits: [{ name: 'back', connected_region: 'Overworld', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    Castle: {
                        name: 'Castle',
                        exits: [],
                        locations: [{ name: 'Throne', access_rule: { rule: 'HasAll', args: { items: ['a', 'b'] } } }],
                    },
                },
            },
        };
        const counts = computeSourceCounts(rulesJson, '1');
        // Menu is excluded — 3 source regions remain.
        expect(counts.regions).toBe(3);
        // Overworld has 2 exits + Cave has 1 = 3.
        expect(counts.exits).toBe(3);
        // Overworld has 3 locations + Castle has 1 = 4.
        expect(counts.locations).toBe(4);
        // Non-trivial: Overworld.east, Overworld.Hidden, Castle.Throne = 3.
        // Locations without an access_rule and rules that are True_
        // don't count.
        expect(counts.logic_gates).toBe(3);
    });

    it('returns zeroed counts when the player has no regions', () => {
        const counts = computeSourceCounts({ regions: { '1': {} } }, '1');
        expect(counts).toEqual({ regions: 0, locations: 0, exits: 0, logic_gates: 0 });
    });

    it('skips Menu only when start_regions points at it', () => {
        // No start_regions field → Menu region (if present) is just
        // another region, counted normally.
        const rulesJson = {
            regions: {
                '1': {
                    Menu: { name: 'Menu', exits: [], locations: [{ name: 'L' }] },
                },
            },
        };
        const counts = computeSourceCounts(rulesJson, '1');
        expect(counts.regions).toBe(1);
        expect(counts.locations).toBe(1);
    });
});

describe('topDownFromRulesJson', () => {
    // Build a small grid-growth output we can re-feed through top-down.
    function makeGridGrowthRulesJson() {
        const { grid, startCell } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 7,
            growthParams: { branchProbability: 0.5, assumeBidirectional: true },
        });
        return buildRulesJson(grid, { startCell });
    }

    it('rejects an empty rules.json', () => {
        expect(() => topDownFromRulesJson(null)).toThrow();
        expect(() => topDownFromRulesJson({})).toThrow(/regions/);
    });

    it('builds a region per non-Menu source region', () => {
        const rulesJson = makeGridGrowthRulesJson();
        const sourceCount = Object.keys(rulesJson.regions['1']).length;
        // Source has Menu + N realised regions; top-down skips Menu.
        const expectedRealised = sourceCount - 1;
        const { grid } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 5, height: 5 }, seed: 1,
        });
        expect(grid.allRegions().length).toBe(expectedRealised);
    });

    it('places the BFS-resolved actual start at the grid center', () => {
        const rulesJson = makeGridGrowthRulesJson();
        const expectedStart = rulesJson.regions['1'].Menu.exits[0].connected_region;
        const { grid, startCell } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 5, height: 5 }, seed: 1,
        });
        expect(startCell).toEqual({ gx: 2, gy: 2 });
        expect(grid.getRegion(startCell).region_id).toBe(expectedStart);
    });

    it('round-trips region/exit topology from a grid-growth rules.json', () => {
        const rulesJson = makeGridGrowthRulesJson();
        const { grid, startCell } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 5, height: 5 }, seed: 1,
        });
        const out = buildRulesJson(grid, { startCell });

        const sourceRegions = rulesJson.regions['1'];
        const outRegions = out.regions['1'];
        // Same region names — Menu in both.
        expect(new Set(Object.keys(outRegions))).toEqual(new Set(Object.keys(sourceRegions)));
        // Each non-Menu region has the same exit connectivity.
        for (const [name, src] of Object.entries(sourceRegions)) {
            if (name === 'Menu') continue;
            const dst = outRegions[name];
            expect(dst).toBeDefined();
            // Source forward exits all show up on the round-tripped
            // region with the same connected_region.
            for (const srcExit of src.exits ?? []) {
                const matched = dst.exits.find((e) => e.name === srcExit.name);
                expect(matched).toBeDefined();
                expect(matched.connected_region).toBe(srcExit.connected_region);
            }
        }
    });

    it('preserves the per-region item placements (count and identity)', () => {
        // Round-trip preserves which items live in which regions, but
        // not exact compiled access rules — placeFromRules picks a
        // random reachable tile for each gated location, and the
        // resulting random gate position can cross paths to other
        // locations (extractPathsAndObstacles BFS doesn't know about
        // rule-typed cut vertices). That's a substrate-side limitation
        // documented for v1; round-trip checks structure only.
        const rulesJson = makeGridGrowthRulesJson();
        const { grid, startCell } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 5, height: 5 }, seed: 1,
        });
        const out = buildRulesJson(grid, { startCell });

        const sourceRegions = rulesJson.regions['1'];
        const outRegions = out.regions['1'];
        const itemCount = (region) => {
            const counts = {};
            for (const loc of region.locations ?? []) {
                const item = loc.item?.name;
                if (!item) continue;
                counts[item] = (counts[item] ?? 0) + 1;
            }
            return counts;
        };
        for (const [name, src] of Object.entries(sourceRegions)) {
            if (name === 'Menu') continue;
            const dst = outRegions[name];
            expect(itemCount(dst)).toEqual(itemCount(src));
        }
    });

    it('emits assume_bidirectional_exits=true on the output (default)', () => {
        const rulesJson = makeGridGrowthRulesJson();
        const { grid, startCell } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 5, height: 5 }, seed: 1,
        });
        const out = buildRulesJson(grid, { startCell });
        expect(out.assume_bidirectional_exits).toBe(true);
    });

    it('places teleporters when the layout cannot fit a region adjacently', () => {
        // Synthetic: a region with 5 outgoing edges to distinct targets,
        // forcing the layout to use teleporters once 4 sides are taken.
        const rulesJson = {
            schema_version: 3,
            assume_bidirectional_exits: true,
            regions: {
                '1': {
                    Menu: {
                        name: 'Menu',
                        exits: [{ name: 'GameStart', connected_region: 'hub', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    hub: {
                        name: 'hub',
                        exits: [
                            { name: 'to_a', connected_region: 'a', access_rule: { rule: 'True_' } },
                            { name: 'to_b', connected_region: 'b', access_rule: { rule: 'True_' } },
                            { name: 'to_c', connected_region: 'c', access_rule: { rule: 'True_' } },
                            { name: 'to_d', connected_region: 'd', access_rule: { rule: 'True_' } },
                            { name: 'to_e', connected_region: 'e', access_rule: { rule: 'True_' } },
                        ],
                        locations: [],
                    },
                    a: { name: 'a', exits: [], locations: [] },
                    b: { name: 'b', exits: [], locations: [] },
                    c: { name: 'c', exits: [], locations: [] },
                    d: { name: 'd', exits: [], locations: [] },
                    e: { name: 'e', exits: [], locations: [] },
                },
            },
            start_regions: { '1': { default: ['Menu'] } },
        };
        const { grid, stats } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 7, height: 7 }, seed: 1,
        });
        // hub has 4 sides → at least one of {a..e} must teleport.
        expect(stats.teleportersPlaced).toBeGreaterThan(0);
        // All 6 regions placed.
        expect(grid.allRegions().length).toBe(6);
    });

    it('reports stopReason=all_placed when every non-Menu region is realised', () => {
        // Regression: regionsTotal used to count Menu, so the
        // BFS-stripped result with regionsBuilt = N-1 would always
        // mis-report partial_layout even when every realised region
        // was placed.
        const rulesJson = makeGridGrowthRulesJson();
        const { stats } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 5, height: 5 }, seed: 1,
        });
        expect(stats.stopReason).toBe('all_placed');
        expect(stats.regionsBuilt).toBe(stats.regionsTotal);
    });

    it('preserves all locations in dense regions (regression)', () => {
        // Regression: placeFromRules used to `break` the location-rules
        // loop on a single tile-pick failure, silently dropping every
        // remaining location. Combined with too-aggressive mazegen
        // walling, dense source regions (e.g. Adventure's Overworld
        // with 11 locations in a 6×6) lost most of their locations on
        // round-trip. Top-down now defaults to maxIterations=0 (open
        // rooms) so locations have somewhere to land, and the loop
        // continues past tile-pick failures rather than breaking.
        const rulesJson = {
            schema_version: 3,
            assume_bidirectional_exits: true,
            regions: {
                '1': {
                    Menu: {
                        name: 'Menu',
                        exits: [{ name: 'GameStart', connected_region: 'big', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    big: {
                        name: 'big',
                        exits: [],
                        locations: Array.from({ length: 11 }, (_, i) => ({
                            name: `loc_${i}`,
                            id: 100 + i,
                            access_rule: i === 5
                                ? { rule: 'Has', args: { item_name: 'Yellow Key' } }
                                : { rule: 'True_' },
                            item: { name: `Item${i}`, player: 1, advancement: false, type: 'filler' },
                        })),
                    },
                },
            },
            start_regions: { '1': { default: ['Menu'] } },
        };
        const { grid, startCell } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 3, height: 3 }, seed: 1,
        });
        const out = buildRulesJson(grid, { startCell, seed: 1, assumeBidirectional: true });
        const dstBig = out.regions['1'].big;
        expect(dstBig.locations.length).toBe(11);
        const itemNames = dstBig.locations.map((l) => l.item?.name).sort();
        const srcItemNames = Array.from({ length: 11 }, (_, i) => `Item${i}`).sort();
        expect(itemNames).toEqual(srcItemNames);
    });

    it('lines up BFS-tree-edge exit tiles across the shared wall', () => {
        // For each BFS-tree edge A→B, A's exit tile and B's reverse
        // exit tile sit on opposite sides of the same wall AT THE
        // SAME POSITION ALONG THE WALL (same y for E↔W pairs, same
        // x for N↔S pairs). The driver pins B's reverse to the
        // entrance tile, which is the mirror of A's exit position;
        // the substrate honors the pin via spec.tile.
        const rulesJson = {
            schema_version: 3,
            assume_bidirectional_exits: true,
            regions: {
                '1': {
                    Menu: {
                        name: 'Menu',
                        exits: [{ name: 'GameStart', connected_region: 'A', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    A: {
                        name: 'A',
                        exits: [
                            { name: 'A_to_B', connected_region: 'B', access_rule: { rule: 'True_' } },
                            { name: 'A_to_C', connected_region: 'C', access_rule: { rule: 'True_' } },
                        ],
                        locations: [],
                    },
                    B: {
                        name: 'B',
                        exits: [{ name: 'B_to_A', connected_region: 'A', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    C: {
                        name: 'C',
                        exits: [{ name: 'C_to_A', connected_region: 'A', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                },
            },
            start_regions: { '1': { default: ['Menu'] } },
        };
        const { grid } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 3, height: 3 }, seed: 1,
        });
        const A = grid.allRegions().find((r) => r.region_id === 'A');
        const B = grid.allRegions().find((r) => r.region_id === 'B');
        const C = grid.allRegions().find((r) => r.region_id === 'C');
        const aToB = A.exits.get('A_to_B');
        const bToA = B.exits.get('B_to_A');
        const aToC = A.exits.get('A_to_C');
        const cToA = C.exits.get('C_to_A');
        // Sides are opposite (one of E↔W or N↔S).
        const opposite = { N: 'S', S: 'N', E: 'W', W: 'E' };
        expect(bToA.side).toBe(opposite[aToB.side]);
        expect(cToA.side).toBe(opposite[aToC.side]);
        // Same coordinate along the wall.
        if (aToB.side === 'E' || aToB.side === 'W') {
            expect(bToA.y).toBe(aToB.y);
        } else {
            expect(bToA.x).toBe(aToB.x);
        }
        if (aToC.side === 'E' || aToC.side === 'W') {
            expect(cToA.y).toBe(aToC.y);
        } else {
            expect(cToA.x).toBe(aToC.x);
        }
    });

    it('links each exit to its reverse exit via targetExitId', () => {
        // Without targetExitId, all arrivals fall back to a single
        // world.entrance, so the player always spawns at the BFS-
        // parent-mirrored tile regardless of which exit they crossed.
        // Linking lets the maze panel spawn on the matching reverse
        // exit's tile (per top-down-driver.md §4 + §7).
        const rulesJson = {
            schema_version: 3,
            assume_bidirectional_exits: true,
            regions: {
                '1': {
                    Menu: {
                        name: 'Menu',
                        exits: [{ name: 'GameStart', connected_region: 'A', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    A: {
                        name: 'A',
                        exits: [
                            { name: 'A_to_B', connected_region: 'B', access_rule: { rule: 'True_' } },
                            { name: 'A_to_C', connected_region: 'C', access_rule: { rule: 'True_' } },
                        ],
                        locations: [],
                    },
                    B: {
                        name: 'B',
                        exits: [{ name: 'B_to_A', connected_region: 'A', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    C: {
                        name: 'C',
                        exits: [{ name: 'C_to_A', connected_region: 'A', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                },
            },
            start_regions: { '1': { default: ['Menu'] } },
        };
        const { grid } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 3, height: 3 }, seed: 1,
        });
        const A = grid.allRegions().find((r) => r.region_id === 'A');
        const B = grid.allRegions().find((r) => r.region_id === 'B');
        const C = grid.allRegions().find((r) => r.region_id === 'C');
        expect(A.exits.get('A_to_B').targetExitId).toBe('B_to_A');
        expect(A.exits.get('A_to_C').targetExitId).toBe('C_to_A');
        expect(B.exits.get('B_to_A').targetExitId).toBe('A_to_B');
        expect(C.exits.get('C_to_A').targetExitId).toBe('A_to_C');
        // For non-start regions, world.entrance overlaps with the
        // BFS-parent's reverse exit tile so it renders as exit (per
        // §5) and there's no orphan green border on a leftover tile.
        const bExit = B.exits.get('B_to_A');
        expect(B.entrance).toEqual({ x: bExit.x, y: bExit.y });
        const cExit = C.exits.get('C_to_A');
        expect(C.entrance).toEqual({ x: cExit.x, y: cExit.y });
    });

    it('uses the source location name verbatim as the round-tripped location name', () => {
        // Round-trip emits location names exactly as they appeared
        // in the source (e.g. "Slay Yorgle"), not the prior
        // Region__id__x_y mangling. Source AP location names are
        // unique within a player so the prefix isn't needed; the
        // verbatim name lets save files / sphere logs / external
        // tooling correlate round-tripped locations with their
        // sources.
        const rulesJson = {
            schema_version: 3,
            assume_bidirectional_exits: true,
            regions: {
                '1': {
                    Menu: {
                        name: 'Menu',
                        exits: [{ name: 'GameStart', connected_region: 'r1', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    r1: {
                        name: 'r1',
                        exits: [],
                        locations: [
                            { name: 'Slay Yorgle', id: 1, access_rule: { rule: 'True_' },
                              item: { name: 'Trophy', player: 1, advancement: false, type: 'filler' } },
                        ],
                    },
                },
            },
            start_regions: { '1': { default: ['Menu'] } },
        };
        const { grid, startCell } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 3, height: 3 }, seed: 1,
        });
        const out = buildRulesJson(grid, { startCell, seed: 1, assumeBidirectional: true });
        const loc = out.regions['1'].r1.locations[0];
        expect(loc.name).toBe('Slay Yorgle');
        // Sidecar's per-tile locationName matches the regions block.
        const sidecar = out.preset_sidecars['1'].r1.playable_payload;
        const item = sidecar.items.find((i) => i.locationName);
        expect(item?.locationName).toBe('Slay Yorgle');
    });

    it('preserves source location names and access rules in the output', () => {
        // Regression: extracted_rules used to derive both location ids
        // (`${itemId}_pickup`) and access rules (BFS-walked from
        // entrance) from the maze geometry. That collapsed multi-
        // instance items (Adventure has 12 Freeincarnates) under one
        // logical name, AND polluted location rules whenever a gate
        // placed for one location landed on another's BFS path. Top-
        // down now overrides both with the source data.
        const rulesJson = {
            schema_version: 3,
            assume_bidirectional_exits: true,
            regions: {
                '1': {
                    Menu: {
                        name: 'Menu',
                        exits: [{ name: 'GameStart', connected_region: 'r1', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    r1: {
                        name: 'r1',
                        exits: [],
                        locations: [
                            // Two locations sharing the same item name
                            // — round-trip must keep them distinct.
                            { name: 'Junk Pile A', id: 1, access_rule: { rule: 'True_' },
                              item: { name: 'Coin', player: 1, advancement: false, type: 'filler' } },
                            { name: 'Junk Pile B', id: 2, access_rule: { rule: 'True_' },
                              item: { name: 'Coin', player: 1, advancement: false, type: 'filler' } },
                            // A location with a real rule — must
                            // round-trip with that exact rule.
                            { name: 'Boss Drop', id: 3,
                              access_rule: { rule: 'HasAll', args: { items: ['Sword', 'Key'] } },
                              item: { name: 'Trophy', player: 1, advancement: true, type: 'progression' } },
                        ],
                    },
                },
            },
            start_regions: { '1': { default: ['Menu'] } },
        };
        const { grid, startCell } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 3, height: 3 }, seed: 1,
        });
        const out = buildRulesJson(grid, { startCell, seed: 1, assumeBidirectional: true });
        const locs = out.regions['1'].r1.locations;
        // All three source locations present and distinguishable.
        const namesContaining = (substr) => locs.filter((l) => l.name.includes(substr)).length;
        expect(namesContaining('Junk Pile A')).toBe(1);
        expect(namesContaining('Junk Pile B')).toBe(1);
        expect(namesContaining('Boss Drop')).toBe(1);
        // Boss Drop's rule is the exact source rule, not a BFS-derived
        // approximation that could pick up other gates.
        const bossDrop = locs.find((l) => l.name.includes('Boss Drop'));
        expect(bossDrop.access_rule).toEqual({
            rule: 'HasAll',
            args: { items: ['Sword', 'Key'] },
        });
        // Junk Piles keep their True_ rules — even though Boss Drop's
        // gate was placed in the same region, the path to a Junk Pile
        // doesn't accidentally inherit it.
        for (const name of ['Junk Pile A', 'Junk Pile B']) {
            const loc = locs.find((l) => l.name.includes(name));
            expect(loc.access_rule).toEqual({ rule: 'True_' });
        }
    });

    it('places no exits or entrances on corner tiles', () => {
        // Corner placement makes it visually ambiguous which side the
        // exit/entrance belongs to (a corner tile is on two walls at
        // once). Substrate's clockwise wall assignment skips corners;
        // the entrance is mirrored from the parent's exit so it
        // inherits non-corner-ness too. Use a multi-exit hub to
        // exercise the clockwise walk across multiple sides.
        const rulesJson = {
            schema_version: 3,
            assume_bidirectional_exits: true,
            regions: {
                '1': {
                    Menu: {
                        name: 'Menu',
                        exits: [{ name: 'GameStart', connected_region: 'hub', access_rule: { rule: 'True_' } }],
                        locations: [],
                    },
                    hub: {
                        name: 'hub',
                        exits: [
                            { name: 'to_a', connected_region: 'a', access_rule: { rule: 'True_' } },
                            { name: 'to_b', connected_region: 'b', access_rule: { rule: 'True_' } },
                            { name: 'to_c', connected_region: 'c', access_rule: { rule: 'True_' } },
                        ],
                        locations: [],
                    },
                    a: { name: 'a', exits: [], locations: [] },
                    b: { name: 'b', exits: [], locations: [] },
                    c: { name: 'c', exits: [], locations: [] },
                },
            },
            start_regions: { '1': { default: ['Menu'] } },
        };
        const { grid } = topDownFromRulesJson(rulesJson, {
            gridDims: { width: 5, height: 5 }, seed: 1,
        });
        for (const region of grid.allRegions()) {
            const w = region.playable_payload.width;
            const h = region.playable_payload.height;
            const isCorner = (x, y) =>
                (x === 0 || x === w - 1) && (y === 0 || y === h - 1);
            const ent = region.entrance;
            expect(isCorner(ent.x, ent.y)).toBe(false);
            for (const e of region.exits_placed ?? []) {
                expect(isCorner(e.tile_position.x, e.tile_position.y)).toBe(false);
            }
        }
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
            regionParams: {},
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

describe('rollSubstrateMix', () => {
    it('returns the only id when one weight is positive', () => {
        const rng = createRng(42);
        for (let i = 0; i < 50; i++) {
            expect(rollSubstrateMix({ maze: 1, text_adventure: 0 }, rng)).toBe('maze');
        }
    });

    it('falls back to maze on empty mix', () => {
        const rng = createRng(1);
        expect(rollSubstrateMix({}, rng)).toBe('maze');
    });

    it('falls back to maze when every weight is zero', () => {
        const rng = createRng(1);
        expect(rollSubstrateMix({ maze: 0, text_adventure: 0 }, rng)).toBe('maze');
    });

    it('approximates declared weights over many rolls', () => {
        const rng = createRng(7);
        const counts = { maze: 0, text_adventure: 0 };
        const N = 1000;
        for (let i = 0; i < N; i++) {
            counts[rollSubstrateMix({ maze: 3, text_adventure: 1 }, rng)]++;
        }
        // 3:1 weights → expect ~75/25. Wide tolerance for a 1000-trial sample.
        expect(counts.maze / N).toBeGreaterThan(0.65);
        expect(counts.maze / N).toBeLessThan(0.85);
        expect(counts.text_adventure / N).toBeGreaterThan(0.15);
        expect(counts.text_adventure / N).toBeLessThan(0.35);
    });

    it('is deterministic for a fixed seed', () => {
        const seq = (seed) => {
            const rng = createRng(seed);
            return Array.from({ length: 20 }, () =>
                rollSubstrateMix({ maze: 1, text_adventure: 1 }, rng));
        };
        expect(seq(7)).toEqual(seq(7));
    });
});

describe('pickSubstrate', () => {
    const rng = createRng(1);

    it('honors substrateByRegion before everything else', () => {
        expect(pickSubstrate('Overworld',
            { substrate: 'text_adventure' }, // source tag would lose
            { substrateByRegion: { Overworld: 'maze' } },
            rng,
        )).toBe('maze');
    });

    it('reads source-region substrate tag when no caller override', () => {
        expect(pickSubstrate('Overworld',
            { substrate: 'text_adventure' },
            {},
            rng,
        )).toBe('text_adventure');
    });

    it('falls through to substratePicker when source has no tag', () => {
        const picker = (regionName) => regionName === 'Cave' ? 'text_adventure' : 'maze';
        expect(pickSubstrate('Cave', null, { substratePicker: picker }, rng))
            .toBe('text_adventure');
        expect(pickSubstrate('Other', null, { substratePicker: picker }, rng))
            .toBe('maze');
    });

    it('falls through to substrateMix when no picker', () => {
        // Single-id mix → deterministic.
        expect(pickSubstrate('Cave', null, { substrateMix: { text_adventure: 1 } }, rng))
            .toBe('text_adventure');
    });

    it('defaults to maze when nothing else resolves', () => {
        expect(pickSubstrate('Cave', null, {}, rng)).toBe('maze');
    });

    it('source tag wins over picker / mix when no caller override', () => {
        expect(pickSubstrate('Overworld',
            { substrate: 'text_adventure' },
            { substrateMix: { maze: 1 }, substratePicker: () => 'maze' },
            rng,
        )).toBe('text_adventure');
    });

    it('substrateQuotas takes priority over substrateMix', () => {
        // Quotas with capacity should be used; mix is ignored.
        expect(pickSubstrate('R1', null, {
            substrateQuotas: { text_adventure: 1 },
            substrateCounts: {},
            substrateMix: { maze: 1 },
        }, rng)).toBe('text_adventure');
    });

    it('substrateQuotas falls through to mix when all quotas exhausted', () => {
        expect(pickSubstrate('R1', null, {
            substrateQuotas: { text_adventure: 1 },
            substrateCounts: { text_adventure: 1 },
            substrateMix: { maze: 1 },
        }, rng)).toBe('maze');
    });
});

describe('pickSubstrateWithQuota', () => {
    it('returns null when every quota is filled', () => {
        const rng = createRng(1);
        expect(pickSubstrateWithQuota({ maze: 2 }, { maze: 2 }, rng)).toBe(null);
        expect(pickSubstrateWithQuota({ maze: 2, text_adventure: 1 },
            { maze: 2, text_adventure: 1 }, rng)).toBe(null);
    });

    it('returns null when quotas dict is empty', () => {
        const rng = createRng(1);
        expect(pickSubstrateWithQuota({}, {}, rng)).toBe(null);
    });

    it('returns the only substrate with remaining capacity', () => {
        const rng = createRng(1);
        // maze is full, text_adventure still has room.
        for (let i = 0; i < 20; i++) {
            expect(pickSubstrateWithQuota(
                { maze: 1, text_adventure: 5 },
                { maze: 1, text_adventure: 0 },
                rng,
            )).toBe('text_adventure');
        }
    });

    it('approximates remaining-capacity weighting over many rolls', () => {
        const rng = createRng(7);
        // Remaining capacity: maze=3, text_adventure=1 → ~75/25.
        const counts = { maze: 0, text_adventure: 0 };
        const N = 1000;
        for (let i = 0; i < N; i++) {
            const picked = pickSubstrateWithQuota(
                { maze: 3, text_adventure: 1 },
                { maze: 0, text_adventure: 0 },
                rng,
            );
            counts[picked]++;
        }
        expect(counts.maze / N).toBeGreaterThan(0.65);
        expect(counts.maze / N).toBeLessThan(0.85);
    });

    it('is deterministic for a fixed seed', () => {
        const seq = (seed) => {
            const rng = createRng(seed);
            return Array.from({ length: 20 }, () =>
                pickSubstrateWithQuota(
                    { maze: 5, text_adventure: 5 },
                    {},
                    rng,
                ));
        };
        expect(seq(3)).toEqual(seq(3));
    });
});

describe('totalRemainingQuota', () => {
    it('sums positive remainders only', () => {
        expect(totalRemainingQuota(
            { maze: 5, text_adventure: 2 },
            { maze: 3, text_adventure: 4 },  // text_adventure over-placed
        )).toBe(2);
    });

    it('returns 0 when null quotas', () => {
        expect(totalRemainingQuota(null, {})).toBe(0);
    });
});

describe('mixed substrates — end to end', () => {
    function makeGridGrowthRulesJson() {
        const { grid, startCell } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 7,
            growthParams: { branchProbability: 0.5, assumeBidirectional: true },
        });
        return buildRulesJson(grid, { startCell });
    }

    function distributionFromSidecars(rules) {
        const sidecars = rules.preset_sidecars['1'];
        const counts = {};
        for (const entry of Object.values(sidecars)) {
            counts[entry.substrate] = (counts[entry.substrate] || 0) + 1;
        }
        return counts;
    }

    function regionSubstrates(rules) {
        const sidecars = rules.preset_sidecars['1'];
        const out = {};
        for (const [regionId, entry] of Object.entries(sidecars)) {
            out[regionId] = entry.substrate;
        }
        return out;
    }

    describe('top-down', () => {
        it('emits a mix of substrates under substrateMix and a fixed seed', () => {
            const source = makeGridGrowthRulesJson();
            const { grid, startCell } = topDownFromRulesJson(source, {
                gridDims: { width: 5, height: 5 },
                seed: 1,
                substrateMix: { maze: 1, text_adventure: 1 },
            });
            const out = buildRulesJson(grid, { startCell });
            const counts = distributionFromSidecars(out);

            // Both substrates present — at least one of each in the emitted
            // sidecars. With a 50/50 mix and >2 regions, both showing up
            // is overwhelmingly likely; if the mix mechanism failed
            // (e.g. fell through to default 'maze' for every region)
            // we'd see a single-key distribution.
            expect(counts.maze).toBeGreaterThanOrEqual(1);
            expect(counts.text_adventure).toBeGreaterThanOrEqual(1);
        });

        it('is deterministic for a fixed seed + mix', () => {
            const source = makeGridGrowthRulesJson();
            const opts = {
                gridDims: { width: 5, height: 5 },
                seed: 1,
                substrateMix: { maze: 1, text_adventure: 1 },
            };
            const a = topDownFromRulesJson(source, opts);
            const b = topDownFromRulesJson(source, opts);
            const aOut = buildRulesJson(a.grid, { startCell: a.startCell });
            const bOut = buildRulesJson(b.grid, { startCell: b.startCell });
            expect(regionSubstrates(aOut)).toEqual(regionSubstrates(bOut));
        });

        it('honors substrateByRegion override for specific regions', () => {
            const source = makeGridGrowthRulesJson();
            const sourceRegionNames = Object.keys(source.regions['1']).filter(
                (n) => n !== 'Menu',
            );
            // Force one region to text_adventure, one to maze; let the
            // rest fall through to the default.
            const overrides = {
                [sourceRegionNames[0]]: 'text_adventure',
                [sourceRegionNames[1]]: 'maze',
            };
            const { grid, startCell } = topDownFromRulesJson(source, {
                gridDims: { width: 5, height: 5 },
                seed: 1,
                substrateByRegion: overrides,
            });
            const out = buildRulesJson(grid, { startCell });
            const subs = regionSubstrates(out);
            expect(subs[sourceRegionNames[0]]).toBe('text_adventure');
            expect(subs[sourceRegionNames[1]]).toBe('maze');
        });

        it('cross-substrate exits resolve target_region correctly', () => {
            const source = makeGridGrowthRulesJson();
            const { grid, startCell } = topDownFromRulesJson(source, {
                gridDims: { width: 5, height: 5 },
                seed: 1,
                substrateMix: { maze: 1, text_adventure: 1 },
            });
            const out = buildRulesJson(grid, { startCell });
            // Walk every region's exits — none should have a null
            // connected_region for in-grid neighbors. Stitching is
            // substrate-agnostic, so cross-substrate boundaries should
            // resolve as cleanly as same-substrate ones.
            for (const region of Object.values(out.regions['1'])) {
                for (const exit of region.exits) {
                    expect(exit.connected_region).toBeTruthy();
                }
            }
        });

        // Golden characterization snapshots — pin the COMPILED logic graph
        // (regions/exits/locations/access-rules/items/placements) for a
        // fixed seed, with the bulky per-region geometry stripped from the
        // sidecars. The unified-substrate-interface refactor restructures
        // the region-build path; these make "behavior-preserving" provable
        // for both procedural substrates. If geometry/placement drifts, the
        // position-suffixed location names change and the snapshot fails.
        // See topdown-bounce-obstacle-refactor.md (Phase 2a).
        function compiledLogicGraph(out) {
            const clone = JSON.parse(JSON.stringify(out));
            const sidecars = clone.preset_sidecars?.['1'] ?? {};
            for (const k of Object.keys(sidecars)) {
                // Keep only the substrate tag; drop geometry payload.
                sidecars[k] = { substrate: sidecars[k]?.substrate ?? null };
            }
            return clone;
        }

        it('compiles a stable logic graph for an all-maze top-down layout', () => {
            const source = makeGridGrowthRulesJson();
            const { grid, startCell } = topDownFromRulesJson(source, {
                gridDims: { width: 5, height: 5 },
                seed: 1,
                substrateByRegion: Object.fromEntries(
                    Object.keys(source.regions['1'])
                        .filter((n) => n !== 'Menu')
                        .map((n) => [n, 'maze']),
                ),
            });
            const out = buildRulesJson(grid, { startCell });
            expect(compiledLogicGraph(out)).toMatchSnapshot();
        });

        it('compiles a stable logic graph for an all-text-adventure top-down layout', () => {
            const source = makeGridGrowthRulesJson();
            const { grid, startCell } = topDownFromRulesJson(source, {
                gridDims: { width: 5, height: 5 },
                seed: 1,
                substrateByRegion: Object.fromEntries(
                    Object.keys(source.regions['1'])
                        .filter((n) => n !== 'Menu')
                        .map((n) => [n, 'text_adventure']),
                ),
            });
            const out = buildRulesJson(grid, { startCell });
            expect(compiledLogicGraph(out)).toMatchSnapshot();
        });
    });

    describe('grid-growth', () => {
        it('emits a mix of substrates under substrateMix and a fixed seed', () => {
            const { grid, startCell } = growMaze({
                gridDims: { width: 3, height: 3 },
                regionSize: { width: 6, height: 6 },
                itemPool: { key_red: 2 },
                obstaclePool: { door_red: 2 },
                seed: 11,
                growthParams: {
                    substrateMix: { maze: 1, text_adventure: 1 },
                    branchProbability: 0.5,
                },
            });
            const out = buildRulesJson(grid, { startCell });
            const counts = distributionFromSidecars(out);
            expect(counts.maze).toBeGreaterThanOrEqual(1);
            expect(counts.text_adventure).toBeGreaterThanOrEqual(1);
        });

        it('is deterministic for a fixed seed + mix', () => {
            const config = {
                gridDims: { width: 3, height: 3 },
                regionSize: { width: 6, height: 6 },
                itemPool: { key_red: 2 },
                obstaclePool: { door_red: 2 },
                seed: 11,
                growthParams: {
                    substrateMix: { maze: 1, text_adventure: 1 },
                    branchProbability: 0.5,
                },
            };
            const a = growMaze(config);
            const b = growMaze(config);
            const aOut = buildRulesJson(a.grid, { startCell: a.startCell });
            const bOut = buildRulesJson(b.grid, { startCell: b.startCell });
            expect(regionSubstrates(aOut)).toEqual(regionSubstrates(bOut));
        });

        it('substrateQuotas produces exact per-substrate region counts', () => {
            // Pool big enough that pool-empty never fires; grid big
            // enough that frontier never dies before quotas fill.
            const { stats } = growMaze({
                gridDims: { width: 5, height: 5 },
                regionSize: { width: 6, height: 6 },
                itemPool: { key_red: 20 },
                obstaclePool: { door_red: 20 },
                seed: 17,
                growthParams: {
                    substrateQuotas: { maze: 3, text_adventure: 2 },
                    branchProbability: 0.9,
                },
            });
            expect(stats.stopReason).toBe('quotas_filled');
            expect(stats.regionsBuilt).toBe(5);
            expect(stats.substrateCounts).toEqual({ maze: 3, text_adventure: 2 });
        });

        it('startSubstrate pins the start region and counts against its quota', () => {
            const { grid, startCell, stats } = growMaze({
                gridDims: { width: 5, height: 5 },
                regionSize: { width: 6, height: 6 },
                itemPool: { key_red: 20 },
                obstaclePool: { door_red: 20 },
                seed: 17,
                growthParams: {
                    substrateQuotas: { maze: 3, text_adventure: 2 },
                    startSubstrate: 'text_adventure',
                    branchProbability: 0.9,
                },
            });
            const startId = `region_${startCell.gx}_${startCell.gy}`;
            expect(grid.getRegion(startCell).substrate).toBe('text_adventure');
            expect(stats.substrateCounts).toEqual({ maze: 3, text_adventure: 2 });
            // Sanity: the start region's id is in the rules sidecars
            // as text_adventure.
            const out = buildRulesJson(grid, { startCell });
            expect(out.preset_sidecars['1'][startId].substrate).toBe('text_adventure');
        });

        it('startSubstrate=auto falls back to weighted picker', () => {
            // With quotas {maze: 1}, the auto pick at the start has
            // only maze available — so the start substrate is maze.
            const { stats } = growMaze({
                gridDims: { width: 5, height: 5 },
                regionSize: { width: 6, height: 6 },
                itemPool: { key_red: 20 },
                obstaclePool: { door_red: 20 },
                seed: 17,
                growthParams: {
                    substrateQuotas: { maze: 1 },
                    startSubstrate: 'auto',
                    branchProbability: 0.9,
                },
            });
            expect(stats.substrateCounts).toEqual({ maze: 1 });
            expect(stats.stopReason).toBe('quotas_filled');
        });

        it('stopOnPoolEmpty=true ends growth when item pool is exhausted', () => {
            const { stats } = growMaze({
                gridDims: { width: 5, height: 5 },
                regionSize: { width: 6, height: 6 },
                itemPool: { key_red: 1 },
                obstaclePool: { door_red: 1 },
                seed: 17,
                growthParams: {
                    substrateQuotas: { maze: 10 },  // unfillable
                    stopOnPoolEmpty: true,
                    branchProbability: 0.9,
                },
            });
            expect(stats.stopReason).toBe('pool_empty');
            expect(stats.regionsBuilt).toBeLessThan(10);
        });

        it('stopOnPoolEmpty=false keeps growing past pool exhaustion', () => {
            // Small pool; quotas should still fill via item-less
            // regions. Bigger quotas than item budget to force the
            // post-exhaustion code path.
            const { stats } = growMaze({
                gridDims: { width: 5, height: 5 },
                regionSize: { width: 6, height: 6 },
                itemPool: { key_red: 1 },
                obstaclePool: { door_red: 1 },
                seed: 17,
                growthParams: {
                    substrateQuotas: { maze: 4 },
                    stopOnPoolEmpty: false,
                    branchProbability: 0.9,
                },
            });
            expect(stats.stopReason).toBe('quotas_filled');
            expect(stats.regionsBuilt).toBe(4);
        });

        it('quota mode is deterministic for a fixed seed', () => {
            const config = {
                gridDims: { width: 5, height: 5 },
                regionSize: { width: 6, height: 6 },
                itemPool: { key_red: 20 },
                obstaclePool: { door_red: 20 },
                seed: 23,
                growthParams: {
                    substrateQuotas: { maze: 3, text_adventure: 3 },
                    branchProbability: 0.7,
                },
            };
            const a = growMaze(config);
            const b = growMaze(config);
            const aOut = buildRulesJson(a.grid, { startCell: a.startCell });
            const bOut = buildRulesJson(b.grid, { startCell: b.startCell });
            expect(regionSubstrates(aOut)).toEqual(regionSubstrates(bOut));
            expect(a.stats.substrateCounts).toEqual(b.stats.substrateCounts);
        });
    });

    describe('biome round-trip via preset_sidecars', () => {
        it("emits 'biome' on every maze region (default = classic)", () => {
            const { grid, startCell } = growMaze({
                gridDims: { width: 2, height: 2 },
                regionSize: { width: 6, height: 6 },
                itemPool: { key_red: 1 },
                obstaclePool: { door_red: 1 },
                seed: 1,
            });
            const out = buildRulesJson(grid, { startCell });
            const sidecars = out.preset_sidecars['1'];
            const mazeRegions = Object.values(sidecars).filter((r) => r.substrate === 'maze');
            expect(mazeRegions.length).toBeGreaterThan(0);
            for (const r of mazeRegions) {
                expect(r.biome).toBeTruthy();
                expect(r.biome.id).toBe('classic');
            }
        });

        it("emits 'biome' on text-adventure regions too — both substrates share generateRegionCore today, so the underlying spatial structure carries a biome regardless", () => {
            // If/when ta gets its own spatial core or opts out of
            // biomes, this test should flip to expecting the field
            // to be omitted; revisit at that time.
            const { grid, startCell } = growMaze({
                gridDims: { width: 2, height: 2 },
                regionSize: { width: 6, height: 6 },
                itemPool: { key_red: 1 },
                obstaclePool: { door_red: 1 },
                seed: 11,
                growthParams: {
                    substrateMix: { maze: 0, text_adventure: 1 },
                },
            });
            const out = buildRulesJson(grid, { startCell });
            const sidecars = out.preset_sidecars['1'];
            const taRegions = Object.values(sidecars).filter((r) => r.substrate === 'text_adventure');
            expect(taRegions.length).toBeGreaterThan(0);
            for (const r of taRegions) {
                expect(r.biome?.id).toBe('classic');
            }
        });
    });
});

describe('spiralCells', () => {
    function take(n, gen) {
        const out = [];
        for (let i = 0; i < n; i++) out.push(gen.next().value);
        return out;
    }

    it('yields the first 9 cells filling a centered 3x3 (CW from E)', () => {
        // Expected pattern from origin, CW, E first:
        // 7 8 9
        // 6 1 2
        // 5 4 3
        const cells = take(9, spiralCells({ gx: 0, gy: 0 }, 'E'));
        expect(cells).toEqual([
            { gx: 0,  gy: 0 },   // 1
            { gx: 1,  gy: 0 },   // 2 E
            { gx: 1,  gy: 1 },   // 3 S
            { gx: 0,  gy: 1 },   // 4 W
            { gx: -1, gy: 1 },   // 5 W
            { gx: -1, gy: 0 },   // 6 N
            { gx: -1, gy: -1 },  // 7 N
            { gx: 0,  gy: -1 },  // 8 E
            { gx: 1,  gy: -1 },  // 9 E
        ]);
    });

    it('cell 10 is east of cell 9, continuing the spiral outward', () => {
        const cells = take(10, spiralCells({ gx: 0, gy: 0 }, 'E'));
        expect(cells[9]).toEqual({ gx: 2, gy: -1 });
    });

    it('rejects invalid firstStep', () => {
        expect(() => [...take(1, spiralCells({ gx: 0, gy: 0 }, 'XX'))])
            .toThrow(/invalid firstStep/);
    });
});

describe('buildShuffledSubstrateSequence', () => {
    it('produces a sequence of length sum(quotas) with correct multiplicities', () => {
        const rng = createRng(1);
        const seq = buildShuffledSubstrateSequence(
            { jta: 3, maze: 2 }, null, rng,
        );
        expect(seq).toHaveLength(5);
        const counts = seq.reduce((c, s) => { c[s] = (c[s] || 0) + 1; return c; }, {});
        expect(counts).toEqual({ jta: 3, maze: 2 });
    });

    it("pins startSubstrate to position 0 (and counts against its quota)", () => {
        const rng = createRng(1);
        const seq = buildShuffledSubstrateSequence(
            { jta: 3, maze: 2 }, 'jta', rng,
        );
        expect(seq[0]).toBe('jta');
        const counts = seq.reduce((c, s) => { c[s] = (c[s] || 0) + 1; return c; }, {});
        expect(counts).toEqual({ jta: 3, maze: 2 });
    });

    it('throws when startSubstrate has no quota', () => {
        const rng = createRng(1);
        expect(() => buildShuffledSubstrateSequence(
            { jta: 3 }, 'maze', rng,
        )).toThrow(/no quota/);
    });

    it('is deterministic for a fixed rng seed', () => {
        const a = buildShuffledSubstrateSequence(
            { jta: 3, maze: 2 }, null, createRng(7),
        );
        const b = buildShuffledSubstrateSequence(
            { jta: 3, maze: 2 }, null, createRng(7),
        );
        expect(a).toEqual(b);
    });
});

describe('arrangeShuffledSpiral', () => {
    function defaultConfig(overrides = {}) {
        return {
            regionSize: { width: 8, height: 6 },
            seed: 1,
            ...overrides,
        };
    }

    it('places one region per quota, builds an auto-sized grid', () => {
        const { grid, stats } = arrangeShuffledSpiral(defaultConfig({
            growthParams: { substrateQuotas: { jta: 5 } },
        }));
        expect(stats.regionsBuilt).toBe(5);
        expect(stats.stopReason).toBe('spiral_complete');
        expect(stats.substrateCounts).toEqual({ jta: 5 });
        // 5 spiral cells fit in a 3-wide × 2-tall bounding box.
        const cells = [...grid.cells.keys()];
        expect(cells).toHaveLength(5);
    });

    it("assigns jta zone indices in order (0, 1, 2, ...) regardless of spiral position", () => {
        const { grid } = arrangeShuffledSpiral(defaultConfig({
            growthParams: { substrateQuotas: { jta: 4 }, startSubstrate: 'jta' },
        }));
        const zones = [...grid.cells.values()]
            .filter((r) => r.substrate === 'jta')
            .map((r) => r.playable_payload.jtaZone)
            .sort((a, b) => a - b);
        expect(zones).toEqual([0, 1, 2, 3]);
    });

    it('throws when a quota exceeds the substrate zoneCount', () => {
        expect(() => arrangeShuffledSpiral(defaultConfig({
            growthParams: { substrateQuotas: { jta: 20 } },
        }))).toThrow(/exceeds substrate zoneCount/);
    });

    it('throws when growthParams.substrateQuotas is missing or empty', () => {
        expect(() => arrangeShuffledSpiral(defaultConfig({
            growthParams: {},
        }))).toThrow(/substrateQuotas required/);
        expect(() => arrangeShuffledSpiral(defaultConfig({
            growthParams: { substrateQuotas: {} },
        }))).toThrow(/substrateQuotas required/);
    });

    it('throws when a substrate id is not registered', () => {
        expect(() => arrangeShuffledSpiral(defaultConfig({
            growthParams: { substrateQuotas: { bogus: 1 } },
        }))).toThrow(/not registered/);
    });

    it('every exit has a reciprocal pointing back (always-accessible 4-way)', () => {
        const { grid } = arrangeShuffledSpiral(defaultConfig({
            seed: 3,
            growthParams: { substrateQuotas: { jta: 3, maze: 2 }, startSubstrate: 'jta' },
            itemPool: { key_red: 4 },
            obstaclePool: { door_red: 4 },
        }));
        const pairs = [];
        for (const region of grid.allRegions()) {
            for (const [, e] of region.exits) {
                if (e.targetRegion) {
                    pairs.push({ from: region.region_id, to: e.targetRegion });
                }
            }
        }
        for (const p of pairs) {
            const reciprocal = pairs.find((q) => q.from === p.to && q.to === p.from);
            expect(reciprocal).toBeTruthy();
        }
    });

    it('start substrate pin lands on the startCell', () => {
        const { grid, startCell } = arrangeShuffledSpiral(defaultConfig({
            growthParams: { substrateQuotas: { jta: 3, maze: 2 }, startSubstrate: 'maze' },
            itemPool: { key_red: 4 },
            obstaclePool: { door_red: 4 },
        }));
        const startRegion = grid.getRegion(startCell);
        expect(startRegion.substrate).toBe('maze');
    });

    it('runs end-to-end into buildRulesJson without errors', () => {
        const { grid, startCell } = arrangeShuffledSpiral(defaultConfig({
            growthParams: { substrateQuotas: { jta: 4, maze: 2 }, startSubstrate: 'jta' },
            itemPool: { key_red: 4 },
            obstaclePool: { door_red: 4 },
        }));
        const rules = buildRulesJson(grid, { startCell, seed: 1 });
        expect(rules.regions['1']).toBeTruthy();
        const sidecars = rules.preset_sidecars['1'];
        const jtaRegions = Object.values(sidecars).filter((r) => r.substrate === 'jta');
        expect(jtaRegions).toHaveLength(4);
        for (const r of jtaRegions) {
            expect(typeof r.playable_payload.jtaZone).toBe('number');
        }
    });

    // Regression: synthesizeZoneRegion used to omit region_id from
    // extracted_rules, so compileRegion produced region_name=undefined.
    // compileRegionGraph then collapsed every zone-based region onto
    // regions[undefined] and Menu's GameStart exit dangled, leaving the
    // Region Graph panel empty except for the Menu node.
    it('emits one named region entry per quota (no regions[undefined] collapse)', () => {
        const { grid, startCell } = arrangeShuffledSpiral(defaultConfig({
            growthParams: { substrateQuotas: { jta: 4 } },
        }));
        const rules = buildRulesJson(grid, { startCell, seed: 1 });
        const regionMap = rules.regions['1'];
        // Menu + 4 jta regions, all keyed by string region_id.
        expect(Object.keys(regionMap)).toHaveLength(5);
        expect(regionMap.undefined).toBeUndefined();
        const menuExit = regionMap.Menu.exits.find((e) => e.name === 'GameStart');
        expect(menuExit).toBeTruthy();
        // GameStart must point at an actual region in the map.
        expect(regionMap[menuExit.connected_region]).toBeTruthy();
    });

    it('is deterministic for a fixed seed', () => {
        const cfg = defaultConfig({
            seed: 11,
            growthParams: { substrateQuotas: { jta: 3, maze: 2 } },
        });
        const a = arrangeShuffledSpiral(cfg);
        const b = arrangeShuffledSpiral(cfg);
        const aIds = [...a.grid.cells.values()].map((r) => r.region_id + ':' + r.substrate);
        const bIds = [...b.grid.cells.values()].map((r) => r.region_id + ':' + r.substrate);
        expect(aIds).toEqual(bIds);
    });
});
