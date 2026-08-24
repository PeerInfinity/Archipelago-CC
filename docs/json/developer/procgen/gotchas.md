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

## Related documentation

- [Architecture](./architecture.md)
- [Substrate Registry Reference](./substrate-registry.md)
