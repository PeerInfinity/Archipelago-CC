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
    getConsumableTile, setConsumableTile, clearConsumableTile,
    getManaTile, setManaTile, clearManaTile,
    getBlock, setBlock, clearBlock,
    getButton, setButton, clearButton,
    serializeMazeEntities, mazeVisitedKey,
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

    it('emits consumable_pickup carrying the grant verbatim (X1)', () => {
        const w = makeWorld();
        const grant = { substrate: 'omsi', type: 'gold', count: 2 };
        setConsumableTile(w, 1, 0, grant);
        const events = detectStepEvents(w, { x: 0, y: 0 }, { x: 1, y: 0 }, new Set());
        expect(events).toEqual([
            { type: 'consumable_pickup', grant, position: { x: 1, y: 0 } },
        ]);
    });

    it('emits mana_pickup carrying the refill amount (X1)', () => {
        const w = makeWorld();
        setManaTile(w, 1, 0, 25);
        const events = detectStepEvents(w, { x: 0, y: 0 }, { x: 1, y: 0 }, new Set());
        expect(events).toEqual([
            { type: 'mana_pickup', amount: 25, position: { x: 1, y: 0 } },
        ]);
    });

    it('emits consumable_pickup on EVERY arrival — respawn is the caller\'s concern (X1-R1)', () => {
        // The engine is stateless about collection, exactly like
        // 'pickup' above. Loop-reset respawn lives in the visualizer's
        // posKey-keyed collected set, not here.
        const w = makeWorld();
        setConsumableTile(w, 1, 0, { substrate: 'jta', type: 'Food', count: 1 });
        const first = detectStepEvents(w, { x: 0, y: 0 }, { x: 1, y: 0 }, new Set());
        const second = detectStepEvents(w, { x: 0, y: 0 }, { x: 1, y: 0 }, new Set());
        expect(second).toEqual(first);
        expect(second).toHaveLength(1);
    });

    it('emits both a pickup and a consumable_pickup when overlays share a tile (X1)', () => {
        const w = makeWorld({ items: { '1,0': 'key_red' } });
        setConsumableTile(w, 1, 0, { substrate: 'omsi', type: 'gold', count: 1 });
        const events = detectStepEvents(w, { x: 0, y: 0 }, { x: 1, y: 0 }, new Set());
        expect(events.map((e) => e.type)).toEqual(['pickup', 'consumable_pickup']);
    });

    it('emits nothing extra on a world with no consumable overlays (X1 byte-inert)', () => {
        const w = makeWorld({ items: { '1,0': 'key_red' } });
        expect(w.consumableTiles.size).toBe(0);
        expect(w.manaTiles.size).toBe(0);
        const events = detectStepEvents(w, { x: 0, y: 0 }, { x: 1, y: 0 }, new Set());
        expect(events).toEqual([
            { type: 'pickup', itemId: 'key_red', position: { x: 1, y: 0 } },
        ]);
    });

    it('tolerates a world lacking the X1 Maps entirely (pre-X1 / library-instantiated)', () => {
        const w = makeWorld({ items: { '1,0': 'key_red' } });
        delete w.consumableTiles;
        delete w.manaTiles;
        expect(() => detectStepEvents(w, { x: 0, y: 0 }, { x: 1, y: 0 }, new Set())).not.toThrow();
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

    it('leaves the X1 overlays empty when the sidecar omits them (byte-inert default)', () => {
        const world = deserializeMazeWorld(makeSidecar());
        expect(world.consumableTiles.size).toBe(0);
        expect(world.manaTiles.size).toBe(0);
    });

    it('reads X1 consumable + mana tiles back off the sidecar', () => {
        const world = deserializeMazeWorld(makeSidecar({
            consumableTiles: [
                { x: 1, y: 1, substrate: 'omsi', type: 'gold', count: 2 },
                { x: 2, y: 1, substrate: 'jta', type: 'Food', count: 1 },
            ],
            manaTiles: [{ x: 3, y: 1, amount: 40 }],
        }));
        expect(getConsumableTile(world, 1, 1)).toEqual({ substrate: 'omsi', type: 'gold', count: 2 });
        expect(getConsumableTile(world, 2, 1)).toEqual({ substrate: 'jta', type: 'Food', count: 1 });
        expect(getManaTile(world, 3, 1)).toBe(40);
        expect(getConsumableTile(world, 0, 1)).toBeUndefined();
    });
});

describe('consumable tile accessors (X1)', () => {
    it('set / get / clear round-trip on both overlays', () => {
        const w = createWorld(4, 4);
        expect(getConsumableTile(w, 1, 1)).toBeUndefined();
        expect(getManaTile(w, 1, 1)).toBeUndefined();

        const grant = { substrate: 'omsi', type: 'gold', count: 3 };
        setConsumableTile(w, 1, 1, grant);
        setManaTile(w, 2, 2, 15);
        expect(getConsumableTile(w, 1, 1)).toBe(grant);
        expect(getManaTile(w, 2, 2)).toBe(15);

        clearConsumableTile(w, 1, 1);
        clearManaTile(w, 2, 2);
        expect(getConsumableTile(w, 1, 1)).toBeUndefined();
        expect(getManaTile(w, 2, 2)).toBeUndefined();
    });

    it('lazily creates the Maps on a world that lacks them', () => {
        // Library-instantiated / hand-authored worlds can predate X1.
        const w = createWorld(4, 4);
        delete w.consumableTiles;
        delete w.manaTiles;
        expect(getConsumableTile(w, 1, 1)).toBeUndefined();
        expect(() => clearConsumableTile(w, 1, 1)).not.toThrow();
        setConsumableTile(w, 1, 1, { substrate: 'jta', type: 'Food', count: 1 });
        setManaTile(w, 1, 2, 5);
        expect(getConsumableTile(w, 1, 1).type).toBe('Food');
        expect(getManaTile(w, 1, 2)).toBe(5);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// PROCGEN ELEMENTS · ARC 2 · SLICE 1 — BLOCKS, BUTTONS AND FLAGS (family A)
//
// The three mechanisms and the one line that separates them:
//   a BLOCK moves when you walk into it,
//   a BUTTON derives a token WHILE something stands on it (a HOLD),
//   a FLAG is an item picked up on arrival and never lost (a LATCH).
// ⚖ design ruling 22 — Seedling's `Button` vs `ButtonRoom`.
// ─────────────────────────────────────────────────────────────────────────

// Build a world from an ASCII picture, so a fixture is READ rather than
// assembled. One character per tile:
//   '#' wall · '.' floor · 'P' entrance · 'X' exit · 'B' block ·
//   'b' button_A · 'D' door_A · 'F' flag_B · 'K' key_red · 'R' door_red
// The libs the pictures need are per-instance entries merged onto the world's
// own copies — ⛔ `shared/procgen/library.js` is not touched by this arc.
const DOOR_A_ENTRY = {
    name: 'Door A', id: 'door_A', clear_set_type: 'combo_list',
    clear_set: [['sw_A']], color: '#4aa3c7',
};
const BUTTON_A_ENTRY = {
    name: 'Button A', id: 'button_A', kind: 'button', holds: 'sw_A',
    color: '#4aa3c7', symbol: 'button',
};
const FLAG_B_ENTRY = {
    name: 'Flag B', id: 'flag_B', kind: 'flag', classification: 'progression',
    color: '#c77a4a', symbol: 'flag',
};

function picture(rows, opts = {}) {
    const height = rows.length;
    const width = rows[0].length;
    let entrance = { x: 0, y: 0 };
    let exit = null;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (rows[y][x] === 'P') entrance = { x, y };
            if (rows[y][x] === 'X') exit = { x, y };
        }
    }
    const w = createWorld(width, height, {
        entrance,
        exits: [{ exit_id: 'exit', ...(exit ?? entrance) }],
    });
    w.obstacleLib = { ...w.obstacleLib, door_A: DOOR_A_ENTRY };
    w.itemLib = { ...w.itemLib, flag_B: FLAG_B_ENTRY };
    w.buttonLib = opts.buttonLib === undefined ? { button_A: BUTTON_A_ENTRY } : opts.buttonLib;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const c = rows[y][x];
            if (c === '#') setTile(w, x, y, TILE_WALL);
            if (c === 'B') setBlock(w, x, y);
            if (c === 'b') setButton(w, x, y, 'button_A');
            if (c === 'D') setObstacle(w, x, y, 'door_A');
            if (c === 'R') setObstacle(w, x, y, 'door_red');
            if (c === 'F') setItem(w, x, y, 'flag_B');
            if (c === 'K') setItem(w, x, y, 'key_red');
        }
    }
    return w;
}

describe('blocks / buttons — the overlays', () => {
    it('createWorld seeds both Maps empty and buttonLib empty', () => {
        const w = createWorld(4, 4);
        expect(w.blocks.size).toBe(0);
        expect(w.buttons.size).toBe(0);
        expect(w.buttonLib).toEqual({});
    });

    it('get/set/clear mirror the item overlay', () => {
        const w = createWorld(4, 4);
        expect(getBlock(w, 1, 1)).toBe(false);
        setBlock(w, 1, 1);
        expect(getBlock(w, 1, 1)).toBe(true);
        clearBlock(w, 1, 1);
        expect(getBlock(w, 1, 1)).toBe(false);

        expect(getButton(w, 2, 2)).toBeUndefined();
        setButton(w, 2, 2, 'button_A');
        expect(getButton(w, 2, 2)).toBe('button_A');
        clearButton(w, 2, 2);
        expect(getButton(w, 2, 2)).toBeUndefined();
    });

    it('tolerates a world that lacks the Maps entirely (pre-arc-2 / hand-authored)', () => {
        const w = createWorld(4, 4);
        delete w.blocks;
        delete w.buttons;
        expect(getBlock(w, 1, 1)).toBe(false);
        expect(getButton(w, 1, 1)).toBeUndefined();
        expect(() => clearBlock(w, 1, 1)).not.toThrow();
        expect(() => clearButton(w, 1, 1)).not.toThrow();
        setBlock(w, 1, 1);
        setButton(w, 2, 2, 'button_A');
        expect(getBlock(w, 1, 1)).toBe(true);
        expect(getButton(w, 2, 2)).toBe('button_A');
    });
});

describe('createState / cloneState with blocks', () => {
    it('omits state.blocks entirely when the world has none (⚖ ruling 5)', () => {
        const w = createWorld(4, 4);
        const s = createState(w);
        expect('blocks' in s).toBe(false);
    });

    it('carries a SORTED array of posKeys when the world has blocks', () => {
        const w = createWorld(5, 5);
        setBlock(w, 3, 1);
        setBlock(w, 1, 2);
        setBlock(w, 2, 1);
        expect(createState(w).blocks).toEqual(['1,2', '2,1', '3,1']);
    });

    it('a push does not mutate the state it was given', () => {
        const w = picture([
            '#####',
            '#P B#',
            '#####',
        ]);
        const s = createState(w);
        const before = s.blocks.slice();
        step(w, step(w, s, INPUT_E), INPUT_E);
        expect(s.blocks).toEqual(before);
        expect(s.player_pos).toEqual({ x: 1, y: 1 });
    });
});

describe('step — pushing a block', () => {
    it('pushes the block one cell along the same delta and both move', () => {
        const w = picture([
            '#####',
            '#PB.#',
            '#####',
        ]);
        const s = step(w, createState(w), INPUT_E);
        expect(s.player_pos).toEqual({ x: 2, y: 1 });
        expect(s.blocks).toEqual(['3,1']);
    });

    it('refuses a push when the cell beyond is a wall', () => {
        const w = picture([
            '####',
            '#PB#',
            '####',
        ]);
        expect(step(w, createState(w), INPUT_E)).toBeNull();
    });

    it('refuses a push when the cell beyond is out of bounds', () => {
        const w = picture([
            '...',
            'PB.',
            '...',
        ]);
        // (1,1) → push east lands the block at (2,1); a second push would send
        // it to (3,1), off the grid.
        const s = step(w, createState(w), INPUT_E);
        expect(s.blocks).toEqual(['2,1']);
        expect(step(w, s, INPUT_E)).toBeNull();
    });

    it('refuses a push when the cell beyond holds another block', () => {
        const w = picture([
            '######',
            '#PBB.#',
            '######',
        ]);
        expect(step(w, createState(w), INPUT_E)).toBeNull();
    });

    it('refuses a push into an UN-cleared obstacle — ⛔ a block does not open a door', () => {
        const w = picture([
            '#####',
            '#PBR#',
            '#####',
        ]);
        expect(step(w, createState(w), INPUT_E)).toBeNull();
    });

    it('allows a push THROUGH a door the PLAYER can already clear', () => {
        const w = picture([
            '######',
            '#PBR.#',
            '######',
        ]);
        const s = createState(w);
        s.inventory.add('key_red');
        const next = step(w, s, INPUT_E);
        expect(next).not.toBeNull();
        expect(next.blocks).toEqual(['3,1']); // the block now sits on the door tile
        expect(next.player_pos).toEqual({ x: 2, y: 1 });
    });

    it('an item under a block is NOT collected, and is collected once the block moves off', () => {
        const w = picture([
            '######',
            '#PBK.#',
            '######',
        ]);
        // Push east: the block lands on the key tile. The player is at (2,1).
        const s1 = step(w, createState(w), INPUT_E);
        expect(s1.blocks).toEqual(['3,1']);
        expect([...s1.inventory]).toEqual([]);
        // Push again: the block leaves the key tile, the player arrives on it.
        const s2 = step(w, s1, INPUT_E);
        expect(s2.blocks).toEqual(['4,1']);
        expect(s2.player_pos).toEqual({ x: 3, y: 1 });
        expect([...s2.inventory]).toEqual(['key_red']);
        // The world's item overlay never moved — the block stood on it.
        expect(getItem(w, 3, 1)).toBe('key_red');
    });

    it('the block state is a function of the SET, not of the order the pushes happened in', () => {
        const w = picture([
            '#####',
            '#P.B#',
            '#..B#',
            '#####',
        ]);
        // Two blocks at (3,1) and (3,2); neither can be pushed (wall beyond),
        // so any route keeps the same set — and the sorted array proves it.
        expect(createState(w).blocks).toEqual(['3,1', '3,2']);
        const viaSouth = step(w, step(w, createState(w), INPUT_S), INPUT_E);
        expect(viaSouth.blocks).toEqual(['3,1', '3,2']);
    });
});

describe('step — a block on the exit tile', () => {
    // ⚖ Decided here: the exit is a cell the player must STAND on, so a block
    // parked on it is a blocked exit UNLESS the player can push it off.
    it('a block pushed ONTO the exit can seal it — the level becomes unsolvable', () => {
        const w = picture([
            '######',
            '#P.BX#',
            '######',
        ]);
        // Approaching the exit at (4,1) means pushing the block at (3,1) onto
        // it, and the cell beyond is wall, so the block can never come off
        // again. ⛓ A finding for slice 3's binding, not a defect here: a block
        // in line with the exit is a way to make an unsolvable level, and the
        // oracle is what catches it — which it does, by name.
        const r = reach(w, bfsSolver, createState(w), reachedExit, { budget: 5000 });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('unreachable');
    });

    it('is unreachable when the block sits on the exit with a wall beyond', () => {
        const w = picture([
            '#####',
            '#P.B#',
            '#####',
        ]);
        setBlock(w, 3, 1);
        w.exits.set('exit', { exit_id: 'exit', x: 3, y: 1, side: null });
        w._exitsByPos = null;
        const r = reach(w, bfsSolver, createState(w), reachedExit, { budget: 5000 });
        expect(r.ok).toBe(false);
    });

    it('is reachable when the block on the exit has floor beyond it', () => {
        const w = picture([
            '######',
            '#P.B.#',
            '######',
        ]);
        w.exits.set('exit', { exit_id: 'exit', x: 3, y: 1, side: null });
        w._exitsByPos = null;
        const r = reach(w, bfsSolver, createState(w), reachedExit, { budget: 5000 });
        expect(r.ok).toBe(true);
        expect(r.plan).toEqual([INPUT_E, INPUT_E]);
    });
});

describe('buttons — the HOLD (⚖ Q2: the player presses too)', () => {
    it('a block pushed onto button_A derives sw_A and door_A becomes passable', () => {
        const w = picture([
            '#####',
            '#PBb#',
            '#..D#',
            '#..##',
            '#####',
        ]);
        // Push east: the block lands on the button at (3,1).
        const held = step(w, createState(w), INPUT_E);
        expect(held.blocks).toEqual(['3,1']);
        // The player walks around to (2,2) and steps east onto door_A (3,2).
        const s = step(w, step(w, held, INPUT_S), INPUT_E);
        expect(s).not.toBeNull();
        expect(s.player_pos).toEqual({ x: 3, y: 2 });
        // ⛔ And the token was never stored — a HOLD, not a LATCH.
        expect([...s.inventory]).toEqual([]);
    });

    it('door_A is shut when nothing stands on button_A', () => {
        const w = picture([
            '#####',
            '#PBb#',
            '#..D#',
            '#..##',
            '#####',
        ]);
        const s = step(w, createState(w), INPUT_S);
        expect(step(w, step(w, s, INPUT_E), INPUT_E)).toBeNull();
    });

    it('pushing the block OFF the button shuts door_A again', () => {
        const w = picture([
            '######',
            '#PBb.#',
            '#..D.#',
            '#....#',
            '######',
        ]);
        const onButton = step(w, createState(w), INPUT_E);
        expect(onButton.blocks).toEqual(['3,1']);          // the button cell
        expect(onButton.player_pos).toEqual({ x: 2, y: 1 });
        // HELD: from (2,2) — a cell that is NOT the button — door_A at (3,2)
        // opens, because the block is standing on button_A.
        expect(runPlan(w, onButton, [INPUT_S, INPUT_E])).not.toBeNull();
        // Push the block off the button to (4,1). Now nothing holds sw_A.
        const off = step(w, onButton, INPUT_E);
        expect(off.blocks).toEqual(['4,1']);
        expect(off.player_pos).toEqual({ x: 3, y: 1 });
        // ⛓ THE PLAYER IS NOW STANDING ON THE BUTTON, so they must step OFF it
        // before the claim means anything — a test that approached the door
        // from the button cell would pass under a mutant that stores the token
        // permanently, because the player's own press would open it.
        expect(runPlan(w, off, [INPUT_W, INPUT_S, INPUT_E])).toBeNull();
    });

    it('the PLAYER standing on button_A presses it too, for exactly the step that leaves it', () => {
        const w = picture([
            '#####',
            '#PbD#',
            '#####',
        ]);
        // (1,1) → (2,1) is the button; the next step east is door_A. At the
        // instant that move is attempted the player is still on the button, so
        // it clears — and step() only ever gates the TARGET tile.
        const onButton = step(w, createState(w), INPUT_E);
        expect(onButton.player_pos).toEqual({ x: 2, y: 1 });
        const throughDoor = step(w, onButton, INPUT_E);
        expect(throughDoor).not.toBeNull();
        expect(throughDoor.player_pos).toEqual({ x: 3, y: 1 });
        // But a door TWO cells from the button is out of reach: the player has
        // left the button by the time the door is the target.
        const w2 = picture([
            '######',
            '#Pb.D#',
            '######',
        ]);
        const s = step(w2, step(w2, createState(w2), INPUT_E), INPUT_E);
        expect(s.player_pos).toEqual({ x: 3, y: 1 });
        expect(step(w2, s, INPUT_E)).toBeNull();
    });

    it('a button whose library entry names no `holds` derives nothing', () => {
        const w = picture([
            '#####',
            '#PBb#',
            '#..D#',
            '#..##',
            '#####',
        ], { buttonLib: { button_A: { kind: 'button' } } });
        const held = step(w, createState(w), INPUT_E);
        expect(step(w, step(w, held, INPUT_S), INPUT_E)).toBeNull();
    });

    it('a button id with no library entry at all derives nothing', () => {
        const w = picture([
            '#####',
            '#PBb#',
            '#..D#',
            '#..##',
            '#####',
        ], { buttonLib: {} });
        const held = step(w, createState(w), INPUT_E);
        expect(step(w, step(w, held, INPUT_S), INPUT_E)).toBeNull();
    });

    it('the derived token is ADDED to an inventoryOverride, which keeps its own semantics', () => {
        const w = picture([
            '######',
            '#PBbR#',
            '######',
        ]);
        // Push the block onto the button; sw_A is held. The override says the
        // player carries key_red — door_red at (4,1) needs it, and the
        // override is still the only source of CARRIED items.
        const held = step(w, createState(w), INPUT_E, new Set());
        expect(held.blocks).toEqual(['3,1']);
        expect(step(w, held, INPUT_E, new Set())).toBeNull();
        const through = step(w, held, INPUT_E, new Set(['key_red']));
        expect(through).not.toBeNull();
        expect([...through.inventory]).toEqual([]); // override ⇒ no pickup writes
    });
});

describe('flags — the LATCH, contrasted with the hold', () => {
    it('a flag survives walking away; the held token does not', () => {
        const w = picture([
            '######',
            '#PFb.#',
            '######',
        ]);
        let s = createState(w);
        s = step(w, s, INPUT_E);                 // onto flag_B at (2,1)
        expect([...s.inventory]).toEqual(['flag_B']);
        s = step(w, s, INPUT_E);                 // onto button_A at (3,1)
        expect([...s.inventory]).toEqual(['flag_B']);
        s = step(w, s, INPUT_E);                 // off the button, onto (4,1)
        // The LATCH is still held...
        expect([...s.inventory]).toEqual(['flag_B']);
        // ...and the HOLD is not: sw_A was never in the inventory at any point,
        // and nothing on the board is pressing a button now.
        expect(s.inventory.has('sw_A')).toBe(false);
        const w2 = picture(['####', '#Pb#', '####']);
        const onButton = step(w2, createState(w2), INPUT_E);
        expect(onButton.inventory.has('sw_A')).toBe(false);
    });

    it('⚠ NOTHING IN `step` BRANCHES ON `kind: flag` — a flag is permanent because '
        + 'every item pickup is. The kind is a DECLARATION for layer 1 and the renderer', () => {
        const w = picture([
            '#####',
            '#PFK#',
            '#####',
        ]);
        let s = step(w, createState(w), INPUT_E);
        s = step(w, s, INPUT_E);
        // key_red, with no `kind` at all, is exactly as permanent as flag_B.
        expect([...s.inventory].sort()).toEqual(['flag_B', 'key_red']);
        expect(w.itemLib.flag_B.kind).toBe('flag');
        expect(w.itemLib.key_red.kind).toBeUndefined();
    });
});

describe('mazeVisitedKey', () => {
    it('is BYTE-IDENTICAL to the pre-arc-2 string when the world has no blocks', () => {
        const w = createWorld(4, 4);
        const s = createState(w);
        expect(mazeVisitedKey(s)).toBe('0,0|');
        s.inventory.add('key_red');
        s.inventory.add('flag_B');
        s.player_pos = { x: 2, y: 3 };
        expect(mazeVisitedKey(s)).toBe('2,3|flag_B,key_red');
    });

    it('appends the block layout — and only then', () => {
        const w = createWorld(5, 5);
        setBlock(w, 3, 1);
        setBlock(w, 1, 2);
        const s = createState(w);
        expect(mazeVisitedKey(s)).toBe('0,0||1,2;3,1');
        s.inventory.add('key_red');
        expect(mazeVisitedKey(s)).toBe('0,0|key_red|1,2;3,1');
    });

    it('two states reached by DIFFERENT push orders share one key', () => {
        // Two blocks, each pushable east once. The player can do them in
        // either order and finish on the same cell (2,3).
        const w = picture([
            '######',
            '#.B..#',
            '#P...#',
            '#.B..#',
            '######',
        ]);
        const north = [INPUT_N, INPUT_E, INPUT_S, INPUT_W, INPUT_S, INPUT_E];
        const south = [INPUT_S, INPUT_E, INPUT_N, INPUT_W, INPUT_N, INPUT_E,
            INPUT_S, INPUT_S];
        const a = runPlan(w, createState(w), north);
        const b = runPlan(w, createState(w), south);
        expect(a).not.toBeNull();
        expect(b).not.toBeNull();
        expect(a.player_pos).toEqual({ x: 2, y: 3 });
        expect(b.player_pos).toEqual({ x: 2, y: 3 });
        expect(a.blocks).toEqual(['3,1', '3,3']);
        expect(mazeVisitedKey(b)).toBe(mazeVisitedKey(a));
        expect(mazeVisitedKey(a)).toBe('2,3||3,1;3,3');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// THE 7×7 HAND-DRAWN FIXTURE — a 2-turn push lane, a held door, a flag beyond.
//
//        0 1 2 3 4 5 6
//    0   # # # # # # #
//    1   # P . . . . #     the player starts at (1,1)
//    2   # # . B # . #     the block starts at (3,2)
//    3   # # . . . . #
//    4   # # b # . # #     button_A at (2,4)
//    5   # # # # D F #     door_A at (4,5), flag_B at (5,5)
//    6   # # # # # # #
//
// The walls are the point: the block can only leave (3,2) southward, can only
// leave (3,3) westward, and can only leave (2,3) southward — so the ONLY route
// onto the button is S, W, S, which is 2 direction changes. And the button is
// three cells from the door, so the player cannot press it themselves and step
// through: the block has to do the work.
// ─────────────────────────────────────────────────────────────────────────
const PUSH_LANE_7x7 = [
    '#######',
    '#P....#',
    '##.B#.#',
    '##....#',
    '##b#.##',
    '####DF#',
    '#######',
];

function pushDirections(world, plan) {
    let s = createState(world);
    const dirs = [];
    for (const input of plan) {
        const before = s.blocks.join(';');
        s = step(world, s, input);
        if (s === null) return null;
        if (s.blocks.join(';') !== before) dirs.push(input);
    }
    return { dirs, final: s };
}

describe('the 7×7 push lane — block → button holds door_A → flag_B beyond', () => {
    const hasFlag = (s) => s.inventory.has('flag_B');

    it('BFS solves it, and the plan is this exact plan', () => {
        const w = picture(PUSH_LANE_7x7);
        const r = reach(w, bfsSolver, createState(w), hasFlag, { budget: 20000 });
        expect(r.ok).toBe(true);
        expect(r.plan).toEqual([
            'E', 'E', 'S', 'N', 'E', 'E', 'S', 'S', 'W',
            'W', 'N', 'W', 'S', 'E', 'E', 'S', 'S', 'E',
        ]);
        expect(r.steps).toBe(18);
        expect(r.expanded).toBe(137);
    });

    it('the plan pushes the block S, W, S — 2 direction changes — onto the button', () => {
        const w = picture(PUSH_LANE_7x7);
        const r = reach(w, bfsSolver, createState(w), hasFlag, { budget: 20000 });
        const { dirs, final } = pushDirections(w, r.plan);
        expect(dirs).toEqual(['S', 'W', 'S']);
        expect(dirs.filter((d, i) => i > 0 && d !== dirs[i - 1]).length).toBe(2);
        expect(final.blocks).toEqual(['2,4']);      // the button cell
        expect(getButton(w, 2, 4)).toBe('button_A');
        expect([...final.inventory]).toEqual(['flag_B']);
    });

    it('is DETERMINISTIC — two runs of the same world return the identical plan', () => {
        const a = reach(picture(PUSH_LANE_7x7), bfsSolver,
            createState(picture(PUSH_LANE_7x7)), hasFlag, { budget: 20000 });
        const w = picture(PUSH_LANE_7x7);
        const b = reach(w, bfsSolver, createState(w), hasFlag, { budget: 20000 });
        expect(b.plan).toEqual(a.plan);
        expect(b.expanded).toBe(a.expanded);
    });

    // ⚖ THE ABLATION REMOVES THE KEY, NOT THE DOOR (trap 291 — taking a door
    // away only makes a level easier, so it can never falsify anything).
    it('ABLATION — remove the BLOCK and the flag is unreachable', () => {
        const w = picture(PUSH_LANE_7x7.map((r) => r.replace('B', '.')));
        expect(w.blocks.size).toBe(0);
        const r = reach(w, bfsSolver, createState(w), hasFlag, { budget: 20000 });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('unreachable');
    });

    it('ABLATION — leave the block but take away what the button HOLDS, and the flag is unreachable', () => {
        const w = picture(PUSH_LANE_7x7, { buttonLib: { button_A: { kind: 'button' } } });
        expect(w.blocks.size).toBe(1);
        const r = reach(w, bfsSolver, createState(w), hasFlag, { budget: 20000 });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('unreachable');
    });

    it('the door is genuinely the cut: without sw_A the flag cell is the only thing lost', () => {
        const w = picture(PUSH_LANE_7x7, { buttonLib: {} });
        // (4,4), just outside the door, is still reachable.
        const r = reach(w, bfsSolver, createState(w),
            (s) => s.player_pos.x === 4 && s.player_pos.y === 4, { budget: 20000 });
        expect(r.ok).toBe(true);
    });
});

describe('serializeMazeEntities / deserializeMazeWorld round trip', () => {
    const oldSidecar = () => ({
        width: 4,
        height: 3,
        tiles: [
            1, 1, 1, 1,
            1, 0, 0, 1,
            1, 1, 1, 1,
        ],
        entrance: { x: 1, y: 1 },
        exits: [{ exit_id: 'exit', x: 2, y: 1 }],
        obstacles: [],
        items: [],
    });

    it('emits NOTHING for a world with no blocks, no buttons and no buttonLib', () => {
        expect(serializeMazeEntities(createWorld(4, 4))).toEqual({});
    });

    it('a sidecar written before this slice loads exactly as it did (literal fixture)', () => {
        const w = deserializeMazeWorld(oldSidecar());
        expect(w.blocks.size).toBe(0);
        expect(w.buttons.size).toBe(0);
        expect(w.buttonLib).toEqual({});
        expect('blocks' in createState(w)).toBe(false);
        expect(mazeVisitedKey(createState(w))).toBe('1,1|');
    });

    it('round-trips blocks, buttons and the button library', () => {
        const w = picture(PUSH_LANE_7x7);
        const entities = serializeMazeEntities(w);
        expect(entities).toEqual({
            blocks: [{ x: 3, y: 2 }],
            buttons: [{ x: 2, y: 4, id: 'button_A' }],
            buttonLib: { button_A: BUTTON_A_ENTRY },
        });
        const sidecar = {
            width: w.width,
            height: w.height,
            tiles: Array.from(w.tiles),
            entrance: { x: w.entrance.x, y: w.entrance.y },
            exits: [...w.exits.values()].map((e) => ({ exit_id: e.exit_id, x: e.x, y: e.y })),
            obstacles: [...w.obstacles].map(([k, id]) => {
                const [x, y] = k.split(',').map(Number);
                return { x, y, id };
            }),
            items: [...w.items].map(([k, id]) => {
                const [x, y] = k.split(',').map(Number);
                return { x, y, id };
            }),
            obstacleLib: { door_A: DOOR_A_ENTRY },
            itemLib: { flag_B: FLAG_B_ENTRY },
            ...entities,
        };
        const restored = deserializeMazeWorld(sidecar);
        expect(serializeMazeEntities(restored)).toEqual(entities);
        expect(createState(restored).blocks).toEqual(['3,2']);
        // ⛓ AND IT STILL SOLVES — the fixed point alone would only prove the
        // reader and the writer agree with each other (a consistently-wrong
        // pair round-trips perfectly), so the restored world is re-certified
        // against the SAME literal plan the original produced.
        const r = reach(restored, bfsSolver, createState(restored),
            (s) => s.inventory.has('flag_B'), { budget: 20000 });
        expect(r.steps).toBe(18);
        expect(r.expanded).toBe(137);
    });

    it('sorts its rows row-major, so the emission is a function of the SET', () => {
        const w = createWorld(6, 6);
        setBlock(w, 4, 3);
        setBlock(w, 1, 1);
        setBlock(w, 2, 3);
        setButton(w, 5, 5, 'button_z');
        setButton(w, 1, 0, 'button_a');
        expect(serializeMazeEntities(w).blocks)
            .toEqual([{ x: 1, y: 1 }, { x: 2, y: 3 }, { x: 4, y: 3 }]);
        expect(serializeMazeEntities(w).buttons)
            .toEqual([{ x: 1, y: 0, id: 'button_a' }, { x: 5, y: 5, id: 'button_z' }]);
    });
});

describe('the node cap is the budget (⚖ ruling 6)', () => {
    it('refuses BY NAME rather than running longer', () => {
        // An 11×11 open room with three free blocks: 121 × C(120,3) ≈ 34M
        // states. The cap stops it at 20000 expansions and says why.
        const w = createWorld(11, 11, {
            entrance: { x: 0, y: 0 },
            exits: [{ exit_id: 'exit', x: 10, y: 10 }],
        });
        for (const p of [{ x: 3, y: 3 }, { x: 7, y: 3 }, { x: 3, y: 7 }]) setBlock(w, p.x, p.y);
        const r = reach(w, bfsSolver, createState(w), reachedExit, { budget: 20000 });
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('budget_exceeded');
        expect(r.expanded).toBe(20000);
    });

    it('the SAME room with no blocks is 119 expansions', () => {
        const w = createWorld(11, 11, {
            entrance: { x: 0, y: 0 },
            exits: [{ exit_id: 'exit', x: 10, y: 10 }],
        });
        const r = reach(w, bfsSolver, createState(w), reachedExit, { budget: 20000 });
        expect(r.ok).toBe(true);
        expect(r.expanded).toBe(119);
    });
});
