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
    return { width, height, tiles, entrance, exit };
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
        // Plumbed but unused in v1 — preserved so reach() signature matches
        // the shared-core contract and ability-gated growth doesn't force
        // an interface change.
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
    const next = cloneState(state);
    next.player_pos.x = nx;
    next.player_pos.y = ny;
    next.turn += 1;
    return next;
}

// --- Goal predicates ---

export function reachedExit(state, world) {
    return state.player_pos.x === world.exit.x && state.player_pos.y === world.exit.y;
}

// --- BFS solver for the maze simulator ---

// Visited key in v1 is just (x, y). When ability-gated tiles land, the
// key must grow to include an inventory hash, because reachability then
// becomes a function of (position, inventory).
function mazeVisitedKey(state) {
    return `${state.player_pos.x},${state.player_pos.y}`;
}

export const bfsSolver = makeBfsSolver({
    step,
    inputs: INPUTS,
    visitedKey: mazeVisitedKey,
});

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
    // Walker / difficulty-gate knobs. The gate is active only when both
    // minSuccessPct and maxSuccessPct are non-null; leaving them unset
    // gives feasibility-only behavior (v1 walls-only baseline).
    walkerTrials: 20,
    walkerStepBudget: null, // null → auto: 4 * width * height
    minSuccessPct: null,
    maxSuccessPct: null,
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
    };

    return { world, stats };
}
