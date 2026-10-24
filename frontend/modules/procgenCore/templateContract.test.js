/**
 * procgenCore/templateContract — **THE THREE DOMAIN FORMS AND THE ONE DRAW LAW**
 * (behaviour parameters P2, D1).
 *
 * ⛓ A parameter declares exactly one of `domain: [...]`, `range: {min, max,
 * step?}`, `open`. `assertParamSchema` accepts all three; a parameter the
 * generator DRAWS must be a list or a stepped range (`assertDrawable`), and
 * `defineTemplate` asks that of every parameter at definition time.
 */
import { describe, expect, it } from 'vitest';

import { createRng } from '../shared/rng.js';
import { ProcgenRng } from './procgenRng.js';
import {
    TemplateContractError, assertDrawable, assertParamSchema, defineTemplate, describeDomain, domainKind,
    enumerableValues, enumerateValues, isParamSubset, paramSubset, valueInDomain,
} from './templateContract.js';

const WHY = 'a scratch parameter';
const scratch = (params) => defineTemplate({
    name: 'scratch', family: 'test', params, why: 'scratch', build: () => ({}),
});

/** The injected source — mulberry32 from `shared/rng.js`, as the element tests inject one. */
const SOURCE = Object.freeze({
    name: 'mulberry32 (templateContract.test)',
    assertSeed: (seed) => seed,
    create: (seed) => {
        const r = createRng(seed);
        return { next: () => r.next(), nextIndex: (n) => Math.floor(r.next() * n), get state() { return r.getState(); } };
    },
});
const rngFor = (seed) => new ProcgenRng(seed, { source: SOURCE });

/** A ProcgenRng that counts its `pick`s — the draw is the thing byte identity rests on. */
function countingRng(seed) {
    const rng = rngFor(seed);
    const pick = rng.pick.bind(rng);
    let picks = 0;
    rng.pick = (items) => { picks += 1; return pick(items); };
    return { rng, picks: () => picks };
}

const throwsNaming = (fn, re) => {
    expect(fn).toThrow(TemplateContractError);
    expect(fn).toThrow(re);
};

describe('the three forms — domainKind / enumerableValues / valueInDomain / describeDomain', () => {
    const list = { key: 'len', domain: [2, 3, 4], default: 2, why: WHY };
    const stepped = { key: 'len', range: { min: 2, max: 6, step: 1 }, default: 2, why: WHY };
    const unstepped = { key: 'speed', range: { min: 0, max: 1 }, default: 0.5, why: WHY };
    const openString = { key: 'label', open: 'string', default: 'x', why: WHY };
    const openId = { key: 'entity', open: { id: 'entities' }, default: 'bat', why: WHY };

    it('domainKind names the form', () => {
        expect([list, stepped, unstepped, openString, openId].map(domainKind))
            .toEqual(['list', 'range', 'range', 'open', 'open']);
    });

    it('enumerableValues: a list is ITSELF (same array), a stepped range expands, the rest are null', () => {
        expect(enumerableValues(list)).toBe(list.domain);
        expect(enumerableValues(stepped)).toEqual([2, 3, 4, 5, 6]);
        expect(enumerableValues(stepped)).toBe(enumerableValues(stepped));
        expect(enumerableValues(unstepped)).toBeNull();
        expect(enumerableValues(openString)).toBeNull();
        expect(enumerableValues(openId)).toBeNull();
    });

    it('a fractional step expands to clean decimals, ending on max', () => {
        const p = { key: 'f', range: { min: 0, max: 1, step: 0.1 }, default: 0.3, why: WHY };
        expect(enumerableValues(p)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
        expect(() => assertParamSchema([p], 'x')).not.toThrow();
    });

    it('valueInDomain: membership, bounds, the step, and "a string" for open', () => {
        expect(valueInDomain(list, 3)).toBe(true);
        expect(valueInDomain(list, 5)).toBe(false);
        expect(valueInDomain(stepped, 6)).toBe(true);
        expect(valueInDomain(stepped, 2.5)).toBe(false);
        expect(valueInDomain(stepped, 7)).toBe(false);
        expect(valueInDomain(unstepped, 0.37)).toBe(true);
        expect(valueInDomain(unstepped, 1.01)).toBe(false);
        expect(valueInDomain(unstepped, '0.5')).toBe(false);
        expect(valueInDomain(openString, 'anything')).toBe(true);
        expect(valueInDomain(openId, 3)).toBe(false);
    });

    it('describeDomain: a LIST is exactly the `[a, b]` every refusal spelled before P2', () => {
        expect(describeDomain(list)).toBe('[2, 3, 4]');
        expect(describeDomain(stepped)).toBe('the range 2..6 step 1');
        expect(describeDomain(unstepped)).toBe('the range 0..1 (unstepped)');
        expect(describeDomain(openString)).toBe('any string (open)');
        expect(describeDomain(openId)).toBe('any id the "entities" registry declares (open)');
    });

    it('assertParamSchema accepts all three forms; assertDrawable refuses open and unstepped BY NAME', () => {
        expect([...assertParamSchema([list], 'x')]).toEqual(['len']);
        expect([...assertParamSchema([unstepped, openString, openId], 'x')]).toEqual(['speed', 'label', 'entity']);
        expect(() => assertDrawable(list, 'x')).not.toThrow();
        expect(() => assertDrawable(stepped, 'x')).not.toThrow();
        throwsNaming(() => assertDrawable(unstepped, 'block "chase"'),
            /block "chase" parameter "speed" declares the range 0..1 \(unstepped\).*LIST or a STEPPED RANGE/);
        throwsNaming(() => assertDrawable(openString, 'x'), /parameter "label" declares any string \(open\)/);
    });
});

describe('assertParamSchema refuses a malformed form BY NAME', () => {
    const bad = [
        ['no form at all', { key: 'k', default: 1, why: WHY }, /parameter "k" has no finite\s+domain/],
        ['an empty list', { key: 'k', domain: [], default: 1, why: WHY }, /no finite\s+domain/],
        ['two forms', { key: 'k', domain: [1], range: { min: 0, max: 2 }, default: 1, why: WHY }, /declares \[domain, range\] — exactly ONE/],
        ['min not below max', { key: 'k', range: { min: 3, max: 3 }, default: 3, why: WHY }, /min < max/],
        ['a non-number bound', { key: 'k', range: { min: '0', max: 3 }, default: 1, why: WHY }, /finite numbers/],
        ['a zero step', { key: 'k', range: { min: 0, max: 3, step: 0 }, default: 0, why: WHY }, /step 0; a step is a finite number > 0/],
        ['a bad open', { key: 'k', open: 'number', default: 'x', why: WHY }, /declares open "number"/],
        ['an open id with no name', { key: 'k', open: { id: '' }, default: 'x', why: WHY }, /declares open/],
        ['a range default out of bounds', { key: 'k', range: { min: 0, max: 1 }, default: 2, why: WHY }, /defaults to 2, which is not in its own domain the range 0..1 \(unstepped\)/],
        ['an open default that is not a string', { key: 'k', open: 'string', default: 3, why: WHY }, /defaults to 3.*any string/],
        ['a range with no why', { key: 'k', range: { min: 0, max: 1 }, default: 0, why: '' }, /no `why`/],
    ];
    it.each(bad)('refuses %s', (_label, p, re) => {
        throwsNaming(() => assertParamSchema([p], 'thing "t"'), re);
    });
});

describe('⛓⛓ the mutants — measured', () => {
    it('(a) a template declaring `range` without `step` ⇒ defineTemplate refuses, by name', () => {
        throwsNaming(() => scratch([{ key: 'len', range: { min: 2, max: 6 }, default: 2, why: WHY }]),
            /template "scratch" parameter "len" declares the range 2..6 \(unstepped\), and a parameter the generator DRAWS must be a LIST or a STEPPED RANGE/);
    });

    it('(a′) a template declaring an `open` parameter ⇒ refused, by name', () => {
        throwsNaming(() => scratch([{ key: 'label', open: 'string', default: 'x', why: WHY }]),
            /template "scratch" parameter "label" declares any string \(open\)/);
    });

    it('(b) a `range` whose `step` does not divide it ⇒ refused, by name', () => {
        throwsNaming(() => scratch([{ key: 'len', range: { min: 2, max: 6, step: 1.5 }, default: 2, why: WHY }]),
            /template "scratch" parameter "len" declares the range 2..6 with step 1.5, which does not divide it/);
    });

    it('(c) a `default` off the step ⇒ refused', () => {
        throwsNaming(() => scratch([{ key: 'len', range: { min: 2, max: 6, step: 1 }, default: 2.5, why: WHY }]),
            /template "scratch" parameter "len" defaults to 2.5, which is not in its own domain the range 2..6 step 1/);
    });

    it('(d) a stepped range {2..6 step 1} enumerates to exactly [2,3,4,5,6] and spends exactly ONE pick — the list\'s draw', () => {
        const ranged = scratch([{ key: 'len', range: { min: 2, max: 6, step: 1 }, default: 2, why: WHY }]);
        const listed = scratch([{ key: 'len', domain: [2, 3, 4, 5, 6], default: 2, why: WHY }]);
        expect(enumerateValues(ranged)).toEqual([2, 3, 4, 5, 6].map((len) => ({ len })));
        for (const seed of [1, 2, 3, 17, 99, 12345]) {
            const a = countingRng(seed);
            const b = countingRng(seed);
            const ra = ranged.instantiate(a.rng);
            const rb = listed.instantiate(b.rng);
            expect(a.picks()).toBe(1);
            expect(b.picks()).toBe(1);
            expect(ra.params).toEqual(rb.params);
            expect(a.rng.nextInt(1000)).toBe(b.rng.nextInt(1000));
        }
    });

    it('a stepped range takes overrides and subsets exactly as a list does', () => {
        const ranged = scratch([{ key: 'len', range: { min: 2, max: 6, step: 1 }, default: 2, why: WHY }]);
        expect(ranged.instantiate(null, { len: 4 }).instance).toBe('scratch(len=4)');
        throwsNaming(() => ranged.instantiate(null, { len: 7 }), /declared domain the range 2..6 step 1/);
        const c = countingRng(5);
        const v = ranged.instantiate(c.rng, { len: paramSubset([3, 5]) }).params.len;
        expect([3, 5]).toContain(v);
        expect(c.picks()).toBe(1);
        expect(isParamSubset(paramSubset([3]))).toBe(true);
        throwsNaming(() => ranged.instantiate(null, { len: paramSubset([2, 9]) }), /subset member 9/);
    });
});

describe('every existing list draw is untouched', () => {
    it('a list template draws from its own frozen copy, one pick per parameter, in schema order', () => {
        const t = scratch([
            { key: 'ori', domain: ['h', 'v'], default: 'h', why: WHY },
            { key: 'len', domain: [2, 3, 4], default: 2, why: WHY },
        ]);
        expect(enumerableValues(t.params[1])).toBe(t.params[1].domain);
        expect(Object.isFrozen(t.params[1].domain)).toBe(true);
        const c = countingRng(7);
        const ref = rngFor(7);
        const got = t.instantiate(c.rng).params;
        expect(c.picks()).toBe(2);
        expect(got).toEqual({ ori: ref.pick(['h', 'v']), len: ref.pick([2, 3, 4]) });
    });
});

/* ─────────── the readers P2 may not edit — a TRIPWIRE, not a promise ─────────── */

/**
 * ⛓⛓ Five readers outside procgenCore still read `p.domain` as an ARRAY and are
 * not P2's to edit: `seedlingDemo/watchViewer.js` (the catalogue form, the
 * skeleton, area and element-head forms), `scripts/procgen/reference/
 * catalogue.mjs`, `check-procgen-lab-hosting.mjs` and
 * `check-seedling-editor-generate.mjs`. Their inputs are exactly the schemas
 * below; every one of those now refuses an open or unstepped parameter at load
 * (`assertDrawable`). A STEPPED RANGE is drawable and would reach them with no
 * `domain` array — so this row pins that every shipped schema is still a LIST,
 * and the day one declares a stepped range it reds here, naming the readers to
 * make form-aware first (`enumerableValues`).
 */
describe('⛓ every shipped drawn schema is a LIST today (the tripwire for the readers P2 did not touch)', async () => {
    const { PRE_SWORD_PALETTE, POST_SWORD_PALETTE, POST_SHIELD_PALETTE, POST_SWIM_PALETTE, POST_FEATHER_PALETTE } = await import('../seedlingDemo/procgenPalette.js');
    const { MAZE_PALETTE } = await import('../mazeRoom/procgenMaze.js');
    const { ELEMENT_TABLE, paramSchemaFor: headSchema } = await import('./elementSpec.js');
    const { BIOMES, paramSchemaFor: kindSchema } = await import('./skeletonKinds.js');
    const { AREA_PARAM_SCHEMA } = await import('./areaSpec.js');
    const { CONCEPTS } = await import('./concepts.js');
    const subjects = [
        ...[PRE_SWORD_PALETTE, POST_SWORD_PALETTE, POST_SHIELD_PALETTE, POST_SWIM_PALETTE, POST_FEATHER_PALETTE, MAZE_PALETTE]
            .flatMap((pal) => pal.templates.map((t) => [`palette ${pal.name} template ${t.name}`, t.params])),
        ...Object.keys(ELEMENT_TABLE).map((h) => [`element spec head ${h}`, headSchema(h)]),
        ...Object.keys(BIOMES).map((k) => [`skeleton kind ${k}`, kindSchema(k)]),
        ['the area spec', AREA_PARAM_SCHEMA],
        ...Object.entries(CONCEPTS).map(([id, c]) => [`concept ${id} params`, c.params ?? []]),
    ];
    it.each(subjects)('%s', (_who, params) => {
        const notList = params.filter((p) => domainKind(p) !== 'list').map((p) => p.key);
        expect(notList, 'a stepped range reaches watchViewer.js:5500/5527/5556/6011/6034/6103/6119/6167/6183, '
            + 'reference/catalogue.mjs:16, check-procgen-lab-hosting.mjs:215 and check-seedling-editor-generate.mjs:1757, '
            + 'which read `p.domain` as an array — make them form-aware first').toEqual([]);
    });
});
