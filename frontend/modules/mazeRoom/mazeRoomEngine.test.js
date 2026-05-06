import { describe, it, expect } from 'vitest';

import { reach } from '../shared/simulatorCore.js';
import { createRng } from '../shared/rng.js';
import {
    TILE_FLOOR, TILE_WALL,
    INPUT_N, INPUT_S, INPUT_E, INPUT_W,
    createWorld, createState,
    getTile, setTile, isFloor,
    getObstacle, setObstacle,
    getItem, setItem,
    step,
    bfsSolver, reachedExit,
    apply, undo,
    generateMaze,
    extractPathsAndObstacles,
    generateRegionCore,
    placeFromItems,
    placeFromRules,
    deserializeMazeWorld,
    detectStepEvents,
    getDefaultExit,
    clockwisePerimeterTiles,
    deriveSingleKeyGatePairs,
} from './mazeRoomEngine.js';
import { isObstacleCleared, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
import { compileRegion } from '../shared/procgen/pathsAndObstaclesCompiler.js';

function runPlan(world, startState, plan) {
    let s = startState;
    for (const input of plan) {
        const next = step(world, s, input);
        if (next === null) return null;
        s = next;
    }
    return s;
}

describe('createWorld', () => {
    it('rejects tiny grids', () => {
        expect(() => createWorld(1, 5)).toThrow();
        expect(() => createWorld(5, 1)).toThrow();
    });

    it('rejects out-of-bounds entrance/exit', () => {
        expect(() => createWorld(4, 4, { entrance: { x: 4, y: 0 } })).toThrow();
        expect(() => createWorld(4, 4, { exit: { x: 0, y: -1 } })).toThrow();
    });

    it('defaults entrance to top-left and exit to bottom-right', () => {
        const w = createWorld(5, 4);
        expect(w.entrance).toEqual({ x: 0, y: 0 });
        const exit = getDefaultExit(w);
        expect(exit.x).toBe(4);
        expect(exit.y).toBe(3);
        expect(w.tiles.length).toBe(20);
        for (let i = 0; i < w.tiles.length; i++) expect(w.tiles[i]).toBe(TILE_FLOOR);
    });
});

describe('step', () => {
    const world = createWorld(3, 3);
    const start = createState(world);

    it('moves into an adjacent floor tile', () => {
        const s = step(world, start, INPUT_E);
        expect(s).not.toBeNull();
        expect(s.player_pos).toEqual({ x: 1, y: 0 });
        expect(s.turn).toBe(1);
    });

    it('returns null on out-of-bounds', () => {
        expect(step(world, start, INPUT_N)).toBeNull();
        expect(step(world, start, INPUT_W)).toBeNull();
    });

    it('returns null when blocked by a wall', () => {
        const blocked = createWorld(3, 3);
        setTile(blocked, 1, 0, TILE_WALL);
        expect(step(blocked, createState(blocked), INPUT_E)).toBeNull();
    });

    it('returns null on unknown input', () => {
        expect(step(world, start, 'FLY')).toBeNull();
    });

    it('does not mutate the input state', () => {
        const before = createState(world);
        step(world, before, INPUT_E);
        expect(before.player_pos).toEqual({ x: 0, y: 0 });
        expect(before.turn).toBe(0);
    });
});

describe('library / obstacle gating', () => {
    it('isObstacleCleared: unknown obstacle id is permissive', () => {
        expect(isObstacleCleared('nonexistent', new Set())).toBe(true);
    });

    it('isObstacleCleared: door_red requires key_red', () => {
        expect(isObstacleCleared('door_red', new Set())).toBe(false);
        expect(isObstacleCleared('door_red', new Set(['key_red']))).toBe(true);
    });

    it('isObstacleCleared: any one combination clears an OR-of-AND clear_set', () => {
        const lib = { gap: { id: 'gap', clear_set: [['jump'], ['fly']] } };
        expect(isObstacleCleared('gap', new Set(), lib)).toBe(false);
        expect(isObstacleCleared('gap', new Set(['jump']), lib)).toBe(true);
        expect(isObstacleCleared('gap', new Set(['fly']), lib)).toBe(true);
    });

    it('isObstacleCleared: multi-item AND combination requires all items', () => {
        const lib = { both: { id: 'both', clear_set: [['a', 'b']] } };
        expect(isObstacleCleared('both', new Set(['a']), lib)).toBe(false);
        expect(isObstacleCleared('both', new Set(['b']), lib)).toBe(false);
        expect(isObstacleCleared('both', new Set(['a', 'b']), lib)).toBe(true);
    });

    it('isObstacleCleared: door_green and door_blue check their matching keys', () => {
        expect(isObstacleCleared('door_green', new Set())).toBe(false);
        expect(isObstacleCleared('door_green', new Set(['key_green']))).toBe(true);
        expect(isObstacleCleared('door_green', new Set(['key_red']))).toBe(false);
        expect(isObstacleCleared('door_blue', new Set(['key_blue']))).toBe(true);
    });

    it('isObstacleCleared: logic_gate with no clear_rule is never cleared', () => {
        // Base template: clear_rule is null until a per-instance clone fills it.
        expect(isObstacleCleared('logic_gate', new Set(['key_red']))).toBe(false);
    });

    it('isObstacleCleared: logic_gate evaluates its clear_rule against inventory', () => {
        const lib = {
            gate_a: {
                id: 'gate_a',
                clear_set_type: 'rule',
                clear_rule: { rule: 'Has', args: { item_name: 'key_red' } },
            },
            gate_b: {
                id: 'gate_b',
                clear_set_type: 'rule',
                clear_rule: {
                    rule: 'Or', children: [
                        { rule: 'Has', args: { item_name: 'key_red' } },
                        { rule: 'Has', args: { item_name: 'key_blue' } },
                    ],
                },
            },
            gate_c: {
                id: 'gate_c',
                clear_set_type: 'rule',
                clear_rule: {
                    rule: 'And', children: [
                        { rule: 'Has', args: { item_name: 'key_red' } },
                        { rule: 'Has', args: { item_name: 'key_green' } },
                    ],
                },
            },
        };
        expect(isObstacleCleared('gate_a', new Set(), lib)).toBe(false);
        expect(isObstacleCleared('gate_a', new Set(['key_red']), lib)).toBe(true);
        expect(isObstacleCleared('gate_b', new Set(['key_blue']), lib)).toBe(true);
        expect(isObstacleCleared('gate_b', new Set(['key_green']), lib)).toBe(false);
        expect(isObstacleCleared('gate_c', new Set(['key_red']), lib)).toBe(false);
        expect(isObstacleCleared('gate_c', new Set(['key_red', 'key_green']), lib)).toBe(true);
    });
});

describe('step with obstacles and items', () => {
    it('blocks movement onto a door without the matching key', () => {
        const w = createWorld(4, 4);
        setObstacle(w, 1, 0, 'door_red');
        const s = createState(w);
        expect(step(w, s, INPUT_E)).toBeNull();
    });

    it('allows movement onto a door when inventory clears it', () => {
        const w = createWorld(4, 4);
        setObstacle(w, 1, 0, 'door_red');
        const s = createState(w);
        s.inventory.add('key_red');
        const next = step(w, s, INPUT_E);
        expect(next).not.toBeNull();
        expect(next.player_pos).toEqual({ x: 1, y: 0 });
    });

    it('picks up an item on successful move', () => {
        const w = createWorld(4, 4);
        setItem(w, 1, 0, 'key_red');
        const s = createState(w);
        expect(s.inventory.has('key_red')).toBe(false);
        const next = step(w, s, INPUT_E);
        expect(next.inventory.has('key_red')).toBe(true);
    });

    it('does not pollute the input state when picking up an item', () => {
        const w = createWorld(4, 4);
        setItem(w, 1, 0, 'key_red');
        const before = createState(w);
        step(w, before, INPUT_E);
        expect(before.inventory.has('key_red')).toBe(false);
    });
});

describe('step inventoryOverride parameter', () => {
    it('uses the override (not state.inventory) for clearance checks', () => {
        const w = createWorld(4, 4);
        setObstacle(w, 1, 0, 'door_red');
        const s = createState(w);
        // state.inventory is empty but the override has the key — door
        // should clear.
        const overridden = step(w, s, INPUT_E, new Set(['key_red']));
        expect(overridden).not.toBeNull();
        expect(overridden.player_pos).toEqual({ x: 1, y: 0 });

        // Inverse: key in state.inventory but override is empty — door
        // should block.
        const s2 = createState(w);
        s2.inventory.add('key_red');
        const blocked = step(w, s2, INPUT_E, new Set());
        expect(blocked).toBeNull();
    });

    it('does not mutate state.inventory on pickup when override is provided', () => {
        const w = createWorld(4, 4);
        setItem(w, 1, 0, 'key_red');
        const s = createState(w);
        const next = step(w, s, INPUT_E, new Set());
        expect(next).not.toBeNull();
        // Caller is managing inventory externally — the player moved
        // onto the item but state.inventory stays empty.
        expect(next.inventory.has('key_red')).toBe(false);
    });

    it('does not mutate the override Set on pickup', () => {
        const w = createWorld(4, 4);
        setItem(w, 1, 0, 'key_red');
        const s = createState(w);
        const override = new Set();
        step(w, s, INPUT_E, override);
        expect(override.has('key_red')).toBe(false);
    });

    it('falls back to state.inventory when override is undefined', () => {
        // Sanity check that the historical behavior is preserved when
        // the new parameter is omitted.
        const w = createWorld(4, 4);
        setItem(w, 1, 0, 'key_red');
        const s = createState(w);
        const next = step(w, s, INPUT_E);
        expect(next.inventory.has('key_red')).toBe(true);
    });
});

describe('detectStepEvents', () => {
    function makeWorld({ exit = { x: 3, y: 3 }, items = {} } = {}) {
        const w = createWorld(4, 4, { exit });
        for (const [key, id] of Object.entries(items)) {
            const [x, y] = key.split(',').map(Number);
            setItem(w, x, y, id);
        }
        return w;
    }

    it('returns empty when oldPos === newPos', () => {
        const w = makeWorld();
        const events = detectStepEvents(w, { x: 1, y: 1 }, { x: 1, y: 1 }, new Set());
        expect(events).toEqual([]);
    });

    it('emits a pickup when the player moves onto an uncollected item', () => {
        const w = makeWorld({ items: { '1,0': 'key_red' } });
        const events = detectStepEvents(w, { x: 0, y: 0 }, { x: 1, y: 0 }, new Set());
        expect(events).toEqual([
            { type: 'pickup', itemId: 'key_red', position: { x: 1, y: 0 } },
        ]);
    });

    it('emits a pickup even when the item id is already in inventory', () => {
        // Multi-instance items (Adventure has 12 Freeincarnates):
        // each location holding the same item id needs its own
        // pickup event so user:locationCheck fires for every visit
        // until that specific location's been checked. Per-location
        // idempotency is enforced by the panel via stateManager's
        // checkedLocations, not by detectStepEvents.
        const w = makeWorld({ items: { '1,0': 'key_red' } });
        const events = detectStepEvents(w, { x: 0, y: 0 }, { x: 1, y: 0 }, new Set(['key_red']));
        expect(events).toEqual([
            { type: 'pickup', itemId: 'key_red', position: { x: 1, y: 0 } },
        ]);
    });

    it('emits exit_cross when stepping onto the exit tile', () => {
        const w = makeWorld({ exit: { x: 3, y: 3 } });
        const events = detectStepEvents(w, { x: 2, y: 3 }, { x: 3, y: 3 }, new Set());
        expect(events).toEqual([
            { type: 'exit_cross', exit_id: 'exit', position: { x: 3, y: 3 } },
        ]);
    });

    it('does not emit exit_cross when stepping off the exit tile', () => {
        const w = makeWorld({ exit: { x: 3, y: 3 } });
        const events = detectStepEvents(w, { x: 3, y: 3 }, { x: 2, y: 3 }, new Set());
        expect(events).toEqual([]);
    });

    it('emits exit_cross when stepping between two ADJACENT exit tiles', () => {
        // Regression: apcalc's hub-spoke regions place a back-exit and
        // a forward exit on adjacent tiles (Region 1 has its
        // back-exit-to-Region-16 at (7,2) and its exit-to-C at (7,1)).
        // The bot spawns on the back-exit tile, then the next-leg
        // walkTo lands on the forward exit tile. Without firing a
        // cross when both old and new positions are exits, the second
        // cross silently drops and the visualizer idles forever.
        const w = createWorld(4, 4, {
            exits: [
                { exit_id: 'back', x: 0, y: 0, targetRegion: 'Hub' },
                { exit_id: 'forward', x: 1, y: 0, targetRegion: 'Next' },
            ],
        });
        const events = detectStepEvents(w, { x: 0, y: 0 }, { x: 1, y: 0 }, new Set());
        expect(events).toEqual([
            { type: 'exit_cross', exit_id: 'forward', position: { x: 1, y: 0 } },
        ]);
    });

    it('does not refire exit_cross for an in-place step on the same exit', () => {
        // Pure defensive: detectStepEvents short-circuits zero-movement
        // already, but the new condition's identity check should also
        // not fire spuriously even in pathological "moved but stayed"
        // scenarios.
        const w = createWorld(4, 4, {
            exits: [{ exit_id: 'wide', x: 1, y: 0, targetRegion: 'Other' }],
        });
        // Hypothetical: visualizer reports a step from one exit-tile
        // position to the same exit-tile position. Our identity check
        // matches by exit_id, so no cross fires.
        const events = detectStepEvents(w, { x: 1, y: 0 }, { x: 1, y: 0 }, new Set());
        expect(events).toEqual([]);
    });

    it('emits both pickup and exit_cross when an item sits on the exit tile', () => {
        // Edge case: maze generator avoids putting items on the exit
        // tile, but the helper should be robust if a substrate ever
        // produces such a world.
        const w = makeWorld({ exit: { x: 3, y: 3 }, items: { '3,3': 'goal_token' } });
        const events = detectStepEvents(w, { x: 2, y: 3 }, { x: 3, y: 3 }, new Set());
        expect(events).toContainEqual({ type: 'pickup', itemId: 'goal_token', position: { x: 3, y: 3 } });
        expect(events).toContainEqual({ type: 'exit_cross', exit_id: 'exit', position: { x: 3, y: 3 } });
    });
});

describe('BFS on obstacle-gated worlds', () => {
    it('finds a path that grabs the key before the door', () => {
        // 4x1 corridor: entrance at (0,0), door at (2,0), exit at (3,0),
        // key at (1,0). Player must step E to pick up key, then pass door.
        const w = createWorld(4, 2, {
            entrance: { x: 0, y: 0 }, exit: { x: 3, y: 0 },
        });
        setItem(w, 1, 0, 'key_red');
        setObstacle(w, 2, 0, 'door_red');
        const r = reach(w, bfsSolver, createState(w), reachedExit);
        expect(r.ok).toBe(true);
    });

    it('reports unreachable when the key is placed behind its own door', () => {
        const w = createWorld(5, 2, {
            entrance: { x: 0, y: 0 }, exit: { x: 4, y: 0 },
        });
        // Wall off the upper row so there's a single corridor.
        setTile(w, 0, 1, TILE_WALL);
        setTile(w, 1, 1, TILE_WALL);
        setTile(w, 2, 1, TILE_WALL);
        setTile(w, 3, 1, TILE_WALL);
        setTile(w, 4, 1, TILE_WALL);
        setObstacle(w, 2, 0, 'door_red');
        setItem(w, 3, 0, 'key_red');
        const r = reach(w, bfsSolver, createState(w), reachedExit);
        expect(r.ok).toBe(false);
    });
});

describe('reach + bfsSolver', () => {
    it('returns ok with empty plan when already at the goal', () => {
        const w = createWorld(3, 3, { entrance: { x: 1, y: 1 }, exit: { x: 1, y: 1 } });
        const r = reach(w, bfsSolver, createState(w), reachedExit);
        expect(r.ok).toBe(true);
        expect(r.plan).toEqual([]);
        expect(r.steps).toBe(0);
    });

    it('finds a shortest path on an open grid', () => {
        const w = createWorld(5, 5);
        const r = reach(w, bfsSolver, createState(w), reachedExit);
        expect(r.ok).toBe(true);
        // Manhattan distance from (0,0) to (4,4)
        expect(r.steps).toBe(8);
        const final = runPlan(w, createState(w), r.plan);
        const exit = getDefaultExit(w);
        expect(final.player_pos).toEqual({ x: exit.x, y: exit.y });
    });

    it('returns unreachable when the exit is walled off', () => {
        const w = createWorld(3, 3);
        // Box the exit at (2,2) off from the rest of the grid
        setTile(w, 2, 1, TILE_WALL);
        setTile(w, 1, 2, TILE_WALL);
        const r = reach(w, bfsSolver, createState(w), reachedExit);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('unreachable');
    });

    it('respects the budget option', () => {
        const w = createWorld(10, 10);
        const r = reach(w, bfsSolver, createState(w), reachedExit, { budget: 1 });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('budget_exceeded');
    });

    it('routes around walls', () => {
        const w = createWorld(3, 3);
        // Wall along y=0 row except entrance column, forcing detour
        setTile(w, 1, 0, TILE_WALL);
        const r = reach(w, bfsSolver, createState(w), reachedExit);
        expect(r.ok).toBe(true);
        const final = runPlan(w, createState(w), r.plan);
        const exit = getDefaultExit(w);
        expect(final.player_pos).toEqual({ x: exit.x, y: exit.y });
    });
});

describe('apply / undo', () => {
    it('round-trips a wall add', () => {
        const w = createWorld(4, 4);
        const token = apply(w, { type: 'add_wall', x: 2, y: 2 });
        expect(getTile(w, 2, 2)).toBe(TILE_WALL);
        undo(w, token);
        expect(getTile(w, 2, 2)).toBe(TILE_FLOOR);
    });

    it('round-trips a wall remove', () => {
        const w = createWorld(4, 4);
        setTile(w, 2, 2, TILE_WALL);
        const token = apply(w, { type: 'remove_wall', x: 2, y: 2 });
        expect(getTile(w, 2, 2)).toBe(TILE_FLOOR);
        undo(w, token);
        expect(getTile(w, 2, 2)).toBe(TILE_WALL);
    });

    it('stacks multiple edits and undoes in reverse', () => {
        const w = createWorld(3, 3);
        const t1 = apply(w, { type: 'add_wall', x: 0, y: 1 });
        const t2 = apply(w, { type: 'add_wall', x: 1, y: 1 });
        const t3 = apply(w, { type: 'add_wall', x: 2, y: 1 });
        expect(isFloor(w, 1, 1)).toBe(false);
        undo(w, t3);
        undo(w, t2);
        undo(w, t1);
        for (let y = 0; y < 3; y++) {
            for (let x = 0; x < 3; x++) {
                expect(getTile(w, x, y)).toBe(TILE_FLOOR);
            }
        }
    });

    it('throws on unknown edit type', () => {
        const w = createWorld(3, 3);
        expect(() => apply(w, { type: 'nuke', x: 0, y: 0 })).toThrow();
    });
});

describe('clockwisePerimeterTiles', () => {
    it('walks E → S → W → N skipping corners with no duplicates', () => {
        const tiles = clockwisePerimeterTiles(4, 3);
        // Corner-excluded perimeter for 4×3 is 2*(4-2) + 2*(3-2) = 6.
        // Corner exclusion keeps exits/entrances unambiguous about
        // which side they belong to.
        expect(tiles).toHaveLength(6);
        // First tile is on the E side, one row below the top corner.
        expect(tiles[0]).toEqual({ x: 3, y: 1, side: 'E' });
        // Sides advance E → S → W → N (clockwise).
        const sideOrder = tiles.map((t) => t.side);
        const firstS = sideOrder.indexOf('S');
        const firstW = sideOrder.indexOf('W');
        const firstN = sideOrder.indexOf('N');
        expect(firstS).toBeGreaterThan(0);
        expect(firstW).toBeGreaterThan(firstS);
        expect(firstN).toBeGreaterThan(firstW);
        // No duplicates — every (x,y) appears exactly once.
        const keys = new Set(tiles.map((t) => `${t.x},${t.y}`));
        expect(keys.size).toBe(tiles.length);
        // No corners present.
        const cornerKeys = new Set(['0,0', '0,2', '3,0', '3,2']);
        for (const t of tiles) expect(cornerKeys.has(`${t.x},${t.y}`)).toBe(false);
    });

    it('returns no tiles for a 2×2 region (corners only)', () => {
        // Every cell of a 2×2 is a corner; corner exclusion leaves
        // nothing usable. Callers in the substrate path require a
        // minimum 3×3 (topDownRegionSize bakes that in).
        expect(clockwisePerimeterTiles(2, 2)).toHaveLength(0);
    });

    it('returns just one tile per side for a 3×3 region', () => {
        const tiles = clockwisePerimeterTiles(3, 3);
        // 3×3 has exactly one non-corner tile per side: the midpoint.
        expect(tiles).toHaveLength(4);
        expect(tiles).toEqual([
            { x: 2, y: 1, side: 'E' },
            { x: 1, y: 2, side: 'S' },
            { x: 0, y: 1, side: 'W' },
            { x: 1, y: 0, side: 'N' },
        ]);
    });
});

describe('generateRegionCore', () => {
    const baseCoreInput = () => ({
        region_id: 'r1',
        size: { width: 10, height: 8 },
        entrances: [{ side: 'W', tile: { x: 0, y: 3 } }],
        exits: [{ side: 'E' }],
        rng: createRng(7),
        params: {},
    });

    it('rejects missing required fields', () => {
        expect(() => generateRegionCore({ ...baseCoreInput(), region_id: undefined })).toThrow(/region_id/);
        expect(() => generateRegionCore({ ...baseCoreInput(), size: undefined })).toThrow(/size/);
        expect(() => generateRegionCore({ ...baseCoreInput(), rng: undefined })).toThrow(/rng/);
    });

    it('accepts exits: [] (terminal region — caller adds back-exit later)', () => {
        const out = generateRegionCore({ ...baseCoreInput(), exits: [] });
        expect(out.world.exits.size).toBe(0);
        expect(out.exits_placed).toEqual([]);
    });

    it('rejects multiple entrances in v1 (multi-entrance is a growth path)', () => {
        expect(() => generateRegionCore({
            ...baseCoreInput(),
            entrances: [{ side: 'W', tile: { x: 0, y: 3 } }, { side: 'N', tile: { x: 5, y: 0 } }],
        })).toThrow(/entrance/);
    });

    it('accepts multiple exits and emits one entry per placed border tile', () => {
        const out = generateRegionCore({
            ...baseCoreInput(),
            exits: [{ side: 'E' }, { side: 'S' }],
        });
        expect(out.exits_placed).toHaveLength(2);
        expect(out.world.exits.size).toBe(2);
        // Both placed tiles are at distinct positions on the requested sides.
        const sides = out.exits_placed.map((e) => e.side).sort();
        expect(sides).toEqual(['E', 'S']);
    });

    it('empty entrances array triggers the start-region center placement', () => {
        const out = generateRegionCore({ ...baseCoreInput(), entrances: [] });
        expect(out.world.entrance).toEqual({ x: 5, y: 4 });
    });

    it('child region requires entrance.tile on the supplied entrance', () => {
        expect(() => generateRegionCore({
            ...baseCoreInput(),
            entrances: [{ side: 'W' }],
        })).toThrow(/entrance tile/);
    });

    it('produces a walls-only world with libs threaded', () => {
        const out = generateRegionCore(baseCoreInput());
        expect(out.world.obstacles.size).toBe(0);
        expect(out.world.items.size).toBe(0);
        expect(out.world.obstacleLib.door_red).toBeDefined();
        expect(out.world.itemLib.key_red).toBeDefined();
        expect(out.exits_placed[0].side).toBe('E');
        expect(out.exits_placed[0].tile_position.x).toBe(out.world.width - 1);
    });

    it('assigns clockwise from east when exits omit a side', () => {
        // No spec.side on any exit → substrate walks the perimeter
        // clockwise from E (skipping corners) and assigns each exit
        // to the next free slot. Exits are deterministic for a fixed-
        // seed rng.
        const out = generateRegionCore({
            ...baseCoreInput(),
            entrances: [{ side: 'W', tile: { x: 0, y: 3 } }],
            exits: [{}, {}, {}],
        });
        expect(out.exits_placed).toHaveLength(3);
        // First clockwise non-corner tile is one row below the top-
        // right corner — first exit lands there, on side E.
        expect(out.exits_placed[0].tile_position).toEqual({ x: out.world.width - 1, y: 1 });
        expect(out.exits_placed[0].side).toBe('E');
        // Subsequent exits sit later in the clockwise walk; their
        // sides advance E → S → W → N as the perimeter rolls over.
        expect(out.exits_placed[1].tile_position.x).toBe(out.world.width - 1);
        expect(out.exits_placed[1].side).toBe('E');
    });

    it('mixes specified sides with clockwise (cursor advances after each clockwise placement)', () => {
        // First exit sits on the W side via random-on-side; second
        // (no side) starts the clockwise walk fresh from E.
        const out = generateRegionCore({
            ...baseCoreInput(),
            entrances: [{ side: 'N', tile: { x: 5, y: 0 } }],
            exits: [{ side: 'W' }, {}],
        });
        expect(out.exits_placed).toHaveLength(2);
        expect(out.exits_placed[0].side).toBe('W');
        expect(out.exits_placed[1].side).toBe('E');
    });

    it('preserves caller-supplied exit_id and AP metadata fields', () => {
        const out = generateRegionCore({
            ...baseCoreInput(),
            exits: [
                { exit_id: 'east_door', side: 'E', exitName: 'east_door', targetRegion: 'r2' },
                { exit_id: 'south_door', exitName: 'south_door', targetRegion: 'r3' },
            ],
        });
        const ids = out.exits_placed.map((e) => e.exit_id).sort();
        expect(ids).toEqual(['east_door', 'south_door']);
        const eastWorldExit = out.world.exits.get('east_door');
        expect(eastWorldExit.exitName).toBe('east_door');
        expect(eastWorldExit.targetRegion).toBe('r2');
    });

    it('grows the region when the current size cannot fit all exits', () => {
        // Tight 3×3 region has perimeter 8 tiles; with the entrance
        // claiming one and 8 more exits requested, capacity is
        // exhausted and the substrate must auto-grow.
        const out = generateRegionCore({
            region_id: 'tight',
            size: { width: 3, height: 3 },
            entrances: [{ side: 'W', tile: { x: 0, y: 1 } }],
            // Eight unsided exits — needs more perimeter than 3×3 has.
            exits: [{}, {}, {}, {}, {}, {}, {}, {}],
            rng: createRng(11),
            params: {},
        });
        // Region grew: width and height are at least one grow-step
        // larger than the input (REGION_GROW_STEP=2).
        expect(out.world.width).toBeGreaterThan(3);
        expect(out.world.height).toBeGreaterThan(3);
        expect(out.exits_placed).toHaveLength(8);
        expect(out.size_used).toEqual({ width: out.world.width, height: out.world.height });
    });

    it('reports grow_telemetry — initial size with no growth', () => {
        const out = generateRegionCore({
            region_id: 'fits',
            size: { width: 8, height: 6 },
            entrances: [{ side: 'W', tile: { x: 0, y: 3 } }],
            exits: [{ side: 'E' }],
            rng: createRng(2),
            params: {},
        });
        expect(out.grow_telemetry).toEqual({
            requested_size: { width: 8, height: 6 },
            final_size: { width: 8, height: 6 },
            grow_attempts: 0,
        });
    });

    it('reports grow_telemetry — initial size with one or more growths', () => {
        const out = generateRegionCore({
            region_id: 'tight',
            size: { width: 3, height: 3 },
            entrances: [{ side: 'W', tile: { x: 0, y: 1 } }],
            exits: [{}, {}, {}, {}, {}, {}, {}, {}],
            rng: createRng(11),
            params: {},
        });
        expect(out.grow_telemetry.requested_size).toEqual({ width: 3, height: 3 });
        expect(out.grow_telemetry.grow_attempts).toBeGreaterThan(0);
        expect(out.grow_telemetry.final_size.width).toBe(out.world.width);
        expect(out.grow_telemetry.final_size.height).toBe(out.world.height);
    });

    it('throws when even max-grow can not fit all exits', () => {
        // Far more exits than even the grown region's perimeter
        // could ever hold for the bounded number of grow attempts.
        expect(() => generateRegionCore({
            region_id: 'impossible',
            size: { width: 3, height: 3 },
            entrances: [{ side: 'W', tile: { x: 0, y: 1 } }],
            exits: new Array(200).fill({}),
            rng: createRng(7),
            params: {},
        })).toThrow(/cannot place/);
    });
});

describe('deriveSingleKeyGatePairs', () => {
    it('extracts pairs from the default obstacle library', () => {
        const pairs = deriveSingleKeyGatePairs(DEFAULT_OBSTACLES);
        const ids = pairs.map((p) => `${p.key_id}->${p.door_id}`).sort();
        expect(ids).toEqual([
            'key_blue->door_blue',
            'key_green->door_green',
            'key_orange->door_orange',
            'key_purple->door_purple',
            'key_red->door_red',
            'key_yellow->door_yellow',
        ]);
    });

    it('discovers custom-named pairs (non-color metaphor)', () => {
        const lib = {
            barrier_lava: {
                clear_set_type: 'combo_list',
                clear_set: [['gem_volcanic']],
            },
            padlock: {
                clear_set_type: 'combo_list',
                clear_set: [['skeleton_key']],
            },
        };
        const pairs = deriveSingleKeyGatePairs(lib);
        expect(pairs).toEqual([
            { key_id: 'gem_volcanic', door_id: 'barrier_lava' },
            { key_id: 'skeleton_key', door_id: 'padlock' },
        ]);
    });

    it('skips multi-key combo gates (left to logic-gate path)', () => {
        const lib = {
            door_red: { clear_set_type: 'combo_list', clear_set: [['key_red']] },
            // Two combos (OR) — not a single-key gate.
            door_either: { clear_set_type: 'combo_list', clear_set: [['key_a'], ['key_b']] },
            // One combo with two items (AND) — not a single-key gate.
            door_both: { clear_set_type: 'combo_list', clear_set: [['key_a', 'key_b']] },
            // Logic-gate (rule-based) — different clear_set_type entirely.
            logic_gate: { clear_set_type: 'rule', clear_rule: null },
        };
        const pairs = deriveSingleKeyGatePairs(lib);
        expect(pairs).toEqual([{ key_id: 'key_red', door_id: 'door_red' }]);
    });

    it('handles an empty library without throwing', () => {
        expect(deriveSingleKeyGatePairs({})).toEqual([]);
    });
});

describe('placeFromItems', () => {
    const freshCore = (overrides = {}) => generateRegionCore({
        region_id: 'r',
        size: { width: 10, height: 8 },
        entrances: [{ side: 'W', tile: { x: 0, y: 3 } }],
        exits: [{ side: 'E' }],
        rng: createRng(7),
        params: {},
        ...overrides,
    });

    it('rejects missing world or rng', () => {
        const { world } = freshCore();
        expect(() => placeFromItems(null, { rng: createRng(1) })).toThrow(/world/);
        expect(() => placeFromItems(world, {})).toThrow(/rng/);
    });

    it('places nothing when both input lists are empty', () => {
        const { world } = freshCore();
        const out = placeFromItems(world, { rng: createRng(1) });
        expect(out.placed_items).toEqual([]);
        expect(out.placed_obstacles).toEqual([]);
    });

    it('places a key/door pair and reports the placements', () => {
        const { world } = freshCore();
        const out = placeFromItems(world, {
            items_to_place: ['key_red'],
            obstacles_to_place: ['door_red'],
            rng: createRng(1),
        });
        expect(out.placed_items).toHaveLength(1);
        expect(out.placed_obstacles).toHaveLength(1);
        // The placed positions should also be reflected in world state.
        expect(getObstacle(world, out.placed_obstacles[0].position.x, out.placed_obstacles[0].position.y))
            .toBe('door_red');
        expect(getItem(world, out.placed_items[0].position.x, out.placed_items[0].position.y))
            .toBe('key_red');
    });

    it('places a green and a blue pair independently', () => {
        const { world } = freshCore({ size: { width: 14, height: 10 } });
        const out = placeFromItems(world, {
            items_to_place: ['key_green', 'key_blue'],
            obstacles_to_place: ['door_green', 'door_blue'],
            rng: createRng(3),
        });
        const itemIds = out.placed_items.map((p) => p.item_id).sort();
        const obstacleIds = out.placed_obstacles.map((p) => p.obstacle_id).sort();
        expect(itemIds).toEqual(['key_blue', 'key_green']);
        expect(obstacleIds).toEqual(['door_blue', 'door_green']);
    });

    it('places a pair from a custom obstacle library entry (not red/green/blue)', () => {
        // Add a "yellow" pair via a custom library; the substrate
        // should auto-discover it from the obstacle's clear_set rather
        // than relying on a hardcoded color list.
        const itemLib = {
            key_yellow: { id: 'key_yellow', classification: 'progression' },
        };
        const obstacleLib = {
            door_yellow: {
                id: 'door_yellow',
                clear_set_type: 'combo_list',
                clear_set: [['key_yellow']],
            },
        };
        const { world } = freshCore({ item_lib: itemLib, obstacle_lib: obstacleLib });
        const out = placeFromItems(world, {
            items_to_place: ['key_yellow'],
            obstacles_to_place: ['door_yellow'],
            rng: createRng(1),
        });
        expect(out.placed_items.map((p) => p.item_id)).toEqual(['key_yellow']);
        expect(out.placed_obstacles.map((p) => p.obstacle_id)).toEqual(['door_yellow']);
    });

    it('places extra unpaired items on reachable floor tiles', () => {
        const { world } = freshCore();
        const out = placeFromItems(world, {
            items_to_place: ['key_red', 'key_red'],
            obstacles_to_place: ['door_red'],
            rng: createRng(5),
        });
        // One key pairs with the door; the second key lands elsewhere.
        expect(out.placed_items.length).toBeGreaterThanOrEqual(1);
        expect(out.placed_obstacles.map((p) => p.obstacle_id)).toEqual(['door_red']);
    });
});

describe('extractPathsAndObstacles', () => {
    it('emits a single exit and no locations for a plain walls-only maze', () => {
        const w = createWorld(4, 4);
        const result = extractPathsAndObstacles(w);
        expect(result.entrance).toEqual({ x: 0, y: 0 });
        expect(result.locations).toEqual([]);
        expect(result.exits.length).toBe(1);
        expect(result.exits[0].id).toBe('exit');
        expect(result.exits[0].target_region).toBeNull();
        expect(result.exits[0].paths).toEqual([{ path_id: 'p1', obstacles: [] }]);
    });

    it('lists obstacles along a gated path', () => {
        const w = createWorld(4, 2, { entrance: { x: 0, y: 0 }, exit: { x: 3, y: 0 } });
        setItem(w, 1, 0, 'key_red');
        setObstacle(w, 2, 0, 'door_red');
        const result = extractPathsAndObstacles(w);
        const exit = result.exits.find((e) => e.id === 'exit');
        expect(exit.paths).toEqual([{ path_id: 'p1', obstacles: ['door_red'] }]);
        const key = result.locations.find((l) => l.id === 'key_red_pickup');
        expect(key.item).toBe('key_red');
        expect(key.paths).toEqual([{ path_id: 'p1', obstacles: [] }]);
    });

    it('still annotates the path even when the player cannot currently clear the obstacles', () => {
        // The generated paths-and-obstacles form reflects geometry, not
        // solvability under the current inventory.
        const w = createWorld(4, 2, { entrance: { x: 0, y: 0 }, exit: { x: 3, y: 0 } });
        setObstacle(w, 2, 0, 'door_red');
        const result = extractPathsAndObstacles(w);
        const exit = result.exits.find((e) => e.id === 'exit');
        expect(exit.paths[0].obstacles).toEqual(['door_red']);
    });

    it('on a generated maze, the exit path lists door_red and the key path is empty', () => {
        const { world, stats } = generateMaze({ width: 10, height: 8, seed: 17 });
        expect(stats.gateKeyPlaced).toBe(true);
        const result = extractPathsAndObstacles(world);
        const exit = result.exits.find((e) => e.id === 'exit');
        const key = result.locations.find((l) => l.id === 'key_red_pickup');
        expect(exit.paths[0].obstacles).toContain('door_red');
        expect(key.paths[0].obstacles).toEqual([]);
    });

    it('accepts a regionId override', () => {
        const w = createWorld(3, 3);
        const result = extractPathsAndObstacles(w, { regionId: 'forest_entrance' });
        expect(result.region_id).toBe('forest_entrance');
    });
});

describe('placeFromRules', () => {
    const freshCore = (overrides = {}) => generateRegionCore({
        region_id: 'r1',
        size: { width: 10, height: 8 },
        entrances: [{ side: 'W', tile: { x: 0, y: 3 } }],
        exits: [{ side: 'E' }],
        rng: createRng(7),
        params: {},
        ...overrides,
    });

    it('rejects missing world or rng', () => {
        const { world } = freshCore();
        expect(() => placeFromRules(null, { rng: createRng(1) })).toThrow(/world/);
        expect(() => placeFromRules(world, {})).toThrow(/rng/);
    });

    it('throws when an exit_rule references an unknown exit_id', () => {
        const { world } = freshCore();
        expect(() => placeFromRules(world, {
            // freshCore produces a single exit with id 'exit'; 'phantom'
            // does not exist on the world.
            exit_rules: { phantom: { rule: 'True_' } },
            rng: createRng(1),
        })).toThrow(/unknown exit_id/);
    });

    it('places nothing when inputs are empty', () => {
        const { world } = freshCore();
        const out = placeFromRules(world, { rng: createRng(1) });
        expect(out.placed_logic_gates).toEqual([]);
        expect(out.placed_items).toEqual([]);
        expect(out.placed_locations).toEqual([]);
    });

    it('exit rule round-trips through extract + compile', () => {
        const { world } = freshCore();
        const exitRule = {
            rule: 'Or', children: [
                { rule: 'Has', args: { item_name: 'key_red' } },
                { rule: 'Has', args: { item_name: 'key_blue' } },
            ],
        };
        const out = placeFromRules(world, {
            exit_rules: { exit: exitRule },
            rng: createRng(1),
        });
        // Gate landed on the exit tile.
        expect(out.placed_logic_gates).toHaveLength(1);
        const defaultExit = getDefaultExit(world);
        expect(out.placed_logic_gates[0].position).toEqual({ x: defaultExit.x, y: defaultExit.y });
        expect(getObstacle(world, defaultExit.x, defaultExit.y))
            .toBe(out.placed_logic_gates[0].gate_id);

        // Extracting the region emits the gate on the exit's path.
        const extracted = extractPathsAndObstacles(world, { regionId: 'r1' });
        expect(extracted.exits).toHaveLength(1);
        const exitPaths = extracted.exits[0].paths;
        expect(exitPaths).toHaveLength(1);
        expect(exitPaths[0].obstacles).toEqual([out.placed_logic_gates[0].gate_id]);

        // Compiling emits the supplied rule verbatim.
        const compiled = compileRegion(extracted, { obstacleLib: world.obstacleLib });
        expect(compiled.exits[0].rule).toEqual(exitRule);
    });

    it('location rule places a gate on the item tile and compiles the same rule', () => {
        const { world } = freshCore();
        const locRule = { rule: 'Has', args: { item_name: 'key_red' } };
        const out = placeFromRules(world, {
            location_rules: { loc_boss_hint: locRule },
            item_placements: [{ item_id: 'map', location_id: 'loc_boss_hint' }],
            rng: createRng(1),
        });
        // Both the item and a gate sit on the same location tile.
        expect(out.placed_items).toHaveLength(1);
        expect(out.placed_logic_gates).toHaveLength(1);
        const tile = out.placed_items[0].position;
        expect(out.placed_logic_gates[0].position).toEqual(tile);
        expect(getItem(world, tile.x, tile.y)).toBe('map');

        // Compiled location rule matches input.
        const extracted = extractPathsAndObstacles(world, { regionId: 'r1' });
        const compiled = compileRegion(extracted, { obstacleLib: world.obstacleLib });
        const mapLoc = compiled.locations.find((l) => l.item === 'map');
        expect(mapLoc).toBeDefined();
        expect(mapLoc.rule).toEqual(locRule);
    });

    it('rule-less item placements drop the item with no gate', () => {
        const { world } = freshCore();
        const out = placeFromRules(world, {
            item_placements: [{ item_id: 'map', location_id: 'loc_free' }],
            rng: createRng(1),
        });
        expect(out.placed_items).toHaveLength(1);
        expect(out.placed_logic_gates).toHaveLength(0);
        const tile = out.placed_items[0].position;
        expect(getObstacle(world, tile.x, tile.y)).toBeUndefined();
    });

    it('skips logic gates with rule: True_ on exits (§6)', () => {
        const { world } = freshCore();
        const out = placeFromRules(world, {
            exit_rules: { exit: { rule: 'True_' } },
            rng: createRng(1),
        });
        expect(out.placed_logic_gates).toHaveLength(0);
        // No obstacle on the exit tile either.
        const exit = world.exits.values().next().value;
        expect(getObstacle(world, exit.x, exit.y)).toBeUndefined();
    });

    it('skips the gate but still places the item for True_ location rules (§6)', () => {
        const { world } = freshCore();
        const out = placeFromRules(world, {
            location_rules: { loc_freebie: { rule: 'True_' } },
            item_placements: [{ item_id: 'map', location_id: 'loc_freebie' }],
            rng: createRng(1),
        });
        expect(out.placed_logic_gates).toHaveLength(0);
        expect(out.placed_items).toHaveLength(1);
        expect(out.placed_locations).toHaveLength(1);
        const tile = out.placed_items[0].position;
        expect(getItem(world, tile.x, tile.y)).toBe('map');
        expect(getObstacle(world, tile.x, tile.y)).toBeUndefined();
    });

    it('per-instance gate ids are scoped to the region (no lib mutation leak)', () => {
        const sharedLib = { ...DEFAULT_OBSTACLES };
        const { world: worldA } = freshCore({ rng: createRng(1), region_id: 'A' });
        const { world: worldB } = freshCore({ rng: createRng(2), region_id: 'B' });
        worldA.obstacleLib = sharedLib;
        worldB.obstacleLib = sharedLib;
        placeFromRules(worldA, {
            exit_rules: { exit: { rule: 'Has', args: { item_name: 'key_red' } } },
            rng: createRng(10),
        });
        placeFromRules(worldB, {
            exit_rules: { exit: { rule: 'Has', args: { item_name: 'key_blue' } } },
            rng: createRng(11),
        });
        // The shared lib is untouched; each world has its own copy with
        // its own gate entries.
        expect(sharedLib.logic_gate_0).toBeUndefined();
        expect(worldA.obstacleLib.logic_gate_0).toBeDefined();
        expect(worldB.obstacleLib.logic_gate_0).toBeDefined();
        expect(worldA.obstacleLib.logic_gate_0.clear_rule).not.toEqual(
            worldB.obstacleLib.logic_gate_0.clear_rule,
        );
    });
});

describe('generateMaze', () => {
    it('produces a feasible maze', () => {
        const { world } = generateMaze({ width: 8, height: 8, seed: 42 });
        const r = reach(world, bfsSolver, createState(world), reachedExit);
        expect(r.ok).toBe(true);
    });

    it('leaves entrance and exit as floor', () => {
        const { world } = generateMaze({ width: 8, height: 8, seed: 42 });
        expect(getTile(world, world.entrance.x, world.entrance.y)).toBe(TILE_FLOOR);
        const exit = getDefaultExit(world);
        expect(getTile(world, exit.x, exit.y)).toBe(TILE_FLOOR);
    });

    it('is deterministic for the same seed', () => {
        const a = generateMaze({ width: 10, height: 10, seed: 123 });
        const b = generateMaze({ width: 10, height: 10, seed: 123 });
        expect(Array.from(a.world.tiles)).toEqual(Array.from(b.world.tiles));
        expect(a.stats).toEqual(b.stats);
    });

    it('produces different output for different seeds', () => {
        const a = generateMaze({ width: 10, height: 10, seed: 1 });
        const b = generateMaze({ width: 10, height: 10, seed: 2 });
        expect(Array.from(a.world.tiles)).not.toEqual(Array.from(b.world.tiles));
    });

    it('accepts at least one wall on a reasonable grid', () => {
        const { stats } = generateMaze({
            width: 10, height: 10, seed: 7,
            params: { maxIterations: 500, stallLimit: 100 },
        });
        expect(stats.accepted).toBeGreaterThan(0);
    });

    it('rejected count equals rejectedFeasibility (no other rejection sources)', () => {
        const { stats } = generateMaze({
            width: 10, height: 10, seed: 5,
            params: { maxIterations: 300, stallLimit: 60 },
        });
        expect(stats.rejected).toBe(stats.rejectedFeasibility);
    });

    it('feasibility-only generation is deterministic for a fixed seed', () => {
        const cfg = {
            width: 8, height: 8, seed: 11,
            params: { maxIterations: 400, stallLimit: 80 },
        };
        const a = generateMaze(cfg);
        const b = generateMaze(cfg);
        expect(Array.from(a.world.tiles)).toEqual(Array.from(b.world.tiles));
        expect(a.stats).toEqual(b.stats);
    });

    it('places a gate-and-key pair by default and keeps the maze solvable', () => {
        const { world, stats } = generateMaze({ width: 10, height: 8, seed: 17 });
        expect(stats.gateKeyPlaced).toBe(true);
        expect(stats.doorPos).not.toBeNull();
        expect(stats.keyPos).not.toBeNull();
        expect(getObstacle(world, stats.doorPos.x, stats.doorPos.y)).toBe('door_red');
        expect(getItem(world, stats.keyPos.x, stats.keyPos.y)).toBe('key_red');
        // Reachable with key, not reachable without — but bfsSolver will
        // pick up the key en route, so just confirm the positive case.
        const solved = reach(world, bfsSolver, createState(world), reachedExit);
        expect(solved.ok).toBe(true);
    });

    it('door is on the critical path: exit unreachable without the key', () => {
        const { world, stats } = generateMaze({ width: 10, height: 8, seed: 17 });
        expect(stats.gateKeyPlaced).toBe(true);
        // Temporarily remove the key so we can test the gate.
        const keyId = getItem(world, stats.keyPos.x, stats.keyPos.y);
        world.items.delete(`${stats.keyPos.x},${stats.keyPos.y}`);
        const r = reach(world, bfsSolver, createState(world), reachedExit);
        expect(r.ok).toBe(false);
        // Restore
        setItem(world, stats.keyPos.x, stats.keyPos.y, keyId);
    });

    it('placeGateAndKey=false leaves the maze walls-only', () => {
        const { world, stats } = generateMaze({
            width: 8, height: 8, seed: 1, params: { placeGateAndKey: false },
        });
        expect(stats.gateKeyPlaced).toBe(false);
        expect(stats.gateKeyReason).toBe('disabled');
        expect(world.obstacles.size).toBe(0);
        expect(world.items.size).toBe(0);
    });

    it('door is always a cut vertex across many seeds (regression)', () => {
        let bypassable = 0, placed = 0;
        for (let seed = 1; seed <= 20; seed++) {
            const { world, stats } = generateMaze({
                width: 12, height: 10, seed,
            });
            if (!stats.gateKeyPlaced) continue;
            placed += 1;
            // Remove the key — exit should then be unreachable.
            world.items.delete(`${stats.keyPos.x},${stats.keyPos.y}`);
            const r = reach(world, bfsSolver, createState(world), reachedExit);
            if (r.ok) bypassable += 1;
        }
        expect(placed).toBeGreaterThan(15);
        expect(bypassable).toBe(0);
    }, 30000);

    it('gate-and-key placement is deterministic for a fixed seed', () => {
        const a = generateMaze({ width: 10, height: 8, seed: 17 });
        const b = generateMaze({ width: 10, height: 8, seed: 17 });
        expect(a.stats.doorPos).toEqual(b.stats.doorPos);
        expect(a.stats.keyPos).toEqual(b.stats.keyPos);
    });

    it('every exit reachable from entrance with multiple exits (regression)', () => {
        // Pre-fix: feasibility check accepted walls if *any* exit was
        // BFS-reachable. With multi-exit input the walker biased toward
        // one exit and walls were freely placed isolating others. After
        // wallOffUnusedExits stripped the still-reachable exit, the
        // surviving exit could end up unreachable, compiling to False_.
        // Repro: 8x6 with N + E exits across many seeds.
        let unreachable = 0, total = 0;
        for (let seed = 1; seed <= 30; seed++) {
            const { world } = generateMaze({
                width: 8, height: 6, seed,
                exits: [
                    { exit_id: 'exit_n', side: 'N', x: 2, y: 0 },
                    { exit_id: 'exit_e', side: 'E', x: 7, y: 3 },
                ],
                entrance: { x: 4, y: 3 },
                params: { placeGateAndKey: false },
            });
            for (const e of world.exits.values()) {
                total += 1;
                const r = reach(world, bfsSolver, createState(world),
                    (s) => s.player_pos.x === e.x && s.player_pos.y === e.y);
                if (!r.ok) unreachable += 1;
            }
        }
        expect(total).toBe(60);
        expect(unreachable).toBe(0);
    });

    it('terminates on stall_limit when the grid gets crowded', () => {
        const { stats } = generateMaze({
            width: 4, height: 4, seed: 9,
            params: { maxIterations: 10000, stallLimit: 50 },
        });
        // Either stall-terminated or fully-iterated; the grid is small
        // enough that stall is what we expect to see first.
        expect(stats.iterations).toBeLessThanOrEqual(10000);
    });
});

describe('deserializeMazeWorld', () => {
    // Hand-crafted minimal sidecar exercising every field the
    // serializer produces. Round-trip via the real pipeline serializer
    // is tested in procgenPipelineEngine.test.js.
    function makeSidecar(overrides = {}) {
        return {
            width: 4,
            height: 3,
            tiles: [
                TILE_WALL, TILE_WALL, TILE_WALL, TILE_WALL,
                TILE_FLOOR, TILE_FLOOR, TILE_FLOOR, TILE_FLOOR,
                TILE_WALL, TILE_WALL, TILE_WALL, TILE_WALL,
            ],
            entrance: { x: 0, y: 1 },
            exit: { x: 3, y: 1, exitName: 'exit', targetRegion: 'region_1_1' },
            obstacles: [{ x: 1, y: 1, id: 'door_red' }],
            items: [{ x: 2, y: 1, id: 'key_red', locationName: 'region_0_1__key_red_pickup__2_1' }],
            obstacleLib: {},
            ...overrides,
        };
    }

    it('reconstructs tiles as Int8Array of correct length', () => {
        const world = deserializeMazeWorld(makeSidecar());
        expect(world.tiles).toBeInstanceOf(Int8Array);
        expect(world.tiles.length).toBe(12);
        expect(getTile(world, 0, 0)).toBe(TILE_WALL);
        expect(getTile(world, 0, 1)).toBe(TILE_FLOOR);
    });

    it('reconstructs obstacles and items as Maps keyed by "x,y"', () => {
        const world = deserializeMazeWorld(makeSidecar());
        expect(world.obstacles).toBeInstanceOf(Map);
        expect(world.items).toBeInstanceOf(Map);
        expect(getObstacle(world, 1, 1)).toBe('door_red');
        expect(getItem(world, 2, 1)).toBe('key_red');
    });

    it('preserves entrance and exit coordinates', () => {
        const world = deserializeMazeWorld(makeSidecar());
        expect(world.entrance).toEqual({ x: 0, y: 1 });
        const exit = getDefaultExit(world);
        expect(exit.x).toBe(3);
        expect(exit.y).toBe(1);
    });

    it('preserves AP-canonical exitName and targetRegion on each exit', () => {
        const world = deserializeMazeWorld(makeSidecar());
        const exit = getDefaultExit(world);
        expect(exit.exitName).toBe('exit');
        expect(exit.targetRegion).toBe('region_1_1');
    });

    it('preserves AP-canonical locationName per item in world.itemLocationNames', () => {
        const world = deserializeMazeWorld(makeSidecar());
        expect(world.itemLocationNames).toBeInstanceOf(Map);
        expect(world.itemLocationNames.get('2,1')).toBe('region_0_1__key_red_pickup__2_1');
    });

    it('null AP metadata when sidecar omits it (e.g. unstitched exit)', () => {
        const world = deserializeMazeWorld(makeSidecar({
            exit: { x: 3, y: 1 },
            items: [{ x: 2, y: 1, id: 'key_red' }],
        }));
        const exit = getDefaultExit(world);
        expect(exit.exitName).toBeNull();
        expect(exit.targetRegion).toBeNull();
        expect(world.itemLocationNames.has('2,1')).toBe(false);
    });

    it('merges sidecar obstacleLib extras with the base library', () => {
        const customLogicGate = {
            id: 'logic_gate_0',
            clear_set_type: 'rule',
            clear_rule: { rule: 'True_' },
        };
        const world = deserializeMazeWorld(makeSidecar({
            obstacles: [{ x: 1, y: 1, id: 'logic_gate_0' }],
            obstacleLib: { logic_gate_0: customLogicGate },
        }));
        // Base entries still reachable
        expect(world.obstacleLib.door_red).toBeDefined();
        // Sidecar extra reachable
        expect(world.obstacleLib.logic_gate_0).toEqual(customLogicGate);
    });

    it('rejects sidecars with mismatched tiles length', () => {
        expect(() => deserializeMazeWorld(makeSidecar({ tiles: [0, 0, 0] })))
            .toThrow(/tiles length/);
    });

    it('preserves manaEnabled and fogEnabled flags through deserialization (Phase 6h)', () => {
        // Without preservation, the runtime sees `undefined` for both
        // and falls back to legacy behavior — auto-discover everything
        // in TA, ignore the per-region fog override in maze.
        const noFlags = deserializeMazeWorld(makeSidecar());
        expect(noFlags.manaEnabled).toBeUndefined();
        expect(noFlags.fogEnabled).toBeUndefined();

        const both = deserializeMazeWorld(makeSidecar({ manaEnabled: true, fogEnabled: true }));
        expect(both.manaEnabled).toBe(true);
        expect(both.fogEnabled).toBe(true);

        // Each flag rides through independently (decouple-able per Phase 6h-1).
        const onlyFog = deserializeMazeWorld(makeSidecar({ fogEnabled: true }));
        expect(onlyFog.manaEnabled).toBeUndefined();
        expect(onlyFog.fogEnabled).toBe(true);
    });

    it('rejects non-object input', () => {
        expect(() => deserializeMazeWorld(null)).toThrow(/must be an object/);
        expect(() => deserializeMazeWorld(undefined)).toThrow(/must be an object/);
    });
});
