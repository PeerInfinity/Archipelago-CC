/**
 * Maze autopather — BFS pathfinding over maze worlds.
 *
 * Computes a tile-by-tile route from a starting position to one of a
 * few target kinds:
 *   - { kind: 'tile', x, y }                    — walk to a specific tile
 *   - { kind: 'exit', exitId }                  — walk to a specific exit
 *   - { kind: 'location', locationName }        — walk to a location tile
 *   - { kind: 'closestUnexplored' }             — walk to the closest
 *       walkable un-seen tile. Walking onto it expands the player's
 *       seen-set (the fog clears around the new position), priming
 *       the next chain leg. Requires `opts.seenTiles` (Set<"x,y">).
 *
 * Returns `{ steps: [{x, y}, ...], length: number }` where `steps`
 * includes both endpoints and `length` is `steps.length - 1` (the
 * number of one-tile moves to traverse the path). Returns `null` when
 * no path exists or when the target kind is unrecognized / under-
 * specified.
 *
 * Walkability:
 *   - Walls always block.
 *   - When `opts.inventory` is provided (and either `opts.obstacleLib`
 *     or `world.obstacleLib`), tiles holding obstacles the inventory
 *     can't clear are also blocked. Without inventory, obstacles pass
 *     through (geometry-only mode, suitable for procgen-time use).
 *   - When `opts.excludeOtherExits` is true, exit tiles other than the
 *     goal are treated as walls — preventing accidental teleports
 *     through unintended exits in hub-spoke layouts.
 *
 * Cost calculation is **not** done here. Callers translate `length`
 * and per-tile location lookups into mana cost using their own cost
 * model (e.g. mazeRoomUI's proposedLinearFinalCost-aware deduction).
 *
 * Used by:
 *   - mazeRoomVisualizer._planTilePath (delegates here, with inventory +
 *     excludeOtherExits set)
 *   - mazeRoomUI's "walk to ..." commands
 *   - the loops queue → autopather wiring (Phase 6)
 */

import {
    isFloor, getObstacle, getExitAt,
    INPUT_N, INPUT_S, INPUT_E, INPUT_W,
} from './mazeRoomEngine.js';
import { isObstacleCleared } from '../shared/procgen/library.js';

/**
 * @param {Object} world - maze world (width, height, tiles, exits, etc.)
 * @param {{x: number, y: number}} from - starting tile
 * @param {Object} target - { kind, ...kindSpecificFields }
 * @param {Object} [opts]
 * @param {Set<string>} [opts.seenTiles] - "x,y" keys of seen tiles (for
 *   the closestUnexplored target).
 * @param {Set<string>|Iterable} [opts.inventory] - item ids the player
 *   currently holds. When provided, obstacle tiles the inventory can't
 *   clear are blocked.
 * @param {Object} [opts.obstacleLib] - obstacle library for inventory-
 *   aware clearance checks. Defaults to `world.obstacleLib`.
 * @param {boolean} [opts.excludeOtherExits] - when true, exit tiles
 *   other than the goal are blocked (prevents accidental teleports
 *   through off-route exits).
 * @returns {{steps: Array<{x,y}>, length: number} | null}
 */
export function findPath(world, from, target, opts = {}) {
    if (!world || !from || !target) return null;
    const isGoal = makeGoalPredicate(world, target, opts);
    if (!isGoal) return null;
    return _bfsToGoal(world, from, isGoal, opts);
}

/**
 * Convert a path of tile coordinates (from `findPath`) into the input
 * direction sequence the engine's `step()` consumes. Used by the
 * visualizer to drive its existing per-tick step loop after planning
 * via `findPath`.
 *
 * @param {Array<{x,y}>} steps
 * @returns {Array<string>} input direction codes (INPUT_N/S/E/W)
 */
export function stepsToInputs(steps) {
    if (!Array.isArray(steps) || steps.length < 2) return [];
    const out = [];
    for (let i = 1; i < steps.length; i++) {
        const dx = steps[i].x - steps[i - 1].x;
        const dy = steps[i].y - steps[i - 1].y;
        if (dx === 1 && dy === 0) out.push(INPUT_E);
        else if (dx === -1 && dy === 0) out.push(INPUT_W);
        else if (dx === 0 && dy === 1) out.push(INPUT_S);
        else if (dx === 0 && dy === -1) out.push(INPUT_N);
        // Non-cardinal moves are rejected silently — BFS only emits
        // 4-connected paths, so this should never trigger.
    }
    return out;
}

/**
 * Convert a sequence of tile coordinates into queue action specs
 * (move N/S/E/W). Used to translate visualizer-driven walks (loops
 * delegation) into the same verb format the maze action queue uses,
 * so saved best-queues have a single canonical shape regardless of
 * which path produced them.
 *
 * Returns an empty array on bad input or a single-tile path. Output
 * actions carry no id / status — those are queue-level concerns; the
 * stored shape is just the verb list (Cavernous's strip-progress-on-
 * save convention).
 *
 * @param {Array<{x:number,y:number}>} steps - 4-connected tile path
 * @returns {Array<{type:'move',dir:'N'|'S'|'E'|'W'}>}
 */
export function stepsToActions(steps) {
    if (!Array.isArray(steps) || steps.length < 2) return [];
    const out = [];
    for (let i = 1; i < steps.length; i++) {
        const dx = steps[i].x - steps[i - 1].x;
        const dy = steps[i].y - steps[i - 1].y;
        let dir = null;
        if (dx === 1 && dy === 0) dir = 'E';
        else if (dx === -1 && dy === 0) dir = 'W';
        else if (dx === 0 && dy === 1) dir = 'S';
        else if (dx === 0 && dy === -1) dir = 'N';
        if (dir) out.push({ type: 'move', dir });
    }
    return out;
}

function makeGoalPredicate(world, target, opts) {
    switch (target.kind) {
        case 'tile':
            if (typeof target.x !== 'number' || typeof target.y !== 'number') return null;
            return (x, y) => x === target.x && y === target.y;

        case 'exit': {
            const exit = world.exits?.get?.(target.exitId);
            if (!exit) return null;
            return (x, y) => x === exit.x && y === exit.y;
        }

        case 'location': {
            if (!world.itemLocationNames) return null;
            // Reverse lookup. itemLocationNames is Map<"x,y", name>;
            // we want the position whose name matches target.locationName.
            let pos = null;
            for (const [key, name] of world.itemLocationNames) {
                if (name === target.locationName) {
                    const [x, y] = key.split(',').map(Number);
                    pos = { x, y };
                    break;
                }
            }
            if (!pos) return null;
            return (x, y) => x === pos.x && y === pos.y;
        }

        case 'closestUnexplored': {
            const seenTiles = opts.seenTiles;
            if (!seenTiles || typeof seenTiles.has !== 'function') return null;
            // Goal = any walkable un-seen tile. The BFS in _bfsToGoal
            // walks through walkable tiles; the first un-seen one it
            // reaches is the closest reveal. Walking onto the goal
            // expands the player's seen-set by 5 tiles (the new
            // position + 4-coord-adjacent), priming the next chain
            // leg.
            //
            // Earlier this predicate looked for "frontier tiles" (seen
            // tiles with at least one un-seen walkable neighbor). That
            // led to a length-0 path when the player's own tile was a
            // frontier — walkToTile's same-tile branch then no-oped
            // and the queue parked forever. Targeting the un-seen tile
            // directly avoids that and gives a one-step reveal in the
            // common case.
            return (x, y) => isFloor(world, x, y) && !seenTiles.has(`${x},${y}`);
        }

        default:
            return null;
    }
}

function _bfsToGoal(world, from, isGoal, opts = {}) {
    const w = world.width;
    const h = world.height;
    if (!isFloor(world, from.x, from.y)) return null;
    if (isGoal(from.x, from.y)) {
        return { steps: [{ x: from.x, y: from.y }], length: 0 };
    }

    const inventory = opts.inventory ?? null;
    const obstacleLib = inventory
        ? (opts.obstacleLib ?? world.obstacleLib ?? null)
        : null;
    const excludeOtherExits = opts.excludeOtherExits === true;

    // Walkable predicate applied to each candidate neighbor. The
    // `from` tile is implicitly walkable (the player is there); we
    // skip the runtime checks for it. `isAlsoGoal` tells the predicate
    // whether this candidate is the destination — the exclude-other-
    // exits rule allows the goal tile to be an exit (we're trying to
    // walk TO it, not THROUGH it).
    function isWalkable(x, y, isAlsoGoal) {
        if (!isFloor(world, x, y)) return false;
        if (excludeOtherExits && !isAlsoGoal && getExitAt(world, x, y)) return false;
        if (inventory && obstacleLib) {
            const obstacleId = getObstacle(world, x, y);
            if (obstacleId && !isObstacleCleared(obstacleId, inventory, obstacleLib)) {
                return false;
            }
        }
        return true;
    }

    const seen = new Uint8Array(w * h);
    const idx = (x, y) => y * w + x;
    seen[idx(from.x, from.y)] = 1;

    // parent: "x,y" → "px,py" predecessor for path reconstruction
    const parent = new Map();
    const DELTAS = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    ];

    let frontier = [{ x: from.x, y: from.y }];
    while (frontier.length > 0) {
        const next = [];
        for (const node of frontier) {
            for (const d of DELTAS) {
                const nx = node.x + d.dx;
                const ny = node.y + d.dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                if (seen[idx(nx, ny)]) continue;
                const isAlsoGoal = isGoal(nx, ny);
                if (!isWalkable(nx, ny, isAlsoGoal)) continue;
                seen[idx(nx, ny)] = 1;
                parent.set(`${nx},${ny}`, `${node.x},${node.y}`);
                if (isAlsoGoal) {
                    return _reconstructPath(parent, from, { x: nx, y: ny });
                }
                next.push({ x: nx, y: ny });
            }
        }
        frontier = next;
    }
    return null;
}

function _reconstructPath(parent, from, to) {
    const steps = [{ x: to.x, y: to.y }];
    let cur = `${to.x},${to.y}`;
    const stop = `${from.x},${from.y}`;
    while (cur !== stop) {
        const p = parent.get(cur);
        if (!p) break; // shouldn't happen; guard against malformed parent map
        const [px, py] = p.split(',').map(Number);
        steps.unshift({ x: px, y: py });
        cur = p;
    }
    return { steps, length: steps.length - 1 };
}

/**
 * Compose the conventional best-path lookup key for gameState's
 * bestPaths map. Keeps the key shape consistent across substrates and
 * Phase 6's loops-queue wiring.
 *
 * Shape: `<regionName>|<fromExitId or 'entrance'>|<toPart>`
 *   toPart = `exit:<exitId>` for exit targets
 *          | `loc:<locationName>` for location targets
 *
 * Other target kinds (tile, closestUnexplored) aren't worth persisting
 * — they're geometry-relative or session-relative and don't generalize.
 *
 * @param {string} regionName
 * @param {string|null} fromExitId - exit_id the player arrived through;
 *   null/undefined → 'entrance' (initial spawn)
 * @param {{kind: 'exit', exitId: string} | {kind: 'location', locationName: string}} toRef
 * @returns {string|null} key, or null when toRef is unrecognised
 */
export function bestPathKey(regionName, fromExitId, toRef) {
    if (!regionName || !toRef?.kind) return null;
    const fromPart = fromExitId ? String(fromExitId) : 'entrance';
    let toPart = null;
    if (toRef.kind === 'exit' && toRef.exitId) {
        toPart = `exit:${toRef.exitId}`;
    } else if (toRef.kind === 'location' && toRef.locationName) {
        toPart = `loc:${toRef.locationName}`;
    }
    if (!toPart) return null;
    return `${regionName}|${fromPart}|${toPart}`;
}

// Exported for tests
export const _internal = { _bfsToGoal, _reconstructPath };
