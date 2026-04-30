import { describe, it, expect, vi } from 'vitest';

import { MazeRoomVisualizer } from './mazeRoomVisualizer.js';
import {
    createWorld,
    setTile,
    setItem,
    setObstacle,
    setEntrance,
    TILE_FLOOR,
    TILE_WALL,
} from './mazeRoomEngine.js';

const ITEM_LIB = {
    key_red: { name: 'Red Key' },
};
const OBSTACLE_LIB = {
    door_red: {
        clear_set_type: 'rule',
        clear_rule: { rule: 'Has', args: { item_name: 'key_red' } },
    },
};

function makeOpenWorld(width = 5, height = 3, { withDefaultExit = false } = {}) {
    if (height < 2) height = 2;
    if (width < 2) width = 2;
    const world = createWorld(width, height, {
        itemLib: ITEM_LIB,
        obstacleLib: OBSTACLE_LIB,
        // Suppress createWorld's "default exit at bottom-right" for
        // tests that intend a no-exit region.
        ...(withDefaultExit ? {} : { exits: [] }),
    });
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            setTile(world, x, y, TILE_FLOOR);
        }
    }
    setEntrance(world, 0, 0);
    return world;
}

function makeFakeEventBus() {
    const events = [];
    return {
        events,
        publish(topic, payload) { events.push({ topic, payload }); },
    };
}

describe('MazeRoomVisualizer — initialization', () => {
    it('starts not running, with no plan', () => {
        const v = new MazeRoomVisualizer({});
        expect(v.isRunning()).toBe(false);
        expect(v.isCompleted()).toBe(false);
        expect(v.isStuck()).toBe(false);
    });

    it('setWorld populates entrance state', () => {
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld();
        setItem(world, 4, 0, 'key_red');
        v.setWorld(world, 'TestRegion');
        const s = v.getState();
        expect(s.player_pos).toEqual({ x: 0, y: 0 });
        expect(s.inventory.size).toBe(0);
        expect(s.log).toEqual([]);
    });
});

describe('MazeRoomVisualizer — basic walk', () => {
    it('walks to the only item, picks it up, and completes', () => {
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(5, 1);
        setItem(world, 4, 0, 'key_red');
        if (!world.itemLocationNames) world.itemLocationNames = new Map();
        world.itemLocationNames.set('4,0', 'Red Key Pickup');

        v.setWorld(world, 'R');
        v.instant();
        const s = v.getState();
        expect(s.completed).toBe(true);
        expect(s.inventory.has('key_red')).toBe(true);
        expect(s.checkedLocations.has('Red Key Pickup')).toBe(true);
        // Should have at least one pickup entry in the log.
        expect(s.log.some((e) => e.type === 'pickup' && e.itemId === 'key_red')).toBe(true);
    });

    it('logs each move step with from/to coordinates', () => {
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(3, 1);
        setItem(world, 2, 0, 'key_red');
        v.setWorld(world, 'R');
        v.step();
        const s = v.getState();
        const stepEntries = s.log.filter((e) => e.type === 'step');
        expect(stepEntries.length).toBe(1);
        expect(stepEntries[0]).toMatchObject({ from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, input: 'E' });
    });
});

describe('MazeRoomVisualizer — blocked-by-obstacle rule eval surface', () => {
    it('completes without picking up an item locked behind an unclearable door', () => {
        const v = new MazeRoomVisualizer({});
        // Layout: 3x2. Entrance (0,0); door_red at (1,0) blocks the
        // direct E path; walls along the alternate (south) path force
        // the door to be the only route to key_red at (2,0).
        const world = makeOpenWorld(3, 2);
        setTile(world, 0, 1, TILE_WALL);
        setTile(world, 1, 1, TILE_WALL);
        setTile(world, 2, 1, TILE_WALL);
        setObstacle(world, 1, 0, 'door_red');
        setItem(world, 2, 0, 'key_red');
        if (!world.itemLocationNames) world.itemLocationNames = new Map();
        world.itemLocationNames.set('2,0', 'Locked Pickup');

        v.setWorld(world, 'R');
        v.instant();
        const s = v.getState();
        expect(s.completed).toBe(true);
        expect(s.inventory.has('key_red')).toBe(false);
        expect(s.checkedLocations.has('Locked Pickup')).toBe(false);
    });

    it('logs an obstacle-blocked step when a planned move is refused at execution', () => {
        // Force the planner-then-blocked path: BFS plans through (1,0)
        // because no obstacle is present at plan time, but we mutate
        // the world to drop the door in mid-plan. Simulates a race —
        // the underlying point is verifying the blocked-step formatting.
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(3, 1);
        setItem(world, 2, 0, 'key_red');
        if (!world.itemLocationNames) world.itemLocationNames = new Map();
        world.itemLocationNames.set('2,0', 'Item');

        v.setWorld(world, 'R');
        v.step(); // plan computed at this tick; player moved to (1,0)

        // Now drop a door at (2,0) so the next planned step is blocked.
        setObstacle(world, 2, 0, 'door_red');
        v.step();
        const s = v.getState();
        const blocked = s.log.find((e) => e.type === 'blocked');
        expect(blocked).toBeTruthy();
        expect(blocked.obstacleId).toBe('door_red');
        expect(blocked.description).toMatch(/door_red/);
        expect(blocked.description).toMatch(/Has\(key_red\)/);
        expect(s.stuck).toBe(true);
    });
});

describe('MazeRoomVisualizer — playback events', () => {
    it('publishes playback:snapshotUpdated on each tick', () => {
        const bus = makeFakeEventBus();
        const v = new MazeRoomVisualizer({ eventBus: bus });
        const world = makeOpenWorld(3, 1);
        setItem(world, 2, 0, 'key_red');
        if (!world.itemLocationNames) world.itemLocationNames = new Map();
        world.itemLocationNames.set('2,0', 'Pickup');

        v.setWorld(world, 'R');
        v.step();
        v.step();
        const playbackEvents = bus.events.filter((e) => e.topic === 'playback:snapshotUpdated');
        expect(playbackEvents.length).toBeGreaterThan(0);
        // Last published snapshot should reflect the pickup.
        const lastPayload = playbackEvents[playbackEvents.length - 1].payload;
        expect(lastPayload.snapshot.checkedLocations).toContain('Pickup');
        expect(lastPayload.source).toBe('mazeRoomVisualizer');
    });

    it('does NOT publish stateManager:snapshotUpdated', () => {
        const bus = makeFakeEventBus();
        const v = new MazeRoomVisualizer({ eventBus: bus });
        const world = makeOpenWorld(2, 1);
        setItem(world, 1, 0, 'key_red');
        v.setWorld(world, 'R');
        v.instant();
        const smEvents = bus.events.filter((e) => e.topic === 'stateManager:snapshotUpdated');
        expect(smEvents.length).toBe(0);
    });
});

describe('MazeRoomVisualizer — controls', () => {
    it('reset() clears state and stops the clock', () => {
        const bus = makeFakeEventBus();
        const v = new MazeRoomVisualizer({ eventBus: bus });
        const world = makeOpenWorld(2, 1);
        setItem(world, 1, 0, 'key_red');
        v.setWorld(world, 'R');
        v.step();
        expect(v.getState().log.length).toBeGreaterThan(0);
        v.reset();
        const s = v.getState();
        expect(s.log).toEqual([]);
        expect(s.player_pos).toEqual({ x: 0, y: 0 });
        expect(s.inventory.size).toBe(0);
    });

    it('onStateChange fires on each tick', () => {
        const onStateChange = vi.fn();
        const v = new MazeRoomVisualizer({ onStateChange });
        const world = makeOpenWorld(2, 1);
        setItem(world, 1, 0, 'key_red');
        v.setWorld(world, 'R');
        const before = onStateChange.mock.calls.length;
        v.step();
        expect(onStateChange.mock.calls.length).toBeGreaterThan(before);
    });
});

describe('MazeRoomVisualizer — completion / stuck handling', () => {
    it('marks complete when no targets remain reachable', () => {
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(2, 1);
        // No items, no exits — visualizer should immediately complete.
        v.setWorld(world, 'R');
        v.step();
        const s = v.getState();
        expect(s.completed).toBe(true);
    });

    it('does not run play() once stuck', () => {
        const v = new MazeRoomVisualizer({});
        // Force stuck by simulating a blocked engine.
        v._stuck = true;
        v.play(10);
        expect(v.isRunning()).toBe(false);
    });
});
