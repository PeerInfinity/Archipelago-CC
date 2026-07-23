# Fable → Opus handoff — cross-arc queue (2026-07-11)

**Purpose.** Written at the Fable→Opus transition (originally "Fable access
ends ~2026-07-13"; superseded 2026-07-18 — Fable is now a standing 50% of the
weekly cap, so the queue's role is durable: Fable does design/rulings
sessions, Opus implements from the kickoff prompts queued here). During
2026-07-10/11 every active arc was either shipped or carried to a fully
ruled design; this document is the single ordered queue of what comes next,
with dependencies. Detail lives in the per-arc plan docs and memory topic
files — this doc is the map, not the territory.

**How to use.** Each section names its plan doc and memory topic. Plan docs
marked *(NewDocs)* live in the gitignored `NewDocs/` tree — not in git
history, but present in the working tree and available to Opus sessions.
Memory topic files hold the durable pointers. Standing convention: a NewDocs
plan moves to `CC/docs/plans/` when its implementation starts.

**Standing cross-cutting rules (apply to everything below):**
- **Intended-solution-first testing** (user ruling 2026-07-11): witness
  replay / bot completion are the hard gates; "no unintended solution" gets
  bounded budgets at calibration time only. See
  `feedback_intended_solution_first_testing` memory.
- **Every verification suite needs one independent stratum** (real saves,
  in-app tests, separate oracle) — a verifier sharing the generator's
  assumptions verifies nothing. See `feedback_verifier_shared_assumption`.
- **Byte-inert at defaults**: fork features ship default-off behind
  options; parity/determinism goldens must pass with everything at default.
- **Git discipline**: explicit staging only (never `git add -A`); commit
  submodule first, outer pointer bump in its own commit; push submodule
  branches BEFORE any outer push that bumps them; push only when asked.

---

## 1. Runner substrate — OR-lanes are the only remaining work

Status: coverage RESTORED. The test-strategy rebalance SHIPPED+PUSHED
2026-07-12, CI green (JavaScript Unit Tests 11m36s, whole slow battery under
the ~15–18 min target). runnerDemo suites are back in both vitest configs.

1. **~~Implement the test-strategy rebalance~~ — DONE 2026-07-12** (Opus; 5
   commits on `main`, pushed, CI green). Default suite is generation-free;
   heavy sweeps demoted to a manual `vitest.calib.config.js` tier
   (`npm run test:unit:calib`, not in CI); the **G1 preset bot-replay gate**
   (`presetBot.slow.test.js`, 9/9) replaced the retired matrix rows. G2
   stored-witness tapes were DEFERRED (optional; G1 subsumes most of the
   value; sidecar plumbing non-trivial). The redundant canRun "layered flood
   ⇔ full graph" loop was deleted (frozen corpus already covers it). Details:
   `project_runner_substrate` memory. Plan doc (now historical):
   `NewDocs/plans/procedural-platformer/runner-test-strategy-rebalance.md`.
2. **Then OR-route lanes O1–O5 — the remaining Runner work** — *(NewDocs)*
   `runner-or-lanes-step6-plan.md`. De-risked: the verify/emission stack
   handles OR today (experiment-confirmed); work is confined to
   planStripSpecsV2 + orGate grammar + integration. Verification follows the
   rebalanced doctrine (witness per disjunct = hard gate; lane exclusivity =
   bounded, calibration-time). Memory: `project_runner_substrate`.

## 2. World persistence across reloads (small, self-contained) — DONE + PUSHED 2026-07-14

**SHIPPED + PUSHED 2026-07-14 (Opus); on `main`, in `origin/main`.** Commits
P1 `ea876dd61` → P2 `0725ff0f3` → P1-fix+P3 verify `93919de76` → P4 `4e2c15df9`
→ opt-in default-OFF `6f550d722`. `scripts/procgen/verify-world-persistence-reload.mjs`
PASS 23/23 (re-run green 2026-07-15). Memory: `project_world_persistence_reload`.

Implemented P1–P4 of *(NewDocs)* `NewDocs/plans/world-persistence-reload-design.md`
(sessionStorage `apcc_lastWorld` riding the existing
`moduleSpecificConfig.rulesConfig` boot channel — deliberately NOT a new init
catch-up). **Two design corrections landed during implementation:** (1) the
setting `restoreLastWorld` shipped **default OFF / opt-in** (user ruling
2026-07-14), gating BOTH save and restore — not schema-default-on as the design
assumed; (2) the read-site moved from `stateManager.postInitialize` (that
branch is DEAD on a normal boot) to `modeDataLoader.loadCombinedModeData` — see
the memory's READ-SITE PLACEMENT CORRECTION. Acceptance covered: live reload
repro, the stale-path self-clear leg, inline + JtA substrate-reattach legs, and
`?reset=true` clears — all in the verify script. The `autoLoadMode`
boot-reader trap (`5fa4b4726`) was avoided by reading the gate raw via
`isRestoreLastWorldEnabled`.

## 3. JtA — post-v1 and retirement track

Phase 5 is COMPLETE (5a–5f + 5g raw-value/Fork 1.8 with all riders;
tick-for-tick triple equivalence green). Memory:
`project_jta_zone_randomization`.

1. **Post-v1 phases A→E** — `CC/docs/plans/jta-synthetic-post-v1-design.md`
   (moved into git 2026-07-12 when Phase A started), all 7 rulings accepted.
   **Phase A DONE + PUSHED 2026-07-12 (Opus): structure policy v2 (mirror/
   profiled), policy-gated id stride, C4 repair loop, skillCount add-only,
   sweep departure-batch modes. xp_mult co-solve lever stays UNBUILT (0
   floor-clamped milestone stalls on generated C4-clean worlds; 5f emergent
   gate PASS all).** Carry-forward data point: 5g reduced worst Pass-B
   saturation by an order of magnitude (1.1e4 vs 1.09e5) but did NOT eliminate
   it — the economy-scaling lever retains a residual case even on C4-clean
   linear worlds.
   **NEXT is RE-SEQUENCED (user 2026-07-12): stepped-spiral parity FIRST, then
   Phase B on the spiral pipeline.** Phase B wanted an editable dataset artifact
   on a pipeline envelope, but that machinery lives only in sphere-growth +
   top-down; JtA runs on the MONOLITHIC shuffled-spiral. So before Phase B,
   bring shuffled-spiral to stepped-pipeline parity (and dedup the shared
   orchestration across all three modes) — plan
   `CC/docs/plans/stepped-spiral-parity-plan.md`. Then Phase B's ②d "content"
   step lands on JtA's actual path and `generateZoneForSpecs`-into-sphere-growth
   becomes optional/deferred. The spiral-parity session stays JtA-agnostic
   (②d ships as a no-op for all current substrates); JtA dataset wiring + the
   four Phase-B gates are its Part 3, a later session.
2. **jtaActionQueue → substrate port** —
   `CC/docs/plans/jta-action-queue-port-plan.md`, all 10 rulings settled,
   zero fork changes v1. Feeds item 3.
3. **Phase 6 absorption audit** — parent plan §5 absorption map. Gates the
   old-March-stack retirement (deletion itself is a separate future change
   per standing ruling).
4. **Backlog (in `CC/docs/cleanup-backlog.md`):** ~~the presets-guard 300s
   zone-demo click budget is a coin flip under load — bump to ~450s~~ **DONE +
   PUSHED (`01bb80553`, 2026-07-11 — now `timeout: 450000`)**; the balance-walk
   solve-at-completion fix remains OPEN (own step + batch re-run — invalidates
   caches and committed measurement records, NOT a drive-by); task-256/z12
   filler stranding stays accepted-but-open unless a multiworld hardens the
   gate (measured remedy: `threshold_other_metric = RESETS`). Also still open
   and JtA-adjacent: `zoneCount:16` hand-sync assertion, `jtaCostDebugger`'s
   copied `JTACostPlanner`, and jta custom-queue recording
   (`loopSupport.customQueues`).
5. **Zone-concept reevaluation + region library — LANDED + PUSHED 2026-07-13
   (Opus); only F6b remains, parked.** Findings + plan in
   `CC/docs/plans/region-library-plan.md` + `region-library-f6-plan.md`
   (memory: `project_region_library`): "zone" = an *interface* (no
   tile-procedural hooks) conflated with a *content model* (finite ordered
   pool); only jta is genuinely pre-built; `synthesizeZonePayload`
   obsolete-leaning. **DONE + PUSHED, CI green:** the cleanup (C1–C3: absorbed
   synthesizeZonePayload, spiral onto the unified content-source seam, ②
   content generalization) plus the region-library feature (F1–F5: pre-built
   regions loadable from multi-file JSON, served-index + ad-hoc load,
   capture + validator tooling, hybrid persistence, panel UI — maze + bounce)
   AND sphere-growth reuse (F6a bounce, F6c runner + configurable-maze
   connection + registry-driven panel surfacing, F6d panel reachability). All
   byte-inert (dump-spiral 5/5, dump-sphere diff-clean); `verify-region-library-ui`
   38/38; bounce/runner/maze sphere + spiral Generate.py roundtrips green.
   **F6b (capability negotiation / physical gate enforcement of fixed captured
   entries) is RULED but PARKED until a concrete motivating example exists**
   (user 2026-07-14; candidate = per-library hostable-gate capability profile
   consulted by `canHost`). Also parked (plan §7): maze back-exit tile
   fidelity, exit-carve/true-tile-align, the auto-adjust-neighbours aspiration,
   and shared `zoneLibraryEntry` extraction (runner mirrors bounce today).

## 3b. Loops region-block modes (arc opened 2026-07-21 — GATES omsi arc D)

Memory: `project_loops_block_modes`. Design *(NewDocs)*
`NewDocs/plans/loops-region-block-modes-design.md` — rulings SETTLED with
the user 2026-07-21 (Fable session 61), don't re-litigate: four per-block
radio modes **Manual / Record / Playback / Bot** + a separate **Instant**
toggle (Playback/Bot only, capability-declared); mode is **per visit
instance** (per-region `manualRegionStates` ruled a bug); Record requires
Playback capability; recordings persist in `savedQueueStore` tagged
`(region, arrivalKey, ordinal)` with auto-restore on block re-creation;
recording becomes Record-mode-gated (today it's always-on); naming: outer
queue-builder = **planner**, inner per-task agent = **solver**
(`executeVia:'playbackBot'` renames in M6).

Phases (one Opus session each, design §5): **M1** mode core —
**✅ SHIPPED 2026-07-21 (Opus session 62, outer `96043df8a`)**; **M2**
Record + playback-of-recordings (maze+textAdventure) — **✅ CODE COMPLETE
2026-07-21 (Opus session 63; `cbf461238`→`da26a5b7d`→`10c5851a7`→
`c627e4e48`→`506a7c51c`)** (as-built below); **M3** Instant toggle +
activation-suppression seam — **✅ CODE COMPLETE 2026-07-22 (Opus session 65;
`1f38fbc56`→`bc5b02c43`→`477bad187`→`bac38f1d8`→`fd01e84f1`)**; **M3b**
coarse-capture refactor + the three loop-mode rules — **✅ IMPLEMENTED
2026-07-22 (Fable session 67; as-built notes below + in the plan doc);
closed M3+M3b in one combined push**; **M4** jta fine-grained recording +
instant pump + UNIVERSAL queue annotations — **DESIGN RULED 2026-07-23
(Fable session 68); KICKOFF READY:** *(NewDocs)*
`NewDocs/plans/loops-m4-jta-opus-kickoff.md`. jta CLASSIFIED FINE-GRAINED
(the fork performed-actions recorder is the stream; per-visit slice →
shared-actionQueue vocabulary → `takeLastRecording`; replay via the
jtaQueueEngine executor; fork stamps `zone_id` on item entries). Universal
half (all queue substrates): annotations = item deltas incl.
cross-substrate + per-resource minima, as DELTAS from block start, in
savedQueueStore as the universal envelope (coarse substrates get
actions-less tag-keyed entries); UI shows minima only below zero
("needs ≥X at start") and net deltas whenever nonzero; NEW
recording-exists indicator; Playback DISABLED without playable content
(fallback = MANUAL parking, "for now" — Bot radio still M6);
`defaultBlockMode` default flips to RECORD (enum currently lacks
'record'). Declaring `record`+`playback` opts jta into the strict gate —
restructure its free-travel flows/tests in the same arc (rulings detail:
memory `project_loops_block_modes` M4 block); **M5** runner/bounce (same
opt-in note; annotations arrive for free via the universal half);
**M6** solver unification + rename + Bot radio. Omsi arc D re-queues AFTER
this track (see §4); omsi Instant last of all.

**M3b as-built (session 67, Fable) — key facts for M4/M5/omsi-D (full
notes: plan doc implementation-notes block + memory
`project_loops_block_modes` + `docs/json/developer/procgen/loop-recording.md`
which now documents the implemented model):** the strict gate's single
decision point is `loopState.evaluateActionGate`; locationCheck /
exitClicked / the NEW `loop:exploreCompleted` receiver gate inside loops'
dispatcher receivers, but **`user:regionMove` is gated in procgenPlayer**
(higher load priority — it publishes the substrate loadRegion before loops
sees the event) via the loops public function `gateSubstrateAction`.
**Enforcement is STAGED on `loopSupport.record && playback`** (maze + TA
today) — turning it on universally would have broken the shipped jta/omsi
loop arcs and ~15 green in-app tests; integration arcs opt in by declaring
the capabilities (flagged for user review). Coarse-vs-fine discriminator =
`takeLastRecording` presence. Coarse-only (TA): loops charges observed
parked live actions + buffers Record captures → coarse replacement;
Playback = generic executor, no store lookups. Fine-grained (maze): M2
sole-persister path unchanged + NATIVE live drain (`_shouldDeductMazeMana`
consults loops' `livePlayRegion()`; the kickoff's "maze natively drains"
was wrong — loop-mode hand play was FREE pre-M3b). Exemption matrix:
fromLoop / fromReset / system:* / delegation+solver / planning sources
(`loops/loopModeExemptions.js`) / **exit-less moves** (synthetic harness
repositions). gameState's loop-mode event appends are retired (planning
sources excepted). Two adjacent fixes landed: loops' stale-cost-data
carryover on preset switch (cost data + loop mode now auto-track the
loaded preset — auto-DISABLE when a preset has no loop_costs) and
warn-level logs on gate blocks. Removed: TA recorder.js + commandRecorded
channel + playbackBridge/Proxy replay halves +
`_maybeCaptureUnparkedRecordExit`. Phase A tests 1–3 rewired to the new
paths, #4 (`tasw-queue-integrity-parked`) flipped ON and green;
`locationCheckLoopModePassThrough` rewritten to the gate contract
(blocked-unparked / allowed-parked halves).

**M2 as-built (see design §5 M2 + memory `project_loops_block_modes` for
full notes):** Key pivot (user-confirmed via AskUserQuestion, overriding the
kickoff's recon-3 recorder-gated seam): **loops is the SOLE persister** —
recorders STASH their capture (`takeLastRecording` on the substrate
registry), loopState PULLS only on a successful Record exit → wrong-exit /
mana-out DISCARD is race-free (never pulls), and recon-1's recorder↔queue
arrivalKey equality is NON-load-bearing (loops derives the
`(arrivalKey, ordinal)` tag via `assignRecordingTags` +
`procgenPlayer.getWarehouse()` on both save and auto-restore, stamping
`arrivalExitId := arrivalKey`). `savedQueueStore` gained `ordinal` +
replace-on-tag + `getSavedQueueByTag` (⚠ collapses maze's own
`_pickBestExit`/`_getReplayableTargets` multi-entry model — tests reseeded
with distinct ordinals; intended, recording is now Record-gated). Coarse
interior replacement landed with a PROVEN-SAFE reentrancy test (parked block
is `'idle'` not `'waiting'`, so eventCoordinator's pathUpdated auto-resume
never fires mid-mutation). textAdventure got a REAL wrapper-side
`replayActions` (proxy+bridge, ZERO engine-submodule edits) that issues the
closing regionMove via `departureExitId` (TA has no self-exit tile). Record
radio + auto-switch setting (default ON) both capability-gated on declared
`loopSupport.record`+`.playback`.

**Session-63 finish (`loopState.js` + `mazeRoomUI.js`, commits 6/n–10/n):**
fixed the M2 BLOCKER — maze Playback stopped one tile before the exit because
a maze recording captures only INTERIOR moves (the exit-crossing move is
excluded from `_finalizeVisitOnExit`'s slice, same as TA excluding its
departure); the kickoff's "maze self-exits" assumption was wrong. Maze
`_replaySavedActions` now takes `departureExitId` → `_crossRecordedDeparture`
after the interior replay drains. ⚠ **6/n first drove the VISUALIZER across
the exit — a double-walk/teleport bug (caught in in-browser sanity):** the
interior replay runs through the maze QUEUE (`_executeMoveAction` → PANEL
engine state), NOT the visualizer (separate position tracker still at the
entrance), so re-walking the visualizer restarted from the entrance and walked
the region twice. **10/n corrected it to ISSUE the transition DIRECTLY**
(mirroring TA's `_issueDeparture`): publish `user:regionMove {sourceRegion,
targetRegion, exitName, fromLoop:true}` from the exit's `targetRegion`, no
visualizer, no re-walk. `fromLoop:true` (updatePath appends forward moves, so
the parked block's queued regionMove-out would double). ⚠ TA's `_issueDeparture`
uses NO fromLoop — verify TA Playback doesn't double-append. Also: mode-based
unparked-capture unit tests; UI re-render on auto-switch
(`_persistRecordingForBlock` publishes `loopState:queueUpdated` — ⚠ payload
MUST carry `{queue}` or `_updateRegionsInQueue` throws; sanity-caught in 8/n,
also fixed the same latent empty-`{}` in `noteLocationChecked`); registered
loops as a `ui:activatePanel` publisher (9/n, sanity-caught warn); stripped
the 4 `[loops M2]` TEMP diag console.logs.

**Session-63 in-app leg (commit 7/n, updated 10/n):**
`maze-record-playback-crosses-exit` (`mazeBlockModeTests.js`, category "Maze
block modes", new `test-substrates` config id + `testDiscovery.js` import)
replays a recording carrying a `departureExitId` in a live maze region and
asserts the REGION CHANGES through the real substrate controller / dispatcher
/ gameState / procgen region load. Gates: **vitest 3174**, regression 1/1,
substrates **44/44** (warm; `jta-out-of-mana` cold-start flake → warm re-run).

**11/n (sanity-caught): TA Record didn't auto-switch to Playback.** The TA
bridge (`bridge.js` `command:move`) published `user:regionMove` BEFORE
`textAdventure:commandRecorded`; both cross the iframe→host boundary as ordered
postMessages, so the host ran the loops Record-exit wake (which PULLS the
recorder stash via `takeLastRecording`) before the recorder finalized it →
empty pull → `_persistRecordingForBlock` returns before the auto-switch. Fixed
by publishing `commandRecorded` first (maze finalizes its stash before the
regionMove for the same reason). ⚠ general trap: a recorder that stashes on a
separate event from the regionMove must finalize BEFORE the regionMove.
**M2 CLOSED: pushed through `dfbce4425` (11/n), verified session 64** — the
in-app leg `maze-record-playback-crosses-exit` landed WITH its
`test-substrates` config id; maze-side in-browser sanity happened live in
session 63 (fixes 8/9/10/11 were sanity-caught).

**M3 CODE COMPLETE 2026-07-22 (Opus session 65)** — the Instant toggle +
the carried-open TA double-append fix. Outer-only (arc-A). Commits
`1f38fbc56` (TA fromLoop fix, 1/n) → `bc5b02c43` (foundation) → `477bad187`
(seams) → `bac38f1d8` (replay wiring) → `fd01e84f1` (UI). Full as-built in
design §5 M3. Highlights: (1/n) `_replayOne` + `_issueDeparture` now publish
`fromLoop:true` — verified safe (addLocationCheck only pushes a PATH entry;
the real AP check rides the up-propagation; `noteLocationChecked` still runs;
the live `_performAction` bot/manual walkTo path stays flag-free). (2/n)
`loopSupport.instant` on maze+tasw; `blockInstantStates` map +
get/set/setAll/`_currentBlockIsInstant`/`_regionSupportsInstant`, serialized
truthy-only. (3/n) `isFocusLocked` locks while the running block is Instant;
generic timer instant-completes on `_currentBlockIsInstant()`. (4/n) both
loops replay callers pass `instant`; maze drains `_mazeQueue.stepOne()` to
idle then crosses; TA proxy forwards `instant`, bridge pumps `_replayTick()`
synchronously. (5/n) per-block Instant checkbox (Playback-only) + set-all
Instant select. Gates: **vitest 3191, regression 1/1, substrates 44/44**.
**⚠ M3 close-out REDEFINED (session 66, user):** the TA-side manual sanity
legs are what this arc's M3b investigation grew out of, and the user ruled
manual re-testing **too tedious to gate on** — the gate is the Phase A
automated in-app tests. **Phase A LANDED same session (Fable, session 66):**
`taswBlockModeTests.js`, category "TA block modes" —
`tasw-playback-no-double-append` **GREEN** (the M3 1/n fromLoop fix is
machine-verified), `tasw-playback-instant` **GREEN** (Instant drain
verified), `tasw-record-coarse-autoswitch` **GREEN** (parked Record →
coarse replacement → auto-switch works end-to-end in-app), and
`tasw-queue-integrity-parked` **RED — the stray-append symptom is
CONFIRMED** (a parked check end-appends outside the block; registered
`enabled:false` KNOWN-RED in the substrates config; **M3b must flip it
on** — it goes green by design). So M3's own fixes are verified; the
remaining defect is the pre-existing stray-append that M3b's rulings
eliminate. **The five M3 commits stay LOCAL until M3b lands; one combined
push closes M3+M3b** (user decision 2026-07-22).

**M3b — coarse-capture refactor (arc opened 2026-07-22, Fable session 66;
design SETTLED with the user, don't re-litigate). This arc IS the fix path
for M3's failing close-out gate** — the TA queue-machinery misbehavior the
M3 sanity legs were meant to catch is what triggered the investigation.
**Work item 0 (test-first Phase A) is ✅ DONE — session 66 wrote and ran
the four tests; see the M3 paragraph above. Kickoff READY:**
*(NewDocs)* `NewDocs/plans/loops-m3b-coarse-capture-opus-kickoff.md`
(verified anchors incl. the missing `user:regionMove` receiver +
sender-only `loop:exploreCompleted` gate seams, baselines, order of work,
combined-push instruction). The refactor session starts
from: keep tests 1–3 green through the refactor, flip #4 on (it's the
KNOWN-RED stray-append repro that the refactor fixes by design), then add
Phase B (gate matrix, drain, capture). Plan:
`CC/docs/plans/loops-coarse-capture-plan.md`; durable contract:
`docs/json/developer/procgen/loop-recording.md`. Ruling: the TA wrapper's
internal recorder/replay machinery (recorder.js, the
`textAdventure:commandRecorded` side-channel, the replay half of
playbackBridge/playbackProxy) is REMOVED — for a **coarse-only** substrate
(every action is queue-grade) loops owns capture (host-side observation
during parked Record + the existing insert-at-block coarse replacement) and
replay (the generic timer over the block's own interior; costs charged
normally). Only **fine-grained** substrates (maze; sub-queue-grade actions)
supply a recorder — ONE full-visit interleaved stream, loops projects the
coarse subset; NO dual-channel hybrids (ordering). Future queue-grade verbs
extend the queue vocabulary, not the recording system. **Sequencing: M3b
lands BEFORE M4's jta-recorder half** (don't build a jta recorder against
the old contract; classify jta coarse-vs-fine first). Three open questions
for the implementing session (details in the plan): the explore
live-append gap, the replay economy shift (generic timer charges
`loop_costs`; the bridge replay was free — recommended: accept), and the
UNVERIFIED parked-mid-queue stray-append behavior (in-app probe required;
possible latent pre-existing bug).

**M3b rulings round 2 (session 66b, same day — settled; ALL THREE
SUBSTRATE-UNIVERSAL, user-confirmed — maze/jta/bounce/runner/omsi/flash,
not just TA; maze free-walk append retires too; M4/M5/omsi-D build against
this model):** (1) **capture is
Record-gated** — performed substrate actions enter the queue ONLY when the
active block is Record for the matching substrate+region, inserted at the
block position; Manual performs with real effects but captures NOTHING; the
loop-mode always-append (`updatePath`/`addLocationCheck` on non-fromLoop
events) is RETIRED (non-loop path tracking unchanged). (2) **Manual AND
Record drain mana** (AskUserQuestion) — loops charges observed actions'
`loop_costs` as performed; one economy across live play / Record / Playback;
actions always perform immediately. (3) **STRICT action gate**
(AskUserQuestion: parked-only) — with loop mode active, substrate actions
are possible ONLY while the queue is processing AND parked on a matching
Manual/Record block; empty queue / not started / completed / paused /
hard-pause all BLOCK, every substrate. Consequences: free-walk authoring
RETIRED (planning clicks + Record interiors are the authoring path);
`_maybeCaptureUnparkedRecordExit` becomes dead code — remove; the three
session-66 open questions (explore gap, replay economy, stray appends) are
all RESOLVED BY DESIGN. New open items in the plan: gate exemption matrix
(fromLoop/fromReset/system:*/solver/planning-click originators — a missed
exemption bricks execution), clickToQueue mode disposition, empty-queue
bootstrap UX, native-drain double-charge exemption (maze).

**M1 as-built (see design §5 M1 for full notes):** Manual checkbox → per-
`(region, instanceNumber)` Manual/Playback radios; new shared resolver
`frontend/modules/loops/blockIdentity.js` (both renderer + loopState
execution key off it); `blockModeStates` map + `defaultBlockMode` setting +
set-all control; legacy `manualRegionStates` retained as lossless migration
fallback; `_handleCustomQueueEntry` `ui:activatePanel` now `isFocusLocked`-
gated. **Recon call (user-confirmed):** mode-map key is
`(region, instanceNumber)`, NOT the design's `(region, arrivalKey, ordinal)`
tag — instanceNumber is a stable unique block identity (middle visits can't
be deleted), and `arrivalKey` is only needed for **M2** recording-matching
(deriving it in M1 would risk a value M2's recorder won't match). So M2 owns
the `savedQueueStore` tag + arrivalKey derivation. Gates: vitest 3140 (+18),
regression pass, substrates 43/43 (documented `jta-out-of-mana` cold-start
flake cleared on re-run).

## 4. Omsi Loops — the one open design front

Memory: `project_omsi_loops_fork`. Plan docs *(NewDocs)* in
`NewDocs/plans/omsiloops/`.

1. **Scoring-horizon design pass (§11.5) — LANDED 2026-07-11 (session 8,
   fork `automation` @ `4174348`, pushed, CI green).** Shipped:
   `expGainMultiplier` (exp-only at the three engine funnels, byte-inert at
   1), snapshot-start resume (byte-exact; carries the knowledge table;
   runner `--gain-mult`/`--save-state`/`--from-state` + sidecar progress
   logs), travelRelief=3 + headroom=1 scoring terms (mana units, gated
   `pre.townsUnlocked.length > 1`), the **capacity-probe fix** (pump cost =
   Σ lastExec manaUsed, cushion-chunked interleaved harvest — the starved
   probe had been silently crippling expedition tails since M2), the
   Stats-panel Automation view (settings moved from Extras + live internals
   incl. Pools & ledgers), `AUTOMATION.md`, `plannerControlLootFirst`
   (plan/play consistency on the DOM-only searchToggler boxes), and harness
   `--metric loops|ticks|wall|weighted` (default stays loops — user
   ruling). All byte-gates green (v0 acceptance on all three trees,
   cross-checks loop+tick-exact, npm 25/25, UI smoke 23/23).
   **Round 7 key finding: the probe fix — not the scoring terms — was the
   lever.** At 1× (shared L500 donor) full design ≈ terms-zeroed control,
   both with sustained town-1 investment Round 6 never reached; the town-2
   wall STANDS at 1× L1200 (economy: 9k/loop toll vs bank-limited ~39k
   plateau). 10× melts on its own (L213; fixed tree L232 — the terms
   slightly hurt where frontier dominates); 100× has no wall at all (L85)
   and cannot discriminate designs.
   **Session 9 update (2026-07-12, Fable) — metrics resolved + speed
   infrastructure shipped (SUMMARY Rounds 8–11; plan §11.5/§11.6/§11.7 +
   memory all updated):**
   - **Success metric RESOLVED (user ruling): "track both, move on"** —
     loops stays primary, ticks/wall recorded beside it on every run; the
     disagreement hunt was NULL at the optimum (bankPot:8 = argmin under
     BOTH metrics, 484 / 5,099,270 — beats the shipped default
     −3.2%/−6.1%). Weight recalibration is thereby UNGATED.
   - **Wander-first human openings CLOSED as failure** (Round 8):
     exploration CONVERGES (every arm ends town 1 at Explored 100%,
     identical pools — the planner buys glasses L105 and explores 4x
     interleaved); user doctrine: no special-case openings. Talent
     residue devalued (every action gives talent; expMult ladder).
   - **bank:20 is a FIXATION HOLE** (Round 9): DNF at the 1200 cap
     between healthy neighbors (15→531, 30→500) — weight calibration is
     a ROBUSTNESS problem; sweeps must treat DNFs as first-class;
     candidate general mechanism = cap-triggered anti-fixation guard.
   - **Eval pool + screenMode SHIPPED** (fork `automation` @ `e3d4d89`,
     3 commits; Rounds 10–11): setEvalPool hook + confirmCandidate +
     per-phase instrumentation; `--pool N` worker_threads host; profiling
     OVERTURNED the standing assumption — the Koviko predictor screen was
     80–93% of planning wall, engine confirms 5–14%. **`--screen-mode
     engine` = the ITERATION regime** (~5x; full 1x runs ≈ 2.6 min;
     quality 514/5.95M vs reference 500/5.43M); `none` proved the K-CUT
     is the regularizer (reproduces Round 4 screenK:16 exactly).
     Gates/reference stay `predictor` (default, byte-inert — no
     re-baseline). 0 RNG throughout ⇒ every gap is a deterministic fact;
     there is no seed axis until AP randomization exists.

   **SEQUENCING RULING (user, 2026-07-12): ARCHITECTURE CHANGES FIRST,
   calibration LAST.** Weights are calibrated to a scoring vocabulary and
   candidate set; recalibrating before the vocabulary settles is
   throwaway work.
   **Session 10 status (2026-07-12, Fable): items 1–4 DONE (1–2 shipped,
   3–4 designed awaiting user review).** ① Census SHIPPED —
   `CC/scripts/omsi-stats/ACTION-CENSUS.md` + SUMMARY Round 12
   (`b32f9d33b`). ② Rep-gap tracker SHIPPED — fork `automation` @
   `2b79ceb` (`predictorRepGap` default-off; byte-gate PASS
   500/5,432,753/54506b48; npm 33/33). ③ bank:20 DIAGNOSED — SUMMARY
   Round 13 (`b8e627adf`) + plan §11.9 design: root cause = the
   capacity probe is STARVED at all [0] states (prevTimeNeeded 5250 in
   hole AND reference — the a39bc27 interleave is gated
   townsUnlocked>1) + rep-bank-capped h-ladder (h≤3 vs healthy h4–h6);
   proposed Part A (un-gate probe at [0] + optimistic h arm —
   RE-BASELINE items, fold into queue item 6 as its first change) and
   Part B (streak≥32/drought≥256 search-escalation guard; healthy max
   16/135 across all 11 traces — byte-inert by margin). ④ Vocabulary
   design in plan §11.8 (read-state extension → gate metadata → scored
   channels → `plannerVocabulary` option boundary). Unscheduled user
   idea recorded (plan §11.5 addendum): `rngMode: cycle` for the 4
   reward-path RNG sites.
   **RE-SCHEDULED QUEUE (user ruling 2026-07-12, later session 10 —
   §11.10 targeted mode SCHEDULED; supersedes items 5–6 ordering
   below):**
   1. **§11.8 pieces 1–2 — SHIPPED 2026-07-12 (Opus; fork `automation`
      @ `a27e384` piece 1 + `218264d` piece 2, outer `cb69c975a`
      omsi-stats harness; submodule pointer stays on substrate).**
      Piece 1: plReadState now emits buffs / soulstones{perStat,total} /
      goldInvested / trainingLimits / effectiveTime / stonesUsed /
      dungeon+trial state / per-town multipart ledgers (additive,
      JSON-plain) + a "Persistent resources" Stats-panel internals
      section. Piece 2: new `planner-metadata.js` gate table (transcribed
      from canStart, verified) + `plannerVocabulary: empirical|informed`
      option (default empirical = byte-exact); informed mode satisfies
      guild + repMax gates in measureAction (guild global set / rep
      clamped, applied in evalLoop after inject to baseline+full via the
      M1 prefix-baseline subtraction); read-state actions carry a static
      `gate` field for §11.10; declared-but-unsatisfied gates
      (soulstoneSac/talentFloor/buffFloor/trial-power/timeMax) are v2
      setup chains. Both pieces byte-inert: 500 / 5,432,753 /
      54506b48ec1758af (0 RNG, pool-8) at default vocabulary; npm 38/38
      (3 new: gate table + informed guild/negative-rep measurement).
      **§11.10 is now UNBLOCKED.**
   2. **§11.10 targeted mode v1 + priority list — T0–T4 ALL SHIPPED
      2026-07-13 (session 12; submodule `automation` e5b0bb6→48bd32e +
      outer harness commits, ALL PUSHED, fork CI green). Byte-inert every
      phase; npm 55/55; ui-smoke 33/33. T0 rulings: guild goals v2,
      Option X (`plannerStrategy`). HEADLINE bank:20 escape was DEFERRED at
      T4 — economy-walled, not scoring-walled (trigger fires, chain
      confirms dry at every bank level); the fix, Part A, was pulled
      forward and has since SHIPPED — the gate now PASSES (item 3 below).
      Results: plan §12–13 + SUMMARY Round 14.** Original brief: *(NewDocs)*
      `NewDocs/plans/omsiloops/omsi-loops-targeted-mode-plan.md` (memory
      `project_omsi_loops_fork` is the durable pointer). Generalize the
      one hand-wired chain (buildPushes→routeTo→resolveRouteGrantors→
      buildEconomy) into a generic within-loop backward regression over
      the already-measured graph. **USER RULINGS:** (a) DISTINCT MODE +
      FALLBACK (targeted strategy regresses the ordered list, installs
      best achievable chain, falls back to heuristic when nothing
      achievable — not additive, not trigger-only); (b) USER-AUTHORED
      priority list + an AUTO-RANK toggle; (c) goal vocab = action goals
      (make blocked-but-unlocked action executable) AND target-value
      goals ("reach V of resource/buff/soulstone" = fill loop with the
      max-ΔR providers; V tracked across rounds on the piece-1 read
      state). Plan phases T0(de-risk)→T4; each byte-inert-gated; headline
      gate = ESCAPE the bank:20 hole. Flags 3 dependencies (buff/soulstone
      goals need a read-state-Δ measurement extension; guild action-goals
      need an in-real-loop rank join — T0 decides v1-vs-v2; rep-sinks
      discovered from profiles). Stagnation trigger (§11.9 Part B's
      counters, healthy≤16 streak/135 drought vs hole 617) survives as
      the auto-entry hook; its blind escalation is SUPERSEDED; §11.6's
      ordered-priority idea ABSORBED. Multi-loop setup chains = v2.
      **AMENDED 2026-07-13 (user-approved rulings 4–6, in the plan doc):**
      (d) per-goal fractional SLACK BUDGETS on target-value goals
      (running remaining-budget counter, leftover cascades; makes the
      list concurrent, not lexicographic; auto-rank assigns none in v1;
      marginal-value stopping REJECTED = calibration); (e) RESIDUAL
      HANDOFF — leftover budget goes to the heuristic grind/frontier
      filler (full fallback = the 0%-consumed degenerate case); (f)
      terminal targets must PERSIST across loop reset — gold/rep/mana
      are instrumental only; valid targets = the piece-1 persistent
      read-state fields. Plus: greedy fill consumes through limitedPools
      exhaustion; later goals costed incrementally (shared prefixes
      deduped); §6 escalation ignores budgets + user list.
   3. **§11.9 Part A — SHIPPED 2026-07-13 (Opus, session 13; A1 only).**
      Un-gated the town-0 [0] capacity probe (A1); the deliberate
      byte-reference re-freeze (the first since v0) landed: **500 /
      5,432,753 / `54506b48ec1758af` → 535 / 5,965,890 /
      `e23f020400162f9a`**. HARD GATE MET — `--weights bank:20` escapes
      town 1 at loop 538 (was DNF@1200), under the **plain heuristic**, so
      `plannerAntiFixation` stays OFF. The optimistic h arm (A2) was
      DROPPED: A1-only == A1+A2 byte-for-byte on both the healthy default
      and bank:20, so A2 is inert on top of A1 (rationale falsified). The
      +35-loop healthy regression was accepted as the price of the gate fix
      (user ruling). Detail: SUMMARY Round 15, multitown §11.9 banner,
      targeted-mode §13. **Remaining Part-A follow-on** = re-freeze the two
      weight-sweep cross-checks (frontier:1000, bank:10), which now folds
      into item 5 (calibration re-baseline).
   4. **Vocabulary extension (original-queue item ④) — ALL 5 PHASES
      W0–W4 SHIPPED 2026-07-13 (Opus, session 15), byte-inert vs the
      Part-A reference 535 / 5,965,890 / e23f020400162f9a / 0 RNG.**
      Submodule `automation` W0 `501e573` (rngMode random|cycle), W1
      `f289007` (Layer E: consumes/crossTown/persistentDelta widening),
      W2 `ac8f62c` (Layer M: planner-metadata.js dimEffects+context +
      metadata-census guard = the independent stratum reading CODE), W3
      `868c757` (Layer P: probeEdges two-snapshot generalized
      travelRelief behind `informed`; edgeRates). Outer `ab3ad75f6` =
      run-planner.mjs `--coverage` report (results/vocabulary-coverage.json,
      the item-5 handshake) + `--rng-mode`. Pointer LEFT on the substrate
      pin `531faa3`; NOT pushed. npm 78/78. **DEVIATION: multipart
      segmentRate LIVE measurement is v2** (census 2.4 — Fight Monsters
      measures exec=0 in a single-loop probe at every Combat level; the
      Combat→multipart edge is DECLARED + coverage-reported, measureEdge
      returns null gracefully). HARD BOUNDARY held — data channels +
      coverage only, no scoring/weights (that's item 6). Plan §11 =
      implementation detail; memory [[project_omsi_loops_fork]] session 15.
   5. **Assist-ladder rung 3 — SHIPPED 2026-07-13 (Opus); REDEFINED by the
      user mid-build into a BUY MANA / zone-1 ECONOMY OPTIMISER** (NOT a
      general rearranger — removing unnecessary Buy Mana actions IS the
      expected result; reorder / remove / split+insert / merge / reserve-gold).
      `IdlePlanner.optimizeEconomy`; options `economyOptimizer` +
      `economyOptimizerAuto` (both default OFF); byte-inert vs 535. Submodule
      `automation` L1 `ef32a7b` + L2 `169cfaf` (COMMITTED, NOT pushed; pointer
      stays on substrate pin `531faa3`); L0 `48813d73d` + `--balance`
      `68c205175`. Objective (reserved decision 1, resolved empirically): unmet
      non-converter reps, then `unconvertedGold·rate + converter mana`.
      **Rung 2 (auto-add newly-unlocked reps) SHIPPED 2026-07-14** (Opus,
      session 17 — see item 7 below). Detail in *(NewDocs)*
      `omsi-loops-ladder-rungs-plan.md` §4b/§4c + memory sessions 16/17. **Tail
      trim still FOLDED INTO item 6** (ticks-gated). **§11.7 Design B — live
      no-pause pipelining + replanEvery reuse — SHIPPED 2026-07-14 (Opus,
      session 19): `plannerPipeline` (opt-in) plays the committed queue while the
      worker plans from the PREDICTED boundary and swaps at the boundary iff a
      state-hash still matches; `plannerReplanEvery` reuses a plan for K loops
      (shared live + headless). Measured headless K=3 = −63% wall for +8% loops
      (K=2 = −41% / +14%) — REFUTES the old "headless can't benefit" claim (win =
      planning less often). Byte-inert at defaults (byte-gate re-verified); npm
      95/95; ui-smoke ALL PASS incl. a live soft-lock guard. Reserved-thread
      headless pipeline (user idea #2) DEFERRED. Detail in memory session 19.**
   6. **DONE 2026-07-16 (Fable, session 28) — THE §4.1 QUEUE IS COMPLETE.**
      The whole bundle shipped: §11.8 piece 3 scored channels (fork
      `8b6eb61` + `270ebd0` — the efficiency channel was REWRITTEN onto
      the measured W3 edge-rate ledger after the planned state-delta
      formulation proved structurally wrong: base stats reset every
      restart(); ALL five channels ship at 0 — zero town-0 signal, they
      calibrate when town-2+ arcs run); DNF-aware sweep driver
      `CC/scripts/omsi-stats/sweep-planner.mjs` (`c46a48b0f`; END-anchored
      streak/drought fixation classifier — the §11.9 healthy-≤16 datum is
      pre-Part-A, post-A1 holes are counters OPEN at the cap 311–635 vs
      healthy ends ≤50); DEFAULT_WEIGHTS recalibration (fork `ce6ea89`:
      bank 30→45, bankPot 15→8 — target beaten: **461 loops / 5,195,188
      ticks / `9d9952e68bc8373c`**, −13.8%/−12.9%, twice-run byte-stable;
      bankPot:8 datum CONFIRMED as half the winner); cross-checks
      re-frozen (frontier:1000 → 513/6,582,103/86de5c16e23698c2; bank:10 →
      710/7,922,014/6c6c6f81e3d9ed6c); gate proofs on the new defaults
      (bank:20 escapes @549; fresh K=4 targeted @593); **tail trim
      measured and REJECTED** (loses both metrics on the new defaults —
      prototype reverted, negative result in SUMMARY Round 19). Two NEW
      engine-screen fixation holes mapped: bank10+bankPot8, bank55-alone.
      AUTOMATION.md gained §4a (targeted mode / two-tier list) + a
      rewritten §8. Detail: SUMMARY Round 19 + memory session 28.
   7. **Assist-ladder rung 2 (auto-add reps) — SHIPPED 2026-07-14 (Opus,
      session 17); the deferred session-16 follow-on.** Pure UI-thread
      top-up of under-queued actions (`actions.next[i].loops += gap`,
      reusing rung-1's `repGapReport`) that, when the Buy Mana optimiser is
      ALSO enabled, chains `requestOptimize` to rebalance — **user
      decision-1 ruling 2026-07-14: "top-up then chain optimizer"**
      (placement DELEGATED to the optimiser, not duplicated; the user's
      update "rely on that feature's logic rather than duplicating it").
      Add-only (over-queued left alone = tail trim, item 6);
      multiparts/progress/one-shots excluded (carries rung 1's null).
      Options `autoAddReps`/`autoAddRepsAuto` default OFF; controls in the
      Extras block after rung 1 (independent of the Advanced Automation
      master gate). Byte-inert vs 535 / 5,965,890 / e23f020400162f9a; npm
      91/91 (+6 autoadd.test.mjs); ui-smoke 51/51 (+10). Submodule
      `automation` one commit atop `169cfaf`, COMMITTED-not-pushed; outer
      gitlink stays on substrate pin `531faa3`. Detail: *(NewDocs)*
      `omsi-loops-ladder-rungs-plan.md` §4c + memory session 17.
   8. **Basic/Advanced automation UI split — session 18 (2026-07-14, Opus).**
      New `basicAutomation` master gate (default OFF, **functional** per user
      ruling, symmetric with `advancedAutomation`): the three basic assist
      features (rep-gap badges, auto-add reps, Buy Mana optimiser) act only when
      it AND their own toggle are on. Extras has two "Enable basic/advanced
      automation" checkboxes; the Automation view gained a "Basic automation"
      collapsible section above "Advanced automation settings" (Buy Mana moved
      into it); the view radio shows if EITHER master is on. Byte-inert
      (535 / 5,965,890 / e23f020400162f9a); npm 91/91; ui-smoke 66/66. Detail:
      *(NewDocs)* `omsi-loops-ladder-rungs-plan.md` §4d + memory session 18.
      **Refinement (same day):** SHOWN vs ENABLED — Extras checkboxes renamed
      "Show basic/advanced automation" (visibility); new in-section "Enable
      basic/advanced automation" checkboxes (`*Enabled`, default true) gate
      whether features run; a tier acts only when shown AND enabled; disabling
      via Enable keeps the section+radio visible. npm 91/91; ui-smoke 75/75.
      **Buy Mana UX polish (same day):** "Optimise Buy Mana" button → "Suggest"
      (preview-only); "Apply" auto-suggests when no cached proposal exists;
      fixed onError not resetting awaitingOptimize. The proposal is now a
      collapsible `<details>` with two Before/After/Δ tables (waste + reps, Δ
      colour-coded); Suggest/Apply top up reps first when auto-add is on.
      ui-smoke 83/83. **§11.7 Design B remains queued after this.**
   9. **§11.10 targeted-mode v2 (two-tier goals) — V0–V5 ALL CODE-COMPLETE
      2026-07-16 (sessions 20–27; fork `automation` @ `e6f2655`, unpushed; outer
      gitlink stays `531faa3`).** The arc: row-based priority editor + V0
      diagnostics + V1 sticky Tier-1 goals/per-branch stall + V2 recursive
      Tier-2 finder (DAG walk) + V3 locked-goal freeze + h-variant cash-in
      (fresh-K=4 DNF fixed, town1 @L669) + V4 two-tier UI with user-override
      storage + V5 planner-consume (`tier2UserLeaves` → ordered kind-b leaves
      tried BEFORE the auto finder, which stays the fallback; a pin CAN build
      toward a still-locked goal) + finalize (plannerTargets JSON confirmed as
      the option home; fork CI gained a standing `ui-smoke` job — UNEXERCISED
      until the next fork push, watch its first run). Gates: byte-inert
      throughout (535 / 5,965,890 / e23f020400162f9a / 0 RNG); npm 116/116;
      ui-smoke 116/116; override gates proven ([Secrets,LQuests] pin escapes
      K=4 @L849; unpursuable pin falls back auto-identical). Characterization:
      a value-less first override entry MONOPOLIZES by design — recommend stop
      values. Deferred: deeper override authoring (own slice); AUTOMATION.md
      still has NO targeted-mode section (pre-existing doc gap). Plan:
      *(NewDocs)* `omsi-loops-targeted-v2-plan.md`; memory sessions 20–27.
      **Item 6 (calibration) is now the ONLY remaining item in this queue.**
   Original queue (for reference):
   1. **Systematic action-code audit (user: HIGH priority)**: read all
      157 actions' reward/effect code and produce a complete census of
      what the automation's vocabulary cannot see. The session-8 audit
      found EXAMPLES (buff grants `addBuffAmt` ×7, non-travel manaCost
      cheapening, soulstones, multiparts opaque, and now the L292
      discovery undervaluation) — it was not exhaustive. The census
      DEFINES the vocabulary the architecture work must express; do it
      before designing the metadata schema.
   2. **Assist-tools track, first deliverable (user plan, §11.6): the
      rep-gap tracker** — report when an action's total queued reps <
      its currently-unlocked reps (the user built exactly this as a
      personal predictor patch years ago). Small, independent, ships
      default-off; the first rung of the §11.6 ladder (auto-add = rung
      2, simple balancing = rung 3).
   3. bank:20 fixation diagnosis → anti-fixation guard design (general
      mechanism, per the no-special-cases doctrine; robustness is an
      architecture property).
   4. Scorer/candidate vocabulary DESIGN from the audit census: ruled
      direction = declarative per-action metadata behind an option (the
      pure-empirical mode survives for AP); high-expMult grind
      CANDIDATES for talent (the scoring term already ships at W.talent
      0.01 — do NOT re-add it); the L292 discovery lesson.
   5. Queue-emission: exact-count tail trim (SUPERSEDES repeatLastAction;
      metric-dependent). Remaining §11.6 ladder rungs + priority
      checkboxes; §11.7 Design B live no-pause pipelining (designed,
      unbuilt; late-plan policy open) — as ruled/prioritized by the user.
   6. ONLY THEN: one deliberate re-baseline + full weight recalibration
      in the town-0 lab against the settled architecture (engine mode +
      pool make it ~30 min; DNF-aware; bankPot:8 = the Round-9 datum to
      re-test, NOT a pre-settled answer). Changing DEFAULT_WEIGHTS =
      re-baseline of the frozen byte-reference, own step.
   **AP ruling stands: v1 location checks = RESOURCE unlocks (pool
   discovery + lootable checking), NOT action unlocks** (discretization
   plan §7). Settle the base algorithm in town-0 mode before more
   multi-town work (unchanged).
1b. **XML migration arc (fork branch `xml-migration`; post-dates this doc's
   original queue) — Phases 3+4+wiring+5 COMPLETE 2026-07-16 (sessions
   30–32, Fable); view-subscribe DESIGN COMPLETE 2026-07-18 (session 33,
   Fable). NEXT = the Opus implementation kickoff below.**
   - Shipped: field matrix + xmlLite/actionListXml interpreter + all 157
     actions XML-defined (differential-green vs the JS oracle) + game-side
     wiring behind `options.useActionListXml` (default OFF) + Phase-5 tick
     goldens. 15 commits on `xml-migration` @ `efb0ee5`, pushed, CI green
     (test.yml triggers on the branch). ⚠ The outer gitlink stays on
     `substrate` (`5ad0d16`) — never bump it from this arc.
   - **View-subscribe refactor — IMPLEMENTED + PUSHED 2026-07-18** (Opus
     session 34, reviewed + approved by Fable same day). 3 commits
     `efb0ee5`→`0ff9f49` on `xml-migration`; `substrate` fast-forwarded to
     match (new standing cadence: substrate ff's to xml-migration at every
     green milestone; the `automation` branch was deleted, and the
     XML-only-branch idea is abandoned). Success criterion MET:
     actionList.js has ZERO view category names (64 sites → 19
     `stateChanged` emissions; funnels emit skill/buff/progress with level
     deltas; view-side `STATE_SUBSCRIPTIONS` table + null-checked sink in
     helpers.js). All gates green every slice (ui-parity, 461 byte-gate
     EXACT, npm 191/191, introspection golden untouched — one
     structurally-dead finish()/updateBuff grep assertion retired with the
     golden column frozen as history; `grantsBuff` metadata assertion
     stays live). Design + rulings: *(NewDocs)*
     `omsiloops/omsi-loops-view-subscribe-plan.md` §8.
   - **NEXT: Phase 6 executable rewards — DESIGN session first**
     (Fable-shaped; reward vocabulary must NOT grow `<notify>` — ruled;
     rewards call the funnels and view updates now happen for free; also
     unblocks the P2-omsi award-schedule carrier + lootable UI, §5b).
     Kickoff: *(NewDocs)* `omsiloops/omsi-loops-phase6-design-kickoff.md`.
     Then **Phase 7 editor**.
2. **Unlock-discretization U0–U5 — PLAN RECONCILED + U0/U1 KICKOFF READY
   (Fable, 2026-07-19).** Plan of record:
   `omsi-loops-unlock-discretization-plan.md` — read its RECONCILIATION
   BANNER first (the 2026-07-11 text predates XML 3–6 / view-subscribe /
   P2 / A+B; the banner + inline amendments supersede in place). Kickoff:
   *(NewDocs)* `omsiloops/omsi-loops-unlock-u0-u1-opus-kickoff.md`
   (anchors data-model-verified at fork `ca0392f`). **Four user rulings
   2026-07-19:** (1) the table is generated by WALKING the XML's
   structured `<visible>`/`<unlocked>` elements (which already exist,
   compiled, differential-proven — the probe extractor becomes the
   independent VERIFIER stratum); (2) U1 cutover is ALWAYS-ON, the 138 JS
   closures are deleted (first permanent XML-derived cutover; byte-gates
   prove inertness); (3) **v1 AP location pool = DISCOVERY quantity steps
   ONLY** (total{Var} quantile steps, 18 `<totalDiscovered>` vars) —
   checking-ledger steps designed-but-deferred, action unlocks still
   non-locations; (4) U3 enforcement stays in the arc (inert in v1).
   §3.4's residual registry COLLAPSED (Buy Glasses is declarative XML).
   Enforcement = suppression-scoped `getNextValidAction` check (unchanged);
   keep the differential corpus + real-save-fixture stratum as a LIVE gate.
   Work runs on `xml-migration` (substrate ff-cadence; `automation` branch
   is gone); byte-gate reference 461/5,195,188/9d9952e68bc8373c.
   **U0+U1 SHIPPED 2026-07-19 (Opus session 42): fork `85dbd69`
   (6452e95 U0 → 85dbd69 U1), both branches pushed, CI 5/5 green ×2;
   outer gitlink bumped `4616b68a2` (user-approved). 314 predicate rows,
   272 closures deleted, unlocks.js always-on; npm 237/237, byte-gate
   EXACT, V4+V5 PASS, field-matrix golden UNCHANGED. Two banked lessons:
   harness-boot-failure-reads-as-divergence; retiring a grep-oracle must
   also fix its REGEN.**
   **QUANTITY MODEL REVISED 2026-07-19 (post-ship, USER-RULED after the
   base-game examination): the base game is already discrete (adjustAll
   gated on level change: Pots +5/level, Locks +1/level; loot on every
   `oneInEvery`-th check — per-action: 10/5/25/100/1000). The shipped
   per-var G=8 quantile rows are SUPERSEDED by the LOOT-BATCH model:
   item = "a full batch of oneInEvery instances, one guaranteed loot"
   (+oneInEvery base capacity, no multipliers v1); location
   `q:{town}:{var}:{k}` = base-rate formula crossing k×oneInEvery (Pots:
   50 locations at Explored 2,4..100; Locks: 10 at 10,20..100); v1 caps
   at base-rate first-100% (no prestige/survey extension); partial
   batches and sub-ratio vars (hauls) mint no rows. §3.5 rewritten
   (banner'd). **WORLD SHAPE RULED same day (plan §7.5 NEW): worldgen
   takes a town count N; victory = town N joining townsUnlocked (N=1 ≡
   the shipped R2 v0 world); pool scoped to included towns (predicate
   rows gain `town` in U0b); §7.5 wiring = outer/wrapper work at the AP
   phase, not U0b.** **U0b SHIPPED 2026-07-20 (Opus): fork `4a40b12`
   (xml-migration ≡ substrate, both pushed, CI green), outer `6a18157d2`
   (guard test). Table = 620 batch rows / 14 vars (town-0 = 90: Pots 50 +
   Locks 10 + SQuests 20 + LQuests 10 — the §7.5 towns parameter, not the
   batch model, right-sizes a world). Kickoff-contradicting recon finds:
   Hauls are NOT sub-batch (StonesZ* = 2500×level ⇒ 250 rows each) — USER
   RULED them EXCLUDED (`QUANTITY_EXCLUDED_VARS` + `meta.excludedVars` in
   the artifact + an outer vitest guard on OMSI_LOOTABLES widening);
   walkPredicates already emitted `town` (assertion added). Row-id reset
   (G=8 → batches) ACCEPTED as the one free reset — **ids are load-bearing
   from `4a40b12`** (plan §3.3 ID EPOCH note). Gitlink bumped `b002973f4`
   (user-approved).** **U2 PLANNED 2026-07-20 (Fable): kickoff READY —
   `omsiloops/omsi-loops-unlock-u2-opus-kickoff.md` (2 slices: coeffs
   regen + dimIndex + check() call sites; then events + achievedReported
   + onActionCompleted + event-order test). Seam RULED: direct
   Unlocks.check() at the funnels, NOT the single-sink view-owned
   stateChanged channel (rejected-alternative rationale in plan §5.3's
   U2 block); quantity triggers = dot product (all 14 base formulas
   verified linear; additive `coeffs` field, ids untouched per the
   epoch).** **U2 SHIPPED 2026-07-20 (Opus): fork `76655ac` (`22865ab`
   slice A dimIndex/check/coeffs → `76655ac` slice B events/dedupe/
   onActionCompleted), both branches pushed, CI green incl. strict
   ui-parity; npm 253/253, byte-gate EXACT per slice; gitlink bumped
   (user-approved). ⚠ Kickoff gap closed IN unlocks.js: runtime derives
   quantity rows from `<totalDiscovered>` coeffs — ONE minting shared
   with the generator, NO new data carrier (don't add one at U4/U5).
   Emission order = TABLE order (u:Locks before u:BuyGlasses at
   Wander 20). Fork memory session 45 has the implementer detail incl.
   the atomic-build() lesson.** **U3 PLANNED 2026-07-20 (Fable): kickoff
   READY — `omsiloops/omsi-loops-unlock-u3-opus-kickoff.md` (one tiny
   slice: Unlocks.blocked() + skip-loop condition + "This action is
   locked." + the §6.4 six-leg differential test; anchors verified @
   `76655ac` — skip loop actions.js:259, getErrorMessage :280, blocked
   branch goes townNum-then-blocked-then-canStart per the settled
   message-priority ruling in plan §6's U3 block; suppressed/granted Sets
   already exported by U2).** **U3 SHIPPED 2026-07-20 (Opus): fork
   `2d9aff6`, both branches pushed, CI green; npm 259/259, byte-gate
   EXACT, V4 PASS (post-commit — ⚠ run-parity has NO --worktree, it
   always gates the submodule's committed HEAD: commit → V4 → push);
   §6.4 test mutation-checked (stubbed condition fails exactly legs
   3+5); enforcement test drives actions.tick() + shouldRestart (the
   step driver's prepareRestart rebuilds actions.current and destroys
   errorMessage evidence); gitlink bumped (user-approved). Fork memory
   session 47 = implementer detail.** **U4 PLANNED 2026-07-20 (Fable):
   kickoff READY — `omsiloops/omsi-loops-unlock-u4-opus-kickoff.md` (one
   slice: `qManagedBatches` Map + `applyManagedTotals()` at the END of
   adjustAll — SINGLE choke point superseding §9's 19 per-function
   guards; verified: adjust*() called only by adjustAll, load() re-runs
   adjustAll after total restore, so the loop covers every write path;
   substituted total = min(batches,rowCount)×oneInEvery plain per the
   v1 no-multipliers ruling; locations decoupled by construction — U2
   triggers read levels, not totals; seven-leg test incl. batch
   invariant + decoupling + excluded-var guard; V4 ordering rule baked
   in).** **U4 SHIPPED 2026-07-20 (Opus, session 49): fork `3853d18`
   (xml-migration ≡ substrate, both pushed, CI green incl. strict
   ui-parity + ui-smoke). Implemented exactly the session-48 design:
   `qManagedBatches` Map + lazily-built `quantityMeta()` (nulled in
   `build()`) + `applyManagedTotals()`; ONE line at the end of
   `adjustAll()`; the 19 adjust fns untouched; empty-Map fast path
   BEFORE `ensure()` kept the hot path free. Seven-leg
   `quantity-substitution.test.mjs` passed first run; npm 266/266;
   byte-gate EXACT 461/5,195,188/9d9952e68bc8373c; V4 post-commit PASS.
   U5-useful ground: `build()` filters excluded curves entirely (haul
   rows never minted); town-0 constants Pots 5/level·50 rows·ratio 10,
   Locks 1/level·10 rows·ratio 10. Gitlink bumped (user-approved).
   Fork memory session 49 = implementer detail.** **U5 PLANNED 2026-07-20
   (Fable, session 50): kickoff READY —
   `omsiloops/omsi-loops-unlock-u5-opus-kickoff.md` (ONE slice:
   `Unlocks.installOverlay`/`buildOverlay` seam + `unlocks` sibling key on
   worldConfig + the refined §7.4 managed surface + prestige-contract
   test). Design settled in the plan's [U5 PLANNING PASS] block at the end
   of §7.4 — replace-whole overlay `{suppressed, granted, qBatches}`, null
   when empty (byte-inert transport); install halves independent, the
   useActionListXml flip stays schedule-only; view fan-out page-only at
   the managed layer; `setUnlockOverlay` SUBSUMES §7.4's
   setUnlockSuppression, `grantQuantityStep(varName)` supersedes "quantity
   via q-row ids"; §7.3's prestige-multiplier sentence SUPERSEDED by the
   U4 no-multipliers ruling; prestige re-push needs NO new code (overlay
   is untouched module state; _onRestart already fires inside prestige's
   restart(); the test proves it). Anchors verified at `3853d18`.**
   **U5 SHIPPED 2026-07-20 (Opus, session 51): fork `e5ef307` on
   `xml-migration` ≡ `substrate`, both PUSHED; fork CI green. Landed as
   designed — `buildOverlay`/`installOverlay` (validate-before-mutate, so
   a rejected overlay never half-applies; `q:` ids barred from
   suppressed/granted; clearing an already-clear overlay returns before
   even forcing the table build, which is what keeps the default worker
   path doing nothing), the `unlocks` sibling key (null only when BOTH
   halves empty; halves independent; useActionListXml flip stayed
   schedule-only), the managed surface incl. the multiplexed
   `onUnlockAchieved`, and `test/managed-unlocks.test.mjs` (7 legs, the
   prestige leg driving the REAL `prestigeWithNewValues`). Transport
   callers needed ZERO edits, as predicted. Gates: npm 273/273 · V3 EXACT
   461/5,195,188/9d9952e68bc8373c/0 RNG · V4 PASS on the committed HEAD ·
   V5 CI green. Implementer notes: a headless prestige needs four browser
   shims (`closeTutorial`, `window`, `loadChallenge`, `recalcInterval`)
   plus a permissive `getElementById` for the load() call ONLY — restore
   the null stub after, it is load-bearing for tick-path search-toggle
   semantics (field-matrix.lib.mjs precedent); and `installOverlay`
   deliberately does not refresh, so a transport test must call
   `adjustAll()` itself the way a worker's sim loop would. ⚠ The
   run-planner progress log LAGS badly — it read ~30x slow mid-run while
   actual wall was 648s; do not diagnose a slowdown from it without a
   parent-commit control (one was run here and matched, exonerating the
   change). **OUTER GITLINK NOT BUMPED — still pins `3853d18`; ask
   first.** Fork memory session 51 = implementer detail.**
   **The U-arc is now FORK-COMPLETE.**
   **AP INTEGRATION V1 PLANNED 2026-07-20 (Fable, session 52): kickoff
   READY — `omsiloops/omsi-loops-ap-integration-v1-opus-kickoff.md`
   (ONE session, two slices: A = library pool emission + towns knob +
   preset; B = bridge overlay/seed/reconcile/victory/filler; ZERO fork
   edits, no byte-gate needed). Seven user rulings (recorded in the
   plan's [AP-V1 PLANNING PASS] block at the end of §7.5): (a) towns =
   `substrateConfig.omsi.towns` default 1 + `emitUnlockLocations`
   default OFF (byte-inert defaults); (b) wrapper reads the fork's
   unlockTable.json DIRECTLY (env-branched lazy loader — page-relative
   fetch, NOT import.meta.url in bundled mode; no second carrier);
   (c) rank rule = i-th location (town-major order by step/rowCount —
   NOT trigger÷coeff, 300/620 rows are multi-dim) requires
   floor(i·K_≤T/L_≤T) copies via **HasFromList over the towns ≤ T item
   list** (the user's "sort items by town" ruling; HasFromListUnique
   can't count progressive duplicate copies — both engines verified);
   (d) filler = "Bonus Seconds" → bridge addOffline(60s), zero base-pool
   copies; (e) items = "{Var} Supply Step" progressive per var,
   progression_skip_balancing (recommendation, unobjected); (f) victory
   = travel_onward in zone N−1 + watch `townsUnlocked.includes(N)`
   (fixes the latent v0 length>1 hole vs alternate routes); (g) boot
   order = seed → overlay (zero-inclusive qBatches for every included
   var) → grantQuantityStep deltas; NO prestige re-push (U5-proven), NO
   own-vs-foreign split in v1 (nothing wipes qBatches). Recon banked:
   omsi bridge has NO snapshot/staticData intake yet (port jta's
   snapshotUpdated reconcile); generateOmsiAwardSchedule stays UNWIRED;
   pool derives 1:1 from location item fields at buildRulesJson; real AP
   fill (Python round-trip) DEFERRED, jta parity.**
   **AP-V1 SHIPPED 2026-07-20 (Opus session 53): outer `8390f7d80`
   (slice A) + `2e70c0eed` (slice B), pushed to `main`. ZERO fork edits,
   no gitlink bump (fork still `e5ef307`). All seven rulings implemented
   as written. New: `omsiSubstrateWrapper/unlockPool.js` (lazy
   env-branched loader + ordering + rule formula),
   `omsi_randomized_test` preset (90 supply locations, counts 0…89,
   travel_onward at 89), `omsiUnlockPool.test.js` (22 cases),
   `tests/testCases/omsiUnlockTests.js` (6 in-app legs).
   Gates: vitest 3115/3115 · test-substrates 41/41 · test-regression
   31/31 · verify-omsi-mana-leg OK · omsi_substrate_test and
   omsi_schedule_test byte-identical.
   **Two ruling REFINEMENTS forced by implementation (both recorded in
   code comments):** (i) `unlockMeta` is WORLD-scoped, not zone-scoped
   as §3.3 said — the overlay is global engine state and an unlisted var
   runs NATIVE capacity, so a zone-scoped map would leave towns 1..N−1
   unmanaged until walked into; ruling (g) ("every var of every included
   town") wins over the per-zone phrasing. (ii) The v0 victory path
   keeps `length > 1`; only emission-ON worlds use `includes(N)`.
   **Two real defects the in-app stratum caught — the payoff for the
   independent-stratum discipline:** (1) neither `setUnlockOverlay` nor
   `grantQuantityStep` calls `adjustAll`, and the capacity substitution
   runs at the END of `adjustAll` — a fresh overlay sat INERT until an
   unrelated level-up; bridge now nudges `adjustAll()` after push/grant.
   (2) the fork's `achievedReported` ledger is add-only ENGINE MODULE
   state, so it survived a RULES RELOAD, not just a prestige — world 1's
   reported rows permanently silenced those rows in every later world in
   the same iframe; bridge clears it on `rulesLoaded` then rebuilds from
   the new world's checkedLocations. Both fixed OUTER-side.
   ⚠ Implementer traps for the next session: the host dispatcher has NO
   `subscribe()` (publish-only) — observing a dispatch means wrapping
   `publish`, and a silent watcher makes every "not re-reported"
   assertion vacuous; quantity `ratio` is the row's `grant.batch`
   (Pots/Locks = 10, SQuests/LQuests = 5), NOT 1; `checkLocation`
   REJECTS inaccessible locations, so a victory test must satisfy the
   89-copy access rule before unlocking the town; and the managed game's
   save slot OUTLIVES individual tests, so persistent `townsUnlocked` /
   progress must be normalized before each region entry.
   NEXT for this arc: panel/UI exposure of the towns +
   emitUnlockLocations knobs, multi-town worlds (towns > 1 emits
   correctly and is vitest-covered but has never been played), and the
   deferred Python round-trip for a real AP fill.**
   ~~NEXT CHOSEN 2026-07-20: multi-town play design pass~~ —
   **SUPERSEDED same day by a USER DIRECTION CHANGE (session 54).**
   (The two shipped-code gaps that recon found remain true and roll into
   arc E below: zone-scoped `ap_locations` silently drops cross-region
   check firing at bridge.js:535, and the victory watch arms only while
   the last town's region is loaded.)
   **DIRECTION CHANGE + ROADMAP 2026-07-20 (user, session 54).** Before
   multi-town travel: split each town into multiple procgen REGIONS with
   randomly-distributed content, each region with its OWN Explore level;
   JtA-style synthetic queueable "Exit North/East/…" actions
   (procgen-only, unlocked by fully exploring the region; future: exit
   unlock as a randomized AP item — the unused predicate-row overlay
   machinery is the ready-made slot); before THAT, a counts refactor:
   configurable AP item instances per var + configurable/auto-scaling
   location counts (the Explore percentages that fire checks move).
   Plus (user, same session): remove the town-number hardcoding, fitting
   the XML format where possible; and add the Loop-mode features omsi
   lacks "sometime soon". Three Opus recon sweeps verified feasibility —
   condensed with anchors in *(NewDocs)*
   `omsiloops/omsi-loops-region-split-recon-2026-07-20.md` (the design
   passes' first read). Key verdicts: counts = HYBRID mechanism
   (USER-AGREED — native 620 rows stay the id namespace/capacity
   substrate, thin fork-side selection of L nearest-evenly-spaced native
   rows moves the firing percentages, item count = grant-multiplicity
   multiplier; id-epoch contract survives; partially supersedes the
   loot-batch "item = one batch" ruling — record when ruled); region
   split = region-overlay on ONE town (extra Town instances blocked by
   hardcoded-9: type/static DOM/19 adjust* fns/flat save namespace —
   re-evaluate after de-hardcoding); exit actions port cleanly from
   JtA's `_injectExitTasks` (queue stores names only); per-region
   sub-queues = the savedQueueStore + replayActions path (jtaActionQueue
   3b is a linear script, NOT the model); omsi declares NO loopSupport
   today.
   **ARC ORDER: A counts refactor → B town de-hardcoding (XML-
   declarative; the 19 adjust* fns duplicate the XML coeffs' math) →
   C region splitting + per-region Explore + exit actions (mechanism
   re-check after B) → D loops-mode support (loopSupport + queue write
   channel + recorder/replayActions + sub-queues; parts may interleave
   earlier per the user's "soon") → E multi-town travel (the deferred
   design pass) → F panel per-region queue editor. Panel knob exposure +
   Python round-trip stay queued.**
   **ARC A DESIGN PASS DONE 2026-07-20 (Fable, session 55): kickoff READY —
   `omsiloops/omsi-loops-arc-a-counts-refactor-opus-kickoff.md`. All seven
   rulings user-confirmed. HEADLINE: arc A is ENTIRELY OUTER-REPO — ZERO
   fork edits, no byte-gate, no gitlink bump. The user-agreed hybrid
   (native rows stay the id namespace + capacity substrate; a selection
   picks L rows/var; item count rides a multiplier) is realized outer-side
   because (1) firing is grind-based and decoupled from items, (2) the
   bridge already drops fired ids absent from `ap_locations`
   (`bridge.js:535`) so the selection = which rows the outer pool emits,
   (3) the fork's `min(batches,rowCount)×ratio` caps capacity item-blind so
   the multiplier lives in the bridge. Rulings: (a) selection
   `k_j=round(j·R/L)`, top pinned to R, clamp L∈[1,R]; (b) ONE global
   `substrateConfig.omsi.unlockScale∈(0,1]` default 1.0 byte-inert,
   `L=I=clamp(round(scale·R),1,R)`, per-var map deferred; (c)/(d) bridge
   maps `qBatches=round(count·R/I)` (even, no wasted copies, full set =
   exact baseMax) — chosen over the recon's fixed `ceil(R/I)` stride which
   wastes tail copies; (e) OUTER-ONLY, fork UNCHANGED — arc A opens NO fork
   slice; (f) outer pool emits selected rows only, `unlockMeta.vars[v]`
   gains `itemCount` (omitted when `=rowCount` → scale-1
   `omsi_randomized_test` byte-identical), K/L machinery unchanged (ratio
   stays 1 at L=I); (g) only OUTER `omsiUnlockPool.test.js` assertions
   become parametric (fork tests untouched), independent stratum = an
   in-app scaled-world leg proving checks fire at the SELECTED percentages
   and capacity lands at the mapped totals. Plan §3.5 gained a supersession
   banner; §7 a pointer.**
   **ARC A SHIPPED 2026-07-20 (Opus session 56, outer `5066a31a8`, ZERO fork
   edits, no gitlink bump).** Landed exactly as designed. `unlockScale`
   knob + selection + `qBatchesForCount` multiplier + `omsi_scaled_test`
   preset (scale 0.2, 18 supply locs) + in-app leg `omsi-unlock-scaled-world`.
   Gates: vitest 3122/3122 · test-substrates 42/42 · test-regression 31/31 ·
   byte-inert (omsi_randomized_test / omsi_substrate_test / omsi_schedule_test
   all byte-identical). One kickoff miss: the substrates config enumerates
   test ids, so the new leg needed a one-line config entry (§5 said "no
   config change"). NEXT: arc-B design pass (town de-hardcoding — the 19
   adjust*() fns duplicate the XML `<totalDiscovered>` coeffs' math; recon
   §2 has the anchors) — prompt in NewDocs NEXT-SESSION-PROMPT.md.**
   **ARC B DESIGN PASS DONE 2026-07-20 (Fable, session 57): kickoff READY —
   `omsiloops/omsi-loops-arc-b-town-dehardcoding-opus-kickoff.md`. All
   rulings user-confirmed. HEADLINE: the recon under-sold it — the XML
   `<totalDiscovered>` blocks ALREADY declare each of the 17 capacity
   formulas IN FULL (base coeffs+divisors, prestigeContent, surveyBonus,
   skillMod WITH min/max/percentChange, floor/round), and the fork ALREADY
   has a tested evaluator (`applyAdjustment`/`evalNumeric`,
   `actionListXml.js:353-423`) that compiles exactly these for
   `<primaryValue>`. Rulings: (a) COMPILE THE EXISTING XML — a per-action
   `computeTotal()` (like `fields.goldCost`) + a data-driven `adjustAll`
   loop; byte-exact by construction (divisor = EXACT division :370;
   additiveBonus = `base·skillMod + base·survey` :411-419); rejected the JS
   table + the generator-emitted table. (b) SCOPE = the 14 vars that carry
   `<totalDiscovered>` (census found 17 total-writing fns but only 14 have
   XML; Pockets/Warehouses/Insurance = town-7 progress-type, no XML → stay
   JS; the 4 HaulZ/StonesZ stay with adjustAllRocks, excluded via existing
   `QUANTITY_EXCLUDED_VARS`). (c) COUNT = one `TOWN_COUNT=9` constant
   (initializeTowns + two main.view.js loops), byte-inert; dynamic DOM +
   getTravelNum DEFERRED to arc E. (d) FORK SLICE OPENS — byte-gate
   461/5,195,188/9d9952e68bc8373c/0 + V4 + ask-first gitlink cadence resume;
   independent stratum = a full-multiplier-space differential sweep vs the
   pre-deletion JS (byte-gate can't witness unreached levels). (e) save
   namespace + travel UNTOUCHED. Arc C's swappable-region seam is FREE (the
   evaluator resolves town via `townFor(varName)`/`ctx.townNum`, not a
   `towns[N]` literal). `totalGamble` name mismatch vanishes under
   data-driven code. Recon §2 gained a settled-design banner. NEXT: arc-B
   IMPLEMENTATION (Opus) — prompt in NewDocs NEXT-SESSION-PROMPT.md.**
   **ARC B SHIPPED 2026-07-20 (Opus session 58): fork `c200b5c`
   (`substrate` ≡ `xml-migration`, both pushed); outer gitlink bumped
   `aa9c75cff` (user-approved) and pushed.** Fork +254/−94: unconditional
   `ActionListXml.getQuantityTotalFns()` + `applyQuantityTotals()`
   compile the 14 `<totalDiscovered>` formulas; `driver.adjustAll()`
   rewritten to ONE data-driven call; the 14 hand-pinned
   `adjustPots()…adjustWells()` DELETED; `const TOWN_COUNT = 9`; new
   `test/quantity-total-differential.test.mjs` (the independent stratum,
   ~80k samples across every skillMod window boundary). **Two impl-time
   corrections to the kickoff (verified, rulings untouched):** (i)
   `computeTotal` is UNCONDITIONAL, not applyOverrides-gated —
   `useActionListXml` defaults OFF, so the kickoff's "mirror
   fields.goldCost" would have left it absent in vanilla and broken the
   byte-gate; it's a memoized standalone compile off the always-loaded
   XML carrier (the U1 always-on-cutover precedent), town resolution
   still through `townFor`/`ctx.townNum` (arc C's free seam); (ii)
   `TOWN_COUNT` lives in driver.js, not saving.js — saving.js loads
   AFTER main.view.js whose count loops run at top-level (TDZ). Gates
   ALL green: differential sweep · fork 275/275 · byte-gate `--worktree`
   461/5,195,188/9d9952e68bc8373c/0 RNG · V4 PASS · vitest 3122 ·
   substrates 42/42 · regression 31/31 · 4 omsi presets byte-identical ·
   unlockTable.json unchanged. *(Queue record written post-hoc by the
   review session — session 58's wrap-up skipped it; third wrap-up slip
   in three sessions, checklist hardened in
   feedback_push_by_default.)*

   **ARC C DESIGN PASS DONE 2026-07-21 (Opus session 59): kickoff READY —
   `omsiloops/omsi-loops-arc-c-region-split-opus-kickoff.md`; all rulings
   user-confirmed via AskUserQuestion.** Mechanism re-evaluated post-B and
   CONFIRMED = **region-overlay on ONE town** (extra-instance route NOT
   softened by B — action-name uniqueness / DOM / getTravelNum / the
   `(town,varName)`-keyed unlock table all still hardcoded). Rulings:
   multi-valued-dim dissolved by one-live-copy-at-a-time (NO region axis on
   the table/AP surface); per-region state HOST-side (bridge store keyed
   `region_id`, fork `dumpRegionState`/`loadRegionState`, ZERO new fork save
   keys); region count CONFIGURABLE per town (default 1 = byte-inert vanilla);
   config schema = arbitrary graph, v1 grid-arranged, **vanilla mode
   preserved verbatim**; exit gate = configurable %-explored threshold
   (default 1.0, local predicate); content distribution MECHANISM ONLY —
   AP-location→region assignment DEFERRED (`unlockTable.json` stays
   byte-identical); synthetic exit `finish()`→`user:regionMove` (JtA
   `_injectExitTasks` port), OUT of vanilla enumeration + planner census;
   scope fence excludes arcs D/E/F. KEY FIT: the omsi bridge ALREADY has a
   region concept (`omsi:loadRegion`, `region_id`→`world.omsiTown`) —
   `awardSchedule` riding the region payload is the transport template; arc C
   EXTENDS it. Fork slice: byte-gate + V4 + ask-first gitlink cadence RESUME;
   independent stratum = an in-app region round-trip leg.
   **ARC C SHIPPED + PUSHED 2026-07-21 (Opus, session 60): fork `2bda39b`
   (both branches), outer `f0eb5b3ff` on main (gitlink bumped c200b5c→2bda39b,
   user-approved).** USER STEER mid-flight: "separate regions are supposed to
   be separate zones" → the design shifted from a hand-cloned region to **the
   omsi substrate emitting N GENUINE zones all mapping to `omsiTown 0`** via a
   new `regionSplit` pipeline-① config (byte-inert when absent). Fork
   `managed.js`: `dumpRegionState`/`loadRegionState` (swap VALUE props derived
   from the town's var lists, `adjustAll`+`check` both branches, ZERO new save
   keys), `setActiveRegion`/`regionExitAvailable` (Explore-% gate
   `exp/505000≥threshold`, default 1.0), `injectSyntheticAction`/
   `clearSyntheticActions` (register `Action[key]` AFTER initializeActions ⇒
   queueable via getActionPrototype but NEVER in totalActionList/census/DOM).
   Bridge derives ONE synthetic exit per GRAPH exit from `world.exits` (jta
   `_getRegionExits` pattern — NOT a hand-authored exits list;
   `handleRegionMove` routes purely by `targetRegion`). Independent stratum =
   `omsi_region_split_test` preset + `omsi-region-split-round-trip` in-app leg
   (r0 fresh→explore→exit→r1 fresh→return→r0 restored). Gates: fork 279/279,
   byte-gate 461/5195188/9d9952e68bc8373c/0, V4 PASS, vitest 3122, regression
   31/31, substrates 43/43 (a `jta-out-of-mana` cold-start flake cleared on
   re-run; not mine), 4 presets byte-identical, `unlockTable.json` unchanged.
   Full record: memory `project_omsi_loops_fork` session 60. NEXT: **arc D**
   (loops-mode support — omsi declares NO `loopSupport`) — **DEFERRED
   2026-07-21 behind the §3b region-block-modes track**: arc D's design
   must target the new Manual/Record/Playback/Bot mode system (at minimum
   after M1+M2, ideally M6 so the solver seam is final). Omsi INSTANT is
   fork-slice work and comes LAST of all substrates.
3. **Housekeeping when stable:** merge `automation` → `substrate`, then bump
   the outer submodule pointer (currently held on `substrate` per standing
   ruling). Remaining Phase E slices: action-completion callback,
   setTownGate, instant stepping, cloud-save hard-off audit.
4. **Social:** cirne DM drafted, unsent, non-blocking
   (`cirne-dm-draft.md`); community post waits for "something to show";
   never bundle the license ask + AP announcement + AI disclosure in one
   post.

## 5. Cavernous II — Stage 2 onward

Memory: `project_new_substrates_planning`. Plan *(NewDocs)*
`NewDocs/plans/cavernous/cavernous2-substrate-plan.md`. Stage 0+1 SHIPPED,
pushed, fork CI green; simple-mode boost byte-inert-proven.

Inputs already settled — do not re-derive:
- **v1 AP pool** = *(NewDocs)* `experiments/derived-rules-zone1.md` (+ .json):
  35/35 classified; iron chain = the ONLY hard-dep class (9 bridge
  locations); everything else pure mana budget (M* 5→376).
- **Location trigger RULED = REACH** (single layer: check hook on
  enter/setMined; ghost suppression stays on the grant side). The generator
  keeps `TRIGGER=completion` env mode for re-pricing comparisons; a later
  machine-split into completion-keyed locations is a recorded idea.
- **÷E² combat-intake correction is WRONG** — refuted by twin runs; vanilla
  intake gives exact parity. `effectiveCloneCount()` in settings.ts is the
  single definition of E.
- **Playback requirements:** chain veins must be picked by Dijkstra cost;
  the portal is a PRESENT action — walking onto Θ does nothing, queues must
  include it.
- **Contingency toggles** (kudzu no-regrow, iron-bridge persist) are
  pre-designed, adopt-on-evidence only; the stats harness must measure
  loops-to-milestone toggles-off vs on BEFORE any toggle defaults on (the
  balance pass needs to know which mode it prices).
- **v0 victory** = reach zone 2 — the portal is pit-gated, so it exercises
  the full iron→furnace→anvil→bridge chain.

## 5b. Cross-game resource sharing + consumable pool (arc opened 2026-07-17, post-dates this doc)

Plan of record: *(NewDocs)* `cross-game-consumable-pool-plan.md` (D1–D10 +
S1–S8 ALL RULED 2026-07-17). Memory: `project_cross_game_consumables`.
**R1 (sharing contract + resourceChannels module + all four mana legs) +
R2 (omsiSubstrateWrapper + mana channel + v0 victory) + P1 (item channels:
sharing.items declarations, jta Fork 1.12 `window.grantItem`, omsi
bridge-direct `addResource` arrival handler, D4 wipe verified both sides)
are COMPLETE and pushed.** Next in order:

1. **P2 — award schedules + randomization: COMPLETE (both halves).** JtA
   half PUSHED 2026-07-17 (below); **omsi half COMPLETE + PUSHED 2026-07-19
   (session 38): §2d carrier + §9b-pre lootable UI + lootables-only
   generator knobs; fork `b160473` (incl. the inline-toggle reshape), outer
   gitlink bumped (`91ff331f8`), npm 217/217, strict ui-parity green.**
   Detail: memory `project_cross_game_consumables` + `project_omsi_loops_fork`
   session 38. **Follow-on SCOPED 2026-07-19 (Fable, session 39): the
   automation update was SPLIT (user-accepted) — A (worker schedule+prefs
   transport) + B (harness `--world-config`/`--loot-policy` hooks) are
   Opus-ready in *(NewDocs)*
   `cross-game-p2-automation-transport-opus-kickoff.md`; C (per-category
   valueOfVar/bank scoring) + D (priority walk as a planner lever) are
   DEFERRED until U0–U5 + AP semantics settle (U-plan §7 reshapes exactly
   those scoring surfaces; empirical self-correction from A makes deferral
   cheap). B unblocks the shuffle-scope prioritized-play curves.
   **A+B DONE + PUSHED 2026-07-19 (session 39, Opus): all three slices —
   fork `ca0392f` (accessors + restore invalidation; worker transport on
   both the planner and predictor legs; harness `worldConfig`), outer
   `c9e7cc045` (`--world-config` / `--loot-policy`, pool workerData,
   provenance hash, sweep axes). Gates: byte-gate 461 / 5,195,188 /
   `9d9952e68bc8373c` / 0 RNG EXACT, fork npm 230/230, separation
   handshake 1,030,800 vs 316,800 ticks. Two facts for any future curve
   work: SHORT runs are degenerate on the policy axis (at 120 loops the
   two policies are bit-identical — pools must be big enough for a loop to
   end mid-walk), and BOTH policy arms DNF on the half-shuffled smoke world
   (vs 461 vanilla). Fable review APPROVED same day; gitlink bumped
   `a2341d35e`.**
   **SHUFFLE-SCOPE RULED WITHOUT CURVES (user, 2026-07-19): decision (a) —
   DEFAULT generated worlds do NOT shuffle; the knobs stay 1/0 byte-inert
   and shuffling is an opt-in procgen setting defaulting to OFF. The curve
   sweep / frontier-optimization session is PARKED — the user wants manual
   planner experimentation first. Machinery stays ready for it:
   `mint-world-config.mjs` + `worlds/curves/` ladder (`04f920011`) + the
   session brief *(NewDocs)*
   `cross-game-shuffle-scope-ruling-session-brief.md` (banner'd PARKED).
   Sub-question RESOLVED (user, 2026-07-19): S3 panel exposure IS wanted,
   but DEFERRED to a UI-focused session (batch it with other panel
   surfacing; current CLI+params surface stands until then).** JtA-half record: design doc *(NewDocs)*
   `cross-game-p2-award-schedules-design.md` (censuses + experiments +
   rulings R1–R4; 4 outer commits
   `11a633277`→`8bc0fa0cf` + jta fork Fork 1.13 `e1e38d9`, CI all green).
   Shipped: per-rep `item_schedule` in the dataset doc (solver-visible by
   construction), schema/validator rules, generator knobs
   `originalItemWeight`/`dummyItemRatio` (byte-inert defaults), outbound
   foreign-award leg end-to-end. Key experiment facts: JtA has NO hard
   wall even with all 32 awards nulled (p100 completes at 17.7×
   baseline); omsi uniform dropping DNFs even at realized 15% — the
   lootable UI (design §9b-pre) is the mitigation. ~~The omsi half
   FOLLOWS XML Phase 6~~ — that chain (view-subscribe → Phase 6 → §2d
   carrier + §9b-pre lootable UI) completed 2026-07-19.
2. **X1 — maze consumable tiles — COMPLETE + PUSHED 2026-07-19 (Opus
   session 40).** Four slices: outer main `4ef7ae371` → `2ea3a8154`
   (`52041d24d` overlays+sidecar → `0d19373ff` placement+knobs →
   `99e25caa2` pickup/grant/respawn/render → `2ea3a8154` bot policy +
   verify); shared submodule `30eaece` → `65e0156` (the content-module
   generator lives there; gitlink bumped inside slice 2 — user ruled
   "wherever cleaner, shared is okay, we might refactor procgen").
   Gates: vitest 3092/3092, test-substrates 35/35 (3 new tests
   registered in `playwright_tests_config-substrates.json`),
   test-regression green, new
   `scripts/procgen/verify-maze-consumable-tiles.mjs` OK, byte-inert
   default proved (maze_loop_worldgen regen identical modulo the
   pre-existing `loop_costs.generatedAt` timestamp).
   **X1-R4 resolved: mana-refill tiles ARE in v1** — `gainMana` already
   existed and maze already declares `sharing.mana`, so the seam was a
   one-liner.
   ⚠ **Three of the kickoff's pre-surveyed anchors pointed at the WRONG
   LAYER.** Corrections are the record in *(NewDocs)*
   `x1-maze-consumable-tiles-design.md` §1: the maze grid is BINARY and
   all semantics are sparse "x,y" overlays (so the new tile types are
   overlays, not tile values); `compileRegionGraph` never sees tiles and
   is untouched (foreign tiles aren't AP locations, D10); `stepItems` is
   node-level, so the real placement precedent is the HAZARDS content
   module. Anyone citing those anchors for follow-on work should read
   the design doc first.
   **Remaining in this sub-arc:** panel exposure of the X1 knobs (joins
   the deferred UI session alongside the shuffle knobs, S3); richer
   placement policies (dead-end bias, per-sphere quotas — X1-R2); the
   recorded-but-not-built mana-optimizing collect policy (X1-R3); pool
   UI (S7); cross-game equivalence mappings (D2).
3. **X2 — hardening** (S4-census-driven logic-inertness enforcement;
   balancing-aware placement aspiration).

## 6. Everything else (unchanged queues)

Pre-existing next steps that predate this transition, in their topic files:
top-down stepped pipeline phases 4/5/6 (editors); sphere-growth soft
difficulty (deferred); grid-growth **KEPT + modernized** (user 2026-07-15 chose
refactor over deletion; `insertBackExit` extraction `a6cbdd35d` + async
generation with live denominator-less progress `406695f46`, on main NOT pushed,
byte-inert — see `project_grid_growth_retirement`); docs migration help module;
flashPanel unification. Nothing from the 07-10/11 work blocks on them.

---

## Dependency sketch

```
runner rebalance ──► OR-lanes O1–O5
5g (DONE) ──► post-v1 A→E
action-queue port ──► Phase 6 audit ──► old-stack retirement
scoring-horizon design ──► multi-town continuation (beyond M4)
U0–U5 (independent of M-phases) ──► omsi randomization v1
view-subscribe ──► XML Phase 6 ──► P2-omsi carrier + lootable UI (ALL DONE 2026-07-19) ──► Phase 7 editor
P2-omsi automation follow-on: A+B DONE 2026-07-19 ──► shuffle-scope curves (Fable, consumes B); C+D deferred to U/AP
X1 maze tiles (kickoff ready, independent — grant bus live)
Cavernous Stage 2 (hooks/managed) ──► v0 substrate ──► Stage F (pool + trigger ready)
world-persistence P1–P4 (independent)
block modes M1 ──► M2 ──► M3 ──► M4/M5 ──► M6 (solver rename) ──► omsi arc D ──► arc E/F; omsi instant LAST
```
