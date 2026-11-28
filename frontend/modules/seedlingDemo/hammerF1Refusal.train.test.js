/**
 * seedlingDemo/hammerF1Refusal.train.test — ⛓ hammer-phase F1-REFUSAL (`REFUSAL_STAND_BOMBS`, OFF): the witnesses.
 *
 * Re-measure-8's 32:10 (L40 Totem 64,144, the page worker's own request; `hammerPkswHitsRows.js`'s fixture) under the
 * five switches (`PRESS_KILL_START_WAIT`, `PRESS_KILL_REFUGE_BOMBS`, `DASH_STAND_SIGHT`, `OPP_AIM_CHASERS`,
 * `HIT_AVOID_STAND_BOMBS`; `LATCHED_HOLD_MOVE` is ON by default):
 *  - re-measure-9's F1 32:10 (P1 − 97 = 81985): every pass refuses (the dashless pass on the latched hold after the kill,
 *    the full pass on a strike-stand bomb's death), and HSB is never asked (no plan bills a hit). With the refusal asked
 *    of the widest pass under `PRESS_KILL_STRIKE_BOMBS`, it solves hitless.
 *  - P1 + 7 (82089): the ladder's plans bill a hit and HSB's try ships the hitless plan; the refusal switch is not asked.
 * Every plan's keys are replayed on a FRESH run after the request's own prefix. Train tier: three whole-request solves.
 */
import { describe, expect, it } from 'vitest';

import { TOTEM64_SEAM, solveCapturedTotem64 } from './hammerPkswHitsRows.js';
import { REFUSAL_STAND_BOMBS_COUNTS, withHitAvoidStandBombs, withRefusalStandBombs } from './jsRuntimeSolver.js';
import {
    withDashStandSight, withOppAimChasers, withPressKillRefugeBombs, withPressKillStartWait,
} from './solverBot.js';

const F1 = TOTEM64_SEAM.P1 - 97;
const P1_PLUS_7 = TOTEM64_SEAM.P1 + 7;

const solveFive = ({ rsb = false, seam }) => {
    const solve = () => {
        for (const k of Object.keys(REFUSAL_STAND_BOMBS_COUNTS)) REFUSAL_STAND_BOMBS_COUNTS[k] = 0;
        return solveCapturedTotem64(seam);
    };
    const withMine = () => withOppAimChasers(true, () => withHitAvoidStandBombs(true, () => withRefusalStandBombs(rsb, solve)));
    return withPressKillStartWait(true, () => withPressKillRefugeBombs(true, () => withDashStandSight(true, withMine)));
};

describe('REFUSAL_STAND_BOMBS — re-measure-9 F1 32:10 under the five switches (L40 Totem 64,144)', () => {
    it('OFF: every pass refuses — the full pass by a bomb death while pressing — and HSB is not asked', () => {
        const r = solveFive({ seam: F1 });
        expect(r.ok).toBe(false);
        expect(r.passes.map((p) => [p.pass, p.ok])).toEqual([['dashless', false], ['full', false]]);
        expect(r.message).toMatch(/by press: the player died at t\d+ \(bomb /);
        expect(REFUSAL_STAND_BOMBS_COUNTS.tried).toBe(0);
    }, 240000);

    it('ON: the widest pass asked again with the stand asking the lobber solves it — no hit and no death on a fresh replay', () => {
        const r = solveFive({ rsb: true, seam: F1 });
        expect(r.ok).toBe(true);
        expect(r.hits).toEqual([]);
        expect(r.deaths).toBe(0);
        expect(r.end.level).toBe(40);
        expect(r.passes.map((p) => [p.pass, p.ok])).toEqual([['dashless', false], ['full', false], ['refusal-stand-bombs', true]]);
        expect(r.passes.at(-1)).toMatchObject({ from: 'full', modelHits: { hits: 0, deaths: 0 } });
        expect(r.passes.at(-1).cut).toBeUndefined();
        expect(REFUSAL_STAND_BOMBS_COUNTS).toMatchObject({ tried: 1, replaced: 1 });
        // inside the attempt's own budget (the request's 640)
        expect(r.work).toBeLessThanOrEqual(640);
    }, 240000);
});

describe('REFUSAL_STAND_BOMBS — a solve never reaches it (P1 32:10 seven ticks late, HSB\'s own witness)', () => {
    it('ON: the same answer as OFF — HSB\'s hitless plan — and the refusal try is not made', () => {
        const off = solveFive({ seam: P1_PLUS_7 });
        const on = solveFive({ rsb: true, seam: P1_PLUS_7 });
        expect(on).toEqual(off);
        expect(on.ok).toBe(true);
        expect(on.hits).toEqual([]);
        expect(on.passes.map((p) => p.pass)).toEqual(['dashless', 'full', 'hit-avoid', 'stand-bombs']);
        expect(REFUSAL_STAND_BOMBS_COUNTS).toMatchObject({ refusals: 0, tried: 0 });
    }, 480000);
});
