# Procedural Generation Architecture

The orientation document for the procedural-generation ("procgen") system: how a world is generated and compiled to `rules.json`, how a single region's level is built, what the substrates are, and how a generated world is played back and round-tripped through Python. Read this first; the other procgen documents go deeper on individual pieces.

## What procgen is in this fork

The frontend can generate complete multi-region game worlds — regions, entrances, locations, items, access rules, and the playable content of each region — and compile them to a standard `rules.json`, the same format exported from real Archipelago games. Because the output is ordinary `rules.json` plus a few extra top-level keys, a generated world goes through the whole existing toolchain: it can be played in the frontend, turned into a Python world package by `world_generator`, run through `Generate.py` for real item distribution, and exported again.

The playable content of each region comes from a **substrate**: a pluggable per-region game engine such as a maze, a vertical platformer or a text adventure. One generated world can mix substrates, so one region can be a maze and the next a platformer level.

## The pieces and the data flow

```
BUILD TIME
  Procgen Pipeline panel  ──or──  headless CLI (scripts/procgen/)
        │ a layout driver builds the region graph and assigns
        │ each region a substrate
        ▼
  substrate registry  (frontend/modules/shared/procgen/substrateRegistry.js)
        │ dispatch by substrate id — the pipeline never imports
        │ substrate modules directly
        ▼
  per-region substrate generators  (maze, bounce, text adventure, …)
        │ each region gets a playable payload + verified access rules
        ▼
  rules.json  (+ preset_sidecars, procgen_metadata, loop_costs)

PLAY TIME
  procgenPlayer builds a "warehouse" of deserialized regions
        │ publishes <substrate>:loadRegion as the player moves
        ▼
  substrate panels render/run the current region
        ├── playback bot drives scripted walkthroughs
        └── loops module runs loop mode (when loop_costs is present)

PYTHON ROUND-TRIP
  rules.json → world_generator → worlds/<game>_worldgen/ → Generate.py
             → exporter → a fresh rules.json that is still procgen-playable
```

Three properties hold this together:

- **One output format.** Every driver ends in `buildRulesJson` (`frontend/modules/procgenPipeline/procgenPipelineEngine.js`), which writes a standard `rules.json` that every existing consumer (tracker, region graph, world generator) understands.
- **Dispatch by id.** Build-time generation and runtime playback both go through the substrate registry, so substrates and the pipeline stay decoupled.
- **Determinism.** The same `(seed, parameters)` reproduces the same world byte for byte. All random draws come from one seeded rng stream (`frontend/modules/shared/rng.js`), which is what makes the stepped pipeline and the verification tooling possible.

## Level generation: two passes over one loop core

The layout drivers build the *world*: regions, entrances, items and rules. What fills a **single region** is a second, smaller pipeline. It is shared by the two substrates that have a lab page (Seedling's `seedlingDemo/watch.html` and the maze's `mazeRoom/lab.html`) and runs over one substrate-neutral loop core, `frontend/modules/procgenCore/levelGenerator.js`. Substrate detail lives in [Maze Substrate](./maze.md) and [Seedling Real-Game Bot](./seedling-bot.md).

Three companion resources:

- [The reference page](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html) holds every table this pipeline's vocabulary needs — the URL parameters of both lab pages, the biomes, templates and their parameter domains, the element heads, the skeleton kinds and the refusal names. It is generated from the code by `scripts/procgen/generate-procgen-reference.mjs`, so do not copy those tables into a document.
- [The glossary](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/glossary.html) defines every term used here in a special sense (`site`, `element`, `demand`, `cut`, `area`, `vestibule`, `certification`, …). Its data is `frontend/modules/procgenDocs/glossary.js`.
- [The demo catalogue](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html) links a live demonstration of each feature; see [Demonstrations](./demos.md).

A level is generated in two passes. **Pass 1** constructs what the level is *about* and certifies it with the substrate's solver. **Pass 2** decorates what pass 1 left, one candidate at a time, keeping or reverting each. Open space is pass 1's job: a pass-2 template that needs space proposes only where pass 1 made some, and reports `NO_ANCHOR` elsewhere.

### Pass 1 — the skeleton, in draw order

Seedling's model is `seedlingDemo/procgenSeedling.js`; the maze's is `mazeRoom/procgenMaze.js`. Both draw from one room-construction rng stream, in this order:

1. **The goal** — the stream's first draw, at Manhattan distance of at least `GOAL_MIN_FROM_START` (3) from the start. That distance guarantees a door element is never refused because of the goal's position alone.
2. **The element head** — which pass-1 constructor this level gets. When none is asked for, Seedling's `defaultElementsFor(items)` supplies the biome default: a choice among `guard` (with `len` drawn from `2|3|4`), `blockpocket` and `chamber`, plus `killgate` when the biome grants the sword. A `+` list is a choice (one `rng.pick`); `key=v1|v2` draws one value; a single value is fixed and spends no draw. `ELEMENT_TABLE.<head>.needs` (`procgenCore/elementSpec.js`) refuses a head whose item the biome does not grant, without spending a solve.
3. **Pre-carve elements** — built before the connector, inside a rectangle reserved for them. The pre-carve heads are `guard` (the reverse-pull block gadget, `procgenCore/elements/reversePullBlock.js`), `chamber` and `arena`. Each element module declares its `phase`.
4. **The carve** — the connector: maze algorithms reused as corridor and chamber carvers, one per skeleton kind (`procgenCore/skeletonKinds.js`: `empty`, `classic`, `corridor`, `winding`, `branchy`, `bushy`, `loopy`, `open`, `rooms`, with knobs such as `chambers` and `prune`). The carve's answer inside a reserved element rectangle is discarded.
5. **On-connector elements** — built after the carve, with a read-only view of the room (`floorAt`, `mainPath`, `isCut`, `connectedWith`). They write sparsely: a door cuts an existing area rather than making one. The on-connector heads are `killgate`, `blockpocket`, `rockgate`, `shortcut` and `shieldgate`. An element may declare a `demand` — cells that must stay floor or wall — so later steps cannot undo what it relies on.
6. **The area partition and area graph** — `procgenCore/areaPartition.js` marks a floor cell *wide* when it belongs to an all-floor 2×2 square; an *area* is a connected blob of wide cells. `procgenCore/areaGraph.js` (a JavaScript port of MetaZelda's lock-and-key logic) then places keys and locks between areas. It is asked for with `--areas=` / `?areas=` through `procgenCore/areaSpec.js`. On Seedling the goal gets a small vestibule so no lock lands on its doorstep. Detail: [Maze Substrate](./maze.md).
7. **Composites** (no draw) — the element's ring is re-walled, its entry joined to the connector by the shortest tunnel, its exit sealed, and its flag and lock placed.
8. **Certification** — the substrate's own solver runs once against the skeleton, before pass 2. A failed certification drops the element with a named refusal; nothing ships uncertified. With `--require=<item>` / `?require=`, the element head is derived from `ELEMENT_TABLE.needs` and the result is graded by `seedlingDemo/procgenRequirements.js` (`STRONG`, `BOUND-DEPENDENT`, `WEAK`, `INERT`, `NOT-ESTABLISHED`).

### Pass 2 — the keep-or-revert loop, site-typed

`procgenCore/levelGenerator.js` picks a template, instantiates its parameters, offers anchors, refuses illegal ones by name, solves, and keeps or reverts; it stops at the obstacle target or when nothing more fits.

- **Sites.** `procgenCore/sites.js` derives site classes from the skeleton once per model (`SITE_CLASSES`: `main`, `bend`, `branch`, `tip`, `chamber`, `corridor`, plus the default `any`). A template row declares one `site:`. A site only shapes where candidates are proposed; it never decides legality.
- **A door is a cut.** One flood-based rule for every door kind: with the row's cells painted and its `doorCells` walled, the goal must be unreachable from the start, and every `clearer` cell must still be reachable from the start.
- **Templates may carve**, within bounds: a `ground` write is legal only on untouched skeleton terrain, the carved cells must form one dead-end blob, and the start-to-goal path may not get shorter.
- **The template roster is decoration.** Door construction lives in the pass-1 elements; the pass-2 templates add walls, water and pits.

### The ledger, the step-through and the instruments

As it builds, the model records a **generation ledger** (`seedlingDemo/procgenLedger.js`): one row per phase, with a sentence and the phase's intermediate results as *paintables* (the door rule's floods, the area floods, the candidate funnel, the certification route). Recording draws nothing from the rng, so it cannot change the level. Each lab page rebuilds phase *k* from the rows and draws it; selecting a row's text line draws its intermediate result.

Both lab pages drive every generation parameter from a form as well as from the URL: seed, biome, skeleton kind and knobs, loop bounds, room size, area-graph keys, `require`, and the element head with its parameters. Changing a control resets the step-through to step 0, because all of these are fixed before pass 2 runs. Seedling's element control has an extra `(biome default)` state, because its default is the biome's spec while the maze's default is `none`.

Headless equivalents live in `scripts/procgen/`: `generate-seedling-level.mjs` and `generate-maze-level.mjs` (`--elements=`, `--areas=`, `--require=`, `--skeleton=`), `sweep-yield-table.mjs` for yield tables, and `check-procgen-demos.mjs`, which loads every demo-catalogue link and checks its claim. The full list is generated:

<!-- GENERATED:procgen-instruments BEGIN — by scripts/procgen/generate-procgen-reference.mjs; do not edit; regenerate -->

**281 instruments** live in `scripts/procgen/`, by prefix: `check-` 94 (58 browser) · `probe-` 61 (22 browser) · `plan-` 36 (1 browser) · `census-` 12 · `make-` 7 · `solve-` 7 · `sweep-` 6 · `dump-` 5 · `recon-` 5 · `region-` 5 · `generate-` 4 · no prefix 4 · `ci-` 3 · `extract-` 3 · `attribute-` 2 · `audit-` 2 · `export-` 2 (1 browser) · `measure-` 2 (1 browser) · `record-` 2 · `seedling-` 2 · `batch-` 1 · `build-` 1 · `derive-` 1 · `find-` 1 · `harvest-` 1 · `lint-` 1 · `migrate-` 1 · `mine-` 1 · `prove-` 1 · `reach-` 1 · `rerecord-` 1 · `run-` 1 · `shot-` 1 (1 browser) · `show-` 1 · `stamp-` 1 · `standing-` 1 · `survey-` 1.

84 of them drive a real browser; 203 accept at least one `--flag` OF THEIR OWN; 114 are cited by one of these documents; and 0 open with no comment at all.

Each also accepts what a module it IMPORTS parses: `--help` (279, in `argvHelp.js`) · `--wait-for-box` (105, in `boxLock.js`) · `--only` (1, in `rehearsalTree.js`) · `--record` (1, in `rehearsalTree.js`) · `--walk-report` (1, in `rehearsalTree.js`). Those are listed per row with the parse site named, so the table says what a file ACCEPTS without losing where the parse lives.

One row each — the one-liner from the file's own docblock, the flags it reads out of `argv`, whether it needs a browser, and which document cites it — is on the [reference page](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html#section-instruments), which can filter them.

<!-- GENERATED:procgen-instruments END -->

**Note:** two different step-throughs share the word. The [stepped pipeline](#the-stepped-pipeline) steps the *world* drivers and can be edited between steps. The ledger's phase list steps a *single level's* construction and is a read-only replay. They do not interact.

## The four layout drivers

The Procgen Pipeline panel's Mode control (`frontend/modules/procgenPipeline/procgenPipelineUI.js`) selects one of four drivers, all in `procgenPipelineEngine.js`:

| Mode | Engine entry | What it does |
|------|-------------|--------------|
| **Sphere growth** | `growSpheres` | The primary driver. Plans the sphere structure first (which items unlock which sphere, `spherePlanner.js`), then grows the world wave by wave to match. After compilation the actual item spheres are checked against the plan. See [Sphere-Driven Growth](./sphere-growth.md). |
| **Top-down** | `topDownFromRulesJson` | Realises an existing `rules.json` (for example one exported from a real game) as a playable procgen world: each source region gets a grid cell and a substrate, keeping the source's region graph and access rules. |
| **Shuffled spiral** | `arrangeShuffledSpiral` | Lays zones out in a spiral from the centre. This is the driver for content sources, whose regions are a fixed set of pre-authored zones rather than grown geometry. |
| **Grid growth** | `growMaze` | Deprecated. Grows a grid of rooms from a scenario pool. Still selectable; sphere growth replaces it. |

Substrates take part in two ways:

- **Procedural substrates** (such as the maze) generate region geometry on demand through build-time hooks on their registry entry, and draw from the rng stream.
- **Content sources** expose a fixed pool of zones (`zoneCount`) and build a region descriptor per zone with `extractZoneRules`, drawing no rng. The shuffled-spiral driver picks one content source per planned cell through `resolveSpiralContentSource`. A data-backed region library joins the same way. The contract is in [Substrate Registry Reference](./substrate-registry.md#build-time--content-sources-zone-based-substrates).

A substrate's registry entry may declare a `victoryItem`; when a quota'd substrate does, the pipeline uses it as the world's completion condition instead of a constant-true goal.

**Top-down details.** The source's declared start is treated as a hub when it has exits and no locations (`isVirtualStart`): it is stripped, and the layout is rooted at its exits' targets. A start with locations is placed like any other region. More than one declared start is refused (`TOPDOWN_START_REFUSALS`). Substrate library items the source neither defines nor starts with are granted as starting items (`grantedLibraryItems` in `topDownSteps.js`). The compile defines any item a rule names but no location holds, copying its definition from the source without adding it to the pool; names the source does not define either are listed in `ruleItemWarnings`.

## The stepped pipeline

All three non-deprecated drivers — sphere growth, top-down and shuffled spiral — can also run as a sequence of discrete, editable steps. The state between steps is a serialisable **envelope**, so intermediate results can be inspected and hand-edited in the panel or as JSON files between CLI runs (`scripts/procgen/sphere-step.js`, `topdown-step.js`, `spiral-step.js`).

| Driver | Steps | Module |
|---|---|---|
| Sphere growth | `plan → allocate → topology → items → regions → compile` | `procgenPipeline/sphereSteps.js` |
| Top-down | `layout → realise → finalize → compile` | `procgenPipeline/topDownSteps.js` |
| Shuffled spiral | `arrange → content → regions → compile` | `procgenPipeline/spiralSteps.js` |

At default settings the stepped run is byte-identical to the one-call driver. That contract, the per-step detail, hand-edit replay and the per-region editors are in [The Stepped Pipeline](./stepped-pipeline.md).

## rules.json extensions

A procgen-compiled `rules.json` is a standard rules file plus extra top-level keys. Three carry the world itself:

| Key | Purpose |
|-----|---------|
| `preset_sidecars` | Per player, per region: the **playable payload** — the serialised substrate world for that region (tile grids, platform geometry, prose templates, …) with its substrate id alongside. The substrate is chosen per region, so one world can carry several. This key is also how the runtime recognises a procgen world. |
| `procgen_metadata` | Per player (`{"<p>": block}`): generation metadata — source counts, the sphere tree, and enough structure to rebuild a stepped-pipeline envelope from a compiled file (`rebuildEnvelopeFromRulesJson`). A slot has an entry only when a producer wrote one. |
| `loop_costs` | Per player (`{"<p>": block}`): per-action mana costs for loop mode. A slot's entry turns loop mode on for that slot's world. Inside a block, `regions` maps a region name to a cost **object** (`moveCost`, `timeDrainPerSecond`, `xpEffect`), while `locations` maps a location name straight to a **number**. |

Six more appear in committed presets, each written by one producer:

| Key | Producer | Purpose |
|-----|----------|---------|
| `assume_bidirectional_exits` | `procgenPipelineEngine.js` | Every back-exit inherits its forward exit's rule, and consumers may construct back-exits the document does not list. Not the same field as the exporter's nested `exporter_settings.assume_bidirectional_exits`. |
| `region_atlas` | `procgenPipeline/regionAtlasCompiler.js` | Which atlas this graph was compiled from (`atlas_id`, `game`, optional `map_document`). The id ends in the atlas content hash, so a changed atlas visibly invalidates a stale preset. |
| `flash_panel` | `regionAtlasCompiler.js` (`FLASH_PANEL_WIRING`) and `tileMapAnalyzer/rulesExporter.js` | Wiring that boots the recompiled original game (`config`, `wasm` or `swf`). |
| `provenance` | `regionAtlasCompiler.js`, from `options.provenance`; `procgenCore/contentIdentity.js` adds `content_hash` | Opaque: whatever the producing generator wants to record about its inputs. |
| `preset_label` | `exporter/exporter.py`, from the world class's `preset_label` attribute | Short label on the preset's frontend button. |
| `playerId` | `exporter/exporter.py` | The slot id of a player-specific export; absent from the combined multiworld document. |

All of these are declared in `frontend/schema/rules.schema.json`, with sidecar entries typed by `$defs/presetSidecarEntry` (`substrate` required; `playable_payload` opaque because it belongs to the substrate). The top level is strict (`additionalProperties: false`), so a producer that adds an undeclared top-level key fails schema validation.

Everything else — regions, exits, locations, items, access rules — is ordinary `rules.json`, so non-procgen consumers need no special handling.

## Runtime: playing a generated world

**procgenPlayer** (`frontend/modules/procgenPlayer/`) is a headless coordinator. It has no panel, but it is what makes a procgen `rules.json` playable:

1. On rules load it checks for `preset_sidecars[playerId]`. If there is none, it does nothing.
2. Otherwise it builds a **warehouse** (`procgenPlayerEngine.js`): for each sidecar entry it looks up the substrate in the registry and calls the entry's `deserializeWorld(playable_payload)`.
3. As the player moves between regions it publishes the owning substrate's load event (`maze:loadRegion`, `flashSeedling:loadRegion`, …) with the deserialised world. The substrate's panel subscribes and renders the region.

**The start hop.** When the declared start region has exactly one exit and the *skip the menu* setting is on (`moduleSettings.menuPanel.skipMenu`, default `true`, owned by the [Menu panel](../../modules/menuPanel.md)), the player is moved straight to that exit's target. `menuPanelEngine.skipsStart` is the one rule; procgenPlayer publishes the hop for worlds it claims and the Menu panel for all others, so exactly one publisher acts per load. A start with several exits is a choice and is never skipped. Loop-mode resets return to the same place the load did.

Two systems sit on top:

- **Playback bot** (`frontend/modules/playbackBot/`) walks a recorded sphere log through the world. For each region it gets the substrate's `getPlaybackController()` from the registry and drives it directly, so each substrate implements its own "walk to X". See [Playback and Debugging](./playback-and-debugging.md).
- **Loop mode** (`frontend/modules/loops/`) is the idle-game layer: action queues, mana budgets, XP. It turns on when the loaded slot has a `loop_costs` entry. What each region offers in loop mode is declared by its substrate entry's `loopSupport`. See [Loop Recording and Block Modes](./loop-recording.md).

## Substrates at a glance

The registry has nine entries:

| id | Module | Load event | Notes |
|----|--------|-----------|-------|
| `maze` | `mazeRoom` | `maze:loadRegion` | Grid-room maze with biomes, hazards and an autopather. |
| `bounce` | `bounceDemo` | `bounce:loadRegion` | Vertical platformer with a physics-verified generator; reuses `flashSubstrate`'s panel code under its own identity. |
| `text_adventure` | `textAdventureSubstrateWrapper` | `textAdventure:loadRegion` | Iframe-hosted text adventure. |
| `flash` | `flashSubstrate` | `flash:loadRegion` | Iframe substrate for recompiled Flash games (SWF→WASM), speaking the `__swfBridge` contract. |
| `runner` | `runnerDemo` | `runner:loadRegion` | Auto-runner platformer with a physics-verified strip generator; like bounce, built on `flashSubstrate`. |
| `jta` | `jtaSubstrateWrapper` | `jta:loadRegion` | Journey to Ascension as a zone-based substrate. |
| `omsi` | `omsiSubstrateWrapper` | `omsi:loadRegion` | Idle Loops (the `omsi-loops` fork) as a loop-game substrate; requires loop mode. |
| `flash_seedling` | `flashPanel` | `flashSeedling:loadRegion` | A real room of the Seedling atlas as a pipeline region. |
| `flash_seedling_gen` | `flashPanel` | `flashSeedling:loadRegion` | A room built by the Seedling generator to the pipeline's spec. |

The entry contract and the generated capability matrix are in [Substrate Registry Reference](./substrate-registry.md#capability-matrix). `shared/` is a git submodule, so `git log` and `git blame` on the registry must run inside it.

Which substrates are live depends on the launch mode: `frontend/modes.json` maps modes to `frontend/module-configs/modules*.json` variants, each enabling a different module set.

## The Python round-trip

A procgen `rules.json` goes through the standard toolchain with its extra keys preserved:

1. `python -m world_generator <rules.json>` creates a world package under `worlds/` and writes the extra keys to package files: `_worldgen_sidecars.json`, `_worldgen_procgen_metadata.json`, `_worldgen_loop_costs.json` (`world_generator/generator.py`).
2. `python Generate.py` runs normal Archipelago generation for that world.
3. The exporter's base handler (`exporter/games/base/handler.py`, `_inject_worldgen_*`) puts those files back as top-level keys of the new `rules.json`.

The result has real multiworld item distribution and still plays as a procgen world.

A world package is one slot's world, so each package file holds one block: the generator writes the source's entry for that player (and no file if there is none), and the handler merges each package's block under its exporting player, `export_data[KEY][str(player)]`. All three keys are in the exporter's `PLAYER_SPECIFIC_KEYS`, so a per-player (`_P<n>`) export carries only its own slot's entry. `test/test_export_player_slicing.py` checks this against a committed fixture.

**The four-player fixture.** `frontend/presets/multiworld/AP_05594871498841892311/` (seed 4) is the round trip for four slots across two games: two `Procgen Maze WorldGen` (`worlds/procgen_maze_worldgen`) and two `Bounce Demo WorldGen` (`worlds/bounce_worldgen`). It is the committed document whose `preset_sidecars` carry more than one slot. The bounce package ships no metadata file, so slots 3 and 4 carry no `procgen_metadata`.

**Warning:** the preset folder is chosen by seed id alone, so a multi-game generation at seeds 1–3 overwrites the committed multiworld presets. Pick a free seed.

## Editing

Level and document editing are documented separately:

- [Procgen Editing Core](./editing-core.md) — the substrate-free edit core and editor view, the adapter contract, the `procgenCore/` rules.json and atlas toolkit, the op vocabularies, and the set-editor mount.
- [The Seedling Editor](./seedling-editor.md) — the Seedling room and level-set editors, the world editor over several set documents, and the `watch.html` EDIT arm.

## Bundles

The single `rules.json` is canonical and always loadable. A **bundle** is an optional ZIP whose members are documents this repo already writes, with no manifest (the documents describe themselves). The kinds are `BUNDLE_KINDS` in `frontend/modules/presets/documentBundle.js`:

| Kind | What it is | How it is recognised |
|------|------------|----------------------|
| `rules` | a `rules.json` | `schema_version` is 3 and `regions` is an object |
| `level-set` | a Seedling level set | `rooms` is an **array** (position is the id) |
| `overlay` | a set's rule/location overlay | an `overlay_id`, or `rooms` keyed **by index** |
| `region-atlas` | a region atlas | an `atlas_id` and `regions[].region_id` |
| `region-library` | a region library | a `library_id` and an `entries` array |
| `world` | several set documents, their overlays and the crossings between them | a `parts` object and a `links` array |

`classifyDocument` is the one classifier: the Seedling page's LOAD box (`sniffLoadBox` in `watchViewer.js`) delegates to it, and the kind comes from the document, never from the entry name. `writeBundle` is deterministic: fixed entry order by kind, a fixed mtime (`BUNDLE_MTIME`), and the rules member written through `stringifyRulesJson`.

Two members of one kind are refused, since the bundle would not say which one is meant. A `.chunks.json` member is refused because chunking is a delivery format, not an authored document. An unrecognised member is listed in `notes` rather than silently dropped.

Bundles are written by `#editDownloadBundle` on `watch.html` and by `export-seedling-level-set.mjs --bundle`, and read by `#editLoadFile` (which sniffs the first two bytes: `50 4b` for zip, `1f 8b` for gzip) and by the main app's preset file input, which loads the `rules` member.

JSZip is injected rather than imported: `frontend/libs/jszip/jszip.min.js` is a vendored UMD script, which a page loads with `loadJSZipBrowser` and node evaluates with `scripts/procgen/loadJSZipNode.mjs`. `createRequire` cannot load it because the root `package.json` is `"type": "module"`.

## Minify, and gzip

`stringifyRulesJson(doc, {indent})` takes an indent, set in one place per side:

- **Frontend** — the `rulesJson.indent` setting (declared in `documentBundle.js`, registered by `app/core/coreSettingsSchemas.js`). `watch.html`'s `#editMinify` box sets it for that page.
- **Python** — `json_tools.rules_json_indent`, read by `exporter.py`'s writer.

The default is 2, the indentation of the committed presets. `test/test_rules_json_writer_agreement.py` checks that the JavaScript and Python writers produce the same bytes for every committed preset.

**Note:** Python's `json.dumps(obj, indent=0)` is not minified — it still emits a newline before every element — while JavaScript's `JSON.stringify(obj, null, 0)` is. The exporter maps 0 to `separators=(',', ':')` so both writers agree on what "minify" means.

**Gzip** is a loader feature. `gunzipIfNeeded` sniffs the `1f 8b` magic bytes, never the file name or a `content-encoding` header, because the browser has already decoded a wire-gzipped response. It uses the native `DecompressionStream`. No committed preset is gzipped: GitHub Pages already compresses on the wire, so this exists only for `.json.gz` files someone else provides.

## Determinism and verification

- **Seeded rng everywhere.** All generation randomness comes from `createRng(seed)` (`frontend/modules/shared/rng.js`, mulberry32 with `getState`/`setState` for step-boundary snapshots).
- **The sphere plan is an oracle.** In sphere-growth mode, the compile step recomputes the item spheres of the built world and compares them to the plan; the CLI exits non-zero on a mismatch.
- **Headless CLI.** Everything the panel does can run in Node under `scripts/procgen/`: dump scripts per driver, per-step drivers and byte-identity checks. See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).
- **In-app round trip.** `scripts/procgen/check-bounce-embed.mjs` drives a generated bounce world through the real frontend with Playwright, from first check to victory.

## Related documentation

- [Procgen Editing Core](./editing-core.md) · [The Seedling Editor](./seedling-editor.md)
- [Loops feature](../../features/loops.md) — loop mode from the user side
- [Module System](../guides/module-system.md) — how frontend modules register
- [World Generator](../guides/world-generator.md) — JSON → Python world conversion
- [Headless procgen scripts](../../../../scripts/procgen/README.md) — CLI reference
