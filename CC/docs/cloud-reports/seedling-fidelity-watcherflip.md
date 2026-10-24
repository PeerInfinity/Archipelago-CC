# Seedling fidelity WATCHERFLIP: WATCHER's held silent squares released, and `r9-solve-12` re-recorded on the game (cloud report)

**Slice:** `seedling-fidelity-watcherflip`, an Opus build slice run in the cloud for the model-fidelity arc (planner
`seedling-fidelity-planning-2`).

⚖ **Licensed (user, 2026-10-05):** *"Yes, with the dash re-record"*. The licence covers three things:
- remove the phantom squares of the SILENT watchers (WATCHER's D1 STOP, the `kind: 'held-silent'` planner volumes);
- re-record `r9-solve-12` on the game;
- update the campaign `--check`'s tick sum and seam oracles, and re-derive the later windows boot-only.

**STOP if anything else moves.**

| | |
|---|---|
| Started from | `origin/main` @ **`166766379d367edb4810d96b1acfb8230cd3b14e`**, as briefed |
| Harness branch | **`claude/seedling-fidelity-watcherflip-t0dpzl`**. Every push went here; nothing went to `main` |
| Commits | D1 **`ea716e0`** · D2 **`e7841de`** · D3+D4 records **`003a0af`** · this report (the head) |
| Dev server | `serve-nocache.py 9320` (`SEEDLING_PORT=9320`). ⚠ The worker restarted once mid-D2, which killed the server and the first whole-chain differential. Both were restarted, the box lock's stale holder was reclaimed by its own `kill -0` rule, and the differential was re-run in full |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS. No STOP: the identity block's only mover is the licensed one** |

## The one thing to know first

**The release moved exactly what WATCHER predicted, and nothing else.**
- `r9-solve-12`: 2,419 → **2,364 t**. The pit crossing is now t2284 (it was t2339); the 80-tick walk-on is unchanged.
- The chain: 10,978 → **10,923 t**.
- The six later windows are boot only.
- The identity block differs from W0 in **one row**: `r9-campaign --check` `bfbaccbb` → **`56bb3724fd0ed3dda184e6e7d6d5d27c`**, exit 0.

**One boot field the brief did not name moved inside "seam":** **`seam.grass_cut` −12** on all six boot-only windows
(516 → 504; on `r9-solve-32`, 534 → 522). The new L12 walk cuts 12 fewer grass tiles, and the game latches the count
into every later boot. It is a seam field, game-measured. The six expectations re-recorded byte-identical, so it is not
a STOP, but it is listed here.

## W0 (at `1667663`, primary tree)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY` (python 3.11.15, node v22.22.0, 4 wasm build dirs, tree clean) |
| identity block | `SEEDLING_PORT=9320 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`76832d7ae21c07d8108da33c5214e09c`**, DASHFLIP's bank, byte-identical |
| six `--check`s | in the block | `405d9c4b` · `8e7a43be` · `33d20889` · `35456fbc` · `6cd35fe1` · `bfbaccbb`, all exit 0 |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| surface / constants / entities / profile | each `--check` | **GREEN 198** · **PASS 4,976** · **518** · **138** |
| roster | `fixtures/tapes/index.json` | **222** tapes, `71f045b7dbf8cde99d16f161afaad744` |
| bounded vitest BEFORE | 61 files (below) | **3,084 / 3,084 green**. The two reds earlier slices carried (`rosterCategories:175`, R8_ENEMY_BRIDGE) were banked on main (`b6be807`) |
| tapeRunner | `(fullName, status)` lines of `tapeRunner.test.js`, sorted | **501**, md5 **`51829dac294c79fba6ed687124fdaf96`** |
| `plan-seedling-watcher-witness --check` | — | exit 0, md5 `571e3511…` |
| route survey | `survey-seedling-route.mjs --through=end` | **237 steps: 138 SOLVED / 97 REFUSED / 2 TIMEOUT** |

The 61 files are:
- the brief's list: `fidelityWatcher`, `placedTalk` (the npc/talk file), `solverBot`, `levelRun`, `levelWorld`,
  `campaignChain`, `rerecordCampaign`, `playthroughAcceptance`, `tapeRunner`, `r8Acceptance`, the roster pins
  (`tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `rosterCategories`,
  `fixtures/tiers`), `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`, `entityBlocks`, `fidelityDash`,
  `fidelityF1c`, `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`, `seedlingSolverSurface`,
  `seedlingConstantsCensus`;
- `ropeSword` and `rectInputs`;
- every test that names `r9-solve-12`/`r9-campaign` (`rg -al`): `gameClock`, `rerecordCampaign`, `r8Acceptance`,
  `campaignChain`, `seedlingPlaythroughOverlay`, …;
- every test that names `watcher` (`rg -ali`, 24 files).

The full list is in the scratchpad's `vitest-files.txt` and was the same at both ends.

## D1: the release (PASS, `ea716e0`)

**The prediction, measured BEFORE the edit** (in a scratch worktree with only the `held-silent` push deleted):
- `solve-seedling-r9-campaign --check` exits 1 with **exactly WATCHER's 5 failures**:
  - `r9-solve-12` artifact drift, and its trace drift (2,364 t);
  - the lengths;
  - the sum, 10,978 → 10,923;
  - `r9-solve-21`'s free oracle (`seam.time` 15,313 vs 15,258).
- Windows 1–23 and 25–30 are byte-identical under `--check`.
- `plan-seedling-watcher-witness --check` is **byte-identical** (`571e3511…`): steps 95/101 plan the same keys
  with or without the square.

**The edit:**
- `levelWorld.js`: the `held-silent` `proximityHazards.push` is deleted, along with the `held: true` flag on the
  `silentHazards` row and the now-dead `ENTITY_CLASSES.watcher.hazard.heldSquare` row.
- A silent placement is in `silentHazards` and **no planner volume at all**.
- Speaking watchers keep the disc and the `talk` verb.
- **`solverBot.js`: comment and refusal text only.** `resolveTalkStrategy`'s SILENT arm is kept as a guard. No
  frontier can name a silent watcher now, so it is unreachable from `buildLevelWorld`. Its logic is byte-unchanged,
  so no contract and no surface read moved.

**Tests.** Predicted from WATCHER's m8: 13 red, the 10 census rows plus the 2 step-95/101 rows plus `levelWorld`'s L94
row. **Measured: 13 red, exactly those.** Each now pins the released census:
- a silent placement has no volume;
- steps 95/101 solve with **no** `talk` record (the plan is still the committed tape's length);
- L94 has `proximityHazards: []`.

**Mutant** (copy → base `levelWorld.js` → `--check` → copy back; restored `c53400104190af447a735ec6a8c99ad1`), run after
D2's re-record:
- predicted: the 5 mirror failures;
- measured: **exactly 5**. The hold re-derives 2,419 with the crossing at t2339, the sum is 10,978 against the
  committed 10,923, and `r9-solve-21`'s oracle is back at 15,313.

## D2: the re-record (PASS, `e7841de`)

Sequence (DASHFLIP's):
1. `SEEDLING_PORT=9320 node scripts/procgen/solve-seedling-r9-campaign.mjs`: headless, with an empty latch cache
   (fresh container), every window driven. **10923 t.** Windows 1–23 were written byte-identical (fixtures md5 diff:
   only the 7 tapes and 1 trace below).
2. `check-seedling-bot-differential --record --only=r9-solve-12,-21,-22,-29,-31,-30,-32`: **7 RECORDED, 7 *"THE MODEL
   REPRODUCES THE RECORDING IT JUST MADE"***, ALL CHECKS PASSED. **The 6 boot-only expectations re-recorded
   byte-identical**; only `r9-solve-12`'s moved.
3. `derive-seedling-tick0 --check` gave **6 FAIL**: exactly the moved boots, each with delta 76 = 55 + 21. Then
   `--only=` those 6: **6 written**. `--check` gives ALL CHECKS PASSED (log md5 `08ce4b29…`).
4. `generate-tape-index.mjs`: 222 tapes, index `71f045b7…` → **`5c6fdfdf779a71927a4e44936750bbbc`**.
5. The whole-chain differential (`--only=` all 30 windows, no `--record`): **ALL CHECKS PASSED, 879 PASS, 0 FAIL,
   30/30 "live game matches the committed oracle stream"**, *"the declared endsAt IS the tapes' own length — endsAt
   10923"*. The run was interrupted once by the worker restart and then re-run in full.
6. `solve-seedling-r9-campaign --check`: **exit 0**, stdout md5 **`56bb3724fd0ed3dda184e6e7d6d5d27c`** (the identity
   block measures the same).
7. `census-seedling-campaign`: *"30 of 30 window(s) stepped, 29 boundary(ies) admitted — end L30 (224,80), 10923
   ticks"*, **NO CHAIN ROOM MOVES**.

**The movers** (md5 before → after; inputs compared field by field against the base):

| window | tape | ticks | `seam.time` | tape md5 | expectation md5 | what moved |
|---|---|---|---|---|---|---|
| 24 | `r9-solve-12` | **2419 → 2364** | 12954 (=) | `15b3f85a…` → `33b66215df3af6b3f9227d167be586b4` | `85eff7f8` → `3e7cd43b` | the walk (licensed); `description`'s "Solver: 2364 ticks"; the crossing t2339 → t2284 |
| 25 | `r9-solve-21` | 26 | 15313 → 15258 | `439fa24c` → `2f5d79ed` | `111fcadc` (=) | boot: seam.time, **grass_cut 516 → 504**, rng.cosmetic, tick0 |
| 26 | `r9-solve-22` | 89 | 15359 → 15304 | `8f110234` → `bc661cb5` | `fec07dd4` (=) | boot only (same fields) |
| 27 | `r9-solve-29` | 379 | 15468 → 15413 | `2de92eb4` → `73619ca9` | `b49baf0f` (=) | boot only |
| 28 | `r9-solve-31` | 336 | 16017 → 15962 | `22609df4` → `bf455789` | `8ea7c931` (=) | boot only |
| 29 | `r9-solve-30` | 210 | 16373 → 16318 | `843d5d0f` → `3bfc52c7` | `72c9e765` (=) | boot only |
| 30 | `r9-solve-32` | 1056 | 16603 → 16548 | `a4898aaa` → `aefe5f5e` | `497d44e7` (=) | boot only (grass_cut 534 → 522) |

- Trace: `r9-solve-12` `98aa7d5e…` → **`bc96ad50338af433dce9e1b1be1214a5`**. No other trace moved.
- **The residue rows.** L18 is window 19, before window 24, so its clock and the F1c hammer residue (40) did not move.
  `fidelityF1c` is green at the head.
- `r9-solve-32` (L32 also holds a silent watcher) kept its walk key for key under the −55 clock.

**Other producers and planners that name a moved tape** (`rg -al` over `scripts/procgen/*.mjs`), each run `--check` at
the head and at the base (scratch worktree):

| planner | head | base |
|---|---|---|
| `plan-seedling-u15-turret` | exit 0 `17867266` | exit 0 `17867266` |
| `plan-seedling-f6-reentry` | exit 0 `e797e8cf` | exit 0 `e797e8cf` |
| `plan-seedling-f7-reentry` | exit 0 `18571df8` | exit 0 `18571df8` |
| `plan-seedling-return-l15` | exit 0 `8d7b493a` | exit 0 `8d7b493a` |
| `plan-seedling-watcher-witness` | exit 0 `571e3511` | exit 0 `571e3511` |

## D3: the survey before → after (PASS)

`survey-seedling-route.mjs --through=end`, full, at the base and at the D2 head. Each ran alone on the box.

**Totals: 138 / 97 / 2 → 138 / 97 / 2.** These are the step rows whose verdict, ticks or refusal text changed:

| step | level | before | after | ms |
|---|---|---|---|---|
| 101 | L12 | REFUSED: the danger map forbids `(445.92…,258.10…)`, `chaser:puncher@416,256` | the same refusal, at `(445.99…,258.00…)` | 17,857 → 18,861 |
| 102 | L37 | SOLVED 346 t | SOLVED **314 t** | 3,344 → 3,306 |
| 124 | L12 | SOLVED 254 t | SOLVED **208 t** | 10,121 → 3,809 |
| 136 | L12 | SOLVED 285 t | SOLVED **249 t** | 5,092 → 7,906 |
| 148 | L43 | REFUSED: *"walked at wand@144,224 for 400 ticks … stalled at (151.81…,231.71…)"* | the same, stalled at `(151.60…,231.46…)` | 415 → 398 |

- These are WATCHER's pre-hold movers (its 129/130/152/164/176), renumbered by the route's rebase.
- No verdict flipped, and no step that solved at the base refuses now.
- L12's two early steps (39: 328 t, 41: 311 t) did not move.
- **The first refusal past 2.2** (leg 2.2 is step 55, the L25 chest) is **step 56, L22**, at both ends: *"reach-exit
  (192,64)->L29: the re-planned corridor failed too — … waypoint 1 (88,88): not reached within 400 ticks; stalled at
  (80.07…,135.32…)"*.
- After the Bob Boss (step 60, SOLVED), the first non-SOLVED row is step 66 (L12, TIMEOUT), also at both ends.

## D4: records (PASS, `003a0af` + this report)

| row | command | W0 | head |
|---|---|---|---|
| identity log | `SEEDLING_PORT=9320 bash scripts/procgen/identity-block.sh .` | `76832d7a…` | **`5bf108151ad7a075428d0ff20f15240e`**. `diff`: **one line**, `r9-campaign --check` `bfbaccbb…` → `56bb3724…`, exit 0 at both ends |
| six `--check`s | in the block | above | five unmoved; `r9-campaign` **`56bb3724fd0ed3dda184e6e7d6d5d27c`** |
| reference | `generate-procgen-reference.mjs`, `--check`; `check-procgen-docs` | ALL 7 + 5 MATCH | ALL 7 + 5 MATCH; ALL CHECKS PASSED. Moved: the `campaign-chain` region (10923 t, row 24 2364) and the docs index |
| solver surface | `--check` | GREEN 198 | **GREEN 198**. The `world:silentHazards` row's hand-written `why` no longer names a held square (no count moved) |
| constants | `--write` then `--check` (a second `--write` is byte-identical) | PASS 4,976 | **PASS 4,968**. **8 rule rows RETIRED**: the `hazard.heldSquare` literals (`dx`/`dy` 8, 24; `w`/`h` 48; `originX`/`originY` 0), and their 8 targets deleted from `seedling-constants-fields.csv` (the census's own "delete it"). The other 654 rows are line moves |
| entities / profile | `--check` | 518 / 138 | **518 / 138** |
| tapeRunner | pairs from the bounded run | 501, `51829dac…` | **501, `51829dac294c79fba6ed687124fdaf96`: identical** |
| roster | index | 222, `71f045b7…` | **222, `5c6fdfdf…`**. No tape was added or removed, so no roster pin moved |
| bounded vitest AFTER | the same 61 files | 3,084 / 3,084 | **3,084 / 3,084**. Includes `ropeSword`, `gameClock`, `fidelityF1c`, `r8Acceptance`, `campaignChain`, `rerecordCampaign` |
| `r8Acceptance` exposure | — | — | **no new exposure**: no tape entered a bob room. `r9-solve-12`'s row is the same room. Its typed `ticks: 2419` → **2364** (see trap 2) |
| bot log | `seedling-bot-log.md` | — | `### Seedling fidelity WATCHERFLIP — the silent squares released`, after WATCHER, with two trap candidates |
| prose | `seedling-bot.md` | — | the census fact (no planner volume), `r9-solve-12` 2,364, the chain 10,923 |
| typed copies | `gameClock.js`, `gameClock.test.js`, `census-seedling-campaign.mjs` | — | comments: the crossing t2284 and the landing t2364 (the 80-tick walk-on law is unchanged) |

**Trap candidates** (in the log):
1. **A seam is more than the clock.** `grass_cut` rode six boot-only windows; the brief listed only `seam.time` and
   `rng.cosmetic`.
2. **An untested typed copy drifts silently.** I predicted that `r8Acceptance`'s exposure row with `ticks: 2419`
   restored would go red. **Measured: 93/93 green**, because no check reads that field. It is updated to the true
   value anyway.

## The JS arc's pins

- **No JS-arc file was edited**: no `jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js` or solver worker.
  `jsRuntimeDeclarations` and `seedlingPlaythroughOverlay` are green at the head.
- No contract changed (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`). `solverBot.js` had
  comment and refusal-text edits only, in an arm that is now unreachable.
- **What the arc sees:**
  - a world built from a level with a silent watcher has one fewer `proximityHazards` row;
  - a live solve through L12 (or L37, or L43) can plan shorter;
  - any JS-arc pin that typed `r9-solve-12` 2,419, the chain 10,978, or a silent watcher's `held-silent` volume now
    reads 2,364, 10,923 and none. None was found in the files measured.

## Deltas

| row | W0 | head |
|---|---|---|
| identity log | `76832d7a…` | **`5bf10815…`**, one row |
| `r9-campaign --check` | `bfbaccbb` exit 0 | **`56bb3724` exit 0** |
| chain | 10,978 t | **10,923 t** |
| tapes | — | **7 moved** (1 walk, 6 boot-only); 1 expectation moved, 6 re-recorded byte-identical; 1 trace moved |
| index | `71f045b7` | `5c6fdfdf` (222) |
| constants | 4,976 | **4,968** (8 retired) |
| surface / entities / profile | 198 / 518 / 138 | unchanged |
| tapeRunner | 501 `51829dac` | unchanged |
| bounded vitest | 3,084 / 3,084 | 3,084 / 3,084 |
| survey | 138 / 97 / 2 | 138 / 97 / 2 (5 steps changed, none flipped) |

**Sources at the head:** `levelWorld.js` `c53400104190af447a735ec6a8c99ad1` (base `b6add8f7…`), `solverBot.js`
`83319ad3cfe9b9efec2b27b83db162b5` (base `58fc334b…`, comments only).

## What the brief got wrong (measured)

1. **"seam/rng.cosmetic/tick0 only".** That holds in kind: every moved field is under `seam`, `rng` or `tick0`. But
   `seam` carried **`grass_cut` −12** as well as `seam.time` −55. DASHFLIP's table listed `seam.music` the same way.
2. **"Re-run any residue-sensitive F1c rows the clock shift touches … L18 … should not move — verify."** Verified:
   window 19 is before window 24, its tape is byte-identical, and `fidelityF1c` is green.
3. **"The first refusal past 2.2"** (WATCHER: step 96, L38, after the Bob Boss at step 88). The route has been rebased
   since: 237 steps (WATCHER had 265), leg 2.2 is step 55 and the Bob Boss is step 60. The first refusal past 2.2 is
   **step 56 (L22)**, unmoved by this slice. L38's `buttonroom` refusal is now step 68.
4. **"the survey 146/116/3 → 148/114/3"** (WATCHER's). At this base it reads 138 / 97 / 2, and the release moves no
   verdict.
5. **`campaignChain.js`'s note.** Its note *"the survey's own solve is 2419 tick(s)"* is U13's measurement of a 2.2
   step that has since been renumbered: today's `--through=2.2` step 24 is L0, 168 t. It is copied into
   `r9-solve-12`'s description beside the new "Solver: 2364 ticks". It was **left as is**: an edit there re-writes
   the tape, and it is a historic record. Say if it should read otherwise.

## Residue

| # | item | owner |
|---|---|---|
| 1 | `campaign-frontier.json` was **not** re-derived, by rule; its chain row is now 10,923 | coordinator |
| 2 | The full tier owes a CI drive: 7 tapes were re-recorded | CI |
| 3 | `resolveTalkStrategy`'s SILENT arm is now an unreachable guard. Deleting it would drop `solverBot`'s `silentHazards` read, and so a surface row; it was left for a slice that owns the solver | fidelity |
| 4 | `seedling-bot.md` line 388 still says *"window 19 at hammer residue 42"*; DASHFLIP's report says 40. This is pre-existing prose, not this slice's | docs |
| 5 | The browser gates not run here: `check-seedling-wasm-ship` CLAIM 7 (the end state is unchanged, L30 (224,80); the chain clock is −55) and `plan-seedling-r7-ends-meet` | CI / coordinator |
| 6 | Step 66 (L12, TIMEOUT) and step 56 (L22) are the next work orders on the survey | fidelity |

## Byte-inertia

- **Outside the licence nothing moved:**
  - every identity row but `r9-campaign` is unmoved;
  - windows 1–23 are untouched;
  - the 6 boot-only expectations are byte-identical;
  - the five planners above are byte-identical at both ends;
  - surface, entities, profile and tapeRunner pairs are unmoved;
  - the constants change is the 8 retired rows of the deleted literal.
- **Not touched:** `campaign-frontier.json`, any AS3/wasm/gitlink/rules file, the JS arc's files, DASH/RETURN/ROBUST
  regions.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used.
- **Mutants:** every one was a copy and restore, md5-checked (`levelWorld.js` `c5340010…`, `r8Acceptance.js` back to
  its head bytes).
- **Tree dirt:** the survey writes `.cache/seedling-survey/` (gitignored). Scratch, not committed: both identity
  logs, both survey JSONs, the vitest JSONs, the producer/record/differential logs and the scratch worktree.

## Rows to BANK

- **Identity:**
  - log **`5bf108151ad7a075428d0ff20f15240e`** (at `003a0af`);
  - `r9-campaign --check` **`56bb3724fd0ed3dda184e6e7d6d5d27c`** (exit 0);
  - the other five `--check`s are unmoved (`405d9c4b`, `8e7a43be`, `33d20889`, `35456fbc`, `6cd35fe1`);
  - `ENEMY census default` is unmoved (`68466067…`).
- **Chain:** **10,923 t**, 30 windows. The whole-chain differential gives 879 PASS / 0 FAIL.
- **Tapes:**
  - `r9-solve-12` `33b66215df3af6b3f9227d167be586b4` (2,364 t), its expectation `3e7cd43b…` and trace
    `bc96ad50338af433dce9e1b1be1214a5`;
  - the six boot-only tapes as in the D2 table;
  - index **`5c6fdfdf779a71927a4e44936750bbbc`**. **Roster 222.**
- **tapeRunner:** 501 `51829dac294c79fba6ed687124fdaf96` (unmoved).
- **Censuses:** constants **PASS 4,968**, surface GREEN 198, entities 518, profile 138.
- **Survey (`--through=end`):** **138 / 97 / 2**. The first refusal past 2.2 is step 56 (L22).
- **Bounded vitest:** 61 files, 3,084 / 3,084.
