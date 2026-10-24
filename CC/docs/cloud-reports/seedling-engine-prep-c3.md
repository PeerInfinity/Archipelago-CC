# Seedling engine prep C3: the entities fold (cloud report)

## The fold list (the design, committed before any code)

**Starting point:** `origin/main` at `cdbf8fe980`. The harness branch is `claude/seedling-entities-fold-f8ovxg`.

**The rule of the fold.** Each folded getter's expression moves, unchanged, into one closure arrow `<family>Now` just above `createLevelRun`'s returned object. The getter becomes `get <family>() { return <family>Now(); }`, and the frozen dispatch table `ENTITY_FAMILIES` maps `<family>: <family>Now`. That is one function with two faces, so the two cannot drift. **The family key is the getter's own name**, so `run.entities('pushables')` returns exactly what `run.pushables` returns. The names are exported as `ENTITY_FAMILY_NAMES`. The getters stay, because `tapeRunner.js`, the `watch*.js` pages, the acceptance modules and the tests read them.

**Measured at W0:** every one of the 23 getters returns a fresh value on each read. Twenty return a new `Set`, `Map` or array (`Object.is(run.x, run.x)` is false at a non-empty tick), and three return booleans. So the D1 equality rows use deep equality (`toEqual`), and none needs identity.

**23 rows, 172 static sites.** All 172 sites are spelled `run.<member>` directly. No alias or renamed parameter reaches any of these members; the census's `via` is `direct` for every one.

| family (= getter) | sites | files | `levelRun.js` line | shape | seen |
|---|---|---|---|---|---|
| `openActivators` | 30 | botDriverV2 22, solverBot 8 | 11472 | Set of ids / null (noclip) | both |
| `pushables` | 30 | botDriverV2 17, solverBot 13 | 11489 | Map id → rect / null | both |
| `armedArrowTraps` | 12 | botDriverV2 4, dangerMap 4, solverBot 4 | 11996 | Set / null | both |
| `crushers` | 10 | botDriverV2 8, dangerMap 2 | 11537 | Map / null | both |
| `openChests` | 10 | botDriverV2 7, solverBot 3 | 11911 | Set / null | both |
| `strikeBodies` | 10 | botDriverV2 3, solverBot 7 | 11619 | Array of bodies | both |
| `spinnerBodies` | 9 | dangerMap 3, solverBot 6 | 10583 | Array of bodies | both |
| `armedPulsers` | 8 | botDriverV2 4, solverBot 4 | 11969 | Set / null | both |
| `turrets` | 8 | botDriverV2 8 | 11723 | Map / null | both |
| `chasers` | 7 | dangerMap 2, solverBot 5 | 11650 | Array of bodies | both |
| `brokenRocks` | 5 | botDriverV2 3, solverBot 2 | 11500 | Set / null | both |
| `crushersParked` | 5 | botDriverV2 5 | 11546 | boolean (a predicate over the crusher family) | static (cold) |
| `pushesSettled` | 5 | botDriverV2 5 | 12183 | boolean (a predicate over the pushable family) | both |
| `openBridges` | 4 | botDriverV2 4 | 11486 | Set / null | both |
| `arrowsInFlight` | 3 | dangerMap 2, solverBot 1 | 12033 | Array of arrows | both |
| `burnedTrees` | 3 | botDriverV2 3 | 11520 | Set / null | both |
| `latchedGroups` | 3 | solverBot 3 | 12019 | Set of activator groups / null | both |
| `pulledRopes` | 3 | botDriverV2 3 | 11522 | Set / null | both |
| `turretDamage` | 2 | botDriverV2 2 | 11850 | Array of per-turret rows | static (cold) |
| `turretsSettled` | 2 | botDriverV2 2 | 11792 | boolean (a predicate over the turret family) | static (cold) |
| `arrowFlights` | 1 | dangerMap 1 | 12146 | Array of arrows | both |
| `bosses` | 1 | botDriverV2 1 | 11736 | Map / null | both |
| `talkCircles` | 1 | solverBot 1 | 11610 | Array of talker rows | both |

**Three judgement calls:**

- **`talkCircles` is IN, which makes 23 rows and 172 sites, not 22 and 171.** It returns a live roster of one entity family, the uncleared NPC and sign talkers from `talkerStateFor(level)`. That is the same kind of thing as `chasers` and `spinnerBodies`. It is not the player's bag and not a ledger.
- **The three `…Settled` / `…Parked` predicates stay IN, as the brief listed them.** They are not rosters. Each is one boolean over one entity family's live state, which is the same fact the roster getters answer, reduced. The fold key names a *view of a family*, so a predicate is a legitimate key. If they were left out, three getters would stay beside a query that already answers every other question about their family.
- **`latchedGroups` stays IN.** It is a set of activator *groups*, not entity ids, but it is the activator family's live latch state.

**NOT in the fold** (C4's): the player's bag and progress rows (`inventory`, `keys`, `primaryWeapon`, `slashInfo`, `inputRefused`, `unfiredEquipTicks`, `unfiredGrantLevels`, `frozenTimer`, `inCeremony`, `primary`, `saveState`, `takenPickups`) and every `event-ledger` row. Also not folded: `arrowCoverAt`, which is a geometry-query closure, not live state.

**Predicted table after D3:** 240 − 23 + 1 = **218 rows**. The shape is one `run:entities` row whose `sites` is the number of `run.entities(…)` calls, plus a new `families` column (`{ family: { file: sites } }`), and a top-level `folded` list generated from `ENTITY_FAMILY_NAMES`. No per-family sub-rows. Every other row keeps its class and form.

**The dynamic half has to be re-measured.** `buildTable` keeps a row that `seedling-solver-surface-dynamic.json` records a family file reading, even when the static census no longer sees it (it becomes `seen: "dynamic"`). The committed dynamic JSON records the 20 warm getters being read from family files, so after D2 a `--write` against the stale JSON would keep 20 folded rows as `dynamic`, and the table would read 238, not 218. So D3 re-runs `measure-seedling-solver-surface.mjs --write` after D2. That is also the fullest byte-identical proof, because it re-runs all ten routes twice. After D2 the family calls `entities`, whose dispatch calls the shared arrows directly and never goes through the getter, so the probe can only see `run.entities` from family files.

> **Postscript to the design (measured later, in D3).** The design above counted 172 sites, the census's number. The true family count is **180**. Eight more reads sit in `until.test(r)` predicates in `solverBot.js`, where the run arrives under the parameter name `r`, which is a blind spot the census names but cannot follow. The first dynamic re-measure found them. They folded in D2b. The table prediction, 218, held.

## Where it ran

- **Started from:** `origin/main` at `cdbf8fe980` (as the brief expected).
- **Branch:** the harness assigned **`claude/seedling-entities-fold-f8ovxg`**, and all work was pushed there. Nothing was pushed to `main`, and no stash was used.
- **Head:** the commit carrying this report. Before it: `5496c27` (W0), `e2401b5` (D1), `e4518cc` (D2), `730314f` (D4 runtime half, a D1 test fix), `4a9d3cb` (D3 part 1: census code, gate and mutants, doc draft), `ee9a155` (D2b), `8d2b926` (D3 table), `42016e8` (D5).
- **Machine:** 4 CPUs, Node v22.22.2. `session_bootstrap.sh --seedling` reached `READY`.
- **Not touched:** A3's files, AS3, wasm, gitlinks, tapes, expectations, fixtures and `solverView.js`. No `standing-values --write`, no `pytest`, and every vitest run was bounded.
- **Intermediate SHAs are red.** The gate test `seedlingSolverSurface.test.js` is RED from `e4518cc` to `ee9a155` (rows owed a retirement) and GREEN from `8d2b926`.

## W0: the bank at `cdbf8fe980`

| Row | Command | Result |
|---|---|---|
| Census | `node scripts/procgen/census-seedling-solver-surface.mjs --check` | `GREEN: 240 rows match a fresh census` |
| Constants census | `node scripts/procgen/census-seedling-constants.mjs --check` | `PASS` (green drift, 127 moved, pre-existing) |
| Ten routes | each `node <route> --check`, ten in parallel; stdout md5 with wall times masked (`/\b\d+\.\ds\b/g`) | all exit 0, stderr empty, every md5 **equal to the recorded `stdoutMd5`** (table below) |
| Vitest | `npx vitest run` over botDriverV2, solverBot, dangerMap, director, tapeRunner and levelRun `.test.js`, plus `seedlingSolverSurface.test.js` | **872 / 872**: botDriverV2 133, solverBot 101, dangerMap 57, director 108, tapeRunner **365** (the brief said 360), levelRun 90, surface 18 |

## What landed, per D

| D | Commits | Verdict |
|---|---|---|
| W0 | `5496c27` | **PASS**. The fold list was committed before any code. |
| D1 | `e2401b5`, `730314f` | **PASS** |
| D2 | `e4518cc`, `ee9a155` | **PASS**, in two commits (see D2b) |
| D3 | `4a9d3cb`, `8d2b926` | **PASS**: 240 → **218** |
| D4 | test rows in `4a9d3cb`; runtime half `730314f` | **PASS**. Every census prediction held. One runtime prediction was wrong and exposed a test weakness, which was fixed (below). |
| D5 | `42016e8` + this | **PASS** |

### D1: the query

`levelRun.js` changed in five places:

- **The moved bodies.** Each of the 23 getters' bodies moved into a closure arrow `<family>Now` just above the returned object.
- **The getters.** Each getter is now `get x() { return xNow(); }`, and its docblock stays on the getter.
- **The dispatch table.** `ENTITY_FAMILIES = Object.freeze({ x: xNow, … })` sits in the closure.
- **One new method,** `entities(family)`. It uses `Object.hasOwn`, so `'constructor'` is refused. On an unknown family it throws `levelRun.entities: unknown entity family "<f>" — the known families are …`.
- **The export** `ENTITY_FAMILY_NAMES`, frozen, at module level.

**The move is proven verbatim.** An AST comparison (babel, positions and comments stripped, `HEAD` against the D1 tree) found:

- every old getter body equal to its arrow's body: 23/23 `SAME`;
- every new getter exactly `return xNow();`;
- the other 151 run properties token-identical;
- the other 357 statements of `createLevelRun` token-identical.

**Negative control:** `||` turned into `&&` in `crushersParkedNow` gave `DIFF crushersParked … PROOF FAILS`.

**Test rows in `levelRun.test.js`** (10 new, 90 → 100):

- **The name list is the dispatch table.** 23 names, frozen, each a getter, and the refusal's "known families" equal to `ENTITY_FAMILY_NAMES`.
- **An unknown family throws by name.** Covered: `'pushable'`, `'constructor'` and `undefined`.
- **Query equals getter at every tick.** Five committed tapes are checked for all 23 families after every tick, deep-strictly (`util.isDeepStrictEqual`): r5-l42-part4, r5-totem-entrance, r9-solve-16, r5-l43-wand and r5-l37-burn. So are the R4 L63 bridge staging and a noclip run.
- **Every family witnessed non-trivially.** Each family must be a non-empty Set, Map or array, or a predicate that goes `false`, at some tick of some row.

**How the tapes were chosen.** A survey stepped every non-noclip tape in the roster. **No committed tape opens a bridge**, so `openBridges` is witnessed by the R4 block's own `probe-seedling-bridge` staging. The brief suggested `r5-*` and `r8-*` tapes. The survey found the chasers and turrets on `r9-solve-16` and `r5-l42-part4`, not on an `r8-*` tape.

**Identity.** No getter hands out a live object. Twenty return a fresh `Set`, `Map` or array (`Object.is(run.x, run.x)` is false even at non-empty ticks), and three return booleans. So the rows assert equality, not identity.

**The constants census moved keys** (A1's CSV; A3 also writes it). The move renamed four literal owners: `armedArrowTraps`, `armedPulsers` and `crushersParked` ×2 became `…Now`. Every other CSV change is a line number, checked by a sorted diff with the file and line columns dropped. The one field target `createLevelRun|crushersParked` in `seedling-constants-fields.csv` was re-pointed to `crushersParkedNow`. Without that, the two `0` literals would have fallen from physics/bound to structural. With it, the doc region does not move. `--check`: `PASS`, 0 new, 0 vanished, 0 moved. **The new method and table add no literal.**

### D2: the family walks through the query

**The rewrite.** An AST rewrite replaced only the property span of every `run.<folded>` / `run?.<folded>` in a family file: `run.pushables` became `run.entities('pushables')`. It changed 172 sites (botDriverV2 101, solverBot 57, dangerMap 14), exactly the census count per member and file. Afterwards there are **0 code sites**.

**Proof:** the reverse substitution `run(\??).entities('X')` → `run$1.X` restores `HEAD` byte for byte in all three files. No `entities(` existed before, so nothing else moved and no read was hoisted or duplicated.

**The textual count.** `grep -ao '\brun?\?\.<m>\b'` counts 214 before and 42 after. All 42 left are in comments and strings, since the AST count of code sites is 0. The brief's "0 AFTER" holds for code, not for prose.

**D2b (`ee9a155`).** The first dynamic re-measure still saw `solverBot.js` read `openActivators`, `chasers` and `arrowsInFlight` at run time, at `:4044`, `:4057`, `:5848`, `:6034`, `:6887` and `:9294`. These are `until: { test: (r) => r.<family>… }` predicates, reached through `until.test(run)`, a blind spot C1 named. A sweep of the family files for any non-`run` spelling of a folded member found **eight** such predicates: those six plus two cold ones at `:9423` and `:9516`. Four other hits were not the run: `base.*` is the `liveGeometryOpts()` bag, and `sm.*` / `s.*` are forecast states. All eight folded; the reverse substitution again restores the previous file byte for byte.

**The test stubs** (outside the brief's file list, and needed). Three test files built fake runs whose getters were plain fields. Each fake gained an `entities()` that answers from its own fields:

- `dangerMap.test.js`: a `withFamilies(base, families)` helper for three chaser overrides of a real run and three bare crusher stubs;
- `solverBot.test.js`: `roomWithNoTrap()`;
- `r8Acceptance.test.js`: the `LIVE_GEOMETRY_KEYS` sentinel run.

The alternative was a STOP, and the change is mechanical and test-only.

**Gates:**

- The ten routes are byte-identical (below).
- botDriverV2 133/133, including the three *committed fixtures are what the driver emits today* rows.
- tapeRunner 365/365.
- The whole `seedlingDemo` directory: 5826/5827 before the r8Acceptance stub fix, 93/93 on that file after it.

### D3: the contract table shrinks

**The census** (`seedlingSolverSurface.js`):

- **`entityFamiliesOf()`** reads `ENTITY_FAMILY_NAMES` and the keys of `ENTITY_FAMILIES` out of `levelRun.js` as text.
- **A `run.entities('<literal>')` read carries `family`.** A non-literal argument, or `entities` read without a call, is a blind spot of kind `entities-nonliteral`.
- **The `run:entities` row** gains `families: { family: { file: sites } }`, and `staticDrift` compares it.
- **The table** gains a top-level `folded` list, generated from the parsed names.
- **`entityFindings()`** refuses:
  - a family file reading a folded getter directly;
  - an unknown family;
  - a non-literal argument;
  - a name list that differs from the dispatch keys;
  - a table `folded` that differs from the names.
- **A folded key is not also reported as `unlisted`,** so one sentence names it.
- **The census CLI** prints `RED entities:` lines and an `entities fold:` summary line.

**`--check` after D2, before `--write`:** 26 findings, which were 3 `unlisted … reaches run:entities — not in the contract table` (botDriverV2:1332, dangerMap:129, solverBot:709) and these 23 RED lines:

```
RED retired: run:armedArrowTraps — nothing reaches it — it must be RETIRED
RED retired: run:armedPulsers — nothing reaches it — it must be RETIRED
RED retired: run:arrowFlights — nothing reaches it — it must be RETIRED
RED retired: run:arrowsInFlight — nothing reaches it — it must be RETIRED
RED retired: run:bosses — nothing reaches it — it must be RETIRED
RED retired: run:brokenRocks — nothing reaches it — it must be RETIRED
RED retired: run:burnedTrees — nothing reaches it — it must be RETIRED
RED retired: run:chasers — nothing reaches it — it must be RETIRED
RED retired: run:crushers — nothing reaches it — it must be RETIRED
RED retired: run:crushersParked — nothing reaches it — it must be RETIRED
RED retired: run:latchedGroups — nothing reaches it — it must be RETIRED
RED retired: run:openActivators — nothing reaches it — it must be RETIRED
RED retired: run:openBridges — nothing reaches it — it must be RETIRED
RED retired: run:openChests — nothing reaches it — it must be RETIRED
RED retired: run:pulledRopes — nothing reaches it — it must be RETIRED
RED retired: run:pushables — nothing reaches it — it must be RETIRED
RED retired: run:pushesSettled — nothing reaches it — it must be RETIRED
RED retired: run:spinnerBodies — nothing reaches it — it must be RETIRED
RED retired: run:strikeBodies — nothing reaches it — it must be RETIRED
RED retired: run:talkCircles — nothing reaches it — it must be RETIRED
RED retired: run:turretDamage — nothing reaches it — it must be RETIRED
RED retired: run:turrets — nothing reaches it — it must be RETIRED
RED retired: run:turretsSettled — nothing reaches it — it must be RETIRED
```

With the census change, a 27th finding joined them: `RED entities: seedling-solver-surface.json#folded the table's folded list [] ≠ ENTITY_FAMILY_NAMES — run --write`.

**The dynamic half was re-measured twice.** `measure-seedling-solver-surface.mjs --write` ran once after D2 and once after D2b. This is required: `buildTable` keeps a row the dynamic record attributes to a family file, and the first re-measure is what found D2b.

The final run, 10/10 routes:

- `SAME` (plain against probed, wall time masked, `identical: true`);
- every plain stdout md5 **equal to the W0-recorded one**;
- 62 run members reached (was 69).

The 18 folded members that are no longer read at run time by anyone are gone from the record. Two are still read, `brokenRocks` and `openActivators`, but only by route scripts (`solve-seedling-r9-l3.mjs:186`, `solve-seedling-r8-d2-chain.mjs:730`). Those are callers, not rows. `run.entities` shows 457,474 family reads (dangerMap 432,952, solverBot 15,049, botDriverV2 9,473).

**`--write`:** `218 rows — 1 UNCLASSIFIED`. That row is `run:entities`, classified by hand as seedling / live-state (why: "Returns ENTITY_FAMILIES[family](), the closure function the family's own getter also returns …"). `--check`: `GREEN: 218 rows match a fresh census`.

Across the 217 surviving rows, class, form, why, files, sites, seen and dynamic are all unchanged; only the informational `line` moved (187 rows). `runObject` went from 174 to 175 (method 10 → 11). The row's shape is one `run:entities` row (sites 172, the families column summing to 172, `seen: both`) with **no per-family sub-rows**.

**The gate** (`seedlingSolverSurface.test.js`) is now 24 tests, 7.3 s:

- **(vi)** holds, all of:
  - no fold findings;
  - the census's parsed names = the dispatch keys = `levelRun.js`'s runtime `ENTITY_FAMILY_NAMES` = the table's `folded`;
  - no folded row;
  - `families` = a fresh census;
  - `families` sum = `sites`.
- **C1's mutant (a′)** read `run.bosses`, which is folded now, so it was repointed to `run.equipNow` (botDriverV2 only).

## The ten routes, before → after

The table shows stdout md5 with wall times masked; exit was 0 and stderr empty (`d41d8cd9…`) in every run. Columns:

- **W0:** the bank at `cdbf8fe980`.
- **D1 and D2:** the same bank script at those trees.
- **Final:** the plain arm of the final `measure --write`, at the D2b tree, where the probed arm was `identical`.

| Route | W0 | after D1 | after D2 | final (D2b, plain; probed identical) |
|---|---|---|---|---|
| `solve-seedling-r8-battery` | `410f27c077b1ee854a14c24b73dc6335` | same | same | same |
| `solve-seedling-r8-d2` | `f2cfe3f99f919e769e6b0a102b796c45` | same | same | same |
| `solve-seedling-r8-d2-chain` | `b470c14d1d272fb7d0e03fdcde9cf20e` | same | same | same |
| `solve-seedling-r8-l18` | `17be7d70e7bf116f9c3438de04be6b15` | same | same | same |
| `solve-seedling-r8-tail` | `9a6a31925cb5204eee4cb0ad66febed6` | same | same | same |
| `solve-seedling-r9-l3` | `6cd35fe1414af6bf5beb7605f235cb8e` | same | same | same |
| `solve-seedling-r9-campaign` | `2823a8112d1cb76e6d0324a5cf713085` | same | same | same |
| `regenerate-r2-tapes` | `4c2cad46474555a132a84c78ef1b44fc` | same | same | same |
| `regenerate-r3-tapes` | `7e0cf44426ffb65e381ae86a7bfb432f` | same | same | same |
| `regenerate-r4-tapes` | `608d2d8c14000365daa466bbc9a95090` | same | same | same |

Every W0 md5 equals the `stdoutMd5` that C1 recorded and C2 reproduced.

## Per-member sites, before → after

Before is the census plus the D2b sweep; after counts the family's code reads of the getter. In total: **180 → 0**, and `run.entities` takes 172 visible calls plus 8 behind the `until.test` blind spot.

| member | census sites before | + until.test predicates | after |
|---|---|---|---|
| `openActivators` | 30 (botDriverV2 22, solverBot 8) | +2 solverBot | 0 |
| `pushables` | 30 (botDriverV2 17, solverBot 13) | — | 0 |
| `armedArrowTraps` | 12 (4 / 4 dangerMap / 4) | — | 0 |
| `crushers` | 10 (botDriverV2 8, dangerMap 2) | — | 0 |
| `openChests` | 10 (7, solverBot 3) | — | 0 |
| `strikeBodies` | 10 (3, solverBot 7) | +1 solverBot (cold) | 0 |
| `spinnerBodies` | 9 (dangerMap 3, solverBot 6) | — | 0 |
| `armedPulsers` | 8 (4, 4) | — | 0 |
| `turrets` | 8 (botDriverV2) | — | 0 |
| `chasers` | 7 (dangerMap 2, solverBot 5) | +4 solverBot (one cold) | 0 |
| `brokenRocks` | 5 (3, 2) | — | 0 |
| `crushersParked` | 5 (botDriverV2) | — | 0 |
| `pushesSettled` | 5 (botDriverV2) | — | 0 |
| `openBridges` | 4 (botDriverV2) | — | 0 |
| `arrowsInFlight` | 3 (dangerMap 2, solverBot 1) | +1 solverBot | 0 |
| `burnedTrees` | 3 (botDriverV2) | — | 0 |
| `latchedGroups` | 3 (solverBot) | — | 0 |
| `pulledRopes` | 3 (botDriverV2) | — | 0 |
| `turretDamage` | 2 (botDriverV2) | — | 0 |
| `turretsSettled` | 2 (botDriverV2) | — | 0 |
| `arrowFlights` | 1 (dangerMap) | — | 0 |
| `bosses` | 1 (botDriverV2) | — | 0 |
| `talkCircles` | 1 (solverBot) | — | 0 |

**The table: 240 → 218.**

## D4: mutants

Each mutant was predicted first. The predictions are in the session scratchpad, written before each run and timestamped. Each ran in a copy, and `git status` was clean afterwards. The census mutants run over `os.tmpdir()` copies and are asserted in the gate's new `describe('the entities fold (engine-prep C3), mutants over a temporary copy')`. The runtime mutants ran on a mutated copy of `levelRun.js` plus a copy of `levelRun.test.js` pointing at it, both beside the originals and deleted after the run.

| Mutant | Predicted | Measured |
|---|---|---|
| (a) `run.pushables` read added to a copy of `dangerMap.js` | exactly 1 RED "folded behind", and not also "not in the table" | 1 RED: `dangerMap.js:1055 reads run.pushables directly — it is folded behind run.entities('pushables'); a family file reads it through the query` |
| (b) `run.entities('pushable')` in a copy | 1 RED "unknown entity family" (static); the run throws by name | 1 RED: `… run.entities('pushable') — unknown entity family; levelRun.js's ENTITY_FAMILIES holds openActivators, pushables, …`. The unit row asserts `run.entities('pushable')` throws `unknown entity family "pushable" — the known families are …` |
| (c) `run.entities(name)` with a variable | 1 RED blind spot | 1 RED: `… run.entities(name) — not a string literal — a BLIND SPOT: the census cannot name the family, so a family file passes a string literal` |
| (d) `pushables: pushablesNow,` removed from `ENTITY_FAMILIES`, census | 30 unknown + 1 list≠dispatch = 31 RED | **31 RED** |
| (d) the same, D1 rows (runtime) | all 10 C3 rows RED | **Wrong: 5 RED, 5 GREEN.** The five tape rows built their runs through `tapeRunner.createRunForStaging`, whose own import of `levelRun.js` left the mutated copy unexercised. Fixed in `730314f`: the rows stage the run with this file's `createLevelRun`, field for field as the `r5-feather` row does. Re-predicted 10/10, measured **10/10 RED**. |
| (d′) extra: the dispatch entry pointed at another arrow (`pushables: pushesSettledNow`) | D1: 8 RED (7 comparison rows + the witness row), 2 GREEN (the name rows). Census: GREEN, because it sees keys, not values | **as predicted**: 8/2, census 0 RED. This is the "cannot drift" claim, and it rests on the D1 rows. |
| (e) a comment `// run.pushables` in a copy | GREEN | GREEN |

## D5: records

- **The doc.** `seedling-solver-surface.md` gains § *The entities fold*. It covers:
  - what folded: rosters, predicates, and the 180 = 172 + 8 split;
  - what did not fold and why;
  - the one-function, two-faces rule;
  - how the census sees the fold, and the four refusals;
  - the five steps to fold the next family, including the blind-spot sweep.

  The page's numbers are updated: 175 properties, 62 read, the class × form cell 35/221 → 13/221, the heaviest list with `run.entities` at 172, cold run members 15 → 12, and narrowing rank 1 marked DONE.
- **No new doc, and no new link.** The link-census pins do not move, and `procgenDocs` is green.
- **The generator.** `node scripts/procgen/generate-procgen-reference.mjs` changed only the index word counts. Then `--check`: `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`.
- **Bounded vitest.** `npx vitest run frontend/modules/seedlingDemo frontend/modules/procgenDocs scripts/procgen/seedlingSolverSurface.test.js scripts/procgen/seedlingConstantsCensus.test.js`: **182 files, 6362 / 6362 passed**, exit 0, **171 s** wall.
- **Census checks.** `census-seedling-solver-surface.mjs --check`: `GREEN: 218 rows`. `census-seedling-constants.mjs --check`: `PASS`.

## What the brief got wrong (measured)

- **22 rows / 171 sites is 23 / 172 with `talkCircles`,** and the true family count is **180**. Eight reads hide in `until.test(r)` predicates, which the static census cannot follow and "use its report of sites" therefore misses. Only the dynamic probe caught them.
- **"No change outside the three family files, levelRun.js, levelRun.test.js, the census files and the doc" could not hold.**
  - **Three test files** (`dangerMap.test.js`, `solverBot.test.js`, `r8Acceptance.test.js`) build fake runs with getters as plain fields, and they red the moment a family function asks `entities`. The fakes gained an `entities()`.
  - **The constants census's field CSV** (`seedling-constants-fields.csv`) needed one target re-pointed so that two physics literals keep their class.
  - **The dynamic JSON had to be re-measured.** Otherwise `--write` keeps the folded rows alive as `seen: dynamic`, and the table reads 238, not 218.
- **`tapeRunner.test.js` has 365 tests,** not 360.
- **"`grep -an` … 0 AFTER" holds for code only.** 42 comment and string mentions of `run.<family>` stay, by the "no other change on the line" rule.
- **`r8-*` tapes do not witness chasers, spinners and turrets best.** Turrets appear only on the r5-l40 and r5-l42 tapes. No committed tape opens a bridge at all, so `openBridges` needs a staging.
- **"`Object.is`-identical where the getter returns a live Set/Map" never applies.** Every folded getter returns a fresh object.

## Residue (for C4's `progress()` and `ledger(kind)` folds)

- **Sweep for the blind spots first.** Before rewriting, grep the family files for any `\w+\.<member>` and classify every hit that is not on `run`. The `until.test` predicates, the `STRATEGY_EXECUTORS[…](run)` table and the `{ run }` hand-off at solverBot:8364 are where a run hides under another name. Then re-measure dynamically, which is the only proof.
- **Budget for two probed re-measures, about 25 minutes each on 4 CPUs.** The first finds what the static sweep missed; the second proves the fix.
- **The pattern generalises.** It is one closure function per member, a frozen dispatch table, an exported name list the census reads as text, and a `folded` list in the table. `progress()` is a single call with no key, so it has no dispatch and no name list, but its `folded` list works the same way. `ledger(kind)` is the same shape as `entities(family)`.
- **The census's fold machinery is `entities`-specific** (`ENTITY_QUERY`, `ENTITY_NAMES_EXPORT`, `ENTITY_DISPATCH`). `ledger(kind)` should generalise `entityFindings` to a list of `{ query, namesExport, dispatch }` rather than copying it.
- **Stubs.** Any test that hands a family function a hand-built run needs the query too. `dangerMap.test.js`'s `withFamilies` is the helper to widen.
- **The constants census keys by owner name.** Every getter body with a literal that moves gets a new key (`…Now`), and any hand-written field target on it must follow.
