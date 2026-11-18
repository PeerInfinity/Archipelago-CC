# Cloud report: `seedling-whole-game-wasm-remeasure-5`

**The whole-game Seedling wasm walk again, after the TALK_CLEAR_GOAL flip, the L73 Fire guard and the seed-2 held-slot fix. MEASURE ONLY.**

Launcher: `seedling-js-planning-21` (js-21). Ruling: Robert, re-measure-5 *"After the TALK flip + trains 141–143 (Recommended)"*.
Branch: **`claude/whole-game-wasm-remeasure-5-h7ymjx`**. The harness pinned it, so no plain `seedling-whole-game-wasm-remeasure-5`
branch was pushed. Nothing was fixed. No solver, bot, wasm, `vendor/seedling`, preset or rules file was changed. The commits are the
re-applied MEASUREMENT-ONLY instrument, the run extracts (`seedling-whole-game-wasm-remeasure-5-evidence/`) and this report.

## Summary for Robert

- **Seed 1 (wasm) got past L58: 26/48 in 3 of 4 runs, up from 24/48.** The L58 yeti is no longer a wall. The bot clears it
  (L58 flags 0 and 1 turn set), then goes the long way round (L46 → L45 → L87 → L92 → L91), passes **L91's drill** on a
  2560-unit retry, and collects L89 Feather (entry 24) and L90 Chest (entry 25).
- **The new first wall is entry 26/48, "Level 040 - Boss Key 2", in L40.** Its prerequisite is clearing the wandlock
  `{40,12}` by burning `burnabletree@872,784`. The solver gives up there with *"the combat ladder is EXHAUSTED"*: the path
  runs past `chaser:bob@736,752`, and every rung is refused because a `spinner@816,848` hammer and a `bobsoldier@880,832`
  cover the approach. Survey step 96 (the same `{40,12}` goal) is also REFUSED on main.
- **One run of four stopped earlier, at 18/48 (A2).** On entry 19, "Level 040 - Chest", the first 640-unit solve came back
  as a hard refusal (*"kill (spinner@816,848) by press: every key set … lands the player box on a body … There is no step
  out"*), so the 2560-unit retry never ran. A1 and A3 ran out of the 640 budget on that entry, got the retry, and passed
  it. The L40 spinner corner is the area to watch: it decides both the stop and the spread between runs.
- **Seed 2 (wasm): 13/48, the same stop as the held-slot slice** (entry 14, L28 exit `level_28__r1c18 -> level_30__r2c10`,
  *"no REACHABLE stance inside button@112,240"*). The playback stall is gone, and no new wall appeared before it.
- **JS control: 8/48, unchanged**, word for word (L22→L25, `CORRIDOR_LADDER_NEST 2`, `chaser:wallflyer@64,80`).
  TALK_CLEAR_GOAL is now ON by default, so it applies on JS too, but JS never gets as far as L58.
- No OOM: the wasm heap held at 656 MB in every wasm run. No `RuntimeError`. No F1 "tape errored / ended at tick k of N".

## Base and subject

| | |
|---|---|
| base | **`76f15abd884daebd40ffc11c76a6bda43284fa65`** = main at train 150 ("train: hammer-flip-talk-clear-goal 39ec279592") |
| instrument | `d6b6aed4d` cherry-picked **cleanly** onto the base, giving **`46ad9b8f`** ("MEASUREMENT-ONLY: knobs + sampler …"): 4 files, +124/−5, the same diff as every earlier measure. Not for landing |
| flips live at BASE | `jsRuntimeSolver.js:692`: `enabled: globalThis.process?.env?.SEEDLING_TALK_CLEAR_GOAL !== '0' && !pageSolverEnvSwitchOff('SEEDLING_TALK_CLEAR_GOAL'),` and `:694` `export const TALK_CLEAR_GOAL_DEFAULT = true;` (ON). `solverBot.js:25830`: `enabled: globalThis.process?.env?.SEEDLING_WALLFLYER_KILL_ARM !== '0',` and `:25832` `WALLFLYER_KILL_ARM_DEFAULT = true;` (ON). `contactFidelity.js:2064`: `wallFlyerCorpseGone: true,` |
| wasm submodule `frontend/modules/flashPanel/wasm` | **`9968c7dda4c08397e93b0900d73a9e8126cda8b6`**, the same pin as every earlier measure. `session_bootstrap.sh --all` → READY, "seedling wasm builds: OK (4 dirs)", "chromium: OK", "tree: clean" |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` (unchanged) |
| box | the cloud container's headless Chromium. WebGPU comes from the batch's `webgpu: true`, and every wasm run reports `transport=wasm`. Dev server `scripts/serve-nocache.py 8000`, one run at a time under the box lock, a fresh page per run (each run is its own `npm test`) |
| row | `tutorial-walk-seedling-whole-game`, batch `tutorials-seedling-whole-game` (MANUAL, WebGPU), step `bot-plays` |
| seed 2 | `python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2` → **`AP_01043188731678011336`**, the **same id** as re-measure-4. The page loaded it as level set **`seedling-ap-record-195d9f6d`**. Re-measure-4 had `…5f705e09`, so the content hash moved (train 146's AP_1 logic, or the server-data trains). The held-slot report does not name its hash. Its walk stopped at the same place on the same id (below), so in practice it is the same game. Generated in the tree and never committed. Afterwards I reverted `preset_files.json` and deleted the preset dir and `output/AP_01043188731678011336.zip`; `git status` was clean |

Order: A1, A2, B1, probe P1, A3 (A1 and A2 disagreed), generate seed 2, A′1. A1, A2, A3, B1 and P1 ran at head `46ad9b8f` with
"0 tracked change(s) frozen". A′1 ran with 1 (the `preset_files.json` entry), as every time before. No commit was made while a
run held the box lock. The evidence files waited in the scratchpad until every run had finished.

## Knobs (identical to re-measure-2, -3 and -4)

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
evidence dir). No `?seedlingSolverEnv=` was passed, so every arm runs the shipped defaults: budget 640, held retry 2560,
WALLFLYER_KILL_ARM ON, wallFlyerCorpseGone ON, and now **TALK_CLEAR_GOAL ON**. Every row reads `PASSED` because the ratchet
grades it against `firstFailingStep: 'bot-plays'`. **PASSED is not victory.**

## Arm A: wasm, seed 1 (vanilla)

| run | checked / total (bot) | snapshot | last sphere | stop: region / entry | cause by name | `bot-plays` wall | region changes / wasm pushes | heap |
|---|---|---|---|---|---|---|---|---|
| A1 | **26/48** | 42 | 7.3 | `level_40__r48c54`, **entry 26/48 "Level 040 - Boss Key 2"** (target `level_40__r32c36`), on the prerequisite "breaking wandlock@480,560 first (flag:L40:12)" | ladder EXHAUSTED: clear-tag {40,12} → burn stance (`burnabletree@872,784`), danger `chaser:bob@736,752` | 1813.1 s (row 1823.3 s) | 168 / 111 | 656 MB flat (122 samples) |
| A2 | **18/48** | 32 | 6.8 | `level_40__r26c13`, **entry 19/48 "Level 040 - Chest"** | hard refusal at the 640 budget: "kill (spinner@816,848) by press: every key set … There is no step out" | 1073.3 s (row 1082.8 s) | 105 / 71 | 656 MB flat (73) |
| A3 | **26/48** | 42 | 7.3 | the same as A1 | the same as A1 (status verbatim) | 1776.7 s (row 1787.1 s) | 168 / 111 | 656 MB flat (119) |

A1 and A2 disagreed, so A3 was run, and it agrees with A1. The probe also reached the same entry-26 refusal at 1826 s, with 168
region changes. **That makes 3 of 4 at 26/48 and 1 of 4 at 18/48.**

Timeline (entry first seen @ s / region changes). A1: `1@15s/r2 3@120s/r16 4@136s/r20 5@165s/r22 6@225s/r34 8@285s/r39
9@300s/r43 10@435s/r54 11@465s/r57 12@495s/r60 14@540s/r60 15@690s/r72 16@765s/r77 17@840s/r91 18@855s/r93 19@1095s/r105
20@1185s/r105 21@1216s/r110 22@1320s/r117 23@1350s/r122 24@1470s/r136 25@1665s/r155 26@1680s/r157`. A3 is the same sequence,
about 2 % faster (`19@1065s … 24@1425s … 26@1635s`). This box is about twice as fast as re-measure-4's (re-measure-4 A1 reached
entry 24 at 2820 s; here A1 took 1470 s), so wall times compare only within this report.

Entry names: 1 L010 Sword, 6 L019 Boss Key 0, 11 L030 Torchpickup, 12 L032 Bob Boss, 14 L012 Chest, 15 L038 Chest, 17 L015
Chest, 18 L039 Totem Part 72,40, **19 L040 Chest**, 20 L040 Totem Part 160,640, 23 L055 Boss Key 3, **24 L089 Feather, 25 L090
Chest, 26 L040 Boss Key 2**.

**How L58 passes now (A1).** At t=1485–1530, "routing via "level_57 -> level_58__r4c1" → level_89__r1c10 (24/48) — playing tick
…/1830". At t=1545, "breaking yeti@56,56 first (flag:L58:1) … left the plan at tick 1 — recovery 1/3: re-entering level 58 to
re-solve". The console then shows one declined continue-exit, the yeti graze (*"level_58__r1c4 -> level_46__r6c24 … waypoint 1
(72,56): not reached within 400 ticks; stalled … after grazing 400 solid(s): yeti at (56,56)"*). The game's own L58 row turns
from `111111…` to `001111…` (flags 0 and 1 set). At t=1560 the bot is in `level_46__r0c11` and routes L46 → L45 → L87 → L92 →
L91. At t=1635, "routing via "level_91 -> level_89__r1c10" … solving again, the room held… (budget 2560 work units, retry 1)":
**L91's drill passes on the held retry**. At t=1650 it is walking to "Level 089 - Feather" (tick 151/163), and at t=1665 to
"Level 090 - Chest" (388/388). A3 and the probe take the same path.

**Entry 19 "Level 040 - Chest", where the runs split:**
- A1: t=1110 "solving… (640)" → t=1125 "solving again, the room held… (2560, retry 1)" → a 1106-tick plan → passed (entry 20 at 1185 s).
- A3: the same, with a 1222-tick plan.
- A2: t=1080 "solving… (640)" → at once the console refusal below, with **no** held retry, and the run ends.
I did not look for why the 640 pass refused in one run and ran out of budget in the other two (MEASURE ONLY). All three arrived
on the same 61–64-tick walk-in.

The stop (A1; A3 is the same text):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1823.3s
[tutorial-walk-timing] seedling-whole-game: load 2.6s, start-game-page 4.2s, start-game 1.1s, bot-plays-open 0.2s, bot-plays 1813.1s
[MEASURE end] seedling-whole-game t=1821s step=bot-plays checked=42 botQueue=48 botCursor=25 botChecked=26 botRegion="level_40__r48c54" lastRegionEvent="level_40__r48c54" regionChanges=168 wasmPushes=111 transport=wasm wasmMemMB=656 jsHeapMB=179 status="error: level_40__r48c54: the bot cannot walk to location \"L40 flag 12: wandlock@480,560 cleared\" — the wasm playback failed: the solver declined L40 flag 12: wandlock@480,560 cleared in level 40 (refusal): solverBot(wasm-location-40) clear-tag {40,12} wandlock@480,560 -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED. …"
```
The lead-in: t=1815 "breaking wandlock@480,560 first (flag:L40:12) — the route to level_40__r32c36 (26/48) needs it — solving…
(budget 640 work units)". Then the console prints "ran out of 640 work units … asking again with 2560, the room held (retry 1)",
and the retry returns the refusal.

⚠ **Ladder-EXHAUSTED, so here is the full refusal from the console** (A1, `stop-refusals.console.txt`; the per-rung lines):
```
[wasm playback] the solver declined L40 flag 12: wandlock@480,560 cleared in level 40 (refusal): solverBot(wasm-location-40) clear-tag {40,12} wandlock@480,560 -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED. The corridor passes through danger at (744.3,802.3) — chaser:bob@736,752 (inside leash 80 (d=5.3), box grown 0.5 px/tick x 0 + pad 0) — and every rung of ⚖ §11.8a's order refused:
  avoid: no admissible corridor with the danger map's 17 volume(s) forbidden — A* goal tile (55,51) in level 40 — for (888,824) — is not walkable: danger:bobsoldier@880,832 (a stepped bobsoldier at its LIVE position) at (868,822). The planner works in whole tiles, so both ends o
  time: the aim is 408 px away and `mover.MOVER_RANGE` measures this search reaching 48 px as an UPPER BOUND at dwell 4. TIME is the contested LAST-MILE tool (kickoff §3.1); it is not a room-crossing one, and the bound is named rather than widened.
  bait: no stance within bob@736,752's leash (80) both pulls its straight line through a kill region and is itself danger-free: 0 cell(s) in leash, 0 of them crossing a region, none of those reachable. ⛔ A stance safe to PASS is not safe to WAIT in (trap 154), and this rung asks the waiting question.
  kill: no presser in level 40 arms a trap whose lane covers bob@736,752 — the room has 6 presser(s) and 0 trap(s), and a button that arms nothing over the body is not a weapon. A PRESS arm is a `KILL_ARM_POLICY` question and this rung does not open one (trap 101).
         chaser arm: no stance derives for bob@736,752 on level 40: … 81 cell(s) inside its 80 px leash, 11 of those reachable and with a corridor onward, and 11 of THOSE refused by the forecast [(744,840): the APPROACH is dangerous at tick 506 — spinner:spinner@816,848; …]. … GUARD APPROACH (guardApproachStance): no approach stance for bob@736,752 either — REACH: 5 lattice cell(s) …; TIMING: 0 …; LEASH: 11 candidate(s) where another body reaches the player — of 11 asked [(744,840) leash: the APPROACH is hit at tick 506 by spinner:spinner@816,848; …].
  narrow: the corridor walked with the pre-lapse strike admissions is dangerous too — spinner:spinner@816,848 (a live Spinner's HAMMER at (751.8,852.5) at horizon 570 — the exact 13 px `collideLine` at Game.time 52673 (phase 23/45, angle 184.0°)) at (744.3,850.9)
  detour: COVERED GOAL (coveredGoalRefusal): the aim (888,824)'s own tile (55,51) lies inside the live body bobsoldier@880,832's volume (a stepped bobsoldier at its LIVE position), so the danger map forbids the goal itself — every DETOUR candidate and every forced crossing ends on that tile, and neither rung is asked while it stands
  forced-hit: COVERED GOAL (coveredGoalRefusal): the aim (888,824)'s own tile (55,51) lies inside the live body bobsoldier@880,832's volume (a stepped bobsoldier at its LIVE position), so the danger map forbids the goal itself — …
```
(The `avoid` line is cut mid-word in the console itself: "so both ends o".)

A2's stop:
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1082.8s
[tutorial-walk-timing] seedling-whole-game: load 2.6s, start-game-page 3.5s, start-game 1.5s, bot-plays-open 0.3s, bot-plays 1073.3s
[MEASURE end] seedling-whole-game t=1081s step=bot-plays checked=32 botQueue=48 botCursor=18 botChecked=18 botRegion="level_40__r26c13" lastRegionEvent="level_40__r26c13" regionChanges=105 wasmPushes=71 transport=wasm wasmMemMB=656 jsHeapMB=190 status="error: level_40__r26c13: the bot cannot walk to location \"Level 040 - Chest\" — the wasm playback failed: the solver declined Level 040 - Chest in level 40 (refusal): solverBot(wasm-location-40) apitem (880,816) contact -> kill (spinner@816,848) by press: every key set — the plan's own and 5 alternative(s) — lands the player box on a body's 7x7 rect or on the 13 px hammer line at that tick's own phase, on the next tick, at (868.73,855.83) in level 40. There is no step out. The corner formed 7 tick(s) after the press on spinner@816,848 LANDED at t1360: a landing's knockback is player-coupled, so no forecast taken before it carries the rebound (HAMMER_PHASE_RUNG). The rung's preview saw no corner on this approach before it (it ends where the strike lapses, and a refuge wait is not previewed). The plain fallback (`OPP_PRESS_FALLBACK`) rewound to the kill's first tick (t886) and redid the kill with `OPPORTUNISTIC_STRIKE` off; it did not kill (SolverRefusal: solverBot(wasm-location-40) apitem (880,816) contact -> kill (spinner@816,848) by press: the player died at t1150 (chaser bob@736,800) while pressing spinner@81)."
```
This one is not a ladder exhaustion: the status carries the whole refusal, and it equals the console line.

## Arm A′: wasm, randomized seed 2 (`AP_01043188731678011336`, level set `seedling-ap-record-195d9f6d`)

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes | heap |
|---|---|---|---|---|---|---|---|---|
| A′1 | **13/48** | 17 | 2.12 | `level_28__r1c18`, entry **14/48** (target `level_30__r2c10`), exit `level_28__r1c18 -> level_30__r2c10` | named solver refusal: "no REACHABLE stance inside button@112,240" (grasslock@176,208 needs it held) | 706.7 s (row 716.4 s) | 91 / 67 | 656 MB flat (48) |

Recorded, not diagnosed. Timeline: `1@15s/r2 2@105s/r11 3@120s/r15 4@135s/r19 (L012 Chest) 5@255s/r28 6@300s/r34 (L029 BK1)
7@331s/r39 8@360s/r41 (L038 Chest) 9@435s/r50 10@510s/r62 11@525s/r66 12@540s/r71 (L019 BK0) 14@600s/r77`. Entry 5 (the old
`level_12__r0c37 -> level_21` stall) plays through.
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 716.4s
[tutorial-walk-timing] seedling-whole-game: load 2.6s, start-game-page 3.3s, start-game 1.9s, bot-plays-open 0.3s, bot-plays 706.7s
[MEASURE end] seedling-whole-game t=715s step=bot-plays checked=17 botQueue=48 botCursor=13 botChecked=13 botRegion="level_28__r1c18" lastRegionEvent="level_28__r1c18" regionChanges=91 wasmPushes=67 transport=wasm wasmMemMB=656 jsHeapMB=190 status="error: level_28__r1c18: the bot cannot walk to exit \"level_28__r1c18 -> level_30__r2c10\" — the wasm playback failed: the solver declined level_28__r1c18 -> level_30__r2c10 in level 28 (refusal): solverBot: no REACHABLE stance inside button@112,240 in level 28 — 1 cell(s) land the player box in the button and none of them plans a corridor from (136,296). A hold that cannot be stood on is not a strategy for this obstacle. ⛔ AND THE PREREQUISITES WERE TRIED AND REFUSED, one at a time: grasslock@176,208 — its group t=0 publishes only while a Solid sits on button@112,240, and NO block in this room can reach it — so the only order that could open it is a `hold` the walker shuts again by leaving. ⚖ Guard (iii): a hypothesis nothing can redeem DURABLY is a wall, not an optimistic gap."
```
This is the same stop as the held-slot slice (`seedling-held-slot-delivery-fix.md`, S2: 13/48, entry 14, 91 region changes, 67
pushes), word for word. F1 did not fire: there is no "tape errored" or "ended at tick k of N" line in any run.

## Arm B (control): the JS runtime, seed 1, at defaults

`?seedlingSolverEnv=` still does not reach the JS frame, so B runs at defaults. **TALK_CLEAR_GOAL is now a default (ON), so it
applies to JS as well.** That makes no difference here, because JS stops long before L58.

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes |
|---|---|---|---|---|---|---|---|
| B1 (`transport=js`) | **8/48** | 16 | 3.7 | `level_22__r8c0`, entry **9/48** (target `level_25__r2c7`), exit `level_22__r8c0 -> level_25__r2c7` | R1 named-danger FAIL: `CORRIDOR_LADDER_NEST 2` against `chaser:wallflyer@64,80` | 360.7 s (row 368.4 s) | 51 / 35 |

```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 368.4s
[tutorial-walk-timing] seedling-whole-game: load 2.5s, start-game-page 3.2s, start-game 0.2s, bot-plays-open 0.2s, bot-plays 360.7s
[MEASURE end] seedling-whole-game t=367s step=bot-plays checked=16 botQueue=48 botCursor=8 botChecked=8 botRegion="level_22__r8c0" lastRegionEvent="level_22__r8c0" regionChanges=51 wasmPushes=35 transport=js wasmMemMB=? jsHeapMB=242 status="error: level_22__r8c0: the bot cannot walk to exit \"level_22__r8c0 -> level_25__r2c7\" — the JS runtime's walk failed: the solver declined — solverBot(js-runtime-L22-exit) reach-exit (0,128)->L25 -> kill (bob@96,144) stance -> kill (bob@96,144) stance: CORRIDOR — the corridor meets chaser:wallflyer@64,80 (the wallflyer's contact: its `hitPlayer` gate fires against the player's start-of-tick box THIS tick (body at (79.0,88.0), forecast along the walk)) inside a climb already 2 deep (CORRIDOR_LADDER_NEST 2): a stance walk whose own corridor needs the ladder again is not converging — solving… (budget 640 work units)"
```
This is re-measure-4's B1, verbatim.

## Skip probe: wasm, seed 1, `TEST_MEASURE_SKIP_REFUSALS=10`

`bot-plays` 2546.1 s (row 2556.1 s), 208 region changes, 141 wasm pushes, heap 656 MB flat (176 samples). It reached entry 26 on
the same path as A1 and A3, then spent **5 of its 10 skips** and reached **entry 34, "Level 043 - Wand"**. There the run
stopped on a **status the skip knob does not catch**: `blocked: the check of "Level 043 - Wand" did not land`. The state manager
rejected the check as `not_accessible`, because the skipped entries (Boss Key 2, among others) are logic prerequisites. After
the 300 s bot-stall window, the run ended. That ending is an artefact of the probe, not a wall.
```
[MEASURE skip 1] t=1826s skipping entry 26/48 "Level 040 - Boss Key 2" (sphere 7.3)
[MEASURE skip 2] t=1932s skipping entry 29/48 "Level 041 - Totem Part 240,144" (sphere 8.6)
[MEASURE skip 3] t=1934s skipping entry 30/48 "Level 042 - Totem Part 184,152" (sphere 8.7)
[MEASURE skip 4] t=2014s skipping entry 32/48 "Level 040 - Totem Part 64,144" (sphere 9.4)
[MEASURE skip 5] t=2032s skipping entry 33/48 "Level 069 - Lights" (sphere 9.5)
[MEASURE tick] t=2265s … status="blocked: the check of \"Level 043 - Wand\" did not land"   (and every 15 s to the end)
  console: [SMW] checkLocation: Location check was rejected. Reason: not_accessible
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 2556.1s
[tutorial-walk-timing] seedling-whole-game: load 2.9s, start-game-page 3.3s, start-game 1.8s, bot-plays-open 0.3s, bot-plays 2546.1s
[MEASURE end] seedling-whole-game t=2554s step=bot-plays checked=46 botQueue=48 botCursor=33 botChecked=51 botRegion="level_43__r13c7" lastRegionEvent="level_43__r13c7" regionChanges=208 wasmPushes=141 transport=wasm wasmMemMB=656 jsHeapMB=190 status="blocked: the check of \"Level 043 - Wand\" did not land"
```
Past the wall, the probe **played** entry 28 "Level 064 - Ghostspear" (routing through L0 → L12 → L95 → L59 → L60 → L61 → L62 →
L64) and entry 31 "Level 067 - Boss Key 4". The cursor passed over entry 27 without naming it, as in re-measure-4. (`botChecked`
counts skips, so 51 is not a real tally.)

**The next refusals, in walk order.** The probe found only 5 skippable refusals before its artefact ending, so I have filled the
list out with the other refusals the runs met. Survey at BASE: run **44369671417** @`76f15abd88`, merged **SOLVED 224 / REFUSED
26** (`survey-refused-rows.txt` lists the 26 REFUSED rows, from the run's `seedling-survey-merged` artifact). 4.2: 39/39
(44369666520), nothing refused, so no match is possible there.

| # | entry | location | refusal (quoted) | kind | survey match (REFUSED on main?) |
|---|---|---|---|---|---|
| 1 | 19 | Level 040 - Chest | "kill (spinner@816,848) by press: every key set … lands the player box on a body's 7x7 rect or on the 13 px hammer line … There is no step out" | **1 run of 4 (A2)**; the other 3 passed on the 2560 retry | **YES: step 66** (goal "Level 040 - Chest", REFUSED; its refusal names `spinner@816,848` on the Totem Part 160,640 leg). The wording is the same as the tail of step 96's refusal |
| 2 | 26 | **Level 040 - Boss Key 2** | "clear-tag {40,12} wandlock@480,560 -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED … chaser:bob@736,752 …" (full rungs above) | **the stop, 3 of 4; independent** | **YES: step 96** (goal clear-tag {40,12} wandlock@480,560, REFUSED). The survey's refusal comes on a different rung of the same corner: "collect (656,528) … -> kill (spinner@816,848) by press: every key set …" |
| 3 | 29 | Level 041 - Totem Part 240,144 | "no path from level_64 to level_41__r7c15, nor from the restart target Menu" | knock-on of 2 (BK2 missing) | — |
| 4 | 30 | Level 042 - Totem Part 184,152 | "no path from level_64 to level_42, nor from the restart target Menu" | knock-on of 2 | — |
| 5 | 32 | Level 040 - Totem Part 64,144 | "no path from level_67__r3c2 to level_40__r4c4, nor from the restart target Menu" | knock-on of 2 | (step 149, the L40 wandlock {40,7} → Totem Part 64,144, is REFUSED on main; the walk never reached it) |
| 6 | 33 | Level 069 - Lights | "the solver declined level_61__r13c12 -> level_63__r10c2 in level 61 (refusal): solverBot: bridge bridge@11,13 in level 61 — no floor cell one or two tiles behind it puts the spear's 32x5 rect on it and is reachable: …" | **independent** | **YES: step 155**, verbatim (L61 teleporter → L63, bridge@11,13) |
| 7 | 34 | Level 043 - Wand | the check rejected `not_accessible` (status "blocked: … did not land") | probe artefact: skipped prerequisites | (step 167, goal "Level 043 - Wand", is REFUSED on main on its L43 → L37 magicallock exit; the walk never got to try it) |
| — | (24) | L58 flag 1: yeti@56,56 | console only: "level_58__r1c4 -> level_46__r6c24 … waypoint 1 (72,56): not reached within 400 ticks … grazing 400 solid(s): yeti at (56,56)" | a declined continue-exit that **the walk recovered from**, not a stop | step 111 (the same L58 → L46 exit, the same yeti graze) is still REFUSED on main; the page walk passes it anyway |

Entries 35–48 (including L53, L88 and The Seed) are **unmeasured** at this main.

## Then vs now

| arm | re-measure-3 (`c82f413c87`) | re-measure-4 (`4e0eab7215`) | **now (`76f15abd88`)** |
|---|---|---|---|
| A wasm seed 1: checked | 9/48 | 24/48 (3/3) | **26/48** (3/4: A1, A3, probe) · **18/48** (1/4: A2) |
| A: stop entry | 10 "Level 029 - Boss Key 1" | 24 "Level 089 - Feather" (in L58) | **26 "Level 040 - Boss Key 2"** (in L40) · A2: 19 "Level 040 - Chest" |
| A: cause | L22→L29 ladder EXHAUSTED, `chaser:wallflyer@48,112` (survey step 35) | L58 yeti event, mapper "no-verb: no strategy row exists for solid:yeti" (TALK_CLEAR_GOAL OFF) | **clear-tag {40,12} wandlock → burn stance: ladder EXHAUSTED, `chaser:bob@736,752`** (step 96) · A2: spinner press "no step out" at 640, no retry (step 66) |
| A: `bot-plays` wall | 636–640 s | 2989–3198 s | **1777–1813 s** (A2 1073 s), on a ~2× faster box |
| A: region changes / pushes | 54 / 38 | 140 / 93–94 | **168 / 111** (A2 105 / 71) |
| A′ wasm seed 2: checked | 9/48 † | 4/48 | **13/48** (the held-slot slice: 13/48) |
| A′: stop | 10, L22→L29 † | 5, `level_12__r0c37 -> level_21` stalled at tick 1/858 | **14, L28 `level_28__r1c18 -> level_30__r2c10`, "no REACHABLE stance inside button@112,240"** (the same as the held-slot slice) |
| A′: wall | 616.7 s | 727.7 s (stall-ended) | **706.7 s** |
| B JS seed 1: checked | 9/48 | 8/48 | **8/48** |
| B: stop | 10, L22→L29 | 9, L22→L25, CORRIDOR_LADDER_NEST 2, `chaser:wallflyer@64,80` | **the same, verbatim** |
| B: wall | 453.1 s | 386.8 s | **360.7 s** |
| skip probe | 1 independent (10); ran out at 19 | 1 independent (24, yeti); stranded; ran out at 34 | **2 independent (26 L40 wandlock, 33 L61 bridge); played 28 and 31; ended at 34 (Wand check rejected, a probe artefact)** |

† Re-measure-3's seed 2 was a different game (level set `…45602886`). Re-measure-4 and now use the same AP id. The level-set
hash moved again (`5f705e09` → `195d9f6d`), but the walk is the held-slot slice's walk to the letter.

**Did seed 1 get past entry 24 (L58 yeti)?** **Yes, in every run that reached it: 3 of 4** (A2 stopped earlier, at entry 19). TALK_CLEAR_GOAL clears the yeti: the L58 flags turn set after one "left the plan at tick 1" recovery. L91's drill, which
YETI-TALK named as the next stop, also passes, on the 2560 held retry. Feather (24) and L90 Chest (25) land.
**The new first wall:** L40, entry 26/48 "Level 040 - Boss Key 2". The prerequisite "L40 flag 12: wandlock@480,560 cleared" →
*"clear-tag {40,12} wandlock@480,560 -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED. The corridor passes
through danger at (744.3,802.3) — chaser:bob@736,752"*. The survey's step 96 is the same goal, also REFUSED on main.
**A second wall in the same room, hit by 1 run of 4:** entry 19 "Level 040 - Chest", the spinner-press "no step out" refusal at
the 640 budget (survey step 66).
**Seed 2:** 13/48 vs the held-slot slice's 13/48. The same L28 button-stance stop, word for word.
**JS:** 8/48 vs 8/48. The same L22→L25 stop, word for word.

## The criterion today

Robert's criterion is that the bot plays the whole randomized Seedling game to victory in the real wasm game. At main
`76f15abd88`, the vanilla seed reaches **26 of 48 checks, through L58 and L91, in about 30 minutes on this box**, with a flat 656 MB
heap and no clock-decided stop. The TALK flip did what it was meant to: the L58 yeti, re-measure-4's wall, is gone, and so is
L91's drill. The next wall is L40, the big room that holds four of the walk's checks. It sits in one corner of that room, around
`spinner@816,848`, `chaser:bob@736,752` and `bobsoldier@880,832`. The Boss Key 2 prerequisite (burning `burnabletree@872,784` to
open wandlock `{40,12}`) exhausts the combat ladder there in 3 of 4 runs. The same corner also decides whether the earlier L40
Chest (entry 19) passes: 1 run in 4 stops there, at 18/48. Both match survey steps that are REFUSED on main (96 and 66), so the
survey already points at the right place. Past it, the probe shows L64 Ghostspear and L67 Boss Key 4 playing, and the next
independent refusal is L61's bridge (survey step 155, verbatim). The randomized seed has moved from a playback freeze at 4/48 to a
named solver refusal at 13/48: the L28 button stance, the same as the held-slot slice. That is the first wall on the randomized
side of the criterion. The JS control has not moved (8/48, L22→L25).

## Leftovers

- The dev server I started (port 8000, PID 962) was stopped by literal PID. No worktree was created.
- Ruling 52: no vitest of any kind was run. No source or workflow change, no push to main.
- The CI survey artifact was downloaded only to read its REFUSED rows. Those rows are committed as `survey-refused-rows.txt`; the
  artifact itself is not.
