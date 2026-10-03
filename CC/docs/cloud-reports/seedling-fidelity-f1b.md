# Seedling fidelity F1b: the kill-lock ledger reads the removal · the campaign chain STOPS at window 19 (L18's hammer phase)

**Slice:** `seedling-fidelity-f1b`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning`), built on F1's head. ⚖ The user, 2026-10-02: *"F1b: ledger, then re-record chain."* I did not edit any JS-arc file (`jsRuntime*.js`, `flashPanel/*`, `wasmArrival.js`, the solver worker, `solveSegment`'s `prefix` admission), any AS3, the wasm or a gitlink. I stayed out of F2's regions (`solverBot.js`'s goal kinds, `levelWorld.js`'s persistence table). In `solverBot.js` I changed one declared VALUE: the chaser kill-lock pending row's `at`/`fade`. No signature or contract moved.

| | |
|---|---|
| Started from | `origin/fidelity-harvest/f1` @ `f057040fe6` (F1 rebased onto main `d6069d7de6`) |
| Head | this report's commit, on top of `352d8ce` |
| Harness branch | `claude/seedling-fidelity-f1b-y5k4ak` (the harness pins it, not `seedling-fidelity-f1b`) |
| Commits | D1 `bd34fde` · D3 records `352d8ce` · this report. **D2 has no commit (STOP)** |
| Dev server | `scripts/serve-nocache.py 9130` (`SEEDLING_PORT=9130`, build `seedling_bot_ap_p4e`, headless logic-only). The worker restarted once mid-session; the server was restarted on the same port, and no committed artifact was produced across the restart |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Identity log md5 **`9bba1d87…`** = F1's AFTER, byte for byte. The six `--check`s are `410f27c0 7cba9530 cef8048e dfa702ca 6cd35fe1 83997b2c (exit 1)`, = the brief. tapeRunner 453/453; roster 198; bounded vitest 16 files / 1,152, 2 expected reds. |
| D1 | **PASS (fixed, game-witnessed)** | Every chaser death now ledgers at the **removal** (one rule with R2's terrain arm), and the solver declares `removal + opensOnTick(0.01) − 1` (the v9 `at` spelling). On `f1-l5-lock-removal`: ledger **201** (was 166), the model's own clear **301** = the game's, crossing **t303** = the game's. Mutants: 4/4 and 1/1 red, as predicted. Census: 194/198 tapes identical, and no committed replay moves. |
| D2 | **STOP at window 19 (`r9-solve-18`, L18)** | Window 5 re-solves to **403 t `@301`** (predicted exactly). Windows 6–18 re-solve to their committed lengths from the new game latches. L18's spinner hammer rides on `Game.time`; the chain clock is 155 ticks earlier, so the phase residue goes 17 → 42 (period 45). At residue 42 the press kill refuses `HAMMER_SAFETY`. Nothing was written. |
| D3 | **PASS for what landed** | Identity log: two lines differ from W0, both window 5's re-solve. r8-tail `dfa702ca → 55659207` (exit 0); r9-campaign `83997b2c → 4fc7f4e3` (**still exit 1**). tapeRunner pairs md5-identical. Surface GREEN 191, constants PASS 4,947, reference ALL 7 + 5 MATCH. Bounded vitest 40 files / 2,232, the same 2 explained reds. |

**The one thing to know first.** The ledger is fixed, but **the chain cannot be re-recorded by the producer as it stands, so `solve-seedling-r9-campaign --check` is still red at this head** (exit 1, window 5: 403 t `@301` against the committed 558 `@427`). The cascade from window 5 is not boot-only. L18's spinner hammer phase is `Game.time mod 45`, and any change to the chain's total length before L18 moves that phase. At this chain's new phase (residue 42) the solver's press kill has no safe step. Over all 45 residues, the committed staging refuses at 12 and solves at 33, with 25 different walks. So making F1 + F1b mergeable green needs one of:
- (a) the solver's L18 press kill made phase-robust (a solver slice; `solverBot.js` is shared);
- (b) the user licensing a chain that changes its own L18 strategy;
- (c) the coordinator merging with the r9-campaign `--check` red and named.

That decision is the user's.

## W0 (at `f057040`, the clean tree, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9130 bash scripts/procgen/identity-block.sh .` (venv active) | maze `246dfbce…` · acceptance `e417212b…` · c3 `fce3ad42…` · c6 `8e59dec8…` · c4 `b11d9564…` · ENEMY `a20bcbe8…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK · reference ALL 7 + 5 MATCH. Log md5 **`9bba1d879c314971ecbfed85c19173dd`**, = F1's AFTER log md5 |
| six `--check`s | the block's producer loop | `410f27c0 7cba9530 cef8048e dfa702ca 6cd35fe1`, exit 0; **`83997b2c` exit 1**: reproduces F1 |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json` | **453/453**; (fullName, status) pairs md5 `c7047baf…` |
| roster | `fixtures/tapes/index.json` | **198** |
| bounded vitest BEFORE | `fidelityF1`, `levelRun`, `twoPassSolve`, `solverBot`, `botDriverV2`, `tapeRunner`, `playthroughAcceptance`, `campaignChain`, `rerecordCampaign`, `r8Acceptance`, `jsRuntimeDeclarations` (read-only), `rosterCategories`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `r2Singles` | **16 files / 1,152: 1,150 green, 2 red, both expected.** `rosterCategories` "the LIVE row …" (`expected 136 to be 138`, the bank row), and `jsRuntimeDeclarations.test.js:152` (`expected 1 to be +0`) |

**The blast radius of D1** (`rg -an "chaserKillLockOpens|assertChaserRemovalIsDeclared|opensOnTick" frontend scripts`):
- **Producers of the ledger:** `levelRun.js` (`stageChaserKill`, the terrain/pit `removalLedger` arms, `assertChaserRemovalIsDeclared`, `killLockClearTick`, the scratch `declaredAt`).
- **Readers:** `solverBot.js` (`execKillByCeiling`'s pending row, the only reader of `chaserKillLockOpens`); `fidelityF1.test.js`; `levelRun.test.js` (two shape rows); `solverBot.test.js` (`fade` 101 pin); `twoPassSolve.test.js` (`fade: 101` pin); `plan-seedling-f1-l5-lock.mjs`.
- **Labels:** `r8Acceptance.js` (`R8_TWO_PASS.tickSources.model.oracle`); `twoPassSolve.js`; `solve-seedling-r8-tail.mjs`; `playthroughWalk.js:~940-968` and `~1262` (the `{5,0}` evidence rows).
- **Committed tape notes:** `r8-solve-5` (`removal at 326`, `@427`), `r2-terrain-killlock`.
- **The spinner arm** (`spinnerKillLockOpens`, `solverBot.js:~7575-7710`) shares `opensOnTick` and the pending shape, but **not** the ledger: untouched, see residue 2.

## D1: the kill-lock ledger reads the REMOVAL (`bd34fde`)

**The rule.** `Lock.update` runs `checkEnemies()`, which activates when `totalEnemies() == 0`. `totalEnemies()` is `classCount(Bob) + …`, which drops only at `FP.world.remove`. Then `activationStep` subtracts 0.01 a tick and `turnOff()` writes `{tag}` on the step after alpha reaches 0 (`Lock.as:64-97`; `opensOnTick(0.01)` = 101). Changes:
- `stageChaserKill` (arrow, press, shield and suit kills) no longer runs the ledger at the kill. It sets `c.removalLedger = cause`, the latch R2-swim D3(c) gave water, lava and pit deaths, and the removal branch runs `assertChaserRemovalIsDeclared` when `c.removed` is set. **One rule for every chaser death.**
- `assertChaserRemovalIsDeclared`'s `bodiesAfter` counts only `removed` bodies as gone. It used to count `dying`/`destroy` too, because it ran at the kill. At the removal that would open a lock while another body is still fading, which `totalEnemies()` does not do. Its comment, which defended the old reading as "the lock opening 35 ticks early" if collapsed, is rewritten.
- `execKillByCeiling` declares `at = removal + opensOnTick − 1`, with `fade` = 100 in the pending row and the evidence (`removedAt + fade === at` keeps its shape).

**The fenceposts, derived and then witnessed.** The ledger stamps the removal `ticksCompleted + 1`. A pending scratch row (removal-record convention) fires when `ticksCompleted + 1 >= removal + 101`, and a declared v9 row fires when `ticksCompleted === at`. These are the same advance when `at = removal + 100`, which is the scratch layer's existing `declaredAt: p.at - 1`. F1's "100 on the removal side vs 101 on the kill side" was this spelling difference, not two physics. **The witness settled it:**

| `{5,0}` on `f1-l5-lock-removal` | model crossing | game |
|---|---|---|
| declared **301** (= removal 201 + 100) | **t303** | **t303** |
| declared 302 (= removal + 101) | t304 | t303 |
| the scratch layer, declaration removed | computes `[5,0,201,301]`, crosses **t303** | t303 |
| (F1's kill reading: 166 + 101 = 267, scratch 266) | t268 | t303 |

`r2-terrain-killlock` agrees: removal 183, `@283`, t285 = the game (its planner's `--check` is green, and so is `r2Singles`).

**The labels say what they mean.**
- The solver's `why`: *"`chaserKillLockOpens` computed the removal (the last body leaves the world) at 201, and `activators.opensOnTick(0.01)` is 101, which a declared v9 row spells 100"*.
- The `PendingDeclaration` message: *"… in the v9 `at` spelling: 201 + 100 = 301"*.
- `R8_TWO_PASS.tickSources.model.oracle`, the `twoPassSolve.js` header and r8-tail's segment-5 row text are updated the same way.

`grep -a` of the test tree for the changed words: the only pin is `playthroughAcceptance.test.js`'s *"326 plus the responder's 101-step fade"*. That is the `r8-solve-5` evidence row, which moves only with D2 (unchanged here, and green).

**The witness rows** (`fidelityF1b.test.js`, 4 rows, every tick and count derived from the witness tape and expectation):
1. The ledger's tick is the last body's removal, after its kill, and removal + the v9 fade = the game's `at`.
2. With the declaration removed, the scratch layer computes the game's `at` and crosses on the game's transition.
3. The solver, from `r8-solve-5`'s staging, raises `PendingDeclaration` with `at` = the game's 301, `fade` = `opensOnTick − 1`, and the new `why`.
4. One tick later crosses one tick late.

`fidelityF1.test.js`'s kills row now reads the kills from `chaserKills` (t124, t127, t166) and the ledger at 201. `solverBot.test.js` and `twoPassSolve.test.js` pin `fade` = `opensOnTick − 1` / 100. `plan-seedling-f1-l5-lock.mjs` gains the row *"the kill-lock ledger reads that body's REMOVAL"*; its tape is byte-identical (`--check` green), and its description, F1's record, is unchanged.

**Mutants** (predicted first, copy + restore):
- **m1**, the kill-tick reading restored (`assertChaserRemovalIsDeclared` back in `stageChaserKill`). Predicted: F1b rows 1–3 and F1's kills row red, F1b row 4 green. **Measured exactly that, 4 red.** Restored md5-identical (`9b01d231…`).
- **m2**, the solver declares `removal + opensOnTick` (no v9 spelling). Predicted: F1b row 3 only. **Measured: 1 red.** Restored md5-identical (`97f62d38…`).

**The census of moved declarations.** I replayed all 198 committed tapes before (`f057040`, a scratch worktree) and after, each as committed and again under the scratch layer with its timed rows removed. **194 identical; 4 move, all in L5, each the ledger tick +35**:

| tape | ledger before → after | scratch-computed clear before → after | committed declaration | committed replay |
|---|---|---|---|---|
| `r8-solve-5` | 166 → **201** | 266 → **301** | `@427` (model value, F1's residue 2) | identical (crosses t558) |
| `r7-act2-5` | 166 → **201** | 266 → **301** | `@737` (a phases-block upper bound) | identical (t812) |
| `r7-act2-full` | 988 → **1023** | 1088 → **1123** | `@1559` | identical |
| `f1-l5-lock-removal` | 166 → **201** | 266 → **301** | `@301` (game) | identical (t303) |

`r2-terrain-killlock` and `r8-solve-4` are identical. No committed replay's transitions move, so tapeRunner's 453 pairs are md5-identical. No room outside the chain needed a re-record. `r7-act2-5` and `r7-act2-full` are hand tapes with no producer `--check` (r8-tail only compares against them), and their tapeRunner rows are green.

## D2: the chain from window 5 — STOP at window 19

**Prediction (before the run):** window 5 = 403 t, `{5,0}@301`; window 6's `seam.time` 6,187 → 6,032, and the three RNG streams follow the new latch; every later walk unchanged (the model transports the RNG streams, it does not simulate them); chain 10,880 t over 30 windows.

**Measured** (`SEEDLING_PORT=9130 node scripts/procgen/solve-seedling-r9-campaign.mjs`, headless; the latch cache was empty, so every window was driven fresh on the game):

| # | window | committed | re-solved from the new latch | game latch |
|---|---|---|---|---|
| 5 | `r8-solve-5` | 558 t `@427` | **403 t `@301`** (pass 1 discovers at the removal 201) | calm, 404 obs |
| 6–18 | `r8-solve-6` … `r9-solve-16` | 294 · 146 · 827 · 122 · 83 · 97 · 152 · 23 · 145 · 36 · 118 · 456 · 625 | **the same lengths**, every one | each calm |
| **19** | **`r9-solve-18`** (L18, spinners) | 455 t `{18,0}@418` | **REFUSED**, see below | — |
| 20–30 | `r9-solve-19` … `r9-solve-32` | — | not reached | — |

The refusal: *"solverBot(r9-solve-18) reach-exit (176,112)->L19 -> kill: every key set — the plan's own and 5 alternative(s) — lands the player box on a body's 7x7 rect or on the 13 px hammer line at that tick's own phase, on the next tick, at (140.47,52.24) in level 18. There is no step out."* (`code: 'HAMMER_SAFETY'`, from `execKillByPress` → `safeStep`).

**Attribution.**
- `spinner.hammerLine(s, gameTime)` is `(gameTime % 45) / 45 · 2π`, and `hammerHitsPlayer` throws without a clock. So L18's solve reads the boot's `seam.time`.
- Window 18's new game latch reads `save.time` 9,918, which makes the declared L18 clock 155 lower than the committed 10,052. Residue 17 becomes residue 42.
- **Reproduced in the model from the committed staging by moving the clock alone:** δ 0 solves 455 t `@418`, and δ −155 refuses `HAMMER_SAFETY` (no RNG or other boot field changed).

**The sweep** (the committed `r9-solve-18` staging, `seam.time + δ` for δ = −44 … 0, through `twoPassSolve` as the producer calls it):

| residue | verdict |
|---|---|
| 16, 17 | 455 t `@418` (the committed walk) |
| 4 5 6 · 9 10 · 18 19 20 21 · 40 41 42 | **REFUSED** `HAMMER_SAFETY` (12 of 45) |
| the other 31 | solve in 414–540 t, `{18,0}` from `@343` to `@494`: 25 distinct (length, declaration) pairs across the 33 that solve |

So the cascade is not boot-only at L18 for almost any shift. Even at a solvable residue, window 19's walk would move (a `walk-moves` verdict, which re-times every window after it again). At this chain's residue the window does not solve at all. **Per the brief, STOP at that window; nothing hand-authored.**

**What was written: nothing.** The producer emits after its loop, and it died at window 19. `git status` was clean afterwards, and no tape, trace, `campaign-frontier.json`, `playthroughWalk.js` evidence row or `r8-tail` output moved. The latch cache (`/mnt/c/playwright/latch-*.json`, 15 files) now holds windows 4–18's game latches for the new chain, keyed on their bytes, for a later slice to reuse.

**L5's other tapes:**

| tape | own gate at head | what it reads | re-recorded? |
|---|---|---|---|
| `r7-act2-5` | tapeRunner rows green; hand tape, no producer `--check` | ledger 201, scratch 301, committed `@737`, crosses t812 | no |
| `r7-act2-full` | tapeRunner rows green; hand tape | ledger 1023, scratch 1123, committed `@1559` | no |
| `r2-terrain-killlock` | `plan-seedling-r2-singles --check` ALL CHECKS PASSED; `r2Singles` green | unchanged: removal 183, `@283`, t285 | no |
| `r8-solve-4` | battery `--check` `410f27c0` unchanged | no L5 kill lock in its walk; identical | no |

## `jsRuntimeDeclarations.test.js:152` at this head

It still reads **`declines` 1** (expected 0). This is the same decline as F1, and D1 does not change it. Measured with a temporary uncommitted copy of the file:

```
declines 1 · solves 1 · refutations 0 · crossings [{from: 5, to: 6}]
lastDecline: "solverBot(js-runtime-L5-exit) reach-exit (48,112)->L6 -> kill -> dwell (bob@48,80):
  the dwell's condition (bob@48,80 stands inside arrowtrap@64,48's lane …) never became true
  inside its 100-tick bound …"
scratch: [{level 5, tag 0, removedAt 285, at 386, declaredAt 385, by bob@16,80, cause "an arrow kill"}]
openedAt 386   (F1: the lock opened at t351 = the kill + 101; now the removal 285 + 101)
```

With that one line changed to `expect(s.declines).toBe(1)`, the whole file reads **6/6 green**: `openedAt === scratch[0].at`, the crossing, and the shadow digest all hold.

**The pin the JS arc should carry:** `expect(s.declines).toBe(1)`. The reason: with game-exact bodies (F1 D1), the first attempt's kill-lock DWELL for `bob@48,80` never sees the body enter `arrowtrap@64,48`'s lane inside its derived 100-tick bound, and the S2 retry solves and crosses. The lock now opens at the removal (t386 on this run), and the row's own `openedAt === scratch[0].at` already holds that. (Alternative: re-derive the dwell's bait against the real bodies, which is a solver change, not a pin.)

## Deltas

| Row | W0 (`f057040`) | head | movers |
|---|---|---|---|
| identity log | md5 `9bba1d87…` | md5 **`b381ec1a1695b5cf6a728068053d2471`** | two lines (below); every census, pair, killgate, level, generated-set and reference row identical |
| `solve-seedling-r8-tail --check` | `dfa702ca…` exit 0 | **`55659207cfc3f040878e29902854a4ca`** exit 0 | full-output diff = window 5 only: pass 1 at 166 → **201**, pass 2 `@267` → **`@301`** with the new `why`, the prefix row, the two PASS rows' `{5,0}@…`, and the summary row `declared {5,0}@301`. 403 t unchanged |
| `solve-seedling-r9-campaign --check` | `83997b2c…` **exit 1** | **`4fc7f4e3aaebaf4f54fbf8ec5a3a535c` exit 1** | full-output diff = the same three window-5 lines (pass 1 / pass 2 / prefix); its 5 failures are F1's (403 vs 558, the window-6 `seam.time` oracle) |
| the other four `--check`s | `410f27c0 7cba9530 cef8048e 6cd35fe1` | **identical** | |
| tapeRunner | 453 (pairs `c7047baf…`) | **453, md5-identical** | none |
| tape index / roster | 198 | **198** | no tape added or moved |
| solver surface | GREEN 191 | **GREEN 191** (`--write` then `--check`) | line numbers only |
| constants | PASS 4,947 | **PASS 4,947** (`--profile-rows` → `--write` → `--check`) | 222 rows moved by line shifts; 0 new, 0 vanished |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH**; `check-procgen-docs` ALL CHECKS PASSED | docs index (the log entry's words); instruments 319 |
| bounded vitest | 16 / 1,152 (2 red) | **40 files / 2,232: 2,230 green, 2 red** (the same two) | + `fidelityF1b` (4), plus `procgenScratchPersistence`, `watchManual`, `chasers`, `enemyDamage`, `activators`, `jsRuntimeSolver`, `solverEncounter`, `r5SwimCloseout`, `procgenOracle`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `spinnerClockPairing`, `solverSpinnerKill` and every `procgenDocs/` test |

`lintGateLabels` is green: the new test titles carry no typed count, and their ticks are derived from the witness tape.

## What the brief got wrong (measured)

1. **"Re-record the campaign chain from window 5 onward … pre-licensed."** The cascade does not stay boot-only. Windows 6–18 re-solve identically, but L18 reads `Game.time` for its hammer phase. A 155-tick shift before it puts the solve at a residue where the press kill refuses. Only 2 of the 45 residues reproduce the committed walk.
2. **"F1 found 100 on the removal side against 101 on the kill side; settle which."** Both are the same `opensOnTick` = 101, spelled in two conventions: a pending row (`ticksCompleted + 1 >= at`) and a declared v9 row (`ticksCompleted === at`). The kill side was wrong twice: the kill instead of the removal, and the pending spelling written into a declared row. The witness confirms removal + 100 in the v9 spelling.
3. **"Mirror R2's terrain-death fix."** That alone is not enough. The ledger's `bodiesAfter` counted `dying`/`destroy` bodies as gone, which is right only at the kill. At the removal it must count `removed` only, or a second fading body would open the lock early.
4. **"`twoPassSolve` declares t + 101."** The arithmetic lives in `solverBot.execKillByCeiling`'s pending row. `twoPassSolve` copies `pending.at` verbatim.
5. **"Any other room whose declared clear MOVES."** No committed declaration moved. D1 moves the model's COMPUTED clear on four L5 tapes, and their committed declarations are untouched (they are the declarations, not the ledger).
6. **Window count.** L18 is window **19** of 30, after window 18 (`r9-solve-16`).

## Residue

| # | item | site |
|---|---|---|
| 1 | **The chain is not re-recorded; `solve-seedling-r9-campaign --check` exits 1** (window 5 403 t `@301` vs committed 558 `@427`; window 6's `seam.time` oracle). Blocked at window 19 by L18's hammer phase (`HAMMER_SAFETY` at residue 42; 12/45 residues refuse). Needs a ruling: a phase-robust L18 press kill (solver), a licence for L18's walk to move, or merging red. | `solverBot.js` `execKillByPress`/`safeStep`; `scripts/procgen/solve-seedling-r9-campaign.mjs` |
| 2 | **The spinner arm declares `removal + 101`** (`r8-d2`/`r8-solve-18`/`r9-solve-18`: removal 321/317 → `@422`/`@418`). Its own scratch layer spells the same moment `removal + 100`. Unwitnessed on the game for spinners; the walks arrive late, so no replay sees it. Not changed: it would move three committed tapes, one a chain window. | `solverBot.js:~7700` (`at: last.t + fade`) |
| 3 | **`r8-solve-5` `{5,0}@427` and `playthroughWalk.js`'s `removedAt: 326, fade: 101` rows** are still model values the game refutes. They move with the chain re-record, so they wait on residue 1. | `fixtures/tapes/r8-solve-5.json`; `playthroughWalk.js:~953-967`, `~1262` |
| 4 | **`jsRuntimeDeclarations.test.js:152`** reads `declines` 1. It is the JS arc's file and was not edited; the pin and its reason are above. | the JS arc |
| 5 | **The composite roster row** (`rosterCategories.test.js:175`, `expected 136 to be 138`) is F1's, unchanged; it moves only with `standing-values --write`. | the coordinator's bank |
| 6 | **The latch cache** for the new chain's windows 4–18 lives in this container's `/mnt/c/playwright` and dies with it. | — |

## Byte-inertia

| Artifact | W0 (`f057040`) | head |
|---|---|---|
| identity log | `9bba1d879c314971ecbfed85c19173dd` | `b381ec1a1695b5cf6a728068053d2471`: **identical except the r8-tail and r9-campaign `--check` lines**, both window 5's re-solve |
| six `--check`s | `410f27c0 7cba9530 cef8048e dfa702ca 6cd35fe1 83997b2c(1)` | `410f27c0 7cba9530 cef8048e` **`55659207`** `6cd35fe1` **`4fc7f4e3`(1)** |
| tapeRunner pairs | `c7047baf…` (453) | **`c7047baf…`** (453) |
| model census, 198 tapes (ledger, scratch clears, transitions) | — | **194 identical**; 4 L5 tapes move their ledger tick by +35 and no replay moves |
| `fixtures/**` | — | **untouched**: no tape, trace, expectation, index or `campaign-frontier.json` moved |

Untouched or not run: AS3, wasm, gitlinks, every fixture, biome defaults, `campaign-frontier.json`, `standing-values --write`, `pytest`, the unfiltered vitest, the JS arc's files (`jsRuntimeDeclarations.test.js` was probed through temporary uncommitted copies, both deleted), F2's regions.

**Scratch** (`/tmp/claude-0/f1b/`, not committed): the 198-tape census (`census.mjs`, before/after JSON), the L18 clock sweep (`sweep.mjs`, two logs), the producer's run log (`d2-produce.log`), the full `--check` outputs at W0 and head, and both vitest JSONs.

## Rows the coordinator must BANK

**CI-read** (not measured here; ⚖ 52):
- the unfiltered vitest at the pushed SHA (`node scripts/procgen/ci-vitest-summary.mjs <sha>`), which will show residues 4 and 5 red;
- the differential's full tier is unaffected (no tape moved).

**Box rows:**
- identity log md5 **`b381ec1a1695b5cf6a728068053d2471`**, valid only while residue 1 stands (a chain re-record moves it again);
- `solve-seedling-r8-tail --check` **`55659207cfc3f040878e29902854a4ca`** (exit 0);
- `solve-seedling-r9-campaign --check` **`4fc7f4e3aaebaf4f54fbf8ec5a3a535c` exit 1**: NOT bankable as green. It is the STOP;
- tapeRunner **453** (pairs `c7047baf…`); roster **198**; surface **191**; constants **4,947**; instruments **319**;
- new test file `fidelityF1b.test.js` (4 rows).
