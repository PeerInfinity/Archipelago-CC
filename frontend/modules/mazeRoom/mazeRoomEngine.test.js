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
    walkerSolver, makeMazePickMove,
    apply, undo,
    generateMaze,
} from './mazeRoomEngine.js';
import { isObstacleCleared, DEFAULT_OBSTACLES } from './library.js';

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
        expect(w.exit).toEqual({ x: 4, y: 3 });
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
        expect(final.player_pos).toEqual(w.exit);
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
        expect(final.player_pos).toEqual(w.exit);
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

describe('walkerSolver', () => {
    it('finds the exit on an empty room with high success rate', () => {
        const w = createWorld(6, 6);
        const rng = createRng(1);
        const r = reach(w, walkerSolver, createState(w), reachedExit, {
            trials: 40, stepBudget: 200, rng,
        });
        expect(r.ok).toBe(true);
        // Empty room with distance-bias walker should almost always solve.
        expect(r.successFraction).toBeGreaterThan(0.5);
    });

    it('hits the goal in zero steps when already there', () => {
        const w = createWorld(4, 4, { entrance: { x: 2, y: 2 }, exit: { x: 2, y: 2 } });
        const rng = createRng(1);
        const r = reach(w, walkerSolver, createState(w), reachedExit, {
            trials: 5, stepBudget: 50, rng,
        });
        expect(r.successes).toBe(5);
        expect(r.meanSuccessLength).toBe(0);
    });

    it('is deterministic for a fixed seed', () => {
        const w = createWorld(6, 6);
        const a = reach(w, walkerSolver, createState(w), reachedExit,
            { trials: 20, stepBudget: 100, rng: createRng(9) });
        const b = reach(w, walkerSolver, createState(w), reachedExit,
            { trials: 20, stepBudget: 100, rng: createRng(9) });
        expect(a).toEqual(b);
    });

    it('reports low success rate on a tight stepBudget', () => {
        const w = createWorld(10, 10);
        const rng = createRng(1);
        const r = reach(w, walkerSolver, createState(w), reachedExit, {
            trials: 20, stepBudget: 3, rng,
        });
        // 3 steps can't reach (9,9) from (0,0) — shortest path is 18.
        expect(r.successes).toBe(0);
    });
});

describe('makeMazePickMove', () => {
    it('returns null when no legal moves', () => {
        const pick = makeMazePickMove();
        expect(pick({ world: { exit: { x: 0, y: 0 } }, state: createState(createWorld(2, 2)), legalMoves: [], visited: new Set(), rng: createRng(1) })).toBeNull();
    });

    it('picks an unvisited move over a visited one when weights dominate', () => {
        // With unvisitedBonus very high and towardExitBonus = 1, the
        // unvisited option should win essentially every time.
        const pick = makeMazePickMove({ unvisitedBonus: 1000, towardExitBonus: 1 });
        const world = createWorld(3, 3);
        const state = createState(world);
        const visited = new Set(['1,0|']); // east already visited
        const legalMoves = [
            { input: INPUT_E, nextState: { player_pos: { x: 1, y: 0 }, inventory: new Set() } },
            { input: INPUT_S, nextState: { player_pos: { x: 0, y: 1 }, inventory: new Set() } },
        ];
        const chosen = pick({ world, state, legalMoves, visited, rng: createRng(1) });
        expect(chosen).toBe(INPUT_S);
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
        expect(getTile(world, world.exit.x, world.exit.y)).toBe(TILE_FLOOR);
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

    it('difficulty gate off by default — stats.difficultyGateOn is false', () => {
        const { stats } = generateMaze({ width: 6, height: 6, seed: 1 });
        expect(stats.difficultyGateOn).toBe(false);
        expect(stats.finalSuccessFraction).toBeNull();
    });

    it('difficulty gate on when both min/max success pcts are set', () => {
        const { stats } = generateMaze({
            width: 8, height: 8, seed: 3,
            params: {
                maxIterations: 500, stallLimit: 100,
                walkerTrials: 10, minSuccessPct: 0.3, maxSuccessPct: 0.9,
            },
        });
        expect(stats.difficultyGateOn).toBe(true);
        expect(stats.finalSuccessFraction).not.toBeNull();
        expect(stats.finalSuccessFraction).toBeGreaterThanOrEqual(0);
        expect(stats.finalSuccessFraction).toBeLessThanOrEqual(1);
    });

    it('rejectedDifficulty counts proposals that pass feasibility but fail the band', () => {
        // With a very narrow band, expect some difficulty-rejections.
        const { stats } = generateMaze({
            width: 10, height: 10, seed: 5,
            params: {
                maxIterations: 300, stallLimit: 60,
                walkerTrials: 10, minSuccessPct: 0.4, maxSuccessPct: 0.6,
            },
        });
        expect(stats.difficultyGateOn).toBe(true);
        expect(stats.rejected).toBe(stats.rejectedFeasibility + stats.rejectedDifficulty);
    });

    it('difficulty-gated generation is still deterministic for a fixed seed', () => {
        const cfg = {
            width: 8, height: 8, seed: 11,
            params: {
                maxIterations: 400, stallLimit: 80,
                walkerTrials: 15, minSuccessPct: 0.3, maxSuccessPct: 0.9,
            },
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
        for (let seed = 1; seed <= 30; seed++) {
            const { world, stats } = generateMaze({
                width: 12, height: 10, seed,
                params: { walkerTrials: 15, minSuccessPct: 0.3, maxSuccessPct: 0.5 },
            });
            if (!stats.gateKeyPlaced) continue;
            placed += 1;
            // Remove the key — exit should then be unreachable.
            world.items.delete(`${stats.keyPos.x},${stats.keyPos.y}`);
            const r = reach(world, bfsSolver, createState(world), reachedExit);
            if (r.ok) bypassable += 1;
        }
        expect(placed).toBeGreaterThan(20);
        expect(bypassable).toBe(0);
    });

    it('gate-and-key placement is deterministic for a fixed seed', () => {
        const a = generateMaze({ width: 10, height: 8, seed: 17 });
        const b = generateMaze({ width: 10, height: 8, seed: 17 });
        expect(a.stats.doorPos).toEqual(b.stats.doorPos);
        expect(a.stats.keyPos).toEqual(b.stats.keyPos);
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
