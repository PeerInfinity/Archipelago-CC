# LOOPS-I2: the mana sliver and one price per action (as built)

Branch `loops-mana-sliver`, based on the frozen LOOPS-I1 tip `791653c0ba` (`loops-instant-oom`). It fixes the two
items in `loops-instant-oom.md` § "Follow-ups (named, not fixed here)".

- **Step 1, `3a77ba7eb8`:** `deductMana` snaps a float sliver to exactly 0.
- **Step 2, `d4fa0445ff`:** an action is priced once, at the region level it has when it starts, at every speed
  (⚖ Ruling A, Robert, 2026-11-21).

## Measured (step 0)

All measurements come from a scratch vitest file (not committed) that drives the real code.

### The sliver: a pool of 100, spent at 100/n per step, n = 2…60 (59 cases)

| Caller | Slivered before | Reset fired on | Max sliver | After the fix |
|---|---|---|---|---|
| `GameState.deductMana` direct (maze wait `mazeRoomUI.js:2617`, move `:4848`, in-place `:4904`) | 24 / 59 | step n + 1 for those 24, step n for the other 35 | 1.35e-13 | 0 / 59: step n for all |
| `chargeMana` (`resourceChannelsLibrary.js:175`; the text adventure and the resource-delta router) | 24 / 59 | same | 1.35e-13 | 0 / 59 |
| Maze `_deductMazeStepMana` (through `chargeMana`; region cost 100, `longestShortestPath` n) | 24 / 59 | same | 1.35e-13 | 0 / 59 |
| Loops `_spendMana` (whole charges: live play, summary replay, time drain) | 24 / 59 | same | 1.35e-13 | 0 / 59 |

The slivered n are 12, 14, 17, 21, 23, 26, 28, 30, 31, 34, 36, 41, 42, 43, 44, 47, 48, 51, 52, 54, 55, 57, 58 and 59.
These are the same for every caller, because every caller does the same float arithmetic in `deductMana`.

`git grep -an deductMana` found no other runtime caller. The in-app test cases call it to set a pool, for example
`deductMana(current − 0.01)`. That remainder is far above the tolerance (see below).

### Pricing: one explore (base 50, no cost data) from 80 XP

The action crosses L0 → L1 after 20 mana. Normal speed is stepped at 0.02 mana per frame.

| Pool | Speed | Before: mana spent | Before: completes / resets | Before: level, XP | Before: end pool | After Ruling A |
|---|---|---|---|---|---|---|
| 100 | normal | 48.58 | yes / no | L1, 28.58 | 51.42 | 50, yes / no, L1 30, pool 50 |
| 100 | Instant, block Instant | 50 | yes / no | L1, 30 | 50 | unchanged |
| 49 | normal | 48.58 | **yes** / no | L1, 28.58 | 0.42 | 49, **no / yes**, L1 29, pool 100 |
| 49 | Instant, block Instant | 49 | no / yes | L1, 29 | 100 | unchanged |
| 48.6 | normal | 48.58 | yes / no | L1, 28.58 | 0.02 | 48.6, no / yes |
| 48.6 | Instant | 48.6 | no / yes | L1, 28.6 | 100 | unchanged |
| 40 | all | 40 | no / yes | L1, 20 | 100 | unchanged |
| 100, xpGainScale 5 (two boundaries) | normal | 46.92 | yes / no | L2, 94.6 | 53.08 | 50, L2 110, pool 50 |
| 100, xpGainScale 5 | Instant | 50 | yes / no | L2, 110 | 50 | unchanged |
| 100 from 0 XP (no boundary) | all | 50 | yes / no | L0, 50 | 50 | unchanged |

## The STOP, and the ruling

The brief proposed making Instant price in segments at each level boundary, so that it would match normal speed. I
built that (it is parked on the local branch `loops-mana-sliver-segmented-pricing` at `cfef5cd09d` and was never
pushed). It broke `blockModes.test.js` "ONE ECONOMY: live-playing a block costs exactly what the generic executor
charges to replay it" (109.52 vs 110).

That test runs the executor under Instant "so each action charges once at its start-of-action XP level, like the live
path". Three other places also charge an action whole at its start price:

- live play (`observeParkedLiveAction` → `_spendMana`);
- the Loop Stats predictions;
- `loops.md` § "What each mode costs" ("All four cost the same").

So the per-frame re-pricing at normal speed was the odd one out, which is the brief's STOP condition.

⚖ **Ruling A (Robert, 2026-11-21):** an action is priced ONCE, at the region level it has when it starts, at every
speed. Instant stays as LOOPS-I1 left it.

## The fixes

### Step 1: the sliver snap, in `gameState/state.js` `deductMana`

- With the debt flag off, a result at or below `_manaSliverTolerance(amount)` becomes exactly 0. A result below 0
  still clamps to 0, as before.
- The tolerance is `½ · Number.EPSILON · scale · MANA_SLIVER_SPENDS`:
  - `scale` = max(`maxMana`, the pool before the spend, the spend). It is relative to the pool's scale.
  - Each subtraction rounds by at most half an ulp of the pool, so k spends carry at most k · ½ · EPSILON · scale
    of noise.
  - `MANA_SLIVER_SPENDS` = 2^20 ≈ 1e6 spends. The longest chain that drains a pool is the loops timer at speed 1:
    a frame spends 16 ms / 5000 ≈ 0.0032 mana, so about 31 000 frames drain 100. The constant is 33 times that.
  - At a scale of 100 the tolerance is about 1.2e-8 mana. That is five orders of magnitude above the worst measured
    sliver (1.35e-13) and six below the smallest deliberate remainder (0.01).
- Debt mode (`noManaDepletionReset`) is byte-for-byte today's arithmetic: no snap, and the same debt.
- `gainMana` and `refillMana` are untouched. The fix lives in one place: no caller changed.

### Step 2: the start price, in `loops/loopState.js`

- `_advanceActionProgress` takes its price from `_startedActionPrice(action, progress)`:
  - It prices the action (`_calculateActionCost`) whenever its progress is 0, and stores that price in
    `_startedActionPrices` (pathIndex → price).
  - While progress is above 0 it returns the stored price.
  - A new action, a reset (progress cleared, and the map cleared with it in `_resetActionsProgress`) and a cancel
    (progress set to 0) all re-price with no extra hook. An action restored mid-way with no stored price is priced
    on its first frame.
- Instant and the per-block Instant already completed in one frame at the start price, so their outcome is
  unchanged. The LOOPS-I1 cap is untouched: a frame spends at most the pool.
- `docs/json/features/loops.md` § "What each mode costs" now says it: the price is fixed when the action starts, at
  every speed.

## Pins

| Pin | What it holds | Mutation that reds it |
|---|---|---|
| `gameState/state.test.js` § "the sliver snap (LOOPS-I2)" | n = 2…60 equal spends end at exactly 0, on spend n (59 rows); a deliberate 0.01 is kept; debt mode equals the raw float result (slivers kept, debt unchanged); a fixture guard shows the raw arithmetic does sliver | Remove the snap (`newMana <= 0`): 24 rows red here |
| `mazeRoom/mazeRoomUI.test.js` § "the out-of-mana reset fires on tile n, not n+1" | For every n that slivers in raw float, `_deductMazeStepMana` makes no reset on tiles 1…n−1 and exactly one on tile n | Same mutation: 24 rows red (48 in all with the row above) |
| `loops/instantParity.test.js` § "LOOPS-I2 — a level-crossing action costs its START price at every speed" | Normal (stepped), Instant and block Instant agree for pool 100 (50 spent, completes) and pool 49 (drains, no completion, reset), at xpGainScale 1 and 5 (two boundaries). Completion, reset, level and index are exact; mana and XP are within one frame's spend. Also: a fresh start re-prices at the new level, and a mid-action read is frozen | Re-price every frame (`_calculateActionCost(this.currentAction)` back in `_advanceActionProgress`): 12 rows red |
| `loops/blockModes.test.js` "ONE ECONOMY" | Unchanged and green | n/a |

## Gates (local)

- Bounded vitest over `loops`, `gameState`, `mazeRoom`, `resourceChannels`, `playbackBot` and `actionNodes`, at the
  tip: 159 files, 3810 tests, all green.
  - With the parked segmented Instant, ONE ECONOMY red.
  - `sphereOrderLevels.test.js` L12 timed out once at 60 s under the parallel load and passed solo.
- `check-loop-costs-one-model.mjs`: ALL PASS (5 documents).
- Maze engine closure (`seedlingDerivedRuleTable.js --print-engine-closure`): identical at `3a77ba7eb8` and at the
  tip (md5 of the listing `9dc4d84abc6e91bd324173a3c353854a`). The closure ∩ the diff is ∅.
- No committed preset moves. The diff against `loops-instant-oom` touches:
  - `gameState/state.js` and `state.test.js`;
  - `loops/loopState.js` and `instantParity.test.js`;
  - `mazeRoom/mazeRoomUI.test.js`;
  - `docs/json/features/loops.md`;
  - this report.
- Gitlinks: 0.

## Blast radius (CI)

Every Loop-mode batch ran on CI at `d4fa0445ff`:
- TT (dispatch, which covers `playback-bot`);
- manual `batch=all` (which covers `tutorials-procgen-loops`).

Each batch was diffed against LOOPS-I1's tip runs (TT 44946572089, manual 44946574133). Two diffs were run:
- `compare-runs.js`, for status, roster and duration;
- every row's condition text, with durations masked.

**No row changed status.** No row was a test fix: nothing had passed only because of the late reset or the one-time
price. No substrate logic, committed preset or maze engine closure moved.

Rows whose condition VALUES moved (all still passing):

| Row (batch) | Before → after | Why |
|---|---|---|
| `playback-bot-loop-mode-adventure` (playback-bot) | 37 → 36 loops | Run-to-run spread, not this slice. `test-substrates-repeat.yml` ×8 at each tip gives the same distribution: this branch (44965577689) 35, 36, 36, 37, 37, 37, 38, 41 (median 37); LOOPS-I1 (44965579640) 34, 34, 37, 37, 37, 37, 39, 40 (median 37). ⚑ Other branches' TT runs on this day give 26–30 for this row (main 3c602f965d: 27; main be28ec1b3d: 29), so the jump to about 37 came with LOOPS-I1 and was not named in its report. It is for the planner to place. |
| `cloudberry-mixed-loop-bot-victory` (cloudberry) | 9 → 7 loops; it no longer visits `region_3_1` | 7 is the norm: 7 loops in all seven other runs on record (nightly 44895366627, 44721030986, 44507766537, 44287469202; cloudberry-e2e 43262992309, 43158710794, 43151988153). LOOPS-I1's 9 is a single sample (no other LOOPS-I1 run has the row). |
| `cloudberry-bot-end-door-region-move`, `cloudberry-loop-bot-blocks-reset-victory`, `cloudberry-bot-walks-the-ladder`, `cloudberry-loop-record-then-instant-playback` (cloudberry) | bot steps ±1, planner ms, game seconds (1.37 → 1.6), a 2 → 3 mana drain | Real-time play: wall-clock and game-clock jitter |
| `seedling-{js,wasm}-runtime-loop-bot-block-walks-generated-room`, `…-loop-bot-blocks-cross-atlas-rooms`, `…-loop-play-clock-drains-mana` (seedling-js, seedling-wasm) | the time drain ±1 with its game seconds and the window | Game-clock jitter. Each window is derived from the measured seconds. |
| `omsi-playback-instant` (fast, fast bundled) | measured speed-up 34.1× → 36.3× (bundled 36.7× → 35.9×) | Timing |
| `region-map-seedling-paints` (playback-bot) | 31/37 → 33/39 paints/requests | Timing (coalescing) |
| `apworld-initialise-cancel-lands-nothing` (apworld) | premise "built 1 / 444" → "6 / 444" | Timing (where the cancel lands) |

Every other row's conditions are identical:
- TT regression 60;
- fast 131, fast bundled 131;
- seedling-js-solver 12;
- bot-walks 3, feature-checks 10, noiz2sa 12;
- tutorials 24, tutorials-procgen 9, tutorials-procgen-loops 2;
- tutorials-seedling 4, tutorials-seedling-whole-game 1, tutorials-tracker 8.

## CI at the code tip `d4fa0445ff`

| Gate | Run | Result |
|---|---|---|
| ut (`unittests`, push) | 44958946820 | success (the Python legs skip: no Python changed) |
| JSUT (push) | 44958946838 | success. `ci-vitest-summary`: suite vitest (unfiltered) 1399/29494 (29494 passed, 0 skipped, 0 failed); slow battery 36/438 |
| `train_only` (dispatch) | 44958950503 | success: Train-tier Vitest shards 1/3, 2/3, 3/3 |
| TT (dispatch) | 44958946266 | success on attempt 2. Attempt 1: every batch's rows passed (fast 131/131, HEADROOM OK 52 %), but the fast job's `upload-artifact` step failed with `ETIMEDOUT` (infrastructure). HEADROOM OK, attempt 2: fast 308.4 s / 600 (51 %); fast bundled 327.3 s (55 %); seedling-js 232.2 s (39 %); seedling-js-solver 196.1 s (33 %); apworld 177.5 s (30 %); seedling-wasm 160.7 s (27 %); playback-bot 101.1 s (17 %) |
| `test-substrates-manual.yml -f batch=all` | 44958948345 | success: bot-walks, noiz2sa, cloudberry, tutorials, tutorials-procgen, tutorials-procgen-loops, tutorials-tracker, tutorials-seedling, tutorials-seedling-whole-game, feature-checks |

Gitlinks: 0. `git diff origin/loops-instant-oom --raw` has no `160000` line.

## The merge of main, and CI at the final code tip `ad6958deb0`

The landed main `c1b250e638` (train 188: LOOPS-I1) was merged ONCE into the branch as `ad6958deb0`. The merge was clean.
`git diff c1b250e638..ad6958deb0` touches the same 7 files as before, with no `160000` line (gitlinks 0).

The local gates at `ad6958deb0`:
- bounded vitest (`loops`, `gameState`, `mazeRoom`, `resourceChannels`, `playbackBot`, `actionNodes`): 159 files,
  3810 tests, all passed;
- `check-loop-costs-one-model.mjs`: ALL PASS (5 documents);
- the engine closure: md5 `9dc4d84abc6e91bd324173a3c353854a`, the same as at base, and closure ∩ diff = ∅;
- no preset moved.

| Gate | Run | Result |
|---|---|---|
| ut (`unittests`, push) | 44979364933 | success |
| JSUT (push) | 44979364937 | success. `ci-vitest-summary`: suite vitest (unfiltered) 1405/29606 (29606 passed, 0 skipped, 0 failed); slow battery 36/438 |
| `train_only` (dispatch) | 44979365484 | success |
| TT (dispatch) | 44979367254 | success on attempt 1, every job. HEADROOM OK: fast 313.7 s / 600 (52 %); fast bundled 330.9 s (55 %); seedling-js 231.3 s (39 %); seedling-wasm 226.6 s (38 %); apworld 212.2 s (35 %); seedling-js-solver 202.9 s (34 %); playback-bot 108.4 s (18 %) |
| `test-substrates-manual.yml -f batch=all` | 44979369610 | success: all 10 batches (bot-walks, noiz2sa, cloudberry, tutorials, tutorials-procgen, tutorials-procgen-loops, tutorials-tracker, tutorials-seedling, tutorials-seedling-whole-game, feature-checks) |

The type check and "Analyze modified files" runs were also green on the push (44979364939, 44979364913).
This report's own commit only edits the report. JSUT is dispatched at it, and its id is in the report-back message.
