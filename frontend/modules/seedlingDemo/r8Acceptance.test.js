import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import {
    R8_NORMALIZE_LIVE_BATCH, assertBatchSitesCoverSource, assertPlannerLivePartition,
    assertBatchIsModelSide,
    R8_ENEMY_BRIDGE, assertBridgeExposureIsMeasured, assertBridgeRosterMatchesScope,
    assertSteppedContactPartition,
    R8_STRATEGY_EXECUTORS, assertShovePostConditionKind,
    assertExecutorParametersAreDerived, assertEscalationIsOrdered,
    R8_TWO_PASS, assertTwoPassPrefixAgrees,
    R8_ETA_PROBE, assertTransitSamplesCarryEtas,
    R8_D2_SHIELD, assertSpinnerPressExposureIsMeasured,
    R8_D2_COMPLETE, assertD2RouteGraph,
} from './r8Acceptance.js';
import { STRATEGY_EXECUTORS } from './solverBot.js';
import { bridgedChaserTags, CHASERS, chaserSolids } from './chasers.js';
import {
    CONTACT_STEPPED_FAMILIES, CONTACT_STEPPED_PRICED_BY, CONTACT_STEPPED_WHY,
    contactPricing,
} from './combat.js';
import { MODELLED_ENEMY_CLASSES } from './spinner.js';
import { atlasLevelSource } from './levelSource.js';
import {
    LIVE_GEOMETRY_KEYS, ROLES, assertNormalizedLiveOpts, isNormalizedLiveOpts,
    normalizeLiveOpts, rectsOverlap,
} from './levelWorld.js';
import { livePerVisitOpts, plannerObstacleAt } from './botDriverV2.js';
import { ARROW_PLAYER_ARM } from './arrowTrap.js';
import { knockbackDelta } from './playerDamage.js';
import { createLevelRun } from './levelRun.js';
import { parseTape, heldKeysAt } from './tapeFormat.js';
import { hitSpinner, SPINNER } from './spinner.js';
import { distanceRectPoint, SLASH_REACH, SWORD_DAMAGE } from './presses.js';
import { OUT_OF_BAND_WRITERS, TAGS_PER_LEVEL } from './outOfBandLedger.js';
import { outOfBandFlagFor } from './breakableRocks.js';
import { dangerVolumes } from './dangerMap.js';
import { KILL_LOCK_TSET } from './combat.js';
import { applyFriction, DEFAULT_FRICTION } from './playerPhysicsV1.js';

/** This file's own directory — the banked fixtures are read relative to it. */
const HERE = dirname(fileURLToPath(import.meta.url));

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
     * ⛔⛔ DERIVED FROM THE RUNNING CODE, not restated from a comment.
     *
     * `plannerObstacleAt` is driven with all fourteen families set to
     * SENTINELS and a stub level that captures what reaches
     * `plannerBlockerAt`. A family that arrives carrying its sentinel was
     * forwarded; one that arrives `null` was dropped. That is a measurement
     * of the drop rather than a second reading of the source the declaration
     * was written from (trap 97), and it is the half that hides — naming the
     * classes is the visible half (trap 135).
     *
     * ⚠ SENTINEL SHAPE MATTERS: the bag is BRANDED now, so every one of the
     * fourteen keys is PRESENT on arrival. Presence no longer separates the
     * halves; the VALUE does.
     */
    it('derives the planner\'s forwarded/dropped halves by driving it with sentinels', () => {
        const seen = [];
        const stubLevel = {
            plannerBlockerAt: (box, probeRect, o) => { seen.push(o); return null; },
            teleporterHit: () => [],
            nearestWalkableTile: () => null,
            tiles: [],
        };
        const sentinels = Object.fromEntries(
            LIVE_GEOMETRY_KEYS.map((k) => [k, `SENTINEL:${k}`]));
        try {
            plannerObstacleAt(stubLevel, 100, 100, null, { ...sentinels, noclip: false });
        } catch { /* the stub cannot answer the terrain arms; the capture is what matters */ }
        expect(seen.length, 'plannerBlockerAt was never reached').toBeGreaterThan(0);
        const arrived = seen[0];
        const forwarded = LIVE_GEOMETRY_KEYS
            .filter((k) => arrived[k] === `SENTINEL:${k}`).sort();
        const dropped = LIVE_GEOMETRY_KEYS
            .filter((k) => arrived[k] !== `SENTINEL:${k}`).sort();
        const p = R8_NORMALIZE_LIVE_BATCH.plannerDropsSixFamilies;
        expect(forwarded).toEqual([...p.forwarded].sort());
        expect(dropped).toEqual([...p.dropped].sort());
        // ⛔ And the policy keys must still arrive — a normaliser that ate
        // `noclip` would open every wall in the level to the planner.
        expect('noclip' in arrived).toBe(true);
        expect('noHazards' in arrived).toBe(true);
    });

    /**
     * ⛔ THE SHARPEST HALF, DERIVED FROM THE BUILDER. "The driver BUILDS
     * these two and the planner drops them" is only a measurement if the
     * builder is the one asked.
     */
    it('names turrets and bosses as SUPPLIED-AND-DROPPED — derived from the builder', () => {
        const p = R8_NORMALIZE_LIVE_BATCH.plannerDropsSixFamilies;
        for (const k of p.suppliedAndDropped) expect(p.dropped).toContain(k);
        // ⚠ `livePerVisitOpts` is BRANDED now, so every key is present. What
        // separates "supplied" from "filled in by the brand" is that the
        // builder reads it OFF THE RUN — so the run is given a sentinel and
        // the families that carry it out are the ones really supplied.
        const run = Object.fromEntries(LIVE_GEOMETRY_KEYS.map((k) => [k, `RUN:${k}`]));
        const built = livePerVisitOpts(run);
        const supplied = LIVE_GEOMETRY_KEYS.filter((k) => built[k] === `RUN:${k}`);
        const suppliedAndDropped = supplied.filter((k) => p.dropped.includes(k)).sort();
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

    /**
     * ⛔ THE CONSUMER ENTRY'S CHECK, WITNESSED IN BOTH DIRECTIONS.
     *
     * A brand assertion that only ever sees branded bags is a tautology, and
     * a tautology dressed as a guard is the shape traps 86/89 keep producing.
     * So the refusal is exercised on a bag that has every one of the fourteen
     * keys and simply did not come through the normaliser — which is exactly
     * the hand-written literal the brand exists to end.
     */
    it('refuses a complete-looking bag that never went through the normaliser', () => {
        const lookalike = Object.fromEntries(LIVE_GEOMETRY_KEYS.map((k) => [k, null]));
        expect(isNormalizedLiveOpts(lookalike)).toBe(false);
        expect(() => assertNormalizedLiveOpts(lookalike, 'probe'))
            .toThrow(/does not wear/);
        expect(() => assertNormalizedLiveOpts(lookalike, 'probe'))
            .toThrow(/probe/);
    });

    it('accepts what the normaliser fills, and returns it unchanged', () => {
        const bag = normalizeLiveOpts({});
        expect(assertNormalizedLiveOpts(bag, 'probe')).toBe(bag);
        // ⛓ And the SPREAD keeps it — the property every hoisted site relies
        // on (`{...base, pushables}`, `{...branded, noclip, noHazards}`).
        expect(() => assertNormalizedLiveOpts({ ...bag, noclip: true }, 'probe'))
            .not.toThrow();
    });

    it('declines the per-world pre-filter lever, with a reason and no number', () => {
        const l = R8_NORMALIZE_LIVE_BATCH.leverNotTaken;
        expect(l.why).toMatch(/not measured, so not claimed/);
        // ⚠ The batch must not carry a speed-up claim anywhere — trap 137.
        expect(JSON.stringify(R8_NORMALIZE_LIVE_BATCH)).not.toMatch(/faster|speed-?up/i);
    });
});

/**
 * ⛓⛓⛓ THE ENEMY BRIDGE'S PREDICTION — R8 slice 1, stated before the bridge.
 *
 * Same shape as track B's above and for the same reason (trap 40). What is
 * asserted here is that the claim is a FORK with both arms written down and
 * that the exposed set is re-derived from disk rather than typed.
 */
describe('R8_ENEMY_BRIDGE — the prediction, stated first', () => {
    it('states BOTH arms of the fork, and names the finding arm as a defect not a re-record', () => {
        const p = R8_ENEMY_BRIDGE.prediction;
        expect(p.armA).toMatch(/BYTE-EXACT/);
        expect(p.armB).toMatch(/RED at the L5 arrow bait/);
        // ⛔ The whole point: a divergence is a defect, never a moved expectation.
        expect(p.armB).toMatch(/never a re-record/);
        // ...and the baseline the gate will be attributed against is recorded
        // here, measured on the unmodified tree.
        expect(p.baseline).toEqual({
            commit: '153f5100b', files: 240, tests: 6829, seconds: 363.72,
            note: expect.stringContaining('cannot attribute'),
        });
    });

    /**
     * ⛔ RE-DERIVED FROM DISK. The five names are a claim about the committed
     * roster, and the roster is disk-derived — so the claim is recomputed
     * from the tapes and their own recorded streams on every run.
     */
    it('re-derives the exposed set from the committed roster and its recorded streams', () => {
        const out = assertBridgeExposureIsMeasured(realExposureIo());
        // ⛓ FIVE PREDICTED + ONE AUTHORED. The prediction's own list is
        // asserted UNCHANGED beside the union, because a prediction edited
        // after its measurement is not a prediction.
        expect(R8_ENEMY_BRIDGE.exposedTapes.map((t) => t.name)).toEqual([
            'r7-act2-3', 'r7-act2-4', 'r7-act2-5', 'r7-act2-6', 'r7-act2-full',
        ]);
        // ⛓ EACH SLICE ADDS ITS OWN THE SAME WAY, and the assertion finds
        // them by name the first time the full config runs after they land —
        // three slices running now. `r8-solve-3` ends at the L4 arrival;
        // slice 3b's two SOLVE their bob rooms (an arrow kill in L4, two
        // drownings in L6). The prediction's own five stay untouched.
        expect(R8_ENEMY_BRIDGE.exposedAdded.map((t) => t.name)).toEqual([
            'r8-l6-bob-contact', 'r8-solve-3', 'r8-solve-4', 'r8-solve-6', 'r8-solve-5',
        ]);
        expect(out.exposed).toBe(10);
        expect(out.tapes).toEqual([
            'r7-act2-3', 'r7-act2-4', 'r7-act2-5', 'r7-act2-6', 'r7-act2-full',
            'r8-l6-bob-contact', 'r8-solve-3', 'r8-solve-4', 'r8-solve-5', 'r8-solve-6',
        ]);
    });

    /**
     * ⛔ THE NON-VACUITY IS WITNESSED, not assumed: a comparison that has
     * never seen a disagreement might be comparing nothing (slice 0 track C's
     * own law). Two synthetic rosters, one exposed tape too many and one too
     * few, and both go red.
     */
    it('reds when a tape enters a bridged room and nobody declared it', () => {
        const io = syntheticExposureIo({
            'r7-act2-3': { tape: {}, levels: [4] },
            'a-new-tape': { tape: {}, levels: [0, 4] },
        });
        // ⚠ Several declared tapes are absent from this synthetic roster too,
        // so the message names BOTH directions — the assertion is checked on
        // the undeclared-and-exposed half here and on the stale half below.
        expect(() => assertBridgeExposureIsMeasured(io)).toThrow(/Undeclared and exposed: a-new-tape/);
    });

    it('reds when a declared tape stops entering a bridged room', () => {
        const io = syntheticExposureIo({ 'r7-act2-3': { tape: {}, levels: [0] } });
        expect(() => assertBridgeExposureIsMeasured(io)).toThrow(/no longer exposed/);
    });

    it('reds when the ROOMS move under a name that still matches', () => {
        const io = syntheticExposureIo({
            // ⚠ Only ONE row moves — every other declared tape is present with
            // its declared rooms, so the name set matches and the ROOMS are
            // the only thing left for the assertion to catch.
            'r7-act2-3': { tape: {}, levels: [4, 6] },
            'r7-act2-4': { tape: {}, levels: [4, 5] },
            'r7-act2-5': { tape: {}, levels: [5, 6] },
            'r7-act2-6': { tape: {}, levels: [6] },
            'r7-act2-full': { tape: {}, levels: [4, 5, 6] },
            'r8-l6-bob-contact': { tape: {}, levels: [6] },
            'r8-solve-3': { tape: {}, levels: [4] },
            // ⛓ R8 slice 5's L5 tape, at its DECLARED rooms — it crosses into
            // L6 at the end, and the ledger says so.
            'r8-solve-5': { tape: {}, levels: [5, 6] },
            // ⛓ R8 slice 3b's two battery tapes, at their DECLARED rooms — the
            // fixture is the declaration's mirror, so a row added to the
            // ledger has to be added here too or this mutation stops being
            // about ROOMS and becomes about names again.
            'r8-solve-4': { tape: {}, levels: [4, 5] },
            'r8-solve-6': { tape: {}, levels: [6] },
        });
        expect(() => assertBridgeExposureIsMeasured(io)).toThrow(/right name with wrong rooms/);
    });

    /**
     * ⚠ THE GATE'S OWN PREMISE: a chaser's position is UNREAD under
     * `noDamage`, and the readers that would make that false are enumerated
     * rather than left implicit.
     */
    it('enumerates every reader an "unread position" claim has to survive', () => {
        const readers = R8_ENEMY_BRIDGE.enemyBodyReaders.map((r) => r.reader);
        expect(readers).toEqual([
            'levelRun.pushableCtx().collides',
            'levelRun.stepArrowTrapsNow',
            'levelRun.applyWandShotToBoss',
        ]);
        // The block's Enemy arm is SPINNERS ONLY, and that gap is named as a
        // deliberate non-fix rather than described as coverage.
        expect(R8_ENEMY_BRIDGE.enemyBodyReaders[0].consequence).toMatch(/NAMED, NOT FIXED/);
    });

    it('refuses to run without an injected io seam — a default would hide the mutations', () => {
        expect(() => assertBridgeExposureIsMeasured()).toThrow(/needs an io seam/);
    });
});

/**
 * ⛓⛓⛓ THE BRIDGE'S PARTITIONS — R8 slice 1, and every one of them is
 * asserted rather than assumed.
 */
describe('R8_ENEMY_BRIDGE — the partitions the bridge has to keep total', () => {
    it('the DECLARED scope and the DERIVED roster are the same claim', () => {
        expect(assertBridgeRosterMatchesScope(bridgedChaserTags)).toEqual({ classes: ['bob'] });
    });

    it('⛔ MUTATION: a roster that drifts from the declaration reds by name', () => {
        expect(() => assertBridgeRosterMatchesScope(() => ['bob', 'jellyfish']))
            .toThrow(/DECLARED scope and the DERIVED bridge roster disagree/);
        expect(() => assertBridgeRosterMatchesScope(() => []))
            .toThrow(/disagree/);
    });

    /**
     * ⛔⛔ THE ROSTER IS A DERIVATION OVER TWO TABLES, and the point is that
     * NEITHER ALONE is the answer: `jellyfish` is transcribed to the same
     * depth as `bob` in `CHASERS` and has no `MODELLED_ENEMY_CLASSES` row, so
     * it is transcribed-and-unbridged — which is exactly what makes it usable
     * as the pair's control.
     */
    it('a transcribed class with no roster row is NOT bridged — the control exists', () => {
        expect(Object.keys(CHASERS).sort()).toEqual(['bob', 'jellyfish']);
        expect(MODELLED_ENEMY_CLASSES.Jellyfish).toBeUndefined();
        expect(bridgedChaserTags()).toEqual(['bob']);
        expect(contactPricing('jellyfish').kind).toBe('mover');
    });

    it('the three `stepped` contact tables are ONE key set, and every bridged tag is in it', () => {
        expect(assertSteppedContactPartition({
            families: CONTACT_STEPPED_FAMILIES,
            pricedBy: CONTACT_STEPPED_PRICED_BY,
            why: CONTACT_STEPPED_WHY,
            /**
             * ⛓ R8 SLICE 6 — "BRIDGED" MEANS "THE RUN STEPS IT", and the
             * spinner has been stepped since R5 slice 13. The argument was
             * `bridgedChaserTags()` while the chasers were the only
             * conversion; now that a second stepped family names a pricer,
             * the honest set is the union — and the control the assertion
             * exists for ("nothing steps them, so the pricer cannot exist")
             * is unchanged, because `iceturret` is still in neither.
             */
            bridged: [...bridgedChaserTags(), 'spinner'],
        })).toEqual({ families: 3, bridged: ['bob', 'spinner'], refused: ['iceturret'] });
    });

    it('⛔ MUTATION: a family in one table and not another reds by name (trap 94)', () => {
        expect(() => assertSteppedContactPartition({
            families: ['spinner', 'bob'],
            pricedBy: { spinner: null, bob: 'stepChasersNow', drill: null },
            why: { spinner: 'x', bob: 'y', drill: 'z' },
            bridged: ['bob'],
        })).toThrow(/ONE key set/);
    });

    it('⛔ MUTATION: a bridged tag with no pricer would make the census scan THROW', () => {
        expect(() => assertSteppedContactPartition({
            families: ['bob'], pricedBy: { bob: null }, why: { bob: 'x' }, bridged: ['bob'],
        })).toThrow(/must name its pricer/);
    });

    /**
     * ⛔ THE CONTROL ITSELF, ASSERTED: an unbridged `stepped` family must have
     * NO pricer, because a pricer would make the census scan SKIP it — a
     * silent zero for a body nobody prices anywhere.
     */
    it('⛔ MUTATION: giving an unbridged family a pricer reds by name', () => {
        expect(() => assertSteppedContactPartition({
            families: ['spinner', 'bob'],
            pricedBy: { spinner: 'stepSpinnersNow', bob: 'stepChasersNow' },
            why: { spinner: 'x', bob: 'y' },
            bridged: ['bob'],
        })).toThrow(/silent zero/);
    });

    /**
     * ⛔⛔ SOLIDITY IS PER MOVER, AND THE CHASER'S LIST IS NOT THE PLAYER'S.
     * The one type that separates them in each direction is asserted, because
     * "the subclasses add nothing" was a claim about the whole family that
     * `Bob.as:39` refutes (and six siblings with it).
     */
    it('a chaser collides with "Enemy" and NOT with "LavaBoss"', () => {
        const solids = chaserSolids('bob');
        expect(solids).toContain('Enemy');
        expect(solids).not.toContain('LavaBoss');
        // …and the jellyfish's row is not a copy-paste: it was swept for.
        expect(chaserSolids('jellyfish')).toEqual(solids);
    });

    it('⛔ a class with no solids-mover row is a THROW, never the base list', () => {
        expect(() => chaserSolids('spinner')).toThrow(/not a transcribed chaser/);
    });
});

/** The real roster, read from disk. */
function realExposureIo() {
    const here = dirname(fileURLToPath(import.meta.url));
    const tapesDir = join(here, 'fixtures', 'tapes');
    const expDir = join(here, 'fixtures', 'expectations');
    const src = atlasLevelSource();
    return {
        tapeNames: () => readdirSync(tapesDir).filter((f) => f.endsWith('.json'))
            .map((f) => f.slice(0, -5)).sort(),
        loadTapeJson: (n) => JSON.parse(readFileSync(join(tapesDir, `${n}.json`), 'utf8')),
        levelsVisited: (n) => {
            for (const p of [`${n}.json`, `${n}.provisional.json`]) {
                try {
                    const s = JSON.parse(readFileSync(join(expDir, p), 'utf8'));
                    return new Set(s.ticks.map((t) => t.level));
                } catch { /* try the next */ }
            }
            const tape = JSON.parse(readFileSync(join(tapesDir, `${n}.json`), 'utf8'));
            return new Set([tape.boot?.level ?? 0]);
        },
        /**
         * ⛔ DERIVED FROM THE DECLARED SCOPE, and the scope is cross-checked
         * against the bridge's own roster one stratum away
         * (`assertBridgeRosterMatchesScope`). A second class bridged tomorrow
         * widens this automatically, which is the point.
         */
        bridgedLevels: () => {
            const tags = R8_ENEMY_BRIDGE.bridgedClasses;
            const out = new Set();
            for (let l = 0; l < 130; l += 1) {
                let rec;
                try { rec = src(l); } catch { continue; }
                if (!rec?.entities) continue;
                if (rec.entities.some((e) => tags.includes(e.type))) out.add(l);
            }
            return out;
        },
    };
}

/** A synthetic roster, so the mutations above can be constructed. */
function syntheticExposureIo(rows) {
    return {
        tapeNames: () => Object.keys(rows),
        loadTapeJson: (n) => rows[n].tape,
        levelsVisited: (n) => new Set(rows[n].levels),
        bridgedLevels: () => new Set([4, 5, 6]),
    };
}

describe('R8_STRATEGY_EXECUTORS — slice 3b\'s prediction, stated before an executor moved', () => {
    it('states a fork with both arms and the expected one named', () => {
        const p = R8_STRATEGY_EXECUTORS.prediction;
        expect(p.armA).toMatch(/BYTE-EXACT/);
        expect(p.armB).toMatch(/REFUSAL is the deliverable/);
        expect(p.expected).toMatch(/armA/);
        // ⛔ The fork's arms must be DIFFERENT claims. A prediction whose two
        // arms both describe success is a hope wearing a fork's shape.
        expect(p.armA).not.toBe(p.armB);
    });

    it('names L4\'s and L8\'s derived k BEFORE the derivation exists', () => {
        const also = R8_STRATEGY_EXECUTORS.prediction.alsoPredicted.join(' | ');
        expect(also).toMatch(/L4's derived `k` is 2/);
        expect(also).toMatch(/L8's first derived `k` is 2/);
        // The agreement with the hand answer is INFORMATION — ⚖ §11.8a's own
        // words — and the prediction says so rather than leaning on it.
        expect(also).toMatch(/INFORMATION rather than the justification/);
    });

    it('budgets FORMAT RISK for L8 by name (R7 §21.9 lesson 1)', () => {
        expect(R8_STRATEGY_EXECUTORS.prediction.expected).toMatch(/FORMAT RISK/);
        expect(R8_STRATEGY_EXECUTORS.prediction.expected).toMatch(/SandTrap/);
    });

    it('keeps `touch` refused AS THE LIVE CONTROL, with the reason', () => {
        const row = R8_STRATEGY_EXECUTORS.refusedHere.find((r) => /touch/.test(r.what));
        expect(row.why).toMatch(/control/);
        // ⛔ And the control is asserted against the RUNNING registry, not
        // against the sentence: a control that has stopped being able to fail
        // is not a weak control, it is not a control (trap 62).
        expect(STRATEGY_EXECUTORS.touch).toBeUndefined();
    });
});

describe('R8_TWO_PASS — slice 4\'s prediction, stated before the loop moved', () => {
    it('states a fork with both arms and the expected one named', () => {
        const p = R8_TWO_PASS.prediction;
        expect(p.armA).toMatch(/hasShield/);
        expect(p.armB).toMatch(/REFUSAL is the deliverable/);
        expect(p.expected).toMatch(/armA/);
        // ⛔ The two arms must be DIFFERENT claims (the slice-3b row's law).
        expect(p.armA).not.toBe(p.armB);
    });

    it('the baseline is MEASURED and names the commit it was measured on (trap 40)', () => {
        const b = R8_TWO_PASS.prediction.baseline;
        expect(b.commit).toBe('01ea0f649');
        expect(b.files).toBe(242);
        expect(b.tests).toBe(6954);
        expect(b.note).toMatch(/before anything moved/);
    });

    it('⛔ names L18 — NOT the shield — as the slice\'s FORMAT RISK, with the mechanism', () => {
        const also = R8_TWO_PASS.prediction.alsoPredicted.join(' | ');
        expect(R8_TWO_PASS.prediction.expected).toMatch(/FORMAT RISK/);
        expect(R8_TWO_PASS.prediction.expected).toMatch(/it is L18/);
        expect(also).toMatch(/KILL_ARM_POLICY\.Spinner` is REFUSED/);
    });

    /**
     * ⛓⛓⛓ THE SPINNER'S SECOND CONSEQUENCE IS PREDICTED NIL, AND THE
     * PREDICTION IS CHECKED AGAINST THE LEVEL RECORD RATHER THAN BELIEVED.
     *
     * `Spinner.removed()` writes `setPersistence(tag, false)` unconditionally
     * — §11.4's second-writer shape exactly — and the prediction says both L18
     * placements carry `tag = "-1"`, which makes the write a no-op. That is a
     * claim about DATA ON DISK, so it is read off the atlas here. A room whose
     * spinners carried real tags would be a different problem, and this is
     * what would say so.
     */
    it('⛓ L18\'s two spinners really do carry `tag = -1` — the nil, MEASURED', () => {
        const rec = atlasLevelSource()(18);
        const spinners = rec.entities.filter((e) => e.type === 'spinner');
        expect(spinners.length).toBe(2);
        for (const s of spinners) expect(String(s.tag ?? s.attrs?.tag)).toBe('-1');
        expect(R8_TWO_PASS.prediction.alsoPredicted.join(' | '))
            .toMatch(/both L18 placements carry `tag = "-1"`/);
    });

    it('the two tick SOURCES are a partition with a mechanism reason each', () => {
        expect(Object.keys(R8_TWO_PASS.tickSources).sort()).toEqual(['game', 'model']);
        expect(R8_TWO_PASS.tickSources.model.oracle).toMatch(/chaserKillLockOpens/);
        expect(R8_TWO_PASS.tickSources.game.oracle).toMatch(/persistence_cleared/);
        // ⛔ The game arm's own check is a BOUNDARY, not a hit: an arm that
        // only ever showed the tag present would measure "cleared by now".
        expect(R8_TWO_PASS.tickSources.game.check).toMatch(/must NOT carry the tag/);
    });

    it('⛔ declares that NO tape field is added, so the absence is a decision', () => {
        expect(R8_TWO_PASS.tapeFormat).toMatch(/UNTOUCHED/);
    });
});

describe('R8_ETA_PROBE — slice 5\'s prediction, stated before the arrow arm moved', () => {
    it('states a fork with both arms and the expected one named', () => {
        const p = R8_ETA_PROBE.prediction;
        expect(p.armA).toMatch(/62\.35484072151636/);
        expect(p.armB).toMatch(/a committed tape MOVES/);
        expect(p.expected).toMatch(/armA/);
        expect(p.armA).not.toBe(p.armB);
    });

    it('the baseline is MEASURED and names the commit it was measured on (trap 40)', () => {
        const b = R8_ETA_PROBE.prediction.baseline;
        expect(b.commit).toBe('6a3b234a7');
        expect(b.files).toBe(243);
        expect(b.tests).toBe(6978);
        expect(b.note).toMatch(/before anything moved/);
    });

    /**
     * ⛔ THE TWO DEFECTS ARE NAMED BEFORE THEY ARE FIXED, each with the
     * measurement that found it — so the as-built cannot quietly become a
     * story about a probe that also happened to fix two things.
     */
    it('⛔ names BOTH model defects, with a witness each', () => {
        const ids = R8_ETA_PROBE.modelDefects.map((d) => d.id).sort();
        expect(ids).toEqual(['arrow-moves-on-its-spawn-tick', 'player-arrow-bill-missing']);
        for (const d of R8_ETA_PROBE.modelDefects) {
            expect(d.witness.length).toBeGreaterThan(20);
            expect(d.cure.length).toBeGreaterThan(20);
            expect(d.claimWas).not.toBe(d.truth);
        }
    });

    /**
     * ⛓ THE CLAIM THAT MADE THE BILL MISSING IS ON DISK AND IS QUOTED
     * CORRECTLY — read off `arrowTrap.js` rather than remembered, because the
     * whole defect is that a docblock named a payer nobody had asked.
     */
    it('⛓ `ARROW_PLAYER_ARM` named PUZZLEMENT_HAZARDS as the payer, and now names a caller', () => {
        const missing = R8_ETA_PROBE.modelDefects
            .find((d) => d.id === 'player-arrow-bill-missing');
        // ⛔ THE HISTORICAL CLAIM, kept verbatim — this is what the row said
        // for two slices, and the census row still carries it because the
        // CENSUS's price was never the thing that was wrong.
        expect(missing.claimWas).toContain('PUZZLEMENT_HAZARDS.arrowtrap');
        expect(ARROW_PLAYER_ARM.censusRow).toMatch(/PUZZLEMENT_HAZARDS\.arrowtrap/);
        // ⛓ AND THE FLIP: `damagePricedBy` now names a CALLER, which is the
        // only kind of answer that can be checked. This row is a debt's
        // record and it could only ever go red on the slice that paid it.
        expect(ARROW_PLAYER_ARM.damagePricedBy).toMatch(/applyPlayerHit/);
        expect(ARROW_PLAYER_ARM.damagePricedBy).not.toMatch(/PUZZLEMENT_HAZARDS/);
    });

    /**
     * ⛔⛔ THE ARITHMETIC IS RE-DERIVED HERE FROM THE MODEL'S OWN FUNCTIONS,
     * not quoted. `knockbackDelta` is the model's transcription of
     * `Player.knockback`; the numbers below are the RECORDING's, and this is
     * the row that says the two meet. It is a step-0 row: it holds before any
     * fix, because it is about the GAME's arrow position, not the model's.
     */
    it('⛔⛔ the recording\'s x at t=207 falls out of the game\'s arrow position', () => {
        // ⛔ THE RECORDING'S OWN DIGITS, READ OFF DISK — including `y`, which
        // is 56.39999999999999 and not 56.4. Typing the round number instead
        // moves the answer by 3 ulps and the whole point of this row is that
        // it lands on the recording exactly.
        const expectation = JSON.parse(readFileSync(
            join(HERE, 'fixtures', 'refuted', 'r8-solve-5.expectation.json'), 'utf8'));
        const at206 = expectation.ticks[206];
        const at207 = expectation.ticks[207];
        // The GAME's arrow — one 5 px move BEHIND this model's, which has it
        // at (68, 63) on the same frame and therefore misses by 0.40 px.
        const kb = knockbackDelta(at206, { x: 68, y: 58 }, 5);
        expect(kb.dx).toBe(-4.3951592784836375);
        // The y impulse is DROPPED by the strict `>` comparator at |cy| = 0.4768.
        expect(kb.dy).toBe(0);
        expect(kb.landed).toEqual({ x: true, y: false });
        // `Mobile.friction()` is `v.normalize(len - f)` — a SCALE, not a
        // subtraction — and `Mobile.moveX` accumulates in 1 px sub-steps.
        // Both are transcribed rather than simplified (trap 118), because
        // either shortcut moves the last digit.
        const vx = at206.vx ?? 1.45 + kb.dx;
        const len = Math.abs(vx);
        let scaled = vx * ((len - DEFAULT_FRICTION) / len);
        let x = at206.x;
        for (let i = 0, n = Math.abs(scaled); i < n; i += 1) {
            x += Math.min(1, n - i) * (scaled < 0 ? -1 : 1);
        }
        expect(x).toBe(at207.x);
        expect(at207.x).toBe(62.35484072151636);
        // ⚠ `applyFriction` is the same scale, and this row exists so the
        // hand arithmetic above cannot drift from the module's.
        scaled = applyFriction({ x: vx, y: 0 }, DEFAULT_FRICTION).x;
        expect(scaled).toBe(vx * ((len - DEFAULT_FRICTION) / len));
    });

    it('⚖ carries §13.10a\'s ruled shape, TRANSIT and WAIT kept apart', () => {
        const s = R8_ETA_PROBE.ruledShape;
        expect(s.transit).toMatch(/ETA/);
        expect(s.transit).toMatch(/never a cruder/);
        expect(s.wait).toMatch(/UNION over the dwell window/);
        expect(s.arrows).toMatch(/stepArrow/);
        expect(s.optimismBound).toMatch(/per-tick next-cell check/);
    });

    it('⛔ both gates name a fixture that is ALREADY ON DISK', () => {
        expect(R8_ETA_PROBE.gates.negative.fixture).toMatch(/r8-slice4-l5-refuted/);
        expect(R8_ETA_PROBE.gates.positive.fixture).toMatch(/r7-act2-5/);
        expect(R8_ETA_PROBE.gates.mutations.length).toBeGreaterThanOrEqual(3);
    });

    it('⛔ declares that NO tape field is added, so the absence is a decision', () => {
        expect(R8_ETA_PROBE.tapeFormat).toMatch(/UNTOUCHED/);
    });

    /**
     * ⛔ THE FIFTH RUNG STAYS REFUSED, IN THE SLICE'S OWN WORDS — ⚖ §13.10a
     * refused it with a reason, and a refusal that is not written down is a
     * refusal the next slice re-litigates.
     */
    it('⛔ keeps the fifth rung REFUSED, with the ruling\'s reason', () => {
        const r = R8_ETA_PROBE.refusedHere.find((x) => x.what === 'a fifth ladder rung');
        expect(r.why).toMatch(/a rung is a STRATEGY and this is an INSTRUMENT/);
    });
});


/**
 * ⛓⛓⛓ THE SPINNER PRESS EXPOSURE, MEASURED BY DRIVING — the io seam
 * `assertSpinnerPressExposureIsMeasured` takes.
 *
 * ⛔ TWO GATES, BOTH THE SHIPPED ONES. `Player.slash` collects with the RECT
 * (`presses.slashRect`/`spearRect`, which the run itself records on every
 * press) and then applies `FP.distanceRectPoint(x, y, box) <= SLASH_REACH` —
 * 16 px from the player's POINT to the body's BOX. A measurement that used
 * only the rect over-counts by a third (measured: 18 rect overlaps, 15 within
 * reach), and one that re-derived either gate would be a second cost model.
 *
 * ⛔ THE LANDING COUNT IS `hitSpinner`'s OWN ANSWER, called rather than
 * re-implemented: the i-frame (`hitsTimer` 30) is what turns a press's FIVE
 * dispatches into ONE hit, and that is the receiver's rule, not the weapon's
 * (traps 85/93).
 *
 * ⚠ A SHADOW, AND IT SAYS SO. The damage is tracked beside the run rather
 * than fed into it — this measurement exists BEFORE the arm, so it is an
 * UPPER BOUND on what the arm will do (a real knockback would move the body
 * and could take a later dispatch out of reach). Bounding it in the
 * conservative direction is what makes "no committed tape kills a spinner" a
 * claim worth stating.
 *
 * ⚠ AND THE CANDIDATE SET IS PRE-FILTERED FROM THE COMMITTED EXPECTATIONS,
 * not from a replay: a tape with no press span, or one whose recorded ticks
 * never enter a spinner level, cannot reach one. That takes the sweep from
 * 85 s over the whole roster to under three — and the filter is the GAME's
 * own record of which rooms the walk was in.
 */
let atlasMemo = null;
/** ⚠ ONE ATLAS FOR THE WHOLE SWEEP — `atlasLevelSource()` re-reads and
 * re-parses `seedling-map.json` on every call, and this row calls it once per
 * committed tape. */
function atlasOnce() {
    if (!atlasMemo) atlasMemo = atlasLevelSource();
    return atlasMemo;
}

let spinnerLevelsMemo = null;
/**
 * ⚠ HOISTED AND MEMOISED, and the reason is a measurement: built inside the
 * per-tape function this scan re-read 130 level records for each of 332
 * tapes and the row cost 41 s. The atlas does not change between tapes.
 */
function spinnerLevelsOnce(src) {
    if (spinnerLevelsMemo) return spinnerLevelsMemo;
    spinnerLevelsMemo = new Set();
    for (let l = 0; l < 130; l += 1) {
        let rec;
        try { rec = src(l); } catch { continue; }
        if ((rec.entities ?? []).some((e) => e.type === 'spinner')) spinnerLevelsMemo.add(l);
    }
    return spinnerLevelsMemo;
}

function spinnerLandingsFor(tapeDir, name) {
    const src = atlasOnce();
    const spinnerLevels = spinnerLevelsOnce(src);
    const raw = JSON.parse(readFileSync(join(tapeDir, `${name}.json`), 'utf8'));
    if (!(raw.inputs ?? []).some((sp) => sp.key === 'primary' || sp.key === 'secondary')) {
        return [];
    }
    const expDir = join(HERE, 'fixtures', 'expectations');
    let visited = null;
    for (const f of [`${name}.json`, `${name}.provisional.json`]) {
        try {
            visited = new Set(JSON.parse(readFileSync(join(expDir, f), 'utf8'))
                .ticks.map((t) => t.level));
            break;
        } catch { /* try the next */ }
    }
    if (visited && ![...visited].some((l) => spinnerLevels.has(l))) return [];
    const t = parseTape(raw);
    const run = createLevelRun({
        levelSource: src, boot: t.boot, noclip: t.noclip, noHazards: t.noHazards,
        noDamage: t.noDamage, grants: t.grants, persistence: t.persistence,
        despawn: t.despawn ?? [], equips: t.equips, pins: t.pins ?? [],
        save: t.save ?? null, rng: t.rng ?? null, seam: t.seam ?? null, roles: ROLES,
    });
    const shadow = new Map();
    const landings = [];
    for (let i = 0; i < t.tick_count; i += 1) {
        const before = run.presses.length;
        const bodies = spinnerLevels.has(run.level) ? run.spinnerBodies : [];
        for (const b of bodies) {
            if (!shadow.has(b.id)) shadow.set(b.id, { hits: 0, hitsTimer: 0, destroy: false });
            const st = shadow.get(b.id);
            // `hitUpdate()` runs on the BODY, which updates before the player.
            if (st.hitsTimer > 0) st.hitsTimer -= 1;
        }
        run.advance(new Set(heldKeysAt(t, i)));
        if (run.presses.length === before) continue;
        for (const press of run.presses.slice(before)) {
            for (const b of bodies) {
                const st = shadow.get(b.id);
                if (!st || st.destroy) continue;
                if (!rectsOverlap(press.rect, b.rect)) continue;
                if (distanceRectPoint(run.state.x, run.state.y, b.rect) > SLASH_REACH) continue;
                const after = hitSpinner(
                    { ...st, id: b.id, alpha: 1, removed: false, deathCause: null },
                    { force: 0, from: { x: run.state.x, y: run.state.y },
                        damage: SWORD_DAMAGE, t: 'Sword' },
                );
                if (after.hits === st.hits) continue;
                st.hits = after.hits;
                st.hitsTimer = after.hitsTimer ?? SPINNER.hitsTimerMax;
                st.destroy = Boolean(after.destroy);
                landings.push({ t: press.t, id: b.id, hits: st.hits, killed: st.destroy });
            }
        }
    }
    return landings;
}

describe('R8_D2_SHIELD — slice 6\'s prediction, stated before the press arm moved', () => {
    it('states a fork with both arms and the expected one named', () => {
        const p = R8_D2_SHIELD.prediction;
        expect(p.armA).toMatch(/MOVES NO COMMITTED TAPE/);
        expect(p.armB).toMatch(/r5-press-glide/);
        expect(p.expected).toMatch(/armA/);
        expect(p.armA).not.toBe(p.armB);
        // ⛔ THE RISK IS NAMED IN THE PREDICTION ITSELF, not in the as-built
        // after the fact — arm B has a mechanism and a tick, or it is a hedge.
        expect(p.expected).toMatch(/block-glide/);
        expect(p.expected).toMatch(/t=108/);
    });

    it('the baseline is MEASURED and names the commit it was measured on (trap 40)', () => {
        const b = R8_D2_SHIELD.prediction.baseline;
        expect(b.commit).toBe('f42b1c985');
        expect(b.files).toBe(243);
        expect(b.tests).toBe(7028);
        expect(b.note).toMatch(/read-only/);
    });

    /**
     * ⛔⛔⛔ THE EXPOSURE IS RE-DERIVED FROM THE RUNNING MODEL — every
     * committed tape replayed, every press asked against the SHIPPED gates
     * (`slashRect`/`spearRect` then `distanceRectPoint <= SLASH_REACH`) with
     * the bodies where `run.spinnerBodies` says they stand on that tick.
     *
     * ⚠ THIS IS THE ROW THAT COSTS SECONDS, and it is worth them: the whole
     * prediction turns on WHICH tapes the arm can move, and a room list would
     * have named ten where the gates name two.
     */
    it('⛔ the two exposed tapes are DERIVED by driving the roster, not declared', () => {
        const tapeDir = join(HERE, 'fixtures', 'tapes');
        const names = readdirSync(tapeDir).filter((f) => f.endsWith('.json'))
            .map((f) => f.replace(/\.json$/, ''))
            // ⛓ THIS SLICE'S OWN PAIR IS EXCLUDED FROM THE SWEEP, BY NAME:
            // the claim is about what the conversion can do to tapes that
            // PREDATE it, and a witness tape that presses spinners on purpose
            // is not evidence about the committed roster.
            .filter((n) => n !== 'r8-l18-spinner-press');
        const measured = assertSpinnerPressExposureIsMeasured({
            tapeNames: () => names,
            reachingSpinners: (name) => spinnerLandingsFor(tapeDir, name),
        });
        /**
         * ⛓ THE THIRD NAME IS THIS SLICE'S OWN PAIR, and it is an ADDITION
         * rather than an edit to the prediction — slice 1's precedent
         * (`exposedAdded`): a prediction edited after its measurement is not
         * a prediction. `r8-l18-spinner-press` presses two spinners to death,
         * so of course it reaches one; what the step-0 measurement claimed is
         * which COMMITTED tapes the conversion could move, and that set is
         * still the two.
         */
        expect(measured.tapes.filter((n) => !n.startsWith('r8-')))
            .toEqual(['r5-press-glide', 'r5-press-repeat']);
    }, 120000);

    /**
     * ⛔ THE NON-VACUITY OF THAT CHECK, CONSTRUCTED — a comparison that has
     * never seen a disagreement might be comparing nothing.
     */
    it('⛔ the exposure check FAILS on an undeclared tape, a wrong tick and a kill', () => {
        const ok = R8_D2_SHIELD.pressExposure.reaching[0];
        expect(() => assertSpinnerPressExposureIsMeasured({
            tapeNames: () => ['brand-new-tape'],
            reachingSpinners: () => [{ t: 1, id: 'spinner@0,0', hits: 1, killed: false }],
        })).toThrow(/Undeclared and reaching: brand-new-tape/);
        // ⚠ THE MUTATIONS BELOW SUPPLY THE WHOLE DECLARED SET and change one
        // row inside it — a seam that returned a single tape would red on the
        // set comparison first and never reach the row it is testing.
        const all = R8_D2_SHIELD.pressExposure.reaching;
        const perName = (f) => (n) => f(all.find((r) => r.name === n).landings);
        expect(() => assertSpinnerPressExposureIsMeasured({
            tapeNames: () => all.map((r) => r.name),
            reachingSpinners: perName((ls) => ls.map((l, i) => (
                i === 0 ? { ...l, t: l.t + 1 } : l))),
        })).toThrow(/a right count with wrong ticks/);
        expect(() => assertSpinnerPressExposureIsMeasured({
            tapeNames: () => all.map((r) => r.name),
            reachingSpinners: perName((ls) => ls.map((l) => ({ ...l, killed: true }))),
        })).toThrow(/KILLS a spinner/);
    });

    /**
     * ⛔⛔⛔ THE OUT-OF-BAND FINDING, CHECKED AGAINST THE TRANSCRIPTION THAT
     * OWNS THE ARITHMETIC — §13.10's banked recon said the write is a no-op,
     * and `outOfBandLedger` has said otherwise since R5 slice 5.
     */
    it('⛔ a −1-tagged Spinner kill in L18 lands on {17,29}, not on nothing', () => {
        const declared = R8_D2_SHIELD.outOfBand.forLevel18;
        const flag = outOfBandFlagFor(18, -1);
        expect({ level: flag.level, tag: flag.tag }).toEqual(declared);
        expect(flag.outOfBand).toBe(true);
        expect(TAGS_PER_LEVEL).toBe(30);
        // The two placements really do carry the sentinel — read off the
        // atlas, because the whole finding is that the VALUE is -1 where the
        // bounded vacuity assumed the attribute's presence was enough.
        const l18 = atlasLevelSource()(18);
        const spinners = l18.entities.filter((e) => e.type === 'spinner');
        expect(spinners).toHaveLength(2);
        for (const s of spinners) expect(Number(s.attrs.tag)).toBe(-1);
        /**
         * ⛓ AND THE CLASS IS NOW CLASSIFIED — this row FLIPPED inside the
         * slice that stated it, which is what a debt's record is for. Step 0
         * asserted `not.toContain('Spinner')` (the registry refusing an
         * unclassified class, doing its job); track A registered it from the
         * SOURCE, and `r8-l18-spinner-press` drove the write. ⛔ The GAME's
         * own `persistence_cleared` came back carrying `{level: 17, tag: 29}`
         * — §13.10's "the write is a no-op" refuted by the game itself.
         */
        expect(Object.keys(OUT_OF_BAND_WRITERS)).toContain('Spinner');
        expect(OUT_OF_BAND_WRITERS.Spinner.witness).toMatch(/r8-l18-spinner-press/);
    });

    /**
     * ⛔ THE ROUTE IS CHECKED AGAINST THE MAP, ENTITY BY ENTITY. An anchor
     * that verifies only the seam NAMES is an anchor about prose; this one
     * verifies the DATA MODEL the segments will plan against.
     */
    it('⛔ every route row is the atlas\'s own — level, size and each named entity', () => {
        const src = atlasLevelSource();
        const at = (rec, type) => rec.entities.filter((e) => e.type === type)
            .map((e) => `${e.x},${e.y}`);
        for (const row of R8_D2_SHIELD.route) {
            const rec = src(row.level);
            // ⚠ THE RECORD'S `width`/`height` ARE ALREADY IN TILES — the built
            // world's are in PIXELS, and dividing the wrong one by 16 is
            // [[feedback_units_must_survive_the_round_trip]] in a test.
            expect(`${rec.width}x${rec.height}`).toBe(row.size);
            // every `tag@x,y` the row's prose names must really be there
            for (const [, tag, x, y] of row.what.matchAll(/`(\w+)@(\d+),(\d+)`/g)) {
                expect(at(rec, tag)).toContain(`${x},${y}`);
            }
        }
    });

    it('⛔ L18\'s lock is a KILL-lock and L19\'s bosslock is keyType 0', () => {
        const src = atlasLevelSource();
        const lock18 = src(18).entities.find((e) => e.type === 'lock');
        expect(Number(lock18.attrs.tset)).toBe(KILL_LOCK_TSET);
        const bosslock = src(19).entities.find((e) => e.type === 'bosslock');
        expect(Number(bosslock.attrs.keyType)).toBe(0);
        const key = src(19).entities.find((e) => e.type === 'bosskey');
        expect(Number(key.attrs.keyType)).toBe(0);
        // ⛓ THE KEY IS INSIDE THE BODY — the reason the fight IS the door.
        const boss = src(19).entities.find((e) => e.type === 'shieldboss');
        expect(key.x).toBeGreaterThanOrEqual(boss.x);
        expect(key.x).toBeLessThan(boss.x + 48);
    });

    /**
     * ⛓ THE STAGED BOOT IS THE CAMPAIGN'S OWN LATCH, read off the committed
     * tape rather than typed — a staged boot invented beside the campaign is
     * a claim about a different game.
     */
    it('⛓ the staged boot matches `r7-act2-11`\'s committed v8 block', () => {
        const t = JSON.parse(readFileSync(
            join(HERE, 'fixtures', 'tapes', 'r7-act2-11.json'), 'utf8'));
        expect(R8_D2_SHIELD.stagedBoot.derivedFrom).toMatch(/r7-act2-11/);
        expect(t.seam.items.hasSword).toBe(true);
        expect(t.seam.items.hasShield).toBe(false);
        const clears = t.persistence.map((p) => `{${p.level},${p.tag}}`).join(' ');
        expect(R8_D2_SHIELD.stagedBoot.persistence).toContain(clears);
    });

    it('⛔ the headline is REPORTED, never CREDITED, and says why', () => {
        expect(R8_D2_SHIELD.headline.credited).toBe(false);
        expect(R8_D2_SHIELD.headline.why).toMatch(/staged boot can DECLARE a flag/);
        expect(R8_D2_SHIELD.headline.durableWitness).toMatch(/rockSet/);
    });

    it('⛔ declares that NO tape field is added, so the absence is a decision', () => {
        expect(R8_D2_SHIELD.tapeFormat).toMatch(/UNTOUCHED/);
    });

    /**
     * ⛔ THE REFUSALS ARE CARRIED WITH THEIR REASONS — a refusal that is not
     * written down is one the next slice re-litigates.
     */
    it('⛔ keeps Bob refused and the despawn channel unbuilt, with reasons', () => {
        const bob = R8_D2_SHIELD.refusedHere.find((r) => /Bob/.test(r.what));
        expect(bob.why).toMatch(/die ANIMATION/);
        const despawn = R8_D2_SHIELD.refusedHere.find((r) => /despawn/.test(r.what));
        expect(despawn.why).toMatch(/FAILS CLOSED/);
        // ⛓ The vacuity this slice INHERITS is re-stated rather than assumed
        // — §11.3's press-side fencepost is about an `anim+fade` class.
        const fencepost = R8_D2_SHIELD.refusedHere.find((r) => /fencepost/.test(r.what));
        expect(fencepost.why).toMatch(/anim\+fade/);
    });
});

describe('assertTransitSamplesCarryEtas — the probe states its own clock', () => {
    const walk = (from, n) => Array.from({ length: n },
        (_, i) => ({ x: i, y: 0, tick: from + i + 1 }));

    it('passes on a walk whose samples advance one tick at a time', () => {
        expect(assertTransitSamplesCarryEtas(walk(100, 5), 100))
            .toEqual({ samples: 5, startTick: 100, endTick: 105, span: 5 });
    });

    it('⛔ refuses a sample with no absolute tick', () => {
        expect(() => assertTransitSamplesCarryEtas([{ x: 0, y: 0 }], 100))
            .toThrow(/carries no absolute tick/);
    });

    /**
     * ⛔⛔ THE MUTATION ROW ITSELF: degrade the ETA source to a constant and
     * every sample lands on the plan tick. This is what goes red.
     */
    it('⛔⛔ refuses the COLLAPSE — every sample at the plan tick (trap 161)', () => {
        const collapsed = [0, 1, 2, 3].map((i) => ({ x: i, y: 0, tick: 100 }));
        expect(() => assertTransitSamplesCarryEtas(collapsed, 100))
            .toThrow(/does not advance on 100/);
    });

    it('⛔ refuses a clock that goes backwards', () => {
        const back = [{ x: 0, y: 0, tick: 101 }, { x: 1, y: 0, tick: 100 }];
        expect(() => assertTransitSamplesCarryEtas(back, 100)).toThrow(/goes backwards/);
    });

    it('⛔ refuses an empty sample list — a corridor nobody looked at', () => {
        expect(() => assertTransitSamplesCarryEtas([], 100)).toThrow(/NO samples/);
    });
});

describe('assertTwoPassPrefixAgrees — the loop\'s only non-vacuity check', () => {
    const keys = (...ks) => ks.map((k) => new Set(k ? k.split('+') : []));

    it('passes when the two walks agree below the declared tick', () => {
        const a = keys('right', 'right', 'up', '');
        const b = keys('right', 'right', 'up', 'left');
        expect(assertTwoPassPrefixAgrees(a, b, 3))
            .toEqual({ comparedTicks: 3, pass1: 4, pass2: 4 });
    });

    /**
     * ⛔ THE NON-VACUITY IS WITNESSED. A comparison that has never seen a
     * disagreement might be comparing nothing (§8.4's law, one module over),
     * so the disagreement is CONSTRUCTED and watched to go red BY TICK.
     */
    it('⛔ REDS, naming the tick, when the walks diverge below the declaration', () => {
        const a = keys('right', 'right', 'up');
        const b = keys('right', 'left', 'up');
        expect(() => assertTwoPassPrefixAgrees(a, b, 3))
            .toThrow(/DISAGREE at tick 1, below the declared tick 3/);
    });

    it('⛔ REDS when pass 1 never reached the tick it is said to have measured', () => {
        expect(() => assertTwoPassPrefixAgrees(keys('right'), keys('right', 'right'), 2))
            .toThrow(/pass 1 spent only 1 tick\(s\) but the clear is declared at 2/);
    });

    it('⛔ REDS when pass 2 never reached its own declaration', () => {
        expect(() => assertTwoPassPrefixAgrees(keys('a', 'a', 'a'), keys('a'), 2))
            .toThrow(/pass 2 spent only 1 tick\(s\)/);
    });
});

describe('R8_STRATEGY_EXECUTORS — ⚖ §11.8a as data, and the checks that keep it one', () => {
    it('the three shove post-conditions partition, and a fourth is refused', () => {
        expect(Object.keys(R8_STRATEGY_EXECUTORS.shovePostConditions).sort())
            .toEqual(['clear-path', 'dispose', 'press']);
        expect(assertShovePostConditionKind('clear-path', 'x')).toBe('clear-path');
        expect(() => assertShovePostConditionKind('sink-it', 'x'))
            .toThrow(/not one of \[clear-path, press, dispose\]/);
    });

    it('only `dispose` names a destructive destination as its own answer', () => {
        const k = R8_STRATEGY_EXECUTORS.shovePostConditions;
        expect(k.dispose.destinationIsDestructive).toMatch(/^yes/);
        expect(k.press.destinationIsDestructive).toMatch(/never/);
        expect(k['clear-path'].destinationIsDestructive).toMatch(/last resort/);
    });

    it('every RUNNING executor has a derivation row, and the rest are PENDING', () => {
        const out = assertExecutorParametersAreDerived(STRATEGY_EXECUTORS);
        expect(out.executors).toBe(Object.keys(STRATEGY_EXECUTORS).length);
        // ⛓ The pending list is this slice's own WORK ORDER, computed from the
        // running registry rather than typed — it empties as the executors
        // land, and the as-built quotes it.
        expect([...out.pending].sort()).toEqual(
            Object.keys(R8_STRATEGY_EXECUTORS.executorDerivations)
                .filter((k) => !(k in STRATEGY_EXECUTORS)).sort());
    });

    it('an executor registered with no derivation row is a NAMED failure', () => {
        expect(() => assertExecutorParametersAreDerived({
            ...STRATEGY_EXECUTORS, teleport: () => {},
        })).toThrow(/Registered with no derivation row: teleport/);
    });

    it('the ladder is AVOID -> TIME -> BAIT -> KILL and every rung names its tool', () => {
        expect(R8_STRATEGY_EXECUTORS.ladder.map((r) => r.rung))
            .toEqual(['avoid', 'time', 'bait', 'kill']);
        for (const r of R8_STRATEGY_EXECUTORS.ladder) {
            expect(r.tool.length).toBeGreaterThan(20);
            expect(r.refusesWith.length).toBeGreaterThan(20);
        }
    });

    it('accepts an escalation run that climbs and names each refusal', () => {
        const out = assertEscalationIsOrdered([
            { rung: 'avoid' },
            { rung: 'time', refused: { rung: 'avoid', why: 'no admissible corridor' } },
            { rung: 'kill', refused: { rung: 'bait', why: 'no safe stance' } },
        ]);
        expect(out).toEqual({ rungs: 3, deepest: 'kill' });
    });

    it('refuses a run that goes DOWN the ladder, or sideways', () => {
        expect(() => assertEscalationIsOrdered([
            { rung: 'time', refused: { rung: 'avoid', why: 'x' } }, { rung: 'avoid' },
        ])).toThrow(/CHEAPEST FIRST/);
        expect(() => assertEscalationIsOrdered([
            { rung: 'time', refused: { rung: 'avoid', why: 'x' } },
            { rung: 'time', refused: { rung: 'avoid', why: 'x' } },
        ])).toThrow(/CHEAPEST FIRST/);
    });

    it('refuses an escalation that does not name the cheaper rung it refused', () => {
        expect(() => assertEscalationIsOrdered([{ rung: 'time' }]))
            .toThrow(/does not name the cheaper rung it refused/);
        // ⛔ AND NAMING THE WRONG ONE IS THE SAME FAILURE. "I refused
        // something" and "I refused the rung below me" are different claims.
        expect(() => assertEscalationIsOrdered([
            { rung: 'kill', refused: { rung: 'avoid', why: 'x' } },
        ])).toThrow(/does not name the cheaper rung it refused/);
    });

    it('refuses a rung that is not on the ruled ladder', () => {
        expect(() => assertEscalationIsOrdered([{ rung: 'pray' }]))
            .toThrow(/not a rung of the ruled ladder/);
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
 *  8. `plannerObstacleAt` forwards a 9th family (or stops forwarding one)
 *       → `derives the planner's forwarded/dropped halves …` reds — and this
 *         is the row that measures the CODE rather than the declaration
 *  9. drop `noclip` into the normalised half of that call
 *       → same row reds on the `'noclip' in arrived` assertion
 * 10. `normalizeLiveOpts` stops applying the brand
 *       → `refuses a complete-looking bag …` and `accepts what the normaliser
 *         fills` red, AND all four consumer entries throw by name across the
 *         whole seedlingDemo suite
 * 11. delete a key from `normalizeLiveOpts`' fixed literal
 *       → the coverage half of `assertNormalizedLiveOpts` fires at every
 *         consumer entry. ⚠ It cannot be provoked from a CALL SITE — the brand
 *         is a module-private Symbol, so no external caller can mint an
 *         incomplete branded bag. MUTATION-ONLY BITER, recorded as such rather
 *         than dressed up as a call-site guard.
 *
 * ── slice 3b's rows ───────────────────────────────────────────────────
 *
 * 12. add a fourth `shovePostConditions` key
 *       → `the three shove post-conditions partition …` reds
 * 13. register an executor without a derivation row (or delete a row)
 *       → `the derivation table and the RUNNING registry are one key set` reds
 * 14. reorder `ladder` (e.g. bait before time)
 *       → `the ladder is AVOID -> TIME -> BAIT -> KILL …` reds
 * 15. register `touch`
 *       → `keeps `touch` refused AS THE LIVE CONTROL` reds — the control is
 *         asserted against the RUNNING registry, not against its own sentence
 */

describe('R8_D2_COMPLETE — slice 7\'s prediction, committed before a line of it moved', () => {
    it('carries ⚖ ruling 1 as the CORRECTION it is — the charged route and the ruled one', () => {
        const g = R8_D2_COMPLETE.routeGraph;
        // ⛔ The charged text is kept so the correction is legible AS a
        // correction. A prediction that quietly substituted the right route
        // would leave nothing for a reader to check the ruling against.
        expect(g.charged).toMatch(/L13's alcove/);
        expect(g.ruled).toMatch(/THREE CONTIGUOUS SEGMENTS/);
        expect(g.charged).not.toBe(g.ruled);
        expect(g.standaloneWitnessUntouched).toBe('r8-solve-20');
    });

    it('⛔ RE-DERIVES the D2 edges from the running atlas, both ways', () => {
        const out = assertD2RouteGraph(atlasLevelSource());
        expect(out.edges).toBe(R8_D2_COMPLETE.routeGraph.edges.length);
    });

    it('the route check is NON-VACUOUS — a doctored atlas reds it BY NAME', () => {
        // ⛔ CONSTRUCTED, not assumed. A set equality that has never seen a
        // disagreement might be comparing nothing (§8.4's law).
        const real = atlasLevelSource();
        const doctored = (n) => (n !== 13 ? real(n) : {
            ...real(13),
            entities: [...(real(13).entities ?? []),
                { type: 'stairsdown', x: 0, y: 0, attrs: { to: '18' } }],
        });
        expect(() => assertD2RouteGraph(doctored)).toThrow(/L13 now HAS an edge to L18/);
    });

    it('states the seam consequence that makes the charged route unwalkable', () => {
        const why = R8_D2_COMPLETE.routeGraph.why.map((w) => `${w.claim} ${w.consequence}`)
            .join(' | ');
        expect(why).toMatch(/L13 has NO edge to L18/);
        expect(why).toMatch(/SEAM_CHANNELS/);
        // And the second reading — L13 into L20's alcove — is ruled OUT
        // rather than merely unused, because it is a dead end at the start.
        expect(why).toMatch(/DEAD END at the\s+start/);
    });

    it('⛔⛔⛔ MEASURES the forecast transient rather than asserting it', async () => {
        /**
         * The step-0 finding, driven: a forecast taken on a level's FIRST
         * tick runs its whole horizon with `beforeTypeFlip` frozen TRUE, and
         * `collidesSolid`'s `beforeTypeFlip` arm selects `objectSolids` — a
         * world with no solid TILES. So the bodies leave the room and never
         * return, and `dangerMap.spinnerDanger`'s `atEta` arm then forbids
         * nothing at all.
         *
         * ⛔ THIS TEST IS WRITTEN AGAINST THE DEFECT AND MUST FLIP when the
         * fix lands. It is here so the fix has a baseline to move, which is
         * the only thing that makes it a measurement (trap 40).
         */
        const mk = () => createLevelRun({
            levelSource: atlasLevelSource(),
            boot: { level: 18, x: 16, y: 32 },
            noclip: false, noHazards: [], noDamage: true, grants: [], persistence: [],
            despawn: [], equips: [], pins: ['dead_frames'],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        });
        const width = mk().world.width * 16;
        const fresh = mk().spinnerForecast(400);
        const escaped = fresh.some((step) => step.some((r) => r.x < 0 || r.right > width));
        const after = (() => {
            const r = mk();
            r.advance(new Set());
            return r.spinnerForecast(400);
        })();
        const escapedAfter = after.some(
            (step) => step.some((r) => r.x < 0 || r.right > width));
        // The declaration is that the FRESH forecast escapes and the
        // one-tick-later forecast does not — which is the whole shape of a
        // frozen ONE-TICK TRANSIENT.
        expect(R8_D2_COMPLETE.forecastTransient.field).toBe('beforeTypeFlip');
        expect(R8_D2_COMPLETE.forecastTransient.frozenCorrectly).toContain('pushables');
        expect(escaped).toBe(true);
        expect(escapedAfter).toBe(false);
        expect(R8_D2_COMPLETE.forecastTransient.measured.cleanWhenTakenAfterTicks)
            .toEqual([1, 2, 10]);
    });

    it('states a fork whose arms are DIFFERENT claims', () => {
        const p = R8_D2_COMPLETE.forecastTransient.prediction;
        expect(p.armA).toMatch(/byte-exact/);
        expect(p.armB).toMatch(/drifts/);
        expect(p.armA).not.toBe(p.armB);
    });

    it('the producer baseline names trap 169\'s KNOWN drift rather than hiding it', () => {
        const b = R8_D2_COMPLETE.producerBaseline;
        expect(b.at).toBe('7a0009a92');
        expect(b.byteIdentical).toHaveLength(8);
        expect(b.drifting).toHaveLength(1);
        expect(b.drifting[0]).toMatchObject({ name: 'r8-solve-4', derived: 255, committed: 253 });
    });

    it('every executor this slice owes names what its parameters are DERIVED from', () => {
        // ⚖ §11.8a's law, applied to the prediction rather than only to the
        // code: an executor row with no derivation is a policy choice waiting
        // to be typed in.
        expect(R8_D2_COMPLETE.executors.length).toBeGreaterThanOrEqual(4);
        for (const e of R8_D2_COMPLETE.executors) {
            expect(typeof e.derivedFrom).toBe('string');
            expect(e.derivedFrom.length).toBeGreaterThan(40);
        }
        const fight = R8_D2_COMPLETE.executors.find((e) => e.verb === 'fight');
        expect(fight.derivedFrom).toMatch(/shieldBossWindowFor/);
        expect(fight.derivedFrom).toMatch(/NEVER a hand-tuned constant/);
        // ⛔ And `touch`'s control is REPLACED, not deleted (§13.10).
        const touch = R8_D2_COMPLETE.executors.find((e) => e.verb === 'touch');
        expect(touch.controlReplacedBy).toMatch(/wandlock/);
    });

    it('⚖ RULING 2 — PINS the boss blindness instead of curing it', () => {
        const b = R8_D2_COMPLETE.bossBlindness;
        expect(b.skippedBy).toMatch(/kind === 'boss'/);
        expect(b.standsInFor.length).toBe(3);
        /**
         * ⛔ THE PIN ITSELF, DRIVEN. `dangerVolumes` is EMPTY in L19 with the
         * body standing — which is a fact about the shipped union, measured
         * rather than restated. A future boss ingredient reds THIS row and
         * forces a conscious decision about the fight's only stance, instead
         * of silently sealing a room whose solve predates it.
         */
        const run = createLevelRun({
            levelSource: atlasLevelSource(),
            boot: { level: 19, x: 16, y: 144 },
            noclip: false, noHazards: [], noDamage: false, grants: [], persistence: [],
            despawn: [], equips: [], pins: ['dead_frames'],
            save: { totem_parts: [], keys: [], seal_parts: [] },
            rng: null, seam: { items: { hasSword: true } }, roles: ROLES,
        });
        // A POSITIVE FIRST: the body really is there, so the empty verdict
        // below is a skip and not an absence (§12.3's own law).
        expect((run.world.combat?.enemies ?? []).map((e) => e.tag)).toContain('shieldboss');
        expect(run.world.shieldBosses.length).toBe(1);
        expect(dangerVolumes(run, 0)).toEqual([]);
    });

    it('names the chain, its cut rule and its two internal seams', () => {
        const c = R8_D2_COMPLETE.chain;
        expect(c.kind).toBe('staged');
        expect(c.segments).toEqual(['r8-d2-18', 'r8-d2-19', 'r8-d2-20']);
        expect(c.internalSeams).toBe(c.segments.length - 1);
        expect(c.cutRule).toMatch(/trap 150/);
        expect(c.endsAt).toMatch(/L13/);
    });
});
