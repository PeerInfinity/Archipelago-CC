# Seedling HAMMER-PHASE — slice RE: the refuge's best-ETA cut, measure-first

Slice `seedling-hammer-re` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-14): *"Both, in
parallel"*: this slice runs beside CW (the L40 chaser wall). It is one behaviour lever behind ONE new switch, **OFF**:
`pressKillCost.REFUGE_ETA_CUT` (`SEEDLING_REFUGE_ETA_CUT=1`, `withRefugeEtaCut(enabled, fn)`). The flip is the user's.

| | |
|---|---|
| Start SHA | **`3a53894a9a`** (= `origin/main` at the fetch = BW's harvest, the brief's floor) |
| Head | the commit carrying this report. W0+D1 `fcd3ea1` (evidence), D2 `ea7f292` (code, gate, mutants), D3+D4 `ebcd52b` (evidence, records), then this report |
| Branch | `claude/seedling-hammer-re-mpky45` (the harness names it; the brief's `seedling-hammer-re`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9582` (`SEEDLING_PORT=9582`), PID 1856, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS** (0 hidden events, 0 cell changes; both pre-filters refused on numbers) **· D2 PASS** (the switch, OFF; 6 gate rows; 5 mutants, each red) **· D3 PASS, no movers** **· D4 PASS** |

## The one thing to know first

**The cut is exact on every measured workload, and ON it takes about a third off staging A.**
- **Census (D1).** It was measured before it was built: 57,312 refuge previews in 4,776 derivations.
  - **0** threw anywhere, so none threw past the cut.
  - **0** chosen cells changed.
  - No refuge preview ended on a lethal pit or a drowning.
- **ON vs OFF (D3).** Byte-equal, with BW OFF and ON, on:
  - all 13 D1 workloads;
  - the identity block;
  - `r9-campaign --check`;
  - the ENEMY census.

  Nothing moves. Nothing was re-recorded.
- **Timings** (3 interleaved rounds, medians):
  - staging A, sword: **196.0 → 138.7 s (1.41×)**;
  - staging A, ghost: **188.8 → 124.3 s (1.52×)**;
  - legs 397 / 414 (ghost): 1.08× / 1.14×.
- **It is still a behaviour switch, by construction.** A throw that the full preview would raise past the cut, in a
  candidate that would lose, is not raised. None occurs today.
  - It also lowers `progressPreview`'s `previewStates`.
  - It lowers BW's `refugeAsked` / `refugeRefused` counts. The gate pins `refugeRefused` 11 → 9 at leg 381's t1150,
    and the answer there is unchanged.
- **Where the refuge runs at all:** staging A (sword and ghost), legs 397 / 414 with the ghost, and twice on 381 with
  MOVING_WAIT + BOMBS. These preview no refuge, so the switch cannot move them:
  - L18;
  - C2's ghost staging;
  - `r9-campaign`;
  - legs 378 / 381 / 384 / 396 / 400.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main`; the harness's branch was already at `origin/main` | `3a53894a9a` (= the brief's floor) |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine): `git submodule update --init` each |
| identity block | `SEEDLING_PORT=9582 bash scripts/procgen/identity-block.sh .` (venv) | non-`#` md5 (the `rc=` line dropped) **`77080c2e`** = BW's: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, reference ALL 7 + 5 MATCH (`evidence/identity-w0.txt`) |
| six `--check`s | the block's loop | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 |
| tapeRunner pairs | `status\tfullName` sorted, `\n`-joined, from the bounded run's JSON | **611**, `75a3c41f0c91f6e71953e82d8259dc60` |
| surface / constants / entities / profile | each `--check` | GREEN **288** · PASS **5,846** · PASS **558** · PASS **138** (`evidence/censuses-w0.txt`) |
| roster | `fixtures/tapes/index.json` | **277** |
| bounded vitest BEFORE | 20 files: every non-slow test `rg -a` finds naming `deriveRefuge`, `refugeNow`, `previewWalk`, `PRESS_KILL_COST`, `PRESS_KILL_BOMBS` or `progressPreview`, plus `solverBot*`, `hammer*`, `solverSpinnerKill*`, `pressKillCost`, `solveProgress*`, `tapeRunner` (list in `evidence/vitest-before.txt`) | **1078 / 1078** |

### Today's staging A, and the refuge's share

- **Answers.** Staging A is P1's boot view, `collect:880,816`, solved by G1's `g1-solve.mjs`.
  - Sword: REFUSED at 3,113 ticks on `bob@736,752`, msg md5 `89b04d04`.
  - Ghost: REFUSED at 2,195 ticks, msg md5 `bca1369a`.
  - Both are G1's walks. The message md5 differs from G1's `6c8a19c6` because this driver hashes `res.message` only.
- **Three runs each** (the D3 OFF runs, which are the base code path):
  - sword: 231.7 / 194.7 / 196.0 s, **median 196.0 s**;
  - ghost: 188.8 / 168.4 / 191.1 s, **median 188.8 s**.
  - P2 measured 124.6 s for the sword on its box. This box is slower: its D1 base run was 201.2 s.
- **The profile** (`node --cpu-prof`, sword, OFF, beside three other jobs; `evidence/prof-A-sword.txt`):

  | | OFF | ON |
  |---|---|---|
  | `deriveRefuge` (inclusive, under `execKillByPressOnce`) | **33.9 %** (77.2 s) | 11.6 % (18.3 s) |
  | `previewWalk` under `deriveRefuge` | **26.4 %** (60.1 s) | 0.8 % (1.3 s) |
  | `clearOfHammersAt` under `deriveRefuge` | 3.8 % | 5.7 % |
  | `deriveStrike` (inclusive) | 26.9 % | 39.3 % |
  | `previewWalk` under `deriveStrike` | 22.3 % | 32.9 % |
  | total under the profiler | 227.6 s | 158.4 s |

  **Today the refuge is a third of staging A, and ¾ of that is its previews.** After the cut, what is left in the refuge
  is the hammer test and `walkableCells`. What is left in the solve is the strike's previews.

## D1 — the census of what the cut would hide (PASS)

**The lab.** It is a scratch copy of the tree (`frontend/`, `scripts/`), with `deriveRefuge` instrumented behind
`RE_LAB` (`evidence/d1-lab.diff`).
- **Census mode** runs every candidate's FULL preview (the base walk; its `stopWhen` only counts and returns `false`).
  For each preview it records:
  - the length;
  - the truncation kind;
  - any throw, and the sample it came at;
  - the cut that would have applied (`best.eta` held at that moment);
  - the tolerance-adjusted ETA lower bound;
  - whether the player-to-cell line is blocked.
- Beside the base choice, it simulates **the cut's own choice**, with its own running best.
- **Hidden** means: a throw, a lethal pit or a drowning at or past the sample the cut would have stopped at
  (`len >= cut + 1`).
- Modes `cut`, `lb` and `wall` run the cut itself, the cut plus the LB pre-filter, and the cut plus the wall pre-filter.
- The census ran as the base: its answers equal the base runs', byte for byte.
- Records: `evidence/d1-census-records.tar.gz`. Summary: `d1-census-summary.jsonl` (`census.py`).

| workload | derivations | previews | kinds | threw | hidden by the cut | cell changes (cut) | states full → cut |
|---|---|---|---|---|---|---|---|
| staging A, sword | 1,315 | 15,780 | 10,074 arrived · 4,627 stalled · 1,079 crossed | 0 | **0** | **0** | 2,145,515 → 26,721 |
| staging A, ghost (G1 ON) | 1,071 | 12,852 | 8,451 arrived · 4,401 stalled | 0 | **0** | **0** | 1,991,430 → 18,132 |
| leg 397, ghost (G1 ON) | 1,144 | 13,728 | 13,728 arrived | 0 | **0** | **0** | 523,658 → 58,796 |
| leg 414, ghost (G1 ON) | 1,244 | 14,928 | 14,928 arrived | 0 | **0** | **0** | 582,938 → 72,348 |
| leg 381, `SEEDLING_MOVING_WAIT=1` + `SEEDLING_PRESS_KILL_BOMBS=1` | 2 | 24 | 24 arrived | 0 | **0** | **0** | 648 → 496 |
| legs 378 / 381 / 384 / 396 / 400 (sword) | 0 | 0 | — | — | — | — | — |
| L18 sweep (45 residues) | 0 | 0 | — | — | — | — | — |
| C2's L18 ghost staging (`ghost-sweep.mjs`, 45) | 0 | 0 | — | — | — | — | — |
| `solve-seedling-r9-campaign --check` (with `r9-solve-16`) | 0 | 0 | — | — | — | — | — |
| **total** | **4,776** | **57,312** | | **0** | **0** | **0** | |

Staging A's 2,145,515 states and 26,721 before-the-cut states are P2's numbers to the state.

**The guard the brief proposed** re-runs the full preview for the CHOSEN cell only. **It is vacuous by construction.** A
cell can become the best only by arriving at or before the bound (`eta <= best.eta`; a tie must arrive at `best.eta`).
So the winner's preview is never stopped. Measured: in 4,776 derivations the chosen cell's full length never reached
its cut, and no tie was won on clearance. There is nothing for that guard to re-run. The cut's real guard is its
**bound**: it is the best that PASSED every test (BW's `refugeBlast` included), never a refused candidate's ETA. Mutant
M1 below shows that a refused bound changes the answer.

### The time saved (D1, one run each, the lab; `evidence/d1-times.jsonl`)

| workload | base | cut | cut + wall pre-filter | answers (time stripped) |
|---|---|---|---|---|
| staging A, sword | 201.2 s | 140.1 s | 150.1 s | 1 distinct of 5 (census, base, cut, wall, lb) |
| staging A, ghost | 187.7 s | 126.6 s | 127.9 s | 1 of 4 |
| leg 397, ghost | 202.4 s | 178.1 s | 184.9 s | 1 of 4 |
| leg 414, ghost | 201.2 s | 179.5 s | 183.6 s | 1 of 4 |
| leg 381, MW + BOMBS | 226.1 s | 223.1 s | 231.3 s | 1 of 4 |

### The two pre-filters (measured; neither ships)

| pre-filter | exact? | measured |
|---|---|---|
| **ETA lower bound** (`minTicksBetween`, the strike's "admissible" floor), with the arrival tolerance taken off: skip a candidate whose bound exceeds `best.eta` | **no** | `minTicksBetween` divides by `WALK_SPEED` (0.8); the walk runs faster (the docblock beside `STEP_LOOKAHEAD` says the player's top speed is "a little over two"). Previews arriving sooner than the bound (tolerance-adjusted): A sword 4,365 · A ghost 3,965 · 397 7,932 · 414 8,832. As a pre-filter it **changes the chosen cell in 6 (397) and 4 (414) derivations**. On A it would cut states 26,721 → 1,508, but `lb` timed 141.8 s against the cut's 140.1 s |
| **wall** (drop a cell whose straight line from the player is blocked, `run.collideLineSolid`) | **no** (not by construction) | Every stalled preview was wall-blocked (A: 4,627 / 4,627). But blocked cells also arrive: 543 (A sword) · 461 (A ghost) · 3,004 (397) · 3,318 (414) · 2 (381). None was chosen in these runs, so 0 cell changes here. It saves nothing over the cut (each run above was slower with it, the line test's own cost) |

**Verdict: D1 clears.** The cut hides no event that changes a verdict on any workload, so the brief's STOP does not
apply.

## D2 — the switch, OFF (PASS)

- **`pressKillCost.js` gains:**
  - `REFUGE_ETA_CUT` (OFF; `SEEDLING_REFUGE_ETA_CUT=1`) and `REFUGE_ETA_CUT_DEFAULT`;
  - `withRefugeEtaCut`;
  - `refugeEtaCut(eta)`, a `stopWhen` predicate: `false` for the first `eta` samples, `true` from the `eta + 1`-th;
  - the instrument `REFUGE_ETA_CUT_COUNTS` (`previews`, `cut`) and `resetRefugeEtaCutCounts`.

  It is a behaviour switch in a cost file, for BW's reason: the solver's door re-exports only `levelRun.js`'s import
  closure. The predicate reads no run state, so it belongs there.
- **`solverView.js`:** the three symbols on the `pressKillCost.js` line.
- **`solverBot.deriveRefuge`:** with the switch ON and a best held, it calls
  `previewWalk(run, [cell], DEFAULT_TOLERANCE, { stopWhen: refugeEtaCut(best.eta) })`. A stopped walk is
  `truncated.kind === 'stopped'`, and the refuge already skips every truncated walk. OFF, it calls `previewWalk` with the
  same three arguments as before. **`previewWalk`'s body is not touched.**
- **Named in the switch's comment and in the doc** — what the cut can change:
  1. A throw past the cut, in a losing candidate, is not raised: the stepper's `deathRefusal`, or a forecast's own
     refusal (`chaserForecast`'s shake band). Measured: none.
  2. A lethal pit or a drowning past the cut: not raised, and it could not matter (the candidate is skipped either way).
  3. `progressPreview`'s `previewStates` and tile map count only the states taken. The `previews` count is unchanged.
  4. BW's `refugeAsked` / `refugeRefused` drop: a refused candidate after the best is stopped before the bombs are asked.
- **`solveProgress.test.js:279`** (`previewStates > 0`) stays true. It runs OFF by default. ON, the file is green too
  (`evidence/vitest-on-switch.txt`), and its hammer solve is L18, which previews no refuge.
- **The gate, `hammerRefugeCut.test.js` (6 rows):**
  1. the switch ships OFF;
  2. `with…` restores, also on a throw;
  3. the predicate's edge (`eta` 3 → `F F F T T`; one count per predicate);
  4. OFF writes nothing to the instrument;
  5. G1's ghost witness walk (staging A) at refuge ticks 600 / 972 / 973 / 974 / 1251 / 1766 / 2191: ON = OFF, all 84
     previews counted, the cut exercised. 972–974 and 1251 are the ticks where a later candidate beats the first arrival;
  6. leg 381's MOVINGWAIT witness at t1150 with `PRESS_KILL_BOMBS` ON both ways: (216,168) = BW's, with
     `refugeRefused` 11 → 9. With BW OFF it is (232,200) both ways.

  Every row that replays a walk has an explicit timeout. None runs a full solve; the file takes ~9 s.
- **Mutants** (copy → edit → gate → restore, md5 checked after each; `evidence/mutants/`):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | **the guard removed**: the bound taken from any arrived walk before the bombs refuse it | red at t1150 (bombs) | **red**: the refuge becomes `null` |
| M2 | the cut at the wrong ETA, off by one (`taken >= eta`) | red | **red**: the predicate row and t1150 |
| M3 | the cut at the wrong ETA, half (`best.eta / 2`) | red where a later candidate wins | **red**: t1251 (488,872) → (488,856), and t1150's count |
| M4 | the cut never taken | red | **red**: the counts |
| M5 | the cut before a best is held | red | **red**: the walk row and t1150 |

No mutant is blind.

## D3 — ON, STOP at the movers (PASS: no movers)

**Answers** (`evidence/d3-answers.txt`): the md5 of each driver's stdout with every wall-clock field stripped
(`norm.py`). "base" is D1's census run, which equals the base runs.

| workload | base | cut ON, BW OFF | cut OFF, BW ON | cut ON, BW ON |
|---|---|---|---|---|
| staging A, sword | `7c279226` | = | = | = |
| staging A, ghost | `b3b38f55` | = | = | = |
| leg 397, ghost | `4720caab` | = | = | = |
| leg 414, ghost | `489a9482` | = | = | = |
| leg 378 / 381 / 384 / 396 / 400 | `1c2e9305` / `d38ea9c0` / `26b9204f` / `54ec94b7` / `0a85d42f` | = | = | = |
| leg 381, MW + BOMBS (BW's witness workload) | `e958767b` (REFUSED at t1248 by name, `#9`'s Explosion on `bob@272,112`) | = | = | = |
| L18 sweep, 45 residues | `864ab175` | = | = | = |
| C2's L18 ghost staging, 45 | `1ca7eed5` | = | = | = |
| `r9-campaign --check` | `4199d181` | = | = | = |

| row | OFF (W0) | cut ON, BW OFF | cut ON, BW ON |
|---|---|---|---|
| identity block, every value row | `77080c2e` | **= W0** (`evidence/identity-on-bw0.txt`) | **= W0** (`identity-on-bw1.txt`) |
| six `--check`s incl. r9-campaign | `… 712f0ead`, exit 0 | = | = |
| ENEMY census | `afdc6d1a` | `afdc6d1a` | `afdc6d1a` |
| reference row | ALL MATCH | `2 DIFFER` (the new symbols and doc, before D4 regenerated them; BW saw the same) | the same |

**No row moves. Nothing was re-recorded.**

**Timings** (`evidence/timings.sh`, `timings.jsonl`). Three rounds with OFF/ON order alternating per round, one process
at a time on the 4-core box, nothing else running. Load average at each start: 1.01–1.18, median 1.08. Each workload
gave one distinct answer over its 6 runs.

| workload | OFF median / min | ON median / min | OFF ÷ ON (medians) |
|---|---|---|---|
| staging A, sword | 196.0 / 194.7 s | **138.7 / 134.8 s** | **1.41×** |
| staging A, ghost | 188.8 / 168.4 s | **124.3 / 114.2 s** | **1.52×** |
| leg 397, ghost | 180.6 / 179.3 s | 166.8 / 162.8 s | 1.08× |
| leg 414, ghost | 193.8 / 187.3 s | 169.8 / 169.6 s | 1.14× |

The legs gain less because none of their previews stall: every one arrived (they press into no wall).

## D4 — records (PASS)

| row | result |
|---|---|
| log / bot doc | `seedling-bot-log.md`: `### Seedling hammer-phase RE — the refuge's best-ETA cut`, with the census table. `seedling-bot.md`: the paragraph after BW's (*The refuge's best-ETA cut*) |
| surface | `--check` RED on the three new imports → `--write` + classified (`seedling`: two constants, one function) → **GREEN 291** |
| constants | `--profile-rows` (138, no change), `--write`, `--check`: **PASS 5,851** (+5 structural, 0 moved) |
| entities / profile | PASS 558 / 138 |
| reference | `generate-procgen-reference.mjs` (README word count, docs index), then `--check`: **ALL 7 + 5 MATCH**. `scripts/quicklaunch/generate-docs-index.mjs`: current (164 docs) |
| bounded vitest AFTER | 30 files = the W0 set + `hammerRefugeCut` + `boxLock`, `seedlingConstantsCensus`, `procgenDocs/{generated,docLinks,docsRender}`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface`, `checkProcgenHelp`: **1358 / 1358** (`evidence/vitest-after.txt`); tapeRunner **611 `75a3c41f`** |
| with the switch ON | `solveProgress.test.js` + `hammerRefugeCut.test.js`: 18 passed, 1 skipped (the "ships OFF" row skips by design under the env) |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, no rebase, no force-push, nothing to `main` |

## The deltas

| | before | after |
|---|---|---|
| identity block | `77080c2e` | `77080c2e` OFF; every value row equal ON (BW OFF and ON) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead` | identical, exit 0 |
| reference | ALL 7 + 5 MATCH | ALL 7 + 5 MATCH (regenerated) |
| tapeRunner pairs | 611 `75a3c41f` | 611 `75a3c41f` |
| bounded vitest | 20 files, 1078 / 1078 | 30 files, 1358 / 1358 |
| surface | GREEN 288 | GREEN 291 |
| constants | PASS 5,846 | PASS 5,851 |
| entities / profile / roster | 558 / 138 / 277 | 558 / 138 / 277 |
| staging A (sword / ghost), switch ON | 196.0 / 188.8 s | 138.7 / 124.3 s |

**Files.**
- **New:** `hammerRefugeCut.test.js`.
- **Edited:**
  - `pressKillCost.js` (the RE section);
  - `solverView.js` (3 symbols);
  - `solverBot.js` (the import and `deriveRefuge`'s loop: 11 lines added, 1 removed);
  - the census JSON/CSV, the docs and the generated index.
- **Not touched:** `previewWalk`'s body, `refugeNow`, `refugeBlast`, `levelRun.js`, `levelWorld.js`, `strikePolicy.js`,
  `contactFidelity.js`, the climb ladder, the kill rung, `deriveStrike`, `execKillByPress`'s tail/escape, the walk/strike
  cost, `runLatchedWait` / `runHold` / `runPace`, the chaser arm, BAIT, `dangerMap`, `spitForecast`,
  `ghostSpinnerPress.js` and the JS arc's files.
- No AS3, wasm, gitlink or rules edit.

## What the brief got wrong (measured)

1. **"A guard that re-runs the full preview only for the CHOSEN cell … is a candidate: measure it."** It is vacuous. The
   chosen cell is never cut: it wins only by arriving at or before the bound. Measured: 0 of 4,776. The guard that
   matters is the bound's provenance, a passed best and never a refused candidate's ETA (mutant M1).
2. **"A death (`deathRefusal`), a forecast refusal or a lethal pit the full preview would raise is not raised."** True in
   principle. In practice **no refuge preview threw anywhere, and none met a lethal pit or a drowning**, on any workload.
   A lethal pit could not change a choice anyway: `previewWalk` returns it as a truncation (`kind: 'lethal-pit'`), and
   the refuge skips every truncated walk.
3. **"The geometric pre-filter P2 named … is it exact?"** No. Straight-line-blocked cells arrive 2–3,318 times per
   workload; the controller slides along the wall. None was chosen here, but nothing makes that true by construction.
   It also does not pay: the cut already stops the stalls once a best exists, and the line test costs time.
4. **The workloads.** Several of the brief's workloads never reach `deriveRefuge`'s previews: L18, C2's L18 ghost
   staging, `r9-campaign` and P1's L40 legs (378 / 381 refuse at the bomb hold; 384 / 396 / 400 never press-kill). Only
   staging A, 397 / 414 (ghost) and 381 with MOVING_WAIT + BOMBS (2 derivations) do.
5. **"The ETA floor is admissible"** is not in the brief, but the brief invites the pre-filter it would make. Measured:
   `minTicksBetween` overestimates the refuge walk's arrival on 3,965–8,832 previews per large workload. It divides by
   `WALK_SPEED` 0.8, and the walk runs faster. See residue 1: `deriveStrike` relies on it.
6. The bootstrap's `READY` again left five submodules uninitialised.

## Residue

1. **For `deriveStrike`'s owner (not this slice's region; numbers only).** `minTicksBetween` is documented as "an
   ADMISSIBLE lower bound" on a walk's ticks: "`applyInput` clamps EACH AXIS at `WALK_SPEED`". The refuge's previews
   arrive sooner than it allows on 4,365 / 3,965 / 7,932 / 8,832 previews (staging A sword / A ghost / 397 / 414), even
   with the arrival tolerance taken off, by up to 15+ ticks. If the same holds for the strike's previews, the strike
   scan's ETA floor drops reachable (cell, tick) opportunities before the `STRIKE_CANDIDATES` truncation. This is
   unmeasured on the strike side. It is a question for whoever owns `deriveStrike`, not something to fix from here.
2. **For the user: the flip.**
   - The movers are none: every measured workload, the identity block and the campaign are byte-equal ON.
   - What ON forgoes is a throw past the cut in a losing refuge candidate. There are 0 in 57,312 previews today; a
     future level could add one.
   - What ON changes in instruments: `progressPreview`'s state counts, and BW's refuge counts.
   - The page cannot see the switch (env-only, like BW's). A flip to default-ON reaches the page worker.
3. **What is left on staging A after the cut:** `deriveStrike`'s previews (32.9 % of the ON profile) and the refuge's
   hammer test (5.7 %). Fewer refuge waits is the hammer arc's question, not a cost one.
4. `REFUGE_ETA_CUT_COUNTS` is a module global like P1's and P2's counts: two solves in one process sum into it.
5. **CI for the planner** (dispatch returns 403 from the cloud):
   - `JavaScript Unit Tests` on `claude/seedling-hammer-re-mpky45` at the head (`node scripts/procgen/ci-vitest-summary.mjs <head> --wait`).
   - Optional: `seedling-divergence-sweep.yml`, `-f mode=inv -f producer=solver -f shards=1 -f keys="level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Chest|level_40__r23c29 <- in_L43_176_464 -> location:Level 040 - Chest"`. Expect today's verdicts: the switch is env-only, so the page runs it OFF.
6. **Standing rows to bank:**
   - `REFUGE_ETA_CUT` OFF;
   - `hammerRefugeCut` 6 rows;
   - surface 291; constants 5,851;
   - bounded AFTER 30 files / 1358;
   - roster 277 and tapeRunner 611 `75a3c41f`, both unchanged.
7. **Tree hygiene.** The lab copy (`<scratchpad>/lab`) and the scratch outputs were removed by name. Nothing else was
   created outside the evidence directory.

## Evidence (`seedling-hammer-re-evidence/`)

- **Scripts:**
  - `lab-run.sh` (one workload in one mode);
  - `sink.mjs` (`--import`, collects the census rows);
  - `census.py`, `norm.py`;
  - `g1-solve.mjs` (G1's), `d1-leg.mjs` (D's), `ghost-sweep.mjs` (C2's);
  - `timings.sh`;
  - `mutants/mt.sh`;
  - `d1-lab.diff` (the lab's `deriveRefuge` against the base).
- **Data:**
  - `identity-{w0,on-bw0,on-bw1}.txt`;
  - `censuses-{w0,after}.txt`;
  - `census-times.jsonl`, `d1-census-summary.jsonl`, `d1-census-records.tar.gz`;
  - `d1-times.jsonl`, `d1-answers.txt`;
  - `d3-answers.txt`, `d3-answers-times.jsonl`;
  - `timings.jsonl`;
  - `prof-A-sword.txt`;
  - `vitest-{before,after,on-switch}.txt`;
  - `mutants/mut-*.txt`.
