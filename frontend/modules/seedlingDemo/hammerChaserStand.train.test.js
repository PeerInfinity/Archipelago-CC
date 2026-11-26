/**
 * seedlingDemo/hammerChaserStand.train.test — ⛓ hammer-phase CHASER-STAND (`OPP_AIM_CHASERS`, `PRESS_KILL_STRIKE_BOMBS`,
 * both OFF): the witnesses.
 *
 * Re-measure-8's 32:10 (L40 Totem 64,144, the page worker's own request; `hammerPkswHitsRows.js`'s fixture) under all4
 * (`PRESS_KILL_START_WAIT`, `PRESS_KILL_REFUGE_BOMBS`, `DASH_STAND_SIGHT`; `LATCHED_HOLD_MOVE` is ON by default) at two
 * arrival clocks:
 *  - re-measure-9's F1 32:10 (P1 − 97 = 81985, the whole-game walk's own entry-32 continue): the plan ships
 *    `chaser:bob@272,112`'s hit, taken on an opportunistic AIM at that bob. With the aim's landing asked of the chasers,
 *    no plan with a hit is offered; with the strike's stand asked of the lobber, it solves hitless.
 *  - P1 + 7 (82089): every switch set ships `bomb:…#8` (the strike's stand); with the stand asked of the lobber it
 *    solves hitless.
 * Every plan's keys are replayed on a FRESH run after the request's own prefix. Train tier: six whole-request solves.
 */
import { describe, expect, it } from 'vitest';

import { TOTEM64_SEAM, solveCapturedTotem64 } from './hammerPkswHitsRows.js';
import {
    OPP_AIM_CHASERS_COUNTS, resetOppAimChasersCounts, withDashStandSight, withOppAimChasers,
    withPressKillRefugeBombs, withPressKillStartWait, withPressKillStrikeBombs,
} from './solverBot.js';

const F1 = TOTEM64_SEAM.P1 - 97;
const P1_PLUS_7 = TOTEM64_SEAM.P1 + 7;

const solveAll4 = ({ oac = false, psb = false, seam }) => {
    const solve = () => {
        resetOppAimChasersCounts();
        return solveCapturedTotem64(seam);
    };
    const withMine = () => withOppAimChasers(oac, () => withPressKillStrikeBombs(psb, solve));
    return withPressKillStartWait(true, () => withPressKillRefugeBombs(true, () => withDashStandSight(true, withMine)));
};

const hitless = (r) => {
    expect(r.ok).toBe(true);
    expect(r.hits).toEqual([]);
    expect(r.deaths).toBe(0);
    expect(r.end.level).toBe(40);
    for (const p of r.passes.filter((x) => x.ok)) expect(p.modelHits).toEqual({ hits: 0, deaths: 0 });
};

describe('OPP_AIM_CHASERS — re-measure-9 F1 32:10 under all4 (L40 Totem 64,144)', () => {
    it('both OFF: solved, and the plan ships the chaser hit the opportunistic aim walks into', () => {
        const r = solveAll4({ seam: F1 });
        expect(r.ok).toBe(true);
        expect(r.hits).toEqual(['t1799 chaser:bob@272,112']);
        expect(OPP_AIM_CHASERS_COUNTS).toEqual({ asked: 0, withheld: 0 });
    }, 240000);

    it('the aim asks the chasers: no plan with a hit is offered (the request refuses by name), aims were withheld', () => {
        const r = solveAll4({ oac: true, seam: F1 });
        expect(r.ok).toBe(false);
        expect(r.message).toMatch(/solverBot\(wasm-continue-location-40\)/);
        expect(OPP_AIM_CHASERS_COUNTS.withheld).toBeGreaterThan(0);
    }, 240000);

    it('the strike\'s stand asks the lobber too: solved, no hit and no death on a fresh replay', () => {
        hitless(solveAll4({ oac: true, psb: true, seam: F1 }));
    }, 240000);
});

describe('PRESS_KILL_STRIKE_BOMBS — P1 32:10 seven ticks late (the strike-stand bomb every switch set ships)', () => {
    it('both OFF, and the aim switch alone: solved with the stand\'s bomb hit', () => {
        for (const oac of [false, true]) {
            const r = solveAll4({ oac, seam: P1_PLUS_7 });
            expect(r.ok).toBe(true);
            expect(r.hits).toEqual(['t1644 bomb:bombpusher@112,128#8']);
        }
    }, 480000);

    it('the stand asks the lobber: solved, no hit and no death on a fresh replay', () => {
        hitless(solveAll4({ psb: true, seam: P1_PLUS_7 }));
    }, 240000);
});
