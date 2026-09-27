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

    /**
     * ⛓⛓⛓ **ARC 5, SLICE 4 — THE SHIPPED TABLE HAS TWO SWORD-GATED HEADS NOW**,
     * and this row is asserted LITERALLY on purpose so a third cannot slide in.
     * `arena`'s payload is a spinner, and `weaponForPress` returns null with no
     * sword slot, so it carries the same `needs` the kill gate does. ⛔ THE
     * CONSEQUENCE IS THE ROW BELOW IT: `--require=hasSword` stopped being a
     * FORCED BARE head and became a two-member `+` LIST.
     */
    /**
     * ⛓⛓ **SEEDLING SUBSTRATE S1 — A THIRD ONE SLID IN, BY DESIGN, AND THIS IS
     * THE ROW THAT SAYS SO.** `rockgate` needs the sword for the kill gate's
     * reason (a rock breaks under a swing, and there is no swing without the
     * sword), so `--require=hasSword` is now a THREE-member `+` list — trap 457's
     * move, predicted at W1 and re-pinned here rather than discovered.
     */
    it('headsNeeding answers the SHIPPED table with exactly `killgate`, `arena`, `rockgate`', () => {
        expect(headsNeeding('hasSword')).toEqual(['killgate', 'arena', 'rockgate']);
        expect(headsNeeding('hasShield')).toEqual([]);
    });

    /**
     * ⛓⛓ S1, D2 — THE `shortcut` HEAD NEEDS THE SWORD AND IS NEVER FORCED BY
     * `require`. Its `needs` is the seam's gate; its LAW says the goal stays
     * reachable without it, so it can only ever grade SHORTENS. ⛔ Asserted off
     * the element's declared law, on a table that has only the shortcut, so the
     * filter is shown to be the law and not the head name.
     */
    it('⛔ a SHORTCUT-law head is never a head `require` can force', () => {
        expect(ELEMENT_TABLE.shortcut.needs).toEqual(['hasSword']);
        expect(headsNeeding('hasSword')).not.toContain('shortcut');
        const ONLY = Object.freeze({ cut: ELEMENT_TABLE.shortcut });
        expect(headsNeeding('hasSword', ONLY)).toEqual([]);
        const d = resolveRequireDirective({ require: ['hasSword'], items: SWORD, table: ONLY });
        expect(d.refused.reason).toBe('no-element-needs-this-item');
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
    /**
     * ⛓⛓⛓ **AND THIS IS WHERE A SECOND SWORD-GATED HEAD IS PAID FOR** (arc 5,
     * slice 4). Until `arena` shipped, exactly one head needed the sword and the
     * directive FORCED it BARE — which spends no draw (arc-2's law). With two,
     * the same code path produces the `+` LIST it was written to produce, and a
     * list spends ONE `pick` before `instantiate`. ⛔ So `--require=hasSword`
     * now draws between the two rather than naming one, and every draw after the
     * head moves by one. That is trap 321's shape arriving on schedule: the
     * mechanism did not change, the TABLE did, and the row that used to read
     * "forced" reads "a distribution over exactly the heads that need it".
     */
    it('MET when nobody said `elements` — a `+` LIST over EVERY sword-gated head', () => {
        const d = resolveRequireDirective({ require: ['hasSword'], items: SWORD });
        expect(d.refused).toBe(null);
        expect(d.forced).toBe(true);
        // ⛓ S1: `rockgate` is the third (see `headsNeeding`'s row above).
        expect(d.elements).toEqual({ any: [{ name: 'killgate' }, { name: 'arena' },
            { name: 'rockgate' }] });
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
