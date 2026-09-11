/**
 * procgenCore/sidecarFields — **WHAT A SUBSTRATE'S `playable_payload` MAY
 * CARRY, DECLARED BY THE SUBSTRATE** (PRESET SIDECARS slice D0; plan §7.4,
 * ⚖ Q1 **C**: field DESCRIPTORS carrying an optional per-field JSON-Schema
 * fragment, plus a corpus gate).
 *
 * `rules.schema.json` calls `playable_payload` OPAQUE and it stays so: the
 * payload belongs to the substrate, and the SERIALIZER is its authority. What
 * the schema cannot say, the substrate's registry entry now does, in its
 * `sidecarFields` slot — one DESCRIPTOR per top-level payload key:
 *
 *   { type, required?, enum?, derived?, description, schema? }
 *
 *   `type`        one JSON type name (`SIDECAR_FIELD_TYPES`)
 *   `required`    true when EVERY producer of this substrate emits the key — a
 *                 fact about the writers, read off the committed corpus; its
 *                 absence means the entry was not written by one of them
 *   `enum`        the closed set of values, when the corpus and the code agree
 *                 there is one (each value of `type`)
 *   `derived`     true when the value is COMPUTED at write, not chosen by a
 *                 person — an editor greys it, and a raw save that changes it
 *                 re-derives nothing. ⛔ A derived field's `description` NAMES
 *                 ITS WRITER in a code span, or the declaration is refused.
 *   `description` what the field is, who writes it, who reads it
 *   `schema`      a JSON-Schema fragment for the VALUE (nested shape: a side
 *                 inside `exits[]`, a physics profile inside `params`),
 *                 evaluated by `jsonSchemaCheck.js`. ⛔ It may not carry its own
 *                 top-level `type`/`enum`: those have ONE spelling, above.
 *
 * ── ⛓⛓ THE ENVELOPE IS DECLARED ONCE, HERE ──────────────────────────
 *
 * Four keys on every pipeline-written payload are the ENGINE's, not the
 * substrate's. `buildPresetSidecars` (`procgenPipelineEngine.js`) re-attaches
 * the region descriptor's `exits` (and `entrance`, when one is defined) onto
 * the payload right before calling the adapter's `serializeWorld`, then
 * stamps `manaEnabled` (only when loop mode is opted in) and `fogEnabled`
 * (always) AFTER it. Those four are `ENVELOPE_SIDECAR_FIELDS`.
 *
 * ⛔ A substrate may NOT redeclare an envelope field — that is a named refusal
 * (`ENVELOPE_REDECLARED`), never a silent override: a substrate that says
 * what `exits` IS would be a second spelling of a field the engine writes.
 * ⛓ It MAY say it REQUIRES one, by naming the key with exactly
 * `REQUIRED_ENVELOPE_FIELD` (`{required: true}`) — a presence claim about its
 * own producers (every committed maze entry carries `entrance`; not every jta
 * entry carries `exits`), which changes nothing about what the field is.
 * Every envelope field is optional until a substrate says so, because a
 * second producer exists: the atlas compilers write `exits` themselves and
 * stamp neither flag.
 *
 * ── ⛔ THIS FILE KNOWS NO SUBSTRATE ─────────────────────────────────────
 *
 * `bindingContract.test.js` scans every shipping module here for a binding
 * import. The declarations live in each substrate's own files, on its
 * registry entry; this is only their vocabulary. The one import from
 * `shared/` is the grid's side vocabulary, which is the ENGINE's — an exit's
 * `side` is a side of the driver's grid cell.
 */

import { KNOWN_KEYWORDS, schemaErrors } from './jsonSchemaCheck.js';
import { SIDES } from '../shared/procgen/spatialPrimitives.js';

/** The JSON type names a descriptor's `type` may carry — JSON Schema's own. */
export const SIDECAR_FIELD_TYPES = Object.freeze(
    ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);

/** The keys a descriptor may carry. Anything else is `UNKNOWN_KEY`. */
export const SIDECAR_DESCRIPTOR_KEYS = Object.freeze(
    ['type', 'required', 'enum', 'derived', 'description', 'schema']);

/**
 * ⛓ Every way a declaration or a payload is refused, BY NAME. A row asserts
 * the code, never the wording, so the sentences can improve without moving a
 * test.
 */
export const SIDECAR_FIELD_ERRORS = Object.freeze({
    NOT_A_DECLARATION: 'NOT_A_DECLARATION',
    NOT_A_DESCRIPTOR: 'NOT_A_DESCRIPTOR',
    UNKNOWN_KEY: 'UNKNOWN_KEY',
    BAD_TYPE: 'BAD_TYPE',
    BAD_REQUIRED: 'BAD_REQUIRED',
    BAD_DERIVED: 'BAD_DERIVED',
    BAD_DESCRIPTION: 'BAD_DESCRIPTION',
    DERIVED_WITHOUT_WRITER: 'DERIVED_WITHOUT_WRITER',
    BAD_ENUM: 'BAD_ENUM',
    BAD_SCHEMA: 'BAD_SCHEMA',
    ENVELOPE_REDECLARED: 'ENVELOPE_REDECLARED',
    // payload-side
    NO_DECLARATION: 'NO_DECLARATION',
    UNDECLARED_FIELD: 'UNDECLARED_FIELD',
    MISSING_REQUIRED: 'MISSING_REQUIRED',
    INVALID_VALUE: 'INVALID_VALUE',
});

/** Thrown by `sidecarFieldsOf`; `.errors` holds every `{field, code, message}`. */
export class SidecarFieldsError extends Error {
    constructor(owner, errors) {
        super(`sidecarFields of '${owner}': ${errors.map((e) => e.message).join('; ')}`);
        this.name = 'SidecarFieldsError';
        this.code = errors[0]?.code ?? null;
        this.errors = errors;
    }
}

/**
 * ⛓ The one spelling of "this substrate's producers always emit this envelope
 * field". Named in a substrate's `sidecarFields` under the envelope key.
 */
export const REQUIRED_ENVELOPE_FIELD = Object.freeze({ required: true });

/** An exit's `side`: a side of the driver's grid cell, or `null` where the
 *  exit is not on one (the maze atlas projection's crossing exits). */
const EXIT_SIDE_VALUES = Object.freeze([...SIDES, null]);

/**
 * ⛓⛓ THE FOUR ENGINE-OWNED FIELDS. See the docblock for the rule; each
 * description names where it is written.
 */
export const ENVELOPE_SIDECAR_FIELDS = Object.freeze({
    exits: Object.freeze({
        type: 'array',
        derived: true,
        description: 'The region\'s exits. ENGINE-owned: `buildPresetSidecars` re-attaches the region '
            + 'descriptor\'s exits (`getRegionExits`) onto the payload before the adapter\'s '
            + '`serializeWorld`, which decides each item\'s shape; the atlas compilers '
            + '(`buildFlashRegionSidecars`, the maze atlas projection) write their own. Every '
            + 'host\'s `deserializeWorld` turns the array into a Map keyed by `exitName ?? exit_id` '
            + '— a non-array breaks `exits.has`.',
        schema: Object.freeze({
            items: Object.freeze({
                type: 'object',
                required: Object.freeze(['exit_id']),
                properties: Object.freeze({
                    exit_id: Object.freeze({ type: 'string' }),
                    exitName: Object.freeze({ type: ['string', 'null'] }),
                    targetRegion: Object.freeze({ type: ['string', 'null'] }),
                    targetExitId: Object.freeze({ type: ['string', 'null'] }),
                    side: Object.freeze({ enum: EXIT_SIDE_VALUES }),
                    x: Object.freeze({ type: 'integer' }),
                    y: Object.freeze({ type: 'integer' }),
                    isBackExit: Object.freeze({ type: 'boolean' }),
                    isTeleporter: Object.freeze({ type: 'boolean' }),
                }),
            }),
        }),
    }),
    entrance: Object.freeze({
        type: 'object',
        description: 'The tile a player arrives on. ENGINE-owned: `buildPresetSidecars` re-attaches '
            + '`getRegionEntrance(region)` before serialize and OMITS it when undefined (a '
            + 'sphere-growth zone region has none).',
        schema: Object.freeze({
            required: Object.freeze(['x', 'y']),
            properties: Object.freeze({
                x: Object.freeze({ type: 'integer' }),
                y: Object.freeze({ type: 'integer' }),
            }),
        }),
    }),
    fogEnabled: Object.freeze({
        type: 'boolean',
        description: 'Fog of war. ENGINE-owned: `buildPresetSidecars` stamps it AFTER serialize on '
            + 'every region it writes (default true; `false` is the reveal-everything opt-out). The '
            + 'atlas compilers stamp none. Read by the maze and the text adventure; the flash, jta '
            + 'and omsi hosts ignore it.',
    }),
    manaEnabled: Object.freeze({
        type: 'boolean',
        description: 'Loop-mode mana hooks. ENGINE-owned: `buildPresetSidecars` stamps `true` AFTER '
            + 'serialize only when the run opted into loop mode, and writes nothing otherwise — '
            + 'absent means off.',
    }),
});

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function jsonTypeOf(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    return typeof value;
}

/**
 * Every keyword in a fragment — and in each of its SUBSCHEMAS — is one
 * `jsonSchemaCheck` implements. The evaluator already throws on an unknown
 * keyword, but only when a value reaches it; a declaration is refused up
 * front instead, so a typo in a fragment no committed value happens to reach
 * is not a silent pass.
 */
function fragmentKeywordErrors(fragment, path) {
    if (!isPlainObject(fragment)) return [`${path} is not an object`];
    const out = [];
    for (const kw of Object.keys(fragment)) {
        if (!KNOWN_KEYWORDS.has(kw)) out.push(`${path} uses '${kw}', which jsonSchemaCheck does not implement`);
    }
    const sub = (s, p) => { if (isPlainObject(s)) out.push(...fragmentKeywordErrors(s, p)); };
    for (const [k, s] of Object.entries(fragment.properties ?? {})) sub(s, `${path}.properties.${k}`);
    for (const [k, s] of Object.entries(fragment.patternProperties ?? {})) sub(s, `${path}.patternProperties.${k}`);
    sub(fragment.items, `${path}.items`);
    sub(fragment.additionalProperties, `${path}.additionalProperties`);
    for (const kw of ['oneOf', 'anyOf', 'allOf']) {
        (fragment[kw] ?? []).forEach((s, i) => sub(s, `${path}.${kw}[${i}]`));
    }
    return out;
}

/** A code span in a description — the one checkable spelling of "names its writer". */
const NAMES_A_WRITER = /`[^`]+`/;

/** The shape errors of ONE descriptor. */
function descriptorErrors(field, d) {
    const E = SIDECAR_FIELD_ERRORS;
    const err = (code, message) => ({ field, code, message: `'${field}': ${message}` });
    if (!isPlainObject(d)) return [err(E.NOT_A_DESCRIPTOR, 'a descriptor must be an object')];
    const out = [];
    for (const k of Object.keys(d)) {
        if (!SIDECAR_DESCRIPTOR_KEYS.includes(k)) {
            out.push(err(E.UNKNOWN_KEY, `unknown descriptor key '${k}' (allowed: ${SIDECAR_DESCRIPTOR_KEYS.join(', ')})`));
        }
    }
    if (!SIDECAR_FIELD_TYPES.includes(d.type)) {
        out.push(err(E.BAD_TYPE, `type ${JSON.stringify(d.type)} is not one of ${SIDECAR_FIELD_TYPES.join(', ')}`));
    }
    if ('required' in d && typeof d.required !== 'boolean') {
        out.push(err(E.BAD_REQUIRED, 'required must be a boolean'));
    }
    if ('derived' in d && typeof d.derived !== 'boolean') {
        out.push(err(E.BAD_DERIVED, 'derived must be a boolean'));
    }
    if (typeof d.description !== 'string' || d.description.trim() === '') {
        out.push(err(E.BAD_DESCRIPTION, 'description must be a non-empty string'));
    } else if (d.derived === true && !NAMES_A_WRITER.test(d.description)) {
        out.push(err(E.DERIVED_WITHOUT_WRITER,
            'a derived field\'s description must name its WRITER in a code span'));
    }
    if ('enum' in d) {
        if (!Array.isArray(d.enum) || d.enum.length === 0) {
            out.push(err(E.BAD_ENUM, 'enum must be a non-empty array'));
        } else if (SIDECAR_FIELD_TYPES.includes(d.type)) {
            const stray = d.enum.filter((v) => {
                const t = jsonTypeOf(v);
                return !(t === d.type || (d.type === 'number' && t === 'integer'));
            });
            if (stray.length) out.push(err(E.BAD_ENUM, `enum value(s) ${JSON.stringify(stray)} are not of type '${d.type}'`));
        }
    }
    if ('schema' in d) {
        if (!isPlainObject(d.schema)) {
            out.push(err(E.BAD_SCHEMA, 'schema must be a JSON-Schema object'));
        } else {
            for (const own of ['type', 'enum']) {
                if (own in d.schema) {
                    out.push(err(E.BAD_SCHEMA, `schema may not carry its own top-level '${own}' — the descriptor's is the one spelling`));
                }
            }
            for (const m of fragmentKeywordErrors(d.schema, 'schema')) out.push(err(E.BAD_SCHEMA, m));
        }
    }
    return out;
}

const isRequiredEnvelopeClaim = (d) => isPlainObject(d)
    && Object.keys(d).length === 1 && d.required === true;

/**
 * ⛓ THE SHAPE VALIDATOR — a declaration as a substrate writes it on its
 * entry: `{fieldName: descriptor}`, where an ENVELOPE key may appear only as
 * `REQUIRED_ENVELOPE_FIELD`.
 *
 * @param {object} decl
 * @returns {{field:string|null, code:string, message:string}[]} empty = valid
 */
export function validateSidecarFields(decl) {
    const E = SIDECAR_FIELD_ERRORS;
    if (!isPlainObject(decl)) {
        return [{ field: null, code: E.NOT_A_DECLARATION, message: 'a sidecarFields declaration must be an object of field descriptors' }];
    }
    const out = [];
    for (const [field, d] of Object.entries(decl)) {
        if (Object.prototype.hasOwnProperty.call(ENVELOPE_SIDECAR_FIELDS, field)) {
            if (!isRequiredEnvelopeClaim(d)) {
                out.push({
                    field,
                    code: E.ENVELOPE_REDECLARED,
                    message: `'${field}' is an ENGINE-owned envelope field, declared once in `
                        + 'procgenCore/sidecarFields.js — a substrate may only claim it REQUIRED '
                        + '(REQUIRED_ENVELOPE_FIELD), never redeclare it',
                });
            }
            continue;
        }
        out.push(...descriptorErrors(field, d));
    }
    return out;
}

/**
 * ⛓⛓ THE MERGE — the fields a reader asks about: the entry's own descriptors,
 * plus the four envelope descriptors (tightened to `required: true` where the
 * entry claims one). Every merged descriptor carries `required` and `derived`
 * explicitly, and `owner` — `'engine'` or `'substrate'` — so a reader never has
 * to know which list a key came from.
 *
 * Returns `null` for an entry that declares nothing (there is no fallback: a
 * substrate that never declared its payload has no declaration to read).
 * ⛔ THROWS `SidecarFieldsError` on a malformed declaration, and — the case
 * this function exists to refuse — on a redeclared envelope field.
 *
 * @param {object} entry  a substrate registry entry
 * @returns {Readonly<Record<string, object>>|null}
 */
export function sidecarFieldsOf(entry) {
    const decl = entry?.sidecarFields;
    if (decl === undefined) return null;
    const errors = validateSidecarFields(decl);
    if (errors.length) throw new SidecarFieldsError(entry?.id ?? '(no id)', errors);
    const out = {};
    for (const [field, d] of Object.entries(ENVELOPE_SIDECAR_FIELDS)) {
        const tightened = decl[field] !== undefined;
        out[field] = Object.freeze({ derived: false, ...d, required: tightened, owner: 'engine' });
    }
    for (const [field, d] of Object.entries(decl)) {
        if (field in ENVELOPE_SIDECAR_FIELDS) continue;
        out[field] = Object.freeze({ required: false, derived: false, ...d, owner: 'substrate' });
    }
    return Object.freeze(out);
}

/**
 * Errors of ONE value against ONE (merged) descriptor — its `type`, `enum`
 * and `schema` fragment, evaluated as one JSON Schema by `jsonSchemaCheck`.
 */
export function sidecarFieldValueErrors(value, descriptor, path = '$') {
    const schema = {
        ...(descriptor.schema ?? {}),
        type: descriptor.type,
        ...(descriptor.enum ? { enum: descriptor.enum } : {}),
    };
    return schemaErrors(value, schema, schema, path);
}

/**
 * ⛓⛓⛓ THE PAYLOAD CHECK — the predicate the corpus gate asks of every entry,
 * and the one a validity report will ask of an edit. Three rules, each by
 * name: every top-level key is DECLARED (`UNDECLARED_FIELD` — the pin
 * between the declaration and the serializer), every `required` field is
 * present (`MISSING_REQUIRED`), every value holds its descriptor
 * (`INVALID_VALUE`).
 *
 * @param {Record<string, object>|null} fields  `sidecarFieldsOf(entry)`
 * @param {object} payload                       the entry's `playable_payload`
 * @returns {{field:string|null, code:string, message:string}[]}
 */
export function sidecarPayloadErrors(fields, payload) {
    const E = SIDECAR_FIELD_ERRORS;
    if (!fields) {
        return [{ field: null, code: E.NO_DECLARATION, message: 'the substrate declares no sidecarFields' }];
    }
    if (!isPlainObject(payload)) {
        return [{ field: null, code: E.INVALID_VALUE, message: 'playable_payload is not an object' }];
    }
    const out = [];
    for (const key of Object.keys(payload)) {
        if (!Object.prototype.hasOwnProperty.call(fields, key)) {
            out.push({ field: key, code: E.UNDECLARED_FIELD, message: `'${key}' is carried but not declared` });
        }
    }
    for (const [field, d] of Object.entries(fields)) {
        if (!(field in payload)) {
            if (d.required) out.push({ field, code: E.MISSING_REQUIRED, message: `required '${field}' is absent` });
            continue;
        }
        for (const m of sidecarFieldValueErrors(payload[field], d, field)) {
            out.push({ field, code: E.INVALID_VALUE, message: m });
        }
    }
    return out;
}
