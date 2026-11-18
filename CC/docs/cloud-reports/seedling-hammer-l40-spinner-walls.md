# Seedling hammer-phase L40-SPINNER-WALLS: the L40 Chest refusals are a shoved spinner outrunning a 4-tick lookahead, drawn by the arrival clock

Slice `seedling-hammer-l40-spinner-walls` (Opus, cloud). Planner `seedling-hammer-phase-planning-8`. ⚖ Approved by the
user on 2026-11-14 ("L40 spinner walls"). Landing it needs the user's SHA-bound OK through the planner.

## 1. SHAs

| | |
|---|---|
| Start (base) | `4c3afd9b32` (`origin/hammer-harvest-wave2`, = main `39e8a29f7f` TRAIN 104 + the wave-2 OFF switches) |
| Code | `e6d13a50` (the switch), `f85a0557` (stepToward hands the shoved check its own forecast; no choice moves) |
| Rows | `774d80ff` (default rows, the two captures as fixtures), `f85a0557` (train rows) |
| Surface | `ce6deaa2` (`census-seedling-solver-surface.mjs --write`) |
| Head | the commit carrying this report (evidence included) |
| Branch | `claude/seedling-l40-spinner-walls-bsk50m` |

No planner follow-up arrived while I worked, so I followed the brief alone.

## 2. The answer first

**Switch: `SHOVED_BODY_LOOKAHEAD`** (`SEEDLING_SHOVED_BODY_LOOKAHEAD=1`, `withShovedBodyLookahead`; in `SOLVER_ENV_NAMES`).
It ships OFF. The acceptance md5 is the same OFF and ON, `391322d681b7aa0229d94b3f6906d024`, equal to the base.

**The one thing to know first: neither refusal is about flag 12, and neither is at the clock the page draws today.**
- At the base, the page sweep (p4g) solves all four arms hitless: with and without `L40:12`, from L39 and from L43
  (§ 3.1).
- The refusals come back when the **arrival clock** (`staging.seam.time`) is moved. Across clocks 5215–5250 the two
  arms are **identical, clock by clock, plan by plan**.
- rules-7's two refusals were the clocks its pages drew: L39 with the flag drew 5242, without it 5243; L43 without the
  flag drew 5235, with it 5217. Both refusals reproduce exactly at those clocks.

**The wall is one physical thing, a SHOVED spinner.**
- The player's own shield bump, or a press landing's knockback, sends a live spinner off at 3–5 px/tick. It rebounds
  off the room's wall and pins the player inside four ticks.
- `stepToward`'s survival search is capped at `STEP_LOOKAHEAD` = 4, whose own docblock premise is a body at
  `SPINNER.moveSpeed` (1 px/tick). So it scored the doomed key as fully safe.
- It is not the press kill's own step-out, and not the hammer line's geometry. Of the three named causes, an OPP
  landing is the trigger only for 5241/5242.

**ON, L40 Chest from L39** (36 clocks, worker dispatch, shipped defaults):
- refused drops from **5 to 3**; clocks 5225 and 5227 now solve **hitless**;
- the other 31 clocks are byte-identical (spot-checked: 5216, 5233, 5243);
- **game witness**: 1,720/1,720 ticks on p4g, 0 hits, and the end equals the model's.

**ON, L40 Chest from L43:**
- 5226 moves on to the next wall (the combat ladder);
- **5234 and 5235 now return a plan with 2 chaser hits (hit-taking, not clean)**, and cost about 5× the time;
- the other measured refused clocks are unchanged, and the page's own clock 5230 is identical.

**So this is not a landing candidate as it stands:** see § 9.1.

## 3. The reproduction (measured)

### 3.1 The page, at the base

The leg list was re-derived at the base with `seedling-divergence-legs.mjs` (923 legs; `--carry-route-flags` for the
carry list). The two L40 Chest legs, by key:
- `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest` (id 380): arrival (480,896);
- `level_40__r26c13 <- in_L43_176_464 -> location:Level 040 - Chest` (id 396): arrival (320,592).

The default list stages nothing for either. The carry list stages `L40:12` (`carriedFlags`). After BK2 the goal's rule
is `True_`.

`probe-seedling-divergence-sweep.mjs --mode=inv --page-legs=1 --leg-budget-ms=480000 --page=seedling_bot_ap_p4g
--keys=… --capture-requests=…`, once per list (`evidence/sweep/*.rows.jsonl.gz`):

| arm | L39 | L43 |
|---|---|---|
| no flag (default list) | **done**, clock 5233, 1,317 t, 0 room hits | **done**, clock 5230, 1,229 t, 0 room hits |
| `L40:12` staged (carry) | **done**, clock 5237, 1,305 t, 0 hits | **done**, clock 5231, 1,130 t, 0 hits |

Node, given the same captured requests (`tools/solve.mjs`, `solveAnytime` at the request's 2560 budget), gives the
page's ticks exactly (1,317 / 1,229). A dashless uncapped pass (the witness's node method) solves all four too.

### 3.2 The arrival clock decides

Each captured request was re-stamped to clocks 5215–5250 and solved by the worker's dispatch (`evidence/seams/`):

| leg | clean | refused | by wall |
|---|---|---|---|
| from L39, no flag | 31 | **5** | approach corner 5225, 5227, 5228; landing rebound 5241, 5242 |
| from L39, flag | identical to no-flag on every clock (same plan sha) | | |
| from L43, no flag | 21 (5227 clean: 1,992 t, re-run alone, § 9.4) | **15** | approach corner 5222–5226, 5234, 5235; combat ladder EXHAUSTED 5232, 5233, 5236–5240; anytime deadline 5219 |
| from L43, flag | identical to no-flag on every clock | | |

rules-7's rows match this table:
- clock 5243 from L39, dashless 1,126 t at work 705: its game row;
- clock 5242: "no step out" at (868.73,855.83);
- clock 5235 from L43: "no step out" at (739.26,683.90).

### 3.3 What makes "no step out"

These rows come from the probe `tools/corner.mjs` (SPINNER-CORNER's tool on my captures). Before each tick it runs a
survival search over every first key set, against the run's own forecast and `safeStep`'s own predicate, up to 12 ticks
(`evidence/probes/depth*.txt`).

**Approach corner, L39 clock 5225** (`kill (spinner@880,848) by press`; the corner is at (741.44,685.29)):
- At t646 the walk pushes `down` into **`spinner@816,848`**, a live body with hits 0 and no i-frame. The player's shield
  bumps it; its rect moves +4.86, +4.6, +4.4 px/tick east and rebounds off the wall at x ≈ 767 at t649–650.
- From t647 the run's forecast carries that velocity. The walk's keys came from the approach certificate (`charted`, B1),
  derived before the bump and replayed while the player's state still matched it.

| t | key taken | survival depth of each first key (cap 12) |
|---|---|---|
| 645 | down | all 12 |
| 646 | down | `down` 8, `down+left` 10, the rest 12 |
| 647 | down | `stand`/`down` **7**, `left`/`down+left` 8, `up`/`right`/`up+*`/`down+right` 12 |
| 648 | down | `down` **6**, `up`/`right` 12 |
| 649 | down | `down` **5**, `up`/`left`/`right` 12 |
| 650 | down | best 8 (`left`, `down+left`) |
| 651 | left | best 3 |
| 653 | left+down | best 1 → the corner at t654: all 9 sets meet the body |

Capped at 4, `down` scores the maximum on every one of those ticks and wins on progress toward the aim. Clock 5228 is
the same rebound one tick later: at t649 only `up`, `up+left` and `up+right` survive 12, and the walk took `left+down`
(depth 4).

**Landing rebound, L39 clock 5241** (SPINNER-CORNER's seam):
- At t1356 OPP presses `bobsoldier@880,832`. The swing also lands on `spinner@816,848` at t1360 and knocks it back.
- At t1361 `stand` survives 6 while `up+left` and `down+left` survive 12, but the no-aim ticks stand (t1361–1363).
- The corner forms at t1367.

## 4. Design, change, OFF identity

**The design, stated before the code.** `STEP_LOOKAHEAD`'s premise is a body at `moveSpeed`. The smallest generic change
is to make the lookahead as deep as the bodies are fast, and only when they are:

- **`shovedHorizon(forecast)`** (pure): the fastest per-row displacement of any body, rows compared index by index
  while they hold the same bodies. At most `SPINNER.moveSpeed` (with 1e-6 float slack) gives `STEP_LOOKAHEAD`.
  Otherwise it gives `ceil(STEP_LOOKAHEAD × v / moveSpeed)`, capped at **`SHOVED_LOOKAHEAD_MAX` = 2 × `STEP_LOOKAHEAD` = 8**.
  Measured: every doomed key survived 3–7 and every survivor 12+, so 8 separates them. A cap of 12 spent the step budget
  at t1361–1362 of clock 5241, the ticks that matter.
- **`shovedStepToward`**: `stepToward`'s options, order and score (survival depth first, distance to the aim second),
  with the horizon from `shovedHorizon`.
  - It is a DFS, memoised on a 0.5 px / 0.1 px-per-tick player grid, with **`SHOVED_LOOKAHEAD_STEPS` = 20,000** preview
    steps per answer.
  - It answers `null` (which means today's code runs) when no body is shoved or the budget is spent.
  - The memo merges near-identical previews, so a depth is a heuristic's; the live tick is still adjudicated exactly by
    `safeStep`.
- **`shovedHoldStepOut`**: on a tick whose key no walk chose (no aim: a stand or the escape certificate's key; or the
  approach certificate's `charted` key), the key is kept unless another set survives strictly deeper under the shoved
  horizon. A re-chosen charted key leaves the certificate's states, so `approachHeld` ends the certificate on the next
  tick.
- **Call sites** (`solverBot.js`, new functions plus two one-line sites; nothing renamed or reformatted):
  1. `stepToward`, after its forecast: `if (SHOVED_BODY_LOOKAHEAD.enabled) { … shovedStepToward(…, forecast) … }`;
  2. the press-kill executor, after `holdStepOut`'s line:
     `if (SHOVED_BODY_LOOKAHEAD.enabled && (charted !== null || !aim)) held = shovedHoldStepOut(run, held, aim);`.
- **Thread**: everything runs inside `solveSegment`, in the page's **solve worker**. No main-thread mapper reads the
  switch. `?seedlingSolverEnv=SEEDLING_SHOVED_BODY_LOOKAHEAD=1` reaches it.
- **Instruments**: `SHOVED_BODY_LOOKAHEAD_COUNTS {asked, deepened, rechosen, spent}` and `SHOVED_BODY_LOOKAHEAD_TRACE.sink`.
- **No game constants**: no level id, coordinate or new Seedling constant; the speeds read are the run's own forecast's,
  and `SPINNER.moveSpeed` is the model's table entry.

| OFF identity | value |
|---|---|
| acceptance md5 at base `4c3afd9b32` (main `39e8a29f7f`, per the brief) | `391322d681b7aa0229d94b3f6906d024` |
| at `e6d13a50`, OFF / `SEEDLING_SHOVED_BODY_LOOKAHEAD=1` | `391322d681b7aa0229d94b3f6906d024` / `391322d681b7aa0229d94b3f6906d024` |
| at `f85a0557`, OFF / ON | `391322d681b7aa0229d94b3f6906d024` / `391322d681b7aa0229d94b3f6906d024` |

## 5. Rows and bounded vitest runs

| file (tier) | rows | result |
|---|---|---|
| `hammerShovedLookahead.test.js` (default) | the switch (OFF, env name, wrapper restores on a throw); `shovedHorizon` (a body at moveSpeed in any heading → 4; 1.5 px → 6; 1.70 → 7; the witness's 4.86 / 3.4 px/tick → 8 capped; a removal stops the read; a one-row shove → 8) | with `solverEnvChannel.test.js`: **2 files, 15 tests passed** |
| `hammerShovedLookahead.train.test.js` (train) | L39 clock 5225 OFF: refused, "no step out" at (741.44,685.29). ON: `{ok, 1636 t, sha f90b8e0581d6, 0 hits, 0 deaths}` on a fresh run. **Control** clock 5233 (the page's draw): OFF = ON, `{1317 t, ff95a231a1b7, 0 hits}` | **3 / 3 passed**, 427 s (`evidence/vitest-train.txt`) |
| bounded neighbours: `hammerShovedLookahead`, `hammerBodyGate`, `hammerSlashRect`, `hammerFightFallback`, `hammerOppPressFallback`, `fidelityF1c`, `solverEnvChannel` | `safeStep`'s, the rung's and the guards' own pins, OFF | **7 files, 60 tests passed** (`evidence/vitest-bounded.txt`) |

The brief's named controls:
- **871** (`level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`),
  under the train row's set: OFF = ON, refused at work 885 with the same message (`evidence/leg871-{off,on}.txt`).
- At the shipped defaults (fixture census below), the 871 request is `ok/973/1437/84c11e38a2a5` both ways.
- The solved L40 controls are byte-identical: L39 clocks 5216, 5233 and 5243, and L43's page clock 5230.

**Interaction with the three switches** (`evidence/seams/interactions.txt`, worker dispatch):

| clock | `HAMMER_BODY_GATE` / `OPP_DASH_DEFERS` / `OPP_FALLBACK_HITS`, each alone | all three | + `SHOVED_BODY_LOOKAHEAD` |
|---|---|---|---|
| L39 5225 | refused, same corner (each) | refused, same corner | **solved, the same plan `f90b8e0581d6`** with each one, and with all three |
| L39 5228 | — | refused, (739.28,683.81) | refused at the strike cell (745.71,792.86), as mine alone |
| L39 5241 | — | refused (867.94,850.52) LANDED | refused (863.54,850.06) LANDED; the same with `HAMMER_BODY_GATE` alone |
| L43 5235 | `OPP_FALLBACK_HITS` alone: refused, same corner | refused, same corner | with `OPP_FALLBACK_HITS`: the same **2-hit** plan `b798d4d96374` |

The switches are independent: none of the three moves the approach corner, and none changes my switch's plan.
`OPP_FALLBACK_HITS` does not catch L43 5235's hits, so they are not an `OPP_PRESS_FALLBACK` redo's.

Producers:
- `census-seedling-solver-surface.mjs --write` wrote 373 rows (only my new sites) and `--check` is GREEN;
- `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions match;
- `generate-docs-index.mjs --check`: current.

No doc under `docs/json/developer/procgen/` was edited, so no link-census pin is owed. Not run, per the rules:
unfiltered local vitest, `pytest`, `standing-values --write`. The suite number is CI's at the pushed SHA. The new train
file has no row in `scripts/test/train-shard-costs.json` (it runs on the lightest shard with a warning; about 430 s here).

## 6. Game witness (p4g)

`tools/legwitness.mjs` is rules-7's tool, plus `--key` and `--seam`. It stages the fresh page's slot array (rules-7's
slot-trap fix) and solves dashless in node, uncapped:
- L39, clock 5225, ON: **1,720 t, work 786**; the model replay is hitless and ends at (888.2634,823.2358).
- OFF, the same staging: refused, "no step out" at (741.44,685.29), work 56.

Played on `seedling_bot_ap_p4g` (headless logic-only, under the box lock, delivered AP set):

| | value |
|---|---|
| game | **finished**, 1,720 / 1,720 ticks, **0 hits** |
| game end | (888.2634236355025, 823.2357685060285), equal to the model's to the last digit |
| game clears | `40:13` (the chest), `40:16`, the same set as rules-7's no-flag game row |

Evidence: `game/l39-5225-on.{game,tape}.json`, `game/l39-5225-solve.txt`.

## 7. Census: which seed-1 sweep legs can move

**The 30 captured page requests under `fixtures/`** (`census-fixtures-cap2560.tsv`, `tools/census.mjs`: the first
request's dashless pass at the defaults, capped at 2560):
- **OFF = ON on all 30**: verdict, work, ticks and plan sha are all equal.
- The switch deepened on 11 of them (the L40 spinner-room requests and L18's 223) and re-chose no no-aim key
  (`rechosen` 0).

**The sweep legs, by key.** At the clocks the base page drew, the switch moves **nothing**. Both L40 Chest legs already
solve there, and ON is byte-identical. The legs it can move are the press kills whose walk meets a **shoved** body: a
spinner moving faster than `moveSpeed` in the run's own forecast. Measured:

| leg (key) | OFF refused clocks (of 36) | ON |
|---|---|---|
| `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest` | 5 | **3**: 5225, 5227 clean; 5228 a later corner; 5241/5242 still LANDED |
| `level_40__r26c13 <- in_L43_176_464 -> location:Level 040 - Chest` | 15 | 5226 → combat ladder; **5234, 5235 → 2 chaser hits**; 5222–5224 unchanged; 5232, 5236, 5219 unchanged |
| 871 / 872 / 873 / 874 / 376 / 371 / 377 (L40 spinner-room fixtures) | — | unchanged at their captured clocks |

The sweep verdict on these legs is a draw of the arrival clock. A sweep run lands on a refusal only when its page's
clock falls in a bad band (from L39 about 5/36 of the band OFF and 3/36 ON).

## 8. What the brief got wrong (measured)

1. **"The SOLVER refuses it twice … from L39 WITH flag 12 … from L43 WITHOUT flag 12."** Both statements are true only
   at the clocks those pages drew (5242, 5235). Flag 12 changes nothing: every clock gives the same plan with and without
   it, from both doors. At the base the page draws 5233/5237 (L39) and 5230/5231 (L43), and all four arms solve hitless.
2. **"the 13 px hammer line … no step out" as the wall.** At the approach corners all 9 sets are blocked by a live
   body's **rect** (`body`). The line is not involved. The cause is a body shoved faster than the lookahead's premise.
3. **"Is it the press kill's step-out, an OPP landing, or the hammer line geometry?"**
   - 5225/5227/5228 and L43's corners: the approach walk's own shield bump, with the certificate's keys replayed after
     it (no landing, no line).
   - 5241/5242: an OPP landing's knockback (SPINNER-CORNER's class).
4. The witness's "(739.26,683.90)" corner from L43 is the L39 corner's pocket (737–742, 683–687): the same room, the
   same rebound, reached from the other door.

## 9. Residue and hand-overs

1. **Not a landing candidate as it stands (L43 5234/5235).**
   - ON turns two refused clocks into plans the model bills **2 chaser contacts** on (`bob@736,752` at t776 and
     `bob@736,800` at t832, verbs `bait, kill`).
   - The solve took 821–1,124 s against 150–170 s OFF, with 1.43 M asks on that path; above the page's 300 s backstop.
     Re-timed at `f85a0557` (forecast reuse): the same plan, 821 s (`seams/on-nocarry-L43-5235-at-f85a0557.json`), so
     the cost is that path's, not the re-ask.
   - Not caught by `OPP_FALLBACK_HITS`. The deep step chooses against spinners only (as `stepToward` does OFF), so a
     longer spinner-safe walk can enter a chaser's reach.
   - Next steps: price chasers in the deep step (`PRESS_KILL_CHASERS`' `landsClearOfChasers`, or a hit gate on the
     answer), and cap the deep search's total cost per solve. I did not build either; each needs its own measurement.
2. **OPP's landing rebound (5241/5242)**: still SPINNER-CORNER's hand-over 1. ON only moves the corner (to t1373,
   (863.54,850.06)). The stand at t1361 survives 8 under the coarse memo, and the rebound keeps closing past any 8-tick
   horizon. It needs OPP to be refused a press whose landing shoves a spinner it cannot escape: the escape's shield claim
   at defaults (fidelity / ESCAPE-EXACT).
3. **The forecast's missing shield bump (fidelity).** The approach corners begin with an unforecast player-caused shove.
   `forecastShieldBump` would let the certificate see it before the push; this switch only reacts to it from the next
   tick. That is fidelity's (`contactFidelity`), measured by SPINNER-CORNER as running out of budget at 393.
4. **L43 clock 5227** gave no line in both OFF sweeps: it was cut by the 900 s wall cap under four-way load. Re-run
   alone it **solves clean**: 1,992 t, 0 hits, 712 s (`seams/off-nocarry-L43-5227-rerun.json`). Wall time is not the
   page's budget (work units are), but legs in this room are slow.
5. **The other L43 walls**: "combat ladder EXHAUSTED" (5232, 5233, 5236–5240) and the anytime deadline (5219) are not
   shove corners, and this switch does not touch them.
6. **Residue**: no train-shard cost row (as § 5). The server I started (port 8000, `serve-nocache.py`) is stopped by
   PID at the end. The tools write nothing tracked; their `--req` inputs are this slice's captures (the fixtures carry
   each leg's final request).
