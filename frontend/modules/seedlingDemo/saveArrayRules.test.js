/**
 * saveArrayRules — ⛓ SEAL DELIVERY: the merge rule of each save array, stated once (union / count-fill / log-append).
 */
import { describe, expect, it } from 'vitest';
import {
    POSITIONAL_SAVE_ARRAYS, SAVE_ARRAY_RULES, addToSaveArray, liveSaveArray, mergeSaveArray, saveArrayDelta,
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
});
