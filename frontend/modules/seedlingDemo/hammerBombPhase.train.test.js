// TRAIN tier (⚖ Robert 2026-11-02, CI manual-only P5): each row is a whole L40 solve (12–30 s). Runs on js-land/** train
// pushes and on dispatch (`-f train=true`), NOT on a slice push. `npm run test:unit:train`.
/**
 * seedlingDemo/hammerBombPhase.train.test — ⛓⛓ SEEDLING HAMMER-PHASE 376-BOMB: L40 leg 376's bomb phase
 * (`BOMB_PHASE_WAIT`, OFF). ⚖ The user queued the slice on 2026-11-07 ("Yes, hammer slice (Recommended)").
 *
 * The state is the page's own request for leg 376 (`level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem
 * Part 64,144`), captured on `seedling_bot_ap_p4g` at seam 5271 by fidelity KNOCKBACK376 (its witness's `request`
 * field, unchanged; the level source is the committed atlas), replayed at another arrival clock (`atSeamTime`'s one
 * field). The leg's answer is a function of `seam mod 45` (the hammer phase): 5243 and 5333 are both phase 23.
 *   - OFF at phase 23: the page's 640 trips at `crusher-fork` (the forced-hit rung's forks), and uncapped the ladder is
 *     EXHAUSTED by name at 8450 units on `bombpusher@112,128#17` at the goal (W0). The first blast is #13: launched at
 *     t1400 at the player walking to the rock (200,136), it lands at (207,141) on t1432, 2 ticks after the break's
 *     20-tick stand, 9.4 px from the stance — a hit no input escapes (the forced-hit rung proves it at depth 1).
 *   - ON: the walk to the break stance (200,136) is previewed as it will be driven with its stance tail (the break's
 *     2 + 20 still ticks + 12 escape ticks, bombs only), so it meets #13; TIME's bomb arm waits 4 still ticks at
 *     (216.1,152.1), the same corridor re-probes clean, and the re-planned walk's stop is clean too. The leg SOLVES
 *     hitless, inside the page's first 640, and the plan replays on a FRESH run row for row with no hit and no death
 *     (30(c)).
 *   - Phase 15 (seam 5280) is the control: its walks' arrival tails meet bombs, the arm finds no clean wait and rewinds,
 *     and the plan is OFF's key for key.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { restoreRequest } from '../../../scripts/procgen/seedlingSolveRequestCodec.js';
import { atlasLevelSource } from './levelSource.js';
import { ANYTIME_PASSES, replayTape, solveAnytime } from './jsRuntimeSolver.js';
import { BOMB_PHASE_WAIT, BOMB_PHASE_WAIT_COUNTS, withBombPhaseWait } from './solverBot.js';
import { withL40Flip } from './l40FlipSet.js'; // ⛓ L40-FLIP-BUILD: BEFORE pins recorded without the flip set

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = join(HERE, 'fixtures', 'hammer-376-bomb');
const LEG376 = JSON.parse(gunzipSync(readFileSync(join(FIX, 'leg376-l40-request.json.gz'))).toString('utf8'));
const TIMEOUT = 240_000;

const resetCounts = () => {
    BOMB_PHASE_WAIT_COUNTS.asked = 0;
    BOMB_PHASE_WAIT_COUNTS.kept = [];
    BOMB_PHASE_WAIT_COUNTS.refused = [];
};

/** The captured request at arrival clock `seam`, the switch at `on`, the work budget `budget` (the page's 640). */
function solve376(seam, on, budget = 640) {
    const captured = LEG376.request;
    const req = restoreRequest({ ...captured, staging: { ...captured.staging,
        seam: { ...captured.staging.seam, time: seam } } });
    const { passes = ANYTIME_PASSES, budgetWork: _b, upgradeWindowWork: _w, ...tape } = req;
    resetCounts();
    const answer = withBombPhaseWait(on, () => solveAnytime({ ...tape, levelSource: atlasLevelSource(),
        budgetWork: budget, upgradeWindowWork: budget }, { passes }));
    return { answer, tape, counts: { asked: BOMB_PHASE_WAIT_COUNTS.asked, kept: [...BOMB_PHASE_WAIT_COUNTS.kept],
        refused: [...BOMB_PHASE_WAIT_COUNTS.refused] } };
}

/** ⚖ 30(c): the plan's keys on a FRESH run of the request's staging, row by row; its hits and deaths. */
function replayFresh(tape, plan) {
    const run = replayTape({ staging: tape.staging, perTick: tape.perTick, levelSource: atlasLevelSource(),
        scratchPersistence: tape.scratchPersistence === true, equips: tape.equips ?? null, holds: tape.holds ?? null });
    const row = () => ({ level: run.level, x: run.state.x, y: run.state.y, deaths: run.playerDeaths.length });
    const hits0 = run.playerHits.length;
    const deaths0 = run.playerDeaths.length;
    let mismatches = 0;
    const same = (a, b) => a.level === b.level && a.x === b.x && a.y === b.y && a.deaths === b.deaths;
    if (!same(row(), plan.expected[0])) mismatches += 1;
    for (let k = 0; k < plan.solution.length; k += 1) {
        const slot = plan.equipsAt?.get?.(k);
        if (slot !== undefined) run.equipNow(slot);
        run.advance(plan.solution[k]);
        const want = plan.expected[k + 1];
        if (want && !same(row(), want)) mismatches += 1;
    }
    return { mismatches, hits: run.playerHits.length - hits0, deaths: run.playerDeaths.length - deaths0,
        level: run.level };
}

const digest = (plan) => createHash('md5').update(JSON.stringify(plan.solution.map((k) => [...k].sort())))
    .digest('hex').slice(0, 12);

describe('hammer-phase 376-BOMB — leg 376 at hammer phase 23', () => {
    it('OFF: the page\'s 640 trips at the forced-hit rung\'s forks (main\'s answer)', () => withL40Flip(false, () => {
        const { answer, counts } = solve376(5333, false);
        expect(BOMB_PHASE_WAIT.enabled).toBe(false);
        expect(answer.ok).toBe(false);
        expect(answer.work).toBe(642);
        expect(answer.passes.map((p) => [p.pass, p.ok, p.work, p.deadline ?? null])).toEqual([
            ['dashless', false, 641, 'crusher-fork'], ['full', false, 1, 'walk']]);
        expect(counts.asked).toBe(0);
    }), TIMEOUT);

    it('ON: SOLVED hitless inside the page\'s 640, by a 4-tick still wait before the walk to the rock', () => {
        for (const seam of [5333, 5243]) {
            const { answer, tape, counts } = solve376(seam, true);
            expect(answer.ok).toBe(true);
            expect(answer.work).toBeLessThanOrEqual(640);
            const fresh = replayFresh(tape, answer.plan);
            expect(fresh).toEqual({ mismatches: 0, hits: 0, deaths: 0, level: fresh.level });
            // the wait the arm kept: at the walk to (200,136), from rest at (216.1,152.1)
            const kept = counts.kept.map((k) => [k.tick, k.kind, k.ticks, Number(k.x.toFixed(1)), Number(k.y.toFixed(1))]);
            expect(kept[0]).toEqual([1390, 'still', 4, 216.1, 152.1]);
            expect(counts.refused).toEqual([]);
        }
    }, TIMEOUT);
});

describe('hammer-phase 376-BOMB — a control phase', () => {
    it('phase 15 (seam 5280): the arm is asked and keeps nothing, so ON = OFF key for key (rewound, no row)', () => withL40Flip(false, () => {
        const off = solve376(5280, false);
        const on = solve376(5280, true);
        expect(off.answer.ok).toBe(true);
        expect(on.answer.ok).toBe(true);
        expect(digest(on.answer.plan)).toBe(digest(off.answer.plan));
        expect(on.answer.plan.verbs).toEqual(off.answer.plan.verbs);
        expect(on.counts.asked).toBeGreaterThan(0);
        expect(on.counts.kept).toEqual([]);
        // the asks cost work units (the arm's `time` checkpoints and its probes), never a key
        expect(on.answer.work).toBeGreaterThan(off.answer.work);
    }), TIMEOUT);
});
