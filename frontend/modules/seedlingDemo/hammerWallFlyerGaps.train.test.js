/**
 * ⛓ hammer-phase WALLFLYER-GAPS G1 (train tier: the solve is ~30 s) — the STAGED HUNT's still-wait fork under a
 * deadline (`stagedChaserHunt`, `CHASER_STAGED_HUNT` ON by default). The witness is `hammerBk2Combat.train.test.js`'s
 * pocket-shut, OPP, ON solve (the latch boot south of the door): its staged hunt asks one fork at t680 from (856,856).
 * A deadline that trips every `crusher-fork` ask makes that fork `null`; before the guard the next line's
 * `f.ledger('playerHits')` threw `Cannot read properties of null (reading 'ledger')` out of the solve. Now the cell's
 * verdict is `deadline`, the hunt says so by name, and the solve refuses as a SolverRefusal.
 */
import { describe, expect, it } from 'vitest';

import { l40LatchBoot, L40LATCH_GOAL } from './fidelityL40Latch.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import {
    CHASER_STAGED_HUNT_COUNTS, resetChaserStagedHuntCounts, solveSegment, SolverRefusal, withApproachDoor,
    withChaserStagedHunt, withFifthOrder, withLatchWeighFirst, withSolveDeadline, withStanceBurn, withTurretApproach,
} from './solverBot.js';

describe('hammer-phase WALLFLYER-GAPS G1 — the staged hunt\'s fork under a deadline (train)', () => {
    it('pocket shut, OPP, ON, every `crusher-fork` ask tripped: the cell\'s verdict is `deadline`, never a TypeError', async () => {
        const { parseTape } = await import('./tapeFormat.js');
        const { createRunForStaging, solveStaging, stagingFromTape } = await import('./tapeRunner.js');
        const { atlasLevelSource } = await import('./levelSource.js');
        const base = await l40LatchBoot();
        const boot = { ...base, boot: { ...base.boot, x: 480, y: 571 },
            persistence: base.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) };
        const levelSource = atlasLevelSource();
        const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(boot))));
        resetChaserStagedHuntCounts();
        const solve = () => solveSegment({ run: createRunForStaging(staging, levelSource), goals: [L40LATCH_GOAL],
            name: 'l40latch', boot: staging.boot, dashMode: 'all', forkRun: () => createRunForStaging(staging, levelSource) });
        let err = null;
        try {
            withLatchWeighFirst(true, () => withTurretApproach(true, () => withApproachDoor(true, () => withFifthOrder(true,
                () => withStanceBurn(true, () => withOpportunisticStrike(true, () => withChaserStagedHunt(true,
                    () => withSolveDeadline({ shouldStop: (site) => site === 'crusher-fork', fineCheckpoints: true }, solve))))))));
        } catch (e) {
            err = e;
        }
        expect(err).toBeInstanceOf(SolverRefusal);
        expect(err.message).toContain('STAGED HUNT (CHASER_STAGED_HUNT): (856,856): the caller\'s anytime deadline tripped '
            + 'inside the still wait\'s fork.');
        expect(CHASER_STAGED_HUNT_COUNTS.asks).toEqual([
            { id: 'bobsoldier@880,832', t: 680, cell: { x: 856, y: 856 }, wait: null, verdict: 'deadline' }]);
    }, 900000);
});
