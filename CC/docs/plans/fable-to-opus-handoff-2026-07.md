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
  `verify-region-marking-tool.mjs` drives the real panel in chromium.
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
- Verification is by EFFECT, not by silence: `verify-seedling-atlas-preset.mjs`
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
  `scripts/procgen/verify-seedling-atlas-play.mjs` (SKIPs exit-0 without the
  artifact): arrival teleport confirmed by an independent `readState`; a NATIVE
  crossing queued straight into the iframe publishing `user:regionMove` AND
  moving gameState; a second crossing; and only then the negative — a
  host-driven cross-level arrival that must not echo. The watcher wraps the
  dispatcher's real `publish` and THROWS if it cannot, so the negative cannot
  pass vacuously. `verify-seedling-atlas-preset.mjs` stays the graph gate and now
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
  regenerated to 11 AP regions / 23 exits; `verify-seedling-atlas-play.mjs`
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
  rule-typed gates), `verify-seedling-atlas-maze.mjs` (four phases, nothing
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
`verify-atlas-sphere-roundtrip.mjs` 43/43 through Generate.py). A sphere-grown
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
  + `verify-seedling-bot-differential.mjs` (staleness gate, SKIPs without
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
(2) `verify-seedling-bot-differential` reads the game's status up to ~8 engine frames PAST
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
`verify-seedling-bot-differential --tier=full` without `--win` still drives
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
name; `verify-seedling-wasm-bridge` ALL PASS on p4c; `-pages` **20/0**. (D) and
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
step-editing` IMPORTS the merge; Phase H of `verify-sphere-steps-ui` was VACUOUS
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
bot's persistence declaration is a host-visible check; `verify-atlas-sphere-roundtrip
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
`value` — trap 857; `verify-region-step-editing.mjs` IMPORTS `buildEditedRegion`
instead of copying it; Phase G′ on `verify-sphere-steps-ui`) — kickoff
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
of `verify-seedling-ap-placement.mjs` (a top-level-await script; baseline
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

## 5k. The STANDING-VALUES CI arc — PLANNED 2026-09-01, ⚖ 72 RULED 2026-09-01 (Fable planning session; plan file `NewDocs/plans/standing-values-ci-and-parallelism-plan.md`, gitignored; S1 SHIPPED 2026-09-01 `ad5aef2b0`, S2 SHIPPED 2026-09-01 `e6c84a6f8` + the owed write `5e42d4104`, S3 SHIPPED 2026-09-01 `9f46b2bfd`…`765ea79fa`, S4 SHIPPED 2026-09-01 `91c26b690`…`4a99828ec` — SIX ROWS QUOTE CI; S4b SHIPPED 2026-09-01 `0f9e0cf27`…`3eceb7d18` — all three loose ends closed; S5 + S4c NEXT)

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
block modes M1 ──► M2 ──► M3 ──► M4 ──► M5 ──► M6 (solver rename) ──► omsi arc D ──► arc E/F; omsi instant LAST
(M1–M5 all SHIPPED 2026-07-21/23; M6 is next)
seedling generate-UI slices 1–6 (§5e, ALL SHIPPED — arc CLOSED 2026-08-15) ──► constructive-mode arc §5f (OPENED 2026-08-15: shared refactor ──► loop move + maze bindings ──► maze lab page ──► iframe hosting ──► skeleton kinds ──► yield table/pre-check ──► chambers ──► corridor doors [⚖ ruling] ──► reach-cell ──► rule-directed; free editing + URL diet after slice 4)  ──► ⚖ ruling 11 hands Seedling pass 2 to §5g
procgen ELEMENTS §5g (DESIGNED 2026-08-15): arc 1 area graph (maze, CLOSED) ──► arc 2 reverse-pull block gadget (maze, CLOSED 2026-08-16) ──► arc 3 Seedling sites/door=cut/gadget/arrow-lane out (CLOSED 2026-08-18) ──► arc 5 room contract/oriented pick/chamber/arena/SHORTENS/density (CLOSED 2026-08-20, eight slices) ──► arc 4 CHAIN (⛔ ask-first, NOT authorised) ; R9 independent of all four, and §5g's close ranks R9's items by generator leverage
region atlas Phases 1–6 ALL SHIPPED (2026-07-27/28: format ──► marking tool
  ──► rules.json projection ──► play-time transitions ──► analyzer ──► maze
  projection ──► sphere sorter) ──► staged bots (Phase 8, Seedling legs, §5c)
  [RWK (Phase 7) POSTPONED indefinitely 2026-07-28]
```
