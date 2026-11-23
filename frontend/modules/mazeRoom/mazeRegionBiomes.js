/**
 * mazeRoom/mazeRegionBiomes — **THE MAZE'S REGION-ONLY BIOMES, AND THE WORLD'S BIOME SETTING** (⛓ CONTENT SETS GEN-1).
 *
 * ⚖ Robert, 2026-11-22: *"This should be controlled by the biome, and the generation settings. What you just made
 * could be called the "randomly placed tiles" biome."* Q7: "Classic now, walls setting later". Q8: "A per-room mix".
 *
 * A REGION BIOME is a named biome an AP maze region can be generated in that is NOT a skeleton kind: a skeleton kind
 * (`procgenCore/skeletonKinds.js` `BIOMES`, one vocabulary across the maze and Seedling, ⚖ ruling 2) is a wall
 * layout, and the constructive mode carves it; a region biome is a skeleton kind (`base`) plus something the REGION
 * generator adds after every roll. `scattered` ("Randomly placed tiles") is `classic` walls plus declared tile kinds
 * placed by `mazeTileKindsGen.js`.
 *
 * ⛔ OUTSIDE THE ENGINE CLOSURE, on purpose. `skeletonKinds.js` and `mazeRoomBiomeLibrary.js` are in the import closure
 * whose md5 the Seedling derived-rule table pins; a row there would move it (and the constructive mode would offer a
 * kind that carves exactly `classic`, a second spelling the table refuses). So the engine never sees a region-biome
 * id: the registry entry's core wrapper hands it the `base` (`engineBiomeOf`), and `mazeLocationCapacity` resolves
 * through the same table, so a `scattered` room is sized exactly as its `classic` twin.
 *
 * THE WORLD SETTING (`params.mazeBiome`, carried by the maze's `buildRegionParams` hook only when not the default):
 *   · one biome id — every procedural maze region whose spec names no biome gets it;
 *   · or a weighted list `[{id, weight}]` — each such region picks one by HASH of (world seed, region id)
 *     (`pickMazeBiome`; FNV-1a, no rng draw), stamped in its sidecar `biome`, so a regenerate reproduces it.
 * A one-element list IS the single id (normalised to it). `classic` alone is the default and records nothing.
 * `params.tileKinds` (`{percent, cap, min}`) overrides a tile-placing biome's numbers.
 *
 * ⚠ Picking a NON-classic wall biome changes that room's walls and so its rules, and (with no rng split: sphere
 * growth, grid growth and the spiral thread one stream through every region) it can shift the draws of later
 * regions. That is those biomes' existing behaviour, chosen on purpose. A mix of `classic` and `scattered` only keeps
 * the compiled logic byte-equal to all-classic (pinned in `mazeTileKindsGen.test.js`).
 */
import { fnv1a32 } from '../procgenCore/contentIdentity.js';
import { DEFAULT_BIOME_ID, kindsOffered } from '../procgenCore/skeletonKinds.js';

/** The world-setting keys, in `params`, `regionParams` and `procgen_metadata[p]` (each only when not the default). */
export const MAZE_BIOME_KEY = 'mazeBiome';
export const TILE_KINDS_KEY = 'tileKinds';
/** The regionParams key the mix's seed rides on (a multi-element mix only; never recorded: the world's seed is). */
export const MAZE_BIOME_SEED_KEY = 'mazeBiomeSeed';

/** The three numbers of a tile-placing biome, with their domains (integers). `min` is also at most `cap`. */
export const TILE_KINDS_DOMAINS = Object.freeze({
    percent: Object.freeze({ min: 0, max: 25, why: 'the share of the room\'s free floor cells to fill, in percent' }),
    cap: Object.freeze({ min: 1, max: 32, why: 'the most kinds one room gets' }),
    min: Object.freeze({ min: 0, max: 32, why: 'the fewest kinds a room with any free cell gets (at most cap)' }),
});

/**
 * THE TABLE. `base` is the skeleton kind the engine builds; `tileKinds` the numbers `mazeTileKindsGen` places by.
 */
export const REGION_BIOMES = Object.freeze({
    scattered: Object.freeze({
        name: 'Randomly placed tiles',
        description: 'Classic walls, then tile kinds the world\'s "what exists" packs opt in (generate: true) placed '
            + 'on free floor by hash, each kept only where the room\'s compiled logic stays exactly as it was.',
        base: 'classic',
        tileKinds: Object.freeze({ percent: 5, cap: 8, min: 1 }),
    }),
});

export class MazeBiomeSettingError extends Error {
    constructor(message) {
        super(`maze biome: ${message}`);
        this.name = 'MazeBiomeSettingError';
    }
}
const fail = (m) => { throw new MazeBiomeSettingError(m); };

export const isRegionBiome = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(REGION_BIOMES, id);

/** Every biome id a maze region may be given: the skeleton kinds the maze offers, then the region biomes. */
export function mazeBiomeIds() {
    return [...kindsOffered({ simulator: true }), ...Object.keys(REGION_BIOMES)];
}

/** True when `id` places tile kinds (a region biome that declares `tileKinds`). */
export const placesTileKinds = (id) => isRegionBiome(id) && !!REGION_BIOMES[id].tileKinds;

/**
 * ⛓ What the ENGINE is handed for a biome reference: a region biome becomes its `base` (its `paramsOverride` kept);
 * anything else is returned as it is. The engine's `resolveBiome` throws on an id `BIOMES` lacks.
 */
export function engineBiomeOf(ref) {
    if (!ref || !isRegionBiome(ref.id)) return ref;
    return { id: REGION_BIOMES[ref.id].base, ...(ref.paramsOverride ? { paramsOverride: ref.paramsOverride } : {}) };
}

/** `{percent, cap, min}` as integers in their domains; refused by name. Missing keys take `defaults`. */
function checkedNumbers(value, defaults, where) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${where} must be an object {percent, cap, min}`);
    for (const k of Object.keys(value)) if (!(k in TILE_KINDS_DOMAINS)) fail(`${where} has unknown field "${k}" (${Object.keys(TILE_KINDS_DOMAINS).join(', ')})`);
    const out = { ...defaults, ...value };
    for (const [k, d] of Object.entries(TILE_KINDS_DOMAINS)) {
        if (!Number.isInteger(out[k]) || out[k] < d.min || out[k] > d.max) {
            fail(`${where}.${k} must be an integer from ${d.min} to ${d.max} (${d.why}); got ${JSON.stringify(out[k])}`);
        }
    }
    if (out.min > out.cap) fail(`${where}.min (${out.min}) is more than its cap (${out.cap})`);
    return out;
}

/**
 * ⛓ The numbers a region of biome reference `ref` places by: the biome's own, under the world's `override`
 * (`params.tileKinds`), under the reference's own `tileKinds` (a regenerated room's stamp wins). Null for a biome that
 * places no tile kinds.
 */
export function resolvedTileKinds(ref, override = null) {
    if (!placesTileKinds(ref?.id)) return null;
    let out = { ...REGION_BIOMES[ref.id].tileKinds };
    if (override) out = checkedNumbers(override, out, 'tileKinds');
    if (ref.tileKinds) out = checkedNumbers(ref.tileKinds, out, `biome "${ref.id}" tileKinds`);
    return out;
}

/** The numbers that differ from the biome's own, or null (what a sidecar stamp or a record carries). */
export function nonDefaultTileKinds(id, numbers) {
    if (!placesTileKinds(id) || !numbers) return null;
    const own = REGION_BIOMES[id].tileKinds;
    const diff = Object.fromEntries(Object.keys(TILE_KINDS_DOMAINS).filter((k) => numbers[k] !== own[k]).map((k) => [k, numbers[k]]));
    return Object.keys(diff).length ? diff : null;
}

/**
 * ⛓ **THE WORLD SETTING, NORMALISED, OR REFUSED BY NAME AT SETTINGS TIME** (never at region time). Returns `null`
 * (the default: absent, `classic`, or a list of `classic` alone), one id (a string), or a weighted list of two or
 * more distinct ids `[{id, weight}]` (weight a positive integer, default 1). A one-element list is its id.
 */
export function normalizeMazeBiomeSetting(value) {
    if (value === undefined || value === null || value === '') return null;
    const known = mazeBiomeIds();
    const checkId = (id, where) => {
        if (!known.includes(id)) fail(`${where} names ${JSON.stringify(id)}, which is not a maze biome (${known.join(', ')})`);
        return id;
    };
    if (typeof value === 'string') return checkId(value, 'mazeBiome') === DEFAULT_BIOME_ID ? null : value;
    if (!Array.isArray(value) || !value.length) fail('mazeBiome must be a biome id or a non-empty list of {id, weight}');
    const seen = new Set();
    const list = value.map((row, i) => {
        const where = `mazeBiome[${i}]`;
        const r = typeof row === 'string' ? { id: row } : row;
        if (!r || typeof r !== 'object' || Array.isArray(r)) fail(`${where} must be {id, weight} or an id`);
        for (const k of Object.keys(r)) if (k !== 'id' && k !== 'weight') fail(`${where} has unknown field "${k}" (id, weight)`);
        checkId(r.id, where);
        if (seen.has(r.id)) fail(`${where} names "${r.id}" twice (give it one row and a weight)`);
        seen.add(r.id);
        const weight = r.weight ?? 1;
        if (!Number.isInteger(weight) || weight < 1) fail(`${where}.weight must be a positive integer; got ${JSON.stringify(r.weight)}`);
        return { id: r.id, weight };
    });
    if (list.length === 1) return list[0].id === DEFAULT_BIOME_ID ? null : list[0].id;
    return list;
}

/** The ids a normalised setting can give a region (`classic` for the default). */
export const settingIds = (setting) => (setting === null ? [DEFAULT_BIOME_ID]
    : typeof setting === 'string' ? [setting] : setting.map((r) => r.id));

/**
 * ⛓ **THE REGION'S BIOME, PICKED BY HASH** — `{id}` for a region whose spec names no biome, or null (the engine's
 * default, `classic`). A list picks `hash32("<seed>:<region id>") mod (total weight)` over the rows in order: no rng
 * draw, so no other roll moves.
 */
export function pickMazeBiome(setting, seed, regionId) {
    if (setting === null || setting === undefined) return null;
    if (typeof setting === 'string') return { id: setting };
    const total = setting.reduce((n, r) => n + r.weight, 0);
    let at = parseInt(fnv1a32(`${seed ?? 0}:${regionId ?? ''}`), 16) % total;
    for (const r of setting) {
        if (at < r.weight) return r.id === DEFAULT_BIOME_ID ? null : { id: r.id };
        at -= r.weight;
    }
    /* c8 ignore next */
    return null;
}

/**
 * ⛓ **THE MAZE'S `buildRegionParams`** — the world settings a region reads, each ONLY when not the default, so a world
 * that sets neither takes no new key (every committed preset is byte-equal). Refuses by name: an unknown biome, a bad
 * weight, numbers out of their domains, and `tileKinds` on a setting with no tile-placing biome.
 */
export function mazeBiomeRegionParams({ params = {} } = {}) {
    const setting = normalizeMazeBiomeSetting(params?.[MAZE_BIOME_KEY]);
    const out = {};
    if (setting !== null) out[MAZE_BIOME_KEY] = Array.isArray(setting) ? setting.map((r) => ({ ...r })) : setting;
    if (Array.isArray(setting)) out[MAZE_BIOME_SEED_KEY] = Number.isInteger(params?.seed) ? params.seed : 0;
    const override = params?.[TILE_KINDS_KEY];
    if (override !== undefined && override !== null) {
        const placing = settingIds(setting).filter(placesTileKinds);
        if (!placing.length) {
            fail(`tileKinds is set, but no biome of mazeBiome (${settingIds(setting).join(', ')}) places tile kinds `
                + `(${Object.keys(REGION_BIOMES).filter(placesTileKinds).join(', ')} do)`);
        }
        const numbers = checkedNumbers(override, REGION_BIOMES[placing[0]].tileKinds, 'tileKinds');
        const diff = nonDefaultTileKinds(placing[0], numbers);
        if (diff) out[TILE_KINDS_KEY] = diff;
    }
    return out;
}

/** ⛓ The registry hook `regionBiomeOf({params, regionId})`: the region's picked biome reference, or null. */
export function regionBiomeOf({ params = {}, regionId } = {}) {
    return pickMazeBiome(params?.[MAZE_BIOME_KEY] ?? null, params?.[MAZE_BIOME_SEED_KEY], regionId);
}
