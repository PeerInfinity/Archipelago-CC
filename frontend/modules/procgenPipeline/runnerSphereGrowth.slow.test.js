/**
 * Sphere-driven growth × the runner substrate (plan §4.9 gate): the
 * sphere ORACLE — the computed sphere log of the emitted rules.json
 * must equal the input plan exactly — over runner-only worlds, the
 * count-gate authored-lock path, a mixed maze+runner world, and the
 * sweep-saturation abort. The bounce block in sphereGrowth.slow.test.js
 * is the model. Run via `npm run test:unit:slow`.
 */

import { describe, it, expect } from 'vitest';

// Side-effect: registers the maze and runner substrates.
import '../mazeRoom/mazeRoomLibrary.js';
import {
    GATEABLE_ITEMS, SWEEP_SATURATING_PROFILES,
} from '../runnerDemo/runnerDemoLibrary.js';
import { validateLevel } from '../runnerDemo/level.js';
import { resolveGenPhysics } from '../runnerDemo/generator.js';
import { growSpheres, buildRulesJson } from './procgenPipelineEngine.js';
import {
    planSpheres, computeItemSpheres, compareSpheresToPlan,
} from './spherePlanner.js';

const RUNNER_POOL = { 'Double Jump': 1, 'Blue Platforms': 1, Victory: 1 };

const makeRunnerPlan = (seed, sphereCount) => planSpheres({
    itemPool: RUNNER_POOL,
    sphereCount,
    victoryItem: 'Victory',
    gateableItems: GATEABLE_ITEMS,
    seed,
});

// What buildRunnerRegionParams produces for an untouched panel — the
// regionParams the engine hands the runner hooks in a real run.
const RUNNER_REGION_PARAMS = {
    runnerPhysicsProfile: 'celeste',
    runnerGapMargin: 0,
    runnerHazardDensity: 0.35,
    runnerLengthSteps: 2,
};

describe('growSpheres (runner) — zone realisation + oracle', () => {
    it.each([
        [1, 3],
        [2, 3],
    ])('runner-only world, seed %i, %i spheres: computed spheres == plan',
        (seed, sphereCount) => {
            const plan = makeRunnerPlan(seed, sphereCount);
            const { grid, stats, startCell } = growSpheres({
                regionSize: { width: 8, height: 6 },
                seed,
                regionParams: RUNNER_REGION_PARAMS,
                growthParams: {
                    spherePlan: plan,
                    substrateQuotas: { runner: 99 },
                    startSubstrate: 'runner',
                    maxItemsPerRegion: 2,
                },
            });
            expect(stats.substrateCounts.runner).toBe(stats.regionsBuilt);

            // every runner level validates under its stamped constants,
            // and every NON-START region carries the guaranteed back
            // portal on its entrance side — UNGATED geometry (the payload
            // never carries gate_rules; the spec path derived exactly []
            // for the entrance-side portal or generation would have
            // thrown)
            const startRegionId = grid.getRegion(startCell).region_id;
            const { C } = resolveGenPhysics('celeste');
            for (const region of grid.allRegions()) {
                const params = region.playable_payload?.params;
                expect(params?.runnerLevel).toBeTruthy();
                expect(validateLevel(params.runnerLevel, C)).toEqual([]);
                expect(params.physics?.profile).toBe('celeste');
                expect(region.playable_payload.gate_rules).toBeUndefined();
                if (region.region_id !== startRegionId) {
                    expect(params.backExitSide).toBeTruthy();
                    expect(params.sidePortals[params.backExitSide]).toBeTruthy();
                }
            }

            const rulesJson = buildRulesJson(grid, {
                startCell, seed, embedSphereLog: false,
                completionConditionItem: 'Victory',
            });
            const computed = computeItemSpheres(rulesJson);
            expect(compareSpheresToPlan(computed, plan)).toEqual([]);
        }, 240000);

    it('Glide in the pool (§8.7 step 4): a pad-gated region realises and the oracle agrees', () => {
        const pool = { 'Double Jump': 1, Glide: 1, Victory: 1 };
        const plan = planSpheres({
            itemPool: pool, sphereCount: 3, victoryItem: 'Victory',
            gateableItems: GATEABLE_ITEMS, seed: 5,
        });
        const { grid, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 5,
            regionParams: RUNNER_REGION_PARAMS,
            growthParams: {
                spherePlan: plan,
                substrateQuotas: { runner: 99 },
                startSubstrate: 'runner',
                maxItemsPerRegion: 2,
            },
        });
        // the Glide gate realises as glider-pad geometry somewhere
        const levels = [...grid.allRegions()]
            .map((r) => r.playable_payload?.params?.runnerLevel).filter(Boolean);
        expect(levels.some((l) => l.platforms.some((p) => p.type === 'glider')))
            .toBe(true);
        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 5, embedSphereLog: false,
            completionConditionItem: 'Victory',
        });
        expect(compareSpheresToPlan(computeItemSpheres(rulesJson), plan)).toEqual([]);
    }, 240000);

    it('Shield in the pool (§4.10): a bed-gated region realises and the oracle agrees', () => {
        // the Shield is sphere-gateable like any ability item: the
        // grower composes a Shield exit gate, the strip realises it as
        // a budgeted `bed` volume, and the emitted rules gate on
        // Has("Shield") — the sphere oracle proves the placement
        const pool = { 'Double Jump': 1, Shield: 1, Victory: 1 };
        const plan = planSpheres({
            itemPool: pool, sphereCount: 3, victoryItem: 'Victory',
            gateableItems: GATEABLE_ITEMS, seed: 5,
        });
        const { grid, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 5,
            regionParams: RUNNER_REGION_PARAMS,
            growthParams: {
                spherePlan: plan,
                substrateQuotas: { runner: 99 },
                startSubstrate: 'runner',
                maxItemsPerRegion: 2,
            },
        });
        // the Shield gate realises as a budgeted bed volume somewhere
        const levels = [...grid.allRegions()]
            .map((r) => r.playable_payload?.params?.runnerLevel).filter(Boolean);
        expect(levels.some((l) => (l.hazards ?? []).some((hz) => hz.type === 'bed')))
            .toBe(true);
        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 5, embedSphereLog: false,
            completionConditionItem: 'Victory',
        });
        expect(compareSpheresToPlan(computeItemSpheres(rulesJson), plan)).toEqual([]);
    }, 240000);

    it('a count gate on an ability item realises as an authored lock (gate_rules)', () => {
        // gateableItems admits 'Double Jump', but count 2 is not
        // physics-realisable — splitRequirement routes it to the
        // authored channel: emitted rule Has(Double Jump, 2), payload
        // gate_rules for the bridge, oracle still equals the plan.
        const plan = {
            seed: 1,
            spheres: [
                { sphere: 1, items: ['Double Jump'] },
                { sphere: 2, items: ['Double Jump'] },
                { sphere: 3, items: ['Victory'] },
            ],
        };
        const { grid, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            regionParams: RUNNER_REGION_PARAMS,
            growthParams: {
                spherePlan: plan,
                substrateQuotas: { runner: 99 },
                startSubstrate: 'runner',
            },
        });
        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 1, embedSphereLog: false,
            completionConditionItem: 'Victory',
        });
        expect(compareSpheresToPlan(computeItemSpheres(rulesJson), plan)).toEqual([]);

        // a Has(Double Jump, 2) gate exists in the emitted rules
        const countGates = [];
        const walk = (rule) => {
            if (!rule || typeof rule !== 'object') return;
            if (rule.rule === 'Has' && (rule.args?.count ?? 1) > 1) countGates.push(rule.args);
            for (const c of rule.children ?? []) walk(c);
        };
        for (const region of Object.values(rulesJson.regions['1'])) {
            for (const ex of region.exits) walk(ex.access_rule);
        }
        expect(countGates.length).toBeGreaterThan(0);
        for (const g of countGates) {
            expect(g.item_name).toBe('Double Jump');
            expect(g.count).toBe(2);
        }
        // ...and the authored lock rides a runner payload for the bridge
        const gateRules = [...grid.allRegions()]
            .map((r) => r.playable_payload?.gate_rules)
            .filter(Boolean);
        expect(gateRules.length).toBeGreaterThan(0);
        expect(JSON.stringify(gateRules)).toContain('"count":2');
    }, 240000);

    it('mixed maze+runner world realises the plan exactly (keys gate maze hosts)', () => {
        const pool = {
            'Double Jump': 1, 'Blue Platforms': 1,
            key_red: 1, victory: 1,
        };
        const plan = planSpheres({
            itemPool: pool,
            sphereCount: 3,
            victoryItem: 'victory',
            gateableItems: GATEABLE_ITEMS,
            seed: 3,
        });
        const { grid, stats, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 3,
            regionParams: RUNNER_REGION_PARAMS,
            growthParams: {
                spherePlan: plan,
                substrateQuotas: { maze: 99, runner: 2 },
                startSubstrate: 'runner',
                fillerCount: 1,
            },
        });
        expect(stats.substrateCounts.runner).toBeGreaterThan(0);
        expect(stats.substrateCounts.maze).toBeGreaterThan(0);

        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 3, embedSphereLog: false,
        });
        expect(compareSpheresToPlan(computeItemSpheres(rulesJson), plan)).toEqual([]);
    }, 240000);

    it('sweep-saturating profiles abort growth loudly with the runner hint', () => {
        expect(SWEEP_SATURATING_PROFILES).toContain('sonic');
        const plan = makeRunnerPlan(1, 3);
        expect(() => growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            regionParams: { ...RUNNER_REGION_PARAMS, runnerPhysicsProfile: 'sonic' },
            growthParams: {
                spherePlan: plan,
                substrateQuotas: { runner: 99 },
                startSubstrate: 'runner',
            },
        })).toThrow(/no physics gates/);
    }, 60000);
});
