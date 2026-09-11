/**
 * apworldEditor/sidecarForm — **THE FIELDS VIEW'S MODEL: what a region's
 * sidecar-entry form draws, and the WHOLE entry one control's change writes**
 * (PRESET SIDECARS slice D1; plan §3, §8b rung 6).
 *
 * ⚖ The user, 2026-09-10 (Q3 A): the block edits the whole entry, and *"have
 * the editor load [the substrate's declared options] as the set of options to
 * choose from."* D0 made the declaration (`sidecarFieldsOf`); this reads it.
 *
 * ── ⛓⛓ WHERE EVERY ROW COMES FROM ─────────────────────────────────────
 *
 *   **entry-level** — the SCHEMA's: the entry subschema `rules.schema.json`
 *   gives `preset_sidecars` (resolved through its own `$ref`, never named
 *   here), one row per property but the payload, in the schema's order. Its
 *   `required` array marks the required ones. ⛓ `substrate`'s vocabulary is
 *   the REGISTRY's — the ids whose entry declares `deserializeWorld`
 *   (`playableSubstrateIds`) — because that is what the play-time host can
 *   load a room with; the schema says only "a string".
 *
 *   **payload** — the DECLARATION's: `sidecarFieldsOf(registry.get(substrate))`,
 *   the substrate's own fields merged with the engine's envelope, in the
 *   merge's order. Type, enum, required, derived and the description (which,
 *   for a derived field, names its WRITER — D0 refuses a declaration that does
 *   not) are the descriptor's. ⛔ Never the payload's keys: a field the entry
 *   lacks is still a row (drawn absent), and a key the declaration does not
 *   name is the validity report's business (V0's UNDECLARED_FIELD), not a row.
 *
 * ── ⛓ THE CONTROL IS CHOSEN BY TYPE ─────────────────────────────────────
 *
 *   boolean                         → checkbox
 *   string · number · integer + enum → select over the enum
 *   string                          → text input
 *   number · integer                → number input
 *   object · array                  → a read-only summary, edited in the JSON
 *   null, or a value whose JSON type is not the declared one → read-only value
 *
 * A DERIVED field's control is drawn DISABLED (the panel greys it and puts the
 * descriptor's description — its writer — in the title): the form is the safe
 * path. The JSON widget beside it stays fully editable (the escape hatch).
 *
 * ── ⛔ THIS FILE KNOWS NO SUBSTRATE ─────────────────────────────────────
 *
 * Two keys are named, and both are the ENTRY's (the schema's), not a
 * substrate's: `substrate` — whose vocabulary is the registry — and
 * `playable_payload` — whose fields the declaration speaks for.
 */

import { sidecarFieldsOf } from '../procgenCore/sidecarFields.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

/** ⛓ The entry key the play-time host loads the room BY — its vocabulary is the registry. */
export const SUBSTRATE_KEY = 'substrate';
/** ⛓ The entry key holding the substrate's own serialized world — its fields are DECLARED. */
export const PAYLOAD_KEY = 'playable_payload';

/** ⛓ Which of the two field lists a row is on. */
export const SIDECAR_FORM_LEVELS = Object.freeze({ ENTRY: 'entry', PAYLOAD: 'payload' });

/** ⛓ The controls a row may draw, by name — a row asserts the name, not the element. */
export const SIDECAR_FORM_CONTROLS = Object.freeze({
    CHECKBOX: 'checkbox',
    SELECT: 'select',
    TEXT: 'text',
    NUMBER: 'number',
    SUMMARY: 'summary',
    NONE: 'none',
});

/**
 * ⛓ The one clause the `substrate` picker's title adds (⚖ the replan: the
 * raw save ACCEPTS a changed `substrate`; the payload is not rebuilt). Exported
 * so a row asserts the sentence the product wrote rather than a copy.
 */
export const SUBSTRATE_PICKER_CLAUSE =
    'changes the label only — regenerate in the pipeline to rebuild the payload';

const C = SIDECAR_FORM_CONTROLS;
const L = SIDECAR_FORM_LEVELS;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => isPlainObject(o) && Object.prototype.hasOwnProperty.call(o, k);

/** The JSON type name of a value — JSON Schema's, `integer` for a whole number. */
export function jsonTypeOf(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    return typeof value;
}

/** Does `value` hold `type`? (`number` accepts an integer — JSON Schema's rule.) */
const holdsType = (value, type) => {
    const t = jsonTypeOf(value);
    return t === type || (type === 'number' && t === 'integer');
};

/**
 * ⛓⛓ **THE CONTROL FOR A TYPE** — the table in the docblock, as the one
 * function every row asks. `SUMMARY` for the two container types (edited in
 * the JSON), `NONE` for `null` and for anything the table does not name.
 *
 * @param {string} type  a JSON type name
 * @param {boolean} hasEnum
 */
export function controlForType(type, hasEnum) {
    if (type === 'boolean') return C.CHECKBOX;
    if (type === 'string' || type === 'number' || type === 'integer') {
        if (hasEnum) return C.SELECT;
        return type === 'string' ? C.TEXT : C.NUMBER;
    }
    if (type === 'object' || type === 'array') return C.SUMMARY;
    return C.NONE;
}

/**
 * ⛓⛓ **THE `substrate` PICKER'S VOCABULARY** — every registered id whose entry
 * declares `deserializeWorld`, i.e. every substrate the play-time host can load
 * a room with. Sorted, so the list does not depend on the order modules
 * registered in. ⛔ Read off the registry at call time, never a list typed here.
 *
 * @param {{getAll: Function}} [registry]
 * @returns {string[]}
 */
export function playableSubstrateIds(registry = substrateRegistry) {
    return registry.getAll()
        .filter((e) => typeof e?.deserializeWorld === 'function')
        .map((e) => e.id)
        .sort();
}

/** Resolve a local `$ref` (`#/a/b`) against the schema root; anything else → the node itself. */
function resolveRef(root, node) {
    const ref = node?.$ref;
    if (typeof ref !== 'string' || !ref.startsWith('#/')) return node;
    let at = root;
    for (const part of ref.slice(2).split('/')) at = at?.[part];
    return at ?? null;
}

/**
 * ⛓ **THE ENTRY'S SUBSCHEMA**, reached the way the schema itself reaches it:
 * `properties.preset_sidecars` → its per-slot pattern → the per-region
 * `additionalProperties` → `$ref`. `null` when the schema is missing or shaped
 * otherwise (the form then draws no entry-level rows and says why).
 *
 * @param {object|null} rulesSchema the parsed `rules.schema.json`
 * @returns {object|null}
 */
export function sidecarEntrySchemaOf(rulesSchema) {
    const top = rulesSchema?.properties?.preset_sidecars;
    const slot = top && isPlainObject(top.patternProperties)
        ? Object.values(top.patternProperties)[0] : null;
    const entry = resolveRef(rulesSchema, slot?.additionalProperties);
    return isPlainObject(entry?.properties) ? entry : null;
}

const declarationMemo = new WeakMap();
/** `{fields}` | `{error}` for one registry entry — asked once (D0's merge validates every call). */
function declarationOf(regEntry) {
    if (!regEntry) return { fields: null };
    if (declarationMemo.has(regEntry)) return declarationMemo.get(regEntry);
    let out;
    try {
        out = { fields: sidecarFieldsOf(regEntry) };
    } catch (e) {
        out = { error: e.message };
    }
    declarationMemo.set(regEntry, out);
    return out;
}

/** A container's size in words: `{n keys}` / `[n items]`. */
export function summarizeContainer(value) {
    if (Array.isArray(value)) return `[${value.length} item${value.length === 1 ? '' : 's'}]`;
    const n = Object.keys(value).length;
    return `{${n} key${n === 1 ? '' : 's'}}`;
}

/** ONE row, from a descriptor and the container the field lives in. */
function rowOf(level, field, d, container) {
    const present = has(container, field);
    const value = present ? container[field] : undefined;
    const enumValues = Array.isArray(d.enum) ? d.enum : null;
    let control = controlForType(d.type, !!enumValues);
    let typeMismatch = false;
    if (present && !holdsType(value, d.type)) {
        // ⛔ A control chosen by the DECLARED type cannot show a value of
        //   another type (a checkbox cannot say "yes"): shown as it is, fixed
        //   in the JSON — the validity report names it too.
        typeMismatch = true;
        control = C.NONE;
    }
    if (!present && (control === C.SUMMARY || control === C.NONE)) control = C.NONE;
    return {
        field,
        level,
        type: d.type,
        enum: enumValues,
        required: d.required === true,
        derived: d.derived === true,
        description: typeof d.description === 'string' ? d.description : '',
        present,
        value,
        control,
        typeMismatch,
        summary: present && (Array.isArray(value) || isPlainObject(value))
            ? summarizeContainer(value) : null,
    };
}

/**
 * ⛓⛓⛓ **THE FORM OF ONE ENTRY** — the entry-level rows (schema) and the
 * payload rows (declaration), each in its source's order.
 *
 * @param {object} entry        the region's sidecar entry, from the CURRENT document
 * @param {object} opts
 * @param {object|null} opts.rulesSchema the parsed `rules.schema.json` (null = not loaded)
 * @param {{get: Function, getAll: Function}} [opts.registry]
 * @returns {{
 *   substrate: string|null,
 *   entryRows: object[]|null,       null = no schema to read them from
 *   payloadRows: object[]|null,     null = the substrate declares nothing (or badly)
 *   declarationError: string|null,
 *   registered: boolean,
 * }}
 */
export function sidecarFormModel(entry, { rulesSchema = null, registry = substrateRegistry } = {}) {
    const substrate = typeof entry?.[SUBSTRATE_KEY] === 'string' ? entry[SUBSTRATE_KEY] : null;

    let entryRows = null;
    const entrySchema = sidecarEntrySchemaOf(rulesSchema);
    if (entrySchema) {
        const required = new Set(Array.isArray(entrySchema.required) ? entrySchema.required : []);
        entryRows = [];
        for (const [field, sub] of Object.entries(entrySchema.properties)) {
            if (field === PAYLOAD_KEY) continue;
            const s = resolveRef(rulesSchema, sub) ?? {};
            const d = {
                type: typeof s.type === 'string' ? s.type : null,
                required: required.has(field),
                derived: false,
                description: s.description,
                ...(field === SUBSTRATE_KEY
                    ? { enum: playableSubstrateIds(registry) }
                    : (Array.isArray(s.enum) ? { enum: s.enum } : {})),
            };
            entryRows.push(rowOf(L.ENTRY, field, d, entry));
        }
    }

    const regEntry = substrate ? registry.get(substrate) : null;
    const decl = declarationOf(regEntry);
    const payload = isPlainObject(entry?.[PAYLOAD_KEY]) ? entry[PAYLOAD_KEY] : {};
    const payloadRows = decl.fields
        ? Object.entries(decl.fields).map(([field, d]) => rowOf(L.PAYLOAD, field, d, payload))
        : null;
    return {
        substrate,
        entryRows,
        payloadRows,
        declarationError: decl.error ?? null,
        registered: !!regEntry,
    };
}

/**
 * ⛓⛓⛓ **THE WHOLE ENTRY WITH ONE VALUE REPLACED** — what one control's change
 * hands to `set-region-sidecar`. A deep copy of `entry` (the CURRENT document's —
 * the caller reads it at the moment of the change, never a copy captured at
 * render, trap 1311) with exactly one field set: on the entry itself, or inside
 * its payload (created when the entry had none). ⛔ Every other field — entry
 * level and payload — is carried: the op REPLACES, so a field left out here
 * would be deleted (trap 1313).
 *
 * @param {object} entry
 * @param {'entry'|'payload'} level
 * @param {string} field
 * @param {*} value
 * @returns {object}
 */
export function withSidecarField(entry, level, field, value) {
    const next = structuredClone(entry);
    if (level === L.PAYLOAD) {
        if (!isPlainObject(next[PAYLOAD_KEY])) next[PAYLOAD_KEY] = {};
        next[PAYLOAD_KEY][field] = value;
    } else {
        next[field] = value;
    }
    return next;
}

/**
 * ⛓ **A CONTROL'S RAW READING AS THE VALUE IT WRITES** — `{ok, value}` or
 * `{ok: false, why}`. A select's reading is an index into the row's enum; a
 * number input's must parse to a finite number (the widget cannot form one
 * otherwise — an integer field given `1.5` is written and REPORTED, not
 * refused: V0 owns "does it fit").
 *
 * @param {object} row a `sidecarFormModel` row
 * @param {*} raw      checkbox: boolean; select: the option's value; inputs: text
 */
export function parseControlValue(row, raw) {
    switch (row.control) {
        case C.CHECKBOX: return { ok: true, value: raw === true };
        case C.SELECT: {
            // ⛔ `Number('')` is 0: the placeholder option's empty value would
            //   otherwise read as the enum's first entry.
            const i = String(raw).trim() === '' ? NaN : Number(raw);
            if (!Number.isInteger(i) || !row.enum || i < 0 || i >= row.enum.length) {
                return { ok: false, why: `\`${row.field}\`: pick one of the listed values` };
            }
            return { ok: true, value: row.enum[i] };
        }
        case C.TEXT: return { ok: true, value: String(raw) };
        case C.NUMBER: {
            const s = String(raw).trim();
            const n = s === '' ? NaN : Number(s);
            if (!Number.isFinite(n)) {
                return { ok: false, why: `\`${row.field}\`: "${raw}" is not a number` };
            }
            return { ok: true, value: n };
        }
        default:
            return { ok: false, why: `\`${row.field}\` has no control here — edit it in the JSON` };
    }
}

/**
 * ⛓⛓ **THE FIELDS A RAW SAVE LEAVES AS WRITTEN, NAMED** — this entry's payload
 * fields whose descriptor says `derived: true`, in declaration order, joined
 * from the declaration (never a hand list). `{names, declared, error}`:
 * `declared` false when the substrate declares no fields (nothing is known).
 *
 * @param {object} entry
 * @param {{get: Function}} [registry]
 */
export function derivedFieldsCarried(entry, registry = substrateRegistry) {
    const substrate = typeof entry?.[SUBSTRATE_KEY] === 'string' ? entry[SUBSTRATE_KEY] : null;
    const decl = declarationOf(substrate ? registry.get(substrate) : null);
    const payload = isPlainObject(entry?.[PAYLOAD_KEY]) ? entry[PAYLOAD_KEY] : {};
    if (!decl.fields) return { names: [], declared: false, error: decl.error ?? null, substrate };
    const names = Object.entries(decl.fields)
        .filter(([field, d]) => d.derived === true && has(payload, field))
        .map(([field]) => field);
    return { names, declared: true, error: null, substrate };
}

/**
 * ⛓ **"A RAW SAVE RE-DERIVES NOTHING", AS THIS ENTRY'S SENTENCE** — the derived
 * fields it carries, by name, or — where the declaration marks none, or there
 * is no declaration — a sentence that says exactly that.
 *
 * @param {object} entry
 * @param {{get: Function}} [registry]
 * @returns {string}
 */
export function rederivesNothingSentence(entry, registry = substrateRegistry) {
    const { names, declared, error, substrate } = derivedFieldsCarried(entry, registry);
    const sub = substrate ? `\`${substrate}\`` : 'this entry\'s substrate';
    if (error) {
        return `A raw save re-derives nothing — and ${sub}'s field declaration is malformed, so `
            + 'which payload fields are derived is not known here.';
    }
    if (!declared) {
        return `A raw save re-derives nothing — ${sub} declares no sidecarFields, so which `
            + 'payload fields are derived is not known here.';
    }
    if (names.length === 0) {
        return `A raw save re-derives nothing — and ${sub}'s declaration marks no field this `
            + 'entry carries as derived.';
    }
    return `A raw save re-derives nothing: ${names.map((n) => `\`${n}\``).join(', ')} `
        + `${names.length === 1 ? 'stays' : 'stay'} as written — each is computed by the `
        + 'writer its greyed row names.';
}
