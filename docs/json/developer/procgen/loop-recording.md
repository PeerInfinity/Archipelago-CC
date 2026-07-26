# Loop Recording and Block Modes

How loop mode captures what a player does in a region and plays it back: the per-block **mode system** (Manual / Record / Playback / Bot), the per-block **Instant** toggle, the **saved-recording store**, the **capture contract** that decides whether the loops module or the substrate owns recording, the **queue annotations** describing what a recorded visit cost, and the **loop-mode interaction rules** (Record-gated capture, live-play drain, the strict action gate). Built across the M1–M5 sessions of the block-modes arc (2026-07-21/23); the capture contract and interaction rules were settled 2026-07-22 and implemented by the M3b coarse-capture refactor, M4 (2026-07-23) added jta as the second fine-grained substrate plus the annotations layer, and M5 (2026-07-23) added **summary** recording — a user-directed third capture category for runner and bounce, with the first live-play economy those substrates have had.

Code lives in `frontend/modules/loops/` (`blockIdentity.js`, `savedQueueStore.js`, `blockAnnotations.js`, `loopModeExemptions.js`, the mode dispatch + gate + observation layer in `loopState.js`, the panel affordances in `loopBlockBuilder.js`) plus per-substrate recorders where the contract calls for them (`mazeRoomUI.js`'s visit recorder, the jta wrapper's per-visit slice of the fork's performed-actions log, and the omsi wrapper's per-region plan snapshot — the three fine-grained substrates; the text adventure has none, being the coarse-only reference, and neither do runner and bounce, whose summary recordings are built entirely host-side). omsi joined in its arc D (2026-07-24/25), which also settled the [multi-run replay contract](#a-replay-bigger-than-one-run) and the reset-teleport release path both park kinds need.

## Block modes

A **block** is one region visit in the loops queue — the run of interior entries between two boundary `regionMove`s. Every block resolves to a mode:

| Mode | Behavior |
|------|----------|
| **Manual** | The queue parks; the player drives the region by hand (live play — drains mana, captures nothing). A `user:regionMove` to the expected next region completes the segment; a wrong exit pauses the queue until reset. |
| **Record** | Manual, plus: the visit is captured (by loops for coarse-only substrates, by the substrate recorder for fine-grained ones), and on a *successful* exit the block's queued interior is rewritten to what the player actually did (the *coarse replacement*; fine-grained substrates also persist the fine recording). Optionally auto-switches the block to Playback (schema-backed setting, default ON). |
| **Playback** | Fine-grained substrates: if a recording is bound to the block (tag lookup, below), the queue parks and replays it through the substrate; **with no bound recording the block parks for live play instead** (Manual behavior) — M4 ruling, and the radio is disabled in that state, so this is a safety net rather than a normal path. Coarse-only substrates never consult the store — the block's own interior *is* the recording and the generic executor runs it. |
| **Bot** *(M6)* | A **solver** plays the block live: the substrate walks to each queued target itself and the queue parks until it arrives. Offered only where the region has a solver (below). Needs no recording, and costs what live play of the same content costs. A wrong exit pauses until reset, same as Manual. |

**The solver and the Bot radio (M6).** "Solver" is the settled name for the inner per-action agent that drives a substrate to a queued target (the outer queue-builder is the "planner"). Two solver mechanisms exist, and a **Bot** block is the one trigger for both:

- **`walkTo`** — the substrate declares `loopSupport.executeVia: 'solver'` and exposes a PlaybackController with `walkTo`. loops parks on the action, dispatches `walkTo`, and completes it on the resulting `user:locationCheck` / `gameState:regionChanged`. jta, runner, and bounce.
- **`delegation`** — the registry entry declares `sharing.mana.loopActionDelegation` and the region has `manaEnabled`. The substrate panel walks the action tile-by-tile, charging natively, and publishes `loops:substrateActionCompleted`. The maze — and only the maze — because its controller's `walkTo` drives the *visualizer* (a separate position tracker), while delegation drives the charging panel engine. M6 unified the *trigger* and kept both drivers.

`loopState.regionSolver(region)` is the one resolver (`'walkTo'` | `'delegation'` | `null`), derived from those existing declarations — there is no new capability flag. A Bot block whose solver can't engage (no solver, controller unmounted, action type not in `queueActions`) **parks for live play with a loud `console.warn`**, never a silent generic-timer teleport through content the bot was meant to play. Bot is an explicit per-block choice: it does *not* join the `defaultBlockMode` enum, though it does join the set-all control.

Before M6 the two mechanisms had no explicit trigger — delegation fired from a pre-dispatch tick for any non-Manual block (which silently *shadowed* Record and Playback on delegation-capable maze regions, a latent bug), and `walkTo` was an unconditional fall-through at the tail of the frame dispatch. Both are now initiated only from the `blockMode === 'bot'` branch.

**Instant** is a separate per-block toggle (not a mode): a Playback or Bot block whose substrate declares `loopSupport.instant` drains its whole replay in one frame instead of animating per tick, and suppresses panel focus-stealing while it runs. The generic timer path honors it too. For a **Bot** block the checkbox appears only where the solver *actually honors* Instant (`loopState.regionBotHonorsInstant` — v1: the `walkTo` solver on a fine substrate, i.e. jta, whose `instant()` maps to the fork's `setInstantMode`). Summary bots (runner, bounce) play real-time physics with no instant variant; maze delegation is deferred (its `instant()` drives the visualizer, and a delegated walk is tracked through that same visualizer's per-tick change stream — the two-position-tracker split). Showing the box where it does nothing would be a vacuous control, so ruling 4 is satisfied per-capability, not per-declaration.

Identity and resolution:

- The **mode map key is `(region, instanceNumber)`** — a stable, unique block identity (middle visits can't be deleted through the UI; only suffix truncation removes blocks). `blockIdentity.js`'s `resolveQueueBlocks` is the shared resolver both the renderer and execution key off; it exists because a leaving `regionMove`'s own `instanceNumber` names its *destination* block while it renders and drives from its *source* block.
- Mode precedence: explicit per-block choice → legacy `manualRegionStates` (migrated saves) → the `defaultBlockMode` setting. The default is **Record** (M4; it was Playback through M3b): a fresh run live-plays each block once and, with auto-switch-to-Playback on, replays it thereafter. Defaults are capability-clamped — a `record` default falls back to **Manual** where the substrate can't record (Manual is the live-play mode, which is the point of the Record default), and Manual in turn falls back to Playback where the substrate can't park.
- **Playback is disabled until the block has playable content** (M4). Fine-grained: a recording bound in the store. Coarse-only: a non-empty block interior. A per-block **recording-exists indicator** in the mode row reports the same answer (`● recorded` / `○ not recorded`). The no-content behavior is Manual parking, so offering Playback would promise a replay the block cannot do — solver-driven execution is reachable only through the **Bot** radio (M6), never as a Playback fallback.
- Radios only appear where the substrate's `loopSupport` capabilities allow: Record requires `record && playback`; Instant requires `instant`. See the [Substrate Registry Reference](./substrate-registry.md#loop-mode).

## Recordings and the saved-queue store

`savedQueueStore.js` persists recordings in localStorage, bucketed by `(rulesHash, substrate, region)`. Each entry is a `SavedQueue`: the substrate-native `actions` array, `arrivalExitId` / `departureExitId`, the M4 `annotations` object, legacy mana metadata (`manaAtEntry` / `manaAtExit` / `manaMin`), and checked-location bookkeeping.

Since M4 the store is the **universal recording+metadata envelope**, not a fine-grained-only store. A coarse-only substrate gets an **actions-less** entry under the same tag holding annotations alone — its recording is still the block interior, and coarse Playback still never reads actions from the store. M5 added a second actions-less shape beside it: a **summary** entry, whose payload is the `summary` object. `hasPlayableRecording(entry)` (actions present and non-empty) is the guard on every read, so neither an annotations envelope nor a summary can bind to a fine-grained Playback block or count as "a recording exists"; `hasSummaryRecording(entry)` is the parallel guard for the summary category. Two consequences worth knowing: the duplicate check compares `annotations` and `summary` as well as actions (a coarse re-record always agrees on `actions: []` and a null departure, so without that its stale economy would survive forever), and `loopState.getBlockAnnotations()` — not the recording lookup — is what the panel reads, because coarse blocks have annotations but no playable recording.

A recording is bound to a block by its **persistent recording tag `(arrivalKey, ordinal)`** — distinct from the transient mode-map key. `arrivalKey` is the exit the player arrived through (`'entrance'` for the start region); `ordinal` counts blocks sharing the same `(region, arrivalKey)` pattern. Loops derives the tag on *both* the save and lookup side (`assignRecordingTags` against the live procgenPlayer warehouse), so recorder-side id drift can't desynchronize them. Saving is **replace-on-tag** (re-recording a block replaces its recording; never appends a same-tag duplicate), other-tag entries are kept as FIFO history with a per-region cap, and recordings **survive block deletion** — recreating a matching block auto-restores its recording via tag lookup.

### The Record flow

**Coarse-only substrates** (text adventure): loops itself observes the parked live play — every gate-allowed `user:locationCheck` / `loop:exploreCompleted` in the parked region is charged and appended to a host-side capture buffer (`_liveCaptureBuffer`). On a successful exit the buffer is written into the block interior via the coarse replacement and the auto-switch applies. Nothing touches `savedQueueStore`.

**Fine-grained substrates** (maze, jta, omsi) keep the M2 **sole-persister protocol**: the substrate's recorder never writes the store. It **stashes** its finalized full-visit capture in a pull-once slot, exposed on the registry entry as `takeLastRecording()`. `loopState` pulls the stash **only when a Record-mode block completes through its expected exit**, then persists it under the block's tag and applies the coarse replacement (the projection of the fine stream).

**Summary substrates** (runner, bounce): loops observes the same live play as for a coarse substrate — the performed checks feed the capture buffer and the interior rewrite — and additionally counts the **drain ticks** charged during the park and the actions that carried an explicit cost. On a successful exit those become the `summary` object, written to the store under the block's tag. Unlike the coarse annotations envelope, a summary is written even when the visit moved no economy at all: the duration alone is a real recording. The departure comes from the exit the player actually crossed (`gameState:regionChanged` carries `exitName` through from the originating `user:regionMove`), falling back to the queued exit.

Either way, **wrong exit, mana-out, or loop reset → the capture is discarded** — loops clears its buffer and never pulls the stash (the next visit overwrites it). Discard is race-free because there is no revoke step. Free-walk capture no longer exists: under the strict action gate a Record region cannot be played without the queue parking on it.

The **coarse replacement** (`_applyCoarseReplacement`) rewrites the block's queued interior — via `clearActionsAt` + `insertLocationCheckAt` / `insertCustomActionAt('explore')` — to the queue-grade actions the capture contains. Boundary `regionMove`s are type-filtered and untouched, so instance counts never churn. After a successful Record, *block interior ≡ the performed coarse actions* by construction.

### The Playback flow

**Coarse-only substrates**: no recording lookup at all — the generic executor runs the block's own interior, dispatching the same events live play produces (`loop:exploreCompleted`, `user:locationCheck` and `user:regionMove` with `fromLoop: true`). The per-block Instant flag drains it one action per frame.

**Fine-grained substrates**: on entering a Playback block, loops looks up the bound recording by tag; if found it parks the queue and calls the substrate controller's `replayActions(actions, { departureExitId, instant })`. If none is bound the block parks for live play instead of falling through to the auto chain (M4). The substrate replays the fine interior, then crosses the recorded departure itself — recordings deliberately **exclude** the departing move (maze slices it out of the queue capture), so the substrate issues the closing `user:regionMove` from `departureExitId` and the parked block advances on the resulting wake, exactly like Manual.

**Summary substrates**: loops looks up the bound summary by tag and applies it instantly — price the envelope at the current XP level, spend it, refire the recorded checks, dispatch the recorded departure. If none is bound the block parks for live play, joining the fine-grained rule above. The order is load-bearing: the mana is spent **first**, and the apply **aborts** if the park flag is gone, because spending can trip the depletion wake synchronously (refill + snap the queue to index 0) and the rest would then advance a block nobody paid for.

Replay-emitted events must carry **`fromLoop: true`** — they are queue execution, exempt from the strict action gate, and `gameState` must not treat them as performed play. Both the maze and TA replay paths were bitten by missing flags once (the "double-append" fixes); treat it as a contract.

#### A replay bigger than one run

The flow above reads as if a replay always fits inside the visit that started it. For a `requiresLoopMode` substrate it usually does **not** — a recording of more than one substantive action costs more than one pool — and the mechanism that carries it across is not the obvious one.

A native loop boundary does not stay inside the substrate. It is reported to the host, the host fires a real loop reset, and `fireLoopResetTeleport` teleports the player to the resolved start region — which reaches the substrate's bridge as a regionChanged-away and **ends the replay window**. So a multi-run replay continues **not by the window surviving** but by loops' **generic queue-restart retry**: the reset snaps the cursor to 0, the queue re-drives, routes back to the region, re-enters the Playback block, and calls `replayActions` again.

Three requirements fall out, and they bind **every** fine-grained substrate, not just the one they were discovered on:

1. **The install must be idempotent.** `replayActions` will be called again, from the top, with the same recording, however many times the replay outlives a run. Installing must land in the same state each time — not append, not double-count, not resume from a half-consumed script.
2. **The recorded departure is the termination condition.** A replay that cannot *resolve* a departure must be **refused, not started**: an open-ended grind with no way to end drains the shared pool forever, and it costs the player every run of it. (A replay whose departure exists but whose *gate* has not opened yet is a different case and may park indefinitely — that is Manual-equivalent. A timeout teleport is not an acceptable substitute for either: it "completes" a replay that replayed nothing.)
3. **The queue needs a route home from the reset target.** The retry re-drives from index 0, so the Playback block has to be reachable from wherever the teleport actually lands. A block whose only approach is a hop the player can no longer make cannot retry — the routing is the queue's concern, not the wake's, exactly as for a bot walk that teleported away.

The host half of this only started working in omsi arc D slice 4b: a substrate-driven reset used to leave the park behind, so the retry hung instead of re-driving. See the reset-teleport paragraph below and [gotchas](./gotchas.md#two-reset-flows-and-they-disagreed).

Worth stating for omsi specifically: a loop there also ends by **exhausting its queue**, and the departure is the queue's last entry — so *every* omsi departure, live or replayed, is followed within a tick by a native loop end, a run-end report and that teleport. Contract, not defect; see [omsi.md](./omsi.md#multi-run-replays-are-the-normal-case).

### The Bot flow (M6)

A Bot block dispatches per **action**: each solver parks on one action (`_botExecutedAction` for `walkTo`, `_delegatedAction` for delegation), and its completion resumes the frame loop, which re-enters the Bot branch for the block's next action. A bot is **not** live play — `livePlayRegion()` returns null while a solver drives — so its events pass the strict gate on the `queueExecution` exemption (`_delegatedAction || _botExecutedAction`), not `parkedLivePlay`. The bridges' `fromLoop`-less departures ride that exemption.

**No stamping, and that is a ruling rather than an omission.** `_botExecutedAction` grants the exemption *before* any `fromLoop` flag is consulted, so stamping a solver-driven publish would work by accident and hide which exemption is actually carrying it. jta set the precedent; omsi follows it (see [omsi.md](./omsi.md#no-ap-award-fires-under-a-bot-in-a-split-fixture) for how a leg pins the verdict when no AP location can fire to demonstrate it end to end).

Two substrates declare `executeVia: 'solver'` today and they solve very differently:

|  | **jta** | **omsi** |
|---|---|---|
| `queueActions` | `regionMove` | `regionMove` — so the Bot only ever handles **exit walks**; location-check actions fall through to normal handling |
| What drives the walk | the fork's automation, re-armed by the BRIDGE (it holds `_pendingWalkExit` across a same-region reload) | the fork's own **Advanced Automation planner**, engaged by the bridge and left to plan |
| Retry across a reset | the bridge's own memory — the park stays up and the resumed walk's events keep passing | the **generic queue-restart retry** below: the window closes on the teleport, the queue re-drives from index 0, routes back, and re-dispatches `walkTo` |
| Cost of one attempt | sub-second under Instant | **~12 s** — every fork loop end is a full host round trip, and omsi has no `instant` |

omsi's multi-run walk is therefore the same contract as [a replay bigger than one run](#a-replay-bigger-than-one-run), driven by a planner instead of a recording: the window does not survive the reset, the *queue* does. Anything waiting on an omsi bot must be sized against the round-trip rate, not against fork loops.

**Bot economy is one economy, by capture shape** — Bot execution costs what live play of the same content costs, and *which* charge that means follows the region's category, not the fact that a bot drove it:

- **Fine (jta, maze, omsi)**: nothing charged on completion. The substrate bills the same play natively — jta's energy drain mirrors into the pool, the maze charges per tile, omsi's per-tick mana mirror publishes every drain the fork takes — so `_completeBotExecutedAction` charges only when the shape is *not* fine. The flat completion charge that predates the summary/fine split double-billed a natively-charging substrate; dropping it is the fix.
- **Summary (runner, bounce)**: priced by TIME. The per-second drain runs while the bot plays (`_timeDrainTick` charges a solver-driven summary region exactly as it charges a parked live-play one — the two states are mutually exclusive, so a tick never charges twice), and the completion itself costs only what the `loop_costs` data names explicitly. Both route through `_chargeLiveAction`, so a bot's spend awards region XP 1:1 like every other spend.

The drain tick does **not** increment `_summaryDrainSeconds` on the bot path: that counter is Record-*capture* state (it becomes a saved visit's duration), and a Bot block records nothing.

**Reset-teleport semantics.** A wrong region change while a bot drives (an open non-target portal, the player grabbing the controls) hard-pauses the queue — the same wrong-exit guard Manual uses. A **loop-reset teleport is different and must never be treated as a wrong exit**. Getting that right takes a release path per *park kind*, on the right one of *two* reset flows, and the two are not symmetric:

|  | **Bot park** | **Manual / Record / Playback park** |
|---|---|---|
| Set by | `_botExecutedAction` / `_delegatedAction` | `_manualActionEntered` (+ `_manualRegionName`) |
| Frame loop | **dormant** — `_animationFrameId` null, `isProcessing` still **true** | **dead** — both park entries call `stopProcessing()`, so `isProcessing` is **false** |
| Released on a reset by | `_handleBotWake_regionChanged`'s `fromReset` branch: `_stopBotExecutedAction()` + `_resumeFrameLoopIfProcessing()` | `_releaseParkForReset()`, called from the `gameState:loopReset` subscriber |

That asymmetry is the trap. M6's cure for the bot park, `_resumeFrameLoopIfProcessing`, **bails on `!isProcessing`** — so it could never have released a Manual/Playback park, and the bug hid for a whole arc behind a fix that looked general.

The two reset flows are the other half. `loopState._resetLoop()` (`loopState:loopReset`) is loops' own mana-out reset; `gameState.triggerLoopReset()` (`gameState:loopReset`) is the **substrate-driven** one, and it is the flow real play on a `requiresLoopMode` substrate actually takes. That subscriber used to run `_resetActionsProgress()` (cursor → 0) alone, which left four pieces of park state behind a reset that had just teleported the player away. Since omsi arc D slice 4b it also runs **`_releaseParkForReset()`**: discard any in-flight Record capture (as `_resetLoop` already does), clear `_manualActionEntered` / `_manualRegionName`, clear `_boundReplayCheckedIndex` (stale, a retry would otherwise fall through to the generic executor and **silently cross an exit it never replayed** — worse than the hang), clear `_queuePausedUntilReset`, and `resumeProcessing()`. It lives on the **subscriber, not the manual wake's `fromReset` branch**, because `gameState.setCurrentRegion` publishes `regionChanged` only on an actual *change* — a block on the region the reset teleports *to* gets no `regionChanged` at all, and a wake-side fix would never fire. It runs before the teleport dispatch, which is safe because the resume schedules a rAF. The resume is **unconditional**, matching the M6 bot branch rather than `_maybeResetForOOM`'s `autoRestartQueue` check. That was left as a standing follow-up in slice 4b; it is now [ruled](#autorestartqueue-governs-the-resets-loops-owns).

Either way the point of resuming is the same: the queue re-drives from index 0 and re-parks wherever the teleport left the player — the **generic queue-restart retry**, which is the path a solver with no bridge memory relies on (see [jta.md](./jta.md#playback--bot-execution) for the contrast with jta's bridge-held pending walk) and the only way [a replay bigger than one run](#a-replay-bigger-than-one-run) continues at all. A multi-region walk or a block that teleported away additionally needs the queue routed back to the cursor's region (its own leading moves, or the caller) before the re-dispatch lands — that routing is the queue's concern, not the wake's. *(Any substrate whose native economy resets by teleporting to a start region hits this path: jta and omsi today.)*

#### `autoRestartQueue` governs the resets loops OWNS

*Ruled 2026-07-25, closing the slice-4b follow-up.* The question was whether the unconditional resumes above should honour the **"Auto-restart when queue complete"** checkbox (`loopState.autoRestartQueue`, default **off**), perhaps treating an in-flight replay or bot walk as implicit consent while honouring the flag for plain Manual parks.

**They should not, and the reason generalises.** A depletion reset has an owner. When *loops* owns the spend that emptied the pool, refusing to continue is a decision loops is entitled to make and the flag makes it. When a `requiresLoopMode` substrate resets its own game, loops has no such standing: the reset already happened, the fork already restarted, the player was already teleported. Declining to resume does not prevent anything — it only desynchronises the queue from a game that has moved on, and (because `livePlayRegion()` returns null while paused) makes the strict gate answer `paused` to the player's own hand-play in a region the substrate is still happily running.

The exemption also swallows its own rule. **Every** park kind spans runs by design on these substrates — Playback ([a replay bigger than one run](#a-replay-bigger-than-one-run)), Bot (omsi's walk is the same contract), and equally Manual and Record, because a ~350-mana omsi pool against a 250-mana `Wander` makes multi-run *hand* play the normal case too. Exempting "an in-flight replay or bot walk" leaves nothing behind for the flag to govern.

Mapping every depletion reset to its owner (which is also the honest answer to "why do these disagree?"):

| Reset | Reached from | Owner | Flag |
|---|---|---|---|
| Frame OOM — `_maybeResetForOOM` in `_processFrame` | no park; loops driving generic timer actions | loops | **honoured** — continue vs. explicit pause |
| Drain-tick OOM — `_maybeResetForOOM` from `_timeDrainTick` | a **Bot** park on a summary substrate (a solver park runs no frames, so this is the only spend that can notice) | loops (time *is* its billing) | **honoured** — pinned both ways in `blockModes.test.js` |
| Manual mana wake — `_handleManualWake_mana` → `_resetLoop()` | a **Manual/Record** live-play park, charged by `_chargeLiveAction` | loops | **honoured ON-only** — see below |
| Substrate reset — `gameState:loopReset` → `_releaseParkForReset` / the bot wake's `fromReset` branch | any park on a `requiresLoopMode` substrate | the **substrate** | **not loops' to veto** — unconditional release + resume |

So the two seams the follow-up named keep their unconditional resume, and the Bot resume was never uniformly unconditional in the first place: on a summary substrate the drain tick already pauses a bot walk when the flag is off.

**One gap the audit found, and closed.** The Manual-mana-wake row used to honour the flag in *neither* direction. `_handleManualWake_mana` called `_resetLoop()` and nothing else, and `_resetLoop` deliberately "does not modify pause state" — so the park's own `stopProcessing()` survived and the queue was left **stopped** (`isProcessing` false, `isPaused` false, cursor at 0), with the gate answering `notStarted`. Measured, not inferred: with `autoRestartQueue` forced **on**, hand-playing a Record block until the pool emptied still left the queue stopped. By the ownership rule that reset is loops' own, so the wake now resumes when the flag is on.

**ON direction only** (user 2026-07-25). Flag *off* keeps the stop it has always produced rather than becoming an explicit `isPaused` pause to match `_maybeResetForOOM`: that would change what every default-config player sees after a mana-out in hand-play, and stopped and paused both mean "press Start". Step mode is excluded for the same reason `_maybeResetForOOM` excludes it — the reset is the step's terminal event — and a user pause is excluded one level down by `_beginProcessing`. All three legs are pinned in `blockModes.test.js`, the ON one against a control that fails without the resume.

## Queue annotations — what a recorded visit cost

*All queue-supporting substrates, coarse and fine alike (M4, 2026-07-23).* Code: `blockAnnotations.js`; stored on the `SavedQueue` as `annotations`.

Post-M3b loops is the sole economy observer, so it is the only place that can say what a region visit **cost** and what it **yielded**. A parked Record block runs a tracker for the length of the visit; on a successful exit the tracker is built into:

```js
{ items: { 'jta/Food': { net: -2, min: -6 } }, xp: { net: 137.4 } }
```

Rules, all settled with the user:

- **Everything is a delta from block start, never an absolute.** The tracker is created empty at every park, so an annotation describes what *this visit* did and stays meaningful when the block is replayed from a different starting inventory.
- **The tracked resources are consumable items — including cross-substrate pool items — plus XP.** XP is tracked but never displayed as a badge (it appears in the detail tooltip). **Mana is deferred**: it is not part of the annotations layer yet.
- **Item identity is the D2 namespaced id `${owningSubstrate}/${itemType}`**, so a grant *into* a substrate and that substrate's own use of the same item fold into one key. Badges strip the namespace; the tooltip keeps it.
- **Collection is observed live** off the `crossSubstrate:itemGranted` notification bus (the owning substrate keeps the inventory; the host keeps no store). **Consumption comes out of the finalized recording's `useItem` entries.**
- **The minimum is conservative on purpose.** The two sources have no shared clock — reconstructing an interleaving from two channels is the bug family M3b's coarse-capture refactor exists to prevent — so the stored minimum is the *most conservative* interleaving: every spend before any gain, `min = min(0, total consumed)`. The UI renders it as "needs ≥X at start", which can then overstate but never understate what you need. If a substrate ever publishes live consumption on the same channel as grants, `BlockAnnotationTracker.build()` is the single place that changes.
- Annotations describe the **recording run**. Playback under different XP discounts drifts; minima are a feasibility estimate, not a measurement, and that is accepted.

**Display rule** (`formatAnnotations`, kept apart from the DOM so it is testable): show NET deltas whenever nonzero; show a minimum **only when it went below zero**; XP and the full per-item numbers ride in the row tooltip.

A discarded recording (wrong exit / mana-out / reset) takes its annotations with it — the tracker is cleared alongside the capture.

## The capture contract: coarse-only vs. fine-grained vs. summary substrates

Settled ruling (2026-07-22), **extended 2026-07-23 with a third category** (M5, user-directed — see "Summary substrates" below). Classify every substrate action:

- **Queue-grade**: player-meaningful, individually costed, worth a line in the block interior — `regionMove`, `locationCheck`, `explore`, and any future verb of the same weight ("pull lever", "talk to NPC"). The queue vocabulary is extensible here: `explore` is just a `customAction` entry, and the generic executor dispatches a generic event per action that interested modules consume.
- **Sub-queue-grade**: finer than a queue entry — the maze's per-tile `move`/`wait` inputs, where many make up one meaningful step and none belongs in the block interior.

The contract then has three shapes. The first two are discriminated **by whether the registry entry supplies `takeLastRecording`** (no separate declaration); the third declares itself with `loopSupport.summaryRecording`. One resolver, `loopState._captureShapeFor()`, answers `'fine' | 'summary' | 'coarse'` for every branch site, so a category can never fall into another's behavior by omission (a real recorder wins if a substrate somehow declares both):

| Substrate class | Capture | Replay | Live-play drain | Recorder? |
|---|---|---|---|---|
| **Coarse-only** — every action is queue-grade (text adventure) | Loops owns it: observed parked live actions are buffered and written into the block interior | The generic executor runs the block's entries | Loops charges each observed action's `loop_costs` value | **None** — no substrate recorder, no saved recordings |
| **Fine-grained** — the visit holds more than the block interior can say (maze, jta, omsi) | One substrate recorder captures the **whole visit**, coarse actions included — as a single interleaved stream for maze/jta, as a plan snapshot for omsi | The substrate replays it (`replayActions`) | The substrate charges natively at its own granularity (maze: per tile, gated on loops' `livePlayRegion()`; jta: the fork's energy drain, and omsi: the fork's mana budget, both mirrored into the pool by the bridge) | Yes — the coarse layer is a *projection*: loops filters the capture down to queue-grade entries for the interior |
| **Summary** — real-time play with no meaningful action stream (runner, bounce) | Loops owns it: the visit's **net result** — duration in drain seconds, performed checks, explicitly-costed actions, departure exit | Loops applies the envelope **instantly**: deduct the repriced mana, refire the checks, cross the departure. The game replays nothing | Loops charges a **per-second time drain**, plus any action cost the data names explicitly | **None** — the recording is a result, not a script |

**Recording vocabulary** differs between the fine-grained substrates and that is deliberate. The maze is grandfathered on its native `move`/`wait` vocabulary. jta (M4) converts at capture time to the **shared `actionQueue` vocabulary** (`clickTask` with `loops` = reps, `useItem` with `loops` = count) and replays through the shipped `jtaQueueEngine` executor — the option that generalizes. omsi (arc D) took exactly that dialect, so the prediction held. Converging the maze is optional and was explicitly not done in M4.

**A fine-grained recording need not be a performed-action log.** omsi is the case that shows it: the substrate *is* a queue-authoring game, so its recording is the region's **authored plan** (`actions.next`) at the moment of a successful Record exit, and Playback installs that plan and lets the game's own queue run it — no host-side executor exists or is needed. A performed log of an N-loop visit would just be that plan repeated N times. What makes a substrate fine-grained is mechanical and unchanged — it supplies `takeLastRecording`, so loops charges nothing and Playback routes through `replayActions` — but "capture the whole visit as one stream" is the *maze/jta* realisation of the contract, not the contract itself. See [omsi.md](./omsi.md#record--the-recording-is-a-plan-not-a-log).

Two rules fall out, and both exist to prevent real bug classes:

1. **Never two concurrent capture channels for one visit.** A "hybrid" where loops records the basic actions while the substrate separately records new ones has no shared clock to reconstruct interleaving from ("pull lever, *then* walk through the door") — the same two-writers problem behind the double-append fixes.
2. **Once a visit contains any fine action, the whole visit replays through the substrate.** Coarse entries can't go to the generic timer while fine ones go to the bridge mid-visit — ordering again.

### Summary substrates (M5, 2026-07-23)

Runner and bounce are neither coarse nor fine, and forcing them into either shape loses the thing that actually happened. Their play is *real-time*: an auto-runner holding right for four seconds produces no action stream worth replaying, and its queue-grade actions (the pickups it ran over, the portal it left by) are the *outcome*, not the recipe. So the user ruled a third category rather than a hybrid.

**Record** captures the visit's net result and stores it under the same `(region, arrivalKey, ordinal)` tag every other category uses, in the same universal envelope:

```
{ actions: [], annotations, departureExitId,
  summary: { durationSeconds, checks: [...], costedActions: [...] } }
```

`actions` is empty by design, so `hasPlayableRecording()` stays false — a summary must never bind to a fine-grained replay. `hasSummaryRecording()` is its parallel guard, and the entry's required field is `durationSeconds`, because that is what replay pricing multiplies. The block interior is still rewritten to the performed checks (queue readability, consistent with the maze/TA UX), but the interior is a *projection*: Playback ignores it and applies the envelope.

**The economy is TIME.** A per-second drain (`timeDrainPerSecond`, per region, default 1/s) is charged for every second the queue is parked on a summary substrate's Manual or Record block — the tick self-gates on `livePlayRegion()`, so idle, replaying, paused and hard-paused all cost nothing. Per-action costs apply **only where the loop_costs data names one explicitly**: the 50/100 fallbacks (and the sidecar-level `defaultRegionCost` / `defaultLocationCost` behind them) must never reach a summary action, or every visit is charged twice. Both cost generators cooperate — they emit `timeDrainPerSecond` for a summary region and leave its `moveCost` and its locations unset.

**Playback prices at replay time**, not at record time: recorded seconds × the region's *current* XP-discounted rate, plus the current price of each explicitly-costed recorded action. Storing seconds rather than a frozen mana number is what keeps region-XP growth meaningful for replays, and it matches how the generic executor prices a coarse replay.

Two consequences worth internalizing:

- **The game does not participate in Playback.** The player character stays wherever it is; loops refires the checks and dispatches the departure itself (both `fromLoop`). That is the design of the category, not a bug — a summary is a result, and a result can be applied without re-simulating anything.
- **The per-block Instant checkbox is hidden** for summary blocks: their Playback is inherently instant and a paced variant does not exist. `instant` stays *declared* on those substrates for the focus-suppression seam.

Runner and bounce do **not** declare `requiresLoopMode`. They are not loop games — no native "resource out → restart the run" economy exists (a runner death is a free in-iframe respawn) — so jta's loop-game contract flag would be cargo-cult.

Adding a queue-grade verb to a coarse-only substrate means extending the queue vocabulary (declare it in `loopSupport.queueActions`, cost it in `loop_costs`, teach the generic executor its dispatch) — not adding a recorder. A coarse-only substrate that later gains a genuinely sub-queue-grade action migrates wholesale to the fine-grained shape: flip the capability declaration and implement a maze-shaped full-visit recorder.

## The loop-mode interaction rules (as built, M3b)

The M3b refactor (2026-07-22) removed the text adventure's substrate-side recorder/replay machinery (`recorder.js`, the `textAdventure:commandRecorded` side-channel, the replay half of `playbackBridge.js`/`playbackProxy.js`) — the TA is now the reference coarse-only substrate — and implemented the three session-66b rulings. The rules are **substrate-universal** in model — they define how loop mode works for every substrate, coarse-only or fine-grained; only the capture channel and drain granularity differ per the contract above:

- **Capture is Record-gated.** Performed actions enter the queue only when the active block is Record for the player's current substrate+region — inserted at the block position, never end-appended. Manual play performs actions (real effects) but captures nothing; the always-append-while-loop-mode behavior is retired (`gameState`'s event handlers skip path appends whenever loop mode is active, except for planning-tagged sources — see `loops/loopModeExemptions.js`; non-loop-mode path tracking is unchanged). Free-walk authoring goes with it: planning clicks + Record interiors are the authoring path.
- **Live play drains mana — Manual and Record alike.** Each observed action is charged its `loop_costs` value (xp-adjusted) as it is performed, so live play, Record, and Playback share one economy (recording a block costs what replaying it costs). Loops does the charging for coarse-only substrates (`observeParkedLiveAction` for interior actions; the regionMove wake charges the departure); fine-grained substrates charge natively at their own granularity (the maze enables its per-tile drain during parked live play by consulting loops' `livePlayRegion()` public function). Actions always perform immediately — Record is live play plus capture, never plan-only. Depletion mid-live-play triggers the standard loop reset, which discards any in-progress capture.
- **Strict action gate.** While loop mode is active, substrate actions are only possible when the queue is parked on a Manual/Record block matching the player's substrate+region; everything else (not started, completed, empty queue, paused, wrong-exit hard-pause) is blocked with `loops:clickIgnored` feedback. The **exemption matrix** always passes: `fromLoop` (queue execution), `fromReset` (reset teleports), `system:*` events (substrate-internal), delegation/solver execution (`_delegatedAction` / `_botExecutedAction`), planning-tagged sources (`regionGraph-*`, `loops-costGenerator`, `procgenPlayer-start`), and **exit-less region moves** (a `user:regionMove` with no `exitName` is a synthetic reposition — test harness, debug tooling — not a player-performed exit crossing; every real substrate publish carries its exit). clickToQueue's `append`/`rebuildPath` planning modes still author blocked clicks ("gate first, then mode": a gate-allowed parked click performs; otherwise planning modes intercept; `off` blocks with feedback).

Implementation seams (`loopState.evaluateActionGate` is the single decision point):

- **`user:locationCheck` / `user:exitClicked` / `loop:exploreCompleted`** are gated in the loops dispatcher receivers (`loopEvents.js`) — loops sits below discovery/gameState in the chain, so a swallow blocks the whole effect. The `loop:exploreCompleted` receiver is new in M3b (loops also charges + captures allowed explores there before propagating to discovery).
- **`user:regionMove` is gated in procgenPlayer's receiver** (via the loops public function `gateSubstrateAction`), NOT in a loops receiver: procgenPlayer has a higher load priority — it receives the event first and publishes the substrate `loadRegion`, so only a consult there can block the move before the substrate visibly switches regions.
- **Enforcement is staged per substrate**: the gate (and loops-side charging) applies only where the substrate declares `loopSupport.record && loopSupport.playback` — maze and the text adventure since M3b, jta since M4, runner and bounce since M5, and omsi since its arc D slice 1. Only **flash** remains unadopted, and it is manual-only by design.

## `requiresLoopMode` — loop-game substrates

Some substrates are loop games in their own right: their native economy already has "run out of resource → restart from the beginning" baked in. Once their zones are mapped to host regions, a native reset **is** a host teleport-to-start — i.e. the loop-mode reset teleport. A "standalone" mode for such a substrate would reimplement loop mode under another name, and would leave the host path/queue semantics of a game-initiated region-5→region-0 yank undefined.

**User ruling (2026-07-23): such substrates are not supported outside loop mode**, and their always-on economy coupling (energy↔shared-pool sync, reset propagation, the reset teleport) is the documented CONTRACT rather than a bug. `loopSupport.requiresLoopMode` declares it. **jta and omsi both declare it today**; future loop-game substrates (Cavernous) adopt it as their arcs land. Non-loop substrates (maze, text adventure, runner, bounce, flash) are unaffected.

Enforcement is one guard rail at the single decision point `eventCoordinator._handleSetLoopMode`: a **user-initiated** loop-mode disable is refused while a requires-loop-mode world is loaded (detected by enumerating `procgenPlayer.getWarehouse()` and reading each region's substrate declaration). The preset auto-disable carries `auto: true` and is exempt — it only ever fires for a preset *without* `loop_costs`, which is never a requires-loop-mode world. Standalone play for jta remains available on the legacy `?mode=jta` stack; omsi has no such fallback (its regions only exist inside a procgen world), and every omsi preset carries `loop_costs`, so loop mode auto-enables for all of them.

## Gotchas

- **Stash before the regionMove** (fine-grained substrates). A recorder that finalizes its stash on a *separate event* from the `user:regionMove` must publish/finalize it **before** the regionMove — both cross the iframe→host boundary as ordered postMessages, and the loops Record-exit wake pulls the stash when the regionMove lands. Publish the move first and the pull comes back empty: nothing persists, no auto-switch. (The maze finalizes first for exactly this reason.)
- **`fromLoop: true` on every replay/executor-emitted event** — see the Playback flow above. Under the strict gate a missing flag doesn't just double-append; it gets the queue's own dispatch *blocked* as unparked live play.
- **`loopState:queueUpdated` payloads must carry `{ queue }`** — `eventCoordinator._updateRegionsInQueue` iterates it; an empty `{}` throws.
- **A blocked substrate action may leave the substrate's own UI slightly ahead** — e.g. the TA engine prints its flavor message before the host swallows the check, and a maze player can still walk interior tiles (tile moves emit no host events; only their coarse effects are gated). The host state is authoritative; a visual blocked-state overlay is a possible later affordance.
- **A fine-grained replay needs its executor MODULE loaded.** jta's replay runs through `jtaQueueEngine`, which was `enabled: false` in `modules.json` until 2026-07-23 — so `getEngine()` returned null and the replay path fell through to "cross the recorded exit anyway", turning Playback into a bare teleport that looked identical to a working replay from the queue's side. Unit tests stub the engine and cannot see this. The fallback now logs loudly; if you add a substrate whose replay depends on another module, enable it in every module config the substrate runs in and assert the replay's *effects*, not just its outcome.
- **A summary apply must spend BEFORE it acts, and check that it still can.** Same wake, sharper edge: `_handleSummaryApplyEntry` deducts first and returns if `_manualActionEntered` was cleared, because a depletion reset between the deduction and the departure would refire checks and cross an exit into a freshly reset loop.
- **An actions-less entry needs its payload in the duplicate check.** Coarse entries agree on `actions: []` and a null departure; summary entries agree on `actions: []` too. Both would therefore read as duplicates of their own stale predecessors, so `isDuplicate` compares `annotations` *and* `summary`. Any future actions-less category must join that comparison — for a summary the stale field is the recorded duration, which is exactly what Playback prices off.
- **Live-play depletion is owned by the mana wake — but only for parks that set `_manualActionEntered`.** Charging fires `gameState:manaChanged` synchronously; for a live-play park `_handleManualWake_mana` runs the loop reset (refill + discard) before the charging call site regains control — so substrate-side "depleted" checks read the refilled pool and must not fire a second reset. **The wake owns *only* those parks**: its first line is `if (!this._manualActionEntered) return`, and a **solver park sets neither that flag nor runs any frames** (`_maybeResetForOOM` never gets a turn). So a spend site that can fire while no frame is running — the summary Bot drain being the one such site (M6) — **must run its own OOM check after charging** (`_timeDrainTick` calls `_maybeResetForOOM()` on the bot branch), or the pool would run negative for as long as the bot keeps walking. This is the one deliberate exception to the "nothing after the deduct" rule, and it is scoped to exactly that path: the live-play branch of the same tick still returns immediately after its charge, where the wake does fire.

## Related documentation

- [Substrate Registry Reference](./substrate-registry.md) — the `loopSupport` capability fields and `takeLastRecording` hook
- [Playback and Debugging Tools](./playback-and-debugging.md) — the PlaybackController contract and iframe proxies the replay path rides on
- [Maze Substrate](./maze.md) — the reference fine-grained recording substrate
- [JtA Substrate](./jta.md) — the second fine-grained substrate; shared-vocabulary recordings and `requiresLoopMode`
- [Omsi Substrate](./omsi.md) — the third fine-grained substrate; plan-snapshot recordings, the step gate, and the multi-run replay retry
- [Text Adventure Substrate](./text-adventure.md) — the reference coarse-only substrate
- [Runner Substrate](./runner.md) / [Bounce Substrate](./bounce.md) — the two summary substrates
