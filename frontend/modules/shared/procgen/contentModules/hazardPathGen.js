/**
 * Hazard path generation. Pure procgen helpers for picking the tile
 * sequence a hazard cycles along. The runtime (Phase 2c) consumes
 * these to drive cycle position + facing; this file is geometry-only.
 *
 * Plan: NewDocs/plans/procedural-generation/maze-content-modules.md
 * (Phase 2). User design call (2026-05-10):
 *   - 2/3/5-tile linear paths (straight or bent).
 *   - 4/8-tile loops.
 *   - Cycle math: linear N → 2(N-1) turns (1+2+...+2+1, endpoints
 *     get 1 turn each, midpoints 2 each); loops → N turns.
 *
 * Generation approach: random walk from a seeded tile, matching the
 * user's "first choose available tiles, then fit the shape" idea.
 * Random walk naturally stays inside a contiguous walkable island
 * (4-connected steps), so the "available set" is determined by the
 * seed position. Failures (dead end, no valid neighbor) retry with
 * a fresh seed up to `maxAttempts` times.
 *
 * Loop generation (4 / 8 tiles) is in this same file as
 * `generateLoopPath` — 4-cycles are always 2×2 blocks (only valid
 * 4-cycle shape in a 4-connected grid); 8-cycles use a small template
 * library (3×3 ring, 2×4 perimeter) for v1.
 */

import { TILE_FLOOR } from '../../../mazeRoom/mazeRoomEngine.js';

export const LINEAR_LENGTHS = [2, 3, 5];
export const LOOP_LENGTHS = [4, 8];

export const HAZARD_SHAPE_LINEAR = 'linear';
export const HAZARD_SHAPE_LOOP = 'loop';

const DEFAULT_MAX_ATTEMPTS = 50;

/**
 * Cycle length for a hazard of the given shape + length. Linear
 * paths are traversed bidirectionally (forward to far endpoint,
 * then back); loops are traversed once around per cycle.
 *
 * @param {'linear'|'loop'} shape
 * @param {number} length - tile count
 * @returns {number} number of turns per cycle
 */
export function computeCycleLength(shape, length) {
    if (shape === HAZARD_SHAPE_LINEAR) {
        if (!LINEAR_LENGTHS.includes(length)) {
            throw new Error(`computeCycleLength: linear length must be 2/3/5, got ${length}`);
        }
        return 2 * (length - 1);
    }
    if (shape === HAZARD_SHAPE_LOOP) {
        if (!LOOP_LENGTHS.includes(length)) {
            throw new Error(`computeCycleLength: loop length must be 4/8, got ${length}`);
        }
        return length;
    }
    throw new Error(`computeCycleLength: unknown shape '${shape}'`);
}

function posKey(x, y) {
    return `${x},${y}`;
}

function inBounds(world, x, y) {
    return x >= 0 && y >= 0 && x < world.width && y < world.height;
}

function tileAt(world, x, y) {
    return world.tiles[y * world.width + x];
}

function isWalkable(world, x, y) {
    return inBounds(world, x, y) && tileAt(world, x, y) === TILE_FLOOR;
}

/**
 * Is this tile a valid hazard-path tile under the given options?
 * Reserved tiles (other hazard paths) are always rejected. When
 * `wallOverlapAllowed` is on, wall tiles are accepted; otherwise
 * only floor tiles count.
 */
function isHazardTile(world, x, y, opts, visited) {
    if (!inBounds(world, x, y)) return false;
    if (visited && visited.has(posKey(x, y))) return false;
    if (opts.reservedTiles && opts.reservedTiles.has(posKey(x, y))) return false;
    if (opts.wallOverlapAllowed) return true;
    return tileAt(world, x, y) === TILE_FLOOR;
}

const NEIGHBOR_DELTAS = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
];

/**
 * Collect all valid hazard-tile candidates for a starting seed. The
 * seed itself must be valid (so the path has at least one tile).
 */
function collectSeedCandidates(world, opts) {
    const out = [];
    for (let y = 0; y < world.height; y++) {
        for (let x = 0; x < world.width; x++) {
            if (isHazardTile(world, x, y, opts, null)) {
                out.push({ x, y });
            }
        }
    }
    return out;
}

/**
 * Random-walk from `seed` to a path of exactly `length` tiles. Each
 * step picks a uniformly random valid 4-neighbor (in-bounds,
 * unvisited, hazard-tile per opts). Returns the path on success or
 * null when stuck before reaching length.
 *
 * Visit-tracking is local to the walk — each step's "visited" set
 * extends the previous one. Reserved tiles (other hazard paths)
 * pre-populate the rejection set via opts.reservedTiles.
 */
function randomWalkFrom(seed, length, world, opts, rng) {
    const path = [seed];
    const visited = new Set([posKey(seed.x, seed.y)]);
    while (path.length < length) {
        const cur = path[path.length - 1];
        const candidates = [];
        for (const d of NEIGHBOR_DELTAS) {
            const nx = cur.x + d.dx;
            const ny = cur.y + d.dy;
            if (isHazardTile(world, nx, ny, opts, visited)) {
                candidates.push({ x: nx, y: ny });
            }
        }
        if (candidates.length === 0) return null;
        const next = candidates[Math.floor(rng.next() * candidates.length)];
        path.push(next);
        visited.add(posKey(next.x, next.y));
    }
    return path;
}

/**
 * Generate a linear hazard path of the given length, by repeated
 * random walk from a randomly chosen seed. Returns
 * `{ shape:'linear', length, tiles }` or null if every attempt got
 * stuck.
 *
 * @param {object} world - { width, height, tiles }
 * @param {object} opts
 * @param {number} opts.length - one of LINEAR_LENGTHS (2/3/5)
 * @param {boolean} [opts.wallOverlapAllowed] - allow non-floor tiles in path
 * @param {Set<string>} [opts.reservedTiles] - posKey strings to avoid
 * @param {number} [opts.maxAttempts] - seed retries before giving up (50)
 * @param {{next:()=>number}} rng - seedable PRNG
 */
export function generateLinearPath(world, opts, rng) {
    if (!world?.tiles
        || typeof world.width !== 'number'
        || typeof world.height !== 'number') {
        throw new Error('generateLinearPath: world must have width/height/tiles');
    }
    if (!LINEAR_LENGTHS.includes(opts?.length)) {
        throw new Error(
            `generateLinearPath: length must be one of ${LINEAR_LENGTHS.join('/')}, got ${opts?.length}`,
        );
    }
    if (!rng?.next) throw new Error('generateLinearPath: rng required');
    const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const seedCandidates = collectSeedCandidates(world, opts);
    if (seedCandidates.length === 0) return null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const seed = seedCandidates[Math.floor(rng.next() * seedCandidates.length)];
        const tiles = randomWalkFrom(seed, opts.length, world, opts, rng);
        if (tiles) {
            return {
                shape: HAZARD_SHAPE_LINEAR,
                length: opts.length,
                tiles,
                cycleLength: computeCycleLength(HAZARD_SHAPE_LINEAR, opts.length),
            };
        }
    }
    return null;
}

/**
 * Loop templates for 8-tile loops. Each template is a list of tile
 * offsets (relative to an anchor) that form a closed 4-connected
 * cycle when traversed in order. v1 ships two templates:
 *   - 3×3 ring (8 perimeter tiles, anchor = top-left corner)
 *   - 2×4 perimeter (anchor = top-left)
 * Rotations/reflections are generated implicitly via the 2×4-vs-4×2
 * pair below; the 3×3 ring is rotationally symmetric.
 */
const LOOP_8_TEMPLATES = [
    // 3×3 ring (center may be wall or floor; doesn't matter).
    // Traversal: top row L→R, right column top→down (excluding top),
    // bottom row R→L (excluding right), left column bottom→up
    // (excluding bottom). Forms a closed cycle.
    [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
        { x: 2, y: 1 },
        { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 },
        { x: 0, y: 1 },
    ],
    // 2×4 rectangle perimeter (closed: 2+4+2+4 - 4 corner double-count = 8 tiles)
    [
        { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
        { x: 3, y: 1 },
        { x: 2, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    ],
    // 4×2 (the 2×4 rotated 90°)
    [
        { x: 0, y: 0 }, { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 1, y: 3 }, { x: 0, y: 3 },
        { x: 0, y: 2 },
        { x: 0, y: 1 },
    ],
];

// 2×2 loop — only valid 4-cycle shape in a 4-connected grid.
const LOOP_4_TEMPLATE = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
];

/**
 * Generate a loop hazard path of the given length (4 or 8). Tries
 * templates at randomized anchor positions; first fit wins.
 *
 * For length 4: only the 2×2 block fits as a 4-cycle.
 * For length 8: random template choice, random anchor position.
 *
 * Returns `{ shape:'loop', length, tiles, cycleLength }` or null when
 * no anchor fits.
 */
export function generateLoopPath(world, opts, rng) {
    if (!world?.tiles
        || typeof world.width !== 'number'
        || typeof world.height !== 'number') {
        throw new Error('generateLoopPath: world must have width/height/tiles');
    }
    if (!LOOP_LENGTHS.includes(opts?.length)) {
        throw new Error(
            `generateLoopPath: length must be one of ${LOOP_LENGTHS.join('/')}, got ${opts?.length}`,
        );
    }
    if (!rng?.next) throw new Error('generateLoopPath: rng required');
    const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    const templates = opts.length === 4 ? [LOOP_4_TEMPLATE] : LOOP_8_TEMPLATES;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const template = templates[Math.floor(rng.next() * templates.length)];
        const ax = Math.floor(rng.next() * world.width);
        const ay = Math.floor(rng.next() * world.height);
        const tiles = template.map((p) => ({ x: ax + p.x, y: ay + p.y }));
        if (tiles.every((t) => isHazardTile(world, t.x, t.y, opts, null))) {
            return {
                shape: HAZARD_SHAPE_LOOP,
                length: opts.length,
                tiles,
                cycleLength: computeCycleLength(HAZARD_SHAPE_LOOP, opts.length),
            };
        }
    }
    return null;
}

/**
 * Place multiple hazards on a world. Picks a random shape (linear /
 * loop) and length each attempt, dispatches to the appropriate
 * generator. Successfully-placed hazards reserve their tiles so
 * subsequent attempts don't overlap.
 *
 * Stops when `count` hazards are placed OR after
 * `maxConsecutiveFails` failed attempts in a row (the maze probably
 * has no more room).
 *
 * @param {object} world
 * @param {object} opts
 * @param {number} opts.count - target hazard count
 * @param {number} [opts.maxConsecutiveFails] - early-exit threshold (10)
 * @param {boolean} [opts.wallOverlapAllowed]
 * @param {Array<{shape:string,length:number}>} [opts.shapeMix] -
 *   weighted shape pool. Default: every linear length + every loop
 *   length with equal weight.
 * @param {Iterable<string>} [opts.initialReservedTiles] - posKey
 *   strings ("x,y") that NO hazard tile may occupy. Used by the
 *   procgen pipeline to keep hazards off entrance / exit tiles
 *   (visually awkward + would obscure the spawn point). Seeds the
 *   reserved set before any placement attempt.
 * @param {{next:()=>number}} rng
 * @returns {{ hazards: Array, stopReason: string }}
 */
export function generateHazards(world, opts, rng) {
    const count = opts?.count ?? 0;
    const maxConsecutiveFails = opts?.maxConsecutiveFails ?? 10;
    const shapeMix = opts?.shapeMix ?? defaultShapeMix();
    if (count <= 0 || shapeMix.length === 0) {
        return { hazards: [], stopReason: 'no_request' };
    }
    const hazards = [];
    const reserved = new Set(opts?.initialReservedTiles ?? []);
    let consecutiveFails = 0;
    while (hazards.length < count) {
        if (consecutiveFails >= maxConsecutiveFails) {
            return { hazards, stopReason: 'consecutive_fails' };
        }
        const pick = shapeMix[Math.floor(rng.next() * shapeMix.length)];
        const result = pick.shape === HAZARD_SHAPE_LINEAR
            ? generateLinearPath(world, {
                length: pick.length,
                wallOverlapAllowed: opts.wallOverlapAllowed,
                reservedTiles: reserved,
            }, rng)
            : generateLoopPath(world, {
                length: pick.length,
                wallOverlapAllowed: opts.wallOverlapAllowed,
                reservedTiles: reserved,
            }, rng);
        if (!result) {
            consecutiveFails++;
            continue;
        }
        hazards.push(result);
        for (const t of result.tiles) reserved.add(posKey(t.x, t.y));
        consecutiveFails = 0;
    }
    return { hazards, stopReason: 'all_placed' };
}

function defaultShapeMix() {
    const mix = [];
    for (const length of LINEAR_LENGTHS) mix.push({ shape: HAZARD_SHAPE_LINEAR, length });
    for (const length of LOOP_LENGTHS) mix.push({ shape: HAZARD_SHAPE_LOOP, length });
    return mix;
}

// Exported for tests
export const _internal = { randomWalkFrom, isHazardTile, posKey };
