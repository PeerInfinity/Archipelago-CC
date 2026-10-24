/**
 * contentPacks — **CONTENT PACKS: DISCOVER THEM, LOAD SEVERAL AT ONCE, MERGE
 * THEM IN A DEFINED ORDER** (Seedling JS graphics G0, ⚖ the user 2026-10-16).
 *
 * A pack is a directory under `frontend/packs/<id>/` (Pages serves only
 * `frontend/`) holding `pack.json` and one sub-directory per LAYER it provides:
 *
 *     { "schema_version": 1, "id": "seedling", "title": "…", "licence": "…",
 *       "credit": "…", "layers": { "art": "art/manifest.json" } }
 *
 * The registry `frontend/packs/packs.json` lists the packs (`packs`) and names
 * the STACKS a consumer asks for (`graphics: { seedling: ["seedling",
 * "archipelago"] }`). A stack is an override order: **a later pack wins per
 * key**, so a reskin pack stacked last replaces only the keys it carries and
 * everything else falls through to the packs before it.
 *
 * This module knows packs, layers and keys; it does NOT know what a layer
 * means. The art library (`artLibrary/artLibrary.js`) is the first consumer;
 * the concept library may become the second (`concepts/`, maze `rules/`), which
 * is why `KNOWN_LAYERS` is a list and why keys are NAMESPACED
 * (`seedling:tile/ground`, `archipelago:pickup/item`) — one key can name the
 * same thing in every library.
 *
 * ⛔ REFUSAL BY NAME. A malformed pack is never half-loaded: `parsePack` throws a
 * `ContentPackError` that names the pack and the field, and `loadPackStack`
 * propagates it. A consumer that wants a fallback catches it and says so.
 *
 * Pure and DOM-free: loading takes a `readJson(url)` the caller supplies
 * (`fetch` in a browser, `fs` in node), so node tests drive it with no server.
 */

/** The layers a pack may provide today. A new consumer adds its name here. */
export const KNOWN_LAYERS = Object.freeze(['art']);

/** A key is `<namespace>:<path>`: lower-camel namespace, a non-empty path. */
export const KEY_PATTERN = /^[a-z][a-zA-Z0-9-]*:[A-Za-z0-9_./-]+$/;

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export class ContentPackError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ContentPackError';
    }
}

const fail = (where, message) => { throw new ContentPackError(`content pack ${where}: ${message}`); };

/**
 * Validate a parsed `pack.json`. `expectedId` is the directory it was read
 * from: a pack whose `id` disagrees with its directory is refused (two names
 * for one pack would make an override order ambiguous).
 */
export function parsePack(json, expectedId = null) {
    const where = `"${expectedId ?? json?.id ?? '?'}"`;
    if (!json || typeof json !== 'object' || Array.isArray(json)) fail(where, 'pack.json is not an object');
    if (json.schema_version !== 1) fail(where, `schema_version ${JSON.stringify(json.schema_version)} (this loader reads 1)`);
    if (typeof json.id !== 'string' || !ID_PATTERN.test(json.id)) fail(where, `id ${JSON.stringify(json.id)} is not a pack id (${ID_PATTERN})`);
    if (expectedId !== null && json.id !== expectedId) fail(where, `id "${json.id}" does not match its directory "${expectedId}"`);
    for (const field of ['title', 'licence']) {
        if (typeof json[field] !== 'string' || !json[field]) fail(where, `${field} is missing`);
    }
    if (!json.layers || typeof json.layers !== 'object' || Array.isArray(json.layers)) fail(where, 'layers is missing');
    for (const [name, path] of Object.entries(json.layers)) {
        if (!KNOWN_LAYERS.includes(name)) fail(where, `layer "${name}" is not one this loader knows (${KNOWN_LAYERS.join(', ')})`);
        if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('..')) {
            fail(where, `layer "${name}" path ${JSON.stringify(path)} must be a relative path inside the pack`);
        }
    }
    return Object.freeze({ ...json, layers: Object.freeze({ ...json.layers }) });
}

/** Validate the registry `packs.json`; returns `{ packs: [ids], stacks: {name: [ids]} }`. */
export function parseRegistry(json) {
    if (!json || json.schema_version !== 1 || !Array.isArray(json.packs)) {
        fail('registry', 'packs.json must be { schema_version: 1, packs: [...] }');
    }
    const ids = json.packs.map((p) => p?.id);
    for (const id of ids) if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail('registry', `pack id ${JSON.stringify(id)} is not a pack id`);
    if (new Set(ids).size !== ids.length) fail('registry', 'a pack id is listed twice');
    const stacks = {};
    for (const [name, stack] of Object.entries(json.graphics ?? {})) {
        if (!Array.isArray(stack) || !stack.length) fail('registry', `stack "${name}" is not a non-empty list`);
        for (const id of stack) if (!ids.includes(id)) fail('registry', `stack "${name}" names "${id}", which packs.json does not list`);
        stacks[name] = Object.freeze([...stack]);
    }
    return Object.freeze({ packs: Object.freeze(ids), stacks: Object.freeze(stacks) });
}

/**
 * Where the packs live, as a URL ending in `/`. Unbundled, this module sits at
 * `frontend/modules/contentPacks/`, so the packs are `../../packs/` from it; in
 * a bundle `import.meta.url` is `dist/bundle.js`, so the base is the PAGE's
 * `packs/` instead (`stateManagerProxy`'s rule for its worker URL).
 */
export function packsBaseUrl(moduleUrl = import.meta.url, pageHref = globalThis.location?.href) {
    if (moduleUrl.includes('/dist/') && pageHref) return new URL('./packs/', pageHref).href;
    return new URL('../../packs/', moduleUrl).href;
}

/**
 * Load a STACK of packs, in order. `ids` is the override order (later wins).
 * Each pack's layers are read too, so a stack either loads whole or refuses.
 *
 * @param {string[]} ids
 * @param {{ base: string, readJson: (url: string) => Promise<any> }} io
 * @returns {Promise<Array<{ id, pack, base, layers: { [name]: any } }>>}
 */
export async function loadPackStack(ids, { base, readJson }) {
    if (!Array.isArray(ids) || !ids.length) fail('stack', 'no packs named');
    if (new Set(ids).size !== ids.length) fail('stack', `a pack is named twice (${ids.join(', ')})`);
    const out = [];
    for (const id of ids) {
        const packBase = new URL(`${id}/`, base).href;
        let json;
        try {
            json = await readJson(new URL('pack.json', packBase).href);
        } catch (err) {
            fail(`"${id}"`, `pack.json could not be read (${err.message})`);
        }
        const pack = parsePack(json, id);
        const layers = {};
        for (const [name, path] of Object.entries(pack.layers)) {
            try {
                layers[name] = await readJson(new URL(path, packBase).href);
            } catch (err) {
                fail(`"${id}"`, `layer "${name}" (${path}) could not be read (${err.message})`);
            }
        }
        out.push(Object.freeze({ id, pack, base: packBase, layers: Object.freeze(layers) }));
    }
    return out;
}

/**
 * Merge one keyed table across a loaded stack: `entriesOf(loadedPack)` returns
 * that pack's `{ key: value }`; the result maps every key to the value of the
 * LAST pack that carries it, with the pack it came from. A malformed key is
 * refused by name.
 *
 * @returns {Map<string, { value, pack: string }>}
 */
export function mergeKeyed(stack, entriesOf) {
    const merged = new Map();
    for (const loaded of stack) {
        const entries = entriesOf(loaded) ?? {};
        for (const [key, value] of Object.entries(entries)) {
            if (!KEY_PATTERN.test(key)) fail(`"${loaded.id}"`, `key ${JSON.stringify(key)} is not namespaced (<namespace>:<path>)`);
            merged.set(key, { value, pack: loaded.id });
        }
    }
    return merged;
}
