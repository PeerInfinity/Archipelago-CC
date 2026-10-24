# Seedling HAMMER-PHASE — slice A2: `HAMMER_ESCAPE` ON roster-wide + the licensed re-records

Slice `seedling-hammer-a2` (Opus, cloud), planner `seedling-hammer-phase-planning`.

⚖ **Licensed (user, 2026-10-07): "I approve."** — the flip and the re-records of the movers A measured. Two
rulings during the slice:
- asked *"should we fix the bug before we continue? Will we need to redo this after fixing the bug?"*, the user took
  the fix of the defect the flip exposed (below);
- *"Re-pin all 12"*: the unit pins A's OFF-only list could not see.

| | |
|---|---|
| Start SHA | `9d9aaafe500ed87831ca21bd130c34030bc8d2b5` (main carrying slice A: `87f9f12`…`449765a`, and its roster bank) |
| Head | the commit carrying this report (code/data head `7184cdd`; CI-read bank rows `b6b4007`, `8ccbc26`) |
| Harness branch | `claude/seedling-hammer-a2-90kz90`. Every push went here; nothing went to `main` |
| Dev server | `serve-nocache.py 9490` (`SEEDLING_PORT=9490`); a pristine base worktree `/home/user/wt-base` @ `9d9aaaf` on 9491 |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS (with a fix the user took, and 12 pins the user licensed) · D4 PASS** |

## The one thing to know first

**The flip exposed an older defect, and it is fixed; every re-record stands.**
- With the escape ON, `empty post-sword seed 30` went from a certified level to `GenerationAborted`: *"the player
  DROWNED in level 900"*. A's list did not name it.
- The cause was not the escape. `previewStepper` **throws** the run's death refusal when a *previewed* step dies, and
  the press kill's lookaheads (`stepToward`, `landsClearOfHammers`, under the HAMMER-PHASE rung) did not catch it. One
  previewed key set that drowned threw out of the whole solve.
- `previewOrDeath` (`841629e`) makes a previewed death a key set not taken.
- After the fix, every producer `--check`, both sweeps and every OFF row are unchanged, and seed 30 certifies ON.

**Second: a cost.** With the escape on, a generated killgate room's draws re-roll far more. `seedlingGenCapacity`'s
seed 57 now takes 51 re-rolls in 315 s for the row's rule (off: 3 re-rolls, 7.5 s). It timed out on CI.

**Third, for the JS arc: the live 40–42 gap A measured closes.** At the shipped work budget the worker now ships
the FULL pass at residues 40/41/42 (518/500/503 t, 57–59 units) instead of the dashless 540/532/532.

## W0 — at the base `9d9aaaf`

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | every step OK, `done` (node v22.22.0). ⚠ it prints `done`, not `READY` |
| identity block (OFF) | `SEEDLING_PORT=9491 bash scripts/procgen/identity-block.sh .` in the base worktree | log md5 `dd28b242fd23f89bda5e7235ec6ea0c2`. **Every row equals A's base values**: maze `246dfbce`, acceptance `608693d2`, c3 `043e1944`, c6 `f85e7722`, c4 `4aa74add`, ENEMY `25417923`, guard `a6d18d49`, AREA `02b22525`, killgate `01210c82`/`07ce222a`/`30a1e3e7`, levels `e28c1e5d`/`fb1a59e5`, six `--check`s `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 a569eeec` all exit 0. `generated set` was refused by the box lock (my game recording held it at the time; measured alone at head: OK). Reference: 4 environmental DIFFER rows in the worktree, as A saw |
| identity block (ON) | the same, `SEEDLING_HAMMER_ESCAPE=1` | **row for row A's movers list, nothing else**: acceptance `76602ae8`, c3 `c7857047`, c6 `42ed34d2`, c4 `b9d2185d`, ENEMY `0d3262f6`, killgate `006b0639`/`7d4cb820`/`49e23d85`, l18 `835256bf` exit 1, d2 `04dcbf23` exit 1, r9-campaign `4cdcbacb` exit 1; every other row the base's |
| the movers' `--check`s ON | primary tree, env hook | `r8-solve-18` 363 t; `r8-d2` headline 1669 t (-19 746, -20 560); `r9-solve-18` 518 t, `r9-solve-19`'s free oracle 10478, the chain 10931; F1c witness at 42: 503 t, 0 stalls — A's numbers exactly |
| surface / constants / entities / profile | each `--check` | GREEN 220 · PASS 5,414 · PASS 528 · PASS 138 (A's head) |
| roster | `fixtures/tapes/index.json` | 250 |
| bounded vitest BEFORE | A's 52 files (A's 51 + `hammerEscape`) | **52 files / 2,419 tests, all green**; tapeRunner **557** pairs, md5 `f22d60bd82dc535130ce595eed4a7182` (= A's AFTER) |

## D1 — the flip (PASS, `26191b0`)

- `HAMMER_ESCAPE = { enabled: process.env.SEEDLING_HAMMER_ESCAPE !== '0' }`. The switch and its env hook are kept:
  `=0` or `withHammerEscape(false, fn)` turns it off. The browser has no `process`, so it takes the default (ON).
- The docblock and the `hammer-escape` deadline-site note say so; `hammerEscape.test.js`'s default row reads ON.
- `sweep-seedling-l18-residues.mjs` gains `--no-escape`, and its header prints the switch's actual state.

| measurement | result |
|---|---|
| `sweep --twice` (default ON) | **45/45 solve, 0 hits, every row the same twice, NO residue stalls**; lengths = A's ON table exactly (`462 509 447 491 491 515 447 418 514 440 444 439 440 374 364 449 445 492 445×5 446×3 456 456 379 364 363×7 508 363 495 518 500 503 372 346`) |
| `sweep --twice --no-escape` | **35/45**, the base table exactly (refusing 4 5 6 8 15 18–22; stalls at 9 10 41 42) |
| mutant: the default line back to `=== '1'` (copy + restore, md5 `17048df0` both ends) | predicted 35/45 → **measured 35/45** |

## D2 — the re-records, on the game (PASS)

Each was recorded with `check-seedling-bot-differential --record` (p4f, headless, port 9490), and the model
reproduces each recording it just made. In dependency order:

| producer | window / tape | ticks | `seam.time` | tape md5 | expectation | what moved |
|---|---|---|---|---|---|---|
| `solve-seedling-r8-l18` | `r8-solve-18` | **520 → 363** | 8586 | `f11f437e` → `01b6753c` | `901a87da` → `f91aeda8` | the walk (licensed): 0 hits, 0 spinner contacts, `{18,0}@305` (removal 205 + 100); game `save.time` 8990 = model |
| `solve-seedling-r8-d2-chain` | `r8-d2` (headline) | **1826 → 1669** | 8586 | `8b066bad` → `eb0b3763` | `1fe59312` → `5df2773b` | the walk (its L18 part = the promoted `r8-solve-18`); cuts [363, 1109] |
| | `r8-d2-19` | 746 | 9126 → 8969 | `3c8cf36b` → `b6dc023f` | = `300568c5` | boot: L18's game latch (`seam.time` −157, `rng.seed`), then `tick0` |
| | `r8-d2-20` | 560 | 10042 → 9885 | `d8b0203d` → `f51c7910` | = `d78fd88c` | boot only, as -19 |
| `solve-seedling-r9-campaign` | 19 `r9-solve-18` (residue 40) | **519 → 518** | 9940 | `56033f8b` → `757d388b` | `e8bce792` → `5784e092` | the walk; `{18,0}@467` (removal 367 + 100; was 450) |
| | 20 `r9-solve-19` | 746 | 10479 → 10478 | `5351c55f` → `52ca78bf` | = | boot: `seam.time` −1, the measured `rng.cosmetic`, `tick0` |
| | 21 `r9-solve-20` | 560 | 11395 → 11394 | `7f17810f` → `9946cf3a` | = | boot |
| | 22 `r9-solve-13-v2` | 48 | 12125 → 12124 | `e38c0d09` → `2fd7437d` | = | boot |
| | 23 `r9-solve-0-v3` | 299 | 12193 → 12192 | `17487f30` → `9aebf937` | = | boot |
| | 24 `r9-solve-12` | 2364 | 12963 → 12962 | `ba5b33a9` → `3f0636ed` | = | boot |
| | 25 `r9-solve-21` | 26 | 15267 → 15266 | `f2fcf7a4` → `9a7f2234` | = | boot |
| | 26 `r9-solve-22` | 89 | 15313 → 15312 | `b4bcac5f` → `3cef53f5` | = | boot |
| | 27 `r9-solve-29` | 379 | 15422 → 15421 | `a929e88f` → `fff994f7` | = | boot |
| | 28 `r9-solve-31` | 336 | 15971 → 15970 | `4f7ee32a` → `8852e59c` | = | boot |
| | 29 `r9-solve-30` | 210 | 16327 → 16326 | `bfe317a4` → `716856bb` | = | boot |
| | 30 `r9-solve-32` | 1056 | 16557 → 16556 | `05457d0f` → `941fac83` | = | boot |

Traces: `r8-solve-18` `de4366dd` → `3700b875`, `r8-d2` `b9df8687` → `c5286d81`, `r9-solve-18` `4c6c711a` →
`de05e20c`. Windows 1–18 were not rewritten. Every expectation not licensed to move re-recorded byte-identical. The
walks of `r8-d2-19/-20` and of r9 windows 20–30 are byte-identical; only their boots moved.

- **`derive-seedling-tick0`:**
  - `--check` failed on exactly the boot-only tapes: `r8-d2-19/-20` (delta 178 = 157 + 21) and the 11 r9 windows.
  - `--only=` those wrote them.
  - `--check` then read ALL CHECKS PASSED (log md5 `83b48653`).
- **The two L18 `clears` provenance rows** in `playthroughWalk.js` follow their tapes: `r8-d2` removedAt 320 → 205
  (⇒ 305), `r9-campaign` 350 → 367 (⇒ 467). Without them the differential read 5 FAIL, all of them
  `stagedClearFindings` provenance.
- **Whole-chain differential** (the 30 windows + `r8-solve-18`, `r8-d2`, -19, -20; no `--record`): **995 PASS /
  0 FAIL, 34/34 "live game matches the committed oracle stream"**.
- **Producer `--check`s**, each exit 0:
  - `r8-l18` `33d20889` → **`465a8b46`**
  - `r8-d2-chain` `8e7a43be` → **`b76f6483`**
  - `r9-campaign` `a569eeec` → **`13b8d51f`**
  - `r8-battery`, `r8-tail` and `r9-l3` unmoved
- **Tape index** 250 tapes, `6e6f87d2` → `379f0fd2c0eedfe28afb7e8250998ed0`. No tape was added or removed, so no
  roster pin or name union moved.

## The defect the flip exposed (fixed, `841629e`)

**Found** by D3's row-by-row ON/OFF diff of the pair dumps:
- `empty post-sword seed 30` OFF is a certified level (TARGET_REACHED, 842 → 187 t);
- ON it is `GenerationAborted`: *"the player DROWNED in level 900 at (42.79,62.51)"*.

**The cause, from the throw's stack (not the escape's search):**
- `deathRefusal` is thrown by the preview stepper (`levelRun.js` `previewStepper`, the R3-swim rule: a preview has
  no world to reboot into);
- it escaped through `stepToward`'s `survives` lookahead, under `previewPressApproach` and `hammerPhaseRung`, in
  `execKillByPress`;
- after that site was guarded, it escaped next through `landsClearOfHammers`.

The escape only steered the walk to where one previewed key set drowned in the pass-1 water pool. A first attempt
(pruning lethal floor inside the escape's search only) did not change the abort, which is how the real site was found.

**The fix** (press-kill region only): `previewOrDeath(step)` returns `null` for a previewed death, and each preview
reads it this way:
- `stepToward` skips that key set; `landsClearOfHammers` reads it as not clear;
- `trainIsSafeHere` reads unsafe; `trainLineBlockedHere` reads blocked;
- `pressEscape` refuses an approach or train that dies, and prunes a search state that latched drowning or falls
  into a lethal pit (`lethalFloor`, `previewWalk`'s reading).

Only a solve that threw there can change.

**Measured after the fix:**
- seed 30 ON → TARGET_REACHED (241 → 158 t);
- every producer `--check` digest unchanged: the six, f1c-phase `01ec5f9f`, hammer-a-escape `29891f04`;
- both sweeps identical, row for row;
- every moving identity row at head with the escape OFF equals the base;
- the only rows the fix moved ON are c3 and c6, at seed 30.

**Its regression row** is `hammerEscapeGenerated.slow.test.js`, in the SLOW tier: it runs one whole generation,
260 s under load here. Mutant: `previewOrDeath` passing the throw through makes the generation abort with the same
words (measured before the fix; the row reads exactly that).

## D3 — the rows, and the pins (PASS)

### Identity rows, measured ON at head (each row's own command), against the base

With the switch OFF at head, every one of these rows is byte-identical to the base, so every move is the flag's.

| row | base | head (ON) | what moved | verdict changes |
|---|---|---|---|---|
| acceptance batch | `608693d2` | `76602ae8` | post-sword seed 13's skeleton 711 → 703 t (sword-evidence WITH arm 730 → 715); a Progressive Shield WITHOUT arm 205 → 223 t (the "INERT" note drops) | none |
| empty pairs c3 | `043e1944` | **`4937da80`** (A's pre-fix ON `c7857047`) | 10 post-sword rows, **every one the same level**, ticks only: s7 186→642 ⇒ 186→440, s8 381 ⇒ 298, s13 711→730 ⇒ 703→715, s21 763→204 ⇒ 749→202, s22 367 ⇒ 373, s24 862→170 ⇒ 219→155, s25 380→435 ⇒ 384→436, **s30 842→187 ⇒ 241→158**, s32 400→461 ⇒ 402→479, s33 313→353 ⇒ 329→360 | none (s30 aborted pre-fix) |
| empty pairs c6 | `f85e7722` | **`430573e9`** (pre-fix `42ed34d2`) | the same 10 seeds, same levels, ticks only (s30 842→256 ⇒ 241→228) | none (s30 aborted pre-fix) |
| carved pairs c4 | `4aa74add` | `b9d2185d` | **two DIFFERENT generated levels**: winding post-sword s4 (`2468a277` → `79a65a9b`, SATURATED 42 attempts → TARGET_REACHED 10, 485→536 ⇒ 62→62) and loopy post-sword s8 (`640a1b55` → `f974cf97`, attempts 6 → 18, 62 ⇒ 313); same levels with other ticks: branchy post-sword s4 513 ⇒ 453, bushy post-sword s8 625→597 ⇒ 545→524, open post-sword s4 504 ⇒ 444 | none solved → refused |
| ENEMY census default | `25417923` | `0d3262f6` | the spinner chamber SOLVED 257 ⇒ 226 t; `spinner@nub` SOLVED 317 ⇒ 351 t | none |
| killgate s2 / s5 / s9 | `01210c82` / `07ce222a` / `30a1e3e7` | `006b0639` / `7d4cb820` / `49e23d85` | the printed table is identical; only the unrendered `md5(rows)` moved | none |
| maze, guard, AREA, level pre-/post-sword s1 | — | unmoved | — | — |
| generated set | OK | **OK** (measured alone at head, exit 0) | — | — |

### Banked (box rows, one row per commit, `bank.py`: value, ms, measuredAt, inputKey/keyAt/populations from `standing-values --keys`)

`a393ffb` ENEMY · `62ad8be` killgate s2 · `3e54b40` killgate s5 · `7b7b28f` killgate s9 · `b5cb1b2` `r8-l18 --check`
· `7184cdd` `r8-d2-chain --check`. **CI-read rows** are kept apart, in the section *CI-read rows* below.

### CI-read rows (quoted from CI by SHA, `ci-summary.mjs --run=37708610147`, run at `f6987b0`, conclusion **success**)

| row | bank | CI @ `f6987b0` | box (head) | banked |
|---|---|---|---|---|
| acceptance batch | `608693d2` | **`76602ae8`** exit 0 | `76602ae8` | `b6b4007` |
| `solve-seedling-r9-campaign --check` | `a569eeec` | **`13b8d51f`** exit 0 | `13b8d51f` | `8ccbc26` |
| generated set | OK | OK (and `gate: seedling-generated-set` 32/0) | OK | unmoved |
| `r8-d2-chain --check` | (box row, banked) | `b76f6483` exit 0 | `b76f6483` | = |
| maze | `246dfbce` | `246dfbce` | `246dfbce` | unmoved |
| **empty pairs c3 / c6, carved pairs c4** | `043e1944` / `f85e7722` / `4aa74add` | **MISSING**: this workflow's run carries no line for them | `4937da80` / `430573e9` / `b9d2185d` | **not banked**: they are CI-read rows and CI did not read them here (residue 1) |

### The F1c re-aim (`9fc9640`, `56b5422`)

With the escape ON no residue of `r9-solve-18`'s staging stalls (sweep: 0 stalls in 45). So the rung's positive
evidence is exercised with the escape **OFF by the switch**:
- `plan-seedling-f1c-l18-phase` plans under `withHammerEscape(false)`. The witness tape `f1c-l18-phase42` stays
  byte-identical (no re-record), and `--check` reads exit 0 at the base's `01ec5f9f`.
- `fidelityF1c`'s stall row (residue 42), its rebound-remainder row (18) and its witness-walk row ask the solver via
  `solveOffAt`.
- A new row pins the ON solves beside them: 42 in 503 t and 18 in 445 t, no stall, escapes taken, no hit, the
  crossing.
- Mutant (`solveOffAt` without the switch, md5 `aada1550` both ends): predicted and measured **exactly the three OFF
  rows red, 10 green**.

### The 12 unit pins (⚖ user: "Re-pin all 12"; `26cae08`, `113a568`, `5e89e21`)

CI at the first pushed heads named them. They were red at `56b5422` (pre-fix), and each was measured at head. **Not
one is solved → refused**, and OFF by the switch reproduces every old pin.

| file | row | before → ON | done |
|---|---|---|---|
| `watchOverlays` | `r8-solve-18` landing presses | `[44,113,146,168,231,307]` → `[44,77,110,159,192]` (t110 lands on both bodies); misses before the last kill `[161]` → `[]` | re-pinned (licensed tape) |
| `solverSpinnerKill` | F2 (5,5) / (2,2) / (7,6) / (3,6) / (2,7) / corridor | 221/260/212/173/258/225 → **269/515/210/160/264/193** t | re-pinned; each row also asserts 3 escapes for its 3 landings |
| `procgenCorridorBody` | post-sword certify | 223 → 232 t | re-pinned |
| `procgenScratchPersistence` | the three kill-lock rows | removal 144 → 142, clear 245 → 243, declaredAt 244 → 242 (the arithmetic unchanged) | re-pinned |
| `procgenCountableClock` | hammer-safety classification | (7,2) REFUSED → SOLVED | re-aimed: `withHammerEscape(false)` |
| `watchGenOverlay` | dropped killgate with geometry | seed 64 dropped → certifies (67 and 85 too) | re-aimed: seed 64 with the escape off |
| `seedlingGenCapacity` | killgate re-roll | timed out (60 s) ON: seed 57 51 re-rolls / 315 s (off 3 / 7.5 s); seed 53 48 / 291 s (off 1 / 3.2 s) | re-aimed: seed 57 with the escape off (every candidate seed meets the rule off) |

⚠ **Correction to a statement I made during the slice.** I first reported `seedlingGenCapacity` "now passes" at
head. It had not run at all: the file failed to import because the `bulletml-dodge` submodule was not checked out
here. With that submodule checked out, it timed out ON, as on CI.

## D4 — records (PASS)

| row | result |
|---|---|
| `seedling-bot.md` | the press-kill paragraph (ON by default, the off switch, never onto lethal floor, the re-recorded walks, `previewOrDeath`); the chain sentence (10,931 t; window 19 518 t) |
| `seedling-bot-log.md` | `### Seedling hammer-phase A2 — HAMMER_ESCAPE on + re-records`, two trap candidates |
| `identity-block.sh` header | the "holds NO spinner traffic at all" claim corrected (comment only). **Parser check**: `reachClosure.identityRows()` reads 21 rows, JSON md5 `98cfaebe` before and after; `bash -n` clean |
| reference | regenerated twice (the campaign-chain region, the sweep's `--no-escape`, word counts); `--check` ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED |
| surface | **RED** at head (three site counts: `run:world` 230→231, `fallDestination` 2→3, `PhysicsV2Error` 4→6, all `solverBot.js`) → `--write` → **GREEN 220**, no new row |
| constants / entities / profile | PASS 5,414 · PASS 528 · PASS 138 (unmoved) |
| bounded vitest AFTER | **71 files / 2,979 tests, all green**: A's 52 (2,419 → 2,420, the new `fidelityF1c` row) + every file that names a re-recorded tape or a touched function (`grep -a`: 16 more) + the re-pinned files + `procgenDocs/generated` |
| tapeRunner | **557**, `f22d60bd…`: **identical** to BEFORE |
| `lintGateLabels` | in the bounded set, green |
| slow tier (bounded) | `jsRuntimeSolverCalibration.slow` 5/5 at head and at base; `hammerEscapeGenerated.slow` green |
| CI (unfiltered, read by SHA) | `56b5422`: 19,136 passed / 15 failed (the 12 pins + reference + capacity, all handled above); `7a2ac68`: **19,150 / 1** (the capacity row only, re-aimed in `5e89e21`); **`f6987b0`: the whole "JavaScript Unit Tests" workflow SUCCESS** (run `37708610147`) |

## The JS arc's pins (measured, nothing edited)

- **No JS-arc file was edited.** `jsRuntimeDeclarations`, `jsRuntimeSolver` and `jsRuntimeSolverShouldStop` are
  green.
- **`jsRuntimeSolverCalibration.slow`** reads 5/5 at head, as at base. Its pins do not move with the flag ON.
- **The live L18 path moved** (`measure-seedling-l18-live-gap.mjs`, the worker's own `solveAnytime` on an
  `arrivalSolveRequest`, `SOLVER_BUDGET_WORK` 640, `SOLVER_UPGRADE_WINDOW_WORK` 85):

  | residue | OFF (= A's D3) | ON (the default) |
  |---|---|---|
  | 40 | shipped **540 t (dashless)**; full refused at 65 u (`walk`/window); unbudgeted 519 | shipped **518 t (full)**; dashless 582 w24, full 518 w35, work 59 |
  | 41 | shipped **532 (dashless)**; full refused at 66 u (`sword-dash`) | shipped **500 (full)**; full w34, work 57 |
  | 42 | shipped **532 (dashless)**; full refused at 66 u | shipped **503 (full)**; full w34, work 57 |

  The escape makes the full pass cheaper (the rung's stall search no longer runs), so it fits the upgrade window.
  **A's live 40–42 gap closes.** The dashless pass is longer ON (582/555/559), but it is no longer the plan shipped.
- **What the JS arc must re-pin:** anything typed at the shipped live L18 plan (540/532/532 → 518/500/503) or at its
  work units. None was found in the files measured. The `hammer-escape` deadline site is asked in every live solve
  now.

## Deltas

| row | base | head |
|---|---|---|
| `HAMMER_ESCAPE` default | OFF | **ON** |
| sweep | 35/45 | **45/45** (`--no-escape` 35/45) |
| chain | 10,932 t | **10,931 t** |
| `r8-d2` headline | 1,826 t | **1,669 t** |
| tapes | — | 16 rewritten (3 walks: `r8-solve-18`, `r8-d2`, `r9-solve-18`; 13 boot-only); 3 expectations; 3 traces; index `379f0fd2` (250) |
| producer `--check`s | `33d20889` / `8e7a43be` / `a569eeec` | `465a8b46` / `b76f6483` / `13b8d51f` |
| identity rows | (W0) | 9 moved (table above); maze/guard/AREA/levels/generated set unmoved |
| surface | GREEN 220 | GREEN 220 (three site counts) |
| bounded vitest | 52 / 2,419 | 71 / 2,979 |
| code | — | `solverBot.js`: the default, `previewOrDeath`, `lethalFloor`; the sweep's `--no-escape`; `playthroughWalk.js`'s two clears rows |

## What the brief got wrong (measured)

1. **"STOP if anything else moves … A measured the movers".** A's list was what A measured with the flag ON: the
   identity block and the producers. It did not include **the unit tests** run with the flag ON. CI at the first
   pushed head read 15 red rows the list did not name (12 pins, the reference, a capacity timeout). The user
   licensed them (*"Re-pin all 12"*).
2. **"empty pairs c3/c6 … measured ON, banked as the new rows"**: A's ON digests (`c7857047`/`42ed34d2`) contained
   a **solved → aborted** row (seed 30, a preview's drown thrown out of the solve). They were not bankable as
   measured. After the fix (which the user took) they are `4937da80`/`430573e9`.
3. **"each producer's `--check` digest" and "the generated rows"** were the whole cost picture. They were not:
   the flip makes generated killgate rooms **~40× slower** to seat (`seedlingGenCapacity`, measured above).
4. **`session_bootstrap.sh --seedling` → `READY`**: it prints `done`, and there is no `READY` line.
5. **The identity block's `generated set` row in a worktree**: it needs the wasm submodule's git identity. Copied
   submodule `.git` files break it, and the gate scripts too (`fatal: not a git repository`). Pointing them at the
   primary's gitdirs fixes it.
6. `standing-values --check` shows two producers moved that A's list does not name:
   `plan-seedling-r9-l0-sword-dash` and `plan-seedling-r9-l6-sword-dash-hit`. **Both are pre-existing**: base, head
   OFF and head ON give `e06b988e` / `57fbc418`. The bank simply predates the base.

## Residue

| # | item | owner |
|---|---|---|
| 1 | **c3 / c6 / c4 are not banked**: they are CI-read rows and run `37708610147` carries no line for them. Box values at head: c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d` (OFF at head = the base). Quote them from whichever workflow reads them, then bank | coordinator |
| 2 | **The killgate re-roll cost** (51 re-rolls / 315 s for seed 57's rule): the escape's search runs in every draw's certify solve. A budget or a cheaper first escape is B's question | hammer-phase B |
| 3 | `standing-values --check`: browser gates that read FAIL here and **identically at the base**, so they are environmental or pre-existing and not this slice's. `seedling-editor-refusal` (15/5, the page solves) and `seedling-editor-phases` (90/1, no dropped killgate in seeds 1..20) read the same **on main's CI at the base** (run `37688048268`) and on this branch's CI; their banked 20/0 and 94/0 are stale. `procgen-lab-hosting` passes on CI (78/0) and fails here only for missing JtA/omsi/bulletml frames. The `runner-*`/`jta-*`/`bounce-*`/`sphere-*` rows fail on submodules this clone does not have. The 52 "NEW row nothing has measured" lines are rows the bank never had | coordinator |
| 4 | The full tier owes a CI drive: 16 tapes re-recorded (`seedling-full-tier-owed` reads 2/0/1) | CI |
| 5 | `(2,2)`'s chamber solve is **twice as long** ON (260 → 515 t). It still solves, but a longer walk is worth a look | hammer-phase B |
| 6 | The parallel fidelity arc banks the same generated rows: this slice's moved rows and their before digests are named in each `chore(bank)` commit, for a union at rebase | coordinator |

## Byte-inertia

- **Not touched:** AS3, wasm, any gitlink, rules, `campaign-frontier.json`, the JS arc's files.
- **Not run:** `standing-values --write` (the bank rows were edited one by one from measured values, as main's bank
  commits are), `pytest`, the unfiltered local vitest (⚖ 52; the suite figures above are CI's, read by SHA).
  `git stash` was not used.
- **Mutants:** every mutant was copy + restore, md5-checked (`solverBot.js` `17048df0`, `fidelityF1c.test.js`
  `aada1550`).
- **Scratch files:** one throwaway test (`zz_capseeds.test.js`) was created and deleted and never committed.
- **Submodules:** `bulletml-dodge` was checked out in the primary at its pinned commit; the gitlink is unchanged.
- **The base worktree** `/home/user/wt-base` (copied submodules repointed at the primary's gitdirs) is scratch and
  not committed.

## Rows to BANK

- **Identity:**
  - acceptance `76602ae80b1671b9630cd62e57ec44db`
  - empty pairs c3 `4937da80…`, c6 `430573e9…`
  - carved pairs c4 `b9d2185d33c68dc2d3efcd8feb089272`
  - ENEMY `0d3262f61a8894461fde87555213686f` (banked)
  - killgate s2 `006b0639…`, s5 `7d4cb820…`, s9 `49e23d85…` (banked)
  - every other row unmoved
- **Producers:**
  - `r8-l18 --check` `465a8b469896813dc7efc8c1ce3937d2` (banked)
  - `r8-d2-chain --check` `b76f648331c7a56e8fc11f89d5a4daf8` (banked)
  - `r9-campaign --check` `13b8d51f4479cd12f939eb560f137337`
  - `plan-seedling-f1c-l18-phase --check` `01ec5f9f` (unmoved)
  - `plan-seedling-hammer-a-escape --check` `29891f04` (unmoved)
- **Chain:** 10,931 t over 30 windows; the whole-chain differential reads 995 PASS / 0 FAIL.
- **Tapes:** the D2 table; index `379f0fd2c0eedfe28afb7e8250998ed0`; roster 250.
- **Sweep:** ON 45/45 (0 hits, 0 stalls); `--no-escape` 35/45.
- **Censuses:** surface GREEN 220, constants PASS 5,414, entities 528, profile 138.
- **Bounded vitest:** 71 / 2,979; tapeRunner 557 `f22d60bd…`.
