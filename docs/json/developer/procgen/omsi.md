# Omsi Substrate (Idle Loops)

The omsi substrate (`frontend/modules/omsiSubstrateWrapper/`, id `omsi`) hosts the **`PeerInfinity/omsi-loops` fork of dmchurch's Idle Loops** — included as the `frontend/modules/omsi-loops/` git submodule, pinned at `2bda39b` — in a same-origin iframe as a loop-mode substrate.

Idle Loops is itself a loop game: you author a **queue of actions**, the game grinds it until the per-loop mana budget runs out, and then it restarts with the progression (skills, talents, discovered quantities) you earned. That genre shapes everything below — the substrate declares `requiresLoopMode`, its native "budget out → restart" *is* the host's loop reset, and what it records for Playback is a **plan**, not a performed-action log.

The iframe boots with `?managed=1`, which makes the fork call `IdleLoopsManaged.boot()`: a dedicated `idleLoops_substrate` save slot and **no game clock at all**. The host owns time. Four arcs built the substrate out:

| Arc | What it did | Where the work lives |
|---|---|---|
| **A** — counts refactor | `unlockScale`: how many of a var's native discovery rows become AP locations, and how many item copies each is worth | outer repo only (`unlockPool.js`, the bridge) |
| **B** — town de-hardcoding | the 14 hand-pinned `adjustPots()…adjustWells()` capacity functions replaced by compiling the XML `<totalDiscovered>` formulas the fork already declares | fork |
| **C** — region split | N genuine AP regions all overlaying **one** town, with host-side per-region state and synthetic exit actions | fork (`managed.js`) + bridge |
| **D1** — loops mode | `loopSupport`, the step gate, per-region authored queues, Record capture and Playback replay | outer repo only |
| **D2** — the Bot | the fork's own automation planner as the `walkTo` solver, plus the per-region Explore rescale it needs | outer repo (slices 1/2/3) + fork (slice 2b) |

Arc E (multi-town travel) and F (a panel queue editor) are not built. **Instant shipped** in slice 1 of the Instant-policy pass (2026-07-25), superseding the old "omsi Instant is last of all substrates" ruling and its premise that the fork has no fast-step surface — it has `step(n)`, and the bridge already owns the clock that calls it. See [Instant](#instant-a-pump-not-a-skip) below.

**The fork byte-gate.** Fork-side changes are gated on reproducing the reference planner run exactly: `CC/scripts/omsi-stats/run-planner.mjs` at seed 12345 must still report **461 loops / 5,195,188 ticks / final-state hash `9d9952e68bc8373c` / 0 RNG draws**. ⚠ Run it with `--worktree`: the harness sims `git archive HEAD`, so without the flag a green gate is testing the *parent* commit.

## Region mapping: N regions, one town (arc C)

omsi is a **content source** in the registry's sense (`zoneCount` + `extractZoneRules`), but its zones are not independent content the way jta's are. Extra `Town` instances are blocked all over the engine — action-name uniqueness, static DOM, `getTravelNum`, the `(town, varName)`-keyed unlock table — so a "region" is an **overlay on one town** rather than a second town:

- Pipeline ① config `substrateConfig.omsi.regionSplit = { townIndex, count, exploreVar, exploreThreshold, exploreMaxLevel, regions }` makes the substrate emit `count` separate zones whose payloads all carry the **same** `omsiTown`, each with an `omsiRegion` gate descriptor. Absent ⇒ today's single-region behaviour, byte-inert (every pre-arc-C preset regenerates byte-identical).
- **Per-region state is HOST-side.** The fork exposes `dumpRegionState(townIndex)` / `loadRegionState(townIndex, snapshot)` — they swap the town's value props, derived from the town's own var lists, and run `adjustAll` + `check` on both branches. The snapshots live in the bridge's `_regionStore`, keyed by `region_id`. **Zero new fork save keys** — which also means per-region state is **session-scoped**: `loadRegionState(town, null)` zeroes the region's value props, so after an iframe or page reload every region reads as freshly-entered on its next visit, whatever the fork's own save holds.
- **Exits are derived, not authored.** `_installRegionExits` walks `world.exits` (the same spiral-adjacency exits procgenPlayer routes on, exactly like jta's `_getRegionExits`) and injects one **synthetic exit action** per graph exit through `managed.js`'s `injectSyntheticAction`. Those actions are registered *after* `initializeActions()`, so they are resolvable through `getActionPrototype` (the queue's name lookup) but never appear in `totalActionList`, the planner census, or the DOM — vanilla enumeration and the byte-exact replay gate never see them.
- **The exit gate is Explore-%.** A synthetic exit's `canStart()` consults `regionExitAvailable()`: `min(1, town[exp<Var>] / cap) >= exploreThreshold` (default 1.0 — fully explored), where `cap` is the region's own ceiling (`expFromLevel(exploreMaxLevel)`, below) and the town's 505000 when it declares none. Below the threshold the exit reads as an ordinary locked action.
- Taking the exit runs `finish()`, which publishes the visit recording and then dispatches `user:regionMove` carrying the **real graph exit name**. That matters for tests and for the strict action gate: an omsi exit crossing is a genuine player-performed exit, not an exit-less synthetic reposition.

### Per-region max Explore level — two views of level (arc D2 slice 2b)

A region that had to be explored to the *town's* level 100 before its exit opened would be the whole game, N times over. `regionSplit.exploreMaxLevel` makes a region a **mini-town compressed into N levels**: its exp hard-caps at `expFromLevel(N)`, and everything the player experiences as "how far along am I" reaches its end there.

Config is a shared default plus per-zone overrides — `regionSplit.exploreMaxLevel`, `regionSplit.regions[i].exploreMaxLevel` — resolved per zone as *override → shared → `max(1, round(100 / count))`*. `exploreThreshold` keeps its meaning and stays a fraction; it is a fraction **of the region's own ceiling** now, so the 1.0 default still reads "fully explored".

The whole mechanism is one seam, `Town.getLevel`, because the arc-B `<totalDiscovered>` curves, the unlock rows, the action thresholds and the UI percentage all consume it. But they must not consume it the *same way*, so level has **two views**:

| view | who reads it | what it is |
|---|---|---|
| **EFFECTIVE** — `getLevel` | unlock-row predicates, action `visible`/`unlocked` thresholds, the UI %, the exit gate | `min(100, floor(raw · 100 / N))` — **schedules compress** into the region's N levels |
| **RAW** — `getRawLevel`, capped at N by the exp clamp | the `<totalDiscovered>` evaluator and the unlock table's quantity-row dot product | the vanilla level — **quantities partition** |

The partition is the load-bearing half and it is why the full-complement model was vetoed: those curves are **linear in level**, so a raw cap at `100/count` hands each region ≈`1/count` of the town's discoverables *for free* — no formula rewriting, and no region minting the town's whole complement. The effective view would have given every region everything.

Details that bite:

- **Three `505000` sites, not one.** `finishProgress` carries the literal at the overflow compare, the assignment, **and** the `=== 505000` capped-already fast path — which also owns the `pauseOnComplete` "Progress complete!" branch. Moving only the two clamp sites still clamps exp correctly and *hides* the bug: at a region cap the equality never matches, so the perf early-return and the completion pause quietly stop working for every rescaled region.
- **`getLevel` has two scaling branches** (`linear` and the default quadratic). The effective wrap sits at the single return site after both, so a linear-scaled var rescales on the same ladder a quadratic one does — and `expForLevel` picks the matching curve for the cap.
- **`setActiveRegion` owes a recompute.** The host swaps region *value* state first (`loadRegionState`, whose `adjustAll` + `Unlocks.check` therefore run under the **outgoing** region's ladder) and installs region *metadata* second. Installing a different scale re-runs both; a same-scale swap skips it, since `loadRegionState` already did the work.
- **Installing a lower maximum clamps stored exp**, or the var would sit forever above a ceiling whose equality never matches.
- **The planner's engine copy is not managed**, so the scale rides `buildWorldConfig`/`installWorldConfig` as a third half beside the award schedule and the unlock overlay (the P2-A principle) — otherwise a plan would be computed against vanilla thresholds and played against compressed ones.
- Cosmetic, accepted: `getPrcToNext` interpolates within **raw** levels, so the bar fills toward the next raw step while the level printed beside it jumps in `100/N` increments.
- ⚠ **Composition landmine for the future emission×split arc** (arc-C ruling 7 still stands — split worlds emit no unlock locations today, so nothing is mis-partitioned yet): quantity row ids are **global** with global dedupe, while each region climbs its own local ladder from zero. Naive composition lets region A's local batches consume the global ids and dedupe region B's identical locals to nothing, stranding batches `count+1..B` forever. The fix is host-side — per-region step counters in the bridge (it knows the active region when a step fires) mapping to region-suffixed location ids, access-ruled on reaching that region. `Unlocks.applyManagedTotals` needs its own ruling there too: `qManagedBatches` is global and overwrites the **active** region's totals.

Everything is off the vanilla path behind one falsy check (`Town.regionScale` is null), and an arc-C region that declares no `exploreMaxLevel` — every pre-2b preset — installs nothing. The byte-gate is what proves the inertness of a change in a white-hot function.

## Host-side clock and mana brokering

Managed mode has no tick loop, so the bridge owns one. A **Worker** metronome fires every 100 ms (page timers get throttled when the tab is occluded — headless runs hit multi-second suspensions; worker timers keep firing) and the bridge advances the engine by elapsed wall time at 50 ticks/s via `IdleLoopsManaged.step(ticks)`, capped at 100 ticks per callback, then drains the view's coalesced render queue (nothing else calls `view.update()` in managed mode). **One tick = one mana.** The clock runs only while an omsi region is active — the same strict pause semantics jta uses.

Stepping is additionally skipped in two states: when the plan has no enabled runnable entry (every `singleTick` would `shouldRestart` and ping-pong resets with the host at 50/s), and when the loops **step gate** is closed (below).

**Mana mirroring.** After each tick batch the bridge samples the game's remaining loop budget (`manaLeft = timeNeeded − timer`) and publishes the signed movement as the generic channel event `substrate:resourceDelta { substrateId: 'omsi', resource: 'mana', amount }` — negative for drains, positive for the game's own in-loop gains (Buy Mana extends `timeNeeded`). External pool changes (another substrate spent mana, a max-mana recompute) are told apart from the bridge's own echoed deltas by the expected-pool prediction and pushed back into the game as `addMana` (signed: `timeNeeded += amount`). Sampling is deliberately **outside** the step gate: a direct `addMana` from a test or a future hook must still reach the pool.

**The starting-budget bonus.** The fork's native per-loop budget (`timeNeededInitial` = 250) is reported up as `substrate:resourceBonus`, so an omsi loop's base budget raises the shared *starting* pool instead of starving against the host default. On entry and after each reset the budget is then **pinned** to the pool.

⚠ **The pin can clobber an unsampled delta** (fixed in arc D slice 0). A pin re-baselines the mirror's last sample, so a budget change the mirror had not yet published would simply vanish. `_syncBudgetFromPool({ flushMirror: true })` — used at the external-`manaChanged` call site *only* — publishes the pending delta first and then pins to the value the host pool **will** hold once that delta lands, converging in one round trip. The entry and loop-reset pins must *not* flush: there the budget jump is the pin's own doing (or the reset's refill) and mirroring it back would double-count.

**Reset propagation, both ways.** Game → host: every driver `restart()` fires the managed `onRestart` callback and the bridge publishes `substrate:resourceReset { hostResetCount }`. Because drains mirror 1:1 and the budget is pinned to the pool, the game's natural `timer ≥ timeNeeded` restart coincides with the pool hitting 0, and the router's reset-count race guard collapses the two into exactly one loop reset per omsi loop. Host → game: `gameState:loopReset` applies `restartLoop()` immediately while an omsi region is active; resets fired while inactive are caught up on the next `omsi:loadRegion` from applied-count bookkeeping (the jta pattern verbatim).

Two restarts are deliberately **not** reported, and both matter for reasoning about Playback:

- **Bridge-applied restarts** (`_applyingHostReset`) — catch-ups, and the replay install's forced recompile. The host is the sole reset authority and the bridge must never fabricate a run-end signal for it (see [gotchas](./gotchas.md#a-frozen-substrate-cannot-generate-the-reset-that-unfreezes-it)).
- **No-progress restarts** — a loop that consumed almost no effective time means nothing could run. Reporting it would ping-pong resets with the host over an unrunnable plan; instead the game idles locally until the player fixes the queue.

## Loop-mode block support (arc D1)

omsi declares `manual`, `record`, `playback`, `requiresLoopMode`, `queueActions: ['regionMove']`, (since arc D2) `executeVia: 'solver'` and (since the Instant-policy pass) `instant`. Contract and rationale for the block-mode system: [Loop Recording and Block Modes](./loop-recording.md).

Declaring `record && playback` is what **arms the M3b strict action gate** for omsi regions, and every omsi preset carries `loop_costs`, so loop mode auto-enables and the gate is live for all of them. That is why arc D slice 1 restructured seven in-app legs to park a Manual block before performing anything.

⚠ **`takeLastRecording` ships with the capability declaration, not with the capture that fills it.** Its *presence* is what makes `loopState._captureShapeFor()` answer `'fine'`. A substrate declaring `record + playback` without it is classified **coarse**, and loops would charge `loop_costs` on every observed check *on top of* the bridge's native mana mirror — double billing, enough to trip a depletion reset mid-visit. The library therefore holds the pull-once slot from the moment the capabilities land; an empty pull persists nothing.

### The step gate

Ruling 3 of the arc-D design: **the game advances only while the loops queue is parked for live play on the region this bridge has loaded, or a replay is in flight.** An unparked omsi region is frozen, not idling — otherwise it would grind and drain the shared pool while the queue was doing something else entirely.

Only the host can see the queue, so `index.js` derives the live-play half and pushes `{ enforced, livePlayRegion }` over `omsi:playbackControl`:

- **`livePlayRegion` is pushed verbatim, not as a boolean.** The queue may be parked on another substrate's region, and only the bridge knows which region it currently holds — so a region *swap* needs no push at all.
- **It is a 200 ms poll, not a set of event subscriptions.** The answer changes on a park, a successful exit, a wrong exit, a hard pause, a user pause, a loop reset, a block-mode change, a queue edit and a loop-mode toggle. Subscribing to eight edges means a missed ninth silently freezes the game or silently lets it grind — precisely the failure the gate exists to prevent. Only changes are pushed, so the iframe sees one message per transition (plus a force-push on `iframe:appReady` and on region entry).
- **The gate withholds `m.step()` only.** The mana mirror and the victory watch stay ungated (they observe), the clock interval keeps running, and elapsed time is re-baselined on every callback so a closed gate cannot bank time and replay it as a burst.

⚠ **A solver needs its own half of this payload**, and arc D2 added it. `livePlayRegion()` returns null while a solver drives, so a Bot block on the bridge's own region would otherwise run against a frozen clock; the push carries `botSolverRegion` alongside `livePlayRegion` and `_mayStepClock` opens on either.

### Per-region authored queues

The fork's `actions.next` (the authored plan) joins the arc-C region swap, in **its own `_regionQueueStore` Map** — deliberately *not* a key inside `_regionStore`'s snapshots, which go verbatim to `m.loadRegionState()` and are walked as the town's value-prop keys. Dumped on exit, reinstalled on entry, **empty on a region entered for the first time**, cleared with the rest of the per-world region state on `rulesLoaded`.

Two filters, both load-bearing, and they are the same filter applied at two ends:

- **The dump strips synthetic-exit entries.** Those actions are region-scoped — `setActiveRegion` deletes the outgoing region's and `_installRegionExits` injects the incoming region's — so a stored exit name is one that will not resolve next visit. And an unresolvable name is not skipped: `actions.restart()`'s `translateClassNames` **throws**, taking the loop down. Stripping at dump time also makes the load-order question moot.
- **The restore filters `totalActionList` membership** (the `saving.js` save-restore guard) as the crash backstop.

Two orderings hold it together: the restore lands **before** `_applyCatchUpResets`, so a catch-up restart compiles the *incoming* region's plan; and `_installRegionExits` clears synthetics by **name predicate**, so a restored plan of real actions passes through untouched.

### Record — the recording is a plan, not a log

Ruling 1: an omsi visit recording is **the game's own authored queue for that region** (`actions.next` minus the synthetic exits), captured at a successful Record exit. A performed-action log would be that same queue repeated once per loop, which is why the genre's answer is a plan snapshot.

So the Record capture and slice 3's per-region dump are **one function**: `_dumpRegionQueue()`, one strip filter, two reasons to call it. The synthetic exit's `finish()` publishes it as `omsi:visitRecording` **before** `_dispatchRegionMove` — the [stash-before-regionMove contract](./loop-recording.md#gotchas), because the loops Record-exit wake pulls the stash when the move lands. It is published on **every** synthetic departure, not only during Record: the host slot is pull-once and only a Record block pulls, so a Manual departure just overwrites an un-pulled stash, and a replay's own departure re-publishes the plan it replayed (idempotent rather than lossy).

Vocabulary conversion runs **host-side in the library, in both directions** (`convertPlanToQueue` / `convertQueueToPlan`), where vitest can reach it without engine globals and the bridge keeps importing nothing from `shared/`. A native entry becomes a `clickTask` with `loops` = reps; `loopsType` and `disabled` ride along. The action **name is the id** — omsi action names are stable engine identifiers, unlike jta's numeric task ids.

### Playback — install the plan, let the fork run it

There is no host-side executor and none is needed: the recording *is* a plan and the fork's queue is what executes plans. `_startReplay` clears the queue, adds each recorded entry (`totalActionList`-filtered), then appends the recorded **departure exit LAST, bypassing that filter** — a synthetic exit is in the `Action` table, which is what `translateClassNames` resolves against, but never in `totalActionList`. It then forces the loop to recompile and holds the replay window open until the departure fires.

Three judgement calls worth carrying:

- **A replay that cannot resolve its departure is REFUSED, not started.** The departure is the *termination condition*; an unbounded grind with no exit would drain the shared pool forever. A recorded queue whose exit **gate** never opens is a different thing and parks indefinitely — Manual-equivalent, and explicitly not to be papered over with a timeout teleport, which would be a replay that crossed without replaying.
- **The install forces the recompile** (`_forceLoopRecompile`: empty `actions.current`, then `restartLoop()`), because `actions.next` is the plan while `actions.current` is the loop in flight. A replay that only wrote the plan would run the region's previous loop first — and since a loop ends by exhausting its queue, "one loop" can be the whole replay. That `restartLoop()` runs under `_applyingHostReset` so the bridge does not fabricate a run end for the host.
- **Every publish inside the replay window carries `fromLoop: true`** — location checks included, which is omsi-specific. A replay grinds the recorded queue across native resets, so it can cross a new unlock threshold and fire a *first-time* check; without the flag the strict action gate would swallow it, killing the AP award and not merely the capture. (jta's re-completions are deduped and never hit this.)

### Multi-run replays are the normal case

A fork loop boundary does **not** stay inside the fork. `_handleGameRestart` reports it, the host fires a real loop reset, and `fireLoopResetTeleport` yanks the player to the resolved loop start — which reaches the bridge as a regionChanged-away and **ends the replay window**. So a replay bigger than one run continues *not* by the window surviving but by loops' **generic queue-restart retry**: the reset snaps the cursor to 0, the queue re-drives, routes back to the region, re-enters the Playback block and calls `replayActions` again — which is why the install is written to be idempotent. The general contract this puts on any fine-grained substrate is in [loop-recording.md](./loop-recording.md#a-replay-bigger-than-one-run).

Two consequences specific to omsi:

- **Every omsi departure — live or replayed — is followed within a tick by a native loop end, a run-end report and a reset teleport.** A loop also ends by exhausting its queue, and the departure is the queue's last entry. That is the `requiresLoopMode` contract, not a defect; it is also why the in-app leg *folds* region-move events from the dispatcher instead of polling for "current region is the target", which is only ever a transient.
- **This path was broken until arc D slice 4b** and the fix is host-side in loops, not in omsi: the substrate-driven reset seam ran `_resetActionsProgress()` alone and left four pieces of park state behind. See [gotchas](./gotchas.md#two-reset-flows-and-they-disagreed).

## The Bot — the fork's own planner as the solver (arc D2)

omsi's Bot is not a host-side pathfinder. The fork already ships **Advanced Automation**: a planner that runs in its own Web Worker on a private copy of the sim, scores candidate queues, and installs the winner. Arc D2 makes loops' `walkTo` solver *engage that planner* and stand back — the same instinct as Playback, where the recording is a plan and the fork's own queue is the executor.

The planner runs unmodified under `?managed=1`, and the bridge executes **inside** the fork's iframe, so it drives the planner through plain globals (`setOption`, `AdvancedAutomation.planNow()`, `AdvancedAutomation._debug`). No transport was needed and the whole Bot is outer-repo; only the [Explore rescale](#per-region-max-explore-level--two-views-of-level-arc-d2-slice-2b) it depends on is a fork change.

### The lifecycle

1. A Bot-mode block whose action is a `regionMove` out of an omsi region parks (`isProcessing` stays true) and dispatches `walkTo({kind:'exit', name})`.
2. The bridge opens the **bot window** (`_botInFlight`, mirroring `_replayInFlight`), remembers the target exit, **saves every automation option it is about to write**, and engages the planner (`plannerMode: 'auto'`, pause-while-planning on, `plannerMultiTown` **off** so a plan cannot route out of the town).
3. The fork grinds under the planner. Each fork loop end is reported, so the host resets and teleports — see pacing below.
4. At the first **held boundary** where `regionExitAvailable()` has become true, the bridge installs an exit-only plan and disengages. Ruling 4: the crossing happens at the *next loop boundary after the gate opens*, never mid-loop, and a held boundary is that moment — the engine is parked and nothing is in flight to interrupt.
5. The synthetic exit fires, the departing `regionMove` completes the block, and the window closes, **putting the player's automation options back**.

Three orderings inside that are load-bearing:

- **Install the exit plan FIRST, disengage SECOND** — the opposite of the obvious order. Disengaging runs the fork's `resumeIfPlannerPaused` → `pauseGame()`, and `pauseGame` restarts the loop when `shouldRestart || timer >= timeNeeded`, which is exactly what a held boundary is. That restart is *not* suppressed, so it reports a run end and the host teleports the player out mid-crossing. Installing first zeroes the hold, so the disengage finds nothing to restart. The manual-edit detector (`interceptPrepareRestart` reads any queue it did not install as a player edit) cannot misfire either, because the disengage lands in the same synchronous step and its own enabled-gate returns before the compare.
- **The cold start needs one suppressed recompile.** A plan LANDING is not a plan STARTING: `onResult` writes the queue, but only `resumeIfPlannerPaused` starts the engine, and that acts solely on a pause the planner took — which needs a boundary, which needs a step, while the clock gate is shut on the boundary the bot arrived past. Frozen substrate, no reset of its own to unfreeze it — the [D1 gotcha](./gotchas.md#a-frozen-substrate-cannot-generate-the-reset-that-unfreezes-it) reincarnated. `_clockTick` fires one `_forceLoopRecompile` (restart under `_applyingHostReset`) once a runnable plan exists. A bare `restartLoop()`/`pauseGame()` here would fabricate a run end for a loop the game never finished.
- **Only a window that ENGAGED may disable the planner.** `_startBotWalk` returns early without engaging when the gate is already open at dispatch — the *common* case on the last re-dispatch of a multi-run walk, where the previous run finished the grind. Both `_crossBotExit` and `_endBotWalk` therefore gate their disable on `_botSavedOptions`. Without that they force `advancedAutomationEnabled` off with nothing saved to restore from, silently taking Advanced Automation away from a player who had switched it on. The invariant is *the bot restores what the bot saved*, never *the bot writes the default*.

### The held-boundary clock gate

Managed mode's `singleTick()` has no `gameIsStopped` guard — that check lives in the rAF `tick()` path, which managed mode disables. So while the planner pauses at a boundary, an ungated clock re-runs `loopEnd()` + `prepareRestart()` on **every tick**: 500 stepped ticks minted 500 phantom loops, inflating `totals` and `totals.effectiveTime` *quadratically* (effectiveTime is never zeroed without a `restart()`, so each held tick re-banks a growing value).

⚠ **The predicate is a HELD BOUNDARY, not `stoppedAt`.** `load()` ends with a `pauseGame()` toggle, so `gameIsStopped` is **ambient-true throughout ordinary managed play** — gating on it freezes omsi entirely (240 ticks of real Wander progress were measured with `stoppedAt: true`). The correct test is `timer >= timeNeeded` still true **after** a step batch returns: a legitimate crossing restarts inside the crossing tick, so post-batch persistence means something is *holding* the restart. Validated at 0 false positives across 1,600 batches / 481 real loops / 120,400 ticks, and it fires within 4 batches of a real planner pause. It is also planner-agnostic, which sidesteps `pausedByPlanner`/`awaitingPlan` being private to the fork's IIFE.

The gate has the same shape as the step gate: it withholds `m.step()` only, and the held boundary is also where the bot's two decisions are taken (cross if the gate opened, cold-start if a plan is waiting).

### Pacing: a bot walk is a chain of host round trips

**There is no such thing as a single-run bot walk on omsi.** Any walk needing any grinding spans host loop resets, because a fork loop end always reports one — that is the `requiresLoopMode` contract, not a defect. Each fork boundary costs a full round trip: report → host reset → reset teleport to the queue's index-0 region → the bot window closes on the regionChanged-away → the queue re-drives from 0 and routes back → the M6 bot wake re-dispatches `walkTo` → re-engage. The install is idempotent for exactly this reason, like `_startReplay`.

⚠ **A standalone probe of the planner will badly overstate in-app progress.** Driven continuously the planner opens the region-split fixture's gate in 19–44 fork loops; in-app the same seed spent **25 fork loops to gain one Wander**. Two things account for the gap, and both are inherent:

- Every loop end is a round trip, measured at **~12 s** wall clock (the bridge steps the fork at 50 ticks/s of *real* time, so a ~350-mana loop is ~7 s of that).
- The bridge **re-pins the budget to the host pool** on every reset, which neutralises the planner's favourite early strategy — "invest" *is* buying mana, and the pin takes it back.

Net measured rate: **~1 productive Wander per 6–7 host round trips.** Size anything that waits on a bot against the round-trip rate, never against fork loops.

### The threshold probe speaks RAW level (post-D2 cleanup)

`plProbeThresholds` discovers what gates a locked action by perturbing one dimension at a time and re-evaluating `visible() && unlocked()`. It used to **read** levels through `getLevel` (the effective view) while **writing** exp back through a raw-level formula. Invisible in vanilla, where the two ladders coincide; wrong under a rescale, where the effective level it read became the lower bound of a binary search whose steps are raw levels.

Measured on a 10-level region holding raw Wander 1 (effective 10): every Wander gate answered `need: 11` — one above its own floor, above a cap of 10, and **identical for gates that are raw levels apart**. Unreachability was the visible half; the lost resolution was the damaging half, because `rankFrontierDims` and the unlock-fraction scorer rank dims by how close `need` is.

The probe now speaks raw on both sides: `getRawLevel` to read, `Town.expForLevel` to write, and the search ceiling is the region's own `regionMaxLevel` rather than a flat 100, so it only ever visits states the save can hold. **Raw is the view that survives the round trip** — `reqFraction` converts `need` straight back to exp on the raw curve, so any other unit would have to be undone again downstream. `test()` stays effective-driven (that is what the predicates read) and effective is monotone in raw, so the searches themselves are unchanged. The same state now answers 2 / 2 / 3 / 2 for Buy Glasses / Buy Mana Z1 / Meet People / Pick Locks, all inside the cap. Vanilla is byte-identical by construction (`regionMaxLevel` is 0 ⇒ raw ≡ effective, ceiling 100); the V0 reference is the gate on that claim, and `test/planner.test.mjs` pins both the compressed answers and the vanilla control.

`plProbePoolCap` reads and writes **raw** on purpose and was left alone: its read side is `total<Var>`, a `<totalDiscovered>` consumer, which *is* the raw view — and its MAXP bump deliberately overshoots a compressed region's ceiling, because it is a Δ>0 sensitivity test, not a reachability claim.

Still open, smaller: `reqFraction` converts a progress `need` to exp on the **quadratic** curve unconditionally, so a linear-scaled progress dim's fraction is wrong. The only linear progress var is town 8's `BuildTower`, far outside anything the substrate reaches, so it is recorded here rather than fixed inside a byte-gated slice.

### No AP award fires under a Bot in a split fixture

Worth stating so nobody goes looking for the test: **split worlds emit no unlock locations at all** (arc-C ruling 7), and the one victory location needs town 1 unlocked — thousands of loops away. So there is no end-to-end "the bot earned an AP check" observation available today.

What the legs pin instead is the **exemption an award would ride**. A departing synthetic exit carries a real exit name, so it is a performed player action the strict gate would block; `livePlayRegion()` is null while a solver drives, so the `parkedLivePlay` exemption the Manual legs use is unavailable; and the arc-D2 ruling is **no `fromLoop` stamping** (jta-consistent — `_botExecutedAction` gives loops' gate a blanket `queueExecution` pass *before* any flag is consulted). So the crossing landing at all is itself the observation, and `omsi-bot-crosses-region` additionally reads `evaluateActionGate` on a location check **in the same tick the window is observed open** — it must return `queueExecution`. Reading it a poll later reads a different moment, because the window opens and closes once per round trip.

The true end-to-end award under a bot belongs to the future emission × split composition arc, together with the [quantity-row identity landmine](#per-region-max-explore-level--two-views-of-level-arc-d2-slice-2b) that arc has to solve first.

## Instant — a pump, not a skip

Slice 1 of the Instant-policy pass (2026-07-25) gives omsi a user-facing `loopSupport.instant`. A Playback or Bot block with the box ticked runs **the same stepping through a synchronous pump**: `bridge.js`'s `_runInstantPump` calls `m.step(batch)` in a tight loop, sizing each batch from the *remaining loop budget* instead of from elapsed wall time. Same ticks, same order, same gate — **cadence only**, so results are byte-identical to paced play by construction. There is deliberately nothing analogous to jta's `completeTaskInstantly`: no action completes that the economy could not pay for, and none completes that the *recording* did not ask for. (jta's was affordability-blind until fork `8383af0`; it still finishes every remaining rep of a task regardless of `repeat_tasks`, which is why jta's *Playback* Instant is a stepTick pump rather than `setInstantMode` — see [jta Block modes](./jta.md#block-modes-record-playback-instant-bot-m4m6).)

**The decision layer is unchanged.** `planPumpBatch` (clockGate.js) shares `planClockStep`'s skip ordering through one `stepSkipReason` helper, so a batch is withheld for exactly the reasons a paced tick is: no runnable queue, a closed step gate, a [held boundary](#the-held-boundary-clock-gate).

**The batch is clamped to `ceil(timeNeeded - timer)`**, recomputed every batch because `timeNeeded` grows mid-run (Buy Mana, the host pinning the budget to a refilled pool). Without the clamp a batch overshoots the timer boundary and spends mana the shared pool never had — and the host's out-of-mana → `triggerLoopReset` answer is a round trip away.

**`PUMP_BATCH_TICKS === MAX_TICKS_PER_CALLBACK`, and that equality is load-bearing.** The clamp predicts the *timer* boundary only; the other loop end (`shouldRestart`, a compiled plan running dry) cannot be predicted from outside, so a batch crossing it restarts in-tick and grinds its remainder into the next run. Paced play has the identical overshoot bounded by its own per-callback cap — matching that cap means Instant adds no new exposure. It costs nothing, because the win comes from not *waiting* between callbacks, not from batch size.

**The pump yields at every run boundary.** A restart is reported to the host as `substrate:resourceReset`, answered with a real loop reset whose teleport ends the window — and nothing can round-trip while a synchronous pump holds the thread. So `_handleGameRestart` sets a flag the pump checks between batches (on *every* restart, including the no-progress guard's unreported ones — a spinning plan should spin at 50/s, not at full synchronous speed). The consequence is the actual headline: **a multi-run replay under Instant is round-trip-bound instead of tick-bound.**

**Two entry points, two scopes.** Playback's flag rides `replayActions`' opts (scoped to one replay, cleared by `_endReplay`); Bot's arrives as the control channel's `instant` method, a persistent *mode* that loopState sets **both ways** before every `walkTo`. Declaring `instant` was not independently shippable from the Bot half: omsi already satisfied `regionBotHonorsInstant`'s other two conditions (`executeVia: 'solver'` + a fine capture shape), so the one field lit up both checkboxes at once — and a `case 'instant'` that still logged-and-dropped would have been exactly the vacuous control the per-capability ruling forbids.

### ⚠ The view request queue does not dedupe

`view.requestUpdate` (`views/main.view.js`) coalesces with `includes`, i.e. **reference** equality — and the hot callers hand it a fresh object literal every call (`town.js:194`, unconditional once per progress tick, plus `:244` and `:151/190`). The dedupe therefore never fires for the entries that repeat most: the array grows ~1 per tick, each push linear-scans it, and the eventual `view.update()` replays every duplicate as its own DOM update.

Paced play never reaches this — `view.update()` drains every `VIEW_UPDATE_MIN_MS`, so the queue holds ≤10 entries. A pump running a whole loop between drains makes it **quadratic in ticks**, and it would have presented as an unexplained slowdown rather than as a bug: the pump would still be correct, just slower than the paced play it exists to beat.

The fix is `viewRequests.js`'s `dedupeViewRequests`, run **between batches**, with one real `view.update()` at pump yield. It is pump-scoped (paced play stays byte-inert) and outer-repo by choice: fixing `requestUpdate` in the fork would touch every paced boot — the byte-gate surface — to fix a cost only the pump can reach. Collapsing is safe because every request is an idempotent "repaint this row from *current* state" call; unmodelled target shapes fall back to reference identity, so they can never be collapsed wrongly.

### Coverage

| Layer | What it pins |
|---|---|
| `clockGate.test.js` | The gate parity, the clamp (swept at every offset for overshoot), the four yield reasons, and the **byte-identity contract**: N ticks land in the same state at every batch shape (1/7/10/100/250/N) across six budget-and-plan scenarios |
| `viewRequests.test.js` | Collapse correctness on the fork's real target shapes, first-occurrence order, no collapse of unmodelled shapes, and the asymptotics (queue length bounded by one batch, not by the run) |
| `omsi-playback-instant` | Two replays of one recording, paced then Instant, one flag apart: a **≥3× duration bound** (a silent paced fallback scores ~1×), a paced control pinned at *exactly zero* pump ticks, and the same effects both ways |
| `omsi-bot-instant-multi-reset-walk` | The Bot half: the flag arrives as a bot mode, the pump carries the walk, and the multi-reset machinery still holds under it. **Complements** `omsi-bot-multi-reset-walk` — the only real-time bot coverage — rather than replacing it |

No duration bound on the bot leg, deliberately: a bot walk is host-round-trip-bound (~12 s each, see [Pacing](#pacing-a-bot-walk-is-a-chain-of-host-round-trips)) and Instant collapses only the ticking *inside* a run, so a ratio there would measure machinery Instant does not touch.

## AP locations, unlock discretization and `unlockScale`

The default (v0) shape is one location: **Start Journey**, checked when the game unlocks town 1, carrying the `Victory` item.

**AP-V1** (opt-in via `substrateConfig.omsi.emitUnlockLocations`, with `towns` ∈ 1…9) turns the engine's **discovery quantity steps** into AP locations instead: each included town contributes its per-var steps carrying `"<Var> Supply Step"` items, access rules are `HasFromList`-style counts, and victory moves from town 0's `start_journey` to the last included town's `travel_onward`. Supply steps are classified `progression_skip_balancing` — they *are* logic-relevant, but multiworld progression balancing must not churn over hundreds of interchangeable copies of 14 names.

The bridge is the AP↔fork translator for capacity, and its boot order is **ruled and load-bearing**: register `onUnlockAchieved` (passive) → seed the rows the server already holds → push the whole overlay (its `check()` would otherwise re-report them) → grant the quantity-step deltas. Thereafter `snapshotUpdated` drives incremental grants. Prestige needs no re-push (the overlay and the fork's `achievedReported` both survive it); only an iframe reload re-runs the bulk sequence, and that path re-enters through `omsi:loadRegion` anyway. A var's **presence** in `qBatches` is what makes it managed, so the overlay names every var of every included town, zeros included.

**Arc A's `unlockScale`** ∈ (0, 1] (default 1.0, byte-inert) decouples *how many* locations a var contributes from the engine's native row count. The native rows stay the id namespace and the capacity substrate; a selection picks `L = clamp(round(scale · R), 1, R)` nearly-evenly-spaced rows (`k_j = round(j · R / L)`, top pinned to `R`), and the bridge maps each received item to `qBatches = round(count · R / I)` so a full set still lands exactly at the native maximum. Arc A is **entirely outer-repo**: the fork caps capacity item-blind, and the bridge already drops fired row ids absent from `ap_locations`, so "which rows exist" is simply which rows the outer pool emits.

## Fork-side surface (arc B and what managed mode adds)

The fork's managed-mode API (`frontend/modules/omsi-loops/managed.js`) is what the bridge drives: `boot`, `step`, `getFullState`, `addMana`, `restartLoop` + the `onRestart` callback, `setAwardSchedule`, `setUnlockOverlay` / `onUnlockAchieved` / `grantQuantityStep`, and the arc-C region set (`dumpRegionState`, `loadRegionState`, `setActiveRegion`, `regionExitAvailable`, `injectSyntheticAction`, `clearSyntheticActions`).

**Arc B** removed the town-number hardcoding from capacity: the XML `<totalDiscovered>` blocks already declared each of the 14 formulas in full (base coefficients and divisors, prestige content, survey bonus, skill mod with its min/max/percentChange, floor/round), and the fork already had a tested evaluator compiling exactly these for `<primaryValue>`. So `ActionListXml.getQuantityTotalFns()` / `applyQuantityTotals()` compile them and `driver.adjustAll()` became one data-driven call; the 14 hand-pinned `adjustPots()…adjustWells()` functions were deleted, and `TOWN_COUNT = 9` replaced the scattered literals. Byte-exact by construction, and gated additionally by a full-multiplier-space differential sweep against the pre-deletion JS — the byte-gate alone cannot witness levels the reference run never reaches. Town-7 progress-type vars (Pockets/Warehouses/Insurance) carry no XML and stay in JS; the HaulZ/StonesZ vars stay with `adjustAllRocks`.

Arc C's swappable-region seam came free from this: the evaluator resolves a town through `townFor(varName)` / `ctx.townNum`, never a `towns[N]` literal.

## Play and economy notes

- **The pool a real run has is ~350 mana, and one `Wander` costs 250.** The `omsi_region_split_test` preset sets no starting-mana override, so a loop's budget is gameState's default `maxMana` 100 plus omsi's reported native 250. **Multi-run replays are therefore the NORMAL case in real play, not an edge case** — a recording of more than one substantive action will not fit in one run.
- Sizing a test that follows a Record leg: the first interrupted run starts at ~100 mana, not 350 — the Record leg leaves the pool drained, and only the reset refills to max.
- `maxMana` is the loop's **starting** mana, not a ceiling. omsi gains (Buy Mana) can push the pool above it.
- The bridge's clock is a Worker message, so **nothing ticks inside one synchronous block** of test code. That is what makes a gate-open→`finish()` window safe to treat as atomic — and why a test that queues an *enabled* synthetic exit entry will race its own crossing the moment the engine's own progress crosses the Explore gate.

## Capabilities

`supportedFeatures: ['region_topology_from_source', 'arbitrary_ap_locations']`. Loop support is a queueable `regionMove` plus manual play, **Record / Playback**, `requiresLoopMode`, `executeVia: 'solver'` (arc D2's Bot), `instant` (the Instant-policy pass), and the fine-grained `takeLastRecording` hook — **no `customQueues`**. `sharing` declares the continuous mana channel plus 18 shareable consumable types (the numeric entries of the engine's per-loop `resources` bag; boolean entries like glasses/supplies are unlock flags, not consumables, because `addResource` *assigns* them). Zone-based metadata: `zoneCount` (a live getter — the region-split count, else the town count), `extractZoneRules`, `victoryItem: 'Victory'`. Full contract: [Substrate Registry Reference](./substrate-registry.md).

## Presets and in-app coverage

| Preset | What it exercises |
|---|---|
| `omsi_substrate_test` | v0: one region, the clock, the mana mirror, victory on Start Journey |
| `omsi_schedule_test` | the P2 award schedule carrier |
| `omsi_randomized_test` | AP-V1 unlock emission (90 supply locations, `travel_onward` victory) |
| `omsi_scaled_test` | arc A `unlockScale` 0.2 (18 supply locations) |
| `omsi_region_split_test` | arc C region split, per-region queues, and the arc-D Record/Playback legs |

In-app legs (they run in `test-substrates` mode, whose config **enumerates test ids** — a new leg needs a config entry). On `omsi_substrate_test`: `omsi-clock-runs-only-in-region`, `omsi-budget-mirrors-pool-both-ways`, `omsi-native-budget-raises-pool`, `omsi-out-of-mana-loop-reset`, `omsi-loop-exhaustion-single-reset`, `omsi-victory-start-journey`, `omsi-cross-substrate-item-grant`, `omsi-step-gate-parks-the-clock`. On `omsi_schedule_test`: `omsi-award-schedule`. On the randomized/scaled presets: the seven `omsi-unlock-*` legs. On `omsi_region_split_test`: `omsi-region-split-round-trip`, `omsi-region-split-per-region-queues`, `omsi-record-playback-crosses-region`, `omsi-multi-run-replay-retry`, `omsi-bot-crosses-region`, `omsi-bot-multi-reset-walk`.

⚠ The two bot legs cost **~85 s and ~285 s**, and that is structural rather than fixable: see [round-trip pacing](#pacing-a-bot-walk-is-a-chain-of-host-round-trips). Playwright's per-test timeout was raised 300 s → 900 s to fit them (one Playwright test wraps the whole in-app suite). It is a ceiling, not a cost — and the layers below it, `[PROGRESS]` liveness lines and the polls' own STUCK/STARVED/CHECK-BOUND classification, are what actually diagnose a hang.

Each arc-D leg was proven **non-vacuous by a control run** with the mechanism under test neutered — worth repeating for any new one, since an omsi leg that merely watches the game grind will pass without the feature it names.

**Assert restoration of a value you deliberately made non-default.** The slice-3 option-restore bug was live for a whole slice because the fork's `advancedAutomationEnabled` defaults to *false* and the bot's clobber also wrote *false*: an assertion that the option came back unchanged was true for the wrong reason. The leg switches it **on** first, the way a player would, and only then is "the bot leaves the options as it found them" a real pin. The same shape caught arc D2 slice 2b's missing `setActiveRegion` recompute — there the trap was choosing a witness that *cannot* move (discovery totals are raw-driven, so they read the same either way) instead of one that can (an unlock row, which reads the effective level). Before asserting that something was restored or recomputed, check that the value would have differed had the code done nothing.

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Gotchas](./gotchas.md)
- [Loop Recording and Block Modes](./loop-recording.md) — the block-mode system omsi joined in arc D
- [JtA Substrate](./jta.md) — the other `requiresLoopMode` substrate; most of omsi's bridge patterns are ports of jta's
