# Cloud report: `seedling-whole-game-wasm-remeasure-9`

**The whole-game Seedling wasm walk, seed 1, on MAIN at TRAIN 214 with the flip set ON (`BRIDGE_OPEN_STRAY`, `GOAL_START_WAIT`,
`PREVIEW_METER`), plus an arm that adds `PRESS_KILL_HOLD`. MEASURE ONLY.**

Launcher: `seedling-hammer-phase-planning-15`; brief reviewed by `seedling-js-planning-23`. Ruling: Robert, *"Re-measure-9
(Recommended)"*. Branch: the harness pinned **`claude/whole-game-wasm-remeasure-9-ltkolv`**, and every push went there. Nothing
was fixed. The only code commits are the two cherry-picked MEASUREMENT-ONLY knob commits; everything else is evidence and this
report. **Not for landing.**

⚠ **Every number below is labelled "at 8bee4f279a, FLIP" (Arms F, B, P), "…, ALL" (Arm A) or "…, main defaults" (Arm C).**
- FLIP = `SEEDLING_BRIDGE_OPEN_STRAY=1;SEEDLING_GOAL_START_WAIT=1;SEEDLING_PREVIEW_METER=1`.
- ALL = FLIP + `SEEDLING_PRESS_KILL_HOLD=1`.
- Main defaults = no solver env, which means `STRIKE_PREVIEW_LEAN` and `KEYLOCK_TURRET_ARRIVAL` are ON and the rest are OFF (see *Switch defaults*).
- The walk is bimodal, so every number is a sample.

## Summary for Robert

- **FLIP does not pass entry 32: 0 of 4 F runs, and 0 of 6 F+A runs, reach entry 33.** All six (F1–F4, A1, A2) stop at the same
  place, entry 32 "Level 040 - Totem Part 64,144", at **31/48**. Their stop text is identical: *"apitem (64,144) contact -> hold: the hold
  stands still for up to 131 tick(s) … inside bombpusher@112,128's 256 px reach … (MOVING_WAIT, 256 tried) … — and the solver ran
  out of 640, then 2560 work units on its held retry"*. This is **survey step 149**, with answer `599d2ef41b84`, the same hash as
  re-measure-8's A1/P1 stop. In replay it answers the same 3/3 under FLIP and under main defaults (and under ALL). **No switch touches it.**
- **The entry-32 split is now 6/6 the bad mode.** In re-measure-8, 2 of 3 all-ON runs solved the "continue on from the held room"
  request at 640 and went on to entry 33. Here, every run's continue request refuses: in F1 it is `cd02c0916e6c` (work 220,
  "kill (spinner@192,128) by press"). In replay it refuses the same under FLIP, main defaults and GSW+PM. Under ALL,
  `PRESS_KILL_HOLD` **is asked and refuses** ("the idle is hit at its tick 40"), and the request still refuses, as `19955958ff58`.
- **This is not new code.** Re-measure-8's A1 32:10 request, replayed at this head under ALL, gives its own live answer
  (`a8a824ee2146`). The arrival into L40 r4c4 is what decides it, and it fell the bad way in all 6 runs. 6/6 against re-measure-8's 1/3
  is a sample, not a proven regression.
- **Capture confound: none.** Entry 32 refused with capture ON in 1/1 runs (F1) and with capture OFF in 5/5 (F2, F3, F4, A1, A2). The
  re-measure-8 hint (capture ON ⇒ refuse) does not hold up: the OFF runs refuse too.
- **When the walk gets past 32, FLIP's `BRIDGE_OPEN_STRAY` opens entry 33.** The skip probe P1 skipped 32 and then **solved entry 33
  "Level 069 - Lights" in ~196 s**, including the L61 exit `level_61__r13c12 -> level_63__r10c2`. That exit is **re-measure-8's A2/A3 stop,
  survey step 155**, the "bridge bridge@11,13 … no floor cell …" HARD refusal.
  - Re-measure-8's captured P1 33:5 request, replayed here, **solves 3/3 under FLIP** (`7ca39971ac20`, work 160 = this P1's live answer).
    It **still refuses 3/3 under main defaults** (`74d893565dd6`, re-measure-8's answer) **and under GSW+PM**.
  - GSW+PM is FLIP minus BOS, so this single-switch difference credits the move to **`BRIDGE_OPEN_STRAY`**. Its counter records
    `waived=[{"bridge":"bridge@11,13","stance":"(168,216) facing E","open":"10,13"}, …]`.
- **The new first wall after 33 is a probe artefact.** P1 stalled at entry 34 "Level 043 - Wand". Every solve there succeeded (34:8
  `wasm-location-43` ok), but the state manager rejected the check: `Location check rejected: not_accessible`. The two skipped
  entries never granted their items. This is the same artefact as re-measure-7/8's probes. **The probe found only 2 refusals before it.**
  - The second is **entry 19 "Level 040 - Chest"**, P1's bad mode. 19:1 refused at 640, then 19:2 refused at 2560 (`8ef0debe2bb9`, the
    `spinner@880,848` "NO PHASE admits a step" corner, step 66). It answers the same under FLIP and under main defaults.
  - **Under ALL it solves** (`85c7dc2a524c`, work 1715), through **`PRESS_KILL_HOLD`**: `stand 636, refusedAt 654, tries [{wait 45, verdict "solved"}]`.
- **PKH's marginal effect (A vs F): none visible on the walk.** A1 and A2 stop at entry 32 exactly as F does, and their entry walls
  are in F's range. In replay PKH matters on one request, the 880 corner at entry 19, which A1 and A2 never drew. On the entry-32
  continue request it is asked and refuses.
- **Main defaults (C1): 26/48, entry 26.** C1 stopped on the {40,12} burn EXHAUSTED against `chaser:bob@736,752` (step 96), as in
  re-measure-6, -7 and -8 C1.
  - FLIP clears it every time through **`GOAL_START_WAIT`**. F1 26:9, replayed under FLIP, gives `8110fa258e07` (= live), with GSW
    `tries=[{"t":0,"wait":50,"ok":true}]`. Under main defaults it refuses (`4b081b3f255d`, work 331).
  - Entry 29 (the L40→L41 boss lock) now solves under main defaults too (`5f46423586e1`). KTA defaults ON at 214, and its counter fires.
- **JS: 8/48, unchanged and verbatim**: L22→L25, `CORRIDOR_LADDER_NEST 2`, `chaser:wallflyer@64,80`. All 20 JS-frame solve-worker URLs
  carry the FLIP spec.
- **Watch-list:**
  - The PKH leg `Level 069 - Lights` **was reached (P1 only) and solved under FLIP**, with PKH OFF.
  - GSW `L71 flag 2: shieldlock@288,256` and PM `L101 flag 0: lightpole@144,64` were **not reached**: 0 hits in either capture, and no
    `wasm-*-71`/`-101` goal.
- Wasm heap was 656 MB flat in every wasm run, with no OOM and no `RuntimeError`. The 300 s backstop ended no entry, except P1's
  final "did not land" stall.
- **One container restart** (02:25–02:28Z) killed F4's first attempt about 180 s in (entry 5). F4 was re-run in full. No other arm
  was lost.

## Base, subject and box

| | |
|---|---|
| base | **`8bee4f279a`** = `origin/main` at launch = TRAIN 214. The planner named no later main. A TRAIN 215 exists on js-land only |
| measured head | **`744e85dc`** = base + `0f6f2073` (cherry-pick of `1212b2e0`, the capture knob) + `744e85dc` (cherry-pick of `44743ba7`, the solver-env flag). Both cherry-picks applied cleanly. Every arm's box-lock line reads *"head 744e85dcd, 0 tracked change(s) frozen"*. Evidence was committed from a separate detached worktree, so the measured tree never moved |
| wasm submodule `frontend/modules/flashPanel/wasm` | **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`**, the same pin as re-measure-6/7/8. Bootstrap READY; the seedling wasm builds OK; Chromium at `/opt/pw-browsers` |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` |
| box | The cloud container: 4 cores, headless Chromium, WebGPU from the batch's `webgpu: true`. Every wasm run reports `transport=wasm`. Dev server `scripts/serve-nocache.py 8000`. One `npm test` per arm under the box lock, so each arm got a fresh page. The replays ran only after the last arm |
| row | `tutorial-walk-seedling-whole-game`, batch `tutorials-seedling-whole-game`, step `bot-plays` |
| survey at BASE | **run 45689853008** @`8bee4f279a` (`js-land/train-2026-11-25-214`), **conclusion `success`**. `seedling-survey-merged/through-end/survey.json`: **SOLVED 225 / REFUSED 25** (`survey-refused-rows.txt`). Step 134 now reads SOLVED (KTA defaults ON). Steps 66, 96, 149, 155 and 167 still read REFUSED |

### Switch defaults at BASE (quoted from `frontend/modules/seedlingDemo/solverBot.js` @8bee4f279a)
- `:3119-3122` `GOAL_START_WAIT = { enabled: …SEEDLING_GOAL_START_WAIT === '1', waits: [50, 100, 200, 400, 800] }`, `GOAL_START_WAIT_DEFAULT = false`.
  `GOAL_START_WAIT_PASS = { later: false }` (`:3142`) is pass-scoped state, not a switch.
- `:12455-12456` `BRIDGE_OPEN_STRAY = { enabled: …SEEDLING_BRIDGE_OPEN_STRAY === '1' }`, `BRIDGE_OPEN_STRAY_DEFAULT = false`; counter `BRIDGE_OPEN_STRAY_COUNTS = { waived: [] }` (`:12467`)
- `:15207-15210` `STRIKE_PREVIEW_LEAN` enabled `… !== '0'`, `STRIKE_PREVIEW_LEAN_DEFAULT = true`
- `:18444-18445` `KEYLOCK_TURRET_ARRIVAL` enabled `… !== '0'`, `KEYLOCK_TURRET_ARRIVAL_DEFAULT = true`
- `:18489-18490` `KEYLOCK_TURRET_EDGE_BAIT` enabled `… === '1'`, `_DEFAULT = false`
- `:21407-21410` `PRESS_KILL_HOLD = { enabled: …SEEDLING_PRESS_KILL_HOLD === '1', maxPeriods: 4 }`, `PRESS_KILL_HOLD_DEFAULT = false`
- `:29410-29423` `PREVIEW_METER = { enabled: …SEEDLING_PREVIEW_METER === '1', statesPerUnit: 1024, freeStatesPerAsk: 1024 }`, `PREVIEW_METER_DEFAULT = false`
- All of these names are in `SOLVER_ENV_NAMES` (`solverEnvChannel.js`).
- ⇒ **main defaults = SPL and KTA ON; BOS, GSW, PM, PKH and KTEB OFF.** Every replay's `enabled` line confirms this (for example `enabled BOS=false GSW=false PM=false PKH=false SPL=true KTA=true` under main defaults).

## Knobs and arms

| knob | value | arms |
|---|---|---|
| `TEST_MEASURE_STEP_TIMEOUT_MS` | `10800000` (`--budget-s=10800`) | all |
| `TEST_MEASURE_BOT_STALL_MS` | `300000` (`--stall-s=300`) | all |
| `TEST_MEASURE_FLASH_RUNTIME` | `js` | B1 |
| `TEST_MEASURE_SKIP_REFUSALS` | `10` | P1 |
| `TEST_MEASURE_CAPTURE_REQUESTS` | `<jsonl>` | F1, P1 (+ the 150 s smoke) |
| `TEST_MEASURE_SOLVER_ENV` | FLIP | smoke, F1–F4, B1, P1 |
| `TEST_MEASURE_SOLVER_ENV` | ALL | A1, A2 |
| (none) | main defaults | C1 |

**Order** (capture interleaved): smoke (150 s, capture ON), **F2** (OFF), **F1** (ON), **A1** (OFF), **F3** (OFF), **C1** (OFF), F4
(killed by the restart), then `seq2.sh`: **F4** (OFF, full re-run), **A2** (OFF), **B1**, **P1** (ON). The replays (`replays.sh`) ran
after that. Runner `run-arm.sh`, log `seq.log`. Every row reads `PASSED` because the ratchet grades it against
`firstFailingStep: 'bot-plays'`. **PASSED is not victory.**

## The capture and solver-env diffs (MEASUREMENT-ONLY)

`git diff --numstat 8bee4f279a 744e85dc`: `tutorialTests.js` +107/−2, `walk-seedling-whole-game.mjs` +19/−3, `app.spec.js` +20/−0
(3 files, +146/−5). This is the same as re-measure-8's cherry-picks of `1212b2e0` + `44743ba7`, applied unchanged.
- **`0f6f2073`** (= `1212b2e0`), the capture knob. With `TEST_MEASURE_CAPTURE_REQUESTS` unset, there is no `&measureCaptureRequests=1`, no
  binding, no import and no timer. **OFF is byte-identical.** F2–F4, A1, A2, C1 and B1 ran with it OFF.
- **`744e85dc`** (= `44743ba7`), the solver-env flag. `--solver-env=A=1,B=1` → `TEST_MEASURE_SOLVER_ENV` → `&seedlingSolverEnv=<encoded>`, plus
  `page.on('worker')` → `[MEASURE worker] <url>`. Unset, nothing is appended or registered, which is byte-identical; C1 ran that way.
  `npx vitest run scripts/procgen/walkSeedlingWholeGame.test.js` gives **8 passed (8)** (that one file only, ⚖ 52).

## ⛔ Knob carriage: the switches reach the page's solve worker AND the JS frame

The route: app URL `?seedlingSolverEnv=` → `jsRuntimeSolveWorker.js?…` → `solverEnvShim.js` sets `globalThis.process.env` before any
solver module evaluates.

1. **Worker URL**, logged once per wasm arm:
   - FLIP arms (F1–F4, P1): `[MEASURE worker] http://localhost:8000/frontend/modules/seedlingDemo/jsRuntimeSolveWorker.js?seedlingSolverEnv=SEEDLING_BRIDGE_OPEN_STRAY%3D1%3BSEEDLING_GOAL_START_WAIT%3D1%3BSEEDLING_PREVIEW_METER%3D1`.
   - A1 and A2: the same URL with `%3BSEEDLING_PRESS_KILL_HOLD%3D1` added.
   - C1: no env URL.
2. **The worker's stamp on every answer:** `[MEASURE capture] first answer's worker solverEnv="SEEDLING_BRIDGE_OPEN_STRAY=1;SEEDLING_GOAL_START_WAIT=1;SEEDLING_PREVIEW_METER=1"`.
   **All 198 of F1's captured answers and all 214 of P1's** carry exactly that stamp (counted from `*.capture-summary.txt`), the stop
   requests included.
3. **The switches' own counters**, from captured requests replayed in node with the same env (`replay-counts.mjs`). Each replay
   reproduces the page's answer hash and work exactly; examples are in the table below. Each switch in the env fired on a page-captured
   request:
   | switch | request | counter |
   |---|---|---|
   | `BRIDGE_OPEN_STRAY` | P1 33:5 (and re-measure-8 P1 33:5) | `waived=[{"bridge":"bridge@11,13","stance":"(168,216) facing E","open":"10,13"}, …]` |
   | `GOAL_START_WAIT` | F1 26:9 | `tries=[{"t":0,"wait":50,"ok":true,"why":null}]` |
   | `PREVIEW_METER` | every FLIP replay | e.g. P1 19:2 `{"states":916848,"asked":840,"tripped":0}`, F1 32:12 `{"states":328379,…}` |
   | `PRESS_KILL_HOLD` (ALL) | F1 32:10; P1 19:2 | 32:10 `[{"t":1534,"stand":1649,"refusedAt":1652,"tries":[{"wait":45,"verdict":"idle","why":"the idle is hit at its tick 40"}],"verdict":"refused"}]`; 19:2 `[{"t":0,"stand":636,"refusedAt":654,"tries":[{"wait":45,"verdict":"solved"}],"verdict":"solved"}]` |
   | `KEYLOCK_TURRET_ARRIVAL` (default ON) | F1 29:11 | `asked=[{"lock":"bosslock@480,352","turrets":["iceturret@472,400"],…}]`, `kills=[{…"dead":true,"ticks":516,"side":"right"}]` |
   | `STRIKE_PREVIEW_LEAN` (default ON) | F1 19:2, P1 19:2 | `{"forecastTicksSkipped":12800,"forecastReplays":2,"spinRowsSkipped":12800}` |
4. **Arm B (JS): the switches reach the JS frame.** B1 logged 21 worker URLs. 20 are `jsRuntimeSolveWorker.js?seedlingSolverEnv=…` with
   the FLIP spec; the other is `stateManagerWorker.js`. The capture does not wrap JS-frame services, so B has no answer stamp.

## Arm F: wasm, seed 1, FLIP (4 runs)

| run | capture | checked / total (bot) | snapshot | last sphere | stop: region / entry | cause | `bot-plays` wall | region changes / pushes | heap (samples) |
|---|---|---|---|---|---|---|---|---|---|
| F1 | ON | **31/48** | 52 | 9.4 | `level_40__r4c4`, **entry 32 "Level 040 - Totem Part 64,144"** | refusal after the held retry, bombpusher hold, "ran out of 640, then 2560" (step 149) | 3412.1 s (row 3428.5 s) | 229 / 149 | 656 MB flat (228) |
| F2 | OFF | **31/48** | 52 | 9.4 | the same | the same text | 3523.6 s (row 3539.8 s) | 229 / 149 | 656 flat (235) |
| F3 | OFF | **31/48** | 52 | 9.4 | the same | the same text | 3387.3 s (row 3403.1 s) | 229 / 149 | 656 flat (226) |
| F4 | OFF (re-run) | **31/48** | 52 | 9.4 | the same | the same text | 3255.0 s (row 3271.0 s) | 229 / 149 | 656 flat (217) |

**0 of 4 pass entry 32; 4 of 4 pass entries 19, 26 and 29.**

## Arm A: wasm, seed 1, ALL (2 runs, capture OFF)

| run | checked | snapshot | sphere | stop | cause | `bot-plays` wall | region / pushes | heap |
|---|---|---|---|---|---|---|---|---|
| A1 | **31/48** | 52 | 9.4 | entry 32, `level_40__r4c4` | the same text as F | 3306.0 s (row 3322.0 s) | 229 / 149 | 656 flat (221) |
| A2 | **31/48** | 52 | 9.4 | the same | the same | 3519.2 s (row 3535.4 s) | 229 / 149 | 656 flat (235) |

### Per-entry wall (15 s `[MEASURE tick]`s, `entrywall.py`; statuses from `statuses.py`)

| run | 19 "L40 Chest" | 26 "L40 Boss Key 2" | 29 "L41 Totem 240,144" | 32 "L40 Totem 64,144" | 33 "L69 Lights" |
|---|---|---|---|---|---|
| F1 | ~105 s **SOLVED after a cut** (19:1 640 cut `668f4ca7aff6` → 19:2 2560 solved `1c1e32cb58a8`, 1678) | ~525 s **SOLVED after cuts** (26:8 640 cut → 26:9 2560 solved via GSW `8110fa258e07`; 26:10/26:11 BK2 continue cut `432ec5f5b196`; 26:12 cut → 26:13 solved) | ~422 s **SOLVED** (29:9 `wasm-exit-39` cut `bff14518fe9b` → 29:10 solved; **29:11 L40→L41 solved at 640 via KTA** `5f46423586e1`) | ~425 s **REFUSED (+retry), the stop** (32:8 {40,7} cut → 32:9 2560 solved; **32:10 continue refused** `cd02c0916e6c`; 32:11 cut → **32:12 2560 refused** `599d2ef41b84`) | — |
| F2 | ~120 s SOLVED after a cut | ~570 s SOLVED | ~435 s SOLVED | ~416 s **REFUSED (+retry), the stop** | — |
| F3 | ~122 s SOLVED after a cut | ~510 s SOLVED | ~405 s SOLVED | ~400 s **REFUSED (+retry), the stop** (continue 640 → retry 2560) | — |
| F4 | ~75 s SOLVED after a cut | ~468 s SOLVED | ~421 s SOLVED | ~403 s **REFUSED (+retry), the stop** | — |
| A1 | ~150 s SOLVED after a cut | ~450 s SOLVED | ~405 s SOLVED | ~394 s **REFUSED (+retry), the stop** | — |
| A2 | ~163 s SOLVED after a cut | ~570 s SOLVED | ~437 s SOLVED | ~397 s **REFUSED (+retry), the stop** | — |
| C1 (main defaults) | ~75 s SOLVED after a cut | ~149 s **REFUSED (+retry), the stop** | — | — | — |
| P1 (FLIP, probe) | ~120 s **REFUSED (+retry), skipped** (19:1 640 → 19:2 2560 refused `8ef0debe2bb9`) | ~526 s SOLVED | ~405 s SOLVED | ~435 s **REFUSED (+retry), skipped** (32:10 `4b67e84494d1`, 32:12 `599d2ef41b84`) | **~196 s SOLVED** (33:5 L61 exit solved at 640 `7ca39971ac20`; 33:10 `wasm-location-69` solved) |

Except for P1's final stall, no entry was ended by the 300 s backstop.

The F/A stop (F1 quoted; the other five are identical apart from timings):
```
[tutorial-walk-timing] seedling-whole-game: load 5.0s, start-game-clear-save-panel 0.1s, start-game-clear-save 0.7s, start-game-page 5.5s, start-game 1.4s, bot-plays-open 0.2s, bot-plays 3412.1s
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 3428.5s
[MEASURE end] seedling-whole-game t=3425s step=bot-plays checked=52 botQueue=48 botCursor=31 botChecked=31 botHead="Level 040 - Totem Part 64,144" botRegion="level_40__r4c4" lastRegionEvent="level_40__r4c4" regionChanges=229 wasmPushes=149 transport=wasm wasmMemMB=656 jsHeapMB=228 status="error: level_40__r4c4: the bot cannot walk to location \"Level 040 - Totem Part 64,144\" — the wasm playback failed: the solver declined Level 040 - Totem Part 64,144 in level 40 (pass dashless): solverBot(wasm-location-40) apitem (64,144) contact -> hold: the hold stands still for up to 131 tick(s) at (167.88102975116135,135.24945805128786), inside bombpusher@112,128's 256 px reach — a Bomb's Explosion at (168,134) 44 tick(s) into the wait — … (MOVING_WAIT, 256 tried) … — and the solver ran out of 640, then 2560 work units on its held retry on location in level 40"
```
The full status for each arm is in `<arm>.stop-status.txt`, and every `[PROGRESS`/`[MEASURE` line is in `<arm>.measure.log`.

## Arm C: wasm, seed 1, main defaults (1 run, capture OFF)

| run | checked | snapshot | sphere | stop | cause | `bot-plays` wall | region / pushes | heap |
|---|---|---|---|---|---|---|---|---|
| C1 | **26/48** | 42 | 7.3 | `level_40__r48c54`, **entry 26 "Level 040 - Boss Key 2"** (leg "L40 flag 12: wandlock@480,560 cleared") | "clear-tag {40,12} wandlock@480,560 -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED … chaser:bob@736,752" (step 96) | 1845.1 s (row 1862.5 s) | 168 / 111 | 656 flat (123) |
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1862.5s
[MEASURE end] seedling-whole-game t=1859s step=bot-plays checked=42 botQueue=48 botCursor=25 botChecked=26 botHead="Level 040 - Boss Key 2" botRegion="level_40__r48c54" lastRegionEvent="level_40__r48c54" regionChanges=168 wasmPushes=111 transport=wasm wasmMemMB=656 jsHeapMB=202 status="error: level_40__r48c54: the bot cannot walk to location \"L40 flag 12: wandlock@480,560 cleared\" — … the combat ladder is EXHAUSTED. The corridor passes through danger at (744.3,802.3) — chaser:bob@736,752 (inside leash 80 (d=5.3), …) — and every rung of ⚖ §11.8a's order refused: …"
```
C1 was capture OFF. F1's 26:9 request (the same leg) stands in for it in replay: it refuses under main defaults and solves under FLIP
through GSW (below).

## Arm B: JS, seed 1, FLIP (1 run)

| run | checked | snapshot | sphere | stop | cause | `bot-plays` wall | region / pushes |
|---|---|---|---|---|---|---|---|
| B1 (`transport=js`) | **8/48** | 16 | 3.7 | `level_22__r8c0`, entry **9 "Level 025 - Chest"**, exit `level_22__r8c0 -> level_25__r2c7` | `CORRIDOR_LADDER_NEST 2` against `chaser:wallflyer@64,80` | 370.5 s (row 384.2 s) | 51 / 35 |
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 384.2s
[MEASURE end] seedling-whole-game t=381s step=bot-plays checked=16 botQueue=48 botCursor=8 botChecked=8 botHead="Level 025 - Chest" botRegion="level_22__r8c0" lastRegionEvent="level_22__r8c0" regionChanges=51 wasmPushes=35 transport=js wasmMemMB=? jsHeapMB=273 status="error: level_22__r8c0: the bot cannot walk to exit \"level_22__r8c0 -> level_25__r2c7\" — the JS runtime's walk failed: the solver declined — solverBot(js-runtime-L22-exit) reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 (…) inside a climb already 2 deep (CORRIDOR_LADDER_NEST 2): a stance walk whose own corridor needs the ladder again is not converging — solving… (budget 640 work units)"
```
**8/48, the same as re-measure-4 to -8, verbatim.** The wasm walk meets the same refusal at entry 9 (P1 9:7, work 643) and recovers.

## Skip probe: wasm, seed 1, FLIP, `--skip-refusals=10`, capture ON (P1)

`bot-plays` took 4172.7 s (row 4189.8 s), with 256 region changes, 169 pushes, heap 656 MB flat (279 samples), and 214 requests captured.
```
[MEASURE skip 1] t=1265s skipping entry 19/48 "Level 040 - Chest" (sphere 6.8)
[MEASURE skip 2] t=3446s skipping entry 32/48 "Level 040 - Totem Part 64,144" (sphere 9.4)
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 4189.8s
[MEASURE end] seedling-whole-game t=4186s step=bot-plays checked=54 botQueue=48 botCursor=33 botChecked=54 botHead="Level 043 - Wand" botRegion="level_43__r13c7" lastRegionEvent="level_43__r13c7" regionChanges=256 wasmPushes=169 transport=wasm wasmMemMB=656 jsHeapMB=228 status="blocked: the check of \"Level 043 - Wand\" did not land" walkEnd=failed walkStep=bot-plays why="done check threw: the app shows it cannot finish: the Playback Bot has said \"blocked: the check of \"Level 043 - Wand\" did not land\" for 300 s"
```
- Between the skips and after them it solved entries 20–31 and **33 (Lights)**. It stalled at 34 on
  `[SMW] checkLocation: Location check was rejected. Reason: not_accessible`. The walk script's "52/48 (+2 skipped)" is not a real tally,
  because `botChecked` counts skips.
- A stall is not a refusal, so 8 skips went unspent.
- ⚠ Skipping 19 changed P1's state at entry 32: its continue request refused with a different answer (`4b67e84494d1`, "break stance
  (breakablerock@176,128): the combat ladder is EXHAUSTED") from F1's (`cd02c0916e6c`). The 2560 stop answer is the same (`599d2ef41b84`).

## The replay proof

Every distinct stop request, replayed with `--n=3 --live` (`replay/*.txt`):

| request | env | REPLAY line | answers | = live? |
|---|---|---|---|---|
| **F1 32:12** (the F/A stop) | FLIP | `REPLAY: leg 32 request 12 (budget 2560): 1 distinct answer(s) over 3, 1 distinct trace(s)` | refusal `599d2ef41b84` ×3, work 2561 | yes (live: refusal 2561 `599d2ef41b84`, passes dashless 823 + full 1738) |
| F1 32:12 | main defaults | the same REPLAY line | refusal `599d2ef41b84` ×3, 2561 | the same answer |
| **P1 19:2** (skip 1) | FLIP | `REPLAY: leg 19 request 2 (budget 2560): 1 distinct answer(s) over 3, 1 distinct trace(s)` | refusal `8ef0debe2bb9` ×3, 896 | yes |
| **P1 33:5** (L61 bridge, solved) | FLIP | `REPLAY: leg 33 request 5 (budget 640): 1 distinct answer(s) over 3, 1 distinct trace(s)` | **solved `7ca39971ac20`** ×3, 160 | yes |
| **re-measure-8 P1 33:5** (its A2/A3 stop) | FLIP | `REPLAY: leg 33 request 5 (budget 640): 1 distinct answer(s) over 3, 1 distinct trace(s)` | **solved `7ca39971ac20`** ×3, 160 | no: its live answer was refusal `74d893565dd6` (re-measure-8 ran without BOS) |
| re-measure-8 P1 33:5 | main defaults | the same REPLAY line | refusal `74d893565dd6` ×3, 203 | the same as re-measure-8's live answer |

C1's stop (capture OFF) and the JS stop are not on file as requests. C1's leg is covered by F1 26:9, below.

### Attribution replays (node, at the measured head, one run each; `replay/counts-*.txt`)

GP = GSW+PM, which is FLIP minus BOS. GP vs FLIP is a one-switch difference; FLIP vs main defaults is not.

| request | env | answer | work | the switch whose path it hits |
|---|---|---|---|---|
| re-measure-8 P1 33:5 / P1 33:5 (L61 exit, step 155) | FLIP | **solved `7ca39971ac20`** | 160 | **`BRIDGE_OPEN_STRAY`** waived ×6 (`open 10,13`) |
| P1 33:5 | GP | **refusal `74d893565dd6`** | 203 | — (BOS off ⇒ HARD) |
| P1 33:5 | main defaults | refusal `74d893565dd6` | 203 | — |
| F1 32:12 (stop, 2560) | FLIP / ALL / main defaults | refusal `599d2ef41b84` (all three) | 2561 | none but PM (328379 states, 0 tripped) |
| F1 32:10 (continue, 640) | FLIP / GP / main defaults | refusal `cd02c0916e6c` (all three) = live | 220 | SPL 98 forecast replays |
| F1 32:10 | ALL | refusal `19955958ff58` | 222 | **`PRESS_KILL_HOLD` asked, refused** ("the idle is hit at its tick 40") |
| re-measure-8 A1 32:10 | ALL | refusal `a8a824ee2146` = re-measure-8's live answer | 222 (live 230) | PKH asked, refused, the same row as re-measure-8 |
| P1 32:10 | FLIP | refusal `4b67e84494d1` = live | 564 | SPL 28 replays |
| F1 32:9 ({40,7} retry) | FLIP | solved `7839897c470f` = live | 2066 | PM only |
| **P1 19:2** (880 corner, 2560) | FLIP | refusal `8ef0debe2bb9` = live | 896 | PM 916848 states / asked 840; SPL |
| P1 19:2 | main defaults | refusal `8ef0debe2bb9` | 56 | SPL |
| P1 19:2 | **ALL** | **solved `85c7dc2a524c`** | 1715 | **`PRESS_KILL_HOLD`** (`stand 636, refusedAt 654, tries [{wait 45, "solved"}]`) |
| F1 19:2 (816 arrival, 2560) | FLIP | solved `1c1e32cb58a8` = live | 1678 | PM, SPL only |
| F1 26:9 ({40,12} burn retry, C1's leg) | FLIP | solved `8110fa258e07` = live | 1487 | **`GOAL_START_WAIT`** (`wait 50, ok`) |
| F1 26:9 | main defaults | refusal `4b081b3f255d` | 331 | — |
| F1 29:11 (L40→L41) | FLIP and main defaults | solved `5f46423586e1` (both) | 642 | **`KEYLOCK_TURRET_ARRIVAL`** (default ON; turret dead in 516 t) |

## Then / now

| | re-measure-8 (TRAIN 207, all five ON) | C (214, main defaults) | F (214, FLIP) | A (214, ALL) |
|---|---|---|---|---|
| runs | 3 | 1 | 4 | 2 |
| checked | 31, 32, 32 | **26** | **31 ×4** | **31 ×2** |
| stop | 32 (1/3), 33 (2/3) | 26 (step 96) | **32 ×4** (step 149) | **32 ×2** (step 149) |
| entry 19 | 3/3 solved | solved | 4/4 solved (P1: refused, 880 corner) | 2/2 solved |
| entry 26 | 3/3 solved (GSW) | **refused** | 4/4 solved (GSW) | 2/2 solved |
| entry 29 | 3/3 solved (KTA) | **never reached** (KTA default ON; F1 29:11 solves under main defaults in replay) | 4/4 solved | 2/2 solved |
| entry 32 | 2/3 solved | — | **0/4** | **0/2** |
| entry 33 | 0/2 (HARD L61 bridge, step 155) | — | not reached (P1: **solved**, BOS) | not reached |
| first wall | 32 / 33 | 26 | **32** | **32** |
| JS | 8/48 | — | 8/48 (B1) | — |

## The next refusals, with captured-request ids

The ids are `run entry:i`. P1's stop requests (entries 19, 32, 33, 34) are in `P1.stop-requests.jsonl.gz`, and F1's in
`F1.stop-requests.jsonl.gz`. All 214 P1 rows and 198 F1 rows are listed in `*.capture-summary.txt`. The survey at BASE is run
**45689853008** (conclusion success, REFUSED 25).

**The probe found only 2 refusals before the logic stall:**

| # | entry | location | refusal (quoted) | request id | kind | survey match |
|---|---|---|---|---|---|---|
| 1 | 19 | Level 040 - Chest | "apitem (880,816) contact -> kill (spinner@880,848) by press: every key set — the plan's own and 5 alternative(s) — lands the player box on a body's 7x7 rect or on the 13 px hammer line … from t654 NO PHASE admits a step … (HAMMER_PHASE_RUNG) … `OPP_PRESS_FALLBACK` … did not kill" | **P1 19:2** `8ef0debe2bb9` (19:1 `8007b96643fd`) | 2560 refusal; skip 1. **Solves under ALL via PKH** | **YES: step 66** (L40 Chest + Totem 160,640, the spinner corner) |
| 2 | 32 | Level 040 - Totem Part 64,144 | "apitem (64,144) contact -> hold … inside bombpusher@112,128's 256 px reach … (MOVING_WAIT, 256 tried) … ran out of 640, then 2560" | **F1 32:12** = **P1 32:12** `599d2ef41b84` | 2560 refusal; **the stop in 6/6 F+A runs**; skip 2 | **YES: step 149** |
| 2a | 32 | (one request earlier) | F1: "apitem (64,144) contact -> hold stance (wandlock@176,208) -> break stance (breakablerock@176,128) -> kill (spinner@192,128) by press: every key set … lands the player box on … the 13 px hammer line at th…"; P1: "… break stance (breakablerock@176,128): the combat ladder is EXH[AUSTED]" | **F1 32:10** `cd02c0916e6c` (220), **P1 32:10** `4b67e84494d1` (564) | 640 refusal; PKH asked and refused | step 149's leg |
| 3 | 34 | Level 043 - Wand | not a refusal: "blocked: the check of \"Level 043 - Wand\" did not land" (`not_accessible`) | none (34:8 `wasm-location-43` solved `e82712b554f8`) | probe artefact | (step 167, L43 Wand + exit → L37, REFUSED in the survey; not reached as a solve) |

**Refusals that the FLIP walks met and recovered from** (none of them a stop; all on file in `P1.capture-summary.txt`) make up the
rest of the ten:

| # | entry | refusal (quoted) | request id | survey |
|---|---|---|---|---|
| 4 | 9 | "reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 … (CORRIDOR_LADDER_NEST 2)" (the JS stop) | P1 9:7 `d777bfb2c075` (643) | — |
| 5 | 9 | "no corridor for goal reach-exit toward (24,56) in level 20. Obstacle: proximity-hazard:s[hieldlocknorm]…" | P1 9:1 `79b4eae46c81` (2) | — |
| 6 | 16 | "reach-exit (144,304)->L37 -> hold: every responder in group t=2 [cover@208,224] is ALRE[ADY OPEN]…" | P1 16:0 `896d548c0b76` (11) | — |
| 7 | 24 | "reach-exit (80,16)->L46: the re-planned corridor failed too — …" (the L58 yeti graze) | P1 24:8 `7a183280bda8` (110) | **YES: step 111** |
| 8 | 26 | the {40,12} 640 cut, then the BK2 continue cut at 640 and 2560 (`432ec5f5b196`), then the re-plan cut (`22a13cc16402`); solved on the next request | P1 26:8, 26:11, 26:12, 26:13 | step 96's leg (solved via GSW) |
| 9 | 32 | "clear-tag {40,7} wandlock@208,128: 'hold' could not be resolved from (488,904): solverBot: no REACHABLE stance inside buttonroom@272…" (640; the 2560 retry solves) | P1 32:8 = F1 32:8 `ce350ba73e1d` | step 149's leg |
| 10 | 26/29/32/34 | `wasm-exit-39` "the caller's anytime deadline (`shouldStop`) was reached at the `walk` site …" at 640, every time; solved at 2560 | `bff14518fe9b` at P1 26:6, 29:9, 32:6, 34:5 | — |

Also seen and recovered: budget cuts followed by held-retry solves at 16:7, 23:6, 24:15 and 28:5 (`wasm-exit-61` cut at 640, then solved).

## Evidence (`seedling-whole-game-wasm-remeasure-9-evidence/`, 7.8 MB total)

- **Per arm** (`<arm>` = smoke, F1–F4, A1, A2, C1, B1, P1, F4-killed-by-restart): `<arm>.measure.log`, `<arm>.summary.txt` and `<arm>.stop-status.txt`.
- **Capture arms:** F1, P1 and the smoke also have `<arm>.capture-summary.txt`.
- **Stop requests:** `F1.stop-requests.jsonl.gz` (entries 19, 26, 29, 32) and `P1.stop-requests.jsonl.gz` (19, 32, 33, 34), 3.1 MB each.
- **⚠ Dropped:** the full captures (F1 104 MB raw, P1 113 MB raw) exceed the 5 MB per-file cap even gzipped. Only the stop-entry
  requests are kept, and the summaries list every row.
- **Replays:** `replay/` holds the `--n=3 --live` outputs and `counts-*.txt`.
- **Scripts:** `replays.sh`, `replay-counts.mjs`, `extract.sh`, `entrywall.py`, `statuses.py`, `sumcap.py`, `run-arm.sh`, `seq.sh` and `seq2.sh`.
- **Logs and survey:** `seq.log` (start/rc/end lines, with the `[restart]` marker) and `survey-refused-rows.txt`.

## The criterion today

**Summary for Robert:** at `8bee4f279a` the whole-game wasm walk with FLIP ON stops at **31/48, entry 32 (step 149), in 6 of 6 runs**,
with or without PKH and with or without capture. This is one entry short of re-measure-8's best (32/48).
- Entry 32's stop request refuses identically under every env tested, so **no switch in the set addresses it**.
- The walk gets past 32 only when the arrival puts the "continue from the held room" solve into its good mode. That happened in
  2/3 runs in re-measure-8 and in 0/6 here.
- Behind it, **`BRIDGE_OPEN_STRAY` clears re-measure-8's entry-33 wall (step 155)**, in replay and on the page (P1).
- **`PRESS_KILL_HOLD` clears entry 19's 880-corner mode** in replay, though no A run drew that mode.
- **`GOAL_START_WAIT` clears the main-defaults wall at entry 26.**
- So the flip set is worth having. The next wall for it is the step-149 bombpusher hold at L40 (64,144) and the
  spinner@192,128 press/hold arrival one request before it.
- Past that, the probe could not see further than entry 34, where the skipped items left the Wand logically inaccessible.
