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

**233 instruments** live in `scripts/procgen/`, by prefix: `probe-` 55 (21 browser) · `verify-` 49 (30 browser) · `plan-` 33 (1 browser) · `check-` 26 (20 browser) · `census-` 12 · `dump-` 6 · `solve-` 6 · `sweep-` 6 · `make-` 5 · `recon-` 5 · `region-` 5 · `generate-` 4 · `extract-` 3 · `attribute-` 2 · `audit-` 2 · `export-` 2 (1 browser) · `batch-` 1 · `build-` 1 · `find-` 1 · `harvest-` 1 · `measure-` 1 · `mine-` 1 · no prefix 1 · `prove-` 1 · `run-` 1 · `show-` 1 · `stamp-` 1 · `survey-` 1.

73 of them drive a real browser; 141 accept at least one `--flag`; 66 are cited by one of these documents; and 0 open with no comment at all.

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
