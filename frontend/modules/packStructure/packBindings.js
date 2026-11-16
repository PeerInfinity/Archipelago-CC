/**
 * packStructure/packBindings — **PER GAME, WHAT ONLY THAT GAME NEEDS** (⛓
 * CONTENT SETS PL-1; Z.4, ⚖ the user 2026-11-15).
 *
 * The `bindings` layer of a content pack. It travels with what exists:
 *
 *     { "schema_version": 1, "provenance": { … },
 *       "bindings": {
 *         "<substrate id>": { "<structure id>": { <the game's own fields>, "src"?: "<source id>" } } } }
 *
 * A binding's fields are the named game's own (JtA's slot numbers, omsi's
 * multipart segments, a native effect with no `modifies` form, whether a stat
 * resets with the loop); this reader holds only the frame: a substrate id, a
 * structure id of THIS pack (bindings travel with the pack's own structure),
 * and an object. Only the named game reads the rest.
 *
 * Pure and DOM-free: it takes a LOADED stack.
 */
import { ContentPackError } from '../contentPacks/contentPacks.js';
import { SUBSTRATE_ID_PATTERN } from './packNumbers.js';
import { parseStructureId } from './packStructure.js';

const MANIFEST_FIELDS = Object.freeze(['schema_version', 'bindings', 'provenance', '_comment']);
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (message) => { throw new ContentPackError(`pack bindings: ${message}`); };

/** Validate one pack's bindings manifest; refuses by name. Returns it. */
export function parseBindingsManifest(json, packId) {
    const where = `pack "${packId}" bindings manifest`;
    if (!isObject(json) || json.schema_version !== 1) fail(`${where}: schema_version ${JSON.stringify(json?.schema_version)} (this reader reads 1)`);
    for (const field of Object.keys(json)) {
        if (!MANIFEST_FIELDS.includes(field)) fail(`${where}: unknown field "${field}" (${MANIFEST_FIELDS.join(', ')})`);
    }
    const bindings = json.bindings ?? {};
    if (!isObject(bindings)) fail(`${where}: bindings is not an object`);
    for (const [game, table] of Object.entries(bindings)) {
        const at = `${where}: game "${game}"`;
        if (!SUBSTRATE_ID_PATTERN.test(game)) fail(`${at}: the key is not a substrate id (${SUBSTRATE_ID_PATTERN})`);
        if (!isObject(table)) fail(`${at}: is not { <structure id>: <binding> }`);
        for (const [key, binding] of Object.entries(table)) {
            const bAt = `${at}: binding "${key}"`;
            const id = parseStructureId(key);
            if (!id) fail(`${bAt}: the key is not a structure id (<pack>:<kind>/<slug>)`);
            if (id.pack !== packId) fail(`${bAt}: names an entry of pack "${id.pack}" (a binding travels with its own pack's structure)`);
            if (!isObject(binding)) fail(`${bAt}: the binding is not an object`);
            if ('src' in binding && (typeof binding.src !== 'string' || !binding.src)) fail(`${bAt}: src must be a provenance source id`);
        }
    }
    return json;
}

const deepFreeze = (v) => {
    if (v && typeof v === 'object') {
        for (const x of Object.values(v)) deepFreeze(x);
        Object.freeze(v);
    }
    return v;
};

/**
 * ⛓ **THE BINDINGS OF A STACK** (what exists, added together). `of(game, key)`
 * is the binding of structure entry `key` for `game`, or null; `src` is not
 * part of it (provenance stays in the pack).
 */
export function createBindings(stack) {
    const out = new Map();   // game → Map<key, { binding, pack }>
    for (const loaded of stack) {
        const json = loaded.layers?.bindings;
        if (!json) continue;
        parseBindingsManifest(json, loaded.id);
        for (const [game, table] of Object.entries(json.bindings ?? {})) {
            if (!out.has(game)) out.set(game, new Map());
            for (const [key, binding] of Object.entries(table)) {
                const { src: _src, ...rest } = binding;
                out.get(game).set(key, Object.freeze({ binding: deepFreeze(structuredClone(rest)), pack: loaded.id }));
            }
        }
    }
    return Object.freeze({
        of: (game, key) => out.get(game)?.get(key)?.binding ?? null,
        keys: (game) => [...(out.get(game)?.keys() ?? [])],
        games: () => [...out.keys()],
    });
}

/**
 * Every binding names an entry of `structure` (`createStructure`'s reader):
 * refused by name otherwise. The cross-check where both layers are loaded.
 */
export function assertBindingsBind(bindings, structure) {
    for (const game of bindings.games()) {
        for (const key of bindings.keys(game)) {
            if (!structure.has(key)) fail(`game "${game}" binding "${key}" names an entry no structure in the stack holds`);
        }
    }
}
