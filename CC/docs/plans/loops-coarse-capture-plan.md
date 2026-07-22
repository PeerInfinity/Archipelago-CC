# Loops coarse capture — remove the TA-internal recorder, loops owns coarse recording

**Status: PLANNED** (design settled with the user 2026-07-22, Fable session 66; not yet implemented).
**Sequencing:** should land **before the block-modes M4 session's jta recorder half** — a jta recorder built against the old always-supply-a-recorder contract would be built against the wrong seam. See the queue doc §3b (`fable-to-opus-handoff-2026-07.md`).
**Contract reference:** `docs/json/developer/procgen/loop-recording.md` (the durable architecture page this plan implements).

## Decision

The text-adventure wrapper's internal recording machinery is removed; the loops module owns coarse capture and replay for coarse-only substrates. User-agreed 2026-07-22 after the session-66 investigation (below). The general contract this instantiates:

- **Coarse-only substrate** (every action is queue-grade — TA today): no recorder, no saved recordings. The block's own queue interior *is* the recording; loops captures it during Record and replays it with the generic executor.
- **Fine-grained substrate** (has sub-queue-grade actions — maze): supplies ONE full-visit recorder whose stream is a superset of the coarse actions; loops projects the coarse subset into the block interior; the substrate replays the fine stream.
- **Never two concurrent capture channels for one visit**, and once a visit has any fine action the whole visit replays through the substrate (interleaving/ordering — the double-append bug family).
- Future queue-grade verbs ("pull lever", "talk to NPC") extend the **queue vocabulary** (`customAction` + `loopSupport.queueActions` + `loop_costs` + a generic-executor dispatch), NOT the recording system. A coarse-only substrate that gains a genuinely sub-queue-grade action migrates wholesale to the maze shape (hybrid ruling, session 66 — settled, don't re-litigate).

## Why (session-66 investigation findings)

For TA, the M2 recording is redundant by construction:

- The recorded vocabulary (`locationCheck`/`explore`) **equals** the coarse queue vocabulary; `departureExitId` duplicates the block's boundary regionMove's `exitUsed`; and `_applyCoarseReplacement` forces *recording interior ≡ block interior* after every successful Record.
- A Playback block **without** a bound recording already executes correctly via the generic timer — `loopState._applyActionEffects` dispatches the exact same three events the TA replay bridge dispatches (`loop:exploreCompleted`, `user:locationCheck fromLoop`, `user:regionMove fromLoop`; the Phase 6g comment names the TA substrate as a generic-path case).
- The recording's only extra data is mana metadata (`manaAtEntry/Min/Exit`), whose sole consumer is the customQueue dropdown label — disabled for TA (`customQueues: false`) — and which is likely degenerate for TA anyway (parked loop-mode play charges no TA mana: `mana.js` gates on loop-mode-off, and parked manual play is substrate-owned/free).
- The maze is NOT redundant: its recording holds per-tile `move`/`wait` inputs that never appear in the coarse queue. The recorder/replay machinery was built substrate-generic and TA is the degenerate case where fine = coarse.

## Scope

**Remove (TA wrapper):**
- `recorder.js` (+ its test) and the `startTextAdventureRecorder` wiring in `index.js`.
- The `textAdventure:commandRecorded` publishes in `bridge.js` (all three: move/examine/explore) + the event registrations.
- `takeLastRecording` from `textAdventureSubstrateWrapperLibrary.js`.
- The replay half of `playbackBridge.js` (`replayActions`, `_replayQueue`, `_replayTick`, `_replayOne`, `_issueDeparture`, `_stopReplay`) and `replayActions` from `playbackProxy.js` (+ affected tests).

**Keep (TA wrapper):** the `walkTo`/play/step/instant bot half of `playbackBridge.js`/`playbackProxy.js` (the playback bot rides it, independent of recordings), `mana.js`, all templating/discovery/procgen bridge logic.

**Keep (loops):** `savedQueueStore`, tags, `takeLastRecording` pull protocol, coarse replacement, `_handlePlaybackReplayEntry` — all still serve fine-grained substrates (maze now; jta if its recorder half lands in M4).

**Add (loops):** host-side coarse capture during Record blocks (design below), and a "coarse-only" path in the Playback entry: no recording lookup (or an always-miss), fall through to the generic timer over the block's own interior.

## Design sketch — loops-owned coarse capture

During a parked Record block, loops observes the same dispatcher/eventBus traffic it already sees:

- `locationCheck`: the `noteLocationChecked` seam already fires for every pass-through check while a manual-family segment is active — extend it (or a sibling) to append to a host-side capture buffer.
- `explore`: needs a new observation — a performed TA explore only dispatches `loop:exploreCompleted` today (consumed by discovery). Loops should subscribe (or intercept-and-pass) and record it while a Record block is parked. **This also closes the explore live-append gap** (see Open Questions #1).
- `regionMove`: the existing Record-exit wake (`_handleManualWake_regionMove`) already knows the departure — no substrate involvement needed.

On successful exit, loops applies the capture directly via the existing `clearActionsAt` + `insertLocationCheckAt` / `insertCustomActionAt` coarse-replacement path (insert-at-block-position, NOT end-append). Record for a coarse-only substrate thus reduces to "Manual + interior rewrite from observed actions"; Playback reduces to the generic executor. Whether a `savedQueueStore` entry is still written for coarse-only substrates is **not needed** for replay (the queue persists the same information); recommend NOT writing one — one source of truth.

Capability surface: coarse-only substrates keep declaring `record`/`playback`/`instant` (the radios still make sense to the user); the *implementation* branches on whether the registry entry supplies `takeLastRecording`/`replayActions`. Alternatively add an explicit `loopSupport.captureStyle: 'coarse' | 'fine'` — decide at implementation time; keep the registry doc in sync.

## Open questions (verify during implementation)

1. **Explore live-append gap.** Typed/clicked TA explores never enter the queue during live play (only `loop:exploreCompleted` fires; clickToQueue interception and coarse replacement are the only append paths). The unparked-Record capture path (`_maybeCaptureUnparkedRecordExit`, "a free-walked queue already reflects the performed actions") is therefore WRONG for explores today — a free-walked Record visit with explores persists a recording whose actions the queue doesn't hold. The loops-side explore observation should fix free-walk authoring too — decide whether explore appends always in loop mode, or only during Record.
2. **Replay-semantics shift.** Generic-timer execution differs from the removed bridge replay: pacing (cost-based progress × gameSpeed vs. fixed 4 Hz) and **mana** (the generic timer charges per-action `loop_costs`; the parked bridge replay was free). Recommendation: accept the generic-timer economy — Playback of a TA block should cost the same as any auto-run block — but confirm with the user if the observed behavior change is surprising in-app.
3. **Parked-mid-queue stray appends (pre-existing, in-app verification needed).** While a block is parked, a live check passes through to `gameState.addLocationCheck`, which pushes at the *path end* — correct only when the parked block is last. With later blocks queued, strays may accumulate at the end AND coarse replacement may duplicate them into the interior. Session-66 reading found no suppression mechanism; either one exists and should be documented, or this is a latent bug the refactor should fix (suppress end-appends while parked, or route them through insert-at-block).
4. **`textAdventure:commandRecorded` ordering trap becomes moot** for TA (the stash-before-regionMove postMessage race, M2 11/n) — confirm no other consumer of the event exists before deleting it (session-66 grep: recorder.js was the only subscriber).

## Gates

- vitest (loops + TA wrapper suites; recorder/replay tests removed or rewritten against the loops-side capture), regression 1/1, substrates suite — including the M2 in-app leg `maze-record-playback-crosses-exit` (must stay green; maze path untouched) and a NEW in-app leg for TA Record→Playback through the loops-owned path.
- In-browser sanity with the user: TA Record (parked + free-walk), auto-switch, Playback (timed + Instant), and open-question #3's stray-append probe.
