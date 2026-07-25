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

Arc D2 (a Bot driven by the fork's own automation planner), E (multi-town travel) and F (a panel queue editor) are not built. **omsi Instant is last of all substrates by standing ruling** — the fork has no fast-step surface.

**The fork byte-gate.** Fork-side changes are gated on reproducing the reference planner run exactly: `CC/scripts/omsi-stats/run-planner.mjs` at seed 12345 must still report **461 loops / 5,195,188 ticks / final-state hash `9d9952e68bc8373c` / 0 RNG draws**. ⚠ Run it with `--worktree`: the harness sims `git archive HEAD`, so without the flag a green gate is testing the *parent* commit.

## Region mapping: N regions, one town (arc C)

omsi is a **content source** in the registry's sense (`zoneCount` + `extractZoneRules`), but its zones are not independent content the way jta's are. Extra `Town` instances are blocked all over the engine — action-name uniqueness, static DOM, `getTravelNum`, the `(town, varName)`-keyed unlock table — so a "region" is an **overlay on one town** rather than a second town:

- Pipeline ① config `substrateConfig.omsi.regionSplit = { townIndex, count, exploreVar, exploreThreshold }` makes the substrate emit `count` separate zones whose payloads all carry the **same** `omsiTown`, each with an `omsiRegion` gate descriptor. Absent ⇒ today's single-region behaviour, byte-inert (every pre-arc-C preset regenerates byte-identical).
- **Per-region state is HOST-side.** The fork exposes `dumpRegionState(townIndex)` / `loadRegionState(townIndex, snapshot)` — they swap the town's value props, derived from the town's own var lists, and run `adjustAll` + `check` on both branches. The snapshots live in the bridge's `_regionStore`, keyed by `region_id`. **Zero new fork save keys** — which also means per-region state is **session-scoped**: `loadRegionState(town, null)` zeroes the region's value props, so after an iframe or page reload every region reads as freshly-entered on its next visit, whatever the fork's own save holds.
- **Exits are derived, not authored.** `_installRegionExits` walks `world.exits` (the same spiral-adjacency exits procgenPlayer routes on, exactly like jta's `_getRegionExits`) and injects one **synthetic exit action** per graph exit through `managed.js`'s `injectSyntheticAction`. Those actions are registered *after* `initializeActions()`, so they are resolvable through `getActionPrototype` (the queue's name lookup) but never appear in `totalActionList`, the planner census, or the DOM — vanilla enumeration and the byte-exact replay gate never see them.
- **The exit gate is Explore-%.** A synthetic exit's `canStart()` consults `regionExitAvailable()`: `min(1, town[exp<Var>] / 505000) >= exploreThreshold` (default 1.0 — fully explored). Below the threshold the exit reads as an ordinary locked action.
- Taking the exit runs `finish()`, which publishes the visit recording and then dispatches `user:regionMove` carrying the **real graph exit name**. That matters for tests and for the strict action gate: an omsi exit crossing is a genuine player-performed exit, not an exit-less synthetic reposition.

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

omsi declares `manual`, `record`, `playback`, `requiresLoopMode` and `queueActions: ['regionMove']` — **no `instant`** (no fast-step surface exists) and **no `executeVia`** (the Bot is arc D2, so `regionSolver()` returns null and the Bot radio never renders). Contract and rationale for the block-mode system: [Loop Recording and Block Modes](./loop-recording.md).

Declaring `record && playback` is what **arms the M3b strict action gate** for omsi regions, and every omsi preset carries `loop_costs`, so loop mode auto-enables and the gate is live for all of them. That is why arc D slice 1 restructured seven in-app legs to park a Manual block before performing anything.

⚠ **`takeLastRecording` ships with the capability declaration, not with the capture that fills it.** Its *presence* is what makes `loopState._captureShapeFor()` answer `'fine'`. A substrate declaring `record + playback` without it is classified **coarse**, and loops would charge `loop_costs` on every observed check *on top of* the bridge's native mana mirror — double billing, enough to trip a depletion reset mid-visit. The library therefore holds the pull-once slot from the moment the capabilities land; an empty pull persists nothing.

### The step gate

Ruling 3 of the arc-D design: **the game advances only while the loops queue is parked for live play on the region this bridge has loaded, or a replay is in flight.** An unparked omsi region is frozen, not idling — otherwise it would grind and drain the shared pool while the queue was doing something else entirely.

Only the host can see the queue, so `index.js` derives the live-play half and pushes `{ enforced, livePlayRegion }` over `omsi:playbackControl`:

- **`livePlayRegion` is pushed verbatim, not as a boolean.** The queue may be parked on another substrate's region, and only the bridge knows which region it currently holds — so a region *swap* needs no push at all.
- **It is a 200 ms poll, not a set of event subscriptions.** The answer changes on a park, a successful exit, a wrong exit, a hard pause, a user pause, a loop reset, a block-mode change, a queue edit and a loop-mode toggle. Subscribing to eight edges means a missed ninth silently freezes the game or silently lets it grind — precisely the failure the gate exists to prevent. Only changes are pushed, so the iframe sees one message per transition (plus a force-push on `iframe:appReady` and on region entry).
- **The gate withholds `m.step()` only.** The mana mirror and the victory watch stay ungated (they observe), the clock interval keeps running, and elapsed time is re-baselined on every callback so a closed gate cannot bank time and replay it as a burst.

⚠ **Arc D2 must extend this payload.** `livePlayRegion()` returns null while a solver drives, so a Bot block would run against a frozen clock.

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

`supportedFeatures: ['region_topology_from_source', 'arbitrary_ap_locations']`. Loop support is a queueable `regionMove` plus manual play, **Record / Playback**, `requiresLoopMode`, and the fine-grained `takeLastRecording` hook — **no `instant`**, **no `executeVia`** (no Bot until arc D2), **no `customQueues`**. `sharing` declares the continuous mana channel plus 18 shareable consumable types (the numeric entries of the engine's per-loop `resources` bag; boolean entries like glasses/supplies are unlock flags, not consumables, because `addResource` *assigns* them). Zone-based metadata: `zoneCount` (a live getter — the region-split count, else the town count), `extractZoneRules`, `victoryItem: 'Victory'`. Full contract: [Substrate Registry Reference](./substrate-registry.md).

## Presets and in-app coverage

| Preset | What it exercises |
|---|---|
| `omsi_substrate_test` | v0: one region, the clock, the mana mirror, victory on Start Journey |
| `omsi_schedule_test` | the P2 award schedule carrier |
| `omsi_randomized_test` | AP-V1 unlock emission (90 supply locations, `travel_onward` victory) |
| `omsi_scaled_test` | arc A `unlockScale` 0.2 (18 supply locations) |
| `omsi_region_split_test` | arc C region split, per-region queues, and the arc-D Record/Playback legs |

In-app legs (they run in `test-substrates` mode, whose config **enumerates test ids** — a new leg needs a config entry). On `omsi_substrate_test`: `omsi-clock-runs-only-in-region`, `omsi-budget-mirrors-pool-both-ways`, `omsi-native-budget-raises-pool`, `omsi-out-of-mana-loop-reset`, `omsi-loop-exhaustion-single-reset`, `omsi-victory-start-journey`, `omsi-cross-substrate-item-grant`, `omsi-step-gate-parks-the-clock`. On `omsi_schedule_test`: `omsi-award-schedule`. On the randomized/scaled presets: the seven `omsi-unlock-*` legs. On `omsi_region_split_test`: `omsi-region-split-round-trip`, `omsi-region-split-per-region-queues`, `omsi-record-playback-crosses-region`, `omsi-multi-run-replay-retry`.

Each arc-D leg was proven **non-vacuous by a control run** with the mechanism under test neutered — worth repeating for any new one, since an omsi leg that merely watches the game grind will pass without the feature it names.

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Gotchas](./gotchas.md)
- [Loop Recording and Block Modes](./loop-recording.md) — the block-mode system omsi joined in arc D
- [JtA Substrate](./jta.md) — the other `requiresLoopMode` substrate; most of omsi's bridge patterns are ports of jta's
