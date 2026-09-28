# The Stepped Pipeline

Sphere growth, top-down, and shuffled-spiral can run as one monolithic call or as a sequence of discrete steps that you can inspect, edit, and re-run. The stepped form is what the Procgen Pipeline panel's step buttons and the per-step CLIs drive, and it reproduces the monolithic output byte for byte.

Each mode has one step-runner module in `frontend/modules/procgenPipeline/`: `sphereSteps.js`, `topDownSteps.js` and `spiralSteps.js`. The step wiring (rng threading, handing a prebuilt tree along, compile options) lives only there, so the panel and the CLIs cannot drift apart.

This is the step list for a whole world. A single region's level generation has a separate, unrelated step-through: the phase ladder on the two lab pages, which replays a finished construction read-only instead of re-running anything. See [Architecture](./architecture.md).

The terms used here (*envelope*, *content source*, *byte-identity*, *rng stream*) are defined in the [procgen glossary](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/glossary.html).

## The shared harness

All three step modules are clients of one generic engine, `frontend/modules/procgenPipeline/steppedPipeline.js`. The engine provides the run/resume/serialise skeleton once: `runStep`, `runToStep`, `detectCompleted`, `resumeEnvelope`, `newEnvelope`, `serializeEnvelope` / `deserializeEnvelope` and `invalidateFromStep`.

Each mode supplies a **descriptor** with what actually differs:

| Field | Purpose |
|---|---|
| `steps`, `runners` | The step list and the function for each step |
| `present` | Probes that tell whether a step's output already exists |
| `codecs` | Per-field `{ encode, decode }` for values that are not plain JSON |
| `nextStep` | The loop shape: linear for top-down and spiral, batch-looping for sphere |
| `editBinding`, `dropOutputs` | Optional; turn on recorded hand edits (below) |

Codecs run in declaration order, so a later field's decode can reconnect an alias to an object decoded earlier (top-down's one shared `Grid`, sphere's `tree.nodes`).

## The envelope

The unit of state is an **envelope**: a plain, serialisable object that each step reads from and merges into. `serializeEnvelope` / `deserializeEnvelope` cross a process boundary losslessly, so a CLI can run each step in its own invocation with the envelope as a JSON file on disk, and you can edit that file between steps.

Hand edits are meant for step outputs: the plan, the allocation, the topology, the item assignment. The grown grid is stored in a tagged structural form so that it is not edited by hand; to change it, use the recorded edit ops described below.

## Sphere mode — six steps

`plan → allocate → topology → items → regions → compile` (`SPHERE_STEPS`), shown in the panel as ① ②a ②b ②c ③ ④.

The `spheresPerBatch` knob turns the middle into a loop: ① plan once, then per batch ②a → ②b → ②c → ③, then ④ compile once. `nextSphereStep(env)` decides the loop-back. The default is one batch covering every sphere, which matches monolithic `growSpheres` byte for byte; smaller batches grow sphere by sphere and produce a different world by design.

The envelope carries the state shared across batches (accumulated nodes, substrate counts, the grown grid, placement indices, the batch cursor) and an rng snapshot saved after every step that draws from it. The rules that keep edits safe:

- ②b in the first batch re-derives its rng position from the seed, so editing the allocation and re-running stays correct.
- Later batches restore the saved snapshot.
- ②c draws no rng at all.

Why the phase split preserves byte-identity is covered in [Sphere-Driven Growth](./sphere-growth.md#the-three-phase-split-and-the-rng-discipline).

## Top-down mode — four steps

`layout → realise → finalize → compile` (`TOPDOWN_STEPS`), the phases of `topDownFromRulesJson`. The source `rules.json` is read-only, so there is no editable plan step.

| Step | What it does |
|---|---|
| ① layout | Places each source region in a grid cell by BFS and assigns each region a substrate and a sub-seed |
| ② realise | Builds each region from its own sub-seed, yielding once per region so the panel's progress repaints |
| ③ finalize | Teleporters, back exits, wall-off, entrance resolution, sphere-log metadata; no rng |
| ④ compile | Writes `rules.json`; no rng |

Because ② never draws from ①'s rng stream, re-running ② after a hand edit is deterministic without restoring any rng state.

## Spiral mode — four steps

`arrange → content → regions → compile` (`SPIRAL_STEPS`). These split the monolithic `arrangeShuffledSpiral` (in the engine, `arrangeSpiralPlan` + `realiseSpiralRegions`) plus `buildRulesJson`.

**① arrange** first installs each quota substrate's pipeline config through its registry entry's `applyPipelineConfig`, so that validating quotas against `zoneCount` sees a configured dataset's real zone count. It then builds the shuffled substrate sequence (the only rng draw before the loop) and sizes the grid. The output is an editable placement plan (`sequence`, `cells`, `startCell`, `gridDims`) plus the post-shuffle rng snapshot.

**② content** copies a content source's installed document onto `env.content`, where it can be edited. For a world with no content document it does nothing and stays byte-identical. A world has content only when a source declares `emitsSpiralContent` and its `substrateConfig[id]` carries a document under the source's `spiralContentConfigKey` (default `datasetDoc`). So a jta world with no dataset reads as content-free, and the step's presence probe reports it complete.

The config key is a property of the source so that more than one kind of content can use this step. JtA's synthetic dataset uses `datasetDoc`; a loaded region library uses `libraryDoc`, keyed `library:<id>`.

After every deserialise, the descriptor's `onContentEdit` re-installs the config's globals (they do not cross a process boundary). If the document was hand-edited, it gets a new content-hash id (`dataset_id` for a jta dataset, `library_id` for a library), and when the id changes, `regions` and `compile` are cleared so that a resume regenerates against the edit.

**③ regions** restores the post-shuffle rng and walks the spiral: region synthesis, stitching, reconciliation and wall-off. Procedural substrates (the maze) draw rng in exactly the monolithic order; content sources (jta, library) draw none.

**④ compile** is `buildRulesJson` with driver `shuffled-spiral`. Whenever any driver writes `procgen_metadata`, it also records each content source's installed config: every source that declares `recordablePipelineConfig` and realised at least one region gets `procgen_metadata[p].substrate_configs[id]` (the metadata is keyed per player). This keeps fields a reader could not otherwise recover, such as jta's zone settings or omsi's town settings. See `frontend/modules/procgenCore/substrateConfigRecord.js` and [Substrate Registry](./substrate-registry.md) for the content-source contract.

### JtA datasets in the spiral

A preset carries `growthParams.substrateConfig.jta = { datasetDoc, emitZoneLocations, goalZone, freeZones, startingPerks, perkShuffleSeed }`. ① installs it, ② puts the editable copy on `env.content`, and ③ builds the zone regions, each carrying a `jta_dataset_ref`. Generating a dataset runs in Node only; `spiral-step.js`'s `--jta-*` flags create a jta-dataset world headlessly.

| Check | What it covers |
|---|---|
| `scripts/procgen/check-spiral-byteidentity.mjs` | Dataset-less byte-identity |
| `scripts/procgen/check-jta-locations-roundtrip.mjs` with `JTA_RT_PIPELINE=1` | A pipeline-built dataset survives `world_generator` and `Generate.py` |
| `scripts/procgen/check-jta-dataset-pipeline-preset.mjs` | The pipeline reproduces the committed `jta_dataset_test` preset |
| `frontend/modules/procgenPipeline/spiralSteps.dataset.test.js` | Edit → new id → fresh solve |

## The byte-identity contract

Running the stepped pipeline, in one process or across serialised boundaries, reproduces the monolithic driver's output byte for byte at default batching. This is what makes the stepped form trustworthy: an edit changes exactly what you edited and nothing else.

The contract is stated over the unedited world; an envelope with no recorded edits never enters the replay code. It holds because the rng is one continuous stream consumed in the monolithic order.

**Warning:** any added, removed or reordered rng draw in the engine or a step runner breaks the contract silently. Run the guards after touching either.

| Guard | Covers |
|---|---|
| `sphereSteps.test.js`, `topDownSteps.test.js` (in `frontend/modules/procgenPipeline/`) | Stepped vs monolithic, in process |
| `scripts/procgen/dump-maze-byteidentity.mjs`, `dump-sphere-byteidentity.mjs`, `dump-topdown-byteidentity.mjs` | Headless dumps compared across changes |
| `scripts/procgen/check-spiral-byteidentity.mjs`, `check-topdown-steps.mjs` | Spiral and top-down, stepped vs monolithic |
| `frontend/modules/procgenPipeline/presetDefs.generate.slow.test.js` | Every shipped preset generated twice, byte-identical |

## Hand edits are recorded

The panel's layout editor (Move Region, Move Exits) and the per-region Re-roll 🎲 and substrate `<select>` each append an op to `env.edits[]` (`frontend/modules/procgenPipeline/layoutEdits.js`), so an edited world is `config + seed + edits`, and the panel, the CLI and a re-run all reproduce it from that recording.

| Op | Fields | Applied by |
|---|---|---|
| `move-region` | `from, to` | engine mutator |
| `swap-regions` | `a, b` | engine mutator |
| `move-exit-side` | `cell, exitId, side` | engine mutator |
| `swap-exit-sides` | `cell, exitA, exitB` | engine mutator |
| `re-roll` | `region_id, n` | mode's edit binding |
| `set-substrate` | `region_id, substrate` | mode's edit binding |

The exit-side ops relabel an exit through the substrate's declared `exitSides.relabel`, read by `regionExitSides(region)`; a substrate that declares none (the maze) refuses them. Whether a side that already holds an exit may take another is `sideMayHoldAnotherExit` (`frontend/modules/procgenCore/exitSides.js`). On a substrate with `regionGeometry: 'sides'` (bounce, runner) the ops write the new `side` and no tile; see [Substrate Registry](./substrate-registry.md#build-time--region-geometry).

### Where each op replays

An edit replays right after the step that produces the artifact it changes, before the next step starts:

| Op | Sphere | Top-down |
|---|---|---|
| `move-region`, `swap-regions`, `move-exit-side`, `swap-exit-sides` | after ③ regions | after ③ finalize |
| `re-roll` | after ③ regions | after ① layout |
| `set-substrate` | after ②c items | after ① layout |

Top-down layout ops replay after ③ because `finalizeTopDown` derives back exits from `layout.cellsByName`; a move applied earlier would leave the moved region without a back exit. Undo still rewinds a top-down layout edit to ①, because ① builds the grid; in sphere mode ③ builds its own grid, so replay and undo happen at the same step.

### Rules the replay follows

- **Links are re-derived from the exits.** Every layout op ends in `relayoutSphereGrid`, which rebuilds `Grid.teleporters` with one entry per teleporter exit (keyed `cell:exit_id`), re-stitches, and sets each exit's `isTeleporter` from `linkIsAdjacentOnSide`. A move and its move back, or a swap and its swap back, therefore leave every exit and every compiled `regions` byte unchanged.
- **Key order is kept.** A move re-keys the region in place in the grid's cell `Map` (`Grid.relocateRegions`), and that order is the key order of `preset_sidecars`. The compiled `rules.json` after a move and back is the never-edited one as a string, apart from `procgen_metadata.edits`.
- **Undo is a pop.** Drop the last edit, `invalidateFromStep` to the step it rewinds to, and resume. N edits followed by N undos give the never-edited world, byte for byte, on both drivers.
- **Identity differs by mode.** Top-down regions keep their source names. Sphere edits name regions `#<node index>`, because the canonical `region_<gx>_<gy>` only exists after ③ while `set-substrate` applies before it. A `re-roll`'s `n` counts the earlier re-rolls of that region in the recording, never a session counter, so undo rewinds it.
- **No rng.** Replaying draws nothing: the mutators relabel and re-stitch, `set-substrate` writes a field, and a re-roll derives its seed from `(seed, region_id, n)`.

The recording travels in the envelope, and compile copies it to `procgen_metadata[p].edits` in `rules.json` as provenance (omitted when nothing was edited).

**Note:** an edit applies once each time its artifact is produced. `run -i env.json` that resumes past an edit's stage will not re-apply it, which is correct for a panel export (its edits are already applied); a hand-added edit needs `--from <its stage>`. Both CLIs print the recorded edits and name any their start point has already passed.

Tests: `layoutEdits.test.js`, the recorded-edit blocks in `sphereSteps.test.js` and `topDownSteps.test.js`, and `topDownRelayoutIdentity.test.js` for move-and-back identity (also asserted through the panel by `scripts/procgen/check-topdown-steps-ui.mjs`).

## Region editors (③ Edit ▸)

The panel's per-region Edit ▸ button is substrate-agnostic. `frontend/modules/procgenPipeline/regionEditors.js` looks up the substrate registry: any substrate whose entry declares `roomEditor` has an editor, and one that declares none shows a "no editor for this substrate" message. See [Substrate Registry](./substrate-registry.md) (*Entry contract*, *Editing*).

The editor contract is `open({ region | record, base?, contract?, onSave })`. `contract` carries what the realiser used (side portals, exit and location specs, physics profile, braid layout, and so on). In pipeline mode, `onSave` splices the edited region back into the grid and invalidates ④.

| Substrate | Kind | Editor |
|---|---|---|
| `bounce` | `panel` | `frontend/modules/bounceRegionEditor/` (panel 🪀), opened from Edit ▸ or standalone with a fixture |
| `maze` | `lab` | `mazeRoom/lab.html`, SET arm |
| `flash_seedling`, `flash_seedling_gen` | `lab` | `seedlingDemo/watch.html`, EDIT arm (the same editor) |

Lab editors open inside `procgenLabPanel` through `frontend/modules/procgenLabPanel/labRoomEditor.js`: the document goes in over `load`, one room is opened over `navigate` with `?source=<arm>&room=<n>`, and the edited document comes back over `levelChanged`. `registerRegionEditor` remains as a deprecated runtime override; nothing in the repository calls it.

## Rebuilding an envelope from a compiled world

`rebuildEnvelopeFromRulesJson` (in `procgenPipelineEngine.js`) reconstructs a sphere-mode envelope from a compiled `rules.json`, using the player's `procgen_metadata[p].sphere_tree` (`opts.playerId`, default `'1'`) and the preserved `preset_sidecars`. This lets you re-grow a compiled world or add spheres to it. It is why editors must round-trip `procgen_metadata` untouched; see [Sphere-Driven Growth](./sphere-growth.md#editing-and-round-tripping-grown-worlds).

## CLIs and headless runs

| Script (`scripts/procgen/`) | Purpose |
|---|---|
| `sphere-step.js` | One sphere step or a range per invocation; `--params FILE` merges config overrides; `compile` exits non-zero on a sphere-oracle mismatch |
| `topdown-step.js` | The top-down equivalent |
| `spiral-step.js` | The shuffled-spiral equivalent |

See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).

The panel's Generate builds each step runner's input with `buildRunFromState` in `frontend/modules/procgenPipeline/presetRun.js`, a pure function of the panel state; `runPresetHeadless` drives the same run to `rules.json` with no browser. The CLIs do not use `presetRun.js`: they build their config from flags over the same hooks (`sphereConfigHooks.js`) and call the same step runners.

`presetDefs.generate.slow.test.js` generates every entry of `SHIPPED_PRESETS` twice per CI run and requires identical bytes, a world beyond Menu, and each run within `PRESET_HEADLESS_BUDGET_MS`. Presets that name a substrate declaring `generationCost: 'heavy'` are skipped, and must be listed in `PRESETS_SKIPPED_AS_HEAVY`.

## Related documentation

- [Architecture](./architecture.md) — the stepped pipeline in context
- [Sphere-Driven Growth](./sphere-growth.md) — the phase split and rng discipline in depth
- [Pipeline Presets](./pipeline-presets.md) — the shipped configurations
- [Bounce Substrate](./bounce.md) — the region contract the bounce editor consumes
