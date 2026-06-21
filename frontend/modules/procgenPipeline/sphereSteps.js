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
// Batch-aware (per-sphere) orchestration. One global `config.spheresPerBatch`
// knob drives the whole pipeline: ① Plan once → loop per batch
// [②a Allocate → ②b Topology → ②c Items → ③ Regions] → ④ Compile once. The
// loop-back after ③ lives in nextSphereStep(env) (used by runToStep /
// resumeEnvelope, and the panel / CLI). batch = all (the default) is ONE batch
// covering every wave → today's step-major path → BYTE-IDENTICAL to monolithic
// growSpheres; a batch < all grows sphere-major (output diverges by design).
//
// Cross-batch state on the envelope: the accumulated `nodes` (with usedSides /
// childGates), substrateCounts / quotaFallbacks, the grown grid (env.grow),
// `placed` (node indices on the grid), `batchStart` (advances by batch after
// ③), `prevCount` (node count before the current batch's wiring), and a
// CONTINUOUS rng snapshot threaded after EVERY rng-consuming step (incl. ③).
//
// Byte-identity contract (running all steps in-process OR across serialised
// boundaries reproduces the monolithic output exactly — see sphereSteps.test.js):
//   - The rng is a single continuous stream consumed in the monolithic order:
//     Allocate's fixed filler draws → Topology wiring → ③ realisation. ②b for
//     the FIRST batch re-derives the rng to the post-Allocate position from
//     seed (deterministic — Allocate draws a fixed fillerCount), so an
//     allocation edit + re-run stays correct without depending on a snapshot a
//     later step may have advanced; later batches restore the threaded
//     snapshot (their start position depends on prior batches' consumption and
//     is only known from the snapshot). mulberry32 getState/setState captures
//     each boundary exactly.
//   - ②c consumes no rng; the plan is derived from the editable draft at ②a.
//   - ③ reuses realiseSphereBatchGen (shared with growSpheresBatchedGen), so
//     the step runner and the standalone batched driver produce identical
//     worlds for a given batch size — one realise-batch implementation.

import { createRng } from '../shared/rng.js';
import {
    buildSphereAllocation,
    wireSphereWaves,
    placeSphereTreeItems,
    realiseSphereBatchGen,
    buildRulesJson,
    serializeGrid,
    deserializeGrid,
    Grid,
    stitchGrid,
    wallOffUnusedExits,
} from './procgenPipelineEngine.js';
import { DEFAULT_ITEMS, DEFAULT_OBSTACLES } from '../shared/procgen/library.js';
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
            // Carried for any standalone batched driver consumer; the step
            // runner reads env.config.spheresPerBatch directly to drive its
            // loop. null / all → one batch = byte-identical default.
            ...(config.spheresPerBatch != null ? { spheresPerBatch: config.spheresPerBatch } : {}),
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
    // Cross-batch loop state (see stepAllocate / stepRegions).
    env.placed = null;
    env.prevCount = 0;
    env.batchStart = 0;
    env.totalNodes = null;
    env.dims = null;
    env.startCell = null;
    env.completed = 0;
    return env;
}

// Auto-size the grid from a sphere allocation: total region count =
// Σ regionsPerWave + fillerCount, side = ceil(sqrt(total)) * 2 + 1 (≥ 5),
// start cell centred. Deterministic — matches growSpheresGen's sizing — so it
// can be recomputed in ③ when an envelope resumed straight to the regions step
// doesn't carry ②a's sizing (e.g. a panel export that omits it).
function gridSizeFor(allocation, fillerCount = 0) {
    const totalNodes = allocation.regionsPerWave.reduce((a, b) => a + b, 0) + (fillerCount ?? 0);
    const side = Math.max(5, Math.ceil(Math.sqrt(totalNodes)) * 2 + 1);
    return {
        totalNodes,
        dims: { width: side, height: side },
        startCell: { gx: Math.floor(side / 2), gy: Math.floor(side / 2) },
    };
}

// ②a — Allocate. On the FIRST batch only (batchStart 0): re-derive the full
// allocation (fillers drawn up front), reset the cross-batch accumulators, and
// size the grid from the now-known total region count. Later batches loop back
// here as a NO-OP (the allocation + accumulators already exist) — the unit of
// re-running per batch is ②b/②c/③, not ②a. Snapshots the rng at the
// post-Allocate position so ②b can continue the same stream.
function stepAllocate(env) {
    if ((env.batchStart ?? 0) > 0) {
        // Loop-back batch: allocation, accumulators, grid sizing all stand.
        env.completed = 1;
        return env;
    }
    const { startingItems, plan } = planFromDraft(env.draft, env.config.seed);
    const growConfig = growConfigFrom(env.config, plan);
    const { opts, allocation, rng } = buildSphereAllocation(growConfig);
    env.plan = plan;
    env.startingItems = startingItems;
    env.opts = opts;
    env.allocation = allocation;
    env.rng = { s: rng.getState() };
    // Reset the cross-batch accumulators for a fresh run (a clean slate
    // regardless of any prior pipeline state left on the envelope).
    env.nodes = null;
    env.substrateCounts = null;
    env.quotaFallbacks = null;
    env.tree = null;
    env.grow = null;
    env.placed = null;
    env.prevCount = 0;
    env.batchStart = 0;
    // Size the grid from the FINAL region count (the full plan is known up
    // front), matching growSpheresGen's auto-size — so a sphere-major run uses
    // the same grid as the all-at-once build.
    const sizing = gridSizeFor(allocation, env.config.fillerCount);
    env.totalNodes = sizing.totalNodes;
    env.dims = sizing.dims;
    env.startCell = sizing.startCell;
    env.completed = 1;
    return env;
}

// ②b — Topology. Wire the current batch's waves [batchStart, batchEnd) onto the
// accumulated nodes via the resumable wiring context (wireSphereWaves). The
// FIRST batch re-derives the rng to the post-Allocate position from seed
// (deterministic — a fixed fillerCount draw), so an allocation edit + re-run
// stays correct without leaning on a snapshot a later step may have advanced;
// later batches restore the continuous threaded snapshot (their start position
// depends on how much rng prior batches consumed).
function stepTopology(env) {
    const batchStart = env.batchStart ?? 0;
    const total = env.plan.spheres.length;
    const batch = resolveSpheresPerBatch(env.config.spheresPerBatch, total);
    const waveEnd = Math.min(batchStart + batch, total);

    let rng;
    let resume;
    let prevCount;
    if (batchStart === 0) {
        rng = buildSphereAllocation(growConfigFrom(env.config, env.plan)).rng;
        resume = null;
        prevCount = 0;
    } else {
        rng = createRng(0);
        rng.setState(env.rng.s);
        resume = {
            nodes: env.nodes,
            substrateCounts: env.substrateCounts,
            quotaFallbacks: env.quotaFallbacks,
        };
        prevCount = env.nodes.length;
    }
    const wired = wireSphereWaves(env.plan, env.allocation, env.opts, rng, {
        waveStart: batchStart, waveEnd, resume,
    });
    env.nodes = wired.nodes;
    env.substrateCounts = wired.substrateCounts;
    env.quotaFallbacks = wired.quotaFallbacks;
    env.prevCount = prevCount; // node count BEFORE this batch's wiring (for ③)
    // Two rng snapshots cross to ③:
    //   - regionsRng = the position at the START of ③ (post-②b). ③ restores
    //     THIS and never clobbers it, so re-running ③ (a resume that dropped the
    //     grow output) replays from the correct point even after a prior ③
    //     advanced the continuous stream.
    //   - rng stays the continuous stream the next batch's ②b restores; ③
    //     advances it to post-③.
    env.regionsRng = { s: rng.getState() };
    env.rng = { s: rng.getState() };
    env.topologyWarnings = [];
    env.completed = 2;
    return env;
}

// ②c — Items. Clear + place ALL items every batch (no rng): idempotent for
// already-realised waves; the new batch's items land on their nodes. Matches
// the per-batch clear+place in growSpheresBatchedGen.
function stepItems(env) {
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

// ③ — Regions. Drain the shared per-batch realiser onto the carried grid (place
// the new nodes' cells, realise them, and re-realise any earlier-batch host
// that gained a child this batch), then advance batchStart by the batch size.
// The whole-grid stitch / wall-off post-passes run ONCE, after the LAST batch.
// batch = all is a single batch covering every wave → byte-identical to
// growSpheresGen; a smaller batch threads the same rng a batch at a time and is
// byte-identical to growSpheresBatchedGen (the unify invariant).
async function stepRegions(env, { onProgress = null } = {}) {
    const growConfig = growConfigFrom(env.config, env.plan);
    const total = env.plan.spheres.length;
    // The grown grid IS the realisation state: a carried grid + batchStart > 0
    // is a legit mid-loop continuation, but if the grid is gone (a resume that
    // dropped the grow output, or an edit that invalidated it) the cursor is
    // stale — restart at batch 0 rather than take the carry-forward path with
    // no grid to carry.
    const batchStart = env.grow?.grid ? (env.batchStart ?? 0) : 0;
    const {
        regionSize, itemLib = DEFAULT_ITEMS, obstacleLib = DEFAULT_OBSTACLES,
        regionParams = {}, hazardOpts = null,
    } = growConfig;
    const { teleporterMinGap = 2, assumeBidirectional = true } = growConfig.growthParams;

    const rng = createRng(0);
    rng.setState((env.regionsRng ?? env.rng).s); // post-②b position

    // Size the grid from the CURRENT allocation (deterministic — matches
    // growSpheresGen's auto-size for the unedited tree). Recomputing here rather
    // than trusting ②a's stashed env.dims keeps the grid correctly sized when
    // the allocation was edited after ②a ran (more / fewer regions). Falls back
    // to the stashed dims only if the allocation is somehow absent.
    const sizing = env.allocation
        ? gridSizeFor(env.allocation, env.config.fillerCount)
        : { dims: env.dims, startCell: env.startCell, totalNodes: env.totalNodes };

    let grid;
    let startCell;
    let stats;
    if (batchStart === 0) {
        grid = new Grid(sizing.dims);
        startCell = sizing.startCell;
        stats = {
            regionsBuilt: 0,
            regionsSkipped: 0,
            teleportersPlaced: 0,
            stopReason: null,
            substrateCounts: env.substrateCounts,
            quotaFallbacks: env.quotaFallbacks,
        };
        env.placed = new Set();
    } else {
        grid = env.grow.grid;
        startCell = env.grow.startCell;
        stats = env.grow.stats;
    }
    const placed = env.placed instanceof Set ? env.placed : new Set(env.placed ?? []);
    // A batch-0 (re)start realises every node from index 0; only a genuine
    // mid-loop continuation carries a non-zero prevCount.
    const prevCount = batchStart === 0 ? 0 : (env.prevCount ?? 0);

    const gen = realiseSphereBatchGen(grid, env.nodes, env.tree, rng, {
        prevCount,
        placed,
        startCell,
        teleporterMinGap,
        dims: sizing.dims,
        total: sizing.totalNodes ?? env.nodes.length,
        regionSize,
        itemLib,
        obstacleLib,
        regionParams,
        hazardOpts,
        assumeBidirectional,
        stats,
    });
    let r = gen.next();
    while (!r.done) {
        onProgress?.(r.value);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => { setTimeout(resolve, 0); });
        r = gen.next();
    }

    // Keep the realised tallies fresh from the accumulated wiring context.
    stats.substrateCounts = env.substrateCounts;
    stats.quotaFallbacks = env.quotaFallbacks;

    env.rng = { s: rng.getState() }; // threaded into the next batch's ②b
    env.placed = placed;
    // Advance the cursor by the waves WIRED so far (highest wave in the node
    // set + 1), not a blind += batch. For the forward loop this equals the
    // batch's waveEnd (every wave has ≥ 1 node) AND counts a deferred (childless)
    // root's wave so the loop doesn't stall on it. For an EDIT re-run — where the
    // kept node set already spans every wave — it jumps straight to `total`, so
    // ③ realises the whole (edited) tree once and the loop falls through to ④
    // instead of re-wiring waves that already exist.
    const maxWave = env.nodes.reduce((m, n) => Math.max(m, n.wave), -1);
    env.batchStart = Math.min(maxWave + 1, total);
    env.grow = { grid, stats, startCell };

    if (env.batchStart >= total) {
        // Last batch: every exit was allocated to a child or teleporter, so
        // stitching is purely confirmatory — run the whole-grid post-passes
        // once. (Idempotent, but cheap to keep to the final batch.)
        stitchGrid(grid);
        wallOffUnusedExits(grid);
        stats.stopReason = 'plan_complete';
    }
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

// The plan's wave count, read from env.plan (post-①) or the draft (post-plan,
// pre-allocate). 0 before ① has run.
function totalWaves(env) {
    if (env.plan) return env.plan.spheres.length;
    if (env.draft) return env.draft.spheres.length - 1;
    return 0;
}

/**
 * The next step to run given the envelope's `completed` index and batch state.
 * The pipeline is `① Plan → loop[②a → ②b → ②c → ③] per batch → ④ Compile`:
 * after ③ (completed 4) it loops back to ②a while `batchStart < waves`,
 * otherwise falls through to ④. Returns null when ④ is done (completed 5).
 * batch = all keeps batchStart at the wave count after the single ③, so the
 * sequence collapses to the linear six steps.
 */
export function nextSphereStep(env) {
    const completed = env.completed ?? -1;
    if (completed < 4) return SPHERE_STEPS[completed + 1];
    if (completed === 4) {
        const waves = totalWaves(env);
        return (env.batchStart ?? waves) < waves ? 'allocate' : 'compile';
    }
    return null;
}

/**
 * Run steps via nextSphereStep — which loops the middle four phases per batch
 * (sphere-major) and falls through to ④ after the last batch — stopping once
 * `toStep` has just run. For the looping phases (②a–③) that's the FIRST time
 * they run; resume the returned env to continue the loop. Returns the env.
 */
export async function runToStep(env, toStep = 'compile', opts = {}) {
    if (SPHERE_STEPS.indexOf(toStep) < 0) throw new Error(`runToStep: unknown step '${toStep}'`);
    let step = nextSphereStep(env);
    while (step) {
        // eslint-disable-next-line no-await-in-loop
        await runStep(step, env, opts);
        if (step === toStep) break;
        step = nextSphereStep(env);
    }
    return env;
}

// --- envelope (de)serialisation ---------------------------------------
//
// Four things in a live envelope aren't plain JSON: the rng (already stored as
// { s }), each topology node's `usedSides` Set, the grown Grid, and the
// cross-batch `placed` Set (node indices on the grid). The codec converts just
// those; everything else (config, plan, allocation, draft, stats, batchStart,
// prevCount, dims, startCell, totalNodes) is plain.

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
    if (env.placed) {
        out.placed = env.placed instanceof Set ? [...env.placed] : env.placed;
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
    if (obj.placed) env.placed = new Set(obj.placed);
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
