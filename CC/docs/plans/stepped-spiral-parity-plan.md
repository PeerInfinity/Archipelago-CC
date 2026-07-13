# Stepped-pipeline parity for shuffled-spiral (+ cross-mode dedup)

**Date:** 2026-07-12 · **Status: PLAN — ready for a fresh session. No code
yet.** Design confirmed with the user this session; this doc is written while
the ground-truth map of all three pipeline modes is hot so a fresh,
pipeline-focused session can execute against it.

## 0. Why this exists (the re-sequencing)

JtA post-v1 **Phase B** (design doc `jta-synthetic-post-v1-design.md` §6) wants
an *editable dataset artifact on a pipeline envelope* with presence-based
invalidation + restamp-on-edit — the stepped-pipeline convention. But that
machinery lives ONLY in **sphere-growth** and **top-down**; every JtA preset
runs on **shuffled-spiral**, which is **monolithic** (`arrangeShuffledSpiral` →
`buildRulesJson`, one shot, no envelope, no steps). That mismatch forced Phase
B's original ②d placement "as a sphere-mode step" + a `generateZoneForSpecs`
detour to drag JtA (a *linear* v1 substrate) through sphere-tree growth just to
earn an envelope.

**User ruling (2026-07-12):** first bring shuffled-spiral up to stepped-pipeline
parity with the other two modes. Then Phase B's ②d "content" step lands on
JtA's *actual* path, `generateZoneForSpecs`-into-sphere-growth becomes
optional/deferred, and the two-surface tension dissolves. The design doc's
rulings were explicitly "accept as blanket; surface if implementation proves one
wrong" — this is that surfacing (the ②d *sphere-mode* placement was an artifact
of spiral's second-class status, not a real requirement).

**Additional user requirements (2026-07-12):**
- Full parity is the goal; fall back to **parity essentials** only if a
  complication forces it.
- **Minimize duplicated code across the three modes; deduplicate what already
  exists between sphere + top-down.** This reshapes the work from "add a third
  step-runner file" into "extract the shared orchestration once; make all three
  modes thin clients." Now is the right time to factor (three concrete
  instances = the rule-of-three threshold; the abstraction boundary is already
  visible in the two existing files).
- This session stays **JtA-agnostic**, but the ② content step is *designed for*
  known JtA needs so the later Phase-B wiring is pure wiring, not a redesign.

Parking-lot (separate future session, user-raised): **reevaluate the whole
"zone" concept** — audit what is unimplemented vs obsolete across
`zoneCount` / `synthesizeZonePayload` / `extractZoneRules` /
`generateZoneForSpecs` and the spiral-vs-sphere zone assumptions. Some of this
audit surfaces naturally during Part 2 below.

---

## 1. Ground facts (verified this session; cites are current HEAD)

Module dir: `frontend/modules/procgenPipeline/`. Emoji in the UI source —
**use `LC_ALL=C grep` / `grep -a` / the Grep tool** (plain grep silently
fails; memory: emoji-grep pitfall).

### 1a. The two existing stepped modes share ONE pattern, duplicated

Both `sphereSteps.js` and `topDownSteps.js` implement the same orchestration as
**three parallel structures keyed by step name** + a driver + resume + a codec.
There is no `{id, run, detectCompleted, clearDownstream}` descriptor object
today — that is what we introduce.

`sphereSteps.js` (6 steps `plan → allocate → topology → items → regions →
compile`):
- `SPHERE_STEPS` ordered list `:65-67` (array index === the `completed` value a
  step yields — hardcoded literals in each runner).
- `RUNNERS` map `:452-459`; dispatch `runStep(stepName, env, opts)` `:467-471`.
- `STEP_OUTPUT_PRESENT` presence probes `:603-610`; `detectCompleted(env)`
  contiguous walk `:619-626` (counts present-in-order, stops at first gap;
  "presence = keep, absence = recompute", comment `:598-602`).
- `nextSphereStep(env)` `:489-497` — **the loop shape**: linear by `completed+1`
  for indices <4, then after ③ loops back to `allocate` while
  `batchStart < waves`, else falls to `compile`.
- `runToStep` / `resumeEnvelope` `:505-515`, `:633-636`; `newEnvelope(config)`
  `:594-596`; `serializeEnvelope`/`deserializeEnvelope` `:534-570` (handles the
  non-plain artifacts: node `usedSides` Sets, the `Grid`, the `placed` Set, rng
  `{s}` snapshots; note `env.tree.nodes` aliases `env.nodes` — deliberately not
  double-emitted, re-aliased on decode `:537-544`).
- Runner fns: `stepPlan :134-173`, `stepAllocate :196-229`,
  `stepTopology :238-280`, `stepItems :285-295`, `stepRegions :304-414` (async
  generator — streams progress), `stepCompile :416-450`. Each mutates+returns
  the envelope, nulls downstream fields imperatively (e.g. `stepPlan :146-171`
  nulls everything downstream), and sets `env.completed`.

`topDownSteps.js` (4 steps `layout → realise → finalize → compile`) — the
**cleaner mirror**, best template for the harness: `TOPDOWN_STEPS :42`,
`RUNNERS :130-135`, `TD_STEP_OUTPUT_PRESENT :287-292`,
`nextTopDownStep :149-152` (trivial linear +1 — no loop).

**What genuinely differs per mode (the descriptor surface):** (1) the step list
+ runner fns; (2) the presence probes; (3) the non-plain artifact codecs in
serialize/deserialize; (4) the loop shape (`nextStep`). Everything else —
`detectCompleted`, `runStep`, `runToStep`, `resumeEnvelope`, `newEnvelope`, the
serialize/deserialize skeleton — is generic and duplicated.

### 1b. The monolithic spiral driver we must preserve byte-for-byte

- `arrangeShuffledSpiral(config)` `procgenPipelineEngine.js:3013` (~`:3170`):
  validate each substrate has `generateRegionCore` OR numeric `zoneCount`
  (`:3049-3062`); spiral-walk cells from center, per cell either
  `synthesizeZoneRegion(...)` (zone substrates, `:3115-3116`) or the procedural
  region build; `stitchGrid`; `wallOffUnusedExits`. Returns
  `{ grid, pool, stats, startCell }`.
- `synthesizeZoneRegion` `:2468-2480` calls `adapter.extractZoneRules(zoneIdx,
  ctx)` + `adapter.synthesizeZonePayload(zoneIdx)` → `assembleZoneRegion`
  `:2487-2556` (the SHARED region-assembly tail also used by the sphere-growth
  `generateZoneForSpecs` result).
- Panel entry `_runShuffledSpiral` `procgenPipelineUI.js:3759-3799` — **passes
  `regionParams: {}` and applies ZERO substrate config**; then `buildRulesJson`.
  (Contrast `_runSphereGrowth :3991`, `_runTopDownAll`, mode dispatch
  `:3610-3623`.) So today the panel can't even turn on JtA location emission,
  let alone a dataset — confirms the "setJtaX are CLI/test-only globals" memory.
- CLIs: `scripts/procgen/sphere-step.js`, `topdown-step.js` (spiral has none).
- `rebuildEnvelopeFromRulesJson` (engine) reconstructs a sphere envelope from a
  compiled `rules.json` via `procgen_metadata.sphere_tree` + `preset_sidecars`
  — the "re-editable compiled world" affordance (full-parity item for spiral).

### 1c. Substrate config → engine bundle (how ② content will read knobs)

`sphereConfigHooks.js`: `defaultProcgenParams(base) :23-29`,
`activeSubstrateIds :36-43`, `collectSphereGrowthPrep :52-82` (per-substrate
pre-plan: starting items / exclusiveSpheres / canonical locks / itemPoolDelta /
regionParams additions), **`assembleRegionParams({activeIds, mode, params,
extra}) :89-97`** (per-substrate `buildRegionParams({params, mode})` →
one `regionParams` object), `mergeSubstrateItemLib :103-110`,
`resolveVictoryItem :117-126`. Preset state shape `presetDefs.js:6-8`
(`{ mode, params, scenario, substrateMix, substrateQuotas, substrateMode }`;
per-substrate knobs live FLAT in `params`); `capturePresetState :242-248`,
`applyPresetState :266-293`; the JtA demo preset `:176-199` (`mode:
shuffledSpiral`, `substrateQuotas:{jta:15}`, vanilla tables, no locations).

---

## 2. The dedup target — a shared stepped-pipeline harness

Introduce `frontend/modules/procgenPipeline/steppedPipeline.js` (name TBD;
`stepRunner.js` acceptable) exposing a generic engine parameterized by a
**mode descriptor**:

```js
// descriptor (one per mode)
{
  steps:   ['①','②',...],                 // ordered names; index = completed value
  runners: { name: (env, opts) => env },  // may be async / async-generator
  present: { name: (env) => bool },        // presence probe
  codecs:  { field: {encode, decode} },    // non-plain artifacts only
  nextStep: (env) => name | null,          // the loop shape (linear or batched)
}
```

Generic engine provided once: `detectCompleted(env, desc)`,
`runStep(name, env, opts, desc)`, `runToStep(target, env, opts, desc)`,
`resumeEnvelope(env, opts, desc)`, `newEnvelope(config, desc)`,
`serializeEnvelope(env, desc)` / `deserializeEnvelope(obj, desc)` (skeleton
walks `codecs`; plain fields pass through). Sphere's per-batch loop is NOT a
special case in the engine — it lives entirely in sphere's `nextStep`, which is
exactly where it lives today.

Sphere / top-down / spiral each shrink to: their step list, their runner fns
(unchanged logic), their probes, their codecs, their `nextStep`. The panel and
the per-mode CLIs call the generic engine with the mode's descriptor.

**Watch:** the runner *logic* and rng draw order are what guarantee
byte-identity — the harness only relocates the *orchestration wrapper*, so
extraction must not reorder or add/drop any rng draw or any field write. The
existing guards (below) are the safety net.

---

## 3. The arc (each part independently landable; commit sub-steps separately)

> Git discipline: commit directly to `main` (this project's convention);
> **explicit `git add <paths>` only — never `-A`** (omsi-stats commits to `main`
> concurrently; never stage `frontend/modules/omsi-loops` or
> `CC/scripts/omsi-stats/*`). Push only when the user asks.

### Part 1 — Extract the harness; migrate the two existing modes onto it
Pure dedup, **zero output change**. `sphereSteps.js` and `topDownSteps.js`
become descriptor + runners over `steppedPipeline.js`; public exports they
already provide stay stable (panel + CLIs import them). 
**Acceptance gate:** every existing guard green with NO byte diff —
`sphereSteps.test.js`, `topDownSteps` coverage, `scripts/procgen/verify-topdown-steps.mjs`,
`dump-*-byteidentity.mjs`, `verify-procgen-presets.mjs`, the full vitest suite.
**This is the fallback trigger:** if sphere's batch loop (or the async-generator
`stepRegions` progress streaming) resists clean generalization, STOP the dedup,
keep the two modes as-is, and build spiral standalone (Part 2) mirroring
`topDownSteps.js` — deferring cross-mode dedup to a follow-up. Record the
blocker in this doc.

### Part 2 — Spiral as the third client (the parity work)
New `spiralSteps.js` descriptor + runners over the harness. Proposed step split
(same altitudes as the other modes):

| Step | Does | Editable artifact |
|---|---|---|
| ① **arrange** | resolve quotas/seed/start-substrate; compute the spiral zone→cell assignment (placement plan) | the placement plan |
| ② **content** | zone substrates synthesize their per-zone data — **no-op for every current substrate** (byte-identical); JtA's dataset lands here in Part 3 | `env.<sub>Content` (restampable) |
| ③ **regions** | spiral-walk region synthesis (`synthesizeZoneRegion`) + `stitchGrid` + `wallOffUnusedExits` → grid | grid (structural/tagged — not hand-edited) |
| ④ **compile** | `buildRulesJson` | — |

Deliverables: the four runners; panel wiring (`_runShuffledSpiral` becomes the
"run all steps" path + per-step buttons like the other modes; the mode is
already in the UI radio set + `VALID_MODES`); a `scripts/procgen/spiral-step.js`
CLI; region-editor registration (largely free — spiral already emits the same
region descriptors the `regionEditors` registry keys on). **Full parity** adds
a `rebuildEnvelopeFromRulesJson` analog for spiral (re-edit a compiled spiral
world) — **this is the first thing to drop under essentials.**
**Acceptance gate:** stepped spiral at defaults === monolithic
`arrangeShuffledSpiral` byte-for-byte on EVERY existing spiral preset
(`jta-zone-demo`, the runner spiral demo, any maze spiral); new
`dump-spiral-byteidentity` guard; `verify-procgen-presets.mjs` green;
per-step + serialized-boundary round-trip reproduces the monolithic world.

**rng discipline (the central invariant):** for JtA-only spiral worlds (the
real case) region synthesis is rng-free (`extractZoneRules` /
`synthesizeZonePayload` are deterministic per `zoneIdx`), so the ①-decide /
③-synthesize split is clean. **Mixed** spiral worlds with procedural substrates
(maze `generateRegionCore` consumes rng in the walk) need the same
threaded-rng-snapshot discipline sphere-growth uses — thread a continuous rng
snapshot after every rng-consuming step; ② content consumes none. Prove
byte-identity on a mixed preset, not just JtA-only.

### Part 3 — JtA wiring (LATER; the reshaped Phase B, its own session)
Dataset into ② content + spiral dataset config params (a jta preset carries
`{dataset:{seed,theme,structure,zones}}` + emit-locations/goalZone/freeZones,
applied via a substrate config seam) + restamp-on-edit + the four Phase-B gates
(non-jta/non-dataset presets byte-identical; roundtrip guard extended;
panel-generated world solves+plays in-app; envelope-edit→new-id→fresh-solve).
`generateZoneForSpecs`-into-sphere-growth: OPTIONAL/deferred — decide at Part 3
whether to retire it from the roadmap (spiral-stepped supersedes its purpose)
or keep it for genuinely sphere-shaped future worlds.

---

## 4. JtA-guiding constraints on ② content (bake in now, wire in Part 3)

Even staying JtA-agnostic, design ② so Part 3 is pure wiring:
- **Per-substrate content artifact on the envelope**, presence-invalidated. The
  presence probe must treat "substrate emits no content" as a **completed
  no-op** — otherwise `detectCompleted`'s contiguous walk stalls at ② on every
  non-content (all current) world and reports the pipeline incomplete. Probe
  shape: `content: (e) => !worldHasContentSubstrate(e) || !!e.<sub>Content`.
- **Restamp hook point** on hand-edit: a content edit must be able to trigger
  the substrate's validator + identity restamp (JtA: `datasetValidator.js
  --restamp`, content-hash → new `dataset_id`, shipped in 5g) — this is what
  keeps a `(seed, id)` cache + id-keyed save slots from being poisoned by an
  edited-but-same-id document. The harness provides the *seam* (a per-substrate
  `onContentEdit(artifact) → artifact'` the deserializer/edit path calls); JtA
  supplies the impl in Part 3.
- **Editing altitude = the serialized envelope's content document** (exactly how
  plan/allocation/topology are edited — no bespoke in-panel JSON editor this
  arc; the Phase-B "envelope edit" gate is proven by a test driving the
  envelope). A panel dataset editor stays deferred unless a later gate demands
  it.

---

## 5. Sequencing / picking this up fresh

Recommended: **implement Parts 1–2 in a fresh, `procgenPipeline/`-focused
session** — the heavy JtA-dataset context (C4, Pass B, dataset internals) is
NOT needed until Part 3, and Parts 1–2 are byte-identity-critical refactors that
benefit from a clean context. Read order for the executor:
1. This doc.
2. `topDownSteps.js` in full (the clean pattern to generalize), then
   `sphereSteps.js:64-67,452-497,534-570,594-636` (the structures + loop +
   codec + resume), then `sphereSteps.js:134-450` (the runners).
3. `procgenPipelineEngine.js:2468-2556` (zone-region assembly) +
   `arrangeShuffledSpiral :3013-~3170`.
4. `docs/json/developer/procgen/stepped-pipeline.md` + `sphere-growth.md`
   (the phase split + rng discipline rationale).

Follow-ups after this doc lands (this session, if the user asks): note the queue
re-sequencing in `CC/docs/plans/fable-to-opus-handoff-2026-07.md` §3 (spiral
parity precedes JtA Phase B) + a one-line "reevaluate zones" parking-lot item;
update the `project_jta_zone_randomization` memory pointer ("NEXT = Phase B" →
"NEXT = stepped-spiral parity, then reshaped Phase B on the spiral pipeline").
```

---

## 6. Status — 2026-07-12 session (Opus; on `main`, NOT pushed)

**Parts 1 + 2 core: DONE and byte-identity-verified.** Commits (in order):
- `Part 1a` — `steppedPipeline.js` harness + top-down migrated onto it. Descriptor
  `{steps, runners, present, codecs, nextStep}`; generic
  `runStep/runToStep/detectCompleted/resumeEnvelope/newEnvelope/serde`. **Codec
  ruling:** per-field `{encode(value,env), decode(value,out,obj)}` applied in
  DECLARATION ORDER — chosen because the top-down Grid alias
  (layout/realise/finalize share one mutated-in-place Grid) is IRREDUCIBLE shared
  state, so decode MUST reconnect the same object; a context-passing codec is the
  minimal single mechanism (sphere `tree.nodes` incidental-but-load-bearing, kept
  on the same codec rather than a wider engine refactor). User checked "can the
  aliases be refactored away?" → grid can't; decision recorded.
- `Part 1b` — sphere migrated. Zero output change: sphere/topdown
  dump-byteidentity IDENTICAL to baseline; `sphereSteps.test.js` 33/33;
  verify-{cli-sphere-config, sphere-envelope-resume, sphere-steps-ui,
  topdown-steps-ui, region-step-editing, topdown-steps} all green; 281 non-slow +
  49 slow (sphereGrowth/sphereBatched/topDownBounce) tests green;
  verify-procgen-presets green.
- `Part 2a` — engine split `arrangeShuffledSpiral` →
  `arrangeSpiralPlan` (①, only pre-loop rng draw) + `realiseSpiralRegions` (③,
  restores post-shuffle rng). Monolith byte-identical (dump-shuffled-spiral
  jta/maze/mixed unchanged).
- `Part 2b` — `spiralSteps.js` (① arrange / ② content no-op / ③ regions / ④
  compile) + `onContentEdit` restamp seam on the harness (guarded, no-op today) +
  `dump-spiral-byteidentity.mjs`. **Gate MET:** stepped == monolith byte-for-byte
  (grid + rules.json), in-process AND serde-each-step, on jta-only, maze-only,
  AND **mixed maze+jta** (the rng-threading proof) — 5 presets ✅. Resume/detect:
  fresh=-1, ② no-op transparently skipped, partial→resume reproduces the full run.
- `Part 2d` — `scripts/procgen/spiral-step.js` headless CLI (per-step
  cross-process == one-shot; region/item output == monolith + panel metadata).
- Docs — `stepped-pipeline.md` (shared-harness + spiral sections), scripts README.

**DEFERRED (essentials fallback — the PANEL surface, not the parity gate):**
- **Panel per-step spiral UI** (`_renderSpiralSteps` + `_stepSpiral*` +
  `_runSpiralAll` + step indicator/run-button branches) and the **③ Edit ▸
  region-editor launch** for spiral, plus a `verify-spiral-steps-ui.mjs`. Reason:
  the panel's stepped-mode UI is a large, interwoven surface (~15 `sphere||topDown`
  branch sites + a full `_renderTopDownSteps`-sized render + handlers) that is NOT
  byte-identity-verifiable and is best done as its own focused pass. The parity
  GATE (byte-identity + presets + serde + resume) does not need it, and the panel's
  one-shot spiral path already runs the *identical* engine machinery
  (`arrangeShuffledSpiral` = `realiseSpiralRegions(arrangeSpiralPlan(cfg), cfg)` —
  the same functions the steps call), so there is no correctness drift. This is the
  plan's anticipated essentials fallback, scoped to the panel only.
- **`rebuildEnvelopeFromRulesJson` analog for spiral** — the plan's explicit
  first-drop; not started.

**NEXT:** (a) the deferred panel spiral step-UI + region-editor launch +
verify-spiral-steps-ui.mjs; then (b) **Part 3** — JtA dataset into ② content
(reshaped Phase B): wire `emitsSpiralContent` + `onContentEdit`
(datasetValidator `--restamp`) + spiral dataset config params + the four Phase-B
gates. The ② content seam is designed and in place; Part 3 is pure wiring.
