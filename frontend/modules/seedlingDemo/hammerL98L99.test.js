/**
 * ⛓ hammer-phase L98-L99 — `KILLLOCK_STANDOUT_GUARD` (`SEEDLING_KILLLOCK_STANDOUT_GUARD`, OFF) and `DRIVE_DEATH_REFUSED`
 * (`SEEDLING_DRIVE_DEATH_REFUSED`, OFF): the switches. Their witnesses (the vanilla route survey's steps 227 and 228,
 * solved OFF and ON) are `hammerL98L99.train.test.js`. `CC/docs/cloud-reports/seedling-hammer-l98-l99-line-stance.md`.
 */
import { describe, expect, it } from 'vitest';

import {
    DRIVE_DEATH_REFUSED, DRIVE_DEATH_REFUSED_DEFAULT, KILLLOCK_CHASER_REWIND, KILLLOCK_STANDOUT_GUARD,
    KILLLOCK_STANDOUT_GUARD_DEFAULT, withDriveDeathRefused, withKillLockStandOutGuard,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';

const ENV = globalThis.process?.env ?? {};

describe('hammer-phase L98-L99 — the switches', () => {
    it('both ship OFF, `SEEDLING_<NAME>=1` turns each on in node, and the channel carries both names', () => {
        expect([KILLLOCK_STANDOUT_GUARD_DEFAULT, DRIVE_DEATH_REFUSED_DEFAULT]).toEqual([false, false]);
        expect(KILLLOCK_STANDOUT_GUARD.enabled).toBe(ENV.SEEDLING_KILLLOCK_STANDOUT_GUARD === '1');
        expect(DRIVE_DEATH_REFUSED.enabled).toBe(ENV.SEEDLING_DRIVE_DEATH_REFUSED === '1');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_KILLLOCK_STANDOUT_GUARD');
        expect(SOLVER_ENV_NAMES).toContain('SEEDLING_DRIVE_DEATH_REFUSED');
        // the stand-out guard rides the rewound turns, which ship ON
        expect(KILLLOCK_CHASER_REWIND.enabled).toBe(ENV.SEEDLING_KILLLOCK_CHASER_REWIND !== '0');
    });
});

describe('hammer-phase L98-L99 — the wrappers restore', () => {
    it('`withKillLockStandOutGuard` / `withDriveDeathRefused` set the switch for `fn` and put it back, thrown or not', () => {
        for (const [sw, w] of [[KILLLOCK_STANDOUT_GUARD, withKillLockStandOutGuard], [DRIVE_DEATH_REFUSED, withDriveDeathRefused]]) {
            const was = sw.enabled;
            expect(w(true, () => sw.enabled)).toBe(true);
            expect(sw.enabled).toBe(was);
            expect(() => w(!was, () => { throw new Error('x'); })).toThrow('x');
            expect(sw.enabled).toBe(was);
        }
    });
});
