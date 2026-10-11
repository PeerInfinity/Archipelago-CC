/**
 * The entity-record contract (`entityRecords.js`, behaviour-parameters P1):
 * the shape a record may hold, the doc/content split, the dump and its md5,
 * and the load-time overrides.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    ENTITIES_SOURCE, ENTITY_RECORDS_GLOBAL, ENTITY_RECORD_MODULES, EntityRecordError,
    entitiesDump, entitiesMd5, entitiesStamp, entitiesUnused, entityLeaves, entityRecordNames,
} from './entityRecords.js';
import { md5 } from './md5.js';
import { createTapeStepper, runTape, runTapeToStream } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { loadTape } from './fixtures/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Register every record the model declares, in this (the shared) module registry. */
await Promise.all(ENTITY_RECORD_MODULES.map((m) => import(`./${m}`)));

/** A FRESH `entityRecords.js` with `override` installed in the global (the load-time semantics). */
async function fresh(override, ...modules) {
    vi.resetModules();
    if (override !== undefined) globalThis[ENTITY_RECORDS_GLOBAL] = override;
    try {
        return await Promise.all(['./entityRecords.js', ...modules].map((m) => import(m)));
    } finally {
        delete globalThis[ENTITY_RECORDS_GLOBAL];
    }
}

/** The message of the EntityRecordError `fn` throws. */
const refusal = (fn) => {
    try { fn(); } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e.name).toBe('EntityRecordError');
        return e.message;
    }
    throw new Error('not refused');
};

const sample = () => ({
    a: 1, b: { c: true, d: 'Solid', src: 'Foo.as:1' }, e: [1, 'x', null], f: [], g: {},
});

describe('entityRecords — defineRecord returns the SAME object, deep-frozen', () => {
    it('Object.is(defineRecord(name, T), T), and every node of T is frozen', async () => {
        const [m] = await fresh();
        const T = sample();
        const inner = T.b;
        expect(Object.is(m.defineRecord('t', T, { doc: ['src'], src: 'test' }), T)).toBe(true);
        expect(Object.is(T.b, inner)).toBe(true);
        for (const node of [T, T.b, T.e, T.f, T.g]) expect(Object.isFrozen(node)).toBe(true);
        expect(m.entityRecordNames()).toEqual(['t']);
        expect(m.entityRecord('t').record).toBe(T);
        expect(m.ENTITIES_SOURCE).toBe('compiled-in default');
    });

    it('an already-frozen inner node stays the same object', async () => {
        const [m] = await fresh();
        const inner = Object.freeze({ x: 1 });
        const T = { inner };
        expect(m.defineRecord('t', T).inner).toBe(inner);
    });
});

describe('entityRecords — assertEntityRecord refuses by name and dotted path', () => {
    it('mutant (a): a doc key holding a number ⇒ refused naming the key', async () => {
        const [m] = await fresh();
        const msg = refusal(() => m.defineRecord('t', { ctor: { dx: 8, src: 8 } }, { doc: ['src'] }));
        expect(msg).toContain('t.ctor.src');
        expect(msg).toContain('"src" is a doc key and must hold a string');
    });

    it('mutant (b): two records registered under one name ⇒ refused', async () => {
        const [m] = await fresh();
        m.defineRecord('t', { a: 1 }, { src: 'one.js' });
        const msg = refusal(() => m.defineRecord('t', { a: 1 }, { src: 'two.js' }));
        expect(msg).toContain('record "t" is registered twice (first by one.js, again by two.js)');
    });

    it('mutant (c): a NaN leaf ⇒ refused with its dotted path', async () => {
        const [m] = await fresh();
        expect(refusal(() => m.defineRecord('t', { a: { b: [1, NaN] } }))).toContain('t.a.b[1]: NaN is not a finite number');
    });

    it('a function, undefined, ±Infinity, a Map, a cycle, an ambiguous key, a stale doc name, a bad record name', async () => {
        const [m] = await fresh();
        expect(refusal(() => m.assertEntityRecord('t', { f: () => 1 }))).toContain('t.f: a function is not a record value');
        expect(refusal(() => m.assertEntityRecord('t', { u: undefined }))).toContain('t.u: a undefined is not a record value');
        expect(refusal(() => m.assertEntityRecord('t', { i: Infinity }))).toContain('t.i: Infinity is not a finite number');
        expect(refusal(() => m.assertEntityRecord('t', { i: [-Infinity] }))).toContain('t.i[0]: -Infinity');
        expect(refusal(() => m.assertEntityRecord('t', { m: new Map() }))).toContain('t.m: [object Map]');
        const cyc = { a: {} };
        cyc.a.back = cyc;
        expect(refusal(() => m.assertEntityRecord('t', cyc))).toContain('t.a.back: a cycle');
        expect(refusal(() => m.assertEntityRecord('t', { 'a.b': 1 }))).toContain('would make a path ambiguous');
        expect(refusal(() => m.assertEntityRecord('t', { a: 1 }, { doc: ['why'] }))).toContain('doc names "why", which name no key');
        expect(refusal(() => m.assertEntityRecord('t.x', { a: 1 }))).toContain('must be an identifier');
        expect(refusal(() => m.assertEntityRecord('t', 3))).toContain('a record is a plain object or an array');
    });

    it('a shared (non-cyclic) node WITHIN one record is allowed', async () => {
        const [m] = await fresh();
        const s = { w: 1 };
        expect(() => m.defineRecord('t', { a: s, b: s })).not.toThrow();
    });

    it('mutant (d): a node ANOTHER record holds ⇒ refused naming both paths (⚖ Q13, F-b)', async () => {
        const [m] = await fresh();
        const shared = { dx: 8, dy: 2 };
        m.defineRecord('first', { row: { ctor: shared } }, { src: 'one.js' });
        const msg = refusal(() => m.defineRecord('second', { ctor: shared }, { src: 'two.js' }));
        expect(msg).toContain('record "second": second.ctor is the same object as first.row.ctor, registered by "first" (one.js)');
        // A value-identical literal of its own is what the refusal asks for.
        expect(() => m.defineRecord('third', { ctor: { dx: 8, dy: 2 } })).not.toThrow();
    });

    it('an override cannot reach a second record through the first one\'s path', async () => {
        const [m] = await fresh(JSON.stringify({ 'first.ctor.dy': 3 }));
        const first = m.defineRecord('first', { ctor: { dx: 8, dy: 2 } });
        const second = m.defineRecord('second', { ctor: { dx: 8, dy: 2 } });
        expect(first.ctor.dy).toBe(3);
        expect(second.ctor.dy).toBe(2);
    });
});

describe('entityRecords — the dump and its md5', () => {
    it('is JSON; its paths are a walk of the records minus the doc keys; empty containers are one leaf each', async () => {
        const [m] = await fresh();
        m.defineRecord('t', sample(), { doc: ['src'] });
        const dump = m.entitiesDump();
        expect(dump.endsWith('}\n')).toBe(true);
        const parsed = JSON.parse(dump);
        expect(parsed).toEqual({
            't.a': 1, 't.b.c': true, 't.b.d': 'Solid', 't.e[0]': 1, 't.e[1]': 'x', 't.e[2]': null, 't.f': [], 't.g': {},
        });
        for (const line of dump.split('\n').slice(1, -2)) expect(() => JSON.parse(`{${line.replace(/,$/, '')}}`)).not.toThrow();
        expect(m.entitiesMd5()).toBe(md5(dump));
        expect(m.entitiesStamp()).toEqual({ md5: md5(dump), records: 1 });
    });

    it('a doc value moves nothing; a content value moves the md5', async () => {
        const [a] = await fresh();
        a.defineRecord('t', sample(), { doc: ['src'] });
        const [b] = await fresh();
        b.defineRecord('t', { ...sample(), b: { c: true, d: 'Solid', src: 'reworded' } }, { doc: ['src'] });
        const [c] = await fresh();
        c.defineRecord('t', { ...sample(), b: { c: true, d: 'Tree', src: 'Foo.as:1' } }, { doc: ['src'] });
        expect(b.entitiesMd5()).toBe(a.entitiesMd5());
        expect(c.entitiesMd5()).not.toBe(a.entitiesMd5());
    });

    it('records print in NAME order, not registration (import) order', async () => {
        const [x] = await fresh();
        x.defineRecord('beta', { v: 2 });
        x.defineRecord('alpha', { v: 1 });
        const [y] = await fresh();
        y.defineRecord('alpha', { v: 1 });
        y.defineRecord('beta', { v: 2 });
        expect(x.entitiesDump()).toBe(y.entitiesDump());
        expect(Object.keys(JSON.parse(x.entitiesDump()))).toEqual(['alpha.v', 'beta.v']);
    });

    it('the model\'s records: the dump parses back to exactly entityLeaves(), none under a doc key', () => {
        const parsed = JSON.parse(entitiesDump());
        const leaves = entityLeaves();
        expect(Object.keys(parsed)).toEqual(leaves.map((l) => l.path));
        for (const l of leaves) expect(parsed[l.path]).toEqual(l.value);
        expect(ENTITIES_SOURCE).toBe('compiled-in default');
    });

    it('the model\'s records: the md5 is pinned', () => {
        // a change here is an entity-record change
        // ⛓ swim U14: e338c30f → 143e37e6, the `moonrock` record (13 leaves).
        // ⛓ swim U15: 143e37e6 → f1a4c74f, the `turret` and `turretSpit` records.
        // ⛓ swim R2 D1: 143e37e6 → abbcd286, the `wallFlyer` record.
        // ⛓ swim U15 + R2 (merged): all three records.
        // ⛓ fidelity BOBSOLDIER: d10864a0 → 0655b315, the `chasers.bobsoldier` row (and the four rows' shape).
        // ⛓ wave-8 harvest: KILLLOCK's `chasers.lavarunner` row + BOBSOLDIER's → 33ae40cd (the union).
        // ⛓ fidelity BULB: 33ae40cd → 322c896f, the `chasers.bulb` row (`dropDeath`, `liveSwitch`).
        expect(entitiesMd5()).toBe('322c896f1018c5eada17ec6d79279adc');
        expect(entitiesStamp()).toEqual({ md5: entitiesMd5(), records: entityRecordNames().length });
    });
});

describe('entityRecords — ENTITY_RECORD_MODULES names exactly the files that declare a record', () => {
    it('every non-test module under seedlingDemo/ that calls defineRecord( is listed, and nothing else', () => {
        const callers = readdirSync(HERE)
            .filter((f) => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'entityRecords.js')
            .filter((f) => /\bdefineRecord\(/.test(readFileSync(join(HERE, f), 'latin1')))
            .sort();
        expect(callers).toEqual([...ENTITY_RECORD_MODULES]);
    });
});

describe('entityRecords — overrides (the load-time semantics)', () => {
    afterEach(() => { delete globalThis[ENTITY_RECORDS_GLOBAL]; });

    it('with no override the source is the compiled-in default and nothing is unused', () => {
        expect(ENTITIES_SOURCE).toBe('compiled-in default');
        expect(entitiesUnused()).toEqual([]);
    });

    it('a path is applied in place, before the freeze, and announced', async () => {
        const [m] = await fresh({ 't.b.c': false, 't.e[0]': 2 });
        const T = sample();
        expect(m.defineRecord('t', T, { doc: ['src'] })).toBe(T);
        expect(T.b.c).toBe(false);
        expect(T.e[0]).toBe(2);
        expect(Object.isFrozen(T.b)).toBe(true);
        expect(m.ENTITIES_SOURCE).toBe('override');
        expect(m.entitiesOverrides()).toEqual({ 't.b.c': false, 't.e[0]': 2 });
        expect(m.entitiesAnnouncements()).toEqual([
            `entities: override (md5 ${m.entitiesMd5()})`, 'set t.b.c=false', 'set t.e[0]=2', 'records: 1 (t)',
        ]);
    });

    it('an already-frozen node on the path is COPIED, never written', async () => {
        const [m] = await fresh(JSON.stringify({ 't.inner.x': 5 }));
        const inner = Object.freeze({ x: 1, y: 2 });
        const T = { inner, other: 3 };
        const got = m.defineRecord('t', T);
        expect(got).toBe(T); // the root was not frozen: written in place
        expect(got.inner).not.toBe(inner);
        expect(got.inner).toEqual({ x: 5, y: 2 });
        expect(inner.x).toBe(1);
    });

    it('a path whose record never registers is UNUSED, not refused', async () => {
        const [m] = await fresh({ 'nobody.x': 1 });
        m.defineRecord('t', { x: 1 });
        expect(m.entitiesUnused()).toEqual(['nobody.x']);
        expect(m.entitiesAnnouncements()).toContain('unused nobody.x=1 (no record "nobody" registered in this process)');
    });

    it('refused at registration by name: an unknown path, a doc key, a type change', async () => {
        let [m] = await fresh({ 't.zz': 1 });
        expect(refusal(() => m.defineRecord('t', sample(), { doc: ['src'] }))).toContain('unknown path "t.zz"');
        [m] = await fresh({ 't.b.src': 'x' });
        expect(refusal(() => m.defineRecord('t', sample(), { doc: ['src'] }))).toContain('"t.b.src" is a doc key');
        [m] = await fresh({ 't.b.d': 3 });
        expect(refusal(() => m.defineRecord('t', sample(), { doc: ['src'] }))).toContain('"t.b.d" is a string leaf ("Solid"); it cannot take a number (3)');
        [m] = await fresh({ 't.b': 3 });
        expect(refusal(() => m.defineRecord('t', sample(), { doc: ['src'] }))).toContain('unknown path "t.b"');
    });

    it('refused at load by name: a duplicate key in the text, a nested value, a non-finite number, a non-path key, a bad type', async () => {
        const loadRefusal = async (override) => {
            try { await fresh(override); } catch (e) { expect(e.name).toBe('EntityRecordError'); return e.message; }
            throw new Error('not refused');
        };
        expect(await loadRefusal('{"t.a": 1, "t.a": 2}')).toContain('duplicate key "t.a"');
        expect(await loadRefusal({ 't.a': { x: 1 } })).toContain('"t.a" is a nested value');
        expect(await loadRefusal({ 't.a': [1] })).toContain('"t.a" is a nested value');
        expect(await loadRefusal({ 't.a': NaN })).toContain('"t.a" must be a finite number, got NaN');
        expect(await loadRefusal({ walkSpeed: 1 })).toContain('"walkSpeed" is not a record path');
        expect(await loadRefusal({ 't.a': null })).toContain('"t.a" must be a number, a boolean or a string');
        expect(await loadRefusal('[1]')).toContain('must be a flat object of record paths');
    });

    it('EntityRecordError is the class every refusal throws', () => {
        expect(new EntityRecordError('x').message).toBe('entity records: x');
    });
});

describe('entityRecords — the stamp on the run (D4): the RESULT only', () => {
    it('runTape\'s result carries entitiesStamp() beside profile; the stream and the stepper keep their shape', () => {
        const levelSource = atlasLevelSource();
        const t = loadTape('straight-run');
        const out = runTape(t, { levelSource });
        expect(out.entities).toEqual(entitiesStamp());
        expect(out.entities).toEqual({ md5: entitiesMd5(), records: entityRecordNames().length });
        expect(Object.keys(runTapeToStream(t, { levelSource }))).toEqual(['ticks', 'transitions']);
        const stepper = createTapeStepper(t, { levelSource });
        let r = stepper.next();
        while (!r.done) r = stepper.next();
        expect(r.value.entities).toEqual(entitiesStamp());
        expect(JSON.stringify(r.value)).toBe(JSON.stringify(out));
    });
});

