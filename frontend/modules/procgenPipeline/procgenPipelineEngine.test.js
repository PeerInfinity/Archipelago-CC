import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
import { ScenarioPool, SIDES, OPPOSITE_SIDE } from './procgenPipelineEngine.js';

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
        // Substrate claims it only placed one of the two offered items.
        pool.markPlaced({
            placed_items: [{ item_id: plan.items_to_place[0], position: { x: 0, y: 0 } }],
            placed_obstacles: [],
        });
        expect(pool.itemsRemaining()).toBe(1);
        expect(pool.obstaclesRemaining()).toBe(1);
    });
});
