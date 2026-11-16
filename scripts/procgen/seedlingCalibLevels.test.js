/**
 * The P3 timing probe's PURE helpers (`seedlingCalibLevels.js`; the probe runs the calib file only in
 * `seedling-probe.yml`): the preset's levels, one run's per-level report out of vitest's JSON, the median, and the
 * normalised tip/control comparison.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { compareLevels, levelReport, median, presetLevels } from './seedlingCalibLevels.js';

const RULES = JSON.parse(readFileSync(new URL('../../frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json', import.meta.url), 'utf8'));

describe('presetLevels', () => {
    it('covers every sidecar region, each level once, in sidecar order', () => {
        const levels = presetLevels(RULES);
        expect(new Set(levels).size).toBe(levels.length);
        const sidecars = RULES.preset_sidecars['1'];
        const carriers = Object.values(sidecars).filter((s) => s.playable_payload).map((s) => s.playable_payload.atlas_region);
        expect([...new Set(carriers)]).toEqual(levels);
    });
});

const vitestJson = (tests) => ({ testResults: [{ assertionResults: tests.map(([title, duration, status = 'passed']) => ({ title, duration, status })) }] });

describe('levelReport', () => {
    it('gives each level its one test, and names the rest as other tests', () => {
        const rep = levelReport(vitestJson([['the partition', 3], ['a: both', 1200.4], ['b: both', 50, 'failed'], ['whole verdict', 1]]), ['a', 'b']);
        expect(rep.problems).toEqual([]);
        expect(rep.levels).toEqual([{ level: 'a', ms: 1200, status: 'passed' }, { level: 'b', ms: 50, status: 'failed' }]);
        expect(rep.others.map((t) => t.title)).toEqual(['the partition', 'whole verdict']);
    });
    it('names a level with no test, and one with two', () => {
        const rep = levelReport(vitestJson([['a: x', 1], ['a: y', 1]]), ['a', 'b']);
        expect(rep.problems).toEqual(['a: 2 tests (want exactly 1)', 'b: 0 tests (want exactly 1)']);
        expect(rep.levels[1]).toEqual({ level: 'b', ms: null, status: 'missing' });
    });
    it('does not take level_1 for level_10 (the title prefix is the level and its colon)', () => {
        const rep = levelReport(vitestJson([['level_10: x', 5], ['level_1: x', 7]]), ['level_1', 'level_10']);
        expect(rep.levels.map((r) => r.ms)).toEqual([7, 5]);
    });
});

describe('median', () => {
    it('is the middle value, or the mean of the middle two', () => {
        expect(median([3, 1, 2])).toBe(2);
        expect(median([4, 1, 3, 2])).toBe(2.5);
        expect(() => median([])).toThrow();
    });
});

const side = (pairs) => ({ levels: Object.entries(pairs).map(([level, ms]) => ({ level, ms, status: 'passed' })) });

describe('compareLevels', () => {
    const control = side({ a: 10000, b: 20000, c: 40000, d: 80000, tiny: 5 });
    it('normalises by the median ratio, so a uniformly slower runner flags nothing', () => {
        const tip = side({ a: 17000, b: 34000, c: 68000, d: 136000, tiny: 50 });
        const c = compareLevels(tip, control, { threshold: 1.5, floorMs: 1000 });
        expect(c.median).toBeCloseTo(1.7);
        expect(c.flagged).toEqual([]);
        expect(c.rows.find((r) => r.level === 'tiny')).toMatchObject({ rated: false, flagged: false });
    });
    it('flags the one level that got slower, by name', () => {
        const tip = side({ a: 10000, b: 40000, c: 40000, d: 80000, tiny: 5 });
        const c = compareLevels(tip, control, { threshold: 1.5, floorMs: 1000 });
        expect(c.flagged).toEqual(['b']);
        expect(c.spread.max).toBe(2);
        expect(c.unflaggedSpread).toEqual({ min: 1, max: 1 });
    });
    it('keeps the moved levels out of the median, and still rates them', () => {
        const tip = side({ a: 30000, b: 60000, c: 40000, d: 80000, tiny: 5 });
        const all = compareLevels(tip, control, { threshold: 1.5, floorMs: 1000 });
        const moved = compareLevels(tip, control, { threshold: 1.5, floorMs: 1000, moved: ['a', 'b'] });
        expect(all.median).toBe(2); // a, b drag the median: the slowdown hides
        expect(all.flagged).toEqual([]);
        expect(moved.median).toBe(1);
        expect(moved.flagged).toEqual(['a', 'b']);
    });
    it('names a level only one side timed, and a --moved name that is no level', () => {
        const c = compareLevels(side({ a: 10000, z: 1 }), control, { threshold: 1.5, floorMs: 1000, moved: ['nope'] });
        expect(c.onlyTip).toEqual(['z']);
        expect(c.onlyControl).toEqual(['b', 'c', 'd', 'tiny']);
        expect(c.unknownMoved).toEqual(['nope']);
    });
    it('refuses a threshold that cannot flag, and a comparison with no reference level', () => {
        expect(() => compareLevels(control, control, { threshold: 1, floorMs: 0 })).toThrow();
        expect(() => compareLevels(control, control, { threshold: 1.5, floorMs: 1e9 })).toThrow();
    });
});
