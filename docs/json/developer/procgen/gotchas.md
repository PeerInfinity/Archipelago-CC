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

A change to the *pricing vocabulary* has to land in **both** generators or it is a no-op where it matters. M5's summary time-pricing (`timeDrainPerSecond` instead of a `moveCost`) went into the live generator first; only the pure one actually stamps `loop_costs` into generated presets, so until it followed, every generated world still assigned a moveCost and location costs to runner/bounce regions — charging the time drain *and* the per-action costs on every visit, which is exactly what the ruling forbade. The live generator is the one almost nobody runs.

## procgenPlayer has no panel

The module that recognizes a procgen `rules.json` and routes every region transition at play time — `frontend/modules/procgenPlayer/` — never appears in the layout. It is a headless coordinator: it builds the region warehouse from `preset_sidecars` and publishes each substrate's `loadRegion` event. If play-time routing misbehaves, look here first, not in the substrate panels.

## Byte-identity is a load-bearing invariant

The stepped pipeline (panel steps and the `scripts/procgen/*-step.js` CLIs) must reproduce the monolithic drivers' output **byte-for-byte** at default batching. This holds because all randomness is one continuous seeded rng stream consumed in the monolithic order, with snapshots threaded across step boundaries (`frontend/modules/procgenPipeline/sphereSteps.js` — its header documents the threading rules). Adding, removing, or reordering rng draws anywhere in the engine or step-runners breaks the contract silently; `scripts/procgen/verify-*.mjs` and the step-runner tests are what catch it. Treat any new `rng()` call in generation code as a change that needs those verifiers re-run.

## Which substrates are live depends on the launch mode

Module enablement is not global: `frontend/modes.json` maps launch modes to config variants in `frontend/module-configs/` (`modules.json`, `modules-nograph.json`, `modules-jta.json`, …), each enabling a different module set. A substrate that works in the default mode may be absent in another — the regression-test mode's config, for example, omits substrate runtimes entirely. When a substrate "is not registered," check which mode (and therefore which config file) the app was launched with before debugging the registry.

## A substrate's replay can depend on a module the config disables

Module enablement is per launch-config (above) — and a substrate whose replay path *delegates* to another module inherits that config's answer. jta's fine-grained Playback runs its recording through the `jtaQueueEngine` executor, which was `enabled: false` in `modules.json` (the default and substrate-test config) until 2026-07-23: `getEngine()` returned null, the replay fell through to its "cross the recorded exit anyway" fallback, and Playback became a bare teleport that from the queue's side looked exactly like a working replay. Unit tests stub the engine and cannot see it. Two habits: enable the dependency in every config the substrate runs in, and assert a replay's **effects** (did the recorded actions actually get performed?) rather than only its outcome (did the region change?).

## In managed mode JtA never advances its own zone

The procgen host owns zone transitions, so the fork's `onFullyFinishTask` fires the travel callback and skips `advanceZone()`. Engine code that assumed "completing the zone's Travel task changes `GAMESTATE.tasks`" silently loops forever instead — that is exactly how `skipCurrentZoneIfFree()` hung `doEnergyReset()` once the player held Minor Time Compression. Relatedly, **`setAutomationEndZone` is not a way to confine a headless driver to a zone range**: `automation_end` gates nothing continuously, it switches automation *Off permanently* once `(zone + 1) >= automation_end`. The full set of managed-mode zone invariants (including why out-of-order zone play is safe) is in [jta.md](./jta.md#managed-mode-zone-invariants).

## A frozen substrate cannot generate the reset that unfreezes it

JtA latches `is_in_energy_reset` the instant energy reaches 0, and `updateGamestate()` returns early for as long as it is set — the game is frozen until `doAnyReset()` clears it. In managed mode nothing in the game clears that latch; only the bridge does, via `_applyCatchUpResets()`, which fires only when the **host's** reset count advances. The host advances it when the shared pool reaches 0, which needs drains, which need a running game. That is a closed loop, and the energy pin closes it: `_syncEnergyFromPool()` pushes pool energy into the game unconditionally, including while latched, so energy reads above 0, the game never drains again, no reset is ever fired, and the latch is never cleared. Seen as `inReset=true, energy=1e9, pool=1e9, hostResets=2/2` — both sides believing they are square while the game sits frozen forever (it hung `jta-bot-walkto-exit` ~1 run in 3).

The generalisable rule for any substrate bridge: **if the host is the sole reset authority, never let a pin mask the condition the host uses to decide a reset is due.** Pinning a resource above the threshold that would have triggered the reset makes the substrate's run-end invisible, and a substrate frozen waiting for that reset cannot produce the signal that would cause it.

The bridge holds up its half of that in two pieces, and **both are needed — the first alone converts the hang into a quieter one**:

1. **The pin declines while the latch is set.** `_syncEnergyFromPool()` writes nothing at all (current *and* max) while the fork is latched, and drops the pool value rather than deferring it: the resync point is the catch-up-then-pin ordering *after* the host's reset, and that pin carries the refilled pool, so a stale pre-reset value applied later would only overwrite the refill. Its bookkeeping is skipped for the same reason — baselining `_lastSampledEnergy` to the pool while the game sits at 0 would make the next poll publish a drain the game never spent. (`loadRegion`'s own re-baseline was fabricating exactly that, and now reads the fork's real energy.)
2. **The bridge reports the run end.** Declining alone leaves the fork latched at 0 with mana still in the pool, and the *only* thing that could drain that pool is the game the latch froze — the host never fires a reset, and the circuit breaker below is blind to it because energy is 0, not above it. So the poll reports the latch on the generic channel (`substrate:resourceReset`, the same event a game-initiated reset uses), after the drain mirroring so a pool that empties in the same beat fires the reset itself and the report is dropped as covered. The bridge never runs `doEnergyReset` for this and never touches `_lastAppliedResetCount`: the host fires the loop reset, and its catch-up clears the latch. **The host stays the sole reset authority — the fix is to stop lying to it, not to take the decision away from it.**

This also covers a run end the drain-watching model cannot see at all: `handleThresholdStall`'s "End Run" latches with energy *left over*, so no drain to 0 ever happens.

The circuit breaker that shipped first stays as a **tripwire**: it detects the impossible state (latched **with** energy above zero — unreachable through the game's own logic, since the latch is set at exactly 0 and `doAnyReset` both refills and clears) and completes the reset through the normal reported path after it persists ~1s. Under the two rules above nothing can reach that state, so its predicate is now unreachable and its silence is the oracle for the fix — a firing means something external is writing energy while latched again. `jta-latched-run-end-not-masked-by-pin` is the deterministic leg: it builds the divergence directly (latched at 0 with mana still in the pool) and folds `setEnergy` mutations instead of polling, because the reset erases the state within a beat.

## `shared/` is a git submodule

`frontend/modules/shared/` (home of the substrate registry, rng, procgen primitives) and `frontend/modules/textAdventureEngine/` are git submodules with their own history and remotes. `git log`/`git blame` from the outer repo won't see their commits — run git *inside* the submodule directory. Edits to files under these paths land in the submodule, not the outer repo; landing a change means committing inside the submodule, then bumping the submodule pointer in a separate outer-repo commit.

## Generating a procgen world in-page can time out every iframe

`arrangeShuffledSpiral` + `buildRulesJson` are convenient for building a synthetic loop-mode world inside an in-app test, but they run **synchronously on the main thread**, and the per-substrate level generators are not cheap. A 6-region *runner* spiral measured ~2 minutes of blocked main thread — long enough that the iframeAdapter declared every substrate bridge dead ("heartbeat timeout, disconnecting"), so the test that needed one of those bridges failed for a reason with no visible connection to its subject, and the whole Playwright suite blew its 5-minute budget.

Cheap substrates (text adventure) are fine — `taswBlockModeTests` does exactly this. For an expensive one, load a **committed preset** instead and synthesize only the small piece you need (`runnerBlockModeTests` loads `runner_worldgen` and generates just the `loop_costs` sidecar with the pure generator, which is a fast pure function — and doubles as an end-to-end check of that generator).

## Related documentation

- [Architecture](./architecture.md)
- [Substrate Registry Reference](./substrate-registry.md)
