/**
 * The P3 timing probe's PURE helpers (`seedlingCalibLevels.js`; the probe runs the calib file only in
 * `seedling-probe.yml`): the preset's levels, one run's per-level report out of vitest's JSON, the median, and the
 * normalised tip/control comparison.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bandFails, compareLevels, flagsLevels, isAbbreviatedSha, jobTimeoutMinutes, levelReport, median, medianBand, medianRow, medianVerdict, mergeReports, presetLevels, wallVerdict } from './seedlingCalibLevels.js';

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

describe('medianBand / medianVerdict (the median verdict)', () => {
    const control = side({ a: 10000, b: 20000, c: 40000, d: 80000, e: 160000 });
    const times = (f) => side(Object.fromEntries(control.levels.map((l) => [l.level, Math.round(l.ms * f)])));
    it('folds each pair both ways round: the band is 1 + 2 x the worst excess, and its inverse', () => {
        const b = medianBand([1.05, 0.95]);
        expect(b.worst).toBeCloseTo(1 / 0.95);
        expect(b.hi).toBeCloseTo(1 + 2 * (1 / 0.95 - 1));
        expect(b.lo).toBeCloseTo(1 / b.hi);
        expect(b.pairs).toBe(2);
        expect(() => medianBand([])).toThrow();
        expect(() => medianBand([0])).toThrow();
    });
    it('a uniform x1.24 tip flags no level, and its median is outside a same-runner band: slower', () => {
        const c = compareLevels(times(1.24), control, { threshold: 1.5, floorMs: 1000 });
        expect(c.flagged).toEqual([]); // the blind spot: every level moved together, so none moved against the median
        expect(c.median).toBeCloseTo(1.24, 3);
        const v = medianVerdict(c.median, medianBand([1.03, 0.98, 1.02]));
        expect(v).toMatchObject({ outside: true, direction: 'slower' });
        expect(medianVerdict(1 / 1.24, medianBand([1.03, 0.98, 1.02]))).toMatchObject({ outside: true, direction: 'faster' });
    });
    it('a main-vs-main median inside the band is not outside it', () => {
        const band = medianBand([1.03, 0.98, 1.02]);
        for (const m of [1, 1.03, 0.98, 1 / 1.03]) expect(medianVerdict(m, band)).toMatchObject({ outside: false, direction: 'inside' });
    });
    it('the cross-job band the probe carries is wider than x1.24, so two jobs cannot see it', async () => {
        const { UNPAIRED_MAIN_MEDIANS } = await import('./probe-seedling-calib-levels.mjs');
        const v = medianVerdict(1.24, medianBand(UNPAIRED_MAIN_MEDIANS));
        expect(v.outside).toBe(false);
        expect(v.band.hi).toBeGreaterThan(1.24);
    });
});

describe('mergeReports (an ABBA pass runs each tree twice)', () => {
    const rep = (a, b, st = 'passed') => ({ levels: [{ level: 'a', ms: a, status: 'passed' }, { level: 'b', ms: b, status: st }],
        others: [{ title: 'whole verdict', ms: 2, status: 'passed' }], problems: [] });
    it('takes the mean ms per level, keeps each run, and is red when any run was', () => {
        const m = mergeReports([rep(100, 300), rep(200, 500, 'failed')]);
        expect(m.levels).toEqual([{ level: 'a', ms: 150, status: 'passed', runsMs: [100, 200] }, { level: 'b', ms: 400, status: 'failed', runsMs: [300, 500] }]);
        expect(m.others).toEqual([{ title: 'whole verdict', ms: 2, status: 'passed' }]);
    });
    it('a drift linear in time cancels: A B B A with a steady slowdown reads 1 for equal trees', () => {
        const at = (t) => 1000 * (1 + 0.1 * t); // the runner slows by 10% per pass
        const A = mergeReports([rep(at(0), at(0)), rep(at(3), at(3))]);
        const B = mergeReports([rep(at(1), at(1)), rep(at(2), at(2))]);
        expect(compareLevels(B, A, { threshold: 1.5, floorMs: 1 }).median).toBeCloseTo(1, 6);
    });
    it('refuses runs that list different levels, and no runs', () => {
        expect(() => mergeReports([])).toThrow();
        expect(() => mergeReports([rep(1, 1), { ...rep(1, 1), levels: [{ level: 'z', ms: 1, status: 'passed' }, { level: 'b', ms: 1, status: 'passed' }] }])).toThrow();
    });
});

describe('isAbbreviatedSha (a paired run refuses a short SHA by name)', () => {
    it('is a short hex SHA, and not a full SHA or a branch name', () => {
        expect(isAbbreviatedSha('3c602f965d')).toBe(true);
        expect(isAbbreviatedSha('3c602f965d2db8ef4c12d7d6f8cb96a837500448')).toBe(false);
        expect(isAbbreviatedSha('main')).toBe(false);
        expect(isAbbreviatedSha('tile-probe-median')).toBe(false);
    });
});

describe('the recorded paired bands (the probe\'s PAIRED_MAIN_MEDIANS)', () => {
    it('abba fails rows, concurrent and sequential are PROVISIONAL; each row a run id; the x1.24 mutants are outside, PASS-3 inside', async () => {
        const { PAIRED_MAIN_MEDIANS: P, PAIRED_FAIL_WHEN: W, DEFAULT_PAIRED_ORDER } = await import('./probe-seedling-calib-levels.mjs');
        expect(DEFAULT_PAIRED_ORDER).toBe('concurrent');
        expect(bandFails(P.abba, W.abba).fails).toBe(true);
        expect(bandFails(P.concurrent, W.concurrent)).toEqual({ fails: false, pairs: 5, checkoutTip: 1 });
        expect(bandFails(P.sequential, W.sequential).fails).toBe(false);
        expect(medianBand(P.concurrent.map((r) => r.median)).hi).toBeCloseTo(1 + 2 * (1 / 0.972 - 1), 6); // 45040853937 sets it
        for (const rows of Object.values(P)) for (const r of rows) expect(r.run).toBeGreaterThan(4e10);
        const band = (order) => medianBand(P[order].map((r) => r.median));
        expect(medianVerdict(1.197, band('concurrent')).direction).toBe('slower'); // mutant 44983304303
        expect(medianVerdict(1.240, band('abba')).direction).toBe('slower'); // mutant 44983298644
        expect(medianVerdict(0.991, band('concurrent')).outside).toBe(false); // PASS-3 44983283467
        expect(medianVerdict(0.994, band('abba')).outside).toBe(false); // PASS-3 44983277762
    });
});

describe('flagsLevels (a paired concurrent run judges the median only)', () => {
    it('flags unpaired, abba and sequential; not concurrent', () => {
        expect(flagsLevels(null)).toBe(true);
        expect(flagsLevels({ order: 'abba' })).toBe(true);
        expect(flagsLevels({ order: 'sequential' })).toBe(true);
        expect(flagsLevels({ order: 'concurrent' })).toBe(false);
    });
});

describe('jobTimeoutMinutes / wallVerdict (the paired wall against the job)', () => {
    const wf = readFileSync(new URL('../../.github/workflows/seedling-probe.yml', import.meta.url), 'utf8');
    it('reads the probe job\'s timeout from the workflow, not another job\'s', () => {
        expect(jobTimeoutMinutes(wf, 'probe')).toBe(90);
        expect(jobTimeoutMinutes(wf, 'plan')).toBe(5);
        expect(jobTimeoutMinutes(wf, 'nope')).toBe(null);
        expect(jobTimeoutMinutes('jobs:\n  a:\n    runs-on: x\n  b:\n    timeout-minutes: 7\n', 'a')).toBe(null);
    });
    it('warns over 80%: the x1.24 mutant abba (4753 s) does, a concurrent pass (1173 s) does not', () => {
        expect(wallVerdict(4753, 5400, 0.8)).toMatchObject({ warn: true });
        expect(wallVerdict(1173, 5400, 0.8)).toMatchObject({ warn: false });
        expect(wallVerdict(4320, 5400, 0.8).warn).toBe(false); // exactly 80% is not over it
        expect(() => wallVerdict(1, 0, 0.8)).toThrow();
    });
});

describe('bandFails / medianRow (when a paired band fails, and only above)', () => {
    const rows = (n, ct) => Array.from({ length: n }, (_, i) => ({ median: 1, shape: i < ct ? 'checkout-tip' : 'both-fresh' }));
    it('fails only once the pairs AND the default-shape pairs are enough', () => {
        expect(bandFails(rows(8, 4), { pairs: 8, checkoutTip: 4 }).fails).toBe(true);
        expect(bandFails(rows(8, 3), { pairs: 8, checkoutTip: 4 }).fails).toBe(false);
        expect(bandFails(rows(7, 7), { pairs: 8, checkoutTip: 4 }).fails).toBe(false);
    });
    const band = medianBand([1.03, 0.98, 1.02]);
    it('is one-sided: above fails, below and inside pass', () => {
        expect(medianRow(medianVerdict(1.2, band), 'paired concurrent').ok).toBe(false);
        expect(medianRow(medianVerdict(0.9, band), 'paired concurrent').ok).toBe(true);
        expect(medianRow(medianVerdict(1.0, band), 'paired concurrent').ok).toBe(true);
    });
    it('names the side the median is on (run 45040853937 printed "0.972 is inside" for a value below the band)', () => {
        const b = medianBand([1.001, 0.992, 1.008, 0.994]);
        expect(medianRow(medianVerdict(0.972, b), 'paired concurrent').text).toMatch(/^the median ratio 0\.972 is below the paired concurrent/);
        expect(medianRow(medianVerdict(1.197, b), 'paired concurrent').text).toMatch(/is above the/);
        expect(medianRow(medianVerdict(1.0, b), 'paired concurrent').text).toMatch(/is inside the/);
    });
});
