# Seedling engine prep C1: the solver's surface, frozen (cloud report)

## Where it ran

The session started from `origin/main` at `1c70549`. The planner had measured at `996080b`, and the only seedlingDemo file that differs between the two SHAs is `ropeSword.test.js`, which is neither a source nor a family file. The cloud harness assigned the branch **`claude/seedling-solver-surface-c1-sl0wrx`**, and all work was pushed there. Nothing was pushed to `main`, no stash was used, and `package.json` is untouched. The head SHA is the commit that carries this report.

## W0: reproducing §1

All figures are at `1c70549`, measured with `node scripts/procgen/census-seedling-solver-surface.mjs`.

| Quantity | §1 | Measured | Notes |
|---|---|---|---|
| Simulation closure | 47 files / 51,786 lines | 47 / **51,739** | Same files. The 47-line gap is exactly one per file: §1 counted `split('\n').length` without discounting the trailing newline, and this counts lines the way `wc -l` does. |
| Run object | 174 = 162 getters + 10 methods + 2 shorthand, at `:10458–14453` | same | |
| Surface A over the four files | 84 distinct, 866 sites; botDriverV2 56 / solverBot 39 / dangerMap 13 / director 7; heaviest state 239, world 158, level 83, advance 35, pushables 30, openActivators 30, ticksCompleted 24, inventory 16 | **identical** | |
| Surface B over the four files | 93 symbols, 22 modules; solverBot 59 / botDriverV2 40 / dangerMap 17 / director 0; presses 15, levelWorld 9, activators 8, combatVerbs 8, combat 7, arrowTrap 6, spinner 5, … | **identical** | |
| Surface C direct spellings | `run.world.*` 20 / 91, `run.state.*` 6 / 184 | **identical** | |
| Over the 11-file family (predicted: run members stay 84, imports reach about 114) | — | **84 / 866; 114 symbols from 24 modules** | Prediction held. |
| Family list | the 11 files named in the brief | same | |

`twoPassSolve.js`, `r8Acceptance.js` and `watchManual`, `watchSolve`, `watchViewer` and `watchWasm` are **callers**. Each imports the family, but nothing in either closure imports them, so they belong to neither the family nor the simulation.

## What landed, one commit per D

| D | Commit | What | Result |
|---|---|---|---|
| D1 | `8d8c7e4` | `scripts/procgen/seedlingSolverSurface.js` (pure) and `census-seedling-solver-surface.mjs` (prints tables; `--write` / `--check` / `--json`) | **PASS**. It reproduces §1, follows 19 `const` aliases and 34 parameters across files (for example botDriverV2's `level` is `run.world`), and reports 23 blind spots. |
| D2 | `232a171` (instrument), `9ef0140` (measurement) | A module hook in `seedlingSolverSurfaceProbe/` redirects `levelRun.js` to a wrapper that returns the run behind a recording `Proxy`. `measure-seedling-solver-surface.mjs` runs each route plainly and under the probe. | **PASS**. All 10 routes produced the same output (below). |
| D3 | `58de815`, then `8bc2f42` | `scripts/procgen/seedling-solver-surface.json`, 240 rows, every one classified | **PASS** |
| D4 | `4d5e830` | `scripts/procgen/seedlingSolverSurface.test.js`, default tier | **PASS**: 11 tests in 3.9 s |
| D5 | `d557768`, `2457413` | `docs/json/developer/procgen/seedling-solver-surface.md`, indexed after seedling-bot.md | **PASS** |
| D6 | this commit | the records and this report | **PASS** |

**D2's form.** D2 is a script, not a test. The probed routes take 1,113 s of wall time (the plain runs take 326 s), which is far over the 60 s default-tier limit. Only the static gate runs in the default tier.

**Gate rows (D6):**

- `node scripts/procgen/census-seedling-solver-surface.mjs --check` → `GREEN: 240 rows match a fresh census`, exit 0.
- `node scripts/procgen/generate-procgen-reference.mjs` then `--check` → `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`. The run also prints a `stateManagerProxy … Worker is not defined` warning from the registry loader. That warning is unrelated to this change.
- `npx vitest run scripts/procgen/seedlingSolverSurface.test.js frontend/modules/procgenDocs scripts/procgen/checkProcgenHelp.test.js` → **10 files, 503 tests passed**.

**Link-census pins.** Adding the doc moves two pins in `frontend/modules/procgenDocs`: `docLinks.test.js` goes from 304 to 305 (the `doc` count from 232 to 233), and `docsRender.test.js` from 304 to 305. The only new link is the README index row that the generator writes for the new doc. The doc itself links nothing and uses plain-prose pointers only. Both pins carry a history line.

## Class × form × surface

Each cell gives the number of rows, then the number of static sites.

| surface | class | live-state | event-ledger | forecast | stepper | geometry-query | constant | function | total |
|---|---|---|---|---|---|---|---|---|---|
| run | physics | 6 / 508 | 1 / 2 | 1 / 7 | 2 / 39 | 1 / 5 | 1 / 2 | 1 / 7 | 13 / 570 |
| run | seedling | 35 / 221 | 29 / 60 | 3 / 9 | — | 2 / 2 | — | 2 / 5 | 71 / 297 |
| world | physics | — | — | — | — | 9 / 39 | 3 / 15 | — | 12 / 54 |
| world | seedling | — | — | — | — | 5 / 12 | 11 / 85 | — | 16 / 97 |
| state | physics | 10 / 250 | — | — | — | — | — | — | 10 / 250 |
| state | seedling | 4 / 0 | — | — | — | — | — | — | 4 / 0 |
| import | physics | — | — | — | 1 / 4 | 4 / 68 | 17 / 127 | 12 / 31 | 34 / 230 |
| import | seedling | — | — | 5 / 10 | 3 / 3 | 15 / 40 | 37 / 172 | 20 / 40 | 80 / 265 |

**Run forms against §1.** §1 estimated about 42 live-state, 32 event-ledger and 6 forecast members. The measured counts are 41 live-state, 30 event-ledger, 4 forecast, 2 stepper, 3 geometry-query, 3 function and 1 constant.

**How the classes were assigned.** Three reader passes read every definition and docblock, and I reviewed their output. I overruled three import forms: `createLevelRun` is physics/function, not seedling/live-state, and `swordWindowReplace` and `swordWindowSchedule` are functions, not ledgers. Each overruling says so in its `why`.

## Static against dynamic

The probe recorded 78.7 M reads across 10 routes. Reads were attributed to a family file when the stack said so.

- **Run.** The dynamic census reached 69 of the 84 static members. **Dynamic ⊆ static held, as predicted.**
- **World.** Dynamic reached 24 of 28 static members and added none. §1 predicted it would add some; it did not, because the static census already follows the aliases and parameters that carry the world.
- **State.** Dynamic added **8 members that only it sees**: `terrain`, `hazard`, `drown`, `swim`, `latched`, `hitX`, `hitY` and `transition`. Seven arrive through solverBot's four `{ ...run.state }` copies (lines 2068, 5409, 5463 and 5515). The eighth is `hazard`, read at strikePolicy.js:473 through `strike.decide(state)`. `terrain` also passes through that same path. The static census lists both paths as blind spots (spread-copy and passed-unresolved).
- **Reached by non-family code only, and therefore not rows.** `run.deadFramesOwed`, `gameTime`, `gameTimeRefusal`, `noDamage`, `saveArrays`, `shieldBossHits`, `spinnerContacts` and `spinnerPressKills` are read by the route scripts. `world.nearestWalkableTileWithTie` is read by levelWorld's own method through `this`.
- **`level` is not a surface.** `run.level` is a number, so there is nothing to proxy at that level. The `level.*` reads in §1 are world reads, passed in under a parameter named `level`.

## Cold members

These are reached statically, but no route reaches them at runtime.

- **Run, 15.**
  - **director.js only**: `appliedTimedClears`, `bankedClears`, `earnedClears`, `saveState`, `spinnerWrites` and `worldCtor`. `jsLiveEnvelope` runs only on the watch page.
  - **dangerMap.js**: `arrowCoverAt`.
  - **Untaken botDriverV2 branches**: `blastFreezes`, `crusherContacts`, `crushersParked`, `primary`, `treeBurns`, `turretDamage`, `turretKills` and `turretsSettled`.
- **World, 4.** `bridgeTiles`, `burnableTrees`, `iceTurrets` and `solidBoxesForMover`.

## Overturned provisional classes

- **`inputRefused`: physics → seedling.** It returns `lockSnap !== null`, which is true only while a Seedling touch-lock window is open. It does not gate input in general. Pickup ceremonies are reported separately, by `inCeremony`.

The other 83 run classes stand. Three are borderline and stayed physics:

- `liveGeometryOpts` is the engine's collision-options channel, although all 14 of its keys are Seedling families.
- `noHazards` is a physics coercion over Seedling hazard names.
- `playerHits` and `playerDeaths` were left seedling, as §1 had them, because their rows carry Seedling sources, knockback and shake.

## Mutants

Every mutant was predicted before it ran, and each ran in a temporary copy of the files under `os.tmpdir()`. The tree was clean afterwards (`git status`). Each outcome below is asserted in D4.

| Mutant | Prediction | Result |
|---|---|---|
| (a) `run.adoptWindowClock` read added to a copy of `dangerMap.js`. No family file reaches that method today (confirmed: UNREACHED, kind method). | RED | RED, exactly one finding: `dangerMap.js:<n> reaches run:adoptWindowClock — not in the contract table` |
| (a′) `run.bosses` read added to a copy of `dangerMap.js`. The row names only botDriverV2.js. | RED through `files` | RED: `… reaches run:bosses — the row names only botDriverV2.js` |
| (b) `import { blocksMover } from './levelWorld.js'` added to a copy of `mover.js`. No family file imports `blocksMover`. | RED | RED: `mover.js:1 reaches import:levelWorld.js#blocksMover — not in the contract table` |
| (c) The one `run.worldCtor` read removed from a copy of `director.js` (director.js:1507) | RED "RETIRED" | RED: `run:worldCtor — nothing reaches it — it must be RETIRED` |
| (d) Comments `// run.notAMember` and `/* run.alsoNot */` added to `dangerMap.js` | GREEN | GREEN, no findings |

## Proof that the probe did not change the solves

`node scripts/procgen/measure-seedling-solver-surface.mjs --write` runs each route plainly and then probed. The results are recorded in `seedling-solver-surface-dynamic.json` under `routes[]`, with md5 hashes and an `identical` / `byteIdentical` flag per route.

| Route | Plain → probed | Stdout and stderr |
|---|---|---|
| `solve-seedling-r8-battery.mjs --check` | 0.6 → 4.5 s | byte-identical |
| `r8-d2` | 0.5 → 1.6 s | byte-identical |
| `r8-d2-chain` | 2.3 → 14.3 s | byte-identical |
| `r8-l18` | 1.3 → 7.8 s | byte-identical |
| `r8-tail` | 0.4 → 1.4 s | byte-identical |
| `r9-l3` | 0.4 → 1.2 s | byte-identical |
| `r9-campaign` | 9.7 → 47.7 s | byte-identical |
| `regenerate-r2-tapes.mjs --check` | 85 → 276 s | identical with printed wall times masked |
| `regenerate-r3-tapes.mjs --check` | 151 → 466 s | identical with printed wall times masked |
| `regenerate-r4-tapes.mjs --check` | 75 → 292 s | identical with printed wall times masked |

All ten routes exited 0 on both runs. Each `--check` asserts that the solve emits the committed tapes. The regenerate scripts print their own per-tape wall time (for example `12.3s`), and the probed runs are slower, which is the only difference. The first run reported that as a DIFF and refused to write. The one normalisation added is `WALL_TIME = /\b\d+\.\ds\b/g`.

## Narrowing candidates

Each candidate folds a group of members behind one new member. The ranking is by the number of static sites the new member takes over.

| rank | fold | members → 1 | sites moved |
|---|---|---|---|
| 1 | run: Seedling entity live state → `run.entities(family)` (openActivators 30, pushables 30, armedArrowTraps 12, …) | 22 → 1 | 171 |
| 2 | world: Seedling entity rosters → `world.roster(family)` (activators 22, pressers 12, arrowTraps 11, …) | 11 → 1 | 85 |
| 3 | run: Seedling event ledgers → `run.ledger(kind)` | 29 → 1 | 60 |
| 4 | run: bag and progress → `run.progress()` (inventory 16, keys 10, …) | 13 → 1 | 50 |
| 5 | imports: `presses.js` facade | 10 → 1 | 38 |
| 6 | imports: `spinner.js` facade (SPINNER alone accounts for 30) | 5 → 1 | 35 |
| 7 | imports: `activators.js` facade | 8 → 1 | 31 |
| 8 | imports: `arrowTrap.js` facade | 6 → 1 | 28 |
| 9 | imports: `combat.js` facade | 9 → 1 | 28 |
| 10 | imports: `combatVerbs.js` facade | 11 → 1 | 26 |
| 11 | run: forecasts → `run.forecast(kind, h)` | 4 → 1 | 16 |
| 12 | world: Seedling terrain tables → `world.tilesOf(kind)` | 5 → 1 | 12 |

The ledger fold (rank 3) removes the most members, 29 down to 1. The forecast fold (rank 11) mixes the physics `gameTimeAt` with the Seedling forecasts, so it has to be split by class.

## What the brief got wrong (measured)

- **Line count.** 51,786 is 51,739 plus one per file. The difference is how a trailing newline was counted.
- **`level` as a surface.** `run.level` is a number. The "`level.*` 10" figure is world members read under a parameter named `level`, and the census now counts those as `world`.
- **Surface C through aliases and parameters.** Counting aliases and parameters, world is **28 members / 151 sites** (direct only: 20 / 91), and static state is 6 / 250 (direct only: 184).
- **Where dynamic adds members.** §1 predicted that dynamic would add world members. It added none for world and eight for state, all through spread copies.
- **`run.world` count.** `run.world` has 159 tracked sites against §1's 158. The extra read comes through `gone(r)` (solverBot.js:9381), where the run is passed under the parameter name `r`.
- **Proxy invariants.** The brief's warning does not bite in this layering. The wrapper substitutes values only for accessor properties and method returns, and nothing below them is re-wrapped, so no shadow target was needed.

## Residue

- **Blind spots.** The static census still cannot see 23 sites and names them:
  - `until.test(run)` ×5 (botDriverV2, solverBot)
  - `strike.decide(state)` ×4
  - `STRATEGY_EXECUTORS[…](run)` ×3, and `exec(run)`
  - `phrase.offMap`
  - `{ ...run.state }` ×4
  - `let at = state` ×2
  - one `state` in an array literal
  - `run` handed on as `{ run }` at solverBot.js:8372

  The dynamic column covers what the routes reach through these.
- **Director.** No route exercises `director.js`, so its 7 run members are cold. A watch-page route under the probe would warm them.
- **D2 runtime.** D2 takes about 19 minutes probed and is not in any tier. The committed dynamic JSON goes stale silently when a solver file changes. The static gate does not read it, except for the `seen` column that `--write` folds in.
- **`line` column.** The `line` column is informational and not gated, so any edit to the simulation leaves it stale until the next `--write`.

## What enrolling the census as a `check-*.mjs` roster gate would owe

- **A rename or wrapper.** `census-seedling-solver-surface.mjs --check` would need to become `check-seedling-solver-surface.mjs`, or a thin wrapper. That makes it a derived roster row that owes a standing row in `standing-values.json`, written through `standing-values --write` (the coordinator's step).
- **Its key inputs.** It needs an `@key-inputs` declaration covering the 11 family files, the 47 simulation files (only `levelRun.js`, `levelWorld.js` and `playerPhysicsV2.js` are read for definitions, but the closure decides the family), the table, and the dynamic JSON.
- **Cost.** The published value would be the `--check` stdout. It costs about 0.9 s, so it is cheap.
- **`--help`.** It would owe `--help` through `argvHelp.js`. Today the two new CLIs parse their own flags and are counted in the instruments table without `--help`, while `checkProcgenHelp.test.js` stays green.
- **The D4 test.** The vitest gate already runs in CI's default tier, so enrolment would add a second instrument for the same claim. The coordinator should pick one of the two.
