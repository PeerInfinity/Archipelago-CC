# The Seedling Solver's Surface

The Seedling solver reaches the simulation through a single run object and a set of imported helpers. This page covers what that interface is today and how it was measured. It also covers the classified contract table that freezes it, `scripts/procgen/seedling-solver-surface.json`, and the gate that goes red when the surface grows or when a row falls out of use. The solver itself (planner, driver and strategies) is described in seedling-bot.md in this directory.

## What the interface is

The **simulation** is the static import closure of `frontend/modules/seedlingDemo/levelRun.js`: 48 files. The **solver family** is the closure of `solverBot.js` and `director.js` minus the simulation: 11 files (`botDriverV1 botDriverV2 campaignChain dangerMap decisionTrace director encounters hazards mover solverBot strikePolicy`). `twoPassSolve.js` and the `watch*.js` pages are **callers**. They import the family, but nothing in the family imports them, so they sit outside both closures.

`createLevelRun` returns one object literal with 174 properties: 162 getters, 10 methods and 2 shorthand properties. The solver uses it in four ways:

- **It reads the run.** The family reads 84 of the 174 properties (`run.state`, `run.world`, `run.level`, entity lists, event ledgers) and leaves the other 90 alone.
- **It advances the run.** `run.advance(held)` steps exactly one tick. The family calls `createLevelRun` once, in `botDriverV2.js`, and then drives that one run forward.
- **It plans with a pure stepper.** `run.previewStepper()` returns `(state, held, opts) → state`, which is bound to the run's live geometry and changes nothing.
- **It asks for forecasts.** `spinnerForecast`, `arrowForecast`, `chaserForecast` and `gameTimeAt` return data about future ticks.

⛔ **The run has no clone, snapshot or restore, and the solver has never needed one.** Planning works through the stepper and the forecasts. Everything else is a read followed by `advance`.

The family also imports 114 named symbols from 24 simulation modules. Most are Seedling rules and tables (`presses.js`, `combatVerbs.js`, `combat.js`, `activators.js` and so on). The rest are physics helpers (`playerPhysicsV1/V2.js`, `levelWorld.js` geometry). Every one of those imports goes through one module, the import door `solverView.js` (see *The import door* below).

## The import door

`frontend/modules/seedlingDemo/solverView.js` re-exports exactly the 114 simulation symbols the family imports, one `export { … } from './<module>.js'` block per defining module. A family file takes all of its simulation symbols from one `import { … } from './solverView.js'` statement. Its imports of other family files are unchanged. So the solver reaches the simulation through two doors: the run object for live state, and `solverView.js` for rules, tables and helpers.

The door is **not a wrapper**. Each line is a re-export, so a name imported through it is the defining module's own live binding, and every committed route solves byte for byte as it did before the door existed. It is **not the contract** either: the contract table is. The comment over each block summarises that module's rows (which family files use it, and how many rows are physics and how many Seedling). One name is renamed: `burnableTree.js` and `breakableRocks.js` both export a `WAIT_AFTER_PRESS_TICKS`, so the door exports the tree's pair under the `BURN_` names that `botDriverV2.js` already used.

The door is not a family file. The census takes it out of the family closure, and it resolves an import through the door to the module the door re-exports. An import row's `module` is therefore always the simulation module, never `solverView.js`.

The gate holds two rules on the door:

- **A family file imports a `seedlingDemo` module only if it is another family file or the door.** A direct import of a simulation module is RED, naming the file and line. The allowed set comes from the closure, not from a hand-written list.
- **The door exports only what the family imports, and only from the simulation.** An export no family file imports is RED "must be RETIRED from solverView.js". So is a re-export of a name its module does not export, any statement other than `export { … } from` a simulation module, and a family file in the door's closure.

To add a symbol, the table row comes first:

1. Add the name to its module's block in `solverView.js`, and to the family file's `import { … } from './solverView.js'`.
2. Run `node scripts/procgen/census-seedling-solver-surface.mjs --write`. The new row comes out `UNCLASSIFIED`.
3. Read the symbol's definition and fill in `class`, `form` and `why`, as for any other row (see *Adding a member when a slice needs one*).

To retire one, remove the import, run `--check`, and remove the export it names.

## How it is measured

**Statically**, `scripts/procgen/seedlingSolverSurface.js` parses each family file with `@babel/parser` and counts four kinds of access:

- **Direct reads.** Every non-computed member read on a binding that holds the run: `run.x` and `run?.x`.
- **World and state reads.** The same one level down, for values that came from `run.world` or `run.state`.
- **Aliases.** A single-assignment `const` alias such as `const w = run.world`.
- **Parameters.** A tracked value passed into a family function under any parameter name, followed across files. `botDriverV2`'s `level` parameter is `run.world`.

The census also **reports** what it cannot see, instead of guessing:

- computed access;
- destructuring;
- a `let` alias;
- a value stored in an array or object, or returned;
- a value handed to a callee it cannot resolve (the `until.test(run)`, `strike.decide(state)` and `STRATEGY_EXECUTORS[…](run)` tables).

`run.level` is a number, the current level id, so it has no members. The `level.*` reads in `botDriverV2.js` are reads of the world, passed in under that name.

**Dynamically**, `scripts/procgen/measure-seedling-solver-surface.mjs` re-runs every committed-route producer with a `--check` twice: once plainly, and once under a module hook (`seedlingSolverSurfaceProbe/`). The hook redirects `levelRun.js` to a wrapper that returns the run behind a recording `Proxy`. The world and state the run hands out get their own Proxy one level down. Neither run edits a simulation or solver file. Each run's exit code, stdout and stderr must match byte for byte, and `--check` itself asserts that the committed tapes are still emitted. The result is written to `scripts/procgen/seedling-solver-surface-dynamic.json`. The table's `seen` column records which census saw each row.

```bash
node scripts/procgen/census-seedling-solver-surface.mjs            # print the tables
node scripts/procgen/census-seedling-solver-surface.mjs --check    # is the table current?
node scripts/procgen/census-seedling-solver-surface.mjs --write    # rewrite it (class/form/why survive)
node scripts/procgen/measure-seedling-solver-surface.mjs --write   # the dynamic half, a few minutes
npx vitest run scripts/procgen/seedlingSolverSurface.test.js       # the gate, ~4 s
```

## The contract table

The table has one row per reached member or imported symbol. Its columns are:

| Column | What it holds |
|---|---|
| `surface` | `run`, `world`, `state` or `import` |
| `name` | the member or symbol name |
| `module`, `line` | where the member or symbol is defined (`line` is informational) |
| `class` | `physics` if any engine would expose it, `seedling` if it belongs in Seedling's game module |
| `form` | `live-state`, `event-ledger`, `forecast`, `stepper`, `geometry-query`, `constant` or `function` |
| `files`, `sites` | which family files reach it, and how often (static) |
| `seen` | `static`, `dynamic` or `both` |
| `dynamic` | reads per family file while the routes ran |
| `why` | one sentence, written from reading the member |

### Class × form × surface

Each cell shows the number of rows, then the number of static sites.

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

Two thirds of the run's static sites are physics, but only 13 of its 84 members are. Most of that weight sits in `run.state`, `run.world`, `run.level` and `run.advance`. The Seedling part of the surface is wide and shallow: 71 members with 297 sites between them.

### The ten heaviest members

| member | static sites | class | form | files |
|---|---|---|---|---|
| `run.state` | 239 | physics | live-state | botDriverV2 113, solverBot 126 |
| `run.world` | 159 | physics | live-state | botDriverV2 56, solverBot 103 |
| `state.y` | 111 | physics | live-state | botDriverV1 2, botDriverV2 57, solverBot 52 |
| `state.x` | 108 | physics | live-state | botDriverV1 2, botDriverV2 54, solverBot 52 |
| `run.level` | 83 | physics | live-state | botDriverV2 30, dangerMap 9, director 1, solverBot 43 |
| `run.advance` | 35 | physics | stepper | botDriverV2 26, solverBot 9 |
| `run.openActivators` | 30 | seedling | live-state | botDriverV2 22, solverBot 8 |
| `run.pushables` | 30 | seedling | live-state | botDriverV2 17, solverBot 13 |
| `run.ticksCompleted` | 24 | physics | live-state | botDriverV2 3, dangerMap 1, solverBot 20 |
| `world.activators` | 22 | seedling | constant | botDriverV2 10, solverBot 12 |

### Static against dynamic

Across the ten committed routes, the dynamic census reached 69 of the 84 run members and 24 of the 28 world members. Every one of those was already a static row. It also found eight `state` members that the static census cannot name: `terrain`, `hazard`, `drown`, `swim`, `latched`, `hitX`, `hitY` and `transition`. Seven of them are reached through the four `{ ...run.state }` copies in `solverBot.js`. The eighth, `hazard`, is read by `strikePolicy.js` through `strike.decide(state)`. The static census lists both kinds of site under what it cannot see (spread-copy and passed-unresolved). The probe also recorded some reads that are not rows, because they belong to the route scripts or to the simulation itself (`run.gameTime`, `run.saveArrays`, `world.nearestWalkableTileWithTie` and a few others).

### Cold members

Nineteen members are statically reached but no committed route reaches them at runtime:

- **Run, 15.** Six are reached only from `director.js`: `appliedTimedClears`, `bankedClears`, `earnedClears`, `saveState`, `spinnerWrites` and `worldCtor`. The director's live envelope runs on the watch page, which none of these routes loads. One is reached only from `dangerMap.js`: `arrowCoverAt`. Eight are `botDriverV2.js` branches that none of the committed routes takes: `blastFreezes`, `crusherContacts`, `crushersParked`, `primary`, `treeBurns`, `turretDamage`, `turretKills` and `turretsSettled`.
- **World, 4.** `bridgeTiles`, `burnableTrees`, `iceTurrets` and `solidBoxesForMover`.

A cold row is still part of the contract. It just means no route guards it at runtime yet.

### Narrowing candidates

Each candidate below folds a group of members behind one new interface member. The table ranks them by how many static sites would move to that one new member.

| rank | fold | members → 1 | sites moved | heaviest |
|---|---|---|---|---|
| 1 | run: Seedling entity live state → `run.entities(family)` | 22 → 1 | 171 | openActivators 30, pushables 30, armedArrowTraps 12, crushers 10, openChests 10 |
| 2 | world: Seedling entity rosters → `world.roster(family)` | 11 → 1 | 85 | activators 22, pressers 12, arrowTraps 11, pushables 11, combat 9 |
| 3 | run: Seedling event ledgers → `run.ledger(kind)` | 29 → 1 | 60 | collected 7, sealCollections 6, equipsFired 4, roomWrites 4, blastFreezes 3 |
| 4 | run: the bag and progress → `run.progress()` | 13 → 1 | 50 | inventory 16, keys 10, primaryWeapon 6, slashInfo 5, inputRefused 3 |
| 5 | imports: `presses.js` → one Seedling facade | 10 → 1 | 38 | SLASH_REACH 13, SLASH_HIT_TICKS 10, slashRect 7 |
| 6 | imports: `spinner.js` → one facade | 5 → 1 | 35 | SPINNER 30 |
| 7 | imports: `activators.js` → one facade | 8 → 1 | 31 | RESPONDERS 12, localPublish 5 |
| 8 | imports: `arrowTrap.js` → one facade | 6 → 1 | 28 | ARROW 13, arrowLaneForPlacement 6 |
| 9 | imports: `combat.js` → one facade | 9 → 1 | 28 | ENEMY_CLASSES 11, KILL_LOCK_TSET 4 |
| 10 | imports: `combatVerbs.js` → one facade | 11 → 1 | 26 | DASH_DISPLACEMENT 6, ORDINARY_SWING_PERIOD 4 |
| 11 | run: forecasts → `run.forecast(kind, h)` | 4 → 1 | 16 | gameTimeAt 7, spinnerForecast 7 |
| 12 | world: Seedling terrain tables → `world.tilesOf(kind)` | 5 → 1 | 12 | pitTiles 4, avoidVolumesAt 3, bridgeTiles 2 |

The event-ledger fold removes the most interface members (29 become 1). The entity fold moves the most sites. The forecast fold mixes the physics `gameTimeAt` with the three Seedling forecasts, so a slice that builds it has to split the query by class.

## Adding a member when a slice needs one

The gate, `scripts/procgen/seedlingSolverSurface.test.js`, fails in five cases:

- a family file reaches a member, or imports a symbol, that the table does not list;
- a family file reaches a listed member that its row does not name in `files`;
- a row that nothing reaches any more, or a door export that nothing imports;
- a family file list that no longer equals the closure;
- a break of the door's rules (see *The import door*).

To add a member:

1. Make sure you actually need it. The narrowing folds above are the direction the table should move, so first check whether an existing row answers the question.
2. Run `node scripts/procgen/census-seedling-solver-surface.mjs --write`. The new row comes out `class: "UNCLASSIFIED"`, and the gate refuses it in that state.
3. Read the member's definition and its docblock, then fill in `class`, `form` and `why`. Judge the member by what it returns, not by its name. `inputRefused` sounds generic, but it reports one Seedling touch-lock.
4. If a solve now reaches the member at runtime, re-run the dynamic measurement with `--write`, then run the census `--write` again so that `seen` is refreshed.

Removing a member works the same way in reverse. When a narrowing slice stops reaching a row, the gate says the row "must be RETIRED", and `--write` drops it.

⛔ The census is named `census-*`, not `check-*`. A `check-*.mjs` file enrols in the derived gate roster and owes a standing row, and that enrolment is a separate, deliberate step.
