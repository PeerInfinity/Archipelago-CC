/**
 * Generator CALIBRATION tier (runner test-strategy rebalance §3) — the heavy
 * proofs DEMOTED from the routine slow battery. Run manually via
 * `npm run test:unit:calib` ONLY when gate vocabulary, a physics profile /
 * deriveGeometry / sweep, solver internals (canRun.js), or the oracle
 * (witnessSearch.js) change. NOT in CI, NOT in the slow battery.
 *
 * Contents: the FULL requirement×seed generate-and-verify sweep and the FULL
 * requirement full-graph-vs-layered agreement (the slow battery keeps only a
 * 3-row smoke of the former); plus the calibration pins, duplicated from the
 * slow battery — the cheap canary lives there, the authoritative
 * re-derivation lives here.
 */

import { describe, it, expect } from 'vitest';
import {
    CELESTE_GEOMETRY, sweepMaxGap, deriveGeometry, validateGeometry,
    generateLevel, sweepSpringTotal, sweepMaxRise, sweepCeilingMin,
    sweepGlideChasm, measureTapArc, applyCeilingMargin,
    SWEEP_SATURATING_PROFILES, deriveGeneratedRules,
} from './generator.js';
import { deriveAccessRules } from './deriveRules.js';
import { DEFAULTS, PROFILES } from './physics.js';
import { validateLevel } from './level.js';

// Shield rows are EXPENSIVE (a bed pulls 'shield' into the verify
// universe — 2× the subset table — and every shield-subset flood gains
// a second budget level), so the matrix carries the two load-bearing
// rows only: the solo gate and the nested chain. Wider shield combos
// are covered where they're cheap-per-run: the 6-zone table ([spring,
// shield] / [blue,shield] reqs + the bot gate), the spec-path shield
// test below, and the sphere slow suite. A 5-ability everything row
// was tried and timed the suite out (~51 min): the 4-ability row stays
// the everything check.
const REQUIREMENTS = [[], ['doubleJump'], ['blue'], ['spring'],
    ['doubleJump', 'blue'], ['doubleJump', 'spring'],
    ['doubleJump', 'blue', 'spring'],
    ['glide'], ['doubleJump', 'glide'], ['glide', 'spring'],
    ['shield'], ['doubleJump', 'shield'],
    ['blue', 'doubleJump', 'glide', 'spring']];
const SEEDS = [1, 2, 3, 4];

const goalRules = (level, derived) => Object.fromEntries([
    ...level.pickups.map((pk) => [pk.id, derived.pickups[pk.id].minimalSets]),
    ...level.portals.map((pt) => [pt.id, derived.exits[pt.id].minimalSets]),
]);

describe('seed-range generate-and-verify (FULL sweep — calibration tier)', () => {
    for (const requirement of REQUIREMENTS) {
        const want = [...requirement].sort();
        it(`requirement [${requirement.join('+') || 'none'}] × seeds ${SEEDS.join(',')}`, () => {
            for (const seed of SEEDS) {
                const level = generateLevel({
                    id: `sweep_${want.join('_') || 'plain'}_${seed}`,
                    requirement, branchCount: 1, hazardChance: 0.5, seed,
                });
                expect(validateLevel(level, DEFAULTS), level.id).toEqual([]);
                // generateLevel's internal verify IS the gate; re-check
                // its claim through the same derive path
                const derived = deriveGeneratedRules(level, DEFAULTS);
                expect(derived.defects, level.id).toEqual([]);
                for (const [id, sets] of Object.entries(goalRules(level, derived))) {
                    expect(sets, `${level.id} ${id}`).toEqual([want]);
                }
            }
        }, 300000);
    }

    it('independent full-graph derive agrees with the layered verify path', () => {
        for (const requirement of REQUIREMENTS) {
            const want = [...requirement].sort();
            const level = generateLevel({
                id: `xcheck_${want.join('_') || 'plain'}`,
                requirement, branchCount: 1, hazardChance: 0.5, seed: 5,
            });
            // default reach = full N² graph flood (deriveRules.js)
            const derived = deriveAccessRules(level, { constants: DEFAULTS });
            expect(derived.defects, level.id).toEqual([]);
            for (const [id, sets] of Object.entries(goalRules(level, derived))) {
                expect(sets, `${level.id} ${id}`).toEqual([want]);
            }
        }
        // 13 requirements × (generate + full-N² derive); glide strips
        // are the longest levels in the corpus, and shield rows add a
        // second budget level to every full graph
    }, 900000);

});

describe('calibration pins', () => {
    it('the pinned celeste REACH matches a fresh solver sweep', () => {
        expect(sweepMaxGap(DEFAULTS, { doubleJump: false, blue: false }))
            .toBeCloseTo(CELESTE_GEOMETRY.REACH.single, 2);
        expect(sweepMaxGap(DEFAULTS, { doubleJump: true, blue: false }))
            .toBeCloseTo(CELESTE_GEOMETRY.REACH.dj, 2);
        expect(sweepSpringTotal(DEFAULTS)).toBeCloseTo(CELESTE_GEOMETRY.REACH.spring, 2);
    });

    it('the pinned celeste RISE matches a fresh solver sweep', () => {
        expect(sweepMaxRise(DEFAULTS, { doubleJump: false }))
            .toBeCloseTo(CELESTE_GEOMETRY.RISE.single, 2);
        expect(sweepMaxRise(DEFAULTS, { doubleJump: true }))
            .toBeCloseTo(CELESTE_GEOMETRY.RISE.dj, 2);
    });

    it('the pinned celeste singleUp matches a fresh sweep at dy JITTER_MAX', () => {
        expect(sweepMaxGap(DEFAULTS, { doubleJump: false, blue: false },
            { dy: CELESTE_GEOMETRY.JITTER_MAX }))
            .toBeCloseTo(CELESTE_GEOMETRY.REACH.singleUp, 2);
    });

    it('a non-pinned profile (nsmbu) derives structurally valid geometry', () => {
        const C = PROFILES.nsmbu.constants;
        const G = deriveGeometry(C);
        expect(validateGeometry(G, C)).toEqual([]);
        // nsmbu REFUSES ceilings: its floaty taps push the swept
        // crossing minimum nearly to its full-hold player top, so the
        // punish window collapses (the deriveGeometry refusal path)
        expect(G.CEIL_RISE).toBe(null);
        // nsmbu's ceiling refusal forces deriveGeometry through full sweeps —
        // the heaviest pin; the 300 s budget class (like the other sweep pins).
    }, 300000);

    it('the pinned celeste CEIL_MIN_CLEAR matches a fresh robust ceiling sweep', () => {
        const gapMax = CELESTE_GEOMETRY.CEIL_GAP.min + CELESTE_GEOMETRY.CEIL_GAP.span;
        expect(sweepCeilingMin(DEFAULTS, gapMax))
            .toBeCloseTo(CELESTE_GEOMETRY.CEIL_MIN_CLEAR, 2);
    }, 300000);

    it('the pinned celeste TAP matches a fresh engine measurement, and the forgiving band clears a fresh sweep', () => {
        const t = measureTapArc(DEFAULTS);
        expect(t.top).toBeCloseTo(CELESTE_GEOMETRY.TAP.top, 2);
        expect(t.range).toBeCloseTo(CELESTE_GEOMETRY.TAP.range, 2);
        // the forgiving band min (TAP.top + 0.45) must sit >= 0.4 above
        // the robust swept crossing minimum at the forgiving gap max —
        // the same margin doctrine as the expert band
        const easy = applyCeilingMargin(CELESTE_GEOMETRY, 1);
        const sweptEasy = sweepCeilingMin(DEFAULTS, easy.CEIL_GAP.min + easy.CEIL_GAP.span);
        expect(easy.CEIL_RISE.min).toBeGreaterThanOrEqual(sweptEasy + 0.4);
    }, 300000);

    it('the pinned celeste GLIDE bounds match fresh chasm sweeps', () => {
        // worst-case dj bound: max ramp step, MIN pad extents (the
        // landing floor nearest the suppressed pad's ramp)
        expect(sweepGlideChasm(DEFAULTS, { doubleJump: true }, { padGap: 1.4, padW: 5 }))
            .toBeCloseTo(CELESTE_GEOMETRY.GLIDE_DJ_MAX, 2);
        expect(sweepGlideChasm(DEFAULTS, { glide: true },
            { padRise: 1.2, padGap: 1.4, padW: 5 }))
            .toBeCloseTo(CELESTE_GEOMETRY.GLIDE_REACH.min, 2);
        expect(sweepGlideChasm(DEFAULTS, { glide: true },
            { padRise: 1.5, padGap: 1.8, padW: 6 }))
            .toBeCloseTo(CELESTE_GEOMETRY.GLIDE_REACH.max, 2);
    }, 300000);

    it('SWEEP_SATURATING_PROFILES membership matches a fresh dj sweep of every profile', () => {
        // The binary search converges just under the cap when the true
        // reach exceeds it; anything within one probe-step of 16 is
        // saturated. exitGateVeto pins its physics-gate refusals on
        // this list, so it must track the profile data exactly.
        for (const [id, profile] of Object.entries(PROFILES)) {
            const dj = sweepMaxGap(profile.constants, { doubleJump: true, blue: false });
            expect(dj >= 15.9, `${id} dj sweep ${dj}`)
                .toBe(SWEEP_SATURATING_PROFILES.includes(id));
        }
    }, 300000);
});
