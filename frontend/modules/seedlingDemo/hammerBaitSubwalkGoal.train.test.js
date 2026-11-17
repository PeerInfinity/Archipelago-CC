/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE BAIT-SUBWALK-GOAL — the train-tier rows (≈6 min): ER c3 (L40 (320,592) → reach-pit
 * (14,27)->L43, Sword only, `CHASER_PASS` + `BAIT_TARGET_GONE` ON — the switch is reachable only past the inner bait),
 * OFF and ON (`SUBWALK_ANCESTOR_CROSSING`). The default-tier rows are `hammerBaitSubwalkGoal.test.js`.
 *
 * MEASURED: OFF, the outer bait's (bob@208,448) stance walk re-plans from the pit's edge, its drive falls into the
 * goal's pit at t688 (0 hits) and throws "crossed … without being asked to"; the walk counts that as a refuted
 * corridor, re-plans in L43 toward (40,424) and stalls 400 ticks — refused. ON, that crossing is handed to the
 * enclosing reach-pit walk (depth 1) and the leg SOLVES in 768 ticks, hitless, ending on the ground in L43.
 */

import { describe, expect, it } from 'vitest';

import { BAIT_TARGET_GONE_COUNTS, SUBWALK_ANCESTOR_CROSSING_COUNTS, withBaitTargetGone, withChaserPass,
    withSubwalkAncestorCrossing } from './solverBot.js';
import { createRunForStaging } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { replaySolved, solveCase } from './hammerErGapsLegs.js';

const PIT = 'solverBot(er-gaps-c3-l40-pit) reach-pit (14,27)->L43';

function both(on, fn) {
    return withChaserPass(true, () => withBaitTargetGone(true, () => withSubwalkAncestorCrossing(on, fn)));
}

describe('hammer-phase BAIT-SUBWALK-GOAL — ER c3', () => {
    it('OFF: the outer bait\'s stance walk falls into L43 at t688 hitless and refuses there', () => both(false, async () => {
        BAIT_TARGET_GONE_COUNTS.gone.length = 0;
        const { staging, refusal } = await solveCase('c3-l40-pit');
        expect(BAIT_TARGET_GONE_COUNTS.gone).toContainEqual({ id: 'bob@224,496', chosenAt: 442, arrivedAt: 664 });
        expect(String(refusal?.message)).toMatch(/-> bait \(bob@208,448\) stance: the re-planned corridor failed too .* in level 43, aiming at \(40,424\)/s);
        const run = createRunForStaging(JSON.parse(JSON.stringify(staging)), atlasLevelSource(), { scratchPersistence: true });
        let landed = null;
        refusal.perTick.forEach((k, i) => { run.advance(new Set(k)); if (landed === null && run.level === 43) landed = i + 1; });
        expect(landed).toBe(688);
        expect(run.playerHits).toEqual([]);
    }), 600_000);

    it('ON: the crossing is the reach-pit walk\'s — SOLVED in 768 ticks, hitless, into L43', () => both(true, async () => {
        SUBWALK_ANCESTOR_CROSSING_COUNTS.handed.length = 0;
        SUBWALK_ANCESTOR_CROSSING_COUNTS.unmatched.length = 0;
        const { staging, solved, refusal } = await solveCase('c3-l40-pit');
        expect(refusal).toBeUndefined();
        expect(solved.out.perTick.length).toBe(768);
        expect(SUBWALK_ANCESTOR_CROSSING_COUNTS.handed).toEqual([{ t: 688, from: 40, to: 43,
            sub: `${PIT} -> bait (bob@208,448) stance`, ancestor: PIT, depth: 1,
            at: SUBWALK_ANCESTOR_CROSSING_COUNTS.handed[0].at, arrival: SUBWALK_ANCESTOR_CROSSING_COUNTS.handed[0].arrival }]);
        expect(SUBWALK_ANCESTOR_CROSSING_COUNTS.unmatched).toEqual([]);
        const run = createRunForStaging({ ...JSON.parse(JSON.stringify(staging)), persistence: solved.persistence ?? staging.persistence },
            atlasLevelSource(), { scratchPersistence: true });
        for (const k of solved.out.perTick) run.advance(new Set(k));
        expect(run.playerHits).toEqual([]);
        expect(run.level).toBe(43);
        expect(run.transitions).toEqual([{ t: 688, from_level: 40, to_level: 43 }]);
        const r = replaySolved(staging, solved, 'bait-subwalk-goal-c3');
        expect(r.playerHits).toEqual([]);
        expect(r.ticks.at(-1).level).toBe(43);
    }), 600_000);
});
