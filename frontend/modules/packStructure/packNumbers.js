/**
 * packStructure/packNumbers — **THE NUMBERS: ONE SET PER GAME** (⛓ CONTENT SETS
 * PL-1; Z.4, ⚖ the user 2026-11-15).
 *
 * The `numbers` layer of a content pack:
 *
 *     { "schema_version": 1, "provenance": { … },
 *       "sets": {
 *         "<substrate id>": {                     // the game this set is for
 *           "exists":  "<pack id>",               // the pack whose structure it prices
 *           "economy": { … },                     // game-wide constants; free-form per game
 *           "values":  { "<structure id>": { "<value path>": <number | { <name>: <number> }> } },
 *           "src":     "<source id>"              // optional (Z.7)
 *         } } }
 *
 * A VALUE PATH is a part name, optionally followed by an id and a field:
 * `time`, `limit`, `max`, `requires.<id>.<field>`, `results.<id>`,
 * `modifies.<part>` (a `modifies` part: `time`, `limit`, `results.<id>`,
 * `requires.<id>`). Only the named game reads the values, in its own units.
 *
 * ⛔ A NUMBERS SET IS FOR ONE GAME AND ONE "WHAT EXISTS" (Z.5): a world uses it
 * only when its `sets` key is the world's substrate and its `exists` is in the
 * world's `exists` list. `numbersSelectionRefusal` says so by name.
 *
 * Pure and DOM-free: it takes a LOADED stack.
 */
import { ContentPackError, PACK_ID_PATTERN } from '../contentPacks/contentPacks.js';
import { parseModifiesPart, parseStructureId } from './packStructure.js';

/** A substrate id (a `sets` key): lower case, digits, underscores (`action_nodes`). */
export const SUBSTRATE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
/** The fields a set may carry. */
export const SET_FIELDS = Object.freeze(['exists', 'economy', 'values', 'src']);
/** The heads of a value path. */
export const VALUE_PATH_HEADS = Object.freeze(['time', 'limit', 'max', 'requires', 'results', 'modifies']);

const MANIFEST_FIELDS = Object.freeze(['schema_version', 'sets', 'provenance', '_comment']);
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const fail = (message) => { throw new ContentPackError(`pack numbers: ${message}`); };

/**
 * A value path → `{ head, id?, field?, part? }`, or null when it is not one of
 * the forms above. Ids carry no `.`, so the path splits on the first ones.
 */
export function parseValuePath(path) {
    if (typeof path !== 'string') return null;
    if (path === 'time' || path === 'limit' || path === 'max') return { head: path };
    let m = /^requires\.([^.]+)\.([a-z_][a-z0-9_]*)$/.exec(path);
    if (m && parseStructureId(m[1])) return { head: 'requires', id: m[1], field: m[2] };
    m = /^results\.([^.]+)$/.exec(path);
    if (m && parseStructureId(m[1])) return { head: 'results', id: m[1] };
    m = /^modifies\.(.+)$/.exec(path);
    if (m && parseModifiesPart(m[1])) return { head: 'modifies', part: m[1] };
    return null;
}

/** Validate one pack's numbers manifest; refuses by name. Returns it. */
export function parseNumbersManifest(json, packId) {
    const where = `pack "${packId}" numbers manifest`;
    if (!isObject(json) || json.schema_version !== 1) fail(`${where}: schema_version ${JSON.stringify(json?.schema_version)} (this reader reads 1)`);
    for (const field of Object.keys(json)) {
        if (!MANIFEST_FIELDS.includes(field)) fail(`${where}: unknown field "${field}" (${MANIFEST_FIELDS.join(', ')})`);
    }
    const sets = json.sets ?? {};
    if (!isObject(sets)) fail(`${where}: sets is not an object`);
    for (const [game, set] of Object.entries(sets)) {
        const at = `${where}: set "${game}"`;
        if (!SUBSTRATE_ID_PATTERN.test(game)) fail(`${at}: the key is not a substrate id (${SUBSTRATE_ID_PATTERN})`);
        if (!isObject(set)) fail(`${at}: the set is not an object`);
        for (const f of Object.keys(set)) if (!SET_FIELDS.includes(f)) fail(`${at}: unknown field "${f}" (${SET_FIELDS.join(', ')})`);
        if (typeof set.exists !== 'string' || !PACK_ID_PATTERN.test(set.exists)) {
            fail(`${at}: exists ${JSON.stringify(set.exists)} is not a pack id (the pack whose structure this set prices)`);
        }
        if ('economy' in set && !isObject(set.economy)) fail(`${at}: economy must be an object`);
        if ('src' in set && (typeof set.src !== 'string' || !set.src)) fail(`${at}: src must be a provenance source id`);
        const values = set.values ?? {};
        if (!isObject(values)) fail(`${at}: values is not an object`);
        for (const [key, paths] of Object.entries(values)) {
            const vAt = `${at}: values "${key}"`;
            const id = parseStructureId(key);
            if (!id) fail(`${vAt}: the key is not a structure id (<pack>:<kind>/<slug>)`);
            if (id.pack !== set.exists) fail(`${vAt}: names an entry of pack "${id.pack}", but the set prices "${set.exists}"`);
            if (!isObject(paths)) fail(`${vAt}: is not { <value path>: <value> }`);
            for (const [path, value] of Object.entries(paths)) {
                if (!parseValuePath(path)) fail(`${vAt}: ${JSON.stringify(path)} is not a value path (time, limit, max, requires.<id>.<field>, results.<id>, modifies.<part>)`);
                const ok = finite(value) || (isObject(value) && Object.keys(value).length && Object.values(value).every(finite));
                if (!ok) fail(`${vAt}: "${path}" is ${JSON.stringify(value)}, not a number or a small object of numbers`);
            }
        }
    }
    return json;
}

/**
 * ⛓ **THE NUMBERS OF A STACK** — later wins per value path. `stack` is a
 * LOADED stack; packs without a numbers layer are skipped. `set(game, exists)`
 * answers the merged set for that game and that "what exists" pack, or null.
 */
export function createNumbers(stack) {
    const merged = new Map();   // `${game}\0${exists}` → { game, exists, economy, values: Map<key, Map<path, {value, pack}>> , packs }
    for (const loaded of stack) {
        const json = loaded.layers?.numbers;
        if (!json) continue;
        parseNumbersManifest(json, loaded.id);
        for (const [game, set] of Object.entries(json.sets ?? {})) {
            const slot = `${game}\0${set.exists}`;
            if (!merged.has(slot)) merged.set(slot, { game, exists: set.exists, economy: {}, values: new Map(), packs: [] });
            const m = merged.get(slot);
            m.packs.push(loaded.id);
            Object.assign(m.economy, structuredClone(set.economy ?? {}));
            for (const [key, paths] of Object.entries(set.values ?? {})) {
                if (!m.values.has(key)) m.values.set(key, new Map());
                for (const [path, value] of Object.entries(paths)) m.values.get(key).set(path, { value: structuredClone(value), pack: loaded.id });
            }
        }
    }
    const freezeSet = (m) => Object.freeze({
        game: m.game,
        exists: m.exists,
        packs: Object.freeze([...m.packs]),
        economy: Object.freeze(m.economy),
        /** The value at `path` of entry `key`, or undefined. */
        value: (key, path) => m.values.get(key)?.get(path)?.value,
        /** The pack the winning value came from, or null. */
        packOf: (key, path) => m.values.get(key)?.get(path)?.pack ?? null,
        keys: () => [...m.values.keys()],
        paths: (key) => [...(m.values.get(key)?.keys() ?? [])],
    });
    const frozen = new Map([...merged].map(([slot, m]) => [slot, freezeSet(m)]));
    return Object.freeze({
        set: (game, exists) => frozen.get(`${game}\0${exists}`) ?? null,
        /** Every `{ game, exists }` the stack prices. */
        sets: () => [...frozen.values()].map((s) => Object.freeze({ game: s.game, exists: s.exists })),
    });
}

/**
 * ⛓ **A NUMBERS PACK FOR ANOTHER GAME OR ANOTHER "WHAT EXISTS" IS REFUSED BY
 * NAME** (Z.5). `loaded` is ONE loaded pack (`loadPackStack`'s row); the world
 * is `substrateIds` (its substrates) and `exists` (its what-exists list). The
 * pack must hold a set whose key is one of `substrateIds` and whose `exists` is
 * in `exists`. Returns the refusal sentence, or null.
 */
export function numbersSelectionRefusal(loaded, { substrateIds, exists }) {
    const json = loaded?.layers?.numbers;
    if (!json) return `numbers names the pack "${loaded?.id}", which has no numbers layer`;
    parseNumbersManifest(json, loaded.id);
    const sets = Object.entries(json.sets ?? {});
    if (sets.some(([game, set]) => substrateIds.includes(game) && exists.includes(set.exists))) return null;
    const held = sets.length ? sets.map(([game, set]) => `${game} over ${set.exists}`).join(', ') : 'none';
    return `numbers names the pack "${loaded.id}", which has no set for the substrate(s) [${substrateIds.join(', ')}] `
        + `over the world's exists [${exists.join(', ')}] (its sets: ${held})`;
}
