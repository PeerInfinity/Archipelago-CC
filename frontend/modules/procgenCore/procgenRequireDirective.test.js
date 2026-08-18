/**
 * procgenCore/elementSpec — **`require:[X]` — THE HEAD DERIVED FROM `needs`**
 * (PROCGEN ELEMENTS arc 3, slice 4d, D1).
 *
 * ⛓ THE ROWS ARE DRIVEN BY A **TABLE ARGUMENT**, not by the shipped
 * `ELEMENT_TABLE` alone. The shipped table has exactly ONE gated head, so a row
 * that only ever asked it could not tell "the heads whose `needs` include X"
 * from "the string `'killgate'`" — trap 296's shape, and the mutant table says
 * so out loud. `resolveRequireDirective` and `headsNeeding` therefore take the
 * table, and the discriminating rows hand them a synthetic one with TWO.
 */

import { describe, expect, it } from 'vitest';

import {
    ELEMENT_TABLE, ITEMS_ELEMENTS_NEED, headsNeeding, parseItemRequireList,
    resolveRequireDirective,
} from './elementSpec.js';

/** ⛓ Two heads needing one item, one needing another, one needing nothing. */
const TWO = Object.freeze({
    alpha: Object.freeze({ needs: Object.freeze(['hasSword']) }),
    beta: Object.freeze({ needs: Object.freeze(['hasSword']) }),
    gamma: Object.freeze({ needs: Object.freeze(['hasShield']) }),
    delta: Object.freeze({}),
    both: Object.freeze({ needs: Object.freeze(['hasSword', 'hasShield']) }),
});
const SWORD = Object.freeze({ hasSword: true, hasShield: false });

describe('the item vocabulary, read from the table', () => {
    it('ITEMS_ELEMENTS_NEED is the UNION of every head\'s `needs`, and today that is the sword',
        () => {
            expect(ITEMS_ELEMENTS_NEED).toEqual(['hasSword']);
            // ⛔ DERIVED, not spelled: the union really comes off the table.
            expect(ITEMS_ELEMENTS_NEED).toEqual([...new Set(
                Object.values(ELEMENT_TABLE).flatMap((e) => e.needs ?? []))].sort());
        });

    it('headsNeeding answers the SHIPPED table with exactly `killgate`', () => {
        expect(headsNeeding('hasSword')).toEqual(['killgate']);
        expect(headsNeeding('hasShield')).toEqual([]);
    });

    it('⛓⛓ A TABLE WITH TWO NEEDING HEADS OFFERS BOTH — the derivation is not a constant',
        () => {
            expect(headsNeeding('hasSword', TWO)).toEqual(['alpha', 'beta', 'both']);
        });
});

describe('the grammar', () => {
    it('parses a list and keeps the caller\'s order', () => {
        expect(parseItemRequireList('hasSword,hasShield')).toEqual(['hasSword', 'hasShield']);
    });

    it('refuses an EMPTY list, an empty clause and a duplicate — the maze\'s own grammar', () => {
        expect(() => parseItemRequireList('')).toThrow(/EMPTY `require` list/);
        expect(() => parseItemRequireList('hasSword,')).toThrow(/EMPTY entry/);
        expect(() => parseItemRequireList('hasSword,hasSword')).toThrow(/TWICE/);
    });

    it('⛔ does NOT refuse an unknown item — that is the RUN\'s named refusal, not a parse error',
        () => {
            expect(parseItemRequireList('notAnItem')).toEqual(['notAnItem']);
        });
});

describe('the directive resolves against `needs`, the biome and the caller\'s spec', () => {
    it('MET with the head FORCED when nobody said `elements` — and it spends no draw', () => {
        const d = resolveRequireDirective({ require: ['hasSword'], items: SWORD });
        expect(d.refused).toBe(null);
        expect(d.forced).toBe(true);
        expect(d.elements).toEqual({ name: 'killgate' });
    });

    it('⛓⛓ TWO NEEDING HEADS become a `+` LIST of exactly those two-and-a-half', () => {
        const d = resolveRequireDirective({ require: ['hasSword'], items: SWORD, table: TWO });
        expect(d.refused).toBe(null);
        expect(d.elements).toEqual({ any: [{ name: 'alpha' }, { name: 'beta' }, { name: 'both' }] });
    });

    it('refuses `no-element-needs-this-item` when nothing in the table is gated on it', () => {
        const d = resolveRequireDirective({ require: ['hasShield'], items: { hasShield: true } });
        expect(d.refused.reason).toBe('no-element-needs-this-item');
        expect(d.refused.detail).toMatch(/hasSword/);
    });

    it('refuses `no-single-element-can-carry-every-required-item` — ONE element per level', () => {
        const table = Object.freeze({ alpha: TWO.alpha, gamma: TWO.gamma });
        const d = resolveRequireDirective({
            require: ['hasSword', 'hasShield'],
            items: { hasSword: true, hasShield: true },
            table,
        });
        expect(d.refused.reason).toBe('no-single-element-can-carry-every-required-item');
    });

    it('...and a head that needs BOTH satisfies the same ask', () => {
        const d = resolveRequireDirective({
            require: ['hasSword', 'hasShield'],
            items: { hasSword: true, hasShield: true },
            table: TWO,
        });
        expect(d.refused).toBe(null);
        expect(d.elements).toEqual({ name: 'both' });
    });

    it('refuses `the-biome-lacks-the-item`, and names it as the SEAM\'s gate asked earlier', () => {
        const d = resolveRequireDirective({
            require: ['hasSword'], items: { hasSword: false, hasShield: false },
        });
        expect(d.refused.reason).toBe('the-biome-lacks-the-item');
        expect(d.refused.detail).toMatch(/the-element-needs-an-item-this-biome-does-not-grant/);
    });

    it('HONOURS an explicit BARE required head', () => {
        const d = resolveRequireDirective({
            require: ['hasSword'], items: SWORD, elements: { name: 'killgate' },
        });
        expect(d.refused).toBe(null);
        // ⛔ NOT forced: the caller said it, and `forced` is what says a draw was saved.
        expect(d.forced).toBe(false);
        expect(d.elements).toEqual({ name: 'killgate' });
    });

    it('refuses `the-directive-and-the-spec-disagree` for a spec that omits every head', () => {
        const d = resolveRequireDirective({
            require: ['hasSword'], items: SWORD, elements: { name: 'guard' },
        });
        expect(d.refused.reason).toBe('the-directive-and-the-spec-disagree');
    });

    it('⛔ ...and for a `+` LIST that CONTAINS it — a distribution cannot meet a run predicate',
        () => {
            const d = resolveRequireDirective({
                require: ['hasSword'], items: SWORD,
                elements: { any: [{ name: 'guard' }, { name: 'killgate' }] },
            });
            expect(d.refused.reason).toBe('the-directive-and-the-spec-disagree');
            expect(d.refused.detail).toMatch(/never narrowed/);
        });

    it('an EMPTY ask changes nothing and refuses nothing', () => {
        const d = resolveRequireDirective({ items: SWORD, elements: { name: 'guard' } });
        expect(d.asked).toEqual([]);
        expect(d.refused).toBe(null);
        expect(d.elements).toEqual({ name: 'guard' });
    });
});
