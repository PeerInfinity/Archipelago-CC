/**
 * ⛓ hammer-phase LATCHED-HOLD — the switch's unit rows (fast tier). The witness is `hammerLatchedHoldMove.train.test.js`.
 */
import { describe, expect, it } from 'vitest';

import {
    LATCHED_HOLD_MOVE, LATCHED_HOLD_MOVE_COUNTS, LATCHED_HOLD_MOVE_DEFAULT, resetLatchedHoldMoveCounts,
    withLatchedHoldMove,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

describe('LATCHED_HOLD_MOVE — the switch', () => {
    it('is OFF by default and read from SEEDLING_LATCHED_HOLD_MOVE (the worker env channel lists it)', () => {
        expect(LATCHED_HOLD_MOVE_DEFAULT).toBe(false);
        expect(LATCHED_HOLD_MOVE.enabled).toBe(globalThis.process?.env?.SEEDLING_LATCHED_HOLD_MOVE === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_LATCHED_HOLD_MOVE');
    });

    it('withLatchedHoldMove sets it for the call and restores it, also on a throw', () => {
        const was = LATCHED_HOLD_MOVE.enabled;
        expect(withLatchedHoldMove(true, () => LATCHED_HOLD_MOVE.enabled)).toBe(true);
        expect(withLatchedHoldMove(false, () => LATCHED_HOLD_MOVE.enabled)).toBe(false);
        expect(() => withLatchedHoldMove(!was, () => { throw new Error('x'); })).toThrow('x');
        expect(LATCHED_HOLD_MOVE.enabled).toBe(was);
    });

    it('bounds its search generically (a radius and a fork cap, no level or coordinate)', () => {
        expect(LATCHED_HOLD_MOVE.radius).toBe(96);
        expect(LATCHED_HOLD_MOVE.maxForks).toBe(12);
        expect(Object.keys(LATCHED_HOLD_MOVE).sort()).toEqual(['enabled', 'maxForks', 'radius']);
    });

    it('its instrument resets', () => {
        LATCHED_HOLD_MOVE_COUNTS.asked = 3;
        LATCHED_HOLD_MOVE_COUNTS.moves.push({});
        LATCHED_HOLD_MOVE_COUNTS.declined.push({});
        resetLatchedHoldMoveCounts();
        expect(LATCHED_HOLD_MOVE_COUNTS).toEqual({ asked: 0, moves: [], declined: [] });
    });
});
