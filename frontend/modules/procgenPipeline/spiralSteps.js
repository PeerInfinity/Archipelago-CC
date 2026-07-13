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
// ② content: the presence probe treats "no content source in this world" as a
// COMPLETED no-op, so detectCompleted's contiguous walk doesn't stall at ② on
// every current world. A content source opts in by exposing
// `adapter.emitsSpiralContent` AND carrying a document in its substrate config;
// ② then materialises that document onto `env.content` and the descriptor's
// `onContentEdit` restamps it on hand-edit (steppedPipeline.js). The config
// field the document lives under is named by the source (`spiralContentConfigKey`,
// default `datasetDoc`) — region-library C3 generalised this so a region library
// (`library:<id>`) is a second content kind riding the same ② seam as jta's
// dataset.

import {
    arrangeSpiralPlan,
    realiseSpiralRegions,
    buildRulesJson,
    serializeGrid,
    deserializeGrid,
} from './procgenPipelineEngine.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { isLibrarySourceId } from './procgenPipelineEngine.js';
import { stampLibraryIdentity } from './regionLibraryValidator.js';
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

// Where a content source's installed document lives inside its
// `substrateConfig[id]` entry. A source names its field via
// `spiralContentConfigKey`; the jta-era default is `datasetDoc`. This is the
// one field name the ② content seam has to know — generalising it (region-library
// C3) is what lets a SECOND content kind (a region library, keyed `library:<id>`
// with `spiralContentConfigKey: 'libraryDoc'`) ride ② alongside jta's dataset.
function contentConfigKey(adapter) {
    return adapter?.spiralContentConfigKey ?? 'datasetDoc';
}

// A loaded region library is a content source with no registry adapter — its
// document rides config directly (no module globals). This synthetic adapter
// gives the ② content seam the same hook surface jta exposes: the document lives
// under `libraryDoc`, is stamped by `library_id`, needs no global install
// (getSpiralContent returns null → stepContent falls back to the config doc),
// and restamps on hand-edit. See region-library C3/F4.
const LIBRARY_CONTENT_ADAPTER = Object.freeze({
    emitsSpiralContent: true,
    spiralContentConfigKey: 'libraryDoc',
    getSpiralContent: () => null,
    applyPipelineConfig: () => {},
    onContentEdit: (doc) => (doc == null ? doc : stampLibraryIdentity(doc)),
});

// The stamped content-hash id of a content document, used to detect a real
// hand-edit (id changed ⇒ invalidate downstream). Each content kind stamps its
// own field — jta datasets `dataset_id`, region libraries `library_id` — so the
// ② restamp seam reads whichever is present.
function contentDocId(doc) {
    return doc?.dataset_id ?? doc?.library_id ?? null;
}

// The content sources in this world's quota that actually EMIT a content
// document, in quota order. A source emits content only when it both declares
// `emitsSpiralContent` (jta does; a library source does) AND its pipeline config
// carries a document under its `contentConfigKey`. That config gate is
// load-bearing: jta declares emitsSpiralContent unconditionally, but a
// DATASET-LESS jta world (vanilla tables — jta-zone-demo, mixed maze+jta) emits
// no content, so ② stays a byte-identical no-op and the `content` presence probe
// (`!worldHasContentSubstrate(e) || !!e.content`) reports "completed" without an
// env.content instead of stalling detectCompleted's contiguous walk at ②.
function contentSubstrates(env) {
    const quotas = env.config?.growthParams?.substrateQuotas ?? {};
    const cfg = env.config?.growthParams?.substrateConfig ?? {};
    const out = [];
    for (const [id, count] of Object.entries(quotas)) {
        if (!(Number(count) > 0)) continue;
        if (isLibrarySourceId(id)) {
            if (cfg[id]?.libraryDoc != null) out.push({ id, adapter: LIBRARY_CONTENT_ADAPTER });
            continue;
        }
        const adapter = substrateRegistry.get(id);
        if (adapter?.emitsSpiralContent && cfg[id]?.[contentConfigKey(adapter)] != null) {
            out.push({ id, adapter });
        }
    }
    return out;
}

function worldHasContentSubstrate(env) {
    return contentSubstrates(env).length > 0;
}

// Install each quota substrate's pipeline config (dataset + zone-locations
// knobs) BEFORE arrangement, so the quota-vs-zoneCount validation in
// arrangeSpiralPlan sees the dataset's real zone count (design §6.3 "run the
// generator before arrangement"). A substrate exposes `applyPipelineConfig`;
// only jta does, and its hook resets to the vanilla-path defaults when its
// config is absent, so a dataset-less world stays byte-identical. Config lives
// at config.growthParams.substrateConfig[id] (a preset carries it, per the
// "presets store config, not envelopes" convention).
function applySubstrateConfig(env) {
    const quotas = env.config?.growthParams?.substrateQuotas ?? {};
    const cfg = env.config?.growthParams?.substrateConfig ?? {};
    for (const [id, count] of Object.entries(quotas)) {
        if (!(Number(count) > 0)) continue;
        substrateRegistry.get(id)?.applyPipelineConfig?.(cfg[id]);
    }
}

// --- the four steps (mutate + return env) -----------------------------

// ① — arrange. Install substrate config (so the quota validation sees the
// dataset's real zoneCount), then build the placement plan + snapshot the
// post-shuffle rng. Nulls everything downstream (a fresh run / re-arrange
// invalidates ②–④).
function stepArrange(env) {
    applySubstrateConfig(env);
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

// ② — content. Materialise the content substrate's installed document onto the
// envelope as the editable artifact. A NO-OP (env.content = null) for every
// dataset-less world (byte-identical). v1 supports one content substrate (jta);
// its document was installed by ① applySubstrateConfig (or, across a process
// boundary, by the deserialize seam). Deep-copied so envelope edits don't mutate
// the installed/config document. Consumes no rng.
function stepContent(env) {
    let content = null;
    const cfg = env.config?.growthParams?.substrateConfig ?? {};
    for (const { id, adapter } of contentSubstrates(env)) {
        // jta reads its installed global; a library has no global, so fall back
        // to the document carried in its config entry.
        const doc = adapter.getSpiralContent?.() ?? cfg[id]?.[contentConfigKey(adapter)] ?? null;
        if (doc != null) { content = JSON.parse(JSON.stringify(doc)); break; }
    }
    env.content = content;
    env.regions = null;
    env.compile = null;
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

// The ② content restamp + re-install seam, called on every envelope deserialize
// (steppedPipeline.deserializeEnvelope). Globals don't cross a process boundary,
// so this re-installs the content substrate's config on load — from the edited
// env.content when present (past ②), else the config's carried document (a fresh
// cross-process ①/②). It also restamps a hand-edited env.content (content-hash →
// new dataset_id) and, when that id CHANGES (a real edit), clears the downstream
// regions/compile so an auto-resume regenerates them against the edited dataset
// (Phase-B gate d). Idempotent: an unchanged document restamps to the same id
// and re-installs the same globals. A no-op for dataset-less worlds.
function spiralOnContentEdit(env) {
    const subs = contentSubstrates(env);
    if (subs.length === 0) return env;
    const { id, adapter } = subs[0];
    const key = contentConfigKey(adapter);
    const cfg = env.config?.growthParams?.substrateConfig?.[id] ?? {};
    const beforeId = contentDocId(env.content);
    if (env.content != null && adapter.onContentEdit) {
        env.content = adapter.onContentEdit(env.content);
    }
    const afterId = contentDocId(env.content);
    const doc = env.content ?? cfg[key] ?? null;
    if (isLibrarySourceId(id)) {
        // A library document rides config (no module global); write the edited
        // doc back so ③ generation (which reads config's libraryDoc) sees it.
        const entry = env.config?.growthParams?.substrateConfig?.[id];
        if (entry) entry[key] = doc;
    } else {
        adapter.applyPipelineConfig?.({ ...cfg, [key]: doc });
    }
    if (beforeId !== afterId) {
        env.regions = null;
        env.compile = null;
    }
    return env;
}

// The spiral mode descriptor — the whole per-mode surface the harness needs.
const SPIRAL_DESCRIPTOR = {
    steps: SPIRAL_STEPS,
    runners: RUNNERS,
    present: SPIRAL_STEP_OUTPUT_PRESENT,
    codecs: SPIRAL_CODECS,
    nextStep: nextSpiralStep,
    onContentEdit: spiralOnContentEdit,
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
