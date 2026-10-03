# Seedling fidelity F5: L8's sandtrap death (F4) and the L18 spinner-ledger fix (F1c D2), with the windows and certifications they move re-recorded on the game

**Slice:** `seedling-fidelity-f5`, an Opus build slice run in the cloud for the Seedling model-fidelity arc (planner `seedling-fidelity-planning`). ⚖ The user, 2026-10-03: *"Merge F1 set now; F5 does both."* Every move below is inside the pre-licensed set and was recorded on the game.

What I did not touch:
- any JS-arc file (`jsRuntime*.js`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, the solver worker, `solveSegment`'s `prefix` admission). `fidelityF4` and F4's planner import `jsRuntimeCore`/`wasmArrival` read-only, as before;
- F6's regions (`levelWorld.js`'s persistence/build tables, `activators.js`);
- any AS3, the wasm, a gitlink, a biome default, `campaign-frontier.json`;
- `standing-values --write`, `pytest`, the unfiltered vitest.

No signature or contract of `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging` moved. D1 changed one VALUE in each of two functions: the spinner ledger's stamp in `levelRun`, and the spinner arm's declared `at`/`fade` in `solverBot`. `git stash` was not used. Every mutant was a copy and restore, md5-checked.

| | |
|---|---|
| Base | `origin/fidelity-harvest/f1-joint` @ **`696ca02`**: F1 + F1b + F1c on main `aa85b29a8d`, plus the JS arc's F1-joint pin commit |
| F4 cherry-picks | `829188b` → **`be2074f`** (D1), `09dddf6` → **`08c73a6`** (D2), `9fd21f4` → **`15ac7d7`** (records). `2b4216a` (the constants-row fix) came out **empty**: regenerating the constants on the merged tree already put those rows where it put them, so it was skipped (`git cherry-pick --skip`). The report commit `cfdc309` was not picked |
| F5 commits | D1 **`3303173`** · D2 `0ab69ad` (r8-solve-18 + r8-d2) · `d93ed0f` (the campaign chain) · `96a1cb6` (witness planners) · D3 records **`55051b3`** · this report |
| Head | this report's commit, on top of `55051b3` |
| Harness branch | **`claude/seedling-fidelity-f5-ozh3nx`**. The harness pins it, not `seedling-fidelity-f5`; it was reset onto `696ca02` first |
| Dev server | `scripts/serve-nocache.py 9170` (`SEEDLING_PORT=9170`, build `seedling_bot_ap_p4e`, headless logic-only). The bare base ran in a scratch worktree on `9171` |

**Cherry-pick conflicts, resolved:**
- the four roster pins (`dialogueAutoAdvance`, `observationTolerance`, `tapeEnvelope`, `watchManual`): unions, 200 + 1 → 201;
- `levelRun.js`: F1's `arrowUpdateOrder` and F4's `stepStaticBodiesNow` are both kept, side by side;
- the build log: both entries kept;
- generated files (`index.json`, surface, constants, reference): regenerated. The surface left F4's `STATIC_ARROW_DEATH` row UNCLASSIFIED after regeneration, so I copied F4's class/form/why into it verbatim. Surface `--check` GREEN 193.

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | After the cherry-pick, every identity row equals F1c's bank except `r9-campaign --check` **`f2866aec…` exit 1**. Its two failures are both `r8-solve-8` (tape and trace DRIFT): F4's STOP, reproduced. The bare base reads F1c's bank, campaign `9168796b` exit 0. tapeRunner 459/459; roster 201; bounded vitest 24 files / 1,344 tests, with the 2 expected reds |
| D1 | **PASS** (game-witnessed) | The spinner ledger now stamps the alpha-zero step (`removedAt = ticksCompleted`), and the arm declares the v9 spelling (`last.t + fade − 1`). On `f1c-l18-lock-removal` the ledger reads **316**, and 316 + 100 = the game-sourced **416**; the model crosses on **t444**, the game's tick. Mutant (the old stamp): 2 red as predicted (`[445]` vs `[444]`; `416` vs `417`) |
| D2 | **PASS** | Every predicted mover moved as predicted; nothing else moved. `r8-solve-18` 522 → **520 t `@420`**; `r8-d2` 1828 → **1826**; `r8-d2-19`/`-20` boot-only; window 8 drops its two sandtrap declarations (827 t, keys part at **t247**); window 19 512 → **510 t `@450`**; windows 20–30 boot-only. The chain is 30 windows, **10,937 → 10,935 t**. Whole-chain differential exit 0 (879 PASS / 0 FAIL, 30/30). **All six `--check`s exit 0.** Every certification row lands on F1c's measured value |
| D3 | **PASS** | tapeRunner 459/459 with pairs identical to W0. Surface GREEN 193; constants PASS 4,954; reference ALL 7 + 5 MATCH; `derive-seedling-tick0 --check` ALL CHECKS PASSED. Bounded vitest 48 files / 2,767 tests, with only the 2 expected reds |

**The one thing to know first.** F4 + F1c D2 are landed, and the chain is green on the game: every `--check` exits 0, and so does `derive-seedling-tick0 --check` (its two stale `r8-d2-19`/`-20` blocks were re-derived because their boots moved). One witness was **not** re-cut: `f1c-l18-phase42` (F1c's game witness of the residue-42 solve). Under the fixed ledger its planner re-solves to window 19's new walk key for key (510 t `@450`), but no licence covers a witness tape. So `plan-seedling-f1c-l18-phase --check` reads DRIFT (residue 1). Re-cutting it is a one-command move plus a `--record`, and it needs the user's word.

## W0

**After the cherry-pick (`15ac7d7`)**, at `SEEDLING_PORT=9170 bash scripts/procgen/identity-block.sh .` (venv active):

| row | value |
|---|---|
| maze · acceptance · c3 · c6 · c4 | `246dfbce…` · `e417212b…` · `cc5f3204…` · `573709cf…` · `b11d9564…` |
| ENEMY · guard · AREA | `a20bcbe8…` · `a6d18d49…` · `02b22525…` |
| killgate s2/s5/s9 · level pre/post s1 · generated set | `63d34807…`/`fb207b8e…`/`bfbdfb38…` · `e28c1e5d…`/`c4841acb…` · OK |
| six `--check`s | battery `410f27c0` · d2-chain `7cba9530` · l18 `cef8048e` · tail `48d52d83` · r9-l3 `6cd35fe1`, all exit 0 · **campaign `f2866aece64232d213078ed14f66f3a8` exit 1** |
| reference | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| log md5 | **`89969544e33c85ba3110a8d3deb8e318`** |

The campaign `--check` output reads `FAIL: r8-solve-8 is byte-identical …— ⛔ DRIFT` and `FAIL: r8-solve-8 trace …— ⛔ DRIFT` (`2 FAILURE(S)`), as F4 predicted.

**The bare base (`696ca02`)**, in a scratch detached worktree whose `node_modules` and three submodules were symlinks to the primary's: every row equals the head's above, except:
- campaign **`9168796be43f3288cf4b7bfa7ba87aec` exit 0** (= F1c's bank);
- the reference row, which read `4 GENERATED MODULE(S)/REGION(S) DIFFER` there. That is an artifact of the worktree, not of the base. The four regions are the substrate registry/capability ones, which read substrates through the symlinked `shared` submodule; the docs and instruments rows matched.

Log md5 `02d9a2f546dc9ed89baab305799f7715` (not a bankable row, because of the reference line).

| other W0 row | value |
|---|---|
| tapeRunner | **459/459**; sorted (fullName, status) pairs md5 **`b69c7a0ffdcd07e49da18bae6fafb0e1`** |
| roster | `fixtures/tapes/index.json`: **201** |
| bounded vitest BEFORE | `fidelityF1`, `fidelityF1b`, `fidelityF1c`, `fidelityF2`, `fidelityF4`, `solverBot`, `solverSpinnerKill`, `spinner`, `levelRun`, `enemyDamage`, `levelWorld`, `twoPassSolve`, `tapeRunner`, `campaignChain`, `rerecordCampaign`, `playthroughAcceptance`, `r8Acceptance`, `jsRuntimeDeclarations`, `jsRuntimeSolver` (read-only), `boxLock`, `lintGateLabels`, `rosterCategories`, `seedlingSolverSurface`, `seedlingConstantsCensus`: **24 files / 1,344 tests, 1,342 green, 2 red, both expected**. `rosterCategories:175` (`expected 136 to be 141`, the bank row) and `jsRuntimeDeclarations:242` (`expected +0 to be 1`, F4's L8 pin) |

## D1: the spinner ledger stamps the alpha-zero step (`3303173`)

**The edits** (F1c D2's, as measured there):
- `levelRun.assertSpinnerRemovalIsDeclared`: `const removedAt = ticksCompleted`, used for the ledger row's `t` (the nil row and the main row), and for the pending throw's `at` (`killLockClearTick(removedAt, …)`) and `removedAt`. `spinnerWrites` (the body's own `removed()` write) keeps `ticksCompleted + 1`: that write happens on the step the body leaves.
- `solverBot.execKillByPress`'s tail: `declaredFade = fade − 1`, `at: last.t + declaredFade`, `fade: declaredFade`. The message and the `why` now say "in the v9 `at` spelling", which is the chaser arm's wording. So a tape's note reads *"… is 101, which a declared v9 row spells 100"*.
- The producer label rows: `solve-seedling-r8-l18`'s `{18,0}` row asserted `opens[0].t + 101`. It now asserts `+ V9_FADE`, read as `opensOnTick(RESPONDERS.lock.fade) − 1`, with the title and the tape description re-spelled. `solve-seedling-r8-d2-chain` had one comment ("101-step fade"), now re-spelled.

**Witnesses:**

| witness | before (F1c) | after |
|---|---|---|
| `f1c-l18-lock-removal`: the ledger's removal | 317 | **316** |
| the ledger's removal + v9 fade | 417 (crosses t445) | **416 = the tape's game-sourced `at`, crosses t444 = the game** |
| `r9-solve-18`'s staging, at the committed residue 42 | 512 t `@452` | **510 t `@450`** (removal 350; the same 8-tick hold: corner seen t234 for t249, from t238, phase 31) |
| the same staging at residue 17 (F1c's pre-D3 clock) | — | 453 t `@416` (removal 316): the number F1c quoted |

The `fidelityF1c` D2 rows flipped from *"the model's readings are REFUTED"* to the F5 truth:
- the ledger's own removal spelled v9 crosses when the game did, and the old stamp's readings cross one and two ticks late;
- `GAME_AT === removal + V9_FADE`;
- **a new row**: the solver, asked the chain-window staging, declares exactly `ledger removal + V9_FADE`.

`fidelityF1c` 11/11.

**Mutant m2** (the old stamp, `removedAt = ticksCompleted + 1`). Predicted: the two F5 game-equality rows red, and the solver-spelling row and the game-sourced replay row green. **Measured exactly that:** `expected [ 445 ] to deeply equal [ 444 ]` and `expected 416 to be 417`; 2 red / 2 green (7 skipped by `-t D2`). Restored md5-identical (`1683a347…`).

## D2: the re-record

**Prediction** (written to the scratchpad before any producer write) against **measured**:

| tape / window | predicted | measured | recording |
|---|---|---|---|
| `r8-solve-18` | 522 → 520 t, `{18,0}@420` (320 + 100) | **520 t `@420`** (removal 320; keys equal the old walk through t420, part at t421) | `--record`: 521 obs, the model reproduces it; **moved** |
| `r8-d2` headline | first 520 t = `r8-solve-18`; 2 t shorter | **1826 t** (was 1828), `@420`; *"the headline's first 520 ticks ARE r8-solve-18's walk, key for key"* | moved |
| `r8-d2-19` / `-20` | boot only (`seam.time` −2); walks unchanged | **`seam.time` 9128 → 9126 / 10044 → 10042**, nothing else; `tick0` re-derived (delta −14 → **21**) | re-recorded **byte-identical** (`300568c5…`, `d78fd88c…`) |
| window 8 `r8-solve-8` | 827 t, no `{8,0}`/`{8,1}` timed rows, keys part at t247 | **827 t, the two timed rows gone, first key difference t247**, the same calm L9 arrival | moved; on the game *"sandtrap@96,80 -> 8:0 (removed t248, earned), sandtrap@96,128 -> 8:1 (removed t648, earned)"*. The new recording is **`94cc6266…`, byte-identical to F4's `f4-l8-sandtraps` game witness**, the same keys (F4: *"the uncleared solve IS the recorded game witness, key for key"*) |
| window 9 `r8-solve-9` | possibly `rng.cosmetic` | **untouched** (the latch did not move) | — |
| window 19 `r9-solve-18` | 512 → 510 t `@450` | **510 t `@450`**, keys part at t451 | moved |
| windows 20–30 (`r9-solve-19`, `-20`, `-13-v2`, `-0-v3`, `-12`, `-21`, `-22`, `-29`, `-31`, `-30`, `-32`) | boot only (`seam.time` −2) | **`seam.time` −2 on each, nothing else**; `tick0` re-derived (delta 21 on all 11) | 11/11 re-recorded **byte-identical** |
| windows 1–7, 9–18 | unmoved | **byte-identical** (tapes, traces, expectations) | — |

**The machinery, in order** (all headless on `9170`):
1. `solve-seedling-r8-l18`, then `--record --only=r8-solve-18`.
2. `solve-seedling-r8-d2-chain`, then `--record --only=r8-d2,r8-d2-19,r8-d2-20`, then `derive-seedling-tick0 --only=r8-d2-19,r8-d2-20`.
3. `solve-seedling-r9-campaign`. Its two write-time FAILs are the "solved length = committed length" rows, which window 19's predicted 512 → 510 trips before the write lands; they read green on the `--check` after it.
4. `--record --only=` the 13 movers: 13 RECORDED, 13 *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"*.
5. `derive-seedling-tick0 --only=` the 11 boot movers.
6. The whole-chain differential, over all 30 windows with no `--record`: **exit 0, 879 PASS, 0 FAIL, 30/30 "live game matches the committed oracle stream", `endsAt` 10935**.

The `rerecord-seedling-campaign` S0–S5 pipeline was not used; this is F1c's sequence.

**Provenance rows** (`playthroughWalk.js`; the differential reds on them by name until they match):
- `r8-d2`'s `{18,0}`: `removedAt` 321 → **320**, `fade` 101 → **100**.
- The campaign's `{18,0}`: 351 → **350**, 101 → **100**.
- `r8-battery-8`'s and the campaign's two L8 `game` rows (`carriesAt` 246/645) are **retired**. No tape declares those clears now, so half 2 of the witnessed-clear law named them (*"names a clear a TAPE declares — NO tape in this chain declares that clear"*).

**Bounds:**
- The chain walks all 30 route steps. `census-seedling-campaign`: *"30 of 30 window(s) stepped, 29 boundary(ies) admitted — end L30 (224,80), 10935 ticks … NO CHAIN ROOM MOVES"*.
- The frontier: `census-seedling-campaign --check-frontier` gives 4 PASS / 0 FAIL, with the same SKIP as F1c (the survey files are not on disk; a SKIP is not a pass). `campaign-frontier.json` is not rewritten, and it reads `"complete": true`.
- 0 hits in every window (the differential's own ZERO-hits rows).
- **Windows/ticks: 30 / 10,937 → 30 / 10,935.**

**The six `--check`s at head** (the identity block's pipe form):

| producer | W0 (after cherry-pick) | head |
|---|---|---|
| r8-battery | `410f27c0…` exit 0 | **`410f27c077b1ee854a14c24b73dc6335` exit 0** (unmoved) |
| r8-d2-chain | `7cba9530…` exit 0 | **`8e7a43be0509882d753f54155ef284c2` exit 0** |
| r8-l18 | `cef8048e…` exit 0 | **`33d20889ebd8c72452ce7262bce9505b` exit 0** |
| r8-tail | `48d52d83…` exit 0 | **`35456fbc07e7151ddbc4c2a1fd00c789` exit 0**: one line, `stripped 2 committed timed clear(s): [{8,0}@246, {8,1}@645]` → `stripped 0 … [none]` |
| r9-l3 | `6cd35fe1…` exit 0 | **`6cd35fe1414af6bf5beb7605f235cb8e` exit 0** (unmoved) |
| r9-campaign | `f2866aec…` **exit 1** | **`cff0f8815d4451a2e3eaa92a04cbc7f3` exit 0** |

**The generated certification rows** (BANK rows; the coordinator records them). Each was re-derived by its own producer as the identity block runs it:

| row | before (W0) | after | F1c's measured prediction |
|---|---|---|---|
| acceptance batch | `e417212bc51fd8d30059b537b9eb56ee` | **`608693d23fc3d4c67d0e7091e2859ab8`** | `608693d2` ✔ |
| empty pairs c3 | `cc5f32040875c5ad6034369c10e75c28` | **`05c5ef94a5f10b2dbfb3fa71ab24b62b`** | `05c5ef94` ✔ |
| empty pairs c6 | `573709cf0f18fcf7ae8c8c8703e3eed2` | **`e88baf9d27dfb8597b3b014c6c738561`** | `e88baf9d` ✔ |
| carved pairs c4 | `b11d95646df58ba016ed1681e06cb0bf` | **`f8cba3a8f889b4475e8720d676238604`** | `f8cba3a8` ✔ |
| ENEMY census | `a20bcbe8eaf7650f1dcc06f5ea4678c3` | **`1d7bd8cc20838b2037ba5ce79012afa4`** | `1d7bd8cc` ✔ |
| killgate s2 | `63d348078c4bee62da7b0146903b882c` | **`01210c82d8281377ddfce65cea0d4d19`** | `01210c82` ✔ |
| killgate s5 | `fb207b8efffd2315739ed68757dbb714` | **`07ce222a79389bcf47e7e62fb84271ea`** | `07ce222a` ✔ |
| killgate s9 | `bfbdfb385dfe32606d99aff9dc66f73e` | **`30a1e3e732f543aebffd5286a66d1666`** | `30a1e3e7` ✔ |

**Stayed byte-identical:**
- identity rows: maze, guard, AREA, level pre/post-sword s1, the generated set, r8-battery and r9-l3 `--check`;
- tapes: every committed tape except the 17 moved (`r8-solve-18`, `r8-d2`, `-19`, `-20`, and 13 chain windows);
- expectations: every one except `r8-solve-18`, `r8-d2`, `r8-solve-8` and `r9-solve-18`. The 13 other re-recordings came out byte-identical;
- traces: every one except those same four plus `r8-d2-19`/`-20`'s, which were re-emitted byte-identical;
- the three witness tapes (`f1c-l18-lock-removal`, `f1c-l18-phase42`, `f4-l8-sandtraps`).

**`r7-act2-full`'s declared sandtrap rows** (licensed only if its gates red): **not moved**. Its tapeRunner rows, its `fidelityF4` row (`2383/2515`, `2905/3067`) and the fold rows are green.

**The witness planners** (`96a1cb6`):

| planner | at head before the fix | cause | what I did | `--check` now |
|---|---|---|---|---|
| `plan-seedling-f4-l8-sandtraps` | DRIFT (`rng`, `seam`, `tick0`) | it read `r8-solve-8` live. F4 was cut before F1c, whose chain re-record moved that boot (−155, `rng.cosmetic`). So this drift existed at the cherry-pick head, independent of F5 | `r8-solve-8` as F4 read it (at `5c4ea0eec2`) is kept as `fixtures/witness-bases/r8-solve-8.f4.json` (`e590eafe…`, F1c's pattern), and the planner reads it | **byte-identical**, all checks green |
| `plan-seedling-f1c-l18-lock` | 2 FAIL (its "REFUTED" and "removal − 1" label rows) + DRIFT (description/note words) | D1 moved the ledger 317 → 316 | the checks now state the F5 truth (`316 + 100 = 416`). The tape's words stay F1c's measurement in F1c's ledger: the planner prints them from `F1C_STAMP = removal + 1` and says so | **byte-identical**, all checks green |
| `plan-seedling-f1c-l18-phase` | DRIFT | the residue-42 solve is now 510 t `@450` | **not re-cut** (no licence for a witness tape). Measured: its re-cut's `inputs` equal the re-recorded window 19's exactly, and it declares `@450`. `fidelityF1c`'s witness row now pins *"the same keys through the window's declared tick, then the witness waits out its F1c-era `@452`"* | **DRIFT, residue 1** |
| `plan-seedling-f1-l5-lock`, `-open-lock`, `-u14-moonrock`, `-u15-turret` | — | — | — | green |
| `plan-seedling-r9-l0-sword-dash` | 2 FAIL | pre-existing: the identical 2 FAIL at the bare base | not touched | 2 FAIL (residue 4) |
| `check-seedling-producer-boundaries` | — | — | — | ALL PASS, **28 verified**, 4 REFUSED-UNVERIFIED (no cached latch; not claimed green) |

## The JS arc's pins at my head

| pin | file:line | expects | **reads** | why |
|---|---|---|---|---|
| "L8: the solver's PendingDeclaration (source game) → declined NAMING the missing oracle" | `jsRuntimeDeclarations.test.js:242` | `s.declines` **1** | **0** | F4's: the solver computes the sandtraps' death and no longer declines L8. F4's report gives the full readout and the proposed patch (invert the row: `solves 1, declines 0`, `state: done`, crossing 8 → 9). D1 does not reach it |
| L5's first kill-lock attempt (the F1-joint re-aim) | `jsRuntimeDeclarations.test.js:155` | `declines` 1 | **1** ✔ | unmoved |
| every other row in `jsRuntimeDeclarations` and `jsRuntimeSolver` | — | — | green | D1 moves no L5/L8 JS-page reading; no JS-page row exercises L18's kill lock |

I edited neither file.

## The wasm gates that cite the chain

`check-seedling-wasm-ship` and `-pages` boot `r8-solve-4`, which is **unmoved**. The "chain tick 1056 = tick 326 of window 5" passages (`check-seedling-wasm-ship.mjs:~1008`, `~1890`) are **docblocks**, history only. `runChainArm` derives every number it asserts from the tapes: `TICKS`, `TICK_TOTAL`, the dead-frame shares (`deadFrameSharesOf`, which rebases each window's timed rows by its offset) and the end state. Window 8's two fewer timed rows and window 19's `@450` flow through without a typed value. **No assertion in either gate moves.** I did not run them (they need the real-GPU page).

## Deltas

| Row | W0 (after cherry-pick) | head | movers |
|---|---|---|---|
| identity log | `89969544e33c85ba3110a8d3deb8e318` | **`1a621f0e31241c42ac2b4a3e4a32f766`** | `diff`: exactly the 8 certification rows + 4 `--check`s (above); every other row, reference included, identical |
| chain | 30 windows, 10,937 t | **30 windows, 10,935 t** | windows 8 (inputs), 19 (−2 t); 20–30 boot |
| tapeRunner | 459/459, pairs `b69c7a0f…` | **459/459, pairs `b69c7a0f…` identical** | none |
| roster | 201 | **201** | none (no tape added or removed) |
| solver surface | GREEN 193 | **GREEN 193** (`--write` → `--check`) | line numbers only |
| constants | PASS 4,958 | **PASS 4,954** (`--profile-rows` → `--write` → `--check`; 0 new, 0 vanished cosmetic/structural, 0 moved) | −4, all `levelRun.js`: the four `ticksCompleted + 1` literals the spinner ledger dropped |
| profile rows | 138 | 138 | — |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** | docs index (the log entry), the campaign-chain region (10,935) |
| `derive-seedling-tick0 --check` | 2 FAIL (`r8-d2-19`/`-20`, delta −14) | **ALL CHECKS PASSED** (103 PASS) | the two re-derived with their licensed boots |
| bounded vitest | 24 files / 1,344, 2 red | **48 files / 2,767, 2 red, the same two** | — |

**Bounded vitest AFTER**: the W0 set plus every test I touched or whose words I re-spelled (`procgenScratchPersistence`, `director`, `watchManual`, `seedlingSwapGate`, `watchOverlays`, `ciGatePlan`, `tapeIndexManifest`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `procgenKillGateDemand`, `r7Acceptance`, `botDriverV2`, `spinnerClockPairing`, `tiers`, `ulpDash`, `procgenDocs/*`). That is **48 files / 2,767 tests: 2,765 green**. The 2 reds are `rosterCategories:175` (`expected 136 to be 141`, the bank row) and `jsRuntimeDeclarations:242` (above). `lintGateLabels` and `boxLock` are green.

**Pins this slice re-pinned** (`55051b3`), each at its cause:
- `fidelityF4`: `r8-solve-8`'s deaths read `earned` at 248/648 with no declaration.
- `playthroughAcceptance`: staged chains with clears 3 → 2 (`r8-battery-8` left); the non-vacuity probe trades `carriesAt` for `fade`.
- `procgenScratchPersistence`: the generated spinner room's removal 145 → **144**, the clear 246 → 245, the v9 `declaredAt` 244. The same walk, a stamp one tick earlier: that is D1 reaching generated levels.
- `watchManual`: `r8-solve-8` leaves the timed-declaration list, and the L8 family's fold witness is now `f4-l8-sandtraps`.

**Label words grepped** (`rg -a --glob '*.test.*'` over `frontend` and `scripts`): `removal + 101`, `101-step`, `REFUTED`, `CHASER convention`, `plus the \`Lock\`'s own fade`, `so the tick is`, `+ 101`, `carriesAt`, and the moved numbers 246, 645, 10,937, 1828, 522, 512, 452, 422. No test pins a re-spelled producer label. Every hit was either the pins above or unrelated, and the AFTER run is green apart from the 2 expected reds.

## What the brief got wrong (measured)

1. **"Chain window 19 (`r9-solve-18`) → 453 t `@416`."** That is the residue-17 staging, F1c's pre-D3 clock. The committed window sits at residue 42, and there it re-solves to **510 t `@450`** (removal 350), keeping its 8-tick hammer-phase hold. F1c measured 453 before its own D3 moved the clock.
2. **"`r8-d2-19`/`-20` and whatever chains from their latches"**: nothing chained. Both are boot-only (`seam.time` −2), and their walks and recordings are byte-identical. Their `tick0` blocks, stale since before F1c, were re-derived with the boots, so `derive-seedling-tick0 --check` is green for the first time since at least U13.
3. **"Every other chain window is boot-only"**: window 9's boot did not move at all. Window 8's new walk ends on the same tick at the same calm latch.
4. **The F4 cherry-pick is not only F4.** F4 was cut before F1c's chain re-record, so `plan-seedling-f4-l8-sandtraps --check` drifted at the cherry-pick head, before any F5 edit (its base `r8-solve-8` had moved). Its 4th commit (`2b4216a`) is empty on the merged tree.
5. **The licence list omits the witnesses a fix re-cuts.** F1c's two L18 witnesses are cut from `r9-solve-18`'s staging. D1 moves the lock witness's words (not its `at`) and the phase witness's walk. The lock planner was made byte-stable; the phase witness is residue 1.
6. **The provenance rows** (`playthroughWalk.js`) are not in the brief's list, and the differential refuses without them: the L18 rows move to 320/350 + 100, and two L8 `game` rows retire with `r8-solve-8`'s declarations.
7. **"`r8-solve-18` 522 → 520 t, declared 420"** and every certification md5 F1c listed: **exact**.

## Residue

| # | item | site |
|---|---|---|
| 1 | **`f1c-l18-phase42` not re-cut**: `plan-seedling-f1c-l18-phase --check` DRIFT. Its re-cut is window 19's re-recorded walk key for key (510 t `@450`); the committed witness (512 t `@452`, game-recorded twice at F1c) still replays and passes tapeRunner. Re-cutting needs the user's licence: the planner without `--check`, then `--record --only=f1c-l18-phase42` | `fixtures/tapes/f1c-l18-phase42.json` |
| 2 | **`jsRuntimeDeclarations.test.js:242`** reads `declines` 0 (expects 1): F4's L8 pin. The JS arc's | the JS arc |
| 3 | **The composite roster bank row** (`rosterCategories:175`) reads 141 (expects 136): `standing-values --write` only | the coordinator's bank |
| 4 | **`plan-seedling-r9-l0-sword-dash --check`**: 2 FAIL, identical at the bare base (F1c's residue 7) | not touched |
| 5 | **`r7-act2-full`'s `{8,0}@2515`/`{8,1}@3067`** still disagree with the game's removals (2383/2905), F4's residue 4. No gate reds, so they were not moved | the tape |
| 6 | **F4's `fixtures/f4-sandtraps-oracle.json` `r8-solve-8` rows** were sampled on the pre-F5 walk, which is identical through t247. The model's rows on the new walk still equal them on every sampled tick (`fidelityF4` green), and the new walk's own deaths are game-checked (*"removed t248, earned"*). Re-sampling would make the oracle exact | the oracle |
| 7 | **The full tier owes a drive**: 17 tapes moved (4 walks re-recorded, 13 boot-only or byte-identical re-recordings) | CI |
| 8 | **The pre-F5 `r9-solve-18` is not kept in `witness-bases/`.** The phase planner reads F1b's copy, so nothing needs it; noted in case residue 1 is re-cut against a different base | — |

## Byte-inertia

| Artifact | W0 (after cherry-pick) | head |
|---|---|---|
| identity log | `89969544e33c85ba3110a8d3deb8e318` | `1a621f0e31241c42ac2b4a3e4a32f766`: identical except the 8 certification rows and 4 `--check`s |
| six `--check`s | `410f27c0 7cba9530 cef8048e 48d52d83 6cd35fe1 f2866aec(1)` | `410f27c0` **`8e7a43be` `33d20889` `35456fbc`** `6cd35fe1` **`cff0f881`(0)** |
| committed tapes | — | **17 moved**: walks of `r8-solve-18`, `r8-d2`, `r8-solve-8`, `r9-solve-18`; boots of `r8-d2-19`/`-20` and windows 20–30 (`seam.time`, `tick0`). No tape added or removed |
| expectations | — | 4 moved (`r8-solve-18`, `r8-d2`, `r8-solve-8`, `r9-solve-18`); 13 re-recorded byte-identical |
| traces | — | 4 moved (the same four) |
| other fixtures | — | `witness-bases/r8-solve-8.f4.json` **added** (byte-identical to `5c4ea0eec2`'s `r8-solve-8`); `index.json` regenerated (201); `campaign-frontier.json` untouched; every witness tape untouched |

**Scratch** (session scratchpad, not committed): the prediction file, both W0 identity logs, every producer/record/tick-0/differential/census log, the vitest JSONs, the base worktree `/home/user/f5-base` (detached, removed at the end).

## Rows the coordinator must BANK

**CI-read** (not measured here; ⚖ 52):
- the unfiltered vitest at the pushed SHA (`node scripts/procgen/ci-vitest-summary.mjs <sha>`), which should show residues 2 and 3 red and nothing else I know of;
- the differential's full tier: 201 tapes, 17 moved, all recorded here headless.

**Box rows:**
- identity log md5 **`1a621f0e31241c42ac2b4a3e4a32f766`**;
- six `--check`s **`410f27c077b1ee854a14c24b73dc6335` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `cff0f8815d4451a2e3eaa92a04cbc7f3`**, all exit 0;
- acceptance `608693d2…` · c3 `05c5ef94…` · c6 `e88baf9d…` · c4 `f8cba3a8…` · ENEMY `1d7bd8cc…` · killgate s2/s5/s9 `01210c82…`/`07ce222a…`/`30a1e3e7…` (full md5s in D2);
- the chain: **30 windows, 10,935 t**;
- tapeRunner **459**; roster **201**; surface **193**; constants **4,954**; `derive-seedling-tick0 --check` **green**;
- moved recordings: `r8-solve-18` `901a87da…`, `r8-d2` `1fe59312…`, `r8-solve-8` `94cc6266…`, `r9-solve-18` `98dfae19…`; new fixture `witness-bases/r8-solve-8.f4.json` `e590eafe…`.
