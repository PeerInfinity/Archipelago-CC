/**
 * mazeRoom/mazeThings — **A MAZE REGION'S THING: A CHARACTER, AN OBJECT OR A PIECE OF INFORMATION ON A FLOOR CELL**
 * (⛓ CONTENT SETS S2; the step 3 design §3).
 *
 * A thing is NOT an AP check and NOT a tile (⚖ the user, 2026-11-14): look-only (read, never picked up or used,
 * nothing depends on it); one per maze region when the world's theme offers any (a character may stand in several
 * regions); it stands on a cell that is already plain floor, and the player walks onto it to read it and keeps
 * walking. It is a record `{x, y, …}` in a list beside the grid: the `tiles` array and the obstacle, item and block
 * maps are untouched, so every reader of reachability reads what it read before.
 *
 * ⛔ OUTSIDE THE ENGINE CLOSURE. The maze engine (`mazeRoomEngine.js`) is in the import closure of
 * `tileSpike/certifyPlaythroughMaze.js`, whose md5 the Seedling derived-rule table pins; the engine never learns
 * that things exist. This file wraps the registry entry's hooks instead (`mazeRoomLibrary.js`), as
 * `mazeContent.js` wraps them for the looks:
 *
 *   · `thingsRegionCore(core)` — after the engine's `generateRegionCore`, records WHAT the region holds (concept,
 *     name, look, text), with no position: the cell is not known until the world is final;
 *   · `thingsSerializer(serialize)` — after the engine's serializer returns, gives each position-less thing a free
 *     floor cell (`placeThings`) and writes `things`; absent when there is none, so a world with no theme is
 *     byte-equal;
 *   · `thingsDeserializer(deserialize)` — copies `things` back onto the world, which the engine's deserializer
 *     (a copier of named fields) would drop.
 *
 * ⛔ NO RNG DRAW anywhere here. Every choice is a hash (`hash32`, FNV-1a): the holder and the information by
 * `<rng state>:<region id>:holder|info` (the rng's state is READ, never advanced — the text adventure's
 * `roomThings` rule), the cell by `<region id>:<concept key>` over the free cells in row order. A draw would shift
 * the region's later draws, and the world's logic would no longer be the control's.
 */

import { fnv1a32 } from '../procgenCore/contentIdentity.js';
import { fillTemplate } from '../textLibrary/textLibrary.js';
import { resolveRole } from '../procgenCore/contentRoles.js';
import { MAZE_CHARACTER_TEXT_SLOTS, MAZE_CONTENT_ROLES, MAZE_INFO_TEXT_SLOTS } from './mazeContent.js';
import { MAZE_THING_KINDS } from './mazeSerializer.js';

/** The kinds of thing a maze region may hold (a pack concept kind each; the role of the same name). Declared beside the payload field. */
export { MAZE_THING_KINDS };

/** The text variant the maze asks for (`resolveRole`'s `variant`): a pack's `<key>/maze` line wins over `<key>`. */
export const MAZE_TEXT_VARIANT = 'maze';

/** The `TILE_FLOOR` value of the grid vocabulary (`gridTiles.js`), read off a serialized payload's `tiles`. */
const FLOOR = 0;

/** FNV-1a, 32-bit, as an unsigned integer (the text adventure's `hash32`; `contentIdentity.fnv1a32`'s hex). */
export const hash32 = (str) => parseInt(fnv1a32(str), 16);

/**
 * ⛓ **WHAT A REGION HOLDS** — the thing records of one maze region, with NO position, or `[]`. One HOLDER from the
 * `character` and `object` roles (characters first, then objects, each latest pack first, through the contract's
 * `resolveRole`) and one piece of INFORMATION from the `info` role, each by hash; with both, the holder carries it.
 * Information alone is a thing of kind `info` (drawn as a sign). ⛔ A concept that presents a mechanic fills no
 * kind role (the contract), and no default pack offers a character, object or information, so a world with no
 * theme gets none and nothing is read.
 *
 * Baked (Q8): the holder's `look` (`color`, `symbol`), its `description`, a character's `says` and the
 * information's `body`, each text resolved with the variant `maze` and `{regionId}` filled. ⚠ Not HTML-escaped:
 * the maze shows text as text (`textContent`), never as markup. Any other placeholder is left as written.
 *
 * @param {object|null|undefined} contentSet the region's `params.contentSet`
 * @param {string} regionId
 * @param {number|string} rngState the region rng's state, READ (`rng.getState()`), or 0
 */
export function regionThings(contentSet, regionId, rngState = 0) {
    if (!contentSet) return [];
    const roles = MAZE_CONTENT_ROLES;
    const opts = { variant: MAZE_TEXT_VARIANT };
    const holders = [...resolveRole(roles, 'character', contentSet, opts), ...resolveRole(roles, 'object', contentSet, opts)];
    const infos = resolveRole(roles, 'info', contentSet, opts);
    if (!holders.length && !infos.length) return [];
    const pick = (list, what) => (list.length ? list[hash32(`${rngState}:${regionId}:${what}`) % list.length] : null);
    const bake = (t) => fillTemplate(t, { regionId });
    const holder = pick(holders, 'holder');
    const info = pick(infos, 'info');
    const infoRecord = info ? {
        concept: info.key,
        name: info.concept.name,
        ...Object.fromEntries(MAZE_INFO_TEXT_SLOTS.map((slot) => [slot, bake(info.text[slot])])),
    } : null;
    if (!holder) return [{ id: 'thing_0', kind: 'info', concept: info.key, name: info.concept.name, info: infoRecord }];
    const c = holder.concept;
    return [{
        id: 'thing_0',
        kind: c.kind,
        concept: holder.key,
        name: c.name,
        color: c.look.color,
        symbol: c.look.symbol,
        ...(c.description ? { description: c.description } : {}),
        ...(c.kind === 'character'
            ? Object.fromEntries(MAZE_CHARACTER_TEXT_SLOTS.map((slot) => [slot, bake(holder.text[slot])])) : {}),
        ...(infoRecord ? { info: infoRecord } : {}),
    }];
}

/** Every cell a serialized payload names by `{x, y}` or `"x,y"`, anywhere but its `tiles` and `things`. */
function occupiedCells(payload) {
    const out = new Set();
    const walk = (v) => {
        if (Array.isArray(v)) { v.forEach(walk); return; }
        if (typeof v === 'string') { if (/^\d+,\d+$/.test(v)) out.add(v); return; }
        if (!v || typeof v !== 'object') return;
        if (Number.isInteger(v.x) && Number.isInteger(v.y)) out.add(`${v.x},${v.y}`);
        for (const val of Object.values(v)) walk(val);
    };
    for (const [k, v] of Object.entries(payload ?? {})) if (k !== 'tiles' && k !== 'things') walk(v);
    return out;
}

/**
 * ⛓ **THE FREE FLOOR CELLS** of a serialized maze payload, as `[{x, y}]` in row order: a floor cell that no other
 * record of the payload names — not the entrance, an exit, an item, an obstacle, a block, a button, a trap or its
 * lane, a pull, a pulser, a hazard's path, a mana or consumable tile, nor anything a later field adds, because the
 * rule is "any `{x, y}` or `"x,y"` the payload holds", not a list of fields.
 */
export function freeFloorCells(payload) {
    const { width, height, tiles } = payload ?? {};
    if (!Array.isArray(tiles) || !Number.isInteger(width) || !Number.isInteger(height)) return [];
    const taken = occupiedCells(payload);
    const out = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (tiles[y * width + x] === FLOOR && !taken.has(`${x},${y}`)) out.push({ x, y });
        }
    }
    return out;
}

/**
 * ⛓ **EACH THING ITS CELL.** A thing that already has a position (a rebuilt or re-derived world) keeps it while
 * that cell is still free floor; any other takes the free cell `hash32("<region id>:<concept key>") mod (free
 * count)`, and that cell is then taken. A region with no free cell gets no thing — not a refusal. Returns the
 * placed records, `{id, x, y, …the rest in its own order}`.
 *
 * @param {object} payload the serialized payload (the cells are read off it)
 * @param {object[]} things the region's thing records
 * @param {string} regionId
 */
export function placeThings(payload, things, regionId) {
    if (!Array.isArray(things) || !things.length) return [];
    const free = freeFloorCells(payload);
    const freeKey = (x, y) => free.findIndex((c) => c.x === x && c.y === y);
    const placed = [];
    const pending = [];
    for (const t of things) {
        const at = Number.isInteger(t?.x) && Number.isInteger(t?.y) ? freeKey(t.x, t.y) : -1;
        if (at >= 0) { free.splice(at, 1); placed.push(t); } else pending.push(t);
    }
    for (const t of pending) {
        if (!free.length) continue;
        const [cell] = free.splice(hash32(`${regionId ?? ''}:${t.concept}`) % free.length, 1);
        const { id, x: _x, y: _y, ...rest } = t;
        placed.push({ id, x: cell.x, y: cell.y, ...rest });
    }
    const order = new Map(things.map((t, i) => [t.id, i]));
    return placed.sort((a, b) => order.get(a.id) - order.get(b.id));
}

const copyThings = (things) => JSON.parse(JSON.stringify(things));

/**
 * The registry entry's `generateRegionCore`: the engine's (with `mazeContent`'s presentation pass), then the region's
 * things recorded on the world, position-less. The rng's state is read BEFORE the core runs. The engine's return
 * value is passed through unchanged.
 */
export const thingsRegionCore = (core) => (input = {}) => {
    const state = typeof input.rng?.getState === 'function' ? input.rng.getState() : 0;
    const out = core(input);
    const things = regionThings(input.params?.contentSet, input.region_id, state);
    if (out?.world && things.length) out.world.things = things;
    return out;
};

/**
 * The registry entry's `serializeWorld`: the engine's serializer, then `things` placed and written last — absent
 * when the world holds none or none found a cell. The region id is the extracted rules' (`region_id`).
 */
export const thingsSerializer = (serialize) => (world, extractedRules, ...rest) => {
    const out = serialize(world, extractedRules, ...rest);
    const placed = placeThings(out, world?.things, extractedRules?.region_id);
    if (placed.length) out.things = copyThings(placed);
    return out;
};

/** The registry entry's `deserializeWorld`: the engine's deserializer, then `things` copied onto the world. */
export const thingsDeserializer = (deserialize) => (payload, ...rest) => {
    const world = deserialize(payload, ...rest);
    if (Array.isArray(payload?.things) && payload.things.length) world.things = copyThings(payload.things);
    return world;
};

/**
 * ⛓ The round trip's re-seat (`mazeRegionRoundTrip.save`): a saved payload's things kept on cells that are still
 * free floor after the edit, the rest moved by the hash rule, none where no cell is free. Same object when the
 * payload has no things.
 */
export function reseatThings(payload, regionId) {
    if (!Array.isArray(payload?.things) || !payload.things.length) return payload;
    const placed = placeThings(payload, payload.things, regionId);
    const { things: _old, ...rest } = payload;
    return placed.length ? { ...payload, things: copyThings(placed) } : rest;
}
