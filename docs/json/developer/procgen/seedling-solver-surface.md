# The Seedling Solver's Surface

The Seedling solver reaches the simulation through a single run object and a set of imported helpers. This page covers what that interface is today and how it was measured. It also covers the classified contract table that freezes it, `scripts/procgen/seedling-solver-surface.json`, and the gate that goes red when the surface grows or when a row falls out of use. The solver itself (planner, driver and strategies) is described in seedling-bot.md in this directory.

## What the interface is

The **simulation** is the static import closure of `frontend/modules/seedlingDemo/levelRun.js`: 47 files. The **solver family** is the closure of `solverBot.js` and `director.js` minus the simulation: 11 files (`botDriverV1 botDriverV2 campaignChain dangerMap decisionTrace director encounters hazards mover solverBot strikePolicy`). `twoPassSolve.js` and the `watch*.js` pages are **callers**. They import the family, but nothing in the family imports them, so they sit outside both closures.

`createLevelRun` returns one object literal with 174 properties: 162 getters, 10 methods and 2 shorthand properties. The solver uses it in four ways:

- **It reads the run.** The family reads 84 of the 174 properties (`run.state`, `run.world`, `run.level`, entity lists, event ledgers) and leaves the other 90 alone.
- **It advances the run.** `run.advance(held)` steps exactly one tick. The family calls `createLevelRun` once, in `botDriverV2.js`, and then drives that one run forward.
- **It plans with a pure stepper.** `run.previewStepper()` returns `(state, held, opts) → state`, which is bound to the run's live geometry and changes nothing.
- **It asks for forecasts.** `spinnerForecast`, `arrowForecast`, `chaserForecast` and `gameTimeAt` return data about future ticks.

⛔ **The run has no clone, snapshot or restore, and the solver has never needed one.** Planning works through the stepper and the forecasts. Everything else is a read followed by `advance`.

The family also imports 114 named symbols from 24 simulation modules. Most are Seedling rules and tables (`presses.js`, `combatVerbs.js`, `combat.js`, `activators.js` and so on). The rest are physics helpers (`playerPhysicsV1/V2.js`, `levelWorld.js` geometry).

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

SURFACE-TABLES-PLACEHOLDER

## Adding a member when a slice needs one

The gate, `scripts/procgen/seedlingSolverSurface.test.js`, fails in four cases:

- a family file reaches a member, or imports a symbol, that the table does not list;
- a family file reaches a listed member that its row does not name in `files`;
- a row that nothing reaches any more;
- a family file list that no longer equals the closure.

To add a member:

1. Make sure you actually need it. The narrowing folds above are the direction the table should move, so first check whether an existing row answers the question.
2. Run `node scripts/procgen/census-seedling-solver-surface.mjs --write`. The new row comes out `class: "UNCLASSIFIED"`, and the gate refuses it in that state.
3. Read the member's definition and its docblock, then fill in `class`, `form` and `why`. Judge the member by what it returns, not by its name. `inputRefused` sounds generic, but it reports one Seedling touch-lock.
4. If a solve now reaches the member at runtime, re-run the dynamic measurement with `--write`, then run the census `--write` again so that `seen` is refreshed.

Removing a member works the same way in reverse. When a narrowing slice stops reaching a row, the gate says the row "must be RETIRED", and `--write` drops it.

⛔ The census is named `census-*`, not `check-*`. A `check-*.mjs` file enrols in the derived gate roster and owes a standing row, and that enrolment is a separate, deliberate step.
