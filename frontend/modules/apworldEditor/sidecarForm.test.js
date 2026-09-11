/**
 * apworldEditor/sidecarForm — **THE FIELDS VIEW'S MODEL, ITS ROWS** (PRESET
 * SIDECARS slice D1).
 *
 * ⛓ The libraries are the ones the capability-matrix generator imports
 * (`REGISTRY_LIBRARIES` — derived, never a literal list), loaded for their
 * REGISTRATION side effect: the `substrate` picker's vocabulary is the whole
 * registry, so a partial one would change its answer.
 *
 * ⛔ Every expectation is read off the DECLARATION (`sidecarFieldsOf`), the
 * SCHEMA (`rules.schema.json`) or the REGISTRY — the law — and every entry is
 * a COMMITTED one (the four-player fixture's maze and bounce slots, the jta
 * dataset fixture). A row that listed field names would agree with a copy of
 * the declaration, not with the declaration.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { loadRulesSchema } from '../procgenCore/jsonSchemaFiles.js';
import { sidecarFieldsOf } from '../procgenCore/sidecarFields.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    PAYLOAD_KEY, SIDECAR_FORM_CONTROLS, SIDECAR_FORM_LEVELS, SUBSTRATE_KEY, controlForType,
    derivedFieldsCarried, jsonTypeOf, parseControlValue, playableSubstrateIds,
    rederivesNothingSentence, sidecarEntrySchemaOf, sidecarFormModel, summarizeContainer,
    withSidecarField,
} from './sidecarForm.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

const C = SIDECAR_FORM_CONTROLS;
const L = SIDECAR_FORM_LEVELS;
const SCHEMA = loadRulesSchema();
const read = (rel) => JSON.parse(readFileSync(join(ROOT, 'frontend', 'presets', rel), 'utf8'));
const FOUR = read('multiworld/AP_05594871498841892311/AP_05594871498841892311_rules.json');
const DATASET = read('jta_dataset_test/AP_14089154938208861744/AP_14089154938208861744_rules.json');

/** Every entry of every slot of the two committed documents — the population. */
const ENTRIES = [FOUR, DATASET].flatMap((doc) => Object.entries(doc.preset_sidecars)
    .flatMap(([slot, block]) => Object.entries(block).map(([region, entry]) => ({ slot, region, entry }))));
const substrates = new Set(ENTRIES.map((e) => e.entry.substrate));

/** A deep diff of two plain JSON values → the set of paths that differ. */
function diffPaths(a, b, path = '$', out = []) {
    const isObj = (v) => v !== null && typeof v === 'object';
    if (!isObj(a) || !isObj(b) || Array.isArray(a) !== Array.isArray(b)) {
        if (JSON.stringify(a) !== JSON.stringify(b)) out.push(path);
        return out;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffPaths(a[k], b[k], `${path}.${k}`, out);
    return out;
}

const NO_DECL = 'd1_row_declares_nothing';
const NO_DESER = 'd1_row_no_deserializer';
const BAD_DECL = 'd1_row_malformed_declaration';
substrateRegistry.register({ id: NO_DECL, deserializeWorld: (p) => p });
substrateRegistry.register({ id: NO_DESER, sidecarFields: {} });
substrateRegistry.register({
    id: BAD_DECL, deserializeWorld: (p) => p,
    sidecarFields: { surprise: { type: 'not-a-type', description: 'x' } },
});

describe('⛓ the population', () => {
    it('two committed documents, and their entries hold more than one substrate', () => {
        expect(ENTRIES.length).toBeGreaterThan(0);
        expect(substrates.size).toBeGreaterThan(1);
    });
});

describe('⛓⛓ the `substrate` picker\'s vocabulary is the registry\'s playable ids', () => {
    it('every registered entry with a `deserializeWorld` is in it, and nothing else', () => {
        const ids = playableSubstrateIds();
        for (const e of substrateRegistry.getAll()) {
            expect(ids.includes(e.id), e.id).toBe(typeof e.deserializeWorld === 'function');
        }
        // ⛔ Non-vacuity: the registry holds an entry WITHOUT one, and it is left out.
        expect(substrateRegistry.get(NO_DESER)).toBeTruthy();
        expect(ids).not.toContain(NO_DESER);
    });

    it('…sorted, so it does not depend on the order modules registered in', () => {
        const ids = playableSubstrateIds();
        expect(ids).toEqual([...ids].sort());
    });

    it('…and it covers every substrate the committed entries hold', () => {
        for (const s of substrates) expect(playableSubstrateIds()).toContain(s);
    });

    it('a registry passed in is the one asked', () => {
        const fake = { getAll: () => [{ id: 'b', deserializeWorld: () => 0 }, { id: 'a', deserializeWorld: () => 0 }, { id: 'c' }] };
        expect(playableSubstrateIds(fake)).toEqual(['a', 'b']);
    });
});

describe('⛓ the entry subschema is reached through the schema\'s own $ref', () => {
    it('it is the node `preset_sidecars`\' per-region entries point at', () => {
        const slot = Object.values(SCHEMA.properties.preset_sidecars.patternProperties)[0];
        const ref = slot.additionalProperties.$ref;
        const target = ref.slice(2).split('/').reduce((at, k) => at[k], SCHEMA);
        expect(sidecarEntrySchemaOf(SCHEMA)).toBe(target);
        expect(Object.keys(sidecarEntrySchemaOf(SCHEMA).properties)).toContain(SUBSTRATE_KEY);
        expect(Object.keys(sidecarEntrySchemaOf(SCHEMA).properties)).toContain(PAYLOAD_KEY);
    });

    it('no schema, or one without the key → null (the form says so)', () => {
        expect(sidecarEntrySchemaOf(null)).toBeNull();
        expect(sidecarEntrySchemaOf({ properties: {} })).toBeNull();
    });
});

describe('⛓⛓⛓ the rows are the LAW: the schema\'s entry fields, then the declaration\'s', () => {
    const entrySchema = sidecarEntrySchemaOf(SCHEMA);
    const entryFields = Object.keys(entrySchema.properties).filter((k) => k !== PAYLOAD_KEY);

    it.each(ENTRIES.map((e) => [`${e.slot}/${e.region} (${e.entry.substrate})`, e.entry]))(
        '%s: the entry rows are the subschema\'s properties but the payload, in order', (_, entry) => {
            const m = sidecarFormModel(entry, { rulesSchema: SCHEMA });
            expect(m.entryRows.map((r) => r.field)).toEqual(entryFields);
            for (const r of m.entryRows) {
                expect(r.level).toBe(L.ENTRY);
                expect(r.required, r.field).toBe((entrySchema.required ?? []).includes(r.field));
                expect(r.derived).toBe(false);
                expect(r.present, r.field).toBe(Object.prototype.hasOwnProperty.call(entry, r.field));
            }
        });

    it.each(ENTRIES.map((e) => [`${e.slot}/${e.region} (${e.entry.substrate})`, e.entry]))(
        '%s: the payload rows are the MERGED DECLARATION, in its order, each as declared', (_, entry) => {
            const m = sidecarFormModel(entry, { rulesSchema: SCHEMA });
            const fields = sidecarFieldsOf(substrateRegistry.get(entry.substrate));
            expect(m.payloadRows.map((r) => r.field)).toEqual(Object.keys(fields));
            for (const r of m.payloadRows) {
                const d = fields[r.field];
                expect(r.level).toBe(L.PAYLOAD);
                expect([r.type, r.required, r.derived, r.description], r.field)
                    .toEqual([d.type, d.required, d.derived, d.description]);
                expect(r.present, r.field).toBe(r.field in entry.playable_payload);
            }
        });

    /**
     * ⛔ THE FIXTURE CAN SEE A PAYLOAD-KEYS LIST: a field the declaration names
     * and the entry lacks is a row all the same. Asserted as a premise, so a
     * model built from the payload's keys (mutant C's shape) could not pass the
     * rows above by coincidence.
     */
    it('…and some declared field is ABSENT from some committed entry — still a row', () => {
        const absent = ENTRIES.flatMap(({ entry }) => sidecarFormModel(entry, { rulesSchema: SCHEMA })
            .payloadRows.filter((r) => !r.present));
        expect(absent.length).toBeGreaterThan(0);
    });

    it('no schema → no entry rows (null), the payload rows regardless', () => {
        const { entry } = ENTRIES[0];
        const m = sidecarFormModel(entry, { rulesSchema: null });
        expect(m.entryRows).toBeNull();
        expect(m.payloadRows.length).toBe(Object.keys(sidecarFieldsOf(substrateRegistry.get(entry.substrate))).length);
    });

    it('a substrate that declares nothing / declares badly / is not registered → no payload rows, named', () => {
        const { entry } = ENTRIES[0];
        const none = sidecarFormModel({ ...entry, substrate: NO_DECL }, { rulesSchema: SCHEMA });
        expect([none.payloadRows, none.declarationError, none.registered]).toEqual([null, null, true]);
        const bad = sidecarFormModel({ ...entry, substrate: BAD_DECL }, { rulesSchema: SCHEMA });
        expect(bad.payloadRows).toBeNull();
        expect(bad.declarationError).toMatch(/surprise/);
        const gone = sidecarFormModel({ ...entry, substrate: 'd1_row_nobody_registers_this' }, { rulesSchema: SCHEMA });
        expect([gone.payloadRows, gone.registered]).toEqual([null, false]);
    });
});

describe('⛓⛓ the control is chosen by TYPE', () => {
    it('the table', () => {
        expect(controlForType('boolean', false)).toBe(C.CHECKBOX);
        for (const t of ['string', 'number', 'integer']) expect(controlForType(t, true), t).toBe(C.SELECT);
        expect(controlForType('string', false)).toBe(C.TEXT);
        expect(controlForType('number', false)).toBe(C.NUMBER);
        expect(controlForType('integer', false)).toBe(C.NUMBER);
        expect(controlForType('object', false)).toBe(C.SUMMARY);
        expect(controlForType('array', false)).toBe(C.SUMMARY);
        expect(controlForType('null', false)).toBe(C.NONE);
    });

    it('every row of every committed entry draws the control its type picks — a present '
        + 'container a summary, an absent one nothing', () => {
        const seen = new Set();
        for (const { entry } of ENTRIES) {
            const m = sidecarFormModel(entry, { rulesSchema: SCHEMA });
            for (const r of [...m.entryRows, ...m.payloadRows]) {
                const want = controlForType(r.type, !!r.enum);
                const expected = !r.present && (want === C.SUMMARY || want === C.NONE) ? C.NONE : want;
                expect(r.control, `${entry.substrate}.${r.field}`).toBe(expected);
                expect(r.typeMismatch, r.field).toBe(false);
                if (r.control === C.SUMMARY) expect(r.summary).toBe(summarizeContainer(r.value));
                seen.add(r.control);
            }
        }
        // ⛔ Non-vacuity: the committed entries exercise every control but NONE-by-type.
        for (const c of [C.CHECKBOX, C.SELECT, C.TEXT, C.NUMBER, C.SUMMARY, C.NONE]) expect(seen, c).toContain(c);
    });

    it('`substrate` is a select over the registry\'s playable ids, and required', () => {
        const row = sidecarFormModel(ENTRIES[0].entry, { rulesSchema: SCHEMA }).entryRows
            .find((r) => r.field === SUBSTRATE_KEY);
        expect(row.control).toBe(C.SELECT);
        expect(row.enum).toEqual(playableSubstrateIds());
        expect(row.required).toBe(true);
    });

    it('a value whose JSON type is not the declared one is shown, not controlled', () => {
        const { entry } = ENTRIES.find((e) => {
            const f = sidecarFieldsOf(substrateRegistry.get(e.entry.substrate));
            return Object.keys(f).some((k) => f[k].type === 'boolean' && k in e.entry.playable_payload);
        });
        const fields = sidecarFieldsOf(substrateRegistry.get(entry.substrate));
        const field = Object.keys(fields).find((k) => fields[k].type === 'boolean' && k in entry.playable_payload);
        const broken = withSidecarField(entry, L.PAYLOAD, field, 'yes');
        const row = sidecarFormModel(broken, { rulesSchema: SCHEMA }).payloadRows.find((r) => r.field === field);
        expect([row.control, row.typeMismatch]).toEqual([C.NONE, true]);
    });

    it('the container summary', () => {
        expect(summarizeContainer([])).toBe('[0 items]');
        expect(summarizeContainer([1])).toBe('[1 item]');
        expect(summarizeContainer({ a: 1, b: 2 })).toBe('{2 keys}');
        expect(jsonTypeOf(3)).toBe('integer');
        expect(jsonTypeOf(3.5)).toBe('number');
    });
});

describe('⛓⛓⛓ one change = the WHOLE entry with exactly one value replaced', () => {
    it.each(ENTRIES.map((e) => [`${e.slot}/${e.region}`, e.entry]))(
        '%s: every payload scalar, and every entry-level string, differs in exactly its own path', (_, entry) => {
            const m = sidecarFormModel(entry, { rulesSchema: SCHEMA });
            const before = JSON.stringify(entry);
            for (const r of [...m.entryRows, ...m.payloadRows]) {
                if (![C.CHECKBOX, C.TEXT, C.NUMBER, C.SELECT].includes(r.control)) continue;
                const value = r.control === C.CHECKBOX ? !(r.value === true)
                    : r.control === C.SELECT ? r.enum.find((v) => v !== r.value) ?? r.enum[0]
                        : r.control === C.TEXT ? `${r.value ?? ''}-edited` : (r.value ?? 0) + 1;
                const next = withSidecarField(entry, r.level, r.field, value);
                const path = r.level === L.PAYLOAD ? `$.${PAYLOAD_KEY}.${r.field}` : `$.${r.field}`;
                const diff = diffPaths(entry, next);
                if (value === r.value) expect(diff).toEqual([]);
                else expect(diff, r.field).toEqual([path]);
                expect(JSON.stringify(entry), 'the input is not mutated').toBe(before);
            }
        });

    it('a payload field on an entry with no payload creates the payload', () => {
        const next = withSidecarField({ substrate: 'x' }, L.PAYLOAD, 'k', true);
        expect(next).toEqual({ substrate: 'x', [PAYLOAD_KEY]: { k: true } });
    });

    it('it is a deep copy: nothing of the result aliases the input', () => {
        const { entry } = ENTRIES[0];
        const next = withSidecarField(entry, L.ENTRY, SUBSTRATE_KEY, entry.substrate);
        expect(next).toEqual(entry);
        expect(next).not.toBe(entry);
        expect(next[PAYLOAD_KEY]).not.toBe(entry[PAYLOAD_KEY]);
    });
});

describe('⛓ a control\'s reading as the value it writes', () => {
    const row = (control, extra = {}) => ({ field: 'f', control, ...extra });
    it('checkbox, select, text, number', () => {
        expect(parseControlValue(row(C.CHECKBOX), true)).toEqual({ ok: true, value: true });
        expect(parseControlValue(row(C.CHECKBOX), false)).toEqual({ ok: true, value: false });
        expect(parseControlValue(row(C.SELECT, { enum: ['a', 'b'] }), '1')).toEqual({ ok: true, value: 'b' });
        expect(parseControlValue(row(C.TEXT), 'x')).toEqual({ ok: true, value: 'x' });
        expect(parseControlValue(row(C.NUMBER), ' 12 ')).toEqual({ ok: true, value: 12 });
        expect(parseControlValue(row(C.NUMBER), '1.5')).toEqual({ ok: true, value: 1.5 });
    });
    it('refused by name: an option that is not one, a number that is not one, no control', () => {
        expect(parseControlValue(row(C.SELECT, { enum: ['a'] }), '')).toMatchObject({ ok: false });
        expect(parseControlValue(row(C.SELECT, { enum: ['a'] }), '3')).toMatchObject({ ok: false });
        expect(parseControlValue(row(C.NUMBER), 'abc').why).toContain('not a number');
        expect(parseControlValue(row(C.NUMBER), '').ok).toBe(false);
        expect(parseControlValue(row(C.SUMMARY), '{}').ok).toBe(false);
    });
});

describe('⛓⛓ the "re-derives nothing" sentence names THIS entry\'s derived fields', () => {
    it.each(ENTRIES.map((e) => [`${e.slot}/${e.region} (${e.entry.substrate})`, e.entry]))(
        '%s: the names are the declaration\'s derived descriptors the entry carries, in order', (_, entry) => {
            const fields = sidecarFieldsOf(substrateRegistry.get(entry.substrate));
            const want = Object.keys(fields).filter((k) => fields[k].derived && k in entry.playable_payload);
            const { names, declared } = derivedFieldsCarried(entry);
            expect(declared).toBe(true);
            expect(names).toEqual(want);
            const sentence = rederivesNothingSentence(entry);
            for (const n of names) expect(sentence).toContain(`\`${n}\``);
            // ⛔ …and a derived field the entry does NOT carry is not named.
            for (const k of Object.keys(fields).filter((f) => fields[f].derived && !(f in entry.playable_payload))) {
                expect(sentence).not.toContain(`\`${k}\``);
            }
        });

    it('non-vacuity: the committed entries name a derived field, and some declared-derived '
        + 'field is absent from some entry', () => {
        expect(ENTRIES.some(({ entry }) => derivedFieldsCarried(entry).names.length > 0)).toBe(true);
        expect(ENTRIES.some(({ entry }) => {
            const f = sidecarFieldsOf(substrateRegistry.get(entry.substrate));
            return Object.keys(f).some((k) => f[k].derived && !(k in entry.playable_payload));
        })).toBe(true);
    });

    it('where none is carried, where nothing is declared, where the declaration is malformed — said so', () => {
        const { entry } = ENTRIES[0];
        const fields = sidecarFieldsOf(substrateRegistry.get(entry.substrate));
        const stripped = structuredClone(entry);
        for (const k of Object.keys(fields)) if (fields[k].derived) delete stripped.playable_payload[k];
        expect(rederivesNothingSentence(stripped)).toMatch(/marks no field this entry carries as derived/);
        expect(rederivesNothingSentence({ ...entry, substrate: NO_DECL })).toMatch(/declares no sidecarFields/);
        expect(rederivesNothingSentence({ ...entry, substrate: BAD_DECL })).toMatch(/malformed/);
    });
});

describe('⛔ the module names no substrate', () => {
    it('no registered id appears in its source as a string literal', () => {
        const src = readFileSync(join(HERE, 'sidecarForm.js'), 'utf8');
        for (const { id } of substrateRegistry.getAll()) {
            expect(src.includes(`'${id}'`) || src.includes(`"${id}"`), id).toBe(false);
        }
    });
});
