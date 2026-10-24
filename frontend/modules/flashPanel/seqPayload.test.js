/**
 * The one `<seq>|…` payload parser (maze-lab arms F-a / plan §17.1 F5).
 *
 * ⛓ WHY THIS FILE EXISTS SEPARATELY FROM THE TWO CALLERS' ROWS. Both
 * `seedlingCheckBinding.test.js` and `seedlingRegionBinding.test.js` keep their
 * own malformed lists, in their own dialect, and neither moved when the rules
 * were hoisted — that is the byte-inertness claim. This file asks the SHARED
 * function the shapes BOTH of them feed today, so a change to the rules reds
 * one row instead of being caught only by whichever caller happened to name the
 * shape.
 *
 * ⛔ The shapes are STATED here, not walked off the callers' arrays. A
 * population read off the subject cannot discriminate (D3's fixture defect,
 * plan §36).
 */
import { describe, expect, it } from 'vitest';

import { parseSeqPayload } from './seqPayload.js';

describe('parseSeqPayload', () => {
    it('returns the fields UNTYPED, seq included — typing is the caller\'s', () => {
        expect(parseSeqPayload('12|19|4|0', 4)).toEqual(['12', '19', '4', '0']);
        expect(parseSeqPayload('7|19|stairsup|8|8|31', 6))
            .toEqual(['7', '19', 'stairsup', '8', '8', '31']);
    });

    it('refuses a non-string and the EMPTY boot report', () => {
        for (const bad of [null, undefined, 7, 42, {}, [], '']) {
            expect(parseSeqPayload(bad, 4)).toBeNull();
            expect(parseSeqPayload(bad, 6)).toBeNull();
        }
    });

    it('refuses a field count that is not exact — short or long', () => {
        expect(parseSeqPayload('1|19|4', 4)).toBeNull();
        expect(parseSeqPayload('1|19|4|0|x', 4)).toBeNull();
        expect(parseSeqPayload('1|19|stairsup|8|8', 6)).toBeNull();
        expect(parseSeqPayload('1|19|stairsup|8|8|31|x', 6)).toBeNull();
    });

    /**
     * ⛔⛔ EMPTY IS NOT ZERO — the rule both callers used to spell. `Number('')`
     * is 0 and `Number.isInteger(0)` is true, so an unwritten field would sail
     * through a caller's integer sweep as a real value at a real address: a
     * CLEAR for `pendingCheck`, a door to level 0 at (0, 0) for `pendingExit`.
     */
    it('refuses an EMPTY FIELD anywhere — the trailing, leading and middle shapes both callers feed', () => {
        expect(Number('')).toBe(0);            // the reason, asserted not asserted-about
        expect(Number.isInteger(Number(''))).toBe(true);

        expect(parseSeqPayload('1|19|4|', 4)).toBeNull();          // check's trailing
        expect(parseSeqPayload('1|19|stairsup|8|8|', 6)).toBeNull(); // exit's trailing
        expect(parseSeqPayload('|19|stairsup|8|8|31', 6)).toBeNull(); // exit's leading
        expect(parseSeqPayload('1|19||8|8|31', 6)).toBeNull();      // exit's middle
        expect(parseSeqPayload('1||4|0', 4)).toBeNull();            // the middle, four fields
    });

    /**
     * ⛓ WHAT IT DELIBERATELY LETS THROUGH. The non-integer shapes each caller
     * refuses (`'a|19|4|0'`, `'1.5|19|4|0'`, `'1|19|stairsup|x|8|31'`) are
     * TYPING refusals and they do not agree between the callers — `pendingExit`
     * wants field 2 to stay the string `stairsup`. Hoisting them would be the
     * drift this module exists to prevent.
     */
    it('does NOT type — a non-integer field is the caller\'s refusal, not this one', () => {
        expect(parseSeqPayload('a|19|4|0', 4)).toEqual(['a', '19', '4', '0']);
        expect(parseSeqPayload('1.5|19|4|0', 4)).toEqual(['1.5', '19', '4', '0']);
        expect(parseSeqPayload('1|19|stairsup|x|8|31', 6))
            .toEqual(['1', '19', 'stairsup', 'x', '8', '31']);
    });
});
