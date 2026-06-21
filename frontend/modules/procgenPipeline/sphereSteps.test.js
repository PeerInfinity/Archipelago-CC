import { describe, it, expect } from 'vitest';

// Side-effect: register substrates the steps dispatch through.
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import {
    growSpheres, growSpheresBatchedGen, buildRulesJson, compactSphereTree,
} from './procgenPipelineEngine.js';
import { planSpheres } from './spherePlanner.js';
import { DEFAULT_ITEMS } from '../shared/procgen/library.js';
import {
    SPHERE_STEPS, runStep, runToStep, nextSphereStep,
    serializeEnvelope, deserializeEnvelope, newEnvelope,
    detectCompleted, resumeEnvelope, resolveSpheresPerBatch,
    appendSphere, truncateSphereWorld,
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
    const { grid, stats, startCell, tree } = growSpheres({
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
            sphere_tree: compactSphereTree(tree),
        },
    });
}

// The standalone batched (sphere-major) reference: same as monolithic but the
// region build interleaves topology + realisation a `spheresPerBatch` batch at
// a time (growSpheresBatchedGen). The step runner unifies on the SAME per-batch
// realiser, so for a given batch size their rules.json must match exactly —
// that's the unify invariant 2.7b enforces.
function monolithicBatched(config, spheresPerBatch) {
    const plan = planSpheres({
        itemPool: config.itemPool,
        sphereCount: config.sphereCount,
        exclusiveSpheres: config.exclusiveSpheres ?? {},
        ...(config.victoryItem && (config.itemPool[config.victoryItem] ?? 0) > 0
            ? { victoryItem: config.victoryItem } : {}),
        seed: config.seed,
    });
    const gen = growSpheresBatchedGen({
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
            spheresPerBatch,
            ...(config.substrateQuotas ? { substrateQuotas: config.substrateQuotas } : {}),
            ...(config.startSubstrate ? { startSubstrate: config.startSubstrate } : {}),
        },
    });
    let r = gen.next();
    while (!r.done) r = gen.next();
    const { grid, stats, startCell, tree } = r.value;
    return buildRulesJson(grid, {
        startCell, seed: config.seed, itemLib: config.itemLib,
        startingItems: [], lockedCanonicalItems: [],
        enableLoopMode: config.enableLoopMode,
        regionXpEffect: config.regionXpEffect,
        completionConditionItem: config.victoryItem,
        procgenMetadata: {
            driver: 'sphere-growth', stop_reason: stats.stopReason, sphere_plan: plan,
            sphere_tree: compactSphereTree(tree),
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

    // Phase 1: the spheresPerBatch knob is threaded + normalised but not yet
    // consumed by a batch loop. The "all spheres" cases must stay the
    // byte-identical default; the batch loop (Phase 2) builds on this seam.
    describe('resolveSpheresPerBatch', () => {
        it('normalises the "all spheres" sentinels to the total', () => {
            for (const v of [null, undefined, 0, -1, 3, 4, 99, 'x', NaN, 2.5]) {
                expect(resolveSpheresPerBatch(v, 3)).toBe(3);
            }
        });
        it('passes through an in-range positive integer', () => {
            expect(resolveSpheresPerBatch(1, 3)).toBe(1);
            expect(resolveSpheresPerBatch(2, 3)).toBe(2);
        });
    });

    it('batched run (spheresPerBatch < total) runs end-to-end and the oracle holds', async () => {
        // sphereCount 4, batch 1 → the regions step takes the batched,
        // sphere-major driver; the compiled world must still realise the plan.
        const config = makeConfig({ sphereCount: 4, spheresPerBatch: 1 });
        const env = await runToStep(newEnvelope(config));
        expect(env.completed).toBe(5);
        expect(env.compile.oracleErrors).toEqual([]);
        // The batched tree is surfaced on the envelope (final cells/region_ids).
        expect(env.grow.stats.stopReason).toBe('plan_complete');
        expect(env.grow.stats.regionsBuilt).toBeGreaterThanOrEqual(4);
    });

    it('embeds a compact sphere_tree (no grid) sufficient to resume wiring', async () => {
        const config = makeConfig();
        const env = await runToStep(newEnvelope(config));
        const meta = env.compile.rulesJson.procgen_metadata;
        const tree = meta.sphere_tree;
        expect(tree).toBeTruthy();
        expect(tree.nodes.length).toBe(env.nodes.length);
        expect(typeof tree.quotaFallbacks).toBe('number');
        expect(tree.substrateCounts).toBeTruthy();
        for (const n of tree.nodes) {
            // Topology fields the resumable wiring context needs…
            expect(typeof n.index).toBe('number');
            expect(typeof n.wave).toBe('number');
            expect(Array.isArray(n.usedSides)).toBe(true); // Set serialised as array
            expect(Array.isArray(n.childGates)).toBe(true);
            expect('parent' in n).toBe(true);
            expect(typeof n.substrate).toBe('string');
            // …the node↔region link (region_id = regionIdForCell(cell))…
            expect(n.cell).toMatchObject({ gx: expect.any(Number), gy: expect.any(Number) });
            expect(typeof n.isTeleporter).toBe('boolean');
            // …but NOT the bulky region payload (rebuilt from rules.json regions).
            expect('region_id' in n).toBe(false);
            expect('items' in n).toBe(false);
            expect('playable_payload' in n).toBe(false);
        }
    });

    it('batched step runner == growSpheresBatchedGen (unify invariant)', async () => {
        // The crux of 2.7b: the step runner and the standalone batched driver
        // share ONE per-batch realiser, so for a given batch size they must
        // produce the same rules.json byte-for-byte (not just the same oracle).
        const pool = {
            key_red: 1, key_blue: 1, key_green: 1, key_yellow: 1,
            key_purple: 1, victory: 1,
        };
        for (const [sphereCount, spheresPerBatch] of [[4, 1], [4, 2], [5, 1], [5, 2]]) {
            const config = makeConfig({
                sphereCount, spheresPerBatch, itemPool: pool, substrateQuotas: { maze: 12 },
            });
            // eslint-disable-next-line no-await-in-loop
            const env = await runToStep(newEnvelope(config));
            expect(env.completed).toBe(5);
            expect(env.compile.oracleErrors).toEqual([]);
            expect(env.compile.rulesJson).toEqual(monolithicBatched(config, spheresPerBatch));
        }
    });

    // 2.10 — per-sphere edit interactions. Editing a step's output in batch < all
    // mode keeps the (now complete) accumulated node set and re-runs forward; the
    // loop must NOT re-wire waves that already exist (the double-wire bug). This
    // mirrors the panel's _invalidateFrom(2)/(3): roll completed back, drop the
    // downstream outputs, reset the batch cursor + grid, keep the edited nodes.
    function invalidateFrom(env, stepIdx) {
        env.completed = stepIdx;
        if (stepIdx < 3) env.tree = null;
        if (stepIdx < 4) { env.grow = null; env.placed = null; env.batchStart = 0; }
        if (stepIdx < 5) env.compile = null;
        return env;
    }

    it('editing topology (batch < all) re-runs forward without double-wiring', async () => {
        const config = makeConfig({ sphereCount: 4, spheresPerBatch: 1 });
        const env = await runToStep(newEnvelope(config));
        expect(env.compile.oracleErrors).toEqual([]);
        const nodeCount = env.nodes.length;

        // Simulate a ②b edit: keep the full (edited) node set, invalidate from
        // topology, re-run. A naive loop would re-enter ②b per batch and append
        // the already-present waves' nodes again.
        invalidateFrom(env, 2);
        await runToStep(env);
        expect(env.completed).toBe(5);
        expect(env.nodes.length).toBe(nodeCount); // no double-wire
        expect(env.compile.oracleErrors).toEqual([]);
    });

    it('editing items (batch < all) re-runs forward and the oracle holds', async () => {
        const config = makeConfig({ sphereCount: 4, spheresPerBatch: 1 });
        const env = await runToStep(newEnvelope(config));
        const nodeCount = env.nodes.length;
        invalidateFrom(env, 3);
        await runToStep(env);
        expect(env.completed).toBe(5);
        expect(env.nodes.length).toBe(nodeCount);
        expect(env.compile.oracleErrors).toEqual([]);
    });

    it('editing a region (batch < all) keeps the grid and recompiles', async () => {
        const config = makeConfig({ sphereCount: 4, spheresPerBatch: 1 });
        const env = await runToStep(newEnvelope(config));
        const grid = env.grow.grid;
        // A ③ edit (invalidate from compile only): the grown grid is KEPT, the
        // cursor stays at total, so re-running goes straight to ④.
        invalidateFrom(env, 4);
        expect(env.grow.grid).toBe(grid); // grid preserved (region edit lives on it)
        await runToStep(env);
        expect(env.completed).toBe(5);
        expect(env.grow.grid).toBe(grid); // ④ didn't rebuild the grid
        expect(env.compile.oracleErrors).toEqual([]);
    });

    it('batched JSON round-trip between EVERY step == in-process batched run', async () => {
        // The cross-process (CLI) path under batch < all: serialise + restore
        // the envelope between every step (incl. the per-batch loop-backs), and
        // the final rules.json must still match the batched driver.
        const config = makeConfig({ sphereCount: 4, spheresPerBatch: 1 });
        let env = newEnvelope(config);
        // Drive the loop manually so we round-trip after each step, including
        // the ②a/②b/②c/③ repeats per batch.
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const step = nextSphereStep(env);
            if (!step) break;
            // eslint-disable-next-line no-await-in-loop
            await runStep(step, env);
            env = deserializeEnvelope(JSON.parse(JSON.stringify(serializeEnvelope(env))));
        }
        expect(env.completed).toBe(5);
        expect(env.compile.oracleErrors).toEqual([]);
        expect(env.compile.rulesJson).toEqual(monolithicBatched(config, 1));
    });

    it('carrying spheresPerBatch on the config is byte-identical (default = all)', async () => {
        // Phase 1: the field is present on env.config but inert — output must
        // match the monolithic reference whether it's absent, null, or = all.
        for (const spheresPerBatch of [undefined, null, 3]) {
            const config = makeConfig({ sphereCount: 3, spheresPerBatch });
            // eslint-disable-next-line no-await-in-loop
            const env = await runToStep(newEnvelope(config));
            expect(env.compile.oracleErrors).toEqual([]);
            expect(env.compile.rulesJson).toEqual(monolithic(config));
        }
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

    it('detectCompleted derives the resume point from data presence', async () => {
        const config = makeConfig();
        const fresh = newEnvelope(config);
        expect(detectCompleted(fresh)).toBe(-1); // nothing run → resume at plan

        // Run one step at a time, round-tripping through JSON, and confirm
        // detection tracks the highest contiguous completed step.
        let env = newEnvelope(config);
        for (let i = 0; i < SPHERE_STEPS.length; i++) {
            // eslint-disable-next-line no-await-in-loop
            await runStep(SPHERE_STEPS[i], env);
            env = deserializeEnvelope(JSON.parse(JSON.stringify(serializeEnvelope(env))));
            expect(detectCompleted(env)).toBe(i);
        }
    });

    it('a gap stops detection (stale downstream data is ignored)', async () => {
        const config = makeConfig();
        const env = await runToStep(newEnvelope(config), 'compile');
        // Hand-edit: drop the topology output but leave items/regions/compile.
        // The first MISSING output (topology) is the resume point; later data
        // is stale.
        const broken = deserializeEnvelope(JSON.parse(JSON.stringify(serializeEnvelope(env))));
        broken.nodes = null;
        broken.substrateCounts = null;
        expect(detectCompleted(broken)).toBe(1); // allocate done, topology missing
    });

    it('resumeEnvelope picks up from the first missing step', async () => {
        const config = makeConfig();
        // Produce an envelope completed only through `items`, simulating a
        // partial CLI run / hand-edited file (no explicit completed needed).
        const partial = await runToStep(newEnvelope(config), 'items');
        const round = deserializeEnvelope(JSON.parse(JSON.stringify(serializeEnvelope(partial))));
        delete round.completed; // resume must not depend on the field
        await resumeEnvelope(round);
        expect(round.completed).toBe(5);
        expect(round.compile.oracleErrors).toEqual([]);
        expect(round.compile.rulesJson).toEqual(monolithic(config));
    });
});

// Phase 4 — appendSphere / truncateSphereWorld (envelope path). Grows a finished
// world one sphere further (or rewinds + regrows) by reusing the per-sphere
// batch machinery. Diverges from a fresh run by design; the oracle must hold.
describe('appendSphere (envelope path)', () => {
    const lastItems = (env) => env.plan.spheres[env.plan.spheres.length - 1].items;

    it('reverts a goal-only final sphere and appends new content + goal', async () => {
        // Default 3-sphere world → final sphere is [victory] only.
        const env = await runToStep(newEnvelope(makeConfig()));
        expect(lastItems(env)).toEqual(['victory']);
        const depth = env.plan.spheres.length;

        await appendSphere(env, { items: ['key_red'] }); // any pooled item works as content
        expect(env.completed).toBe(5);
        expect(env.compile.oracleErrors).toEqual([]);
        // The goal-only sphere was reverted, replaced by [content, victory].
        expect(env.plan.spheres.length).toBe(depth); // reverted → same depth
        expect(lastItems(env)).toContain('victory');
        expect(lastItems(env).length).toBeGreaterThan(1);
    });

    it('relocates the goal out of a multi-item final sphere (depth + 1)', async () => {
        const env = await runToStep(newEnvelope(makeConfig({
            exclusiveSpheres: { 3: ['key_green', 'victory'] },
        })));
        expect(lastItems(env)).toEqual(expect.arrayContaining(['key_green', 'victory']));
        const depth = env.plan.spheres.length;

        await appendSphere(env, { items: ['key_blue'] });
        expect(env.compile.oracleErrors).toEqual([]);
        expect(env.plan.spheres.length).toBe(depth + 1); // genuine new tier
        // The old final keeps its non-goal item; the goal moved to the new final.
        expect(env.plan.spheres[depth - 1].items).toEqual(['key_green']);
        expect(lastItems(env)).toEqual(['key_blue', 'victory']);
    });

    it('truncateToWave rewinds to an earlier sphere, then regrows', async () => {
        const env = await runToStep(newEnvelope(makeConfig({
            sphereCount: 4, itemPool: { a: 1, b: 1, c: 1, victory: 1 },
        })));
        const before = env.plan.spheres.length; // 4
        await appendSphere(env, { items: ['d'], truncateToWave: 2 });
        expect(env.compile.oracleErrors).toEqual([]);
        // Kept 2 waves + the appended one → 3 spheres; goal in the new final.
        expect(env.plan.spheres.length).toBe(3);
        expect(before).toBe(4);
        expect(lastItems(env)).toEqual(['d', 'victory']);
    });

    it('expands the grid on demand when the appended wave overflows', async () => {
        const env = await runToStep(newEnvelope(makeConfig({
            sphereCount: 4, maxItemsPerRegion: 1, revisitRatio: 0,
            exclusiveSpheres: { 4: ['kx', 'victory'] },
            itemPool: { a: 1, b: 1, c: 1, d: 1, kx: 1, victory: 1 },
        })));
        const dims0 = { w: env.grow.grid.width, h: env.grow.grid.height };
        await appendSphere(env, { items: ['n1', 'n2', 'n3', 'n4'] }); // several new regions
        expect(env.compile.oracleErrors).toEqual([]);
        // Grid grew (grow-only resize) to fit the new regions.
        expect(env.grow.grid.width).toBeGreaterThanOrEqual(dims0.w);
        expect(env.grow.grid.height).toBeGreaterThanOrEqual(dims0.h);
        expect(env.grow.grid.width * env.grow.grid.height)
            .toBeGreaterThan(dims0.w * dims0.h);
    });

    it('chains: a second append onto an appended world grows depth', async () => {
        const env = await runToStep(newEnvelope(makeConfig()));
        await appendSphere(env, { items: ['key_red'] });
        const d1 = env.plan.spheres.length;
        await appendSphere(env, { items: ['key_blue'] });
        expect(env.compile.oracleErrors).toEqual([]);
        expect(env.plan.spheres.length).toBe(d1 + 1); // prior final now multi-item → relocate
        expect(lastItems(env)).toEqual(['key_blue', 'victory']);
    });

    it('bounce (zone substrate) appends with the oracle clean', async () => {
        // Bounce gates must respect its one-arrowless-portal-per-level rule, so
        // use boost/arrow items as the gating vocabulary (as a real bounce world
        // would). The appended wave gates on the kept final's Springs.
        const env = await runToStep(newEnvelope(makeConfig({
            substrateQuotas: { bounce: 99 }, startSubstrate: 'bounce',
            sphereCount: 2, maxItemsPerRegion: 4,
            victoryItem: 'Victory',
            exclusiveSpheres: { 2: ['Springs', 'Victory'] },
            itemPool: { 'Right arrow': 1, Springs: 1, Jetpacks: 1, Victory: 1 },
        })));
        await appendSphere(env, { items: ['Jetpacks'] });
        expect(env.compile.oracleErrors).toEqual([]);
        expect(lastItems(env)).toContain('Victory');
    });

    it('throws when the source has no completion item', async () => {
        const env = await runToStep(newEnvelope(makeConfig()));
        env.config = { ...env.config, victoryItem: null };
        await expect(appendSphere(env, { items: ['key_red'] }))
            .rejects.toThrow(/no victory\/completion item/);
    });

    it('truncateSphereWorld drops the later-wave node suffix + their regions', async () => {
        const env = await runToStep(newEnvelope(makeConfig({ sphereCount: 4,
            itemPool: { a: 1, b: 1, c: 1, victory: 1 } })));
        const before = env.nodes.length;
        const keptRegions = env.nodes.filter((n) => n.wave < 2).length;
        truncateSphereWorld(env, 2);
        expect(env.nodes.length).toBe(keptRegions);
        expect(env.nodes.length).toBeLessThan(before);
        // Every surviving node is within the kept waves and its region remains.
        for (const n of env.nodes) {
            expect(n.wave).toBeLessThan(2);
            if (n.cell) expect(env.grow.grid.hasRegion(n.cell)).toBe(true);
        }
    });
});
