// Recorded LAYOUT EDITS for the stepped procgen pipelines.
//
// The composite-grid layout editor (Move Region / Move Exits in the Procgen
// Pipeline panel) and the two scalar per-region gestures (Re-roll 🎲, the
// substrate <select>) used to mutate the live envelope and forget: the edit
// existed only as a difference between the grid on screen and the grid the seed
// produces. An exported envelope carried the mutated grid with no record of WHY
// it differed; re-running the step that PRODUCES the grid silently discarded
// every hand edit; and there was no undo.
//
// This module turns those six gestures into a RECORDED OP LIST on the envelope
// (`env.edits`), so a hand-edited world is `config + seed + edits`:
//
//   - the step runner replays each edit right after the step it addresses
//     (steppedPipeline.js runStep → replayLayoutEdits), so runToStep /
//     resumeEnvelope / the `sphere-step` + `topdown-step` CLIs all reproduce a
//     hand-edited world from the recording alone;
//   - undo = pop the last edit and re-run from that edit's step;
//   - the export carries the list (it is plain JSON, so the envelope codec
//     already ships it — see steppedPipeline.js serializeEnvelope).
//
// ⛔ A replay must consume NO rng. The four layout mutators draw none (they
// relabel + re-stitch), `set-substrate` writes a field, and `re-roll` derives
// its seed from (seed, region_id, n) — n being the count of PRIOR re-rolls of
// that region IN THIS LIST, which is what makes undo correct: pop the edit and
// the next re-roll of that region is n again. With `edits` absent or empty every
// stepped run is byte-identical to the monolithic driver (the byte-identity
// contract; scripts/procgen/dump-*-byteidentity.mjs).
//
// PER-MODE BINDING. Sphere and top-down keep their grids in different envelope
// fields, re-roll through different mechanisms, and — crucially — replay each op
// after a DIFFERENT step, because the two write-back depths differ (see the
// stage tables in sphereSteps.js / topDownSteps.js). So this module stays
// envelope-agnostic and each mode supplies a binding:
//
//   {
//     mode,                       // 'sphere' | 'topDown' (diagnostics only)
//     stages: { op: stepName },   // the step AFTER which each op replays
//     grid(env),                  // the Grid the layout ops address (or null)
//     regionSize(env),            // { width, height } for exit-side relabelling
//     afterLayout(env, grid),     // re-point startCell / resync node cells
//     reRoll(env, edit),          // mode-specific; returns a description
//     setSubstrate(env, edit),    // mode-specific; returns a description
//   }
//
// Every entry point takes (env, …, binding) and returns `{ok, description}` or
// `{ok: false, error}` — the engine mutators already throw BEFORE mutating
// (moveSphereRegion checks occupancy/bounds first, swapSphereExitSides resolves
// both exits first), so a refusal leaves the envelope untouched. `replayLayoutEdits`
// is the one exception: it THROWS on a refusal, because an edit that no longer
// applies means the replayed world differs from the recorded one, and silently
// dropping it would break the determinism the recording exists to provide.

import {
    moveSphereRegion,
    swapSphereRegions,
    moveSphereExitSide,
    swapSphereExitSides,
} from './procgenPipelineEngine.js';

/** Grid sides an exit can sit on. */
const SIDES = Object.freeze(['N', 'S', 'E', 'W']);

const isCell = (v) => !!v && Number.isInteger(v.gx) && Number.isInteger(v.gy);
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isPosInt = (v) => Number.isInteger(v) && v > 0;
const isSide = (v) => SIDES.includes(v);
const cellStr = (c) => `(${c.gx},${c.gy})`;

const PARAM_KINDS = {
    cell: { check: isCell, what: 'a {gx,gy} cell' },
    string: { check: isStr, what: 'a non-empty string' },
    posint: { check: isPosInt, what: 'a positive integer' },
    side: { check: isSide, what: `one of ${SIDES.join('/')}` },
};

/**
 * The op vocabulary — ONE table. The op list, the validator and the panel's
 * history labels are all derived from it, so adding an op means adding a row
 * here and a stage in each mode's binding, nothing else.
 *
 * `kind: 'layout'` ops address the grid through the shared engine mutators;
 * `kind: 'scalar'` ops are per-region facts the mode's binding applies.
 */
// ⚠ The `describe` strings are PAST TENSE and keep the panel's pre-B-d
// wording ("Moved the region", "Swapped the two regions", "Moved exit X to side
// Y", "Swapped exits A ↔ B"): they now ARE the panel's confirmation messages,
// and three hand-run browser verifiers assert on that wording
// (check-topdown-steps-ui.mjs Phase D/E, check-sphere-steps-ui.mjs F/J).
export const LAYOUT_EDIT_SPECS = Object.freeze({
    'move-region': {
        kind: 'layout',
        params: { from: 'cell', to: 'cell' },
        apply: (grid, e) => moveSphereRegion(grid, e.from, e.to),
        describe: (e) => `Moved the region ${cellStr(e.from)} → ${cellStr(e.to)}`,
    },
    'swap-regions': {
        kind: 'layout',
        params: { a: 'cell', b: 'cell' },
        apply: (grid, e) => swapSphereRegions(grid, e.a, e.b),
        describe: (e) => `Swapped the two regions ${cellStr(e.a)} ↔ ${cellStr(e.b)}`,
    },
    'move-exit-side': {
        kind: 'layout',
        params: { cell: 'cell', exitId: 'string', side: 'side' },
        apply: (grid, e, ctx) => moveSphereExitSide(grid, e.cell, e.exitId, e.side, ctx.regionSize),
        describe: (e) => `Moved exit ${e.exitId} to side ${e.side} at ${cellStr(e.cell)}`,
    },
    'swap-exit-sides': {
        kind: 'layout',
        params: { cell: 'cell', exitA: 'string', exitB: 'string' },
        apply: (grid, e, ctx) => swapSphereExitSides(
            grid, e.cell, e.exitA, e.exitB, ctx.regionSize),
        describe: (e) => `Swapped exits ${e.exitA} ↔ ${e.exitB} at ${cellStr(e.cell)}`,
    },
    're-roll': {
        kind: 'scalar',
        params: { region_id: 'string', n: 'posint' },
        describe: (e) => `Re-rolled "${e.region_id}" (#${e.n})`,
    },
    'set-substrate': {
        kind: 'scalar',
        params: { region_id: 'string', substrate: 'string' },
        describe: (e) => `Substrate of "${e.region_id}" → ${e.substrate}`,
    },
});

/** The recorded op names, in vocabulary order. Derived from the spec table. */
export const LAYOUT_EDIT_OPS = Object.freeze(Object.keys(LAYOUT_EDIT_SPECS));

/**
 * Validate an edit's SHAPE and return a plain copy carrying only `op` + the
 * op's declared params (so a stray field can never ride into an exported
 * envelope). Throws on an unknown op or a bad param — shape errors are the
 * caller's bug, not a refusal.
 */
export function normalizeLayoutEdit(edit) {
    const op = edit?.op;
    const spec = LAYOUT_EDIT_SPECS[op];
    if (!spec) {
        throw new Error(`normalizeLayoutEdit: unknown op '${op}' `
            + `(known: ${LAYOUT_EDIT_OPS.join(', ')})`);
    }
    const out = { op };
    for (const [name, kind] of Object.entries(spec.params)) {
        const value = edit[name];
        const { check, what } = PARAM_KINDS[kind];
        if (!check(value)) {
            throw new Error(`normalizeLayoutEdit: ${op}.${name} must be ${what} `
                + `(got ${JSON.stringify(value)})`);
        }
        out[name] = kind === 'cell' ? { gx: value.gx, gy: value.gy } : value;
    }
    return out;
}

/** A one-line human label for the panel's history list / the CLI's log. */
export function describeLayoutEdit(edit) {
    const spec = LAYOUT_EDIT_SPECS[edit?.op];
    return spec ? spec.describe(edit) : `Unknown edit '${edit?.op}'`;
}

/**
 * The step name after which this edit replays, per the mode's binding. Throws
 * for an op the mode declares no stage for (a mode may legitimately not support
 * one — say so by omitting it rather than by silently skipping the edit).
 */
export function layoutEditStage(edit, binding) {
    const stage = binding?.stages?.[edit?.op];
    if (!stage) {
        throw new Error(`layoutEditStage: mode '${binding?.mode ?? '?'}' declares no stage `
            + `for op '${edit?.op}'`);
    }
    return stage;
}

/**
 * Apply ONE edit to the live envelope. Returns `{ok: true, description}` or
 * `{ok: false, error}` — a refusal (an occupied target cell, a side that already
 * has an exit, a maze region that can't be re-rolled) leaves the envelope
 * untouched, because every mutator validates before it writes.
 */
export function applyLayoutEdit(env, edit, binding) {
    let norm;
    try {
        norm = normalizeLayoutEdit(edit);
    } catch (err) {
        return { ok: false, error: err.message };
    }
    const spec = LAYOUT_EDIT_SPECS[norm.op];
    try {
        if (spec.kind === 'scalar') {
            const fn = norm.op === 're-roll' ? binding?.reRoll : binding?.setSubstrate;
            if (typeof fn !== 'function') {
                return {
                    ok: false,
                    error: `mode '${binding?.mode ?? '?'}' has no handler for '${norm.op}'`,
                };
            }
            const description = fn(env, norm) ?? describeLayoutEdit(norm);
            return { ok: true, description };
        }
        const grid = binding.grid(env);
        if (!grid) return { ok: false, error: 'no grid yet — run the layout step first' };
        spec.apply(grid, norm, { regionSize: binding.regionSize(env) });
        binding.afterLayout?.(env, grid);
        return { ok: true, description: describeLayoutEdit(norm) };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

/**
 * Replay every recorded edit whose stage is `stepName`, in list order. Called by
 * the generic runner immediately after that step completes and BEFORE the next
 * one starts. A no-op (and no rng touched) when nothing is recorded — the
 * byte-identity contract.
 *
 * Throws on a refusal: an edit that no longer applies means the replayed world
 * is NOT the recorded one, and the whole point of the recording is that it is.
 */
export function replayLayoutEdits(env, stepName, binding) {
    const edits = env?.edits;
    if (!Array.isArray(edits) || edits.length === 0) return { applied: 0, descriptions: [] };
    const descriptions = [];
    for (let i = 0; i < edits.length; i += 1) {
        const edit = edits[i];
        if (layoutEditStage(edit, binding) !== stepName) continue;
        const r = applyLayoutEdit(env, edit, binding);
        if (!r.ok) {
            throw new Error(`replayLayoutEdits: edit #${i} (${edit?.op}) refused after step `
                + `'${stepName}': ${r.error}`);
        }
        descriptions.push(r.description);
    }
    return { applied: descriptions.length, descriptions };
}

/**
 * Apply an edit NOW and, if it took, RECORD it. This is the panel's path: the
 * gesture's effect is immediate (the grid on screen changes on the click) and
 * the recording is what makes it survive a re-run, an export and an undo.
 * Returns the apply result plus the normalised edit that was recorded.
 */
export function pushLayoutEdit(env, edit, binding) {
    let norm;
    try {
        norm = normalizeLayoutEdit(edit);
    } catch (err) {
        return { ok: false, error: err.message };
    }
    layoutEditStage(norm, binding); // fail fast on an op this mode can't stage
    const r = applyLayoutEdit(env, norm, binding);
    if (!r.ok) return r;
    if (!Array.isArray(env.edits)) env.edits = [];
    env.edits.push(norm);
    return { ...r, edit: norm };
}

/**
 * Pop the last recorded edit. Returns `{edit, index, stage}` (the caller
 * invalidates from `stage` and re-runs — the shorter list then replays), or null
 * when there is nothing to undo. Does NOT touch the envelope's artifacts: the
 * re-run is what un-does the edit, which is exactly why determinism is the
 * guarantee (N edits → undo ×N → the never-edited grid).
 */
export function popLayoutEdit(env, binding) {
    if (!Array.isArray(env?.edits) || env.edits.length === 0) return null;
    const index = env.edits.length - 1;
    const edit = env.edits.pop();
    return { edit, index, stage: layoutEditStage(edit, binding) };
}

/**
 * How many times `region_id` has ALREADY been re-rolled in this list — so the
 * next re-roll's `n` is `reRollCountFor(...) + 1`. Derived from the recording,
 * never from a session-side counter: that is what makes undo correct (pop the
 * edit and the next re-roll of that region is n again, reproducing the same
 * world) and what lets a LOADED envelope keep counting where it left off.
 */
export function reRollCountFor(edits, regionId) {
    if (!Array.isArray(edits)) return 0;
    let n = 0;
    for (const e of edits) if (e?.op === 're-roll' && e.region_id === regionId) n += 1;
    return n;
}

/** 32-bit string hash — the panel's re-roll seed mixer, lifted verbatim. */
export function hashRegionId(s) {
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
    return h;
}

/**
 * The sphere re-roll seed. Lifted VERBATIM from the panel's `_reRollRegion`
 * (procgenPipelineUI.js) — it was already pure in (seed, region_id, n); only its
 * LOCATION was the panel, and a per-click `_rerollCounts` Map supplied the n.
 * Deriving n from the edit list instead makes the same formula reproducible from
 * the recording. Byte-inert for every committed fixture: none carries a re-roll.
 */
export function deriveSphereRerollSeed(seed, regionId, n) {
    return ((seed * 7919) ^ hashRegionId(regionId)) + n * 104729 | 0;
}

/**
 * The top-down re-roll's sub-seed bump, lifted verbatim from the panel's
 * `_reRollRegionTD`. XORs the CURRENT sub-seed, so two re-rolls of one region
 * compose in list order — deterministic given the list, which is what the replay
 * reproduces.
 */
export function bumpTopDownSubSeed(subSeed, n) {
    return (subSeed ^ (0x9e3779b9 + n * 0x55555555)) >>> 0;
}
