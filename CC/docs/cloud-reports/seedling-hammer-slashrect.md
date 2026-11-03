# Seedling hammer-phase SLASHRECT — a press with no facing refuses by name; `PRESS_NO_FACING` (OFF) does not plan it

Slice `seedling-hammer-slashrect` (Opus, cloud). Planner: `seedling-hammer-phase-planning-2`. ⚖ Queued by the user
2026-10-31, one of four parallel hammer slices (SOUTHDOOR, SLASHRECT, GHOSTROPE, AXIS). No scope message reached this
session mid-run.

## 1. Branch and SHAs

| | |
|---|---|
| Branch | `claude/seedling-hammer-slashrect-145ovy` |
| Start (base) | `8440451386` (`origin/main`, "train: depgraph-determinism 334dd82370") |
| W0 | `aab12d44` (repro tooling, base census 1–12) |
| I | `399b7b83` (`pressNoFacing.js`, the guard, the switch, the rows, the fixture), `1050941b` (imports through the solver door; surface census rows), `1afe5bf1` (the `progressKind` table: JSUT's one red) |
| D | `f0a05103` (seedling-bot.md, reference, mutants, base census), `5d2c1860` (identity, bounded, producers, the log), `ee5c55a3` / `a7652915` (reference and docs index after the log entry), `3b75d1f9` (wasm-ship), `697f91ec` (the log's ON radius), `de4db972` (JSUT summary) |
| Head | the commit that adds this report (the last on the branch) |

## 2. The answer first

**The one thing to know first:** the `-1` is not a solver bug in the facing. It is the GAME's facing for one tick.
`Player.update` runs `slash()` → `super.update()` → `sprites()` → `hitUpdate()`, and on the tick the i-frames run out
`hitUpdate` writes `direction = directionFace` (`Player.as:1424`), which is `-1` when no knockback parked a facing (a
`hit(null, …)`: lava, every projectile, every trap). A press on the NEXT tick latches `slashDirection = -1`, and
`getSlashRect`'s `default:` arm returns an all-zero `Rectangle`: a whiff at the world origin. `playerDamage.stepPlayerDamage`
transcribes this exactly. The solver's defect is that it PLANNED a press on that tick, and its press forecast has no
arm for the whiff (by design `presses.slashRect` throws), so the solve crashed instead of refusing.

| Question | Answer (measured) |
|---|---|
| Why was the facing -1? | The press kill (`execKillByPress` → `aimAdmitted`) aimed `left` at t100 from lava (caldera items: no dark suit), and t100 was the recovery tick of the lava hit's i-frames. Its escape check (`pressEscape` → `pressEscapeOnce`) previewed the aim tick and read `st.direction = -1` (state at t101: in lava, drowning; the previous facing was 2), then asked `levelRun.spinnerForecastWithPress` for a press at t101 with direction -1; the forecast's sword test (`forecastSwordTest`) called `presses.slashRect(40.09, 88.26, -1)` → `PressError`. Body `spinner@16,32`, leg = the oracle's certification solve of step 5 try 4 (`melt-patch(w=1,h=2)` at (2,4)), goal `collect (64,48)`. |
| Does seed 7 solve or refuse by name after the fix? | **The level generates** (`TARGET_REACHED`, record `a659f54e779dd408`). The captured solve request **REFUSES by name**: at the defaults `PRESS_NO_FACING: the press at t101 (escape) starts with facing -1 …` (always-on part); with the switch ON the aim waits a tick and the solve meets the kill's own existing refusal (`… kill (spinner@16,32) by press: every key set … There is no step out`), which is what this lava-bound player really faces. Either way the candidate is REFUSED and the generator walks on; the generated level is the same OFF and ON. With `SEEDLING_CHOOSER_PAIR=1 SEEDLING_CHOOSER_PAIR_SIZE=3` the two answers are unchanged (`cpair3-seed7.txt`). |
| Other throws of this family? | **None measured.** A census of **548 generated levels** at the base (every biome, `empty`, 8 obstacles: seeds 1–40 of the twelve shipped biomes, `caldera-cf` 1–60) found exactly ONE direction-out-of-range throw: `caldera-cf` seed 7. Source read: the only press sites that ask a forecast with a facing that can be -1 are `pressEscapeOnce` (this one) and `deriveFight`'s `pressFrom` (same aim→press shape, `HAMMER_FIGHT` OFF); both are now guarded. `deriveApproach`'s probe and `landsClearInFlight` pass `run.state.direction` but put `pressAt` past their rows, so their press never fires. The live run's own press (`levelRun.js:6691`, `pressFacing`) would throw the same way, so the switch ON never presses there. The lab's `firstThrow` rows in `seedling-profile-witnesses-full.json` (`direction 4`, `3.0000000000000004`, `5e-324`, …) are a profile-perturbation fuzzer's, not a solver path. |

**Before → after:** the caldera counterfactual seed 7 aborted on `PressError` → it generates; 0 movers anywhere else.

## 3. W0 — base and repro

- Identity at base (`identity-before.txt`, a detached worktree at `8440451386` on :8001): every row equals the published
  values (maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard
  `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, the six producer
  `--check`s exit 0, r9 campaign `be9c19c8`). Its generated-set row lost the box lock to the AFTER run (both ran at
  once); re-run alone it is `OK` (`identity-before-generated-set-rerun.txt`). Its reference row read "4 differ" in the
  worktree (symlinked submodules); the AFTER tree's reads ALL MATCH.
- The repro (`repro-caldera-cf.mjs`): `generateSeedlingLevel({seed, palette: {...CALDERA_PALETTE, floodWalks:
  undefined}, bounds: {obstacleTarget: 8, triesPerStep: 4, saturationK: 4}, skeleton: 'empty'})` (the lab's
  `procgenPalette.js` / `floodWalks` are already on main: `origin/seedling-gen-new-biomes` is an ancestor of the base).
  Seed 7 at the base: `GenerationAborted: … ABORTED at step 5 try 4 anchor 1/1 placing "melt-patch(w=1,h=2)" at (2,4)
  — the oracle threw a PressError … slashRect: direction -1 is not 0..3` (38 s). It had not moved since `f8955b197e`.
- The capture (`capture-seed7.mjs`): the oracle wrapped through `seedlingSeam`'s `wrapOracle`; the first throwing
  solve's `{record, staging, goals, budget, name}` → `fixtures/hammer-slashrect/seed7-request.json` (6 KB, uncut). A
  standalone `procgenOracle.solve` of it throws the same `PressError` in 0.9 s. Call stack:
  `presses.slashRect` ← `levelRun.forecastSwordTest` ← `fire` ← `spinnerForecastWithPress` ← `solverBot.pressEscapeOnce`
  ← `pressEscapeScoped` ← `pressEscape` ← `aimAdmitted` ← `execKillByPressOnce` ← `execKillByPress`.
- Debug prints (scratch, reverted): `pressEscapeOnce {n:100, at:100, pressAt:101, id:'spinner@16,32', stateDir:2,
  stDir:-1, keys:[['left']], st:(40.09,88.26)}`; the forecast's test at t102 `{weapon:'sword', direction:-1,
  pressTick:101, own:true}` with the point at t102 `{direction:2, vx:-1, inLava:true, drowning:true}`.
- `SEEDLING_HAMMER_ESCAPE=0` on the request: SOLVED (the escape-less trajectory never aims on a recovery tick).
- Bounded set by path (`bounded-files.txt`: every test naming `slashRect`, `PressError`, `execKillByPress`,
  `deriveStrike`, `strikePolicyFor`, `pressEscape`, `SOLVER_ENV_NAMES`, plus the hammer rows): 54 files, 48 fast.

## 4. M — the design

| Option | What it does | Verdict |
|---|---|---|
| (1) fix the input: never ask a strike with no facing | The caller cannot fix the facing (`hitUpdate` runs after `sprites`, so the aim key cannot set it); "fixing the input" means not planning a press on that tick. That changes WHICH tick presses wherever the game holds -1 → a solve can move. | The honest fix. Behind a switch, OFF: `PRESS_NO_FACING`. |
| (2) the press path catches a no-facing strike and refuses by name | A `SolverRefusal` (bound `PRESS_NO_FACING`) where the forecast THREW. Hides nothing: the refusal names the facing, the tick, the body and the `Player.as:1424` cause, and carries the preview's own sentence. Byte-identical wherever nothing threw. | Ships ON, as the floor under (1). |
| (3) both | (2) always; (1) under the switch. | **Chosen.** |
| (4) model `getSlashRect`'s default arm (a zero rect at (0,0)) | Exact for the game, but it lives in `levelRun.js` / `presses.js` (`levelRun.js` is out of bounds) and it would make a whiff look like a press the planner might choose. | Not taken; a hand-over if a workload ever needs the whiff. |

Why (2) is not "a refusal that hides a wrong facing": the facing is not wrong; it is the game's. (2) refuses only
where the model has no arm, and (1) is the fix of the PLAN (do not press into a whiff), which needs a switch because it
can move a solve.

Scratch measurements on the fixture (`hammerSlashRect.test.js` pins them): defaults → REFUSED `PRESS_NO_FACING`
(`PRESS_NO_FACING_COUNTS.refused` 1); ON → REFUSED "There is no step out" (`escapeDeclined` ≥ 1, `aimDeclined` ≥ 1,
`refused` 0). Generation seed 7: base ABORT; OFF and ON `TARGET_REACHED`, record `a659f54e779dd408` both.

## 5. I — the fix

**Module `pressNoFacing.js`** (imports `PressError` / `CombatVerbError` through the door `solverView.js`):
`PRESS_NO_FACING` (`SEEDLING_PRESS_NO_FACING=1`, `withPressNoFacing`), `PRESS_NO_FACING_COUNTS`, `isFacing`,
`noFacingWhy`, `noFacingRefusal`, `refuseNoFacing`. Its `SOLVER_ENV_NAMES` line is in.

**`solverBot.js`** (strike/press path only):
- always: `pressEscapeOnce`'s three forecast calls and `deriveFight`'s `pressFrom` (the press `advance` and the train's)
  go through `refuseNoFacing`: a `PressError` / `CombatVerbError` thrown while the press's facing is not 0..3 becomes
  `SolverRefusal` (`bound` and `code` `PRESS_NO_FACING`). Every other throw and every value passes through unchanged.
- `PRESS_NO_FACING` ON: `pressEscapeOnce` returns `{ok:false, claim:true, bound:'no-facing'}` before forecasting;
  `aimAdmitted` returns false on it (no fallback admits it); the live press tick (`aimed`) re-aims instead of pressing at
  -1; `pressFrom` offers no macro from an aim tick ending at -1.
- `solveProgress.BOUND_KINDS`: `'no-facing'` and `PRESS_NO_FACING` → `unmodelled` (JSUT's red: the source-closure row
  holds every `bound:` the solver writes to a kind).

**Rows** (`hammerSlashRect.test.js`, 8 rows, default tier, 1.5 s): the facing computation (`playerHit` with no source
parks no facing; `stepPlayerDamage`'s recovery hands back -1, and a knockback's parked facing otherwise); `isFacing`;
`slashRect(-1)` throws by design; `refuseNoFacing` passes through values / throws at a facing / non-rect throws, and
converts sword and ghost-sword rect throws to the named refusal (its `progressKind` is `unmodelled`); ships OFF; the
fixture at the defaults REFUSES by name with the preview's sentence; the fixture ON meets the kill's own refusal.

**Mutants** (`mutants.txt`, each reds ≥ 1 row): M1 drop the guard → 2 rows red; M2 the facing check accepts -1 → 5
red; M3 refuse with no name (message) → 2 red; M3b no bound / code → 1 red; M4 ON without the escape's decline → 1 red.

**ON radius, by mover class:**

| Workload | OFF vs ON | Movers |
|---|---|---|
| identity block | BEFORE (base) = AFTER (head, OFF) on every row | 0 |
| producers `--jobs=4` | OFF: 97 run, all rc 0 (the 1 red is TREE-MOVED: I edited the log during the battery); ON: 97 run, **0 red** | 0 |
| route survey `--through=end` | 237 rows, every field but timing equal; 201 SOLVED / 36 REFUSED both ways | 0 |
| census A/B (base, OFF, ON; `caldera-cf` 1–30, `caldera` 1–12, `post-sword` 1–12; record + trace digests incl. reason text) | 53/54 identical across all three | 1: `caldera-cf` 7, base ABORT → OFF/ON `TARGET_REACHED`, same record; the trace differs only in the candidate's refusal sentence (class: **throw → named refusal**, the slice's own effect) |
| bounded fast set | OFF 935/935 (48 files) | — |
| hammer `.slow` files ON | 6 files, **11/11** (`slow-on.txt`: hammerLatchWeigh 2, hammerTurretApproach 3, hammerSpinnerPress 2, hammerIceTurretStatic 2, hammerDashShape 1, hammerEscapeGenerated 1; 38 min) | 0 |

## 6. D — gates

| Gate | Result |
|---|---|
| `hammerSlashRect.test.js` + `solveProgress.test.js` | 66/66 |
| bounded fast set OFF (`bounded-off.txt`) | 48 files, 935/935 |
| source-scan tests (every test reading `solverBot.js` source, `solveProgress`, `solverView`; `source-scan-tests.txt`) | 16 files, 355/355 (run after the `BOUND_KINDS` fix) |
| `ci-producer-checks --jobs=4` OFF / ON | 97 run, 0 producer red (OFF's TREE-MOVED was my edit) / 97 run, 0 red |
| identity block BEFORE / AFTER | equal on every row; reference ALL 7 MODULES AND 5 REGIONS MATCH |
| `census-seedling-solver-surface --check` | `--write` (367 rows; 2 new: `PressError`, `CombatVerbError` → `seedling`/`constant`), then GREEN |
| `census-seedling-constants --check` | PASS, 0 drift |
| `generate-procgen-reference` → `check-procgen-reference` | ALL CHECKS PASSED (README + `procgenDocs/generated/docsIndex.js` regenerated), re-run after all five missing non-wasm submodules were initialised |
| `generate-docs-index.mjs --check` | OK |
| `derive-seedling-tick0 --check` | PASS (declared 16414 + 21 = 16435, measured 16435) |
| `check-seedling-wasm-ship` headless (:8000) | **ALL PASS, 415 PASS, 0 FAIL** (`wasm-ship.txt`) |
| `solverEnvChannel.test.js` | 11/11 |
| JSUT at `f0a05103` (run 41225431024, `jsut-41225431024.txt`) | slow battery **351/351**; suite 25017 passed / **1 failed**: `solveProgress.test.js`'s source closure (`no-facing` had no `BOUND_KINDS` kind), fixed in `1afe5bf1` |
| JSUT at `de4db972` (run 41231241179, `jsut-41231241179.txt`) | **success**: the 3 Vitest shards (suite **25018 passed, 0 failed**), **the slow battery success (33 files, 351 passed, 0 failed)**, the producer checks, headless and browser gates. The commits after it are this report only |

## 7. What the harvest A/B should expect

- **OFF (the defaults): no movers** on any shipped workload (identity, producers, survey, the census A/B). The only
  change at the defaults is a crash that becomes a named refusal (`PRESS_NO_FACING`), measured on the caldera
  counterfactual only.
- **`SEEDLING_PRESS_NO_FACING=1`: no movers** on the producers, the survey or the census A/B (beyond the counterfactual
  seed 7's refusal text). To witness it in the GAME, a sweep dispatch with `solver_env=SEEDLING_PRESS_NO_FACING=1` and
  the default `keys` should show **no verdict mover**; nothing shipped reaches a recovery-tick press today.
- Nothing here depends on the CHOOSER_PAIR flip (seed 7's answers are the same with `CHOOSER_PAIR=1 SIZE=3`; L40 is not
  involved).

## 8. What the brief got wrong (measured)

- "A `-1` direction … means some caller computed a facing that is not one of the four." No caller computed it: the
  GAME holds `direction = -1` for one tick (`Player.as:1424`), and the solver previewed it faithfully. The defect is
  planning a press there, and having no refusal where the forecast has no arm.
- "OFF throws / ON refuses by name." The throw→refusal part ships ON (it is byte-identical wherever nothing threw), so
  OFF already refuses by name; the switch carries the behaviour change (not pressing on that tick).
- "Find how its caldera counterfactual is built … without merging the lab branch": the lab branch is already an
  ancestor of main; only the counterfactual (`floodWalks: undefined`) is the lab's, and it is rebuilt in a script.

## 9. Residue and hand-overs

- **The run's own press at -1 still throws** (`levelRun.js:6691`). No shipped workload reaches it, and the switch never
  presses there; a model of `getSlashRect`'s all-zero default arm would belong to `levelRun.js` / `presses.js` (out of
  this slice's bounds).
- Unwitnessed arms of the switch: the live press tick's re-aim (`pressDeferred`) and the fight macro's decline
  (`fightDeclined`, `HAMMER_FIGHT` OFF): no workload measured here reaches them; they are counted.
- The `caldera` palette proper (with `floodWalks`) never reaches this path in the census (its flood keeps the player off
  the melt); the counterfactual is not shipped.
- No fidelity file, `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `iceTurret.js`, `flashPanel/*`, generator file, AS3,
  wasm, gitlink or rules edit.
