# JtA Substrate

The JtA substrate (`frontend/modules/jtaSubstrateWrapper/`, id `jta`) runs the Journey to Ascension fork, an incremental game in the `frontend/modules/journey-to-ascension/` submodule, in a same-origin iframe as a loop-mode substrate. One AP region is one JtA zone, and the game's energy is mirrored into the host's shared mana pool.

## Zone-based mapping

jta is the reference zone-based substrate: one AP region = one JtA zone. It has no procedural build-time hooks. Instead its registry entry exposes `zoneCount` and `extractZoneRules(zoneIdx)`. Layout drivers that arrange ordered zones (the shuffled-spiral driver) allocate at most `zoneCount` regions to jta, and `extractZoneRules` supplies each zone's payload, which always starts with `{ jtaZone: zoneIdx }`.

`zoneCount` is a getter over the active source document: the loaded dataset's `zones.length`, or the vanilla fixture's (`datasets/vanilla.json`, exposed by `vanillaDataset.js`). The fixture is regenerated from the submodule build by `frontend/modules/jtaSubstrateWrapper/export-vanilla-dataset.mjs`, so there is no hand-kept zone count. As a backstop, the fork's `loadZone` refuses a bad index with a warning.

Other entry fields worth knowing:

| Field | Value | Why |
|---|---|---|
| `iframeId` | `'jtaSubstrateWrapper'` | procgenPlayer re-sends the active region's `jta:loadRegion` after an iframe or page reload |
| `victoryItem` | `'Victory'` | the goal item when the scenario pool supplies none |
| `regionGeometry` | `REGION_GEOMETRY.SIDES` | an exit is a side, not a tile; the pipeline writes no `x`/`y` for it |
| `deserializeWorld` / `serializeWorld` | array ⇄ `Map` | procgenPlayer's region-transition lookup needs `exits` as a `Map` keyed by exit name |

`jta:loadRegion` tells the bridge which zone to load. The player works the zone's tasks, and a region transition is dispatched when a Travel task or an injected exit-choice task completes. Exit-choice task ids are `10000 + zone × 100 + exitIndex` (`SYNTHETIC_TASK_ID_BASE` in `bridge.js`), so they are stable across visits and reloads, and a player's automation priorities on them keep working.

## Host-side mana brokering

On `iframe:appReady` the host module pushes the pool and reset count to the in-iframe bridge. After that, energy and mana are mirrored through the generic resource-channel events handled by the `resourceChannels` router. The bridge publishes `substrate:resourceDelta` (`{ substrateId: 'jta', resource: 'mana', amount }`, negative for drains) and pushes external pool changes back into the game's energy. It tells its own echoed deltas apart from external changes by predicting the pool value.

`maxMana` is the loop's starting mana, not a cap; gains can push the pool above it. With the `energyBonusSync` host setting on (default off), the game keeps its own `max_energy` and reports its starting bonus as `substrate:resourceBonus`.

Resets propagate both ways:

- **Game → host.** A game-initiated run end (energy-reset overlay, `auto_continue_energy_reset`, threshold End Run, prestige) publishes `substrate:resourceReset` with the last-synced `hostResetCount`. The router answers with a loop reset unless one already fired for the same depletion. The fork fires its energy-reset callback on both `doEnergyReset` and `doPrestige`.
- **Host → game.** A host loop reset runs `doEnergyReset` in the game immediately while a jta region is active, or on the next `jta:loadRegion` otherwise (catch-up by reset count).

### The energy-reset latch

The fork sets `is_in_energy_reset` when a run ends, `updateGamestate()` does nothing while it is set, and only `doAnyReset()` clears it. In managed mode that happens only through the bridge's catch-up, which runs only when the host's reset count advances. So the host is the only reset authority, and a latched game can produce no drain to tell it the run ended.

The bridge handles this in two ways:

- **`_syncEnergyFromPool()` declines while the latch is set.** It writes nothing, and the declined value is dropped; the pin after the reset carries the refilled pool. Writing energy into a latched game would deadlock both sides.
- **The poll reports the latch** as `substrate:resourceReset` (`_reportRunEndIfLatched`), once per latch, after the drain mirroring. This covers a latched game with mana still in the pool, and threshold End Run, which latches with energy left over. The bridge never runs `doEnergyReset` for this itself; the host fires the reset and its catch-up clears the latch.

`_breakLatchedEnergyReset` is a fallback: energy above zero with the latch set for `LATCHED_RESET_BREAK_POLLS` polls means something wrote energy while latched, and the bridge completes the reset with a warning. Covered in-app by `jta-latched-run-end-not-masked-by-pin`.

## Clock and persistence

The host owns the clock: the game loop is paused from boot and runs only while the player is in a jta region.

Managed sessions save to their own localStorage slot (the fork's `getSaveLocation()`): `incrementalGameSave_substrate`, or `incrementalGameSave_substrate__<dataset_id>` when a dataset is loaded. Progress and automation settings survive reloads, and standalone saves on the same origin are never touched. Injected exit tasks are excluded from saves and re-injected on region entry.

## Playback / bot execution

The registry entry's PlaybackController is the shared `PlaybackProxy` on the `jta:playbackControl` channel; the bridge executes the calls:

| Call | Fork action |
|---|---|
| `play` / `stop` | resume / pause the game clock |
| `step` | `stepTick` |
| `instant(on)` | `setInstantMode(on)` (Bot path) |
| `startInstantPump` / `stopInstantPump` | fast `stepTick` batches (Playback path) |
| `reset` | `doEnergyReset`, which cascades to a loop reset |
| `walkTo({kind:'exit', name})` | designate the exit; see below |

`walkTo` only designates the exit. The game's own automation engine (the mods, thresholds and priorities the player configures on the JtA page) completes the zone, and the exit is taken when the zone's Travel task completes; on an already-completed zone the exit is taken directly. The host setting `jtaSubstrateWrapper.playbackAutomation` picks the policy:

- `activate` (default): the bridge switches automation on for the walk (`_armWalkAutomation`), fills the zone's priorities only if the player set none, and restores the previous mode afterwards.
- `respect`: zone completion is left to the player's own automation settings. With the all-off defaults the walk waits forever.

**Walks that span resets.** Playing a zone with fresh skills often costs more than one pool, so a walk usually spans several loop resets. Skills persist, so each attempt is cheaper. jta carries the walk across a reset in the bridge: on a same-region reload it keeps `_pendingWalkExit` and re-arms automation, so loops does not re-issue anything. Solvers without such memory (runner, bounce) rely on the generic queue-restart retry instead; the loops side of both paths is in [The Bot flow](./loop-recording.md#the-bot-flow).

**Catch-up resets run before the completion read.** `loadRegion` applies pending catch-up resets before it reads `_completedThisLoop`. A reset really un-plays the zone, and `loadZone(zone, {completed: true})` marks every task done for free, so reading first would give back a zone the reset took away. The `gameState:loopReset` subscriber bumps `_hostResetCount` and clears `_completedThisLoop` together; `loadRegion` logs a warning if a pending reset ever meets a still-marked region, which would mean someone split those two lines.

## Block modes: Record, Playback, Instant, Bot

jta supports every loops block mode. The contract is in [Loop Recording and Block Modes](./loop-recording.md); this section covers only what is jta-specific. How jta and omsi differ is summarised in [Differences from jta](./omsi.md#differences-from-jta).

- **Record.** The recorder is the fork's performed-actions log, `getCurrentRunActions()`, with `zone_id` on each entry. The bridge marks the log length at `jta:loadRegion` and slices from the mark at exit, dropping the last entry, which is always the departing move (`applyFinishTaskRepEffects` records the rep before `onFullyFinishTask` dispatches the move). The slice is published as `jta:visitRecording` before the departing `user:regionMove`, as the [stash-before-regionMove rule](./loop-recording.md#gotchas) requires.
- **Recording vocabulary.** The payload is converted at capture time to the shared `actionQueue` vocabulary (task → `clickTask` with `loops` = reps, item → `useItem` with `loops` = count) and handed to loops through `takeLastRecording`.
- **Playback.** The script runs through the `jtaQueueEngine` executor, then the bridge's `crossExit(exitName)` crosses the recorded exit by name (injected exit tasks get fresh ids each visit). **Warning:** `jtaQueueEngine` must be enabled in the module config wherever jta runs; without it, Playback silently crosses the exit without replaying anything.
- **Playback Instant** drives `stepTick` in fast batches on top of the running game loop (`startInstantPump` / `stopInstantPump`), not `setInstantMode`. `setInstantMode` ignores `GAMESTATE.repeat_tasks` and finishes every remaining rep of a task. A recording made with **Don't Repeat Tasks** on holds partial rep-runs, which `setInstantMode` would replay as more than was recorded. When every task in the recording ran to its full rep count, the two mechanisms give the same result.
- **Bot** hands the queued `regionMove` to `controller.walkTo` ([above](#playback--bot-execution)). The fork's energy drain is mirrored into the pool, and loops adds no completion charge.
- **Bot Instant** uses `setInstantMode`, set both ways before each walk because the mode is sticky in the fork. A Bot plays the live game with no recording to stay faithful to, and the native economy still charges for every rep.
- **Strict action gate.** Declaring `record` and `playback` puts jta under the strict action gate: substrate actions only count while the queue is parked on a matching Manual, Record or Bot block. The bridge's `_dispatchRegionMove` carries no `fromLoop`, so a walk-driven crossing passes on the `queueExecution` exemption while the Bot park holds it open.
- **`requiresLoopMode: true`.** The fork's native reset to zone 0 is the loop-mode teleport once zones are host regions, so energy sync and reset propagation are always on. See [`requiresLoopMode`](./loop-recording.md#requiresloopmode--loop-game-substrates).

In-app coverage: `jta-bot-walkto-exit` (the full Bot path), `jta-record-playback-crosses-zone-boundary` (Record then Playback) and `jta-synthetic-exit-task-id-stability` (exit ids across re-entry, and that a re-entry after a reset loads the zone un-completed), all in `frontend/modules/tests/testCases/jtaSubstrateWrapperTests.js`.

## Play notes

**Automation can stop in under-levelled zones.** Free travel lets the player enter zones far ahead of their skills; a Boss costing more than `current energy × disparity limit` counts as blocked, and the game's default **Pause on Block** stops automation there. Switch the automation panel to **Skip on Block** to skip what cannot run.

## Managed-mode zone invariants

The host owns zone transitions, so in managed mode the fork never calls `advanceZone()`: `onFullyFinishTask` fires the travel callback and stops, and the host answers with a `user:regionMove`. Any engine code that assumes the zone changes by itself is a bug in managed mode. These invariants hold even when the player reaches zones out of order (free travel, spiral layouts, backtracking):

- **`GAMESTATE.tasks` is always the loaded zone's task list.** Every completion path (the automation queue, `doMasteryOfTimeTaskCompletion`, `skipCurrentZoneIfFree`) works on that array, so a completion callback always refers to the loaded zone and the bridge's per-region `ap_locations` map is enough to resolve it.
- **`skipCurrentZoneIfFree()` does not assume the zone advances.** It free-completes a zone whose tasks are all single-tick and returns whether the zone actually changed. In managed mode it completes the current zone (items, perks and AP checks all awarded) and stops, leaving the host to move the player; otherwise `skipFreeZones()` would loop forever inside `doEnergyReset()`. Guarded by `scripts/procgen/check-jta-managed-zone-skip.mjs`.
- **Mastery of Time awards everything.** Skipped tasks go through `doAllTaskRepsForFree` → `progressTask` → `applyFinishTaskRepEffects` (item) → `onFullyFinishTask` (perk, `unlocks_task`, completion callback), so skipping loses nothing.
- **`loadZone` is safe out of order.** `highest_zone` is raised with a `max`, and the "fully completed" credit for the zone being left is guarded on `prevZone > highest_zone_fully_completed`, so revisiting an earlier zone neither lowers progress nor double-credits.
- **Out-of-order zones cannot strand a hidden task.** Every `unlocks_task` chain in the fork is within one zone. The hidden tasks with no in-game unlocker are the SeeBeyondTheVeil-gated ones, which the randomizer excludes (`SBTV_GATED_TASK_IDS` in `jtaSubstrateWrapperLibrary.js`).
- **`setAutomationEndZone` does not confine automation.** It switches automation off permanently once `(zone + 1) >= automation_end`, checked in `advanceZone`, in `loadZone` and when the setter is called. Do not use it to bound a headless driver to a zone range.
- **`doEnergyReset()` returns the fork to zone 0** even if the host has the player in a later region. A check reported for a zone the bridge is not mapping is dropped, but task reps reset every run, so the callback fires again the next time that zone loads, and the bridge's dedupe set only records checks it dispatched.

## AP locations and the balance solve

Every zone task is an AP location when `setJtaEmitZoneLocations` is on (`extractZoneRules` emits them). Perk tasks carry shuffled perk items, the others a do-nothing `JtA Filler`, and the goal zone one `Victory`. Access rules are loose counts (`HasFromListUnique`: zone Z needs Z perks) that shape the sphere order. Grants are AP-authoritative: per-zone `task_patches` suppress each perk task's own grant (`perk → Count`), and the bridge grants perks from received AP items.

**Raw-value economy.** Generated datasets default to `economy.value_mode: "raw"`: absolute `raw_cost` / `raw_xp` per task and `raw_drain` per zone, so difficulty does not follow zone position. A dataset's id includes a content hash; after a hand edit run `datasetValidator.js --restamp`, or the stale id poisons the solve cache and save slot, both keyed by `dataset_id`.

**Post-fill balance.** AP fill moves items around, so costs are balanced in the app after fill by the `jtaBalance` module (design: [`CC/docs/plans/jta-balance-pass-plan.md`](../../../../CC/docs/plans/jta-balance-pass-plan.md)). On `stateManager:rulesLoaded` for a jta world it runs a forward walk in a Web Worker against the fork's build, with a stubbed `localStorage` so the player's save is untouched:

1. The sphere log's buckets, plus a seeded shuffle inside each bucket with playability repair (unlockers before what they unlock, item producers before consumers, Mandatory before Travel, Travel before deeper zones), give a total order over tasks.
2. Each task's `cost_multiplier` is solved at its first start with `estimateResetsToComplete`. Perk milestones target a constant `resetsPerStep` (`DEFAULT_RESETS_PER_STEP` in `balancePass.js`); other tasks target a small fraction of the energy available at that point.
3. The patches are cached in `localStorage` by seed and merged into each region's `world.task_patches`, which the bridge applies on region load.

The fork hooks behind this are `setCostedTaskIds` (uncosted tasks cannot run and are skipped by free-completion paths) and `setTaskFirstStartCallback` (runs before the first tick reads the cost). Guards: `scripts/procgen/check-jta-balance-pass.mjs` and `scripts/procgen/check-jta-cost-hooks.mjs`.

**Perk tasks keep their perk category.** Grant suppression sets a perk task's `perk` to `Count`, and the fork's two categorisers (`getThresholdCategory`, `autoFillCategory`) only treat a task as a perk task if `perk != Count` and the perk is not yet held. Without an override, those tasks fall into the threshold `other` category, which perk tasks fail by design, and the balance walk stalls. `setPerkCategoryTaskIds` forces the perk category for the tasks the host names, even when the perk is already held. The forced set is defined once in `perkOrigin.js` as native perk tasks plus perk holders (tasks whose own location holds a perk item after fill). The bridge, the balance pass (`hostGlue.extractPerkHolderTaskIds`) and `CC/scripts/jta-stats/make-ap-config.mjs` all derive it from there. In free play the override mainly makes the first perks arrive much earlier.

**The `other` category can strand filler.** For perk-less tasks the threshold level metric worsens as skills rise, so a low-XP task can be skipped at any cost. The balance pass reports these as `unengaged` and prices them at its highest cost. The Best-Task fallback usually completes them, but only once the zone runs out of other work, so a few deep filler tasks may never complete. The emergent gate therefore checks progression (Victory and every perk-holding task) and reports total coverage for information; in a multiworld a stranded filler location could hold another player's progression item. Setting `threshold_other_metric` to `RESETS` removes the stranding.

## Prestige and perk grants

`doPrestige()` clears every perk, and a Prestige task (Touch the Divine, id 153) sits inside the default zone range, so vanilla runs can auto-prestige. With AP-authoritative grants, each AP item arrives once, so the bridge has to re-grant:

- A perk found on the player's **own** location behaves like the vanilla perk: it resets on prestige and is granted again whenever the task holding it completes. The AP location stays checked.
- A perk found in **another player's** world has no task to re-run, so the bridge grants it when the item arrives and again after each prestige.

`grantPerk` is idempotent and `setTaskCompletionCallback` fires on every full completion, so the own-world case is simply "grant on every completion". Prestige is detected by comparing `getFullState().prestigeCount` across the energy-reset callback.

**Own versus foreign.** The inventory snapshot has no origin, so `perkOrigin.js` recovers it from placements: an item is own-world if it sits on one of our locations and belongs to us. The player check matters because two JtA slots in one multiworld both have an item called "Attunement".

The placements come from `staticData.locationItems`, which is post-fill, not from the region sidecar, which is written at world-generation time before AP's fill runs. AP's `ReceivedItems` is not usable either, because the frontend normally runs without an AP server.

Coverage: `jta-prestige-perk-regrant` on the `jta_prestige_test` preset, which puts one perk in `start_inventory` to stand in for a foreign item and reaches a real prestige through task 153 (cost patched to 0).

## Emergent verification

The balance pass measures its milestone gaps inside the same walk that assigns the costs, so the out-of-sample check lives in the stats harness: `CC/scripts/jta-stats/sweep-ap-seeds.mjs` generates a post-fill world per seed, solves it, and plays it under free automation, checking location coverage first and pacing second. Results: `CC/scripts/jta-stats/results/SUMMARY.md`. The in-app counterpart is `jta-randomized-balanced-progression` (`jtaBalanceTests.js`).

The sweep drives `CC/scripts/jta-stats/driver.mjs`, not `bridge.js`, so it guards the model; only the in-app tests exercise the real bridge. A seed can fail the pass's in-sample convergence bar and still play to full coverage, and a `thresholdFloored` task is a fragility marker, not an unreachable one.

## Capabilities

`supportedFeatures: ['region_topology_from_source', 'arbitrary_ap_locations']`. `loopSupport`: `queueActions: ['regionMove']`, `manual`, `record`, `playback`, `instant`, `requiresLoopMode`, `executeVia: 'solver'`; no `customQueues`. `sharing`: the mana channel plus the dataset's non-artifact items. Full contract: [Substrate Registry Reference](./substrate-registry.md).

## Related documentation

- [Loop Recording and Block Modes](./loop-recording.md) · [Omsi Substrate](./omsi.md) · [Substrate Registry Reference](./substrate-registry.md) · [Architecture](./architecture.md) · [Gotchas](./gotchas.md)
