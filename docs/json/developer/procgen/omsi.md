# Omsi Substrate (Idle Loops)

The omsi substrate (`frontend/modules/omsiSubstrateWrapper/`, id `omsi`) runs the `PeerInfinity/omsi-loops` fork of Idle Loops, from the `frontend/modules/omsi-loops/` submodule, in a same-origin iframe as a loop-mode substrate. The host owns the game clock, and the game's per-loop mana budget is the shared mana pool.

Idle Loops is itself a loop game: the player writes a queue of actions, the game runs it until the loop's mana runs out, then restarts keeping skills and discoveries. So omsi declares `requiresLoopMode`, its native restart is the host's loop reset, and its recordings are plans, not action logs.

The iframe boots with `?managed=1`, which makes the fork call `IdleLoopsManaged.boot()`: a separate `idleLoops_substrate` save slot and no game clock of its own. The pinned fork commit is whatever `git submodule status frontend/modules/omsi-loops` reports. Multi-town travel and a panel queue editor are not built.

**The fork byte-gate.** Fork-side changes must reproduce the reference planner run exactly: `node CC/scripts/omsi-stats/run-planner.mjs --worktree` checks loops, ticks, final-state hash and RNG draws against `V0_REFERENCE` in that script. Always pass `--worktree`: without it the harness simulates `git archive HEAD` of the submodule, so uncommitted fork changes are not what gets tested.

## Region mapping: N regions, one town

omsi is a content source in the registry's sense (`zoneCount` + `extractZoneRules`), but its regions are not independent content the way jta's zones are. The engine cannot hold a second copy of a town (action names must be unique, the DOM is static, unlocks are keyed by `(town, varName)`), so each region is an overlay on one town.

- **Config.** `substrateConfig.omsi.regionSplit = { townIndex, count, exploreVar, exploreThreshold, exploreMaxLevel, regions }` makes the substrate emit `count` zones whose payloads all carry the same `omsiTown`, each with an `omsiRegion` gate descriptor. Without `regionSplit`, each zone is one town (`zoneCount` is the town count, default 1).
- **Per-region state lives on the host.** The fork's `dumpRegionState` / `loadRegionState` swap the town's value properties; the bridge keeps the snapshots in `_regionStore`, keyed by region id. Nothing is added to the fork's save, so per-region state lasts for the session only.
- **Exits are derived from the region graph.** `_installRegionExits` walks `world.exits` and injects one synthetic exit action per exit with the fork's `injectSyntheticAction`. An exit is a side and a target, never a tile (`regionGeometry: 'sides'`). The actions are registered after `initializeActions()`, so `getActionPrototype` resolves them but they never appear in `totalActionList`, the planner, or the DOM.
- **The exit gate is Explore %.** A synthetic exit's `canStart()` calls `regionExitAvailable()`: `min(1, town[exp<Var>] / cap) >= exploreThreshold`, where `cap` is the region's own ceiling (below) and `exploreThreshold` defaults to 1.0 (fully explored). Below the threshold the exit looks like any locked action.
- **Taking the exit** runs `finish()`, which publishes the visit recording and dispatches `user:regionMove` with the real graph exit name. An omsi crossing is a genuine player exit, which matters for the strict action gate.

### Per-region max Explore level

If each region had to be explored to the town's level 100, the game would be repeated N times. `exploreMaxLevel` compresses a region into its own ladder of N levels: its exp is capped at `expFromLevel(N)`. It resolves per zone as `regions[i].exploreMaxLevel` → `regionSplit.exploreMaxLevel` → `max(1, round(100 / count))`. `exploreThreshold` is a fraction of that ceiling.

The seam is `Town.getLevel`, but its consumers need two different views:

| View | Read by | Value |
|---|---|---|
| Effective, `getLevel` | unlock-row predicates, action `visible`/`unlocked` thresholds, the UI %, the exit gate | `min(100, floor(raw · 100 / N))`: schedules compress into N levels |
| Raw, `getRawLevel` (capped at N) | the `<totalDiscovered>` evaluator, the unlock table's quantity rows | the vanilla level: quantities are partitioned |

The discovery formulas are linear in level, so capping the raw level gives each region its share of the town's discoverables; the effective view there would give every region the whole town.

Details that matter when changing this code:

- `finishProgress` has three `505000` sites (overflow compare, assignment, and the `=== 505000` fast path that owns `pauseOnComplete`). All three must use the region cap, or the fast path and completion pause silently stop working in rescaled regions.
- `setActiveRegion` recomputes when the scale changes (value state is swapped first, under the outgoing ladder), and installing a lower maximum clamps stored exp.
- The planner's engine copy is not managed, so the scale travels with `buildWorldConfig` / `installWorldConfig`, or plans would be computed against vanilla thresholds.
- `getPrcToNext` interpolates within raw levels, so the progress bar moves in raw steps while the printed level jumps by `100/N`. This is cosmetic.

On the vanilla path `Town.regionScale` is null and none of this runs.

**Note:** split worlds emit no unlock locations today. Combining the two needs host-side work first: quantity row ids are global and deduplicated globally, while each region climbs its own ladder from zero, so one region's batches would consume ids another region needs. `Unlocks.applyManagedTotals` (`qManagedBatches` is global) would need the same treatment.

## Host-side clock and mana brokering

Managed mode has no tick loop, so the bridge runs one: a Worker metronome every `CLOCK_INTERVAL_MS` (Worker timers are not throttled in hidden tabs). Each callback advances the engine by elapsed wall time at `TICKS_PER_SECOND` (50) through `IdleLoopsManaged.step(ticks)`, capped at `MAX_TICKS_PER_CALLBACK`, then drains the view's render queue. One tick costs one mana. The clock runs only while an omsi region is active.

Stepping is withheld for four reasons, decided by `planClockStep` in `clockGate.js` and counted in `__omsiBridge.getDebugState().clockStats`:

| Reason | Counter | When |
|---|---|---|
| `noQueue` | `skippedNoQueue` | the plan has no enabled runnable entry (stepping would ping-pong resets with the host) |
| `gated` | `skippedGated` | the loops [step gate](#the-step-gate) is closed |
| `stopped` | `skippedStopped` | live play, and the game's own Start/Pause says stopped |
| `heldBoundary` | `skippedHeldBoundary` | the loop is at a [held boundary](#the-held-boundary-clock-gate) |

**Mana mirroring.** After each batch the bridge reads the remaining loop budget (`timeNeeded − timer`) and publishes the change as `substrate:resourceDelta { substrateId: 'omsi', resource: 'mana', amount }`: negative for drains, positive for in-loop gains such as Buy Mana. External pool changes are told apart from the bridge's own echoes by predicting the pool, and pushed into the game with `addMana` (signed, `timeNeeded += amount`). Sampling happens outside the step gate, so a direct `addMana` still reaches the pool.

**Starting budget.** The fork's native per-loop budget (`timeNeededInitial` in `saving.js`) is reported as `substrate:resourceBonus`, so it raises the shared starting pool. On entry and after each reset the budget is pinned to the pool.

**Note:** a pin resets the mirror's last sample. Only the external `manaChanged` call site uses `_syncBudgetFromPool({ flushMirror: true })`, which publishes the pending delta before pinning; the entry and reset pins must not flush, or they would mirror their own change back and count it twice.

**Reset propagation.** Game → host: every `restart()` fires the managed `onRestart` callback, and the bridge publishes `substrate:resourceReset { hostResetCount }`. Drains mirror one to one and the budget is pinned to the pool, so the game's natural restart coincides with the pool reaching 0, and the router's reset-count guard turns the pair into one loop reset. Host → game: `gameState:loopReset` runs `restartLoop()` while an omsi region is active; resets fired while inactive are caught up on the next `omsi:loadRegion`.

Two kinds of restart are not reported:

- **Bridge-applied restarts** (`_applyingHostReset`): catch-ups and the replay's forced recompile. The host is the only reset authority, and the bridge must never invent a run end.
- **No-progress restarts**: a loop that used almost no effective time means nothing could run. Reporting it would ping-pong resets over an unrunnable plan; instead the game idles until the player fixes the queue. This is also why pressing Play at boot costs no loop reset.

## The step gate and Start/Pause

### The step gate

The game advances only while the loops queue is parked for live play on the region this bridge has loaded, or while a replay or Bot walk is running. An unparked omsi region is frozen, so it cannot drain the shared pool while the queue is elsewhere.

Only the host can see the queue, so `index.js` computes the gate and pushes `{ enforced, livePlayRegion, botSolverRegion }` over `omsi:playbackControl`:

- The region is pushed, not a boolean: only the bridge knows which region it holds, so a region swap needs no push.
- It is a `STEP_GATE_POLL_MS` poll rather than event subscriptions, because the answer changes on many events (park, exit, pause, reset, block-mode change, queue edit, loop-mode toggle) and missing one would freeze or free-run the game. Only changes are pushed, plus a forced push on `iframe:appReady` and region entry.
- `livePlayRegion()` is null while a solver drives, so a Bot needs its own field, `botSolverRegion`; `_mayStepClock` opens on either.
- The gate withholds `m.step()` only. The mana mirror and victory watch keep observing, and elapsed time is re-baselined each callback so a closed gate cannot bank time and release it as a burst.

### Live play also honours the game's own Start/Pause

An open step gate is necessary but not sufficient. `_mayStepClock` reports which arm opened it (`unenforced`, `replay`, `bot` or `live`), and on the `live` arm the bridge also requires the fork's `gameIsStopped` to be false. `getDebugState()` exposes `stepGateArm`, `forkStopped` and `liveStopped`.

- **Play is the cold start.** The fork boots stopped and holding a loop boundary. The Play button calls `pauseGame()`, which calls `restart()` when it unpauses at a loop end, so one press clears both.
- **Warning:** `pauseGame()` is a toggle. Read `gameIsStopped` first (`if (gameIsStopped) pauseGame()`). `omsiSubstrateWrapper/test-helpers.js` exports `pressPlay()`, `pressPause()` and `isGameStopped()`. Never set the flag directly, or the button's restart never runs.
- **Exemptions.** A Playback replay (`_replayInFlight`) and a Bot walk (`_stepGateBotRegion`) ignore the stopped flag: the bridge and the fork's planner toggle it between them (`resumeIfPlannerPaused`, `plannerPauseWhilePlanning`), and nobody is there to press Play. The `unenforced` arm (loop mode off, or before the first gate push) is exempt too.
- **The two controls stay separate.** The game's Pause does not pause the loops queue, and a loops park does not press the game's Pause. The park decides which region may run; Play/Pause decides whether the player wants time to pass.
- **`pauseBeforeRestart`.** With this fork option on, the game holds the boundary instead of restarting, the clock refuses to step (`skippedHeldBoundary`), and the run end is reported on the next Play press. The host answers with a loop reset, which teleports the player to the queue's start region.

### The held-boundary clock gate

Managed `singleTick()` has no `gameIsStopped` check (that lives in the disabled `requestAnimationFrame` path). So while a loop end is being held (for example, the planner pausing at a boundary), every stepped tick would re-run `loopEnd()` and `prepareRestart()` and mint a phantom loop, inflating `totals`.

`isBoundaryHeld` in `clockGate.js` detects this: `shouldRestart` is set, or `timer >= timeNeeded`. A real crossing restarts within the crossing tick, so a boundary still present at the next callback means something is holding it. **Warning:** do not use `gameIsStopped` here. It is true throughout ordinary managed play, so it would freeze every arm; the stopped flag is the separate live-arm check above. The held boundary is also where the Bot makes its decisions.

## Record, Playback and per-region queues

omsi declares `manual`, `record`, `playback`, `instant`, `requiresLoopMode`, `queueActions: ['regionMove']` and `executeVia: 'solver'`. The block-mode contract is in [Loop Recording and Block Modes](./loop-recording.md). Every omsi preset carries `loop_costs`, so loop mode turns on automatically and the strict action gate applies: in-app tests park a Manual block before acting.

**Warning:** `takeLastRecording` must be present whenever `record` and `playback` are declared. Its presence is what makes `loopState._captureShapeFor()` classify omsi as fine-grained. Without it omsi would be treated as coarse, and loops would charge `loop_costs` on top of the bridge's native mana mirror.

### Per-region authored queues

The fork's authored plan (`actions.next`) is swapped per region too, in its own `_regionQueueStore` Map, separate from `_regionStore` (whose snapshots are applied as town properties). It is saved on exit, restored on entry, empty on a first visit, and cleared with the other per-world state on `rulesLoaded`.

- **The dump strips synthetic exits.** They are region-scoped, so a stored exit name would not resolve next visit, and an unresolvable name makes `translateClassNames` throw and take the loop down.
- **The restore filters on `totalActionList` membership** as a backstop.
- The restore happens before `_applyCatchUpResets`, so a catch-up restart compiles the incoming region's plan.

### Record — the recording is a plan, not a log

An omsi visit recording is the region's authored queue (`actions.next` minus synthetic exits) at a successful Record exit. A performed-action log would be the same queue repeated once per loop. The capture and the per-region dump are the same function, `_dumpRegionQueue()`.

The synthetic exit's `finish()` publishes the plan as `omsi:visitRecording` before the departing move, per the [stash-before-regionMove rule](./loop-recording.md#gotchas). It publishes on every departure: the host slot is pull-once and only a Record block pulls, so other departures just overwrite it.

`convertPlanToQueue` / `convertQueueToPlan` in the library convert in both directions: a native entry becomes a `clickTask` with `loops` = reps, carrying `loopsType` and `disabled`. The action name is the id, since omsi action names are stable engine identifiers.

### Playback — install the plan, let the fork run it

The fork's own queue is the executor. `_startReplay` clears the queue, adds each recorded entry (filtered by `totalActionList`), appends the recorded departure exit last (bypassing that filter), forces a recompile, and keeps the replay window open until the departure fires.

- **A replay whose departure cannot be resolved is refused.** The departure is the only termination condition; without it the grind would drain the pool forever. A departure whose gate has not opened yet just parks.
- **The install forces the recompile** (`_forceLoopRecompile`: empty `actions.current`, then `restartLoop()` under `_applyingHostReset`). Otherwise the previous loop in flight would run first, and since a loop ends by exhausting its queue, that could be the whole replay.
- **Every publish inside the replay window carries `fromLoop: true`**, location checks included. A replay can cross a new unlock threshold and fire a first-time check, which the strict gate would otherwise swallow.

### Multi-run replays are the normal case

A real run has roughly the default starting mana plus omsi's native budget, and one `Wander` costs most of that, so a recording of more than one substantive action does not fit in one run. Each fork loop end is reported, the host resets and teleports the player, and the replay window ends; the replay continues through loops' generic queue-restart retry, which calls `replayActions` again. The general contract is in [A replay bigger than one run](./loop-recording.md#a-replay-bigger-than-one-run).

Because a loop also ends by exhausting its queue and the departure is the queue's last entry, every omsi departure, live or replayed, is followed within a tick by a native loop end, a run-end report and a reset teleport. That is the `requiresLoopMode` contract. In-app tests therefore collect region-move events rather than polling for "current region is the target", which is only ever true briefly.

## The Bot — the fork's own planner as the solver

omsi's Bot is not a host-side pathfinder. The fork ships Advanced Automation, a planner that runs in its own Web Worker on a private copy of the simulation and installs the best queue it finds. The loops `walkTo` solver switches that planner on and stands back. The bridge runs inside the iframe, so it drives the planner through plain globals (`setOption`, `AdvancedAutomation.planNow()`). The loops side of the Bot flow is in [The Bot flow](./loop-recording.md#the-bot-flow).

1. A Bot block whose action is a `regionMove` out of an omsi region parks and dispatches `walkTo({kind:'exit', name})`.
2. The bridge opens the bot window (`_botInFlight`), remembers the target exit, saves every automation option it will change, and applies `_BOT_PLANNER_OPTIONS` (`plannerMode: 'auto'`, pause while planning on, `plannerMultiTown: false` so a plan cannot leave the town).
3. The game grinds under the planner. Each fork loop end is reported, so the host resets and teleports (see pacing below).
4. At the first held boundary where `regionExitAvailable()` is true, the bridge installs an exit-only plan and disengages the planner. Crossing happens at a loop boundary, never mid-loop.
5. The exit fires, the departing `regionMove` completes the block, and the window closes, restoring the player's options.

Three orderings matter:

- **Install the exit plan first, then disengage.** Disengaging runs `resumeIfPlannerPaused` → `pauseGame()`, which restarts a loop sitting at a held boundary. That restart would be reported and teleport the player out mid-crossing. Installing first clears the hold.
- **The cold start needs one suppressed recompile.** A plan arriving does not start it, and the gate refuses to step at a held boundary, so nothing would. `_clockTick` runs one `_forceLoopRecompile` (under `_applyingHostReset`) once a runnable plan exists; a bare `restartLoop()` or `pauseGame()` would report a run end the game never had.
- **Only a window that engaged may disable the planner.** `_startBotWalk` returns without engaging if the gate is already open (common on the last retry of a multi-run walk). `_crossBotExit` and `_endBotWalk` disable only when `_botSavedOptions` is set, so the bot restores what it saved and never writes defaults over a player's own Advanced Automation setting.

### Pacing: a bot walk is a chain of host round trips

Any omsi bot walk that needs grinding spans host loop resets, because every fork loop end is reported. Each boundary costs a full round trip: report → host reset → teleport to the queue's first region → the bot window closes → the queue re-drives, routes back and re-dispatches `walkTo` → the planner re-engages. The install is idempotent for this reason.

A standalone planner run therefore overstates in-app progress badly: each loop end costs a round trip of several seconds, and the per-reset budget pin undoes the planner's favourite early move, buying mana. Size anything that waits on a bot by host round trips, not by fork loops.

### The threshold probe speaks raw level

The planner's `plProbeThresholds` finds what gates a locked action by changing one dimension at a time. It reads levels with `getRawLevel`, writes exp with `Town.expForLevel`, and searches up to the region's `regionMaxLevel`, so it only visits states the save can hold; `reqFraction` converts its answer back to exp on the raw curve. In vanilla (`regionMaxLevel` 0) raw and effective coincide. `frontend/modules/omsi-loops/test/planner.test.mjs` covers both cases.

### No AP award fires under a Bot in a split fixture

Split worlds emit no unlock locations, and the one victory location needs town 1, far beyond a test's reach. So there is no end-to-end "the bot earned a check" test. Instead `omsi-bot-crosses-region` checks the exemption an award would use: a solver-driven publish carries no `fromLoop` (as on jta) and passes the strict gate because loops' `_botExecutedAction` grants `queueExecution`. The test reads `evaluateActionGate` on a location check in the same tick it sees the window open, because the window opens and closes once per round trip.

## Instant — a pump, not a skip

With Instant ticked, a Playback or Bot block runs the same stepping through a synchronous pump: `_runInstantPump` calls `m.step(batch)` in a tight loop, sizing each batch from the remaining loop budget instead of elapsed wall time. Same ticks, same order, same gates: only the cadence changes, so results match paced play exactly.

- **Same decisions.** `planPumpBatch` shares `stepSkipReason` with `planClockStep`, so a batch is withheld for exactly the reasons a paced tick is.
- **The batch is clamped to `ceil(timeNeeded − timer)`**, recomputed each batch because `timeNeeded` grows mid-run. Without the clamp a batch would overshoot the boundary and spend mana the pool never had.
- **`PUMP_BATCH_TICKS` equals `MAX_TICKS_PER_CALLBACK` on purpose.** The other loop end (the plan running dry) cannot be predicted, so a batch may run past it; using the paced cap keeps that overshoot no larger than paced play's.
- **The pump yields at every run boundary.** A restart must round-trip to the host, which cannot happen while a synchronous pump holds the thread, so `_handleGameRestart` sets a flag the pump checks between batches. A multi-run Instant replay is therefore limited by host round trips, not by ticks.
- **Two entry points.** Playback passes the flag in `replayActions` options (cleared by `_endReplay`). Bot receives it as the control channel's `instant` method, a mode loopState sets both ways before every `walkTo`.

### The view request queue does not dedupe

The fork's `view.requestUpdate` (`views/main.view.js`) dedupes by object reference, and the busiest callers pass a fresh object every tick. Paced play drains often enough not to notice; a pump running a whole loop between drains would go quadratic. `dedupeViewRequests` (`viewRequests.js`) collapses the queue between batches, and one `view.update()` runs when the pump yields. The fix is in the wrapper so paced play and the byte-gate are untouched.

## Differences from jta

Both are `requiresLoopMode` loop games with fine-grained recordings, and much of omsi's bridge follows jta's patterns. Where they differ:

| | jta | omsi |
|---|---|---|
| Region | one game zone | an overlay on one town |
| Clock | the fork's own game loop, paused and resumed by the host | none in the fork; the bridge steps it from a Worker |
| Recording | performed-actions log for the visit | the authored plan (queue) |
| Playback executor | `jtaQueueEngine`, then `crossExit` | the fork's own queue |
| Bot solver | the fork's automation engine, re-armed by the bridge | the fork's Advanced Automation planner |
| Bot retry across a reset | the bridge keeps the pending walk | the generic queue-restart retry |
| Playback Instant | `stepTick` pump (`setInstantMode` would over-perform partial rep-runs) | step pump |
| Bot Instant | `setInstantMode` | step pump |
| `fromLoop` on replay location checks | not needed (re-completions are deduplicated) | stamped |

jta's reasons are in [jta.md, Block modes](./jta.md#block-modes-record-playback-instant-bot).

## AP locations and `unlockScale`

By default there is one location, **Start Journey**, checked when the game unlocks town 1 and carrying the `Victory` item.

With `substrateConfig.omsi.emitUnlockLocations` (and `towns` from 1 to `OMSI_MAX_TOWNS`), the engine's discovery quantity steps become locations instead: each included town contributes its per-var steps carrying `"<Var> Supply Step"` items, access rules are `HasFromList` counts, and victory moves to the last included town's `travel_onward`. Supply steps are `progression_skip_balancing`: they matter to logic, but progression balancing should not churn over many copies of the same few names.

The bridge's boot order matters: register `onUnlockAchieved`, seed the rows the server already holds, push the whole overlay (so its check does not re-report them), then grant the quantity-step deltas; after that `snapshotUpdated` drives incremental grants. A var is managed if it appears in `qBatches`, so the overlay lists every var of every included town, zeros included.

`unlockScale` ∈ (0, 1] (default 1.0) sets how many locations a var contributes. The native rows remain the id space; `unlockPool.js` picks `L = clamp(round(scale · R), 1, R)` evenly spaced rows, and the bridge maps each received item to `qBatches = round(count · R / I)` (`qBatchesForCount`) so a full set still reaches the native maximum. This is entirely on the host side.

## Fork-side surface

The fork's managed API (`frontend/modules/omsi-loops/managed.js`) is what the bridge drives:

| Group | Functions |
|---|---|
| Lifecycle and clock | `boot`, `step`, `getFullState`, `addMana`, `restartLoop`, `onRestart` |
| Awards and unlocks | `setAwardSchedule`, `setUnlockOverlay`, `onUnlockAchieved`, `grantQuantityStep` |
| Regions | `dumpRegionState`, `loadRegionState`, `setActiveRegion`, `regionExitAvailable`, `injectSyntheticAction`, `clearSyntheticActions` |

Town capacity comes from data: `ActionListXml.getQuantityTotalFns()` / `applyQuantityTotals()` compile the XML `<totalDiscovered>` formulas, and `driver.adjustAll()` applies them for every town (`TOWN_COUNT`). The evaluator finds a town through `townFor(varName)` rather than a fixed index, which is what lets a region swap work. Town 7's progress-type vars have no XML and stay in JS, and the rock vars stay with `adjustAllRocks`.

## Play and economy notes

- A loop's starting budget is gameState's default `maxMana` plus omsi's native budget, and one `Wander` costs most of it, so multi-run replays are normal in real play.
- `maxMana` is the loop's starting mana, not a cap; Buy Mana can push the pool above it.
- The clock is a Worker message, so nothing ticks inside one synchronous block of test code. A test that queues an enabled synthetic exit will race its own crossing once the game's progress crosses the Explore gate.

## Capabilities

`supportedFeatures: ['region_topology_from_source', 'arbitrary_ap_locations']`. `loopSupport` is listed [above](#record-playback-and-per-region-queues); `customQueues` is false. `sharing` declares the mana channel plus the numeric entries of the engine's per-loop `resources` bag (`sharing.items.types`); boolean entries such as glasses are unlock flags, since `addResource` assigns them. Zone metadata: `zoneCount` (a getter: the region-split count, else the town count), `extractZoneRules`, `victoryItem`. Full contract: [Substrate Registry Reference](./substrate-registry.md).

## Presets and tests

| Preset | Exercises | Tests (`frontend/modules/tests/testCases/`) |
|---|---|---|
| `omsi_substrate_test` | one region: clock, mana mirror, step gate, Start/Pause, victory on Start Journey | `omsiSubstrateWrapperTests.js` |
| `omsi_schedule_test` | the award schedule | `omsiScheduleTests.js` |
| `omsi_randomized_test` | unlock emission, `travel_onward` victory | `omsiUnlockTests.js` |
| `omsi_scaled_test` | `unlockScale` below 1 | `omsiUnlockTests.js` |
| `omsi_region_split_test` | region split, per-region queues, Record/Playback, Bot, Instant | `omsiRegionSplitTests.js` |

The in-app tests run in `test-substrates` mode, whose config (`frontend/test-configs/playwright_tests_config-substrates.json`) lists test ids, so a new test needs an entry there. The real-time Bot tests are slow by nature (every loop is a host round trip); they run in the `bot-walks` batch.

Unit tests: `clockGate.test.js` (gate parity, the clamp, yield reasons, and that N ticks land in the same state at every batch size) and `viewRequests.test.js` (collapse correctness and bounded queue length).

**Note:** an omsi test that only watches the game grind can pass without the feature it names, so check each new test fails with the feature disabled. Before asserting a value was restored, make it non-default first (the Bot test switches `advancedAutomationEnabled` on, since its default is already off).

## Related documentation

- [Loop Recording and Block Modes](./loop-recording.md) · [JtA Substrate](./jta.md) · [Substrate Registry Reference](./substrate-registry.md) · [Architecture](./architecture.md) · [Gotchas](./gotchas.md)
