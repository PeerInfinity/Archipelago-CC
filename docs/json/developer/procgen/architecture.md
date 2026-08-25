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

**250 instruments** live in `scripts/procgen/`, by prefix: `probe-` 59 (22 browser) · `verify-` 49 (30 browser) · `plan-` 36 (1 browser) · `check-` 27 (21 browser) · `census-` 12 · `solve-` 7 · `dump-` 6 · `sweep-` 6 · `make-` 5 · `recon-` 5 · `region-` 5 · `generate-` 4 · `extract-` 3 · `attribute-` 2 · `audit-` 2 · `export-` 2 (1 browser) · no prefix 2 · `batch-` 1 · `build-` 1 · `derive-` 1 · `find-` 1 · `harvest-` 1 · `lint-` 1 · `measure-` 1 · `mine-` 1 · `prove-` 1 · `reach-` 1 · `record-` 1 · `rerecord-` 1 · `run-` 1 · `seedling-` 1 · `show-` 1 · `stamp-` 1 · `standing-` 1 · `survey-` 1.

75 of them drive a real browser; 154 accept at least one `--flag`; 79 are cited by one of these documents; and 0 open with no comment at all.

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
| `preset_sidecars` | Per-player, per-region **playable payloads** — the serialized substrate world for each region (tile grids, platform geometry, prose templates, …), keyed by region id with the substrate id alongside. This key is also the marker the runtime uses to recognize a procgen world. |
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
| `apply(record, op)` | ONE atomic op → `{ok, op, description, record?}`. The `op` returned is the RESOLVED one (every drawn parameter spent). `ok: false` is a refusal by name; the input record is never mutated. |
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
4. **The selection overlay, and nothing else.** The substrate is drawn by the page (the one-renderer law); the view creates its own element and draws on it the rectangle a copy is being dragged out of and the paste anchor. Hover stays the page's, or two renderers would answer "which cell is under the pointer".

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

**Mounted today** on the maze lab page's EDIT arm and on `watch.html`'s shared
edit panel, each on its arm's own lifetime.

## The Seedling editor's data model (`seedlingDemo/`)

`watchEdit.js` is the op vocabulary and `seedlingEditAdapter.js` is the wrapper that makes it an `editCore` adapter. The ops address CELLS, never list indices, because the edit list is IDENTITY and travels in a payload a person reads.

| op | what it takes |
|---|---|
| `paint` | `{tx, ty, layer?, terrain \| column}` — either of the game's two tile layers, and on `tiles` any of the 45 tileset columns rather than only the generator's four terrain names |
| `place` | `{tx, ty, type, attrs, nodes?}` |
| `attrs` | `{tx, ty, attrs}` — the last entity in the cell; REPLACED, never merged |
| `remove` | `{tx, ty}` — the last entity in the cell |
| `nodes` | `{tx, ty, nodes}` — replaces that entity's `<node>` children; an empty list removes the field |
| `resize` | `{width, height, anchor}` — the one op about the ROOM rather than a cell |

**The vocabulary is DERIVED, not typed.** `scripts/procgen/extract-seedling-ogmo-schema.py` reads `~/CC/seedling/Shrum.oep` — the Ogmo 1 project file the game's own 116 rooms were authored against — into `seedlingDemo/fixtures/seedling-ogmo-schema.json`: 144 entity declarations, 166 typed values with their defaults and ranges, the two tilesets and the three layers. Its `--check` is byte identity, because the producer's output is a fingerprint of its input, and `provenance.oep_sha256` is what tells "the source moved" apart from "the script moved". A hand-written attribute table would be a second declaration of the same facts, wrong silently.

The schema is **injected**, never read by the modules that use it — one `node:fs` anywhere on the page's import graph makes the whole graph unloadable in a browser. So are the level source, the vanilla set's `set_id` and the OEL parser, each refused by name at the moment it is needed. The parser has a third reason: no module under `frontend/` imports anything under `scripts/`, and reversing that direction for one function would be the tree's first inversion.

**Two things the `.oep` measurement overturned.** There is no tile column to refuse for being unused — all 45 build a type `levelWorld` transcribes, so the only paint refusal on that layer is out-of-range. And Ogmo does **not** reliably write every declared value: 183 of the 2,461 entity instances in the shipped rooms lack one, every absent value has a declared default, and every one of them was added to the project file after those rooms were last saved. Filling omitted attributes from their defaults is therefore an editor convenience asked for by name (`fillDefaults`), not a property of the format.

**The `base` union** (`{kind, …}`, the payload's identity half). Seedling resolves `atlas` — refusing a `set_id` that is not the vanilla set's content hash, in the same shape the game's save stamp refuses a save written against different level bytes — and `oel`, a pasted document through the injected parser. `generate` and `set-room` are members that refuse by name, because "the GENERATE ladder owns that identity" is a more useful sentence than "no such kind".

**The bounds it names.** A paste does not clear the destination's bodies: Seedling has no clear-cell op, `remove` takes one body at a time, and `writeOps` sees a descriptor rather than a record — so a paste onto an empty cell reproduces it exactly and onto an occupied cell it accumulates. And a vanilla record's attributes carry the author's key order while every op path canonicalises to sorted, so an editor that rewrites a vanilla cell re-orders that entity's attributes in the saved OEL: value-inert, byte-visible.

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

Two of the three ops can be inexpressible, and the form says so rather than guessing. `remove` and `attrs` address *the last entity in the cell*; measured over the committed atlas, 14 of 155 flag instances share their cell with another body and **2 of those are not the last one**, so a bare `remove` there would delete somebody else's body and call it turning a flag off. Those two refuse by name. An op that could name WHICH body is a vocabulary change, i.e. a decision.

**What the JS model can see of a flag is MEASURED, not read off the class table.** `ENTITY_CLASSES` gives all seven `as3: null` — *"not an entity at all"* — which answers CONSTRUCTION, and a readout derived from it would report all seven as ignored. Built with the flag and without it, six worlds come back byte-identical and `<control>`'s does not: its `fallthrough` is what `Player.checkFallingInPit` reads, so pits are a transport primitive and that flag reaches the model. The page prints both sides and names the wasm as the only certifier of the other six.

**Resize shows ⚖ ruling 5's warning before and after.** `width`/`height` plus the anchor build one `resize` op; `resizeWarnings` runs on the typed values as a preview line with no confirm behind it (ruling 5 is that the edit is never blocked), and the same sentences come back from `foldEdits().steps` afterwards. A crop that would drop a tile or a body is refused by the op and the refusal is printed verbatim — `procgenLevel` names what would be lost, and a page that paraphrased it would be a second opinion about which cells are in danger.

**`set-room` is a launchable base.** A level-set document pasted into the LOAD box is validated through `validateLevelSet`, held on the page and its rooms offered; picking one resolves that room's `source.xml` through the `oel` arm, so one adapter path serves both. An `embed`-sourced room refuses by name — an `embed` is a path into a SWF's `[Embed]` table, a fact about a source tree — and that is the whole committed vanilla set, all 116 rooms of it, whose door is the ATLAS base instead. Download hands the set back with the edited room's XML replaced and the identity RE-STAMPED, so an edited set is a different set by construction; the reloaded room's `path` names the new id, which is the one field a round trip cannot preserve and should not.

**The id rule.** `genEdit*` is a control both arms mount (the `gen` prefix is history — free editing lived inside `#generatePanel` before the split); `edit*` is a control only the edit arm has, i.e. one inside `#editOnly`. `check-seedling-editor-arm.mjs` asserts the rule over the live DOM rather than against a list, so a control added under the wrong prefix reddens instead of quietly making the name a lie.

**The round trip, over all 116 shipped rooms.** `record → recordToOel → parseOelLevel → record` is a value fixed point 116 of 116, and parsing the DISK OEL reproduces the committed atlas record 116 of 116 — that second arm is the one with an independent source in it, and it is what keeps the first from being two implementations agreeing about the same mistake. Byte identity against the disk file is a MEASUREMENT and not an assertion: 0 of 116 exact, 64 of 116 modulo a trailing newline, with exactly three difference classes — the newline this writer adds and Ogmo does not, the out-of-rectangle tiles the extract discards in 51 rooms, and one room whose raw `>` inside an attribute value this writer escapes.

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
