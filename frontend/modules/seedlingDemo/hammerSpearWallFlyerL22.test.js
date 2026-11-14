/**
 * ⛓ hammer-phase SPEAR + WALLFLYER KILL (connected L22) — the rows that pin WHERE a spear-only run stops today, with
 * `WALLFLYER_KILL_ARM` and `SPEAR_ARM` (both OFF by default). No solver code is changed by this slice: the wall it
 * measured is the danger map's (fidelity's), and these rows are the hand-over's witness (slice report
 * `CC/docs/cloud-reports/seedling-hammer-spear-wallflyer-l22.md`).
 *
 * The leg is L22 entered by L25's door, aiming at the L29 exit, holding the spear and no blade (CONNECTED-L22's
 * request #49, whose staging this `canCross` ask reproduces: the same kill, ticks and forks):
 *   · OFF: the ladder EXHAUSTS on the first lane's flyer and no body-family arm is asked;
 *   · the wallflyer arm ON: it kills that flyer WITH THE SPEAR (`drillKillWeapon`'s pick; one stance's 5 px thrust
 *     line misses the body, the next lands), and the next climb refuses on the SAME id — now a corpse — because
 *     `dangerMap.staticEnemyDanger` still prices a wallflyer at its `.oel` placement after the run removed it
 *     (the spinners' U6 / the drills' `removed` exclusion, one class over). The arm is not asked again: the source is
 *     not a live flyer;
 *   · both arms ON: the same kill and the same wall (the spear arm adds the walk's strike policy and nothing else here).
 * When fidelity excludes a removed wallflyer from the static ingredient, the ON rows below go red by design: the
 * slice measured the leg then SOLVING hitless (379 t, L29, two flyers killed, game-witnessed at 0 hits).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { canCross } from './seedlingCanCross.js';
import {
    BODY_FAMILY_KILL_COUNTS, WALLFLYER_KILL_ARM, resetBodyFamilyKillCounts, withWallFlyerKillArm,
} from './solverBot.js';
import { SPEAR_ARM, SPEAR_ARM_COUNTS, resetSpearArmCounts, withSpearArm } from './spearArm.js';

const ASK = { level: 22, exit: 29, arrival: { from: 25 }, dashMode: 'none', witness: false, inventory: ['spear'] };
const FIRST = 'wallflyer@48,112';
const CORPSE = /the combat ladder is EXHAUSTED\. The corridor passes through danger at \([\d.]+,[\d.]+\) — enemy:wallflyer@48,112 \(a static "Enemy" body at its placement/;

const ask = (wallFlyer, spear) => {
    resetBodyFamilyKillCounts();
    resetSpearArmCounts();
    return withWallFlyerKillArm(wallFlyer, () => withSpearArm(spear, () => canCross(ASK)));
};

afterEach(() => {
    resetBodyFamilyKillCounts();
    resetSpearArmCounts();
});

describe('hammer-phase SPEAR + WALLFLYER KILL — L22 from L25\'s door to the L29 exit, spear only', () => {
    it('the wrappers restore both switches', () => {
        const was = [WALLFLYER_KILL_ARM.enabled, SPEAR_ARM.enabled];
        expect(withWallFlyerKillArm(true, () => withSpearArm(true, () => [WALLFLYER_KILL_ARM.enabled, SPEAR_ARM.enabled])))
            .toEqual([true, true]);
        expect([WALLFLYER_KILL_ARM.enabled, SPEAR_ARM.enabled]).toEqual(was);
    });

    it('OFF: EXHAUSTED on the first lane\'s flyer, no arm asked', () => {
        const r = ask(false, false);
        expect(r.verdict).toBe('cannot');
        expect(r.why).toMatch(CORPSE); // live here: the same placement row, before any kill
        expect(BODY_FAMILY_KILL_COUNTS.asked).toBe(0);
        expect(BODY_FAMILY_KILL_COUNTS.kills).toEqual([]);
    });

    it('the wallflyer arm ON: the spear kills the flyer, and the next climb refuses on its corpse\'s placement', () => {
        const r = ask(true, false);
        expect(r.verdict).toBe('cannot');
        expect(BODY_FAMILY_KILL_COUNTS.kills.map((k) => [k.id, k.family, k.t, k.ticks, k.forks]))
            .toEqual([[FIRST, 'wallflyer', 0, 85, 2]]);
        expect(BODY_FAMILY_KILL_COUNTS.asked).toBe(1); // the corpse is not a live flyer, so the arm is not asked again
        expect(r.why).toMatch(CORPSE);
        expect(SPEAR_ARM_COUNTS).toEqual({ policies: 0, equips: 0, swallowed: 0 });
    });

    it('both arms ON: the same kill and the same wall; the spear arm builds its policy', () => {
        const r = ask(true, true);
        expect(r.verdict).toBe('cannot');
        expect(BODY_FAMILY_KILL_COUNTS.kills.map((k) => [k.id, k.t, k.ticks, k.forks])).toEqual([[FIRST, 0, 85, 2]]);
        expect(BODY_FAMILY_KILL_COUNTS.asked).toBe(1);
        expect(r.why).toMatch(CORPSE);
        expect(SPEAR_ARM_COUNTS.policies).toBeGreaterThan(0);
    });
});
