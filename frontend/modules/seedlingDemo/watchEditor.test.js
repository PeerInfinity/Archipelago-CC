/**
 * seedlingDemo/watchEditor.test — **THE PAGE'S EDITING FORM, AS DATA.**
 *
 * EDITOR v3 slice C1. What is at stake here is not "does a form render" — it is:
 *
 *  1. **THE DEFAULT PLACE TYPE IS A FACT WITH A CHECKED PROVENANCE.** §11.5
 *     item 4: the page used to take `ENTITY_ROSTER[0]`, so *what the page opens
 *     on* and *the order of the offered list* were one fact. They are two now,
 *     and the tie between them is asserted rather than remembered.
 *  2. **THE WIDE ROSTER REACHES THE FORM AND THE NARROW ONE IS THE NAMED
 *     FALLBACK**, so a schema that did not arrive degrades to slice 11's page
 *     instead of taking the arm down.
 *  3. **EMPTY MEANS OMITTED.** `fillDefaults` is OFF (§11.5 item 2, measured
 *     over 2,461 atlas instances), and the FORM is where a reader meets that
 *     rule — a form that wrote every declared default would put attributes on
 *     every hand placement that the corpus itself does not carry.
 *  4. **⚖ RULING 3's BOUND IS A SENTENCE, NOT A REFUSAL** — and the types it
 *     names are the ones `levelWorld` really does not transcribe, asked of that
 *     table rather than of a list this file keeps.
 *
 * ⛔ `mountEntityPalette` needs a DOM and this repo's vitest is
 * `environment: 'node'`, so the rows below drive the PURE half
 * (`attrFormRows`, `attrsFromRows`, `rosterFor`, `foldersOf`, the bound) and
 * the mount itself is the browser gate's — `check-seedling-editor-edit.mjs`
 * and `check-seedling-editor-arm.mjs` both drive it with a real mouse.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    ALL_FOLDERS, DEFAULT_PLACE_ATTRS, DEFAULT_PLACE_TYPE, attrFormRows, attrsFromRows,
    foldersOf, renderTranscribeBound, rosterFor,
} from './watchEditor.js';
import {
    ENTITY_ROSTER_PROCGEN, entityRosterFrom, transcribeBoundText, untranscribedTypes,
} from './watchEdit.js';
import { ENTITY_CLASSES } from './levelWorld.js';

const SCHEMA = JSON.parse(readFileSync(
    fileURLToPath(new URL('./fixtures/seedling-ogmo-schema.json', import.meta.url)), 'utf8',
));

describe('the page\'s DEFAULT PLACE TYPE — a name, with its provenance checked', () => {
    it('⛓⛓⛓ is the FIRST BODY `procgenPalette` PLACES, and that tie is asserted at '
        + 'import time rather than remembered in a comment', () => {
        expect(DEFAULT_PLACE_TYPE).toBe(ENTITY_ROSTER_PROCGEN[0].type);
        expect(DEFAULT_PLACE_ATTRS).toBe(ENTITY_ROSTER_PROCGEN[0].attrs);
    });

    it('⛔⛔ …and it is NOT the head of the WIDE roster — which is the whole reason it '
        + 'stopped being `[0]`: the two lists disagree, so `[0]` would have moved the '
        + 'page\'s default the moment the datalist widened', () => {
        const wide = entityRosterFrom(SCHEMA);
        expect(wide[0].type).not.toBe(DEFAULT_PLACE_TYPE);
        // …and the default is still IN the wide list, so widening did not orphan it.
        expect(wide.map((r) => r.type)).toContain(DEFAULT_PLACE_TYPE);
    });

    it('⛓ the default is a type the MODEL transcribes, so the page opens on a body it can '
        + 'certify in JS', () => {
        expect(ENTITY_CLASSES[DEFAULT_PLACE_TYPE]).toBeTruthy();
    });
});

describe('the offered roster — wide when the schema arrived, the named five when it did not', () => {
    it(`⛓ with a schema it is the whole declared vocabulary (${
        Object.keys(SCHEMA.entities).length} types)`, () => {
        expect(rosterFor(SCHEMA).map((r) => r.type))
            .toEqual(entityRosterFrom(SCHEMA).map((r) => r.type));
    });

    it('⛓ with `null` it is the SAME frozen array slice 11 shipped — a fallback that is the '
        + 'previous page exactly, not a subset invented here', () => {
        expect(rosterFor(null)).toBe(ENTITY_ROSTER_PROCGEN);
    });

    it('⛓ the folders are DERIVED in first-appearance order, and every declared entity is in '
        + 'one of them', () => {
        const wide = rosterFor(SCHEMA);
        const folders = foldersOf(wide);
        expect(folders.length).toBeGreaterThan(1);
        expect(new Set(wide.map((r) => r.folder))).toEqual(new Set(folders));
        expect(folders).not.toContain(ALL_FOLDERS);
    });

    it('⛔ the NARROW roster has no folders at all, so the filter box has nothing to offer '
        + 'and hides itself rather than showing one empty choice', () => {
        expect(foldersOf(ENTITY_ROSTER_PROCGEN)).toEqual([]);
    });
});

describe('the typed attribute form — generated from the declaration, never from the name', () => {
    it('⛓ one row per declared value, carrying that declaration\'s own type and range', () => {
        const rows = attrFormRows(SCHEMA, 'crusher');
        expect(rows.map((r) => r.name)).toEqual(SCHEMA.entities.crusher.values.map((v) => v.name));
        const tset = rows.find((r) => r.name === 'tset');
        expect(tset.control).toBe('number');
        expect(tset.step).toBe('1');
        expect(tset.min).toBe(SCHEMA.entities.crusher.values[0].min);
        expect(tset.max).toBe(SCHEMA.entities.crusher.values[0].max);
    });

    it('⛓ the control kind is DERIVED from the Ogmo value type — every declared value in the '
        + 'fixture maps onto a control, so no type can arrive without one', () => {
        const kinds = new Map();
        for (const type of Object.keys(SCHEMA.entities)) {
            for (const row of attrFormRows(SCHEMA, type)) {
                kinds.set(row.type, row.control);
            }
        }
        for (const t of SCHEMA.value_types) {
            if (!kinds.has(t)) continue;
            expect(['checkbox', 'number', 'text']).toContain(kinds.get(t));
        }
        expect(kinds.get('integer')).toBe('number');
        expect(kinds.get('string')).toBe('text');
    });

    it('⛔ an UNDECLARED type gets NO rows and that is an ANSWER — law (b) keeps the type '
        + 'field free, so a form that refused would refuse the page\'s own law', () => {
        expect(attrFormRows(SCHEMA, 'notathing')).toEqual([]);
        expect(attrFormRows(null, 'pushableblock')).toEqual([]);
    });

    it('⚠ a value with NO declared default carries `null`, not a zero — three of the 166 '
        + 'declared values have none and inventing one would write an attribute the author '
        + 'never gave a value for', () => {
        const noDefault = Object.entries(SCHEMA.entities)
            .flatMap(([type, d]) => d.values
                .filter((v) => v.default === null || v.default === undefined)
                .map((v) => [type, v.name]));
        expect(noDefault.length).toBeGreaterThan(0);
        for (const [type, name] of noDefault) {
            expect(attrFormRows(SCHEMA, type).find((r) => r.name === name).default).toBe(null);
        }
    });
});

describe('the form → attrs: ⛔ EMPTY MEANS OMITTED (`fillDefaults` is OFF)', () => {
    const rows = attrFormRows(SCHEMA, 'fallrock');

    it('⛔ a blank input contributes NOTHING — not the declared default, and not an empty '
        + 'string: §11.5 item 2 measured 183 of 2,461 atlas instances legitimately carrying '
        + 'no value for an attribute that HAS a default', () => {
        expect(attrsFromRows(rows, () => '')).toEqual({});
        expect(attrsFromRows(rows, (r) => (r.name === 'tag' ? '7' : ''))).toEqual({ tag: '7' });
    });

    it('⛓ …and what IS typed arrives as TEXT, which is what an OEL attribute is', () => {
        expect(attrsFromRows(rows, () => 3)).toEqual({ tset: '3', tag: '3' });
    });

    it('⚠ a CHECKBOX always contributes, because an `<input type=checkbox>` has no third '
        + 'state to spell "omitted" with — named rather than faked with a tri-state select', () => {
        const bool = [{ name: 'flip', type: 'boolean', control: 'checkbox' }];
        expect(attrsFromRows(bool, () => false)).toEqual({ flip: 'false' });
        expect(attrsFromRows(bool, () => true)).toEqual({ flip: 'true' });
    });
});

describe('⚖ RULING 3 — the two-oracle bound is a SENTENCE and not a refusal', () => {
    const recordOf = (types) => ({ entities: types.map((type) => ({ type, x: 0, y: 0 })) });

    it('⛓ it names the types `levelWorld` does not transcribe, asked of THAT table', () => {
        const declared = Object.keys(SCHEMA.entities);
        const missing = declared.filter((t) => !ENTITY_CLASSES[t]);
        expect(missing.length).toBeGreaterThan(0);
        expect(untranscribedTypes(recordOf(declared), ENTITY_CLASSES)).toEqual(missing);
    });

    it('⛔⛔ `bob` IS TRANSCRIBED — the brief called it a non-procgen type that would show '
        + 'the bound and it does not; a NON-PROCGEN type and an UNTRANSCRIBED one are two '
        + 'different sets and only 7 of the 144 are in the second', () => {
        expect(ENTITY_ROSTER_PROCGEN.map((r) => r.type)).not.toContain('bob');
        expect(untranscribedTypes(recordOf(['bob']), ENTITY_CLASSES)).toEqual([]);
        expect(untranscribedTypes(recordOf(['building3']), ENTITY_CLASSES)).toEqual(['building3']);
    });

    it('⚠ DISTINCT types in first-appearance order, not instances — six bodies of one '
        + 'untranscribed type is ONE problem and the sentence says so', () => {
        expect(untranscribedTypes(recordOf(['building3', 'bob', 'building3', 'fire']),
            ENTITY_CLASSES)).toEqual(['building3', 'fire']);
        expect(transcribeBoundText(['building3', 'fire'])).toContain('2 type(s)');
    });

    it('⛓ NOTHING to say is `null`, so a caller cannot print an empty warning', () => {
        expect(transcribeBoundText([])).toBe(null);
        expect(untranscribedTypes({ entities: [] }, ENTITY_CLASSES)).toEqual([]);
    });

    it('⛔ the class table is a PARAMETER and a missing one refuses BY NAME — this file '
        + 'holds no second opinion about which model is being asked', () => {
        expect(() => untranscribedTypes(recordOf(['bob']), null)).toThrow(/class table/);
    });

    it('⛓ the readout is ONE writer over a box, and it HIDES itself when there is nothing '
        + 'to say', () => {
        const box = { textContent: 'stale', className: '', hidden: false };
        expect(renderTranscribeBound(box, recordOf(['bob']), ENTITY_CLASSES)).toEqual([]);
        expect(box.textContent).toBe('');
        expect(box.hidden).toBe(true);
        expect(renderTranscribeBound(box, recordOf(['fire']), ENTITY_CLASSES)).toEqual(['fire']);
        expect(box.hidden).toBe(false);
        expect(box.textContent).toContain('fire');
        expect(box.className).toContain('bad');
    });
});
