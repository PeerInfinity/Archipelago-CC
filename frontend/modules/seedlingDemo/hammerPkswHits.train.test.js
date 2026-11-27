/**
 * seedlingDemo/hammerPkswHits.train.test — ⛓ hammer-phase PKSW-HITS (`PRESS_KILL_REFUGE_BOMBS`, OFF): the witness.
 *
 * Re-measure-8's 32:10 (L40 Totem 64,144, the page worker's own request; STEP149's fixture, `hammerPkswHitsRows.js`) at
 * two arrival clocks:
 *  - A1's (79143): with `PRESS_KILL_START_WAIT` the spinner press kill is redone hitless, and a SECOND press kill's refuge
 *    stands where bomb #9 lands (the plan ships one hit). With the refuge's bomb question asked as well, it solves
 *    hitless.
 *  - P1's minus 20 (82062): main OFF ships a plan with two bomb hits inside the first press kill. With the refuge's
 *    question alone the request refuses (no plan with a hit is offered); with `PRESS_KILL_START_WAIT` too it solves
 *    hitless.
 * Every plan's keys are replayed on a FRESH run after the request's own prefix. Train tier: four whole-request solves.
 */
import { describe, expect, it } from 'vitest';

import { TOTEM64_SEAM, solveCapturedTotem64 } from './hammerPkswHitsRows.js';
import { PRESS_KILL_REFUGE_BOMBS_COUNTS, withPressKillRefugeBombs, withPressKillStartWait } from './solverBot.js';

const solve = ({ pksw, refuge, seam }) => withPressKillStartWait(pksw, () => withPressKillRefugeBombs(refuge, () => {
    PRESS_KILL_REFUGE_BOMBS_COUNTS.asked = 0;
    PRESS_KILL_REFUGE_BOMBS_COUNTS.refused = 0;
    return solveCapturedTotem64(seam);
}));

describe('PRESS_KILL_REFUGE_BOMBS — re-measure-8 A1 32:10 (L40 Totem 64,144)', () => {
    it('PKSW alone: solved, and the plan ships the refuge\'s bomb hit', () => {
        const r = solve({ pksw: true, refuge: false, seam: TOTEM64_SEAM.A1 });
        expect(r.ok).toBe(true);
        expect(r.hits).toEqual(['t1690 bomb:bombpusher@112,128#9']);
        expect(PRESS_KILL_REFUGE_BOMBS_COUNTS).toEqual({ asked: 0, refused: 0 });
    }, 180000);

    it('PKSW + the refuge\'s bomb question: solved, no hit and no death on a fresh replay', () => {
        const r = solve({ pksw: true, refuge: true, seam: TOTEM64_SEAM.A1 });
        expect(r.ok).toBe(true);
        expect(r.hits).toEqual([]);
        expect(r.deaths).toBe(0);
        expect(r.end.level).toBe(40);
        for (const p of r.passes.filter((x) => x.ok)) expect(p.modelHits).toEqual({ hits: 0, deaths: 0 });
        expect(PRESS_KILL_REFUGE_BOMBS_COUNTS.refused).toBeGreaterThan(0);
    }, 180000);
});

describe('PRESS_KILL_REFUGE_BOMBS — P1 32:10 twenty ticks early (a plan main OFF ships with two bomb hits)', () => {
    const seam = TOTEM64_SEAM.P1 - 20;

    it('the refuge\'s question alone: no plan with a hit is offered (the request refuses)', () => {
        const r = solve({ pksw: false, refuge: true, seam });
        expect(r.ok).toBe(false);
        expect(PRESS_KILL_REFUGE_BOMBS_COUNTS.refused).toBeGreaterThan(0);
    }, 180000);

    it('with PKSW too: solved, no hit and no death on a fresh replay', () => {
        const r = solve({ pksw: true, refuge: true, seam });
        expect(r.ok).toBe(true);
        expect(r.hits).toEqual([]);
        expect(r.deaths).toBe(0);
    }, 180000);
});
