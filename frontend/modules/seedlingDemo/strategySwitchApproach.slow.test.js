/**
 * SEEDLING STRATEGY SWITCH r1 × hammer-phase APPROACH — hammer-2's blocking review point: `approachKillForCorpse` kills
 * the turret IN PLACE inside the weigh (`TURRET_APPROACH` ON), never reaching `killForCorpse`'s gate, so it carries its
 * own `requireVerb('kill', 'weigh:approachKillForCorpse')` at its head, before any fork.
 *
 * The row: L40LATCH's latch chain under CPAIR size 3 + `LATCH_WEIGH_FIRST` + `TURRET_APPROACH` (the arm
 * `hammerTurretApproach.slow.test.js` solves to Boss Key 2 at t4142), solved with `disable: ['kill']`: it REFUSES
 * `STRATEGY_DISABLED` at that site, and no approach was made (nothing killed).
 */
import { describe, expect, it } from 'vitest';

import { L40LATCH_GOAL, l40LatchBoot } from './fidelityL40Latch.js';
import { parseTape } from './tapeFormat.js';
import { createRunForStaging, solveStaging, stagingFromTape } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { STRATEGY_DISABLED, withStrategySwitch } from './strategySwitch.js';
import {
    CHOOSER_PAIR, SolverRefusal, TURRET_APPROACH_COUNTS, resetTurretApproachCounts, solveSegment, withChooserPair,
    withLatchWeighFirst, withTurretApproach,
} from './solverBot.js';

describe('strategy switch × APPROACH — the in-place corpse kill is under the kill gate (hammer-2 review)', () => {
    it('TURRET_APPROACH ON + disable:[kill] refuses STRATEGY_DISABLED at weigh:approachKillForCorpse, approaching nothing', async () => {
        const boot = await l40LatchBoot();
        const levelSource = atlasLevelSource();
        const staging = solveStaging(stagingFromTape(parseTape(JSON.stringify(boot))));
        resetTurretApproachCounts();
        const was = CHOOSER_PAIR.size;
        CHOOSER_PAIR.size = 3;
        let err = null;
        try {
            withStrategySwitch(true, () => withChooserPair(true, () => withLatchWeighFirst(true,
                () => withTurretApproach(true, () => solveSegment({ run: createRunForStaging(staging, levelSource),
                    goals: [L40LATCH_GOAL], name: 'l40latch', boot: staging.boot, dashMode: 'all',
                    forkRun: () => createRunForStaging(staging, levelSource), disable: ['kill'] })))));
        } catch (e) {
            err = e;
        } finally {
            CHOOSER_PAIR.size = was;
        }
        expect(err).toBeInstanceOf(SolverRefusal);
        expect(err.code).toBe(STRATEGY_DISABLED);
        expect(err.message).toMatch(/strategy 'kill' is DISABLED for this solve \(`disable`\) and `weigh:approachKillForCorpse` \(iceturret@472,400\)/);
        expect(err.disabled.first).toEqual({ verb: 'kill', site: 'weigh:approachKillForCorpse', id: 'iceturret@472,400' });
        expect(TURRET_APPROACH_COUNTS.approaches).toEqual([]);
    }, 900000);
});
