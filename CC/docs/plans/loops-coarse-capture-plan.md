# Loops coarse capture — remove the TA-internal recorder, loops owns coarse recording

**Status: IMPLEMENTED 2026-07-22 (Fable session 67 — M3b).** Design settled with the user 2026-07-22 (session 66/66b). As-built documentation: `docs/json/developer/procgen/loop-recording.md` (now describes the implemented model). Implementation notes vs. the plan:

- **Gate placement for `user:regionMove`:** the kickoff assumed a loops dispatcher receiver, but procgenPlayer receives the event at a HIGHER load priority and publishes the substrate `loadRegion` before loops could see it — so the gate predicate lives in loops (`evaluateActionGate`, exposed as the `gateSubstrateAction` public function) and **procgenPlayer consults it** at the top of its handler, swallowing blocked moves before any side effect. locationCheck / exitClicked / the new `loop:exploreCompleted` receiver gate inside loops as planned.
- **Staged enforcement (new decision, flagged for user review):** the gate + loops-side drain enforce only where the substrate declares `loopSupport.record && loopSupport.playback` — the block-mode-integrated substrates (maze + text adventure). Universal-now would have broken the shipped jta/omsi loop integrations and ~15 green in-app tests belonging to arcs the queue sequences AFTER M3b (M4 jta, M5 runner/bounce, omsi arc D); those arcs opt in by declaring the capabilities. The RULES remain substrate-universal in model and mechanism.
- **Maze drain (open question #5 resolved):** the maze did NOT natively drain during loop-mode hand play (`_shouldDeductMazeMana` returned false under loop mode) — the anticipated double-charge was actually an under-charge. Implemented: the maze's per-tile drain now also runs during parked live play (consulting loops' `livePlayRegion()`), and loops-side coarse charging exempts fine-grained substrates entirely (discriminator: `takeLastRecording` presence).
- **Exemption matrix additions found empirically:** (a) exit-less region moves (`exitName` null/absent) are exempt as synthetic repositions — the jta/omsi in-app harnesses (and debug tooling) reposition the player with bare `user:regionMove` publishes, and the omsi/jta test worlds contain maze filler regions the gate would otherwise trap the player in; every real substrate exit-crossing carries its exit. (b) The TA block-mode in-app tests now switch loop mode OFF on exit — nothing auto-disables it on preset switch, and a leaked active flag turned the gate loose on the flash/runner tests' non-loop `procgen_maze` world (loop-mode-leak-on-preset-switch is a pre-existing quirk, now user-visible under the gate; possible follow-up: auto-disable when a preset carries no loop_costs).
- **clickToQueue disposition (open question #3 resolved):** "gate first, then mode" — a gate-allowed parked click performs (live play); otherwise `append`/`rebuildPath` still author (planning is never blocked); `off` blocks with `loops:clickIgnored` feedback whose banner hints at the planning surfaces (open question #4's bootstrap UX).
- **Live-play depletion** is owned by the existing mana wake (`_handleManualWake_mana` → `_resetLoop`), which fires synchronously from `deductMana` — charging call sites must not add their own reset (documented in loop-recording.md gotchas).
- Phase A tests 1–3 were REWIRED to the new paths (1–2 drove the removed `replayActions`; 3 free-walked before parking, impossible under the gate) while keeping their observable assertions; #4 flipped to `enabled:true` and extended with the drain assertions. `locationCheckLoopModePassThrough` rewritten to the new contract (blocked unparked + allowed parked halves).
**Motivation / relationship to M3:** this arc IS the fix path for M3's failing close-out gate. M3 (Instant toggle) is CODE COMPLETE but its TA-side in-browser sanity legs (TA Playback double-append + Instant) never passed — the session-66 investigation into why the TA queue machinery misbehaves is what produced this plan. The user has ruled the manual sanity legs **too tedious to be the gate**: automated in-app tests replace them (see "Test-first" below). **The five unpushed M3 commits are HELD locally until M3b lands and the automated gates pass** (user decision 2026-07-22) — one combined push closes M3+M3b.
**Sequencing:** should land **before the block-modes M4 session's jta recorder half** — a jta recorder built against the old always-supply-a-recorder contract would be built against the wrong seam. See the queue doc §3b (`fable-to-opus-handoff-2026-07.md`).
**Contract reference:** `docs/json/developer/procgen/loop-recording.md` (the durable architecture page this plan implements).

## Decision

The text-adventure wrapper's internal recording machinery is removed; the loops module owns coarse capture and replay for coarse-only substrates. User-agreed 2026-07-22 after the session-66 investigation (below). The general contract this instantiates:

- **Coarse-only substrate** (every action is queue-grade — TA today): no recorder, no saved recordings. The block's own queue interior *is* the recording; loops captures it during Record and replays it with the generic executor.
- **Fine-grained substrate** (has sub-queue-grade actions — maze): supplies ONE full-visit recorder whose stream is a superset of the coarse actions; loops projects the coarse subset into the block interior; the substrate replays the fine stream.
- **Never two concurrent capture channels for one visit**, and once a visit has any fine action the whole visit replays through the substrate (interleaving/ordering — the double-append bug family).
- Future queue-grade verbs ("pull lever", "talk to NPC") extend the **queue vocabulary** (`customAction` + `loopSupport.queueActions` + `loop_costs` + a generic-executor dispatch), NOT the recording system. A coarse-only substrate that gains a genuinely sub-queue-grade action migrates wholesale to the maze shape (hybrid ruling, session 66 — settled, don't re-litigate).

## Session-66b rulings — Record-gated capture, drain, and the loop-mode action gate

Second round of user rulings, same session (2026-07-22) — settled, don't re-litigate. **All three rulings are substrate-universal** (user-confirmed): they define how loop mode works for *every* substrate — maze, jta, bounce, runner, omsi, flash — not just the text adventure. For fine-grained substrates the *capture channel* is still their recorder (per the contract), but the append-gating, drain, and gate rules below are the same loops-side rules everywhere; e.g. the maze's free-walk append (hand-walking in loop mode end-appending moves/checks via `gameState`) retires exactly like TA's. Downstream milestones (M4 jta, M5 runner/bounce, omsi arc D) must build against this model.

1. **Capture is Record-gated.** Performed substrate actions enter the loops queue ONLY when the active block is Record mode for the substrate+region the player is in. Manual play performs actions with real effects but captures and appends NOTHING. The current always-append behavior while loop mode is active (`gameState.updatePath` / `addLocationCheck` on any non-`fromLoop` event) is retired *for loop mode* — non-loop-mode path tracking is unchanged. Record inserts at the block position (`insertLocationCheckAt` / `insertCustomActionAt`), never at the path end.
2. **Live play drains mana — Manual AND Record** (AskUserQuestion: "Manual drains too"). Loops charges each observed action's `loop_costs` value (xp-adjusted) as it is performed, for any parked live-play block. Actions perform immediately — real checks, real region moves, real discovery; Record is live play + capture, never plan-only. Result: live play, Record, and Playback share ONE economy (recording a block costs what replaying it costs). Mana-out mid-Record still discards (M2 ruling).
3. **Strict action gate** (AskUserQuestion: "parked only"). While loop mode is active, the player may perform substrate actions ONLY when the queue is processing and parked on a Manual/Record block whose substrate+region match the player's current position. Not started, completed, empty queue, paused, or wrong-exit hard-pause → all substrate actions blocked. Applies to every substrate, not just TA.

**Consequences (by design):**
- **Free-walk authoring is retired.** Queue authoring = planning clicks (region graph / click-to-queue / block builder) + Record-mode interiors. With an empty queue no substrate action is possible in loop mode — the first block comes from planning.
- **M2's unparked Record capture (`_maybeCaptureUnparkedRecordExit` / `_blockPlayerJustLeft`) becomes dead code** — remove it in this refactor (free-walking can no longer happen).
- **Former open question #3 (parked-mid-queue stray appends) is RESOLVED BY DESIGN** — nothing end-appends in loop mode anymore; verify no other end-append path survives rather than probing stray behavior.
- **Former open question #1 (explore live-append gap) is subsumed** — explores are captured during Record via the loops-side observation like everything else, and deliberately NOT appended during Manual (nothing is).
- **Former open question #2 (replay economy) is RESOLVED** — one economy everywhere; the "bridge replay was free" discrepancy disappears with the bridge replay itself.

**Gate mechanics (recommended shape):** central loops-side interception — extend the existing clickToQueue dispatcher interception seam (`handleUserLocationCheckForLoops` and siblings) to swallow disallowed `user:*` actions and publish `loops:clickIgnored`-style feedback; optionally surface the blocked state visually later via the shared `substrateInactiveOverlay`. **Exempt from the gate:** `fromLoop`, `fromReset`, `system:*` events (substrate-internal / delegated execution), and bot/solver-driven dispatches — the queue's own execution must always pass. Planning-click surfaces (region graph, clickToQueue append/rebuildPath modes) are authoring, not performing — they must NOT be blocked; discriminate by `originator` (substrate panels set it; see bridge.js publishes).

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

**Remove (loops):** the unparked Record capture (`_maybeCaptureUnparkedRecordExit` / `_blockPlayerJustLeft`) — dead under the strict action gate — and the loop-mode always-append behavior in `gameState` event handling (non-loop-mode path tracking stays).

**Add (loops):** host-side observation during parked Manual/Record blocks (charges `loop_costs` for both; captures in Record — design below); the strict loop-mode action gate with its exemptions and blocked-click feedback; and a "coarse-only" path in the Playback entry: no recording lookup (or an always-miss), fall through to the generic timer over the block's own interior.

## Design sketch — loops-owned coarse capture

During a parked Manual/Record block, loops observes the same dispatcher/eventBus traffic it already sees:

- `locationCheck`: the `noteLocationChecked` seam already fires for every pass-through check while a manual-family segment is active — extend it (or a sibling) to charge the action and, in Record, append to a host-side capture buffer.
- `explore`: needs a new observation — a performed TA explore only dispatches `loop:exploreCompleted` today (consumed by discovery). Loops subscribes (or intercepts-and-passes), charges it, and records it while a Record block is parked.
- `regionMove`: the existing Record-exit wake (`_handleManualWake_regionMove`) already knows the departure — no substrate involvement needed; charge the move on the wake.

Per ruling 2 above, the observation layer charges `loop_costs` (xp-adjusted) for BOTH Manual and Record; per ruling 1, only Record captures. On successful exit, loops applies the capture directly via the existing `clearActionsAt` + `insertLocationCheckAt` / `insertCustomActionAt` coarse-replacement path (insert-at-block-position, NOT end-append). Record for a coarse-only substrate thus reduces to "Manual + interior rewrite from observed actions"; Playback reduces to the generic executor. Whether a `savedQueueStore` entry is still written for coarse-only substrates is **not needed** for replay (the queue persists the same information); recommend NOT writing one — one source of truth.

Substrates whose live play natively drains (maze per-step drain via `sharing.mana.loopActionDelegation`-adjacent wiring) must not be double-charged by the observation layer — the charging seam needs a per-substrate "natively drains" exemption, or the charge moves behind the same declaration. Resolve at implementation time against the maze's actual drain path.

Capability surface: coarse-only substrates keep declaring `record`/`playback`/`instant` (the radios still make sense to the user); the *implementation* branches on whether the registry entry supplies `takeLastRecording`/`replayActions`. Alternatively add an explicit `loopSupport.captureStyle: 'coarse' | 'fine'` — decide at implementation time; keep the registry doc in sync.

## Test-first: automated coverage replacing the manual sanity legs

**Work item 0 of the implementing session — written BEFORE the refactor.** User ruling (2026-07-22): manual in-browser sanity is too tedious to gate on; these behaviors get in-app automated tests. Harness facts: the substrates harness already drives the real TA iframe (`textAdventureWrapperTests.js` — real clicks, iframe postMessage dispatch, loop-mode cases) and the block-mode/loops wiring precedent is `mazeBlockModeTests.js` (registered via `testDiscovery.js` + a `test-substrates` config id — new tests must be added to that config or they never run). Use `eventually`/`pollForValue` helpers; refill mana before walks.

**Phase A — automate the M3 sanity legs against CURRENT code. ✅ IMPLEMENTED 2026-07-22 (Fable session 66)** — `frontend/modules/tests/testCases/taswBlockModeTests.js`, category "TA block modes", registered in `testDiscovery.js` + the substrates config. Results against current code:

1. `tasw-playback-no-double-append` — **GREEN.** Replays a recorded-visit shape (interior explore + `departureExitId`) through the wrapper PlaybackController under active loop mode; the region changes and the gameState path length stays constant. The M3 1/n `fromLoop` fix is now machine-verified.
2. `tasw-playback-instant` — **GREEN.** Six interior explores + departure with `instant: true` complete in one drain (asserted < 1200 ms vs. the ≥ 1750 ms per-tick pacing a non-instant replay needs), no path growth. The M3 Instant drain path is verified.
3. `tasw-record-coarse-autoswitch` — **GREEN.** Parks a real Record block (planned departure via `updatePath`, mode set via `setBlockMode`, `startProcessing` parks), performs live explore clicks in the engine, departs through the planned exit; the coarse replacement writes exactly the performed explores into the block interior and the block auto-switches to Playback. The parked-Record in-app flow works end-to-end.
4. `tasw-queue-integrity-parked` — **RED, as predicted — the stray-append symptom is CONFIRMED.** A location check performed while parked end-appends a path entry after the planned boundary regionMove (outside the parked block). Registered `enabled: false` in the substrates config with a KNOWN-RED comment so the suite stays green; **the M3b refactor must flip it to `enabled: true`** — it goes green by design once loop-mode end-appends are retired.

Implementation notes for the refactor session: the tests assert observable outcomes (queue shape, region changes, path length), not machinery — they must stay green through the refactor unchanged, except #4 which flips on. `resolveQueueBlocks` visit `actions` entries are wrappers `{ pathEntry, index, instanceNumber }`. Setup quirk: poll `gameState.isLoopModeActive`, not the `gameState:loopModeChanged` event — a prior test's active loop mode makes auto-enable a no-op that never fires the event. Worlds use an empty `obstaclePool` so no departure exit is rule-gated.

**Phase B — new behavior tests landing WITH the refactor:** the strict-gate allow/block matrix (one test per exemption: `fromLoop`, `fromReset`, `system:*`, solver/delegation, planning-click originator — plus one blocked case per disallowed state: not started / completed / empty queue / wrong-region); Manual drains + captures nothing; Record drains + captures; maze free-walk append retired. ⚠ The existing `locationCheckLoopModePassThrough` in-app test asserts the OLD contract ("location click checks immediately while loop mode is active") — under the strict gate that click is *blocked* unless parked on a matching Manual/Record block; the test must be rewritten to assert the new contract, not deleted.

## Open questions (verify during implementation)

*(Former #1 explore gap, #2 replay economy, and #3 stray appends are resolved by the session-66b rulings — see that section.)*

1. **`textAdventure:commandRecorded` ordering trap becomes moot** for TA (the stash-before-regionMove postMessage race, M2 11/n) — confirm no other consumer of the event exists before deleting it (session-66 grep: recorder.js was the only subscriber).
2. **Gate exemption matrix.** Enumerate every dispatch source that must bypass the strict action gate and assert each in tests: `fromLoop` replays, `fromReset` teleports, `system:*` substrate-internal events, delegation/solver-driven actions, and the planning-click surfaces (discriminated by `originator`). A missed exemption bricks queue execution; an over-broad one reopens free play.
3. **clickToQueue mode disposition.** The 'append'/'rebuildPath' interception modes are now the *primary* authoring path (free-walk is retired) but their current implementation also intercepts substrate-panel clicks. Decide whether they become planning-surface-only (region graph etc.) or keep intercepting substrate clicks as "plan instead of perform" — and make sure the pass-through 'off' default composes with the new gate (gate first, then mode).
4. **Empty-queue bootstrap UX.** Under the strict gate, a fresh loop-mode session cannot act in any substrate until a queue exists. Confirm the planning surfaces make this obvious enough in-app (blocked-click feedback should hint at it); an overlay/message affordance may be wanted — user-facing docs note it post-refactor.
5. **Native-drain double-charge exemption** (see the design sketch) — verify against the maze's real drain path.

## Gates

- vitest (loops + TA wrapper suites; recorder/replay tests removed or rewritten against the loops-side capture; new gate-exemption tests per open question #2), regression 1/1, substrates suite — including the M2 in-app leg `maze-record-playback-crosses-exit` (must stay green; maze path untouched apart from the gate) plus the Phase A + Phase B automated tests above. **The automated suite is the close-out gate for BOTH M3 and M3b** — manual in-browser checking is reduced to a short final visual confirm with the user (drain readouts, blocked-click feedback), not a correctness gate.
- On green: push everything — the five held M3 commits, the session-66 docs commits, and the M3b work — in one go.
