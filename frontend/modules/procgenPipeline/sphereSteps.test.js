import { describe, it, expect } from 'vitest';

// Side-effect: register substrates the steps dispatch through.
import '../mazeRoom/mazeRoomLibrary.js';
import '../bounceDemo/bounceDemoLibrary.js';
import {
    growSpheres, growSpheresBatchedGen, buildRulesJson, compactSphereTree,
    rebuildEnvelopeFromRulesJson, growMaze, topDownFromRulesJson, getRegionExits,
} from './procgenPipelineEngine.js';
import { planSpheres } from './spherePlanner.js';
import { DEFAULT_ITEMS } from '../shared/procgen/library.js';
import { createHash } from 'node:crypto';
import {
    SPHERE_STEPS, runStep, runToStep, nextSphereStep,
    serializeEnvelope, deserializeEnvelope, newEnvelope,
    detectCompleted, resumeEnvelope, resolveSpheresPerBatch,
    appendSphere, truncateSphereWorld, importSphereEnvelope,
    SPHERE_EDIT_BINDING, invalidateSphereFrom, sphereUndoStep, sphereNodeKey,
} from './sphereSteps.js';
import { pushLayoutEdit, popLayoutEdit } from './layoutEdits.js';

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

    it('rebuilds an envelope from a bare rules.json and recompiles cleanly (maze)', async () => {
        const src = await runToStep(newEnvelope(makeConfig()));
        const rulesJson = src.compile.rulesJson;
        // Reconstruct purely from the compiled rules.json (no saved envelope).
        const env = rebuildEnvelopeFromRulesJson(rulesJson);
        expect(env.completed).toBe(5);
        expect(env.config.victoryItem).toBe('victory');
        expect(env.nodes.length).toBe(src.nodes.length);
        expect(env.config.regionSize).toEqual(makeConfig().regionSize);
        // Recompiling the reconstructed grid preserves the plan (geometry kept
        // via deserializeWorld + extractPathsAndObstacles).
        await runStep('compile', env);
        expect(env.compile.oracleErrors).toEqual([]);
    });

    it('appends a sphere from a bare rules.json (maze)', async () => {
        const src = await runToStep(newEnvelope(makeConfig()));
        const env = rebuildEnvelopeFromRulesJson(src.compile.rulesJson);
        await appendSphere(env, { items: ['key_red'] });
        expect(env.compile.oracleErrors).toEqual([]);
        expect(env.plan.spheres[env.plan.spheres.length - 1].items).toContain('victory');
    });

    // The panel's "Load envelope / rules.json" seam (§2.3): one entry point that
    // accepts either a serialized envelope or a finalized rules.json.
    it('importSphereEnvelope reconstructs from a rules.json and tags the source', async () => {
        const src = await runToStep(newEnvelope(makeConfig()));
        const { env, fromRulesJson } = importSphereEnvelope(src.compile.rulesJson);
        expect(fromRulesJson).toBe(true);
        expect(env.config.regionSize).toEqual(makeConfig().regionSize);
        expect(env.nodes.length).toBe(src.nodes.length);
        // Reconstructed env is append-ready.
        await appendSphere(env, { items: ['key_red'] });
        expect(env.compile.oracleErrors).toEqual([]);
    });

    it('importSphereEnvelope deserializes a serialized envelope unchanged', async () => {
        const src = await runToStep(newEnvelope(makeConfig()));
        const { env, fromRulesJson } = importSphereEnvelope(serializeEnvelope(src));
        expect(fromRulesJson).toBe(false);
        expect(env.config.regionSize).toEqual(makeConfig().regionSize);
        expect(detectCompleted(env)).toBe(5);
    });

    it('rebuild throws for a zone substrate (bounce) — needs the saved envelope', async () => {
        const src = await runToStep(newEnvelope(makeConfig({
            substrateQuotas: { bounce: 99 }, startSubstrate: 'bounce',
            sphereCount: 2, maxItemsPerRegion: 4, victoryItem: 'Victory',
            exclusiveSpheres: { 2: ['Springs', 'Victory'] },
            itemPool: { 'Right arrow': 1, Springs: 1, Jetpacks: 1, Victory: 1 },
        })));
        expect(() => rebuildEnvelopeFromRulesJson(src.compile.rulesJson))
            .toThrow(/zone substrate|can't be reconstructed/);
    });

    // §3: a non-procgen world enriched via top-down + a sphere log loads in
    // sphere-growth mode. Driver 'top-down-sphere' keeps SOURCE region names,
    // so rebuild joins sidecars by node.region_id (not regionIdForCell).
    it('importSphereEnvelope loads a top-down-sphere rules.json (region_id join)', () => {
        // A grid-growth world stands in for a real exported world: it has a
        // rules.json + an embedded sphere_log keyed by its own region names.
        const { grid: ggGrid, startCell: ggStart } = growMaze({
            gridDims: { width: 3, height: 3 },
            regionSize: { width: 6, height: 6 },
            itemPool: { key_red: 2 },
            obstaclePool: { door_red: 2 },
            seed: 7,
            growthParams: { branchProbability: 0.5, assumeBidirectional: true },
        });
        const source = buildRulesJson(ggGrid, { startCell: ggStart });
        const sphereLog = source.sphere_log;

        const { grid, startCell, sphereTree, spherePlan } = topDownFromRulesJson(source, {
            gridDims: { width: 6, height: 6 }, seed: 1, sphereLog,
        });
        const rulesJson = buildRulesJson(grid, {
            startCell, sphereLog,
            procgenMetadata: {
                driver: 'top-down-sphere',
                sphere_tree: sphereTree,
                sphere_plan: spherePlan,
            },
        });

        const { env, fromRulesJson } = importSphereEnvelope(rulesJson);
        expect(fromRulesJson).toBe(true);
        expect(env.completed).toBe(5);
        expect(env.nodes.length).toBe(sphereTree.nodes.length);
        // Region names (not cell ids) survived the round-trip.
        expect(env.nodes[0].region_id).toBe(sphereTree.nodes[0].region_id);
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

// --- recorded layout edits (B-d) ---------------------------------------
//
// The envelope gains `edits[]`: the composite-grid layout editor's four
// mutators and the two scalar per-region gestures, RECORDED so that a
// hand-edited world is `config + seed + edits` — replayed by the runner,
// undone by popping, and carried by the codec. The rows below pin the three
// claims that make that true: the replay lands at the right step, it consumes
// no rng, and undo is byte-exact.
describe('sphereSteps — recorded layout edits', () => {
    // A small BOUNCE world: the re-roll and exit-side ops are zone-only (a maze
    // region's exit tile positions feed adjacency stitching, so the engine
    // refuses to re-roll one). One gated arrow keeps every region buildable.
    const bounceConfig = () => makeConfig({
        substrateQuotas: { bounce: 99 },
        startSubstrate: 'bounce',
        regionParams: { fallBehavior: 'current', physicsProfile: 'dj' },
        itemPool: { 'Left arrow': 1, Victory: 1 },
        sphereCount: 2,
        victoryItem: 'Victory',
        exclusiveSpheres: { 1: ['Left arrow'] },
        maxItemsPerRegion: 2,
        fillerCount: 1,
    });

    const gridSha = (grid) => createHash('sha256').update(JSON.stringify(
        grid.allRegions()
            .map((r) => [r.region_id, r.cell.gx, r.cell.gy,
                JSON.stringify(r.extracted_rules), JSON.stringify(r.exits_placed)])
            .sort((a, b) => (a[0] < b[0] ? -1 : 1)),
    )).digest('hex');

    async function grownEnv(config = bounceConfig()) {
        const env = newEnvelope(config);
        await runToStep(env, 'regions');
        return env;
    }

    // An empty cell the layout editor could move a region into.
    function emptyCell(grid) {
        for (let gy = 0; gy < grid.height; gy += 1) {
            for (let gx = 0; gx < grid.width; gx += 1) {
                if (!grid.hasRegion({ gx, gy })) return { gx, gy };
            }
        }
        return null;
    }

    it('an unedited envelope is untouched by the replay (byte-identity)', async () => {
        const config = makeConfig();
        const bare = newEnvelope(config);
        await runToStep(bare, 'compile');
        const withEmpty = newEnvelope(config);
        withEmpty.edits = [];
        await runToStep(withEmpty, 'compile');
        expect(JSON.stringify(withEmpty.compile.rulesJson))
            .toBe(JSON.stringify(bare.compile.rulesJson));
        expect(JSON.stringify(bare.compile.rulesJson)).toBe(JSON.stringify(monolithic(config)));
    });

    it('a recorded move REPLAYS from config + seed + edits alone', async () => {
        const config = bounceConfig();
        const live = await grownEnv(config);
        const mover = live.grow.grid.allRegions()[1];
        const to = emptyCell(live.grow.grid);
        const edit = { op: 'move-region', from: { ...mover.cell }, to };
        expect(pushLayoutEdit(live, edit, SPHERE_EDIT_BINDING).ok).toBe(true);
        await runToStep(live, 'compile');

        // A FRESH envelope carrying only the recording reproduces it exactly.
        const replayed = newEnvelope(config);
        replayed.edits = [edit];
        await runToStep(replayed, 'compile');
        expect(gridSha(replayed.grow.grid)).toBe(gridSha(live.grow.grid));
        expect(JSON.stringify(replayed.compile.rulesJson))
            .toBe(JSON.stringify(live.compile.rulesJson));

        // …and it is genuinely a different world from the unedited one.
        const clean = newEnvelope(config);
        await runToStep(clean, 'compile');
        expect(gridSha(replayed.grow.grid)).not.toBe(gridSha(clean.grow.grid));
    });

    it('the replay consumes NO rng: the post-③ rng snapshot is unmoved', async () => {
        const config = bounceConfig();
        const clean = await grownEnv(config);
        const edited = await grownEnv(config);
        const mover = edited.grow.grid.allRegions()[1];
        pushLayoutEdit(edited, {
            op: 'move-region', from: { ...mover.cell }, to: emptyCell(edited.grow.grid),
        }, SPHERE_EDIT_BINDING);
        expect(edited.rng.s).toBe(clean.rng.s);
        expect(edited.regionsRng.s).toBe(clean.regionsRng.s);

        // Same claim on the REPLAY path (a fresh run that applies the recording).
        const replayed = newEnvelope(config);
        replayed.edits = [...edited.edits];
        await runToStep(replayed, 'regions');
        expect(replayed.rng.s).toBe(clean.rng.s);
    });

    it('N edits → undo ×N → the never-edited grid, byte for byte', async () => {
        const config = bounceConfig();
        const clean = newEnvelope(config);
        await runToStep(clean, 'compile');
        const cleanSha = gridSha(clean.grow.grid);

        const env = await grownEnv(config);
        // Each gesture reads the CURRENT grid, exactly as a second click would.
        const secondId = env.grow.grid.allRegions()[1].region_id;
        const liveCell = (id) => ({
            ...env.grow.grid.allRegions().find((r) => r.region_id === id).cell,
        });
        pushLayoutEdit(env, {
            op: 'move-region', from: liveCell(secondId), to: emptyCell(env.grow.grid),
        }, SPHERE_EDIT_BINDING);
        const thirdId = env.grow.grid.allRegions()
            .find((r) => r.region_id !== secondId
                && r.region_id !== env.grow.grid.getRegion(env.grow.startCell).region_id)
            .region_id;
        pushLayoutEdit(env, {
            op: 'swap-regions', a: liveCell(thirdId), b: liveCell(secondId),
        }, SPHERE_EDIT_BINDING);
        await runToStep(env, 'compile');
        expect(env.edits).toHaveLength(2);
        expect(gridSha(env.grow.grid)).not.toBe(cleanSha);
        expect(JSON.stringify(env.compile.rulesJson))
            .not.toBe(JSON.stringify(clean.compile.rulesJson));

        for (let i = 0; i < 2; i += 1) {
            const popped = popLayoutEdit(env, SPHERE_EDIT_BINDING);
            invalidateSphereFrom(env, sphereUndoStep(popped.edit));
            // eslint-disable-next-line no-await-in-loop
            await resumeEnvelope(env, 'compile');
        }
        expect(env.edits).toHaveLength(0);
        expect(gridSha(env.grow.grid)).toBe(cleanSha);
        // Not just the grid: the whole compiled world comes back.
        expect(JSON.stringify(env.compile.rulesJson))
            .toBe(JSON.stringify(clean.compile.rulesJson));
        // `completed` must land back at the end of the pipeline — an undo that
        // re-ran from step 0 would reproduce the grid and still leave this wrong.
        expect(env.completed).toBe(SPHERE_STEPS.length - 1);
    });

    it('undo re-runs from the edit s OWN step, not from step 0', async () => {
        const env = await grownEnv();
        const mover = env.grow.grid.allRegions()[1];
        pushLayoutEdit(env, {
            op: 'move-region', from: { ...mover.cell }, to: emptyCell(env.grow.grid),
        }, SPHERE_EDIT_BINDING);
        const popped = popLayoutEdit(env, SPHERE_EDIT_BINDING);
        expect(sphereUndoStep(popped.edit)).toBe('regions');
        invalidateSphereFrom(env, 'regions');
        // ①②a②b②c survive; only ③④ are gone.
        expect(env.draft).toBeTruthy();
        expect(env.tree).toBeTruthy();
        expect(env.grow).toBeNull();
        expect(env.completed).toBe(SPHERE_STEPS.indexOf('regions') - 1);
    });

    it('set-substrate replays at ②c and undoes from ②b (the node it wrote is ②b s)', async () => {
        const config = bounceConfig();
        const env = newEnvelope(config);
        await runToStep(env, 'items');
        const target = env.nodes[1];
        const original = target.substrate;
        const edit = { op: 'set-substrate', region_id: sphereNodeKey(target), substrate: 'maze' };
        expect(pushLayoutEdit(env, edit, SPHERE_EDIT_BINDING).ok).toBe(true);
        expect(env.nodes[1].substrate).toBe('maze');
        await runToStep(env, 'compile');
        expect(env.grow.grid.allRegions().some((r) => r.substrate === 'maze')).toBe(true);

        // A fresh envelope carrying only the recording lands in the same place —
        // the replay fires after ②c, before ③ realises anything.
        const replayed = newEnvelope(config);
        replayed.edits = [edit];
        await runToStep(replayed, 'compile');
        expect(gridSha(replayed.grow.grid)).toBe(gridSha(env.grow.grid));

        // Undo rewinds to ②b, which is what re-derives the node's substrate.
        expect(sphereUndoStep(edit)).toBe('topology');
        popLayoutEdit(env, SPHERE_EDIT_BINDING);
        invalidateSphereFrom(env, 'topology');
        await resumeEnvelope(env, 'compile');
        expect(env.nodes[1].substrate).toBe(original);
    });

    // The measured defect the recording fixes: node.cell fed
    // buildNodeRealiserSpecs and compactSphereTree, and NOTHING updated it on a
    // layout move. A re-roll after a swap replaced the region that had moved
    // INTO the stale cell — duplicating one region_id and losing another,
    // silently.
    it('a layout move RESYNCS the tree node cells (and the start cell)', async () => {
        const env = await grownEnv();
        const grid = env.grow.grid;
        const [first, second] = grid.allRegions();
        pushLayoutEdit(env, {
            op: 'swap-regions', a: { ...first.cell }, b: { ...second.cell },
        }, SPHERE_EDIT_BINDING);
        for (const node of env.nodes) {
            if (!node.region_id) continue;
            const live = grid.allRegions().find((r) => r.region_id === node.region_id);
            expect([node.region_id, node.cell]).toEqual([node.region_id, {
                gx: live.cell.gx, gy: live.cell.gy,
            }]);
        }
        const root = env.nodes.find((n) => n.parent == null);
        expect(env.grow.startCell).toEqual({ gx: root.cell.gx, gy: root.cell.gy });

        // …so a re-roll AFTER the swap still targets its own region.
        const rerolled = grid.allRegions().find((r) => r.region_id === first.region_id);
        const node = env.nodes.find((n) => n.region_id === first.region_id);
        const before = grid.allRegions().length;
        const r = pushLayoutEdit(env, {
            op: 're-roll', region_id: sphereNodeKey(node), n: 1,
        }, SPHERE_EDIT_BINDING);
        expect(r.ok).toBe(true);
        expect(grid.allRegions()).toHaveLength(before);
        expect(grid.allRegions().filter((x) => x.region_id === first.region_id)).toHaveLength(1);
        expect(grid.getRegion(rerolled.cell).region_id).toBe(first.region_id);
    });

    // The second half of the resync, measured the same way: `node.side` is the
    // side of the PARENT's exit that leads to this node, and an exit-side edit
    // moved the grid's exit while leaving the tree's `side` behind. A later
    // re-roll then rebuilt the region at the TREE's sides and silently REVERTED
    // the edit (invisible while the pair is adjacent; after a swap they are
    // teleporter-linked and keyed by SIDE, so the forward link dies and the
    // oracle reports "sphere count mismatch").
    it('an exit-side edit RESYNCS the tree node sides', async () => {
        const env = await grownEnv();
        const grid = env.grow.grid;
        const exitsOf = (cell) => [...getRegionExits(grid.getRegion(cell)).values()];
        // Any parent that still has a free side: move its forward exit there.
        let target = null;
        for (const child of env.nodes) {
            if (child.parent == null || !child.region_id) continue;
            const parentCell = env.nodes[child.parent]?.cell;
            if (!parentCell || !grid.getRegion(parentCell)) continue;
            const list = exitsOf(parentCell);
            const fwd = list.find((e) => !e.isBackExit && e.targetRegion === child.region_id);
            const used = new Set(list.map((e) => e.side));
            const free = ['N', 'S', 'E', 'W'].find((x) => !used.has(x));
            if (fwd && free) { target = { child, parentCell, fwd, free }; break; }
        }
        expect(target, 'need a parent with a forward exit and a free side').toBeTruthy();
        const { child, parentCell, fwd, free } = target;
        expect(child.side).not.toBe(free); // the row is not vacuous

        const r = pushLayoutEdit(env, {
            op: 'move-exit-side', cell: { ...parentCell }, exitId: fwd.exit_id, side: free,
        }, SPHERE_EDIT_BINDING);
        expect(r.ok).toBe(true);
        expect(child.side).toBe(free);
        // …and the tree can still resolve the parent exit it names, which is the
        // lookup buildNodeRealiserSpecs throws on when it misses.
        expect(grid.getRegion(child.cell)).toBeTruthy();
        expect(grid.getRegion(env.nodes[child.parent].cell).exits_placed
            .some((e) => e.side === child.side)).toBe(true);
    });

    it('the codec carries the recording across a serialise/deserialise boundary', async () => {
        const env = await grownEnv();
        const mover = env.grow.grid.allRegions()[1];
        pushLayoutEdit(env, {
            op: 'move-region', from: { ...mover.cell }, to: emptyCell(env.grow.grid),
        }, SPHERE_EDIT_BINDING);
        const round = deserializeEnvelope(JSON.parse(JSON.stringify(serializeEnvelope(env))));
        expect(round.edits).toEqual(env.edits);
        await runToStep(round, 'compile');
        expect(gridSha(round.grow.grid)).toBe(gridSha(env.grow.grid));
    });

    it('the batch gate replays a layout edit ONCE in a sphere-major run', async () => {
        const config = bounceConfig();
        const perBatch = newEnvelope({ ...config, spheresPerBatch: 1 });
        await runToStep(perBatch, 'compile');
        const mover = perBatch.grow.grid.allRegions()[1];
        const edit = { op: 'move-region', from: { ...mover.cell }, to: emptyCell(perBatch.grow.grid) };

        const replayed = newEnvelope({ ...config, spheresPerBatch: 1 });
        replayed.edits = [edit];
        // Without the gate this throws: the second batch's ③ would find the
        // source cell already empty and the replay refuses.
        await expect(runToStep(replayed, 'compile')).resolves.toBeTruthy();
        expect(replayed.grow.grid.getRegion(edit.to)?.region_id).toBe(mover.region_id);
    });

    it('procgen_metadata carries the recording — and omits it when unedited', async () => {
        const clean = newEnvelope(bounceConfig());
        await runToStep(clean, 'compile');
        expect('edits' in clean.compile.rulesJson.procgen_metadata).toBe(false);

        const env = await grownEnv();
        const mover = env.grow.grid.allRegions()[1];
        pushLayoutEdit(env, {
            op: 'move-region', from: { ...mover.cell }, to: emptyCell(env.grow.grid),
        }, SPHERE_EDIT_BINDING);
        await runToStep(env, 'compile');
        expect(env.compile.rulesJson.procgen_metadata.edits).toEqual(env.edits);
    });

    // The measured round-trip. Maze, because rebuildEnvelopeFromRulesJson
    // refuses zone substrates (no path extractor). This is what the node-cell
    // resync buys: compactSphereTree writes the node's cell, so before B-d an
    // edited world rebuilt at its PRE-edit placement.
    it('an edited world rebuilds from its rules.json at the EDITED placement', async () => {
        const env = newEnvelope(makeConfig());
        await runToStep(env, 'regions');
        const mover = env.grow.grid.allRegions()[1];
        const r = pushLayoutEdit(env, {
            op: 'move-region', from: { ...mover.cell }, to: emptyCell(env.grow.grid),
        }, SPHERE_EDIT_BINDING);
        expect(r.ok).toBe(true);
        await runToStep(env, 'compile');

        const place = (g) => g.allRegions()
            .map((x) => `${x.region_id}@${x.cell.gx},${x.cell.gy}`).sort().join(' ');
        const rebuilt = rebuildEnvelopeFromRulesJson(env.compile.rulesJson, {
            itemLib: DEFAULT_ITEMS,
        });
        expect(place(rebuilt.grow.grid)).toBe(place(env.grow.grid));
        expect(place(env.grow.grid)).toMatch(new RegExp(`${mover.region_id}@\\d+,\\d+`));
    });

    it('a refused edit leaves the grid untouched and records nothing', async () => {
        const env = await grownEnv();
        const [a, b] = env.grow.grid.allRegions();
        const before = gridSha(env.grow.grid);
        const r = pushLayoutEdit(env, {
            op: 'move-region', from: { ...a.cell }, to: { ...b.cell },
        }, SPHERE_EDIT_BINDING);
        expect(r.ok).toBe(false);
        expect(env.edits ?? []).toHaveLength(0);
        expect(gridSha(env.grow.grid)).toBe(before);
    });
});
