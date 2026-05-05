/**
 * Maze autopather — pure BFS pathfinding over maze worlds.
 *
 * Computes a tile-by-tile route from a starting position to one of a
 * few target kinds:
 *   - { kind: 'tile', x, y }                    — walk to a specific tile
 *   - { kind: 'exit', exitId }                  — walk to a specific exit
 *   - { kind: 'location', locationName }        — walk to a location tile
 *   - { kind: 'closestUnexplored' }             — walk to the closest
 *       frontier tile (walkable + seen + has at least one un-seen
 *       4-neighbor). Requires `opts.seenTiles` (Set<"x,y">).
 *
 * Returns `{ steps: [{x, y}, ...], length: number }` where `steps`
 * includes both endpoints and `length` is `steps.length - 1` (the
 * number of one-tile moves to traverse the path). Returns `null` when
 * no path exists or when the target kind is unrecognized / under-
 * specified.
 *
 * Cost calculation is **not** done here — the autopather is purely
 * geometric. Callers translate `length` and per-tile location lookups
 * into mana cost using their own cost model (e.g. mazeRoomUI's
 * proposedLinearFinalCost-aware deduction).
 *
 * Used by:
 *   - mazeRoomUI's planned "walk to ..." commands (Phase 5+)
 *   - the loops queue → autopather wiring (Phase 6)
 */

import { isFloor } from './mazeRoomEngine.js';

/**
 * @param {Object} world - maze world (width, height, tiles, exits, etc.)
 * @param {{x: number, y: number}} from - starting tile
 * @param {Object} target - { kind, ...kindSpecificFields }
 * @param {Object} [opts]
 * @param {Set<string>} [opts.seenTiles] - "x,y" keys of seen tiles (for
 *   the closestUnexplored target).
 * @returns {{steps: Array<{x,y}>, length: number} | null}
 */
export function findPath(world, from, target, opts = {}) {
    if (!world || !from || !target) return null;
    const isGoal = makeGoalPredicate(world, target, opts);
    if (!isGoal) return null;
    return _bfsToGoal(world, from, isGoal);
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
            return (x, y) => _isFrontierTile(world, x, y, seenTiles);
        }

        default:
            return null;
    }
}

/** A tile is "frontier" when it's walkable, seen, and has at least one
 *  walkable un-seen 4-neighbor — i.e. stepping onto it would reveal
 *  new ground. */
function _isFrontierTile(world, x, y, seenTiles) {
    if (!isFloor(world, x, y)) return false;
    if (!seenTiles.has(`${x},${y}`)) return false;
    const DELTAS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of DELTAS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= world.width || ny >= world.height) continue;
        if (!isFloor(world, nx, ny)) continue;
        if (!seenTiles.has(`${nx},${ny}`)) return true;
    }
    return false;
}

function _bfsToGoal(world, from, isGoal) {
    const w = world.width;
    const h = world.height;
    if (!isFloor(world, from.x, from.y)) return null;
    if (isGoal(from.x, from.y)) {
        return { steps: [{ x: from.x, y: from.y }], length: 0 };
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
                if (!isFloor(world, nx, ny)) continue;
                seen[idx(nx, ny)] = 1;
                parent.set(`${nx},${ny}`, `${node.x},${node.y}`);
                if (isGoal(nx, ny)) {
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
export const _internal = { _bfsToGoal, _isFrontierTile, _reconstructPath };
