# NewDocs Reference Map

Inventory of in-code references to gitignored `NewDocs/` paths (90 references across ~60 files as of 2026-07-01, counted via `LC_ALL=C grep -rn "NewDocs" frontend/modules frontend/app scripts world_generator exporter rule_builder iframe_games`, tests excluded). Each group maps to the official doc that must exist in `docs/json/developer/procgen/` (or elsewhere) before its references can be repointed.

Two kinds of reference, treated differently when repointing:
- **Architecture references** ("see X for the design this implements") — repoint to the official doc.
- **History references** ("built per plan X", refactor motivations) — often better *deleted* once the code is simply the current state; decide per file.

Note: files under `frontend/modules/shared/` and `frontend/modules/textAdventureEngine/` are in git submodules — repointing those needs submodule commits + pointer bumps.

## Repointable now (official doc already exists)

| NewDocs target | Refs | Referencing files | Replacement |
|---|---|---|---|
| `procgen-player.md` | 3 (+2 implicit, no `NewDocs/` prefix, in `substrateRegistry.js` header) | `procgenPlayer/index.js`, `procgenPlayerEngine.js`, `mazeRoomLibrary.js` | `docs/json/developer/procgen/architecture.md` + `substrate-registry.md` |
| `substrate-pipeline-architecture.md` | ~5 | `world_generator/generator.py`, `exporter/games/base/handler.py`, `mazeRoomEngine.js`, `scenarioPool.js`, `procgenPipelineEngine.js` | `architecture.md` (sidecar round-trip, dispatch) — verify each ref's specific claim is covered |
| `text-adventure-substrate.md` (registry-entry aspects only) | ~4 | `adapterPrimitives.js`, `spatialPrimitives.js`, `textAdventureSubstrate{Library,/index}.js` | `substrate-registry.md` for entry-contract refs; build-time primitive internals need the substrate doc below |

## Blocked on documents still to write

| Proposed official doc | Replaces (NewDocs) | Refs | Referencing files (main) |
|---|---|---|---|
| ~~**`bounce.md`**~~ **DONE 2026-07-01** — doc landed; all bounce refs repointed/removed (incl. bare non-`NewDocs/`-prefixed mentions in `apRules.js`, `verifyObstacles.js`, `generator.js`; history refs removed per user decision) | `dj-metroidvania-v2.md`, `dj-measurements/`, `dj-loader-integration-spec.md`, parts of `topdown-bounce-obstacle-refactor.md` | ~19 | done |
| **`sphere-growth.md`** — deep dive: planner/oracle, wave growth, gating, per-sphere batching | `sphere-driven-growth.md`, `per-sphere-batching.md`, `sphere-growth-apworld-integration.md` | ~7 | `spherePlanner.js`, `sphereSteps.js`, `procgenPipelineEngine.js`, `bounceDemo/generator.js`, `bounceDemoLibrary.js`, `apworldEditor/rulesUtils.js`, `scripts/procgen/dump-sphere-growth.js` |
| **`maze.md`** — maze substrate: room generator, biomes/wall backends, content modules (hazards) | `maze-room-generator.md`, `maze-biomes.md`, `maze-content-modules.md` | ~10 | `mazeRoom/*` (index, UI, queue, biomeLibrary, css), `shared/procgen/contentModules/*`, `shared/procgen/mazeAlgorithms/registry.js` |
| ~~**`playback-and-debugging.md`**~~ **DONE 2026-07-01** — doc landed; main-repo refs repointed (`playbackBot/*`, `playbackProxy.js`, `mazeRoomVisualizer.js`). Remaining: submodule files (`shared/playbackControlBar.js`, `shared/playbackClock.js`, `shared/simulatorCore.js`, `shared/procgen/forwardSimulator.js`) deferred to the batched submodule pass; `mazeRoomEditor.js` goes with maze.md | `playback-bot-refactor.md`, `async-playback-bot.md`, `debugging-tools.md`, `shared-simulator-core.md` | ~11 | see left |
| **`stepped-pipeline.md`** — envelope format, step editing, region editors, CLIs, byte-identity detail | `topdown-stepped-pipeline.md`, `region-step-editing.md`, `grid-growth-pipeline.md`, `stepped-pipeline-cli.md` | ~4 | `procgenPipeline/index.js`, `bounceRegionEditor/index.js`, `scripts/procgen/dump-topdown-byteidentity.mjs` |
| **`paths-and-obstacles.md`** (or a section in `architecture.md`/`sphere-growth.md`) — the rule representation and Boolean compilation | `pipeline-overview.md` (the parts architecture.md doesn't cover), rest of `topdown-bounce-obstacle-refactor.md` | ~5 | `shared/procgen/library.js`, `pathsAndObstaclesCompiler.js`, `ruleRequirements.js`, `mazeRoomEngine.js` |
| **`text-adventure.md`** — engine spec + substrate + wrapper/bridge | `textadventure-engine-spec.md`, rest of `text-adventure-substrate.md` | ~3 | `textAdventureEngine/engine.js` (submodule), `textAdventureSubstrateWrapper/index.js` |
| **`flash.md`** | `flash-substrate-converged.md` | 2 | `flashSubstrate/index.js`, `flashSubstrateLibrary.js` |
| **`jta.md`** | `jta-substrate-v1-plan.md` | 1 | `jtaSubstrateWrapper/index.js` |
| **loops dev-doc addition** (extend `docs/json/developer/reference/loops-module-states.md` or `features/loops.md`) | `loops-queue-and-manual-mode.md` | 1 | `gameState/state.js` |

## Non-procgen references (separate decisions)

| NewDocs target | Refs | Referencing files | Note |
|---|---|---|---|
| `presets-panel-overhaul.md` | ~7 | `presets/presetUI.js` (×5), `procgenPipelineEngine.js` (×2) | Needs a presets-panel doc, or repoint the pipeline refs to `architecture.md`'s sidecar section |
| `tile-map-analyzer-physics-model.md`, `tile-map-analyzer.md`, `NewDocs/reference/tile-map-analyzer-reachability.md` | 6 | `tileMapAnalyzer/*` | Module is disabled by default; decide whether it merits a doc or the refs become brief in-code notes |
| Generic `NewDocs/plans/` mentions | ~3 | `scripts/utils/register-preset.py`, `exporter/exporter.py` | Likely one-line rewrites, no doc dependency |

## Status

- [x] 2026-07-01 — inventory taken; architecture / substrate-registry / gotchas docs landed
- [ ] Repoint the "repointable now" group (verify each claim is actually covered first)
- [ ] Write the blocked docs (outline-first per the docs workflow), repointing each group as its doc lands
- [ ] Sweep: `LC_ALL=C grep -rn "NewDocs"` over code returns only test files / nothing
