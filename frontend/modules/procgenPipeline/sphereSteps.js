// Shared step-runner for the stepped sphere-growth pipeline.
//
// The Procgen Pipeline panel and the headless `sphere-step` CLI both drive
// the 6 sphere-growth steps through this module, so the step wiring (rng
// threading, prebuilt-tree handoff, buildRulesJson opts) lives in ONE place
// and can't drift between the two. The unit of state is a plain "envelope"
// — the serialisable shape of the panel's `_stepState` — that each step
// reads from and merges into. serializeEnvelope / deserializeEnvelope cross
// a process boundary losslessly so the CLI can run each step in its own
// invocation and hand-edit the JSON between them.
//
// Byte-identity: running all 6 steps (in-process OR across serialised
// boundaries) reproduces the monolithic growSpheres + buildRulesJson output
// exactly. See sphereSteps.test.js. The contract that makes this hold:
//   - rng is re-derived from seed at the post-Allocate position by ②b
//     (buildSphereAllocation replays Allocate's fixed filler draws), and the
//     ONLY live rng that must cross a boundary is the post-②b snapshot fed
//     to ③. mulberry32 getState/setState captures that exactly.
//   - ②c consumes no rng; the plan is derived from the editable draft at ②a.

import { createRng } from '../shared/rng.js';
import {
    buildSphereAllocation,
    wireSphereTree,
    placeSphereTreeItems,
    growSpheresAsync,
    buildRulesJson,
    serializeGrid,
    deserializeGrid,
} from './procgenPipelineEngine.js';
import {
    planSpheres,
    computeItemSpheres,
    compareSpheresToPlan,
} from './spherePlanner.js';

/** Step names in run order; index === the `completed` value the step yields. */
export const SPHERE_STEPS = Object.freeze([
    'plan', 'allocate', 'topology', 'items', 'regions', 'compile',
]);

/**
 * Resolve the effective number of spheres to grow per batch from the
 * (optional) `config.spheresPerBatch` knob and the plan's total sphere count.
 *
 * The pipeline is step-major across ALL spheres by default — one batch, which
 * keeps the single continuous rng stream consumed in the monolithic order and
 * is therefore BYTE-IDENTICAL to growSpheres. A smaller batch makes the middle
 * phases (②a–③) run sphere-major in groups of `spheresPerBatch`; that consumes
 * rng in a different order and is EXPECTED to diverge — it's an explicit
 * setting, not a regression.
 *
 * null / undefined / 0 / negative / ≥ totalSpheres all normalise to
 * `totalSpheres` ("one batch = all spheres", the byte-identical default). A
 * value in [1, totalSpheres) is that batch size.
 *
 * Phase 1 only threads + normalises the knob; the batch loop that consumes it
 * lands in Phase 2 (see NewDocs/plans/procedural-generation/per-sphere-batching.md).
 */
export function resolveSpheresPerBatch(spheresPerBatch, totalSpheres) {
    const n = Number(spheresPerBatch);
    if (!Number.isInteger(n) || n <= 0 || n >= totalSpheres) return totalSpheres;
    return n;
}

// Rebuild the growSpheres-shaped config from the (serialisable) resolved
// config block + a sphere plan. Mirrors the panel's _stepAllocate growConfig
// assembly; the caller (panel / CLI) is responsible for having pre-assembled
// config.regionParams (substrate hooks etc.) into a plain object. Exported so
// the panel can populate the `growConfig` its ③-editing features read off one
// shared assembly (instead of duplicating it).
export function growConfigFrom(config, plan) {
    return {
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
    };
}

// The editable draft (sphere 0 = starting items, spheres 1..N = the plan) →
// explicit { plan, startingItems }. Mirrors the panel's _planFromDraft.
function planFromDraft(draft, seed) {
    return {
        startingItems: [...draft.spheres[0]],
        plan: {
            seed,
            spheres: draft.spheres.slice(1)
                .map((items, i) => ({ sphere: i + 1, items: [...items] })),
        },
    };
}

// --- the six steps (mutate + return env) ------------------------------

function stepPlan(env) {
    const c = env.config;
    const plan = planSpheres({
        itemPool: c.itemPool,
        sphereCount: c.sphereCount,
        exclusiveSpheres: c.exclusiveSpheres ?? {},
        ...(c.victoryItem && (c.itemPool[c.victoryItem] ?? 0) > 0
            ? { victoryItem: c.victoryItem } : {}),
        seed: c.seed,
    });
    // The draft is the canonical editable object; the plan is re-derived
    // from it at ②a (so a draft edit flows through).
    env.draft = {
        spheres: [
            [...(c.startingItems ?? [])],
            ...plan.spheres.map((s) => [...s.items]),
        ],
    };
    env.plan = null;
    env.startingItems = null;
    env.allocation = null;
    env.opts = null;
    env.rng = null;
    env.nodes = null;
    env.substrateCounts = null;
    env.quotaFallbacks = null;
    env.topologyWarnings = [];
    env.tree = null;
    env.grow = null;
    env.compile = null;
    env.completed = 0;
    return env;
}

function stepAllocate(env) {
    const { startingItems, plan } = planFromDraft(env.draft, env.config.seed);
    const growConfig = growConfigFrom(env.config, plan);
    const { opts, allocation, rng } = buildSphereAllocation(growConfig);
    env.plan = plan;
    env.startingItems = startingItems;
    env.opts = opts;
    env.allocation = allocation;
    env.rng = { s: rng.getState() };
    env.completed = 1;
    return env;
}

function stepTopology(env) {
    // Re-derive rng at the post-Allocate position (deterministic), exactly
    // as the panel does, so an allocation edit + re-run stays correct.
    const growConfig = growConfigFrom(env.config, env.plan);
    const { rng } = buildSphereAllocation(growConfig);
    const wired = wireSphereTree(env.plan, env.allocation, env.opts, rng);
    env.nodes = wired.nodes;
    env.substrateCounts = wired.substrateCounts;
    env.quotaFallbacks = wired.quotaFallbacks;
    env.rng = { s: wired.rng.getState() }; // threaded into ③
    env.topologyWarnings = [];
    env.completed = 2;
    return env;
}

function stepItems(env) {
    // Clear first so re-running after a topology edit is idempotent
    // (placeSphereTreeItems appends assuming empty — matches all-in-one).
    for (const nd of env.nodes) nd.items = [];
    placeSphereTreeItems(env.plan, env.nodes);
    env.tree = {
        nodes: env.nodes,
        substrateCounts: env.substrateCounts,
        quotaFallbacks: env.quotaFallbacks,
    };
    env.completed = 3;
    return env;
}

async function stepRegions(env, { onProgress = null } = {}) {
    const growConfig = growConfigFrom(env.config, env.plan);
    const rng = createRng(0);
    rng.setState(env.rng.s);
    const { grid, stats, startCell } = await growSpheresAsync({
        ...growConfig,
        growthParams: { ...growConfig.growthParams, prebuiltTree: env.tree, rng },
    }, onProgress);
    env.grow = { grid, stats, startCell };
    env.completed = 4;
    return env;
}

function stepCompile(env) {
    const c = env.config;
    const { grid, stats, startCell } = env.grow;
    const startingItems = env.startingItems ?? [];
    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed: c.seed,
        itemLib: c.itemLib,
        startingItems,
        lockedCanonicalItems: c.lockedCanonicalItems ?? [],
        // A starting item is placed at no location, so the compiled pool
        // doesn't carry it — backfill its definition (ids 999↓ stay clear
        // of the compiled pool's upward numbering).
        ...(startingItems.length > 0 ? {
            sourceItems: Object.fromEntries(startingItems.map((name, i) => [name, {
                name, id: 999 - i, classification: 'progression', groups: ['Everything'],
            }])),
        } : {}),
        enableLoopMode: c.enableLoopMode,
        regionXpEffect: c.regionXpEffect,
        completionConditionItem: c.victoryItem,
        procgenMetadata: {
            driver: 'sphere-growth',
            stop_reason: stats.stopReason,
            sphere_plan: env.plan,
        },
    });
    const oracleErrors = compareSpheresToPlan(computeItemSpheres(rulesJson), env.plan);
    env.compile = { rulesJson, oracleErrors };
    env.completed = 5;
    return env;
}

const RUNNERS = {
    plan: stepPlan,
    allocate: stepAllocate,
    topology: stepTopology,
    items: stepItems,
    regions: stepRegions,
    compile: stepCompile,
};

/**
 * Run a single named step over the envelope, mutating + returning it.
 * `plan` needs only env.config; later steps need the prior step's outputs.
 * Async because ③ may stream progress (pass opts.onProgress). All steps
 * resolve to the (same, mutated) env.
 */
export async function runStep(stepName, env, opts = {}) {
    const runner = RUNNERS[stepName];
    if (!runner) throw new Error(`runStep: unknown step '${stepName}'`);
    return runner(env, opts);
}

/**
 * Run every step from the current `completed` point through `toStep`
 * (default: the last step), in order. Returns the final env.
 */
export async function runToStep(env, toStep = 'compile', opts = {}) {
    const target = SPHERE_STEPS.indexOf(toStep);
    if (target < 0) throw new Error(`runToStep: unknown step '${toStep}'`);
    // `completed` is the index of the last finished step (-1 / undefined =
    // nothing run yet, so the next step to run is `plan` at index 0).
    let next = (env.completed ?? -1) + 1;
    for (; next <= target; next++) {
        // eslint-disable-next-line no-await-in-loop
        await runStep(SPHERE_STEPS[next], env, opts);
    }
    return env;
}

// --- envelope (de)serialisation ---------------------------------------
//
// Only three things in a live envelope aren't plain JSON: the rng (already
// stored as { s }), each topology node's `usedSides` Set, and the grown
// Grid. The codec converts just those; everything else (config, plan,
// allocation, draft, stats) is plain.

function serializeNode(nd) {
    return { ...nd, usedSides: [...(nd.usedSides ?? [])] };
}

function deserializeNode(nd) {
    return { ...nd, usedSides: new Set(nd.usedSides ?? []) };
}

/** Live envelope → JSON-safe plain object. */
export function serializeEnvelope(env) {
    const out = { ...env };
    if (env.nodes) out.nodes = env.nodes.map(serializeNode);
    if (env.tree) {
        // tree.nodes aliases env.nodes — don't double-emit; rebuild the
        // alias on deserialize.
        out.tree = {
            substrateCounts: env.tree.substrateCounts,
            quotaFallbacks: env.tree.quotaFallbacks,
        };
    }
    if (env.grow?.grid) {
        out.grow = { ...env.grow, grid: serializeGrid(env.grow.grid) };
    }
    return out;
}

/** JSON-safe plain object (from serializeEnvelope) → live envelope. */
export function deserializeEnvelope(obj) {
    const env = { ...obj };
    if (obj.nodes) env.nodes = obj.nodes.map(deserializeNode);
    if (obj.tree) {
        env.tree = {
            nodes: env.nodes, // re-alias the decoded nodes
            substrateCounts: obj.tree.substrateCounts,
            quotaFallbacks: obj.tree.quotaFallbacks,
        };
    }
    if (obj.grow?.grid) {
        env.grow = { ...obj.grow, grid: deserializeGrid(obj.grow.grid) };
    }
    return env;
}

/** A fresh, empty envelope for the given resolved config block. */
export function newEnvelope(config) {
    return { config, completed: -1 };
}

// Whether each step's OUTPUT is present in an envelope. Used to derive the
// resume point from data presence rather than a trusted `completed` field —
// so a hand-edited / partial envelope resumes from the first step whose
// output is missing. Mental model: presence = keep, absence = recompute
// (delete everything from a step's output onward to force a re-run there).
const STEP_OUTPUT_PRESENT = {
    plan: (e) => !!e.draft,
    allocate: (e) => !!(e.plan && e.allocation && e.opts && e.rng),
    topology: (e) => !!(e.nodes && e.substrateCounts),
    items: (e) => !!e.tree,
    regions: (e) => !!e.grow?.grid,
    compile: (e) => !!e.compile?.rulesJson,
};

/**
 * Derive the `completed` index (last CONTIGUOUSLY-finished step) from which
 * step outputs are present in `env`. Returns -1 when nothing is present (so
 * the resume point is detectCompleted(env) + 1 = the first step to run).
 * A gap stops the walk: data after the first missing step is treated as
 * stale and will be overwritten when the pipeline runs forward.
 */
export function detectCompleted(env) {
    let n = 0;
    for (const step of SPHERE_STEPS) {
        if (STEP_OUTPUT_PRESENT[step](env)) n += 1;
        else break;
    }
    return n - 1;
}

/**
 * Resume an envelope to completion (or `toStep`), starting from the first
 * step whose output is missing — no manual step selection. Normalises
 * `env.completed` from data presence first.
 */
export async function resumeEnvelope(env, toStep = 'compile', opts = {}) {
    env.completed = detectCompleted(env);
    return runToStep(env, toStep, opts);
}
