# Seedling fidelity WATCHER: the L37 watcher, and the Watcher model

**Slice:** `seedling-fidelity-watcher`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-2`, wave 4). ⚖ The user chose it on 2026-10-05.

| | |
|---|---|
| Started from | `origin/fidelity-harvest/wave3` @ **`b116c69`** (`b116c69fe57f5ad807e710f5231a208002932407`), as briefed |
| Head | the commit that adds this report (the last on the branch). The code head is **`81d47fe`** (D1 STOP, the held square) |
| Harness branch | `claude/watcher-proximity-hazard-strategy-wy4wlf` (the brief's local name `seedling-fidelity-watcher` was not used; the harness branch is the only one pushed) |
| Commits | D1 **`101c6b1`** · D2 **`3fbe10c`** · D3 records `ef732dd` · **D1 STOP `81d47fe`** · docs `e9e6cdf` · this report |
| Dev server | `serve-nocache.py 9290` (`SEEDLING_PORT=9290`) over this tree. A development worktree (`/home/user/wt-watcher`, never pushed) was served on 9291 for the recordings |
| Verdicts | **W0 PASS · D1 PASS with one part STOPPED and held (the silent square, below) · D2 PASS · D3 PASS** |

## The one thing to know first

**The L37 watcher was never an obstacle. The model's census was wrong about watchers, three ways at once.**

1. Ten of the eleven placed watchers have `text=""`. `NPC.talk()` runs only `if (p && myText[0].length > 0)` (`NPCs/NPC.as:188`), so they never talk, never freeze the game and never write a tag. L37's `watcher@104,264` is one of the ten.
2. The talk volume is a 24 px disc (`FP.distance <= talkRange`). The census priced it as the 48x48 square, and both survey walks pass 30.9 / 32.9 px from the centre: inside the square's corners, outside the circle.
3. A cleared tag also silences a watcher, and the census did not know that either.

**⛔ Removing the silent squares moves a committed tape**: `r9-solve-12` (L12) re-derives 2,419 → 2,364 t, and `r9-campaign --check` goes exit 1. So that part STOPPED.
- The silent squares are **held** as planner volumes (`kind: 'held-silent'`), while the census still lists the placements in `silentHazards`.
- The `talk` row the brief asked for walks through a held square at zero cost where it is a wall. That is how 95 and 101 solve, and the campaign is byte-identical (`b29b589b…`).
- The same row also pages L114's one SPEAKING watcher, game-witnessed.
- **Releasing the hold** is one deletion plus `r9-solve-12`'s re-record. That decision is the coordinator's.

**The survey moves 146 / 116 / 3 → 148 / 114 / 3, and only steps 66, 95 and 101 change.** The new first refusal past 2.2 is **step 96 (L38): `proximity-hazard:buttonroom`**, VERB-MISSING. Step 94 is still the first non-SOLVED row (TIMEOUT).

## W0 (at `b116c69`, before any edit)

| Row | Command | Result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY` (python 3.11.15, node v22.22.0, 4 wasm build dirs, tree clean) |
| identity block | `SEEDLING_PORT=9290 bash scripts/procgen/identity-block.sh .`, venv active | log in the table below. ⚠ the `generated set` row printed a box-lock line (my recording held the box at that moment); re-measured alone on the same pristine tree: **`OK`** |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, **all exit 0** (BURN's banked values, unchanged by wave 3) |
| reference | the block's last row | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| bounded vitest BEFORE | 50 files: the brief's list, plus every `*.test.*` naming `watcher` (`rg -ali watcher`, 24 files) and BURN's pin files (`r8Acceptance`, `rosterCategories`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `procgenWeigh`, `fidelityBurn`, `fidelityDescent`) | **50 files / 2,301 tests, 2 red, both standing at the base:** `rosterCategories.test.js:175` *"expected 149 to be 150"*, and `r8Acceptance` R8_ENEMY_BRIDGE *"Undeclared and exposed: cancross-l16-sword-none"* (wave 3's tape) |
| tapeRunner | sorted `(fullName, status)` lines from the BEFORE json | **477**, md5 `5bdf547cd654e69b2cf239e1549ef0f5` |
| surface / constants / profile / entities | the four `--check`s | GREEN 195 · PASS 4,966 · 138 · 518 |
| roster | `fixtures/tapes/index.json` | **210** tapes |
| route survey | `node scripts/procgen/survey-seedling-route.mjs --through=end --out=…` | **146 SOLVED / 116 REFUSED / 3 TIMEOUT** (65, 84, 94; all L12) |

**The brief's refusal reproduces exactly** (`--only=95,101`, both VERB-MISSING):
- step 95: *"no corridor for goal reach-exit toward (296,8) in level 37. Obstacle: proximity-hazard:watcher (watcher@104,264); also on the frontier: tree@64,288, rock@48,304, tree@0,288. No strategy row exists for this obstacle."*
- step 101: the same watcher, toward (8,264), from tile (10,12).

## D1 — the game's rule (PASS, measured; three model fixes)

**Read from the AS3** (`NPCs/Watcher.as`, `NPCs/NPC.as`):

- **What a watcher is.** It is an `NPC` whose type is `"Watcher"` (`Watcher.as:48`), which is in no solids list, so its body never blocks. Its sprite is `visible = Player.hasShield` (`:114`).
- **Its trigger** is `NPC.talk()` (`NPC.as:185-239`).
  - `inRange = FP.distance(x, y, p.x, p.y) <= talkRange` (24), from the NPC's own centre (the ctor half-tile, `:47`). This is a disc, and it includes its rim.
  - With the tag set, `keyNeeded` is `!checkPersistence(tag)` = false (`Watcher.as:46`), so `startTalking()` runs on proximity alone.
  - The whole method is behind `if (p && myText[0].length > 0)` (`:188`). `myText` is `prepNewText(_text)` (`:68`), and `addText("")` pushes one empty page, so **a watcher placed with `text=""` never runs any of it.**
- **Its effect.** `Game.freezeObjects` is raised from the frame after the start, so the start frame is live (`:193-196`). Each page is advanced by a release of X (`keys[6]`). On pages 9..19 the watcher holds out a live `Seed` (`Watcher.as:68-74`); collecting it is a soft-lock.
- **Its state.**
  - `doneTalking()` writes the tag false (`:126-135`). Walking out of range also ends the dialogue through the setter, and so also writes it.
  - `Watcher.update` calls `super.update()` (and so `talk()`) only `if (Game.checkPersistence(tag))` (`:64-67`), so a talked-to watcher never speaks again. Its `check()` is empty, so it is never removed.
  - `hit()` counts only with the tag cleared and `text != ""` (`:117-124`), which is the bloody branch.
- **How the player gets past.**
  - A silent watcher: walk through it.
  - A speaking one: there is no way around the circle in a corridor it cuts. The walk freezes inside it until every page is paged.
  - Once talked to: walk through.

**The census** (`atlas` attributes, every placement):

| level | watcher | tag | text |
|---|---|---|---|
| 12, 32, 37, 43, 57, 69, 82, 89, 94, 103 | one each | 6, 2, 2, 6, 1, 1, 2, 1, 0, 0 | **empty** |
| 114 | `watcher@72,72` | 0 | 912 chars (`frames` 3) |

**The model's divergences.**

`levelRun.stepWatchersNow` already gated `talk()` on the text (`canTalk`, R6 6d), so tape replay was right everywhere. The census (`ENTITY_CLASSES.watcher.hazard`, the planner's avoid volume) priced every placement the same way:

1. **All eleven as speaking.** The fix is `hazard.speaksFrom: 'text'`: an empty placement goes to `world.silentHazards` (`{tag, x, y, id, why}`) and is not a talk volume. ⛔ Since `81d47fe` its old square is **held** as a planner-only volume (see *D1 STOP*).
2. **As a 48x48 square.** The fix is `hazard.point: {dx: 8, dy: 8, r: 24, inclusive: true}`, which `avoidVolumesAt` tests as `d <= r`. ⚠ The square was not safe. L114's corridor top cell, (72,56), is 25.3 px from the centre: inside the square, outside the circle. A walk booted there counted as already in contact, was exempted, walked in, and stalled in the dialogue. Measured at the base with `can-cross-seedling --level=114 --exit=64,144 --spawn=64,48 --inventory=sword --dash=none`: *"waypoint 0 (72,152): not reached within 400 ticks; stalled at (72,59.25)"*.
3. **Uncleared, always.** The fix is that a room built with the watcher's tag cleared (`PERSISTENCE_RESPONSE.watcher` is `'silence'`) lists it silent, with a `why` naming the tag.

**The witnesses.** They are authored by `scripts/procgen/plan-seedling-watcher-witness.mjs`, whose `--check` is byte-identical, using the survey's staging (`r8-solve-11`'s block re-pointed). Each was recorded with `check-seedling-bot-differential --record --only=…`, then compared: **ALL CHECKS PASSED**, and *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"* on every tape.

| tape | what | plan | game = model |
|---|---|---|---|
| `watcher-l37-reach-l38` | step 95, L37 → L38 | solver, 316 t, burns `burnabletree@128,192` (`{37,1}`) | 317 obs, 37→38 @316; the walk overlaps the old square on 4 observations, closest 30.88 px |
| `watcher-l37-reach-l44` | step 101, L37 → L44 | solver, 332 t | 333 obs, 37→44 @332; 11 observations in the old square, closest 32.93 px |
| `watcher-l37-silent-lean` | **the discriminator** | hand keys: boot (104,240) = entity (112,248), exactly 24 px; `down` 20, `left` 20, rest 20 | 61 obs; 32 observations within 24 px (closest 19.00); every `left` tick moves (20/20). A speaking watcher would have frozen it on tick 1 |
| `watcher-l114-silent` | the cleared state | solver, `{114,0}` cleared at boot, 32 t | 33 obs, 114→113 @32; 16 observations within the circle (closest 8.00), no talk |

The positive control is `r6-watcher-talk` (R6), already game-recorded: L114's speaking watcher freezes the walk on proximity. It still passes (below).

**The harness check that refused the L114 recording, and the fix.** *"The Watcher the run did NOT finish rebooted nothing"* failed on both L114 tapes: *"1 hit(s) landed and the game changed level (114->113)"*.
- The model and the game agree (both landed one sword hit, from the solver's dash, on a watcher whose tag is cleared, and both left by `teleporter@64,144`).
- The check assumed any level change after a landed hit is the bloody Seed's reboot. It was written for `r6-watcher-blood-control`, which never leaves L114.
- It now counts only a game transition the model's own stream (`expected.transitions`) did not make.
- The four R6 watcher tapes were re-compared: ALL CHECKS PASSED, and the blood-control line is byte-identical: *"3 hit(s) landed and the run never left level 114 — one short of `hits > dieFrames.length`"*.

**`fidelityWatcher.test.js`** (D1 rows):
- the census over all eleven placements (silent iff text empty, derived from the atlas);
- the CONTROL: L37's placement given text is priced as the disc again;
- the run never talks to the silent L37 watcher, and the game's stream moves on every held tick;
- steps 95/101 solve with the watcher listed silent, and the game recorded both crossings;
- the L114 disc is inclusive at 24.00 and exclusive at 24.01 (by 0.01 px);
- L114 built with `{114,0}` is silent;
- `watcher-l114-silent` solves with no talk, and the game agrees.

`levelWorld.test.js`: L94's volume row moved to L114 (and to the disc); L94 is now asserted silent. `rectInputs.test.js` pins the disc instead of `hazard.w = 48`.

**Mutants** (each predicted first, made by copy, restored md5-identical: `levelWorld.js 430ce4a2…`, `solverBot.js 792fd65d…`). These were measured on the pre-hold code (`3fbe10c`); the held design's own mutants are m7/m8 under *D1 STOP*:

| mutant | predicted | measured |
|---|---|---|
| m1: `speaksFrom` removed | the 10 census rows and the two "listed silent" step rows red. **Steps 95/101 still SOLVE**, because the disc alone frees them | **17 red** (+ the base's R8 red): the 12 predicted, plus 4 cleared-state rows (the cleared branch is also keyed on `speaksFrom`) and `levelWorld`'s L94 row. **Survey: 95 SOLVED 316, 101 SOLVED 332** (unchanged); the L114 cleared crossing still solves, 74 t, through `execTalk`'s cleared arm |
| m2: the disc back to the square | the L114 talk walk stalls again; 95/101 unaffected | 4 red (disc, L37 control, two talk rows); canCross: *"not reached within 400 ticks; stalled at (72,59.25)"*, the base's words; survey 95/101 SOLVED |
| m3: the cleared branch disabled | the census row and the L114-silent "never talks" row red; the crossing still solves | **3 red** (one more than predicted: the CONTROL row with `{114,0}` cleared sees a zero-tick `talk` record); canCross with `--persistence=114:0` still solves in 74 t |

## D1 STOP — the silent squares are HELD (measured)

- **The STOP itself.** The AFTER identity block at `ef732dd` (D1 + D2 as first written) read `solve-seedling-r9-campaign --check` **`393808aff6c46d142577d5bae7c4e2b6` [exit 1]**. Every other row was identical to BEFORE. A worktree run of the same check gave the same digest and 5 failures:
  - *"r9-solve-12 is byte-identical to what this solver derives — ⛔ DRIFT"* (artifact and trace);
  - the chain's solved lengths (`2419` → `2364`) and their sum (10,935 → 10,880);
  - `r9-solve-21`'s free oracle (`seam.time 15270` vs 15,215).
- **The cause.** L12's silent `watcher@296,104` square is a detour in the committed L12 funnel plan; without it the solver plans 55 ticks shorter. The same mechanism moved survey steps 27/152/164 (L12) and 130 (L37) 32–50 ticks shorter. No re-record is licensed, so the change stopped.
- **The hold** (`81d47fe`):
  - A text-silent placement stays in `world.silentHazards` (with `held: true`), and its old square goes back into `proximityHazards` as `kind: 'held-silent', held: true` (`hazard.heldSquare`).
  - `resolveTalkStrategy` gains a SILENT arm: where the frontier names such a square, `talk` resolves to a zero-tick walk-through with the volume exempted.
  - The speaking watcher's disc and the cleared-tag silence are unchanged (no committed solver plan enters L114).
- **Measured with the hold:**
  - `r9-campaign --check` is `b29b589b26e6ad996c2a328d16b52c90` **exit 0** (the banked value).
  - Steps 95/101 SOLVE 316 / 332 t, and the five witness tapes re-derive **byte-identical** (`plan-seedling-watcher-witness --check`).
  - Steps 27/130/152/164 are back at 282 / 346 / 254 / 285.
  - The full survey is below.
- **Releasing the hold:** delete the `held` push in `buildLevelWorld` and re-record `r9-solve-12` (and its chain checks).

| mutant (held design, predicted first) | predicted | measured |
|---|---|---|
| m7: the SILENT arm removed (`silent = null`) | 95/101 refuse: `execTalk` approaches a watcher that never talks; the 2 step-solve rows red | 2 red (+ the base's R8 red); *"talk: walked toward watcher@104,264 for 60 tick(s) from (72,280) and its dialogue never opened (closest 18.18 px; the circle is 24)"*. The model's own approach reaches 18 px with no dialogue |
| m8: the held push removed (back to `ef732dd`'s census) | step 27 back to 232 t, 95/101 solve; the 10 census rows, the L94 row and the 2 step rows red | **13 red** (+ R8); survey `--only=27,95,101`: **27 SOLVED 232**, 95 SOLVED 316, 101 SOLVED 332 |

## D2 — the `talk` verb (PASS, game-witnessed)

**The transcription** (`3fbe10c`):
- **`OBSTACLE_STRATEGIES['proximity-hazard:watcher'] = 'talk'`**, registered as `STRATEGY_EXECUTORS.talk = execTalk` and dispatched from `resolveObstacleStrategy`.
  - `r8Acceptance`'s `executorDerivations.talk` has five rows (the gate, the stance, the seed, the approach, the pages).
  - `decisionTrace.KNOWN_STRATEGY_VERBS` gains `talk`.
- **`resolveTalkStrategy`.** The gate is the watcher's STATE (the game asks for no item):
  - **Cleared this visit:** a zero-tick walk-through. A room built with the clear never reaches the row, because D1 makes it silent.
  - **Stance:** a tile centre at least `TALK_STANCE_MARGIN` 4 px outside the circle, so the walk to it cannot overshoot into the dialogue mid-drive, and within `TALK_STANCE_REACH` 48. It must be free in `plannerObstacleAt` and reachable by `stanceReaches`, the shared stance derivation with its lazy hypothesis. The player's own position is used when it qualifies.
  - **The Seed:** the box predicted where the line to the centre meets the circle must clear `watcherSeedBox` by the margin. Otherwise the verb refuses by name (the soft-lock).
- **`execTalk`.**
  - `chooseHeld` toward the centre until `run.watchers` reports `talking` (≤ `TALK_APPROACH_MAX` 60).
  - The Seed is re-asked at the real opening position.
  - `ceremonyCadenceStep` (the Bob Boss dialogues' cadence, a one-tick press of X then its release) runs until the tag clears, and must end released.
  - The freeze's kept velocity settles. The record is `{verb, target, openedAt, closedAt, pages, cause, flag}`.
  - The resolution's `exempt` keeps the (now silent) volume out of every later plan of the segment.
- **No `shouldStop` site** was added, and no other solver path changed.

**The witness** `watcher-l114-talk`:
- **Boot:** L114 (64,48), the corridor top, tag set, reach-exit `teleporter@64,144`.
- **The plan, 394 t:**
  - the frontier names `proximity-hazard:watcher (watcher@72,72)`;
  - the stance is the boot itself (25.3 px);
  - the dialogue opens on t3;
  - **20 pages**, closing with cause `done` on t356;
  - `{114,0}` is written on t355;
  - out to L113 on t394.
- **On the game:** recorded and compared, 395 observations, model = game (including the 352-tick freeze), ALL CHECKS PASSED.

The same crossing:
- **at the base:** stalled (above);
- **after D1 alone:** VERB-MISSING, *"No strategy row exists for this obstacle"*;
- **with `{114,0}` cleared:** solves in 74 t with no talk (the CONTROL row).

**`fidelityWatcher.test.js`** (D2 rows):
- the row, the executor, its derivations and the known verb;
- the solve (paged `done`, `{114,0}` earned, `unknownStrategyVerbs: []`);
- the committed tape IS the plan, and every X is a one-tick press;
- the CONTROL with the tag cleared;
- the game's recording freezes for more than 300 ticks and leaves to L113.

**Mutants** (predicted, copy/restore, `solverBot.js 792fd65d…` restored each time):

| mutant | predicted | measured (canCross L114) |
|---|---|---|
| m4: the row removed | VERB-MISSING; 3 red | 3 red; *"Obstacle: proximity-hazard:watcher (watcher@72,72) … No strategy row exists for this obstacle."* |
| m5: the row kept, `talk: execTalk` removed | VERB-SELECTED-NOT-REGISTERED; 3 red | 3 red; *"Strategy 'talk' is SELECTED but not registered this slice."* |
| m6: the resolver finds no watcher (returns `null`) | VERB-APPLY; 2 red | 2 red; *"Strategy 'talk' failed to apply."* |

In every D2 mutant, the survey's steps 95/101 stay SOLVED (316 / 332).

## D3 — the survey before → after, and step 94 (PASS)

**`--through=end`**, full, at `b116c69` and at the code head. The head run was in the development worktree, whose `levelWorld.js` and `solverBot.js` are byte-identical to `3fbe10c` (`cmp`). Every step whose verdict, ticks or refusal text changed:

| step | level | before | after | ms |
|---|---|---|---|---|
| 27 | L12 | SOLVED 282 t | SOLVED **232 t**: L12's silent `watcher@296,104` square was a detour | 7,546 → 4,942 |
| 66 | L37 | REFUSED VERB-MISSING `proximity-hazard:watcher (watcher@104,264)` | REFUSED **ITEM-GATE** `burn burnabletree@128,192`: *"this run does not hold FIRE"* (the obstacle behind the watcher) | 24 → 42 |
| **95** | L37 | REFUSED VERB-MISSING `proximity-hazard:watcher` | **SOLVED 316 t** | 36 → 1,758 |
| **101** | L37 | REFUSED VERB-MISSING `proximity-hazard:watcher` | **SOLVED 332 t** | 1,268 → 1,565 |
| 129 | L12 | REFUSED (unclassified) danger-map forbids `(445.92…,258.10…)`, `chaser:puncher@416,256` | the same refusal, the forbidden point now `(445.99…,258.00…)` (the walk to it changed) | 26,134 → 26,146 |
| 130 | L37 | SOLVED 346 t | SOLVED **314 t** | 5,084 → 4,371 |
| 152 | L12 | SOLVED 254 t | SOLVED **208 t** | 12,743 → 6,004 |
| 164 | L12 | SOLVED 285 t | SOLVED **249 t** | 8,133 → 12,118 |
| 176 | L43 | REFUSED (unclassified) *"walked at wand@144,224 for 400 ticks … stalled at (151.81…,231.7…)"* | the same, stalled at `(151.61…,231.46…)` | 497 → 593 |

**Totals:** 146 / 116 / 3 → **148 SOLVED / 114 REFUSED / 3 TIMEOUT** (65, 84 and 94, each still ~120 s).

⛔ The table above is the **first** AFTER run, at `ef732dd`, before the hold. **At the head (`81d47fe`, held) the full survey changes only steps 66, 95 and 101**, with the same verdicts, ticks and words as above (95 → SOLVED 316, 101 → SOLVED 332, 66 → ITEM-GATE). The other 262 rows are identical to the base in verdict, ticks and refusal text, so 27/129/130/152/164/176 do not move. No step that solved at the base refuses now.

**The new first refusal past 2.2** (2.2 is step 88, the Bob Boss) is **step 96, L38**: *"no corridor for goal reach-exit toward (152,8) in level 38. Obstacle: proximity-hazard:buttonroom (buttonroom@144,128); also on the frontier: pulser@80,224, cover@208,224. No strategy row exists for this obstacle."* (VERB-MISSING). Step 94 (L12) is a TIMEOUT at both ends, so it is still the first non-SOLVED row; 95 is now SOLVED. After 96, step 97 (L39) is `solid:wandlock`, VERB-SELECTED-NOT-REGISTERED (`wand`).

**Step 94's TIMEOUT: one profile, no fix.** I ran the survey's own child (`survey-seedling-route.mjs --step=94 --through=end`) under `node --prof`, killed at 125 s, and processed it with `node --prof-process`: **107,435 ticks.**
- `plannerBlockerAt` is **27.9%** self. 99.6% of its calls come from `plannerObstacleAt`, and **93.5%** of those from `controllerPathClear`, `planWaypoints`' string-pulling smoother. With the builtins it drives (array iteration 13.7%, hash-set lookups 11.6%, megamorphic loads 14.7%), the planner's smoother is most of the run.
- The callers of that smoother: **`corridorPlans` ← `scanAround`** (the chaser kill rung's stance scan, `solverBot.js:10420`) **≈ 71%**; `deriveKillByChaser` ≈ 9%; `chooseBodyToRemove`/`climbLadder` 8%; `walkTo` 8%; `deriveKeylockStance` → `stanceReaches` ≈ 5%.
- **13%** is the `world.pitTiles` (5.6%) and `world.lethalTerrainTiles` (7.4%) getters. Both re-filter `walkableTiles` on every call, and `plannerBlockerAt` calls them per query.
- ⇒ Step 94 spends its 120 s scanning kill stances around L12's puncher, re-planning one smoothed corridor per candidate. The getters are a constant-factor waste on top. Not fixed here (ROBUST/DASH own those paths).

## D3 — records (PASS)

| Row | W0 (`b116c69`) | head | movers |
|---|---|---|---|
| identity log | see the BANK section | **`aa46950b5958b32136111155250dd253`** at the head (`e9e6cdf`, code `81d47fe`): BURN's banked value, byte-identical. Against my BEFORE log (`67a29571…`) the only `diff` line is `generated set`, a box-lock line BEFORE (re-measured `OK` on the same pristine tree) and `OK` AFTER | **none**. ⛔ The intermediate AFTER at `ef732dd` (pre-hold) differed in exactly one row (`r9-campaign --check` `393808af…` exit 1), which is the D1 STOP |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, all exit 0 | **identical**, all exit 0 (`r9-campaign` `b29b589b…`) | none at the head; `r9-campaign` was the one mover before the hold |
| tapeRunner | 477, md5 `5bdf547c…` | **487**, md5 `f3d8462c47227a117f9f363ba71ee8d9`; the 477 old `(name, status)` pairs are **identical** (a subset; +10 lines) | +10: the five witnesses, a differential row and a stepping row each |
| roster | 210 | **215** (`generate-tape-index.mjs`) | the five `watcher-*` tapes |
| solver surface | GREEN 195 | **GREEN 198** (`--write`, classify, `--check`; `--write` again is byte-identical) | + `run:watchers` (seedling / live-state), + `run:watcherTalks` (seedling / event-ledger), + `world:silentHazards` (seedling / constant, the held design); the rest is site-count drift (`run:advance/level/state/world`, `state:x/y/vx/vy`, `import:…#rectsOverlap/TILE_SIZE/playerBoxAt`) |
| constants | PASS 4,966 | **PASS 4,970** (`--profile-rows` → `--write` → `--check`, AS3 present) | D1 **retired** the square's 8 rule rows from the hazard row and **classified** the disc's 3 (`8`, `8`: the ctor half-tile; `24`: `NPC.talkRange`); the hold re-adds the same 8 literals as `hazard.heldSquare` under new hashes, classified with the old notes (`rule/derivation`, `rule/bound`); the `keyType` default kept `rule/sentinel` under its new hash `h3dbe9ae9` (its `push` statement grew) |
| profile / entities | 138 / 518 | **138 / 518** | none (no new entity family: `run.watchers` is a getter, not an `ENTITY_FAMILIES` row) |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** after regeneration; `check-procgen-docs` ALL CHECKS PASSED; `check-procgen-help --in-place --only=plan-seedling-watcher-witness.mjs` ALL PASS | instruments +1; the docs index (the log entry, `seedling-bot.md`) |
| bounded vitest | 50 files / 2,301, 2 red | **51 files / 2,345 tests, 2,343 green, 2 red, both standing:** `rosterCategories:175` *"expected 149 to be 155"*; R8_ENEMY_BRIDGE `cancross-l16-sword-none` | + `fidelityWatcher` (28 rows) |
| `boxLock`, `lintGateLabels`, `entityBlocks`, `decisionTrace`, `shoveWeighParity`, `watchGenOverlay`, `jsRuntimeDeclarations`, `solverDeadline`, `seedlingCanCross` | green | **green** | `plan-seedling-watcher-witness.mjs` takes no box (no browser), so `boxLock`'s `guarded` list is unchanged |

**Pins** (unions, added by name):
- `tapeEnvelope`, `observationTolerance` (incl. `swapped`) and `dialogueAutoAdvance` (inert): **210 → 215**, inert 209 → 214. The names: `watcher-l37-reach-l38`, `watcher-l37-reach-l44`, `watcher-l37-silent-lean`, `watcher-l114-silent` (D1, 214) and `watcher-l114-talk` (D2, 215). The talk tape's dialogue is not an arrival freeze, so it parts nothing.
- `R8_ENEMY_BRIDGE`: **no new exposure.** None of the five reaches a bridged room with a chaser; the one red is wave 3's.
- `R8_STRATEGY_EXECUTORS.executorDerivations.talk`: five rows.

**`seedling-bot-log.md`**: `### Seedling fidelity WATCHER — a silent watcher is no obstacle, and a speaking one is passed by talking`, after CANCROSS, with three trap candidates:
1. an "over-approximation in the safe direction" is unsafe under a contact exemption;
2. a hazard decided per placement cannot be priced per class;
3. talking arms the sword.

**`seedling-bot.md`**: the census fact *"all eleven watchers … auto-talk within 24 px"* is corrected.

## The JS arc's pins at my head

**None moved.** `jsRuntime*`, `solverDeadline`, `wasmArrival*`, `wasmWalkTape` and `solverPrefix` are 15 files / 206 tests, all green. No JS-arc file was edited, and no contract changed (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`).

**What they gain:**
- `world.silentHazards`, a new optional world field.
- A speaking watcher on a frontier is now paged by the solver. A solve through one carries **one-tick `primary` spans inside a freeze**, and the run earns the watcher's tag (L114's is `FinalDoor`'s `talkedToWatcher`).
- `run.watchers` / `run.watcherTalks` are now solver-surface rows.

## What the brief got wrong (measured)

1. **"265 steps: 144 SOLVED / 119 REFUSED / 2 TIMEOUT"** (BURN's numbers). At `b116c69` (wave 3 merged in) the survey reads **146 / 116 / 3**: TIMEOUTs 65, 84 and 94, all L12. Steps 95 and 101 refuse as briefed, word for word.
2. **"`proximity-hazard:watcher` … No strategy row exists" as a missing VERB.** For step 95 it was a **model divergence, not a missing verb**. L37's watcher has no text and never talks, and even a speaking one would not have blocked these walks: they pass 30.9 / 32.9 px from it, outside its 24 px circle and inside the census's square. With the census fixed, 95 and 101 solve with **no strategy row** (mutant m1 keeps them solved with the text rule removed, so the disc alone suffices). The row ships anyway, because the fix had to be held (*D1 STOP*): at the head the held square is the wall, and the row's silent arm walks through it.
3. **"D2 — … gated on whatever the game requires (refusing by a true name without it)."** The game requires no item: a watcher's gate is its own state (tag set → it speaks; text empty or tag cleared → it is silent), plus the Seed soft-lock. The verb refuses by name only where no stance keeps the frozen box off the Seed.
4. **"Game witness of step 95 crossing … for the strategy."** Step 95's witness (`watcher-l37-reach-l38`) witnesses D1's rule. No route step reaches a speaking watcher, so `talk`'s witness is L114 from the corridor top (a staged boot: in the game that state is reached by walking up from the arrival, which talks on the way).
5. **"its trigger (proximity radius? line of sight?) … (an item? timing? a route around?)".** It is a radius (inclusive, from the ctor centre), with no line of sight. The answer to "how a player gets past" is "the dialogue", and for ten of eleven watchers "it isn't there".
6. **"Compare with the model's `proximity-hazard` treatment (`levelWorld`/`dangerMap`)".** `dangerMap` has no watcher arm. The volume is `levelWorld.avoidVolumesAt`, and the run (`levelRun.stepWatchersNow`) was already right.

## Residue

1. **The solver's dash and strike policy do not know about watchers.** Both L114 witnesses land one sword hit on the watcher just talked to (cleared tag → `hit()` counts). Four hits make the bloody Seed, whose collection ends the run (`levelRun` models the reboot). No route step does this, and the dash is DASH's region. A `talk` that is followed by more than three dash hits in the room would walk into the bloody ending.
2. **The speaking watcher's live-Seed check is a prediction plus a re-check, not a search.** On a refusal ("the dialogue opened … on the live Seed") the verb does not try another stance. L114's corridor never hits it, so this is unmeasured elsewhere.
3. **A mid-visit clear does not rebuild the world.** After `talk` the volume is exempted for the segment, not removed. A later segment in the same visit would see the volume again and resolve `talk` to the zero-tick cleared arm (measured by mutant m3's CONTROL). That is correct, but it is one more decision row.
4. **The HELD silent squares** (D1 STOP): the census is true (`silentHazards`), but the planner still detours around ten volumes the game never prices. Releasing them makes `r9-solve-12` 55 ticks shorter and survey steps 27/130/152/164 32–50 ticks shorter, and it needs that re-record. This is the coordinator's call.
5. **Step 94's TIMEOUT** (above), and **step 96's `buttonroom`**, the next VERB-MISSING past 2.2.
6. **`rosterCategories:175`**: the composite standing value, 149 at the base (150 owed), **155 at my head** (+5 watcher tapes). `standing-values --write` is not licensed here, so the coordinator banks it.

## Byte-inertia

- **No committed tape, expectation, trace or declaration moved.**
  - Added: five tapes and their five game expectations, and the regenerated `index.json` (+5 rows).
  - Tape md5s: tapes / expectations (md5, first 8): `watcher-l37-reach-l38` `5420b2e7` / `32705365`; `watcher-l37-reach-l44` `fb0a50d4` / `da8d8675`; `watcher-l37-silent-lean` `0489e50b` / `60e77902`; `watcher-l114-silent` `1ce43e78` / `a74f7b20`; `watcher-l114-talk` `50e08edd` / `bbbddd4b`.
- **Not touched:**
  - `campaign-frontier.json`;
  - the AS3, the wasm and every gitlink;
  - the AP rules;
  - the JS arc's files;
  - the other wave-4 regions: DASH (`planSwordDash`/`previewFor`/`evaluateAt`, the strike policy); RETURN (the stance/press/button rungs); ROBUST (`SolverRefusal` fields, DETOUR, the swim corridor).
- **Touched outside the solver/census:** `check-seedling-bot-differential.mjs`, one check (D1, above).
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used. Every mutant was copy → edit → run → copy back, md5-checked.
- **Box:**
  - The recordings ran from the worktree (`SEEDLING_PORT=9291`) while the BEFORE identity block ran on the primary tree, which is why its `generated set` row printed a box-lock line. That row was re-measured alone: `OK`.
  - ⚠ For about a minute, one edit to `check-seedling-bot-differential.mjs` was written to the primary tree while the BEFORE block was running its census rows (which do not read that file). It was moved to the worktree and restored (`git status` clean) before any row that could read it.
  - The AFTER identity block ran on this tree at the code head plus the regenerated reference.
- **Tree dirt:** the survey writes `.cache/seedling-survey/` (gitignored). Scratch (not committed): both identity logs, both survey JSONs and the mutant surveys, the vitest JSONs, the `--prof` log and its processed text, the mutant runner.

## The identity rows the coordinator must BANK

- identity log md5: BEFORE `67a295711e2fec7d16219961da2eb4fa` (= `aa46950b…` but for the box-locked `generated set` row, re-measured `OK`); AFTER **`aa46950b5958b32136111155250dd253`** (head). Byte-identical to BURN's bank
- the six `--check`s: `405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `b29b589b26e6ad996c2a328d16b52c90`, BEFORE = AFTER, all exit 0
- counts (movers, not digests): tapeRunner **487** (pairs md5 `f3d8462c47227a117f9f363ba71ee8d9`), roster **215**, surface **GREEN 198**, constants **PASS 4,970**, instruments +1, entities 518, profile 138
- **`rosterCategories:175`**: the composite standing row, 149 vs **155** at the head (+1 owed before me, +5 WATCHER tapes). Re-seal with `standing-values --write` when banking
- **R8_ENEMY_BRIDGE**: red at the base for `cancross-l16-sword-none` (wave 3); the WATCHER tapes add no exposure
- the route survey (`--through=end`): **148 / 114 / 3**; the new first refusal past 2.2 is **step 96 (L38, `proximity-hazard:buttonroom`)**; step 94 is still TIMEOUT
- **owed if the hold is released**: `r9-solve-12` re-recorded (2,419 → 2,364 t) and the chain's `--check` re-sealed
