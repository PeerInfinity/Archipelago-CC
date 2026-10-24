# Seedling fidelity LINEFLIP: TERRAIN's W1 (`collideLine`'s untruncated samples) ON, and `r9-solve-18` re-recorded on the game (cloud report)

**Slice:** `seedling-fidelity-lineflip`, an Opus build slice run in the cloud for the model-fidelity arc (planner
`seedling-fidelity-planning-3`).

⚖ **Licensed (user, 2026-10-05):** *"Yes: flip + re-record"*. The licence covers:
- turning `collideLinePointsExact` ON roster-wide;
- re-recording `r9-solve-18` on the game, with `r9-solve-19`'s seam time, the campaign `--check`'s tick sum and seam oracles, and the boot-only windows after it;
- the two model-computed unit pins.

**STOP if anything else moves.**

| | |
|---|---|
| Started from | `origin/main` @ **`0fdd9f967fae1d67516f6232168d685b27582120`** (the WAVE-6 merge) |
| Harness branch | **`claude/seedling-fidelity-lineflip-sp1obn`**. Every push went here; nothing went to `main` |
| Commits | D1 `7337318` · D3 pins `c7d7232` · D2 `b7fdcb3` · D3 F1c `9effa37` · docs `f56f6f8` · log `b409053` · this report (the head) |
| Dev server | `serve-nocache.py 9410` (`SEEDLING_PORT=9410`) |
| Verdicts | **W0 PASS · D1 PASS with a STOP-listed mover (below) · D2 PASS · D3 PASS (the game witness of 221 t not recorded: named) · D4 PASS** |

## The one thing to know first

**The flip reaches procgen.** TERRAIN's mover list was what it MEASURED: six producers, the roster and 47 test files.
It never ran the identity block with W1 ON. With W1 ON, the identity block moves **three rows beyond the licence**:
`empty pairs c3`, `empty pairs c6` and `carved pairs c4`.
- **Mechanism:** generating a level runs the certify solve, and the spinner hammer is priced through the same `collideLine`.
- **Attribution:** with W1 off by the env hook, all three give W0's digests again.
- **Two of the c4 rows are a different generated level:** `winding` post-shield and post-swim seed 6 (level `d7cdafa0` → `acf5eaaa`, attempts 33 → 48).
- **The other rows are certify tick counts on the same levels.**
- **No committed artifact moved:** the generated set reads `OK`, and ENEMY census, killgate s2/5/9 and levels s1 are unmoved.

Per DASHFLIP's precedent (its ENEMY census mover), this is **listed and STOPPED for the coordinator/user, not acted
on**. The licensed work landed in full. If the user declines the census movers, the revert is the one-line default
plus D2's commit.

Everything licensed:
- `r9-solve-18` **510 → 519 t**, recorded on the game;
- the chain **10,932 t**;
- whole-chain differential **879 PASS / 0 FAIL**;
- `r9-campaign --check` **exit 0 @ `a569eeec…`**.

## W0 (at `0fdd9f9`, primary tree)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9410 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`a0ede89933ae1d5ff43cceebd859a867`** |
| six `--check`s | in the block | `405d9c4b` · `8e7a43be` · `33d20889` · `35456fbc` · `6cd35fe1` · `56bb3724`, all exit 0 |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| surface / constants / entities / profile | each `--check` | **GREEN 208** · **PASS 5,040** · **518** · **138** |
| roster | `fixtures/tapes/index.json` | **238**, `5e3d28c4ecb66e106889d54bf9b74f13` |
| bounded vitest BEFORE | 43 files (below) | **2,250 / 2,250 green** |
| tapeRunner | `(fullName, status)` lines, sorted | **533**, md5 **`71bda323e8c6a709fecbfd0734ebf945`** |

The 43 files are:
- the brief's list: `contactFidelity`, `crusher`, `spinner`, `solverSpinnerKill`, `seedlingCanCross`, `wallFlyer`, `hazards`, `fidelityAxe`, `levelRun`, `solverBot`, `campaignChain`, `rerecordCampaign`, `tapeRunner`, `fidelityF1c`, `fidelityDash`, `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `watchOverlays`, `r5Shaft`, `decisionTrace`, `entityBlocks`, `solverDeadline`, `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`;
- every `grep -a` hit for `collideLineSolid` / `collideLinePointsExact` / `hammerHitsPlayer` / `CONTACT_FIDELITY` / `r9-solve-18|19`: `gameClock`, `playthroughAcceptance`, `procgenCountableClock`, `r5Totem`, `spinnerClockPairing`, `watchManual`;
- the consumers of the shared function: `bobBoss`, `dangerMap`;
- `fixtures/tiers`, `rosterCategories`.

⚠ `drill.test.js` and `fidelityF5.test.js` do not exist. F5's rows live in `fidelityF1c.test.js`, and the drill's in `contactFidelity.test.js`.

## D1: the flip (PASS, with a STOP-listed mover; `7337318`)

**Prediction, measured before the edit** (the env hook `SEEDLING_CONTACT_FIDELITY=all`, no file touched):
- `r9-campaign --check` gives exit 1 at **`5aa27ba3…`**, TERRAIN's digest byte for byte. Its 5 failures: `r9-solve-18` artifact and trace DRIFT, the lengths, the sum 10923 → 10932, and `r9-solve-19`'s free oracle 10470 vs 10479.
- tapeRunner + `solverSpinnerKill` + `seedlingCanCross` + `fidelityF1c` + `spinner` + `dangerMap` + `bobBoss` (696 tests) give 3 red:
  - F2 221 t;
  - the L22 cause;
  - **`fidelityF1c` "the committed window IS … the rung's solve" (519 vs 510), which TERRAIN did not list.** It reads the committed `r9-solve-18` key for key, so it is the licensed mover read through a fourth file (D3).
- **tapeRunner unmoved:** 533, `71bda323…`.

**The edit:** `CONTACT_FIDELITY.collideLinePointsExact: true`, with the docblock saying why and what `false` reproduces.
`hazards.js`'s `collideLinePlayer` note no longer calls the shared function residue. `contactFidelity.test.js`: the
defaults row reads all three ON, plus 13 new rows replaying every witness at the shipped default (nine at 0 px,
including #264 and #283; the four residue rows at their tick). 59/59.

**The spinner hammer.** `spinner.hammerHitsPlayer` → `crusher.collideLineSolid` is read by:
- `levelRun` (billing);
- `dangerMap` (transit pricing);
- `solverBot` (`clearOfHammersAt`, the strike schedule);
- `solverView` and `watchOverlays`.

Measured with W1 ON:
- **every spinner tape in the roster replays unchanged** (tapeRunner pairs identical; `r1-dark-shield-spinner`, `f1c-l18-*`, the U-swim spinner tapes are inside it);
- `spinner`, `dangerMap`, `spinnerClockPairing` and `bobBoss` are green unchanged;
- what moves are **solves**: L18's window (D2), F2's synthetic chamber (D3), and procgen's certify solves (below).

**The identity block with the flag ON** (`idblock-d1`, md5 `5717c0e7…`) differs from W0 in **four** rows:

| row | W0 | W1 ON | attribution (W1 off by the env hook) | what moved |
|---|---|---|---|---|
| `r9-campaign --check` | `56bb3724` exit 0 | `5aa27ba3` exit 1 | licensed | `r9-solve-18` (D2) |
| empty pairs c3 | `05c5ef94…` | **`043e1944…`** | `05c5ef94` again | 1 row: post-sword seed 33, the same level/kept hashes, certify ticks `416->440` → `313->353` |
| empty pairs c6 | `e88baf9d…` | **`f85e7722…`** | `e88baf9d` again | 1 row: the same seed 33, `416->437` → `313->353` |
| carved pairs c4 | `f8cba3a8…` | **`4aa74add…`** | `f8cba3a8` again | 8 rows. **winding post-shield + post-swim seed 6: a DIFFERENT LEVEL** (`d7cdafa0` → `acf5eaaa`, kept `3e28eebe` → `ddc9d2a2`, attempts 33 → 48, ticks 66 → 419→640). rooms post-shield s2 251 → 254, rooms post-feather s9 185→134 → 197→131, branchy post-shield/swim s6 525 → 508, bushy post-shield s2 229 → 212, loopy post-shield/swim s6 705→657 → 700→657 (all the same levels) |

Every other row is unmoved: maze, acceptance, ENEMY census (`d59f0c97`, which includes the spinner and spinning-axe
rows), guard, AREA, killgate s2/s5/s9, levels s1, the generated set and the five other producers.

## D2: the re-record (PASS, `b7fdcb3`)

**Prediction:**
- windows 1–18 byte-identical;
- window 19 `r9-solve-18` 519 t;
- windows 20–30 boot only, `seam.time` +9.

Sequence (DASHFLIP/WATCHERFLIP's):
1. `SEEDLING_PORT=9410 node scripts/procgen/solve-seedling-r9-campaign.mjs`: **10932 t**. 12 tapes and 1 trace were written; windows 1–18 untouched. Exit 1 is the run compared against the pre-write tapes.
2. A field-by-field diff against the base: `r9-solve-18` moves `inputs`, `tick_count` and `description`. **Each of the 11 later windows moves `seam.time` +9 only**: no `rng.cosmetic`, `grass_cut` or `seam.music`, unlike the previous two flips.
3. `check-seedling-bot-differential --record --only=<the 12>`: **12 RECORDED, 12 "THE MODEL REPRODUCES THE RECORDING IT JUST MADE"**, ALL CHECKS PASSED (recording mode). **Only `r9-solve-18`'s expectation moved**; the 11 boot-only expectations re-recorded byte-identical.
4. `derive-seedling-tick0 --check` gave **11 FAIL**, exactly the moved boots. Then `--only=` those 11 wrote **11 of 11**, and `--check` gives ALL CHECKS PASSED (log md5 `acd4423e…`). After it, the 11 diff in `seam` + `tick0` only.
5. `generate-tape-index.mjs`: 238 tapes, index `5e3d28c4…` → **`df76e166414b685b23113394374e9989`**.
6. Whole-chain differential (`--only=` all 30, no `--record`): **ALL CHECKS PASSED, 879 PASS, 0 FAIL, 30/30 "live game matches the committed oracle stream"**, *"the declared endsAt IS the tapes' own length — endsAt 10932 vs the segments' 10932"*.
7. `solve-seedling-r9-campaign --check`: **exit 0**, md5 **`a569eeecff6dd6ad04e1e7e8a85d9ccc`**, the same in the AFTER block.
8. `census-seedling-campaign --check-frontier`: **chain PASS, segments PASS, arrivals PASS**, coverage ×2 PASS. **`sources` FAIL**, and it is pre-existing, not this slice's: the only differing key is `frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json` (`2df805d2` recorded vs `45ecbeb8` on disk), a file this branch does not touch. `campaign-frontier.json` was not edited (the coordinator re-derives it).

**The movers** (md5 before → after):

| window | tape | ticks | `seam.time` | tape md5 | expectation | what moved |
|---|---|---|---|---|---|---|
| 19 | `r9-solve-18` | **510 → 519** | 9940 (=) | `b5348b79` → `56033f8bcba35c2728868f6468e67dd2` | `98dfae19` → `e8bce792…` | the walk (licensed) |
| 20 | `r9-solve-19` | 746 | 10470 → 10479 | `a99330ff` → `5351c55f` | = | boot: seam.time, tick0 |
| 21 | `r9-solve-20` | 560 | 11386 → 11395 | `8f2e0df6` → `7f17810f` | = | boot |
| 22 | `r9-solve-13-v2` | 48 | 12116 → 12125 | `d1e02034` → `e38c0d09` | = | boot |
| 23 | `r9-solve-0-v3` | 299 | 12184 → 12193 | `3ad08fe1` → `17487f30` | = | boot |
| 24 | `r9-solve-12` | 2364 | 12954 → 12963 | `33b66215` → `ba5b33a9` | = | boot |
| 25 | `r9-solve-21` | 26 | 15258 → 15267 | `2f5d79ed` → `f2fcf7a4` | = | boot |
| 26 | `r9-solve-22` | 89 | 15304 → 15313 | `bc661cb5` → `b4bcac5f` | = | boot |
| 27 | `r9-solve-29` | 379 | 15413 → 15422 | `73619ca9` → `a929e88f` | = | boot |
| 28 | `r9-solve-31` | 336 | 15962 → 15971 | `bf455789` → `4f7ee32a` | = | boot |
| 29 | `r9-solve-30` | 210 | 16318 → 16327 | `3bfc52c7` → `bfe317a4` | = | boot |
| 30 | `r9-solve-32` | 1056 | 16548 → 16557 | `aefe5f5e` → `05457d0f` | = | boot |

Trace: `r9-solve-18` `e2a22824` → **`4c6c711a9919464e33b94f7848b7b524`**. No other trace moved.

**L18 is the hammer room; the F1c/F5 residue rows.** Window 19's own clock is upstream of the move, so its residue
stays **40**. With W1 ON:
- no corner forms there, and the 519 t walk has **no phase stall**;
- the F5 rows (the spinner ledger's v9 spelling, the game-sourced 416) are **unmoved and green**;
- the rebound remainder (residue 18) still refuses with the landing named;
- two F1c rows moved (D3).

The 45-residue sweep (`twoPassSolve` exactly as the test calls it):

| | solved | refused (*"There is no step out."*) | solved by a stall |
|---|---|---|---|
| W1 OFF | 37 | 8 | 4 |
| W1 ON | 35 | 10 | 4 (incl. **42**, 510 t) |

16 residues differ between the two.

**Other planners that name a moved tape** (each `--check` at head, and at a pristine base worktree where the digest
was not already banked):

| planner | head | base |
|---|---|---|
| `plan-seedling-f6-reentry` | exit 0 `e797e8cf` | `e797e8cf` (WATCHERFLIP's bank) |
| `plan-seedling-f7-reentry` | exit 0 `18571df8` | `18571df8` (bank) |
| `plan-seedling-return-l15` | exit 0 `8d7b493a` | `8d7b493a` (bank) |
| `plan-seedling-u15-turret` | exit 0 `17867266` | `17867266` (bank) |
| `plan-seedling-u14-moonrock` | exit 0 `29b73f83` | exit 0 `29b73f83` |
| `plan-seedling-f1c-l18-lock` | exit 0 `d2d46d2c` | exit 0 `d2d46d2c` |
| `plan-seedling-f1c-l18-phase` | exit 0 **`01ec5f9f`** | exit 0 `a560d2b0` |

`plan-seedling-f1c-l18-phase`'s stdout moved by **one diagnostic line**: the stall record printed in a PASS row,
`corner` 249 → 248 and `tried` 448 → 404. Its witness tape is byte-identical to what it plans, and all its checks are
green. It is listed with the census movers.

## D3: the pins + witnesses (PASS; `c7d7232`, `9effa37`)

| row | old pin | measured, W1 ON | why (one line in the file) |
|---|---|---|---|
| `solverSpinnerKill` F2 (5,5) | 241 t | **221 t**, still one press kill, three landings, certified | the hammer's `collideLine` samples untruncated, so a different (cell, tick) prices clear |
| `seedlingCanCross` L22 from L25 → L29, bare | `cannot`, `obstacle: {danger, wallflyer@128,80}`, "EXHAUSTED" | **`cannot`**, `obstacle: null`, *"the re-planned corridor failed too — … waypoint 0 (88,88): not reached within 400 ticks"* | the wallflyer's untruncated ray re-plans the walk |
| `contactFidelity` defaults | W1 OFF | **all three ON** (+13 rows: each witness at the default; #264/#283 0 px) | the shipped default |
| `fidelityF1c` "the committed window IS … the rung's solve" | 510 t with ≥1 stall | **the window IS the solve at 40, key for key, with NO stall**; no hit, crosses to L19 | no corner forms at 40 under W1 |
| `fidelityF1c` (new) | — | **at residue 42 the rung solves by a stall** (bounds as before), no hit, crosses | keeps the rung's positive evidence |
| `fidelityF1c` "the witness walks the committed window's keys" | the witness = the window through `{18,0}@` | **the witness `f1c-l18-phase42` = the rung's solve at its own residue 42, key for key through its declared tick** | the window is no longer the 510 t walk |

The last row is a new GAME agreement for W1: the F1c witness was recorded on the game long before this slice, and
the W1 model plans exactly its keys at its residue. Its replay row (no hit, crosses when the game did) was green
before and after.

**Mutant** (predicted first; copy → `collideLinePointsExact: false` → measure → restore; md5 `2ad23ae3…` before and
after; the tree clean afterwards):
- predicted: the campaign `--check` exit 1 with the five mirror failures (re-plans 510 vs committed 519, sum 10923 vs
  10932, `r9-solve-19`'s oracle 10470 vs 10479); 6 red in the four test files (defaults, #264 and #283 at the
  default, F2, L22, F1c's window row), with F1c's two residue-42 rows green;
- **measured: exactly the five failures, and 6 failed / 90 passed.**

**The game witness of the 221 t spinner kill: not recorded (named).** F2 is a synthetic generated chamber
(`enemy-census-spinner@5,5`), not a room the game ships. Recording it needs the generated-level page path. That is
not cheap at this slice's size, and the F1c witness above already measures the hammer rule on the game.

## D4: records (PASS)

| row | command | W0 | head |
|---|---|---|---|
| identity log | `SEEDLING_PORT=9410 bash scripts/procgen/identity-block.sh .` | `a0ede899…` | **`f327c3275708de92bd4e125534f44749`**. `diff` gives **four rows**: `r9-campaign` `56bb3724` → `a569eeec` (exit 0 both), and the three kind-pair rows (D1) |
| six `--check`s | in the block | above | five unmoved; `r9-campaign` **`a569eeecff6dd6ad04e1e7e8a85d9ccc`** exit 0 |
| reference | `generate-procgen-reference.mjs`, `--check`; `check-procgen-docs` | ALL 7 + 5 MATCH | ALL 7 + 5 MATCH; ALL CHECKS PASSED. Moved: the `campaign-chain` region (10932 t, row 19 519) and the docs index |
| surface / constants / entities / profile | `--check` | 208 / 5,040 / 518 / 138 | **unchanged** (no `--write` needed: no literal moved) |
| tapeRunner | pairs from the bounded run | 533 `71bda323…` | **533 `71bda323…`: identical** |
| roster | index | 238 `5e3d28c4…` | **238 `df76e166…`**. No tape was added or removed, so no roster pin moved |
| bounded vitest AFTER | the same 43 files | 2,250 / 2,250 | **2,264 / 2,264** (+13 `contactFidelity` default rows, +1 F1c residue-42 row) |
| `r8Acceptance` | — | — | **no new exposure**: no tape added; `r9-solve-18`'s row types no tick count |
| prose | `seedling-bot.md` | — | the switches paragraph (all three ON), the F1c rung's residue count (35 under W1), the chain 10,932 |
| bot log | `seedling-bot-log.md` | — | `### Seedling fidelity LINEFLIP — collideLine's samples, untruncated, ON`, two trap candidates |

**Trap candidates** (in the log):
1. **A licence's mover list is a list of what was MEASURED.** TERRAIN never ran the identity block with W1 on, and the census rows it skipped are the ones that moved. Run the whole block with the switch ON (the env hook makes that a no-edit run) before a flip is licensed.
2. **A tape's name in a test is a pin on the tape.** `fidelityF1c` asserted that the committed `r9-solve-18` is a stalled solve. No brief named it. Grep the tests for every re-recorded tape's NAME, not only for the changed functions.

## The JS arc's pins

- **No JS-arc file was edited**: no `jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js` or solver worker. `jsRuntimeDeclarations` is green at both ends.
- No contract changed (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`).
- **What the arc sees:**
  - the page and its worker now run W1 ON (the browser takes the defaults);
  - a live solve through a spinner room, a wallflyer room or a generated post-sword level can plan differently;
  - a pin typed at `r9-solve-18` 510, the chain 10,923, or a later window's `seam.time` now reads 519, 10,932 and +9. None was found in the files measured.

## Deltas

| row | W0 | head |
|---|---|---|
| `collideLinePointsExact` | OFF | **ON** |
| identity log | `a0ede899` | `f327c327` (4 rows) |
| `r9-campaign --check` | `56bb3724` | `a569eeec` (exit 0) |
| chain | 10,923 t | **10,932 t** |
| tapes | — | 12 moved (1 walk, 11 boot-only); 1 expectation; 1 trace |
| index | `5e3d28c4` | `df76e166` (238) |
| bounded vitest | 2,250 | 2,264 |
| tapeRunner, censuses | — | unchanged |

**Sources at the head:** `contactFidelity.js` `2ad23ae30c6985bd077edd95991ba764`.

## What the brief got wrong (measured)

1. **"STOP if anything else moves" vs TERRAIN's mover list.** The list was complete only for what TERRAIN measured. Three identity rows (the kind pairs, procgen's certify solves) and a planner's stdout moved too. One of them changes a generated level.
2. **The movers named "two model-computed unit pins".** A third test file moved: `fidelityF1c` (two rows), because it pins the committed `r9-solve-18` itself. It is re-pinned, with the rung's evidence kept at residue 42.
3. **"seam/rng.cosmetic/tick0 only"** (the pattern of the earlier flips). Here it was narrower: `seam.time` and `tick0` only. No `rng.cosmetic`, `grass_cut` or `music` moved.
4. **`fidelityF5`** (in the W0 list) has no file; F5's rows are in `fidelityF1c.test.js`. **`drill`** has no test file of its own.
5. **"`census-seedling-campaign --check-frontier` (chain/segments/arrivals PASS)"**: true, but the command exits 1 on a pre-existing `sources` row (`AP_1_rules.json`), which is not this slice's.

## Residue

| # | item | owner |
|---|---|---|
| 1 | **The STOP-listed movers: kind pairs c3/c6/c4 (a generated level changes at winding s6), and `plan-seedling-f1c-l18-phase`'s stdout.** Bank the new digests, or decline the flip | coordinator / user |
| 2 | `campaign-frontier.json` not re-derived (by rule); its `sources` row is already stale on `AP_1_rules.json` at the base | coordinator |
| 3 | The full tier owes a CI drive: 12 tapes re-recorded | CI |
| 4 | The 221 t F2 kill has no game witness (a synthetic chamber) | fidelity |
| 5 | Browser gates not run: `check-seedling-wasm-ship`, `plan-seedling-r7-ends-meet`, the route survey | CI / coordinator |
| 6 | L18 at W1 ON refuses 10 of 45 residues (8 before). The chain's 40 solves, but a future clock move into 8/15/22 would refuse | fidelity |

## Byte-inertia

- **Not touched:** `campaign-frontier.json`, any AS3/wasm/gitlink/rules file, the JS arc's files.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered vitest. `git stash` was not used.
- **Mutants:** every mutant was a copy and restore, md5-checked (`contactFidelity.js` `2ad23ae3…`). The census attributions used the env hook (no edit). One scratch test file (`zz_sweep.test.js`, the residue sweep) was created and deleted; the tree was clean after.
- **The scratch base worktree** (`/home/user/wt-base` @ `0fdd9f9`, symlinked `node_modules` and submodules) was removed after use.
- **Scratch, not committed:** the identity logs, vitest JSONs, the pair dumps, the producer/record/differential/tick0 logs and the residue sweep.

## Rows to BANK

- **Identity:**
  - log **`f327c3275708de92bd4e125534f44749`**;
  - `r9-campaign --check` **`a569eeecff6dd6ad04e1e7e8a85d9ccc`** (exit 0);
  - **empty pairs c3 `043e1944a0257a28924f3b4d539c48c7`, c6 `f85e7722f9a1cf0b28858d497cf7813e`, carved pairs c4 `4aa74add00476387bafcd27081fe95e7`** (if the STOP-listed movers are accepted);
  - every other row unmoved (ENEMY census `d59f0c97…`).
- **Chain:** **10,932 t**, 30 windows. The whole-chain differential reads 879 PASS / 0 FAIL.
- **Tapes:**
  - `r9-solve-18` `56033f8bcba35c2728868f6468e67dd2` (519 t), expectation `e8bce7928bec045ae8b9225bd0aeb67d`, trace `4c6c711a9919464e33b94f7848b7b524`;
  - the 11 boot-only tapes as in the D2 table;
  - index **`df76e166414b685b23113394374e9989`**. **Roster 238.**
- **tapeRunner:** 533 `71bda323e8c6a709fecbfd0734ebf945` (unmoved).
- **Censuses:** surface GREEN 208, constants PASS 5,040, entities 518, profile 138 (unmoved).
- **Planner:** `plan-seedling-f1c-l18-phase --check` `01ec5f9f` (exit 0).
- **Bounded vitest:** 43 files, 2,264 / 2,264.
