/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE NEW-LOCKS — L53's leg 910 (the arrival from L48, the page's HELD RETRY, budget 2560), the
 * heaviest of the five legs: three worker solves (OFF, the rewind alone, ON). The other rows are
 * `hammerNewLocks.test.js`; the legs and the solve are `hammerNewLocksLegs.js`.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KILLLOCK_STANCE_AS_FORECAST as __SAF_HOLD } from './solverBot.js';

// ⛓ `KILLLOCK_STANCE_AS_FORECAST` held OFF for this whole file: it ships ON since the ROCKLOCK + FADE flip took it in
// (⚖ the user, 2026-11-22). ON, 910 under ALL is 785 t (was 799), still 0 hits / 0 deaths, with a 'forced-hit' verb in its plan. These rows pin other switches; held OFF they are byte for byte their
// pre-flip selves. The flip's own effect is measured by its sweeps and survey.
let __safWas;
beforeAll(() => { __safWas = __SAF_HOLD.enabled; __SAF_HOLD.enabled = false; });
afterAll(() => { __SAF_HOLD.enabled = __safWas; });

import { ALL, LEG_910, NONE, solveLeg } from './hammerNewLocksLegs.js';

describe('hammer-phase NEW-LOCKS — L53 `{53,2}` (leg 910): the pinned chasers (`KILLLOCK_LINE_STANCE`)', () => {
    it('910 (from L48, the held retry): OFF the puncher is pinned; rewind alone refuses; ON solved, 0 hits', () => {
        const off = solveLeg(LEG_910, NONE);
        expect(off.ok).toBe(false);
        expect(off.message).toMatch(/puncher@136,96 is still in the world after the whole 191-tick bound .* blocked by tile:Ice Wall/);
        const noLine = solveLeg(LEG_910, { ...ALL, line: false });
        expect(noLine.ok).toBe(false);
        expect(noLine.line).toEqual([]);
        const on = solveLeg(LEG_910, ALL);
        expect(on).toMatchObject({ ok: true, ticks: 799, planSha: '1a65d0116cca', verbs: ['break', 'kill', 'walk'],
            hits: 0, deaths: 0, level: 53, stillSolid: false });
        expect(on.writes).toEqual([{ level: 53, tag: 2, at: 798, lock: 'lock@144,208' }]);
        // the puncher from its third line stance, a jellyfish from its third (each refused one rewound)
        // (the rows are both passes'; the plan is the dashless pass's, whose kills are its first two)
        expect(on.line.filter((r) => r.verdict === 'killed').slice(0, 2)).toEqual([
            { id: 'puncher@136,96', stance: { x: 120, y: 120 }, verdict: 'killed' },
            { id: 'jellyfish@184,160', stance: { x: 168, y: 184 }, verdict: 'killed' },
        ]);
        expect(on.line.filter((r) => r.verdict === 'refused').length).toBeGreaterThan(0);
    });
});
