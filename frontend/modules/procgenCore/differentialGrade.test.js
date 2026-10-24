/**
 * procgenCore/differentialGrade.test — **THE FIFTH GRADE'S SYNTHETIC
 * DEFINITION ROW** (PROCGEN ELEMENTS arc 5, slice 5; kickoff §7.7's
 * *"plus a synthetic unit row for the definition itself"*).
 *
 * ⛔ THIS FILE IS THE DEFINITION'S OWN GATE, and it is deliberately separate
 * from the two bindings' rows. Those measure whether a GENERATED level reaches
 * the grade; this measures whether the WORD means what §4.5 says, at every
 * boundary, in both directions, with no room, no solver and no stream.
 */

import { describe, expect, it } from 'vitest';

import { GRADES, GRADE_WORDS, REQUIRING_GRADES, gradeDifferential } from './differentialGrade.js';

/** Both arms SOLVED at the given costs — the only shape SHORTENS can come out of. */
const both = (withCost, withoutCost) => gradeDifferential({
    required: false, withoutVerdict: 'SOLVED', withCost, withoutCost,
});

describe('the SIX words', () => {
    it('⛓ are exactly what `gradeDifferential` can answer', () => {
        const all = new Set([
            gradeDifferential({ required: true, withoutVerdict: 'REFUSED' }),
            gradeDifferential({ required: true, withoutVerdict: 'BUDGET_EXHAUSTED' }),
            gradeDifferential({ required: true, withoutVerdict: 'THREW:PhysicsV2Error' }),
            both(200, 200),
            both(120, 300),
            both(300, 120),
        ]);
        expect([...all].sort()).toEqual(GRADE_WORDS);
        expect(GRADE_WORDS).toHaveLength(6);
    });

    it('⛓ the exported table and the words agree', () => {
        expect([...Object.values(GRADES)].sort()).toEqual(GRADE_WORDS);
        expect(GRADES.SHORTENS).toBe('SHORTENS');
    });
});

describe('SHORTENS — ⚖ design §4.5: solves both ways, fewer ticks WITH the item', () => {
    /**
     * ⛓⛓⛓ **THE DIRECTION, FROM BOTH SIDES.** There is exactly one `<` in the
     * module and a sign error in it would grade every shortcut level and every
     * non-shortcut level with the same confidence — so the boundary is walked
     * one step either side of equality rather than asserted at a comfortable
     * distance from it.
     */
    it('⛓⛓ strictly cheaper WITH ⇒ SHORTENS; equal ⇒ INERT; cheaper WITHOUT ⇒ NOT-ESTABLISHED',
        () => {
            expect(both(299, 300)).toBe('SHORTENS');
            expect(both(1, 300)).toBe('SHORTENS');
            expect(both(300, 300)).toBe('INERT');
            expect(both(0, 0)).toBe('INERT');
            expect(both(301, 300)).toBe('NOT-ESTABLISHED');
            expect(both(300, 1)).toBe('NOT-ESTABLISHED');
        });

    /**
     * ⛔⛔ **A CUT IS NEVER A SHORTCUT — the negative row the gate asks for.**
     * A level whose without-arm did not reach the goal is REQUIRED, and no
     * arrangement of tick counts may turn it into a saving. This is the LIE the
     * grade has to refuse: the without-arm carries the ticks it spent FAILING,
     * so `50 < 400` is available on exactly the rows where it means nothing.
     */
    it('⛔ a REQUIRED row is never SHORTENS, however the costs fall', () => {
        for (const withoutVerdict of ['REFUSED', 'BUDGET_EXHAUSTED', 'THREW:X']) {
            const g = gradeDifferential({ required: true, withoutVerdict,
                withCost: 50, withoutCost: 400 });
            expect(g).not.toBe('SHORTENS');
            expect(['STRONG', 'BOUND-DEPENDENT', 'WEAK']).toContain(g);
        }
    });

    /**
     * ⛔ `null < n` IS `0 < n` IN JAVASCRIPT, and that is the one-line defect
     * this guard exists for: a missing cost must never read as a cheap one.
     */
    it('⛔ a MISSING cost is NOT-ESTABLISHED, never SHORTENS and never INERT', () => {
        expect(gradeDifferential({ required: false, withCost: null, withoutCost: 300 }))
            .toBe('NOT-ESTABLISHED');
        expect(gradeDifferential({ required: false, withCost: 120, withoutCost: null }))
            .toBe('NOT-ESTABLISHED');
        expect(gradeDifferential({ required: false })).toBe('NOT-ESTABLISHED');
        expect(gradeDifferential({ required: false, withCost: null, withoutCost: null }))
            .toBe('NOT-ESTABLISHED');
    });

    /**
     * ⛓ **AND IT DOES NOT MEET A DIRECTIVE.** A shortcut is the case where the
     * level solves WITHOUT the item; *"requires X"* is the case where it does
     * not. A directive met by a SHORTENS row would claim a requirement on a
     * level that has none.
     */
    it('⛔ SHORTENS does not meet a `require:` directive', () => {
        expect(REQUIRING_GRADES).toEqual(['STRONG', 'BOUND-DEPENDENT']);
        expect(REQUIRING_GRADES).not.toContain(GRADES.SHORTENS);
        expect(REQUIRING_GRADES).not.toContain(GRADES.INERT);
        expect(REQUIRING_GRADES).not.toContain(GRADES.NOT_ESTABLISHED);
        expect(REQUIRING_GRADES).not.toContain(GRADES.WEAK);
    });

    /**
     * ⛓ **THE UNIT IS THE CALLER'S AND THE FUNCTION NEVER MIXES TWO.** Seedling
     * hands TICKS, the maze hands BFS PLAN LENGTH; both are integers and
     * neither is comparable to the other. Driven with the maze's own magnitudes
     * so the row is not secretly about Seedling's.
     */
    it('⛓ grades BFS plan lengths the same way it grades ticks', () => {
        expect(both(14, 26)).toBe('SHORTENS');
        expect(both(26, 26)).toBe('INERT');
        expect(both(26, 14)).toBe('NOT-ESTABLISHED');
    });
});
