// Shared step-runner for the stepped TOP-DOWN pipeline.
//
// Mirrors sphereSteps.js: the Procgen Pipeline panel (and, later, a headless
// `topdown-step` CLI) drive the four top-down steps through this one module, so
// the step wiring (rng threading, buildRulesJson opts) lives in ONE place and
// can't drift between the two.
//
// The four steps map onto topDownFromRulesJson's phases (the source rules.json
// is read-only, so there is no editable "plan" step like sphere-growth has):
//
//   ① layout   — layoutTopDown: BFS-place each source region in a grid cell.
//                Consumes rng (fallback-cell placement).
//   ② realise  — realiseTopDownGen: per-region substrate realisation. A
//                generator, drained here with an `await setTimeout(0)` yield so
//                the panel's progress indicator repaints per region. Consumes rng.
//   ③ finalize — finalizeTopDown: teleporters, back-exits, finalize + wall-off,
//                entrance resolution, sphere-log metadata. rng-free.
//   ④ compile  — buildRulesJson: the rules.json + procgen metadata. rng-free.
//
// The unit of state is a plain "envelope" — the panel's `_tdState` — that each
// step reads from and merges into. Phase 2 keeps it session-only (live Grid /
// rng objects); a serialisable codec for the CLI lands in Phase 3.
//
// Byte-identity: running all four steps reproduces the monolithic
// topDownFromRulesJson + buildRulesJson output exactly (the rng is created in ①
// and threaded live through ②; ③/④ draw none). See scripts/procgen/
// verify-topdown-steps.mjs.

import { createRng } from '../shared/rng.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import {
    layoutTopDown,
    realiseTopDownGen,
    finalizeTopDown,
    buildRulesJson,
    computeSourceCounts,
    serializeGrid,
    deserializeGrid,
} from './procgenPipelineEngine.js';
// Generic stepped-pipeline machinery — the driver/resume/serde skeleton shared
// with sphere (and spiral). This module supplies the top-down DESCRIPTOR; the
// harness drives it. See steppedPipeline.js for the descriptor + codec contract.
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
export const TOPDOWN_STEPS = Object.freeze(['layout', 'realise', 'finalize', 'compile']);

// ① — BFS placement + per-region substrate/sub-seed assignment. The rng (BFS
// fallback draws + substrate picks) is recorded on the envelope for completeness;
// ② does NOT consume it (each region realises from its own sub-seed), so re-running
// ② after a hand-edit is deterministic without any rng restore.
function stepLayout(env) {
    const rng = createRng(env.opts.seed ?? 1);
    env.layout = layoutTopDown(env.source, env.opts, rng);
    env.rng = rng;
    env.completed = 0;
    return env;
}

// ② — per-region realisation. Drains the generator, forwarding each region
// progress event and yielding to the event loop so the UI can repaint. The grid
// is mutated in place (it IS env.layout.grid). Consumes no shared rng — each
// region uses a fresh rng seeded from layout.subSeedByRegion[name].
async function stepRealise(env, { onProgress = null } = {}) {
    // A 'plan'-shaped lead event lets the indicator show the region total up
    // front (spheres is 0 — top-down has no sphere plan unless a log enriches it).
    onProgress?.({ type: 'plan', regions: env.layout.stats.regionsTotal, spheres: 0 });
    const gen = realiseTopDownGen(env.layout, env.opts);
    let r = gen.next();
    while (!r.done) {
        onProgress?.(r.value);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => { setTimeout(resolve, 0); });
        r = gen.next();
    }
    env.realise = { grid: env.layout.grid };
    env.completed = 1;
    return env;
}

// ③ — rng-free post-passes. Quick; emit a single 'phase' event so a lingering
// indicator reads "Finalizing" rather than the last region.
function stepFinalize(env, { onProgress = null } = {}) {
    onProgress?.({ type: 'phase', name: 'teleporters + back-exits + entrances' });
    env.finalize = finalizeTopDown(env.layout);
    env.completed = 2;
    return env;
}

// ④ — buildRulesJson + procgen metadata. Reads the UI-precomputed inputs on
// env.compileIn (granted ability items, starting items, source defs, flags) so
// the runner stays self-contained for the CLI. Mirrors the panel's old inline
// _runTopDown compile tail exactly.
function stepCompile(env, { onProgress = null } = {}) {
    onProgress?.({ type: 'phase', name: 'compile rules.json' });
    const c = env.compileIn;
    const {
        grid, startCell, stats, sphereTree, spherePlan, attributionWarnings,
    } = env.finalize;
    const enriched = !!(c.sphereLog && sphereTree && spherePlan);
    const rulesJson = buildRulesJson(grid, {
        startCell,
        seed: c.seed,
        enableLoopMode: !!c.enableLoopMode,
        regionXpEffect: c.regionXpEffect ?? 'cost',
        assumeBidirectional: c.assumeBidirectional,
        startingItems: c.startingItems,
        // Embed the AUTHORITATIVE log verbatim so loop_costs reflect real AP logic.
        ...(enriched ? { sphereLog: c.sphereLog } : {}),
        // Granted ability items are placed at no location, so synthesise defs
        // (ids 999↓ stay clear of the compiled pool's upward numbering).
        sourceItems: {
            ...c.sourceItemDefs,
            ...Object.fromEntries((c.grantedItems ?? []).map((name, i) => [name, {
                name,
                id: 999 - i,
                classification: 'progression',
                groups: ['Everything'],
            }])),
        },
        procgenMetadata: {
            driver: enriched ? 'top-down-sphere' : 'top-down',
            source_game: c.sourceGameName ?? null,
            source_counts: computeSourceCounts(env.source, '1'),
            stop_reason: stats.stopReason,
            ...(enriched ? { sphere_tree: sphereTree, sphere_plan: spherePlan } : {}),
        },
    });
    env.compile = { rulesJson, enriched, attributionWarnings: attributionWarnings ?? [] };
    env.completed = 3;
    return env;
}

const RUNNERS = {
    layout: stepLayout,
    realise: stepRealise,
    finalize: stepFinalize,
    compile: stepCompile,
};

/** The next step to run given the envelope's `completed` index; null when done.
 *  Top-down is a trivial linear +1 walk (no batching), the descriptor's loop. */
export function nextTopDownStep(env) {
    const completed = env.completed ?? -1;
    return completed < TOPDOWN_STEPS.length - 1 ? TOPDOWN_STEPS[completed + 1] : null;
}

/** A fresh envelope for a pre-assembled config block (opts + compileIn). */
export function newTopDownEnvelope({ source, opts, compileIn, regionSize }) {
    return newEnvelopeGeneric({ source, opts, compileIn, regionSize });
}

/**
 * Build a top-down envelope from a source rules.json + already-assembled inputs
 * (substrate mix, regionParams, hazardOpts, sphereLog). Shared by the panel
 * (_buildTDEnvelope) and the CLI so the preamble — granting each in-mix
 * substrate's ability items as FREE starting items, and packing the engine opts
 * + compile inputs — lives in ONE place. `regionParams` is wrapped with the
 * top-down default `{ maxIterations: 0 }` (open maze rooms).
 */
export function buildTopDownEnvelope({
    source, seed = 1, gridDims, regionSizeBase,
    substrateMix = null, regionParams = null, hazardOpts = null,
    sphereLog = null, enableLoopMode = false, regionXpEffect = 'cost',
}) {
    const sourceStarting = source?.starting_items?.['1'] ?? [];
    const sourceItemDefs = source?.items?.['1'] ?? {};
    const grantedItems = [];
    for (const [id, weight] of Object.entries(substrateMix ?? {})) {
        if (!(Number(weight) > 0)) continue;
        const lib = substrateRegistry.get(id)?.libraryItems;
        if (!lib) continue;
        for (const [name, def] of Object.entries(lib)) {
            if (def?.is_victory) continue;
            if (sourceItemDefs[name] != null) continue;
            if (sourceStarting.includes(name) || grantedItems.includes(name)) continue;
            grantedItems.push(name);
        }
    }
    const startingItems = [...sourceStarting, ...grantedItems];
    const resolvedLog = sphereLog
        ?? (Array.isArray(source?.sphere_log) ? source.sphere_log : null);
    return newTopDownEnvelope({
        source,
        regionSize: regionSizeBase,
        opts: {
            gridDims,
            regionSizeBase,
            seed,
            ...(substrateMix ? { substrateMix } : {}),
            ...(resolvedLog ? { sphereLog: resolvedLog } : {}),
            hazardOpts,
            freeItems: startingItems,
            regionParams: { maxIterations: 0, ...(regionParams ?? {}) },
        },
        compileIn: {
            seed,
            enableLoopMode,
            regionXpEffect,
            assumeBidirectional: source?.assume_bidirectional_exits !== false,
            startingItems,
            grantedItems,
            sourceItemDefs,
            sourceGameName: source?.game_name ?? null,
            sphereLog: resolvedLog,
        },
    });
}

// --- envelope (de)serialisation codecs (for the headless CLI) ----------
//
// Most of the envelope is plain JSON (config, opts, compileIn, stats, plans, the
// compiled rules.json) and rides the harness's spread. The non-JSON members get
// a codec: the live rng, the Grid + two Maps on the layout, and the grid ALIASES.
// realise/finalize alias the SAME grid object as layout — drop it on encode and
// reconnect the SAME decoded grid on decode (layout is declared first, so
// out.layout is decoded when realise/finalize decode runs). sourceRegions aliases
// source.regions[playerId] — dropped + rebuilt from source on decode (no need to
// duplicate the source in the envelope). See steppedPipeline.js for the contract.
const TD_CODECS = {
    rng: {
        encode: (rng) => (typeof rng.getState === 'function' ? { s: rng.getState() } : rng),
        decode: (r) => {
            if (r?.s === undefined) return r;
            const rng = createRng(0);
            rng.setState(r.s);
            return rng;
        },
    },
    layout: {
        encode: (layout) => {
            const L = { ...layout };
            if (L.grid) L.grid = serializeGrid(L.grid);
            if (L.cellsByName instanceof Map) L.cellsByName = [...L.cellsByName];
            if (L.exitSidesByExit instanceof Map) L.exitSidesByExit = [...L.exitSidesByExit];
            L.sourceRegions = undefined; // rebuilt from source on decode
            return L;
        },
        decode: (layout, out, obj) => {
            const L = { ...layout };
            if (L.grid) L.grid = deserializeGrid(L.grid);
            if (Array.isArray(L.cellsByName)) L.cellsByName = new Map(L.cellsByName);
            if (Array.isArray(L.exitSidesByExit)) L.exitSidesByExit = new Map(L.exitSidesByExit);
            L.sourceRegions = obj.source?.regions?.[L.playerId ?? '1'] ?? {};
            return L;
        },
    },
    realise: {
        encode: (realise) => ({ ...realise, grid: undefined }),
        decode: (realise, out) => ({ ...realise, grid: out.layout?.grid }),
    },
    finalize: {
        encode: (finalize) => ({ ...finalize, grid: undefined }),
        decode: (finalize, out) => ({ ...finalize, grid: out.layout?.grid }),
    },
};

// Whether each step's OUTPUT is present in an envelope — used to derive the
// resume point from data presence (a hand-edited/partial envelope resumes from
// the first step whose output is missing). presence = keep, absence = recompute.
const TD_STEP_OUTPUT_PRESENT = {
    layout: (e) => !!e.layout,
    realise: (e) => !!e.realise,
    finalize: (e) => !!e.finalize,
    compile: (e) => !!e.compile,
};

// The top-down mode descriptor — the whole per-mode surface the harness needs.
const TD_DESCRIPTOR = {
    steps: TOPDOWN_STEPS,
    runners: RUNNERS,
    present: TD_STEP_OUTPUT_PRESENT,
    codecs: TD_CODECS,
    nextStep: nextTopDownStep,
};

// --- public API (stable names/signatures; delegate to the shared harness) ---

/**
 * Run a single named step over the envelope, mutating + returning it. Async
 * because ② streams progress (pass opts.onProgress). All steps resolve to the
 * (same, mutated) env.
 */
export async function runTopDownStep(stepName, env, opts = {}) {
    return runStepGeneric(stepName, env, opts, TD_DESCRIPTOR);
}

/** Run steps from the current point through `toStep` (default: to completion). */
export async function runTopDownToStep(env, toStep = 'compile', opts = {}) {
    return runToStepGeneric(env, toStep, opts, TD_DESCRIPTOR);
}

/** Live envelope → JSON-safe plain object. */
export function serializeTDEnvelope(env) {
    return serializeEnvelopeGeneric(env, TD_DESCRIPTOR);
}

/** JSON-safe plain object (from serializeTDEnvelope) → live envelope. */
export function deserializeTDEnvelope(obj) {
    return deserializeEnvelopeGeneric(obj, TD_DESCRIPTOR);
}

/** The `completed` index (last contiguously-finished step) from data presence. */
export function detectTDCompleted(env) {
    return detectCompletedGeneric(env, TD_DESCRIPTOR);
}

/** Resume to `toStep` from the first step whose output is missing. */
export async function resumeTDEnvelope(env, toStep = 'compile', opts = {}) {
    return resumeEnvelopeGeneric(env, toStep, opts, TD_DESCRIPTOR);
}
