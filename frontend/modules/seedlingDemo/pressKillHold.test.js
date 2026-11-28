/**
 * seedlingDemo/pressKillHold.test — ⛓ hammer-phase KILL880 (`PRESS_KILL_HOLD`, OFF): the switch's own contract.
 * The witness (a captured page request the switch solves hitless) is `hammerKill880StandHold.train.test.js`.
 */
import { describe, expect, it } from 'vitest';

import {
    HAMMER_PHASE_RUNG, PRESS_KILL_HOLD, PRESS_KILL_HOLD_COUNTS, PRESS_KILL_HOLD_DEFAULT, lastStandEnd, withPressKillHold,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const keys = (spec) => spec.split(' ').map((k) => new Set(k === '-' ? [] : k.split('+')));

describe('PRESS_KILL_HOLD (hammer-phase KILL880)', () => {
    it('ships OFF, and its env name is in the worker\'s table', () => {
        expect(PRESS_KILL_HOLD_DEFAULT).toBe(false);
        expect(PRESS_KILL_HOLD.enabled).toBe(globalThis.process?.env?.SEEDLING_PRESS_KILL_HOLD === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_PRESS_KILL_HOLD');
        expect(PRESS_KILL_HOLD_COUNTS.rows).toEqual(expect.any(Array));
    });

    it('the idles are whole hammer periods (the rung\'s own horizon), at least one', () => {
        expect(Number.isInteger(PRESS_KILL_HOLD.maxPeriods)).toBe(true);
        expect(PRESS_KILL_HOLD.maxPeriods).toBeGreaterThan(0);
        expect(HAMMER_PHASE_RUNG.horizon).toBeGreaterThan(HAMMER_PHASE_RUNG.maxTicks);
    });

    it('withPressKillHold sets the switch inside and restores it after, also on a throw', () => {
        const was = PRESS_KILL_HOLD.enabled;
        expect(withPressKillHold(!was, () => PRESS_KILL_HOLD.enabled)).toBe(!was);
        expect(PRESS_KILL_HOLD.enabled).toBe(was);
        expect(() => withPressKillHold(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(PRESS_KILL_HOLD.enabled).toBe(was);
    });

    it('lastStandEnd: the tick after the kill\'s last no-key tick, never before the kill began', () => {
        // a stand t2..t3, then a walk: the stand ends on t4 (the walk's first tick)
        expect(lastStandEnd(keys('right primary - - down down'), 0)).toBe(4);
        // the LAST stand wins
        expect(lastStandEnd(keys('- right - - left'), 0)).toBe(4);
        // standing at the refusal: the stand ends on the refusal's own tick (the caller does not hold there)
        expect(lastStandEnd(keys('down - -'), 0)).toBe(3);
        // a stand before the kill's first tick is not the kill's
        expect(lastStandEnd(keys('- - right down'), 2)).toBe(null);
        expect(lastStandEnd([], 0)).toBe(null);
    });
});
