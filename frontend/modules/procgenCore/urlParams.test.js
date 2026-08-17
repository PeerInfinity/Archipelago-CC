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
    ANCHOR_SALT, PARAM_SALT, UrlParamsError, directiveSeed, dropDirectedParam, formatDirectives,
    intParam, parseDirective, parseDirectives, readAreas, readBounds, readElements, readRequire,
    readRosterSpec, readSkeleton, refuseDirectedParam, stepFromParams, writeAreasParam,
    writeBounds, writeElementsParam, writeInt, writeRequireParam, writeRosterParam, writeRunFlag,
    writeSkeletonParam,
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

    /**
     * ⛓⛓⛓ CONSTRUCTIVE SLICE 12 — THE ROUND-TRIP ROWS BECAME REFUSAL ROWS.
     *
     * ⚖ §3.9 retired `?directed=` as a URL parameter. What was *"the writer
     * deletes it when there are none"* is now *"the reader refuses it and the
     * writer never emits it"* — the claim REPLACED, not relaxed (trap 62/199).
     * The GRAMMAR rows above stay exactly as they were: they test the parser
     * the two CLIs and the payload labels still speak.
     */
    it('⛔ ?directed= REFUSES BY NAME, and the refusal names the way in', () => {
        expect(() => refuseDirectedParam(q('?directed=block(ori=v,len=2)@12d')))
            .toThrow(UrlParamsError);
        expect(() => refuseDirectedParam(q('?directed=block(ori=v,len=2)@12d')))
            .toThrow(/no longer a URL parameter/);
        // ⛔ the way IN is in the sentence — an old link has no other channel.
        expect(() => refuseDirectedParam(q('?directed=x@1d')))
            .toThrow(/directives ride the PAYLOAD/);
        expect(() => refuseDirectedParam(q('?directed=x@1d'), { substrate: 'the maze lab page' }))
            .toThrow(/the maze lab page/);
        // ⚠ PRESENCE is the whole test — there is no value of a retired key.
        expect(() => refuseDirectedParam(q('?directed='))).toThrow(/no longer a URL parameter/);
        // …and a bar without it passes through untouched.
        expect(refuseDirectedParam(q('?seed=3')).toString()).toBe('seed=3');
    });

    it('⛔ the WRITER never emits ?directed=, and DELETES one it inherited', () => {
        expect(dropDirectedParam(q('?directed=bare@1d')).toString()).toBe('');
        expect(dropDirectedParam(q('?seed=3&directed=bare@1d&run=1')).toString())
            .toBe('seed=3&run=1');
        expect(dropDirectedParam(q('?seed=3')).toString()).toBe('seed=3');
    });

    /**
     * ⛔⛔ THE PAIR IS THE POINT: what the writer can produce, the reader can
     * read. A build whose writer emitted the key again would write a bar its
     * own reader REFUSES — the one case where a fixed point is the right gate,
     * because it reddens ITSELF rather than agreeing with itself (trap 250's
     * inverse).
     */
    it('⛓ writer-then-reader is total over a bar carrying a stale directive', () => {
        const bar = dropDirectedParam(q('?source=generate&seed=3&directed=bare@1d&run=1'));
        expect(() => refuseDirectedParam(bar)).not.toThrow();
        expect(bar.toString()).toBe('source=generate&seed=3&run=1');
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

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ `?skeleton=` — CONSTRUCTIVE-MODE SLICE 5
 * ══════════════════════════════════════════════════════════════════════ */

describe('urlParams — ?skeleton=', () => {
    const q = (search) => new URLSearchParams(search);

    /**
     * ⛔ EVERY VALUE IS CHECKED AGAINST A LITERAL THIS FILE STATES, never
     * against a round trip: a fixed point tests SELF-CONSISTENCY and never
     * correctness (⚖ kickoff §5, GENERATE-UI's first carried finding). A
     * reader/writer pair that both said `windy` would round-trip perfectly.
     */
    it('reads the DEFAULT from an absent parameter, and a named kind literally', () => {
        expect(readSkeleton(q(''))).toEqual({ kind: 'empty' });
        expect(readSkeleton(q('seed=3'))).toEqual({ kind: 'empty' });
        expect(readSkeleton(q('skeleton='))).toEqual({ kind: 'empty' });
        expect(readSkeleton(q('skeleton=winding'))).toEqual({ kind: 'winding' });
        expect(readSkeleton(q('skeleton=ROOMS'))).toEqual({ kind: 'rooms' });
        expect(readSkeleton(q('skeleton= branchy '))).toEqual({ kind: 'branchy' });
    });

    it('REFUSES an unknown kind, naming the parameter AND the vocabulary', () => {
        expect(() => readSkeleton(q('skeleton=spiral')))
            .toThrow(/\?skeleton="spiral".*is not a skeleton kind.*empty, classic, corridor/s);
    });

    /**
     * ⛓ THE OFFER IS THE READER'S BUSINESS, so a Seedling link naming a
     * maze-only kind dies at READ time — before any generation and before the
     * page draws anything — with the list this page can actually build.
     */
    it('REFUSES a kind this binding cannot run, and accepts it for one that can', () => {
        expect(() => readSkeleton(q('skeleton=corridor'),
            { simulator: false, substrate: 'the Seedling page' }))
            .toThrow(/\?skeleton="corridor".*needs the maze simulator.*the Seedling page offers/s);
        expect(readSkeleton(q('skeleton=corridor'), { simulator: true }))
            .toEqual({ kind: 'corridor' });
    });

    /* ══════════════════════════════════════════════════════════════════
     * ⛓⛓⛓ SLICE 7 — THE `;` CLAUSE, THE SPELLING ⚖ OPEN QUESTION 5 RESERVED
     * ══════════════════════════════════════════════════════════════════
     *
     * ⛔ EVERY ONE OF THESE IS AN INDEPENDENT LITERAL — the expected OBJECT is
     * written out on the read side and the expected STRING on the write side,
     * and the round trip is asserted only after both. A reader/writer pair that
     * agreed on `minRoom` meaning "chambers" would satisfy a fixed point
     * perfectly.
     */
    it('READS a parameter clause to the expected OBJECT, typed from the domain', () => {
        expect(readSkeleton(q('skeleton=rooms;minRoom=2')))
            .toEqual({ kind: 'rooms', params: { minRoom: 2 } });
        expect(readSkeleton(q('skeleton=rooms;minRoom=2;chambers=1')))
            .toEqual({ kind: 'rooms', params: { minRoom: 2, chambers: 1 } });
        expect(readSkeleton(q('skeleton=winding;chambers=3')))
            .toEqual({ kind: 'winding', params: { chambers: 3 } });
        expect(readSkeleton(q('skeleton=bushy;prune=1')))
            .toEqual({ kind: 'bushy', params: { prune: 1 } });
        // ⛔ THE VALUE IS THE DOMAIN'S OWN TYPED MEMBER, never the string.
        expect(typeof readSkeleton(q('skeleton=rooms;minRoom=2')).params.minRoom)
            .toBe('number');
        // ⛔ A value AT its default is not carried — the default is absence, so
        // one room has exactly one spelling on both sides.
        expect(readSkeleton(q('skeleton=rooms;minRoom=3'))).toEqual({ kind: 'rooms' });
        expect(readSkeleton(q('skeleton=winding;chambers=0'))).toEqual({ kind: 'winding' });
    });

    it('WRITES the expected LITERAL string, keys in DECLARATION order', () => {
        expect(writeSkeletonParam(q('seed=3'),
            { kind: 'rooms', params: { minRoom: 2, chambers: 1 } }).toString())
            .toBe('seed=3&skeleton=rooms%3BminRoom%3D2%3Bchambers%3D1');
        // ⛓ DECLARATION order, not the caller's: `chambers` is declared LAST.
        expect(writeSkeletonParam(q(''),
            { kind: 'rooms', params: { chambers: 1, minRoom: 2 } }).get('skeleton'))
            .toBe('rooms;minRoom=2;chambers=1');
        // ⛔ A default value is DROPPED from the string, not written.
        expect(writeSkeletonParam(q(''),
            { kind: 'rooms', params: { minRoom: 3, chambers: 2 } }).get('skeleton'))
            .toBe('rooms;chambers=2');
        expect(writeSkeletonParam(q(''), { kind: 'rooms', params: { minRoom: 3 } })
            .get('skeleton')).toBe('rooms');
        // ⛔ …and an all-default set on the DEFAULT KIND still DELETES.
        expect(writeSkeletonParam(q('skeleton=rooms&run=1'), { kind: 'empty' }).toString())
            .toBe('run=1');
    });

    it('the round trip is a FIXED POINT — asserted only after the two literals', () => {
        for (const value of ['rooms;minRoom=2;chambers=1', 'winding;chambers=3',
            'bushy;prune=1', 'branchy', 'rooms;chambers=2']) {
            const read = readSkeleton(q(`skeleton=${encodeURIComponent(value)}`),
                { simulator: true });
            expect(writeSkeletonParam(q(''), read, { simulator: true }).get('skeleton'))
                .toBe(value);
        }
    });

    /**
     * ⛔ FIVE DISTINGUISHED REFUSALS — a reader can act on each one, and each
     * names what WAS declared rather than saying the clause is wrong.
     */
    it('REFUSES an undeclared key, an out-of-domain value, and a malformed clause', () => {
        expect(() => readSkeleton(q('skeleton=rooms;minRoom=5')))
            .toThrow(/parameter "minRoom" was given "5".*declared domain \[2, 3, 4\]/s);
        expect(() => readSkeleton(q('skeleton=branchy;minRoom=2')))
            .toThrow(/"branchy" has no parameter "minRoom".*It declares \[chambers\]/s);
        expect(() => readSkeleton(q('skeleton=empty;chambers=1')))
            .toThrow(/"empty" has no parameter "chambers".*declares NO parameters/s);
        expect(() => readSkeleton(q('skeleton=rooms;minRoom')))
            .toThrow(/is not `key=value`/);
        expect(() => readSkeleton(q('skeleton=rooms;;chambers=1')))
            .toThrow(/EMPTY parameter clause/);
        expect(() => readSkeleton(q('skeleton=rooms;chambers=1;chambers=2')))
            .toThrow(/names "chambers" TWICE/);
        // ⛔ …and every one of them still names the PARAMETER it arrived on.
        expect(() => readSkeleton(q('skeleton=rooms;minRoom=5')))
            .toThrow(/\?skeleton="rooms;minRoom=5"/);
    });

    it('writes the LITERAL value, and DELETES the parameter at the default', () => {
        expect(writeSkeletonParam(q('seed=3'), { kind: 'winding' }).toString())
            .toBe('seed=3&skeleton=winding');
        expect(writeSkeletonParam(q('seed=3&skeleton=winding'), { kind: 'empty' }).toString())
            .toBe('seed=3');
        expect(writeSkeletonParam(q('seed=3'), undefined).toString()).toBe('seed=3');
    });

    /**
     * ⛓⛓ THE DELETE-THEN-SET ORDERING TRAP, one parameter over. `set` keeps an
     * existing key's POSITION and a deleted key has none, so a writer that
     * deleted first would move `?skeleton=` to the end of the bar on every
     * rewrite — the string drifting while the run does not, which is exactly
     * what the pages' fixed points exist to catch (GENERATE-UI slice 4 paid for
     * this once on `?families=`).
     */
    it('REWRITES in place — a kind change does not move the parameter to the end', () => {
        expect(writeSkeletonParam(q('skeleton=rooms&run=1'), { kind: 'winding' }).toString())
            .toBe('skeleton=winding&run=1');
    });

    /** ⛔ §8.6's standing law: the writer refuses what the reader would refuse. */
    it('REFUSES on the way OUT what it would refuse on the way in', () => {
        expect(() => writeSkeletonParam(q(''), { kind: 'spiral' }))
            .toThrow(/is not a skeleton kind/);
        expect(() => writeSkeletonParam(q(''), { kind: 'corridor' }, { simulator: false }))
            .toThrow(/needs the maze simulator/);
        // ⛓ SLICE 7 — and the PARAMETERS too, on the same terms.
        expect(() => writeSkeletonParam(q(''), { kind: 'rooms', params: { minRoom: 9 } }))
            .toThrow(/not in its declared domain \[2, 3, 4\]/);
        expect(() => writeSkeletonParam(q(''), { kind: 'branchy', params: { prune: 1 } }))
            .toThrow(/"branchy" has no parameter "prune"/);
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ `?areas=` AND `?require=` — PROCGEN ELEMENTS ARC 1, SLICE 3
 * ══════════════════════════════════════════════════════════════════════ */

describe('urlParams — ?areas= and ?require=', () => {
    const q = (search) => new URLSearchParams(search);

    /**
     * ⛔ EVERY VALUE AGAINST A LITERAL THIS FILE STATES, and the fixed point
     * only AFTER them (trap 250): a reader/writer pair that both said `areas=9`
     * would round-trip perfectly and mean nothing.
     */
    it('reads the DEFAULT from an absent parameter, and a spec literally', () => {
        expect(readAreas(q(''))).toEqual({ keys: 0 });
        expect(readAreas(q('seed=3'))).toEqual({ keys: 0 });
        expect(readAreas(q('areas='))).toEqual({ keys: 0 });
        expect(readAreas(q('areas=1'))).toEqual({ keys: 1 });
        expect(readAreas(q('areas=2;graphify=0.5'))).toEqual({ keys: 2, params: { graphify: 0.5 } });
        expect(readAreas(q('areas=1;goalShortcut=0')))
            .toEqual({ keys: 1, params: { goalShortcut: 0 } });
        // ⛓ A value at its DEFAULT normalizes AWAY, so one graph has one spelling.
        expect(readAreas(q('areas=2;graphify=0.2'))).toEqual({ keys: 2 });
        // ⛔ TYPED FROM THE DOMAIN — the number 0.5, never the string.
        expect(typeof readAreas(q('areas=2;graphify=0.5')).params.graphify).toBe('number');
    });

    it('WRITES the expected LITERAL string and DELETES at the default', () => {
        expect(writeAreasParam(q('seed=3'), { keys: 2, params: { graphify: 0.5 } }).toString())
            .toBe('seed=3&areas=2%3Bgraphify%3D0.5');
        expect(writeAreasParam(q(''), { keys: 1 }).get('areas')).toBe('1');
        // ⛔ a parameter at its default is DROPPED from the string, not written
        expect(writeAreasParam(q(''), { keys: 1, params: { graphify: 0.2 } }).get('areas'))
            .toBe('1');
        // ⛔ …and the DEFAULT SPEC deletes the parameter rather than writing `areas=0`
        expect(writeAreasParam(q('areas=2&run=1'), { keys: 0 }).toString()).toBe('run=1');
        expect(writeAreasParam(q('areas=2&run=1'), null).toString()).toBe('run=1');
    });

    /**
     * ⛔ TRAP 245, DRIVEN DIRECTLY: a `delete` followed by a `set` APPENDS the
     * key. A writer that did that would move `?areas=` to the end of the bar on
     * every press and the fixed point below would break on the SECOND load.
     */
    it('REWRITES in place — a spec change does not move the parameter to the end', () => {
        expect(writeAreasParam(q('areas=1&run=1'), { keys: 2 }).toString())
            .toBe('areas=2&run=1');
        expect(writeRequireParam(q('require=K0&run=1'), ['K1']).toString())
            .toBe('require=K1&run=1');
    });

    it('the round trip is a FIXED POINT — asserted only after the two literals', () => {
        for (const value of ['1', '2', '3', '2;graphify=0.5', '1;goalShortcut=0',
            '2;graphify=1;goalShortcut=0']) {
            expect(writeAreasParam(q(''), readAreas(q(`areas=${encodeURIComponent(value)}`)))
                .get('areas')).toBe(value);
        }
        for (const value of ['K0', 'K0,K1', 'K1,K0']) {
            expect(writeRequireParam(q(''), readRequire(q(`require=${value}`))).get('require'))
                .toBe(value);
        }
    });

    it('REFUSES a bad spec BY NAME, with the parameter in front of the codec\'s words', () => {
        expect(() => readAreas(q('areas=9')))
            .toThrow(/\?areas="9".*the head of an area spec is the KEY COUNT.*\[0, 1, 2, 3\]/s);
        expect(() => readAreas(q('areas=1;partition=grid')))
            .toThrow(/\?areas=.*parameter "partition".*AREA CENSUS did not trigger/s);
        expect(() => readAreas(q('areas=1;graphify=0.7')))
            .toThrow(/declared domain \[0, 0.2, 0.5, 1\]/);
        expect(() => readAreas(q('areas=1;nope=2'))).toThrow(/has no parameter "nope"/);
    });

    /** ⛓ THE DIRECTIVE — absence is `null`, and an EMPTY value is a REFUSAL. */
    it('reads ?require= as a LIST in the caller\'s own order, absent as null', () => {
        expect(readRequire(q(''))).toBe(null);
        expect(readRequire(q('seed=3'))).toBe(null);
        expect(readRequire(q('require=K0'))).toEqual(['K0']);
        expect(readRequire(q('require=K0,K1'))).toEqual(['K0', 'K1']);
        // ⛔ ORDER IS THE CALLER'S — a directive is a list of things that must
        // hold, not a set to normalize (the `?families=` sort is the other
        // choice, made there because a roster really is a set).
        expect(readRequire(q('require=K1,K0'))).toEqual(['K1', 'K0']);
        expect(readRequire(q('require= K0 , K1 '))).toEqual(['K0', 'K1']);
    });

    it('REFUSES an empty list, an empty entry, a duplicate and a non-symbol', () => {
        expect(() => readRequire(q('require='))).toThrow(/an EMPTY `require` list/);
        expect(() => readRequire(q('require=K0,'))).toThrow(/carries an EMPTY entry/);
        expect(() => readRequire(q('require=K0,K0'))).toThrow(/names "K0" TWICE/);
        expect(() => readRequire(q('require=key_red')))
            .toThrow(/"key_red" is not an area-graph symbol/);
        expect(() => readRequire(q('require=K'))).toThrow(/is not an area-graph symbol/);
    });

    /** ⛔ §8.6's standing law: the writer refuses what the reader would refuse. */
    it('REFUSES on the way OUT what it would refuse on the way in', () => {
        expect(() => writeAreasParam(q(''), { keys: 9 })).toThrow(/declared domain \[0, 1, 2, 3\]/);
        expect(() => writeAreasParam(q(''), { keys: 1, params: { partition: 'grid' } }))
            .toThrow(/AREA CENSUS did not trigger/);
        expect(() => writeRequireParam(q(''), ['K0', 'K0'])).toThrow(/names "K0" TWICE/);
        expect(() => writeRequireParam(q(''), ['hasSword']))
            .toThrow(/is not an area-graph symbol/);
        // ⛓ …and NO directive deletes rather than writing an empty value.
        expect(writeRequireParam(q('require=K0&run=1'), null).toString()).toBe('run=1');
        expect(writeRequireParam(q('require=K0&run=1'), []).toString()).toBe('run=1');
    });

    /**
     * ⛓⛓⛓ **THE SEEDLING PAGE MUST IGNORE-AND-PRESERVE AN UNKNOWN `?areas=`.**
     *
     * Seedling does not read the area graph (arc 3 does), and a hosted navigate
     * that STRIPPED the parameter would hand back a link that no longer names
     * the run it came from. `writeGenerateParams` is a COPY-THE-REST writer —
     * `const q = new URLSearchParams(search)` followed by sets and deletes of
     * the keys it owns — so preservation is structural; what is driven here is
     * the composition of the SHARED writers it is built from, over a bar
     * carrying both new parameters.
     *
     * ⛔ Nothing under `seedlingDemo/` was touched by this slice, so this is
     * where the claim can live without one arc's test file landing in another
     * arc's diff.
     */
    it('the SHARED writers PRESERVE an ?areas=/?require= they do not own', () => {
        const bar = q('source=generate&seed=3&areas=2%3Bgraphify%3D0.5&require=K0,K1&biome=x');
        writeBounds(bar, DEFAULT_BOUNDS);
        writeSkeletonParam(bar, { kind: 'winding' });
        writeRosterParam(bar, null);
        dropDirectedParam(bar);
        writeRunFlag(bar, 0);
        expect(bar.get('areas')).toBe('2;graphify=0.5');
        expect(bar.get('require')).toBe('K0,K1');
    });
});

/* ══════════════════════════════════════════════════════════════════════
 * ⛓⛓⛓ `?elements=` — PROCGEN ELEMENTS ARC 2, SLICE 4
 * ══════════════════════════════════════════════════════════════════════ */

describe('urlParams — ?elements=', () => {
    /**
     * ⛔ **LITERAL EXPECTED VALUES, STATED HERE** (trap 250). The round trip
     * below is a FIXED POINT and tests self-consistency only; a reader/writer
     * pair that both said `elements=guard;len=9` would satisfy it perfectly. So
     * every string is typed out and only THEN composed.
     */
    it('reads ?elements= through the ONE codec — absent and empty are `none`', () => {
        expect(readElements(q(''))).toEqual({ name: 'none' });
        expect(readElements(q('elements='))).toEqual({ name: 'none' });
        expect(readElements(q('elements=none'))).toEqual({ name: 'none' });
        expect(readElements(q('elements=guard'))).toEqual({ name: 'guard' });
        expect(readElements(q('elements=guard%3Blen%3D4')))
            .toEqual({ name: 'guard', params: { len: 4 } });
        expect(readElements(q('elements=guard%3Blen%3D2%3Bturns%3D1%3Bbinds%3Dany')))
            .toEqual({ name: 'guard', params: { len: 2, turns: 1, binds: 'any' } });
        // ⛓ TYPED FROM THE DOMAIN — the number 4, never the string "4".
        expect(typeof readElements(q('elements=guard%3Blen%3D4')).params.len).toBe('number');
    });

    /**
     * ⛓⛓⛓ **A PARAMETER AT ITS DEFAULT IS KEPT, AND THAT IS THE ONE PLACE THIS
     * PARAMETER DIFFERS FROM `?areas=` AND `?skeleton=`.** For an element a
     * NAMED parameter is an override that spends NO draw and an omitted one is
     * DRAWN, so `guard;binds=item` and `guard` are DIFFERENT RUNS even though
     * `binds` resolves to `item` in both. A writer that "tidied" the default
     * away would silently turn the first into the second.
     */
    it('KEEPS a named parameter even at its default value — the absence is load-bearing', () => {
        expect(writeElementsParam(q(''), { name: 'guard', params: { binds: 'item' } })
            .get('elements')).toBe('guard;binds=item');
        expect(writeElementsParam(q(''), { name: 'guard' }).get('elements')).toBe('guard');
        expect(readElements(q('elements=guard%3Bbinds%3Ditem')))
            .toEqual({ name: 'guard', params: { binds: 'item' } });
    });

    it('writes the spec through the ONE formatter, in SCHEMA order, and DELETES at `none`', () => {
        // ⛓ schema order (len, turns, binds), not the caller's typing order.
        expect(writeElementsParam(q('seed=3'), { name: 'guard', params: { binds: 'any', len: 4 } })
            .toString()).toBe('seed=3&elements=guard%3Blen%3D4%3Bbinds%3Dany');
        expect(writeElementsParam(q(''), { name: 'guard' }).get('elements')).toBe('guard');
        // ⛔ …and the DEFAULT deletes rather than writing `elements=none`.
        expect(writeElementsParam(q('elements=guard&run=1'), { name: 'none' }).toString())
            .toBe('run=1');
        expect(writeElementsParam(q('elements=guard&run=1'), null).toString()).toBe('run=1');
    });

    /**
     * ⛔ TRAP 245 — REWRITTEN **IN PLACE**. `delete` then `set` APPENDS the key
     * and moves it to the end of the bar, which the fixed point below sees and
     * a round trip never would.
     */
    it('REWRITES IN PLACE — a changed spec does not move the key to the end of the bar', () => {
        expect(writeElementsParam(q('elements=guard&run=1'), { name: 'guard', params: { len: 3 } })
            .toString()).toBe('elements=guard%3Blen%3D3&run=1');
        expect(writeElementsParam(q('seed=1&elements=guard&run=1'), { name: 'guard' })
            .toString()).toBe('seed=1&elements=guard&run=1');
    });

    it('reader ∘ writer is a FIXED POINT over every spelling above', () => {
        for (const value of ['guard', 'guard;len=4', 'guard;len=2;turns=1',
            'guard;len=6;turns=3;binds=any', 'guard;binds=item']) {
            expect(writeElementsParam(q(''), readElements(q(`elements=${encodeURIComponent(value)}`)))
                .get('elements')).toBe(value);
        }
    });

    it('REFUSES BY NAME, with the parameter in front and the codec\'s sentence behind', () => {
        expect(() => readElements(q('elements=hammer')))
            .toThrow(/\?elements="hammer".*head of an element spec is the ELEMENT.*\[none, guard, killgate, blockpocket\]/s);
        expect(() => readElements(q('elements=none%3Blen%3D3')))
            .toThrow(/There is no element to give them to/);
        expect(() => readElements(q('elements=guard%3Blen%3D9')))
            .toThrow(/not in its declared domain/);
        expect(() => readElements(q('elements=guard%3Bnope%3D1')))
            .toThrow(/has no parameter "nope"/);
        expect(() => readElements(q('elements=guard%3Blen%3D2%3Blen%3D3')))
            .toThrow(/names "len" TWICE/);
    });

    it('REFUSES on the way OUT what it would refuse on the way in', () => {
        expect(() => writeElementsParam(q(''), { name: 'hammer' }))
            .toThrow(/declared elements are \[none, guard, killgate, blockpocket\]/);
        expect(() => writeElementsParam(q(''), { name: 'guard', params: { len: 9 } }))
            .toThrow(/not in its declared domain/);
        expect(() => writeElementsParam(q(''), { name: 'none', params: { len: 2 } }))
            .toThrow(/There is no element to give them to/);
    });

    /**
     * ⛓⛓⛓ **THE SEEDLING PAGE MUST IGNORE-AND-PRESERVE AN UNKNOWN
     * `?elements=`** — arc 1's claim for `?areas=`, one parameter later.
     * Seedling has no elements (arc 3 gives it some), and a hosted navigate
     * that STRIPPED the parameter would hand back a link that no longer names
     * the run it came from. ⛔ Nothing under `seedlingDemo/` was touched, so
     * what is driven is the composition of the SHARED writers its own
     * copy-the-rest writer is built from.
     */
    it('the SHARED writers PRESERVE an ?elements= they do not own', () => {
        const bar = q('source=generate&seed=3&elements=guard%3Blen%3D2%3Bturns%3D1&biome=x');
        writeBounds(bar, DEFAULT_BOUNDS);
        writeSkeletonParam(bar, { kind: 'winding' });
        writeAreasParam(bar, { keys: 1 });
        writeRosterParam(bar, null);
        dropDirectedParam(bar);
        writeRunFlag(bar, 0);
        expect(bar.get('elements')).toBe('guard;len=2;turns=1');
        expect(bar.get('areas')).toBe('1');
    });
});
