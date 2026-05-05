/**
 * Post-processors that operate on any wall layout produced by a
 * backend. Run after the backend, before the validation safety net.
 *
 *  - braid(p) knocks down a fraction of dead-end walls. p = 0 is a
 *    no-op; p = 1 removes every dead end (every floor tile has at
 *    least two floor neighbors). Tree-based backends + braid are
 *    the standard recipe for "loopy" mazes.
 *
 *  - pruneDeadEnds(threshold) fills dead-end stubs of length less
 *    than `threshold` with walls. No v1 biome uses this; ships
 *    alongside braid because they're a natural pair.
 *
 * Both refuse to touch entrance/exit tiles, so worst-case they
 * leave the input unchanged but never break feasibility.
 */

import {
    TILE_FLOOR, TILE_WALL,
    getTile, setTile,
} from '../../../mazeRoom/mazeRoomEngine.js';

const DELTAS = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
];

function isProtected(world, x, y) {
    if (world.entrance.x === x && world.entrance.y === y) return true;
    for (const e of world.exits.values()) {
        if (e.x === x && e.y === y) return true;
    }
    return false;
}

function floorNeighborCount(world, x, y) {
    let n = 0;
    for (const d of DELTAS) {
        const nx = x + d.dx;
        const ny = y + d.dy;
        if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
        if (getTile(world, nx, ny) === TILE_FLOOR) n += 1;
    }
    return n;
}

function listDeadEnds(world) {
    const out = [];
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            if (getTile(world, x, y) !== TILE_FLOOR) continue;
            if (isProtected(world, x, y)) continue;
            if (floorNeighborCount(world, x, y) === 1) out.push({ x, y });
        }
    }
    return out;
}

/**
 * Knock down one wall on each dead-end with probability `p`. A wall
 * is eligible if the tile beyond it (one step further in the same
 * direction) is also floor — that's what creates the loop.
 *
 * Walls that don't have floor beyond (boundary walls, wall-bounded
 * corners) are skipped. A dead-end with no eligible walls is left
 * alone — that's the "stuck dead end" case the pruneDeadEnds
 * post-processor would handle if listed afterward.
 */
export function braid(world, params, rng) {
    const p = params?.p ?? 0;
    if (p <= 0) return { knockedDown: 0 };

    const deadEnds = listDeadEnds(world);
    let knockedDown = 0;
    for (const de of deadEnds) {
        if (rng.next() >= p) continue;
        const eligible = [];
        for (const d of DELTAS) {
            const wx = de.x + d.dx;
            const wy = de.y + d.dy;
            const bx = de.x + 2 * d.dx;
            const by = de.y + 2 * d.dy;
            if (wx < 0 || wx >= world.width || wy < 0 || wy >= world.height) continue;
            if (bx < 0 || bx >= world.width || by < 0 || by >= world.height) continue;
            if (getTile(world, wx, wy) !== TILE_WALL) continue;
            if (getTile(world, bx, by) !== TILE_FLOOR) continue;
            if (isProtected(world, wx, wy)) continue;
            eligible.push({ x: wx, y: wy });
        }
        if (eligible.length === 0) continue;
        const pick = eligible[Math.floor(rng.next() * eligible.length)];
        setTile(world, pick.x, pick.y, TILE_FLOOR);
        knockedDown += 1;
    }
    return { knockedDown };
}

/**
 * Fill every dead-end stub of length less than `threshold` with
 * walls. A stub is a corridor that terminates in a dead-end and has
 * no junction along the way. Threshold = 2 fills only single-tile
 * dead ends; threshold = 3 also fills 2-tile stubs; etc.
 *
 * Skips entrance and exit tiles — even a 1-tile dead-end stub at the
 * exit tile stays open.
 */
export function pruneDeadEnds(world, params, _rng) {
    const threshold = params?.threshold ?? 2;
    if (threshold <= 0) return { filled: 0 };

    let filled = 0;
    let changed = true;
    while (changed) {
        changed = false;
        const deadEnds = listDeadEnds(world);
        for (const de of deadEnds) {
            // Walk back along the corridor, filling tiles, up to
            // `threshold` steps. Stop when we hit a junction (>1
            // floor neighbors after the walked-back tile would be
            // filled) or a protected tile.
            let cur = de;
            let steps = 0;
            while (steps < threshold) {
                if (isProtected(world, cur.x, cur.y)) break;
                // Find the unique floor neighbor (or stop).
                let nextN = null;
                let count = 0;
                for (const d of DELTAS) {
                    const nx = cur.x + d.dx;
                    const ny = cur.y + d.dy;
                    if (nx < 0 || nx >= world.width || ny < 0 || ny >= world.height) continue;
                    if (getTile(world, nx, ny) !== TILE_FLOOR) continue;
                    count += 1;
                    nextN = { x: nx, y: ny };
                }
                if (count !== 1) break;
                setTile(world, cur.x, cur.y, TILE_WALL);
                filled += 1;
                changed = true;
                steps += 1;
                cur = nextN;
            }
        }
    }
    return { filled };
}

const POST_PROCESSORS = new Map([
    ['braid', braid],
    ['pruneDeadEnds', pruneDeadEnds],
]);

export function getPostProcessor(id) {
    return POST_PROCESSORS.get(id) ?? null;
}

export function listPostProcessors() {
    return [...POST_PROCESSORS.keys()];
}
