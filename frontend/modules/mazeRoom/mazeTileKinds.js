/**
 * mazeRoom/mazeTileKinds — **A PACK-DECLARED TILE KIND, PLACED ON A FLOOR CELL** (⛓ CONTENT SETS TILE-3).
 *
 * TILE-2 let a pack's concept row declare a tile kind (`base` beside `art`; `packConcepts.PACK_TILE_BASES`) and gave
 * the one lookup kind → `{ artKey, base }` (`mazeTileArt.mazeTileKind`). This file is where a world CARRIES such a
 * kind: the optional per-region field `tileKinds: [{x, y, kind}]`, `kind` a pack concept key.
 *
 * ⚖ The user, 2026-11-17: placement is "Editor first, then generator", and for passability "we can go with 'placed
 * kinds are walkable' for now". So:
 *   · ⛔ NO LOGIC. A placed kind is look-only and walkable: it stands on a FLOOR cell, the grid under it stays floor,
 *     and nothing that reads reachability (the engine, the extractor, the compiler) ever sees the field. The engine's
 *     own `deserializeMazeWorld` (in the engine closure) drops it; `withTileKinds` copies it back afterwards, as
 *     `mazeThings.thingsDeserializer` does for `things`.
 *   · Only the EDITOR writes it today (`mazeRoomEditor`'s `setTileKind`); no generator rule places one.
 *
 * ⛔ REFUSED BY NAME (`TILE_KIND_REFUSALS`):
 *   · at the payload (`withTileKinds`, no packs needed): a malformed list, a cell out of bounds, a cell that is not
 *     FLOOR, two kinds on one cell;
 *   · against the world's loaded packs (`tileKindRefusal`; the editor's op, and the views' check once the stack has
 *     loaded): a kind no loaded pack declares, and a kind whose base is `wall` — a placed kind is walkable, so a wall
 *     look would lie about the cell;
 *   · at the editor: a cell the occupancy rule names (`occupiedWorldCells`, `mazeThings`' rule: anything else the
 *     world places there).
 * A DRAW never throws: a kind the stack does not declare draws TILE-1's placeholder (`drawMazeTile`).
 *
 * ⛔ OUTSIDE THE ENGINE CLOSURE. This file imports from the engine (the closure is what the engine imports, not what
 * imports it), and nothing in the closure imports this file (`mazeTileKinds.test.js` pins it). The PAINTER is its
 * sibling, `mazeTileKindOverlay.js`, so this half imports no art code (the editor and the generator import it).
 */
import { KEY_PATTERN } from '../contentPacks/contentPacks.js';
import { TILE_FLOOR, deserializeMazeWorld, getTile } from './mazeRoomEngine.js';
import { tileKindsList } from './mazeSerializer.js';

/** The payload field. */
export const TILE_KINDS_FIELD = 'tileKinds';

/** The refusals, by reason → sentence. */
export const TILE_KIND_REFUSALS = Object.freeze({
    malformed: (what) => `tileKinds: ${what}`,
    outOfBounds: (x, y) => `tileKinds: cell (${x},${y}) is outside the grid`,
    notFloor: (x, y, kind) => `tileKinds: "${kind}" at (${x},${y}) is not on a floor cell (a placed kind stands on floor)`,
    duplicate: (x, y) => `tileKinds: two kinds on cell (${x},${y})`,
    undeclared: (kind, declared) => `tile kind "${kind}" is declared by no loaded pack`
        + ` (the stack declares ${declared.length ? declared.map((k) => `"${k}"`).join(', ') : 'none'})`,
    wallBase: (kind) => `tile kind "${kind}" has base "wall": a placed kind is walkable (⚖ 2026-11-17), so a wall look `
        + 'would lie about the cell',
    occupied: (x, y) => `cell (${x},${y}) already holds something (an entity, an exit, the entrance or a thing): `
        + 'a tile kind goes on an empty floor cell',
});

export class MazeTileKindError extends Error {
    constructor(message) {
        super(message);
        this.name = 'MazeTileKindError';
    }
}

const cellKey = (x, y) => `${x},${y}`;

/** The world's placed kinds as the payload writes them (`mazeSerializer.tileKindsList`, re-exported). */
export { tileKindsList };

/**
 * ⛓ THE PAYLOAD CHECK — `list` (a payload's `tileKinds`) against the grid it sits on; returns the `Map("x,y" → kind)`
 * or throws `MazeTileKindError` by name. Needs no packs: whether a kind is DECLARED is `tileKindRefusal`'s question.
 */
export function tileKindsFromList(list, { width, height, isFloor }) {
    if (!Array.isArray(list)) throw new MazeTileKindError(TILE_KIND_REFUSALS.malformed(`must be an array, got ${JSON.stringify(list)}`));
    const out = new Map();
    for (const [i, rec] of list.entries()) {
        if (!rec || typeof rec !== 'object' || Array.isArray(rec)) {
            throw new MazeTileKindError(TILE_KIND_REFUSALS.malformed(`entry ${i} is not an object`));
        }
        const extra = Object.keys(rec).filter((k) => !['x', 'y', 'kind'].includes(k));
        if (extra.length) throw new MazeTileKindError(TILE_KIND_REFUSALS.malformed(`entry ${i} has unknown field "${extra[0]}" (x, y, kind)`));
        const { x, y, kind } = rec;
        if (!Number.isInteger(x) || !Number.isInteger(y)) throw new MazeTileKindError(TILE_KIND_REFUSALS.malformed(`entry ${i} has no integer x, y`));
        if (typeof kind !== 'string' || !KEY_PATTERN.test(kind)) {
            throw new MazeTileKindError(TILE_KIND_REFUSALS.malformed(`entry ${i}: kind ${JSON.stringify(kind)} is not a pack concept key`));
        }
        if (x < 0 || y < 0 || x >= width || y >= height) throw new MazeTileKindError(TILE_KIND_REFUSALS.outOfBounds(x, y));
        if (!isFloor(x, y)) throw new MazeTileKindError(TILE_KIND_REFUSALS.notFloor(x, y, kind));
        if (out.has(cellKey(x, y))) throw new MazeTileKindError(TILE_KIND_REFUSALS.duplicate(x, y));
        out.set(cellKey(x, y), kind);
    }
    return out;
}

/**
 * Copy `payload.tileKinds` onto a deserialized `world` (checked against the world's own grid). Absent or empty: the
 * world is returned untouched. Returns the world.
 */
export function withTileKinds(world, payload) {
    const list = payload?.[TILE_KINDS_FIELD];
    if (list === undefined) return world;
    const map = tileKindsFromList(list, {
        width: world.width, height: world.height, isFloor: (x, y) => getTile(world, x, y) === TILE_FLOOR,
    });
    if (map.size) world.tileKinds = map;
    return world;
}

/** The engine's deserializer, then the payload's placed kinds. */
export function deserializeMazeWorldWithKinds(payload, opts) {
    return withTileKinds(opts === undefined ? deserializeMazeWorld(payload) : deserializeMazeWorld(payload, opts), payload);
}

/** The registry entry's `deserializeWorld` wrapper (the `thingsDeserializer` pattern). */
export const tileKindsDeserializer = (deserialize) => (payload, ...rest) => withTileKinds(deserialize(payload, ...rest), payload);

/**
 * ⛓ AGAINST THE WORLD'S LOADED PACKS: `declared` is the stack's declared kinds (`mazeTileArt.tileKindKeys`, e.g. the
 * load's `tileKinds`). Returns `{ reason, description }` or null.
 */
export function tileKindRefusal(kind, declared) {
    const has = declared && Object.prototype.hasOwnProperty.call(declared, kind);
    if (!has) return { reason: 'undeclared-tile-kind', description: TILE_KIND_REFUSALS.undeclared(kind, Object.keys(declared ?? {})) };
    if (declared[kind].base === 'wall') return { reason: 'wall-base-tile-kind', description: TILE_KIND_REFUSALS.wallBase(kind) };
    return null;
}

/** Every placed kind of `world` that `declared` refuses: `[{ x, y, kind, reason, description }]`, row order. */
export function placedTileKindRefusals(world, declared) {
    return (tileKindsList(world) ?? []).flatMap(({ x, y, kind }) => {
        const r = tileKindRefusal(kind, declared);
        return r ? [{ x, y, kind, ...r }] : [];
    });
}

/**
 * ⛓ THE OCCUPANCY RULE on a deserialized world (`mazeThings.freeFloorCells`' rule, read off the world instead of the
 * payload): every cell anything else names — a `Map` key `"x,y"`, a record's `{x, y}`, a `"x,y"` string — anywhere
 * but `tiles` and `tileKinds`. `things` count (a thing stands on its cell).
 */
export function occupiedWorldCells(world) {
    const out = new Set();
    const seen = new Set();
    const walk = (v) => {
        if (v === null || v === undefined) return;
        if (typeof v === 'string') { if (/^\d+,\d+$/.test(v)) out.add(v); return; }
        if (typeof v !== 'object' || seen.has(v) || ArrayBuffer.isView(v)) return;
        seen.add(v);
        if (v instanceof Map) { for (const [k, val] of v) { walk(k); walk(val); } return; }
        if (v instanceof Set) { for (const val of v) walk(val); return; }
        if (Array.isArray(v)) { v.forEach(walk); return; }
        if (Number.isInteger(v.x) && Number.isInteger(v.y)) out.add(cellKey(v.x, v.y));
        for (const val of Object.values(v)) walk(val);
    };
    for (const [k, v] of Object.entries(world ?? {})) if (k !== 'tiles' && k !== TILE_KINDS_FIELD) walk(v);
    return out;
}
