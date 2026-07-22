# Loop Recording and Block Modes

How loop mode captures what a player does in a region and plays it back: the per-block **mode system** (Manual / Record / Playback, with Bot planned), the per-block **Instant** toggle, the **saved-recording store**, and the **capture contract** that decides whether the loops module or the substrate owns recording. Built across the M1–M3 sessions of the block-modes arc (2026-07-21/22); the capture contract below was settled 2026-07-22.

Code lives in `frontend/modules/loops/` (`blockIdentity.js`, `savedQueueStore.js`, the mode dispatch in `loopState.js`) plus per-substrate recorders where the contract calls for them (`mazeRoomUI.js`'s visit recorder; the text-adventure wrapper's `recorder.js`, slated for removal — see [Status](#status-and-planned-refactor)).

## Block modes

A **block** is one region visit in the loops queue — the run of interior entries between two boundary `regionMove`s. Every block resolves to a mode:

| Mode | Behavior |
|------|----------|
| **Manual** | The queue parks; the player drives the region by hand. A `user:regionMove` to the expected next region completes the segment; a wrong exit pauses the queue until reset. |
| **Record** | Manual, plus: the visit is captured, and on a *successful* exit the recording is persisted and the block's queued interior is rewritten to what the player actually did (the *coarse replacement*). Optionally auto-switches the block to Playback (schema-backed setting, default ON). |
| **Playback** | If a recording is bound to the block (tag lookup, below), the queue parks and replays it through the substrate. Otherwise falls through to the auto execution chain: substrate delegation → playback-bot `walkTo` (`executeVia`) → generic timer. |
| **Bot** *(planned, M6)* | Explicit solver-driven execution; until then Playback's fallback chain covers it. |

**Instant** is a separate per-block toggle (not a mode): a Playback block whose substrate declares `loopSupport.instant` drains its whole replay in one frame instead of animating per tick, and suppresses panel focus-stealing while it runs. The generic timer path honors it too.

Identity and resolution:

- The **mode map key is `(region, instanceNumber)`** — a stable, unique block identity (middle visits can't be deleted through the UI; only suffix truncation removes blocks). `blockIdentity.js`'s `resolveQueueBlocks` is the shared resolver both the renderer and execution key off; it exists because a leaving `regionMove`'s own `instanceNumber` names its *destination* block while it renders and drives from its *source* block.
- Mode precedence: explicit per-block choice → legacy `manualRegionStates` (migrated saves) → the `defaultBlockMode` setting (a `manual` default is capability-clamped so blocks that can't be hand-played never park).
- Radios only appear where the substrate's `loopSupport` capabilities allow: Record requires `record && playback`; Instant requires `instant`. See the [Substrate Registry Reference](./substrate-registry.md#loop-mode).

## Recordings and the saved-queue store

`savedQueueStore.js` persists recordings in localStorage, bucketed by `(rulesHash, substrate, region)`. Each entry is a `SavedQueue`: the substrate-native `actions` array, `arrivalExitId` / `departureExitId`, mana metadata (`manaAtEntry` / `manaAtExit` / `manaMin`), and checked-location bookkeeping.

A recording is bound to a block by its **persistent recording tag `(arrivalKey, ordinal)`** — distinct from the transient mode-map key. `arrivalKey` is the exit the player arrived through (`'entrance'` for the start region); `ordinal` counts blocks sharing the same `(region, arrivalKey)` pattern. Loops derives the tag on *both* the save and lookup side (`assignRecordingTags` against the live procgenPlayer warehouse), so recorder-side id drift can't desynchronize them. Saving is **replace-on-tag** (re-recording a block replaces its recording; never appends a same-tag duplicate), other-tag entries are kept as FIFO history with a per-region cap, and recordings **survive block deletion** — recreating a matching block auto-restores its recording via tag lookup.

### The Record flow (sole-persister protocol)

The substrate's recorder never writes the store. It **stashes** its finalized capture in a pull-once slot, exposed on the registry entry as `takeLastRecording()`. `loopState` pulls the stash **only when a Record-mode block completes through its expected exit**, then persists it under the block's tag and applies the coarse replacement. Consequences, by design:

- **Wrong exit, mana-out, or loop reset → the recording is discarded** — loops simply never pulls, and the next visit overwrites the stash. Discard is race-free because there is no revoke step.
- A player exiting a Record region **without the queue ever parking** (free-walk authoring) still triggers capture-and-persist (`_maybeCaptureUnparkedRecordExit`) — any player exit counts as correct when no parked expectation exists.

The **coarse replacement** (`_applyCoarseReplacement`) rewrites the block's queued interior — via `clearActionsAt` + `insertLocationCheckAt` / `insertCustomActionAt('explore')` — to the queue-grade actions the recording contains. Boundary `regionMove`s are type-filtered and untouched, so instance counts never churn. After a successful Record, *block interior ≡ recording's coarse projection* by construction.

### The Playback flow

On entering a Playback block, loops looks up the bound recording by tag; if found it parks the queue and calls the substrate controller's `replayActions(actions, { departureExitId, instant })`. The substrate replays the interior, then crosses the recorded departure itself — recordings deliberately **exclude** the departing move (maze slices it out of the queue capture; the text adventure records only interior commands), so the substrate issues the closing `user:regionMove` from `departureExitId` and the parked block advances on the resulting wake, exactly like Manual.

Replay-emitted events must carry **`fromLoop: true`** — the parked block already holds the queued entries, and `gameState`'s `updatePath` / `addLocationCheck` append duplicates for any non-`fromLoop` event. Both the maze and TA replay paths were bitten by this once (the "double-append" fixes); treat it as a contract.

## The capture contract: coarse-only vs. fine-grained substrates

Settled ruling (2026-07-22). Classify every substrate action:

- **Queue-grade**: player-meaningful, individually costed, worth a line in the block interior — `regionMove`, `locationCheck`, `explore`, and any future verb of the same weight ("pull lever", "talk to NPC"). The queue vocabulary is extensible here: `explore` is just a `customAction` entry, and the generic executor dispatches a generic event per action that interested modules consume.
- **Sub-queue-grade**: finer than a queue entry — the maze's per-tile `move`/`wait` inputs, where many make up one meaningful step and none belongs in the block interior.

The contract then has exactly two shapes:

| Substrate class | Capture | Replay | Recorder? |
|---|---|---|---|
| **Coarse-only** — every action is queue-grade (text adventure) | Loops owns it: the block's own queue entries *are* the recording | The generic executor runs the block's entries | **None** — no substrate recorder, no saved recordings |
| **Fine-grained** — has sub-queue-grade actions (maze) | One substrate recorder captures the **whole visit as a single interleaved stream**, coarse actions included | The substrate replays the fine stream (`replayActions`) | Yes — the coarse layer is a *projection*: loops filters the stream down to queue-grade entries for the interior |

Two rules fall out, and both exist to prevent real bug classes:

1. **Never two concurrent capture channels for one visit.** A "hybrid" where loops records the basic actions while the substrate separately records new ones has no shared clock to reconstruct interleaving from ("pull lever, *then* walk through the door") — the same two-writers problem behind the double-append fixes.
2. **Once a visit contains any fine action, the whole visit replays through the substrate.** Coarse entries can't go to the generic timer while fine ones go to the bridge mid-visit — ordering again.

Adding a queue-grade verb to a coarse-only substrate means extending the queue vocabulary (declare it in `loopSupport.queueActions`, cost it in `loop_costs`, teach the generic executor its dispatch) — not adding a recorder. A coarse-only substrate that later gains a genuinely sub-queue-grade action migrates wholesale to the fine-grained shape: flip the capability declaration and implement a maze-shaped full-visit recorder.

## Status and planned refactor

As built (M2/M3), the text adventure has its own recorder and replay queue (`recorder.js`, the `textAdventure:commandRecorded` side-channel, the replay half of `playbackBridge.js`) even though it is coarse-only — its recordings are redundant with the block interior by construction. The planned refactor removes that machinery and moves coarse capture into loops per the contract above: [`CC/docs/plans/loops-coarse-capture-plan.md`](../../../../CC/docs/plans/loops-coarse-capture-plan.md). Until it lands, the TA wrapper follows the fine-grained shape in code; the maze is the reference implementation either way.

## Gotchas

- **Stash before the regionMove.** A recorder that finalizes its stash on a *separate event* from the `user:regionMove` must publish/finalize it **before** the regionMove — both cross the iframe→host boundary as ordered postMessages, and the loops Record-exit wake pulls the stash when the regionMove lands. Publish the move first and the pull comes back empty: nothing persists, no auto-switch. (Bit the TA bridge; the maze finalizes first for the same reason.)
- **`fromLoop: true` on every replay-emitted event** — see the Playback flow above.
- **`loopState:queueUpdated` payloads must carry `{ queue }`** — `eventCoordinator._updateRegionsInQueue` iterates it; an empty `{}` throws.
- **Explore does not live-append.** During live play, `gameState` appends `locationCheck` and `regionMove` path entries instantly, but a performed explore only dispatches `loop:exploreCompleted` (consumed by discovery) — explore entries reach the queue via click-to-queue interception or Record's coarse replacement. The coarse-capture refactor must close this gap.
- **Parked-mid-queue live appends are unverified territory.** While a block is parked, a live check passes through to `gameState.addLocationCheck`, which appends at the *path end* — correct only when the parked block is last. Coarse replacement papers over the block interior; whether strays can accumulate after later blocks needs in-app verification (tracked in the refactor plan).

## Related documentation

- [Substrate Registry Reference](./substrate-registry.md) — the `loopSupport` capability fields and `takeLastRecording` hook
- [Playback and Debugging Tools](./playback-and-debugging.md) — the PlaybackController contract and iframe proxies the replay path rides on
- [Maze Substrate](./maze.md) — the reference fine-grained recording substrate
- [Text Adventure Substrate](./text-adventure.md) — the reference coarse-only substrate
