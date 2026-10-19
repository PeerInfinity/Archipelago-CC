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
//     editBinding?: <layoutEdits binding>, // optional; see below
//     dropOutputs?: { name: (env) => void }, // optional; see invalidateFromStep
//     kind:     'sphere-envelope' | …,   // the serialized envelope's `kind` stamp
//     fields:   { name: <field def> },   // every top-level key; see THE FIELDS
//   }
//
// THE FIELDS (§5au item 9). `fields` declares every top-level key a serialized
// envelope of this mode may carry, beyond the stamp:
//   { type, visibility: 'public' | 'internal', step: <step name> | null,
//     about, internalKeys?: [<sub-key>, …] }
// `step` is the step that writes it (null: set when the envelope is made);
// a field a step writes may be null or absent before that step runs.
// PUBLIC fields are the inputs and results a script may read and rely on;
// INTERNAL ones are resume state (rng positions, batch cursors, the engine's
// tagged Grid encoding, alias bookkeeping) whose shape may change without an
// envelope_version bump. `internalKeys` marks internal sub-keys of a public
// field (`grow.grid` inside an otherwise public `grow`). `envelopeSchema(desc)`
// turns the table into the JSON Schema published under
// `frontend/schema/envelopes/` — marking is schema-only; the bytes of an
// envelope do not change.
//
// THE STAMP. A serialized envelope opens with `kind` (which mode wrote it) and
// `envelope_version` (ENVELOPE_VERSION). Deserializing REFUSES a stamp that
// names another mode or a newer version (EnvelopeStampError) and strips it
// from the live envelope; an UNSTAMPED object (written before the stamp, or by
// hand) is accepted as before. Bump ENVELOPE_VERSION when an envelope written
// now could not be read by the code that wrote it.
//
// RECORDED LAYOUT EDITS (optional). A descriptor that supplies `editBinding`
// gets the recorded-edit replay for free: after each step runs, every edit in
// `env.edits` whose stage is THAT step is replayed, in list order, before the
// next step starts. That is what makes `runToStep` / `resumeEnvelope` / the
// headless CLIs reproduce a HAND-EDITED world from `config + seed + edits`.
// See layoutEdits.js for the binding contract and the refusal/throw split.
// Byte-identity is unaffected: with `edits` absent or empty the replay returns
// immediately and touches no rng, so an unedited stepped run is still
// byte-for-byte the monolithic driver's output.
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

import { replayLayoutEdits, layoutEditStage } from './layoutEdits.js';

/**
 * Run a single named step over the envelope, mutating + returning it. Async
 * because some steps stream progress (pass opts.onProgress); all resolve to the
 * (same, mutated) env.
 */
export async function runStep(stepName, env, opts, desc) {
    const runner = desc.runners[stepName];
    if (!runner) throw new Error(`runStep: unknown step '${stepName}'`);
    const out = await runner(env, opts);
    replayEditsForStep(out, stepName, desc);
    return out;
}

/**
 * Replay the recorded edits this step is responsible for — called by runStep
 * immediately after the step's own output lands, so the NEXT step (and the
 * compile at the end) sees the hand-edited artifact. Exported for the tests and
 * the CLI; no-op for a descriptor without an editBinding.
 *
 * `binding.replayReady(env, stepName)` is the batch gate: sphere loops its
 * middle four phases per batch, and a layout edit must replay ONCE — after the
 * loop has run that step for the LAST time — not after every batch (a second
 * `move-region` would find its source cell empty and refuse). Modes with a
 * linear walk (top-down) omit it.
 */
export function replayEditsForStep(env, stepName, desc) {
    // Nothing recorded ⇒ nothing runs, not even the mode's gate. This is the
    // byte-identity contract's narrowest statement: an unedited envelope pays
    // one array check per step and takes no other code path.
    if (!Array.isArray(env?.edits) || env.edits.length === 0) return null;
    const binding = desc.editBinding;
    if (!binding) return null;
    if (binding.replayReady && !binding.replayReady(env, stepName)) return null;
    return replayLayoutEdits(env, stepName, binding);
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

/**
 * The recorded edits whose stage sits BEFORE `firstStep` — i.e. the ones a run
 * starting there will NOT replay, because the step that would replay them is
 * not going to run.
 *
 * This is the honest answer to "I added an edit to the envelope JSON by hand and
 * nothing happened": an edit is applied exactly once per PRODUCTION of the
 * artifact it mutates, so a resume that does not re-produce that artifact must
 * not re-apply it (otherwise a panel export — whose edits are already applied —
 * would double-apply on every resume). Re-run from the edit's own stage
 * (`--from <stage>`) and it fires. The CLIs print this list so the no-op is
 * never silent.
 */
export function editsBehindStep(env, firstStep, desc) {
    const binding = desc.editBinding;
    if (!binding || !Array.isArray(env?.edits) || env.edits.length === 0) return [];
    const from = desc.steps.indexOf(firstStep);
    if (from < 0) return [];
    return env.edits.filter((e) => desc.steps.indexOf(layoutEditStage(e, binding)) < from);
}

/**
 * Roll the envelope back so `stepName` — and every step after it — RE-RUNS.
 * Drops each of those steps' outputs (via the descriptor's `dropOutputs`, one
 * entry per step naming the fields that step writes) and rewinds `completed` to
 * just before it, so `runToStep` / `resumeEnvelope` walk forward from there.
 *
 * This is the UNDO path: an edit is un-done not by inverting it but by dropping
 * it from the list and re-running the step that PRODUCES the artifact it
 * mutated — determinism is the guarantee, which is why the undo row's claim is
 * "N edits → undo ×N → the never-edited grid, byte for byte".
 *
 * Dropping matters (it isn't enough to rewind `completed`): sphere's ③ takes a
 * carry-forward path when it finds a grown grid still on the envelope, so a
 * rewind alone would re-run ③ against the EDITED grid instead of a fresh one.
 */
export function invalidateFromStep(env, stepName, desc) {
    const idx = desc.steps.indexOf(stepName);
    if (idx < 0) throw new Error(`invalidateFromStep: unknown step '${stepName}'`);
    for (let i = idx; i < desc.steps.length; i += 1) desc.dropOutputs?.[desc.steps[i]]?.(env);
    env.completed = idx - 1;
    return env;
}

/** The serialized-envelope format version; see THE STAMP in the header. */
export const ENVELOPE_VERSION = 1;

/** A stamped envelope this build cannot read: wrong mode, or a newer version. */
export class EnvelopeStampError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EnvelopeStampError';
        this.code = 'ENVELOPE_STAMP';
    }
}

/** ⛓ A field's visibility (THE FIELDS in the header). */
export const FIELD_VISIBILITY = Object.freeze({ PUBLIC: 'public', INTERNAL: 'internal' });

/**
 * ⛓⛓ THE JSON SCHEMA of one mode's serialized envelope, from its descriptor's
 * `fields` (draft 2020-12). Unknown top-level keys are refused, so a step that
 * starts writing a new field without declaring it fails the schema test.
 * Visibility rides on `x-visibility`; the writing step on `x-step`.
 */
export function envelopeSchema(desc) {
    const stepNames = new Set(desc.steps);
    const properties = {
        kind: { const: desc.kind, description: 'Which mode wrote this envelope.', 'x-visibility': 'public' },
        envelope_version: {
            const: ENVELOPE_VERSION,
            description: 'The envelope format version (bumped when an envelope written now could not be read by '
                + 'the code that wrote it).',
            'x-visibility': 'public',
        },
    };
    for (const [name, f] of Object.entries(desc.fields)) {
        if (!Object.values(FIELD_VISIBILITY).includes(f.visibility)) {
            throw new Error(`envelopeSchema(${desc.kind}): field '${name}' has no visibility`);
        }
        if (f.step !== null && !stepNames.has(f.step)) {
            throw new Error(`envelopeSchema(${desc.kind}): field '${name}' names unknown step '${f.step}'`);
        }
        const types = [].concat(f.type);
        properties[name] = {
            type: f.step === null && !f.nullable ? types : [...types, 'null'],
            description: f.about,
            'x-visibility': f.visibility,
            'x-step': f.step,
            ...(f.internalKeys?.length ? {
                properties: Object.fromEntries(f.internalKeys.map((k) => [k, { 'x-visibility': FIELD_VISIBILITY.INTERNAL }])),
            } : {}),
        };
    }
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: `${desc.kind} (envelope_version ${ENVELOPE_VERSION})`,
        description: `A serialized ${desc.kind}. Fields marked "x-visibility": "internal" are resume state whose shape `
            + 'may change without a version bump; read the public ones.',
        type: 'object',
        required: [...new Set(['kind', 'envelope_version', 'completed',
            ...Object.entries(desc.fields).filter(([, f]) => f.required).map(([n]) => n)])],
        properties,
        additionalProperties: false,
    };
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
    // A deserialized envelope never carries the stamp, but a hand-built one may.
    const { kind: _kind, envelope_version: _version, ...rest } = env;
    const out = { kind: desc.kind, envelope_version: ENVELOPE_VERSION, ...rest };
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
    const { kind, envelope_version: version, ...rest } = obj;
    if (kind != null && kind !== desc.kind) {
        throw new EnvelopeStampError(`this is a '${kind}' envelope, not a '${desc.kind}' one`);
    }
    if (version != null && !(Number.isInteger(version) && version >= 1 && version <= ENVELOPE_VERSION)) {
        throw new EnvelopeStampError(`'${desc.kind}' envelope_version ${JSON.stringify(version)} `
            + `is not one this build reads (1..${ENVELOPE_VERSION})`);
    }
    const out = { ...rest };
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
