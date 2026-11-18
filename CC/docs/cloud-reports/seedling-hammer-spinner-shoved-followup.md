# Seedling hammer-phase SPINNER-SHOVED-FOLLOWUP: the deep step prices chasers, a solve pays one budget, and a re-choice may not end hit-taking

Slice `seedling-hammer-spinner-shoved-followup` (Opus, cloud). Planner `seedling-hammer-phase-planning-8`. ⚖ The user approved
it on 2026-11-14 ("Follow-up slice (Recommended)"). Landing needs the user's SHA-bound OK through the planner.

## 1. SHAs

| | |
|---|---|
| Start (base) | `71adf001dd` (`origin/hammer-stack-trio`, = main `80650ed1b6` TRAIN 105 + the hammer stack) |
| Merged | `origin/claude/seedling-l40-spinner-walls-bsk50m` @ `5e9fe6dbec`, as merge `bb70bdb0` (only conflict: the generated surface, regenerated) |
| Reproduction | `e835933f` (OFF clock table, L40's ON trace and profile, tools) |
| Code | `f9b13ed4` (chasers, solve budget, hit gate), `e6d4d81e` (the hit gate marks against OFF's own step) |
| Head | the commit carrying this report |
| Branch | `claude/seedling-hammer-spinner-followup-rnzn8a` |

No planner follow-up arrived; `ReadNotifications` was empty. I followed the brief alone.

## 2. The answer first

**Switch: `SHOVED_BODY_LOOKAHEAD`, continued** (the same switch: `SEEDLING_SHOVED_BODY_LOOKAHEAD=1`, `withShovedBodyLookahead`).
It ships OFF.

| md5 | value |
|---|---|
| base | `391322d681b7aa0229d94b3f6906d024` |
| head, OFF | `391322d681b7aa0229d94b3f6906d024` |
| head, ON | `391322d681b7aa0229d94b3f6906d024` |

**Acceptance holds: no clock becomes hit-taking ON**, on either leg, over the whole range 5215–5250 (72 solves per arm):

| leg | OFF | L40's ON (base) | follow-up ON |
|---|---|---|---|
| `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest` | 31 clean / 5 refused / 0 hit | 33 / 3 / 0 | **33 / 3 / 0** |
| `level_40__r26c13 <- in_L43_176_464 -> location:Level 040 - Chest` | 21 / 15 / 0 | 21 / 13 / **2** | **21 / 15 / 0** |

- From L39: clocks 5225 and 5227 are newly clean. Both are **game-witnessed** on p4g: 1,720/1,720 ticks, 0 hits, end = model.
- From L43: 5234 and 5235 (L40's 2-hit plans) now refuse by name, `SHOVED_LOOKAHEAD_HIT`.
- Every other ON row is plan-identical to L40's ON. Every work count is within the 2,560 budget.

**The one thing to know first: the brief's two fixes do not reach the two defects they were aimed at. I measured that and
added a third part.**
- **The hits.** Of the 2 chaser hits, only t832 falls on a tick the deep step answered. Pricing chasers removes it.
  - The t776 hit is billed on a tick no deep answer ran.
  - The deep step's corner escape (t649–654) carries the solve into a stretch OFF never reaches at this clock. A later
    verb accepts a chaser contact there.
  - So a segment refuses by name when (1) a deep answer chose a key OFF would not have, and (2) its plan then takes a
    player hit.
- **The cost.** The 821–1,124 s is not the deep search. Over L40's whole 5235 solve, the deep search spent 40,574 steps.
  - 692 s of the profiled 796 s is OFF's own 4-tick `stepToward` survival search.
  - It runs about 1.43 M times inside `hammerPhaseRung → previewPressApproach`, on the path the escape opens.
  - OFF pays the same in this room: L43 5227 OFF takes 1,117 s.
  - The per-solve cap (b) is built, but no measured solve comes near it. The wall time is a hand-over (§ 9.1).

## 3. The reproduction (measured)

**Tool.** `tools/clock.mjs` takes the committed fixture request (`fixtures/hammer-l40-spinner-walls/chest-L{39,43}-request.json.gz`).
It re-stamps `staging.seam.time` and runs the worker's dispatch (`solveAnytime` at the request's own 2,560 budget), then
replays the plan on a fresh run. `tools/table.sh` drives it.
- Load: 4 solves at once (wall times below are under that load).
- Tables: `clocks/*.jsonl`, `clocks/*.txt`, and `clocks/compare.txt` (`tools/compare.py`).

**OFF at my base** (`clocks/base-off.*`):
- It is **plan-identical to L40-SPINNER-WALLS' OFF tables** on every clock both have: 36/36 L39, 35/35 L43. L40's L43
  5227 was a timeout row; here it solves clean, 1,992 t, as its § 9.4 re-run found.
- So the corridor flip and the hammer stack move nothing on these legs.

| leg | refused clocks OFF (the wall) |
|---|---|
| L39 | 5225, 5227, 5228 (approach corner); 5241, 5242 (landing rebound) |
| L43 | 5222–5226 and 5234, 5235 (approach corner); 5232, 5233, 5236–5240 (combat ladder EXHAUSTED); 5219 (anytime deadline) |

**L40's ON at my base** (`clocks/base-on-l40.*`) reproduces its own § 3.2 table:
- L39 refused 5 → 3;
- L43 5226: corner → combat ladder;
- **L43 5234 and 5235: the same 2-hit plan `b798d4d96374`** (`bob@736,752` t776, `bob@736,800` t832), 834 s and 835 s.

**Where the 2 hits and the time come from** (L43 5235, L40's ON; `probes/`):
- **Trace** (`probes/l40-on-L43-5235.trace.jsonl.gz`): 510 deep answers on 127 ticks (t532–t1146), 40,574 steps in all.
  - The answers that differ from the walk's key cluster at t649–654, the corner escape.
  - **No deep answer runs at t671–t716 or t735–t798.** The t776 hit is in the second gap.
  - At t832 a deep answer ran and kept `left+down`, with no chaser priced.
- **Profile** (`probes/l40-on-L43-5235.profile.txt`, `tools/profsum.js`), inclusive:
  - 796 s solve;
  - `hammerPhaseRung` 692 s;
  - `previewPressApproach` 691 s;
  - `stepToward` 674 s, of which its own `survives` (OFF's 4-tick search) is 599 s;
  - `shovedStepToward`: below the 3.8 s cut of this profile's top 45 rows (5.8 s in the L39 5225 profile).
- **Chasers alone** (`probes/chasers-only-L43-5235.json`, part (a) built, before (c)): **one hit left** (t776). 12 first
  keys were cut by a chaser; plan `e6b9e03b3e48`, 1,673 t.

## 4. Design, change, OFF identity

**Stated before the code** (the brief's (a) and (b)), then **(c)**, added on the measurement in § 3. All three are under
the one switch. `SHOVED_BODY_LOOKAHEAD_TUNING {chasers, solveSteps, hitGate}` exists only so a measurement can ablate a
part (`clock.mjs --chasers=0 / --solve-steps=N / --hit-gate=0`). It ships `{true, null, true}`.

**(a) The deep step prices the chasers** (`shovedChaserTest`, used by `shovedSurvival`). Where the room has a chaser
forecast (`run.chaserForecast()`), a deep node must be clear of the chasers as well as the spinners.
- **The first tick is exact.** It is PKC's `landsClearOfChasers` pairing: a fresh forecast stepped once against the
  player as the tick starts, then against the stepped player. The test is `chaserDanger(…, {perTick: true})`. PKC's own
  counters are not touched.
- **Deeper ticks** use one forecast stepped on with the player held where it stands. The deep search does not branch
  the chasers, so a depth is a heuristic's, like its memo's. The live tick is still adjudicated by `safeStep`.
- **A shake-band throw leaves that answer unpriced for chasers** (`banded`, PKC's rule).

**(b) One deep-step budget per solve** (`withShovedSolveBudget`, `SHOVED_SOLVE_STEPS` = 2,000,000).
- Installed at the top of `solveSegment` when the switch is on and none is active; a nested segment shares its solve's.
- Every deep answer's preview steps and chaser-forecast steps are charged to it.
- When it is spent, every later tick answers as OFF (`solveSpent`).
- The per-answer cap (`SHOVED_LOOKAHEAD_STEPS`, 20,000) still applies.
- Measured headroom: the most any segment needs is half of 1.17 M (L39 5225/5227, 2 passes). No solve in either table
  or the census spent it (`solveSpent` 0 everywhere).

**(c) A re-choice may not end hit-taking** (`SHOVED_LOOKAHEAD_HIT`, the same install).
- **The mark** (`rechoseAt`) is the first tick where:
  - a walk's deep key differs from the key **OFF's `stepToward` chooses on that same tick** (`shovedWalkStep` asks it
    with the switch held OFF for one call, and only until the first mark); or
  - a hold re-chooses (`shovedHoldStepOut`).
- **At the segment's end**, if the run it ended on (`liveRun`, else `o.run`) carries a player hit at or after the mark,
  the segment is refused by name.
- **A first cut marked against the walk's *intended* key.** The fixture census caught it:
  - leg 872's fixture (`level_40__r48c54 <- in_L43_176_464 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared`)
    solves OFF with a t790 bob hit (`de54d9e0ba72`);
  - OFF's own step departs from the intended key near spinners, so the first cut refused that plan ON (`clocks/fix/census-before-gate-fix.tsv`);
  - marked against OFF, it solves ON exactly as OFF does, and L43 5235's mark moves from t533 to t649 (the escape).
- **An early variant was measured and removed:** refusing at the hit's own tick, on the segment's own run. It never
  fired, because the hit lands on a run that is not the segment's own. It saved nothing (§ 8.3).

**Call sites** (`solverBot.js`; new functions plus single lines, nothing renamed or reformatted):
1. `solveSegment`'s first line: `if (SHOVED_BODY_LOOKAHEAD.enabled && shovedSolveBudget === null) return withShovedSolveBudget(o, () => solveSegment(o));`
2. L40's `stepToward` line now calls `shovedWalkStep` instead of `shovedStepToward`.
3. L40's executor line is unchanged.

L40's `shovedStepToward` / `shovedDepthOf` now share one survival search (`shovedSurvival`). With no chaser forecast and
an unspent budget it counts steps exactly as L40's did.

**Thread.** All of it runs inside `solveSegment`, in the page's solve worker. No main-thread mapper reads the switch.

**No game constants.** No level id, no coordinate, no Seedling constant. The rows' witnesses are named legs.

**Instruments.**
- `SHOVED_BODY_LOOKAHEAD_SOLVE_COUNTS {chaserCut, banded, solveSpent, charged, hitRefused}`;
- `SHOVED_BODY_LOOKAHEAD_TRACE.sink` records `{solveSpent}`;
- L40's `SHOVED_BODY_LOOKAHEAD_COUNTS` is kept.

| OFF identity (acceptance md5) | value |
|---|---|
| base `71adf001dd` (worktree at the base) | `391322d681b7aa0229d94b3f6906d024` |
| after the merge `bb70bdb0`, OFF / ON | `391322d681b7aa0229d94b3f6906d024` / `391322d681b7aa0229d94b3f6906d024` |
| `f9b13ed4`, OFF / ON | `391322d681b7aa0229d94b3f6906d024` / `391322d681b7aa0229d94b3f6906d024` |
| `e6d4d81e` (head code), OFF / ON | `391322d681b7aa0229d94b3f6906d024` / `391322d681b7aa0229d94b3f6906d024` |

**The clock tables at the head code.** `clocks/followup-on.*` ran at `f9b13ed4`'s logic. `e6d4d81e` only narrows (c)'s
mark, so it can change a row only where (c) refused, and in the table (c) refused 5234 and 5235 alone.
- Those two were re-measured at the head code (`clocks/fix/`): still refused by name, mark t649.
- L39 5225 was re-measured as a control: identical, `f90b8e0581d6`.

## 5. Rows and bounded vitest runs

| file (tier) | rows | result |
|---|---|---|
| `hammerShovedLookahead.test.js` (default) | L40's 4, plus: the parts ship on (`TUNING` = `{chasers: true, solveSteps: null, hitGate: true}`, `SHOVED_LOOKAHEAD_HIT`); a segment's own refusal passes through the budget install unchanged, twice running | in the bounded run below |
| `hammerShovedLookahead.train.test.js` (train) | L40's 3 (L39 5225 OFF refused / ON `{1636 t, f90b8e0581d6, 0 hits}`; control 5233 OFF = ON), plus **L43 5235**: OFF refused at (739.26,683.90); ON refused by name, *"chose a key OFF would not have at t649 … 1 player hit(s) (bob@736,752 at t776)"* | **4 / 4 passed, 1,480 s** (`vitest-train.txt`; the new row alone takes 1,078 s) |
| bounded neighbours: `hammerShovedLookahead`, `hammerBodyGate`, `hammerSlashRect`, `hammerFightFallback`, `hammerOppPressFallback`, `fidelityF1c`, `solverEnvChannel`, `hammerPressKillChasers`, `hammerStrikeEtaFloor` | the switches' and guards' own pins, OFF | **9 files, 81 tests passed** (`vitest-bounded.txt`, at the head code) |

**Producers:**
- `census-seedling-solver-surface.mjs --write`: 375 rows; `--check` GREEN;
- `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions match;
- `generate-docs-index.mjs --check`: current.

No doc under `docs/json/developer/procgen/` was edited, so no link-census pin is owed. Not run, per the rules: unfiltered
local vitest, `pytest`, `standing-values --write`. The suite number is CI's at the pushed SHA.

## 6. Game witness (p4g)

**Newly clean ON vs OFF:** L39 clocks 5225 and 5227. Both clocks' anytime plan is `f90b8e0581d6`.
- **Method:** L40's `legwitness.mjs`, at the head code. It stages the fresh page's slot array, solves dashless uncapped
  in node, and plays the plan on `seedling_bot_ap_p4g`: headless logic-only, under the box lock, delivered AP set.
- **Server:** I started `serve-nocache.py` on port 8000 and stopped it by PID after each play.

| clock | model (node) | game |
|---|---|---|
| 5225 | 1,720 t, work 786, 0 hits, end (888.2634236355025, 823.2357685060285) | **finished 1,720 / 1,720, 0 hits, end equal to the model's to the last digit**, clears `40:13` (the chest), `40:16` |
| 5227 | the same plan and end | **finished 1,720 / 1,720, 0 hits, end equal**, clears `40:13`, `40:16` |

- **5225's tape inputs are byte-identical to L40's witnessed tape.** Only `name` differs: `leg380` vs `legnull`.
- 5227 plays the same inputs from a different clock.
- Evidence: `game/l39-522{5,7}-{plan,on.tape,on.game}.json`, `game/*-solve.txt`.

L43 5227's anytime plan changes ON (`1e24450654df` → `c6179b256be3`), clean both ways, as in L40's ON. It is not newly
clean, so I did not witness it (§ 9.4).

## 7. Census: which seed-1 sweep legs the change can move

**The 34 captured page requests under `fixtures/`** (`census-fixtures-cap2560.tsv`; `tools/census.mjs` is L40's, plus
the solve counts; first request, dashless pass, defaults, cap 2,560):
- **OFF = ON on all 34**: verdict, work, ticks and plan sha.
- The deep step is active on 10 of them. Chaser cuts: 0. Gate refusals: 0. Solve budget spent: 0. Charged: 2.8 k–7.5 k
  each.
- Four fixtures moved OFF between L40's base and mine, and are OFF = ON here. These are the corridor flip's / hammer
  stack's, not this switch's:
  - `hammer-l53-killlock/leg9001-l51-l53-retry2560` and `…/leg9002-l48-l53-retry2560`;
  - `hammer-new-locks/leg910-l48-l53-retry2560` and `…/leg911-l51-l53`.

**The legs, by key**, where the deep step runs: a press kill's walk meets a spinner moving faster than `moveSpeed` in the
run's own forecast.

| leg (key) | fixture | deep step | moves? |
|---|---|---|---|
| `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest` | `hammer-l40-spinner-walls/chest-L39` | 113 asks deep | the fixture's clock: no. Clocks 5225/5227: refused → clean (witnessed) |
| `level_40__r26c13 <- in_L43_176_464 -> location:Level 040 - Chest` | `…/chest-L43` | 51 | the fixture's clock: no. 5226: corner → ladder; 5227: plan change, clean; 5234/5235: corner → `SHOVED_LOOKAHEAD_HIT` |
| `level_40__r48c54 <- in_L39_144_0 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared` (871) | `hammer-cleartag-chain/leg871` | 67 | no |
| `level_40__r48c54 <- in_L43_176_464 ~> level_40__r23c29 -> location:L40 flag 12: wandlock@480,560 cleared` (872) | `…/leg872` | 87 | no (its OFF-owned t790 hit is kept, § 4 (c)) |
| `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2` | `hammer-cpair/leg853`, `spin-witness/leg860` | 56 | no (deadline both ways) |
| `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` | `hammer-bx-371/leg371` | 86 | no |
| `level_40__r0c53 <- in_L42_240_336 -> location:L40 flag 1: wandlock@176,80 cleared` | `hammer-l40-flip/leg377` | 86 | no |
| leg 376 (the fixture carries no key) | `hammer-376-bomb/leg376-l40` | 47 | no |
| `level_18__r1c1 <- in_L16_352_80 -> location:L18 flag 0: lock@144,112 cleared` | `hammer-new-locks/leg223` | 206 | no |

**Why only these.**
- The deep step runs only where a spinner is shoved: L40's spinner rooms and L18's lock room.
- **Against L40's ON, the follow-up can differ only where:**
  - (a) a chaser lies inside a deep answer's first-tick test or horizon. Measured: only L43 5234/5235's escape has
    `chaserCut` > 0;
  - (b) the budget is spent. Measured: never;
  - (c) a plan whose key diverged from OFF takes a hit. Measured: only L43 5234/5235.
- **The sweep verdicts are a draw of the arrival clock** (L40 § 7). At the clocks the base page drew (L39 5233/5237,
  L43 5230/5231), ON and OFF are the same plan.

## 8. What the brief got wrong (measured)

1. **"The deep step prices CHASERS … so a spinner-safe walk cannot enter a chaser's reach" as the remedy for the hits.**
   - It removes one of the two (t832).
   - The other (t776) is billed on a tick no deep answer ran (§ 3). It follows from the deep step's corner escape, but
     no deep choice walks into it.
   - With (a) and (b) alone, L43 5234/5235 still return a 1-hit plan (`probes/chasers-only-L43-5235.json`).
   - Hence (c).
2. **"Cap the deep search's total cost per solve" as the remedy for the 821–1,124 s.**
   - The deep search is not the cost: 40,574 steps over L40's whole L43 5235 solve, 65–67 k with chasers priced.
   - The time is OFF's own `stepToward` survival search in `hammerPhaseRung`'s previews (§ 3, `probes/l40-on-L43-5235.profile.txt`).
   - The cap is built and lands with the switch, but it binds on no measured solve.
3. **"Every ON solve within the page's work budget".**
   - **In work units, yes.** Every ON solve stays within the request's 2,560. Two solves trip the deadline:
     - L43 5219 at 2,564, the same OFF;
     - L43 5226 at 2,561, the combat ladder's (it refused at the corner OFF).
   - **In wall time, the slow ON rows are the rung's.** Under 4-way load:
     - L43 5225 refused: 1,188 s ON vs 330 s OFF;
     - 5226 refused: 543 s vs 323 s;
     - 5227 clean: 991 s vs 1,117 s OFF;
     - 5234/5235 refused by name: about 715–790 s vs about 285 s.
   - Each of these ON rows asks the deep step about 1.42 M times, but charges at most 352 k steps. OFF's slow 5227 does
     the same work, so this is the room's rung cost, not the switch's (§ 9.1).
   - The early hit refusal I tried (§ 4) cannot cut it short: the hit lands on a run that is not the segment's own.
4. The brief's premise that the two L43 clocks "become hit-taking plans" reproduces exactly at this base: plan
   `b798d4d96374`, the same hits.

## 9. Residue and hand-overs

1. **Hand-over: the rung's wall time in L40's spinner rooms.**
   - `hammerPhaseRung → previewPressApproach` calls `stepToward` about 1.4 M times per solve on these paths. Each call
     runs the 9⁴ survival tree.
   - It costs 600–1,100 s of wall time with no work unit charged: OFF L43 5227 takes 1,117 s at work 1,616.
   - That is above the page's 300 s backstop whether or not this switch is on. It is solverBot code (F1c's rung), not
     fidelity's. Suggested measurement: count the rung's preview asks per work unit.
2. **Not changed:**
   - L39 5241/5242 (OPP's landing rebound; L40's § 9.2);
   - L39 5228 (a later corner);
   - L43's combat-ladder walls and the 5219 deadline;
   - the forecast's missing shield bump (fidelity, L40's § 9.3).
3. **(c) is conservative by construction.**
   - The mark can come from a preview's walk.
   - A plan whose keys diverge from OFF and then rejoin it is still refused if it takes a hit later.
   - Measured, it refused only L43 5234/5235. Every other ON row in both tables and the census equals OFF or L40's ON.
4. **L43 5227's new ON plan** (`c6179b256be3`, clean, 1,994 t) is not game-witnessed. Its dashless pass is a ~1,000 s
   node solve, and it is not newly clean.
5. **The train row's cost.**
   - The new L43 train row takes 1,078 s. `scripts/test/train-shard-costs.json` has no row for this file (as for L40's),
     so it runs on the lightest shard with a warning.
   - The planner may prefer to keep only the L39 rows in the train tier.
6. **Housekeeping:**
   - Two scratch worktrees I created remain: `/tmp/claude-0/basewt` (base md5) and `/tmp/claude-0/dev` (the dev copy).
     My `git worktree remove` was refused by the permission prompt. Both are under the session's temp directory, hold
     nothing tracked beyond their checkouts, and can be removed with `git worktree remove --force`.
   - The servers I started were stopped by PID.
   - The tools write nothing tracked. Their inputs are the committed fixtures, plus a capture line rebuilt from the L39
     fixture (`/tmp/claude-0/s/req-L39.jsonl`) for `legwitness.mjs`.
