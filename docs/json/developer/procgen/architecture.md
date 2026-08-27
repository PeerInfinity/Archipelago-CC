# Procedural Generation Architecture

This is the orientation document for the procedural-generation ("procgen") system: the pipeline, the four layout drivers, **level generation's two passes** (elements and the certified area graph, then the site-typed keep-or-revert loop), the substrates, what a world compiles to, and how it is played back. Read this first; the rest of this section goes deeper on individual pieces.

## What procgen is in this fork

The frontend can generate complete multi-region game worlds — regions, entrances, locations, items, access rules, and the per-region playable content — and compile them to a standard `rules.json`, the same format exported from real Archipelago games. Because the output is ordinary `rules.json` (plus a few extra top-level keys, described below), a generated world round-trips through the whole existing toolchain: it can be played directly in the frontend, converted to a Python world package by `world_generator`, run through `Generate.py` for real Archipelago item distribution, and re-exported.

The per-region playable content is produced by **substrates** — pluggable per-region game engines (a maze, a Doodle-Jump-style platformer, a text adventure, …). A single generated world can mix substrates: one region is a maze, the next is a platformer level.

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

Three properties hold everything together:

- **One output format.** Every driver ends in `buildRulesJson` (`frontend/modules/procgenPipeline/procgenPipelineEngine.js`), producing a standard `rules.json` that every existing consumer (tracker, region graph, world generator) understands.
- **Dispatch by id.** Build-time generation and runtime playback both go through the substrate registry, so substrates and the pipeline stay decoupled.
- **Determinism.** Given the same `(seed, parameters)`, generation reproduces the same world byte-for-byte. Random draws come from a single seeded rng stream (`frontend/modules/shared/rng.js`), which is what makes the stepped pipeline and the verification tooling possible.

## Level generation: two passes over one loop core

The drivers above build the *world* — regions, entrances, items, rules. What fills a **single region** is a second, smaller pipeline with its own shape, and this is the orientation for it. It is shared by the two substrates that have a lab page (Seedling's `seedlingDemo/watch.html`, the maze's `mazeRoom/lab.html`) and it runs over one substrate-neutral loop core, `frontend/modules/procgenCore/levelGenerator.js`. The design and its arcs are recorded in [Seedling Real-Game Bot](./seedling-bot.md) § *The procgen ELEMENTS design* (Seedling, arc 3) and [Maze Substrate](./maze.md) § *The area graph* / § *The first element* (the maze, arcs 1–2); every feature of it that can be shown in a browser has an entry in the demo catalogue — [the page](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html), its data in `frontend/modules/procgenDocs/demos.js`, pointed at by [Demonstrations — a catalogue](./demos.md). ⛓ And every TABLE this pipeline's vocabulary needs — the URL grammar of both lab pages, the generation catalogue (biomes, templates and their parameter domains, the element heads, the skeleton kinds), and the refusal vocabulary — is [**the reference page**](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html), which is GENERATED from the code by `scripts/procgen/generate-procgen-reference.mjs` and gated by `--check` (regenerate = no diff): ⛔ do not re-type one of those tables into a doc.

⛓ **Every term this section uses in a special sense is defined in [the procgen glossary](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/glossary.html)** — `site`, `the carve`, `element`, `demand`, `the door law`, `cut`, `clearer`, `area`, `key level`, `vestibule`, `certification`, `graded refusal`, `byte-inert` and 136 others, each with a plain-language sentence before the rule. It is one data module, `frontend/modules/procgenDocs/glossary.js`, read by that page, by every demo-catalogue entry's `terms:` line, and by the two lab pages, whose section summaries carry a term's sentence as a tooltip.

**A level is generated in two passes.** Pass 1 constructs the things the level is *about* and certifies them with a solver; pass 2 decorates what pass 1 left, one candidate at a time, keeping or reverting each. The rule that separates them is ⚖ design ruling 24 — **area is pass 1's job**: a pass-2 template that needs open space proposes only where pass 1 made some, and is honestly NO_ANCHOR elsewhere.

### Pass 1 — the skeleton, in draw order

Seedling's model is `seedlingDemo/procgenSeedling.js`; the maze's is `mazeRoom/procgenMaze.js`. Both draw from one room-construction rng stream, in this order:

1. **The GOAL** — the stream's first draw, at Manhattan **≥ 3** from the start (`GOAL_MIN_FROM_START = 3`). At distance `m` the shortest path is ≥ `m+1` cells, so `m ≥ 3` is what makes *a door element is never refused for the goal's position alone* a proof rather than a margin (§ *Arc 3, slice 4c*).
2. **The ELEMENT head** — which pass-1 constructor this level gets. With nothing asked, `procgenSeedling.defaultElementsFor(items)` supplies the **biome default spec** at the seam: `guard;len=2|3|4+blockpocket+chamber;w=2;h=3` pre-sword, `guard;len=2|3|4+killgate+blockpocket+chamber;w=2;h=3` post-sword (arc 5 slice 6a gave the guard a DRAWN `len` and added the chamber; R9 slice 1 narrowed that draw to a **subset** — `len` 5 and 6 place nothing in a 10×10 room). A `key=v1|v2|v3` value draws ONE member, in the same place in the stream a bare parameter draws from the whole domain; a single value is a PIN and spends no draw. A `+` list is a **CHOICE** (one `rng.pick`, because one block per level forbids a conjunction), and `ELEMENT_TABLE.<head>.needs` gates a head against the biome's boot items for free — a pre-sword `killgate` refuses without spending a solve (§ *Arc 3, slice 4a* / *4c*).
3. **`pre-carve` elements** — constructed *before* the connector, in absolute coordinates inside a snug rectangle the binding offers, writing their whole site (floor *and* wall). The one shipped here is the reverse-pull block gadget, `procgenCore/elements/reversePullBlock.js`, at `turns = 0`; `turns > 0` refuses `the-chain-is-arc-4` by name and spends no draw. Its site margin is measured, not inherited (`SITE_MARGIN_STRAIGHT = 2`, against the maze's 4, which offers zero sites in 20 of 30 (kind, len) cells on a 10×10 room).
4. **THE CARVE** — the connector, i.e. the maze algorithms reused as corridor/chamber carvers (`procgenCore/skeletonKinds.js`: `empty` · `winding` · `branchy` · `bushy` · `loopy` · `open` · `rooms`, with `chambers=k` / `minRoom` / `prune`). The carve runs over the whole grid and its answer *inside* a reserved element rectangle is discarded. ⚖ Seedling's five carved **tree** kinds default to `chambers = 1` (kept over those five kinds **4 → 102** of 120 pre-sword and **4 → 105** post-sword, against `chambers=2`'s 113/103) — § *Arc 3, slice 4b*.
5. **`on-connector` elements** — constructed *after* the carve, handed a read-only room probe (`floorAt`, `mainPath`, `isCut`, `connectedWith`, the binding's own `doorLaw`) and writing **sparsely**: a door does not make an area, it cuts one. Two ship: the **kill gate** (a lock on a main-path cut with a spinner beyond it, which **grows** its wall until the wall meets the room — 0 cells on a corridor, 7 on the open 10×10 room) and the **block pocket**. The kill gate declares a `demand`: the connected **region** its body can reach must stay floor and the walls confining it must stay wall, because the body is a diagonal billiard rather than an axis runner. Before the demand, 2 of 10 certified gates were opened by `water` rather than by the sword; after it, **17 of 17 `sword`** (§ *Arc 3, slice 4d*).
6. **The AREA PARTITION and the AREA GRAPH** — `procgenCore/areaPartition.js` (one rule, two substrates: a cell is WIDE iff it belongs to an all-floor 2×2 square; an AREA is a maximal 4-connected blob of wide cells; every other floor cell is a corridor cell, an edge) feeding `procgenCore/areaGraph.js`, a JS re-implementation of MetaZelda's lock-and-key logic. Asked for with `--areas=<keys>` / `?areas=` through one codec (`procgenCore/areaSpec.js`). Realisation puts a lock on **every boundary cell** of an area at key level ≥ 1 and its flag inside the area that holds the symbol; on the maze that makes every placed symbol a cut **148 of 148**, and on Seedling the goal gets a declared radius-2 **vestibule** so no lock lands on its doorstep. Acceptance is published rather than tuned: `--areas=1` runs on **0–4 of 12** seeds per kind on a 10×10 room (§ *Arc 3, slice 4b*).
7. **Composites** (no draw) — the element's ring re-walled, its entry mouth joined by the shortest tunnel, its **exit mouth sealed** (with both open the door is not a cut on ~30% of runs), the flag placed and its lock realised.
8. **CERTIFICATION** — the substrate's own solver run against the skeleton, once, before pass 2 exists. Seedling's is the R8 bot + S1's nested openers; the maze's is a BFS over `(player, blocks, inventory)`. A failed certification is a **graded refusal by name** and the element is dropped, never shipped uncertified. Each certification carries a **lifted claim** — for the guard, *a block was on the button at the tick the door was first crossed*; the guard certifies **32 of 34** placements, the block pocket **36 of 36**, the kill gate **6 of 28** post-sword (the 22 refusals are one pre-existing solver class, R9's). When `--require=<item>` / `?require=` is asked, the element head is **derived** from `ELEMENT_TABLE.needs` and the run is graded by the requirements differential (`seedlingDemo/procgenRequirements.js`: STRONG / BOUND-DEPENDENT / WEAK / INERT / NOT-ESTABLISHED), with seven named refusals and exit 6 when it cannot be met (§ *Arc 3, slices S1, 4a, 4d*).

### Pass 2 — the keep-or-revert loop, site-typed

`procgenCore/levelGenerator.js` is unchanged in shape: pick a template, instantiate its parameters, offer anchors, refuse the illegal ones by name, solve, keep or revert; stop at the obstacle target or at saturation. What arc 3 added:

- **SITES.** `procgenCore/sites.js` derives six classes once per model from the skeleton — `main` · `bend` · `branch` · `tip` · `chamber` · `corridor`. A row declares one `site:` class; the default `'any'` is the whole interior, so a row that declares nothing is byte-inert. ⛔ A site is a **proposal distribution, never a legality rule**.
- **A DOOR IS A CUT.** One flood-based law, every kind: with the row's terrain painted and its `doorCells` walled the goal is unreachable from the start (CUT), and every `clearer` cell is still reachable from the start (START-SIDE). It replaced the interior-span law and `doorClear`, unified rather than kinds-scoped on the evidence — 40 seeds × 20 instantiations, **zero disagreements** with the retired predicate (§ *Arc 3, slice 2*).
- **TEMPLATES MAY CARVE**, bounded: a `ground` write is legal on untouched skeleton terrain (`terrainAt(record) === terrainAt(base)`), the carved cells must be one 4-connected blob with exactly one mouth (a dead end), and the start→goal path may not get shorter.
- **THE ROSTER IS DECORATION NOW.** All three door TEMPLATES retired into the pass-1 elements above: **41/45 instantiations → 23/23**, three families (wall · water · pit), all `site:'chamber'`, and the two biome palettes differ only in `items` (§ *Arc 3, slice 4c*).

### The ledger, the step-through and the instruments

The model records a **generation ledger** (`seedlingDemo/procgenLedger.js`) as it constructs — one row per phase, appended *by* the phase, byte-inert (proved by a counting spy on the draw stream, 336 pairs / 0 moved). Each row carries its own sentence plus its intermediate results as uniform **paintables**: the door law's two floods, the level-n floods and the goal's vestibule, the on-connector candidate funnel (offered ⊇ tried ⊇ legal) and the certification solve's route with its gaps named. The lab page rebuilds phase *k* from the row deltas and hands it to the existing renderer — nothing is re-run — and ⚖ per the user's ruling of 2026-08-18 an intermediate result is drawn **when its text line is selected**. Ledger cost, measured five times on each build in one tree: median **1.048× → 1.129×**, worst observed 1.190× (§ *Arc 3, slices 5a and 5b*).

⛓ **Both lab pages drive every generation parameter from a FORM**, not only from the address bar (the maze lab has since arc 1; Seedling's caught up in R9 slice 0): the seed, the biome, the skeleton kind and its knobs, the four loop bounds, the room's width/height/fill, the area-graph key count and its knobs, the `require` directive, and the element head with its own parameter sub-form. Every option comes from the CODEC's own domain rather than a second list; the form is read at the PRESS and never cached; and a changed control RESETS the ladder to step 0 with the reason said, because the room, the graph, the directive and the element are all fixed before pass 2 runs. ⚠ Seedling's element control has a THIRD state the maze's does not — `(biome default)`, i.e. *nobody said* — because Seedling's default is the biome's own spec while the maze's is `none`; a control that spelled it `none` would silently turn the biome default off on every load.

Headless equivalents of everything the pages do live in `scripts/procgen/`. The two that matter most here are `generate-seedling-level.mjs` and `generate-maze-level.mjs` (`--elements=` · `--areas=` · `--require=` · `--skeleton=`), with `sweep-yield-table.mjs` — the yield table, the arc's primary instrument — beside them; `check-procgen-demos.mjs` IMPORTS the catalogue module (`frontend/modules/procgenDocs/demos.js`), loads every link it holds — the same links `procgenDocs/demos.html` renders — and asserts each entry's own claim. ⛔ The rest is no longer a list anybody keeps by hand:

<!-- GENERATED:procgen-instruments BEGIN — by scripts/procgen/generate-procgen-reference.mjs; do not edit; regenerate -->

**257 instruments** live in `scripts/procgen/`, by prefix: `probe-` 60 (22 browser) · `verify-` 49 (30 browser) · `plan-` 36 (1 browser) · `check-` 30 (22 browser) · `census-` 12 · `solve-` 7 · `dump-` 6 · `make-` 6 · `sweep-` 6 · `recon-` 5 · `region-` 5 · `generate-` 4 · `extract-` 3 · no prefix 3 · `attribute-` 2 · `audit-` 2 · `export-` 2 (1 browser) · `batch-` 1 · `build-` 1 · `ci-` 1 · `derive-` 1 · `find-` 1 · `harvest-` 1 · `lint-` 1 · `measure-` 1 · `mine-` 1 · `prove-` 1 · `reach-` 1 · `record-` 1 · `rerecord-` 1 · `run-` 1 · `seedling-` 1 · `show-` 1 · `stamp-` 1 · `standing-` 1 · `survey-` 1.

76 of them drive a real browser; 158 accept at least one `--flag`; 85 are cited by one of these documents; and 0 open with no comment at all.

One row each — the one-liner from the file's own docblock, the flags it reads out of `argv`, whether it needs a browser, and which document cites it — is on the [reference page](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html#section-instruments), which can filter them.

<!-- GENERATED:procgen-instruments END -->

⚠ **Two different "step-throughs" share a word.** The [stepped pipeline](#the-stepped-pipeline) below steps the *world* drivers (plan → allocate → … → compile) and is editable between steps. The generation ledger's phase ladder steps a *single level's* construction and is a read-only replay of what already happened. They do not interact.

## The four layout drivers

The Procgen Pipeline panel's Mode toggle (`frontend/modules/procgenPipeline/procgenPipelineUI.js`) selects one of four drivers, all implemented in `procgenPipelineEngine.js`:

| Mode | Engine entry | What it does |
|------|-------------|--------------|
| **Sphere growth** | `growSpheres` | The primary driver. Plans the sphere structure first (which items unlock which sphere, via `spherePlanner.js`), then grows the world outward wave by wave so the built world matches the plan. The plan doubles as a verification oracle: after compilation, the actual item spheres are compared against the planned ones. |
| **Top-down** | `topDownFromRulesJson` | Realises an *existing* `rules.json` (e.g. exported from a real game) as a playable procgen world: each source region is placed in a grid cell and realised by a substrate, preserving the source's region graph and access rules. |
| **Shuffled spiral** | `arrangeShuffledSpiral` | Lays zones out in a spiral chain from the center. This is the driver for zone-based substrates (see below) whose content is a fixed set of pre-authored zones rather than procedurally grown geometry. |
| **Grid growth** | `growMaze` | **Deprecated.** The original driver: grows a grid of rooms from a scenario pool. Sphere growth is its replacement; grid growth remains selectable but does not receive new features. |

Two kinds of substrate participation:

- **Procedural substrates** (maze, bounce, text adventure) generate region geometry on demand from build-time hooks on their registry entry.
- **Content sources** (zone-based substrates: jta, bounce, runner, omsi) instead expose a fixed `zoneCount` (pool size) and instantiate a region descriptor per ordinal via `extractZoneRules`; the shuffled-spiral driver arranges those entries into a world, resolving one content source per planned cell through a single seam (`resolveSpiralContentSource`). A content source instantiates without drawing rng — only procedural substrates consume the rng stream. This "content source" reframing (region-library cleanup, see [Substrate Registry Reference](./substrate-registry.md#build-time--content-sources-zone-based-substrates)) is what lets a data-backed **region library** join as a content source alongside code-backed ones.

A substrate's registry entry may declare a `victoryItem`; when a quota'd substrate does, the pipeline uses it as the world's completion condition instead of a constant-true goal.

## The stepped pipeline

Sphere growth and top-down can also run as a sequence of discrete, editable steps instead of one monolithic call. The unit of state is a serializable **envelope** that each step reads from and merges into, so intermediate results can be inspected and hand-edited — in the panel, or as JSON files between CLI invocations.

- **Sphere growth — 6 steps** (`frontend/modules/procgenPipeline/sphereSteps.js`): `plan → allocate → topology → items → regions → compile`. A `spheresPerBatch` knob turns the middle four steps into a per-batch loop (① plan once → per batch: allocate/topology/items/regions → ④ compile once) for sphere-major growth.
- **Top-down — 4 steps** (`frontend/modules/procgenPipeline/topDownSteps.js`): `layout → realise → finalize → compile`. Each region realises from its own sub-seed, so re-running a later step after a hand-edit stays deterministic.

**The byte-identity contract.** Running the stepped pipeline with default batching produces output *byte-identical* to the monolithic driver. This is a load-bearing invariant, not a test nicety: the panel and the CLI share the same step-runner modules precisely so the wiring cannot drift, and the rng is threaded across step boundaries as a single continuous stream consumed in the monolithic order. Code that adds or reorders rng draws breaks this contract; the headers of `sphereSteps.js` explain the threading rules, and `scripts/procgen/verify-*.mjs` scripts check it.

The step-by-step CLI drivers are `scripts/procgen/sphere-step.js` and `scripts/procgen/topdown-step.js`; see [scripts/procgen/README.md](../../../../scripts/procgen/README.md).

## rules.json extensions

A procgen-compiled `rules.json` is a standard rules file plus up to three extra top-level keys:

| Key | Purpose |
|-----|---------|
| `preset_sidecars` | Per-player, per-region **playable payloads** — the serialized substrate world for each region (tile grids, platform geometry, prose templates, …), keyed by region id with the substrate id alongside. **The substrate is per REGION, and always was on this side**: one sidecar per AP region, each naming its own. What the atlas compiler adds is where that id comes from — the atlas region's own optional `substrate` field, else the compile's default (`options.substrateId`, else the maze flavour, else the atlas game's `flash_<game>`) — so one compiled preset can now carry two substrates the way a grown one always could. This key is also the marker the runtime uses to recognize a procgen world. |
| `procgen_metadata` | Generation metadata: source counts, the sphere tree, and enough structure that a stepped-pipeline envelope can be rebuilt from a compiled `rules.json` (`rebuildEnvelopeFromRulesJson` in the engine). |
| `loop_costs` | Per-action mana costs for loop mode. Its presence is what enables loop mode for the world. |

Everything else in the file — regions, exits, locations, items, access rules — is ordinary `rules.json` content, which is why non-procgen consumers need no special handling.

## Runtime: playing a generated world

**procgenPlayer** (`frontend/modules/procgenPlayer/`) is a headless coordinator — it has no panel, which makes it easy to overlook, but it is the piece that makes a procgen `rules.json` playable:

1. On rules load it checks for `preset_sidecars[playerId]`. Absent → it stays completely out of the way (a non-procgen world).
2. Present → it builds a **warehouse** (`procgenPlayerEngine.js`): for each sidecar entry it looks up the substrate in the registry and calls the entry's `deserializeWorld(playable_payload)`, storing `{ substrate, world, loadRegionEvent }` per region.
3. It resolves the start region by walking `start_regions` (following a synthetic AP start region's exits into the warehouse when needed) and, as the player moves between regions, publishes the owning substrate's load event — `maze:loadRegion`, `bounce:loadRegion`, `runner:loadRegion`, `textAdventure:loadRegion`, `flash:loadRegion`, `jta:loadRegion`, or `omsi:loadRegion` — with the deserialized world as payload. The substrate's panel subscribes and renders the region.

Two systems layer on top of this:

- **Playback bot** (`frontend/modules/playbackBot/`) walks a recorded sphere log through the world. For each region it resolves the current substrate's `getPlaybackController()` from the registry and drives the controller directly (bypassing the eventBus), so each substrate implements its own "walk to X" semantics — bounce, for example, synthesizes real physics input.
- **Loop mode** (`frontend/modules/loops/`) is the idle-game layer: action queues, mana budgets, XP. It activates when the loaded `rules.json` has `loop_costs`. What loop-mode affordances a given region gets (queueable actions, manual play, custom queues) is declared by the `loopSupport` field on its substrate's registry entry.

## Substrates at a glance

| id | Module | Load event | Notes |
|----|--------|-----------|-------|
| `maze` | `mazeRoom` | `maze:loadRegion` | Grid-room maze with biomes, hazards, and an autopather. |
| `bounce` | `bounceDemo` | `bounce:loadRegion` | Doodle-Jump-style vertical platformer with a physics-verified generator. Reuses `flashSubstrate`'s panel/bridge *code* but registers its own panel identity and iframe. |
| `text_adventure` | `textAdventureSubstrateWrapper` | `textAdventure:loadRegion` | Iframe-hosted text adventure. This is the enabled path; the direct-panel `textAdventureSubstrate` module registers the same substrate id but is disabled in the default module config. |
| `flash` | `flashSubstrate` | `flash:loadRegion` | Iframe substrate for recompiled Flash games (SWF→WASM), speaking the `__swfBridge` contract. |
| `runner` | `runnerDemo` | `runner:loadRegion` | Auto-runner platformer with a physics-verified strip generator. Like bounce, it reuses `flashSubstrate`'s panel/bridge code under its own identity. |
| `jta` | `jtaSubstrateWrapper` | `jta:loadRegion` | Journey to Ascension as a zone-based substrate. |
| `omsi` | `omsiSubstrateWrapper` | `omsi:loadRegion` | Idle Loops (the `omsi-loops` fork) as a loop-game substrate: host-owned clock, mana mirrored into the shared pool, N regions overlaying one town. `requiresLoopMode`. |

The registry entry contract these modules implement is documented in the substrate registry's header (`frontend/modules/shared/procgen/substrateRegistry.js`). Note that `shared/` is a git submodule — `git log`/`blame` on those files must run inside the submodule.

Which substrates are actually live depends on the module configuration the app was launched with: `frontend/modes.json` maps launch modes to `frontend/module-configs/modules*.json` variants, each enabling a different module set.

## The Python round-trip

A procgen `rules.json` goes through the standard toolchain, with the extra keys preserved end to end:

1. `python -m world_generator <rules.json>` creates a world package under `worlds/`, writing the extra keys to sidecar files in the package: `_worldgen_sidecars.json`, `_worldgen_procgen_metadata.json`, `_worldgen_loop_costs.json` (`world_generator/generator.py`).
2. `python Generate.py` runs the normal Archipelago generation for that world.
3. The exporter's base handler re-injects the sidecar files as top-level keys in the newly exported `rules.json` (`exporter/games/base/handler.py`, `_inject_worldgen_*`).

The result is a rules file with real multiworld item distribution that the frontend still recognizes and plays as a procgen world.

## The edit core (`procgenCore/editCore.js`)

Two substrates now have a level editor and a third is planned, so the editing
machinery lives in `procgenCore/` — pure, no DOM, and (like every shipping
module of that directory) with no substrate import at all.

**An adapter** is a plain object the caller supplies; the core registers none
and imports none:

| member | contract |
|---|---|
| `name` | what a refusal calls the substrate |
| `apply(record, op)` | ONE atomic op → `{ok, op, description, record?, reason?}`. The `op` returned is the RESOLVED one (every drawn parameter spent). `ok: false` is a refusal by name; the input record is never mutated. ⛓ `reason` is OPTIONAL and is a refusal CLASS rather than a sentence (Seedling names its four — `SeedlingSetAdapterError`, `SeedlingSetOverlayError`, `LevelSetExitError`, `SeedlingSetDeriveRefusal`), so a page can BRANCH without parsing `description`. The session and the group's member-refused arm carry it; the two catches that SYNTHESISE a refusal (`setEditorView`'s `applySet`, `editorView`'s `applyOp`) set it to the thrown error's own `name`. The core NEVER invents one — an adapter that gives none produces a result with no `reason` KEY, so `'reason' in res` means the substrate answered. |
| `equal(a, b)` | record equality — the "did anything change" test |
| `bounds(record)` | `{w, h}`, the cell grid |
| `readCell(record, x, y)` | a closed, comparable cell DESCRIPTOR |
| `writeOps(descriptor, x, y)` | the atomic ops that make that cell look like the descriptor — the inverse of `readCell`, emitting ops only for the fields the descriptor PRESENTS |
| `bases` (OPTIONAL) | `{kind: (tag) => record}` — how a payload's `base` tag becomes a record. Absent means the substrate's PAGE resolves it, which is the maze's case; a resolver whose body was "the record you already have" would be a tautology wearing a mechanism's name. |

`assertAdapter` checks that shape. `assertAdapterBehaviour(adapter, {record, op, refused, cell, other})` checks the seven things every function here silently assumes — bounds are positive integers, `apply` answers the contract, `apply` does not mutate its input, `equal` is true of a record against itself and false after a real op, a refusal carries a sentence, `writeOps` returns an array, and `readCell` → `writeOps` → `readCell` reproduces the descriptor **at a different cell**. That last qualifier is the point: a fixed point on the cell the descriptor came from is passed by a `writeOps` that returns nothing. It ships from the core rather than living in a test file because the next adapter author has the same seven assumptions to satisfy.

`resolveBase(adapter, tag)` is the one place a `{kind, …}` tag is interpreted, and the core still does not interpret it — it routes on `kind` and the adapter answers. A kind the adapter does not offer refuses by name, and so does a substrate with no `bases` at all, with two different sentences.

**The six functions** over any adapter:

- `foldEdits(adapter, base, ops)` — base → ops in order → `{record, applied, steps, dropped}`. The ONE reconstruction. `steps` carries the applied ops WITH the adapter's own sentence, so a page's readout needs no second walk over the same application path.
- `createEditSession(adapter, baseRecord, {base, certified})` — `apply` / `undo` / `ops` / `record` / `certified` / `setCertified` / `payload`. `payload()` is `{base, edits, certified}`, where `base` is an opaque tagged value (`{kind, …}`) the core never interprets.
- `group(label, ops)` — a stroke, a fill, a paste: applied ALL-OR-NOTHING, ONE entry in the op list, ONE undo. Nested groups are refused by name (a stroke is flat, or "one group is one undo" has no meaning).
- `rectCopy` / `rectPasteOps` — a rectangle of descriptors, pasted back as a group and clipped to the destination's bounds. The filter is `only: '<descriptor field>'`, and `tilesOnly` / `entitiesOnly` are aliases into it — so a substrate whose cells carry three layers gets three filters the day its descriptor does, without the core holding an enum of layer names. A filter naming a field the descriptor lacks is refused by name rather than silently ignored. Seedling's cells are `{tile, cliff, entities}` and the maze's are `{tile, entity}`; both are answered by the same selector.
- `floodOps` — the 4-connected component of cells whose whole descriptor matches the seed's, repainted as a group. The walk is `gridFlood.reachableFrom`, not a second flood.
- `describeOps(ops)` — the readout line, e.g. `3 edit(s) (1 group of 12)`.

**The two laws.**

1. **Identity is `base` + `ops`.** UNDO is the fold over a SHORTER list — never an inverse op and never a stack of records — so a level reached by undoing is byte-identical to one that never had the popped edit.
2. **A no-op is not an edit.** The question is asked of the RECORD through the adapter's `equal`, never of the op or the editor's descriptor: `MazeRoomEditor._setTile` reports `ok: true` for a click on a cell that already holds that tile, and counting it would bump the edit count and drop the certification for a press that moved no bytes.

Nothing in the core adjudicates legality. Free means free; certification is the guard, and every refusal here is about the SHAPE of an op or an adapter.

**The toy-adapter rule.** `editCore.test.js` drives a toy substrate written in the test file and imports nothing from `mazeRoom/` or `seedlingDemo/` — asserted by reading its own source. A core proven only against one substrate is that substrate's editor with an extra indirection.

**Adapters today.** Two. The maze's is `mazeRoom/mazeEditAdapter.js`, a wrapper over `mazeRoomEditor.applyEditOp`. Seedling's is `seedlingDemo/seedlingEditAdapter.js`, a wrapper over `watchEdit` — see the Seedling editor section below for what it resolves and what it bounds.

## The editor view (`procgenCore/editorView.js`)

The DOM half of the same split, and the only thing on a page allowed to decide
what a press on the canvas does. It imports `editCore.js` and nothing else.

It owns four things:

1. **The canvas tool — one `armed` value.** `brush`, `rect`, `paste`, `flood`, a tool the page brought, or nothing; `Escape` clears it. A page that kept a second "which tool" flag beside it would have two answers to what a click does. A **page tool** is `{id, label, key, at(cell)}` — Seedling's GENERATE arm has a click-to-anchor template gesture that predates this file and is not an edit, and delegating only the editing half would have left two armed states on one canvas. The four remain the vocabulary the view owns; `tool` may also name a gesture the page brought, and whether that gesture is one-shot is decided in its own `at`, not here.
2. **The stroke is ONE group.** A drag paints every cell it visits, de-duplicated and in visit order, and records ONE `group` — so one undo takes the whole stroke back and `describeOps` reports a history a person can count. The click a browser fires after the release is swallowed, so a single press lands exactly once.
3. **The command table is the one writer of the key map.** The page supplies `{id, label, key, run}` rows; the view adds the four tools and `Escape`; the keyboard is a VIEW of that list. Two rows claiming one key are refused by name rather than resolved by walk order, and `Ctrl/Cmd+Z` resolves to the page's own `undo` row — there is no private undo behind the page's back.
4. **The selection overlay, and nothing else.** The substrate is drawn by the page (the one-renderer law); the view creates its own element and draws on it the rectangle a copy is being dragged out of and the paste anchor. Hover stays the page's, or two renderers would answer "which cell is under the pointer". A page may CONTRIBUTE shapes through an optional `shapes()` — merged after the view's own, so a selection is never buried — and the law survives, because the element, the clear and the repaint schedule stay the view's: the page hands over WHAT to draw, never a second surface to draw it on.

The vocabulary is `rect`, `paste` and `polyline`, in CELL space with fractions allowed, so the centre of cell 3 is `{x: 3.5}` and the producer says where a line goes. A polyline is a line rather than an "arrow" primitive because the same picture is wanted elbowed, headed at either end, or bare: `arrow` and `arrowBack` are FLAGS on the line, and a head is drawn off the LAST SEGMENT rather than off the first-to-last point, so an elbowed arrow arrives the way it actually arrives. A degenerate last segment draws no head rather than one at an invented `Math.atan2(0, 0)`. `assertShape` is the one authority and an unknown kind refuses BY NAME at mount, where `repaint()` first asks — a shape nobody draws cannot be told from one nobody produced.

Everything substrate-shaped is injected and refused by name if missing: `cellAt`
(the geometry is the page's — the browser gate computes its target cell
independently and asserts the cell it named is the cell that changed), `brushOp`
(the palette, as a closed op template), `floodTarget`, `pasteOptions`,
`clipWarnings` (a substrate's own bounds, which the view only guarantees are
printed BEFORE a paste lands), and `say`. Having no `document` and no injected
painter is a refusal, not a silent skip: a selection rectangle nobody can see
cannot be told from one nobody dragged.

`brushOp` has three answers, not two: an op, `null` (nothing armed), or
`{refused}` — the palette cannot build an op and says why. The third exists
because Seedling's PLACE brush parses a JSON attributes box, and reporting an
unparseable box as "no brush is armed" is a true sentence about the wrong
subject; a throw would be worse, since a substrate-agnostic file cannot tell a
page's own refusal class from a `TypeError`.

**And the HOST may ask for a repaint, which is the surface's sixth key.** The
view paints once at mount and then only from its own gestures, so a host that
sizes the TARGET canvas *after* mounting left the overlay at the target's
old size holding a picture of an empty shapes list — measured on the set
editor's strip, which ships `width="1" height="1"` in the HTML and is sized by
the page's own painter: 2088×132 with 181,674 ink on the strip against 1×1 with
0 on the overlay, until the first gesture happened to repaint it. `repaint()`
asks `shapes()` again and paints, and touches nothing else. It exists because
the only door before it was `setTool`, which also clears the armed corner and
the stroke and fires `onChange` — a half-armed two-click gesture and a
re-entrant render, in exchange for a repaint.

**Mounted today** on the maze lab page's EDIT arm and on `watch.html`'s shared
edit panel, each on its arm's own lifetime — and each panel on a lifetime of its
OWN inside that, so a remount cannot leave the previous mount listening.

## The rules.json and atlas toolkit (`procgenCore/`)

Nine modules, FLAT beside the edit core, for the documents every substrate
shares. They were lifted from copies that already existed and agreed — the
point was never new behaviour, it was ONE place for behaviour there was already
consensus on. The last three arrived the other way round: the SET EDITOR was
measured inside `seedlingDemo/` and moved out a layer at a time as a second
substrate needed it — first its calculations, then its overlay, then its DOM.

| module | what it is | what it replaced |
|---|---|---|
| `contentIdentity.js` | `stableStringify`, `fnv1a32`, `computeContentHash(doc, {idKey})`, `stampIdentity(doc, {idKey, defaultBase, baseId})` | five byte-equivalent copies in the atlas, library, pool, level-set and JtA-dataset validators, plus two hand `canon` clones in `scripts/procgen` |
| `rulesGraph.js` | `regionsOf`, `startRegionsOf`, `walkRulesGraph`, `walkRuleTrees`, `walkRuleTree`, `reachableRegions` | no named walker existed; sixteen production sites each opened their own region loop, and `start_regions` was read five ways |
| `apIdNamespaces.js` | the register of every AP id base, with provenance and pins, plus `allocateIdsBySortedName` | three id bases the inventory knew about and five it had missed |
| `jsonSchemaCheck.js` | a draft-07 evaluator over the keyword subset this repo's two schemas use, plus `rulesJsonSchemaErrors` and `atlasSchemaErrors` | a 132-line evaluator that was TEST-ONLY BY ACCIDENT — its only disqualifications were a `node:fs` import and a home under `runnerDemo/` |
| `atlasOps.js` | `applyAtlasOp(atlas, op)` over an 18-kind vocabulary, pure and copy-on-write | `AtlasSession`'s sixteen in-place mutating bodies, which no headless caller could reach |
| `ruleTreeOps.js` | `getRuleAt` / `replaceRuleAt` / `removeRuleAt` / `wrapRuleAt`, path-addressed and copy-on-write | `ruleTreeEditor.js`'s per-node closures, which existed only while the DOM was rendering |
| `setEditorCore.js` | the set editor's substrate-free half — `roomRowsOf`, `moveOrder` and the three renumbering mappings, `renumberDecision`, the `OVERVIEW` strip and `exitArrowShapes`, `gateabilityOf`, `inertRulesOf`, `freeEdgesOf`, and `reportOver` | `seedlingDemo/watchSetEditor.js`, where D2 built all of it; the page now RE-EXPORTS the moved names by the same function object |
| `setOverlay.js` | `createSetOverlay(spec)` — the authored half's shape: the prefixed rule-target key, `overlayErrors`, `assertOverlay`, `exitRulesByRoom`, `renumberOverlay` and the two readers — plus **`applyOverlayRules(atlas, byRoom)`**, top-level because nothing in it is bound to a substrate | `seedlingDemo/seedlingSetOverlay.js`, measured at 10 of 11 exported functions substrate-free (90.9%) before the lift; `applyOverlayRules` came later, out of `seedlingAtlasDerivation.js`, where the MAZE derivation had been importing it across substrates |
| `setEditorView.js` | `mountSetEditor(opts)` — the set editor's DOM: the rooms strip and its stills cache, the two-click link gesture, the rooms table, the manifest and room forms, the rule box, the REPORT and the downloads | `seedlingDemo/watchSetEditor.js`'s 1,051-line mount, measured at ~26 substrate-bound call sites in five spots; each became a named parameter |

**And the mount has TWO pages now.** `watch.html`'s SET arm binds it to Seedling
(`seedlingDemo/watchSetEditor.js`) and `mazeRoom/lab.html`'s fourth `?source=`
arm binds it to the maze (`mazeRoom/mazeSetLab.js`) — the same function object,
over the same `edit*` element ids, in two documents. The binding list is a
MODULE rather than a literal inside a test, because a copy would be two answers
to *"what is the maze's `exits.addressOf`"* and the first slice to change one
would leave the other saying something else. What the maze's page supplies that
the node rows stub is `drawRoomStill` — `mazeRoomRender.drawWorld` on the
entry's own world, at the strip cell's own tile size — and the two pipeline
functions the mount refuses to import for itself.

**And a HOST can open one room of that mount.** Both lab pages run inside the
frontend in a `procgenLabPanel` iframe, and the editor-integration arc's slice
W3 made that hosting a room-editor door without adding a word to the
`procgenLab:` vocabulary: a **document in** over `load` (each page sniffs the
payload through the ONE classifier it already has — `documentBundle.classifyDocument`
on the maze, `sniffLoadBox` on Seedling — so a region library / level set /
overlay lands on the SET arm's intake instead of the lab-level box), **one room**
over `navigate` with the page's own `?source=<arm>&room=<n>`, and the **folded
document out** over `levelChanged`, whose payload is a `procgenCore/labRoomEnvelope`
for as long as a SET arm holds a session. The host's `onSave` fires on that
envelope's open-room index going `n` → `null` — the CLOSE as a TRANSITION, never
a count of edits, because a close that folded a no-op room session moves no
count at all. Which substrates open this way is the registry's
`roomEditor` declaration ([Substrate registry](./substrate-registry.md)
§ *Entry contract* → *Editing*), and the resolver is
`procgenPipeline/regionEditors.js` ([The stepped pipeline](./stepped-pipeline.md)
§ *Region editors*).

**`onSetChange({why})` has ONE ordering rule, and it is the contract.** The
mount's own `render()` has already run when a page is called, on every path — so
a page may publish what it derives from the MOUNT and not only what it derives
from the SESSION. It was not always so, and the cost was measured rather than
argued: the applied-op path called the page BEFORE its own render and the REPORT
path did not call it at all, so after a two-click link gesture a page's `links`
read 1 off the session's record while anything it read off the mount read
`linkedFrom: [0,0,0,0]`, one op behind. Four readout fields (`report`, `strip`,
`note`, `identity`) were therefore published NOWHERE rather than published
stale, and their browser rows read the DOM instead. `why` is one of
`SET_CHANGE_WHY` — `op` (an applied op, an undo, or the second notification a
renumbering sends after its decision about the open room session), `report`,
`close`, `select`, `room` (the rooms table's OPEN, which runs the PAGE's own
`openRoomAt` before this mount re-renders) and `download` (all three download
presses, which write readout globals and a note) — so a page can ignore what it
does not publish. `select` fires only when the selection actually MOVES: the
mount ends with a `selectRoom(0)` that changes nothing, and a page notified
there would be reading a mount handle it has not been given yet.

⛔ **Two divisions belong to the PAGE, on both pages.** The room `<select>` is
FILLED by the page (`selectRoom` only ever sets its VALUE), and the set controls
are ENABLED by the page. `#editRoomClose` is in neither roster: the mount owns
it and disables it on every render when no room is open, and a page that also
wrote it would be a second authority on a control whose state is a fact only the
mount has.

**Identity is a CONTRACT, not an implementation.** Ten documents committed to
this repository carry ids minted with that exact algorithm: a sorted-key
recursive stringify, then FNV-1a/32 over UTF-16 code units, hashed over the
document minus `provenance` and minus its own id key, rendered as eight
lowercase hex digits and appended to the base id. Change any part of it and
every save file keyed on a `set_id`, every preset naming an `atlas_id`, and
every byte-identity `--check` under `scripts/procgen/` moves at once. A test row
globs the five stamping directories and recomputes all ten; that row is the pin.
Not part of the family, deliberately: `shared/rulesHash.js` (not stable, a
localStorage key), the JtA `paramsHash` (not stable, and its value is committed
in two presets), the omsi 64-bit hash, and the two seed derivations.

**The walker reads BOTH shapes of `start_regions`.** Every committed rules.json
uses the object form, `{"1": {default: […], available: […]}}`; the array form,
`{"1": […]}`, lives only in test fixtures. `startRegionsOf` returns a frozen
`{default, available}` from either, which cured a real defect on adoption — the
APWorld editor's validator read the array form as empty and warned "No start
region set." about a document that named one. `reachableRegions` takes its rule
`evaluate` as a PARAMETER, because seven rule interpreters exist in this repo
and the core commits to none; with no interpreter every edge is free, so the
answer is the STRUCTURAL one — which regions are connected at all — and never
the logic one.

**The id register records; it does not decide.** Every base in it is already
minted into committed data, so nothing in it may move: each row carries the
path:line where the literal lives and what goes red if it changes. Its working
part is a census that sweeps the tree for id-base literals AND for the
`ap_id_offset` fields in the per-game configs, failing by name on any value the
table does not declare — two of the six bases are JSON data rather than JS, so
a code-only sweep would have reported full coverage while seeing neither. Item
ids and location ids live in separate Archipelago id spaces, so a row whose
item base equals its location base is not a collision; what must not overlap is
two rows in the same space.

**No ajv, and the schema is INJECTED rather than read.** The repo ships no
JSON-Schema library for JS, and it does not need one: `rules.schema.json` uses
only keywords the promoted evaluator already had, and `region-atlas.schema.json`
needed six more (`$id`, `minLength`, `minItems`, `maxItems`, `uniqueItems`,
`pattern`). Adding a library would buy a user-visible dependency, a bundling
question for the dev-server page path, and a second evaluator for a schema the
hand one covers. The law the promotion kept is that an unknown ASSERTION keyword
THROWS by name: a checker that shrugs at what it does not understand reports
"valid" for documents it never looked at. Every entry point takes the parsed
schema as a parameter and refuses without one, because `procgenCore/` is in the
browser page graph and one `node:fs` there makes the whole graph unloadable —
the same rule the Seedling editor's `.oep` schema keeps (below). A node-only
sibling, `jsonSchemaFiles.js`, owns the disk read. `validateRegionAtlas` runs the
structural pass FIRST when a schema is injected, so a document whose SHAPE is
wrong is reported as a shape error instead of a cascade of referential ones
downstream of it. The rows are the COMMITTED documents: every atlas in
`flashPanel/atlases/` and all 259 preset `rules.json` files, with Python's
`jsonschema` agreeing on the same 259 — when a hardening rule and the real
corpus disagree, the rule is what moves. That is what forced
`vanilla_layout.connections[].one_way` into the atlas schema, undeclared since
R7 though the compiler reads it and the playthrough writes it 312 times. ⚠ And
declaring it was NOT enough: draft-07 allows unknown properties by default, so
the field had been passing an undeclared schema with zero errors and deleting
the declaration again would have changed nothing. The connection item is CLOSED
(`additionalProperties: false`) as well, which is what makes the declaration
load-bearing.

**Editing is a VOCABULARY of pure ops.** `atlasOps` and `ruleTreeOps` both take
a document and an op and return a NEW one, never mutating the input, with
structural sharing along the untouched branches — the playthrough atlas is 271
KB and its build applies about 1,100 ops, so a clone per op would be quadratic
inside a `--check` gate. Copy-on-write is also what lets an editor hold, name,
log and undo an edit, which per-node closures could not. ⛔ The spreads are
key-order-exact on purpose: an overwritten key keeps its position, a new key
appends, a dropped key is deleted rather than set to `undefined`. The atlases
are byte-gated, and key order is part of those bytes. Three atlas ops did not
exist before the lift — `rename-region`, `connect` with `one_way`, and `unwire`
by endpoint — and the first two are why the playthrough generator used to bypass
the session entirely and assign `vanilla_layout.connections` wholesale. That
bypass is gone, which also means its 312 connections are now subject to the
each-endpoint-once law they had been skipping. `rename-region` REFUSES a
colliding region id, and the reason is not cosmetic: the AP projection allocates
ids by NAME with dedup, so two regions sharing an id do not collide, they
COLLAPSE into one, and the second one's exits and locations attach quietly to
the first.

All nine are under the no-substrate law described above for the edit core, and
that law was widened to `flashPanel/` when the first three landed: a toolkit
about atlases is exactly the code that would otherwise reach for one Seedling
tile constant. ⛓ The law's gate reads the DIRECTORY rather than a list, so a
module added to `procgenCore/` is under it the moment it exists — which is what
made the two set-editor modules parameterise rather than import: everything a
set adapter can supply (`readSetCell`, `exitsOfRoom`, `whatLinksHere`,
`bounds`, `validateForDownload`, `deriveAtlasOf`, `rulesJsonOf`) is handed in,
and so is the document's own NOUN, because the row that says *"validateLevelSet:
ok — 6 room(s)"* is about a document `procgenCore/` has never heard of.

**⛓ WHAT A SUBSTRATE HANDS IN TO MOUNT THE SET EDITOR.** `mountSetEditor` is the
DOM half, and the list below is the whole of what it does not know. Each entry
is `need()`-checked by name at mount, because a reader that arrived as
`undefined` would otherwise surface three renders later, inside a `paintStrip`
that had already emptied the boxes the page was showing.

| parameter | what it is | why it cannot be derived |
|---|---|---|
| `adapterFns` | `readSetCell`, `exitsOfRoom`, `whatLinksHere`, `bounds`, `validateForDownload`, `deriveAtlasOf`, `rulesJsonOf`, `closeRoomSession`, `download` | D1's vocabulary plus the two PAGE seams: a room session closing into the set, and one press producing N documents |
| `document` | `{kind, noun, validator, idOf, docOf}` | what §1 of the REPORT calls the thing it validated, and which half of the record that thing IS (`record.set` · `record.library`) |
| `ruleKeys` | `{exit, location}` — the overlay's key BUILDERS | so the `exit:` prefix is `ruleKeys.exit('')` and never a literal; a literal is green over Seedling for ever and reports ZERO inert rules for everyone else |
| `forms` | `{manifestRows(), roomRows()}` | `SET_FIELDS`/`NAMED_ROOMS`/`MUSIC_*` on one substrate, `LIBRARY_FIELDS`/`ROOM_FIELDS` on the other. ⛓ MEASURED: neither reads the record, so neither takes one |
| `exits` | `{valueOf, labelOf, addressOf, targetOptions, disconnectOp}` | a Seedling exit is addressed by its ORDINAL and a maze exit by `exit_id`, so the `<option>`'s VALUE is built and read back by the same binding |
| `locations` | `{options(cell), emptyWhy, targetOf(value)}` | `mark-location` names an OEL entity at exact pixels on one substrate and an `items[]` ORDINAL on the other |
| `drawRoomStill(canvas, cell, index)` · `stillKey(cell)` | ⚖ the ONE-RENDERER law: the page draws its own substrate and the mount blits what it is handed | the KEY is the substrate's too — what makes a still stale is what the substrate copies on write (the room's `source` object · the entry's `payload`) |
| `linkBound(record)` | `{ok, why}` | Seedling prices OEL bytes then record entities; the maze's links are ONE authored list and its bound says `ok` for ever — and SAYS so, because what is not bounded has to be named too |
| `isRefusal` · `rulesSchema` · `addRoomOp(at)` | the substrate's refusal classes, the parsed `rules.schema.json`, and the whole `add-room` op (a `record` on one side, a `payload` on the other) | ⛓ the press says only WHERE (`at = roomCount()`) and BUILDS THE OP INSIDE A `try`: a binding may refuse to MINT — the maze's calls `createWorld`, which refuses a dimension below 2 — and the argument position is outside `applySet`'s own catch |
| `sourceKind(cell)` → `badges()` | WHERE the room's contents live (`record \| xml \| embed`); the mount records the `embed` answer PER CELL as it paints and exposes it as `badges()` | the strip's `⛔embed` glyph is drawn OVER an opaque room box, so no ink count can see it (`gotchas.md`); the painter's own decision, published as `strip.badges` / `set.badges`, is the browser's only reader of it |

The DOWNLOAD is the shape that generalised least obviously: `adapterFns.download`
returns `{members: [{kind, doc, name, label, readout}], report, apMappingWhy?}`
and the mount writes one blob and one readout per member. ⛓ **Every download
readout is PRESS-SCOPED**: the handler nulls its whole family and bumps
`__editorSet{Bundle,Rules}Presses` before its FIRST guard, so a refused press is
told apart from the last success and a driver waits on a counter that CHANGES
rather than on a key that merely exists (`gotchas.md`). ⛔ A member whose
`kind` is not in `documentBundle.BUNDLE_KINDS` is refused BY NAME by the bundle
button, with the roster quoted — Seedling's `ap-mapping` companion and the
maze's `region-library` are both outside it today, and a silent drop would hand
somebody a zip missing the document they pressed the button for.

**⛓ WHAT AN OVERLAY CARRIES IS THE SUBSTRATE'S; WHAT AN OVERLAY IS IS NOT.**
Every set substrate's overlay is `rooms` keyed by ROOM INDEX, each room carrying
`{name?, locations[], rules{}}`, and rules keyed `exit:<exit_id>` or
`loc:<name>` — collision-free by construction, because an exit id and a location
name are both free-form strings. What differs is two things, and
`createSetOverlay` takes exactly those as parameters:

| | the LOCATION's address | the extra top-level fields | how wide a location NAME must be unique |
|---|---|---|---|
| Seedling | `entity: {type, x, y}` — the room's own OEL element, in PIXELS | `neverEnter` (the trap rooms) · `regions` (`Message.as`'s seven titles) | `'room'` — the derivation emits `Level NNN - <authored>` |
| maze | `item: <index>` into the entry's `payload.items[]` — a captured slot POSITION | `links[]` · `start` | `'set'` (the default) — the derivation emits the authored name verbatim |

⛓ Neither address generalises the other, so there is no default: a binding that
declares no `locationFields` is refused by name.

⛔⛔ **AND THE UNIQUENESS SCOPE IS THE SUBSTRATE'S FOR THE SAME REASON THE
ADDRESS IS.** `regionAtlasCompiler` allocates AP location ids from the DERIVED
`loc.name` alone and `regionAtlasValidator` refuses a duplicate derived name
globally — so what an AUTHOR may repeat depends entirely on whether the
substrate's derivation PREFIXES the room into the name it emits, and the two
committed substrates give opposite answers. `createSetOverlay` therefore takes
`locationNameScope ∈ {'room', 'set'}` and the DEFAULT is the stricter `'set'`:
a substrate that has not thought about it gets the answer that cannot lose an
item. An unknown value is refused by name rather than defaulted.

⛓ The law it replaced was one scope for both, justified by *"two rooms that
swap places under a `reorder` would swap AP names, so uniqueness is asked of the
AUTHORED name"*. That sentence is true and about the wrong property: a reorder
RE-PREFIXES every derived name and the set of them stays unique — swapping is
not colliding. Asking it globally cost the vanilla lift 16 names it could not
reproduce, which is the divergence the cross-check row below now measures at
zero.

**⛓ THE MAZE DERIVES ITS ATLAS FROM A REGION LIBRARY, AND ITS LINKS ARE
AUTHORED — because the library's contract forbids them inside an entry.**
`mazeRoom/mazeAtlasDerivation.js` is the second `deriveAtlas`. Its input is a
`frontend/region-libraries/*.json` file, whose every payload exit carries
`targetRegion: null` and whose every entry carries `carried_rules: null`, both
BY CONTRACT (`regionLibraryValidator.js`): a library entry is interchangeable
content that `stitchGrid` wires at instantiate time. So the atlas is still
derived — `region_id` ← the ENTRY id (stable across a reorder, because the AP
region is named after it), `map_ref` ← the entry INDEX (what moves), bounds ←
the payload's size, boundary exits ← `payload.exits[]` with their `exit_id`
verbatim, locations ← the payload items the overlay has MARKED — and the
CONNECTIONS come from the overlay, because no maze room fact carries one.

Three of its decisions are worth reading before writing the next one:

- **A boundary exit is an `edge`, and its `side` is DERIVED.** The atlas
  schema's `kind` is the closed enum `edge | teleporter`, so a third value fails
  the structural pass. `atlasOps.deriveEdgeSide` reads the side off the tile and
  the bounds, and the payload's own `side` becomes a CROSS-CHECK that refuses an
  entry whose metadata has drifted from its tiles.
- **`one_way` defaults to FALSE — the opposite of Seedling's.** Seedling's one
  transition primitive is a one-way jump, so its derivation emits
  `{one_way: true}` on every connection; a maze crossing is a tile the player
  walks both ways. The consequence is visible in the REPORT, through the shared
  `gateabilityOf`: the arrival side of a one-way connection gates nothing
  (`regionAtlasCompiler` records it as `arrivalOnly` and builds no AP exit), and
  a two-way arrival gates.
- **NO `subgraph`, and a refusal instead.** `regionAtlasMazeProjection`
  recomputes a region's components from the grid and throws a staleness sentence
  when they disagree with a declared subgraph. A maze room is one component by
  construction, so the derivation floods the payload from its entrance and
  refuses a split floor BY NAME rather than emitting a subgraph the projection
  would reject.

⚠ And the maze needed a `gridFor` of its own: `compileRegionAtlas`'s maze arm
refuses without one because *"the cell grid and the condition vocabulary are the
GAME's"*, and every `gridFor` that existed indexed SEEDLING levels through a
semantics table. A maze payload's tiles ARE the grid, so `mazeGridFor` is nearly
the identity.

**⛓ The atlas is DERIVED from the rooms; the overlay is AUTHORED.** ⚖ Ruled by
the user, 2026-08-25. The playthrough generator had already proved it: a region
per room, boundary exits read off the `teleporter`/`stairsup`/`stairsdown`
entities and the `<control fallthrough>` pits, one-way connections between them
— all of it a FUNCTION of the rooms. Only three things are authored: locations
(with their `vanilla_item`), the access rules the analyzer cannot derive, and
names. So the derivation is a module, `seedlingDemo/seedlingAtlasDerivation.js`
— seedling-side, because it reads OEL entity types — and the editor's document
is `{set, overlay}` with the atlas rebuilt on demand rather than typed. A
reorder then rewrites the OEL `@to`/`@fallthrough` and re-keys the overlay, and
the atlas needs no rewriting because it is not stored. ⛔ The vanilla hand
rulings STAYED in `make-seedling-playthrough-rules.mjs`, and that is the
evidence rather than the residue: an atlas is `derive(rooms) + authored
overlay`, and the fact that the 116-room vanilla build needs an overlay is what
makes the shape right. The two sources feed one function because they present
one record — measured field by field, the map extract's levels and
`procgenLevelOel.parseOelLevel`'s output differ in exactly one thing a
derivation can see: a parsed `.oel` does not carry its own `level` id, because
it does not know its index and the SET does. That adaptation is one line at the
call site, and a room without one is refused by name rather than guessed.

## The Seedling editor's data model (`seedlingDemo/`)

`watchEdit.js` is the op vocabulary and `seedlingEditAdapter.js` is the wrapper that makes it an `editCore` adapter. The ops address CELLS, never list indices, because the edit list is IDENTITY and travels in a payload a person reads.

| op | what it takes |
|---|---|
| `paint` | `{tx, ty, layer?, terrain \| column}` — either of the game's two tile layers, and on `tiles` any of the 45 tileset columns rather than only the generator's four terrain names |
| `place` | `{tx, ty, type, attrs, nodes?}` |
| `attrs` | `{tx, ty, attrs}` — the last entity in the cell; REPLACED, never merged |
| `remove` | `{tx, ty, which?}` — the last entity in the cell, or the `which`th of them (0-based, in `entities` order) |
| `nodes` | `{tx, ty, nodes}` — replaces that entity's `<node>` children; an empty list removes the field |
| `resize` | `{width, height, anchor}` — the one op about the ROOM rather than a cell |

**The vocabulary is DERIVED, not typed.** `scripts/procgen/extract-seedling-ogmo-schema.py` reads `~/CC/seedling/Shrum.oep` — the Ogmo 1 project file the game's own 116 rooms were authored against — into `seedlingDemo/fixtures/seedling-ogmo-schema.json`: 144 entity declarations, 166 typed values with their defaults and ranges, the two tilesets and the three layers. Its `--check` is byte identity, because the producer's output is a fingerprint of its input, and `provenance.oep_sha256` is what tells "the source moved" apart from "the script moved". A hand-written attribute table would be a second declaration of the same facts, wrong silently.

The schema is **injected**, never read by the modules that use it — one `node:fs` anywhere on the page's import graph makes the whole graph unloadable in a browser. So are the level source, the vanilla set's `set_id` and the OEL parser, each refused by name at the moment it is needed. The parser has a third reason: no module under `frontend/` imports anything under `scripts/`, and reversing that direction for one function would be the tree's first inversion.

**Two things the `.oep` measurement overturned.** There is no tile column to refuse for being unused — all 45 build a type `levelWorld` transcribes, so the only paint refusal on that layer is out-of-range. And Ogmo does **not** reliably write every declared value: 183 of the 2,461 entity instances in the shipped rooms lack one, every absent value has a declared default, and every one of them was added to the project file after those rooms were last saved. Filling omitted attributes from their defaults is therefore an editor convenience asked for by name (`fillDefaults`), not a property of the format.

**The `base` union** (`{kind, …}`, the payload's identity half). Seedling resolves `atlas` — refusing a `set_id` that is not the vanilla set's content hash, in the same shape the game's save stamp refuses a save written against different level bytes — `oel`, a pasted document through the injected parser, and `set-room`, one room of an injected level set (an `embed`-sourced room refuses by name, and all 116 vanilla rooms are `embed`-sourced). `generate` is a member that refuses by name, because "the GENERATE ladder owns that identity" is a more useful sentence than "no such kind". A `set-room` base may be resolved against a live SET SESSION — see the section below.

**The bounds it names.** A paste does not clear the destination's bodies: Seedling has no clear-cell op, `remove` takes one body at a time, and `writeOps` sees a descriptor rather than a record — so a paste onto an empty cell reproduces it exactly and onto an occupied cell it accumulates. And a vanilla record's attributes carry the author's key order while every op path canonicalises to sorted, so an editor that rewrites a vanilla cell re-orders that entity's attributes in the saved OEL: value-inert, byte-visible.

## The Seedling SET session (`seedlingDemo/seedlingSetAdapter.js`)

A room is one document; a level SET is another, and they are not the same edit. A room session's identity is `base, then edits` over ONE room, which no reorder or manifest change can express. The set session is the second adapter, over a second record.

**A ROOM'S `source` HAS THREE KINDS, AND ONLY ONE OF THEM IS TEXT.** A level-set room carries exactly one of `record` (a JSON level record — `{width, height, layers, entities}`, the shape `parseOelLevel` returns and `recordToOel` accepts), `xml` (OEL text inline) or `embed` (a path into a SWF's `[Embed]` table). **`record` is what the exporter writes**, so every tool between the generator and the game sees JSON; `xml` stays ACCEPTED because the committed generated-set artifacts carry it; `embed` is the committed vanilla manifest's, and nothing on a page can read one. Measured over the vanilla 116: the same rooms are 528,752 B as records and 1,652,312 B rendered, a 3.12× difference that is entirely attribute escaping and repeated element names.

**OEL IS RENDERED AT THE CHUNK BOUNDARY AND NOWHERE ELSE.** `planLevelSetChunks` turns every `record` room into `{xml}` BEFORE it sizes and packs it, because the receiver ends at `LevelSet.as:139`, which reads `room.source.xml as String` — so what crosses is text and the byte bound is measured on what crosses. **The order is the whole claim:** sizing the record instead would price a document 3.12× smaller than the delivered one and plan the vanilla 116 into 8 chunks instead of 9, handing the runtime a call the proven envelope was never measured for. `watchWasm.js` ships whatever chunk it is handed and did not have to change; the boundary is upstream of the sender, which is the only place it can be if there is to be exactly one of it.

**TWO READERS, ONE KIND SWITCH — and the second one is a measurement.** `roomRecordOf(room, {parseOel, xmlByRoomId?})` is the ONE door for anything that wants a RECORD; `indexOfRoom(room)` is the ONE door for anything that wants the cross-reference INDEX (`{size, exits, fallthroughs, buttonRooms, finalBosses, tags, tsets, moonrocks, triggers}`). The index door keeps the lenient regex `parseRoomXml` on the two text kinds and uses `indexRoom` on records, because **all 70 `xml` rooms of this repo's own conformance corpus FAIL `parseOelLevel`** — they are reduced OEL with no `<width>`, and routing legacy text through the record parser would refuse the corpus the validator exists to accept. What licenses the two as ONE index is an equality with an INDEPENDENT SOURCE in it, 116/116 on three arms: `indexRoom(record)` equals `parseRoomXml(recordToOel(record))` (a fixed point); `parseRoomXml` of the committed REDUCED vanilla OEL equals `indexRoom` of the map record (a second extractor's text); and `parseRoomXml` of the DISK `.oel` equals `indexRoom(parseOelLevel(same))` (the real files, with the tile grid, the `<node>` children and the one raw `>` inside an attribute value).

**AN EDIT NEVER CONVERTS A KIND.** A legacy `xml` room is retargeted as TEXT (`retargetRoomXml`, byte-preserving) and a `record` room on `entities[].attrs` (`retargetRoomRecord`), and a mixed set edits each room in its own kind. The document's form is the author's: converting on touch would rewrite a document nobody asked to change and move the set's content hash for a reason no reader could name. The two record writers are equalities rather than resemblances — over the vanilla 116 and over a linked generated set, `parseOelLevel(retargetRoomXml(recordToOel(r), e))` equals `retargetRoomRecord(r, e).record` for every exit, every fallthrough and every removal, and where one side refuses the other must too.

**The record is `{set, overlay}` and the atlas is neither.** An atlas's regions, boundary exits and connections are a FUNCTION of the rooms (`seedlingAtlasDerivation.deriveAtlas`); only three things are AUTHORED — locations, the access rules the analyzer cannot derive, and names. So the session holds a schema-v1 level set plus a JSON overlay, and the atlas is `deriveAtlasOf(record, deps)`, rebuilt on demand. No op keeps it in step and no undo unwinds it. `rules.json` is one step further out: `compileRegionAtlas` of the derived atlas.

**Rooms are a ONE-ROW grid.** `bounds` is `{w: rooms.length, h: 1}`, and row 1 refuses by name. A set really is a one-dimensional positionally addressed list — the schema says "Position is identity", which is exactly why a reorder rewrites every `@to` — so a second axis would name nothing and the core's law 7 would be writing a room to a coordinate the substrate cannot address. It also makes `rectCopy`/`rectPasteOps` a ROOM COPY between two sets with no new code: a clip of `{w: 3, h: 1}` is three rooms with their overlays, and pasting it into another set's session is the core's own path. A paste past the end REFUSES rather than appending, because `writeOps` is handed a descriptor and two coordinates and never sees the record — it cannot know where the end is. Growing a set is `add-room {at}`, deliberately.

The cell descriptor is `{room: {name, source, music, music_override_exempt?, snow_gradient?}, overlay}`, where `source` is the room's own `{record}` or `{xml}` — the KIND travels, so a copy never converts. It carries no `id`: a room's id IS its position, so a descriptor holding one would disagree with wherever it was pasted.

| op | shape | refuses when |
|---|---|---|
| `add-room` | `{record \| xml, name?, music?, at?}` — ONE op, TWO doors; the payload's kind is the new room's kind | neither payload or both; the document does not read or carries no rectangle; `at` outside `0..rooms.length`; an exit naming a room the new set will not have |
| `remove-room` | `{room, retarget?}` | it would empty the set; any transition targets the room and `retarget` does not name where it goes (the refusal LISTS them); a retarget value that is not an old room index |
| `reorder` | `{order}` — `rooms_new[i] = rooms_old[order[i]]` | `order` is not a permutation |
| `connect` | `{from: [room, exit], to: [room, exit], one_way?, arrival?}` | an exit ordinal the room does not have; a self-join; a non-integer arrival |
| `disconnect` | `{room, exitIndex}` | the ordinal names no exit; the exit element has children; **the overlay has MARKED that exit's entity as a location** (naming it, and `unmark-location` as the door out) |
| `set-field` | `{path, value}` over `name`, `description`, `start`, `menu_rooms`, `named_rooms` | a path the schema does not declare; a value naming a room that does not exist; an empty `menu_rooms`; a `named_rooms` key outside the closed six |
| `set-room-field` | `{room, field, value}` over `name`, `music`, `music_override_exempt`, `snow_gradient` | `id` or `source` (position is identity; the document is `replace-room`'s); a music outside `-1..13`; a wrong type |
| `set-access-rule` | `{room, target, rule, path?}` | the target key carries neither prefix; the exit id or location name is unknown AT DERIVE TIME; **the endpoint GATES NOTHING** (`gateabilityOf`); the rule fails `ruleSchemaErrors`; a `path` with no tree under it |
| `mark-location` / `unmark-location` | `{room, entity: {type, x, y}, name, vanilla_item}` / `{room, name}` | `name` or `vanilla_item` is not a non-empty string (asked FIRST, so the refusal does not depend on the rest of the document); the name is already used IN THAT ROOM (Seedling's scope is `'room'` — the derived name carries the level, which is the room's array position); the room holds no such entity at exactly those pixels (asked of `entities[]` for a record, of the text for an `xml` room); the name is not marked |
| `replace-room` | `{room, record \| xml}` | neither payload or both; the document does not read or carries no rectangle; it carries a transition outside the set |
| `set-overlay` | `{room, overlay}` | the overlay validator refuses the shape |
| `set-overlay-field` | `{path, value}` over `neverEnter` and `regions` (`OVERLAY_FIELDS`); `value: null` DELETES the key | a path outside those two (`rooms` is written one entry at a time by `set-overlay`; the envelope is not authored); the overlay validator refuses the probed document. ⛓ A `regions` write RE-SIGNS every transition in the set from the new map — `renumberSet` cannot do it, because it early-returns on an unmoved target and no room moves |

**`reorder` is ONE atomic op, not a group.** A group is N entries in a payload whose whole promise is that a person can count the edits in it, and a reader could not tell a reorder from N hand retargets that compose into one. It rewrites every `@to`, **every `@fallthrough`** (a separate list and a separate ordinal space — the generated sets most rows use carry none, so a fixture that skipped it would leave that mutant green), `rooms[].id`, `start`, `menu_rooms`, `named_rooms`, and re-keys the overlay's rooms, `neverEnter` and `regions`. The `sign` on every rewritten transition is recomputed from `signForTransition(region(from), region(to))` and never carried: `sign` is a property of the TRANSITION, so a permuted set keeping its old signs would announce the region of the room the player did NOT go to. The regions are read in OLD coordinates while the rewrite runs, because the overlay is re-keyed at the end.

**`connect` is two-way by default and the arrival is the destination's RETURN DOOR.** Vanilla does exactly this four times (11↔3, 88↔87, 97↔37, 107↔102) and does not warp-loop, because `Game.update()` runs every entity's `check()` before `super.update()` — the portal under the player is already latched on the first frame. It needs no second free cell and makes a two-way link symmetric by construction.

**FOUR REFUSAL CLASSES, AND THE FOURTH IS THE DERIVATION'S.** `apply` catches `SeedlingSetAdapterError` (this adapter's), `SeedlingSetOverlayError` (the overlay's), `LevelSetExitError` (`retargetRoomXml`'s) and `SeedlingSetDeriveRefusal`, and rethrows everything else on purpose — *a `TypeError` here is a defect*, and swallowing one would make a crash look like an edit the substrate declined. The fourth exists because a set that cannot be DERIVED as it stands is a DATA condition an author fixes, not a defect: a collectible in a room no door reaches, a room with no integer level, a `neverEnter` fact that contradicts the doors. `deriveAtlas` throws a plain `Error` for each, and until it was wrapped that `Error` was none of the three names and took the page's arm down. **The wrap is at `deriveAtlasOf`, not inside `apply`**, because `deriveAtlasOf` is also called from OUTSIDE an op — by `roomRowsOf` and `reportOver`, through the substrate's `isRefusal` — so wrapping at the one derivation door is what makes both readers name the same class. The net did not widen: only `err.constructor === Error` is re-labelled, and the `cause` is kept.

**ONE READING OF GATEABILITY, TWO READERS.** `setEditorCore.gateabilityOf(atlas, regionId, exitId)` answers whether a rule on an endpoint can reach anything: an endpoint gates iff it is a connection's `from`, or the `to` of a non-`one_way` one. The REPORT's `inertRulesOf` reads it, `ruleTargetsOver` MARKS each offered target with it, and `set-access-rule` REFUSES on it — so the op, the list and the report cannot disagree about which door is real. Every Seedling connection is `one_way`, so on vanilla every `in_*` arrival refuses and every `out_*` applies; a TWO-WAY arrival succeeding is the other half of the distinction and it is the MAZE's row, because Seedling has no two-way connection to build one from. `set-overlay` remains the one door such a rule can still arrive through — it writes the whole entry and asks no derivation — which is why `inertRulesOf` still exists.

**THE LINK GRAPH IS ONE PASS, BUCKETED BY DESTINATION.** `whatLinksHere(record, room)` used to walk the whole set per room, so `roomRowsOf` asking it once per room made the "links here" COLUMN **O(n²)**: over the vanilla 116 that measured 328–397 ms against a 250 ms budget, and the column read `(bounded)`. `linksIndexOf(record)` walks the set ONCE and buckets every inbound link by its destination — 3.49 ms over the same 116, ~100× — and `whatLinksHere` answers from it in the SAME order it always did (rooms in index order, exits before fallthroughs), which is what makes the two interchangeable rather than merely equinumerous. **The cache is a `WeakMap` keyed on the frozen RECORD object**: every op rebuilds the record, so an edited set is a different object and misses — there is no invalidation to get wrong. `linkScanBoundOf(cost, budgetMs)` compares the ONE-pass cost, DERIVED from `linkScanCost`'s n-pass answer rather than walked again, so a set can still be wide enough to bound and the sentence still says so; vanilla is not, and its column carries a count.

**`disconnect` DELETES the door, because the format has no inert one.** Measured over a generated set, each candidate asked of every reader: `to=""` and an absent `@to` are read as "no exit" by the room index, `reachabilityOf` AND `validateLevelSet` — while a live `Teleporter` is still standing in the room and `int(o.@to)` is `0` for both spellings, so the set validates clean and the player is warped to room 0 by a door the editor calls unwired. A sentinel `to="-1"` is the one spelling the validator catches, and it catches it as an error. Deleting the element is the only representation all four readers agree on. The ordinals after it shift down by one, and the op's own sentence says so.

⛔ **And because it DELETES, it refuses over a location marked on that same entity.** The overlay would otherwise be left naming a body the room no longer has, and the consequence arrived one edit LATER, as a derivation refusal about a room the author had not touched. The comparison is made BEFORE the removal — after it there is nothing left to compare — between the exit's own `@x`/`@y` and the location's `entity: {type, x, y}`, both in PIXELS. It is EXACT on the coordinates and not just the element: two `<teleporter>`s in one room are ordinary, and an element-only check would freeze every door in a room holding one marked one. `unmark-location` is the door out, and it takes the `loc:` rule with it.

**The overlay is DATA, and the derivation's closure is BUILT from it.** `deriveAtlas` takes a `locationGuard` CLOSURE, which is right for the vanilla build and exactly wrong for an editor: a session's ops are JSON, and a function cannot be an op's payload. `seedlingSetOverlay.js` holds `{schema_version, overlay_id?, rooms: {[i]: {name?, locations?, rules?}}, neverEnter?, regions?}` keyed by room index, and `overlayToDeriveInput` builds the closure on every derivation and stores none of it. The hazard is sharper than it looks: `editCore.canonicalJson` renders a function as `null` and KEEPS the key, so an overlay that stored its guard would compare EQUAL to one storing a different guard — the fold would drop the authoring op as a no-op and the edit would never reach the payload.

A rule target is `exit:<exit_id>` or `loc:<name>`, and a bare key refuses. Both halves are free-form strings, so nothing stops a location being named `out_teleporter_32_48`; the prefix makes the collision impossible rather than unlikely. The exit ids are the derivation's own (`out_<type>_<x>_<y>`, `in_L<from>_<x>_<y>`, and the two pit spellings); a location is named by the `mark-location` op's `name`, never by its AP name, because the AP name carries the level id and a reorder moves it. `regions` lives in the overlay rather than the manifest because `seedling-level-set.schema.json` is `additionalProperties: false` at the top level — a set carrying one would be refused by its own schema.

**ONE STAMP PER WRITE, and the record is never stamped.** The session's identity is `payload() = {base, edits, certified}`; nothing in it is a hash of the document. `stampLevelSetIdentity` is called in exactly one place, `downloadSet`, on the folded set, once — so five edits are one new `set_id` rather than five ids four of which nobody ever saw. Downloading after each of the same five edits really does give five ids, because the id IS the content; that is now a choice the page makes rather than a law. `provenance` is COPIED, never shared: the stamper writes into the object it is given, and a shallow spread would stamp the session's own set with the download's hash. The DERIVED atlas is never stamped at all. `downloadSet` validates first and refuses a set with errors by name, and cross-room rules like room-name uniqueness are `levelSetValidator`'s rather than an op's — an op that refused a duplicate name would make the core's law 7 unsatisfiable, and two authorities for one rule is how the two come to disagree.

**A room session inside the set session.** `levelSetSource` is a function, so it can answer a live fold: `setSessionRoomSource(session)` is the injection a page uses, and it compares the tag's `set_id` (`setRoomBase` itself does not). `closeRoomSession(setSession, roomSession, room)` commits ONE `replace-room`, so N room edits are one set edit and one undo — and undoing it restores the room's old document exactly, not because anything saved it but because the fold never had it any other way. It took a `recordToOel` until the records ruling: it was the ONE record → text hinge in the editor, and a room session's fold IS the payload now.

**The VANILLA 116 as a `record` set, and why it is a FUNCTION rather than a fixture.** Everything above was demonstrated on generated rooms, because the committed `fixtures/seedling-vanilla-set.json` is 116 `embed`-sourced rooms and an `embed` cannot be opened. Two documents already in the repo are all it takes to have the real ones: the manifest (116 rooms with their names, music, `start`, `menu_rooms` and `named_rooms`) and `flashPanel/atlases/seedling-map.json`, the Phase-2 extract whose 116 records are exactly the shape a set's room now carries. `levelSetExporter.vanillaRecordSet(embedSet, mapDoc)` is the one writer of the result and `buildLevelSet` does the assembling, so there is no second exporter; the CLI's `--vanilla` arm and the page's `#editLoadVanilla` button are its two callers, and no third copy of the 116 is committed. **The join is by PATH, never by index** — a record's `path` relative to the map document's own `source.level_root`, matched against the room's `source.embed` on a segment boundary — and the measurement that makes that non-negotiable is that `levels[i].level === i` and `rooms[i].id === i` for all 116 today, so an index join agrees on this corpus and would carry every room's geometry under its neighbour's name the day either extractor's order moved. Every manifest field and every room field but `source` is carried verbatim and CHECKED by re-encoding, and `provenance.invented` coming back EMPTY is the proof no field was guessed.

**TWO `set_id`s DESCRIBE ONE GAME'S 116 ROOMS, and they coexist by construction.** The committed set keeps `seedling-vanilla-<hash>`: it is what the AS3 fork's `VanillaSet.SET_ID` names, what every save stamp keys on, and what the page's `?source=edit&level=N` ATLAS base checks. The derived set stamps base `seedling-vanilla-record` and carries `provenance.derived_from` naming the other, so neither can be mistaken for the other and the page's identity line prints both. That id is PINNED as a measured literal in a node row — `seedling-vanilla-record-1040ace1` — and a re-extract of the map moves it BY NAME, which is what a derived document's id is for. ⛔ It RETIRED `seedling-vanilla-xml-02a70624`, the hash of the same 116 rooms while they were carried as OEL text: a room's `source` became a `{record}`, so the document changed and its id had to. A reader meeting the old id in an older note is meeting the same rooms in the older form.

**A `named_rooms` ARRIVAL IS A CONNECTION, AND ITS SOURCE IS DERIVED FROM THE TRIGGER ELEMENT.** `linksOf` sees a transition because a transition IS an entity with an `@to`; a `named_rooms` arrival is a MANIFEST fact the AS3 dereferences from inside one entity's own behaviour, and the derivation could not see it. That is why opening the real game in the set editor REFUSED its export: `level_58` (`Dungeon5_DeadBoss`) has three outgoing teleporters and ZERO incoming, and the only thing in the whole 116 that reaches it is `named_rooms.tentacle_beast_mouth`. `levelSetValidator.NAMED_ROOMS` already carries, per entry, the OEL element whose presence makes the entry MANDATORY together with the AS3 citation of its one reader — the validator needs that to decide whether an entry may be OMITTED — so the source list is DERIVED and never typed: every room whose record holds the `trigger` element is a source, the exit is that element's own tile under `outExitId`, and the arrival is the entry's `{x, y}` under `in_<key>_L<from>_<x>_<y>`. Over the vanilla 116 that is **15 warps from 13 rooms** — `bloody_seed_ending` alone has eleven `<watcher>` sources, every other position entry has one, and L57 and L69 hold two triggers each. `watcher_text` derives NOTHING: it is `position: false`, a cross-level persistence tag rather than a warp, and `NAMED_ROOMS` states `position` as its own field precisely because `kind` cannot be trusted for it. The out-side spelling cannot collide: `outExitId` namespaces by the entity's `type` and `LINK_TAGS` is disjoint from the six triggers. The entry key rides in the ARRIVAL id because eleven sources land on ONE tile of L1 and the id has to keep them apart.

**⛔ AND IT IS THE EDITOR'S PATH ONLY — THAT SPLIT IS WHAT KEEPS THE COMMITTED BYTES.** `deriveAtlas` reads an OPTIONAL `deps.namedRooms` (not `overlay.namedRooms`: `overlayToDeriveInput` shapes the OVERLAY DOCUMENT and `named_rooms` is a field of the SET manifest, so hanging it there would invite authoring it in a document whose schema has no place for it). `deriveAtlasOf` passes `record.set.named_rooms` AFTER the deps spread, so the record's own manifest is the answer rather than a caller's. `make-seedling-playthrough-rules.mjs` has exactly ONE `deriveAtlas` call site and it names nothing — so the committed `seedling-playthrough.json` keeps the same hole, 113 regions and 312 connections, its md5 unmoved. A warp whose SOURCE is a `neverEnter` room is NOTED and NOT made: never-enter is encoded here as an ABSENCE, which is stronger than a rule, and a warp out of a trap room would put the trap room back in the graph. Since `NEVER_ENTER_LEVELS` is `[57, 69, 82]` and `tentacle_beast_mouth`'s only source is L57, the playthrough-shaped derivation gains TEN connections and `level_58` stays unreached there, while the EMPTY overlay the set editor opens vanilla with gains FIFTEEN and `level_58` becomes reachable. Two different true answers about one game, and the difference is the overlay.

**THE VANILLA OVERLAY IS A DOCUMENT NOW — LIFTED, NOT TYPED.** What `make-seedling-playthrough-rules.mjs` adds on top of `deriveAtlas` — the reachability analyzer's sub-regions and internal exits, the lava-trap pulls, the hand rulings, `seedlingPlaythroughOverlay.js`'s entity semantics — is still CODE. `scripts/procgen/make-seedling-vanilla-overlay.mjs` lifts out of the committed atlas whatever the D1 overlay can express and writes `seedlingDemo/fixtures/seedling-vanilla-overlay.json`: **41 locations and 5 access rules**, every one BUILT by folding a `mark-location` or `set-access-rule` op through the real `createSeedlingSetAdapter`, so a lift the adapter would refuse is one the script REPORTS rather than writes and a fixture out of it cannot fail the editor on LOAD. A location's ADDRESS is its entity's `{type, x, y}` in PIXELS while an atlas location carries only a TILE, and five of the 41 sit on a tile holding more than one entity — so the script asks `entityForLedgerRow`, the derivation's own answer to "which entity is this row", instead of carrying a type table. **What it cannot express is printed by CATEGORY with every count read off the atlas**: 52 sub-region graphs, 285 internal exits (280 ruled, 269 analyzer-computed), 352 boundary exits pinned to a sub-region, 1 exit rule pinned to one, 24 locations pinned to one, 113 per-region annotations, the never-enter ruling, the room→region map, and **0** location names it had to disambiguate — a category KEPT at zero, because a count above it would now mean two rows of ONE room share a label. ⛓ **`neverEnter` and `regions` are AUTHORABLE since E6a** (`set-overlay-field`), and the lift still writes NEITHER — not because it cannot, but because the ruling is the PRODUCER's: `NEVER_ENTER_LEVELS` is a hand ruling in `make-seedling-playthrough-rules.mjs` about rooms whose exit is created on death, and `regions` has nothing to lift at all since every one of the atlas's regions is exactly one room. ⛔ **And the 16 names that had to move DO NOT ANY MORE.** `mark-location` used to ask GLOBAL uniqueness of the AUTHORED name while the name the derivation emits is `Level NNN - <authored>`, already unique by the prefix — and sixteen rooms hold a location the playthrough calls `Chest`, so the lift wrote `Chest (L38)` and the document's AP names could not match the game's. Uniqueness is (room, name) since E6a, the labels lift verbatim, and the count is **0**: the fixture is `seedling-vanilla-overlay-e2d5c131`, **8,863 B** (was `-1604b508`, 9,149 B), and a row derives the committed fixture through `deriveAtlasOf` and compares its location names to `seedling-playthrough.json`'s AS A SET — 41 names, 41 distinct, **0 divergent**, 16 of them ending ` - Chest` — with the playthrough atlas's md5 `1c4836d11cd9390cbb61f99c94f26d1e` pinned in the row so an agreement reached by moving the other side is impossible. The derived LAYER remains identical from both inputs: `deriveAtlas` over the map records and over the same rooms arriving through a set produce the same regions, the same boundary exits and the same connections, which is what carries the value round trip's 116/116 up to the atlas.

**The chain, end to end on a GENERATED set.** `buildLevelSet({link: true})` → a set session → `add-room` → `connect` → `reorder` → `mark-location` → `set-access-rule` → `deriveAtlasOf` → `validateRegionAtlas(+schema)` → `compileRegionAtlas` → `rulesJsonSchemaErrors` empty → `report.unwired_exits` agrees with the set's own `reachabilityOf` → `reachableRegions` covers every region with a free evaluator and drops exactly the gated one when the evaluator refuses the authored rule's item. Then undo ×N and the record equals the base. The two reachability walks read different documents through different code, so their agreement is evidence rather than a tautology.


## The WORLD — one session over several set documents (`procgenCore/world*.js`)

A world is what a set session becomes when its rooms are not all the same kind. **The BUNDLE is the world**: its members are the documents this repo already writes — a `level-set`, a `region-library` — plus one new kind, `world`, that holds the manifest, the parts' OVERLAYS and the crossings between them. The overlays live INSIDE it because `BUNDLE_ENTRY_NAMES` derives entry names from kinds, so a bundle has exactly one `overlay.json` member and two parts' overlays cannot both ride one; the world IS the composite overlay. A bundle carrying `level-set` + `region-library` + `world` is a world with two parts; one carrying `level-set` + `overlay` is exactly today's Seedling set, and `world` is APPENDED to `BUNDLE_KINDS` so every bundle written before it is byte-for-byte where it was. The kind is recognised by SHAPE — a `parts` OBJECT plus a `links` ARRAY, the two keys no other kind carries — and `world_id` is deliberately not in the predicate, because it is stamped at download and a predicate resting on it would fail to classify every world an editor is holding.

**Three modules, and every substrate half is a parameter.** `procgenCore/` may not import `seedlingDemo/`, `mazeRoom/` or `flashPanel/`, so `worldDocument.js` (the shape, its refusals and the re-key helpers), `worldDerivation.js` (the merge) and `worldSetAdapter.js` (the composite session) take their parts INJECTED — each part hands over its adapter, its readers, and the two functions that turn a `(document, overlay)` pair into that substrate's record and back. Nothing in the three knows what a level set or a region library is; the one place the real two are plugged in is a test under `seedlingDemo/`, where importing both is legal.

**Region ids are namespaced `<part>.<region_id>`.** The only charset rule a region id has is the `__` BAN — the AP sub-region separator — and a census of every committed region id finds `[0-9_a-z]`, no dot anywhere. A dot cannot manufacture a `__` across the seam and splitting on the FIRST one recovers the pair, which is why a part id may not contain one. Each part's atlas comes from its OWN derivation, already carrying `region.substrate`; the merge renames through `atlasOps`' own `rename-region` (which rewrites that part's connections and its start with it) and then CONCATENATES, carrying each region object verbatim — its `map_ref`, its `substrate`, its exits and its key order — because rebuilding one through `add-region` would drop everything that op does not enumerate. `map_ref` stays verbatim too: it is meaningful only to the part's own sidecar builder. The merged atlas passes the UNCHANGED `validateRegionAtlas`.

**Two things one atlas can only say once, and both are said out loud.** `tile_space.map_document` is required as soon as any region names a `map_ref`, and a merged atlas's `map_ref`s live in TWO documents — so the field names the WORLD, and the validator's optional resolution pass (which needs a parsed `mapDoc`) is not available for a world atlas; each part's own derivation resolved its half before the merge. `tile_space.tile_size` is the START part's, and a disagreement is a NOTE rather than a silence: a Seedling set derives 16 and a maze library 1, and the value reaches the FLASH sidecar builder (which turns an entrance tile into a spawn in PIXELS) while the maze projection uses it only to advertise `tile_size` in a payload that nothing reads back.

**A world link DISPLACES a part-internal connection, and says so.** A generated Seedling set has NO spare exit — every exit its derivation emits comes from a transition entity that already names a room — and Seedling's only way to free one is to DELETE it, which leaves no door to cross through. So refusing a crossing on an already-wired exit would make a Seedling→maze door unauthorable. The part-internal connection is unwired first, each displacement is reported by name, the part's own document still says that teleporter leads to its own room, and the freed far endpoint becomes an unwired exit the report already names. ⛔ Displacement is for a PART-INTERNAL connection only: a connection an earlier world link put there is left alone, so `atlasOps.connect` refuses the second with its each-endpoint-once sentence rather than letting one crossing steal another's endpoint.

**The composite grid is the parts' rooms concatenated.** `bounds` is `{w: Σ each part's w, h: 1}`, a global index resolves to `(part, local)`, and every op carrying a `room` is forwarded to the part that owns it with the index re-based — the part's own refusal travelling back prefixed by the part. `add-room` and `reorder` are addressed by PART NAME, because a reorder cannot cross parts: position is identity inside each one. `set-field` writes the world's `name`/`description`, or a part's when one is named. A renumbering in one part re-keys `world.links` with THAT PART's own mapping, and a removal says how many crossings went with the dead room. ⛔ The op the session STORES is the world's own, never the re-based one: the session refolds its stored list from the base on every undo, so a local index in that list would replay against a global one and silently address a different part.

**A cross-part door is a different op SHAPE, not a different argument.** The parts spell an exit differently — Seedling's `connect` takes an ORDINAL, the maze an exit id — while a world link must name the DERIVED ATLAS exit id, which is what the merged atlas's endpoints are. So `connect {from: [room, exit], to: […]}` (an ARRAY pair) is a part's own and `connect {from: {part, room, exit}, to: {…}, one_way}` (an OBJECT pair) is the world's, and each refuses the other's case by name. `one_way` is REQUIRED on a world link: Seedling's derivation writes `one_way: true` on every connection it makes and the maze's default is `false`, so a crossing between them has no default that is not one substrate's law imposed on the other.

**The cell descriptor gains `part` and `substrate`, and both are READOUTS.** `writeOps` strips them and the cross-part paste check happens in `apply`, because `writeOps` never sees the record. Law 7 survives because `substrate` is a per-part CONSTANT for every part that can derive — a Seedling room's is `substrateIdFor(atlas.game)` for the whole set, and the maze derivation refuses per ENTRY anything it cannot read, so a part whose entries disagreed could not produce an atlas at all.

**`compileRegionAtlas` takes an injected sidecar row.** `options.sidecarBuilders` is a `{<substrateId>: builder}` map MERGED OVER the built-in two, and the refusal's "Buildable here:" list is derived from the merged table. It may replace the flash or the maze row, which is said out loud rather than guarded: that is the one thing a second flash-family game would want. `setEditorCore.roomRowsOf` and `reportOver` bind the composite exactly as they bind either single-substrate adapter — the REPORT's `substrate` column is read off what `reportOver` already returns (the derived atlas's regions and the compile report's `substrates` count).

**The chain, end to end on a MIXED world.** Two generated Seedling rooms and the first two entries of the committed `demo-maze-pack.json` → a world over both → the maze part's own ring (its array form) and one Seedling→maze crossing (the object form) → `deriveWorldAtlas` → `validateRegionAtlas(+schema)` clean → `compileRegionAtlas` with the maze row's `gridFor` bound to the library → `rulesJsonSchemaErrors` empty → `report.substrates` = `{flash_seedling: 2, maze: 2}` with the two payloads the two BUILDERS' own shapes → every region reachable from the Seedling start → `buildWarehouse` holds four regions across two substrates and two load events → undo ×N back to the base. The NEGATIVE is the control: the same world with the crossing removed compiles identically and the two maze regions fall out of reach, which the REPORT names and the export refuses over.


## The Seedling editor on the page (`watch.html`)

`?source=edit` is the page's fifth SOURCE arm, beside REPLAY, SOLVE, MANUAL and GENERATE. It is asked for by name and never inferred: `?level=N` is shared with SOLVE and MANUAL, and a stale link that landed in an editor would be a page that changed what a link meant.

**One edit implementation, two hosts.** The free-editing controls were a `<details>` nested inside `#generatePanel` with every handler a closure in the GENERATE arm. They are `#editPanel` now, shown for both arms, mounted by `seedlingDemo/watchEditor.js` over `procgenCore/editorView.js`. What differs between the arms is the HOST — the object `editorView` applies ops through:

- the EDIT arm's is an `editCore.createEditSession`, so `base, then edits` is the whole identity;
- the GENERATE arm's is a session-SHAPED object over the ladder's `state`, folding through `watchEdit.editState` exactly as it always did. The GENERATE payload, the `?gen=` replay and every committed fixture are byte-identical across the split because the fold that produces them never moved — not because something compares them afterwards.

**The armed value is the view's, and there is still one of it.** The GENERATE arm's click-to-anchor AT… gesture is registered as a page tool, so the vocabulary is six gestures in one table rather than two kinds in a page-local variable. `armedTemplate` is that gesture's parameter — which template it will place — exactly as the terrain `<select>` is the brush's. The page keeps a second canvas listener for `procgenLab:selectTile`, which fires in every arm and is not an edit; two listeners answering different questions is the maze page's own arrangement.

**The offered vocabulary is the whole `.oep`.** 144 types in the `<datalist>`, grouped by the folder the project file files them under — in each option's label AND as a `<select>` that narrows the SUGGESTIONS, since no engine renders groups inside a datalist. The type field stays a free `<input>`: narrowing what is suggested must never narrow what can be typed, and the op builder is still called WITHOUT a schema so a type Ogmo does not declare still reaches `buildLevelWorld` and refuses with its own construction site. The attribute form is generated from the declaration's own `values` with their declared ranges; it writes the JSON box and re-reads it, and the box stays the one value the op is built from, so an undeclared type still has somewhere to be spelled. **Empty means omitted** — `fillDefaults` is off, for the reason the corpus measurement gives above.

**The page's default place type is a named constant with a checked provenance.** It used to be `ENTITY_ROSTER[0].type`, which made *what the page opens on* and *the order of the offered list* one fact — so widening the list would silently have moved what a browser gate's `place` gesture places. `watchEditor.DEFAULT_PLACE_TYPE` is the first body `procgenPalette` places, and the tie is asserted at import time rather than remembered in a comment.

**The two-oracle bound is displayed and refuses nothing.** `levelWorld.ENTITY_CLASSES` transcribes a subset of the declared types — seven of the 144 are outside it — and a room holding one of those cannot be built by the JS model. The edit lands anyway, the readout names the types, and ▶ load in wasm is the certifier. SOLVE stays offered and the bound says what it will answer: removing the press would remove the page's only way to see `buildLevelWorld`'s own refusal. Note that *not one of the five the generator places* and *not transcribed* are different sets — `bob` is in the first and not the second.

**Launching, loading and saving.** `?source=edit&level=N` resolves an `atlas` base with the vanilla set's `set_id` read off the committed set, so the hash check is a real comparison. The LOAD box sniffs a payload, a raw OEL or a LEVEL SET by SHAPE; a `generate` base is refused by name as the ladder's ("open it from GENERATE"). Download is the payload, the room as OEL and the whole set with the edited room replaced, browser downloads only — the page never writes `fixtures/`. ▶ load in wasm ships the one-room set with a ZERO-INPUT tape and no expectation, because nothing has solved that room and the keyboard drives it. "Open in editor" in GENERATE hands the record and the `base` tag across in memory, with no reload and no edit in the URL: the edits cross AS the record and the tag says how many were already folded in, since handing both would apply them twice.

**The whole of Tier A reaches the DOM.** The tile picker addresses a COLUMN, not one of the generator's four terrain names: all 45 columns of `tiles` and all five pixelmasks of `cliffsides`, behind a layer `<select>` that refills it. The four names stay the first group and keep spelling themselves, because `{terrain:'ground'}` and `{column:0}` are two different ops that fold to the same record and respelling them would move bytes in every committed `?gen=` payload. The columns are grouped by `tileSemantics(type).kind` — the analyzer's own six-way answer — because grouping by the type NAME is 38 groups of one and no grouping at all. There is no tileset image to show: not one `.png` lives under `frontend/modules/flashPanel/`, the art is inside the recompiled `.wasm`, so an option carries a colour SWATCH and it is the canvas's own colour for that tile type, injected rather than copied. Hovering a cell prints what `readCell` has answered since slice B — its column, its tile type's name, its cliffside and its bodies — which is the first time the page says what a cell IS.

**Room flags are entities, and the roster is the classification that already existed.** `lightalpha`, `daynight`, `snow`, `blur`, `blur2`, `droplet` and `<control>` are entities in the OEL and level PROPERTIES in the game: `Game.loadLevelXML` reads them off `xml.objects[0]` and never constructs anything. So the form needs no new op — a presence flag is a `place`/`remove` and an attribute flag a `place` plus an `attrs` — and its roster is `seedlingSemantics.LEVEL_PROPERTY_TAGS`, imported. Deriving it instead from the schema's `utility` folder would have been a second answer to the same question, and a wrong one: six of that folder's thirteen types are bodies at a cell. A NEW flag is placed at the origin, which is where the 116 committed rooms put theirs; an existing one is read, written and removed at its own cell.

Two of the three ops can be inexpressible, and the form says so rather than guessing. `remove` and `attrs` address *the last entity in the cell*; measured over the committed atlas, 14 of 155 flag instances share their cell with another body and **2 of those are not the last one**, so a bare `remove` there would delete somebody else's body and call it turning a flag off. Those two refuse by name. ⛓ **That vocabulary change was then made, for `remove` only:** `remove {which}` names a body by 0-based ordinal among the entities at that tile, in `entities` order — the order `recordToOel` writes and `parseOelLevel` reads back. `which` is OMITTED when it was not given, so every edit list recorded before it folds to the same bytes; an out-of-range one refuses and says how many the cell holds, rather than clamping to the last. `attrs` was deliberately left alone: *the last entity in this cell* is that op's whole contract, and a second address for it would be a second vocabulary. So the FORM's refusal above still stands for `attrs`, and for `remove` it is now a page that has not been taught to pass the ordinal.

**What the JS model can see of a flag is MEASURED, not read off the class table.** `ENTITY_CLASSES` gives all seven `as3: null` — *"not an entity at all"* — which answers CONSTRUCTION, and a readout derived from it would report all seven as ignored. Built with the flag and without it, six worlds come back byte-identical and `<control>`'s does not: its `fallthrough` is what `Player.checkFallingInPit` reads, so pits are a transport primitive and that flag reaches the model. The page prints both sides and names the wasm as the only certifier of the other six.

**Resize shows ⚖ ruling 5's warning before and after.** `width`/`height` plus the anchor build one `resize` op; `resizeWarnings` runs on the typed values as a preview line with no confirm behind it (ruling 5 is that the edit is never blocked), and the same sentences come back from `foldEdits().steps` afterwards. A crop that would drop a tile or a body is refused by the op and the refusal is printed verbatim — `procgenLevel` names what would be lost, and a page that paraphrased it would be a second opinion about which cells are in danger.

**`set-room` is a launchable base.** A level-set document pasted into the LOAD box is validated through `validateLevelSet`, held on the page and its rooms offered; picking one resolves that room's `source.xml` through the `oel` arm, so one adapter path serves both. An `embed`-sourced room refuses by name — an `embed` is a path into a SWF's `[Embed]` table, a fact about a source tree — and that is the whole committed vanilla set, all 116 rooms of it, whose door is the ATLAS base instead. One button beside the LOAD box, `#editLoadVanilla`, derives those 116 as an `xml`-sourced set from the two documents the arm already holds — the map extract it awaited at mount and the manifest it fetched for the ATLAS base's own id — and hands the result down the pasted set's own intake, so there is one place a level set can be opened. It fetches nothing, and the browser row counts requests across the click to keep it that way.

**The page holds a SET SESSION, not a set** (`seedlingDemo/watchSetEditor.js`). A level set arriving in the LOAD box opens `createSetSession` over `{set, overlay}`; the room adapter's `levelSetSource` is `setSessionRoomSource(session)`, which resolves a room out of the session's CURRENT folded set — what a room opened after a `reorder` needs — and compares the tag's `set_id`, which `setRoomBase` itself does not. The OVERLAY is a third document and the box sniffs it by shape: a set's `rooms` is an ARRAY and an overlay's is an OBJECT keyed by room index. A page that could not load one would lose every location and every authored rule on the first reload, and the REPORT's location count is the only thing that would say so.

**The overview is a STRIP, one cell per room, and it is the adapter's own grid.** `bounds` is `{w: rooms.length, h: 1}`, so a square grid would have been a SECOND coordinate system to keep in step with the one the painter, `cellAt` and `rectCopy` all address rooms in. It carries its own `editorView`: the exits are drawn as POLYLINE shapes arced above the strip, one line per PAIR of rooms — a two-way door is ONE line with TWO heads, never two lines, because two arcs on one span cannot be told from two separate one-way doors, which is the single distinction `connect {one_way}` exists to make. The selected room's incoming links are highlighted. The room stills are drawn by the PAGE's own `previewLevel` into an offscreen canvas and blitted, with its readouts turned OFF: that function writes `__editorSpawn`/`__editorStill` about the room on the MAIN canvas, and a strip of thumbnails would overwrite them with its last cell.

**The two-click exit gesture is a page TOOL.** Click the source room, then the target, and ONE `connect` lands; `armed` is still the view's single `tool` and `armedExit` is that gesture's PARAMETER, exactly as `armedTemplate` is AT…'s. The RETURN DOOR is an ORDINAL rather than a room's exit, because which room is the destination is not known until the second click happens — and a target that has no such exit is refused BY NAME by the adapter with its real count. There is no second CONNECT button: a control that took the same two rooms from two `<select>`s would be a second spelling of the gesture.

**Two sessions, and which one `Ctrl+Z` hits is the DOM's own focus.** The strip's view binds its keys to the strip canvas; the room editor's binds its own to the document; a keydown STOPPER on the strip is what keeps one press from reaching two undo rows. The identity line says which session an undo will hit. Any RENUMBERING op (`reorder`, `add-room`, `remove-room`) DISCARDS an open room session that holds edits — loudly, naming how many went — and silently reopens one with zero ops on the room's new index. Not written back: a press on MOVE UP would otherwise become a `replace-room-xml` nobody asked for, inside the reorder's own group. And the download REFUSES while a room session holds unwritten edits, because a room's edits reach the set through `closeRoomSession` and a set missing work the reader can see on the canvas is worse than a refusal.

**The forms are derived and the rule targets are derived ONCE PER RENDER.** The manifest form is one row per `SET_FIELDS` entry, in the order the op accepts them; `named_rooms`' six keys and whether each carries an arrival POSITION come from `levelSetValidator.NAMED_ROOMS`, because the JSON schema itself says that file is the authority. `music`'s range is `Music.songs`' own, through the constants the op refuses against, so the form and the refusal cannot disagree. An exit rule target costs a DERIVATION, so it is computed exactly when the record or the selection can have moved — an applied op, an UNDO, or a selection — and never per keystroke. **An `in_*` ARRIVAL exit gates NOTHING and is marked as such**: for a `one_way` connection, which is every connection this derivation emits, `regionAtlasCompiler` records the `to` endpoint as `arrivalOnly` and builds no AP exit for it, so a rule there leaves the door FREE. The REPORT names any that were authored anyway and refuses the export over them.

**REPORT mode is a LIST, and the rules.json export refuses before it writes.** One button runs `rulesJsonOf(session, deps, {compileRegionAtlas})` and prints, as rows: `validateLevelSet`, `validateRegionAtlas(+schema)`, every `report.unwired_exits` by room and ordinal, every FREE edge (an exit or location whose COMPILED `access_rule` is `True_` — read off the compiled rules, not the atlas, because the atlas is what somebody typed and the rules are what the world will do), every authored rule that reaches no compiled edge, `reachableRegions` versus all regions with the unreachable ones NAMED, and the overlay's location count against the compiled one. The rules.json download is DISABLED with its reason printed while the graph does not close, the set is invalid, or a rule is inert; the set and overlay downloads stay offered, because a person may want to save work on a graph that does not yet close. A single cut-off room is not what that catches — the derivation DROPS a region with no door at all — so the shape it names is an ISLAND of two or more rooms that keep each other's doors.

**Downloads: three documents, one stamp, one press.** `downloadSet(session)` validates, stamps ONCE and returns the set, the stamped overlay and the `apMappingInvalidation` companion; the errors come back as a LIST through `validateForDownload` rather than split out of the throw's joined sentence. `rules.json` goes out through `stringifyRulesJson`, the marking tool's own writer, so the bytes are the ones `region-atlas-compile` would have written for that atlas. ▶ load in wasm ships the WHOLE SET when one is held — through the same `validatedChunks` the one-room ship uses, with a zero-input tape and no expectation, booting at the manifest's `start`.

**Each mount owns its own lifetime.** A new LOAD remounts this panel, and a listener registered on the ARM's lifetime would survive that — measured: after a second load, one button fired on BOTH mounts, the dead one applied its op to the old session and repainted the old `<select>` over the live one, so the page offered a rule target from a document nobody was editing.

Download also hands the set back with an edited room's XML replaced and the identity RE-STAMPED, so an edited set is a different set by construction; the reloaded room's `path` names the new id, which is the one field a round trip cannot preserve and should not.

**The id rule.** `genEdit*` is a control both arms mount (the `gen` prefix is history — free editing lived inside `#generatePanel` before the split); `edit*` is a control only the edit arm has, i.e. one inside `#editOnly`. `check-seedling-editor-arm.mjs` asserts the rule over the live DOM rather than against a list, so a control added under the wrong prefix reddens instead of quietly making the name a lie.

**The round trip, over all 116 shipped rooms.** `record → recordToOel → parseOelLevel → record` is a value fixed point 116 of 116, and parsing the DISK OEL reproduces the committed atlas record 116 of 116 — that second arm is the one with an independent source in it, and it is what keeps the first from being two implementations agreeing about the same mistake. Byte identity against the disk file is a MEASUREMENT and not an assertion: 0 of 116 exact, 64 of 116 modulo a trailing newline, with exactly three difference classes — the newline this writer adds and Ogmo does not, the out-of-rectangle tiles the extract discards in 51 rooms, and one room whose raw `>` inside an attribute value this writer escapes.

## Bundles

The single `rules.json` is **canonical** and always loadable. A **bundle** is an optional ZIP whose members are exactly the documents this repo already writes — no new format and no manifest, because a manifest would be a second description of four self-describing documents and the two would disagree the first time somebody edited one.

| Kind | What it is | How it is recognized |
|------|------------|----------------------|
| `rules` | a `rules.json` | `schema_version === 3` and `regions` is an object |
| `level-set` | a Seedling level set | `rooms` is an **array** (positions are ids) |
| `overlay` | the set's rule/location overlay | an `overlay_id`, or `rooms` keyed **by index** |
| `region-atlas` | a region atlas | an `atlas_id` and `regions[].region_id` |

`frontend/modules/presets/documentBundle.js` is the whole container. `classifyDocument` is the ONE classifier — `watchViewer`'s `sniffLoadBox` delegates to it, so the LOAD box and the bundle reader cannot drift — and the kind is derived from the **document**, never from the entry name, which is why a renamed member still reads back. `writeBundle` is deterministic: fixed entry order by kind, a fixed DOS-epoch mtime (the date does reach the bytes, and JSZip writes it from UTC getters, so this is stable across machines and timezones), and the rules member through `stringifyRulesJson` so the tile-array splice survives.

**What is refused, and what is merely named.** Two members of one kind refuse by name — a container with two level sets has no answer to "which set is this", and picking the first would be an answer the reader invented. A `.chunks.json` member refuses by name too: chunking is DELIVERY (how a set too large for one response is shipped), not a document anybody authored. An unclassifiable member is NAMED in `notes` and kept out of `members` — the CLI's `.ap-invalidation.json` companion travels that way, as a named extra rather than a member, because it is a derived table regenerated per set. A member that vanished without a word is indistinguishable from one that was never there.

**Where bundles appear.** `#editDownloadBundle` on `watch.html` (one press, one `.zip`, the same stamp the three-blob press writes — a fourth way to press, not a fourth stamp); `#editLoadFile` on the same page, which sniffs the FIRST TWO BYTES (`50 4b` for a zip, `1f 8b` for gzip) rather than the extension; the main app's preset file input, which loads the `rules` member and names the siblings it walked past; and `export-seedling-level-set.mjs --bundle`, which writes one beside the plain files and leaves STDOUT — the determinism channel — untouched.

JSZip is **injected**, never imported: `frontend/libs/jszip/jszip.min.js` is a vendored UMD script, so a page injects it (`loadJSZipBrowser`) and node evaluates it (`scripts/procgen/loadJSZipNode.mjs`). ⛔ `createRequire` cannot load it — the root `package.json` is `"type": "module"`, so node's resolver calls the UMD an ES module and refuses. That is why the loader evaluates the same vendored bytes the browser runs, rather than the repo gaining a second zip implementation.

## Minify, and gzip

`stringifyRulesJson(doc, {indent})` has had an `indent` parameter since it was written and no caller ever passed one. It is a setting now, declared once and mirrored on both sides:

- **Frontend** — `rulesJson.indent`, a top-level `settingsManager` scope (the schema is the default source; it is declared in `documentBundle.js` and registered by `app/core/coreSettingsSchemas.js`, so `watch.html` — which has no settingsManager at all — reads the same default without any of `app/core`). The `#editMinify` box on that page is its read.
- **Python** — `json_tools.rules_json_indent`, mirrored in the installer's `ExportSettings`; `exporter.py`'s write site reads it instead of a literal `indent=2`.

⛔ **The default does not move** — though not for the reason this section used to give. It said every committed `*_rules.json` was "byte pinned (29 byte-identity dumps, `test_schema_validation.py`, every `--check`)". EDITOR v3 W1 opened all three: the four `scripts/procgen/dump-*-byteidentity.mjs` read `frontend/presets/` **zero** times (they pin in-process generator determinism — the AP id namespace bases), `test/general/test_schema_validation.py` is `json.load` + `jsonschema.validate` and is blind to formatting, and no workflow runs a `--check` over presets. **The presets are committed DATA**, regenerated only on demand by `.github/workflows/generate-presets.yml` (`workflow_dispatch`, onto a `generated-presets` branch). The default stays 2 because that is what the committed corpus is indented at and what the frontend declares; `indent: 0` is only ever what a person asked for, per output.

**What IS pinned is that the two writers agree.** `test/test_rules_json_writer_agreement.py` re-dumps every JS-written committed preset through `exporter.py`'s `_dump_with_compact_sidecar_tiles` and asserts the file's exact bytes, and every non-ASCII preset for unescaped round-tripping. Both fixture sets are DERIVED by scanning `frontend/presets/`, so a new preset joins the pin without an edit. ⛓ The corpus carries **three formatting lineages** — see [gotchas](./gotchas.md#jsondumpsindent0-is-not-minified-and-the-python-mirror-took-two-lines-to-become-byte-identical-to-the-js-writer).

⚠ **`json.dumps(obj, indent=0)` is NOT minified in Python** — it emits a newline before every element — while JavaScript's `JSON.stringify(obj, null, 0)` is. The exporter maps 0 to `separators=(',', ':')`; the two writers would otherwise disagree about what "minify" means. On `seedling_playthrough/AP_1`: 806,684 B at indent 2 → 362,912 B at indent 0 (45.0%).

**Gzip is a LOADER seam, not a delivery optimization.** `gunzipIfNeeded` sniffs the `1f 8b` MAGIC — never a name, never a `content-encoding` header — because a wire-gzipped response has ALREADY been decoded by the browser and a header-keyed gunzip would double-decode a file that was never a `.gz`. It is one path, feature-detected on `DecompressionStream`, which is native in both browsers and node ≥ 18.

⛔ **No committed preset is gzipped, and none should be.** GitHub Pages already gzips on the wire: `presets/seedling_playthrough/AP_1/AP_1_rules.json` is 806,703 B on disk and **43,140 B** with `Accept-Encoding: gzip` (`preset_files.json`: 242,329 → 9,668). A committed `.gz` would buy roughly nothing and cost a decode. The seam exists so a `.json.gz` somebody else hands you loads.

## Determinism and verification

- **Seeded rng everywhere.** All generation randomness flows from `createRng(seed)` (`frontend/modules/shared/rng.js`, mulberry32 with `getState`/`setState` for step-boundary snapshots).
- **The sphere plan is an oracle.** In sphere-growth mode, the compile step recomputes actual item spheres from the built world and compares them to the plan; the CLI exits non-zero on a mismatch.
- **Headless CLI.** Everything the panel does can run in Node under `scripts/procgen/` — dump scripts per driver, the per-step drivers, and byte-identity verifiers. See [scripts/procgen/README.md](../../../../scripts/procgen/README.md).
- **In-app round-trip test.** `scripts/procgen/verify-bounce-embed.mjs` drives a generated bounce world through the real frontend with Playwright, from first check to Victory.

## Related documentation

- [Loops feature](../../features/loops.md) — loop mode from the user side
- [Module System](../guides/module-system.md) — how frontend modules register
- [World Generator](../guides/world-generator.md) — JSON → Python world conversion
- [Headless procgen scripts](../../../../scripts/procgen/README.md) — CLI reference
