/**
 * seedlingDemo/goalStartWait.test — ⛓ hammer-phase FACE 1 (`GOAL_START_WAIT`, OFF): the switch's own contract.
 * The witness (a captured page request the switch solves hitless) is `hammerFace1GoalWait.train.test.js`.
 */
import { describe, expect, it } from 'vitest';

import {
    GOAL_START_WAIT, GOAL_START_WAIT_COUNTS, GOAL_START_WAIT_DEFAULT, SolverRefusal, isLadderExhausted, withGoalStartWait,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

describe('GOAL_START_WAIT (hammer-phase FACE 1)', () => {
    it('ships OFF, and its env name is in the worker\'s table', () => {
        expect(GOAL_START_WAIT_DEFAULT).toBe(false);
        expect(GOAL_START_WAIT.enabled).toBe(globalThis.process?.env?.SEEDLING_GOAL_START_WAIT === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_GOAL_START_WAIT');
        expect(GOAL_START_WAIT_COUNTS.tries).toEqual(expect.any(Array));
    });

    it('the waits are positive and strictly increasing (a longer idle is asked after a shorter one)', () => {
        expect(GOAL_START_WAIT.waits.length).toBeGreaterThan(0);
        GOAL_START_WAIT.waits.forEach((w, i) => {
            expect(Number.isInteger(w)).toBe(true);
            expect(w).toBeGreaterThan(i === 0 ? 0 : GOAL_START_WAIT.waits[i - 1]);
        });
    });

    it('withGoalStartWait sets the switch inside and restores it after, also on a throw', () => {
        const was = GOAL_START_WAIT.enabled;
        expect(withGoalStartWait(!was, () => GOAL_START_WAIT.enabled)).toBe(!was);
        expect(GOAL_START_WAIT.enabled).toBe(was);
        expect(() => withGoalStartWait(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(GOAL_START_WAIT.enabled).toBe(was);
    });

    it('re-asks only the combat ladder\'s EXHAUSTED refusal', () => {
        expect(isLadderExhausted(new SolverRefusal('solverBot(x) clear-tag {1,2} a@1,2 -> burn stance (t@3,4): the '
            + 'combat ladder is EXHAUSTED. The corridor passes through danger at (1.0,2.0)'))).toBe(true);
        expect(isLadderExhausted(new SolverRefusal('solverBot(x): no REACHABLE stance for a fire press'))).toBe(false);
        // the text alone, on an error that is not a refusal, is a defect and is never re-asked
        expect(isLadderExhausted(new Error('the combat ladder is EXHAUSTED'))).toBe(false);
        expect(isLadderExhausted(null)).toBe(false);
    });
});
