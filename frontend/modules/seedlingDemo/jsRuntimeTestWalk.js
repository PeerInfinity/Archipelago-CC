/**
 * seedlingDemo/jsRuntimeTestWalk — **A TEST'S FINGERS, NOT A BOT** (Seedling JS
 * runtime J1).
 *
 * The J1 rows (node and in-app) have to walk a generated room by KEYS — the
 * same keys a person presses — to a cell: the apitem, a door, a pit. This is
 * the smallest thing that can: a breadth-first route over the room's open
 * cells and a steer that holds the one or two arrows pointing at the next
 * cell's centre, read off the live position every tick (closed loop, so a
 * wall's push-back or a knock cannot desynchronise it).
 *
 * ⛔ NOT THE PLAYBACK CONTROLLER. That is slice J2 (planned against the live
 * run with `planWaypoints`, held for the swim arc's U12). This knows nothing
 * of hazards beyond "do not route over them", nothing of enemies, and nothing
 * of ceremonies — the runtime's own auto-advance presses through those.
 *
 * DOM-free and dependency-light so the browser row can import it.
 */

import { buildLevelWorld, TILE_SIZE } from './levelWorld.js';

/** Terrain types a route must not cross: pit, water, lava, waterfall. */
export const ROUTE_FORBIDDEN_TILE_TYPES = Object.freeze([6, 1, 17, 25]);

const key = (c) => `${c.tx},${c.ty}`;

/** The open cells of a record: a tile, not solid, not forbidden terrain. */
export function openCellsOf(record, { allow = [] } = {}) {
    const world = buildLevelWorld(record);
    const blocked = new Set();
    for (const s of [...world.solids, ...world.objectSolids]) {
        blocked.add(key({ tx: Math.floor(s.rect.x / TILE_SIZE), ty: Math.floor(s.rect.y / TILE_SIZE) }));
    }
    for (const tp of world.teleporters) blocked.add(key({ tx: tp.x / TILE_SIZE, ty: tp.y / TILE_SIZE }));
    const open = new Set();
    for (const t of world.tiles) {
        const c = { tx: Math.floor(t.rect.x / TILE_SIZE), ty: Math.floor(t.rect.y / TILE_SIZE) };
        if (blocked.has(key(c)) || ROUTE_FORBIDDEN_TILE_TYPES.includes(t.t)) continue;
        open.add(key(c));
    }
    for (const c of allow) open.add(key(c));
    return open;
}

/** Shortest 4-neighbour route of cells from `from` to `to` (both included), or null. */
export function tileRoute(record, from, to, opts = {}) {
    const open = openCellsOf(record, { allow: [from, to, ...(opts.allow ?? [])] });
    const prev = new Map([[key(from), null]]);
    const queue = [from];
    while (queue.length) {
        const c = queue.shift();
        if (c.tx === to.tx && c.ty === to.ty) {
            const out = [];
            for (let k = key(c), cur = c; cur; k = prev.get(k) ? key(prev.get(k)) : null) {
                out.unshift(cur);
                cur = prev.get(k);
                if (!cur) break;
            }
            return out;
        }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const n = { tx: c.tx + dx, ty: c.ty + dy };
            if (!open.has(key(n)) || prev.has(key(n))) continue;
            prev.set(key(n), c);
            queue.push(n);
        }
    }
    return null;
}

/** The cell a position stands in. */
export const cellOf = (x, y) => ({ tx: Math.floor(x / TILE_SIZE), ty: Math.floor(y / TILE_SIZE) });

/** The tape keys that move (x, y) toward the centre of `cell`; empty when there. */
export function steerToward(x, y, cell, tolerance = 1) {
    const cx = cell.tx * TILE_SIZE + TILE_SIZE / 2;
    const cy = cell.ty * TILE_SIZE + TILE_SIZE / 2;
    const held = new Set();
    if (x < cx - tolerance) held.add('right');
    else if (x > cx + tolerance) held.add('left');
    if (y < cy - tolerance) held.add('down');
    else if (y > cy + tolerance) held.add('up');
    return held;
}

/**
 * A closed-loop walker over a route: call `next(x, y)` each tick for the keys
 * to hold; it advances along the route as each cell's centre is reached and
 * answers an empty set at the end.
 */
export function routeWalker(route, { tolerance = 1 } = {}) {
    let i = 1;
    return {
        get done() { return i >= route.length; },
        get target() { return route[Math.min(i, route.length - 1)]; },
        next(x, y) {
            while (i < route.length) {
                const held = steerToward(x, y, route[i], tolerance);
                if (held.size > 0) return held;
                i += 1;
            }
            return new Set();
        },
    };
}
