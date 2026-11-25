# Cloud report: `seedling-whole-game-wasm-remeasure-8`

**The whole-game Seedling wasm walk, seed 1, on MAIN at TRAIN 207 with ALL FIVE hammer switches ON
(`GOAL_START_WAIT`, `PREVIEW_METER`, `PRESS_KILL_HOLD`, `STRIKE_PREVIEW_LEAN`, `KEYLOCK_TURRET_ARRIVAL`). MEASURE ONLY.**

Launcher: `seedling-hammer-phase-planning-14`; brief reviewed by `seedling-js-planning-23`. Ruling: Robert (2026-11-24),
*"Re-measure-8, all ON"*. Branch: the harness pinned **`claude/whole-game-wasm-remeasure-8-89f0jy`**, and every push went
there. `seedling-whole-game-wasm-remeasure-8` was only ever a local name. Nothing was fixed. The only code commits are the
two cherry-picked MEASUREMENT-ONLY knob commits; everything else is evidence and this report. **Not for landing.**

⚠ **Every number below is "at a5f7c6caf4, all ON" (Arms A, B, P) or "at a5f7c6caf4, all OFF" (Arm C).**

## Summary for Robert

- **Yes: with all five switches ON, seed 1 passes entry 29, in 3 of 3 runs** (A1, A2, A3; the probe P1 passes it too). The
  re-measure-7 stop (L40→L41 boss lock `bosslock@480,352` behind `iceturret@472,400`, survey step 134) is gone. Its captured
  request, replayed in node, **solves ON** (`5f46423586e1`, = the page's answer) and **still refuses HARD OFF** (`c7b1b22b2c60`,
  re-measure-7's answer). The counters show **`KEYLOCK_TURRET_ARRIVAL`** firing on it: it asks for `bosslock@480,352`, and the
  turret dies in 516 ticks. The page then plays the exit in 1404 ticks.
- **The new first wall is bimodal between two survey steps that are still REFUSED at BASE:**
  - **1 of 3 runs (A1) stops at entry 32**, "Level 040 - Totem Part 64,144", at **31/48**: *"apitem (64,144) contact -> hold: the
    hold stands still … inside bombpusher@112,128's 256 px reach — a Bomb's Explosion at (168,134) 44 tick(s) into the wait …
    (MOVING_WAIT, 256 tried) … — and the solver ran out of 640, then 2560 work units on its held retry"* (**survey step 149**).
    The probe P1 met the same answer (`599d2ef41b84`) and skipped it.
  - **2 of 3 runs (A2, A3) pass entry 32 and stop at entry 33**, "Level 069 - Lights", at **32/48**. The L61 exit refuses: *"bridge
    bridge@11,13 in level 61 — no floor cell one or two tiles behind it puts the spear's 32x5 rect on it and is reachable …"*
    (**survey step 155**, verbatim). It is HARD (work 224) and independent of the switches in replay. **Every ON run that gets
    past 32 stops here.** It is the first wall every ON run would hit.
- **The entry-32 split is decided one request earlier**, on the "continue on from the held room" solve of Totem 64,144: A2 and A3
  solve it at 640; A1 (`a8a824ee2146`, work 230) and P1 (`dc09599d8d62`, work 208) refuse it ("kill (spinner@192,128) by press …
  every key set … lands the player box on … the hammer line"), and the full re-plan then runs out at 2560. On A1's refused
  request **`PRESS_KILL_HOLD` was asked and refused** ("the idle is hit at its tick 40"). ⚠ The two runs that refused at 32 are
  the two capture-ON runs; the two that passed had capture OFF. 2 + 2 samples cannot say whether that is chance or the capture's
  overhead moving the arrival. Re-measure-7 saw no capture effect.
- **The control (all OFF) is still bimodal at L40:** C1 stopped at **entry 26** (26/48: the {40,12} burn EXHAUSTED on
  `chaser:bob@736,752`, survey step 96, re-measure-6's wall), and C2 at **entry 19** (18/48: the HARD `spinner@880,848` corner,
  survey step 66). That is 0 of 2 OFF runs past 26, against 3 of 3 ON runs. In replay, **C1's 2560 burn refusal solves ON through
  `GOAL_START_WAIT`** (wait 50, ok). **Re-measure-7's C1 880 corner request, replayed ON at 2560, solves through
  `PRESS_KILL_HOLD`** (wait 45, solved; work 2561, right at the budget, so it is marginal).
- **JS: 8/48, unchanged**, verbatim (L22→L25, `CORRIDOR_LADDER_NEST 2`, `chaser:wallflyer@64,80`). All 15 JS-frame solve-worker
  URLs carry the five-switch spec.
- **No watch-list leg was reached.** No ON run got as far as L70, L71 or L101. No captured request asks for L40 flag 8. Heap
  656 MB flat in every wasm run (82–251 samples), with no OOM and no `RuntimeError`. The 300 s backstop ended no wasm entry.
- **One container restart** (between 21:56Z and 02:27Z) killed B1's first attempt at about 180 s, at entry 5. It was re-run in
  full, and no other arm was lost.

## Base, subject and box

| | |
|---|---|
| base | **`a5f7c6caf4563d8b0c65776f03ada03e2343c04a`** = `origin/main` at launch = TRAIN 207 (`train: hammer-stack-face1-meter a8ebbf60a2`). The planner named no later main |
| measured head | **`2d7f59fc`** = base + `b10974a6` (cherry-pick of `1212b2e0`, the capture knob) + `2d7f59fc` (cherry-pick of `44743ba7`, the solver-env flag). Both cherry-picks were clean. Every arm's box-lock line reads *"head 2d7f59fc8, 0 tracked change(s) frozen"*. Evidence was committed from a separate detached worktree (`/home/user/rm8-evidence`), so the measured tree never moved |
| wasm submodule `frontend/modules/flashPanel/wasm` | **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`** (the same pin as re-measure-6/7). `session_bootstrap.sh --all` → READY, "seedling wasm builds: OK (4 dirs)", "chromium: OK (/opt/pw-browsers)", "tree: clean" |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` |
| box | the cloud container: 4 cores, headless Chromium. WebGPU comes from the batch's `webgpu: true`; every wasm run reports `transport=wasm`. Dev server `scripts/serve-nocache.py 8000`. One `npm test` per arm under the box lock, so each arm got a fresh page. The replays ran only after the last arm |
| row | `tutorial-walk-seedling-whole-game`, batch `tutorials-seedling-whole-game`, step `bot-plays` |
| survey at BASE | **run 45447717668** @`a5f7c6caf4` (the train's own survey, `js-land/train-2026-11-24-207`), **conclusion `success`**. `seedling-survey-merged/through-end/survey.json`: **SOLVED 224 / REFUSED 26** (`survey-refused-rows.txt`). The survey runs the shipped defaults (all five OFF), so steps 66, 96 and 134 still read REFUSED there |

### Switch defaults at BASE (quoted from source; all five OFF, so no flip train has landed)
- `solverBot.js:3119-3122` `GOAL_START_WAIT = { enabled: globalThis.process?.env?.SEEDLING_GOAL_START_WAIT === '1', waits: [50, 100, 200, 400, 800] }`, `GOAL_START_WAIT_DEFAULT = false`
- `solverBot.js:29284-29285` `PREVIEW_METER = { enabled: …SEEDLING_PREVIEW_METER === '1', statesPerUnit: 1024 }`, `PREVIEW_METER_DEFAULT = false`
- `solverBot.js:21282-21285` `PRESS_KILL_HOLD = { enabled: …SEEDLING_PRESS_KILL_HOLD === '1', maxPeriods: 4 }`, `PRESS_KILL_HOLD_DEFAULT = false`
- `solverBot.js:15117-15120` `STRIKE_PREVIEW_LEAN = { enabled: …SEEDLING_STRIKE_PREVIEW_LEAN === '1' }`, `STRIKE_PREVIEW_LEAN_DEFAULT = false`
- `solverBot.js:18353-18354` `KEYLOCK_TURRET_ARRIVAL = { enabled: …SEEDLING_KEYLOCK_TURRET_ARRIVAL === '1' }`, `KEYLOCK_TURRET_ARRIVAL_DEFAULT = false`
- All five names are in `SOLVER_ENV_NAMES` (`solverEnvChannel.js`), one hit each.

## Knobs (re-measure-7's, exactly) and arms

| knob | value | arms |
|---|---|---|
| `TEST_MEASURE_STEP_TIMEOUT_MS` | `10800000` (`--budget-s=10800`) | all |
| `TEST_MEASURE_BOT_STALL_MS` | `300000` (`--stall-s=300`) | all |
| `TEST_AUTO_START_TIMEOUT_MS` / `TEST_TIMEOUT` | `11100000` / `11400000` (the walk script's) | all |
| `TEST_MEASURE_FLASH_RUNTIME` | `js` | B1 |
| `TEST_MEASURE_SKIP_REFUSALS` | `10` | P1 |
| `TEST_MEASURE_CAPTURE_REQUESTS` | `<jsonl>` | A1, C1, P1 (+ the 150 s smoke) |
| `TEST_MEASURE_SOLVER_ENV` | `SEEDLING_GOAL_START_WAIT=1;SEEDLING_PREVIEW_METER=1;SEEDLING_PRESS_KILL_HOLD=1;SEEDLING_STRIKE_PREVIEW_LEAN=1;SEEDLING_KEYLOCK_TURRET_ARRIVAL=1` (`--solver-env=…`) | A1–A3, B1, P1 |

Arm C passed **no** solver env, so it ran the shipped defaults, all OFF. Its captured answers carry `solverEnv: null`. Order: smoke
(150 s budget, capture + env), A1, C1, A2, C2, B1 (killed by the restart), then B1, P1, A3 (`seq.sh`, then `seq2.sh` after the
restart), then the replays (`replays.sh`). Runner: `run-arm.sh`, log `seq.log`. Every row reads `PASSED`, because the ratchet grades it
against `firstFailingStep: 'bot-plays'`. **PASSED is not victory.**

## The capture and solver-env diffs (MEASUREMENT-ONLY)

`git diff --numstat a5f7c6caf4 2d7f59fc`: `tutorialTests.js` +107/−2, `walk-seedling-whole-game.mjs` +19/−3, `app.spec.js` +20/−0 (3 files,
+146/−5), the same as re-measure-7's `1212b2e0` + `44743ba7`, cherry-picked unchanged:
- **`b10974a6`** (= `1212b2e0`): the capture knob. With `TEST_MEASURE_CAPTURE_REQUESTS` unset there is no `&measureCaptureRequests=1`,
  no `__measureCaptureAppend` binding, no import and no timer (`startRequestCapture` is reached only under `MEASURE_ACTIVE` with
  the URL param). **OFF is byte-identical.** A2, A3, C2 and B1 ran it OFF.
- **`2d7f59fc`** (= `44743ba7`): `--solver-env=A=1,B=1` → `TEST_MEASURE_SOLVER_ENV=A=1;B=1` (each entry checked against
  `^SEEDLING_[A-Z0-9_]+=.+$`) → `&seedlingSolverEnv=<encoded>` on the app URL, `page.on('worker')` → `[MEASURE worker] <url>`. Each
  captured `result` keeps the worker's own `solverEnv` stamp. Unset, nothing is appended or registered (byte-identical; C1/C2 ran
  that way). `npx vitest run scripts/procgen/walkSeedlingWholeGame.test.js`: **8 passed (8)** (that one file, ⚖ 52).

## ⛔ Knob carriage: all five switches reach the page's solve worker

The route: app URL `?seedlingSolverEnv=` → `jsRuntimeSolveService.js` builds the worker with `solveWorkerUrl(…, location.search)` →
the worker's first import, `solverEnvShim.js`, installs `globalThis.process = {env}` before any solver module evaluates.

1. **Worker URL** (every ON wasm arm):
   `[MEASURE worker] http://localhost:8000/frontend/modules/seedlingDemo/jsRuntimeSolveWorker.js?seedlingSolverEnv=SEEDLING_GOAL_START_WAIT%3D1%3BSEEDLING_KEYLOCK_TURRET_ARRIVAL%3D1%3BSEEDLING_PRESS_KILL_HOLD%3D1%3BSEEDLING_PREVIEW_METER%3D1%3BSEEDLING_STRIKE_PREVIEW_LEAN%3D1`
2. **The worker's own stamp on every answer:** `[MEASURE capture] first answer's worker solverEnv="SEEDLING_GOAL_START_WAIT=1;SEEDLING_KEYLOCK_TURRET_ARRIVAL=1;SEEDLING_PRESS_KILL_HOLD=1;SEEDLING_PREVIEW_METER=1;SEEDLING_STRIKE_PREVIEW_LEAN=1"`.
   **All 197 of A1's captured answers and all 218 of P1's** carry exactly that five-name stamp (`*.capture-summary.txt`, counted).
   This includes the stop request A1 32:12. Every C1 answer carries `env=None`.
3. **The switches' own counters**, on captured requests replayed in node with the same env (`replay-counts.mjs`; all five
   `.enabled` read `true` ON and `false` OFF). Each switch fired at least once on a page-captured request:
   | switch | request | counter |
   |---|---|---|
   | `PREVIEW_METER` | every ON replay | e.g. A1 19:2 `{"states":161138,"asked":156,"tripped":0}`; A1 26:8 `tripped 1` |
   | `STRIKE_PREVIEW_LEAN` | A1 19:2, A1 26:8, C1 26:9 | A1 19:2 `{"forecastTicksSkipped":12800,"forecastReplays":2,"spinRowsSkipped":12800}` |
   | `GOAL_START_WAIT` | A1 26:8 | `tries=[{"t":0,"wait":50,"ok":true}, …]` |
   | `KEYLOCK_TURRET_ARRIVAL` | A1 29:11 | `asked=[{"lock":"bosslock@480,352","t":100,"turrets":["iceturret@472,400"],"stance":{"x":488,"y":376}}]`, `KEYLOCK_TURRET_COUNTS.kills=[{…"dead":true,"ticks":516,"side":"right"}]` |
   | `PRESS_KILL_HOLD` | A1 32:10 | `rows=[{"t":1534,"stand":1649,"refusedAt":1654,"tries":[{"wait":45,"verdict":"idle","why":"the idle is hit at its tick 40"}],"verdict":"refused"}]` |

   Each ON replay reproduces the page's answer hash **and** work exactly (for example A1 26:8: work 2561 = live, answer `902a4907d266`
   = live). OFF replays of the same requests answer differently (A1 26:8 OFF: refusal `3c0ab3bebcec`, work 662). So the page's
   worker ran all five ON.
4. **Arm B (JS):** **the switches reach the JS frame's solve workers too.** B1 logged 15 worker URLs, all
   `jsRuntimeSolveWorker.js?seedlingSolverEnv=…` with the five-name spec, plus one other (the state manager's). The capture does
   not wrap JS-frame services, so B has no answer stamp.

## The replay proof (A1's stop request)

`SEEDLING_GOAL_START_WAIT=1 SEEDLING_PREVIEW_METER=1 SEEDLING_PRESS_KILL_HOLD=1 SEEDLING_STRIKE_PREVIEW_LEAN=1 SEEDLING_KEYLOCK_TURRET_ARRIVAL=1 node scripts/procgen/replay-seedling-solve-request.mjs --requests=A1.jsonl --id=32 --i=12 --n=3 --live`
(`replay/A1-32-12.txt`):
```
ROW {"id":32,"key":"Level 040 - Totem Part 64,144","i":12,"run":0,"seamTime":80613,"budgetWork":2560,"passes":[{"pass":"dashless","ok":false,"kind":"refusal","ticks":null,"work":836},{"pass":"full","ok":false,"kind":"refusal","ticks":null,"work":1725,"deadline":"crusher-fork","limit":"budget"}],"work":2561,"ok":false,"kind":"refusal","answer":"599d2ef41b84",…}   (runs 1, 2 the same)
REPLAY: leg 32 request 12 (budget 2560): 1 distinct answer(s) over 3, 1 distinct trace(s)
LIVE: the page's worker answered {"ok":false,"kind":"refusal","work":2561,"passes":[{"pass":"dashless",…"work":836},{"pass":"full",…"work":1725,"deadline":"crusher-fork","limit":"budget"}],"answer":"599d2ef41b84", … "solverEnv":"SEEDLING_GOAL_START_WAIT=1;SEEDLING_KEYLOCK_TURRET_ARRIV…
```
**The page's stop reproduces 3 of 3: same kind, answer hash and work.** With all OFF the same request gives **the same answer and work**
(`counts-A1-32-12-OFF.txt`: refusal 2561 `599d2ef41b84`). The entry-32 stop request does not depend on the switches. Only
`PREVIEW_METER` counts on it (321979 states, 0 tripped); the other four record nothing. P1 32:12 answers the same hash.

### Attribution replays (node, at the measured head, one run each; `replay/counts-*.txt`)

⚠ **All-ON vs all-OFF cannot credit a move to ONE switch.** The counters below say which switch's code path a request goes down. They
are not a one-switch-at-a-time ablation.

| request | env | answer | work | ms | the switch whose path it hits |
|---|---|---|---|---|---|
| A1 29:11 (`wasm-exit-40`, L40→L41, the re-measure-7 wall) | ON | **solved `5f46423586e1`** = live | 642 = live | 7315 | **`KEYLOCK_TURRET_ARRIVAL`** (asked, turret killed 516 t) · PM 9841 / 8 / tripped 1 |
| A1 29:11 | OFF | **HARD refusal `c7b1b22b2c60`** (= re-measure-7's stop answer) | 74 | 2126 | — |
| A1 32:12 (the A1 stop, 2560) | ON | refusal `599d2ef41b84` = live | 2561 | 39965 | none but PM (321979 states) |
| A1 32:12 | OFF | refusal `599d2ef41b84` | 2561 | 42299 | — |
| A1 32:10 (continue-location, 640) | ON | refusal `a8a824ee2146` = live | 230 | 66535 | **`PRESS_KILL_HOLD` asked, refused** ("the idle is hit at its tick 40") · SPL 104 forecast replays |
| A1 32:10 | OFF | refusal `5b043103efee` | 220 | 62012 | — |
| P1 33:5 (L61 bridge, the A2/A3 stop) | ON | HARD `74d893565dd6` = live | 224 | 609 | none but PM |
| P1 33:5 | OFF | HARD `74d893565dd6` | 203 | 674 | — |
| A1 26:8 (the {40,12} burn retry, 2560) | ON | solved `902a4907d266` = live | 2561 | 43366 | **`GOAL_START_WAIT`** (`wait 50, ok:true`) · PM tripped 1 |
| A1 26:8 | OFF | refusal `3c0ab3bebcec` | 662 | 17383 | — |
| C1 26:9 (the **OFF** control's stop: burn EXHAUSTED, 2560) | OFF | refusal `2dbe6e74fcc8` = live | 331 | 7501 | — |
| C1 26:9 | **ON** | **solved `8110fa258e07`** | 1571 | 23468 | **`GOAL_START_WAIT`** (`[{t:0, wait:50, ok:true}]`) · SPL 7200 skipped |
| re-measure-7 C1 19:1 (`spinner@880,848`, its HARD stop at 640) with `budgetWork` set to 2560 (an approximation of the held retry) | **ON** | **solved `517e4c5d19e2`** | 2561 | 96585 | **`PRESS_KILL_HOLD`** (`stand 636, refusedAt 653, tries [{wait:45, verdict:"solved"}]`) · SPL 669200 skipped · PM tripped 1 |
| A1 19:2 (the 816 retry, 2560) | ON | solved `3ff0a60bc964` = live | 1615 | 25998 | PM, SPL only |

The re-measure-7 version of that last-but-one row, with only GSW+PM ON, was HARD `9d91691740df` at 2560 (160 s). The work of 2561 here
means it solved right at the budget edge, so a page retry with any less headroom could still cut.

## Arm A: wasm, seed 1, all five ON (3 runs)

| run | capture | checked / total (bot) | snapshot | last sphere | stop: region / entry | cause by name | `bot-plays` wall | region changes / pushes | heap |
|---|---|---|---|---|---|---|---|---|---|
| A1 | ON | **31/48** | 52 | 9.4 | `level_40__r4c4`, **entry 32 "Level 040 - Totem Part 64,144"** | refusal after the held retry: hold inside `bombpusher@112,128`'s reach, MOVING_WAIT 256 tried, "ran out of 640, then 2560" (step 149) | 3230.4 s (row 3245.3 s) | 229 / 149 | 656 MB flat (216) |
| A2 | OFF | **32/48** | 54 | 9.5 | `level_61__r13c12`, **entry 33 "Level 069 - Lights"**, exit `level_61__r13c12 -> level_63__r10c2` | HARD refusal: spear bridge `bridge@11,13` (step 155) | 3342.2 s (row 3357.2 s) | 239 / 155 | 656 MB flat (223) |
| A3 | OFF | **32/48** | 54 | 9.5 | the same as A2 | the same, text identical | 3061.0 s (row 3075.4 s) | 239 / 156 | 656 MB flat (204) |

**3 of 3 pass entry 29. 1 of 3 stops at entry 32 (31/48), 2 of 3 at entry 33 (32/48).** Entries 27 and 28 are checked on the way.

**Per-entry wall** (15 s `[MEASURE tick]`s, `entrywall.py`; status sequences from `statuses.py`):

| run | entry 19 "L40 Chest" | entry 26 "L40 Boss Key 2" | entry 29 "L41 Totem 240,144" | entry 32 "L40 Totem 64,144" | entry 33 "L69 Lights" |
|---|---|---|---|---|---|
| A1 | ~87 s, **SOLVED after a cut**: 19:1 640 cut (`668f4ca7aff6`, the 816 family) → 19:2 2560 **solved** (1615) | ~450 s, **SOLVED after cuts**: 26:7 640 cut → 26:8 2560 **solved via GSW** (2561); 26:9/26:10 BK2 collect 640 / 2560 cut (`432ec5f5b196`); 26:11 re-plan cut → 26:12 2560 **solved** | ~375 s, **SOLVED**: 29:9 `wasm-exit-39` 640 cut → 29:10 2560 solved; **29:11 L40→L41 solved at 640 via KTA** (plays 1404 t) | ~467 s, **REFUSED (+retry) — the stop**: 32:8 clear-tag {40,7} 640 cut → 32:9 2560 solved; 32:10 continue 640 **refused** (230); 32:11 640 cut → **32:12 2560 refused** | — |
| A2 | ~177 s, **SOLVED after a cut** ("solving… 640" → "solving again … 2560, retry 1" → plays 1663) | ~512 s, **SOLVED after a cut** (wandlock@480,560 first, 640 → retry 1 → plays) | ~378 s, **SOLVED** (L40→L41 plays 1404) | ~345 s, **SOLVED** (wandlock@208,128 retry 1 → plays 1449; continue-location solved at 640 → plays 595) | ~69 s, **REFUSED HARD — the stop** |
| A3 | ~105 s, **SOLVED after a cut** (640 → retry 1 → plays 1106) | ~435 s, **SOLVED** | ~362 s, **SOLVED** | ~330 s, **SOLVED** (retry 1 → plays 1449; continue solved at 640 → plays 772) | ~57 s, **REFUSED HARD — the stop** |

No wasm entry in any arm was ended by the 300 s backstop.

The A1 stop:
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 3245.3s
[tutorial-walk-timing] seedling-whole-game: load 4.1s, start-game-clear-save-panel 0.1s, start-game-clear-save 0.7s, start-game-page 5.0s, start-game 1.4s, bot-plays-open 0.2s, bot-plays 3230.4s
[MEASURE end] seedling-whole-game t=3242s step=bot-plays checked=52 botQueue=48 botCursor=31 botChecked=31 botHead="Level 040 - Totem Part 64,144" botRegion="level_40__r4c4" lastRegionEvent="level_40__r4c4" regionChanges=229 wasmPushes=149 transport=wasm wasmMemMB=656 jsHeapMB=228 status="error: … (below)"
```
The refusal, in full (`A1.stop-status.txt`):
```
error: level_40__r4c4: the bot cannot walk to location "Level 040 - Totem Part 64,144" — the wasm playback failed: the solver declined Level 040 - Totem Part 64,144 in level 40 (pass dashless): solverBot(wasm-location-40) apitem (64,144) contact -> hold: the hold stands still for up to 131 tick(s) at (167.88102975116135,135.24945805128786), inside bombpusher@112,128's 256 px reach — a Bomb's Explosion at (168,134) 44 tick(s) into the wait — a player standing within 256 px of a BombPusher is aimed at and the blast lands one step past the aim, inside its 15 px disc (`bombPusher.js`). The group is LATCHED, so the wait may pace, and no pacing is clean (MOVING_WAIT, 256 tried): left/right x6 gap 0: cycle 1 ends at (170.98102975116137,135.24945805128786), not the stance; right/left x6 gap 0: cycle 1 ends at (165.18102975116133,135.24945805128786), not the stance; up/down x6 gap 0: cycle 1 ends at (167.88102975116135,138.8994580512879), not the stance; down/up x6 gap 0: spinner:spinner@192,128 at paced tick 33 (167.88,144.00) …. — and the solver ran out of 640, then 2560 work units on its held retry on location in level 40
```
The status itself truncates at "…." (it is a ladder whose full text the page does not keep). It is a budget-cut refusal at 2560, not
an EXHAUSTED ladder; the full pass stopped with `"deadline":"crusher-fork","limit":"budget"`. The captured request is
**`A1 32:12`** (`A1.stop-requests.jsonl.gz`, which also holds entries 19, 26 and 29).

The A2/A3 stop:
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 3357.2s        (A3: 3075.4s)
[tutorial-walk-timing] seedling-whole-game: … bot-plays 3342.2s       (A3: bot-plays 3061.0s)
[MEASURE end] seedling-whole-game t=3354s step=bot-plays checked=54 botQueue=48 botCursor=32 botChecked=32 botHead="Level 069 - Lights" botRegion="level_61__r13c12" lastRegionEvent="level_61__r13c12" regionChanges=239 wasmPushes=155 transport=wasm wasmMemMB=656 jsHeapMB=202 status="error: level_61__r13c12: the bot cannot walk to exit \"level_61__r13c12 -> level_63__r10c2\" — the wasm playback failed: the solver declined level_61__r13c12 -> level_63__r10c2 in level 61 (refusal): solverBot: bridge bridge@11,13 in level 61 — no floor cell one or two tiles behind it puts the spear's 32x5 rect on it and is reachable: (168,216) facing E's rect also reaches tile:Bridge@168,216; (152,216) facing E's rect also reaches tile:Bridge@168,216; (184,232) facing N is not floor; (184,248) facing N is off the level; (200,216) facing W's rect also reaches tile:Bridge@168,216; no corridor reaches (216,216) facing W; (184,200) facing S is not floor; (184,184) facing S is not floor" …
```
A2 and A3 were capture OFF, so their request is P1's identical one: **`P1 33:5`**, answer `74d893565dd6` (HARD, work 224; the same
answer ON and OFF in replay; the same answer as re-measure-7's P1 33:5).

## Arm C (control): wasm, seed 1, all OFF, the same BASE (2 runs)

| run | capture | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes | heap |
|---|---|---|---|---|---|---|---|---|---|
| C1 | ON | **26/48** | 42 | 7.3 | `level_40__r48c54`, **entry 26 "Level 040 - Boss Key 2"** (the leg "L40 flag 12: wandlock@480,560 cleared") | refusal after the held retry: "clear-tag {40,12} wandlock@480,560 -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED … chaser:bob@736,752" (step 96) | 1881.8 s (row 1897.3 s) | 168 / 111 | 656 MB flat (126) |
| C2 | OFF | **18/48** | 32 | 6.8 | `level_40__r26c13`, **entry 19 "Level 040 - Chest"** | HARD refusal at 640: "kill (spinner@880,848) by press … There is no step out … from t654 NO PHASE admits a step (HAMMER_PHASE_RUNG)" (step 66) | 1221.6 s (row 1236.7 s) | 105 / 71 | 656 MB flat (82) |

**OFF is bimodal at L40, as in re-measure-6 and -7: 1 of 2 at entry 26, 1 of 2 at entry 19, and 0 of 2 past 26.**

Entry walls: C1 19 ~105 s **SOLVED after a cut** (19:1 640 cut `668f4ca7aff6` → 19:2 2560 solved, 1596: the 816 arrival); C1 26
~154 s **REFUSED (+retry)** (26:8 640 refusal → 26:9 2560 refusal `2dbe6e74fcc8`, work 331, EXHAUSTED); C2 19 ~124 s **REFUSED
HARD, no retry** (the 880 arrival). Neither reached 29.
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1897.3s
[MEASURE end] seedling-whole-game t=1894s step=bot-plays checked=42 botQueue=48 botCursor=25 botChecked=26 botHead="Level 040 - Boss Key 2" botRegion="level_40__r48c54" lastRegionEvent="level_40__r48c54" regionChanges=168 wasmPushes=111 transport=wasm wasmMemMB=656 jsHeapMB=215 status="error: level_40__r48c54: the bot cannot walk to location \"L40 flag 12: wandlock@480,560 cleared\" — the wasm playback failed: the solver declined L40 flag 12: wandlock@480,560 cleared in level 40 (refusal): solverBot(wasm-location-40) clear-tag {40,12} wandlock@480,560 -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED. The corridor passes through danger at (744.3,802.3) — chaser:bob@736,752 (inside leash 80 (d=5.3), box grown 0.5 px/tick x 0 + pad 0) — and every rung of ⚖ §11.8a's order refused: …"   (C1; full text in C1.stop-status.txt)

[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1236.7s
[MEASURE end] seedling-whole-game t=1234s step=bot-plays checked=32 botQueue=48 botCursor=18 botChecked=18 botHead="Level 040 - Chest" botRegion="level_40__r26c13" lastRegionEvent="level_40__r26c13" regionChanges=105 wasmPushes=71 transport=wasm wasmMemMB=656 jsHeapMB=202 status="error: level_40__r26c13: the bot cannot walk to location \"Level 040 - Chest\" — the wasm playback failed: the solver declined Level 040 - Chest in level 40 (refusal): solverBot(wasm-location-40) apitem (880,816) contact -> kill (spinner@880,848) by press: every key set — the plan's own and 5 alternative(s) — lands the player box on a body's 7x7 rect or on the 13 px hammer line at that tick's own phase, on the next tick, at (741.44,685.29) in level 40. There is no step out. the HAMMER-PHASE rung first saw this corner at t652, and from t654 NO PHASE admits a step: no hold of 1..44 tick(s) …"   (C2; full text in C2.stop-status.txt)
```
C2 ran capture OFF, so its 880 request is not on file. The ON replay of re-measure-7's C1 19:1 (the same corner, answer
`9d91691740df` live) stands in for it (above: solved through `PRESS_KILL_HOLD` at 2560).

## Arm B: JS, seed 1, all five ON (1 run)

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes |
|---|---|---|---|---|---|---|---|
| B1 (`transport=js`) | **8/48** | 16 | 3.7 | `level_22__r8c0`, entry **9 "Level 025 - Chest"**, exit `level_22__r8c0 -> level_25__r2c7` | `CORRIDOR_LADDER_NEST 2` against `chaser:wallflyer@64,80` | 362.3 s (row 375.5 s) | 51 / 35 |
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 375.5s
[MEASURE end] seedling-whole-game t=373s step=bot-plays checked=16 botQueue=48 botCursor=8 botChecked=8 botHead="Level 025 - Chest" botRegion="level_22__r8c0" lastRegionEvent="level_22__r8c0" regionChanges=51 wasmPushes=35 transport=js wasmMemMB=? jsHeapMB=290 status="error: level_22__r8c0: the bot cannot walk to exit \"level_22__r8c0 -> level_25__r2c7\" — the JS runtime's walk failed: the solver declined — solverBot(js-runtime-L22-exit) reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 (the wallflyer's contact: its `hitPlayer` gate fires against the player's start-of-tick box THIS tick (body at (79.0,88.0), forecast along the walk)) inside a climb already 2 deep (CORRIDOR_LADDER_NEST 2): a stance walk whose own corridor needs the ladder again is not converging — solving… (budget 640 work units)" …
```
These are re-measure-4 to -7's words, verbatim. The wasm walk meets the same refusal at entry 9 (P1 `9:7`, work 643) and recovers.
The first B1 attempt was killed by the container restart about 180 s in, at entry 5 (`B1-killed-by-restart.measure.log`).

## Skip probe: wasm, seed 1, all five ON, `--skip-refusals=10`, capture ON (P1)

`bot-plays` 3762.2 s (row 3777.3 s), 254 region changes, 166 pushes, heap 656 MB flat (251 samples), 218 requests captured. It
followed A1's path through entry 31 (19: 90 s, cut → retry; 26: ~496 s; 29: ~375 s, **solved**), then spent 2 skips:
```
[MEASURE skip 1] t=3174s skipping entry 32/48 "Level 040 - Totem Part 64,144" (sphere 9.4)
[MEASURE skip 2] t=3239s skipping entry 33/48 "Level 069 - Lights" (sphere 9.5)
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 3777.3s
[MEASURE end] seedling-whole-game t=3774s step=bot-plays checked=52 botQueue=48 botCursor=33 botChecked=54 botHead="Level 043 - Wand" botRegion="level_43__r13c7" lastRegionEvent="level_43__r13c7" regionChanges=254 wasmPushes=166 transport=wasm wasmMemMB=656 jsHeapMB=242 status="blocked: the check of \"Level 043 - Wand\" did not land" walkEnd=failed walkStep=bot-plays why="done check threw: the app shows it cannot finish: the Playback Bot has said \"blocked: the check of \"Level 043 - Wand\" did not land\" for 300 s"
```
**It then stalled at entry 34 (L43 Wand), as re-measure-7's probe did.** The state manager logs
`[SMW] checkLocation: Location check was rejected. Reason: not_accessible`. The skipped entries never granted their items, so the AP
logic holds the Wand inaccessible. A stall is not an error, so the probe could not skip it, and 8 skips went unspent. This is a
probe artefact. The walk script's "52/48 (+2 skipped)" is not a real tally, because `botChecked` counts skips.

## The next refusals, with captured-request ids

Ids are `run entry:i`: P1 (`P1.stop-requests.jsonl.gz` holds entries 32–34; `P1.capture-summary.txt` lists all 218) and A1
(`A1.stop-requests.jsonl.gz` holds 19, 26, 29 and 32). Survey at BASE: run **45447717668**, conclusion **success**, REFUSED 26.

| # | entry | location | refusal (quoted) | request id | kind | survey match (REFUSED at BASE?) |
|---|---|---|---|---|---|---|
| 1 | 32 | Level 040 - Totem Part 64,144 | "apitem (64,144) contact -> hold: the hold stands still for up to 131 tick(s) … inside bombpusher@112,128's 256 px reach — a Bomb's Explosion at (168,134) 44 tick(s) into the wait … (MOVING_WAIT, 256 tried) … — and the solver ran out of 640, then 2560 work units on its held retry" | **A1 32:12** = **P1 32:12**, answer `599d2ef41b84` | 2560 budget refusal; the stop in 1/3 ON runs (A1), skip 1 in P1 | **YES: step 149** (L40 flag 7 → Totem 64,144; the survey's words: "collect (64,144) stance (ladder-routed: no corr…") |
| 1a | 32 | (the same leg, one request earlier) | "apitem (64,144) contact -> hold stance (wandlock@176,208) -> break stance (breakablerock@176,128) -> kill (spinner@192,128) by press: every key set — the plan's own and 5 alternative(s) — lands the player box on a body's 7x7 rect or on the 13 px hammer line at th…" | **A1 32:10** (`a8a824ee2146`, 230), **P1 32:10** (`dc09599d8d62`, 208) | refusal at 640; `PRESS_KILL_HOLD` asked and refused | same step 149 |
| 2 | 33 | Level 069 - Lights | "bridge bridge@11,13 in level 61 — no floor cell one or two tiles behind it puts the spear's 32x5 rect on it and is reachable: (168,216) facing E's rect also reaches tile:Bridge@168,216; …" (exit `level_61__r13c12 -> level_63__r10c2`) | **P1 33:5**, answer `74d893565dd6` | HARD (224); **the stop in 2/3 ON runs** (A2, A3), skip 2 in P1 | **YES: step 155**, verbatim |
| 3 | 34 | Level 043 - Wand | the stall: "blocked: the check of \"Level 043 - Wand\" did not land" (`Location check rejected: not_accessible`) | none as a refusal (34:7 `wasm-exit-39` cut, then solved) | probe artefact: a knock-on of skips 1–2 | (step 167, L43 Wand + exit → L37, REFUSED; not reached as a solve) |

The probe stopped after 3. The refusals the ON walks met and **recovered from** (none is a stop; all on file in `P1.capture-summary.txt`)
make up the rest of the list:

| # | entry | refusal (quoted) | request id | survey |
|---|---|---|---|---|
| 4 | 9 | "reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 … (CORRIDOR_LADDER_NEST 2)" (the JS stop) | P1 9:7 (643) | — |
| 5 | 9 | "no corridor for goal reach-exit toward (24,56) in level 20. Obstacle: proximity-hazard:shieldlocknorm (shieldlocknorm@176,16)." | P1 9:1 (2) | — |
| 6 | 16 | "reach-exit (144,304)->L37 -> hold: every responder in group t=2 [cover@208,224] is ALREADY OPEN before the hold begins …" | P1 16:0 (11) | — |
| 7 | 20 | "apitem (160,640) contact: the combat ladder is EXHAUSTED. The corridor passes through danger at (593.2,680.7) — spinner:spi[nner@816,848] …" (re-planned and solved) | P1 20:0 (134) | **YES: step 66** (the same leg and spinner) |
| 8 | 24 | "reach-exit (80,16)->L46: the re-planned corridor failed too — … waypoint …" (the L58 yeti graze) | P1 24:8 (111) | **YES: step 111** |
| 9 | 26 | "clear-tag {40,12} wandlock@480,560 …" 640 cut, then the BK2 collect cut at 640 and 2560 (`432ec5f5b196`), then the re-plan solved | P1 26:8, 26:10, 26:11, 26:12 | the leg of **step 96** (solved ON via `GOAL_START_WAIT` in A1 26:8's replay) |
| 10 | 32 | "clear-tag {40,7} wandlock@208,128: 'hold' could not be resolved from (488,904): solverBot: no REACHABLE stance inside buttonroom@272,208 …" (640; the 2560 retry solves) | P1 32:8, A1 32:8 (`ce350ba73e1d`) | step 149's leg |

Also seen and recovered: budget cuts followed by held-retry solves at 16:7, 19:1, 23:6, 24:15, 28:4, 28:6, and `wasm-exit-39`
(answer `bff14518fe9b` at 640 every time, then the 2560 solve `0255f5e5fdfa`) at 26:6, 29:9, 32:6 and 34:7.

## Then vs now

⚠ Every cell is a SAMPLE (`k/N runs`). The walk is bimodal at L40 (OFF) and at entry 32 (ON).

| | re-measure-7 (`dbf18d461f`, GSW+PM ON) | **Arm C: `a5f7c6caf4`, all OFF** | **Arm A: `a5f7c6caf4`, all ON** |
|---|---|---|---|
| runs | 3 (A1–A3) + probe P1 | 2 (C1, C2) | 3 (A1–A3) + probe P1 |
| checked | **28/48** in 3/3 | **26/48** in 1/2 · **18/48** in 1/2 | **32/48** in **2/3** · **31/48** in 1/3 |
| stop entry | 29 "L041 Totem Part 240,144" (3/3) | 26 "L40 Boss Key 2" (1/2) · 19 "L40 Chest" (1/2) | **33 "L069 Lights" (2/3) · 32 "L040 Totem Part 64,144" (1/3)** |
| cause | keylock stance `bosslock@480,352`, EXHAUSTED, `iceturret@472,400` (step 134), HARD, work 74 | {40,12} burn EXHAUSTED, `chaser:bob@736,752` (step 96), after the 2560 retry · `spinner@880,848` HARD at 640, no retry (step 66) | L61 spear bridge `bridge@11,13` (step 155), HARD 224 · L40 Totem 64,144 `bombpusher@112,128` hold, 2560 cut (step 149) |
| `bot-plays` wall | 2336–2543 s | 1882 s · 1222 s | **3061–3342 s** (A1 3230, A2 3342, A3 3061) |
| entry 19 wall | ~90–103 s, SOLVED after the 640 cut (816) | C1 ~105 s SOLVED after a cut (816) · C2 ~124 s **REFUSED HARD** (880) | **~87 / 177 / 105 s, SOLVED after the 640 cut** (3/3; A1 the 816 family) |
| entry 26 wall | ~390–511 s, SOLVED | C1 ~154 s **REFUSED (+retry)** · C2 not reached | **~450 / 512 / 435 s, SOLVED** (3/3) |
| entry 29 wall | **the stop**, REFUSED HARD (no retry) | not reached | **~375 / 378 / 362 s, SOLVED** (3/3; L40→L41 at 640, `KEYLOCK_TURRET_ARRIVAL`'s path) |
| region changes / pushes | 199 / 132–133 | 168 / 111 · 105 / 71 | 229 / 149 · 239 / 155 · 239 / 156 |
| JS (B) | 8/48 | — | **8/48**, verbatim |
| heap | 656 MB flat | 656 MB flat | 656 MB flat |
| watch-list legs | — | — | **none reached** (no L70/L71/L101 region, and no L40 flag-8 request in any capture) |

**Does seed 1 pass entry 29 with all ON?** **Yes, 3 of 3** (P1 too). In replay, its captured request solves ON and refuses HARD OFF,
and the counters put it on `KEYLOCK_TURRET_ARRIVAL`'s code path.

**The new first wall:** the stop is bimodal. In **2 of 3** runs it is **entry 33, "Level 069 - Lights", the L61 exit
`level_61__r13c12 -> level_63__r10c2`**: *"bridge bridge@11,13 in level 61 — no floor cell one or two tiles behind it puts the spear's
32x5 rect on it and is reachable …"* (survey step 155; HARD; the same answer ON and OFF). In **1 of 3** runs it comes one entry earlier,
at **entry 32, "Level 040 - Totem Part 64,144"**: *"the hold stands still … inside bombpusher@112,128's 256 px reach … and the solver ran
out of 640, then 2560"* (survey step 149; the same answer ON and OFF). Every ON run that passes 32 stops at 33, so **33 is the wall
every ON run would hit, and 32 is a coin-flip in front of it.**

**JS vs 8/48:** 8/48, unchanged.

## The criterion today

**Summary for Robert:** on main at TRAIN 207 with all five hammer switches turned on, the vanilla seed gets **past the L40→L41 boss
lock in 3 of 3 runs**, which was re-measure-7's wall. It now reaches **32 of 48 checks in 2 of 3 runs** (about 51–56 minutes)
and 31 in the third. The one stop every ON run reaches is the **L61 spear bridge on the way to L69 Lights** (survey step 155).
It is a HARD refusal that no switch touches. Before it, in 1 of 3 runs, the **L40 Totem 64,144 bombpusher hold** (survey step 149) runs
out of budget. That split comes from one "continue from the held room" solve, where `PRESS_KILL_HOLD` was asked and could not find a
clean idle. The capture-ON runs refused there and the capture-OFF runs passed. With 2 + 2 samples that is noted, not concluded. In
replay the switches show their effects. `KEYLOCK_TURRET_ARRIVAL` opens the L41 boss lock, and `GOAL_START_WAIT` opens the {40,12}
burn that stopped the OFF control C1. `PRESS_KILL_HOLD` opens the 880 spinner corner that stopped C2, though only right at the 2560
budget edge. With everything OFF, the same main is still the old L40 coin-flip: 26/48 or 18/48, never past entry 26 in 2 runs. JS
has not moved (8/48). The heap is flat at 656 MB, and none of the known ON-arm budget legs (L71, L101, L69-from-L70, L40 flag 8) was
reached. **All-ON vs all-OFF credits no single switch.** The counters name which switch's path each request took, nothing more.

## Leftovers

- **Container restart:** one, between B1's start (21:56:09Z) and 02:27Z. It killed B1's first attempt about 180 s in, at entry 5
  (`B1-killed-by-restart.measure.log`, discarded as a measurement), and the dev server with it. The stale box lock (pid 21679) was
  reclaimed automatically by the next run ("RECLAIMED a stale lock … that pid no longer exists"). B1, P1 and A3 then ran in order
  (`seq2.sh`), polled in the foreground. No other arm was lost. C2 had finished at 21:56:09Z, before the restart.
- **Commits:** every evidence commit was made from a detached worktree, `/home/user/rm8-evidence`, and pushed to the harness
  branch. The measured tree stayed at `2d7f59fc` with 0 tracked changes frozen, in every arm.
- **Size:** the evidence dir is about 8 MB, with each file ≤ 5 MB (`A1.stop-requests.jsonl.gz` 3.7 MB, `P1` 2.6 MB, `C1` 1.1 MB). **Dropped:** the full A1 (104 MB raw), C1 (77 MB raw) and P1 (115 MB raw) captures. Kept: the stop entries
  (A1: 19, 26, 29, 32; C1: 19, 26; P1: 32–34), plus every capture's per-request summary.
- Ruling 52: the only vitest run was `npx vitest run scripts/procgen/walkSeedlingWholeGame.test.js` (8/8). No solver, bot, wasm,
  vendor, preset or rules change. No workflow change, and no push to main. The dev server is stopped by literal PID after this
  report.
- The CI survey artifact (`seedling-survey-merged` of run 45447717668) was downloaded only to read its REFUSED rows
  (`survey-refused-rows.txt`). The artifact itself is not committed.
