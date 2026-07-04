/**
 * Generator slow gates (plan §4.5 verification story): the seed-range
 * generate-and-verify sweep (every goal derives exactly [S], zero
 * defects, validateLevel passes, byte-identical determinism), the
 * zone-table structure, an independent full-graph re-derive
 * cross-checking the layered verify path, and the pinned-REACH
 * re-sweep. Run via `npm run test:unit:slow` (the default vitest
 * config excludes *.slow.test.js).
 */

import { describe, it, expect } from 'vitest';
import {
    CELESTE_GEOMETRY, sweepMaxGap, deriveGeometry, validateGeometry,
    generateLevel, generateLevelForSpecs, generateZoneSet, deriveGeneratedRules,
    SWEEP_SATURATING_PROFILES, sweepSpringTotal, sweepMaxRise, sweepCeilingMin,
    sweepGlideChasm, measureTapArc, applyCeilingMargin,
} from './generator.js';
import { deriveAccessRules } from './deriveRules.js';
import { DEFAULTS, PROFILES } from './physics.js';
import { validateLevel } from './level.js';
import { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME } from './gameCore.js';

const REQUIREMENTS = [[], ['doubleJump'], ['blue'], ['spring'],
    ['doubleJump', 'blue'], ['doubleJump', 'spring'],
    ['doubleJump', 'blue', 'spring'],
    ['glide'], ['doubleJump', 'glide'], ['glide', 'spring'],
    ['blue', 'doubleJump', 'glide', 'spring']];
const SEEDS = [1, 2, 3, 4];

const goalRules = (level, derived) => Object.fromEntries([
    ...level.pickups.map((pk) => [pk.id, derived.pickups[pk.id].minimalSets]),
    ...level.portals.map((pt) => [pt.id, derived.exits[pt.id].minimalSets]),
]);

describe('seed-range generate-and-verify', () => {
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

    it('same seed ⇒ byte-identical level for every requirement', () => {
        for (const requirement of REQUIREMENTS) {
            const opts = { id: 'det', requirement, branchCount: 1, hazardChance: 0.5, seed: 7 };
            expect(JSON.stringify(generateLevel(opts)), requirement.join('+'))
                .toBe(JSON.stringify(generateLevel(opts)));
        }
    }, 300000);

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
        // 11 requirements × (generate + full-N² derive); glide strips
        // are the longest levels in the corpus
    }, 600000);
});

describe('generateZoneSet', () => {
    it('builds a winnable zone table: starter grant, one grant per feature, Victory last', () => {
        const zones = generateZoneSet({ count: 6, seed: 2 });
        expect(zones).toHaveLength(6);
        for (const { level } of zones) {
            expect(validateLevel(level, DEFAULTS), level.id).toEqual([]);
            expect(level.portals.map((p) => p.id)).toContain('exit_main');
        }
        const allItems = zones.flatMap((z) => Object.values(z.items));
        for (const item of Object.values(ABILITY_ITEM_NAMES)) {
            expect(allItems.filter((i) => i === item)).toHaveLength(1);
        }
        expect(allItems.filter((i) => i === VICTORY_ITEM_NAME)).toHaveLength(1);
        // zone 0 grants an ability item with no requirement; Victory is last
        expect(Object.values(zones[0].items)).toHaveLength(1);
        expect(Object.values(ABILITY_ITEM_NAMES))
            .toContain(Object.values(zones[0].items)[0]);
        expect(Object.values(zones[zones.length - 1].items)).toEqual([VICTORY_ITEM_NAME]);
        // The stamped generation spec reproduces the stored level
        // byte-identically — the contract extractZoneRules relies on to
        // regenerate with branch exits (zoneRules.js).
        for (const zone of zones) {
            expect(zone.spec).toMatchObject({ pickupCount: expect.any(Number) });
            expect(JSON.stringify(generateLevel({ id: zone.level.id, ...zone.spec })))
                .toBe(JSON.stringify(zone.level));
        }
    });

    it('same seed ⇒ byte-identical zone table', () => {
        expect(JSON.stringify(generateZoneSet({ count: 5, seed: 3 })))
            .toBe(JSON.stringify(generateZoneSet({ count: 5, seed: 3 })));
    });
});

describe('reward shelves (plan §8.7 step 2)', () => {
    // Forced shelves (shelfChance 1) across gate shapes and seeds:
    // generateLevel's internal verify is the gate — every goal
    // (including the shelf pickup) must derive exactly [S].
    for (const requirement of [['spring'], ['doubleJump'], ['doubleJump', 'spring']]) {
        const want = [...requirement].sort();
        it(`forced shelf on [${requirement.join('+')}] × seeds 1,2`, () => {
            for (const seed of [1, 2]) {
                const level = generateLevel({
                    id: `shelf_${want.join('_')}_${seed}`, requirement,
                    pickupCount: 2, branchCount: 1, hazardChance: 0.5,
                    shelfChance: 1, seed,
                });
                const shelves = level.platforms.filter((p) => p.type === 'oneway');
                expect(shelves, level.id).toHaveLength(1);
                expect(level.pickups.some((pk) => pk.on === shelves[0].id)).toBe(true);
                // generateLevel's internal verify IS the exact-[S] gate
                // (it throws otherwise); the same-path re-derive that
                // used to sit here doubled the cost for no new signal —
                // the independent-agreement property lives in the
                // seed-range sweep and the full-graph cross-check above.
            }
        });
    }

    it('full jitter across gate shapes: every goal still derives exactly [S]', () => {
        for (const requirement of [['doubleJump'], ['spring'], ['blue'], ['doubleJump', 'blue']]) {
            const want = [...requirement].sort(); // names the generated ids
            for (const seed of [1, 2]) {
                const level = generateLevel({
                    id: `jit_${want.join('_')}_${seed}`, requirement,
                    pickupCount: 2, branchCount: 1, hazardChance: 0.5,
                    jitter: 1, seed,
                });
                // the internal verify is the exact-[S] gate (see the
                // forced-shelf note); assert the knob's own promise
                expect(validateLevel(level, DEFAULTS), level.id).toEqual([]);
                expect(level.platforms.some((p) => p.type === 'ground' && p.h === 1
                    && p.y > 0), level.id).toBe(true);
            }
        }
    }, 300000);

    it('full splits + jitter across gate shapes: every goal still derives exactly [S]', () => {
        for (const requirement of [[], ['doubleJump'], ['spring']]) {
            const want = [...requirement].sort();
            for (const seed of [1, 2]) {
                const level = generateLevel({
                    id: `split_${want.join('_') || 'plain'}_${seed}`, requirement,
                    pickupCount: 2, branchCount: 1, hazardChance: 0.5,
                    splitChance: 1, jitter: 1, seed,
                });
                expect(validateLevel(level, DEFAULTS), level.id).toEqual([]);
                expect(level.platforms.some((p) => p.id.startsWith('lane')), level.id)
                    .toBe(true);
            }
        }
    }, 300000);

    it('full ceilings + splits + jitter across gate shapes: every goal still derives exactly [S]', () => {
        // ceilingMargin covers both regimes: 1 (default, grounded-tap
        // forgiving windows) and 0 (expert coyote-tap windows)
        for (const margin of [1, 0]) {
            for (const requirement of [[], ['doubleJump'], ['spring']]) {
                const want = [...requirement].sort();
                for (const seed of [1, 2]) {
                    const level = generateLevel({
                        id: `ceil_m${margin}_${want.join('_') || 'plain'}_${seed}`, requirement,
                        pickupCount: 2, branchCount: 1, hazardChance: 0.5,
                        ceilingChance: 1, ceilingMargin: margin, splitChance: 1, jitter: 1, seed,
                    });
                    expect(validateLevel(level, DEFAULTS), level.id).toEqual([]);
                    expect(level.hazards.some((hz) => hz.type === 'ceiling'), level.id)
                        .toBe(true);
                }
            }
        }
    }, 600000);

    it('spec path plants ceilings (ceilingChance 1) and the goals still derive exactly', () => {
        const { level, derived } = generateLevelForSpecs({
            id: 'ceil_spec',
            exitSpecs: [
                { key: 'E', requirement: ['doubleJump'] },
                { key: 'W', requirement: [] },
            ],
            pickupSpecs: [{ id: 'it_a', requirement: [] }],
            ceilingChance: 1, seed: 1,
        });
        expect(level.hazards.some((hz) => hz.type === 'ceiling')).toBe(true);
        expect(derived.exits.exit_main.minimalSets).toEqual([['doubleJump']]);
        expect(derived.exits.exit_br0.minimalSets).toEqual([[]]);
        expect(derived.pickups.it_a.minimalSets).toEqual([[]]);
    }, 120000);

    it('spec path realises a glide gate window (§8.7 step 4)', () => {
        const { level, derived, portalByKey } = generateLevelForSpecs({
            id: 'glide_spec',
            exitSpecs: [
                { key: 'E', requirement: ['glide'] },
                { key: 'N', requirement: [] },
            ],
            pickupSpecs: [{ id: 'it_g', requirement: ['glide'] }],
            seed: 2,
        });
        expect(level.platforms.some((p) => p.type === 'glider')).toBe(true);
        expect(portalByKey.E).toBe('exit_main');
        expect(derived.exits.exit_main.minimalSets).toEqual([['glide']]);
        expect(derived.exits[portalByKey.N].minimalSets).toEqual([[]]);
        expect(derived.pickups.it_g.minimalSets).toEqual([['glide']]);
    }, 300000);

    it('spec path honors jitter (raised floors; goals still derive exactly)', () => {
        const { level, derived } = generateLevelForSpecs({
            id: 'jit_spec',
            exitSpecs: [
                { key: 'E', requirement: ['doubleJump'] },
                { key: 'W', requirement: [] },
            ],
            pickupSpecs: [{ id: 'it_a', requirement: [] }],
            jitter: 1, seed: 1,
        });
        expect(level.platforms.some((p) => p.type === 'ground' && p.h === 1 && p.y > 0))
            .toBe(true);
        expect(derived.exits.exit_main.minimalSets).toEqual([['doubleJump']]);
        expect(derived.exits.exit_br0.minimalSets).toEqual([[]]);
    }, 120000);

    it('spec path: a shelved window pickup derives its window set; plan grammar unchanged', () => {
        const { level, derived, portalByKey } = generateLevelForSpecs({
            id: 'shelf_spec',
            exitSpecs: [
                { key: 'E', requirement: ['doubleJump'] },
                { key: 'W', requirement: [] },
            ],
            pickupSpecs: [{ id: 'it_a', requirement: ['doubleJump'] }],
            shelfChance: 1, seed: 1,
        });
        expect(portalByKey).toEqual({ E: 'exit_main', W: 'exit_br0' });
        const shelves = level.platforms.filter((p) => p.type === 'oneway');
        expect(shelves).toHaveLength(1);
        expect(level.pickups.find((pk) => pk.id === 'it_a').on).toBe(shelves[0].id);
        expect(derived.pickups.it_a.minimalSets).toEqual([['doubleJump']]);
        expect(derived.exits.exit_main.minimalSets).toEqual([['doubleJump']]);
        expect(derived.exits.exit_br0.minimalSets).toEqual([[]]);
    });
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
    });

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
