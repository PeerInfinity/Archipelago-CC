/**
 * apworldEditor/documentKeys — **THE DOCUMENT'S TOP-LEVEL KEY REGISTRY, AND IT
 * IS DERIVED FROM `rules.schema.json` RATHER THAN TYPED HERE** (APWORLD EDITOR
 * HUB slice H1; plan §3 idea 1, §5's H1 row, §10.6 carry (a)).
 *
 * ── ⛔⛔ THERE IS NO SECOND KEY LIST, AND THAT IS THE WHOLE POINT ──────
 *
 * H0 declared the ten keys real presets carry and wrote a `description` on each
 * that NAMES ITS PRODUCER — which is exactly the label text a generic Document
 * row wants. A hand-maintained table beside it would be the `regionEditors`
 * mistake this arc refuses everywhere else: two lists that agree until the day
 * somebody adds a key to one of them. So `buildDocumentKeys(schema)` iterates
 * `schema.properties` and nothing else, and `documentKeys.test.js` asserts the
 * two sets are EQUAL in both directions — a schema key missing from the
 * registry is a key the Document tab would not draw, and a registry key absent
 * from the schema is a row about a key nothing produces.
 *
 * ── ⛓ PER-PLAYER IS READ OFF THE SCHEMA, NEVER LISTED ─────────────────
 *
 * Eighteen of the thirty-four top-level properties are slot maps, and every one
 * of them says so the same way: `patternProperties` keyed `^[0-9]+$`. So
 * `perPlayer` is that test, run against the property's own subschema. ⛔ A hand
 * list of "the per-player keys" would have to be re-derived every time the
 * schema grows one, which is the failure H0 measured on the schema itself.
 *
 * ── ⛓ THE `editor` SLOT IS EMPTY ON PURPOSE ───────────────────────────
 *
 * `DOCUMENT_KEY_EDITORS` is the `key → {open}` table the LINKED editors fill —
 * `region_atlas` → the marking tool, `procgen_metadata` → the pipeline,
 * `loop_costs` → the cost debugger (plan §5's **H5** row). H1 builds the slot
 * and leaves it empty; a filled row makes `entry.editor` non-null and the
 * Document tab draws an Open button for it. ⛔ Do not fill it here — H5 measures
 * each editor's working-copy intake cost first, and a link that opens an editor
 * on APPLIED state would break the working-copy ruling (§1).
 *
 * ── ⛓ AND THE UNKNOWN-KEY ROW IS NOT OPTIONAL ─────────────────────────
 *
 * H0's carry (b): the schema went STRICT at the top level in H1's Task 0, so a
 * committed preset cannot carry an undeclared key any more — but a document
 * somebody LOADS can carry anything, and an "every element" tab that drew only
 * declared keys would silently DROP the ones visibly in the file. Unknown keys
 * get a raw-JSON row, marked as unknown by name.
 */

import { META_FIELDS } from './rulesDocOps.js';

/** ⛓ The slot-map test, as the schema itself spells it. */
const PLAYER_SLOT_PATTERN = '^[0-9]+$';

/**
 * ⛓ Which TAB already edits a key, so the Document tab offers a pointer rather
 * than a second editor for it.
 *
 * ⛓⛓ The Meta half is DERIVED from `META_FIELDS` — the same table the Meta tab's
 * eight rows and the `set-meta` op both read — plus the two meta rows that are
 * NOT `set-meta` ops (the start-region row and the completion-condition editor,
 * which have ops of their own). ⛔ Everything here is asserted against the
 * schema and against the panel's tab ids by `documentKeys.test.js`, so a key
 * that stops being edited in a tab, or a tab that is renamed, reds a row rather
 * than leaving a row pointing at a tab nobody can click.
 */
const META_TAB_EXTRA_KEYS = Object.freeze(['start_regions', 'game_info']);

export const KEYS_OWNED_BY_TAB = Object.freeze({
    regions: Object.freeze(['regions']),
    items: Object.freeze(['items', 'itempool_counts', 'starting_items']),
    meta: Object.freeze([...new Set([
        ...Object.values(META_FIELDS).map((spec) => spec.path('1')[0]),
        ...META_TAB_EXTRA_KEYS,
    ])].sort()),
});

/** ⛓ `key → tab id`, inverted from the table above once. */
const TAB_FOR_KEY = Object.freeze(Object.fromEntries(
    Object.entries(KEYS_OWNED_BY_TAB).flatMap(([tab, keys]) => keys.map((k) => [k, tab]))));

/**
 * ⛓⛓ **THE `editor` SLOT — EMPTY UNTIL H5.** `key → {label, open(context)}`.
 * `open` receives `{record, player, key, value, onSave}` and returns ONE op
 * (plan §4's working-copy hand-off). Left empty deliberately; see the docblock.
 */
export const DOCUMENT_KEY_EDITORS = Object.freeze({});

/** ⛓ `preset_sidecars` → `Preset sidecars`. A label, not a second name. */
export function labelForKey(key) {
    const words = String(key).replace(/[_-]+/g, ' ').trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : String(key);
}

/** ⛓ Does this property's subschema key itself by player slot? */
function isPerPlayer(propSchema) {
    const pp = propSchema && propSchema.patternProperties;
    return !!(pp && Object.prototype.hasOwnProperty.call(pp, PLAYER_SLOT_PATTERN));
}

/**
 * ⛓⛓⛓ **THE REGISTRY, DERIVED.** One entry per `schema.properties` key, in the
 * schema's own order.
 *
 * @param {object} schema the parsed `rules.schema.json`
 * @returns {ReadonlyArray<{key:string, label:string, description:string,
 *   type:string|null, perPlayer:boolean, required:boolean, ownedByTab:string|null,
 *   editor:object|null}>}
 */
export function buildDocumentKeys(schema) {
    const props = schema && schema.properties;
    if (!props || typeof props !== 'object') {
        throw new Error('documentKeys: buildDocumentKeys needs the parsed rules.schema.json — '
            + 'its `properties` object is what the registry IS. In node, '
            + '`loadRulesSchema()` from procgenCore/jsonSchemaFiles.js; on the page, the '
            + 'schema the panel fetched.');
    }
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    return Object.freeze(Object.entries(props).map(([key, propSchema]) => Object.freeze({
        key,
        label: labelForKey(key),
        description: typeof propSchema.description === 'string' ? propSchema.description : '',
        type: typeof propSchema.type === 'string' ? propSchema.type : null,
        perPlayer: isPerPlayer(propSchema),
        required: required.has(key),
        ownedByTab: TAB_FOR_KEY[key] ?? null,
        editor: DOCUMENT_KEY_EDITORS[key] ?? null,
    })));
}

/**
 * ⛓ What a value LOOKS like in one row, without stringifying a 2 MB block into
 * the label. Scalars render inline; containers get a size line and their
 * pretty-printed JSON only when the row is expanded.
 */
export function summarizeValue(value) {
    if (value === undefined) return { kind: 'absent', inline: '(absent)', size: null };
    if (value === null) return { kind: 'scalar', inline: 'null', size: null };
    if (Array.isArray(value)) {
        return {
            kind: 'array',
            inline: `[ ${value.length} item${value.length === 1 ? '' : 's'} ]`,
            size: value.length,
        };
    }
    if (typeof value === 'object') {
        const n = Object.keys(value).length;
        return { kind: 'object', inline: `{ ${n} key${n === 1 ? '' : 's'} }`, size: n };
    }
    return { kind: 'scalar', inline: JSON.stringify(value), size: null };
}

/**
 * ⛓⛓ **THE ROWS THE DOCUMENT TAB DRAWS**, registry order first, then whatever
 * the document carries that the schema does not name.
 *
 * A per-player entry's `value` is the SELECTED SLOT's slice, and `present` is
 * about that slice — a document that has `regions` but no `regions["2"]` shows
 * player 2's row as absent rather than showing player 1's data under player 2.
 *
 * @param {object} doc     the working copy (`session.record()`)
 * @param {object} schema  parsed `rules.schema.json`
 * @param {{player?: string}} [options]
 */
export function documentKeyRows(doc, schema, { player = '1' } = {}) {
    const entries = buildDocumentKeys(schema);
    const declared = new Set(entries.map((e) => e.key));
    const rows = entries.map((entry) => {
        const top = doc ? doc[entry.key] : undefined;
        const value = entry.perPlayer
            ? (top && typeof top === 'object' && !Array.isArray(top) ? top[player] : undefined)
            : top;
        return {
            ...entry,
            unknown: false,
            player: entry.perPlayer ? player : null,
            topLevelPresent: doc ? Object.prototype.hasOwnProperty.call(doc, entry.key) : false,
            present: value !== undefined,
            value,
            summary: summarizeValue(value),
        };
    });
    for (const key of Object.keys(doc ?? {})) {
        if (declared.has(key)) continue;
        const value = doc[key];
        rows.push({
            key,
            label: labelForKey(key),
            description: '⚠ NOT declared in rules.schema.json — this document carries it and the '
                + 'schema does not name it, so there is no producer to quote and no shape to '
                + 'check. Shown raw so an "every element" tab does not silently drop a key that '
                + 'is visibly in the file.',
            type: null,
            perPlayer: false,
            required: false,
            ownedByTab: null,
            editor: null,
            unknown: true,
            player: null,
            topLevelPresent: true,
            present: value !== undefined,
            value,
            summary: summarizeValue(value),
        });
    }
    return rows;
}

/**
 * ⛓ The player slots a document is ABOUT, as strings, numerically sorted.
 *
 * ⛔ It is the UNION over every per-player key rather than `player_names` alone:
 * a hand-built or partially-exported document can carry `regions["2"]` without a
 * name for slot 2, and a selector that could not reach it would make that slice
 * uneditable with no visible reason.
 */
export function playerSlotsOf(doc, schema) {
    const slots = new Set();
    for (const entry of buildDocumentKeys(schema)) {
        if (!entry.perPlayer) continue;
        const top = doc ? doc[entry.key] : undefined;
        if (!top || typeof top !== 'object' || Array.isArray(top)) continue;
        for (const slot of Object.keys(top)) {
            if (/^[0-9]+$/.test(slot)) slots.add(slot);
        }
    }
    return [...slots].sort((a, b) => Number(a) - Number(b));
}

/**
 * ⛓⛓ **THE DEFAULT SLOT, AND ITS ORDER IS A RULING** (plan §10.5 ⚖ 2): the
 * document's own `playerId` FIRST — it is the only top-level key that says which
 * slot the document is about, and it is a STRING (`exporter.py:2864-2866`) —
 * then the first slot the document actually carries, then `'1'`.
 *
 * ⛔ `playerId` is only honoured when the document really has that slot: a
 * player-specific export names its own slot and carries it, but a document that
 * named a slot it does not hold would leave every tab drawing an empty world
 * with no way to see why.
 */
export function defaultPlayerOf(doc, schema, fallback = '1') {
    const slots = playerSlotsOf(doc, schema);
    const declared = doc ? doc.playerId : undefined;
    if (typeof declared === 'string' && declared !== ''
        && (slots.length === 0 || slots.includes(declared))) {
        return declared;
    }
    const names = doc && doc.player_names;
    if (names && typeof names === 'object' && !Array.isArray(names)) {
        const first = Object.keys(names)[0];
        if (first !== undefined) return first;
    }
    return slots.length > 0 ? slots[0] : fallback;
}
