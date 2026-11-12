/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE BAIT-REMOVED — the train-tier rows (≈6 min): the two witnesses of the bait arm's
 * "ALREADY TRUE" refusal, OFF and ON (`BAIT_TARGET_GONE`). The default-tier rows are `hammerBaitRemoved.test.js`.
 *
 * MEASURED: (1) L99 east (96,112) → (48,96), Sword only (the post-sword latch): OFF refuses on `bait (lavarunner@160,32)`
 * — chosen at t169, removed by the room at t317, stance reached at t327; ON SOLVES hitless into L100. (2) ER c3, L40 to
 * the pit with `CHASER_PASS` ON: OFF refuses on `bait (bob@224,496)` (removed at t587, stance t664); ON the inner bait is
 * done and the leg goes past it, to the next named wall: the OUTER bait's (bob@208,448, removed at t625) stance walk
 * re-plans from the pit's edge and drops into L43 at t688 hitless, then refuses aiming at a stance in the room it left.
 */

import { describe, expect, it } from 'vitest';

import { BAIT_TARGET_GONE_COUNTS, withBaitTargetGone, withChaserPass } from './solverBot.js';
import { createRunForStaging } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { replaySolved, solveCase } from './hammerErGapsLegs.js';
import { POST_SWORD_BASE, landingStaging, solveFrom } from '../../../scripts/procgen/probe-seedling-er-landings.mjs';

const L99_EAST = { base: POST_SWORD_BASE, boot: { level: 99, x: 96, y: 112 }, items: [], keys: [],
    goal: { kind: 'reach-exit', exit: { x: 48, y: 96 } } };

async function solveL99East() {
    const staging = await landingStaging(L99_EAST);
    try {
        return { staging, solved: await solveFrom(staging, [L99_EAST.goal], 'bait-removed-l99-east') };
    } catch (refusal) {
        return { staging, refusal };
    }
}

const ALREADY_TRUE = (id) => new RegExp(`-> bait \\(${id}\\) stance -> bait \\(${id}\\): the dwell's condition `
    + `\\(${id} has left the world — the room's own kill region removed it\\) is ALREADY TRUE before a tick is spent`);

describe('hammer-phase BAIT-REMOVED — the witnesses', () => {
    it('L99 east → (48,96), Sword only: OFF refuses on the bait whose body is already gone', () => withBaitTargetGone(false, async () => {
        const { refusal } = await solveL99East();
        expect(String(refusal?.message)).toMatch(/reach-exit \(48,96\)->L100 -> kill -> chaser kill \(lavarunner@160,32\) stance/);
        expect(String(refusal?.message)).toMatch(ALREADY_TRUE('lavarunner@160,32'));
    }), 600_000);

    it('L99 east → (48,96), Sword only: ON solves hitless into L100 (649 t), the bait counted gone', () => withBaitTargetGone(true, async () => {
        BAIT_TARGET_GONE_COUNTS.gone.length = 0;
        const { staging, solved, refusal } = await solveL99East();
        expect(refusal).toBeUndefined();
        expect(solved.out.perTick.length).toBe(649);
        expect(BAIT_TARGET_GONE_COUNTS.gone).toContainEqual({ id: 'lavarunner@160,32', chosenAt: 169, arrivedAt: 327 });
        const run = createRunForStaging({ ...JSON.parse(JSON.stringify(staging)), persistence: solved.persistence ?? staging.persistence },
            atlasLevelSource());
        for (const k of solved.out.perTick) run.advance(new Set(k));
        expect(run.playerHits).toEqual([]);
        expect(run.level).toBe(100);
        const r = replaySolved(staging, solved, 'bait-removed-l99-east');
        expect(r.playerHits).toEqual([]);
        expect(r.ticks.at(-1).level).toBe(100);
    }), 600_000);

    it('ER c3 (L40 → pit, `CHASER_PASS`): ON goes past the bait — the next wall is the outer bait\'s stance walk in L43', () => withChaserPass(true, () => withBaitTargetGone(true, async () => {
        BAIT_TARGET_GONE_COUNTS.gone.length = 0;
        const { staging, refusal } = await solveCase('c3-l40-pit');
        expect(BAIT_TARGET_GONE_COUNTS.gone).toContainEqual({ id: 'bob@224,496', chosenAt: 442, arrivedAt: 664 });
        const msg = String(refusal?.message);
        expect(msg).not.toMatch(/ALREADY TRUE/);
        expect(msg).toMatch(/-> bait \(bob@208,448\) stance: the re-planned corridor failed too .* in level 43/s);
        const run = createRunForStaging(JSON.parse(JSON.stringify(staging)), atlasLevelSource(), { scratchPersistence: true });
        let landed = null;
        refusal.perTick.forEach((k, i) => { run.advance(new Set(k)); if (landed === null && run.level === 43) landed = i + 1; });
        expect(landed).toBe(688);
        expect(run.playerHits).toEqual([]);
    })), 600_000);
});
