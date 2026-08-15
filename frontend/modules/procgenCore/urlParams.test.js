/**
 * procgenCore/urlParams + labView — **THE GRAMMAR BOTH LAB PAGES SPEAK**,
 * tested where it lives.
 *
 * CONSTRUCTIVE-MODE arc, slice 3. ⛔ These rows are deliberately SUBSTRATE-FREE:
 * the palettes below are hand-built objects of the shape
 * `templateContract.defineTemplate` produces, not `PRE_SWORD_PALETTE` and not
 * `MAZE_PALETTE`. A shared module tested only through one of its two callers is
 * a shared module with one caller and a re-export.
 *
 * ⚠ The per-page behaviour is gated by `seedlingDemo/watchGenerate.test.js` and
 * `mazeRoom/mazeLab.test.js`; this file gates the parts NEITHER page can see —
 * the two substrates' differing seed orbits, and the delete-then-set ordering
 * that only a second writer would have re-broken.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_BOUNDS, KEEP_POLICY, KEPT_KIND } from './levelGenerator.js';
import {
    ANCHOR_SALT, PARAM_SALT, UrlParamsError, directiveSeed, formatDirectives, intParam,
    parseDirective, parseDirectives, readBounds, readRosterSpec, stepFromParams, writeBounds,
    writeDirectedParam, writeInt, writeRosterParam, writeRunFlag,
} from './urlParams.js';
import {
    LabViewError, describeKeptKind, directedCost, generationRows, ladderCost, tileAtPoint,
} from './labView.js';

/** A palette of the shape both bindings produce, owned by neither. */
const PALETTE = Object.freeze({
    name: 'test-palette',
    templates: Object.freeze([
        Object.freeze({
            name: 'block',
            family: 'wall',
            params: Object.freeze([
                { key: 'ori', domain: ['h', 'v'] },
                { key: 'len', domain: [1, 2, 3] },
            ]),
        }),
        Object.freeze({ name: 'bare', family: 'none', params: Object.freeze([]) }),
    ]),
});

const q = (s) => new URLSearchParams(s);

describe('urlParams — integers and bounds', () => {
    it('absent and EMPTY both mean "not given"; a present non-integer REFUSES', () => {
        expect(intParam(q(''), 'count', 6)).toBe(6);
        expect(intParam(q('?count='), 'count', 6)).toBe(6);
        expect(intParam(q('?count=3'), 'count', 6)).toBe(3);
        expect(() => intParam(q('?count=2.5'), 'count', 6)).toThrow(UrlParamsError);
        expect(() => intParam(q('?count=2.5'), 'count', 6))
            .toThrow(/no value that means "whatever"/);
    });

    it('readBounds spells the four the loop runs under, and defaults each', () => {
        expect(readBounds(q(''))).toEqual(DEFAULT_BOUNDS);
        expect(readBounds(q('?count=5&tries=4&k=2&anchortries=3'))).toEqual({
            obstacleTarget: 5, triesPerStep: 4, saturationK: 2, anchorTriesPerCandidate: 3,
        });
    });

    it('⛔ the WRITER refuses what the reader would refuse', () => {
        expect(() => writeInt(q(''), 'seed', 1.5)).toThrow(/cannot write \?seed=1\.5/);
        expect(() => writeBounds(q(''), { ...DEFAULT_BOUNDS, saturationK: 'lots' }))
            .toThrow(/cannot write \?k="lots"/);
    });

    it('⛓ writeBounds carries ALL FOUR — including anchortries', () => {
        // ⛔ Named, because a writer that dropped one and a reader that
        // defaulted it would round-trip perfectly and generate a different
        // level. This is the row the slice's mutant (b) reddens.
        const s = writeBounds(q(''), {
            obstacleTarget: 5, triesPerStep: 4, saturationK: 2, anchorTriesPerCandidate: 3,
        }).toString();
        for (const k of ['count=5', 'tries=4', 'k=2', 'anchortries=3']) {
            expect(s, k).toContain(k);
        }
        expect(readBounds(q(s)).anchorTriesPerCandidate).toBe(3);
    });
});

describe('urlParams — the roster grammar', () => {
    it('absent is the WHOLE roster; either axis reads; BOTH refuse; EMPTY refuses', () => {
        expect(readRosterSpec(q(''))).toBe(null);
        expect(readRosterSpec(q('?families=a,b'))).toEqual({ axis: 'families', names: ['a', 'b'] });
        expect(readRosterSpec(q('?templates=x'))).toEqual({ axis: 'templates', names: ['x'] });
        expect(() => readRosterSpec(q('?families=a&templates=x')))
            .toThrow(/BOTH present.*two spellings of one setting/s);
        expect(() => readRosterSpec(q('?families='))).toThrow(/names nothing/);
        expect(() => readRosterSpec(q('?templates=,, '))).toThrow(/names nothing/);
    });

    it('⛔ it does NOT validate the members — that needs a palette, and a palette is '
        + 'the caller\'s biome', () => {
        expect(readRosterSpec(q('?families=nonsense')))
            .toEqual({ axis: 'families', names: ['nonsense'] });
    });

    it('⛓⛓ the writer\'s delete is SCOPED TO THE OTHER AXIS — the fixed point forced it', () => {
        /**
         * ⛔ A `delete` then a `set` of the SAME key APPENDS it, so blanket
         * deleting both spellings rewrote `…&families=…&run=1` into
         * `…&run=1&families=…` on the second load: the string moved while the
         * run did not. Asserted on the ORDER, which is the only thing that
         * showed it.
         */
        const first = writeRosterParam(q('?families=a&run=1'),
            { axis: 'families', names: ['a'] }).toString();
        expect(first).toBe('families=a&run=1');
        const second = writeRosterParam(q(first), { axis: 'families', names: ['a'] }).toString();
        expect(second).toBe(first);
        // switching axis drops the other one
        expect(writeRosterParam(q('?families=a&run=1'),
            { axis: 'templates', names: ['x'] }).toString()).toBe('run=1&templates=x');
        // no restriction deletes both
        expect(writeRosterParam(q('?families=a&run=1'), null).toString()).toBe('run=1');
    });
});

describe('urlParams — the run/count step encoding', () => {
    it('`run ? count : 0` is the ONE reader of which step a link names', () => {
        expect(stepFromParams({ run: true, bounds: { obstacleTarget: 6 } })).toBe(6);
        // ⚠ At step 0 nothing overrides `count`, so a skeleton's URL carries the
        // FORM's target beside no `run` — and the step is 0, not the target.
        expect(stepFromParams({ run: false, bounds: { obstacleTarget: 6 } })).toBe(0);
        expect(stepFromParams(null)).toBe(0);
    });

    it('⛔ run is DELETED at step 0, never written run=0', () => {
        expect(writeRunFlag(q('?run=1'), 0).toString()).toBe('');
        expect(writeRunFlag(q(''), 3).toString()).toBe('run=1');
        expect(() => writeRunFlag(q(''), 1.5)).toThrow(/must be a non-negative integer/);
    });
});

describe('urlParams — the directive grammar', () => {
    it('parses the instance label, the bound and the policy letter', () => {
        expect(parseDirective('block(ori=v,len=3)@12d', PALETTE)).toEqual({
            template: 'block',
            params: { ori: 'v', len: 3 },
            anchor: null,
            keepPolicy: KEEP_POLICY.PREFER_DISCHARGE,
            bound: 12,
        });
        expect(parseDirective('bare@4s', PALETTE)).toMatchObject({
            template: 'bare', params: {}, keepPolicy: KEEP_POLICY.FIRST_SOLVED, bound: 4,
        });
    });

    it('⚠ the VALUE\'s type comes from the SCHEMA, not from the text', () => {
        const d = parseDirective('block(ori=h,len=2)@1d', PALETTE);
        expect(d.params.len).toBe(2);
        expect(typeof d.params.len).toBe('number');
        expect(typeof d.params.ori).toBe('string');
    });

    it('⛔ four different mistakes, four different refusals, each naming what was on offer', () => {
        expect(() => parseDirective('nope@12d', PALETTE)).toThrow(/does not hold — it offers/);
        expect(() => parseDirective('block(orient=v)@12d', PALETTE))
            .toThrow(/has no parameter "orient" — it declares \[ori, len\]/);
        expect(() => parseDirective('block(ori=q)@12d', PALETTE))
            .toThrow(/not in its declared domain \[h, v\]/);
        expect(() => parseDirective('block@12x', PALETTE)).toThrow(/is not a directive/);
        expect(() => parseDirective('block(ori=h,ori=v)@12d', PALETTE))
            .toThrow(/names parameter "ori" twice/);
        expect(() => parseDirectives('', PALETTE)).toThrow(/names nothing/);
    });

    it('⛓ an EXPLICIT anchor is a walk of ONE cell, and any other bound refuses', () => {
        expect(parseDirective('bare@1d!3,4', PALETTE).anchor).toEqual({ tx: 3, ty: 4 });
        expect(() => parseDirective('bare@12d!3,4', PALETTE))
            .toThrow(/explicit cell is a walk of ONE cell/);
    });

    it('⛔ formatDirectives writes in SCHEMA ORDER, so the fixed point holds', () => {
        // params inserted in the WRONG order on purpose
        const d = { template: 'block', params: { len: 3, ori: 'v' }, anchor: null,
            keepPolicy: KEEP_POLICY.PREFER_DISCHARGE, bound: 12 };
        expect(formatDirectives([d], PALETTE)).toBe('block(ori=v,len=3)@12d');
        expect(parseDirective(formatDirectives([d], PALETTE), PALETTE).params)
            .toEqual({ ori: 'v', len: 3 });
    });

    it('⛔ the writer refuses a missing value rather than filling the default', () => {
        expect(() => formatDirectives([{ template: 'block', params: { ori: 'v' }, bound: 1,
            keepPolicy: KEEP_POLICY.FIRST_SOLVED }], PALETTE))
            .toThrow(/carries no value for "len"/);
        expect(() => formatDirectives([{ template: 'block', params: { ori: 'v', len: 9 },
            bound: 1, keepPolicy: KEEP_POLICY.FIRST_SOLVED }], PALETTE))
            .toThrow(/outside its declared domain/);
        expect(() => formatDirectives([{ template: 'gone', params: {}, bound: 1,
            keepPolicy: KEEP_POLICY.FIRST_SOLVED }], PALETTE)).toThrow(/does not hold it/);
    });

    it('⚠ ?directed= is DELETED when there are none, never written empty', () => {
        expect(writeDirectedParam(q('?directed=bare@1d'), [], PALETTE).toString()).toBe('');
        expect(writeDirectedParam(q(''), null, PALETTE).toString()).toBe('');
    });
});

describe('urlParams — directiveSeed and the two substrates\' seed orbits', () => {
    const SEEDLING_MAX = 2147483646;
    const MAZE_MAX = 2147483647;

    it('⛔ it REFUSES without the source\'s own seedMax — a constant here would be one '
        + 'generator\'s fact imposed on the other', () => {
        expect(() => directiveSeed(1, 0, PARAM_SALT)).toThrow(UrlParamsError);
        expect(() => directiveSeed(1, 0, PARAM_SALT)).toThrow(/needs the RNG source's own seedMax/);
        expect(() => directiveSeed(1, 0, PARAM_SALT, 1)).toThrow(/seedMax/);
    });

    it('lands inside BOTH orbits — 0 is illegal in Seedling and legal in the maze', () => {
        for (const max of [SEEDLING_MAX, MAZE_MAX]) {
            for (let i = 0; i < 40; i += 1) {
                const s = directiveSeed(i * 7 + 1, i, PARAM_SALT, max);
                expect(s).toBeGreaterThanOrEqual(1);
                expect(s).toBeLessThanOrEqual(max);
            }
        }
    });

    it('⚠ the two SALTS and the INDEX are all in the mix — three different questions', () => {
        const a = directiveSeed(5, 0, PARAM_SALT, MAZE_MAX);
        expect(directiveSeed(5, 0, ANCHOR_SALT, MAZE_MAX)).not.toBe(a);
        expect(directiveSeed(5, 1, PARAM_SALT, MAZE_MAX)).not.toBe(a);
        expect(directiveSeed(6, 0, PARAM_SALT, MAZE_MAX)).not.toBe(a);
        // deterministic
        expect(directiveSeed(5, 0, PARAM_SALT, MAZE_MAX)).toBe(a);
    });
});

describe('labView — the pane vocabulary', () => {
    it('generationRows labels a ladder row, a skeleton row and a DIRECTIVE row differently', () => {
        const rows = generationRows([
            { step: 0, try: null, outcome: 'KEPT', family: 'skeleton' },
            { step: 1, try: 2, anchorTry: 3, outcome: 'REVERTED', family: 'wall',
                instance: 'block(ori=v)', reasonText: 'nope', classifiedBy: 'the solver' },
            { step: 3, try: null, directive: 2, anchorTry: 1, outcome: 'KEPT', family: 'door' },
        ]);
        expect(rows.map((r) => r.label)).toEqual(['(skeleton)', '1.2a3', 'd2a1']);
        // ⛔ VERBATIM, and as two separate fields.
        expect(rows[1].reasonText).toBe('nope');
        expect(rows[1].classifiedBy).toBe('the solver');
        expect(rows[1].instance).toBe('block(ori=v)');
    });

    it('⛔ describeKeptKind prints the THIRD case by name, and `null` is a fourth answer', () => {
        const k = (keptKind, anchor = null) => describeKeptKind({ outcome: 'KEPT', keptKind, anchor });
        expect(k(KEPT_KIND.DISCHARGED)).toMatch(/kept:discharged/);
        expect(k(KEPT_KIND.SOLVED_ONLY)).toMatch(/no anchor within the bound/);
        expect(k(KEPT_KIND.SOLVED_ONLY, { tx: 1, ty: 1 })).toMatch(/MOOT here/);
        expect(k(KEPT_KIND.NO_VERB)).toMatch(/NO verb to discharge/);
        expect(k(null)).toMatch(/the keep policy was first-SOLVED/);
        expect(describeKeptKind({ outcome: 'REVERTED' })).toBe('');
    });

    it('ladderCost is the O(N²) sum and it SAYS so; directedCost is bound+1', () => {
        const c = ladderCost({ obstacleTarget: 3, triesPerStep: 2, saturationK: 3,
            anchorTriesPerCandidate: 2 }, 3);
        // sum over k=1..3 of (1 + k*2*2) = 5 + 9 + 13 = 27, plus 4 display solves
        expect(c.loopSolves).toBe(27);
        expect(c.displaySolves).toBe(4);
        expect(c.solves).toBe(31);
        expect(c.worstCaseTotalMs).toBe(93);
        expect(c.why).toMatch(/obstacleTarget = k, re-run/);
        expect(directedCost(12, 3)).toMatchObject({ loopSolves: 12, solves: 13,
            worstCaseTotalMs: 39 });
        expect(() => directedCost(0, 3)).toThrow(LabViewError);
    });

    it('⛓ tileAtPoint: the LAST pixel of tile k is tile k, the first of k+1 is k+1', () => {
        const box = { width: 200, height: 200, cols: 10, rows: 10 };
        // 200px / 10 cols = 20px a tile, so tile 0 is px 0..19 and tile 1 is 20..39.
        expect(tileAtPoint({ ...box, x: 19, y: 0 })).toEqual({ tx: 0, ty: 0 });
        expect(tileAtPoint({ ...box, x: 20, y: 0 })).toEqual({ tx: 1, ty: 0 });
        expect(tileAtPoint({ ...box, x: 39, y: 0 })).toEqual({ tx: 1, ty: 0 });
        expect(tileAtPoint({ ...box, x: 0, y: 199 })).toEqual({ tx: 0, ty: 9 });
        // ⛔ a CSS size that is not the intrinsic one still names the right cell
        expect(tileAtPoint({ width: 333, height: 333, cols: 10, rows: 10, x: 332, y: 0 }))
            .toEqual({ tx: 9, ty: 0 });
    });

    it('⚠ an out-of-range point REFUSES rather than clamping to the last cell', () => {
        const box = { width: 200, height: 200, cols: 10, rows: 10 };
        expect(() => tileAtPoint({ ...box, x: 200, y: 0 })).toThrow(/outside a 10x10 room/);
        expect(() => tileAtPoint({ ...box, x: -1, y: 0 })).toThrow(/outside a 10x10 room/);
        expect(() => tileAtPoint({ ...box, x: 0, y: NaN })).toThrow(/finite point/);
        expect(() => tileAtPoint({ ...box, width: 0, x: 0, y: 0 })).toThrow(/positive canvas width/);
        expect(() => tileAtPoint({ ...box, cols: 0, x: 0, y: 0 })).toThrow(/positive integer cols/);
    });
});
