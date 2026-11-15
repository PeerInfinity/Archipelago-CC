# Cloud report: `seedling-whole-game-wasm-remeasure-3`

**The whole-game Seedling wasm walk again, after BK2 and hammer's stack. MEASURE ONLY.**

Launcher: `seedling-js-planning-19` (js-19). Ruling: Robert, 2026-11-12T17:27:50Z, "After the trio + BK2 rule land
(Recommended)". Branch: `claude/whole-game-wasm-remeasure-3-c2de9z` (the harness pinned it; no plain
`seedling-whole-game-wasm-remeasure-3` branch was pushed). Nothing was fixed. No solver, bot, wasm, `vendor/seedling`, preset or
rules file was changed. The commits are the re-applied MEASUREMENT-ONLY instrument, the run extracts
(`seedling-whole-game-wasm-remeasure-3-evidence/`) and this report.

Previous: `CC/docs/cloud-reports/seedling-whole-game-wasm-remeasure-2.md` on `claude/whole-game-wasm-remeasure-2rp6cp` (base
`2301163914`). Its method, knobs and row are reused unchanged.

## Headline

**The walk went BACKWARDS. It no longer reaches L40 Boss Key 2.** At main `c82f413c87`, vanilla seed 1 on wasm checks **9/48**
and stops at entry **10/48, "Level 029 - Boss Key 1"** (3 of 3: A1, A2 and the probe). The stop is on the route exit
`level_22__r0c6 -> level_29__r2c2`:

> solverBot(wasm-exit-22) reach-exit (192,64)->L29: the combat ladder is EXHAUSTED. The corridor passes through danger at
> (109.8,119.1) — chaser:wallflyer@48,112 (the wallflyer's contact: its `hitPlayer` gate fires against the player's start-of-tick
> box THIS tick …) — and every rung of ⚖ §11.8a's order refused: — and the solver ran out of 640, then 2560 work units on its held
> retry on exit in level 22

At re-measure-2 this exit played without comment (entry 10 → 11 in 15 s), and the walk went on to 18/48.

- **The JS control stops at the same exit.** B1 is 9/48 at entry 10, the same ladder refusal (on `wallflyer@128,80`), and then
  the JS walk stalls. So the regression is in the shared solver, not in the wasm transport.
- **Randomized seed 2 also stops there.** A′ is **9/48** (was 13/48), at entry 10 on the same exit `level_22__r0c6 -> level_29__r2c2`,
  the ladder EXHAUSTED on `wallflyer@144,112`. It never reaches last time's L28 button wall as a first wall.
- **Attributed (an extra control, measurement only): train 105, `fidelity-flip-corridor` (`90458d4c`).** I ran the same row at
  that commit and at its first parent, each with the instrument cherry-picked and the step cut at 900 s. At `39e8a29f` (the brief's train-104 SHA,
  BK2 already in) the L22→L29 exit plays a **201-tick** plan and the walk reaches 13/48 by the cut. At `90458d4c` it stops at entry
  10 with **byte-identical** refusal text. This is the corridor-flip report's own **survey step 35** ("L22 → L29 (192,64) from
  (16,128), Sword | OFF SOLVED 201 t | ON REFUSED: ladder EXHAUSTED at `wallflyer@48,112`", owner "hammer: wallflyer kill arm /
  chooser"). It was named there as a lost hit-taking solve, and hammer's stack (train 112) did not win it back.
- **So the question "did the walk get past L40 Boss Key 2?" can't be answered at this main.** The walk never gets there. The
  BK2 rules fix and the hammer-stack survey gains (steps 78, 84, 87, 227) all sit behind this new entry-10 wall, and the walk
  didn't measure any of them.
- No OOM: the wasm heap was a flat 656 MB in every run. No harness clock decided any stop at main; every stop came from
  `botCannotFinish` on the bot's own `error:`.

## Base and subject

| | |
|---|---|
| base | `c82f413c87e60a6b327c1dc8d350e562c9f6f7e5` = main at train 112+ ("train: maze-seedling-link cb50c6353e"; hammer-stack-trio is `7343a83f`, two trains below) |
| instrument | `f232811c` cherry-picked **cleanly** onto the base, giving `e8bcc58301` ("MEASUREMENT-ONLY: knobs + sampler …"), 4 files, +124/−5, the same diff as in the first report. Not for landing |
| wasm submodule `frontend/modules/flashPanel/wasm` | `9968c7dda4c08397e93b0900d73a9e8126cda8b6`, the **same** pin as all three earlier measures. `session_bootstrap.sh --all` reported READY, "seedling wasm builds: OK (4 dirs)", tree clean |
| `vendor/seedling` | `ccdf189776471fa57be8c0568c6e881a2d5acc18` (unchanged) |
| box | the cloud container: headless Chromium with WebGPU (the batch's `webgpu: true`; every wasm run reports `transport=wasm`), dev server `scripts/serve-nocache.py 8000`, one run at a time under the box lock, a fresh page per run (each run is its own `npm test`). The bootstrap's "pip headless" step was OK this time |
| row | `tutorial-walk-seedling-whole-game`, batch `tutorials-seedling-whole-game` (MANUAL, WebGPU), tutorial S4 `seedling-whole-game`, step `bot-plays` |
| subjects | seed 1 = `frontend/presets/seedling_playthrough/AP_14089154938208861744/` (vanilla). Seed 2 was generated in the tree and not committed: `python Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 2` gave **`AP_01043188731678011336`**, the expected id. The page loaded it as level set `seedling-ap-record-45602886`, the same as before. Afterwards I reverted `preset_files.json` and deleted the dir and `output/AP_01043188731678011336.zip`; `git status` was clean |
| attribution controls | a local worktree (`scripts/dev/new-worktree.sh --with-wasm`, local branch `bisect-l22`, not pushed) reset to `39e8a29f` and then to `90458d4c`, with `f232811c` cherry-picked clean each time, served on port 8130 (`npm test -- --port=8130`). Submodules there: the same wasm pin `9968c7dd` and the same `vendor/seedling` |

Order of runs: A1, A2, B1, probe, X-39e8a29f, X-90458d4c, then seed 2 was generated and A′ ran. A, B and the probe ran with
"0 tracked change(s) frozen" at head `e8bcc5830`. A′ ran with 1 frozen change (the `preset_files.json` entry), as last time.

## Knobs and values (identical to all earlier measures)

| knob | value | arms |
|---|---|---|
| `TEST_AUTO_START_TIMEOUT_MS` | `10800000` (3 h) | all |
| `TEST_TIMEOUT` | `11000000` | all |
| `TEST_MEASURE_STEP_TIMEOUT_MS` | `10800000` | A, A′, B, probe (**`900000`** for the two attribution controls only, so a run that passes entry 10 ends cheaply) |
| `TEST_MEASURE_BOT_STALL_MS` | `300000` | all |
| `TEST_MEASURE_PLAYTHROUGH_SEED` | `2` | A′ |
| `TEST_MEASURE_FLASH_RUNTIME` | `js` | B |
| `TEST_MEASURE_SKIP_REFUSALS` | `10` | probe |

Command: `npm test -- --mode=test-substrates --batch=tutorials-seedling-whole-game`, with the env above. No solver budget knob was
set: the walk ran the shipped defaults (`SOLVER_BUDGET_WORK = 640`, held retry 2560). Every row reads `PASSED` because the
ratchet grades it against its recorded `firstFailingStep: 'bot-plays'`. **PASSED is not victory.**

## Arm A: wasm, seed 1 (vanilla)

| run | checked / total (bot) | snapshot checks | last sphere | stop: region / entry | cause by name | `bot-plays` wall | region changes / wasm pushes | wasm heap |
|---|---|---|---|---|---|---|---|---|
| A1 | **9/48** | 17 | 3.7 done; stopped in 3.8 | `level_22__r0c6`, **10/48 "Level 029 - Boss Key 1"**, on route exit `level_22__r0c6 -> level_29__r2c2` | "the combat ladder is EXHAUSTED … chaser:wallflyer@48,112 … every rung of ⚖ §11.8a's order refused" (pass dashless), then "the solver ran out of 640, then 2560 work units on its held retry on exit in level 22" | 636.5 s (row 648.1 s) | 54 / 38 | 656 MB flat (43 samples) |
| A2 | 9/48 | 17 | 3.7; stopped in 3.8 | same, 10/48 | same, verbatim | 639.9 s (row 651.3 s) | 54 / 38 | 656 MB flat (43 samples) |

A1 and A2 agree, so no 3rd run was needed. The probe (also seed 1 on wasm, identical to A until its first error) hit the same
refusal at 635 s, so it is 3 of 3. No page error, no `RuntimeError`, no OOM. The only console error in each run is the usual
boot-time `Failed to load resource: … 404`.

Timeline (queue entry first seen @ s / region changes). A1: `1@15s/r2 2@150s/r11 3@165s/r15 4@180s/r19 5@225s/r21 6@330s/r34
8@405s/r39 9@435s/r43 10@645s/r54`. A2: `1@15s/r2 3@165s/r14 4@180s/r17 5@240s/r22 6@330s/r34 8@420s/r39 9@435s/r41 10@645s/r54`.
Re-measure-2's A1 read `… 9@420s/r41 10@630s/r52 11@645s/r53 …`, so the walk reaches entry 10 at the same time as before. Entry 10
is now where it ends.

The L22 leg (A1): at 615 s "routing via "level_22__r8c0 -> level_25__r2c7" … solving… (budget 640 work units)"; at 630 s
"walking to "Level 025 - Chest" (9/48) — playing tick 29/57"; at 645 s "routing via "level_22__r0c6 -> level_29__r2c2" →
level_29__r2c2 (10/48) — solving again, the room held… (budget 2560 work units, retry 1)"; end at 646 s.

Quoted (A1):
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 648.1s
[tutorial-walk-timing] seedling-whole-game: load 3.2s, start-game-page 3.9s, start-game 2.2s, bot-plays-open 0.4s, bot-plays 636.5s
[MEASURE end] seedling-whole-game t=646s step=bot-plays checked=17 botQueue=48 botCursor=9 botChecked=9 botRegion="level_22__r0c6" lastRegionEvent="level_22__r0c6" regionChanges=54 wasmPushes=38 transport=wasm wasmMemMB=656 jsHeapMB=190 status="error: level_22__r0c6: the bot cannot walk to exit \"level_22__r0c6 -> level_29__r2c2\" — the wasm playback failed: the solver declined level_22__r0c6 -> level_29__r2c2 in level 22 (pass dashless): solverBot(wasm-exit-22) reach-exit (192,64)->L29: the combat ladder is EXHAUSTED. The corridor passes through danger at (109.8,119.1) — chaser:wallflyer@48,112 (the wallflyer's contact: its `hitPlayer` gate fires against the player's start-of-tick box THIS tick (body at (103.0,120.0), forecast along the walk)) — and every rung of ⚖ §11.8a's order refused: — and the solver ran out of 640, then 2560 work units on its held retry on exit in level 22"
```
A2:
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 651.3s
[tutorial-walk-timing] seedling-whole-game: load 3.1s, start-game-page 4.2s, start-game 2.1s, bot-plays-open 0.2s, bot-plays 639.9s
[MEASURE end] seedling-whole-game t=650s step=bot-plays checked=17 botQueue=48 botCursor=9 botChecked=9 botRegion="level_22__r0c6" lastRegionEvent="level_22__r0c6" regionChanges=54 wasmPushes=38 transport=wasm wasmMemMB=656 jsHeapMB=190 status="error: level_22__r0c6: the bot cannot walk to exit \"level_22__r0c6 -> level_29__r2c2\" — … [the same text as A1, verbatim]"
```

⚠ The rendered refusal has nothing after "every rung of ⚖ §11.8a's order refused:", so the per-rung reasons are not in the bot's
status string. The corridor-flip report has them for survey step 35: "the KILL rung chose `bob@96,144`" ("no presser in level 22
arms a trap…", "bob@96,144 is not a body this run steps").

## Arm A′: wasm, randomized seed 2 (`AP_01043188731678011336`, local, uncommitted)

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes | heap |
|---|---|---|---|---|---|---|---|---|
| A′1 | **9/48** (was 13/48) | 12 | 3.6 done; stopped in 3.7 | `level_22__r0c6`, entry **10/48** (the bot was routing to `level_29__r2c2`), on route exit `level_22__r0c6 -> level_29__r2c2` | "the combat ladder is EXHAUSTED … chaser:wallflyer@144,112 (… body at (121.0,120.0) …) — and every rung of ⚖ §11.8a's order refused" (pass dashless), then 640 → 2560 work units spent | 616.7 s (row 628.8 s) | 55 / 41 | 656 MB flat (41 samples) |

Timeline: `1@15s/r2 3@165s/r15 4@180s/r19 5@225s/r21 6@315s/r34 8@390s/r37 9@555s/r49 10@615s/r53`. At 615 s: "routing via
"level_25__r2c7 -> level_22__r8c0" → level_29__r2c2 (10/48)". The status names only the target region, so I don't have the entry's
location name for this seed.

```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 628.8s
[tutorial-walk-timing] seedling-whole-game: load 3.3s, start-game-page 3.0s, start-game 3.5s, bot-plays-open 0.3s, bot-plays 616.7s
[MEASURE end] seedling-whole-game t=627s step=bot-plays checked=12 botQueue=48 botCursor=9 botChecked=9 botRegion="level_22__r0c6" lastRegionEvent="level_22__r0c6" regionChanges=55 wasmPushes=41 transport=wasm wasmMemMB=656 jsHeapMB=202 status="error: level_22__r0c6: the bot cannot walk to exit \"level_22__r0c6 -> level_29__r2c2\" — the wasm playback failed: the solver declined level_22__r0c6 -> level_29__r2c2 in level 22 (pass dashless): solverBot(wasm-exit-22) reach-exit (192,64)->L29: the combat ladder is EXHAUSTED. The corridor passes through danger at (116.5,111.2) — chaser:wallflyer@144,112 (the wallflyer's contact: its `hitPlayer` gate fires against the player's start-of-tick box THIS tick (body at (121.0,120.0), forecast along the walk)) — and every rung of ⚖ §11.8a's order refused: — and the solver ran out of 640, then 2560 work units on its held retry on exit in level 22"
```

## Arm B (control): the JS runtime, seed 1

| run | checked / total | snapshot | last sphere | stop | cause by name | `bot-plays` wall | region changes / pushes |
|---|---|---|---|---|---|---|---|
| B1 (`transport=js`) | **9/48** | 17 | 3.7; stopped in 3.8 | `level_22__r0c6`, **10/48 "Level 029 - Boss Key 1"**, exit `level_22__r0c6 -> level_29__r2c2` | the JS walk "not reached within 1800 ticks — stalled at (61.82, 132.32)"; solver: "the combat ladder is EXHAUSTED … danger at (136.7,96.4) — enemy:wallflyer@128,80 (a static "Enemy" body … priced "stepped" by `contactPricing`); chaser:wallflyer@128,80 (… forecast along the walk) — and every rung … refused"; "walking instead (after 3 retries)" | 453.1 s (row 462.2 s) | 54 / 37 |

Timeline: `1@15s/r3 3@105s/r14 4@120s/r20 5@150s/r22 6@210s/r34 8@255s/r40 9@270s/r43 10@405s/r54`.
```
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 462.2s
[tutorial-walk-timing] seedling-whole-game: load 3.1s, start-game-page 3.7s, start-game 0.2s, bot-plays-open 0.2s, bot-plays 453.1s
[MEASURE end] seedling-whole-game t=460s step=bot-plays checked=17 botQueue=48 botCursor=9 botChecked=9 botRegion="level_22__r0c6" lastRegionEvent="level_22__r0c6" regionChanges=54 wasmPushes=37 transport=js wasmMemMB=? jsHeapMB=242 status="error: level_22__r0c6: the bot cannot walk to exit \"level_22__r0c6 -> level_29__r2c2\" — the JS runtime's walk failed: not reached within 1800 ticks — stalled at (61.820389679067425, 132.31640171274313); the solver declined: solverBot(js-runtime-L22-exit) reach-exit (192,64)->L29: the combat ladder is EXHAUSTED. The corridor passes through danger at (136.7,96.4) — enemy:wallflyer@128,80 (a static \"Enemy\" body at its placement (this room is stepped, so this class is unbridged and does not move), priced \"stepped\" by `contactPricing`); chaser:wallflyer@128,80 (the wallflyer's contact: its `hitPlayer` gate fires against the player's start-of-tick box THIS tick (body at (137.0,88.0), forecast along the walk)) — and every rung of ⚖ §11.8a's order refused: — the solver declined — [the same solverBot text again]; walking instead (after 3 retries)"
```
The two runtimes refuse on different wallflyers (`@48,112` on wasm, `@128,80` on JS) but for the same reason: the forecast
contact of a wallflyer on the L22→L29 corridor, with no rung of the ladder able to deal with it.

## Skip probe: wasm, seed 1, `TEST_MEASURE_SKIP_REFUSALS=10`

`bot-plays` 693.2 s (row 704.2 s), 63 region changes, 46 wasm pushes, heap 656 MB flat (46 samples). ⚠ As before, read it as a
**lower bound**: a row after a skip may refuse only because the skipped item was never collected. That is what happens here, and
it makes this probe much less informative than last time's.

```
[MEASURE skip 1] t=635s skipping entry 10/48 "Level 029 - Boss Key 1" (sphere 3.8)
[MEASURE skip 2] t=694s skipping entry 11/48 "Level 030 - Torchpickup" (sphere 4.7)
[MEASURE skip 3] t=695s skipping entry 12/48 "Level 032 - Bob Boss" (sphere 4.8)
[MEASURE skip 4] t=696s skipping entry 13/48 "Level 032 - Times" (sphere 4.9)
[MEASURE skip 5] t=697s skipping entry 14/48 "Level 012 - Chest" (sphere 5.4)
[MEASURE skip 6] t=698s skipping entry 15/48 "Level 038 - Chest" (sphere 5.5)
[MEASURE skip 7] t=699s skipping entry 16/48 "Level 049 - Conch" (sphere 5.6)
[MEASURE skip 8] t=700s skipping entry 17/48 "Level 015 - Chest" (sphere 6.6)
[MEASURE skip 9] t=701s skipping entry 18/48 "Level 039 - Totem Part 72,40" (sphere 6.7)
[MEASURE skip 10] t=702s skipping entry 19/48 "Level 040 - Chest" (sphere 6.8)
[PROGRESS 1/1] tutorial-walk-seedling-whole-game PASSED 704.2s
[tutorial-walk-timing] seedling-whole-game: load 2.9s, start-game-page 2.9s, start-game 3.1s, bot-plays-open 0.2s, bot-plays 693.2s
[MEASURE end] seedling-whole-game t=702s step=bot-plays checked=18 botQueue=48 botCursor=19 botChecked=28 botRegion="level_28__r1c18" lastRegionEvent="level_28__r1c18" regionChanges=63 wasmPushes=46 transport=wasm wasmMemMB=656 jsHeapMB=202 status="error: no path from level_28__r1c18 to level_40__r26c13, nor from the restart target Menu"
```

**The next 10 refusals** (the probe's 10 skips, in walk order). "Survey" marks a match to a survey step that is still REFUSED on
main (the survey at main is 223/27):

| # | entry | location | refused leg | refusal (quoted) | kind | survey match |
|---|---|---|---|---|---|---|
| 1 | 10 | Level 029 - Boss Key 1 | exit `level_22__r0c6 -> level_29__r2c2` | "the combat ladder is EXHAUSTED … chaser:wallflyer@48,112 … every rung of ⚖ §11.8a's order refused: — and the solver ran out of 640, then 2560 work units" | **the stop; independent** | **yes: survey step 35** (L22 → L29 (192,64), Sword; REFUSED since the corridor flip, ladder EXHAUSTED at `wallflyer@48,112`; it is not among the steps hammer's stack newly solved (78, 84, 87, 227), so I take it as still REFUSED at main. I did not re-run the survey here) |
| 2 | 11 | Level 030 - Torchpickup | exit `level_28__r1c18 -> level_30__r2c10` | "no REACHABLE stance inside button@112,240 in level 28 — 1 cell(s) land the player box in the button and none of them plans a corridor from (136,296) … grasslock@176,208 — its group t=0 publishes only while a Solid sits on button@112,240, and NO block in this room can reach it … ⚖ Guard (iii): a hypothesis nothing can redeem DURABLY is a wall, not an optimistic gap." | **knock-on of skip 1**, most likely (below). The same text as seed 2's first wall at re-measure-2 | not matched to a numbered survey step (the L28 rock/button/grasslock is the `seedling-rules-oneway-census.md` L28 flag-0 row) |
| 3–4 | 12–13 | Level 032 - Bob Boss, Level 032 - Times | — | "no path from level_28__r1c18 to level_32, nor from the restart target Menu" | stranded in L28 | — |
| 5 | 14 | Level 012 - Chest | — | "no path from level_28__r1c18 to level_12__r42c28 …" | stranded | — |
| 6 | 15 | Level 038 - Chest | — | "no path from level_28__r1c18 to level_38 …" | stranded | — |
| 7 | 16 | Level 049 - Conch | — | "no path from level_28__r1c18 to level_49 …" | stranded | — |
| 8 | 17 | Level 015 - Chest | — | "no path from level_28__r1c18 to level_15__r6c8 …" | stranded | — |
| 9 | 18 | Level 039 - Totem Part 72,40 | — | "no path from level_28__r1c18 to level_39__r0c9 …" | stranded | — |
| 10 | 19 | Level 040 - Chest | — | "no path from level_28__r1c18 to level_40__r26c13 …" | stranded | — |

Why skip 2 is likely a knock-on: in the pre-flip control (`39e8a29f`, below), the bot picks up Boss Key 1 in L29 and reaches
L30 by **`level_31__r24c10 -> level_30__r2c10`** (t=675 s), then plays on through L30 and L32. Without Boss Key 1, the probe routes to
L30 through L28 instead ("routing via "level_27 -> level_28__r11c4" → level_30__r2c10 (11/48)") and meets the button wall. So the
probe saw **one** independent refusal and nothing past entry 11. Entries 11–48, including Boss Key 2 and The Seed, are
**unmeasured** at this main. Last time's three independent walls (L40 BK2 budget, L53 jellyfish, L91 drill) were not reached.

## Attribution control: which train moved the stop (extra, measurement only)

Same row, same knobs, wasm, seed 1, except the step cut at 900 s. A local worktree at each commit, with `f232811c`
cherry-picked clean.

| commit | what it is | checked by the end | entry 10 (L22→L29) | evidence |
|---|---|---|---|---|
| `39e8a29f` | the brief's "train 104" SHA (subject `train: seedling-solver-panel-route`; the `rules-l40-bk2` merge `cabf6a49` is its first parent, so BK2 is in). First parent of the flip | **13/48** at the 900 s cut (`botCursor=13`, "walking to "Level 012 - Chest" (14/48)") | **passes**: t=645 "routing via "level_22__r0c6 -> level_29__r2c2" … playing tick 6/201", t=660 in `level_29__r2c2` "walking to "Level 029 - Boss Key 1" (10/48) — playing tick 71/128", t=675 in `level_31__r24c10` (entry 11) | `X-39e8a29f.measure.log` |
| `90458d4c` | train 105, `fidelity-flip-corridor` (corridorBodyPricing + corridorForecastMemo ON) | **9/48**, stopped at 677 s | **refused**, byte-identical to arm A's text (`wallflyer@48,112`, (109.8,119.1), body at (103.0,120.0)) | `X-90458d4c.measure.log` |

Pre-flip timeline: `… 9@435s/r41 10@645s/r54 11@675s/r57 12@705s/r59 14@795s/r62`. The 201-tick plan the pre-flip walk plays is
the survey's OFF plan for step 35 ("SOLVED 201 t"). The corridor-flip report found that this plan **takes one hit** in the game
(p4g, t84 `wallflyer@64,80`), and that turning the flip ON made the step an honest named refusal. The flip report flagged it as a
lost solve and gave it to hammer ("wallflyer kill arm / chooser"). The walk shows what that costs: it is now the first wall of the
whole game, on both seeds and on both runtimes.

The 900 s cut means the `39e8a29f` run is a control for entry 10 only. Its 13/48 is not a full measure of that commit.

## Then vs now

| arm | then (`2301163914`) checked | now (`c82f413c87`) checked | then stop entry | now stop entry | then cause | now cause | then wall (`bot-plays`) | now wall |
|---|---|---|---|---|---|---|---|---|
| A wasm seed 1 | 18/48 (2/2; 3/3 with the probe) | **9/48 (2/2; 3/3 with the probe)** | 19 "Level 040 - Boss Key 2" | **10 "Level 029 - Boss Key 1"** | budget stop, 640 → 2560 units, `shouldStop` DEADLINE at `walk` | **L22→L29 exit: "the combat ladder is EXHAUSTED", `chaser:wallflyer@48,112`**, then 640 → 2560 units | 1560–1622 s | **636–640 s** (an earlier stop, not a faster walk) |
| A′ wasm seed 2 (`AP_01043188731678011336`) | 13/48 | **9/48** | 14 (level-30 row), exit `level_28__r1c18 -> level_30__r2c10` | **10** (the L29 row), exit `level_22__r0c6 -> level_29__r2c2` | "no REACHABLE stance inside button@112,240 in level 28" | **"the combat ladder is EXHAUSTED", `chaser:wallflyer@144,112`** | 1036.9 s | **616.7 s** |
| B JS seed 1 | 18/48 | **9/48** | 19 "Level 040 - Boss Key 2" | **10 "Level 029 - Boss Key 1"** | walk stall at (589.98,594.13) + `shouldStop` DEADLINE | **JS walk stall at (61.82,132.32) + ladder EXHAUSTED on `wallflyer@128,80`** | 1032.3 s | **453.1 s** |
| skip probe wasm seed 1 | 3 independent (19 BK2, 24 L53 jellyfish, 25 L91 drill) + knock-ons; ran out at entry 32 | **1 independent (10 BK1, L22 wallflyer)**, 1 likely knock-on (11, L28 button), then stranded; ran out at entry 19 | — | — | — | — | 2099.7 s | 693.2 s |

Region changes at the stop: 103 then, 54 now (A); 103 then, 54 now (B). wasm pushes 70 then, 38 now (A). Snapshot checks at the
stop: 32 then, 17 now. Heap: 656 MB then and now. Up to entry 10 the walk is the same as before: the same entries at the same
times (entry 10 first seen at 630–645 s in both).

**Did the walk get past L40 Boss Key 2?** **No, and it doesn't reach it.** The new first wall is **entry 10/48, "Level 029 - Boss
Key 1"**, on the route exit `level_22__r0c6 -> level_29__r2c2`: `solverBot(wasm-exit-22) reach-exit (192,64)->L29: the combat ladder
is EXHAUSTED. The corridor passes through danger at (109.8,119.1) — chaser:wallflyer@48,112 … every rung of ⚖ §11.8a's order
refused: — and the solver ran out of 640, then 2560 work units on its held retry on exit in level 22`. It is 3 of 3 on wasm, also on
JS, and it is survey step 35, lost at train 105 (`90458d4c`). **Seed 2** stops at the same exit (entry 10, `wallflyer@144,112`),
9/48, down from 13/48. Last time's L28 button wall is now hidden behind it.

## The criterion today

Robert's criterion is that the bot plays the whole randomized Seedling game to victory in the real wasm game. At main
`c82f413c87` the walk is further from that than at re-measure-2. Both the vanilla and the randomized seed now stop at 9 of 48
checks, on the way to Boss Key 1, about 10½ minutes in. They stop at the L22 exit toward L29, where the solver can't find a
corridor past a wallflyer and every combat rung refuses. This isn't a budget or memory question: the heap stays a flat 656 MB, and
the refusal is the room's answer, not a deadline. It is also not new to the planners: it is survey step 35, the hit-taking solve
the corridor flip (train 105) gave up so it would not take a real hit, with the wallflyer kill arm left to hammer. Hammer's stack
won other steps back but not this one. Everything that landed for the later walls (the BK2 rules fix, the L53/L88/L91 survey
gains) sits behind this wall, and this walk didn't measure it. The skip probe can't see past it either, because skipping Boss Key
1 sends the route through L28's button and strands it. To learn whether those later fixes move the walk, step 35 has to solve
again first, either through a wallflyer kill arm or another hitless corridor. Then this measure needs re-running.

## Leftovers on the box

- The local worktree `/home/user/Archipelago-CC-wt-bisect-l22` (local branch `bisect-l22` at `84bde134` = `90458d4c` +
  the instrument) is left in place, not pushed. Under CLAUDE.md, sessions don't remove worktrees, and the container is ephemeral.
- I set `extensions.worktreeConfig true` in this clone's local git config, because `new-worktree.sh` needs it.
- Both dev servers I started (ports 8000 and 8130) were stopped by literal PID.
