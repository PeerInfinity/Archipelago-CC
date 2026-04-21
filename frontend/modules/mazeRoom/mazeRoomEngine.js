/**
 * mazeRoom engine — v1 walls-only maze, first consumer of the shared
 * simulator-core interface (see NewDocs/plans/procedural-generation/
 * shared-simulator-core.md and maze-room-generator.md).
 *
 * Headless: no DOM, no rendering, no input wiring. That lives in
 * mazeRoomUI.js once v1 is engine-complete.
 */

import { createRng } from '../shared/rng.js';
import { reach, makeBfsSolver, makeRandomWalkerSolver } from '../shared/simulatorCore.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES, isObstacleCleared } from './library.js';

// --- Tile types ---

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;

// --- Inputs ---

export const INPUT_N = 'N';
export const INPUT_S = 'S';
export const INPUT_E = 'E';
export const INPUT_W = 'W';
export const INPUTS = [INPUT_N, INPUT_S, INPUT_E, INPUT_W];

const DELTAS = {
    [INPUT_N]: { dx: 0, dy: -1 },
    [INPUT_S]: { dx: 0, dy: 1 },
    [INPUT_E]: { dx: 1, dy: 0 },
    [INPUT_W]: { dx: -1, dy: 0 },
};

// --- World ---

export function createWorld(width, height, opts = {}) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2) {
        throw new Error(`createWorld: invalid dimensions ${width}x${height}`);
    }
    const tiles = new Int8Array(width * height);
    const entrance = opts.entrance ?? { x: 0, y: 0 };
    const exit = opts.exit ?? { x: width - 1, y: height - 1 };
    assertInBounds(width, height, entrance, 'entrance');
    assertInBounds(width, height, exit, 'exit');
    return {
        width, height, tiles, entrance, exit,
        // Sparse overlays keyed by "x,y". Obstacles block entry unless
        // inventory clears them; items add themselves to inventory on
        // successful entry. Both sit on top of floor tiles.
        obstacles: new Map(),
        items: new Map(),
        itemLib: opts.itemLib ?? DEFAULT_ITEMS,
        obstacleLib: opts.obstacleLib ?? DEFAULT_OBSTACLES,
    };
}

function posKey(x, y) { return `${x},${y}`; }

export function getObstacle(world, x, y) {
    return world.obstacles.get(posKey(x, y));
}

export function setObstacle(world, x, y, obstacleId) {
    world.obstacles.set(posKey(x, y), obstacleId);
}

export function clearObstacle(world, x, y) {
    world.obstacles.delete(posKey(x, y));
}

export function getItem(world, x, y) {
    return world.items.get(posKey(x, y));
}

export function setItem(world, x, y, itemId) {
    world.items.set(posKey(x, y), itemId);
}

export function clearItem(world, x, y) {
    world.items.delete(posKey(x, y));
}

function assertInBounds(width, height, pt, label) {
    if (pt.x < 0 || pt.x >= width || pt.y < 0 || pt.y >= height) {
        throw new Error(`${label} (${pt.x},${pt.y}) out of bounds for ${width}x${height}`);
    }
}

export function tileIndex(world, x, y) {
    return y * world.width + x;
}

export function getTile(world, x, y) {
    return world.tiles[tileIndex(world, x, y)];
}

export function setTile(world, x, y, tile) {
    world.tiles[tileIndex(world, x, y)] = tile;
}

export function isFloor(world, x, y) {
    if (x < 0 || x >= world.width || y < 0 || y >= world.height) return false;
    return world.tiles[tileIndex(world, x, y)] === TILE_FLOOR;
}

export function isEntrance(world, x, y) {
    return world.entrance.x === x && world.entrance.y === y;
}

export function isExit(world, x, y) {
    return world.exit.x === x && world.exit.y === y;
}

// --- State ---

export function createState(world) {
    return {
        player_pos: { x: world.entrance.x, y: world.entrance.y },
        turn: 0,
        inventory: new Set(),
    };
}

function cloneState(state) {
    return {
        player_pos: { x: state.player_pos.x, y: state.player_pos.y },
        turn: state.turn,
        inventory: new Set(state.inventory),
    };
}

// --- step ---

export function step(world, state, input) {
    const delta = DELTAS[input];
    if (!delta) return null;
    const nx = state.player_pos.x + delta.dx;
    const ny = state.player_pos.y + delta.dy;
    if (!isFloor(world, nx, ny)) return null;
    const obstacleId = getObstacle(world, nx, ny);
    if (obstacleId && !isObstacleCleared(obstacleId, state.inventory, world.obstacleLib)) {
        return null;
    }
    const next = cloneState(state);
    next.player_pos.x = nx;
    next.player_pos.y = ny;
    next.turn += 1;
    const itemId = getItem(world, nx, ny);
    if (itemId) next.inventory.add(itemId);
    return next;
}

// --- Goal predicates ---

export function reachedExit(state, world) {
    return state.player_pos.x === world.exit.x && state.player_pos.y === world.exit.y;
}

// --- BFS solver for the maze simulator ---

// Reachability is a function of (position, inventory) once ability-gated
// tiles exist — two states at the same tile with different inventories
// can reach different parts of the world, so BFS must treat them as
// distinct nodes.
function mazeVisitedKey(state) {
    if (state.inventory.size === 0) {
        return `${state.player_pos.x},${state.player_pos.y}|`;
    }
    const inv = [...state.inventory].sort().join(',');
    return `${state.player_pos.x},${state.player_pos.y}|${inv}`;
}

export const bfsSolver = makeBfsSolver({
    step,
    inputs: INPUTS,
    visitedKey: mazeVisitedKey,
});

// Obstacle-transparent step used by path/obstacle extraction: walls
// still block, but obstacles are passable (we want to reconstruct the
// geometric route and then annotate it with the obstacles it crossed,
// independently of whether the player could clear them at run time).
function ghostStep(world, state, input) {
    const delta = DELTAS[input];
    if (!delta) return null;
    const nx = state.player_pos.x + delta.dx;
    const ny = state.player_pos.y + delta.dy;
    if (!isFloor(world, nx, ny)) return null;
    const next = cloneState(state);
    next.player_pos.x = nx;
    next.player_pos.y = ny;
    next.turn += 1;
    return next;
}

const ghostBfsSolver = makeBfsSolver({
    step: ghostStep,
    inputs: INPUTS,
    visitedKey: (s) => `${s.player_pos.x},${s.player_pos.y}`,
});

// --- Paths-and-obstacles extraction ---
//
// Produces the central data representation from the pipeline overview
// (NewDocs/plans/procedural-generation/pipeline-overview.md §"Authored
// rules: paths and obstacles"). For each target location (the exit +
// every item pickup), we walk an obstacle-transparent BFS from the
// entrance, then annotate the path with the obstacles it crossed. v1
// emits a single path per location; multi-path via BFS-removal analysis
// is deferred (pipeline-overview §"What's new" / tile-map-analyzer
// pattern).

function obstaclesAlongPath(world, startState, plan) {
    const seen = [];
    const seenSet = new Set();
    let s = startState;
    for (const input of plan) {
        s = ghostStep(world, s, input);
        if (!s) break;
        const obstacleId = getObstacle(world, s.player_pos.x, s.player_pos.y);
        if (obstacleId && !seenSet.has(obstacleId)) {
            seen.push(obstacleId);
            seenSet.add(obstacleId);
        }
    }
    return seen;
}

function pathsToTarget(world, position) {
    const start = createState(world);
    const result = reach(world, ghostBfsSolver, start,
        (s) => s.player_pos.x === position.x && s.player_pos.y === position.y);
    if (!result.ok) return [];
    const obstacles = obstaclesAlongPath(world, start, result.plan);
    return [{ path_id: 'p1', obstacles }];
}

export function extractPathsAndObstacles(world, opts = {}) {
    const regionId = opts.regionId ?? 'maze_room';

    // Exits are region-to-region connections with a placeholder target
    // region — the maze room's "exit" tile becomes a named exit with
    // no known destination until the region graph stitches it in.
    const exits = [{
        id: 'exit',
        position: { x: world.exit.x, y: world.exit.y },
        target_region: null,
        paths: pathsToTarget(world, world.exit),
    }];

    // Locations are Archipelago check slots; in v1 each item pickup
    // position is a location whose canonical item is what the generator
    // placed there.
    const locations = [];
    for (const [key, itemId] of world.items) {
        const [x, y] = key.split(',').map(Number);
        locations.push({
            id: `${itemId}_pickup`,
            position: { x, y },
            item: itemId,
            paths: pathsToTarget(world, { x, y }),
        });
    }

    return {
        region_id: regionId,
        entrance: { x: world.entrance.x, y: world.entrance.y },
        exits,
        locations,
    };
}

// --- Heuristic walker (difficulty gate) ---

// Move scoring: weighted toward unvisited tiles, with a softened bias
// toward moves that reduce Manhattan distance to the exit. Both bonuses
// are multiplicative over a base weight of 1, so a visited move that
// also increases distance still has non-zero weight — the walker can
// backtrack out of a dead end.
const DEFAULT_WALKER_WEIGHTS = Object.freeze({
    unvisitedBonus: 4,
    towardExitBonus: 2,
});

function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function makeMazePickMove(weights = DEFAULT_WALKER_WEIGHTS) {
    const { unvisitedBonus, towardExitBonus } = { ...DEFAULT_WALKER_WEIGHTS, ...weights };
    return function mazePickMove({ world, state, legalMoves, visited, rng }) {
        if (legalMoves.length === 0) return null;
        const curDist = manhattan(state.player_pos, world.exit);
        const weighted = legalMoves.map((m) => {
            let w = 1;
            if (!visited.has(mazeVisitedKey(m.nextState))) w *= unvisitedBonus;
            const newDist = manhattan(m.nextState.player_pos, world.exit);
            if (newDist < curDist) w *= towardExitBonus;
            return { input: m.input, weight: w };
        });
        const total = weighted.reduce((s, m) => s + m.weight, 0);
        let r = rng.next() * total;
        for (const m of weighted) {
            r -= m.weight;
            if (r <= 0) return m.input;
        }
        return weighted[weighted.length - 1].input;
    };
}

export const walkerSolver = makeRandomWalkerSolver({
    step,
    inputs: INPUTS,
    visitedKey: mazeVisitedKey,
    pickMove: makeMazePickMove(),
});

// --- apply / undo ---

export function apply(world, edit) {
    switch (edit.type) {
        case 'add_wall':
        case 'remove_wall': {
            assertInBounds(world.width, world.height, edit, edit.type);
            const idx = tileIndex(world, edit.x, edit.y);
            const prev = world.tiles[idx];
            const next = edit.type === 'add_wall' ? TILE_WALL : TILE_FLOOR;
            world.tiles[idx] = next;
            return { type: edit.type, x: edit.x, y: edit.y, prev };
        }
        default:
            throw new Error(`apply: unknown edit type ${edit.type}`);
    }
}

export function undo(world, token) {
    const idx = tileIndex(world, token.x, token.y);
    world.tiles[idx] = token.prev;
}

// --- Generator ---

const DEFAULT_PARAMS = Object.freeze({
    maxIterations: 2000,
    stallLimit: 200,
    // Walker / difficulty-gate knobs. The gate is active only when
    // minSuccessPct or maxSuccessPct is non-null; leaving them unset
    // gives feasibility-only behavior (v1 walls-only baseline).
    walkerTrials: 20,
    walkerStepBudget: null, // null → auto: 4 * width * height
    minSuccessPct: null,
    maxSuccessPct: null,
    // Gate-and-key placement. Set false to get a walls-only maze.
    placeGateAndKey: true,
    gateKeyMaxAttempts: 20,
    // Minimum number of non-entrance, non-door floor tiles that must be
    // reachable from the entrance with the door as a wall — ensures
    // there's somewhere meaningful to put the key.
    gateKeyMinBeforeDoor: 2,
});

function floorTilesExcluding(world, exclude) {
    const out = [];
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            if (getTile(world, x, y) !== TILE_FLOOR) continue;
            let skip = false;
            for (const pt of exclude) {
                if (pt.x === x && pt.y === y) { skip = true; break; }
            }
            if (skip) continue;
            out.push({ x, y });
        }
    }
    return out;
}

function tracePath(world, startState, plan) {
    const positions = [{ x: startState.player_pos.x, y: startState.player_pos.y }];
    let s = startState;
    for (const input of plan) {
        s = step(world, s, input);
        if (!s) return null;
        positions.push({ x: s.player_pos.x, y: s.player_pos.y });
    }
    return positions;
}

// Enumerate tiles the player can reach from startState with the
// current world and inventory. Stand-alone from bfsSolver because we
// want the full set, not a single goal-directed plan.
function reachableTiles(world, startState) {
    const visited = new Set([mazeVisitedKey(startState)]);
    const queue = [startState];
    const out = [{ x: startState.player_pos.x, y: startState.player_pos.y }];
    while (queue.length > 0) {
        const s = queue.shift();
        for (const input of INPUTS) {
            const next = step(world, s, input);
            if (!next) continue;
            const k = mazeVisitedKey(next);
            if (visited.has(k)) continue;
            visited.add(k);
            queue.push(next);
            out.push({ x: next.player_pos.x, y: next.player_pos.y });
        }
    }
    return out;
}

function placeGateAndKey(world, rng, params) {
    const pathResult = reach(world, bfsSolver, createState(world), reachedExit);
    if (!pathResult.ok) return { placed: false, reason: 'no_path' };
    const pathPositions = tracePath(world, createState(world), pathResult.plan);
    if (!pathPositions || pathPositions.length < 3) {
        return { placed: false, reason: 'path_too_short' };
    }
    // Door candidates: path positions strictly between entrance and exit.
    const doorCandidates = pathPositions.slice(1, -1);

    for (let attempt = 0; attempt < params.gateKeyMaxAttempts; attempt++) {
        const doorPos = doorCandidates[Math.floor(rng.next() * doorCandidates.length)];
        setObstacle(world, doorPos.x, doorPos.y, 'door_red');

        // With empty inventory the door acts as a wall, so `reachableTiles`
        // returns exactly the pre-door region.
        const beforeDoor = reachableTiles(world, createState(world));

        // Door must be a *cut vertex* — a position that every entrance→
        // exit route passes through. If the exit is still reachable with
        // the door as a wall, the door is bypassable and we retry.
        const exitBypassable = beforeDoor.some(
            (p) => p.x === world.exit.x && p.y === world.exit.y,
        );
        if (exitBypassable) {
            clearObstacle(world, doorPos.x, doorPos.y);
            continue;
        }

        const keyCandidates = beforeDoor.filter((p) =>
            !(p.x === world.entrance.x && p.y === world.entrance.y)
            && !(p.x === doorPos.x && p.y === doorPos.y),
        );
        if (keyCandidates.length < params.gateKeyMinBeforeDoor) {
            clearObstacle(world, doorPos.x, doorPos.y);
            continue;
        }

        const keyPos = keyCandidates[Math.floor(rng.next() * keyCandidates.length)];
        setItem(world, keyPos.x, keyPos.y, 'key_red');

        // Sanity check: exit reachable when the player has the key.
        const final = reach(world, bfsSolver, createState(world), reachedExit);
        if (!final.ok) {
            clearObstacle(world, doorPos.x, doorPos.y);
            clearItem(world, keyPos.x, keyPos.y);
            continue;
        }

        return { placed: true, doorPos, keyPos };
    }

    return { placed: false, reason: 'no_suitable_placement' };
}

export function generateMaze(config) {
    const width = config.width;
    const height = config.height;
    const params = { ...DEFAULT_PARAMS, ...(config.params ?? {}) };
    const rng = createRng(config.seed ?? 1);

    const world = createWorld(width, height, {
        entrance: config.entrance,
        exit: config.exit,
    });

    const exclude = [world.entrance, world.exit];

    const start = createState(world);
    const baseline = reach(world, bfsSolver, start, reachedExit);
    if (!baseline.ok) {
        throw new Error('generateMaze: entrance and exit not connected in empty room');
    }

    const difficultyGateOn = params.minSuccessPct != null || params.maxSuccessPct != null;
    // Treat unset bounds as "no rejection on that side" / "no early stop":
    // min=0 accepts arbitrarily hard mazes; max=1 never early-stops.
    const minSuccess = params.minSuccessPct ?? 0;
    const maxSuccess = params.maxSuccessPct ?? 1;
    const walkerStepBudget = params.walkerStepBudget ?? (4 * width * height);

    let accepted = 0;
    let rejectedFeasibility = 0;
    let rejectedDifficulty = 0;
    let stall = 0;
    let iterations = 0;
    let lastWalker = null;
    let reachedTarget = false;

    for (iterations = 0; iterations < params.maxIterations; iterations++) {
        if (stall >= params.stallLimit) break;

        const candidates = floorTilesExcluding(world, exclude);
        if (candidates.length === 0) break;

        const pick = candidates[Math.floor(rng.next() * candidates.length)];
        const edit = { type: 'add_wall', x: pick.x, y: pick.y };
        const token = apply(world, edit);

        const feasible = reach(world, bfsSolver, createState(world), reachedExit);
        if (!feasible.ok) {
            undo(world, token);
            rejectedFeasibility += 1;
            stall += 1;
            continue;
        }

        if (!difficultyGateOn) {
            accepted += 1;
            stall = 0;
            continue;
        }

        // Walls only push difficulty in one direction (harder), so the
        // band's upper bound is a *stopping* criterion, not a rejection
        // criterion — otherwise a starting success rate above max would
        // reject every proposal and stall immediately. Only reject when
        // the wall overshoots below min.
        const walker = reach(world, walkerSolver, createState(world), reachedExit, {
            trials: params.walkerTrials,
            stepBudget: walkerStepBudget,
            rng,
        });
        lastWalker = walker;
        if (walker.successFraction < minSuccess) {
            undo(world, token);
            rejectedDifficulty += 1;
            stall += 1;
            continue;
        }
        accepted += 1;
        stall = 0;
        if (walker.successFraction <= maxSuccess) {
            reachedTarget = true;
            break;
        }
    }

    const gateKeyResult = params.placeGateAndKey
        ? placeGateAndKey(world, rng, params)
        : { placed: false, reason: 'disabled' };

    const finalReach = reach(world, bfsSolver, createState(world), reachedExit);
    const finalWalker = difficultyGateOn
        ? reach(world, walkerSolver, createState(world), reachedExit, {
            trials: params.walkerTrials,
            stepBudget: walkerStepBudget,
            rng,
        })
        : null;
    const stats = {
        iterations,
        accepted,
        rejected: rejectedFeasibility + rejectedDifficulty,
        rejectedFeasibility,
        rejectedDifficulty,
        stalled: stall >= params.stallLimit,
        reachedTarget,
        shortestPath: finalReach.ok ? finalReach.steps : null,
        difficultyGateOn,
        finalSuccessFraction: finalWalker ? finalWalker.successFraction : null,
        lastProposalSuccessFraction: lastWalker ? lastWalker.successFraction : null,
        gateKeyPlaced: gateKeyResult.placed,
        gateKeyReason: gateKeyResult.reason ?? null,
        doorPos: gateKeyResult.doorPos ?? null,
        keyPos: gateKeyResult.keyPos ?? null,
    };

    return { world, stats };
}

// --- Grid growth pipeline adapter ---
//
// generateMazeRegion wraps the maze substrate for use by the
// grid-growth procgen pipeline. It accepts the GridGrowthGeneratorInput
// shape from grid-growth-pipeline.md and returns the matching output.
//
// v1 scope:
//   - Exactly one exit side (multi-exit is a growth-path item).
//   - One key+door pair via placeGateAndKey (when inputs include
//     key_red + door_red); other items placed on random reachable
//     tiles; other obstacles left unplaced and reported back.
//   - Start regions (entrance_side === null) get the entrance in the
//     middle of the region; per the plan, no obstacles are placed in
//     the start region regardless of what the pipeline offers.
//
// generateMaze is not modified — this adapter sits alongside.

const SIDE_N = 'N';
const SIDE_S = 'S';
const SIDE_E = 'E';
const SIDE_W = 'W';

function pickTileOnSide(side, size, rng) {
    switch (side) {
        case SIDE_N: return { x: Math.floor(rng.next() * size.width), y: 0 };
        case SIDE_S: return { x: Math.floor(rng.next() * size.width), y: size.height - 1 };
        case SIDE_E: return { x: size.width - 1, y: Math.floor(rng.next() * size.height) };
        case SIDE_W: return { x: 0, y: Math.floor(rng.next() * size.height) };
        default: throw new Error(`pickTileOnSide: unknown side '${side}'`);
    }
}

function entranceTileForStartRegion(size) {
    return { x: Math.floor(size.width / 2), y: Math.floor(size.height / 2) };
}

function pickReachableFloorTile(world, rng, excluded) {
    const excludedKeys = new Set(excluded.map((p) => `${p.x},${p.y}`));
    const tiles = reachableTiles(world, createState(world));
    const candidates = tiles.filter((t) => {
        if (t.x === world.entrance.x && t.y === world.entrance.y) return false;
        if (t.x === world.exit.x && t.y === world.exit.y) return false;
        if (excludedKeys.has(`${t.x},${t.y}`)) return false;
        if (getItem(world, t.x, t.y)) return false;
        if (getObstacle(world, t.x, t.y)) return false;
        return true;
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(rng.next() * candidates.length)];
}

function placeItemsAndObstaclesForPipeline(world, opts) {
    const {
        items_to_place, obstacles_to_place, allow_obstacles, rng, params,
    } = opts;
    const placed_items = [];
    const placed_obstacles = [];
    const remaining_items = [...items_to_place];
    const remaining_obstacles = allow_obstacles ? [...obstacles_to_place] : [];

    // v1: handle one key_red + door_red pair via placeGateAndKey.
    if (remaining_obstacles.includes('door_red') && remaining_items.includes('key_red')) {
        const pgParams = {
            gateKeyMaxAttempts: params.gateKeyMaxAttempts ?? 20,
            gateKeyMinBeforeDoor: params.gateKeyMinBeforeDoor ?? 2,
        };
        const result = placeGateAndKey(world, rng, pgParams);
        if (result.placed) {
            placed_obstacles.push({ obstacle_id: 'door_red', position: result.doorPos });
            placed_items.push({ item_id: 'key_red', position: result.keyPos });
            remaining_obstacles.splice(remaining_obstacles.indexOf('door_red'), 1);
            remaining_items.splice(remaining_items.indexOf('key_red'), 1);
        }
    }

    // Place remaining items on random reachable tiles, excluding
    // anything we've already placed.
    for (const item_id of remaining_items) {
        const excluded = [
            ...placed_items.map((p) => p.position),
            ...placed_obstacles.map((p) => p.position),
        ];
        const tile = pickReachableFloorTile(world, rng, excluded);
        if (!tile) break;
        setItem(world, tile.x, tile.y, item_id);
        placed_items.push({ item_id, position: tile });
    }

    // Remaining obstacles go unplaced in v1. The pipeline returns them
    // to the scenario pool via the diff between inputs and output.
    return { placed_items, placed_obstacles };
}

export function generateMazeRegion(input) {
    const {
        region_id,
        size,
        entrance_side = null,
        entrance_tile: givenEntranceTile = null,
        exit_sides,
        arrival_inventory = new Set(),
        items_to_place = [],
        obstacles_to_place = [],
        item_lib = DEFAULT_ITEMS,
        obstacle_lib = DEFAULT_OBSTACLES,
        rng,
        params = {},
    } = input;

    if (!region_id) throw new Error('generateMazeRegion: region_id required');
    if (!size || !size.width || !size.height) throw new Error('generateMazeRegion: size.{width,height} required');
    if (!rng || typeof rng.next !== 'function') throw new Error('generateMazeRegion: rng required');
    if (!exit_sides || exit_sides.length === 0) throw new Error('generateMazeRegion: at least one exit_side required');
    if (exit_sides.length > 1) throw new Error('generateMazeRegion v1: exactly one exit_side supported');

    // Resolve entrance tile.
    let entrance_tile;
    if (entrance_side === null) {
        entrance_tile = givenEntranceTile ?? entranceTileForStartRegion(size);
    } else {
        if (!givenEntranceTile) {
            throw new Error('generateMazeRegion: entrance_tile required when entrance_side is set');
        }
        entrance_tile = givenEntranceTile;
    }

    const exit_side = exit_sides[0];
    const exit_tile = pickTileOnSide(exit_side, size, rng);

    // Generate walls via the existing substrate, but skip its own
    // placeGateAndKey step — the pipeline adapter does placement using
    // the inputs it was given.
    const mazeSeed = Math.floor(rng.next() * 0x7fffffff);
    const { world, stats: wallStats } = generateMaze({
        width: size.width,
        height: size.height,
        seed: mazeSeed,
        entrance: entrance_tile,
        exit: exit_tile,
        params: {
            ...params,
            placeGateAndKey: false,
        },
    });

    // Thread the caller-supplied libraries onto the world so step()
    // and extraction consult the right clear_sets.
    world.itemLib = item_lib;
    world.obstacleLib = obstacle_lib;

    // Start region gets no obstacles regardless of what the pipeline
    // offers — the player arrives with nothing and would be stranded.
    const allow_obstacles = entrance_side !== null;
    const placement = placeItemsAndObstaclesForPipeline(world, {
        items_to_place,
        obstacles_to_place,
        allow_obstacles,
        rng,
        params,
    });

    const extracted_rules = extractPathsAndObstacles(world, { regionId: region_id });

    return {
        region_id,
        playable_payload: world,
        extracted_rules,
        placed_items: placement.placed_items,
        placed_obstacles: placement.placed_obstacles,
        exits_placed: [{ side: exit_side, tile_position: exit_tile }],
        render_hint: 'maze',
        sidecar_filename: `${region_id}.json`,
        wall_stats: wallStats,
    };
}
