/**
 * registryShape — the registry cell shaper's cases, PINNED at the `short`
 * string each produced when the shaper was lifted out of
 * `scripts/procgen/reference/registry.mjs` (measured by running the old
 * function first). ⛔ A change here moves the checked-in snapshot AND the
 * panel's drift readout, so it is a change to both, never a tidy-up.
 */
import { describe, expect, it } from 'vitest';

import { cellOf, digTwo, fieldNamesOf, shapeRows } from './registryShape.js';

describe('cellOf — one row per branch', () => {
    const cases = [
        ['absent', undefined, { present: false, type: 'absent', value: null, short: '—' }],
        ['null is a VALUE', null, { present: true, type: 'null', value: null, short: '`null`' }],
        ['function', () => 1, { present: true, type: 'function', value: null, short: 'fn' }],
        ['short array (≤3 items, ≤44 chars)', ['a', 'b', 'c'],
            { present: true, type: 'array', value: ['a', 'b', 'c'], short: 'a, b, c' }],
        ['long array — more than 3 items', ['a', 'b', 'c', 'd'],
            { present: true, type: 'array', value: ['a', 'b', 'c', 'd'], short: '4 items' }],
        ['long array — over 44 chars', ['x'.repeat(30), 'y'.repeat(20)],
            { present: true, type: 'array', value: ['x'.repeat(30), 'y'.repeat(20)], short: '2 items' }],
        ['object ≤44 chars of keys, keys SORTED', { b: 1, a: 2 },
            { present: true, type: 'object', value: ['a', 'b'], short: '{a, b}' }],
        ['object longer', { aaaaaaaaaaaaaaaaaaaa: 1, bbbbbbbbbbbbbbbbbbbb: 2, ccccc: 3 },
            { present: true, type: 'object',
                value: ['aaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbb', 'ccccc'], short: '3 keys' }],
        ['boolean true', true, { present: true, type: 'boolean', value: true, short: 'yes' }],
        ['boolean false', false, { present: true, type: 'boolean', value: false, short: 'no' }],
        ['short string', 'hello', { present: true, type: 'string', value: 'hello', short: 'hello' }],
        ['string > 44 chars', 'z'.repeat(45),
            { present: true, type: 'string', value: 'z'.repeat(45), short: '45 chars' }],
        ['number', 30, { present: true, type: 'number', value: 30, short: '30' }],
        /** ⚠ Pinned AS MEASURED, quirks included: a short array of objects
         *  joins to `[object Object]` (its `value` is the JSON), and an empty
         *  array's short is the empty string. */
        ['short array of objects', [{ k: 1 }],
            { present: true, type: 'array', value: ['{"k":1}'], short: '[object Object]' }],
        ['empty array', [], { present: true, type: 'array', value: [], short: '' }],
        ['empty object', {}, { present: true, type: 'object', value: [], short: '{}' }],
    ];
    it.each(cases)('%s', (_label, value, expected) => {
        expect(cellOf(value)).toEqual(expected);
    });
});

describe('digTwo', () => {
    it('walks a dotted path', () => {
        expect(digTwo({ a: { b: { c: 7 } } }, 'a.b.c')).toBe(7);
    });
    it('stops at a null on the way — undefined, not a throw', () => {
        expect(digTwo({ a: null }, 'a.b')).toBeUndefined();
    });
    it('returns the null itself when the null IS the value', () => {
        expect(digTwo({ a: null }, 'a')).toBeNull();
    });
    it('a missing key is undefined', () => {
        expect(digTwo({ a: {} }, 'a.b')).toBeUndefined();
    });
});

describe('fieldNamesOf', () => {
    const entries = [
        { id: 'one', sharing: { items: { types: ['x'] }, mana: {} }, bag: { p: 1, q: 2 } },
        { id: 'two', sharing: null, extra: true },
    ];
    it('expands one dotted prefix two levels, and nothing it was not told to', () => {
        const names = fieldNamesOf(entries, new Set(['sharing', 'sharing.items']));
        expect(names).toEqual([
            'bag', 'extra', 'id', 'sharing', 'sharing.items', 'sharing.items.types', 'sharing.mana',
        ]);
    });
    it('an empty expandable set is just the union of keys, sorted', () => {
        expect(fieldNamesOf(entries, new Set())).toEqual(['bag', 'extra', 'id', 'sharing']);
    });
});

describe('shapeRows', () => {
    it('one row per name, one cell per entry in entry order', () => {
        const rows = shapeRows([{ id: 'b', x: 1 }, { id: 'a' }], ['x']);
        expect(rows).toEqual([{
            name: 'x',
            cells: [
                { id: 'b', present: true, type: 'number', value: 1, short: '1' },
                { id: 'a', present: false, type: 'absent', value: null, short: '—' },
            ],
        }]);
    });
});
