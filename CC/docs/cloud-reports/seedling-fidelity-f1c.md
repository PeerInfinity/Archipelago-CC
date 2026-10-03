# Seedling fidelity F1c: the press kill survives any hammer phase · L18's kill lock asked of the game (STOP at the fix) · the campaign chain re-recorded from window 5

**Slice:** `seedling-fidelity-f1c`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning`), built on F1 + F1b. ⚖ The user, 2026-10-03: *"F1c: phase-robust L18 kill, then re-record."* The chain re-record from window 5 was pre-licensed (2026-10-02).

What I did not touch:
- any JS-arc file (`jsRuntime*.js`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the solver worker, `solveSegment`'s `prefix` admission);
- F2's regions (`resolveCollectStrategy`, `apItemTakenOnTick`, the `run.advance` observer, `world.apItems`, `PERSISTENCE_RESPONSE`);
- any AS3, the wasm, or a gitlink.

In `solverBot.js` the new code is a rung inside the press-kill path. `safeStep`'s landing test is lifted into a function of its own, and its behaviour is unchanged. No signature or contract of `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging` moved.

| | |
|---|---|
| Started from | `origin/fidelity-harvest/f1b` @ **`dc40a9307f`** |
| Head | this report's commit, on top of `3c05d8b` |
| Harness branch | **`claude/seedling-f1c-hammer-phase-xqqz09`**. The harness pinned it, and I reset it onto `dc40a93` first: it had held 9 F2/W4 commits, none of them F1b's |
| Commits | D1 `8fef91d` · D1 witness + D2 STOP `8b923f7` · D3 `cd47231` · D3 follow-ups `b2a47c6` · D4 records `3c05d8b` · this report |
| Dev server | `scripts/serve-nocache.py 9140` (`SEEDLING_PORT=9140`, build `seedling_bot_ap_p4e`, headless logic-only) |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Identity log md5 **`b381ec1a…`** = F1b. The six `--check`s are `410f27c0 7cba9530 cef8048e 55659207 6cd35fe1 4fc7f4e3(exit 1)`. tapeRunner 453/453; roster 198; bounded vitest 18 files / 1,095 tests with 2 expected reds. |
| D1 | **PASS** (game-witnessed) | The HAMMER-PHASE rung. The 45-residue sweep goes from 33 to **37/45** solving. All 33 earlier solves are byte-identical, and residues 10, 40, 41 and **42** now solve; 42 is the chain's, at 512 t `{18,0}@452`, 0 hits. The 8 remainders are each named as a landing's rebound. Residues 16/17 are byte-identical. The game witness was recorded twice, and the mutant gives 1/4 red as predicted. |
| D2 | **STOP at the fix** (the game refutes BOTH spellings) | Recorded twice, the game crosses on **t444**. The model crosses there only under `{18,0}@416`: the v9 spelling (417) is one tick late and the arm's `removal + 101` (418) is two. The cause is a spinner-ledger stamp one step late, not only the spelling. The fix moves generated certifications and `r8-d2`'s cascade, which are outside the licence. |
| D3 | **PASS** | The chain was re-recorded from window 5: **30 windows, 11,035 → 10,937 t**. Only windows 5 and 19 move their walks, and both match the prediction exactly. The other 24 are boot-only, and their recordings are byte-identical. All 26 were recorded on the game, and the whole-chain differential exits 0. **`solve-seedling-r9-campaign --check` exits 0** for the first time since F1. |
| D4 | **PASS** | All six `--check`s exit 0. tapeRunner 457 (the 453 old pairs identical). Surface GREEN 191; constants PASS 4,947; reference ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED. The bounded vitest's only reds are the 2 known bank rows. |

**The one thing to know first.** F1 + F1b + F1c now merge **green on the chain**: `r9-campaign --check` exits 0, every window is game-recorded, and the identity log has exactly four explained movers.

But **L18's kill-lock declaration is still a model value the game refutes, by two ticks.** The game opens `lock@144,112` at the spinner ledger's removal + 99 in the v9 spelling (`f1c-l18-lock-removal`, recorded twice). The committed `r9-solve-18` declares `@452`, and the game opens at 450. The walk waits out the fade at its loiter cell, so no replay sees it.

The fix is two lines: the spinner ledger stamps the alpha-zero step, as the chaser arm does, and the arm declares the v9 spelling. It is measured, and it is **not landed**: it moves `r8-solve-18` (522 → 520 t), the `r8-d2` headline and its `r8-d2-19`/`-20` cascade, and every generated spinner kill-lock certification (the acceptance batch, killgate s2/s5/s9, c3/c4/c6, the ENEMY census). The brief licensed `r8-d2`/`r8-solve-18` only. **That ruling is the user's.** The patch is in the D2 section.

## W0 (at `dc40a93`, the clean tree, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9140 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`b381ec1a1695b5cf6a728068053d2471`**, = F1b's AFTER |
| six `--check`s | the block's producer loop | `410f27c0 7cba9530 cef8048e 55659207 6cd35fe1`, exit 0; **`4fc7f4e3` exit 1**. All = F1b |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json` | **453/453** |
| roster | `fixtures/tapes/index.json` | **198** |
| bounded vitest BEFORE | `fidelityF1`, `fidelityF1b`, `solverBot`, `solverSpinnerKill`, `spinnerClockPairing`, `spinner`, `botDriverV2`, `twoPassSolve`, `tapeRunner`, `campaignChain`, `rerecordCampaign`, `playthroughAcceptance`, `r8Acceptance`, `jsRuntimeDeclarations` (read-only), `rosterCategories`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus` | **18 files / 1,095 tests: 1,093 green, 2 red, both expected.** `rosterCategories:175` (`expected 136 to be 138`, the bank row) and `jsRuntimeDeclarations:152` (`expected 1 to be +0`) |

## D1: the HAMMER-PHASE rung (`8fef91d`, witness `8b923f7`)

**The wall, re-measured** (`/tmp/…/sweep.mjs`, F1b's shape re-derived: the committed `r9-solve-18` staging, `seam.time + δ` for δ = −44 … 0, through `twoPassSolve` as the producer calls it).

At base it reproduces F1b exactly:
- 33/45 solve, with 25 distinct (length, declaration) pairs;
- 12 refuse `HAMMER_SAFETY`, at residues 4 5 6 · 9 10 · 18 19 20 21 · 40 41 42;
- residues 16/17 give the committed walk.

At residue 42 a per-tick dump shows the mechanism:
1. The press at t231 lands at t234.
2. The strike is re-derived to (136,40)`@264`, and the approach walks right and up toward the body.
3. The knocked-back body comes off the wall.
4. At t249 the line, at phase 43 → 0, sweeps across the player at (140.47,52.24). That is 15 ticks past `stepToward`'s 4-tick lookahead.

A feasibility probe on the real drive showed that a hold just after the landing was knowable (a dodging hold from t235 of ≥ 10 ticks) solves.

**The rung** (`solverBot.js`: `previewPressApproach`, `clearAhead`, `hammerPhaseRung`, `hammerPhaseRefusal`; bounds in `HAMMER_PHASE_RUNG` beside `DODGE_RUNG`).

`levelRun` has no rewind, so "back off" is done by seeing the corner early. A preview is exact during an approach for three reasons:
- a spinner's path is player-independent until a press **lands**, and no press is held on an approach tick;
- the hammer phase is `gameTimeAt(i)`;
- the step is `previewStepper()`.

A VIEW of the run `o` ticks ahead (the forecast and clock shifted, the player at the previewed state) answers `stepToward`'s and `safeStep`'s own questions. `safeStep`'s landing test is lifted into `landsClearOfHammers`, one predicate with two callers.

On every approach tick that has a strike and no hold in flight, the executor's own walk is previewed one period ahead:
- If it is clear, the rung does nothing. That is every tick of every committed walk.
- If it is cornered at `+c`, the rung searches a hold: walk-offset `at` from `c−1` down to 0, holds of 1…44 ticks, held with `stepToward` aimed at where the hold began (a safe holding step, not a frozen stand). The first hold whose walk previews clear for one more period is driven, under `safeStep`, and the walk is then re-previewed.
- If no hold clears it, the `safeStep` refusal that follows carries the rung's verdict by name. Its first sentence is unchanged.

The per-tick preview is carried forward when the run's state equals the previewed state. Strike, `lastPressAt` and the press-hit count must also be unchanged. Any other case re-walks it whole. The carried walk is identical by construction: the committed L18 solve takes 1.3 s carried against 4.5 s re-walked, byte for byte (base 0.6 s).

**The bounds, derived, not tuned** (`HAMMER_PHASE_RUNG`):

| bound | value | derivation |
|---|---|---|
| `horizon` | 45 | `SPINNER.hammerPeriod`: one revolution of the line; a walk clear for a whole turn has met every phase |
| `maxTicks` | 44 | `hammerPeriod − 1`: a hold of 1…44 shifts the arrival to every *other* phase; a 45th is the 0th |
| `step` | 1 | the line sweeps 8° a tick, about 1.8 px at its 13 px tip (`hammerLength`), and a body moves `moveSpeed` 1 px a tick, so the corner is decided at tick resolution |
| `maxPerKill` | 3 | `SPINNER.hitsMax`: a LANDING is the only thing the forecast cannot see, so a faithful preview is invalidated at most once per landing |

**Witness 1, the 45-residue sweep at head:**
- **37/45 solve.** All 33 that solved at base are byte-identical (the md5 of `inputs`, residue by residue).
- Newly solved:
  - 10: 427 t `@375`;
  - 40, 41 and 42: 512 t `@452`.
- Lengths at head, across residues: 414 · 427 · 430 · 435 · 441 · 455 · 457 · 463 · 466 · 470 · 480 · 484 · 486 · 490 · 492 · 497 · 498 · 501 · 505 · 512 · 513 · 516 · 517 · 522 · 532 · 540; 27 distinct (length, declaration) pairs.

The 8 that still refuse each carry their true reason:

| residues | what refuses | the corner |
|---|---|---|
| 18 19 20 21 | the press at t261 lands at t262; the body comes off the wall at x≈143 at ~5 px/tick back along the player's row | first seen at t263, one tick after the landing; from t266 no hold of 1…44 at any offset clears it |
| 9 | the same, earlier | first seen at t189, one tick after the landing at t188 |
| 4 5 6 | the same landing (t262) | the corner forms at t267, after the strike lapsed (t266) into a refuge wait, which the rung does not preview |

The new refusal text reads: *"… There is no step out. The corner formed 5 tick(s) after the press on spinner@112,48 LANDED at t262: a landing's knockback is player-coupled, so no forecast taken before it carries the rebound (HAMMER_PHASE_RUNG)."* A knockback rebound is the remainder `seedling-bot.md` already names. Before the landing nothing shows it, and after it no step escapes.

**Witness 2.** Residues 16/17 still produce the walk that was committed (455 t `@418`, inputs md5 `f123ff84`), byte for byte. The rung never fires there.

**Witness 3, the game: `f1c-l18-phase42`** (`plan-seedling-f1c-l18-phase.mjs`, `--check`):
- The tape is `r9-solve-18`'s staging with `seam.time` 10052 → 10032 (residue 17 → 42; nothing else moved), solved as the producer does.
- It has one hold: the corner seen at t234 for t249, 8 ticks from t238, phase 31.
- It runs 512 t, declares `{18,0}@452` and takes 0 hits.

Recorded headless twice, the two recordings are byte-identical (`0ded5b1b…`). The differential reads *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 513 observations, 1 transition(s)"*. The game's `hits` and the model's are 0, so the hammer misses on every tick, and the model's `spinnerContacts` is empty.

The lock is the D2 question. On this walk the game opens it two ticks before the declaration, and the player is standing at its loiter cell, so the recording does not see it.

**Mutant m1** (`hammerPhaseRung` returns `{fired: false}`). Predicted: only the chain-residue row red, with F1b's refusal. **Measured at D1: 1/4 red, `… There is no step out.` at (140.47,52.24).** Re-run at the final rows: **1/10 red**, the same row. Restored md5-identical both times.

**Other spinner rooms** (the roster driven for spinner ticks):

| tape | solve reads a phase? | at head |
|---|---|---|
| `r8-solve-18` | yes (producer `solve-seedling-r8-l18`) | `--check` **`cef8048e` identical** |
| `r8-d2` (+ `-19`/`-20`) | yes (`solve-seedling-r8-d2-chain`) | `--check` **`7cba9530` identical** |
| `r9-solve-18` | yes (`r9-campaign`) | moved by D3, licensed |
| `r1-dark-shield-spinner`, `r1-dark-suit-spinner`, `r8-hammer-arm`, `r8-hammer-control`, `r8-l18-spinner-press`, `r9-solve-16` (one L18 tick), the L39/L40/L92 spinner tapes | hand or planner tapes, not solved | tapeRunner rows identical |
| generated levels (certify solve) | yes | **`c3` `fce3ad42 → cc5f3204`, `c6` `8e59dec8 → 573709cf`**: generated seed 8's kill-gate (post-sword and post-shield) was REFUSED on HAMMER SAFETY at base and the element dropped; it now certifies (SOLVED, 382 t), and the generator keeps it. Every other generated row (killgate s2/s5/s9, both default levels, c4, ENEMY, guard, acceptance) is identical |

## D2: L18's kill lock, asked of the game. STOP at the fix

**The witness, `f1c-l18-lock-removal`** (`plan-seedling-f1c-l18-lock.mjs`, `--check`). It takes `r9-solve-18`'s keys through t320; both bodies are dead by then, and the last is stamped removed at 317. Then it plays the segment's own walk to the teleporter (its keys from t418) started at t330, then `right`. The player is pressed against `lock@144,112`'s west face from **t374**, before every reading. The model discriminates: `@416` crosses t444, `@417` t445 and `@418` t446.

**The game, recorded twice (byte-identical, `eb702df6…`), crosses on t444.** At t417 its player is already at x 143.15, which is the model's `@416` run digit for digit. Neither of the brief's readings holds:

| reading | `{18,0}@` | model crossing | game |
|---|---|---|---|
| the arm today, `removal + 101` | 418 | t446 | **t444** |
| the v9 spelling of the ledger, `removal + 100` | 417 | t445 | t444 |
| **the chaser convention's removal (316) + 100** | **416** | **t444** | **t444** |

**The cause.** `stepSpinner` keeps a body whose alpha reached zero for one more step: `removePending`, then `removed` at the top of the next step. `assertSpinnerRemovalIsDeclared` runs on that next step and stamps `ticksCompleted + 1`. A chaser sets `removed` on the alpha-zero step itself (`stepChasersNow`) and stamps it there. So for the same event the spinner ledger reads one tick later than the convention `f1-l5-lock-removal` witnessed on L5, and the arm then adds the pending-spelled 101. The two errors add up to two ticks.

**The fix, measured in a worktree, not landed** (two edits):

```diff
--- levelRun.js  assertSpinnerRemovalIsDeclared
+        const removedAt = ticksCompleted;   // the alpha-zero step's stamp, the chaser convention
-                t: ticksCompleted + 1, …           (nil row, main row)
+                t: removedAt, …
-                at: killLockClearTick(ticksCompleted + 1, led.opens), removedAt: ticksCompleted + 1,
+                at: killLockClearTick(removedAt, led.opens), removedAt,
--- solverBot.js  execKillByPress's tail
-            source: 'model', at: last.t + fade, removedAt: last.t, fade,
+            source: 'model', at: last.t + fade - 1, removedAt: last.t, fade: fade - 1,   // the v9 spelling
```

With it applied, the model reproduces the recording at worst |Δ| **0**. The witness tape then declares the ledger's own 416, and `r9-solve-18`'s staging solves in **453 t `@416`**.

**What it moves** (the identity block on the worktree, against the D1 head):
- `r8-l18 --check` `cef8048e → d5edac1b` **exit 1**: `r8-solve-18` 522 → **520** t, declared 420. The producer's own label row also asserts `removal + 101` and would need its arithmetic re-spelled.
- `r8-d2-chain --check` `7cba9530 → c9705d15` **exit 1**: the headline's first 522 ticks are no longer `r8-solve-18`'s, and `r8-d2-19`/`-20` boot from the new latch, so they cascade.
- The acceptance batch `e417212b → 608693d2`, c3 → `05c5ef94`, c6 → `e88baf9d`, c4 `b11d9564 → f8cba3a8`, ENEMY census `a20bcbe8 → 1d7bd8cc`, killgate s2/s5/s9 `63d34807/fb207b8e/bfbdfb38 → 01210c82/07ce222a/30a1e3e7`. These are every generated spinner kill-lock certification. The default levels pre/post-sword s1 and guard are unchanged.
- Bounded tests on the fix: 760 tests, 2 reds, both pins this slice owns.

**Why STOP.** The brief licensed `r8-d2`/`r8-solve-18` if their producer `--check` reds, and both would. But the fix also moves `r8-d2-19`/`-20` and the generated certification rows. The brief contemplated a spelling in `solverBot.js`; the measured cause is a ledger stamp in `levelRun`. So the fix is not landed. The witness is committed under its **game-sourced** `{18,0}@416`, which the model reproduces at this head. `fidelityF1c`'s D2 rows pin the MEASUREMENT: the game-sourced crossing, and the model's two readings as **refuted** (one and two ticks late). They do not treat either reading as right.

## D3: the chain from window 5 (`cd47231`)

**Prediction (written before the run):**
- window 5: 403 t `@301`;
- windows 6–18: their committed lengths;
- window 19: at residue 42, `f1c-l18-phase42`'s walk, 512 t `@452`, since the sweep showed the solve depends only on the residue;
- windows 20–30: possibly new walks.

**Measured** (`SEEDLING_PORT=9140 node scripts/procgen/solve-seedling-r9-campaign.mjs`, headless; the latch cache was empty, so every window was driven fresh):

| # | window | before | after | inputs | boot fields moved | recording |
|---|---|---|---|---|---|---|
| 5 | `r8-solve-5` | 558 t `{5,0}@427` | **403 t `@301`** | **MOVED** | — | **moved** |
| 6 | `r8-solve-6` | 294 | 294 | same | `seam.time` 6187 → 6032, `rng.cosmetic` | identical |
| 7 | `r8-solve-7` | 146 | 146 | same | `seam.time` −155, `rng.cosmetic` | identical |
| 8 | `r8-solve-8` | 827 | 827 | same | −155, `rng.cosmetic` | identical |
| 9 | `r8-solve-9` | 122 | 122 | same | −155, `rng.cosmetic` | identical |
| 10 | `r8-solve-10` | 83 | 83 | same | −155, `rng.cosmetic` | identical |
| 11 | `r9-solve-11` | 97 | 97 | same | −155, `rng.cosmetic` | identical |
| 12 | `r9-solve-3` | 152 | 152 | same | −155, `rng.cosmetic` | identical |
| 13 | `r9-solve-2` | 23 | 23 | same | −155, `rng.cosmetic` | identical |
| 14 | `r9-solve-0` | 145 | 145 | same | −155, `rng.cosmetic` | identical |
| 15 | `r9-solve-13` | 36 | 36 | same | −155, `rng.cosmetic` | identical |
| 16 | `r9-solve-14` | 118 | 118 | same | −155 | identical |
| 17 | `r9-solve-15` | 456 | 456 | same | −155 | identical |
| 18 | `r9-solve-16` | 625 | 625 | same | −155 | identical |
| **19** | **`r9-solve-18`** | 455 t `{18,0}@418` | **512 t `@452`** (one 8-tick hold) | **MOVED** (= `f1c-l18-phase42`'s keys) | `seam.time` 10052 → 9897 (residue 17 → 42) | **moved** |
| 20 | `r9-solve-19` | 746 | 746 | same | `seam.time` −98 | identical |
| 21 | `r9-solve-20` | 560 | 560 | same | −98 | identical |
| 22 | `r9-solve-13-v2` | 48 | 48 | same | −98 | identical |
| 23 | `r9-solve-0-v3` | 299 | 299 | same | −98 | identical |
| 24 | `r9-solve-12` | 2,419 | 2,419 | same | −98 | identical |
| 25 | `r9-solve-21` | 26 | 26 | same | −98 | identical |
| 26 | `r9-solve-22` | 89 | 89 | same | −98 | identical |
| 27 | `r9-solve-29` | 379 | 379 | same | −98 | identical |
| 28 | `r9-solve-31` | 336 | 336 | same | −98 | identical |
| 29 | `r9-solve-30` | 210 | 210 | same | −98 | identical |
| 30 | `r9-solve-32` | 1,056 | 1,056 | same | −98 | identical |

Windows 1–4 are promoted and untouched. The chain is **30 windows, 11,035 → 10,937 t**. Every walk that did not need to move stayed byte-identical, and so did their traces. Only `r8-solve-5`'s and `r9-solve-18`'s traces moved.

**Recorded on the game:**
- One `--record --only=<26 windows>` run: **26 RECORDED, 26 "THE MODEL REPRODUCES THE RECORDING IT JUST MADE"**. The 24 boot-only windows re-recorded **byte-identical**; only `r8-solve-5` and `r9-solve-18` changed.
- Then `derive-seedling-tick0.mjs`, the zero-tick game run that owns the `tick0` blocks: the producer carries `tick0` forward on purpose, so a boot move leaves it stale. **27 written, ALL CHECKS PASSED** apart from the residue below.
- Then the **whole-chain differential** (`--only=` all 30 windows, no `--record`): **EXIT 0, 889 PASS, 0 FAIL**. 30/30 *"live game matches the committed oracle stream"*. Every provenance row passes (`{5,0}@301` = the run's removal 201 + 100; `{18,0}@452` = 351 + 101). `endsAt` 10,937.

**Bounds held:**
- the chain walks all 30 route steps;
- `census-seedling-campaign`: 30 of 30 windows stepped, 29 boundaries admitted, 10,937 t, **NO CHAIN ROOM MOVES**;
- `--check-frontier` 4 pass / 0 fail. The `lastArrival` rows are SKIPPED because the survey files are not on disk; that is not a pass. `campaign-frontier.json` is not rewritten (its segments and arrivals hold);
- 0 hits in every window (its own ZERO-hits row; the game's `hits` 0).

**Licensed sites moved:**
- `playthroughWalk.js`'s `{5,0}` evidence rows (both): `removedAt` 326 → **201**, `fade` 101 → **100**, with the v9 note;
- `r9-campaign`'s `{18,0}` row: `removedAt` 317 → **351** (the docblock names D2's two-tick finding);
- `seedling-bot.md`: 10,937 t.

**Checks:**
- `solve-seedling-r9-campaign --check` → **exit 0**, `9168796be43f3288cf4b7bfa7ba87aec`;
- `solve-seedling-r8-tail --check` → **exit 0**, `48d52d8354c413d788932c8e86caac60`. Its one changed line strips `[{5,0}@301]` where it used to strip `@427`.

**D3 follow-ups** (tests the re-record moved; each fixed at its cause):
- `fidelityF1`'s `r8-solve-5` body oracle had been sampled on the old 558-t walk. At t403 the new walk is in L6 and the old one in L5. I re-sampled it on the game with the oracle's own command (`probe-seedling-u9-shield-mobiles --tape=r8-solve-5 --class=Bob`): 404 ticks, 524 rows, worst |Δ| **1.4e-14**. `f1-bodies-oracle.json` `3551e4af → a518a6e3`, with only the `r8-solve-5` rows and the comment changed.
- `tapeRunner`'s three `addTimedClears` rows typed `427`. They now read the tick off the window's own timed row.
- `procgenKillGateDemand`'s *"did-not-certify"* row scanned seeds 1..12 for a forced kill gate the solver cannot certify. Its subject, seed 8, now certifies (D1). Measured: no seed in 1..40 fails certification at head, and seed **92** is the first. The scan bound is now 120, interpolated in the message; the subject is still found by scan, not picked.

## What `jsRuntimeDeclarations.test.js:152` reads at my head

`expect(s.declines).toBe(0)` → **reads 1**, the same decline as F1/F1b (L5's kill-lock dwell on `bob@48,80`). F1c changes nothing in L5's solve. I did not edit the file; the pin the JS arc should carry is F1b's, `toBe(1)`.

## The wasm-gate pins that cite the chain

`check-seedling-wasm-ship.mjs` cites "chain tick 1056 = tick 326 of window 5 (`r8-solve-5`)" in two **docblock** passages (`~1008`, `~1890`). They are the historical record of why `deadFrameSharesOf` hands a resumed window its timed rows. **No assertion reads 1056 or 326.** The arm rebases every window's timed rows by its offset (`c.at + offset`), so it follows the new `{5,0}@301` without a typed number. `check-seedling-wasm-pages.mjs` does not cite the chain tick. Nothing in either gate moves except what it derives. The prose is history, and I left it.

## Deltas

| Row | W0 (`dc40a93`) | head | movers |
|---|---|---|---|
| identity log | `b381ec1a…` | **`10b9365dd3ceee81999bd215a28389d1`** | four lines (below); every other row identical, reference ALL 7 + 5 MATCH |
| `empty pairs c3` | `fce3ad42…` | **`cc5f32040875c5ad6034369c10e75c28`** | D1: seed 8's kill-gate certifies |
| `empty pairs c6` | `8e59dec8…` | **`573709cf0f18fcf7ae8c8c8703e3eed2`** | D1: the same |
| `r8-tail --check` | `55659207…` exit 0 | **`48d52d83…`** exit 0 | D3: strips `@301` |
| `r9-campaign --check` | `4fc7f4e3…` **exit 1** | **`9168796b…` exit 0** | D3 |
| battery / d2-chain / l18 / r9-l3 `--check` | `410f27c0 7cba9530 cef8048e 6cd35fe1` | **identical** | the rung does not fire on their walks |
| tapeRunner | 453 | **457**, the 453 old pairs identical | +4: the two witnesses' differential and stepping rows |
| roster | 198 | **200** | `f1c-l18-phase42`, `f1c-l18-lock-removal` |
| solver surface | GREEN 191 | **GREEN 191** (`--write` → `--check`) | site counts only; no new member, no blind spot |
| constants | PASS 4,947 | **PASS 4,947** (`--profile-rows` → `--write` → `--check`) | 0 new, 0 vanished, 0 moved |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH**; `check-procgen-docs` ALL CHECKS PASSED | instruments 319 → **321** (two planners); docs index (the log entry); both planners `HELP ok · IMPORT ok` |
| `derive-seedling-tick0 --check` | 4 failed | **2 failed** | the residue: `r8-d2-19`/`-20` |
| bounded vitest | 18 files / 1,095 (2 red) | see the D4 commit and below | — |

## D4: records

- **Pins** (unions, added, not rewritten):
  - `R8_D2_SHIELD.pressExposure.reachingAdded` gets both witnesses;
  - `tapeEnvelope`, `observationTolerance` (incl. `swapped`) and `dialogueAutoAdvance` go 198 → 200 (199 inert);
  - `watchManual`'s timed-declaration list gets both witnesses.
- **`fidelityF1c.test.js`** has 10 rows: the bounds; no-corner never fires; the committed window IS the rung's solve; the remainder named; the witness's staging and keys; its replay; and three D2 measurement rows.
- **`seedling-bot-log.md`**: `### Seedling fidelity F1c — the hammer-phase rung + the chain from window 5 (2026-10-03)`, with three trap candidates. **`seedling-bot.md`**: the rung, beside the rebound wall it names.
- **Refusal words**: I grepped (`rg -a`) the test tree for *"There is no step out"*, *"nowhere to be"* and `HAMMER_SAFETY`. Every pin matches a prefix or the code. The first sentence is unchanged, so nothing moved.
- **`lintGateLabels`** is green. The new titles carry no typed count; the residues are derived from the tape's clock, and the kill-gate bound is interpolated.

**Bounded vitest AFTER** (the W0 set, every test touched, F1b's wider list, the generator and certification tests, `procgenDocs/`), 56 files. The result is filled in below from the final run:

**55 files / 2,873 tests: 2,871 green, 2 red, both expected:**
- `rosterCategories:175`, the composite bank row (`expected 136 to be 140`);
- `jsRuntimeDeclarations:152` (`expected 1 to be +0`), in the JS arc's file.

Within it, tapeRunner is **457/457**, and the 453 W0 (name, status) pairs are identical. Two things ran after the suite started, and I re-ran their tests after them: `tapeIndexManifest`, `tiers`, `lintGateLabels` and `procgenDocs/generated` read 292/292 once `witness-bases/` existed, and `fidelityF1c` reads 10/10 in its final form.

**The witness producers' `--check`s** (after the follow-up commit):

| producer | `--check` |
|---|---|
| `plan-seedling-f1c-l18-phase` | all checks green |
| `plan-seedling-f1c-l18-lock` | all checks green |
| `plan-seedling-f1-l5-lock` (F1's) | all checks green; it was DRIFT after D3, because its base walk was replaced, and it now reads `witness-bases/` |
| `plan-seedling-f1-l5-open-lock` (F1's) | all checks green |
| `plan-seedling-u14-moonrock`, `plan-seedling-u15-turret` | ALL CHECKS PASSED |
| `plan-seedling-r9-l0-sword-dash` | **2 FAILED, pre-existing**: the identical DRIFT at `dc40a93` with the base solver (residue 7) |
| `check-seedling-producer-boundaries` | ALL PASS: 26 verified, 6 REFUSED-UNVERIFIED (no cached latch for their bytes; not claimed green) |
| `check-seedling-full-tier-owed` | 2 categories owe a drive: the standing full-tier row describes the pre-re-record roster (the coordinator's CI row) |

## What the brief got wrong (measured)

1. **"Back off to an earlier safe point on the approach."** The run cannot back off: `levelRun` has one mutator and no snapshot. The rung sees the corner early instead, previewing the executor's own approach on the player-independent forecast, and holds before the corner forms.
2. **"A refusal remains only when NO phase admits a safe step."** Every remainder (8/45) is a corner a press's LANDING makes. The knockback is player-coupled, so before the landing no forecast shows it, and after it no hold escapes. "No phase admits a step" is true only from the landing on. The refusal names the landing.
3. **D2's two readings, `removal + 100` vs `removal + 101`.** The game refutes both: it opens at removal + 99 against the spinner ledger. The ledger stamps a spinner's removal one step after a chaser's (`removePending`), so the fix is a ledger stamp in `levelRun` plus the spelling, and its reach goes beyond L18's committed tapes, into every generated spinner kill-lock certification.
4. **"Windows 6–18: their committed lengths; window 19 onward: possibly new walks."** Windows 20–30 keep their walks too, and so do their recordings. Only windows 5 and 19 moved.
5. **"`r8-tail`'s outputs" and the witnesses' bases.** A re-record of a chain window also replaces the walk every witness planner was CUT from: F1's `plan-seedling-f1-l5-lock` drifted after D3, and so did both F1c planners. The bases now live in `fixtures/witness-bases/`.
6. **"Run `solve-seedling-r9-campaign` (and `rerecord-seedling-campaign` as U13–U15 did)."** The producer's write leaves every moved boot's `tick0` block stale on purpose (`tick0Carry`). The step that re-derives it is `derive-seedling-tick0.mjs`. I ran that, the `--record` over the moved set and the whole-chain differential directly, not the S0–S5 pipeline.
7. **"Other spinner rooms … byte-identical, the rung does not fire there."** True for every committed tape. But the rung reaches **generated** levels through the certify solve: one element in `c3`/`c6` that was refused now certifies.
8. **The pre-licensed `r8-tail` output.** It needs no write: its `--check` stays exit 0, and the md5 moves by one line.

## Residue

| # | item | site |
|---|---|---|
| 1 | **L18's kill-lock declaration is two ticks late against the game** (`f1c-l18-lock-removal`: the game is 416, the ledger + v9 is 417, the arm is 418). The committed `r9-solve-18` `@452`, `r8-solve-18` `@422` and `r8-d2` declare model values the game refutes; their walks arrive late, so no replay sees it. The fix is measured and its moved set listed (D2); the ruling is the user's | `levelRun.assertSpinnerRemovalIsDeclared`; `solverBot.execKillByPress`'s tail |
| 2 | **The rebound remainder**: 8/45 L18 residues still refuse, each a landing's rebound. A preview that knew the knockback would need a hit-aware forecast (`hitSpinner` on a copy of the bodies), which `levelRun` does not expose | `solverBot.hammerPhaseRung`; `levelRun.spinnerForecast` |
| 3 | **`r8-d2-19`/`-20`'s `tick0` blocks are stale at the base** (`derive-seedling-tick0 --check`: delta −16 on both, red at `dc40a93` too). The zero-tick run re-derives them (`9112 → 9149`, `10028 → 10065`, new seeds), but they are outside this licence, so they were reverted, not written | `fixtures/tapes/r8-d2-19.json`, `-20.json` |
| 4 | **`jsRuntimeDeclarations.test.js:152`** reads `declines` 1 (F1b's pin, unchanged) | the JS arc |
| 5 | **The composite roster bank row** (`rosterCategories:175`) now reads 140 (was 138 at F1b): `standing-values --write` only | the coordinator's bank |
| 6 | **The rung's cost on a cornered solve**: residue 42 takes 16 s, against 0.6 s for an uncornered L18 solve (the search's 448 candidate previews per firing, one firing per two-pass pass) | `hammerPhaseRung` |
| 7 | **`plan-seedling-r9-l0-sword-dash --check` drifts** (2 failures: the committed tape and `-rest`). It is red identically at `dc40a93` with the base solver, so it is not this slice's. Not touched | `scripts/procgen/plan-seedling-r9-l0-sword-dash.mjs` |
| 8 | **The full tier owes a drive** (`check-seedling-full-tier-owed`: 2 categories) because 26 chain tapes and 2 witnesses moved or were added | CI |

## Byte-inertia

| Artifact | W0 (`dc40a93`) | head |
|---|---|---|
| identity log | `b381ec1a1695b5cf6a728068053d2471` | `10b9365dd3ceee81999bd215a28389d1`: **identical except c3, c6, r8-tail, r9-campaign** |
| six `--check`s | `410f27c0 7cba9530 cef8048e 55659207 6cd35fe1 4fc7f4e3(1)` | `410f27c0 7cba9530 cef8048e` **`48d52d83`** `6cd35fe1` **`9168796b`(0)** |
| L18 sweep, 45 residues | 33 solve | **37 solve; the 33 byte-identical** |
| committed tapes | — | **26 moved + 2 added**: the walks of `r8-solve-5` and `r9-solve-18`; 24 boots (`seam.time`, `rng.cosmetic`, `tick0`); the two witnesses added. Expectations: 2 moved, 2 added, the 24 boot-only re-recorded byte-identical. Traces: 2 moved |
| other fixtures | — | `f1-bodies-oracle.json` (r8-solve-5's rows re-sampled on the game); `index.json`; **`fixtures/witness-bases/`** added: `r8-solve-5.f1b.json` and `r9-solve-18.f1b.json`, byte-identical to the pre-D3 tapes (`ab598c21`, `d775dc87`), outside the tape roster, read only by the three witness planners; `campaign-frontier.json` **untouched** |

Untouched or not run: AS3, wasm, gitlinks, biome defaults, `standing-values --write`, `pytest`, the unfiltered vitest, the JS arc's files, F2's regions, `r8-solve-18`/`r8-d2`/`r8-d2-19`/`r8-d2-20`. `git stash` was not used. Every mutant was a copy and restore, md5-checked.

**Scratch** (`/tmp/claude-0/f1c/`, not committed): the sweep (`sweep.mjs`, the before/after logs), the per-tick dumps, the D2 worktree and its identity log, the producer, record, tick-0, differential and census logs, the vitest JSONs.

## Rows the coordinator must BANK

**CI-read** (not measured here; ⚖ 52):
- the unfiltered vitest at the pushed SHA (`node scripts/procgen/ci-vitest-summary.mjs <sha>`), which will show residues 4 and 5 red;
- the differential's full tier: 200 tapes, the two witnesses recorded here headless, and the 26 chain windows re-recorded.

**Box rows:**
- identity log md5 **`10b9365dd3ceee81999bd215a28389d1`**;
- six `--check`s **`410f27c077b1ee854a14c24b73dc6335` `7cba9530f8faa10ebd13d3d396a11267` `cef8048e2f45e31160cb01457b014b6b` `48d52d8354c413d788932c8e86caac60` `6cd35fe1414af6bf5beb7605f235cb8e` `9168796be43f3288cf4b7bfa7ba87aec`**, all exit 0;
- `empty pairs c3` **`cc5f3204…`**, `c6` **`573709cf…`**;
- the chain: **30 windows, 10,937 t**;
- tapeRunner **457**; roster **200**; surface **191**; constants **4,947**; instruments **321**;
- `derive-seedling-tick0 --check`: 2 failures, residue 3;
- new fixtures: `f1c-l18-phase42` (tape `7727e1b6…`, expectation `0ded5b1b…`), `f1c-l18-lock-removal` (tape `ec5920c3…`, expectation `eb702df6…`); `f1-bodies-oracle.json` `a518a6e3…`; `witness-bases/` `ab598c21…` / `d775dc87…`.
