# Cloud report: `seedling-whole-game-wasm-remeasure-10`

**The whole-game Seedling wasm walk, seed 1, on the hammer STACK branch `hammer-stack-4sw` @`d8bd5bb578`, with
`PRESS_KILL_START_WAIT` + `PRESS_KILL_REFUGE_BOMBS` + `DASH_STAND_SIGHT` + `LATCHED_HOLD_MOVE` ON. MEASURE ONLY.**

Launcher: `seedling-hammer-phase-planning-16`. Ruling: Robert 2026-11-25 22:05 PST, *"Stack measure + re-measure-10
(Recommended)"*. The harness pinned the branch **`claude/whole-game-wasm-remeasure-ckojg7`**, and every push went there. Nothing was
fixed. The only code commits are the two cherry-picked MEASUREMENT-ONLY knob commits; everything else is evidence and this report.
**Not for landing.**

⚠ **Labels.** Every number is "at d8bd5bb578, STACK" (Arms S, B, P), "…, NOPKRB" (Arm R) or "…, base defaults" (Arm C).
- STACK = `SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_LATCHED_HOLD_MOVE=1`.
- NOPKRB = STACK without `SEEDLING_PRESS_KILL_REFUGE_BOMBS=1`.
- Base defaults = no env. At this base that means BOS, GSW, PM, SPL and KTA are ON (= re-measure-9's FLIP env), and the rest are OFF.
- The walk is bimodal, so every number is a sample ("k/N runs").

## Summary for Robert

- **STACK passes entry 32 in 3 of 3 runs that reached it (3/4 overall); S2 stopped earlier, at entry 19.** S1, S3 and S4 reach
  **36/48**, through entries 32 and 33. They stop at **entry 37 "Level 068 - Health"**, on the exit `level_63__r6c9 -> level_65__r0c8`:
  *"levelRun: a WandShot in level 63 would collide with 5 Enemy-typed bod(ies) this run cannot place: grenade@128,128,
  darktrap@64,96, …"*. That is a new first wall. Re-measure-9's best was 31/48.
  - **S2** (STACK) stopped at **entry 19, 18/48**, on re-measure-9's P1 bad mode: the spinner@880,848 "NO PHASE admits a step"
    corner, survey step 66. The stack does not touch that request: in replay, re-measure-9's P1 19:2 refuses identically under STACK, NOPKRB
    and base, and PKSW is `not-asked` ("the refused kill ran 654 tick(s) from its first tick (bound 180)").
- **⚠ Base defaults are bimodal at 32 too, so the walk alone cannot credit the move past 32 to the stack.** C1 (base, capture OFF)
  also reached 36/48 at entry 37. C2 (base, capture ON, an extra run) stopped at **entry 32, 31/48**, exactly as re-measure-9 did:
  32:10 `cd02c0916e6c` refused, then 32:12 `599d2ef41b84` refused. C2's 32:10 request is byte-identical to re-measure-9's F1 32:10 (seam 81985).
- **The replays do credit the stack, on both arrivals.**
  - **Good arrival** (S1 32:10, seam 79256): it solves 3/3 under STACK and NOPKRB (`ac074b4b9d66`, 0 hits, = live). It **refuses
    3/3 under base** with re-measure-9's text ("kill (spinner@192,128) by press … every key set … lands the player box …"). The
    switch on its path is **`PRESS_KILL_START_WAIT`**: `HAMMER_SAFETY` refused at t1596, then `wait 0 → solved`. DSS is asked once, and LHM is asked
    and declines. (So S1's good arrival under base would not have been good. C1 passed 32 by an arrival we have not captured.)
  - **Bad arrival** (C2 32:10 = re-measure-9 F1 32:10): it **solves 3/3 under STACK, but with 1 hit** (`851256c5b984`, 926 t, *t1799
    chaser:bob@272,112*). It also solves under NOPKRB **with 1 hit** (`353a67c41561`, *t1690 bomb:bombpusher@112,128#9*). It refuses under base.
  - **C2's 32:12** (= re-measure-9's step-149 stop, `599d2ef41b84`) **solves 3/3 with 0 hits under STACK and NOPKRB** (`a404ddf42e41`,
    1889 t), through **`LATCHED_HOLD_MOVE`**: it moves the latched presser hold to (248,103), 130 t. It still refuses under base.
  - ⇒ With the stack, neither known entry-32 arrival refuses any more. **LATCHED-HOLD's "other spinner phase" warning did not show
    up as a refusal.** It shows up instead as a **1-hit plan at 32:10** on the bad arrival.
- **Entry 33 (step 155) still solves under `BRIDGE_OPEN_STRAY`, 8/8 runs.** S1 33:5 = `7ca39971ac20` (re-measure-9's P1 answer), with
  BOS waived ×6 (`bridge@11,13 … open 10,13`), 0 hits.
- **PKRB's marginal effect (S vs R): none visible on the walk.** R1 and R2 match S1, S3 and S4: 36/48, entry 37, the same text, and entry walls
  in the same range. In replay, PKRB changes *which* hit the bad-arrival 32:10 takes (bob instead of the bomb), not whether it takes one. On every other request
  replayed, NOPKRB gives the same answer as STACK.
- **Hits (the page's own `modelHits` on every captured answer):** in S1, 206 solved answers; in P1, 207; in C2 (base), 177. **Each has exactly
  one answer with a hit, the same in all three:** 5:7 "Level 017 - Chest" `wasm-continue-exit-16` `4ef7e74de551`, 1 hit. So **no STACK run
  took a page hit that the base run did not**, and **every L40 solve under STACK is 0-hit** (table below). The only stack-specific hit
  seen is the replayed bad-arrival 32:10 above, which no STACK walk drew.
- **JS: 8/48, unchanged and verbatim** (`CORRIDOR_LADDER_NEST 2`, `chaser:wallflyer@64,80`). All 14 JS-frame solve-worker URLs carry the STACK spec.
- **Skip probe P1:** its three real refusals are **37** (the L63 WandShot), then **38 "Level 071 - Chest"** and **39** (the L71→L75 exit). Both of
  those are *"the count is still waiting on [lavarunner@64,224] … (KILLLOCK_CHASER_REWIND)"* = **survey step 189**. Skips 4–10 were "no path"
  artefacts, because the skipped items were never granted.
- **Watch-list:** L71 was reached (P1 only), but neither GSW `L71 flag 2: shieldlock@288,256` nor PM `L101 flag 0: lightpole@144,64` appears in
  any request or log. The L71 stop is the lavarunner kill-lock, not the shieldlock.
- Heap: 656 MB flat in every wasm run. No OOM, no `RuntimeError`, no container restart. The 300 s backstop ended no entry.

## Base, subject and box

| | |
|---|---|
| base | **`d8bd5bb578`** = `origin/hammer-stack-4sw`: the flip tip `2b24a77e3f` + `hammer-harvest-pksw-hits` @612935c444 + `hammer-harvest-latched-hold` @9de02ebc25 |
| measured head | **`4bf42ffc`** = base + `7173e54b` (cherry-pick of `0f6f207310`, the capture knob) + `4bf42ffc` (cherry-pick of `744e85dcd1`, the solver-env flag). Every arm's box-lock line reads *"head 4bf42ffc5, 0 tracked change(s) frozen"*. Evidence was committed from a separate detached worktree (`/home/user/rm10-ev`), so the measured tree never moved |
| wasm submodule `frontend/modules/flashPanel/wasm` | **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`**, the same pin as re-measure-6 through -9. `session_bootstrap.sh --all` → `[archcc-bootstrap] READY`, exit 0 |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` |
| box | The cloud container: 4 cores, headless Chromium, WebGPU from the batch's `webgpu: true`. Every wasm run reports `transport=wasm`. Dev server `scripts/serve-nocache.py 8000`. One `npm test` per arm, under the box lock, so each arm got a fresh page. The replays ran only when no arm was running |
| row | `tutorial-walk-seedling-whole-game`, batch `tutorials-seedling-whole-game`, step `bot-plays` |
| survey at the flip tip | Run 45734617454 @`2b24a77e3f`: 226 SOLVED / 24 REFUSED. Its one mover against re-measure-9's base (214) is step 155 REFUSED → SOLVED. The refused list used below is re-measure-9's `survey-refused-rows.txt` (run 45689853008) **minus step 155**. That run was not re-read here |

### Switch defaults at BASE (from `frontend/modules/seedlingDemo/solverBot.js` @d8bd5bb578)
- OFF (`=== '1'`):
  - `:21824` `PRESS_KILL_START_WAIT` and `:21865` `PRESS_KILL_REFUGE_BOMBS`;
  - `:8325` `DASH_STAND_SIGHT` (`counts: { asks }`) and `:12212` `LATCHED_HOLD_MOVE`;
  - `:21714` `PRESS_KILL_HOLD`, `:18796` `KEYLOCK_TURRET_EDGE_BAIT` and `:18293` `HAMMER_FIGHT`.
- ON (`!== '0'`):
  - `:12760` `BRIDGE_OPEN_STRAY`, `:3120` `GOAL_START_WAIT` and `:29880` `PREVIEW_METER` (flipped by the flip tip);
  - `:15515` `STRIKE_PREVIEW_LEAN` and `:18751` `KEYLOCK_TURRET_ARRIVAL`.
- All of these names are in `SOLVER_ENV_NAMES` (`solverEnvChannel.js`).
- The counters' `enabled` line confirms each env in every replay. Under base, for example: `enabled PKSW=false PKRB=false DSS=false LHM=false PKH=false BOS=true
  GSW=true PM=true SPL=true KTA=true KTEB=false HF=false`.

## The capture and solver-env diffs (MEASUREMENT-ONLY)

`git diff --numstat d8bd5bb578 4bf42ffc`: `tutorialTests.js` +107/−2, `walk-seedling-whole-game.mjs` +19/−3, `app.spec.js` +20/−0.
**The patch is byte-identical to re-measure-9's** (`diff` of `git diff 8bee4f279a 744e85dcd1` against `git diff d8bd5bb578 4bf42ffc`, index
lines excluded: no difference). None of the three files changed between 214 and the base (`git log 8bee4f279a..d8bd5bb578 -- <files>` is
empty).
- With `TEST_MEASURE_CAPTURE_REQUESTS` unset, nothing is appended, bound or imported. **OFF is byte-identical.**
- With `TEST_MEASURE_SOLVER_ENV` unset, the same holds. C1 and C2 log no `[MEASURE worker]` line at all.

## ⛔ Knob carriage: every switch reaches the page's solve worker, and the JS frame

1. **Worker URL**, logged once per wasm arm:
   - S1–S4 and P1 (and the smoke): `[MEASURE worker] http://localhost:8000/frontend/modules/seedlingDemo/jsRuntimeSolveWorker.js?seedlingSolverEnv=SEEDLING_DASH_STAND_SIGHT%3D1%3BSEEDLING_LATCHED_HOLD_MOVE%3D1%3BSEEDLING_PRESS_KILL_REFUGE_BOMBS%3D1%3BSEEDLING_PRESS_KILL_START_WAIT%3D1`.
   - R1 and R2: the same without `…PRESS_KILL_REFUGE_BOMBS…`.
   - C1 and C2: no env URL.
2. **The worker's stamp on every answer:** `[MEASURE capture] first answer's worker solverEnv="SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_LATCHED_HOLD_MOVE=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_PRESS_KILL_START_WAIT=1"`.
   **All 226 of S1's captured answers, all 234 of P1's and all 24 of the smoke's** carry exactly that stamp. All 198 of C2's carry `null`.
3. **Each switch's own counter fires on a page-captured request replayed with the same env** (`replay-counts.mjs`). Each replay reproduces
   the page's answer hash and work:
   | switch | request | counter |
   |---|---|---|
   | `PRESS_KILL_START_WAIT` | S1 32:10 (STACK; = live `ac074b4b9d66`) | `[{"t":1534,"refused":"HAMMER_SAFETY","refusedAt":1596,"tries":[{"wait":0,"verdict":"solved","endedAt":1663}],"verdict":"solved"}, …]` |
   | `PRESS_KILL_REFUGE_BOMBS` | S1 32:10; S1 19:2 | `{"asked":68,"refused":64}`; `{"asked":132,"refused":0}` |
   | `DASH_STAND_SIGHT` | S1 32:10; S1 29:11 | `{"asks":1}` (both) |
   | `LATCHED_HOLD_MOVE` | P1 32:10 (STACK; = live `f2c760f195ad`) | `moves=[{"level":40,"t":1787,"presser":"buttonroom@160,128","target":{"x":216,"y":87},"ticks":129,…}]` |
   | `LATCHED_HOLD_MOVE` | S1 32:10 | `declined=[{"t":1818,"presser":"buttonroom@160,128","why":"no hitless wait (0 fork(s))"}]` |
   | `BRIDGE_OPEN_STRAY` (base ON) | S1 33:5 | `waived=[{"bridge":"bridge@11,13","stance":"(168,216) facing E","open":"10,13"}, …]` |
   | `GOAL_START_WAIT` (base ON) | S1 26:8 | `tries=[{"t":0,"wait":50,"ok":true}]` |
4. **Arm B (JS): the switches reach the JS frame.** B1 logged 15 worker URLs. 14 are `jsRuntimeSolveWorker.js?seedlingSolverEnv=…` with
   the STACK spec; the other is `stateManagerWorker.js`. The capture does not wrap JS-frame services, so B1 has no answer stamp.

## Knobs, arms and order

| knob | value | arms |
|---|---|---|
| `--budget-s` / `--stall-s` | `10800` / `300` | all (the smoke: `--budget-s=150`) |
| `--solver-env` | STACK | smoke, S1–S4, B1, P1 |
| `--solver-env` | NOPKRB | R1, R2 |
| (none) | base defaults | C1, C2 |
| `--capture-requests` | `<jsonl>` | smoke, S1, P1, **C2** |
| `--runtime=js` / `--skip-refusals=10` | | B1 / P1 |

**Order:** smoke (150 s, ON), **S2** (OFF), **S1** (ON), **R1**, **S3**, **C1**, **S4**, **R2**, **B1**, **P1** (ON). Then the replays (`replays.sh`), then
**C2** (base, ON), then `replays2.sh`.
- C2 is an **extra run** beyond the brief. C1 passed 32 with capture OFF, so its 32:10 was not on file and could not show how base
  defaults got through. C2 was spent to put a base-defaults entry-32 request on file.
- Runner `run-arm.sh` (re-measure-9's, with paths only changed); log `seq.log`.
- Every row reads `PASSED`, because the ratchet grades it against `firstFailingStep: 'bot-plays'`. **PASSED is not victory.**

## Per-arm tables

| run | env | capture | checked / total (bot) | snapshot | last sphere | stop: region / entry | `bot-plays` wall (row) | region changes / pushes | heap (samples) |
|---|---|---|---|---|---|---|---|---|---|
| **S1** | STACK | ON | **36/48** | 59 | 11.5 | `level_63__r6c9`, **entry 37 "Level 068 - Health"** | 3939.5 s (3955.5) | 269 / 174 | 656 flat (263) |
| **S2** | STACK | OFF | **18/48** | 32 | 6.8 | `level_40__r26c13`, **entry 19 "Level 040 - Chest"** | 1182.9 s (1197.8) | 105 / 71 | 656 flat (79) |
| **S3** | STACK | OFF | **36/48** | 59 | 11.5 | entry 37, the same | 4045.3 s (4060.5) | 269 / 175 | 656 flat (270) |
| **S4** | STACK | OFF | **36/48** | 59 | 11.5 | entry 37, the same | 4090.5 s (4106.2) | 269 / 176 | 656 flat (273) |
| **R1** | NOPKRB | OFF | **36/48** | 59 | 11.5 | entry 37, the same | 3945.5 s (3961.4) | 269 / 176 | 656 flat (263) |
| **R2** | NOPKRB | OFF | **36/48** | 59 | 11.5 | entry 37, the same | 4100.2 s (4114.7) | 269 / 175 | 656 flat (274) |
| **C1** | base | OFF | **36/48** | 59 | 11.5 | entry 37, the same | 3907.8 s (3922.6) | 269 / 175 | 656 flat (261) |
| **C2** | base | ON | **31/48** | 52 | 9.4 | `level_40__r4c4`, **entry 32 "Level 040 - Totem Part 64,144"** | 3403.3 s (3419.2) | 229 / 149 | 656 flat (227) |
| **B1** | STACK, JS | — | **8/48** | 16 | 3.7 | `level_22__r8c0`, entry 9 "Level 025 - Chest" | 361.9 s (374.9) | 51 / 35 | (js) heap 290 MB |
| **P1** | STACK, skip 10 | ON | 36/48 real (+10 skipped) | 61 | 11.6 | `level_71__r0c6`, entry 47 (no path) | 4200.3 s (4214.9) | 280 / 183 | 656 flat (280) |

**STACK: 3 of 4 runs pass entry 32 (3/3 of those that reached it). NOPKRB: 2/2. Base: 1/2.**

### The stop lines

S1 (S3, S4, R1, R2 and C1 are identical apart from timings and the `jsHeapMB`):
```
[tutorial-walk-timing] seedling-whole-game: load 3.9s, start-game-clear-save-panel 0.1s, start-game-clear-save 0.6s, start-game-page 2.6s, start-game 3.8s, bot-plays-open 1.0s, bot-plays 3939.5s
[MEASURE end] seedling-whole-game t=3952s step=bot-plays checked=59 botQueue=48 botCursor=36 botChecked=36 botHead="Level 068 - Health" botRegion="level_63__r6c9" lastRegionEvent="level_63__r6c9" regionChanges=269 wasmPushes=174 transport=wasm wasmMemMB=656 jsHeapMB=215 status="error: level_63__r6c9: the bot cannot walk to exit \"level_63__r6c9 -> level_65__r0c8\" — the wasm playback failed: the solver declined level_63__r6c9 -> level_65__r0c8 in level 63 (refusal): levelRun: a WandShot in level 63 would collide with 5 Enemy-typed bod(ies) this run cannot place: grenade@128,128, darktrap@64,96, darktrap@80,64, darktrap@32,272, darktrap@128,272. `WandShot`'s ctor pushes \"Enemy\" onto its own solids, so a live enemy STOPS a shot — and a live enemy is invisible to `collidesSolid`, which only sees the ones something has flipped to \"Solid\". Reporting rather than flying through: a shot that passed through a body would report a clean corridor that does not exist."
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 3955.5s
```
S2:
```
[MEASURE end] seedling-whole-game t=1194s step=bot-plays checked=32 botQueue=48 botCursor=18 botChecked=18 botHead="Level 040 - Chest" botRegion="level_40__r26c13" … status="error: level_40__r26c13: the bot cannot walk to location \"Level 040 - Chest\" — … solverBot(wasm-location-40) apitem (880,816) contact -> kill (spinner@880,848) by press: every key set — the plan's own and 5 alternative(s) — lands the player box on a body's 7x7 rect or on the 13 px hammer line at that tick's own phase, on the next tick, at (739.28,683.81) in level 40. There is no step out. the HAMMER-PHASE rung first saw this corner at t650, and from t653 NO PHASE admits a step … (HAMMER_PHASE_RUNG). The plain fallback (`OPP_PRESS_FALLBACK`) rewound to the kill's first tick (t0) and redid the kill with `OPPORTUNISTIC_STRIKE` off; it did not kill (HAMMER_SAFETY: …)."
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1197.8s
```
C2 (= re-measure-9's F/A stop, verbatim):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 3419.2s
… status="error: level_40__r4c4: the bot cannot walk to location \"Level 040 - Totem Part 64,144\" — … (pass dashless): solverBot(wasm-location-40) apitem (64,144) contact -> hold: the hold stands still for up to 131 tick(s) at (167.88102975116135,135.24945805128786), inside bombpusher@112,128's 256 px reach — a Bomb's Explosion at (168,134) 44 tick(s) into the wait — … The group is LATCHED, so the wait may pace, and no pacing is clean (MOVING_WAIT, 256 tried) …"
```
B1 (verbatim re-measure-4…9):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 374.9s
… status="error: level_22__r8c0: the bot cannot walk to exit \"level_22__r8c0 -> level_25__r2c7\" — the JS runtime's walk failed: the solver declined — solverBot(js-runtime-L22-exit) reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 (…) inside a climb already 2 deep (CORRIDOR_LADDER_NEST 2): a stance walk whose own corridor needs the ladder again is not converging — solving… (budget 640 work units)"
```
Each arm's full stop status is in `<arm>.stop-status.txt`, and every `[PROGRESS`/`[MEASURE` line is in `<arm>.measure.log`.

### Per-entry wall (15 s `[MEASURE tick]`s, `entrywall.py`; status sequences from `statuses.py`)

| run | 19 "L40 Chest" | 26 "L40 Boss Key 2" | 29 "L41 Totem 240,144" | 32 "L40 Totem 64,144" | 33 "L69 Lights" | 37 "L68 Health" |
|---|---|---|---|---|---|---|
| S1 | ~105 s SOLVED after a cut (19:1 640 cut `668f4ca7aff6` → 19:2 2560 `45b51fb7670b`) | ~420 s SOLVED after cuts (26:8 2560 via GSW `5975e38083d3`; 26:10 2560 `7841e235700c`) | ~390 s SOLVED (29:11 L40→L41 at 640 via KTA `5f46423586e1`) | ~390 s **SOLVED** (32:9 2560 `7839897c470f`; **32:10 640 solved `ac074b4b9d66`**; no 32:11/32:12) | ~180 s **SOLVED** (33:5 L61 `7ca39971ac20`) | ~142 s **REFUSED (+retry), the stop** (37:7 640 cut → 37:8 2560 `9c5ba5c37277`) |
| S2 | ~84 s **REFUSED (+retry), the stop** (640 → 2560 refused) | — | — | — | — | — |
| S3 | ~90 s SOLVED after a cut | ~600 s SOLVED | ~406 s SOLVED | ~375 s **SOLVED** (640 continue) | ~195 s SOLVED | ~127 s **REFUSED (+retry), the stop** |
| S4 | ~73 s SOLVED after a cut | ~495 s SOLVED | ~450 s SOLVED | ~421 s **SOLVED** (640 continue) | ~164 s SOLVED | ~128 s **REFUSED (+retry), the stop** |
| R1 | ~89 s SOLVED after a cut | ~435 s SOLVED | ~422 s SOLVED | ~420 s **SOLVED** (640 continue) | ~165 s SOLVED | ~133 s **REFUSED (+retry), the stop** |
| R2 | ~92 s SOLVED after a cut | ~587 s SOLVED | ~405 s SOLVED | ~465 s **SOLVED** (640 continue) | ~165 s SOLVED | ~122 s **REFUSED (+retry), the stop** |
| C1 (base) | ~105 s SOLVED after a cut | ~421 s SOLVED | ~422 s SOLVED | ~390 s **SOLVED** (640 continue) | ~180 s SOLVED | ~124 s **REFUSED (+retry), the stop** |
| C2 (base) | ~118 s SOLVED after a cut | ~555 s SOLVED | ~406 s SOLVED | ~400 s **REFUSED (+retry), the stop** (32:10 640 `cd02c0916e6c` refused; 32:11 640 cut → 32:12 2560 `599d2ef41b84`) | — | — |
| P1 (STACK, probe) | ~90 s SOLVED after a cut (19:2 `8e2c3dcc23fd`) | ~540 s SOLVED | ~420 s SOLVED | ~420 s **SOLVED** (32:10 640 `f2c760f195ad`, LHM moved) | ~165 s SOLVED | ~120 s **REFUSED (+retry), skipped** |

The statuses show that every run which passed 32 did so on the **"solving on from the held room… (budget 640)"** continue, with no 2560 retry
for the Totem. The 300 s backstop ended no entry.

## The L40 entry-32 table: 32:10 and 32:12

"Hits" is the page's `modelHits` on the winning pass, or the fresh replay's `hits` (they agree wherever both exist).

| request | arrival (seam) | env | answer | work | ticks | hits | the switch on its path (replay counters) |
|---|---|---|---|---|---|---|---|
| **S1 32:10** (page, STACK) | 79256 | STACK (live) | **solved `ac074b4b9d66`** | 471 | 613 | **0** | **PKSW** (`HAMMER_SAFETY` t1596 → `wait 0 solved`); DSS asks 1; LHM declined; PKRB asked 68 / refused 64 |
| S1 32:10 | 79256 | NOPKRB | solved `ac074b4b9d66` | 467 | 613 | 0 | PKSW (`refusedAt 1555 → wait 0 solved`); DSS 1; LHM declined |
| S1 32:10 | 79256 | base | **refusal `468697963324`** | 208 | — | — | "kill (spinner@192,128) by press … lands the player box … at (213.23,143.09) … (HAMMER_PHASE_RUNG)" |
| S1 32:12 | — | — | not asked (32:10 solved) | | | | |
| **P1 32:10** (page, STACK) | 81742 | STACK (live) | **solved `f2c760f195ad`** | 524 | 649 | **0** | PKSW (t1594 → solved); **LHM moved** (presser buttonroom@160,128 → (216,87), 129 t); DSS 1; PKRB 144/124 |
| **C2 32:10** (page, base) = re-measure-9 F1 32:10 (byte-identical) | 81985 | base (live) | **refusal `cd02c0916e6c`** | 220 | — | — | (= re-measure-9's live answer) |
| C2 32:10 | 81985 | **STACK** | **solved `851256c5b984`** | 361 | 926 | **1** (`t1799 chaser:bob@272,112`) | PKRB asked 101 / refused 74; PKSW rows empty |
| C2 32:10 | 81985 | NOPKRB | solved `353a67c41561` | 563 | 797 | **1** (`t1690 bomb:bombpusher@112,128#9`) | PKSW (`refusedAt 1652 → wait 0 solved`); DSS asks 2 |
| **C2 32:12** (page, base) = step 149 | — | base (live) | **refusal `599d2ef41b84`** | 2561 | — | — | (re-measure-9's stop, verbatim) |
| C2 32:12 | — | **STACK** | **solved `a404ddf42e41`** | 1866 | 1889 | **0** | **LHM** moved (t1553, presser buttonroom@160,128 → (248,103), 130 t); DSS 1 |
| C2 32:12 | — | NOPKRB | solved `a404ddf42e41` | 1866 | 1889 | 0 | LHM, the same |

re-measure-9's F1 32:10/32:12 (from its `F1.stop-requests.jsonl.gz`) replay to exactly the C2 rows above under each env.

**Every SOLVED L40 request under STACK in S1 is 0-hit on the page:**
| request | answer | work | ticks | hits | under base (replay) |
|---|---|---|---|---|---|
| 19:2 | `45b51fb7670b` | 1618 | 1338 | 0 | the same answer |
| 20:1 | `acb3a63487eb` | 65 | 494 | 0 | the same |
| 26:8 | `5975e38083d3` | 1143 | 1114 | 0 | the same (GSW `wait 50 ok`) |
| 26:10 | `7841e235700c` | 2561 | 4896 | 0 | the same |
| 29:11 (`wasm-exit-40`) | `5f46423586e1` | 642 | 1404 | 0 | the same |
| 30:1 (`wasm-exit-40`) | `0dbae91cd01f` | 35 | 70 | 0 | the same |
| 32:9 | `7839897c470f` | 2066 | 1449 | 0 | the same |
| 32:10 | `ac074b4b9d66` | 471 | 613 | 0 | **refusal** |
| 34:7 (`wasm-exit-40`) | `aa56d3fa3e0a` | 85 | 172 | 0 | the same |

P1's 19:2 (`8e2c3dcc23fd`, 1106 t), 32:9 and 32:10 are also 0-hit.

## The replay proof (`--n=3 --live`, `replay/*.txt`)

| request | env | REPLAY line | answers | = live? |
|---|---|---|---|---|
| **S1 37:8** (the S/R/C1 stop) | STACK / NOPKRB / base | `REPLAY: leg 37 request 8 (budget 2560): 1 distinct answer(s) over 3, 1 distinct trace(s)` (each) | refusal `9c5ba5c37277` ×3, 2062, in each env | yes |
| P1 37:8 (skip 1) | STACK | `REPLAY: leg 37 request 8 (budget 2560): 1 distinct answer(s) over 3, 1 distinct trace(s)` | refusal `9c5ba5c37277` ×3 | yes |
| **S1 32:10** | STACK | `REPLAY: leg 32 request 10 (budget 640): 1 distinct answer(s) over 3, 1 distinct trace(s)` | **solved `ac074b4b9d66`** ×3, 471 | yes |
| S1 32:10 | NOPKRB | the same line | solved `ac074b4b9d66` ×3, 467 | yes (the same answer) |
| S1 32:10 | base | the same line | **refusal** ×3, 208 | no (base refuses) |
| P1 32:10 | STACK | `REPLAY: leg 32 request 10 (budget 640): 1 distinct answer(s) over 3, 1 distinct trace(s)` | solved `f2c760f195ad` ×3, 524 | yes |
| **C2 32:10** (the bad arrival) | base | `REPLAY: leg 32 request 10 (budget 640): 1 distinct answer(s) over 3, 1 distinct trace(s)` | refusal `cd02c0916e6c` ×3, 220 | yes |
| C2 32:10 | STACK | the same line | **solved `851256c5b984`** ×3, 361, `modelHits {hits:1}` | — |
| C2 32:10 | NOPKRB | the same line | solved `353a67c41561` ×3, 563, `modelHits {hits:1}` | — |
| **C2 32:12** (the C2 stop, step 149) | base | `REPLAY: leg 32 request 12 (budget 2560): 1 distinct answer(s) over 3, 1 distinct trace(s)` | refusal `599d2ef41b84` ×3, 2561 | yes |
| C2 32:12 | STACK | the same line | **solved `a404ddf42e41`** ×3, 1866, `modelHits {hits:0}` | — |
| C2 32:12 | NOPKRB | the same line | solved `a404ddf42e41` ×3, 1866, 0 hits | — |
| **P1 38:6** (skip 2) | STACK / NOPKRB / base | `REPLAY: leg 38 request 6 (budget 2560): 1 distinct answer(s) over 3, 1 distinct trace(s)` (each) | refusal `e410e113fd01` ×3, 1876, in each env | yes |
| P1 39:1 (skip 3) | STACK | `REPLAY: leg 39 request 1 (budget 2560): 1 distinct answer(s) over 3, 1 distinct trace(s)` | refusal `6bd9d381b7df` ×3, 1876 | yes |

Stops not on file as requests:
- S2's entry-19 stop (capture OFF). Its text matches re-measure-9 P1 19:2 (`8ef0debe2bb9`), which refuses identically under STACK, NOPKRB and base
  (`counts-rm9P1-19-2-*.txt`; PKSW `not-asked`, "the refused kill ran 654 tick(s) from its first tick (bound 180)").
- The JS stop.

S2 was not re-run with capture ON. The budget went to C2 instead, which answered the base-defaults question.

## Then / now

| | re-measure-9 F (8bee4f279a, FLIP) | C (d8bd5bb578, base defaults = FLIP) | S (STACK) | R (NOPKRB) |
|---|---|---|---|---|
| runs | 4 (+2 A) | 2 | 4 | 2 |
| checked | 31 ×4 | **36, 31** | **36, 18, 36, 36** | **36, 36** |
| stop entry | 32 ×4 | 37 (C1), 32 (C2) | 37 ×3, 19 (S2) | 37 ×2 |
| cause | step 149 bombpusher hold `599d2ef41b84` | C1: L63 WandShot; C2: `599d2ef41b84` (step 149) | L63 WandShot ×3; S2: spinner@880,848 corner (step 66) | L63 WandShot |
| wall (`bot-plays`) | 3255–3524 s | 3908 s / 3403 s | 3940 / 1183 / 4045 / 4091 s | 3946 / 4100 s |
| entry 19 | 4/4 solved | 2/2 solved | **3/4 solved** (S2 refused) | 2/2 solved |
| entry 26 | 4/4 solved | 2/2 | 3/3 | 2/2 |
| entry 29 | 4/4 solved | 2/2 | 3/3 | 2/2 |
| entry 32 | **0/4** | **1/2** | **3/3** | **2/2** |
| entry 33 | not reached | 1/1 solved | 3/3 solved | 2/2 solved |
| first wall | 32 | 37 / 32 | **37** | **37** |
| JS | 8/48 | — | 8/48 (B1) | — |

## The next refusals, with captured-request ids

The ids are `run entry:i`. The survey list is re-measure-9's `survey-refused-rows.txt` minus step 155 (step 155 is SOLVED at the flip
tip, run 45734617454), and that subtraction is the only change made to it.

**The probe's real refusals (P1 spent 3 of its 10 skips on these; skips 4–10 were "no path from level_71__r0c6 to …", artefacts of the
skipped items):**

| # | entry | location | refusal (quoted) | request id | kind | still REFUSED at the flip tip? |
|---|---|---|---|---|---|---|
| 1 | 37 | Level 068 - Health, exit `level_63__r6c9 -> level_65__r0c8` | "levelRun: a WandShot in level 63 would collide with 5 Enemy-typed bod(ies) this run cannot place: grenade@128,128, darktrap@64,96, darktrap@80,64, darktrap@32,272, darktrap@128,272 …" | **P1 37:8** = **S1 37:8** `9c5ba5c37277` (37:7 640 cut `2e192645c34b`) | 2560 refusal, identical under every env; the stop in S1, S3, S4, R1, R2 and C1 | **No survey match** (no L63 row). Behind it on the same goal: **step 183** (L68 Health, "no corridor for goal collect-placement toward (8,8)") |
| 2 | 38 | Level 071 - Chest | "apitem (160,256) contact -> kill: the count is still waiting on [lavarunner@64,224] and no stance kills one of them in 1 attempt(s), each rewound (KILLLOCK_CHASER_REWIND) — lavarunner@64,224 at (24,296): hole 144-tick bound … PINNED on the solid …" | **P1 38:6** `e410e113fd01` (38:5 640 cut `4e1b1b95b577`) | 2560 refusal, identical under every env | **YES: step 189** (L71 Chest, "the count is still waiting on [lavarunner") |
| 3 | 39 | Level 074 - Darkshield, exit `level_71__r0c6 -> level_75__r13c3` | "reach-exit (96,0)->L75 -> kill: the count is still waiting on [lavarunner@64,224] … (KILLLOCK_CHASER_REWIND)" | **P1 39:1** `6bd9d381b7df` (39:0 `4b1365d82b5c`) | 2560 refusal | **YES: step 189** (its `teleporter@96,0 → L75` goal) |

**Refusals that the STACK walks met and recovered from** make up the rest of the ten. All are in `P1.capture-summary.txt`; S1's summary has the
corresponding rows.

| # | entry | refusal (quoted) | request id | survey |
|---|---|---|---|---|
| 4 | 37 | "levelRun: a wand shot (wand@60#115) reached the enemy \"jellyfish@56,64\" at tick 123 in level 60, and it is not a BossTotem …" (640; solved at 2560 `3bed738b3580` in S1) | P1/S1 37:3 `8f63b305b6aa` | — |
| 5 | 32 | "clear-tag {40,7} wandlock@208,128: 'hold' could not be resolved from (488,904): solverBot: no REACHABLE stance inside buttonroom@272…" (640; 2560 solves `7839897c470f`) | P1/S1 32:8 `ce350ba73e1d` | step 149's leg |
| 6 | 26 | "clear-tag {40,12} wandlock@480,560 -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED …" (640; solved at 2560 via GSW); then the BK2 continue cut `432ec5f5b196` at 640 and at 2560 | P1 26:8 `6a4eab62fe37`, 26:10/26:11 | step 96's leg (solved via GSW) |
| 7 | 20 | "apitem (160,640) contact: the combat ladder is EXHAUSTED. The corridor passes through danger at (524.8,680.7) — spinner:spi[nner…]" (continue; the fresh solve 20:1 succeeds) | P1 20:0 `72fb6ec7ac18` | step 66's leg |
| 7a | 19 | (S2 only, the stop) the spinner@880,848 corner, 2560 refusal | not on file (capture OFF); = re-measure-9 P1 19:2 `8ef0debe2bb9` | **YES: step 66** |
| 8 | 24 | "reach-exit (80,16)->L46: the re-planned corridor failed too — …" (the L58 yeti graze) | P1 24:7 `7a183280bda8` | **YES: step 111** |
| 9 | 9 | "reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> … CORRIDOR — the corridor meets chaser:wallflyer@64,80 … (CORRIDOR_LADDER_NEST 2)" (the JS stop; wasm recovers) | P1 9:7 `d777bfb2c075` | — |
| 10 | 16 | "reach-exit (144,304)->L37 -> hold: every responder in group t=2 [cover@208,224] is ALREADY OPEN before the hold begins …" | P1 16:0 `896d548c0b76` | — |

Also seen and recovered: 640-unit `shouldStop` cuts solved on the 2560 retry. These were `wasm-exit-39` (`bff14518fe9b`) at 26:6, 29:9, 32:6 and 34:5;
`wasm-exit-61` (`90a5b1d9deed`) at 28:5 and 37:5; and cuts at 16:7, 19:1, 23:6, 24:14, 26:12 and 38:5/39:0. Also 9:1 "no corridor … proximity-hazard:shieldlocknorm" (`79b4eae46c81`, work 2).

**Watch-list legs:**
- GSW `L71 flag 2: shieldlock@288,256`: L71 was reached in P1 (entries 38/39), but **no request, log or status mentions `shieldlock@288,256` or
  "L71 flag 2"**. The L71 stop is the lavarunner kill-lock (step 189). Not matched.
- PM `L101 flag 0: lightpole@144,64`: **not reached** (0 hits).
- No slow entry matches either one.

## Attribution (an env arm vs base cannot pin a move on one switch; these are the switches whose code the requests hit)

- **Past 32:10 on the good arrival** (S1, seam 79256): **`PRESS_KILL_START_WAIT`**. Its row is the only one that turns a refusal into `solved`.
  DSS (asks 1) and PKRB (STACK only) are also on the path, and LHM is asked and declines. NOPKRB gives the same answer, so PKRB is not needed here.
- **Past 32:12** (the step-149 latched bombpusher hold, C2 and re-measure-9's arrival): **`LATCHED_HOLD_MOVE`** (moves the presser hold; the same
  answer `a404ddf42e41` with and without PKRB).
- **Past 32:10 on the bad arrival**:
  - Under STACK, PKRB's counters are the only ones of the four that fire (asked 101 / refused 74; PKSW rows empty). It solves with 1 hit.
  - Under NOPKRB, PKSW fires (`refusedAt 1652 → wait 0 solved`) and DSS asks twice. It also solves with 1 hit.
- **Entry 33 (step 155)**: `BRIDGE_OPEN_STRAY`, base ON (waived ×6), the same under every env.
- **C1 passing 32 under base** is not explained by the requests on file. It drew an arrival we did not capture. S1's good-arrival 32:10
  refuses under base, so base's 1/2 is a different arrival again. The base is bimodal at 32: 1/2 here, 0/6 in re-measure-9.

## Evidence (`seedling-whole-game-wasm-remeasure-10-evidence/`, 12 MB total, no file over 5 MB)

- **Per arm** (`smoke`, S1–S4, R1, R2, C1, C2, B1, P1): `<arm>.measure.log`, `<arm>.summary.txt` and `<arm>.stop-status.txt`.
- **Capture arms:** `<arm>.capture-summary.txt` for smoke, S1, P1 and C2. Page hit tallies: `page-hits-S1-P1.txt` and `page-hits-C2.txt` (`hits.py`).
- **Stop and L40 requests:** `S1.stop-requests-19-26-29.jsonl.gz` and `S1.stop-requests-32-33-37.jsonl.gz`;
  `P1.stop-requests-19-32.jsonl.gz`, `P1.stop-requests-33-37.jsonl.gz` and `P1.stop-requests-38-39-47.jsonl.gz`; `C2.stop-requests-32.jsonl.gz`.
- **⚠ Dropped:** the full captures (S1 119 MB raw, P1 124 MB, C2 and the smoke). Only the stop-entry and L40 entry requests are kept, and the summaries list every row.
- ⚠ Commit `41822230` briefly held a 5.06 MB `S1.stop-requests.jsonl.gz`. The next commit split it in two. The blob stays in branch history; I did not rewrite it.
- **Replays:** `replay/` holds the `--n=3 --live` outputs and the `counts-*.txt` files.
- **Scripts:** `replays.sh`, `replays2.sh` and `replay-counts.mjs` (re-measure-9's, extended with the four switches' counters and a fresh-run ticks/hits
  replay as in `hammerPkswHitsRows.js`); `run-arm.sh`, `seq.sh`, `extract.sh`, `keep.py`, `entrywall.py`, `statuses.py` and `sumcap.py`.
- **Log:** `seq.log`, with the arms' start/rc/end lines.

## The criterion today

**Summary for Robert:** at `d8bd5bb578` with the STACK env, the whole-game wasm walk reaches **36/48 in 3 of 4 runs**, which is 5 entries past
re-measure-9's 31/48. It passes entry 32 in every run that got there.
- **The new first wall is entry 37**, the L63→L65 exit. Its refusal is *"levelRun: a WandShot in level 63 would collide with 5 Enemy-typed bod(ies) this
  run cannot place"*. It refuses identically under every env and matches no survey row. Behind it on the same goal, survey step 183 waits, and then
  step 189 (the L71 lavarunner kill-lock, which the probe met next).
- The fourth STACK run (S2) stopped at entry 19, on the step-66 spinner@880,848 corner. The stack does not touch that corner; PKH (OFF here) is the switch that
  cleared it in re-measure-9's replay.
- ⚠ **The walk alone does not credit the stack:** one of two base-defaults runs (C1) also reached 36/48.
- **The replays do credit it.** Both entry-32 arrivals on file refuse under base and solve under the stack:
  - the good arrival at 32:10 through **PKSW**, 0 hits;
  - re-measure-9's bad arrival at 32:12 (step 149) through **LHM**, 0 hits;
  - that same bad arrival's 32:10, at **1 hit**: chaser:bob@272,112 under STACK, a bombpusher bomb under NOPKRB. **This 1-hit plan is the one place the
    stack would take a hit that base does not (base refuses there).** No STACK walk drew it.
- On the page, STACK and base runs took the same single hit (5:7, L17), and every STACK L40 solve was 0-hit.
- **PKRB's marginal effect on the walk is nil** (R = S). In replay it only changes which hit the bad-arrival 32:10 takes.
- **JS stays at 8/48.**
- Before any landing or flip, the open items are:
  - the entry-37 WandShot staging refusal, which is now the first wall for every mode;
  - the step-66 corner at entry 19, the remaining bimodal stop before 32;
  - whether a 1-hit 32:10 on the bad arrival is acceptable under the no-hit bar.
