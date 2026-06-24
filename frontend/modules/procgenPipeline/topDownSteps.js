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
import {
    layoutTopDown,
    realiseTopDownGen,
    finalizeTopDown,
    buildRulesJson,
    computeSourceCounts,
} from './procgenPipelineEngine.js';

/** Step names in run order; index === the `completed` value the step yields. */
export const TOPDOWN_STEPS = Object.freeze(['layout', 'realise', 'finalize', 'compile']);

// ① — BFS placement. Creates the rng from the seed and leaves it live on the
// envelope at its post-layout position for ② to consume.
function stepLayout(env) {
    const rng = createRng(env.opts.seed ?? 1);
    env.layout = layoutTopDown(env.source, env.opts, rng);
    env.rng = rng;
    env.completed = 0;
    return env;
}

// ② — per-region realisation. Drains the generator, forwarding each region
// progress event and yielding to the event loop so the UI can repaint. The grid
// is mutated in place (it IS env.layout.grid).
async function stepRealise(env, { onProgress = null } = {}) {
    // A 'plan'-shaped lead event lets the indicator show the region total up
    // front (spheres is 0 — top-down has no sphere plan unless a log enriches it).
    onProgress?.({ type: 'plan', regions: env.layout.stats.regionsTotal, spheres: 0 });
    const gen = realiseTopDownGen(env.layout, env.opts, env.rng);
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

/**
 * Run a single named step over the envelope, mutating + returning it. Async
 * because ② streams progress (pass opts.onProgress). All steps resolve to the
 * (same, mutated) env.
 */
export async function runTopDownStep(stepName, env, opts = {}) {
    const runner = RUNNERS[stepName];
    if (!runner) throw new Error(`runTopDownStep: unknown step '${stepName}'`);
    return runner(env, opts);
}

/** The next step to run given the envelope's `completed` index; null when done. */
export function nextTopDownStep(env) {
    const completed = env.completed ?? -1;
    return completed < TOPDOWN_STEPS.length - 1 ? TOPDOWN_STEPS[completed + 1] : null;
}

/** Run steps from the current point through `toStep` (default: to completion). */
export async function runTopDownToStep(env, toStep = 'compile', opts = {}) {
    if (TOPDOWN_STEPS.indexOf(toStep) < 0) {
        throw new Error(`runTopDownToStep: unknown step '${toStep}'`);
    }
    let step = nextTopDownStep(env);
    while (step) {
        // eslint-disable-next-line no-await-in-loop
        await runTopDownStep(step, env, opts);
        if (step === toStep) break;
        step = nextTopDownStep(env);
    }
    return env;
}

/** A fresh envelope for a pre-assembled config block (opts + compileIn). */
export function newTopDownEnvelope({ source, opts, compileIn, regionSize }) {
    return {
        completed: -1, source, opts, compileIn, regionSize,
    };
}
