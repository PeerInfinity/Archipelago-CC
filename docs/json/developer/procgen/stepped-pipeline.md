# The Stepped Pipeline

Sphere growth, top-down, and shuffled-spiral can run as monolithic calls or as a sequence of discrete, inspectable, editable steps. The stepped form is what the Procgen Pipeline panel's step buttons drive and what the per-step CLIs expose; each driver has one per-mode step-runner module — `frontend/modules/procgenPipeline/sphereSteps.js`, `topDownSteps.js`, and `spiralSteps.js` — so the step wiring (rng threading, prebuilt-tree handoff, compile options) lives in exactly one place and panel and CLI cannot drift.

## The shared harness

All three per-mode modules are thin clients of **one** generic engine, `frontend/modules/procgenPipeline/steppedPipeline.js`. Each mode supplies a **descriptor** — `{ steps, runners, present, codecs, nextStep }` — and the harness provides the driver/resume/serde skeleton (`runStep`, `runToStep`, `detectCompleted`, `resumeEnvelope`, `newEnvelope`, `serialize`/`deserializeEnvelope`) once. What genuinely differs per mode is the descriptor: the step list + runner functions, the presence probes, the non-plain artifact codecs, and the loop shape (`nextStep` — linear for top-down/spiral, batch-looping for sphere). The codecs are per-field `{ encode(value, env), decode(value, out, obj) }` applied in **declaration order**, so a field's decode can reconnect a cross-field alias off the already-decoded `out` (top-down's single Grid is aliased by layout/realise/finalize and is mutated in place, so decode reconnects the *same* object; sphere's `tree.nodes` re-aliases the decoded `nodes`). The harness only relocates the orchestration wrapper — the per-mode runner logic and rng draw order are what preserve byte-identity.

## The envelope

The unit of state is an **envelope** — a plain, serializable object that each step reads from and merges into. `serializeEnvelope`/`deserializeEnvelope` cross a process boundary losslessly, so the CLI can run every step in its own invocation with the envelope as a JSON file on disk, and you can hand-edit it between steps. Editing is intended at the step-output altitude — the plan, the allocation, the topology, the item assignment — not the grown grid, which crosses the boundary in a structural (tagged) form precisely so it isn't hand-edited.

## Sphere mode — six steps

`plan → allocate → topology → items → regions → compile` (`SPHERE_STEPS`), surfaced in the panel as ① ②a ②b ②c ③ ④. One global `spheresPerBatch` knob turns the middle into a per-batch loop — ① plan once → per batch [②a → ②b → ②c → ③] → ④ compile once — with the loop-back decided by `nextSphereStep(env)`. The default (one batch covering every wave) is the step-major path and is byte-identical to monolithic `growSpheres`; smaller batches grow sphere-major and diverge by design.

The envelope carries the cross-batch state (accumulated nodes, substrate counts, the grown grid, placement indices, batch cursor) and a **continuous rng snapshot threaded after every rng-consuming step**. The rng discipline that makes editing safe: ②b for the *first* batch re-derives the rng position from the seed (so an allocation edit plus re-run stays correct without depending on a snapshot a later step advanced), later batches restore the threaded snapshot, and ②c consumes no rng at all. The phase split itself and why it preserves byte-identity is covered in [Sphere-Driven Growth](./sphere-growth.md#the-three-phase-split-and-the-rng-discipline).

## Top-down mode — four steps

`layout → realise → finalize → compile` (`TOPDOWN_STEPS`), mapping onto `topDownFromRulesJson`'s phases. The source `rules.json` is read-only, so there is no editable plan step. ① BFS-places each source region into a grid cell and assigns per-region substrates and **sub-seeds**; ② realises each region from its own sub-seed (a generator, drained with a yield per region so the panel's progress repaints); ③ finalize (teleporters, back-exits, wall-off, entrance resolution, sphere-log metadata) and ④ compile are rng-free. Because ② never consumes ①'s rng stream, re-running ② after a hand-edit is deterministic without any rng restore.

## Spiral mode — four steps

`arrange → content → regions → compile` (`SPIRAL_STEPS`), splitting monolithic `arrangeShuffledSpiral` (now `arrangeSpiralPlan` + `realiseSpiralRegions` in the engine) plus `buildRulesJson`. ① **arrange** validates, builds the shuffled substrate sequence — the *only* pre-loop rng draw — and auto-sizes the grid, yielding an editable placement plan (`sequence`, `cells`, `startCell`, `gridDims`) and a post-shuffle rng snapshot. ② **content** is where a zone substrate synthesises its per-zone dataset; it is a **byte-identical no-op for every current substrate** (JtA's dataset lands here in a later phase). Its presence probe treats "no content substrate in this world" as a *completed* no-op, so `detectCompleted`'s contiguous walk never stalls at ② — a substrate opts in via `adapter.emitsSpiralContent`, and the descriptor's `onContentEdit` restamps a hand-edited content document on load. ③ **regions** restores the post-shuffle rng and spiral-walks region synthesis + stitch/reconcile/wall-off; procedural substrates (maze) draw rng in the exact monolithic order, zone substrates (jta) draw none, so a JtA-only walk's ③ is rng-free. ④ **compile** is `buildRulesJson` (driver `shuffled-spiral`). The panel still runs spiral one-shot today; the stepped form is exposed via the CLI and the byte-identity guard.

## The byte-identity contract

Running the stepped pipeline — in-process or across serialized boundaries — reproduces the monolithic driver's output **byte-for-byte** at default batching. This is the invariant that makes the stepped form trustworthy: an edit changes exactly what you edited, nothing else. It holds because the rng is a single continuous stream consumed in the monolithic order; any added, removed, or reordered draw in the engine or a step runner breaks it silently. The guards are the step-runner test suites (`sphereSteps.test.js`) and the headless verifiers (`scripts/procgen/verify-*.mjs`, `dump-*-byteidentity.mjs`).

## Region editors (③ Edit ▸)

The panel's per-region "Edit ▸" is substrate-agnostic via the `regionEditors` registry (`frontend/modules/procgenPipeline/regionEditors.js`): editors register an `open({ region, contract, onSave? })` launcher keyed by substrate id, and the panel looks up `region.substrate` — a missing entry is a graceful "no editor for this substrate" fallback. `contract` carries what the realiser used (side portals, exit/location specs, physics profile, braid layout, …); in pipeline mode `onSave` splices the edited region back into the grid and invalidates ④.

The one registered editor is **bounceRegionEditor** (`frontend/modules/bounceRegionEditor/`, panel 🪀): launched from Edit ▸ with a session, or standalone with a fixture when no session is pending, editing one bounce region's geometry against the verified-vs-authored region report.

## Rebuilding an envelope from a compiled world

`rebuildEnvelopeFromRulesJson` (pipeline engine) reconstructs a sphere-mode envelope from a compiled `rules.json`, using `procgen_metadata.sphere_tree` and the preserved `preset_sidecars` — which is what makes an already-compiled world re-growable and appendable (add spheres to an existing world) rather than a dead end. This is why editors must round-trip `procgen_metadata` untouched ([Sphere-Driven Growth](./sphere-growth.md#editing-and-round-tripping-grown-worlds)).

## CLIs

- `scripts/procgen/sphere-step.js` — one sphere step (or a range) per invocation; `--params FILE` merges config overrides mid-pipeline; compile exits non-zero on a sphere-oracle mismatch.
- `scripts/procgen/topdown-step.js` — the top-down analogue.
- `scripts/procgen/spiral-step.js` — the shuffled-spiral analogue (`arrange → content → regions → compile`).
- `scripts/procgen/verify-topdown-steps.mjs`, `dump-*-byteidentity.mjs` (incl. `dump-spiral-byteidentity.mjs`) — the byte-identity checks.

See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).

## Related documentation

- [Architecture](./architecture.md) — the stepped pipeline in context
- [Sphere-Driven Growth](./sphere-growth.md) — the phase split and rng discipline in depth
- [Bounce Substrate](./bounce.md) — the region contract the bounce editor consumes
