/**
 * Pure geometry helpers for maze worlds. No DOM, no eventBus — these
 * run at maze-gen time (procgen pipeline) and at runtime (autopather,
 * Phase 5).
 *
 * Currently exports:
 *   - bfsShortestPathLength(world, from, to) — tile count of shortest
 *     walkable path between two tile coordinates, or null if
 *     unreachable. Walls block; obstacles and items are passable.
 *   - computeLongestShortestPath(world) — max over all (entrance, exit)
 *     and (exit, exit) pairs of the pairwise shortest-path length.
 *     Used by the maze substrate to derive the per-tile move cost
 *     (baseRegionCost / longestShortestPath) so the worst route between
 *     entry-points equals exactly baseRegionCost.
 */

import { isFloor } from './mazeRoomEngine.js';

/**
 * BFS shortest path length between two tile coordinates over walkable
 * tiles. Floor + (item-tile / location-tile / obstacle-tile) all count
 * as walkable for path-length purposes — we don't gate on rules here.
 *
 * @param {{tiles, width, height}} world
 * @param {{x, y}} from
 * @param {{x, y}} to
 * @returns {number|null} step count of shortest path, or null if no path
 */
export function bfsShortestPathLength(world, from, to) {
    if (!world || !from || !to) return null;
    if (from.x === to.x && from.y === to.y) return 0;

    const w = world.width;
    const h = world.height;
    const seen = new Uint8Array(w * h);
    const idx = (x, y) => y * w + x;

    if (!isFloor(world, from.x, from.y) || !isFloor(world, to.x, to.y)) {
        return null;
    }

    seen[idx(from.x, from.y)] = 1;
    let frontier = [{ x: from.x, y: from.y, d: 0 }];
    const DELTAS = [
        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
        { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    ];

    while (frontier.length > 0) {
        const next = [];
        for (const node of frontier) {
            for (const d of DELTAS) {
                const nx = node.x + d.dx;
                const ny = node.y + d.dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                if (seen[idx(nx, ny)]) continue;
                if (!isFloor(world, nx, ny)) continue;
                if (nx === to.x && ny === to.y) return node.d + 1;
                seen[idx(nx, ny)] = 1;
                next.push({ x: nx, y: ny, d: node.d + 1 });
            }
        }
        frontier = next;
    }
    return null;
}

/**
 * Longest shortest path among the entry/exit points of a maze world.
 * Endpoint set = [entrance, ...exits]. Returns the maximum over all
 * unordered pairs (a, b) where a ≠ b of bfsShortestPathLength(a, b).
 *
 * Returns 0 when the world has no exits and no entrance (degenerate).
 * Returns 1 as a floor for single-endpoint or trivially-adjacent
 * configurations to avoid divide-by-zero in moveCost = base / length.
 *
 * @param {object} world
 * @returns {number} length in tiles, ≥ 1
 */
export function computeLongestShortestPath(world) {
    if (!world) return 1;
    const endpoints = [];
    if (world.entrance) {
        endpoints.push({ x: world.entrance.x, y: world.entrance.y });
    }
    if (world.exits && typeof world.exits.values === 'function') {
        for (const e of world.exits.values()) {
            // De-dup if an exit shares the entrance tile (rare but possible).
            if (endpoints.some((p) => p.x === e.x && p.y === e.y)) continue;
            endpoints.push({ x: e.x, y: e.y });
        }
    }

    if (endpoints.length < 2) {
        // Only one endpoint (or none) — no traversal pair to compute.
        // Return 1 so callers can divide safely.
        return 1;
    }

    let longest = 0;
    for (let i = 0; i < endpoints.length; i++) {
        for (let j = i + 1; j < endpoints.length; j++) {
            const len = bfsShortestPathLength(world, endpoints[i], endpoints[j]);
            if (len !== null && len > longest) longest = len;
        }
    }
    // Floor at 1 — disconnected endpoints or a 1x1 region shouldn't
    // make the per-tile cost denominator zero.
    return longest > 0 ? longest : 1;
}
