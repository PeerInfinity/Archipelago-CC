# Cloud report: `seedling-whole-game-wasm-remeasure-12`

**The whole-game Seedling wasm walk, seed 1, on `hammer-probe-rm12-all` @`d1725843a2`, with every hammer switch ON (ALL), the next OFF
landing's ON arm (CORE), and base defaults. MEASURE ONLY.**

Launcher: `seedling-hammer-phase-planning-17`. Ruling: Robert 2026-11-27, *"Re-measure-12 whole game"*. The harness pinned the branch
**`claude/whole-game-remeasure-12-vi66rx`**, and every push went there. Nothing was fixed, and **no code commit was made**: both
MEASUREMENT-ONLY knobs are already in the base (below). Everything committed is evidence and this report. **Not for landing.**

⚠ **Labels.** Every number is "at d1725843a2, ALL" (Arms A, B, P), "…, CORE" (Arm C) or "…, base defaults" (Arm L = the LHM flip).
- CORE = `SEEDLING_PRESS_KILL_START_WAIT=1;SEEDLING_PRESS_KILL_REFUGE_BOMBS=1;SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_OPP_AIM_CHASERS=1;SEEDLING_HIT_AVOID_STAND_BOMBS=1;SEEDLING_REFUSAL_STAND_BOMBS=1;SEEDLING_HIT_PLAN_RETRY=1;SEEDLING_KILLLOCK_PINNED_SPEAR=1;SEEDLING_PRESS_KILL_HOLD=1;SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO=1`
- ALL = CORE + `;SEEDLING_WAND_SHOT_TRAP_BODIES=1;SEEDLING_WAND_SHOT_ENEMY_BODIES=1;SEEDLING_AXE_TIMING_SWORD_SWAP=1`
- The walk is bimodal: every number is a sample ("k/N runs").

## Summary for Robert

- **ALL gets one entry further than re-measure-11, in 4/4 runs: 37/48.** It passes entry 37 (L63 WandShot) and stops at **entry 38 "Level 071 - Chest"**
  on a **new wall**: the L63 exit to L61 needs a spear-block shove that does not settle.
  > `solverBot(wasm-exit-63) reach-exit (0,96)->L61 -> shove (route step 1/4: press): 56 ticks after the thrust (tick 301) pushableblockspear@112,96 is at (112,96), not settled on (6,6).`

  It is a named refusal (work 518 of 640), so the page gives up with no retry. That is the same answer, `b111a61f68bb`, in A1 and P1, and 3/3 in replay.
  No switch rescues it: AXE is asked and refused (`asked 1, refused 1`), RSB reports `noLobber 1`, and KPS is not asked.
  Under base the same request stops earlier, on the WandShot check (`33d1bad340b8`, `grenade@128,128`). **The L71 lavarunner (step 189) is not reached, so KPS is not exercised on the walk.**
- **Entry 37 is solved by `AXE_TIMING_SWORD_SWAP` under the wand keys.** 37:7 refuses (`2e192645c34b`, a budget cut). 37:8 (the retry) solves as
  `6fc9184e21ed`: 0 hits, 617 ticks, and AXE `asked 1, certified 1` (gate `jellyfish@160,64`). Base and CORE refuse the same request as `9c5ba5c37277`.
  **L1's own base stop request, replayed under ALL, also solves as `6fc9184e21ed`.**
- **CORE stops at entry 37, 36/48, in 2/2 runs**, on the WandShot wall, as expected without the wand keys. Base (L1) does the same, 1/1.
- **Page hits: ALL ships 2 hits outside 5:7 in A1, and 1 in P1. CORE ships 1 in C1.** Every hit was replayed:
  - **37:9, L65 → L68, `b66bb6016c58`: 1 hit, `t665 chaser:bob@208,80`.** This is the known next wall, and **the page ships it** in A1 and P1 (both ALL).
    Base refuses that request (`95d1f625746d`); `HIT_AVOID_STAND_BOMBS` tried 1, replaced 0. No CORE or base run reaches it.
  - **24:3, the L57 exit (entry 24 "Level 089 - Feather"), `ea358a138d43`: 1 hit, `t863 tentacle:tentacle#41`**, in A1 (ALL) and C1 (CORE). **It is not a switch effect:**
    the request replays to the same 1-hit answer under base. A1 and C1 drew an arrival that L1 (`9a2dd6e53352`) and P1 (`8a33f7ace69c`) did not, and theirs are hitless.
  - 5:7 (`4ef7e74de551`, `chaser:bob@96,32`) is in every captured run, as in re-measure-11.
  - C1 26:7's flag is the full pass's stamp only. The shipped answer `5bb7994e268e` replays at **0 hits**.
- **Entry 19 passed hitless in every run** (all 9 wasm runs reach 36+).
  - A1 and C1 drew the corner arrival. **`PRESS_KILL_HOLD` solved it:** 19:2 is `85c7dc2a524c`, 0 hits, with PKH `refusedAt 654, wait 45 → solved`.
    Under base the same request refuses as `8ef0debe2bb9`, the re-measure-9/11 corner hash.
  - L1 and P1 drew the other arrival (`8e2c3dcc23fd`, 0 hits, no PKH needed).
- **18:11 passed hitless in every captured run, but no run drew re-measure-11's bad arrival** (seam 29994; these got 30052–30054), so
  **`HIT_PLAN_RETRY` never fired on the walk.** No capture holds a retry after a played answer.
  HPR is shown ON on the page's main thread separately (below).
- **JS (B1, ALL): 8/48, unchanged count, a NEW cause.** The stop is an L20 ShieldLock sub-order refusal (`shieldlocknorm@176,16 needs Player.hasShield`), not `CORRIDOR_LADDER_NEST 2`.
- **Skip probe P1 (ALL):** 37 real (+10 skipped). Its only real refusals are **38:2 and 39:0, both the same shove** (`b111a61f68bb`).
  Skips 3–10 are "no path" artefacts: the bot is stranded in `level_63__r0c1`.
- Heap: 656 MB flat in every wasm run. No OOM, no `RuntimeError`. The 300 s backstop ended no entry. **The container restarted once, mid-C1; C1 was re-run in full.**

## Base, subject and box

| | |
|---|---|
| base | **`d1725843a2`** = `origin/hammer-probe-rm12-all` |
| measured head | `ceea2ba0` (base + one docs commit: the runner scripts). From C1's re-run on: `ceea2ba0` + one evidence-only commit, pushed after C1 started (docs only; no `frontend/`/`scripts/` change). No arm's head differs from the base in any code file |
| wasm submodule `frontend/modules/flashPanel/wasm` | **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`** (the same pin as re-measure-6 through -11). `session_bootstrap.sh --all` → `[archcc-bootstrap] READY` |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` |
| box | The cloud container: 4 cores, 15 GB, headless Chromium, WebGPU via the batch's `webgpu: true`; every wasm run reports `transport=wasm`. Dev server `scripts/serve-nocache.py 8000`. One `npm test` per arm under the box lock = a fresh page per arm. The replays ran only after the last arm |
| row | `tutorial-walk-seedling-whole-game`, step `bot-plays`. Every row reads `PASSED`. **PASSED is not victory** |

### Switch defaults at BASE (from source @d1725843a2)
- **OFF** (`=== '1'`). In `solverBot.js`:
  - `:8325` `DASH_STAND_SIGHT`, `:16875` `OPP_AIM_CHASERS` and `:21279` `KILLLOCK_PINNED_SPEAR`;
  - `:22019` `PRESS_KILL_HOLD`, `:22131` `PRESS_KILL_HOLD_MODEL_UNDO`, `:22182` `PRESS_KILL_START_WAIT` and `:22223` `PRESS_KILL_REFUGE_BOMBS`;
  - `:28777` `AXE_TIMING_SWORD_SWAP`.
- **OFF** elsewhere:
  - `jsRuntimeSolver.js`: `:573` `HIT_AVOID_STAND_BOMBS` and `:624` `REFUSAL_STAND_BOMBS`;
  - `hitPlanRetry.js:30` `HIT_PLAN_RETRY` (`=== '1' || pageSolverEnvSwitchOn(...)`);
  - `contactFidelity.js`: `wandShotTrapBodies: false` / `wandShotEnemyBodies: false` (`:2621`/`:2663`), set by `SEEDLING_WAND_SHOT_TRAP_BODIES`/`_ENEMY_BODIES === '1'` (`:3127`/`:3130`).
- **ON:** `solverBot.js:12213` `LATCHED_HOLD_MOVE` (`!== '0'`), with BOS, GSW, PM, SPL and KTA as before.
- **All 13 names are in `SOLVER_ENV_NAMES`** (checked in node). Every replay's `enabled` line confirms the env:
  - under ALL: `PKSW=true PKRB=true DSS=true LHM=true PKH=true OAC=true PSB=false HSB=true RSB=true HPR=true KPS=true PKH_MU=true AXE=true WSTB=true WSEB=true BOS=true …`;
  - under base: the same with all 13 `false` and `LHM=true`.

## The capture and solver-env knobs (MEASUREMENT-ONLY)
- **Both knobs are already in the base**, as `58a65911` (capture) and `cd9c3719` (solver-env). They came in through the merged hammer branches.
- A cherry-pick of `0f6f207310`/`744e85dcd1` conflicted for exactly that reason, so I aborted it. The base copies are the same patches: **`git patch-id --stable`**
  gives `23401647d1d4` for `0f6f207310`, `58a65911` and re-measure-11's `5eb36ef5`, and `e49a598eaef5` for `744e85dcd1`, `cd9c3719` and `10a138a2`.
  `git range-diff` differs only in the `(cherry picked from …)` line.
- **OFF is byte-identical** (the same patch as re-measure-11's): with both env vars unset nothing is bound, imported or listened to, and no URL param is added.
  L1 logs no env worker URL, and its 232 captured answers all carry `solverEnv: null`.

## ⛔ Knob carriage: every switch reaches its thread
1. **Worker URL** (the smoke run, A1–A4, C1/C2, P1: one distinct env URL per run). Under ALL:
   `[MEASURE worker] http://localhost:8000/frontend/modules/seedlingDemo/jsRuntimeSolveWorker.js?seedlingSolverEnv=SEEDLING_AXE_TIMING_SWORD_SWAP%3D1%3BSEEDLING_DASH_STAND_SIGHT%3D1%3BSEEDLING_HIT_AVOID_STAND_BOMBS%3D1%3BSEEDLING_HIT_PLAN_RETRY%3D1%3BSEEDLING_KILLLOCK_PINNED_SPEAR%3D1%3BSEEDLING_OPP_AIM_CHASERS%3D1%3BSEEDLING_PRESS_KILL_HOLD%3D1%3BSEEDLING_PRESS_KILL_HOLD_MODEL_UNDO%3D1%3BSEEDLING_PRESS_KILL_REFUGE_BOMBS%3D1%3BSEEDLING_PRESS_KILL_START_WAIT%3D1%3BSEEDLING_REFUSAL_STAND_BOMBS%3D1%3BSEEDLING_WAND_SHOT_ENEMY_BODIES%3D1%3BSEEDLING_WAND_SHOT_TRAP_BODIES%3D1`.
   That is all 13 names, sorted.
2. **The stamp on every answer:** each capture holds exactly one distinct `solverEnv`.
   - A1: 231 answers and P1: 230, all stamped with the 13 names above.
   - C1: 222 answers, all stamped with the 10 CORE names.
   - L1: 232 answers, all `null`.
3. **The counters fire on the page's requests replayed under the same env**, and each replay reproduces the page's answer and work (table below):
   - PKH on 19:2;
   - AXE on 37:8 (certified) and 38:2 (refused);
   - RSB on 37:7, 38:2 and C1 37:8 (`refusals 1, noLobber 1`);
   - HSB on 37:9 (`tried 1, replaced 0`);
   - PKRB and OAC on 19:2 (`asked 168` / `asked 120`).
   - KPS and PKH_MU did not fire on any replayed request: their walls (L71, the PKH model-undo corner) were not met.
4. **HPR on the page's MAIN thread** (`hpr-page.cjs` → `hpr-page.txt`). This is a fresh Chromium page that loads the modules with A1's own `?seedlingSolverEnv=`, taken from A1's `PW DEBUG: URL:` line.
   ```
   HPR-PAGE A1-env {"search":"?seedlingSolverEnv=SEEDLING_PRESS_KILL_START_WAIT%3D1%3BSEEDLING_PRESS_KILL_REFU","HPR":true,"switchOn":true,"asks":true,"expiryAction":"retry"}
   HPR-PAGE none {"search":"","HPR":false,"switchOn":false,"asks":false,"expiryAction":"provisional"}
   ```
   `wasmPlayback.expiryAction` answers **`retry`** for a budget-cut plan billing 1 hit under A1's env, and `provisional` without it. On the walk itself
   no budget-cut answer billed a hit, so HPR never fired: no capture has a retry after a played answer.
5. **The JS frame (B1):** 14 worker URLs, 13 of them `jsRuntimeSolveWorker.js?seedlingSolverEnv=…` with all 13 ALL names; the other is `stateManagerWorker.js`.
   **Every worker switch reaches the JS frame**, and HPR reaches the main thread via the page URL. The capture does not wrap JS-frame services, so B1 has no answer stamp.
6. There is no `SOLVER_ENV:` line in the walk's output. That line is the divergence sweep's. The URL and the stamp above are the walk's equivalent; both list every name, sorted.

## Knobs, arms and order

| knob | value | arms |
|---|---|---|
| `--budget-s` / `--stall-s` | `10800` / `300` | all (the smoke: `--budget-s=150`) |
| `--solver-env` | ALL | smoke, A1–A4, B1, P1 |
| `--solver-env` | CORE | C1, C2 |
| (none) | base defaults | L1 |
| `--capture-requests` | `<jsonl>` | smoke, **A1**, **L1**, **C1**, **P1** |
| `--runtime=js` / `--skip-refusals=10` | | B1 / P1 |

**Order:** smoke (150 s, ON), **A2** (OFF), **A1** (ON), **C2** (OFF), **L1** (ON), **A3** (OFF), then C1 (ON), which was **cut off by a container restart**
at t=3330 s, entry 34 (log kept as `C1-interrupted.measure.log`). After the restart: **C1 re-run in full** (ON), **A4** (OFF), **B1**, **P1** (ON).
Then the replays (`replays.sh`) and the HPR page check. Runners: `run-arm.sh`, `seq.sh`, `seq2.sh`; log `seq.log`.

## Per-arm table

| run | env | capture | checked / total (bot) | snapshot | stop: region / entry | `bot-plays` walk (row) | region changes / pushes | heap |
|---|---|---|---|---|---|---|---|---|
| **A2** | ALL | OFF | **37/48** | 64 | `level_63__r0c1`, **entry 38 "Level 071 - Chest"** (the shove) | 4092 s (4094.7) | 278 / 180 | 656 flat |
| **A1** | ALL | ON | **37/48** | 64 | entry 38, the same | 4046 s (4049.4) | 278 / 179 | 656 flat |
| **A3** | ALL | OFF | **37/48** | 64 | entry 38, the same | 3890 s (3893.0) | 278 / 179 | 656 flat |
| **A4** | ALL | OFF | **37/48** | 64 | entry 38, the same | 3948 s (3950.5) | 278 / 179 | 656 flat |
| **C2** | CORE | OFF | **36/48** | 59 | `level_63__r6c9`, **entry 37 "Level 068 - Health"** (WandShot) | 4132 s (4134.8) | 269 / 175 | 656 flat |
| **C1** | CORE | ON | **36/48** | 59 | entry 37, the same | 4078 s (4080.9) | 269 / 175 | 656 flat |
| **L1** | base | ON | **36/48** | 59 | entry 37, the same | 3883 s (3885.8) | 269 / 176 | 656 flat |
| **B1** | ALL, JS | — | **8/48** | 12 | `level_20__r1c12`, entry 9 "Level 025 - Chest" | 260 s (263.1) | 41 / 30 | (js) heap 273 MB |
| **P1** | ALL, skip 10 | ON | 37/48 real (+10 skipped) | 64 | `level_63__r0c1`, entry 48 (no path) | 3933 s (3936.2) | 278 / 180 | 656 flat |

### The stop lines
A1 (A2–A4 are identical apart from timings and `jsHeapMB`):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 4049.4s
[MEASURE end] seedling-whole-game t=4046s step=bot-plays checked=64 botQueue=48 botCursor=37 botChecked=37 botHead="Level 071 - Chest" botRegion="level_63__r0c1" lastRegionEvent="level_63__r0c1" regionChanges=278 wasmPushes=179 transport=wasm wasmMemMB=656 jsHeapMB=215 status="error: level_63__r0c1: the bot cannot walk to exit \"level_63__r0c1 -> level_61__r0c7\" — the wasm playback failed: the solver declined level_63__r0c1 -> level_61__r0c7 in level 63 (refusal): solverBot(wasm-exit-63) reach-exit (0,96)->L61 -> shove (route step 1/4: press): 56 ticks after the thrust (tick 301) pushableblockspear@112,96 is at (112,96), not settled on (6,6)." walkEnd=failed walkStep=bot-plays …
```
This is no ladder EXHAUSTED: it is a one-line named refusal (dashless 188 + full 330 units).

C1 (C2 and L1 are the same):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 4080.9s
36/48, stop: entry 37 "Level 068 - Health" in level_63__r6c9, cause: refusal "error: level_63__r6c9: the bot cannot walk to exit \"level_63__r6c9 -> level_65__r0c8\" — the wasm playback failed: the solver declined level_63__r6c9 -> level_65__r0c8 in level 63 (refusal): levelRun: a WandShot in level 63 would collide with 5 Enemy-typed bod(ies) this run cannot place: grenade@128,128, darktrap@64,96, darktrap@80,64, darktrap@32,272, darktrap@128,272. `WandShot`'s ctor pushes \"Enemy\" onto its own solids, …
```
B1:
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 263.1s
8/48, stop: entry 9 "Level 025 - Chest" in level_20__r1c12, cause: refusal "error: level_20__r1c12: the bot cannot walk to location \"L20 flag 4: lock@32,80 cleared\" — the JS runtime's walk failed: the solver declined — solverBot(js-runtime-L20-location) clear-tag {20,4} lock@32,80 -> hold stance -> touch: shieldlocknorm@176,16 needs `Player.hasShield`, which this run does not hold — `ShieldLock.update`'s arm is `if (p && !activate && Player.hasShield)` and this run does not hold it. The item is a SUB-ORDER the macro layer owes, not a parameter of this verb. — solving… (budget 640 work units)"
```
P1: `64/48 (+10 skipped), stop: entry 48 "Level 115 - The Seed" in level_63__r0c1, cause: refusal "error: no path from level_63__r0c1 to level_115__r4c4, nor from the restart target Menu"`.

## Per-entry wall (captured runs; the request the walk acted on)
`work` is in units; `ticks` and `hits` are the page's own per-pass `modelHits` (dashless/full). R = the request indices that refused (+retry).
Every wasm run (all 9) passes entries 18–33, and every A run passes 37. Uncaptured runs (A2–A4, C2) have no per-request record.

**A1 (ALL)**
| entry | request | outcome | work | ticks | hits | R |
|---|---|---|---|---|---|---|
| 18 L39 Totem 72,40 | 11 location-39 | SOLVED `a52db2c93b64` | 642 (budget-cut, provisional) | 3345 | dashless:0 | — |
| 19 L40 Chest | 2 location-40 (retry) | SOLVED `85c7dc2a524c` (**PKH**) | 1715 | 1642 | full:0 | 1 |
| 26 L40 Boss Key 2 | 13 location-40 (retry) | SOLVED `535a61951b01` | 2561 | 4491 | dashless:0 | 6, 8, 10, 11(retry), 12 |
| 29 L41 Totem 240,144 | 12 location-41 | SOLVED `5b74f789f125` | 532 | 2329/2271 | 0/0 | 9 |
| 32 L40 Totem 64,144 | 10 continue-location-40 | SOLVED `544ae8f4e47f` | 506 | 770/649 | 0/0 | 6, 8 |
| 33 L69 Lights | 10 location-69 | SOLVED `6c867365c93e` | 69 | 837/544 | 0/0 | — |
| 37 L68 Health | 10 location-68 | SOLVED `a43e32edf06d` (via 37:8 **AXE** `6fc9184e21ed`, 0 h, and 37:9 `b66bb6016c58`, **1 h**) | 97 | 184/184 | 0/0 | 3, 5, 7 |
| 38 L71 Chest | 2 exit-63 | **REFUSED** `b111a61f68bb` (the shove) | 518 | — | — | 2 |

**C1 (CORE):** entries 18–29 are as in A1, with the same hashes. Then:
- 32: `220b1ce5f837` (564, 0 h).
- 33: `99f0972d6040`.
- **37: REFUSED 37:8 (retry) `9c5ba5c37277`**, work 2062. R: 3, 5, 7, 8(retry).

**L1 (base):**
- 18: `2e1603a6ae22` (641, 0 h).
- 19: `8e2c3dcc23fd` (retry, 0 h; the other arrival).
- 26 and 29: as A1.
- 32: 32:12 `a404ddf42e41` (1866, 0 h, LHM).
- 33: `f86ed980fe63`.
- **37: REFUSED `9c5ba5c37277`.**

**P1 (ALL):**
- 18: `8a6d384ce84e` (642, 0 h).
- 19: `8e2c3dcc23fd` (0 h).
- 26: `3cd83d17453b` (2561, 0 h).
- 29: as A1.
- 32: `4bc060578f8b` (390, 0 h).
- 33: `92fc88a63158`.
- 37: `a43e32edf06d` (37:8 `6fc9184e21ed`, AXE; 37:9 `b66bb6016c58`, 1 h).
- **38: REFUSED 38:2 `b111a61f68bb`**.
- **39 "Level 074 - Darkshield": REFUSED 39:0 `b111a61f68bb`** (the same exit request).

No entry was ENDED BY THE BACKSTOP in any run. Entry 26's 2561 is the held retry's budget cut, and it played its plan (provisional, 0 h).

**Which switch fired at each entry:**
- **18:x:** none of the counters fired on 18:11, and HPR never retried (the arrival was hitless).
- **19:x:** `PRESS_KILL_HOLD` (A1, C1 19:2: `{"t":0,"stand":636,"refusedAt":654,"tries":[{"wait":45,"verdict":"solved"}]}`) plus PKRB `asked 168` and OAC `asked 120, withheld 0`. L1 and P1 drew an arrival that needs no switch.
- **37:x:** `AXE_TIMING_SWORD_SWAP` (37:8: `asked 1, certified 1, landings [{t:351,n:112,gate:"jellyfish@160,64",hit:0},{t:358,n:119,whole:true,hit:0}]`), with the wand keys letting the WandShot through. RSB `refusals 1, noLobber 1` on 37:7.
- **38:x / 39:x:** AXE `asked 1, refused 1`; RSB `noLobber 1`; KPS `asked 0`. None helps.

### Every answer with a page hit (captured runs; `hits.py` over every solved answer, all of which carry `modelHits`)
| run | answer | goal | hash | hits (replayed under the run env) | under base |
|---|---|---|---|---|---|
| A1 | 5:7 | continue-exit-16 | `4ef7e74de551` | 1 `t273 chaser:bob@96,32` | the same |
| A1 | **24:3** | exit-57 | `ea358a138d43` | 1 `t863 tentacle:tentacle#41` | **the same** (not a switch effect) |
| A1 | **37:9** | exit-65 | `b66bb6016c58` | 1 `t665 chaser:bob@208,80` | refuses `95d1f625746d` |
| C1 | 5:7 | | `4ef7e74de551` | 1 | the same |
| C1 | **24:3** | exit-57 | `ea358a138d43` | 1 tentacle | the same |
| C1 | 26:7 | exit-39 (retry) | `5bb7994e268e` | **0** (the full pass's stamp billed 1; the shipped plan is hitless) | the same, 0 |
| L1 | 5:7 | | `4ef7e74de551` | 1 | — |
| P1 | 5:7 | | `4ef7e74de551` | 1 | the same |
| P1 | **37:9** | exit-65 | `b66bb6016c58` | 1 bob@208,80 | refuses |

**Hits an A/C run takes that L does not:** 37:9 (A1, P1). L never reaches it, and base refuses that request.
24:3 is arrival-dependent: A1 and C1 drew it; L1's L57 exit is `9a2dd6e53352` and P1's `8a33f7ace69c`, both 0 h.
**Per run, outside 5:7:** A1 2 (24:3, 37:9); P1 1 (37:9); C1 1 (24:3); L1 0. Capture was OFF in A2–A4 and C2, so their hits are not on file.

## Replay proof (`replay-seedling-solve-request.mjs --n=3 --live`, plus `replay-counts.mjs`)
All replays give 1 distinct answer and 1 distinct trace over 3. The **run env** column is ALL for A1/P1 and CORE for C1; "base" is no SEEDLING env.
`REPLAY:` reads `leg <e> request <i> (budget …): 1 distinct answer(s) over 3, 1 distinct trace(s)` in every file.

| request | run env → answer (work, ticks, hits) | base → answer | live |
|---|---|---|---|
| A1 38:2 (stop) | `b111a61f68bb` refusal (518) | `33d1bad340b8` refusal (354, WandShot `grenade@128,128`) | `b111a61f68bb` |
| C1 37:8 (stop) | `9c5ba5c37277` refusal (2062) | `9c5ba5c37277` | `9c5ba5c37277` |
| L1 37:8 (stop) **under ALL** | **`6fc9184e21ed` solved (2309, 617 t, 0 h)** | `9c5ba5c37277` | `9c5ba5c37277` |
| A1 37:7 | `2e192645c34b` refusal (644) | the same | the same |
| A1 37:8 | `6fc9184e21ed` (2309, 617 t, 0 h) | `9c5ba5c37277` refusal | `6fc9184e21ed` |
| A1 37:9 (hit) | `b66bb6016c58` (346, 695 t, **1 h** bob@208,80) | `95d1f625746d` refusal (95) | `b66bb6016c58` |
| A1 24:3 / C1 24:3 (hit) | `ea358a138d43` (337, 1530 t, **1 h** tentacle#41) | `ea358a138d43` (282, 1 h) | `ea358a138d43` |
| L1 24:3 | `f51292dd0c6d` (134, 280 t, 0 h) | the same | the same |
| C1 26:7 | `5bb7994e268e` (1468, 2567 t, **0 h**) | the same | the same |
| A1 5:7 (hit) | `4ef7e74de551` (182, 161 t, 1 h bob@96,32) | the same (170) | the same |
| A1 18:11 | `a52db2c93b64` (642, 3345 t, 0 h) | the same | the same |
| A1 19:1 | `8007b96643fd` refusal (642) | the same | the same |
| A1 19:2 | **`85c7dc2a524c` (1715, 1642 t, 0 h; PKH)** | **`8ef0debe2bb9` refusal (896)** | `85c7dc2a524c` |

⚠ HPR lives on the page: a node replay shows the worker's answer, not HPR's retry. Here that never matters, because no captured answer was a budget cut billing a hit.
Full outputs: `replay/`, summarised in `replay-table.txt`.

## The L40 entry-32 table (32:10 / 32:12)
| run | 32:10 (continue-location-40) seam → answer | 32:11 / 32:12 |
|---|---|---|
| A1 (ALL) | 79629 → **SOLVED `544ae8f4e47f`** (0 h) | — |
| C1 (CORE) | 81795 → **SOLVED `220b1ce5f837`** (0 h) | — |
| P1 (ALL) | 78711 → **SOLVED `4bc060578f8b`** (0 h) | — |
| L1 (base) | 81742 → refused `4fa2ec303932` | 32:11 refused `4af59f364225`; **32:12 SOLVED `a404ddf42e41`** (1866, 0 h, LHM; = re-measure-11 L1) |

## Then / now
| | rm-11 S (FIVE, 4 runs) | rm-11 L (base, 2) | **A (ALL, 4)** | **C (CORE, 2)** | **L (base, 1)** |
|---|---|---|---|---|---|
| checked | 36/48 ×3, 18/48 ×1 | 36/48 ×2 | **37/48 ×4** | 36/48 ×2 | 36/48 ×1 |
| stop entry | 37 ×3, 19 ×1 | 37 ×2 | **38 ×4** | 37 ×2 | 37 |
| cause | L63 WandShot; S4 L40 spinner@880,848 corner | WandShot | **L63 shove: pushableblockspear@112,96 not settled** | WandShot | WandShot |
| wall | 3731–3802 s; S4 1147 s | 3748–3865 s | 3890–4092 s | 4078–4132 s | 3883 s |
| entry 18 | S1 18:11 1 hit (seam 29994) | 0 h | 0 h (A1, P1) | 0 h (C1) | 0 h |
| entry 19 | S4 stopped there | passed | passed 4/4; **PKH solved the corner** (A1) | passed 2/2; **PKH** (C1) | passed (other arrival) |
| entry 32 | passed 3/3 | passed 2/2 | passed 4/4 | passed 2/2 | passed (32:12, LHM) |
| entry 37 | refused | refused | **solved 4/4 (AXE + wand keys)** | refused | refused |
| entries 38/39 | (skip probe) L71 lavarunner | — | **refused: the L63 shove** | — | — |
| hits outside 5:7 (captured runs) | S1: 18:11 | 0 | A1: 24:3, 37:9; P1: 37:9 | C1: 24:3 | 0 |
| JS | 8/48 (`CORRIDOR_LADDER_NEST 2`) | | **8/48 (L20 ShieldLock sub-order)** | | |

## The next refusals (skip probe P1, ALL, `--skip-refusals=10`)
| skip | entry | request | cause |
|---|---|---|---|
| 1 | 38 "Level 071 - Chest" | **38:2** `wasm-exit-63` | the shove, `b111a61f68bb` |
| 2 | 39 "Level 074 - Darkshield" | **39:0** `wasm-exit-63` | the same, `b111a61f68bb` |
| 3–10 | 40 Darksuit, 41 L63 Chest, 42 L80 Chest, 43 King of Fire, 44 L98 Chest, 45 Ghostsword, 46 Firewand, 47 Owl | none (no solve request) | `no path from level_63__r0c1 to …, nor from the restart target Menu`: artefacts of being stranded behind the shove |

So the skip probe names **one real wall past 37: the L63 → L61 shove**, which shadows everything after it, including the L71 lavarunner (KPS's subject).

## Evidence (`seedling-whole-game-wasm-remeasure-12-evidence/`, 13 MB)
- Per arm: `<arm>.measure.log` and `<arm>.summary.txt` (the last 40 lines). For the captured arms, `<arm>.page-hits.txt` and `<arm>.capture-summary.txt` (every request; env stamps elided to `…`; stamps were verified before eliding).
- Requests (gzip). The full captures are 111–123 MB each, so only these entries are kept:
  - A1: 5, 18 and 19, 24, 37, 38;
  - C1: 24, 26, 37;
  - L1: 32, 37;
  - P1: 38, 39.
  Dropped: every other entry of every capture, and the whole smoke capture.
- `replay/` (36 files) and `replay-table.txt`; `hpr-page.cjs` / `hpr-page.txt`; `C1-interrupted.measure.log`.
- Scripts: `run-arm.sh`, `seq.sh`, `seq2.sh`, `replays.sh`, `replay-counts.mjs` (+ RSB, KPS, PKH_MU, AXE, wand keys, HPR), `entrytable.py`, `replay-table.py`, plus re-measure-11's helpers.

## The criterion today

**Summary for Robert:** at d1725843a2 with everything ON (ALL), the whole-game wasm walk reaches **37/48 in 4/4 runs**, one entry further than
re-measure-11 (36/48). Three slices landed their walls on the walk:
- **PKH** solved the entry-19 L40 corner hitlessly (A1, C1);
- **AXE under fidelity's wand keys** solved entry 37 hitlessly (all four A runs, and L1's own base stop replayed under ALL);
- the L39 18:11 hit did not recur. No run drew its bad arrival, so **HPR is shown ON on the page's main thread but was not exercised on the walk**.

The **next wall is entry 38: the L63 → L61 exit's spear-block shove** (`pushableblockspear@112,96 … not settled on (6,6)`). It is a named refusal
that no switch rescues, and it shadows the L71 lavarunner, so **KPS was not reached**. ALL **ships the known L65 → L68 hit** (`b66bb6016c58`, 1 hit,
`chaser:bob@208,80`) in 2/2 captured A runs. Outside 5:7, the only other page hit is 24:3's tentacle hit, which is arrival-dependent and identical under base.
**CORE stops at entry 37 in 2/2**, as expected; its one hit outside 5:7 is that same 24:3. Base (the LHM flip) stays at 36/48. JS stays at 8/48, on a new cause:
the L20 ShieldLock sub-order. The bimodality seen at entries 19 and 32 is now absorbed: every run passed both, hitless.
