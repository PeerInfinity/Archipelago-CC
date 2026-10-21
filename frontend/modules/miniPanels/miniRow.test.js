import { describe, it, expect } from 'vitest';
import { fitSizes, middleIndex, planChecks } from './miniRow.js';

describe('planChecks — where the checks text goes', () => {
    it('Checks alone: its own mini row', () => {
        expect(planChecks({ checksOn: true, botMini: false })).toEqual({ checksPanelInRow: true, botShowsChecks: false });
    });
    it('Checks with the bot mini: inside the bot\'s row, no Checks panel', () => {
        expect(planChecks({ checksOn: true, botMini: true })).toEqual({ checksPanelInRow: false, botShowsChecks: true });
    });
    it('Checks off: nowhere, whatever the bot does', () => {
        expect(planChecks({ checksOn: false, botMini: true })).toEqual({ checksPanelInRow: false, botShowsChecks: false });
        expect(planChecks({ checksOn: false, botMini: false })).toEqual({ checksPanelInRow: false, botShowsChecks: false });
    });
});

describe('middleIndex — the root row child the mini row sits above', () => {
    it('is the middle of three, the second of two, the only one of one', () => {
        expect(middleIndex(3)).toBe(1);
        expect(middleIndex(2)).toBe(1);
        expect(middleIndex(1)).toBe(0);
        expect(middleIndex(0)).toBe(0);
    });
});

describe('fitSizes — percent sizes for the mini column', () => {
    it('gives each mini its content height and the rest to the others, in proportion', () => {
        const sizes = fitSizes([
            { mini: true, px: 40 },
            { mini: false, size: 30 },
            { mini: false, size: 10 },
        ], 800);
        expect(sizes[0]).toBeCloseTo(5);
        expect(sizes[1]).toBeCloseTo(71.25);
        expect(sizes[2]).toBeCloseTo(23.75);
        expect(sizes.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    });

    it('treats a missing size as an equal share', () => {
        const sizes = fitSizes([{ mini: true, px: 100 }, { mini: false }, { mini: false, size: 0 }], 1000);
        expect(sizes).toEqual([10, 45, 45]);
    });

    it('is null before the column has a height', () => {
        expect(fitSizes([{ mini: true, px: 40 }, { mini: false, size: 50 }], 0)).toBeNull();
    });

    it('caps a mini at the whole column', () => {
        expect(fitSizes([{ mini: true, px: 2000 }, { mini: false, size: 50 }], 1000)).toEqual([100, 0]);
    });
});
