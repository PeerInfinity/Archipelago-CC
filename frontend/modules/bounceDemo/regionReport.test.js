import { describe, it, expect } from 'vitest';
import { generateLevelFromSpecs } from './generator.js';
import { deriveBraidAccessRules } from './deriveRules.js';
import { PROFILES } from './physics.js';
import { formatRegionReport } from './regionReport.js';

const C = PROFILES.dj.constants;

function buildGated() {
    const exits = [
        { id: 'free', requirement: [], direction: 'up' },
        { id: 'gb', requirement: ['blue'], direction: 'right' },
        { id: 'gbl', requirement: ['blue', 'left'], direction: 'left' },
    ];
    const pickups = [{ id: 'pk', requirement: ['blue'] }];
    const level = generateLevelFromSpecs({
        id: 'R', exitSpecs: exits, pickupSpecs: pickups, seed: 1,
        physics: 'dj', mode: 'braid', braidWidth: 240, freeArrow: 'right',
    });
    const derived = deriveBraidAccessRules(level, {
        constants: C, freeArrow: 'right', freeAbilities: ['right'],
        terminalPortals: true, includePlatforms: true,
    });
    return { level, derived };
}

describe('formatRegionReport', () => {
    it('renders the headline per-row requirements and goal sets', () => {
        const { level, derived } = buildGated();
        const r = formatRegionReport({
            meta: { regionId: 'R', seed: 1, physics: 'dj', mode: 'braid', freeArrow: 'right' },
            level, derived,
        });
        expect(r).toContain('BOUNCE REGION REPORT — R');
        expect(r).toContain('ROWS (bottom → top)');
        // the blue-gate stone derives (blue); the top goals (blue AND left)
        expect(r).toMatch(/BLUE@\d+\s+\(blue\)/);
        expect(r).toContain('(blue AND left)');
        // first-necessary summary names both gated items
        expect(r).toContain('FIRST ROW EACH ITEM BECOMES NECESSARY');
        expect(r).toMatch(/blue\s+→ row \d+/);
        expect(r).toMatch(/left\s+→ row \d+/);
        // goals + defects sections
        expect(r).toContain('GOALS — verified minimal ability sets');
        expect(r).toContain('(none)'); // no defects
        // entity host tags surface
        expect(r).toMatch(/« .*exit:gb/);
    });

    it('blue is necessary at a lower row than left (nested chain)', () => {
        const { level, derived } = buildGated();
        const r = formatRegionReport({ meta: { regionId: 'R' }, level, derived });
        const blueRow = Number(r.match(/blue\s+→ row (\d+)/)[1]);
        const leftRow = Number(r.match(/left\s+→ row (\d+)/)[1]);
        expect(blueRow).toBeLessThan(leftRow);
    });

    it('warns when derived lacks per-platform data', () => {
        const { level } = buildGated();
        const derived = deriveBraidAccessRules(level, {
            constants: C, freeArrow: 'right', freeAbilities: ['right'], terminalPortals: true,
        });
        const r = formatRegionReport({ meta: { regionId: 'R' }, level, derived });
        expect(r).toContain('without includePlatforms');
    });

    it('renders an authored column with match/divergence flags when provided', () => {
        const { level, derived } = buildGated();
        // Authored map that matches verified on the blue stone, diverges on entrance.
        const blueStone = level.platforms.find((p) => p.type === 'blue');
        const authoredReqs = { [blueStone.id]: ['blue'], [level.platforms[0].id]: ['left'] };
        const r = formatRegionReport({ meta: { regionId: 'R' }, level, derived, authoredReqs });
        expect(r).toContain('authored');
        expect(r).toMatch(/\(blue\).*✓/);          // matching row
        expect(r).toContain('✗ DIVERGES');          // entrance: authored [left] vs verified ALWAYS
    });
});
