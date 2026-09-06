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

Status: coverage RESTORED 2026-07-12 — ⛔ **and the SLOW TIER IS OFF AGAIN
SINCE 2026-08-20** (⚖ user): a major REDESIGN of this substrate is planned and
will make the current generate-and-verify batteries irrelevant, so
`vitest.slow.config.js` excludes `runnerDemo/**/*.slow.test.js` and
`procgenPipeline/runnerSphereGrowth.slow.test.js`. Eight files, **2380 s of the
slow suite's 2569 s (92.6%)**, one already red on a 300 s test timeout
(`generator.slow.test.js`, `[blue+doubleJump+glide+spring] × seeds 1,2`). The
files are DISABLED, not deleted; the redesign's own suite replaces them, and
reverting is deleting the two patterns. ⛓ Untouched and still running: the
runner's DEFAULT-tier `*.test.js`, the manual calib tier, the in-app substrate
tests and the `verify-runner-*.mjs` instruments. Rationale and the per-file
table are in `vitest.slow.config.js` itself and in
`docs/json/developer/procgen/runner.md`.

⚠ **The OR-lanes item below (O1–O5) predates the redesign decision** and is not
re-scoped here; whoever opens the redesign should say whether it survives.

**⛓ 2026-08-26 — the redesign HAS a shape now: it is the tile-based PLATFORMER
substrate (`platformerDemo`), the next major arc (⚖ user).** Draft plan
*(NewDocs)* `procedural-platformer/platformer-substrate-v2-draft.md`; it
REPLACES every previous runner plan (v1 strip plan, OR-lanes O1–O5, the test
rebalance). Answering the question above: **OR-lanes O1–O5 do NOT survive**
(strip grammar); branching comes from §5g's area graph. Measured reuse: the
vendored toolkit + parity test, the profiles/stamp law, `gameCore`, and the
whole geometry-free ability→AP-rules chain (`apRules`/`deriveRules`/
`verifyObstacles`) KEEP; collision + `suppression`/`zoneRules` ADAPT (auto-run
is one line, `physics.js:371`); the strip generator/solver/bot REPLACE. v1 = a
Robot Wants Kitty clone with the SWFRecomp RWK wasm as the oracle, the toolkit
physics fitted to RWK by settings, Seedling's tape format, no RWK data in the
repo. Memory: `project_platformer_substrate_arc`.

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
→ opt-in default-OFF `6f550d722`. `scripts/procgen/check-world-persistence-reload.mjs`
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
   byte-inert (dump-spiral 5/5, dump-sphere diff-clean); `check-region-library-ui`
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
(Fable session 68); KICKOFF:** *(NewDocs)*
`NewDocs/plans/loops-m4-jta-opus-kickoff.md`. **SLICES 1+2+3 SHIPPED+PUSHED
2026-07-23, CI green (slice 3 `cf5d5d286`; gitlink bump `f6e7de1ca`, fork
pushed first; maze memo fix `c78e8a78b`; status correction `ced4c6d7a`).**
jta declares record+playback+instant + the new GENERAL `requiresLoopMode`
flag (user ruling: jta regions NOT supported outside loop mode — native
reset-to-zone-0 ≡ the loop teleport; always-on economy coupling = the
CONTRACT; omsi arc D + future loop-games adopt the flag). Gate opt-in
broke SIX jta in-app tests (bridge `_dispatchRegionMove` carries no
`fromLoop` → every walkTo crossing gate-blocked): 2 perk tests → green as
parked-Manual live play; 4 walkTo tests → `enabled:false` KNOWN-DEFERRED
to M6. Substrates 45/45. **M4 COMPLETE 2026-07-23 (Opus session 70): the in-app
record→playback leg `9e5881a8c`, annotations `7d6837e04`, UI
`47c3a7f34`, docs — all pushed; substrates 46/46, vitest 3247/3248 (the
one red is the documented braidRegime2 flake).** The in-app leg
(`jta-record-playback-crosses-zone-boundary`) is multi-region and drives
the REAL loops queue: parked Record → hand-played fork task → walkTo
departure → recording persisted+bound+auto-switched → the same block
restarted in Playback replays through the jtaQueueEngine executor and
crosses the zone boundary again, with the energyBonusSync assertion
folded in. **It found a real slice-3 bug: `jtaQueueEngine` was
`enabled: false` in `modules.json`, so `getEngine()` returned null and
jta Playback crossed the exit WITHOUT replaying — a bare teleport the
unit tests (which stub the engine) could not see.** Kickoff open-qs
ANSWERED (memory topic): customQueues stays deferred; record-clamp =
'manual'; annotation resources = consumable items + XP
tracked-not-displayed, mana DEFERRED. **NEXT: M6, then omsi arc D.** jta CLASSIFIED FINE-GRAINED
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
memory `project_loops_block_modes` M4 block); **M5** runner/bounce —
**SHIPPED + PUSHED 2026-07-23 (session 72, Opus): `0e3a2751c` (1/n
category plumbing), `15c5f206c` (2/n drain + explicit-only costs),
`11e570812` (3/n summary Record), `2406ce422` (4/n instant-apply
Playback), `8910cafdf` (5/n UI + in-app leg, gitlink bump to shared
`be281ba` — user-approved), docs (6/n).** Design ruled 2026-07-23 (Fable
session 71); kickoff *(NewDocs)*
`NewDocs/plans/loops-m5-runner-bounce-opus-kickoff.md`. NOT coarse/fine — a
NEW third **SUMMARY** capture category (user ruling, amends the M3b
two-shape contract): recording = the visit's net result (duration +
performed checks + costed actions + M4 annotations + departure); Playback =
instant-only host-side apply with REPLAY-TIME repricing (recorded seconds ×
current XP-discounted per-region rate; iframe does not replay); their first
live economy = a time drain (default 1 mana/s, per-region
`timeDrainPerSecond`, XP-scaled) charged ONLY during parked live play;
per-action costs charge only when EXPLICIT in loop_costs (no 50/100
fallbacks; costGenerator must not double-charge); Record rewrites the
interior to performed checks; bot walkTo untouched but Playback-unreachable
(M6); requiresLoopMode NOT declared (not loop games). Gate opt-in fallout was NIL as predicted
(substrates 46/46 unchanged after the declarations). Runner/bounce are
IDENTICAL across the whole loop surface (shared bridge/proxy) — one
implementation, two declarations.

**AS-BUILT deltas from the kickoff (3, all worth knowing):** (a) the
kickoff's costGenerator requirement had to land in **both** cost
generators — only the PURE one (`shared/procgen/loopCostGenerator.js`,
submodule) actually stamps `loop_costs` into generated presets, so
without it "explicit-only per-action costs" was a no-op in every real
world; that forced the one gitlink bump of the arc (asked + approved).
(b) The in-app leg does NOT procgen its world: generating a 6-region
runner spiral in-page blocks the main thread ~2 min and times out every
iframe heartbeat, so `runner-summary-record-playback` loads the committed
`runner_worldgen` preset and generates only the loop_costs sidecar (which
doubles as end-to-end proof the generator time-prices summary regions);
the flat test level is configured AFTER the block parks, because the
queue's arrival move makes procgenPlayer re-publish `runner:loadRegion`.
(c) `gameState:regionChanged` already carries `exitName` through from the
originating `user:regionMove` — loops was just discarding it — so the
recorded departure needed no new receiver.
**DEFERRED TO M6:** `verify-bounce-loop-mode.mjs`. Parent-commit control
run at `12c4ce900` confirms it was ALREADY red pre-M5, and for a reason
the kickoff hadn't predicted: its `bounce_loop_worldgen` fixture is not
in the repo at all, so it dies at the first assertion and never reaches
the walkTo contract. Header note added; M6 should rebuild it around the
Bot radio (the contract it was written for) or delete it;
**M6 COMPLETE 2026-07-24 (Opus implementation, Fable-verified per slice):**
`74a2ca62f` (rename) → `05979752f` (Bot radio, one trigger for both
solvers) → `6d70e112b` (economy by capture shape) → `018930e58` (Instant
per-capability) → `3c89ad817` (sticky-Instant both-ways fix + the
never-real energy-bonus deferral reversed) → `257763770` (jta Bot in-app
leg) → `cbe30a107` (runner Bot economy leg; verify-bounce-loop-mode.mjs
DELETED) → `6ea706380` (docs) → `cecab4b19` (bot-wake fromReset fix +
honest deferrals). Durable contract: loop-recording.md (Bot flow, solver,
per-capability Instant, the solver-park depletion + reset-teleport
gotchas). Kickoff *(NewDocs)* `loops-m6-bot-solver-opus-kickoff.md`.
Gates at close: substrates **50/50**, vitest 3333/3334 (braidRegime2
flake), regression 1/1, CI green per slice.
Delivered vs kickoff: full solver unification (the pre-dispatch
auto-delegation tick — which silently SHADOWED Record/Playback on
manaEnabled maze regions — is retired, regression-pinned positive-first);
`executeVia:'playbackBot'`→`'solver'` host-only (the shared-submodule
JSDoc x2 followed in the post-D2 cleanup phase, shared `006cb40`); one
economy by shape
(jta double-charge dead; summary bots drain by time, XP 1:1); Bot×Instant
jta-only, set BOTH WAYS (jta `setInstantMode` is a sticky MODE with no
native unset — one Instant block used to leave the whole session
instant); bot wake now fromReset-gated (a fork-propagated reset teleport
mid-walk used to hard-pause the queue PERMANENTLY — release + resume
instead, checked before the destination match so a reset onto the
destination retries, never falsely completes).
**FOLLOW-UPS QUEUED OUT OF M6 (both jta-domain, not loops):**
(1) **jta bridge bug, diagnosed — REFUTED and CLOSED 2026-07-25**
(post-D2 cleanup item 2). The M6-era diagnosis said `loadRegion` calls
`_applyCatchUpResets()` BEFORE reading `_completedThisLoop.has(regionId)`
and prescribed reordering the read. Both halves were wrong. The ordering
is CORRECT — a loop reset genuinely un-plays the zone (`doAnyReset`
rebuilds it) and `loadZone({completed:true})` grants every task FOR FREE,
so honoring a pre-reset completion would hand back a zone the reset took
away — and the reorder was INERT anyway: the `gameState:loopReset`
subscriber bumps `_hostResetCount` and clears `_completedThisLoop` in the
SAME handler, so a pending delta always comes with an already-cleared
set. What was actually broken was the witness's own prep (it only pumped
ticks; managed zone play has no automation unless a walk arms it, so the
zone never completed). Shipped instead: prep plays zone 0 with explicit
`performTask` calls (Travel last), witness ENABLED with a leg pinning the
reset semantics, plus a warn-level tripwire in `loadRegion` in case a
refactor ever splits the count bump from the clear. Ruling in jta.md.
(1b) **jta latched-energy-reset deadlock — FIXED 2026-07-24 (session 68,
outer `7cdbc153f`), a DIFFERENT bug from (1).** This is what made
`jta-bot-walkto-exit` hang ~1 run in 3 (long misfiled as the documented
concurrent-load flake; the new poll-timeout evidence disproved that —
861/900 polls on schedule, load 0.94/8 cpus → STUCK, on an idle box).
The fork latches `is_in_energy_reset` at energy 0 and `updateGamestate()`
returns early while it is set; in managed mode only the bridge clears it,
via `_applyCatchUpResets()`, which fires only when the HOST's reset count
advances — which needs the pool at 0, which needs drains, which need a
running game. `_syncEnergyFromPool()` closes the loop by pinning energy
above 0 while latched, hiding the run's end. Bridge now completes the
reset when it sees the impossible state (latched WITH energy > 0),
persisted ~1s so it cannot race the legitimate catch-up-then-pin order;
plus a 30s walk-stall watchdog and per-call-site `_clearPendingWalk`
reasons. Verified by 8 consecutive green substrates runs **with the
breaker firing in 4 of them** (the deadlock still occurs at ~50% and is
repaired each time — positive evidence, not absence of failure).
(1c) **The deeper reset-authority fix — SHIPPED 2026-07-24 (session 69),
its own slice before arc D slice 4.** Four rulings taken up front (it is
a contract change, same "who resets a frozen substrate" question as D2
recon item 4): decline the WHOLE pin (current *and* max) while latched;
DROP the declined pool value (a deferred pre-reset value would overwrite
the refill the post-reset pin carries); NO call-site exemptions — the
guard lives inside `_syncEnergyFromPool` so the contract is "the pin
never raises energy while the fork is latched", full stop; breaker STAYS
as a tripwire.
**The design pass earned its keep: declining ALONE would have shipped a
second, quieter deadlock.** The latch is set at exactly energy 0 but the
host decides on the POOL reaching 0, and those diverge (the fork's
`doAnyReset` refills to its own `max_energy`, the host to `maxMana`, and
in bonus-sync mode the reconciling bonus is reported a poll later) — so
declining leaves the fork frozen at 0 with mana still in the pool, which
nothing can drain, and **the breaker is blind to it** (it requires energy
> 0). So the slice also has the poll REPORT the latch as
`substrate:resourceReset` — the same run-end event a game-initiated reset
uses — published AFTER the drain mirroring, so a pool that empties in the
same beat fires the reset itself and the report is dropped by the
router's existing race guard. The bridge never runs `doEnergyReset` for
this and never touches `_lastAppliedResetCount`: the host fires the loop
reset and its catch-up clears the latch, so **the host stays the sole
reset authority — the fix is to stop lying to it, not to take the
decision away from it.** This also covers a run end drain-watching cannot
see at all: `handleThresholdStall`'s "End Run" latches with energy left
over. Third find, from the first green run's own log: `loadRegion`'s
`_lastSampledEnergy = _hostCurrentMana` re-baseline became a LIE once the
pin can decline (it made the next poll publish a drain of the whole pool
the game never spent) — now baselines to the fork's real energy.
New deterministic leg `jta-latched-run-end-not-masked-by-pin` (substrates
52→53) builds the divergence directly and FOLDS `setEnergy` mutations
rather than polling, because the reset erases the state within a beat.
Both halves proven to bite by neutering: dropping the guard reddens the
masking assertion; dropping the report hangs the fork for 41s with the
breaker never firing — deadlock B, observed.
ACCEPTANCE (the breaker as oracle, since the deadlock occurred at ~50%
and one green run is a coin flip): **8 consecutive green substrates runs
53/53 with ZERO breaker firings** (prior baseline: 4 firings in 8), and
the new path exercised — 5 run-end reports per run. Gates: vitest 3336,
regression 31/31, compare-runs clean, submodules clean (outer-repo only).
(2) **The 2 jta progression marathons**
(`jta-randomized-balanced-progression`, `jta-dataset-world-progression`)
stay disabled: balance/dataset validation must run NORMAL ticking
(Instant = completeTaskInstantly, affordability-blind —
jtaBalanceTests.js:173) and multi-zone normal-ticking exceeds gate
budgets regardless of drive mechanism. As written they are gate-blocked
(direct unparked walkTo) and NOT runnable even on demand; revival =
restructure onto Bot blocks (unblocked by the 5d wake fix) in a
runtime-budgeted home. Their unique strata (randomized-world cold solve +
AP-authoritative perk accounting; dataset-world progression) are
otherwise uncovered.
Omsi arc D re-queues AFTER this track (see §4); it inherits the mode
seams plus TWO contracts written for it: the solver-park depletion rule
(the mana wake only owns `_manualActionEntered` parks — a spend site that
fires while no frame runs must call its own OOM check) and the
reset-teleport bot-wake semantics. ~~Omsi Instant last of all.~~
SUPERSEDED 2026-07-25 by the Instant-policy pass — omsi Instant SHIPPED as
slice 1 (see §"Instant-policy pass" below).

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
   31/31 · check-omsi-mana-leg OK · omsi_substrate_test and
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
   after M1+M2, ideally M6 so the solver seam is final). ~~Omsi INSTANT is
   fork-slice work and comes LAST of all substrates.~~ **BOTH halves of
   that were wrong, and it SHIPPED 2026-07-25** — Instant needed no fork
   slice at all (the fork has `step(n)` and the bridge already owns the
   clock calling it), and it went first, not last.
   **ARC D DESIGN PASS DONE 2026-07-24 (Fable, post-M6): kickoff READY —
   *(NewDocs)* `omsiloops/omsi-loops-arc-d-loops-mode-opus-kickoff.md`.
   Four user rulings (AskUserQuestion, settled): (1) recording = the
   AUTHORED native queue, region-scoped (`actions.next` minus synthetic
   exits; NOT a performed log — an N-loop visit's log is the queue ×N);
   Playback installs it and RUNS THE GAME to the exit, across native
   resets; (2) **Bot = the fork automation planner** — scheduled as
   **arc D2** behind a mandatory feasibility recon (the planner has never
   run under `?managed=1`; `interceptPrepareRestart` inside the
   synchronous 100ms step is a stall risk; managed automation controls =
   a fork slice, byte-gate cadence returns); D1 declares NO `executeVia`,
   so the Bot radio doesn't render until D2; (3) park-gated stepping (the
   bridge steps ONLY while parked live play on the region or a replay is
   in flight — closes the "grinds+drains while unparked" hole); (4)
   per-region sub-queues NOW (`actions.next` joins the arc-C
   `_regionStore` swap). HEADLINE recon finds: **D1 is entirely
   outer-repo** (fork surface complete — `onActionCompleted` shipped with
   U2 and is UNCONSUMED, the substrate-plan's "still open" note is stale;
   queue write + reset propagation + gated synthetic exits all built;
   stable exit names make `departureExitId` trivial); every omsi preset
   auto-enables loop mode, so declaring `record+playback` arms the strict
   gate immediately — 5 in-app tests assert real AP awards and need the
   parked-Manual restructure (jta precedent), and **first-time checks
   during a grinding replay are an omsi-specific hazard** (unlike jta's
   deduped re-completions) — the bridge must stamp `fromLoop:true` on
   replay-time publishes. Slice 0 = the session-67 `_syncBudgetFromPool`
   re-pin clobber fix (flush-before-pin at the manaChanged-external site
   only). `requiresLoopMode: true` per the standing M4 ruling; NO
   `instant` (fork fast-step unbuilt, omsi last). NEXT: arc D1
   IMPLEMENTATION (Opus).**
   **SLICE 0 SHIPPED + PUSHED 2026-07-24 (session 68, outer `7738f1899`,
   zero fork edits):** the re-pin clobber fix — `_samplePoolMirror()` now
   returns the delta it published, `_syncBudgetFromPool({flushMirror})`
   flushes the pending delta before pinning **at the manaChanged-external
   site only** and then targets the pool value the host will hold once
   that delta lands (converges in one round trip, not two); a
   `_pinningBudget` guard documents the re-entrancy hazard (unreachable
   over postMessage today). The two evidence-gated retry guards STAY —
   they were silent in every run, so a firing guard is now a regression
   signal. Gates: substrates 50/50 solo · vitest 3334/3334 · regression.
   **SLICE 1 SHIPPED + PUSHED 2026-07-24 (outer `71acfd435`, zero fork
   edits):** the `loopSupport` declaration (manual/record/playback/
   `requiresLoopMode`, `queueActions: ['regionMove']`, no `instant`, no
   `executeVia`) + the shared `PlaybackProxy` on `omsi:playbackControl` +
   `fromLoop` stamping + the parked-Manual test restructures. Two
   corrections to the kickoff worth carrying forward: (a)
   **`takeLastRecording` ships WITH the capability block, not with slice
   4's capture** — its PRESENCE is what makes `_captureShapeFor` answer
   `'fine'`, so declaring `record+playback` without it would make omsi
   COARSE for slices 1–3 and loops would charge `loop_costs` on every
   observed check ON TOP of the bridge's native mana mirror (double
   billing, enough to trip a depletion reset mid-visit); the library now
   holds the jta-shaped pull-once slot and the stash simply stays empty
   until slice 4 (an empty pull persists nothing = today's behavior).
   (b) **The gate-fallout inventory missed two legs**: the kickoff's
   "test moves are exit-less → syntheticMove-exempt" holds for
   `moveToRegion` but NOT for `omsi-region-split-round-trip`, whose
   SYNTHETIC-EXIT crossings carry the real graph `exitName` and are
   therefore performed player actions; and `omsi-unlock-seed-before-
   fanout` asserts a real award too. 7 legs restructured, not 5. Shared
   helper `parkManualBlocks(tc, hops, mode)` (jta's helper generalized to
   a hop LIST; clears the path via `gameState.clearPath` first — loops'
   `clearQueue` would teleport the player to the loop start). ⚠ The
   `fromLoop` stamping is NOT yet exercised — nothing drives a replay
   until slice 4/5. Gates: substrates 50/50 cold+warm · vitest 3336
   (+2) · regression 31/31.
   **SLICE 2 SHIPPED + PUSHED 2026-07-24 (outer `f2e392df1`, zero fork
   edits):** park-gated stepping. Gate = `(enforced, livePlayRegion)`
   pushed over `omsi:playbackControl` + the bridge's own replay flag.
   Design points: the host pushes loops' `livePlayRegion()` **verbatim,
   not a boolean** (the queue may be parked on another substrate's
   region, and only the bridge knows which region it has loaded — so a
   region SWAP needs no push); it is a **200ms poll, NOT event
   subscriptions** (the answer changes on park / exit / wrong-exit /
   hard-pause / user-pause / loop-reset / block-mode change / queue edit
   / loop-mode toggle — a missed edge silently freezes the game or
   silently lets it grind, which is the failure the gate exists to
   prevent), push-on-change only; the gate withholds `m.step()` ONLY
   (the mana mirror + victory watch stay ungated, the clock interval
   keeps running, elapsed is re-baselined every callback so a closed
   gate can't bank time). ⚠ **arc D2 must extend the payload**:
   `livePlayRegion()` is null while a solver drives, so the Bot would
   run against a frozen clock. The kickoff's recon that no test relied
   on background stepping was WRONG — `omsi-loop-exhaustion-single-
   reset` is exactly that test and now parks. New leg
   `omsi-step-gate-parks-the-clock` (substrates 50→**51**; the config
   ENUMERATES ids). Two witness lessons from building it, both in its
   comments: the fork's `totalTicks` (effective time) is NOT a witness —
   a fork left mid-restart-loop by an earlier suite leg burned 400 mana
   with ZERO effective time (passed solo, failed in-suite); and the
   first form polled for a pool drop from a 50-mana pool that parked
   play empties in ~1s before the depletion reset refills it (a poll
   cannot see a transient a synchronous refill erases). Gates:
   substrates **51/51 cold+warm** · vitest 3336 · regression 31/31.
   **SLICE 3 SHIPPED + PUSHED 2026-07-24 (outer `0112a9fc5`, zero fork
   edits):** per-region authored queues. `actions.next` joins the arc-C
   swap via `_regionQueueStore` — **its own Map, NOT a key inside
   `_regionStore`'s snapshots** (those go verbatim to
   `m.loadRegionState`, which walks the town's value-prop keys). Dumped
   on exit, reinstalled on entry, EMPTY on a region entered for the first
   time, cleared on rulesLoaded with the rest of the per-world region
   state. Two filters, both load-bearing: the **DUMP strips
   synthetic-exit entries** (region-scoped actions — `setActiveRegion`
   deletes the outgoing region's, `_installRegionExits` injects the
   incoming region's — so a stored exit name is one that no longer
   resolves, and `actions.restart()`'s `translateClassNames` THROWS on an
   unknown name rather than skipping it; stripping at DUMP time also
   makes the load-order question moot and is symmetric with slice 4's
   capture filter), and the **RESTORE filters `totalActionList`
   membership** (the saving.js:1362 guard) as the crash backstop. The two
   orderings that hold it together: restore lands BEFORE
   `_applyCatchUpResets` (so a catch-up restart compiles the INCOMING
   region's plan), and `_installRegionExits` clears synthetics with a
   NAME PREDICATE (so a restored plan of real actions passes through it).
   ⚠ **Known boundary left to slice 4:** the restore rewrites `next`, not
   `actions.current`, so a loop already in flight finishes on the
   OUTGOING region's compiled list (≤1 loop of lag; omsi restarts
   constantly). Slice 4's replay install is the case that cannot tolerate
   that and must force the recompile. New leg
   `omsi-region-split-per-region-queues` (substrates 51→**52**; the
   config ENUMERATES ids), 19 conditions — **proven non-vacuous by a
   control run with strip+restore neutered: 6 conditions red while
   `omsi-region-split-round-trip` stayed green.** Test note worth
   carrying: the leg queues its synthetic exit entry DISABLED, because an
   enabled one fires itself the moment the engine's own `Wander` progress
   crosses the Explore gate and the leg would race its own crossing; the
   gate-open→`finish()` window is kept synchronous for the same reason
   (the bridge clock is a Worker message, so nothing ticks inside one
   synchronous block). Gates: substrates **52/52 cold+warm** (compare-runs:
   the new leg is the only roster change) · vitest 3336 · regression
   31/31 · fork clean at `2bda39b`.
   **SLICE 4 SHIPPED 2026-07-25 (outer `8c79f58ae`, zero fork edits):**
   Record capture + Playback replay — the fine-grained round trip omsi
   declared in slice 1 but never drove. CAPTURE: the synthetic-exit
   callback publishes `omsi:visitRecording` BEFORE `_dispatchRegionMove`
   (stash-before-regionMove — the loops Record-exit wake pulls when the
   move lands), and the snapshot is `_dumpRegionQueue()` ITSELF: under
   ruling 1 a recording IS a plan snapshot, so the capture and slice 3's
   per-region dump are one function, one strip filter. Published on
   EVERY synthetic departure (the host slot is pull-once and only a
   Record block pulls); a replay's own departure re-publishes the plan it
   replayed, so that is idempotent rather than lossy. REPLAY: no separate
   executor and none needed — the recording is a plan and the fork's
   queue is what executes plans, so the bridge clears, installs
   (`totalActionList`-filtered), queues the recorded departure exit LAST
   **bypassing that filter** (a synthetic exit is in the `Action` table,
   which is what `translateClassNames` resolves against, but never in
   `totalActionList`), and holds the replay window open while the fork
   grinds across its own resets. Three judgement calls worth carrying:
   (a) a replay that cannot RESOLVE its departure is **refused, not
   started** — the departure is the termination condition and an
   unbounded grind would drain the shared pool forever — while a recorded
   queue whose GATE never opens parks indefinitely (Manual-equivalent,
   deliberately no timeout teleport); (b) the install forces the loop to
   recompile (the staleness slice 3 deferred), and that `restartLoop()`
   runs under `_applyingHostReset` — ⚠ **the bridge must not fabricate a
   run-end signal for the host**, which is the sole reset authority (the
   session-69 contract); (c) the vocabulary conversion lives host-side in
   the library, BOTH directions, where vitest can reach it without engine
   globals and the bridge keeps importing nothing from `shared/` (omsi
   action names are stable engine ids, so name ≡ actionId). New leg
   `omsi-record-playback-crosses-region` (substrates 53→**54**; the
   config ENUMERATES ids), asserting EFFECTS: the replay starts with the
   Explore gate CLOSED and 150 exp short of it while the recorded
   `Wander` grants exactly 200, so the crossing is IMPOSSIBLE unless the
   fork completed the recorded action — proven non-vacuous by two control
   runs (capture neutered → the Record half red; replay install neutered
   → the install/crossing red). The crossing is FOLDED from the
   dispatcher, not polled (new `watchRegionMoves` helper): an omsi loop
   ends one tick after a departure fires, so the run-end report and its
   reset teleport make "current region is the target" a transient.
   ⚠ **Observed, pre-existing, not slice 4's doing — and it bounds what
   "grinds across resets" can mean.** A fork loop boundary does NOT stay
   inside the fork: `_handleGameRestart` reports it, the host fires a real
   loop reset, and `fireLoopResetTeleport` yanks the player to the loop
   start — which reaches the bridge as a regionChanged-away and ENDS the
   replay window (`_endReplay('left the region')`). Only two boundaries
   are invisible to the host: our own `_applyingHostReset` restarts
   (including the replay install's recompile) and the no-progress guard's
   zero-effective-time ones. So a replay that outlives one run resumes
   NOT by the window surviving but by loops' **generic queue-restart
   retry** (loop-recording.md M6) re-entering the block and calling
   `replayActions` again — which is why the install is written to be
   idempotent. ⚠ **That retry path is UNCOVERED**: the leg sizes the pool
   so the whole replay fits in one loop, precisely so the teleport can't
   interrupt it mid-assertion. A multi-run replay leg is the obvious
   follow-up (and is the same wake path arc D2's bot needs). Separately:
   because a loop also ends by exhausting its queue and the departure is
   the queue's last entry, EVERY omsi departure — live or replayed — is
   followed within a tick by a native loop end, a run-end report and that
   teleport. All of it is omsi's `requiresLoopMode` contract rather than
   a defect, but slice 6 should say so out loud. Gates: substrates **54/54 cold+warm**
   (compare-runs: the new leg is the only roster change) · vitest 3342
   (+6) · regression 31/31 (one re-run: `test_path_analyzer_panel` failed
   once under load and passed solo — a PRE-EXISTING flake, its
   `pollForCondition(fn, 15000, 50, label)` call has the label/timeout
   arguments swapped, so it really polls for 50ms; worth a one-line fix
   in its own commit, which may unmask a genuine slow path) · fork clean
   at `2bda39b`, no gitlink bump · presets untouched.
   **SLICE 4b SHIPPED 2026-07-25 (outer `8550d3d30`, zero fork edits):**
   the multi-run replay retry — and the retry path above turned out to be
   BROKEN, not merely uncovered. New leg `omsi-multi-run-replay-retry`
   (substrates 54→**55**) drives a replay at the pool real play has and
   watched it hang: STUCK, 675/720 polls, checkFn 0.0s, with
   `manualEntered=true manualRegion=<the region the player was teleported
   OUT of> isProcessing=false index=0`. **The fix is HOST-SIDE in loops**
   (shared block-mode machinery — jta/maze/TA/runner/bounce all ride it;
   shape confirmed with the user before implementing, per the kickoff's
   stop-and-ask). `gameState:loopReset` is published ONLY by
   `gameState.triggerLoopReset`, i.e. exclusively by resourceChannels'
   out-of-mana flow, while loops' own reset is `_resetLoop`
   (`loopState:loopReset`) — and the two disagreed: the substrate seam ran
   `_resetActionsProgress()` alone, so FOUR pieces of park state survived
   a reset that had just teleported the player away: the park flags,
   `isProcessing` (⚠ **both park entries call `stopProcessing()`, so the
   frame loop is DEAD, not dormant — M6's `_resumeFrameLoopIfProcessing`
   would NOT have sufficed**; it bails on `!isProcessing`, and a bot park
   never stops processing), `_boundReplayCheckedIndex` (left stale, a
   retry re-entering the block falls through to the generic executor — a
   **silent crossing of an exit that was never replayed**, worse than the
   hang) and `_queuePausedUntilReset`. New `_releaseParkForReset()` clears
   all four, discards an in-flight Record capture the way `_resetLoop`
   already does, and resumes. Two judgement calls worth carrying: (a) it
   lives on the **loopReset subscriber, not the manual wake's `fromReset`
   branch** — `setCurrentRegion` publishes `regionChanged` only on an
   actual CHANGE, so a Playback block ON the start region gets a reset
   with no regionChanged at all and a wake-side fix would never fire; the
   subscriber runs before the teleport, which is safe because the resume
   schedules a rAF; (b) the resume is **unconditional**, matching the M6
   bot branch rather than `_maybeResetForOOM`'s `autoRestartQueue` check —
   that flag defaults OFF, so honouring it would make multi-run replays
   something users had to find a checkbox for. ⚠ **User wants that
   revisited eventually** ("investigate if we can honour autoRestartQueue")
   — a standing follow-up, not a slice-4b decision. Leg shape: a LEADING
   hop (`region_0_0 -exit_0-> r0 -> r1`), because `region_0_0` is the
   fixture's resolved start and therefore the teleport target, so the
   queue's index 0 is where the player lands each run; its maze approach
   block is Manual and the leg WALKS it every run (a regionMove carrying
   the real exit, gate-allowed as `parkedLivePlay`) — `parkManualBlocks`
   gained a per-hop `mode` override for that, since one mode on every hop
   source cannot express Manual-approach + Playback-target. Effects
   asserted and events folded: ≥1 `fromReset` teleport between replay
   start and crossing, every teleport landing on index 0's region, ≥2
   walk-backs (**a park that never released cannot produce a second one**)
   and a fork action count only a multi-run grind reaches. Observed: 3
   reset-interrupted runs, 4 walk-backs, 3 Wanders + the departure, 21s.
   Non-vacuity by THREE controls (pre-fix / resume removed / park flag
   left set — all FAILED at 1 walk-back). ⚠ **Removing
   `_boundReplayCheckedIndex = -1` alone did NOT redden the leg** — its
   queue routes through a manual wake, whose match branch clears the guard
   for unrelated reasons — so that field and `_queuePausedUntilReset` are
   pinned by a new `blockModes.test.js` describe instead (which also
   covers the Record discard, the unparked no-op, the paused no-op and the
   bot-park hands-off). Sizing note for anyone re-running it: the FIRST
   interrupted run starts at ~100 mana, not 350 — the Record leg leaves
   the pool drained and only the reset refills to max. Gates: substrates
   **55/55 cold+warm** (compare-runs: the new leg is the only roster
   change) · vitest 3342→**3349** (+7) · regression 31/31 first try · fork
   clean at `2bda39b`, no gitlink bump · presets untouched.
   **NEXT: slice 5 is COVERED by the leg above** (the kickoff's separate
   in-app slice) — remaining are **slice 6 (docs/bookkeeping)**, which now
   has the multi-run contract to write down, and **arc D2** behind its
   feasibility recon (its multi-reset bot leg rides the wake path slice 4b
   just settled).
   **SLICE 6 SHIPPED 2026-07-25 — ARC D1 COMPLETE.** Docs-only (no
   `frontend/` file touched, so the suites were not the gate; every
   relative link + anchor verified, `find_orphaned_docs.py` clean inside
   `docs/json`). Three deliverables: (1) NEW
   `docs/json/developer/procgen/omsi.md` — the first per-substrate page
   omsi has ever had, covering all four arcs (A unlockScale, B XML
   de-hardcoding, C region split, D1 loops mode), the fork pin + byte-gate
   cadence (⚠ `--worktree`), the clock/mana-mirror/reset-propagation
   contract, the step gate, per-region queues, plan-snapshot Record,
   Playback and the ~350-mana economy note; linked from `procgen/README.md`
   (six→seven substrates). (2) The **multi-run Playback contract** as a new
   `loop-recording.md` §"A replay bigger than one run": the replay window
   does NOT survive a run boundary, loops' generic queue-restart retry is
   what continues it, and the three requirements that bind every
   fine-grained substrate (idempotent install; departure = termination
   condition, refuse a replay that can't resolve one; a route home from the
   reset target). (3) Stale claims fixed: the reset-teleport paragraph
   rewritten as a **two-park-kinds × two-reset-flows** table (the M6
   `_resumeFrameLoopIfProcessing` bails on `!isProcessing`, which is why it
   never generalized to the Manual/Playback park), `loop-recording.md`
   :162/:168, `substrate-registry.md` :60 + the capability matrix (seventh
   `omsi` column + a new `requiresLoopMode` row + entry source), and the
   fine-grained roster in four more places. New gotcha **"Two reset flows,
   and they disagreed"** in `gotchas.md`, beside the frozen-substrate entry
   — including "`setCurrentRegion` publishes `regionChanged` only on an
   actual CHANGE", the reason the slice-4b fix lives on the reset
   subscriber. ONE home per trap, no duplication. Also swept:
   `architecture.md`'s substrate roster (omsi AND runner were both missing;
   content-source list too). ⚠ **Finding, scoped separately, NOT fixed
   here:** `docs/json/features/loops.md` — the user-facing loops page — has
   ZERO mentions of block modes / Record / Playback / substrates; it
   predates the whole M1–M6 arc. Nothing on it is *false*, so slice 6 added
   only a "not yet described here" pointer to `loop-recording.md`; writing
   the user-facing block-mode section is its own slice.
   **ARC D2 FEASIBILITY RECON + RULINGS DONE 2026-07-25 (Fable): kickoff
   READY — *(NewDocs)* `omsiloops/omsi-loops-arc-d2-bot-planner-opus-kickoff.md`
   (probe script preserved beside it). D2 is FEASIBLE and outer-repo by
   design.** Recon headlines, all live-verified: (R1) the planner RUNS
   under `?managed=1` — probe drove a real worker plan in 126ms, zero
   errors; the automation branch is ALREADY in the pinned fork line
   (`48bd32e` ∈ ancestors of `2bda39b`), no fork merge needed. (R2) the
   kickoff's stall fear was misaimed — boundary main-thread cost is
   ~5.5ms (planning is worker-side); the REAL bug is PHANTOM LOOPS:
   `singleTick()` has no `gameIsStopped` guard (it lives in the rAF path
   managed mode disables), so a held boundary mints one fake loop per
   stepped tick (measured 500/500) and inflates effectiveTime
   quadratically. ⚠ SLICE-0 CORRECTION (implementing session,
   2026-07-25): the originally proposed `stoppedAt` gate is WRONG —
   `load()` ends with a `pauseGame()` toggle so `stoppedAt` is
   ambient-TRUE in ordinary managed play and gating on it freezes omsi;
   the correct gate is the HELD-BOUNDARY predicate (`timer >= timeNeeded`
   still true after a step batch returns — 0 false positives across
   1,600 batches, fires within 4 of a real pause; planner-agnostic, so
   no fork edit for the private `pausedByPlanner`). Cold engage
   auto-installs but does NOT resume — the engage path starts the plan
   via the slice-4 recompile-under-`_applyingHostReset` pattern, never a
   bare restart (fabricated run-end). jta precedent: the bot departure is
   UNSTAMPED (passes as queue execution); only `_publishLocationCheck`
   during the grind is the open stamping question. (R3) the parent kickoff's "managed
   automation controls = a fork slice" assumption was STALE — bridge.js
   runs IN the iframe with direct global access (`setOption`,
   `AdvancedAutomation.planNow`/`._debug`), and the AP unlock overlay
   already rides `buildWorldConfig()` into every worker request. (R4)
   omsi needs NO host-side OOM call (drains → `substrate:resourceDelta` →
   resourceChannels owns OOM; native run ends already report). Four user
   rulings settled: Bot goal = EXIT-PRIORITY ("always prioritize
   unlocking and reaching the exit"; the budget-split procgen automation
   profile — % of mana for unlock/grind/exit — is recorded as a POST-D2
   design item); boundary mode = auto + pauseWhilePlanning (pipeline
   OFF); fork edits ALLOWED-when-discovered, not planned (byte-gate
   cadence returns only then); exit crossing at the NEXT LOOP BOUNDARY
   via slice-4's install machinery. Kickoff carries 6 verified traps
   (phantom loops, bot-window stamping, manual-edit-detection misfire,
   the step-gate payload extension, planner-pause × host-reset
   interleave, region confinement) + slices 0–4 with the mandatory
   multi-reset bot leg. NEXT: D2 IMPLEMENTATION (Opus).
   **D2 SLICE 1 SHIPPED + PUSHED 2026-07-25 (Opus, outer `ea843dab3`,
   zero fork edits; slice 0 = recon-only, nothing committed, and it
   CORRECTED the kickoff's gate predicate — see the ⚠ above).** The
   held-boundary clock gate lives in NEW `clockGate.js`
   (`isBoundaryHeld` + `planClockStep`, extracted solely to be pinnable;
   header carries the full stoppedAt refutation), routed through
   `_clockTick` with `_clockStats.skippedHeldBoundary`; reads
   timer/timeNeeded off the fork GLOBALS (getFullState() rebuild is too
   expensive per-callback), fail-OPEN on a non-finite clock (phantom
   loops degrade, a frozen substrate dies). Bot half of the step gate:
   loops public `botSolverRegion()` (shape-independent;
   `_botDrainRegion` delegates, keeping its summary filter), pushed
   beside livePlayRegion in the same payload/cache key;
   `_mayStepClock` opens on a bot park on the bridge's own region.
   Pins: held→zero steps + zero totals movement, productive control,
   out-of-band reopen, 300-for-300 non-vacuity, getter park/dormant
   legs. Gates: vitest 3359/3359 (+10), substrates 55/55 cold+warm
   compare-runs CLEAN (the inertness proof), regression 31/31, fork
   clean at `2bda39b`. ⚠ **Fable review finding for slice 2 (or 1b):
   the gate mirrors only HALF of singleTick's boundary condition** —
   `shouldRestart` (set at actions.js:90 when the compiled list runs
   out of valid actions mid-loop, cleared only by restart()) holds a
   boundary with timer < timeNeeded, and a bot plan that COMPLETES
   before the budget exhausts hits exactly that; `_hasRunnableQueue`
   reads `actions.next`, not the exhausted compiled list, so it does
   not cover it. Same between-batches argument applies — extend
   `isBoundaryHeld` to `shouldRestart || timer >= timeNeeded` (same
   typeof fail-open), falsify with a held queue-exhaustion boundary.
   Riders standing for slice 2: cold-engage starts the plan via the
   slice-4 recompile-under-`_applyingHostReset` pattern (bare restart
   fabricates a run end); stamping decision waits for an observed
   grind-time check.
   **D2 SLICE 1b SHIPPED + PUSHED 2026-07-25 (Opus, `4349f1566`, zero
   fork edits; Fable-verified).** The shouldRestart half of the hold,
   reproduced empirically first (a one-action plan under an
   addMana-EXTENDED budget — held at timer 260/5250 with 4,990 mana in
   the pool, 300 phantom loops invisible to the timer half; ⚠ probe
   lesson: a plan that consumes its whole budget reproduces the SLICE-1
   hold instead — extend the budget past the plan, which is exactly the
   bot-flow shape). `isBoundaryHeld` now mirrors singleTick's full
   `shouldRestart || timer >= timeNeeded`, each half failing open
   INDEPENDENTLY; strict `=== true` (a non-boolean flag can't
   truthy-coerce into a freeze); `_loopClock()` reads the flag off the
   fork global and stamps it onto the getFullState fallback (that
   readout never carried it — and the test fake OMITS it there so the
   pins can't pass through a channel production lacks). Boot window
   checked: saving.js:119 inits shouldRestart TRUE, but noQueue skips
   first and the install path's restartLoop() clears it — suite
   confirms. False-positive control re-run on the OR: 0 firings either
   half across the same 1,600 batches. Gates: vitest 3362/3362 (+3),
   substrates 55/55 cold+warm compare-runs clean, regression 31/31,
   fork clean. NEXT: **slice 2 (the bot window)** with both riders
   standing.
   **D2 SLICE 2 SHIPPED + PUSHED 2026-07-25 (Opus, `1a2ece76a`, zero
   fork edits; Fable-verified).** The bot window: `walkTo` → engage
   (setOption through the REAL setter; plannerMultiTown forced off;
   pre-engagement options restored on disengage) → grind → exit at a
   held boundary → disengage. Rider 1 was LOAD-BEARING: the cold start
   deadlocks without it (onResult installs but only
   resumeIfPlannerPaused starts the engine, and that needs a pause the
   planner can only take at a boundary, which needs a step — while
   shouldRestart is init-true so the slice-1 gate is SHUT; a frozen
   substrate with no reset of its own, the D1 gotcha reincarnated).
   Fix = one suppressed `_forceLoopRecompile` from `_clockTick` once a
   runnable plan exists. **The crossing INVERTED the kickoff's trap-3
   order — install the exit plan FIRST, then disengage**: disengaging at
   a held boundary runs resumeIfPlannerPaused → pauseGame, which
   RESTARTS on `shouldRestart || timer >= timeNeeded` (exactly the held
   state) — unsuppressed, so it reports a run end and the host teleports
   mid-crossing; installing first zeroes the hold so the disengage finds
   nothing to restart, and the same-synchronous-step landing means the
   manual-edit compare never runs. **Stamping RULED: NONE** (jta
   precedent) — `_botExecutedAction` gives a blanket `queueExecution`
   pass (loopState.js:2281) before any flag is consulted, covering both
   grind checks and the departure; stamping would work by accident and
   obscure the carrying exemption; kept reversible, slice 3's award
   assertion is the confirming observation. Measurement (fixture gate
   Wander@5%): default heuristic opens in 90 loops / 63,650 ticks / 28
   plans → **v1 ships default weights, NO targeted escalation**; trap 6
   clean (no travel action in any installed plan). `executeVia:
   'solver'` DECLARED (Bot radio renders; capability-matrix pin updated
   deliberately). Gates: vitest 3362/3362, substrates 55/55 compare-runs
   clean, fork clean — stated plainly: NO test exercises the bot window
   yet; the suites prove inertness for existing paths, the legs are
   slice 3. **Slice-3 notes:** single-run leg needs a seeded explore
   state or lower threshold (90 fork loops ≈ 90 host runs under the D1
   contract); multi-reset leg must ALSO verify walkTo re-dispatch
   idempotence + bot-window end on the teleport's regionChanged-away
   (the `_endReplay` analog) and the trap-5 no-double-reset interleave;
   a plan landing inside one 100ms clock interval un-holds a boundary
   unseen → crossing slips one loop (harmless, but don't time legs
   tightly against it).
   **D2 SLICE 2b QUEUED 2026-07-25 (user design addition, rulings
   settled; kickoff §"Slice 2b" is the spec): per-region max Explore
   level — a full explore RESCALE, not gate tuning.** Region = a
   mini-town compressed into N levels: exit timing, discovery
   schedules, and the UI % all scale; exp hard-capped at
   `expFromLevel(N)`. Config: `regionSplit.exploreMaxLevel` shared
   default + per-region `regions[i]` overrides; default = `max(1,
   round(100/count))`; fixtures 10 or lower; `exploreThreshold` becomes
   a fraction of the REGION's cap (default 1.0 unchanged in meaning).
   Recon: **`Town.getLevel` is the single choke point** (totalDiscovered
   dot-products over levels, unlock rows, UI % all consume it) →
   effective level `min(100, floor(raw·100/N))` + the exp clamp are the
   only fork edits; ride the scale through worldConfig so the planner's
   sim agrees with live play. THIS IS A FORK SLICE — byte-gate
   (`--worktree`), V4, fork npm, ask-first gitlink all return. Lands
   BEFORE slice 3 (legs use the knob instead of seeded explore state).
   ⚠ ROUND-2 CORRECTION (user, same day): the full-complement-per-
   region consequence is VETOED — **quantities MUST partition** (user:
   "otherwise there will be logic mismatch somewhere"). Design is now
   TWO VIEWS of level: EFFECTIVE (raw·100/N) for schedules — unlock-row
   predicates, action thresholds, UI %, exit gate — and RAW capped for
   the discovery-quantity consumers (totalDiscovered evaluator +
   quantity-row dot product), whose LINEAR curves make the 1/count
   partition fall out of the cap for free. Verified current state:
   split worlds emit NO unlock locations at all (arc-C ruling 7 — only
   victory on zone 0), so nothing is mis-partitioned today; the
   composition landmine is documented in the kickoff (global q-row ids
   + per-region local ladders would dedupe regions B..N to nothing —
   host-side per-region step counters at composition time;
   applyManagedTotals needs its own ruling there too).
   **D2 SLICE 2b SHIPPED 2026-07-25 (Opus; fork `cb00b3d` on
   `xml-migration`, outer `95d6981de` + `05e03423d`; NOT pushed, gitlink
   NOT bumped — both awaiting the user).** Built to spec, no ruling
   changed. `Town.regionScale` is a CLASS-STATIC (not an instance prop):
   the planner worker installs it via worldConfig BEFORE `plRestoreSave`,
   which rebuilds `towns` — an instance prop would not survive, and would
   need omitting from every save. Two views landed as `getLevel`
   (effective, wrapped at the SINGLE return site after both scaling
   branches) and `getRawLevel` (raw); the two raw consumers are
   `unlocks.js` `quantityBaseTotal` and the `<totalDiscovered>` compile
   context (marked by `ctx.rawLevels`, since `<progressLevel>` shares one
   evaluator case with `<primaryValue>` and the predicate walk). Verified
   partition: at exploreMaxLevel 10 a fully-explored region holds
   `totalPots` 50 against the town's 500, and fires a tenth of the
   quantity ROWS. Three things the spec did not call out and are now
   pinned: (a) `expForLevel` must pick the LINEAR vs quadratic curve —
   `expFromLevel(N)` is only right for quadratic vars, the two coincide
   solely at level 100; (b) `setActiveRegion` OWES an `adjustAll` +
   `Unlocks.check`, because the host swaps region VALUE state
   (`loadRegionState`, which adjusts under the OUTGOING ladder) before
   region METADATA — witnessed on an unlock row, not on totals (totals
   are raw-driven and would not move); (c) `getPrcToNext` had to move to
   RAW levels or it indexes `expFromLevel` with a level the stored exp
   has never been near. `saving.js`'s two cheat functions took the var's
   own cap too, keeping "exp never exceeds its ceiling" a true global
   invariant (the capped-already fast path depends on it). **RE-MEASURED
   loops-to-gate on the regenerated fixture: 44 loops / 23,050 ticks / 16
   distinct plans** (was 90 / 63,650 / 28 at the 25,250-exp gate; ~2x, not
   the naive 4.6x), trap 6 still clean — that is slice 3's sizing number.
   Gates: byte-gate **461 / 5,195,188 / 9d9952e68bc8373c / 0 RNG
   (`--worktree`)** run BOTH as a parent-commit control and against the
   exact committed bytes · **V4 omsi-parity PASS** (ticks + loops, fork
   HEAD `cb00b3d` vs fork point) · fork `npm test` **288/288** (+9, proven
   non-vacuous by two neutering controls: 6/9 then 8/9 red) · vitest
   **3368** (+6) · substrates **55/55** compare-runs clean (no roster
   change) · regression **31/31**. ⚠ The fixture commit `05e03423d` is
   COUPLED to the gitlink bump: against the old pin the fork's gate still
   divides by 505000, so the legs' 5500-exp seeds read as 1% explored.
   NEXT: slice 3 (the two in-app bot legs), then slice 4 (docs).
   **D2 SLICE 3 SHIPPED + PUSHED 2026-07-25 (Opus, outer `7a247e8ae`,
   zero fork edits).** `omsi-bot-crosses-region` (24 conditions, 85s) +
   `omsi-bot-multi-reset-walk` (19 conditions, 287s), both on
   `omsi_region_split_test`; substrates baseline **55 -> 57**.
   - **The award observation, resolved.** No AP location CAN fire in a
     split fixture (arc-C ruling 7 emits none; victory needs town 1), so
     the leg pins the strict gate's VERDICT instead — a locationCheck
     evaluated in the same tick the window is observed open returns
     `queueExecution`, with `livePlayRegion()` null. That is the slice-2
     no-stamping ruling's confirming observation, and the crossing itself
     is the second one (a real exit name the gate would otherwise block).
   - **TWO BRIDGE FIXES the legs found** — one defect, two paths: the bot
     force-disabled `advancedAutomationEnabled` even when the window never
     ENGAGED (`_startBotWalk` returns early when the gate is already open
     at dispatch — the COMMON case on the last re-dispatch), so nothing
     was saved to restore and a player lost their Advanced Automation.
     `_crossBotExit` + `_endBotWalk` now both gate on `_botSavedOptions`.
     Leg A only caught it because it now SETS the option on first — an
     ambient-false default would have made the assertion vacuous.
   - **⚠ THE 44-LOOP PROBE NUMBER DOES NOT TRANSFER IN-APP.** Standalone
     the planner opens the fixture gate in 19-44 loops; in-app the same
     seed took 25 fork loops for ONE Wander. The probe runs the fork
     continuously, but in-app EVERY fork loop end is reported, the host
     resets, teleports, and the walk is re-dispatched — and the bridge
     re-PINS the budget to the host pool each time, which neutralises the
     planner's favourite early strategy (invest = buy mana). Measured
     in-app: ~12 s per host round trip, ~1 Wander per 6-7 of them.
     Size future legs against the ROUND-TRIP rate, not the probe.
   - **There is no "single-run" bot leg for omsi.** Any walk needing any
     grind spans host resets, because a fork loop end always reports. The
     kickoff's leg (a)/(b) split survives as "short grind" vs "guaranteed
     multi-run" (2 Wanders short = one fork loop cannot do it).
   - Also added `resetOmsiSaveAndReload` (the `idleLoops_substrate` slot
     is shared across a suite run and the planner scores against banked
     stats — jta's bot leg resets for the same reason). Must run with a
     region ACTIVE: the reload waits on the bridge clock.
   - **Playwright per-test timeout 300s -> 900s.** A bot walk is expensive
     in WALL time by construction (50 ticks/s of real time, ~7 s per fork
     loop); test-substrates is now 8.5 min. A ceiling, not a cost.
   - Non-vacuity: neutering `_engagePlanner` turns leg A red on 4 core
     assertions and leg B red on the crossing.
   Gates: substrates 57/57 compare-runs clean (the two new legs are the
   only roster change) · vitest 3368 · regression 31/31 · fork clean at
   `cb00b3d`.
   **D2 SLICE 4 (docs) SHIPPED + PUSHED 2026-07-25 (Opus, `d2d578cc5`) —
   ARC D2 COMPLETE (slices 0-4).** omsi.md gains the Bot section
   (lifecycle + its three load-bearing orderings, the held-boundary clock
   gate and why `stoppedAt` is unusable, the round-trip pacing reality,
   the planner.js probe wrinkle as a named known-issue, and the
   no-AP-award-in-split-fixtures caveat with the gate-verdict pin that
   stands in for it); the arc table, the stale "not built" /
   "no executeVia" / "arc D2 must extend this payload" lines and the
   in-app roster are all resolved. loop-recording.md's Bot flow gains a
   jta-vs-omsi table + the no-stamping ruling stated as a ruling;
   substrate-registry.md's capability matrix shows omsi's Bot as built.
   The durable TESTING lesson landed in omsi.md's non-vacuity paragraph:
   **assert restoration of a value you deliberately made NON-DEFAULT** —
   the option-restore clobber wrote the same `false` the fork defaults
   to, and 2b's recompute witness had the mirror-image trap (a value that
   cannot move). All anchors verified to resolve.
   **ARC D2 CLOSED.** Nothing open. What remains on the omsi roadmap:
   **arc E** (multi-town travel), **arc F** (panel queue editor), and
   **omsi Instant LAST of all substrates** (standing ruling — no fork
   fast-step surface). Two recorded POST-D2 design items, both needing
   their own design pass: (1) the **procgen automation profile** — a
   budget split as percentages of available mana across
   unlock-new-things / grind-stats / reach-exit, which must now be priced
   against the ~12 s round-trip rate rather than fork loops; (2) the
   **emission x split composition** arc, which owns the true end-to-end
   AP award under a Bot and must first solve the quantity-row identity
   landmine (global q-row ids vs per-region local ladders → host-side
   per-region step counters; `applyManagedTotals` needs its own ruling
   there too). Both are documented in `omsi.md`.
   **POST-D2 SEQUENCING (user, 2026-07-25): CLEANUP PHASE →
   INSTANT-POLICY DESIGN PASS → arc E.** Cleanup kickoff *(NewDocs)*
   `cleanup-2026-07-post-d2-opus-kickoff.md`: all four quick fixes
   (path-analyzer flake one-liner ✅ `6fddeded1`; the jta catch-up
   reorder bug + re-enable its witness ✅ `21160646d`, REFUTED and
   rescoped to the witness's own prep; the shared-submodule JSDoc rename
   leftovers ✅ shared `006cb40` / outer `3c2fb2457`, own commit per user;
   the planner.js probe wrinkle ✅ fork `b05bce9` / outer `9d740989f`) +
   three
   bigger items (autoRestartQueue honor investigation ✅ `db3b48c65`;
   the cleanup-backlog.md items ✅ `050a8262c` + `c9888d28f`; the
   features/loops.md user-facing rewrite ✅ `aaa0d9aa8`).
   **PHASE COMPLETE 2026-07-25.** The jta progression marathons stayed
   QUEUED — excluded from this phase.
   Three outcomes worth carrying:
   (a) **`autoRestartQueue` governs the resets loops OWNS** — a
   substrate-driven reset is not loops' to veto, and the "in-flight
   replay/bot is implicit consent" carve-out swallows its own rule
   because Manual and Record span runs on jta/omsi exactly as Playback
   and Bot do. The premise was also wrong: the Bot resume was never
   uniformly unconditional (the drain tick already pauses summary bot
   walks when the flag is off, pinned since M6). One real gap closed
   ON-direction only (user): `_handleManualWake_mana` honoured the flag
   in neither direction. Ruling + the four-resets table live in
   loop-recording.md.
   (b) **The balance-walk fix shipped as a POST-WALK sweep**, not the
   filed solve-in-the-completion-callback: that would patch the task
   definition the sim is mid-completion on and price the replay against
   post-completion energy. The filed open question is answered — the
   fork's first-start hook needs `reps == 0 && progress == 0`, so a task
   already under way when released never fires it, and mid-walk the miss
   self-heals on the next run's replay; only the walk's last runs strand.
   (c) ⚠ **NEW, FILED NOT ACTED ON: the committed `dataset-passb`
   records no longer reproduce.** Re-running the batch gives stalls on 5
   of 6 pairs where Round 2 (2026-07-10) had 0 everywhere. A control run
   proves it is NOT the walk-end sweep; the likely cause is that the
   GENERATED WORLDS moved under Phase A / U-a / the Phase-D rungs, so
   `ds1` seed 1 is a different world now — hypothesis, not finding.
   Deliberately left unbaselined: enshrining a red convergence bar is how
   a regression becomes the reference. Details in cleanup-backlog.md. **NEW DESIGN FACT (user): normal loop-mode play =
   ALL regions Instant except the frontier** — loop wall-clock models
   must assume it; recorded in `project_loops_block_modes`. **And the
   Instant PHILOSOPHY shifted (user): these are IDLE games — waiting is
   expected and strategic; the original omsi had no instant mode.
   Direction for the design pass: Instant ONLY for substrates that were
   not originally idle games — possibly REMOVE jta's Instant (it "still
   has some bugs"; inventory them as recon) and omsi's answer may be
   NEVER rather than "last".** The old "omsi Instant last of all
   substrates" wording above is superseded by this pass.
   **REFINED (user, 2026-07-25, later same day): omsi Instant IS wanted
   at least FOR TESTING, working like jta's — i.e. a TICK PUMP, not a
   tick skip.** Results stay byte-identical by construction because the
   same per-tick code runs the same number of times, just synchronously
   in one frame (jta Instant is already exactly this — the stepTick
   pump). Two variants: (1) per-action — pump `singleTick()` until the
   current action completes; (2) whole-queue batch — pump until the
   region block's queue finishes, display suppressed, ONE view refresh
   at the end (the payoff: the two in-app Bot legs currently run a
   real-time game loop, hence the 900s Playwright timeout). The
   standing "no fast-step surface" premise is STALE post-D2: under
   `?managed=1` the rAF tick() is disabled and the in-iframe bridge
   already drives `singleTick()` batches — an Instant pump is plausibly
   PURE OUTER-REPO (no fork edit, no byte-gate). Carry-over landmines,
   all already codified: completion predicate = the HELD BOUNDARY
   (`timer >= timeNeeded` post-batch, clockGate.js), never `stoppedAt`;
   the no-runnable-entry skip states stay; the mana mirror publishes
   one big delta + a BURST of AP awards at pump end (tests need
   burst-aware assertions); no host round trip mid-pump — scope is one
   region block's queue up to its departing regionMove. Recon item:
   whether `singleTick()` touches `view` or managed mode already leaves
   rendering to the disabled loop (if the latter, display suppression
   is free). POLICY SPLIT for the design pass: player-facing Instant
   (the idle-pacing philosophy question, still open) vs a testing/dev
   fast-forward capability (now WANTED for omsi); whether it ships as
   declared `loopSupport.instant` or a test-only surface is the pass's
   call.
   **PASS OPENED 2026-07-25 (Fable + user) — HEADLINE RULING: Instant
   stays USER-FACING in ALL substrates for now.** Supersedes both the
   remove-jta/omsi-never exploration AND the same-day test-only
   framing; the pass = fix jta's Instant bugs, build omsi's pump
   (user-facing), close coverage gaps. Design doc *(NewDocs)*
   `instant-policy-pass-2026-07.md`: verified coverage matrix (declared:
   maze/tasw/jta/runner/bounce; ABSENT: omsi — the gap; flash + old
   textAdventureSubstrate — slice-3 stragglers) and three slices:
   (1) omsi whole-queue tick pump, Opus kickoff next; (2) jta Instant
   hands-on bug inventory — NOTHING is filed, docs show green, so the
   inventory is experiential and needs the user's symptom descriptions
   as seed; (3) flash/old-TA coverage + the features/loops.md
   "under design review" line updated to the settled ruling.
   **SLICE RULINGS (user, 2026-07-25, same session):** jta bug
   inventory **PARKED** (only evidence = a forgotten past-session
   mention; revisit on a real symptom). **flash = SUMMARY substrate**
   like runner/bounce (1 mana/s drain while running, resource-delta
   summary envelope, instant playback — M5 pattern; own kickoff
   later). **CORRECTED post-slice-1 (user): PARKED — flash is not a
   real substrate yet (no game runs on it); the summary plan waits for
   the first real game, and identity leans PER-GAME substrates (the
   `createFlashSubstrateEntry` factory + 'flash_seedling' comment
   already anticipate exactly this). When unparked: bake the summary
   economy into the FACTORY; likely lands with Seedling Stage 2
   planning, not as a pass slice.** **Old `textAdventureSubstrate`
   module: DEPRECATE** (wrapper
   is the survivor; recon references first, size disable-vs-delete
   from that). **PRIORITY: omsi Instant pump first** — kickoff drafted
   *(NewDocs)* `omsiloops/omsi-loops-instant-pump-opus-kickoff.md`:
   pure-outer-repo expected (the `index.js:98` seam already receives
   `instant` and drops it; pump = `m.step()` batches inside the
   existing step-gate/clockGate machinery, cadence change only), Bot
   honors Instant (jta precedent; the ~285 s bot legs are the payoff),
   keep the real-time walk leg, paced-vs-instant byte-identity check
   as the independent stratum.
   **SLICE 1 SHIPPED + PUSHED 2026-07-25 (`316cc667f`, pure outer-repo
   — no fork edits, no gitlink).** omsi `loopSupport.instant` live for
   Playback AND Bot (the declaration flips both, now pinned as a
   capability-matrix implication + substrate-registry.md note).
   Measured: Playback 14.9 s → 0.60 s (24.7×, same 4 fork actions both
   ways); Bot multi-reset walk 7.2 s (7 walk-backs, 6 host resets,
   2550 pump ticks). Gates: substrates **60/60**, vitest **3395**,
   compare-runs clean. As-built findings live in the kickoff doc:
   `PUMP_BATCH_TICKS === MAX_TICKS_PER_CALLBACK` (the byte-identity
   check fired on a REFERENCE artifact — different tick counts, not a
   pump defect; the tie means the pump never overshoots more than
   paced play can); TWO extra yields required (run end — resets are
   host round trips, and window close — a departure fires mid-batch).
   ⚠ the PACED `omsi-bot-multi-reset-walk` leg's duration is
   load-dependent (measured 102–289 s; the planner is time-boxed
   worker-side) — compare-runs will keep flagging it as a duration
   outlier; it is NOT a regression signal. REMAINING SLICES: old-TA
   deprecation + features/loops.md line — close-out kickoff drafted
   *(NewDocs)* `instant-pass-closeout-opus-kickoff.md` (recon verified
   2026-07-26: default modules.json already runs the wrapper; FOUR
   configs still enable the old module with no wrapper —
   flash/nograph/textadventure/test-spoilers-headed — while bundled
   mode already excludes it; ⚠ when both enabled the OLD module wins
   the substrate id, so flips must be verified by EFFECT; delete is
   ask-first, deprecate = flip + mark). Flash summary conversion is
   PARKED out of the pass (Seedling Stage 2).
   **CLOSE-OUT SLICE A + B SHIPPED 2026-07-26** (`6f5cf556e`,
   `aedd076ae`): old TA module deprecated + disabled in three of the
   four configs, and features/loops.md settled to the ruling. The
   fourth, `modules-textadventure.json`, is a REAL GAP — see the
   `?mode=textadventure` item below.
   **JTA INSTANT FIXED AT THE SOURCE 2026-07-26** (fork `8383af0`):
   `completeTaskInstantly` was affordability-blind — measured, it
   completed a task needing ~36 energy on **5** energy, banking its
   finish effects and unlocks, where paced play died with nothing. It
   now loops the same `progressTask` paced play calls instead of
   predicting cost with a parallel closed-form model (that model was
   independently wrong: it sampled progress-per-tick once, but
   progress-per-tick RISES as skills level, so it over-billed 40 ticks
   where paced spent 36). Paced-vs-instant now agree on reps, run state
   and progress to four decimals across an energy sweep; negative
   control flags 4/4 pre-fix.
   ⇒ ~~**TODO — switch jta Playback from `startInstantPump` to
   `setInstantMode`**~~ **INVESTIGATED AND DECLINED 2026-07-26. KEEP THE
   PUMP.** The affordability premise really is void, but it was not the
   only difference. `setInstantMode` deliberately IGNORES
   `GAMESTATE.repeat_tasks` (the fork's one documented intended
   divergence from paced play): it completes EVERY remaining rep of a
   task. A recording holding a **partial rep-run** — entry `.loops` <
   the task's remaining `max_reps`, ordinary once the player has hit
   "Don't Repeat Tasks", a persisted per-save toggle with hotkey `R`
   that the substrate iframe renders unconditionally — would replay as
   MORE than was recorded. Witness: a record-then-replay differential
   over the committed fork build, each mode in its own process, faithful
   to the real pipeline (recorder coalesces reps → `loops`; the executor
   re-clicks `loops` times and skips an already-completed task).
   Measured, zone 0, 4-entry partial recording, `repeat_tasks` off, pool
   1000: pump spends **109** energy / banks 1,1,1,1 reps / skill 0 at
   level 14; `setInstantMode` spends **190** (+74%) / banks 1,3,1,10 /
   skill 0 at level **72**; at pool 100 the pump completes the recording
   while instant empties the pool, enters an energy reset and never
   performs the last entry. On FULL-rep-run recordings, or with
   `repeat_tasks` on (the default), the two agree EXACTLY: **39/39**
   scenarios over an energy sweep 5..1e6 on final energy, per-task
   reps/progress, all 12 skill levels, items, perks and the fork's run
   log. So the pump is the only one of the two that replays a recording
   AS RECORDED — it is a correctness choice, not legacy caution. Bot
   needs NO change: it drives the live game with no recording to be
   unfaithful to, and `setInstantMode` there is now doubly correct.
   Rationale + numbers now live durably at the pump in `bridge.js` and
   in `docs/json/developer/procgen/jta.md` §"Block modes".
   ⇒ Small follow-up left open: three other comments still cite
   "affordability-blind" as the reason to avoid instant mode
   (`jtaBalance/balancePass.js`, `testCases/jtaBalanceTests.js`,
   `testCases/jtaDatasetTests.js`). Their DECISION (normal ticking) is
   still right — for the `repeat_tasks` reason, plus balancePass's own
   measured fidelity argument — only the cited premise is stale.
   **INSTANT-POLICY PASS CLOSED 2026-07-26.** Slices 1 (omsi pump) / 4
   (old-TA deprecation) / 5 (features/loops.md) shipped + pushed; 2 and
   3 stay parked (the jta bug inventory is superseded in practice by the
   affordability fix above; flash summary waits for Seedling Stage 2).
   `?mode=textadventure` now runs on the wrapper (`763468dcf`) — the
   blocker was one panel predicate, `SubstrateInactiveOverlay` covering
   the wrapper whenever procgenPlayer reported no active substrate,
   which is always without a procgen world; the panel now skips it in
   standalone play. That migration ALSO fixed the deployed live demo,
   which had been showing a dead "Waiting for region…" panel because the
   deprecated module is not in `__BUNDLED_MODULES__`. The deprecated
   `textAdventureSubstrate` is now disabled in all eleven configs and
   reached by nothing; its portable tests were ported first
   (`060c1f88d`, +46, vitest 3395 → 3441).
   ⇒ **DELETED 2026-07-26 (user ruling).** The directory and every
   reference are gone. **vitest baseline 3441 → 3270**, fully accounted:
   the 171 lost tests are exactly the deleted module's own 8 suites
   (11+6+5+28+15+16+18+72), so nothing else broke.
   ⚠ The real risk was NOT the configs. Six headless scripts
   (`scripts/procgen/{sphere-step,spiral-step,dump-sphere-growth,
   dump-shuffled-spiral,dump-grid-growth}.js`,
   `scripts/utils/generate-topdown-preset.js`) plus
   `procgenPipelineEngine.test.js` imported the OLD LIBRARY for its
   registration side effect — and the wrapper library was the one
   substrate library WITHOUT that side effect (it registers only from
   the app's `register()`, which never runs in those contexts). A naive
   path swap would have left `text_adventure` unregistered there, and a
   missing substrate is a skipped region, not an error: the scripts
   would have written worlds silently missing it. Fixed by giving the
   wrapper library the same self-registration block maze/bounce/runner
   have; now documented as its own gotcha.
   ⚠ **TEST HARNESS, shipped this pass** (`0ad4a5443`, `e3112ad2d`): the
   in-app runner raced the whole roster against a 600 s budget and, on
   expiry, published completion flags anyway — so a truncated run
   reported "All Playwright assertions passed" with exit 0. It now fails
   loudly, naming the cause, the test cut off mid-flight and the ones
   that never started. test-substrates is split into `fast` (57 tests,
   ~2m43s) and `bot-walks` (3 real-time legs, ~6m31s) via
   `npm test -- --mode=test-substrates --batch=<name>`; batches select
   whole CATEGORIES and `fast` is the default batch that absorbs
   anything unclaimed, so a new category costs speed, never coverage.
   ✅ **DIAGNOSED + FIXED 2026-07-26.** `omsi-bot-instant-multi-reset-walk`
   was **not** order-dependent — that framing was an artifact of the
   `bot-walks` batch happening to win a race. Run entirely alone the test
   failed **5 of 8** times. There is no poisoning prefix: the leg is a
   **~60 % flake** whose losing branch is a permanent deadlock.
   *Mechanism:* the walk survives on the maze park between fork runs, and
   a depletion `manaChanged` that lands **on that park** takes
   `_handleManualWake_mana` → `_resetLoop()`, which tears the park down
   and then — `autoRestartQueue` off, the default — declines to resume.
   The queue is left stopped with `isPaused` false, `_queueCompleted`
   false and no park, so every wake handler bails on the missing park;
   `livePlayRegion()`/`botSolverRegion()` answer null, the step gate
   closes, and the frozen fork can never end a run and fire the
   substrate reset whose resume is unconditional. The leg then polls a
   dead world for 364 s. Instant made it likely rather than causing it:
   a whole fork run drains inside one synchronous pump. *Fix:* both omsi
   bot legs now set `autoRestartQueue = true` — the flag's own contract
   ("auto-restart IS the retry"), already the practice in the jta bot
   legs; 8/8 green after, `bot-walks` 3/3 with the paced leg unchanged
   at 283 s. The production stop is a **ruled** behaviour (2026-07-25,
   ON-direction only) and is left alone: a present player presses Start.
   Its unattended-walk consequence is now written down in
   loop-recording.md and gotchas.md. `omsi-multi-run-replay-retry` has
   the same exposure and was left alone only because it is green today.
   The jta
   Playback→setInstantMode follow-up was handed to an Opus SUBAGENT
   2026-07-26 (verify-equivalence-first brief; report lands in the
   Fable session).
   **ARC F DESIGN SKETCH RULED (Fable + user, 2026-07-25):** the panel
   queue editor starts with **omsi** — its recording IS the game's own
   authored queue, and both conversions already round-trip through the
   shared `actionQueue` vocabulary (`convertPlanToQueue` /
   `convertQueueToPlan` in omsiSubstrateWrapperLibrary.js; the write
   path already feeds Playback via index.js). Shape: each omsi region
   block in the Loops panel shows its queue in **Record/Playback**
   modes only (Manual/Bot keep the current summary); Playback replays
   the displayed (possibly edited) queue; a successful Record-exit
   replaces it (already the storage behavior — recordings are keyed per
   region block, loops is sole persister). v1 controls =
   **edit-existing-only** (reorder / rep count / delete / disable);
   INSERT needs a per-region action catalog — its own later slice.
   Mid-Record the block shows the stale saved queue (+ a "recording…"
   badge) until the exit lands. Edits **write through** loops' own APIs
   to savedQueueStore immediately — no draft state. This confirms the
   **NEW-module direction** for queue editing (NOT reviving the
   1205-line jtaActionQueue panel): the jta custom-queues
   cleanup-backlog item is REFRAMED as "adapt jta to the arc F editor,
   after omsi" — the post-D2 cleanup phase should NOT attempt it
   (kickoff item 6 annotated accordingly). Flip omsi
   `loopSupport.customQueues` → true when the editor ships; jta's flip
   waits for its adaptation.
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
   `scripts/procgen/check-maze-consumable-tiles.mjs` OK, byte-inert
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

## 5c. Region atlas — real-game maps as procgen regions (arc opened 2026-07-26, post-dates this doc)

Design FULLY RULED in one Fable session 2026-07-26; the durable ruling set,
schema sketch, and phase plan are in **`CC/docs/plans/region-atlas-plan.md`
(read it FIRST — it records the rejected alternatives too, don't re-litigate)**.
One-line summary: per-game "region atlas" document (jta-dataset pattern:
content-hash id, restamp-on-edit) describing a real game's map as physical
regions with logical sub-region subgraphs, sided + teleporter exits, entrance
spawn tiles, and located vanilla items; three compiled projections (vanilla
rules.json → top-down, sphere-sorter via an `atlasDoc` substrateConfig seam,
play-time `playable_payload` binding). Seedling first, RWK second, staged bots
last.

**Phase 1 — atlas schema + validator + fixture: SHIPPED + PUSHED 2026-07-27**
(`5e44dd743` schema + validator + CLI, `b8faac6de` fixture + 52 vitest cases;
full vitest 3380/3380 green, pre-existing baseline 3328 — note the queue's
older "3313" figure has drifted).
- As built: schema `frontend/schema/region-atlas.schema.json`; validator
  `frontend/modules/procgenPipeline/regionAtlasValidator.js` (procgenPipeline
  is already bundled, so the `__BUNDLED_MODULES__` trap never fired); CLI
  `scripts/procgen/region-atlas-validate.mjs [--restamp]`; fixture
  `frontend/modules/flashPanel/atlases/seedling-fixture.json` + a README,
  beside the game's wrapper config in `flashPanel/games/` per the jta
  `datasets/` precedent. All four anchors verified as described.
- **Open question 1 RULED: `<region_id>__<sub_region>` compound**, matching the
  fork-wide scoping separator; a region with no subgraph keeps its bare id.
  Encoded as `apRegionName()`; `__` is forbidden inside region/sub-region ids.
- As-built deltas from the schema sketch (all additive, recorded in the plan
  doc's Phase 1 section): `vanilla_layout.start_sub_region`; `access_rule`
  allowed on boundary exits and locations; `bidirectional` required, never
  defaulted; `rules_source: "mixed"`; and the no-boilerplate rule for
  obstacle-free regions (omit `subgraph`, and then `sub_region` is forbidden
  rather than optional).
**Phase 2 — Seedling map extractor + region-marking tool: SHIPPED + PUSHED
2026-07-27** (`4b152391b` extractor + compact writer, `fbeef5d06` map_ref +
compact restamp, `4903e38a4` the panel, `15a45de03` in-app verifier,
`3fab2ea47` the real starter atlas; full vitest **3471/3471** green, up from
the 3380 Phase-1 baseline).
- **Rulings (user, 2026-07-27)**, all recorded in the plan doc's Phase 2
  section: (1) map display comes from a SOURCE EXTRACTOR over the Ogmo `.oel`
  files, not a runtime capture; (2) the tool is its own GL panel module
  (`regionMarkingTool`), NOT a tileMapAnalyzer mode; (3) the Seedling extract
  is COMMITTED (MIT — decision 7's gitignore constraint is RWK-only);
  (4) Phase-2 acceptance includes a real starter atlas; (5) the APWorld-Editor
  handoff DEFERRED to Phase 3, which is where the projected rules.json it
  hands over actually gets built.
- Open question 3 RULED: separate modules, shared canvas —
  `markingRenderer.js` subclasses the analyzer's `TileMapCanvasRenderer`.
- As built: `scripts/procgen/extract-seedling-map.mjs` +
  `scripts/procgen/seedlingOgmo.js` → committed `atlases/seedling-map.json`
  (**116** levels, not the 120 `.oel` files — four are unreferenced by the
  level table); `frontend/modules/regionMarkingTool/` (model / mapSource /
  renderer / UI / CSS), registered in all four places;
  `atlases/seedling.json` (3 real regions, 10 exits, 1 location, 0 errors)
  built by `make-seedling-starter-atlas.mjs`;
  `check-region-marking-tool.mjs` drives the real panel in chromium.
- Additive format deltas: **`map_ref` + `tile_space.map_document`** (Seedling
  is 116 coordinate spaces, not one) and a **compact atlas writer** shared by
  the tool's save path and the CLI's `--restamp`, which kills the
  atlases/README "paste the hash in by hand" workaround.
- **Traps hit, worth remembering:** `.gitignore` line 89 `lib/` (a Python-venv
  rule) silently ignores ANY `lib/` directory — `scripts/procgen/lib/` was
  invisible to `git status`; the kickoff's `*_tilemap.json` warning was real
  but incomplete. And `deriveEdgeSide` short-circuited on the horizontal
  reading, so a single-tile E/W exit read as "not on a boundary" — which is
  what most of Seedling's real map crossings are.
- `vitest.config.js` `include` gains `scripts/**/*.test.js` (node-only CLI
  logic has no home in the bundled frontend graph).
**Phase 3 — atlas → vanilla rules.json compiler + registered preset + APWorld
Editor handoff: SHIPPED + PUSHED 2026-07-27** (`c7a1c8f16` compiler + CLI +
preset, `4d599f125` in-app milestone check, `1205928b0` panel buttons +
verifier phases; full vitest **3503/3503** green, up from the 3471 Phase-2
baseline).
- **Rulings (user, 2026-07-27)**, recorded in the plan doc's Phase 3 section:
  (1) **Phase 3 is GRAPH-ONLY — the compiler emits no `preset_sidecars`.**
  Play-time walking runs the REAL Seedling game with the teleport recipe
  placing the player at the entrance spawn tile, which is projection 3 — so the
  plan's "walk between sections in-app" milestone MOVED to Phase 4, and Phase
  3's milestone became "the projected preset loads in the frontend with the full
  region graph, and the APWorld Editor handoff works". (2) The Phase-2-deferred
  APWorld Editor handoff lands here.
- As built: `frontend/modules/procgenPipeline/regionAtlasCompiler.js` (on
  `shared/rulesJsonBuilder.js`, submodule consumed read-only);
  `scripts/procgen/region-atlas-compile.mjs` with an exact `--check`
  regeneration gate; `frontend/presets/seedling_atlas/AP_1/AP_1_rules.json`
  registered via `register-preset.py` **and mirrored by hand into
  `preset_files.live.json`** (the script does not touch the live index), with
  no `has_procgen_data` — that flag means "has sidecars"; two toolbar buttons in
  `regionMarkingToolUI.js` (Export rules.json / Edit in APWorld Editor) plus the
  `apworldEditor:loadRules` publisher registration the bus requires.
- Projection decisions worth knowing (detail in the plan doc): a connection
  direction carries its **source** exit's `access_rule`; unwired boundary exits
  are omitted and NAMED everywhere (the starter atlas's 6 are the growth queue);
  v1 classifies every `vanilla_item` as progression; AP ids are base 30000000 +
  sorted index, clear of the flashPanel `ap_id_offset` (20000000) whose
  *alignment* is Phase 4's concern; `Menu` is reserved and a colliding atlas
  region is a hard error.
- Verification is by EFFECT, not by silence: `check-seedling-atlas-preset.mjs`
  boots `?game=seedling_atlas&seed=1` and compares the state manager's own
  regions/exits/locations against a headless compile; the marking-tool verifier
  gained Phase E (the downloaded rules.json is byte-identical to the headless
  compile — the panel's export path IS the CLI's compiler) and Phase F (the
  hand-off lands in the editor's own model; under `?mode=flash` the editor panel
  is not mounted, so the path exercised is the module-level stash, cleared and
  asserted empty BEFORE the click so it cannot pass on something stale).
- The repo ships no JS JSON-Schema library, so
  `frontend/modules/runnerDemo/ruleSchemaCheck.js` (test-only) grew
  `patternProperties` / `enum` / `anyOf` / `allOf` / list-valued `type` and a
  `rulesJsonSchemaErrors()` export — a WHOLE rules.json now validates against
  `frontend/schema/rules.schema.json`. Python's `jsonschema` covers the
  committed preset for free: `test/general/test_schema_validation.py` globs
  every preset (255 subtests green).
**Phase 4 — projection 3 + play-time transitions: SHIPPED 2026-07-27**
(`49a70ff35` position signals + compiler sidecars, `aaf09e512` substrate entry +
glue, `396ca170b` end-to-end verify, docs; full vitest **3548/3548** green, up
from the 3503 Phase-3 baseline). **The milestone landed: the real recompiled
Seedling game walks between atlas regions in-app** — a native level transition
crosses the AP region boundary, and arriving teleports the player to the marked
entrance spawn.
- **Rulings (user, 2026-07-27)**, recorded in the plan doc's Phase 4 section:
  (1) **Level-granular v1** — a physical region binds to a whole Seedling level,
  crossings are the game's own `Main.level` change, tie-broken on spawn
  coordinates; sub-level physical boundaries DEFERRED (no BridgeGeneric change,
  no re-injection, no wasm rebuild). Logical sub-regions are unaffected — they
  carry rules, they are not physically triggered. (2) **One sync
  implementation** — the substrate entry DELEGATES to flashPanel's shipped
  `WasmBridgeAdapter`; no second AP↔game translation in flashSubstrate's bridge,
  and not the substrate-bridge dialect (the wasm shim speaks
  `game.configure(json)` + `queueItems`). (3) **Boundary visuals: satisfied by
  nature** — the game's own teleporters and level edges are the affordance;
  real work only when a *generated* world puts a boundary where vanilla draws
  nothing.
- As built: three `Main` statics in `games/seedling.json`
  (`playerPositionX`/`playerPositionY`/`level`, positions first so the tie-break
  coordinates land before the level change; they ride the ONE configure at boot,
  since `BridgeGeneric.doConfigure` refuses a second for the life of a game
  instance); `regionAtlasCompiler` emits `preset_sidecars` + the top-level
  `flash_panel` block (so regeneration no longer drops the wiring — the trap
  decision 2 names); `flashPanel/flashSeedlingLibrary.js` registers
  `flash_seedling` off `createFlashSubstrateEntry` with the **flashPanel** panel,
  its own `flashSeedling:loadRegion`, and no `iframeId`;
  `seedlingRegionBinding.js` (pure state machine) + `seedlingRegionGlue.js`
  (effects → adapter + dispatcher); `FlashBridgeAdapter.onStateReport` as the
  raw-report seam, fired ABOVE the echo/first-read suppressions (those exist for
  AP *location* detection and would swallow these reports); flashPanel enabled in
  the default `modules.json`; `has_procgen_data: true` in both preset indexes
  (live mirrored by hand again).
- **Both predicted traps were real.** Teleport echo: the glue's own arrival
  teleport changes `level` indistinguishably from a player crossing — marked in
  flight, matching report swallowed, cleared on match or 15 s, and NOT armed
  when the target level is the one the game is already on (arming would eat the
  next real crossing). First-read baseline: BridgeGeneric reports the whole
  declared set at boot, so the first `level` report is baseline — and it doubles
  as the "game is alive" signal releasing an arrival queued while the wasm page
  waited on its ▶ Start gesture.
- **Unmapped-level policy** (the atlas covers 3 of 116 levels by design): warn
  LOUDLY on console + panel log, naming the levels and pointing at the Region
  Marking Tool, and do NOT move the AP region. Initial arrival with no
  `arrivedFrom` spawns at the region's FIRST declared exit — `region_coords` was
  rejected (keyed by display names no `region_id` matches, and it is manual-UI
  engine binding, not map truth).
- **Testing deviation, deliberate:** no in-app test-substrates leg. The leg that
  matters needs the gitignored 31 MB wasm artifact, which is machine-local, so
  an enumerated test would be red wherever it is missing. The gate is
  `scripts/procgen/check-seedling-atlas-play.mjs` (SKIPs exit-0 without the
  artifact): arrival teleport confirmed by an independent `readState`; a NATIVE
  crossing queued straight into the iframe publishing `user:regionMove` AND
  moving gameState; a second crossing; and only then the negative — a
  host-driven cross-level arrival that must not echo. The watcher wraps the
  dispatcher's real `publish` and THROWS if it cannot, so the negative cannot
  pass vacuously. `check-seedling-atlas-preset.mjs` stays the graph gate and now
  asserts the sidecars are present and consistent instead of absent.
- **No `SubstrateInactiveOverlay`**, deliberately not half-wired: flashPanel is
  not procgen-only (it still serves the Stage-1 direct-client presets), so a
  `procgen:activeSubstrateChanged`-null predicate would blank a legitimately
  active panel.
**Phase 5a — the reachability analyzer: SHIPPED + PUSHED 2026-07-28**
(`3724e0de1` semantics tables + census guard, `5497d70ba` per-exit provenance,
`499901f22` the analyzer, `aec5d69e4` Analyze action + batch CLI, `4ce805f7b`
the real atlas analyzed; full vitest **3635/3635** green, up from the 3548
Phase-4 baseline). Sub-region splits and the rules that cross them are now
COMPUTED from the tile map.
- **Rulings (user, 2026-07-28)**, recorded in the plan doc's Phase 5a section:
  (1) **direct gate-vocabulary analysis, NOT a leave-one-out ability diff** —
  diffing cannot express disjunctions, and Seedling's magical lock (Wand OR Fire
  Wand) would collapse to free; (2) **per-exit provenance**
  `internal_exits[].source`, absent = `manual`, with `annotations.rules_source`
  DERIVED once any row is analyzer-written; (3) surface = pure module +
  marking-tool action + CLI; (4) the maze-mode substrate projection is **Phase
  5b**, a separate kickoff, and the semantics tables shipped here are its input.
- As built: `flashPanel/seedlingSemantics.js` (the transcription — 45 tileset
  columns, 38 tile types, 130 entity tags, plus flag → AP-item derivation from
  `games/seedling.json`), `procgenPipeline/regionAtlasAnalyzer.js` (GAME-AGNOSTIC
  — grid in, components + crossings + merge out), `flashPanel/
  seedlingAtlasAnalysis.js` as the single wiring point, an **Analyze region**
  toolbar action with propose→review→accept, `AtlasSession.setInternalExitRule()`
  for taking a row over by hand, and `scripts/procgen/region-atlas-analyze.mjs`
  with a `--check` idempotence gate.
- **Findings that moved the kickoff's sketch, all from source:** solidity is
  `Mobile.as:17`'s `["Solid","Tree","Rock","Rope","ShieldBoss"]`, so **enemies do
  not block traversal at all**; a plain breakable rock and a rope fall to `Sword
  OR Spear` (the spear thrust uses the same `genericHit`), while the bridge stays
  Spear-only (the Ghost Sword path already implies the spear); and a FACE gate
  (cave mouth, both directions) is different physics from a DIRECTION gate
  (waterfall climb) — the kickoff's "one-way top ledge" would have wrongly
  blocked walking into a cave from below.
- **Buildings are `manual`, not walls.** Their Pixelmask is not transcribed and
  neither rectangle approximation is safe: the sprite rect swallows the
  building's own doorway (two unplaceable exits, two phantom sub-regions), a
  smaller one would merge rooms. As crossing material a house in open ground
  costs nothing, and a building that IS the only route becomes a hand-authoring
  row instead of an invented wall.
- **Round-trip trap, found by running it twice:** the analyzer writes its own
  unlabelled crossings as `source:"manual"`, so a naive second run preserved
  them as hand-authored AND re-emitted them — one extra row per run, for ever.
- **Acceptance on real data:** the starter atlas gained `dungeon1_room1`
  (closing the `descent` exit that was on the growth list) and is analyzed by
  its own generator, so `--check` gates the analysis. `overworld_start` → 6
  sub-regions, `mixed`; `dungeon1_room1` → 2, `analyzer`; the other two → no
  split, ASSERTED rather than skipped, subgraph correctly omitted. Preset
  regenerated to 11 AP regions / 23 exits; `check-seedling-atlas-play.mjs`
  still walks the real game between them, and the marking-tool verifier gained
  Phase G (analyze in the browser, assert the document is untouched while the
  proposal exists, Accept, prove byte-identical to a headless analyze+apply).
- ⚠ **An unlabelled internal exit compiles to a FREE AP exit** — `access_rule` is
  optional and the compiler passes that through. Right default for an atlas
  grown incrementally, but the needs-authoring list is a logic obligation, not a
  cosmetic one.
**Phase 5b — the maze projection: SHIPPED + PUSHED 2026-07-28**
(`aef86a853` the projection, `2241b8aba` the preset + verifier, `82c5adcff` the
in-app legs; vitest **3690/3690**, `test-substrates --batch=fast` **59/59**).
The real Seedling map — real geometry, real computed item gating — is now
walkable in the browser with nothing but the committed repo, and therefore
testable in the suite, which the flash flavour never could be.
- **Rulings (user, 2026-07-28):** (1) the atlas + the semantics tables are the
  **single source of truth** — the projection derives everything and hand-codes
  no Seedling behaviour (the two-truths rule); (2) combat and anything outside
  access-rule-relevant mechanics is OUT of scope; (3) the maze flavour is a
  SECOND registered preset, never merged into the flash one.
- As built: `procgenPipeline/regionAtlasMazeProjection.js` (GAME-AGNOSTIC, like
  the analyzer core — `gridFor`/`conditionKey`/`resolveCondition` come from the
  game, and `seedlingMazeProjectionDeps()` is the single wiring point),
  `compileRegionAtlas({sidecarFlavor: 'maze'})`, `region-atlas-compile.mjs
  --maze`, `frontend/presets/seedling_atlas_maze/` (10 sidecars, 20 exits, 14
  rule-typed gates), `check-seedling-atlas-maze.mjs` (four phases, nothing
  SKIPs), and two enumerated in-app legs in category `Seedling atlas maze`.
- **The crossing representation** (the phase's one open design point) collapses
  the kickoff's point-vs-area distinction instead of implementing both: ONE exit
  tile on the crossing material's first cell out of the sub-region, gated by the
  atlas row's rule. A point gate is the degenerate case where both sides' first
  cells coincide; an area span puts them on opposite banks, so you step into the
  water on one side and arrive standing in it on the far side. Both rejected
  alternatives are recorded in the plan doc — notably "exit tiles on the far
  bank", which cannot work at all, because the far bank differs by direction and
  the arrival tile would not be an exit in the destination world.
- ⚠ **A maze payload's `exit_id` IS its `exitName`** — found by the legs and
  fixed. mazeRoomEngine keys `world.exits` on `exit_id` while
  procgenPlayer.handleRegionMove resolves an arrival by `exits.get(exitName)`,
  so keying them apart makes that lookup MISS SILENTLY and every arrival falls
  back to the region's entrance tile. `targetExitId` is the AP exit name of the
  edge coming back; the atlas's own id rides along as `atlas_exit_id`. The flash
  payload is different and correct as it stands (its glue resolves against
  `exits[].exit_id`).
- **Fidelity fences, all REPORTED by the projection:** a crossing collapses to
  one tile (interior material cells are walls); a multi-route crossing realises
  only the cheapest route's entry cell while the rule ORs them all; a one-way
  crossing's arrival falls back to the destination's entrance; a multi-tile
  boundary span collapses to its `entrance_tile`; an UNLABELLED crossing is
  **WALLED** (5a's free-AP-exit default must not become a free WALK); sinks and
  unclassified terrain are walled and named. Directionality came out BETTER than
  the kickoff expected — the analyzer already emits each direction as its own
  row, so each is gated at its own cost (one Progressive Swim down, two back up).
- **A door drawn on solid ground is the NORMAL case** (four of seven starter
  exits): such a tile is opened and, when not adjacent to its sub-region, a
  corridor is CARVED through non-wall cells — never through a wall, and **a
  carved cell keeps its own gate**, so a carve can never under-gate.
- No mazeRoom change was needed; the phase's guardrail ("if you are editing the
  engine, check the projection instead") held.
**Phase 6 — sphere growth places pieces of the real map: SHIPPED 2026-07-28**
(vitest **3753/3753** + 25 `*.slow`, `test-substrates --batch=fast` **60/60**,
`check-atlas-sphere-roundtrip.mjs` 43/43 through Generate.py). A sphere-grown
world can now contain real Seedling regions, gated on what the real game charges
to get into them.
- **Rulings (user, 2026-07-28):** (1) **sorter-first, with a built-in fallback**
  — the region's intrinsic entry rule IS its sphere gate, made legitimate by the
  sorter scheduling every required item into a strictly earlier sphere;
  (2) required-item **injection** into an earlier sphere's item plan, and a
  region whose requirements cannot be scheduled is DECLINED loudly;
  (3) locations keep their Seedling names, the world's fill places items
  normally; (4) v1 entry-rule vocabulary is **conjunctions of `Has(item)`** — OR
  or counts are declined with a report line.
- **The attempt SUCCEEDED**, so open question 2 (the gate-rung ruling for
  decision 9) is RESOLVED: a pre-built region MAY serve as a gate rung, and its
  gate is its own intrinsic entry rule. Decision 9's "beside the skeleton with
  synthetic gates in front" survives as the FALLBACK route
  (`--atlas-placement quota`), not the default — and because of the slice order
  it was built first and is kept.
- As built: `procgenPipeline/regionAtlasPool.js` (a THIRD capture contract —
  payload + AUTHORED rules, beside the library's 'procedural' and 'content'),
  `scripts/procgen/region-atlas-pool.mjs` → committed
  `frontend/atlas-pools/seedling-atlas-pool.json` (content-hashed, `--check`),
  `resolveSphereAtlasSources` on the seam
  `substrateConfig['<game>'].atlasDoc` (the library route's precedent — the
  sphere path still has NO `applySubstrateConfig`),
  `mazeLibraryEntry.instantiateAtlasEntryForSpecs`,
  `procgenPipeline/sphereAtlasSorter.js`, `dump-sphere-growth.js --atlas /
  --atlas-placement`, the committed `seedling_atlas_sphere` preset, and the
  in-app leg `seedling-atlas-sphere-placed-region`.
- ⚠ **An atlas entry is a SPECIFIC PLACE, not a palette chip** — placed at most
  once per world, and the placed region takes the MAP's name
  (`overworld_start__r8c0`), which is why the entry is claimed before the
  realiser specs are built.
- ⚠ **The back-exit must be retargeted to the projection's own entrance tile.**
  The grid-mirror tile a generated region uses is very likely a WALL in a real
  map, and an atlas region is sized to its own bounds — so without this the
  arrival lands in solid rock while every compile and every oracle stays green.
  That is the failure the in-app leg exists to catch (F6 deferred-thread 2, and
  for an atlas region it is not a nicety).
- ⚠ **The driver's gate AND-composes onto the authored rule**, never replaces it
  — the library path's overlay-WRITE assumption does not carry over.
- **v1 fences:** ~~an atlas region hosts NO children~~ and ~~the entry
  vocabulary is conjunctive~~ — **BOTH LIFTED 2026-07-28, see the block below**.
  Still standing: a sorted atlas node carries no items (capacity-aware
  assignment is the next step); the starter atlas has ONE marked location, so an
  atlas region is currently geography and gating rather than loot.
- **No panel exposure yet** — the atlas reaches sphere growth through the
  headless CLI only. The stepped-runner half (the wire F6d found missing in the
  library arc) IS already done — `sphereSteps` resolves atlas sources and
  threads `atlasAssignments` — so what remains is the UI: serve pools, tick one,
  and run the sorter in `_buildSphereConfig` before the plan reaches the driver.
- **Phase 7 (RWK) POSTPONED INDEFINITELY (user ruling 2026-07-28) — the arc is
  Seedling-only for now.**
**Phase 8 slice 1 — the MAZE-SURFACE playback bot: SHIPPED 2026-07-28.** The
generated worlds are now PROVEN BEATABLE by walking them, on two independent
strata.
- **Ruling (user, 2026-07-28): maze surface FIRST.** A bot on the projected map
  proves beatability without touching the original engine, and it is the surface
  every downstream consumer already runs on. The real-game bot is a later slice;
  its design space is recorded in the plan doc's Phase 8 section, UNEXPLORED —
  two routes (more injected ActionScript vs. building the bot into the Seedling
  source and recompiling) plus an ⚠ **unverified** caveat to check first: Phase
  5a took `Mobile.solids` as the solidity oracle, and it may be an INSTANCE var
  rather than a static, in which case per-entity overrides exist.
- **The headless witness is the INDEPENDENT STRATUM** —
  `frontend/modules/procgenPipeline/atlasMazeBot.slow.test.js` (20 cases, `*.slow`
  tier). rules.json + sidecars in, completion out; it imports the sorter, the
  projection and the compiler NOT AT ALL. The sphere oracle shares the
  placement's assumptions; this walks tiles instead.
- Two presets, two DIFFERENT claims: `seedling_atlas_sphere` = BEATABILITY (all
  7 locations, `victory`, no stall); `seedling_atlas_maze` = TRAVERSAL
  COMPLETENESS, because it is a FIXTURE (constant-true completion, gate items
  absent from its pool) and "beat it" was never a claim it could make. The suite
  asserts the fixture is still a fixture.
- ⚠ **An exit-tile step IS a crossing**, so `excludeOtherExits` on every
  in-region walk — and that WALLS real corridors (`region_3_3`'s back-exit sits
  on its own entrance tile). The answer is neither walking through nor giving
  up: route over `(region, arrival-exit)` NODES and cross OUT and back to arrive
  on the tile that was in the way.
- ⚠ **Route over the SIDECAR exit set, never the AP graph** — AP lists crossings
  the projection walled (`overworld_start__r1c6 ↔ r8c0`).
- ⚠ **A silent stall was possible and is now impossible.** An unresolvable
  walkTo target used to `console.warn` and return, leaving the bot waiting
  forever — indistinguishable from slow progress under a timed poll. It is now a
  NAMED bot error status, and the in-app leg asserts no error status ever
  appeared as well as asserting completion.
- **A real defect in the shared submodule, fixed:**
  `forwardSimulator.pickNextTarget` ran its inventory through `new Set(value)`,
  so the `Map<name,count>` that `generateSphereLog` builds in the same file
  became a set of `[name, count]` PAIRS and every lookup missed. A Map now
  passes through. ⚠ needs the outer gitlink bump.
- **The walkTo evaluator divergence (pre-existing maze defect, found by this
  slice's recon, fixed here):** the keyboard/queue path stepped through the full
  Rule Builder evaluator while the walkTo path planned AND stepped with a
  count-collapsed `Set` and no evaluator, so a `Has(count: 2)` gate opened at one
  copy depending on which control you used. One shape and one evaluator on both
  paths now: `inventoryFromSnapshot` → Map, `MazeRoomVisualizer.setClearanceOpts`,
  and `mazeAutopather.findPath` gained `opts.clearanceOpts`.
- Files: `atlasMazeBot.slow.test.js`, the in-app leg
  `seedling-atlas-sphere-bot-completion`, `mazeRoomVisualizer.js`,
  `mazeRoomUI.js`, `mazeAutopather.js`, `playbackBotUI.js`,
  `shared/procgen/forwardSimulator.js`.
- Gates (2026-07-28): vitest 3755 → **3768/3768**; slow tier 339 → **359/359**
  (~23 min, dominated by the runnerDemo battery); `test-substrates
  --batch=fast` 60 → **61/61**; all five atlas verifiers, both region-library
  round-trips, and every atlas `--check` gate green.
**Phase 6 fences 1 + 2 LIFTED — SHIPPED 2026-07-28.** The sorter speaks OR and
counts, and an atlas region hosts children on the real map's own doors. Full
as-built in `region-atlas-plan.md`; the load-bearing parts:
- **Vocabulary:** requirements normalize to DNF over `Has`
  (`regionAtlasPool.requirementDnf`). Honest wave = **min over disjuncts of (max
  over that disjunct's items' spheres)**, computed in a SECOND pass against the
  finished plan. Scheduling picks ONE disjunct (cheapest, then lexical); counts
  push N instances.
- ⚠ **The gate the world sees is the AUTHORED rule, verbatim** — `gateRule` on
  the tree node, preferred over `sphereGateRule`. Re-synthesising it from the
  scheduled disjunct would AND one branch of an OR onto the map's own row and
  kill the other, which is the over-gating the v1 decline existed to prevent.
  `andComposeRules` is identity-aware for the same reason.
- ⚠ **A ZONE host gets BOTH the necessary subset and the access_rule** — it
  cannot derive an OR back out of its geometry, and building on the scheduled
  disjunct would physically wall off a branch the logic still promised.
- **Hosting rule, one sentence:** the realised exit rule is the door's rule AND
  the child's gate, and that composition must open in EXACTLY the child's gate
  sphere. A door that opens exactly there and a child with no gate of its own →
  the map's charge IS the gate, nothing synthetic added.
- ⚠ **A door on the region's ENTRANCE TILE cannot host** (the driver's
  back-exit lives there); an unhostable slot ENDS the envelope, because doors go
  to children in payload order and cannot be skipped. The envelope bound is HARD
  — `reserve()` throws past it.
- ⚠ **A pre-existing `stitchGrid` defect this exposed:** it identified an exit
  by TILE, so a back-exit sharing a cell with a door was re-stitched to that
  door's neighbour — two exits into the CHILD, none back to the parent, compiling
  clean and turning the oracle red. Keyed by exit id now.
- **The whole starter atlas now places** (zero declines): eighteen regions, ten
  of them map pieces, seven hanging off atlas doors.
- Gates: vitest 3768 → **3790/3790**, slow tier 359 → **364/364**, `--batch=fast`
  **61/61**, all three byte-identity dumps inert, round-trip verifier green
  including its byte-equality regen pin. **Acceptance headline:** the headless
  bot beats the richer world (573 steps / 33 crossings) and every
  sword-or-spear crossing clears with ONLY the Sword and with ONLY the Spear,
  bracketed by holding neither and finding them shut.
**In-app witness hardening — DONE 2026-07-28.** The apparent flake in
`seedling-atlas-sphere-placed-region` is dispositioned; detail in the plan
doc's Phase 8 section.
- ⚠ **The run records are stamped UTC; git dates are local.** That −7 offset is
  what made these look like reds against shipped code. Re-dated, every red ran
  on code that predates the commit which introduced or rewrote the leg — two
  commits back the leg did not exist (the file was 340 lines). Convert before
  concluding anything from a run record's filename.
- One REAL residual defect found and fixed: the leg emptied the gate items
  before its negative, but decided *whether* to, by reading `getSnapshot()` —
  the proxy's async `uiCache` — with no `pingWorker` flush first. A stale zero
  skipped the removal and the player walked through a working gate. Reproduced
  on demand at HEAD by mutation, identical to the recorded failure. Both gate
  legs now share `clearGateItems`, which flushes, then asserts the items are
  really gone.
- The other signatures: an unreachable staging tile (poll self-classified
  **STUCK**, not load — `walkableFrom` already fixes it), a mid-rewrite
  `.dispatch` crash (no such call survives), and a bot red where the bot WON
  and the sampler watching it was blind (replaced by `99c90784d`).
- Counted on HEAD: 8× solo green, 3 consecutive `--batch=fast` green at 61/61.
- New: `npm test -- --test=<id>` runs one in-app test alone, so "run it alone
  8× and count" is finally expressible — batches are category-only by design.
  The id list is stamped into results and into `compare-runs.js`'s baseline
  identity, or a one-test run would poison the next full run's diff.
- NEXT: Phase 8's **real-game surface** slice (design space recorded; sequencing
  RULED 2026-07-29 — see below); **no panel exposure for atlas pools**;
  capacity-aware item assignment for sorted atlas nodes.
**Real-game surface + JS-port ruling — 2026-07-29 (Fable; recommended by
Claude, accepted by user). Full detail in `region-atlas-plan.md` Phase 8.**
- The `Mobile.solids` caveat is RESOLVED: `public var` (instance), but every
  override is enemy/projectile/scenery-side; the only Player-side change adds
  `LavaBoss`. The base list IS the player-traversal truth — the Phase-5a
  analyzer needs no correction; entity overrides matter only at the v5
  (enemies) bot rung.
- **A JS port of Seedling core gameplay = its own LATER substrate arc, not
  the Phase 8 instrument** — a port is our transcription and shares the
  atlas/analyzer's assumptions, so it cannot witness "beatable in the actual
  game". Route (b) (bot compiled into the source; recompile toolchain already
  proven by Stage 1) is the leaning for the real-game slice.
- **Sequencing: real-game bot FIRST, port SECOND** — the input-drive
  machinery the bot slice builds is what anchors the port via differential
  tapes (same tape through port + wasm, compare positions/level
  transitions), so the port is born verified. Port's unique value, recorded
  for its arc: generated worlds with real Seedling physics (the wasm plays
  only its 116 baked-in levels), CI-testable from the committed repo (vs the
  31 MB gitignored wasm), and a suite-runnable surface for the puzzle/enemy
  bot rungs. MIT makes Seedling a better first Tilemap-Platformer-substrate
  target than RWK. Scope datum: ~30.5k lines AS3 / 209 files on FlashPunk;
  the core-gameplay subset is a modest fraction.
- **SEQUENCING AMENDED (user, 2026-07-30): per-stage JS-FIRST.** Each bot
  ladder stage is implemented in JavaScript first (the iteration/testing
  surface), then in the actual Seedling code — the port advances
  incrementally alongside the bot instead of strictly after it. The oracle
  doctrine stands: only the recompiled game witnesses "beatable in the
  actual game"; per-stage differential tapes verify the JS side as it lands.
  **Seedling is FORKED: `PeerInfinity/Seedling`** (parent
  `ConnorUllmann/Seedling`); `~/CC/seedling` has origin=fork,
  upstream=parent; fork `main` pristine; the Stage-1 edits (WhirlPool case
  fix + skip-splash boot) are pushed on branch `stage1-teleport-build`.
  Detail: `region-atlas-plan.md` Phase 8.
- **v1 KICKOFF READY (2026-07-30, Fable): the Opus brief is
  `NewDocs/plans/seedling-bot-v1-opus-kickoff.md`** — QUEUE THIS NEXT for the
  arc. Scope: the tape contract (tick-indexed hold-spans), the
  `frontend/modules/seedlingDemo/` JS engine seed, the compiled-in AS3 tape
  bot on the fork's `bot` branch (own EI callbacks — no BridgeGeneric or
  configure change), committed oracle recordings (vitest differential in CI)
  + `check-seedling-bot-differential.mjs` (staleness gate, SKIPs without
  the machine-local `seedling_bot_ap` artifact). Four rulings taken
  2026-07-30, recorded in the kickoff §1 and `region-atlas-plan.md` Phase 8.
  All anchors recon-verified same day; recon-first still applies.
- **v1 SHIPPED — COMPLETE 2026-07-30** (`ebb30f46b`..`63c9b74e4`; fork `bot`
  @ `25aaa43`). The kickoff moved to `CC/docs/plans/`. **The JS physics
  transcription reproduces the real recompiled game EXACTLY — 220 ticks
  across 5 fixtures, bit for bit.** Both gates green (G1 vitest
  JS==recordings; G2 live replay + a live bot-driver task landing the real
  game on its target). **Read
  `docs/json/developer/procgen/seedling-bot.md` FIRST** — contracts, traps,
  dead ends. ⚡ always run the harness with `--win` (real-GPU Windows Chrome
  from WSL, ~25 fps vs ~0.5 on WSL SwiftShader — ~44x).
- **v2 KICKOFF READY (2026-07-30, Fable design session): the Opus brief is
  `NewDocs/plans/seedling-bot-v2-opus-kickoff.md`** — QUEUE THIS NEXT for
  the arc (move it to `CC/docs/plans/` when implementation starts). All
  three questions ruled (user, 2026-07-30) + one the recon surfaced:
  (1) geometry = **consume the committed Phase-2 extract directly**
  (`seedling-map.json` + `seedlingSemantics.js`'s verbatim AS3 tables; a
  new `levelWorld.js` transcribes the `loadlevel` subset; NO new artifact
  or regen chain; the analyzer's `CELL_KINDS` layer is off-limits);
  (2) transitions **modeled fully**, `transitions` = element-wise
  exact-diffed `{t, from_level, to_level}` (teleporter identity excluded —
  the AS3 bot can't observe it); (3) `Mobile.solids` **confirmed v5-only**
  (the `Player.as:359` LavaBoss push is unconditional-but-inert outside
  Dungeon 7 — transcribe verbatim; `Tree`'s private list is DEAD CODE, it
  extends Entity); (4, new) **pixelmask colliders are a loud-throw seam**
  (Building/TreeLarge etc.; fixtures route around); pathing = in-level A\*
  + explicit cross-level legs through the real `step()`.
  **Headline recon correction: Seedling has NO edge-transition logic** —
  room changes are authored `<teleporter>` trigger entities (AABB + latch
  → `new Game`; arrival `(playerx+8, playery+8)`; velocity reset; held
  keys persist), so "model edges" = model teleporters, far cheaper than
  the queue feared. Collision is entity-based (per-cell `Tile` type-flip,
  Tree = 2×2 footprint, hit ⇒ position pins but **velocity NOT zeroed**);
  `getState()` is STICKY, so the v1 pure terrain seam becomes a
  transcribed stateful resolver. **v2 expects ZERO AS3 edits** — `Bot.as`
  already handles `noclip:false` and transitions, so slice 0 records real
  collision oracles before any JS is written. All anchors recon-verified
  same day (two agent sweeps + direct spot-checks; one agent claim about
  sub-pixel sweeps REFUTED); recon-first still applies.
- **v2 SHIPPED — COMPLETE 2026-07-30** (`e923c627c`..`0c81c4b81`; kickoff
  now at `CC/docs/plans/seedling-bot-v2-opus-kickoff.md`, whose **§7–§13
  are the AS-BUILT record and correct §1–§6**). **Eleven fixtures, all
  oracle recordings, all EXACT** — 1084 ticks / 1095 observations / 4
  transition records, bit for bit, with the v1 five byte-identical
  throughout. **The zero-AS3-edit prediction held for the entire rung.**
  Landed: `levelWorld.js`, `playerPhysicsV2.js`, `levelSource.js` +
  `levelRun.js`, `botDriverV2.js`, and the `transitions` contract in
  `tapeFormat.js`. Vitest 3876 → **4050/4050**.
  **Read `docs/json/developer/procgen/seedling-bot.md`** — now the v2 doc:
  the transitions contract (settled tick order; `botDrain` hardcodes `[]`
  so the field is DERIVED at record time by one `deriveTransitions` applied
  on both harness paths), the resolver (sticky / nearest-walkable-by-centre
  / strict-intersect / `checkOffsetY = 1`, and noclip does NOT bypass
  terrain typing), the level-injection seam, the six loud throws, and
  ⚠ **the controller is 45°-then-axis, not straight-line** (the brief's
  §3.4 smoothing rule put a fixture in the lake).
  ⚠ **Five properties are bounded vacuities** — stickiness, the latch,
  terrain reset on a swap, the driver's teleporter policy, the executor's
  hit-throw — each killing hand-derived cases and NO fixture, because
  levels 0 and 94 are too benign. Witnesses are named, and **all are
  blocked by the same class table**, not by the baked-in boot.
- ~~NEXT for the arc — v3 (item-gated terrain)~~ **SUPERSEDED: the ladder
  above v2 is RE-PLANNED SUBTRACTIVE (Fable design session 2026-07-31,
  four user rulings).** End-to-end first: disable collision + damage +
  hazards, walk the whole game reaching all 13 non-combat items (granted
  on entering each item's room, for now), then reintroduce one obstacle
  type per rung — solids, interactions/real collection, hazards, enemies,
  bosses — until the real game is beatable with zero crutches. The v2
  class-table gate (3/116 levels, 115 tags, sizing in kickoff §13) now
  prices the SOLIDS rung, not the next one — the relaxed walk escapes it
  by relaxing `buildLevelWorld` by ROLE, and the exact differential holds
  end-to-end at rung 1 (the JS mirrors every relaxation). Ladder + rulings +
  new recon (pickup-ceremony deadlock, enemy knockback, the Seed win
  condition, the full item census):
  `CC/docs/plans/seedling-bot-subtractive-plan.md`; ruling record also in
  the plan doc's Phase 8 ladder.
- **R0 SHIPPED 2026-07-31** (`CC/docs/plans/seedling-bot-r0-opus-kickoff.md`,
  §8 onward = the as-built record). The six-change AS3 batch is built and
  deployed; tape v2; the role-relaxed census over all 137 tags; the item/win
  readout; **14 fixtures / 1550 ticks EXACT**, the eleven old ones
  byte-identical against the new build. Two corrections it produced that
  outlive it: the auto-advance key is **X (88), not V** (`keys[6]` is the
  second `Key.X`), and `noHazards` had to ship as a SET because R4 re-arms
  hazards one at a time.
- **R1 SHIPPED 2026-07-31 — THE RUNG IS CLOSED**
  (`CC/docs/plans/seedling-bot-r1-opus-kickoff.md`: §8 the recon, §9 the
  scope ruling, §10 the watch page, §11 the walk as built). **One
  driver-planned playthrough of the real recompiled game: 79 legs, 47
  levels, 4 pit falls, 1 pass-through, 14,963 ticks, recorded EXACT — and
  the terminal claim, read from the game's own `botStatus`, is 10 item
  booleans true + `hitsMax == 4`, ELEVEN of the thirteen non-combat
  items.** All 23 fixtures exact (31,476 ticks); the 16 pre-R1 ones
  byte-identical against the new build. Blocked and published: `fire`,
  `ghostsword`, `firewand` — all three ENEMY-shaped, all three R5, so the
  ladder's remaining distance is a single number.
  ⚠ **Four findings the design did not predict**, each recorded with its
  citation: routing had to become a `(level, component)` search *in code*
  (the scratch emitter's `NO PATH` was a spread overwriting the node id
  with the destination LEVEL); **two arrivals cannot be stood on and must
  be DECLARED** (L3's own return trigger — which closes the v2 latch
  vacuity for free — and L38's arrival `buttonroom`); **that buttonroom
  press CHANGES PERSISTENCE**, arming L37's FallRock and invalidating slice
  3's "fallrock is inert" premise in one level (priced as an
  `extraVolumes` entry from the causing leg, because the alternative was
  losing wand AND darksword); and a **second trigger standing on a pit
  tile** (L43's exit, beside the known L100) which re-routed the walk out
  of L43 by its stairs.
  ⛔ **And ONE AS3 line was required after all — ruled by the user.**
  `Inventory.update` raises a tutorial that holds `Game.freezeObjects` as
  soon as `items.length >= 2` or `canSwim || hasFeather`; frozen frames are
  DEAD frames, so no tape span can ever reach the release and
  `Bot.autoAdvance` gates on `Game.talking`, which a `Help` never sets. R0
  never saw it because its fixture grants exactly ONE item. `Bot.botStart`
  now sets `Inventory.help = false` — the same line the game's OWN debug
  warps set (`Player.as:1875` +4 more). UI only, and R3 needs it too, so
  nothing has to retire it. ⚠ Its pipeline run also proved that an
  ABC-only change is enough to need `FRESH=1`: the incremental build died
  with `heap_alloc(711162896) failed` before the callbacks ever registered.
  ✅ The **latch** witness is CLOSED with oracle evidence (9 ticks standing
  in L3's own trigger without it firing); ❌ the **stickiness** witness is
  left open, deliberately — the obvious mid-hole position in L83 lands on
  an equidistant `nearestToPoint` tie, and slice 1 already learned what a
  tie costs.
- **R2 — solids come back (`noclip` off): ✅ COMPLETE 2026-08-01.**
  Kickoff + full as-built: `CC/docs/plans/seedling-bot-r2-opus-kickoff.md`
  (§8 recon, §9 rulings, §10 slices 1–5a, §12 the walk). Doc:
  `docs/json/developer/procgen/seedling-bot.md` §R2.

  **The claim, from the game's own `botStatus`: 8 of the 13 non-combat
  items — sword, shield, feather, darksword, torch, spear, darkshield,
  darksuit — with `hitsMax` still 3**, over a 55-leg / 31-level / 3-fall /
  1-hold / 10,136-tick walk. Six segments summing to exactly the headline.
  Blocked list published with each item's ONE named seal and the rung that
  opens it: `conch` (L48 `karlore@112,272`, R5), `wand` (L38's cover then
  L39's wandlocks, R3), `health` (L63's bridge then L65's rock, R3),
  `fire`/`ghostsword`/`firewand` (R5).

  Geometry half: 17 committed pixelmasks + the two-half collide
  transcription, the 69-tag blocking census (full census 11 → 82 levels),
  the Activators state machine (a lock opens on **101**, a cover on 11 —
  the clamped-alpha knife-edge), tape v3 + ONE AS3 change, and the
  **byte-inertness gate PASSED** before anything new was recorded.

  Walk half: `noclip` became a declared field of `relax`; the leg
  vocabulary gained a **HOLD** the executor verifies tick by tick and then
  by EFFECT with a positive control; the route was re-planned over
  post-clear geometry with derived hold edges; the readout is pure
  functions with all 25 mutations red in CI.

  ⛔ **Three findings worth carrying forward.** (1) **The recompiled
  runtime has a TAPE BUDGET and the axis is INPUT SPANS** — R2's first
  overshoot fix cost 4.7× the spans and the game could not load the
  headline at all (`heap_alloc(72671) failed`, 2,569 spans, 185 KB,
  failing at boot, twice); `allowGrazes` gives the same walk in 853 spans.
  (2) **Two forced constructor values the `.oel` cannot reach** —
  `ShieldLock` forces `tSet = -2` and `MoonrockPile` forces `tag = 0`,
  both wrong twice over, both already cited in the file that got them
  wrong. (3) **A tile-centre lattice over-blocks**: a 16 px torch half a
  tile off in a 2-tile corridor reported the SPEAR unreachable.

  ⚠ **`darksword` is collected and `wand` is not, which the game would not
  allow** — the Witch grants it under `hasWand && !hasDarkSword`, and the
  grant crutch does not consult her. First place on the ladder where a
  grant asserts something the game's own logic refuses; R3 retires it.

- **R3 — interactions + real collection: ✅ COMPLETE 2026-08-01.**
  Kickoff + as-built: `CC/docs/plans/seedling-bot-r3-opus-kickoff.md`. Doc:
  `docs/json/developer/procgen/seedling-bot.md` §R3. Memory:
  `project_seedling_bot_r3.md`.

  **The claim, from the game's own `botStatus`: SIX items REAL-COLLECTED
  with `hitsMax == 3`** — sword, feather, torch, spear, darkshield,
  darksuit — over a 53-leg / 32-level / 12,122-tick walk, with **`grants`
  EMPTY** and the persistence flags that are OFF equal to *exactly* the ten
  declared exceptions + the one `L71 shieldlock@288,256` earned by being
  TOUCHED + the six the pickups' own `removed()` wrote. Six segments
  (641+1473+1964+3707+2162+2175) partition the headline EXACTLY. The
  headline is the SAME MAP as R2 with the crutches off, not more items.

  ⛔ **The target shrank twice, and both are findings.** Slice 0 read the
  sources: `conch`, `wand` and `darksword` are not R3-shaped at SOURCE (and
  `darksword` LEAVES R2's claim — R2 only had it by way of a grant the
  game's own logic refuses). Slice 5's **narrowing** — "reached" is the
  PICKUP'S OWN TILE, not a component of the level — took `shield` as well:
  L20's is behind `lock@32,80` whose only presser is walled in behind a
  lock that needs the shield, and the other entrance is L19,
  `Dungeon2_Boss`. **No clear list on the map unseals it.**

  ⛔ **The clear bill: the recon said 8, the SHIPPED PLANNER said 10.** The
  narrowing put `L30 tag 0` back, the driver's own A* put `L3 tag 0` back,
  and the CONTROLLER's overshoot put `L11 tag 0` back. A reachability graph
  and a walk are different questions, and only the second one is the claim.

  ⛔ **The oracle corrected the update ORDER on the first recording.**
  `Game.loadlevel` adds the Player at `:2040` and every puzzle entity BELOW
  it, and `addUpdate` PREPENDS — so a Lock updates BEFORE the player. R2's
  docblock said the opposite and no recording could tell, because the
  player is stationary for all of `l71-button-lock`.

  ⚠ **Reported, not fixed (AS3):** `saw_auto_advance` counts on phase 1,
  the RELEASE — and a `Help` is dismissed by the PRESS, so the counter
  cannot see a Help being auto-advanced. The sword's `Help(3)` IS
  auto-advanced on every run that collects it and the readout still says 0.
  `Bot.as`'s own docblock claims the opposite two lines above the code.

- **R3, as originally briefed (superseded by the entry above):
  `NewDocs/plans/seedling-bot-r3-opus-kickoff.md`**
  (Fable design session 2026-08-01; → `CC/docs/plans/` at implementation
  start). Three rulings (user): ONE kickoff with ordered slices; **raw
  tapes + chunked `botLoadTape`** (span ceiling measured first; the
  directive-tape/script transition is its own arc between R4 and R5);
  **target 11 items REAL-collected and REAL-opened**, grants and clears
  retired class by class, named exceptions only where the opener is
  enemy-shaped. Slice order: ceremony collection (auto-advance's FIRST
  live fire — probe against the existing build BEFORE the one AS3 batch)
  → talk seals (karlore; Witch needs `hasWand` held — ordering is real
  again) → slash/spear + breakables + bridge → touch-locks + pushing →
  wand-shot activators. ⚠ Recon corrections: `WandLock` is a SKIN over
  base `Lock` — wand-buttons are pressed by PROJECTILES, and
  `tSet == -1` locks open on `totalEnemies() == 0` (**R5-shaped, stay
  cleared as named exceptions**). Swings/shots only in enemy-free rooms
  (an enemy hit consumes RNG and decrements `totalEnemies()`, silently
  opening kill-locks). Every opened-blocker claim is a PAIR (l71
  pattern). The two R1 debts land here as planned: `bosstotem`
  inert-via-grants, and the Bridge Solid-because-no-attack-key (L63's
  seals the health room). Slice-0 escalations (circular activator wiring
  at L38's cover, enemy-room openers, bridge-window semantics, a low span
  ceiling) go to the user BEFORE implementation.

## 5d. Procgen determinism — tick-bounded, not wall-clock ✅ **DONE 2026-08-14**

⛓ **CLOSED.** `wallClockMs` is gone from `DEFAULT_BUDGET` entirely; `assertBudget`
refuses a budget still carrying it. Acceptance: `--seeds=9`, five runs at load
~100–170, byte-identical to the quiet-box digest (pre-fix the same command failed
5 of 5). As-built + the full measurement set is in
`CC/docs/plans/procgen-deterministic-budget.md` §8.

⚠ **Three claims in the brief below were refuted by measurement — read §8 before
reusing any of them.** In short: the seed-20 repro no longer reproduces (and did
not pre-fix either — seed **9** is the one that does); no number replaced the
clock, because measurement showed none was needed; and threading
`TIME_RUNG.maxExpansions` into the budget — the "plumbing, not redesign" move
below — is the wrong fix twice over. ⚠ One item is still **owed**: that expansion
cap permits a **12,267 ms** single dash, which is a slowness finding with its own
measurement outstanding.

<details><summary>The original brief, kept for the record</summary>


⚖ **User, 2026-08-14: "make it one of the next priorities to make procgen
deterministic, by making it tick based, not wall clock based."** Full brief,
citations and open questions in **`CC/docs/plans/procgen-deterministic-budget.md`
(read it FIRST)**; the cross-cutting warning now also lives in
`docs/json/developer/procgen/gotchas.md`.

One-line summary: `procgenOracle.js:503` reclassifies a solve that **SUCCEEDED**
as `BUDGET_EXHAUSTED` when it exceeded `budget.wallClockMs` (5000), so elapsed
time — not a property of the candidate — decides keep-vs-revert, and the run
diverges from there. Measured: seed 20, five runs, identical code → 3 levels
twice-over vs 2 × `GenerationAborted(PhysicsV2Error)`.

**Why it is smaller than it sounds:** `DEFAULT_BUDGET` already carries a tick
bound (`maxTicksPerTarget`), and of the two `BUDGET_EXHAUSTED` sites only the
post-hoc one at `:503` is nondeterministic — the thrown path at `:452` already
classifies `per-target-ticks` correctly. The named obstacle (`:112`, "there is
no expansion budget here") is **plumbing, not redesign**: `solverBot.js:4346`'s
`TIME_RUNG.maxExpansions` is already threaded as a `limits` object at `:5135`;
it is a module const where a parameter could go.

**Dependencies:** none — it is self-contained and gates nothing. But it *taxes*
everything: it has bitten three phases of the Seedling level-sets arc and any
suite that runs the solver (a full vitest run went red with 3 failures at load
22.8 that were 515/515 solo). ⇒ every procgen arc pays a re-run per ambiguous
red until this lands, which is the argument for doing it early rather than when
convenient.

⛔ **Expect committed artefacts to move** — changing what counts as a rejection
changes which candidates are kept. The battery md5
`1fedb0ab35b7cd74accecf0345bdc893` and any fixture captured from a solve will
need re-baselining **on a quiet box, in a separate commit from the behaviour
change**, or the next reader reads it as a regression.

</details>

## 5e. Seedling GENERATE-mode UI — the catalogue + parameterized templates (arc opened 2026-08-14, post-dates this doc)

**Status: ⛓ CLOSED 2026-08-15 — all six slices SHIPPED, all seven §7 exit
criteria discharged. Closing commit `29808e39e` (slice 6 = `06b45e602`,
`e8806aa94`, `b27059538`, `531b5fc21`, `870cbad8f`, `29808e39e`; slices 1–5 = `32f9783c6`, `9ac4dfe24`,
`b9f1042d3`, `449d6e7d1`, `bf78cc0b7`, `7b305acc2`, `8b0eb1c1e`, `662a708d7`,
`060e402c6`, `51a0019ab`, `0e957bcaa`, `42cab6b96`, `befb0ce49`, `afaadafa2`).**
Plan doc *(NewDocs)*: `seedling-generate-ui-kickoff.md` — §1 the user's
rulings, §3 the design, §4 the six slices, and **§13 the ARC CLOSE (§13.2 the
exit criteria answered one by one, §13.3 the consolidated residue)**. Tracked
summary: `docs/json/developer/procgen/seedling-bot.md` § *The GENERATE-mode UI
arc*. Memory: `project_seedling_generate_ui`.

⇒ **NEXT in this line: the constructive-mode arc** (PoC §1.15 + §17.6 —
all-WALL start, carve, `reach-tile` goal, paired with rule-directed §1.10b).
Its first job is named in §13.3(3): the payload's `skeleton` block is reserved
and compared, but the URL has NO `?skeleton=` yet, and it lands in the ONE
reader and the ONE writer together. Also inherited: **wave 2** (weigh/kill lane
offsets + re-sweep), **free tile/object editing** (its own arc), the ⚖ PARKED
S1-`clearance` palette question, and ⛔ the CHAIN, still solver-gated.

One paragraph: watch.html's GENERATE arm grows a **catalogue of templates by
family** with two verbs — RESTRICT (sub-roster runs) and the **directed
attempt** ("make the generator attempt that specific thing") — and the palette
migrates from frozen rows to **parameterized templates**
(`instantiate(rng, overrides) → concrete row`; frozen-row shape is the output
contract; declared scalar schemas are the UI-facing subset). Plus a
solvability-directed **anchor search** (bounded per-candidate anchor walk; the
legality half already exists as shuffle-then-first), the **URL round-trip
repair** (the generate form edits never write back — a live two-spellings
defect), and **click-to-anchor** template placement. ⚖ Rulings: seed→level
pairs may expire (early draft; batch re-records, gate subjects re-measured);
manual editing split at the TILE boundary (free tile/object editing = its own
later arc); light domain sweeps (the SPINNER_OFFSET table pattern); features
any-size-and-shape WITHIN the single-screen room.

Slices (all Opus): 1 URL round trip · 2 the template seam + wave-1 params
(orientation, wall length, pool/pit size, plain-door gap; weigh/kill lane
offsets = wave 2 with re-sweep) · 3 anchor search · 4 catalogue + RESTRICT ·
5 the directed attempt (directive-list identity in payload + URL) · 6
click-to-anchor.

**Sequenced BEFORE the constructive-mode arc** (PoC kickoff §1.15/§17.6:
all-WALL carve + `reach-tile` goal + rule-directed pairing — everything this
arc builds is pass-2 machinery and survives that mode switch unchanged; this
arc keeps the skeleton a replaceable input and reserves a `skeleton` block in
the payload/URL identity). ⛔ Not in scope: the CHAIN (bent push paths —
solver-gated, PoC §17.7 "ask before building"), tile editing, multi-screen
rooms, `TIME_RUNG.maxExpansions` (parked for R9).

## 5f. The CONSTRUCTIVE-MODE arc — carve-then-obstacle, two substrates on one loop, lab pages in the frontend (arc opened 2026-08-15, post-dates this doc)

**Status: ⛓ CLOSED 2026-08-16 — nine slices SHIPPED (`067746b9a`..`244e6df0a`;
shared submodule `ed596ff` → `917e4de`): 1 shared refactor · 2 loop core →
`procgenCore/` + maze bindings · 3 maze lab page · 4 iframe hosting
(`procgenLabPanel`) · 5 skeleton kinds + `?skeleton=` · 6 yield table +
pre-check · 7 chambers + kind params · 6b pre-check at every kind · 11 Seedling
free editing · 12 the URL diet (`?directed=` gone). §7 exit criteria answered
one by one in kickoff §18.1 (7 = `reach-cell` NOT built and 8-Seedling NOT
built — ⚖ ruling 11 handed them, with corridor doors, to §5g); consolidated
residue §18.2. Verified against disk by the orchestrator at every slice
boundary.** Plan doc *(NewDocs)*: `seedling-constructive-mode-kickoff.md` — §1
the user's rulings, §2 recon incl. the two probes the design rests on, §3 the
design, §4 the twelve slices with mechanism families (⚑ = Fable-shaped parts),
§6 open questions with defaults, §7 exit criteria. Memory:
`project_seedling_constructive_mode`. Tracked summaries land in
`docs/json/developer/procgen/seedling-bot.md` (new §) and `maze.md`.

One paragraph: the generator's SECOND MODE — start all-WALL, **carve** with the
maze substrate's algorithms (recursive backtracker / Kruskal's / recursive
division + `pruneDeadEnds`/`braid`, lifted from `mazeRoom/` into
`shared/procgen/mazeAlgorithms/` where their registry already meant them to
be), skeleton kinds = **the maze biome names** (one vocabulary), pass 2 = the
existing keep-or-revert loop — and its SECOND SUBSTRATE: the maze binds to
`levelGenerator.js` (loop core moves to a neutral outer-repo dir,
`procgenCore/`; Seedling byte-identical across the move) with an exact BFS
oracle, so every mode-level decision (corridor pass 2, the connectivity
pre-check, chambers, corridor-native doors, branch certification,
rule-directed's cut-vertex build + graded-differential confirm) is designed and
tested there first. Each substrate's generator/editor is a **standalone lab
page hosted in the frontend by `iframePanel`** (maze: NEW page from the
headless modules + a `drawWorld` extraction; Seedling: watch.html), and **free
tile/object editing** joins for both (maze already has it; Seedling's edits
live in the PAYLOAD, not the URL — ⚖ the URL may shrink, §3.9). One Seedling
engine change: the `reach-cell` goal (spelling already reserved in
`decisionTrace.KNOWN_GOAL_KINDS`), additive, battery-gated.

⛓ Measured before design (kickoff §2.4): the Seedling solver walks 1-wide
20-turn corridors 20/20 — but the EXISTING loop over a bare corridor
saturates with zero kept on 6 of 8 seeds (interior-spanning door families
NO_ANCHOR 21/21; everything else seals the corridor and reverts) and a
saturated run cost 106 s (sealing candidates run the planner to its cap
before refusing). Pass 2 over corridors is the arc's substance.

Slices: 1 shared refactor (⛔ ask before the gitlink bump) · 2 loop move +
maze bindings · 3 maze lab page · 4 iframe hosting both pages (⚑ message
vocabulary) · 5 skeleton kinds + `?skeleton=` · 6 yield table + pre-check ·
7 chambers · 8 corridor-native doors (⚖ BLOCKING ruling §6.1 first; ⚑
template shapes) · 9 `reach-cell` + branch certification · 10 rule-directed
(maze first; Seedling gated on 8) · 11 Seedling free editing · 12 URL diet.

⛔ Not in scope: the CHAIN in Seedling (ask first — the maze is where it will
be designed later), multi-screen, `TIME_RUNG`, widening the oracle's catch,
hazards rework, block pushing/combat in the maze (bindings shaped for them),
wiring the maze generator into `generateRegionCore` (lab arm first), promoting
`procgenCore/` to `shared/`.

## 5g. The PROCGEN ELEMENTS design — pass 1 = elements + connectors, the intra-level AREA GRAPH (JS MetaZelda), pass 2 site-typed on carved rooms; both substrates (design opened 2026-08-15, post-dates this doc)

**Status: DESIGNED 2026-08-15 (Fable planning session — the one constructive-
mode ruling 11 called for; conversation first, then records). ARC 1 CLOSED
2026-08-15 — three slices in a worktree, ff-merged: `193bb48a0` (the
`procgenCore/areaGraph.js` module, JS MetaZelda) · `3dbe78449`/`76c0d53db` (the
maze area binding: AREA = a blob with a 2×2 floor square, so lattice mazes have
no areas and `rooms`/`chambers=k` do; a lock on EVERY boundary cell of an area at
its key level; graphify edges RECORDED, not carved; one flood verifies every
level; `--areas=` via one `areaSpec.js` codec) · `6c4516c43`..`cbd4327b5`
(rule-directed `require:[K]` proved by the BFS differential — 148/148 cuts,
measured; the lab page's SIBLING area overlay; `?areas=`/`?require=` in the ONE
reader/writer with VALUE claims; arc-1 kickoff §10.12 answers §7).
**ARC 2 CLOSED 2026-08-16 @ `4e0ac0690`** — four slices, eleven commits
(`880028195` the ENGINE: blocks push, a button HOLDS while pressed, a flag is a
LATCH; ONE block per open room is the whole node budget · `a054b500e` the
ELEMENT CONTRACT + the reverse-pull gadget, 408/408 solvable, and the claim that
discriminates is *a block was on the button at the instant the player entered
the door cell* · `db982f0fd` the MAZE BINDING: elements FIRST, the carve's answer
inside the reserved rectangle DISCARDED so ⛔ no `shared/` change was needed, the
exit mouth SEALED so the guard door is a CUT 100% of the time, `--elements=` +
the census · `4e0ac0690` THE PAGE: the gadget drawn by a second SIBLING overlay,
the palette gains block/button/flag, `?elements=` in the ONE reader/writer with
a byte comparison against the CLI, the SOLVE steps through its plan and the
block visibly moves onto its button — and a maze EDIT became an OP, closing
constructive §18.2's residue). Arc-2 kickoff §11.10 answers §7 gate by gate and
§11.11 is what arc 3 starts from.

⛓⛓⛓ **ARC 3 (SEEDLING) IS CLOSED 2026-08-18**, slice 5c's docs pass at
`18301241a`..`main` — **fourteen
slices** (1 · 2 · 2b · 2c · 2d · 3 · S1 · 4a · 4c · 4b · 4d · 5a · 5b · 5c),
as-builts §8–§18 in `procgen-elements-arc3-kickoff.md`, and **§18 answers §7's
eight acceptance gates one by one** and carries the arc's whole residue in ONE
deduplicated list (R9 · arc 4 · arc 5 · ⚖ the user · code-only). What the
Seedling generator IS now: pass 1 draws the GOAL at Manhattan **≥ 3** from the
start, then an ELEMENT head from the biome DEFAULT SPEC (`guard;len=2+
blockpocket` pre-sword, `+killgate` post-sword — a `+` list is a CHOICE), builds
any `pre-carve` element, runs THE CARVE (the five carved tree kinds defaulting
to **`chambers = 1`**), builds any `on-connector` element against a read-only
room probe, optionally partitions the room into AREAS and realises an area GRAPH
(locks on every boundary cell; the goal in a radius-2 VESTIBULE), composites, and
**CERTIFIES with the substrate's own solver** — a failure is a graded refusal by
name and the element is DROPPED, never shipped uncertified. Pass 2 is the same
keep-or-revert loop, now SITE-TYPED, with a **door = CUT** law and bounded
carving, over a roster that is **23/23 instantiations across three DECORATION
families**. The construction is recorded in a byte-inert LEDGER the lab page
steps through, selection-driven per ⚖ the user's 2026-08-18 ruling, and every
demonstrable piece has a URL in the tracked catalogue
**`docs/json/developer/procgen/demos.md`** (13 entries, `check-procgen-demos.mjs`
**54 / 0**). THE NUMBERS: guard certified **32/34** · block pocket **36/36** ·
kill gate **6/28** post-sword and **17/17** of its certified clears caused by
`sword` after the demand · pass-2 roster **41/45 → 23/23** · `chambers=1` kept
**4 → 102/105** of 120 · `--areas=1` accepts **0–4 of 12** seeds per kind, tag
budget **2 per key** · door law vs the retired span predicate **0 disagreements**
· ledger cost median **1.048× → 1.129×**. ⛔ **NOTHING COMMITTED MOVED** at any
slice: battery `1fedb0ab…` (exit 1), the maze dump, and every R8 tape
(**534 / 0 / 67**) — through a SOLVER slice included; the oracle's catch was
never widened. ⛔ **NOT FIXED, named rather than smoothed**: the DROWN /
armed-hazard engine class (1 abort in 160 under the shipped default — the kill
gate's demand MOVED which cell meets it, 7 → 0, and fixed nothing), the kill
gate's 22 refusals (one pre-existing solver class ⇒ **6/28 is the number to
beat**), the trace MERGE eating a stance walk's corridor, and the maze's pass-2
`door-key` still not cut-checked.

⚖ **FIVE THINGS ARE THE USER's** (§18.2 bucket D): (i) **FORM CONTROLS** for
`?elements=`/`?areas=`/`?require=` — deliberately NOT built, the URL is their
channel as for `?tickbudget=`; (ii) the demo bar **`families>=2` vs `>=3`** — the
stated N ≥ 3 gate returned **1 hit in 40** and both sets are published, labelled,
rather than the bar being tuned; (iii) **arc 4's GO-AHEAD**; (iv)
`PREFER_DISCHARGE` on the **MAZE** (retired on Seedling; still there and
unmeasured on the maze); (v) the maze's **`door-key` cut check** — two candidate
fixes, neither measured.

**NEXT: ⛔ arc 4 is THE CHAIN — a bent push path on Seedling — and it stays
ASK-FIRST** (⚖ design ruling 17 / arc-3 ruling 1). `turns > 0` refuses
`the-chain-is-arc-4` by name today and spends no draw, which is the seam it lands
in. **Arc 5** (shortcuts / density / arenas) needs no new ⚖ and already owns four
named items: the room-aware SITE PICK (recovers the guard's 29 → 21),
ELEMENTS-as-area / density / arenas (the AREA COUNT on a 10×10 room is the
ceiling on everything the area graph can accept), the differential's SHORTENS
grade, and an EXACT (stepped) demand for a moving body. The design's own named
later item is §7b, BLOCK-SEARCH REDUCTIONS.

Plan docs *(NewDocs)*:
`procgen-elements-design.md` (the DESIGN — §1 rulings 1–24, §3 the Cloudberry
re-read + the MetaZelda read, §4 the three layers, §5 the element catalogue
from the ActionScript source, §6 the roadmap of arcs, §7 open questions),
`procgen-elements-arc1-kickoff.md` (arc 1), `procgen-elements-arc2-kickoff.md`
(arc 2, as-builts §8–§11) and **`procgen-elements-arc3-kickoff.md`** (arc 3,
as-builts §8–§18), plus the review `procgen-generation-review-2026-08-17.md`
(what the code does, what the tests test, and the twelve stale assumptions — its
recommendation 5 is what slice 5c executed). Memory: `project_procgen_elements`.
Tracked summary: `docs/json/developer/procgen/seedling-bot.md` § *The procgen
ELEMENTS design* (closed-state, with the corrected phase table);
**orientation**: `docs/json/developer/procgen/architecture.md` § *Level
generation: two passes over one loop core*; **demonstrations**: the catalogue
page <https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/demos.html>,
its data `frontend/modules/procgenDocs/demos.js` (⛓ PROCGEN DOCS P1,
2026-08-18 — `docs/json/developer/procgen/demos.md` is now a pointer at it).

⚖ The user's rulings, in one breath: the maze algorithms are a ROUGH FIRST
DRAFT of pass 1 (connectors, not the whole); block-push puzzles are
CONSTRUCTED FIRST (block + switch + push path + turning space in ONE step) and
the level is built around them — an ELEMENT, maze first, reverse-pull
constructor (solvable by construction), NOT Sokoban-proper, NOT WFC; enemies
are obstacles ± kill gate; design for POST-SWORD; **arrow lanes OUT of the
generator entirely**; later obstacles (hammers, chain traps, turrets) need
geometry that is MADE not found; item-gated shortcuts wanted (water/swim,
waterfall); density is a DIAL, not a goal; MetaZelda cloned to `~/CC/metazelda`
and RE-IMPLEMENTED in JS (BSD-3) as an INTRA-level lock/key area graph (AP +
the pipeline connect levels); in-level loops = solving the exit puzzle unlocks
a direct bidirectional entrance↔exit path (a `graphify` K_goal edge); the full
list of things comes from the AS source and a "plain obstacle" is anything the
solver has a RELIABLE strategy for (measured); solver work (ticks, strategies,
expansions — never wall clock) is a set of DIALS; the connectivity pre-check
WIDENS to every kind (22/80 `empty` pairs re-record). Agreed recommendations:
door = CUT (one law, kinds-scoped then unified); templates may CARVE (bounded,
dead-end, no-shortcut); doors on the main path, branches host clearers,
`reach-cell` deferred; the maze oracle = BFS over block state, NO strategy
ladder; Seedling bent pushes = the CHAIN, a NAMED solver dependency (still
ask-first).

Arcs: **1** area graph on the maze (absorbs constructive slice 10-maze — HELD by
§5f) · **2** the reverse-pull block→switch gadget on the maze (BFS with block
state; the element contract) · **3** Seedling: sites + door=cut + carve legality
+ pre-check widened + `arrow-lane` removed + the straight-lane gadget + kill
gate + area binding + rule-directed `hasSword` — ⛓ **ALL THREE CLOSED** (1
@ `cbd4327b5`, 2 @ `4e0ac0690`, 3 @ `cfe0fd095`) · **4** the CHAIN (⛔ ask-first,
NOT authorised) · **5** shortcuts / density / arenas — **the next arc that needs
no ⚖** · later: hammers, chain traps, turrets, Sokoban-proper, keylock once
diagnosed (R9+). Depends on §5f slice 6 (LANDED —
the flood + yield table are the instrument) and uses slice 7 as a knob;
independent of 11/12.

### ⛓⛓⛓ ARC 5 IS CLOSED (2026-08-20) — the room stops being one small box

Eight slices — 0 · 1 · 2 · 3 · 4 · 5 · 6a · 6b — over `422e0b9d7`..`main`.
§7's NINE acceptance gates are answered one by one in
`NewDocs/plans/procgen-elements-arc5-kickoff.md` **§15.8**, which also carries
the arc's whole residue in ONE deduplicated list (**§15.9**: R9 · arc 4 · future
arcs · ⚖ the user · code-only). Tracked summary:
`docs/json/developer/procgen/seedling-bot.md` § *⛓⛓⛓ ARC 5 IS CLOSED*.

**What shipped**: the ROOM CONTRACT (width/height separate knobs to the vanilla
max 60×60, default PINNED 10×10; the sparse SHELL format under a CLOSURE LAW —
*no floor cell 4-adjacent to null* — refused by name) · the ORIENTED SITE PICK
(an element declares its own snug footprint; guard census **21 → 62 of 360**,
`no-site-fits-this-room` **130 → 0**) · the `chamber` ELEMENT, an element that IS
space, declaring its blob as an AREA through the EXISTING seam (bare tree kinds'
`--areas=1` **0/24 → 4·8·2·4·4 of 24**) · the `arena` and `bodies ∈ {1,2}`,
priced BEFORE the domain was offered (3 REFUSED) · **SHORTENS computed at last**
and REACHED on four generated MAZE levels · the DENSITY IDENTITY BLOCK, six
levers on one line from one function in four readouts, with its own census.
One planned re-record, spent at 6a on the biome default
(`guard+killgate+blockpocket+chamber;w=2;h=3`, the guard's `len` DRAWN) with its
mover set predicted first and matched exactly.

**⛔ The two refutations, published rather than smoothed**: the exact stepped
demand (C4) is exact about a BOUND and not about the body, and switching aborts
3 corpus rows; and the Seedling SHORTENS venue is REFUTED on three measurements
(rock invisible to the solver 244/244 · combat ladder EXHAUSTED · A10 throws at
tick 215), so its module ships complete and unit-tested but is deliberately NOT
a catalogue head.

**⚖ WHAT IS THE USER'S AT THIS CLOSE** (§15.9 bucket D, each decidable from its
own sentence): a PER-SPEC PARAMETER DOMAIN (*"draw from this SUBSET"*) — one
mechanism answering the guard's 10-of-600 thinness, `len` 5/6 placing nothing,
and the chamber having to NAME its params · removing `KEEP_POLICY`/`KEPT_KIND`
from the LOOP CORE now that both substrates have retired `PREFER_DISCHARGE`
(~207 refs across 35 files) · whether `arena` joins the biome default, which
should wait for its lock to grow a wall (2 of 20 certify today) · arc 4's
go-ahead · form controls · the maze `door-key` cut check and `derivePressKill`'s
reported WHY.

**⇒ R9's PRIORITY BY GENERATOR LEVERAGE** (⚖ recorded at the user's ask;
§15.9 bucket A): **(1)** a DERIVED `break` verb — highest leverage, it registers
the Seedling `shortcut` head with ONE line in `ELEMENT_TABLE` (a ROCK-gated
shortcut has NO A10 dependency) AND opens the item-gated lock family for
rule-directed levels · **(2)** the PRESS ARM already first on R9's list — 22 of
22 kill-gate and 11 of 13 arena certification refusals are that one class; ⚠ the
arena also needs the generator-side lock-wall growth, and neither alone moves it
· **(3)** an A10 fix (a ladder that pays a cheap kill, or a non-dialogued goal
class = a re-record) · **(4)** new enemy classes arriving as demand-bearing
elements, which is what gives arenas real inhabitants · **(5)** swim certifiable
in a generated room, which makes the water shortcut gradable through slice 5's
shipped machinery. ⛔ NOT R9's, so nobody waits on it: the A8 two-area-elements
`+`-list codec question · grow-to-fit's draw-order circularity · the per-spec
parameter domain (⚖ the user's).

**NEXT**: arc 4 (the CHAIN) is ⛔ ask-first and unauthorised; everything else in
§5g's ladder is closed.

### ⛓⛓⛓ SEEDLING BOT **R9 — OPENED 2026-08-20**, and it is the successor entry §5g's close asked for

⚖ The user opened R9 in the Fable planning session the moment arc 5 closed, and
gave its ORDER themselves: **form controls first** (the six URL-only generate
parameters get page controls) → **the quick fixes** (the per-spec parameter
DOMAIN `key=v1|v2`, `derivePressKill`'s misreported WHY, the code-only E
bucket) → **a SEQUENCE of playback tapes on the watch page** → `KEEP_POLICY`
out of the loop core *when convenient* → **then the campaign**: oracle and
solver features added AS THE VANILLA PLAYTHROUGH NEEDS THEM, in sphere order,
with R9's ruled first solver act (the `r8-d2` three-segment splice + the
`r8-solve-4` drift, ONE attributed licence) and the derived `break` verb where
the route meets them. The kickoff is `NewDocs/plans/seedling-bot-r9-kickoff.md`
(⚠ gitignored; its as-builts are the per-slice record, and the tracked summary
grows in `docs/json/developer/procgen/seedling-bot.md` from the splice on).
⛓ Why R9 over arc 4: arc 5 MEASURED that the generator now places what the
solver cannot certify, so the solver is the bottleneck — §5g's leverage map
above is the order *inside* R9's solver half rather than an arc of its own.
**Slice 0 (the form controls) SHIPPED 2026-08-20**, byte-inert, `55ee1e857..b89448ad8`.
⛓ Slice 1 (the quick fixes — the parameter SUBSET `guard;len=2|3|4` and the rung's ONE ruled
generator re-record) `..9bbc847fb`; slice 2 (the tape sequence as a CONTINUATION, ⚖ ruling 10 —
two windows on ONE game state reproduce the headline tick for tick) `..c26f9d85c`.
⛓⛓⛓ **SLICE 3 SPENT THE RUNG'S ONE ATTRIBUTED SOLVER LICENCE, 2026-08-20, `..f74ef5b72`** —
R8's two close-out debts are DISCHARGED. `r8-d2` is THREE segments (the honest L18 PROMOTED as
`r8-solve-18`, not duplicated: zero bytes of it moved), headline 2,218 ticks and v9, cuts
`[573, 1437]`; `r8-solve-4` re-derived 253 → 255. The prediction was SEALED at a pristine tree
before any solve and 12 of its 15 numbers landed exactly — including the two it explicitly
refused to derive. ⛔ **THE STANDING IDENTITIES THAT MOVED ON PURPOSE**: battery `--check`
`1fedb0ab…` exit 1 → **`67bcde75489419e5331187b8ebf140a7` exit 0**, and the R8 tape gate
**534 / 0 / 67 → 541 / 0 / 67** (derived row by row before the run). Three findings the third
window bought: the SEAM is the only instrument that can see a dishonest boot (every stream
claim stays green); a LATCH is not a LIVE STATE from window 3 on (`SEAM_PREBUILD_FIELDS` — ⚖ an
ASK, unfixable by re-record); and two ledgers that agreed until a room wrote out of band.
⛓⛓⛓ **SLICE 4 — THE DERIVED `break` VERB, SHIPPED 2026-08-20**, `801fe0dfa..d49bdb1c2`. The engine
has modelled a sword swing on a `BreakableRock` since R5; what did not exist was a SOLVER row.
Two `OBSTACLE_STRATEGIES` rows (`breakablerock` AND `breakablerockghost` — one AS3 class, two
census tags) and one executor whose two guards each name an ITEM rather than a budget.
**Route-survey 22 → 23 of 29 with EXACTLY ONE ROW MOVED** (verdict *and* tick count diffed row
by row against a pristine baseline); step 12's L3 SOLVES in 226 ticks and its stance is the
BOOT CELL — the rock is the only non-lethal neighbour of a one-cell arrival island. New tape
`r9-solve-3`, recorded once on the announced Windows session: 227 observations, `save.time`
8853 game == model, one `primary` edge. **The owed R8 tape gate reproduced at 541 / 0 / 67,
ZERO moves.**
⛔⛔⛔ **AND THE GENERATOR HALF IS A REFUTATION.** Arc 5 left `shortcut` out of the catalogue
behind three walls and said the head was "ONE LINE on the day a derived break verb lands". It
landed; the grade did not. `probe-seedling-shortcut-grade.mjs` (arc 5's scratch probe, now a
committed instrument) returns 244 / 244 / 129 to the tick with the verb driving step 12.
**THE FOURTH WALL: a verb is selected only from a `planError`, and a shortcut is by definition
a cell whose walling leaves the goal reachable — so the planner never refuses and no verb is
ever selected.** On Seedling an item-gated obstacle grades STRONG when it CUTS and INERT when
it does not, with nothing in between; SHORTENS needs a solver ROUTE PREFERENCE that MOVES
TAPES ⇒ ⚖ an ask. The head stays out (trap 462, sharper), the four predicted re-pins do NOT
land, and the REACHABLE head is named with its evidence: **ROW 14's ROCK LOCK** — a
`breakablerock` on a main-path CUT, `needs:['hasSword']`, no live body and therefore no A10.
⚖ A SECOND ASK: `solverBot.facingToward` answers in a numbering the game does not use, so
`slashRectToward` can never accept a VERTICAL strike cell — conservative, hence three rungs of
green tapes over it, and repairing it moves tapes.
⛓⛓⛓ **SLICE 5 — THE CAMPAIGN OPENED: (d), THE TIMED-ROW RULE, AND THE TRUE-START CENSUS,
2026-08-21.** ⚖ Ruling 12's option (d): the page ASSERTS a continuation window's declared `rng`
pre-vs-pre and then STRIPS it from the copy `botLoadTape` gets (`split` KEPT — `Rng.split` is
assigned unconditionally, and TWO roster tapes really declare it true, so the tier-1 refusal has
a live witness rather than only a mutant). ⚖ Ruling 14's TIMED-ROW RULE: a v9 `at` row is the
walk's OWN clear, excluded from latch equality, withheld from the GAME and handed to the MODEL
rebased — and **`act2-the-sword` steps ALL ELEVEN WINDOWS with TEN boundaries admitted, with the
tape byte-untouched**. ⛔ Carried off, three: **a refusal that names its own next work order can
name the WRONG one** (slice 2 asked for a re-record; the cure it named — the v9 `at` channel —
was already on the tapes it was refusing, and what was missing was an admission rule that could
read it); **a lookup keyed on the BOOT answers a question about the boot, never about the GOAL**
(the survey's `KNOWN_ANSWERS` map pointed step 11 at `r8-solve-11`, which solves a DIFFERENT
goal at 87 t where the route's leg is 119 t — so the census's biggest row is a MISSING SEGMENT,
not a re-record, and the gap count is FOUR); and **a true sentence about the wrong ledger, for
the second slice running** (`earnedClears` does not carry an APPLIED TIMED row, so the live
envelope needed a third ledger). The census's fix list names five re-records with their
PREDICTED `seam.time` (5609 · 6279 · 6847 · 7921 · 8587), four gaps and the L14 STOP. ⚖ Ruling
13's rock-exposure report: **NO CHAIN ROOM MOVES** ⇒ the chain re-record goes AHEAD and
shortening follows under its own licence. ⛔ Zero tapes moved.
⛓⛓⛓ **AND THE WINDOWS SESSION REFUTED THE SLICE'S OWN HEADLINE PREDICTION, WHICH IS ITS BEST
RESULT.** (d) MOVED the refusal, it did not remove it: on three independent chains the
boundary AFTER the first refuses on **`seam` alone**, with **`time` the only differing row**
and the gap exactly **21 = LOAD_FADE_FRAMES (20) + BOOT_PRESWAP_FRAMES (1)** — the boot cost a
continuation never pays (`r8-d2-20` 10213/10192 · `r7-act2-3` 5069/5048 · `r8-solve-3`
5069/5048). **`rng` is not among the findings in any of them**, which is exactly what (d) was
for. ⇒ **⚖⚖ RULING 12's (a) IS REVIVED BY MEASUREMENT AND SPECIFIED TO THE FRAME**, with three
costed options for the user — a second declared tape field · `botStart` spending the boot cost
(AS3, not taken) · **the ADMISSION adding the constant back on a continuation, which needs no
tape change and is newly arguable**. ⛔ Not built; blocks nothing in slice 6 (`seam` is
unasserted by name on the JS tier). Gates: ship **83/0 → 91/0**, R8 tape gate **541/0/67** with
porcelain empty, vitest 6731 → 6758. ⛔ Carried off, one more: **a queue the JS tier refuses
never reaches the ship** — `watch.html` runs the JS walk first because it produces each
window's model stream, so the wasm tier's subject is the JS-ADMITTED PREFIX (trap 486).
**NEXT in R9: slice 6 — the chain RE-RECORD (the five successors + the four missing legs, each
predicted first), and the route's own next refusal is still L14's CAMERA BAND.**
**⛓⛓⛓ SLICE 6 SHIPPED 2026-08-21** — **THE TRUE-START SOLVER CHAIN.** ⚖ Rulings 11 and 15.
**(d′) first, measured**: `continuationTape` hands `botLoadTape` `seam.time + BOOT_COST_FRAMES`
(derived, summed once) AFTER the plain-equality admission, and `?tapes=r8-d2` now admits at
BOTH boundaries with a **ZERO residual**, every seam row equal, three per-tick agreements
(574/865/782), the whole 2219, dead frames [41,170,170] and the end state L13 Δ0/Δ0 — the chain
reached its end for the first time. ⛔⛔ **AND RULING 15's SECOND HALF WAS REFUTED BY
MEASUREMENT**: the model's resumed clock is ALREADY `declared + 21` (9200 vs 9179, 10234 vs
10213, measured at the pristine baseline before a line moved), because a sequence is ONE
`levelRun` and `enterWorld` spends the fade at the crossing that ENDS the previous window — so
(d′) has NO JS half and a derived pin says why. **THE CHAIN**: `r9-campaign`, custody, fifteen
segments from `new Game(0,80,128)` to the L14 arrival, **3470 ticks**, ZERO hits; segments 1–4
promoted, 5–10 and 12 re-booted from MEASURED latches, four new legs (119/47/237/74 — the
survey's own numbers). **Every re-booted segment moved in its BOOT BLOCK ONLY** — `inputs`
byte-identical, tick counts unmoved, expectations unmoved — predicted from an atlas census
(zero spinners in all twelve rooms) and measured seven times. The free oracle asserted the whole
clock column and **five of its numbers are ones the pairwise census could not see**, because a
chain COMPOUNDS. **THE PAGE PLAYS IT**: `?tapes=r9-campaign` steps all fifteen windows on one
game state, admits all fourteen boundaries, produces the headline's 3471 observations TICK FOR
TICK, and the rebased forward rows equal the headline's own declared v9 rows — two derivations,
one answer. **THE GOAL LEDGER CREDITS FROM SOLVER TAPES FOR THE FIRST TIME: 2/41**
(`sword@L10`, `chest@L11`). ⛔ Three findings nothing before it could measure: `jsLiveEnvelope`
was short the BANKED writes (a chest open; trap 493's third slice running) · the
clear-evidence arm dispatched on the KIND and the kind was a proxy for the AUTHORING METHOD ·
a third clear source `transported`, because the second cannot be faked. Gates: solver-roster
**754/0/68** over 26 tapes (successor to 541/0/67 over 20), porcelain EMPTY after it; ship
91 → **105/0**; sequence 21 → **26/0**; demos 21 → **22**; vitest 6759 → **6800**; roster 154 →
**159**; battery `--check` `67bcde75…` → **`6d667b17…`** exit 0, the ownership handover.
⚖ **§6 Q17 IS CLOSED**: (a)'s second declared field buys nothing (d′) does not, and is NOT
built. ⛔ **NOTHING RETIRED** — the ledger does NOT refuse two custody claimants (measured), so
`act2-the-sword` keeps its entry; slice 7's free list is named in kickoff §14.10.
**Slice 7 (THE FIRST COVERAGE-DERIVED RETIREMENT) SHIPPED 2026-08-21**,
`855a6d200..<head>`: `act2-the-sword` is OUT of `PLAYTHROUGH_CHAINS`, `PAGE_CHAINS`, the
picker and the sequence gate's pin — but **⚖ ruling 14's SECOND CLAUSE FIRED and the
retirement is PARTIAL: NINE of twelve tapes are covered, THREE STAY, named.** `r7-act2-6`
and `r7-act2-full` are the roster's ONLY v10 `despawn` witnesses (census over all 159
tapes: two despawn declarations, both theirs) and `r7-act2-5` carries the ETA transit
probe's positive oracle, the `tset -1` hold→kill refinement and the `twoPassSolve` bound;
a solver walk has no `phases` block by construction. ⚖ **RULING 17 (user, mid-slice: *"I
want to minimize hardcoding in general"*)** reshaped the build: measured first that the
hand route's eleven goal lists and the campaign producer's atlas derivation are
**IDENTICAL 11 of 11**, so no route constant was committed and no boot block was baked —
`scripts/procgen/seedling-atlas-goals.mjs` is the shared derivation and every producer
reads its staged boots off the covering solver tape. ⛔ mutant (a) found §14.10's consumer
set wrong: **FIVE of six producers** red on the deletion, not one, and the two that build
the name by template are invisible to grep. Sequence 26 → **24/0**; vitest 6802 → **6794**
(−9 = exactly the nine act2 seams, +1 the new `endsAt` gate); survey **23/29 unmoved**
after re-pointing; instruments 234 → **235**; roster **159, unmoved**. Battery `--check`
→ **`75adf826…`**, tail → **`9a6a3192…`**, both exit 0, both diffs published row by row;
four producers byte-identical. `r8-battery-4.endsAt` **253 → 255** plus the invariant that
gates it (`endsAt === sum(segment ticks)`, true of all fifteen chains).
`scripts/procgen/identity-block.sh` COMMITTED (ruling 17 (c)).
**Slice 7b SHIPPED 2026-08-21**, `fcab60f94..addf7875f` — the deletion EXECUTED and the
whole-chain wasm row RUN. Roster **159 → 150** (18 files: the nine tapes + nine
expectations — there were **no `traces/` rows**, the brief's third set is empty — plus the
regenerated index); `r7-act2-5/-6/-full` untouched. All six producers **byte-identical**
(`75adf826…` / `9a6a3192…`), identity block identical row for row, survey **23/29 with
every row unchanged**, sequence 24/0, vitest 6794 → **6767** (−27 accounted: −9
`tapeIndexManifest`, −18 `tapeRunner`, two rows per tape not one). ⛔⛔ THE MUTANT FOUND
**FOUR ACCEPTANCE GATES THAT WOULD HAVE GONE SILENT-GREEN** — a liveness probe fetching a
hand tape reads its absence as "no dev server", prints SKIP and exits **0** (trap 486
through a probe); all nine probes now read the generated index. Plus **two readers §15.11
does not name** (trap 516's second firing) and **two gates red for slices** because nothing
runs them. Survey: a dead boot source now refuses by name, exit 2, in EVERY mode. Windows:
ship **131/0** (arms 1–5 = 105/0, + the new CAMPAIGN arm's 26), pages **20/0** with the
picker reporting `150 option(s)`, solver-roster **768/0/67** (+14 = slice 7's own `endsAt`
invariant × 14 chains; −1 skip = the retired chain — derived before the run).
⛓⛓⛓ **THE CAMPAIGN CHAIN PLAYED ON THE REAL GPU AND STOPS AT BOUNDARY 5/15**: five windows
clean, then `r8-solve-6`'s declared `rng` is not the live world's — and all ten
`r8-solve-1..10` carry the retired hand chain's stream position byte-for-byte while their
`seam.time` was re-recorded. No JS row can see it (the model compares declaration against
declaration). ⚖ **OPEN: the cure is a re-record of `r8-solve-6..10`'s `rng` from the
campaign's own latch — a TAPE MOVE, so an ask; boundaries 6/15..9/15 are unmeasured.**
⛓⛓⛓ **R9 SLICE 8 SHIPPED 2026-08-21** (`a0991e536..c4f7b21e4`, seven commits) — ⚖ ruling
20, THE TICK-0 LATCH. A segment declares its boot state PRE-BUILD, and a fresh page then
spends it on the boot level's build and the load fade before tick 0; a continuation pays
neither. Slices 5 and 6 had been correcting for a state nobody measured. Now a v11 `tick0
{rng, seam}` block carries the fresh-page TICK-0 reading, derived by ONE ZERO-TICK Windows
run per segment — a tape with `inputs: []` whose terminal latch IS tick 0, verified from
`Bot.as`'s own control flow before any GPU was spent and measured at `latch.tick` 0 on all
twenty. **The derived set is TWENTY, not the ruling's 18** (`toy-west-pair` is a third
multi-segment chain). The field is game-INVISIBLE and JS-staging-INVISIBLE; the page WRITES
it on a continuation; `bootCost` survives as a CHECK the game passes **18 of 18** (every
declared segment reads `declared + 21`, render-coupled rooms included — coupling moves the
STREAM, never the CLOCK). ⛔⛔ **THE PREDICTION MISSED AND THE MISS IS THE PROOF**: the chain
still refuses at `boundary 5/15` — but windows 2..5 were each written their committed
tick-0 block, boundaries 1..4 admitted and all five windows agree per tick, so the live
position at boundary 5 **IS** `r8-solve-5`'s fresh-page exit BY CONSTRUCTION, and the
declaration (byte-identical to retired `r7-act2-6`'s) is demonstrably not it. 7b could
infer the rng was never re-recorded; slice 8 PROVES it. ⇒ ⚖ **ruling 21: slice 9 is the
CAMPAIGN RE-RECORD PIPELINE, whose first run is the licence.** Also paid: a SEVENTH
producer on no checklist that had been re-versioning its own output since v9 (it read
`TAPE_VERSION`, which its own docblock forbids) and crashed before its verdict; and a
node-only import that broke `watch.html` and surfaced as a 180-second TIMEOUT rather than
a module error. Gates: identity identical, six producers green (four md5s moved on purpose,
two unmoved as the control), survey 23/29, sequence 24/0, browser 262/0/0, vitest **6777**,
ship **142/0**, pages **20/0** local+live, solver-roster **768/0/67 unmoved to the row** —
the measurement that the field is invisible to the game.
⛓⛓⛓ **R9 SLICE 9 SHIPPED 2026-08-22** (`d98c7aa98..ce18caa0e`, six commits) — ⚖ rulings
21 + 23. **THE TRUE-START CAMPAIGN CHAIN PLAYS END TO END ON THE REAL GPU FOR THE FIRST
TIME**: ship gate **245 / 0, ALL PASS**, the CAMPAIGN arm flipped from `REFUSES_AT 5` to
ASSERTING — 14 boundaries admitted, all 15 windows agreeing per tick over the whole 3471
observations, every tick-0 clock `declared + 21`, end state L14 (168, 72) Δ0/Δ0. ⛔ AND THE
BRIEF'S DEFECT DID NOT EXIST: `r8-solve-6`'s rng was never stale (eleven cached latches all
== their successors' declarations; the game reproduces 1726967612 and 514746467 today). The
real cause was `gameVisibleTape` handing the GAME a v9 TIMED persistence row as a BOOT
clear against `Bot.as:1587`'s clears-before-the-build rule — measured 514746467 with the
row vs **1196897329** without, everything else identical, with two controls narrowing it to
NECESSARY-NOT-SUFFICIENT. ⚖ Ruling 23 withholds a timed row on every path; the new
`rerecord-seedling-campaign.mjs` (S0..S5, resumable, cached on COMPLETE bytes) then
re-derived TWELVE boots in chain order — `rng.seed` the only field to move at seventeen
boundaries, plus the game-sourced `save.seal_parts` `[7]`→`[4]` below the L11 chest — with
**ZERO `RECORDED:` lines**, every input/expectation/trace byte-identical. Gates: identity
identical, seven producers green (three md5s moved, four unmoved as the control), survey
23/29, sequence green, census CONTINUES, solver-roster exit 0 (no solver tape moved),
reference MATCH 237, vitest **334 files / 10254**. ⚠ Two findings for slice 9b:
`plan-seedling-r7-ends-meet --check`'s md5 moves with MACHINE LOAD (it prints a wall clock)
and the fork's persistence reset is guarded (ruling 25).
⛓⛓⛓ **R9 SLICE 9b SHIPPED 2026-08-22** (`357444ed9..c8c465621`, three outer commits + one
in the fork and one in the wasm submodule, both AWAITING THE USER'S PUSHES) — ⚖ rulings
25 + 26 + §18.11. **THE FORK'S BOOT RESET IS UNCONDITIONAL AND IT MOVED NOTHING.** Both
`botStart` guards deleted (persistence sweep, save arrays), so a tape that declares nothing
now boots from the game's own fresh-start values instead of inheriting the page. THREE local
wasm builds: a CONTROL BUILD first at the *unchanged* AS3 (SWFRecomp had moved eleven
commits — `avm2_ops`, `avm2_display`, `render_webgpu`, `tag.c`), which read **245/0 ship,
768/0 solver-roster, 20/0 pages, 37/0 pipeline-S1 zero movers** on binaries that are NOT
byte-identical ⇒ the toolchain is innocent BY MEASUREMENT and W2's attribution is clean;
the edit then moved **nothing** on those same nine gates (identity block **byte-identical**
to its own BEFORE, six of seven producer md5s unmoved) — and the emscripten JS glue is
byte-identical between the two builds, so only the `.wasm` carries the change. ⛔ The one
thing that moved needed a NEW instrument: `seedling-bot-replay-win.py --tapes` cannot express
the mutant (its boundary guard refuses exactly that shape), so `probe-seedling-boot-reset.mjs`
runs two windows on ONE page — **INHERITS → FRESH on both arms**, with a third build
(persistence guard only) reading FRESH/INHERITS to attribute the two guards separately.
⚖ Ruling 26: reader census MEASURED by instrumenting `loadTape` for a whole vitest run —
**7 RETIRED** (the `r1-walk-*` family; `tiers.js` had already measured the family clause in
2026-08-07) and **16 UPGRADED to v3**, roster **150 → 143, nothing below v3 left**, inert on
the real game at **327/0/37**. ⛔ "an upgrade is ONE field" is REFUTED by the format (v1→v3
is four keys, v2→v3 two). ⚠ L49, the conch room, LEFT THE ROSTER. §18.11 paid:
`plan-seedling-r7-ends-meet --check`'s wall clock is gone and its md5
**`75cf816affb3cfb903ae22b4120395ec`** is FIRST-ESTABLISHED (reproduced twice under
different loads). Final gates: ship **245/0**, pages **20/0**, vitest **332 / 10178**,
identity block **`65dd5849…` unmoved**, reference MATCH 238, survey 23/29, pins ALL PASS,
**six CI greens on `ee6e5daae`** and the LIVE Pages row **20/0 ALL PASS** (its first run read
15/5 and the gate named the cause itself — "if the site is behind, this is the deploy, not the
page"; the CDN had not propagated 48 s after the deploy, and the identical command re-run read
20/0). ⚠ The live site runs the OLD binaries until the gitlink bump lands.
⛔ **THREE ASKS OPEN, ALL THE USER'S**: push `~/CC/seedling` (`bot`, `c2119e6`), push the
`seedling-wasm` submodule (`1bc0003`), then bump the outer gitlink — until the last one
lands, CI and Pages still run the pre-ruling-25 binaries.
⛓⛓⛓ **R9 SLICE 10 SHIPPED 2026-08-22** (`e3b5e06ca..3b09020f9`, seven commits) — ⚖ ruling
19, the user's: *"a way for the watch page to play the full sequence of campaign tapes that
we have solved so far."* **▶ campaign on `watch.html`: ONE CLICK plays fifteen windows, 3470
ticks, `new Game(0,80,128)` → the L14 arrival, on both sides.** The button holds NO chain id
and NO segment list — `director.campaignChoice()` picks by rule (custody + true-start +
solver-recorded) from `PAGE_CHAINS` plus a new `PAGE_CHAIN_META` whose every field
`director.test.js` recomputes from disk — and it writes through the QUEUE'S OWN WRITER, so a
campaign is a `?tapes=` LINK and there is no second player. ⛓⛓⛓ **THE HEADLINE FINDING: the
ruling's SECOND clause breaks a REAL tie** — `toy-west-pair` is ALSO a custody chain and
`r7-ends-meet-1`'s boot block is BYTE-IDENTICAL to `r8-solve-1`'s, so custody+true-start
selects TWO chains today and only "generated by the solver" leaves one standing (two
candidates is a REFUSAL by name, never a tie-break); the true-start axis therefore selects
nothing among custody chains and is kept as a SCOPE rule with its vacuity named. ⚠ The
sidecar predicate has ONE roster-wide exception, `diagonal-run` (a hand physics fixture that
is `decisionTrace.test.js`'s FORMAT fixture) — exact over the domain the control applies it
to, and PINNED by name. **The readout** (`__campaign`; `__campaignControl` for the pre-walk
state, because two states under one name make a terminal condition unwritable): rooms
crossed · **2/41** credited via `goalEarnedWitness` over boot(k)/boot(k+1) — the GAME's own
measured latches, deliberately not the model's item mirror · the end state · and the work
order from a committed **`campaign-frontier.json`**, which replaced the census's typed
`STOP_STEP = 16` with an ALIGNMENT of the chain's measured arrivals against the route's own
`crossesTo` sequence (it reproduced the literal exactly). ⛔ The detached `r8-d2` tail is NOT
offered and the gate asserts that ABSENCE. ⛓ Fixed a defect in the SHARED instruments
extractor — a consuming trailing delimiter meant the LAST flag of any usage block was
reported undocumented: **23 instruments gained one, 0 lost one**. Gates: sequence **24 → 36
/ 0**, demos **188 → 196 / 0** (a new `press` field the row actually CLICKS), director.test
**92 → 102**, ship **245/0**, local Pages **20/0**, **LIVE Pages 20/0 ALL PASS on the FIRST
run** — the first live measurement of the ruling-25 build, since the **gitlink bump landed
here** (`e3b5e06ca`, after verifying `1bc0003` on the real remote). Identity block
**byte-identical before and after — ZERO tapes moved**; full vitest **10190 / 0**.
⚠ ONE CI RED, AND IT WAS MINE: three `procgenDocs` pins (catalogue 21→22, headings 656→661
and 443→448) that a run bounded to `frontend/modules/seedlingDemo scripts/procgen` could not
see — a bounded sweep that does not NAME what it bounded reads exactly like a full one. Fixed
in `3b09020f9`, CI green there. ⚖ **RULING 28 (user, mid-slice): the `.gitignore` anchor was
REVERSED** — upstream ignore rules are not edited; use negation exceptions. Traps 549–553.
Kickoff **§20** is the as-built.

⛓⛓⛓ **R9 SLICE 11 SHIPPED 2026-08-22** (`5d8ded3b3` · `143846faf` · `4ebacf533`, three
commits) — ⚖ ruling 29's high-priority fix, taken BEFORE L14 on the user's own sequencing.
**Trap 498 PAID**: `solverBot.facingToward` now answers in `presses.js`'s numbering (the
constants IMPORTED — no literal 1/3 left), `FACING_KEYS` re-keyed to match, and slice 4's
correctly-numbered TWIN deleted so the `break` verb and the kill arm read ONE integer out of
ONE map. The pair is EXPORTED for the agreement claim — no public consumer exposes the
integer, so only an exported pair can assert it against BOTH vocabularies, which is the hole
the defect lived in. **`r8-solve-18` 573 → 541 ticks**, re-recorded on the real GPU with
`save.time` game 9168 = model 9168; `r8-d2` 2218 → 2186; `r8-d2-19`/`-20` walks HELD (only
`seed` + `time`, −32 each). Movers SEALED at a pristine tree → MEASURED → RE-RECORDED, and
**nothing outside the seal moved**. ⛓ The sharpest number is the press count: SIX presses
became FIVE, and since two Spinners at `hitsMax` 3 need six landed hits while one swing
cannot land twice on one body, **one swing landed on BOTH bodies** — the opportunity a
vertical slash rect makes reachable and the old numbering could never accept. Gates:
roster `--win` 768/0 (26 names DERIVED), ship 245/0, sequence 36/0, unfiltered vitest
332 files / 10194, pipeline S1..S5 wrote NOTHING. `identity-block.sh`'s header RE-SEALED with
the commit on every value (trap 549's cure). Traps 554–557. Kickoff **§21** is the as-built.
⚠ Two numbers NOT proven and said so in §21.9: the roster SKIP reads 65 not the quoted 67
(§16.11's "+2" looks double-counted; not re-run at the baseline), and one ship-gate red
(230/15) that did NOT reproduce.

⛓⛓⛓ **R9 SLICE 11b SHIPPED 2026-08-22** (`2880f7a5d`..`2f8836718`, five commits) —
⚖ ruling 32's protocol fixes, taken BEFORE slice 12 edits anything, on the orchestrator's
post-mortem of slice 11 (four avoidable retests). **B** `scripts/procgen/
reach-seedling-change.mjs` answers "what can this change move?" with a transitive REVERSE
import closure — producers/gates/pages/tests, the TAPES whose producer is reached, their
chains, and the identity-block rows — resolving the three edge kinds no grep can see: the
dynamic `join()` form (trap 543), the loader HELPER whose literal is at the CALL SITE (the
one that hid slice 11's four rows), and a gate that DRIVES a page over HTTP (21 of them).
Bases derived per file, 83 unresolvable edges REPORTED not dropped, and every report prints
*"a reach is an UPPER BOUND — it says what CAN move, not what WILL."* **C** a tape's bytes
reached the page down FIVE `fetch(` calls and now go through ONE `fetchArtifact` with
`cache: 'no-store'` — and WHERE it bites is measured: `python -m http.server` sends no
`Cache-Control` (Chrome revalidates), **GitHub Pages sends `max-age=600`** and serves the
OLD bytes with no request on the wire. **D** `cuts`/`endsAt`/`at`/`offset` are DERIVED from
the segment tapes; the derived numbers are **byte-identical to the typed ones on all fifteen
chains**, and the two rows the derivation makes vacuous are NAMED rather than left looking
like checks. **E** two docblock sentences. All five mutants fired. Gates: sequence 36/0,
ship **245/0 first run**, `r7-ends-meet --check` reproduces `75cf816a…` byte for byte,
reference ALL MATCH at 239 instruments, unfiltered vitest **333 / 10216** (+1 file / +22,
arithmetic closes exactly). ⛔ **TWO PRE-EXISTING REDS FOUND, BOTH BY B AND BOTH SLICE 11's**:
`check-procgen-demos.mjs` is **194/2** (entries `dropped-element` seed 1 and `arena` seed 6 —
exactly the certification flips slice 11's own §21.4 measured; confirmed by control), and
`plan-seedling-r7-act2.mjs --check` has been broken since `706886397` (`no chain
"act2-the-sword"`). Both left as RESIDUE. ⛔ **ONE CI RED WAS MINE** (`8a80cbd81`, fixed `da46b0e59`, JS-unit
SUCCESS there): the reach test resolved its subject with a `git diff` over history in the
DESCRIBE BODY, which on CI's SHALLOW checkout threw at COLLECTION and took all 16 of the
file's rows with it while the local unfiltered run was green — trap 561. The seven paths are
now pinned as DATA. ⚠ And a gap found on the way, NOT taken (a CI-config fix runs first in
production): `unittests_frontend.yml`'s `paths:` filter lists only `frontend/**`, so a commit
touching only `scripts/procgen/*.test.js` does not trigger the JS unit suite at all —
`da46b0e59` had to be `workflow_dispatch`ed to be proved green. Kickoff **§21b** is the
as-built. ⚠ Ruling 32 **F** = ⚖ **ruling 33**
(targeted roster `--only=`) is NOT shipped, but its input now is: `--only-list` prints the
selection as one line, and on slice 11's range it emits exactly the **22** names §16.11
derived by hand. The CALLING CONVENTION is residue — no slice has run
`--only=$(… --only-list)` yet.

⛓⛓⛓ **R9 SLICE 12 SHIPPED 2026-08-23** (`54cde9014` · `51fe4d852` · `5c42f9c51` ·
`1e4c194bc`, four commits) — ⚖ rulings 29/30/31/33/34. **The MECHANISM half of L14; the
room does not SOLVE yet and that is the agreed split** (12b = W3+W4, 12c = the planner
dash primitive).
**THE FAMILY WAS NOT THE CAMERA BAND.** The survey's L14 refusal named a body at the
screen edge; a probe that KEPT the run read `playerHits = [{t:44, source:'chaser',
id:'bob@96,48'}]`. `Player.hit` writes the shake on tick 44 and the band opens — the band
is the MESSENGER and the family is **a hit from a chaser the walk did not see coming**.
**THE BOB FORECAST.** `previewWalk` stepped the player and the arrows and nothing else,
and `coupledHorizon` 0 in TRANSIT priced every bob's ungrown box AT PLAN TIME —
while `TRANSIT_INGREDIENTS.chasers` claimed a "per-tick next-cell check" that **existed
nowhere**. The bob that struck was priced at (96,48) and was at (113.7, 56.1). The forecast
is the ARROWS' own sentence one ingredient over (a widening of a tested path, not a
parallel one), with `onScreen` answered by a camera the forecast steps itself. **L14: 44
ticks + 1 hit → 0 ticks, 0 hits**, refusing BY NAME with all four rungs speaking.
⛔ It overturned a two-rung "law": `atEta === autonomous` was a CONFESSION, not a law —
player-coupling is exactly WHY a candidate-path forecast is the honest answer.
**THE PRESS ARM.** `KILL_ARM_POLICY.Bob` → `modelled`. ⛔ It could not be the planned
`chasers:` JOIN: a chaser has NO census rect by design, so the responder is SYNTHESIZED
from live bodies and absent state means NO RESPONDER (the inverse of the other five arms).
**THE GAME AGREED, and the differential could not have told us**: an expectation carries
the PLAYER's positions and this player stands still for 180 of 192 ticks, so a separate
`--mobiles` probe read the ENEMY — `hits 1/3 → 2/3 → 3/3`, the 30-tick i-frame armed on
each, `anim "die"` at `hits === hits_max`, a fade, a removal, player `hits: 0`.
**ZERO TAPE MOVERS** — the licensed set was DERIVED (`CHASERS` = {bob, jellyfish} ×
stepped × producer-derived = `r8-solve-4/-5/-6`) and all seven producers came back
byte-identical; my seal predicted two would move and both were refuted.
**GATES:** vitest **333/10235** · `check-procgen-demos` **194/2 → 196/0** (two
pre-existing reds from slice 11, ATTRIBUTED before being re-authored: a mutant on the
`--count=1` level was a mutant on a DIFFERENT ROOM) · seven producers unmoved · **⚖ RULING
33's FIRST USE: `--win --only=$(reach --only-list)` = 29 tapes, 832 PASS / 0 FAIL / 65
SKIP** · instruments 241 · roster 144. ⚠ 11b's published vitest 10216 was ONE LOW — it is
**10217**, measured at `6925622bd`.
⚖ **RULING 34 SHIPPED** — `scripts/**` + `test_json/unit/**` added to BOTH `paths:` lists;
CI JS-unit green. ⚠ The `scripts/**` trigger is UNPROVEN until a scripts-ONLY commit.
⛓ **THE DASH IS TRANSCRIBED AND UNBUILT** (12b/12c): the AS3 arithmetic, the asymmetric
`>=`/`>` guards, and the measurement that **at v = (0,0) it is EXACTLY inert** (the
recompiled runtime's `point_normalize` skips at zero length). Roster exposure derived: 41
tapes hold a sub-20 press pair, **33 inert and every producer-derived tape among them**;
the 8 that remain are a FREE ORACLE (fixed inputs, recorded expectations).
Traps 562–565.

**NEXT in R9: slice 12b** (W3 the opportunistic strike on EVERY walk + the KILL rung's
chaser arm, W4 the 16-window pipeline record, L14 SOLVED), then 12c = the planner dash
primitive, then slice 13 = the watch-page five.
⚖ ALSO OPEN: the v10 despawn channel has two witnesses and both are hand tapes — record a
solver despawn, keep them, or retire the channel; and `botStart`'s OTHER two "declares
something" gates (the seam block, the three rng writes) are an ASK — neither has a
fresh-start value to reset TO (kickoff §19.2).**
**Slice 1 (the quick fixes) SHIPPED 2026-08-20**, `d7b0f5ec1..9bbc847fb`: the
per-spec parameter DOMAIN `key=v1|v2|v3` (byte-inert, whole identity block
unmoved) and the rung's ONE ruled generator re-record adopting it in the biome
default — **the guard reaches a room 10 → 24 pre-sword and 10 → 15 post-sword**,
its graded-drop share 95.6 % → 89.3 % / 93.9 % → 90.9 %, mover set predicted
first and diffed row by row; A3's misreported WHY; the E bucket, where the demo
catalogue's `cli:` line is now EXECUTED (162 → 181 claims, and the first run
found a `; echo $?` that made a documented exit-6 command exit 0); a press-time
refusal on the editor-generate gate fails BY NAME instead of after 300 seconds.
⛔ Carried off: **a solver change that moves only a refusal STRING moves no tape
and still moves every payload that RECORDS a refusal** — A3 moved four identity
artifacts by one `reasonText` line each, ⚖ ruled to stand as a second, different
class of mover.
**Slice 2 (the tape SEQUENCE, ⚖ ruling 10) SHIPPED 2026-08-20**, `60fc17bf8..`:
`?tapes=a,b,c` on `watch.html`, both engines, the windows stepping ONE live run
with NO reload — `[r8-d2-19, r8-d2-20]` reproduces the headline `r8-d2` **tick
for tick** (1646 observations, first differing tick −1) and ends equal, which no
run had ever done: the chain had only ever been checked by arithmetic over a
single model run. `director.js` is IMPORTED by the page for the first time since
R5 built it. ⛔ Carried off, three: **the kickoff's admission rule refused the
slice's own subject** — a staged segment's declared block is a LATCH, so the
ruled rule became *admitted iff it MATCHES the live state, refused BY NAME
otherwise* (trap 470 again); **an equality claim can be blind to the mutant it
was written for** — a resume face that silently re-staged reproduced the
headline byte for byte, because every chain in the roster is cut at a level
ARRIVAL where a boot block reconstructs the world exactly, so ONE-RUN had to be
asserted directly; and **a segment's `persistence` carries two different
things** — a latch of its predecessor and a FORWARD DECLARATION of a clear its
own walk will earn — which is why `act2-the-sword` is not continuable past
window 4 as recorded, with the next work order named.

**⇒ CAMPAIGN ORCHESTRATION, session 2 → 3 (Fable, 2026-08-23).** Session 2 ran the opening
discussion (⚖ rulings 29–34: L14's strategy — opportunistic strikes on every walk, HUNT = KILL,
the sword dash modelled now; `facingToward` first; the watch-page five; the protocol fixes; the
targeted roster gate; the CI paths filter) and orchestrated slices **11** (`facingToward`, one
numbering — `r8-solve-18` 573→541, the swing that landed on both spinners), **11b** (the reach
instrument, one uncacheable tape loader, chain ticks read off the tapes) and **12** (the bob
forecast + the press arm vs Bob with the game's own enemy readout; L14 now refuses BY NAME at
plan time), all verified against disk, CI green at `f9eaf4c0c`. Handed off to session 3
(`NewDocs/plans/seedling-bot-r9-campaign3-planning-prompt.md`) with **slice 12b** ready to
launch (`seedling-bot-r9-slice12b-prompt.md` — the strike on every walk, the dash BUILT, the
cadence retired, the KILL chaser arm, L14 SOLVED, `r9-solve-14` through the pipeline) and
**slice 13** ready (`seedling-bot-r9-slice13-prompt.md`, the watch-page five); **12c** (the
planner-level dash primitive) is the first discussion item.

**⇒ CAMPAIGN ORCHESTRATION, session 3 → 4 (Fable, 2026-08-23).** Session 3 orchestrated and
verified SIX slices at `2e5637250..97b6cf444`, CI green throughout: **12b** (the sword dash built
and game-witnessed digit for digit; ⚖ ruling 36's swing-rate numbers; the cadence floor retired;
the opportunistic strike policy — one object, preview == drive), **12b′** (`allowDash` enforced —
L14 moved from the fallback to the PRIMARY: 145 t, AVOID alone, zero hits; the derived stance
shipped as the fallback), **12b″** (THE RECORD — `r9-solve-14` 145 t exactly; the campaign is
SIXTEEN rooms; frontier → step 17 = L15 `shove`), **13** (the watch-page five, tape-inert; the
phases gate repaired by SEARCH; `plan-seedling-r7-act2.mjs` retired), **12e** (protocol fixes II:
docs pins read the reference; the label/test-name lint; `standing-values.json`; `gates.sh`
exit-keyed; three frozen gate rows cured) and **12d** (the chain's ONE declaration
`campaignChain.js`; `--grow` with two witnesses; the concatenated headline tape RETIRED, roster
145). Rulings **35–40** recorded (dash first-class · swing rate · headline retirement · the six
streamlining items · the `why` convention · the full roster as a CHECKPOINT event). NOT a rung
close (user). Handed off to session 4
(`NewDocs/plans/seedling-bot-r9-campaign4-planning-prompt.md`): first act = the **12c** design
discussion (the COMPLETE dash model in the ORACLE → a `--mobiles` dash-hit witness → the planner
primitive; number to beat 145 t; ruling 39's `why` sweep rides its pipeline run).

**⇒ CAMPAIGN ORCHESTRATION, session 4 → 5 (Fable, 2026-08-23/25).** Session 4
designed and verified SEVEN slices — 12c (the oracle) · 12c′ (`planSwordDash` +
`--license-walks`; the flip alone = a 2.76× regression) · 12c″ (the harmless
window) · 12c‴ (the skew cure; L14 = **123 t driven, certified**; ruling 45) ·
12d′ (the two economies on local `r9/economies`; the flip alone refuses r8-d2)
· 12d″ (the L20 lean derived from the responder's own probe) · 12e′ (THE
RE-RECORD — **STOPPED, `main` untouched**: the dash impulse direction is read
from a one-tick-stale velocity, so a dash from rest with a same-tick key pays 0
in the model and 2 px in the game; two green pins; the series parked on local
`r9/re-record-attempt` @2aa070932) — recorded ⚖ rulings 41–50, opened the
editor arc's merge windows (A1+A2+B, C1, C2, D0a, D0b+D1 all ff-merged with
standing-values written), and handed off at **`a68b661bf`** to session 5
(prompt `NewDocs/plans/seedling-bot-r9-campaign5-planning-prompt.md`). NEXT for
session 5: launch **12e″** (brief ready: the from-rest dash fix, the licensed
witness `r9-l0-sword-dash-rest`, the roster proven inert, table (D′)) → the
re-record re-run on (D′) under ⚖ 49 + extension (licensed, unspent; S3's
record set derived from the projection diff is its W1) → the 12c batch closes
→ L15 `shove` VERB-APPLY design → L16; protocol lane ⚖ 47b (six items) after
the re-record. `ALLOW_DASH_ROSTER_WIDE` is still `false`; 123 is L14's number,
108 is never quoted; the local branches are never pushed without asking.

**⇒ CAMPAIGN ORCHESTRATION, session 5 → 6 (Fable, 2026-08-25).** Session 5
verified FOUR slices — **12e″** (the dash impulse DEFERRED to the velocity
`useItem` reads; the game reproduced the sealed witness column digit for
digit; the roster proven inert by a two-build stream diff; table (D′)) · the
re-record's **SECOND run** (STOP: the campaign chain re-recorded and GAME-CALM
at all fifteen boundaries, but `r8-d2-19` NOT CALM — a 28-tick freeze) ·
**12e‴** (the freeze = L19's SIGN opened by the SWORD key — the model's table
said V; ⚖ 53 the dialogue is never triggered; the Help frame; ⚖ 51
DISCHARGED; (D″)) · the re-record's **THIRD run** (STOP at S3: every latch
CALM in the GAME incl. `r8-d2-19` @721 v=(0,0), the record set derived 13/13,
then eight tapes red by ONE ULP on diagonal dashes — the game's dash direction
is a position round trip normalised by `sqrt(x²+y²)`; attributed offline to
13/13 EXACT, roster-inert, NOT applied) — recorded ⚖ rulings **51–55** (51 the
freeze first; **52 NO local unfiltered vitest — CI read by SHA via
`scripts/procgen/ci-vitest-summary.mjs`, the standing suite row QUOTED from
CI**; 53; **54 the STREAMLINING BATCH P1–P4**; 55 the ULP class in a new
session), landed four tape-inert pipeline fixes on `main` (producer ORDER
derived from the chains; the S3 record set from the projection diff; the
headline accounting; two wrong-subject guards), opened the editor arc's
windows (D2, E1/E1b, E1c/E2a), and handed off at **`67b20e6a1`** to session 6
(prompt `NewDocs/plans/seedling-bot-r9-campaign6-planning-prompt.md`). The
series is parked LOCAL on `r9/re-record-attempt-4` @763bf3cb8 (thirteen tapes
at their numbers + the thirteen RECORDED expectations as a refused WIP; ⚖ 49
+ extension UNFINISHED, not re-opened). SETTLED SEQUENCE for session 6 (user):
**12e⁗** (brief ready — the two ULP edits, the 13/13 verify, Class B) → **P1**
(brief ready — the provisional-latch mode, `--table`, the offline S0→S5
rehearsal, projection-keyed caches) → **P2** (the economies behind the flag)
→ the re-record's **FOURTH run** (no re-drive: verify + S4 + one push; closes
the 12c batch) → **P3** (CI-quoted rows + a box lock) → **P4** (one record
surface, one file per trap, 47b's leftovers) → L15 `shove`.


⛓⛓⛓ **R9 SLICE 12b SHIPPED 2026-08-23** (`12e80cb73` · `213d3078e` · `0055442f4` ·
`3dc6d632f` · `a736eac1e` · `2d6d33949` · `3b171ec1e`) — **THE SWORD DASH, BUILT AND
WITNESSED; THE CADENCE FLOOR RETIRED; THE STRIKE ON EVERY WALK.** As-built kickoff **§23**.

**The dash is a first-class move.** `set slashing` (`Player.as:779-804`) is transcribed
whole — four outcomes where the model had one (dash · swing · SWALLOWED · release), the
window `gap <= 19` because `slash()` decrements above the press, `knockback`'s guards
ASYMMETRIC (`>=` on x, `>` on y — rowed on `(1, √3)`, where `hypot` is exactly 2), and
exactly inert at zero velocity because the runtime's `point_normalize` skips at zero
length. ⛔ `useItem` is `input()`'s LAST act and `mobileUpdate` is
`friction(); input(); moveX; moveY` ⇒ the impulse is spent on THIS tick's sweep, so the
slash transition moved ABOVE `levelRun`'s step.

⛓⛓⛓ **THE GAME AGREES DIGIT FOR DIGIT.** New fixture `r9-l0-sword-dash` (roster 144 →
145, room DERIVED as the longest hit-free straight run over eleven chaser-free rooms),
`--win --record` on intel/gen-9: 38 obs, 0 transitions, all green. Three dashes, each a
step of **+1.750** (the 2.00 impulse minus the 0.25 of friction that runs BEFORE input),
decaying at exactly 0.25/tick — `r5Totem.controlRefutation`'s shape from the other end.
Four claims adjudicated: the impulse · `slashEnd`'s tick · **the non-refresh of
`slashTimer`** (this fixture is the only thing anywhere that can say so) · the
anim-complete re-arm.

⛔⛔ **AND §22.9's "8-TAPE FREE ORACLE" DOES NOT EXIST.** Its 41 candidates reproduce
EXACTLY and every one is inert: 640 `primary` entries → 374 survive `acting` → 149 hold a
sword → **149 ordinary swings, ZERO dashes**. `r5-bobboss-arm` (called "the sharpest
instrument, 72 presses") holds no sword and says so in its own committed description; the
watcher tapes lose all 79 presses to a dialogue lock. ⇒ the roster is a REGRESSION
witness, the driven witness became REQUIRED, and two planned mutants were VACUOUS rather
than passing. **Trap 568: carry a roster-exposure scan through the RUN before calling a
tape an oracle.**

**⚖ RULING 36 (max swing rate) DERIVED, code + docs:** an ordinary swing once per **20**
(the ±1 falls LOW — k=19 dashes; the old 21 was head-room) · **THREE dashes per window at
k = 2/8/14**, not four at 1/7/13/19 — `Input.pressed` is a RISING EDGE, so a press costs
two key ticks and `DASH_CHAIN` derives the schedule by RUNNING the transcription ·
damage one per 30 **per BODY**. `slashEnd` is the Spritemap COMPLETE callback;
`SLASH_ANIM_TICKS` derived (both plain-sword anims wrap on the 5th — a coincidence; the
ghost sword's wrap at 7). **⚖ ruling 31(b): the cadence FLOOR is retired at all three
sites**; only `execKillByPress.lastPressAt` changed behaviour (`>= 31` →
`> SLASH_HIT_TICKS`), which its own docblock had asked for years earlier.

**⚖ RULING 30 (b)(c)(d) SHIPPED:** `strikePolicy.js`, ONE object consulted by
`previewWalk` AND `drive`, NEAREST by `distanceRectPoint` with a total tie-break, four
candidacy gates with trace reasons, never refuses a walk; the forecast gained `hit()` so a
certified corridor carries its strikes' knockbacks and deaths. **The preview/drive
held-set EQUALITY is asserted between the two real functions** — 42 ticks key-for-key.
HUNT = KILL: the kill rung gained a CHASER arm, no fifth rung.

⚠ **L14 DOES NOT SOLVE** — it refuses BY NAME with five arms speaking, and the fifth names
its own cure: `bob@32,32` is 127.1 px away against an 80 px leash, so a stand-and-strike
waits for a body that never comes. ⛓ The mechanism is sound where it applies, measured on
L14: standing at the boot, 8 strikes, `bob@128,64` killed at t=170, **ZERO player hits**
with four bobs chasing — one stance clears ONE body. **12b′ = the STANCE DERIVATION →
L14 → survey 23→24 → the pipeline record**, brief in §23.10.

⚠ **The sealed mover prediction MISSED and the miss is the measurement:** all nine
producers' `--check` byte-identical, so on every committed corridor the policy returned
the walk's own keys on every tick — AVOID already routes those walks outside
`SLASH_REACH`. **⚖ ruling 30(a)'s licence went UNSPENT; no tape moved.**

**⚖ RULING 34 PROVEN and CLOSED** — the scripts-only commit `12e80cb73` triggered
`JavaScript Unit Tests` run 32620698137, SUCCESS. **⚖ RULING 33's second use took the FULL
arm** (`tapeRunner.js` edited + a tape added, both triggers it names): `--win --tier=full`
= **145 tapes, 3399 PASS / 0 FAIL / 43 SKIP** at `2d6d33949`, which supersedes 768/0/65 as
the standing full-roster value. Unfiltered vitest **333 / 10270**; instruments 242.
Traps **566–568**. ⛓ 12c's numbers are in §23.11 (a dash-chained traverse is 2.15× the
distance per tick — 53.4% fewer ticks).

### ⛓⛓⛓ SLICE 12b′ SHIPPED 2026-08-23 — **L14 CROSSED BY THE PARRY-WALK** (`7baf79492` … `ce0c68a81`)

**L14 solves: 145 ticks, six presses, five bobs KNOCKED BACK, none killed, ZERO HITS** —
rung 1 AVOID with the opportunistic strikes on it, which is ⚖ ruling 29(a)'s parry-walk
word for word (*"start moving towards the exit, using the sword to knock back any bobs
that get too close"*). Route survey **23 → 24/29**, exactly one row. ⚠ **No tape
recorded** — `r9-solve-14` is slice 12b″'s, and kickoff **§23b.8** carries its whole brief
(producer entry, chain entry, S0 prediction, ship CLAIM 7's sixteen windows, frontier
step 17 = L15 `shove` VERB-APPLY, the readout, the classifier's still-owed `playerHits`
arm, and the targeted roster).

THREE DEFECTS, ALL IN SLICE 12b's OWN WORK: **(1)** `runDwell` destructured three of a
four-key object and DROPPED the strike policy, so the chaser arm stood its whole bound
unarmed and reported the untouched policy's own zero; **(2)** `allowDash` was CARRIED and
never read, making its own docblock false — it is now enforced at the AIM, below the
candidate scan, refusing a press inside `ORDINARY_SWING_PERIOD` (⚖ ruling 36's constant),
which also closes §23.15's `slashRepeats` double-count from the policy's side; **(3)** the
dwell bound had no term for how long the body takes to WALK to the stance (108 for every
bob in every room → derived 102 / 106 / 116 / 148).

THE STANCE IS DERIVED — four forecast-answered conditions, `previewWalk` gained a STANDING
TAIL so approach and wait share one forecast, SCORED rather than first-viable, refusing BY
NAME with three counts, and unpriceable candidates REJECTED rather than raised. ONE
chooser with TWO named orders (`interceptOrder`, exported so the row calls the rule).

⛓ **The sharpest row is a mutant that did not go red.** Reverting the enforcement does not
refuse L14 — it moves the room from ⚖ 29(b)'s FALLBACK (247 t, two stances, one dwell
clearing THREE bodies) to 29(a)'s PRIMARY (145 t, AVOID alone). ⚖ 29(a) over 29(b),
MEASURED, and ⚖ 35's speed by way of the safety rule. ⚠ That mutant is also the fallback's
ONLY in-anger witness — **L16** is the first room that will need it. ⚠ "dashes are safer"
is NOT uniform between stances ⇒ **12c's first work item is the ORACLE (the preview must
step with the drive's stepper), not the primitive.**

GATES: unfiltered vitest ALONE **333 / 10277**; `solverBot.test.js` 44 → **50**; ten
producers' `--check` GREEN with **ZERO MOVERS**; roster **145 unchanged**; instruments 242;
reach `--only-list` over the slice's range = **25** tapes. Traps **569–571**.

**NEXT in R9: slice 12b″** (the record — `r9-solve-14` through the pipeline, brief §23b.8),
then **13** (the watch-page five), then **12c** (the complete dash model in the oracle,
then the planner-level primitive).

### ⛓⛓⛓ SLICE 12b″ SHIPPED 2026-08-23 — **THE RECORD: SIXTEEN ROOMS PLAY, FRONTIER MOVES TO L15** (`5abb4b067` … `a58d20b3a`, PUSHED)

**`r9-solve-14` is on disk and the chain plays it.** The custody chain is now **SIXTEEN**
segments — `new Game(0,80,128)` with an empty save to the **L15 arrival**, **3615 ticks**,
fifteen boundaries all admitted. The game agreed with 12b′'s offline solve TO THE TICK:
**146 observations, `primary ×6`, the game's own `hits` 0 against a model 0** — ⚖ ruling
29(a)'s parry-walk, recorded. The 145 was a one-sided prediction with a mechanism behind it
(`segmentBootFromLatch` authors from `beginEntry` = ctor (160,64), the same cell the route
survey stages) and its only miss-direction was named in advance. Pipeline S0 → S5: the
sealed table licensed 13 boot writes and 15 tick-0 re-derivations, and S1 measured
**`none` on every one of 20 boundaries** — 38 fields compared each. Ship gate CLAIM 7 moved
as predicted: *"the chain reached it for the first time — L15 (56, 72)"*, Δx 0 Δy 0.
Frontier artifact **step 16 (L14, CAMERA BAND) → step 17 (L15, VERB-APPLY — `shove` IS
registered and did not apply here)**, which is the next work order in the artifact's own words.

⛔ **THREE INSTRUMENTS HAD DRIFTED OFF THEIR SUBJECT, ALL THE SAME SHAPE** — a value derived
once, written down, then read by nobody who could tell it had gone stale. **(1)**
`r9-solve-13`'s `why` still said the chain STOPS at L14; that reaches the tape's
`description`, so the producer's `--check` reds by name (the brief predicted this mutant
gate-INVISIBLE — a miss called before the work). **(2)** `check-seedling-editor-sequence.mjs`
DERIVED CLAIM 9b's window count and then TYPED it into 9c (*"THE FIFTEEN WINDOWS"*) and
typed the arrival into 9d (*"at the L14 arrival"*) — and **neither could fail**, because the
assertions compare streams; the gate passed while its label described another chain. Both
now read `${CAMP.length}` and the oracle's own last observation. **(3)**
`reachClosure.test.js` pinned a CARDINALITY (`toBe(22)`) over a set that grows by design —
`solve-seedling-r9-campaign.mjs` is inside the historical closure, so every tape it emits
joins the set. It is now the RULE asserted as a SET against an independent corpus scan
(every tape whose `description` names a `solve-seedling-*.mjs` producer): **23 each way,
0 in either difference**. Mutant: swap one member — count unchanged at 23, row RED, which
`toBe(22)` could never do (trap 565).

⛓ Mutant (f) PAID: `familyOf` extracted to `scripts/procgen/surveyFamily.js` and it asks
`run.playerHits` BEFORE the text loop — with the ORDER built as an inline mutant, because
every refusal the survey has ever produced matches a text rule, so asking second makes the
arm dead code that reads as covered. ⚠ Its reach today is ZERO and the source says so:
the survey builds `replay` only for a step that SOLVED, and a SOLVED step has no refusal.
Two agreements nobody had ever asserted also landed — producer `SEGMENTS` ≡ chain
`segments` (read off the producer's SOURCE; it cannot be imported), and every segment
ARRIVES where its successor BOOTS.

GATES: unfiltered vitest ALONE **334 / 10293**, 0 failed (was 333 / 10277); FULL roster
`--win --tier=full` **146 tapes, 3425 / 0 / 43** ALL CHECKS PASSED (SKIP unchanged at 43,
as sealed); wasm ship gate **254 / 0 / 0** ALL PASS; sequence **36 / 0**; demos **196 / 0**
with the moved claim `windows.length == 16` holding; `check-seedling-wasm-pages` **20 / 0**;
solver roster (S4) **794 / 0 / 65**; thirteen producers' `--check` GREEN, **zero movers**;
instruments 242; procgenDocs corpus 686 → **694**; `check-seedling-wasm-pages`
**20 / 0 LIVE** against the deployed Pages root after the push; **CI 6/6 green** at
`a58d20b3a`. Traps **572–573**. As-built = kickoff **§23c**.

**NEXT in R9: slice 13** (the watch-page five), then **12c** (the ORACLE first — the preview
must step with the drive's stepper — then the planner primitive).

### ⛓⛓⛓ SLICE 13 SHIPPED 2026-08-23 — **THE WATCH-PAGE FIVE: the ladder becomes a link, sand traps become visible** (`a535bdb13` … `fa547ddaf`, PUSHED)

⚖ Ruling 29's five watch-page items, all in, tape-inert: **collapse/expand all** over
`querySelectorAll('details')` (⛔ NOT `.genSection` — the page has 13 `<details>` and only 11
carry the class, so the class is a filter wearing a query's clothes; the CSS comment saying
otherwise is corrected and the 10-open/3-closed default is asserted BY NAME); the **three
phase buttons stop drifting** (reorder + one flexible slider — and the mutant proves the
reorder alone passes the x row, so the SLIDER-WIDTH row is the one that gates the flex);
**`?phase=<name>`** as a generate-mode deep link through the page's ONE writer, refused by
name, deleted at the default, with 8 demo entries (derived from the catalogue's own `phase:`
fields) carrying it; **sand traps DRAWN** as a new `staticenemies` layer over
`staticEnemyDanger`'s own partition; **enemies on the FIRST paint in solve mode** from the
run the still frame was already holding. L6 first paint: 2 bobs + 4 sandtraps, disjoint.

⛔⛔ **THREE GATES WERE ALREADY RED AT THE HEAD AND ONE WAS CRASHING** —
`check-seedling-editor-phases` died on a `TypeError` after 30 rows because its `DROPPED`
subject was a live search result frozen as a literal that slice 11's `64875843c` revoked. It
now SEARCHES (CRASH → **82/0**). `-export` (2 FAIL) and `-overlays` (1 FAIL) are the same
shape against `r8-solve-18`'s re-record and are **slice 12e's**, unchanged. ⛓ **A gate that
throws prints no total: a gate runner must key on EXIT CODE.** And **seven typed cardinalities
across five gates** pinned the layer roster's size — four reddening at once on the sixteenth
layer, one of them a LABEL that went false on a passing row (trap 573, live). All derive now.
`plan-seedling-r7-act2.mjs` retired (instruments 242 → **241**).

GATES: unfiltered vitest ALONE **334 / 10293** UNMOVED; identity block **identical row for
row** vs a pristine `5c916efc0` worktree; thirteen producers' `--check` **byte-identical**;
`reach-seedling-change` PRODUCERS 0 · TAPES 0 · CHAINS 0 ⇒ **roster gate not owed**; phases
CRASH → **94/0**; generate 216 → **224/0**; demos 196 → **204/0**; solve 6 → **11/0**;
sequence **36/0**; reference **21/0**; ship **254/0**; pages **20/0** local. Traps **574–576**.
As-built = kickoff **§24**.

### ⛓⛓⛓ SLICE 12e SHIPPED 2026-08-23 — **THE PROTOCOL FIXES II: four instruments, two laws retired** (`a77b135cc` … , PUSHED)

⚖ Ruling 38 items **(4)(5)(6)**, tape-inert. **(4a)** the procgenDocs heading pins READ
`DOCS_INDEX.counts.headings` / the row's `headings` — a STALENESS claim, not a literal; ⚖
ruling 22's hand re-pin clause is RETIRED, and this slice's own doc commit is the proof (695
→ 696, 482 → 483, `docsRender.test.js` untouched, the first doc-editing commit since 11b to
pay nothing). **(4b)** `lint-gate-labels.mjs` + `lintGateLabels.test.js` — a gate LABEL or a
test NAME carrying a count the check computes; calibrated `5c916efc0` **13** vs head **10**,
the delta exactly slice 13's five; 98-entry allowlist keyed by file::rule::label, ten gate
findings named. **(4c)** the two red gates cured by DERIVATION — and there were **THREE**
frozen rows, not two (`-export:114`'s `tick 171 of 254` is the same `64875843c` re-record as
`573`): **export 27/2 → 29/0, overlays 23/1 → 24/0**. **(5)** `scripts/procgen/
standing-values.json` — 55 derived rows written by `standing-values.mjs --write`, ⚖ ruling
32 A now a `git diff` instead of a transcription; ⛔ `identity-block.sh` is BYTE-IDENTICAL,
because the proposed `r()` refactor would have broken `reachClosure.identityRows()`'s regex
and SILENTLY emptied every future reach report's identity section. **(6)**
`scripts/procgen/gates.sh local|live|reach` — 26 gates / 21 browser / 4 windows, local 26,
live 4, roster and flags derived from the gates' own argv; **verdict keyed on EXIT CODE, and
a zero exit with NO TOTAL LINE is a fail by name** (slice 13's crashing gate).

⛔⛔ **THREE OF THE SLICE'S OWN DERIVATIONS WERE THE FAMILY IT WAS SENT TO FIX** — a verdict
vocabulary GUESSED instead of read (the gates print five forms, not four; a green gate read
as "NO TOTAL LINE"), a `windows` detector that keyed on a docblock SENTENCE rather than code
(trap 566, inside the slice carrying the lint for it), and a template-literal test that
looked like precision and HID three of the five calibration sites. Each was caught by a
measurement, not by reading.

GATES: `gates.sh local` **26/26** with the Windows rows run (⚖ ruling 16) — demos 204/0 ·
generate 224/0 · phases 94/0 · sequence 36/0 · ship 254/0 · pages 20/0 · export 29/0 ·
overlays 24/0. Instruments 241 → **245**. Zero tape / trace / expectation / default /
identity-block moves; roster gate not owed. As-built = kickoff **§25**.

### ⛓⛓⛓ SLICE 12d SHIPPED 2026-08-23 — **ONE DECLARATION, THE CONCATENATED TAPE RETIRED, AND A COMMAND THAT GROWS THE CHAIN** (`c2a1607f7` … , PUSHED)

⚖ Rulings **37** and **38 (1)(2)(3)** — tape-MOVING (one deletion), and ⚖ rulings **39** and
**40** arrived while it ran.

**(1) THE ONE DECLARATION** is `frontend/modules/seedlingDemo/campaignChain.js`: inert data,
no imports of its own (⇒ browser-safe), and the producer IMPORTS it because the producer
cannot be imported — it solves at module scope and drives Chrome. **SEVEN typed copies became
one**, not the six sealed: the producer's own docblock carried a 16-line room table nobody had
listed. `PLAYTHROUGH_CHAINS[].segments` and `PAGE_CHAINS['r9-campaign']` **ARE the same frozen
array**, asserted by IDENTITY — the one assertion a hand-kept copy that matches today cannot
pass — and the tracked doc's chain table is the **4th GENERATED markdown region**. ⚠ **38
(1)'s exposure clause is AMENDED**: `R8_ENEMY_BRIDGE`'s prediction rows stay TYPED, because a
`levels` derived from the same atlas the measurement reads is a prediction that CANNOT BE
WRONG (trap 89); what derives is a COVERAGE row — every campaign room holding a bridged body
must HAVE a prediction row, asked AT THE DECLARATION, earlier than the guard itself can look.

**(3) THE RETIREMENT WAS MEASURED REDUNDANT BEFORE IT HAPPENED**: the sixteen segments played
ALONE by the model and concatenated are the headline's **3616 observations, first differing
index −1**. Tapes 146 → **145**; exposed 13 → 12; **three of six `clears` rows** went, exactly
the three whose only witness the headline was. Three claims are **UNASKABLE-BY-NAME** rather
than silently absent, each naming where its content went; one claim is really gone (9e's third
derivation), announced in a paragraph.

**(2) `--grow`** derives the next room from the chain's own tail `to`, asks the route survey
the census reads, cross-checks the committed frontier, and **a refusal is the ANSWER, not an
error**. Its first witness is real: today's tail is L14 → L15, the survey refuses L15, and it
printed route step 17's family and text VERBATIM and wrote nothing. Second witness: a scratch
worktree with `r9-solve-14` un-recorded — `--dry-run` planned **exactly 12b″'s seven
artifacts**, and the real run gave S0's **13 boot writes / 15 tick-0 re-derivations** and **16
of 19 tape fields byte-identical** (the three left are S2's browser stage). ⛔ **A SCRATCH TREE
CANNOT RUN THE BROWSER STAGES** — the dev server serves ONE tree — so `--from=`/`--to=`
rehearse offline and **the four summaries run only after a COMPLETE pipeline**.

⛔⛔ **THE TWO BEST FINDINGS ARE THE SLICE'S OWN TOOLS BITING.** W2's new ends-meet row made the
producer import `PLAYTHROUGH_CHAINS`, which `loadTape`s every segment AT MODULE SCOPE — so the
producer could not start in the one state a growth passes through (trap 584, found by RUNNING
`--grow`, not by reasoning). And a FOURTH read of the retired tape was invisible to grep:
`tapeOf(CHOICE.id)`, a CHAIN ID that resolved to a TAPE only because the two shared a word
(trap 583) — it crashed with 28 PASS lines and NO TOTAL. Plus 12e's label lint named this
slice's own new test row, and the docs pins needed no hand re-pin.

GATES: `gates.sh local` **26/26** · FULL roster **145 tapes 3378 / 0 / 46 ALL CHECKS PASSED** ·
unfiltered vitest ALONE **336 files / 10310 rows, 0 failed** · sequence 36/0 → **35/0** by
named rows · ship **254/0** unchanged · campaign `--check` `b3b18f4e…` → `1c7f03e4…`, the only
producer mover · instruments **245**. As-built = kickoff **§26**; traps **583–585**.

⚖ **RULING 39**: a segment's `why` carries ONLY the room's own story; frontier-status sentences
live in `campaign-frontier.json` and the readout. The sweep of the sixteen existing `why`s is
**12c's**, riding its pipeline run. ⚖ **RULING 40**: ruling 33's *"any push that moves tapes ⇒
full roster"* clause is **RETIRED** — the full roster is a CHECKPOINT event, and 12d's run is
the LAST tape-move-triggered one.

**NEXT in R9: slice 12c** (the ORACLE first — the preview must step with the drive's stepper —
then the planner primitive; L14's re-record now runs through `--grow`, and ruling 39's `why`
sweep rides it).

⛓⛓⛓ **R9 SLICE 12c SHIPPED 2026-08-23** (`73d9c3d35` · `88c2d7fad` · `47948452a` ·
`41f14a595` · `d3660b364` · `01b9f387f`), ⚖ rulings 41–43. **THE COMPLETE DASH MODEL IS IN THE
ORACLE, AND THE ROSTER-WIDE DEFAULT IS STILL `false`** — `solve-seedling-r9-campaign --check`
is unmoved at `8f8389ee…`, which is the proof.

12b′ measured the preview/drive gap to be exactly two things and closed it by REFUSING every
press that could dash. This closes it by MODELLING them. **(i)** `previewStepper()` takes a
per-tick `dashImpulse` — `stepOptsFor` stays the ONE builder and ONE call, the spread overrides
the single key it already declares, and the non-dash arm passes the object it always did, which
is why every committed corridor is byte-unchanged. `previewWalk` threads the run's slash state
in `advance`'s own order. **(ii)** `combatVerbs.slashPressForecast` is EXACT, not a gap
arithmetic; its outcome picks the scan's rect (24 × 20.8 at reach 24 dashing against 16 × 32 at
16 — neither contains the other), a press `set slashing` would swallow costs no aim tick, and
under `true` `certifyDash` prices the MARGINAL 9 px (`DASH_DISPLACEMENT`, DERIVED, and equal to
§23.11's game-measured 9) against PRE-STEP bodies through `chaseEnvelope` — trap 567, the probe
gets the DRIVER's information. **(iii)** §23.15's `slashRepeats` double-count is paid: a second
press REPLACES the pending hit ticks, which is the same sentence the line above it already said
about `slashEnd`'s clock. **(iv)** `r9-l6-sword-dash-hit` (roster 145 → **146**): the landed
reach **20.236** is above `SLASH_REACH` and below `SLASH_REACH_DASH`, so the game answers ONE
boolean — and answered it, hits 1/3, i-frame armed, body thrown east, every digit agreeing.

⛔⛔⛔ **AND THE MEASUREMENT THAT INVERTS 12c′'s PREMISE.** Of the 23 committed chain segments
**12 hold no sword and 10 carry no bodies** — exactly ONE, `r9-solve-14`, can reach the dash
branch at all. Re-solving the campaign offline with `allowDash: true` (a worktree, the
producer's own solve path) moves that one and only that one: **145 t → 400 t, +255, 2.76×**,
still zero hits and still a calm L15 arrival. §23.11's 2.15×-per-tick arithmetic is about
dashing TOWARD THE EXIT; the flag alone buys an OPPORTUNISTIC dash whose displacement the AVOID
corridor must be certified WITH, and the corridor that certifies is longer. ⇒ **12c′ must not
flip the default on the flag alone — the planner primitive is what makes ⚖ ruling 35's speed
claim true at all.** Proposed name `planSwordDash` in `solverBot` (`mover.planDash` is TAKEN and
means something else); and a plan certified on `stepV1` CANNOT be walked by a `stepV2` drive
that spends an impulse (trap 118's shape) — it must be built on `previewStepper()`, which as of
this slice carries it.

⚠ **⚖ RULING 30(c)'s PREVIEW/DRIVE EQUALITY IS A BOUNDED CLAIM, AND ALREADY WAS.** On L14's own
boot stand the sequences part at tick **207** with the default and **144** dashing — measured
identically at `f498381ca`. The named one-tick chaser-hit skew is the cause; the dash brings it
63 ticks earlier, it does not create it. L14's committed solve is 145 t, one tick past.
⚠ §23b.3's *"hit at tick 169 at the forecast stance"* does NOT reproduce, measured three ways.
⚠ **MUTANTS (a) AND (c) BOTH WENT THE OTHER WAY FROM THEIR PREDICTIONS**, and both taught: (a)
left the equality row green, so the row now asserts the previewed player's POSITION (the mutant
is then off by 13.35 px); (c) does not bring L14's hit back — **(ii), the forecast, is what
removes it** — but without it the stance walk drifts somewhere the RUN ITSELF refuses to step.

⚠ **NOT BUILT: (v), the `--license-walks` pipeline mode — handed to 12c″** with its reasoning in
kickoff §27.9. Its ANSWER was produced anyway (the worktree rehearsal above), and §27.7 shows
12c′ must not take that re-record until the primitive exists.

Instruments 245 → **247**; as-built = kickoff **§27**; traps **586–589**.

⛓⛓⛓ **R9 SLICE 12c′ SHIPPED 2026-08-24** (`d7ffaed88` · `f9cbb5c85` · `a2b8666da` ·
`3864ffcc3` · `ef7a844a2`, pushed) — **W1 + W2 only, TAPE-INERT; W3 is a STOP with the
user.**

⚖ **RULING 43's MODE IS BUILT** (`walkReport.js` + `walkMoves.js` + the pipeline): S0
MEASURES walk moves out of the producers' own `--check` re-solves and **`inputs` is what
decides** — a byte verdict would call ⚖ ruling 39's `why` sweep a walk move and send a
prose edit to the user for a licence. Ownership is the producer's OWN CLAIM
(`--walk-report`), not its tape's description; participation is its own argv, read out of
the instruments scan (⚖ ruling 38 (6)); the one browser-driving producer is `unmeasured`
BY NAME so S0 stays offline and worktree-rehearsable. `--license-walks=<ruling-id>` is
refused without an id (exit 1, run dir not created), never widens, cascades successors,
prints through S5, and is SPENT at the top of S1. Empty-set witness at head; the worktree
rehearsal reproduces §27.7 EXACTLY.

⛓⛓⛓ **`planSwordDash` DASHES TOWARD THE EXIT, AND SIX ROOMS GET FASTER** — chain
**3615 → 3401 t**: `r9-solve-13` 74 → **35** (2.11×, which is §23.11's 2.15×/tick arriving
where it was predicted), `r9-solve-2` 47 → **23** (2.04×), `r9-solve-0` 237 → 168,
`r9-solve-3` 226 → 175, `r9-solve-11` 119 → 97, `r8-solve-10` 90 → 81. A planned press
needs no body, no aim tick and no direction key (the dash impulse is along VELOCITY); the
policy's OPPORTUNISTIC dash is RETIRED under both flag states, which is §27.7's 400 t
removed at its source.

⛔⛔ **AND ⚖ RULING 35(c) IS ANSWERED THE OTHER WAY, WITH A MECHANISM: `r9-solve-14` is
REFUSED BY NAME** — 145 start ticks scanned, 116 not-faster · 16 would-hit · 13 danger —
**because L14 IS the walking-and-slashing room.** Its parry-walk strikes knock bobs into
their 30-tick i-frames and `certifyDash` cannot price a dash against a body in knockback.
The strike and the dash compete for the same room.

⛔ **THE FLIP WAS NOT TAKEN.** The licence covered `r9-solve-14` alone and only if faster;
six movers where one was licensed is a STOP by the brief's own clause. `ALLOW_DASH_ROSTER
_WIDE` is still `false`. ⛓ Measured that the flip and the re-record are ONE series: flipped
with nothing re-recorded, the campaign `--check` is RED with **26 FAILURES** by name.

⛔⛔⛔ The sharpest row: **the policy was only asked on ticks that HAD BODIES**, so a
body-free room took ONE press of a four-press schedule with no refusal to explain the
rest — **the null this slice nearly reported was an artefact of it.** Traps **590–593**;
as-built = kickoff **§28**; vitest 336/10329 → **338/10367**; instruments 247; roster 146.

⛓⛓⛓ **R9 SLICE 12c″ SHIPPED 2026-08-24** (`aa9e30664` · `ec5a2d0dc` + records) — ⚖ **ruling
44**: the re-record was SUPERSEDED until the dash model was complete, and the AS3 re-read
found what was missing. `Enemy.hitPlayer` (`Enemies/Enemy.as:211`) gates the
player-damaging contact on the **ENEMY's own `hitsTimer`**, so a struck body is harmless
for its whole 30-tick i-frame, keeps steering, and is not solid to the player. The RUN has
modelled that since R6 slice 3; the PLANNER never had. It does now, by CALLING
`enemyHitPlayerFires` through a wrapper that prices `uncertain`/`off` as DANGER, at
`certifyDash` and at `chaserDanger`'s per-tick arm.
⛓ **⚖ Ruling 35(c) is ANSWERED: L14 plans 145 → 128 t** (121 with the first site alone),
and §28.6's "the strike and the dash compete for the same room" is retired as a fact about
the MODEL. ⛔⛔ **AND THE PLAN IS NOT DRIVABLE** — the driven walk is HIT at tick 75 and
`levelRun` refuses to step at 77, on a corridor its own danger predicate certified. The
blocker is now the **preview/drive `hitsTimer` disagreement**: 12c's blanket refusal was
30 ticks wide and skew-PROOF, a THRESHOLD on the same value is not (parting 179 → 79; the
REFUSED arm 207 in every build), and the naive cure measures WORSE (62). It is TAPE-MOVING,
so it lands with the flip. Traps **595–596**; as-built = kickoff **§29**; TAPE-INERT (the
four owning producers' md5s unmoved at both commits).

⛓⛓⛓ **R9 SLICE 12c‴ SHIPPED 2026-08-24** (`e28e8c48e` · `5026eb5b7` · `bad5e4109` ·
`102196498` + records) — **the blocker is CLOSED and the seal is met.**
⛓ **THE GAME SETTLED IT.** The user's licensed WITNESS PAIR was run FIRST: two tapes from
`r9-l6-bob-press`'s boot, identical held keys, differing by ONE `primary` at tick 10. It
reproduces ⚖ ruling 44(b) in the game (0 player hits with ten ticks of contact suppressed
by the enemy's own i-frame, against 2 hits on the control) AND settles the skew — inverting
a struck body's own `hits_timer` out of `botMobiles`, three independent samples agreeing,
puts the landed hit at **PRESS + 1**: `levelRun.advance`'s convention, not `previewWalk`'s.
⛓ **THE CURE IS ONE SWORD WINDOW FOR BOTH SIDES** (`presses.swordWindowStep` &c.) stepped
in the run's own intra-tick order, **plus** the policy's body reading taken AFTER that
window rather than before it. Without the second half the parting goes to **62** — 12c″'s
own naive-deferral number. Measured: parting **207 → none** refused, **79 → none** dashing,
and the previewed player ends on the driven one's PIXEL.
⛓ ⚖ **Ruling 45 SHIPPED IN FULL**: `would-hit` retired to two named cases (a room that can
write `Game.shake` without the player — the writers table MINUS `playerHit`, computed; and
a body whose `contactPricing` is `unknown`/`boss`), and the candidate space gains the
PREFIXES of the dash chain.
⛓ **`PREVIEW_AGREEMENT_BOUND` 79 → 195**, re-derived (not retired) because a DEATH REMOVAL
still parts the body lists there; its cost measured on what it REJECTS is **nothing**.
⛔⛔ **THE RE-RECORD SESSION'S TABLE IS KICKOFF §30.6 COLUMN (C)**, every row DRIVEN with
0 hits and a calm arrival: `r8-solve-10` 81 · `r9-solve-11` 97 · `r9-solve-3` **151** ·
`r9-solve-2` 23 · `r9-solve-0` **144** (the mover 12c″ lost to the bound, back and better
than 12c′'s 168) · `r9-solve-13` 35 · **`r9-solve-14` 123** — chain 3615 → **3331 t**.
⛔⛔⛔ **123 IS THE CERTIFIED NUMBER AND 108 IS NOT.** A 108-tick L14 exists in the
intermediate column, drives clean, and was priced by a preview that still parts from the
drive — so nothing in that column certifies it. ⚖ Ruling 35 puts safety over speed: take
123. Traps **600–603**; as-built = kickoff **§30**; TAPE-INERT (the four owning md5s
byte-identical at all four commits; the roster grows only by the pair, 146 → 148, which is
also what moved `plan-seedling-r7-attribution`'s standing md5).
⚠ **THREE THINGS OWED, NONE THIS SLICE'S**: (0) `lint-gate-labels.mjs`'s `callsIn` does not
skip COMMENTS, so one apostrophe in a `//` comment makes every later `describe(`/`it(`
swallow the rest of the file — pre-existing, previously silent, and surfaced when this
slice put the first ALL-CAPS `.length` into the dead zone. MEASURED: the fix moves the
corpus 101 → 91 findings (12 gone, 2 new, ten files), so each needs deciding on its merits;
the one false positive it produced here is allowlisted on the merits (a slice NUMBER read
as a cardinality). (1) the removal-staging one-tick offset is
UNFIXED and is what the 195 bound stands on — fixing it would let the constant retire;
(2) `check-seedling-bot-differential` reads the game's status up to ~8 engine frames PAST
the tape (0.25 s poll at 30 fps), so a tape ending near an event reports one the tape never
scheduled — the driver-side fix is GAME-FACING and therefore ⚖ ruling 40's full-roster
checkpoint class. Until it lands, a tape's post-tape MARGIN is part of its design.

**⇒ ⚖ 47b — PROTOCOL FIXES III, scheduled (user, 2026-08-24) RIGHT AFTER the
re-record session, tape-inert, one slice, bundling three queued instrument
items:** (1) `lint-gate-labels.mjs` `callsIn` must SKIP COMMENTS — one
apostrophe in a `//` comment opens a fake string and a `describe(` swallows
the rest of the file (12c‴, kickoff §30.8b; `solverBot.test.js` has been a
~2,000-line dead zone since 12c″); the fix moves the corpus 101 → 91 findings
across ~10 files (12 gone / 2 new) and EACH is triaged with a calibration set
+ mutants (traps 579/580) — never waved through. (2) the replay driver's
POST-TAPE POLLER WINDOW (`seedling-bot-replay-win.py:69`: `botStatus` polled
at 0.25 s × 30 fps ≈ 8 frames past the tape's last observation with the last
keys held; a KILLING post-tape hit zeroes `hits` via `die()` — trap 600):
read the status at the tape's LAST OBSERVATION — a game-facing driver change
⇒ ⚖ ruling 40's FULL-roster run, which doubles as the overdue checkpoint
re-bank (the standing roster row is 145 tapes @3ca80b3c1; the index is 148).
(3) 12d's residues: the third `standing-values` row state (GPU, measured
in-session, un-re-runnable headlessly) and `identity-block.sh`'s invisibility
to the instruments index. INTERIM (approved): the 12d′ and re-record briefs
carry "run the lint with a SCRATCH comment-skip patch as a REPORT ONLY on the
test files you touched" so a typed count landing in the dead zone is seen
before the real fix lands.
(4) **`--help` behaves as expected on every instrument** (user, 2026-08-24): a
shared `argvHelp()` called first by every instrument's argv parsing prints the
docblock summary + the flags DERIVED from the instruments index's argv scan
(never hand-typed) and exits 0 side-effect-free; ⚠ ESM imports are hoisted, so
module-scope producers (the campaign producer solves on import) either move
their work into a `main()` (whole-roster replay + their own `--check` as the
gate) or answer through an index-backed `scripts/procgen/help.mjs <instrument>`
that never imports the script; plus a gate in the instruments scan that every
instrument is `--help`-safe. The "no `--help` probes" hygiene rule retires when
that gate is green.

⛓⛓⛓ **R9 SLICE 12d′ SHIPPED 2026-08-24 — THE TWO ECONOMIES, MEASURED ON A
RETAINED BRANCH** (kickoff §31; ⚖ rulings 46 + 47). Branch **`r9/economies`**,
HEAD **`3c3592282`**, parent **`5cf81e4ad`** — two commits, `648bf9af2` (⚖ 46)
and `3c3592282` (⚖ 47). **NO TAPE MOVED; `main` carries records only** (the
branch law: neither economy has a flag, so each moves committed solves the
moment it lands and `solve-seedling-r9-campaign --check` goes red BY NAME on any
tree carrying them — that red IS the measurement). The scratch dash flip is
never committed.

⛔ **⚖ 46's LETTER WAS REFUTED BEFORE A LINE WAS WRITTEN.** Driving straight at
`sword@48,48`'s centre from `r8-solve-10`'s boot enters the pickup ceremony and
burns the whole 400-tick budget frozen at (56,61.65), `collected 0` — L89's
feather stall on demand. Every placed `Pickup` is `special` with text and only
`Input.released(keys[6])` pages the NPC (`NPC.as:191`), which `drive` has no
cadence for. **The avoid-volume rule encodes a GAME FACT and STAYS**;
`runCollect` keeps the approach loop. What the user saw is `deriveStance`'s
`(d, y, x)` **tie-break**, which sends the walk to the NORTH neighbour whichever
side it arrives from. Cure: among candidates that can collect and that a
corridor reaches, take the MINIMUM-distance tier and inside it the SHORTEST
corridor. ⛔ The wider score (`walk + d`) is worth a further −13 t on
`r8-solve-10` and drives `r8-solve-20` INTO WATER — measured, controlled,
rejected under ⚖ 35.

⛓ **⚖ 47 IS BUILT ON THE ONE CLASS WHERE IT IS LEGAL** — a `tset == -1`
kill-lock, whose trigger survives the player. `preLockStance` = an orthogonal
neighbour of the lock's cell that the STILL-SOLID planner can reach; the wait is
`max(0, removal.t + opensOnTick(fade) − now)`, the executor's own sum read once.
`r8-solve-18` **541 → 437 t**, waits 0, and the committed tape's own key-less
gap t=292→394 is the 101 ticks it removes.

⛔ **L5 — the campaign's ONLY lock room — IS THE NULL, MEASURED**: 22–36 arrows
in flight through the whole fade (the player is on the button, so the ceiling is
FIRING, not draining). Saving 0. ⇒ **⚖ 47's campaign reach is ZERO.**

**THE TABLES** (every campaign segment DRIVEN, 0 hits, 0 deaths, calm, in all
five columns; column (B) reproduces §30.6 (C) digit for digit — the calibration):
campaign (A) 3615 · (B) 3331 · (C) 3328 · (D) 3331 · **(E) 3328**;
`r8-d2` (A) 2186 · (B) ⛔ REFUSED · (C) 1736 · (D) ⛔ REFUSED · **(E) 1660**;
and **(E₀), both economies with the flip WITHHELD**: campaign **3614**,
`r8-d2` **2000**, every row solving.

⛔⛔⛔ **AND THE SLICE'S LARGEST FINDING IS NEITHER ECONOMY: ⚖ 41's ROSTER-WIDE
DASH FLIP, ALONE, REFUSES THE `r8-d2` CHAIN** — `shieldlocknorm@176,16` never
opens inside its 131-tick bound, the snap never fires. §30.6's table is
CAMPAIGN-ONLY and `r8-d2` was never in it. The mechanism is pinned to the pixel:
`execTouch` leans by `leanKeys` = `|dx| >= |dy|` against the lock's CENTRE, and
at the derived stance **(168,24)** that comparison is an **EXACT TIE**
(`dx = +8.00`, `dy = −8.00`) resolved only by the `>=`. `DEFAULT_TOLERANCE = 1.0`
is an order of magnitude larger than that zero margin, so which lean the room
gets is decided by braking noise: measured `|dx| − |dy|` is +0.52 (A) · **−0.56
(B/D, fatal `up`)** · +0.74 (C/E) · **+0.12 (E₀)**. `up` is fatal because
`ShieldLock.update`'s probe is `collide("Player", x − 1, y)`, a WESTERN
approach. ⚠ **NO COLUMN IS ROBUST — three fall right, two fall wrong, the sixth
clears by a tenth of a pixel** (trap 588). The dash-overshoot hypothesis is
TESTED AND REFUTED: every column's arrival is inside `DEFAULT_TOLERANCE` on both
axes, so a leg-length gate would gate the wrong quantity.

**⇒ 12d″'s FIRST ACT: derive the touch lean from the mechanism's own probe
direction** (`x − 1` ⇒ horizontal, from the west) rather than from the dominant
axis to the centre — which REMOVES the comparison instead of widening its
margin. Until it lands, **no `r8-d2` row in any column is evidence about the
flip.**

**NEXT in R9: THE RE-RECORD SESSION**, whose inputs are now: branch
`r9/economies` @`3c3592282`; kickoff §31's table **(E)** (campaign 3328 +
`r8-d2` 1660) or **(E₀)** (3614 + 2000) depending on the flip decision; each
mover's licence cited per segment (⚖ 35(c)/41 for the flip's, ⚖ 46/47 for the
economies'; ⚠ the two `r8-d2-*` rows are flip+46 JOINTLY and are NOT separable,
because the flip alone refuses). ⛔ **123 is L14's certified number and 108 is
not.** Run through `rerecord-seedling-campaign.mjs` under ⚖ ruling 43's
`--license-walks`, with ⚖ ruling 39's `why` sweep riding it. Then the route:
L15 `shove` VERB-APPLY → L16 BRIDGE → L8 ORACLE → A14 → A16.

⛓⛓⛓ **R9 SLICE 12d″ SHIPPED 2026-08-24 — THE TOUCH LEAN IS THE MECHANISM'S
OWN PROBE** (kickoff §32; ⚖ ruling 48 DISCHARGED). `main` @**`2473a520f`**.
⛔ **NO TAPE MOVED, AND THE INERTNESS IS MEASURED RATHER THAN ASSUMED**: all
FIFTEEN producers' `--check` md5s are byte-identical to `standing-values.json`
— campaign `8f8389ee…`, battery `18682c65…`, d2-chain `4e21c680…`, l18
`c0ecf701…`, r8-d2 `6e0967bf…` and the rest — so the fix landed on `main`
rather than on `r9/economies`, which stays 12d′'s and untouched.

**THE FIX IS A REMOVAL.** `execTouch` chose its lean by the dominant axis to
the lock's CENTRE, and §31.7 measured that comparison sitting on **0.00 px** at
L20's derived stance with a 1.0 px drive tolerance on top of it.
`ShieldLock.update` is `collide("Player", x - 1, y)`, so the approach is WESTERN
by construction: the probe offset is transcribed onto `activators.
TOUCH_RESPONDERS` with its AS3 line, `approachKeyFromProbe` NEGATES it (the
probe shifts the responder's mask, the body is solid, so the only air it adds is
on the side it points at), and the lean is `right` by derivation at every
stance. ⛔ A responder with no transcribed probe **REFUSES BY NAME** — a
dominant-axis fallback would reinstate the defect for exactly the classes nobody
has read. All three `collide("Player", …)` probes in `Puzzlements/` were read:
`PushableBlock` probes four faces (the side is the PUSH direction, `execShove`'s
question) and `Whirlpool` is CENTRED (adds no air, names no side) — neither is a
touch responder, so **no touch responder keeps the dominant axis**.

⛓⛓ **UNDER THE FLIP, `r8-d2` NOW SOLVES WITHOUT ⚖ 46 — 1801 t**, with
`r8-d2-19` **727** and `r8-d2-20` **588**, the first flip-only digits those two
segments have ever had (§31.6 could only write ⛔). The campaign is UNMOVED at
**3331** (L14's **123** included), and with the economies branch the table
reproduces §31.6 column (E) digit for digit: **`r8-d2` 1660, campaign 3328**.
⇒ **⚖ 46's L20 RESCUE IS NOW REDUNDANT RATHER THAN LOAD-BEARING** — the branch
reaches 1660 for what it buys, not because it moved the shield collect 1.27 px
off a threshold. And trap 623's joint rows are separable at last: `r8-d2-19`
864 → **727** (flip) → 696 (+⚖ 46); `r8-d2-20` 781 → **588** → 554.

⛔ **⚖ 48's HYPOTHESIS IS TESTED AND IS NOT THE MECHANISM; NO GATE WAS BUILT.**
All six of §31.7's measured arrivals are inside `DEFAULT_TOLERANCE = 1.0` on
BOTH axes (widest 0.86 px), and the margin they land on is 0.00 px exactly — no
leg length makes permitted scatter smaller than a zero margin, so a leg-length
gate would gate the scatter and leave the threshold. The row that says so is
committed, and halving the tolerance reds it.

⚠ **`execKeylock` CARRIES THE SAME SHAPE AND IT IS MEASURED NOT TO MATTER.**
`BossLock.as:62` probes a line at `y + height + 1` — SOUTH ⇒ `up` — and the
running numbers at `bosslock@48,32` are `|dx| − |dy|` = **−14.78** (flip+fix)
and **−16.43** (control): ~15 px against a 1.0 px tolerance, with the dominant
axis and the probe AGREEING. ⇒ **`r8-d2-19` does not stand on a coin toss and
the re-record does NOT wait for an `execKeylock` fix.** Landing the same
one-line derivation there is worth doing on its own merits — it would make the
agreement a fact rather than a coincidence — but it blocks nothing. **A QUEUE
LINE, NOT A SLICE.**

**⇒ THE RE-RECORD SESSION'S TABLE IS COLUMN (D)**, superseding §31.10's (E)
caveat: campaign **3328**, `r8-d2` **1660**, on a build where **no row depends
on a tie**. §31.7's "no `r8-d2` row in any column is evidence about the flip"
is LIFTED. Licences per segment unchanged (⚖ 35(c)/41 for the flip's, ⚖ 46/47
for the economies'), except that the two `r8-d2-*` rows are now separable.
⛔ **123 is still L14's certified number and 108 is not.**

⛓⛔ **R9 SLICE 12e′ RE-RUN — THE CAMPAIGN CHAIN IS RE-RECORDED AND GAME-CALM;
THE `r8-d2` CHAIN IS A SECOND STOP, 2026-08-25** (kickoff §35). ⚖ **RULING 51
(user): *"We will need to fix the freeze. We can start a new session for this.
We can leave the chain incomplete until this is fixed."*** ⇒ the ONE-SERIES LAW
stands, the WHOLE series stays PARKED on local `r9/re-record-attempt-3`
@`8078cd3d7` (never pushed), **a campaign-only push is NOT authorised**, and the
freeze is **12e‴ — its own session, AHEAD of L15 `shove`.**

⛓ **WHAT LANDED, AND IT IS THE HEADLINE EVEN INSIDE A STOP.** The campaign
chain's re-record is COMPLETE: ten tapes re-authored to **(D′) to the digit**
(`r8-solve-10` 78 · `r8-solve-11` 84 · `r8-solve-18` 410 · `r8-solve-20` 229 ·
`r9-solve-11` 97 · `r9-solve-3` **152** · `r9-solve-2` 23 · `r9-solve-0` 145 ·
`r9-solve-13` 36 · `r9-solve-14` **118**; chain **3326**), and **every one of
its fifteen boundary latches is CALM IN THE GAME** — `r9-solve-3` among them,
`latch.tick 152 · level 2 · (48, 80) · v=(0,0)`, against 12e′'s level 3,
(81.25, 33.20), v=(−0.951, −0.618). 12e″'s ordering fix is confirmed on the
exact segment that stopped the last attempt.

⛔ **THE STOP.** `r8-d2-19`'s 708-t walk parts from the game at **t=17**: the
MODEL buys a from-rest dash of **+2.800** (`WALK_SPEED + SLASH_DASH_FORCE`) and
the GAME buys **0.000** — 12e′'s sign INVERTED. The game then holds exactly
(66.000, 152.000) for **28 ticks**, `right` held, 0 hits, drifts west on
fractional coordinates and leaves by L19's teleporter into **L18**. The model's
ledger has NO span there. ⛓ Measured TWICE, on two different predecessors
(stale 541-t and correct 410-t `r8-solve-18`), same answer to the digit — so the
pipeline's ordering defect was real and was never this cause. ⛓ ⚖ 51(c): this is
a **MODEL FEATURE, not a tape retirement** — `r8-d2-19` is already
solver-authored. Two eliminations with lines (`Player.freeze` has ONE caller,
`IceTurretBlast.as:52`; `ShieldBoss.knockback` is an EMPTY override), one
candidate whose arithmetic does NOT close (a solid Sign, `NPC.as:59`), and
**28 names nothing**. Kit for 12e‴ in kickoff §35.7a.

⛔ **A SECOND, SMALLER PARTING, ATTRIBUTED WITH NO BROWSER**: one clock frame at
`r8-solve-10 → r9-solve-11`. The tape is RIGHT (it carries the game's
`beginEntry.save.time − BOOT_PRESWAP_FRAMES`); the invariant
`gameDead = modelDead + 1` holds on twelve segments and fails only on the one
with a walk-dependent span. Three cached latches settle it: the GAME spent
**192** under the old 90-t walk and **191** under the new 78-t one; the model
says 191 for both. The obvious hypothesis was tested against the tapes and
REFUTED, and is recorded as dead.

⛓ **FOUR TAPE-INERT PIPELINE FIXES SHIPPED TO `main`** (`99da909a0..989d385ab`
+ `f4b3ff9d6`): the accounting reaches a chain's HEADLINE (`r8-d2`, 2186 t, had
a row in its producer's report and none in the table); `solve-seedling-r8-d2`
reports its walk (without it `r8-solve-20` had no path into the licence at all,
and its `--check` md5 is byte-identical with the flag absent); **S3's record set
is the game-visible PROJECTION DIFF, not `s2.wrote`** — which would have
recorded EIGHT where THIRTEEN are owed, the five it cannot see each being a
chain's first mover; and the licensed producers run in the **chains' order**,
not the file system's. Unfiltered vitest **353/11,031 ALL PASS** (+18 then +5,
every row named; two `canRun` rows came back STARVED at load 8.88 and are
**53/53 solo**); `standing-values --check` ALL CHECKS PASSED, nothing moved.

⛓⛓⛓ **R9 SLICE 12e″ SHIPPED 2026-08-25 — THE GAME'S OWN WITHIN-TICK ORDER IS
THE MODEL'S NOW, AND THE GAME SAID SO** (kickoff §34). `main` @ six commits;
roster **148 → 149**; ⚖ 50's witness spent, ⚖ 49 + its extension still LICENSED
and UNSPENT, re-attached to **(D′)**.

**THE FIX IS ONE SENTENCE IN ONE PLACE.** A sword dash's direction is the
velocity `useItem` READS, and `useItem` is `input()`'s LAST act — below the
movement arms that have already written `v`. So `set slashing` names a
MAGNITUDE and refuses the direction (`{force: SLASH_DASH_FORCE}`), and the
direction is resolved at `playerPhysicsV1.step`'s `useItemImpulse` spend site,
which is where the game resolves it. `knockbackImpulse` MOVED to v1 and is
RE-EXPORTED from v2 so no importer changed. ⛔ `vx`/`vy` LEFT `slashSet` and
`slashPressForecast`: the stale read is not merely unused, **it cannot be
spelled** — which is why the predicted "the policy still prices the pre-key
direction" mutant could not be built by forgetting and had to be built by
editing the resolver. ⛔ The brief's other shape was REFUSED as a measurement:
the velocity is post-friction AND post-`applyInput` AND post-waterfall, and the
pair that decides it comes off a swim channel no caller can read, so any
pre-step reconstruction duplicates `stepV2`'s prelude.

**THE ACCEPTANCE NUMBER COST NO BROWSER.** 12e′'s announced drive had left both
artefacts in the machine-global replay cache, so the comparison is a script:
**152 model ticks / 152 game ticks, IDENTICAL tick for tick t=0…t=141, and BOTH
sides report `transitions: []`.** t=114 is 42.4500 — the game's 2.80 px where
this model used to buy 0.80 — and the UNPINNED model refuses the wet tick at
(80.60000000000007, 40.44999999999996), the game's t=131 row to the last digit.
⇒ the corrected model agrees on its own that `r9-solve-3` 226→151 was a PLAN
and never a walk.

**THE LICENSED WITNESS WAS SEALED IN A COMMIT AND THEN DRIVEN.**
`r9-l0-sword-dash-rest` asks the game two questions ONE KEY apart, both from a
dead stop with the sword: a dash with the direction key STARTING that tick, and
— after a DERIVED coast back to a genuine standstill — a dash with no direction
key at all. A model reading the pre-key velocity pays nothing for both; a model
that has broken the zero-length no-op pays for both; only the game separates
them. The per-tick column was committed ONE COMMIT BEFORE the announced
`--win --record`, and **the game reproduced every digit: 2.800 px for the first
press, then the impulse's own −0.25/tick decay, and 0.000 for the second.**
⇒ the no-op is CONFIRMED rather than merely preserved: the fix NARROWED it to
the case the game is inert in too. `r9-l0-sword-dash.json` is BYTE-IDENTICAL.

**THE ROSTER IS INERT, AND THE PROOF IS A DIFFERENCE RATHER THAN A LABEL.**
Both builds loaded in ONE process (`git archive <parent> frontend | tar -x`,
not a worktree) and all **148** committed tapes replayed through each: streams
identical, **0 movers, 0 changed refusals**. A classification by "at rest"
would have missed a DIAGONAL press re-quantising across `knockbackImpulse`'s
asymmetric guards at speed. The census rides along as the explanation: 163
sword presses, 158 ordinary swings, 1 swallowed, **4 dashes — all on a MOVING
player**, on the only two tapes that reach the arm at all.

**⛔ TABLE (D) IS SUPERSEDED BY (D′).** Six of thirteen rows move, none by more
than 6.1%, and **the two rows 12e′ actually DROVE CLEAN do not move at all**:
`r8-solve-18` 410 · `r8-d2-19` 696→**708** · `r8-d2-20` 554 · `r8-d2` headline
1660→**1672** · `r8-solve-20` 244→**229** · `r8-solve-11` 84 · `r8-solve-10`
**78** · `r9-solve-11` **97** · `r9-solve-3` 151→**152** · `r9-solve-2` 23 ·
`r9-solve-0` 144→**145** · `r9-solve-13` 35→**36** · `r9-solve-14` 123→**118**;
campaign chain 3328→**3326**. ⛓ **118 is (D′)'s CERTIFIED L14 row; 123 was
(D)'s; 108 is never quoted.** The new `certifyDash` terrain refusal is new reach
and fires **0 times across all five producers**, so every mover is the from-rest
re-price. ⚠ **Every (D′) row is still the MODEL's word** — a `--check` re-solves
from the committed boot and never drives, which is 12e′'s epistemic note applied
to its own successor. The `r9-solve-3` fresh drive was NOT taken, by that same
law: only the EMIT path latches a provisional walk, and running the cascade here
would be the re-record's act.

**GATES:** unfiltered vitest ALONE **352 / 10,951 ALL PASS, +5 exactly**.
⚖ 47b **(6) cleared** in `combatVerbs.test.js` (its gate still owed). ⚠ One row
started and WITHDRAWN, recorded so no log reads as a completed replay:
`check-seedling-bot-differential --tier=full` without `--win` still drives
LOCAL HEADLESS CHROMIUM, ~350 s/tape under load; killed by captured PID plus its
`headless_shell` child by ppid, and not re-run — it answers nothing the two-build
diff has not.

**NEXT in R9: THE RE-RECORD, RE-RUN ON (D′)** under ⚖ 49 + its extension. Its
first work item is still S3's record set (the `gameVisibleTape` projection-md5
diff, so all TWELVE land rather than the 8 BOOT movers) — deferred again for the
same reason, its only honest witness is the live cascade.

⛔⛔⛔ **R9 SLICE 12e′ — THE RE-RECORD IS A STOP, 2026-08-25** (kickoff §33).
`main` @**`de6d80283`** and **NO TAPE MOVED**; the series never reached `main`.

**THE OFFLINE HALF REPRODUCED TABLE (D) TEN FOR TEN, DIGIT FOR DIGIT.** Then
the pipeline's EMIT path drove the game and it disagreed about one of them:
`r9-solve-3`'s 151-tick re-solve ends, in the GAME, still in **L3** — 25 px
short of the exit, `v = (-0.951, -0.618)` — while the model has crossed to L2
at (56, 88) with `v = 0`. Re-driven in the primary tree it reproduces to the
last digit.

**THE MECHANISM IS A WITHIN-TICK ORDERING.** `levelRun.js:13340-41` hands
`slashSet` `vx: state.vx, vy: state.vy` — the PRE-tick velocity — while the
game's `useItem(Main.primary)` runs inside `input()` AFTER the movement keys
have written `v`. A dash pressed **at rest with a direction key starting that
same tick** is worth `0.00` to the model and the full `SLASH_DASH_FORCE = 2.00`
to the game; `knockbackImpulse(0, 0, 2)` is `point_normalize`'s faithful no-op.
Over **22 presses in three driven tapes** the two agree to 0.01 px on every one
EXCEPT the two with that shape (t=114 model 0.80 / game **2.80**; t=137 0.80 /
**2.45**). Neither half of the discriminator decides alone — an ordinary swing
at rest agrees, and a dash with a same-tick key start while MOVING agrees.

⛓ **A SCRATCH CORRECTION (in §33.8 verbatim; one spend site,
`playerPhysicsV1.js:480`, because `playerPhysicsV2.step` delegates to `stepV1`)
makes the model reproduce the game TICK FOR TICK from t=0 to t=141** — and it
also agrees the walk **never crosses** (`transitions: []`; it walks into water
at the game's own t=131 pixel). ⇒ **`r9-solve-3` 226→151 was a PLAN, never a
walk, and TABLE (D) IS SUPERSEDED.** The re-record re-runs on 12e″'s **(D′)**,
re-measured after the ordering fix — which re-prices every corridor the planner
opens from a standstill, so it is a **DESIGN ASK, not a slice item**.

⛔⛔ **AND WHAT THE EARLIER COLUMNS WERE EVIDENCE OF.** Every "driven 0-hit,
calm arrival" in kickoff §30.6/§31.6/§32.5 is the MODEL's word: `--check`
latches the COMMITTED tapes (`latchOf(name, raw)`, :492) and only the EMIT path
latches the provisional one (:565). The game had never been asked about a
single new walk until 2026-08-25; three of twelve have now been asked and one
fails.

**WHAT LANDED — four commits, all green, no tape moved.** Two GREEN pins of the
defect (`40d4cc401`, `6e152d065`): the second is the one that DISCRIMINATES —
a dash at rest moves the player EXACTLY as far as no press at all
(`[0, 0, 0.8, 1.35]`, `r9-solve-3`'s own t=114/115), with a POSITIVE CONTROL
(moving, the same arm pays **2.85** against the walk's **0.85** =
`SLASH_DASH_FORCE`) because *"the dash bought nothing"* and *"no dash was
taken"* predict the same equality. Its mutant reds on the NUMBER —
`[0, 0, 2.8, 2.55]`, the game's own digits. Plus `fdcc5cde5`: **S0's walk
accounting is now total over the chains that EXIST** — `r8-solve-11` (87→84,
⚖ 46's own subject) lived in a ONE-segment chain, its producer reported the
move, and `reportRows` dropped it into neither the table nor `unmeasured`;
19+2=21 becomes 20+3=23, with per-segment `unmeasured` reasons. And
`de6d80283`, the tracked doc + the reference regenerated in the same commit.

⚖ **RULING 49 AND ITS USER EXTENSION (2026-08-25 — `r8-solve-11` + the four
battery trace sidecars, which move with byte-identical tapes because the flip
makes the planner's REFUSAL a recorded trace row) ARE LICENSED AND UNSPENT.**
The series is parked on the LOCAL branch **`r9/re-record-attempt` @`2aa070932`**
(`e329d18db` + the two `r9/economies` commits rebased, with the
`solverBot.test.js` append/append conflict resolved). `ALLOW_DASH_ROSTER_WIDE`
is still `false` everywhere.

⚠ **THREE STANDING MOVERS THE BRIEF DID NOT PREDICT**, measured under the
series build: `solve-seedling-r8-d2` `6e0967bf…`→`88151a03…`,
`solve-seedling-r8-battery` `18682c65…`→`b7e00ec4…` (predicted UNMOVED), and
`solve-seedling-r9-l3` `8ac17aca…`→`2e8e8a9d…` (unpredicted; emits nothing).
`plan-seedling-r7-attribution` was predicted to MOVE and does NOT.

**⇒ 12e″'s WORK LIST** (kickoff §33.13): (1) the ordering fix, as a DESIGN ASK,
with the user-licensed from-rest witness tape **`r9-l0-sword-dash-rest`**, then
(D′) re-measured; (2) **S3's record set** — it selects on `s2.wrote`, the BOOT
movers, so each chain's FIRST moved walk falls out: 8 recorded where TWELVE are
owed, and S4 would then red on four stale expectations. The design is a
`gameVisibleTape` projection-md5 diff snapshotted at the top of S1 and diffed at
S3; deferred here because its only honest witness is a live cascade; (3) the
`r8-d2` HEADLINE's accounting (it is in the d2-chain's walk report and is not a
`segment`, so it is dropped the same way `r8-solve-11` was); (4) **⚖ 47b items
(5) and (6)** below; (5) the unspent `why` sweep, three edits drafted.

⚖ **47b ITEM (5) — A BROWSER PREDICATE KEYED ON A PLAYWRIGHT IMPORT MISSES A
`py.exe` SHELL-OUT.** `solve-seedling-r9-campaign.mjs` and
`solve-seedling-r8-d2-chain.mjs` DRIVE Windows Chrome (`latchOf` shells
`/mnt/c/Windows/py.exe` at `localhost:8000` on a latch-cache MISS) and
`walkMoves.participationOf` classes them offline, so S0 calls itself "offline by
contract" while able to spend the GPU. The witness is 12e′'s own three
unannounced drives at 00:25 on 2026-08-25. ⚠ `/mnt/c/playwright/latch-*.json` is
a MACHINE-GLOBAL cache keyed on tape bytes, shared across trees and sessions.

⚖ **47b ITEM (6) — `node --check` IS THE STANDING SYNTAX GATE AND AT LEAST ONE
FILE FAILS IT SILENTLY AT HEAD.** `combatVerbs.test.js` throws
`SyntaxError: Identifier 'KILL_PRESS_CADENCE' has already been declared` (a
duplicate named import, esbuild-tolerated, 51/51 green). Fix the duplicate AND
add a gate that runs `node --check` over every `.js`/`.mjs` the instruments
index and the test roster name, so the syntax gate cannot decay.

### ⛓⛓⛓ SLICE 12e‴ SHIPPED 2026-08-25 — **⚖ 51 DISCHARGED: THE 28-TICK FREEZE IS L19's SIGN, READ WITH THE SWORD KEY** (`27f318161` … `d9b71e94a`, PUSHED)

`r8-d2-19` was never fighting the Shieldspire. `NPCs/NPC.as:191` takes a placed
NPC's talk key as `Input.released(p.keys[6])` and `Player.as:59` is
`[RIGHT, UP, LEFT, DOWN, X, C, **X**, V, I]` — index 6 is the SECOND `Key.X`,
the SWORD key. The model's own class table said "needs `Input.released(V)`"
(index 7), which no tape has ever pressed, so no sign had ever spoken in the
model while every walk presses X constantly. `NPC.as:190`'s `inRange` is a
CIRCLE on entity origins with `talkRange` 24 (`:27`), not an overlap of the
16×16 solid — which is why §35's box arithmetic "would not close" and was a
correct refusal of the wrong measurement: the sign's body ends at y 144, the
player stands at 152, and it talks from **17.088 px**. ⛔ **28 IS NOT A
CONSTANT**: it is `t_close(43) − t_open(15)`, a number the tape's own press
schedule produces against one wrapped page (the releases at t=1/3/9 are 26–35 px
out; t=23 and t=25 fail because `NPC.as:205` sets `currentCharacter = length − 1`
and never `length`).

A SECOND AS3 line was invisible until the first was right: `Player.as:560-563`
puts `slash()` ABOVE `super.update()`, so the sword's double-tap window drains
on FROZEN frames while `useItem` — inside the gated block — never sees a press.
With the dialogue alone the model parted from the game at t=45 by **exactly
2.0 px** (`SLASH_DASH_FORCE`); `slashTimerTick` inside `runFrozenTick` closed it.
The pin is the GAME's own 709-tick recording, committed as
`fixtures/r8-d2-19-freeze-oracle.json`: EXACT through t=60 (the freeze, its open
frame and its resume), 0 level mismatches, the terminal position to the digit,
and a MEASURED ≤ 3 ULP bound on the fractional drift after.

⚖ **RULING 53 changed the shape mid-slice** (user: *"Wouldn't it be better to
just not trigger the sign reading? … don't press the button that triggers it in
range"*): the dialogue is NOT priced, it is FORBIDDEN. `run.talkCircles` is the
live set (the Watcher absent by name — its `keyNeeded` is false, so no key
choice avoids it) and `strikePolicy.talkGuard` refuses any press whose RELEASE
would land inside a circle, in all three press arms, with a derived
over-approximate radius and a `talkRefusals` witness. It costs `r8-d2-19`
**+13 ticks**, not 28: the planner re-times the swing out of the circle.

⚖ 51's SECOND item fell the same way. One announced GPU row, two READ-ONLY
drives with the driver's new opt-in `--dead-curve`: the sword `Help` costs the
game **two** dead frames when the tape does not press X or C while it is up
(`NPCs/Help.as:23`, `:87-103`) and **one** when it does. Two prior readings had
called that refuted, both comparing the tick `Sword.removed()` FIRES — engine
adds are QUEUED, so the read that matters is one tick later, and there the walks
differ. `spendPickupHelp` now defers to the tick where the keys are known:
committed 90-t **191 UNCHANGED** (game 192) and branch 78-t **190** (game 191),
so `gameDead = modelDead + 1` is restored on both.

**TABLE (D″), offline, the model's word:** `r8-solve-18` 410 (promoted) ·
**`r8-d2-19` 721 with `the arrival is CALM — v=(0,0)`** · `r8-d2-20` 554 ·
headline **1685**. ⛓ **THE ROSTER IS INERT BY MEASUREMENT**: the two-build
stream diff over all 149 committed tapes — now also differencing
`deadFramesOwed`/`deadFrameSpans`/`gameTime` — moves 0 streams, 0 totals, 0
clocks and 0 refusals; the arm census (dashes / slash presses / ceremony starts)
moves 0; all seven producer `--check` md5s are byte-identical. Seven tapes move
the sword-Help span's `t` LABEL by +1, and the game's own counter says the new
label is the right one.

**⚖ 52's FIRST SLICE**: no local unfiltered vitest was run at any point —
bounded runs only, and the unfiltered number read from CI by SHA with
`ci-vitest-summary.mjs`, which this slice landed as its W0 hygiene item
(`27f318161`). CI `4ed3d3377` **355/11058** + slow 12/217; `gates.sh local`
**27/27 green**. Kickoff as-built **§36**; the tracked narrative is in
`docs/json/developer/procgen/seedling-bot.md`.

⇒ **NEXT: the re-record re-runs on (D″)**, by the orchestrator, from the parked
series `r9/re-record-attempt-3` @`8078cd3d7` (never pushed; the ONE-SERIES LAW
unchanged). ⚠ Residue: the three REFUSED talker classes (`oracle`, `witch`,
`yeti`) throw by name at the tick a walk would open them and have NO WITNESS —
a rung routing through L1, L12 or L58 owes their `doneTalking()`; §35.8's mutant
(d) is still owed by whoever completes the re-record; ⚖ 47b (5) and (6) carry
forward.

### ⛔⛔⛔ SLICE 12e′ THIRD RUN — **THE THIRTEEN WALKS ARE AUTHORED AND THE GAME ANSWERED EVERY LATCH; S3 IS A THIRD STOP, ON ONE ULP** (kickoff §37, ⚖ ruling 55, 2026-08-25)

**What the game said.** All thirteen licensed walks were re-authored and driven:
the campaign ten on (D′) to the digit with all fifteen boundaries CALM
(78 · 84 · 410 · 229 · 97 · 152 · 23 · 145 · 36 · **118 at 0 hits**, chain
**3326**), and the three `r8-d2` rows on (D″) — ⛓⛓⛓ **`r8-d2-19` at 721 t,
0 hits, 0 deaths, arrival 19→20, `the arrival is CALM — v=(0,0)`, 46 signature
rows latched at tick 721**, which is ⚖ 53's witness and the row two runs died
on; `r8-d2-20` 554; headline **1685 = 410 + 721 + 554** tick for tick, both
seams green. S3 derived its record set correctly — 149 projected, **13 moved**,
0 appeared, 0 vanished, every one inside the sealed licence.

**Then `--record` came back `327 / 9 / 47`.** Eight tapes red on
*"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"*, every one **~1 ULP**
(±7.1e-15 px), with a **13/13 predictor**: a `primary` DOUBLE-PRESS released
while BOTH a horizontal and a vertical direction key are held — a DIAGONAL dash.
`r9-solve-3` has 21 AXIS dashes over 152 ticks and passes; `r9-solve-13` fails
at tick 5 of 36. The ninth is `r8-solve-10`'s `saw_auto_advance=0 against 1
earned`, where the sword IS collected and the ceremony IS priced.

⛓ **CLASS A IS ALREADY CLOSED, OFFLINE, TO 13/13** — TWO ULP sources in ONE AS3
expression: `Player.as:788`'s position ROUND TRIP `x − (x − v.x)`, which the
model's spend site skips, and `knockbackImpulse` spelling `Point.normalize` with
`Math.hypot` + `cx / length` where the model's own `pointNormalize` spells it
`sqrt(x*x+y*y)` + `*= (1/length)`. Ablation: round trip alone **10/13**,
normalize alone **5/13 (nothing)**, both **13/13**; inert over the whole roster
(137 → 145 EXACT of 149, same four pre-existing residuals). Class B's reading is
that 12e‴'s Help model made the CHECK's premise false, with the intra-frame
order of `Help.update` vs `Bot.update` named as unproven.

⚖ **RULING 55 (user): both are a NEW session, slice 12e⁗.** ⇒ **the 12c batch
does NOT close here.** The series is parked LOCAL on
**`r9/re-record-attempt-4` @`763bf3cb8`** (`-3` @`8078cd3d7` kept as the
archive); `main` = **`3081682bf`**, which is a TAPE-INERT pipeline fix and the
only thing that landed: `predict()` returned a SUBSET of what it flushed, so
§35.4's chain-order fix had **only ever worked on the `--from=S1` resume path**,
and S2's sealed-table guard tested the GLOBAL failure counter. The kit for 12e⁗
— failing ticks, deltas, the ablation, the run directory and the `--from=S3`
command — is kickoff **§37.7a**. §35.8's mutant (d) is **SPENT** at last.
⇒ **NEXT: 12e⁗ → the re-record's FOURTH run → the 12c batch closes → ⚖ 54's
streamlining P1–P4 → L15 `shove`.**

⛓⛓⛓ **R9 SLICE 12e⁗ SHIPPED 2026-08-25** — **⚖ RULING 55 IS DISCHARGED AND BOTH
CLASSES ARE CLOSED ON `main`.** Class A is TWO EDITS, transcribed with their AS3
lines: the spend site derives the dash direction the game's way
(`knockbackImpulse(x − (x − v.x), y − (y − v.y), force)` — `Player.as:788`'s
POSITION ROUND TRIP, which the model had been skipping) and `knockbackImpulse`
normalises through `pointNormalize` with the game's `>=`/`>` guards, so
`Math.hypot` and `cx / length` LEAVE THE FILE and the model spells
`Point.normalize` ONE way. Measured offline, no GPU, seconds per pass:
**E0 5/13 → E3 13/13 EXACT** against the game's own thirteen recordings.
Class B's one open step is closed by a LINE rather than an argument —
**`Main.as:67` calls `Bot.update()` ABOVE `super.update()`** (= `Engine.as:69-77`'s
`FP._world.update()`), so `autoAdvance()` runs before every entity update and
reads the freeze the PREVIOUS frame's `Help.update()` left, and a Help the tape
dismisses on its own first update never makes a frame the counter can see; the
check derives from the model's dead-frame ledger now
(`dialogue.js`'s `autoAdvanceArrivals`) and **equals the old `swordPickups` on
149 of 149 committed tapes**, so the `--win` gate's verdict cannot move.
⛔ **TWO CORRECTIONS TO §37.6, both measured.** (a) The ROSTER probe the brief
names is **145/4 on `main` BEFORE the fix** — 137/12 was taken at the BRANCH
head, so that probe cannot discriminate; the load-bearing instrument is the
**two-build stream diff over all 149 committed tapes: 0 MOVERS, and the two 8 MB
dumps carry the SAME md5.** (b) The second ULP source is **TWO** differences —
`hypot` vs `sqrt(x*x+y*y)` (diagonals only, and its `0 of 200 000` for axes is
PROVABLE, not a sampling artefact) and `cx / L` vs `cx * (1/L)` (**both**, 14 %
of axes) — so the fix moves axis arithmetic too, and the roster's inertness is a
statement about the CORPUS, never a guarantee about axes. ⚠ A drafted claim that
§37.6 had measured the wrong sample was **REFUTED BY ITS OWN PIN** before it
shipped. Zero ledger: `standing-values --check` **47/0 with a line-by-line diff
against BEFORE that is EMPTY**, all seven producer md5s unmoved, no `--write`
needed; docs pins NAMED (`docsIndex` 214,642 → 215,198 words) with the generator
in the same commit; bounded vitest **490/490** incl. `procgenDocs/`; four mutants
spent and red as sealed. **No tape moved, the roster is still 149, the series is
still parked whole**, and the eight refused recordings are banked in
`fixtures/refuted/` (not enumerated by the roster) as the free oracles they are.
As-built kickoff **§38**; the fourth run's shape is **§38.8** — flip → VERIFY the
thirteen offline (13/13, NO re-drive, no GPU) → S4 → targeted roster + `--write`
of §37.4's six movers at a pushable head → ONE push.
⛓⛓⛓ **AND CI FOUND THE FIX'S STRONGEST WITNESS** (head `638b0bbec`, §38.11).
The first push came back 364/11379 with **2 failed** — both fixtures OUTSIDE the
bounded set, reached by the Class A edit, exactly ⚖ 52's by-design catch.
**(1)** `r8-d2-19-freeze-oracle.json` — a 709-observation recording made in the
real game two slices earlier, for an unrelated question, pinned at *226 exact
within 9.9e-14* with a note explaining the tail as the recompiled build's own
drift. Under the fix it is **709/709 EXACT, maxAbsDeltaPx 0**. **Nothing was
tuned to it and it is not one of the thirteen** — the strongest independent
evidence the change is the game's arithmetic rather than a curve fitted to it.
⛔ The measurement was honest and the CAUSE was wrong: a bound records what you
saw, it does not license a story about why, and *"the last few bits are the
emulator's"* survived two rungs on the strength of a number nobody disputed.
**(2)** the guard-asymmetry row's witness `(1, √3)` belonged to the spelling that
just left — under the transcription its normalised x is 0.5000000000000001,
STRICTLY above the boundary where `>` and `>=` both admit, so re-banking the
expectation would have left the row green and **non-discriminating**; the witness
is searched for against the transcription now, and mutant (c) re-spent reds BOTH
rows by name.
⇒ **NEXT: the re-record's FOURTH run (or P1 first — the orchestrator's
sequencing) → the 12c batch closes → ⚖ 54's streamlining P1–P4 → L15 `shove`.**
⚠ NEW BOARD LINE from this slice: **a one-spelling law is a property of a FILE,
not a call site.** R6 already paid this exact defect class (the tracked doc has
carried *"the model used `Math.hypot`"* since then) and fixed it only where it
hurt; `knockbackImpulse` kept the re-spelling for three rungs. A standing
FILE-level pin over every remaining re-spelling of a transcribed primitive is
cheap and nobody has built it — P3/P4-adjacent.

⛓⛓⛓ **SLICE P1 SHIPPED 2026-08-26 (`ca7edfd23` … `2beabea8c`, PUSHED) — ⚖ 54
(1), (2) AND (4) DISCHARGED; (3) IS P1b, NAMED NOT THINNED.** `--latch-
provisional=<segment>` puts a walk to the GAME ahead of the series — read-only
by default, `--drive` for the GPU, `--branch=<ref>` by `git show` behind a
gitlink guard on the wasm submodule (§26.6's law, closed for this mode) — and
the certification column has THREE states where every planning table had two:
`GAME-CERTIFIED` · `MODEL-CERTIFIED` · **`unasked`**, with ⚖ 49's conditions by
name plus `unlatched`, which the four presuppose. ⛓ **The pixel row needs NO
tolerance constant:** the latch carries the args the current `Game` was
CONSTRUCTED with, so the model's side is `levelRun.worldCtor` and never
`state.x/y` — (192,64) against (200,72) on `r8-d2-19`, one `SPAWN_OFFSET` apart;
comparing `end` would have refused every arrival on the roster. `--table` prints
all 25 rows (md + JSON) and the ⛔ **fixture is TWO branches, not one**:
`attempt-3` gives §35's ten (90→78 · 87→84 · 541→410 · 365→229 · 119→97 ·
226→152 · 47→23 · 237→145 · 74→36 · 145→118) and `attempt-4` gives §36.7's three
(864→721 · 781→554 · headline 2186→**1685**), every digit.
⛓⛓ **ITS FIRST RUN IS A CENSUS §33.2 COULD ONLY DESCRIBE: 19 GAME-CERTIFIED · 6
the game had NEVER been asked about · 0 REFUSED** — and the six are structural,
not arbitrary: a latch is driven ONLY to author a SUCCESSOR's boot, so a LAST
SEGMENT, a HEADLINE and a ONE-SEGMENT chain are never asked. One was closed by
driving it (`r8-d2-20`, 33.5 s of game, calm at L13 (96,48)); **five remain,
named** — `r8-d2` headline · `r9-solve-14` (L14's own arrival, the frontier's) ·
`r8-solve-11` · `r8-solve-20` · toy-west-pair's two.
⛔⛔ **AND THE CACHE HAD BEEN DISCARDING THE GPU RUNS IT PAID FOR, ONE FIELD
WIDE.** `r8-d2-19`'s 721-t answer — the row two runs died on — is in
`rerecord-cache/` under §37.4's `558c4596083c`, and `attempt-4`'s committed tape
for that same walk keys `67990818be8a` and cannot reach it:
`md5({...branchTape, tick0: <the block it held at S1>}) === 558c4596083c`, to
the digit. S2 re-derives `tick0` AFTER S1 drives, on the one axis
`GAME_VISIBLE_DROPS` exists to remove. Across the branch that is **five** lost
latches (17 reachable at `attempt-3`, 12 at `attempt-4`). ⇒ the key is now
`gameVisibleTape` minus the fields no consumer READS — exactly `description`,
DERIVED by enumerating `Bot.botLoadTape`'s fourteen named reads (and
`description` spelled 0× in all of `Bot.as`), with an unclassified field
REFUSED BY NAME — so **a prose edit costs no drive**, and a legacy hit RE-KEYS
FORWARD so the migration converges rather than decaying. ⛔ `gameVisibleTape`
itself is UNTOUCHED: the record-set projection stays over-inclusive in the prose
direction (§35's safe sign) and ⚖ 40's roster event is not armed.
Tape-inert: all seven producer `--check` md5s byte-identical to their standing
values, `fixtures/` empty in `git status` at every commit. CI at `d113f9f8c`
**366/11438 + slow 12/217**, +1 file / +31 tests, all mine by name. Mutants (b)
and (h) spent and red; ⛔ **(a) is NOT reproducible from `main`'s tapes and that
is a measurement**: guard removed ⇒ 864, guard removed + flip ⇒ 746, and the
CONTROL (flip alone) ⇒ 746 too, so ⚖ 53's guard is inert on every walk reachable
from `main` — the 708-t freeze walk is a (D′)-BRANCH product. The refusal
witness is a truncated walk instead: `REFUSED: not-calm — v=(1.4500000000000006,
0)`, the game's word. As-built kickoff **§39**, P1b's inputs **§39.12**.
⇒ **NEXT: P1b (⚖ 54 (3) whole — the injection seam is the bulk, not the fixture)
→ the re-record's FOURTH run → the 12c batch closes → P2/P3/P4 → L15 `shove`.**
⚠ TWO RESIDUE LINES: **`nominateOwners` still derives ownership from a tape's
`description`** (trap 576's shape surviving in nomination after `walkReport`
fixed it for reporting) — P3/P4; and **the five never-driven rows** above are
now a standing list rather than a discovery waiting for the next cascade.

⛓⛓⛓ **SLICE P2 SHIPPED 2026-08-26 (`e44a0e39f` … `7a6b3bc11`, PUSHED) — ⚖ 54
(5) DISCHARGED, AND THE ANSWER IS CASE B: THE ECONOMIES WERE NOT NATURALLY
INERT, SO THE GATE IS A MEASUREMENT'S CONSEQUENCE AND ITS DOCBLOCKS NAME THE
MOVERS.** ⚖ 46 (the collect stance) and ⚖ 47 (the kill-lock's fade spent
walking) were cherry-picked from `r9/re-record-attempt-4` and MEASURED un-gated
at `ALLOW_DASH_ROSTER_WIDE === false` first, as the design required: **five
committed artifacts move** — `r8-solve-10` 90→**89** · `r8-solve-18` 541→**437**
· `r8-solve-20` 365→**332** · `r8-d2-19` 864→**807** · `r8-d2-20` 781→**756** ⇒
the `r8-d2` headline 2186→**2000** — and **five of seven producer md5s** with
them. That is §31.6's (E₀) column *"economies, NO flip"* reproduced at today's
head, three model fixes later, and its three `r8-d2` rows agree to the digit.
⚠ **THE BATTERY IS THE ROW TO REMEMBER: its md5 moved while it reported exit 0,
all checks green** (its `r8-solve-10` row is PRINTED, not emitted) — *"did the
producers stay green?"* would have called this economy invisible. The md5 is the
instrument; the exit code is not.
⛓ **GATED, ALL SEVEN ARE BYTE-IDENTICAL AGAIN** and the two-build stream diff
over all 149 tapes is 0 movers with the same dump md5 — reported as
NON-DISCRIMINATING, since `solverBot.js` is not among the 48 modules a reverse
import walk from `tapeRunner.js` reaches. ONE permission, `economies`,
defaulting to the flag (`strikePolicyFor`'s `dashPlan` shape — a second flag
state is the cost ⚖ 41 refused); ⚖ 47 needed THREE things off, not one — the
walk, `remaining` (⇒ `fade`), and the record's `earlyWalk` key **ABSENT rather
than `null`**, because the trace sidecars are `--check`ed byte-for-byte too.
⛓⛓⛓ **AND THE MUTANT IS THE STRONGEST SENTENCE: with the flag flipped, THIS
TREE reproduces BOTH archive branches' thirteen walks to the digit** — campaign
**3326**, `r8-d2` headline **1685**, and `--table`'s MODEL column equals its
`@ref` column 13/13 on `attempt-3`'s ten AND `attempt-4`'s three. ⚖ 49's licence
numbers are now derivable from `main` in ~30 s of CPU with no GPU, and 12e⁗'s
ULP fix moves no row at `true`.
⛔ **⚖ 39's `why` SWEEP IS NOT TAPE-INERT AND STAYS ON THE BRANCH** — a segment's
`why` is interpolated into its tape's `description` and `emit`'s `--check` is a
BYTE compare, so it reds `r9-solve-11`/`-13`/`-14` (tapes only; traces carry no
description). ⛓ But the KEY projection is UNMOVED on all three, so the sweep
costs **zero GPU drives** — ⚖ 54 (4)'s win on the segments that spend it.
⇒ **THE SERIES IS FOUR COMMITS, NOT SEVEN**: the flip · the `why` sweep ·
`299387a63` · `763bf3cb8`, by
`git rebase --onto <head> de7c0da7b r9/re-record-attempt-4` — rehearsed in a
THROWAWAY detached worktree (removed; every `r9/*` branch untouched), **no
conflict**, and `fixtures/tapes|expectations|traces` come out as the SAME TREE
OBJECTS as `-4`'s.
⛓ **§38.8 STEP 2 IS ALREADY VERIFIED: the thirteen are 13/13 EXACT** at the
rebased head and the roster is 145/149 with exactly the four known `r5`
residuals — the 5011-tick drive is not paid again. The third run's directory
survives and was copied out of another session's `/tmp` to
**`~/.cache/seedling-r9-rerecord-run3/`**; `--from=S4` reads S0/S1/S2 from it,
and S4 is a Windows/GPU row twice over.
⚠ THREE RESIDUE LINES OF ITS OWN: **two pre-existing unit rows go red under the
flip and no re-record repairs either** (`solverBot.test.js:520`'s
`['avoid','time']` against `['avoid','time','sword-dash']`, and `:3250`'s
`waits === 0` against **24**) — the fourth run owns them; **a SIXTH producer
moves at the flip and is in no licence table**, `solve-seedling-r9-l3`
`8ac17aca…`→`6cd35fe1…`, green but moved, so the fourth run's `--write`
prediction is six producers BY NAME; and **⚖ 49's extension mis-attributes
`r8-solve-11` 87→84 to ⚖ 46** — at `false` that row does not move at all, 84
needs the flip. Standing values re-measured at `5f5323d9d`: **exactly ONE
`value` mover and it is CI's suite row** 366/11438 → **366/11447**, zero `cheap`
flips, and `gates.sh local` deliberately NOT run because `gates.mjs --list`'s 28
gates ARE the 28 `gate:` rows `--write` had just re-measured. As-built kickoff
**§40**; the fourth run's inputs **§40.9**.
⇒ **NEXT: the re-record's FOURTH run (§40.9's inputs) or P1b — the
orchestrator's sequencing — then the 12c batch closes → P3/P4 → L15 `shove`.**


**⇒ CAMPAIGN ORCHESTRATION SESSION 6 → 7 (2026-08-26, `9cc43071c`).** Session 6
verified 12e⁗ (§38) · P1 (§39) · P2 (§40) against disk and opened two editor
windows; ⚖ 55 and ⚖ 54 (1)(2)(4)(5) discharged; (3) = P1b (brief ready, §41).
Successor prompt `NewDocs/plans/seedling-bot-r9-campaign7-planning-prompt.md`;
sequence SETTLED **P1b → the fourth run (§42, from §38.8 + §40.9) → P3 → P4 →
L15**; the user has said the successor may start on decided work unattended —
only the branch rewrite (`r9/re-record-attempt-4` → four commits) and the L15
design wait for them. Session 6's own misreads are in kickoff §1's session-6
block.


⛓⛓⛓ **SLICE P1b SHIPPED 2026-08-26 (`679861c88` … `6abc40463`, PUSHED) — ⚖ 54
(3) DISCHARGED, AND WITH IT THE WHOLE OF (1)–(5). THE RE-RECORD PIPELINE IS
REHEARSED BEFORE IT SPENDS A GPU.** Three re-record attempts stopped partway
through a run, each *after* the browser had been driven for the boundaries
before it, and every defect that stopped them was bookkeeping rather than
physics. `rerecord-seedling-campaign.mjs` could not be exercised any other way,
because it resolved its whole subject — the roster, the chains, the producers it
shells, the Windows driver — from its own file location.

It now builds ONE `context` at the top from argv and hands it to every stage,
with today's values as the defaults. That change is **byte-inert**: the seven
producer `--check` md5s all at their standing values BY NAME, and `--dry-run` /
`--to=S0` / `--table` stdout with ZERO differing lines. ⚠ Under one mask that
had to be measured rather than assumed — that stdout prints each producer's wall
clock, so two runs at the SAME head before any edit differ on exactly four lines
and nothing else; and the mask then had to be shown discriminating (a fake
context on the real `--dry-run` moves 22 masked lines).

`--rehearse` GENERATES a fake tree from the committed roster and runs **S0→S5
over it in about ten seconds** — no browser, no Windows, no `:8000`, no read of
the machine-global latch cache — over seven scenarios. The fake latches are
derived by running `segmentBootFromLatch` BACKWARDS (its inverse,
`seamBootFields`, was already exported beside it), and the generator PROVES each
one before writing it: 38 fields compared, 0 moved at every boundary, with a
mover nobody asked for a refusal. `check-seedling-rerecord-rehearsal.mjs` is the
standing gate — **18/0, `cheap`** — and it claims each of the historical defects
by a stable marker, so a scenario that stops being run reds by name instead of
becoming a smaller green. It also fingerprints the machine-global latch cache
around the run and requires it unchanged.

⛔ **AND THE SLICE'S BEST FINDING ARRIVED BEFORE THE GATE DID.** Writing the
scenarios surfaced a FOURTH wrong-subject guard, in S3's own stop condition:
`if (failures)` over the GLOBAL counter, so any earlier red threw *"the
projection diff names a tape this run was not licensed to move"* one line below
its own licence check, which may have printed PASS. An earlier slice had swept
the file and concluded the last such guard was fixed — true of the file it read,
and this one was written in the same slice that added the stage. Fixed before
its mutant.

Standing values: **+1 row and nothing else** — rows 60 → 61, all 60 existing
rows byte-identical including their own `measuredAt`. Five mutants owed, EIGHT
spent, all red by name; the one worth keeping is the pair that separates the
straight-through order row from the resume one, which is the historical defect
of *a fix that only ever worked on the resume path*. No tape licence spent;
`fixtures/` byte-identical at close. As-built kickoff **§41**.
⇒ **NEXT: the re-record's FOURTH run (§40.9 / §42) — and run `--rehearse` at the
rebased head BEFORE any browser stage; it costs ten seconds and it is the only
thing that can say a bookkeeping defect is live before the GPU is spent. Then
the 12c batch closes → P3 → P4 → L15 `shove`.**

⛔⛔⛔ **R9 SLICE 12e′ — THE FOURTH RUN IS A FOURTH STOP, 2026-08-26. `main` IS
UNCHANGED AT `4ec64471f` AND THE 12c BATCH DOES NOT CLOSE.** As-built kickoff
**§42**. Everything §38.8 predicted held: the rebase is clean and four commits,
the three `fixtures/` tree objects are byte-identical to `-4`'s, the thirteen are
**13/13 EXACT** offline, the roster is **145/149** with only the four known `r5`
residuals, `--rehearse` is **18/0**, and the GAME matched the committed oracle
stream on **all 26 tapes** of S4's roster with **sixteen of seventeen seams green
over 46 signature rows each**. ⛔ **ONE ROW STOPS IT:**
`r9-solve-0 -> r9-solve-13: rng.gameplay [exit 1029458650 vs boot 1196888758]`,
and the wasm ship gate refuses boundary 14/16 on the same integer — **234/19**
against `254/0` before.

⛓⛓⛓ **AND THE CHASE FOUND SOMETHING LARGER THAN THE SEAM.**
`solve-seedling-r9-campaign --check` reads each successor's boot **out of its own
committed tape**, so it compares the tape against a derivation seeded from the
tape — **a FIXED POINT** — and it is GREEN at a head where its own emit rewrites
two committed artifacts. The file's own comment claims the opposite in so many
words. The blindness is **LATENT on `main`** (there the emit changes nothing, so
self-consistency and correctness coincide); the series is simply the first tree in
which S2 has ever overridden a producer-derived boot. ⇒ the committed tape is a
**splice of two coherent chains** — the producer's (1029458650 → 1785346831) and
S1's (1196888758 → 1906746288) — which is exactly why only one seam is red.

⛔ **A MECHANISM PUBLISHED AND WITHDRAWN, kept because the withdrawal is the
lesson:** this is NOT ⚖ 23's fresh-page-versus-continuation class. The `--win`
differential drives a fresh page per tape, exactly as S1 does, and agrees with the
continuous ship gate, with the model and with the producer. **S1's drive is the
sole outlier, and it gave the same answer in two independent runs.** The root
question — why S1's fresh-page drive of `r9-solve-0` latches a different exit than
the differential's replay of the same tape — is **OPEN**, and §42.5c measured the
obvious lead to a residue: the two boots agree on **all 38 compared fields**, so
any difference lives OUTSIDE `BOOT_BLOCKS`, with `tick0` the named suspect and
`r9-solve-2`'s green seam its named exception.

PARKED on **`r9/re-record-attempt-5` @`73bf6d724`**, six commits, never pushed:
the flip · ⚖ 39's `why` sweep · **the thirteen** (`299387a63` + `763bf3cb8`
SQUASHED, resulting tree byte-identical to the four-commit rebase's) · **seven
build-named test repairs** (§40.6 named two; there were six, in six files, plus a
seventh file only a DATA reach finds) · **four trace sidecars re-emitted** (five
last-bit ULP digits; two producers exit 1 → exit 0) · CLAIM 8's count derived from
its tape. The five pre-existing `r9/*` branches are byte-identical before and
after. **No `standing-values --write`** — nothing reached a pushable head. Traps
**769–773**. ⚖ 49 + its extension stay SPENT-BUT-UNLANDED and ⚖ 51 (a) is
unchanged.

⇒ **NEXT: the boundary-14 slice. §42.10 states the design question as THREE
candidate ⚖ answers plus one repair, and it is THE USER'S: (α) the record carries
the producer's derived chain (inverts "every boot field comes from the
measurement"); (β) S1's envelope-boot is itself the defect (the only one that
explains rather than chooses); (γ) the record keeps S1's measurement and both game
instruments are wrong (weakest). The REPAIR is independent of all three — make
`--check` derive the successor's boot from the PREDECESSOR's committed exit, so an
override shows as the byte diff its comment already claims. Then P3 (which
inherits the fixed point AND the latch-key projection as ONE item) → P4 → L15
`shove`.**


**⇒ CAMPAIGN ORCHESTRATION SESSION 7 → 8 (2026-08-26, `0f22b9e44`).** Session 7
verified P1b (§41) and the fourth run's STOP (§42) against disk and opened
three editor windows (E2c · Q6 + E3a · E3b); ⚖ 54 (1)–(5) are ALL discharged;
the 12c batch does NOT close. **⚖ FOR THE USER, BLOCKING the fifth run
(§42.10):** which boot is the record at a chain boundary — the producer-derived
one (S2 must not override it with a fresh-page latch) or the measured one (then
S1's envelope-boot is the defect); plus the independent gate repair (a producer
`--check` that reads the successor's OWN boot is a FIXED POINT, trap 769) and
one licensed 118-tick drive (`r9-solve-14` @1785346831). The game confirmed all
thirteen walks; what is parked on `r9/re-record-attempt-5` is ONE boot field
carrying the wrong chain's value. Session 7's brief errors (nine pairs, S4 once,
a cache miss read as a certification) are in `feedback_oep_premises_overturned`.
Successor prompt `NewDocs/plans/seedling-bot-r9-campaign8-planning-prompt.md`;
sequence: **the user's ruling → P3 (its brief written meanwhile; may launch
unattended — and it now owns the fixed-point `--check`, the latch key over
rewritten fields, ⚖ 40's 25 ⊄ S4's 26, the replay teardown throw) → the FIFTH
run → P4 → L15.** Six local `r9/*` branches now; none pushed, none rewritten.

**⚖ RULING 56 (the user, 2026-08-26, on §42.10): the boundary-14 disagreement is
INVESTIGATED, not adjudicated** — *"I don't want to just label one of the
measurements as right and the other wrong without further investigation. If
necessary, we can update the testing tools to provide more information about the
game's internal state."* ⇒ the next R9 slice is a DIAGNOSIS (as-built §43): the
offline diff of the two boot dictionaries for `r9-solve-0`, then — instrument
changes LICENSED — a per-tick rng/seam dump on both drive paths to the first
divergent tick, a mutant that names the mechanism, and only then a ⚖ on which
value the record carries. The series stays on `r9/re-record-attempt-5`; the
`--check` fixed-point repair (trap 769) is independent and may land first.

**⇒ CAMPAIGN ORCHESTRATION SESSION 8 OPENED (2026-08-26, `41d4fbc8f`).** Two
slices launched: **12f** — the ⚖ 56 DIAGNOSIS (as-built §43; brief
`seedling-bot-r9-slice12f-prompt.md`) — and **P3** (as-built §44; brief
`seedling-bot-r9-sliceP3-prompt.md`; in its own worktree; ⚖ 54 (6)+(7) proper —
CI-quoted rows, the BOX LOCK, `cheap` hysteresis — deferred to **P3b**; P3 now
carries the trap-769 boundary gate, the §42.5b latch-key measurement, the
derived roster/owners (trap 773, `nominateOwners` off prose), the reach's data
population (trap 770) and the one-spelling FILE gate (trap 729)).
⛓⛓⛓ **MEASURED BEFORE BRIEFING, and it supersedes §42.5c's `tick0` lead for the
S1-vs-differential pair:** the two paths shipped BYTE-EQUAL bytes for
`r9-solve-0` (`tape-`/`rr-tape-r9-solve-0.json`, md5 `ac86d87c72c7…`, 3958 B;
both are `gameVisibleTape`, `tick0` dropped on both), through the same driver
with the same argv, to the same served build; their 146 tick objects are
IDENTICAL and only `Rng.state` differs (`beginEntry.rng.gameplay` 1029458650 vs
1196888758, terminal 1953898394 vs 1427998694) plus a post-latch `game_time`
8758 vs 8761 (⚖ 47b (2)'s poller window). It is per-PATH, not per-time: five
real drives, no crossover (producer 08-25 08:34 + ship gate + differential vs
S1 twice). ⇒ a draw-count/seeding difference invisible to the position stream;
12f's shape is reproduce-alternating → bisect the path → per-tick `Rng.state`
trace (`botStatus`, `botRngProbe` as a draw-distance meter; a NEW build name
`seedling_bot_ap_p4c` only if the poll cannot resolve a tick) → a mutant that
flips it both ways → the ⚖ written for the user. Sequence after both: the
FIFTH run's brief → P3b → P4 → L15.

⛓⛓⛓ **SLICE 12f CLOSED 2026-08-26 @ `2fa6bda1e` (as-built §43) — AND IT
OVERTURNS THE PARAGRAPH ABOVE.** "It is per-PATH, not per-time" was the
orchestrator's premise from five samples, and the orchestrator has withdrawn it:
a **byte-identical re-run of the producer's own invocation** returned a THIRD
value. `Rng.state` is the raw 31-bit LFSR register (`avm2_number.c:574`,
stepped at :509), so a recorded state IS a draw index — landed as
`scripts/procgen/rngRuler.js` + its test — and in draws the stop reads *"S1's
page drew exactly TWO MORE, all of it before tick 145 and none after"* (3297 vs
3299; both spent 270 from `beginEntry` to the terminal latch). ⛓ **THE
MECHANISM, NAMED BY A KNOB THAT TURNS BOTH WAYS:** the page's own boot builds
`new Game(0, 80, 128)` (`Main.as:51`) and that world runs on the WALL CLOCK
until `botStart`, which resets the RNG, the tick and the save arrays but NOT the
real `Sfx` mixer's open channels. The new `--preboot-delay-sec` flag makes that
idle an argument: **0.05 s → 3296 · 0.10–0.40 s → 3297 (the producer's number) ·
0.45 s → 3298 and 3299 (S1's number)**, with the 146 observation ticks **0/146
differing** in every drive. `Rng.split` is false so cosmetic draws advance the
gameplay stream, and `Music.playSound(set,-1)`'s redraw loop (`Music.as:726-732`)
costs a different number of draws depending on what played last — which the
UNPINNED mixer answers from the clock (`Music.as:823/832`). Declaring the R5
`sound` pin kills the knob: **17 drives, 17 × 3298, zero deviation.** ⇒ **§42.10's
(α)/(β)/(γ) are moot — there was no per-path truth to choose between**, and the
fix belongs in the tape/driver, never in a number. ⚠ Two riders: the
`--rng-curve` instrument SUPPRESSES the effect (unpinned + instrument is 3297 in
8/8), so the pin's divergence tick (t=40) is measured and the natural one is
NOT; and a **second, separate defect** was found on the way past — a pre-boot
idle ≥ 0.5 s flips `botStart`'s world-swap race, shifting the whole stream by
one tick (≤ 0.45 s never does), which every committed fixture silently depends
on winning. **⚖ FOR THE USER (§43.8):** four remedies costed — the `sound` pin
on the exposed tapes only (a ⚖ 49 re-record; the exposed set is unmeasured, 2
drives per tape), the pin roster-wide, a driver-side bound on the idle (cheap,
narrows but does not remove), or stop asserting cross-path equality on
`rng.gameplay` at all. P3's `check-seedling-producer-boundaries.mjs` cannot
decide it: there is no wrong number to catch, only two correct readings.
⛔ Untouched by 12f: every file under `fixtures/`, the parked series, the
standing values (NONE moved), p4b (no `p4c` was built).

**⛓⛓⛓ R9 SLICE P3 — CLOSED 2026-08-26 @`b060f5b31`** (kickoff §44; ⚖ 54 (6)+(7)
as GROWN by §42.10's inherited work orders, which the user ruled decided work).
Five items, all landed on `main` in three commits:
**(A)** `check-seedling-producer-boundaries.mjs` — a boundary check SEEDED FROM
THE PREDECESSOR, retiring trap 769's fixed point. **18 VERIFIED / 0 / 0** at
`main`, **17 / 1 / 0** at the parked series, red by name on `r9-solve-0 →
r9-solve-13` (`rng.seed 1029458650 != 1196888758`). It finds ONE seam where the
producer's emit rewrites TWO tapes, which is §42.5's chain step (4) reproduced.
Three states — VERIFIED / DISAGREES / **REFUSED-UNVERIFIED** — and it exits
non-zero only on a real disagreement, because the latch cache is machine-global
and a gate red on its absence would gate nothing anywhere. The false sentence in
BOTH producers' `--check` comments is repaired. **⚖ 8: zero md5 movers**, which
is the whole reason the third verdict is a gate.
**(B)** §42.5b's diagnosis **OVERTURNED**: over all 21 tapes of run 3's `S1.json`
**not one `KEY_KEEPS` field differs** — the key projection was never the defect.
The cause is the **LEGACY arm**, keyed on the COMPLETE bytes which carry `tick0`;
the migration is real, converges, and is **LAZY**, so a lookup from the COMMITTED
side misses until the DRIVEN side has re-keyed forward. That has since happened:
`--table --branch=…` reads **18 GAME-CERTIFIED · 7 unasked** where §42.5b read 2
and 11 — **six of the eleven certified with no GPU**. The five still unasked are
two chain TAILS, a HEADLINE and two ONE-SEGMENT chains: the tapes no boundary
consumes. (`--table` is read-only, proved by the cache listing md5;
`--latch-provisional` WRITES and was not run.)
**(C)** `nominateOwners` and `solverRoster` are DERIVED from six producers' own
`--segments` mode (which exits above every solve, trap 584) — the same **22**
tapes the deleted regexes selected, element for element. ⚖ 40's coverage gap
(§42.7 ii) closed with a `prove()` row for the three `plan-seedling-*` dash
witnesses: **25 of 25**. The prose survives only as a LINT that it agrees with
the data, and its three findings — `r7-act2-5/-6/-full` naming the retired
`plan-seedling-r7-act2.mjs` — are **PINNED BY NAME** because repairing a
`description` is a tape move: **three `description` repairs owed to the fifth
run's licence.**
**(D)** the reach emits its DATA population — **29** tests that NAME a changed
fixture and **14** `check-*.mjs` gates, union **71**, with **10 the import graph
cannot see** (§42.2's five all reappear), and it prints what the union still
misses.
**(E)** the one-spelling law is a FILE GATE (a vitest row, so it runs in CI)
with an **EMPTY** allow-list over a subject derived from IMPORTS. Two real
findings fixed: a second definition of `pointLength` in `finalBossFight.js`, and
a live `Math.hypot` forty lines under the docblock forbidding it.
⛔ **Untouched by P3: every file under `fixtures/`, the parked series, the AS3,
the wasm submodule, the driver.** Standing values re-measured at `b060f5b31`
(63 rows; the quoted `roster: --win --tier=full` @`3ca80b3c1` preserved):
**+1 row `gate: seedling-producer-boundaries` = `18/0`**, suite row quoted from
CI at that head = **`375/11631`**, all seven producer md5s UNMOVED, and two REAL
`cheap` crossings banked with their numbers after a quiet-box re-measure
(`gate: seedling-editor-arm` 57.6 s → 61.5 s, `identity: generated set` 58.3 s →
62.3 s, both values unchanged) — the arm gate at 2.5 % over the band is the live
case for P3b's `cheap` HYSTERESIS.
⇒ **NEXT: P3b** = ⚖ 54 (6)+(7) proper — every headless gate CI-quoted by SHA,
the **BOX LOCK**, `cheap` **HYSTERESIS** — with §44.9's four inputs, of which the
sharpest is that this new gate is ALL-REFUSED in CI (the latch cache exists on
one machine), so (F) must decide whether it is a CI row at all. Then **P4** =
⚖ 54 (8) + 47b's (1)(4)(6), then **L15**. ⚠ Ahead of both, §43.8's ⚖ for the
user and the fifth run's `sound`-pin re-record: **18 of 18 chain boundaries have
an UNPINNED predecessor**, so every `rng.seed` row in the new gate is a
sample-vs-sample comparison until that lands.

**⛓⛓⛓⛓ R9 SLICE 12h — THE FIFTH RUN LANDED, 2026-08-27. `main` @`fed091aa2`**
(the whole series in ONE fast-forward `a05dbaf74..95c7500ad`, then the standing
values, the two gate repairs and the docs; kickoff §47; ⚖ 57 + 49 + 51 (a) all
SPENT AND DISCHARGED; ⚖ 40's checkpoint RE-BANKED).
**THE `sound` PIN IS ROSTER-WIDE AND THE ARC'S OPEN QUESTION IS ANSWERED.**
Census **76/32/4/37 → 76/69/4/0** — zero unpinned ladder tapes; the moved set is
the sealed 37 element for element, and the whole `fixtures/` diff is 37 ×
`+"sound",` plus four descriptions plus TWO other lines.
⛓⛓⛓ **§42.5's "SPLICE OF TWO COHERENT CHAINS" IS SUPERSEDED, AND THE PROOF COST
NO GPU:** the latch cache holds **two records under ONE key** — one
byte-identical tape — carrying `1029458650` and `1196888758`, which are exactly
§42.4's two numbers. The same key PINNED holds `514729325` twice. So it was one
tape drawn twice, not two instruments disagreeing; the pinned count is **3298
draws** on 12f's ruler, where the old committed value was 3299 and the
producer's chain 3297.
⛓ **THE PIN MOVED ZERO GAME STREAMS** — the ⚖ 40 full tier drove all 149 tapes
and 149/149 report *"live game matches the committed oracle stream"* against
expectations recorded on PRE-pin bytes — **and exactly TWO latches**
(`r9-solve-0`'s and `r9-solve-13`'s exits), through them two boot `rng.seed` and
two `tick0.rng.seed`. That is the exposure census ⚖ 57 asked for, measured by
REFUSAL rather than by overwrite.
⛔ **THE BRIEF'S ROOT PREMISE WAS FALSE FOR 25 OF THE 37.** `solve-seedling-r8-battery`
reads its pin list out of its OWN committed output — a FIXED POINT one field
over from trap 769 — so "edit the root literal" reached 12 tapes; ONE declared
`[...PIN_NAMES]` at the battery moves 22 by inheritance; three `r7-act2-*` have
no producer at all and are the roster's only hand-written pin literals.
⛔ **AND THE FULL TIER — the first since p4c became the default — FOUND SIX
PRE-EXISTING REDS ON `main`**: `r5Acceptance.js` asserts dead-frame totals that
bake in the pre-swap frame p4c no longer spends. Repaired build-aware, verified
p4c 162/0 AND p4b 162/0. ⇒ **p4b's scheduled retirement is CANCELLED** — it is
the only tracked build WITHOUT the `arm` capability, and a capability-keyed
correction is proved only by the arm that lacks it.
⇒ NEXT: **P3b** with §47.11's four inputs (the S0 snapshot baseline · the
`roster ∖ prove()` complement · a full tier owed at every game-facing change ·
the tick-based tier estimator), and the R9 ladder's own next rung.

**⛓⛓⛓ R9 SLICE 12g′ — CLOSED 2026-08-26 @`a3811e5ea`** (four outer commits: `e7858a880` the arm bound · `00f83c989` its own measurement refuting it · `a0b8f10c3` the default flip + gitlink · `a3811e5ea` the tracked doc; fork `~/CC/seedling` `bot @ d4f1f37`; submodule `7aaaa0a`; kickoff §46; ⚖ 58's (F)).
**THE RACE IS REMOVED, NOT NARROWED, AND THE NUMBER IS 1.** `botStart` holds the
constructed `Game` and `Bot.update` arms on the first frame where `FP.world`
IS that instance — **one pending frame, always**, by the frame loop's own
structure (`FP.as:87-90` · `Engine.as:77`, `:242-252` · `Main.as:61-66`;
`BOOT_PRESWAP_FRAMES = 1` was already measured at R7 with a control). Built as
**`seedling_bot_ap_p4c`**, FRESH, 21m47s under load.

**MEASURED, 18 DRIVES:** p4c **PASSES 7/7** at 0.0/1.0/2.0 s of pre-boot idle,
arm frames **28–64**, every one inside the region where p4b loses; p4b
**REFUSES** at 1.0 s with `--out` absent. ⛓ **The discrimination is one frame
wide and the build is the only variable: p4b refused at arm frame 31, p4c
passed at arm frame 31.** Streams **0/146 differing on every passing drive,
including against p4b's OWN winning idle-0 drive** — same `rng.state`, same
final `game_time`. The ONLY observable that moves is `dead_frames` **41 → 40**,
the pending frame the fix stops counting, and that pair is **12h's inertness
proof**. Skip path 0/46 on both builds.

⛔⛔ **§45.5's SPECIFIED CONDITION WOULD HAVE BUILT A NO-OP — CAUGHT AT W0.**
`Main.level` **and** `Main.playerPositionX/Y` are both written synchronously
inside `new Game(...)` (`Game.as:630-631` → `:526-528`, `:555-561`), so
`Main.level == bootLevel && atBootPosition()` is already true while the swap is
still only `FP._goto`. Trap 806 one field over — and `atBootPosition()`'s own
docblock praises the early write, because for its OTHER caller (the skip test,
which runs before any construction) it is correct. ⇒ **a field's eagerness is a
property of WHERE it is read.** The gate became object identity on `FP.world`,
which is not a proxy for the observation's source but IS it.

⛔ **(E) REFUTED ITS OWN DOCBLOCK.** `--arm-bound` (⚖ 58's third option, landed
OFF) claimed "on p4c this cannot fire" — a true sentence about the BUILD
attached to code that could not tell which build it was driving. It refused p4c
**4/4** while the flagless build passed 3/3 at the same arm frames. Fixed: the
build ANNOUNCES its capability (`arm` in `botStatus`) and the bound skips
itself by name. Both arms re-driven; **perturbation measured at exactly ONE
frame, 4/4**, without self-reference (both pre-`botStart` reads back to back).
§45.9 residues **2 and 3 DISCHARGED**.

⚠ **THE ARM-FRAME READOUT'S ZERO IS MOVED BY THE CALL BEING MEASURED.**
`armed_at` read **8568 on all seven** p4c drives regardless of idle, because
`r9-solve-0` declares `seam.time = 8567` and `botStart` writes `Main.time =
seamTime` above the `new Game` line. The law is **`armed_at − seam.time = 1`,
7/7, idle-invariant**; the sealed `armed_at − ARM_STATE.game_time` form holds on
the SKIP path, which declares no `seam.time`, and also reads 1.

**(D) DERIVED:** 53 files / 69 lines flipped, `*.md` excluded as history;
`check-seedling-wasm-pins` **ALL PASS — 2 pinned builds**, (m5) reds 3 ways by
name; `check-seedling-wasm-bridge` ALL PASS on p4c; `-pages` **20/0**. (D) and
the gitlink are ONE commit, verified in both directions (7 failures unnamed, 3
unlisted). ⛔ **p4b's pin is NOT free: the gate cannot see prose**, so it is
held by ONE deliberate `wasm/seedling_bot_ap_p4b/game.html` in
`flashPanel/README.md`, labelled there as the repository's only manufactured
reference, cost named, retirement scheduled at 12h's close.

⛓ **PUSHED (⚖ user: "Push.")** — submodule `1bc0003 → 7aaaa0a`, verified AT THE
FAR END (the four blobs read back out of `origin/main`, both whitelist lines,
both manifest entries); outer `d0a2a188f..1eed5988a` then `12934b870`. CI at the
pushed head: **`Seedling wasm submodule` STEP 1 (gating) `success` — "ALL PASS —
2 pinned builds, four views in agreement", on a FRESH RUNNER that fetched the
submodule from the remote**, which is the real far-end proof of the pin (read by
STEP OUTCOME, not job conclusion — `continue-on-error` rewrites the latter);
STEP 3's `failure` is the pre-existing, self-documented `py.exe` refusal.
`JavaScript Unit Tests` **376/11638, 0 failed**, unmoved from 12g.

⛔⛔ **THE `--write` FOUND ONE RED, IT WAS MINE, AND THE GATE WAS RIGHT:
`gate: seedling-wasm-ship` 254/0 → 253/1.** CLAIM 6 asserts a DECLARED boot pays
`SHARES[0] + BOOT_PRESWAP_FRAMES`; p4c no longer spends that frame, so the row
read `game 40 vs model 40`. **W0 had cleared this as safe on "nothing asserts
`dead_frames`" — measured over the expectation FILES (§45.6 (m4)) and TRUE of
them, and the wrong population: a GATE asserts it in CODE.** The known family is
"a code sweep misses the data"; this is that error run backwards. Fixed
`12934b870` by asking the BUILD: `watchWasm.js` surfaces `rec.arm = st.arm ??
null` from the status block it already reads, and CLAIM 6 keys on the
capability's PRESENCE, never a build name — the same lesson `--arm-bound` taught
one file over the same day. ⛓ The control was free and already in the failing
run: the CAMPAIGN arm (a TRUE START, which takes `botStart`'s skip path and
never had the frame) **PASSED at `40 − 1` while the CHAIN arm failed at
`40 + 1`** — opposite directions, only the touched arm moved. Re-run **ALL PASS
254/0**.

**STANDING VALUES: exactly the two predicted movers.** `suite:` `375/11631` →
**376/11638** (CI-quoted at `1eed5988a`); `gate: seedling-wasm-pins`'s **`total`
string only** ("1 pinned build" → "2 pinned builds"), `value` `0/0` held.
UNMOVED: `-pages` 20/0 · `-element` 11/0 · `-ship` 254/0 · `-generated-set` 32/0
· `-save-stamp` 21/0 · `-vanilla-manifest` 24/0 — the last three Windows rows
now driving p4c. Two `cheap` flips named, both timing-boundary crossings.

⛔ **A HAZARD FOR 12h's INPUTS:** `/mnt/c/playwright/tape-r9-solve-0.json`
(`ac86d87c…`, the evidence bytes) is **145 ticks / 57 spans**; the committed
`fixtures/tapes/r9-solve-0.json` is **237 / 22**. Same name, same boot,
different walk. A scratch file named after a fixture is not that fixture.

**⛓⛓⛓ R9 SLICE 12g — CLOSED 2026-08-26 @`2018e463c`** (three commits: `05c6f7e1c` the gate · `2b0ef4a98` docs+queue · `2018e463c` the vacuous-`level` finding; kickoff §45; ⚖ 58).
**(G) THE GATE LANDED AND IT IS ALREADY RED ON A REAL DRIVE.** After the drain
and before a window is kept, the driver refuses `WORLD_SWAP_RACE_LOST` when the
first drained tick is not the tape's declared boot plus the constructor
half-tile (`Player.as:375`; **149/149** committed fixtures agree), with a second
signal `len(ticks) == tick_count + 1` (`Bot.as:2963`, structural; **149/149**).
The refusal is a RAISE — `--out` is never written, no sidecar — and all five
consumer shell-out sites already re-raise with the driver's stdout attached, so
it arrives NAMED. ⛔ It lives IN the driver file because **seventeen consumers
COPY that one file** into the Windows scratch; a sibling module would have been
an ImportError waiting for the first one that forgot. The `playwright` import
moved inside `main()` so a JS row can reach the predicate at all.
**(M) §43.7's PREMISE REFRAMED — THE SECONDS KNOB WAS A PROXY.**
`--preboot-delay-sec 0.48` produced BOTH outcomes. Reading `botStatus.game_time`
at the arm (minus `dayLength/2` = 4800) gives the frames the page's own boot
world has run, and over **27 drives**: **19 wins at frame ≤ 18, 8 losses at
frame ≥ 19, no overlap**, `dead_frames` 41/40 as a perfect co-signal. The cut is
the fade's own constant — `blackCover` 1 → 0 at −0.05 = **20 frames**
(`Game.as:518-519`), the pre-swap `Bot.update` counted dead at `Bot.as:2877`.
⇒ the margin is a FRAME COUNT; the seconds boundary is that fade minus the
driver's setup, which is why it read as "a property of THIS box".
**⛓ THE NUMBER THE FIFTH RUN NEEDS: the historical path arms at frame 2–4**
(~15 frames ≈ 0.6 s of headroom, against ±6 frames of run-to-run jitter). The
race has always been won, and won comfortably — but nothing was watching.
**(F) PHASE ALIGNMENT REFUTED, BETTER THAN 0/6.** A `requestAnimationFrame`
-aligned `botStart` went **1 win / 5 losses — the win at frame 16, every loss at
19+**: the same law, boundary unmoved. ⇒ the fix is AS3 (`armed` deferred to the
first `Bot.update` whose world is the booted one) and is WRITTEN UP as the fifth
run's input, not built — it moves tick 0 on every swapping tape, so it must land
WITH ⚖ 57's `sound` pin or the roster is re-recorded twice. The aligned driver
was a scratch copy and is NOT committed. ⚖ A third option for the fifth run's
driver: refuse to ARM when the fade has already ended (frame > 18) — a bound,
not a fix, and its cost (a `botStatus` read on the default path, §43.5's
perturbation lesson) must be measured there.
**(R) 19 PASS at idle 0 / 3 REFUSE at idle 1.0 s** over 19 boot blocks (the 16
`r9-campaign` segments derived from `PLAYTHROUGH_CHAINS` + the 3 dash witnesses,
3702 ticks) — and **all 22 drains were exactly `tick_count + 1`**.
⛔⛔ **AND (R) FOUND SOMETHING: `level` CANNOT DISCRIMINATE A LOST RACE** (trap
806). All 8 refusals read the tape's boot LEVEL beside the page's boot POSITION,
because `Game`'s ctor runs `level = _level` (`Game.as:632`) to the STATIC
`Main.level` (`:526-528`) SYNCHRONOUSLY inside `botStart` while the swap is still
`FP._goto`, and `Bot.update` takes the position off the OUTGOING world: the two
halves of one observation come from different worlds. The cheap level-only gate —
the one a reader of §43.7 reaches for, since the losing runs never leave level 0
— is **VACUOUS**, and it is now named in the driver AND the tracked doc.
⚠ SCOPE ON THE 41/40 CO-SIGNAL: exact for one tape at neighbouring idles only —
across the roster `dead_frames` runs 21…372 by ceremony, and one tape reads 41 at
idle 0 vs 20 at idle 1.0 s. That is why signal 2 is the LENGTH, not the dead count.
**(m4)** the SKIP-PATH tape at idle 1.0 s PASSES and reproduces its committed
stream 0/46 — immune, not unchecked; its `dead_frames` is idle-dependent and
nothing asserts it (named non-defect).
⛔ Untouched: every file under `fixtures/`, the parked series, the AS3, the wasm
submodule, the tapes. Standing movers: the **suite row ONLY** — `375/11631` →
**`376/11638`** at `05c6f7e1c` (CI success), +1 file / +7 rows, no `--write` run. Traps **802–806**.
⛓ `scripts/**/*.py` added to the JS-unit-test trigger — **⚖ 34's FOURTH
instance**, by its own criterion (what the suite READS).
⇒ NEXT unchanged: the FIFTH run (⚖ 57 + this slice's (F) together) → P3b → P4 →
L15.

**⚖ RULINGS 57–59 (the user, 2026-08-26, after §43/§44 — session 8):** **57 PIN
ROSTER-WIDE** (§43.8 option 2 ⇒ the FIFTH run is a full-roster re-record under
⚖ 40; the pin moves the count, so no committed expectation survives unmeasured).
**58 THE WORLD-SWAP GATE** — a gate detects a lost race, it does not remove it;
slice **12g** (§45) lands the byte-inert driver gate unconditionally and measures
whether the fix is a phase-aligned `botStart` call (driver) or arming after the
swap (`Bot.as`, a `p4c` build riding the fifth run's re-record); lands BEFORE the
fifth run. **59 BRANCHES** — `r9/economies`, `r9/re-record-attempt`, `-2` deleted
(patches on main); `-3`/`-4`/`-5` kept. Session 8 so far: 12f ✓ (`c2e076196`) ·
P3 ✓ (`2feb53acc`; 63 standing rows, suite 375/11631 @b060f5b31) · **12g ✓ (`05c6f7e1c`; suite 376/11638)**.
Sequence: 12g → the FIFTH run (⚖ 57 + the series + the bank retirement + the
three `r7-act2-*` description repairs) → P3b → P4 → L15.

## 5h. The Seedling EDITOR v3 arc — CLOSED 2026-08-26 (arc opened 2026-08-24, post-dates this doc)

**Status: ⛓ CLOSED 2026-08-26 (⚖ user: "let's close arc E"). Editor's last
commit on main `41d4fbc8f` (trap 721: `docs/**` in both `paths:` blocks of
`unittests_frontend.yml`; CI 372/11587). Slices A1 … E5, Q6, E6a, E6b.** Plan
doc *(NewDocs)*: `seedling-editor-v3.md` — §7 the SHARED editor core (Seedling
first of three substrates), §22 arc E design (E1 real data → E2 the maze on the
toolkit → E3 the adapter's vocabulary; **E4 the platformer, NAMED not sliced,
§22.7**), §22.8 ⚖ rooms are JSON RECORDS, OEL only at ship time; as-builts
§9–§38; ledger §36.5. Memory: `project_seedling_editor_v3`.

**What shipped**: `procgenCore/editCore.js` + `editorView.js` (the OP log, the
fold, undo/group, "a no-op is not an edit"), the Seedling adapter
(`seedlingDemo/watchEdit.js`), the SET editor (`setEditorCore`, `AtlasSession`
/ `atlasOps`, `compileRegionAtlas`, the REPORT, the three-document download),
the maze on the same toolkit, ▶ LOAD IN WASM for edited sets. Standing rows at
close: `check-seedling-editor-arm` **226/0** · `check-maze-lab` **194/0** ·
`-edit` **71/0** · `generate` 224/230 · `preset-bundle-load` 10.

**Residue, by name — reopen only with a need**: the `set-overlay-field`
manifest-form UI seam (§37.10); refusal paths never notify the page readout
(`__mazeLab.set.note` lags `#editSetNote`, §38.7); `attrs` cannot name a
not-last body (deliberate); the vanilla world's **370 free edges** are CONTENT
authoring with the editor, not editor work; DROPPED with reasons (§22.4):
memoised derivation, drag-to-reorder, submodule follow-on. **E4 = the platformer
substrate's editor — it belongs to the platformer arc (§1), because no substrate
exists for it to edit.**

**Successor planning (⚖ user 2026-08-26)**: (1) the platformer substrate is the
NEXT MAJOR ARC — draft plan *(NewDocs)* `procedural-platformer/
platformer-substrate-v2-draft.md`; (2) BEFORE it, a planning session on the
Seedling + Maze editors supporting **different rooms on different substrates**
and on integrating ALL procgen editors (the pipeline panel's modes, the
intermediate-results editor). Memory: `project_platformer_substrate_arc`,
`project_editor_integration_planning`.

**⇒ SESSION 8 (cont., 2026-08-26): 12g ✓ (§45, `1f592d41a`) — the world-swap race
is a FRAME COUNT (cut at outgoing frame 18 of the 20-frame `blackCover` fade;
idle-0 arms at frame 2–4, ~0.6 s headroom), the gate is landed, phase alignment
refuted ⇒ (F) is an AS3 change. Slice **12g′** (§46) LAUNCHED: `Bot.as` arms
after the swap, built as **`seedling_bot_ap_p4c`** (p4b untouched), proved at the
losing idles, defaults flipped. Then **12h** (§47) = the FIFTH run on p4c: ⚖ 57's
roster-wide `sound` pin (37 ladder tapes by ROOT inheritance; 76 v3/v4 tapes
EXEMPT by definition — a format-upgrade ⚖ for later; 4 controls exempt) + the
parked series + the bank + the three `r7-act2-*` descriptions, ONE push. Suite
row deliberately STALE in the file (375/11631; CI 376/11638) until 12h's
`--write`.

**⚖ RULING 60 (the user, 2026-08-26: "Push.") — EXECUTED by 12g′ (§46, close
`e9d1e2ef3`):** `seedling_bot_ap_p4c` PUBLISHED (`PeerInfinity/seedling-wasm`
`1bc0003 → 7aaaa0a`, verified at the far end; gitlink in `a0b8f10c3`; CI's pin
gate reads "2 pinned builds" on a fresh checkout). The race is REMOVED: `Bot.as`
arms on `FP.world` identity — exactly one pending frame, idle-invariant; p4c
passes at every idle that loses on p4b; the only observable is `dead_frames`
41 → 40, which the `-ship` gate's CLAIM 6 asserted in its own source (253/1 →
fixed build-aware, 254/0). Standing: suite 376/11638 @1eed5988a; two `cheap`
flips named. p4b stays pinned by one labelled README line until 12h retires it
(README line + whitelist + manifest + the CLAIM 6 branch, together). NEXT: 12h
(§47), the FIFTH run on p4c.

**⇒ CAMPAIGN ORCHESTRATION SESSION 8 → 9 (2026-08-26, `8e01d1400`).** Session 8
ran six slices to close (12f §43 · P3 §44 · 12g §45 · 12g′ §46 · 12h §47) and
opened four editor-integration windows; ⚖ 56–60 ruled and executed. **THE FIFTH
RUN LANDED** on `seedling_bot_ap_p4c` with the roster-wide `sound` pin: 149/149
streams match the pre-pin recordings, the pin moved exactly two latches
(`r9-solve-0`/`-13` exits), the boundaries gate reads 18/0 "0 of 18 UNPINNED",
the full-tier checkpoint is banked as measured (`3452/6/46`, the six = p4c's
removed pre-swap frame asserted as literals in `r5Acceptance.js`, repaired and
driven on both builds, `3458/0/46` PREDICTED), the bank retired to `r8-solve-5`,
`-6`/`-4` deleted. p4b stays pinned as the negative control for every
`arm == null` correction. Standing 63 rows / 47 cheap; suite 384/11843
@95c7500ad; traps 787–872. Successor prompt
`NewDocs/plans/seedling-bot-r9-campaign9-planning-prompt.md`; sequence **P3b
(§48: S0 baseline at the run's true before · `roster ∖ prove()` derived ·
a full tier owed at every game-facing change · the boundaries gate in CI ·
the TREE-freezing BOX LOCK · `cheap` hysteresis · CI-quoted rows) → P4 →
L15**. Open for the user: the 76 v3/v4 tapes' format upgrade; `-5` retirement.

**⇒ CAMPAIGN ORCHESTRATION SESSION 9 OPENED (2026-08-26, `6d8b572a0`).** P3b
LAUNCHED (Opus, own worktree `-wt-p3b`, as-built §48; brief
`NewDocs/plans/seedling-bot-r9-sliceP3b-prompt.md`): (a) S0's baseline as a SHA ·
(b) `roster ∖ prove()` derived, printed, given its own `prove()` row · (c) the
owed full tier as a gate + the tick-sum estimator · (d) the boundaries gate's CI
face decided · (e) the BOX LOCK that freezes the TREE · (f) `cheap` hysteresis ·
(g) headless gates quoted from CI by SHA (⚖ 54 (6)+(7) proper). Editor-integration
merge series (`editor-int-w4`/`-ba`/`-bd`) takes windows between P3b's stages.

**⇒ SESSION 9 STOPPED (user, 2026-08-27) after P3b's W1 push `75366148f`.** W1 =
(a) the pipeline's BEFORE is a commit SHA + (b) `roster ∖ prove()` derived, named
and priced (120 tapes ≈ 128 min; the "S4 IS the gate run" claim refused without
`--full-roster`); `--rehearse` 18/0 → 28/0 (standing row NOT yet written).
Rulings taken: (g) a DERIVED CI-sourcing rule (headless ∧ not cheap; population
23/4/3, zero flip today); (d) = (d2) `--structure` face. P3b PARKED: worktree
`-wt-p3b`, branch `p3b/box-lock-and-baselines`, W2 as a named WIP; W3 + §48
outstanding. The editor-integration merge series still waits for a window.
NEXT: resume P3b (rebase first) → W2 → W3 (+ the `--write` under the lock) → §48 → P4 → L15.

**⇒ P3b CLOSED (2026-08-27, `main` @`a3617d8e5`; as-built kickoff §48).** ⚖ 54
**(6)+(7) DISCHARGED**, and the four pipeline items §47.11 (3) named with them.
· **(a)** S3's record set is now the projection diff against a **COMMIT** — S0
seals a SHA, S1 reads each tape there, S3 prints which one and why — so the
fifth run's pin commit, an ancestor of the head S1 ran at, could no longer be
invisible (§47.5). · **(b)** `roster ∖ prove()` is DERIVED, printed and priced:
**120 tapes / 117,914 ticks ≈ 128 min**, ninety per cent of a full tier, so the
row is `--full-roster`-gated and what is refused without it is ⚖ 32 E's
*claim*, never the run — driving it per run would re-instate the per-move tape
tax ⚖ 40 retired. · **(c)** `check-seedling-full-tier-owed.mjs`, four derived
populations against the checkpoint row's own head; **RED at the close**, naming
`da855f9d2` ("the pre-swap correction was INVERTED") — §47.11 (2) stops being
prose. It is retired by the orchestrator's `--win` drive, sequenced after slice
12i's cost table so the wall-clocks are taken on a quiet box. · **(d)** the
boundaries gate declares `@ci-face structure: --structure`; CI runs a STRUCTURE
face under a DIFFERENT KEY and the VALUE row stays the box's (the all-REFUSED
CI reading was MEASURED, not assumed). · **(e)** the BOX LOCK at
`~/.cache/seedling-box/lock.json` — one holder, refusal BY NAME with the
`--wait-for-box=` retry, stale reclaim by `kill -0`, token re-entrancy, and it
freezes the **TREE** as well as the box (§44.9 item 5). 27 derived takers
(23 browser + 4 windows) + 3 runners; the lint reads the population BOTH ways.
· **(f)** `cheap` gains HYSTERESIS, and **HELD its first live row** —
`gate: maze-lab` at 62.0 s kept `cheap: true` while slice 12i's disclosed CPU
load was on the box, which is trap 735/801's law enforced by the file instead
of by a human noticing. · **(g)** ⛔ ⚖ 54 (6)'s premise is FALSE at this tree:
the headless population is **four gates of thirty-one**, all cheap, and CI can
run none of the other 27 — so the honest discharge is a DERIVED rule
(`ciSourced` = headless ∧ not cheap) selecting a **stated zero**, plus the
genuinely new thing: those four now RUN in CI, and the first yield is a
cross-check nobody had made (`gate: seedling-rerecord-rehearsal` **28/0 in CI
== 28/0 on the box**).
⛓ **THE SLICE'S SHARPEST FINDING IS ABOUT ITS OWN WORK.** CI's first run of the
new owed gate read `0/1` — not an owed tier, but a depth-1 clone with no
baseline commit — a line that would have booked 143 minutes of GPU for a
shallow checkout, in a gate written one commit after (d), whose whole subject
is that "cannot be asked" and "is wrong" must not print the same thing. It
refuses now. **Nothing on the box could have found it**; pushing the workflow to
a BRANCH and reading the step's LINES did.
STANDING VALUES @`eb3296a4a`: **64 rows / 48 cheap / 1 quoted**. TWO value
movers, both predicted (`gate: seedling-rerecord-rehearsal` 18/0 → **28/0**;
`suite: vitest (unfiltered)` 388/11970 → **389/11994**, now MEASURED from CI
rather than hand-quoted), ONE new row (`gate: seedling-full-tier-owed` **3/1**,
red), **ZERO `cheap` movers**, one HELD. The write ran 83 min under its own
lock with `assertTreeUnmoved` asserted at all 64 rows and never firing.
⛔ No tape moved; `fixtures/` byte-identical at the close.
NEXT: the orchestrator's full-tier drive (retires the red) → **P4** = ⚖ 54 (8)
one record surface + 47b's remaining (1)(4)(6) → L15.

**⇒ 12i CLOSED (2026-08-28, `main` @`ae16aa72b`, six commits in ONE fast-forward
`394ced764..ae16aa72b`; as-built kickoff §49; ⚖ 61 OPENED, two questions
PENDING for the user).** ⚖ The user, 2026-08-27: *"Yes, I want to implement the
dash settings. Next time we do a full record, I might want to change the default
to no dashing, if it makes that much of a difference."*
**THE KNOB IS BUILT AND THE DEFAULT DID NOT MOVE.** `DASH_MODES =
['none','full','all']`, `DEFAULT_DASH_MODE = 'all'`, the candidate set DERIVED
by `dashPrefixesFor` from `DASH_CHAIN_PATTERN` (⚖ 17); a mode outside the set is
a `fail()` by name in every reader, never a fallback. At `none` the window pass
is SKIPPED, not asked with `[]`. `--dash=none|full|all` on **eleven**
instruments, parsed ONCE in `scripts/procgen/dashMode.js`, threaded EIGHT hops
(every one forwarding `undefined` so absence reaches the solver's own default);
the mode rides the artifact only when it is NOT the default, so a trace that
says nothing means the roster's build. ⚖ 22's reference regen in the same
commit: **exactly eleven `dash` flag rows**, named by the index's own scan.
⛔ **NO TAPE MOVED and ELEVEN standing rows are unmoved** — the seven producer
`--check` md5s (measured three times: W1's head, W2's head, and after the rebase
onto P3b's close), (D)'s two bulk identity md5s equal to their standing values,
`gate: procgen-reference` 21/0 and the generator's own `--check` line. No
`--write` owed.
⛓⛓⛓ **THE BRIEF'S RENAME WAS REFUSED ON A CENSUS, AND THAT IS WHAT MADE THE
FINDING VISIBLE.** Of `ALLOW_DASH_ROSTER_WIDE`'s five reads, only TWO are dash
sites; the other three are ⚖ 46/47's `economies`, which ⚖ 54 (5) merely parked
behind the same constant as a RELEASE GATE (§40.3). So `dashMode` is a FOURTH
permission beside `economies` and the old name survives as a derived deprecated
alias.
⛓⛓⛓⛓ **AND THE 4× EVERY BULK ROW HAS BEEN PAYING IS ~80 % NOT THE DASH.**
MEASURED on a quiet box, four arms, `batch-seedling-acceptance` ×3 + `empty
pairs c3` ×1: `--dash=none` buys **1.18× / 1.19×**, `--dash=full` **1.06× /
1.07×**, the CONSTANT flipped to `none` (dash + economies) **4.92× / 4.44×**.
Dashing is **18.9 % / 20.5 %** of the saving; the rest is ⚖ 46's exhaustive
collect-stance scoring, which a GENERATED room pays on nearly every goal and the
committed roster hardly pays at all. **§47.9's attribution — "the dash planner's
price on every certification solve" — is corrected: a flip that turned on two
things priced them as one.** ⚠ No arm is both faster and inert: every
non-default mode moves six of seven producers AND both bulk identity rows.
⚠ **TWO OF THE SLICE'S OWN ERRORS ARE IN THE RECORD, both caught by DRIVING**:
an (E) table built with two md5 methods (`$( )` strips trailing newlines) that
read every row as "moved", including the one producer that moves under no mode —
contradicting §40.7, which is what should have caught it; and a test written FOR
mutant (m3) that ran GREEN under (m3), because it counted `DASH_MODE` and
`DEFAULT_DASH_MODE` contains it.
⛔ **CI WAS RED AT `ae16aa72b` AND IT WAS 12i's OWN — repaired at `2084dab69`,
which is the slice's true close head.** One finding, `lintGateLabels.test.js`:
the test NAME *"the set is DERIVED from the pattern in all **three** states"*
TYPED a cardinality its own check COMPUTES (`expect(DASH_MODES).toEqual([…])` is
that row's first line). Fixed by INTERPOLATION, never `--write-allow`. ⛓ The
bounded run was correct and blind — `lintGateLabels.test.js` scans a CORPUS
while the edit lived in `solverBot.test.js`, which is ⚖ 52's own caveat word for
word. Trap 902; the pre-push question is *"does this edit put a NUMBER in any
label or test name?"*, not *"did I touch a gate?"*.
NEXT: unchanged — the orchestrator's full-tier drive → **P4** → L15. ⛔ ⚖ 61's
two questions go to the user BEFORE the next full record, not before P4.

**⇒ 12j CLOSED (2026-08-28, `main` @`798eadd91` + this docs commit; three
commits, two fast-forwards; as-built kickoff §50; ⚖ 61 ANSWERED, ⚖ 62
DISCHARGED).** ⚖ The user, 2026-08-28: *(i)* *"leave the dash default as it
currently is"*; *(ii)* *"give economies its own constant"*; *"fix the issue we
just found with the lock."*
**(A) A CONSTANT PER PERMISSION.** `ECONOMIES_ROSTER_WIDE = true`, a LITERAL
beside `DEFAULT_DASH_MODE`, read by the three ⚖ 46/47 sites;
`ALLOW_DASH_ROSTER_WIDE` then had zero readers and is **DELETED** (⛓ it
survives only as prose naming a retired constant — including four historical
lines in this file, §5g's own narrative, which describe the state it named and
are correct as history). The eighteen test references were CLASSIFIED, not
renamed, the same 2/3 way the code split: the `['sword-dash']` row, both L18
arrive-early/late build branches and `procgenPostSword`'s inequality read
`DEFAULT_DASH_MODE !== 'none'`; `spell({ economies: … })` reads the new
constant. The alias's own standing row became a row about the CUT, asserting
the independence on the DECLARATION'S SOURCE — two `true`s that agree by
coincidence are exactly what the yoke was.
⛔ **NO TAPE MOVED, NO DEFAULT MOVED**: seven producer `--check` md5s
byte-identical, one method, measured at every commit and again with all 69 lock
preambles in place. **(m2)** `DEFAULT_DASH_MODE='none'` reproduces §49.5's
column **D** (dash-only) digit for digit on all seven — before 12j it would
have landed on column C (yoked). The cut, from the dash side, against a table
sealed by another slice.
⛓⛓⛓ **(m1) FOUND A THIRD SUPERSEDED CITATION.** `r8-solve-10` 90→89 ·
`r8-solve-20` 365→332 · `r8-d2-19` 864→807 · `r8-d2-20` 781→756 — quoted
through §40.3, §49.2, §49.9 and 12j's own brief — are PRE-RE-RECORD numbers,
measured before ⚖ 41's flip with the dash OFF. Re-measured at this head:
`r8-solve-10` 78→83 (campaign chain 3326→3331) · `r8-solve-18` 410→485 ·
`r8-solve-20` 229→257 · `r8-d2` headline 1685→1791, its *"first 410 ticks ARE
r8-solve-18's walk"* row parting at tick 292. Five of seven producers move;
`r8-tail` and `r9-l3` do not — the exact COMPLEMENT of the dash's own movers.
Both censuses are in the tree, each labelled with the roster it describes.
**(B)+(C) THE LOCK COVERS THE THING IT WAS BUILT FOR.** P3b derived the takers
from `gateRoster` — the `check-*.mjs` names — so a **142-minute** `--win`
differential ran with NO `lock.json` while three sessions worked beside it.
`machineDrivers()` now classifies every `scripts/procgen/*.mjs`: **96 takers**
(75 browser + 21 windows) where the gate roster reached 27 — 23 gates · 29
`verify-*` (runner/sphere/maze/omsi/topdown/bounce included: the lock is about
the BOX) · 21 `probe-*` · 21 windows rows · 1 `plan-*` · 1 `export-*`. Four
HOLDERS, `rerecord-seedling-campaign.mjs` newly among them (it shells the
producers AND the differential, and takes only when a stage past S0 runs).
⛔⛔ **AND THE BRIEF'S DERIVATION WOULD HAVE BROKEN THE THING IT FIXES.** Taken
literally it yields **111** takers, not the predicted 45, because `SIBLING_RE`
matched a sibling NAMED anywhere: of twenty files pulled in transitively, ONE
reached a browser by a real reference and NINETEEN printed a usage line in a
docblock — four of them headless producers whose 2-second `--check` would have
queued behind the very drive being serialised. Comment-stripping is not the fix
either (two survivors were `console.log` template literals printing the same
command). **A reference is a relative module path; a mention is a repository
path** — trap 566's law one level up. Measured inert: gate-roster `browser`
23 → 23, so nothing that reads the roster moved.
⛓⛓ **AN INSTRUMENT'S PROVENANCE LINE MAKES ITS IDENTITY NONDETERMINISTIC.** The
lock notice carries a pid and a frozen head, and
`producer: plan-seedling-r7-ends-meet --check` md5s `2>&1` of an instrument
that drives a browser inside its own `--check`. `identity-block.sh` gains
`b () { grep -v '^# box lock:'; }` in the SHARED producer template — byte-inert
for every producer that takes no lock, measured. ⛓ FOUR takers take
CONDITIONALLY behind their own argv (`solve-seedling-r8-tail --game`;
`-r8-d2-chain`, `-r9-campaign`, `derive-seedling-tick0` on `!--check`), and
`derive-seedling-tick0` deliberately does NOT exempt `--dry-run` or a warm
cache, because whether that run spends the GPU is a property of the CACHE
STATE, not the argv.
**FIVE MUTANTS, in child processes under a temp `XDG_CACHE_HOME`**: a windows
`probe-*` (the population that took nothing before) refuses BY NAME in 1 s ·
`solve-seedling-r8-tail --check` under a live holder is NOT refused and prints
no lock line at all · the differential under the holder's TOKEN passes through
on its FIRST line, killed there by captured PID · a `kill -0`-stale holder
reclaimed by a DRIVER, not a gate · and BOTH lint directions red, each naming
its file.
⚠ **AND THE ⚖ 22 REGEN CAUGHT A DEFECT NO TEST WOULD HAVE**: three `verify-*`
files keep their header comment BELOW their imports, so a preamble inserted
"after the last import" became their `oneLiner` in the instruments reference.
Bulk insertion is a positional assumption; the generator was the only reader
that could see it. ⛓ A second one: the tracked doc's own prose spelled a
repository path in an example and the instruments index filed it as *"cited by
a doc, NOWHERE in the tree"* — the reach reads PROSE, so an example path in a
sentence is a citation.
NEXT: unchanged — the orchestrator's full-tier drive → **P4** = ⚖ 54 (8) → L15.
⛓ ⚖ 61 (i) leaves `DEFAULT_DASH_MODE = 'all'`; the *why is the economy
expensive* question is NAMED-LATER (kickoff §50) with its measurement list.

**⇒ CAMPAIGN ORCHESTRATION SESSION 9 → 10 (2026-08-28, `e91cf5a83`).** Session 9
ran four slices to close — P3b §48 (`394ced764`; ⚖ 54 (6)+(7) discharged; the
BOX LOCK live) · 12i §49 (`2084dab69`; `--dash=` knob, ⚖ 61 opened) · 12j §50
(`1c47fff54`; ⚖ 61 answered: default `all` stays, `ECONOMIES_ROSTER_WIDE` its
own constant; ⚖ 62 discharged: 96 lock takers) — and banked the ⚖ 40
checkpoint: full tier at ae16aa72b **149 tapes 3458/0/46**, the prediction
digit for digit; owed gate 4/0; suite 390/12007 @1c47fff54; standing 64/48/1.
Traps 893–907. Successor prompt
`NewDocs/plans/seedling-bot-r9-campaign10-planning-prompt.md` — ⛔ FIRST ACT IS
DISCUSSION (user): P4's shape (P4a brief WRITTEN, not launched) · ⚖ 61 (i) at
the next full record · the economies-cost investigation · 47b (2) · L15.

**⇒ SLICE P4a SHIPPED 2026-08-28 — ⚖ 47b (1)+(4) DISCHARGED, and the brief's
premise about (4) was wrong by two orders** (kickoff §51; traps 908–915).

**(1) A LINT READS CODE, NEVER COMMENTS.** `lint-gate-labels`'s call scanner
tracked quotes but not comments, so one apostrophe in a `//` line opened a
string that never closed and the enclosing `describe(` swallowed the rest of
the file — `solverBot.test.js` had carried a ~2,000-line dead zone since 12c″.
Corpus **100 → 87**, thirteen movers, **every one triaged**: twelve were
MANUFACTURED (each call span ran hundreds to thousands of lines past where it
is written, five to end-of-file, and the roster each was "derived from" sat
outside the true call), and the thirteenth vanished on a rule fix — the two
halves of the scan disagreed about whether 0 and 1 are counts, so *"(R8 slice 0
track C/D)"* had been read as a cardinality and one of them ALLOWLISTED on that
misreading. Allowlist 99 → 86, **zero entries added**. ⛓ The masker's own
positive control (`node --check` over all 514 corpus files) found a defect in
the first cut: `Array.from` iterates code POINTS, so one astral character
shifted every later offset by one.

**(4) `--help` PRINTS AND EXITS ON ALL 262, AND A GATE SAYS SO.** The census
that shaped it, at `1097be9e6`: one instrument WROTE A 148 KB FILE NAMED
`--help` into the repository root (argv[2] as an output path), two rewrote a
TRACKED source file, two rewrote committed data, **~99 took the box lock**
before parsing anything, and 189 of 260 did work. ⛔⛔ **AND THE PREMISE IS
OVERTURNED: only THREE of 260 have a main guard at all** — module-scope work is
the DIRECTORY'S NORM, so closing the second door (a bare IMPORT, which is how a
test reaches these files) is 182 refactors each able to move a ⚖ 8 md5, not "a
handful of producers". Door 1 is closed with no list and no exceptions; door 2
is a committed TWO-WAY baseline (203 of 262, 14 writers, each entry naming what
it wrote), and its CI exposure was MEASURED at nil — the instruments a test
truly imports are all inert.

**THE HEADLINE FINDING ARRIVED AFTER THE COMMIT THAT "CLOSED" DOOR 1.** Imports
hoist, so a guard in every file means a DEPENDENCY answers for its importer:
`check-preset-bundle-load.mjs --help` printed **`loadJSZipNode.mjs`'s** help
text and exited 0 — a true help page about the wrong file, with every observer
satisfied. Only the byte-exact *"stdout IS the text derived FOR THIS FILE"*
assertion could see it. The guard now tests that the module is the ENTRY POINT.

**(C) THE INSTRUMENTS TABLE SAYS WHAT A FILE ACCEPTS, WITH THE PARSE SITE**
(§48.13 item 2 / §50.11 item 2): `--wait-for-box` **96 ← boxLock.js** — §50.11's
number to the file — `--help` 260 ← argvHelp.js, three more ← rehearsalTree.js.
⛓ And `--segments` stopped taking the box on three producers (⚖ 62's rule one
level in; it had made `rerecordCampaign.test.js` load-flaky).

⛔ **ZERO STANDING VALUES MOVED** — all seven producer `--check` md5s
byte-identical after a 260-file bulk insert; **0 tape lines**; trap 906's
control clean (0 one-liners moved of 262). NEW standing row:
`gate: seedling-procgen-help`, with a declared bounded `@ci-face` because
`ci-gates.mjs` runs every headless gate on every push.
NEXT: unchanged — **P4b** = ⚖ 54 (8) ONE RECORD SURFACE → L15.

**⇒ P4a's STANDING ROWS BANKED (session 10 orchestrator, 2026-08-28, on the records `a61feaaec`).** `gate: procgen-help` **262/0**, `cheap: false`, measured LOCALLY under the box lock (573 s on this box; the slice's 347 s — the clock is a kill deadline, not a verdict, trap 916) — and CI's bounded face at the same head, `gate-help-ci: procgen-help`, reads **262/0** as well: the two faces AGREE on their first outing. `suite: vitest (unfiltered)` **392/12031** @a61feaaec from CI (+2 files / +24 tests over 390/12007). File 65 rows / 48 cheap. ⚠ MEASURED, for P4b: `ci-summary --gate="gate: procgen-help"` REFUSES BY NAME (the gate declares a ci-face), and `ciSourced(headless ∧ ¬cheap)` will select exactly this row on its next `--write` ⇒ that write can only KEEP — the two rulings do not compose (P4b brief (D)). ⚠ The gate's full pass leaves ten untracked artifacts in the tree by design (it reports, never deletes): five verifier `.rl-*/.atlas-*` scratch files and five `worlds/*_worldgen/` dirs — removed by mtime against the run's start. The slice's first-quoted row key (`seedling-procgen-help`) was not the derived one (`procgen-help`); `--key=` refused by name, as built. ⚖ 63 (a)–(i) are in kickoff §1.

**⇒ P4b CLOSED (2026-08-28, `main` @`37925a6d1`; 5 commit(s), 5 fast-forward(s); as-built kickoff §52; ⚖ 54 (8) DISCHARGED, ⚖ 63 (e) ANSWERED).**
⚖ The user, 2026-08-28: *"I would like to implement one recording surface if
possible"*, and on the trap ladder: *"How did the trap list grow to 907 entries
so quickly? Are there duplicates? Is it practical to refer to a list that
long?"*
**(A) THE KICKOFF §N IS THE RECORD.** `record-slice.mjs` reads an as-built §N —
header, preamble, `### N.x` count, the WHAT LANDED SHA table, the user's words,
the ⛔ claims — and derives from git at the fold's real head: each SHA's
ancestry, the range base as the first landed commit's PARENT, the `fixtures/`
and `standing-values.json` diff line counts, the tracked-doc heading's line and
introducing commit, whether ⚖ 22's regen is IN that commit, and the queue
block's line. It emits the four fact lines the other surfaces carry, each field
carrying its provenance (`git` · `section` · `both` · `prose`). ⛔ It never edits
what it reads and emits no timestamp: a disagreement is a FINDING.
**AND THE CALIBRATION AGAINST §50 FOUND THAT TWO SURFACES NAME DIFFERENT HEADS
FOR ONE FOLD.** The queue header says `main` @`798eadd91`; the memory close line
says `1c47fff54`. Not a typo — the queue entry is written INSIDE the commit it
describes, so its head is one commit stale by construction (trap 924). MEMORY.md
carried no line naming 12j at all (its R9 bullet is a moving pointer). §50 names
⚖ 61/62 and writes no verdict word, so ANSWERED/DISCHARGED lived only here.
**(B) ONE FILE PER TRAP.** `<memory>/traps/<NNN>-<slug>.md`, frontmatter
`number`/`slice`/`family`; the number is `max(THE FREEZE, THE HIGHEST FILE) + 1`
and `existsSync` REFUSES, so the FILESYSTEM is the collision guard. The ladder is
FROZEN at **921** and NOT migrated: 450 `trap NNN` citations live in the tree
(367 `scripts/procgen` · 50 `docs/json` · 33 `CC/docs`), maximum cited **916**,
all below the freeze, and `--trap=NNN` resolves from either place.
**(C) A GATE REFUSES A FOLD WHOSE SURFACES DISAGREE.** `check-slice-records.mjs`
(headless, no box): per tracked-doc heading, the queue has a block · ⚖ 22's regen
is in the heading's introducing commit · every trap that commit cites resolves.
⛓ **Its first run re-derived, unprompted, `c4f7b21e4`/`bb45d7eff` — the exact CI
red ⚖ 22's own text was written from.** The CI face is those three; the kickoff
and the memory directory are outside a CI checkout, so those checks are
`--local` and an unanswerable question is never a pass.
**(D) ⚖ 54 (6) AND P3b (g) DO NOT COMPOSE, FIXED.** `gate: procgen-help` is
headless and not cheap, so `ciSourced` selected it — and `ci-summary` refuses it
by name, because the gate declares `@ci-face gate-help-ci`. That row could only
ever KEEP, forever. ⇒ a gate with a declared ci-face is NEVER CI-sourced: its
full pass is the standing value, the face is CI's bounded witness under its own
key, and the row's `command` says which.
⛔ **NO TAPE, NO DEFAULT, NO BOX, ZERO STANDING VALUES MOVED.** `fixtures/` and
`standing-values.json` 0 lines vs `86f7974d7`; the seven producer `--check` md5s
byte-identical at W0 and at the close. Standing rows **+1 derived**
(`gate: slice-records`); predicted for the orchestrator's window:
`gate: procgen-help` 262/0 → **264/0** with its import-door baseline unchanged at
**251**, instruments index 262 → **264**.
**TRAPS 922–928.** NEXT: L15 `shove` — a Fable design session, DISCUSSION FIRST
(⚖ 63 (h)).

**⇒ P4b's STANDING ROWS BANKED (session 10 orchestrator, 2026-08-28, on the records `fd4fe9ab6`).** `gate: slice-records` **65/0/29** cheap (21 s; its default IS the CI face, so no `@ci-face`). `gate: procgen-help` **264/0** `cheap: false` (544 s local). ⛔ THE FIRST READ WAS **263/1**: `check-slice-records.mjs — HELP ok · IMPORT SIDE EFFECT` — the gate's whole body was module scope, so a bare import ran the roster; P4b's REPORT BACK had sealed 264/0 on "both new instruments carry an entry-point guard", true of `record-slice.mjs` only. Fixed at `fd4fe9ab6` (a guarded `main()`; the shared `isEntryPoint` in both files; regen MATCH; 71 bounded tests green), the row re-measured AFTER the fix. Trap **930** — the first trap filed by an orchestrator through `record-slice --trap` (the filesystem allocated it). Branch `p4b/one-record-surface` deleted (⚖ 59). File 66 rows / 49 cheap.

**⇒ RR CLOSED (2026-08-28, `main` @`fd6b17826`; 8 commit(s), 3 fast-forward(s); as-built kickoff §53; ⚖ 40 ANSWERED, ⚖ 47b (2) DISCHARGED, ⚖ 63 (c) DISCHARGED, ⚖ 64 DISCHARGED).**
⚖ The user, 2026-08-28: *"Please go ahead and do the full batch of changes, not
just the small slice"* (⚖ 64), and on the economies: *"I think I would prefer to
change it to off next time we do a re-record"* (⚖ 63 (c)).
**(B) ⚖ 47b (2) — AND ITS PREMISE WAS FALSE.** The ruling asked for a driver
change: the differential's terminal counters are read *"~8 frames past the
tape's last observation, with the tape's last keys still held, because nothing
dispatches a release"*. The second clause is written in THREE surfaces and
measured in none. `Bot.update` releases every span whose `to == tick` at
`tick == tickCount`, above the disarm, and says so; 149 of 149 committed tapes
have `max(span.to) <= tick_count`, 74 end a span exactly there. What spends
those frames is the WORLD. ⛓ And the fix was already on the wire since R7:
`latchSeam` freezes `arrival.velocity = {vx, vy, hits, hits_timer}` at the
disarm tick and the driver already ships it as `seam`. Ten lines in ONE file, no
driver edit, no wasm rebuild, drift ZERO BY CONSTRUCTION — and `hits_timer` is
an EQUALITY again. The first tier under it found FOUR tapes carrying a 1–7 frame
drift the bound had been swallowing, model matching the FROZEN value on every
one, including `r6-contact-pair-standing`, the tape the bound was invented for.
**(A) THE ECONOMIES ARE OFF, AND THE CENSUS IS SIX.** `ECONOMIES_ROSTER_WIDE`
`true → false`. Every surface — the constant's own docblock, §50.2, ⚖ 61 (ii) —
said FOUR artifacts; the producers' own `--check` DRIFT lines say SIX:
`r8-solve-10` 78→83 · `r8-solve-18` 410→485 · `r8-solve-20` 229→257 ·
**`r8-d2-19` 721→746** · **`r8-d2-20` 554→560** · `r8-d2` 1685→1791. The two new
ones are the d2 chain's own SEGMENTS, dropped because the census was assembled
per PRODUCER while artifacts are per walk.
**(D) THE WRONG COUNT HAD A SECOND SITE.** ⚖ 64 (iv) named `swordDash.why`;
`dashRejectionSummary` writes the same arithmetic into `rejected[].why` and
reaches THIRTEEN sidecars where the named one reaches four. Measured, put to the
orchestrator with its numbers, ruled GO — so the sealed set widened BY RULING,
8 → 13 sidecars, at zero GPU (a sidecar is a model artifact).
**(C) THE FIVE ASKED, AT THE SHIPPED HEAD.** Driven AFTER S5 rather than before
S3 as briefed, because three of the five have tapes (A) moves and a latch taken
first certifies a walk that will not ship. All five GAME-CERTIFIED; the table
closes at **23 GAME-CERTIFIED · 2 unasked · 0 REFUSED** (was 18 · 7 · 0), the
two being `r7-ends-meet-2`/`-full`, whose producer drives a browser so S0 cannot
measure them at all.
**AND THE PIPELINE STOPPED BEFORE THE GPU, CORRECTLY.** S3 admitted a mover on
the WALK licence or on `s2.wrote` — a MECHANISM standing in for a PERMISSION.
⚖ 43 spends the licence at the top of S1, where the producers re-author their
WHOLE segment set, so every `boot-only` cascade successor is written there and
S2 writes nothing. Six successors arrived with a moved projection and no arm.
The bound is S0's own licensed set now, and the offline rehearsal gained
`cascade-without-an-s2-write`, which no existing scenario could produce.
**THE ⚖ 40 CHECKPOINT**: S4 under `--full-roster` = **149 tapes 3615/0/120**
(773/0/68 + 68/0/37 + 2774/0/15), `gate: seedling-full-tier-owed` 2/2 → **4/0**.
18 standing movers, 16 predicted; the two misses are ⚖ 22's own regeneration.
⛓ The economy's price also shows up as wall clock: `acceptance batch`
158.8 s → **68.0 s**, `empty pairs c3` 239.9 s → **92.6 s** — §49.4's ~80 %,
collected.
⛔ CI came back 18 red against a `main` baseline of 8; ELEVEN were mine and TEN
of those were in a reach population printed on the same screen as the one I ran
(the tests the import graph cannot see). All repaired in `d61ee802e`; the
remaining 7 are P4b's `sliceRecords.test.js`, open before this slice.

**⇒ RR VERIFIED and the CI red RETIRED (session 10 orchestrator, 2026-08-28).** RR closed at `be3734c79` (== origin; 10 commits; §53, 14 subsections; traps 931–940; branch deleted, ⚖ 59). CI at `d61ee802e` read **7 failed** — all `sliceRecords.test.js` (P4b), GREEN locally 34/34: the test took its two "real" commits off `git log -2` of THIS tree, and `actions/checkout` clones at depth 1, so the parent, `merge-base --is-ancestor` and the `fixtures/` numstat could not be asked (trap 896's shape). Fixed: the test BUILDS a throwaway repo with three commits and asks that. DRIVEN before belief: in a `--depth 1` clone the old file fails exactly **7 / 34** (CI's number) and the new one passes **34 / 34**. Trap 941. Suite row to be re-read from CI at this head.

**⇒ L15 CLOSED (2026-08-30, `main` @`f8f72ec02`; 14 commit(s), 1 fast-forward(s); as-built kickoff §55; ⚖ 65 DISCHARGED, ⚖ 66 DISCHARGED, ⚖ 67 CLOSED, ⚖ 68 DISCHARGED, ⚖ 69 DISCHARGED).**

L15 `shove` CLOSED: one block-route search (`deriveBlockRoute`) that `shove` and `weigh` resolve through; L15 recorded on the game (457 obs, 0 hits, seam {15,0}{15,2}{15,3}); chain 17 segments / 3787 t; full tier 150 tapes 3641/0/120. ⚖ 65 EXECUTED; ⚖ 66 (seam.music unasserted at a boundary) landed with its GPU mutant. Brief overturned: L16's route (E1·break·N2), the cost tuple, the frontier naming the block, the button crossing, m5/m6 vacuous. Driver readout moved once (runShove settle: a block at rest jitters 96↔96.5, PushableBlock.as:59-64) — 149/149 replay inert. NEXT: L16 (route step 18, BRIDGE+KILL_ARM) — the sword-press rope arm + arrow-trap deactivation + the seven-Bob roster; its weigh measured E1 · break rock@(19,4) · N2; the post-drain seam readout (⚖ 66 (i)) rides its full tier.

⚖ 69 (c) EXECUTED and ⚖ 70 built whole. The roster is partitioned by DERIVATION — `campaign` 26 tapes / 7,928 t / ≈11 min (`CAMPAIGN_SEGMENT_NAMES` ∪ `chainTapeNames`), `map-walk` 21 / 64,620 / ≈64 min (the R2–R4 route fixtures, through the same `rNTapeSpecs(route)` call that writes those tapes), `mechanic` 103 / 57,119 / ≈68 min (THE REMAINDER, so a new fixture is driven and never skipped) — with no tape named by hand. `--tier=<category>` and a comma list on the differential, `--categories=` on the re-record pipeline, `prove()`'s complement split by category, and the checkpoint row now carries one PART per category with its own `measuredAt`; its `value` and `why` are DERIVED from the parts and the gate refuses a hand edit to either (⚖ 17). `check-seedling-full-tier-owed` re-derives its four populations PER CATEGORY: build / driver / dead-frame movers owe every category — they are what only the full tier can test — and a tape-projection mover owes only the categories of the tapes that moved. ⚖ 40 AMENDED in the tracked doc to ⚖ 70 (f)'s sentence.

**The headline is the price.** The seventeen ⚖ 68 chain tapes put this tree's debt at `campaign` alone — ≈11 min, where the whole-row verdict priced the same tree at ≈143 — and the one announced `--win` drive (26 tapes, **791/0/69**, ALL CHECKS PASSED, ~12 min at `fc87a177f`, queued behind the editor session's wasm-ship gate) took the gate **3/1 RED → 5/0 GREEN on a measurement rather than an inheritance**.

**Brief overturned, three times, each by measurement:** `map-walk` is 21 and not 28 (the seven `r3-collect-*` are hand-authored single-room pickups no route fixture produces, and the nearest derivation reaching them names six of seven); `campaign` must be chain-CLOSED at 26 and not "the segments" at 24 (a chain claim SKIPS without its headline, so a segments-only category could not make its own claims when driven alone); and ⚖ 70 (d)'s "campaign is already clear at L15's head" was FALSE — that drive covered 22 of the 26, which is what made W4 load-bearing instead of a demonstration.

**Four defects, two of them about the box.** The differential took the box THREE HUNDRED LINES above its `--tier=` parse, so a misspelling printed "the box is taken" and exited 1; the re-record REHEARSAL — no browser, no GPU, stubbed `exec`, and it says so itself — took the box for all six stages, so with the box held its 13 scenarios read as 43 failures (and the exemption needed the CHILD spelling `--rehearse-tree=` as well as `--rehearse`). Plus: a repeat in a chain's OWNED tapes is the staged idiom, not a defect (13 live chains said so); and two spellings of "the tapes in category C" agreed on the SET and not the ORDER. Traps 1003–1008.

NEXT: `map-walk` and `mechanic` have no separately banked value — their parts carry a true head and name the run that covers them; the row becomes a pure sum the first time each is driven alone (≈64 and ≈68 min), which no rule owes today. ⚖ 69 (d) — CENSUS DONE 2026-08-30 (Fable session 13, `seedling-bot-r9-campaign13-slow-gates`): the four slow rows (`procgen-help` 596 s · `procgen-demos` 310 s · `wasm-element` 941 s · `wasm-ship` 458 s) = 68% of the 56.8-min battery; census in memory `note_slow_procgen_gates`, ruling ⚖ 71 in the R9 kickoff §1 (user 2026-08-30: both mechanisms STAGED — SG1 demos-dedup + help-gate throwaway-worktree, then SG2 byte-keyed row quoting; re-measure at P2's merged head). SG1 (Opus, `seedling-bot-r9-sliceSG1`) CLOSED same day @ `33a88e282` (4 commits, kickoff §57, trap 1015): demos' 3 sibling-gate cli rows dedupe under a battery (licence = roster membership + bare argv; measured 3m15.7s → 4.6s per row, expected ~250 s off the 310 s row, NOT banked per ⚖ 71 (c)); the help gate drives a throwaway worktree by default (submodule init asserted; 3-arm matrix at one baseline, ALL THREE VERDICT SETS IDENTICAL 265/0; --in-place reproduced the dirtying, worktree arms porcelain-0; observer --no-optional-locks + bounded-retry named refusal + per-batch stderr progress + startup orphan prune-report; CI face --doors=ci --in-place). Trap 1015: the gate's own import door built worktrees its observers cannot see — entry-point guard, mutant PRE 1 / POST 0. SG2 (Opus, `seedling-bot-r9-sliceSG2`) CLOSED same day @ `c66eeac18` (7 commits, tracked-doc `### R9 slice SG2`, traps 1016–1018) — ⚖ 71 CLOSED WHOLE: 34/66 standing rows carry `inputKey`/`keyAt`/`keyPopulations` (populations = CODE closure incl. driven pages · DATA · SPAWN by CALL CONTEXT (1016) · BUILD by containment-OR-naming (1017); an instrument OPENS a doc vs CITES one, scoped to scripts/procgen (1018)); `--write` re-runs only moved-key rows (steady state ≈2/34 on a scripts-only head; docs/plan-only quote everything), `--redrive-unchanged` is the trap-866 nondeterminism detector (3-arm proven, bank never overwritten). ⚖ 71 (c) BANKED at 34c74aecc: demos 310.4→95.1 s · help 596.3→434.1 s AND 264/1→265/0 · element/ship noise-level (intrinsic) — four-row total 2305.7→1917.9 s (−17%), battery 76.4→71.4 min; the first keyed write's 78.9 min is baseline-establishing, not steady state. ⚠ a ~45-min write cannot live in a harness background task — setsid nohup + PID + kill -0 (`feedback_long_measurement_needs_setsid`). Same evening the editor arc DISCHARGED ⚖ 70 (f) on a measurement (full tier at 15e70e7bb, ALL PASS 3633/0/46) and re-banked the owed gate 5/0 in a 1.8 s ONE-ROW write — the key mechanism's first external dividend. ⚖ 69 (d) ARC COMPLETE.

**⇒ SG2 CLOSED (2026-08-30, `main` @`c66eeac18`; 7 commit(s); tracked doc `### R9 slice SG2`; ⚖ 71 CLOSED WHOLE, ⚖ 71 (a) DISCHARGED, ⚖ 71 (c) DISCHARGED).**

⛓⛓ **THIS BLOCK IS A BACK-FILL, AND ITS ABSENCE WAS A BANKED RED.** SG2's
record went into the TRACKED doc (`### R9 slice SG2`) and never got a queue
block, so ⚖ 22's fold had one surface written and one missing — which is
exactly what `gate: slice-records` exists to refuse. It surfaced on 2026-08-31,
on the first `standing-values --write` since: the editor catalogue slice read
the row RED (*"SG2: the tracked doc has a heading at :13783 and the queue has
NO `**⇒ ` block"*) and banked it honestly as `exit: 1` rather than repairing a
record it did not own. ⛔ That was the right call and this is the other half of
it: a gate whose red is a MISSING RECORD is retired by writing the record, never
by widening the gate.

⛔ THE SUBSTANCE IS NOT RESTATED HERE — the tracked doc holds it and the ⚖ 69
(d) census paragraph above already carries the close; a third copy would be the
drift the one-record-surface rule exists to prevent. In one line: a standing
gate row now carries an `inputKey` over four DERIVED input populations (CODE ·
DATA · SPAWN · BUILD, `scripts/procgen/rowInputKey.js`), so `--write` re-drives
only the rows whose inputs moved and QUOTES the rest saying so — the ⚖ 70
pattern, moved from tape categories to gate rows. Traps 1016–1018.

**⇒ CAT CLOSED (2026-08-30, `main` @`44c112087`; 8 commit(s); as-built kickoff §56; ⚖ 17 ANSWERED, ⚖ 22 ANSWERED, ⚖ 40 ANSWERED, ⚖ 69 (c) DISCHARGED, ⚖ 70 DISCHARGED).**

## 5i. The EDITOR INTEGRATION arc — ⛓ CLOSED 2026-08-31 (opened 2026-08-26; the CLOSE paragraph is at this entry's end; entry first written 2026-08-28 at main `2b0c1bc7c`)

**Status: ⛓ W-front + ALL FOUR B slices + M0 recon + H7/H8 MERGED 2026-08-28
(main `52e3348a4`, suite 401/12287 @a3fe66f4a); ONLY M1 (the AS3 seams + the
p4d build) OPEN — kickoff drafted, launch on the user's timing — owned by
Fable session `editor-integration-planning-2`.** Plan doc *(NewDocs)*:
`editor-integration.md` — §0 verdict, §1 recon of all NINE procgen editors,
§2 question A (rooms on different substrates), §3 question B (integrating the
editors; §3.2 the ROOM-EDITOR CONTRACT), §4 what the platformer inherits, §5
slices + the LEDGER, §6 the ⚖; as-builts W1 §7 · W2 §8 · W3 §9 · W4 §10 · W5
recon §11 · W6 §12 · B-a §13 · B-d §14 (B-b → §15, B-c → §16, M1 → §17).
Memory: `project_editor_integration_planning`.

**⚖ RULED (user, 2026-08-26/27):** Q1 = **A2** (a WORLD is the bundle; both
room documents kept; per-region `substrate` on the ATLAS; cross-document doors
= `overlay.links`) · Q3 = **B1** (one room-editor contract on the registry;
`editCore` sessions where they are cheap — marking, bounce, APWorld; a
RECORDED `layout.edits[]` on the pipeline envelope instead of a session) ·
Q4 = **`lab.html`** hosts the world editor · Q2 = measure bounce first — done:
bounce is HOST-DRIVEN (identical in Ruffle/wasm), Seedling swaps synchronously
with no seam ⇒ M1 = an AS3 change · **M2 first** (all-maze plays on landing) ·
**(B′)**: H1 + H2 + M2's collision survivor land first as correctness fixes
(W6), M1 later against a free box.

**What shipped (nine Opus slices, all on main):** W1 optional per-region
`substrate` + the compiler's per-region sidecar TABLE + both derivations
writing it (seven producers byte-unmoved; the playthrough regenerated by
ruling) · W2 `procgenCore/{worldDocument,worldDerivation,worldSetAdapter}.js`
— the WORLD document, the merged atlas, the composite session; chain row 2
Seedling + 2 maze rooms → one atlas, two substrates · W3 `entry.roomEditor` on
the registry + `procgenLabPanel/labRoomEditor.js` (Edit ▸ reaches the maze and
Seedling LAB pages; `?room=`) · W4 the WORLD editor on `lab.html` (intake,
strip with substrate badges, Seedling rooms through a `watch.html` iframe,
cross-part doors, four-document bundle + all-maze `rules.json` download) ·
W5 recon of the AS3 seam (§11) · W6 `external`/`target_substrate` on flash
sidecars (a Seedling exit read a maze `map_ref` as a level), the maze
projection's collision SURVIVOR (a generated ring was a one-way trap), the
`procgen:activeSubstrateChanged` PARK in the Seedling glue · B-a the marking
tool on an `editCore` session (undo; seven hatches → ops; `atlasOps` 18 → 25;
every byte gate 0-moved) · B-d `layout.edits[]` on the envelope (replayed by
both step runners + the CLI, undo = pop; two pre-existing silent corruptions
fixed — `node.cell` and `node.side` never followed a layout edit).
**Standing rows at this entry:** `gate: maze-lab` 194 → **231** · `gate:
procgen-lab-hosting` 47 → **66** · `-arm` 226 (quoted) · `-edit` 71 ·
reference 21/0 · suite 372/11587 → 388/11970. Traps 823–884 (+ 856–862,
873–882 interleaved with R9's).

**⛓ UPDATE 2026-08-28 (same session, later):** B-b MERGED (`a1073c582`; §15;
traps 946–949 — `editCore`'s no-cell-space widening: `CELL_SPACE_MEMBERS`, laws
1/6/7 are the cell-space laws and skipped ones are NAMED; the bounce editor on a
session with 8 ops incl. `replace-level` carrying the RESULT; `verify-region-
step-editing` IMPORTS the merge; Phase H of `check-sphere-steps-ui` was VACUOUS
— now a measured PIN) · B-c MERGED (`31384bfc6`; §16; traps 950–953 — the
APWorld editor on a session, 19 ops, Clear IS an op, renames ONE op each;
`deepEqualKeyOrder` hoisted to `procgenCore/`; ⛔ an op storing a payload BY
REFERENCE aliased the record — copied at the door; all three "key order is
content" rows were vacuous, fixed) · **M0 RECON** (§17.0; traps 942–945): the
injected-AS3 AP integration WAS ported (as p4c's build step + `flashPanel/`),
the RANDOMIZATION never was (11/40 locations detectable in one preset) ·
**⚖ RULED**: (c)+(e) — rewrite the ROOM + report the check from
`Game.setPersistence`; items ride p4d WITH the door seam; EVERY randomized
location is an `APItem` that grants nothing, sprite by `@look` (the Seedling
graphic for the current player's own Seedling items, else the AP LOGO);
foreign-world items + a host-side "found X for Player Y" readout; wasm-only
(Ruffle via the step-2 injected SWF = low-priority residue) — design §17.1 ·
**H7/H8 MERGED** (`a3fe66f4a`; §17.2; traps 954–959): `apPlacementRewriter`
(placement table keyed `"<level>|<tag>"`, 21-name DERIVED look book = M1's AS3
contract, 11 tags allocated for keys/totems/seed, byte-identical elsewhere) +
`seedlingLevelSetDelivery` (chunked `botLoadLevels` before the first region
load, every dep INJECTED — a static import costs the bundle 0.8–4.9 MB);
browser arm on p4c: 5 AP locations ABSENT vs PRESENT. FOUND: `botLoadLevels`
answers "pending" per non-final chunk and `watchWasm.js:1169` throws on it
(nobody had delivered >1 chunk; vanilla = 9) — owed to M1. Suite 388/11970 →
**401/12287**; standing rows unmoved. Also this session: the launcher
`~/bin/wsl-launch-claude.sh` gained `-C <tree>` (the runner cds + asserts; a
cd-less `-d` is refused).

**⛓⛓⛓ M1 BLESSED 2026-08-29 — main `74ffc42c4`; `PeerInfinity/seedling-wasm` main
`6881786` = `seedling_bot_ap_p4d` BESIDE p4c (wasm md5 `5191141925d71b54662e8aa2ea4b6c63`;
`check-seedling-wasm-pins` ALL PASS, 3 builds, four views).** Slices M1 (§17.3, traps
960–969) + M1b (§17.4, traps 970–975). W5-0 confirmed a STRING property reports on the
bridge (declaration order, change-only ⇒ the `<seq>|` prefix). AS3 on the fork's branch
`ap-m1` @ `a0ec864` (5 files, +282: `pendingExit` pre-swap door report, 4-field
`pendingCheck` from `Game.setPersistence` — CLEARED is `false`, not `true` —
`keyMask`/`totemCount` getters, `Pickups/APItem.as` with 21 `@look` sprites incl. the
AP logo from `data/icon.png`, MIT); host H3–H6 (`seedlingCheckBinding` keyed on the
placement TABLE, the departure mark, the "found X for Player Y" readout), the
`levelSetDisagreement` hoist (a static import cost the bundle 1 MB), the `botLoadLevels`
`pending` contract. A CONTROL build priced mxmlc non-reproducibility (47 B at identical
source). **Both runtime seams OBSERVED on real-GPU Windows Chrome (`--win`, gate 81/81
×3)** — M1's first "unobserved" was headless SwiftShader at ~0.45 fps reading a 3-frame
fade as a dead world (⚖ user: wasm gates run on Windows Chrome, NEVER headless —
`seedling-bot.md` § Always pass `--win`); the byte-inert sweep = **149 tapes, 0 FAIL,
2h07m** (129,211 recorded ticks unmoved). ⚠ The submodule push was first REJECTED
("email privacy") — the worktree's submodule clone lacked the repo-local identity;
amended (`65a0e0e6` → `6881786`, tree identical). Standing rows unmoved (231/66/226/21).

**OPEN AFTER THE BLESS:** nothing in PRODUCTION wires the delivery or the check binding
yet (the next slice's first question); p4d-as-DEFAULT (53 files/69 lines) is a separate
⚖; the p4c ABSENT/PRESENT arms still run LOCAL (mechanical move to `--win`); Ruffle via
the step-2 injected SWF (low); the Windows-driven `check-seedling-generated-set`/
`-vanilla-manifest` owed a real run; `pendingArrival`'s latent age/level order; the
bot's persistence declaration is a host-visible check; `check-atlas-sphere-roundtrip
--help` writes a file; AS3 `ap-m1` unpushed on the fork.

**M1 AS IT WAS SCHEDULED:** kickoff `editor-integration-sliceM1-prompt.md`
(W5-0 de-risk → AS3 5 files + `Pickups/APItem.as` on `~/CC/seedling` branch
`ap-m1` → H3–H6 + the watchWasm one-liner + the `levelSetDisagreement` hoist →
control build → `seedling_bot_ap_p4d` BESIDE p4c → flags-off byte-inert → the
randomization gate → ⚠ the USER's submodule push + gitlink bump); the
Windows-driven `check-seedling-generated-set`/`-vanilla-manifest` (0-moved by
reach, owed a real run on the Windows box); the engine residue below.

**OPEN, in ⚖ (B′) order:** (1) **B-b** — `editCore`'s NO-CELL-SPACE widening
(`bounds`/`readCell`/`writeOps` an optional trio; cell tools refuse by name;
law 7 SKIPPED by name) + the bounce editor on a session (eight ops incl.
`replace-level` for regenerate; `createEditSession` forwards the adapter's
`value` — trap 857; `check-region-step-editing.mjs` IMPORTS `buildEditedRegion`
instead of copying it; Phase G′ on `check-sphere-steps-ui`) — kickoff
`editor-integration-sliceBb-prompt.md`; (2) **B-c** — the APWorld editor
session (~18 ops, renames as `group`s, no canvas; the second cell-less
adapter); (3) **M1** — the AS3 seam: W5-0 de-risk first (`Main.levelSetReset`
as a string property), H3 (`pendingExit` arm in `seedlingRegionBinding`) + H4
(`games/seedling.json`), the 3-file AS3 diff (§11.2), `seedling_bot_ap_p4d`
BESIDE p4c, §11.4's ladder (control build, edit build, flags-off byte-inert
over every fixture, wasm pin gates) — ⚠ the submodule push + gitlink bump are
THE USER'S; needs a free box ~2 h.

**Residue, by name — for whoever owns the next ENGINE slice:** a STORED
entrance side on the sphere tree node (`swap-exit-sides` over a back-exit is
unrepresentable while the entrance side is DERIVED — §14.1); `reportOver`'s
`locations` row false-warns on a world (§10.1, per-part rows cover it); W4's
§10.9 five (no world `set-record` envelope; `add-room` has no control on a
world strip; `worldDoorRows` re-derives per record; Seedling bindings are a
second spelling of `watchSetEditor.js`'s privates; one `message` listener per
Seedling room open); the `deps: {}`-outvotes-the-world mount seam (fixed —
gotcha-worthy); `editorView` NOT mounted for the marking tool (drag protocol +
`circle`/`label` shape kinds — §13.9); `exit_tiles` membership has no atomic op.
Arc-level lessons recorded in memory: every rebase across a doc edit conflicts
ONLY in generated files/regions (regenerate, never hand-pick); assert
`rebase-merge` absent + commit count before any ff; ff from the primary tree;
a push of `main` spawns a new CI run so `--only=suite` answers KEEP (read the
VERB); browser gates take the BOX LOCK.

**⛓⛓⛓ ARC CLOSED 2026-08-31 (session 3, `editor-integration-planning-3`, Fable)
— main `9fe3bc4a4`, suite 413/12528 quoted from CI at eb7593655;
`PeerInfinity/seedling-wasm` main `e645f2e54`.** The header of this entry is
superseded: the arc is DONE. What landed after the 2026-08-28 refresh, in
merge order: **M1/M1b** (the randomizer PLAYABLE — `APItem`, the check + door
seams, `seedling_bot_ap_p4d` blessed with the 150-tape byte-inert sweep on
`--win`; as-built §17.3–§17.4) · **P1** (the randomizer WIRED IN PRODUCTION,
DETECTED FROM DATA — no opt-in flag: eligibility over the preset's
`flash_panel.wasm`, the build's `capabilities` in the wasm manifest, the
goal-ledger join (playthrough by name 41/41, stage-1 by AP id 40/41, atlas
ineligible by its own data), and the source documents; computed-specifier
lazy import (+265 B where a literal dynamic import costs MORE than a static
one); overlay → deliver → reset-to-the-set's-start → bind; the "found X for
Player Y" readout — whose publisher had NEVER been registered since M1, the
first of two defects only production wiring could expose, the second being
the reset parking the player inside `tree@0,0`; merged as a MERGE COMMIT by
⚖; §17.5) · **P2** (p4d THE DEFAULT everywhere — a DEFAULT MOVE, not a
retirement: p4b stays as the no-`arm` control, p4c as the no-`apitem`
control, both now gated by capability-keyed pins rows (f)/(g) rather than
prose; P3 folded — the roster arms on `--win` with the channel-asymmetric
`runArmsLocal` gap found and fixed; the two verifiers red-since-P1 behind a
`continue-on-error` caller revived; §17.6) · **P4** (the residue slice: the
manifest's `capabilities` gains `arm` measured from the wasm payloads by
`strings`; the ⚖ MANIFEST-PROSE EXEMPTION ruled, written OUTSIDE the gate it
excuses, and exercised — the owed gate discharged by re-quote at the merged
head, no drive; the LOCAL fallback driven 81/0; `oneSpelling`'s row 26.7 →
3.5 s; §17.7). ⚖ 70 (f) for P1's gitlink was DISCHARGED ON A MEASUREMENT
first: one full-tier drive at the merged head, ALL CHECKS PASSED, composite
3633/0/46, category parts campaign 616/0/3 · map-walk 449/0/0 · mechanic
2194/0/0. Standing rows at close: maze-lab 231 · hosting 66 · -arm 226 ·
-edit 71 · pins ALL PASS (f)+(g) · procgen-help 265/0 · full-tier-owed 5/0 ·
reference 21/0. Traps 980–986, 999–1003, 1010–1014, 1021.
DEFERRED BY NAME (the next planning session's queue): the `main()` refactor
of `check-seedling-ap-placement.mjs` (a top-level-await script; baseline
entry carries the debt); Ruffle parity; the producing-side `flash_panel`
emission (the seed-1 block is HAND-ADDED and PROVISIONAL by ⚖ — a regen
drops it); the pin gate's spelling widening (three p4d references it cannot
see, worst `regionAtlasCompiler.js:169` — the only CODE source of the
presets' wiring); the `oneSpelling` production-side memo. The queue's next
major item is the PLATFORMER SUBSTRATE (`project_platformer_substrate_arc`).

**⇒ THE EDITOR'S DEMO-CATALOGUE ENTRIES — DONE 2026-08-31 (Opus, `main` @`082229c64` + this docs commit; 3 commits).**
The editor arm shipped and closed with **no entries in the demo catalogue at
all**; it has six now, `22 → 28` real entries (+1 prose, unchanged). ⚠ **The
brief's § pointer was wrong and the correction matters for the feature menu:**
`watch.html?source=edit` is **§5h**'s (the Seedling EDITOR v3 arc, closed
2026-08-26) — §5i is the editor-INTEGRATION arc (the world editor on
`lab.html`, the AP randomizer). The entries were scoped off §5h's shipped list
and off `check-seedling-editor-arm.mjs`'s own 32 claims.

**The six** (`frontend/modules/procgenDocs/demos.js`; ⛔ nothing else needed
editing — not `demos.html`, not `demos.md`, not the row): **24 `edit-arm`** the
FIFTH SOURCE, a room with NO LADDER (`base.level == 14`) · **25
`edit-room-flags`** the whole-room properties and the reach bound MEASURED per
room, six of seven changing nothing the JS model can certify (`flags includes
"snow"`) · **26 `edit-base-refused`** `?level=999` refused BY NAME with the
atlas's own size (`status == "refused"`) · **27 `edit-vanilla-set`** ONE PRESS
builds the VANILLA 116 as an OPENABLE `xml` set — the committed one is all
`embed` (`set.openable == 116`) · **28 `edit-handover`** ⚖ ruling 9's own
demonstration, *"open in editor"* (`baseKind == "generate"`) · **29
`maze-edit-arm`** the same `editCore` op log on a second substrate, where
editing DROPS the certification (`source == "edit"`).

**⛔ ⚖ RULING 9 SHAPES THE WHOLE SLICE.** The URL carries no edits, so an editor
entry cannot name an edited room the way a generate entry names a generated
one: three of the six are `press` rows, and all five `watch.html` entries name
their own `readout: '__editorEdit'` (the arm publishes a different object from
GENERATE's, and the row's ladder wait would time out on it).

**⛓ FINDING — THE EDIT ARM HAS NO URL WRITER, AND ONE WAS DELIBERATELY NOT
ADDED.** *Never hand-spell a URL* exists because `writeGenerateParams` /
`writeLabParams` encode DECISIONS (bounds short names, `require` lists, `run=1`
at step > 0) a typed string gets wrong. This arm's vocabulary is `source` +
`level` with nothing to decide, and the PAGE spells its own bar with plain
`URLSearchParams.set` in three places (`switchArm`, `hostLoad`, the preset
picker). A writer used by nobody but the catalogue would be a FOURTH spelling —
the drift the rule exists to prevent. The three `url:`s were emitted by that
same construction in node; ⛓ the `?tapes=`/`?tape=` entries (22/23) are
authored the same way for the same reason. Recorded in the catalogue's block
comment so the next author does not re-open it.

**⛔⛓ DEFECT FOUND BY DRIVING, AND IT IS A GENERAL ONE — 0/3 vs 3/3 MEASURED.**
The demos row's press pre-condition is *"the control exists and is not
disabled"*. For a control the ARM WIRES AT MOUNT that is **not** *"takeable"*:
`#editLoadVanilla` is present and ENABLED in static HTML while `runEditor` is
still awaiting its six documents. A bare `press: '#editLoadVanilla'` clicked a
dead button **0 of 3** times (the readout was still `undefined` at the press),
and `#editOnly:not([hidden]) #editLoadVanilla` also **0 of 3** — the panel is
UNHIDDEN before the handlers exist. Both presses are therefore gated in the
PAGE'S OWN disabled-state vocabulary, `body:has(#genEditSolve:not(:disabled))
…`, whose condition is `busyNow || !state?.record` — exactly *"this arm has
mounted and holds a record"*, and on the generate page exactly *"the ladder has
finished"*, which `#genOpenEditor` needs before it will hand anything over:
**3 of 3**. ⛔ No row change was made: the ENTRY declares what must be true,
which is where the knowledge belongs. ⚠ The generate-side press succeeded even
un-gated in a hand probe, and the in-page rAF timing says why that is luck —
`onclick` lands at 1256 ms and the ladder finishes at 1423 ms, a 167 ms window
in which the handler exists and refuses.

**⛓ FIVE GLOSSARY TERMS SPENT (159 → 164)**, because an entry naming an
undefined slug renders a dead literal and reds the unit row: `edit-arm`,
`base`, `edit-op`, `level-set`, `room-flag`. ⛔ `base` and `edit-op` are
`procgenCore/editCore.js`'s and are true of the maze, region and APWorld
editors too — filed ONCE with a detail that says so. **And one correction:**
`arm` said *"the watch page's FOUR jobs"* and listed four `?source=` values;
EDIT has been the fifth since slice C1.

**Pins moved, all in the files' own comment style:** `demos.test.js`
`toHaveLength(22)` → **28** · its NON-ZERO-EXIT population 1 → **2**
(`edit-base-refused` declares exit **2**: `export-seedling-view.mjs` relays the
page's refusal verbatim and writes nothing — still a LITERAL LIST, because a
count would tolerate any two) · a new `press` shape assertion beside
`control`'s, deliberately NOT pinned to `^[#.]` · `glossary.test.js` 159 → 164
in three places · `lint-gate-labels.allow.json`'s two glossary keys RE-KEYED by
hand, ⛔ not by `--write-allow` (the finding is pre-existing and only its label
moved; regenerating would silently launder anything new). ⛓ The procgen
reference generator's `--check` is byte-identical — no `docsIndex.js`
regeneration was owed, because nothing under `docs/` was touched.

**Gates.** `check-procgen-demos.mjs` bare: **252/0 ALL CHECKS PASSED** (204/0 before; ⚠ STANDALONE, so every `cli` row RAN — under a battery the three roster-gate rows dedupe). The six new rows cost `export-seedling-view` 2.4 s + 2.2 s + 12.0 s, `-arm` 64.1 s + 63.7 s and `maze-lab` 59.0 s. Then ONE
`standing-values.mjs --write` at the records head `95603e266` — the re-bank the
docs-page session before this one deliberately left (33 MOVED / 1 unmoved of 34
keyed rows at `c1ebe4d96`; this slice moved the same keys again and `--keys`
read the same 33/1 at `95603e266`). **68 min, 66 rows, 49 cheap, 17 quoted, 1
HELD by hysteresis** (`gate: maze-lab` 65.3 s inside the ±10 % band — trap 735
again). ⛓ **Row set UNCHANGED** — no new row, no row gone, **ZERO `cheap`
movers**. **TWO value movers:**

 · `gate: procgen-demos` **204/0 → 252/0** — predicted, and this slice's own.
   ⚠ It cost 95.1 → **107.2 s** for six entries: three cite roster gates
   (`-arm` ×2, `maze-lab`) and DEDUPE under a battery — this is that dedup
   working, since a standalone run of the same catalogue paid 187 s for those
   three rows.
 · `gate: slice-records` **71/0/33 → 72/1/37, exit 1 — ⛔ RED, AND IT IS NOT
   THIS SLICE'S.** *"SG2: the tracked doc has a heading at :13783 and the queue
   has NO `**⇒ ` block."* PROVED by a control arm rather than asserted: with the
   queue doc restored to `082229c64` (this session's tree one commit before the
   as-built was appended) the gate fails with **the same single check and the
   same 33-slice roster**. It is SG2's close (2026-08-30, `c66eeac18`) — whose
   record went into the TRACKED doc as `### R9 slice SG2` and never got a queue
   `**⇒ ` block — and it surfaced now only because this is the first `--write`
   since. ⛓ Banked honestly (`exit: 1`, `total: "1 CHECK(S) FAILED"`) rather
   than papered over; **the fix is authoring SG2's queue block and belongs to
   whoever owns that record**, not to a catalogue slice.

⚠ Three rows were QUOTED rather than driven and each names its own head:
`suite: vitest (unfiltered)` 413/12528 and `roster: --win --tier=full`
150 tapes 3259/0/3 (both @`eb7593655`), and `gate: seedling-producer-boundaries`
19/0 @`34c74aecc` on an UNMOVED key. ⛓ `gate: seedling-wasm-pins` re-ran cheap
and its `total` is still *ALL PASS — 3 pinned builds, four views in agreement*;
its `0/0` value is that row's own shape and did not move.

## 5j. The WORLDGEN WRITERS REVIEW — DONE 2026-08-30 (arc opened and closed in one Fable session, every step user-approved; plan file `NewDocs/plans/worldgen-writers-review.md`, gitignored)

**The ruling.** "Most of the worldgen files shouldn't be in the repository at all." Measured at
`32a14e885`: 61 tracked `worlds/*_worldgen` (+7 `_worldgen2`), 894 files, 14 MB, all last
touched 2026-07-07; 244 tracked `frontend/presets/*_worldgen` files, 16 MB; pytest collected 58
of them and nothing in push-triggered CI *needed* any. Kept: the fork-original set (no UPSTREAM
sibling — `worlds/<x>` merely existing is the wrong test; check who authored it) plus alttp —
**14**: alttp, alttp_vanilla, apcalc, bakingadventure(+_vanilla), bounce, codingadventure(+_vanilla),
depgraph, metamath, runner, runner_sphere, toem_original, toem_rule_builder. Everything else's
worldgen variant is transient.

**How it landed (main `ee0f6df13`, tag `presets-2026-08-30`).** The deletion is the *workflow's*
job, never a manual `git rm`: a baseline `generate-presets` run first (33319335021, before any
change), then `a3055b09c` `worldgen_generation_whitelist` in `scripts/data/template-exclude-list.json`
(`list-template-files.py --include`, one line in `generate_all_templates.sh`; `generate_worldgen2`
default false), then run 33323466249 in `merge` mode → 11 kept worlds regenerated byte-identical,
57 world dirs + 75 preset dirs deleted → tag → `git merge --squash` → `apply-post-preset-merge.sh`
(now restores `worlds/<id>` too, and the preserved list carries all 21 hand-made preset dirs,
`d6fdc6f39`) → `build-world-mapping.py` (163 → 110 rows) → the user reviewed the STAGED tree →
one commit. `unittests` green at every push. One `merge` run suffices when the zombie check is
0 (checklist §2.2, `b4eb14e73`).

**Defects the review found.** (1) The exporter's preset copy swept `output/` by seed *prefix*: a
4-player multiworld at seed 1 shares `AP_14089154938208861744` with every single-player seed-1
preset, so its stale `_P1..P4_rules.json` were copied into 148 preset dirs on the baseline run —
`69123ecb4` takes this generation's artifacts BY NAME (unit test, mutant 4/6, driven). (2)
`test-all-sequential` worldgen mode had no generation step, so it would have tested 14 games:
`c75876f86` + `cd330679b` + `6e89e364d` + `5e4cf1e19` generate the non-whitelisted worlds
transiently in `setup-branch` (artifact, 5 downloads; three fixes to get there: the setup job's
venv was apworld-gated, `Players/Templates` is gitignored, and `host.yaml skip_required_files` —
the romless switch — must be set before generating, each one invisible to a warm-tree dry run) —
smokes: original 78/78, worldgen **55/55 worlds built, 61 on disk, 58/58 games passed**
(run 33328451150). (3) `ladx_worldgen`'s conftest
park dropped; `test-frozen-install` packs `alttp_worldgen` (`4df2123aa`).

**⚖ Left as is, by ruling.** The seed-1 `seedling` preset's hand-added `flash_panel` block is a
TESTING wiring, not official — the regen was right to drop it; it is kept by hand in `ee0f6df13`;
the eventual fix is on the producing side. No new `.gitignore` lines; the transient gate worlds
(atlas_sphere, region_library_*, jta_loctest_roundtrip) untouched; `clean_existing` untouched —
the preserved list + restore IS the solution. Open: `docs/json/developer/diffs/file-lists/*.md`
still say 61 (regenerated at release).

## 5k. The STANDING-VALUES CI arc — PLANNED 2026-09-01, ⚖ 72 RULED 2026-09-01 (Fable planning session; plan file `NewDocs/plans/standing-values-ci-and-parallelism-plan.md`, gitignored; S1 SHIPPED 2026-09-01 `ad5aef2b0`, S2 SHIPPED 2026-09-01 `e6c84a6f8` + the owed write `5e42d4104`, S3 SHIPPED 2026-09-01 `9f46b2bfd`…`765ea79fa`, S4 SHIPPED 2026-09-01 `91c26b690`…`4a99828ec` — SIX ROWS QUOTE CI; S4b SHIPPED 2026-09-01 `0f9e0cf27`…`3eceb7d18` — all three loose ends closed; S5 SHIPPED 2026-09-01 `def23822a`…`e5c19cece` — the FULL `procgen-help` claim leaves the box, the `@ci-face` RETIRED and `¬ciFace` untouched, battery 46.8 → 38.8 min; **S5b SHIPPED 2026-09-01 `a1ee8275b`…`13dc57a1e` — the partition prices in the RUNNER'S OWN seconds, browser wall 23 m 01 s → 15 m 20 s in TWO shards, trap 1068 closed**; S5c SHIPPED 2026-09-02 `6768e1bec` — the `--write` partition audit; **S4c SHIPPED 2026-09-02 `0e7454b67`…`43c70162b` — the identity digests are PORTABLE (a runner reproduced all six md5s), CI publishes 26 identity lines, ⚖ 72 (b) met over FOUR runs, battery 38.8 → 19.8 min**; the ladder is EXHAUSTED — what is left is the ⚖ economics question S4c raised)

**The question (user):** *"At some point I'll want to check why the battery takes so long. Can it
be moved to CI? Can parts of it run in parallel?"* All numbers re-derived at `dde883de9`, none
inherited: 66 rows, 64 with `ms`, 4,049.2 s = 67.5 min (the two ms-less rows are `suite: vitest
(unfiltered)` — ⚖ 52, CI's — and `roster: --win --tier=full` — ⚖ 70's composite); ten rows are
75 %; only ~10.9 min is Windows-bound (the 4 `py.exe` gates + `identity: generated set`); all 23
browser gates are banked green from headless-WSL Chromium, so the wasm-on-Windows law
(tape playback) does not bar them from a Linux runner.

**The finding that reorders everything: ⚖ 71's key mechanism self-invalidates.** Measured:
`scripts/procgen/standing-values.json` is a member of the `data` population of **30 of 33 keyed
rows** (it enters via SG2's named-directory rule, not any code literal), so the commit that banks
a write moves the keys — `--keys` at `dde883de9` reads **31 MOVED / 3 unmoved**, and the 68-min
write of 2026-08-31 (TWO value movers) re-drove a tree nothing substantive had moved under. SG2's
measured ≈2/34 steady state has never materialised. Separately the 28 identity/producer rows are
UNKEYED by a "cost seconds" premise that is false by ~16 min (they sum to ~18 min, paid on every
`--write`). Also stale, three places: "four of thirty-one are headless" (workflow, `ci-gates.mjs`,
`standingValues.js`) — the roster is 33 with **6** headless, and the code already runs all 6.

**⚖ 72 (RULED — see the RULING block below; the request as put is kept verbatim):** when CI runs a gate, does CI write the bank, or does the bank quote CI?
Plan recommends **the bank quotes CI** (⚖ 52's pattern; `ciSourced()` is armed and selects zero
rows today; the KEEP branch already handles unpushed heads) — CI-writes loses on the key cascade,
runner races, `ms`/`cheap` banding poisoned by environment, and bot commits to main. Sub-items:
(a) Windows rows stay box-measured; (b) stability bar = 3 consecutive CI runs matching the banked
verdict sets before a row flips; (c) S1's population change (the bank leaves derived `data`
populations; `full-tier-owed` + `slice-records` declare it back via `@key-inputs`) gets the
user's nod. ⛔ P4b (D) stands: a `@ci-face` gate is never CI-sourced — `procgen-help`'s 417 s
leaves the box only by teaching CI the FULL claim first (S5), never by loosening the refusal.

**⚖ 72 RULED (user, 2026-09-01): THE BANK QUOTES CI.** All three sub-items ruled as the plan
proposed — **(a)** the Windows rows stay box-measured; **(b)** the stability bar is THREE
consecutive CI runs whose verdict sets equal the banked values before a row flips to CI-sourced
(SG1's own bar); **(c)** S1's population change is approved — the bank leaves the derived `data`
populations and the two gates whose SUBJECT is the bank declare it back via `@key-inputs`.

⛓ THE DECIDING ARGUMENT WAS OBJECTION (3), NOT THE KEY CASCADE. The cascade is real but S1 shrinks
it and it is a cost, not a corruption; `ms`-under-CI is the one that damages a FIELD. `cheap` is a
60 s ± 10 % hysteresis band, so under CI-writes it would be re-banded by WHICH RUNNER ANSWERED
rather than by anything in the tree — trap 735's field-flapping shape, arriving through the door
that ruling closed. A field whose whole job is to say *"this row is cheap to re-run"* must not be a
function of the environment that ran it.

⚠ AND THE COST OF (B) IS ACCEPTED WITH IT, NAMED HERE SO NOBODY REDISCOVERS IT AS A DEFECT: a
CI-sourced row is only as fresh as the last PUSHED head, so local work sits on a quoted value until
a push. `suite: vitest (unfiltered)` has behaved exactly this way since ⚖ 52 (its bank entry today
reads `quoted: true`, `measuredAt: eb7593655`, with the reason attached), and that is the precedent
the ruling extends rather than a new hazard.

**⚖ 72 (b) AMENDED (user, 2026-09-01, on S3's measurement): THE BAR IS PER ROW.** As ruled it
read *"three consecutive CI runs whose verdict sets equal the banked values"* — a RUN-level test,
written before anyone knew that two rows disagree with the bank in CI at EVERY head and always
will. `seedling-full-tier-owed` (ci 2/0/1 vs bank 5/0) and `slice-records` (ci 42/24 vs bank
73/0/37) both read the depth-1 clone `actions/checkout` makes (trap 1058), which is a fact about
the CHECKOUT, not about the tree. ⛔ Under the run-level reading those two hold the other 26 rows
hostage forever and no row could ever flip. The bar is therefore **three consecutive runs in which
THAT ROW reads `same`**, counted by `ci-summary --gates` (S3's instrument, which prints the
per-row verdict and says in its own footer that the exit code is the run-level answer and not the
bar).

⛓ THE AMENDMENT DOES NOT WEAKEN THE BAR, and the first row to test it proves so: 23 of the 24 CI
arms had four consecutive `same` at S3's close, and the 24th — `preset-bundle-load`, ci 9/1 against
a banked 10/0, a `userloaded:` scheme page-error race once in four runs of its shard — restarted
its streak and is held back. A run-level bar would have blocked all 24 on those two structural
rows; the per-row bar blocked exactly the one row that deserved blocking.

**⇒ S5c SHIPPED (2026-09-02, `main` @`6768e1bec`; 2 commits): THE AUDIT RUNS.** ⚖ The user, after
S5b: *"let's implement the local variant."* `standing-values --write` now audits the last successful
CI run's shard partition and prints the verdict — the guard S5b built and left manual.

⛔ **THE CI VARIANT WAS COSTED FIRST AND REJECTED FOR NOW, on two counts.** (1) It needs an
`actions: read` `permissions:` block `unittests_frontend.yml` does not have — workflow-wide, first
honest test in production. (2) The deciding one: a CI job can only audit the PREVIOUS run, so the
push that CHANGES a partition audits the pre-change one and **the guard reds on its own repair**;
and the obvious mitigation (audit only when the plan identity matches) goes silent exactly when the
plan changes and the risk is highest. ⚠ Named cost of the local variant, accepted: CADENCE — a
regression can live between writes. ⛓ Recorded in `lastRunShardAudit`'s docblock so the next reader
inherits the trade rather than the conclusion.

⛔ It never touches the write's EXIT CODE (the write's verdict is about the BANK; a bank commit must
not be hostage to a runner, ⚖ 72) and it never skips QUIETLY — `gh` unauthenticated, no successful
run, unreadable logs, a run with no `ms |` lines each return `available: false` WITH the reason and
print it, because a quiet skip reads exactly like a healthy partition.

⛓ Driven, not argued: two mutants, each reddening exactly ONE row of 50 (the unavailable path
returning green; the audit taking `budgetMs: Infinity`), both restored byte-identical. ⛔ AND a real
one-row `--write`, because six green unit rows would ALL still pass with the call site in an
unreachable branch — the helper-that-is-never-invoked shape. It printed *"the last CI run's shard
partition HELD — run 33575117635 @8a386aea8, 3 job(s)"*. vitest 30 files / 584.

**⇒ S4b QUEUED (2026-09-01, the three loose ends S1–S3 named and did not own).** Small, box-light,
one session, after S4:
· **(1) CHARACTERISE the `preset-bundle-load` flake** — one occurrence is not a characterisation
  (`feedback_flaky_read_as_order_dependent`: run it ALONE 8×). It is 21.7 s banked, so eight runs
  is ~3 min of box. Until it is characterised it stays out of the CI-sourced set.
· **(2) `slice-records` SHOULD REFUSE BY NAME IN A SHALLOW CLONE, not go red.**
  `check-seedling-full-tier-owed.mjs:313` already does exactly this and is the model named in trap
  1058; `slice-records` instead reads the shallow clone's own HEAD as the convention's start commit
  and reports 42/24. ⛔ A gate that cannot ask its question must say so, not answer wrongly.
  ⚠⚠ **THIS BULLET UNDERSTATED IT AND S4b MEASURED THE REST — the shallow defect is THREE
  mechanisms, not the boundary alone**, reproduced in a real depth-1 clone: (a) the convention
  boundary collapses onto HEAD (the one written here); (b) ⚖ 22 then reads the graft's
  `--name-only`, which for a ROOT commit is the WHOLE TREE, so all 33 headings "carry the docsIndex
  regen" and pass for a reason unrelated to their own commits; (c) the trap citations VANISH — a
  `git show` of the graft exceeds the reader's 64 MB buffer, the diff returns empty, and check (3)
  contributes NO ROWS AT ALL. ⛓ A silent zero, in the file whose docblock exists to refuse silent
  zeros. ⇒ (b) and (c) are why the repair could not be "widen the boundary": two of the three
  produced FALSE GREEN, not red.
· **(3) TRAP 1057's LATENT HALF** — the undrained `fetch` body that killed Node 22's undici in
  `check-seedling-wasm-element`'s liveness probe is a PATTERN, and S3's negative control measured
  the nine sibling gates at 0/40 only because their probe body is 26 KB. ⛓ The box's Node has been
  hiding this for months. Drain them (or pin the runner's Node deliberately) before the next Node
  bump makes it nine reds at once.

**Ladder (cheapest-first; trap-1047 checked — the cheap `ciSourced` widening consumes S3's CI
lines, so consumption is ordered after production + the stability bar):** **S1** bank out of its
own keys (mutant: touch the bank → exactly 2 rows MOVED, was 30; one full-freight write owed at
S1's head, the last such) → **S2** key the identity/producer rows (~18 min off unmoved-closure
writes; shared-entry rows share a key, correctly) → **S3** CI runs the browser gates (matrix
partitioned by banked ms, interpolated never written; `gates.mjs`-style battery so SG1's demos
dedup applies; `## CI-GATE |` lines; `ciSummary.js` + refusal text + the three stale comments in
the same slice; wasm-element's first run IS the runner-headroom measurement, abort >2.5× banked
or flaky; WATCH the run — `feedback_ci_fix_untested_environment`) → **S4** widen `ciSourced` to
the CI-answerable set, ciFace clause untouched → **S5** (optional) `procgen-help --doors=all
--in-place` in CI ×3, retire the face in the same change. NOT doing: local parallel runner (box
lock is right; STARVED), `windows-latest` probe (WSL driver path, software rendering, ≤11 min
upside vs a 17-push CI-iteration precedent), CI-writes-the-bank. Projected steady state after
S1–S4: box worst case ~68 → ~11 min (Windows rows), wasm re-drives absorbed by CI in parallel.

**⇒ S1 SHIPPED 2026-09-01 (`ad5aef2b0`) — THE BANK IS OUT OF ITS OWN KEY POPULATIONS; 31 → 2 rows
MOVED, MEASURED BOTH SIDES OF THE FIX.**

⛓ **The number in the plan was 30 of 33 and it is 31 of 34.** Re-measured here rather than
inherited (the launching session had confirmed 31 MOVED / 3 unmoved but not the population
figure): at `2f46ba941`, `--keys --json` run clean and again with one byte appended to the bank,
every row's `inputKey` diffed — **31 of the 34 keyed rows** carried
`scripts/procgen/standing-values.json` in their `data` population. The three that did not are
`seedling-producer-boundaries`, `seedling-rerecord-rehearsal`, `seedling-wasm-pins` — exactly the
three that read `unmoved` against the bank, which is the same fact from the other side. (65 rows
total, 31 unkeyable ⇒ 34 keyed, not 33.)

⛓ **HOW it got in, measured, not assumed.** Of the 31, only **2** have any file in their code
closure that spells the path (`standingValues.js`'s own `FILE`; `sliceRecords.js`'s
`STANDING_VALUES`) — and those two are precisely the rows whose SUBJECT is the bank. The other
**29** arrive purely through SG2's named-directory-one-level rule off `gateRoster.js`'s
`'scripts/procgen'` literal. So the plan's "a grep exonerates the wrong suspect" is right for 29
rows and inverted for 2, and the 2 are the declarers.

**Built:** `rowInputKey.DERIVED_DATA_EXCLUDED` = `standingValues.FILE`, applied through one
`addData()` guard to all four derived data rules (stem, path literal, `.md` literal, directory
literal). ⛔ It is an exclusion of ONE IMPORTED CONSTANT, not a hand list (⚖ 17) — the exempt file
is named by the module that writes it, so it cannot drift from what `--write` emits. ⛔ It is NOT
applied to the DECLARED set: `check-seedling-full-tier-owed` and `check-slice-records` each carry
`@key-inputs data: scripts/procgen/standing-values.json` in their docblocks with the reason, and
that declaration is what makes the exclusion safe instead of a stale green.

**The mutant pair, run BEFORE the fix as well so both baselines are this session's own:**

| mutant | pre-fix | post-fix |
|---|---|---|
| touch `standing-values.json` | **31 of 34 MOVED** | **2 MOVED** — `seedling-full-tier-owed`, `slice-records`, and nothing else |
| touch `frontend/modules/flashPanel/games/seedling.json` (a real data member of a wasm row) | 29 MOVED | **29 MOVED — the same 29 by name** (`diff` of the two lists is empty) |

The second row is the trap-1018 negative control and it is the half that matters: an exclusion
that had accidentally emptied the whole `data` population would have passed the first row
perfectly. `rowInputKey.test.js` carries both halves as stubs (+7 rows, 52 in the file), and it is
RED FIRST — against the pre-fix module exactly 2 of the 52 fail and the other 50, the controls
included, pass. `npx vitest run scripts/procgen` 27 files / 494 tests green (⚖ 52: bounded).
`check-seedling-full-tier-owed` ALL PASS; `check-slice-records` 73 VERIFIED / 0 / 37.

⚠⚠ **S1 ITSELF MOVES EVERY AFFECTED KEY ONCE, SO THE FIRST `--write` AFTER IT PAYS FULL FREIGHT
(~68 min) — AND THAT IS THE FIX WORKING, NOT FAILING.** The `data` digests move because the
POPULATION moved; there is no way to change what a key covers without moving the key. A reader who
finds a full-freight write in the log right after a slice whose whole point was to stop them would
otherwise read it as a failed fix. **That is the last such payment a docs-or-bank commit ever
causes.**

⛔ **THE RE-BANK WAS DELIBERATELY NOT SPENT IN THIS SLICE, AND THE REASON IS AN ARGUMENT, NOT
THRIFT: S2 WOULD MAKE IT OWED A SECOND TIME.** S2 keys the 28 identity/producer rows, which are
born with nothing banked and therefore all run on the first write after it — full freight again.
One write taken after **S2** discharges S1's key births and S2's in the same 68 minutes; a write
taken now buys two. ⇒ **the standing recommendation is: land S2, then take ONE `--write`.** The
box was free and nothing was queued behind this session, so this is a scheduling judgement rather
than a constraint. `--keys` is box-free and is what proves S1; a `--write` proves nothing S1
claims.

⛓ Until that write is taken, `--keys` will read ~31 MOVED against the bank — the banked keys were
computed under the OLD population and are not comparable to the new ones. That is expected and is
not evidence against the fix; the evidence is the two-mutant table above, which is a diff of keys
taken under the SAME rule.

**⇒ S2 SHIPPED 2026-09-01 (`e6c84a6f8`) — THE IDENTITY/PRODUCER ROWS ARE KEYED, AND THE ONE OWED
`--write` IS SPENT (`5e42d4104`). ⛓⛓ THE STEADY STATE ⚖ 71 PROMISED IN JULY EXISTS: `--keys`
AFTER THE BANK'S OWN COMMIT READS **2 MOVED, 62 UNMOVED**.**

⛓ **The premise the clause rested on was false by eighteen minutes.** `unkeyableReason` opened
with `row.kind !== 'gate'`, stating that the identity/producer rows "cost seconds; keying them
would buy a second failure mode for no time at all". Measured at `cf2af27ab` off the writer's own
banked `ms`: the 30 `kind: identity` rows sum to **1,078,564 ms = 18.0 min**, paid on EVERY
`--write` whatever the head moved. Four rows are 63 % of it (`carved pairs c4` 270.2 s,
`plan-seedling-r7-ends-meet --check` 221.5 s, `empty pairs c6` 154.5 s, `empty pairs c3` 96.0 s);
seven exceed 60 s. Nothing about a `kind` makes a row cheap — `cheap` is the field that answers
that question and it is MEASURED.

**Built:** the clause is dropped and `unkeyableReason` MOVES to `rowInputKey.js` as an exported
pure function, beside `rowRunDecision` and for its stated reason — a rule that lives inside a
68-minute writer can be interrogated by nothing cheaper than the battery. Entry is
`scriptIn(row.command)` exactly as for a gate row; the four populations, `--redrive-unchanged`,
`--rekey` and `--force-row=` all applied unchanged, with no other edit needed.

**THE BEFORE/AFTER `--keys` PAIR, TAKEN BY THIS SESSION, BOX-FREE:**

| reading | head | result |
|---|---|---|
| pre-fix | `cf2af27ab` | 34 keyed, **31 unkeyable** (30 identity + the CI-read suite row) |
| post-fix | `cf2af27ab` | 64 keyed (30 born with nothing banked), **1 unkeyable** |
| pre-write | `e6c84a6f8` | 31 MOVED, 3 unmoved, 30 with nothing banked, 1 unkeyable |
| ⛓⛓ **POST-WRITE, AFTER THE BANK COMMIT** | `5e42d4104` | ⛓ **2 MOVED, 62 unmoved, 0 with nothing banked, 1 unkeyable** |

The 2 are `seedling-full-tier-owed` and `slice-records` — the two rows that DECLARE the bank via
`@key-inputs`, moved by the bank commit they declare, and nothing else. **This is the first time
anyone has observed the ≈2-of-34 steady state SG2 measured in July and the mechanism never once
delivered; ~31 at this point would have meant S1+S2 did not work.** The one remaining unkeyed row
is `suite: vitest (unfiltered)`, now refused by the clause that always should have answered it
("its recipe already reads CI by SHA") rather than by a `kind`.

**THE MUTANTS — the brief said VERIFY the closure, not trust it, and it was right to.**

| mutant | measured |
|---|---|
| one line appended to `frontend/modules/procgenCore/skeletonKinds.js` (the kind tables) | **44 rows MOVED**, the three kind-pairs rows among them ⇒ `dump-seedling-kind-pairs.mjs`'s closure DOES reach the kind tables — and **20 unmoved**, which is the control |
| one line appended to THIS queue doc | **2 rows MOVED** (`procgen-help`, `slice-records` — both declare or read it) and **0 of the 30 new ones** ⇒ a docs-only head carries them |

⚠⚠ **SHARED ENTRIES: THREE GROUPS, NOT ONE, AND THE SHAPE IS OLDER THAN S2.** A key is a function
of the ENTRY FILE, not of the command line, so rows that run one script under different FLAGS get
IDENTICAL keys. The brief named one group; measured, there are three, covering eight rows:

```
dump-seedling-kind-pairs.mjs         empty pairs c3 · empty pairs c6 · carved pairs c4
census-seedling-killgate-clears.mjs  killgate s2 · killgate s5 · killgate s9
generate-seedling-level.mjs          level pre-sword s1 · level post-sword s1
```

⛓ **That is CORRECT, and it is not new.** Same entry ⇒ same closure ⇒ same data, so if one member
of a group is owed a re-drive all of them are — the conservative direction. And `gate:
seedling-editor-generate` and its own-server variant have shared a banked key since SG2, so S2
adds groups to a property the mechanism already had rather than introducing one. ⛓ S2 also makes
`identity: generated set` and `gate: seedling-generated-set` share a key — which is the duplicate
drive §6 parked as **S6 (a)**, now visible from the key side rather than only from the clock.
⛔ Do NOT "fix" the collision by hashing the command into the key: that would move three keys
every time anybody re-words a flag, buying re-drives for no change in bytes.

**THE WRITE, AND WHAT IT COST.** `standing-values --write` at `e6c84a6f8`, `setsid nohup`, PID
from the log, polled with `kill -0`: **65 rows, 62 driven / 3 quoted, 70.1 min of row time, exit
0** — no EXIT row, no nondeterminism finding. The 3 quotes are exactly the three rows that never
carried the bank (`producer-boundaries` @`34c74aecc`, `rerecord-rehearsal` and `wasm-pins`
@`95603e266c`). **ONE value moved and it is CI's:** `suite: vitest (unfiltered)` 413/12528 →
413/12566. Every gate and identity verdict is unchanged — which is what a 70-minute re-drive over
a tree nothing substantive moved under ought to read, and is the third such write in a row to say
so.

⛓ **Against the plan's projection, honestly:** this write does NOT test it. Its head is a SCRIPTS
head that moved `rowInputKey.js` and `standing-values.mjs`, files in nearly every closure, so full
freight was the correct price and both key births rode it. The projection is tested by the reading
that follows it, and that reading is the 2-MOVED row above. Priced off the new bank, the next
`--write` on a docs/plan-only head re-drives `seedling-full-tier-owed` (1.7 s) + `slice-records`
(30.8 s) + the CI read (4.3 s) ≈ **37 seconds**, not "low minutes". ⚠ With one caveat worth
having: a docs head that touches THIS queue doc also moves `procgen-help` (417 s), so that
particular flavour of docs commit costs ~7.5 min. The box's local battery now stands at **70.5 min
/ 65 timed rows** (up from 67.5 — the identity block re-measured at 21.5 min rather than 18.0, so
the standing saving is the larger number).

**Tests.** `rowInputKey.test.js` +10 rows (62 in the file). RED FIRST against a module carrying the
clause again: **4 fail / 58 pass** — the headline, two roster rows (`leaves NO identity row
unkeyable`; `still refuses the CI-read suite row`, which the old clause answered for the wrong
reason since the suite row is `kind: ci-suite`) and the shared-entry row, red because ONE shared
entry crosses kinds (`check-seedling-generated-set.mjs` carries both an identity and a gate row,
and the old clause split them). ⛓ The clauses that STAYED are asserted on GATE rows on purpose, so
they are green on both sides and the red set attributes to the one clause that moved. `npx vitest
run scripts/procgen` 27 files / **504 tests** green (⚖ 52, bounded).

⛓ **Three counts the brief carried are corrected by measurement, and the roster assertions are the
form that keeps them from going stale again** (this arc has now produced two wrong-and-green counts
— the plan's 30/33 and a test comment's "three catalogue entries" — and both survived because they
were PROSE):

1. The unkeyed population is **30 identity rows**, not the plan's 28.
2. The launching session's **32** is the BANK-side count and is right as such: it also holds
   `roster: --win --tier=full` (⚖ 70's composite, `alwaysQuoted`) and the suite row, neither of
   which carries an `ms` — so both figures are true of different populations and the 18.0 min is
   the 30 rows'.
3. The shared-entry groups are **three**, not one.

⛓ Two of the three are now PROPERTIES the suite re-derives from the live roster rather than
sentences: *no identity row is unkeyable* and *every row sharing an entry gets the same keyability
answer*, each guarded against vacuity by a non-empty assertion first (trap 824).

⇒ **S3 (CI runs the browser gates) was NEXT and is the big one** — production-first by construction
(`feedback_ci_fix_untested_environment`), its own session, nothing of it pulled forward here. ⛓ Its
as-built follows.

**⇒ S3 SHIPPED 2026-09-01 — CI RUNS THE BROWSER GATES. 24 ARMS, 3 MATRIX JOBS PARTITIONED
FROM THE BANK AT RUNTIME, EVERY VERDICT EQUAL TO THE BANKED VALUE, AND `seedling-wasm-element`
STAYS IN CI AT 0.96× ITS BANKED COST.** (`9f46b2bfd` … `765ea79fa`, PUSHED; six commits,
six CI runs watched — five pushes and one dispatch.)

⛓ **THE DERIVATION AGREES WITH THE BRIEF'S 23, AND THE ARM MAKES IT 24.** Re-derived here
from `gateRoster()`: 33 gates = **23 browser + 4 windows + 6 headless**, and
`check-seedling-editor-generate` declares an `@standing-variant` — so what CI runs is
**24 ARMS**, the own-server arm being a standing row like any other (⚖ editor v3 §26.7a:
224/0 under `--host=`, 230/0 on its own server; both now answered by CI).

**Built — the production side, in three pieces.**

1. **`ciGatePlan.js`** — the ONE place that answers *"can CI run this gate?"*
   (`ciRunnable` = `!gate.windows`: `ubuntu-latest` has headless Chromium and no
   `/mnt/c/Windows/py.exe`) and *"how do the arms partition across runners?"*
   (`planCiShards`, longest-first into **600 s of BANKED time**, read from the bank at
   runtime). ⛔ The matrix is PUBLISHED, never typed (⚖ 17): the plan job prints it and
   `fromJSON` interpolates it; each shard job recomputes the same plan and takes its
   slice by index. ⛓ **`seedling-wasm-element` getting a job to itself is a CONSEQUENCE
   of the budget rule, not a name typed into it** — and a row with NO banked `ms` is
   priced at the WHOLE budget, so a brand-new gate lands alone instead of silently making
   one shard the slow one.
2. **`ci-gates.mjs`** grows `--set=headless|browser|all`, `--shard=`, `--host=`, `--plan`.
   A browser selection **takes the box** and the gates it spawns pass through on the
   token — which is what makes it `gates.mjs`-equivalent machinery rather than 24
   standalone runs: SG1's demos dedup is licensed by `BOX.passthrough` alone. It joins
   `BOX_LOCK_HOLDERS` for the same reason the other four are named there. ⛓ The default
   invocation is UNCHANGED and measured so: the headless job's six lines are the same six
   keys and values.
3. **The workflow** — a plan job (no submodules, no `npm ci`, ~16 s) plus a matrix of
   shard jobs: checkout recursive, `npm ci`, the pinned-version Playwright cache,
   `node_modules/playwright/cli.js install chromium` (⛔ not `npx`, ⛔ no `--with-deps` —
   `seedling-wasm.yml` carries both measurements), a repo-root `python3 -m http.server`
   (`wasm-pages` asserts a true byte size, which a compressing server would move).
   `continue-on-error` on the gates step for 12g′'s reason; `fail-fast: false` because a
   cancelled sibling is a row with NO answer for that SHA — the one silence ⚖ 72 (b)'s
   bar cannot see; `timeout-minutes` 45/12/40 because a JOB timeout reports `cancelled`
   and names neither step nor cause.

**And the same-slice items, all four:** `ciSummary.js` reads the gate lines across EVERY
job of a run (`gateLogs`, with unreadable job logs NAMED, not swallowed); `ci-summary`'s
refusal is derived from `ciRunnable`, so the browser half is retired (those keys have
answers now) while ⚖ 72 (a)'s Windows half and P4b (D)'s `@ci-face` clause stand
untouched; and the three stale *"four of thirty-one are headless"* comments are replaced
**by pointers to the derivation rather than by corrected counts** — this arc has produced
four wrong-and-green counts now and every one of them was prose.

⚠ **ONE THING THE BRIEF DID NOT ASK FOR, AND WHY IT IS HERE: the trigger is widened to
`frontend/**`.** It is this workflow's own criterion applied a fifth time — the browser
gates' SUBJECT is the frontend tree (`demos.html`, the preset bundles, the lab pages, the
wasm submodule pointer), and `frontend/**/*.js` is narrower than what they READ. Without
it a head that moved a gate's subject without touching a `.js` gets no CI answer at all,
which is S4's KEEP branch freezing a row for a reason nobody can see. ⛔ Still true after
the widening, and named for S4: **a commit that touches only `scripts/procgen/standing-
values.json` or only `CC/docs/**` triggers NO run** — the bank's own commit and this queue
doc are both outside every path.

**THE RUNS, WATCHED — AND THE FIRST HONEST TEST WAS A PUSH, EXACTLY AS
`feedback_ci_fix_untested_environment` SAID.** Six runs, five pushes and one dispatch, and
the iteration count is not the story: **every push after the first was caused by a NAMED
finding, not by a guess.**

| # | run | head | what it answered |
|---|---|---|---|
| 1 | 33540085018 | `e37dd5ff9` | **23 of 24 arms `same` on the FIRST run**; `seedling-wasm-element` exit 1 at 0.4 s with **no evidence in the log** |
| 2 | 33540828822 | `d3a100d58` | the evidence echo names the cause on its first firing: `assert(!this.paused)` in undici |
| 3 | 33541690772 | `d49e8e880` | **24 of 24 `same`** — element 11/0 in 895.4 s. Bar reading #1 |
| 4 | 33543361446 | `5743f5944` | 24 of 24 `same`. Bar reading #2 |
| 5 | 33543380112 | `5743f5944` (dispatch) | 24 of 24 `same`. Bar reading #3 |
| 6 | 33543595675 | `765ea79fa` | 23 of 24 — `preset-bundle-load` 9/1, a FLAKE, and the bar caught it (below) |

⛓ **THE ABORT CRITERION IS NOT MET AND `seedling-wasm-element` STAYS IN CI.** The brief's
bar was *"> 2.5× banked, or flaky across two runs"*. Measured over FOUR runs:
**895.4 · 890.0 · 895.6 · 895.2 s against 934.7 s banked = 0.95–0.96×**, verdict 11/0
every time, job wall clock 15 m 17–21 s inside a 45-minute cap. It is not slow here and it
is not flaky here. ⛓⛓ **The runner is not the constraint anybody feared — it is about TWICE
THE BOX on the light rows**: shard 2 ran 168.2 s of arm time against 350.6 s banked,
shard 1 330.2 s against 597.9 s. The whole browser battery, 31.4 banked minutes on the
box, is **≈ 15 minutes of wall clock in CI and zero minutes of box.**

⛔⛔ **THE ONE RED WAS A REAL DEFECT AND IT WAS NOT ABOUT SPEED — TRAP 1057.**
`check-seedling-wasm-element.mjs`'s liveness probe is
`await fetch(WATCH).then((r) => r.ok)`, which leaves the response body UNREAD. On **Node
22's bundled undici** the socket then ends while the parser is paused and the process dies
on an internal `assert(!this.paused)` thrown from a socket callback — which no `try`/
`catch` around the fetch can see, and which takes the gate's buffered stdout with it.
Reproduced on this box after `nvm install 22.23.2` (the runner's exact version), with the
byte-identical stack, then MEASURED, 40 runs per arm:

| arm | crashed |
|---|---|
| the old form, 85 KB `watch.html` | **5 / 40** |
| GET + `await r.arrayBuffer()` (shipped) | 0 / 40 |
| `{ method: 'HEAD' }` | 0 / 40 |
| ⛓ the NINE sibling gates' form, 26 KB `index.json` | **0 / 40** |

The last row is the negative control and it decides the scope: the trigger is the body's
size against the socket's close, so the fix goes where the crash is and nine green gates
keep their keys. ⛔ It is LATENT for all of them — **the box runs Node 18 and the runner
Node 22, so a gate's environment includes its NODE VERSION**, and the day the box moves
they join it. (0/25 on Node 18 and on 23.11 — undici was fixed later — which is why the
reproduction needed the runner's *exact* version rather than "a recent Node".)

⛓ **AND THE FIX THAT FOUND IT IS ITSELF THE SLICE'S SECOND REPAIR:** the evidence echo
only knew `FAIL:`/`SKIP:` lines, so a gate that died BEFORE printing a verdict produced a
red with no evidence — the same lesson P3b wrote into this file for `full-tier-owed`,
arriving in its second costume. It now echoes the tail of whatever the gate did print when
there is no verdict line at all, and that echo named the undici bug on its first firing.

**⚖ 72 (b), MEASURED RATHER THAN EYEBALLED — AND THE BAR IS PER ROW.** Comparing 24 keys
by eye once per run is how a bar gets recorded as *"looked fine"*, so the comparison is an
instrument: **`ci-summary --gates`** prints one row per `## CI-GATE |` line at a SHA beside
the bank's value for the same key. ⛔ A line with NO bank row is `not-banked`, never a
match (a `@ci-face` key is a different, bounded claim); a banked arm with NO line is
`MISSING`, because a shard that never ran must read as an absent answer and not as a
smaller verdict set that agrees with itself. **`--run=<id>`** names one run, because a SHA
can carry more than one (a dispatch beside a push — measured) and the bar counts RUNS.

⛔⛔ **AND TWO HEADLESS ROWS ARE `MOVED` IN CI AT EVERY HEAD AND ALWAYS WILL BE — TRAP
1058.** Both are `actions/checkout`'s depth-1 clone, both predate this slice, and neither
is `ciSourced` today (both are `cheap`), so nothing consumes them:

- `gate: seedling-full-tier-owed` — `2/0/1` against `5/0`, and **it refuses BY NAME in its
  own printed line**: *"the campaign baseline … is not in this clone … the normal state in
  CI, where `actions/checkout` clones at depth 1."* That is the model.
- `gate: slice-records` — `42/24` exit 1 against `73/0/37`, and it does **not** say so. It
  derives *"where the `**⇒ ` convention starts"* from history, and in a shallow clone the
  earliest commit it can see IS HEAD — so every heading is "at or after" it and 24 rows
  fail, naming a SHA that is simply the head under test. Green on the box at the same tree.

⇒ **Read per RUN, those two would hold the other 26 rows hostage forever.** ⚖ 72 (b) says
*"three consecutive CI runs whose verdict sets equal the banked values before A ROW
flips"*, and the per-ROW reading is the one that survives contact with the data. The
instrument prints both and says which its exit code is.

**⇒ THE BAR, AS OF THIS SLICE'S CLOSE — 23 of the 24 browser arms have CLEARED IT, and
the twenty-fourth is the reason the bar exists.**

| row(s) | runs 3 · 4 · 5 · 6 | status |
|---|---|---|
| 23 browser arms | same · same · same · same | **CLEARED (4 consecutive)** |
| `gate: preset-bundle-load` | same · same · same · **MOVED** | streak BROKEN at run 6; needs three more |
| `gate: seedling-full-tier-owed`, `gate: slice-records` | MOVED × 4 | trap 1058 — never clearable at depth 1 |

⛓ **THE FLAKE IS NAMED, BY THE GATE ITSELF.** `preset-bundle-load` read 9/1 in run 6 with
`FAIL: … Fetch API cannot load userloaded:AP_1_bundle.zip → rules.json. URL scheme
"userloaded" is not supported.` — a page-error race on the bundle's pseudo-scheme, once in
four runs of that shard, at a head whose commit touched only `ci-summary.mjs`,
`ciSummary.js` and a generated table. ⛔ **⚖ 72 (b) earned its keep on its first day:** a
slice that had flipped this row on one green reading would have banked a value that
disagrees with CI once every four pushes. Whether the race is CI-only or exists on the box
is NOT established here — one occurrence, and `feedback_flaky_read_as_order_dependent`'s
rule (run it ALONE eight times) has not been paid.

**Tests.** `ciGatePlan.test.js`, 20 rows, every one off-network and off-box. RED FIRST
against four mutants, each caught by exactly the rows it should be: pricing an unmeasured
row at 0 → 2 fail; dropping the name tie-break → 1 (the plan is computed by TWO processes
that must agree without talking); `ciRunnable` back to the pre-S3 refusal → 7; the pre-S3
browser refusal restored in `ci-summary.mjs` → the one row that says a browser key is no
longer refused. `npx vitest run scripts/procgen frontend/modules/procgenDocs` **35 files /
971 tests** green, the generated-`--check` row included — the instruments table moved
three times in this slice because `ci-gates.mjs` and `ci-summary.mjs` gained flags
(⚖ 52: bounded).

⛓ **THE LOCAL PRE-FLIGHT THAT SAVED AT LEAST ONE CI ROUND TRIP, and the way it caught its
own slice.** Before spending a runner, `ci-gates.mjs --set=browser --shard=2` was run on
the box: box lock TAKEN, 17 arms, 442.2 s, and **16 of 17 verdicts equal to the bank**.
The seventeenth was `procgen-reference` 20/1 — and it was RIGHT: the `--gates` flag added
minutes earlier had made the generated instruments table stale. Regenerated, re-run, ALL
CHECKS PASSED. ⛓ *A CI-config slice cannot be tested locally, but the INSTRUMENT it drives
can be.*

**⇒ S4 (the bank quotes CI) IS NEXT, and it is small — the production side is done and
measured.** What S4 inherits, all of it named rather than left to be rediscovered:

1. **23 of the 24 browser arms are ready to flip** — four consecutive `same` each.
   ⛔ `gate: preset-bundle-load` is NOT: its streak broke at run 6 and it owes three more.
   `ciSourced` becomes `CI-answerable ∧ ¬cheap ∧ ¬ciFace` where CI-answerable is
   `ciGatePlan.ciRunnable` — the same predicate the workflow and the refusal already read.
   ⛔ The `¬ciFace` clause stays UNTOUCHED (§4's composition trap; `procgen-help` leaves
   the box by S5's route or not at all).
2. ⛔ **`gate: seedling-full-tier-owed` and `gate: slice-records` must NOT be flipped** —
   trap 1058. Both are `cheap`, so today's rule already excludes them; S4 must make sure
   its widening does not pull them in by another door.
3. ⚠ **A bank commit and a queue-doc commit trigger NO run** (`scripts/**/*.json` and
   `CC/docs/**` are outside every path). A `--write` at such a head has no CI answer for
   the SHA and every CI-sourced row KEEPs — which is correct behaviour and a surprise
   worth having in writing before somebody reads it as a bug.
4. ⛓ **The economics S4 buys, priced off this slice's measurements:** 24 arms = **31.4
   banked minutes** leave the box. With the Windows rows (~11 min) and `procgen-help`
   (417 s, S5's) staying, the local battery falls from 70.5 min to **≈ 20 min**, and the
   CI cost is ≈ 15 minutes of wall clock in three parallel jobs.
   > ⛔ **CORRECTED 2026-09-01 (S5b).** The last clause was TRUE WHEN WRITTEN — run
   > 33548827760 at `9c3600602` ran three parallel jobs in 15 m 27 s — and FALSE from
   > `4a99828ec`, S4's own write, which is one commit later. That write replaced the six
   > CI-sourced rows' banked `ms` with the `ci-summary` NETWORK READ, `planCiShards`
   > priced off exactly that field, and the matrix collapsed to ONE job of **23 m 01 s**
   > (run 33555725728). ⛓ Since S5b the partition prices on what each arm COST THE
   > RUNNER, and the browser set is **TWO** jobs — `seedling-wasm-element` alone at
   > 901.2 s and the other 23 arms at 489.0 s — so the wall is ≈15 min again with one
   > job FEWER than the sentence above claims. Three was itself the box-`ms` proxy
   > over-splitting: the baseline's two multi-arm shards total 466.7 runner-seconds and
   > fit inside one budget. Trap 1068.


**⇒ S4 SHIPPED 2026-09-01 — THE BANK QUOTES CI. SIX ROWS, 25.8 OF THE 31.4 BANKED BROWSER
MINUTES, READ FROM A PUSHED HEAD IN 8 SECONDS EACH; AND THE `¬cheap` THREAD THE BRIEF PULLED
TURNED OUT TO BE HOLDING TWO ROWS UP BY ACCIDENT.** (`91c26b690` … `4a99828ec`, PUSHED;
FIVE commits.)

**THE RULE, WIDENED AND MOVED.** `ciSourced` = `ciGatePlan.ciRunnable ∧ ¬cheap ∧ ¬ciFace ∧
¬ciShallow`, and it MOVES to `ciGatePlan.js` — beside `ciRunnable`, which is one of the four
facts it reads. ⛔ The move is not tidying: both call sites in `standing-values.mjs` re-derived
"headless" from their own file set and passed `ciFace` separately, and `boxLock.test.js`'s own
note records a row that had not learned the second argument and so asserted a question
production had stopped asking. The rule now takes the ROSTER ROW, so a clause added to it
reaches every caller. Three clauses are DECLARED by the gate, one is MEASURED by the bank.

⛔ **THE `¬ciFace` CLAUSE IS UNTOUCHED** (§4's composition trap): `procgen-help`'s 409 s leaves
the box by S5's route or not at all.

**⛓⛓ THE BRIEF'S ITEM 3, ANSWERED THE WAY IT ASKED TO BE — `¬cheap` WAS NOT THE RIGHT GUARD.**
Before S4 the ONLY thing keeping `full-tier-owed` (1.7 s) and `slice-records` (30.8 s) out of the
CI-sourced set was that both are `cheap` — a MEASURED 60 s ± 10 % hysteresis band that says
nothing about whether CI's answer is TRUE. `slice-records` grows with every recorded slice; the
day it crossed the band it would have become CI-sourced silently and started banking a depth-1
clone's answer as this tree's truth. ⇒ a new declaration, `@ci-shallow <reason>`, read by
`gateRoster` exactly as `@ci-face` is and for the same argument (trap 566: whether a value
survives a fresh checkout is a fact only the GATE knows — a mention-detector filed the wrong gate
last time). The two gates declare it, in their own docblocks, with their own reasons.

⛓ **AND IT IS ASSERTED AT `cheap: false`, WHICH IS THE WHOLE POINT.** `ciGatePlan.test.js` hands
the rule the value that WOULD have selected them; a guard tested at their real `cheap` would pass
today and rot silently. ⛔ It is also one line to DELETE if a later slice gives CI the history
(`fetch-depth: 0`, priced against every job's clone) — in the gate that knows.

**WHAT THE RULE SELECTS AT THIS HEAD — SIX ROWS, PRINTED BY `--write`, NEVER TYPED:**
`maze-lab` (66.4 s) · `procgen-demos` (100.3) · `seedling-editor-generate` (126.8) ·
`… (own server)` (128.8) · `seedling-wasm-element` (934.7) · `seedling-wasm-pages` (190.8)
= **1,547.8 s = 25.8 min**, out of the 31.4 banked browser minutes S3 moved to CI.

⛔ **THE OTHER 18 BROWSER ARMS ARE `cheap` AND STAY THE BOX'S — DELIBERATELY.** ⚖ 52's criterion
is economy, not provenance: quoting a row the box answers in 10 s buys a network call and a KEEP
on every unpushed head for nothing. ⛓ `preset-bundle-load` is among them at 21.7 s, so it is
excluded by `cheap` and NOT by the bar — its held-back streak never came into it, and S4b still
owes the characterisation before it could flip if it ever crossed the band.

**⚖ 72 (b), VERIFIED PER ROW BY THIS SESSION RATHER THAN INHERITED.** `ci-summary --gates
--run=<id>` on runs 33541690772 · 33543361446 · 33543380112 · 33543595675: all six selected rows
read `same` in **four consecutive runs**. ⛓ This slice's own run **33548827760** at `9c3600602` is the FIFTH: **26 same, 0
MOVED, 2 shallow, 2 not-banked, 0 MISSING** — the first run in this arc whose run-level exit is
**0**, because the two structural rows are no longer counted as disagreements.

**THE GATE, BOTH HALVES, MEASURED.**

| arm | reading |
|---|---|
| `--write` at an UNPUSHED head (`b5ac83dfb`, no run for the SHA) | all six **KEEP**, ⛔ **no value blanked**, each row carrying the CI command and the exit's reason |
| `--write` at a PUSHED head (`9c3600602`) | all six read from CI in **62.6 s total** (7.4–13.5 s each) against **1,547.8 s = 25.8 min** of banked box time; ⛓ **not one value moved** — 231/0 · 252/0 · 224/0 · 230/0 · 11/0 · 20/0, each row now carrying `ciSourced: true`, the `ci-summary` command and the pushed head it is an answer about |
| `--keys` at the bank commit `4a99828ec` | **58 keyed / 7 unkeyable** (the suite row + the six CI rows, all by ⚖ 52's clause) — every one of S2's 30 identity rows still keyed; and the S1 mutant re-run under the NEW code moves **exactly two rows** (`seedling-full-tier-owed`, `slice-records`) when the bank is touched. ⚠ The *whole-file* reading is 34 MOVED / 24 unmoved, which is correct for a head that moved `gateRoster.js` (in nearly every closure) and says nothing about S1/S2 — the two mutants above are what do |
| `npx vitest run scripts/procgen` | 29 files / 543 tests green (⚖ 52: bounded) |

**⛔⛔ AND THE UNPUSHED-HEAD ARM FOUND TWO DEFECTS THE CODE READING HAD NOT — BOTH IN THE FIRST
`--write` S4 EVER TOOK.**

1. **`gate: seedling-editor-generate (own server)` COULD NEVER BE READ FROM CI.** `ci-summary
   --gate=` derived a gate FILE from the key by stripping the `<prefix>: ` — right for a base row,
   WRONG for a declared second arm: no file is named `seedling-editor-generate (own server)`, so
   the reader REFUSED (exit 5) a key CI publishes a line under, and the row KEPT with *"no gate
   named …"*. ⛓ That is P4b (D)'s frozen-row defect in a second costume, arriving through the
   ladder built to prevent it. ⇒ a key is resolved through `ciGateArms` FIRST — **the population
   that PUBLISHES is the population that RESOLVES** — with the file-name match as the fallback so
   both existing refusals still fire by name. ⛓ The test that would have caught it is the READER
   half of the composition property the same slice already asserted on the writer side.
2. **A KEEP NAMED THE WRONG COMMAND AND THE WRONG REASON.** It printed *"`node
   …/check-maze-lab.mjs --host=…` exited 2 (no CI run for this SHA, or it has not concluded)"* —
   but the command that exited 2 was `ci-summary`, and a browser gate cannot exit "no CI run".
   Worse, exit **5** (a REFUSAL) got the same sentence, so a FROZEN row read as a merely unpushed
   one. The reason now names the command that actually ran (one spelling, shared with the banked
   `command` field — ⚖ 8) and translates the exit: 2 no run · 3 not concluded · 4 no answer under
   this key · 5 REFUSED BY NAME, *"a row that KEEPs on a 5 is FROZEN, not merely unpushed"*.

**⛓ `--gates` STOPS READING A STRUCTURAL FACT AS A DISAGREEMENT.** The verdict rule becomes
`ciSummary.gateVerdicts`, a pure function of (lines, bank, arms) — it was inline until it grew a
third verdict, which is when a rule stops being readable from its output. A `@ci-shallow` row
reads **`shallow`**, both numbers printed with the gate's reason under them, and the check runs
BEFORE the compare so a coincidence can never bank a streak the row did not earn. ⛓ The run-level
exit code means something again: run 33543361446 now exits **0** (26 same, 0 MOVED, 2 shallow)
where it exited 1 forever. ⛔ The refusal ladder grew a third rung for the same key population, so
a widening that forgot the clause goes red BY NAME instead of quietly banking a depth-1 answer.

**Tests.** `ciGatePlan.test.js` 20 → 34 rows (the `ciSourced` rows MOVED here from
`boxLock.test.js` and `standingValues.test.js` with the function, and were widened with it);
`ciSummary.test.js` is NEW, 7 rows, off-network; `gateRoster.test.js` +6. **RED FIRST against
SEVEN mutants, each caught by exactly the rows it should be:** drop `¬ciShallow` → 2 · drop
`¬ciFace` → 4 · the pre-S4 headless-only rule → 3 · compare before the shallow check → 1 · remove
the `@ci-shallow` refusal rung → 1 · accept an empty `@ci-shallow` reason → 1 · the pre-fix key
resolution → 1 (the arm defect above). ⛓ Two of them are the properties that cannot be true by
construction: **every selected row has an arm publishing a line under the SAME key**, and
**no key the rule selects is refused by the reader** — P4b (D) stated as a property, from both
ends.

**⛓ WHAT S4 DID NOT DO, AND WHY — S4c IS PARKED, NOT FORGOTTEN.** The brief asked whether the
expensive identity rows (carved/empty pairs, ends-meet) join the CI-sourced set. ⛔ They cannot in
this slice, and the reason is ⚖ 72 (b) itself: **CI prints no line for them at all**, so no
identity row can have a streak, and flipping one would be banking a value nothing has ever
published. The production side (`ci-gates.mjs` printing identity lines, the shard plan pricing
them, three runs of bar) is a slice the size of S3's, not a widening here. ⇒ **S4c QUEUED**, and
the code says so where somebody would try it: `standing-values.mjs`'s `ciGateFor` returns `null`
for a non-gate row, with the reason and the slice name in its docblock, and a unit row asserts it.

**⇒ WHAT S4 LEAVES FOR S4b AND S5**, unchanged by this slice: (1) characterise the
`preset-bundle-load` flake (still `cheap`, still not CI-sourced, still owed eight solo runs);
(2) `slice-records` should REFUSE BY NAME in a shallow clone — ⛓ S4's declaration keeps its ROW
honest but is **not** the repair, and `check-seedling-full-tier-owed.mjs:313` is still the model;
(3) trap 1057's latent nine. S5 (`procgen-help --doors=all --in-place` in CI, then retire the
face) is untouched and the `¬ciFace` clause is exactly as it was.

**⛓ THE ECONOMICS, RE-PRICED OFF THIS SLICE'S OWN BANK — AND S3's PROJECTION IS CORRECTED.**
S3 wrote *"the local battery falls from 70.5 min to ≈ 20 min"*, which assumed all 24 arms leave.
Under `¬cheap` six leave: **70.5 → 44.7 min** of full-freight box time, for **62.6 s** of
network. The other 18 browser arms are **5.6 min in total** — quoting them would buy a network
call and a KEEP on every unpushed head for no economy, which is ⚖ 52's criterion working, not
a shortfall. ⛓ The 6 rows are now UNKEYED (`its recipe already reads CI by SHA`) and so re-read
on EVERY `--write` at 8 s each: that is the point — a CI answer can move at unmoved tree bytes.

⚠ **AND THE SURPRISE S3 PUT IN WRITING IS NOW LOAD-BEARING:** a commit touching only
`scripts/**/*.json` (the bank) or `CC/docs/**` (this queue doc) triggers NO run, so a `--write`
at such a head KEEPs all six with the exit's reason. Correct behaviour, and the KEEP now says
which kind of "no answer" it hit.

**⇒ S4b SHIPPED 2026-09-01 (`0f9e0cf27` … `3eceb7d18`, PUSHED; THREE code commits) — ALL THREE
LOOSE ENDS CLOSED, AND EVERY ONE OF THEM WAS BIGGER OR DIFFERENT THAN THE BRIEF SAID.** ⛓ The
pattern this arc keeps producing held for a fourth time: each item's stated shape was a
REPORTED fact nothing had checked, and each one moved when it was measured.

**⛓ (1) THE `preset-bundle-load` FLAKE IS AN APP DEFECT, NOT A TEST FLAKE — AND THE BOX CANNOT
SEE IT.** Eight SOLO runs at `e4bb64900` (`feedback_flaky_read_as_order_dependent`'s bar):
**8/8 green, 0/8 reproduced**, 28.1–41.7 s each against a 21.7 s bank. ⛔ Eight greens do not
refute a 1-in-4 CI reading (0.75⁸ ≈ 10 %), so the rate was never going to be the answer — and
the brief's own instruction (don't fix it until you can say what races with what) is what made
the next step reading CI's FAIL line instead of adding a wait.

⇒ **WHAT FETCHES WHAT.** `presetUI.js:1539` labels every hand-loaded document
`userLoaded:<file name>` — a bundle member `userLoaded:<zip> → <entry>`. On
`stateManager:rulesLoaded` the loops module hands `eventData.source` to
`costDataManager.tryLoadEmbedded`, whose `_looksLikeRulesPath` **ENUMERATED** the synthetic
source names by exact match (`procgenPipeline`, `editorApply`,
`moduleSpecificConfigProvidedRules`, prefix `hardcodedFallback:`) and then admitted anything
`endsWith('.json')`. The label ends in `.json`. So it was FETCHED AS A URL, and Chrome wrote
`Fetch API cannot load userloaded:AP_1_bundle.zip → rules.json. URL scheme "userloaded" is not
supported.` — the `TypeError` is caught inside `tryLoadEmbedded`; **the browser's own console
error is not the caller's to catch**, and CLAIM 7 counted it.

⇒ **WHAT RACES WITH WHAT: the app's post-`files:jsonLoaded` chain against the DRIVER'S NEXT
NAVIGATION.** `upload()` returns the moment the tap fires and `openApp()` immediately
`page.goto`s; the `rulesLoaded → loops → fetch` chain has to get its request out first.
MEASURED by making the page dwell, one probe run per cell:

| extra dwell | `userloaded` console errors | CLAIM 7 |
|---|---|---|
| 0 ms (the gate as shipped) | 0 (and 0 in all 8 solo runs) | PASS |
| 100 ms | 2 | FAIL |
| 250 ms | 3 | FAIL |
| 1 s / 2 s / 3 s | 4 / 4 / 3 | FAIL |

⇒ the window is **under 250 ms**, and it fires on the PLAIN `.json` loads too
(`userLoaded:AP_1_rules.json`) — the bundle was never special. A slower runner reading `9/1`
once in four is exactly this.

⛓ **THE FIX IS STRUCTURAL AND IS NOT A FOURTH NAME ON THE LIST** (`0f9e0cf27`): a source
carrying a scheme `fetch` cannot use is a LABEL whatever it ends in, so
`/^(?!https?:)[a-zA-Z][a-zA-Z0-9+.-]+:/` refuses it — `userLoaded:`, `embedded:`,
`hardcodedFallback:` and whatever is written next
([[feedback_op_enumerates_so_a_new_field_reaches_nothing]]). RED FIRST: the new row fetched all
three labels before the change. A second row asserts `https://…` and `./presets/…json` still
fetch, so the guard cannot pass by refusing everything. ⛓ AND THE END-TO-END PAIR: the 3 s-dwell
arm read **3 errors + a red CLAIM 7** before and **0 errors + ALL CHECKS PASSED** after; the
un-dwelt gate is green either way, which is why the box could never have found this.

⚠ **THE ROW IS STILL `cheap` AND STILL NOT CI-SOURCED**, so nothing downstream moves — S4's
reading (excluded by `cheap`, not by the bar) is unchanged. What changes is that the held-back
streak was held back for a cause that no longer exists.

**⛓⛓ (2) `slice-records` REFUSES BY NAME IN A SHALLOW CLONE** (`6e4736745`), and the
reproduction found the defect is WORSE than the queue doc recorded. A real `git clone --depth 1`
of this repository at `e4bb64900` reads **42 PASS / 24 FAIL** — byte-for-byte CI's number — and
all 66 rows are about the wrong commit, by THREE mechanisms and not one:

  · `git log -S` resolves EVERY heading to the graft (HEAD), so the derived convention boundary
    IS the head under test and the 24 folds that legitimately predate the convention fail — the
    one the doc already named;
  · ⚖ 22 then reads the graft's `--name-only`, which for a root commit is the WHOLE TREE, so all
    33 headings "carry the docsIndex regen" and pass for a reason unrelated to their commits;
  · and the trap citations **VANISH**: `git show` of the graft exceeds the reader's 64 MB
    buffer, the diff comes back empty, and check (3) contributes NO ROWS AT ALL. A silent zero,
    in the file whose docblock exists to refuse silent zeros.

⇒ `sliceRecords.shallowRefusal()` — `rev-parse --is-shallow-repository`, the clone's OWN
question. ⛔ Not a symptom: inferring shallowness from "the boundary equals HEAD" would also
fire on a legitimate tree whose oldest block IS the head. The rung sits BEFORE the roster is
read, so not one row of a wrong answer is ever composed, and `--json` refuses in its own shape.
Exit **0**, following `check-seedling-full-tier-owed.mjs:313`: "the question could not be put"
is not a failing check.

⛓ **S4's `@ci-shallow` LINE STAYS, AND THE GATE NOW SAYS WHY IT IS NOT REDUNDANT** — the
declaration governs what the BANK may quote, the refusal governs what the GATE may say. Both
layers correct, neither replacing the other.

BOTH ARMS MEASURED AFTER: depth-1 → `SKIP: this is a SHALLOW CLONE …` + `ALL PASS — REFUSED`,
exit 0; full clone's CI face → **73/0/37**, unmoved, and `--local` → 86/0/24 + 2 notes. Four
unit rows driven against a REAL depth-1 clone of the three-commit throwaway fixture (not a
stub), with the control that the clone really is shallow; MUTANT (`shallowRefusal` → always
null) reds exactly the two rows that assert the refusal and leaves the control green.

**⛔⛔ (3) TRAP 1057: THE COUNT WAS WRONG IN BOTH DIRECTIONS, AND ONE PROBE WAS NEVER LATENT**
(`3eceb7d18`). Census of every `fetch(` in `scripts/` — 22 sites, 3 of them inside
`page.evaluate` (the BROWSER's fetch, not undici) — gives **12 node-side undrained non-HEAD
sites**, not S3's nine and not the brief's ten:

  · the **9** `check-seedling-editor-*.mjs` (boot, export, lanes, manual, overlays, refusal,
    shapes, solve, world) — S3's nine, confirmed;
  · `check-seedling-wasm-ship.mjs` (Windows-only), `probe-seedling-watch-page.mjs`, and
    `scripts/test/test-health-check.js` — **named by nobody**;
  · and `check-seedling-wasm-pages.mjs` **IS NOT ONE** — the brief counted it; it uses
    `{ method: 'HEAD' }`, one of the two forms the original measurement found safe at 0/40.

⛓⛓⛓ **AND THE "LATENT" READING HELD FOR THE NINE AND FAILED FOR THE PROBE.** Measured here on
node **v22.23.2**, 40 fresh processes per cell, against this repo's own `python3 -m http.server`:

| probe body | undrained | drained |
|---|---|---|
| 26 KB `tapes/index.json` (the nine editor gates) | **0/40** | 0/40 |
| 82 KB `tapes/r4-walk-full.json` (`probe-seedling-watch-page`) | **32/40** | 0/40 |
| 85 KB `watch.html` (the one already fixed) | **19/40** | 0/40 |

`probe-seedling-watch-page.mjs` takes the tape NAME on the command line and the largest committed
tape is 82 KB — so it was not latent at all; it is an **80 %-crash probe** that nothing had ever
run on node 22. ⛓ S3's inference was SOUND OVER THE POPULATION IT MEASURED; the population was
the nine editor gates and it did not contain this file. (The 85 KB cell also shows the rate is
load-dependent: 19/40 here against S3's 5/40 at the same body.)

⛔ **DECIDED DELIBERATELY: DRAIN, DO NOT PIN THE RUNNER'S NODE.** A pin fixes one consumer and
leaves the box, every contributor and every future runner exposed to a crash thrown from a
socket callback no `try`/`catch` at the call site can see — the process dies and the gate's
stdout goes with it. The drain is one line per site and does not move the probe's question, and
the reasoning ("a DRAIN and not a `HEAD`, because the probe's QUESTION must not move") travels
with every site while the NUMBERS stay where they were measured.

⛓⛓ **AND A UNIT ROW HOLDS THE PATTERN** — `fetchDrain.test.js`: every `fetch(` in `scripts/`
drains its body or asks for none. ⛔ A vitest row and not a `check-*.mjs` report
([[feedback_lint_report_is_not_the_gate]]) — a report somebody must remember to run gates
nothing, and **the box's node 18 hides this defect**, so the row is the only thing that can see
it here. Its call detector reads `maskComments`' own `REGEX_AFTER_KEYWORD` rather than keeping a
second copy of "which word may precede a call", and it carries its own two controls (it sees an
undrained call; it does NOT see `sphere-log fetch(es)` in prose or `api.fetch(`). MUTANT
(un-drain one gate) reds it with the file, the line and the call.

**THE COST OF THIS SLICE'S HEAD, PRICED RATHER THAN ASSUMED.** `--keys` at `3eceb7d18` reads
**34 MOVED / 24 unmoved / 7 unkeyable** — the whole-file shape S4 already named, and the cause
here is `costDataManager.js` (in most frontend closures) plus the ten touched gate files. The
moved rows sum to **1,711 s = 28.5 min** of banked box, of which 474.5 s is the Windows
`seedling-wasm-ship` row and 409.1 s is `procgen-help`'s ciFace (S5's subject).

**THE CLOSING WRITE, AT THE HEAD CI HAD CONCLUDED ON** (`df127df68`, run 33555725728 success).
31.8 min of box for the 34 moved rows; the six CI-sourced rows read from CI in **37.5 s total**
(5.5–7.0 s each) against their 25.8 banked minutes. ⛓ **ZERO gate values moved** — every drained
probe, the shallow refusal and the `userLoaded:` filter are byte-inert to what the gates ANSWER on
the box, which is what they were supposed to be. The one move in the bank is `suite: vitest
(unfiltered)` 413/12566 → 416/12615, CI's own count at this SHA. No nondeterminism findings;
`seedling-editor-arm` at 65.0 s HELD by the ±10 % band (trap 735).

⛓⛓ **AND THE PAIR THE REPAIR WAS FOR, READ IN PRODUCTION:** at `3eceb7d18` the SAME code answers
`73/0/37` on the box and `ci=0/0/1` under the `shallow` verdict in CI — where every previous head
read `42/24`. ⛓ `preset-bundle-load` reads `same` in that run (ci `10/0`), streak 2. Run-level:
**26 same, 0 MOVED, 2 shallow, 2 not-banked, 0 MISSING.**

⇒ **WHAT S4b LEAVES.** S5 (`procgen-help --doors=all --in-place` in CI, then retire the face)
and S4c (identity rows need CI to publish a line first) are untouched and unchanged. The
`¬ciFace` clause is exactly as S4 left it.

**⇒ S5 SHIPPED 2026-09-01 (`def23822a` … `e172d631f`, PUSHED; TWO code commits, plus the write `e5c19cece`) — THE FULL
`procgen-help` CLAIM IS ANSWERED BY CI UNDER THE STANDING KEY, THE `@ci-face` IS RETIRED IN THE
SAME CHANGE, AND `¬ciFace` IS UNTOUCHED. ⛓⛓ AND THE SLICE'S OWN ACCEPTANCE TEST WAS VACUOUS WHEN
IT ARRIVED: THE BOUNDED FACE AND THE FULL CLAIM PUBLISHED BYTE-IDENTICAL LINES.**

⛔ **THE ORDER THE BRIEF MADE NON-NEGOTIABLE WAS HONOURED, AND THE THING THAT MADE IT POSSIBLE IS
A NEW DECLARATION RATHER THAN A LOOSENED CLAUSE.** `@ci-face` says *"the number CI can produce for
me is a DIFFERENT CLAIM"* and takes its own key prefix — which is exactly why a faced gate is never
CI-sourced (P4b (D)). There was no way for a gate to say the OPPOSITE, so the only route out of the
box for `procgen-help` looked like loosening `¬ciFace`, which protects every other faced gate. ⇒
**`@ci-argv <flags>: <why these flags do not move the claim>`** (`gateRoster.js`, `def23822a`): the
SAME claim under the SAME key, plus the flags a checkout needs to ask it. `ciSourced` is untouched,
clause for clause, and `check-seedling-producer-boundaries`'s `structure:` face still selects the
`¬ciFace` exclusion — so the clause stayed load-bearing rather than becoming vacuous by having no
subject.

⛓ **THE FLAGS ARE APPENDED, AND THAT IS THE LOAD-BEARING HALF.** A face SUBSTITUTES its argv; an
append cannot drop the `--host=`/`--root=` a gate needs to address a world. `ciGatePlan.test.js`
asserts the invariant over the live tree from both ends: **a standing-keyed arm's argv is the LOCAL
argv plus exactly its gate's declared flags**, and **every arm that is NOT standing-keyed is a
declared face running the face's own argv**. ⛔ The hazard is named where it is opened — a flag that
NARROWS the question (`--only=`, `--doors=ci`) would bank a bounded number under the full claim's
key, which is `@ci-face`'s own defect wearing the new tag as a costume — and a gate declaring BOTH
tags is refused as a PAIR by `gateRoster()`, because whichever a consumer read first would decide
it silently.

⛓ **WHAT `check-procgen-help.mjs` DECLARES NOW** (`e172d631f`): `@ci-argv --in-place: the runner's
checkout IS the throwaway tree the worktree regime builds on the box …`. SG1 W2's decision is
unchanged and is now stated as what it always was — a fact about WHERE the children run, not about
WHAT is asked, measured at one head as identical verdicts across all 265 rows. ⛔ `--doors=ci` is
NOT deleted: it stays the fast local pre-flight and the face a future consumer with a real budget
would declare. What it no longer is, is CI's.

⛓ **THE ARITHMETIC THAT RETIRED THE FACE IS NOT THE ONE THAT BUILT IT, AND THAT IS THE WHOLE
SLICE.** P4a bounded the push because `ci-gates.mjs` ran every headless gate SERIALLY in the one job
a push waits on, so ~5½ minutes there was a cost the user paid on every push (P4a residue item 3:
*"nothing gates the cost `@ci-face` exists to avoid"*). S3 put the browser arms in a parallel matrix
whose wall clock is 23 minutes, so the full pass costs the push nothing it was not already waiting
for — while the bounded face cost the BOX 402.8 s of every full-freight `--write`, forever, because
a faced row can never be CI-sourced. ⇒ **RETIRE, not re-scope**, and the brief's alternative was
live until the wall clocks were read.

**⛔⛔⛔ THE FINDING THIS SLICE HAD TO MAKE BEFORE IT COULD BELIEVE ITS OWN GATE: `--doors=ci` AND
`--doors=all` PUBLISHED THE SAME BYTES.** Read off run 33555725728, the last run before this slice:

```
## CI-GATE | gate-help-ci: procgen-help | 265/0 | exit=0 | ALL PASS — 265 instrument(s) answer
`--help` with no side effect this gate can observe; 252 still do module-scope work on IMPORT …
```

— and the bank's `total` for `gate: procgen-help`, measured on the box under `--doors=all`, was
that sentence VERBATIM. Two mechanisms, both structural: the VALUE is the count of `PASS:` lines,
which is one row per instrument whichever doors were opened; and the import-door figure in the
total is `KNOWN.size`, **the size of a committed baseline FILE**, a restatement that is true
whatever was measured. Only the KEY PREFIX ever distinguished them. ⇒ ⚖ 72 (b)'s bar — *"three
consecutive runs in which that row reads `same`"* — **could have been cleared in full by a run that
never switched door sets**, and the slice would have banked the CI number believing it was the full
claim. ⛓ Fixed in the same commit: the verdict line now names its door set and the count of import
doors NOT ASKED, derived from the rows and never from `DOORS`, so a fourth door set inherits it.
Measured on one instrument: `--doors=all` → *"every import door was asked"*; `--doors=ci` → *"1
import door(s) were NOT ASKED by this door set"*. **That sentence is now the only thing in the
published artifact that can tell the two claims apart, and it is what makes the three runs below
evidence rather than a coincidence.**

**THE THREE RUNS, AND THE BAR READ PER ROW WITH `ci-summary --gates --run=<id>`.**

| # | run | event | `gate: procgen-help` | `here=` | headless step | that JOB | the browser matrix beside it |
|---|---|---|---|---|---|---|---|
| 1 | 33563524638 | push `e172d631f` | **same**, ci `265/0` | 252.1 s | 4 m 21 s | 10 m 38 s | 23 m 34 s |
| 2 | 33564571352 | dispatch, same head | **same**, ci `265/0` | 255.3 s | 4 m 24 s | 10 m 49 s | 23 m 34 s |
| 3 | 33564586068 | dispatch, same head | **same**, ci `265/0` | 214.0 s | 3 m 41 s | 8 m 49 s | 22 m 40 s |

Run-level in all three, identically: **27 same, 0 MOVED, 2 shallow, 1 not-banked, 0 MISSING.**
⛓ `not-banked` was **2** before this slice and is **1** now — the retired `gate-help-ci:` key
leaving the published set is itself an observable of the retirement, printed by the instrument
rather than asserted by me. ⛓ Before the slice the row could not appear in this table AT ALL: its
`gate:` key had no CI line and its face was `not-banked` by construction.

⛓ **AND A CONTROL THE BRIEF DID NOT ASK FOR, TAKEN BECAUSE IT WAS THE LAST CHANCE TO TAKE IT.** The
bar compares CI against a bank measured two heads back; once the row is CI-sourced the box never
runs this gate again. So the full `--doors=all` pass was driven ON THE BOX at the SAME head
`e172d631f`, worktree default: **ALL PASS, 265/0, 432.9 s, 6 submodule(s) initialised, primary tree
porcelain 0.** The claim therefore agrees THREE ways — the bank's 265/0, the box at this head, and
CI's `--in-place` run — rather than two. ⛓ **CI is 0.58× the box on this row** (252.1 s against
432.9 s), the same direction S3 measured on the light browser arms.

⛓ **THE PUSH DID NOT GET SLOWER, AND THE COST THE FACE EXISTED TO AVOID IS MEASURED RATHER THAN
ASSUMED.** The headless step went **33 s → 4 m 21 s** and its job **7 m 03 s → 10 m 35 s**, against
a browser matrix at **23 m 01 s** in the same run: the workflow's critical path did not move. The
step gains a `timeout-minutes: 20` KILL DEADLINE, because a JOB timeout reports `cancelled` and
names neither step nor cause (S3's measurement).

⛓ **A THING THAT IS NEW AND WAS WORTH WATCHING: IN CI THIS GATE NOW DIRTIES THE TREE ITS SIBLINGS
RUN IN.** `procgen-help` sorts first in the headless set, and `--in-place` means its 252 module-scope
workers really write — the gate repairs tracked paths and REPORTS untracked droppings rather than
deleting them. On the box that lands in a throwaway worktree and no sibling ever sees it. In all
three runs every one of the five following headless gates read its previous value, so the answer is
"it does not disturb them" — but it is a property nobody had before this slice, and the next gate
added to that set inherits it.

**⛔⛔⛔ AND A DEFECT THAT IS NOT S5's, THAT S5's W0 FOUND, THAT IS LIVE ON EVERY PUSH, AND THAT NO
TEST CAN SEE: S4's OWN WRITE RE-PRICED THE SHARD PARTITION.** `standing-values --write` records
`ms` as *how long this ROW took to produce* — which for a CI-sourced row is the `ci-summary`
NETWORK READ. `planCiShards` prices arms off exactly that field. Measured, both sides:

| the six CI-sourced arms | banked `ms` before S4's write (`5e42d4104`) | after (`4a99828ec`) |
|---|---|---|
| `maze-lab` · `procgen-demos` · `seedling-editor-generate` · `… (own server)` · `seedling-wasm-element` · `seedling-wasm-pages` | **1,547.8 s** — what the gates cost | **37.5 s** — what six network calls cost |

`seedling-wasm-element` fell **934.7 s → 6.1 s**, under the 600 s budget that had been giving it a
job to itself, and the partition collapsed:

| run | head | shards | browser wall clock |
|---|---|---|---|
| 33548827760 | `9c3600602` (before the bank commit) | **3** | **15 m 27 s** |
| 33555725728 | `3eceb7d18` (after) | **1** | **23 m 01 s** |

⇒ **+7 m 57 s of CI wall on every push, and `seedling-wasm-element` — the one row S3's abort
criterion exists to watch — no longer runs alone.** ⛔ Nothing went red and nothing could: every
unit row about the partition uses a STUB bank, and the live-tree rows assert only that the shards
COVER the arms, which one shard does perfectly. ⛓ It is the WRONG-SUBJECT shape one level down — the
planner asked *"what does this arm cost to run"* and a field whose meaning had changed under it
answered about a network call.

⇒ **QUEUED AS S5b, NOT FIXED HERE**, because the repair is a design choice and not a line: (a) treat
a `ciSourced` row as UNPRICED, which is one clause, needs no new field, and follows the module's own
rule that an unmeasured arm lands alone — at the cost of seven shards where three would do; (b) keep
the gate's own last measured cost in a field of its own; (c) have `ci-summary` hand back the
runner's `##   ms | <key> | here=` and price the partition on THAT, which is the number it actually
wants. ⛔ Whichever is taken owes a row that can SEE it, and the obvious one CANNOT:
`ciGatePlan.test.js` already asserts *"no shard exceeds the budget unless a single arm does"* and
that row was green throughout — the collapsed shard's PRICED total is **423.8 s**, well inside the
600 s budget, while the job it produced ran **23 m 01 s**. A budget assertion over prices cannot see
prices that are wrong. The guard has to refuse the INPUT: a bank row carrying `ciSourced: true`
holds a network read, not an arm's cost.

**THE GATE, ALL FOUR PARTS.**

| # | the brief asked | measured |
|---|---|---|
| 1 | three CI runs, the row `same` in each | the table above — `same` · `same` · `same`, `ci-summary --gates --run=<id>` |
| 2 | the face retired in the SAME change; `ci-summary --gate="gate: procgen-help"` no longer refuses BY NAME | `e172d631f`. At the pre-slice SHA it now exits **4** (*"carries no such line"*) where it exited **5**; at `e172d631f` it exits **0** and prints the full-claim line |
| 3 | a `--write` at a PUSHED head reads from CI in seconds; at an UNPUSHED head it KEEPs with the right reason | pushed `e172d631f`: **5.6 s** against 402.8 banked box seconds. Unpushed `e5c19cece` (a bank commit, which triggers no run at all): **KEEP, value NOT blanked** — `265/0 @e172d631f` with `not re-read at e5c19cece…: node …ci-summary.mjs --gate="gate: procgen-help" --json exited 2 (no CI run for this SHA — not pushed, or the path filter did not trigger one)`. ⛓ Exit **5** keeps its own sentence (*"a row that KEEPs on a 5 is FROZEN, not merely unpushed"*), so trap 1060's separation holds for the new row |
| 4 | `npx vitest run scripts/procgen` bounded (⚖ 52) | 30 files / **565 tests** green; plus `frontend/modules/procgenDocs` 7 / 447 and `generate-procgen-reference --check` ALL 6 MODULES AND 4 REGIONS MATCH |

**THE WRITE, AT THE HEAD CI HAD CONCLUDED ON** (`e5c19cece`, run 33564586068 success). 41 rows
re-measured, **22.7 min of wall of which 47.1 s was seven CI reads — 22.0 min of box**; `--keys` had
priced it at 33 MOVED + 8 unkeyable and it was exactly that. ⛓ **ONE value moved and it is CI's:**
`suite: vitest (unfiltered)` 416/12615 → 416/12629. Every gate and identity verdict unchanged; no
nondeterminism findings, no EXIT rows, 0 rows HELD.

⛓⛓ **THE BATTERY: 46.8 → 38.8 min** of full-freight box time over 65 timed rows. `gate:
procgen-help` is the **seventh** CI-sourced row and the **eighth** unkeyed one (*"its recipe already
reads CI by SHA"*), `ms` **402,750 → 5,569**.

⚠ And named rather than left to be rediscovered: that new `ms` is a network read like the other
six, so this row JOINS the population S5b is about. It has no consequence today — `procgen-help` is
headless and the headless set is not sharded — but the day anybody partitions that set, it is priced
at 5.6 s.

**Tests.** `gateRoster.test.js` 15 → 24 rows, `ciGatePlan.test.js` 34 → 38, `boxLock.test.js`'s
typed face list corrected. **MUTANTS, each caught by exactly the rows it should be:** `ciArgvIn`
always `null` → 7 fail · the PAIR refusal deleted → 1 · the argv append reverted to a bare base
argv → 2 · **the pre-S5 build, with the `@ci-face` restored on the gate → 3** (the declarer row, the
argv property, and `ciSourced` selecting it). ⛓ `boxLock.test.js`'s typed list of face declarers
went RED on its own, which is the row WORKING: it is the one typed pin in a mechanism that is
derived end to end, so a face appearing or disappearing announces itself instead of silently moving
one more row onto the CI path. It is now paired with an assertion that the gate declares the OTHER
tag, so it cannot pass because somebody deleted a declaration and left the gate mute.

⇒ **WHAT S5 LEAVES.** **S4c** (identity rows need CI to publish a line first) is untouched and
unchanged. **S5b** is the shard mispricing above. ⛓ The `¬ciFace` clause is exactly as S4 left it,
and it now has exactly one subject — which is worth knowing, because a clause with no subject is a
clause the next slice deletes.

**⇒ S5b SHIPPED 2026-09-01 — THE SHARD PARTITION PRICES IN THE RUNNER'S OWN SECONDS. `planCiShards`
NO LONGER TAKES A BANK AT ALL; THE BROWSER WALL IS 23 m 01 s → **15 m 20 s** IN TWO JOBS, AND THE
GUARD THAT MISSED THIS NOW READS ONLY WHAT THE RUNNER PRINTED ABOUT ITSELF.** (`a1ee8275b` …
`13dc57a1e`, PUSHED; FOUR commits.)

**THE DEFECT, RESTATED FROM THE FIX'S SIDE.** `standing-values --write` records `ms` as *how long
this ROW took to produce*. ⚖ 72 made rows CI-SOURCED, so producing one became a `ci-summary`
NETWORK CALL — and `planCiShards` priced arms off exactly that field. Not one line of the partition
changed; the MEANING of the field under it did. `seedling-wasm-element` 934.7 s → 5.5 s, 24 browser
arms priced at 47 s of `gh` traffic, three shards → one, **+7 m 57 s of CI wall on every push** with
nothing red anywhere.

**⛔ THE FIX IS STRUCTURAL, NOT A CLAUSE — AND THAT WAS THE BRIEF'S OWN ARGUMENT.** `ciGatePlan.js`'s
docblock had defended this carefully against an UNKNOWN cost (*"pricing an unknown at zero is how one
shard silently becomes the slow one"*) and had no defence against a KNOWN-BUT-WRONG one. So the
repair is not *"exclude a `ciSourced` row"*: `planCiShards({arms, costs, budgetMs})` **has no `bank`
parameter**, and there is nothing a caller can pass that puts a standing row's `ms` back into a
price. An arm no runner has measured is UNPRICED and lands alone — the module's own rule, unchanged,
and NOT a fallback to the bank, because a fallback reinstates the defect for exactly the rows that
had it.

**⛓⛓ (c) OVER (b), AND THE MEASUREMENT THAT DECIDED IT — the brief asked to be overturned with
reasons and this is the one place it needed to be sharpened rather than overturned.** (b) — a field
holding the gate's own last LOCAL cost — is smaller and would have worked. It loses on two measured
facts:

| | measured |
|---|---|
| the box was never a *proxy* for the runner | across the 24 browser arms × 3 runs the runner is **0.18× to 0.96×** the box — `editor-sequence` 26.2 → 4.8 s, `wasm-element` 934.7 → 901.2 s. A FIVE-FOLD spread is not a headroom factor; it is a different question |
| (b)'s number would never be re-measured | a CI-sourced row's last local cost is from the last time the box ran a gate **this whole arc exists to stop the box running**. It freezes on the day it is written |

⇒ `scripts/procgen/ci-arm-costs.json`, written by `ci-gates.mjs --write-costs` out of the `##   ms |
<key> | here=` lines every run has printed **since S3**. Re-measured by the very jobs being priced,
at no new cost, in the currency the partition actually spends. ⛓ MAX across the runs, not the
latest: same-arm spread over three runs is ~25 % (`editor-generate` 34.0 / 34.3 / 42.3 s) and a
bin-packer fed the fastest sample packs a bin that does not fit.

⚠ **`here=` IS available at plan time and the brief's fallback was not needed** — but not the way
the brief pictured it. The plan must be a pure function of the tree (two jobs at one SHA agree
without talking, and the box runs `--plan` too), so a network read at plan time is out; the runner's
number reaches the planner by being BANKED, which is (b)'s structure carrying (c)'s value.

**⛔⛔ THE GUARD, BUILT AND SHOWN FAILING BEFORE THE FIX** — `ci-gates.mjs --audit --run=<id>`
(commit 1, `a1ee8275b`, alone). Its only inputs are each job's `here=` lines and its own `## shard i
of n` note: no bank, no costs file, no plan, nothing this module priced.

| run | head | shards | audit |
|---|---|---|---|
| 33555725728 / 33563524638 | the regression, LIVE at slice start | 1 | **FAIL** — *24 arms and 1388.8s > the 600s budget* |
| 33548827760 | `9c3600602`, the 3-shard baseline | 3 | **ALL CHECKS PASSED** — and `wasm-element` ALONE at 896.5 s over budget is NOT red, because a one-arm shard over budget is `planCiShards`' own rule working |
| **33575117635** | **`8a386aea8`, this slice** | **2** | **ALL CHECKS PASSED** |

⛓ The control is the half that matters: a guard that reds on every run is not a guard. And the
control found the OTHER direction unprompted — the baseline's two multi-arm shards total **466.7
runner-seconds** and would have fitted in ONE job. **THREE was itself the box-`ms` proxy
over-splitting.** That is reported as `loose` and never red: over-splitting costs a runner, not a
minute, and varies run to run. ⛔ Saying which direction a guard is blind in is the difference
between a bound and a hope — this one reds on UNDERPRICING only.

**THE GATE, ALL FOUR PARTS.**

| # | the brief asked | measured |
|---|---|---|
| 1 | the failing case, shown failing before the fix | two of them. (a) `--audit` on the live run, above, at commit 1 with no fix present. (b) unit: `ciGatePlan.test.js` gained two rows that pass BOTH the corrupted bank AND the runner's costs and assert the plan is the costs' — **2 failed / 38 passed against the pre-fix module**, 44/44 after |
| 2 | the partition is correct, and WHY that many shards | **TWO.** `seedling-wasm-element` 901.2 s is at or above the 600 s budget, so the module's own rule gives it a job; the other 23 arms sum to **489.0 s** and fit in one. The predicted wall is wasm-element's own ~15 min, which is irreducible — and it is ONE JOB FEWER than the 3-shard baseline, for the `loose` reason above |
| 3 | a pushed run, watched, against 23 m 01 s and 15 m 27 s | run **33575117635** @`8a386aea8`: **2 shard jobs, browser wall 15 m 20 s** (element 15.3 min, the 23-arm shard 8.6 min). vs **23 m 01 s** regression and **15 m 27 s** baseline. `ci-summary --gates`: **27 same, 0 MOVED, 2 shallow, 1 not-banked, 0 MISSING** — the 2-way cover loses no arm. ⛓ The plan priced the 23-arm shard at 489.0 s and it ran **481.7 s** — 1.5 % |
| 4 | `npx vitest run scripts/procgen` bounded (⚖ 52) | **30 files / 578 tests** green (was 565; +13 rows). Plus `frontend/modules/procgenDocs` 7 / 447, `check-procgen-help --only=ci-gates.mjs` ALL PASS, `check-procgen-reference` ALL CHECKS PASSED after the instruments index was regenerated for the two new flags |

**⛔⛔ A FINDING THE BRIEF DID NOT NAME AND THE DESIGN CREATED: A NEW `scripts/procgen/*.json`
RE-ARMS S1's KEY CASCADE.** Measured both sides on the real tree. `ci-arm-costs.json` is a `.json`
directly under `scripts/procgen/`, so `rowInputKey`'s DIRECTORY rule carries it into the same `data`
populations the bank was in:

| `--keys` | MOVED |
|---|---|
| costs file TRACKED, no exclusion | **30 of 34** |
| costs file tracked, exclusion applied | **2** — and the whole report BYTE-IDENTICAL to the one taken with the file absent |
| negative control: touch `frontend/modules/flashPanel/games/seedling.json` | **51** — the exclusion emptied nothing (trap 1018's shape) |

⇒ `DERIVED_DATA_EXCLUDED` becomes a **Set of two imported constants**, each named by the module that
writes it — never a spelling (⚖ 17), so neither can drift from what its writer emits. ⛓ AND UNLIKE
THE BANK, NO GATE DECLARES THE COSTS FILE BACK, which is the right asymmetry: the bank has two rows
whose SUBJECT it is; nothing a gate reports is a function of what a runner charged. ⚠ The first
mutant I ran was VACUOUS and said so — an UNTRACKED file cannot enter any population, because
`tracked` is `git ls-files`. The pair above is the re-run with the file staged.

**THE BUDGET STOPS BEING A PROXY.** Its docblock said ten BANKED minutes left *"a 2× factor before a
shard reaches the twenty it is aiming at"* — true when written, before anyone had seen a runner. It
is now ten of the RUNNER's minutes, and it stays at ten rather than rising to the plan's twenty for
an arithmetic reason now stated in the constant: `wasm-element` exceeds any budget under fifteen
minutes and takes a job alone, every other arm sums to 489 s, so **600 s yields two shards whose
wall is wasm-element's own — while 1200 s would pack 300 s of light arms in beside it and push the
wall towards the twenty it is aiming at.** A budget above the irreducible arm buys nothing and
spends wall.

**THE SWEEP FOR A SECOND MISLED CONSUMER, AND ITS BOUND.** `planCiShards` was the only reader of a
banked `ms` outside `standing-values.mjs` itself. Swept: every `.ms` reference in
`scripts/procgen/*.{js,mjs}`, and every file naming `standing-values.json` or `readStandingValues`
(14). `cheapFor(r.ms, …)` reads the FRESH result, not the bank, and a `fromCI` row is written
`cheap: false` unconditionally — so the `cheap` band was never poisoned. No instrument sums the
bank's `ms` into a battery total; the 70.5 → 38.8 min figures in this arc's as-builts are computed
by the session that writes them. ⛓ NOT swept: consumers outside `scripts/procgen`, and prose.

**RECORDS CORRECTED WHERE THEY STAND** (`13dc57a1e`), in the 30/33 house style — what was true when
written, and what changed: §5k's S4 bullet 4 (*"≈ 15 minutes of wall clock in three parallel
jobs"* — true at `9c3600602`, false one commit later at S4's own write, and the "three" was itself
over-splitting), and `NewDocs/plans/standing-values-ci-and-parallelism-plan.md` §6 in two places
(S3's *"partition by banked `ms` … aiming ≤ ~20 min per job"*, and the steady-state projection —
whose "~16 min wall, parallel" is right to the minute and whose "~11 min" local is 38.8, because
`¬cheap` keeps eighteen browser arms on the box exactly as ⚖ 52 asks).

⇒ **WHAT S5b LEAVES.** **S4c stays parked**, untouched — CI publishes no line for an identity row,
so no identity row can have a streak. ⛓ Two things a later slice may want: (1) `ci-arm-costs.json`
goes STALE on its own — a new gate is UNPRICED and lands alone (correct, coarse), and a gate that
gets slower is underpriced until somebody re-runs `--write-costs`; the audit is what says so, and
its repair is one command. (2) The audit is a manual instrument, not a gate — wiring it into a run
is possible but a run cannot audit ITSELF (it must read a FINISHED run's logs), so it would have to
audit the PREVIOUS run, which is a different claim and deserves its own ruling. ⛓ The headless set
is priced now too (`procgen-help` 255.3 s on a runner, its first full-claim CI measurement) but is
still not sharded; if it ever is, the numbers are already there.


**⇒ S4c SHIPPED (2026-09-02, `main` @`0e7454b67`…`43c70162b`; 5 commits + the write): THE IDENTITY
ROWS HAVE CI LINES, AND THE ROW THAT SAID THEY NEVER COULD IS NOW THE RULE THAT SAYS WHEN THEY DO.**

**⛓⛓ WHICH NUMBER "THE BATTERY" MEANS — PINNED, because TWO of them are true and this arc has
already been bitten once by an unlabelled count (the plan's 30/33, which its own `--keys` reading
contradicted inside the same report).** Measured at `b798b3783`:

| | |
|---|---|
| **21.5 min** | EVERY row's banked `ms` — what a `--write` actually costs on a head that moved everything |
| **19.8 min** | the same, MINUS the 13 CI-sourced rows — what the BOX still computes |
| 1.7 min | the difference: the CI-sourced rows' `ci-summary` network reads, 13 rows |

⛔ Neither is wrong and they answer different questions. **Where this arc quotes a single figure it
means 19.8** — the box-side number, because the arc's subject was *what the box spends* — and the
before-figures it is compared against (70.5, 46.8, 38.8) are box-side too, so the series is
consistent. ⚠ A reader pricing a `--write` wants 21.5.


**⛔⛔ STEP 1 FIRST, AND IT IS THE HALF THAT COULD HAVE ENDED THE SLICE.** ⚖ 72 (b) wants three
consecutive runs of `same` before a row flips, and nobody had ever run ONE. A gate verdict (`265/0`)
is portable by construction; **an md5 over generated levels is portable only if generation is
deterministic across environments**, and if a runner disagreed then no identity row could ever meet
the bar and every line of plumbing would be waste. ⇒ a `workflow_dispatch` scratch job ran the six
candidate rows once and printed each CI value beside its banked one. **Run 33581070573 @`0e7454b67`:
6 same, 0 MOVED of 6.** The digests are portable. The scratch job is deleted in the same slice
(`49b2461df`) — its numbers live here.

    row                                    box (banked)   runner    ratio
    identity: carved pairs c4                   363.5s     63.8s    0.18x
    producer: plan-seedling-r7-ends-meet         224.0s    212.5s    0.95x
    identity: empty pairs c6                    207.1s     22.9s    0.11x
    identity: empty pairs c3                    124.2s     13.2s    0.11x
    producer: plan-seedling-r7-attribution        93.9s     21.3s    0.23x
    identity: acceptance batch                   81.7s     15.7s    0.19x
                                              1,094.3s    349.4s

⛓⛓ **AND THE 5–9× IS THE MACHINE, NOT THE RUNTIME — MEASURED, BECAUSE IT WAS THE FIRST THING A
DISAGREEMENT WOULD HAVE BEEN BLAMED ON.** CI runs node 22 and this box's `node` is v18.20.6, so a
node-22 control ran on the box in parallel with the CI job: `identity: acceptance batch` 97.8 s
(node 18) → 92.3 s (node 22), same digest, and `plan-seedling-r7-attribution` the same both ways.
⇒ the runtime accounts for ~6 %, the box is genuinely ~5–9× a shared runner on pure-node work, and
S5b's 0.18×–0.96× over the browser arms extends DOWN to 0.11× here.

**⛓ THE CANDIDATE SET WAS RE-DERIVED AND AGREES WITH THE BRIEF'S SIX** — non-cheap `kind:
'identity'` standing rows, minus the box-locked-to-Windows one — at 1,094.279 s exactly.

⚠ **BUT ⚖ 72 (a) EXCLUDES FOUR IDENTITY ROWS, NOT ONE, AND THE CANDIDATE SET COULD NOT SHOW IT.**
`identity: generated set` is the expensive one the brief named; `solve-seedling-r8-d2-chain`,
`solve-seedling-r8-tail` and `solve-seedling-r9-campaign` each hold `/mnt/c/Windows/py.exe` as a
literal too. All three are `cheap`, so no economy turns on them and the brief's arithmetic is
unaffected — but a rule written to the CANDIDATE SET would have shipped a one-row exclusion where
the population needs a four-row one. ⛓ Nothing names any of them: `machineDrivers()` (⚖ 62) already
classifies every `.mjs` in the directory from its own text, one classifier for one question, and
`ciIdentityArms` asks it. The OTHER row the brief named, `roster: --win --tier=full`, never reaches
the function at all — `standingRows()` does not derive it.

**⛓⛓⛓ THE BUILD (`07c3b104c`) — AND THE PARKED ROW BECAME THE RULE RATHER THAN BEING DELETED.**
`ciSourced`'s `if (!gate) return false;` carried S4c's name and a unit row asserting it, and its
stated reason was TRUE: *"CI prints no line for an identity row, so no identity row can have a
streak."* S4c built the production side, so the reason expired — and the replacement is the **same
sentence read forwards**: a gate-less row is CI-sourced when **an arm publishes a line under its own
key**. ⛓ That is the rule `ci-summary` already resolves keys by (*"the arms are the population that
PUBLISHES, so they are the population that resolves"*, S4's own repair), so the rule and the reader
now agree BY CONSTRUCTION rather than by two lists somebody keeps level. The old unit row is not
deleted: it is now four rows asserting both directions plus ⚖ 72 (a) at `cheap: false`.

⛔ **THE UNTOUCHABLES ARE UNTOUCHED.** `¬ciFace` and `¬ciShallow` are inside the `if (gate)` branch,
byte-identical; neither has an identity analogue to invent (`@ci-face` says *"CI's number is a
different claim"* and an identity arm runs the box's own command; `@ci-shallow` is about the
CHECKOUT and these rows' subject is generated levels). `¬cheap` is asked of the identity rows too
and is doing real work: **the twenty cheap identity arms are 103.6 s = 1.7 min between them.**

⛓ **26 IDENTITY ARMS JOIN THE POPULATION, NOT 6.** `¬cheap` is a CONSUMPTION clause and always was,
so CI RUNS the cheap ones and their lines are free evidence — exactly how the 18 non-CI-sourced
browser gates already work, and how a `@ci-shallow` gate still runs and still prints. 25 headless
(joining a job that already had submodules and `npm ci`), 1 browser.

**⛓ THE PARTITION MOVED, AND HERE IS WHAT IT MOVED TO — MEASURED TWICE, BECAUSE THE FIRST READING
WAS THE UNPRICED ONE.** `plan-seedling-r7-ends-meet --check` is a standing IDENTITY row that drives
a browser, so it is a browser ARM. **2 shards → 3**, and the three jobs are not the three anybody
would have guessed:

    at the push (ends-meet UNPRICED, so priced at the whole budget and alone):
      shard 0  seedling-wasm-element                901.2s   1 arm    <- ran 3, named in the job list
      shard 1  plan-seedling-r7-ends-meet --check   600.0s   1 arm       as `Browser gate shard —
      shard 2  the 23 light arms                    489.0s  23 arms      producer: plan-…-ends-meet`
    after `--write-costs` priced it from three runs at 212.3s:
      shard 0  seedling-wasm-element                897.5s   1 arm
      shard 1                                       599.1s   9 arms
      shard 2                                       109.7s  15 arms

⛔ **I PREDICTED IT WOULD STAY ALONE AND IT DOES NOT.** 489 + 213 > 600 is true and was the wrong
sum: the bin-packer is longest-first over ALL the arms, so ends-meet packs with eight lighter ones
to 599.1 s and the remaining fifteen make a 109.7 s job. ⛓ Still 3 shards, and **the wall clock is
unchanged either way** — `seedling-wasm-element` sets it and always will. Recorded because the arc's
standing instruction is to say what the partition changed to, and a predicted partition is not one.

**⛓ DRIVEN, NOT ARGUED — BOTH ARM SHAPES, END TO END, BECAUSE UNIT ROWS CANNOT SEE A CALL SITE IN AN
UNREACHABLE BRANCH** (this arc's own recurring shape, and S5c's reason for its one-row write):
· `--set=headless --shard=8` printed `## CI-GATE | identity: killgate s2 |
  1b4eab8ed32b8e709fe5fef6232e21d2 | exit=0` and its `##   ms |` line — the bank's own digest.
· `--set=browser --shard=1` printed `## CI-GATE | producer: plan-seedling-r7-ends-meet --check |
  67bd57b2b92bb70875e944f4d182da37 | exit=0 | here=228.8s` — the bank's digest again, **and it is
  the box-lock passthrough's own test**: `ci-gates` took the lock once and the non-gate child
  recognised itself as the holder's child (`boxLock` rule 3) instead of refusing. Nothing had
  established that rule 3 reaches a `bash -c` identity pipeline; it does, because `runRow`'s spawn
  inherits the token env like every other.

**FIVE MUTANTS, each caught by exactly the rows it should be, all restored byte-identical (md5):**
drop the ⚖ 72 (a) filter → 2 · `ciSourced` stops asking the arms → 4 · it drops `¬cheap` → 2 ·
`ciGateArms` stops appending identity arms → 5 · the set filter reads `gate.browser` again → 1.
⛓ The last is the one a reader would call cosmetic: an identity arm has no gate, so a rule that
reached through one would have thrown on the first of them.

**⛓⛓⛓ THE ECONOMICS, MEASURED AGAINST WHAT S2 ALREADY COLLECTS — AND THE HEADLINE 18.2 MINUTES IS
THE PRE-S2 PRICE, NOT S4c's PRIZE.** The brief costs the candidate set at 1,094.4 s = 18.2 min,
which is right as the SIZE OF THE SET and would be wrong as the saving: S2 keyed these rows, so a
`--write` has paid for one only when its input closure moved. Traced across the four writes after
S2's own (`4a99828ec`, `df127df68`, `e5c19cece`, `6768e1bec`):

    six rows x four writes = 24 row-opportunities
    actually driven:          2   (both `plan-seedling-r7-ends-meet`, at S4b's and S5's heads)
    box actually spent:     444.0s
    the same four writes, CI-sourced: 6 rows x 4 writes x ~6s of `gh` = ~144s

⇒ **S4c's measured saving over the last four writes is ~300 s, not ~73 min**, and the other four
rows have not been re-driven ONCE since S2 banked them 35 heads ago (`--keys` at this head: all six
`same`). ⛓ **The value is the TAIL, not the mean** — S4c removes the 18.2-minute worst case, which
lands on exactly the heads that move the seedling generator, i.e. the platformer arc's own. ⚠ And
the cost is the mirror image: a CI-sourced row is UNKEYED by construction (`unkeyableReason`: *"its
recipe already reads CI by SHA"*), so **S2's keying and S4c's quoting are the SAME 18 minutes claimed
twice, never two savings**, and post-S4c these six pay ~36 s of network on EVERY write including the
ones S2 was already answering for free.

⚖ **THIS IS A RULING QUESTION AND IT IS NAMED RATHER THAN DECIDED HERE.** The brief commissioned the
build on step 1 passing and it is built as briefed. But a cheaper shape exists and deserves to be
on the record: **keep the production side and DROP the consumption side** — CI would still publish
all 26 identity lines as free evidence (and as the ⚖ 72 (b) instrument), the six rows would stay
KEYED and cost nothing on unmoved heads, and the 18-minute tail would remain. That trades the worst
case for the network call. ⛓ Whichever way it is ruled, the production half is the half worth having
and it is not in question.

**⛓ THE DEFECT THIS SLICE LOOKED FOR IN ITSELF — AND THE HONEST ANSWER IS THAT IT IS NOT ONE.**
(The brief: *"three of the last four CI-widening slices shipped a defect the next slice had to
find. Expect to be the fourth unless you look for it."*) The candidate found was real and specific:
`--write`'s CI read was `runRow({ ...row, kind: 'ci-gate', command })`, and `{ ...row }` carries
`shell: true` — which no CI-sourced row had before S4c, because S4's six were all GATE rows. So the
`ci-summary` NETWORK CALL was being run wrapped in `identity-block.sh`'s digest helpers with
`exit "${PIPESTATUS[0]}"` after it. ⛔ **The mutant did not discriminate.** A helper that PRINTS was
added to `identity-block.sh` and both shapes returned the same value and the same exit, because
`identityShellHelpers`' extractor matches only whole FUNCTION DEFINITIONS (`^name () { … }$`) — the
prepended text cannot emit a byte, and `PIPESTATUS[0]` of a simple command is that command's own
exit. ⇒ shipped as a TIDY-UP with its inertness stated (`64e589b2a`), not as a repair. ⛓ That is
trap 1067's own question — *"what in the OUTPUT would differ if the change had not been made?"* —
asked against this slice's own work, and answered against it.

**⛓ THE BATTERY, RE-DERIVED OFF THIS SLICE'S OWN BANK: 38.8 → 19.8 min of full-freight box time**,
19.0 min of it now read from CI (the six identity rows' 18.2 plus the seven gate rows' ~42 s of
`gh`). ⛓ That is the brief's own *"a perfect S4c leaves the battery ≈20 min"*, met — and the floor
below it is `gate: seedling-wasm-ship` (474 s) plus the three other Windows rows, which ⚖ 72 (a)
keeps on the box forever.

**⇒ WHAT S4c LEAVES.**
· ⚖ **THE ECONOMICS RULING ABOVE** is the only open item this slice creates, and it is a design
  question rather than a defect: keep the consumption side, or keep only the production side and
  leave the six rows KEYED.
· `ci-arm-costs.json` now prices the identity arms as well; S5b's *"it goes stale on its own"* is
  unchanged and its repair is still one command.
· The audit's CI variant stays rejected on S5c's two counts.
· ⛓ `--plan --set=headless` read ~26 shards for one push, because every identity arm was UNPRICED
  and an unpriced arm is priced at the whole budget. It is **ONE shard, 422.0 s** now that
  `--write-costs` has seen them. Nothing consumed it either way — the workflow runs the headless
  set whole, with no `--shard=` — but it is written down because a reader who ran `--plan
  --set=headless` between the push and the re-price would have seen a number worth chasing.

**⛓ AND THE HEADLESS JOB'S OWN NUMBER, FROM ITS FIRST RUN CARRYING THEM: `31 headless arm(s)
reported; 0 non-zero; 4 skipped by name; 419.7s of arm time here.`** — 25 identity arms beside the
6 headless gates, inside a step whose kill deadline is 20 minutes. ⛓ The four `## CI-SKIPPED |
identity: …` lines are in the same log, so no reader has to work out why a row is absent.

**⛓⛓⛓ ⚖ 72 (b)'s BAR, MET PER ROW — FOUR CONSECUTIVE RUNS, EVERY IDENTITY ROW `same` IN EVERY
ONE.** Counted by `ci-summary --gates`, the ruling's own instrument (the bar asks for three):

    33582569819  49b2461df  push        53 same, 0 MOVED, 2 shallow, 1 not-banked, 0 MISSING
    33582603367  49b2461df  dispatch    53 same, 0 MOVED, 2 shallow, 1 not-banked, 0 MISSING
    33582627018  49b2461df  dispatch    53 same, 0 MOVED, 2 shallow, 1 not-banked, 0 MISSING
    33583214640  64e589b2a  push        53 same, 0 MOVED, 2 shallow, 1 not-banked, 0 MISSING

⛓ **SAME-HEAD DISPATCHES ARE THE RIGHT INSTRUMENT AND THAT IS DELIBERATE.** The bar exists because
of `preset-bundle-load` — a `userloaded:` page-error race that read MOVED once in four runs of its
shard — so what it tests is RUN-TO-RUN stability, which three runs of one head ask directly and
three heads would confound with tree movement. ⛓ The scratch run at `0e7454b67` is a fourth reading
at a DIFFERENT head, and it agrees.

⛔ **AND ALL TWENTY CHEAP IDENTITY ROWS READ `same` TOO** — they are not CI-sourced and nothing banks
them, but they are the negative control for the six that are: had CI's environment moved a digest
for a reason unrelated to the six, twenty other rows would have said so. `0 MISSING` is the other
half of that: every arm the plan holds published a line.

**THE CLOSING WRITE, AT THE HEAD RUN 4 CONCLUDED ON** (`64e589b2a`, run 33583214640 success).
`--write --key=` per row: **9.9 / 13.5 / 7.1 / 7.8 / 7.2 / 7.4 s = 52.9 s of `gh`** against 1,094.3
banked box-seconds. ⛓ **ZERO values moved** — every digest is the one the box banked, now cited to a
pushed head. Each row is `ciSourced: true` and UNKEYED, with the mechanism's own reason (*"its
recipe already reads CI by SHA"*). ⛓ **The partition audit printed GREEN in all six writes** —
*"the last CI run's shard partition HELD — run 33583214640 @64e589b2a, 4 job(s) that ran arms"* (3
before: the browser matrix gained a shard and the headless job is the fourth).


## 5l. The MAZE LAB ARMS — steppable SOLVE completion + a MANUAL arm — PLANNED 2026-09-02 (Fable planning session at main `f86b7b99a`; plan file `NewDocs/plans/maze-lab-arms-plan.md`, gitignored; memory `project_maze_lab_arms`)

**The ask (user, verbatim):** *"investigate if and how the lab page for the maze substrate should be
connected with the other maze substrate components, and whether there are any more features from the
Seedling substrate that would be worthwhile to add to the maze substrate. I specifically want the maze
lab page to have a steppable solve mode and a manual mode, like the Seedling lab page. Code for that
already exists elsewhere in the repository."*

**⛔ THE BRIEF'S CRUX WAS A STALE DOCBLOCK.** The launching session read `lab.html:42-45` (*"the plan is
drawn over the room"*, blame `8ee37b98` 2026-08-15) and concluded SOLVE is a one-shot verdict. **The
step-through landed the next day** — PROCGEN ELEMENTS arc 2 slice 4, `4e0ac0690` 2026-08-16:
`mazeLab.planFrames` replays the oracle's plan through the engine's own `step`, `lab.html:516-519` has
⏮ / ◀ STEP / STEP ▶ / ▶ PLAY, `window.__mazeLab.play` is the readout, `check-maze-lab.mjs` CLAIM 15
gates it (the block MOVES between frames; PLAY stops on the last frame), demo entry `maze-element`
demonstrates it. `maze.md`'s *The three modes* table (`:472`) is stale the same way (and says THREE
where the SET section below it makes four). ⇒ the tape-vs-plan question the brief led with DISSOLVES:
**a maze plan IS a tape** (the engine's input letters; `procgenMaze.js:2337`), `planFrames` IS the
stepper, and because the engine is turn-based the frames are precomputed rather than re-run.
Seedling's `watchSolve` shape (staging block → solver → span-folded tape → `createTapeStepper`) does
not apply and is not ported. What the maze lacks against Seedling is the SCRUB — a slider, a per-frame
HUD, the input strip (half a session), not a port.

**`manual` is a gap on the PAGE, not in the SUBSTRATE.** `mazeRoomUI._handleKeydown` (`:3330`) +
`KEY_MAP` (`:125`, arrows/WASD/space=WAIT) already drive `step` through `MazeRoomQueue`, the visit
recorder captures a `SavedQueue` of `{type:'move',dir}` actions (`:589-680`) and `_startReplayDriver`
replays it — two SPELLINGS of one walk (`stepsToInputs`/`stepsToActions` convert). None of it is
importable by the lab (the panel imports app core), so the design is: **a manual walk is a plan with a
human author** — one key = one engine input = one turn; `step` decides; accepted inputs are the walk;
`planFrames` replays it; the SOLVE arm's `play` object draws it. One stepper, one scrub, two authors.

**Part (a) — the map (plan §2).** `mazeLabBridge.js` is NOT the connection to the substrate: it is the
page→HOST bridge (`procgenLabPanel`, dynamic import under `?iframeId=` only). The lab's real connections
are the engine, `drawWorld`, the editor ops and the library adapter (already shared), the registry's
`roomEditor:{kind:'lab',page:'maze',arm:'set'}` → Edit ▸ (§5i W3), and the world bundle → ALL-MAZE
`rules.json` route (§5i W4) as the document-level path to region play. Two connections worth MAKING,
both cheap: a hoisted `mazeKeys.js` (one keyboard map, two importers) and `mazeRoomEngine.whyBlocked`
(one blocked-move reason beside `step`, agreement with `step` asserted as a PROPERTY over fixture
levels). NOT worth making: a live "play this level in the panel" hand-off. ⛔ `mazeGameDataPanel` is
the A-Mazing-Idle iframe inspector, not the maze substrate — the brief listed it. **§5i's Q4 stands;
nothing reopens it** — the manual arm drives the LADDER level; driving a library ROOM inside the SET
arm is named as a later question.

**Part (b) — the survey (plan §7).** ACCEPT: the scrub completion (S1), the MANUAL arm + walk I/O +
round trip (S2). OPTIONAL: a REACH overlay for a REFUSED solve — the maze's counterpart of Seedling's
decision trace — ⚠ needs `makeBfsSolver` to return its private `visited` (`shared/simulatorCore.js:151`)
= a `shared` SUBMODULE change ⇒ gitlink bump ⇒ ⚖; the PNG view exporter with `--page=maze`. REJECT,
with reasons: the REPLAY roster (pins nothing the identity rows do not), the GENERATE phase slider (the
maze model records no phases; a binding change for a picture the element overlay already tells), the
boot/staging panel (the `require` differential's `planWithoutKey` already answers it), `?level=` ◀ ▶,
per-layer checkboxes, `?walk=`/`?tick=`/`?solve=1`/`?speed=` (each a new parameter in the ONE
reader/writer with the generated reference and CLAIM 8 moving; none asked for).

**Where things live (plan §6):** everything in `mazeRoom/` — the session is `createState`/`step`/
`goalPred`; `whyBlocked` needs the engine-private `effectiveInventory`; the walk document is not
Seedling's tape (held-key sets over a staging block). The scrub CONTROL is the one neutral piece and
its second caller of the right shape does not exist at this head — lift `scrubView.js` to
`procgenCore/` when the platformer's lab page lands, and leave Seedling's until someone is paid to move
it. `editCore` was lifted at its second caller; this is why the answer is "not automatically the same".

**Design pins (plan §4–§5):** `SOURCES` gains `MANUAL`; `startStateFor(state)` extracted so
`planFrames`, `planCells` and the session boot from ONE construction (the round trip's whole
guarantee); `frameOf` exported; the goal predicate is the ORACLE's (`goalPred`); keys on WINDOW on the
ARM's lifetime; WAIT counted, not recorded (no hazards on a lab level; `step` has no WAIT); the walk
document `{kind:'maze-walk', payload:<labPayload>, walk:{author:'hand'|'oracle', inputs, reachedGoal}}`
in its OWN box (⛔ not a field on the level payload — `agreementWithPayload`'s blast radius); LOAD-walk
= the existing `loadPayload` then `replayWalk`, refusing BY NAME at the first illegal index; a walk
reaching the goal is a WITNESS line, `certified` untouched; a free SEAM line when the oracle REFUSED
the record a hand walk then completes; round-trip mutant named (replay booted WITHOUT the palette
items must red at the door). ⛔ CLAIM 17b (`check-maze-lab.mjs:2169`) regex-matches the literal
`[generate, edit, solve, set]` — it WILL red at S2 and that is the gate working; S2 reads
`Object.values(SOURCES)`.

**⚖ FOR THE USER (plan §8):** (1) is the EXISTING step-through what "steppable solve" meant (try
`lab.html?source=solve&seed=2&width=15&height=15&skeleton=rooms&areas=1&elements=guard;len=2;turns=1&count=2&run=1`
→ SOLVE → STEP ▶) — S1 completes it; stepping the SEARCH instead is S4 and needs the submodule bump ·
(2) `?source=manual` as the name · (3) witness-not-certification · (4) WAIT ignored vs recorded ·
(5) walk document in its own box · (6) no live panel hand-off · (7) extend `check-maze-lab.mjs`
(recommended: no new CI arm) vs a new gate file (a new arm is priced at the WHOLE 600 s budget until
CI measures it — its own shard for one run, `ciGatePlan.js:41-46`).

**LADDER (plan §9; trap 1047 checked — S2 CONSUMES S1's `play` object, and S1 is the cheaper, so the
orders agree):** **S0** docs truth (`lab.html` header + `#solvePanel` note + `maze.md:472`; the doc
edit owes the generator run + `procgenDocs/` vitest) → **S1** the scrub (`#labScrub`, HUD, input
strip, PLAY rate as a view setting; `__mazeLab.play` +`turn`/`inventory`/`input`/`author`; CLAIM 15
+3) → **S2** the MANUAL arm (`mazeLabWalk.js` +test, `whyBlocked` +property test, `mazeKeys.js`,
the arm, CLAIM 22 + 17b, demo `maze-manual-arm` as a `press` row gated in the page's own
disabled-state vocabulary, glossary `walk`/`witness`) → S3 (opt) the plan as a walk document →
S4 (opt, ⚖) REACH overlay → S5 (opt) the exporter. S0+S1 one Opus session, S2 its own.

**Pins each rung moves — DERIVED, never typed (plan §10):** `grep -c '^    check(' check-maze-lab.mjs`
(219 @f86b7b99a) · `demos.test.js` `toHaveLength(28)` → 29 · `glossary.test.js` 164 → 166 ·
`generate-procgen-reference.mjs --check` (the `source` enum is in the refusal text it scans) ·
`ci-gates.mjs --plan` (a new gate FILE is a new arm) · `standing-values.json` 66 rows; `gate: maze-lab`
231/0 and `gate: procgen-demos` 252/0 are CI-SOURCED ⇒ `--write --key=` at a PUSHED head, never on a
docs-only one. Runner cost of `maze-lab` 32.9 s (`ci-arm-costs.json`, max of 3 @`49b2461df`), box
59–65 s (§5i catalogue slice).

**Deltas against the brief, by §:** §"⛔ BUT `solve` ALREADY EXISTS" — wrong, it steps (above);
§"the likely crux" — dissolved; §"`mazeLabBridge` … the connection" — host bridge, not substrate;
§"WHAT TO SURVEY" — `mazeGameDataPanel` excluded; "≈20 modules" — 24 non-test + `mazeAlgorithms/` (4),
27 tests, by `ls`. Nothing under `kittyengine*` exists on this tree at this head.


**⇒ ⚖ ANSWERED + TWO REDIRECTIONS + THE TWO DEDUP SURVEYS — same session, later 2026-09-02 (plan Parts II–III).**
The user confirmed the SOLVE step-through exists (*"I didn't notice them at first because the layout was
different from the Seedling lab page, and there was no scrubber"* — layout consistency PARKED by the
user, not designed) · `?source=manual` YES · witness-not-certification explained (§13.1) and decided as
recommended · live panel hand-off NO for now · gate placement = extend `check-maze-lab.mjs`.
**REDIRECTION 1 — WAIT (§14):** *"We should add support for waiting in all parts of the maze substrate."*
Measured at `44e47f445`: the engine's `step` REFUSES `INPUT_WAIT` (`DELTAS` has no entry); the visualizer
has a private turn+1 branch BEFORE `step` (`:443-459`); the panel's `_executeWaitAction` (`:3571`) ticks
hazards and charges mana but never advances `state.turn` — two implementations of "a turn passes" that
DISAGREE, plus a refusal. Design: `step(…, WAIT)` = clone with turn+1, ONE place; the visualizer branch
retires; the panel's wait goes through `step` (its only `state.turn` readers are the visualizer-turn
mirror `:2165` and the "Reached exit in N steps" message `:3547` — measured, no decision reads it);
`INPUTS`/the oracle UNTOUCHED (`mazeVisitedKey` excludes `turn`, so WAIT would be a pruned self-loop —
and the maze byte-identity row is the CONTROL, not the reasoning); the lab records WAIT. New rung **S2a**
before the arm (trap 1047: the arm consumes the engine's WAIT).
**REDIRECTION 2 — the walk is a RECORDING (§15):** *"use the same system that the Loops module and the
JtA and omsi substrates use."* Checked: `loop-recording.md` + `loops-coarse-capture-plan.md` + the
gitignored loops M1–M5 kickoffs. The system = the universal `SavedQueue` envelope
(`savedQueueStore.js:25-50`), the maze GRANDFATHERED on its native `move`/`wait`/`locationCheck`
vocabulary (jta/omsi converged on `actionQueue`'s — *"converging the maze is optional and was explicitly
not done in M4"*), recordings EXCLUDE the departing move, loops the SOLE persister via `takeLastRecording`,
replay = `replayActions` = `MazeRoomQueue.appendAll`+`stepOne` (`mazeRoomUI.js:1770-1815`), and NO file
export/import of a `SavedQueue` exists anywhere. ⇒ §5.6's separate document is WITHDRAWN: the manual arm
IS a headless `MazeRoomQueue` (executor = `step`; `handleInput(KEY_MAP[key])` — the panel's own call at
`:3364`); the walk = `queue.actions` through a `projectActions` lifted from `_finalizeVisitOnExit`; the
recording = the `SavedQueue` envelope + an additive `lab:{payload, author, reachedGoal}` block, so a
lab walk and a region recording are ONE shape and a later loops importer (S6, opt) is a rename not a
rewrite; `framesForActions` is the ONE stepper (`planFrames` becomes its letter→dir wrapper — the letters
ARE the dirs). A refused key is NOT an action (the lab deletes it; the panel marks it done — measured
`mazeRoomUI.js:3483` — the two agree on what a recording MEANS). Persistence into the loops store: NOT
from the lab (no rulesHash, no region; sole-persister ruling).
**DEDUP SURVEY 1 — maze lab ↔ maze substrate (§16), 13 adopted, every one RE-READ at its line:** the
ENGINE-STATE BOOT restated 3× beside `makeStart`'s *"ONE START CONSTRUCTION"* docblock (M1 = S2b's
`startStateFor`) · the plan replayed through `step` in FOUR hand loops, `planCells` on EVERY DRAW
(`mazeLabView.js:693`) (M2 = `framesForActions`) · SEVEN delta tables (`DELTAS` not exported; ⛔ keep
the E,W,S,N order — BFS tie-breaks on it) · the IDENTITY field list restated 5× with a RECORDED DEFECT
(`mazeLabView.js:580-585`: `elements` missed `writeUrl`) · `elementInfo` hand-projects
`elementSummaryOf` and DROPS `drawsBefore` · ⛔ **the PANEL's pixel→tile is a LIVE BUG** — divides by
intrinsic `TILE_PX` and ignores the 1 px border (`mazeRoomUI.js:2887`) where the lab uses the tested
`tileAtPoint` · three copy-pasted param forms · `assertView` 3× · `worldAllMazeRulesJson` is a second
`worldRulesJsonOf` dropping `stats`/`dropped` (two rules.json paths on one page) · the room-open guard
twice with DIFFERENT exemptions · `bootLibrary`/`bootWorld` · `posKey` parsed 5×, not exported.
**⛔ ONE SURVEY FINDING WAS FALSE** (§16.3): *"`stepsToActions` silently drops a wait"* — re-read at
`mazeAutopather.js:146-149`: it has the branch. Recorded so nobody re-derives it.
**DEDUP SURVEY 2 — Seedling lab ↔ flash panel (§17), 11 adopted:** the `botLoadLevels` chunk delivery
written twice, agreeing ONLY because the panel's header records repairing `watchWasm`'s
`pending`-is-failure (F1: the lab should CONSTRUCT `SeedlingLevelSetDelivery`; the reverse import is the
1.0 MB bundle constraint) · `bot()` twice, the PANEL's worse (captures `g` once into an iframe whose
`__swfBridge` is replaced on reload; unknown verb THROWS; `readWorld` re-wraps = a third copy) · "poll
until" 4× on different axes · two READINESS witnesses (four page properties for two questions; a build
gaining `wireCheck` before `botStatus` boots one side and hangs the other) · `parsePendingCheck`/
`parsePendingExit` rule-for-rule twins ("EMPTY IS NOT ZERO" written twice) · `out_<type>_<x>_<y>` spelled
in a file whose docblock says "NOT SPELLED HERE" · THREE map-document path spellings, only the panel
honouring `region_atlas.map_document` · "which wasm build": the lab's `WASM_PAGE` literal vs the panel's
`builds.json` + capabilities (⚖ — a deliberate fixed point; the minimum is a GATE, not an import) ·
`16` restated 9× · two host transports over `labProtocol` with a docblock describing a resend the code
lacks (⚖ — `iframeAdapterCore` is in the `shared` SUBMODULE) · four level-index maps, one STRING-keyed.
NOT duplicated (checked): `KEY_CODES`, `levelSetDisagreement`, `labBridge`, the look book, every event
name, the exporters/validators (dynamic import, no copy); the two `__swfBridge` DIALECTS are deliberate.
**LADDER, REVISED (§18):** S0 docs → S1 scrub (+`framesForActions`) → **S2a WAIT** (+`DELTAS`/`posKey`
exports; byte-identity row = control) → **S2b MANUAL on `MazeRoomQueue`** → D1 readout correctness
(identity fields + `elementSummaryOf`) → D2 the panel pixel→tile BUG (measured under CSS scaling) →
D3 lab tidy → D4 world rules.json hook → F-a `flashPanel/`-internal → F-b the lab constructs the
delivery + `bot()`/readiness on the adapter (⚠ wasm gates on **`--win`**) → F-c/F-d ⚖ (submodule;
the build-literal gate) → S3–S6 opt. ⚖ OPEN (§19): layout (parked by the user), vocabulary
convergence (recommend NO), dedup order (D1+D2 first), F-c/F-d, S6, S4's submodule need.

**⇒ THE RECORDING FORMAT'S FEATURE CENSUS (plan Part IV, §20–§22) — user 2026-09-02:** *"I would like to
migrate the maze recordings to actionQueue eventually, if it makes sense to do so. For now, what matters
is that the maze recording format has all of the features that it needs."* Eighteen features derived
from what a maze VISIT can contain, checked against `_finalizeVisitOnExit`/`_replaySavedActions` at
`44e47f445`. Fourteen are present or implicit (moves, checks, arrival/departure, block/button/flag
through `step`, consumables through `_publishPlaybackEvents`, hazards reset on entry). **FOUR GAPS:**
⛔ **R2 replay integrity — a refused move is marked DONE and the driver CONTINUES** (`mazeRoomQueue.js:299`,
`mazeRoomUI.js:3483`): a recording replayed on the wrong level or inventory walks a different route and
Playback reports SUCCESS — the replayer must REFUSE BY NAME at the first refused action, both replayers,
one rule · **R1** `itemsPickedUp: []` is a LITERAL never filled (`:664`) · **R3** `requires:[items]`
DERIVED from the obstacles the walk crossed, refused before the first step · **R4** `worldDigest` via
`contentIdentity.computeContentHash` (an EDITED region — `layout.edits[]` — invalidates a recording while
the `rulesHash` bucket does not move) · **R5** `format:'maze-recording/1'` (only the STORE is versioned).
Rungs **R-a** (R1+R2+R5, with S2b — both replayers adopt R2 together) and **R-b** (R3+R4). **THE
actionQueue MIGRATION (§21):** the maze maps 1:1 (`move`→`actionId: dir`, `wait`→`loops: n`,
`locationCheck`→`actionId: name`), but `MazeRoomQueue` is the panel's LIVE queue (editCursor, mid-insert,
Backspace, append-and-execute, the icon row) not only a store shape — migrating the store alone would leave
two vocabularies in one panel. "Makes sense" = any of: a cross-substrate queue EDITOR showing maze
interiors beside jta's (the block builder), file interchange between substrates, `ActionQueue`'s
statuses/undo wanted in the panel. None live. **S2b lands `toActionQueueEntries`/`fromActionQueueEntries`
now** (round-trip tested both ways incl. wait compression; ⚠ `generateEntryId` uses `Date.now()` — an
injected id source, run twice) so the migration is a reader switch later. Ladder, final: S0 → S1 → S2a →
S2b(+converters) → R-a → R-b → D1–D4 → F-a/F-b → ⚖ F-c/F-d → opt S3–S6.

**⇒ THE actionQueue FORMAT REVIEW + THE MAZE MIGRATION MOVES FIRST (plan Part V, §23–§25) — user 2026-09-02:**
*"I was planning to eventually implement a cross-substrate queue editor, or at least a cross-substrate
queue viewer. Let's go ahead and make the switch to the actionQueue format before we do anything else
that involves recording. But first let's check if there are any changes we might want to make to that
format. It's still new and mostly untested."* (Also: the launching session is NOT in charge of this
arc and its context is full — no further report-backs.) **The package** (`shared/actionQueue/`, FIVE
files, 22 KB, in the `shared` SUBMODULE @917e4de ⇒ every change = gitlink bump = the user's push):
**ZERO tests inside it**; the only importer that tests it is `jtaQueueExecutor.test.js` (5 `it(`).
**ELEVEN FINDINGS, each at its line:** ⛔ **Q1 wall-clock `entryId`s are minted INTO recordings**
(`actionTypes.js:38` `aq_${Date.now()}_n`; jta's `convertPerformedActionsToQueue:106,116` and omsi's
`convertPlanToQueue:106` call it per entry) — so `savedQueueStore.isDuplicate`'s JSON compare
(`:99-102,122`) is **DEAD for every actionQueue substrate** and no byte-identity row over a recording is
possible · **Q2 the field list is restated 3× (`add`/`deserialize`/`undoLast`) and DROPS riders** —
omsi's `loopsType` survives only because omsi never passes a recording through `ActionQueue`; jta's
`taskType`/`maxReps`/`icon` are dropped on `add` (trap 823's shape) · Q3 scalar `actionId`, no `params`
(`useAllItems` is a separate actionType where a flag would do) · Q4 no `substrate` on an entry (a
platformer `move` vs a maze `move` are the same word) · Q5 no format version (`serialize()` → bare
`{entries}`; only the STORE key is `v1`) · Q6 no validation (`deserialize` normalises a malformed entry
silently) · **Q7 the cursor is not maintained by `add(atIndex)` or `reorder`** (only `remove` adjusts) —
jta escapes because it executes on the frozen `ExecutionSnapshot`; the maze's live queue would NOT ·
Q8 `label` stored in recordings though DERIVED · Q9 jta fields in the "game-agnostic" `RuntimeStatus`
typedef · Q10 `ActionQueue`'s own cursor/advance surface is unused by its only consumer · Q11 zero
package tests. **Changes A1–A10:** id-less recordings (ids are a live-queue concern) · one
`normalizeEntry`/`assertEntry` · optional `params` · optional `substrate` stamped by every converter ·
`format:'actionQueue/1'` · cursor maintenance + tests · `label` optional with `describeAction(entry)`
on the registry entry (the viewer's labeller) · generic `actuals` · package tests. **The `zoneId`
field is in the code and NOT the typedef** (jta's zone leaked into the shared shape). **THREE
VOCABULARIES MEET IN LOOPS** — gameState's path (`type`/`locationName`, also loops' `_liveCaptureBuffer`
read by `_applyCoarseReplacement` at `loopState.js:1742`), the maze's native, and actionQueue; the
migration retires the maze's; whether loops' own converges is the VIEWER's first design question (⚖).
**Q-b the maze switch (§24.2):** `MazeRoomQueue` STAYS as the live queue (25 pins on its editing
semantics) with actionQueue-shaped entries (`move`→`actionId: dir`, `wait`, `locationCheck`→`actionId:
name`, `substrate:'maze'`); live queue UNCOMPRESSED (one press = one icon), RECORDING compressed via
`loops` by `projectActions`, replay expands; every reader of `.dir`/`locationName` re-pointed incl.
`_applyCoarseReplacement` through one `coarseOf(entry)` adapter that reads both shapes; the store
upgrades legacy maze entries ON READ keyed on the PRESENCE of `type` and the key moves `v1→v2`;
`describeAction` on the maze registry entry (the icon-row glyph table is its second caller); R1/R2/R5
ride Q-b (same lines); **S2b needs NO converters** (§21's converter paragraph WITHDRAWN). Test pins
rewritten, derived by grep at `44e47f445`: `mazeRoomUI.test.js` 27 · `mazeRoomQueue.test.js` 25 ·
`manualMode.test.js` 6 · `mazeAutopather.test.js` 6 · `savedQueueStore.test.js` 4 · `mazeLab.test.js` 3 ·
`procgenMaze.test.js` 1; in-app `mazeBlockModeTests`/`mazeConsumableTileTests`/`playbackBotTests`.
**LADDER, RE-ORDERED (§25; trap 1047 re-checked — S2a moves AFTER Q-b because Q-b re-dispatches the
wait executor S2a rewrites):** **Q-a** format (submodule, ⚖ gitlink) → **Q-b** the maze switch (main) →
S0/S1 (may precede or run beside Q-a; no recording touched) → S2a WAIT → S2b MANUAL on the migrated
queue → R-b `requires`+`worldDigest` → D1–D4 → F-a/F-b → ⚖ F-c/F-d → opt S3–S6. **⚖ (§25):** (1) Q-a's
gitlink bump, all ten changes or a subset (recommend all; A1 and A7 have live consequences) · (2) keep
`MazeRoomQueue` as the live queue (recommended) vs replace with `ActionQueue` after A7 · (3) converge
loops' own path vocabulary now (recommend NOT in Q-b — the viewer's question; `coarseOf` reads both) ·
(4) run-length compression in recordings via `loops` (recommended).

**⇒ PART V RULED (plan Part VI, §26–§27) — user 2026-09-02:** *"I don't think there are any saved maze
queues that we need to worry about maintaining backward compatibility for. I'll also want to standardize
gameState and actionQueue at some point. I authorize the gitlink bump. I still expect that it would be
better to migrate the maze queue format now, but I'll trust your judgement if you disagree. I approve of
the rest of the plan."* ⇒ Q-b's on-read upgrade is DROPPED (legacy `substrate:'maze'` entries carrying
`type` are DISCARDED on load; the store key stays `v1`) · loops' path vocabulary converges LATER, in the
viewer's arc (a direction, not a rung; `coarseOf` is the seam it removes) · the gitlink bump is
AUTHORIZED for Q-a (recorded in the kickoff; submodule commit with the OUTER identity from the PRIMARY
tree) · **⚖ #2 FLIPS to REPLACE — the planner defers:** keeping `MazeRoomQueue` was a COST argument (25
pins), not a design one, and against a stated intent to standardize gameState too a maze-private queue
class would be the last thing left to migrate after the editor exists. So **Q-a also carries the
LIVE-queue surface into `ActionQueue`** (§26.1: `add(atIndex)` refusing the done region, `stepOne(executor)`
with `COMPLETED`/`FAILED`+`error`, `subscribe`, `removeAt`, `snapshot`, `drainPending`) and **Q-b DELETES
`MazeRoomQueue`** (its `ACTION_*`/`DIRECTIONS` move to `mazeKeys.js`; the maze executor turns a refused
`step` into `FAILED` + `whyBlocked` and STOPS the driver = R2 on the shared status vocabulary). **Kickoff
written: `NewDocs/plans/maze-lab-arms-sliceQa-prompt.md`** (ten changes each with its proving test; the
`zoneId` decision; byte-inertness owed on the jta/omsi in-app rows; ⚖ 52 bounded vitest; the submodule
ceremony; ⛔ no report-backs). Q-b's kickoff is written AFTER Q-a's as-built, off its real exports.
Ladder final: Q-a → Q-b → S0/S1 → S2a → S2b → R-b → D1–D4 → F-a/F-b → ⚖ F-c/F-d → opt S3–S6.

**⇒ Q-a AS BUILT (2026-09-02; submodule `frontend/modules/shared` @`ef31e39`, outer `main` @`7e9cd873b`
— the gitlink bump the user authorized).** All ten changes landed. Every number below names the command
that produced it.

| A# | as built | where |
|---|---|---|
| A1 | recordings are ID-LESS. `serialize({ids:false})` drops `entryId`; the DEFAULT keeps it (loadouts and the live queue need identity). `normalizeEntry(raw, {mintId})` mints only on the live-queue path — `add`, `deserialize`, `undoLast` all pass `{mintId:true}`, the two converters pass nothing | `actionTypes.js`, `actionQueue.js`; `jtaSubstrateWrapperLibrary.convertPerformedActionsToQueue`, `omsiSubstrateWrapperLibrary.convertPlanToQueue` |
| A2 | ONE `normalizeEntry(raw, {mintId})`. The three hand-written eight-field copies are gone; an unknown key is KEPT under `params`. `updateEntry` re-normalizes too, so a rider passed there also lands in `params` and the key order stays canonical | `actionTypes.js:normalizeEntry` |
| A3 | optional `params`, keys sorted, AND the declared fields emitted in a FIXED order (`DECLARED_KEYS`) — byte-identity needs both, since `JSON.stringify` follows insertion order | same |
| A4 | optional `substrate`; both converters stamp theirs; an entry without one is legal | converters + `validateEntry` |
| A5 | `serialize()` → `{format:'actionQueue/1', entries}`; `deserialize` refuses an unknown format naming BOTH the one it got and the one it wants, and accepts a legacy bare `{entries}` as `/1` (which is what every stored jta LOADOUT is) | `ACTION_QUEUE_FORMAT`, `actionQueue.deserialize` |
| A6 | `validateEntry(entry) → string\|null` + `assertEntry(entry, where)`. Called by `add`, `deserialize`, and `savedQueueStore.saveQueue` for every action of an actionQueue-shaped recording (detected on the FIRST action carrying a string `actionType`; a recording in another vocabulary passes through untouched) → `'invalid'`, with the field named on the console | `actionTypes.js`, `savedQueueStore.js:actionQueueProblem` |
| A7 | `add(entry, atIndex)` REFUSES `atIndex < cursor` by name; inserting AT the cursor is legal (the new entry becomes next to run, and no cursor shift is ever needed once the done region is closed). `reorder` refuses when EITHER end is `< cursor`. `remove` keeps its decrement | `actionQueue.js` |
| A8 | `label` optional; converters stop writing it; `describeAction(entry) → string` is an optional slot on the registry ENTRY CONTRACT, declared by jta and omsi | `substrateRegistry.js` + `substrate-registry.md` "Action labelling" |
| A9 | `RuntimeStatus`'s five jta fields → a generic `actuals: object`; `startTime`/`endTime`/`actualTimeMs` stay top-level (they are not one game's economy). `updateStatus` MERGES `actuals` in both `ActionQueue` and `ExecutionSnapshot` — jta writes it in three passes and an assign would have dropped the earlier ones | `actionTypes.js:mergeStatus`, `jtaQueueExecutor.js`, `jtaQueuePanelUI.js` |
| A10 | `subscribe(listener) → unsubscribe` (emits on add/remove/removeAt/reorder/updateEntry/updateStatus/clear/deserialize/undoLast/advance/reset/stepOne/drainPending, with a batch guard so `stepOne` is ONE emit), `stepOne(executor) → {entry,state,error,result}`, `removeAt(index)`, `snapshot()` (frozen entries+statuses+cursor), `drainPending() → count` | `actionQueue.js` |

**⚖ `zoneId` — decided: a jta RIDER in `params`, not a declared field.** It is jta's zone; a shared
shape that declares one game's geography is exactly the leak Q3 named, and A2's fold makes it free —
`createQueueEntry` and `jtaQueueBuilder.makeTaskEntry` keep writing `zoneId` at the top level of the raw
object and `normalizeEntry` puts it in `params` for them (which is also why `jtaQueueBuilder.js`, outside
the touchable list, needed no edit). `jtaQueuePanelUI` reads it through one `entryZoneId(entry)` helper at
both sites. Pinned by two rows in `jtaActionDefs.test.js`.

**THREE DEFECTS THE TESTS FOUND — all in the brief's own premises.**
1. ⚠ **`blockAnnotations.js:93` reads `a.label` to NAME the consumed item.** §3 of the brief listed this
   file as "unchanged — `actionType === 'useItem'` at :92". Line 93 is the one that breaks: with A8
   dropping the stored label, every recorded jta item use would have keyed as `jta/null` and been
   dropped by `itemKey`, silently emptying the item annotations. Fixed the way A8 intends — the
   substrate's `describeAction`, with `label` as the fallback — and pinned by a NEW blockModes row
   ("names a LABEL-LESS item use through the substrate's describeAction", 140 → 141 rows in that file).
2. ⚠ **A6's `loops` integer ≥ 1 would have made every omsi recording unsaveable.** `convertPlanToQueue`
   preserves a 0-rep plan entry deliberately (`_readLoops`, pinned since arc D slice 4). The rule shipped
   as **integer ≥ 0**, with the reason in the doc comment.
3. ⚠ **A6's `disabled` boolean / `loops` integer as REQUIRED fields refused legal recordings.** Caught by
   `blockModes.test.js` going red: a hand-built or legacy recording omits them and the store validates
   RAW entries, before `normalizeEntry` fills the defaults in. The rule shipped as **`actionType` is the
   one REQUIRED field; every other field is refused by name only when PRESENT and wrong.**

**Two smaller as-builts.** The jta queue panel gained `entryLabel(entry)` = `label` → registry
`describeAction` → raw `actionId`, so a REPLAYED recording (whose entries now carry no label) still
renders names in the current-list, the tooltips and the prediction-vs-actual table; the executor's debug
line got the same fallback. jta's labeller is a module-level name index fed by the performed-actions
capture and by a new exported `noteCatalogNames(catalog)` — the seam a future viewer wires the live
catalogue into; omsi needs none (the action name IS the `actionId`).

**Where the tests landed and why.** `actionQueue.test.js` (47) and `executionSnapshot.test.js` (3) are IN
THE SUBMODULE beside the sources — `vitest.config.js:10` includes `frontend/**/*.test.js` and 24 other
`*.test.js` already live under `frontend/modules/shared/`, so no config change was needed and the package's
first tests travel with the package to any consumer of the `shared` repo. Consumer-side rows went to the
consumers: converter shape + `describeAction` in each wrapper's own test, `zoneId` → `params` in
`jtaActionDefs.test.js`, the dedup/refusal rows in `savedQueueStore.test.js`, the labeller row in
`blockModes.test.js`.

**Discriminators, run rather than reasoned** (traps 1067/1070/1072 — mutants applied to a copy, restored
from the copy, never `git checkout`): re-minting `entryId` in the jta converter reds **3** rows including
`savedQueueStore` "a re-record of an unchanged jta visit reads 'duplicate'"; making `normalizeEntry` drop
unknown keys again reds **3** rows including "an omsi rider survives add → undoLast → undoLast →
serialize". Both byte-identity claims run the converter TWICE and compare, per
`feedback_stdout_inertness_needs_a_nondeterminism_control`.

**Gates.** ⚖ 52 bounded vitest, one command:
`npx vitest run frontend/modules/shared/ frontend/modules/jtaQueueEngine/ frontend/modules/jtaActionQueue/ frontend/modules/jtaSubstrateWrapper/ frontend/modules/omsiSubstrateWrapper/ frontend/modules/loops/ frontend/modules/procgenDocs/ frontend/modules/mazeRoom/`
→ **95 files / 3051 tests, 0 failed** (`jtaQueueExecutor.test.js` still 5/5; the package's own 50 are
inside it). `node scripts/procgen/generate-procgen-reference.mjs --check` → ALL 6 GENERATED MODULES AND 4
MARKDOWN REGIONS MATCH (the registry matrix moved 61 → 62 fields, 10 → 11 groups, one `describeAction`
row, `fn` under jta and omsi). In-app `npm test -- --mode=test-substrates --batch=fast` → **61/61 PASSED,
3.5 min**, no `compare-runs` attribution needed. Suite row from CI by SHA: `ci-vitest-summary.mjs 7e9cd873b`.

**What Q-b reads off this — the exact exports.**
`shared/actionQueue/index.js` exports `ActionQueue`, `ExecutionSnapshot`, `LoadoutManager`, `ActionState`,
`ACTION_QUEUE_FORMAT`, `normalizeEntry`, `validateEntry`, `assertEntry`, `mergeStatus`, `generateEntryId`.
`ActionQueue`'s surface for the maze executor: `add(entry, atIndex?)` · `removeAt(index)` ·
`remove(entryId)` · `reorder(from, to)` · `updateEntry(entryId, changes)` · `currentEntry()` ·
`stepOne(executor)` → `{entry, state, error, result}` · `advance()` · `drainPending()` · `reset()` ·
`clear()` · `snapshot()` → `{cursor, running, entries:[{…entry, status}]}` · `getEntries()` ·
`getStatus(entryId)` · `updateStatus(entryId, update)` · `subscribe(listener)` → unsubscribe ·
`serialize({ids})` / `deserialize(data)` · `undoLast()` / `recordLast()` · `findIndex(entryId)` ·
`isExhausted()` · getters `length`, `cursor`, `running`.
⚠ Three things Q-b must know that the plan did not say: (i) `add` THROWS a `RangeError` into the done
region and `reorder` THROWS across the cursor — `MazeRoomQueue` clamped silently, so the keypress handler
owns the refusal now; (ii) `stepOne` advances even on FAILED, so R2's "stop the driver" is the CALLER's
`if (out.state === 'failed') stop()`; (iii) the maze's `describeAction` is owed by the same slice that
switches the entry shape, because `blockAnnotations` and the panel now both ask for it.


**⇒ Q-b AS BUILT (2026-09-02; outer `main` @`ede5285be`, submodule UNTOUCHED at
`ef31e39` as the brief required).** `MazeRoomQueue` is DELETED; the maze panel holds a shared
`ActionQueue` and its recordings are `actionQueue/1`. Three commits: `6f50a2608` (the migration),
`6db444128` (the tests), `ede5285be` (the docs + the regenerated matrix).

**Every file touched.**

| file | what |
|---|---|
| `mazeRoom/mazeKeys.js` | NEW, 121 lines, DOM-free and ENGINE-free. `MAZE_SUBSTRATE`, `ACTION_MOVE/WAIT/LOCATION_CHECK` (same string values), `ACTION_TYPES`, `DIRECTIONS`, `mazeEntry`/`moveEntry`/`waitEntry`/`locationCheckEntry`, `KEY_MAP`, `describeMazeAction`. S2b imports this file whole. |
| `mazeRoom/mazeQueueExecutor.js` | NEW, 235 lines, headless. `executeMazeEntry`, `MOVE_DIR_TO_INPUT`, `MOVE_DIR_TO_DELTA`, `intendedTileFor`, `isRefused`, `projectActions`, `expandEntries`, `expandedLength`. |
| `mazeRoom/mazeRoomUI.js` | `_mazeQueue = new ActionQueue()`; `_editCursor` + `_queueRefusal` are new panel state; `_runEntry` (bound), `_clampedEditIndex`, `_setEditCursor`, `_appendEntries`, `_clearPendingEntries`, `_abortReplay`, `_notePickupForVisit` are new methods; `_executeQueueAction`/`_executeMoveAction` take an ENTRY and return a reason; `_handleKeydown`, `_replayBestPath`, `_replaySavedActions`, `_startReplayDriver`, `_renderActionQueue`, `_renderQueueIcon`, `_finalizeVisitOnExit`, `_startVisitRecording`, `_populateLoopsDrivenQueue`, `_getReplayableTargets` rewritten. Local `KEY_MAP`/`MOVE_DIR_TO_*` deleted; `INPUT_N/S/E/W`, `step` and `getObstacle` no longer imported here. |
| `mazeRoom/mazeAutopather.js` | `stepsToActions` emits `moveEntry`/`waitEntry` — ONE entry per step; the fold is the recorder's. |
| `mazeRoom/mazeRoomLibrary.js` | the registry entry gains `describeAction: (entry) => describeMazeAction(entry)`. |
| `loops/loopState.js` | NEW exported `coarseOf(entry)`; `_applyCoarseReplacement` reads it. |
| `loops/savedQueueStore.js` | `isLegacyMazeRecording` + the `loadCache` filter + `_testOnly_resetCache`. |
| `mazeRoom/mazeRoomQueue.js`, `mazeRoomQueue.test.js` | **DELETED** (346 + 540 lines). |
| tests | `mazeQueueExecutor.test.js` NEW (35 rows); rows added to `mazeRoomUI.test.js`, `mazeRoomLibrary.test.js`, `mazeAutopather.test.js`, `loops/loopState.test.js`, `loops/savedQueueStore.test.js`; fixtures rewritten in `mazeRoomUI.test.js`, `mazeAutopather.test.js`, `loops/manualMode.test.js`, `loops/savedQueueStore.test.js`. |
| docs | `loop-recording.md` (the "grandfathered" paragraph replaced), `maze.md` § *The action queue* (retitled, three files named, the R2 rule), `substrate-registry.md` (`describeAction` prose + the GENERATED matrix row `— → fn` under `maze`), `README.md` word counts (generator). |

**⚠ FOUR THINGS THIS SLICE OVERTURNED IN ITS OWN BRIEF — all found by building, not by reading.**

1. **§3.4/§20's R2 and §15.4's "the panel keeps a refused press" CONTRADICT each other, and neither
   half is safe alone.** The panel appends a bumped-wall press to the queue and the recorder slices
   the queue, so a recording CAN contain a refusal; R2 replaying that recording would then refuse a
   legal script. The obvious fix — drop refused entries from the recording ("a plan has no no-ops",
   §15.4) — is WRONG here: `_executeMoveAction` ticks hazards whether the move ran or not, so a
   dropped entry shifts every later hazard phase and manufactures the divergence R2 exists to catch.
   **Shipped: keep it, mark it.** `projectActions` stamps a `FAILED` entry `params: {refused:true}`
   (Q-a's rider bag, A2), and `_runEntry` throws only for a refusal the entry does NOT carry. So a
   refusal reproduced is a COMPLETION and a refusal that is new is a FAILURE — which is what
   "replayed on a level it was not made on" actually means. ⚠ The converse (an entry marked refused
   that SUCCEEDS at replay) is also a divergence and is deliberately NOT checked: the side effects
   have already landed by the time you know, and the cheap half buys the whole R2 mutant.
2. **The replay-failure shape: PARKED, not a `loops:substrateActionCompleted` failure.** Derived,
   not chosen — `_handlePlaybackReplayEntry` (`loopState.js:1812` after this slice's insert) and
   `_handleCustomQueueEntry` (`:2637`) both park the block, publish `loopState:manualEntered`, and pass an `onComplete` that
   is a literal no-op ("reserved for future UI"); the block advances on the departing `regionMove`
   wake. There is no completion event on this path to fail into — `substrateActionCompleted` belongs
   to the `substrateActionBegan` DELEGATION path, which is a different driver. So the refusal is
   *withholding the completion*: `_abortReplay` stops the driver and never calls `onReplayComplete`,
   so `_crossRecordedDeparture` never fires, no `regionMove` wakes the block, and it stays parked in
   manual mode with the panel's message naming the index and the reason. That is the shape
   `loopState` already handles.
3. **§24.2's reader list was wrong in one place and short in another.** `mazeRoomVisualizer` does
   NOT mirror queue actions — its `locationName` hits are event payloads and its `.dir` hits do not
   exist; it needed no edit. And `mazeAutopather.stepsToActions` (which §24.2 did name) is the only
   OTHER producer of maze entries, so `mazeKeys` had to be importable from the autopather — which is
   why `mazeKeys.js` imports nothing at all, not even the engine (`MOVE_DIR_TO_INPUT` lives in
   `mazeQueueExecutor.js` instead, where the engine is already imported).
4. **`ActionQueue` has no `clearPending` and no `appendAll`.** `MazeRoomQueue` had both and the
   panel used them at seven sites (3 `clearPending`, 4 `appendAll`, counted at `d557038b3`). `clear()` takes the DONE history with it, and the recorder slices
   the done region on exit — so `_clearPendingEntries()` removes from the tail down to the cursor
   (panel-side, 8 lines) and `_appendEntries()` is a loop of `add`. ⚠ Worth knowing for the viewer
   arc: "drop the pending tail, keep the history" is a live-queue affordance the shared class lacks.

**The counts, re-derived rather than reused.**

- ⚠ The planner's grep of `actionQueue.test.js` (37) undercounted; **vitest says 47**, which is what
  Q-a's as-built claimed. The gap is `it(` titles written as concatenated string literals across two
  lines. `grep -c "^\s*it("` is not a test count in this repo.
- The old-shape pin census, re-run at `d557038b3` with the brief's own grep over
  `frontend/modules/mazeRoom frontend/modules/loops --include=*.test.js`: **113 grep-lines over 11
  files**, not the brief's 72 over 7 — the brief's list omitted `loops/blockModes.test.js` (33),
  `loops/actionQueueManager.test.js` (6), `loopEvents` (1) and `loopBlockBuilder` (1).
- **65 of those 113 are gone**, all of them genuinely the retired maze vocabulary: 25 died with
  `mazeRoomQueue.test.js`, 24 in `mazeRoomUI.test.js`, 6 in `mazeAutopather.test.js`, 6 in
  `manualMode.test.js` (7 literals — one line held two) and 4 in `savedQueueStore.test.js` (5
  literals).
- The same grep now gives **54 lines over 9 files**, and every survivor was JUDGED rather than left:
  `blockModes` 33 + `actionQueueManager` 6 + `loopEvents` 1 + `loopBlockBuilder` 1 + the 3 left in
  `mazeRoomUI.test.js` are **loops' PATH vocabulary** (`observeParkedLiveAction` payloads,
  `_liveCaptureBuffer`, gameState path entries, and the loops-action arguments to
  `_populateLoopsDrivenQueue`) and stay by design; `mazeLab.test.js` 3 + `procgenMaze.test.js` 1 are
  the **door-key gadget template's `dir` parameter**, never a queue verb at all (⚠ the brief warned
  that `locationName` over-matches; `dir: '` over-matches too); `loopState.test.js` 4 are the NEW
  `coarseOf` branch-(ii) rows and `savedQueueStore.test.js` 2 are the NEW legacy-filter fixtures —
  both deliberately written in the shapes they exist to read.
- **Legacy maze entries dropped: 0 observed, and ⚠ the measurement is narrower than the brief's
  question.** The in-app `test-substrates` run drove the real app against the real store and the
  filter's console line (`[savedQueueStore] dropped N maze recording(s)…`) fired **0** times
  (`grep -c "savedQueueStore.*dropped"` over the run log). That is a CLEAN-PROFILE browser: this
  session has no read access to the user's own long-lived Chrome profile, so "0" is what the harness
  saw, not a claim about the user's disk. Consistent with the user's own ruling that there were no
  saved maze queues worth keeping — and the filter is a no-op when there are none.

**Decisions the brief asked for, answered.**

- **Folded vs expanded count** (`_getReplayableTargets`): the button shows the **EXPANDED turn
  count** (`expandedLength(q.actions)`). A folded recording's `actions.length` is now a storage
  detail — a 40-step corridor is ONE row — and the button promises the player a walk length. Pinned
  ("the replay button promises the EXPANDED turn count, not the stored row count", 7 for a
  `loops: 7` entry).
- **The edit cursor** is panel state (`_editCursor`), not a `MazeRoomQueue` field and not a new
  `ActionQueue` field. `_clampedEditIndex()` clamps into `[queue.cursor, queue.length]` before any
  index reaches `add`/`removeAt`. Its discriminator is a row of its own: *an unclamped done-region
  index really does throw a `RangeError`* — so the clamp is load-bearing, not decorative.
- **Wait** is unchanged behaviour (`next === state`, the panel keeps its hazard tick and mana around
  it); `executeMazeEntry`'s `ACTION_WAIT` branch carries the one-line comment S2a edits.

**Gates, each with the command that produced it.**

| gate | command | result |
|---|---|---|
| ⚖ 52 bounded vitest | `npx vitest run frontend/modules/mazeRoom/ frontend/modules/loops/ frontend/modules/shared/actionQueue/ frontend/modules/playbackBot/ frontend/modules/procgenDocs/` | **61 files / 2377 tests, 0 failed** |
| in-app | `npm test -- --mode=test-substrates --batch=fast` | **61/61 PASSED, 3.4 min** (the five maze rows and both seedling-atlas-maze rows among them) |
| attribution | `node scripts/test/compare-runs.js` | `05-00-54` → `05-40-04`, both 61/61 — *No differences in status, roster, or duration* |
| `gate: maze-lab` UNMOVED | `node scripts/procgen/check-maze-lab.mjs` | **231 rows, 0 FAIL** — the claim at `44e47f445`, unmoved |
| maze byte-identity UNMOVED | `node scripts/procgen/dump-maze-byteidentity.mjs 2>/dev/null \| md5sum` | `677b7d9cae51023e82fa2e365a8095dc` — the standing value |
| procgen reference | `node scripts/procgen/generate-procgen-reference.mjs --check` | ALL 6 GENERATED MODULES AND 4 MARKDOWN REGIONS MATCH (registry 62 fields / 11 groups unchanged; the maze's `describeAction` cell moved `—` → `fn`) |
| cold verify | fresh detached worktree at `ede5285be`, submodule re-init to `ef31e39` | bounded vitest **61/2377**, generator `--check` PASS, byte-identity md5 identical |

**FOUR MUTANTS, RUN NOT REASONED** (each applied to a copy and restored from the copy — trap 1072;
every one was applied on a COMMITTED tree):

| mutant | reds |
|---|---|
| A — remove the stop-on-`FAILED` from both replay drivers (the brief's own R2 mutant) | **2**: "the ticked driver stops at the first refused entry…" and "the INSTANT drain obeys the same rule". The driver walks on, exactly as before Q-b. |
| B — `projectActions` never folds a run | **9** over two files, including the fold round trip, the byte-stability row and "the recording is FOLDED: a 4-step corridor is ONE entry" |
| C — `projectActions` DROPS a refused entry instead of marking it | **4**, including "a REFUSED turn stays in the recording, marked, because it consumed a turn the hazard phase depends on" |
| D — `isLegacyMazeRecording` returns false for everything | **2**: the discard row and the console-count row |

**What S2b reads off this — the exact signatures.**

```js
// mazeRoom/mazeKeys.js  — DOM-free, engine-free; import the whole file
MAZE_SUBSTRATE = 'maze'; ACTION_MOVE/ACTION_WAIT/ACTION_LOCATION_CHECK; ACTION_TYPES; DIRECTIONS
mazeEntry(actionType, actionId = null, loops?) -> {actionType, actionId, substrate, loops?}
moveEntry(dir, loops?) · waitEntry(loops?) · locationCheckEntry(name)
KEY_MAP: {DOM key -> entry}          // arrows + WASD + ' '
describeMazeAction(entry) -> string  // 'move E' | 'wait' | 'check <name>'; the ×n is the CALLER's

// mazeRoom/mazeQueueExecutor.js — headless
executeMazeEntry(world, state, entry, {inventoryOverride, clearanceOpts}) -> {next, reason}
    // next === state  : the verb passes a turn with no engine transition (wait, locationCheck)
    // next === null   : REFUSED, and `reason` is one sentence
MOVE_DIR_TO_INPUT · MOVE_DIR_TO_DELTA · intendedTileFor(from, dir) · isRefused(entry)
projectActions(entries, from = 0, to?) -> stored entries   // entries may carry snapshot `status`
expandEntries(entries) -> one entry per turn, loops: 1
expandedLength(entries) -> number
```

- ⚠ **`refusalReason` is where `whyBlocked` lands.** It is one private function in
  `mazeQueueExecutor.js` and it deliberately does NOT re-derive `effectiveInventory`: it says
  *wall or off-grid* / *obstacle '<id>'* / the bare *blocked at (x,y)* (which is what a refused BLOCK
  PUSH falls through to, pinned as such). S2b replaces its body with
  `mazeRoomEngine.whyBlocked(world, state, input)` and nothing else moves — every caller already
  reads one string.
- ⚠ **S2a's `_executeWaitAction` is still the panel's**, and `executeMazeEntry`'s `ACTION_WAIT`
  branch is the second place to edit (three lines and a comment naming S2a).
- ⚠ **The lab's manual arm gets the clamp for free only if it copies it.** The shared class throws;
  `mazeRoomUI._clampedEditIndex`/`_setEditCursor` are ~15 lines of panel code that S2b will want in
  the lab too. If a third caller appears, promote them — not into `ActionQueue` (the edit point is
  UI state, per Q-a A7's own reasoning) but into a small `mazeQueueEditing.js`.
- **R-b (`requires`, `worldDigest`) is unblocked**: the refusal path it sits under is
  `_abortReplay` + `params.refused`, both in place.

**⇒ Q-a + Q-b VERIFIED BY THE PLANNER; PLAN PART VII; S2a LAUNCHED (2026-09-01/02, `maze-lab-planning`).**
Q-a (submodule `ef31e39`, main `7e9cd873b`/`d557038b3`) and Q-b (main `089d809a9`) both re-checked on disk:
gitlink matches, `MazeRoomQueue` gone, the named exports present, bounded vitest 52 files/1855 green at
Q-b's head, `actionQueue.test.js` = **47 by vitest** (the planner's `grep -c it(` read 37 — multi-line
titles; a count in prose again). **DESIGN CHANGE Q-b FORCED, accepted (plan §28):** plan §15.4 ("the lab
drops a refused press") is WITHDRAWN — a refused move still TICKS HAZARDS, so dropping it from a recording
shifts every later hazard phase and MANUFACTURES the divergence R2 catches; shipped for BOTH replayers:
`projectActions` keeps the entry with `params:{refused:true}`, a reproduced refusal is a COMPLETION, a new
one a FAILURE (`isRefused`/`_abortReplay`) ⇒ S2b's lab arm KEEPS refused presses too. Replay failure =
the block stays PARKED (no `substrateActionCompleted` on that path — derived from `loopState.js:1812/2637`).
Other corrections on the record: the visualizer mirrors nothing; the pin table was 113 lines/11 files not
72/7 (four hits were the door-key template's `dir` PARAMETER); `ActionQueue` has no `clearPending`/
`appendAll` — "drop the pending tail, keep the history" is a viewer-arc design line; the edit cursor is
PANEL state (S2b copies ~15 lines). **S2a kickoff written and launched** (`NewDocs/plans/maze-lab-arms-sliceS2a-prompt.md`,
`maze-lab-arms-sliceS2a`): WAIT through `step` at FOUR sites (engine, `executeMazeEntry:118`, the
visualizer's private branch `:443`, the panel's `_executeWaitAction:3640`); `INPUTS`/oracle untouched;
the maze byte-identity row read BEFORE and AFTER as the control; the `next === state` callers re-derived;
mutant = `step` refusing WAIT again must red three rows. S2b's kickoff follows S2a's as-built.

**⇒ S2a AS BUILT (2026-09-02; outer `main` @`6a8b285b6`, ONE commit, no submodule touched).**
`INPUT_WAIT` is an engine input. `step(world, state, INPUT_WAIT)` returns `cloneState(state)` with
`turn + 1` and nothing else moved, handled BEFORE the `DELTAS` lookup; the three surfaces that used
to disagree about what a turn was now all read that branch.

**The four sites, each as it stands.**

| site | before | after |
|---|---|---|
| `mazeRoomEngine.js` `step` (`:673` after the insert) | `DELTAS['WAIT']` is `undefined` ⇒ `return null` — **the engine REFUSED a wait** | a 5-line branch ahead of the lookup: `cloneState` + `turn += 1`. No pickup (`getItem` is only reached on arrival), no push (the block scan is inside the delta branch), no inventory change. The `INPUT_WAIT` doc-comment at `:47`→`:58` now says why it is NOT in `INPUTS` |
| `mazeQueueExecutor.js` `executeMazeEntry` `ACTION_WAIT` (`:118` → `:122`) | `return { next: state, reason: null }` + the S2a comment | `return { next: step(world, state, INPUT_WAIT), reason: null }`; comment deleted; `INPUT_WAIT` added to the engine import |
| `mazeRoomVisualizer.js` `_tick` (`:443` at `089d809a9`) | a PRIVATE branch ahead of `step`: `this._state.turn += 1`, its own `_log.push`, its own `_publishSnapshot`/`_notifyChange`, its own `return` — 17 lines | **DELETED.** A WAIT falls into the normal path: `step` → `detectStepEvents` (empty) → the one `_log.push`, which writes `from === to` and `turn` off the returned state. `INPUT_WAIT` dropped from the file's imports (no longer named in code) |
| `mazeRoomUI.js` `_executeWaitAction` (`:3750` at `089d809a9`) | hazard validation at `(pos,pos)`, mana charge, `_tickAndCheckHazards()` — **never touched `state.turn`** | all three kept, plus `executeMazeEntry(world, state, entry ?? waitEntry())` and `this.state = next`. Takes the entry now (`_executeQueueAction` passes it); the parameter is optional so the keyboard path and the older tests still call it bare |

**The `next === state` callers, re-derived.** `grep -rn -- "=== state\|next === " frontend/modules/mazeRoom/ frontend/modules/loops/` gives **one** non-test, non-doc hit that is about `executeMazeEntry`: `mazeRoomUI._executeMoveAction` (`:3697`), and it tests `next === null` (refusal), not `next === state`. **Nothing read `next === state` to mean "no transition."** So there was no condition to re-derive from the entry — the contract comment is what changed instead: `next === state` is now the `locationCheck`'s ALONE, said in `executeMazeEntry`'s JSDoc and pinned by an executor row that names it. (`mazeRoomVisualizer.js:463` and `procgenMaze.js:2825` are `next === null` on `step`, and `mazeRoomUI.js:3466` is `this._editCursor === next` — a different `next`.)

**⚠ THREE THINGS THIS SLICE OVERTURNED IN ITS OWN BRIEF.**

1. **`mazeRoomVisualizer.test.js` had ZERO wait rows, not the brief's "5 (re-count)".** `grep -n -i wait` over that file at `089d809a9` returns only `_awaitingRegionLoad` hits and one prose comment. The visualizer's private turn+1 branch — a second implementation of "a turn passes", live since the hazard slice — **shipped with no test of its own**, which is exactly why deleting it moved nothing in the suite. The brief's plan for this file ("its WAIT rows now go through `step`") had no rows to move; the 5 rows now there are the pin the branch never had, written against the path that replaced it. ⛓ Generalisable: *a count of tests quoted for a file you have not run is a guess* — and a branch with no rows is the one deletion that can never go red.
2. **`MazeRoomVisualizer.getState()` never exposed `turn`, so the reader the brief names was DEAD CODE.** The brief's §2.4 says "the panel's only readers are the visualizer-turn mirror (`:2165-2171`) and the exit message". The mirror is real and complete — `_onVisualizerChange` computes `waitHappened` and the `else if (waitHappened && this._loopsDrivenAction)` branch (`mazeRoomUI.js:2240` at `089d809a9`) does mana deduction, bestPath tracking, `_mazeQueue.advance()` and `_tickAndCheckHazards()`. But it gates on `typeof vState?.turn === 'number'`, and `getState()` returned `{player_pos, inventory, checkedLocations, target, log, completed, stuck, running}` — **no `turn`**. So the guard was false on every tick since the branch was written: a wait inside a loops-delegated plan advanced no queue icon, deducted no mana and ticked no hazard. **Fixed here** (one field, commented in place) and pinned by a visualizer row that asserts `typeof getState().turn === 'number'`. ⛓ Generalisable, and it is trap 1049's shape one level up: *a reader that is present and correct is not a reader that RUNS — the field it reads has to be in the bag.*
3. **The brief's site line numbers had all drifted** (they were measured at `44e47f445`, and Q-b moved `mazeRoomUI.js` by ~110 lines). Every site was re-located by name, and the table above carries the `089d809a9` numbers. Q-b's own as-built line "`_executeWaitAction` (`mazeRoomUI.js:3640`)" is the dispatch call site, not the method (`:3750`).

**The panel's behaviour change, said plainly (brief item 4).** A hand-played wait now advances `state.turn`. `grep -n "state\.turn\|\.turn\b" mazeRoomUI.js` gives exactly the two readers the brief named: `:2196-2202` at `089d809a9` (the mirror — which reads the VISUALIZER's counter, not this one, so it is untouched by the panel's new turn) and `:3729`, `Reached exit in ${this.state.turn} steps.`. **That message now counts hand-played waits, and it is right to: a wait IS a turn.** No decision anywhere reads `state.turn`. ⚠ Noted and NOT changed: the mirror at `:2186` copies the visualizer's `player_pos` into `this.state` but never its `turn`, so during a loops-delegated walk the panel's own counter does not advance at all and the exit message under-counts a bot walk. That predates this slice, is orthogonal to WAIT, and belongs to whoever owns the mirror.

**The engine's WAIT is deliberately not the oracle's.** `INPUTS` (`:54`) and `bfsSolver`'s `inputs` (`:839`) are untouched, pinned by an engine row that asserts `INPUTS` is the four moves and does not contain `INPUT_WAIT`. The reasoning (a wait is a self-loop `mazeVisitedKey` would prune) is written down in the engine and in `maze.md`, but **the byte-identity row is the measurement** — see below.

**Docs.** `maze.md:9`'s "a `WAIT` pseudo-input exists at the playback level (it advances the turn without calling the engine's `step`…)" is replaced by the true sentence: a first-class `step` input, `turn + 1` and nothing else, deliberately out of `INPUTS` and the solver's list, with the four surfaces named. Owed pins paid: `generate-procgen-reference.mjs` rewrote `docsIndex.js` and the README's `GENERATED:procgen-docs-index` region (word counts 250,882 → 250,966; maze.md 10,971 → 11,055) and `--check` is clean.

**Gates, each with the command that produced it.**

| gate | command | result |
|---|---|---|
| maze byte-identity **BEFORE** (the control) | `node scripts/procgen/dump-maze-byteidentity.mjs 2>/dev/null \| md5sum` at `089d809a9` | `677b7d9cae51023e82fa2e365a8095dc` — the standing value |
| maze byte-identity **AFTER** | same command at `6a8b285b6` | **`677b7d9cae51023e82fa2e365a8095dc` — IDENTICAL.** The row did not move: WAIT through `step` changes nothing the oracle produces |
| ⚖ 52 bounded vitest | `npx vitest run frontend/modules/mazeRoom/ frontend/modules/loops/ frontend/modules/playbackBot/ frontend/modules/procgenDocs/` | **59 files / 2346 tests, 0 failed** (the same list before the slice: 59 / 2327, and 2 of those failed — the two `procgenDocs` word-count pins the doc edit owed). ⚠ Not comparable to Q-b's 61/2377: the brief's path list drops `shared/actionQueue/` |
| `gate: maze-lab` UNMOVED | `node scripts/procgen/check-maze-lab.mjs` | **231 rows, 0 FAIL** — the claim at `44e47f445`, unmoved through Q-b and S2a |
| procgen reference | `node scripts/procgen/generate-procgen-reference.mjs --check` (inside the vitest run) | ALL 6 GENERATED MODULES AND 4 MARKDOWN REGIONS MATCH |
| in-app | `npm test -- --mode=test-substrates --batch=fast` | **61/61 PASSED, 3.6 min** — the five maze rows (`maze-consumable-tile-grants-foreign-item`, `-one-shot-then-respawns`, `maze-mana-tile-refills-pool`, `maze-record-playback-crosses-exit`, `maze-parked-live-drain`) and both `seedling-atlas-maze` rows among them |
| attribution | `node scripts/test/compare-runs.js` | `05-40-04` (Q-b's) → `06-04-16`, both 61/61 — *No differences in status, roster, or duration* |

**The rows added — 20 `it(`s, one replaced, net +19** (derived from `git show HEAD -- <file> \| grep -cE "^\+ +it\("` and the per-file vitest totals, not typed):

| file | before → after | what the new rows say |
|---|---|---|
| `mazeRoomEngine.test.js` | 158 → **164** (+6) | turn+1 and nothing else; a NEW state (input unmutated); NO pickup on an item tile — *with the arrival row beside it, so the fixture is proven live*; `blocks` identical — *with the push beside it*; `INPUTS` is still the four moves; `detectStepEvents` emits **nothing** for a wait, next to a row where the same tiles DO emit |
| `mazeQueueExecutor.test.js` | 35 → **38** (+4, −1) | the old "same state object" row is REPLACED by "a NEW state, turn + 1"; no pickup; `blocks` alone; N waits ⇒ turn N; and the `locationCheck` row now carries the note that `next === state` is its alone |
| `mazeRoomVisualizer.test.js` | 43 → **48** (+5) | the branch's missing pin: turn advances, player still; the log row is a `step` with `from === to` and the new turn and empty `events`; a wait on an item tile fires no pickup event and no pickup log; a wait notifies; **`getState()` carries `turn`** |
| `mazeRoomUI.test.js` | 148 → **151** (+3) | `state.turn` advances and nothing else moves; a hazard-REFUSED wait STILL passes the turn (the hazard question gates the mana charge, not time); a queued `wait` entry reaches the engine through `_executeQueueAction`. Two existing rows gained turn assertions ("ticks hazards even when no mana deducted", "no-op outside playback mode" — "no-op" was always about MANA) |
| `mazeAutopather.test.js` | 48 → **50** (+2) | the autopather is UNCHANGED, and these say what changed around it: a planned path with waits replays straight through `step` (before S2a `step` returned `null` and only a surface that intercepted the input first could replay it), in both the `stepsToInputs` and the `stepsToActions` forms |

**MUTANT, RUN NOT REASONED.** `step`'s WAIT branch replaced by `return null` (the pre-S2a refusal), applied to the committed tree, restored from a copy kept in the scratchpad (trap 1072 — never `git checkout --`).

| file | reds |
|---|---|
| `mazeRoomEngine.test.js` | **5** |
| `mazeQueueExecutor.test.js` | **4** |
| `mazeRoomVisualizer.test.js` | **4** |
| `mazeRoomUI.test.js` | **5** |
| `mazeAutopather.test.js` | **2** |
| **total** | **20 reds over 5 files** — the brief asked for the executor row, the visualizer row and the engine row to ALL go red; all three do, and the panel and the autopather come with them |

⚠ The one wait row that does **not** red under the mutant is the visualizer's `getState()` row — correctly: that defect is independent of whether `step` accepts a WAIT.

**What S2b reads off this.**

- `step(world, state, INPUT_WAIT)` never returns `null`. Anywhere S2b would have written a wait side-branch, it calls `step` (or `executeMazeEntry(world, state, waitEntry())`) instead — the lab's `framesForActions` included.
- `executeMazeEntry` now returns `next === state` for **`locationCheck` only**. A lab replayer that wants "did the world change?" compares positions or asks the entry.
- `MazeRoomVisualizer.getState()` gained `turn` — the lab HUD can show it without reaching into `_state`.
- ⛔ `whyBlocked` is still S2b's: `refusalReason` in `mazeQueueExecutor.js` is untouched by this slice, and a WAIT never reaches it (the engine has no refusal to explain).
- The panel's `_executeWaitAction` keeps its own mana + hazard wrapper. The lab arm needs its own wrapper or none — the engine half is all that moved.

**⇒ S2a VERIFIED BY THE PLANNER; S0+S1 LAUNCHED (2026-09-02, `maze-lab-planning`).** S2a (`6a8b285b6`/
`aaddf5acf`) re-checked: the engine's WAIT case at `mazeRoomEngine.js:673`, `getState().turn` at the
visualizer, the identity digest `677b7d9cae51023e82fa2e365a8095dc` reproduced by the row's own command
here, bounded vitest 53 files/1877 green. **Two brief premises overturned (plan §30):** the visualizer's
WAIT branch had ZERO tests (my "5 wait rows" was a grep matching `_awaitingRegionLoad` — a count for a
file nobody ran), and **`getState()` never carried `turn`, so the panel's `waitHappened` mirror
(`mazeRoomUI.js:2240` @089d809a9 — mana, bestPath, queue advance, hazard tick for a wait inside a
loops-delegated walk) was gated FALSE on every tick since it was written** — fixed and pinned; S2a's
lesson: *a reader that is PRESENT is not a reader that RUNS — grep the PRODUCER for the field*. The
`next === state` re-derivation had no subject (the one caller tests `=== null`; contract: `next ===
state` is the `locationCheck`'s alone). Mutant: `step` refusing WAIT again reds 20 rows over 5 files.
**Residue flagged, not fixed → D5:** the panel mirror at `:2186` copies the visualizer's `player_pos`
but never its `turn` — "Reached exit in N steps" under-counts a bot walk. **S0+S1 launched**
(`NewDocs/plans/maze-lab-arms-sliceS1-prompt.md`, `maze-lab-arms-sliceS1`): the three stale docs
(`lab.html:42-45`/`:505`, `maze.md` modes table), then the scrub (`#labScrub`, frame HUD, input strip,
PLAY rate, `__mazeLab.play` +`turn`/`inventory`/`input`/`author`), `framesForActions` over
`executeMazeEntry` + `startStateFor` (M1/M2 — `planCells` stops replaying on every draw), CLAIM 15 +3,
`gate: maze-lab` re-banked `--write --key=` at the pushed head. The ladder had skipped S0/S1 when S2a
was launched straight after Q-b; S2b consumes S1's `play` object (trap 1047), so S1 goes first.

**⇒ S0+S1 AS BUILT (2026-09-02, `maze-lab-arms-sliceS1`; S0 `6ae598a9a`, S1 `f1a8ebef4`, pushed).**

**S0 — the stale texts were FIVE, not three.** The brief named `lab.html:42-45`, `lab.html:505` and
`maze.md` § *The three modes*. Two more said the same wrong thing and were fixed in the same commit:
`maze.md:443` ("the three modes' logic") and `procgenDocs/glossary.js:2480` (the `maze-lab` entry:
*"with three modes — GENERATE, EDIT, SOLVE"*), plus `mazeLab.js`'s own docblock header ("THREE MODES,
ONE STATE"). `SOURCES` has had four values since the SET arm, so every one of those counts was wrong
about the ARM COUNT as well as about the plan being drawn. The modes table is now four rows (`set`
joined it, `solve` says STEPPED and points at § *On the lab page*). Owed and run: the generator
(`docsIndex` + README's index region re-emitted) and `procgenDocs/` vitest — 7 files / 447 green.

**S1 — the scrub, and ONE stepper.** Signatures S2b reads, as built:
- `procgenMaze.startStateFor(world, items = null) → state` — ⚠ **not** the brief's `startStateFor(state)`:
  `procgenMaze` is the substrate's file and may not know `mazeLab`'s state shape, so the lift is the
  oracle's `makeStart` exactly (a WORLD + the starting item ids). The lab passes `state.record` and
  `state.palette?.items`. `makeStart` is now `(world) => startStateFor(world, items)`.
- `mazeLab.framesForActions(state, entries) → ReadonlyArray<frame>|null` — boots `startStateFor`,
  expands `loops` (`expandEntries`), steps each entry through `mazeQueueExecutor.executeMazeEntry`.
  `null` on a refusal **unless** the entry carries `params.refused`, in which case the refusal is a
  COMPLETION and the frame repeats the previous engine state.
- `mazeLab.frameOf(state, input = null) → frozen frame` — `{player, blocks, inventory, turn, input}`.
- `mazeLab.planFrames(state, solved)` = `framesForActions(state, solved.plan.map(moveEntry))`;
  `planCells(state, solved)` = the frames' `player` projection (M2: it was a second full replay, and
  it ran on every draw at `mazeLabView.js:693` — the view now maps `play.frames`).
- readout `__mazeLab.play` = `{index, frames, playing, player, turn, inventory, input, author, blocks,
  layouts}`. `input` is the HUD's own string (`describeMazeAction`, `'—'` on frame 0), `author` is
  `'oracle'`. `shownFrame()` is the widened `overlayBlocks()` law: ONE function answers "which frame is
  on screen" for the picture, the HUD and the readout.
- page: `#labScrub` (bound to the hoisted `seekFrame()`, the one writer of `play.index`), `#playNote`
  as the frame HUD, `#labInputStrip` (one `.in` per turn, one `.lit`, clickable), `#labPlayRate`.
  ⛔ none in the URL (⚖ ruling 9). `startPlaying()` is the one arming site so a rate change restarts a
  running interval.

**Two things the brief asked for that could not both hold.** (a) *"`planFrames` unchanged output —
byte-equal to before"* and (b) *"`__mazeLab.play` gains `turn`"*. `turn` has to come off the FRAME (it
is not the index: a `locationCheck` costs a frame and no engine turn, and a refusal costs neither), so
(a) is met on the three fields the frame always had and NOT on the object: the frames are byte-equal on
`player`/`blocks`/`inventory` over three fixtures measured before and after, and gained `turn` and
`input`. `mazeLab.test.js` pins that by spelling the OLD hand loop out and comparing to it.

**Gate totals, with commands.**
| gate | before | after | command |
|---|---|---|---|
| `check-maze-lab.mjs` | 231/0 | **238/0** | `node scripts/procgen/check-maze-lab.mjs` |
| bounded vitest (⚖ 52) | 27 files/1156 | **34 files/1617** | `npx vitest run frontend/modules/mazeRoom/ frontend/modules/procgenDocs/ frontend/modules/procgenCore/labView.test.js` |
| `mazeLab.test.js` | 100 | **114** | (in the above) |
| `procgen-lab-hosting` | 66/0 | 66/0 | `node scripts/procgen/check-procgen-lab-hosting.mjs` |
| maze byte identity | `677b7d9c…` | **`677b7d9cae51023e82fa2e365a8095dc`** (unmoved) | `node scripts/procgen/dump-maze-byteidentity.mjs \| md5sum` |
| `procgen-reference` | — | `--check` clean | `node scripts/procgen/generate-procgen-reference.mjs --check` |

⚠ **CLAIM 15b is SEVEN rows, not the brief's three** (231 → 238): the slider's `max`; setting it to k
moves `play.index` AND the HUD names the index, the engine turn and the player cell; the HUD names the
ENTRY and the readout publishes the same string; the strip has `frames − 1` cells; exactly one is lit
and it is cell k−1; clicking the first letter seeks to frame 1; and **at frame 0 NO cell is lit** — the
start is not an input, which the brief's "exactly one lit" would have made false at the one index the
buttons already reach. Every number is derived from the readout or the DOM.

**Mutant, run not reasoned** (restored from a COPY, trap 1072): the HUD reading `play.frames[0]` instead
of `shownFrame()` → **exit 1, 236/2** — the two HUD rows red and nothing else, which is the discrimination
the rows were written for.

**RE-BANK.** `gate: maze-lab` is CI-sourced (`ci-summary.mjs --gate=… --json`), and the first
`--write --key='gate: maze-lab'` at `f1a8ebef4` came back *"exited 3 — the run for this SHA has not
concluded"* and **KEPT 231/0** (`feedback_suite_row_write_needs_a_ci_head`, live: a write on a head whose
CI has not finished banks the stale number and reports it as a KEEP). That write was reverted, and re-run
once `JavaScript Unit Tests` @`f1a8ebef4` concluded **success**: `ok gate: maze-lab 238/0 7.0s`, 66 rows
written. ⚠ The write also printed the standing shard-partition warning — *"Browser gate shard: 9 arm(s),
602.5s > the 600s budget, heaviest producer `plan-seedling-r7-ends-meet --check` 211.5s"* — which is
**pre-existing and not this slice's**: the same warning names run `33597305784` @`aaddf5acf` in S2a's own
write. It belongs to whoever next runs `ci-gates.mjs --write-costs`.

**⇒ S0+S1 VERIFIED BY THE PLANNER; S2b (THE MANUAL ARM) LAUNCHED (2026-09-02, `maze-lab-planning`).**
S0 `6ae598a9a` / S1 `f1a8ebef4` / as-built `e22505c2d` re-checked: `gate: maze-lab` banked **238/0** CI-sourced
at `f1a8ebef4`; `startStateFor(world, items)` in `procgenMaze.js:2311`, `framesForActions`/`frameOf`/
`planFrames`/`planCells` in `mazeLab.js`; `#labScrub` in the page; the five stale "three modes" texts gone;
bounded vitest 34 files/1617 green, `mazeLab.test.js` 114, `demos.test.js` 47 TESTS (its 28 is the ENTRY
count). **Overturned in the brief (plan §31):** FIVE stale texts, not three (`maze.md:443`, the glossary's
`maze-lab` entry, `mazeLab.js`'s own header); `startStateFor` takes a WORLD, not the lab's state (the
substrate's file may not know the page's shape); "planFrames byte-equal" and "play gains turn" could not
both hold — a frame must carry `turn` (a `locationCheck` costs a frame and no turn; a marked refusal
neither), so the three old fields are byte-equal and `turn`/`input` are new; CLAIM 15b is SEVEN rows and
"exactly one cell lit" is FALSE at frame 0 (⏮ reaches it; the start is not an input) — a gate written as I
spelled it would have red on its own page. `feedback_suite_row_write_needs_a_ci_head` fired live (a KEEP
banked before the CI run concluded; reverted, re-run). Pre-existing, seen while banking: the browser shard
partition warns 602.5 s > 600 s (heaviest `plan-seedling-r7-ends-meet --check`) — owner = the next
`ci-gates.mjs --write-costs`. **S2b launched** (`NewDocs/plans/maze-lab-arms-sliceS2b-prompt.md`,
`maze-lab-arms-sliceS2b`): `?source=manual` (CLAIM 17b re-derived from `SOURCES` — it will red first);
`mazeLabWalk.js` on the shared `ActionQueue` + `executeMazeEntry` + `startStateFor`, no undo in v1
(`removeAt` refuses the done region by design); `whyBlocked` in the ENGINE with `refusalReason` delegating,
tested as the PROPERTY `whyBlocked === null ⇔ step !== null`; a refused press KEPT and marked (§28); the
recording = the loops `SavedQueue` envelope + a `lab` block, Load = `loadPayload` then `framesForActions`
refusing by name at the first illegal index; SOLVE's *Download the plan as a walk* (old S3, folded in);
witness line, `certified` untouched, the SEAM line unit-driven; demo `maze-manual-arm` + glossary
`walk`/`witness`; CLAIM 22 by real key presses; three mutants named; re-banks after the CI run concludes.

**⇒ S2b AS BUILT (2026-09-02, `maze-lab-arms-sliceS2b`; `826ecd8d4` the engine, `cb8da2757` the
arm, `60eb59815` the docs, `6d0cd0256` a fixture the mutants found — pushed).** The maze lab has
FIVE arms; the fifth is a keyboard that authors a recording.

**The arm.** `SOURCES.MANUAL = 'manual'`; `<select id="source">` gains *MANUAL — drive the player
yourself, one tile per key*; `readLabParams`' refusal names five off `Object.values(SOURCES)`
unchanged. `#manualPanel` holds START · STOP & fold · RESTART · `#manualNote` (the walk HUD) · the
walk box (`#labWalkText` / Download / Load from box / Upload). ⚠ **A THING THE BRIEF DID NOT
FORESEE: the replay controls had to MOVE.** The scrub, the frame HUD and the input strip lived
inside `#solvePanel`, and §2.5 asks the MANUAL arm to use them — so they are now `#replayPanel`,
`hidden` unless the arm is SOLVE or MANUAL, and `renderSolvePanel` split into `renderReplayPanel()`
(shared) + the solve note. ⛔ Not copied into the manual panel: two scrubs over one `play.index`
would be a second answer to *"which frame is on screen"*, the one law this page keeps hardest. Every
id is unchanged, so CLAIM 15b never noticed.

**The session — `mazeRoom/mazeLabWalk.js`, 372 lines, headless, 32 unit rows.**

```js
createWalkSession(state)          // .queue (a shared ActionQueue) · .frames · .press(spec)
                                  // .moves .refused .waits .reachedGoal .last .turns .engineState
  .press(spec) → {entry, state, reason}      // validateEntry → queue.add → queue.stepOne(exec)
  .fold(author = 'hand') → the recording     // projectActions over queue.snapshot().entries
  .roundTrip() → {faithful, mismatches:[{at, drove, replayed}]}
witnessOf(state, walk) → {clause, seam}      // the identity line's clause, and the SEAM
refuseWalkDocument(doc) → string|null        // every action past the shared validateEntry
describeReplayRefusal(state, actions) → string   // the TURN index framesForActions will not name
LAB_ARRIVAL_EXIT_ID = 'entrance'
```

⛔ ONE boot (`startStateFor(world, state.palette?.items ?? null)`), one executor
(`executeMazeEntry`), one frame shape (`frameOf`), one goal predicate
(`oracleFor(state).goalPred`). The executor THROWS on a refusal, which is what makes `stepOne` mark
the entry `FAILED`, which is what makes `projectActions` stamp `params.refused` — one mechanism,
three readers. No undo (`ActionQueue.removeAt` refuses the done region and every entry of an
append-and-execute session is done); RESTART re-opens.

**`whyBlocked` — and the FIRST thing it found.** `mazeRoomEngine.whyBlocked(world, state, input,
inventoryOverride, clearanceOpts)`, beside `step` and in `step`'s own guard order. Sentences, all
pinned: `off the grid` · `wall at (1,0)` · `'NE' is not an input` · `door_red is shut — needs
key_red` · `door_A is shut — nothing on button_A` (the missing token resolved back through
`buttonLib[*].holds`) · `door_A is shut — needs sw_A` when NO button holds it · `block at (3,1)
cannot move: beyond is a wall | beyond is a block | beyond is off the grid | door_red is shut —
needs key_red` · `null` for a legal move and for WAIT. `mazeQueueExecutor.refusalReason` is now four
lines that delegate.

⚠ **THE DELEGATION SURFACED A LIVE DEFECT IN ITS FIRST RUN**: `refusalReason` was asked WITHOUT the
`inventoryOverride` `step` was asked WITH, so a door a playback inventory does not open reported
nothing at all. Caught by an existing row (`inventoryOverride is the playback-mode truth`) the
moment the body changed — the old body never read an inventory, so the argument had never been
passed. Both now take one argument list. A `null` from `whyBlocked` on a refused move prints
`⛔ SEAM — step refused it and whyBlocked says it is legal` rather than an empty reason.

**Three executor/panel rows moved with the wording** (`wall or off-grid` was ONE string for two
facts and is now two): `mazeQueueExecutor.test.js` ×3, `mazeRoomUI.test.js` ×2.

**The recording, as built** — the loops `SavedQueue` envelope, `format: 'actionQueue/1'` included
(the panel stamps it too, and R5's own comment named the lab's box as the reader that would refuse
an unknown one by name), plus `lab: {generator, payload, author, reachedGoal, refused}`.
`itemsPickedUp` is the FRAMES' inventory delta; `departureExitId` is `getExitAt(world, …)?.exit_id`
at the final cell, `null` otherwise; `name` is `lab: entrance→goal` or `…→stopped`. A refused press
is KEPT and marked (plan §28) and pushes a frame equal to the previous engine state — **`turn`
included**, because `step` never returned a new state.

**LOAD** = `refuseWalkDocument` → `loadPayload` → `framesForActions`; on `null` the level is
DISCARDED unadopted (nothing partial drawn) and `describeReplayRefusal` names the TURN index:
*"input 1 (move (S)) is illegal on this level — move S blocked: wall at (1,1). The walk was driven
on a different level, or the level moved."* The SOLVE arm gained **Download the plan as a walk**,
built by driving a `createWalkSession` over `lastSolve.plan` (⛔ not a second folder).

**The picture and the readout.** While driving, `play = {frames: session.frames, index, playing:
false, author: 'hand'}` — the session's array IS `play.frames`, and the index moves through S1's
`seekFrame()`, the one writer. `__mazeLab.walk` = `null` until a session opens, then
`{moves, refused, waits, reachedGoal, roundTrip}` — ⚠ **and it OUTLIVES the session**, because the
brief's own CLAIM 22 asks for `walk.roundTrip.faithful` AFTER STOP. `roundTrip` is `null` until STOP
has actually measured one. The identity line gains the witness clause through a THIRD argument to
`describeState(state, solved, walk)`; `certified` is untouched, and the SEAM goes to the status line
in red (`say(..., true)`), unit-driven with `certified: false`.

**CLAIM 22, by REAL `page.keyboard.press`.** Subject `?seed=1&width=5&height=5&skeleton=winding` —
the room is `..###` over `#.###`×3, entrance (0,0), goal (1,3), oracle plan `E S S S`, and **(2,1)
is a WALL**. ⚠ The brief's sketch said *ArrowRight ×2* for the two accepted moves; on this room the
second E IS the wall, so the two accepted presses are **E then S** and the wall press is the E that
follows — the same three rows in the order the room admits. The rows: `walk === null` and `play ===
null` before START; the fifth panel and the shared replay panel showing and the other four hidden;
two presses ⇒ `moves === 2`, `play.author === 'hand'`, the HUD names the cell; `play.frames ===
moves + 1` and `turn === 2`; the wall press ⇒ `refused === 1`, `moves` UNMOVED, the HUD prints
`wall at (2,1)`; the strip has one cell per turn INCLUDING the refused one, exactly one marked;
`Space` ⇒ `waits === 1`, `turn + 1`, player unmoved; the goal ⇒ the witness clause naming the walk's
own move count; STOP ⇒ `roundTrip.faithful === true`, and the box's folded turns EQUAL
`play.frames − 1`; Load ⇒ same frame count, index 0, `author 'hand'`, `walk === null`; the WALLED
level (built node-side by `applyEdit` over the same URL parameters and spliced into the document's
`lab.payload`) ⇒ REFUSED by name at index 1 with `play` and `level` BYTE-IDENTICAL to before; then
SOLVE → certified → switch to MANUAL → walk the goal ⇒ the clause stands BESIDE `CERTIFIED` and
`certified` is still `true`; and node's own session over the same four moves agrees with the
browser's about moves, frames and the goal. **CLAIM 17b re-derived** from `Object.values(SOURCES)` —
it red on the fifth arm, which is the gate working.

**Gate totals, with the commands.**

| gate | before | after | command |
|---|---|---|---|
| `check-maze-lab.mjs` | 238/0 | **255/0** | `node scripts/procgen/check-maze-lab.mjs` |
| `procgen-demos` | 252/0 | **261/0** | `node scripts/procgen/check-procgen-demos.mjs` |
| `procgen-lab-hosting` | 66/0 | 66/0 | `node scripts/procgen/check-procgen-lab-hosting.mjs` |
| `procgen-docs` | 128/0 | 128/0 | `node scripts/procgen/check-procgen-docs.mjs` |
| maze byte identity | `677b7d9c…` | **`677b7d9cae51023e82fa2e365a8095dc`** (unmoved) | `dump-maze-byteidentity.mjs \| md5sum` |
| `procgen-reference` | — | `--check` clean (regenerated: `docsIndex`, `urlGrammar`, README's index) | `generate-procgen-reference.mjs --check` |
| ⚖ 52 bounded vitest | 34 files/1617 | **38 files/1750** | `npx vitest run frontend/modules/mazeRoom/ frontend/modules/procgenDocs/ frontend/modules/loops/savedQueueStore.test.js frontend/modules/shared/actionQueue/` |
| in-app | — | **61/61, 3.5 min**, `compare-runs.js` *No differences in status, roster, or duration* | `npm test -- --mode=test-substrates --batch=fast` |
| cold verify | — | fresh detached worktree at `6d0cd0256` (+ `submodule update --init frontend/modules/shared`): bounded vitest **38/1750**, `check-maze-lab` **255/0**, byte-identity md5 identical, generator `--check` PASS | |

**Pins re-derived, never typed**: `mazeLab.test.js` 114 → **116**; `mazeLabWalk.test.js` **32** (new);
`mazeRoomEngine.test.js` 163 → **176**; `mazeQueueExecutor.test.js` 38 (unmoved, 3 rewordings);
`glossary.js` 164 → **166** (`walk`, `witness`); `demos.js` 29 → **30** ENTRIES / 28 → **29**
non-prose (its 47 TESTS unmoved); the doc-link census 220 → **221** in BOTH `docLinks.test.js` and
`docsRender.test.js` (one new sibling-doc link in `loop-recording.md`).

**THREE MUTANTS, RUN NOT REASONED** (each applied to a COMMITTED tree and restored from a copy —
trap 1072):

| mutant | reds |
|---|---|
| (a) `framesForActions` boots the REPLAY without the palette items | **2** in `mazeLabWalk.test.js` — the door-key round trip and its own vacuity control |
| (b) `framesForActions` returns the partial prefix instead of `null` | **3** unit rows AND the browser gate: `check-maze-lab` **210 PASS / 1 FAIL**, STUCK on *"the walk to be refused on a level it was not driven on"* |
| (c) `whyBlocked` returns `null` for a shut door | **8** over two files, including the PROPERTY row on both door fixtures |

⚠ **MUTANT (c) FOUND A VACUOUS FIXTURE, AND IT IS FIXED (`6d0cd0256`).** The door-key property
fixture was `#PKR.#` — key BETWEEN player and door — so `step` picks the key up on the way past and
**no reachable state ever meets a shut door**: the door branch of `whyBlocked === null ⇔ step !==
null` was vacuous there, and mutant (c) left that fixture GREEN while only the guard gadget red. The
key is now off the route (`#P.R.#` over `#.K..#`) and the mutant reds both. ⛓ A property test over
"every REACHABLE state" is only as strong as what its fixture makes reachable — the same shape as
[[feedback_fixture_must_discriminate_two_builds]], one level down.

**What R-b (`requires` + `worldDigest`) reads off this slice's refusal path.** `describeReplayRefusal`
is the one place a document's actions are walked against a level and the first illegal TURN index is
named; it takes `(state, actions)` and answers a sentence, so a `requires` check that must refuse
BEFORE the walk (an inventory the level's palette cannot supply) belongs BESIDE it in
`refuseWalkDocument`, which already runs every action past `validateEntry` and already owns
"nothing partial is drawn". `worldDigest` has a natural home too: the `lab` block is additive and
loops ignores it, so a digest of `lab.payload.level` rides there and `refuseWalkDocument` gains one
comparison — ⛔ NOT on the envelope, which is the store's shape and not the lab's to extend.

**RE-BANK, and a red CI found on the way.** ⚠ The as-built commit did NOT trigger `JavaScript Unit
Tests`: its trigger path list holds `docs/**` but this file lives under `CC/docs/`, so the gate
answers existed only at the CODE head — `ci-summary.mjs 6d0cd0256 --gate=…` confirmed **255/0** and
**261/0**, byte-equal to the local runs. That head's run was RED, and it was mine:
`lintGateLabels.test.js` ×2. `docLinks.test.js` and `glossary.test.js` carry counts IN THEIR TEST
NAMES and those names are allowlisted **by their text**, so moving 215 → 221 and 164 → 166 broke each
key TWICE — as a new finding and as a stale entry. Fixed the way the lint asks and
[[feedback_deriving_a_roster_arms_a_dormant_lint]] asks: the two NAMES now interpolate the roster
they measure (`${CORPUS.length}`, `${TERMS.length}`) and leave the allowlist for good; only
`TERMS → toHaveLength(166)`, a PIN and therefore a deliberate input, was re-keyed with
`--write-allow`. The allowlist SHRANK 87 → 85 (`65bc20898`, CI **success**). Re-banked at that head
once its run concluded: `ok gate: maze-lab 255/0 7.1s` and `ok gate: procgen-demos 261/0 12.0s`,
both CI-sourced, 66 rows written.

**Notes for whoever is next.**
- ⚠ The demo catalogue's runner gained a `keys` field (DOM key names pressed through
  `page.keyboard.press` after `press`). No wait follows them, and that is DERIVED: the page's
  `keydown` handler runs its executor and `render()` synchronously, so the readout is already
  republished when the press resolves — a poll there would be a row waiting for its own assertion.
- ⚠ The catalogue press is `body:has(#labWalkStop:disabled) #labWalkStart`, not `#labWalkStart`:
  START is present and ENABLED in static HTML before `mazeLabView` has mounted, and `#labWalkStop`
  is disabled by `renderManualPanel` and by nothing else. The §5i lesson, second substrate.
- ⚠ **A COUNT IN A TEST NAME IS AN ALLOWLIST KEY.** `lint-gate-labels` keys by `file::rule::label`,
  so editing an already-allowlisted count reds CI twice over. Interpolate the name; allowlist only
  the assertion.
- ⚠ **`CC/docs/**` IS NOT A CI TRIGGER PATH** — an as-built commit gets no `JavaScript Unit Tests`
  run, so plan the re-bank for a head that touched `frontend/**`, `scripts/**` or `docs/**`.
- ⚠ `check-procgen-demos.mjs` now takes **~10 minutes** (it runs every entry's `cli`, and entry 30's
  is `check-maze-lab.mjs` at 70 s). Run it with `setsid nohup` and a captured PID; `$!` after
  `setsid` is the WRAPPER's pid, not node's — measured here, and a `kill -0` on it reported "done"
  while the run was still going (and the re-launch then TRUNCATED the live log).

**⇒ S2b VERIFIED BY THE PLANNER — BOTH NAMED ASKS CLOSED (2026-09-02, `maze-lab-planning`).** Main
`858b57306` re-checked: `SOURCES.MANUAL`, `#replayPanel`/`#manualPanel`, `mazeRoomEngine.whyBlocked`,
`mazeLabWalk.js` (32 tests), the catalogue's `keys` field; `gate: maze-lab` **255/0** and `procgen-demos`
**261/0** banked CI-sourced at `65bc20898` (a head that touched code — ⚠ S2b's finding: **`CC/docs/**` is
NOT a CI trigger path**, so an as-built commit gets no unit-test run and a re-bank must target a code head);
digest `677b7d9c…` unmoved; bounded vitest 37 files/1718; `check-maze-lab.mjs` ALL CHECKS PASSED live here.
**Overturned (plan §32):** the scrub had to MOVE to a shared `#replayPanel` (one `play.index`, one scrub);
`walk` null-until-walked with `roundTrip` null-until-STOP; the catalogue runner had no keyboard (a `keys`
row field added); a defect mine by construction — `refusalReason` asked without the `inventoryOverride`
`step` was asked with; **mutant (c) exposed a VACUOUS FIXTURE** (the key sat between player and door, so
no reachable state met a shut door — moved; the mutant now reds 8 rows); `lintGateLabels` red because two
test NAMES carried counts the allowlist keyed on — names interpolated, allowlist 87→85. R-b lands beside
`refuseWalkDocument`/`describeReplayRefusal`; `worldDigest` in the `lab` block, not the envelope. **THE
LADDER IS NOW THE USER'S TO ORDER (plan §33):** R-b · D1 · D2 · D5 (new: the panel mirror never copies
`turn`) · D3 · D4 · F-a/F-b · ⚖ F-c/F-d · opt S4–S6; the cross-substrate queue VIEWER is its own arc.

**⇒ ⚖ USER ORDERED THE REST — R-b FIRST; R-b LAUNCHED (2026-09-02, `maze-lab-planning`).** Asked with
the four candidates (R-b · D1+D2+D5 · D3+D4 · F-a); the user chose **R-b, the recording PRECONDITIONS**
(plan §20 R3/R4). Kickoff `NewDocs/plans/maze-lab-arms-sliceRb-prompt.md`, session `maze-lab-arms-sliceRb`:
`mazeWorldDigest(world)` (one function, `contentIdentity`'s primitives over `serializeMazeLevel`);
`deriveRequires(world, startState, actions)` — the combo of each passed obstacle's `clear_set` the
inventory satisfied, MINUS what the walk itself picked up first, derived tokens excluded, `rule`-typed
gates answered `null` with a reason rather than guessed; both stamped by ONE function on every maze
recording — panel and lab — as optional TOP-LEVEL envelope fields (planner's call over S2b's lab-block
suggestion: the motivating case is the panel's edited region, and `saveQueue` keeps unknown fields);
`refuseReplayPreconditions(rec, {world, startInventory})` refuses BEFORE step 0 naming the digest pair or
EVERY missing id, in the lab's LOAD path and the panel's `_replaySavedActions` (block left PARKED); the
customQueue picker hides or labels a stale recording; CLAIM 22b; three mutants (ignore requires / ignore
digest / forget the subtraction) each named with the row it must red. Re-bank at a CODE head after CI.

**⚖ USER 2026-09-02: "Yes, we can continue in that order."** The remaining ladder is PRE-AUTHORIZED: after R-b
verifies → **D1+D2+D5** (one session) → **D3+D4** (one session) → **F-a** then **F-b** (Seedling/flash; F-b owes a
Windows Chrome wasm run). The planner launches each on the previous as-built without asking; it STOPS for a
report that fails verification, or at **F-c/F-d** (each needs its own ⚖ — a `shared` submodule change; a gate
over a deliberate fixed point) and at the optional S4–S6.

**⇒ R-b AS BUILT — THE PRECONDITIONS SHIP, AND ONE OF ITS OWN BROWSER ROWS WAS VACUOUS
(2026-09-02, `54877a7ac`).**

**The three signatures**, all in `mazeQueueExecutor.js` (headless), plus one stamp:

```js
mazeWorldDigest(world)                          // → 8 hex; fnv1a32(stableStringify(serializeMazeLevel(w)))
deriveRequires(world, startState, actions)      // → {requires: string[]|null, why: string|null}
stampRecordingPreconditions(rec, world, start)  // → rec, IN PLACE; both recorders call THIS
refuseReplayPreconditions(rec, {world, startInventory, selfContained})  // → string|null
```

- ⛔ **`computeContentHash` is NOT called** — it hashes a document minus `provenance` and minus its
  own id key, and a serialized level has neither. The two primitives underneath it are the contract.
- `deriveRequires` re-walks the recording's own actions through `executeMazeEntry` and reads **which
  `clear_set` combination the EFFECTIVE inventory satisfied** at each crossing (first fully-held
  combo, declared order — `library.js:10-14`), **minus what the walk picked up before that turn**. It
  asks the cell BEYOND on a push too (`step` refuses to push a block into a shut door and asks that
  cell with the same inventory, so it is the same question about the same turn). Hold tokens are
  excluded **by name derived from `world.buttonLib[*].holds`**, ⛔ not by a `sw_` prefix — the prefix
  is the default library's spelling, not a rule any world is held to. A `rule`-typed gate answers
  `{requires: null, why: 'rule-typed gate <id> at turn k'}` and the recording then carries **no
  `requires` field at all** (⚠ absent, not `null`: `null` would be indistinguishable from a pre-R-b
  recording, and "this recording does not say" is the truth in both cases).
- `mazeRoomEngine.effectiveInventory` is now **exported**, for one reason: a combination naming a
  HELD token is satisfied by the world's stance, and a second copy of `heldTokens` outside the engine
  would answer that differently the next time a gadget lands — `whyBlocked`'s own argument.

**Overturned in the brief, all three deliberate and all three recorded:**

1. ⚠ **§2.4's TWO call sites in the lab are ONE FUNCTION.** "right after `refuseWalkDocument`, before
   `loadPayload`" and "`describeReplayRefusal`'s caller before `framesForActions`" both name
   `mazeLabView.loadWalkFromBox`. The single call sits **after `loadPayload`** because that is what
   SUPPLIES the two things the check needs — the world and the palette the walk boots with — and it
   draws nothing (`adopt(loaded)` is still below, so a refusal leaves the page the level and the play
   it already had, the law CLAIM 22 already holds).
2. **`_getReplayableTargets` LABELS a stale recording, it does not hide it** (§2.5 asked for a
   decision): hiding makes a recording VANISH with no account of itself, and a player cannot tell one
   the level outgrew from one that was never made — the picker is the only surface in a position to
   say *"recorded on an older version of this level"*. Pressing it still refuses by name
   (`_replayBestPath` → `_refuseReplayPreconditions`). ⚠ And the digest is computed **lazily**, on
   the first stored recording that carries one: written unconditionally it spent
   `serializeMazeLevel` on every repaint and broke on the panel's own partial fixtures.
3. **The envelope had to reach the panel replayer**, so `loopState` now passes
   `replayActions(actions, {…, recording: saved})` at both call sites — `_replaySavedActions` was
   given only `actions` and the preconditions are on the envelope. Additive; nothing in loops reads
   the field, and a caller that omits it is unaffected (absent fields ⇒ `null`).

**A defect the panel's own tests found.** `_startVisitRecording` runs at the TOP of
`_adoptLoadedRegion` (it must — `actionsAtStart` aligns with the queue it just cleared), where
`this.world`, `this.state` and `this.externalInventory` are all still the region the player is
LEAVING. A second call site, `_noteVisitStart()`, fires once the world and playback inventory are
settled; the stamp is skipped entirely when it did not run, because ⛔ **the RECORDING matters more
than its preconditions** — an enrichment that throws on an unexpected world shape destroys the thing
it was decorating (it did, on a fixture, before the guard).

**CLAIM 22b's rows** (`check-maze-lab.mjs`, all built from the page's own `generateStep` over CLAIM
22's URL parameters — ⛔ the keyboard is CLAIM 22's proof and is not re-paid for here):

| row | what it says |
|---|---|
| the stamp | `worldDigest` is the level's own hash, `requires` is `[]`, and **neither is in the `lab` block** |
| the NEGATIVE | the untouched document still LOADS — without it the two refusals below are consistent with a LOAD path that stopped accepting walks |
| R4 | one tile flipped in `lab.payload.level` refuses BY DIGEST, **both hashes read out of the sentence and compared** (a message printing the same hash twice would satisfy a one-sided check); nothing partial drawn |
| R3 record-time | the subject room at `step: 1` places `door_red` at (1,2) and `key_red` at (1,0); erase the key TILE, put it in the PALETTE, and the fold names `requires: ["key_red"]` |
| **R3 discriminating** | **the SAME four presses over the SAME door with the key still ON THE ROUTE answer `[]`** — added after mutant (c) (below) |
| R3 replay-time | the page, whose palette starts the player empty-handed, refuses NAMING `key_red` before step 0; nothing partial drawn |

⚠ **CLAIM 22's own "refuses at the INDEX" row now splices a PRE-R-b recording** (both fields
stripped). That row's subject is R2, which R-b would otherwise pre-empt — and stripping them makes it
the browser's witness that a recording written before this slice is **still replayable**, which is
why both fields are optional forever.

**⛓⛓⛓ MUTANT (c) FOUND A VACUOUS ROW SET, AND IT IS FIXED (`54877a7ac`).** Every `requires: []` in
CLAIM 22b's first draft came from a level with **no obstacle at all**, so deleting the
subtract-what-the-walk-picked-up step left **the whole browser gate GREEN — 264/0, FAIL 0**. Measured,
not reasoned. The discriminating row is the same four presses over the same door with the key on the
route (`requires: []`, `itemsPickedUp: ["key_red"]`); the mutant now reds it. ⛓ **S2b's lesson one
slice later, on the recording side** — and the second time in two slices that mutant (c) was the one
that found it (trap family 824/825).

**The three mutants, RUN (copy/restore, trap 1072 — the code was committed first):**

| mutant | vitest (3 files, 255 rows) | `check-maze-lab` |
|---|---|---|
| (a) `refuseReplayPreconditions` ignores `requires` | **3 red** | **1 red** — and the note shows R2 catching it mid-walk instead: *"input 2 (move (S)) is illegal … door_red is shut — needs key_red"* |
| (b) …ignores `worldDigest` | **5 red** | **STUCK at the digest row**, run aborts at 217 PASS |
| (c) `deriveRequires` drops the subtraction | **1 red** | **1 red** *(was 0 — see above)* |

**Gates, before → after.**

| gate | before | after | command |
|---|---|---|---|
| `check-maze-lab.mjs` | 255/0 | **265/0** | `node scripts/procgen/check-maze-lab.mjs` |
| `mazeQueueExecutor.test.js` | 38 | **60** | bounded vitest |
| `mazeLabWalk.test.js` | 32 | **38** | ” |
| `mazeRoomUI.test.js` | 151 | **157** | ” |
| bounded ⚖ 52 | — | **59 files / 2373** | `npx vitest run frontend/modules/mazeRoom/ frontend/modules/loops/ frontend/modules/procgenDocs/` |
| in-app `--batch=fast` | 61/61 | **61/61** | `compare-runs.js` vs `…T08-00-17`: *No differences in status, roster, or duration* |
| maze byte-identity | `677b7d9c…` | **unmoved** | `node scripts/procgen/dump-maze-byteidentity.mjs \| md5sum` |
| doc link census | 221 | **223** | a MUTUAL pair (`loop-recording.md` ⇄ `maze.md`); `lintGateLabels.test.js` **14/14 green — no allowlist key moved**, the two names S2b interpolated stayed interpolated |

⚠ **`--batch=fast` STARVED on its first run** (0/0, *"Timeout waiting for tests to start"*, load 11.1
across 8 cpus) — **and it was mine**: a stray `npx playwright test --config=playwright.config.js` I
launched by accident was still running the whole suite in three workers. Killed by captured PID, re-run
solo, 61/61. `compare-runs.js`'s default baseline picked the STARVED run, so the comparison had to name
the last good `fast` run explicitly — a starved run in the directory is a silent baseline.

**Re-bank:** `gate: maze-lab` **255/0 → 265/0**, CI-sourced, `measuredAt` `54877a7ac` — CI's own
answer for that SHA is byte-equal to the local run (`ci-summary.mjs 54877a7ac --gate="gate: maze-lab"
--json` → `265/0`, run `33651783736`). ⚠ **AND S2b's FINDING BIT AGAIN, ONE STEP FURTHER ON.** The
row's recipe reads CI **at HEAD**, so running `--write --key=` after the as-built commit answered
`KEEP … (helper exit 2) — no CI run for this SHA`: `CC/docs/**` triggers nothing, so the docs head has
no run to read. Knowing the rule is not enough — the WRITE has to *happen* at a code head. Done from a
throwaway `git worktree` detached at `54877a7ac` (node_modules symlinked) and the four-line diff copied
back, rather than moving a SHARED tree's HEAD under another session.

**Notes for whoever is next.**
- ⚠ `savedQueueStore`'s tag is `(arrivalExitId, ordinal)` and a save **REPLACES the same tag**, so two
  recordings of one block cannot coexist. The stale LABEL is therefore what a *second* block's
  recording or an untouched history entry gets — a re-record of the same block simply overwrites the
  stale one. Verified on disk while writing the picker's row.
- ⚠ A LAB walk's `requires` is **always `[]` in practice**: `MAZE_PALETTE.items` is `null`, so a lab
  session starts empty-handed and anything it crosses it must have picked up. The non-empty case
  reaches the page only through a document authored elsewhere — which is exactly what CLAIM 22b's R3
  rows are.
- ⚠ `deriveRequires` reports a `rule`-typed gate only when the walk **crossed** it; a rule gate
  standing elsewhere on the level does not spoil the derivation (a row asserts it).

**⇒ R-b VERIFIED BY THE PLANNER — R3/R4 CLOSED; D1+D2+D5 LAUNCHED (2026-09-02, `maze-lab-planning`, per
`a16f09b62`).** R-b (`54877a7ac`, as-built `0efe2e249`, bank `a4e197517`) re-checked: `gate: maze-lab` 265/0
CI-sourced at the CODE head; `mazeWorldDigest`/`deriveRequires`/`stampRecordingPreconditions`/
`refuseReplayPreconditions` exported; loops passes `{recording}` through `replayActions`; digest unmoved;
bounded vitest 52 files/1921 green. **Overturned (plan §34):** the lab's two call sites were ONE function
(after `loadPayload`, before `adopt`); the picker LABELS a stale recording (hiding it would be
indistinguishable from never-recorded); the digest is LAZY; `_startVisitRecording` fired while the panel
still held the region being LEFT (a second site stamps once settled); **mutant (c) found a vacuous row set
AGAIN** — every `requires: []` row sat on a level with no obstacle — fixed by the discriminating row. Facts
for later: one recording per `(arrivalExitId, ordinal)` tag; a LAB walk's `requires` is `[]` in practice
(the palette's items are null); a STARVED in-app run becomes `compare-runs.js`'s default baseline — name
the last good one. **D1+D2+D5 launched** (`NewDocs/plans/maze-lab-arms-sliceD1-prompt.md`,
`maze-lab-arms-sliceD1`): ONE `identityFields(state)` the base tag, payload and readout project from with
omissions SPELLED (the recorded `writeUrl` defect made unrepeatable by a derived-keys test; byte-equal
outputs captured first) + `elementInfo` = `elementSummaryOf` verbatim (CLAIM 14's read set kept) · the
panel's click through `tileAtPoint` with a scaled-canvas jsdom measurement (before: (6,4); after: (3,2))
· the mirror copies `turn` beside `player_pos` (`k + w` pinned). Three commits, three mutants.

**⇒ D1+D2+D5 AS BUILT (2026-09-02, `maze-lab-arms-sliceD1`; main `d7416903a` / `8d9f57064` /
`7facc1b2c`).** Three independent correctness fixes, one commit each, three mutants each RUN.

**D1 — ONE identity field list (`d7416903a`, M4 + M5).** `mazeLab.identityFields(state)` is the one
frozen projection `{seed, biome, width, height, step, bounds, budget, roster, skeleton, areas,
elements, require, directives, loaded}`; `editBaseTag`, `labPayload`, the new `labUrlFields` (what
`mazeLabView.writeUrl` spreads) and the new `labReadoutIdentity` (what `window.__mazeLab` spreads)
all PROJECT from it, and `mazeLabBridge.mazeLabSummary` stays the protocol's own field list
(`labProtocol.js:109`), a projection of the projection. The two URL omissions are DESTRUCTURED OUT
by name — `directives` (⚖ §3.9) and `loaded` (how a level arrived is not a parameter that runs).

*The byte capture, taken BEFORE the first edit and re-taken after* (script kept in the session
scratchpad; four fixtures — a plain ladder state, a DIRECTED state, `guard;len=2;turns=1` on
`rooms` 15x15 with `areas={keys:1}`, and that payload LOADED back): **`labPayload`'s output,
`editBaseTag`'s block, the URL writer's output and `mazeLabSummary`'s output are byte-identical
before/after on all four**; the readout's identity block has the same KEY SET and the same value for
every key — only its key ORDER moves (it is now a spread), and nothing stringifies the readout whole
(checked: no `JSON.stringify(__mazeLab)` in `check-maze-lab.mjs` or `check-procgen-lab-hosting.mjs`).

*M5 — the element readout, field set derived not typed* (`elementSummaryOf(model).placed[0]`):
- BEFORE (12): `instance, index, params, site, block, button, door, flagCell, ports, tunnel, guards, cost`
- AFTER (19): the same twelve **plus** `element, family, drawsBefore, drawsAtConstruct, binds,
  entryMouth, carveOverwrote` — **7 added, 0 dropped, 0 renamed**, so CLAIM 14's reads
  (`elementInfo.ran`, `placed[0].guards`, `placed[0].tunnel`, `refused.reason`) and the
  `maze-element` demo entry (`elementInfo.ran == true`) are all still answered.

*The rows that make the recorded defect unrepeatable* are DERIVED over
`Object.keys(identityFields(state))`, never typed (a count of four cannot tell the defect from its
absence): the payload carries every field (top level, or `base` for exactly `step`/`loaded`); the
readout block carries every field and nothing else; the bar omits EXACTLY `directives` and `loaded`;
`elements` moves the bar and reads back as the level it describes; and every reader agrees on the
VALUE, not only the key.

⚠ **RESIDUE FOUND AND NAMED, not fixed: `editBaseTag` omits `bounds`, `budget` and `roster`.**
`roster` is the one that bites — two runs of one seed and step under different rosters draw from
different palettes and make different levels, and the tag calls them the same base. Adding a field
would move every committed payload's `base` block, which is the byte gate D1 is written under, so
the omission is ASSERTED by a row instead (a slice that fixes it will red that row on purpose).

**D2 — the panel's pixel→tile click (`8d9f57064`, M6, a live bug).** `_handleCanvasClick` now calls
`procgenCore/labView.tileAtPoint` with the rect's own size and the world's cols/rows, and subtracts
the canvas border read off the **computed style** (not restated as a JS constant — a second spelling
of a CSS value is the drift this rung removes; jsdom reads 0, the honest answer for a canvas with no
stylesheet). The silent return for a point off the room is kept — the panel is not a lab — but the
out-of-range ANSWER is `tileAtPoint`'s.

*Measured, each row carrying the old arithmetic as its control:*

| point | before | after |
|---|---|---|
| 2x canvas, visual CENTRE of tile (3,2) | **(7,5)** | (3,2) |
| 2x canvas, top-left CORNER of tile (3,2) | **(6,4)** | (3,2) |
| 1 px border, first pixel of tile (5,4) | **(4,3)** (border-blind) | (5,4) |

⚠ The brief's "(6,4)" is the CORNER mapping; the CENTRE of the same tile maps to (7,5). Both are the
same defect; both are pinned.

**D5 — the mirror copies `turn` (`7facc1b2c`).** §30's residue. `_onVisualizerChange` writes
`turn` beside `player_pos` in one `Object.assign`, guarded on the TYPE (turn 0 is a real turn; a
visualizer with no counter must leave the panel's number alone). ⛔ The wait-mirror branch S2a fixed
is untouched. Pinned: 3 delegated moves + 2 delegated waits ⇒ `state.turn === 5`; the last step onto
the exit ⇒ *"Reached exit in 6 steps."*; a counter of 7 stays 7 under a turn-less visualizer.

**Mutants — RUN, not reasoned** (copy/restore, trap 1072; each restored and `git diff` confirmed
empty before the next):

| # | mutant | red |
|---|---|---|
| (a) | `elements` off the bar again (`labUrlFields`) | 3 rows |
| (b) | `elements` dropped from `labReadoutIdentity` | 2 rows |
| (c) | the click back to `/ TILE_PX` | 3 rows |
| (d) | the border not subtracted | 1 row |
| (e) | the `turn` copy dropped | 2 rows |

⚠ **(c) leaves the BORDER row green** — at 1:1 the intrinsic division happens to answer correctly
there — so the two D2 mutants are non-redundant and neither alone certifies the pair (trap 1081's
shape, one step milder: two rules, each sufficient for a different row).

**Gates, all run here.**

| gate | before | after | command |
|---|---|---|---|
| `check-maze-lab.mjs` | 265/0 | **265/0 UNMOVED**, `ALL CHECKS PASSED` | `node scripts/procgen/check-maze-lab.mjs` |
| `check-procgen-lab-hosting.mjs` | 66/0 | **66/0 UNMOVED**, `ALL CHECKS PASSED` | `node scripts/procgen/check-procgen-lab-hosting.mjs` |
| bounded ⚖ 52 | — | **37 files / 1764** | `npx vitest run frontend/modules/mazeRoom/ frontend/modules/procgenLabPanel/ frontend/modules/procgenCore/labView.test.js frontend/modules/procgenDocs/` |
| `mazeLab.test.js` | 115 | **122** | ” |
| `mazeRoomUI.test.js` | 157 | **165** | ” |
| `procgenMazeElements.test.js` | 161 | **162** | ” |
| in-app `--batch=fast` | 61/61 | **61/61** (3.5 min) | `compare-runs.js …T15-54-08 …T16-41-30` → *No differences in status, roster, or duration* |
| maze byte-identity | `677b7d9c…` | **unmoved** | `node scripts/procgen/dump-maze-byteidentity.mjs | md5sum` |

⚠ **The baseline was NAMED, per R-b's own note** — the STARVED `…T15-49-23` (0/0, *"Timeout waiting
for tests to start"*) still sits in `test-results/in-app-tests/` and is what `compare-runs.js` picks
by default. The last good `test-substrates/fast` run is `…T15-54-08`.

**No re-bank.** `gate: maze-lab` stays 265/0 — D1 is a projection refactor and no CI-sourced row moved.

⚠ **A wait-loop note, measured here.** Launching a browser gate under `setsid nohup … &` and reading
`$!` gives the **wrapper's** pid, not the gate's. The liveness poll on that number went false while
`ps -eo pid,cmd` still showed `node scripts/procgen/check-maze-lab.mjs` one pid along with 77 of 265
checks done — so the tail I read as “finished” was a log MID-RUN, with an exit code of 0 and **no
`ALL CHECKS PASSED` line**. CLAUDE.md's “a wrapper's children outlive it”, in its READING form rather
than its killing form, and `feedback_exit_code_without_a_summary_is_not_a_verdict` is what caught it:
the verdict came from the SUMMARY line, never from the poll returning.

**What this slice overturned in the brief.**
- **The readout does NOT omit `skeleton`/`areas`/`elements`/`require`** — §16.1's M4 row was written
  at `44e47f445` and the readout has carried all four (plus `directives`) ever since, just far below
  the block the brief quotes and beside the things DERIVED from them. What was true is the rest of
  M4: five copies, five spellings, and one of them (`?? null` vs `?? DEFAULT_SKELETON`) a live
  divergence in the DEFAULT arm — which the new value row asserts away.
- **The brief's “(6,4)” is the tile's CORNER, not its centre.** At 2x, the visual CENTRE of tile
  (3,2) mapped to **(7,5)**; its top-left corner mapped to (6,4). Both are pinned.
- **`labPayload` has no top-level `step` or `loaded`** — they reach a payload through `base`. The
  coverage row names the two rather than letting the absence pass for an oversight.
- **`elementSummaryOf` takes the MODEL, not `model.elements`**, and a LOADED level has no
  `model.elements` at all — the readout's existing guard had to stay.

**NEXT (pre-authorized): D3+D4.**

**⇒ D1+D2+D5 VERIFIED BY THE PLANNER; D3+D4 LAUNCHED (2026-09-02, `maze-lab-planning`, per `a16f09b62`).**
D1 `d7416903a` / D2 `8d9f57064` / D5 `7facc1b2c` / as-built `25115999f` re-checked: `identityFields`/
`labUrlFields`/`labReadoutIdentity` exported, the click through `tileAtPoint`, the mirror copies `turn`,
`gate: maze-lab` 265/0 UNMOVED, digest unmoved, bounded vitest 30 files/1312. **Overturned (plan §35):** M4's
"the readout omits four fields" was STALE at `44e47f445` (the planner re-read the wrong block — §16.3's own
lesson); what was real was five copies and a DEFAULT-arm divergence (`?? null` vs `?? DEFAULT_SKELETON`),
now pinned on VALUES; D2's "(6,4)" was the tile's corner (the centre mapped to (7,5)); two mutants were
needed for the click (scale AND border are non-redundant). **Residue → D6:** `editBaseTag` omits `bounds`/
`budget`/`roster` and `roster` bites — asserted by a row that reds on purpose when taken (moves every
committed payload's `base`). **D3+D4 launched** (`NewDocs/plans/maze-lab-arms-sliceD3-prompt.md`,
`maze-lab-arms-sliceD3`): M7 param forms, M8 `assertViewFields`, M11 `canOpenRoom` (the ONE behaviour
change — the asymmetric exemption), M12 `fetchOrRefuse`, M13 `posKey` exports/`slot_`/download; M9
`worldRulesJsonOf` with a `projectRegions` hook (the all-maze rules.json byte-identical, `stats`/`dropped`
restored), M10 `deriveWorldAtlasOf` returns `parts`. Claim everywhere: UNMOVED (265/0, op-log fixtures,
hosting 66/0), captured before and asserted after.

**⇒ D3+D4 AS BUILT (2026-09-02, `maze-lab-arms-sliceD3`; main `4d8791688` / `a42d99451`).** Seven
dedup findings, two commits, seven mutants RUN. **Every claim is "nothing observable moved" except
ONE named behaviour change (M11)** — the outputs were captured before the first edit and re-taken
after, and the captures are what the rows below quote.

**D3 — the lab page's five internal duplicates (`4d8791688`).**

| # | one owner | code lines | the byte capture |
|---|---|---|---|
| M7 | `mountParamForm(boxId, attr, schema, {values, anyOption})` / `readParamForm(…)` + `skeletonParamSchema(kind)` in `mazeLabView.js` | **−61 +20** | the **whole form capture** below |
| M8 | `mazeRoomRender.viewFieldsRefusal(view, spec)` + three frozen `*_VIEW_SPEC`s | −36 **+52** | every refusal message and error class, identical |
| M11 | `mazeSetLab.roomOpenRefusal(open, index)` — PURE | −25 +39 | ⚠ the one behaviour change |
| M12 | `fetchOrRefuse(url, {param, noun, as})` | **−32 +24** | both refusal sentences, verbatim |
| M13 | `download` → `setDownload`; `mazeLibraryEntry.slotName`; engine `posKey`/`unposKey` and its five hand parsers | **−27 +18** across five files | the gate's own rows |

⛓ The column is DERIVED, not typed: hunks of `4d8791688` attributed by content, comment and blank
lines dropped; the six buckets sum to the commit's own **−188 +202** (of which +41 are the new test
rows and 7/8 are import lines that belong to no single finding). ⚠ **M8 and M11 ADD code** and that
is the shape of both: M8 moves five per-module SENTENCES out of `if` bodies and into three frozen
specs (the copies removed are the LOOP), and M11 gains a documented pure rule plus a pin. What the
slice removes outright is the three copy-pasted forms (M7) and the two fetch bodies (M12).

⛔ **M7 was NOT lifted to `procgenCore/labView.js`** — Seedling mounts a form of this kind but its
caller is not in this slice, and a shared owner is written at the SECOND caller, not before it.

*`anyOption` says BOTH halves of the element form's difference at once* — the "any (draw it)" option
AND the **pre-selection rule**, which is the half the brief did not name: without it an absent value
pre-selects the schema's DEFAULT (`values[k] ?? p.default`, compared with `===`), and WITH it there
is no default arm at all, because `templateContract.assertParamSchema` GUARANTEES every element knob
has a default IN its domain — so applying it would silently turn every omitted knob into a NAMED
one, which is the difference between `guard` and `guard;len=3` (`elementSpec.namedParams`).

*M8 returns the SENTENCE and does not throw*, because each module refuses with its own error class
and `mazeAreaOverlay.test.js` asserts `toThrow(AreaOverlayError)` on exactly that path.

**⚠ M11 — the one behaviour change, and the rule chosen.** The two openers each carried both guards
and DISAGREED on one: `openSetRoomAt` exempted the SAME INDEX from the local-session guard
(`setRoomIndex !== index`) and `openForeignRoomAt` did not. **The rule taken is the same-index
exemption in BOTH guards on BOTH routes** — every other guard on that page already reads *"a room
that is open does not block a request to open THAT room"* (the foreign guard's own
`foreignRoom.index !== index`, and each route's no-op-success return), so the asymmetric copy was
the odd one out rather than a rule anybody had stated. The refusal SENTENCES stay at the callers:
the routes close into different documents (one into the WORLD, one into the LIBRARY) and only one of
them has a frame to point at.

**D4 — the world rules.json path (`a42d99451`).**

- **M9.** `worldRulesJsonOf` gains a `projectRegions` hook; `worldAllMazeRulesJson` is a wrapper.
  ⛔ **A hook and not a `compileOptions` flavour, for a reason the return value states**: the
  projected atlas is what the function HANDS BACK, and the maze's own row reads `out.atlas` to
  assert the projection was compile-time only — a compile-time flag could tell the compiler and
  could not answer *"which atlas was compiled"*. It defaults to `null`, and the no-hook path returns
  `derived.atlas` ITSELF, un-copied (asserted: `plain.atlas` **is** the object handed to the
  compiler), which is why `worldDerivation.test.js`'s existing rows did not have to move.
- **M10.** `deriveWorldAtlasOf` returns `parts: [{id, atlas}]`; `reportOver` hands them on as
  `derivedParts`; `worldPartReportRows` reads them. ⛔ The per-part fallback STAYS and is exercised —
  `reportOver` returns EARLY with no derivation when the world's atlas does not build, and the rows
  must still name the part that failed.

*The D4 capture, on the W4 world with the crossing on:*

| subject | before | after |
|---|---|---|
| the ALL-MAZE `rules.json` | 13,311 bytes, md5 `f85dd94cc781e131a38672288319d8f5` | **identical** |
| `report`, `atlas.regions`, `notes`, `displaced` | — | **identical** |
| the REPORT's per-part rows, and the core's own rows | — | **identical** |
| the return's keys | `rules, report, atlas, notes, displaced` | **+ `stats`, `dropped`** |
| `stats` | `undefined` | `{parts:2, regions:4, exits:12, locations:0, connections:3, links:1, displaced:1, substrates:{flash_seedling:2, maze:2}}` |
| derivations of a part's own atlas, spied, over report + rows | **6** | **4** (2 parts) |

⛓ The rows' own cost is **N → 0** and the report+rows pair halves; the report itself still derives
twice (the atlas it validates, and the compile), which the row states as `2 × parts.length` rather
than typing a 4.

**The byte captures (both kept in the session scratchpad).**

- *Forms + both fetch refusals, in a real browser*, enumerated from the page's own selects rather
  than a typed list: **9 skeleton kinds** × (form DOM, every option's `value`/`text`/`selected`, the
  `?skeleton=kind;…` values path, the read-back and the URL a change writes) · **6 element heads** ×
  the same · the area form and all **4** of its knobs · both `?library=`/`?world=` 404 sentences.
  **68,775 bytes, md5 `a7131f0e5de033501e8925c93e59925d` BEFORE and AFTER.**
- *M8's refusals in node*: 8 non-object inputs, and per field three shapes (deleted, `undefined`,
  inherited-only), plus every module-specific extra check — message, error class and return,
  **identical**.

**Mutants — RUN, not reasoned** (copy/restore, trap 1072; each restored and the file diffed clean
before the next).

| # | mutant | red |
|---|---|---|
| (a) | drop `layer` from `ELEMENT_VIEW_FIELDS` | 1 row |
| (b) | drop `layer` from `OVERLAY_VIEW_FIELDS` | 1 row |
| (c) | drop `seenTiles` from `VIEW_FIELDS` | **GREEN — see below** |
| (d) | reinstate the asymmetric exemption in `roomOpenRefusal` | 1 row (the new pin) |
| (e) | the element form pre-selects the schema DEFAULT | the browser capture moves (`selectedIndex` 0 → 2) |
| (f) | drop `stats` from `worldRulesJsonOf`'s return | 3 rows |
| (g) | `deriveWorldAtlasOf` hands back an empty `parts` | 2 rows |
| (h) | remove the wrapper's substrate strip | 1 row |

⚠ **(c) WAS GREEN, and that is a fixture defect this slice's own mutant found (§34).**
`mazeRoomRender.test.js` walked `VIEW_FIELDS` to build its cases — a population read off the thing
under test — so a build that DROPS a field simply had one fewer case to check and all 22 rows
passed. The list is now stated INDEPENDENTLY in that file and the same mutant reds. (The two
overlays already had theirs, in their hard-coded `missing "layer"` rows — which is why (a) and (b)
were red from the start.)

⚠ **(g) leaves the ROWS byte-identical** — the fallback derives them — so the row that reds is the
DERIVATION COUNT. A rows-only fixture could not have seen M10 at all.

**Gates, all run here.**

| gate | before | after | command |
|---|---|---|---|
| `check-maze-lab.mjs` | 265/0 | **265/0 UNMOVED** ×3 (baseline, post-D3, post-D4), `ALL CHECKS PASSED` | `node scripts/procgen/check-maze-lab.mjs` |
| `check-procgen-lab-hosting.mjs` | 66/0 | **66/0 UNMOVED** | `node scripts/procgen/check-procgen-lab-hosting.mjs` |
| `generate-procgen-reference --check` | — | **6 modules + 4 regions MATCH** | `node scripts/procgen/generate-procgen-reference.mjs --check` |
| bounded ⚖ 52 | 32 files / **1404** | **32 / 1411** (D3) → **32 / 1414** (D4) | `npx vitest run frontend/modules/mazeRoom/ frontend/modules/procgenCore/{worldDerivation,worldSetAdapter,labView,setEditorCore,setEditorView}.test.js` |
| the other `reportOver` consumers | — | **104/104** | `npx vitest run frontend/modules/seedlingDemo/{worldChain,seedlingSetAdapter}.test.js` |
| in-app `--batch=fast` | 61/61 | **61/61** ×2 (3.5 min, 3.4 min) | `compare-runs.js …T16-41-30 …T17-25-47` and `… …T17-37-26` → *No differences in status, roster, or duration* |

⛓ The bounded set was WIDENED beyond the brief's four files by `setEditorCore.test.js` and
`setEditorView.test.js`, because D4's M10 adds a field to `reportOver`'s frozen return — and then by
the two `seedlingDemo` set-editor test files, which are the only other consumers of it
(`grep -rl reportOver`).

**No re-bank.** `gate: maze-lab` stays 265/0; no CI-sourced row moved.

**What this slice overturned in the brief.**
- **M8's three copies differ in a way the brief did not name, and it is OBSERVABLE**: this file
  tested presence with `hasOwnProperty` and both overlays with `in`, so an INHERITED field is a
  field to the overlays and is not to the render module. Measured over views built on
  `Object.create`: render refuses all 12, the overlays accept all 5. The shared check takes `own`
  and PRESERVES both — unifying either way is a second behaviour change nobody asked for.
  ⚠ **Residue → a later slice**: one of the two spellings is wrong, and which one is a question
  about what a view IS, not about this refactor.
- **M7's "skips an empty select" is REDUNDANT, measured**: dropping the `continue` changes nothing,
  because the domain lookup below it (`p.domain.find(d => String(d) === sel.value)`) already fails
  for `''`. It is KEPT as the declared statement of intent — the mutant that proves the capture
  discriminates had to be the PRE-SELECTION one (e) instead.
- **M11's changed branch is close to unreachable on the page** (it needs a LOCAL room session open
  at an index whose cell reads as the OTHER substrate), which is why the rule was lifted to a pure
  function in `mazeSetLab.js` and pinned there. A browser row would have been a fixture that cannot
  tell the two builds apart.
- **M12's two sentences share more than the brief said**: the possessive in *"an arm with no
  library/world"* IS the parameter's own name, so ONE template with two fillings reproduces both
  byte for byte — there is no third string to keep in step.
- **M13's `_parseStateKeyXY` was NOT identical to the other four parsers**: it returned
  `{x: Number(parts[0]), y: Number(parts[1])}`, which is `NaN` where `unposKey` gives `undefined` on
  a one-field key. Every state key is `"x,y"` or `"x,y,t"` (checked at the producer), so the
  difference is unreachable and the shared reader is the engine's.
- **M10 could not be done inside the two files the brief names.** `worldPartReportRows` does not
  call `deriveWorldAtlasOf` — it derives each part itself — so "the report reads them" needed the
  derivation to REACH it: `reportOver` now carries `derivedParts` on its return (the `reportRows`
  hook is already handed the report). One nullable field on a frozen return, and no key-set
  assertion anywhere reads it.

**NEXT (pre-authorized): F-a.**

**⇒ D3+D4 VERIFIED BY THE PLANNER; F-a LAUNCHED (2026-09-02, `maze-lab-planning`, per `a16f09b62`).** D3
`4d8791688` / D4 `a42d99451` / as-built `8a1eb6b1a` re-checked: `mazeSetLab.roomOpenRefusal`,
`mazeRoomRender.assertViewFields`, `posKey`/`unposKey` exported, `worldRulesJsonOf`'s `projectRegions` hook,
`reportOver`'s `derivedParts`; `gate: maze-lab` 265/0 UNMOVED ×3; digest unmoved; bounded vitest 67 files/2608
green. **Recorded (plan §36):** M11's rule = the same-index exemption in BOTH guards on BOTH routes (lifted
PURE to `roomOpenRefusal`; the branch is near-unreachable on the page, so the pin is a unit row) · **a live
fixture defect**: `mazeRoomRender.test.js` built its missing-field rows by WALKING the list under test — 22
rows green under the mutant (*a population read off the subject cannot discriminate*) · **residue D7**: the
render module tests presence with `hasOwnProperty`, the overlays with `in` — measured 12 vs 5 over
`Object.create` views; the shared check preserves both; which is right is a question about what a view IS ·
M7's "skips an empty select" was an EQUIVALENT mutant; the real difference is that `assertParamSchema`
guarantees every element knob a default, so pre-selecting `?? default` would NAME every omitted knob ·
M10 needed `setEditorCore.reportOver` to carry `derivedParts` (the report never called the derivation);
its row is the derivation COUNT 6 → 4, the rows being byte-identical by construction · the ALL-MAZE
rules.json capture was the NODE W4 world, CLAIM 21g the page-side evidence. **F-a launched**
(`NewDocs/plans/maze-lab-arms-sliceFa-prompt.md`, `maze-lab-arms-sliceFa`): F5 `parseSeqPayload`, F3
`pollUntil` (⚠ the wasm boot path — the wasm gates run on WINDOWS CHROME, announce and run), F11 a
number-keyed `indexLevels` (the bundle constraint decides the home), F6 the `outExitId` import measured
against the bundle, F9 the exporter imports the canonical tile size (13 `const TILE = 16` files at this
head, not the survey's 7 — derive). Byte-inert claims captured first.

**⇒ PLANNER HANDOFF (2026-09-02 11:56): `maze-lab-planning` → `maze-lab-planning-2`.** The user asked when a
new planning session should have started; the honest answer was at `a16f09b62` (the plan complete, the
ladder pre-authorized) — raised late. Handoff `NewDocs/plans/maze-lab-arms-planning-2-prompt.md` (Fable,
primary tree, `-t maze-lab-planning-2`); F-a redirected to report to the successor; the successor owns F-a's
verification, F-b's kickoff, and the F-c/F-d ⚖ conversation, plus the residues D6/D7 and the VIEWER arc's
opening question.


**⇒ F-a AS BUILT (2026-09-02, `maze-lab-arms-sliceFa`; main `dcc962623` … `34c915f18`).** Five
findings, five commits, **six mutants RUN** (copy/restore, trap 1072 — every one restored and the
tree diffed clean before the next). Every claim is *"nothing observable moved"*; the two that could
NOT be made byte-inert (F11's key type, F6's refusal) are named below with what changed and why.

| # | one owner | what moved | the proof |
|---|---|---|---|
| F5 | `flashPanel/seqPayload.parseSeqPayload(value, fields)` | the five refusal rules leave BOTH parsers; each keeps its typing | both callers' `.test.js` files **untouched** (`git show --stat` names neither) |
| F3 | `flashPanel/pollUntil.js` — the three adapter waits | **21 loop lines removed**; the refusal strings and the iteration order preserved exactly | 17 NEW rows; **`check-seedling-wasm-ship` 263/0 on Windows Chrome** |
| F11 | `seedlingDemo/atlasSource.indexLevels(doc)` — number-keyed | `indexSeedlingLevels`' STRING key is gone; the two lookups convert | 16 rows across two NEW files; the mutant reds 13 rows in 5 files |
| F6 | ⛔ **NOT** imported — the spelling stays | the docblock now carries the PRICE, and a derived row asserts it | two mutants: the pin, and TAKING the import |
| F9 | 11 of 14 `16`s import the canonical; 3 keep it with the price | `levelSetExporter.TILE_SIZE = SEEDLING_TILE_SIZE` | `levelSetExporter.test.js` 45/45 unmoved; the mutant reds 6 |

**F5 (`dcc962623`).** `Game.pendingCheck` (4 fields) and `Game.pendingExit` (6) are one BridgeGeneric
dialect and spelled the same five rules — non-string, the empty boot report, an exact field count,
*"EMPTY IS NOT ZERO"* (written out twice, in two wordings), and a `<seq>` returned but never
compared. `parseSeqPayload` states them once and **does NOT type**: `pendingCheck` sweeps all four
fields to integers and folds the fourth into `cleared: written === 0`; `pendingExit` sweeps five of
six and keeps `type` a STRING. Those contracts do not agree, and folding them in would be the drift
the hoist exists to prevent. ⛔ Its own file rather than a function in `seedlingSemantics.js`: both
binding modules import NOTHING today, and `seedlingSemantics` is the 700-line tile/entity
transcription with a census guard of its own.

**F3 (`fca9de132`), and the mutant that would have been VACUOUS.** The brief's proof was *"drop the
`cancelled` check ⇒ the adapter's detach row reds"*. **There was no detach row.** At `8a1eb6b1a`,
`git grep -n "_cancelled\|waitForShim"` reaches `wasmBridgeAdapter.js` and `flashPanelUI.js` and
NOTHING under a `.test.js` — so the cancellation that exists so a preset switch cannot resolve a
stale wait against the NEW game page (same element id, different game; `flashPanelUI.js:451` waits
30 s for the shim, `:457` TEN MINUTES for the user's ▶ Start) was asserted by nobody, on any
transport. 17 rows now cover the loop and all three call sites; **the mutant reds 4, two of them the
`detach()` rows.** `adapter detached` is now spelled ONCE, as `DETACHED_MESSAGE` in the file that
owns the notion — `pollUntil`'s own default is colourless.

⛔ **`watchWasm.until()` STAYS, and the difference was MEASURED before it was kept** (four
observable differences, now in its docblock): `lifetime.guard('wasm-until', …)` **records the
blocked tick in the arm's `stopped` list** (`procgenCore/pageLifetime.js:160-171`) — the page's LEAK
WITNESS, which a `cancelled` predicate cannot record, so routing it through `pollUntil` would delete
evidence rather than a duplicate; `onRetire` rejects the INSTANT the arm retires, not at the next
tick; a predicate throw is swallowed there and not here; 200 ms / 180 s are the lab's numbers.

**F11 (`95e8521a2`) — the one place a number-keyed Map met a string-keyed lookup.** Three sites
built `Map<level, room>` from a `{levels:[…]}` document; `indexSeedlingLevels` keyed by
`String(level.level)` AND accepts *"the document or an already-built Map"*, so a number-keyed Map
from either of the others looked up as a string and MISSED, silently, as `undefined`. The key is the
number the documents carry (measured: **all 116 `level` fields in the committed extract are
integers**; asserted in a row rather than typed).

⚠ **The conversion is at the CALLER and it is a ROUND TRIP, not `Number()`.**
`region-atlas.schema.json:126-128` blesses *"an integer or non-empty string level id"*, so
`map_ref: "19"` named level 19 when the index was string-keyed and still does — dropping that would
be a behaviour change shipped under a byte-inert claim. But `Number(null)` is **0** and level 0 is
the real starting room (⚠ **FALSE — measured `with_map_ref=0 null=0 absent=3`; the three regions OMIT the field, and no committed
JSON carries a null `map_ref`. `dict.get()` returns `None` for an ABSENT key and I read that as null. The
round-trip rule stands on its own — `Number(undefined)` misses either way — and its row is synthetic**),
so only a string `Number` maps back to itself converts; `null`, `undefined`, `'mz_3'`, `''`, `'007'`
and `' 19'` miss, exactly as `String(…)` left them.

⛔ **NOT adopted, each with its reason.** `apPlacementRewriter.recordsByLevel` indexes to
`{record, i}` and REFUSES a non-integer or duplicate level by name — a refusing index with a
different value type is a different function. **And the survey named FOUR maps where there are
FIVE**: `regionAtlasValidator.indexMapDocument` is string-keyed BY DESIGN (it takes the Seedling
extract OR any `{id: {width,height}}` object, so a string is the union's common denominator) and
`regionAtlasValidator.test.js:747-748` pins both key shapes.

**F6 (`3f17fe132`) — the import was PRICED and REFUSED.** `seedlingRegionBinding` is IN the panel's
static closure, so importing `seedlingAtlasDerivation` would be paid by every page that mounts the
flash panel, to spell twelve characters:

| the closure from `flashPanel/index.js` | files | bytes |
|---|---|---|
| at `8a1eb6b1a` | 43 | 650,891 | ⚠ **MIS-LABELLED — see the planner's correction below: 41 / 644,012 at that head; this row is post-F3. The DELTA is the claim and it reproduces to the byte.**
| + a static `seedlingAtlasDerivation` | 70 | 1,918,889 |
| **the cost of one line** | **+27** | **+1,267,998** |

⛓ **The closure walk, so the numbers are re-derivable** (relative specifiers only — a dynamic
`import(…)` is a separate chunk and is deliberately NOT followed, which is the arrangement being
asserted):

```
closure() { node -e '
const {readFileSync,statSync}=require("fs"),{dirname,resolve}=require("path");
const RE=/^\s*(?:import|export)\s[^"\x27]*?from\s*["\x27]([^"\x27]+)["\x27]|^\s*import\s*["\x27]([^"\x27]+)["\x27]/gm;
const seen=new Set(),stack=process.argv.slice(1).map(f=>resolve(f));
while(stack.length){const f=stack.pop();if(seen.has(f))continue;seen.add(f);
let s;try{s=readFileSync(f,"utf8")}catch{continue}
for(const m of s.matchAll(RE)){const p=m[1]??m[2];if(p&&p.startsWith("."))stack.push(resolve(dirname(f),p));}}
let b=0;for(const f of seen){try{b+=statSync(f).size}catch{}}
console.log(`files=${seen.size} bytes=${b}`);' "$@"; }

closure frontend/modules/flashPanel/index.js
closure frontend/modules/flashPanel/index.js frontend/modules/seedlingDemo/seedlingAtlasDerivation.js
```

⛔ **A number in a comment is unfalsifiable, so the refusal is a ROW.** `seedlingRegionBinding.test.js`
now walks that graph and asserts the SHAPE the number describes: the closure reaches
`seedlingRegionBinding` (or the claim is vacuous) and does NOT reach `seedlingAtlasDerivation`, while
the wiring's dynamic `AP_MODULE_PATHS.derivation` still names it. The pin row is now the documented
**licence** for the duplicate and sweeps four coordinate pairs per `LINK_TAGS` value. Two mutants:
drifting the spelling reds the pin; **taking the import F6 proposed reds the closure row.**

**F11's home was priced the same way, and it is the cheap direction.** `atlasSource.js` has no
imports at all, so importing it costs a flashPanel module **+1 file / +2,138 B** (measured at
`8a1eb6b1a`: `seedlingRandomizerWiring` 6 files/78,888 B → 7/81,026; `seedlingAtlasAnalysis`
6/162,009 → 7/164,147). §5i's 1 MB lesson is about the OTHER direction.

**F9 (`34c915f18`) — the count, derived.** `grep -ln "const TILE = 16" frontend/modules/seedlingDemo/*.js`
= **13** files at `8a1eb6b1a`; **the survey's 7 is the PRODUCTION subset** (crusher, iceTurret,
r5Chain, spinner, r5Shaft, pushables, r5Swim) and the other 6 are `.test.js`. Both numbers are right
about different populations. Plus `levelSetExporter.TILE_SIZE` = **14 spellings** besides the
canonical.

- **11 CHANGED**, on a measured rule — import where the file's static closure ALREADY contains
  `levelWorld`/`seedlingSemantics`, so the import costs zero bytes: crusher, iceTurret, spinner and
  6 test files import one directly; r5Shaft (18 files/1,062,491 B) and levelSetExporter
  (17/1,048,012 B) reach one transitively, both **unchanged** by the direct import. `r5Totem.test.js`
  also loses three inner shadows of its own module-level `TILE`.
- **3 KEPT THE LITERAL** with the price in the docblock: `pushables` and `r5Swim` have NO imports at
  all (1 file, 34,444 / 35,911 B) and `r5Chain` has two (35,352 B); a `levelWorld` import would make
  their closures 10, 10 and 11 files and **~788 KB each** — three quarters of a megabyte to share
  one integer.

⚠ **AND A FINDING ABOUT THE PROOF ITSELF.** The brief asked for *"the exporter's output
byte-identical on its fixtures"*. A hand-rolled md5 capture of
`vanillaRecordSet` / `reachabilityOf` / `buildLevelSet` was byte-identical — under the real change
**AND under the mutant that moves the canonical to 32**. It never reached the tile→pixel multiply,
so it could not have told the two builds apart: *a fixture that does not discriminate is not
evidence.* The instrument that DOES discriminate is the exporter's own suite, which reds **6 rows**
under that mutant.

**Mutants — RUN, not reasoned.**

| # | mutant | red |
|---|---|---|
| (a) | drop the empty-part check in `parseSeqPayload` | **3 rows** — both callers' malformed rows AND the new shared row |
| (b) | drop the `cancelled` check in `pollUntil` | **4 rows**, two of them the `detach()` rows |
| (c) | string-key `indexLevels` | **13 rows across 5 files** (incl. pre-existing rows in `regionAtlasAnalyzer`, `regionAtlasMazeProjection`, `mazeSetLab`) |
| (d) | drift `outExitIdOf`'s spelling | 1 row — the pin |
| (e) | TAKE the static `seedlingAtlasDerivation` import | 1 row — the closure row |
| (f) | `SEEDLING_TILE_SIZE = 32` | **6 rows** in `levelSetExporter.test.js` (and the ad-hoc byte capture stayed GREEN — see above) |

**Gates, all run here.**

| gate | result | command |
|---|---|---|
| the DERIVED reach | **23/23 green** — the reach names 29 gates, 22 browser + 1 arm run | `node scripts/procgen/gates.mjs reach 8a1eb6b1a..HEAD local` |
| `check-maze-lab.mjs` | **265/0 UNMOVED** | (in the reach run) |
| `check-procgen-lab-hosting.mjs` | **66/0 UNMOVED** | (in the reach run) |
| `check-seedling-editor-boot` / `-world` | **41/0** / **50/0** | (in the reach run) |
| `check-seedling-wasm-element` / `-pages` | **11/0** / **20/0** | (in the reach run) |
| ⚠ **`check-seedling-wasm-ship.mjs`** | **263/0, 456.6 s — REAL-GPU WINDOWS CHROME** | `node scripts/procgen/gates.mjs local wasm-ship generated-set` |
| `check-seedling-generated-set.mjs` | **32/0** (windows) | same line |
| `check-seedling-wasm-pins` / `full-tier-owed` | **3 builds four views** / **5/0** | `node scripts/procgen/gates.mjs local wasm-pins full-tier-owed` |
| `check-seedling-ap-placement.mjs` | **ALL ROWS PASSED** | `node scripts/procgen/check-seedling-ap-placement.mjs` |
| ⚠ **…and its `--win` arm** | **ALL ROWS PASSED on real-GPU Windows Chrome** | `python3 -m http.server 8129` **then** `node … --win` |
| `check-seedling-atlas-maze` / `check-region-marking-tool` | **OK** (10 sub-regions, 20 exits, 14 gates) / **OK** | run directly |
| identity rows | **ALL CHECKS PASSED — 16 rows UNMOVED** | `node scripts/procgen/standing-values.mjs --check --only=identity` |
| bounded ⚖ 52 | **32 files / 1016 tests** | see below |
| in-app `--batch=fast` | **61/61**, *No differences in status, roster, or duration* | `compare-runs.js …T17-37-26 …T20-07-18` |

⛓ **The `--win` arm is the strongest single row for F3 and F5**: the REAL panel booted through the
changed `waitForShim`/`waitForBridge` (`boot 18.85s, status=ready`), loaded the p4d page the preset
names, and dispatched a location check through `parsePendingCheck` → `parseSeqPayload` on the live
game (*"found Light for you at Level 030 - Torchpickup"*). One of its own rows reads *"the slot is a
STRING, so `Number('') === 0` is a live risk and is guarded"* — the exact class of bug F5's shared
parser now owns in one place.

⛓ The bounded set was WIDENED beyond the brief's six paths by every file this slice touches:
`npx vitest run frontend/modules/flashPanel/ frontend/modules/seedlingDemo/{atlasSource,apPlacementRewriter,levelSetExporter,seedlingAtlasDerivation,watchWasm,r5Shaft,r5Totem,seedlingSetAdapter,watchSetEditor,worldChain,crusher,iceTurret,spinner,pushables,r5Chain,r5Swim}.test.js`

**⚠ A LOCAL FULL-DIRECTORY VITEST IS NOT A VALID INSTRUMENT ON THIS BOX (⚖ 52, measured again).**
`npx vitest run frontend/modules/seedlingDemo/ frontend/modules/flashPanel/` red `solverBot` here
and, at a **pristine `8a1eb6b1a` control in a throwaway worktree**, `watchSetEditor`'s wall-clock
budget row (`expect(54.07).toBeLessThan(50)`) — three different reds over two runs, **every one
green alone**. ⛓ And the worktree control needed its own repair: a git worktree's submodule
directories are EMPTY, which red 45 files on `Cannot find module '../shared/…'`; symlinking the six
submodules in fixed that but then loaded `shared/procgen/mazeAlgorithms/registry.js` under two
absolute paths, so `worldChain.test.js` died on `registerBackend: duplicate id 'empty'` — a rig
artefact of the symlink, not a finding.

**⛔ `check-seedling-bot-differential.mjs` was STARTED AND STOPPED, and the planner was right to
stop it.** The reach names it, but the only change on its path is 15 lines of DOCBLOCK in
`watchWasm.js` — it drives the wasm page through its own driver, not through `flashPanel`'s
adapters, so `pollUntil` is not on it. It was launched headless and FULL TIER (150 tapes, 152 s on
the first ⇒ ~6 h) holding a `windows`-kind box lock: against
`feedback_wasm_gates_run_on_windows_chrome_never_headless`, and blocking every other browser gate on
the machine. **Not owed.** ⛓ Second lesson from the same incident: an unbounded
`until ! kill -0 $PID` wait loop cannot be interrupted by a peer's message — bound the loop.

**No re-bank.** No CI-sourced row moved; `gate: maze-lab` stays 265/0.

**What this slice overturned in the brief.**
- **§17.1 F3's proof did not exist.** No `.test.js` at `8a1eb6b1a` named `_cancelled` or
  `waitForShim`; the mutant would have been vacuously green. The rows are written.
- **The bounded ⚖ 52 run named `frontend/modules/seedlingDemo/atlasSource.test.js`, which did not
  exist.** `levelSourceFromAtlas` was reached only INDIRECTLY by seven `procgen*`/`watch*` files on
  their way elsewhere, so its throw-by-name — the function's whole documented reason for existing —
  was asserted by nobody. Written, plus `seedlingAtlasAnalysis.test.js`.
- **§17.1 F11 says four indexes; there are five.** The fifth
  (`regionAtlasValidator.indexMapDocument`) is string-keyed BY DESIGN over a union type and is
  pinned that way; it is not a duplicate.
- **§17.1 F11 does not name the `map_ref: null` hazard** (⚠ the FIXTURE census in this bullet is wrong — see above). `Number(null) === 0` and level 0 is the
  starting room, so the obvious conversion at the caller would have resolved three fixture regions
  to a real level.
- **§17.1 F9's "7" and the brief's "13" are both right** — production files vs the whole grep. And
  the brief's proof (the exporter's bytes) does not discriminate unless the capture reaches the
  tile→pixel multiply; it did not, and the mutant proved that before the claim was made.
- **§17.1 F6's import is refused on a MEASUREMENT**, +1,267,998 B, now asserted by a row rather
  than stated in prose.

**NEXT: F-b** (the lab constructing the panel's delivery — its own kickoff). F-c/F-d remain ⚖ open.

**⇒ F-a VERIFIED BY THE PLANNER; F-b LAUNCHED (2026-09-02, `maze-lab-planning-2`, per `a16f09b62`).** Main
`394294151` re-checked from disk: the six commits on `origin/main`; `pollUntil.js:59` / `seqPayload.js:47` /
`atlasSource.js:61` exported; `standing-values.json` has NO diff over `63652ca6f..HEAD` (no re-bank claimed,
none made); the reach log reads 23/23 with `check-maze-lab` 265/0 and `check-procgen-lab-hosting` 66/0;
`win-gates.log` reads `generated-set` 32/0 and `wasm-ship` 263/0 on Windows Chrome; `compare-runs.js
…T17-37-26 …T20-07-18` = 61/61, no differences; bounded vitest here 26 files / 798 green; digest
`677b7d9c…` unmoved; `check-maze-lab.mjs` LIVE here at `394294151` = PASS 265 / FAIL 0, ALL CHECKS PASSED;
`check-slice-records` 73/0/37. **Two data claims in the as-built did not survive measurement (plan §37):**
(1) the F6 closure baseline "43 files / 650,891 B at `8a1eb6b1a`" is **41 / 644,012** at that head (throwaway
worktree, the six submodules symlinked in — unlinked it answers 27); the 43 is post-F3 (`pollUntil.js` +
`seqPayload.js`, by a diff of the two file lists). **The delta reproduces to the byte, +27 / +1,267,998**,
which is what the row asserts. (2) *"three regions in `atlases/seedling-fixture.json` carry `map_ref:
null`"* is FALSE — measured `with_map_ref=0 null=0 absent=3`; no committed JSON carries a null `map_ref`;
`region-atlas.schema.json` types it `["integer","string"]` (omission is the legal form). The round-trip
rule stands (`Number(undefined)` misses; a hand-written null is refused, not resolved to level 0) and its
row is synthetic; the census sentence at `seedlingAtlasAnalysis.js:50` is corrected by F-b. All four
"overturned in the brief" items HOLD at the line. **On the record:** the planner stopped F-a's headless
FULL-TIER `check-seedling-bot-differential.mjs` (not on the change's path, against the Windows-Chrome rule,
~6 h on a windows box lock, under an unbounded wait loop); F-a accepted. Kickoffs now bound every wait loop.
**F-b launched** (`NewDocs/plans/maze-lab-arms-sliceFb-prompt.md`, `maze-lab-arms-sliceFb`): F1 one owner of
the pending/ok/readback protocol WITHOUT weakening `arm()` (the lab has no invalidation companion — measured
0 lines); F2 `bot(name, arg)` on `WasmBridgeAdapter`, re-read per call; F4 ONE readiness pair, with the shim's
install order read from source (`__swfBridge` before `__runtimeReady`; the panel's "click ▶ Start" fires while
the button is disabled) and the callback order MEASURED on Windows Chrome first; **F7 SCALED on a measurement**
— 3 presets carry `map_document`, all name the default, and the hosted lab receives no rules — to the one
relative-path derivation, with "the lab honours the override when hosted" as residue **F7b** for the user.
Every import priced by F-a's closure walk before commit; the four `windows` gates run, never `--no-windows`.

**⇒ F-b AS BUILT (2026-09-02, `maze-lab-arms-sliceFb`; main `b26df6747` … `8d2d299c5`).** Four rows,
six commits, **seven mutants RUN** (copy/restore, trap 1072 — every one restored and the file diffed
clean before the next). The constraint every row lived under held: **`flashPanel/index.js`'s static
closure gains NO `seedlingDemo` file and no lab file** — derived, not asserted (`closurelist … | grep -c
seedlingDemo` = **0** at HEAD).

| # | one owner | route, and why | the proof |
|---|---|---|---|
| F4 | `flashPanel/wasmGamePage.js` — `runtimeUp` (Q1) / `gameUp` (Q2) | the CONJUNCTION of each pair = "the later of the two", written so it survives a build that reverses the order | the boot order MEASURED on the live p4d page, real-GPU Windows Chrome; 2 mutants red **one row in each of three files** |
| F2 | `wasmGamePage.callBot` + `botOver`; `WasmBridgeAdapter.bot()` | null for a missing verb, callback table re-read PER CALL | 2 mutants; the panel's whole AP-placement load driven on Windows Chrome |
| F1 | `seedlingLevelSetDelivery.deliverChunks` — route **(a)**, the protocol hoisted, the state machine NOT | route (b) refused on three measurements (below) | 2 mutants, one of them the year-old bug itself → **17 reds** |
| F7 | `flashPanel/mapDocumentPath.js` — one relative path, three bases | the row was SCALED on a measurement; F7b is residue | 1 mutant → **11 reds in 2 files** |

**F4 (`d9f47c750`) — THE BOOT ORDER, MEASURED, AND IT NAMED TWO LIVE DIVERGENCES.** One boot of
`wasm/seedling_bot_ap_p4d/game.html` on **real-GPU Windows Chrome** (`intel / gen-9`, headed, through
`seedling-watch-ship-win.py` with a probe polling at 1 ms and on every rAF, `performance.now()` at first
sight, origin = probe install just after `domcontentloaded`):

| order | property | first seen | registered with |
|---|---|---|---|
| 1 | `__swfBridge` | **0.3 ms** | already there — a CLASSIC script before the wasm glue, `game` still `{}` |
| 2 | `__runtimeReady` | **271.5 ms** | `Module.onRuntimeInitialized`, which also ENABLES ▶ Start |
| 3 | `game.wireCheck` | **2024.8 ms** | with `configure`, `readState` — BridgeGeneric's three, ONE batch |
| 4 | `game.botStatus` | **3567.1 ms** | with Bot.as's other ten — a SECOND batch, **1,542 ms** later |

⇒ they are **not** in the same tick, and the answer was not derivable from the source. Both gaps were
the PANEL's, and both are closed: `waitForShim` resolved at 0.3 ms, so the panel printed *"click ▶
Start in the game"* for 271 ms over a `disabled` button; and `_getFlash()` answered at `wireCheck`, so
for **1,542 ms** the panel called the game up while `botLoadLevels`/`botLevelSet`/`botStatus` did not
exist — the exact surface its AP-placement delivery calls. ⛔ `waitForShim` → **`waitForRuntime`**: it
no longer waits for the shim, and a method named for the earlier witness is the next reader's first
wrong idea (one caller; the timeout message now names both witnesses). ⛔ Each side KEEPS its timeouts
(lab 200 ms/180 s, panel 30 s/10 min) and `watchWasm.until` keeps its loop — F-a's four differences all
still hold.

**F2 (`bc9027f93`) — AND THE MISSING-VERB ANSWER WAS CHECKED AGAINST ITS READER BEFORE IT WAS PICKED.**
Three spellings: the lab re-read and answered `null`; `flashPanelUI.js:560` captured
`adapter._getFlash()` ONCE and indexed it (a raw TypeError for a verb the build lacks, and after an
iframe reload the PREVIOUS game's table); `readWorld` restated the rule a third time as a `try`/`catch`
per call. `git grep 'threw on chunk'` = **the source line only, no row pins it**, so `null` is free to
be the rule — and it turns a TypeError into *"botLoadLevels answered null to chunk 1/1, and the LAST
chunk of a delivery must answer \"ok\""*. ⛓ The THROW arm is NOT dead (a verb that exists and raises
inside the game still reaches it) and a row says so.

**F1 (`27663001a`) — ROUTE (a), AND ROUTE (b) WAS REFUSED ON THREE MEASUREMENTS.** `deliverChunks({bot,
chunks, set})` is the `pending`/`ok` loop plus the readback; `deliver()` calls it after its plan/refuse,
`watchWasm`'s `levels` stage calls it with the chunks it already holds. Route (b) — the lab CONSTRUCTS a
`SeedlingLevelSetDelivery` — was measured and refused: (1) `arm()`'s `apMappingInvalidation` precondition
guards the PANEL's hazard and `grep -n invalidation seedlingDemo/watch*.js` is **0 lines over 28 files**,
so the lab would have had to MANUFACTURE a companion to pass a guard that protects nothing on its side,
making the guard vacuous there; (2) `apMappingInvalidation` lives in `levelSetExporter`, which
`watchWasm` does not import (`watchViewer` does) — a new payload field for a document the lab has no
notion of; (3) the lab would plan its chunks TWICE, or `watchViewer.validatedChunks` would stop planning
— and its own docblock says that boundary is *"UPSTREAM of the sender, the only place it can be if there
is to be exactly one of it"*. ⇒ the PROTOCOL moves; the state machine, the companion rule and the
planning boundary stay. **Byte-inert, captured BEFORE the first edit:** `WASM_STAGES` and `stagesOf`
unmoved, both `refuse('levels', …)` codes unmoved (`stage: 'readback'` is what lets the lab keep
`set-readback-disagrees`, which `watchSummary.test.js` and `docs/json/developer/procgen/seedling-bot.md`
read). The `levels` stage is **49 → 25 lines (23 → 11 with comments stripped)**.

⛓ **AND THE HOIST MADE THE LAB'S HALF DRIVABLE, WHICH IS THE REAL PAYMENT.** `shipToWasm` needs an
iframe and a live game, so `watchWasm.test.js` could only ever SCAN ITS OWN SOURCE for `last ? 'ok' :
'pending'` — and a scan cannot say what a loop DOES. That row went red on the hoist, on purpose, and is
re-aimed at what a drive cannot say (the stage calls it; it refuses in its own vocabulary), keeping its
non-vacuity arm. The contract itself is now driven over an injected bot on the real rewritten set and
the real chunk planner: `seedlingLevelSetDelivery.test.js` **18 → 30**.

**F7 (`02635d3f7`) — THE ROW WAS SCALED ON A MEASUREMENT, AND THE MEASUREMENT IS RE-DERIVED IN THE
ROWS.** `mapDocumentPath.js` states `modules/flashPanel/atlases/<name>` once; `watchViewer.ATLAS_URL`,
node's `levelSource.ATLAS_PATH` and the panel's `resolveMapPath` each resolve it against their OWN base.
Byte-identical, verified by resolving both forms (node's absolute path and the lab's href are the same
before and after); `resolveMapPath` keeps its exact `{path, source}` face (a row asserts the key list)
and `AP_ASSET_PATHS.atlasDir`/`.defaultMap` are DERIVED. ⚖ All 3 presets carrying
`region_atlas.map_document` name **the default**, and the hosted lab is never handed rules
(`labProtocol.LAB_PAYLOAD_FIELDS[load]`, asserted by IMPORTING the table, not by grep) ⇒ *"the lab
honours the override when hosted"* is a `labProtocol` field for a case with **zero instances**: residue
**F7b**, ⚖ for the user, NOT built. **Two rows now assert that absence** and red the day the first
instance appears.

**⇒ AND F7 OWED A GENERATED FILE NOBODY PREDICTED (`8d2d299c5`).** `check-procgen-reference.mjs` came
back **20/1** in the derived reach: `urlGrammar.js DIFFERS — line 1037, on disk 658, the code 667`. F7
put one import and an eight-line docblock above `watchViewer.readParams`, and the generated URL grammar
records that function's LINE. One line, from `generate-procgen-reference.mjs`, never by hand; all four
markdown regions and the other five generated modules came back unchanged; `procgenDocs/` vitest 7 files
/ 452 tests green after. ⛓ **A docblock is not free when a generator reads line numbers** — the
"prose is free" family again, on a new surface.

⛓⛓ **THE F4 PROBE, VERBATIM, SO THE FOUR NUMBERS ARE RE-DERIVABLE** (the planner's note at
verification: they otherwise live only in a docblock, and a number in a docblock is unfalsifiable —
F-a's own lesson, which is why its `closure()` walk is written out above). Raw result of the run the
table reports: `webgpu_adapter "intel / gen-9"`, `finished true`, `crashed false`, `aborted false`,
waits `0.5 s` to `__runtimeReady` and `2.0 s` from the ▶ Start click to both callbacks; and the
`__registerCallback` order off the page's own console, which is the independent second witness to the
two batches:

```
t          {"__swfBridge":0.3,"__runtimeReady":271.5,"game.wireCheck":2024.8,"game.botStatus":3567.1}
atInstall  {"__swfBridge":true,"__runtimeReady":false,"game.wireCheck":false,"game.botStatus":false}
keysLog    [{"ms":2024.8,"keys":"wireCheck,configure,readState"},
            {"ms":3567.1,"keys":"wireCheck,configure,readState,botLoadTape,botStart,botStatus,
                                 botDrain,botReset,botMobiles,botRngProbe,botSeam,botLoadLevels,
                                 botLevelSet,botForgeSaveStamp"}]
console    [swfBridge] callback registered: wireCheck, configure, readState, botLoadTape, botStart,
           botStatus, botDrain, botReset, botMobiles, botRngProbe, botSeam, botLoadLevels,
           botLevelSet, botForgeSaveStamp          (14 lines, in that order)
```

⛔ `atInstall.__swfBridge` is `true`, so **0.3 ms is an UPPER BOUND** on the shim, not a measurement of
it — the probe installs after `domcontentloaded` and the shim was already there. Every other row is a
first sight the probe actually caught. The two gaps the design rests on (271.2 ms and 1,542.3 ms) are
differences between rows the probe DID catch, so the bound does not touch them.

⛓ Re-run it with the EXISTING driver — no repo file was added for this. Write the plan to
`C:\playwright\f4-boot-order-plan.json`, copy `scripts/procgen/seedling-watch-ship-win.py` beside it,
and run it the way `check-seedling-wasm-ship.mjs` runs that driver:

```js
// the probe, installed by the plan's FIRST step (a `read` whose expression is this IIFE)
(() => {
  if (window.__bootProbe) return 'already';
  const P = { t: {}, order: {}, atInstall: {}, keysLog: [], n: 0, t0: performance.now() };
  const NAMES = ['__swfBridge', '__runtimeReady', 'game.wireCheck', 'game.botStatus'];
  const sight = {
    '__swfBridge':     () => !!window.__swfBridge,
    '__runtimeReady':  () => window.__runtimeReady === true,
    'game.wireCheck':  () => typeof window.__swfBridge?.game?.wireCheck === 'function',
    'game.botStatus':  () => typeof window.__swfBridge?.game?.botStatus === 'function',
  };
  for (const k of NAMES) { P.t[k] = null; P.order[k] = null; P.atInstall[k] = sight[k](); }
  let lastKeys = '';
  const poll = () => {
    for (const k of NAMES) if (P.t[k] === null && sight[k]()) {
      P.t[k] = Math.round((performance.now() - P.t0) * 100) / 100; P.order[k] = ++P.n;
    }
    const keys = window.__swfBridge ? Object.keys(window.__swfBridge.game).join(',') : '';
    if (keys !== lastKeys) { lastKeys = keys;
      P.keysLog.push({ ms: Math.round((performance.now() - P.t0) * 100) / 100, keys }); }
  };
  poll(); setInterval(poll, 1);
  const raf = () => { poll(); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  window.__bootProbe = P; return 'installed';
})()
```

```
url    http://localhost:8000/frontend/modules/flashPanel/wasm/seedling_bot_ap_p4d/game.html
steps  1 read   <the IIFE above>                                            as probeInstall
       2 wait   window.__bootProbe.t["__runtimeReady"] !== null              sec 180
       3 read   JSON.stringify(window.__bootProbe)                           as afterRuntime
       4 click  #btn-start          ⛔ THE REAL ▶ Start — Playwright's click carries user activation,
                                       which the page's own document may never supply
       5 wait   both game.wireCheck and game.botStatus first-seen            sec 180
       6 sleep_ms 3000
       7 read   JSON.stringify(window.__bootProbe)                           as final

py.exe -3.12 C:\playwright\seedling-watch-ship-win.py --plan C:\playwright\f4-boot-order-plan.json \
                                                        --out  C:\playwright\f4-boot-order-results.json
```

⛔ Step 3 exists to prove the probe was watching BEFORE Start: it must show `game.wireCheck` and
`game.botStatus` still `null` while `__runtimeReady` already has a time. It did.

**Mutants — RUN, not reasoned.**

| # | mutant | red |
|---|---|---|
| (a) | Q2 on the EARLIER callback alone (`wireCheck`) | **3 rows, ONE IN EACH OF THREE FILES** — `wasmGamePage.test.js`, `pollUntil.test.js` (panel), `watchWasm.test.js` (lab). A side that stayed green would not be reading it |
| (b) | Q1 on the EARLIER page-side witness alone (the shim) | **5 rows in 3 files** |
| (c) | `botOver` captures the window once | 2 rows |
| (d) | the ADAPTER captures once (`flashPanelUI`'s old form, moved into the method) | 1 row — the reload row in the NEW `wasmBridgeAdapter.test.js` |
| (e) | `want = 'ok'` always — **the year-old lab bug, now in the shared function** | **17 rows** |
| (f) | drop the readback diff | 5 rows |
| (g) | misspell `ATLAS_DIR` in the ONE derivation | **11 rows in 2 files** — the derivation's own (incl. the one that OPENS the file at the resolved path, and node's `ATLAS_PATH`) and the wiring's whole construction |

**Closure walk, per commit** (`seedlingRegionBinding.test.js:609`'s `walk()`), and the bundle metafile:

| | `flashPanel/index.js` | `watchWasm.js` | metafile `inputs` |
|---|---|---|---|
| at `394294151` | 43 / 652,023 | 17 / 1,067,790 | 517 |
| after the census fix | 43 / 652,023 | — | — |
| after **F4** | **44 / 660,305** (+1 file: `wasmGamePage.js`, 6,910 B) | 18 / 1,075,656 | 518 |
| after **F2** | 44 / 663,768 (no new file) | 18 / 1,078,257 | 518 |
| after **F1** | 44 / 663,768 (UNMOVED) | 19 / 1,096,047 | 518 |
| after **F7** | 44 / 663,768 (UNMOVED) | — | 518 |

⇒ **one file added to the shipped panel bundle for the whole slice** — F4's dependency-free predicate
module, the only one of the three new/hoisted owners that the panel's static graph reaches. F7's
derivation (`mapDocumentPath.js`, 3,968 B) and F1's `deliverChunks` are behind the loader stub and cost
the bundle nothing; the lab paid for them instead (`watchViewer` 149→150 / +4,494 B, `levelSource`
2→3 / +4,464 B, the wiring 7→8 / +4,318 B), which is the FREE direction.

**Gates, all run here.**

| gate | result | command |
|---|---|---|
| the DERIVED reach (browser) | **22/23**, then **23/23** after the regeneration | `node scripts/procgen/gates.mjs reach 394294151..HEAD local` |
| `check-maze-lab.mjs` | **265/0 UNMOVED**, 88.2 s | (in the reach) |
| `check-procgen-lab-hosting.mjs` | **66/0 UNMOVED** | (in the reach) |
| `check-procgen-reference.mjs` | **20/1 → ALL CHECKS PASSED** after the generator run | (in the reach, then direct) |
| `check-seedling-editor-*` (15 arms) | all PASS, incl. `-arm` 226/0, `-generate` 224/0 + 230/0 (own server), `-world` 50/0, `-boot` 41/0 | (in the reach) |
| `check-seedling-wasm-element` / `-pages` | **11/0** (929.4 s headless) / **20/0** | (in the reach) |
| node rows | **6/6 green** — `wasm-pins` (3 builds, four views), `full-tier-owed` 5/0, `producer-boundaries` 19/0, `rerecord-rehearsal` 28/0, `procgen-help` 265/0, `slice-records` **73/0/37** | `node scripts/procgen/gates.mjs local wasm-pins full-tier-owed slice-records producer-boundaries rerecord-rehearsal procgen-help` |
| ⚠ **the four `windows` rows** | **4/4 GREEN ON REAL-GPU WINDOWS CHROME** — `wasm-ship` **263/0** (460.1 s), `generated-set` **32/0**, `save-stamp` **21/0**, `vanilla-manifest` **24/0** | `node scripts/procgen/gates.mjs local wasm-ship generated-set save-stamp vanilla-manifest` |
| ⚠ **`check-seedling-ap-placement.mjs --win`** | **ALL ROWS PASSED** on real-GPU Windows Chrome | `python3 -m http.server 8129` **then** `node … --win` |
| identity rows | **ALL CHECKS PASSED — 16 rows UNMOVED** | `standing-values.mjs --check --only=identity` |
| bounded ⚖ 52 | **29 files / 1,144 tests** (baseline before the slice: 19 / 397 over the brief's paths) | see below |
| in-app `--batch=fast` | **61/61**, *No differences in status, roster, or duration* | `compare-runs.js …T20-07-18 …T22-07-14` (the baseline NAMED — F-a's post-slice run at `394294151`) |

⛓ **THE `--win` ARM IS THE STRONGEST SINGLE ROW FOR ALL THREE CODE FINDINGS**, because it is the only
one that boots the REAL PANEL: `boot 19.19s, status=ready` through the changed `waitForRuntime` (Q1) and
`_getFlash` (Q2); *"[ap placement] **116 randomized room(s) mounted in 9 chunk(s)**; 39 location(s)
replaced; started at level 0 (new-game-arm)"* — the NINE-chunk delivery through the hoisted
`deliverChunks`, on the real game; and the whole load — teleport, the polled reset ceremony, the
location check, *"found Light for you at Level 030 - Torchpickup"* — carried by `adapter.bot`, F2's
method. `check-seedling-wasm-ship` 263/0 and `generated-set` 32/0 are the same three changes on the
LAB's side of the same page.

⛓ The bounded set was WIDENED past the brief's four paths by every file this slice touches and every
test file that reaches one: `npx vitest run frontend/modules/flashPanel/
frontend/modules/seedlingDemo/{watchWasm,watchSummary,atlasSource,levelSetDisagreement,watchLifetime,
gameClock,director,levelWorld,tapeRunner}.test.js scripts/procgen/reachClosure.test.js` (`levelSource.js`
has no test file of its own — `mapDocumentPath.test.js` now asserts its `ATLAS_PATH`; `watchViewer.js`
has none either and is covered by the browser gates plus a source row).

**Rows written:** `wasmGamePage.test.js` NEW (27), `wasmBridgeAdapter.test.js` NEW (11 — the adapter had
NO test file of its own before this slice, only the wait rows F-a put in `pollUntil.test.js`),
`mapDocumentPath.test.js` NEW (12), `seedlingLevelSetDelivery.test.js` 18→30, `pollUntil.test.js` 17→19,
`watchWasm.test.js` 70→75, `seedlingAtlasAnalysis.test.js` 9→10.

**No re-bank.** No CI-sourced row moved; `gate: maze-lab` stays 265/0.

**What this slice overturned in the brief.**
- **§17.1 F4's central unknown resolved the way the brief hoped, but the SIZE is the finding.** The
  order was not knowable from source and the two callbacks are **1,542 ms and two registration batches**
  apart — not a same-tick coin flip. The panel had a real one-and-a-half-second window in which
  `_getFlash()` handed out a game with no `botLoadLevels` on it.
- **The brief's F1 says `set-readback-disagrees` is read by `watchWasm.test.js`, `watchSummary.test.js`
  and the doc. It is TWO, not three:** `grep -c` in `watchWasm.test.js` = **0** (`git grep -ln` reaches
  `watchSummary.test.js`, `watchWasm.js` and `seedling-bot.md`). The code was preserved anyway; the
  count-in-prose family again, and this time in the brief.
- **F2's "which rows pin `threw on chunk`" answered NONE.** No test anywhere pins the throw wording, so
  the null-returning rule was free — and it improves the message rather than degrading it.
- **F1's route (b) is worse than the brief's two-line sketch suggested**: not only the double-planning,
  but a PRECONDITION that would have had to be satisfied with a manufactured document. A guard passed by
  manufacturing its own input is not a guard.
- **A docblock moved a GENERATED line number.** `check-procgen-reference` reds on a nine-line insertion
  above a function it cites — a gate nothing in the brief predicted F-b would reach.
- **`gates.mjs --json` without `--list` RUNS the gates** (the `--help`-runs-the-instrument family, trap
  864's neighbour). Caught in ~3 min, stopped by PID — and killing the wrapper LEFT ITS CHILD
  (`check-procgen-demos.mjs` + its chromium tree) alive, exactly as CLAUDE.md warns; both killed by
  captured PID, box lock verified free afterwards.

**Residue for the user.**
- **F7b** — the hosted lab honouring `region_atlas.map_document`. Zero instances and no channel today;
  it is a `labProtocol` field, ⚖.
- ⛔ **F-c / F-d remain ⚖ open** and were not touched.

**NEXT: F-c/F-d are ⚖ for the user.** F-b was the last pre-authorized rung of the F ladder.

**⇒ F-b VERIFIED BY THE PLANNER — THE PRE-AUTHORIZED LADDER IS EXHAUSTED; STOP (2026-09-02, `maze-lab-planning-2`).**
Main `b35d25a03` re-checked from disk: the seven commits on `origin/main`; the owners at their lines
(`wasmGamePage.js` `runtimeUp:132`/`gameUp:143`/`callBot:185`/`botOver:198`; `seedlingLevelSetDelivery.deliverChunks:133`
called from `watchWasm.js:1247` and `deliver():295`; `mapDocumentPath.js:67` imported by `levelSource.js:36`, the
wiring `:82` and `watchViewer`; `WasmBridgeAdapter.bot():145`, `waitForRuntime():107` with `flashPanelUI.js:451` its one
caller; the `map_ref` census docblock corrected at `seedlingAtlasAnalysis.js:48-54`); F-a's `closure()` at HEAD
**44 / 663,768** with the ONE added file `wasmGamePage.js` (a diff of the file lists) and `grep -c seedlingDemo` = 0;
`standing-values.json` no diff over the range; F-b's own logs read as its as-built says (reach 22/23 → 23/23 after
the generator, `check-maze-lab` 265/0 ×2, the four `windows` rows 4/4, node rows 6/6); `compare-runs.js …T20-07-18
…T22-07-14` re-run here = 61/61, no differences; bounded vitest here 29 files / 919 green; digest `677b7d9c…`
unmoved; `check-slice-records` 73/0/37; **`check-maze-lab.mjs` LIVE here at `b35d25a03` = PASS 265 / FAIL 0**.
**Recorded (plan §38):** the KICKOFF's own count was wrong — `set-readback-disagrees` has two readers, not three
(`git grep -c` in `watchWasm.test.js` = 0; the planner had read a five-string alternation's file list as one
string's) · F4's order was answered by MEASUREMENT and the size is the finding (two registration batches 1,542 ms
apart; the panel's `_getFlash` used to answer at the first) — ⚠ the raw probe printout is not in a kept log, the
docblock is the record · route (b) for F1 refused on a third measurement (a guard passed by manufacturing its
input) · a docblock above a function the procgen REFERENCE cites moved a generated line — kickoffs that touch such a
file owe `generate-procgen-reference.mjs` · `gates.mjs --json` without `--list` RUNS the gates. **The ladder**: Q-a ·
Q-b · S2a · S0+S1 · S2b · R-b · D1+D2+D5 · D3+D4 · F-a · F-b — all shipped and verified; `gate: maze-lab` 265/0
unmoved through six slices. **⚖ FOR THE USER, nothing launched:** F-c (F10 — the `shared` submodule ⇒ gitlink), F-d
(F8 — a gate on `watchWasm.WASM_PAGE` vs `builds.json` capabilities), residues D6 (`editBaseTag` omits `roster`), D7
(`hasOwnProperty` vs `in`), F7b (the hosted lab honouring `map_document` — zero instances, no channel), optional
S4/S5/S6; the cross-substrate queue VIEWER is its own planning arc (§23/§26/§28).

**⇒ F-d AS BUILT — the lab's build literal is a GATED fixed point; row (h) in `check-seedling-wasm-pins.mjs`
(2026-09-02, `maze-lab-arms-sliceFd`, main `3770314bf` + `b8ef249b2`).**
W0 `086391b53`, tree clean; the gate `ALL PASS — 3 pinned builds, four views in agreement` before and after.
Census, derived not typed: `git grep -l seedling_bot_ap_p4d -- ':!frontend/modules/flashPanel/wasm' | wc -l`
= **63** tracked files name the lab's build outside the submodule (the plan's 56 was an older head), and they
agree only because EDITOR INTEGRATION P2 hand-edited them in one pass.

**(h1) the literal names a manifest build.** Parsed off the tracked file with the gate's OWN `SPELLINGS[0]`
(reused, not restated — `scannable()`'s lesson), so the row also asserts the literal is still written in the
one spelling the REFERENCED view can SEE, which is the entire reason it is a literal (trap 411). Then MANIFEST
membership and the JOIN to `<name>/game.html` on disk. ⛔ Not the bytes — views (b)/(c) own those.

**(h2) the lab's build is the build its certifiers drive — subject set DERIVED, with one named addition.**
Derived: every gate (`isGateFile`, IMPORTED from `gateRoster.js`, never a second copy of `check-*.mjs`) whose
CODE spells a MANIFEST build name, bounded to the manifest's own names so the sweep cannot invent a build the
way a general `'seedling_*'` would. Named: `check-seedling-bot-differential.mjs` — a `verify-`, invisible to
the membership rule, and the one instrument that drives the lab's build tick-for-tick against the JS model.
**Result at this head: FIVE certifiers**, not the two the kickoff named —
`check-seedling-wasm-pages.mjs` (its `BUILD` literal) plus the three `windows` gates that spell their own
`SEEDLING_PAGE` default (`check-seedling-{generated-set,save-stamp,vanilla-manifest}.mjs`), plus the named
differential. The commands: `node scripts/procgen/gates.mjs --list` = **33 gates**; over those, comments
stripped and bounded to the manifest, **4 of 33** spell a build (the pins gate is excluded from its own sweep
for the reason the REFERENCED view excludes it).
⛔ **Excluded, and why**: `git grep -ln 'watch\.html' -- scripts/` = **40 files at W0** boot or name the lab
page; exactly **3** of them spell a build name at all, and `check-seedling-wasm-ship.mjs`'s single occurrence
(`:1573`) is a sentence in a docblock — the kickoff's measurement REPRODUCED. Ship, `check-seedling-wasm-element.mjs`
and the seventeen `check-seedling-editor-*.mjs` go THROUGH `WASM_PAGE` and therefore cannot disagree with it;
asserting that they agree would be the fixed point the row exists to avoid. The panel's preset default
(`regionAtlasCompiler.js:169`) is excluded from the other side: the panel is DATA-driven and capability-gated
at run time by `seedlingRandomizerEligibility.js`, so its wiring default is a preset's datum, not a claim
about the lab. ⛔ `SEEDLING_PAGE=` at run time is an override; the DEFAULT is the pin (row (f)'s rule).
⛓ **`codeOnly` is LOAD-BEARING, measured**: the mutant that stops stripping comments turns THREE files'
historical prose into false subjects (`check-seedling-generated-set.mjs`, `check-seedling-wasm-ship.mjs`,
`check-seedling-bot-differential.mjs` all "drive" p4c in a docblock).

**(h3) the capabilities the lab's build must declare — MEASURED, and the answer is NONE.** `WASM_PAGE` pointed
at the manifest build declaring `[]` (p4b) and `check-seedling-wasm-pages.mjs --root=http://localhost:8000/frontend`
run once, against a control run of the same gate on the current build (box lock announced; ~3.5 min each):
**control 20 PASS / 0 FAIL · arm 19 PASS / 1 FAIL**, row labels otherwise identical. The ONE row that moved is
`watch.html pointed its iframe at the game page` — the pages gate comparing the iframe src against its own
`BUILD` literal, i.e. (h2)'s disagreement seen through a browser and phrased as *the page pointed somewhere
else*. Every capability-bearing row — the three ▶ ship arms (SOLVE/GENERATE/MANUAL), the drain, the per-tick
wasm verdict — stayed GREEN on a build declaring nothing. ⇒ **(h3) asserts nothing and prints what it
measured.** ⚠ Also seen: the arm's row 2 (`seedling_bot_ap_p4d.wasm is served`) stayed green while the page
loaded p4b — the gate HEAD-probes its own build, so only one of its twenty rows can see the split at all. The
literal was restored immediately and `git status --porcelain` was empty before anything else ran.

**Mutants — run, not reasoned (trap 1072), copy/restore, all six reds verified from the gate's output:**
(i) `WASM_PAGE` → a non-manifest build ⇒ **4 problems**: view (a) three ways (absent from WHITELIST/TRACKED/MANIFEST)
AND (h1) — (h1) is the one that names the LAB; (ii) `check-seedling-wasm-pages.mjs`'s `BUILD` → another manifest
build ⇒ (h2) reds naming BOTH files; (iii) the named certifier's `SEEDLING_PAGE` default → another build ⇒ (h2)
reds; (iv) that default made non-literal ⇒ (h2) reds as *a pin that stopped existing rather than a subject that
agrees*; (v) `WASM_PAGE` composed from a variable ⇒ **(h1) reds while view (a) stays GREEN** (62 other files
still name the build) — the hole this row fills, shown rather than argued; (vi) `codeOnly` removed from (h2)
⇒ 3 false subjects. ⚠ **A fixture defect, recorded**: (iii)'s first form was a `sed` whose `|` delimiter
collided with `||` in the pattern; it never applied and the gate printed ALL PASS. A green mutant is a fixture
question first — rebuilt in python, it reds. ⛔ (h3) has no mutant BY CONSTRUCTION: it asserts nothing.

**The standing row.** `--check --only='seedling-wasm-pins'` before = `PASS 0/0` (cheap rows re-run regardless,
so `--check` does not report a key move). MEASURED with `rowInputKey.inputPopulations` instead: at W0
`inputKey c6522201…`, populations code 7 / data 2 / spawn 0 / build 1 — and **neither `check-seedling-wasm-pages.mjs`
nor `check-seedling-bot-differential.mjs` was in ANY population**, so the exact edit (h2) exists to catch
would not have re-run the row. Cause: a `.mjs` named by a literal is population 1's business and arrives only
by being IMPORTED, and (h2) READS those sources. ⇒ the gate now DECLARES them, `@key-inputs data:` (the
mechanism `rowInputKey.js` names for exactly this), `data` not `code` because the BYTES are the input and
their closures are not. After: `inputKey 07f1e348…`, code 165 / data 231 / spawn 234 / build 3 — the +34 in
`data` is the 33 gates plus the differential; the rest is `gateRoster.js`'s closure and its `'scripts/procgen'`
directory literal. `standing-values.json` stays OUT of the key (`DERIVED_DATA_EXCLUDED`) — the bank does not
cover itself. ⛔ Banked in its OWN commit rather than folded into the gate edit: `measuredAt`/`keyAt` name the
head the row was measured at, and an amend would leave both pointing at a SHA that never lands (the previous
value, `95603e266`, is a real main commit — the convention).

**Gates, derived.** `reach-seedling-change.mjs --files=scripts/procgen/check-seedling-wasm-pins.mjs` names
**1 node gate — this one — and 0 tests, 0 pages, 0 producers, 0 identity rows**; the kickoff expected
`slice-records` too and the reach does not name it. Run anyway: `check-slice-records.mjs` **73 VERIFIED / 0 /
37 UNVERIFIABLE — UNMOVED**. `check-maze-lab.mjs` is NOT reached (nothing under `mazeRoom/` or the lab page
moves) — said rather than run. `--self-test` **9 seen / 4 not seen, ALL PASS**. `watchWasm.js` was NOT edited
(the (h3) flip was reverted), so `check-procgen-reference` is not owed. ⛔ `gates.mjs reach <range> local
--list` prints the WHOLE roster — the range is ignored in `--list` mode; the reach selector itself is
`reach-seedling-change.mjs`.

**⚠ MAIN IS RED AT W0, AND IT IS NOT F-d's.** Bounded vitest (`scripts/procgen/` +
`seedlingRandomizerEligibility.test.js`) = **31 files, 608 passed / 1 FAILED**. The failure is
`lintGateLabels.test.js` → *"a NEW label or test name carries a count its own check computes"* on
`frontend/modules/flashPanel/seedlingAtlasAnalysis.test.js:40` (`MAP_DOC → toHaveLength(116)`). Reproduced with
F-d's change STASHED: identical at `086391b53`. And `ci-vitest-summary.mjs 086391b53` reads **run 33689965891
FAILURE — 12,996 passed | 8 skipped | 1 failed**, i.e. F-b's arc left main red and its as-built says green.
⛔ NOT fixed here: the two remedies the lint itself offers (interpolate the derived value, or `--write-allow`
saying the number is an input the row chose) are a claim about a row this slice does not own, and memory's
`feedback_count_in_a_test_name_is_an_allowlist_key` says moving a count reds CI twice. It goes back to the
planner named. ⚠ `standing-values --write` also printed that the last CI shard partition did not hold (run
33662632579 @`8a1eb6b1a`, 605.9 s > 600 s budget, trap 1068) — pre-existing, not this slice's.

**What F-d overturned in its brief:** the (h2) subject set is **five**, not the two the kickoff named — three
`windows` gates spell their own `SEEDLING_PAGE` default too, and a derived sweep finds them where a typed pair
would not · the kickoff said to read the tracked BLOB with `git show HEAD:<path>`; rows (f) and (g) do NOT —
they take tracked MEMBERSHIP from git and the CONTENT from the working tree, so the gate answers about the tree
you are about to commit, and (h) copies its siblings · the reach names `wasm-pins` only, not `slice-records` ·
`check-seedling-wasm-ship.mjs`'s "no build of its own" was reproduced, and `codeOnly` is what makes it true ·
the kickoff's key advice ("its `inputKey` almost certainly covers the gate's own source, so your edit MOVES the
key") was right about the move and wrong about the coverage that matters: the key did NOT cover the row's
subjects and had to be declared.

**Still ⚖ for the user after F-d:** **F-c** (F10, the host transport handshake — and §39 already measured that
its premise is false: `iframeAdapterCore.js` and `labRoomEditor.js` are both OUTER-repo files, so there is NO
gitlink bump), residues **D6**/**D7** (maze-side), **F7b**, optional **S4/S5/S6**, and now the
`lintGateLabels` red above.

**⇒ F-d VERIFIED BY THE PLANNER; F-c LAUNCHED (2026-09-02, `maze-lab-planning-2`; ⚖ user 2026-09-02: F-d then F-c
approved, residues ride along).** Main `bb2b858e8` re-checked from disk: gate `3770314bf` / bank `b8ef249b2` /
as-built on `origin/main`; row (h) prints *"WASM_PAGE → seedling_bot_ap_p4d … certified by 5 gate(s)"* plus the (h3)
measurement line; `check-seedling-wasm-pins.mjs` ALL PASS and `--self-test` 9/4; the standing row's `inputKey`
`c6522201… → 07f1e348…` (data 197 → 231) with `measuredAt = 3770314bf` ON main; `check-slice-records` 73/0/37;
digest unmoved; bounded vitest 30 files green + ONE red. **Recorded (plan §40):** the (h2) subject set is FIVE and is
now DERIVED (the kickoff typed two — a census in prose, again) · rows read the working tree, not the HEAD blob ·
`--check` cannot see key COVERAGE (compute `rowInputKey.inputPopulations`) · the bank is its own commit · `gates.mjs
reach … --list` ignores the range · (h3) = NONE, measured on the `[]` build at 19/20 with the one red being (h2)
through a browser. **⚠ MAIN IS RED AT W0 AND IT IS F-b's**: `lintGateLabels.test.js` reds on
`seedlingAtlasAnalysis.test.js:40`'s typed `toHaveLength(116)` (CI 33689965891 @ `086391b53`, 1 failed);
F-b's bounded set omitted `scripts/procgen/`, so its "green" never asked the lint. Cure = a non-vacuity arm, no
allowlist write — **Task 0 of F-c**, its own commit; every slice adding a test row now owes that lint test.
**F-c launched** (`NewDocs/plans/maze-lab-arms-sliceFc-prompt.md`, `maze-lab-arms-sliceFc`) — ⚠ **NO GITLINK**:
§17.1 F10's premise is false at this head (`iframeAdapter/iframeAdapterCore.js` and
`procgenLabPanel/labRoomEditor.js` are OUTER-repo; `shared/` mentions neither); the user's approval of a bump is
unconsumed. The finding survives: the page transport's docblock claims a subscription record its handler lacks.
Design: a pure `handshakeStep` in `iframeAdapter/`, both hosts apply its effects, closures priced per commit
(the lab page must not gain `gameState`), BOTH in-app batches owed (every iframe substrate boots through it).

**⇒ F-c AS BUILT (2026-09-02, `maze-lab-arms-sliceFc`, Opus; main `5cd4f3803` + `2956ca5cf` + `a39b71699` +
`df2c0cbf8`, pushed).** Row F10 shipped in four commits, one per finding, and ⚠ **it consumed no gitlink** —
§39's measurement held at the line: both hosts are outer-repo files, `shared/` was READ and never written.

**Task 0 — main was RED at W0 and is green now.** `seedlingAtlasAnalysis.test.js:40`'s
`toHaveLength(116)` → `expect(MAP_DOC.levels.length).toBeGreaterThan(0)`, the row's real claim being the next
line. No `--write-allow`. Proof: the two files green (24 rows); `lint-gate-labels.mjs` diffed W0 vs after =
**86 → 85 findings**, the diff being exactly this finding's three lines, no NEW one. CI **33694270389** at
`5cd4f3803`: **12,997 passed / 8 skipped / 0 failed** (W0's run 33689965891 had 1 failed).

**The reducer.** `iframeAdapter/iframeHandshake.js` — `handshakeStep(state, message, {capabilities, now}) →
{handled, state, replies, effects}`, importing `shared/communicationProtocol.js` and nothing else. Rules:
READY → register + `ADAPTER_READY {capabilities}`; APP_READY → `appReady` flip + an `appReady` effect (no
reply); HEARTBEAT → `HEARTBEAT_RESPONSE {timestamp}` + the `lastHeartbeat` stamp; SUBSCRIBE_EVENT_BUS →
recorded, or a `refuse` effect when unregistered. Every rule but READY is conditioned on registration (the
app's own `iframes.has` rule, now the page's too). `handled:false` for anything else, so each host's own
chain still runs. The state is never mutated — the Set is copied.

**The three decisions, each MEASURED before it was made:**
1. **The page transport does NOT need a subscription record, and the docblock was wrong about BOTH hosts.**
   `procgenCore/labBridge.js` subscribes ×3 (`:112-124`) before `notifyAppReady()` (`:174`) — the order its
   own docblock `:17-19` states as the contract — and APP_READY is the flush point, so nothing can arrive
   early enough to re-send. And no host has ever re-sent on a subscription: the app's record is **ROUTING**
   (`handleEventBusEvent` picks which frames an app-bus event reaches). The record therefore lives in the
   reducer because the APP routes on it; the docblock is corrected to say that. ⚑ Mutant (d) is the proof
   the record is load-bearing on the app side and not on the page's.
2. **`capabilities` IS a host parameter and NOTHING keys on it.** `shared/adapterClient.js` names it only at
   `:131`/`:154`, both its OWN outbound `IFRAME_READY`; `handleAdapterReady:251` reads `loggingConfig` and
   resolves `connect()` on the message ARRIVING. So the app keeps four (`IframeAdapterCore.CAPABILITIES`),
   the lab page keeps one (`PAGE_CAPABILITIES`), both honest, and each is held by a ROW because the child
   cannot hold it. ⚑ **This overturns the kickoff's mutant (a)** — see below.
3. **The heartbeat body is read by nobody** — `adapterClient.js:226-228` is
   `case MessageTypes.HEARTBEAT_RESPONSE: // Heartbeat acknowledged` with the body untouched; three
   producers, zero consumers. ⇒ ONE shape, `{timestamp}` (the app's and `windowAdapterCore.js:313`'s, 2 of
   the 3 producers already). The page transport's `{}` → `{timestamp}` is the slice's ONLY wire change.
   ⚠ The STAMP, not the reply, is the load-bearing half: `checkHeartbeats` drops a 60 s-stale frame.

**Byte-inert capture (taken BEFORE the first edit).** A node drive of each host over the child's real send
order — IFRAME_READY, SUBSCRIBE_EVENT_BUS ×3, IFRAME_APP_READY, HEARTBEAT — recording replies, target
origins, app-bus publishes, `appReady`, the stamp, both subscription sets and the unregistered
`CONNECTION_ERROR`, timestamps normalised. **W0 → after commit 2: identical. → after commit 3 (the app
host): identical. → after commit 4: ONE difference, the three lines of `{timestamp}` decision 3 names.**

**Closures per commit** (F-a's `closure()` walk): `labRoomEditor.js` 4 files / 52,696 B → 4 / 52,696 →
4 / 52,696 → **5 / 64,904**; `iframeAdapterCore.js` 5 / 85,682 → 5 / 85,682 → **6 / 98,332** → 6 / 98,332.
Each gains exactly `iframeHandshake.js` (own closure 2 files / 14,922 B). ⛔ The lab page still has no
`gameState`, the app no lab file — and that is a ROW now (`labRoomEditor.test.js`), with the non-vacuity arm
that `iframeAdapterCore`'s closure DOES carry `gameState/singleton.js`.

**Gates, derived not typed.** `reach-seedling-change.mjs --files=<the 7 changed>` (the selector — `gates.mjs
reach … --list` ignores the range, F-d's lesson) names **4 gates, 0 windows rows**, so no `--win` was owed.
`node scripts/procgen/gates.mjs reach bb2b858e8..HEAD local` ran all four: **`check-maze-lab` 265/0 (UNMOVED
through seven slices)** · `check-procgen-demos` 261/0 · **`check-procgen-lab-hosting` 66/0** ·
`check-procgen-reference` 21/0 — ⚑ the reference stayed green with no generator run, so this slice's
docblocks moved no cited line (§38's hazard did not fire). `check-slice-records` **73/0/37 UNMOVED**.
Bounded vitest over the reach's 7 tests + `lintGateLabels` + `iframeAdapter/`: **8 files / 132 green**.

**Mutants — run, never reasoned** (all four in the one file the rules now live in, copy/restore, tree
verified clean after):
- **(a) as the kickoff wrote it is an EQUIVALENT MUTANT.** Answering READY with `capabilities: []` reds
  exactly the 2 rows that assert the lists — and `check-procgen-lab-hosting` is **66/0 GREEN**. The child's
  `connect()` does not read the list, so no browser row can. Replaced by **(a1) drop the ADAPTER_READY reply
  entirely**: 4 vitest rows red AND the gate **5/1** — *"STUCK waiting for both frames to publish
  procgenLab:ready"*.
- **(b) drop the APP_READY flip**: 4 vitest rows red; `check-procgen-lab-hosting` **64/2** (CLAIM 1,
  `iframe:appReady` reached the host bus, for BOTH panels) AND `check-maze-lab` **240/1** (*"STUCK waiting
  for the SEEDLING room to open in the hosted watch.html frame"*). Both hosts, as designed.
- **(c) HEARTBEAT unanswered**: exactly 2 rows red, one per host, and `check-procgen-lab-hosting` **66/0
  GREEN** — the measured confirmation that nothing else depends on the response. Those two rows ARE the pin.
- **(d) drop the subscription record**: 2 reducer rows red AND `check-procgen-lab-hosting` **11/1**
  (*"STUCK waiting for the maze frame to show a LOADED level"*) — the app's routing, exactly as decision 1
  says. No green mutant.

**In-app, both batches** (they take the box; announced): `test-substrates --batch=fast` **61/61**,
`compare-runs.js test-results-2026-09-02T22-07-14.json test-results-2026-09-02T23-50-18.json` → *"No
differences in status, roster, or duration"*. `--batch=bot-walks` **3/3** (crosses-region 85.6 s,
multi-reset-walk 291.2 s, instant 6.8 s) — ⚠ there is NO prior bot-walks run in the 30-run retention window,
so it has no named baseline; the comparer says so itself (it fell back to the `fast` run and WARNED).

**⚑ THE KICKOFF'S "asserted through the in-app runner" IS FALSE — the four Iframe Base rows run in NO
mode.** `iframe-baseTests.js`'s ids are named by exactly one config, `playwright_tests_config-custom.json`
(mode `test-custom`), and all four are `enabled: false` there — including `test_iframe_base_heartbeat`.
Measured by running it: `npm test -- --mode=test-custom` ran **2 tests**, both `test_meta_game_*`, and both
FAILED — **pre-existing**, proven with a W0 control (`git checkout bb2b858e8 --` the two host files, re-run:
the same two tests, the same conditions, 49.6 s / 18.1 s). ⇒ the app adapter's handshake is covered today by
`check-procgen-lab-hosting` (which mutants a1/b/d all redden), the substrate wrappers in the `fast` batch,
and the new vitest rows — not by those four. **Residue: four dormant in-app rows nobody runs**; enabling
them is a decision of its own and was not taken here.

**Rows added**: `iframeAdapter/iframeHandshake.test.js` (11 — the four rules, the unregistered refusal,
HEARTBEAT's order-independence, purity, `handled:false`, plus two that READ the child for decisions 2 and 3);
3 in `labRoomEditor.test.js` (the closure walk, the capability + beat shapes, the pre-READY silence); the
import-specifier pin at `:362` updated. `iframeAdapter/` had NO `.test.js` before this slice.
⚑ **The lint fired on this slice's own new test NAME** ("outside its four" — a count over a roster the check
derives); renamed, not allowlisted. The standing rule F-d left works.

**After F-c: STOP.** Nothing beyond it is authorized. Open: residues **D6**/**D7** (maze-side, ride the next
maze slice), **F7b**, the four dormant Iframe Base rows, optional **S4/S5/S6**, and the cross-substrate queue
VIEWER as its own planning arc.

**⇒ F-c VERIFIED BY THE PLANNER — ⛓ THE MAZE LAB ARMS ARC IS CLOSED (2026-09-03, `maze-lab-planning-2`).** Main
`904faab69` re-checked from disk: the five commits on `origin/main`; `iframeAdapter/iframeHandshake.js`
(`newHandshakeState:79`, `HANDSHAKE_MESSAGES:89`, `handshakeStep:121`; imports only `shared/communicationProtocol.js`)
applied by both hosts (`iframeAdapterCore.js:9`, `labRoomEditor.js:64`); closures re-derived — `labRoomEditor.js`
4 → 5 files / 64,904 B, `iframeAdapterCore.js` 5 → 6 / 98,332, the helper 2 / 14,922, the lab page still without
`gameState`; Task 0 on disk and the lint green; bounded vitest 5 files / 85 green; **CI at the Task 0 head
`5cd4f3803` = run 33694270389, 12,997 passed / 0 failed — main is GREEN again**; CI at the code head `df2c0cbf8`
(run 33697707046) concluded after verification: **13,011 passed / 8 skipped / 0 failed, slow battery 217/0**; in-app `fast` 61/61 vs the named
`…T22-07-14`, no differences; `bot-walks` 3/3 with NO prior baseline in the window (first baseline `…T23-57-18`);
LIVE here at `904faab69`: `check-procgen-lab-hosting` **66/0**, `check-maze-lab` **265/0**; `check-slice-records`
73/0/37; digest unmoved; NO gitlink consumed. **Recorded (plan §41):** mutant (a) was EQUIVALENT — `capabilities`
on ADAPTER_READY is a wire field the child never reads, pinned by a row, not by behaviour · **four Iframe Base
in-app rows run in NO MODE** (`playwright_tests_config-custom.json`, all `enabled: false`; that mode's two live
rows are `test_meta_game_*`, pre-existing RED at a W0 control) — a NEW residue · no host ever re-sent on a
subscription (the app's record is routing; the page never needed one) · ONE heartbeat shape, the slice's only wire
change · the lint fired on F-c's own new test name and was cured by renaming. **The arc:** Q-a · Q-b · S2a · S0+S1
· S2b · R-b · D1+D2+D5 · D3+D4 · F-a · F-b · F-d · F-c — twelve slices shipped and verified, `gate: maze-lab`
265/0 unmoved since R-b, both of the user's named asks closed at D3+D4. **⚖ OPEN, nothing launched:** D6, D7,
F7b, the four dormant Iframe Base rows, optional S4/S5/S6, the CI shard partition (trap 1068). **NEXT ARC** = the
cross-substrate queue VIEWER, its own planning session per the user's approval of 2026-09-02
(`NewDocs/plans/queue-viewer-planning-prompt.md`, session `queue-viewer-planning`).

## 5m. The CROSS-SUBSTRATE QUEUE VIEWER / EDITOR — PLANNED 2026-09-02 (Fable planning session `queue-viewer-planning` at main `a69a9b295`; plan file `NewDocs/plans/queue-viewer-plan.md`, gitignored; memory `project_queue_viewer`; successor to §5l)

**The ask (user, 2026-09-02, recorded in §5l Part V):** *"I was planning to eventually implement a
cross-substrate queue editor, or at least a cross-substrate queue viewer."* The maze arc did the format
work first (Q-a/Q-b: every fine-grained recording is `actionQueue/1`, `substrate` per entry,
`describeAction` on maze/jta/omsi). This entry plans the viewer. Everything measured at `87a5f6515`
(→ `a69a9b295`, docs only); every count names its command in the plan's §12.

**Verdict (plan §0).** (1) The read side has ONE blocking gap: `savedQueueStore` cannot ENUMERATE — 8
exports (`grep -c '^export function'`), every reader supplies `(rulesHash, region, substrate)` up front;
no delete-one either (`clearForRegion` drops a bucket). (2) **Vocabulary convergence is not a rung of
this arc**: gameState's path vocabulary is read by 29 non-test files (a BOUND — 11 are registry
`queueActions` declarations), `loopState.js` alone holds 74 grep-lines of the five type strings; what
§26 of the maze plan actually promised this arc is the SEAM — `coarseOf`'s second branch, 8
`_liveCaptureBuffer` sites in one file. (3) The ENTRY already says enough (`substrate` stamped by all
three producers; `describeAction` `fn|fn|fn` in the registry matrix); the gaps are on the ENVELOPE —
enumerate, delete-one, "which block is this bound to" (derivable from `blockIdentity`), and an edit
must PRESERVE `recordedAt` or every `customQueue` reference to it silently misses. (4) The live-queue
affordance ("drop the pending tail, keep the history") has THREE homes — the maze panel's `ActionQueue`
(panel-side `_clearPendingEntries`/`_appendEntries`), jta's `engine.queue` on a frozen
`ExecutionSnapshot`, omsi's plan INSIDE the fork's iframe — so v1 edits RECORDINGS; the shared class
gains `replacePending` only when a second live consumer exists (V5, submodule ⇒ gitlink asked). (5) A
new panel module `queueViewer` in the default layout beside the loops panel, with a "view" link from
each block's `●`; NOT inside the loops panel (2,577 lines; it renders the other vocabulary). (6) No
reader anywhere renders a jta or omsi recording's entries today; the only cross-substrate "view" is
the Custom-queue dropdown's `name — Δmana` line (`loopBlockBuilder.js:702`).

**The three vocabularies, measured (plan §3):** (i) gameState PATH `{type:'regionMove'|'locationCheck'|
'customAction'|'manual'|'customQueue', …}` (`state.js:21-23`, 40 methods); (iii) `shared/actionQueue`
(14 non-test consumers); they meet at `loopState.coarseOf` (2 callers), `_applyCoarseReplacement`,
the capture buffer, and `_persistSummaryForBlock:1744` (reads `a.type` off the buffer). Three shapes
priced: **A FULL** (gameState stores actionQueue entries — weeks, its own arc, every block-mode in-app
row a gate; §3.3 names the first two rungs if wanted) · **B PROJECTION** (a read-only adapter — a
second, poorer renderer of what the loops panel shows; rejected) · **C SEAM** (the buffer speaks
actionQueue, `coarseOf` one branch — one Opus slice, the promise kept). Recommend C now, A as a
direction with its price on the record.

**Design (plan §6):** module `frontend/modules/queueViewer/` (`index.js`, `queueViewerPanel.js` on the
Golden Layout contract, DOM-free `queueViewerLibrary.js` + test, css); registrations `modules.json`
(loadPriority 73 → 74), `layout_presets.json` `default`, `moduleMetadata.js`, `init-bundled.js`,
`settings.json`. Reads `listSavedQueues(rulesHash)` (V0) with `rulesHash` from a new public
`loops.getRulesHash()` (today the block builder reads `loopState._cachedRulesData` directly); a store
`subscribe`; re-render on `loopState:queueUpdated`. Row model `{substrate, region, tag, name,
recordedAt, departure, kind:'script'|'annotations'|'summary', preconditions, mana, rows:[{text, loops,
disabled, refused, fallback}]}` with `text = describeAction → label → "actionType actionId"` and
`fallback` said out loud (jta's name table is session-local — a stored jta recording from an earlier
session names only ids the capture has seen since; a jta concern, named, not the viewer's). Edits (V2)
on a WORKING COPY in an `ActionQueue` (`deserialize({entries})` gives reorder/undo — the AUTHORING role
its docblock names); Save = `saveQueue` with `recordedAt` and `name` preserved → `'saved'`
(replace-on-tag) / `'duplicate'` / `'invalid'` by field name. ⛔ The TAG is not editable — loops derives
it from the block structure. Validation is SHAPE in the editor, SEMANTICS at replay by name (R2/R3/R4)
— a `checkRecording(envelope)` registry slot is a later rung.

**⚖ FOR THE USER (plan §8) — asked with LIVE LINKS** (`feedback_scenario_image_with_rulings`; all four
loaded headless here with 0 page errors: L1 `manualHidden:false, source:"manual"`, L2 loops + maze
panels present, L3 the `JTA Action Queue` tab present (33 console errors from the fork's own boot —
"Couldn't find skill" + one 404 — observed, not attributed), L4 empty store → sample renders 5
recordings, maze rows `move E` / `move N` / `wait` through the real `describeMazeAction`):
**L1** the shared vocabulary live — `lab.html?source=manual&seed=2&width=15&height=15&skeleton=rooms&areas=1&elements=guard;len=2;turns=1&count=2`
(the walk box IS the store's envelope) · **L2** `index.html?game=procgen_maze&seed=1` → Loops panel →
loop mode → a maze block (the path vocabulary; the only recording view today) · **L3**
`index.html?mode=jta&game=jta_substrate_test&seed=1` → JTA Action Queue (the row shape V1 reuses) ·
**L4** `NewDocs/scratch/queue-viewer-prototype.html` — a THROWAWAY page (gitignored) over the user's
own `loops:savedQueues:v1`, rendering every recording cross-substrate the way §6 proposes, with
in-memory edit controls and Save DISABLED; a synthetic sample (maze/jta/omsi/summary/annotations) when
the store is empty. The questions: (1) convergence = the SEAM + the block↔recording JOIN, FULL later
at §3.3's price? (2) v1 = recordings only? (3) a new panel with a `●` link, not an expander inside
each loops block? (4) an edit replaces under its tag keeping `recordedAt`/`name`, no "save as copy"?
(5) shape-only validation in the editor? (6) live-queue binding wanted at all (V5: registry slot +
submodule `replacePending` + gitlink)? Names `queueViewer`/`queueViewerPanel`/"Queue Viewer" unless
told otherwise.

**LADDER (plan §9; trap 1047 checked — no rung consumes a state a later rung rewrites; V5 last because
it is the only submodule commit):** **V0** store `listSavedQueues` + `deleteQueue` + `subscribe`,
`loops.getRulesHash()`, one `loop-recording.md` paragraph (generator run + `procgenDocs/` vitest owed)
→ **V1** the read-only panel (module + 5 registrations + docs page + one in-app row, category
`queueViewer`, absorbed by `fast`) → **V2** the editor over recordings → **V3** the SEAM (mutant: a
buffer writer restored to `type:` must red the coarse-replacement row AND the summary `checks` row;
in-app `TA block modes` 4 + `Runner block modes` 2 are the live gate) → **V4** the JOIN
(`assignRecordingTags(resolveQueueBlocks(queue), warehouse)` → "bound to block #k" / "history") + the
`●` link → **V5** (⚖ 6) live binding → **V6** (parked) maze recording → lab picture, blocked on the SET
arm's "drive a library room" question (§5l). V0+V1 one Opus session; V2, V3, V4 their own.

**Pins each rung moves — DERIVED (plan §10):** `savedQueueStore.test.js` **32** · `actionQueue/` **47+3**
(unmoved until V5) · `loopState.test.js` **29** (V3 DELETES the `coarseOf` legacy rows) ·
`modules.json` loadPriority **73** → 74 · substrates in-app config **66** rows (⚠ a count in a test
name is an allowlist key) · in-app `fast` **61/61** vs `…T22-07-14` → 62 · generator `--check` at V0's
doc edit and V5's matrix row · `standing-values.json` **66** rows, none naming loops/jta/queue — no
row moves · `check-slice-records` **73/0/37** · maze digest `677b7d9c…` unmoved by every rung ·
`check-maze-lab` 265/0 only for V6.

**Deltas against the brief (`queue-viewer-planning-prompt.md`), by §:** §1 "whether (i) converges onto
(iii) … THIS arc's first design question" — answered as a price and a seam, not a rung; §1 "a viewer that
edits a live queue needs a home for that" — three homes measured, deferred to V5; §1 "a viewer over a
store cannot assume two recordings of one block coexist" — confirmed at `sameTag`, and it also means an
edit is a REPLACE (⚖ 4); §2 the residues — none launched, none this arc's; §3 the CI loose end —
`df2c0cbf8` concluded green (run 33697707046, 13,011/0/8 skipped, slow 217/0), verified from the CLI
after the predecessor's `a69a9b295`. **NOT DONE, deliberately:** full convergence (A), a projection
adapter (B), live-queue editing in v1, tag editing, a persistent jta name table, per-entry cost, a new
gate file or standing-values row, any submodule change before V5.

## 5n. The APWorld EDITOR as the HUB over every procgen editor — PLANNED 2026-09-04; **H0 + H1 + H2 + H3 + H2b + H3b + H4a + H4b + H4c SHIPPED 2026-09-04/05, NEXT = H5** (Fable planning session `next-priorities-planning` at main `697c94ee6`; plan file `NewDocs/plans/apworld-editor-hub-plan.md`, gitignored; memory `project_apworld_editor_hub`)

**How this entry came to exist.** The session was briefed to hold the "next main priorities" conversation
across everything but the platformer. The user's first move set the queue viewer (§5m) aside — *"The session
that wrote the queue editor plan should have started with a discussion of where it fits into the plans for
the features that would use the queue editor"* — and asked for a review of every procgen editor and how they
fit together. The review found that §5i (EDITOR INTEGRATION, CLOSED 2026-08-31) had already done that recon
and ruled the integration (A2 / B1 / `lab.html`); what the tree says TODAY that §5i did not close is in the
plan's §8. The user then stated the target directly, and this entry records it.

**⚖ THE ASK (user, 2026-09-04, verbatim in plan §1):** *"I want to combine all of these editors into one
coherent whole. The top level would be the APWorld editor. … I want it to be able to display and edit every
single element that appears in the rules.json files, including the sidecars. For elements that already have
dedicated editors for them, I want the APWorld Editor to have buttons or some other type of link to open the
relevant editor for that data."* Plus: a Links tab reaching every editor even when the document has no data
for it; the pipeline panel's composite-grid MAP factored out into a hub tab; a button on the Presets panel's
opened-preset screen that opens the data in the APWorld Editor.

**⚖ RULINGS (user, 2026-09-04):** (1) all eight integration ideas approved EXCEPT the queue viewer — *"the
individual queues are not part of the rules.json data"*; `loop_costs` IS and gets an editor link. (2) Linked
editors open from the **WORKING COPY** (*"Applied state could be much more difficult to implement, and might
not work for some things"*). (3) Map = the composite grid ONLY, for documents whose sidecars carry grid cells;
the region graph stays its own panel, reachable by a one-way button — *"I don't want a button in the region
graph leading back to the APWorld editor."* (4) *"Yes, extend the schema first."* (5) Save destination = the
rules.json document: a raw view (*"disabled if the data is too big. We might need to test to see what counts
as too big"*), a download to file, and *"load the rules.json data into the app, as if it was a preset"* —
writing presets to disk is out of scope.

**Measured at `697c94ee6` (plan §2, commands in §9).** The APWorld editor reads THREE document keys
(`regions`, `items`, `game_name`) and has three tabs; the schema declares 25 top-level keys and across the 205
committed presets TEN more appear undeclared (`preset_sidecars` 192 · `preset_label` 42 ·
`assume_bidirectional_exits` 26 · `procgen_metadata` 17 · `loop_costs` 12 · `playerId` 12 · `flash_panel` 4 ·
`region_atlas` 3 · `provenance` 1 · `_stub` 1); top-level `additionalProperties` is unset. The editor has
ZERO in-app rows and no docs page. Presets → hub is ONE publish: a preset load already reaches the editor
through the state manager's `rawJsonDataLoaded` re-emit. Apply publishes `files:jsonLoaded` but not
`rules:loaded` (the presets panel publishes both) — that is the "load as if a preset" delta. The map painter
is one 380-line block (`procgenPipelineUI.js:3743-4122`) whose only outside reads are two tile constants and
the panel's selection; `reconstructResultFromSidecars` (`:340`, pure, node-tested) already rebuilds a grid from
`preset_sidecars` (first player only); four `verify-*-steps-ui.mjs` are its only gates. ⛔ The renderer cannot
move into `procgenCore/` (`bindingContract.test.js` forbids the maze import it carries). rules.json sizes:
median 203 KB, p90 767 KB, max 2.62 MB; no editor has a size guard today. Only the grown worlds' sidecar
entries carry `grid_cell`; Seedling/jta entries do not.

**LADDER (plan §5; trap-1047 checked):** **H0** schema (declare the ten keys + `presetSidecarEntry`; name
the producers of `preset_label`/`playerId`/`_stub`; `test_schema_validation.py` 205/205 stays green) →
**H1** hub chrome (player selector; a key REGISTRY + `set-key` op; generic Document tab with raw fallback;
derived Links tab; the FIRST in-app row; docs page) → **H2** presets button + Download + Load-into-app (=
Apply + `rules:loaded`) + Raw view with a MEASURED threshold → **H3** the map (extract the painter to
`procgenPipeline/compositeMapRenderer.js`, pipeline imports it BYTE-INERT under the four verify gates; hub Map
tab; click selects the region; "Open region graph") → **H4** per-region Edit ▸ off the sidecar substrate via
`getRegionEditor`, opened from the fold, ONE `replace-region-sidecar` op back (undo covers the sub-edit); reverse
"Open in APWorld Editor" links from the lab pages and the bounce editor → **H5** sidecar block links
(`region_atlas` → marking tool; `procgen_metadata` → pipeline; `loop_costs` → cost debugger, working-copy
intake MEASURED; `flash_panel`/`provenance` raw). One Opus session each; H4 splits a/b if the report says so.

**⚖ OPEN (plan §7), none blocking H0–H2:** strict `additionalProperties: false` as H0's last commit if
205/205 validate (recommend yes); `_stub`/`playerId` schema'd vs fixed at the producer (H0 names the producers
first); zone-only worlds get "no map" in v1 (recommend accept); the raw-view threshold is a measurement, not a
ruling.

**⚖ APPROVED 2026-09-04 ("I approve of that plan. Please begin.") with ONE addition:** *"I want to refactor
the map rendering code so that each substrate declares whether it supports map rendering, and has a way to
call the renderer. I don't want to hardcode support for map rendering for specific substrates."* Measured:
the painter's `_drawRegion` (`procgenPipelineUI.js:3856-3873`) dispatches by hand on `render_hint`
(`'text_adventure'` / `'maze'` / generic). ⇒ H3 becomes a registry SLOT (working name
`compositeMap.drawRegion`, the `roomEditor` declaration-is-data precedent) declared by maze and
text_adventure, each carrying its own painter; the shared renderer keeps grid/connections/stub/generic and
dispatches through the registry, generic BY NAME when the slot is absent; the capability matrix and the
registry doc gain the row (generator `--check` + `procgenDocs/` vitest owed). This OVERTURNS the entry's ⛔
above: with the substrate painters moved out, the shared renderer imports no substrate module and CAN live in
`procgenCore/`. **H0 LAUNCHED 2026-09-04** as `apworld-hub-sliceH0` (Opus, kickoff
`NewDocs/plans/apworld-hub-sliceH0-prompt.md`); the ladder self-advances on verified report-backs
(`feedback_session_prompts_report_back`), stopping at each ⚖.

**⇒ H0 AS BUILT 2026-09-04** (`eb16b6279` schema · `f2627128d` procgen docs · `860608b0a` schema README ·
this commit = the record; as-built = plan §10, which is in `NewDocs/` and so untracked). The census
REPRODUCED exactly at `230c5def3` — same ten keys, same counts, 205 files. **NINE declared** with `$defs/presetSidecarEntry` (`substrate` required,
`playable_payload` opaque); schema 25 → 34 properties, 16 → 17 `$defs`, 833 → 1,045 lines. `test_schema_validation.py`
**2 passed, 205 subtests** (315 s); 14 more vitest files, 672 rows, green; `check-slice-records` ALL PASS.
**Five overturns.** (1) `preset_label` and `playerId` DO have producers — `exporter/exporter.py:1391-1396`
and `:2864-2866` (a STRING, player-specific exports only) — but **`_stub` has NONE**: zero writers in the
tree, a hand-written English sentence in one preset, left UNDECLARED per the brief's rule. (2) §2 attributed
`assume_bidirectional_exits` to `handler.py:1817-1820`; that is a NESTED `exporter_settings` field — the
top-level key is `procgenPipelineEngine.js:6292`. (3) `procgen_metadata` carries nine fields, not four
(`source_game`/`source_counts`/`sphere_plan`/`sphere_tree`/`edits`), and is open by construction (the caller's
block is spread in). (4) `loop_costs.regions` → an OBJECT but `loop_costs.locations` → a **number**
(`loopCostGenerator.js:204/:342`, read at `costDataManager.js:346-348`) — a mirrored declaration would have
been wrong about half of it. (5) `flash_panel` has a third field, `swf` (`tileMapAnalyzer/rulesExporter.js:353`).
**Two facts H1 needs:** `preset_sidecars` is EMPTY (`{}`) in 158 of its 192 presets — only 34 carry data and
every one keys under slot `"1"`, the four-player multiworld documents included, so H1's player selector has
no committed per-player sidecar to select; and the 1,360 entries measured are what typed the `$def`.
⛔ **A constraint on every future schema edit:** `procgenCore/jsonSchemaCheck.js` throws BY NAME on an unknown
assertion keyword, so a keyword outside its `KNOWN_KEYWORDS` reds every JS row while the Python gate stays
green. H0 stayed inside that set and re-walked the emitted schema to prove it (0 unknown).
**MUTANTS (both temporary, both recorded).** MUTANT A (drop the `preset_sidecars` declaration, top level still
permissive) → **205/205 validate** — nothing reds, which is the substance of ⚖ 1: with `additionalProperties`
unset a schema entry is DOCUMENTATION, not a guard, and its ABSENCE is invisible to the gate. MUTANT B
(`additionalProperties: false`, nothing else) → **204/205**, the single red being
`robotkitty_tilemap/AP_14089154938208861744` on `<root>: Additional properties are not allowed ('_stub' was
unexpected)` — cross-checked by an independent top-level-key scan naming the same file and key. CONTROL
(schema as committed) → **205/205**. ⇒ **Going strict costs exactly one preset, and the offender is the one
key with no producer.**
**CI ALL GREEN at the pushed SHAs.** `860608b0a`: `unittests` (the job carrying `test_schema_validation.py`),
`JavaScript Unit Tests`, `Test ALTTP Spoiler & Frontend Regression`, `CodeQL` — all success. ⚖ 52 suite row,
QUOTED from CI by SHA (run 33930322122): `suite: vitest (unfiltered) 427/13019 (13011 passed | 8 skipped |
0 failed)`; `slow battery 12/217 (217 passed | 0 failed)`. `69b7ebc64`: `unittests` success.
**⚖ THE USER OWES:** (1) strict top level — the measurement is above, and mutant A is the argument FOR it
(with a permissive top level, deleting a declaration is invisible to the gate); (2) `_stub` — delete the key,
declare it, or leave it (H0 left it; ⛓ deleting it is the same commit as strict); (3) NEW — whether a
4-player procgen preset is worth generating, since no committed document exercises a per-player sidecar.
~~**NEXT = H1** (hub chrome)~~ — **H1 SHIPPED 2026-09-04/05; NEXT = H2.** (H1's `documentKeys.js` is
DERIVED from the schema's `properties` exactly as this line asked, and the raw-JSON fallback row shipped even
though Task 0 removed the one committed key that needed it — a user-loaded file can still carry any key.)

**⚖ RULED 2026-09-04 (user, on H0's report): (1) STRICT top level — `additionalProperties:false` plus
deleting `_stub` from `robotkitty_tilemap`'s preset (H0 measured strict = 204/205, the one red being the key
with no producer) — carried by H1 as Task 0. (2) A 4-player procgen preset WILL be generated as a fixture
BEFORE H4 (H0 found `preset_sidecars` is `{}` in 158 of 192 carriers and every populated one keys under slot
"1", the four-player documents included); H1's selector ships on regions/items. H0's five brief overturns are
in the plan's §2 and §10 (headline: the top-level `assume_bidirectional_exits` producer is
`procgenPipelineEngine.js:6292`, not the exporter; `_stub` has NO producer). **H1 LAUNCHED 2026-09-04** as
`apworld-hub-sliceH1` (Opus, kickoff `NewDocs/plans/apworld-hub-sliceH1-prompt.md`).

**⇒ H1 (HUB CHROME) AS BUILT — SHIPPED 2026-09-04/05** (Opus session `apworld-hub-sliceH1` from
`8acff0e95`; commits `34dfa26d4` Task 0 · `db17ac6b6` Tasks 1–4 · `aaf8d98b3` Task 5 · this record.
As-built = plan §11, in `NewDocs/` so untracked).

**Task 0, the ⚖ ruling, done and MEASURED.** `additionalProperties: false` at the schema's top level and
`_stub` deleted from `robotkitty_tilemap`'s preset — a 2-line diff that leaves the file's formatting alone;
`preset_files.json` still indexes it. `python -m pytest test/general/test_schema_validation.py -q` →
**2 passed, 205 subtests passed in 250.35s** — 205/205, exactly what H0's mutant B predicted (204/205 with
`_stub` present). Schema 1,045 → **1,046 lines**, 34 properties unchanged.
⛑ **H0's KNOWN_KEYWORDS law held and cost nothing**: `additionalProperties` was already in that set AND
implemented in `schemaErrors`' object branch, so the strict top level cost `jsonSchemaCheck.js` a line count
and no code. The FUNCTION census the brief named (`rg -ln rulesJsonSchemaErrors frontend --glob '*.test.js'`
= 8 files) ran green at **363 rows**, including `jsonSchemaCheck.test.js`'s *"all 205 of them"* — so the JS
evaluator and Python agree on the same corpus under the strict schema.

**What H1 built.** `apworldEditor/documentKeys.js` — the top-level key REGISTRY, one entry per
`rules.schema.json` property, in the schema's own order, with per-player read off each property's
`patternProperties {"^[0-9]+$"}` (18 of the 34) and `DOCUMENT_KEY_EDITORS` as the EMPTY `key → {open}` slot
H5 fills · `apworldEditor/documentLinks.js` — substrate rows DERIVED from `roomEditor` declarations plus a
six-row document-level table written once as data · a `set-key` op (#20) with `SET_KEY_SCOPES` · the
**Document** and **Links** tabs · the **player selector** (`PLAYER_ID`, a module constant read at 42 sites,
→ `this.playerId`, re-derived per render; `_applyOp` STAMPS it, group members included, never overwriting a
slot a cascade builder chose) · the panel's FIRST three in-app rows (category `apworldEditor`, absorbed by
the `fast` batch through `testBatches.js`' default rule, so no batch definition moved) ·
`docs/json/modules/apworldEditor.md`, linked from the index.

**Five things H1 overturned or pinned (plan §11.1).**
1. **The selector's default rule is FORCED by a committed preset, not chosen.**
   `multiworld/AP_01043188731678011336_P2_rules.json` carries `playerId: "2"` and keys `regions`/`items`
   under `"2"` ALONE, while its `player_names` still starts at `"1"`. So the old constant AND a
   `player_names`-first fallback BOTH draw an EMPTY world for a document that is not empty. Order:
   `playerId` → first `player_names` key → first slot carried; a `playerId` naming a slot the document does
   not hold is ignored.
2. **§10.6's "derive where it can be" admitted no exception** — label, description (H0's producer line),
   type, required and per-player are all in the schema. The only hand-written table is which TAB owns a key,
   and half of that is derived from `META_FIELDS`.
3. **⛔ `set-key`'s SCOPE is RECORDED, never inferred from `player`.** Every op in `rulesDocOps` carries
   `player` and the panel stamps it, so "a player is named ⇒ nest under the slot" would put document-level
   keys under a slot the moment the Document tab grew its selector — the tab the op exists for.
4. **The schema veto is a pure PREVIEW + a DIFFERENCE.** `applyRulesDocOp` is pure, so a candidate op is
   applied to a preview, `rulesJsonSchemaErrors` runs over the whole thing, and the errors the document
   ALREADY had are subtracted — `rulesDocOps`' own law. A fetch failure makes the veto a no-op rather than
   the tab read-only.
5. **⚠ A DEFECT THE IN-APP RUN FOUND THAT ITS OWN THREE GREEN ROWS COULD NOT FAIL ON.** `defaultPlayerOf` →
   `playerSlotsOf` → `buildDocumentKeys` threw on a null schema, and the panel fetches the schema
   ASYNCHRONOUSLY — so the first render killed the whole `stateManager:rawJsonDataLoaded` handler, visible
   ONLY as an `[eventBus] Error in event handler` line in the browser log while all three rows PASSED. Fixed
   and pinned. General shape: after a green in-app run of new panel code, grep the log for handler failures.

**MUTANTS — driven, none committed.** (a) filter one key (`loop_costs`) out of `buildDocumentKeys`'
derivation → **3 rows red**, including the parity row in both directions. (b) `set-key` storing the CALLER's
reference instead of `carried()`'s copy → the aliasing row reds (1 failed / 52 passed).

**GATES.** `frontend/modules/apworldEditor/` vitest = 5 files / **107 rows** (`rulesDocOps` 45 → **53**,
`rulesEditAdapter` 14, `rulesUtils` 8, new `documentKeys` **21**, new `documentLinks` **10**) ·
`scripts/procgen/lintGateLabels.test.js` 14 passed · `procgenDocs/` 445 passed / 7 skipped with the KNOWN
pre-existing red (`generated.test.js` `beforeAll` `:557` hook timeout) · the reference generator re-ran for
the `architecture.md` edit, `registry`/`refusals`/`instruments` all unchanged, 0 FINDINGS.

**IN-APP: the three new rows PASSED in BOTH `fast` runs (63/64 each); the two reds are the MACHINE, and the
attribution is measured, not assumed.** A DIFFERENT omsi row failed each run and each PASSED in the other
(`omsi-award-schedule` FAILED 32.1 s / passed 1.97 s; `omsi-multi-run-replay-retry` passed 23.5 s / FAILED
184.8 s). **24 prior `fast` runs on disk (2026-07-28 → 09-02) have both rows `passed` in every single one.**
The runner's own readout named the cause — `machine at failure: load 11.86 across 8 cpus` — and a third
attempt at the failing row ALONE could not even start its roster: `Timeout waiting for tests to start`,
`load 21.74 across 8 cpus`, `ps` naming a dozen concurrent `cc1` compiles under
`~/CC/SWFRecomp-CC/.claude/worktrees/agent-*` — **another arc's** work, which was NOT killed. ⇒ a confirming
`fast` run on a quiet box is owed and cheap; it is not a gate this slice could run while another arc owned
the CPUs. ⛔ It was ATTEMPTED, not merely promised: a watcher armed to fire the batch the moment load fell
below 5 expired after ~33 minutes **at load 13**. The measurement stays owed; what is recorded is the attempt
and its outcome.

**H1's CI, quoted by SHA (⚖ 52).** `a525748cd` (run 33936562406) and `cebabdfd5` (run 33936714005) — **all
six jobs success at both**: `unittests` (carries `test_schema_validation.py`, so the strict schema is green in
CI against all 205 presets), `JavaScript Unit Tests`, `Test ALTTP Spoiler & Frontend Regression`, `CodeQL`,
`Deploy to GitHub Pages`, `Build and Publish Docker Images`.
`suite: vitest (unfiltered) 429/13058 (13050 passed | 8 skipped | 0 failed)`, `slow battery 12/217 (217
passed | 0 failed)` at both. ⛓ Against H0's `427/13019 (13011 passed)` at `860608b0a` that is **+2 files and
+39 rows — exactly** `documentKeys` 21 + `documentLinks` 10 + `rulesDocOps`' 8 new `set-key` rows, with skips
unmoved at 8 and the slow battery unmoved at 217/0. Nothing else in the suite moved.

**NEXT = H2** (Presets button · Download · Load-into-app = Apply + `rules:loaded` · Raw view with a MEASURED
threshold). H3 gets `panel.playerId` + `documentKeys.playerSlotsOf` as its slot API and `entry.editor` is
where H5 hangs its links; ⛔ nothing may gate on `preset_sidecars` before the ⚖-ruled four-player procgen
fixture exists (H4's Task 0).

**H1 VERIFIED by the planner 2026-09-05** (`2ea6633f9` on origin/main; strict schema, 205 presets / 0
undeclared keys re-derived here; `documentKeys.js`/`documentLinks.js` + tests, 3 in-app rows, docs page all
on disk). ⚠ Overturn found while briefing H2: `rules:loaded` has NO subscriber in `frontend/` — the real
Apply-vs-preset delta is the SPHERE LOG (`sphereState/index.js:199` embedded, `:307` fetched by the load's
`sourceName`; Apply's `APPLY_SOURCE` fetches nothing). **H2 LAUNCHED 2026-09-05** as `apworld-hub-sliceH2`
(Opus, kickoff `NewDocs/plans/apworld-hub-sliceH2-prompt.md`): the Presets button, Download, Load-into-app
with the sphere-log delta measured and closed, and the raw view with a MEASURED threshold.

⇒ **H2 AS BUILT 2026-09-05** (`apworld-hub-sliceH2`, Opus; on `main` at `3fd522a2e`, pushed as
`ee05462d4` → `6fa10c442` → `f8b0ae13f` → `4b52d8484`; plan §12 is the full record). The three exits the
⚖ asked for all ship, and **six things the brief said are overturned by measurement**:

1. **The ⚖'s screen is `loadPreset` (`:1702`), not `displayLoadedJsonFileDetails` (`:1455`)** — the
   latter is the MANUALLY-LOADED-FILE screen ("This file was loaded manually from your computer"). The
   button ships on BOTH from one frozen descriptor, and the click wiring queries `#${…BUTTON.id}` so
   markup and handler cannot drift. It publishes `ui:activatePanel`, never `apworldEditor:loadRules`.
2. **The sphere-log delta is 199 of 205 presets, not 173.** `sphereState/index.js:254` recognises
   exactly FOUR in-memory sources by name and tries the embedded log for three of them;
   `apworldEditorApply` is not one — so Apply lost the log for the **26 embedded-log** presets as well
   as the **173 file-logged** ones (measured: 173 file-only · 26 embedded-only · 0 both · 6 neither).
   ⇒ Apply now republishes the session's recorded ORIGIN source name, which makes both cases work
   through code that already exists. ⛔ NOT embedding the fetched log: that would put bytes in the
   person's document their preset never had, and the ⚖ says the document IS the save destination.
   ⛔ The echo of our own Apply is told apart by OBJECT IDENTITY now — the source name is
   indistinguishable from an incoming load, and a panel keeping the old test would discard the edits
   it had just published. `APPLY_SOURCE` survives as the no-origin fallback, which is what
   `check-region-marking-tool.mjs:653` grabs by; a node row pins that pairing.
3. **§2's size census is in FILE bytes and the raw view's units are PRETTY bytes — different corpus,
   different maximum.** 13 presets are written COMPACT (up to **1.75×**), so the worst case is
   `procgen_topdown/AP_8` at **3,146,656** pretty bytes (1,799,872 on disk), not `stardew_valley`'s
   2,620,221. A threshold in pretty bytes measured against a file-size ranking would never have seen
   its own worst case.
4. **THE THRESHOLD, MEASURED**: `RAW_VIEW_LIMIT_BYTES = 2_000_000` pretty bytes —
   `node scripts/procgen/measure-apworld-raw-view.mjs`, four runs, box loaded 8–17 throughout (another
   arc's `cc1` compiles; every table prints its own load). It is the largest size measured USABLE
   (1,504 ms to open, 279 ms/keystroke); 2.62 MB types at 468–809 ms and 3.15 MB takes **12,942 ms** to
   open and 1,251 ms/keystroke. Refuses **4 of 205**. ⛓ The instrument separates the PANEL's own
   re-render from the widget's, which is what makes it an attribution: at the maximum the panel costs
   515 ms and the textarea the other 12.4 s.
5. **⚠ AND THE MEASUREMENT SAYS THE TEXTAREA IS THE WRONG WIDGET.** CodeMirror 6 is
   viewport-virtualised and FLAT — **30–133 ms to open, 11–240 ms per keystroke, from 200 KB to 8 MB**,
   150× faster at the corpus maximum — and would retire the constant. The mount is six lines from
   `editorCodeMirror6/codemirror6Imports.js`; the hub integration is not. Named as a **costed
   follow-up with its numbers**, which is what the brief asked for. ⚖ **for the user**: take it?
6. **The brief's "eight `createObjectURL` copies" is 19** (18 outside submodules, 17 with
   `application/json`), listed by name in plan §12.1 as a cleanup-backlog lead. ⛔ Not consolidated.
   And the download name carries BOTH identifiers: `seed_name` alone gives **24** distinct names over
   205 documents and is the EMPTY STRING in **29** of them.

**Gates.** `apworldEditor/` vitest 107 → **132** (6 files; new `hubExits.test.js` 21) ·
`presetUI.test.js` 66 → **70** · `lintGateLabels` 14 · the procgen generator 265 → 266 instruments,
0 FINDINGS · `procgenDocs/` **452 passed, 0 skipped, 0 failed** — ⚠ the kickoff's KNOWN pre-existing
red (`generated.test.js` `beforeAll` 10 s hook timeout) **did not fire**, so it is load-flaky, not
deterministic · in-app `--batch=fast` **68/68** (run 2), all four new rows green, `compare-runs`
against H1's quoted run reporting ADDED (4) all passed and **FIXED (1): `omsi-multi-run-replay-retry`**
— ⛓ which CONFIRMS H1's load attribution of that red, without a line of omsi changing ·
browser-log grep for thrown handlers **0**.

**A defect this slice's own first in-app run found — in the ROW, not the code.**
`apworld-apply-keeps-the-sphere-log` failed `expected "4", got "10"` in **0.6 s** while
`Apply did NOT lose the sphere log` PASSED beside it. `sphereState` is an app-wide SINGLETON and the
rows before it leave `procgen_maze`'s 4-sphere log in it, so a poll for "non-empty" returned
INSTANTLY with the previous row's data. ⇒ **a poll for "this shared thing is non-empty" is a poll the
PREVIOUS test can satisfy**; the 0.6 s duration was the tell. Fixed by resetting the singleton first.

**Mutants — three driven, none committed.** (a) `carried(op)` → `{...op}` reds the new
`replace-document` aliasing row (7 red total). (b) the threshold halved — ⚠ **its first anchor row did
NOT catch it**, because that row bounded the limit at the p90 preset and 1,000,000 is *also* a
measured-usable size; re-anchored on two REAL documents (`smz3` 1,936,130 must be viewable,
`stardew_valley` 2,620,225 must not) it reds. *A guard whose whole suite reads its own default cannot
see the default move.* (c) Apply without the origin reds the panel-source scan.

**H2's CI, quoted by SHA (⚖ 52).** `4b52d8484` (run 33941849160) — **all six jobs success**:
`unittests`, `JavaScript Unit Tests`, `Test ALTTP Spoiler & Frontend Regression`, `CodeQL`,
`Deploy to GitHub Pages`, `Build and Publish Docker Images`.
`suite: vitest (unfiltered) 430/13088 (13080 passed | 8 skipped | 0 failed)`,
`slow battery 12/217 (217 passed | 0 failed)`. ⛓ Against H1's `429/13058 (13050 passed)` at
`cebabdfd5` that is **+1 file and +30 rows — exactly** `hubExits.test.js` 21 + `rulesDocOps`' 5 new
`replace-document` rows + `presetUI.test.js`' 4 new button rows. Skips unmoved at 8, slow battery
unmoved at 217/0. Nothing else in the suite moved, which is the claim a bounded local run cannot make.

**NEXT = H3** (the map): the registry slot `compositeMap.drawRegion` DECLARED by maze +
text_adventure, the shared `procgenCore/compositeMapRenderer.js`, `reconstructResultFromSidecars`
gaining `playerId`, the hub Map tab + click-select + one-way "Open region graph". ⚠ H2 leaves H3 three
carries (plan §12.7): `_openSession` now takes an `origin` on its base tag and a new intake path must
DECIDE what it is (`null` is legitimate and costs the sphere log); the panel's per-render cost is a
live number — `panel-only TTI` **4.6 s** on `stardew_valley`, dominated by `validateRules` over the
whole document on EVERY tab switch, which H3's Map tab pays too; and CM6 is the costed follow-up above.

**H2 VERIFIED by the planner 2026-09-05** (`81d658343` on origin/main; `rawView.js` with
`RAW_VIEW_LIMIT_BYTES = 2_000_000`, `hubExits.test.js`, the measurement script, the `origin` carry, the
Presets button — all on disk). **⚖ RULED 2026-09-05 (user, on H2's measurement): the CodeMirror 6 raw view
is taken as its OWN slice, H2b, AFTER H3** — CM6 opens in 30–133 ms and types at 11–240 ms per keystroke up
to 8 MB where the textarea needs a 2 MB limit; H2b retires the constant. Ladder: H3 → H2b → H4 (Task 0 =
the 4-player fixture) → H5. **H3 LAUNCHED 2026-09-05** as `apworld-hub-sliceH3` (Opus, kickoff
`NewDocs/plans/apworld-hub-sliceH3-prompt.md`): the per-substrate `compositeMap` registry slot declared by
maze + text_adventure with their painters moved out of the pipeline panel, the shared renderer in
`procgenCore/`, the pipeline swapped byte-inert under its four verify scripts, and the hub's Map tab with
click-select and the one-way "Open region graph" button.

⇒ **H3 AS BUILT — THE MAP.** `067f6c86a` (Tasks 1–3) + `966993244` (Tasks 4–5) on `main`,
pushed; plan §13. **`compositeMap: Object.freeze({ drawRegion })`** is the registry slot, DATA like
`roomEditor`, declared by maze (`mazeRoom/mazeCompositeMap.js`) and text_adventure
(`textAdventureSubstrateWrapper/textAdventureCompositeMap.js`) — each painter MOVED out of the panel
with its own imports. The shared `procgenCore/compositeMapRenderer.js` (443 l) draws the grid, the
connections, the stub cell, the **generic box LABELLED with the id it fell back from**, the selection,
and the click geometry; it names no substrate, which is what lets it sit under
`bindingContract.test.js`'s scan. `procgenPipelineUI.js` **6,013 → 5,473 l** (the painter block was
**378 lines / 17,055 bytes**; `git diff --stat` over the panel + its test = **48 insertions / 779
deletions**), and ⛓ **the pipeline panel now imports NO `mazeRoom/` module at all** — its only one was
the painter's, and the census found `getObstacle`/`getItem` unused anywhere in the file.

**Six overturns (plan §13.1).**
1. **§4's "put the reconstruct in `procgenCore/`" is WRONG, one hop past what the gate can see.**
   `reconstructResultFromSidecars` builds a `Grid`; `Grid` is in `procgenPipelineEngine.js`, which
   imports `mazeRoom/mazeGeometry.js`. `bindingContract.test.js` scans **literal import specifiers**,
   so a core importing the engine passes the row while dragging a BINDING in behind it. ⇒ the RENDERER
   is in `procgenCore/` (it needs only `width`/`height`/`getRegion`/`allRegions` off a duck-typed grid)
   and the document reader is `procgenPipeline/compositeMapDocument.js` (128 l), which the hub imports
   instead of the 6,013-line panel.
2. **The brief's dispatch key `substrate ?? render_hint` INVERTS the shipping precedence**, and the
   corpus cannot tell them apart: over the 205 presets, **1,360** sidecar entries, `substrate` present
   on all 1,360, `render_hint` absent on 270, **0 disagreements**. So `render_hint ?? substrate` stays.
3. **The `?? 'maze'` default is DROPPED, and named as changed** — measured unreachable three ways:
   **0 of 1,360** sidecar entries name neither field; `growMaze` (7 regions), `topDownFromRulesJson`
   (3) and `layoutTopDown` (3, all payload-FREE stubs) produce **0** payload-bearing regions with no
   id; and the seven `placeRegion`/`replaceRegion` sites either pass no payload or pass a
   `buildSubstrateRegion` result, whose own signature defaults `substrate = 'maze'`. Keeping it would
   have left the one hardcoded substrate name the ⚖ asked to remove, where nothing can observe it.
4. **The kickoff names a script that does not exist**: `verify-grid-growth-steps-ui.mjs` is really
   **`check-grid-growth-ui.mjs`**. The other three are as named.
5. **The four verify scripts are 0-moved, and the ONE differing line is NONDETERMINISTIC at a fixed
   HEAD.** All four exit 0 before and after; the 150-line logs differ in one informational line, PHASE
   J's substrate order (= `substrateRegistry.getAll()`'s insertion order). ⚠ Three re-runs at the
   post-swap HEAD gave **three different orders**, so the app's module loader registers racily and a
   single before/after pair cannot attribute it. A measurement, not an assumption.
6. **A finding left UNFIXED on purpose**: a region rebuilt from sidecars carries no top-level `exits`
   (the engine's own placements set it), so a LOADED document's map draws cells and their in-cell exit
   squares but **no inter-region connection lines**. Pre-existing; the one-line fix would change the
   pipeline panel's loaded-preset view, which this slice had to keep byte-inert. Offered to H4.

**The hub's Map tab** reads the WORKING COPY (`reconstructResultFromSidecars(record, {playerId})`,
memoised on the record's object identity + slot), prints *"No map for this world (no grid data in the
sidecars)"* **and the reason** with no canvas and **no graph fallback** (⚖), and a click selects the
region in the Regions tab through the panel's new — and only — selection API, `selectRegion(name)`,
which returns whether the document actually carries it. *Open region graph* reuses `documentLinks`'
own `regionGraphPanel` row, and ⛔ **nothing was added under `regionGraph/`** (⚖ one-way).

**Gates.** new `compositeMapRenderer.test.js` **32** (driven by a TOY substrate registered in the
test, plus a shipped-declarer suite) + new `compositeMapDocument.test.js` **9** · `procgenCore` +
`procgenPipeline/` **24 files / 820 passed** · `apworldEditor/` **132** (unmoved — H3 adds no node row
there), `presetUI` **70**, `lintGateLabels` **14** · the procgen generator **62 → 63 fields, 11 → 12
groups**, 0 FINDINGS, 0 libraries not loadable headless, fixed point on re-run ·
`npx vitest run frontend/modules/procgenDocs/` **452/0/0** · `check-procgen-docs.mjs` **ALL CHECKS
PASSED** · in-app `--batch=fast` **71/71**, the three new rows at 0.8 / 0.4 / 0.4 s, `compare-runs`
vs H2's 68/68 reporting **ADDED (3) all passed and nothing else moved** · browser-log grep for thrown
handlers **0**.

**Mutants — three driven, none committed.** (a) maze's `compositeMap` deleted → **3 rows red**,
including the one that DRAWS a maze region and asserts the generic box's signature is absent, so a
declaration wired to the wrong function reds too. (b) `?? 'maze'` restored → 1 row red. (c) the named
player slot ignored → 2 rows red.

**H3's CI, quoted by SHA (⚖ 52).** `836d6145d` (run 33944254014) — **all six jobs success**.
`suite: vitest (unfiltered) 432/13115 (13107 passed | 8 skipped | 0 failed)`,
`slow battery 12/217 (217 passed | 0 failed)`. ⛓ Against H2's `430/13088 (13080 passed)` at
`4b52d8484` that is **+2 files and +27 rows, every one accounted**: `compositeMapRenderer.test.js`
**32** + `compositeMapDocument.test.js` **9**, minus the **15** that moved OUT of
`procgenPipelineUI.test.js` (22 → 7), plus **1** — `bindingContract.test.js`'s `it.each(SHIPPING)`,
whose roster is READ OFF the `procgenCore/` directory, so the new renderer enrolled itself in the
import scan with no edit to the gate. Skips unmoved at 8, slow battery unmoved at 217/0.

**NEXT = H2b** (the CM6 raw view, ⚖ ruled), then H4 (Task 0 = the 4-player fixture), then H5.
⛓ **H2b + H3b SHIPPED 2026-09-05 — see the ⇒ AS BUILT blocks below. NEXT = H4, then H5.**

**H3 VERIFIED by the planner 2026-09-05** (`390fe0da6` on origin/main; the slot on both declarers, the
renderer in `procgenCore/`, the reconstruct pipeline-side, the docs section and the regenerated matrix, the
hub's `selectRegion`, the pipeline panel with no `mazeRoom/` import — all on disk). Standing-artifact
corrections from H3: the reconstruct CANNOT live in `procgenCore/` (its `Grid` reaches `mazeRoom/` through
the engine and the binding contract scans literal specifiers only — trap 1163); `?? 'maze'` was unreachable
and is gone; a document rebuilt from sidecars draws no inter-region connection lines (pre-existing; a
one-liner offered to H4). **H2b LAUNCHED 2026-09-05** as `apworld-hub-sliceH2b` (Opus, kickoff
`NewDocs/plans/apworld-hub-sliceH2b-prompt.md`): the raw view on CodeMirror 6, retiring the 2 MB limit on
the measurement's say-so, the measurement script re-run over the hub's real editor.

**⚖ 2026-09-05 (user): "refactor the rest of the grid display code to move maze-specific code into the maze
substrate" — "Please do this. I prefer the cleaner option, not the quicker option."** Measured (plan §7b):
the display files import nothing from `mazeRoom/` after H3; what remains there is tile-grid vocabulary shared
with text_adventure. The maze-specific residue is in the ENGINE — `serializeMazeWorld` (183 lines) lives in
`procgenPipelineEngine.js` while its inverse lives in `mazeRoom/mazeRoomEngine.js`; the engine's ONLY
`mazeRoom/` import is used once, inside it; and the dependency is INVERTED (four maze files and the shared
submodule's `adapterPrimitives.js` import the pipeline engine to reach it). ⇒ **slice H3b** (kickoff
`NewDocs/plans/apworld-hub-sliceH3b-prompt.md`): the serializer goes home, the helpers it needs are homed
where both can import, the submodule's re-export is corrected and the **gitlink bump is pre-authorized by
the ruling** (submodule pushed first; SHAs reported). Queued to launch when H2b reports (both touch the
primary tree). Ladder: H2b → H3b → H4 → H5.

⇒ **H2b AS BUILT 2026-09-05** (plan §14; `main` `eec53e9b2` → `3959ee1bd` → `60b12b89c` → `d7bfd7966`,
pushed). **The raw tab is CodeMirror 6 and `RAW_VIEW_LIMIT_BYTES` is GONE**, on
`measure-apworld-raw-view.mjs --all --samples=5`: **205/205 presets open**, TTI min 13.9 / median 30.8 /
p90 99.5 / **MAX 262.9 ms**, zero above the textarea's 1,504 ms at H2's limit point (load 2.02 → 3.53).
The refusal screen, "Show it anyway", `_rawForced` and `overLimit` are deleted with it.
· **⚠ THE OVERTURN: the raw tab's cost is NOT ordered by document size.** The three slowest to open are
`depgraph` presets at **1,198,656 B** — *under* H2's limit, never suspect — and the 3,146,656 B corpus
maximum is only THIRD. H2's median/p90/max-by-size method would have named 211.9 ms as the worst case and
been wrong by 51 ms and four documents. ⇒ **a percentile pick off variable A cannot bound variable B**; the
`--all` arm exists for that and costs six minutes.
· **ONE extension list, shared.** `editorCodeMirror6/jsonEditorExtensions.js` — `codeMirror6UI.js` rebuilt
on it byte-inert, and while moving it a `readOnlyCompartment`/`themeCompartment` pair and a `basicSetup`
import were found **ALL DEAD** (constructed, never in a list, never reconfigured). The kickoff asked which
compartments to reuse: the answer is neither, and they are not carried.
· **The Apply-from-text control is "Save JSON"** (⌘/Ctrl+Enter its twin), deliberately NOT "Apply" — the
toolbar's Apply means *load into the app*. The op path is unchanged: `parseRawView` → ONE `replace-document`
carrying the PARSED document.
· **The import is free, measured both ways.** Bundle 4,372,452 → **4,372,093 B (−359)**; unbundled the
ordered `.js` request set differs by exactly ONE file (3,755 B) because `codemirror6-bundle.js` was already
fetched at the same position — `editorCodeMirror6` is `enabled: true` and imports the barrel statically.
· ⚠ **§12.3's `stardew_valley` pretty size 2,620,225 is 2,620,221** — that row came from
`json.dumps(indent=2)`'s `ensure_ascii`; the view's units are `JSON.stringify`'s.
· Gates: apworldEditor **131** (`hubExits` 21 → 20), presets+lintGateLabels 115 unmoved, generator
instruments/browser/flags **266/78/172 UNMOVED** + 0 FINDINGS, `procgenDocs` **452/0/0**, in-app fast
**73/73** (compare-runs: ADDED 2, both passed, no new failures), browser-log grep 0.
· **FOUR mutants driven**, all red where they should be — including (d) the limit REINSTATED, which reds 3
of 20 rows. ⚠ Its lesson: the row asking about 1,234 bytes stayed GREEN, so **a retirement whose suite reads
a small value cannot see the guard come back** — what discriminates is naming the verdict's keys
exhaustively plus an anchor at real document sizes. And mutant (a) found a defect in the ROW: `.at(-1)` on
the op list a refused save left empty threw, so the run reported "test error-free" instead of its four
conditions.
· CI at `d7bfd7966` (⚖ 52, quoted by SHA): `suite: vitest (unfiltered) 432/13114 (13106 passed | 8 skipped |
0 failed)`, slow battery 217/0, **all six jobs green**. Against H3's `836d6145d` (432/13115): files unmoved,
**rows −1** = `hubExits` 21 → 20, exactly the row H2b moved. `jsonEditorExtensions.js` adds no node suite on
purpose — it imports the browser CM6 bundle, so its claim is asserted in the in-app row instead.
· For H4: `panel.rawEditorView` + `_teardownRawEditor()` are the pair any stateful tab owes; the PANEL is
now the expensive half (`depgraph` 3,326 ms panel-only vs a 263 ms editor), which sharpens §12.7 #2's
`validateRules`-per-tab-switch line.

**H2b VERIFIED by the planner 2026-09-05** (`c5bf77bca` on origin/main; the raw tab is CodeMirror 6 through the
shared `jsonEditorExtensions`, the 2 MB constant retired on a 205/205 `--all` corpus arm — TTI max 262.9 ms,
16 MB opens in 179 ms; bundle −359 B; the Apply-from-text control is **Save JSON**). Method lesson recorded
(trap 1165): the ranking by TIME is not the ranking by SIZE — the slowest documents were `depgraph` presets
under the old limit — so an "every preset" claim in this arc uses `--all`, never a percentile pick. The PANEL
is now the expensive half (`validateRules` per tab switch: 3.3 s on `depgraph` against a 263 ms editor).
**H3b LAUNCHED 2026-09-05** as `apworld-hub-sliceH3b` (Opus, kickoff `NewDocs/plans/apworld-hub-sliceH3b-prompt.md`).

⇒ **H3b AS BUILT 2026-09-05** (Opus `apworld-hub-sliceH3b`, on `main` at `4cde2f975`; plan §15). Submodule
`frontend/modules/shared` `ef31e39` → `4b78f33` (PUSHED FIRST; ⚖ the gitlink bump was PRE-AUTHORIZED for this
slice by the 2026-09-05 ruling *"I prefer the cleaner option, not the quicker option"*). Outer commits
`9035a46a6` (the move + the gitlink) · `67ede2a56` (the `?? 'maze'` deletion + a REFUSED deletion) ·
`ebea3caf3` (maze.md + the generated docs).

**AS BUILT.** `serializeMazeWorld` → **`mazeRoom/mazeSerializer.js`**, beside its inverse
`deserializeMazeWorld` — its own file, not part of `mazeRoomEngine.js`, because `mazeGeometry.js` imports
`isFloor` from the engine and an engine importing `computeLongestShortestPath` back would close a cycle. The
engine's ONE `mazeRoom/` import travelled with it: `grep -a -c "from '../mazeRoom/" procgenPipelineEngine.js`
→ **0**; the engine is **6,435 → 6,289** lines. `makeLocationName` → **`procgenCore/apLocationNaming.js`**
(new, imports nothing) — a home both halves import; ⛔ NOT inside `apIdNamespaces.js`, which is the register
of NUMERIC id bases. The submodule's `adapterPrimitives.js` now takes BOTH halves of the tile-grid round trip
from `mazeRoom/`, so loading the adapter catalog no longer drags the pipeline engine in behind it.

**FIVE THINGS THE BRIEF GOT WRONG, all measured (plan §15.1).** (1) `spiralCells` is NOT a serializer
dependency — it is the shuffled-spiral driver's generator, adjacent in the file and used once at the engine's
own `:3268`; it stayed. The serializer's free identifiers are exactly four. (2) "the maze module imports
NOTHING from `procgenPipeline/`" is unachievable: DERIVED by parsing specifiers (the as-built's first figure,
"eleven", was eyeballed off a grep and WRONG), `mazeRoom/` made **20** pipeline imports over **8** files
before the move; four were the serializer, **16 remain over 6 files naming 5 modules** — the ATLAS /
REGION-LIBRARY vocabulary the maze lab genuinely consumes. The law shipped is the true one: **no `mazeRoom/` file imports `procgenPipelineEngine`**,
asserted over a roster read off the DIRECTORY. (3) The engine test's "10 `serializeMazeWorld` rows" did NOT
move — that file never imported the serializer; all ten drive `buildPresetSidecars`, which dispatches through
the registry and did not move, so the count is **203 unmoved**, exactly as plan §6's own pin said. ⇒ **a row
that NAMES a function is not a row that IMPORTS it.** (4) ⛔ **`COLORS.floor`/`COLORS.wall` are NOT dead — the
deletion was REFUSED.** `mazeRoom/mazeCompositeMap.js:62` reads them through its `colors = COLORS` DEFAULT
PARAMETER, so the reader's own text says `colors.wall`; a census scoped to the renderer and the two declarers
cannot see it, and deleting them would blank every maze cell on the composite map. ⇒ **a value consumed
through a default parameter is read under the PARAMETER's name.** (5) A committed preset cannot be re-emitted
from its own document — `procgen_metadata` carries no seed and no pools.

**GATES.** Four `dump-*-byteidentity.mjs` oracles 0-moved (md5 identical before/after: maze `8cc31554`,
sphere `0dbe57bd`, spiral `8f8996cd`, topdown `b844a297`; after-run ENDs 05:43:24Z / :27Z / :31Z / :32Z UTC).
The moved body is byte-identical to the deleted block (`diff`: no output). In place of the impossible
re-emit: **1,034 committed maze sidecar payloads re-serialized from the tree's own bytes, 0 serializer
mismatches** over 22 documents (the three the brief named: 3/3, 235/235, 2/2); ten `seedling_atlas_maze`
entries differ and are CLASSIFIED — they carry `atlas_exit_id`, i.e. `regionAtlasPool.js` wrote them and this
serializer never did. Rows: engine **203 unmoved** · `mazeSerializer.test.js` **70 NEW** (14 direct rows — the
function had none — plus a 56-file import scan) · `adapterPrimitives.test.js` **6→7** · `compositeMapDocument.test.js`
**9→10** · `bindingContract.test.js` **72→73** (directory-derived roster). Four mutants, each naming the row
it reds. `check-slice-records` ALL PASS · `check-procgen-reference --check` + `check-procgen-docs` ALL CHECKS
PASSED · `procgenDocs/` **452/452** · in-app `--mode=test-substrates --batch=fast` **73/73**, `compare-runs`
"No differences in status, roster, or duration". ⚖ 52: the suite row is quoted from CI by SHA, never measured
here.

**H3b's CI row, quoted from CI by SHA (⚖ 52), not measured locally:** `ci-vitest-summary.mjs f76c0799c`
→ run **33948522027 success** (2026-09-05T05:57:18Z) — `suite: vitest (unfiltered)` **433/13187**
(13,179 passed | 8 skipped | **0 failed**); slow battery **12/217** (217 passed | 0 failed). The
follow-up `a1d7dd92a` (a derived-count correction in one docblock + the records — see below) was
still in flight at report-back.

⚑ **A COUNT IN THIS RECORD WAS TYPED, NOT DERIVED, AND WAS WRONG** — corrected in `a1d7dd92a` before
close, and named here because the as-built is the artifact that carries it. The first figure for the
maze→pipeline residue said "eleven imports over six files"; parsing the specifiers gives **20 over 8
files before the move, 16 over 6 files after**. The slice's law and every gate are unaffected; what
was misreported is the size of the residue §15.7 #3 offers to a future slice. (Family: a count in
prose is unfalsifiable unless it is derived — the same family as trap 1170, recorded by this slice.)

**For H4** (plan §15.7): there is no maze residue left in `procgenPipeline/` — §7b's tile-grid vocabulary is
the whole of what is shared now. `mazeRoom/`'s remaining **16** pipeline imports over 6 files are the
atlas/library vocabulary and would be their OWN slice with its own ⚖ — five modules, not one function. **NEXT = H4, then H5.**

**H3b VERIFIED by the planner 2026-09-05** (`a4f31ee64` on origin/main; gitlink `ef31e39` → `4b78f33`
pushed first; `mazeRoom/mazeSerializer.js` + 14 direct rows; `procgenCore/apLocationNaming.js`; the engine
imports nothing from `mazeRoom/`; the shared `adapterPrimitives.js` takes both halves of the tile-grid round
trip from `mazeRoom/`). Corrections H3b made to the brief: `spiralCells` was never a serializer dependency;
"the maze module imports nothing from the pipeline" is unachievable — 16 imports over 6 maze files are the
atlas/region-library vocabulary (their own slice, own ⚖); `COLORS.floor/wall` are live through a default
parameter and stay (trap 1169). §7b's "maze residue in the engine" is DISCHARGED. **H4 SPLIT:** H4a = the
4-player procgen fixture (⚖ 2026-09-04) + the loaded map's connection lines; H4b = per-region Edit ▸ + reverse
links. **H4a LAUNCHED 2026-09-05** as `apworld-hub-sliceH4a` (Opus, kickoff
`NewDocs/plans/apworld-hub-sliceH4a-prompt.md`): a maze worldgen world from `procgen_maze` seed 1, a
four-player two-game generation so the slots differ, committed per the `bounce_worldgen` precedent under the
shared-reachability and strict-schema gates.

**⇒ H4a AS BUILT 2026-09-05** (plan §16; commits `40fc5ea68` world · `781fadcad` fixture · `66d75f656`
connection lines · `801a58028` rows + the third "no map" reason · `1606ba7c5` regenerated reference; pushed).
⚖ 2b's fixture EXISTS: **`frontend/presets/multiworld/AP_05594871498841892311/` at SEED 4** — four slots over
two games, `{1:3, 2:3, 3:5, 4:5}` sidecar regions, the ONLY committed document whose `preset_sidecars` carry
more than one slot. Its maze half comes from a new tracked world `worlds/procgen_maze_worldgen` (generated
from `procgen_maze/AP_1`; 3 regions, all with `grid_cell`). ⚖ 3's census reproduced EXACTLY before it
(192 carriers · 158 `{}` · populated slot keys `{1: 34}` · 0 multi-slot) and now reads
`197 · 158 · {1:36, 2:2, 3:2, 4:2} · 1 multi-slot`.

⛔ **SEED 4, NOT SEED 1 — and this is the finding to carry.** The exporter routes every multi-game generation
to `frontend/presets/multiworld/AP_<seed id>/` by SEED ID ALONE, with no game discriminator, so a seed-1
four-player run OVERWRITES the committed ALTTP-family preset. Measured, not predicted: it did, all eight
files, and `git checkout --` restored them. Seeds 1–3 are the three committed multiworld presets; 4 is the
first free one. Named in `architecture.md` § "The Python round-trip".

⚑ **TWO PREMISES THE FIXTURE OVERTURNED THE MOMENT IT EXISTED.** (a) ⚖ 3's *"every populated one keys under
slot 1"* is a fact about the CORPUS, not about the producer: the exporter keys under the player's own slot
(`handler.py:2073-2102`), so the fixture's per-player files key under `"2"`, `"3"`, `"4"`. The hub's
per-player paths were never wrong — they were UNOBSERVABLE. (b) ⛔ **`grid_cell` does not mean "there is a
map"**: the two `Bounce Demo WorldGen` slots carry a `grid_cell` on all five of their regions and still draw
nothing, because a bounce payload has no tile-grid `width`/`height` (its geometry is `params.bounceLevel.size`
in PIXELS). The Map tab was therefore telling a person *"no grid data in the sidecars"* about a document that
visibly has them — a THIRD no-map cause, found by the first in-app run, fixed in the CODE
(`panel._noMapReason()` derives which of four reasons it is; H3's jta row still gets its own string).

**The connection lines** (§13.1 #6, §13.7 item 5): `exits: world.exits` in the placement. MEASURED on
`procgen_maze` seed 1 through a recording 2d context — **0 → 2 connection lines, 203 → 211 draw ops, 0 → 3
regions carrying top-level exits**; the expected 2 is DERIVED from the document's own reciprocal exit pairs by
a spelling that never calls the function under test. Before/after PNGs via the new
`scripts/procgen/shot-loaded-composite-map.mjs` (the PIPELINE panel's loaded-preset view, 336×168 px, grid
3×2) — the two differ.

Rows: `compositeMapDocument.test.js` **10 → 14** · three new in-app rows, in-app `fast` **73 → 76**,
`compare-runs` "ADDED (3)", nothing else moved. **FIVE mutants**, all driven, none committed — and two of them
are the record's point: **B** (place the RAW on-disk exits array instead of the deserialized `Map`) leaves the
line count IDENTICAL, so a line-count gate cannot tell WHICH exits object was placed; **3** (`documentKeyRows`
slices at `'1'`) left slot **2** green, because it holds the same 3 entries as slot 1 — which is exactly what
that row's vacuity check exists for. ⚠ The four `dump-*-byteidentity.mjs` are 0-moved but the gate is
**VACUOUS** for this change, measured: a `throw` at the top of `compositeMapDocument.js` produces 0 probe hits
in all four — none of them imports it. Gates: `test/general` **346 passed / 19,579 subtests** ·
`test_reachability` 2,997 subtests · `test_schema_validation` **205 → 210**, the five new files 5/5 (4/4
per-player) under H1's strict schema · bounded vitest 177/177 · `procgenDocs/` 452/452 ·
`check-procgen-docs` + `check-slice-records` ALL PASS. ⚖ 52: the suite row is quoted from CI by SHA.

⚑ **CI WENT RED AT `1606ba7c5` AND WAS FIXED IN THE SAME SESSION — the red is the record's point.**
`unittests` failed on ALL SIX matrix legs (`3 failed, 1498 passed, 3 skipped`) on ONE row,
`test/test_rules_json_writer_agreement.py::test_the_trailing_newline_belongs_to_the_write_site`, over exactly
the three tiles-bearing files of the new fixture. Everything else at that SHA was green. **Why the local
sweep missed it:** the kickoff named two files under `test/general/`, I swept that whole subtree (346 passed,
19,579 subtests) and called the Python side covered — but CI runs `pytest` over `test`, `test_json` and
`worlds`, and the failing module is at `test/`, one level ABOVE. ⇒ **a new committed preset owes the WHOLE
`pytest`, not `test/general`.** **Why the row failed:** it selected fixtures as *"presets whose spliced
`tiles` array is COMPACT — i.e. JS wrote them"* and asserted each such FILE ends with a newline. That was a
true classifier at EDITOR v3 W1 (gotchas.md's lineage table records **Python-spliced: 0**) — and W1's own fix
is what gave `exporter.py` compact separators, so the two writers' output has been byte-identical APART FROM
THAT ONE CHARACTER ever since. This fixture is the first Python-exported preset ever committed with a maze
payload. **The fix** identifies the writer by a MECHANISM instead: `Generate.py` writes an `AP_*.archipelago`
beside its `rules.json` and the node script cannot — measured over all 210 presets, of the **177** with such a
sibling, **0** carry a trailing newline. Row 3 now drives BOTH halves of its own sentence (node files HAVE
one, exporter files do NOT) where before it drove one; subtests **111 → 307**; two data mutants driven; NO
test name moved. Trap **1175**.

**CI at the close, quoted by SHA (⚖ 52) — ALL EIGHT WORKFLOWS GREEN at `0f480500d`.** `unittests` run
**33951868855 success**: `1498 passed, 3 skipped` on all six matrix legs (ubuntu 3.11.2/3.12/3.13, windows
3.11/3.13, macos 3.13) plus hosting. `ci-vitest-summary.mjs 0f480500d` → run **33951868869 success** —
`suite: vitest (unfiltered)` **433/13191** (13,183 passed | 8 skipped | **0 failed**; 13,179 → 13,183 is
exactly the four new `compositeMapDocument.test.js` rows — a new preset adds no vitest row and a new world
adds none), slow battery **12/217**. Also green: `JavaScript Unit Tests`, `type check`, `CodeQL`,
`Analyze modified files`, `Test ALTTP Spoiler & Frontend Regression`, `Build and Publish Docker Images`,
`Deploy to GitHub Pages`. ⚠ **1,498 is the SAME number the red run reported passing** — the three failures
were SUBTESTS of a row pytest counts once, so a run-to-run comparison on "passed" alone would have shown
nothing.

~~**NEXT = H4b**~~ · ~~**NEXT = H4c**~~ — both SHIPPED, see below. **NEXT = H5** (sidecar block links), then H6a, H6b.

**H4a VERIFIED by the planner 2026-09-05** (`7e52dd5df` on origin/main, all eight workflows green at
`0f480500d`): the fixture `frontend/presets/multiworld/AP_05594871498841892311/` (seed 4 — seed 1 would have
overwritten the committed ALTTP four-player preset, and did once before restore: the exporter routes
multi-game runs by seed id alone), sidecars {1:3, 2:3, 3:5, 4:5} over the new tracked
`worlds/procgen_maze_worldgen` and `bounce_worldgen`; the loaded map draws its connection lines; a CI red the
slice itself caused (a Python-exported maze payload met a test that identified the writer by an output
signature) found and fixed by mechanism. ⚖ 2b CLOSED. Lessons carried: a `grid_cell` is not a map (bounce
carries one, draws nothing — the no-map reason is now derived); a committed preset owes the WHOLE `pytest`;
the four byte-identity dumps are vacuous for `apworldEditor/` work. **H4 splits once more:** H4b = per-region
Edit ▸ + the `replace-region-sidecar` op; H4c = reverse links. **H4b LAUNCHED 2026-09-05** as
`apworld-hub-sliceH4b` (Opus, kickoff `NewDocs/plans/apworld-hub-sliceH4b-prompt.md`). Finding for the
user from the brief's measurement: a Seedling sidecar payload is an ATLAS REFERENCE (`atlas_ref`,
`atlas_region`, `level`, …), not a room record, so Edit ▸ from a rules.json cannot open the Seedling room
editor without the level set — H4b disables it by name; an atlas round-trip would be its own ⚖.

⇒ **H4b AS BUILT 2026-09-05** (Opus session `apworld-hub-sliceH4b`, launched at `ec5d79613`; commits
`1d26f06a5` the op · `1ba13475a` the round trip · `e511c3d4b` the door, the rows and the docs; plan
§17 has the full record). **Per-region `Edit ▸` ships, and the substrate DECLARES its half.**

`roomEditor` (W3) says WHICH editor opens a region's room; the new registry slot **`regionRoundTrip`**
says what that editor wants handed IN when the room comes out of a `rules.json`, and how to read its
save back — `{open, save}`, or `{refused: '<why>'}`. `apworldEditor/regionRoundTrip.js` resolves both
off the registry and imports NO substrate module: the H3 `compositeMap` precedent and the same ⚖
(*"I don't want to hardcode support for … specific substrates"*). Declarers: maze
(`mazeRoom/mazeRegionRoundTrip.js`, static), bounce
(`bounceRegionEditor/bounceRegionRoundTrip.js`, DYNAMIC — a static import would be a cycle through
`buildEditedRegion.js`), Seedling (`{refused}` — its payload is an ATLAS REFERENCE, and the entry says
so in its own words rather than the hub inferring "nobody wrote it yet" from an absent field). The
save folds into ONE op, `replace-region-sidecar {player, region, payload, rules}`, which one Undo
takes back.

⛔ **THE BRIEF'S WRITE-BACK WAS WRONG THREE WAYS, ALL THREE INVISIBLE UNTIL RUN.** (a) The maze lab's
document is a REGION LIBRARY, and `captureTileGridLibraryEntry` strips instance identity ON PURPOSE —
measured on the H4a fixture, writing its payload back raw nulls every `targetRegion` (so the map loses
the connection lines H4a just gave it), renames every item to `slot_N` with `locationName: null`, and
drops `fogEnabled`. ⇒ the write-back RE-STAMPS from the document, keyed on geometry. (b) The derived
rules are NOT the document's rules: grid-level gating is not drawn in the region's tiles
(`procgen_maze/AP_2` `region_3_3` carries `And(Has key_red, Has key_green)` and re-derives as `True_`
— overwriting it would silently OPEN a gated world), and the Python round trip renormalizes
`And(Has a, Has b)` into `HasAll([a,b])`. (c) Some regions cannot round-trip at all.

⛓ **ONE MECHANISM ANSWERS ALL THREE: THE BASELINE.** `open()` returns the editor's session AND what
its save would carry for a session nobody touched; feeding that back through `save()` says what this
door does when the reader changes nothing. The door is offered only where that is a NO-OP (byte-equal
payload, every endpoint named both ways), and a rule moves only where the baseline REPRODUCES the
document's own — everything else is FROZEN and the panel says how many. Rule comparison is byte
equality OR the same EXACT requirement from `extractItemRequirementFromRule`, whose `exact` flag is
the whole guard (`True_` is exact, `False_` is not, so an unreachable exit never compares equal to an
open one).

⛓⛓ **AND THE PAYLOAD NAMES ITS OWN AP LOCATIONS — reading the producer, not adding a heuristic, is
what made the door useful.** `serializeMazeWorld` bakes `items[].locationName` from
`global_name ?? makeLocationName(…)` (`mazeSerializer.js:49-55`), so a `procgen_topdown` region's
locations carry the SOURCE GAME's names (`Inside Yellow Castle`) that no convention can reconstruct.
Answering with the baked name — as bounce already answers from `ap_locations` — took the door from
**394 to 1,036 of the 1,046** committed maze-payload sidecar regions. Measured over every committed
preset: maze **1,036/1,046** · bounce **15/25** · Seedling 0/260, jta 0/31, omsi 0/6, runner 0/9,
text_adventure 0/15 — and every one of the 341 refusals carries a sentence naming its own cause.
Endpoints inside the editable regions: **3,018 movable · 841 FROZEN**.

⚠ **The bounce contract IS buildable from a document, minus three fields** — `physicsProfile`,
`mode`, `freeArrow` are world-level generation settings the exporter never carried
(`procgen_metadata` is `{driver, stop_reason, region_count, grid_dims}`). The cost is a DEGRADED
editor, not a disabled button: they change how rules are DERIVED and what a Regenerate builds, not
what the level IS. ⛔ But `mode` had to be MEASURED: the pipeline's `_editRegionTD` spells its own
fallback `?? 'braid'`, and taking that made every derived rule `False_` on the fixture; the right
fallback is `column`, which is `buildBounceRegionContract`'s and `buildEditedRegion`'s own.

Gates: `apworldEditor/` **168/168** (`rulesDocOps` 58→68 · `rulesEditAdapter` 14→15 ·
`regionRoundTrip` **26 NEW**) · the five touched module trees **3,809/3,809** · `procgenDocs/`
452/452 · `check-procgen-docs` + `check-slice-records` ALL PASS · **`check-maze-lab` 265/0 and
`check-procgen-lab-hosting` 66/0, both UNMOVED** · in-app `fast` **76 → 78**, `compare-runs` `ADDED (2)` and nothing else. ⛔ The four
`dump-*-byteidentity.mjs` are NOT quoted — H4a measured them vacuous for `apworldEditor/` work. No
preset and no Python changed, so trap 1175's whole-`pytest` rule does not bite. ⚖ 52: the suite row
is quoted from CI by SHA.

⛑ **THE IN-APP LAB-DOOR ROW MEASURED THE WRONG THING THREE TIMES, and each failure is a trap.**
(1) A real mounted maze lab connected INSIDE the row's own 8 s poll, opened room 0 for real and
published its OWN close, so `onSave` fired with the page's UNEDITED record and the row measured a
no-op while asserting an edit — a live page and a synthetic one cannot both author the same
three-phase conversation. ⇒ the host is a PANEL-SHAPED stub, W4's own contract shape. (2) Asserting
that no lab was mounted failed: an earlier row in the roster had raised one. ⇒ stand the real ones
aside and put them back. (3) **`procgenLab:levelChanged` has NO static publisher** — the adapter
registers `iframe_<iframeId>` DYNAMICALLY at publish time — so the bus SKIPPED every publish with
only a warn log. ⇒ the row registers itself as a publisher, once.

⛑ **TWO MUTANTS WERE GREEN AT FIRST, and they are the same family: a fixture on which two
implementations agree cannot tell you which one you shipped.** Dropping the `regionRoundTrip` lookup
from the button stayed green (jta refuses one branch earlier; no row drove a DECLARED refusal) ⇒ a
Seedling control row. Ignoring the baked `locationName` stayed green (for a maze-grown region it
equals what the convention reconstructs) ⇒ three `procgen_topdown` rows, which assert first that no
document name there contains `__` at all.

**⚖ TWO OPEN QUESTIONS FOR THE USER**, both found by measurement, neither blocking H4c: (a) the ten
`seedling_atlas_maze` rooms are the only maze regions the door refuses — their payloads are written
by the atlas derivation, not by `serializeMazeWorld`, so a round trip adds an `itemLib: {}` and a
computed `longestShortestPath` they do not carry; (b) `assembleBounceRegionFromLevel` names every
exit `side_exit_<side>`, so a bounce region whose portal is authored under its own name (`exit_up` in
the `spring_gap` zone) cannot be re-assembled — **which is a defect in the PIPELINE's own `Edit ▸`
path too, not only in the hub's**. The hub refuses both BY NAME rather than rewriting them.

**CI at the close, quoted by SHA (⚖ 52) — ALL SIX WORKFLOWS GREEN at `c7481aed4`.** `unittests`
success on all six matrix legs plus hosting; `Test ALTTP Spoiler & Frontend Regression`, `CodeQL`,
`Build and Publish Docker Images`, `Deploy to GitHub Pages` and `JavaScript Unit Tests` all success —
the last one's browser-gate shards include `maze-lab +14`, so that gate passed in CI as well as on the
box. `ci-vitest-summary.mjs c7481aed4` → run **33956151040 success** — `suite: vitest (unfiltered)`
**434/13229** (13,221 passed | 8 skipped | **0 failed**), slow battery 12/217. Baseline at H4a's close
(`0f480500d`) was 433/13191, 13,183 passed.

⛓⛓ **The +38 RECONCILES EXACTLY, and the 38th row is one I did not write** — derived by diffing the
two runs' own per-file tables, not typed: `rulesDocOps` +10, `rulesEditAdapter` +1,
`regionRoundTrip` +26 (the one new FILE, 433 → 434) and **`mazeSerializer.test.js` 70 → 71**. That
last one is its `it.each(MAZE_FILES)` — a roster read off the `mazeRoom/` DIRECTORY asserting H3b's
law that no maze file imports `procgenPipelineEngine`; `mazeRegionRoundTrip.js` enrolled in it by
existing, and passes. ⇒ a slice that adds a file to a scanned directory moves a suite count it never
edited, and deriving the delta is what turns that from a surprise into a confirmation.

**NEXT = H4c** (reverse links from `lab.html` / `watch.html` / the bounce editor), then H5.

**H4b VERIFIED by the planner 2026-09-05** (`c7481aed4` on origin/main; `regionRoundTrip.js` + 26 rows; the
slot declared on maze, bounce and flash_seedling; the generated matrix and the registry doc carry it; the hub
imports no substrate module; `maze-lab` 265/0 and `procgen-lab-hosting` 66/0 unmoved; CI in flight at the
report, watched by H4b). H4b's headline correction to the brief: the write-back cannot be "re-derive the rules
from the tiles" — grid-level gating is not drawn in a region's tiles, so the BASELINE mechanism ships instead
(the door opens only where an unedited round trip is a no-op; a rule moves only where the baseline reproduces
the document's own). **⚖ TWO OPEN for the user** (asked 2026-09-05): (a) the ten `seedling_atlas_maze` rooms
are refused (atlas-derived payloads lack the serializer's fields); (b) `assembleBounceRegionFromLevel` names
every exit `side_exit_<side>` — a defect in the PIPELINE's own Edit ▸ path as well as the hub's. **H4c
LAUNCHED 2026-09-05** as `apworld-hub-sliceH4c` (Opus, kickoff `NewDocs/plans/apworld-hub-sliceH4c-prompt.md`):
"Open in APWorld Editor" from the lab pages (an eighth lab-protocol name, page→host, forwarded to
`apworldEditor:loadRules`; hidden when standalone) and from the bounce editor (`apworldEditor:selectRegion`).

**⚖ RULED 2026-09-05 (user, on H4b's two questions):** (a) **the atlas derivation will emit the serializer's
shape** so the ten `seedling_atlas_maze` rooms round-trip like grown ones — slice **H6a**, atlas-side, under
the atlas byte gates (a moved pin is a ⚖ 49-class re-record question); (b) **fix `assembleBounceRegionFromLevel`
to preserve authored exit ids** — slice **H6b**, after H5. H4b's CI closed all six green at `c7481aed4`
(suite 13,221/8/0; +38 rows, one of them from a directory-rostered scan the slice never edited). Ladder:
H4c (live) → H5 → H6a → H6b.

### ⇒ H4c AS BUILT (Opus `apworld-hub-sliceH4c`, 2026-09-05, from `b518f75a5`) — plan §18

Commits: `d73aa7823` (the eighth protocol name) · `5c0fe94f4` (the lab pages' button, in the SHARED mount) ·
`818137b3b` (the bounce editor's link and the hub's answer) · `4871e0d2b` (one label for six doors, the
hosting gate's claim 12, the docs).

**The two shapes, and the choice is not a preference.** A page across an iframe boundary needs a lab-protocol
name — there is no app `eventBus` there, and `apworldEditor:loadRules` exists only on the host side — so the
vocabulary gained its EIGHTH name, `procgenLab:openInApworldEditor {substrate, iframeId, rules, source}`,
page→host, forwarded by `procgenLabPanel` onto `apworldEditor:loadRules` + `ui:activatePanel` (in that order;
reversed, the hub comes forward showing what it held a moment ago). A panel in the SAME app needs none, so
the bounce editor publishes `apworldEditor:selectRegion {region, player?}` and the hub answers on the document
it already holds. **H5's sidecar-block links are all the second shape.**

**⛓⛓⛓ THE BRIEF'S TWO PAGE BUTTONS ARE ONE BUTTON.** `lab.html`'s SET arm and `watch.html`'s SET arm both bind
`procgenCore/setEditorView.mountSetEditor`, and the compile the brief names on both sides IS
`adapterFns.rulesJsonOf` — which that mount already runs for the REPORT. ⇒ one optional mount option
(`apworldEditor: {available, open}`), one handler beside `editDownloadRules`, one `<button>` per page; each
page supplies only its own bridge and its own provenance string. ⛓ **And no wasm gate is owed**: the compile is
node-side (the hosting gate, headless Chromium on this box, pressed it and got `Seedling Set` / 5 regions).

**⛔ It hands over the REPORT's `rules`, never a second compile** — a second answer to *"what does this page
hold"* on the far side of a postMessage boundary, where the two can never be compared.
**⛔ HIDDEN, not disabled, standalone** — no app to open, and the transport is not even fetched. The DISABLED
half is `reportOver`'s `download.rules.allowed`, unchanged: a graph that does not close has no document to hand.

**One label, six doors: "Open in APWorld Editor"** — Presets (H2 already said it), the pipeline and the marking
tool (renamed from *"Edit in"*; `check-region-marking-tool.mjs` clicks that text twice and moved with them),
both lab pages, the bounce editor. Zero `Edit in APWorld Editor` left outside two historical planning docs.

**Two defects the rows found, both invisible in the shipped build until driven:**
(a) **the hub's slot switch had to be `_chosenPlayer`, not `playerId`** — `_syncPlayer()` re-derives `playerId`
on every render and honours only a deliberate pick, so the door's own final `_render()` would have undone the
move while the status line reported it; (b) **the panel must CATCH its validator's refusal and print it** —
`eventBus.publish` try/catches every subscriber and logs, so a throw would forward nothing AND say nothing.

**⛑ And two rows that measured the wrong thing first.** The in-app row asserted *"the hub opened on
slot 1"* and got **4** — the hub panel is a SINGLETON that outlives every row in its file, and an
earlier row's deliberate slot pick survives on `_chosenPlayer` whenever the next document carries
that slot. It reads the shown slot and picks its switch-target off the document now, naming no
number. And one row could not see its own mutant: *"No host link ⇒ `hidden` is true"* stayed GREEN under
`btn.disabled = !here`, because the mount's WIRING sets `hidden = true` once before any paint. The claim is the
TRANSITION, both directions. Five mutants driven, all red.

**Gates.** `check-procgen-lab-hosting` **66 → 78 PASS / 0 FAIL** (claim 9 gains the standalone-hidden half;
CLAIM 12 drives the chain on TWO documents — the unwired maze pack shows the button DISABLED with
`reportOver`'s own sentence and refuses the press, the LINKED Seedling set shows it ENABLED and one press ends
as a hub session tagged `hand-off · the Seedling watch page (SET arm)`; either document alone could not tell
"reads `download.rules.allowed`" from "always enabled"). `check-maze-lab` **265/0 UNMOVED**. In-app `--batch=fast` **79/79** (was 78/78); `compare-runs` = `ADDED (1)`
and nothing else. Bounded vitest
`procgenCore/ procgenLabPanel/ apworldEditor/ bounceRegionEditor/` **1568/1568**; `presets/ procgenPipeline/
regionMarkingTool/` **902/902**; `procgenDocs/` **452/452**; `lintGateLabels` 14/14; `check-procgen-docs`
ALL CHECKS PASSED. **`lint-gate-labels.allow.json` SHRANK 85 → 84** — the trap's order kept (interpolate the
NAME first, `--write-allow` the ASSERTION second). Docs: `modules/apworldEditor.md` (the six-door table),
`procgen/maze.md`, `procgen/architecture.md` (W3 added no word, this did, and why), `seedling-bot.md`,
`procgenLabPanel/README.md`; the link census moved 223 → 225 with `repo` 32 → 34 (that page is not one of the
seventeen the viewer lists — the resolver working).

**CI at the close, quoted by SHA (⚖ 52) — ALL SIX WORKFLOWS GREEN at `1413efc4e`.** `unittests`, ALTTP
regression, CodeQL, Docker, Pages and `JavaScript Unit Tests` all success — the last one's browser-gate shards
run `procgen-lab-hosting` and `maze-lab` off the same roster this slice moved, so CLAIM 12 passed on a RUNNER
too. `ci-vitest-summary.mjs 1413efc4e` → run **33974257917 success** — `suite: vitest (unfiltered)`
**435/13256** (13,248 passed | 8 skipped | 0 failed), slow battery 12/217. Baseline `c7481aed4` = 434/13229,
13,221. ⛓⛓ **The +27 reconciles exactly and nothing in it is a row I did not write** — derived by diffing the
two runs' own per-file tables: `labProtocol` 61→70 (+9) · `setEditorView` **42→47** (+5) · `procgenLabPanel`
27→30 (+3) · `reverseLinks` —→10 (+10, the one new FILE, 434→435). ⛑ **And that exposed a TYPED number in this
slice's own commit message**: `5c0fe94f4` says `setEditorView` 43→47; CI says 42→47. I never ran the pre-edit
file — the baseline was prose, the five new rows are real. Unlike H4b's +38 there is no term from a
directory-rostered scan here: the new file landed under `apworldEditor/`, which no roster scans.

**NEXT = H5** (sidecar block links), then H6a, then H6b. The two ⚖ H4b left were NOT touched, as the kickoff
asked.

**H4c VERIFIED by the planner 2026-09-05** (`1413efc4e` on origin/main; the eighth lab-protocol name, the
shared mount option on `setEditorView`, the bounce editor's door, zero "Edit in APWorld Editor" left in code;
`check-procgen-lab-hosting` 66 → 78, `check-maze-lab` 265/0 unmoved; CI in flight, watched by H4c). H4c's
design finding: the two lab pages' buttons are ONE, because both SET arms bind the same shared mount — so
anything both lab pages should gain belongs in `procgenCore/setEditorView`, not in two page files. It also
fixed a bus defect (`eventBus.publish` swallowed a subscriber's throw silently). **H5 LAUNCHED 2026-09-05** as
`apworld-hub-sliceH5` (Opus, kickoff `NewDocs/plans/apworld-hub-sliceH5-prompt.md`): the sidecar-block links
filling H1's empty `DOCUMENT_KEY_EDITORS` — `region_atlas` → the marking tool with an additive `onSave` (one
op back), `procgen_metadata` → the pipeline through a new `procgenPipeline:loadRules` (a document, not an
op), `loop_costs` → the cost debugger (working-copy intake MEASURED, else "Apply, then open"), `sphere_log`
→ the spoiler checklist, everything else "edited as JSON here" BY NAME; Links-tab parity. After H5: H6a, H6b.

⇒ **H5 AS BUILT 2026-09-05** (`apworld-hub-sliceH5`, Opus, on `main` at `99ce11f5b`; plan §19). H1's empty
`DOCUMENT_KEY_EDITORS` is **FILLED** — five doors, each carrying `label` / `returns` / `note` / `open` /
`panelId`, with the other twenty-nine schema keys saying *"no dedicated editor"* by the ABSENCE of a row
rather than by dropping the key from the tab: `region_atlas` → the marking tool (`op`), `procgen_metadata` →
the pipeline (`document`), `loop_costs` → the cost debugger (`none`), `sphere_log` → the spoiler checklist
(`none`), `preset_sidecars` → the Regions tab's per-region Edit ▸ (`op`). The **Links tab is DERIVED from the
same table** (three rows LEFT `DOCUMENT_LINKS` to make that true), so ⚖ *"even if the current rules.json file
doesn't contain any relevant data for them"* reaches the SAME `open` with the SAME label, asserted in both
directions.

**Six things H5 overturned or found, each measured.** ⛔ **`region_atlas` is a REFERENCE, not an atlas** —
all three committed carriers hold exactly `{atlas_id, game, map_document}` and nothing in the tree maps an
`atlas_id` back to its file, so the door opens the marking tool on the atlas the TOOL holds and the SAVE
writes this document's reference back through the compiler's own `regionAtlasReference` (hoisted out of
`compileRegionAtlas`, pinned byte-equal to a full compile). ⛓ **`open` does NOT return an op** and H1's
docblock said it would — every editor here is a panel, so the op arrives through `onSave(op)`, and `returns`
is what the Document row prints instead. ⛓⛓ **Plan §4's "Apply, then open" is OVERTURNED for the cost
debugger**: `CostPlanner` takes its state manager as a CONSTRUCTOR argument and touches it through exactly
TWO methods over 1,247 lines, so a working copy wears that face by running the same
`StateManager.loadFromJSON` + `getStaticGameData` the worker runs — **4.4 ms / 21.3 ms / 305.7 ms** across
`procgen_maze`, `jta_substrate_test` and `stardew_valley` (the corpus's heaviest), plus a one-time ~117 ms
dynamic import; nothing re-implements the parse. ⛔ Its real cost is the SPHERE LOG, not the topology: a
working copy is planned against its own embedded `sphere_log` or not at all, else you MANUFACTURE the panel's
existing *"ALL n sphere-log locations are not in this player's world"* warning (26 presets embed a log, 12
carry `loop_costs`, TEN carry both). ⛓ **`procgenPipeline:loadRules` is a SECOND channel beside
`stateManager:rawJsonDataLoaded` on purpose** — applied vs never-applied — and adoption turns the panel's
"Use currently-loaded rules.json" checkbox OFF; its three answers are DERIVED from a new
`sphereRebuildRefusal`, which shares `SPHERE_REBUILD_REFUSALS` with `rebuildEnvelopeFromRulesJson`'s throws,
so the panel QUOTES the engine rather than summarising it ("zone world" is NOT one of the three: a zone world
still realises top-down). ⛓ Measured: `procgen_topdown/AP_*` is the appendable family; **`procgen_maze/AP_1`
— the brief's named fixture — is `grid-growth` with no sphere tree, so its answer is TOP-DOWN.**

**⛔⛔ TWO DEFECTS IN ALREADY-SHIPPED CODE, both about a button that does nothing and says nothing.**
(1) `apworldEditor` **never registered `ui:activatePanel`**; `eventBus.publish` refuses an unregistered
publisher — warns and RETURNS — so **H1's Links tab Open and H3's "Open region graph" have done NOTHING since
they shipped**, and neither in-app row pressed them (both assert the ROWS the tabs draw). A row now scans the
panel's own `publish('…')` sites against `register()`. (2) **Two Links rows point at modules
`frontend/module-configs/modules.json` DISABLES** — `regionMarkingTool` and `editor`, 13 of its 73 modules
are off in the default mode — so `ui:activatePanel` reached a `panelManager` that warns and returns. Every
door now declares its `panelId` and the hub asks `centralRegistry.getAllPanelComponents()`; absent ⇒ the
button is SHOWN, DISABLED, with the panel and the config file in its `title`. ⛔ The default config was NOT
changed: turning a panel on for every user is ⚖ the user's, and it is open in plan §19.6.

**⛑ And `check-region-marking-tool.mjs` was ALREADY RED at HEAD.** H4c (`d73aa7823`) changed the hub's
module stash to `{jsonData, source}` so every intake could name its door; that gate's Phase F still asked for
`.regions` on the wrapper and had been returning `null` ever since. It is not one of the nine gates H4c's
§18.3 quotes, so nothing looked. Fixed here (one line) — **45 checks with one FAILING → 50 PASS / 0 FAIL**,
the five new ones being Phase F2, which drives the marking tool's new `onSave` seam end to end under
`?mode=flash` (the only mode where the tool and the hub's module both exist).

**Gates.** `apworldEditor/` **8 files / 191** (`documentKeys` 21 → **29**, `documentLinks` 10 → **15**) ·
`loopsCostDebugger/` **2 / 24** (new `documentStateManager` **12**) · `sphereSteps` 47 → **50** ·
`procgenPipelineUI` 7 → **15** · `procgenPipelineEngine` **203 unmoved** · `regionAtlasCompiler` 59 → **63** ·
`lintGateLabels` **14** · `check-region-marking-tool` **50/0** · `check-procgen-docs` ALL CHECKS PASSED ·
`generate-procgen-reference` re-run, 0 FINDINGS · `procgenDocs/` **452**. Four mutants driven, none committed.
Docs: `modules/apworldEditor.md`'s `editor` slot section rewritten, the Links tab section, the Events table.
Traps **1206–1211**.

**CI at `6a4c38423` — MEASURED, ALL SIX WORKFLOWS GREEN (⚖ 52, plan §19.7).** `unittests` (the job carrying
`test_schema_validation.py` over every committed preset), ALTTP regression, CodeQL, Docker, Pages, and
`JavaScript Unit Tests` (run **33977025059**) with **all five of its jobs success** — the Vitest job, the
shard plan, and the `maze-lab +14`, `plan-seedling-r7-ends-meet +8` and `seedling-wasm-element` browser-gate
shards — so `check-maze-lab` and `check-procgen-lab-hosting` are green on a RUNNER at this head.
`suite: vitest (unfiltered)`
**436 / 13,296** (13,288 passed | 8 skipped | 0 failed), slow battery 12/217 unmoved; baseline `074684c0a` =
435 / 13,260.

⛑⛑ **AND THE EXPECTATION THIS SESSION RECORDED BEFORE THE RUN LANDED WAS WRONG — +40 claimed, +36 measured —
which is exactly why it was written down as an expectation with its per-file terms.** Every term was measured
and correct; the error is that `regionAtlasCompiler.test.js` (+4) shipped in `5410e56bc`, which H4c's
`git add -A` (trap 1200) left as an **ANCESTOR of the baseline**, so summing every file this slice wrote
double-counted four rows already banked there. 40 − 4 = 36; 13,260 + 36 = 13,296 to the row, 435 + 1 = 436
files. Skips unmoved at 8. **Nothing in the suite moved that is not a row this slice wrote.** ⇒ **trap 1212**:
a delta is `HEAD − BASELINE`, so run `git merge-base --is-ancestor <your first commit> <baseline>` before
summing your files — the sweep bit twice, once on attribution and once on arithmetic.

**NEXT = H6a** (the atlas derivation emitting the serializer's shape — and the natural home for an atlas
RESOLVER, which is the missing half of H5's `region_atlas` door), then **H6b**. ⚖ open for the user in plan
§19.6: enable `regionMarkingTool`/`editor` in the default `modules.json`?; the `loop_costs` WRITE-BACK
(`CostPlanner.getCostData()` is already the block's shape and all twelve committed carriers are EMPTY); the
marking tool's hardcoded `MAP_DOCUMENT_URL` as a fourth spelling of `flashPanel/mapDocumentPath`.

**H5 VERIFIED by the planner 2026-09-05** (`6a4c38423` on origin/main; the five doors in `DOCUMENT_KEY_EDITORS`
with a `returns` field each; `documentStateManager.js` — the cost debugger takes a working copy in 4–306 ms;
`procgenPipeline:loadRules`; CI in flight, watched by H5). H5 found two doors that had done NOTHING since
they shipped: the hub never registered `ui:activatePanel` (the bus warns and returns), so H1's Links Open and
H3's "Open region graph" were inert until H5 registered it and added a publish-vs-register scan row. Also:
`region_atlas` is a REFERENCE nothing in the tree resolves; two Links rows point at modules the default
config disables. **⚖ RULED 2026-09-05 (user):** the marking tool is EXPERIMENTAL — not enabled; review what
it does and how it connects before deciding; the plain editor is not needed. `loop_costs` write-back needs
investigation and discussion (the cost generator predates procgen) — **loop costs, or the marking tool, is
the LAST feature integrated with the editor**. The atlas resolver waits on the marking-tool review. ⇒ H6a is
PARKED behind that review; two REVIEWS are queued as planning conversations (marking tool ↔ editor; loop
costs ↔ procgen ↔ editor). Next slice = **H6b** (bounce exit ids), launched after H5's CI closes.

**H5 CI CLOSED green at `6a4c38423`** (suite 13,288/8/0 = +36 over `074684c0a`, every term a row H5 wrote;
the first-recorded +40 double-counted four rows a swept commit had already banked — a delta is HEAD − BASELINE,
trap 1212). **H6b LAUNCHED 2026-09-05** as `apworld-hub-sliceH6b` (Opus, kickoff
`NewDocs/plans/apworld-hub-sliceH6b-prompt.md`): the bounce assembler keeps authored exit ids, the last coded
rung; after it, the two planning reviews (marking tool ↔ editor; loop costs ↔ procgen ↔ editor).

⇒ **H6b AS BUILT 2026-09-05** (`apworld-hub-sliceH6b`, Opus, on `main` at `5314b0753`; plan §20). Commits
`f45b82789` (assembler + shared reader + rows) · `8fbf6e523` (hub rows, unit + in-app) · `057afa5db`
(`bounce.md` + the generator run). **The bounce door: 15/25 → 25/25**, movable endpoints 3,018 → 3,048
corpus-wide with **841 FROZEN unchanged** — so the 30 new ones are rules the door can prove it authored, not
rules it stopped refusing. Maze unmoved at 1,036/1,046.

**⛔ IT WAS TWO DEFECTS, NOT ONE, AND THE SECOND WAS INVISIBLE.** §17 named the byte half (the minted name
moves `sidePortals`, so check (1) refuses). Reading the assembler found the worse half: `derived` is keyed by
the LEVEL's own portal ids, so `derived.exits['side_exit_N']` missed and the deliberate warn-but-allow
`?? []` turned a perfectly good `exit_up` exit into **empty minimal sets — `False_`, an exit nobody can ever
take**. The pipeline's own Edit ▸ was not merely renaming a portal on save; it was writing an unreachable
exit and leaving ④'s oracle to notice. Nothing surfaced it, because the branch it lands in is legitimate.
⇒ the row asserts BOTH halves; a name-only assertion would pass a name-only fix.

**Three more things measured.** (a) ⛑ **Three of the four `dump-*-byteidentity.mjs` are VACUOUS here** —
probed with a module-scope throw (trap 1173): sphere REACHES the assembler (rc 1, 2 hits) and its md5 is
UNMOVED; top-down, maze and spiral all run **green with the assembler throwing**, so their unmoved md5s prove
nothing and are not quoted. The top-down one is the trap: it dumps a "mixed maze+bounce" layout and really
does contain bounce levels with portals, but those arrive through `assembleZoneRegion`/library-entry
instantiation, never through a re-generation. (b) **Neither `dump-bounce-region.js` nor `dump-bounce-level.js`
is a byte-identity oracle** — a text report and an ASCII trajectory renderer, no stored expectation, no test,
gate or workflow invoking either (the kickoff's parenthetical implied otherwise). (c) **`portalSide` reads the
ARROW before the minted name, and that is a measurement**: `bounceLibraryEntry` relabels a captured portal by
re-pointing `direction` and leaving the id, so a stale `side_exit_N` can sit on E. Over all 25 committed
bounce levels + 36 generated portals, 0 lack a `direction` and 0 disagree with their id — the orders differ
only on a relabelled entry.

**A row had to be ADDED, not just flipped.** The H4b bounce refusal was `regionRoundTrip.test.js`'s ONLY
driver of check (1) ("an unedited save must not move a byte"); with bounce at 25/25 a mutant deleting check
(1) would have stayed green. The ten `seedling_atlas_maze` rooms still fail it, and one drives it now — in
the unit file and in the in-app row. ⚖ **H6a will take that subject away too**, and then the corpus has no
check-(1) refusal left; that is H6a's to answer for.

**Gates.** sphere byte-identity md5 unmoved · `check-region-step-editing.mjs` A–N identical, ALL OK ·
bounded vitest 1,246/1,246 (`bounceDemo`, `bounceRegionEditor`, `apworldEditor`, `procgenPipeline`) · bounce
`.slow` 102/102 · `procgenDocs/` 452/452 with `--check` at 0 · in-app `test-substrates --batch=fast`
**83/83**, `compare-runs` "No differences in status, roster, or duration", browser log free of throws.
Mutant (restore the mint): 12/13, red exactly on the `spring_gap` row.
⚠ **A PRE-EXISTING RED, not this slice's:** `scripts/procgen/check-rule-gated-portals.mjs` times out waiting
for the pipeline panel's Generate button (`:153`). CONTROLLED — the same failure, byte for byte, with the four
source files checked out at `f45b82789~1`. It is in no gate battery and no CI job; nobody had run it.

**⚖ open for the user (plan §20.6):** (1) whether the `False_`-exit finding deserves a reader-facing note —
any bounce world saved through Edit ▸ on an `exit_up` region carries an unreachable exit (nothing committed
is in that state); (2) check (1) losing its last corpus subject after H6a; (3) the pre-existing
`check-rule-gated-portals` red. **The coded ladder ENDS HERE** — next are the two planning reviews (marking
tool ↔ editor; loop costs ↔ procgen ↔ editor), with H6a parked behind the first.

**H6b VERIFIED by the planner 2026-09-05** (`ef2f40efe` on origin/main; bounce door 25/25; CI in flight,
watched by H6b). H6b found the ruled defect was TWO: the pipeline's own bounce Edit ▸ had been writing an
UNREACHABLE exit (`False_`) on save for authored-id portals, invisible because the branch it landed in is
legitimate. **THE CODED LADDER H0…H6b IS COMPLETE.** Residue, ranked by H6b: a reader-facing note on the
pre-fix `False_` exit (nothing committed is in that state); check (1) of the round-trip suite loses its last
subject when H6a lands; and the procgen `verify-*.mjs` tier has no battery — three unwatched reds/inerts
surfaced during this arc — a SURVEY slice, not a feature, is what one more slice should buy. Open by ⚖:
reviews R1 (marking tool ↔ editor) and R2 (loop costs ↔ procgen ↔ editor), one of them LAST; H6a parked
behind R1.

**⚖ RULED 2026-09-05 (user, on the residue): "The verify-script survey."** An Opus SURVEY session
(`procgen-verify-tier-survey`, kickoff `NewDocs/plans/procgen-verify-tier-survey-prompt.md`; no product code;
one tracked table `CC/docs/procgen-verify-tier.md`) will join the 50 `verify-*` + 34 `check-*` scripts against
the batteries that exist (the derived `gateRoster`, `ci-gates`, `standing-values.json` — 28 stems named — and
the 5 scripts CI names by path), run everything outside them, and classify each as gate / report-that-cannot-
fail / red (pre-existing or new) / crash / timeout / needs-Windows / stale. Launches when H6b's CI closes and its
session reads idle. The two reviews (marking tool; loop costs) remain queued, one of them LAST; H6a parked.

**H6b CI CLOSED green at `ef2f40efe`** (run 33979314466): suite **436 / 13,301** (13,293 passed | 8 skipped |
0 failed) over H5's baseline `6a4c38423` = 436 / 13,296 ⇒ **+5 rows, +0 files**, skips unmoved, slow battery
12/217 unmoved. Attributed per file by checking each out at both SHAs and running it alone:
`zoneIntegration.test.js` **9 → 13** (+4) · `regionRoundTrip.test.js` 26 → 27 (+1). **Nothing in the suite
moved that is not a row this slice wrote.** ⛑ The expectation recorded before the run said **+4** and was
wrong by one — I TYPED `10 → 13 = +3` instead of deriving it, and got the baseline wrong (9, not 10 — the
brief's "10" is `deriveRules`) AND my own addition wrong (4 rows, not 3), which did not cancel. Straight
`feedback_a_count_in_prose_is_unfalsifiable`; it was catchable only because the expectation was written with
its terms. ⚠ Instrument note: `ci-vitest-summary.mjs` re-execs with `stdio: 'inherit'`, so under a detached
`setsid nohup … > log` it wrote an EMPTY file and exited **0** — a clean exit with no summary is not a verdict.

**H6b CI CLOSED green at `ef2f40efe`** (suite 13,293/8/0 = +5, both terms derived per file; `main` at
`f29c74243`; the session read idle before the successor launched). **SURVEY LAUNCHED 2026-09-05** as
`procgen-verify-tier-survey` (Opus, no product code; kickoff `NewDocs/plans/procgen-verify-tier-survey-prompt.md`;
output `CC/docs/procgen-verify-tier.md`).

**SURVEY DONE 2026-09-05** (`1f9b437cc`, `CC/docs/procgen-verify-tier.md`, 62 scripts): **59 of 62 are in NO
battery, and the exclusion is a NAMING RULE** — `gateRoster.isGateFile` (`/^check-[a-z0-9-]+\.mjs$/`),
`reachClosure.js:813` and `ci-gates.mjs` all select by the `check-` prefix, so no `verify-*` can join by
declaring anything; `check-procgen-help` and `instruments.js` COVER all 50 (hygiene + catalogue) but nothing
RUNS them. 8 reds: 6 pre-existing at `697c94ee6` (`check-item-channels`, `check-maze-loop-mana`,
`check-omsi-mana-leg`, `verify-dj-real-embed`, `verify-bot-playthrough`, `check-rule-gated-portals`), 1 NEW
(`check-maze-consumable-tiles` — a GENERATOR-OUTPUT drift proved by cross-control: HEAD tree + pre-arc
fixture PASSES; the documented regen command now emits md5 `2ef8f4ab`→`40e87ff5`), 1 inconclusive
(`check-atlas-sphere-roundtrip`, same byte-identity claim). Correlation: 6 of the 23 scripts referenced by
nothing but the catch-all registries are red (26%) vs 2 of 27 (7%). **⚖ RULED 2026-09-05 (user):** first
slice = **chase the generator-output drift** (node-only bisect of `697c94ee6..HEAD` on the fixture md5, then
intended-re-pin vs defect); then triage the six pre-existing reds; then the **RENAME** (gate-shaped `verify-*`
→ `check-`, report-shaped → `dump-`/`report-`) so the three mechanisms adopt them for free — ruled YES, after
the drift and the triage.

**V1 LAUNCHED 2026-09-05** as `procgen-drift-bisect` (Opus; kickoff `NewDocs/plans/procgen-drift-bisect-prompt.md`;
the survey session read idle first): a node-only bisect of the 45 code commits in `697c94ee6..HEAD` on the
`maze_consumable_test` emission md5, in throwaway worktrees with the submodule matched per SHA (the gitlink
moved once, at `9035a46a6`); a by-path diff of the two emissions; the ruling intended-vs-defect on evidence;
and `check-atlas-sphere-roundtrip` resolved in the primary tree. Then V2 (the six pre-existing reds), V3
(the rename).

**⇒ V1 AS BUILT 2026-09-05** (`e0408c3b4` fix + `6f9771d6c` record; "V1 as built" section in
`CC/docs/procgen-verify-tier.md`). ⛔ **The drift V1 was launched to chase does not exist, and the survey's
row above is superseded.** `spiral-step.js run`'s only nondeterminism is `generatedAt`; normalise it away and
the pre-arc tree and HEAD emit the SAME document (`9d529f46…`, 5623 bytes canonical). The survey compared RAW
file bytes, which carry that wall clock, so `2ef8f4ab`→`40e87ff5` was never evidence of anything. No bisect
was possible: there was nothing to bisect.
`check-maze-consumable-tiles` moves **NEW → PRE-EXISTING** (making it **seven** pre-existing reds and an
empty "new" column): the script hardcodes `localhost:8000`, so the survey's worktree "control" drove HEAD's
frontend anyway; given its own server on :8001 the pre-arc tree fails on the same assertion. The mechanism is
a race in the INSTRUMENT — its boot gate waited for the omsi ENGINE (`resources.gold` readable) when what has
to be ready is the omsi BRIDGE's `crossSubstrate:itemGranted` subscription, which lands ~5 s after the frame
while the bot reaches the tile in ~1 s; the grant is published into that gap and, per `iframeHandshake.js`,
*"a publish before [IFRAME_APP_READY] reaches nobody and is not even queued"*. One `waitFor` on the
subscription: **3/3 FAIL before, 4/4 `VERIFY MAZE CONSUMABLE TILES: OK` after.**
**The REAL generator-output drift is the OTHER script**, which the survey had left inconclusive.
`check-atlas-sphere-roundtrip` runs 67 PASS / 1 FAIL in the primary tree; the byte diff is exactly six
values (four `tiles` `1→0`, `entrance.x` and `exits[2].x` `4→2`), bisected in 11 steps over 1568 commits to
**`c8447dd56`** (2026-08-24), which re-pinned `frontend/atlas-pools/seedling-atlas-pool.json` — the same four
tiles and the same `4→2`, 1:1 — without regenerating the pool's second consumer. **Ruling: (a) INTENDED.**
The commit's own *"the atlas half was already byte-identical"* is true of `seedling_playthrough`, not of
`seedling_atlas_sphere`. The committed preset has been **12 days stale**; the script is right.
⚖ **FOR THE USER:** regenerating `frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json` moves six
values in a TRACKED file (a ⚖ 49-class re-record) — **not done here**. Measured: exactly ONE committed preset
is affected (`seedling_atlas_maze` already carries the new pool; `seedling_atlas` holds an `atlas_ref`), and
no `check-*` gate names `seedling_atlas_sphere` at all. ⚑ Also unattributed and left for V2:
`check-procgen-help.mjs` is `2 CHECK(S) FAILED` at HEAD (`measure-apworld-raw-view`, `shot-loaded-composite-map`) —
neither touched by V1, and the survey never ran that gate, so there is no prior measurement.

**V1 VERIFIED by the planner 2026-09-05** (`e0408c3b4` fix · `6f9771d6c` table · `e104f62e3` record, all
on origin/main). V1 overturned the survey twice: the "generator-output drift" did not exist — the survey
compared raw bytes carrying `generatedAt`, and pre-arc and HEAD emit the same normalised document
(`9d529f46…`); and the maze red was PRE-EXISTING (a worktree "control" still drove the primary tree's
frontend through `localhost:8000`). The maze red was a RACE IN THE INSTRUMENT (the boot gate proved the omsi
GAME loaded, not that the omsi BRIDGE had subscribed; a grant published into that ~5 s gap is dropped silently
by the iframe handshake's own contract) — fixed, 4/4 green. The REAL drift is `check-atlas-sphere-roundtrip`:
`frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json` is 12 days stale against the atlas pool —
`c8447dd56` (2026-08-24) re-pinned the pool (four tiles + one entrance x 4→2) and regenerated
`seedling_playthrough` but not this second consumer; verified here: `seedling_atlas_maze` carries x=2,
`seedling_atlas_sphere` x=4. **⚖ RULED 2026-09-05 (user): REGENERATE it** (a ⚖ 49-class re-record, six
values, cause = `c8447dd56`). Also left for V2: `check-procgen-help.mjs` is 2 CHECKS FAILED at HEAD
(`measure-apworld-raw-view.mjs` import side effect; `shot-loaded-composite-map.mjs` help + import). Ladder:
**V2** = Task 0 the regeneration; the six remaining pre-existing reds; the two help-gate rows → **V3** the
rename. V2 launches after V1's CI closes and its session reads idle.

**V2 LAUNCHED 2026-09-05** as `procgen-red-triage` (Opus; kickoff `NewDocs/plans/procgen-red-triage-prompt.md`;
V1's session read idle first): Task 0 the ⚖-ruled regeneration of `seedling_atlas_sphere` (six values, cause
`c8447dd56`, whole `pytest` owed); the six pre-existing reds each ruled INSTRUMENT (fix) / SUBJECT (⚖, stop) /
STALE (name the commit) on evidence; the two `check-procgen-help` rows. Then V3, the rename.

**⇒ V2 AS BUILT 2026-09-05** (`edf75e100` regeneration · `604c4f29e` help gate · `2a5957377`
rule-gated-portals · `d05532c4e` maze-loop-mana · `81dfc0041` item-channels · `75d96d159` record; the
"V2 as built" section in `CC/docs/procgen-verify-tier.md` carries every measurement).

**Task 0 — the ⚖ regeneration is DONE.** `frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json`
regenerated with the command its own README and the verify script both run — ⛑ the kickoff pointed at
`:220-228`, which is the THROWAWAY world's `world_generator`+`Generate.py` path; the committed preset's
regeneration is the `dump-sphere-growth.js` call at `:287`. **Exactly the six values V1 named moved**, no
keys added or removed, file length unchanged at 124 377 bytes. `check-atlas-sphere-roundtrip` **68 PASS /
0 FAIL** (twice); the WHOLE `pytest test test_json worlds` **1507 passed, 2 skipped, 21 299 subtests**
(492 s); strict schema green; `preset_files.json` unchanged; no pin names the preset (re-derived).
⚠ A full `pytest` WRITES INTO THE TREE — it appended an APQuest seed to the tracked `preset_files.json` and
left `frontend/presets/apquest/AP_077581764…/` untracked. Restored; in no commit here.

**Task 1 — six verdicts, and the survey's CLUSTER IS DISSOLVED.** The three "clustering" scripts have three
unrelated causes, and V1's grant-before-subscribe race — the brief's leading hypothesis — explains **none**
of them.
- `check-item-channels` **INSTRUMENT, and never a standing red**: 5 red / 2 green solo at HEAD. The "leak"
  is the check losing a race to the task's OWN auto-repeat (`maxReps` 10) — `omsi gold 0 -> 2` is rep 1's
  scheduled award arriving on time, and the counter reads `reps=2` at the failure. FIXED
  (`setQueueRepeatCount(1)`, one atomic read, each claim asserted at its own rep): **3/3 green**.
- `check-maze-loop-mana` **INSTRUMENT** — its uncommitted fixture was ABSENT, so the page loaded no world
  and died on a line that reads like an app defect. Regenerated, that assertion passes; a preflight now
  names the prerequisite (driven with the fixture moved aside). ⛑ This also settles the `?mode=loops`
  question: unrelated — `modes.json:233` really defines that mode.
- `check-omsi-mana-leg` **INSTRUMENT, named not fixed**: it drives UNPARKED live play, which `f2e392df1`
  (2026-07-24, park-gated stepping) froze BY DESIGN one week after the script was written. 304 messages,
  **304 `skippedGated`, 0 `ticksStepped`**, `step gate: CLOSED (enforced=true, livePlay=none)`.
- `check-rule-gated-portals` **INSTRUMENT, stale TWICE from one day** — `85c1c3ba1` (sphere mode's button
  became "Run all"; it re-pointed the SIBLING script in the same commit, not this one) and `06eafea4e` (the
  free arrow left the pool for the substrate hook), both 2026-06-19. FIXED; `buildWorld` now CALLS
  `collectSphereGrowthPrep` rather than copying it. **The app's authored-lock claim is GREEN and had never
  been witnessed**: `PORTAL UNLOCKED: gate_rules re-evaluated on the snapshot update`.
- `verify-dj-real-embed` and `verify-bot-playthrough` **STALE** — `bounce_dj_worldgen`,
  `bounce_sphere_worldgen`, `bounce_mixed_worldgen` were all deleted at **`ccfc5bad0`** (2026-06-26,
  *"drops … the `*_worldgen` preset dirs that the workflow does not produce"*). `?game=` resolves through
  `preset_files.json`, so a missing name loads no world at all. ⛔ Neither script deleted — V3 owns names.

**Task 2 — `check-procgen-help.mjs` is `ALL PASS`** (267 instruments; 252 baselined). Both reds were the hub
arc's and both postdate the baseline's `measuredAt`, so the gate red them BY NAME — the gate working. Fixed
**to the law, not baselined**: each file's driving half moved into `main()` behind `isEntryPoint`.
`shot-loaded-composite-map.mjs` had no `argvHelp` at all (so `--help` ran the whole shot) and
`measure-apworld-raw-view.mjs`'s bare import TOOK THE REAL BOX and launched a browser. ⚠
`check-seedling-ap-placement`'s row is green because it is BASELINED (hand-interpolated at P2), not fixed.

⚖ **THREE FOR THE USER.**
1. **SUBJECT — loops halts at the first maze action.** With `maze_loop_worldgen` present the queue builds
   (6 actions) and `startProcessing()` starts (`isProcessing` true, index 0 → 1), then within 5 s
   `isProcessing` is false and never resumes: index frozen at 1, mana 100/100, `manaEvents` `[100]`, XP 0,
   for 60–180 s. Measured twice (script + standalone probe). The app is not fixed here per the brief.
2. **`check-rule-gated-portals`' fourth leg.** The no-input climb does not reach the CORRECTLY-UNLOCKED
   portal: `CLIMB REACHED: entrance → b0 → b1 → b2`, then it bounces on `b2` for ~85 s holding both arrows.
   The seed scan reasons over the sphere TREE and cannot see physical reachability. Closing it =
   instrument DESIGN (derive per-portal reachability, or drive the hop and gut the claim).
3. **`check-omsi-mana-leg` needs a loops PARK.** Teaching it to park a queue on a manual block in the omsi
   region is instrument design — and ⚖ 1 shows loops halting at the first substrate action anyway, so these
   two are probably one piece of work.

**Ladder: V3 (the rename) is next**, and it inherits two STALE scripts whose subjects no longer exist.

**V2 VERIFIED by the planner 2026-09-05** (`ee4efd74a..84b5e7115`, 9 commits on origin/main; the atlas-sphere
preset regenerated — exactly V1's six values, `entrance.x` now 2, roundtrip 68/0, whole `pytest` 1507/2
skipped; `check-procgen-help` ALL PASS with the two hub scripts fixed to the law). The six reds: four
INSTRUMENT (item-channels — a race with the fixture's own auto-repeat, never a standing red, FIXED;
maze-loop-mana — its uncommitted fixture was ABSENT, FIXED with a preflight; rule-gated-portals — stale twice
from 2026-06-19, FIXED, three legs green; omsi-mana-leg — drives unparked live play that `f2e392df1` froze by
design, NAMED), two STALE (dj-real-embed, bot-playthrough — their worlds deleted at `ccfc5bad0`, 2026-06-26).
The survey's "cluster" dissolved: three unrelated causes. ⚠ A full `pytest` DIRTIES the tree (appends an
APQuest seed to the tracked `preset_files.json` and leaves a preset dir untracked) — restore before staging.
**⚖ RULED 2026-09-05 (user):** (1) the SUBJECT red — **loops HALTS at the first maze location check** (queue
of 6 builds, processing starts, stops within 5 s at index 1, never resumes; two instruments, 60–180 s) — is
**investigated NOW, before the rename**, as a diagnosis slice (fix only if one clear defect); the omsi
mana-leg's "needs a loops park" is read as the same work. (2) `check-rule-gated-portals`' physics leg is
CUT; the witnessed claim (gate rules re-evaluated on the snapshot update) stays — one commit in V3. Ladder:
**V2b** loops-halt diagnosis → **V3** rename (+ the cut).

**V2b LAUNCHED 2026-09-05** as `loops-halt-diagnosis` (Opus; kickoff `NewDocs/plans/loops-halt-diagnosis-prompt.md`;
V2's session read idle first): instrument the eleven `isProcessing`-clearing sites in `loopState.js`, name
the one that fires on the first maze location check and its caller, diff against a green maze loop-mode
row, and rule ONE CLEAR DEFECT (fix, pinned) or DESIGN (stop, ⚖). Then V3 the rename + the portals cut.

**⇒ V2b AS BUILT 2026-09-05** (`78ea0b437`; the "V2b as built" section in `CC/docs/procgen-verify-tier.md`
carries the stacks, the capability table and the discriminator). **DESIGN, not a defect — and V2's own
ruling is OVERTURNED.** The halt reproduced first try headless; a throwaway probe replaced
`loopState.isProcessing` with an accessor and printed the stack of every write. Two writes, 45 ms apart:
`stopProcessing` (`loopState.js:915`) ← `_handleManualRegionEntry` (`:2516`) ← `_processFrame` (`:1220`) —
the M4 block-mode branch for `manual | record`. All three maze blocks resolve to **`record`**: no explicit
mode, so `getBlockMode` falls through to `defaultBlockMode` (`:216`), set to `'record'` by **`47c3a7f346`**
(2026-07-23, loops M4 5/n) — **six days after** the instrument was written (`48458da2bc`, 2026-07-17). And
**`05979752fb`** (2026-07-23, loops M6 2/n) deleted the unconditional delegation dispatch from
`_processFrame`, leaving its tombstone at `:1314`: substrate delegation — the seam this instrument exists to
observe — is reachable **only from a `bot` block** (`loop-recording.md:18,23,34` documents it). Discriminator,
one line changed: with the blocks forced to `bot` the same run gives 11 `manaChanged` events, per-tile
decrements 16.67/13.75×3, XP 16.67/41.25/60, `completed:false`, `loopResetCount` 1 — **every claim the
instrument makes**. It asks for them without asking for the mode that produces them. So
`check-maze-loop-mana.mjs` is a **fourth INSTRUMENT** red and V2's tally becomes **5 INSTRUMENT / 2 STALE /
0 SUBJECT**. Contrast, in one line: `mazeBlockModeTests.js:212` sets `'manual'` explicitly — the green maze
rows are green *because they set a mode*, and **no `scripts/procgen/*.mjs` instrument sets one at all**.
⚖ (a) and ⚖ (c) are **one cause family** (both instruments 2026-07-17; both invalidated by the 2026-07-23/24
park-gating week: `47c3a7f346`, `05979752fb`, `f2e392df1`) with **opposite repairs** — the maze leg must
AVOID the park (set `bot`), the omsi leg must CREATE one (its step gate opens only on `livePlayRegion()`).
**⚖ OPEN FOR THE USER, with the answer already measured:** is *"a maze block parks for live play unless
explicitly set to Bot"* the intended contract? If yes, both ⚖ close in one small instrument-design slice
(three `setBlockMode(r,1,'bot')` calls here; a manual park for omsi). If no, `05979752fb` is the defect and
reverting it re-opens the silent-teleport failure M6 exists to prevent. No product code or instrument was
touched. **V3 (the rename + the portals cut) is unblocked.**

**V2b VERIFIED by the planner 2026-09-05** (`78ea0b437` + `ce7720dfb` on origin/main; docs-only). The loops
halt is loops' OWN M4/M6 PARK: on the first maze action the block's mode resolves to the default `record`
(`loopState.js:216`, flipped 2026-07-23 by `47c3a7f346`), and M4's manual/record branch parks the queue for
live play (`_handleManualRegionEntry:2516` ← `_processFrame:1220`, a direct synchronous call — no bus hop);
M6 (`05979752fb`) made substrate delegation reachable only from a `bot` block, documented in
`loop-recording.md`. The two instruments were written six days earlier and set NO block mode; with
`setBlockMode(…,'bot')` ×3 every claim passes. So V2's SUBJECT ruling is overturned: 5 INSTRUMENT / 2 STALE /
0 SUBJECT. The omsi mana leg shares the cause family with the OPPOSITE repair (it must CREATE a park).
**⚖ RULED 2026-09-05 (user): "a maze block parks for live play unless explicitly set to Bot" is the
INTENDED contract.** ⇒ **V3a** = three instrument-design fixes (maze leg → Bot ×3; omsi leg → a manual park;
`check-rule-gated-portals` physics leg CUT, the witnessed claim kept); **V3b** = the RENAME (gate-shaped
`verify-*` → `check-`, report-shaped → `dump-`/`report-`), its own session because of the pins it moves.

**V3a LAUNCHED 2026-09-05** as `procgen-instrument-fixes` (Opus; kickoff
`NewDocs/plans/procgen-instrument-fixes-prompt.md`; V2b's session read idle first): the maze mana leg sets
Bot ×3, the omsi mana leg creates its park, the portals script drops its physics leg. No app change. Then V3b.

⇒ **V3a AS BUILT 2026-09-05** — three commits on `origin/main`, one per script, **no app code touched**:
`b86580f9ca` portals · `226e397674` maze · `2b8c9be271` omsi. Record: `CC/docs/procgen-verify-tier.md`
§"V3a as built" (and the §(a) reds table gains a fifth column — **all eight survey rows are now accounted
for: 6 fixed instruments, 2 STALE**). All three 3× green solo, quoted with END times and load:
`VERIFY RULE-GATED PORTALS: ALL OK` 27/26/29 s (was ~120 s — the cut leg was ~85 s of it) ·
`VERIFY MAZE LOOP MANA: OK` 13/12/13 s · `VERIFY OMSI MANA LEG: OK (17.0s wall)` 18/18/18 s.
Gates: `check-procgen-help --doors=all` **ALL PASS** (267) · `check-procgen-reference --check`
**ALL CHECKS PASSED** (no docblock first sentence moved, so no generator run was owed) · bounded vitest
**11 files / 526 tests / 0 failed** · in-app `test-substrates --batch=fast` **83/83** with `compare-runs`
reporting **no differences in status, roster, or duration** · ⚖ 52 from CI at the pushed SHA,
`CI vitest @ 2b8c9be27 — run 33995895019 success`, **436/13301 (0 failed)** and slow battery 12/217 —
**delta ZERO**, derived per file (3 files touched, 0 of them test files; `--is-ancestor` holds for both
`ef2f40efe` and `84b5e7115`).

⚑ **What V3a overturns.** (i) The omsi leg was **not** "build the park" — the park is one of FOUR layers,
and the other three were invisible until it worked: the park **races the region entry** (a `user:regionMove`
lands as more than one `regionChanged`, and a late one is read as `manualWrongRegion`, setting
`_queuePausedUntilReset`, which `startProcessing()` cannot clear — fixed by waiting for the region-event
stream to go QUIET, and by refusing early and by name on that flag); the fork **boots at a HELD boundary**
(`shouldRestart: true, currentLen: 0`, so `skippedHeldBoundary: 301` even with the gate open); and
**victory had to move ahead of the exhaustion leg**, because the reset's teleport destroys the park and the
victory `locationCheck` needs it to pass loops' M3b strict gate. (ii) **A green in-app row is not a control
for a standalone instrument** — `omsi-loop-exhaustion-single-reset` is green because
`omsi-out-of-mana-loop-reset` runs FIRST in the same page and its host reset cold-starts the fork.
(iii) The brief's *"REAL-TIME bot walk class (minutes each)"* is **wrong for this fixture** — 17 s measured,
~11.6 s of it the fixed page boot. (iv) Two of the MAZE leg's claims were about **transients**: the reset's
teleport and the queue's next move land in the same millisecond, so the old 500 ms poll timed out on a
teleport that had happened perfectly; both now read the event stream.

⚖ **NEW, OPEN FOR THE USER — and it is an APP question, deliberately not fixed here.** *Should LIVE PLAY
cold-start the fork's loop, the way every bridge-mediated plan install already does?* A player who enters a
freshly-booted omsi region, parks a Manual block and queues an action in the game's own UI gets a game that
never starts: the boundary is held, the host clock refuses to step it, and nothing in the live-play path
calls `restartLoop()` — the bot, replay and host-reset paths all call `_forceLoopRecompile()`
(`bridge.js:1650`). The instrument's own cold start is CONDITIONAL, so it goes quiet on its own if the app
takes the job. ⇒ **V3b (the rename) is unblocked and is next.** V3b also still owns the two STALE names
(`verify-dj-real-embed`, `verify-bot-playthrough`) — neither was deleted here.

**V3a VERIFIED by the planner 2026-09-05** (`b86580f9ca` · `226e397674` · `2b8c9be271` · `53387ed0ef` on
origin/main; all three instruments 3× green solo; CI 436/13301 delta ZERO at `2b8c9be27`; no app code). The
omsi fix was FOUR layers (the park; a park-vs-region-entry race that sets `_queuePausedUntilReset`, which
`startProcessing()` cannot clear; the fork booting at a HELD boundary so an open gate still steps nothing —
every bridge-mediated plan install calls `_forceLoopRecompile()` and live play has none; victory ahead of the
exhaustion leg because the reset's teleport destroys the park). Lesson: a green in-app row is NOT a control
for a standalone instrument — `omsi-loop-exhaustion-single-reset` is green only because the row before it
cold-starts the fork. The survey's eight reds are now ALL accounted: 6 fixed instruments, 2 STALE, 0 SUBJECT.
**⚖ NEW for the user (V3a, an APP question, not fixed):** should LIVE PLAY cold-start the omsi fork's loop the
way every bridge-mediated plan install does? Today a player entering a freshly-booted omsi region, parking a
Manual block and queueing in the game's own UI gets a game that never starts. Next: **V3b** the rename
(launches after V3a idles); then the HANDOFF to a new Fable session for reviews R1/R2 (⚖ user 2026-09-05).

**⚖ RULED 2026-09-05 (user):** the omsi live-play cold-start question is DELAYED to the loop-costs ↔ procgen
discussion (review R2); nothing changes now. R2's agenda: loop costs' write-back (H5), the cost generator's
pre-procgen design, and the omsi live-play start.

**V3b LAUNCHED 2026-09-05** as `procgen-verify-rename` (Opus; kickoff `NewDocs/plans/procgen-verify-rename-prompt.md`;
V3a's session read idle first): the derived rename table committed FIRST, then gate-shaped `verify-*` →
`check-` (the three mechanisms adopt them), report-shaped → `dump-`/`report-`, the two STALE deleted (or
asked), the CI shard partition quoted before/after with slow gates kept behind the roster's exclusions, the
generated instrument catalogue and 22 docs pages repointed. After V3b: the HANDOFF to a new Fable session.

⇒ **V3b AS BUILT 2026-09-05** — five commits on `main` (`5f39eb83f9` table · `df404e911b` gates +
mechanism · `486670cc13` readers · `af54c20d46` baseline · `25b8b8d2fb` record), staged by path,
every move a `git mv`. **49 GATE-class scripts → `check-*.mjs`; 11 REPORT-class unchanged; 2 STALE
deleted.** Record: `CC/docs/procgen-verify-tier.md` §"V3b — the rename" (the derived table,
committed BEFORE any file moved) and §"V3b as built".

⚑ **What overturned the brief.** It said to put slow newly-adopted gates *"behind the roster's
existing cost/`--win` exclusions"*. **There is no cost exclusion.** `ciGatePlan.js:150` is
`ciRunnable = !gate.windows`, whole — so the rename alone enrols every non-Windows gate in CI, and
`planCiShards` prices an arm the runner has never measured at the WHOLE 600 s budget. Measured on a
mirrored repo root with the naked rename applied (the mirror reproduces the real tree's BEFORE
numbers exactly, which is what makes it a control): browser **25 arms / 3 shards → 52 / 30**,
headless **31 / 1 → 51 / 21** — **4 → 51 procgen gate jobs on every push**, 47 of them unpriced at
600 s each and an unknown number RED. ⇒ **⚖ RULED (user, 2026-09-05):** a fourth declaration,
`@ci-box <reason>`, in the family of `@ci-face`/`@ci-shallow`/`@ci-argv`, read by `ciRunnable`.
47 gates declare one (the other two are the `--win` pair the Windows clause already excluded).
**The shard plan is UNMOVED: browser 25/3, headless 31/1 — BEFORE == AFTER, which is the check a
roster-count assertion could not have made.** Roster 33 → 82 gates.

⚖ **RULED (user, 2026-09-05) on the two STALE:** deleted. `verify-dj-real-embed.mjs` and
`verify-bot-playthrough.mjs` — all three of their worlds went at `ccfc5bad0` (2026-06-26), so
neither could pass at any SHA. The `stale-` alternative was declined: a third prefix with two
members no mechanism reads.

⚑ **And a derived answer the brief asked for: there is NO `report-` prefix.** All 11 REPORT-class
scripts were already `dump-`, so a third prefix would have had a population of zero. The traffic ran
the other way on exactly one file — `dump-spiral-byteidentity.mjs` ends `process.exit(allOk ? 0 : 1)`,
prints `ALL PASS`, and its own header says *"Not a passive dump"* ⇒ it is now
`check-spiral-byteidentity.mjs`, while its three byte-identity siblings genuinely cannot fail.

Readers: **187 tracked files** swept longest-name-first, plus five a whole-name sweep structurally
cannot see (two line-wrapped basenames, a `{a,b}` brace spelling, two eventBus subscriber IDs).
`CC/docs/procgen-verify-tier.md` is deliberately NOT rewritten — it is the survey, and its §V3b
table is the map. Two tracked FALSE claims retired with the rename: `vitest.slow.config.js` and
`runner.md` both said the `verify-runner-*.mjs` instruments *"still run"* (nothing did), and
`braidSphereBot.slow.test.js` called itself the analogue of a script that no longer exists.

Gates: `check-procgen-help --doors=all` **ALL PASS** (265 instruments, 618.9 s) · reference
`--check` all match · `check-procgen-docs` **ALL CHECKS PASSED** · `check-slice-records` **ALL PASS**
(73 VERIFIED / 37 UNVERIFIABLE / 2 NOTE) · bounded vitest **37 files / 1049 tests / 0 failed** ·
in-app `fast` **83/83** · `compare-runs` **83/83 → 83/83**, exit 0, no roster change. The one red
seen was a five-sample contention flake (3 green / 2 red) in a `beforeAll` hook, with three controls
recorded. ⛔ `check-seedling-bot-differential --win` NOT run — a measured 142-minute GPU drive, and
still the one script of the original 62 with no verdict from this arc.

⚖ **NEW for the user, four items, all on the record in §"V3b as built":** (1) which of the 49 CI
adopts — deleting a `@ci-box` line, and paying an unpriced 600 s shard until a run re-prices it;
(2) should `check-bounce-embed`'s `ERRORS (n)` count FAIL the run (V3b gave it the PASS line the
survey named and left the count diagnostic — asserting it is a NEW claim); (3) 20 of the 49 read
`--host=` in a spelling `gateRoster.readsFlag` does not know, so the roster shows `[-]` for them —
nil consequence today, load-bearing on adoption; (4) the `seedling-wasm` submodule still names four
old scripts, which is a submodule commit plus a gitlink bump.

**Next: the HANDOFF to a new Fable session for reviews R1 (marking tool) / R2 (loop costs — carries
the omsi live-play cold-start question).** The verify-tier arc's coded ladder is DONE.

**V3b VERIFIED by the planner 2026-09-05** (`54b534edca` on origin/main; 0 `verify-*.mjs` left, 82 `check-*`,
11 `dump-*`; the two STALE deleted; 47 gates declare `@ci-box`; CI shard plan BEFORE == AFTER — 25 browser
arms / 3 shards, 31 headless / 1 — confirmed by the runner at the pushed head; CI 436/13309, +8 rows all
derived). V3b's headline correction: the roster had NO cost exclusion (`ciRunnable = !gate.windows`), so a
naked rename would have enrolled 47 unpriced 600 s shards per push; a FOURTH declaration `@ci-box <reason>`
(family of `@ci-face`/`@ci-shallow`/`@ci-argv`) keeps them roster-run but CI-boxed. Also: all 11 reports were
already `dump-` (no third prefix); `dump-spiral-byteidentity` was a gate in disguise → `check-`; two tracked
false claims that `verify-runner-*` "still run" retired. ⚠ V3b's `git add -A .` committed the untracked
`maze_loop_worldgen` fixture once (`486670cc13`) — untracked again at `54b534edca`; the blob stays by SHA;
no rewrite (trap 1247, the third `add -A` slip of the day — every kickoff now says stage by path).
**⚖ RULED 2026-09-05 (user, on V3b's four):** (1) CI adopts NONE now — case by case later, each adoption
deleting its `@ci-box` line and fixing its own `--host=` spelling; (2) `check-bounce-embed`'s `ERRORS (n)`
count WILL fail the run — a small follow-up; (3) the 20 hand-rolled `--host=` readers are fixed WHEN
adopted; (4) the `seedling-wasm` submodule's four stale names ARE fixed — a small slice, submodule pushed
first, **gitlink bump pre-authorized by this ruling**. **THE VERIFY-TIER CODED LADDER IS DONE.** Still no
verdict from this arc: `check-seedling-bot-differential --win` (a 142-min GPU drive).

**⛓ HANDOFF to session 2 — 2026-09-05.** `priorities-brief` (this Fable session; file
`next-priorities-planning`) closes at the user's word ("we can wait until after V3b is finished"). Successor
= `next-priorities-planning-2` (kickoff `NewDocs/plans/next-priorities-planning-2-prompt.md`), opening with
the two reviews R1 (marking tool ↔ editor) / R2 (loop costs ↔ procgen ↔ editor, carrying the `loop_costs`
write-back, the omsi live-play cold start, and §5m's "where does the queue viewer fit"), one of them LAST by
⚖; then the two V3b follow-ups (bounce-embed fail-on-errors; the wasm names + gitlink), H6a parked behind R1,
and the field as mapped 2026-09-04 (eleven backlog conversations, the maze-lab residues, the docs TODO).

**NOT this arc (plan §8):** the pipeline's unrecorded TREE-step edits; the sphere/top-down twins in the
6,013-line panel; the in-app maze panel's third editing path (no session, no undo — not in §5i's recon); §5m
stands as its own arc, ruled OUT of the hub. **Nothing else launched.** ⚑ Two stale carries in §6 corrected this
session, both measured with `git branch -r --contains`: top-down phases 4/5/6 and the two grid-growth commits
are ALL on `origin/main`.

## 5o. LOOP COSTS ↔ procgen ↔ the editor — REVIEW R2 DONE 2026-09-05/06 (Fable session `next-priorities-planning-2` at main `76aa415608`; plan file `NewDocs/plans/loop-costs-plan.md`, gitignored; memory `project_loop_costs_review`; successor to §5n's HANDOFF)

**The ask (user, 2026-09-05):** *"Currently loop costs are generated by a component that was designed before the
procgen system, and getting it to work with procgen may require significant changes."* The user chose R2 first
(*"Let's start with reviewing loop costs"*) and then stepped back to the PURPOSE of the cost data: three
coarse actions (Move, Check Location, Explore) priced by simulating the sphere log; substrates then brought
their own economies. Everything below was MEASURED at `76aa415608`; commands in the plan's §9.

**Verdict, measured.** (1) **Four files, THREE cost models, one store — and the backlog's dedup entry targets
the wrong pair.** `loops/costGenerator.js` (2026-01-17, 615 lines, 30 vitest rows) is DEAD: no caller of
`generate()` outside its own test (`git grep`), exposed only as a console handle. `shared/procgen/
loopCostGenerator.js` (2026-05-05, submodule) is the ONLY production producer of a `loop_costs` block
(`procgenPipelineEngine.js` at the build, when `enableLoopMode && embedSphereLog`) and the only model that
knows the M5 vocabulary (`timeDrainPerSecond`, `xpEffect`). `loopsCostDebugger/costPlanner.js`
(2026-03-10, 1,288 lines) is what the RUNTIME actually runs: the loops panel's Generate Costs and the
auto-generate on entering loop mode both stamp its output into the store; it knows no summary/XP-effect
vocabulary (0 hits) and defaults location cost to 100 where the generator uses 10. (2) **The two live models
are NOT the same algorithm**: run side by side over five documents (scratch `costs-side-by-side.mjs`, in the
plan §9) they agree only on the start region and the first priced region — maze fixture far room 60 vs 23;
shapez 5/56 regions and 0/140 locations agree. (3) **A `loop_costs` block IS the loop-mode switch**: presence
auto-enables loop mode (`loops/index.js` `handleRulesLoaded`; `isLoaded()` = non-null). All 12 committed
blocks are EMPTY (0 regions / 0 locations, defaults 50/10), all hand-written by the jta/omsi test-preset
scripts; the only real block on disk is the untracked `maze_loop_worldgen` fixture (4/3). Confirmed live:
`jta_schedule_test` and `omsi_substrate_test` boot with loop mode ON from an empty block. (4) **The hub's
write-back is not one door**: the planner's `getCostData()` is the block's shape, but its vocabulary would
put a `moveCost` on summary regions — the exact failure the 2026-07-23 ruling forbade.

**The intended design vs the tree, per capture shape** (`loopState._captureShapeFor`: `fine` = has a recorder,
`summary` = declares `summaryRecording`, `coarse` = the rest): plain regions + text adventure = COARSE, the
three-action model from the block with XP discount — as intended; the 9-row `test-loops-only` battery on the
plain `adventure` world is 7/9 with BOTH reds STALE ROWS (file last touched 2026-06-13; they poll DOM classes
that no longer exist and expect "Resume" where the idle label is "Start"). Maze = FINE but reads the block:
per-tile = region cost ÷ `longestShortestPath`, XP-discounted — as intended. jta/omsi = FINE, own economy:
the resource-channel router charges the pool with NO region attached, so no block value is read, no region XP
awarded, no XP discount — the user's "simplest option", already implemented; the block only needs to EXIST.
Runner/bounce = SUMMARY: 1 mana/s of live play, per-action costs only where the block names one; and region
XP IS applied to the drain rate today (`_calculateActionCost` summary branch). Cavernous has NO loops registry
entry. Also found: `test_json/e2e/costGenerator.spec.js` waits for a `window.generateCosts` nothing defines
and `npm test` never selects it; the `test-loops` MODE points at the main config whose roster enables ONE
row (`timerOfflineTest`), which hung for the whole 600 s budget — the mode measures nothing.

**⚖ RULED (user, 2026-09-05/06), verbatim where short:** (a) *"Let's make the planner the official algorithm,
but let's make the default location cost 10, not 100."* (b) real-time regions KEEP the XP discount on the
drain rate ("Yes"). (c) region XP for jta/omsi stays OUT ("Yes"). (d) stale rows: *"retire them, unless
there's a simple and obvious way to rewrite them"* ⇒ retire the initial-menu row (its premise — a flat action
list with a "Starting Region: Menu" entry — no longer exists), REWRITE the pause-resume row (labels
Start/Pause/Resume), retire the `test-loops` mode. (e) *"Yes, we should delete the dead live-engine
generator."* (f) *"keep 'block presence means loop mode on'. We might later discover that we don't want
this."* (g) the pure module writes the block (after (a)). (h) the queue-viewer plan (§5m): *"It might be best
to throw out the whole planning document and start from scratch"* — it was written *"without first
investigating the rest of the loops system"*; a fresh plan follows this review with these measurements as
input. (i) SIMULATION DESIGN (user): the planner simulates a playthrough and *"was designed for only coarse
substrates"*; v1 = *"treat every region as if it's a coarse region, when running the simulation, but store
the costs according to what we already decided"* (coarse/maze keep numbers; mana-declaring substrates jta/
omsi get none; summary gets the drain only, explicit costs passed through); fully accurate costs would need
*"simulate actual gameplay ... We have playback bots"* — slow, *"some users might want this anyway, so maybe
we should implement support for this option"* ⇒ an optional later rung.

**⚖ RULED (user, 2026-09-06) — the omsi live-play question, REFRAMED and closed.** The user: *"I want the
restart to be triggered by the player pressing the in-game start button, not the addition of the first action
of the queue. And in general, I want our code to respect the state of the in-game start and pause controls."*
MEASURED: the fork boots STOPPED (`saving.js` `load()` ends with a `pauseGame()` toggle), the host clock
deliberately ignores `gameIsStopped` (`clockGate.js` header), and the fork's own clock never starts in managed
mode. A scratch variant of `check-omsi-mana-leg.mjs` with the host restart replaced by the Play button's own
handler (`pauseGame()`) PASSED whole: boundary released, no run end reported (no-progress guard), pool drained,
exactly one reset at exhaustion. So **Play already cold-starts cleanly today — V3a's "never starts" was true
of an instrument that never pressed Play.** Pause is NOT respected: with Pause pressed the host clock stepped
80 ticks and drained 80 mana in 1.5 s. **Design (confirmed by the user, "what you described is how I want it
to work"):** for LIVE play the host clock does not step while the game's own flag says stopped; Play's own
restart-at-boundary is the cold start; replay and bot windows keep the bridge's timing (the planner drives
the flag itself); Pause does not pause loops' queue and loops' park does not press Pause. Priced: 24 enabled
omsi in-app rows + 1 instrument drive the game and 0 press Play — a census of the live-play rows is owed;
the fork's `pauseBeforeRestart` option becomes visible behaviour (run end reported on the next Play) — doc
it. No fork change, no gitlink.

**Ladder (plan §5; one Opus session each; FABLE PLANS, OPUS BUILDS):** **L1** cleanup — delete
`loops/costGenerator.js` + its test + the dead Playwright spec; measure and delete the 0-caller `_costs.json`
path in `costDataManager.js`; retire/rewrite the rows; retire `test-loops`; retire the backlog's dedup entry.
**L2** the algorithm — the planner's pure core moves into `shared/procgen/loopCostGenerator.js` as THE
algorithm over a rulesJson-derived topology; + summary/XP-effect vocabulary + the write-by-class rule;
defaults 50/10 as ONE exported constant every reader imports (⚖ open below); `generateLoopCosts` = plan
all → block; differential = the side-by-side script; submodule commit ⇒ gitlink bump ASK-FIRST. No committed
artifact moves (all 12 blocks are hand-written). **L3** the debugger imports the stepwise API and drops its
copy; Verify unchanged; docs (gotchas "three engines" → one). **L4** the hub's `loop_costs` write-back op
from the working copy; the row says presence = loop mode on. **L5** omsi: the clock rule + Play as the cold
start; instrument presses Play; row census; omsi doc note. **L6 (optional, later)** the bot-measured cost mode.

**⚖ OPEN for the user (not blocking L1):** (1) "default location cost 10" as ONE constant replacing the
runtime's four 100s (store fallback, loop-state no-data branch, Accept Defaults, the feature doc's table) —
or the block's field only? (2) L5 inside this arc or as its own slice ahead of it? (3) *"Either this or loop
costs should be the last thing we integrate"* — is L4 (the editor write-back) the LAST integration, behind
R1's marking tool? (4) the plain `test` mode's roster is down to one enabled row and it hangs — out of scope,
named here. **Nothing launched.** NEXT: the user's answers, then L1's kickoff; R1 (marking tool) still owed.

## 6. Everything else (unchanged queues)

Pre-existing next steps that predate this transition, in their topic files:
~~top-down stepped pipeline phases 4/5/6 (editors)~~ (**DONE and on `origin/main`** — `7b8c278f1` /
`544017aff` / `be3b01a00`, verified 2026-09-04 with `git branch -r --contains`); sphere-growth soft
difficulty (deferred — DELAYED by the user until a substrate supports it better than bounce);
grid-growth **KEPT + modernized** (user 2026-07-15 chose
refactor over deletion; `insertBackExit` extraction `a6cbdd35d` + async
generation with live denominator-less progress `406695f46`, ~~on main NOT pushed~~ **both on `origin/main`**
(verified 2026-09-04) — what remains is the panel LABEL question in `CC/docs/cleanup-backlog.md`; see
`project_grid_growth_retirement`); docs migration help module
(`CC/docs/plans/help-module-plan.md`, status Pending); flashPanel unification (plan on disk, Shape 1
decided; adjacent to the platformer arc's Flash side). Nothing from the 07-10/11 work blocks on them.

**Kittyengine engine-scripts CLI slice — QUEUED 2026-09-03, timing the user's.**
⚖ The user, verbatim (orchestrator-4's window): *"Yes, I will want to run a slice
for the engine scripts at some point."* Subject: `LEDGER-REPORT.md` §11e.5's
static survey — 15 of the 21 `scripts/*.py` in `~/CC/kittyengine-CC` hand-roll
their CLI with no `--help`/`-h` handler, so `--help` RUNS the gate (two of them
are CI steps); six use argparse after the ledger fix-up (`0791cfd`). Not PZ4's;
no brief until the user names the moment. Memory: `project_platformer_substrate_arc`.

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
block modes M1 ──► M2 ──► M3 ──► M4 ──► M5 ──► M6 (solver rename) ──► omsi arc D ──► arc E/F; omsi instant LAST
(M1–M5 all SHIPPED 2026-07-21/23; M6 is next)
seedling generate-UI slices 1–6 (§5e, ALL SHIPPED — arc CLOSED 2026-08-15) ──► constructive-mode arc §5f (OPENED 2026-08-15: shared refactor ──► loop move + maze bindings ──► maze lab page ──► iframe hosting ──► skeleton kinds ──► yield table/pre-check ──► chambers ──► corridor doors [⚖ ruling] ──► reach-cell ──► rule-directed; free editing + URL diet after slice 4)  ──► ⚖ ruling 11 hands Seedling pass 2 to §5g
procgen ELEMENTS §5g (DESIGNED 2026-08-15): arc 1 area graph (maze, CLOSED) ──► arc 2 reverse-pull block gadget (maze, CLOSED 2026-08-16) ──► arc 3 Seedling sites/door=cut/gadget/arrow-lane out (CLOSED 2026-08-18) ──► arc 5 room contract/oriented pick/chamber/arena/SHORTENS/density (CLOSED 2026-08-20, eight slices) ──► arc 4 CHAIN (⛔ ask-first, NOT authorised) ; R9 independent of all four, and §5g's close ranks R9's items by generator leverage
region atlas Phases 1–6 ALL SHIPPED (2026-07-27/28: format ──► marking tool
  ──► rules.json projection ──► play-time transitions ──► analyzer ──► maze
  projection ──► sphere sorter) ──► staged bots (Phase 8, Seedling legs, §5c)
  [RWK (Phase 7) POSTPONED indefinitely 2026-07-28]
```
