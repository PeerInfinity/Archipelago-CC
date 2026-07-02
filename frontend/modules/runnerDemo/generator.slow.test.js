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
    generateLevel, generateZoneSet, deriveGeneratedRules,
} from './generator.js';
import { deriveAccessRules } from './deriveRules.js';
import { DEFAULTS, PROFILES } from './physics.js';
import { validateLevel } from './level.js';
import { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME } from './gameCore.js';

const REQUIREMENTS = [[], ['doubleJump'], ['blue'], ['doubleJump', 'blue']];
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
        });
    }

    it('same seed ⇒ byte-identical level for every requirement', () => {
        for (const requirement of REQUIREMENTS) {
            const opts = { id: 'det', requirement, branchCount: 1, hazardChance: 0.5, seed: 7 };
            expect(JSON.stringify(generateLevel(opts)), requirement.join('+'))
                .toBe(JSON.stringify(generateLevel(opts)));
        }
    });

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
    });
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
    });

    it('same seed ⇒ byte-identical zone table', () => {
        expect(JSON.stringify(generateZoneSet({ count: 5, seed: 3 })))
            .toBe(JSON.stringify(generateZoneSet({ count: 5, seed: 3 })));
    });
});

describe('calibration pins', () => {
    it('the pinned celeste REACH matches a fresh solver sweep', () => {
        expect(sweepMaxGap(DEFAULTS, { doubleJump: false, blue: false }))
            .toBeCloseTo(CELESTE_GEOMETRY.REACH.single, 2);
        expect(sweepMaxGap(DEFAULTS, { doubleJump: true, blue: false }))
            .toBeCloseTo(CELESTE_GEOMETRY.REACH.dj, 2);
    });

    it('a non-pinned profile (nsmbu) derives structurally valid geometry', () => {
        const C = PROFILES.nsmbu.constants;
        const G = deriveGeometry(C);
        expect(validateGeometry(G, C)).toEqual([]);
    });
});
