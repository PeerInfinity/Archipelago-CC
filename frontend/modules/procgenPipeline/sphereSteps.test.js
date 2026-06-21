import { describe, it, expect } from 'vitest';

// Side-effect: register substrates the steps dispatch through.
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import {
    growSpheres, buildRulesJson,
} from './procgenPipelineEngine.js';
import { planSpheres } from './spherePlanner.js';
import { DEFAULT_ITEMS } from '../shared/procgen/library.js';
import {
    SPHERE_STEPS, runStep, runToStep,
    serializeEnvelope, deserializeEnvelope, newEnvelope,
} from './sphereSteps.js';

function makeConfig(overrides = {}) {
    return {
        seed: 1,
        regionSize: { width: 8, height: 6 },
        itemLib: DEFAULT_ITEMS,
        regionParams: { physicsProfile: 'dj' },
        hazardOpts: undefined,
        maxItemsPerRegion: 2,
        fillerCount: 0,
        revisitRatio: 0.25,
        substrateQuotas: { maze: 6 },
        startSubstrate: 'maze',
        sphereCount: 3,
        victoryItem: 'victory',
        exclusiveSpheres: {},
        startingItems: [],
        lockedCanonicalItems: [],
        enableLoopMode: false,
        regionXpEffect: 'cost',
        itemPool: { key_red: 1, key_blue: 1, key_green: 1, victory: 1 },
        ...overrides,
    };
}

// The monolithic reference: planSpheres + growSpheres (builds its own tree
// internally, on a fresh seeded rng) + buildRulesJson, with the same config.
function monolithic(config) {
    const plan = planSpheres({
        itemPool: config.itemPool,
        sphereCount: config.sphereCount,
        exclusiveSpheres: config.exclusiveSpheres ?? {},
        ...(config.victoryItem && (config.itemPool[config.victoryItem] ?? 0) > 0
            ? { victoryItem: config.victoryItem } : {}),
        seed: config.seed,
    });
    const { grid, stats, startCell } = growSpheres({
        regionSize: config.regionSize,
        itemLib: config.itemLib,
        seed: config.seed,
        hazardOpts: config.hazardOpts,
        regionParams: config.regionParams ?? {},
        growthParams: {
            spherePlan: plan,
            maxItemsPerRegion: config.maxItemsPerRegion,
            fillerCount: config.fillerCount,
            revisitRatio: config.revisitRatio,
            ...(config.substrateQuotas ? { substrateQuotas: config.substrateQuotas } : {}),
            ...(config.startSubstrate ? { startSubstrate: config.startSubstrate } : {}),
        },
    });
    return buildRulesJson(grid, {
        startCell, seed: config.seed, itemLib: config.itemLib,
        startingItems: [], lockedCanonicalItems: [],
        enableLoopMode: config.enableLoopMode,
        regionXpEffect: config.regionXpEffect,
        completionConditionItem: config.victoryItem,
        procgenMetadata: {
            driver: 'sphere-growth', stop_reason: stats.stopReason, sphere_plan: plan,
        },
    });
}

describe('sphereSteps runner', () => {
    it('SPHERE_STEPS lists the six steps in order', () => {
        expect(SPHERE_STEPS).toEqual(
            ['plan', 'allocate', 'topology', 'items', 'regions', 'compile']);
    });

    it('in-process full run reproduces the monolithic rules.json', async () => {
        const config = makeConfig();
        const env = await runToStep(newEnvelope(config));
        expect(env.compile.oracleErrors).toEqual([]);
        expect(env.compile.rulesJson).toEqual(monolithic(config));
    });

    it('a JSON round-trip between EVERY step is byte-identical to in-process', async () => {
        const config = makeConfig();

        // Step-by-step, serialising to JSON and back between each step —
        // the cross-process path the CLI takes.
        let env = newEnvelope(config);
        for (const step of SPHERE_STEPS) {
            // eslint-disable-next-line no-await-in-loop
            await runStep(step, env);
            // round-trip the envelope through real JSON
            env = deserializeEnvelope(JSON.parse(JSON.stringify(serializeEnvelope(env))));
        }
        expect(env.compile.oracleErrors).toEqual([]);
        expect(env.compile.rulesJson).toEqual(monolithic(config));
    });

    it('bounce config: stepped == monolithic', async () => {
        const config = makeConfig({
            substrateQuotas: { bounce: 6 }, startSubstrate: 'bounce',
            sphereCount: 2, maxItemsPerRegion: 4,
        });
        const env = await runToStep(newEnvelope(config));
        expect(env.compile.oracleErrors).toEqual([]);
        expect(env.compile.rulesJson).toEqual(monolithic(config));
    });

    it('serializeEnvelope output is pure JSON at each stage', async () => {
        const config = makeConfig();
        let env = newEnvelope(config);
        for (const step of SPHERE_STEPS) {
            // eslint-disable-next-line no-await-in-loop
            await runStep(step, env);
            const s = serializeEnvelope(env);
            expect(() => JSON.parse(JSON.stringify(s))).not.toThrow();
            // nodes' usedSides must serialise as arrays, not Sets
            if (s.nodes) {
                for (const nd of s.nodes) expect(Array.isArray(nd.usedSides)).toBe(true);
            }
        }
    });

    it('runToStep can stop partway and resume', async () => {
        const config = makeConfig();
        const env = await runToStep(newEnvelope(config), 'topology');
        expect(env.completed).toBe(2);
        expect(env.grow).toBeNull();
        await runToStep(env, 'compile');
        expect(env.completed).toBe(5);
        expect(env.compile.rulesJson).toEqual(monolithic(config));
    });
});
