/**
 * ⛓ KNOWN DIVERGENCES (§5.124) — the L15 post-chest entry matches EXACTLY the measured divergence (battery
 * 39870675057 / repeat 39873208691, history 74–76) and nothing near it; a mutant tightened to 0.1 px goes red.
 */
import { describe, it, expect } from 'vitest';
import { classifyDivergences, KNOWN_DIVERGENCES } from './seedlingKnownDivergences.js';

const DIV = { t: 18, expected: { level: 15, x: 115.05000000000047, y: 103.44999999999993 },
    got: { level: 15, x: 115.30000000000047, y: 103.44999999999993 } };
/** B's history 73–77 as measured (goals, outcomes, ticks). */
const measured = (patch = {}) => [
    { goal: 'level_14 -> level_15__r1c5', outcome: 'done', ticks: 117, divergence: null },
    { goal: 'Level 015 - Chest', outcome: 'done', ticks: 185, divergence: null },
    { goal: 'level_15__r1c5 -> level_14', outcome: 'diverged', ticks: 157, divergence: DIV, ...patch.div },
    { goal: 'level_15__r1c5 -> level_14', outcome: 'done', ticks: 5, divergence: null, ...patch.rec },
    { goal: 'level_14 -> level_13', outcome: 'done', ticks: 55, divergence: null },
];

describe('classifyDivergences — the L15 post-chest entry', () => {
    it('the measured divergence is KNOWN (and the leg reached)', () => {
        const v = classifyDivergences(measured());
        expect(v.unknown).toEqual([]);
        expect(v.known).toHaveLength(1);
        expect(v.known[0].entry.id).toBe('l15-post-chest-walk');
        expect(v.reached).toEqual({ 'l15-post-chest-walk': true });
    });

    it('a walk that never reached the leg: nothing known, nothing unknown, reached false', () => {
        expect(classifyDivergences(measured().slice(0, 2))).toEqual({ known: [], unknown: [], reached: { 'l15-post-chest-walk': false } });
    });

    it.each([
        ['another tick', { div: { divergence: { ...DIV, t: 19 } } }, /t 19/],
        ['a larger offset', { div: { divergence: { ...DIV, got: { ...DIV.got, x: DIV.expected.x + 0.6 } } } }, /\|dx\|/],
        ['a y offset', { div: { divergence: { ...DIV, got: { ...DIV.got, y: DIV.got.y + 0.25 } } } }, /dy/],
        ['a slow recovery', { rec: { ticks: 11 } }, /not recovered within 10 t/],
        ['the re-solve diverged too', { rec: { outcome: 'diverged', divergence: DIV } }, /not recovered/],
    ])('%s is NOT known', (_, patch, why) => {
        const v = classifyDivergences(measured(patch));
        expect(v.known).toEqual([]);
        expect(v.unknown[0].why).toMatch(why);
    });

    it('a second divergence in that leg is not known (only the first is)', () => {
        const h = measured();
        h.splice(3, 0, { goal: 'level_15__r1c5 -> level_14', outcome: 'diverged', ticks: 140, divergence: DIV });
        const v = classifyDivergences(h);
        expect(v.unknown.map((u) => u.why)).toEqual([expect.stringMatching(/not recovered/), expect.stringMatching(/a second divergence/)]);
    });

    it('the same divergence on another leg, or not after the chest, is not known', () => {
        const other = measured();
        other[2] = { ...other[2], goal: 'level_15__r1c9 -> level_16__r1c1' };
        expect(classifyDivergences(other).known).toEqual([]);
        const noChest = measured();
        noChest[1] = { ...noChest[1], goal: 'Level 015 - Other' };
        expect(classifyDivergences(noChest).unknown[0].why).toMatch(/not after a done "Level 015 - Chest"/);
    });

    it('it bites: the bound tightened to 0.1 px leaves the measured divergence unknown (red)', () => {
        const tight = KNOWN_DIVERGENCES.map((e) => ({ ...e, maxDx: 0.1 }));
        const v = classifyDivergences(measured(), tight);
        expect(v.known).toEqual([]);
        expect(v.unknown[0].why).toMatch(/\|dx\| 0\.25\d* > 0\.1/);
    });
});
