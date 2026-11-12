/**
 * ⛓⛓⛓ SEEDLING HAMMER-PHASE ER-C3 — the train-tier row (≈3 min): L40 from the stairs to the pit with the Sword only,
 * `CHASER_PASS` ON. The default-tier rows (the switches, c1 OFF/ON, c3 OFF) are `hammerErGaps.test.js`.
 *
 * MEASURED: the rung passes `puncher@128,624` on a fork, hitless, by the one-via corridor through (216,680) — the
 * witness's own shape (down the stairs' column, west under the pocket) — and the walk re-plans from past the body's
 * leash. The leg then refuses in the BAIT arm on the corridor Bobs: the Bob it baits has already left the world (the
 * room's kill region removed it) — a bait-arm defect this slice hands over, pinned here so its fix shows.
 * ⚖ 30(c): the pass is replayed on a FRESH run of the staging, and its hits are read from there.
 */

import { describe, expect, it } from 'vitest';

import { CHASER_PASS_COUNTS, withChaserPass } from './solverBot.js';
import { createRunForStaging } from './tapeRunner.js';
import { atlasLevelSource } from './levelSource.js';
import { solveCase } from './hammerErGapsLegs.js';

describe('hammer-phase ER-C3 — L40\'s stairs to the pit with the Sword only (`CHASER_PASS` ON)', () => {
    it('the puncher is passed hitless by the via (216,680) walk (a 442-tick prefix); the leg then refuses in the bait arm on a Bob already gone', () => withChaserPass(true, async () => {
        CHASER_PASS_COUNTS.tries.length = 0;
        const { staging, refusal } = await solveCase('c3-l40-pit');
        const ok = CHASER_PASS_COUNTS.tries.filter((r) => r.ok);
        expect(ok.map(({ t, via, ticks }) => ({ t, via, ticks }))).toEqual([{ t: 0, via: { x: 216, y: 680 }, ticks: 442 }]);
        expect(CHASER_PASS_COUNTS.tries[0]).toMatchObject({ via: null, ok: false,
            why: 'the fork\'s walk is hit at t265 by chaser:puncher@128,624' });
        expect(String(refusal?.message)).toMatch(/bait \(bob@\d+,\d+\): the dwell's condition \(bob@\d+,\d+ has left the world/);
        if (Array.isArray(refusal.perTick)) {
            const run = createRunForStaging(JSON.parse(JSON.stringify(staging)), atlasLevelSource(), { scratchPersistence: true });
            for (const k of refusal.perTick.slice(0, 442)) run.advance(k);
            expect(run.playerHits).toEqual([]);
            expect(run.level).toBe(40);
        }
    }), 600_000);
});
