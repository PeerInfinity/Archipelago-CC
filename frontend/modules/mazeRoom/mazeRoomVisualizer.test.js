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

    it('setWorld with spawnAt overrides the entrance spawn', () => {
        // Cross-region back-traversal regression: the panel resolves
        // arrivedFrom.exit_id to a non-entrance tile and needs the
        // visualizer's state to land there too — otherwise the
        // visualizer's _notifyChange callback mirrors the (wrong)
        // entrance-spawn back into the panel and clobbers the panel's
        // arrival position.
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(5, 3);
        v.setWorld(world, 'TestRegion', { spawnAt: { x: 4, y: 2 } });
        const s = v.getState();
        expect(s.player_pos).toEqual({ x: 4, y: 2 });
    });

    it('setWorld with spawnAt + onStateChange notifies with the override pos', () => {
        // The _onVisualizerChange callback reads getState().player_pos
        // and mirrors it into the panel; the override must be present
        // by the time _notifyChange fires.
        const seen = [];
        const v = new MazeRoomVisualizer({
            onStateChange: () => seen.push(v.getState().player_pos),
        });
        const world = makeOpenWorld(5, 3);
        v.setWorld(world, 'TestRegion', { spawnAt: { x: 3, y: 1 } });
        expect(seen.at(-1)).toEqual({ x: 3, y: 1 });
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

    it('fires onLocationCheck when stepping onto a named-pickup tile', () => {
        // Bot-driven playback regression: without this callback, the
        // panel never publishes user:locationCheck for visualizer
        // pickups (only keyboard play does, via _publishPlaybackEvents).
        // The bot then waits forever for an event that never fires.
        const events = [];
        const v = new MazeRoomVisualizer({
            onLocationCheck: (locationName, itemId, regionId) => {
                events.push({ locationName, itemId, regionId });
            },
        });
        const world = makeOpenWorld(3, 1);
        setItem(world, 2, 0, 'key_red');
        if (!world.itemLocationNames) world.itemLocationNames = new Map();
        world.itemLocationNames.set('2,0', 'Pickup A');
        v.setWorld(world, 'TestRegion');
        v.instant();
        expect(events).toEqual([
            { locationName: 'Pickup A', itemId: 'key_red', regionId: 'TestRegion' },
        ]);
    });

    it('skips onLocationCheck when the picked-up tile has no locationName', () => {
        // Generate dev flow: items placed without itemLocationNames
        // shouldn't fire dispatcher events (no AP-canonical name to
        // attach the check to).
        const events = [];
        const v = new MazeRoomVisualizer({
            onLocationCheck: (locationName, itemId, regionId) => {
                events.push({ locationName, itemId, regionId });
            },
        });
        const world = makeOpenWorld(3, 1);
        setItem(world, 2, 0, 'key_red');     // no itemLocationNames entry
        v.setWorld(world, 'R');
        v.instant();
        expect(events).toEqual([]);
    });

    it('does not re-fire onLocationCheck when stepping over an already-collected tile', () => {
        // Bot-driven playback regression: walking back over a
        // previously-collected item tile (e.g. on a return trip
        // through a region) was firing onLocationCheck again, which
        // spammed user:locationCheck on the dispatcher and lit up
        // stateManager's "already-checked" reject path. The visualizer
        // now suppresses repeat pickups the same way keyboard play
        // (_publishPlaybackEvents) always did.
        const events = [];
        const v = new MazeRoomVisualizer({
            onLocationCheck: (locationName) => events.push(locationName),
        });
        // 5x1 row: entrance at (0,0), key at (2,0). Walk to (4,0) and
        // back through (2,0) — second visit must not fire.
        const world = makeOpenWorld(5, 1);
        setItem(world, 2, 0, 'key_red');
        if (!world.itemLocationNames) world.itemLocationNames = new Map();
        world.itemLocationNames.set('2,0', 'Single Pickup');
        v.setWorld(world, 'R');
        // Drive manually: walkToTile gives a deterministic path so we
        // don't rely on greedy-mode targeting decisions.
        v.walkToTile({ x: 4, y: 0 });
        v.step(); v.step();   // (0,0) → (1,0) → (2,0)  — first pickup
        v.step(); v.step();   // → (3,0) → (4,0)
        v.walkToTile({ x: 0, y: 0 });
        v.step(); v.step();   // (4,0) → (3,0) → (2,0)  — repeat pickup, must skip
        v.step(); v.step();   // → (1,0) → (0,0)
        expect(events).toEqual(['Single Pickup']);
    });

    it('repeat pickups do not push a "Picked up" log entry', () => {
        // Same setup as above, but verifies the visualizer's internal
        // step log doesn't lie about a re-pickup. The trace should
        // read like a plain step on the second visit.
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(5, 1);
        setItem(world, 2, 0, 'key_red');
        if (!world.itemLocationNames) world.itemLocationNames = new Map();
        world.itemLocationNames.set('2,0', 'Single Pickup');
        v.setWorld(world, 'R');
        v.walkToTile({ x: 4, y: 0 });
        v.step(); v.step(); v.step(); v.step();
        v.walkToTile({ x: 0, y: 0 });
        v.step(); v.step(); v.step(); v.step();
        const pickupLogs = v.getState().log.filter((e) => e.type === 'pickup');
        expect(pickupLogs).toHaveLength(1);
        expect(pickupLogs[0].locationName).toBe('Single Pickup');
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

describe('MazeRoomVisualizer — walkToTile (external control)', () => {
    it('aims at the named tile and plans a path under current inventory', () => {
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(5, 1);   // entrance (0,0), open row
        v.setWorld(world, 'R');
        v.walkToTile({ x: 4, y: 0, name: 'far_exit' });
        expect(v.isExternallyControlled()).toBe(true);
        const s = v.getState();
        expect(s.target).toMatchObject({ x: 4, y: 0, kind: 'walkTo', name: 'far_exit' });
        // 4 east-steps to traverse from (0,0) to (4,0).
        v.step(); v.step(); v.step(); v.step();
        expect(v.getState().player_pos).toEqual({ x: 4, y: 0 });
    });

    it('no-op when the target is the current player position', () => {
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(5, 1);
        v.setWorld(world, 'R');
        v.walkToTile({ x: 0, y: 0 });    // entrance
        const s = v.getState();
        expect(s.target).toBeNull();
        expect(s.player_pos).toEqual({ x: 0, y: 0 });
        // Still flips the controlled flag — the bot drove us here, even
        // if there's nothing to walk this turn.
        expect(v.isExternallyControlled()).toBe(true);
    });

    it('fires onExitCross when target equals current pos AND tile is an exit', () => {
        // Bot regression: the procgen pipeline mirrors a region's
        // back-exit to the entrance tile, so when the bot wants to
        // leave a region via the back-exit, walkToTile finds itself
        // already on the target. Without this guard the visualizer
        // sits idle and the bot keeps re-issuing the same walkTo
        // forever — never crossing.
        const events = [];
        const world = createWorld(5, 3, {
            entrance: { x: 0, y: 1 },
            exits: [{ exit_id: 'back', x: 0, y: 1, side: 'W',
                exitName: 'back', targetRegion: 'parent' }],
        });
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 5; x++) setTile(world, x, y, TILE_FLOOR);
        }
        const v = new MazeRoomVisualizer({
            onExitCross: (exit, regionId) => events.push({ exit_id: exit.exit_id, regionId }),
        });
        v.setWorld(world, 'child');
        // Entrance is (0,1) and the back-exit is also (0,1) — same as
        // procgen pipeline does. Walker is parked there on spawn.
        v.walkToTile({ x: 0, y: 1, name: 'back' });
        expect(events).toEqual([{ exit_id: 'back', regionId: 'child' }]);
        // The visualizer should also log the exit-cross so the user
        // can see it in the trace, and pause for region load.
        const s = v.getState();
        expect(s.log.some((e) => e.type === 'exit_cross' && e.exit_id === 'back')).toBe(true);
    });

    it('does not fire onExitCross for a regular floor tile at current pos', () => {
        const events = [];
        const v = new MazeRoomVisualizer({
            onExitCross: (exit) => events.push(exit.exit_id),
        });
        const world = makeOpenWorld(5, 1);
        v.setWorld(world, 'R');
        v.walkToTile({ x: 0, y: 0 });   // entrance, NOT an exit in this fixture
        expect(events).toEqual([]);
    });

    it('sets _stuck and stops the clock when the target is unreachable', () => {
        const v = new MazeRoomVisualizer({});
        // 3x2 with all-walls on row 1 except entrance at (0,0); the
        // tile (2,1) sits in an enclosed cell (also a wall) so BFS can
        // never plan a path there. We place the wall AT the target so
        // _planTilePath returns null without us having to construct an
        // isolated floor pocket.
        const world = makeOpenWorld(3, 2);
        setTile(world, 2, 1, TILE_WALL);
        v.setWorld(world, 'R');
        v.walkToTile({ x: 2, y: 1 });
        const s = v.getState();
        expect(s.stuck).toBe(true);
        expect(v.isRunning()).toBe(false);
        expect(s.log.some((e) => e.type === 'blocked' && e.reason === 'unreachable')).toBe(true);
    });

    it('does not start the clock — caller drives play/step explicitly', () => {
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(5, 1);
        v.setWorld(world, 'R');
        v.walkToTile({ x: 4, y: 0 });
        expect(v.isRunning()).toBe(false);
    });

    it('controlled mode sits idle — _tick is a no-op when the leg is done', () => {
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(5, 1);
        // No items / exits → greedy mode would mark complete immediately.
        v.setWorld(world, 'R');
        v.walkToTile({ x: 2, y: 0 });
        v.step(); v.step();   // walks to (2,0); leg complete
        expect(v.getState().player_pos).toEqual({ x: 2, y: 0 });
        // Further ticks must NOT trip the greedy-completed branch — the
        // bot owns target selection now.
        v.step();
        expect(v.isCompleted()).toBe(false);
        expect(v.getState().target).toBeNull();
    });

    it('reset() clears externallyControlled — greedy mode is back', () => {
        const v = new MazeRoomVisualizer({});
        const world = makeOpenWorld(5, 1);
        v.setWorld(world, 'R');
        v.walkToTile({ x: 4, y: 0 });
        expect(v.isExternallyControlled()).toBe(true);
        v.reset();
        expect(v.isExternallyControlled()).toBe(false);
    });

    it('externally-controlled flag survives a setWorld continuation (cross-region)', () => {
        const v = new MazeRoomVisualizer({});
        const world1 = makeOpenWorld(5, 1);
        const world2 = makeOpenWorld(5, 1);
        v.setWorld(world1, 'A');
        v.walkToTile({ x: 4, y: 0 });
        expect(v.isExternallyControlled()).toBe(true);
        v.setWorld(world2, 'B');   // continuation — bot stays in charge
        expect(v.isExternallyControlled()).toBe(true);
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
