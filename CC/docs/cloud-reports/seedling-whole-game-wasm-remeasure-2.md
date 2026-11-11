# Cloud report: `seedling-whole-game-wasm-remeasure-2`

**The whole-game Seedling wasm walk again, after the volley flip. MEASURE ONLY.**

Launcher: `seedling-js-planning-17` (js-17). Ruling: Robert, 2026-11-11T18:01:35Z, "After the volley flip (Recommended)".
Branch: `claude/whole-game-wasm-remeasure-2rp6cp` (the harness pinned it; there is no plain
`seedling-whole-game-wasm-remeasure-2` branch). Nothing was fixed. No solver, bot, wasm, `vendor/seedling`, preset or rules file
was changed. The only commits are the re-applied MEASUREMENT-ONLY instrument and this report.

Previous report: `CC/docs/cloud-reports/seedling-whole-game-wasm-remeasure.md` on
`claude/seedling-whole-game-wasm-remeasure-s299vp` (base `1a7944a59c`). Its method, knobs and row are reused here unchanged.

## Headline

**The vanilla walk did NOT get past L40 Boss Key 2.** At main `2301163914` (train 92, the volley flip), seed 1 on wasm still
checks **18/48** and stops at entry **19/48, "Level 040 - Boss Key 2"**, 2 of 2 runs. What changed is the **cause**. The old
refusal ("the combat ladder is EXHAUSTED" on `chaser:bobsoldier@880,832`) is gone. The stop is now a **budget stop**: "the solver
ran out of 640, then 2560 work units on its held retry", with "⏱ DEADLINE: the caller's `shouldStop` tripped (first at `walk`) …
this refusal may be the deadline's, not the room's". The leg gave up about 27 s of wall time after the bot arrived (entry 19 first
seen at 1606 s, end at 1633 s, in A1). So the solve that the volley flip measured at a 480 s leg does not fit inside the walk's
640 → 2560 work units.

Behind that stop, more moved (skip probe):
- **L40 Chest (entry 20) now lands** (on its 2560-unit held retry). It refused last time on the same bobsoldier.
- **L39 Totem Part 72,40 (entry 18) landed first try in all 3 seed-1 wasm runs.** It was intermittent last time.
- **L53→L54 jellyfish (entry 24) still refuses**, with a different text (the dwell was HIT).
- **L89 Feather (entry 25) now routes through L91** and strands there on the same `drill@64,80` one entry earlier than before. So
  the old L89 cliffside refusal was not reached this time (unseen, not known fixed).
- Independent refusals in the probe: **3** (L40 Boss Key 2, L53 jellyfish, L91 drill). It was 5, plus the intermittent L39 one.

**Randomized seed 2 moved its wall.** Still 13/48 and entry 14, but it now gets through the old L26 tree/rocklock exit and stops two
rooms later, at exit `level_28__r1c18 -> level_30__r2c10`: "no REACHABLE stance inside button@112,240 in level 28".

The JS control is unchanged: 18/48, entry 19, the same walk stall and `shouldStop` deadline. The wasm walk is **slower** now:
`bot-plays` 1560–1622 s to the same stop (it was 1220–1244 s). No OOM in any run: the wasm heap stayed flat at 656 MB.

## Base and subject

| | |
|---|---|
| base | `2301163914a6f7e0da6f6eeb1cde01554df3fbf6` = main at train 92 ("train: hammer-flip-volley-order d18deb3ff2") |
| instrument | `f232811c` cherry-picked **cleanly** onto the base, giving `a5560fc875` ("MEASUREMENT-ONLY: knobs + sampler …"), 4 files, +124/−5: `frontend/modules/tests/testCases/tutorialTests.js` (+102), `frontend/modules/tutorials/content/seedling/seedling.js`, `frontend/modules/tutorials/content/steps/procgen.js`, `test_json/e2e/app.spec.js` (+17). The diff is the one in the first report, so it is not repeated here. Not for landing |
| wasm submodule `frontend/modules/flashPanel/wasm` | `9968c7dda4c08397e93b0900d73a9e8126cda8b6`, the **same** pin as both earlier measures. `session_bootstrap.sh --all` reported READY with "seedling wasm builds: OK (4 dirs)" |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` (unchanged) |
| box | the cloud container: headless Chromium with WebGPU (the batch's `webgpu: true`; every wasm run reports `transport=wasm`), dev server `scripts/serve-nocache.py 8000`, one run at a time under the box lock, a fresh page per run (each run is its own `npm test` invocation). The bootstrap's "pip headless" step FAILED again (this row doesn't use it); everything else was OK |
| row | `tutorial-walk-seedling-whole-game`, batch `tutorials-seedling-whole-game` (MANUAL, WebGPU), tutorial S4 `seedling-whole-game`, step `bot-plays` |
| subjects | seed 1 = `frontend/presets/seedling_playthrough/AP_14089154938208861744/` (vanilla). Seed 2 was generated locally and not committed: `python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2` gave **`AP_01043188731678011336`**, the expected id, and the page loaded it as level set `seedling-ap-record-45602886` (the same as before). Afterwards I reverted `preset_files.json` and deleted the dir and its `output/` zip |

Order of runs: A1, A2, B1, probe, then seed 2 was generated and A′ ran. So A, B and the probe ran with "0 tracked change(s)
frozen" at head `a5560fc87`, and only A′ ran with the 1 frozen change (the `preset_files.json` entry).

⚠ The sphere labels shifted against the last report (Boss Key 2 was "sphere 6.6", now "6.8") because of the rules slices on main.
The queue order and the 48 entries are the same, so the entry numbers compare directly.

## Knobs and values (identical to both earlier measures)

| knob | value | arms |
|---|---|---|
| `TEST_AUTO_START_TIMEOUT_MS` | `10800000` (3 h) | all |
| `TEST_TIMEOUT` | `11000000` | all |
| `TEST_MEASURE_STEP_TIMEOUT_MS` | `10800000` | all |
| `TEST_MEASURE_BOT_STALL_MS` | `300000` | all |
| `TEST_MEASURE_PLAYTHROUGH_SEED` | `2` | A′ |
| `TEST_MEASURE_FLASH_RUNTIME` | `js` | B |
| `TEST_MEASURE_SKIP_REFUSALS` | `10` | probe |

Command: `npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game`, with the env above. No solver budget knob was
set: the walk ran the shipped defaults (`SOLVER_BUDGET_WORK = 640`, held retry 2560). In every arm the bot's status turned to
`error: …` and `botCannotFinish` ended the step at once, so neither the 3 h clock nor the 300 s stall window decided any stop. Every
row reads `PASSED` because the ratchet grades it against its recorded `firstFailingStep: 'bot-plays'`. **PASSED is not victory.**

## Arm A: wasm, seed 1 (vanilla)

| run | checked / total (bot) | snapshot checks | last sphere | stop: region / entry | cause by name | `bot-plays` wall | region changes / wasm pushes | wasm heap |
|---|---|---|---|---|---|---|---|---|
| A1 | **18/48** | 32 | 6.7 done; stopped in 6.8 | `level_40__r32c36`, **19/48 "Level 040 - Boss Key 2"** | budget stop: "the solver ran out of 640, then 2560 work units on its held retry on location in level 40"; `solverBot(wasm-location-40)`: "the caller's anytime deadline (`shouldStop`) was reached at the `walk` site before … apitem (656,528) contact's corridor (attempt 1)"; "⏱ DEADLINE … this refusal may be the deadline's, not the room's" | 1621.6 s (row 1635.5 s) | 103 / 70 | 656 MB flat (108 samples) |
| A2 | 18/48 | 32 | 6.7; stopped in 6.8 | same, 19/48 | same, verbatim | 1560.3 s (row 1573.3 s) | 103 / 70 | 656 MB flat (104 samples) |

A1 and A2 agree, so no 3rd run was needed. The probe run (also seed 1 on wasm, and identical to A until its first error) reached
the same stop with the same text at 1502 s, so it is 3 of 3 on this stop. No page error, no `RuntimeError`, no OOM. The only console
error in each run is the one boot-time `Failed to load resource: … 404`, as before.

Timeline (A1, queue entry first seen @ s / region changes): `1@15s/r2 3@165s/r14 4@180s/r19 5@240s/r22 6@330s/r34 8@405s/r39
9@420s/r41 10@630s/r52 11@645s/r53 12@690s/r58 14@765s/r58 15@975s/r69 16@1110s/r74 17@1200s/r82 18@1230s/r89 19@1606s/r103`.
A2: `… 15@930s/r69 16@1050s/r74 17@1155s/r86 18@1185s/r90 19@1545s/r103`. Last time A1 read `… 18@945s/r89 19@1230s/r103`, so the
walk reaches entry 18 about 4–5 minutes later than it did, and entry 18 itself takes ~6 min (a 1790-tick route leg, then a
3860-tick solved leg in L39).

**Entry 18 ("Level 039 - Totem Part 72,40") was not marginal this time.** In A1, A2 and the probe, the sampler saw
"solving… (budget 640 work units)" and then "playing tick …/3860", with no held retry and no refusal.

**The L40 leg (A1):** the first tick at the entry is at t=1606 s, "walking to "Level 040 - Boss Key 2" (19/48)". At 1620 s it reads
"solving again, the room held… (budget 2560 work units, retry 1)". The end is at 1633 s. Both budgets were spent in ~27 s.

Quoted (A1):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1635.5s
[tutorial-walk-timing] seedling-whole-game: load 3.7s, start-game-page 4.7s, start-game 2.9s, bot-plays-open 0.3s, bot-plays 1621.6s
[MEASURE tick] seedling-whole-game t=1620s … status="Sphere 6.8 → walking to \"Level 040 - Boss Key 2\" (19/48) — solving again, the room held… (budget 2560 work units, retry 1)"
[MEASURE end] seedling-whole-game t=1633s step=bot-plays checked=32 botQueue=48 botCursor=18 botChecked=18 botRegion="level_40__r32c36" lastRegionEvent="level_40__r32c36" regionChanges=103 wasmPushes=70 transport=wasm wasmMemMB=656 jsHeapMB=169 status="error: level_40__r32c36: the bot cannot walk to location \"Level 040 - Boss Key 2\" — the wasm playback failed: the solver ran out of 640, then 2560 work units on its held retry on location in level 40: solverBot(wasm-location-40): the caller's anytime deadline (`shouldStop`) was reached at the `walk` site before solverBot(wasm-location-40) apitem (656,528) contact's corridor (attempt 1) — the segment's own work is bounded there, so the solve stops here instead of overrunning. ⏱ DEADLINE: the caller's `shouldStop` tripped (first at `walk`) and refused 1 `walk` scan(s) — this refusal may be the deadline's, not the room's."
```
A2:
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1573.3s
[tutorial-walk-timing] seedling-whole-game: load 3.5s, start-game-page 5.0s, start-game 2.0s, bot-plays-open 0.4s, bot-plays 1560.3s
[MEASURE end] seedling-whole-game t=1571s step=bot-plays checked=32 botQueue=48 botCursor=18 botChecked=18 botRegion="level_40__r32c36" … regionChanges=103 wasmPushes=70 transport=wasm wasmMemMB=656 jsHeapMB=179 status="error: level_40__r32c36: the bot cannot walk to location \"Level 040 - Boss Key 2\" — the wasm playback failed: the solver ran out of 640, then 2560 work units on its held retry on location in level 40: solverBot(wasm-location-40): the caller's anytime deadline (`shouldStop`) was reached at the `walk` site … [the same text as A1]"
```

## Arm A′: wasm, randomized seed 2 (`AP_01043188731678011336`, local, uncommitted)

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes | heap |
|---|---|---|---|---|---|---|---|---|
| A′1 | **13/48** | 17 | 4.6 done; stopped in 4.7 | `level_28__r1c18`, entry **14/48** (the level-30 row; the bot was routing to `level_30__r2c10`), on the route exit `level_28__r1c18 -> level_30__r2c10` | solver refusal: "no REACHABLE stance inside button@112,240 in level 28 — 1 cell(s) land the player box in the button and none of them plans a corridor from (136,296)"; prerequisite `grasslock@176,208` "… NO block in this room can reach it"; "⚖ Guard (iii): a hypothesis nothing can redeem DURABLY is a wall, not an optimistic gap" | 1036.9 s (row 1049.8 s) | 98 / 74 | 656 MB flat |

Route at entry 14 (15 s samples): L14 → L0 → L12 → L22 → L28 ("breaking rope@160,64 first (flag:L28:0)") → L25 →
**`level_26__r2c4 -> level_27`** (played, tick 231/286 at 1035 s; this exit was the wall last time) → `level_28__r1c18`, the stop
at 1047 s. Timeline: `1@15s/r2 3@150s/r14 4@182s/r20 5@225s/r22 6@315s/r34 8@390s/r40 9@540s/r49 10@615s/r53 11@630s/r57
12@750s/r67 13@855s/r78 14@885s/r83`.

```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1049.8s
[tutorial-walk-timing] seedling-whole-game: load 3.6s, start-game-page 4.6s, start-game 1.9s, bot-plays-open 0.3s, bot-plays 1036.9s
[MEASURE end] seedling-whole-game t=1047s step=bot-plays checked=17 botQueue=48 botCursor=13 botChecked=13 botRegion="level_28__r1c18" lastRegionEvent="level_28__r1c18" regionChanges=98 wasmPushes=74 transport=wasm wasmMemMB=656 jsHeapMB=169 status="error: level_28__r1c18: the bot cannot walk to exit \"level_28__r1c18 -> level_30__r2c10\" — the wasm playback failed: the solver declined level_28__r1c18 -> level_30__r2c10 in level 28 (refusal): solverBot: no REACHABLE stance inside button@112,240 in level 28 — 1 cell(s) land the player box in the button and none of them plans a corridor from (136,296). A hold that cannot be stood on is not a strategy for this obstacle. ⛔ AND THE PREREQUISITES WERE TRIED AND REFUSED, one at a time: grasslock@176,208 — its group t=0 publishes only while a Solid sits on button@112,240, and NO block in this room can reach it — so the only order that could open it is a `hold` the walker shuts again by leaving. ⚖ Guard (iii): a hypothesis nothing can redeem DURABLY is a wall, not an optimistic gap."
```

## Arm B (control): the JS runtime, seed 1

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes |
|---|---|---|---|---|---|---|---|
| B1 (`transport=js`) | **18/48** | 32 | 6.7; stopped in 6.8 | `level_40__r32c36`, **19/48 "Level 040 - Boss Key 2"** | walk failure plus solver deadline: "not reached within 1800 ticks — stalled at (589.98, 594.13); the planner said: no walkable tile path in level 40 from tile (36,37) to (41,33) … different connected components"; "solverBot(js-runtime-L40-location): the caller's anytime deadline (`shouldStop`) was reached at the `walk` site … ⏱ DEADLINE …"; "walking instead (after 3 retries)" | 1032.3 s (row 1042.6 s) | 103 / 68 |

```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 1042.6s
[tutorial-walk-timing] seedling-whole-game: load 3.3s, start-game-page 4.6s, start-game 0.2s, bot-plays-open 0.2s, bot-plays 1032.3s
[MEASURE end] seedling-whole-game t=1041s step=bot-plays checked=32 botQueue=48 botCursor=18 botChecked=18 botRegion="level_40__r32c36" lastRegionEvent="level_40__r32c36" regionChanges=103 wasmPushes=68 transport=js wasmMemMB=? jsHeapMB=257 status="error: level_40__r32c36: the bot cannot walk to location \"Level 040 - Boss Key 2\" — the JS runtime's walk failed: not reached within 1800 ticks — stalled at (589.9758029528646, 594.1297635549287); the planner said: no walkable tile path in level 40 from tile (36,37) to (41,33). The two are in different connected components of the tiles the player box fits in — which at the v2 rung includes being separated by water, a pixelmask or a teleporter volume, none of which is a wall in the game.; the solver declined: solverBot(js-runtime-L40-location): the caller's anytime deadline (`shouldStop`) was reached at the `walk` site before solverBot(js-runtime-L40-location) apitem (656,528) contact's corridor (attempt 1) — the segment's own work is bounded there, so the solve stops here instead of overrunning. ⏱ DEADLINE: the caller's `shouldStop` tripped (first at `walk`) and refused 1 `walk` scan(s) — this refusal may be the deadline's, not the room's. — the solver declined — [the same solverBot text again]; walking instead (after 3 retries)"
```
Same stop, same reason and nearly the same wall time as last time (1027.4 s). The stall point moved by a few hundredths of a pixel
((589.99, 594.09) then). **The two runtimes now name the same solver reason** at this spot (the `shouldStop` deadline at the `walk`
site); the JS runtime then also tries its plain walk and stalls.

## Skip probe: wasm, seed 1, `TEST_MEASURE_SKIP_REFUSALS=10`

`bot-plays` 2099.7 s (row 2112.8 s), 138 region changes, 95 wasm pushes, heap 656 MB flat (140 samples). ⚠ As before, read it as a
**lower bound on the work**: a row after a skip may refuse only because the skipped item was never collected.

| skip | entry | refused leg | named cause | independent? |
|---|---|---|---|---|
| – | 18 Level 039 - Totem Part 72,40 | — | **landed** first try (refused in last time's probe) | |
| 1 | **19 Level 040 - Boss Key 2** (sphere 6.8) | location, L40 apitem (656,528) | "the solver ran out of 640, then 2560 work units on its held retry"; `shouldStop` DEADLINE at the `walk` site (the same text as arm A) | **yes (the stop)** |
| – | 20 Level 040 - Chest (6.9) | — | **landed**, on "solving again, the room held… (budget 2560 work units, retry 1)", then a 1234-tick play. It refused last time | |
| – | 21 Level 040 - Totem Part 160,640 (6.10) | — | **landed**, after "re-entering level 40 (forced-re-arrival: the solver declined … `solverBot(wasm-continue-location-40)` apitem (160,640) contact: the combat ladder is EXHAUSTED … `spinner:spinner@816,848` (a live Spinner BODY at (577.9,676.4) at horizon 460 …))". The continue-solve refused and the re-entry solved it | |
| – | 22–23 (L46 Chest, L48 Chest) | — | **landed** | |
| 2 | 24 Level 055 - Boss Key 3 (6.13) | exit `level_53__r14c9 -> level_54__r1c8` | "reach-exit (144,240)->L54 -> kill -> chaser kill (jellyfish@152,168) by press: **the dwell was HIT at dwell tick 145** (run tick 374; source chaser jellyfish@144,192; 14 guard step(s) so far). The run is the oracle; the stance and the lapse guard were a heuristic. — and the solver ran out of 640, then 2560 work units on its held retry on exit in level 53" | yes |
| 3 | 25 Level 089 - Feather (6.14) | exit `level_91 -> level_89__r1c10` | "the combat ladder is EXHAUSTED … danger at (78.6,87.2) — `enemy:drill@64,80` (a stepped drill, priced as a static box where it stands now (72,88) (`drillMixedRooms` …))"; avoid: "no walkable tile path in level 91 from tile (15,4) to (1,9)"; time: "the aim is 238 px away … 48 px as an UPPER BOUND"; bait: "NO LIVE BODY's removal admits a corridor … roster is [bob@128,64, bob@160,96, bob@192,80]"; kill: "the danger on this corridor is not a body this run can watch die"; narrow: "dangerous too — enemy:drill@64,80"; forced-hit: "no forced hit is proven from (248.0,72.0)" | yes, and it **strands** the bot in L91 |
| 4 | 26 Level 090 - Chest (6.15) | the same exit, `level_91 -> level_89__r1c10` | the same drill refusal | knock-on (same exit) |
| 5–8 | 27–30 (L40 Totem 64,144, L41 Totem 240,144, L42 Totem 184,152, L57 Tentacled Beast) | — | "no path from level_91 to …, nor from the restart target Menu" | knock-on (stranded) |
| 9–10 | 31–32 (L64 Ghostspear, L43 Wand) | the same exit | the same drill refusal | knock-on (stranded) |

The Feather's route this time: L12 → L88 → L87 → L92 → **L91** → (refused) L89. Last time the bot was in L89 for the Feather and
refused there on `pixelmask:cliffside1`, then hit this drill on the next entry. Now the drill comes first, so the L89 Feather leg
itself was **not reached**.

```
[MEASURE skip 1] t=1502s skipping entry 19/48 "Level 040 - Boss Key 2" (sphere 6.8)
[MEASURE skip 2] t=1980s skipping entry 24/48 "Level 055 - Boss Key 3" (sphere 6.13)
[MEASURE skip 3] t=2100s skipping entry 25/48 "Level 089 - Feather" (sphere 6.14)
[MEASURE skip 4] t=2102s skipping entry 26/48 "Level 090 - Chest" (sphere 6.15)
[MEASURE skip 5] t=2103s skipping entry 27/48 "Level 040 - Totem Part 64,144" (sphere 7.6)
[MEASURE skip 6] t=2104s skipping entry 28/48 "Level 041 - Totem Part 240,144" (sphere 7.7)
[MEASURE skip 7] t=2105s skipping entry 29/48 "Level 042 - Totem Part 184,152" (sphere 7.8)
[MEASURE skip 8] t=2106s skipping entry 30/48 "Level 057 - Tentacled Beast" (sphere 7.9)
[MEASURE skip 9] t=2108s skipping entry 31/48 "Level 064 - Ghostspear" (sphere 7.10)
[MEASURE skip 10] t=2110s skipping entry 32/48 "Level 043 - Wand" (sphere 8.4)
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 2112.8s
[tutorial-walk-timing] seedling-whole-game: load 3.7s, start-game-page 4.8s, start-game 1.8s, bot-plays-open 0.5s, bot-plays 2099.7s
[MEASURE end] seedling-whole-game t=2111s step=bot-plays checked=36 botQueue=48 botCursor=32 botChecked=46 botRegion="level_91" lastRegionEvent="level_91" regionChanges=138 wasmPushes=95 transport=wasm wasmMemMB=656 jsHeapMB=179 status="error: no path from level_91 to level_67__r3c2, nor from the restart target Menu"
```
(`botChecked=46` counts skipped heads as seen; the snapshot's 36 is the real count of checks.)

**The next 10 refusals** (the probe's 10 skips, in walk order):

| # | entry | location | refusal | kind |
|---|---|---|---|---|
| 1 | 19 | Level 040 - Boss Key 2 | 640 → 2560 work units spent; `shouldStop` DEADLINE at `walk` | the stop |
| 2 | 24 | Level 055 - Boss Key 3 | L53→L54, jellyfish press kill: "the dwell was HIT at dwell tick 145"; 640 → 2560 spent | independent |
| 3 | 25 | Level 089 - Feather | L91→L89, `drill@64,80`, combat ladder EXHAUSTED | independent; strands the bot |
| 4 | 26 | Level 090 - Chest | the same L91→L89 drill | same exit |
| 5 | 27 | Level 040 - Totem Part 64,144 | "no path from level_91 to level_40__r0c53" | stranded |
| 6 | 28 | Level 041 - Totem Part 240,144 | "no path from level_91 to level_41__r7c15" | stranded |
| 7 | 29 | Level 042 - Totem Part 184,152 | "no path from level_91 to level_42" | stranded |
| 8 | 30 | Level 057 - Tentacled Beast | "no path from level_91 to level_57" | stranded |
| 9 | 31 | Level 064 - Ghostspear | the same L91→L89 drill | stranded |
| 10 | 32 | Level 043 - Wand | the same L91→L89 drill | stranded |

So the list holds **three** distinct walls: L40 Boss Key 2 (budget), L53 jellyfish, L91 drill. Entries 27–32 say nothing about their
own rooms. Entries 33–48 (including The Seed) are still **unmeasured**, and so is the L89 Feather leg behind the drill.

## Then vs now

| arm | then (`1a7944a59c`) checked | now (`2301163914`) checked | then stop entry | now stop entry | then cause | now cause | then wall (`bot-plays`) | now wall |
|---|---|---|---|---|---|---|---|---|
| A wasm seed 1 | 18/48 (3/3) | **18/48 (2/2; 3/3 with the probe)** | 19 "Level 040 - Boss Key 2" | **19, same** | "the combat ladder is EXHAUSTED", `bobsoldier@880,832`, then 640 → 2560 units | **changed:** 640 → 2560 units spent, `shouldStop` DEADLINE at the `walk` site, no ladder refusal | 1220–1244 s | **1560–1622 s** (+27 to +31 %) |
| A′ wasm seed 2 (`AP_01043188731678011336`) | 13/48 | **13/48** | 14 (level-30 row), at exit `level_26__r2c4 -> level_27` | **14, same entry; two rooms further**, at exit `level_28__r1c18 -> level_30__r2c10` | tree/rocklock, "No strategy row exists for this obstacle" | **changed:** "no REACHABLE stance inside button@112,240 in level 28"; `grasslock@176,208` prerequisite refused | 814.9 s | **1036.9 s** |
| B JS seed 1 | 18/48 | **18/48** | 19 "Level 040 - Boss Key 2" | **19, same** | walk stall at (589.99,594.09) + `shouldStop` DEADLINE | **same** (stall at (589.98,594.13)) | 1027.4 s | **1032.3 s** |
| skip probe wasm seed 1 | refusals at 18 (intermittent), 19, 20, 24, 25 (L89 cliffside), 26 (L91 drill) + knock-ons; ran out at entry 30 | refusals at **19, 24, 25 (L91 drill)** + knock-ons; ran out at entry 32 | — | — | — | entries 18 and 20 now land; the L53 text changed; the L89 cliffside was not reached | 1614.3 s | 2099.7 s |

Region changes at the stop: 103 then, 103 now (A and B). wasm pushes: 70 / 70 (A), 68 / 68 (B). Snapshot checks at the stop: 31
then, 32 now. Heap: 656 MB then and now.

**Did the walk get past L40 Boss Key 2?** **No.** On the vanilla seed, the first wall is still entry 19/48, "Level 040 - Boss Key
2", on wasm (3 of 3 including the probe) and on JS. The refusal is new: `the solver ran out of 640, then 2560 work units on its held
retry on location in level 40 … ⏱ DEADLINE: the caller's shouldStop tripped (first at walk) and refused 1 walk scan(s) — this
refusal may be the deadline's, not the room's.` The combat-ladder refusal on the bobsoldier no longer appears, and the neighbouring
L40 Chest, which died on the same bobsoldier, now lands. So the flips changed the room's answer, and what stops the walk now is the
walk's own work budget: both attempts end about 27 s after arrival, against the 480 s leg the flip was measured at. I did not vary
the budget (it would be a new knob, outside this measure).

**Randomized seed 2:** it moved, but not in count. Still 13/48 and entry 14. The old wall (the L26 tree/rocklock exit) is passed,
and the new first wall is the next exit on the same route, `level_28__r1c18 -> level_30__r2c10`: `no REACHABLE stance inside
button@112,240 in level 28 … grasslock@176,208 … NO block in this room can reach it`.

**Wall time got worse on wasm.** The same 103 region changes to the same stop took 1560–1622 s (was 1220–1244 s). The JS control
did not slow down (1032 s vs 1027 s), so the extra time is on the wasm side of the walk, not in the box.

## The criterion today

Robert's criterion is that the bot plays the whole randomized Seedling game to victory in the real wasm game. At main after train
92 the count hasn't moved: the vanilla walk still gets 18 of 48 checks and stops at level 40's Boss Key 2, and it now takes about 26
minutes to get there, not 20. The reason it stops is different, though. The room no longer refuses the bobsoldier corridor; the
solver runs out of its 640 and then 2560 work units before it finishes, and says the refusal may be the deadline's and not the
room's. So the next question for this stop is the walk's budget for that leg, not another combat rung. Past it, the list is shorter
than it was: the L40 Chest and the L39 spinner leg now land, and only two more independent walls show before the bot strands itself
at entry 25, the L53 jellyfish press kill and the L91 drill. The randomized seed 2 still stops at 13 of 48, one wall further on, at
a level-28 button that nothing can hold down. Memory isn't a limit (a flat 656 MB in every run) and no harness clock decided any
stop. Entries 33 to 48, including The Seed, and the L89 Feather leg behind the drill, have still not been seen.
