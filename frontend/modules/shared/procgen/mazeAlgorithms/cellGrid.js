/**
 * Cell-grid utilities shared by `cellStep: 2` backends — the
 * tree-based maze algorithms (recursive backtracker, Kruskal's, etc.)
 * that operate on a half-resolution cell grid and render to tiles.
 *
 * Convention for a (W × H) tile grid where W = 2N+1 and H = 2M+1:
 *
 *   - Cell (cx, cy) lives at tile (2*cx + 1, 2*cy + 1). All cells are
 *     floor.
 *   - The wall *between* cells (cx, cy) and (cx+1, cy) lives at tile
 *     (2*cx + 2, 2*cy + 1). Algorithms knock these down to connect
 *     adjacent cells.
 *   - All other tiles (corners and the outer wall ring) are walls.
 *
 * For even W or H, the grid leaves a one-tile wall strip on the
 * right/bottom — no cell uses that strip but the algorithm just
 * doesn't reach there. Acceptable for v1.
 *
 * The tree-backend lifecycle:
 *   1. fillBackgroundWalls — every non-fixed tile becomes a wall.
 *   2. carveCellTiles — every cell position becomes floor.
 *   3. (algorithm runs, knocking down walls between cells)
 *   4. connectFixedTiles — entrance + each exit gets a minimum
 *      passage to the surrounding cells.
 *   5. validation safety net (caller's responsibility).
 */

import { TILE_FLOOR, TILE_WALL, getTile, setTile } from '../../../mazeRoom/mazeRoomEngine.js';

export function cellDimensions(world) {
    return {
        cellW: Math.floor((world.width - 1) / 2),
        cellH: Math.floor((world.height - 1) / 2),
    };
}

export function cellTileX(cx) { return 2 * cx + 1; }
export function cellTileY(cy) { return 2 * cy + 1; }

// Tile coordinates of the wall between two grid-adjacent cells.
export function wallTileBetween(ca, cb) {
    return {
        x: cellTileX(ca.cx) + (cb.cx - ca.cx),
        y: cellTileY(ca.cy) + (cb.cy - ca.cy),
    };
}

export function collectFixedTiles(world) {
    const fixed = new Set();
    fixed.add(`${world.entrance.x},${world.entrance.y}`);
    for (const e of world.exits.values()) {
        fixed.add(`${e.x},${e.y}`);
    }
    return fixed;
}

export function fillBackgroundWalls(world, fixedKeys) {
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            if (fixedKeys.has(`${x},${y}`)) continue;
            setTile(world, x, y, TILE_WALL);
        }
    }
}

export function carveCellTiles(world) {
    const { cellW, cellH } = cellDimensions(world);
    for (let cy = 0; cy < cellH; cy++) {
        for (let cx = 0; cx < cellW; cx++) {
            setTile(world, cellTileX(cx), cellTileY(cy), TILE_FLOOR);
        }
    }
}

/**
 * For each fixed tile (entrance + exits) that doesn't sit on a cell
 * position, carve a Manhattan path from it to the nearest cell tile,
 * stamping every intermediate tile to floor. That guarantees the
 * fixed tile is connected to the spanning tree the algorithm built.
 *
 * Three cases worth tracking:
 *   - on-cell (odd, odd) — no carving; already part of the tree.
 *   - on-axis (one odd) — single-tile carve to the adjacent cell row
 *     or column.
 *   - off-axis (both even) and dead-strip tiles (when width or height
 *     is even, the rightmost / bottom column or row falls outside
 *     the cell range) — multi-tile carve toward the nearest valid
 *     cell coordinate.
 *
 * The path is L-shaped: walk x toward the cell column first, then y.
 * Order doesn't matter for connectivity, but a consistent order keeps
 * the output deterministic across seeds.
 */
export function connectFixedTiles(world, fixedTiles) {
    const { cellW, cellH } = cellDimensions(world);
    if (cellW < 1 || cellH < 1) return;
    const lastCellX = cellTileX(cellW - 1);
    const lastCellY = cellTileY(cellH - 1);

    const targetCellCoord = (v, lastCell) => {
        if (v <= 1) return 1;                    // first cell
        if (v >= lastCell) return lastCell;      // last cell
        return v % 2 === 1 ? v : v - 1;          // round down to nearest odd
    };

    for (const t of fixedTiles) {
        const onCellPos = (t.x % 2) === 1 && (t.y % 2) === 1
            && t.x <= lastCellX && t.y <= lastCellY;
        if (onCellPos) continue;
        const tx = targetCellCoord(t.x, lastCellX);
        const ty = targetCellCoord(t.y, lastCellY);
        let cx = t.x;
        let cy = t.y;
        // Step x first.
        while (cx !== tx) {
            cx += cx < tx ? 1 : -1;
            setTile(world, cx, cy, TILE_FLOOR);
        }
        while (cy !== ty) {
            cy += cy < ty ? 1 : -1;
            setTile(world, cx, cy, TILE_FLOOR);
        }
    }
}

export function fixedTilesArray(world) {
    const out = [{ x: world.entrance.x, y: world.entrance.y }];
    for (const e of world.exits.values()) {
        out.push({ x: e.x, y: e.y });
    }
    return out;
}

const DELTAS = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
];

function floorReachableFromEntrance(world) {
    const visited = new Set([`${world.entrance.x},${world.entrance.y}`]);
    const queue = [{ x: world.entrance.x, y: world.entrance.y }];
    while (queue.length > 0) {
        const p = queue.shift();
        for (const d of DELTAS) {
            const nx = p.x + d.dx;
            const ny = p.y + d.dy;
            if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
            if (getTile(world, nx, ny) !== TILE_FLOOR) continue;
            const k = `${nx},${ny}`;
            if (visited.has(k)) continue;
            visited.add(k);
            queue.push({ x: nx, y: ny });
        }
    }
    return visited;
}

/**
 * Best-effort connectivity repair. After a backend runs, every fixed
 * tile (entrance + exits) should be reachable from every other fixed
 * tile via floor. If any aren't, find a single wall tile that bridges
 * the entrance's connected region to a floor tile outside it and
 * knock it down. Repeat until either everything's reachable or no
 * bridge wall exists.
 *
 * Used by `recursive_division` where an unlucky sequence of cuts can
 * cause a parent gap to be neighbored by a child wall, severing
 * connectivity. The standard recursive-division correctness
 * invariant (parent gap alignment with child wall placement) is
 * fiddly to implement; post-hoc repair is simpler and equally safe.
 *
 * Tree-based backends are connected by construction and don't need
 * this. The maze engine's outer validation safety net catches any
 * case where repair fails to fix everything.
 */
export function repairConnectivity(world) {
    let safety = 0;
    while (safety++ < world.width * world.height) {
        const reachable = floorReachableFromEntrance(world);
        const allReached = fixedTilesArray(world).every(
            (t) => reachable.has(`${t.x},${t.y}`),
        );
        if (allReached) return;
        // Find a wall tile that touches both the reachable component
        // and a floor tile outside it. Knock it down to merge.
        let bridge = null;
        outer:
        for (let y = 0; y < world.height; y++) {
            for (let x = 0; x < world.width; x++) {
                if (getTile(world, x, y) !== TILE_WALL) continue;
                let touchesIn = false;
                let touchesOut = false;
                for (const d of DELTAS) {
                    const nx = x + d.dx;
                    const ny = y + d.dy;
                    if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
                    if (getTile(world, nx, ny) !== TILE_FLOOR) continue;
                    if (reachable.has(`${nx},${ny}`)) touchesIn = true;
                    else touchesOut = true;
                    if (touchesIn && touchesOut) {
                        bridge = { x, y };
                        break outer;
                    }
                }
            }
        }
        if (!bridge) return;
        setTile(world, bridge.x, bridge.y, TILE_FLOOR);
    }
}
