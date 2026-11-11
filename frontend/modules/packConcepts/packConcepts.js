/**
 * packConcepts — **THE CHARACTERS, PLACES, OBJECTS AND INFORMATION A CONTENT SET
 * OFFERS** (⛓ CONTENT SETS C1, ⚖ the user 2026-11-10: Q1, Q2).
 *
 * The `concepts` layer of a content-pack stack (`contentPacks/contentPacks.js`),
 * merged per key (a later pack wins), answering:
 *
 *   · `has(key)` / `keys()`    — which pack concepts does the stack carry?
 *   · `get(key)`               — the winning entry, with the pack it came from;
 *   · `ofKind(kind)`           — every key of one kind;
 *   · `presenting(mechanicId)` — the entry that re-presents a MECHANIC concept.
 *
 * ⛔ A PACK CONCEPT HAS NO EFFECT ON REACHABILITY. Mechanic concepts (`sword`,
 * `guardian`, …) live in `procgenCore/concepts.js` and carry logic; a pack
 * concept carries presentation only: a name, a description, a `look` (colour +
 * symbol, so a theme is complete with no image at all), an art-library key and
 * text-library keys. `presents` names a mechanic concept the entry re-presents;
 * it is an OPAQUE id here — this module never imports `procgenCore`, and the
 * cross-check against the concept table belongs to the roles contract.
 *
 * ⛔ REFUSAL BY NAME. A malformed manifest throws a `ContentPackError` naming
 * the pack, the key and the field; nothing is half-loaded.
 *
 * Pure and DOM-free: it takes a LOADED stack (`loadPackStack`'s result), as
 * `createArtLibrary` does.
 */
import { ContentPackError, KEY_PATTERN, mergeKeyed } from '../contentPacks/contentPacks.js';

/**
 * The pack-concept kinds (Q2). This module OWNS the list: the roles contract
 * imports it. `info` is a piece of information (a clue).
 */
export const PACK_CONCEPT_KINDS = Object.freeze(['character', 'place', 'object', 'info']);

/** The fields an entry may carry; any other is refused. */
export const PACK_CONCEPT_FIELDS = Object.freeze(['kind', 'name', 'description', 'look', 'art', 'text', 'presents']);

const LOOK_FIELDS = Object.freeze(['color', 'symbol']);
const MANIFEST_FIELDS = Object.freeze(['schema_version', 'concepts', '_comment']);
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const fail = (message) => { throw new ContentPackError(`pack concepts: ${message}`); };
const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.length > 0;

/** Validate one pack's concepts manifest; refuses by name. Returns it. */
export function parseConceptsManifest(json, packId) {
    const where = `pack "${packId}" concepts manifest`;
    if (!isObject(json) || json.schema_version !== 1) fail(`${where}: schema_version ${JSON.stringify(json?.schema_version)} (this reader reads 1)`);
    for (const field of Object.keys(json)) {
        if (!MANIFEST_FIELDS.includes(field)) fail(`${where}: unknown field "${field}" (${MANIFEST_FIELDS.join(', ')})`);
    }
    const concepts = json.concepts ?? {};
    if (!isObject(concepts)) fail(`${where}: concepts is not an object`);
    for (const [key, entry] of Object.entries(concepts)) {
        const at = `${where}: concept "${key}"`;
        if (!KEY_PATTERN.test(key)) fail(`${at}: the key is not namespaced (<namespace>:<path>)`);
        if (!isObject(entry)) fail(`${at}: the entry is not an object`);
        for (const field of Object.keys(entry)) {
            if (!PACK_CONCEPT_FIELDS.includes(field)) fail(`${at}: unknown field "${field}" (${PACK_CONCEPT_FIELDS.join(', ')})`);
        }
        if (!PACK_CONCEPT_KINDS.includes(entry.kind)) fail(`${at}: kind ${JSON.stringify(entry.kind)} is not one of ${PACK_CONCEPT_KINDS.join(', ')}`);
        if (!isText(entry.name)) fail(`${at}: name is missing`);
        if ('description' in entry && !isText(entry.description)) fail(`${at}: description must be a non-empty string`);
        if ('look' in entry) {
            const look = entry.look;
            if (!isObject(look)) fail(`${at}: look must be { color, symbol }`);
            for (const field of Object.keys(look)) {
                if (!LOOK_FIELDS.includes(field)) fail(`${at}: look has unknown field "${field}" (${LOOK_FIELDS.join(', ')})`);
            }
            if (typeof look.color !== 'string' || !COLOR_PATTERN.test(look.color)) fail(`${at}: look.color ${JSON.stringify(look.color)} is not #rrggbb`);
            if (!isText(look.symbol)) fail(`${at}: look.symbol must be a non-empty string`);
        }
        if ('art' in entry && (typeof entry.art !== 'string' || !KEY_PATTERN.test(entry.art))) {
            fail(`${at}: art ${JSON.stringify(entry.art)} is not a namespaced art-library key`);
        }
        if ('text' in entry) {
            if (!isObject(entry.text)) fail(`${at}: text must be { <slot>: <text-library key> }`);
            for (const [slot, ref] of Object.entries(entry.text)) {
                if (!slot) fail(`${at}: text has an empty slot name`);
                if (typeof ref !== 'string' || !KEY_PATTERN.test(ref)) fail(`${at}: text.${slot} ${JSON.stringify(ref)} is not a namespaced text-library key`);
            }
        }
        if ('presents' in entry && !isText(entry.presents)) fail(`${at}: presents must be a non-empty mechanic concept id`);
    }
    return json;
}

const freezeEntry = (key, pack, value) => Object.freeze({
    key,
    pack,
    ...value,
    ...(value.look ? { look: Object.freeze({ ...value.look }) } : {}),
    ...(value.text ? { text: Object.freeze({ ...value.text }) } : {}),
});

/**
 * Build the reader from a loaded stack (`loadPackStack`'s result, or any list
 * of `{ id, layers: { concepts } }`). Packs without a concepts layer are skipped.
 */
export function createPackConcepts(stack) {
    const manifests = new Map();
    for (const loaded of stack) {
        if (loaded.layers?.concepts) manifests.set(loaded.id, parseConceptsManifest(loaded.layers.concepts, loaded.id));
    }
    const merged = mergeKeyed(stack.filter((l) => manifests.has(l.id)), (l) => manifests.get(l.id).concepts);
    const entries = new Map([...merged].map(([key, { value, pack }]) => [key, freezeEntry(key, pack, value)]));
    const rank = new Map(stack.map((l, i) => [l.id, i]));

    // mechanic id → the winning entry: the LAST pack in the stack that presents it. Two winning entries of ONE pack
    // presenting the same id would make that pack's answer ambiguous: refused by name.
    const byPack = new Map();   // `${pack}\0${mechanicId}` → entry
    const presenters = new Map();
    for (const entry of entries.values()) {
        if (!entry.presents) continue;
        const slot = `${entry.pack}\0${entry.presents}`;
        const twin = byPack.get(slot);
        if (twin) fail(`pack "${entry.pack}" concepts manifest: concepts "${twin.key}" and "${entry.key}" both present "${entry.presents}"`);
        byPack.set(slot, entry);
        const prev = presenters.get(entry.presents);
        if (!prev || rank.get(entry.pack) > rank.get(prev.pack)) presenters.set(entry.presents, entry);
    }

    return Object.freeze({
        has: (key) => entries.has(key),
        /** Every key, in stack order then declaration order (an overridden key keeps its first position). */
        keys: () => [...entries.keys()],
        /** `{ key, pack, kind, name, … }` (frozen), or null. */
        get: (key) => entries.get(key) ?? null,
        /** The keys of one kind, in `keys()` order. An unknown kind is refused by name. */
        ofKind(kind) {
            if (!PACK_CONCEPT_KINDS.includes(kind)) fail(`ofKind(${JSON.stringify(kind)}): not one of ${PACK_CONCEPT_KINDS.join(', ')}`);
            return [...entries.values()].filter((e) => e.kind === kind).map((e) => e.key);
        },
        /** The entry of the LAST pack in the stack that presents mechanic concept `mechanicId`, or null. */
        presenting: (mechanicId) => presenters.get(mechanicId) ?? null,
    });
}
