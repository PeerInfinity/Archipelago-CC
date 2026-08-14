/**
 * seedlingDemo/procgenOracle.test — the three verdict classes, each produced
 * by a real solve of a real generated room.
 *
 * PROCGEN PoC arc, slice 1. Nothing here is stubbed: the SOLVED row walks the
 * empty bordered room and takes the goal pickup, the REFUSED row walls that
 * pickup into its own cell and carries the driver's own sentence, and the
 * BUDGET rows are produced by shrinking the two budgets this file owns. That
 * is the point — a classifier tested against fake throws would agree with
 * itself about a solver nobody ran.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_MAX_TICKS_PER_TARGET } from './botDriverV1.js';
import {
    DEFAULT_BUDGET, ProcgenOracleError, VERDICT, assertBudget, bootStaging,
    certifyCollects, collectGoal, solve,
} from './procgenOracle.js';
import { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';

const LEVEL = 900;
/** ⚖ Slice 1's chosen goal-pickup class — see the CLI proof's §"the class". */
const GOAL_TILE = { tx: 8, ty: 8 };
const START_TILE = { tx: 1, ty: 1 };

const goalAt = oelAtTile(GOAL_TILE.tx, GOAL_TILE.ty);

/** The empty room with one goal pickup in the far corner. */
function room(extraWalls = []) {
    let record = emptyLevel({ level: LEVEL });
    if (extraWalls.length) {
        record = withTerrain(record, extraWalls.map((c) => ({ ...c, terrain: 'wall' })));
    }
    return withEntities(record, [{ type: 'torchpickup', ...goalAt, attrs: { tag: '0' } }]);
}

const staging = (record) => bootStaging({ boot: bootAtTile(record, START_TILE.tx, START_TILE.ty) });
const goals = [collectGoal(goalAt.x, goalAt.y)];

describe('the budget is named, and its default is the engine\'s own', () => {
    it('maxTicksPerTarget is DEFAULT_MAX_TICKS_PER_TARGET, imported not typed', () => {
        expect(DEFAULT_BUDGET.maxTicksPerTarget).toBe(DEFAULT_MAX_TICKS_PER_TARGET);
    });

    /**
     * ⛔ THE BUDGET IS ASSERTED BY ITS WHOLE KEY SET, not by "wallClockMs is
     * absent". A test that only checked the one field it knew about would pass
     * just as happily if somebody added `wallClockSeconds` next to it, and the
     * property this arc bought is that NOTHING here is denominated in time.
     */
    it('the budget names ticks and NOTHING denominated in time', () => {
        expect(Object.keys(DEFAULT_BUDGET)).toEqual(['maxTicksPerTarget']);
    });

    it('assertBudget completes from the defaults and refuses nonsense', () => {
        expect(assertBudget({ maxTicksPerTarget: 40 }))
            .toEqual({ maxTicksPerTarget: 40 });
        expect(() => assertBudget({ maxTicksPerTarget: 1.5 })).toThrow(ProcgenOracleError);
    });

    /**
     * ⚠ A REMOVED KNOB THAT IS SILENTLY IGNORED IS WORSE THAN ONE THAT THROWS.
     * A caller copying a budget out of an old branch would otherwise believe it
     * had bounded a run it had not.
     */
    it('a budget still carrying wallClockMs is REFUSED by name', () => {
        expect(() => assertBudget({ wallClockMs: 5000 })).toThrow(ProcgenOracleError);
        expect(() => assertBudget({ wallClockMs: 5000 })).toThrow(/wallClockMs is GONE/);
    });

    it('solve refuses an empty goal list', () => {
        expect(() => solve(room(), staging(room()), [])).toThrow(/non-empty ordered goal list/);
    });
});

describe('SOLVED — the empty room, certified by the solve\'s own collect record', () => {
    const record = room();
    const out = solve(record, staging(record), goals, DEFAULT_BUDGET, { name: 'test-solved' });

    it('the verdict is SOLVED and it carries ticks, a tape and a trace', () => {
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.ticks).toBeGreaterThan(0);
        expect(out.tape.tick_count).toBe(out.ticks);
        expect(out.trace.rows.length).toBeGreaterThan(0);
        // ⚠ `ms` is EVIDENCE and nothing decides on it — see the wall-clock
        // regression gate below, which proves the verdict ignores it.
        expect(out.ms).toBeGreaterThanOrEqual(0);
    });

    it('certification reads the COLLECT RECORD, not a persistence ledger', () => {
        expect(out.certification.certified).toBe(true);
        expect(out.certification.missing).toEqual([]);
        expect(out.certification.collected).toEqual([{
            tag: 'torchpickup', x: goalAt.x, y: goalAt.y, item: 'torch', strategy: 'collect',
        }]);
    });

    it('the danger channel is EMPTY on a success BY CONSTRUCTION (trap 202)', () => {
        // Recorded, not empty-by-absence: the queries happened and every one
        // came back calm. The refusal text is the evidence channel, not this.
        expect(out.dangerQueries.length).toBeGreaterThan(0);
        for (const q of out.dangerQueries) expect(q.danger).toBe(false);
    });

    it('the same room solves to the same tick count twice', () => {
        const again = solve(record, staging(record), goals, DEFAULT_BUDGET, { name: 'test-solved' });
        expect(again.ticks).toBe(out.ticks);
        expect(JSON.stringify(again.tape)).toBe(JSON.stringify(out.tape));
    });
});

describe('REFUSED — a goal walled into its own cell', () => {
    const walls = [
        { tx: GOAL_TILE.tx - 1, ty: GOAL_TILE.ty },
        { tx: GOAL_TILE.tx, ty: GOAL_TILE.ty - 1 },
        { tx: GOAL_TILE.tx - 1, ty: GOAL_TILE.ty - 1 },
    ];
    const record = room(walls);
    const out = solve(record, staging(record), goals, DEFAULT_BUDGET, { name: 'test-refused' });

    it('the verdict is REFUSED, within budget', () => {
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.classifiedBy).toBe('the solver refused within budget');
        expect(out.ms).toBeGreaterThanOrEqual(0);
    });

    it('the refusal text is the solver\'s own, VERBATIM', () => {
        expect(out.errorName).toBe('BotDriverV2Error');
        expect(out.reasonText).toContain('the sweep was blocked by tile:Stone');
        expect(out.reasonText).toContain('A pickup is not solid, so the planner and the '
            + 'geometry disagree about the approach.');
    });

    it('it carries no certification and no tape — a refusal proves nothing walked', () => {
        expect(out.certification).toBeUndefined();
        expect(out.tape).toBeUndefined();
        expect(out.ticksSpent).toBeGreaterThanOrEqual(0);
    });
});

describe('BUDGET_EXHAUSTED — its own class, never a kind of refusal', () => {
    it('a tick budget nobody can reach in is classified by the number passed in', () => {
        const record = room();
        const out = solve(record, staging(record), goals,
            { maxTicksPerTarget: 7 }, { name: 'test-budget-ticks' });
        expect(out.verdict).toBe(VERDICT.BUDGET_EXHAUSTED);
        expect(out.budgetKind).toBe('per-target-ticks');
        expect(out.classifiedBy).toContain('7-tick per-target budget');
        expect(out.reasonText).toContain('7 ticks');
    });

    /**
     * ⛓⛓⛓ THE REGRESSION GATE FOR THE 2026-08-14 DETERMINISM FIX, and it is
     * the INVERSE of the test that used to stand here.
     *
     * That test asserted a solve which SUCCEEDED became `BUDGET_EXHAUSTED` once
     * it passed `wallClockMs`. It passed for the same reason the defect was
     * real: elapsed time decided a verdict. The injected clock is kept exactly
     * as it was — it makes every solve look like it took HOURS, which is a
     * harsher load than any real box can produce — and the assertion is
     * reversed. A machine cannot be slow enough to move this verdict.
     *
     * ⚠ It asserts SOLVED *and* that no budget field was invented to replace
     * the clock: `budgetKind` must be absent, not merely different.
     */
    it('no amount of elapsed time can move a certified solve off SOLVED', () => {
        let t = 0;
        const now = () => { t += 3_600_000; return t; };
        const record = room();
        const out = solve(record, staging(record), goals,
            DEFAULT_BUDGET, { now, name: 'test-budget-wall' });
        expect(out.verdict).toBe(VERDICT.SOLVED);
        expect(out.budgetKind).toBeUndefined();
        expect(out.certification.certified).toBe(true);
        expect(out.ticks).toBeGreaterThan(0);
        // ⛔ The clock really did report an absurd elapsed time — without this
        // the test would pass just as well against a stopped clock, and prove
        // nothing about the branch it exists to keep deleted.
        expect(out.ms).toBeGreaterThan(3_600_000);
    });

    /**
     * ⛓ The THROWN arm's elapsed-time branch is gone too. A refusal that names
     * no budget this call passed in is a claim about the LEVEL, however long it
     * took to make — and `budgetKind` reaches the generator's TRACE, whose sha
     * is the determinism payload, so a clock here would have left the level
     * reproducible and its own evidence not.
     */
    it('a slow REFUSAL stays REFUSED — elapsed time never relabels it', () => {
        const walls = [
            { tx: 7, ty: 7 }, { tx: 8, ty: 7 }, { tx: 9, ty: 7 },
            { tx: 7, ty: 8 }, { tx: 7, ty: 9 },
        ];
        let t = 0;
        const now = () => { t += 3_600_000; return t; };
        const record = room(walls);
        const out = solve(record, staging(record), goals,
            DEFAULT_BUDGET, { now, name: 'test-slow-refusal' });
        expect(out.verdict).toBe(VERDICT.REFUSED);
        expect(out.budgetKind).toBeUndefined();
        expect(out.ms).toBeGreaterThan(3_600_000);
    });
});

describe('what the oracle does NOT catch', () => {
    it('a level record the engine will not build propagates (a generator defect)', () => {
        const record = withEntities(emptyLevel({ level: LEVEL }),
            [{ type: 'notathing', ...goalAt }]);
        expect(() => solve(record, staging(record), goals))
            .toThrow(/not in the transcribed class table/);
    });
});

describe('certifyCollects, alone', () => {
    it('reports the goals with no collect record, by their goal spelling', () => {
        const out = certifyCollects(
            [collectGoal(16, 32), collectGoal(64, 64)],
            [{ goal: 'collect-placement', strategy: 'collect', item: 'torch', pickup: { tag: 't', x: 16, y: 32 } }],
        );
        expect(out.certified).toBe(false);
        expect(out.missing).toEqual(['place:64,64']);
    });

    it('ignores goal kinds that collect nothing', () => {
        const out = certifyCollects([{ kind: 'reach-exit', exit: { x: 0, y: 16 } }], []);
        expect(out).toEqual({ certified: true, missing: [], collected: [] });
    });
});
