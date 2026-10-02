# Seedling fidelity F1: L5's diverging bodies (the arrows' update order) · the L5 open-lock arrival that declines

**Slice:** `seedling-fidelity-f1`, the first build slice of the model-fidelity arc, an Opus session run in the cloud (planner `seedling-fidelity-planning`). ⚖ The user, 2026-10-02: F1 is items 1 and 2 as one slice, D1 then D2, with the L5 re-record pre-licensed under § D1c's game-witness condition. I did not edit any JS-arc file (`jsRuntime*.js`, `flashPanel/*`, `wasmArrival.js`, the solver worker, `solveSegment`'s `prefix` admission), any AS3, the wasm or a gitlink. `fidelityF1.test.js` and the D2 planner import `jsRuntimeCore` and `wasmArrival` read-only. In `solverBot.js`, no signature or contract of `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging` moved.

| | |
|---|---|
| Started from | `origin/main` @ `aabe6d6ace` (the brief's floor) |
| Head | this report's commit, on top of `dbdae68` |
| Harness branch | `claude/seedling-fidelity-f1-4u58lm` (the harness pins it, not `seedling-fidelity-f1`) |
| Commits | D1 `de808e4` · D2 `8d9a314` · follow-ups `cb84dbc` · D3 records `dbdae68` · this report |
| Dev server | `scripts/serve-nocache.py 9110` (`SEEDLING_PORT=9110`, build `seedling_bot_ap_p4e`, headless logic-only) |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced at `aabe6d6`. The six `--check`s are `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, all exit 0. tapeRunner 449/449; surface GREEN 191; constants PASS 4,937; profile 138; entities 518; roster 196; bounded vitest 13 files / 1,115 green. |
| D1 | **PASS** (cause found, fixed, game-witnessed) | The arrows update **newest-first**. When two arrows of one volley overlap one body on one tick, the game lands the newer one (x = 40) and the model landed the older one (x = 36). With `levelRun.arrowUpdateOrder`, L5's bodies are the game's to 1.4e-14 over all of `r8-solve-5` (was 23.06 px). Mutant: 6/6 red. |
| D1c | **STOP (re-record not licensed by its own condition)** | A discriminating witness shows the game opens L5's lock on the **removal** of the last body + 100 (t 301). The model's ledger reads the **kill** (t 166 + 101 = 267). The model's lock tick is not the game's, so none of the four L5 tapes is re-recorded. The witness itself (`f1-l5-lock-removal`, `{5,0}@301` game-sourced) is committed, and the model replays it. **Second STOP**: the campaign producer's `--check` re-solves window 5 to 403 t and reds; a green check would re-record windows 5 and 6+ (D3). |
| D2 | **PASS (a false refusal removed; the arrival declines by a new, game-confirmed name)** | The *"ALREADY OPEN before the hold begins"* refusal came from a positive control snapshotted after the walk onto the button. Fixed. The open-lock arrival now declines with `BODY_OUT_OF_LANE`: `bob@16,80` ends in column 3, out of every lane, and the game agrees body for body. |
| D3 | **PASS, with two explained movers and one red `--check` (STOP)** | Identity log: every row is byte-identical except two producer `--check`s, both from window 5's re-solve. `r8-tail` moved `9a6a3192…` → `dfa702ca…` (exit 0). **`r9-campaign` moved `975e2f48…` → `83997b2c…` and exits 1**: it re-solves window 5 in 403 t against the committed 558, and window 6's boot derives from that length. tapeRunner 453/453 (the 449 old pairs identical, +4 for the two witnesses). Surface GREEN 191. Constants PASS 4,947. Profile 138, entities 518. Reference ALL 7 + 5 MATCH. |

**The one thing to know first.** The model's L5 kill-lock ledger is wrong in a way the game has now measured. `chaserKillLockOpens[].t` is the tick the death STARTS, and `twoPassSolve` declares that + 101. The game opens the lock 100 steps after the last body leaves the world, which is 35 ticks after the kill on a Bob. On `r8-solve-5`'s staging that is 301 against the model's 267: the witness player stands on the lock from t 261 and the game lets it through on t 303. The committed `r8-solve-5` (`{5,0}@427`) and `r9-campaign`'s `{5,0}` evidence row (`removedAt: 326`) are still model values. Their player arrives late, so the replay is unaffected, but the bodies they describe now die at t 124/127/166, not t 165/326. Fixing the ledger is swim R5's residue item 3, and it now has a room whose bodies the model reproduces.

**And the campaign producer's `--check` is red at this head** (`solve-seedling-r9-campaign --check`, exit 1, 5 failures, all window 5). It re-solves `r8-solve-5` under the corrected bodies in **403 t (declared `{5,0}@267`)** against the committed **558 t (`@427`)**. The free oracle then breaks at window 6: *"r8-solve-6 declares seam.time 6187 — 5609 + 40 − LOAD_FADE_FRAMES + 403 = 6032"*. Making it green means re-recording window 5 **and** window 6 at least (window 6's boot is window 5's game-measured latch). The new window 5 would also carry the 267 the game refutes. Under the brief's rule that is a STOP: **moved set = `r8-solve-5` (tape + trace) and `r8-solve-6` (boot `seam.time`, and everything that chains from its latch)**. `campaign-frontier.json` was not touched. The coordinator asks the user; the order I would propose is ledger first (residue 1), then one re-record of the chain from window 5.

## W0 (at `aabe6d6`, the clean tree, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9110 bash scripts/procgen/identity-block.sh .` (venv active) | maze `246dfbce…` · acceptance `e417212b…` · c3 `fce3ad42…` · c6 `8e59dec8…` · c4 `b11d9564…` · ENEMY `a20bcbe8…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK · reference ALL 7 + 5 MATCH. Every value equals R5's banked row. Log md5 **`771ff8baa769ff4e4d0940ffb24a0541`** (R5 quoted `25bb24ae…` for its log; every ROW agrees, so the difference is in the log's own framing, which I cannot diff without R5's file) |
| six `--check`s | the block's producer loop | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, all exit 0 (= the brief's bank) |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json` | **449/449**; the (name, status) pairs saved (md5 `3ad4e61e…`) for the AFTER diff |
| surface / constants / profile / entities | `census-seedling-solver-surface --check` · `census-seedling-constants --check` · `witness-seedling-profile --check` · `witness-seedling-entities --check` | GREEN 191 / PASS 4,937 / 138 keys (both tiers) / 518 leaves |
| roster | `fixtures/tapes/index.json` | 196 tapes |
| bounded vitest BEFORE | levelRun, chasers, enemyDamage, arrowTrap, solverBot, botDriverV2, tapeRunner, playthroughAcceptance, campaignChain (the playthroughWalk consumer), jsRuntimeSolver (read-only use), seedlingSolverSurface, seedlingConstantsCensus, lintGateLabels | **13 files / 1,115 green**, exit 0 |

## D1: L5's arrow knockback on a Bob (`de808e4`)

### D1a: the measurement

Two scratch instruments: a per-tick model dump (bodies and arrows, both sides) and a game sampler that keeps every `botMobiles()` row for Bob, Arrow and Player on every tick (`r8-solve-5`: 559 of 558+1 ticks sampled).

At **t 53 both sides agree exactly**: `bob@16,64` at (34.5950, 67.8128), v (0.3536, −0.3536), no hits. So candidate (d), a pre-hit velocity difference, is out. The volley `arrowtrap@32,48#0` is at y 58 in both, x = 36, 40 and 44.

At **t 54** the arrows move to y 63. `#0.0` (x 36, box [34,38)×[61,65)) and `#0.1` (x 40, box [38,42)) **both** overlap the bob's box [30.6,38.6)×[63.8,71.8). The game's arrows read:

```
t54  Arrow 44,63 v(0,5)   Arrow 40,63 v(0,0)   Arrow 36,63 v(0,0)     ← both stopped
     Bob 31.4021,70.6192  v(-2.6929, 2.3064)  hits 1/29
```

Both arrows stop, but the bob takes ONE hit (the second meets the i-frames `Enemy.hit` just armed), and the knockback angle is measured from the arrow that landed:

| landed arrow | `atan2(y − p.y, x − p.x)` from (34.595, 67.8128) | (0.3536, −0.3536) + 5·(cos, sin) → friction (len − 0.25) → chase step (±0.5) |
|---|---|---|
| `#0.1`, x = 40 | atan2(4.8128, −5.405) | **(−2.6929, 2.3064)**, the game's digits |
| `#0.0`, x = 36 | atan2(4.8128, −1.405) | **(−0.4903, 3.7028)**, the model's digits |

**The cause is the order the arrows update in.** FlashPunk's `World.updateLists()` walks `_add` in add order, and `addUpdate` PREPENDS each entity (`World.as:937-951`). So the arrows `ArrowTrap.shoot()` adds as `#k.0, #k.1, #k.2` (x − 4, x, x + 4) update as `.2, .1, .0`, and the newest volley updates first. The traps themselves update in reverse load order, so the last trap's volley is created first and ends up behind the first trap's. The update order is therefore: newest spawn tick first; within a tick, the traps in load order; within a volley, `.2 .1 .0`. The game's own `botMobiles()` listing shows exactly that order. `levelRun.stepArrowTrapsNow` walked `flight` in creation order.

Against the planner's candidates: (a) the angle points were right (the arrow's post-move entity point and the body's pre-update point, as in the model); (b) the arrow-versus-bob order was right (spawned arrows update before every loaded entity, which the model already did); (c) the force is `v.length` = 5 at the call, which is the constant; (d) the pre-hit state agreed. It is a fifth thing: the order **among the arrows**, which decides which of two same-tick hits lands.

### D1b: the fix and the witness

`levelRun.arrowUpdateOrder(flight)` returns the game's order, and the step loop walks it. Each arrow's spawn tick is kept in a `WeakMap`, and volleys are grouped by id. The **storage** order is unchanged: `arrowsInFlight`, `arrowFlights` and both forecasts read it, and none of them asks a body.

**Bodies, worst |Δ| over the whole tape** (`probe-seedling-u9-shield-mobiles.mjs --class=Bob`, plus the scratch sampler for `r7-act2-full`):

| tape | before | after | per body after |
|---|---|---|---|
| `r8-solve-5` | 23.06 (336 cmp, 248 ticks with a count mismatch from t109) | **1.4e-14** (524 cmp, 0 mismatches) | bob@48,80 1.4e-14 · bob@16,80 4.4e-16 · bob@16,64 1.4e-14 |
| `r7-act2-5` | 23.06 | **1.4e-14** (524) | same as above (the same staging) |
| `r7-act2-full` | 23.06 (L4's `bob@64,64` first, t558) | **1.4e-14** (1,007 cmp to t2019) | bob@64,64 8.9e-16 |
| `r2-terrain-killlock` | 1.1e-16 | **1.1e-16** (425) | already exact (terrain kills, no shared arrows) |
| `r8-solve-4` (found by the census) | 11.94 (L4's `bob@64,64` at t83) | **8.9e-16** (154) | — |

The kill order on `r8-solve-5` is now the game's: `bob@48,80` t124, `bob@16,64` t127, `bob@16,80` t166, all arrows (they were `bob@16,80` t165 and `bob@48,80` t326).

**Census of the general cause.** The order matters wherever two arrows reach one target on one tick, so I replayed **all 196 committed tapes** through the model before and after, with a per-tick digest of player, every chaser (x, y, v, hits, i-frames) and every arrow in flight: **192 identical, 4 moved**. The four are `r7-act2-5` (from t54), `r8-solve-5` (t54), `r7-act2-full` (t558) and `r8-solve-4` (t83), and all four are now the game's (table above). No player stream moved: tapeRunner's 449 old (name, status) pairs are identical. I did not run the differential's `--tier=fast`. It compares the game to the committed recordings, and a model-only change cannot move it; tapeRunner is the model-vs-recording gate, and it is identical.

**The committed witness.** `fixtures/f1-bodies-oracle.json` holds the game's Bob rows (the probe's game half, `[t, x, y, vx, vy, hits, hits_timer]`) for `r8-solve-5`, `r8-solve-4` and F1's two witness tapes. `fidelityF1.test.js` replays each tape and holds every Bob on every sampled tick to it: position and velocity within 1e-9, hits, i-frames and presence. It also pins t54 to the game's digits, with `#0.1` landing and `#0.0` refused, and the L5 kill row (t166, `bob@16,80`).

**Mutant m1** (`arrowUpdateOrder` returns `flight` unchanged). Predicted 5 red: both oracle rows, the t54 row, the kills row and the removal row. **Measured 6/6 red**: those five, plus the crossing row (the player reaches the lock at t285, not before t267). Under creation order the bodies that survive change the player's own walk, so the witness's player stream sees the order too. Restored md5-identical (`23bad806…`).

### D1c: the lock witness, and why there is no re-record

R5's producer is gone, so I re-derived it as `plan-seedling-f1-l5-lock.mjs` (committed, `--check`). It replays `r8-solve-5`'s staging and keys through t199, then the segment's own walk to the lock (its keys from t462) shifted to start at t167, then `down` to t380. The player stands on `lock@48,112` from **t 261**, before both readings:

| reading | tick | the model's crossing with that declaration |
|---|---|---|
| KILL: `chaserKillLockOpens[].t` (166) + 101, which is what `twoPassSolve` declares | **267** | t 269 |
| REMOVAL: the last body leaves the world at t 201 (`Game.totalEnemies()` is `classCount(Bob) + …`), + 100 | **301** | **t 303** |

**The game** (`check-seedling-bot-differential --record --only=f1-l5-lock-removal`, recorded twice) crosses to L6 on **t 303**. In the game sampler the player is held at y 108.55 from t261 to t301, and the last Bob row disappears at t201 (die t166, destroy t190). So the game opens the lock on the removal + 100, and the model's own ledger (267) is 34 ticks early. That is the pre-licence's condition failing (*"the model's lock-opening tick equal to the game's"*), so **`r8-solve-5`, `r7-act2-5`, `r7-act2-full` and `r2-terrain-killlock` are not re-recorded, and no `playthroughWalk.js` row moved.** No input moved, so no latch moved. But the campaign producer's `--check` re-solves window 5 and now reds (403 t vs 558; window 6's `seam.time` oracle follows). That is the brief's "a window AFTER 5 must be re-recorded" case: STOP, and the moved set is in D3.

The witness IS committed, because the model agrees with it: its `{5,0}@301` is game-sourced, and the model replays the recording under it. The differential passes, the body probe reads 678 comparisons at worst 1.4e-14, and tapeRunner's rows are green. `fidelityF1.test.js` asserts the model's last removal (t201) + 100 = the declaration, and that the walk is on the lock before t267.

## D2: the L5 open-lock arrival (`8d9a314`, `cb84dbc`)

**Reproduced** with the planner's snippet: lock shut → solved **558 t** at `aabe6d6` (**403 t** at head, because the bodies now die when the game says); lock open → `BotDriverV2Error … -> kill (bob@16,80): every responder in group t=0 [] is ALREADY OPEN before the hold begins …`.

**What the refusal was.** L5's world: `button@48,48` (t 0) arms all four traps (`arrowtrap@32,48`, `@64,48`, `@16,16`, `@80,16`, all t 0 and none `shootDefault`). The lock is `tset −1`, so the hold's group (activators with t 0) is [] **whether the lock is open or shut**. The shut-lock solve never reaches this code: it takes the kill-LOCK strategy (`phases: clear 323 → drain`, `openedAt 383`). With the lock open, the reach-exit's corridor still has live bobs, so the ladder climbs BAIT → BAIT → KILL. Kill-by-ceiling (`deriveKillByCeiling`) then picks the button and holds it. The chaser arm built `runHold`'s `before` snapshot **after** `walkTo(kill.stance)`, and the stance is on the button. Measured: `armedArrowTraps` is **[] before the walk and all four after it**. So the control saw nothing left to change and refused. The responder was not "already open"; the walk had armed it. The static-body arm right above already snapshots before the approach (its comment: *"§11.7's law, and this rung is the third place it bites"*); this is the fourth.

**The fix:** the snapshot moves above the walk. The hold then runs and meets the true wall. The 318-tick bound runs out with `bob@16,80` alive at **(58.87, 84.14), 2 hits**, last hit at t149. The four lanes are x [18,30), [34,46), [66,78), [82,94), and the body's box [54.87, 62.87) is in none of them: it stands in column 3, between the lanes. The kill was planned from the body's position at planning time, when it stood in `arrowtrap@32,48`'s lane, and a chaser walks. The refusal now appends what the hold measured, read from the run: where the body is, which armed lanes cover it (none), when it last took a hit, how many volleys fired after that, and the name `BODY_OUT_OF_LANE`. The last hit is read off the hold's own per-tick `until` test, because `run.arrowBodyHits` is not in the solver-surface contract table.

**The game agrees.** `plan-seedling-f1-l5-open-lock.mjs` captures the solve's own held keys up to the refusal (437 ticks). It builds `f1-l5-open-lock-bait` on `r8-solve-5`'s staging (the same boot) with `{5,0}` set and untimed, and asserts that the replay equals the solve run, player and every body, every tick. Recorded twice on the game; the differential passes. The body probe reads **712 comparisons, worst 8.5e-14**: in the game too, `bob@16,64` drowns at t48, the arrows kill `bob@48,80` (t182), and `bob@16,80` survives at (58.87, 84.14) with 2 hits.

**Witness rows** (`fidelityF1.test.js`, the JS runtime's staging imported read-only): lock shut → solves, **403 ticks, 0 hits**; lock open → declines `BotDriverV2Error`, never *"ALREADY OPEN"*, and names `bob@16,80 is alive at (58.87, 84.14) with 2 hit(s), and NO armed lane covers it` and `BODY_OUT_OF_LANE`. The game witness's Bob rows join the oracle.

**Mutant m2** (the `before` snapshot after the walk again). Predicted: the D2 decline row red with the old refusal and the other 9 rows green. **Measured exactly that**: `expected 'solverBot(l5) reach-exit (48,112)->L6…' not to match /ALREADY OPEN/`, 1 red / 10. Restored md5-identical (`b410b97f…`).

**Refusal words.** `grep -a` over the test tree for the old refusal finds only `botDriverV2.test.js:1313`, which drives `runHold` directly, and its text is unchanged; no pin moved. The new text is appended in a catch, so the refusal's first line (the one the page keeps) is unchanged.

## D3: records

| Row | Command | Result |
|---|---|---|
| identity block AFTER | `SEEDLING_PORT=9110 bash scripts/procgen/identity-block.sh .` at `dbdae68` (clean tree) | log md5 **`9bba1d879c314971ecbfed85c19173dd`**. `diff` against W0: **two lines**. Every census, pair, killgate, level, generated-set and reference row is byte-identical |
| `solve-seedling-r8-tail --check` | in the block | `9a6a3192…` → **`dfa702ca…`**, exit 0. The full-output diff against the same command at `aabe6d6` (worktree) is window 5's solve only: pass 1 kill-lock at t 326 → **166**, pass 2 `{5,0}@427` → **@267**, pass 3 558 → **403** t, and the summary row `solver 558 → 403`. Every other window is identical. (Its text "computed the removal at 166" is the ledger's mislabel; residue 1) |
| `solve-seedling-r9-campaign --check` | in the block | `975e2f48…` → **`83997b2c…`, exit 1**: window 5 re-solves to 403 t against the committed 558 (sum 10,880 vs 11,035; r8-solve-5's tape and trace DRIFT), and the free oracle breaks at window 6's `seam.time` (6,032 derived vs 6,187 declared). **STOP**: see the headline; the moved set is `r8-solve-5` + `r8-solve-6` and downstream |
| the other four `--check`s | in the block | `410f27c0 7cba9530 cef8048e 6cd35fe1`, exit 0, **identical** |

| Row | Command | Result |
|---|---|---|
| tapeRunner | `--reporter=json`, pair diff against W0 | **453/453**; the 449 W0 pairs identical, +4 (the differential and stepping rows of `f1-l5-lock-removal` and `f1-l5-open-lock-bait`) |
| tape index / roster | `generate-tape-index` | **196 → 198** |
| roster pins (added, not rewritten) | R8 `exposedAdded` + the three mirror lists (`r8Acceptance`, 41 → 43 exposed), `tapeEnvelope`, `observationTolerance` (incl. `swapped`), `dialogueAutoAdvance` (198, 197 inert), `watchManual` (the timed-declaration list gains `f1-l5-lock-removal`) | all green. `seedlingAtlasDoorCensus` and `tiers` needed no edit: the two witnesses fall in `mechanic`, and the categories partition 39 / 21 / 138 |
| `seedling-bot-log.md` | `### Seedling fidelity F1 — L5's bodies + the open-lock arrival (2026-10-02)` | after R5's entry, with three trap candidates |
| surface | `--write` then `--check` | **GREEN 191**: count drift only (the D2 reads of `chasers`, `armedArrowTraps`, `arrowVolleys`, `world.arrowTraps`, `ticksCompleted`); no new member |
| constants | `--profile-rows` → `--write` → `--check` | **PASS 4,947** (+10 `structural` indices in `arrowUpdateOrder`/`stepArrowTrapsNow`; 473 rows moved by line shifts) |
| profile / entities | `--check` (both tiers) | 138 / 518, PASS (no new key or leaf) |
| reference | `generate-procgen-reference.mjs`, `--check`, `check-procgen-docs.mjs` | regenerated (instruments 317 → 319, docs index) → **ALL 7 + 5 MATCH**; **ALL CHECKS PASSED** |
| the planners' import door | `check-procgen-help --in-place --only=<each>` | both `HELP ok · IMPORT ok` (their work is `main()`'s, behind the argv guard) |
| bounded vitest AFTER | the W0 set + `fidelityF1`, `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tiers`, `seedlingAtlasDoorCensus`, `rosterCategories`, `r5SwimCloseout`, `twoPassSolve`, `watchManual`, `jsRuntimeDeclarations` (read-only), `dangerMap`, `rerecordCampaign`, `procgenDocs/` | **35 files / 2,052: 2,050 green, 2 red, both explained**: the composite roster BANK row (residue 5) and `jsRuntimeDeclarations`' `declines: 0` pin in the JS arc's file (residue 3). A further named batch of 29 files that reach L4/L5 (director, combat, hazards, watch*, producerSegments, reachClosure, …) read 1,250 / 1,252, the same two reds plus `watchManual` (fixed in `cb84dbc`) |

## Surface, constants, profile and entity deltas

| Row | W0 | head | movers |
|---|---|---|---|
| solver surface | GREEN 191 | **GREEN 191** | site counts only |
| constants | PASS 4,937 | **PASS 4,947** | +10 structural (D1) |
| profile | 138 | **138**, both tiers | none |
| entities | 518 | **518** | none |
| tape index / tapeRunner | 196 / 449 | **198 / 453** | +2 witnesses × 2 rows |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** | instruments 317 → 319; docs index |
| bounded vitest | 13 / 1,115 | 35 / 2,052 (2 explained reds) | + `fidelityF1` (10) and the roster tests |

## What the brief got wrong (measured)

1. **D1's candidate causes (a)–(d).** None of them. The angle points, the arrow-before-bob order, the force and the pre-hit state all agreed at t53. The cause is the order **among the arrows**: two of one volley hit the bob on one tick, and the game lands the newer.
2. **"The game opens L5's kill lock (`{5,0}`) by about t422."** On `r8-solve-5`'s staging the game's last body leaves the world at t201, and the lock opens at t301 (t303 crossing on a walk that waits on it). R5's t424 crossing was its player ARRIVING at a lock that had been open for a hundred ticks.
3. **"`chaserKillLockOpens` says removal 326 + fade 101 = 427."** The ledger's `t` is the KILL tick (the die animation starts), not the removal, although its `why` text and `playthroughWalk.js`'s evidence row (`removedAt: 326`) call it the removal. The removal was ~t361 then and is t201 now.
4. **D2: "with the lock open the ladder still routes through the kill that OPENS it, then refuses the hold."** The kill is not the lock's. The kill-lock strategy is never reached; the corridor's live bobs send the ladder to the generic chaser kill-by-ceiling. The refusal was a positive control snapshotted after the approach. The group was [] in both arrivals, because the lock is `tset −1` and the button (t 0) arms only traps.
5. **D2: "the walk must survive them, which may itself be the real question."** Half right. The walk does survive (0 hits), but the KILL does not finish. The true wall is a body that walks out of the lane it was planned in.
6. **"Lock shut → solved 558 t."** True at `aabe6d6`; 403 t at head (D1).
7. **D1c's "if `r8-solve-5`'s INPUTS move".** They did not move here: no re-record. But the campaign producer's `--check` RE-SOLVES window 5 under the corrected model, and the solve itself moves (558 → 403 t). That reds the check without any input moving.
8. **Pins outside the bounded set.** The brief warned of three in the swim arc. Here two moved outside the W0 set (`watchManual`, and `jsRuntimeDeclarations` in the JS arc's file; see residue), plus one inside it that I had not re-run after D1 (`levelRun`'s pit row).
9. **My own predictions.**
   - m1 predicted 5 red and read 6: the crossing row sees the order too.
   - The D2 diagnosis's first wording said cover sheltered the body. The lanes say the body stands in no lane at all, and the text was corrected before commit.
   - The D2 oracle row first counted the probe's one unpolled tick (t433) as "no body"; the oracle now lists unsampled ticks.

## Residue

| # | item | refusal / pin (trimmed) | site |
|---|---|---|---|
| 1 | **The kill-lock ledger reads the kill, not the removal** (swim R5 item 3, now measurable) | none: `chaserKillLockOpens[].t` = the kill; `twoPassSolve` declares t + 101; the game opens at removal + 100 (`f1-l5-lock-removal`: 301 vs 267) | `levelRun.js` `assertChaserRemovalIsDeclared` (called at the kill); `twoPassSolve.js` |
| 2 | **`r8-solve-5` `{5,0}@427` / `r9-campaign`'s `{5,0}` row `removedAt: 326`**: model values the game contradicts (the bodies now die t124/127/166; the game's lock is ~t301 on that staging) | none. The re-record waits on item 1: a re-solve with today's ledger would declare 267, which the game refutes | `fixtures/tapes/r8-solve-5.json`; `playthroughWalk.js:~953-967`, `~1262` |
| 2b | **`solve-seedling-r9-campaign --check` exits 1** (window 5 re-solves to 403 t / `@267`; window 6's `seam.time` oracle breaks) | *"r8-solve-5 is byte-identical to what this solver derives — ⛔ DRIFT"*; *"the free oracle: r8-solve-6 declares seam.time 6187 — … = 6032"* | `scripts/procgen/solve-seedling-r9-campaign.mjs`; STOP, the user's call |
| 3 | **`jsRuntimeDeclarations.test.js` "L5: the solver KILLS from a live mid-room state …" reds**: `expect(s.declines).toBe(0)` reads **1**. The model change alone causes it (D1, with `solverBot.js` at its W0 bytes). With game-exact bodies the first attempt declines at the kill-lock dwell: *"… -> kill -> dwell (bob@48,80): the dwell's condition (bob@48,80 stands inside arrowtrap@64,48's lane …) never became true inside its 100-tick bound …"*. The S2 retry then solves and crosses (403 keys, lock open at t351). | the file is the JS arc's (`jsRuntime*`), so it is NOT edited. Proposed patch: `expect(s.declines).toBe(1)` with that reason, or the dwell's bait derivation re-asked against the real bodies | `jsRuntimeDeclarations.test.js:152`; `solverBot.js` kill-lock dwell |
| 4 | **The open-lock arrival still declines** (`BODY_OUT_OF_LANE`). A kill-by-ceiling planned from a snapshot lane does not follow a chaser that walks; the bait-first order is what walks it into column 3 | *"… NO armed lane covers it (it has walked out of [arrowtrap@32,48]) … OUT OF THE CEILING'S REACH (BODY_OUT_OF_LANE)"* | `solverBot.js` kill-by-ceiling arm; `deriveKillByCeiling` |
| 5 | **The composite roster row** (`rosterCategories.test.js`, "the LIVE row carries one part per derived category"): `mechanic` banked 136, the roster now 138 | a BANK row, moved only by `standing-values --write`, which this slice may not run | `scripts/procgen/rosterCategories.test.js:175` |
| 6 | **`check-procgen-help`'s import-door baseline is stale**: 25 instruments from the swim arc (planners and probes, U7 → R4) fail `IMPORT SIDE EFFECT` at `aabe6d6` and are not in the baseline. F1's two planners are guarded and pass | `27 CHECK(S) FAILED` before the guard, 25 after | `scripts/procgen/check-procgen-help.baseline.json` |
| 7 | **A polled game exits at t2019 of `r7-act2-full`** (`page.evaluate: ExitStatus`) under per-frame `botMobiles()` polling; the differential (no per-frame poll) is unaffected | none | the probe-side poll (scratch sampler and the u9 probe alike) |
| 8 | **The arrow order across traps** is transcribed from the AS3 (traps in reverse load order create their volleys first). The four moved tapes exercise only the within-volley order (two arrows of one volley on one body). No committed tape has two traps' arrows reach one body on one tick | none | `levelRun.arrowUpdateOrder` |

## Byte-inertia

| Artifact | W0 (`aabe6d6`) | head |
|---|---|---|
| identity log (every row, the six `--check`s, the reference) | md5 `771ff8baa769ff4e4d0940ffb24a0541` | md5 `9bba1d87…`: **identical except the two `--check` lines below** |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 975e2f48`, exit 0 | `410f27c0 7cba9530 cef8048e` **`dfa702ca`** `6cd35fe1` **`83997b2c` (exit 1)** |
| tapeRunner | 449 (name, status) pairs | **identical**, +4 new rows |
| model census, 196 tapes (per-tick player + bodies + arrows) | — | **192 identical**; 4 moved, every one now the game's |
| `fixtures/**` | — | **added only**: two tapes, two expectations, `f1-bodies-oracle.json`, the index. No committed tape or expectation moved; `campaign-frontier.json` untouched |

Untouched or not run: AS3, wasm, gitlinks, every committed tape and expectation, biome defaults, `campaign-frontier.json`, `standing-values --write`, `pytest`, the unfiltered vitest. The JS arc's files are untouched (one of their tests reds, residue 3).

**Scratch instruments** (session scratchpad and `test-results/f1/`, not committed): the per-tick game sampler (`game.mjs`), the model dump, the offline body comparator (`cmp.mjs`), the 196-tape census, the lock-witness prototype, the D2 repro and its tape builder, the pit stance sweep, and the game readouts of every tape named above.

## Rows the coordinator must BANK

**CI-read** (not measured here; ⚖ 52): the unfiltered vitest at the pushed SHA (`node scripts/procgen/ci-vitest-summary.mjs <sha>`), which will show residue 3 and 5 red; the differential's full tier, which now has 198 tapes (the two witnesses were recorded here headless).

**Box rows:**
- identity log md5 **`9bba1d879c314971ecbfed85c19173dd`** (only if the `r9-campaign` STOP is resolved by NOT re-recording; otherwise it moves again);
- `solve-seedling-r8-tail --check` **`dfa702cab58eede67c9dcd1fa2d1fbd6`** (exit 0, window 5's re-solve);
- `solve-seedling-r9-campaign --check` **`83997b2c…` exit 1**: NOT bankable as green. It is the STOP, and it is resolved only by the user's ruling on re-recording windows 5–6+;
- the composite roster row: `mechanic` 136 → **138** (`standing-values`), the roster 196 → **198**;
- tapeRunner **453**; constants **4,947**; instruments **319**; R8 exposure **43**;
- new fixtures: `f1-l5-lock-removal` (tape `902797a8…`, expectation `4f7e8f4b…`), `f1-l5-open-lock-bait` (tape `400b4ade…`, expectation `3368b676…`), `f1-bodies-oracle.json` (`3551e4af…`).
