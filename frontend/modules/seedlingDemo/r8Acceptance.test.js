import { describe, it, expect } from 'vitest';

import {
    R8_NORMALIZE_LIVE_BATCH, assertBatchSitesCoverSource, assertPlannerLivePartition,
    assertBatchIsModelSide,
} from './r8Acceptance.js';
import { LIVE_GEOMETRY_KEYS } from './levelWorld.js';
import { livePerVisitOpts } from './botDriverV2.js';

/**
 * ⛓⛓⛓ THE PREDICTION, BEFORE THE CHANGE — R8 slice 0 track B.
 *
 * R7 §11's pattern, whole: the batch is committed BEFORE a line of the sweep
 * moves, because a gate whose statement postdates the change is not a gate
 * (trap 40). What is asserted here is the SHAPE of the claim; what proves it
 * is the offline differential run after the last commit of the track.
 */
describe('R8_NORMALIZE_LIVE_BATCH — the prediction, stated first', () => {
    it('predicts ZERO fixture diffs and ZERO value changes — no re-record license exists', () => {
        expect(R8_NORMALIZE_LIVE_BATCH.predictedFixtureDiffs).toBe(0);
        expect(R8_NORMALIZE_LIVE_BATCH.predictedValueChanges).toEqual([]);
    });

    /**
     * ⛔ THE SITE LIST IS RE-DERIVED FROM THE SOURCE. This is the assertion
     * that cannot rot: a site added, removed or renamed fails BY NAME rather
     * than reading like a converted one (trap 89).
     */
    it('accounts for every live-geometry bag builder call site on disk', () => {
        const counted = assertBatchSitesCoverSource();
        // The claim is that each builder was COUNTED, not that it has a
        // particular count — the numbers are re-derived above and printed
        // here so a change in them is visible in the diff.
        expect(counted.map((c) => `${c.file}:${c.builder}`)).toEqual([
            'levelRun.js:liveSolidOpts',
            'botDriverV2.js:livePerVisitOpts',
            'botDriverV2.js:burnProbeOpts',
        ]);
        for (const c of counted) expect(c.sites).toBeGreaterThan(0);
    });

    it('names an action and a reason for every site — no unexplained conversions', () => {
        const ACTIONS = ['already', 'brand', 'brand+hoist', 'brand-not-hoisted'];
        for (const s of R8_NORMALIZE_LIVE_BATCH.sites) {
            expect(ACTIONS, `${s.file} ${s.at}`).toContain(s.action);
            expect(s.why.length, `${s.file} ${s.at}`).toBeGreaterThan(20);
        }
    });

    /**
     * ⛔ THE TWO SITES THE SOURCE ITSELF REFUSES TO HOIST. R5 slice 15's
     * crusher comment and R5 slice 22's turret loop both say, in as many
     * words, that the per-iteration rebuild is the mechanism. A batch that
     * hoisted them would be a behaviour change wearing a refactor's clothes,
     * so the refusal is asserted rather than remembered.
     */
    it('keeps the two load-bearing per-iteration rebuilds UNHOISTED, by name', () => {
        const refused = R8_NORMALIZE_LIVE_BATCH.sites
            .filter((s) => s.action === 'brand-not-hoisted').map((s) => s.at);
        expect(refused.sort()).toEqual(['stepCrushersNow', 'stepIceTurretsNow']);
    });

    /**
     * ⛔⛔ THE RECON-VERIFY FINDING, AS A TOTAL PARTITION.
     *
     * `plannerObstacleAt` forwards 8 of the 14 live families and drops 6, two
     * of which (`turrets`, `bosses`) `livePerVisitOpts` BUILDS AND PASSES IN.
     * The partition is asserted against `LIVE_GEOMETRY_KEYS` so that a
     * fifteenth family cannot be dropped by omission the way these six were.
     */
    it('partitions LIVE_GEOMETRY_KEYS into the planner\'s forwarded and dropped halves', () => {
        const r = assertPlannerLivePartition();
        expect(r.total).toBe(LIVE_GEOMETRY_KEYS.length);
        expect(r.forwarded).toBe(8);
        expect(r.dropped).toBe(6);
    });

    /**
     * ⛔ DERIVED FROM `livePerVisitOpts` ITSELF, not restated from a comment.
     * The claim "the driver BUILDS these two and the planner drops them" is
     * only a measurement if the builder is the one asked, so the builder is
     * called and its key set intersected with the dropped half.
     */
    it('names turrets and bosses as SUPPLIED-AND-DROPPED — derived from the builder', () => {
        const p = R8_NORMALIZE_LIVE_BATCH.plannerDropsSixFamilies;
        for (const k of p.suppliedAndDropped) expect(p.dropped).toContain(k);
        const built = Object.keys(livePerVisitOpts({}));
        const suppliedAndDropped = built.filter((k) => p.dropped.includes(k)).sort();
        expect(suppliedAndDropped).toEqual([...p.suppliedAndDropped].sort());
        expect(suppliedAndDropped).toEqual(['bosses', 'turrets']);
    });

    /**
     * ⛓ THE GATE AMENDMENT'S PREMISE, CHECKED (trap 122). The offline
     * differential replaces a `--win` sweep only while nothing here reaches
     * the wasm run.
     */
    it('is MODEL-SIDE — no game-facing file is in the batch', () => {
        const r = assertBatchIsModelSide();
        expect(r.modelSide).toBe(true);
        expect(r.files.sort()).toEqual(['botDriverV2.js', 'levelRun.js']);
    });

    it('declines the per-world pre-filter lever, with a reason and no number', () => {
        const l = R8_NORMALIZE_LIVE_BATCH.leverNotTaken;
        expect(l.why).toMatch(/not measured, so not claimed/);
        // ⚠ The batch must not carry a speed-up claim anywhere — trap 137.
        expect(JSON.stringify(R8_NORMALIZE_LIVE_BATCH)).not.toMatch(/faster|speed-?up/i);
    });
});

/**
 * ── THE MUTATION LIST FOR THIS STRATUM ────────────────────────────────
 *
 * Each row states a mutation and the test it makes go red. Recorded so the
 * stratum's teeth are a measurement rather than a hope; a row whose mutation
 * bites NOTHING is a bounded vacuity and says so.
 *
 *  1. add a 15th key to `LIVE_GEOMETRY_KEYS`
 *       → `partitions LIVE_GEOMETRY_KEYS …` reds (missing from the partition)
 *  2. move `turrets` from `dropped` to `forwarded` (without touching the code)
 *       → `names turrets and bosses as SUPPLIED-AND-DROPPED` reds
 *  3. list a key in BOTH halves
 *       → `assertPlannerLivePartition` throws by name (trap 94's shape)
 *  4. delete any `sites` entry
 *       → `accounts for every … call site on disk` reds with the file named
 *  5. add a `liveSolidOpts(` call site to `levelRun.js` without listing it
 *       → same row reds
 *  6. hoist the crusher or turret loop's bag
 *       → not caught HERE (this row is a declaration, not a detector) — it is
 *         caught by the fixture differential, which is the honest stratum for
 *         a behaviour change. ⚠ BOUNDED VACUITY, recorded rather than hidden.
 *  7. add `tapeFormat.js` to `sites`
 *       → `is MODEL-SIDE` reds and the change re-earns its `--win` sweep
 */
