# Cloud report: `seedling-whole-game-wasm-remeasure-4`

**The whole-game Seedling wasm walk again, after the WALLFLYER_KILL_ARM flip, Fire breaks rocks and the corpse flip. MEASURE ONLY.**

Launcher: `seedling-js-planning-21` (js-21). Rulings: Robert, 2026-11-15 (transcript c54da6ff): step 35 first, then
re-measure-4 "After step 35 AND Fire land", "After the corpse flip". Branch: **`claude/whole-game-wasm-remeasure-4-4c4thl`**
(the harness pinned it; no plain `seedling-whole-game-wasm-remeasure-4` branch was pushed). Nothing was fixed. No solver, bot,
wasm, `vendor/seedling`, preset or rules file was changed. The commits are the re-applied MEASUREMENT-ONLY instrument, the run
extracts (`seedling-whole-game-wasm-remeasure-4-evidence/`) and this report.

Previous: re-measure-3 (`claude/whole-game-wasm-remeasure-3-c2de9z` @`2c77a8f9bb`, base `c82f413c87`) and re-measure-2 (base
`2301163914`; its branch `claude/whole-game-wasm-remeasure-2rp6cp` no longer exists on origin, so its numbers below are as
quoted in re-measure-3's then-column).

## Headline

**The walk got past L22→L29 again, and went further than it ever has: 24/48 on wasm seed 1 (was 9/48, and 18/48 before that).**
- **Seed 1, wasm: 24/48, 4 of 4** (A1, A2, and the skip probe up to its first skip; the first probe attempt was killed at
  510 s and is not counted). Entry 10 (L22→L29, survey step 35) now plays as a **609-tick** plan, solved in the first 640-unit
  budget. The walk then goes on through Boss Key 1, L30, Bob Boss, L38, L39, the **L40 chest (entry 19, which passed after a
  2560-unit held retry)**, L46, L48 and Boss Key 3 (L55).
- **The new first wall: entry 24/48, "Level 089 - Feather", in L58.** The route to `level_89__r1c10` needs the yeti
  `flag:L58:1` cleared, and the page's mapper refuses that event: *"no-verb: no strategy row exists for solid:yeti — the
  catalogue names no verb that clears it"*. This is exactly YETI-TALK's finding (`seedling-hammer-yeti-talk.md`). The cure is
  already on main, but behind a switch that ships OFF: `jsRuntimeSolver.TALK_CLEAR_GOAL_DEFAULT = false` (`SEEDLING_TALK_CLEAR_GOAL`,
  `jsRuntimeSolver.js:689–692`). YETI-TALK's own walk, with it ON, passed L58 and stopped next at L91's drill.
- **"Did it get past L40 Boss Key 2 (entry 19)?"** ⚠ The queue changed under that label. In this walk, **entry 19 is "Level 040 -
  Chest"** (sphere 6.8), and it **passed** (first seen 2059 s; the walk was in entry 20 by 2220 s). The location named **"Level 040 -
  Boss Key 2" is now entry 26** (sphere 7.3), behind the L58 wall, so it was **not reached**. Re-measure-2's stop "entry 19
  'Level 040 - Boss Key 2'" was a budget stop on that L40 entry, and the L40 entry at position 19 now passes.
- **JS control (Arm B): 8/48, entry 9**, on L22→L25, `CORRIDOR_LADDER_NEST 2` against `chaser:wallflyer@64,80`. That is walk
  check 2's JS stop recurring, word for word. JS-only: wasm plays the same exit as a 113-tick walk.
- **Seed 2 (a different game, see below): 4/48, entry 5.** Walk check 2's deterministic playback stall recurs: a solved 858-tick
  `level_12__r0c37 -> level_21` walk frozen at tick 1/858 from 450 s until the 300 s bot stall ended the run. No refusal.
- No OOM: the wasm heap was a flat 656 MB in every wasm run (200, 214, 198 and 49 samples). No `RuntimeError`. The only console
  error is the usual boot-time `404`. No harness clock decided any stop.

## Base and subject

| | |
|---|---|
| base | **`4e0eab72153981f8dd2a21a16694e41e1297025c`** = main at train 136 ("train: fidelity-flip-wallflyercorpse a4bb02772b") |
| instrument | `e8bcc583` (re-measure-3's re-application of `f232811c`) cherry-picked **cleanly** onto the base, giving **`d6b6aed4d`** ("MEASUREMENT-ONLY: knobs + sampler …"): 4 files, +124/−5 (`tutorialTests.js` +102, `seedling.js` 4, `procgen.js` 6, `app.spec.js` +17), the same diff as every earlier measure. Not for landing |
| flip live at BASE | `solverBot.js:24809`: `enabled: globalThis.process?.env?.SEEDLING_WALLFLYER_KILL_ARM !== '0',` and `:24811` `WALLFLYER_KILL_ARM_DEFAULT = true;` (ON unless `=0`). `contactFidelity.js:2064`: `wallFlyerCorpseGone: true,` |
| wasm submodule `frontend/modules/flashPanel/wasm` | **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`**, the same pin as all earlier measures. `session_bootstrap.sh --all` → READY, "seedling wasm builds: OK (4 dirs)", "pip headless … OK", tree clean |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` (unchanged) |
| box | the cloud container: headless Chromium. WebGPU comes from the batch's `webgpu: true`, and every wasm run reports `transport=wasm`. Dev server `scripts/serve-nocache.py 8000`, one run at a time under the box lock, a fresh page per run (each run is its own `npm test`) |
| row | `tutorial-walk-seedling-whole-game`, batch `tutorials-seedling-whole-game` (MANUAL, WebGPU), step `bot-plays` |
| seed 2 | `python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2` → **`AP_01043188731678011336`** (the expected id). The page loads it as level set **`seedling-ap-record-5f705e09`** (re-measure-3: `…45602886`), so the placements differ: a **different game** (`worlds/seedling_playthrough` was regenerated, as walk check 2 §5 says). Generated in the tree and never committed. Afterwards I reverted `preset_files.json` and deleted the preset dir and `output/AP_01043188731678011336.zip`; `git status` was clean |

Order: A1, A2, B1, probe (attempt 1 killed), probe, generate seed 2, A′1. A1, A2, B1 and the probe ran at head `d6b6aed4d`
with "0 tracked change(s) frozen". A′ ran with 1 (the `preset_files.json` entry), as every time before. No commit was made while
a run held the box lock.

⚠ **Disclosure:** the first skip-probe attempt was killed at t=510 s, when the tool hit its 2 h background limit on the
wrapper running A1→A2→B1→probe. The run was in entry 6 and had measured nothing new
(`P1-killed-at-510s.measure.log`). I re-ran the probe detached from that limit. The re-run is the one reported.

## Knobs (identical to re-measure-2 and re-measure-3)

| knob | value | arms |
|---|---|---|
| `TEST_AUTO_START_TIMEOUT_MS` | `10800000` | all |
| `TEST_TIMEOUT` | `11000000` | all |
| `TEST_MEASURE_STEP_TIMEOUT_MS` | `10800000` | all |
| `TEST_MEASURE_BOT_STALL_MS` | `300000` | all |
| `TEST_MEASURE_PLAYTHROUGH_SEED` | `2` | A′ |
| `TEST_MEASURE_FLASH_RUNTIME` | `js` | B |
| `TEST_MEASURE_SKIP_REFUSALS` | `10` | probe |

Command: `npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game` with the env above (`run-arm.sh` in the
evidence dir). No `?seedlingSolverEnv=` was passed: every arm runs the shipped defaults (budget 640, held retry 2560;
WALLFLYER_KILL_ARM ON, wallFlyerCorpseGone ON, TALK_CLEAR_GOAL OFF). Arm B could not take a SEEDLING_* knob anyway (walk check 2
§5: the JS runtime frame never sees `?seedlingSolverEnv=`), so B runs at defaults by construction. Every row reads `PASSED`
because the ratchet grades it against `firstFailingStep: 'bot-plays'`. **PASSED is not victory.**

## Arm A: wasm, seed 1 (vanilla)

| run | checked / total (bot) | snapshot | last sphere | stop: region / entry | cause by name | `bot-plays` wall | region changes / wasm pushes | heap |
|---|---|---|---|---|---|---|---|---|
| A1 | **24/48** | 39 | 6.12 done; stopped in 6.13 | `level_58__r3c3`, **entry 24/48 "Level 089 - Feather"** (target `level_89__r1c10`), on the prerequisite "breaking yeti@56,56 first (flag:L58:1)" | page mapper refusal: *"the solver has no goal for L58 flag 1: yeti@56,56 cleared … no-verb: no strategy row exists for solid:yeti"* | 2988.8 s (row 3003.7 s) | 140 / 94 | 656 MB flat (200 samples) |
| A2 | **24/48** | 39 | 6.12; stopped in 6.13 | same | same, verbatim | 3197.6 s (row 3213.4 s) | 140 / 93 | 656 MB flat (214) |

A1 and A2 agree, so no 3rd run was needed. The probe hit the same refusal at 2956 s (140 region changes), so it is 3 of 3.

Timeline (entry first seen @ s / region changes). A1: `1@15s/r2 3@195s/r14 4@225s/r19 5@285s/r22 6@390s/r34 8@495s/r39
9@510s/r41 10@765s/r54 11@825s/r57 12@870s/r59 14@975s/r62 15@1245s/r72 16@1425s/r77 17@1575s/r87 18@1605s/r92 19@2059s/r105
20@2220s/r105 21@2265s/r108 22@2520s/r117 23@2595s/r122 24@2820s/r136`. A2 is the same sequence, 2–8 % slower
(`10@900s … 19@2191s … 24@2985s`).

Entry names seen: 1 L010 Sword, 3 L086 Chest, 4 L036 Chest, 6 L019 Boss Key 0, 8 L020 Shield, 10 L029 Boss Key 1, 11 L030
Torchpickup, 12 L032 Bob Boss, 14 L012 Chest, 15 L038 Chest, 18 L039 Totem Part 72,40, **19 L040 Chest**, 20 L040 Totem Part
160,640, 21 L046 Chest, 22 L048 Chest, 23 L055 Boss Key 3, 24 L089 Feather.

**Entry 10 (the step-35 wall) now plays.** A1: t=765 "routing via "level_22__r0c6 -> level_29__r2c2" → level_29__r2c2 (10/48)
— solving… (budget 640 work units)"; t=780 "playing tick 207/609"; t=810 in `level_29__r2c2` "walking to "Level 029 - Boss
Key 1" (10/48) — playing tick 63/128"; t=825 in `level_31__r24c10` (entry 11). It needed no held retry. The plan is 609 ticks
(hammer's node measure for step 35 was 539; the page plans from the walk's own arrival state).

Entry 10 arrives ~120 s later than at re-measure-3 (765 s vs 645 s), because the route to L25 (entry 9) now goes `level_12__r0c37 ->
level_21` as a **2564-tick** walk (t=570–700 s). That is the same exit on which seed 2 stalls (below); on seed 1 it plays through.

**Entry 19, "Level 040 - Chest"**: t=2059 first seen; t=2070 "solving… (budget 640 work units)"; t=2085 "solving again, the room
held… (budget 2560 work units, retry 1)"; it passed, and entry 20 was first seen at 2220 s.

The stop (A1):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 3003.7s
[tutorial-walk-timing] seedling-whole-game: load 3.7s, start-game-page 6.3s, start-game 1.6s, bot-plays-open 0.5s, bot-plays 2988.8s
[MEASURE end] seedling-whole-game t=3001s step=bot-plays checked=39 botQueue=48 botCursor=23 botChecked=24 botRegion="level_58__r3c3" lastRegionEvent="level_58__r3c3" regionChanges=140 wasmPushes=94 transport=wasm wasmMemMB=656 jsHeapMB=169 status="error: level_58__r3c3: the bot cannot walk to location \"L58 flag 1: yeti@56,56 cleared\" — the wasm playback failed: the solver has no goal for L58 flag 1: yeti@56,56 cleared: \"L58 flag 1: yeti@56,56 cleared\" is a saved-obstacle EVENT (clear-tag {58,1} yeti@56,56): the solver's clear-tag refuses it — no-verb: no strategy row exists for solid:yeti — the catalogue names no verb that clears it. Its check stays the game's persistence flag {58,1} turning set, which nothing but the game writes"
```
The lead-in: t=2880–2970 "routing via "level_57 -> level_58__r4c1" → level_89__r1c10 (24/48) — playing tick …/1830", then
t=3000 "Sphere 6.13 → breaking yeti@56,56 first (flag:L58:1) — the route to level_89__r1c10 (24/48) needs it".

A2:
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 3213.4s
[tutorial-walk-timing] seedling-whole-game: load 4.2s, start-game-page 6.7s, start-game 1.7s, bot-plays-open 0.7s, bot-plays 3197.6s
[MEASURE end] seedling-whole-game t=3211s step=bot-plays checked=39 botQueue=48 botCursor=23 botChecked=24 botRegion="level_58__r3c3" lastRegionEvent="level_58__r3c3" regionChanges=140 wasmPushes=93 transport=wasm wasmMemMB=656 jsHeapMB=169 status="error: level_58__r3c3: … [the same text as A1, verbatim]"
```
This stop is not ladder-EXHAUSTED: the status string carries the full refusal, which matches the console warning
(`stop-refusals.console.txt`, quoted from the console log).

## Arm A′: wasm, randomized seed 2 (`AP_01043188731678011336`, level set `seedling-ap-record-5f705e09`: a DIFFERENT game from re-measure-3's)

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes | heap |
|---|---|---|---|---|---|---|---|---|
| A′1 | **4/48** | 5 | 1.7 done; stopped in 1.8 | `level_12__r0c37`, entry **5/48** (target `level_25__r2c7`), exit `level_12__r0c37 -> level_21` | **no refusal**: the solved 858-tick walk sits at "playing tick 1/858" from t=450 s; the 300 s bot stall ends the run | 727.7 s (row 741.1 s) | 28 / 23 | 656 MB flat (49) |

This is walk check 2's stall, recurring (it saw 2 of 2; this is the 3rd). As the brief asks, I did not diagnose it.
Timeline: `1@15s/r2 2@180s/r11 3@195s/r14 4@225s/r19 (L012 Chest) 5@435s/r28`.
```
[MEASURE tick] t=435s … botChecked=4 … regionChanges=28 … status="Sphere 1.8 → routing via \"level_12__r0c37 -> level_21\" → level_25__r2c7 (5/48) — playing tick 1502/1508"
[MEASURE tick] t=450s … status="Sphere 1.8 → routing via \"level_12__r0c37 -> level_21\" → level_25__r2c7 (5/48) — playing tick 1/858"
[MEASURE tick] t=465s … "… playing tick 1/858"   (and every 15 s through t=735s: the same)
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 741.1s
[tutorial-walk-timing] seedling-whole-game: load 3.7s, start-game-page 5.4s, start-game 2.1s, bot-plays-open 0.1s, bot-plays 727.7s
[MEASURE end] seedling-whole-game t=739s step=bot-plays checked=5 botQueue=48 botCursor=4 botChecked=4 botRegion="level_12__r0c37" lastRegionEvent="level_12__r0c37" regionChanges=28 wasmPushes=23 transport=wasm wasmMemMB=656 jsHeapMB=179 status="Sphere 1.8 → routing via \"level_12__r0c37 -> level_21\" → level_25__r2c7 (5/48) — playing tick 1/858"
```
⚠ The end status isn't an `error:`: the run ended on the measure's 300 s bot-stall window, the same as walk check 2. ("Tick 1502/1508"
at t=435 is the *previous* leg, the walk to the L12 chest, finishing.) Seed 1 plays the same exit `level_12__r0c37 -> level_21`
as a 2564-tick walk without stalling.

## Arm B (control): the JS runtime, seed 1, defaults only (SEEDLING_* knobs are inert on JS, walk check 2 §5)

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes |
|---|---|---|---|---|---|---|---|
| B1 (`transport=js`) | **8/48** | 16 | 3.6; stopped in 3.7 | `level_22__r8c0`, entry **9/48** (target `level_25__r2c7`, "Level 025 - Chest"), exit `level_22__r8c0 -> level_25__r2c7` | R1 named-danger FAIL: `CORRIDOR_LADDER_NEST 2` against `chaser:wallflyer@64,80` | 386.8 s (row 399.5 s) | 51 / 35 |

Timeline: `1@15s/r2 2@105s/r12 (L011 Chest) 4@120s/r19 5@150s/r21 6@210s/r31 8@270s/r39 9@285s/r43`.
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 399.5s
[tutorial-walk-timing] seedling-whole-game: load 4.2s, start-game-page 4.9s, start-game 0.2s, bot-plays-open 0.4s, bot-plays 386.8s
[MEASURE end] seedling-whole-game t=396s step=bot-plays checked=16 botQueue=48 botCursor=8 botChecked=8 botRegion="level_22__r8c0" lastRegionEvent="level_22__r8c0" regionChanges=51 wasmPushes=35 transport=js wasmMemMB=? jsHeapMB=202 status="error: level_22__r8c0: the bot cannot walk to exit \"level_22__r8c0 -> level_25__r2c7\" — the JS runtime's walk failed: the solver declined — solverBot(js-runtime-L22-exit) reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 (the wallflyer's contact: its `hitPlayer` gate fires against the player's start-of-tick box THIS tick (body at (79.0,88.0), forecast along the walk)) inside a climb already 2 deep (CORRIDOR_LADDER_NEST 2): a stance walk whose own corridor needs the ladder again is not converging — solving… (budget 640 work units)"
```
This is walk check 2's JS stop (L22→L25, CORRIDOR_LADDER_NEST, `chaser:wallflyer@64,80`), recurring. JS never reaches
the step-35 exit. Wasm plays this exit (A1 t=750: "routing via "level_22__r8c0 -> level_25__r2c7" … playing tick 64/113").

## Skip probe: wasm, seed 1, `TEST_MEASURE_SKIP_REFUSALS=10`

`bot-plays` 2964.6 s (row 2980.3 s), 140 region changes, 98 wasm pushes, heap 656 MB flat (198 samples). ⚠ It is a lower bound,
as before. Here it is also nearly blind: after the yeti refusal the bot is **stranded in `level_58__r3c3`**. Every skip either
re-asks for the same yeti event or finds "no path from level_58__r3c3 … nor from the restart target Menu". All 10 skips are
spent in 20 s.

```
[MEASURE skip 1] t=2956s skipping entry 24/48 "Level 089 - Feather" (sphere 6.13)
[MEASURE skip 2] t=2958s skipping entry 25/48 "Level 090 - Chest" (sphere 6.14)
[MEASURE skip 3] t=2960s skipping entry 26/48 "Level 040 - Boss Key 2" (sphere 7.3)
[MEASURE skip 4] t=2962s skipping entry 28/48 "Level 064 - Ghostspear" (sphere 7.5)
[MEASURE skip 5] t=2965s skipping entry 29/48 "Level 041 - Totem Part 240,144" (sphere 8.6)
[MEASURE skip 6] t=2967s skipping entry 30/48 "Level 042 - Totem Part 184,152" (sphere 8.7)
[MEASURE skip 7] t=2969s skipping entry 31/48 "Level 067 - Boss Key 4" (sphere 8.8)
[MEASURE skip 8] t=2972s skipping entry 32/48 "Level 040 - Totem Part 64,144" (sphere 9.4)
[MEASURE skip 9] t=2974s skipping entry 33/48 "Level 069 - Lights" (sphere 9.5)
[MEASURE skip 10] t=2976s skipping entry 34/48 "Level 043 - Wand" (sphere 10.1)
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 2980.3s
[tutorial-walk-timing] seedling-whole-game: load 4.6s, start-game-page 6.4s, start-game 1.8s, bot-plays-open 0.2s, bot-plays 2964.6s
[MEASURE end] seedling-whole-game t=2978s step=bot-plays checked=39 botQueue=48 botCursor=34 botChecked=49 botRegion="level_58__r3c3" lastRegionEvent="level_58__r3c3" regionChanges=140 wasmPushes=98 transport=wasm wasmMemMB=656 jsHeapMB=169 status="error: level_58__r3c3: the bot cannot walk to location \"L58 flag 1: yeti@56,56 cleared\" — … [the yeti text again]"
```
(The cursor jumps from 26 to 28 between skips 3 and 4. Entry 27 isn't named in any line, and I don't know why it was passed over.)

**The next 10 refusals** (the probe's skips, in walk order). The survey at BASE, as js-21 states it: survey END **224/26**
(run 44024110692; hit steps [24, 202, 220]); 4.2 39/39. I did not re-run the survey.

| # | entry | location | refusal (quoted) | kind | survey match |
|---|---|---|---|---|---|
| 1 | 24 | Level 089 - Feather | "the solver has no goal for L58 flag 1: yeti@56,56 cleared … the solver's clear-tag refuses it — no-verb: no strategy row exists for solid:yeti — the catalogue names no verb that clears it" | **the stop; independent.** A page-side MAPPER refusal (`jsRuntimeSolver.clearTagVerbOf`), raised before the solver runs. Fixed on main behind `SEEDLING_TALK_CLEAR_GOAL`, which ships **OFF** (YETI-TALK: with it ON, L58 solves in 151 t, 0 hits, and that slice's walk passed L58) | **not a survey step**, as far as I can tell: the survey drives the node solver, which YETI-TALK found already solves L58 flag 1 (`execYetiTalk`). The refusal is the page mapper's |
| 2 | 25 | Level 090 - Chest | the same yeti text | knock-on of 1 (stranded in `level_58__r3c3`) | — |
| 3 | 26 | **Level 040 - Boss Key 2** | the same yeti text | knock-on | — |
| 4 | 28 | Level 064 - Ghostspear | the same yeti text | knock-on | — |
| 5 | 29 | Level 041 - Totem Part 240,144 | "no path from level_58__r3c3 to level_41__r7c15, nor from the restart target Menu" | stranded | — |
| 6 | 30 | Level 042 - Totem Part 184,152 | "no path from level_58__r3c3 to level_42 …" | stranded | — |
| 7 | 31 | Level 067 - Boss Key 4 | "no path from level_58__r3c3 to level_67__r3c2 …" | stranded | — |
| 8 | 32 | Level 040 - Totem Part 64,144 | "no path from level_58__r3c3 to level_40__r4c4 …" | stranded | — |
| 9 | 33 | Level 069 - Lights | "no path from level_58__r3c3 to level_69 …" | stranded | — |
| 10 | 34 | Level 043 - Wand | the same yeti text | knock-on | — |

So the probe saw **one** independent refusal, the L58 yeti, and nothing past it. Entries 25–48 (including L40 Boss Key 2, L53,
L88, L91 and The Seed) are **unmeasured** at this main. YETI-TALK's walk (with the switch ON, on a non-main base) names the
next stop past L58 as **L91's drill** (`level_91 -> level_89__r1c10`, ladder EXHAUSTED on `enemy:drill@64,80`). That is that
slice's measure, not this one's.

## Then vs now

| arm | re-measure-2 (`2301163914`) | re-measure-3 (`c82f413c87`) | **now (`4e0eab7215`)** |
|---|---|---|---|
| A wasm seed 1: checked | 18/48 | 9/48 | **24/48** (2/2; 3/3 with the probe) |
| A: stop entry | 19 "Level 040 - Boss Key 2" | 10 "Level 029 - Boss Key 1" | **24 "Level 089 - Feather"** (in L58) |
| A: cause | budget stop, 640 → 2560 units, `shouldStop` DEADLINE at `walk` | L22→L29 ladder EXHAUSTED, `chaser:wallflyer@48,112` (survey step 35) | **L58 yeti event: mapper "no-verb: no strategy row exists for solid:yeti"** (TALK_CLEAR_GOAL OFF) |
| A: `bot-plays` wall | 1560–1622 s | 636–640 s | **2989–3198 s** |
| A: region changes / pushes | 103 / 70 | 54 / 38 | **140 / 93–94** |
| A′ wasm seed 2: checked | 13/48 † | 9/48 † | **4/48** † |
| A′: stop | 14, L28 button (`level_28__r1c18 -> level_30__r2c10`) † | 10, L22→L29 ladder EXHAUSTED `wallflyer@144,112` † | **5, `level_12__r0c37 -> level_21` playback stalled at tick 1/858, no refusal** |
| A′: wall | 1036.9 s | 616.7 s | **727.7 s** (stall-ended) |
| B JS seed 1: checked | 18/48 | 9/48 | **8/48** |
| B: stop | 19, walk stall + DEADLINE | 10, L22→L29 JS stall + ladder EXHAUSTED `wallflyer@128,80` | **9, L22→L25, CORRIDOR_LADDER_NEST 2, `chaser:wallflyer@64,80`** (R1 FAIL) |
| B: wall | 1032.3 s | 453.1 s | **386.8 s** |
| skip probe | 3 independent (19 BK2, 24 L53 jellyfish, 25 L91 drill); ran out at entry 32 | 1 independent (10, L22); ran out at entry 19 | **1 independent (24, L58 yeti); stranded; ran out at entry 34** |

† **Seed 2 is not comparable across columns.** The same id (`AP_01043188731678011336`) is a different game now: the level set
is `5f705e09` vs `45602886`, because `worlds/seedling_playthrough` was regenerated (walk check 2 §5). Re-measure-2's and
re-measure-3's seed-2 numbers describe a game this main no longer generates.

**Did the walk get past L22→L29 (entry 10)?** **Yes**, on wasm seed 1, 3 of 3: a 609-tick plan, solved in the first budget.
(JS doesn't reach it: it stops one exit earlier, at L22→L25.)
**Did it get past L40 Boss Key 2 (entry 19)?** **Entry 19 passed**, but that entry is now "Level 040 - Chest". The location
named "Level 040 - Boss Key 2" is now entry 26, behind the new wall, so whether BK2 itself plays is **not measured**.
**The new first wall (seed 1, wasm):** L58, entry 24/48 "Level 089 - Feather": *"the solver has no goal for L58 flag 1:
yeti@56,56 cleared … no-verb: no strategy row exists for solid:yeti — the catalogue names no verb that clears it"* (quoted from
the status, which equals the console line). The fix exists on main behind `SEEDLING_TALK_CLEAR_GOAL` (default OFF).
**Seed 2:** first wall at entry 5, `level_12__r0c37 -> level_21`, a playback stall (tick 1/858) with no refusal. It is walk
check 2's, and now 3 of 3.

## The criterion today

Robert's criterion is that the bot plays the whole randomized Seedling game to victory in the real wasm game. At main
`4e0eab7215` the vanilla seed is the furthest it has ever been: **24 of 48 checks, through three boss keys, in about 50
minutes**, with a flat 656 MB heap and no clock-decided stop. The step-35 wall that set re-measure-3 back to 9/48 is gone: the
wallflyer kill arm and the corpse flip let L22→L29 play in one budget. The new wall is in L58, and it is not a solver limit. The
page's main-thread mapper has no verb for the yeti event, and the cure (YETI-TALK's `SEEDLING_TALK_CLEAR_GOAL`) is already on
main, but OFF. Flipping it is the obvious next measure. YETI-TALK's own walk says the stop after that is L91's drill. The
randomized seed is worse off than the vanilla one: seed 2 is now a different game, and it freezes at entry 5 in a solved
L12→L21 walk that never gets past tick 1. That stall is deterministic (3 of 3), it has no refusal, and it isn't on any planner's
list, so for the *randomized* half of the criterion it is the first wall. The JS control still stops at L22→L25
(CORRIDOR_LADDER_NEST), so for now it is no longer a usable twin of the wasm walk past entry 9.

## Leftovers

- The dev server I started (port 8000, PID 954) was stopped by literal PID. No worktree was created.
- Ruling 52: no vitest of any kind was run. No source, workflow or main push.
