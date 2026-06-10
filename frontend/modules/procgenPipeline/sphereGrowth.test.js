/**
 * Sphere-driven growth driver (build-order steps 3+4): buildSphereTree
 * structure, growSpheres realisation, and THE ORACLE — the computed
 * sphere log of the emitted rules.json must equal the input plan
 * exactly (multisets per sphere).
 */
import { describe, it, expect } from 'vitest';

import { createRng } from '../shared/rng.js';
// Side-effect: registers the maze and bounce substrates.
import '../mazeRoom/mazeRoomLibrary.js';
import { GATEABLE_ITEMS } from '../bounceDemo/bounceDemoLibrary.js';
import { validateLevel } from '../bounceDemo/level.js';
import {
    buildSphereTree, growSpheres, buildRulesJson,
} from './procgenPipelineEngine.js';
import {
    planSpheres, computeItemSpheres, compareSpheresToPlan,
} from './spherePlanner.js';

// Maze worlds speak itemLib ids (key_red etc. from DEFAULT_ITEMS);
// rules.json item names are those ids verbatim.
const POOL = { key_red: 1, key_green: 1, key_blue: 1, key_yellow: 1, victory: 1 };

const makePlan = (seed = 1, sphereCount = 3) => planSpheres({
    itemPool: POOL,
    sphereCount,
    victoryItem: 'victory',
    seed,
});

describe('buildSphereTree', () => {
    const tree = buildSphereTree(makePlan(), {
        maxItemsPerRegion: 2, fillerCount: 2, revisitRatio: 0.3,
    }, createRng(1));

    it('builds parents before children with valid sides', () => {
        for (const node of tree.nodes) {
            if (node.parent == null) {
                expect(node.wave).toBe(0);
                expect(node.side).toBeNull();
            } else {
                expect(node.parent).toBeLessThan(node.index);
                expect(['N', 'S', 'E', 'W']).toContain(node.side);
            }
            expect(node.usedSides.size).toBeLessThanOrEqual(4);
        }
    });

    it('enforces the stratification rule on entry gates', () => {
        const plan = makePlan();
        for (const node of tree.nodes) {
            if (node.wave === 0) {
                expect(node.gate).toEqual([]);
            } else {
                // gate = exactly one item from sphere `wave`
                expect(node.gate).toHaveLength(1);
                expect(plan.spheres[node.wave - 1].items).toContain(node.gate[0]);
            }
        }
    });

    it('hosts each wave\'s items on that wave\'s regions, fillers empty', () => {
        const plan = makePlan();
        for (let w = 0; w < plan.spheres.length; w++) {
            const hosted = tree.nodes.filter((n) => n.wave === w)
                .flatMap((n) => n.items.map((it) => it.item)).sort();
            expect(hosted).toEqual([...plan.spheres[w].items].sort());
        }
        expect(tree.nodes.filter((n) => n.isFiller)
            .every((n) => n.items.length === 0)).toBe(true);
        expect(tree.nodes.filter((n) => n.isFiller)).toHaveLength(2);
    });

    it('never exceeds maxItemsPerRegion', () => {
        for (const node of tree.nodes) {
            expect(node.items.length).toBeLessThanOrEqual(2);
        }
    });
});

describe('growSpheres (maze) — the sphere oracle', () => {
    // The core promise: for a spread of seeds/shapes, the emitted
    // rules.json computes back to EXACTLY the planned spheres.
    it.each([
        [1, 3, 0, 0],
        [2, 3, 2, 0.5],
        [3, 4, 1, 0.25],
        [4, 5, 3, 0.4],
    ])('seed %i, %i spheres, %i fillers, revisit %f: computed spheres == plan',
        (seed, sphereCount, fillerCount, revisitRatio) => {
            const plan = makePlan(seed, sphereCount);
            const { grid, stats, startCell } = growSpheres({
                regionSize: { width: 8, height: 6 },
                seed,
                growthParams: {
                    spherePlan: plan, maxItemsPerRegion: 2, fillerCount, revisitRatio,
                },
            });
            expect(stats.stopReason).toBe('plan_complete');

            const rulesJson = buildRulesJson(grid, {
                startCell, seed, embedSphereLog: false,
            });
            const computed = computeItemSpheres(rulesJson);
            expect(compareSpheresToPlan(computed, plan)).toEqual([]);
        });

    it('places every region and wires every gate to a built child', () => {
        const plan = makePlan(1, 3);
        const { grid, stats, tree } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            growthParams: { spherePlan: plan, fillerCount: 2 },
        });
        expect(stats.regionsBuilt).toBe(tree.nodes.length);
        // every non-back exit has a resolved target
        for (const region of grid.allRegions()) {
            for (const exit of region.extracted_rules.exits) {
                expect(exit.target_region).toBeTruthy();
            }
        }
    });

    it('is deterministic for a given seed', () => {
        const run = () => {
            const { grid, startCell } = growSpheres({
                regionSize: { width: 8, height: 6 },
                seed: 9,
                growthParams: { spherePlan: makePlan(9, 3), fillerCount: 1 },
            });
            return buildRulesJson(grid, { startCell, seed: 9, embedSphereLog: false });
        };
        expect(JSON.parse(JSON.stringify(run())))
            .toEqual(JSON.parse(JSON.stringify(run())));
    });

    it('rejects a missing or invalid plan', () => {
        expect(() => growSpheres({
            regionSize: { width: 8, height: 6 },
            growthParams: {},
        })).toThrow(/spherePlan required/);
        expect(() => growSpheres({
            regionSize: { width: 8, height: 6 },
            growthParams: { spherePlan: { spheres: [] } },
        })).toThrow(/invalid sphere plan/);
    });

    it('rejects unregistered substrates in the quotas upfront', () => {
        expect(() => growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            growthParams: {
                spherePlan: makePlan(1, 2),
                substrateQuotas: { no_such_substrate: 99 },
            },
        })).toThrow(/'no_such_substrate' is not registered/);
    });
});

// ── Step 5: bounce in the driver ─────────────────────────────────────

const BOUNCE_POOL = {
    'Right arrow': 1, 'Left arrow': 1, 'Springs': 1, 'Jetpacks': 1,
    'Blue platforms': 1, 'Brown platforms': 1, Victory: 1,
};

const makeBouncePlan = (seed, sphereCount) => planSpheres({
    itemPool: BOUNCE_POOL,
    sphereCount,
    pins: { 'Right arrow': 1, 'Left arrow': 1 },
    victoryItem: 'Victory',
    gateableItems: GATEABLE_ITEMS,
    seed,
});

describe('growSpheres (bounce) — zone realisation + oracle', () => {
    it.each([
        [1, 3],
        [2, 4],
        [3, 4],
    ])('bounce-only world, seed %i, %i spheres: computed spheres == plan',
        (seed, sphereCount) => {
            const plan = makeBouncePlan(seed, sphereCount);
            const { grid, stats, startCell } = growSpheres({
                regionSize: { width: 8, height: 6 },
                seed,
                growthParams: {
                    spherePlan: plan,
                    substrateQuotas: { bounce: 99 },
                    startSubstrate: 'bounce',
                    maxItemsPerRegion: 2,
                },
            });
            expect(stats.substrateCounts.bounce).toBe(stats.regionsBuilt);

            // every bounce level in the payloads validates and leaf
            // regions carry a return portal on the entrance side
            for (const region of grid.allRegions()) {
                const level = region.playable_payload?.params?.bounceLevel;
                expect(level).toBeTruthy();
                expect(validateLevel(level)).toEqual([]);
            }

            const rulesJson = buildRulesJson(grid, {
                startCell, seed, embedSphereLog: false,
                completionConditionItem: 'Victory',
            });
            const computed = computeItemSpheres(rulesJson);
            expect(compareSpheresToPlan(computed, plan)).toEqual([]);
        }, 120000);

    it('mixed maze+bounce world realises the plan exactly', () => {
        const pool = {
            'Right arrow': 1, 'Left arrow': 1, 'Springs': 1,
            key_red: 1, key_blue: 1, victory: 1,
        };
        const plan = planSpheres({
            itemPool: pool,
            sphereCount: 3,
            pins: { 'Right arrow': 1, 'Left arrow': 1 },
            victoryItem: 'victory',
            seed: 4,
        });
        const { grid, stats, startCell } = growSpheres({
            regionSize: { width: 8, height: 6 },
            seed: 4,
            growthParams: {
                spherePlan: plan,
                // exactly one maze region (the start), bounce for the rest
                substrateQuotas: { maze: 1, bounce: 99 },
                startSubstrate: 'maze',
                fillerCount: 1,
            },
        });
        expect(stats.substrateCounts.maze).toBe(1);
        expect(stats.substrateCounts.bounce).toBeGreaterThan(0);

        const rulesJson = buildRulesJson(grid, {
            startCell, seed: 4, embedSphereLog: false,
        });
        const computed = computeItemSpheres(rulesJson);
        expect(compareSpheresToPlan(computed, plan)).toEqual([]);
    }, 120000);
});
