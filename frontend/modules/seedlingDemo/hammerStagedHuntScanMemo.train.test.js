/**
 * seedlingDemo/hammerStagedHuntScanMemo.train.test — ⛓⛓ SEEDLING HAMMER-PHASE STAGED-HUNT-CHEAP (`STAGED_HUNT_SCAN_MEMO`,
 * OFF; train tier: two ~260 s solves) on BK2COMBAT's chain: the latch boot re-booted at (488,579), the pocket
 * SHUT, under POCKET-BURN's arm + OPP +
 * `CHASER_STAGED_HUNT` (`hammerBk2Combat.slow.test.js`'s ON row). With the memo ON the staged hunt stages where it
 * staged, waits as long, and the solve ends on the same refusal with the same ticks, byte for byte; the memo was reused
 * on every still tick after the first (one build per staging cell's fork, one for the run's own re-ask).
 */
import { describe, expect, it } from 'vitest';

import { l40LatchBoot, l40LatchSolve } from './fidelityL40Latch.js';
import { withOpportunisticStrike } from './pressKillCost.js';
import {
    CHASER_STAGED_HUNT_COUNTS, resetChaserStagedHuntCounts, withApproachDoor, withChaserStagedHunt, withFifthOrder,
    withLatchWeighFirst, withStanceBurn, withTurretApproach,
} from './solverBot.js';
import {
    STAGED_HUNT_SCAN_MEMO_COUNTS, resetStagedHuntScanMemoCounts, withStagedHuntScanMemo,
} from './stagedHuntScanMemo.js';

const SOLDIER = 'bobsoldier@880,832';

async function southBootShut() {
    const base = await l40LatchBoot();
    return { ...base, boot: { ...base.boot, x: 480, y: 571 },
        persistence: base.persistence.filter((p) => !(p.level === 40 && p.tag === 0)) };
}

function arm(boot, memo) {
    resetChaserStagedHuntCounts();
    resetStagedHuntScanMemoCounts();
    return withLatchWeighFirst(true, () => withTurretApproach(true, () => withApproachDoor(true,
        () => withFifthOrder(true, () => withStanceBurn(true, () => withOpportunisticStrike(true,
            () => withChaserStagedHunt(true, () => withStagedHuntScanMemo(memo, () => l40LatchSolve(boot)))))))));
}

describe('hammer-phase STAGED-HUNT-CHEAP on BK2COMBAT\'s pocket-shut chain (train)', () => {
    it('memo ON answers CHASER_STAGED_HUNT\'s refusal byte for byte, staged at (856,856) after 15 still ticks, '
        + 'reusing the scan on every still tick after the first', async () => {
        const boot = await southBootShut();
        const off = await arm(boot, false);
        const offAsks = CHASER_STAGED_HUNT_COUNTS.asks.map((a) => ({ ...a }));
        expect(STAGED_HUNT_SCAN_MEMO_COUNTS).toEqual({ builds: 0, hits: 0, unkeyed: 0, cellsReused: 0, cellsAsked: 0 });
        const on = await arm(boot, true);
        expect(CHASER_STAGED_HUNT_COUNTS.asks).toEqual(offAsks);
        expect(offAsks).toEqual([{ id: SOLDIER, t: 680, cell: { x: 856, y: 856 }, wait: 15, verdict: 'staged' }]);
        expect(on.out).toBeNull();
        expect(on.refusal.message).toBe(off.refusal.message);
        expect(on.refusal.obstacle).toEqual(off.refusal.obstacle);
        expect(on.refusal.perTick.map((k) => [...k].join('+')).join(','))
            .toBe(off.refusal.perTick.map((k) => [...k].join('+')).join(','));
        // 16 fork asks (d 0..15) + the run's re-ask: the fork's 15 later asks reuse the first's floods
        expect(STAGED_HUNT_SCAN_MEMO_COUNTS.unkeyed).toBe(0);
        expect(STAGED_HUNT_SCAN_MEMO_COUNTS.hits).toBeGreaterThanOrEqual(15);
        expect(STAGED_HUNT_SCAN_MEMO_COUNTS.cellsReused).toBeGreaterThan(10 * STAGED_HUNT_SCAN_MEMO_COUNTS.cellsAsked);
    }, 1800000);
});
