/**
 * `recursive_division` backend — start from an all-floor grid, then
 * recursively partition each sub-rectangle with a single wall line
 * containing one gap. Produces room-and-corridor layouts that look
 * less "perfect maze" and more "broken into chambers."
 *
 * Tile-resolution (cellStep: 1). Doesn't need the cell-grid scaffold
 * the tree backends use — the algorithm is naturally tile-based.
 *
 * Fixed-floor tiles (entrance + exits) are skipped when stamping a
 * wall line, so any wall crossing them naturally leaves a passage.
 * Combined with the explicit gap, every partition step opens at
 * least one connection between the two sub-rectangles, which is what
 * the algorithm needs for connectivity.
 */

import { registerBackend } from '../../shared/procgen/mazeAlgorithms/registry.js';
import { collectFixedTiles, repairConnectivity } from '../../shared/procgen/mazeAlgorithms/cellGrid.js';
import { setTile, TILE_WALL } from '../mazeRoomEngine.js';

const DEFAULT_MIN_ROOM = 3;

function divide(world, fixedKeys, rng, x, y, w, h, minRoom, stats) {
    if (w <= minRoom || h <= minRoom) return;

    let horizontal;
    if (w >= h * 1.5) horizontal = false;
    else if (h >= w * 1.5) horizontal = true;
    else horizontal = rng.next() < 0.5;

    if (horizontal) {
        // Wall row inside (y, y+h-1) — avoid the edges.
        if (h <= 2) return;
        const wallY = y + 1 + Math.floor(rng.next() * (h - 2));
        const gapX = x + Math.floor(rng.next() * w);
        for (let cx = x; cx < x + w; cx++) {
            if (cx === gapX) continue;
            if (fixedKeys.has(`${cx},${wallY}`)) continue;
            setTile(world, cx, wallY, TILE_WALL);
            stats.walls += 1;
        }
        divide(world, fixedKeys, rng, x, y, w, wallY - y, minRoom, stats);
        divide(world, fixedKeys, rng, x, wallY + 1, w, y + h - wallY - 1, minRoom, stats);
    } else {
        if (w <= 2) return;
        const wallX = x + 1 + Math.floor(rng.next() * (w - 2));
        const gapY = y + Math.floor(rng.next() * h);
        for (let cy = y; cy < y + h; cy++) {
            if (cy === gapY) continue;
            if (fixedKeys.has(`${wallX},${cy}`)) continue;
            setTile(world, wallX, cy, TILE_WALL);
            stats.walls += 1;
        }
        divide(world, fixedKeys, rng, x, y, wallX - x, h, minRoom, stats);
        divide(world, fixedKeys, rng, wallX + 1, y, x + w - wallX - 1, h, minRoom, stats);
    }
}

export const recursiveDivisionBackend = Object.freeze({
    id: 'recursive_division',
    name: 'Recursive Division',
    cellStep: 1,
    run(world, params, rng) {
        const minRoom = params.minRoom ?? DEFAULT_MIN_ROOM;
        // Tiles start as floor (createWorld initialized them to 0).
        // Just run the partition.
        const fixedKeys = collectFixedTiles(world);
        const stats = { walls: 0 };
        divide(world, fixedKeys, rng, 0, 0, world.width, world.height, minRoom, stats);
        // Recursive-division's parent-gap-alignment invariant is
        // tricky to enforce during the recursion; repair the rare
        // disconnect after the fact instead.
        repairConnectivity(world);
        return {
            iterations: 1,
            accepted: stats.walls,
            rejectedFeasibility: 0,
            stalled: false,
        };
    },
});

registerBackend(recursiveDivisionBackend);
