# Procgen Gotchas and Disambiguations

Short entries for the things most likely to mislead someone orienting in the procgen code. Each is a present-state fact with file pointers, not a bug report.

## "Braid" is not a pipeline driver

The pipeline's Mode toggle offers exactly four drivers (grid growth, sphere growth, shuffled spiral, top-down — `frontend/modules/procgenPipeline/procgenPipelineUI.js`). "Braid" names a **bounce level-generation regime** inside the bounce substrate's generator (`frontend/modules/bounceDemo/generator.js`): the 2-wide branching-path geometry bounce uses for its zones, in two regimes (Regime 1: movement arrows free; Regime 2: gated, where items gate progress). Braid code runs *within* a driver's per-region realisation of bounce regions, not as a layout mode of its own.

## bounceDemo shares flashSubstrate's code, not its identity

`bounceDemo` has no panel class of its own — its entry is literally built by `createFlashSubstrateEntry(...)` and its panel comes from `flashSubstrate`'s panel factory and bridge. But it registers its **own** routing identity: component type `bounceDemoPanel`, load event `bounce:loadRegion`, iframe id `bounceDemo` (`frontend/modules/bounceDemo/bounceDemoLibrary.js`). Bounce region loads therefore never configure the flash placeholder's bridge, and host activation brings the bounce panel forward. Shared code, separate instances.

## Substrate libraries register on IMPORT — headless scripts depend on it

`mazeRoomLibrary.js`, `bounceDemoLibrary.js`, `runnerDemoLibrary.js` and
`textAdventureSubstrateWrapperLibrary.js` all end with the same block:

```js
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
```

That side effect is a contract, not an implementation detail. The app registers
substrates from each module's `register()`, but the **headless procgen scripts**
(`scripts/procgen/*.js`, `scripts/utils/generate-topdown-preset.js`) and
`procgenPipelineEngine.test.js` are a separate boot context where no module
`register()` ever runs — they get their substrates purely by importing the
libraries, as their own comment says ("Substrate libraries register their
adapters on import").

**Why this bites:** a substrate that fails to register is not an error. The
pipeline just skips regions asking for it, so a script writes a world *missing*
that substrate and exits 0. The wrapper library was the one substrate library
lacking the block, which went unnoticed for as long as the deprecated
`textAdventureSubstrate`'s own side effect happened to cover those scripts;
deleting that module (2026-07-26) would have silently broken seven consumers had
the block not been added first.

When you re-home an import like this, assert the registry actually contains the
id afterwards — and check the ENTRY, not just presence: pointing a script at a
different library can register a *different* entry shape.

## One loop-cost engine, one store — and the debugger is its inspector

Three files deal with loop-mode mana costs and they used to be easy to conflate, because two of them were
different *algorithms*. Since 2026-09-06 there is **one**:

- `frontend/modules/shared/procgen/loopCostPlanner.js` — **THE model**, pure and headless. It simulates a
  playthrough over the sphere log (⚖ the user: *"assigning costs for each region based on what the player can
  afford by the time they get there"*): one planned step per action queue, regions priced just-in-time out of
  what is left after the walk reaches them, explore at `DEFAULT_EXPLORE_MULTIPLIER` × the region's cost, then a
  defaults fill for whatever the log never reached. It reads a **topology** — `{startRegion, regions, locations,
  adjacency, regionSubstrates}` — never a state manager and never a rules.json.
- `frontend/modules/shared/procgen/loopCostGenerator.js` — the **block producer**. It builds the topology from a
  rules.json (`topologyFromRulesJson`), plans, and applies the **write-by-class** rule (below). This is what the
  **procgen pipeline** calls at compile time (`procgenPipelineEngine.js`, when `enableLoopMode && embedSphereLog`).
- `frontend/modules/loopsCostDebugger/costPlanner.js` — the **driver and inspector**, not a model. It extends the
  shared planner and supplies the three things the pure core must not know: the state manager (it turns
  `getStaticData()` + `getLatestStateSnapshot()` into the same topology, including for a working copy the app has
  never applied — H5), the player id via `sphereState`, and which substrate a region has via
  `procgenPlayer.getRegionInfo`. This is still what the **runtime** runs — the Loops panel's Generate Costs and
  the auto-generate on entering loop mode — and since the unification **it stamps the SAME block the pipeline
  embeds** for the same world.
- `frontend/modules/loops/costDataManager.js` — not a generator at all: the runtime **store** (load/validate/serve)
  the engine writes into and the loop simulation reads from. Its `isLoaded()` being non-null is also the loop-mode
  switch (block present ⇒ loop mode on).

⛓ **The proof that it is one model is a gate, not a claim.** `scripts/procgen/check-loop-costs-one-model.mjs`
runs `generateLoopCosts` and the runtime planner over five real documents and asserts the blocks are byte-equal
modulo `generatedAt`/`generatedFrom`. ⚠ It is a *differential*: it stays green if both sides are wrong the same
way. The numbers are pinned by `loopCostGenerator.test.js`.

### Write by class — which regions the block may speak for at all

The simulation prices **every** region as if it were coarse (⚖ the user: *"treat every region as if it's a coarse
region, when running the simulation, but store the costs according to what we already decided"*). What reaches
the block then depends on the region's substrate, read from its own registry entry:

| class | who | what the block says |
|---|---|---|
| **coarse** | no substrate · text adventure · **maze** | `{moveCost, xpEffect}` + its locations' costs |
| **summary** | runner, bounce (`loopSupport.summaryRecording`) | `{timeDrainPerSecond, xpEffect}` only, plus anything the INPUT block already stated explicitly — a per-action cost would be charged *on top of* the time drain (M5) |
| **native** | jta, omsi | **nothing at all.** Their resource-channel router charges the pool with no region attached, so no block value is ever read |

⚠ **maze is COARSE even though it declares shared mana**, and this is the trap the rule exists to avoid. maze has
both a recorder (`takeLastRecording`) and `sharing.mana` — the same two properties as jta and omsi — so
"a recorder that is a mana declarer ⇒ no entries" sweeps it in and deletes the very `moveCost` that
`mazeRoomUI._perTileMoveCost` divides by `longestShortestPath`. The discriminator is
`sharing.mana.loopActionDelegation`: maze hands the loop action *back* to the host's cost model. ⚠ And
**text_adventure declares `sharing.mana` too** (so `resourceChannels.isManaDeclarer('text_adventure')` is true)
while reading the block for all three coarse actions — the *recorder* test is what excludes it. See
`classifyRegion`, which states both cases where it decides them.

⛓ The start region is `{moveCost: 0}` whatever its class (unless it is summary). That zero is a rule, not a
price: the HOST's queue reads it for the first move out of the start region.

⚖ Two engines were retired on the way here. `frontend/modules/loops/costGenerator.js` (the "live" generator,
which played the sphere log through the running loop engine) was **deleted 2026-09-06** — it had no caller. The
pure generator's own algorithm (a maxMana/2 split across a BFS path) was deleted with the unification; over the
same document it and the planner had agreed only on the start region and the first priced region. Full history:
the queue doc §5o.

## procgenPlayer has no panel

The module that recognizes a procgen `rules.json` and routes every region transition at play time — `frontend/modules/procgenPlayer/` — never appears in the layout. It is a headless coordinator: it builds the region warehouse from `preset_sidecars` and publishes each substrate's `loadRegion` event. If play-time routing misbehaves, look here first, not in the substrate panels.

## Byte-identity is a load-bearing invariant

The stepped pipeline (panel steps and the `scripts/procgen/*-step.js` CLIs) must reproduce the monolithic drivers' output **byte-for-byte** at default batching. This holds because all randomness is one continuous seeded rng stream consumed in the monolithic order, with snapshots threaded across step boundaries (`frontend/modules/procgenPipeline/sphereSteps.js` — its header documents the threading rules). Adding, removing, or reordering rng draws anywhere in the engine or step-runners breaks the contract silently; `scripts/procgen/verify-*.mjs` and the step-runner tests are what catch it. Treat any new `rng()` call in generation code as a change that needs those verifiers re-run.

## Generation used to be non-deterministic under load — FIXED 2026-08-14, and the shape of the fix is the lesson

Byte-identity above is about the *pipeline*; this was about the *generator*, and it failed the other way. `procgenOracle.js:503` reclassified a solve that **SUCCEEDED** as `BUDGET_EXHAUSTED` when it took longer than `budget.wallClockMs` (5000) — so elapsed time, which is not a property of the candidate, decided whether that candidate was kept or reverted, and the run reached different candidates from there on.

**`wallClockMs` is now gone from `DEFAULT_BUDGET` entirely** (⚖ user priority: *"make procgen deterministic, by making it tick based, not wall clock based"*). `assertBudget` refuses a budget that still carries the field rather than ignoring it. Every remaining bound — `maxTicksPerTarget`, and `planDash`'s internal expansion cap — is a property of the candidate, so a level captured on a busy box is the level a quiet box produces.

Three things worth carrying to the next budget question, because each one was assumed and then measured the other way:

- **The worst form of the bug was not "different candidates".** At load ~100 on 8 cores, `--seeds=9` failed 5 runs of 5: the SKELETON solve — the empty bordered room, solvable by construction, the loop's own **control arm** — took 5,810–8,334 ms, was reclassified, and `levelGenerator`'s skeleton guard then reported *"a defect in the room builder"* for a room that was fine. It threw `LevelGeneratorError`, not `GenerationAborted`, so it escaped the exporter's abort handling and crashed the process. **A control arm that can be failed by the machine will eventually accuse your code of the machine's problem.**
- **Nothing replaced the number, and that was a measurement, not laziness.** 326 solves over 40 seeds, quiet box: max *total* ticks was **800**, while the tick analogue of the old provenance (40× the empty room's 134 ticks, the same 40× reasoning `wallClockMs` used) is ~5,360 — a bound 6.7× above anything ever observed. `maxTicksPerTarget` already binds where the clock used to: it classified 4 of the sweep's 5 `BUDGET_EXHAUSTED` verdicts.
- **The obvious replacement bound was refused twice.** Threading `planDash`'s `maxExpansions: 40000` up into the budget looks like the natural fix. The search ran at all in **2 of 326 solves** and hit the cap in **1**, so as a bound it is decoration; and when it does fire it appears as *one rung's sub-reason* inside a ladder refusal whose other rungs refused about the level, so classifying on it would turn a true `REFUSED` into a false `BUDGET_EXHAUSTED`. ⇒ **before promoting an internal cap to a budget field, check both how often it binds and what a caller would conclude when it does.**

⛔ **And one gate you might reach for does not discriminate.** The standing
`solve-seedling-r8-battery.mjs --check` md5 `1fedb0ab35b7cd74accecf0345bdc893`
did **not** move across this fix — and re-running it with the defect
deliberately reinstated produces the *same* md5. The branch is dormant at
quiet-box speeds (0 firings in 326 solves), so the battery cannot tell the two
builds apart. ⇒ **a fixture is only a gate for a change if it can distinguish
the two builds; run the baseline against a mutant before reading a stationary
digest as either a pass or a finding.**

⚠ **Two things this did NOT fix.** Any *test* that measures elapsed time still inherits the box (a full vitest suite has gone red with 3 failures at load 22.8 that were 515/515 solo) — so still **check `cat /proc/loadavg` before believing a red**, and prefer structural claims over timing-sensitive ones. And the expansion cap is still far too loose: one cap hit cost **12,267 ms** in a single dash. That is a *slowness* finding with its own measurement owed, not a determinism one. Background and the full measurement set: [`CC/docs/plans/procgen-deterministic-budget.md`](../../../../CC/docs/plans/procgen-deterministic-budget.md).

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

**The same closed loop exists on the loops side, reached without any bridge bug at all.** If loops' own mana-out wake stops the queue (`_handleManualWake_mana` with `autoRestartQueue` off — the default), the park is gone, so `livePlayRegion()` and `botSolverRegion()` both answer null, so the step gate closes on the fork, so the fork can never end a run and never fires the `substrate:resourceReset` whose release-and-resume is unconditional. A present player presses Start; an unattended walk polls a frozen world to its timeout. Any automated multi-run walk must therefore set `autoRestartQueue` ON — full account in [loop-recording.md](./loop-recording.md#and-with-the-flag-off-that-stop-is-terminal-for-an-unattended-walk).

⚖ **On omsi there is now a THIRD way into that shape, and it is the DESIGN, not a defect** (user ruling, 2026-09-06). During live play the host clock also honours the game's own start/pause control, so a player who presses **Pause** and walks away freezes the fork exactly as a closed step gate would: no drains, no run end, no `substrate:resourceReset`. Pressing **Play** is the whole remedy, and it is what the ruling asks for — *"I want our code to respect the state of the in-game start and pause controls."* Tell the two apart with `getDebugState().clockStats`: `skippedGated` is the park, `skippedStopped` is the player. Replay and Bot windows are exempt from the stopped rule for precisely the "nobody is at the keyboard" reason above — see [omsi.md](./omsi.md#live-play-also-honours-the-games-own-startpause--2026-09-06).

The circuit breaker that shipped first stays as a **tripwire**: it detects the impossible state (latched **with** energy above zero — unreachable through the game's own logic, since the latch is set at exactly 0 and `doAnyReset` both refills and clears) and completes the reset through the normal reported path after it persists ~1s. Under the two rules above nothing can reach that state, so its predicate is now unreachable and its silence is the oracle for the fix — a firing means something external is writing energy while latched again. `jta-latched-run-end-not-masked-by-pin` is the deterministic leg: it builds the divergence directly (latched at 0 with mana still in the pool) and folds `setEnergy` mutations instead of polling, because the reset erases the state within a beat.

## Two reset flows, and they disagreed

The entry above is about a bridge lying to the host. This one is about loops lying to itself. **Loop mode has two reset paths, and for a whole arc only one of them was reasoned about.**

- `gameState.triggerLoopReset()` → **`gameState:loopReset`** is the SUBSTRATE-DRIVEN reset. Its only production caller is resourceChannels' `fireLoopResetTeleport`, which fires the reset and then teleports the player to the resolved loop start.
- `loopState._resetLoop()` → **`loopState:loopReset`** is the loops-INTERNAL one (the mana-out wake, the generic executor's own depletion path).

The whole M1–M6 block-modes arc was designed and tested against the internal flow. The substrate seam had only ever needed `_resetActionsProgress()` (snap the cursor to 0), so that is all it ran — and it was enough right up until a substrate whose native economy *is* the reset (`requiresLoopMode`: jta, omsi) drove a Playback block across a run boundary. Then the seam real play actually takes carried **four pieces of stale park state and a dead frame loop** through a reset that had just teleported the player somewhere else: the park flags, `isProcessing` (both Manual/Record/Playback park entries call `stopProcessing()`, so the frame loop is *dead*, not the dormant-but-processing state a Bot park leaves), `_boundReplayCheckedIndex` (stale — a retry re-entering the block falls through to the generic executor and **silently crosses an exit it never replayed**, which is worse than the hang it usually produced) and `_queuePausedUntilReset`. `loopState._releaseParkForReset()` now clears all four and resumes; full account in [loop-recording.md](./loop-recording.md#the-bot-flow-m6).

Two things worth carrying beyond this bug:

- **A reset whose teleport target is the region the player is already in fires no `regionChanged` at all.** `gameState.setCurrentRegion` publishes only on an actual CHANGE. So a fix hung on the region-change wake covers every case except the one where the block sits on the start region — which is exactly the case a queue that re-drives from index 0 keeps producing. That is why the release lives on the reset subscriber.
- **When a subsystem can be reset both by itself and by an external authority, diff the two paths field by field before adding behaviour to either.** Grep the callers of each publish: the flow with a single production caller is usually the one real play takes, and the one your unit tests are least likely to be driving.

## `shared/` is a git submodule

`frontend/modules/shared/` (home of the substrate registry, rng, procgen primitives) and `frontend/modules/textAdventureEngine/` are git submodules with their own history and remotes. `git log`/`git blame` from the outer repo won't see their commits — run git *inside* the submodule directory. Edits to files under these paths land in the submodule, not the outer repo; landing a change means committing inside the submodule, then bumping the submodule pointer in a separate outer-repo commit.

## Generating a procgen world in-page can time out every iframe

`arrangeShuffledSpiral` + `buildRulesJson` are convenient for building a synthetic loop-mode world inside an in-app test, but they run **synchronously on the main thread**, and the per-substrate level generators are not cheap. A 6-region *runner* spiral measured ~2 minutes of blocked main thread — long enough that the iframeAdapter declared every substrate bridge dead ("heartbeat timeout, disconnecting"), so the test that needed one of those bridges failed for a reason with no visible connection to its subject, and the whole Playwright suite blew its 5-minute budget.

Cheap substrates (text adventure) are fine — `taswBlockModeTests` does exactly this. For an expensive one, load a **committed preset** instead and synthesize only the small piece you need (`runnerBlockModeTests` loads `runner_worldgen` and generates just the `loop_costs` sidecar with the pure generator, which is a fast pure function — and doubles as an end-to-end check of that generator).

## A component flood cannot see a ONE-WAY mechanic, and it lies optimistically

`componentsOf` / flood-fill is `for each neighbour: if walkable, enqueue` —
a symmetric relation by construction. Every directed mechanic in a game is
invisible to it, and the error is always PERMISSIVE: the graph promises a
route the walk cannot take.

The Seedling bot's R4 rung hit two in one session, and both only when the
route was built rather than when the graph was floodable:

- **A waterfall you cannot climb.** `v.y += 0.8` unless you hold the
  feather, against a water move speed below 0.8. The flood called level 0
  one component; the game makes its north half reachable downward only —
  and the feather was on the far side.
- **A lock you can only walk through one way.** The button that opens it is
  south of it and there is none beyond, so a six-level cluster is enterable
  and not leavable. The flood called it connected.

**How to handle one:**

1. Before believing a reachability answer, list the mechanics that move or
   resist the player and ask which are DIRECTED.
2. Model it as a refusal on the **STEP**, never on the **CELL**. Refusing
   the cell is the tempting fix and it is wrong: a waterfall is something a
   route crosses downward all the time, and forbidding the tile took a
   53-node map to 12. See `botDriverV2.climbsArmedWaterfall`.
3. The cheap instrument is a **directed flood** — the same BFS with the edge
   predicate added — run against the undirected one as a control. 670 cells
   versus 782 is a two-line diff and an unmissable answer.
4. ⚠ Two one-way branches can be MUTUALLY EXCLUSIVE. If each ends in a
   terminal set, one walk can take only one of them, and that is a claim
   shrinkage rather than a routing difficulty. Sweep every opener the map
   offers before reporting it — one at a time AND all at once.

## "The `empty` pairs are UNCHANGED" is a gate only for a change that spends no draw

The Seedling seed→level pair dumps (`scripts/procgen/dump-seedling-kind-pairs.mjs`) are the cheap "nothing else moved" belt, and the `empty`-kind arm is the one most often quoted. It answers exactly one question: *did this change move a draw?* It cannot answer *is this change correct*, and it is **guaranteed to move** — correctly — by anything that changes the ROSTER or the DRAW ORDER, because `rng.pick(palette.templates)` then lands somewhere else on every kind including `empty`.

Arc 3 hit this three times in a row. Removing `arrow-lane` shrank the roster, so the gate as briefed ("`empty` pairs unchanged at the site default") was untestable as written; the claim it was reaching for — *the SITE change alone is byte-inert* — needed an **isolated differential**: the same tree, the three rows put back to `site:'any'`, everything else identical. Same shape for the goal draw and for the door-template retirement.

**How to handle one:** decide first whether your change spends a draw. If it does not, the dump is a real gate. If it does, the dump must move, and the byte-inert claim you actually want is carried by a **control run in the same tree** (a `git worktree` at the base commit, submodules initialised) or by a **counting spy** on the stream (`model.roomDraws`) rather than by a tile comparison. See the procgen ELEMENTS arcs in [Seedling Real-Game Bot](./seedling-bot.md) § *The procgen ELEMENTS design*.

## A SCHEMA DEFAULT is a spelling rule, not a construction rule

`CHAMBERS_PARAM.default` looks like the place to change what a carved room is. It is not: `carveSkeleton` appends the chamber post-processor only when the value is **off** its default, so moving the default there changes the URL SPELLING (which parameters get written out, which are implied) and produces a byte-identical maze. The mutant that moved it did not move the maze md5 at all.

The construction knob is the **binding's** resolved spec — `SEEDLING_PARAM_DEFAULTS`, resolved by `seedlingSkeletonSpec` before normalisation, which is why Seedling's five carved tree kinds could default to `chambers = 1` while the maze stayed byte-identical. ⚠ And a default that differs from the codec's forces a second rule on the reader: `winding` and `winding;chambers=0` normalise to the same object, so the URL reader must hand the string **as typed** to the resolver, and the writer must spell the parameter explicitly, or a typed `0` is unspellable in a link.

## A payload-SHAPE mover and a BEHAVIOUR mover are indistinguishable in an md5

An artifact hash that moves tells you *something* changed; it does not tell you *what kind* of thing. Arc 3 slice 4d added a `demand` to an element, and the acceptance batch md5 moved on five rows — three of them **pre-sword**, where no kill gate can exist. The cause was not behaviour: the new field reached `certification.geometry` and therefore the printed payload, so the rows changed shape without changing a single generated tile.

**How to handle one:** before believing an md5 move is a behaviour change, diff the ROWS against a `git worktree` at the base commit and read what actually differs. A false mover found this way is worth naming in the record — it is the difference between "the demand changed 5 levels" and "the demand changed 2 levels and added a field to 5 payloads".

## A Seedling paste ACCUMULATES bodies; it does not replace them

The maze's edit vocabulary has `clearEntity`, so a paste can make a cell look
exactly like the descriptor it was handed. Seedling's has `remove`, which takes
*the last entity in the cell* one at a time and refuses an empty cell — and
`writeOps` is handed a DESCRIPTOR, not a record, so it cannot know how many to
emit. A paste onto an empty cell therefore reproduces it exactly, and a paste
onto an occupied cell leaves both sets of bodies. The read → write → read fixed
point holds for the `tile` and `cliff` halves at every cell and for the whole
descriptor only where the cell is empty; the tests assert the accumulation
rather than avoiding the cells that show it.

## Editing a vanilla Seedling room re-orders its attributes in the saved OEL

A record parsed out of a shipped `.oel` carries the author's attribute order —
`to playerx playery show tag invert sign` on a teleporter, straight out of the
XML. Every op path canonicalises `attrs` to SORTED, and has since the free-edit
slice, because the edit list is compared byte for byte between a payload and a
page and two people who typed the same attributes in a different order must
produce one payload. So a saved room is VALUE-identical and BYTE-different from
the one it was opened from, in the attributes of any entity an op touched. Cell
descriptors are therefore compared with `editCore.canonicalJson` (keys sorted at
every depth) and never with a bare `JSON.stringify`.

## `recordToOel` is not byte-identical to Ogmo's own output, in three known ways

Measured over all 116 shipped rooms: 0 exact, 64 modulo a trailing newline. The
three classes are the newline this writer ends its document with and Ogmo does
not (all 116); the out-of-rectangle tile placements the extract discards and
counts in `tiles_outside_level` (51 rooms — Ogmo lets an author paint past the
level rectangle and the game's loader drops them); and one room, `treelarge.oel`,
whose raw `>` inside an attribute value this writer escapes as `&gt;`. The round
trip is asserted BY VALUE and the byte count is reported as a measurement — the
newline is not fixed because the writer's output is `source.xml` in committed
level-set artifacts.

## The `.oep` says what the editor OFFERS; the AS3 says what the game READS

`Shrum.oep` declares 144 entity types with typed values, defaults and ranges,
and the schema fixture is a transcription of it and of nothing else. Their
agreement is pinned against the DATA rather than against a second reading of
`Game.loadLevelXML`: every entity type in the 116 shipped rooms is declared, and
every attribute value those rooms carry satisfies its declared type and range
(3,574 values, zero refusals). Two things that look like laws and are not —
there is no tile column reserved as unused (all 45 build a type the JS model
transcribes), and Ogmo does not reliably write every declared value (183 of
2,461 instances lack one, each of them a value added to the project file after
that room was last saved).

## NOT-IN-THE-PALETTE and NOT-TRANSCRIBED are two different sets

The generator's palette places five entity types; `Shrum.oep` declares 144; and
`levelWorld.ENTITY_CLASSES` transcribes 137 of those. So a type can be outside
the palette and still perfectly buildable by the JS model — `bob` is — and only
seven declared types (`bobboss1..3`, `building3`, `lightbosstotem`, `fire`,
`player`) are outside the model. A gate that placed a non-palette type expecting
the two-oracle bound would assert that bound's ABSENCE under a name that said
presence. Ask `ENTITY_CLASSES`, never the palette.

## A page control filled by ONE arm is an empty control on the other

`watch.html`'s edit panel is shown for two SOURCE arms. Anything mounted from
inside one arm's function — the terrain `<select>` was — is empty when the other
arm shows the same DOM, and it fails as a driver timeout ("did not find some
options") rather than as a claim. Anything the shared panel needs belongs to the
shared mount.

## A canvas sized AFTER a view mounts leaves its overlay holding an empty picture

`editorView` paints its selection overlay once at mount and then only from its
own gestures. A host that sizes the TARGET canvas afterwards — which any page
does whose canvas ships at `width="1" height="1"` and is laid out by the page's
own painter — got an overlay at the old size, drawn from whatever the shapes
list held at mount, which is usually nothing. Measured on the set editor's
116-room strip: 2088×132 with 181,674 ink on the strip and 1×1 with 0 on the
overlay, unchanged by a click, until arming a tool happened to repaint it. ⛔ And
the gate that found it had asserted the two overlay canvases EXIST, which is
true of a picture nobody drew — **assert INK, not elements.** The cure is the
view's own `repaint()`, called by the host after it has sized the canvas; the
only door before it was `setTool`, which also clears the armed corner and fires
`onChange`.

## An `editorView` overlay repaint asks the adapter for the record's bounds

`mountEditorView` repaints its selection overlay at MOUNT, and the repaint reads
`adapter.bounds(session.record())`. So the mount is a CONSUMER of the page's
state, not a sibling of its controls: mounting it beside the other wiring, before
the arm has built a record, takes the whole arm down with a `TypeError` on
`null`. Mount where the state exists.

## A module-level `const` cannot read one declared below it

`watchViewer.js` is 10,000 lines and its constants are grouped by topic, which
makes it easy to declare a path constant beside its first reader. A second
module-level `const` that interpolates it then hits a temporal dead zone at LOAD
— not a hoist — and the page goes blank with one console line. `?.` does not
help; only ordering does.

## A `MutationObserver` callback is a microtask, and it is handed a LIST

Asserting that one status line was written BEFORE another needs the sequence,
not the end state. Two synchronous `textContent` writes in one task arrive as two
records in ONE callback invocation, so a callback that pushes once per invocation
records one of the two — and reading the element's own `textContent` from inside
it reads the LAST value for every record, because the element is live by then.
Push per RECORD and read `addedNodes[0]`: assigning `textContent` replaces the
node, so the added node carries exactly what was written at that moment.

## A class table's `as3: null` answers CONSTRUCTION, never REACH

`levelWorld.ENTITY_CLASSES` gives every one of the seven Seedling room-flag tags
`as3: null` — *"not an entity at all, a flag `loadlevel` reads with
`hasOwnProperty`"*. That is a true sentence about whether the model builds an
object, and it is not the answer to *"can the JS oracle see a change to this
flag"*. Measured by building the room with the flag and without it and comparing
the worlds, six of the seven leave the world byte-identical and `<control>` does
not: its `fallthrough` is what `Player.checkFallingInPit` reads, so a pit is a
transport primitive and the flag reaches the model. A readout derived from the
table would have reported all seven as ignored — a true sentence about the wrong
subject. Ask the MODEL, not the table.

## An op that addresses "the last entity in the cell" cannot always name what you mean

Seedling's `remove` and `attrs` both take the LAST body in the named cell. That
is fine for a brush, where the reader is pointing at what they can see, and it is
not fine for a FORM that names a specific body. Measured over the committed
116 rooms: of 155 level-property instances, 14 share their cell with another body
and **2 of those are not the last one**, so a room-flags form emitting a bare
`remove` there would delete somebody else's body and call it turning a flag off.
Refuse those by name rather than guessing — an op that could say WHICH body is a
vocabulary change, i.e. a decision, and not something a DOM slice may make.

## A fake `<select>` that is a `<div>` cannot see a panel losing its selection

A `<div>`'s `value` is an ordinary property and survives `innerHTML = ''`; a
browser's `<select>` loses it, and reports its FIRST option once options are
appended. A hand-built DOM that spells the selects as divs is therefore MORE
FORGIVING than the page, and a panel that clears and refills a `<select>` on
every render looks like one that preserves its selection. Measured: a control
that dropped its value across every render passed every node row for two slices
while the browser row worked around it by setting the value between the two
clicks of a gesture — and the moment the fake DOM modelled both halves, the fix
became visible and a THIRD row (one that had been green on the forgiveness) went
red without it. A fixture only gates a change it can distinguish.

## A `<details>` that is closed makes its controls invisible to a driver

`page.check` on a control inside a collapsed `<details>` fails as *"element is
not visible"* after the full timeout — a driver failure naming the WAIT rather
than the claim. Open the section explicitly, which is the reader's own gesture,
instead of relying on the markup carrying `open`.

## RETIRED — "publish only what you derive from the SESSION, never from the MOUNT"

This rule was recorded while the set editor's `onSetChange` had two faces: the
applied-op path called the page BEFORE the mount's own `render()`, and the
REPORT path did not call it at all. A page's snapshot was therefore written
while the mount's rows, note, identity line and report box were still the
previous press's — measured on a two-click link gesture, where `links` read 1
off the session's record while a `strip` field read `linkedFrom: [0,0,0,0]`.
Four readout fields were dropped rather than published stale, and their rows
read the DOM instead.

⛔ It was a rule about a broken SEAM, not about readouts, and generalising it
would have made every mount-derived readout permanently unwritable. The mount
has ONE ordering rule now — its own `render()` first, then `onSetChange({why})`,
on every path that changes what a page could publish — and the four fields are
back, each with one DOM read beside it so the claim is that the readout and the
box AGREE. The rule that survives is the one below it: a readout learns what its
own `render` writes, so something has to tell it when to run.

## A page's readout only learns what its `render` writes

Holding a level-set document changes the page's state and changes NO room, so
nothing calls `redraw` — and a readout whose `set` field is written only inside
`render` reports `null` to anything that looks before the next edit. A state
change with no canvas consequence still needs the readout redrawn; the rule is
"redraw the canvas when the room changed, redraw the readout when the STATE
changed", and they are not the same event.

## A record's provenance field carries an identity that a re-stamp MOVES

A `set-room` record's `path` is `<set_id>#<room>`. Downloading an edited set
re-stamps it (`stampLevelSetIdentity`), so the reloaded room's `path` names the
NEW id by construction. A round-trip row demanding byte equality including `path`
would be demanding that an edited set keep its old identity — the one thing the
stamp exists to prevent. Compare the CONTENT and assert that the provenance
moved, to the id that was actually written.

## A REMOUNTED panel keeps every listener the OLD mount registered

A page section that is rebuilt when a new document arrives — destroy the old
mount, build a new one — does NOT lose its listeners if they were registered on
the ARM's lifetime, because the arm was never retired. Measured: after a second
LOAD, one button fired on BOTH mounts; the dead one applied its op to the OLD
session and repainted the OLD `<select>` over the live one, so the page offered
a value from a document nobody was editing and the next op was refused BY NAME
against something the live record does not have — a true sentence about the
wrong subject, produced by a listener nobody detached. A mount that can be
replaced needs a lifetime of ITS OWN, retired by its `destroy` and again by the
arm's `onRetire`.

⛓ Cured on all three of this repo's replaceable mounts now — the set panel, the
shared edit panel and its entity palette — and the browser row that guards it
COUNTS rather than presses: every op-applying handler routes to the session its
OWN mount captured, so a doubled press lands one op on the live record and one
on a stale object nothing publishes. The arm lifetime's own listener counter is
the witness, and it must not move across a remount.

## An ARRIVAL endpoint accepts an access rule and gates NOTHING — FIXED (editor v3 E3b)

`regionAtlasCompiler` records the `to` endpoint of a `one_way` connection as
`{apExitName: null, arrivalOnly: true}` and builds no AP exit for it — and every
connection the Seedling derivation emits is `one_way`, because the game's one
transition primitive is a one-way jump. So a rule authored on an `in_*` exit id
was accepted by the op, written into the overlay, applied to the atlas, and then
reached nothing: the door stayed FREE while its author believed it was gated.

⛓ **`set-access-rule` now REFUSES on `setEditorCore.gateabilityOf`** — the SAME
reading `ruleTargetsOver` marks the offered targets with and `inertRulesOf`
names the authored ones with, so the op, the list and the report cannot
disagree. The general lesson survives the fix: when a page OFFERS a target an op
will accept, ask the atlas's own `vanilla_layout.connections` whether the
endpoint is a `from` (or the `to` of a two-way) rather than trusting the id, and
route both the offer and the refusal through ONE function.

⚠ `set-overlay` is still a door such a rule can arrive through — it writes the
whole room entry and asks no derivation — which is why `inertRulesOf` is not
retired with the defect.

## Re-validating a document that is being EDITED reads a correct session as broken

`validateLevelSet` refuses a document whose stamp and content have parted — and
that is TRUE of every mid-edit set by design, because the stamp happens once, at
download. A page that re-validated the set it already holds before attaching a
second document to it therefore refused a perfectly good session and silently
kept the old attachment. Validate a document when it ARRIVES; after that the op
list is the authority until the next stamp.

## A derivation failure is neither a refusal class nor a defect — FIXED (editor v3 E3b)

`seedlingSetAdapter.apply` catches its refusal classes and rethrows everything
else on purpose (*"a `TypeError` here is a defect"*), and `editorView.applyOp`
catches only `EditCoreError`. A plain `Error` from `deriveAtlas` — a set whose
atlas cannot be built, e.g. a collectible in a room no door reaches — was
neither, so it escaped both and took the arm down.

⛓ **`SeedlingSetDeriveRefusal` is the FOURTH class**, and the shape of the fix
is the transferable part: it is thrown by **`deriveAtlasOf`, not by `apply`**.
`deriveAtlasOf` is called from BOTH sides — inside an op, and outside one by
`roomRowsOf`/`reportOver` through the substrate's `isRefusal` — so wrapping at
the one derivation door is what makes both readers name the same class; wrapping
inside `apply` would have left the readout's reader still holding a bare
`Error`. ⚠ And the net must not widen while you are at it: only
`err.constructor === Error` is re-labelled, so a `TypeError` still escapes both
catches and is still a defect. A `TypeError` IS an `Error`, so `instanceof` here
would have relabelled every crash as a data condition.

## A location marked on a TRANSITION is deleted by `disconnect` — FIXED (editor v3 E3b)

`disconnect` DELETES the exit element, and if a `mark-location` named that same
entity the overlay was left pointing at a body the room no longer had — every
later derivation then refused by name (*"no entity for it in level N"*), which
is a refusal arriving one edit LATE, about a room the author had not touched.

⛓ **`disconnect` now refuses while any location's `entity` matches the exit**,
names it, and names `unmark-location` as the door out. Two things about the fix
generalise. **The comparison must happen BEFORE the deletion** — afterwards the
entity is gone and the check can never fire, which is the mutant the row is
built to catch. And **it must be exact on the COORDINATES, not just the element
type**: two `<teleporter>`s in one room are ordinary, so an element-only check
would freeze every door in a room holding one marked one.

## TWO `set_id`s can describe the same 116 rooms, and only one is the save stamp's

The vanilla Seedling rooms exist as two level sets: the committed
`fixtures/seedling-vanilla-set.json`, whose 116 rooms are `embed` paths into the
SWF's `[Embed]` table, and the `record`-sourced set
`levelSetExporter.vanillaRecordSet` derives from that manifest plus the map
extract. They hold the same rooms BY VALUE and they are different documents, so
they have different content hashes and therefore different ids —
`seedling-vanilla-<hash>` and `seedling-vanilla-record-<hash>`.

⚠ AND THE DERIVED ONE HAS ALREADY MOVED ONCE. It was
`seedling-vanilla-xml-02a70624` while a room's `source` carried OEL TEXT; rooms
became JSON records and it is `seedling-vanilla-record-1040ace1` now. Same 116
rooms, same join, a different document — which is exactly what a derived
document's id is for, and why the old one is written down here rather than
quietly forgotten.

⛔ THEY ARE NOT INTERCHANGEABLE. The EMBED id is the one the AS3 fork's
`VanillaSet.SET_ID` names, the one every save stamp keys on, and the one
`?source=edit&level=N`'s ATLAS base checks; re-stamping the committed fixture with
record rooms would move all three. The DERIVED id is the SET EDITOR's, and it carries
`provenance.derived_from` naming the embed one so a reader of either document —
or of a re-stamped descendant of one — can say which vanilla it is looking at.
The stamp BASE is what keeps them apart (`stampLevelSetIdentity` rebuilds
`<base>-<hash>` around the same base on every re-stamp), so a shared base would
leave the hash as the only difference, which is one careless truncation away from
a set claiming to be the one the save files name.

⚠ And the §6.1 AP-mapping companion reads `invalidated` for the derived set too. That
contract is per IDENTITY, not per content — a refused debug-teleport is the safe
failure — so the CLI prints one note saying the set reproduces the vanilla rooms
by value rather than widening the companion's vocabulary.

## A level set carries JSON records, and OEL exists only inside a chunk

A room's `source` is exactly one of `record`, `xml` or `embed`. **The exporter
writes `record`** — `{width, height, layers, entities}`, the shape
`parseOelLevel` returns and `recordToOel` accepts — and `planLevelSetChunks`
renders each one to `{xml}` on the way out, because the receiver ends at
`LevelSet.as:139`, which reads `room.source.xml as String`. So:

- a SET document with an `xml` room is either a legacy artifact or a step that
  did not happen; a CHUNK document with a `record` room is a delivery that will
  not load;
- the chunk byte bound is measured **after** the render. Sizing the record
  instead prices a document 3.12× smaller than the one delivered (528,752 B vs
  1,652,312 B over the vanilla 116) and plans it into 8 chunks instead of 9 —
  one of them a call the proven envelope was never measured for;
- the CLI's `--out-dir` writes both: `<id>.json` is the set (records, no text)
  and `<id>.chunks.json` is the delivery (text, no records).

⛔ **`xml` IS STILL ACCEPTED EVERYWHERE, AND A ROOM'S KIND IS THE AUTHOR'S.** No
edit converts one: a legacy `xml` room is retargeted as text and stays `xml`, a
`record` room is retargeted on `entities[].attrs`, and a mixed set edits each
room in its own kind. Converting on touch would rewrite a document nobody asked
to change and move the set's content hash for a reason no reader could name.

⚠ **AND DO NOT ROUTE LEGACY TEXT THROUGH `parseOelLevel`.** All 70 `xml` rooms
of `fixtures/seedling-level-set-delivery-conformance.json` fail it, every one
with `<level> has no <width>`: they are REDUCED OEL, carrying the
cross-reference-bearing elements and no geometry. The index door
(`indexOfRoom`) keeps the lenient regex reader on the text kinds for exactly
that reason, and the equality row over the vanilla 116 — three arms, one of them
the disk `.oel` files — is what makes the two readers one index.

## A gunzip keyed on a NAME or a HEADER double-decodes a file that was never gzipped

GitHub Pages serves this repo's presets `content-encoding: gzip` — measured:
`presets/seedling_playthrough/AP_1/AP_1_rules.json` is 806,703 B on disk and
**43,140 B** on the wire. The browser has ALREADY decoded that before any of our
code sees it, so `response.headers.get('content-encoding') === 'gzip'` is TRUE of
a response whose body is plain JSON. A gunzip keyed on that header — or on a
`.gz` in the name, for a server that decoded transparently — throws on bytes that
are perfectly fine.

⇒ `gunzipIfNeeded` sniffs the **`1f 8b` magic** and nothing else. Bytes that
start `{` pass through untouched, which is why running it twice is a no-op and
why the `-arm` row loads the plain `.json` through the same seam as a control.

⚠ The same measurement is the reason **no committed preset is gzipped**. The wire
already saves 95% of it; a committed `.gz` would buy roughly nothing, and it
would break the sphere-log sidecar derivation, which keys on `_rules.json`
(`deriveSphereLogPath` strips a trailing `.gz` before the suffix test — without
that strip, `AP_1_rules.json.gz` derives
`AP_1_rules.json.gz_sphere_log.jsonl` from the error branch, logging about a
missing extension rather than about the sidecar).

## `json.dumps(indent=0)` is not minified, and the Python mirror took two lines to become byte-identical to the JS writer

Two separate facts, both measured, both about `exporter.py`'s
`_dump_with_compact_sidecar_tiles` and its JS twin `stringifyRulesJson`:

1. **`indent=0` differs by language.** `JSON.stringify(obj, null, 0)` is minified;
   `json.dumps(obj, indent=0)` still emits a newline before every element and a
   space after every colon. The exporter maps 0 to `separators=(',', ':')` for
   exactly this reason — a `rules_json_indent: 0` that used `indent=0` literally
   would produce a file that is neither indented nor minified.

2. **⚖ The two writers used to disagree on sidecar tiles, and on non-ASCII —
   FIXED in `bc81a69e4` (EDITOR v3 W1).** The docstring had said since it was
   written that the Python helper "mirrors `stringifyRulesJson` … so files
   written here look the same as files downloaded from the procgen panel", and
   it did not. Two facts, two one-line fixes:
   the spliced tiles array was `json.dumps(tiles)` → `[0, 0, 0]` in Python
   against `[0,0,0]` in JS (measured on `jta_mixed_test/AP_1`: 3,189 B from
   Python vs 3,142 B from JS), now `json.dumps(tiles, separators=(',', ':'))`;
   and Python escaped non-ASCII to `\u00a7` where JS emits `§` (a 70-byte delta
   on `seedling_playthrough/AP_1`), now `ensure_ascii=False` on BOTH paths of
   `_json_dumps_at_indent` — safe because the one production caller opens its
   file with `encoding='utf-8'`. `test/test_rules_json_writer_agreement.py`
   pins the agreement: every JS-written committed preset re-dumps to the file's
   exact bytes.

   ⛔ **THE FIX MOVED NO COMMITTED PRESET, and the reason it was deferred for a
   day was FALSE.** It was deferred because "both would move committed bytes
   across the byte-pinned preset corpus". Nothing pins that corpus — see the
   entry below — and, measured at `956af2029`, the Python splice has never
   written a committed file at all.

3. **⛓ THE CORPUS CARRIES THREE FORMATTING LINEAGES, and the Python "mirror"
   wrote none of them.** Of the 259 committed `AP_*_rules.json`, 34 carry a
   `preset_sidecars[…].playable_payload`, and they split three ways (measured
   at `956af2029`):

   | lineage | signature | count | who wrote it |
   |---|---|---|---|
   | JS-spliced | `"tiles": [0,0,…]` | 16 | `stringifyRulesJson` — all of `procgen_topdown/AP_1..12`, `procgen_maze/AP_1..3`, `seedling_atlas_maze/AP_1` |
   | exploded | `"tiles": [\n  0,…]` | 7 | a plain `json.dump(indent=2)`, no splice — e.g. `jta_mixed_test/AP_1`, the five `omsi_*_test`, `seedling_atlas_sphere/AP_1` |
   | no tiles | `playable_payload` with no `tiles` array | 11 | e.g. every `jta_*_test`, `seedling_playthrough/AP_1`, `seedling_atlas/AP_1` |
   | **Python-spliced** | `"tiles": [0,0,…]` — *the same signature* | **0 → 3** | `exporter.py` after W1; the first three are APWorld hub H4a's four-player fixture (2026-09-05) |

   ⛓ The trailing newline is the WRITE SITE's, not the writer's: neither
   `stringifyRulesJson` nor `_dump_with_compact_sidecar_tiles` emits one, the
   node write sites append it (`scripts/utils/generate-procgen-rules.js`:
   `text + '\n'`) and the Python write site does not.

   ⛔ **AND THIS IS WHY THE "JS-SPLICED" ROW STOPPED IDENTIFYING A WRITER.**
   W1's fix is what gave the Python splice compact separators, so its output has
   the SAME signature as the JS lineage — the two are byte-identical apart from
   that one trailing character. `test_rules_json_writer_agreement.py` selected
   its fixtures by that signature and called them JS-written; the first
   Python-spliced preset ever committed reddened it on three files that
   correctly have no trailing newline. The writer is now identified by a
   MECHANISM instead: `Generate.py` writes an `AP_*.archipelago` beside its
   `rules.json` and the node writer cannot. Measured 2026-09-05 over all 210
   committed presets — of the **177** with such a sibling, **0** carry a
   trailing newline; 30 of the 210 carry one at all.

## "Byte-pinned" was a sentence three files repeated and no mechanism backed

`exporter.py`, `frontend/modules/presets/documentBundle.js` and
[architecture.md](./architecture.md) all said the committed presets were
byte-pinned by "29 byte-identity dumps, `test_schema_validation.py`, every
`--check`". EDITOR v3 W1 opened all three:

| the named pin | what it actually reads |
|---|---|
| the four `scripts/procgen/dump-*-byteidentity.mjs` | `frontend/presets/` **zero** times — they pin in-process generator determinism (AP id namespace bases) |
| `test/general/test_schema_validation.py` | 39 lines of `json.load` + `jsonschema.validate` — blind to formatting |
| "every `--check`" | no workflow runs a `--check` over presets at all |

The presets are committed **DATA**, regenerated only on demand by
`.github/workflows/generate-presets.yml` (`workflow_dispatch`, onto a
`generated-presets` branch). What IS pinned is that the two writers agree
(`test/test_rules_json_writer_agreement.py`) — and that pin did not exist
until the sentence was checked.

⇒ **A claim that a corpus is pinned NAMES the pin — open it and check what it
READS.** A sentence copied into three files is one claim, not three witnesses.

## A container that carried everything derivable from its own contents would describe itself

A `.zip` bundle's members are the four DOCUMENTS (`rules`, `level-set`,
`overlay`, `region-atlas`) and nothing else. Two things that look like they
belong and do not:

- **`.chunks.json` is DELIVERY** — how a set too large for one response is
  shipped. `readBundle` refuses one BY NAME rather than ignoring it, because a
  half-delivered set silently ignored looks exactly like a whole one.
- **`.ap-invalidation.json` is a DERIVED table** — `apMappingInvalidation`
  rebuilds it from the set, and its own `reason` field says so. It travels as a
  named EXTRA (reported in `notes`), never as a member; `classifyDocument`
  returns null for it, which is the honest answer.

Two members of one kind refuse by name too: a container with two level sets has
no answer to "which set is this", and taking the first would be an answer the
reader invented.

## A region library's exit knows its SIDE, and the atlas does not take its word for it

A maze region-library entry's payload carries, per exit, both a tile
(`{x, y}`) and a `side` (`N`/`E`/`S`/`W`) — and a derivation that copied the
`side` across would be trusting metadata over geometry. `atlasOps.addExit`
DERIVES the side from the tile against the region's bounds (`deriveEdgeSide`;
N = minimum y), so `mazeAtlasDerivation` passes the tile and then compares: a
payload whose `side` disagrees with where its tile actually sits refuses BY
NAME, quoting both. The two can disagree for a real reason — a payload edited
by hand, or an entry captured before a resize — and the failure it prevents is
silent: the projected world would put the door on the wrong wall, and every
later stitch would agree with it.

⛔ **AND `kind` IS NOT FREE TEXT.** `region-atlas.schema.json` declares an
exit's `kind` as the closed enum `edge | teleporter`. A derivation that emitted
a third value (`crossing`, say — the word the maze's own vocabulary uses for a
walkable tile between rooms) would produce an atlas that fails the STRUCTURAL
pass, and the set editor's REPORT would refuse every export with a schema error
about a field the author never typed. The maze's crossings are `edge` exits;
the word "crossing" belongs to the projection, not to the format.

⛔⛔ **THERE ARE TWO MAZE SERIALIZERS AND THEY ARE DELIBERATELY DIFFERENT.**
`procgenMaze.js`'s own docblock says so by name, and picking the wrong one
produces no error at all:

| pair | what it is for | AP vocabulary |
|---|---|---|
| `serializeMazeLevel` / `deserializeMazeLevel` (`mazeRoom/procgenMaze.js`) | the LAB's loop-determinism channel — what the CLI prints, what `#labDownload` writes and `loadPayload` reads | **none** |
| `serializeMazeWorld` / `deserializeMazeWorld` (`procgenPipeline/procgenPipelineEngine.js`, `mazeRoom/mazeRoomEngine.js`) | the region-LIBRARY payload — AP-canonical exit and location names baked in | yes |

A maze room session closing into a region library goes through the CAPTURE pair
and never through the lab's, and `mazeSetAdapter.closeRoomSession` is where that
choice lives so no page can make it. ⛓ MEASURED over all four entries of the
committed `demo-maze-pack`: five keys part company — `exits` (the lab writes
`{exit_id, x, y}`; the capture path adds `side, exitName, targetRegion,
targetExitId, isBackExit, isTeleporter`), `items`, `itemLib`, `obstacleLib` and
`longestShortestPath` — and **the lab payload survives `deserializeMazeWorld`
without a word**. Nothing refuses it; it simply writes a different document. The
symptom arrives later and quietly: closing an UNEDITED room through the lab
spelling MINTS an edit (so merely looking at a room restamps the library), and
every exit's `side` comes back `null` where the entry said `'N'`. Same shape,
same keys, one fact gone.

## A room session opened from a SET lives inside the SET arm's lifetime

The maze lab page's fourth `?source=` arm edits a REGION LIBRARY, and one of
its rooms opens onto the SAME `#canvas` the `edit` arm uses. It is tempting to
reach that by switching `#source` to `edit` — the arm is already built, the
canvas is already there. ⛔ **It would take the LIBRARY session with it.**
`mazeLabView.mount` starts ONE lifetime per arm and RETIRES the previous one, so
a selector press destroys the set editor, its op list and the document a person
was editing; what they would get back is the ladder's own level under a strip
that no longer exists. The room session is therefore a `mazeEditAdapter` session
mounted UNDER the set arm's lifetime, and the set arm's own `render` is what
draws it.

⛓ Two consequences follow from that and both are load-bearing:

- **Which world is on the canvas has ONE answer** (`canvasWorld()`). `draw`
  paints it and `cellAt` addresses cells in it, so a build that drew the library
  room and addressed the ladder's level cannot exist — the two rooms are
  different sizes, and the mistake would look like an off-by-one rather than
  like the wrong document.
- **The lab's three sibling overlays do not draw over a library room.** The area
  graph, the element gadget and the solve plan are all facts about the LADDER's
  model. Painted over somebody else's room they would be an overlay of the wrong
  subject in a picture that looks right.

⚠ And the room gets its OWN palette, built from the entry's own `itemLib` /
`obstacleLib`. The `edit` arm's palette is bound to the lab level's editor and
its UNDO hits the lab session; offering it here would let a press place a body
the library entry cannot hold, and undo the wrong document.

## A panel that is still `hidden` has NO LAYOUT, so anything that measures its parent measures zero

`setEditorView.mountSetEditor` paints the rooms strip during mount, and
`overviewLayout` sizes it from `overview.parentNode.clientWidth`. Mount the
panel while it is still `hidden` and that width is **0**: the layout falls
through to `OVERVIEW.minCellPx` — the SCROLL floor, 18 px — and the strip comes
up as a thumbnail with real ink in it.

⛔ **Every readout says it worked.** MEASURED on the maze lab's SET arm: the
strip came up **72×132 with 6,282 ink** over four rooms; the rows were right,
the stills had drawn, `mounted` was `true` and the identity line was correct.
Unhiding the panel first gives **384×132 with 33,504 ink**, four cells at
`OVERVIEW.cellPx`. ⇒ the page renders (which unhides the panel) BEFORE it
mounts anything that measures a parent.

⛓ **A row asserting INK is green over both builds.** §23.11 #5's law — *assert
ink, not elements* — is necessary and not sufficient: the browser row asserts
the strip's WIDTH against `OVERVIEW.cellPx` too, and that is the only condition
that could tell the two apart.

## One gate can be TWO standing rows, and `--only=` is a substring

`check-seedling-editor-generate.mjs` reads **224/0** with `--host=` and
**230/0** without it. Neither number is wrong: claim 4 (`?gen=`) is guarded on
`!host`, because with a caller-supplied server the gate has no route to serve
the payload at, so six rows print a NOTE instead of running. **224 + 6 = 230**,
and the standing row's command carries `--host=http://localhost:8000` — so the
standing row is the 224 arm. ⚖ Both arms were run at one head, minutes apart,
and the `--host=` arm on a PRIVATE port still gave 224: the flag is the
variable, not which tree :8000 serves.

⇒ **the second arm is DECLARED by the gate, not re-typed by whoever needs it.**
A docblock line

    * @standing-variant <label>: <argv | (none)>

is read by `gateRoster` the way `readsFlag` reads a flag, and `standingRows`
derives `gate: seedling-editor-generate (own server)` right after the base row.
⛔ The anchor is load-bearing — a declaration is a line that STARTS with the
tag, because the declaring docblock also spells the syntax out for a reader. ⛔
A malformed line, and an arm whose command EQUALS the base row's, are both
REFUSED BY NAME: a declaration nobody parsed is a standing row that silently
does not exist, and a second name for one measurement is a fixed point with an
extra key.

⚠ **And `--only=` is a substring.** `standing-values.mjs --write
--only=seedling-editor-generate` selected one row until the arm existed; it now
selects BOTH, the second being a ~2-minute browser row. Name a row with
`--key=` — exact, and a `--key=` matching nothing FAILS with the nearest keys
rather than measuring zero rows and exiting 0.

## Related documentation

- [Architecture](./architecture.md)
- [Substrate Registry Reference](./substrate-registry.md)

## `createEmptyAtlas`'s `game` defaulted to `'seedling'`, and so did `atlas_id` — RETIRED (editor v3 E3b)

`createEmptyAtlas({...})` defaulted `game` to `'seedling'`, and `atlas_id` is
built from `game`, so a caller that did not name a substrate got a document that
VALIDATES and names the wrong game. Harmless while Seedling was the only
derivation; a landmine the moment there were two — the maze derivation had to
work around it by deriving `game` from its entries' own `substrate`.

⛓ `game` is REQUIRED now, and the default was not replaced by a better default:
there is no substrate that module can guess, so it refuses by name. `new
AtlasSession()` with no document refuses too, because a default there would be
the same landmine one layer up.

⚠ **The interesting part is how a caller was FOUND.** Making it required is only
safe if every call site passes one, and a missed site is a CRASH IN A PAGE that
no node row can see. The sweep is a source scan — and it found
`regionMarkingToolUI.js`, the region-marking tool's own panel, constructing an
atlas with no `game` in its CONSTRUCTOR. Two `grep` sweeps had reported that
file clean: see the next entry.

## `grep` skips a whole SOURCE FILE, silently, when it carries a NUL byte

`regionMarkingToolUI.js` is tracked, not ignored, valid UTF-8 — and carries **3
stray NUL bytes**. `grep` therefore classifies it as BINARY, and `grep -I`
(which this repo's tooling passes) then skips the WHOLE FILE: **zero hits, exit
1, no warning**. A census that shells out to `grep` reports such a file clean
and cannot tell that apart from the file having nothing to report.

Measured 2026-08-26, five tracked `.js`/`.mjs` sources are invisible this way:
`procgenPipeline/procgenPipelineUI.js`, `procgenPipeline/regionAtlasAnalyzer.js`,
`regionMarkingTool/regionMarkingToolUI.js`, `scripts/procgen/check-procgen-docs.mjs`,
`scripts/procgen/probe-seedling-killlock-span1.mjs`.

⇒ `grep -a` finds them. But a sweep whose ANSWER is load-bearing — "every caller
passes X", "no module imports Y" — should read files itself (`readFileSync`)
rather than trust a tool that can decline to look. `atlasSession.test.js` does
that, and pins that NUL-bearing sources still exist so the hazard is under test
rather than in a comment.

## A FREE edge is a LOGIC OBLIGATION, not a door — so authoring locations RAISES the count

`setEditorCore.freeEdgesOf(rules)` reads the COMPILED rules and counts every
edge whose `access_rule` is `True_` or absent — and it counts **locations as
well as exits**, because `atlases/README.md` calls a free AP exit *"a logic
obligation"* and an ungated collectible is one of those too.

⇒ authoring an overlay **raises** the number. Measured on the vanilla 116:

| state | free exits | free locations | total |
|---|---|---|---|
| vanilla, EMPTY overlay (before editor v3 E5) | 319 | 0 | **319** |
| vanilla, EMPTY overlay (after E5's `named_rooms` warps) | 334 | 0 | **334** |
| vanilla + the committed authored overlay | 332 | 38 | **370** |

The 41 lifted locations create 41 obligations, of which vanilla's own guards
discharge 3; the two liftable exit rules gate 2 of the 334 doors. The editor v3
plan (§27.6) predicted the count would DROP when the overlay landed, and it was
reading the number as *"doors nobody gated"*. It is not: **the overlay does not
make the world smaller, it makes what is unstated VISIBLE.** A row expecting a
fall would go red for the right reason and be read as a regression.

⚠ Related: **the fixture directory is `frontend/modules/seedlingDemo/fixtures/`.**
`frontend/fixtures/` does not exist, and a plan section named it.

## `level_58` is UNREACHABLE over the room data alone — FIXED (editor v3 E5)

Opening the vanilla 116 in the set editor refused the `rules.json` export, and
not for the free edges: region `level_58` (`Dungeon5_DeadBoss`) is
UNREACHABLE from the start under any rule set. Measured over all 116 rooms, **not
one entity in the game targets it** — three outgoing teleporters, zero incoming.
The committed `seedling-playthrough.json` has the same hole and nothing had ever
failed on it, because the region carries no locations.

⛓ What reaches it is the MANIFEST: `named_rooms.tentacle_beast_mouth`, which the
AS3 dereferences when the beast swallows the player. E5 gave `deriveAtlas` an
OPTIONAL `deps.namedRooms` and derives each arrival's SOURCE from the entry's
`trigger` element — the OEL element `levelSetValidator.NAMED_ROOMS` already cites
as the one thing that makes the entry mandatory. The graph closes and the export
is ALLOWED.

⛔ **THE PRODUCER STILL PASSES NOTHING, ON PURPOSE.** `make-seedling-playthrough-rules.mjs`
has exactly ONE `deriveAtlas` call site and it names no `namedRooms`, so the
committed atlas and its preset are byte-identical — pinned by comparing the
FILE's md5 across a real `--check`, because an exit code is not an identity.
⚠ And under the playthrough's own `NEVER_ENTER_LEVELS` = `[57, 69, 82]` the fix
would NOT have reached `level_58` anyway: its only source is L57, a trap room,
and a warp OUT of a never-enter room is noted rather than made — never-enter is
encoded in this derivation as an ABSENCE. Ten connections there, fifteen under
the empty overlay the editor opens vanilla with.

## A wait that a PRIOR press already satisfied reads the previous result — FIXED (editor v3 E6b)

`check-seedling-editor-arm.mjs` presses `#editDownloadBundle` and then waits for
`Array.isArray(window.__editorSetBundleKinds)`. The global is set by the press
and never cleared — so a SECOND press added earlier in the file leaves the wait
already true, and every later bundle row reads the FIRST container without
waiting for its own.

Measured when editor v3 E5 added one press mid-file: two downstream claims went
red with the wrong container's member list, a third died as *"the row itself
threw"*, and the run stopped 44 rows early. E5's cure was local — delete
`window.__editorSetBundleKinds` and `window.__editorSetBundleOut` behind any
press that is not the row consuming them — but the shape is general: **a wait on
a global a previous step can set is not a wait.** Prefer a wait on a value that
CHANGES (a counter, a new id) over one on a key that merely exists.

✅ **FIXED at the source in editor v3 E6b, and the gate-side cures are gone.**
`setEditorView.js`'s two download handlers call `pressScope` BEFORE their first
guard: the whole readout family goes `null` and `__editorSetBundlePresses` /
`__editorSetRulesPresses` advances. A driver reads the counter before its click
and waits for `n + 1`, which nothing but that press can satisfy — so a REFUSED
press is now a fact a row can wait for, and both gates have one (a bundle press
with a room open holding unwritten edits: counter advanced, readouts `null`,
`⛔ NOT BUNDLED`).

⚠ **AND THE FIX BROKE THREE WAITS THAT WERE ALREADY THE SAME MISTAKE**, which is
how you find them: `settled(() => window.__editorSetRulesBytes !== undefined)`
and two node loops spinning on `__editorSetBundleKinds === undefined` all became
true the instant the handler nulled the key. A wait that a `null` satisfies was
never waiting for the press.

⛔ **AND THE PROBE THAT READS THE RESULT MUST NOT USE `??`.** `null ?? 'ABSENT'`
is `'ABSENT'`, which collapses the cured build (`null` — scoped) and the mutant
(`undefined` — never written) into one answer. `=== undefined ? 'ABSENT' : v`.
Measured on the first run of the new rows.

## A uniqueness law asked of the AUTHORED name, justified by a fact about the DERIVED one — FIXED (editor v3 E6a)

`mark-location` and the shared overlay validator both refused a location name
that was not unique **across the whole SET**, asked of the AUTHORED half. The
reason both of them gave was about a `reorder`: *"two rooms that swap places
would then swap AP names, so uniqueness is asked of the AUTHORED name, which a
reorder never touches."* That sentence is TRUE and it is about the wrong
property. A reorder RE-PREFIXES every derived name, so the SET of derived names
stays unique either way — swapping is not colliding, and nothing in the law
followed from it.

What the law actually protects is the compiler: `regionAtlasCompiler` allocates
AP location ids from `loc.name` alone, and `regionAtlasValidator` refuses a
duplicate DERIVED name globally. So the question is **whether the substrate's
derivation prefixes the room into the name it emits**, and the two committed
substrates disagree: `seedlingAtlasDerivation` emits `Level NNN - <authored>`
(and `NNN` is the room's ARRAY POSITION, unique by construction), while
`mazeAtlasDerivation` emits the authored name VERBATIM.

⇒ `createSetOverlay` takes `locationNameScope ∈ {'room','set'}`, DEFAULT `'set'`
— the stricter answer, so a substrate that has not thought about it cannot lose
an item — and Seedling declares `'room'` beside the fact that earns it. ⛔ The
flat relaxation the design first called for was measured RED on
`mazeSetAdapter.test.js`'s own duplicate row: it would have moved the maze's
refusal from the click to `validateRegionAtlas`, a worse and much later place to
learn it.

⛓ The cost of the old law was real and had been REPORTED rather than gated: the
vanilla lift could not reproduce the playthrough's AP names for the sixteen
rooms holding a `Chest`, and wrote `Chest (L38)` instead. Since E6a the labels
lift verbatim, the fixture is `seedling-vanilla-overlay-e2d5c131` (8,863 B, was
`-1604b508` / 9,149 B), and a row DERIVES the committed fixture and compares its
location names to the playthrough atlas's as a SET: 41 names, 0 divergent.

**The general shape.** When a check's justification names a property of a
document the check does not read, ask which document the harm actually happens
in, and ask whether the answer is the same for every binding of the module the
check lives in. Here it was not, and the parameter is one line.

## An op that takes an ordinal nobody passes is an op nobody can reach — FIXED (editor v3 E6a)

E3b taught `remove` a `which` ordinal so a caller could name a body that is not
the last one in its cell, and `entityIndicesAt` / `requireEntityAt` are its two
spellings. Nothing passed one for a whole slice: the room-flags form still built
a bare `{op:'remove', tx, ty}` and REFUSED the 2 of the committed 155 flag
instances that are not last, quoting a sentence that promised *"an op that could
name WHICH body is a vocabulary change, i.e. a decision"* — the decision it was
asking for had already been taken.

⚠ **AND THE FIRST CALLER FOUND AN IDENTITY HAZARD THE BARE OP DID NOT HAVE.**
The form's guard read `host.record()`, its refusal check read it again, and the
gesture built its op from a third read. Two reads of one cell's `{tx, ty}` agree;
an ORDINAL read off one snapshot, checked against another and applied to a third
can name a DIFFERENT body. The cure is that the guard reads the record ONCE and
RETURNS the row its decision was about, and the caller builds the op out of that
row. **A more precise address needs a more careful snapshot.**

⛓ `attrs` keeps its refusal and it is not an oversight: addressing the last
entity in the cell is that op's whole contract, so a second address for it would
be a second vocabulary rather than the same one used properly. The docs and the
refusal both say which of the two the sentence is about now.

## A refusal that knows its CLASS and reports only its SENTENCE — FIXED (editor v3 E6a)

`seedlingSetAdapter.apply` has told its four refusal classes apart since E3b and
returns `reason: err.name`. `editCore`'s session dropped the field at ONE line,
so the only consumer that would branch on it — a page choosing between "you
typed something wrong" and "the world is not finished yet" — had nothing but
`description`, the one channel the core promises never to paraphrase. Zero
readers existed, which is exactly why it went unnoticed: a field nobody reads
looks the same whether it arrives or not.

⛓ `reason` is now carried by the session, by the group's member-refused arm (the
MEMBER's class — the group adds none of its own), and by the two catches that
SYNTHESISE a refusal, which set it to the thrown error's own `name`. ⛔ The core
NEVER invents one: an adapter that gives no `reason` produces a result with no
`reason` KEY, so `'reason' in res` means the substrate answered rather than that
the core guessed — and the rows drive both halves on one adapter, because a row
that only asserted the field arrived would pass a version that defaulted it.
## An ARGUMENT is evaluated OUTSIDE the callee's `try`

`setEditorView.js`'s ADD ROOM press was

```js
applySet(addRoomOp(at), { renumber: addRoomMapping(at), what: 'ADD ROOM' });
```

and `applySet` opens with a `try` that turns a thrown `Error` into a refusal in
`#editSetNote`. `addRoomOp(at)` is an ARGUMENT, so it runs BEFORE that `try`
does: a binding that refuses to MINT threw straight out of the click listener —
no note, no `say`, a console error, and the note left holding the previous
press's sentence.

⚠ **NOTHING COULD SEE IT UNTIL A SECOND SUBSTRATE ARRIVED.** Seedling's
`addRoomOp` is `emptyLevel()` and never refuses; editor v3 E6b gave the maze one
that calls `createWorld`, which refuses a dimension below 2 by name — and the
first node row over a 1-wide blank room came back with an uncaught stack rather
than a red assertion.

⛓ The cure is three lines and no substrate knowledge: build the op inside its own
`try`, wording the refusal exactly as `applySet`'s catch does — one spelling of
*"refused"* per page. ⛓ The general shape: **a guard covers the callee's body, not
its call site.** If the value a guarded call is handed can itself throw, the
guard is in the wrong place.

## An ALPHA count cannot see ink drawn over opaque ink

The set editor's overview strip paints each room as an opaque box and then draws
its caption and its `⛔embed` badge ON TOP. Both gates' ink probes count pixels
whose ALPHA is non-zero — so the badge contributes nothing to any of them.

Measured in editor v3 E3a with trap 722's own mutant (`typeof <undeclared> !==
'string'`, which badges EVERY room): `check-maze-lab` stayed **ALL CHECKS
PASSED** and `stripInk` read **33,504 in BOTH builds**. On
`check-seedling-editor-arm` the same probe reads the ARROW band above the rooms,
so it is `0` either way. ⇒ for two slices the badge had **no browser witness on
either substrate**, and the node rows were the only evidence there was.

✅ **FIXED in editor v3 E6b, with TWO independent readers** — a readout alone
would be a fixed point, and a probe alone cannot say what the painter decided:

- **`badges()`** — `paintStrip` records `sourceKind(cell) === 'embed'` per cell
  AS IT DRAWS, and the mount exposes a copy. ⛔ Never re-derived from the record:
  trap 722 was exactly those two answers coming apart, and a readout computed
  from the record would have agreed with the record while the strip disagreed
  with both. Published as `__mazeLab.set.strip.badges` and `__editorEdit.set.badges`.
- **`badgeInk`** — a per-column DIFFERENCE over the badge's own y-band
  (`[top+16, top+30)`, derived from `OVERVIEW.roomTop` and the painter's
  baselines) against a reference row near the bottom of the same box that no
  glyph reaches. Every non-glyph pixel, both vertical borders and the SELECTED
  cell's different fill cancel against their own column; what survives is glyph
  pixels. MEASURED on the `-arm`: 15,307 over the committed all-`embed` vanilla,
  **0** over the same 116 rooms built as `record`s, with `captionInk` 7,040 in
  BOTH as the positive control.

⚠ **A BAND PROBE IS ONLY VALID WHERE THE STRIP DRAWS NO STILLS.** 116 rooms get
18 px each — under `OVERVIEW.minStillPx` — so the box is FLAT under both bands.
`check-maze-lab`'s four rooms get 96 px and DO carry stills, so a difference
there would be counting the picture; that gate reads `strip.badges` instead, with
the array's LENGTH against the room count as its positive control (`[]` is what a
strip that painted nothing answers).
