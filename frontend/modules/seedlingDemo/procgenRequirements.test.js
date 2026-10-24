/**
 * seedlingDemo/procgenRequirements — **THE REQUIREMENTS DIFFERENTIAL**, lifted
 * out of `scripts/procgen/batch-seedling-acceptance.mjs` at arc 3, slice 4d
 * (D2), and given its first rows here.
 *
 * ⛓ IT NEVER HAD ANY. It lived inside a script the suite does not run, and its
 * four grades were exercised only by whatever the batch's five carriers
 * happened to be. These rows drive each grade from a HAND-DRAWN level, so the
 * grade a future edit changes is a red row rather than a number in a report
 * nobody diffs.
 */

import { describe, expect, it } from 'vitest';

import { GRADE_WORDS } from '../procgenCore/differentialGrade.js';
import {
    REQUIRING_GRADES, gradeOf, requirementsFor,
} from './procgenRequirements.js';
import {
    bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain,
} from './procgenLevel.js';
import {
    DEFAULT_BUDGET, GENERATED_BOOT_TIME, VERDICT, collectGoal,
} from './procgenOracle.js';
import { POST_SWORD_ITEMS, PRE_SWORD_ITEMS } from './procgenPalette.js';
import { SEEDLING_DEFAULTS } from './procgenSeedling.js';

const LEVEL = SEEDLING_DEFAULTS.level;

/**
 * ⛓ THE KILL-GATE'S OWN GEOMETRY, hand-drawn: an L corridor cut by a `tset:-1`
 * lock at (5,1) with the spinner in a ONE-neighbour nub at (3,2), the goal
 * behind the cut. `census-seedling-enemies.mjs` measures this room SOLVED in
 * 384 ticks with `['kill','collect']` — it is the one arrangement in this arc
 * where a `kill` fires, and without the sword the press is a SILENT NO-OP.
 */
function killGateRoom({ spinner = true } = {}) {
    let rec = emptyLevel({ level: LEVEL });
    const floor = new Set(['1,1', '2,1', '3,1', '4,1', '5,1', '6,1', '7,1', '8,1',
        '8,2', '8,3', '3,2']);
    const wall = [];
    for (let ty = 1; ty <= 8; ty += 1) {
        for (let tx = 1; tx <= 8; tx += 1) {
            if (!floor.has(`${tx},${ty}`)) wall.push({ tx, ty, terrain: 'wall' });
        }
    }
    rec = withTerrain(rec, wall);
    return withEntities(rec, [
        { type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(8, 3),
            attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
        ...(spinner ? [
            { type: 'lock', ...oelAtTile(5, 1), attrs: { tset: '-1', tag: '1' } },
            { type: 'spinner', ...oelAtTile(3, 2), attrs: { tag: '-1' } },
        ] : []),
    ]);
}

/** An OPEN room, nothing in it — the control the differential should call INERT. */
function openRoom() {
    return withEntities(emptyLevel({ level: LEVEL }), [{
        type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(8, 8),
        attrs: { tag: SEEDLING_DEFAULTS.goalTag },
    }]);
}

/**
 * The `state` shape the differential takes — the same fields
 * `generateSeedlingLevel` and the acceptance batch both hand it.
 */
const stateFor = (record, palette, goal) => ({
    record,
    palette,
    seed: 1,
    biome: palette === POST_SWORD_ITEMS ? 'post-sword' : 'pre-sword',
    summary: { pins: ['dead_frames'] },
    model: {
        boot: () => ({ ...bootAtTile(record, 1, 1), time: GENERATED_BOOT_TIME }),
        goals: [collectGoal(goal.tx * 16, goal.ty * 16)],
    },
});

describe('the four grades, each from a hand-drawn level', () => {
    it('⛓⛓ STRONG — the kill gate solves WITH the sword and the without-arm is REFUSED', () => {
        const rec = killGateRoom();
        const state = stateFor(rec, { items: POST_SWORD_ITEMS, name: 'post-sword' },
            { tx: 8, ty: 3 });
        const report = requirementsFor(state, { verdict: VERDICT.SOLVED, ticks: 384 },
            { budget: DEFAULT_BUDGET });
        const row = report.rows.find((r) => r.flag === 'hasSword');
        expect(row.verdict).toBe('REQUIRED');
        expect(row.withoutVerdict).toBe('REFUSED');
        expect(gradeOf(row)).toBe('STRONG');
        expect(row.evidence).toMatch(/^STRONG/);
        expect(REQUIRING_GRADES).toContain(gradeOf(row));
    });

    it('⛓⛓ BOUND-DEPENDENT — a without-arm that ran out of BUDGET rather than out of moves',
        () => {
            /**
             * ⛓ MEASURED, NOT GUESSED, AND THE ROOM HAD TO CHANGE. The first
             * cut used the kill-gate room at a small budget and got STRONG at
             * every budget from 20 to 380: without a sword the press is a silent
             * NO-OP and the COMBAT LADDER exhausts, which is a REFUSAL — the
             * solver saying *there is no way*, not *I ran out*. The two are
             * different facts and the grade is the whole point of separating
             * them, so BOUND-DEPENDENT needs a room whose walk is simply longer
             * than the bound. The open room solves in 134 ticks; at 40 the
             * without-arm is BUDGET_EXHAUSTED and at 80 it SOLVES.
             */
            const rec = openRoom();
            const state = stateFor(rec, { items: POST_SWORD_ITEMS, name: 'post-sword' },
                { tx: 8, ty: 8 });
            const report = requirementsFor(state, { verdict: VERDICT.SOLVED, ticks: 134 },
                { budget: { maxTicksPerTarget: 40 } });
            const row = report.rows.find((r) => r.flag === 'hasSword');
            expect(row.verdict).toBe('REQUIRED');
            expect(row.withoutVerdict).toBe('BUDGET_EXHAUSTED');
            expect(gradeOf(row)).toBe('BOUND-DEPENDENT');
            expect(row.evidence).toMatch(/^BOUND-DEPENDENT/);
            // ⛓ AND THE LABEL CARRIES THE BUDGET IT WAS BOUNDED BY, not a constant.
            expect(row.label).toMatch(/maxTicksPerTarget=40/);
            /**
             * ⛔⛔ AND THIS ROW IS THE HONEST WARNING THE GRADE EXISTS FOR: the
             * SAME room at budget 80 solves BOTH ways. A BOUND-DEPENDENT
             * "REQUIRED" is a statement about the bound, and here the bound is
             * the ONLY thing making it true.
             */
            const wider = requirementsFor(state, { verdict: VERDICT.SOLVED, ticks: 134 },
                { budget: { maxTicksPerTarget: 80 } });
            expect(wider.rows[0].verdict).toBe('rule not established');
        });

    it('⛓⛓ INERT — an open room solves both ways at the SAME tick count', () => {
        const rec = openRoom();
        const state = stateFor(rec, { items: POST_SWORD_ITEMS, name: 'post-sword' },
            { tx: 8, ty: 8 });
        /**
         * ⛔ THE WITH-ARM'S TICKS ARE THE WITHOUT-ARM'S OWN, taken from a first
         * pass — which is exactly what INERT means and the only honest way to
         * drive it: the sword changes nothing about this walk.
         */
        const probe = requirementsFor(state, { verdict: VERDICT.SOLVED, ticks: 0 },
            { budget: DEFAULT_BUDGET });
        const ticks = probe.rows.find((r) => r.flag === 'hasSword').withoutTicks;
        const report = requirementsFor(state, { verdict: VERDICT.SOLVED, ticks },
            { budget: DEFAULT_BUDGET });
        const row = report.rows.find((r) => r.flag === 'hasSword');
        expect(row.verdict).toBe('rule not established');
        expect(row.inert).toBe(true);
        expect(gradeOf(row)).toBe('INERT');
        expect(REQUIRING_GRADES).not.toContain(gradeOf(row));
    });

    it('⛓ NOT-ESTABLISHED — both arms solve and the tick counts DIFFER', () => {
        const rec = openRoom();
        const state = stateFor(rec, { items: POST_SWORD_ITEMS, name: 'post-sword' },
            { tx: 8, ty: 8 });
        const report = requirementsFor(state, { verdict: VERDICT.SOLVED, ticks: 999999 },
            { budget: DEFAULT_BUDGET });
        const row = report.rows.find((r) => r.flag === 'hasSword');
        expect(row.verdict).toBe('rule not established');
        expect(row.inert).toBe(false);
        expect(gradeOf(row)).toBe('NOT-ESTABLISHED');
    });

    it('⛓ "none established" is a NAMED verdict WITH ITS REASON when the biome grants nothing',
        () => {
            const rec = openRoom();
            const state = stateFor(rec, { items: PRE_SWORD_ITEMS, name: 'pre-sword' },
                { tx: 8, ty: 8 });
            const report = requirementsFor(state, { verdict: VERDICT.SOLVED, ticks: 100 },
                { budget: DEFAULT_BUDGET });
            expect(report.candidates).toEqual([]);
            expect(report.rows).toEqual([]);
            expect(report.verdict).toBe('none established');
            expect(report.why).toMatch(/declares NO item flag true/);
            expect(report.why).toMatch(/a fact about the BIOME, not a failed measurement/);
        });
});

describe('gradeOf reads FIELDS, and agrees with the prose it does not read', () => {
    /**
     * ⛔ THE DRIFT GUARD (trap 337/354). `evidence` is a SENTENCE and `gradeOf`
     * is a WORD, both derived from `withoutVerdict`; they agree by construction
     * today and this row is what makes a future edit that separates them RED.
     */
    const rows = [
        { verdict: 'REQUIRED', withoutVerdict: 'REFUSED', evidence: 'STRONG (solver refusal)' },
        { verdict: 'REQUIRED', withoutVerdict: 'BUDGET_EXHAUSTED',
            evidence: 'BOUND-DEPENDENT (the budget is what ended it)' },
        { verdict: 'REQUIRED', withoutVerdict: 'THREW:PhysicsV2Error',
            evidence: 'WEAK (an ENGINE throw, not a claim about the level)' },
    ];
    it.each(rows)('grade $withoutVerdict agrees with its own evidence sentence', (row) => {
        expect(row.evidence.startsWith(gradeOf(row))).toBe(true);
    });

    it('a THREW without-arm grades WEAK and does NOT meet a directive', () => {
        expect(gradeOf({ verdict: 'REQUIRED', withoutVerdict: 'THREW:PhysicsV2Error' }))
            .toBe('WEAK');
        expect(REQUIRING_GRADES).not.toContain('WEAK');
    });

    /**
     * ⛓⛓⛓ **ARC 5, SLICE 5 — THE ROW THAT SAID `SHORTENS` WAS UNREACHABLE NOW
     * SAYS IT IS REACHED, AND IT IS THE SAME ROW.** Arc-3 slice 4d wrote this
     * as *"SHORTENS is NOT a grade this module can answer (trap 355 — arc 5's)"*
     * and asserted `all.has('SHORTENS') === false`. ⛔ It is REWRITTEN rather
     * than deleted, so the six words are still enumerated in one place and the
     * discharge is visible in the diff.
     */
    it('⛓ the SIX words are exactly what `gradeOf` can answer — SHORTENS included', () => {
        const both = (withTicks, withoutTicks) => ({
            verdict: 'rule not established', withVerdict: 'SOLVED', withoutVerdict: 'SOLVED',
            withTicks, withoutTicks,
        });
        const all = new Set([
            gradeOf({ verdict: 'REQUIRED', withoutVerdict: 'REFUSED' }),
            gradeOf({ verdict: 'REQUIRED', withoutVerdict: 'BUDGET_EXHAUSTED' }),
            gradeOf({ verdict: 'REQUIRED', withoutVerdict: 'THREW:X' }),
            gradeOf(both(200, 200)),
            gradeOf(both(120, 300)),
            gradeOf(both(300, 120)),
        ]);
        expect([...all].sort()).toEqual(GRADE_WORDS);
        expect(all.has('SHORTENS')).toBe(true);
    });

    /**
     * ⛓⛓⛓ **THE DIRECTION, DRIVEN FROM BOTH SIDES.** A sign error in the ONE
     * comparison would grade every shortcut level and every non-shortcut level
     * with the same confidence, so the two directions are asserted separately
     * and by name.
     */
    it('⛓⛓ SHORTENS is FEWER ticks WITH the item — the other direction is NOT-ESTABLISHED',
        () => {
            const both = (withTicks, withoutTicks) => ({
                verdict: 'rule not established', withVerdict: 'SOLVED',
                withoutVerdict: 'SOLVED', withTicks, withoutTicks,
            });
            expect(gradeOf(both(120, 300))).toBe('SHORTENS');
            expect(gradeOf(both(299, 300))).toBe('SHORTENS');
            expect(gradeOf(both(300, 300))).toBe('INERT');
            expect(gradeOf(both(301, 300))).toBe('NOT-ESTABLISHED');
            expect(REQUIRING_GRADES).not.toContain('SHORTENS');
        });

    /**
     * ⛔⛔ **THE GUARD THAT MATTERS MOST: A WITHOUT-ARM THAT DID NOT SOLVE HAS
     * NO COST, AND IT STILL CARRIES A TICK COUNT.** `requirementsFor` writes
     * `withoutTicks` from `without.ok ? without.value.ticks : null`, so a
     * BUDGET_EXHAUSTED arm carries the ticks it spent FAILING. Handing that to
     * the comparison would grade a REQUIRED row SHORTENS.
     */
    it('⛔ a REQUIRED row is never SHORTENS, however the tick counts fall', () => {
        for (const withoutVerdict of ['REFUSED', 'BUDGET_EXHAUSTED', 'THREW:PhysicsV2Error']) {
            expect(gradeOf({ verdict: 'REQUIRED', withVerdict: 'SOLVED', withoutVerdict,
                withTicks: 50, withoutTicks: 400 })).not.toBe('SHORTENS');
        }
        // and a row whose WITH arm did not solve is not a shortcut either
        expect(gradeOf({ verdict: 'rule not established', withVerdict: 'REFUSED',
            withoutVerdict: 'REFUSED', withTicks: 50, withoutTicks: 400 }))
            .toBe('NOT-ESTABLISHED');
    });

    /**
     * ⛓ **`row.inert` AND THE GRADE AGREE ON EVERY ROW WHERE BOTH ARMS SOLVED**,
     * and the row that could separate them is named rather than hidden: arc 3's
     * `inert` field is `without.ok && ticks equal`, and `without.ok` is TRUE for
     * a REFUSED without-arm too — so on a row whose WITH arm did not solve the
     * field can say `inert` about two failures at the same tick count. The
     * GRADE does not, because it reads the verdict PAIR.
     */
    it('⛓ the grade and the row\'s own `inert` field agree when both arms SOLVED', () => {
        const both = (withTicks, withoutTicks) => ({
            verdict: 'rule not established', withVerdict: 'SOLVED', withoutVerdict: 'SOLVED',
            withTicks, withoutTicks, inert: withTicks === withoutTicks,
        });
        for (const row of [both(200, 200), both(120, 300), both(300, 120)]) {
            expect(gradeOf(row) === 'INERT').toBe(row.inert);
        }
    });
});
