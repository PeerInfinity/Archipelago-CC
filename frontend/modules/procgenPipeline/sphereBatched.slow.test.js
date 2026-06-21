/**
 * Batched (sphere-major) sphere growth — growSpheresBatchedGen (Phase 2.3).
 *
 * Two contracts:
 *   1. batch = all (null / ≥ wave count) delegates to growSpheresGen, so the
 *      emitted rules.json is BYTE-IDENTICAL to the step-major path.
 *   2. batch < all interleaves topology + realisation per batch and re-realises
 *      hosts that gain late children; the output diverges (expected) but must
 *      still realise the plan EXACTLY (the sphere oracle) and be connected.
 */
import { describe, it, expect } from 'vitest';

// Side-effect: registers the maze + bounce substrates.
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import {
    growSpheres, growSpheresBatchedGen, buildRulesJson,
} from './procgenPipelineEngine.js';
import {
    planSpheres, computeItemSpheres, compareSpheresToPlan,
} from './spherePlanner.js';

const POOL = {
    key_red: 1, key_green: 1, key_blue: 1, key_yellow: 1,
    key_purple: 1, key_orange: 1, key_white: 1, victory: 1,
};
const makePlan = (seed = 1, sphereCount = 4) => planSpheres({
    itemPool: POOL, sphereCount, victoryItem: 'victory', seed,
});

// Drain the batched generator synchronously (yields never touch the rng).
function growBatched(config) {
    const gen = growSpheresBatchedGen(config);
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
}

const rules = (grid, startCell, seed, extra = {}) => buildRulesJson(grid, {
    startCell, seed, embedSphereLog: false, ...extra,
});

describe('growSpheresBatchedGen', () => {
    describe('batch = all is byte-identical to the step-major path', () => {
        it.each([[1, 3], [2, 4], [3, 5]])('seed %i, %i spheres', (seed, sphereCount) => {
            const plan = makePlan(seed, sphereCount);
            const base = { regionSize: { width: 8, height: 6 }, seed };
            const mono = growSpheres({ ...base, growthParams: { spherePlan: plan } });
            for (const spheresPerBatch of [null, sphereCount, sphereCount + 5]) {
                const batched = growBatched({
                    ...base, growthParams: { spherePlan: plan, spheresPerBatch },
                });
                expect(rules(batched.grid, batched.startCell, seed))
                    .toEqual(rules(mono.grid, mono.startCell, seed));
            }
        });
    });

    describe('batch < all realises the plan exactly (maze)', () => {
        it.each([
            [1, 4, 1], [2, 4, 1], [3, 5, 1],
            [2, 4, 2], [4, 6, 2], [5, 5, 3],
        ])('seed %i, %i spheres, batch %i', (seed, sphereCount, spheresPerBatch) => {
            const plan = makePlan(seed, sphereCount);
            const { grid, stats, startCell } = growBatched({
                regionSize: { width: 8, height: 6 },
                seed,
                growthParams: { spherePlan: plan, spheresPerBatch },
            });
            expect(stats.stopReason).toBe('plan_complete');
            expect(stats.regionsBuilt).toBeGreaterThanOrEqual(sphereCount);
            const computed = computeItemSpheres(rules(grid, startCell, seed));
            expect(compareSpheresToPlan(computed, plan)).toEqual([]);
        });
    });

    it('batch < all with fillers + revisit still realises the plan (maze)', () => {
        const plan = makePlan(3, 5);
        const { grid, startCell, stats } = growBatched({
            regionSize: { width: 8, height: 6 },
            seed: 3,
            growthParams: {
                spherePlan: plan, spheresPerBatch: 1,
                fillerCount: 3, revisitRatio: 0.5,
            },
        });
        expect(stats.stopReason).toBe('plan_complete');
        expect(compareSpheresToPlan(computeItemSpheres(rules(grid, startCell, 3)), plan))
            .toEqual([]);
    });

    it('batch < all realises the plan with the bounce substrate', () => {
        const plan = planSpheres({
            itemPool: {
                'Right arrow': 1, Springs: 1, Jetpacks: 1,
                'Blue platforms': 1, Victory: 1,
            },
            sphereCount: 4, victoryItem: 'Victory', seed: 1,
        });
        const { grid, startCell, stats } = growBatched({
            regionSize: { width: 8, height: 6 },
            seed: 1,
            growthParams: {
                spherePlan: plan, spheresPerBatch: 1,
                substrateQuotas: { bounce: 99 }, startSubstrate: 'bounce',
            },
        });
        expect(stats.stopReason).toBe('plan_complete');
        const computed = computeItemSpheres(rules(grid, startCell, 1, {
            completionConditionItem: 'Victory',
        }));
        expect(compareSpheresToPlan(computed, plan)).toEqual([]);
    });
});
