# Cloud report: `seedling-whole-game-wasm-remeasure-11`

**The whole-game Seedling wasm walk, seed 1, on the CHASER-STAND tip `hammer-harvest-chaser-stand` @`be493c453a`, with the
five-name spec ON (PKSW + PKRB + DSS + OAC + HSB; LHM is ON by default at this base). MEASURE ONLY.**

Launcher: `seedling-hammer-phase-planning-16`. Ruling: Robert 2026-11-26, *"Re-measure-11 whole game"*. The harness pinned the branch
**`claude/seedling-whole-game-wasm-remeasure-bypmjt`**, and every push went there. Nothing was fixed. The only code commits are the
two cherry-picked MEASUREMENT-ONLY knob commits. Everything else is evidence and this report. **Not for landing.**

⚠ **Labels.** Every number is "at be493c453a, FIVE" (Arms S, B, P) or "…, base defaults" (Arm L).
- FIVE = `SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1`.
- Base defaults = no env. At this base that is the LHM flip about to land: BOS, GSW, PM, SPL, KTA and **LHM** are ON, and the rest are OFF.
- Re-measure-10's "base" (its C arm, at d8bd5bb578) had **LHM OFF**. That is not the same config as this report's L.
- The walk is bimodal, so every number is a sample ("k/N runs").

## Summary for Robert

- **FIVE passes entry 32 in 3/3 runs that reached it, 3/4 overall, and every entry-32 answer is 0-hit.** S1, S2 and S3 (and P1) reach
  **36/48** and stop at **entry 37**, the L63 WandShot refusal, as expected. **S4 stopped at entry 19**, on the spinner@880,848
  corner (survey step 66), which re-measure-10's S2 also hit. None of the five switches touches that request (replay below).
- **Base defaults (L = the LHM flip) pass entry 32 in 2/2 runs**, both 36/48 at entry 37. **L1 drew the bad arrival and passed by LHM:**
  32:10 refused (`4fa2ec303932`), then 32:12 solved as **`a404ddf42e41`**: 0 hits, 1889 ticks, LHM moving the presser hold to (248,103).
  That is the same answer as re-measure-10's C2 32:12 replayed under LHM.
- **The two arms drew the same arrival once, and that is a clean A/B.** P1 (FIVE) and L1 (base) sent a **byte-identical** 32:10 request
  (seam 81743). Base refused it; FIVE solved it at once as `64d2346b2a97` (649 ticks, 0 hits), through **`PRESS_KILL_START_WAIT`**.
  So FIVE gets past 32 one request earlier than base, on that arrival.
- **Re-measure-10's 1-hit bad arrival (C2 32:10 = re-measure-9 F1, seam 81985) now REFUSES under FIVE**, 3/3 (`68970bcd9431`, a death
  reboot at t2058, `PRESS_KILL_REBOOT_GUARD`). The switch that fires there is **`OPP_AIM_CHASERS`** (`asked 238, withheld 6`); HSB
  `tried 0`. Its 32:12 then solves as `a404ddf42e41` (0 h) under FIVE *and* under base: LHM, as in L1. ⇒ The bad arrival is now
  "refuse at 32:10, pass at 32:12, hitless" under both configs.
- **Hits.** Every solved answer in S1 (206), L1 (202) and P1 (209) carries the page's `modelHits`. **The one hit outside 5:7 is S1 18:11**
  "Level 039 - Totem Part 72,40" (`719a637caca4`, dashless pass, 1 hit, *t1521 spinner-hammer:spinner@112,88*). **It is not a FIVE
  effect.** The request replays to the same 1-hit answer under base too. S1 simply drew a different L39 arrival (seam 29994, after one
  extra `exit-15` repeat), where L1 and P1 got seam 30052 (`2e1603a6ae22`, 0 h). HSB tried there (`tried 1`) and found no
  hitless replacement (`replaced 0`). 5:7 (`4ef7e74de551`, 1 hit) is in every captured run, as in re-measure-10.
  ⚠ S2–S4 and L2 ran with capture OFF, so their hits are not on file.
- **JS: 8/48, unchanged and verbatim** (`CORRIDOR_LADDER_NEST 2`, `chaser:wallflyer@64,80`). All 19 of B1's JS-frame solve-worker URLs carry the FIVE spec.
- **Skip probe P1:** its three real refusals are the same as re-measure-10's, with the same answer hashes in replay: **37** WandShot, then **38 / 39**,
  the L71 lavarunner kill-lock (`KILLLOCK_CHASER_REWIND`, step 189). Skips 4–10 are "no path" artefacts. No five-switch counter fires on any of them.
- Heap: 656 MB flat in every wasm run. No OOM, no `RuntimeError`, no container restart. The 300 s backstop ended no entry.

## Base, subject and box

| | |
|---|---|
| base | **`be493c453a`** = `origin/hammer-harvest-chaser-stand` (= `claude/seedling-chaser-stand-fix-lethjl`'s head) |
| measured head | **`10a138a2`** = base + `5eb36ef5` (cherry-pick of `0f6f207310`, the capture knob) + `10a138a2` (cherry-pick of `744e85dcd1`, the solver-env flag). Every arm's `seq.log` line reads `head 10a138a2`. Evidence was committed only after the last arm ended |
| wasm submodule `frontend/modules/flashPanel/wasm` | **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`** (the same pin as re-measure-6 through -10). `session_bootstrap.sh --all` → `[archcc-bootstrap] READY` |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` |
| box | The cloud container: 4 cores, 15 GB, headless Chromium. WebGPU comes from the batch's `webgpu: true`, and every wasm run reports `transport=wasm`. Dev server `scripts/serve-nocache.py 8000`. One `npm test` per arm under the box lock, so each arm got a fresh page. The replays ran only after the last arm |
| row | `tutorial-walk-seedling-whole-game`, step `bot-plays`. Every row reads `PASSED` (the ratchet's `firstFailingStep: 'bot-plays'`). **PASSED is not victory** |

### Switch defaults at BASE (from source @be493c453a)
- **ON** (`!== '0'`), all in `solverBot.js`:
  - `:3120` `GOAL_START_WAIT`, `:12213` **`LATCHED_HOLD_MOVE`** and `:12761` `BRIDGE_OPEN_STRAY`;
  - `:15516` `STRIKE_PREVIEW_LEAN`, `:18805` `KEYLOCK_TURRET_ARRIVAL` and `:29960` `PREVIEW_METER`.
- **OFF** (`=== '1'`):
  - in `solverBot.js`: `:8325` `DASH_STAND_SIGHT`, `:16873` `OPP_AIM_CHASERS` and `:18347` `HAMMER_FIGHT`;
  - also in `solverBot.js`: `:21768` `PRESS_KILL_HOLD`, `:21878` `PRESS_KILL_START_WAIT`, `:21919` `PRESS_KILL_REFUGE_BOMBS` and `:21945` `PRESS_KILL_STRIKE_BOMBS`;
  - in `jsRuntimeSolver.js`: `:569` `HIT_AVOID_STAND_BOMBS`.
- All five FIVE names are in `SOLVER_ENV_NAMES` (`solverEnvChannel.js`).
- Every replay's `enabled` line confirms the env.
  - Under base: `enabled PKSW=false PKRB=false DSS=false LHM=true PKH=false OAC=false PSB=false HSB=false BOS=true GSW=true PM=true SPL=true KTA=true KTEB=false HF=false`.
  - Under FIVE: the same with `PKSW=true PKRB=true DSS=true OAC=true HSB=true`.

## The capture and solver-env diffs (MEASUREMENT-ONLY)

- `git diff --stat be493c453a 10a138a2` touches three files:
  - `tutorialTests.js` +109;
  - `walk-seedling-whole-game.mjs` +22;
  - `app.spec.js` +20.
- **The patch is byte-identical to re-measure-9's.** `diff <(git diff 8bee4f279a 744e85dcd1 | grep -v ^index) <(git diff be493c453a HEAD | grep -v ^index)`
  shows no difference.
- None of the three files changed between `8bee4f27` (the knobs' parent) and the base: `git log 8bee4f27..be493c453a -- <files>` is empty.
- **OFF is byte-identical.** With `TEST_MEASURE_CAPTURE_REQUESTS` and `TEST_MEASURE_SOLVER_ENV` unset, nothing is appended, bound,
  imported or listened to, and no URL param is added. L1 and L2 log no `[MEASURE worker]` line at all.
- **The spec was passed `;`-joined**, as one `--solver-env=` argument. The walk's parser splits on `,` and joins on `;`, so a `;` string passes
  through unchanged. The URL below proves it.

## ⛔ Knob carriage: every switch reaches the page's solve worker, and the JS frame

1. **Worker URL**, logged once per wasm arm. In the smoke run, S1–S4 and P1 it reads `[MEASURE worker] http://localhost:8000/frontend/modules/seedlingDemo/jsRuntimeSolveWorker.js?seedlingSolverEnv=SEEDLING_DASH_STAND_SIGHT%3D1%3BSEEDLING_HIT_AVOID_STAND_BOMBS%3D1%3BSEEDLING_OPP_AIM_CHASERS%3D1%3BSEEDLING_PRESS_KILL_REFUGE_BOMBS%3D1%3BSEEDLING_PRESS_KILL_START_WAIT%3D1`.
   That is all five names, sorted and `;`-separated. L1 and L2 log no env URL.
2. **The worker's stamp on every answer:** `[MEASURE capture] first answer's worker solverEnv="SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_PRESS_KILL_START_WAIT=1"`.
   - **All 228 of S1's, all 236 of P1's and all 24 of the smoke's** captured answers carry exactly that stamp.
   - **All 227 of L1's** carry `null`.
3. **Each switch's own counter fires on a page-captured request replayed with the same env** (`replay-counts.mjs`, which now also prints OAC, PSB
   and HSB). Each replay reproduces the page's answer hash and work.
   | switch | request | counter (under FIVE) |
   |---|---|---|
   | `PRESS_KILL_START_WAIT` | P1 32:10 (= live `64d2346b2a97`) | `[{"t":1534,"refused":"HAMMER_SAFETY","refusedAt":1594,"tries":[{"wait":0,"verdict":"solved",…,"endedAt":1663}],"verdict":"solved"}, …]` |
   | `PRESS_KILL_REFUGE_BOMBS` | P1 32:10; re-measure-9 P1 19:2 | `{"asked":144,"refused":124}`; `{"asked":168,"refused":0}` |
   | `DASH_STAND_SIGHT` | P1 32:10; L1 32:12 | `{"asks":1}` (both) |
   | `OPP_AIM_CHASERS` | re-measure-10 C2 32:10 | `{"asked":238,"withheld":6}` |
   | `HIT_AVOID_STAND_BOMBS` | S1 18:11 (= live `719a637caca4`) | `{"tried":1,"replaced":0}` |
   | `LATCHED_HOLD_MOVE` (base ON) | L1 32:12 (base, = live `a404ddf42e41`) | `moves=[{"level":40,"t":1553,"presser":"buttonroom@160,128","target":{"x":248,"y":103},"ticks":130,…}]` |
4. **Arm B (JS): the switches reach the JS frame.** B1 logged 20 worker URLs. 19 are `jsRuntimeSolveWorker.js?seedlingSolverEnv=…` with
   the FIVE spec; the other is `stateManagerWorker.js`. The capture does not wrap JS-frame services, so B1 has no answer stamp.
5. The page has no `SOLVER_ENV:` line. That line is the divergence sweep's (`probe-seedling-divergence-sweep.mjs`), not the walk's.
   The URL and the stamp above are the walk's equivalent: both list all five names, sorted.

## Knobs, arms and order

| knob | value | arms |
|---|---|---|
| `--budget-s` / `--stall-s` | `10800` / `300` | all (the smoke: `--budget-s=150`) |
| `--solver-env` | FIVE | smoke, S1–S4, B1, P1 |
| (none) | base defaults | L1, L2 |
| `--capture-requests` | `<jsonl>` | smoke, **S1**, **L1**, **P1** |
| `--runtime=js` / `--skip-refusals=10` | | B1 / P1 |

**Order:** smoke (150 s, ON), **S2** (OFF), **S1** (ON), **L2** (OFF), **S3** (OFF), **L1** (ON), **S4** (OFF), **B1**, **P1** (ON). Then the replays
(`replays.sh`, `replays2.sh`). Runner `run-arm.sh` / `seq.sh` (re-measure-10's, with paths and env changed); log `seq.log`.

## Per-arm tables

| run | env | capture | checked / total (bot) | snapshot | last sphere | stop: region / entry | `bot-plays` walk (row) | region changes / pushes | heap (ticks) |
|---|---|---|---|---|---|---|---|---|---|
| **S1** | FIVE | ON | **36/48** | 59 | 11.5 | `level_63__r6c9`, **entry 37 "Level 068 - Health"** | 3731 s (3745.8) | 269 / 175 | 656 flat (249) |
| **S2** | FIVE | OFF | **36/48** | 59 | 11.5 | entry 37, the same | 3802 s (3817.1) | 269 / 175 | 656 flat (254) |
| **S3** | FIVE | OFF | **36/48** | 59 | 11.5 | entry 37, the same | 3793 s (3806.4) | 269 / 174 | 656 flat (253) |
| **S4** | FIVE | OFF | **18/48** | 32 | 6.8 | `level_40__r26c13`, **entry 19 "Level 040 - Chest"** | 1147 s (1160.6) | 105 / 71 | 656 flat (77) |
| **L1** | base | ON | **36/48** | 59 | 11.5 | entry 37, the same | 3865 s (3879.1) | 269 / 176 | 656 flat (258) |
| **L2** | base | OFF | **36/48** | 59 | 11.5 | entry 37, the same | 3748 s (3761.2) | 269 / 175 | 656 flat (250) |
| **B1** | FIVE, JS | — | **8/48** | 16 | 3.7 | `level_22__r8c0`, entry 9 "Level 025 - Chest" | 360 s (371.5) | 51 / 35 | (js) heap 290 MB |
| **P1** | FIVE, skip 10 | ON | 36/48 real (+10 skipped) | 61 | 11.6 | `level_71__r0c6`, entry 47 (no path) | 3858 s (3870.5) | 280 / 183 | 656 flat (257) |

**FIVE: 3 of 4 runs pass entry 32 (3/3 of those that reached it), plus P1. Base (LHM flip): 2/2.**

### The stop lines

S1 (S2, S3, L1 and L2 are identical apart from timings and `jsHeapMB`):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 3745.8s
[MEASURE end] seedling-whole-game t=3743s step=bot-plays checked=59 botQueue=48 botCursor=36 botChecked=36 botHead="Level 068 - Health" botRegion="level_63__r6c9" lastRegionEvent="level_63__r6c9" regionChanges=269 wasmPushes=175 transport=wasm wasmMemMB=656 jsHeapMB=215 status="error: level_63__r6c9: the bot cannot walk to exit \"level_63__r6c9 -> level_65__r0c8\" — the wasm playback failed: the solver declined level_63__r6c9 -> level_65__r0c8 in level 63 (refusal): levelRun: a WandShot in level 63 would collide with 5 Enemy-typed bod(ies) this run cannot place: grenade@128,128, darktrap@64,96, darktrap@80,64, darktrap@32,272, darktrap@128,272. `WandShot`'s ctor pushes \"Enemy\" onto its own solids, …
```
S4:
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1160.6s
18/48, stop: entry 19 "Level 040 - Chest" in level_40__r26c13, cause: refusal "error: level_40__r26c13: the bot cannot walk to location \"Level 040 - Chest\" — the wasm playback failed: the solver declined Level 040 - Chest in level 40 (refusal): solverBot(wasm-location-40) apitem (880,816) contact -> kill (spinner@880,848) by press: every key set — the plan's own and 5 alternative(s) — lands the player box on a body's 7x7 rect or on the 13 px hammer line at that tick's own phase, on the next tick, at (741.44,685.29) in level 40. There is no step out. the HAMMER-PHASE rung first saw this corner at t652, and from t654 NO PHASE admits a step: no hold of 1..44 tick(s) at any walk-offset -1..0 (0 tried) walks the approach clear for one more hammer period (45 ticks) (HAMMER_PHASE_RUNG). The plain fallback (`OPP_PRESS_FALLBACK`) rewound to the kill's first tick (t0) and redid the kill with `OPPORTUNISTIC_STRIKE` off; it did not kill (HAMMER_SAFETY: …)."
```
This is no ladder EXHAUSTED; the corner text is verbatim re-measure-9 P1 19:2 / re-measure-10 S2. S4 had capture OFF, so its own request is not on
file. The stand-in replay is re-measure-9 P1 19:2: the same text, the same `(741.44,685.29)`, and `8ef0debe2bb9` under FIVE and base alike.

B1:
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 371.5s
error: level_22__r8c0: the bot cannot walk to exit \"level_22__r8c0 -> level_25__r2c7\" — the JS runtime's walk failed: the solver declined — solverBot(js-runtime-L22-exit) reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 (the wallflyer's contact: its `hitPlayer` gate fires against the player's start-of-tick box THIS tick (body at (79.0,88.0), forecast along the walk)) inside a climb already 2 deep (CORRIDOR_LADDER_NEST 2): a stance walk whose own corridor needs the ladder again is not converging — solving… (budget 640 work units)
```
P1: `61/48 (+10 skipped), stop: entry 47 "Level 112 - Owl" in level_71__r0c6, cause: refusal "error: no path from level_71__r0c6 to level_112__r2c2, nor from the restart target Menu"`.

### Per-entry wall (from `[MEASURE tick]`, 15 s granularity; `entrywall.py`) and outcome (from the captures; `entrymarks.py`)

| entry | S1 | S2 | S3 | S4 | L1 | L2 | P1 |
|---|---|---|---|---|---|---|---|
| 19 L40 Chest | 92 s | 90 s | 105 s | **63 s, STOP** | 106 s | 102 s | 105 s |
| 26 L40 Boss Key 2 | 435 s | 420 s | 435 s | — | 480 s | 420 s | 480 s |
| 29 L41 Totem 240,144 | 375 s | 423 s | 375 s | — | 379 s | 375 s | 378 s |
| 32 L40 Totem 64,144 | 330 s | 360 s | 407 s | — | 405 s | 420 s | 330 s |
| 33 L69 Lights | 150 s | 167 s | 163 s | — | 165 s | 152 s | 150 s |
| 37 L68 Health | **98 s, STOP** | **109 s, STOP** | **114 s, STOP** | — | **96 s, STOP** | **98 s, STOP** | 105 s, skipped |

Outcomes in the capture-ON runs. "R" marks a refusal, "(retry)" the budget-2560 retry. No entry was ended by the 300 s backstop.

| entry | S1 (FIVE) | L1 (base) | P1 (FIVE) |
|---|---|---|---|
| 19 | SOLVED `ce830780f104` at 19:2 (R 19:1) | SOLVED `8e2c3dcc23fd` at 19:2 (R 19:1) | SOLVED `8e2c3dcc23fd` at 19:2 (R 19:1) |
| 26 | SOLVED `535a61951b01` at 26:12 (R 7, 9, 10(retry), 11) | SOLVED `535a61951b01` at 26:13 (R 6, 8, 10, 11(retry), 12) | as L1 |
| 29 | SOLVED `5b74f789f125` (R 29:9 exit-39) | SOLVED `5b74f789f125` (R 29:9) | SOLVED `5b74f789f125` (R 29:9) |
| 32 | SOLVED **32:10** `f2c760f195ad` (R 6, 8) | SOLVED **32:12(retry)** `a404ddf42e41` (R 6, 8, **10**, 11) | SOLVED **32:10** `64d2346b2a97` (R 6, 8) |
| 33 | SOLVED `9e240fd42a9c` | SOLVED `f6366900f81f` | SOLVED `f86ed980fe63` |
| 37 | REFUSED 37:8(retry) `9c5ba5c37277` (R 3, 5, 7) | the same | the same (skipped) |

### The L40 32:10 / 32:12 table (with hits)

`seam.mjs` reads `staging.seam.time`. Ticks and hits come from `replay-counts.mjs` (the page plan's keys played on a fresh run). Each answer reproduces the live one, 3/3 (`REPLAY: … 1 distinct answer(s) over 3`).

| request | seam | page | FIVE replay | base replay | switch that decides it |
|---|---|---|---|---|---|
| **S1 32:10** | **78862** (a third arrival) | `f2c760f195ad` solved, work 524 | `f2c760f195ad`, 649 t, **0 h** | **refused** `4fa2ec303932` | PKSW (`HAMMER_SAFETY` at t1534 refused at 1594 → `wait 0 → solved`); PKRB 144/124, DSS 1, LHM moves (216,87) |
| S1 32:12 | — | not sent | | | |
| **L1 32:10** | **81743** | **refused** `4fa2ec303932`, work 208 | `64d2346b2a97`, 649 t, **0 h** | refused `4fa2ec303932` | PKSW (as above) |
| **L1 32:12** | 83213 | `a404ddf42e41` solved, work 1866 | `a404ddf42e41`, 1889 t, **0 h** | `a404ddf42e41`, 0 h | LHM `moves` (248,103), 130 t |
| **P1 32:10** | **81743** (byte-identical to L1 32:10) | `64d2346b2a97` solved, work 526 | `64d2346b2a97`, 0 h | refused `4fa2ec303932` | PKSW |
| P1 32:12 | — | not sent | | | |
| re-measure-10 **S1 32:10** | 79256 | (STACK) `ac074b4b9d66` | `ac074b4b9d66`, 613 t, **0 h** | refused `468697963324` | PKSW |
| re-measure-10 **C2 32:10** (= re-measure-9 F1) | **81985** | (base, LHM OFF) refused `cd02c0916e6c` | **refused** `68970bcd9431` (death at t2058, `bomb bombpusher@112,128#17`; `PRESS_KILL_REBOOT_GUARD`) | refused `cd02c0916e6c` | **OAC** `asked 238, withheld 6`; PKRB 126/86; LHM declined *"no hitless wait (0 fork(s))"*; HSB `tried 0` |
| re-measure-10 **C2 32:12** | 83455 | (base, LHM OFF) refused `599d2ef41b84` | `a404ddf42e41`, **0 h** | `a404ddf42e41`, **0 h** | LHM (248,103) |

**Which arrival each run drew:** S1 drew seam 78862, a new one (neither 81985 nor 79256). L1 and P1 both drew 81743, the arrival re-measure-10's P1 also got
(answer `f2c760f195ad` there under STACK). No run here drew re-measure-9 F1's 81985. S2–S4 and L2 are not on file (capture OFF).

### Every solved answer with a page hit (`modelHits`, `hits.py`)

| run | solved | answers with hits>0 |
|---|---|---|
| smoke | 24 | none |
| S1 (FIVE) | 206 | **5:7** "Level 017 - Chest" `wasm-continue-exit-16` `4ef7e74de551` (dashless 1, full 1); **18:11** "Level 039 - Totem Part 72,40" `wasm-location-39` `719a637caca4` (dashless 1) |
| L1 (base) | 202 | 5:7 `4ef7e74de551` only |
| P1 (FIVE) | 209 | 5:7 `4ef7e74de551` only |

**S1 18:11** replays to `719a637caca4` under both FIVE and base (2864 t, `hits=1 ["t1521 spinner-hammer:spinner@112,88"]`). It depends on the arrival:
S1's seam is 29994, after one extra `wasm-continue-exit-15` repeat (4 against L1/P1's 3). L1 18:10 and P1 18:10 (seam 30052) give `2e1603a6ae22`, 0 h,
under both envs. Re-measure-10 saw only 5:7. **Every L40 answer in all three captures is 0-hit.**

## Replay proof (`replay-seedling-solve-request.mjs --n=3 --live`)

Every line reads `1 distinct answer(s) over 3, 1 distinct trace(s)`.

| request | FIVE | base |
|---|---|---|
| S1 37:8 (the stop) | refused `9c5ba5c37277` = live | refused `9c5ba5c37277` |
| L1 37:8 (the stop) | refused `9c5ba5c37277` | refused `9c5ba5c37277` = live |
| S1 32:10 | `f2c760f195ad` = live | refused `4fa2ec303932` |
| L1 32:10 | `64d2346b2a97` | refused `4fa2ec303932` = live |
| L1 32:12 | `a404ddf42e41` | `a404ddf42e41` = live |
| P1 32:10 | `64d2346b2a97` = live | refused `4fa2ec303932` |
| P1 38:6 (skip 2) | refused `e410e113fd01` = live | refused `e410e113fd01` |
| P1 39:1 (skip 3) | refused `6bd9d381b7df` = live | refused `6bd9d381b7df` |
| S1 18:11 (the hit) | `719a637caca4` = live | `719a637caca4` |
| L1 18:10 | `2e1603a6ae22` | `2e1603a6ae22` = live |
| re-measure-10 C2 32:10 | refused `68970bcd9431` | refused `cd02c0916e6c` |
| re-measure-10 C2 32:12 | `a404ddf42e41` | `a404ddf42e41` |
| re-measure-10 S1 32:10 | `ac074b4b9d66` | refused `468697963324` |
| re-measure-9 P1 19:2 (S4's stop text) | refused `8ef0debe2bb9` | refused `8ef0debe2bb9` |

Each pair's `replay-counts.mjs` counters are under `…-evidence/replay/counts-*.txt`. On the four stop requests (37:8, 38:6, 39:1, 19:2), none of the five
switches' counters moves, except PKRB's `asked 168, refused 0` and PKSW's `not-asked` ("the refused kill ran 654 tick(s) from its first tick (bound
180)") on 19:2.

## The skip probe: the next refusals (P1, FIVE)

| # | entry / request | text | vs re-measure-10 P1 |
|---|---|---|---|
| 1 | **37** "Level 068 - Health", 37:8 `9c5ba5c37277` | the L63 WandShot (5 Enemy-typed bodies) | **same** |
| 2 | **38** "Level 071 - Chest", 38:5 (deadline) → **38:6** `e410e113fd01` | *"apitem (160,256) contact -> kill: the count is still waiting on [lavarunner@64,224] … (KILLLOCK_CHASER_REWIND)"* | **same** (step 189) |
| 3 | **39** "Level 074 - Darkshield", 39:0 (deadline) → **39:1** `6bd9d381b7df` | *"reach-exit (96,0)->L75 -> kill: the count is still waiting on [lavarunner@64,224] …"* | **same** (step 189) |
| 4–10 | 40 L079 Darksuit, 41 L063 Chest, 42 L080 Chest, 43 L082 King of Fire, 44 L098 Chest, 45 L106 Ghostsword, 46 L109 Firewand | *"no path from level_71__r0c6 to …, nor from the restart target Menu"*: artefacts, because the skipped items were never granted | same pattern |

Attribution: no five-switch counter fires on 37:8, 38:6 or 39:1 (all `asked 0` / `tried 0`). The walls are the W67 WandShot model gap and the
lavarunner kill-lock.

## Then / now

| run | config | checked | stop entry | cause | wall (bot-plays) | 19 | 26 | 29 | 32 | 33 | 37 | page hits (captured) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rm-10 S1, S3, S4 | STACK, d8bd5bb578 | 36/48 | 37 | WandShot | 3939–4090 s | pass | pass | pass | pass | pass | STOP | S1: 5:7 only |
| rm-10 S2 | STACK | 18/48 | 19 | spinner@880,848 corner | 1183 s | STOP | | | | | | — |
| rm-10 C1 | base (LHM OFF) | 36/48 | 37 | WandShot | 3908 s | pass | pass | pass | pass | pass | STOP | — |
| rm-10 C2 | base (LHM OFF) | 31/48 | 32 | 32:10 + 32:12 refused | 3403 s | pass | pass | pass | STOP | | | 5:7 only |
| **S1** | FIVE | **36/48** | 37 | WandShot | 3731 s | pass | pass | pass | pass (32:10 PKSW, 0 h) | pass | STOP | 5:7, **18:11** (arrival, not FIVE) |
| **S2** | FIVE | **36/48** | 37 | WandShot | 3802 s | pass | pass | pass | pass | pass | STOP | — |
| **S3** | FIVE | **36/48** | 37 | WandShot | 3793 s | pass | pass | pass | pass | pass | STOP | — |
| **S4** | FIVE | 18/48 | 19 | spinner@880,848 corner | 1147 s | STOP | | | | | | — |
| **L1** | base (LHM ON) | **36/48** | 37 | WandShot | 3865 s | pass | pass | pass | pass (32:10 R → 32:12 LHM, 0 h) | pass | STOP | 5:7 only |
| **L2** | base (LHM ON) | **36/48** | 37 | WandShot | 3748 s | pass | pass | pass | pass | pass | STOP | — |
| **P1** | FIVE, skip 10 | 36/48 real | (37, 38, 39) | WandShot; lavarunner ×2 | 3858 s | pass | pass | pass | pass (32:10 PKSW, 0 h) | pass | skipped | 5:7 only |
| **B1** | FIVE, JS | 8/48 | 9 | `CORRIDOR_LADDER_NEST 2` | 360 s | | | | | | | — |

## The criterion today

**Summary for Robert:** at `be493c453a`, seed 1 passes entry 32 under FIVE in **3/4** runs, and **3/3** of those that reached it. Every entry-32
answer is **0-hit**, and every FIVE run that passes 32 stops at **entry 37**, the L63 WandShot staging refusal. That is the W67 model gap
fidelity owns, not on this base. The fourth run (S4) stopped at **entry 19**, the spinner@880,848 corner, which none of the five touches. Under
**base defaults, the LHM flip** passes 32 in **2/2**, also hitless. On the bad arrival LHM does exactly what was hoped: 32:10 refuses, and 32:12
solves through the moved hold (`a404ddf42e41`, 0 h).

The one apples-to-apples request (L1 = P1 32:10, seam 81743) shows what FIVE adds on top of LHM. **PKSW solves 32:10 at once** where base
refuses it. On re-measure-10's 1-hit bad arrival, **OAC turns the hit into a refusal**, and the walk then passes by LHM at 32:12. HSB fired
once, on S1's L39 arrival, and found no hitless replacement. That hit (spinner@112,88) is the arrival's, not FIVE's: base takes it too.

So no FIVE run took a page hit that the same request would not take under base. **Entry 37 is the next wall, for both configs. 38 and 39
(the lavarunner kill-lock, step 189) are behind it.**

All counts are samples: FIVE N=4 (+P1), base N=2, and hits are on file only for the three capture-ON runs.

## Evidence (`CC/docs/cloud-reports/seedling-whole-game-wasm-remeasure-11-evidence/`, 9.1 MB)

- **Per arm:** `<arm>.measure.log`, `.summary.txt` and `.stop-status.txt`. For the capture-ON arms, also `.capture-summary.txt` (every captured answer, with its
  `solverEnv`) and `.page-hits.txt`.
- **Requests kept** (the rest of each capture was dropped for size):
  - `S1.stop-requests-18-32-37.jsonl.gz`;
  - `L1.stop-requests-18-32-37.jsonl.gz`;
  - `P1.stop-requests-32-37-38-39.jsonl.gz`.
- **Replays:** `replay/<run>-<id>-<i>-{F,D}.txt` (the `REPLAY:` lines) and `replay/counts-*.txt` (counters, ticks and hits).
- **Scripts:**
  - runners: `seq.sh`, `run-arm.sh`, `replays.sh` and `replays2.sh`;
  - replay tools: `replay-counts.mjs` and `seam.mjs`;
  - log readers: `entrywall.py`, `entrymarks.py`, `hits.py`, `sumcap.py`, `keep.py` and `statuses.py`;
  - `seq.log` (the arm log).
- `replays.sh`'s four `rp` lines on the gzipped earlier-run files failed (the replay script reads plain jsonl). `replays2.sh` re-ran those four
  on gunzipped copies. The counters in `replays.sh` read `.gz` directly and were fine.
