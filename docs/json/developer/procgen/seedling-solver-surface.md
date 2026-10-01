# The Seedling Solver's Surface

The Seedling solver reaches the simulation through a single run object and a set of imported helpers. This page covers what that interface is today and how it was measured. It also covers the classified contract table that freezes it, `scripts/procgen/seedling-solver-surface.json`, and the gate that goes red when the surface grows or when a row falls out of use. The solver itself (planner, driver and strategies) is described in seedling-bot.md in this directory.

## What the interface is

The **simulation** is the static import closure of `frontend/modules/seedlingDemo/levelRun.js`: 48 files. The **solver family** is the closure of `solverBot.js` and `director.js` minus the simulation: 11 files (`botDriverV1 botDriverV2 campaignChain dangerMap decisionTrace director encounters hazards mover solverBot strikePolicy`). `twoPassSolve.js` and the `watch*.js` pages are **callers**. They import the family, but nothing in the family imports them, so they sit outside both closures.

`createLevelRun` returns one object literal with 177 properties: 162 getters, 13 methods and 2 shorthand properties. The solver uses it in four ways:

- **It reads the run.** The family reads 23 of the 177 properties (`run.state`, `run.world`, `run.level`, `run.advance` and the rest) and leaves the other 154 alone. Every Seedling entity family's live state comes through one of them, `run.entities(family)` (see *The entities fold*). The player's bag and progress come through `run.progress(field)`, and every Seedling event ledger through `run.ledger(kind)` (see *The progress and ledger folds*). Before the three folds the family read 84.
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

## The entities fold

The solver family reads a Seedling entity family's live state through one query, `run.entities(family)`, and not through that family's getter. The family key is the getter's own name, so `run.entities('pushables')` returns exactly what `run.pushables` returns.

**What folded: 23 getters, 180 sites.** The census sees 172 of them. The other 8 are `until.test(r)` predicates in `solverBot.js`, written `(r) => r.chasers…`. The census names these as blind spots (`passed-unresolved`), and only the dynamic probe showed that they read the run.

- **Rosters.** `openActivators`, `pushables`, `armedArrowTraps`, `crushers`, `openChests`, `strikeBodies`, `spinnerBodies`, `armedPulsers`, `turrets`, `chasers`, `brokenRocks`, `openBridges`, `arrowsInFlight`, `burnedTrees`, `latchedGroups`, `pulledRopes`, `turretDamage`, `arrowFlights`, `bosses` and `talkCircles`. Each is a live `Set`, `Map` or array for one entity family. `talkCircles` is the NPC and sign talkers.
- **Predicates.** `crushersParked`, `pushesSettled` and `turretsSettled` are one-boolean views of a family's state. They fold with their families, because the query names a view of a family, not only a roster.

**What did not fold, and why:**

- **The player's bag and progress** (`inventory`, `keys`, `primaryWeapon` and the rest). This is not entity state. It folded next, behind `run.progress(field)` (see *The progress and ledger folds*).
- **The event ledgers** (form `event-ledger`). These folded behind `run.ledger(kind)`, except the physics room log `transitions`.
- **`arrowCoverAt`.** It is a geometry-query closure, not live state.

**One function, two faces.** Each folded getter's body lives in one closure arrow, `<family>Now`, inside `createLevelRun`. The getter returns that arrow (`get pushables() { return pushablesNow(); }`), and the frozen dispatch table `ENTITY_FAMILIES` maps `pushables: pushablesNow`. `entities(family)` calls the table's entry and throws by name on an unknown family, listing the known ones.

The getter and the query share one function, so they cannot drift. `levelRun.test.js` still holds them equal, deep-strictly, at every tick of five committed tapes and two stagings, and asserts that each family was non-empty (or false, for a predicate) somewhere along the way.

**The getters stay.** `tapeRunner.js`, the `watch*.js` pages, the acceptance modules and the tests read them. Only the three family files that read these getters (`botDriverV2.js`, `solverBot.js` and `dangerMap.js`) go through the query.

**How the census sees it** (the same for all three folds; see *How the census sees a fold* below). The census reads the families as text out of `levelRun.js`: the exported `ENTITY_FAMILY_NAMES` list, and the keys of `ENTITY_FAMILIES`. `run.entities('<literal>')` is a read of `run:entities` and of the family its literal names. The table has one `run:entities` row, whose `families` column maps `family → { file: sites }`, and no per-family rows.

## The progress and ledger folds

The same seam twice more (engine-prep C4). The solver family reads the player's bag and progress through `run.progress(field)`, and every Seedling event ledger through `run.ledger(kind)`. The key is the getter's own name, so `run.progress('inventory')` returns exactly what `run.inventory` returns, and `run.ledger('collected')` exactly what `run.collected` returns.

**What folded: 41 getters, 109 sites.** Every site is spelled `run.<member>` in `botDriverV2.js` (78), `solverBot.js` (26) or `director.js` (5). A sweep of the family files for any other spelling found no run under another name, and the dynamic re-measure agreed: after the rewrite, no family file reads any of the 41 getters at run time.

- **Progress, 12 fields, 49 sites.** `inventory`, `keys`, `primaryWeapon`, `slashInfo`, `inputRefused`, `unfiredEquipTicks`, `unfiredGrantLevels`, `frozenTimer`, `inCeremony`, `primary`, `saveState` and `takenPickups`. Each is a fresh copy (the bag, the key set, the save arrays, the slash windows) or a primitive (the slot, a flag, the freeze timer).
- **Ledger, 29 kinds, 60 sites.** `collected`, `sealCollections`, `equipsFired`, `roomWrites`, `blastFreezes`, `chestOpens`, `playerDeaths`, `playerHits`, `treeBurns`, `crusherContacts`, `keyOpens`, `lockSnaps`, `spinnerPressHits`, and sixteen read once each: `appliedTimedClears`, `arrowVolleys`, `bankedClears`, `chaserKillLockOpens`, `earnedClears`, `grantsFired`, `presses`, `pulserHits`, `pulserPlayerHits`, `pulserPushes`, `ropePulls`, `shieldBossKills`, `shieldBossStabs`, `spinnerKillLockOpens`, `spinnerWrites` and `turretKills`. Every one copies its rows out on each read.

**Why both folds are keyed.** A single `progress()` returning all twelve fields would build a copy of the bag and the key set at every one of the 26 hot-loop reads that want only one of them. A key costs nothing, and it keeps the census able to name which field each site asks for.

**What did not fold: `transitions`.** It is an event ledger, but it is the **physics** room-transition log. It is part of the run's minimum contract (`createLevelRun`'s own `@returns`), it is handed out live rather than copied, and 51 non-test callers read it. It stays a direct member and its own row, so `run:ledger` is all Seedling.

**One function, two faces,** as for the entities. The bodies live in `<name>Now` arrows inside `createLevelRun`. The getters return them, and the frozen `PROGRESS_FIELDS` and `LEDGER_KINDS` tables map each key to its arrow. The names are exported as `PROGRESS_FIELD_NAMES` and `LEDGER_KIND_NAMES`. `levelRun.test.js` holds query equal to getter, deep-strictly, at every tick of eight committed tapes and two stagings, and asserts that every one of the 41 members was non-trivial somewhere. No committed tape makes `crusherContacts` or `pulserPlayerHits` non-trivial. The stagings are L41's crusher with the player standing in its lane, and `r5-shaft` walked up into its latched pulser after tick 2000.

**The getters stay.** `tapeRunner.js`, the watch pages, the acceptance modules and the route scripts read them.

## How the census sees a fold

The census's fold machinery is one list, `FOLDS` in `seedlingSolverSurface.js`. Each entry names the run method (`query`), the exported name list (`namesExport`), the dispatch table inside `createLevelRun` (`dispatch`) and the row's per-key column (`column`):

| query | name list | dispatch table | row column |
|---|---|---|---|
| `entities` | `ENTITY_FAMILY_NAMES` | `ENTITY_FAMILIES` | `families` |
| `progress` | `PROGRESS_FIELD_NAMES` | `PROGRESS_FIELDS` | `fields` |
| `ledger` | `LEDGER_KIND_NAMES` | `LEDGER_KINDS` | `kinds` |

`run.<query>('<literal>')` is a read of `run:<query>` and of the key its literal names. The table's top-level `folded` is keyed by query, `{ entities: […], progress: […], ledger: […] }`, and it is generated from the name lists, never typed. The query's row carries its column, `key → { file: sites }`, summing to the row's sites. There are no per-key rows.

The gate refuses, by name:

- a family file that reads a folded getter directly ("folded behind run.progress('inventory')");
- a key the dispatch table does not hold ("unknown ledger kind");
- a non-literal key, which is a blind spot the census cannot name;
- a name list that disagrees with its dispatch table or with the table's `folded`;
- one getter folded behind two queries.

**To fold another member** (into an existing fold, or a new fold added to `FOLDS`):

1. Move its getter's body, unchanged, into a `<name>Now` arrow beside the others. Point the getter at the arrow, add the arrow to the dispatch table, and add its name to the exported list.
2. Rewrite each family-file read, `run.<name>`, to `run.<query>('<name>')`. Change only the property span. Include the reads the census cannot follow, such as the run under another parameter name in an `until.test` predicate. Sweep the family files for `\w+\.<name>` and read each hit.
3. Run `census-seedling-solver-surface.mjs --check`. The old row now reads "must be RETIRED".
4. If a committed route reached the getter at run time, re-run `measure-seedling-solver-surface.mjs --write`. Otherwise the dynamic record keeps the old row alive as `seen: "dynamic"`.
5. Run `--write`. A new query's row comes out `UNCLASSIFIED`; classify it by hand.

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
| run | seedling | 2 / 221 | 1 / 60 | 3 / 9 | — | 2 / 2 | — | 2 / 5 | 10 / 297 |
| world | physics | — | — | — | — | 9 / 39 | 3 / 15 | — | 12 / 54 |
| world | seedling | — | — | — | — | 5 / 12 | 11 / 85 | — | 16 / 97 |
| state | physics | 10 / 250 | — | — | — | — | — | — | 10 / 250 |
| state | seedling | 4 / 0 | — | — | — | — | — | — | 4 / 0 |
| import | physics | — | — | — | 1 / 4 | 4 / 68 | 17 / 127 | 12 / 31 | 34 / 230 |
| import | seedling | — | — | 5 / 10 | 3 / 3 | 15 / 40 | 37 / 172 | 20 / 40 | 80 / 265 |

Two thirds of the run's static sites are physics, and 13 of its 23 members are. Most of that weight sits in `run.state`, `run.world`, `run.level` and `run.advance`. The Seedling part of the surface is 10 members with 297 sites between them: `run.entities` holds 172, `run.ledger` 60 and `run.progress` 49. Before the three folds it was 71 members, wide and shallow, and the 61 fewer members carry the same 297 sites.

### The ten heaviest members

| member | static sites | class | form | files |
|---|---|---|---|---|
| `run.state` | 239 | physics | live-state | botDriverV2 113, solverBot 126 |
| `run.entities` | 172 | seedling | live-state | botDriverV2 101, dangerMap 14, solverBot 57 |
| `run.world` | 159 | physics | live-state | botDriverV2 56, solverBot 103 |
| `state.y` | 111 | physics | live-state | botDriverV1 2, botDriverV2 57, solverBot 52 |
| `state.x` | 108 | physics | live-state | botDriverV1 2, botDriverV2 54, solverBot 52 |
| `run.level` | 83 | physics | live-state | botDriverV2 30, dangerMap 9, director 1, solverBot 43 |
| `run.ledger` | 60 | seedling | event-ledger | botDriverV2 49, director 4, solverBot 7 |
| `run.progress` | 49 | seedling | live-state | botDriverV2 29, director 1, solverBot 19 |
| `run.advance` | 35 | physics | stepper | botDriverV2 26, solverBot 9 |

### Static against dynamic

Across the ten committed routes, the dynamic census reached 21 of the 23 run members and 24 of the 28 world members (before the three folds: 69 of 84). Every one of those was already a static row. It also found eight `state` members that the static census cannot name: `terrain`, `hazard`, `drown`, `swim`, `latched`, `hitX`, `hitY` and `transition`. Seven of them are reached through the four `{ ...run.state }` copies in `solverBot.js`. The eighth, `hazard`, is read by `strikePolicy.js` through `strike.decide(state)`. The static census lists both kinds of site under what it cannot see (spread-copy and passed-unresolved). The probe also recorded some reads that are not rows, because they belong to the route scripts or to the simulation itself (`run.gameTime`, `run.saveArrays`, `world.nearestWalkableTileWithTie` and a few others). Among them are eight folded getters the route scripts still read directly (`inventory`, `keys`, `playerHits`, `playerDeaths`, `chestOpens`, `earnedClears`, `spinnerPressHits` and `spinnerKillLockOpens`). The scripts are callers, not family files.

### Cold members

Six members are statically reached but no committed route reaches them at runtime:

- **Run, 2.** `worldCtor` is reached only from `director.js`, whose live envelope runs on the watch page, which none of these routes loads. `arrowCoverAt` is reached only from `dangerMap.js`. Thirteen more were cold rows until a fold made them keys of a warm row, and their sites are still cold inside it:
  - `crushersParked`, `turretDamage` and `turretsSettled` in `run.entities`;
  - `saveState` (director) and `primary` (a `botDriverV2.js` branch) in `run.progress`;
  - `appliedTimedClears`, `bankedClears`, `earnedClears` and `spinnerWrites` (director), and `blastFreezes`, `crusherContacts`, `treeBurns` and `turretKills` (untaken `botDriverV2.js` branches), in `run.ledger`.
- **World, 4.** `bridgeTiles`, `burnableTrees`, `iceTurrets` and `solidBoxesForMover`.

A cold row is still part of the contract. It just means no route guards it at runtime yet.

### Narrowing candidates

Each candidate below folds a group of members behind one new interface member. The table ranks them by how many static sites would move to that one new member.

| rank | fold | members → 1 | sites moved | heaviest |
|---|---|---|---|---|
| 1 | ✅ DONE (engine-prep C3): run: Seedling entity live state → `run.entities(family)` | 23 → 1 | 172 | openActivators 30, pushables 30, armedArrowTraps 12, crushers 10, openChests 10 |
| 2 | world: Seedling entity rosters → `world.roster(family)` | 11 → 1 | 85 | activators 22, pressers 12, arrowTraps 11, pushables 11, combat 9 |
| 3 | ✅ DONE (engine-prep C4): run: Seedling event ledgers → `run.ledger(kind)` | 29 → 1 | 60 | collected 7, sealCollections 6, equipsFired 4, roomWrites 4, blastFreezes 3 |
| 4 | ✅ DONE (engine-prep C4): run: the bag and progress → `run.progress(field)`, keyed | 12 → 1 | 49 | inventory 16, keys 10, primaryWeapon 6, slashInfo 5, inputRefused 3 |
| 5 | imports: `presses.js` → one Seedling facade | 10 → 1 | 38 | SLASH_REACH 13, SLASH_HIT_TICKS 10, slashRect 7 |
| 6 | imports: `spinner.js` → one facade | 5 → 1 | 35 | SPINNER 30 |
| 7 | imports: `activators.js` → one facade | 8 → 1 | 31 | RESPONDERS 12, localPublish 5 |
| 8 | imports: `arrowTrap.js` → one facade | 6 → 1 | 28 | ARROW 13, arrowLaneForPlacement 6 |
| 9 | imports: `combat.js` → one facade | 9 → 1 | 28 | ENEMY_CLASSES 11, KILL_LOCK_TSET 4 |
| 10 | imports: `combatVerbs.js` → one facade | 11 → 1 | 26 | DASH_DISPLACEMENT 6, ORDINARY_SWING_PERIOD 4 |
| 11 | run: forecasts → `run.forecast(kind, h)` | 4 → 1 | 16 | gameTimeAt 7, spinnerForecast 7 |
| 12 | world: Seedling terrain tables → `world.tilesOf(kind)` | 5 → 1 | 12 | pitTiles 4, avoidVolumesAt 3, bridgeTiles 2 |

The event-ledger fold removed the most interface members (29 became 1). The entity fold moved the most sites. Rank 4's first count, 13 → 1 and 50 sites, included `talkCircles` (1 site), which C3 folded into `run.entities`. The forecast fold mixes the physics `gameTimeAt` with the three Seedling forecasts, so a slice that builds it has to split the query by class.

## Which blocks the solver models

`frontend/modules/seedlingDemo/entityBlocks.js` (behaviour parameters P3) labels Seedling's entities with the behaviour blocks of `procgenCore/behaviourBlocks.js` (see [Concepts § Behaviour](./concepts.md#behaviour)). It is read-only for the model and the solver: nothing in either import closure imports it, and `entityBlocks.test.js` asserts that. It has three tables:

- `ENTITY_BLOCKS` gives, for every `ENEMY_CLASSES` and `PUZZLEMENT_HAZARDS` tag, the blocks the class realises. A class that needs a block the vocabulary does not declare lists it under `bespoke`, and a boss is `unique`, with no blocks.
- `AGGRO_KIND_BLOCKS` maps each `aggro.kind` word to the movement block it denotes.
- `FAMILY_BLOCKS` maps each `run.entities` family and each `hazards.hazardVolume` arm to the blocks its state realises, the family files that read it, and the `OBSTACLE_STRATEGIES` verbs of the tags it holds.

The family map below is pinned to `FAMILY_BLOCKS` by `entityBlocks.test.js`. A `volume:` row is an avoid volume: a static union over every phase, which keeps a route out of it but says nothing about what happens inside.

| Family | Blocks | Read by |
|---|---|---|
| `openActivators` | `channel` | `botDriverV2`, `solverBot` |
| `pushables` | `pushable` | `botDriverV2`, `solverBot` |
| `armedArrowTraps` | `stationary`, `emitter`, `channel` | `botDriverV2`, `dangerMap`, `solverBot` |
| `crushers` | `lane-charge`, `contact` | `botDriverV2`, `dangerMap` |
| `openChests` | — | `botDriverV2`, `solverBot` |
| `strikeBodies` | `hp` | `botDriverV2`, `solverBot` |
| `spinnerBodies` | `rebound`, `contact`, `sweep`, `hp` | `dangerMap`, `solverBot` |
| `armedPulsers` | `stationary`, `pulse`, `channel` | `botDriverV2`, `solverBot` |
| `turrets` | `stationary`, `pushable` | `botDriverV2` |
| `chasers` | `chase`, `contact` | `dangerMap`, `solverBot` |
| `brokenRocks` | — | `botDriverV2`, `solverBot` |
| `crushersParked` | `lane-charge` | `botDriverV2` |
| `pushesSettled` | `pushable` | `botDriverV2` |
| `openBridges` | — | `botDriverV2` |
| `arrowsInFlight` | `emitter` | `dangerMap`, `solverBot` |
| `burnedTrees` | — | `botDriverV2`, `solverBot` |
| `latchedGroups` | `channel` | `solverBot` |
| `pulledRopes` | — | `botDriverV2` |
| `turretDamage` | `hp`, `emitter` | `botDriverV2` |
| `turretsSettled` | `pushable` | `botDriverV2` |
| `arrowFlights` | `emitter` | `dangerMap` |
| `bosses` | — | `botDriverV2` |
| `talkCircles` | — | `solverBot` |
| `bobBoss` | `chase`, `contact`, `hp` | `solverBot` |
| `volume:crusher` | `lane-charge`, `contact` | `encounters` |
| `volume:spinningaxe` | `stationary`, `sweep` | `dangerMap`, `encounters` |
| `volume:pulser` | `stationary`, `pulse` | `dangerMap`, `encounters` |
| `volume:arrowtrap` | `emitter` | `encounters` |
| `volume:beamtower` | `stationary`, `beam` | `dangerMap`, `encounters` |
| `volume:lavachain` | `stationary`, `tether` | `dangerMap`, `encounters` |
| `volume:whirlpool` | `stationary` | `dangerMap`, `encounters` |
| `volume:pull` | `stationary` | `dangerMap`, `encounters` |
| `volume:pod` | `stationary`, `contact` | `dangerMap`, `encounters` |

**Modelled.** A block counts as modelled when some `run.entities` family that a solver-family file reads realises it. These blocks are modelled, with the families behind each: `stationary` (`armedArrowTraps`, `armedPulsers`, `turrets`), `chase` (`chasers`, `bobBoss`), `rebound` (`spinnerBodies`), `pushable` (`pushables`, `turrets`, `pushesSettled`, `turretsSettled`), `lane-charge` (`crushers`, `crushersParked`), `contact` (`crushers`, `spinnerBodies`, `chasers`, `bobBoss`), `emitter` (`armedArrowTraps`, `arrowsInFlight`, `turretDamage`, `arrowFlights`), `sweep` (`spinnerBodies`), `pulse` (`armedPulsers`), `hp` (`strikeBodies`, `spinnerBodies`, `turretDamage`, `bobBoss`), `channel` (`openActivators`, `armedArrowTraps`, `armedPulsers`, `latchedGroups`).

**Only avoided.** These blocks reach the solver only as an avoid volume: `beam` (`volume:beamtower`), `tether` (`volume:lavachain`).

**Not modelled.** No family the solver reads realises these blocks. A concept whose realisation uses one of them needs that block modelled before a solve can certify it: `patrol`, `seek`, `ballistic`, `wall-launch`, `tile-hop`, `rise`, `melee`, `stomp`, `explode`, `matrix`, `terrain`, `onDeath`, `proximity`, `lineOfSight`, `persistence`, `onHit`, `allEnemiesDead`, `itemHeld`, `schedule`, `light`, `facingAway`.

`certifiableBlocks(realisation.blocks)` returns `{modelled, unmodelled, avoidedOnly}` for one realisation, so certifiability is a lookup. `blocksTheSolverModels()` returns the first list, `blocksOnlyAvoided()` the second, and `blocksNoFamilyModels()` the second and third together.

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
