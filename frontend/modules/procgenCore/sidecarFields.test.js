/**
 * procgenCore/sidecarFields — **THE VOCABULARY'S OWN ROWS** (PRESET SIDECARS
 * slice D0).
 *
 * ⛓ Everything here is SYNTHETIC on purpose: the shape validator, the merge
 * and the payload check are asked of declarations this file writes, so a row
 * can name the one defect it plants. What the REAL declarations say is
 * `sidecarFieldsRegistry.test.js`; what the committed corpus says is the gate
 * (`scripts/procgen/check-sidecar-fields.mjs`).
 *
 * ⛔ Rows assert the refusal CODE, never the wording.
 */
import { describe, expect, it } from 'vitest';

import {
    ENVELOPE_SIDECAR_FIELDS, REQUIRED_ENVELOPE_FIELD, SIDECAR_FIELD_ERRORS as E,
    SidecarFieldsError, envelopeExitNames, nameMapValues, sidecarFieldsOf, sidecarFieldValueErrors,
    sidecarPayloadErrors, validateSidecarFields,
} from './sidecarFields.js';
import { SIDES } from '../shared/procgen/spatialPrimitives.js';

/** A well-formed declaration every malformed one below departs from by ONE key. */
const GOOD = Object.freeze({
    width: { type: 'integer', required: true, description: 'Grid width.' },
    lib: { type: 'object', derived: true, description: 'Written by `serializeThing`.' },
    mode: { type: 'string', enum: ['a', 'b'], description: 'A closed set.' },
    cells: {
        type: 'array',
        description: 'Cells.',
        schema: { items: { type: 'integer', minimum: 0 } },
    },
});
const codes = (decl) => validateSidecarFields(decl).map((e) => e.code);
const withField = (name, d) => ({ ...GOOD, [name]: d });

describe('validateSidecarFields — the descriptor SHAPE, each defect refused by name', () => {
    it('the well-formed control passes — every row below is ONE departure from it', () => {
        expect(validateSidecarFields(GOOD)).toEqual([]);
    });

    it.each([
        ['a declaration that is not an object', null, E.NOT_A_DECLARATION],
        ['a declaration that is an array', [], E.NOT_A_DECLARATION],
    ])('%s → %s', (_what, decl, code) => {
        expect(codes(decl)).toEqual([code]);
    });

    it.each([
        ['a descriptor that is not an object', 'integer', E.NOT_A_DESCRIPTOR],
        ['an unknown descriptor key', { type: 'string', description: 'x', owner: 'me' }, E.UNKNOWN_KEY],
        ['a type outside JSON\'s', { type: 'int', description: 'x' }, E.BAD_TYPE],
        ['a missing type', { description: 'x' }, E.BAD_TYPE],
        ['a non-boolean required', { type: 'string', required: 'yes', description: 'x' }, E.BAD_REQUIRED],
        ['a non-boolean derived', { type: 'string', derived: 1, description: 'x' }, E.BAD_DERIVED],
        ['an empty description', { type: 'string', description: '  ' }, E.BAD_DESCRIPTION],
        ['a derived field whose description names no writer',
            { type: 'string', derived: true, description: 'Computed somewhere.' }, E.DERIVED_WITHOUT_WRITER],
        ['an empty enum', { type: 'string', enum: [], description: 'x' }, E.BAD_ENUM],
        ['an enum value of the wrong type', { type: 'string', enum: ['a', 2], description: 'x' }, E.BAD_ENUM],
        ['a schema that is not an object', { type: 'array', schema: [], description: 'x' }, E.BAD_SCHEMA],
        ['a schema carrying its own top-level type',
            { type: 'array', schema: { type: 'array' }, description: 'x' }, E.BAD_SCHEMA],
        ['a schema carrying its own top-level enum',
            { type: 'string', schema: { enum: ['a'] }, description: 'x' }, E.BAD_SCHEMA],
        ['a schema keyword jsonSchemaCheck does not implement, NESTED',
            { type: 'array', schema: { items: { type: 'integer', maximum: 3 } }, description: 'x' },
            E.BAD_SCHEMA],
        // ⛓ V0 — `references`: exactly {field, key}, and a field this declaration has
        ['references that is not an object', { type: 'object', references: 'lib', description: 'x' },
            E.BAD_REFERENCES],
        ['references with a key beyond {field, key}',
            { type: 'object', references: { field: 'lib', key: 'id', via: 'x' }, description: 'x' },
            E.BAD_REFERENCES],
        ['references naming a field the declaration does not have',
            { type: 'object', references: { field: 'nowhere', key: 'id' }, description: 'x' },
            E.BAD_REFERENCES],
    ])('%s → %s', (_what, d, code) => {
        expect(codes(withField('bad', d))).toEqual([code]);
    });

    it('⛓ V0 — a reference to a field of the same declaration is accepted, and survives the merge', () => {
        const decl = withField('ref', { type: 'object', references: { field: 'lib', key: 'id' }, description: 'x' });
        expect(validateSidecarFields(decl)).toEqual([]);
        expect(sidecarFieldsOf({ id: 't', sidecarFields: decl }).ref.references)
            .toEqual({ field: 'lib', key: 'id' });
    });

    it('a derived field that DOES name its writer in a code span is accepted (the '
        + 'DERIVED_WITHOUT_WRITER control)', () => {
        expect(codes(withField('ok', { type: 'string', derived: true, description: 'By `f`.' })))
            .toEqual([]);
    });

    it('⛔ an ENVELOPE field redeclared — a full descriptor, or any claim other than '
        + 'REQUIRED_ENVELOPE_FIELD — is ENVELOPE_REDECLARED', () => {
        expect(codes(withField('exits', { type: 'array', description: 'Mine.' })))
            .toEqual([E.ENVELOPE_REDECLARED]);
        expect(codes(withField('fogEnabled', { required: false }))).toEqual([E.ENVELOPE_REDECLARED]);
        expect(codes(withField('entrance', { required: true, description: 'x' })))
            .toEqual([E.ENVELOPE_REDECLARED]);
        // …and the one claim a substrate may make is accepted.
        expect(codes(withField('exits', REQUIRED_ENVELOPE_FIELD))).toEqual([]);
    });

    it('the envelope declares itself well formed (its descriptors pass the same validator)', () => {
        const asSubstrate = Object.fromEntries(Object.entries(ENVELOPE_SIDECAR_FIELDS)
            .map(([k, d]) => [`envelope_${k}`, d]));
        expect(validateSidecarFields(asSubstrate)).toEqual([]);
    });
});

describe('sidecarFieldsOf — the MERGE a reader asks', () => {
    it('no declaration is null — there is no fallback declaration', () => {
        expect(sidecarFieldsOf({ id: 'x' })).toBeNull();
    });

    it('the envelope fields are present, ENGINE-owned, and optional unless claimed', () => {
        const f = sidecarFieldsOf({ id: 'x', sidecarFields: GOOD });
        for (const k of Object.keys(ENVELOPE_SIDECAR_FIELDS)) {
            expect(f[k].owner, k).toBe('engine');
            expect(f[k].required, k).toBe(false);
            expect(f[k].type, k).toBe(ENVELOPE_SIDECAR_FIELDS[k].type);
        }
    });

    it('REQUIRED_ENVELOPE_FIELD tightens that one field and leaves the others', () => {
        const f = sidecarFieldsOf({ id: 'x', sidecarFields: { ...GOOD, entrance: REQUIRED_ENVELOPE_FIELD } });
        expect(f.entrance.required).toBe(true);
        expect(f.entrance.description).toBe(ENVELOPE_SIDECAR_FIELDS.entrance.description);
        expect(f.exits.required).toBe(false);
    });

    it('a substrate field is KEPT, SUBSTRATE-owned, with the omitted flags filled as false', () => {
        const f = sidecarFieldsOf({ id: 'x', sidecarFields: GOOD });
        expect(f.width).toMatchObject({ type: 'integer', required: true, derived: false, owner: 'substrate' });
        expect(f.lib).toMatchObject({ derived: true, required: false, owner: 'substrate' });
        expect(Object.keys(f).sort())
            .toEqual([...Object.keys(ENVELOPE_SIDECAR_FIELDS), ...Object.keys(GOOD)].sort());
    });

    it('⛔ a REDECLARED envelope field throws by name — never a silent override', () => {
        const entry = { id: 'rogue', sidecarFields: { ...GOOD, exits: { type: 'object', description: 'x' } } };
        let thrown = null;
        try { sidecarFieldsOf(entry); } catch (e) { thrown = e; }
        expect(thrown).toBeInstanceOf(SidecarFieldsError);
        expect(thrown.code).toBe(E.ENVELOPE_REDECLARED);
        expect(thrown.message).toContain('rogue');
    });

    it('a malformed declaration throws too (the merge never reads a shape it has not checked)', () => {
        expect(() => sidecarFieldsOf({ id: 'x', sidecarFields: withField('bad', { type: 'int', description: 'x' }) }))
            .toThrow(SidecarFieldsError);
    });
});

describe('the VALUE check — type, enum and schema fragment, through jsonSchemaCheck', () => {
    const f = sidecarFieldsOf({ id: 'x', sidecarFields: GOOD });

    it('a schema fragment REJECTS a wrong value and accepts a right one', () => {
        expect(sidecarFieldValueErrors([0, 1, 2], f.cells)).toEqual([]);
        expect(sidecarFieldValueErrors([0, -1], f.cells).join()).toContain('minimum');
    });

    it('the envelope\'s exit fragment refuses a side outside the grid\'s vocabulary', () => {
        // ⛓ anchored on the REAL vocabulary, not a copy of it: every side the
        //   grid declares passes, and so does the atlas projection's null.
        for (const side of [...SIDES, null]) {
            expect(sidecarFieldValueErrors([{ exit_id: 'e', side }], f.exits), String(side)).toEqual([]);
        }
        expect(sidecarFieldValueErrors([{ exit_id: 'e', side: 'NE' }], f.exits).join()).toContain('enum');
        expect(sidecarFieldValueErrors([{ side: 'N' }], f.exits).join()).toContain('exit_id');
    });

    it('an enum and a type are enforced from the descriptor itself', () => {
        expect(sidecarFieldValueErrors('c', f.mode).join()).toContain('enum');
        expect(sidecarFieldValueErrors(3.5, f.width).join()).toContain('type');
    });
});

describe('sidecarPayloadErrors — the three rules the corpus gate asks, by name', () => {
    const f = sidecarFieldsOf({ id: 'x', sidecarFields: GOOD });
    const payload = { width: 3, lib: {}, mode: 'a', cells: [0], exits: [] };

    it('a payload that holds its declaration has no errors (the control)', () => {
        expect(sidecarPayloadErrors(f, payload)).toEqual([]);
    });

    it('⛔ an UNDECLARED top-level key is UNDECLARED_FIELD — the declaration ↔ serializer pin', () => {
        const errs = sidecarPayloadErrors(f, { ...payload, surprise: 1 });
        expect(errs.map((e) => [e.field, e.code])).toEqual([['surprise', E.UNDECLARED_FIELD]]);
    });

    it('a missing REQUIRED field is MISSING_REQUIRED; a missing optional one is nothing', () => {
        const { width: _w, mode: _m, ...rest } = payload;
        expect(sidecarPayloadErrors(f, rest).map((e) => [e.field, e.code]))
            .toEqual([['width', E.MISSING_REQUIRED]]);
    });

    it('a value that breaks its descriptor is INVALID_VALUE, naming the field', () => {
        expect(sidecarPayloadErrors(f, { ...payload, mode: 'z' }).map((e) => [e.field, e.code]))
            .toEqual([['mode', E.INVALID_VALUE]]);
    });

    it('no declaration is NO_DECLARATION — never a pass', () => {
        expect(sidecarPayloadErrors(null, payload).map((e) => e.code)).toEqual([E.NO_DECLARATION]);
    });
});

describe('⛓ V0 — the two AP-name readers a registry entry may assign to its slots', () => {
    it('envelopeExitNames: every non-null exitName, in order; null without an exits array', () => {
        expect(envelopeExitNames({ exits: [{ exit_id: 'a', exitName: 'A' }, { exit_id: 'b', exitName: null },
            { exit_id: 'c', exitName: 'C' }] })).toEqual(['A', 'C']);
        expect(envelopeExitNames({ exits: [] })).toEqual([]);
        expect(envelopeExitNames({})).toBeNull();
        expect(envelopeExitNames(null)).toBeNull();
    });

    it('nameMapValues(field): the map\'s string values; null when the payload carries no map', () => {
        const read = nameMapValues('names');
        expect(read({ names: { a: 'A', b: 'B', c: 3 } })).toEqual(['A', 'B']);
        expect(read({ names: {} })).toEqual([]);
        expect(read({ other: { a: 'A' } })).toBeNull();
        expect(read({ names: ['A'] })).toBeNull();
    });
});
