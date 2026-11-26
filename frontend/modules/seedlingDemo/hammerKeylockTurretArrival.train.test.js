// ⚖ Robert 2026-11-02 CI manual-only P1: TRAIN tier. Runs on js-land/** train pushes and on dispatch (`-f train=true`),
// NOT on a slice push — a solver change that moves this pin reds at the train, unless the slice dispatches the train tier
// first (js-16's packet rule). `npm run test:unit:train`.
/**
 * seedlingDemo/hammerKeylockTurretArrival.train.test — ⛓⛓ SEEDLING HAMMER-PHASE KT-ARRIVAL (`KEYLOCK_TURRET_ARRIVAL`, OFF)
 * on the whole-game walk's own wall (re-measure-7: 3/3 wasm runs stop at entry 29, survey step 134):
 *   - the page worker's captured request A1 29:11 (`fixtures/kt-arrival/`, its L40/L41 records; budget 640): OFF the
 *     HARD refusal it answered live (work 74); ON solved inside 640 on the dashless pass, into L41, and the keys
 *     replayed on a FRESH run are hitless and deathless;
 *   - L40 leg 395's staging (arrival (488,904) from L39, the same boot as the capture) with the same goal: ON solved,
 *     fresh-replayed hitless;
 *   - the door shut (no tag 12): the stance walk is never reached (the latch's button room refuses first), nothing is
 *     asked, and ON's refusal is OFF's.
 */
import { describe, expect, it } from 'vitest';

import { LEG_395, l40Flag8Staging } from './hammerKeylockTurretL40.js';
import { solveCapturedA1, solveL40Exit } from './hammerKeylockTurretArrivalRows.js';
import { KEYLOCK_TURRET_ARRIVAL_COUNTS, resetKeylockTurretArrivalCounts, withKeylockTurretArrival } from './solverBot.js';

describe('hammer-phase KT-ARRIVAL on the L40 south arrival (train)', () => {
    it('A1 29:11 (the captured request): OFF the live HARD refusal; ON solved inside 640 into L41, fresh run hitless', () => {
        const off = withKeylockTurretArrival(false, () => solveCapturedA1());
        expect(off.ok).toBe(false);
        expect(off.work).toBe(74);
        expect(off.message).toMatch(/reach-exit \(944,96\)->L41 -> keylock stance \(bosslock@480,352\): the combat ladder is EXHAUSTED/);
        resetKeylockTurretArrivalCounts();
        const on = withKeylockTurretArrival(true, () => solveCapturedA1());
        expect(on.ok).toBe(true);
        expect(on.passes[0]).toMatchObject({ pass: 'dashless', ok: true, modelHits: { hits: 0, deaths: 0 } });
        expect(on.passes[0].work).toBeLessThanOrEqual(640);
        expect(on.hits).toEqual([]);
        expect(on.deaths).toBe(0);
        expect(on.crossed).toEqual({ t: on.ticks, to: 41 });
        // asked once per pass the solve ran (the dashless pass solved; the full pass ran to its budget)
        expect(KEYLOCK_TURRET_ARRIVAL_COUNTS.asked.length).toBeGreaterThan(0);
        expect(new Set(KEYLOCK_TURRET_ARRIVAL_COUNTS.asked.map((a) => JSON.stringify(a.turrets)))).toEqual(
            new Set([JSON.stringify(['iceturret@472,400'])]));
    }, 300000);

    it('L40 leg 395 staging, goal teleporter@944,96: ON solved into L41, fresh run hitless', () => {
        const on = withKeylockTurretArrival(true, () => solveL40Exit(l40Flag8Staging({ ...LEG_395, door: true })));
        expect(on.ok).toBe(true);
        expect(on.hits).toEqual([]);
        expect(on.deaths).toBe(0);
        expect(on.crossed?.to).toBe(41);
    }, 300000);

    it('the door shut: nothing asked, ON refuses as OFF does', () => {
        const staging = l40Flag8Staging({ ...LEG_395, door: false });
        const off = withKeylockTurretArrival(false, () => solveL40Exit(staging));
        resetKeylockTurretArrivalCounts();
        const on = withKeylockTurretArrival(true, () => solveL40Exit(staging));
        expect(off.ok).toBe(false);
        expect(on).toEqual(off);
        expect(KEYLOCK_TURRET_ARRIVAL_COUNTS.asked).toEqual([]);
    }, 300000);
});
