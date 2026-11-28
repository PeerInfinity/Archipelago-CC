// ⚖ Robert 2026-11-02 CI manual-only P1: TRAIN tier. Runs on js-land/** train pushes and on dispatch (`-f train=true`),
// NOT on a slice push — a solver change that moves this pin reds at the train, unless the slice dispatches the train tier
// first (js-16's packet rule). `npm run test:unit:train`.
/**
 * seedlingDemo/hammerKeylockTurretEdgeBait.train.test — ⛓⛓ SEEDLING HAMMER-PHASE EDGEBAIT (`KEYLOCK_TURRET_EDGE_BAIT`,
 * OFF) as the page's worker solves it (`solveAnytime`, its two passes, budget 640), on L40's south key line (the keylock
 * arm's own goal, `bosslock@480,352` cleared):
 *   - legs 853 and 854's stagings (arrivals (488,904) from L39 and (328,600) from L43) after a 100-tick idle (the door
 *     below the turret open): OFF the budget runs out in APPROACH's forks, every try hit; ON solved on the dashless pass,
 *     the keys replayed on a FRESH run hitless and deathless, the lock open and the turret dead;
 *   - the door-shut control (leg 854 at tick 0, which solves today at rank 0): ON's plan is OFF's, key for key.
 */
import { describe, expect, it } from 'vitest';

import { LEG_395, LEG_412, l40Flag8Staging } from './hammerKeylockTurretL40.js';
import { solveL40Lock } from './hammerKeylockTurretEdgeBaitRows.js';
import { withKeylockTurretEdgeBait } from './solverBot.js';

const BUDGET = 640;

describe('hammer-phase EDGEBAIT on the L40 south key line (train)', () => {
    for (const [name, leg] of [['853 (from L39)', LEG_395], ['854 (from L43)', LEG_412]]) {
        it(`leg ${name}, the lock's goal after a 100-tick idle: OFF out of budget in the approach; ON solved, fresh run hitless`, () => {
            const staging = l40Flag8Staging({ ...leg, door: true });
            const off = withKeylockTurretEdgeBait(false, () => solveL40Lock(staging, { idle: 100, budget: BUDGET }));
            expect(off.ok).toBe(false);
            expect(off.passes[0]).toMatchObject({ pass: 'dashless', ok: false, deadline: 'crusher-fork', limit: 'budget' });
            const on = withKeylockTurretEdgeBait(true, () => solveL40Lock(staging, { idle: 100, budget: BUDGET }));
            expect(on.ok).toBe(true);
            expect(on.passes[0]).toMatchObject({ pass: 'dashless', ok: true, modelHits: { hits: 0, deaths: 0 } });
            expect(on.hits).toEqual([]);
            expect(on.deaths).toBe(0);
            expect(on.open).toBe(true);
            expect(on.dead).toBe(true);
        }, 300000);
    }

    it('the door-shut control (leg 854 at tick 0): ON\'s plan is OFF\'s, key for key', () => {
        const staging = l40Flag8Staging({ ...LEG_412, door: true });
        const off = withKeylockTurretEdgeBait(false, () => solveL40Lock(staging, { budget: BUDGET }));
        const on = withKeylockTurretEdgeBait(true, () => solveL40Lock(staging, { budget: BUDGET }));
        expect(off.ok).toBe(true);
        expect(off.hits).toEqual([]);
        expect(on.ok).toBe(true);
        expect(on.solution).toEqual(off.solution);
        expect(on.work).toBe(off.work);
    }, 300000);
});
