# Procedural Generation Architecture

This is the orientation document for the procedural-generation ("procgen") system: how a world is generated in the browser, what it compiles to, and how it is played back. Read this first; the other documents in this section go deeper on individual pieces.

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
