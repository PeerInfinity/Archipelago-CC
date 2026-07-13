// Shared step-runner for the stepped SHUFFLED-SPIRAL pipeline.
//
// The third client of steppedPipeline.js (after sphere + top-down): the Procgen
// Pipeline panel and the headless `spiral-step` CLI drive the four spiral steps
// through this one module, so the step wiring (rng threading, buildRulesJson
// opts) lives in ONE place and can't drift. The unit of state is a plain
// "envelope"; serialize/deserialize cross a process boundary losslessly so the
// CLI can run each step in its own invocation and hand-edit the JSON between them.
//
// The four steps split the monolithic arrangeShuffledSpiral (now
// arrangeSpiralPlan + realiseSpiralRegions in the engine) plus buildRulesJson:
//
//   ① arrange  — arrangeSpiralPlan: validate, build the shuffled substrate
//                sequence (the ONLY pre-loop rng draw), auto-size the grid.
//                Editable artifact: the placement plan {sequence, cells, …}.
//   ② content  — zone substrates synthesise their per-zone dataset. A NO-OP for
//                every current substrate (byte-identical); JtA's dataset lands
//                here in Part 3 (design doc §6). See "② content" below.
//   ③ regions  — realiseSpiralRegions: restore the post-shuffle rng, spiral-walk
//                region synthesis + stitch / reconcile-bidirectional / wall-off.
//                Consumes rng only for PROCEDURAL substrates (maze); zone
//                substrates (jta) draw none, so a JtA-only walk is rng-free.
//   ④ compile  — buildRulesJson: the rules.json + procgen metadata.
//
// Byte-identity: running all four steps reproduces monolithic arrangeShuffledSpiral
// + buildRulesJson exactly. The rng is a single continuous stream — ① consumes
// the shuffle and snapshots the state (env.rng = { s }), ② consumes none, ③
// restores that snapshot and continues the per-cell procedural draws. See
// scripts/procgen/dump-spiral-byteidentity.mjs.
//
// ② content (designed for Part 3, no-op now): the presence probe treats "no
// content substrate in this world" as a COMPLETED no-op, so detectCompleted's
// contiguous walk doesn't stall at ② on every current world. A substrate opts in
// by exposing `adapter.emitsSpiralContent`; ② then populates env.<sub>Content and
// the descriptor's `onContentEdit` restamps it on hand-edit (steppedPipeline.js).

import {
    arrangeSpiralPlan,
    realiseSpiralRegions,
    buildRulesJson,
    serializeGrid,
    deserializeGrid,
} from './procgenPipelineEngine.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    runStep as runStepGeneric,
    runToStep as runToStepGeneric,
    detectCompleted as detectCompletedGeneric,
    resumeEnvelope as resumeEnvelopeGeneric,
    newEnvelope as newEnvelopeGeneric,
    serializeEnvelope as serializeEnvelopeGeneric,
    deserializeEnvelope as deserializeEnvelopeGeneric,
} from './steppedPipeline.js';

/** Step names in run order; index === the `completed` value the step yields. */
export const SPIRAL_STEPS = Object.freeze(['arrange', 'content', 'regions', 'compile']);

// Whether any substrate in this spiral world emits ② content. No current
// substrate does (all ② runs are no-ops), so this is false for every existing
// world and the ② presence probe reports "completed" without an env.content —
// keeping detectCompleted's contiguous walk from stalling at ②. JtA opts the
// first content substrate in via `adapter.emitsSpiralContent` in Part 3.
function worldHasContentSubstrate(env) {
    const quotas = env.config?.growthParams?.substrateQuotas ?? {};
    for (const [id, count] of Object.entries(quotas)) {
        if (!(Number(count) > 0)) continue;
        if (substrateRegistry.get(id)?.emitsSpiralContent) return true;
    }
    return false;
}

// --- the four steps (mutate + return env) -----------------------------

// ① — arrange. Build the placement plan + snapshot the post-shuffle rng. Nulls
// everything downstream (a fresh run / re-arrange invalidates ②–④).
function stepArrange(env) {
    const plan = arrangeSpiralPlan(env.config);
    env.arrange = {
        sequence: plan.sequence,
        cells: plan.cells,
        startCell: plan.startCell,
        gridDims: plan.gridDims,
    };
    env.rng = { s: plan.rngState }; // continuous stream, post-shuffle
    env.content = null;
    env.regions = null;
    env.compile = null;
    env.completed = 0;
    return env;
}

// ② — content. No-op for every current substrate (byte-identical). A content
// substrate would synthesise its per-zone dataset onto env.<sub>Content here,
// keyed off the ① placement plan; the presence probe + onContentEdit seam
// (Part 3) handle invalidation + restamp. Consumes no rng.
function stepContent(env) {
    // Reserved: iterate content substrates and populate env.<sub>Content.
    env.content = null;
    env.completed = 1;
    return env;
}

// ③ — regions. Restore the post-shuffle rng and realise every planned cell onto
// a fresh grid, then the whole-grid post-passes. Deterministic given the plan +
// config; procedural substrates draw rng in the exact monolithic order.
function stepRegions(env) {
    const plan = { ...env.arrange, rngState: env.rng.s };
    const { grid, stats, startCell } = realiseSpiralRegions(plan, env.config);
    env.regions = { grid, stats, startCell };
    env.compile = null;
    env.completed = 2;
    return env;
}

// ④ — compile. buildRulesJson + procgen metadata. Reads env.compileIn (seed,
// loop-mode flags, completion item) so the runner stays self-contained for the
// CLI — mirrors the panel's old inline _runShuffledSpiral compile tail.
function stepCompile(env) {
    const { grid, stats, startCell } = env.regions;
    const c = env.compileIn ?? {};
    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed: c.seed,
        enableLoopMode: !!c.enableLoopMode,
        regionXpEffect: c.regionXpEffect ?? 'cost',
        completionConditionItem: c.completionConditionItem ?? null,
        procgenMetadata: {
            driver: 'shuffled-spiral',
            stop_reason: stats.stopReason,
        },
    });
    env.compile = { rulesJson };
    env.completed = 3;
    return env;
}

const RUNNERS = {
    arrange: stepArrange,
    content: stepContent,
    regions: stepRegions,
    compile: stepCompile,
};

/** The next step given the envelope's `completed` index; null when done.
 *  Spiral is a trivial linear +1 walk (no batching). */
export function nextSpiralStep(env) {
    const completed = env.completed ?? -1;
    return completed < SPIRAL_STEPS.length - 1 ? SPIRAL_STEPS[completed + 1] : null;
}

// --- envelope (de)serialisation codecs --------------------------------
//
// Almost everything is plain JSON: the config, the ① placement plan (sequence /
// cells / startCell / gridDims), the rng snapshot ({ s }), the compiled
// rules.json. The one non-plain artifact is the grown Grid on ③'s output —
// encode it once, rebuild on decode (mirrors sphere's grow.grid).
const SPIRAL_CODECS = {
    regions: {
        encode: (r) => (r.grid ? { ...r, grid: serializeGrid(r.grid) } : r),
        decode: (r) => (r.grid ? { ...r, grid: deserializeGrid(r.grid) } : r),
    },
};

// Whether each step's OUTPUT is present in an envelope — used to derive the
// resume point from data presence (a hand-edited/partial envelope resumes from
// the first step whose output is missing). ② is a completed no-op when no
// content substrate is present (see worldHasContentSubstrate).
const SPIRAL_STEP_OUTPUT_PRESENT = {
    arrange: (e) => !!e.arrange,
    content: (e) => !worldHasContentSubstrate(e) || !!e.content,
    regions: (e) => !!e.regions?.grid,
    compile: (e) => !!e.compile?.rulesJson,
};

// The spiral mode descriptor — the whole per-mode surface the harness needs.
// `onContentEdit` (the ② restamp seam) is intentionally absent: no current
// substrate emits content, so a decoded envelope needs no restamp. JtA adds it
// in Part 3.
const SPIRAL_DESCRIPTOR = {
    steps: SPIRAL_STEPS,
    runners: RUNNERS,
    present: SPIRAL_STEP_OUTPUT_PRESENT,
    codecs: SPIRAL_CODECS,
    nextStep: nextSpiralStep,
};

// --- public API (delegates to the shared harness) ---------------------

/** A fresh envelope for a pre-assembled arrange config + compile inputs. */
export function newSpiralEnvelope({ config, compileIn = null }) {
    return newEnvelopeGeneric({ config, compileIn });
}

/**
 * Run a single named step over the envelope, mutating + returning it. Async for
 * signature parity with the other modes' runners (spiral's steps are synchronous
 * today, but the panel/CLI await them uniformly).
 */
export async function runSpiralStep(stepName, env, opts = {}) {
    return runStepGeneric(stepName, env, opts, SPIRAL_DESCRIPTOR);
}

/** Run steps from the current point through `toStep` (default: to completion). */
export async function runSpiralToStep(env, toStep = 'compile', opts = {}) {
    return runToStepGeneric(env, toStep, opts, SPIRAL_DESCRIPTOR);
}

/** Live envelope → JSON-safe plain object. */
export function serializeSpiralEnvelope(env) {
    return serializeEnvelopeGeneric(env, SPIRAL_DESCRIPTOR);
}

/** JSON-safe plain object (from serializeSpiralEnvelope) → live envelope. */
export function deserializeSpiralEnvelope(obj) {
    return deserializeEnvelopeGeneric(obj, SPIRAL_DESCRIPTOR);
}

/** The `completed` index (last contiguously-finished step) from data presence. */
export function detectSpiralCompleted(env) {
    return detectCompletedGeneric(env, SPIRAL_DESCRIPTOR);
}

/** Resume to `toStep` from the first step whose output is missing. */
export async function resumeSpiralEnvelope(env, toStep = 'compile', opts = {}) {
    return resumeEnvelopeGeneric(env, toStep, opts, SPIRAL_DESCRIPTOR);
}
