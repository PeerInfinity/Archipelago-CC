/**
 * `recursive_backtracker` backend — randomized DFS spanning tree on a
 * half-resolution cell grid, rendered to tiles. Picker rule selects
 * between long-corridor feel (`newest`, classic backtracker) and
 * bushy/Prim's-like feel (`random`).
 *
 * Connected by construction (every cell is visited exactly once and
 * carved into the tree).
 */

import { registerBackend } from '../../shared/procgen/mazeAlgorithms/registry.js';
import {
    cellDimensions, cellTileX, cellTileY, wallTileBetween,
    collectFixedTiles, fillBackgroundWalls, carveCellTiles,
    connectFixedTiles, fixedTilesArray,
} from '../../shared/procgen/mazeAlgorithms/cellGrid.js';
import { setTile, TILE_FLOOR } from '../mazeRoomEngine.js';

const PICKERS = Object.freeze({
    // Last-in cell. Long corridors before backtracking — the classic
    // "winding" feel.
    newest: (active, _rng) => active.length - 1,
    // Random cell. Branchier, Prim's-like.
    random: (active, rng) => Math.floor(rng.next() * active.length),
});

export const recursiveBacktrackerBackend = Object.freeze({
    id: 'recursive_backtracker',
    name: 'Recursive Backtracker',
    cellStep: 2,
    run(world, params, rng) {
        const { cellW, cellH } = cellDimensions(world);
        if (cellW < 1 || cellH < 1) {
            return { iterations: 0, accepted: 0, rejectedFeasibility: 0, stalled: false };
        }

        const pickerName = params.picker ?? 'newest';
        const picker = PICKERS[pickerName] ?? PICKERS.newest;

        const fixedKeys = collectFixedTiles(world);
        fillBackgroundWalls(world, fixedKeys);
        carveCellTiles(world);

        const visited = new Uint8Array(cellW * cellH);
        const cellIdx = (cx, cy) => cy * cellW + cx;

        // Start cell: random.
        const startCx = Math.floor(rng.next() * cellW);
        const startCy = Math.floor(rng.next() * cellH);
        visited[cellIdx(startCx, startCy)] = 1;
        const active = [{ cx: startCx, cy: startCy }];

        let iterations = 0;
        let edges = 0;
        while (active.length > 0) {
            iterations += 1;
            const idx = picker(active, rng);
            const { cx, cy } = active[idx];

            const neighbors = [];
            if (cx > 0 && !visited[cellIdx(cx - 1, cy)]) neighbors.push({ cx: cx - 1, cy });
            if (cx < cellW - 1 && !visited[cellIdx(cx + 1, cy)]) neighbors.push({ cx: cx + 1, cy });
            if (cy > 0 && !visited[cellIdx(cx, cy - 1)]) neighbors.push({ cx, cy: cy - 1 });
            if (cy < cellH - 1 && !visited[cellIdx(cx, cy + 1)]) neighbors.push({ cx, cy: cy + 1 });

            if (neighbors.length === 0) {
                active.splice(idx, 1);
                continue;
            }

            const next = neighbors[Math.floor(rng.next() * neighbors.length)];
            const wall = wallTileBetween({ cx, cy }, next);
            setTile(world, wall.x, wall.y, TILE_FLOOR);
            visited[cellIdx(next.cx, next.cy)] = 1;
            active.push(next);
            edges += 1;
        }

        connectFixedTiles(world, fixedTilesArray(world));

        return {
            iterations,
            accepted: edges,
            rejectedFeasibility: 0,
            stalled: false,
        };
    },
});

registerBackend(recursiveBacktrackerBackend);

// Re-export cell helpers for tests; not imported by other modules.
export { cellTileX, cellTileY };
