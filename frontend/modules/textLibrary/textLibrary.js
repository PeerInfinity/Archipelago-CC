/**
 * textLibrary — **STRINGS AND WORD LISTS BY KEY, FOR ANY SUBSTRATE** (⛓ CONTENT
 * SETS C1, ⚖ the user 2026-11-10: Q1).
 *
 * The `text` layer of a content-pack stack (`contentPacks/contentPacks.js`),
 * merged per key (a later pack wins), answering:
 *
 *   · `has(key)` / `keys()` — which keys does the stack carry?
 *   · `string(key)`         — one string (prose, a name), or null;
 *   · `list(key)`           — a word list (names, adjectives), frozen, or null;
 *   · `fill(template, vars)`— `{name}` placeholders replaced from `vars`.
 *
 * A key is a STRING or a LIST across the whole merged stack, never both: a
 * later pack cannot turn a list into a string, which would break every caller
 * that asked for the other shape. Refused by name.
 *
 * `fill` follows the text adventure's templating
 * (`textAdventureSubstrateWrapper/templating.js`, `processMessageTemplate`): a
 * placeholder whose value is missing (`undefined` or `null`) is LEFT AS
 * WRITTEN. It differs in three ways, on purpose: it does not HTML-escape (this
 * library is DOM-free; escaping is the renderer's), it knows no `wasUnchecked`
 * highlight, and it substitutes in ONE pass (a value that itself contains
 * `{name}` is not filled again).
 *
 * ⛔ REFUSAL BY NAME: a `ContentPackError` naming the pack, the key and the
 * field. Pure and DOM-free: it takes a LOADED stack, as `createArtLibrary` does.
 */
import { ContentPackError, KEY_PATTERN, mergeKeyed } from '../contentPacks/contentPacks.js';

const MANIFEST_FIELDS = Object.freeze(['schema_version', 'strings', 'lists', '_comment']);

const fail = (message) => { throw new ContentPackError(`text library: ${message}`); };
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Validate one pack's text manifest; refuses by name. Returns it. */
export function parseTextManifest(json, packId) {
    const where = `pack "${packId}" text manifest`;
    if (!isObject(json) || json.schema_version !== 1) fail(`${where}: schema_version ${JSON.stringify(json?.schema_version)} (this library reads 1)`);
    for (const field of Object.keys(json)) {
        if (!MANIFEST_FIELDS.includes(field)) fail(`${where}: unknown field "${field}" (${MANIFEST_FIELDS.join(', ')})`);
    }
    for (const table of ['strings', 'lists']) {
        if (table in json && !isObject(json[table])) fail(`${where}: ${table} is not an object`);
        for (const key of Object.keys(json[table] ?? {})) {
            if (!KEY_PATTERN.test(key)) fail(`${where}: ${table} key ${JSON.stringify(key)} is not namespaced (<namespace>:<path>)`);
        }
    }
    for (const [key, value] of Object.entries(json.strings ?? {})) {
        if (typeof value !== 'string') fail(`${where}: strings "${key}" is not a string (${JSON.stringify(value)})`);
    }
    for (const [key, value] of Object.entries(json.lists ?? {})) {
        if (!Array.isArray(value) || !value.length || !value.every((s) => typeof s === 'string')) {
            fail(`${where}: lists "${key}" is not a non-empty list of strings`);
        }
    }
    return json;
}

/** One-pass `{name}` substitution; a placeholder with no value (undefined/null) is left as written. */
export function fillTemplate(template, vars = {}) {
    if (typeof template !== 'string') return '';
    return template.replace(/\{([^{}]+)\}/g, (whole, name) => {
        const value = Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : undefined;
        return value === undefined || value === null ? whole : String(value);
    });
}

/**
 * Build the library from a loaded stack (`loadPackStack`'s result, or any list
 * of `{ id, layers: { text } }`). Packs without a text layer are skipped.
 */
export function createTextLibrary(stack) {
    const manifests = new Map();
    for (const loaded of stack) {
        if (loaded.layers?.text) manifests.set(loaded.id, parseTextManifest(loaded.layers.text, loaded.id));
    }
    const withText = stack.filter((l) => manifests.has(l.id));
    const strings = mergeKeyed(withText, (l) => manifests.get(l.id).strings);
    const lists = mergeKeyed(withText, (l) => manifests.get(l.id).lists);

    // A key is a string or a list ACROSS THE STACK, never both (a later pack may not change its shape).
    const shape = new Map();   // key → { table, pack }
    for (const l of withText) {
        for (const table of ['strings', 'lists']) {
            for (const key of Object.keys(manifests.get(l.id)[table] ?? {})) {
                const prev = shape.get(key);
                if (prev && prev.table !== table) {
                    fail(`key "${key}" is in ${prev.table} of pack "${prev.pack}" and in ${table} of pack "${l.id}" (a key is a string or a list, never both)`);
                }
                shape.set(key, { table, pack: l.id });
            }
        }
    }
    const frozenLists = new Map([...lists].map(([key, { value }]) => [key, Object.freeze([...value])]));

    return Object.freeze({
        has: (key) => strings.has(key) || lists.has(key),
        /** Every key (strings, then lists), in stack order then declaration order. */
        keys: () => [...strings.keys(), ...lists.keys()],
        /** The string for `key`, or null (a list key answers null too). */
        string: (key) => strings.get(key)?.value ?? null,
        /** The frozen list for `key`, or null (a string key answers null too). */
        list: (key) => frozenLists.get(key) ?? null,
        /** The pack the winning value of `key` came from, or null. */
        packOf: (key) => (strings.get(key) ?? lists.get(key))?.pack ?? null,
        fill: fillTemplate,
    });
}
