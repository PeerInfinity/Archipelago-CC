/**
 * saveArrayRules — ⛓ SEAL DELIVERY: the merge rule of each save array, stated once (union / count-fill / log-append).
 */
import { describe, expect, it } from 'vitest';
import {
    POSITIONAL_SAVE_ARRAYS, SAVE_ARRAY_RULES, addToSaveArray, liveSaveArray, mergeSaveArray, saveArrayDelta,
    sealLogSlots,
} from './saveArrayRules.js';
import { SAVE_KEYS } from './tapeFormat.js';

describe('saveArrayRules — one rule per save array', () => {
    it('every save array the tape declares has a rule; only the seal log is positional', () => {
        expect(Object.keys(SAVE_ARRAY_RULES).sort()).toEqual([...SAVE_KEYS].sort());
        expect(POSITIONAL_SAVE_ARRAYS).toEqual(['seal_parts']);
        expect(() => mergeSaveArray('coins', [], [])).toThrow(/no merge rule for save\.coins/);
    });

    it('union (keys): the game\'s ∪ AP\'s, sorted', () => {
        expect(mergeSaveArray('keys', [3], [0, 3])).toEqual([0, 3]);
    });

    it('count-fill (totems): at least N indices, the missing ones the smallest unheld; never more than N because of the game\'s own', () => {
        expect(mergeSaveArray('totem_parts', [], [0, 1])).toEqual([0, 1]);
        expect(mergeSaveArray('totem_parts', [3], [0])).toEqual([3]);
        expect(mergeSaveArray('totem_parts', [3], [0, 1])).toEqual([0, 3]);
        expect(mergeSaveArray('totem_parts', [0, 2, 4], [0, 1])).toEqual([0, 2, 4]);   // never shortened
    });

    it('log-append (seals): the held log is the prefix, AP appends identities it does not hold, up to N slots', () => {
        expect(mergeSaveArray('seal_parts', [5], [0, 1])).toEqual([5, 0]);
        expect(mergeSaveArray('seal_parts', [1, 0], [0, 1, 2])).toEqual([1, 0, 2]);
        expect(mergeSaveArray('seal_parts', [9, 8, 7], [0])).toEqual([9, 8, 7]);
        expect(mergeSaveArray('seal_parts', [], [])).toEqual([]);
        // the answer for N AP seals never repeats an identity
        const full = mergeSaveArray('seal_parts', [15, 3], Array.from({ length: 16 }, (_, i) => i));
        expect(new Set(full).size).toBe(16);
        expect(full.slice(0, 2)).toEqual([15, 3]);
    });

    it('delta and add: a log delta is the appended slots; adding a delta over a staging EXTENDS it (never fills to the delta\'s size)', () => {
        expect(saveArrayDelta('seal_parts', [5], [5, 0])).toEqual([{ array: 'seal_parts', index: 1, value: 0 }]);
        expect(saveArrayDelta('totem_parts', [3], [0, 3])).toEqual([{ array: 'totem_parts', index: 0 }]);
        expect(addToSaveArray('seal_parts', [5], [0])).toEqual([5, 0]);
        expect(addToSaveArray('totem_parts', [3], [0])).toEqual([0, 3]);
        expect(addToSaveArray('seal_parts', [0], [0])).toEqual([0]);
    });

    it('liveSaveArray: booleans → indices; the seal log → its filled prefix', () => {
        expect(liveSaveArray('keys', [false, true, false, false, true])).toEqual([1, 4]);
        expect(liveSaveArray('seal_parts', [7, 3, -1, -1])).toEqual([7, 3]);
        expect(liveSaveArray('seal_parts', undefined)).toBeNull();
    });

    // ⛓ R4b (rules-boss-locations) — 23 Seals can be pooled (`boss_location_items: seal`); the log has 16 slots.
    it('the seal log never grows past its 16 slots: a 17th..23rd granted Seal writes nothing', () => {
        const all = Array.from({ length: 23 }, (_, i) => i);
        expect(mergeSaveArray('seal_parts', [], all)).toEqual(Array.from({ length: 16 }, (_, i) => i));
        expect(mergeSaveArray('seal_parts', [9], all)).toHaveLength(16);
        expect(mergeSaveArray('totem_parts', [], [0, 1, 2, 3, 4, 5, 6])).toEqual([0, 1, 2, 3, 4]);
    });

    it('sealLogSlots: the Nth Seal fills all 16 slots; below N one per Seal, the door slot held back', () => {
        // default N = 16: exactly the old one-slot-per-Seal fill
        for (let c = 0; c <= 23; c += 1) expect(sealLogSlots(c), `count ${c}`).toBe(Math.min(c, 16));
        expect(sealLogSlots(7, 8)).toBe(7);
        expect(sealLogSlots(8, 8)).toBe(16);
        expect(sealLogSlots(15, 23)).toBe(15);
        expect(sealLogSlots(22, 23)).toBe(15);
        expect(sealLogSlots(23, 23)).toBe(16);
        expect(sealLogSlots(1, 1)).toBe(16);
        expect(sealLogSlots(0, 1)).toBe(0);
        expect(() => sealLogSlots(-1)).toThrow(/non-negative integer/);
        expect(() => sealLogSlots(3, 0)).toThrow(/seals_required must be a positive integer/);
    });
});
