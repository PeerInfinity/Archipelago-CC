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

/**
 * The layers a pack may provide today. A new consumer adds its name here.
 * `art` — the art library (`artLibrary/`); `sfx` — the sound-effect library
 * (`sfxLibrary/`, ⛓ SOUND EFFECTS, ⚖ the user 2026-10-26); `music` — the
 * music library (`musicLibrary/`, ⛓ MUSIC, ⚖ the user 2026-10-27; reserved
 * until it was built).
 */
export const KNOWN_LAYERS = Object.freeze(['art', 'sfx', 'music']);

/**
 * Layer names RESERVED for a consumer that is planned but not built: a pack
 * that declares one is refused with that said, rather than as an unknown
 * name. None today (`music` was, until the music library landed).
 */
export const RESERVED_LAYERS = Object.freeze([]);

/** The registry's stack tables, one per consumer kind: `graphics` (the art), `sfx` and `music`. */
export const STACK_KINDS = Object.freeze(['graphics', 'sfx', 'music']);

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
export function parsePack(json, expectedId = null, { known = KNOWN_LAYERS, reserved = RESERVED_LAYERS } = {}) {
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
        if (reserved.includes(name)) fail(where, `layer "${name}" is reserved for a library that is not built yet (known: ${known.join(', ')})`);
        if (!known.includes(name)) fail(where, `layer "${name}" is not one this loader knows (${known.join(', ')})`);
        if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('..')) {
            fail(where, `layer "${name}" path ${JSON.stringify(path)} must be a relative path inside the pack`);
        }
    }
    return Object.freeze({ ...json, layers: Object.freeze({ ...json.layers }) });
}

/**
 * Validate the registry `packs.json`; returns `{ packs: [ids], stacks: {name: [ids]}, sfxStacks: {…}, musicStacks: {…} }`.
 * `stacks` is the `graphics` table (its name predates the second kind); `sfxStacks` is `sfx`'s, `musicStacks` `music`'s.
 */
export function parseRegistry(json) {
    if (!json || json.schema_version !== 1 || !Array.isArray(json.packs)) {
        fail('registry', 'packs.json must be { schema_version: 1, packs: [...] }');
    }
    const ids = json.packs.map((p) => p?.id);
    for (const id of ids) if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail('registry', `pack id ${JSON.stringify(id)} is not a pack id`);
    if (new Set(ids).size !== ids.length) fail('registry', 'a pack id is listed twice');
    const tables = {};
    for (const kind of STACK_KINDS) {
        const stacks = {};
        for (const [name, stack] of Object.entries(json[kind] ?? {})) {
            const where = kind === 'graphics' ? `stack "${name}"` : `${kind} stack "${name}"`;
            if (!Array.isArray(stack) || !stack.length) fail('registry', `${where} is not a non-empty list`);
            for (const id of stack) if (!ids.includes(id)) fail('registry', `${where} names "${id}", which packs.json does not list`);
            stacks[name] = Object.freeze([...stack]);
        }
        tables[kind] = Object.freeze(stacks);
    }
    return Object.freeze({ packs: Object.freeze(ids), stacks: tables.graphics, sfxStacks: tables.sfx, musicStacks: tables.music });
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
 * `only` (optional) names the layers to read: a graphics stack need not fetch
 * the sound manifest. A pack is still validated whole.
 *
 * @param {string[]} ids
 * @param {{ base: string, readJson: (url: string) => Promise<any>, only?: string[] }} io
 * @returns {Promise<Array<{ id, pack, base, layers: { [name]: any } }>>}
 */
export async function loadPackStack(ids, { base, readJson, only = null }) {
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
            if (only && !only.includes(name)) continue;
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
