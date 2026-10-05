# Loop Recording and Block Modes

How loop mode records what a player does in a region and plays it back: per-block modes (Manual, Record, Playback, Bot) and the Instant toggle, the saved-recording store, the capture contract that decides who records, queue annotations, summary substrates, reset handling and multi-run replay, and the strict action gate.

The code lives in `frontend/modules/loops/`: `loopState.js` (mode resolution, dispatch, the action gate, charging, resets), `loopBlockBuilder.js` (the per-block radios), `blockIdentity.js`, `savedQueueStore.js`, `blockAnnotations.js` and `loopModeExemptions.js`. The per-entry predicates (`captureShapeOf`, `solverKindOf`, `botHonorsInstant`) are in `frontend/modules/procgenCore/substratePredicates.js`.

## Block modes

A **block** is one region visit in the loops queue: the interior entries between two boundary `regionMove`s. Every block resolves to a mode:

| Mode | Behavior |
|------|----------|
| **Manual** | The queue parks and the player plays the region by hand. Live play drains mana and captures nothing. A `user:regionMove` to the expected next region completes the block; a wrong exit pauses the queue until reset. |
| **Record** | Manual plus capture. On a successful exit the block's queued interior is rewritten to what the player actually did, and fine-grained substrates also save the full recording. With the `autoSwitchToPlaybackAfterRecord` setting (default on) the block then switches to Playback. |
| **Playback** | Replays the block. Coarse substrates run the block's own interior. Fine-grained and summary substrates replay the recording bound to the block; with none bound, the block parks for live play like Manual. |
| **Bot** | A solver plays the block live: the substrate walks to each queued target and the queue parks until it arrives. Needs no recording and costs what live play of the same content costs. A wrong exit pauses until reset, as in Manual. |

### Solvers

A **solver** is the per-action agent that drives a substrate to a queued target. A Bot block is the only thing that triggers one. `loopState.regionSolver(region)` resolves which one a region has, from existing declarations:

| Solver | Declared by | How it works | Substrates |
|--------|-------------|--------------|------------|
| `'walkTo'` | `loopSupport.executeVia: 'solver'` | Loops calls the PlaybackController's `walkTo` and completes the action on the resulting `user:locationCheck` or `gameState:regionChanged`. | jta, omsi, runner, bounce, noiz2sa |
| `'delegation'` | `sharing.mana.loopActionDelegation: true`, and the region has `manaEnabled` | The substrate panel walks the action tile by tile, charging natively, and publishes `loops:substrateActionCompleted`. | maze |

`walkTo` wins if an entry declares both. The maze uses delegation because its controller's `walkTo` drives the visualizer, not the charging panel engine.

A Bot block whose solver cannot engage (no solver, controller not mounted, or the action type is not in `queueActions`) parks for live play and logs a warning. It never falls through to the generic timer, which would teleport through content the bot was meant to play.

### Instant

**Instant** is a per-block toggle, not a mode. A Playback or Bot block whose substrate declares `loopSupport.instant` drains its replay in one frame instead of animating per tick, and suppresses panel focus-stealing meanwhile. The generic timer path honors it too.

For a Bot block the checkbox appears only where the solver honors it (`loopState.regionBotHonorsInstant`: `instant`, the `walkTo` solver and a fine capture shape), which is jta and omsi. For summary blocks it is hidden: their Playback is always instant.

### Resolving a block's mode

- **Block identity.** The mode map is keyed by `(region, instanceNumber)`. `resolveQueueBlocks` is the one resolver both the renderer and the executor use. It exists because a leaving `regionMove`'s own `instanceNumber` names its destination block, while it renders in and runs from its source block.
- **Precedence** (`getBlockMode`): an explicit per-block choice, then the legacy `manualRegionStates` (migrated saves), then the `defaultBlockMode` setting.
- **Defaults.** `defaultBlockMode` is `'record'` and accepts `record`, `playback` or `manual`. A `record` default falls back to Manual where the substrate cannot record, and a `manual` default falls back to Playback where it cannot park. Bot is never a default; it is a per-block choice and is offered in the set-all control.
- **Playback is disabled until the block has content**: a bound recording (fine-grained), a bound summary (summary), or a non-empty interior (coarse). The mode row shows the same answer as `● recorded` / `○ not recorded`.
- **Radios follow capabilities.** Record needs `loopSupport.record && loopSupport.playback`; Bot needs a solver; Instant needs `instant`. See [Substrate Registry Reference](./substrate-registry.md#loop-mode).

## Recordings and the saved-queue store

`savedQueueStore.js` keeps recordings in localStorage under `loops:savedQueues:v1`, bucketed by `(rulesHash, substrate, region)`. Each entry (`SavedQueue`) holds the recording `actions`, `arrivalExitId` / `departureExitId`, [`annotations`](#queue-annotations--what-a-recorded-visit-cost), an optional `summary`, mana bookkeeping (`manaAtEntry` / `manaAtExit` / `manaMin`), `locationsChecked` / `itemsPickedUp`, and `recordedAt` / `name`. The field list is the header comment of `savedQueueStore.js`.

The store holds every capture shape. A fine-grained entry carries `actions`; a coarse entry carries annotations only; a summary entry carries `summary`. Two guards keep them apart: `hasPlayableRecording(entry)` requires non-empty `actions`, so neither kind binds to a fine-grained Playback block; `hasSummaryRecording(entry)` is the equivalent for summaries. The panel reads annotations through `loopState.getBlockAnnotations()`, since coarse blocks have annotations but no playable recording.

**Note:** the duplicate check (`isDuplicate`) compares `annotations` and `summary` as well as `actions`. Coarse and summary entries all have `actions: []`, so without that a re-record would be discarded as a duplicate of its stale predecessor. Any new actions-less category must join that comparison.

Maze recordings may carry extra fields (`worldDigest`, `requires`) that loops never reads; the maze checks them before replaying. See [Maze Substrate](./maze.md).

### Binding a recording to a block

A recording is bound to a block by its **recording tag `(arrivalKey, ordinal)`**, which is separate from the mode-map key. `arrivalKey` is the exit the player arrived through (`'entrance'` for the start region); `ordinal` counts blocks with the same `(region, arrivalKey)`. Loops derives the tag on both the save and the lookup side (`assignRecordingTags`, against the procgenPlayer warehouse), so the recorder's own ids cannot drift out of step.

- Saving **replaces on tag**: re-recording a block replaces its recording.
- Entries with other tags are kept as history, capped at `SAVED_QUEUE_PER_REGION_LIMIT` per region, oldest evicted first.
- Recordings survive block deletion. Recreating a matching block restores its recording through the tag lookup.

## The capture contract: coarse-only vs. fine-grained vs. summary substrates

Substrate actions come in two grades:

- **Queue-grade**: player-meaningful and individually costed — `regionMove`, `locationCheck`, `explore`, and any future verb of the same weight. `explore` is a `customAction` entry; the generic executor dispatches an event per action for interested modules.
- **Sub-queue-grade**: finer than a queue entry, such as the maze's per-tile moves. Many make up one meaningful step and none belongs in the block interior.

From that, each substrate has one of three capture shapes. `captureShapeOf(entry)` (used through `loopState._captureShapeFor()`) answers `'fine'` if the entry supplies `takeLastRecording`, else `'summary'` if it declares `loopSupport.summaryRecording`, else `'coarse'`:

| Shape | Substrates | Capture | Replay | Live-play drain |
|-------|-----------|---------|--------|-----------------|
| **Coarse** | text adventure | Loops buffers the observed actions and writes them into the block interior | The generic executor runs the block's entries | Loops charges each action its `loop_costs` value |
| **Fine-grained** | maze, jta, omsi | The substrate recorder captures the whole visit | The substrate replays it (`replayActions`) | The substrate charges natively: the maze per tile (only while `livePlayRegion()` names its region), jta and omsi by mirroring the fork's energy or mana into the pool |
| **Summary** | runner, bounce, noiz2sa | Loops records the net result: drain seconds, performed checks, explicitly costed actions, departure exit | Loops applies the result instantly; the game replays nothing | Loops charges a per-second time drain, plus any action cost the data names explicitly |

For fine-grained substrates the block interior is a *projection*: loops filters the capture down to queue-grade entries. All three record in the shared `actionQueue` vocabulary (`{ actionType, actionId, substrate, loops }`, runs of identical entries compressed through `loops`).

A fine-grained recording need not be an action log. omsi's recording is the region's authored plan at the moment of a successful Record exit, and Playback installs that plan and lets the game's own queue run it. See [omsi.md](./omsi.md).

Two rules follow, both preventing ordering bugs:

1. **Never two capture channels for one visit.** Two recorders have no shared clock, so the interleaving ("pull lever, then walk through the door") cannot be reconstructed.
2. **Once a visit contains any fine action, the whole visit replays through the substrate.** Splitting a visit between the generic timer and the bridge breaks ordering.

A new queue-grade verb on a coarse substrate is declared in `loopSupport.queueActions`, costed in `loop_costs` and dispatched by the generic executor. A coarse substrate that gains a sub-queue-grade action becomes fine-grained: it supplies `takeLastRecording` and a full-visit recorder.

### Summary substrates

Runner, bounce and Noiz2sa play in real time, so their action stream is not worth replaying; the pickups and the exit are the outcome. Their recording is a result:

```
{ actions: [], annotations, departureExitId,
  summary: { durationSeconds, checks: [...], costedActions: [...], playStats? } }
```

`durationSeconds` is required because Playback pricing multiplies it. `playStats` is present when the region's page reported play-clock `stats` (Noiz2sa: `{gameSeconds, score}`): the last report of the visit, kept opaque. Loops reads none of it. The block interior is still rewritten to the performed checks for readability, but Playback ignores it.

**The economy is time.** The per-second drain is the region's `timeDrainPerSecond` from the `loop_costs` data (fallback `defaultTimeDrainPerSecond`, then `DEFAULT_TIME_DRAIN_PER_SECOND` = 1), scaled by region XP. It is charged by `_timeDrainTick` for every second the queue is parked for live play on a summary region, so idle, replaying and paused time cost nothing. Per-action costs apply only where the data names one explicitly; the `defaultRegionCost` / `defaultLocationCost` fallbacks never reach a summary action, or every visit would be charged twice.

**Playback prices at replay time**: recorded seconds times the region's current XP-discounted rate, plus the current price of each costed action, so region-XP growth applies to replays. The game does not take part: loops refires the checks and dispatches the departure itself. After the spend it publishes `loops:summaryApplied` `{region, substrate, summary}`, so a substrate that earns from play earns the recorded visit again (Noiz2sa's training: [noiz2sa.md](./noiz2sa.md#the-bots-training)).

Runner and bounce do not declare `requiresLoopMode`: they have no native "out of resource, restart the run" economy.

### The play clock

Some summary games do not advance on every wall-clock second: Noiz2sa waits for a key before a region starts and pauses on blur or P. A substrate that declares `loopSupport.playClock` lets its page say so, and the drain then charges only time the game actually plays.

- **The report.** The page calls `__swfBridge.setPlayClock(running)` on every change of its own state. `flashSubstrate/bridge.js` relays it to the host as the eventBus event `substrate:playClock` `{region, running}`, stamped with the bridge's active region.
- **Loops keeps the last one.** `loopState.notePlayClock` stores `{region, running}` only when the region's substrate declares `playClock`, so a substrate that never opted in (runner, bounce) cannot make its time free.
- **The gate.** `_timeDrainTick` skips a second in which the drained region's last report is `running: false`: no mana, and no `_summaryDrainSeconds`, so the recorded duration and Playback's price exclude it. Both branches are gated, live play and the Bot, so a bot-driven page reports through the same call (it drives the same input and the same states) and waiting between goals is free the same way.
- **Fail safe.** No report, a report for another region, or a malformed one leaves the drain charging. A `gameState:regionChanged` to any other region drops the report, so a revisit is charged until the page reports again.
- **Game time.** A report may carry `stats` (`setPlayClock(running, stats)`). When `stats.gameSeconds` is present (the visit's game seconds so far) the clock is a game-time clock: a tick charges the whole game seconds played since the last charge, whether the clock runs or not, and counts them into the recorded duration. A page that plays at 2× is charged 2 seconds per wall second, so the same play costs the same at any speed. A report that stops the clock settles at once, before the clear or the exit that follows can end the park, so a visit costs `floor(game seconds)`. A counter that goes back (the page configured again) starts a new count. Noiz2sa reports game time for its bot's speed setting ([noiz2sa.md](./noiz2sa.md)).

The channel is the bridge's existing iframe-to-host eventBus relay (`publishEventBus`, as omsi's `substrate:resourceDelta`). The alternative was a loops public function the panel polls each tick (the shape of `livePlayRegion()`/`botSolverRegion()`, which go the other way); a push keeps the drain synchronous and needs no host-side panel code.

## The Record flow

**Coarse substrates.** While parked on the block, loops observes each gate-allowed `user:locationCheck` and `loop:exploreCompleted` in that region (`observeParkedLiveAction`), charges it, and appends it to `_liveCaptureBuffer`. On a successful exit the buffer becomes the block interior; only annotations go to the store.

**Fine-grained substrates.** The substrate recorder never writes the store. It stashes its finished capture in a pull-once slot exposed as the registry entry's `takeLastRecording()`. Loops pulls the stash only when a Record block completes through its expected exit, saves it under the block's tag, and rewrites the interior.

**Summary substrates.** Loops observes live play as for a coarse substrate, and also counts the drain seconds and the explicitly costed actions. On a successful exit these become the `summary`, written to the store even if the visit moved no economy (the duration alone is a real recording). The departure is the exit the player actually crossed, falling back to the queued exit.

**Wrong exit, mana-out or loop reset discards the capture.** Loops clears its buffer and never pulls the stash; the next visit overwrites it.

The **coarse replacement** (`_applyCoarseReplacement`) rewrites the interior through `clearActionsAt` and `insertLocationCheckAt` / `insertCustomActionAt('explore')`, leaving boundary `regionMove`s alone so instance numbers do not change.

## The Playback flow

**Coarse substrates.** No store lookup. The generic executor runs the block's own interior, dispatching the same events live play produces (`loop:exploreCompleted`, `user:locationCheck`, `user:regionMove`), all with `fromLoop: true`.

**Fine-grained substrates.** Loops looks up the bound recording by tag, parks the queue, and calls the substrate controller's `replayActions(actions, { departureExitId, instant, recording })`. `recording` is the whole entry, so a substrate can refuse a stale recording before the first step (the maze does). Recordings exclude the departing move: the substrate replays the interior, then crosses `departureExitId` itself, and the parked block advances on the resulting region change, as in Manual. With no bound recording the block parks for live play.

**Summary substrates.** Loops looks up the bound summary and applies it at once (`_handleSummaryApplyEntry`): price it at the current XP level, spend the mana, refire the recorded checks, dispatch the recorded departure. The mana is spent first, and the apply stops if the park was released, because spending can trigger the depletion reset synchronously and the rest would then advance a block nobody paid for.

**Warning:** every event a replay or the executor emits must carry `fromLoop: true`. It marks the event as queue execution: the action gate lets it through and `gameState` does not treat it as performed play. Without it the gate blocks the queue's own dispatch.

### A replay bigger than one run

On a `requiresLoopMode` substrate a replay often costs more than one mana pool, and it does not survive the loop boundary: the host fires a real loop reset and `fireLoopResetTeleport` (in `resourceChannels`) teleports the player to the loop start, ending the replay. It continues through the **generic queue restart**: the reset moves the cursor to 0, the queue re-drives, routes back to the region, re-enters the Playback block and calls `replayActions` again.

That puts three requirements on every fine-grained substrate:

1. **Installing a replay must be idempotent.** `replayActions` is called again from the top with the same recording each run. It must land in the same state each time, not append or resume a half-consumed script.
2. **The recorded departure is the termination condition.** A replay that cannot resolve its departure must be refused, not started, or it drains the pool forever. (A departure whose gate is not open yet may park, like Manual.) A timeout teleport is not a substitute: it "completes" a replay that replayed nothing.
3. **The queue needs a route back from the reset target.** The restart re-drives from index 0, so the Playback block must be reachable from where the teleport lands. That routing is the queue's job.

On omsi a loop also ends when its own queue is exhausted, so every omsi departure is followed at once by a loop end and a teleport. See [omsi.md](./omsi.md).

## The Bot flow

A Bot block dispatches per action. The solver parks on one action (`_botExecutedAction` for `walkTo`, `_delegatedAction` for delegation); its completion resumes the frame loop, which re-enters the Bot branch for the next action.

A bot is not live play: `livePlayRegion()` returns null while a solver drives, and its events pass the action gate through the `queueExecution` exemption. Solver-driven publishes are deliberately not stamped `fromLoop`, so it stays clear which exemption carries them.

jta and omsi both use `walkTo` with `queueActions: ['regionMove']`, so their bots only handle exit walks. They differ across a loop reset: jta's bridge remembers the pending walk (`_pendingWalkExit`), so the park stays up; omsi's walk, driven by the fork's Advanced Automation planner, ends on the teleport and continues through the generic queue restart, the same contract as [a replay bigger than one run](#a-replay-bigger-than-one-run). See [jta.md](./jta.md) and [omsi.md](./omsi.md).

Noiz2sa's bot takes both `locationCheck` and `regionMove` targets, each its own run of the region: a location target plays the check run (the region's check span) to its clear, which checks the location while the player stays; an exit target plays the move run (the move span) to its clear and leaves by the target exit, on every visit, a region cleared before included. A hit restarts the run. Its proxy's `walkTo` carries the bot's settings as a second argument, which the flash bridge passes to the page. See [noiz2sa.md](./noiz2sa.md#the-bot).

### Bot economy

A bot costs what live play of the same content costs, by capture shape:

- **Fine-grained (jta, maze, omsi):** nothing is charged on completion. The substrate bills the play natively, so `_completeBotExecutedAction` charges only when the shape is not fine.
- **Summary (runner, bounce, noiz2sa):** priced by time. `_timeDrainTick` charges a bot-driven summary region exactly as it charges a live-play one (the two states are exclusive), and completion costs only what `loop_costs` names explicitly. Both go through `_chargeLiveAction`, so the spend awards region XP like any other.

**Warning:** a solver park runs no frames and does not set `_manualActionEntered`, so neither the frame loop's `_maybeResetForOOM` nor the mana wake notices a depletion. `_timeDrainTick` therefore calls `_maybeResetForOOM()` itself after charging on the bot branch. Any new spend that can fire while a solver drives needs the same check, or the pool runs negative.

## Resets

A wrong region change while a block is parked (a non-target exit, or the player taking the controls from a bot) pauses the queue until reset (`_queuePausedUntilReset`). A loop-reset teleport is different and must never be treated as a wrong exit.

### Two reset flows

`loopState._resetLoop()` (event `loopState:loopReset`) is loops' own mana-out reset. `gameState.triggerLoopReset()` (event `gameState:loopReset`) is the substrate-driven reset, the one real play on a `requiresLoopMode` substrate takes.

### Releasing a park on a reset

The two park kinds release differently:

| | Bot park | Manual / Record / Playback park |
|---|---|---|
| Set by | `_botExecutedAction` / `_delegatedAction` | `_manualActionEntered` (+ `_manualRegionName`) |
| Frame loop while parked | Dormant: `_animationFrameId` null, `isProcessing` still true | Stopped: the park calls `stopProcessing()`, so `isProcessing` is false |
| Released on a reset by | The bot wake's `fromReset` branch in `_handleBotWake_regionChanged`: `_stopBotExecutedAction()` + `_resumeFrameLoopIfProcessing()` | `_releaseParkForReset()`, run by the `gameState:loopReset` subscriber |

`_resumeFrameLoopIfProcessing` does nothing when `isProcessing` is false, so the Manual family needs its own path. `_releaseParkForReset()` discards any in-flight Record capture, clears `_manualActionEntered`, `_manualRegionName`, `_boundReplayCheckedIndex` and `_queuePausedUntilReset`, and calls `resumeProcessing()`. Clearing `_boundReplayCheckedIndex` matters: left stale, the retry would fall through to the generic executor and cross an exit it never replayed.

It runs from the reset subscriber, not the region-change wake, because `gameState.setCurrentRegion` publishes `regionChanged` only on an actual change: a block on the reset's target region would never see one. After either release the queue re-drives from index 0 and re-parks wherever the teleport left the player.

### `autoRestartQueue` governs the resets loops owns

`loopState.autoRestartQueue` is the "Auto-restart when queue complete" checkbox (default off). It decides whether the queue continues after a depletion reset, but only for resets loops owns. When a `requiresLoopMode` substrate resets its own game, the reset has already happened; refusing to resume would only leave the queue out of step with a game that has moved on.

| Reset | Reached from | Owner | Flag |
|-------|--------------|-------|------|
| Frame OOM: `_maybeResetForOOM` in `_processFrame` | Loops running generic timer actions | loops | Honoured: continue if on, pause if off |
| Drain-tick OOM: `_maybeResetForOOM` from `_timeDrainTick` | A Bot park on a summary substrate | loops | Honoured |
| Mana wake: `_handleManualWake_mana` → `_resetLoop()` | A Manual/Record live-play park | loops | Resumes if on (not in step mode); if off the queue stays stopped |
| Substrate reset: `gameState:loopReset` → `_releaseParkForReset` / the bot wake's `fromReset` branch | Any park on a `requiresLoopMode` substrate | the substrate | Ignored: always releases and resumes |

**Warning:** automated multi-run walks must set `autoRestartQueue` on. With the flag off, a mana-wake reset leaves the queue stopped with no park, `isPaused` false and `_queueCompleted` false, and only a player pressing Start recovers it. Every wake handler bails on the missing park, and on a gated substrate the closed step gate stops the game from ending a run, so the substrate reset that would resume the queue never fires. See [gotchas.md](./gotchas.md).

## Queue annotations — what a recorded visit cost

Loops is the only economy observer, so it records what each visit cost and yielded, for every queue-supporting substrate. A parked Record block runs a `BlockAnnotationTracker` for the visit; on a successful exit it builds:

```js
{ items: { 'jta/Food': { net: -2, min: -6 } }, xp: { net: 137.4 } }
```

This is stored as the entry's `annotations`.

- **Values are deltas from block start**, so an annotation stays meaningful when the block is replayed from a different inventory.
- **Tracked**: consumable items (including cross-substrate pool items) and XP. XP appears only in the tooltip. Mana is not tracked.
- **Item keys are namespaced** as `${owningSubstrate}/${itemType}`, so a grant into a substrate and that substrate's own use of the item share a key. Badges strip the namespace; the tooltip keeps it.
- **Gains are observed live** from `crossSubstrate:itemGranted`. **Consumption comes from the recording's `useItem` entries.**
- **The minimum is conservative.** The two sources share no clock, so the tracker assumes every spend came before any gain: `min = min(0, total consumed)`, shown as "needs ≥X at start". It can overstate but never understate.

`formatAnnotations` (kept apart from the DOM for testing) shows net deltas when nonzero and a minimum only when it went below zero; the tooltip carries XP and the full numbers. A discarded recording takes its annotations with it.

## The loop-mode interaction rules

- **Capture happens only in Record**, inserted at the block's position. Manual play has real effects but captures nothing. While loop mode is on, `gameState` does not append performed moves to the path, except for planning sources (`loopModeExemptions.js`).
- **Live play drains mana, in Manual and Record alike**, at the XP-adjusted `loop_costs` value, so recording a block costs what replaying it costs. Actions always perform immediately. Depletion fires the standard loop reset, which discards any capture in progress.
- **The strict action gate.** While loop mode is on, substrate actions are allowed only when the queue is parked for live play on the player's current region. Blocked actions get `loops:clickIgnored` feedback.

### The action gate

`loopState.evaluateActionGate({ kind, regionName, eventName, data })` is the single decision point. It returns `{ allowed, reason }`. It allows, in order:

| Reason | Condition |
|--------|-----------|
| `loopModeOff` | Loop mode is off |
| `fromLoop` | `data.fromLoop === true` (queue execution) |
| `fromReset` | `data.fromReset === true` (reset teleports) |
| `systemEvent` | The event name starts with `system:` |
| `planningSource` | `data.source` starts with `regionGraph`, `procgenPlayer` or `menuPanel` (`isLoopModePlanningSource`) |
| `queueExecution` | A solver is driving (`_delegatedAction` or `_botExecutedAction`) |
| `syntheticMove` | A move with no `exitName` — a reposition by a test harness or debug tool; every real substrate move carries its exit |
| `noRegion` / `apNative` | No region, or a region with no substrate |
| `substrateNotGated` | The substrate does not declare both `loopSupport.record` and `loopSupport.playback` |
| `parkedLivePlay` | `livePlayRegion()` is this region |

Otherwise it blocks with `hardPause`, `queueCompleted`, `emptyQueue`, `paused`, `wrongRegion` or `notStarted`.

Where the gate is consulted:

- `user:locationCheck`, `user:exitClicked` and `loop:exploreCompleted` are gated in the loops dispatcher receivers (`loopEvents.js`). Loops sits below discovery and gameState in the dispatcher chain, so blocking there blocks the whole effect.
- `user:regionMove` is gated in procgenPlayer's receiver through the loops public function `gateSubstrateAction`. procgenPlayer receives the move first, so only a check there stops the region switch.
- clickToQueue's `append` / `rebuildPath` modes turn a blocked click into planning; `off` blocks it with feedback.

**Which substrates are gated:** those that declare both `record` and `playback` — maze, text adventure, jta, omsi, runner and bounce. The flash-family entries (`flash`, `flash_seedling`, `flash_seedling_gen`) use the flash factory's manual-only `loopSupport` and are not gated.

## `requiresLoopMode` — loop-game substrates

Some substrates are loop games themselves: their native economy restarts from the beginning when a resource runs out, which is exactly the loop-mode reset teleport. They declare `loopSupport.requiresLoopMode` and are not supported outside loop mode; their coupling to the shared pool (energy or mana sync, reset propagation, the reset teleport) is part of the contract. jta and omsi declare it.

`eventCoordinator._handleSetLoopMode` enforces it: a user-initiated loop-mode disable is refused while a loaded world contains such a substrate (found by walking `procgenPlayer.getWarehouse()`). The preset auto-disable carries `auto: true` and is exempt; it only fires for presets without `loop_costs`, which never contain such a substrate. jta can still be played standalone through the separate `?mode=jta` page.

## Gotchas

- **Stash before the regionMove.** A fine-grained recorder must finish its stash before publishing the `user:regionMove`. Both cross the iframe boundary as ordered messages and loops pulls the stash when the move lands; if the move arrives first nothing is saved.
- **`loopState:queueUpdated` must carry `{ queue }`.** `eventCoordinator` passes it to `loopUI._updateRegionsInQueue`, which iterates it; an empty payload throws.
- **A blocked action can leave the substrate's own UI slightly ahead** (the text adventure prints its message first; maze tile moves emit no host events). The host state is authoritative.
- **A fine-grained replay needs its executor module enabled.** jta replays through `jtaQueueEngine`; if that module is not loaded, `getEngine()` returns null and the replay only crosses the exit, which looks like success from the queue. Enable such a module in every module config the substrate runs in, and test the replay's effects.
- **The mana wake owns depletion only for live-play parks.** Charging publishes `gameState:manaChanged` synchronously, and for a park with `_manualActionEntered` set `_handleManualWake_mana` runs the reset before the charging call returns. Substrate-side "depleted" checks then read the refilled pool and must not fire a second reset. Solver parks are the exception; see [Bot economy](#bot-economy).

## Related documentation

- [Substrate Registry Reference](./substrate-registry.md) — the `loopSupport` fields and the `takeLastRecording` hook
- [Playback and Debugging Tools](./playback-and-debugging.md) — the PlaybackController contract the replay path uses
- [Maze Substrate](./maze.md) — fine-grained recording, delegation, and recording preconditions
- [JtA Substrate](./jta.md) — fine-grained recording in the shared vocabulary; `requiresLoopMode`
- [Omsi Substrate](./omsi.md) — plan-snapshot recordings, the step gate, multi-run replays
- [Text Adventure Substrate](./text-adventure.md) — the coarse substrate
- [Runner Substrate](./runner.md) / [Bounce Substrate](./bounce.md) — the summary substrates
