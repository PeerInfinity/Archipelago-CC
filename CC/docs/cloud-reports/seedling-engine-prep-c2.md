# Seedling engine prep C2: one import door for the solver (cloud report)

## Where it ran

- **Started from:** `origin/main` at `f9cd949dbb` (the brief expected `91b29e40de` or later; `91b29e4` is its parent).
- **Branch:** the cloud harness assigned **`claude/seedling-solver-import-door-g9ufhb`**, and all work was pushed there. Nothing was pushed to `main`, and no stash was used.
- **Head:** the commit that carries this report. The C2 commits are `ee38ea9` (D1), `7940fa0` (D2), `995deee` (D3), `cafe0c9` (D4), `e140d62` (D5) and this report.
- **Machine:** 4 CPUs, Node v22.22.2. `session_bootstrap.sh --seedling` reached `READY`.
- **What was not touched:** A2's files, AS3, wasm, gitlinks, tapes, expectations and fixtures. No `standing-values --write` and no `pytest` were run, and every vitest run was bounded.

## W0: the bank at `f9cd949dbb`

| Row | Command | Result |
|---|---|---|
| Census | `node scripts/procgen/census-seedling-solver-surface.mjs --check` | `GREEN: 240 rows match a fresh census`, exit 0 |
| Surface B | `node scripts/procgen/census-seedling-solver-surface.mjs` | family (11) as in the brief; **114 imported symbols from 24 modules** (four-file view: 93 / 22). A1 and B1 added no family import. |
| Simulation closure | the same run | **48 files**, not 47. B1's `tapeEnvelope.js` (`6b405b7`) joined the closure of `levelRun.js`. |
| Ten routes | each `node <route> --check`, run plainly; stdout md5 taken with wall times masked (`/\b\d+\.\ds\b/g`, the instrument's own normalisation) | all exit 0. Every stdout md5 **equals C1's recorded `stdoutMd5`** in `seedling-solver-surface-dynamic.json`; every stderr is empty. Table below. |
| Family vitest | `npx vitest run` over the 13 family test files that exist: `botDriverV1 botDriverV2 campaignChain dangerMap decisionTrace director encounters hazards mover moverRooms moverSolids moverTotem solverBot` `.test.js` | **13 files, 568 tests passed**, 19.8 s. The brief's `strikePolicy.test.js` does not exist. |

## What landed, per D

| D | Commit | Verdict | What |
|---|---|---|---|
| D1 | `ee38ea9` | **PASS** | `frontend/modules/seedlingDemo/solverView.js`: a docblock (what the door is, what it is not, the rules, how to add a symbol), then 24 `export { … } from './<module>.js'` blocks, one per simulation module, holding exactly the table's 114 import rows. Each block is headed `// <module> — <family files> · <class split>`. `node -e "import('./frontend/modules/seedlingDemo/solverView.js')"` → 114 exports. The gate gained "the door's closure contains no family file". |
| D2 | `7940fa0` | **PASS** | Nine family files now take their simulation symbols from one `import { … } from './solverView.js'`. `campaignChain.js` and `director.js` import no simulation module, so they are unchanged. Family-to-family imports are unchanged in text and now follow the door statement. |
| D3 | `995deee` | **PASS** | The census resolves imports through the door and gates the door's two rules. `--write` leaves 240 rows, and C2 moved no column (details below). |
| D4 | `cafe0c9` | **PASS** | Five door mutants, each predicted before it ran. The table is below. |
| D5 | `e140d62` + this | **PASS** | § *The import door* in `seedling-solver-surface.md`, and the docs index regenerated. |

### D1: one forced rename

`burnableTree.js` and `breakableRocks.js` each export a `WAIT_AFTER_PRESS_TICKS`, and the two are different numbers (a rock's shatter window against a tree's burn animation). One door cannot export both under one name. The door exports the rock's under its own name, and the tree's pair as `HIT_TO_GONE_TICKS as BURN_HIT_TO_GONE_TICKS` and `WAIT_AFTER_PRESS_TICKS as BURN_WAIT_AFTER_PRESS_TICKS`. Those are the local names `botDriverV2.js` already used, so no use site changes. `mover.js`'s `step as stepV1` stays a local alias, because the door exports `step`.

### D2: the import-line proof

`git diff --stat ee38ea9 7940fa0`: 9 files, 88 insertions, 106 deletions (botDriverV1 4, botDriverV2 68, dangerMap 10, decisionTrace 2, encounters 24, hazards 2, mover 2, solverBot 60, strikePolicy 22).

The brief's rule "one door statement per file" and its rule "import lines only" collide in four files. Six comment blocks sat *between* simulation import statements and annotated one of them: the burn alias and the presses-not-combatVerbs slash rect in botDriverV2, the player-box block in encounters, the R9 rock block and the R8 cadence block in solverBot, and the talk-radius note in strikePolicy. To merge the statements, each block moved **inside the door statement's braces**, directly above the names it annotates, indented four spaces. That is why a text-level check sees non-import lines move. It was proven three ways (scripts in the session scratchpad, reproducible from the descriptions):

1. **AST check** over each changed file, `git show ee38ea9:<f>` against the D2 tree:
   - the program with every `ImportDeclaration` removed is token-identical (babel AST without positions or comments);
   - the multiset of comment lines (each trimmed) is identical;
   - every local import binding resolves to the same (defining module, exported name), following the door.

   All nine files read `SAME`. Import statements went from 2→1, 19→2, 6→2, 1→1, 4→2, 1→1, 1→1, 23→8 and 8→2, and 188 import bindings are unchanged. **Negative control:** a copy of `mover.js` with its first `const` turned into `let` gave `DIFF … non-import code ≠` and `PROOF FAILS`. The file was restored, and `git diff` on it shows only the import line.
2. **Line check** (the `grep -v '^[-+]import'` idea, done by AST span because multi-line imports have lines that do not start with `import`): of the 106 `-` and 88 `+` lines, **37 lie outside an import statement, and all 37 are comment lines** (0 non-comment). They are the six blocks above, on their old side.
3. **The routes.** See *The ten routes* below.

### D3: the census resolves the door

`scripts/procgen/seedlingSolverSurface.js`:

- **`DOOR`.** `DOOR = seedlingDemo/solverView.js`. The door is removed from the family closure. Without that, the family would read 12 files.
- **Import resolution.** An import from the door resolves through the door's `export … from` table to the module it re-exports, so a row's `module` stays the simulation module.
- **New `door` findings:**
  - **bypass:** a family file imports a `seedlingDemo` module that is neither a family file nor the door. The allowed set is `family ∪ {DOOR}`, taken from the closure;
  - **unknown:** a name imported through the door that the door does not export;
  - **leak:** anything in the door other than `export { … } from` a simulation module that really exports the name, or a family file in the door's closure.
- **Unused door exports.** An export no family file imports is `retired`, with the message "must be RETIRED from solverView.js".

`census-seedling-solver-surface.mjs --check` prints `RED door:` lines, and the table print gains `import door solverView.js: 114 exports; 157 of 157 family import specifiers go through it; 0 bypass, 0 unused`.

**`--check` over the D2 tree before this change** exited 1 with `RED: 386 finding(s)`. Those findings cover every one of the 114 import rows plus the family list:

- 114 `unlisted`, each naming `solverView.js` as a file on an import row;
- 157 `retired`, one per family import specifier ("the file must be RETIRED from the row");
- 114 `drift`;
- 1 `family` (closure `… solverView.js …`, 12 files, against the table's 11).

**After the change:** `GREEN: 240 rows match a fresh census`, even before `--write`.

**`--write`.** Rows 240 → 240. `git diff --stat`: `seedling-solver-surface.json | 18 +++++++++---------`. The changed fields are `simulation.files` 47 → 48 and the `line` of 8 rows. All 8 are `tapeFormat.js` symbols (`assertTapeWithinRuntimeBudget`, `coerceTerrainState`, `GAME_VISIBLE_DROPS`, `heldKeysAt`, `KEY_CODES`, `KEY_NAMES`, `requiredTapeVersion`, `serializeTape`). No `class`, `form`, `files`, `sites`, `seen` or `why` changed. **Neither change is C2's.** The census run over the *base* tree (`git show f9cd949dbb:` for every file, so no door) builds a table byte-identical to the D3 table. The moves are B1's: tape v13 (`69bfe78`) moved `tapeFormat.js`, and `tapeEnvelope.js` joined the closure.

**The gate** (`seedlingSolverSurface.test.js`) gains test (v):

- the door findings are empty;
- no family import goes around the door;
- the door's export count (114) equals the table's import-row count;
- no row names the door as its module.

C1's mutant (b), a *direct* unlisted import, now reports twice: not in the table, and around the door. Test (iv) now excludes the door from the closure.

## The ten routes, before → after

Each route was run with `--check`, plainly, with stdout md5 taken with wall times masked. W0 ran at `f9cd949dbb`; the after run used the D2 tree.

| Route | W0 exit / stdout md5 | After D2 exit / stdout md5 | Verdict line |
|---|---|---|---|
| `solve-seedling-r8-battery.mjs` | 0 / `410f27c077b1ee854a14c24b73dc6335` | 0 / same | all checks green |
| `solve-seedling-r8-d2.mjs` | 0 / `f2cfe3f99f919e769e6b0a102b796c45` | 0 / same | all checks green |
| `solve-seedling-r8-d2-chain.mjs` | 0 / `b470c14d1d272fb7d0e03fdcde9cf20e` | 0 / same | all checks green |
| `solve-seedling-r8-l18.mjs` | 0 / `17be7d70e7bf116f9c3438de04be6b15` | 0 / same | all checks green |
| `solve-seedling-r8-tail.mjs` | 0 / `9a6a31925cb5204eee4cb0ad66febed6` | 0 / same | all checks green |
| `solve-seedling-r9-l3.mjs` | 0 / `6cd35fe1414af6bf5beb7605f235cb8e` | 0 / same | all checks green |
| `solve-seedling-r9-campaign.mjs` | 0 / `2823a8112d1cb76e6d0324a5cf713085` | 0 / same | all checks green |
| `regenerate-r2-tapes.mjs` | 0 / `4c2cad46474555a132a84c78ef1b44fc` | 0 / same | 0 tape(s) differ from disk |
| `regenerate-r3-tapes.mjs` | 0 / `7e0cf44426ffb65e381ae86a7bfb432f` | 0 / same | 0 tape(s) differ from disk |
| `regenerate-r4-tapes.mjs` | 0 / `608d2d8c14000365daa466bbc9a95090` | 0 / same | the last line is the tape listing; `--check` exits 0 |

Stderr was empty on both sides (`d41d8cd98f00b204e9800998ecf8427e`). A `diff` of the two banks with the wall-time column removed was empty. All ten W0 md5s also equal C1's recorded `stdoutMd5`. Wall times, run ten-parallel on 4 CPUs: 3.7 s to 141 s before, 1.0 s to 144 s after. The probed runs were not made, because they are optional for C2.

**Vitest after D2:** the same 13 family files, **568 / 568 passed** (20.4 s), unchanged from W0.

## D4: mutants

Each mutant ran over a temporary copy of the files under `os.tmpdir()`, and each outcome is asserted in the test's new `describe('the import door (engine-prep C2), …')`. `git status` was clean afterwards.

| Mutant | Predicted | Measured |
|---|---|---|
| (a) `import { SPINNER as SPINNER_DIRECT } from './spinner.js'` added to a copy of `dangerMap.js` | one RED, the door rule | one RED: `dangerMap.js:1 imports spinner.js directly — a family file imports a seedlingDemo module only if it is a family file or the door, solverView.js` |
| (b) `export { PLAYER_SOLID_TYPES } from './levelWorld.js'` added to a copy of `solverView.js`. No family file imports it. | one RED "RETIRED" | `door:solverView.js#PLAYER_SOLID_TYPES — no family file imports it — the export must be RETIRED from solverView.js` |
| (b′) The brief's literal `export { WATER_STATE } from './levelWorld.js'` | two RED | two RED: RETIRED, and `… the door holds only … a re-export of WATER_STATE, which …levelWorld.js does not export` |
| (c) `export { blocksMover } from './levelWorld.js'` in the door, **and** `import { blocksMover } from './solverView.js'` in a copy of `mover.js` | one RED "not in the contract table" | exactly `frontend/modules/seedlingDemo/mover.js:1 reaches import:levelWorld.js#blocksMover — not in the contract table` |
| (d) `// import { SPINNER } from './spinner.js' — prose, not an import` added to a copy of `dangerMap.js` | GREEN | GREEN |
| C1's (b), now: a *direct* `import { blocksMover } from './levelWorld.js'` in `mover.js` | two RED | two RED: not in the table, and around the door |

Gate file: **18 tests passed** (C1 had 11; +1 closure, +1 rule (v), +5 door mutants), 5.9 s.

## D5: records

- `seedling-solver-surface.md` gains § *The import door*. It covers what the door is and is not, the `BURN_` rename, how the census resolves the door, the two gated rules, and how to add or retire a symbol.
- The gate's failure list now names the door cases. The simulation count was corrected to 48.
- The section adds no link, so the link-census pins (318 / 244 / 16) do not move. The docs index was regenerated, which changed only word counts.
- `node scripts/procgen/generate-procgen-reference.mjs`, then `--check`: `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`. The registry loader's `Worker is not defined` warning appears, as C1 recorded, and is unrelated.
- Bounded vitest: `npx vitest run frontend/modules/seedlingDemo frontend/modules/procgenDocs scripts/procgen/seedlingSolverSurface.test.js` gave **178 files, 6286 tests passed**, exit 0, **189 s** wall.

## What the brief got wrong (measured)

- **Mutant (a) as written is a SyntaxError.** `dangerMap.js` already binds `SPINNER` through the door, so a second `import { SPINNER } from './spinner.js'` fails to parse (`Identifier 'SPINNER' has already been declared`) before any census reads it. The mutant uses an alias instead.
- **Mutant (b)'s `WATER_STATE` is not exported.** It is a module-private `const` in `levelWorld.js:100` and in `playerPhysicsV2.js:295`. As written, it would be a link error when the door loads. The census now refuses it too (mutant b′). The pure "unused export" mutant uses `PLAYER_SOLID_TYPES`, which is exported and imported by nobody.
- **"One door statement per file" and "import lines only" collide.** Six annotated comment blocks sat between the statements. They moved inside the braces: 37 comment lines, with 0 non-comment lines outside an import statement. The proof is the AST and comment-multiset check, not a `grep`.
- **The door would join the family.** Anything the family imports that the simulation does not is family by C1's definition. The census has to exclude the door explicitly, or the family would read 12 files. The brief did not say this. D3 does it.
- **"RED on 114 rows" was 386 findings.** That covers all 114 import rows (unlisted + retired + drift) plus the family list.
- **Per-module counts.** The family-wide counts are `combat.js` 9, `combatVerbs.js` 11, `tapeFormat.js` 8 and `playerPhysicsV1.js` 10. The brief's 7 / 8 / 4 are not the 11-file numbers. `presses.js` 15, `levelWorld.js` 9, `activators.js` 8, `arrowTrap.js` 6, `spinner.js` 5 and `levelRun.js` 1 are correct.
- **The simulation is 48 files, not 47.** This is B1's `tapeEnvelope.js`.
- **The family vitest list.** `strikePolicy.test.js` does not exist. Five other family test files do (botDriverV1, campaignChain, decisionTrace, encounters, hazards), and they were added to the bank.
- **The intermediate SHA is red.** At `7940fa0` (D2 alone) the gate test is RED, as the brief predicted. D3 landed about 10 minutes later. A CI run on that SHA alone would show it.

## Residue (for C3's folds)

- **The door is where a facade goes.** The narrowing ranks 5–10 (the `presses`, `spinner`, `activators`, `arrowTrap`, `combat` and `combatVerbs` facades) can now replace one block of `solverView.js` without touching a family import line. Only the names inside the one door statement change. The block headers already give the class split each facade must respect: `presses.js` is seedling 10 / physics 5 and `levelWorld.js` is seedling 3 / physics 6, so those two need to split by class.
- **The entities fold.** `run.entities(family)` (rank 1) is a run-object fold, not an import fold. But its entity families line up with door blocks: `activators`, `arrowTrap`, `chasers`, `chest`, `crusher`, `iceTurret`, `pushables`, `shieldBossFight`, `spinner`, `breakableRocks`, `bridges`, `burnableTree`, `fireVerb`. Per-family constants and geometry queries (for example `SPINNER`, `ARROW`, `CHEST`, `ICE_TURRET`, `spinnerRect`, `arrowLaneRect`, `chestStanceBand`) are what a fold would pair with each entity list. C3 can move them behind the same `family` key in the door.
- **Four physics-only blocks.** `playerPhysicsV1.js`, `playerPhysicsV2.js`, `camera.js` and `levelRun.js` are the candidate engine-side import surface for a physics/Seedling split of the door.
- **The dynamic probe was not re-run.** Its hook (`seedlingSolverSurfaceProbe/hooks.mjs`) redirects `levelRun.js` by the resolved URL whatever the parent, so `createLevelRun` reached through the door should still be wrapped. That is read from the code, not measured. The committed `seedling-solver-surface-dynamic.json` attributes reads by the caller file on the stack, which is unchanged.
- **Module evaluation order changed.** A family file's simulation dependencies now evaluate in the door's order (alphabetical by module), not the file's old import order. No simulation module has an order-dependent top-level effect that the ten routes or the 6,286 tests can see. That is measured, not argued.
