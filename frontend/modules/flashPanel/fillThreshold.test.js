/**
 * ⛓ R4b part 2 — the threshold fill (`fillThreshold.js`): the one statement both the panel adapter's `!seal`
 * writes and `saveArrayRules.sealLogSlots` read.
 */
import { describe, expect, it } from 'vitest';

import { thresholdFillSlots } from './fillThreshold.js';

describe('thresholdFillSlots', () => {
    it('no `required` → the plain fill, min(count, slots)', () => {
        for (let c = 0; c <= 23; c += 1) expect(thresholdFillSlots(c, 16)).toBe(Math.min(c, 16));
        expect(thresholdFillSlots(4, 16, null)).toBe(4);
        expect(thresholdFillSlots(20, 16, undefined)).toBe(16);
    });

    it('`required` = slots is the plain fill exactly; below N the last slot is held back; at N all slots', () => {
        for (let c = 0; c <= 23; c += 1) expect(thresholdFillSlots(c, 16, 16)).toBe(Math.min(c, 16));
        expect(thresholdFillSlots(15, 16, 23)).toBe(15);
        expect(thresholdFillSlots(22, 16, 23)).toBe(15);
        expect(thresholdFillSlots(23, 16, 23)).toBe(16);
        expect(thresholdFillSlots(1, 16, 1)).toBe(16);
        expect(thresholdFillSlots(0, 16, 1)).toBe(0);
    });

    it('refuses by name: a bad count, slot count or requirement', () => {
        expect(() => thresholdFillSlots(-1, 16)).toThrow(/copy count/);
        expect(() => thresholdFillSlots(1.5, 16)).toThrow(/copy count/);
        expect(() => thresholdFillSlots(1, 0)).toThrow(/slot count/);
        expect(() => thresholdFillSlots(1, 16, 0)).toThrow(/copies required/);
        expect(() => thresholdFillSlots(1, 16, '8')).toThrow(/copies required/);
    });
});
