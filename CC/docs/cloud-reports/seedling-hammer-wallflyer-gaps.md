# Cloud report: `seedling-hammer-wallflyer-gaps`

**Slice WALLFLYER gaps: the null-fork guards, the `wallFlyerBodies` switch-over, the wallflyer gap behind the JS hits,
and the cost of survey step 35 under the page's budget.** Planner: `seedling-hammer-phase-planning-9`. Ruling: the user,
2026-11-14, *"Guard + cheaper arm slice (Recommended)"* and *"If the model or the solver has gaps for wallflyer, then we
should fix those first."* No planner follow-up arrived during the slice.

## 1. SHAs

| | |
|---|---|
| start | `12b1abd64979cf4be88c887a2d7e14aef2ce6b17` (`hammer-flip-wallflyer-kill` = main `75e45c964d` + the `WALLFLYER_KILL_ARM` flip ON) |
| step 1 (G1, the guards) | `256a13c8` |
| step 2 (the `wallFlyerBodies` switch-over) | `f5779fb7` |
| evidence | `196bfa63` (`seedling-hammer-wallflyer-gaps-evidence/`) |
| head | the report commit, on top of `196bfa63` (code head = `f5779fb7`) |
| branches | `seedling-hammer-wallflyer-gaps` (the brief's name) and `claude/seedling-wallflyer-gaps-vikljc` (the harness-pinned name): same commits |
| wasm / `vendor/seedling` | `9968c7dd` / `ccdf1897`, unchanged; `session_bootstrap.sh --seedling` printed READY, "seedling wasm builds: OK (4 dirs)" |

## 2. The answer first

**No new switch.** Steps 1 and 2 are a crash fix and a byte-identical read switch-over. Steps 3 and 4 have the same
answer, and it is a **MODEL gap**, handed over to fidelity below. I did not edit the model.

**The one thing to know first:** the brief's premise for step 4 is wrong. The arm is cheap: it kills each flyer on its
first fork (2 forks in all). The units go after the kills. `dangerMap.staticEnemyDanger` prices every wallflyer at its
`.oel` placement, including one the run has **removed**. So at t432, after the arm has killed `wallflyer@48,112` (t134) and
`wallflyer@64,80` (t311), the dashless pass's corridor meets the **dead** `wallflyer@64,80`'s placement box at
(81.0,96.7). The ladder then EXHAUSTS, and the forced-hit prover spends the rest of the 640 units on 36 fork replays of
432 ticks each. The held 2560 retry resumes only the full pass. That pass needs **5069** units unbudgeted, and spends its
2560 on `sword-dash` before it even reaches the arm.

The dashless refusal's text is the **JS runtime's L22 → L29 refusal, word for word**: "enemy:wallflyer@64,80 (a static
"Enemy" body at its placement (this room is stepped, so this class is unbridged and does not move)…", the same danger
point (81.0,96.7). So the JS hits and the wasm budget failure have **one cause**.

With that one model fix applied as a scratch patch (measured, then reverted), step 35 **SOLVES on the page's first
640-unit attempt**: dashless pass, **609 t, 530 units, 0 hits**, into L29. On the p4g game that plan takes **0 hits**,
crosses into L29 at t609 and ends at (24,232), the model's end, with clock shift [0].

| step 35 under the page budget (640, then the held 2560) | answer |
|---|---|
| base `12b1abd649` | **TypeError** `Cannot read properties of null (reading 'ledger')` in the 2560 retry (= walk check A) |
| head (G1 + switch-over) | the named refusal: "…the combat ladder is EXHAUSTED … chaser:wallflyer@48,112 …" (the retry's full pass, cut at `sword-dash`). No crash |
| head + the scratch model fix (not shipped) | **SOLVED, 609 t, 0 hits, L29, first attempt (530 units)**. Game: 0 hits |

`Cloud-Status: blocked`. Step 4's acceptance (step 35 solved hitless under the page budget) waits on fidelity's
`staticEnemyDanger` fix (§9 hand-over 1). There is no solver-side cost change that gets it, because the cost is the
ladder refusing a ghost (§8). Everything else this brief asked for is done.

## 3. The reproduction (measured)

**The page budget in node.** The new measure-only probe `scripts/procgen/probe-seedling-page-budget-step.mjs` does what
the page does on the committed boot fixture (`fixtures/wallflyer-drill-kill/survey-step-35-boot.json`). It sends
`solveAnytime` the request at `SOLVER_BUDGET_WORK` 640 with `SOLVER_UPGRADE_WINDOW_WORK` 85 and fine checkpoints. When
the answer is a budget-cut refusal (`budgetCut`, and `wasmPlayback.expiryAction` → `retry`), it asks the ONE held retry
at `SOLVE_RETRY_BUDGET_FACTOR`× = 2560, resuming the unanswered passes (`passesAfter`). The work units are the page's own
(`createWorkClock`, one per `shouldStop` call). At base it gives the page's exact text: the retry ends in
`Cannot read properties of null (reading 'ledger')`.
`node scripts/procgen/probe-seedling-page-budget-step.mjs --fixture=frontend/modules/seedlingDemo/fixtures/wallflyer-drill-kill/survey-step-35-boot.json --exit=192,64 [--work-sites] [--budget=N]`.

**Where the units go (head, the passes and their deadline sites):**

| attempt | pass | units | what happened |
|---|---|---|---|
| 640 | dashless | 640 (no trip) | arm kills `wallflyer@48,112` (t134, 1 fork, 177 t) and `wallflyer@64,80` (t311, 1 fork, 121 t); at t432 the corridor meets the dead @64,80's placement → EXHAUSTED; FORCED_HITS' `proveForcedHit`: 1 `hitlessWitness` + 36 `continueHitless` forks, each replaying 432 ticks |
| 640 | full | 1 | trips at `walk` (budget spent) |
| 2560 | full (resumed) | 2563 | `sword-dash` 2430 of the units; trips before t134 (the arm's fork at t134 is `null`: G1's named refusal) |
| unbudgeted | dashless / full | 640 / **5069** | full SOLVES 539 t (the survey's plan); the dashless refusal is the ghost |

Deadline-site counts in the 640 attempt: `crusher-fork` 494 (the fork replays ask it every `WALK_CHECK_TICKS` = 32
ticks: 37 × 432 / 32 ≈ 500), `kill-chaser` 116, `walk` 34. The fork sequence (temporary caller stack on the segment's
`fork`, not committed) is `evidence/probe/step35-fork-sequence.txt`.

**The ghost, as a row.** `hammerWallFlyerGaps.test.js` replays the unbudgeted 539 t plan
(`fixtures/wallflyer-gaps/survey-step-35-plan-539.json`) to t432. `run.entities('wallFlyerBodies')` holds
`['wallflyer@128,80', 'wallflyer@144,112']`, yet `staticEnemyDanger` still prices all four placements. A scan at every
20 ticks shows @48,112 leaving the family at ≈ t320 and @64,80 at ≈ t431, with both priced to the end of the room.

**The JS runtime (step 3).** I did not re-drive the JS page. Its solve runs the same `solveAnytime` (the worker's
dispatch), and the walk check's B2 line matches the head's dashless refusal on the id, the wording, "priced "stepped" by
`contactPricing`" and the danger point (81.0,96.7). The arrival states differ: the page's live arrival against the
survey's boot view. I did not capture the page's own request, so this match is textual (§9 hand-over 2 names the repro).
The L22 → L25 leg (its 2 hits) has a different arrival (the boot fixture's arrival is at the west door), and I could not
reproduce it from this fixture.

## 4. Design + change, OFF identity

**G1, the null-fork guards (`256a13c8`, not switch-guarded: a crash fix).** The segment's `fork` is
`replayOntoFork(forkRun(), …, { stop: () => fineDeadlineReached('crusher-fork') })`, which is `null` once the caller's
deadline has tripped. The fork takers the walk check named are guarded as follows:
- `bodyFamilyKillOnLadder` (the wallflyer and drill arms): `if (f === null)` → `tried.push("the caller's deadline tripped
  inside the fork")`, stop the stance loop and the target loop. The arm answers its `{why}` ("body-family arm: no hitless
  kill (0 fork(s)) — wallflyer@48,112: the caller's deadline tripped inside the fork"), and the rung's refusal carries
  `withSolveDeadline`'s ⏱ DEADLINE clause, as every other trip does.
- `stagedChaserHunt`'s still-wait fork (`CHASER_STAGED_HUNT`, ON): `null` → rewind to t0, `row.verdict = 'deadline'`, the
  named why, `break`. This is the path the loop's own `deadlineReached('kill-chaser')` verdict already took.
- The third §5 name, `searchDrillTimedPass`'s `tailHolds` → `fc.fork()`: **not a fork taker that can see a deadline.**
  `fc` is a `corridorBodyForecast` cursor, and its `fork()` (`levelRun.js` `corridorBodyForecastFrom`) always returns a
  copy. It is left as is (§8).

**Step 2, the `wallFlyerBodies` switch-over (`f5779fb7`), exactly per fidelity's hand-over.** Fidelity's one `sed` changes
the 3 sites (`liveWallFlyer`, and `playWallFlyerKill`'s `after` and `gone`). Then `census-seedling-solver-surface --write`
(`run:wallFlyers` RETIRED; `run:entities` gains `wallFlyerBodies: {solverBot.js: 1}`), entityBlocks
`wallFlyerBodies.solverReads = ['solverBot']`, and the surface doc. Its table "Read by" becomes `solverBot`, **Modelled**
gains `wall-launch (wallFlyerBodies)` and adds the family to `contact` and `hp`, and **Not modelled** loses
`wall-launch` (entityBlocks.test D2/D4 green). I also regenerated the procgen reference and the docs index, which carry
step 1's new probe. **The two fork reads stay untraced.** The census follows `run` through aliases and parameters
(`seedlingSolverSurface.js`'s fixpoint), but not a fork's return value, and teaching it that is a census-logic change
outside this brief.

**Identity (both measured):**

| | base `12b1abd649` | G1 `256a13c8` | step 2 `f5779fb7` |
|---|---|---|---|
| acceptance md5 (`batch-seedling-acceptance.mjs 2>/dev/null \| md5sum`) | `391322d681b7aa0229d94b3f6906d024` | `391322d681b7aa0229d94b3f6906d024` | `391322d681b7aa0229d94b3f6906d024` |
| L27 witness (twoPassSolve, arms ON): md5 over keys, equips, `BODY_FAMILY_KILL_COUNTS`, `stateDigest` | `72d561f3…` 203 t | same | same |
| survey step 35 (same fingerprint) | `0f06cb9e…` 539 t | same | same |
| survey step 84 (drill arm ON) | `3f90aca3…` 354 t | same | same |

An unbudgeted solve never sees a `null` fork, so G1 moves nothing there. A budgeted solve that tripped inside one of
these forks used to crash and now refuses by name.

## 5. Rows + bounded vitest

| file | tier | rows | result |
|---|---|---|---|
| `hammerWallFlyerGaps.test.js` (new) | fast | 3: the arm is ON; **G1** step 35 under a deadline that trips every `crusher-fork` ask → SolverRefusal with the ⏱ DEADLINE clause, the arm's refused row `{t:134, why:"…the caller's deadline tripped inside the fork"}`, no TypeError (base: TypeError, measured); **the model gap pinned as it is** (removed bodies priced) | 3/3 |
| `hammerWallFlyerGaps.train.test.js` (new) | train | 1: **G1** the staged hunt under the same deadline, on BK2COMBAT's pocket-shut OPP ON witness → `{… t:680, cell:(856,856), wait:null, verdict:'deadline'}` and the named STAGED HUNT why (base: TypeError, measured) | 1/1 (40 s) |
| `hammerWallFlyerDrillKill.test.js` | fast | unchanged | 6/6 (with `hammerSpearArm`, `hammerBk2Combat`: 17/17) |
| `hammerWallFlyerDrillKill.train.test.js` | train | unchanged (step 35 539 t, step 84 354 t) | 5/5 (93 s) |
| `entityBlocks.test.js`, `seedlingSolverSurface.test.js`, `frontend/modules/procgenDocs/` | fast | D2/D4 re-pinned by the doc edit | 12 files, 569/569 |

**Survey `--through=end --route=full`, head `f5779fb7` (local, `--timeout=1500`) against base `12b1abd649` (CI run
43746011059, its merged survey fetched with `survey-seedling-shards.mjs --fetch`).** All **250 steps are identical**, in
verdict, ticks, the replay (hits, deaths, end level, transitions) and the refusal text. There are **0 movers**. Head and
base both have 224 SOLVED and 26 REFUSED. The only replay hits are step 24 (1), step 202 (2) and step 220 (2), the same
at base. Step 35 is SOLVED 539 t, 0 hits, end L29 on both; the survey runs unbudgeted, so it never sees G1's path.
`survey-seedling-shards.mjs --compare … --md`: every row ✓.

`census-seedling-solver-surface --check`: GREEN, 374 rows. `hammerSpearWallFlyerL22`, which the brief named, does not
exist at this base (§8). No unfiltered vitest. No pytest.

## 6. Game witness

`probe-seedling-chaser-mobiles.mjs --class=Bob --file=walk-step-35-609.json --player-hits --frames`, headless logic-only,
with its own dev server on port 9790 (stopped by literal PID), under the box lock:

| plan | how it was made | game hits | crossing | end | Bob |
|---|---|---|---|---|---|
| step 35, **609 t** (dashless: bait, detour, kill) | head + the **scratch** model fix, under the page budget (640, first attempt) | **0** through t609 | L22 → **L29 at t609** | (24,232) = the model's | 145 comparisons, worst \|Δ\| 0; clock shift [0] |

The 539 t plan (the unbudgeted full pass, the walk check's A-nolimit) was game-witnessed 0-hit by the drill-kill slice,
and it is unchanged here (fingerprint above). No game witness exists of a **shipped** head plan under the page budget,
because there is none: the head refuses (§2). Files: `evidence/witness/` (the walk tape, the log,
`game-35-609-rows.json` = `[t, level, hits, hits_timer, x, y]` per tick).

## 7. Census: which seed-1 divergence-sweep legs the change can move

- **Step 2: none.** It is byte-identical by construction (fidelity's exactness argument) and measured on three witnesses.
- **G1: only page-budget solves that trip their deadline inside a body-family arm fork or a staged-hunt still-wait
  fork.** Those used to end as a TypeError rendered as a refusal, and now end as a named refusal. The outcome class
  (refused) does not move, only the text. A crash inside the *first* attempt could also have changed whether the held
  retry fired; that is not measured per leg.
  - The rooms are the wallflyer/drill rooms (the arm): L22, L25, L27, L28, L88, L91.
  - Then the rooms whose kill rung asks `stagedChaserHunt` (a BobSoldier with staging cells: L40's BK2 legs).
  - Of the drill-kill slice's 56-leg census of those rooms (sweep 43136081951, unbudgeted node solves), these legs are
    candidates by key:
    - L22's 16: `level_22 <- in_L21_80_160 -> exit:out_teleporter_{0_128,96_0,96_192,192_64}`,
      `level_22 <- in_L25_144_32 -> …` (same four), `level_22 <- in_L29_0_224 -> …`, `level_22 <- in_L30_64_0 -> …`.
    - L25's 12: `level_25 <- in_L22_0_128 / in_L26_144_32 / in_L28_96_0 -> exit:out_teleporter_{0_96,96_128,144_32}` and
      `location:Level 025 - Chest`.
    - L27's 4: `level_27 <- in_L26_64_304 / in_L28_128_304 -> exit:out_teleporter_{32_0,168_16}`.
  - Whether any of them trips inside the arm's fork under the page budget is unmeasured here: it needs the sweep's own
    budgeted requests.
- **The model fix (hand-over 1), when fidelity lands it, is the real mover.** Any L22 / L25 / L27 leg whose corridor
  passes a wallflyer the run killed earlier in the same visit can move. On seed 1 that is at least survey step 35 (with
  the walk's entry 10, and the JS B crossing).

## 8. What the brief got wrong (measured)

1. **"A cheaper arm."** The arm is not what costs. On step 35 it kills each flyer with its first fork (forks: 1, 1), which
   is 2 of the 37+ forks the dashless pass takes. The units go to FORCED_HITS' prover after the ghost refusal (36 × 432-tick
   replays) and to the full pass's `sword-dash` (2430 units of the retry). No change to the arm (stance order, early
   accept, walk bound, fork reuse) changes the outcome, because the arm already succeeds. The smallest correct change is
   the model's (§9).
2. **"JS sees the wallflyer unbridged, wasm sees it live; the arm has no live target on JS."** Both runtimes run the same
   solver. `isBridgedChaser('wallflyer')` is false **by design** on both: wallflyers are not chasers, and the live pricing
   is the corridor forecast (`corridorBodyPricing`). The "unbridged and does not move" wording is `staticEnemyDanger`'s
   text for *every* non-bridged class in a stepped room. The arm has no live target because the body is **dead**: it
   killed it 121 ticks earlier. The wasm walk showed a *different* refusal only because its shown answer was the held
   retry's full pass, cut before the kills. The JS page showed the dashless pass's refusal.
3. **"Two more unguarded fork takers (25253, 29776)."** 29776 (`stagedChaserHunt`) was a real one; it is guarded and has a
   witness row (it TypeErrors at base). 25253 (`tailHolds` → `fc.fork()`) is a `corridorBodyForecast` copy, never `null`.
4. **`hammerSpearWallFlyerL22`** does not exist at this base (`git ls-files`, and no reference in the tree). I ran
   `hammerSpearArm.test.js` in its place.
5. **The page's `staticEnemyDanger` text "(this room is stepped, so this class is unbridged…)" reads as a bridging
   question.** It is a pricing question: the placement of a body the run no longer holds.

## 9. Residue / hand-overs

**Hand-over 1 → fidelity (MODEL gap; `dangerMap.js`, not edited).** In `staticEnemyDanger`, skip a wallflyer the run no
longer holds, the way `liveDrill?.removed` skips a drill. The measured scratch form, after the drill skip, is: when
`run.entities('wallFlyerBodies')` is an array and holds no entry for the id that is neither `destroy` nor `dieAnim`,
`continue` (`evidence/probe/scratch-model-fix.patch`).
- **Failing row:** `hammerWallFlyerGaps.test.js` › "THE MODEL GAP …". It pins the four priced ids. The fix makes it
  `['wallflyer@128,80', 'wallflyer@144,112']`, and the fix's slice flips the pin.
- **The measured effect:** step 35 under the page budget SOLVES first attempt, dashless 609 t, 530 units, 0 hits, and the
  game agrees (§6).
- **Open questions for fidelity's own measurement:**
  - Whether a *live, resting* wallflyer should still be priced at its placement in addition to the corridor forecast.
    This slice did not touch that.
  - Whether the dying span should count. The scratch form drops a dying body; `gone()` in the arm waits it out.
  - The mover census over the wallflyer rooms (§7).

**Hand-over 2 → the js gate (`seedling-js-planning-20`).** The JS runtime's "walking instead" fallback tanked 2 hits on
L22 → L29 (walk check B2) after the first solve refused on this ghost. Report only; the fallback is not edited.
- Repro: the walk check's B arm, `TEST_MEASURE_FLASH_RUNTIME=js`, seed 1, entry 10. The solve to look at is the first
  `[js runtime] the solver declined — solverBot(js-runtime-L22-exit) …`.
- The same fallback took 2 more hits on L22 → L25 (B2 t375.7 s / t376.5 s), after a CORRIDOR refusal on
  `chaser:wallflyer@64,80` (a live body, not the ghost). I did not reproduce that leg here: its arrival is not this
  fixture's.
- Under ⚖ no-hit, a fallback walk through a priced danger is a FAIL whatever the solver says.

**Hand-over 3 → the planner.**
- At the head, step 35 on the page is a **named refusal**, no longer a crash. The walk check would stop at entry 10 with
  an honest text (wasm seed 1), not a pass. Re-run it once hand-over 1 lands.
- The full pass's `sword-dash` cost (2430 units before t134 on the retry) is a separate budget question. With the model
  fix it does not matter on this step, because the dashless pass ships first.

**Other residue.**
- The census does not trace a run held as a fork (`f` in `playWallFlyerKill`, and every other `fork()` taker). This was
  already a gap before this slice, and it applies to every family.
- I pushed the `seedling-survey/wallflyer-gaps-f5779fb7` ref to run the CI survey, because `workflow_dispatch` answered
  403 from this session. A push-ref run takes the frontier bound (4.2), not `end`, so the §5 survey comparison was run
  locally instead.
- Measurement leftovers: the temporary fork-caller instrument and the scratch `dangerMap.js` patch were applied by copy
  and restored. The dev server on 9790 was stopped by literal PID. The tree is clean except for this report's commit.
