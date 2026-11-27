# Seedling hammer-phase FACE 1: the L40 `{40,12}` burn-stance wall is a patrolling body, and an idle at the goal's start answers it (`GOAL_START_WAIT`, OFF)

Slice `seedling-hammer-face1` (Opus, cloud). Planner `seedling-hammer-phase-planning-14`. ⚖ The user approved the slice on
2026-11-23 (*"Slice it now (Recommended)"*): measure first, switch-guarded OFF. Landing needs the user's SHA-bound OK through
the planner.

## 1. SHAs

| | |
|---|---|
| Start (base) | `5aaad790ebfd25a207c253afb7f72f2ecfe34386` (origin/main, TRAIN 202 hammer-flip-fade-rocklock). Main had not moved when this report was written (`git log 5aaad790..origin/main` empty), so no W56 re-merge was owed |
| Step 1 (measure) | `c0ed235e` — tools, the captured requests, the reproduction, the clock sweep, the stance probe (`BURN_STANCE_AVOID`, an OFF probe hook, measured inert and removed in the next commit) |
| Steps 2–3 (change + rows) | `1f0ae732` — `GOAL_START_WAIT` (OFF), the two test files, the fixture, the regenerated solver surface |
| Step 4 (part) | `17f5bacf` — the wait sweep, the p4g game witness |
| Head | the commit carrying this report (`Cloud-Status: final`) |
| Branch | `claude/seedling-hammer-face1-l40-yod0lk` (the harness's designated branch) |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-face1-evidence/` (`req/`, `repro/`, `game/`, `census/`, `survey/`, `tools/`) |

No planner follow-up arrived (`ReadNotifications` empty). I followed the brief alone.

## 2. The answer first

**Switch: `GOAL_START_WAIT`** (`SEEDLING_GOAL_START_WAIT=1`, `withGoalStartWait`, the solve **worker's** thread; OFF by default).
When a clear-tag goal's combat ladder is EXHAUSTED, ON rewinds to the goal's first tick, idles there (no keys) for 50, 100, 200,
400, 800 ticks in turn, and asks the goal again. It keeps the first answer that solves. If every wait refuses, it re-throws the
original refusal.

| captured request (re-measure-6 A1) | OFF | ON |
|---|---|---|
| 26:9 (the 2560 held retry, the stop) | refusal, work 331, 5.8 s, answer `b7bc62b65c94` (= the page's) | **SOLVED, 3290 t (a 50-tick idle, then 3240), work 1469 of 2560, 19.6 s, 0 hits, 0 deaths, flags 40:0 + 40:12** |
| 26:8 (the 640 pass) | refusal, work 642 (a budget cut), 11.0 s | budget cut, work 643, 14.4 s. The page's held retry is 26:9 |

- **Game witness (p4g, fresh page):** the ON plan, solved on the game page's own staging, played **3405/3405 ticks, 0 hits**. The
  end matches the model, and all **337 sampled ticks agree at offset 0** (§ 6).
- **OFF identity:** acceptance md5 `391322d681b7aa0229d94b3f6906d024` at the base and at the head.
- **Survey `--through=end`:** 224 SOLVED / 26 REFUSED both ways, **0 steps moved, none gained a hit**.
- **L40 sweep legs (38, by key, from L39/L43):** all 38 solve OFF and ON, **0 moved**.

**The one thing to know first:** this wall is not a hammer phase. The arrival clock only turns the hammer, so all 91 clocks of a
period refuse. What refuses every kill stance is the **`spinner@816,848` body's patrol**. The body walks its own route along the
corridor, into the burn-stance notch, and up the one-tile shaft through both bobs, and the player does not change that route. A
short idle at the arrival puts the body elsewhere, and the ladder's own line (bait, hold, kill) then solves hitless. The ladder
asks every rung on the tick the goal starts, and no rung waits for the room to move. That makes this class (a).

## 3. The reproduction (measured at the base)

**Tools** (`tools/`): `seam.mjs` solves one captured page request (cut from `A1.stop-requests.jsonl.gz` into `req/A1-26-{8,9}.json.gz`)
through the worker's dispatch (`solveAnytime`, the request's own budgets and passes). It can re-stamp the arrival clock
(`--seam`), idle W ticks before the segment (`--wait`, the live digest re-taken at tick W), or turn on a contact-fidelity key
(`--cf`). A solved plan is replayed on a fresh run to count its hits. `sweep.sh` runs it over a period of clocks.
`sweep-table.mjs` reduces each refusal to its rung shapes. `idle.mjs` advances the arrival with no keys and prints the bodies.
`stances.mjs` prints the burn-stance candidates and the tile map. It needs the step-1 commit `c0ed235e`, where the probe hook it
reads exists. The brief's `scripts/procgen/play-request.mjs` does not exist (§ 8). The replay tool is
`scripts/procgen/replay-seedling-solve-request.mjs`.

**Reproduced:** 26:9 → refusal, work 331, answer `b7bc62b65c94`. 26:8 → refusal, work 642 (dashless 331 + full 311), the same answer.
Both equal the page's (`repro/base-26-{8,9}.json`). The ladder, rung by rung (26:9, the captured clock 52129):

| rung | refused on |
|---|---|
| (the danger) | the corridor meets `chaser:bob@736,752` at (744.3,802.3) |
| avoid | the A* goal tile (55,51) for the burn stance (888,824) is not walkable: `bobsoldier@880,832`'s live volume (a 40×40 box) covers it |
| time | the aim is 408 px away and `MOVER_RANGE` reaches 48 px |
| bait | 0 cells in bob@736,752's 80 px leash cross a kill region |
| kill | no presser arms a trap over the body. **Chaser arm:** 81 cells in the leash, 11 reachable, **all 11 refused by the forecast: "the APPROACH is dangerous at tick 506 — spinner:spinner@816,848"**. Guard approach: the same 11 hit at tick 506 by the same spinner |
| narrow | the spinner's hammer at horizon 569 (phase 23/45) |
| detour, forced-hit | COVERED GOAL by name (`coveredGoalOf`): the aim's tile is inside the bobsoldier's volume |

**The room** (`repro/map-26-9.txt`, 16 px tiles, `#` wall, `.` walkable, `v` walkable but inside a danger volume, `b` bob, `S`
bobsoldier, `X` the spinner, `T` the tree). The only way in is the one-tile shaft at x 736–752 from the top. Both bobs stand in
it. It turns east into a one-tile corridor holding the spinner, and ends in the notch (x 880–896) where the bobsoldier stands under
the burn stance:
```
      5678901234567890123456789
 704  ###########.##...........
 752  ..........#b#.....#####..
 784  ..........#.#.....#T###..
 800  ..........#b#.....#####..
 816  ..........#.########v##..
 832  ..........#.########S##..
 848  ..........#.....X..vv##..
 864  ..........#############..
```
**The burn stance is not the lever** (`repro/stances-26-9.txt`). The tree has 3 candidate stances: (872,776), (888,824) and
(904,776). (872,776) and (904,776) are in another connected component (behind the tree), so no plan reaches them even with no
volume set. (888,824) is the only reachable one, and the bobsoldier covers it. The OFF probe `BURN_STANCE_AVOID` ranked
candidates by the AVOID plan and moved nothing (26:9 answer unchanged), so it was removed.

**The arrival clock is not the lever** (`repro/sweep-base-26-9.{jsonl,table.txt}`). Clocks 52084…52174, 45 either side of the
captured one (the spinner's period), give **91/91 refusals**, all EXHAUSTED at work 331 on `bob@736,752` with the goal covered.
By phase: the chaser arm's forecast always names `spinner@816,848`, at tick 506 on 75 clocks and 502–505 on 16. `narrow`
names the hammer on 41 clocks, `bob@736,800` on 48, and both on 2. **The refusal rate is 100% at every phase.**

**The body is the lever** (`repro/idle-26-9.txt`: the arrival advanced with no keys). The bobs and the bobsoldier stand still
(out of leash). The spinner body does not: it goes east into the notch (t100–200, at (892,823), on the burn stance), back
west (t300–400), **up the shaft through both bobs' tiles (t450–650)**, and out of the corner by t700. It is away until about
t2250, then returns down the shaft. The chaser arm's approach meets it in the shaft at t≈506 whatever the clock. L40-CORNER
measured the same thing: the clock turns only the hammer, and the body moves on its own.

**A hitless line exists in the model** (class (a)). The same request with the arrival idled W ticks before the solve
(`--wait`, `repro/wait-sweep-26-9.{jsonl,summary.txt}`, W = 25…2500 step 25): **77 of 100 solve hitless, 0 solve with a hit,
23 refuse**. The first solving wait is W=50 (3240 t after the idle). Every W from 250 to 350 gives 869 t. Verbs: bait, hold,
kill. Existing OFF switches do not answer it (`repro/existing-switches.jsonl`, `repro/chaserpass-20480.json`): `orbitFreeAim`
and `orbitFreeAim`+`strategyBoundDistinct` leave answer `b7bc62b65c94` unchanged. `CHASER_PASS` spends the whole budget in
`kill-chaser`, at 2560 and at 20480 too (deadline at work 20482, 273 s).

## 4. Design + change, OFF identity

`solverBot.js`: one switch block (`GOAL_START_WAIT`, `GOAL_START_WAIT_DEFAULT`, `GOAL_START_WAIT_COUNTS`, `withGoalStartWait`,
`isLadderExhausted`) beside `CHASER_PASS`, one closure in `solveSegmentUnder` (`execClearTagWaiting`, just before the goal
loop), and one call site (the clear-tag goal: `GOAL_START_WAIT.enabled ? execClearTagWaiting : execClearTag`).
`solverEnvChannel.js`: `SEEDLING_GOAL_START_WAIT` in `SOLVER_ENV_NAMES`. No reformatting, no renames. The thread is the
**worker** (the solve). No page-main-thread mapper reads it.

ON, when `execClearTag` throws the combat ladder's EXHAUSTED refusal, no deadline has tripped, and the segment has a rewind
(`forkRun`):
1. **Rewind** to the goal's first tick with the B3 rewind (`rewind.to(t0)`: a fresh fork replayed to `t0`, keys, equips,
   dashes and takes cut back).
2. **Cut back the per-goal logs** to their lengths at `t0`: trace rows, records, grazes, danger queries, the hypothesis ledger,
   the walk logs, forced hits and rewinds. Exemptions and refused orders go back to their sets, and the strategy bound, opener
   chain, plan extras and rides are reset. Progress frames the refused ask left open are closed with its reason.
3. **Idle** `waits[k]` ticks with no keys. An idle that takes a hit, dies or crosses a level edge stops the schedule, because a
   longer idle contains it.
4. **Ask the goal again.** The first wait that solves is kept. If none does, the first refusal is re-thrown unchanged.

The kept answer is the ladder's own, so the no-hit rules are the same rules. The wait adds only a prefix of empty key sets. It is
generic: no level, coordinate, enemy class or Seedling constant. The schedule (50…800, doubling) is a tuning constant on the
switch.

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gives
`391322d681b7aa0229d94b3f6906d024` at the base and `391322d681b7aa0229d94b3f6906d024` at `1f0ae732`. The OFF captured
requests are byte-identical to the base: same answer `b7bc62b65c94`, same work 331 / 642.
`census-seedling-solver-surface.mjs --write` → 374 rows, `--check` GREEN (site counts moved). `generate-procgen-reference.mjs`
and `--check`: all 7 modules and 5 regions match. `generate-docs-index.mjs` and `--check`: current. No docs under
`docs/json/developer/procgen/` were edited, so no procgenDocs pins are owed.

## 5. Rows + bounded vitest runs

| file | tier | rows | run |
|---|---|---|---|
| `frontend/modules/seedlingDemo/goalStartWait.test.js` | default | 4: ships OFF and is in `SOLVER_ENV_NAMES`; the waits are positive and strictly increasing; `withGoalStartWait` restores (also on a throw); only a `SolverRefusal` carrying the EXHAUSTED text is re-asked | `npx vitest run goalStartWait.test.js solverEnvChannel.test.js` → **2 files, 15 passed**, 4.8 s |
| `frontend/modules/seedlingDemo/hammerFace1GoalWait.train.test.js` | train | 2, on the captured request (`fixtures/hammer-face1/A1-26-9-request.json.gz`, 88 KB, data only): OFF refused EXHAUSTED and no wait asked; ON solved inside the request's budget, the kept wait is the plan's leading empty ticks, and a fresh run of the plan matches its expected rows with 0 hits, 0 deaths and the goal's flag earned (the flag is read from the request, not typed) | `npx vitest run --config vitest.train.config.js hammerFace1GoalWait.train.test.js` → **1 file, 2 passed**, 47.3 s |

No unfiltered vitest was run (ruling 52). The suite number is CI's at the pushed SHA.

## 6. Game witness (p4g, fresh page)

`tools/legwitness.mjs` (L40-SPINNER-WALLS's tool, unchanged) runs on `seedling_bot_ap_p4g`, headless logic-only, with the
delivered set, under the box lock. `serve-nocache.py` was started on 8000 for it and stopped by PID afterwards. The fresh page
builds its slot array from the held items, so the plan is solved on that staging: `--solve` with `GOAL_START_WAIT=1`, dashless,
gives 3405 t, work 1393, **its first 50 ticks empty**. The same staging OFF refuses: work 331, the EXHAUSTED text.

| | model | game |
|---|---|---|
| ticks | 3405 | **finished 3405 / 3405** |
| hits | 0 | **0** |
| end | (887.7120656115392, 776.6611944500224) | **(887.7120656115392, 776.6611944500224)** |
| flags earned | 40:0, 40:12 | 40:0, 40:12, 40:15 (40:15 is a pickup on the way) |
| samples | | **337 sampled ticks, 0 diverging at offset 0** (offsets −1 / +1: 85 / 80 diverge) |

Files: `game/a1-26-9-on-{plan.json,solve.log,play.log,samples.txt}`, `game/a1-26-9-on.{game,tape}.json`.

## 7. Census: which seed-1 divergence-sweep legs the change can move, and why

**Mechanism bound.** The switch is asked only for a **clear-tag** goal whose ladder throws EXHAUSTED, in a segment with a
rewind (the worker's `solveFromTape` always has one). In the leg list (922 legs, L40-PAIR's `legs.jsonl` at its base; keys are
stable), **103 legs** (90 not skipped) have a clear-tag location goal (`-> location:L<n> flag <k>: …`). The page also asks
clear-tag goals as **prerequisites** of other location legs, as at the A1 stop (entry 26 "Level 040 - Boss Key 2", prerequisite
"L40 flag 12: …"). Those reach the switch only through the page's walk, not through a sweep leg's own goal.

**Measured, by key:**
- **The 38 L40 legs arriving from L39/L43** (`census/l40-arrival-legs.txt`; the page's producer ask and one held retry, through
  L40-PAIR's `census-leg.mjs`, at each leg's fresh node clock): **OFF 38 SOLVED, ON 38 SOLVED, 0 moved, 0 gained a hit**
  (`census/{off,on}.jsonl`, `census/cmp.txt`). That includes all four `{40,12}` / Boss Key 2 legs: 862
  (`level_40__r32c36 <- in_L39_144_0 ~> level_40__r26c13 -> location:Level 040 - Boss Key 2`), 863 (`… <- in_L43_176_464 …`), 864
  (`level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`, 1101 t hitless after
  a held retry) and 865 (`… <- in_L43_176_464 …`). At their node clocks and node-built state none of them EXHAUSTS, so the switch is never asked.
- **Survey `--through=end`** (`survey/end-{off,on}.log`, `survey/diff-on.txt`): 224/26 both ways, 0 moved. 13 steps carry a
  clear-tag goal: 8 solve, and 5 refuse on other things (96, 111, 149, 174, 236; none is the ladder's EXHAUSTED on its
  clear-tag). The five EXHAUSTED refusals in the survey (steps 66, 134, 190, 232, 238) are on collect/reach-exit goals, which
  this switch does not wrap.

**So the measured mover is the whole-game walk's own L40 state** (A1, A2 and A4 of re-measure-6). That state is not a node sweep
leg's: re-measure-6 traced it to the L39 tag-3 persistence row, the rng seed and the seam time the walk brings in. A divergence
sweep with `solver_env` `SEEDLING_GOAL_START_WAIT=1` is the period-wide measure. I did not run one (no full sweeps).

## 8. What the brief got wrong (measured)

1. **"The replay tool is in the evidence dir and `scripts/procgen/play-request.mjs`"**: the second does not exist. The replay is
   `scripts/procgen/replay-seedling-solve-request.mjs`. I used it once on 26:9 ON. It gives the same answer as `seam.mjs` in a separate process
   (`ce73a52373d2`, `modelHits` 0/0).
2. **"Time-sweep the arrival clock a period either side … report the refusal rate by phase"**: the rate is 100% at every phase
   (91/91). The clock turns only the hammer. The refusing danger is the spinner BODY's patrol, and the clock does not move the
   body. The axis that finds the line is an idle before the solve (77/100 hitless). The question "which hammer phase" has no
   answer here.
3. **"Survey match: step 96, REFUSED at main"**: it is still REFUSED, but on a different wall. At this base step 96 **passes**
   the `{40,12}` burn and refuses on the next goal: the Boss Key 2 collect's `kill (spinner@816,848) by press` corner
   (HAMMER_PHASE_RUNG, "There is no step out … the corner formed 12 tick(s) after the press … LANDED at t2743"). So the
   survey cannot show this switch.
4. **The brief implies the L40 sweep legs carry the refusal.** At their node clocks all 38 solve OFF. Face 1 is the whole-game
   walk's state, as re-measure-6 already said ("the split is in the state the bot brings into L40, not in the solver").
5. **"bobsoldier@880,832 covering the goal"**: true, and more than the brief says. It covers the burn tree's **only reachable
   stance**, so no stance search can step around it (§ 3).

## 9. Residue / hand-overs

- **The next wall after the ON plan** (`tools/next.mjs`, `repro/next-bk2-*.json`: the captured staging, `perTick` = the ON plan,
  goal = the Boss Key 2 collect `bosskey@656,528`): at 640 it is a **budget cut** (work 642, 17 s). The held 2560 retry is
  **a budget cut too** (work 2561, 63 s): *"apitem (656,528) contact -> shove stance (pushableblockfire@576,576) -> weigh:
  deadline at the `crusher-fork` site after 6 approach tr(ies)"*. Re-measure-6's P1 met the same request shape (26:11, the
  collect right after the burn solved) and replayed it as a 640 budget cut taking 711 s; the page's 300 s backstop killed it.
  Survey step 96 refuses on this goal too, by name (§ 8.3). **So with the switch ON the walk's stop should move from the
  `{40,12}` refusal to the Boss Key 2 collect** (a budget cut at the block weigh, or the press-kill corner). That is measured
  in node only. A whole-game walk with the switch ON would show it on a page.
- **The schedule keeps the first solve, not the shortest.** On 26:9 the kept W=50 plan is 3290 t, while W=250 would give
  1119 t (`repro/wait-sweep-26-9.summary.txt`). Picking the shortest of the schedule would cost one solve per wait (about
  1100–1500 work units each), which the 2560 budget does not hold. This is left to the planner.
- **Other goal kinds.** The survey's five ladder-EXHAUSTED refusals (steps 66, 134, 190, 232, 238) are collect/reach-exit
  goals. The same wrapper at those call sites is untested here; it is the natural next measurement.
- **`scripts/test/train-shard-costs.json`** has no row for the new train file. It still runs (the lightest shard takes it) and
  the job warns.
- **Not done:** a whole-game wasm walk with the switch ON (not asked), and a game witness of the page's own 3290 t plan (the
  witness above plays the fresh page's solve of the same request, 3405 t, the same kept wait).
- **No hand-over to fidelity:** the model already holds the line. The witness agrees with it tick for tick.
