# Cloud report: `seedling-whole-game-wasm-remeasure-6`

**The whole-game Seedling wasm walk again, after the PKC + HIT_AVOID flip (train 193), with request capture at the stop. MEASURE ONLY.**

Launcher: `seedling-js-planning-22` (js-22). Ruling: Robert, face 1 (the L40 `{40,12}` burn ladder): *"re-measure first"*; trigger = the
PKC flip's landing (js-21). Branch: **`claude/whole-game-wasm-remeasure-6-etfioy`**. The harness pinned it, so no plain
`seedling-whole-game-wasm-remeasure-6` branch was pushed. Nothing was fixed: no solver, bot, wasm, `vendor/seedling`, preset or rules
file changed. The commits are the MEASUREMENT-ONLY capture knob (`bedffaf0`), the evidence directory and this report.

## Summary for Robert

- **Seed 1 (wasm) still tops out at 26/48, and the wall is still entry 26 "Level 040 - Boss Key 2".** 3 of 5 runs (A1, A2, A4)
  stop there on the same refusal as re-measure-5: the `{40,12}` burn stance (`burnabletree@872,784`) exhausts the combat ladder
  past `chaser:bob@736,752`, with `bobsoldier@880,832` covering the goal and the `spinner@816,848` hammer on the `narrow` rung.
  PKC does not move it. The text matches re-measure-5's word for word, except for the hammer phase and time on `narrow`.
- **The `spinner@816,848` entry-19 stop (re-measure-5's A2) is gone, but the run-to-run spread is not.** In every run where entry
  19 met `spinner@816,848`, the 640 pass was a budget cut (work 644), and the 2560 held retry solved it (work 1493). That is
  hammer-12's prediction. **2 of 5 runs (A3, and the probe P1) stop at entry 19 anyway, on the other spinner:** *"kill
  (spinner@880,848) by press: every key set … There is no step out … (HAMMER_PHASE_RUNG)"*. That refusal is HARD (work 112), so
  no retry runs. This is the first measurement of the `spinner@880,848` family under PKC, and it is a stop.
- **The split is in the state the bot brings into L40, not in the solver.** The capture shows A3's and P1's entry-19 requests
  are byte-identical, and every captured stop replays 3 of 3 to the page's own answer. A1's request differs from them in one
  persistence row (L39 tag 3), the rng seed and the seam time. The runs part at entry 18 (L39 Totem Part 72,40), where A1 asks
  its first request 4 times instead of once.
- **Seed 2 (wasm): 15/48, up from 13/48.** The L28 button-stance wall is gone: the bot breaks `rope@160,64` first (flag:L28:0,
  train 177) and crosses to L30. It now stops at entry 16, **L40 Chest**, on a **300 s wall-clock backstop** (*"the solve
  exceeded the backstop on this machine (300 s) … the solve's own budget is 640 work units"*). It is the same L40 corner.
- **JS control: 8/48, unchanged**, word for word (L22→L25, `CORRIDOR_LADDER_NEST 2`, `chaser:wallflyer@64,80`).
- **A backstop finding:** P1's backstop request (26:11, collecting `bosskey@656,528` right after the burn **solved**) replays in
  node as an ordinary 640-unit budget cut that takes **711 s** of wall clock. The page's 300 s backstop kills it before its held
  retry can run. The `spinner@880,848` refusal is similar: work 112, but ~150 s per replay.
- No OOM: the heap stayed at 656 MB in every wasm run. No `RuntimeError`, and no F1 "tape errored / ended at tick k of N".
- **A walk-script bug (main), worked around:** `walk-seedling-whole-game.mjs --seed=2` doubles the AP prefix
  (`AP_AP_01043188731678011336`). It reports "Generate.py failed", "reverts" a directory that does not exist, and leaves the
  real preset untracked in the tree. I ran A′1 by hand instead (see below). Not fixed here.

## Base and subject

| | |
|---|---|
| base | **`ba367618590c5cc9b9c7c0e6e603c6c9879e2332`** = main at train 193 ("train: hammer-flip-pkc-fh 0d4b7daccf") |
| measured head | **`bedffaf0`** = base + the MEASUREMENT-ONLY capture knob (below). Every run's box-lock line reads "head bedffaf03, 0 tracked change(s) frozen" (A′1: the seed-2 preset in the tree, as every time before) |
| flips live at BASE | `pressKillCost.js:386-389`: `export const PRESS_KILL_CHASERS = { enabled: globalThis.process?.env?.SEEDLING_PRESS_KILL_CHASERS !== '0', };` `export const PRESS_KILL_CHASERS_DEFAULT = true;` · `jsRuntimeSolver.js:456-457`: `export const HIT_AVOID_PASS = { enabled: globalThis.process?.env?.SEEDLING_HIT_AVOID_PASS !== '0' };` `HIT_AVOID_PASS_DEFAULT = true;` · `jsRuntimeSolver.js:884/886`: `enabled: globalThis.process?.env?.SEEDLING_TALK_CLEAR_GOAL !== '0' && !pageSolverEnvSwitchOff('SEEDLING_TALK_CLEAR_GOAL'),` `TALK_CLEAR_GOAL_DEFAULT = true;` · `solverBot.js:25834/25836`: `enabled: globalThis.process?.env?.SEEDLING_WALLFLYER_KILL_ARM !== '0',` `WALLFLYER_KILL_ARM_DEFAULT = true;` · `solverBot.js:20509-20510`: `KILLLOCK_STANDOUT_GUARD = { enabled: … !== '0' }`, `KILLLOCK_STANDOUT_GUARD_DEFAULT = true;` · `contactFidelity.js:2069`: `wallFlyerCorpseGone: true,` — **all ON** |
| wasm submodule `frontend/modules/flashPanel/wasm` | **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`** (the same pin as every earlier measure). `session_bootstrap.sh --all` → READY, "seedling wasm builds: OK (4 dirs)", "chromium: OK", "tree: clean" |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` (unchanged) |
| box | the cloud container's headless Chromium, 4 cores. WebGPU comes from the batch's `webgpu: true`, and every wasm run reports `transport=wasm`. Dev server `scripts/serve-nocache.py 8000` (PID 1200). One run at a time under the box lock, a fresh page per run (each is its own `npm test`). The replays ran only while no arm was running |
| row | `tutorial-walk-seedling-whole-game`, batch `tutorials-seedling-whole-game` (MANUAL, WebGPU), step `bot-plays` |
| survey at BASE | run **45059539994** @`ba36761859`, merged: **SOLVED 224 / REFUSED 26** (`survey-refused-rows.txt`, from the run's `seedling-survey-merged` artifact). 4.2: 39/39 (run 45059538030, quoted from the brief), nothing refused |

Trains since re-measure-5 (`git log --oneline 76f15abd88..ba36761859`, 376 commits). Solver/model trains: `hammer-harvest-hit-tiebreak`
(f43e2de8), `frozentick-w53` (f0be39d5), `freeze-w51-w52`, `freezeedge-w54`, `owlturret-w49-w50`, `rules-lavatrap` (23c6bbab),
`hammer-flip-l28-guard` (99415167, the L28 flip), `rules-pull-line` (21f342e7), `content-pass1/2/3r` (`3r` = PASS-3, engine closure),
`rules-k-pursuit` (3c602f96, rule K), `rules-spinner-alias-guards` (f9010498), `js-env-and-rung-reasons` (2338b5ab), `seedling-level-set-held`,
`seedling-early-delivery`, `js-live-delivery-remerge`, and **`hammer-flip-pkc-fh`** (ba367618, PRESS_KILL_CHASERS + HIT_AVOID_PASS ON).

Order: smoke (capture, 150 s), A1, A2, B1, P1, A′1 (the walk script, failed: the bug above), A′1 by hand, A3 (P1 had stopped at
entry 19, so the A1/A2 agreement was not the whole picture), the replays, and A4 (capture OFF, to see whether the entry-19 stop
follows the capture knob). No commit was made while a run held the box lock.

## Knobs (re-measure-5's, through the walk script on main)

| knob | value | arms |
|---|---|---|
| `TEST_MEASURE_STEP_TIMEOUT_MS` | `10800000` (`--budget-s=10800`) | all |
| `TEST_MEASURE_BOT_STALL_MS` | `300000` (`--stall-s=300`) | all |
| `TEST_AUTO_START_TIMEOUT_MS` | `11100000` (the walk script: budget + 300 s; re-measure-5 had `10800000`) | all |
| `TEST_TIMEOUT` | `11400000` (budget + 600 s; re-measure-5 had `11000000`) | all |
| `TEST_MEASURE_PLAYTHROUGH_SEED` | `2` | A′ |
| `TEST_MEASURE_FLASH_RUNTIME` | `js` (`--runtime=js`) | B |
| `TEST_MEASURE_SKIP_REFUSALS` | `10` | probe |
| `TEST_MEASURE_CAPTURE_REQUESTS` | `<jsonl>` (**new**, `--capture-requests=`) | A1, A3, P1 |

Every re-measure-5 knob exists at BASE, so none was added except capture. The two outer clocks are the walk script's own,
slightly above re-measure-5's. Both sit above the 10800 s step budget, so neither decides a stop: no run came near either.
No `?seedlingSolverEnv=` was passed, so every arm ran the shipped defaults: budget 640, held retry 2560, backstop 300 s,
everything above ON. Every row reads `PASSED` because the ratchet grades it against `firstFailingStep: 'bot-plays'`. **PASSED is
not victory.** Runner: `run-arm.sh` and `seq{1,2,3}.sh` in the evidence dir.

## The new knob: `TEST_MEASURE_CAPTURE_REQUESTS` (MEASUREMENT-ONLY, `bedffaf0`, +123/−5 in 3 files)

- `test_json/e2e/app.spec.js`: when the env var is set, it adds `&measureCaptureRequests=1`. Before `page.goto` it also
  exposes `__measureCaptureAppend(line)`, which appends to the file.
- `tutorialTests.js` § the walk instrument: `?measureCaptureRequests=1` joins `MEASURE_ACTIVE`, and the sampler starts
  `startRequestCapture`. Every 25 ms it reads `getSeedlingWasmSolveServices()` and wraps each service's `start` **once**.
  The wrapper keeps the request exactly as the divergence lab does (`stampHooks({...request})`), then calls the real `start`
  unchanged. When the handle settles, it serializes the request with `seedlingSolveRequestCodec.captureRequest`, the same codec
  the sweep uses. Entries are grouped by the bot's head at the start (`id` = entry number, `key` = location name):
  `{id, key, requests: [{i, goal, retry, request, passes, result}]}`. A row is written once the cursor has left that entry,
  and every open row is written at the stop. `result.answer` is the sha1[0:12] of the same text that
  `replay-seedling-solve-request.mjs` hashes, so `LIVE:` and `ROW` compare directly. If a service had already started solves
  before it was wrapped, the sampler logs `[MEASURE capture] MISSED`; no run logged one.
- `walk-seedling-whole-game.mjs`: `--capture-requests=<jsonl>` → the env var (and `[MEASURE capture]` lines echoed).
- **Default OFF ⇒ byte-identical**: with no env var there is no URL param, no binding, no import and no timer.
  `measure.stop`'s result is awaited only when it is a promise, which happens only with capture on. The walk script's
  `walkSeedlingWholeGame.test.js` passes 8/8 (`npx vitest run` on that one file; ⚖ 52).
- **ON vs OFF agree on the stop:** A1 (ON) and A2/A4 (OFF) end on the same entry-26 refusal (tables below). The entry-19 stop
  happened only in capture-ON runs (A3, P1: 2 of 3 ON, 0 of 2 OFF). Re-measure-5's A2 made the same 18/48 split **without**
  the knob, so the split is older than the knob. The two samples are too small to rule out that capture's main-thread
  serialization nudges the timing. The capture does not change any solve's answer: see the replays.
- Size: each request carries the room atlas (`source.records`), about 0.5 MB. A1 captured **149** requests (78.6 MB raw,
  12.9 MB gzipped), A3 **90**, and P1 **147** (77.5 MB raw).

The full diff is `git show bedffaf0`. Its core is the wrapper:
```js
const start = svc.start.bind(svc);
svc.start = (request, opts) => {
    const posted = stampHooks({ ...request });
    const handle = start(request, opts);
    const e = entryOf();
    pending.push({ id: e.id, key: e.key, goal: request?.name ?? request?.solverGoal?.name ?? null, retry: opts?.attempt?.retry ?? null, posted, handle });
    return handle;
};
```

### The replay proof
`node scripts/procgen/replay-seedling-solve-request.mjs --requests=<file> --id=<entry> --i=<k> --n=3 --live` (output in `replay/`):
```
A1 stop (26:9, the 2560 retry):  REPLAY: leg 26 request 9 (budget 2560): 1 distinct answer(s) over 3, 1 distinct trace(s)
                                 LIVE: {"ok":false,"kind":"refusal","work":331,…,"answer":"b7bc62b65c94",…}   runs: refusal 331 b7bc62b65c94 ×3
A1 26:8 (its 640 pass):          REPLAY: leg 26 request 8 (budget 640): 1 distinct answer(s) over 3, 1 distinct trace(s)
                                 LIVE: {"ok":false,"kind":"refusal","work":642,…,"answer":"b7bc62b65c94",…}   runs: refusal 642 b7bc62b65c94 ×3
A3 stop (19:1):                  REPLAY: leg 19 request 1 (budget 640): 1 distinct answer(s) over 3, 1 distinct trace(s)
                                 LIVE: {"ok":false,"kind":"refusal","work":112,…,"answer":"8ef0debe2bb9",…}   runs: refusal 112 8ef0debe2bb9 ×3
P1 skip 1 (19:1):                REPLAY: leg 19 request 1 (budget 640): 1 distinct answer(s) over 3, 1 distinct trace(s)   (same answer, ~150 s per run)
A1 19:1 (the 816 cut):           REPLAY: leg 19 request 1 (budget 640): 1 distinct answer(s) over 3 — refusal 644 668f4ca7aff6 = LIVE (a budget cut, ~21 s)
P1 skip 2 (26:11, backstop):     REPLAY: leg 26 request 11 (budget 640): 1 distinct answer(s) over 1 — refusal 642 432ec5f5b196 in 711337 ms
                                 LIVE: {"ok":false,"kind":"budget","work":null,…,"message":"cancelled"}  (the page's backstop terminated it)
```
**Every captured stop reproduces the page's answer exactly (kind, answer hash and work), 1 distinct answer over 3.** The one
exception is 26:11, where the page has no answer to compare: its 300 s backstop terminated the solve. In node the same request
ends as an ordinary 640 budget cut (`dashless` 641 units, its deadline at `crusher-fork`; then `full` 1 unit at `walk`) after
711 s.

## Arm A: wasm, seed 1 (vanilla)

| run | capture | checked / total (bot) | snapshot | last sphere | stop: region / entry | cause by name | `bot-plays` wall | region changes / pushes | heap |
|---|---|---|---|---|---|---|---|---|---|
| A1 | ON | **26/48** | 42 | 7.3 | `level_40__r48c54`, **entry 26 "Level 040 - Boss Key 2"**, prerequisite "L40 flag 12: wandlock@480,560 cleared" | ladder EXHAUSTED: clear-tag {40,12} → burn stance (`burnabletree@872,784`), danger `chaser:bob@736,752` | 1895.0 s (row 1909.7 s) | 168 / 111 | 656 MB flat (127) |
| A2 | OFF | **26/48** | 42 | 7.3 | the same | the same (status = A1's, except `narrow`'s hammer: phase 31/45, 248.0°, Game.time 52321) | 1900.3 s (row 1914.7 s) | 168 / 111 | 656 MB flat (127) |
| A3 | ON | **18/48** | 32 | 6.8 | `level_40__r26c13`, **entry 19 "Level 040 - Chest"** | HARD refusal at 640: "kill (spinner@**880**,848) by press … There is no step out … (HAMMER_PHASE_RUNG)" | 1214.5 s (row 1228.6 s) | 105 / 71 | 656 MB flat (81) |
| A4 | OFF | **26/48** | 42 | 7.3 | the same as A1 | the same as A1 (only Game.time 52673 differs) | 1825.1 s (row 1837.7 s) | 168 / 111 | 656 MB flat (122) |

The probe P1 (below) follows the walk exactly up to entry 19. It stops there the way A3 does, with a byte-identical request.
**Seed 1 wasm: 3 of 5 runs at 26/48, 2 of 5 at 18/48.**

Timeline (entry first seen @ s / region changes). A1: `1@15s/r2 3@120s/r14 4@135s/r19 5@165s/r21 6@240s/r34 8@300s/r39 9@315s/r43
10@465s/r54 11@495s/r57 12@510s/r59 14@570s/r60 15@720s/r72 16@795s/r77 17@870s/r87 18@885s/r92 19@1140s/r105 20@1246s/r105
21@1275s/r108 22@1395s/r117 23@1425s/r122 24@1530s/r134 25@1740s/r154 26@1755s/r157`. A2 and A4 are the same sequence within
±60 s. A3 matches through `18@885s/r96 19@1110s/r105` and then stops. This box is about as fast as re-measure-5's: A1 reaches
entry 26 at 1755 s here and at 1680 s there.

**Entry 19 "Level 040 - Chest": where the runs split, and what PKC changed.**
- A1/A2/A4 (`spinner@816,848`): A1's capture shows `19:1` at 640 → **refusal work 644**, *"the caller's anytime deadline
  (`shouldStop`) was reached at the `walk` site before … apitem (880,816) contact's corridor"*. That is a budget cut, not
  re-measure-5 A2's hard "no step out". Then `19:2` at 2560 (retry 1) → **solved, work 1493**. hammer-12's prediction holds
  for the 816 family: it turns CUT@640 and the held retry solves it. The next leg, entry 20 (Totem Part 160,640), is refused
  at 640 by the same spinner (`20:0`: *"apitem (160,640) contact: the combat ladder is EXHAUSTED … spinner:spinner@816,848 (a
  live Spinner BODY …)"*, work 132). The walk re-plans (`20:1`, solved, work 65) and goes on. A2 and A4 (capture OFF) log the same entry-19 path: *"Level 040 - Chest: the solver ran out of 640 work units in level 40 — asking again with 2560, the room held (retry 1)"*, and pass.
- A3/P1 (`spinner@880,848`): `19:1` at 640 → **refusal work 112**, the run's stop:
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1228.6s
[tutorial-walk-timing] seedling-whole-game: load 4.1s, start-game-clear-save-panel 0.1s, start-game-clear-save 0.7s, start-game-page 5.3s, start-game 1.3s, bot-plays-open 0.2s, bot-plays 1214.5s
[MEASURE end] seedling-whole-game t=1226s step=bot-plays checked=32 botQueue=48 botCursor=18 botChecked=18 botHead="Level 040 - Chest" botRegion="level_40__r26c13" lastRegionEvent="level_40__r26c13" regionChanges=105 wasmPushes=71 transport=wasm wasmMemMB=656 jsHeapMB=215 status="error: level_40__r26c13: the bot cannot walk to location \"Level 040 - Chest\" — the wasm playback failed: the solver declined Level 040 - Chest in level 40 (refusal): solverBot(wasm-location-40) apitem (880,816) contact -> kill (spinner@880,848) by press: every key set — the plan's own and 5 alternative(s) — lands the player box on a body's 7x7 rect or on the 13 px hammer line at that tick's own phase, on the next tick, at (741.44,685.29) in level 40. There is no step out. the HAMMER-PHASE rung first saw this corner at t652, and from t654 NO PHASE admits a step: no hold of 1..44 tick(s) at any walk-offset -1..0 (0 tried) walks the approach clear for one more hammer period (45 ticks) (HAMMER_PHASE_RUNG). The plain fallback (`OPP_PRESS_FALLBACK`) rewound to the kill's first tick (t0) and redid the kill with `OPPORTUNISTIC_STRIKE` off; it did not kill (HAMMER_SAFETY: solverBot(wasm-location-40) apitem (880,816) contact -> kill (spinner@880,848) by press: every key set — the plan's own and 5 alternative(s) — lands the player )."
```
- **Why the two arrivals differ (from the capture, not diagnosed):** A3's and P1's requests 19:0 and 19:1 are byte-identical
  (0 differing fields). A1's 19:1 differs from them in 12 fields: `staging.persistence` has 65 rows against 64 (A1 holds
  **L39 tag 3**; the rest of the diff is the same rows shifted by one), `staging.rng.seed` is 2132250561 vs 1072946186, and
  `staging.seam.time` is 33998 vs 33487. The capture's answer hashes first part at **entry 18** (L39 Totem Part 72,40). A1
  answers its first request 4 times, with the same answer each time, so the page asked again; A3 and P1 answer it once. The
  leg's last request then differs: A1 `2e1603a6ae22`/641, A3 and P1 `a52db2c93b64`/642. Entries 6 and 8 also differ between
  A1 and A3, then come back together. Each request is deterministic. Which arrival a run gets is decided on the page side
  before L40.

The entry-26 stop (A1; A2 and A4 the same apart from the hammer phase):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1909.7s
[tutorial-walk-timing] seedling-whole-game: load 4.3s, start-game-clear-save-panel 0.1s, start-game-clear-save 0.6s, start-game-page 3.6s, start-game 2.7s, bot-plays-open 0.3s, bot-plays 1895.0s
[MEASURE end] seedling-whole-game t=1907s step=bot-plays checked=42 botQueue=48 botCursor=25 botChecked=26 botHead="Level 040 - Boss Key 2" botRegion="level_40__r48c54" lastRegionEvent="level_40__r48c54" regionChanges=168 wasmPushes=111 transport=wasm wasmMemMB=656 jsHeapMB=215 status="error: … (the full refusal below)"
```
⚠ **Ladder EXHAUSTED: the full refusal**, decoded from A1's `[MEASURE end]` status (`A1.stop-status.txt`; since train 180 the
rung lines ride in the status):
```
error: level_40__r48c54: the bot cannot walk to location "L40 flag 12: wandlock@480,560 cleared" — the wasm playback failed: the solver declined L40 flag 12: wandlock@480,560 cleared in level 40 (refusal): solverBot(wasm-location-40) clear-tag {40,12} wandlock@480,560 -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED. The corridor passes through danger at (744.3,802.3) — chaser:bob@736,752 (inside leash 80 (d=5.3), box grown 0.5 px/tick x 0 + pad 0) — and every rung of ⚖ §11.8a's order refused:
  avoid: no admissible corridor with the danger map's 17 volume(s) forbidden — A* goal tile (55,51) in level 40 — for (888,824) — is not walkable: danger:bobsoldier@880,832 (a stepped bobsoldier at its LIVE position) at (868,822). The planner works in whole tiles, so both ends o
  time: the aim is 408 px away and `mover.MOVER_RANGE` measures this search reaching 48 px as an UPPER BOUND at dwell 4. TIME is the contested LAST-MILE tool (kickoff §3.1); it is not a room-crossing one, and the bound is named rather than widened.
  bait: no stance within bob@736,752's leash (80) both pulls its straight line through a kill region and is itself danger-free: 0 cell(s) in leash, 0 of them crossing a region, none of those reachable. ⛔ A stance safe to PASS is not safe to WAIT in (trap 154), and this rung asks the waiting question.
  kill: no presser in level 40 arms a trap whose lane covers bob@736,752 — the room has 6 presser(s) and 0 trap(s), and a button that arms nothing over the body is not a weapon. A PRESS arm is a `KILL_ARM_POLICY` question and this rung does not open one (trap 101).
         chaser arm: no stance derives for bob@736,752 on level 40: the 8-cell box around the player's node held 0 leash cells, so the box around the TARGET was scanned: 81 cell(s) inside its 80 px leash, 11 of those reachable and with a corridor onward, and 11 of THOSE refused by the forecast [(744,840): the APPROACH is dangerous at tick 506 — spinner:spinner@816,848; (744,824): the APPROACH is dangerous at tick 506 — spinner:spinner@816,848; (744,808): the APPROACH is dangerous at tick 506 — spinner:spinner@816,848; …]. ⛔ A stance safe to PASS is not safe to WAIT in (trap 154), and this rung asks the waiting question over the whole duration rather than at the instant. GUARD APPROACH (guardApproachStance): no approach stance for bob@736,752 either — REACH: 5 lattice cell(s) within the sword's 16 px of its box, 2 of those with no corridor here or onward, +0 candidate(s) whose walk did not settle or plan; TIMING: 0 candidate(s) where bob@736,752 outlives the ceiling or lands on the player first; LEASH: 11 candidate(s) where another body reaches the player — of 11 asked [(744,840) leash: the APPROACH is hit at tick 506 by spinner:spinner@816,848; (744,824) leash: the APPROACH is hit at tick 506 by spinner:spinner@816,848; (744,808) leash: the APPROACH is hit at tick 506 by spinner:spinner@816,848; …].
  narrow: the corridor walked with the pre-lapse strike admissions is dangerous too — spinner:spinner@816,848 (a live Spinner's HAMMER at (751.3,853.4) at horizon 569 — the exact 13 px `collideLine` at Game.time 52718 (phase 23/45, angle 184.0°)) at (744.3,849.8)
  detour: COVERED GOAL (coveredGoalRefusal): the aim (888,824)'s own tile (55,51) lies inside the live body bobsoldier@880,832's volume (a stepped bobsoldier at its LIVE position), so the danger map forbids the goal itself — every DETOUR candidate and every forced crossing ends on that tile, and neither rung is asked while it stands
  forced-hit: COVERED GOAL (coveredGoalRefusal): the aim (888,824)'s own tile (55,51) lies inside the live body bobsoldier@880,832's volume (a stepped bobsoldier at its LIVE position), so the danger map forbids the goal itself — every DETOUR candidate and every forced crossing ends on that tile, and neither rung is asked while it stands
```
The `avoid` line is cut mid-word in the status itself ("both ends o"), as in re-measure-5. The captured sequence: `26:8` at 640
→ refusal work 642, then `26:9` at 2560 (retry 1) → **the same refusal** (answer `b7bc62b65c94`), work 331. More budget does not
help.

## Arm A′: wasm, seed 2 (`AP_01043188731678011336`, level set `seedling-ap-record-195d9f6d`)

`python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2` → **`AP_01043188731678011336`**,
the **same id** as re-measure-5. The page loaded it as **`seedling-ap-record-195d9f6d`**, also the same hash. The walk script's
`--seed=2` failed (the bug above: it looked for `…/AP_AP_01043188731678011336`). So `seq2.sh` generated the seed, ran
`npm test` with the walk script's own env plus `TEST_MEASURE_PLAYTHROUGH_SEED=2`, and reverted afterwards: `preset_files.json`
checked out, the preset dir and `output/AP_01043188731678011336.zip` deleted, `git status` clean.

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes | heap |
|---|---|---|---|---|---|---|---|---|
| A′1 | **15/48** | 20 | 2.14 | `level_40__r26c13`, entry **16/48 "Level 040 - Chest"** | the **300 s backstop**: "the solve exceeded the backstop on this machine (300 s) on location in level 40 (terminated; the solve's own budget is 640 work units)" | 1286.5 s (row 1299.9 s) | 105 / 75 | 656 MB flat (86) |

Recorded, not diagnosed. Timeline: `1@15s/r2 3@120s/r14 4@135s/r17 5@270s/r28 6@315s/r34 7@330s/r38 8@375s/r41 9@450s/r50
10@525s/r62 11@540s/r65 12@555s/r71 14@615s/r77 15@767s/r98 16@990s/r104`. **Entry 14 (L030 Torchpickup), re-measure-5's stop,
passes.** At t≈690 the status reads *"breaking rope@160,64 first (flag:L28:0) — the route to level_30__r2c10 (14/48) needs it"*,
and by t=735 the bot is routing through `level_28__r1c18 -> level_30__r2c10`. Entry 15 is L039 Totem Part 72,40 (a 3838-tick
plan), then the L39 → L40 crossing. The lead-in: *"walking to "Level 040 - Chest" (16/48) — solving… (budget 640 work units)"*,
and 300 s later the backstop.
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1299.9s
[tutorial-walk-timing] seedling-whole-game: load 3.9s, start-game-clear-save-panel 0.1s, start-game-clear-save 0.6s, start-game-page 4.9s, start-game 1.2s, bot-plays-open 0.2s, bot-plays 1286.5s
[MEASURE end] seedling-whole-game t=1297s step=bot-plays checked=20 botQueue=48 botCursor=15 botChecked=15 botHead="Level 040 - Chest" botRegion="level_40__r26c13" lastRegionEvent="level_40__r26c13" regionChanges=105 wasmPushes=75 transport=wasm wasmMemMB=656 jsHeapMB=202 status="error: level_40__r26c13: the bot cannot walk to location \"Level 040 - Chest\" — the wasm playback failed: the solve exceeded the backstop on this machine (300 s) on location in level 40 (terminated; the solve's own budget is 640 work units)"
```
A′1 ran with capture OFF, so its backstop request is not on file. F1 did not fire in any run: there is no "tape errored" or
"ended at tick k of N" line.

## Arm B (control): the JS runtime, seed 1, at defaults

**`?seedlingSolverEnv=` now does reach the JS frame at BASE.** Train `js-env-and-rung-reasons` (2338b5ab):
`flashPanelUI.js:2516` *"the host page's `?seedlingSolverEnv=`, verbatim … so the JS frame's solve worker honours the same switches
as the wasm page's (`seedlingSolverEnvCarry.js`)"*. None was passed here, so B ran the defaults (PKC, HIT_AVOID, TALK, KILL_ARM ON).

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes |
|---|---|---|---|---|---|---|---|
| B1 (`transport=js`) | **8/48** | 16 | 3.7 | `level_22__r8c0`, entry **9/48 "Level 025 - Chest"**, exit `level_22__r8c0 -> level_25__r2c7` | R1 named-danger FAIL: `CORRIDOR_LADDER_NEST 2` against `chaser:wallflyer@64,80` | 366.0 s (row 379.8 s) | 51 / 35 |

```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 379.8s
[tutorial-walk-timing] seedling-whole-game: load 4.3s, start-game-clear-save-panel 0.1s, start-game-clear-save 1.1s, start-game-page 5.0s, start-game 0.3s, bot-plays-open 0.4s, bot-plays 366.0s
[MEASURE end] seedling-whole-game t=377s step=bot-plays checked=16 botQueue=48 botCursor=8 botChecked=8 botHead="Level 025 - Chest" botRegion="level_22__r8c0" lastRegionEvent="level_22__r8c0" regionChanges=51 wasmPushes=35 transport=js wasmMemMB=? jsHeapMB=273 status="error: level_22__r8c0: the bot cannot walk to exit \"level_22__r8c0 -> level_25__r2c7\" — the JS runtime's walk failed: the solver declined — solverBot(js-runtime-L22-exit) reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 (the wallflyer's contact: its `hitPlayer` gate fires against the player's start-of-tick box THIS tick (body at (79.0,88.0), forecast along the walk)) inside a climb already 2 deep (CORRIDOR_LADDER_NEST 2): a stance walk whose own corridor needs the ladder again is not converging — solving… (budget 640 work units)"
```
These are re-measure-4's and re-measure-5's words, verbatim. The wasm walk meets the same refusal at the same spot (A1 `9:7`,
work 643: *"reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets
chaser:wallflyer@64,80 …"*) and recovers on a later request. JS stops there.

## Skip probe: wasm, seed 1, `TEST_MEASURE_SKIP_REFUSALS=10`, capture ON

`bot-plays` 2293.3 s (row 2307.8 s), 173 region changes, 116 wasm pushes, heap 656 MB flat (153 samples), 147 requests captured
(`P1.requests.jsonl.gz`, the whole run). The probe took the A3 arrival into L40. It **spent skip 1 on entry 19**, played on
through 20–25 (the same path as A1: L58, L91's drill on the 2560 retry, Feather, L90 Chest), and reached entry 26 at 1770 s.
There it spent the rest of its skips: skips 3–10 went in 11 s, on knock-ons and a model refusal, and the run ended at entry 36.
The walk script's "42/48 (+10 skipped)" is **not a real tally**, because `botChecked` counts skipped and probe entries. The
probe PLAYED entries 1–18 and 20–25.
```
[MEASURE skip 1] t=1278s skipping entry 19/48 "Level 040 - Chest" (sphere 6.8)
[MEASURE skip 2] t=2293s skipping entry 26/48 "Level 040 - Boss Key 2" (sphere 7.3)
[MEASURE skip 3] t=2296s skipping entry 28/48 "Level 064 - Ghostspear" (sphere 7.5)
[MEASURE skip 4] t=2297s skipping entry 29/48 "Level 041 - Totem Part 240,144" (sphere 8.6)
[MEASURE skip 5] t=2298s skipping entry 30/48 "Level 042 - Totem Part 184,152" (sphere 8.7)
[MEASURE skip 6] t=2299s skipping entry 31/48 "Level 067 - Boss Key 4" (sphere 8.8)
[MEASURE skip 7] t=2301s skipping entry 32/48 "Level 040 - Totem Part 64,144" (sphere 9.4)
[MEASURE skip 8] t=2302s skipping entry 33/48 "Level 069 - Lights" (sphere 9.5)
[MEASURE skip 9] t=2303s skipping entry 34/48 "Level 043 - Wand" (sphere 10.1)
[MEASURE skip 10] t=2304s skipping entry 35/48 "Level 012 - Witch" (sphere 11.3)
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 2307.8s
[MEASURE end] seedling-whole-game t=2305s step=bot-plays checked=43 botQueue=48 botCursor=35 botChecked=52 botHead="Level 043 - Totem of Lacste" botRegion="level_0__r11c19" lastRegionEvent="level_0__r11c19" regionChanges=173 wasmPushes=116 transport=wasm wasmMemMB=656 jsHeapMB=202 status="error: no path from level_0__r11c19 to level_43__r8c7, nor from the restart target Menu"
```
**Entry 26 without the L40 Chest went differently.** The `{40,12}` burn **solved**: `26:8` at 640 was a budget cut (645), and
`26:9` at 2560 solved it (work 2099). `26:10` solved too (457). Then `26:11`, collecting `bosskey@656,528`
(`wasm-continue-location-40`, `collect-placement`), ran into the 300 s backstop at budget 640: *"the solve exceeded the backstop
on this machine (300 s) on location in level 40 (terminated; the solve's own budget is 640 work units)"*. Replayed in node it
takes 711 s and ends as a 640 budget cut (see the replay proof). So in this state the wall is the wall clock, not a refusal.

## The next refusals, with captured-request ids

Ids are `run entry:i` in the capture files: `A1.stop-requests` (entries 18, 19, 26), `A3.stop-requests` (18, 19), and
`P1.requests` (the whole probe). Survey at BASE: run **45059539994** @`ba36761859`, merged **SOLVED 224 / REFUSED 26**
(`survey-refused-rows.txt`). 4.2 is 39/39, so nothing can match there.

| # | entry | location | refusal (quoted) | request id | kind | survey match (REFUSED at BASE?) |
|---|---|---|---|---|---|---|
| 1 | 19 | Level 040 - Chest | "apitem (880,816) contact -> kill (spinner@880,848) by press: every key set … There is no step out … (HAMMER_PHASE_RUNG)" | **P1 19:1**, = A3 19:1 (byte-identical), answer `8ef0debe2bb9` | **the stop in 2 of 5 runs**; HARD, no retry | **YES: step 66** (goal "Level 040 - Chest; Level 040 - Totem Part 160,640", REFUSED; its refusal names `spinner@816,848`) |
| 2 | 26 | Level 040 - Boss Key 2 | after the burn solved: "the solve exceeded the backstop on this machine (300 s) … (terminated; the solve's own budget is 640 work units)" | **P1 26:11** (collect bosskey@656,528) | wall clock; node: a 640 cut after 711 s | **YES: step 96** (goal "L40 flag 12: wandlock@480,560 cleared; Level 040 - Boss Key 2", REFUSED: "collect (656,528) stance … no corridor … to a stance that can collect bosskey@656,528") |
| 2′ | 26 | (the same, the A1 state) | "clear-tag {40,12} wandlock@480,560 -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED … chaser:bob@736,752" (full above) | **A1 26:8, 26:9**, answer `b7bc62b65c94` | **the stop in 3 of 5 runs** | **YES: step 96** |
| 3 | 28 | Level 064 - Ghostspear | "the model refused to build level 0 from the arrival: level 0: the tape clears tag(s) 12, which no entity in this level reads. A clear is derived from a named blocker; one that matches nothing is a derivation error, not a harmless extra. (Entities that read persistence here: 1.)" (on exit `level_0__r11c19 -> level_12__r0c19`) | none: the model refused before any solve | **new**; probably a probe artefact (it follows the skipped {40,12}, and tag 12 is that flag's number), but it names a derivation error | — (the survey has no L0 row) |
| 4 | 29 | Level 041 - Totem Part 240,144 | "no path from level_0__r11c19 to level_41__r7c15, nor from the restart target Menu" | none (no solve) | knock-on of BK2 | — |
| 5 | 30 | Level 042 - Totem Part 184,152 | "no path from level_0__r11c19 to level_42, nor from the restart target Menu" | none | knock-on | — |
| 6 | 31 | Level 067 - Boss Key 4 | "no path from level_0__r11c19 to level_67__r3c2, nor from the restart target Menu" | none | knock-on (re-measure-5's probe PLAYED it) | — |
| 7 | 32 | Level 040 - Totem Part 64,144 | "no path from level_0__r11c19 to level_40__r4c4, nor from the restart target Menu" | none | knock-on | (step 149, L40 wandlock {40,7} → this totem, REFUSED; not reached) |
| 8 | 33 | Level 069 - Lights | "no path from level_0__r11c19 to level_69, nor from the restart target Menu" | none | knock-on (re-measure-5 reached L61's bridge, step 155) | (step 155 still REFUSED; not reached) |
| 9 | 34 | Level 043 - Wand | the level-0 "tape clears tag(s) 12" model refusal again | none | as 3 | (step 167 REFUSED; not reached) |
| 10 | 35 | Level 012 - Witch | the same level-0 model refusal | none | as 3 | — |

Refusals the walk met and **recovered from** (none is a stop, but each one is on file):

| entry | refusal (quoted) | request id | survey |
|---|---|---|---|
| 9 | "reach-exit (0,128)->L25 -> kill (bob@96,144) stance … CORRIDOR — the corridor meets chaser:wallflyer@64,80 … (CORRIDOR_LADDER_NEST 2)" (= the JS stop) | A1/P1 9:7 (work 643) | — |
| 9 | "no corridor for goal reach-exit toward (24,56) in level 20. Obstacle: proximity-hazard:shieldlocknorm (shieldlocknorm@176,16). No strategy row exists for this obstacle." | A1/P1 9:1 | — |
| 16 | "reach-exit (144,304)->L37 -> hold: every responder in group t=2 [cover@208,224] is ALREADY OPEN before the hold begins" | A1/P1 16:0 | — |
| 20 | "apitem (160,640) contact: the combat ladder is EXHAUSTED … spinner:spinner@816,848 (a live Spinner BODY …)" | A1 20:0 (work 132) | **YES: step 66** (the same leg, the same spinner) |
| 24 | "reach-exit (80,16)->L46: the re-planned corridor failed too … waypoint 1 (72,56): not reached within 400 ticks" (the L58 yeti graze) | A1 24:7, P1 24:8 | **YES: step 111** (verbatim) |

## Then vs now

| arm | re-measure-4 (`4e0eab7215`) | re-measure-5 (`76f15abd88`) | **now (`ba36761859`)** |
|---|---|---|---|
| A wasm seed 1: checked | 24/48 (3/3) | **26/48** (3/4) · 18/48 (1/4: A2) | **26/48** (3/5: A1, A2, A4) · **18/48** (2/5: A3, P1) |
| A: stop entry | 24 "Level 089 - Feather" (L58) | 26 "Level 040 - Boss Key 2" · 19 "Level 040 - Chest" | **26 "Level 040 - Boss Key 2"** · **19 "Level 040 - Chest"** |
| A: cause | L58 yeti, "no-verb: no strategy row exists for solid:yeti" | {40,12} burn: ladder EXHAUSTED, `chaser:bob@736,752` (step 96) · `spinner@816,848` press "no step out" at 640 (step 66) | **the same {40,12} refusal, verbatim** (step 96) · **`spinner@880,848`** press "no step out", HAMMER_PHASE_RUNG (step 66) |
| A: `bot-plays` wall | 2989–3198 s | 1777–1813 s (A2 1073 s) | **1825–1900 s** (A3 1215 s) |
| A: region changes / pushes | 140 / 93–94 | 168 / 111 (A2 105 / 71) | **168 / 111** (A3 105 / 71) |
| A′ wasm seed 2: checked | 4/48 | 13/48 | **15/48** |
| A′: stop | 5, `level_12__r0c37 -> level_21` stalled | 14, L28 `level_28__r1c18 -> level_30__r2c10`, "no REACHABLE stance inside button@112,240" | **16, "Level 040 - Chest", the 300 s backstop** (L28 passes: rope@160,64 first) |
| A′: wall | 727.7 s | 706.7 s | **1286.5 s** |
| B JS seed 1: checked | 8/48 | 8/48 | **8/48** |
| B: stop | 9, L22→L25, CORRIDOR_LADDER_NEST 2, `chaser:wallflyer@64,80` | the same | **the same, verbatim** |
| B: wall | 386.8 s | 360.7 s | **366.0 s** |
| skip probe | 1 independent (24); ran out at 34 | 2 independent (26, 33 L61 bridge); played 28 and 31; ended at 34 | **2 independent (19 spinner@880,848; 26 backstop after the burn SOLVED)**; one new model refusal (L0 "tape clears tag 12", knock-on); skips spent by 35; ended at 36 |

**Is A2's L40 Chest stop gone (every wasm run past entry 19)?** **No.** The `spinner@816,848` version is gone: every arrival
that met it took a budget cut at 640 and a hitless solve on the 2560 retry, as hammer-12 measured. But 2 of 5 runs met
`spinner@880,848` instead, the family that was unmeasured under PKC. That refusal is HARD at 640, so it stops the walk at 18/48.
Which spinner a run meets depends on its arrival into L40, and the arrival is decided earlier (entry 18, L39).

**Did seed 1 get past entry 26 (L40 Boss Key 2)?** **No.** PKC does not move it: the same ladder exhaustion in 3 of 3 runs that
reached it. The 2560 retry gives the same answer at 331 units. In the probe's other state (no L40 Chest), the burn itself
**solves** and the next leg dies on the wall-clock backstop.

**The new first wall:** unchanged, entry 26. In the runs that do not reach it, the first wall is entry 19, the `spinner@880,848`
press: "every key set … lands the player box on a body's 7x7 rect or on the 13 px hammer line … There is no step out … from t654
NO PHASE admits a step … (HAMMER_PHASE_RUNG)".

**Seed 2: 15/48 vs 13/48.** **JS: 8/48 vs 8/48.**

## The criterion today

Robert's criterion is that the bot plays the whole randomized Seedling game to victory in the real wasm game. At main
`ba36761859`, the vanilla seed reaches **26 of 48 checks in about 31 minutes in 3 of 5 runs**, with a flat 656 MB heap. Every
captured stop reproduces in node 3 of 3, so the walk's answers depend only on the requests. Train 193's PKC flip did what
hammer-12 measured for `spinner@816,848`: those arrivals now cut and then solve. But it did not open L40. The Boss Key 2
prerequisite (burn `burnabletree@872,784` to open `{40,12}`) still exhausts the ladder against `chaser:bob@736,752`,
`bobsoldier@880,832` and the 816 hammer. Survey step 96 is the same goal, still REFUSED on main. The same room now also holds
the walk's spread. 2 of 5 runs bring a different L39 state into L40 (one persistence row, the rng, the seam time), meet
`spinner@880,848` instead, and stop hard at 18/48 (survey step 66). The randomized seed moved again, from 13 to 15. The L28 flip
cleared its button-stance wall, and it now ends in the same L40 corner, on the 300 s wall-clock backstop rather than a refusal.
Two of the walk's stops (P1 26:11, A′1 entry 16) are budget-sized solves that take longer than 300 s, which is a separate thing
to watch from the ladder. The JS control has not moved (8/48). Beyond L40 nothing new was measured: with BK2 missing, every later
entry is "no path".

## Leftovers

- The dev server I started (`serve-nocache.py` PID 1203, under wrapper 1200) was stopped by literal PID. No worktree was created.
- Ruling 52: the only vitest run was `npx vitest run scripts/procgen/walkSeedlingWholeGame.test.js` (8/8), the test of a file I
  touched. No source fix, no workflow change, no push to main.
- **Not fixed (a finding for main):** `walk-seedling-whole-game.mjs`'s `prepareSeed` builds `AP_${seedId()}`, but `get_seed_id`
  already returns `AP_…`. With `--seed=N`, N ≠ 1, it reports a Generate.py failure, deletes nothing real, and leaves the generated
  preset dir and `output/AP_<id>.zip` behind. I deleted them myself before re-running by hand.
- Capture files: `P1.requests.jsonl.gz` (12.8 MB, the whole probe), `A1.stop-requests.jsonl.gz` (2.2 MB; entries 18, 19, 26)
  and `A3.stop-requests.jsonl.gz` (1.0 MB; 18, 19), about 16 MB in all. **Dropped:** the full A1 and A3 captures (78.6 MB and
  47.4 MB raw; 12.9 MB gzipped for A1). Together they would pass the 20 MB cap, and P1 already holds every refusal the probe met.
  A2, A4 and A′1 ran with capture OFF.
- The CI survey artifact was downloaded only to read its REFUSED rows (`survey-refused-rows.txt`). The artifact itself is not
  committed.
