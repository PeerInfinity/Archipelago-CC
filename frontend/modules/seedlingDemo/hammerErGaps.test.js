/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE ER-C1-C3-C4 — two solver gaps the GAME allows (rules-6's ER witness, `probe-seedling-er-
 * landings.mjs`), each behind its own OFF switch. ⚖ The user approved the slice on 2026-11-12 (the hammer replan).
 *
 *   `UNHELD_LOCK_NEXT_DOOR`  a frontier door whose resolver answers `held: false` (an item the run lacks) is a wall for
 *                            the pick: the next door that binds is the round's order (c1, L12's chest without a Shield).
 *   `CHASER_PASS`            the ladder's last rung walks a corridor past a chaser on a fork, hitless (c3, L40).
 *
 * The states are the witness probe's own stagings (`landingStaging`: the campaign's post-sword latch re-pointed at the
 * landing, holding exactly the survey's items). Each row solves as the probe's MODEL rows do (`solveFrom`, the
 * survey's `twoPassSolve`). ⚖ 30(c): the solved plan is replayed on a FRESH tape stepper of its staging, and its hits,
 * writes and end are read from there. c3's ON row (≈3 min) is `hammerErGaps.train.test.js`.
 * MEASURED: `CC/docs/cloud-reports/seedling-hammer-er-c1-c3-c4.md`.
 */

import { describe, expect, it } from 'vitest';

import {
    CHASER_PASS, CHASER_PASS_DEFAULT, UNHELD_LOCK_NEXT_DOOR, UNHELD_LOCK_NEXT_DOOR_COUNTS, UNHELD_LOCK_NEXT_DOOR_DEFAULT,
    withChaserPass, withUnheldLockNextDoor,
} from './solverBot.js';
import { SOLVER_ENV_NAMES } from './solverEnvChannel.js';
import { replaySolved, solveCase } from './hammerErGapsLegs.js';

const ENV = globalThis.process?.env ?? {};

const verbsOf = (solved) => (solved.out.trace?.rows ?? [])
    .map((r) => `${r.strategy?.verb ?? '?'}${r.obstacle?.id ? `(${r.obstacle.id})` : ''}`);

describe('hammer-phase ER-C1-C3 — the switches', () => {
    it('both ship OFF (`=1` turns each on), and the page channel knows the names', () => {
        expect([UNHELD_LOCK_NEXT_DOOR_DEFAULT, CHASER_PASS_DEFAULT]).toEqual([false, false]);
        expect(UNHELD_LOCK_NEXT_DOOR.enabled).toBe(ENV.SEEDLING_UNHELD_LOCK_NEXT_DOOR === '1');
        expect(CHASER_PASS.enabled).toBe(ENV.SEEDLING_CHASER_PASS === '1');
        for (const n of ['SEEDLING_UNHELD_LOCK_NEXT_DOOR', 'SEEDLING_CHASER_PASS']) expect(SOLVER_ENV_NAMES).toContain(n);
        expect([CHASER_PASS.viaRadius, CHASER_PASS.vias]).toEqual([96, 24]);
    });
});

describe('hammer-phase ER-C1 — L12\'s chest without the Shield (`UNHELD_LOCK_NEXT_DOOR`)', () => {
    it('OFF: the frontier names the Shield lock and the touch refuses it as a SUB-ORDER', () => withUnheldLockNextDoor(false, async () => {
        const { refusal } = await solveCase('c1-l12-chest');
        expect(String(refusal?.message)).toMatch(/touch: shieldlocknorm@288,704 needs `Player\.hasShield`, which this run does not hold/);
    }), 60_000);

    it('ON: the Red Key lock, then the tree, then the chest — the sub-goal walk\'s verbs; replayed hitless, the Shield lock never written', () => withUnheldLockNextDoor(true, async () => {
        UNHELD_LOCK_NEXT_DOOR_COUNTS.tries.length = 0;
        const { staging, solved, refusal } = await solveCase('c1-l12-chest');
        expect(refusal).toBeUndefined();
        expect(UNHELD_LOCK_NEXT_DOOR_COUNTS.tries.map(({ unheld, order }) => [unheld, order])).toEqual([
            ['shieldlocknorm@288,704', 'keylock(bosslock@416,240)'],
            ['shieldlocknorm@288,704', 'burn(burnabletree@480,640)'],
        ]);
        expect(verbsOf(solved)).toEqual(['kill(puncher@416,256)', 'walk', 'burn(burnabletree@480,640)', 'walk', 'walk',
            'chest']);
        expect(solved.out.perTick.length).toBe(1753);
        const rec = replaySolved(staging, solved, 'er-gaps-c1');
        expect(rec.playerHits).toEqual([]);
        expect(rec.earnedClears.map(({ level, tag }) => `${level}:${tag}`)).toEqual(['12:4', '12:2']);
        expect(rec.earnedClears.some((c) => c.tag === 10)).toBe(false);
        // the game witness's own end (probe-seedling-er-landings, the bare goal ON: 1754 obs, wrote 12:2 12:4 12:9)
        expect(rec.ticks.at(-1)).toEqual({ t: 1753, x: 328.71104419062124, y: 834.5630671688936, level: 12 });
    }), 120_000);
});

describe('hammer-phase ER-C3 — L40\'s stairs to the pit with the Sword only (`CHASER_PASS`)', () => {
    it('OFF: the ladder is EXHAUSTED on puncher@128,624 (the kill arm\'s TIMING)', () => withChaserPass(false, async () => {
        const { refusal } = await solveCase('c3-l40-pit');
        const m = String(refusal?.message);
        expect(m).toMatch(/reach-pit \(14,27\)->L43: the combat ladder is EXHAUSTED/);
        expect(m).toMatch(/chaser:puncher@128,624/);
        expect(m).not.toMatch(/\n {2}pass:/);
    }), 120_000);
});
