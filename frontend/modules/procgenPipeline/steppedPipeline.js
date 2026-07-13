// Shared orchestration for the stepped procgen pipelines.
//
// Sphere-growth, top-down, and (soon) shuffled-spiral all run as a sequence of
// discrete, inspectable, editable steps over a plain "envelope" object. The
// per-mode files (sphereSteps.js / topDownSteps.js / spiralSteps.js) supply the
// step LOGIC — the runners, presence probes, the loop shape, and the non-plain
// artifact codecs — bundled into a MODE DESCRIPTOR; this module provides the
// generic machinery that drives any descriptor. Before this existed, sphere and
// top-down each re-implemented the identical driver/resume/serde skeleton; now
// it lives once.
//
// The descriptor (one per mode):
//
//   {
//     steps:    [name, ...],             // ordered; index === the `completed`
//                                        //   value a step yields
//     runners:  { name: (env, opts) => env | Promise<env> },
//     present:  { name: (env) => bool }, // is this step's OUTPUT present?
//     codecs:   { field: { encode(value, env), decode(value, out, obj) } },
//     nextStep: (env) => name | null,    // the loop shape (linear or batched)
//   }
//
// The codec surface — why encode/decode take context and run in ORDER:
//   Most of an envelope is plain JSON and rides the `{ ...env }` spread. Only the
//   non-plain artifacts need a codec: live rng objects, the Grid, Sets/Maps, and
//   — crucially — CROSS-FIELD ALIASES. Both existing modes carry one live object
//   referenced from several fields: top-down's single Grid is aliased by
//   layout.grid / realise.grid / finalize.grid (it is mutated in place across the
//   steps, so the decoded envelope MUST reconnect the SAME object, not clone it),
//   and sphere's `tree.nodes` aliases `env.nodes`. A per-field codec can't rebuild
//   an alias alone, so `decode(value, out, obj)` receives the envelope built so far
//   (`out`, with earlier fields already decoded) plus the raw input (`obj`), and
//   codecs are applied in DECLARATION ORDER — declare a field's dependency first
//   (nodes before tree; layout before realise/finalize) and its decode can read the
//   decoded dependency off `out`. `encode(value, env)` gets the live envelope for
//   symmetry (e.g. reading a sibling field while serializing).
//
// Byte-identity: this module only relocates the orchestration WRAPPER — it never
// runs a step's logic or touches an rng draw. The per-mode runner logic and draw
// order are what guarantee byte-for-byte reproduction of the monolithic drivers;
// the guards (sphereSteps.test.js, scripts/procgen/verify-*.mjs,
// dump-*-byteidentity.mjs) hold the line.

/**
 * Run a single named step over the envelope, mutating + returning it. Async
 * because some steps stream progress (pass opts.onProgress); all resolve to the
 * (same, mutated) env.
 */
export async function runStep(stepName, env, opts, desc) {
    const runner = desc.runners[stepName];
    if (!runner) throw new Error(`runStep: unknown step '${stepName}'`);
    return runner(env, opts);
}

/**
 * Run steps via the descriptor's nextStep — which may loop the middle phases
 * (sphere's per-batch growth) or advance linearly (top-down) — stopping once
 * `toStep` has just run. For a looping phase that's the FIRST time it runs;
 * resume the returned env to continue the loop. Returns the env.
 */
export async function runToStep(env, toStep, opts, desc) {
    if (desc.steps.indexOf(toStep) < 0) throw new Error(`runToStep: unknown step '${toStep}'`);
    let step = desc.nextStep(env);
    while (step) {
        // eslint-disable-next-line no-await-in-loop
        await runStep(step, env, opts, desc);
        if (step === toStep) break;
        step = desc.nextStep(env);
    }
    return env;
}

/**
 * Derive the `completed` index (last CONTIGUOUSLY-finished step) from which step
 * outputs are present in `env`. Returns -1 when nothing is present (resume point
 * = detectCompleted + 1 = the first step to run). A gap stops the walk: data
 * after the first missing step is stale and gets overwritten on the next forward
 * run. Mental model: presence = keep, absence = recompute.
 */
export function detectCompleted(env, desc) {
    let n = 0;
    for (const step of desc.steps) {
        if (desc.present[step](env)) n += 1;
        else break;
    }
    return n - 1;
}

/**
 * Resume an envelope to `toStep` (or completion), starting from the first step
 * whose output is missing — no manual step selection. Normalises `env.completed`
 * from data presence first.
 */
export async function resumeEnvelope(env, toStep, opts, desc) {
    env.completed = detectCompleted(env, desc);
    return runToStep(env, toStep, opts, desc);
}

/** A fresh envelope for the given initial fields; `completed: -1` = nothing run. */
export function newEnvelope(initialFields) {
    return { ...initialFields, completed: -1 };
}

/**
 * Live envelope → JSON-safe plain object. Plain fields ride the `{ ...env }`
 * spread; each declared codec field is replaced by its `encode(value, env)`
 * (skipped when the field is null/undefined so absent artifacts stay absent).
 */
export function serializeEnvelope(env, desc) {
    const out = { ...env };
    for (const [field, codec] of Object.entries(desc.codecs ?? {})) {
        if (env[field] != null && codec.encode) out[field] = codec.encode(env[field], env);
    }
    return out;
}

/**
 * JSON-safe plain object → live envelope. Codecs run in DECLARATION ORDER so a
 * field's `decode(value, out, obj)` can read an earlier field's decoded value off
 * `out` (the alias-reconnection contract; see the module header).
 */
export function deserializeEnvelope(obj, desc) {
    const out = { ...obj };
    for (const [field, codec] of Object.entries(desc.codecs ?? {})) {
        if (obj[field] != null && codec.decode) out[field] = codec.decode(obj[field], out, obj);
    }
    // Restamp seam (② content). A substrate whose ② step emits an editable
    // dataset supplies `onContentEdit(env) → env` so a HAND-EDITED content
    // document re-runs the substrate's validator + identity restamp on load
    // (content-hash → new dataset id), keeping a (seed, id) cache / id-keyed save
    // slot from being poisoned by an edited-but-same-id document. Idempotent
    // (unchanged content → unchanged id), so calling it on every decode is safe.
    // No current descriptor sets it (all ② steps are no-ops); JtA wires it in
    // Part 3. See docs/json/developer/procgen/stepped-pipeline.md and the
    // spiralSteps ② content design.
    return desc.onContentEdit ? desc.onContentEdit(out, obj) : out;
}
