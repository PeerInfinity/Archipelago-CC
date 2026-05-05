/**
 * `kruskals` backend — randomized Kruskal's spanning tree on a half-
 * resolution cell grid. Walks the edges of the cell graph in random
 * order, knocking down each wall whose two cells are in different
 * union-find sets, merging them.
 *
 * Naturally clean for braiding: the post-processor can knock down
 * extra walls (any wall that wasn't selected during the tree pass)
 * to introduce loops without extra bookkeeping.
 */

import { registerBackend } from '../../shared/procgen/mazeAlgorithms/registry.js';
import {
    cellDimensions, wallTileBetween,
    collectFixedTiles, fillBackgroundWalls, carveCellTiles,
    connectFixedTiles, fixedTilesArray,
} from '../../shared/procgen/mazeAlgorithms/cellGrid.js';
import { setTile, TILE_FLOOR } from '../mazeRoomEngine.js';

// Disjoint-set union-find with path compression. Standard, no surprises.
function makeUF(size) {
    const parent = new Int32Array(size);
    for (let i = 0; i < size; i++) parent[i] = i;
    function find(i) {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    }
    function union(a, b) {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb) return false;
        parent[ra] = rb;
        return true;
    }
    return { find, union };
}

function shuffleInPlace(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
}

export const kruskalsBackend = Object.freeze({
    id: 'kruskals',
    name: 'Kruskal\'s',
    cellStep: 2,
    run(world, _params, rng) {
        const { cellW, cellH } = cellDimensions(world);
        if (cellW < 1 || cellH < 1) {
            return { iterations: 0, accepted: 0, rejectedFeasibility: 0, stalled: false };
        }

        const fixedKeys = collectFixedTiles(world);
        fillBackgroundWalls(world, fixedKeys);
        carveCellTiles(world);

        // Build the edge list: every internal cell-cell adjacency.
        const edges = [];
        for (let cy = 0; cy < cellH; cy++) {
            for (let cx = 0; cx < cellW; cx++) {
                if (cx + 1 < cellW) edges.push({ a: { cx, cy }, b: { cx: cx + 1, cy } });
                if (cy + 1 < cellH) edges.push({ a: { cx, cy }, b: { cx, cy: cy + 1 } });
            }
        }
        shuffleInPlace(edges, rng);

        const uf = makeUF(cellW * cellH);
        const cellIdx = (cx, cy) => cy * cellW + cx;

        let iterations = 0;
        let opened = 0;
        for (const e of edges) {
            iterations += 1;
            const ai = cellIdx(e.a.cx, e.a.cy);
            const bi = cellIdx(e.b.cx, e.b.cy);
            if (!uf.union(ai, bi)) continue;
            const wall = wallTileBetween(e.a, e.b);
            setTile(world, wall.x, wall.y, TILE_FLOOR);
            opened += 1;
        }

        connectFixedTiles(world, fixedTilesArray(world));

        return {
            iterations,
            accepted: opened,
            rejectedFeasibility: 0,
            stalled: false,
        };
    },
});

registerBackend(kruskalsBackend);
