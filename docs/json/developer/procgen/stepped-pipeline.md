# The Stepped Pipeline

Sphere growth, top-down, and shuffled-spiral can run as monolithic calls or as a sequence of discrete, inspectable, editable steps. The stepped form is what the Procgen Pipeline panel's step buttons drive and what the per-step CLIs expose; each driver has one per-mode step-runner module — `frontend/modules/procgenPipeline/sphereSteps.js`, `topDownSteps.js`, and `spiralSteps.js` — so the step wiring (rng threading, prebuilt-tree handoff, compile options) lives in exactly one place and panel and CLI cannot drift.

⚠ **This is the WORLD pipeline's step list, and there is a second, unrelated one.** A single region's *level* generation also has a step-through — the generation **ledger**'s phase ladder on the two lab pages (`goal · element-head · pre-carve · carve · on-connector · composite · partition · graph · realisation · certification`, then pass 2's own steps). The two do not interact and are editable in opposite senses: an envelope step is EDITABLE and re-runnable, while the ledger ladder is a read-only replay of a construction that already happened (it rebuilds phase *k* from row deltas and re-draws — nothing is re-run). See [Architecture](./architecture.md#level-generation-two-passes-over-one-loop-core).

⛓ **Every word this document uses as vocabulary — *the envelope*, *the stepped pipeline*, *a content source*, *byte-identity*, *the shuffled-spiral driver*, *sphere growth*, *the rng stream* — is defined in [the procgen glossary](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/glossary.html)**, one plain-language sentence before the rule; the data is [`frontend/modules/procgenDocs/glossary.js`](../../../../frontend/modules/procgenDocs/glossary.js).

## The shared harness

All three per-mode modules are thin clients of **one** generic engine, `frontend/modules/procgenPipeline/steppedPipeline.js`. Each mode supplies a **descriptor** — `{ steps, runners, present, codecs, nextStep }`, plus the optional `editBinding` + `dropOutputs` that turn on recorded hand edits (below) — and the harness provides the driver/resume/serde skeleton (`runStep`, `runToStep`, `detectCompleted`, `resumeEnvelope`, `newEnvelope`, `serialize`/`deserializeEnvelope`, `invalidateFromStep`) once. What genuinely differs per mode is the descriptor: the step list + runner functions, the presence probes, the non-plain artifact codecs, and the loop shape (`nextStep` — linear for top-down/spiral, batch-looping for sphere). The codecs are per-field `{ encode(value, env), decode(value, out, obj) }` applied in **declaration order**, so a field's decode can reconnect a cross-field alias off the already-decoded `out` (top-down's single Grid is aliased by layout/realise/finalize and is mutated in place, so decode reconnects the *same* object; sphere's `tree.nodes` re-aliases the decoded `nodes`). The harness only relocates the orchestration wrapper — the per-mode runner logic and rng draw order are what preserve byte-identity.

## The envelope

The unit of state is an **envelope** — a plain, serializable object that each step reads from and merges into. `serializeEnvelope`/`deserializeEnvelope` cross a process boundary losslessly, so the CLI can run every step in its own invocation with the envelope as a JSON file on disk, and you can hand-edit it between steps. Editing is intended at the step-output altitude — the plan, the allocation, the topology, the item assignment — not the grown grid, which crosses the boundary in a structural (tagged) form precisely so it isn't hand-edited. The grid IS editable, but through **recorded ops** rather than by hand (below).

## Sphere mode — six steps

`plan → allocate → topology → items → regions → compile` (`SPHERE_STEPS`), surfaced in the panel as ① ②a ②b ②c ③ ④. One global `spheresPerBatch` knob turns the middle into a per-batch loop — ① plan once → per batch [②a → ②b → ②c → ③] → ④ compile once — with the loop-back decided by `nextSphereStep(env)`. The default (one batch covering every wave) is the step-major path and is byte-identical to monolithic `growSpheres`; smaller batches grow sphere-major and diverge by design.

The envelope carries the cross-batch state (accumulated nodes, substrate counts, the grown grid, placement indices, batch cursor) and a **continuous rng snapshot threaded after every rng-consuming step**. The rng discipline that makes editing safe: ②b for the *first* batch re-derives the rng position from the seed (so an allocation edit plus re-run stays correct without depending on a snapshot a later step advanced), later batches restore the threaded snapshot, and ②c consumes no rng at all. The phase split itself and why it preserves byte-identity is covered in [Sphere-Driven Growth](./sphere-growth.md#the-three-phase-split-and-the-rng-discipline).

## Top-down mode — four steps

`layout → realise → finalize → compile` (`TOPDOWN_STEPS`), mapping onto `topDownFromRulesJson`'s phases. The source `rules.json` is read-only, so there is no editable plan step. ① BFS-places each source region into a grid cell and assigns per-region substrates and **sub-seeds**; ② realises each region from its own sub-seed (a generator, drained with a yield per region so the panel's progress repaints); ③ finalize (teleporters, back-exits, wall-off, entrance resolution, sphere-log metadata) and ④ compile are rng-free. Because ② never consumes ①'s rng stream, re-running ② after a hand-edit is deterministic without any rng restore.

## Spiral mode — four steps

`arrange → content → regions → compile` (`SPIRAL_STEPS`), splitting monolithic `arrangeShuffledSpiral` (now `arrangeSpiralPlan` + `realiseSpiralRegions` in the engine) plus `buildRulesJson`. ① **arrange** installs each quota substrate's pipeline config (`applySubstrateConfig` → `adapter.applyPipelineConfig`) so the quota-vs-`zoneCount` validation sees a configured dataset's real zone count, then validates, builds the shuffled substrate sequence — the *only* pre-loop rng draw — and auto-sizes the grid, yielding an editable placement plan (`sequence`, `cells`, `startCell`, `gridDims`) and a post-shuffle rng snapshot. ② **content** materialises a content source's installed document onto `env.content` as the editable artifact; it is a **byte-identical no-op for every document-less world**. A world "has content" only when a content source declares `adapter.emitsSpiralContent` **and** its `substrateConfig[id]` carries a document under the source's `spiralContentConfigKey` (default `datasetDoc`) — so a dataset-less jta world (which declares `emitsSpiralContent` unconditionally) still reads as no-content and the presence probe (`!worldHasContentSubstrate(e) || !!e.content`) reports *completed* without stalling `detectCompleted`'s contiguous walk. That config-field name is a source property (region-library C3) precisely so a **second content kind** — a loaded region library, keyed `library:<id>` with its own field/id — rides the same ② seam as jta's dataset. The descriptor's `onContentEdit` runs on every deserialize: it re-installs the config's globals (they don't cross a process boundary — from the edited `env.content` when present, else the config's carried document), restamps a hand-edited document (content-hash → new id: `dataset_id` for a jta dataset, `library_id` for a library), and clears the downstream `regions`/`compile` when that id changes so an auto-resume regenerates against the edit. ③ **regions** restores the post-shuffle rng and spiral-walks region synthesis + stitch/reconcile/wall-off; procedural substrates (maze) draw rng in the exact monolithic order, content sources (jta, library) draw none, so a content-only walk's ③ is rng-free. ④ **compile** is `buildRulesJson` (driver `shuffled-spiral`). The panel drives the stepped form (Part 2c); the headless `spiral-step` CLI runs each step cross-process (its `--jta-*` flags mint a jta-dataset world — generation is Node-only, the profile/vanilla fixtures are not bundled).

**JtA dataset residency (reshaped Phase B).** JtA's synthetic dataset is the first ② content document. A preset carries `growthParams.substrateConfig.jta = { datasetDoc, emitZoneLocations, goalZone, freeZones, startingPerks, perkShuffleSeed }`; ① installs it, ② lands the editable copy on `env.content`, ③ synthesises the zone regions (single full-doc carrier + a `jta_dataset_ref` on every jta region), and `onContentEdit` keeps a hand edit's `(seed, dataset_id)` Pass-B cache + id-keyed save slot honest. Gates: `check-spiral-byteidentity.mjs` (dataset-less byte-identity), `check-jta-locations-roundtrip.mjs` `JTA_RT_PIPELINE=1` (a pipeline-initiated dataset survives world_generator + Generate.py), `check-jta-dataset-pipeline-preset.mjs` (the pipeline reproduces the committed playable `jta_dataset_test` preset the in-app test solves), and `spiralSteps.dataset.test.js` (edit → new id → fresh solve).

## The byte-identity contract

Running the stepped pipeline — in-process or across serialized boundaries — reproduces the monolithic driver's output **byte-for-byte** at default batching. This is the invariant that makes the stepped form trustworthy: an edit changes exactly what you edited, nothing else. An envelope with no recorded layout edits takes no replay code path at all, so the contract is stated over the unedited world and the guards below measure it there. It holds because the rng is a single continuous stream consumed in the monolithic order; any added, removed, or reordered draw in the engine or a step runner breaks it silently. The guards are the step-runner test suites (`sphereSteps.test.js`) and the headless verifiers (`scripts/procgen/verify-*.mjs`, `dump-*-byteidentity.mjs`).

## Hand edits are recorded

The composite-grid **layout editor** (the panel's Move Region / Move Exits modes) and the two scalar per-region gestures (Re-roll 🎲, the substrate `<select>`) do not mutate-and-forget. Each one is an **op appended to `env.edits[]`** — `frontend/modules/procgenPipeline/layoutEdits.js` — so a hand-edited world is `config + seed + edits`, and the panel, the CLI and a re-run all reproduce the same world from that recording.

The vocabulary is six ops, one spec table: `move-region {from, to}`, `swap-regions {a, b}`, `move-exit-side {cell, exitId, side}`, `swap-exit-sides {cell, exitA, exitB}`, `re-roll {region_id, n}`, `set-substrate {region_id, substrate}`. The four layout ops call the existing engine mutators; the two scalars go through the mode's binding.

**Where each op replays.** The runner replays an edit immediately after the step that PRODUCES the artifact it mutates, and before the next step starts. The stages are not a convention — they are the panel's own write-back depths:

| op | sphere | top-down |
|---|---|---|
| `move-region`, `swap-regions`, `move-exit-side`, `swap-exit-sides` | after ③ regions | after ③ finalize |
| `re-roll` | after ③ regions | after ① layout |
| `set-substrate` | after ②c items | after ① layout |

Top-down's layout ops replay *after* ③ because `finalizeTopDown` derives back-exits through `layout.cellsByName`: run the move first and the moved region gets no back-exit at all. That is also the one place where the replay stage and the **undo** step diverge — the grid top-down moves regions on is built by ①, so undoing a top-down layout edit rewinds to ①, while sphere's ③ builds its own grid and the two coincide.

**Undo is a pop.** Drop the last edit, `invalidateFromStep` the step it rewinds to, resume: determinism does the rest. The claim, pinned on both drivers, is *N edits → undo ×N → the never-edited world, byte for byte*.

**Identity differs by mode.** Top-down regions keep their source names. Sphere edits name `#<node index>`, because the canonical `region_<gx>_<gy>` is derived from a cell that only exists after ③ while `set-substrate` must apply before ③. A `re-roll`'s `n` is derived from the recording (how many re-rolls of that region precede it), never from a session counter — which is what makes undo rewind the count.

**No rng.** A replay draws nothing: the four mutators relabel and re-stitch, `set-substrate` writes a field, and a re-roll derives its seed from `(seed, region_id, n)`. With `edits` absent or empty the replay is not entered.

**Export and reproduction.** `serializeEnvelope` carries the recording for free (it is plain JSON), so a CLI chain and a panel export both round-trip it; `procgen_metadata.edits` carries it into the compiled `rules.json` as **provenance** (additive — omitted when nothing was edited). ⚠ An edit applies exactly once per production of its artifact, so a `run -i env.json` that auto-resumes *past* an edit's stage will not re-apply it — which is correct (a panel export's edits are already applied), but means a hand-added edit needs `--from <its stage>`. Both CLIs print the recorded edits and name any their start point is already past.

Guards: `layoutEdits.test.js`, the recorded-edit blocks in `sphereSteps.test.js` and `topDownSteps.test.js`.

## Region editors (③ Edit ▸)

The panel's per-region "Edit ▸" is substrate-agnostic via `frontend/modules/procgenPipeline/regionEditors.js`, which RESOLVES rather than registers: the launcher for `region.substrate` is **any substrate whose entry declares `roomEditor`** on the substrate registry ([Substrate registry](./substrate-registry.md) § *Entry contract* → *Editing*), and a substrate that declares none is the graceful "no editor for this substrate" fallback. The contract is `open({ region \| record, base?, contract?, onSave })`; `contract` carries what the realiser used (side portals, exit/location specs, physics profile, braid layout, …); in pipeline mode `onSave` splices the edited region back into the grid and invalidates ④.

(It WAS a registry — a module-level table each editor wrote itself into at `initialize()` time — until the editor-integration arc's slice W3. The reason it could not stay one: the maze's and Seedling's room editors are LAB PAGES, and a page never calls `initialize()`. A DECLARATION on the entry is also readable headless, so the capability matrix and the `check-*.mjs` gates can ask which substrates have an editor with no browser. `registerRegionEditor` survives as a deprecated runtime override for one release; nothing in the repository calls it.)

Three substrates declare one today. **bounceRegionEditor** (`frontend/modules/bounceRegionEditor/`, panel 🪀) is the `panel` kind: launched from Edit ▸ with a session, or standalone with a fixture when no session is pending, editing one bounce region's geometry against the verified-vs-authored region report. The **maze** and **Seedling** are the `lab` kind — their editors are `mazeRoom/lab.html`'s SET arm and `seedlingDemo/watch.html`'s EDIT arm, opened inside `procgenLabPanel` by `procgenLabPanel/labRoomEditor.js` over the existing `procgenLab:` vocabulary: a document in over `load`, ONE room over `navigate` with `?source=<arm>&room=<n>`, and the folded document back out over `levelChanged`.

## Rebuilding an envelope from a compiled world

`rebuildEnvelopeFromRulesJson` (pipeline engine) reconstructs a sphere-mode envelope from a compiled `rules.json`, using `procgen_metadata.sphere_tree` and the preserved `preset_sidecars` — which is what makes an already-compiled world re-growable and appendable (add spheres to an existing world) rather than a dead end. This is why editors must round-trip `procgen_metadata` untouched ([Sphere-Driven Growth](./sphere-growth.md#editing-and-round-tripping-grown-worlds)).

## CLIs

- `scripts/procgen/sphere-step.js` — one sphere step (or a range) per invocation; `--params FILE` merges config overrides mid-pipeline; compile exits non-zero on a sphere-oracle mismatch.
- `scripts/procgen/topdown-step.js` — the top-down analogue.
- `scripts/procgen/spiral-step.js` — the shuffled-spiral analogue (`arrange → content → regions → compile`).
- `scripts/procgen/check-topdown-steps.mjs`, `dump-*-byteidentity.mjs` (incl. `check-spiral-byteidentity.mjs`) — the byte-identity checks.

See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).

## Related documentation

- [Architecture](./architecture.md) — the stepped pipeline in context
- [Sphere-Driven Growth](./sphere-growth.md) — the phase split and rng discipline in depth
- [Bounce Substrate](./bounce.md) — the region contract the bounce editor consumes
