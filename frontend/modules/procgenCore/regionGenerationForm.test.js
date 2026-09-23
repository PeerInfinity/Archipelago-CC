/**
 * ⛓⛓ APWORLD SUBSTRATE CHANGE R1 — the shared per-region generation form.
 *
 * ⛔ No row types a shipped substrate id. The registry is loaded from
 * `REGISTRY_LIBRARIES` (the reference generator's list) and every population
 * below is DERIVED from what the entries declare (`regionGeometry`,
 * `renderProcgenParams`, `procgenParamsFromPayload`); the hook-drawn rule is
 * held by SYNTHETIC entries registered here (vitest isolates this file's
 * registry), so the rows say what the form does with a declaration, not what
 * one substrate happens to carry today.
 *
 * ⛔ There is no jsdom in this repo: `withFakeDocument` is a minimal document
 * (the same one `procgenPipelineUI.test.js` uses for the Parameters section).
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { REGISTRY_LIBRARIES } from '../../../scripts/procgen/reference/registry.mjs';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { geometryOf, REGION_GEOMETRY } from './regionGeometry.js';
import {
    REGION_GENERATION_FIELDS, PROCGEN_PARAMS_ATTR, fieldRow, numberField,
    regionGenerationFieldsFor, renderRegionGenerationForm,
} from './regionGenerationForm.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
for (const rel of REGISTRY_LIBRARIES) {
    // eslint-disable-next-line no-await-in-loop
    await import(join(ROOT, rel));
}

function makeElement(tag) {
    const el = {
        tagName: tag.toUpperCase(), children: [], parent: null, listeners: {}, dataset: {},
        className: '', title: '', type: '', value: '', checked: false, _text: '',
        appendChild(child) { child.parent = el; el.children.push(child); return child; },
        remove() { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1); el.parent = null; },
        addEventListener(type, h) { (el.listeners[type] ??= []).push(h); },
        fire(type) { for (const h of el.listeners[type] ?? []) h({ target: el }); },
    };
    Object.defineProperty(el, 'textContent', {
        get: () => el._text + el.children.map((c) => c.textContent).join(''),
        set: (v) => { el._text = String(v); el.children.length = 0; },
    });
    return el;
}
function withFakeDocument(fn) {
    const saved = globalThis.document;
    globalThis.document = { createElement: makeElement, createTextNode: (t) => ({ textContent: String(t) }) };
    try { return fn(); } finally { globalThis.document = saved; }
}
const descendants = (el) => (el.children ?? []).flatMap((c) => [c, ...descendants(c)]);
const controls = (el) => descendants(el).filter((c) => c.tagName === 'INPUT' || c.tagName === 'SELECT');
const headers = (el) => descendants(el).filter((c) => c.className === 'procgen-pipeline-scenario-subheader');
const labels = (el) => descendants(el).filter((c) => c.tagName === 'LABEL').map((c) => c.textContent);

/**
 * Which bag key each control writes: perturb it, fire `change`, read what the
 * recording bag saw. The binding is measured, not read off a label.
 */
function boundKeys(form, bag) {
    const out = [];
    for (const c of controls(form)) {
        const before = { ...bag };
        if (c.type === 'checkbox') c.checked = !c.checked;
        else if (c.tagName === 'SELECT') {
            c.value = c.children.map((o) => o.value).find((v) => v !== c.value) ?? c.value;
        } else c.value = '7';
        c.fire('change');
        out.push(Object.keys(bag).filter((k) => bag[k] !== before[k] || !(k in before)));
    }
    return out;
}

/* ── synthetic entries: the hook rule, with no shipped id typed ─────────── */
const SYN = {
    hooked: 'r1-synthetic-hooked',
    bare: 'r1-synthetic-bare',
    empty: 'r1-synthetic-empty-hook',
    sides: 'r1-synthetic-sides',
};
substrateRegistry.register({
    id: SYN.hooked,
    defaultProcgenParams: { synKnob: 4 },
    renderProcgenParams: ({ params, onChange }) => numberField(params,
        { key: 'synKnob', label: 'Syn knob', title: 'a synthetic knob', def: 4, max: 9 }, onChange),
});
substrateRegistry.register({ id: SYN.bare });
substrateRegistry.register({ id: SYN.empty, renderProcgenParams: () => null });
substrateRegistry.register({ id: SYN.sides, regionGeometry: REGION_GEOMETRY.SIDES });

const shipped = substrateRegistry.getAll().filter((e) => !Object.values(SYN).includes(e.id));
const byGeometry = (g) => shipped.filter((e) => geometryOf(e) === g);
const TILE_ONLY_KEYS = REGION_GENERATION_FIELDS.filter((f) => f.appliesTo === REGION_GEOMETRY.TILES).map((f) => f.key);
const EVERY_GEOMETRY_KEYS = REGION_GENERATION_FIELDS.filter((f) => f.appliesTo === undefined).map((f) => f.key);

describe('the generic per-region rows follow the entry\'s declared region geometry', () => {
    it('⛓ non-vacuity: the shipped registry holds both geometries, and the table holds both kinds of row', () => {
        expect(byGeometry(REGION_GEOMETRY.TILES).length).toBeGreaterThan(0);
        expect(byGeometry(REGION_GEOMETRY.SIDES).length).toBeGreaterThan(0);
        expect(TILE_ONLY_KEYS.length).toBeGreaterThan(0);
        expect(EVERY_GEOMETRY_KEYS.length).toBeGreaterThan(0);
    });

    it.each([REGION_GEOMETRY.TILES, REGION_GEOMETRY.SIDES])('⛓ every shipped %s entry draws the tile rows iff it stands on tiles', (geometry) => {
        for (const entry of byGeometry(geometry)) {
            const bag = {};
            const keys = withFakeDocument(() => boundKeys(renderRegionGenerationForm(
                { substrateId: entry.id, params: bag, registry: { get: () => ({ ...entry, renderProcgenParams: undefined }) } }),
            bag)).flat();
            const want = geometry === REGION_GEOMETRY.TILES ? [...TILE_ONLY_KEYS, ...EVERY_GEOMETRY_KEYS] : EVERY_GEOMETRY_KEYS;
            expect(keys.sort(), entry.id).toEqual([...want].sort());
            expect(regionGenerationFieldsFor(entry).map((f) => f.key).sort(), entry.id).toEqual([...want].sort());
        }
    });

    it('⛓ `generic: false` draws no generic row (a host that drew them already)', () => {
        const form = withFakeDocument(() => renderRegionGenerationForm(
            { substrateId: SYN.bare, params: {}, generic: false }));
        expect(controls(form)).toEqual([]);
    });
});

describe('the entry\'s own knobs are drawn iff it declares the hook', () => {
    it('⛓ a hooked entry: its node under "<id> parameters", data attribute `drawn`', () => {
        const form = withFakeDocument(() => renderRegionGenerationForm({ substrateId: SYN.hooked, params: {} }));
        expect(headers(form).map((h) => h.textContent)).toEqual([`${SYN.hooked} parameters`]);
        expect(labels(form)).toContain('Syn knob');
        expect(form.dataset[PROCGEN_PARAMS_ATTR]).toBe('drawn');
        expect(form.dataset.substrateId).toBe(SYN.hooked);
    });

    it.each([['no hook', SYN.bare], ['a hook that draws nothing', SYN.empty]])(
        '⛔ %s: no subheader, and the data attribute says `none`', (_, id) => {
            const form = withFakeDocument(() => renderRegionGenerationForm({ substrateId: id, params: {} }));
            expect(headers(form)).toEqual([]);
            expect(form.dataset[PROCGEN_PARAMS_ATTR]).toBe('none');
        });

    it('⛓ the hook receives the SAME bag object and the host\'s onChange', () => {
        const bag = {};
        let calls = 0;
        const form = withFakeDocument(() => renderRegionGenerationForm(
            { substrateId: SYN.hooked, params: bag, onChange: () => { calls += 1; }, generic: false }));
        const [knob] = controls(form);
        knob.value = '3';
        knob.fire('change');
        expect(bag).toEqual({ synKnob: 3 });
        expect(calls).toBe(1);
    });
});

describe('a change writes its bag key and calls onChange exactly once', () => {
    it.each(REGION_GENERATION_FIELDS.map((f) => [f.key]))('⛓ generic row %s', (key) => {
        // SYN.bare declares no geometry, so it stands on tiles and draws every row.
        const drawn = regionGenerationFieldsFor(substrateRegistry.get(SYN.bare)).map((f) => f.key);
        const bag = {};
        let calls = 0;
        const form = withFakeDocument(() => renderRegionGenerationForm(
            { substrateId: SYN.bare, params: bag, onChange: () => { calls += 1; } }));
        const c = controls(form)[drawn.indexOf(key)];
        c.value = '5';
        c.fire('change');
        expect(bag).toEqual({ [key]: 5 });
        expect(calls).toBe(1);
    });

    it('⛓ numberField clamps to max and falls back to def below min, rewriting the box', () => {
        const bag = {};
        let calls = 0;
        const row = withFakeDocument(() => numberField(bag,
            { key: 'k', label: 'K', title: 't', def: 4, max: 9 }, () => { calls += 1; }));
        const [input] = controls(row);
        input.value = '12'; input.fire('change');
        expect([bag.k, input.value]).toEqual([9, '9']);
        input.value = '-1'; input.fire('change');
        expect([bag.k, input.value]).toEqual([4, '4']);
        expect(calls).toBe(2);
    });

    it('⛓ numberField `integer`: floors, clamps up to min, leaves the box as typed', () => {
        const bag = {};
        const row = withFakeDocument(() => numberField(bag,
            { key: 'k', label: 'K', title: 't', def: 10, min: 1, integer: true }));
        const [input] = controls(row);
        input.value = '2.7'; input.fire('change');
        expect([bag.k, input.value]).toEqual([2, '2.7']);
        input.value = 'abc'; input.fire('change');
        expect(bag.k).toBe(1);
    });

    it('⛓ fieldRow wraps any control in one labelled `procgen-pipeline-field` row', () => {
        const row = withFakeDocument(() => fieldRow('Label', 'Title', makeElement('select')));
        expect(row.className).toBe('procgen-pipeline-field');
        expect(row.children.map((c) => c.tagName)).toEqual(['LABEL', 'SELECT']);
        expect([row.children[0].textContent, row.children[0].title]).toEqual(['Label', 'Title']);
    });
});

describe('the seed row is drawn iff the host asks for one', () => {
    it('⛓ `seed: {key}` draws a Seed row first, bound to that key', () => {
        const bag = {};
        const form = withFakeDocument(() => renderRegionGenerationForm(
            { substrateId: SYN.sides, params: bag, seed: { key: 'regionSeed' } }));
        expect(labels(form)[0]).toBe('Seed');
        expect(boundKeys(form, bag)[0]).toEqual(['regionSeed']);
    });

    it('⛔ without `seed` there is no Seed row (the pipeline\'s seed is a world row)', () => {
        const form = withFakeDocument(() => renderRegionGenerationForm({ substrateId: SYN.sides, params: {} }));
        expect(labels(form)).not.toContain('Seed');
    });
});
