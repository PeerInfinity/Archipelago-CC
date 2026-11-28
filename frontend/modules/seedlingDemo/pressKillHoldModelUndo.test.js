/**
 * seedlingDemo/pressKillHoldModelUndo.test — ⛓ hammer-phase L40-CHEST-CORNER (`PRESS_KILL_HOLD_MODEL_UNDO`, OFF): the
 * switch's contract, and its witness.
 *
 * The witness is `procgenPostSword.test.js`'s clockless spinner kill-lock re-probe (`spinner-killlock-no-clock`: a
 * door room, a kill-lock and a spinner, booted with no `save.time`), rebuilt here from the same helpers. Its press
 * kill refuses with the all-phases hammer union. Under `PRESS_KILL_HOLD` the hold idles at the stand, inside the
 * spinner's all-phases reach, and the run model throws its own `levelRun: … HAMMER REACH` refusal, which escapes in
 * place of the kill's refusal. ON, that throw ends the hold's search, and the kill's own refusal stands plus PKH's
 * one sentence.
 */
import { describe, expect, it } from 'vitest';

import { POST_SWORD_ITEMS } from './procgenPalette.js';
import { bootAtTile, emptyLevel, oelAtTile, withEntities, withTerrain } from './procgenLevel.js';
import { DEFAULT_BUDGET, bootStaging, collectGoal, solve } from './procgenOracle.js';
import { SEEDLING_DEFAULTS } from './procgenSeedling.js';
import {
    PRESS_KILL_HOLD_MODEL_UNDO, PRESS_KILL_HOLD_MODEL_UNDO_COUNTS, PRESS_KILL_HOLD_MODEL_UNDO_DEFAULT, SolverBotError,
    holdRedoModelRefusal, withPressKillHold, withPressKillHoldModelUndo,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const UNION = /13 px hammer's union over all 45 phases/;

/** `procgenPostSword.test.js`'s door room: a wall across row 5 with one gap at column 4, the goal beyond it. */
function clocklessSpinnerKillLock() {
    const goal = { tx: 7, ty: 8 };
    let record = emptyLevel({ level: SEEDLING_DEFAULTS.level });
    const wall = [];
    for (let tx = 1; tx <= 8; tx += 1) if (tx !== 4) wall.push({ tx, ty: 5, terrain: 'wall' });
    record = withTerrain(record, wall);
    record = withEntities(record, [
        { type: SEEDLING_DEFAULTS.goalClass, ...oelAtTile(goal.tx, goal.ty), attrs: { tag: SEEDLING_DEFAULTS.goalTag } },
        { type: 'lock', ...oelAtTile(4, 5), attrs: { tset: '-1', tag: '1' } },
        { type: 'spinner', ...oelAtTile(3, 2), attrs: { tag: '-1' } },
    ]);
    const staging = bootStaging({
        boot: bootAtTile(record, SEEDLING_DEFAULTS.start.tx, SEEDLING_DEFAULTS.start.ty),
        items: POST_SWORD_ITEMS, pins: ['dead_frames'], time: null,
    });
    try {
        const out = solve(record, staging, [collectGoal(goal.tx * 16, goal.ty * 16)], DEFAULT_BUDGET,
            { name: 'spinner-killlock-no-clock', now: () => 0 });
        return { verdict: out.verdict, reasonText: out.reasonText };
    } catch (e) {
        return { verdict: `THREW:${e.name}`, reasonText: e.message };
    }
}

describe('PRESS_KILL_HOLD_MODEL_UNDO (hammer-phase L40-CHEST-CORNER)', () => {
    it('ships OFF, read from SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO, and is a name the solver-env channel carries', () => {
        expect(PRESS_KILL_HOLD_MODEL_UNDO_DEFAULT).toBe(false);
        expect(PRESS_KILL_HOLD_MODEL_UNDO.enabled)
            .toBe(globalThis.process?.env?.SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO');
    });

    it('withPressKillHoldModelUndo sets the switch inside and restores it after, also on a throw', () => {
        const was = PRESS_KILL_HOLD_MODEL_UNDO.enabled;
        expect(withPressKillHoldModelUndo(!was, () => PRESS_KILL_HOLD_MODEL_UNDO.enabled)).toBe(!was);
        expect(PRESS_KILL_HOLD_MODEL_UNDO.enabled).toBe(was);
        expect(() => withPressKillHoldModelUndo(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(PRESS_KILL_HOLD_MODEL_UNDO.enabled).toBe(was);
    });

    it('reads only the run model\'s own refusal (`levelRun: …`), and only ON; every read it takes is counted', () => {
        const model = new Error('levelRun: at tick 9 the player box … HAMMER REACH');
        withPressKillHoldModelUndo(false, () => expect(holdRedoModelRefusal(model)).toBe(false));
        withPressKillHoldModelUndo(true, () => {
            const n = PRESS_KILL_HOLD_MODEL_UNDO_COUNTS.undone;
            expect(holdRedoModelRefusal(model)).toBe(true);
            expect(holdRedoModelRefusal(new TypeError('x is undefined'))).toBe(false);
            expect(holdRedoModelRefusal(new Error('solverBot: levelRun: not at the start'))).toBe(false);
            expect(holdRedoModelRefusal(new SolverBotError('x'))).toBe(false);
            expect(holdRedoModelRefusal(null)).toBe(false);
            expect(PRESS_KILL_HOLD_MODEL_UNDO_COUNTS.undone).toBe(n + 1);
        });
    });

    it('the witness: OFF the kill refuses with the hammer union; PKH alone replaces it with the hold\'s model throw; '
        + 'PKH + this switch keeps the kill\'s refusal and adds PKH\'s sentence', () => {
        const off = withPressKillHold(false, () => withPressKillHoldModelUndo(true, clocklessSpinnerKillLock));
        expect(off.verdict).not.toBe('SOLVED');
        expect(off.reasonText).toMatch(UNION);
        expect(off.reasonText).not.toMatch(/PRESS_KILL_HOLD/);

        const pkh = withPressKillHold(true, () => withPressKillHoldModelUndo(false, clocklessSpinnerKillLock));
        expect(pkh.verdict).not.toBe('SOLVED');
        expect(pkh.reasonText).toMatch(/^levelRun: at tick \d+ the player box .* HAMMER REACH/);

        const n = PRESS_KILL_HOLD_MODEL_UNDO_COUNTS.undone;
        const on = withPressKillHold(true, () => withPressKillHoldModelUndo(true, clocklessSpinnerKillLock));
        expect(on.verdict).toBe(off.verdict);
        expect(on.reasonText).toMatch(UNION);
        expect(on.reasonText).not.toMatch(/hammer line/);
        expect(on.reasonText).toContain('The stand hold (`PRESS_KILL_HOLD`) rewound');
        expect(PRESS_KILL_HOLD_MODEL_UNDO_COUNTS.undone).toBeGreaterThan(n);
    }, 120_000);
});
