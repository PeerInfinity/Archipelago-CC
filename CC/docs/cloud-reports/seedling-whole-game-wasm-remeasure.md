# Cloud report: `seedling-whole-game-wasm-remeasure`

**The whole-game Seedling wasm walk again, at current main. MEASURE ONLY.**

Coordinator: `seedling-js-planning-16` (js-16). Ruling: Robert, 2026-11-07, "After trains 49–50 (Recommended)": a current
baseline before any L40 flip, repeatable after one. Branch: `claude/seedling-whole-game-wasm-remeasure-s299vp` (the harness pinned
it; there is no plain `seedling-whole-game-wasm-remeasure` branch). Nothing was fixed. No solver, bot, wasm, `vendor/seedling`, preset
or rules file was changed. The only commits are the re-applied MEASUREMENT-ONLY instrument and this report.

Previous report: `CC/docs/cloud-reports/seedling-whole-game-wasm-measure.md` on
`claude/seedling-whole-game-wasm-measure-srmzjm` (tip `06559d6c75`, base `26ed405d3f`). Its method, knobs and row are reused here
unchanged.

## Headline

**Nothing moved.** At the new base (main after train 50), the vanilla seed 1 on wasm still checks **18/48** and stops at entry
**19/48, "Level 040 - Boss Key 2"**. The cause is the same named refusal: `solverBot(wasm-location-40)` says "the combat ladder is
EXHAUSTED" on `chaser:bobsoldier@880,832`, then runs out of 640 and 2560 work units. 3 of 3 clean runs agree (A1, A2, and an A3
I added, see below). The JS control stops at the same entry with the same refusal as before. Randomized seed 2 still stops at
**13/48** on the same L26 tree/rocklock exit. The skip probe's list of next refusals is the same as before, plus one new refusal:
a **marginal L39 spinner leg at entry 18**. It refused in 1 of the 4 seed-1 wasm runs (the probe). In 2 of the clean runs it
landed only on its 2560-unit held retry. The walks are **~12–15 % faster** in wall time (wasm `bot-plays` 1220–1244 s, was
1377–1432 s). No OOM in any run: the wasm heap stayed flat at 656 MB.

## Base and subject

| | |
|---|---|
| base | `1a7944a59c9b61f2f7f1eda20706fff2ece48316` = main after train 50 ("train: hammer-harvest-door-carry 453bdb18bc"). 25 first-parent commits past `26ed405d3f`, including `ce81ee811a` tile-l12-one-world, `05bf82cc9f` tile-rules-automation-r-a4, `fda5a95ea1` hammer-flip-chest-leg-delta, `534cf9b6c3` fidelity-harvest/ceremonyexact, `d01f88b17c` hammer-harvest-wave6 (train 49) and `1a7944a59c` door-carry (train 50) |
| instrument | `f232811c` cherry-picked **cleanly** onto the base, giving `ba9c143df6` ("MEASUREMENT-ONLY: knobs + sampler …"). Its diff is byte-for-byte the one in the previous report (4 files, +124/−5), so it is not repeated here |
| wasm submodule `frontend/modules/flashPanel/wasm` | `9968c7dda4c08397e93b0900d73a9e8126cda8b6`, the **same** pin as the old base. `session_bootstrap.sh --all` reported READY with "seedling wasm builds: OK (4 dirs)" |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` (unchanged) |
| box | the cloud container: headless Chromium with WebGPU (the batch's `webgpu: true`), dev server `scripts/serve-nocache.py 8000`, one run at a time under the box lock, a fresh page per run (each run is its own `npm test` invocation). The bootstrap's "pip headless" step FAILED (it is not used by this row); everything else was OK |
| row | `tutorial-walk-seedling-whole-game`, batch `tutorials-seedling-whole-game` (MANUAL, WebGPU), tutorial S4 `seedling-whole-game`, step `bot-plays` |
| subjects | seed 1 = `frontend/presets/seedling_playthrough/AP_14089154938208861744/` (vanilla: canonical placement). Seed 2 was generated locally and not committed: `python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2` gave **`AP_01043188731678011336`**, the **same AP id as last time**, and the page loaded it as level set `seedling-ap-record-45602886` (also the same). Afterwards I reverted `preset_files.json` and deleted the dir and its `output/` zip |

⚠ While the seed-2 preset was on disk, the box lock recorded "1 tracked change(s) frozen" (that `preset_files.json` edit) for every
run. It only adds a preset entry. Seed 1's files are untouched by it.

⚠ Between the bases, `worlds/seedling_playthrough/_worldgen_sidecars.json` and siblings changed (10 files, +895/−852 under
`frontend/presets/seedling_playthrough`, `worlds/seedling_playthrough` and the seedling tutorial content). Those changes came with
main's trains, not from this slice. The seed-1 AP id and the seed-2 AP id and level set are unchanged.

## Knobs and values (identical to last time)

| knob | value | arms |
|---|---|---|
| `TEST_AUTO_START_TIMEOUT_MS` | `10800000` (3 h) | all |
| `TEST_TIMEOUT` | `11000000` | all |
| `TEST_MEASURE_STEP_TIMEOUT_MS` | `10800000` | all |
| `TEST_MEASURE_BOT_STALL_MS` | `300000` | all |
| `TEST_MEASURE_PLAYTHROUGH_SEED` | `2` | A′ |
| `TEST_MEASURE_FLASH_RUNTIME` | `js` | B |
| `TEST_MEASURE_SKIP_REFUSALS` | `10` | probe |

Command: `npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game`, with the env above. In every arm the bot's
status turned to `error: …` and `botCannotFinish` ended the step at once. So the walk stopped itself: neither the 3 h clock nor
the 300 s stall window decided any stop. Every row reads `PASSED` because the ratchet grades it against its recorded
`firstFailingStep: 'bot-plays'`. **PASSED is not victory.**

## Arm A: wasm, seed 1 (vanilla)

| run | checked / total (bot) | snapshot checks | last sphere | stop: region / entry | cause by name | `bot-plays` wall | region changes / wasm pushes | wasm heap |
|---|---|---|---|---|---|---|---|---|
| A1 | **18/48** | 31 | 6.5 done; refused 6.6 | `level_40__r32c36`, **19/48 "Level 040 - Boss Key 2"** | solver refusal, `solverBot(wasm-location-40)` … "the combat ladder is EXHAUSTED", danger `chaser:bobsoldier@880,832` at (888.1,855.1); "ran out of 640, then 2560 work units on its held retry" | 1243.9 s (row 1255.3 s) | 103 / 70 | 656 MB flat (83 samples) |
| A2 | 18/48 | 31 | 6.5; refused 6.6 | same, 19/48 | same; danger at (887.7,853.6) | 1232.6 s (row 1242.7 s) | 103 / 70 | 656 MB flat |
| A3 | 18/48 | 31 | 6.5; refused 6.6 | same, 19/48 | same | 1220.4 s (row 1229.6 s) | 103 / 70 | 656 MB flat |

A1 and A2 agreed, so the brief's 3rd run was not required. I ran A3 anyway, because the skip probe (also seed 1 on wasm, and
identical to A until its first error) **disagreed** at entry 18 (see below). Clean runs: **3/3 identical stop**. No page error, no
`RuntimeError`, no OOM. The only console error in each run is one boot-time `Failed to load resource: … 404`, the same as last time.

Timeline (A1, queue entry first seen @ s / region changes): `1@15s/r2 2@120s/r11 3@135s/r16 4@151s/r20 5@180s/r21 6@255s/r34
8@315s/r39 9@330s/r43 10@480s/r52 11@495s/r53 12@525s/r57 14@585s/r58 15@750s/r69 16@840s/r74 17@930s/r86 18@945s/r89
19@1230s/r103` (it was `… 18@1095s/r89 19@1410s/r103`). A2 and A3 track it to within ~30 s.

**Entry 18 ("Level 039 - Totem Part 72,40") is marginal.** In A1 and A2 the 15 s sampler caught it at "solving again, the room
held… (budget 2560 work units, retry 1)", so it landed only on the held retry. In A3 no sample caught a retry. In the probe run it
refused (below).

Quoted (A1):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1255.3s
[tutorial-walk-timing] seedling-whole-game: load 3.2s, start-game-page 3.6s, start-game 1.9s, bot-plays-open 0.4s, bot-plays 1243.9s
[MEASURE tick] seedling-whole-game t=1245s step=bot-plays checked=31 botQueue=48 botCursor=18 botChecked=18 botRegion="level_40__r32c36" lastRegionEvent="level_40__r32c36" regionChanges=103 wasmPushes=70 transport=wasm wasmMemMB=656 jsHeapMB=179 status="Sphere 6.6 → walking to \"Level 040 - Boss Key 2\" (19/48) — solving again, the room held… (budget 2560 work units, retry 1)"
[MEASURE end] seedling-whole-game t=1253s step=bot-plays checked=31 botQueue=48 botCursor=18 botChecked=18 botRegion="level_40__r32c36" lastRegionEvent="level_40__r32c36" regionChanges=103 wasmPushes=70 transport=wasm wasmMemMB=656 jsHeapMB=179 status="error: level_40__r32c36: the bot cannot walk to location \"Level 040 - Boss Key 2\" — the wasm playback failed: the solver declined Level 040 - Boss Key 2 in level 40 (pass dashless): solverBot(wasm-location-40) apitem (656,528) contact -> shove stance (pushableblockfire@576,576) -> hold stance (wandlock@448,432) -> burn stance (burnabletree@872,784): the combat ladder is EXHAUSTED. The corridor passes through danger at (888.1,855.1) — chaser:bobsoldier@880,832 (the sword: `swordHitting`'s `collideLine(\"Player\", …)` from 8 to 16 px off the body crosses this box THIS tick (no enemy i-frame and no `destroy` gate refuses it)) — and every rung of ⚖ §11.8a's order refused: — and the solver ran out of 640, then 2560 work units on its held retry on location in level 40"
```
A2 and A3 end with the same `[MEASURE end]` text, differing only in the danger coordinate (A2 (887.7,853.6)) and the times:
`[PROGRESS 1/1] … PASSED 1242.7s` (A2) and `PASSED 1229.6s` (A3).

## Arm A′: wasm, randomized seed 2 (`AP_01043188731678011336`, local, uncommitted)

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes | heap |
|---|---|---|---|---|---|---|---|---|
| A′1 | **13/48** | 16 | 4.4 done; refused 4.5 | `level_26__r2c4`, entry **14/48** (the level-30 row, "Level 030 - Torchpickup"; the bot was routing to `level_30__r2c10`), on the route exit `level_26__r2c4 -> level_27` | solver refusal, `solverBot(wasm-exit-26)`: "no corridor for goal reach-exit toward (72,312) in level 26. Obstacle: solid:tree (tree@128,224); also on the frontier: rocklock@112,208, rock2@128,192. **No strategy row exists for this obstacle.** Planner said: no walkable tile path in level 26 from tile (8,13) to (4,19)" | 814.9 s (row 825.4 s) | 95 / 71 | 656 MB flat |

```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 825.4s
[tutorial-walk-timing] seedling-whole-game: load 2.9s, start-game-page 3.2s, start-game 1.8s, bot-plays-open 0.4s, bot-plays 814.9s
[MEASURE end] seedling-whole-game t=823s step=bot-plays checked=16 botQueue=48 botCursor=13 botChecked=13 botRegion="level_26__r2c4" lastRegionEvent="level_26__r2c4" regionChanges=95 wasmPushes=71 transport=wasm wasmMemMB=656 jsHeapMB=179 status="error: level_26__r2c4: the bot cannot walk to exit \"level_26__r2c4 -> level_27\" — the wasm playback failed: the solver declined level_26__r2c4 -> level_27 in level 26 (refusal): solverBot(wasm-exit-26): no corridor for goal reach-exit toward (72,312) in level 26. Obstacle: solid:tree (tree@128,224); also on the frontier: rocklock@112,208, rock2@128,192. No strategy row exists for this obstacle. Planner said: no walkable tile path in level 26 from tile (8,13) to (4,19). The two are in different connected components of the tiles the player box fits in — which at the v2 rung includes being separated by water, a pixelmask or a teleporter volume, none of which is a wall in the game."
```
Last time it was "~909 s" to the first stop, with 98 region changes. Now it is 815 s with 95. The refusal text is the same.

## Arm B (control): the JS runtime, seed 1

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes |
|---|---|---|---|---|---|---|---|
| B1 (`transport=js`) | **18/48** | 31 | 6.5; refused 6.6 | `level_40__r32c36`, **19/48 "Level 040 - Boss Key 2"** | walk failure plus solver deadline: "not reached within 1800 ticks — stalled at (589.99, 594.09); the planner said: no walkable tile path in level 40 from tile (36,37) to (41,33) … different connected components"; "solverBot(js-runtime-L40-location): the caller's anytime deadline (`shouldStop`) was reached at the `walk` site … ⏱ DEADLINE … this refusal may be the deadline's, not the room's"; "walking instead (after 3 retries)" | 1027.4 s (row 1036.1 s) | 103 / 68 |

```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1036.1s
[tutorial-walk-timing] seedling-whole-game: load 2.6s, start-game-page 3.6s, start-game 0.2s, bot-plays-open 0.3s, bot-plays 1027.4s
[MEASURE end] seedling-whole-game t=1034s step=bot-plays checked=31 botQueue=48 botCursor=18 botChecked=18 botRegion="level_40__r32c36" lastRegionEvent="level_40__r32c36" regionChanges=103 wasmPushes=68 transport=js wasmMemMB=? jsHeapMB=242 status="error: level_40__r32c36: the bot cannot walk to location \"Level 040 - Boss Key 2\" — the JS runtime's walk failed: not reached within 1800 ticks — stalled at (589.9897565073938, 594.0886921002361); the planner said: no walkable tile path in level 40 from tile (36,37) to (41,33). … the solver declined: solverBot(js-runtime-L40-location): the caller's anytime deadline (`shouldStop`) was reached at the `walk` site before solverBot(js-runtime-L40-location) apitem (656,528) contact's corridor (attempt 1) … ⏱ DEADLINE: the caller's `shouldStop` tripped (first at `walk`) and refused 1 `walk` scan(s) — this refusal may be the deadline's, not the room's. …; walking instead (after 3 retries)"
```
The stall point is the same as last time to the pixel ((589.99, 594.09)). The two runtimes still give **different named reasons**
at the same spot.

## Skip probe: wasm, seed 1, `TEST_MEASURE_SKIP_REFUSALS=10`

`bot-plays` 1614.3 s (row 1625.3 s), 142 region changes, 97 wasm pushes, heap 656 MB flat. ⚠ As before, read it as a **lower bound on
the work**: a row after a skip may refuse only because the skipped item was never collected.

| skip | entry | refused leg | named cause | independent? |
|---|---|---|---|---|
| 1 | **18 Level 039 - Totem Part 72,40** (sphere 6.5) | location, L39: `apitem (72,40) contact -> l39shaft (L39 shaft) -> button@160,144 route stance` | **NEW.** "the combat ladder is EXHAUSTED", danger `spinner:spinner@224,112` ("a live Spinner's HAMMER at (188.9,198.5) at horizon 71 — the exact 13 px `collideLine` at Game.time 30212 (phase 17/45, angle 136.0°)"). avoid: "STILL probes dangerous"; time: "48 px as an UPPER BOUND"; bait: "a billiard … no line to bend"; kill: "the press arm refused: a strike schedule: no (cell, tick) … over the next 1888 ticks …" | yes, but **intermittent**: 1 of 4 seed-1 wasm runs; A1/A2 landed it on the 2560-unit retry |
| 2 | 19 Level 040 - Boss Key 2 (6.6) | location, L40 | combat ladder EXHAUSTED, `bobsoldier@880,832`; 640→2560 work units | **yes (the stop)** |
| 3 | 20 Level 040 - Chest (6.7) | location, L40 apitem (880,816) | the same `bobsoldier@880,832` ("avoid: … A* goal tile (55,51) … is not walkable: danger:bobsoldier"; "time: the aim is 211 px away …") | yes (same enemy) |
| – | 21–23 (L40 Totem 160,640, L46 Chest, L48 Chest) | — | **landed** | |
| 4 | 24 Level 055 - Boss Key 3 (6.11) | exit `level_53__r14c9 -> level_54__r1c8` | "chaser kill (jellyfish@144,192) by press: jellyfish@144,192 is still in the world after the whole 174-tick bound (14 guard step(s)); it stands at (136.1,178.1), 22.5 px from the player. — and the solver ran out of 640, then 2560 work units" | yes |
| 5 | 25 Level 089 - Feather (6.12) | location, L89 | "no corridor for goal collect-placement toward (168,104) in level 89. Obstacle: pixelmask:cliffside1 (cliffside1@176,96) … **No strategy row exists for this obstacle.** … The search refused 3 UPWARD step(s) into …" (the armed waterfall) | yes |
| 6 | 26 Level 090 - Chest (6.13) | exit `level_91 -> level_89__r1c10` | combat ladder EXHAUSTED, `enemy:drill@64,80` ("priced as a static box where it stands now (72,88)"); avoid: "no walkable tile path in level 91 from tile (15,4) to (1,9)" | yes, and it **strands** the bot in L91 |
| 7–10 | 27–30 (L40 Totem 64,144, L41 Totem 240,144, L42 Totem 184,152, L57 Tentacled Beast) | — | "no path from level_91 to …, nor from the restart target Menu" | knock-on (stranded) |

Skip 1 used up one skip, so the probe ran out at entry 30, not 31 as last time. Past skip 1, the list is the previous probe's list
row for row.

```
[MEASURE skip 1] t=1098s skipping entry 18/48 "Level 039 - Totem Part 72,40" (sphere 6.5)
[MEASURE skip 2] t=1264s skipping entry 19/48 "Level 040 - Boss Key 2" (sphere 6.6)
[MEASURE skip 3] t=1281s skipping entry 20/48 "Level 040 - Chest" (sphere 6.7)
[MEASURE skip 4] t=1530s skipping entry 24/48 "Level 055 - Boss Key 3" (sphere 6.11)
[MEASURE skip 5] t=1589s skipping entry 25/48 "Level 089 - Feather" (sphere 6.12)
[MEASURE skip 6] t=1618s skipping entry 26/48 "Level 090 - Chest" (sphere 6.13)
[MEASURE skip 7..10] t=1619–1622s entries 27–30 (stranded in level_91)
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1625.3s
[MEASURE end] seedling-whole-game t=1623s step=bot-plays checked=33 botQueue=48 botCursor=30 botChecked=43 botRegion="level_91" … regionChanges=142 wasmPushes=97 transport=wasm wasmMemMB=656 jsHeapMB=190 status="error: level_91: the bot cannot walk to exit \"level_91 -> level_89__r1c10\" — the wasm playback failed: … solverBot(wasm-exit-91) reach-exit (16,144)->L89: the combat ladder is EXHAUSTED. The corridor passes through danger at (78.6,87.2) — enemy:drill@64,80 …"
```

**The next refusals today** (de-duplicated, in walk order, vanilla walk):
0. *(intermittent)* **L39 spinner@224,112**: hammer line on the `l39shaft` route to Totem Part 72,40 (entry 18). It refused 1 of 4
   times and landed on the held retry in 2 of the other 3.
1. **L40 bobsoldier@880,832**: Boss Key 2 and the L40 Chest (entries 19–20). This is the stop.
2. **L53→L54 jellyfish@144,192** press kill (Boss Key 3, entry 24).
3. **L89 Feather**: cliffside1 pixelmask / armed-waterfall corridor, "No strategy row exists" (entry 25).
4. **L91→L89 exit**: `drill@64,80` (entry 26). It strands the bot, so everything later is unseen.

Spheres 7.10+ through 13 (row 31 onward, including The Seed) are still **unmeasured**.

## Then vs now

| arm | then (`26ed405d3f`) checked | now (`1a7944a59c`) checked | then stop entry | now stop entry | then cause | now cause | then wall (`bot-plays`) | now wall |
|---|---|---|---|---|---|---|---|---|
| A wasm seed 1 | 18/48 (3/3) | **18/48 (3/3)** | 19 "Level 040 - Boss Key 2" | **19, same** | combat ladder EXHAUSTED, bobsoldier@880,832, 640→2560 units | **same, verbatim** | 1377–1432 s | **1220–1244 s** (−12 to −15 %) |
| A′ wasm seed 2 (`AP_01043188731678011336`) | 13/48 | **13/48** | 14 (level-30 row), via exit `level_26__r2c4 -> level_27` | **14, same** | tree/rocklock, "No strategy row exists" | **same, verbatim** | ~909 s to first stop | **815 s** |
| B JS seed 1 | 18/48 | **18/48** | 19 "Level 040 - Boss Key 2" | **19, same** | walk stall at (589.99,594.09) + `shouldStop` DEADLINE | **same, verbatim** | 1048.6 s | **1027.4 s** |
| skip probe wasm seed 1 | refusals at 19, 20, 24, 25, 26 (+knock-ons) | **18 (new, intermittent)**, 19, 20, 24, 25, 26 (+knock-ons) | — | — | — | the L39 spinner is new; the rest are the same | 1840.8 s | 1614.3 s |

Region changes at the stop: 103 then, 103 now (A and B). wasm pushes: 70 / 70 (A), 68 / 68 (B). Heap: 656 MB then and now.

**Did the L40 stop move?** No. Trains 35→50 (CEREMONYEXACT, CHEST_LEG_DELTA, L12 one-world, R-A4, hammer wave 6, DOOR-CARRY) did not
move the vanilla walk's first wall. It is still entry 19, "Level 040 - Boss Key 2", refused on the bobsoldier@880,832 sword
corridor with the same text, on wasm and (by a different named reason) on JS. This is consistent with wave 6 and DOOR-CARRY having
shipped OFF: the walk runs the shipped defaults. What changed is speed (the same 103 region changes in ~190 s less on wasm), plus
the L39 spinner leg one entry earlier, which now shows itself as intermittent. That leg is the one most at risk of becoming the
first wall if anything shifts timing. **Randomized seed 2:** it did not move either. Same AP id, same level set, 13/48, the same L26
tree/rocklock exit with "No strategy row exists".

## The criterion today

Robert's criterion is that the bot plays the whole randomized Seedling game to victory in the real wasm game. At main after train
50, it is exactly where it was at train 35. The vanilla walk gets 18 of 48 checks (spheres 0–6.5) in about 20 minutes, now a little
faster, and stops for good in level 40, where a bobsoldier on the only corridor to Boss Key 2 defeats every combat rung. The JS
runtime stops at the same place. The randomized seed 2 still stops sooner, at 13 of 48, on a level-26 tree/rocklock exit that no
strategy row covers. Neither wasm memory (a flat 656 MB in every run) nor any harness clock is the limit. Behind the L40 wall, the
skip probe still shows the same four independent refusals (L40 Chest, L53 jellyfish, L89 Feather, L91 drill) before the bot strands
itself near entry 26. There is now also a fragile L39 spinner leg just before L40 that refused once in four runs. So an L40 flip
that turns ON would at best uncover the L53/L89/L91 refusals next. The game past sphere 7.9 (rows 31–48, including The Seed) has
still not been seen.
