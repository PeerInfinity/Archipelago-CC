# Procgen Gotchas and Disambiguations

Short entries for the things most likely to mislead someone orienting in the procgen code. Each is a present-state fact with file pointers, not a bug report.

## "Braid" is not a pipeline driver

The pipeline's Mode toggle offers exactly four drivers (grid growth, sphere growth, shuffled spiral, top-down — `frontend/modules/procgenPipeline/procgenPipelineUI.js`). "Braid" names a **bounce level-generation regime** inside the bounce substrate's generator (`frontend/modules/bounceDemo/generator.js`): the 2-wide branching-path geometry bounce uses for its zones, in two regimes (Regime 1: movement arrows free; Regime 2: gated, where items gate progress). Braid code runs *within* a driver's per-region realisation of bounce regions, not as a layout mode of its own.

## bounceDemo shares flashSubstrate's code, not its identity

`bounceDemo` has no panel class of its own — its entry is literally built by `createFlashSubstrateEntry(...)` and its panel comes from `flashSubstrate`'s panel factory and bridge. But it registers its **own** routing identity: component type `bounceDemoPanel`, load event `bounce:loadRegion`, iframe id `bounceDemo` (`frontend/modules/bounceDemo/bounceDemoLibrary.js`). Bounce region loads therefore never configure the flash placeholder's bridge, and host activation brings the bounce panel forward. Shared code, separate instances.

## Two text-adventure modules register the same substrate id

`textAdventureSubstrate` (direct panel) and `textAdventureSubstrateWrapper` (iframe-hosted) both define substrate id `text_adventure` with the same load event and build-time hooks. Registration is first-wins behind a `has()` guard; in the default module config the direct-panel module is **disabled**, so the wrapper is the live one. If you grep for the text-adventure substrate you will hit the disabled module first — check `frontend/module-configs/modules.json` before reading either.

## Three loop-cost engines, one store

Four files deal with loop-mode mana costs and they are easy to conflate:

- `frontend/modules/loops/costGenerator.js` — the **live** generator: produces a costs sidecar by actually playing the sphere log through the running loop engine (dispatches real events, waits on state snapshots).
- `frontend/modules/shared/procgen/loopCostGenerator.js` — a **pure, headless** implementation of the same algorithm for the procgen pipeline and tests (`procgenPipelineEngine.js` calls it to stamp `loop_costs` at compile time). Its sidecars are interchangeable with the live generator's.
- `frontend/modules/loopsCostDebugger/costPlanner.js` — a **debugger/verifier**, not a production generator. It simulates cost assignment step-by-step with a richer and *intentionally different* model (XP levels, per-loop mana budgets, explore/check phases), so its numbers do not match the generators'; it can also verify an existing sidecar against its formula.
- `frontend/modules/loops/costDataManager.js` — not a generator at all: the runtime **store** (load/validate/serve) that both generators write into and the loop simulation reads from.

## procgenPlayer has no panel

The module that recognizes a procgen `rules.json` and routes every region transition at play time — `frontend/modules/procgenPlayer/` — never appears in the layout. It is a headless coordinator: it builds the region warehouse from `preset_sidecars` and publishes each substrate's `loadRegion` event. If play-time routing misbehaves, look here first, not in the substrate panels.

## Byte-identity is a load-bearing invariant

The stepped pipeline (panel steps and the `scripts/procgen/*-step.js` CLIs) must reproduce the monolithic drivers' output **byte-for-byte** at default batching. This holds because all randomness is one continuous seeded rng stream consumed in the monolithic order, with snapshots threaded across step boundaries (`frontend/modules/procgenPipeline/sphereSteps.js` — its header documents the threading rules). Adding, removing, or reordering rng draws anywhere in the engine or step-runners breaks the contract silently; `scripts/procgen/verify-*.mjs` and the step-runner tests are what catch it. Treat any new `rng()` call in generation code as a change that needs those verifiers re-run.

## Which substrates are live depends on the launch mode

Module enablement is not global: `frontend/modes.json` maps launch modes to config variants in `frontend/module-configs/` (`modules.json`, `modules-nograph.json`, `modules-jta.json`, …), each enabling a different module set. A substrate that works in the default mode may be absent in another — the regression-test mode's config, for example, omits substrate runtimes entirely. When a substrate "is not registered," check which mode (and therefore which config file) the app was launched with before debugging the registry.

## `shared/` is a git submodule

`frontend/modules/shared/` (home of the substrate registry, rng, procgen primitives) and `frontend/modules/textAdventureEngine/` are git submodules with their own history and remotes. `git log`/`git blame` from the outer repo won't see their commits — run git *inside* the submodule directory. Edits to files under these paths land in the submodule, not the outer repo; landing a change means committing inside the submodule, then bumping the submodule pointer in a separate outer-repo commit.

## Related documentation

- [Architecture](./architecture.md)
- [Substrate Registry Reference](./substrate-registry.md)
