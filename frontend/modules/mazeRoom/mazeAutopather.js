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
 *   - When `opts.hazards` is a non-empty array of hazard objects (per
 *     hazardRuntime), the BFS switches to time-expanded mode: state
 *     becomes (x, y, turn mod lcm-of-cycle-lengths), and each candidate
 *     move must pass validateMove against the hazards' state at the
 *     pre-move turn. With cycle lengths in {2,4,8} the LCM is 8, so
 *     the search space is at most X×Y×8. v1 doesn't consider wait as
 *     an action — the planner routes around hazards but won't wait
 *     them out (a hazard guarding a chokepoint may yield no path).
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
    INPUT_N, INPUT_S, INPUT_E, INPUT_W, INPUT_WAIT,
} from './mazeRoomEngine.js';
import { isObstacleCleared } from '../shared/procgen/library.js';
import { validateMove as validateMoveAgainstHazards } from '../shared/procgen/contentModules/hazardRuntime.js';

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
 * @param {Array<object>} [opts.hazards] - hazard runtime objects (see
 *   hazardRuntime). When non-empty, the BFS plans around hazards
 *   using a time-expanded state (x, y, turn).
 * @param {boolean} [opts.allowWait] - when true (and hazards is
 *   non-empty), the BFS considers waiting as a 5th action, letting
 *   the planner wait a hazard out at a chokepoint. Wait entries
 *   show up in the output as duplicate-tile steps (same x,y twice
 *   in a row); stepsToInputs / stepsToActions translate them to
 *   INPUT_WAIT / {type:'wait'} respectively.
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
        if (dx === 0 && dy === 0) out.push(INPUT_WAIT);
        else if (dx === 1 && dy === 0) out.push(INPUT_E);
        else if (dx === -1 && dy === 0) out.push(INPUT_W);
        else if (dx === 0 && dy === 1) out.push(INPUT_S);
        else if (dx === 0 && dy === -1) out.push(INPUT_N);
        // Non-cardinal moves are rejected silently — BFS only emits
        // 4-connected paths and waits, so this should never trigger.
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
        if (dx === 0 && dy === 0) {
            out.push({ type: 'wait' });
            continue;
        }
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

    // Time-expanded mode: when hazards are provided, the BFS tracks
    // turn count alongside position. State = (x, y, t mod LCM); each
    // candidate move advances turn by 1 and is validated against the
    // hazards' state at the pre-move turn (Rule 1 + 2 from
    // hazardRuntime). When `hazards` is null/empty, the BFS reverts
    // to the plain (x, y) state for performance.
    const hazards = Array.isArray(opts.hazards) && opts.hazards.length > 0
        ? opts.hazards
        : null;
    const cycleLcm = hazards
        ? hazards.reduce((m, hz) => _lcm(m, Math.max(1, hz.cycleLength || 1)), 1)
        : 1;
    // Wait support: when allowWait is on AND we're in time-expanded
    // mode, the BFS considers staying in place as a 5th action.
    // Useful for letting a hazard's cycle clear a chokepoint instead
    // of failing the search. Only meaningful with hazards (without
    // them, waiting is always a strict regression on path length).
    const allowWait = !!opts.allowWait && !!hazards;

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

    // State key: "x,y" without hazards (existing fast path), "x,y,t"
    // with hazards (time-expanded). The reconstruction walks both
    // shapes correctly via _parseStateKeyXY.
    const stateKey = hazards
        ? (x, y, t) => `${x},${y},${t}`
        : (x, y) => `${x},${y}`;
    const visited = new Set();
    const parent = new Map();
    const startKey = stateKey(from.x, from.y, 0);
    visited.add(startKey);

    const DELTAS = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    ];

    let frontier = [{ x: from.x, y: from.y, t: 0 }];
    while (frontier.length > 0) {
        const next = [];
        for (const node of frontier) {
            // Hazards' state at this node's turn — computed once per
            // node, reused across the 4 neighbor checks + the wait.
            const hazardsAtT = hazards ? _hazardsAtTurn(hazards, node.t) : null;
            for (const d of DELTAS) {
                const nx = node.x + d.dx;
                const ny = node.y + d.dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                const nt = hazards ? (node.t + 1) % cycleLcm : 0;
                const nKey = stateKey(nx, ny, nt);
                if (visited.has(nKey)) continue;
                const isAlsoGoal = isGoal(nx, ny);
                if (!isWalkable(nx, ny, isAlsoGoal)) continue;
                // Hazard validation at turn t: Rule 1 (can't move
                // into hazard.next), Rule 2 (head-on collision into
                // hazard.cur from hazard.next). Always passes when
                // hazards is null.
                if (hazardsAtT && !validateMoveAgainstHazards(
                    hazardsAtT,
                    { x: node.x, y: node.y },
                    { x: nx, y: ny },
                )) continue;
                visited.add(nKey);
                parent.set(nKey, stateKey(node.x, node.y, node.t));
                if (isAlsoGoal) {
                    return _reconstructPath(parent, startKey, nKey);
                }
                next.push({ x: nx, y: ny, t: nt });
            }
            // Wait neighbor: same (x,y), advance turn. Valid only when
            // no hazard.next equals the current position at turn t
            // (Rule 1 applied to wait). Without this branch the
            // planner would give up at hazard chokepoints — with it,
            // the player can wait out a sweeping hazard before
            // continuing.
            if (allowWait) {
                const nt = (node.t + 1) % cycleLcm;
                const nKey = stateKey(node.x, node.y, nt);
                if (!visited.has(nKey)
                    && validateMoveAgainstHazards(
                        hazardsAtT,
                        { x: node.x, y: node.y },
                        { x: node.x, y: node.y },
                    )) {
                    visited.add(nKey);
                    parent.set(nKey, stateKey(node.x, node.y, node.t));
                    // Wait can be the final step on the path only if
                    // the start tile happens to be a goal — handled
                    // by the trivial-path early-return above. So we
                    // don't check isGoal here; just enqueue.
                    next.push({ x: node.x, y: node.y, t: nt });
                }
            }
        }
        frontier = next;
    }
    return null;
}

/**
 * Snapshot hazards at turn `t`: each hazard's phase becomes
 * (h.phase + t) mod h.cycleLength. New objects so the original
 * hazards aren't mutated (the substrate owns the runtime phase
 * separately).
 */
function _hazardsAtTurn(hazards, t) {
    if (t === 0) return hazards;
    return hazards.map((h) => ({
        ...h,
        phase: ((h.phase ?? 0) + t) % h.cycleLength,
    }));
}

function _gcd(a, b) {
    let x = Math.abs(a | 0);
    let y = Math.abs(b | 0);
    while (y) { const t = y; y = x % y; x = t; }
    return x || 1;
}

function _lcm(a, b) {
    if (!a || !b) return Math.max(a, b);
    return (a / _gcd(a, b)) * b;
}

function _parseStateKeyXY(key) {
    const parts = key.split(',');
    return { x: Number(parts[0]), y: Number(parts[1]) };
}

function _reconstructPath(parent, fromKey, toKey) {
    const steps = [_parseStateKeyXY(toKey)];
    let cur = toKey;
    while (cur !== fromKey) {
        const p = parent.get(cur);
        if (!p) break; // shouldn't happen; guard against malformed parent map
        steps.unshift(_parseStateKeyXY(p));
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
