# SEEDLING HAMMER-PHASE — slice FLIPBLOCK (the GSW L71 / PM L101 / PKH L69 ON-arm losses)

Session `seedling-hammer-flipblock` (Opus, cloud). Planner: `seedling-hammer-phase-planning-14`. ⚖ The user approved the slice
on 2026-11-24 (*"Flip-blocker fixes"*): measure first, switch-guarded OFF. Landing needs the user's SHA-bound OK through the
planner. Evidence: `CC/docs/cloud-reports/seedling-hammer-flipblock-evidence/`.

## 1. SHAs

| | |
|---|---|
| Start (base) | `origin/main` @ `a5f7c6caf4563d8b0c65776f03ada03e2343c04a` (TRAIN 207, the five hammer switches landed OFF) |
| Step 1 (measure) | `784095a7`: captured requests, node probes, the planner's sweeps by key |
| Steps 2–3 (change + rows) | `ea6619fb`: the two fixes, the rows, the fixtures, the train-shard cost row |
| Step 4 (ON vs OFF) | `6d79994a`: the three legs ×3 per arm in the browser, the surveys |
| Merge | `d5802cea`: `origin/main` `c2cdfaac` (TRAIN content-gen2). It touches no solver file, so nothing needed re-measuring. Acceptance md5 after the merge is still `391322d681b7aa0229d94b3f6906d024` |
| Head | the commit carrying this report (`Cloud-Status: final`) |
| Branch | `claude/seedling-flipblock-losses-zj5tfa` |

No planner follow-up arrived (`ReadNotifications` empty). I followed the brief alone. Main had not taken the STRIKE_PREVIEW_LEAN +
KEYLOCK_TURRET_ARRIVAL flip when I wrote this.

## 2. The answer first

There is no new switch. Each fix is inside the switch that lost its leg, and each switch is still OFF.

| loss (leg, by key) | cause (measured) | fix | ON after the fix |
|---|---|---|---|
| **GOAL_START_WAIT**: `level_71__r0c6 <- in_L72_0_256 -> location:L71 flag 2: shieldlock@288,256 cleared` | The anytime passes share **one** work budget. ON, the **dashless** pass's EXHAUSTED ladder ran its waits. Its first wait (50) ran from work ≈2239 to 2563, and the **full** pass, which solves OFF in **21 units**, got 1 | `GOAL_START_WAIT_PASS`: `solveAnytime` marks a pass that has a later pass, and there an EXHAUSTED ladder is thrown unchanged (`deferred`). The last pass waits exactly as before | **OFF's answer byte for byte** (`65d54a276e53`, 176 t, work 2260, 0 hits). Browser ×3: done, 176 t, 0 hits |
| **PREVIEW_METER**: `level_101__r4c2 <- in_L100_288_96 -> location:L101 flag 0: lightpole@144,64 cleared` | OFF's dashless pass solves at work **2453 of 2560** in 8.4 s (3.4 ms a unit). It has 358,482 previewed states, **146 per paid ask**. The meter charged them at 1024/unit: 231 extra asks, which pushed it past 2560 | `PREVIEW_METER.freeStatesPerAsk` = 1024: each paid `shouldStop` ask carries 1024 previewed states for free, and only the excess is metered. Asks made by the meter earn no allowance | **OFF's answer byte for byte** (`398f56029a3c`, 709 t, work 2563, `asked` 0). Browser ×3: done, 709 t, 0 hits |
| **PRESS_KILL_HOLD**: `level_69 <- in_pit_L70_3_8 -> location:Level 069 - Lights` | **The switch is never reached.** Its answers, work and asks are identical to OFF at seams 5555, 5554 and 5564 (`PRESS_KILL_HOLD_COUNTS.rows` is empty). The 90 s leg cap is this leg's **own** wall: the Lights verb's forecast rollouts, which run unmetered | **No change** (§ 8) | Browser ×3: done in 49–64 s. OFF on the same box took 35–75 s. A hand-over is in § 9 |

- **No-hit:** no step of the `--through=end` survey gained a hit under any switch (224 SOLVED / 26 REFUSED each way).
  All 36 browser leg runs (3 legs × 4 arms × 3) report 0 hits.
- **OFF identity:** acceptance md5 is `391322d681b7aa0229d94b3f6906d024` at the base, at the head OFF, and at the head with
  `SEEDLING_GOAL_START_WAIT=1 SEEDLING_PREVIEW_METER=1`.
- **The switches' own wins hold:**
  - FACE1 26:9: 3290 t, work 1469, the 50-tick wait kept (train row green).
  - SPINNER880 19:1: the HARD refusal is still a soft 640 cut (work 642, 59 s).
  - KILL880 19:1 at 2560: still solved (train file 2/2 green).
  - SPINNER880 26:11 (the wall win) was not re-measured, because the request is not in the repository (§ 9).

**The one thing to know first:** two of the three losses were not about the rooms. GSW lost its leg because the wait schedule ran
on a pass that a later pass follows, inside a budget the passes share. PM lost its leg because its rate (1024 states per unit) was
calibrated on L40's dense previews (~16,000 per unit) and charged a sparse room (146 per unit) as if it were dense. The third
"loss" is not a switch's at all. L69's solve wall depends on the seam: the same seam 5557 took **75 s OFF and 77 s with
PREVIEW_METER**, with the same plan.

## 3. The reproduction (measured)

**Capture.** A local divergence sweep by key, OFF, on `seedling_bot_ap_p4g` (the CI default page), with `--page-legs=1` and
`--capture-requests`, under the box lock, at the base. Files: `req/requests-off1.jsonl.gz` and `repro/browser-rows-off1.jsonl.gz`.
- L71: 640 cut, then the held 2560 retry solves (176 t).
- L101: 640 cut, then 2560 solves (709 t, dashless).
- L69: solves at 640 (530 t) in 55 s.

**Node probe.** `tools/probe.mjs` is the worker's own dispatch (`solveAnytime`, the request's budgets and passes). For each pass it
prints the deadline-site asks, the wall, and the switch counters. Every number below is from it. `tools/replay.sh` wraps
`replay-seedling-solve-request.mjs` for the answer hashes.

**GSW, L71, the 2560 retry (`repro/588-1-*`):**

| | dashless pass | full pass | answer |
|---|---|---|---|
| OFF | refused, "the combat ladder is EXHAUSTED", work 2239 | **solved in 21 units**, 176 t, 0 hits | `65d54a276e53` |
| ON (base) | the first wait (50) is asked at work ≈2239 and runs into the budget: cut at 2563 (`detour`) | **1 unit**, cut at `walk` | refusal `0992fe39f060`, 3.9 s |

The planner's three refusals ("640, then 2560 … at `walk` … touch stance's corridor") are this full pass's 1-unit cut. Both of the
brief's hypotheses hold in one form. The waits spend the budget that the OFF path solves with, and the OFF path "recovers later in
the same solve": in the **next pass**.

**PM, L101, the 2560 retry (`repro/737-1-*`):**

| | dashless pass | previewed states | meter asks | answer |
|---|---|---|---|---|
| OFF | **solved** at work 2453, 709 t, 8.4 s | — | — | `398f56029a3c` |
| ON (base, every state charged) | cut at 2564 (`axe-dodge`) | 358,482 | 231 | refusal `b7c7f123d695` |

The deadline-site asks of the solved pass are axe-dodge 1398, detour 1021, kill-chaser 93 and walk 54. That is **146 previewed
states per paid ask**, and the wall is 3.4 ms a unit. There is no unmetered wall to charge for. SPINNER880 calibrated the meter
on L40: 19:1 had 917 k states over 56 units of a pass (~16 k per unit), and 26:11 had 9.95 M over 642 (~15.5 k). On those requests
one walk unit stood for 10–23 s.

**PKH, L69, the 640 request (`repro/581-*`):**

| seam | arm | work | ticks | asks | `PRESS_KILL_HOLD_COUNTS.rows` | node wall |
|---|---|---|---|---|---|---|
| 5555 (captured) | OFF / PKH | 68 / 68 | 530 / 530 | 70 / 70 | — / **[]** | 45 / 47 s |
| 5564 (the CI PKH timeout's) | OFF / PKH | 66 / 66 | 480 / 480 | 68 / 68 | — / **[]** | 66 / 66 s |
| 5554 (the keyed PKH timeout's) | OFF / PKH | 86 / 86 | 785 / 785 | 88 / 88 | — / **[]** | **136 / 140 s** (4 jobs on 4 cores) |

**Where L69's wall goes** (`repro/prof-581-5554.txt`, `profile-seedling-solve-wall.mjs`, seam 5554 OFF):
- 99.8 % of 132 s sits in **two** `walk -> walk` gaps (31 s and 101 s).
- 93 % of the samples are `execClearTag` → `execLights` → `rolloutLightsFight` → `planLightsSortie` → `forecastPlan` →
  `forecastTick` → `levelRun.step` (`lightsVerb.js`).
- That loop asks no deadline site and calls no `previewWalk`, so PREVIEW_METER does not see it either: 700 states counted, 0 asks
  (`repro/581-5554-pm-prefix.json`).

**The planner's sweeps by key** (`sweeps/three-legs-by-arm.txt`, `sweeps/planner-full-sweeps-vs-off.txt`):
- L69 OFF took 37–63 s at seams 5537–5570.
- PKH timed out at 5564 (a 480 t plan solved at +77 s) and at 5554 (no plan by 90 s), and was done in 42 s at 5568.
- GSW's other movers against OFF are exit legs flipping done↔crossed, the jitter every arm shows, and L40 timeouts. PM's and PKH's
  are the same.

## 4. Design + change, OFF identity

**`GOAL_START_WAIT` (worker thread):**
- `solverBot.js`:
  - a block beside the switch: `GOAL_START_WAIT_PASS = { later: false }` and `withGoalStartWaitLaterPass(later, fn)`;
  - one line in `execClearTagWaiting`: after the existing guards, `later` re-throws the EXHAUSTED refusal unchanged and counts
    `GOAL_START_WAIT_COUNTS.deferred`.
- `jsRuntimeSolver.js` `solveAnytime` (one call site): the pass's solve is wrapped as
  `GOAL_START_WAIT.enabled ? withGoalStartWaitLaterPass(i < passes.length - 1, solvePass) : solvePass()`.
- OFF takes the same call (`solvePass()`) and reads nothing new.
- Outside `solveAnytime`, `later` is false, so the survey's `twoPassSolve` and every direct `solveSegment` behave exactly as before.

**`PREVIEW_METER` (worker thread, and node):**
- `PREVIEW_METER.freeStatesPerAsk` = 1024. 0 is the SPINNER880 meter exactly.
- `previewUnitDue` subtracts `freeStatesPerAsk × (deadline asks − the meter's own asks)` before it charges.
- `askDeadline` counts `d.asks` only when `PREVIEW_METER.enabled`. This is one line, OFF ⇒ not read.
- The meter's asks are counted in `d.meterAsks`.
- It is a count, never the clock.
- Generic: no level, coordinate or Seedling constant. 1024 is "one unit's worth of previews per paid unit", the same unit the meter
  already charges in.

**PKH:** no change (§ 8).

No main-thread mapper reads any of these. No reformatting, no renames. `seedling-solver-surface.json` is unchanged (374 rows).

**Acceptance md5** (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`):

| run | md5 |
|---|---|
| base `a5f7c6ca` | `391322d681b7aa0229d94b3f6906d024` |
| `ea6619fb`, OFF | `391322d681b7aa0229d94b3f6906d024` |
| `ea6619fb`, GSW + PM ON | `391322d681b7aa0229d94b3f6906d024` |
| `d5802cea` (after the merge), OFF | `391322d681b7aa0229d94b3f6906d024` |

Regenerated, each `--check` green:
- `census-seedling-solver-surface.mjs`: 374 rows, unchanged;
- `generate-procgen-reference.mjs`;
- `generate-docs-index.mjs`.

No docs were edited under `docs/json/developer/procgen/`, so no procgenDocs pins are owed.

## 5. Rows + bounded vitest runs

| file | tier | rows | run |
|---|---|---|---|
| `goalStartWait.test.js` | default | +1 (5): `GOAL_START_WAIT_PASS` ships `later: false`; `withGoalStartWaitLaterPass` sets and restores it, nested and on a throw | 5/5 |
| `previewMeter.test.js` | default | +1 (5). The four SPINNER880 rows now pin `freeStatesPerAsk` = 0, the meter they were written for. The new row covers the shipped allowance on L18: it covers its previews, so ON asks 0, matches OFF byte for byte with the same `shouldStop` calls, and under OFF's own total as the budget no longer trips | 5/5, 50 s |
| `hammerFlipblockWitness.train.test.js` (fixtures `fixtures/hammer-flipblock/L71-flag2-2560-request.json.gz`, `L101-flag0-2560-request.json.gz`, 87 KB each, data only) | train | 2. **L71**: OFF's dashless pass refuses and the last pass solves; ON defers (≥ 1), asks no wait, and gives OFF's passes, work and plan bytes, 0 model hits. **L101**: ON with the shipped allowance asks 0 and gives OFF's passes, work and plan bytes, 0 model hits; with `freeStatesPerAsk` = 0 it is a budget cut (the loss) | 2/2, 40 s |
| `hammerFace1GoalWait.train.test.js` (FACE1's) | train | 2 | 2/2, 44 s |
| `hammerKill880StandHold.train.test.js` (KILL880's) | train | 2 | 2/2, 198 s |
| `solverEnvChannel.test.js` | default | 11 | 11/11 |
| `scripts/test/trainShardPlan.test.js` | default | 21 | 21/21 |

`train-shard-costs.json` gains the new train file's local row (40 s). I ran no unfiltered vitest (ruling 52). The suite number is
CI's at the pushed SHA.

## 6. Page play / game witness

**Browser, local, by key** (`on/three-legs-x3.txt`, `on/browser-rows-x3.jsonl.gz`, `tools/legs-x3.sh`): the production wasm
engine on `seedling_bot_ap_p4g`, `--page-legs=1`, the box lock. Each arm ran the three legs, three times, with
`--solver-env=SEEDLING_<SWITCH>=1` at `ea6619fb`.

| leg (by key) | OFF | GSW | PM | PKH |
|---|---|---|---|---|
| `… -> location:L71 flag 2: shieldlock@288,256 cleared` | done ×3, 176 t, 9–10 s | **done ×3, 176 t**, 10–11 s | done ×3, 176 t | done ×3, 176 t |
| `… -> location:L101 flag 0: lightpole@144,64 cleared` | done ×3, 709 t, 32–34 s | done ×3, 709 t | **done ×3, 709 t**, 33 s | done ×3, 709 t |
| `level_69 <- in_pit_L70_3_8 -> location:Level 069 - Lights` | done ×3, **35–75 s** | done ×3, 45–60 s | done ×3, 34–77 s | **done ×3, 49–64 s** |

All 36 rows report `roomHits.max` 0. Each L71/L101 plan played to its location. This box's L69 is under the 90 s cap in every arm,
and the spread follows the seam, not the arm: OFF at seam 5557 took 75 s with a 766 t plan, and PM at 5557 took 77 s with the same 766 t.

No new plan exists to witness tick by tick: both fixed legs now play OFF's own plan.

## 7. Census: which seed-1 divergence-sweep legs the change can move, and why

**GOAL_START_WAIT.** The fix acts only when all of these hold:
- the solve is a `solveAnytime` request with ≥ 2 passes (every page/sweep request except a single-pass held retry);
- a **clear-tag** goal's ladder EXHAUSTS;
- it does so on a **non-last** pass, with the switch ON.

The fix moves legs against the **old ON**, never against OFF:
- **Back to OFF:** a leg whose old-ON waits on a non-last pass spent the budget the later pass solved with. That is
  `level_71__r0c6 <- in_L72_0_256 -> location:L71 flag 2: shieldlock@288,256 cleared`. In the planner's full GSW sweep it is the
  only clear-tag location leg that went done → failed.
- **Could lose a GSW win:** a leg whose old-ON solved through a wait on a non-last pass. The planner's full GSW sweep has no
  clear-tag location leg that went OFF-failed → GSW-done. Its only `failed →` moves are exit legs (jitter) and
  `level_40__r48c54 <- in_L43_176_464 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`, failed → timeout,
  which no arm solves. So no sweep win is at risk.
- **The measured win holds:** FACE1's A1 26:9 is a single-pass held retry, so its only pass is the last one.
- **The survey cannot reach the change:** it solves through `twoPassSolve`, not `solveAnytime`. It shows 0 moves, as in FACE1.

**PREVIEW_METER.** The fix acts on any solve under a fine deadline (page, sweep, captured requests) whose previewed states are
counted. It lowers the charge by at most `1024 × paid asks`, so:
- **Sparse rooms are no longer charged.** They hold ≤ ~1024 previewed states per paid ask, and their answers return to OFF's.
  Measured: `level_101__r4c2 <- in_L100_288_96 -> location:L101 flag 0: lightpole@144,64 cleared`, the only done → failed leg in
  the planner's full PM sweep.
- **Dense rooms barely move.** At ~16 k states per unit the allowance removes ≲ 7 % of the charge. Measured on 19:1: 587 asks both
  ways and the same 640 cut.
- **In between:** a solve whose old-ON metered cut was decided by a few dozen units, in either direction. One example is the L43
  `flag 12` 5227 request that SPINNER880 saw keep its dashless plan. I did not re-measure it.
- The planner's PM sweep also has L40 legs flipping done ↔ timeout ↔ failed:
  - `level_40__r26c13 <- in_L43_176_464 -> location:Level 040 - Chest`;
  - `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`;
  - `level_40__r48c54 <- in_L43_176_464 ~> … flag 12`.

  These are dense-preview legs. The fix barely changes their charge, so they remain the flip sweep's to judge.
- **The survey cannot reach the change:** it has no deadline (0 moved).

**PRESS_KILL_HOLD:** no change, so nothing new moves. The survey ON equals KILL880's: steps 96 and 149 gain the hold's sentence
and nothing else.

## 8. What the brief got wrong (measured)

1. **"PRESS_KILL_HOLD=1 → `level_69 … Level 069 - Lights` timeout 2/3"** is not the switch's loss.
   - On the captured request at the captured seam and at both timeout seams (5564, 5554), PKH is **never entered**: the work, the
     asks, the ticks and the answers are OFF's.
   - The leg's solve wall is the Lights verb's forecast. It runs unmetered and depends on the seam: 45–136 s in node, 35–75 s
     OFF in the browser here, 37–63 s OFF in the planner's runs.
   - The timeouts fell on slow seams. At seam 5557 OFF itself took 75 s.
   - So the smallest correct change for PKH is **none**. A PKH "bound by wall" would bound nothing on this leg.
2. **GSW hypothesis 2** ("the wait fires on a ladder EXHAUSTED that the OFF path recovered from later in the same solve") is
   right, with one refinement: "later" is the **next anytime pass**, not a later rung of the same pass. Hypothesis 1 is also right:
   the budget the waits spend is that pass's.
3. **PM's hypothesis** is right in kind. The miss is the rate's **domain**, not its value: no single states-per-unit rate fits both
   L40 (≈16 k states per unit, 10–23 s per unit) and L101 (146 per unit, 3.4 ms per unit). The allowance separates the two
   regimes. It does not re-tune the rate.
4. The brief lists "the 26:11 wall" among SPINNER880's wins to re-measure. Its request (re-measure-6's `P1.requests.jsonl.gz`) is
   not in the repository, so I could not re-measure it here (§ 9).

## 9. Residue / hand-overs

- **Hand-over (Lights verb, unmetered wall).** `lightsVerb.js`'s `rolloutLightsFight` → `planLightsSortie` → `forecastPlan` →
  `forecastTick` runs up to 101 s between two `walk` asks on L69 (`repro/prof-581-5554.txt`). Neither the work budget nor
  PREVIEW_METER sees it. This is what pushes `level_69 <- in_pit_L70_3_8 -> location:Level 069 - Lights` toward the 90 s leg cap
  in **every** arm. The fix would be a deadline site, or a meter count, in the forecast loop. It is a new behaviour (not
  byte-inert under a budget), so it is its own slice. The witness row would be the captured L69 request at seam 5554
  (`req/requests-off1.jsonl.gz`, leg 581, i 0).
- **Not re-measured:** SPINNER880's 26:11 wall win, because the request is not in the repository. By the arithmetic of § 7 the
  allowance removes ≤ 642 × 1024 ≈ 0.66 M of its 9.95 M charged states (≈ 7 %). The planner holds the P1 file and can confirm it
  with `tools/probe.mjs --pm-free=0|1024`.
- **The pair PM + PKH on 19:1 at 2560** was not measured together. KILL880 flagged this before any flip.
- **GSW's waits on the last pass still share the budget** with nothing after them, by design. A request whose only passes both
  EXHAUST now waits on the full pass only.
- **The flip's sweeps** are the planner's. The rows here bound the three named legs and the switches' wins. No full sweep was run.
- Scratch tools live in `tools/`: `probe.mjs`, `replay.sh`, `legs-x3.sh`, `legs-tab.py`, `sweep-cmp.py` and `show.py`. The
  survey diff tool is KILL880's `survey-diff.mjs`.
