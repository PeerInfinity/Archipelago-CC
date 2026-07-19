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
2. **Unlock-discretization U0–U5** —
   `omsi-loops-unlock-discretization-plan.md` (~5–6 days, on `substrate`).
   Defines the AP location pool; extractor prototyped (157×2 predicates,
   0.8s); enforcement = suppression-scoped `getNextValidAction` check; keep
   the differential corpus + real-save-fixture stratum as a LIVE gate (it is
   also the non-monotone detector — Buy Glasses is the only one TODAY).
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
   handshake 1,030,800 vs 316,800 ticks. Two facts for the ruling
   session: SHORT runs are degenerate on the policy axis (at 120 loops the
   two policies are bit-identical — pools must be big enough for a loop to
   end mid-walk), and BOTH policy arms DNF on the half-shuffled smoke world
   (vs 461 vanilla). Gitlink NOT bumped — outstanding ask.** JtA-half record: design doc *(NewDocs)*
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
2. **X1 — maze consumable tiles — Opus kickoff READY 2026-07-18:**
   *(NewDocs)* `x1-maze-consumable-tiles-opus-kickoff.md` (anchors
   verified: `compileRegionGraph` procgenPipelineEngine.js:2185,
   `stepItems` sphereSteps.js:305, mazeRoom/index.js:110 pickup dispatch;
   carries D10/S5/S6/D5/D2/S8 + byte-inert-default discipline).
   Independent of P2's omsi half and of Phase 6 — needs only the grant
   bus, which is live: new tile type → compile classification → sidecar →
   pickup dispatch → grant event; maze-only always/never bot-collect
   setting (S6); mana-refill tiles = optional stretch (S5).
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
```
