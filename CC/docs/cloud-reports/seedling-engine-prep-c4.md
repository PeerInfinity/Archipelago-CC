# Seedling engine prep C4: the progress and ledger folds (cloud report)

## The two fold lists (the design, committed before any code)

**Starting point:** `origin/main` at `ef6be46826`, as the brief expected. The harness branch is `claude/seedling-engine-prep-c4-7k2t9z`.

**The rule of the fold.** This is C3's rule, applied twice. Each folded getter's body moves, unchanged, into one closure arrow `<name>Now` just above `createLevelRun`'s returned object. The getter becomes `get <name>() { return <name>Now(); }`. Two frozen dispatch tables map each key to its arrow: `PROGRESS_FIELDS` for `run.progress(field)` and `LEDGER_KINDS` for `run.ledger(kind)`. **The key is the getter's own name**, so `run.progress('inventory')` returns exactly what `run.inventory` returns, and `run.ledger('collected')` exactly what `run.collected` returns. The names are exported as `PROGRESS_FIELD_NAMES` and `LEDGER_KIND_NAMES`. The getters stay, because `tapeRunner.js`, the `watch*.js` pages, the acceptance modules and the tests read them.

**Both folds are keyed** (the coordinator's decision, measured in C3). `inventory` and `keys` return copies, so a no-key `progress()` snapshot of all 12 fields would multiply work at 16 + 10 hot-loop sites for no change in behaviour.

**Return shapes, read from the bodies.** Every folded member returns either a fresh object (a copy or a newly built value) or a primitive. None hands out a live object. So the D1 rows assert deep equality, not identity. The one live ledger in the neighbourhood is `transitions` (`return transitions;`), and it does not fold (below).

### Progress: `run.progress(field)`

| field (= getter) | sites | files | `levelRun.js` line | shape | seen |
|---|---|---|---|---|---|
| `inventory` | 16 | botDriverV2 7, solverBot 9 | 10746 | fresh object copy `{ ...inventory }` | both |
| `keys` | 10 | botDriverV2 6, solverBot 4 | 11165 | fresh `Set` of key types | both |
| `primaryWeapon` | 6 | botDriverV2 3, solverBot 3 | 10767 | string / null (`weaponForPress()`) | both |
| `slashInfo` | 5 | botDriverV2 3, solverBot 2 | 12359 | fresh object (state copy, windows, gate) | both |
| `inputRefused` | 3 | botDriverV2 2, solverBot 1 | 11517 | boolean | both |
| `unfiredEquipTicks` | 2 | botDriverV2 2 | 11158 | fresh array of ticks | both |
| `unfiredGrantLevels` | 2 | botDriverV2 2 | 11607 | fresh array of levels | both |
| `frozenTimer` | 1 | botDriverV2 1 | 11998 | number | both |
| `inCeremony` | 1 | botDriverV2 1 | 11533 | boolean | both |
| `primary` | 1 | botDriverV2 1 | 10758 | number (slot) | static (cold) |
| `saveState` | 1 | director 1 | 11186 | fresh object (save arrays) | static (cold) |
| `takenPickups` | 1 | botDriverV2 1 | 11250 | fresh `Set` of pickup keys | both |

12 rows, 49 sites.

### Ledger: `run.ledger(kind)`

| kind (= getter) | sites | files | `levelRun.js` line | shape | seen |
|---|---|---|---|---|---|
| `collected` | 7 | botDriverV2 7 | 11225 | fresh array of row copies | both |
| `sealCollections` | 6 | botDriverV2 6 | 12100 | fresh array of row copies | both |
| `equipsFired` | 4 | botDriverV2 4 | 10785 | fresh array of row copies | both |
| `roomWrites` | 4 | botDriverV2 4 | 11216 | fresh array of row copies | both |
| `blastFreezes` | 3 | botDriverV2 3 | 11994 | fresh array of row copies | static (cold) |
| `chestOpens` | 3 | botDriverV2 3 | 12057 | fresh array of row copies | both |
| `playerDeaths` | 3 | botDriverV2 3 | 11626 | fresh array of row copies | both |
| `playerHits` | 3 | botDriverV2 3 | 11625 | fresh array of row copies | both |
| `treeBurns` | 3 | botDriverV2 3 | 10800 | fresh array of row copies | static (cold) |
| `crusherContacts` | 2 | botDriverV2 2 | 11791 | fresh array of row copies | static (cold) |
| `keyOpens` | 2 | botDriverV2 2 | 11205 | fresh array of row copies | both |
| `lockSnaps` | 2 | botDriverV2 2 | 11236 | fresh array of row copies | both |
| `spinnerPressHits` | 2 | solverBot 2 | 11010 | fresh array of row copies | both |
| `appliedTimedClears` | 1 | director 1 | 11368 | fresh array (built) | static (cold) |
| `arrowVolleys` | 1 | botDriverV2 1 | 12140 | fresh array of row copies | both |
| `bankedClears` | 1 | director 1 | 12088 | fresh array (built) | static (cold) |
| `chaserKillLockOpens` | 1 | solverBot 1 | 11865 | fresh array of row copies | both |
| `earnedClears` | 1 | director 1 | 11373 | fresh array (built, 143 lines) | static (cold) |
| `grantsFired` | 1 | botDriverV2 1 | 11600 | fresh array of row copies | both |
| `presses` | 1 | botDriverV2 1 | 12300 | fresh array of row copies | both |
| `pulserHits` | 1 | botDriverV2 1 | 12104 | fresh array of row copies | both |
| `pulserPlayerHits` | 1 | botDriverV2 1 | 12278 | fresh array of row copies | both |
| `pulserPushes` | 1 | botDriverV2 1 | 12276 | fresh array of row copies | both |
| `ropePulls` | 1 | solverBot 1 | 10789 | fresh array of row copies | both |
| `shieldBossKills` | 1 | solverBot 1 | 12451 | fresh array of row copies | both |
| `shieldBossStabs` | 1 | solverBot 1 | 12442 | fresh array of row copies | both |
| `spinnerKillLockOpens` | 1 | solverBot 1 | 11036 | fresh array of row copies | both |
| `spinnerWrites` | 1 | director 1 | 11000 | fresh array of row copies | static (cold) |
| `turretKills` | 1 | botDriverV2 1 | 11981 | fresh array of row copies | static (cold) |

29 rows, 60 sites.

### The `transitions` decision: it stays a direct member

`transitions` is the one `event-ledger` row classed **physics**, and it does **not** fold into `ledger('transitions')`. Reading it:

- **It is part of the run's minimum contract.** `createLevelRun`'s own `@returns` names `level, world, state, transitions, ticksCompleted, advance`. Any engine has room transitions.
- **It is handed out live** (`get transitions() { return transitions; }`), where every Seedling ledger copies its rows out.
- **51 non-test callers read it** across the frontend and the scripts.
- **Its two family sites hand the whole log on.** `botDriverV2.js:6085` copies it into a result, and `solverBot.js:10103` returns it as a solve result's `transitions`.

Folding it would put one physics row inside an otherwise all-Seedling query, which is the class mix the doc warns the forecast fold about. So the `run:ledger` row is **class seedling / form event-ledger**. The *query* is physics-shaped (any engine could have "a ledger by kind"), but every *kind* it answers is Seedling. `transitions` stays a `run:transitions` row, physics / event-ledger, unchanged.

### The sweep for non-`run` spellings (done first, as C3's residue asks)

`grep -anoE '\b\w+\??\.(<the 41 names>)\b'` over the 11 family files, keeping every hit whose object is not `run`:

- `Main.primary` ×11 (botDriverV2 10, strikePolicy 1) are AS3 names in comments or strings.
- `Object.keys` ×8, and `row.keys`, `p.keys`, `n.keys`, `goals.keys`, `verbs.keys`, `declaredBy.keys`, `before.keys`, `save.keys` and `Player.keys` are `Map.prototype.keys`, plain objects, save arrays or AS3 prose.
- `best.keys` (solverBot:5463) is a search node's key set. `row.presses` (solverBot:2671) is a candidate row's press count.
- `levelRun.saveState` and `levelRun.bankedClears` (director:1473, :1505) are in comments.

**No hit is the run under another name.** No `until.test` predicate written `(r) => r.<member>` reads any of these 41 members, and neither does any `{ run }` hand-off or `STRATEGY_EXECUTORS` target. (`phrase.offMap(dir, k, cell, run)` takes the run under the parameter name `run`, which the census follows.) The static count is therefore the predicted family count, **109 sites** (49 + 60). The first dynamic re-measure is the proof.

### Predicted table after D3

218 − 12 − 29 + 2 = **179 rows**. There is one `run:progress` row with a `fields` column summing to its sites (49), and one `run:ledger` row with a `kinds` column summing to 60. `folded` becomes per-query, `{ entities: […], progress: […], ledger: […] }` (an object keyed by query, so C3's list reads unchanged under `folded.entities`). Every surviving row keeps its class and form. `runObject` goes from 175 to 177 properties (method 11 → 13).

## W0: the bank at `ef6be46826`

| Row | Command | Result |
|---|---|---|
| Ten routes | each `node <route> --check`, ten in parallel; stdout md5 with wall times masked (`/\b\d+\.\ds\b/g`) | all exit 0, stderr empty, every md5 **equal to the recorded one**, 133 s wall |
| Census | `node scripts/procgen/census-seedling-solver-surface.mjs --check` | `GREEN: 218 rows match a fresh census` |
| Constants census | `node scripts/procgen/census-seedling-constants.mjs --check` | `4368 literals; green drift: 0 new + 0 vanished cosmetic/structural, 0 moved` → `PASS` |
| Vitest | `npx vitest run` over botDriverV2, solverBot, dangerMap, director, tapeRunner, levelRun and r8Acceptance `.test.js`, plus `seedlingSolverSurface.test.js` | **981 / 981** in 60 s: botDriverV2 133, solverBot 101, dangerMap 57, director 108, tapeRunner 365, levelRun 100, r8Acceptance 93, surface 24 |

> **Postscript to the design (measured in D3).** Unlike C3's, this design's count held. After D2, the first probed re-measure found **no** family file reading any of the 41 getters at run time; 31 did before. The static sweep was complete, and no D2b was needed.

## Where it ran

- **Started from:** `origin/main` at `ef6be46826`.
- **Branch:** the harness assigned **`claude/seedling-engine-prep-c4-7k2t9z`**, and all work was pushed there. Nothing was pushed to `main`, and no stash was used.
- **Commits:** `74d8cb3` (W0), `f02d43f` (D1), `b0b681e` (D2), `752bd94` (D3), `6dfa99b` (D4), `52ecd00` (D5), and the commit carrying this report (the head).
- **Machine:** 4 CPUs, Node v22.22.2. `session_bootstrap.sh --seedling` reached `READY`.
- **Not touched:** R1's files, AS3, wasm, gitlinks, tapes, expectations, fixtures and `solverView.js`. No `standing-values --write`, no `pytest`, and every vitest run was bounded.
- **One intermediate SHA is red.** The gate `seedlingSolverSurface.test.js` is RED at `b0b681e` (41 rows owed a retirement) and GREEN from `752bd94`.

## What landed, per D

| D | Commit | Verdict |
|---|---|---|
| W0 | `74d8cb3` | **PASS**. The fold lists were committed before any code. |
| D1 | `f02d43f` | **PASS** |
| D2 | `b0b681e` | **PASS**. No D2b: the dynamic re-measure found nothing the sweep missed. |
| D3 | `752bd94` | **PASS**: 218 → **179**, as predicted |
| D4 | `6dfa99b` | **PASS**. Two census predictions were wrong in count, for a correct reason (below). |
| D5 | `52ecd00` + this | **PASS** |

### D1: the two queries

`levelRun.js` changed in five places:

- **The moved bodies.** The 41 getter bodies moved, verbatim, into closure arrows `<name>Now`, placed just above the returned object and after C3's entity arrows. A one-statement `{ return X; }` became `() => X`, with an object literal wrapped as `() => ({ … })`. A block body kept its block, dedented by one level.
- **The getters.** Each is now `get x() { return xNow(); }`. Their docblocks stay on the getters.
- **The dispatch tables.** `PROGRESS_FIELDS` (12 entries) and `LEDGER_KINDS` (29), both frozen.
- **Two new methods,** `progress(field)` and `ledger(kind)`, on C3's shape. Each uses `Object.hasOwn`, so `'constructor'` is refused. An unknown key throws `levelRun.progress: unknown progress field "<f>" — the known fields are …` (or `levelRun.ledger: unknown ledger kind …`).
- **The exports** `PROGRESS_FIELD_NAMES` and `LEDGER_KIND_NAMES`, frozen, beside `ENTITY_FAMILY_NAMES`.

**The move is proven verbatim** (`d1-proof.mjs`: babel, positions and comments stripped, `HEAD` against the tree; an expression-bodied arrow is compared as `{ return X; }`):

```
properties: 175 → 177; added ["progress","ledger"]; removed []
createLevelRun statements: 381 old; new has 43 new (41 arrows + 2 tables); others token-identical 381/381
module statements: 44 old, 44 token-identical; new exports 2
folded bodies SAME 41/41; other properties token-identical 134/134
PROOF HOLDS
```

Every new getter is exactly `return xNow();`, and the property order is unchanged. **Negative control:** `r.persistTag < 0` turned into `<= 0` inside `earnedClearsNow` gave `DIFF earnedClears: old getter body ≠ earnedClearsNow body` and `PROOF FAILS (1)`.

**The constants census moved five keys.** The owners `earnedClears` (three literals) and `slashInfo` (two) became `earnedClearsNow` and `slashInfoNow`, and their class and kind are unchanged. A sorted diff with the line column dropped shows exactly those 5 out and 5 in; every other change is a line number. The one field target, `createLevelRun|earnedClears` (rule/sentinel, "persistTag sign test"), was re-pointed to `earnedClearsNow` in `seedling-constants-fields.csv`. Before that re-point, `--check` gave `FAIL — 4 red item(s)` (three rule rows "gone from the source" and the target that "reaches no row"). After it and `--write`: `0 new + 0 vanished cosmetic/structural, 0 moved` → `PASS`. The `seedling-constants.md` region did not move. **The new methods and tables add no literal.**

**The survey.** Every non-noclip tape in the roster (144) was stepped with this `createLevelRun`, recording which of the 41 members each makes non-trivial: a non-empty collection, or a value that moved off its tick-0 value. A greedy cover weighted by wall time picked eight tapes. **No committed tape makes `crusherContacts` or `pulserPlayerHits` non-trivial**, so two stagings do:

- **L41's crusher.** This is R5 slice 15's own staging, with the rocks declared clear and the player standing in the lane for 60 ticks.
- **`r5-shaft`, walked up into its pulser.** A branch search replayed the tape's first N ticks (N = 0, 100, …) and then held one direction for up to 120 ticks. It found that after tick 2000 the latched pulser's ring reaches the player 34 ticks into an `up` walk. The row replays 2000 ticks, then holds `up` for 40.

**Test rows in `levelRun.test.js`** (16 new, 100 → 116). Every run is staged with **this file's** `createLevelRun`, which is C3's D4 lesson.

- **Name list = dispatch table**, one row per fold. The list has 12 or 29 entries, is frozen, and each entry is a getter. The refusal's "known …" list equals the export.
- **An unknown key throws by name**, one row per fold. Covered: a typo, `'constructor'` and `undefined`.
- **The three folds are disjoint,** and `transitions` is in none of them.
- **Query equals getter for all 41 members at every tick,** deep-strictly, over:
  - eight tapes: r8-d2 (20 members), r4-walk-5-spear (5), r5-totem-entrance-control (4), r9-solve-16 (3), r6-contact-pair-heart (2), r2-walk-2-feather, r5-l37-burn and r5-l40-part5-control (3);
  - the two stagings.
- **Every one of the 41 was witnessed non-trivially.**

### D2: the family walks through the queries

**The rewrite.** An AST rewrite replaced only the property span of each `run.<member>` / `run?.<member>`. It changed **109 sites**: botDriverV2 78, solverBot 26 and director 5. That equals the census count per member and file, 0 mismatches against the table. It refuses an assignment to or a call of a folded member; there were none.

**Proof:** the reverse substitution `run(\??)\.(progress|ledger)\('X'\)` → `run$1.X` restores `HEAD` byte for byte in all three files (`cmp` exit 0). No family file called `.progress(` or `.ledger(` before.

**Test stubs.** Four tests handed family functions plain-object runs, and each went RED with `run.ledger is not a function` or `run.progress is not a function`. The fakes gained queries that answer from their own fields, in C3's style:

- `director.test.js`: the three `jsLiveEnvelope` runs gained `ledger()` and `progress()`;
- `solverBot.test.js`: the two `strikePolicyFor` bags gained `progress()`, and the first also `entities()`, since it carries `strikeBodies`.

No non-test caller builds a fake run. `census-seedling-campaign.mjs` and `watchViewer.js` pass real runs.

**Gates:**

- botDriverV2, solverBot, dangerMap, director, tapeRunner and r8Acceptance: 853/857 before the stubs, then 209/209 on the two stub files.
- The ten routes are byte-identical (below).

### D3: the census generalises; the table shrinks

**The census code** (`seedlingSolverSurface.js`):

- **`FOLDS`** is a frozen list of `{ query, namesExport, dispatch, noun, column }` entries for `entities`, `progress` and `ledger`.
- **`foldKeysOf()`** reads every fold's name list and dispatch keys as text.
- **A `run.<query>('<literal>')` read carries `key`.** Entity reads also still carry `family`.
- **A non-literal key is a blind spot** of kind `<query>-nonliteral`.
- **`foldKeySites(c, query)`** fills the row's column.
- **`foldFindings()`** replaces `entityFindings`. It adds one refusal: a getter folded behind two queries.
- **C3's names stay as aliases:** `ENTITY_QUERY`, `entityFamiliesOf`, `entityFamilySites` and `entityFindings`.
- **`compareToTable`'s `entities` key is now `folds`,** and the CLI prints `RED fold:` and one `<query> fold:` summary line per fold.

**The table's shape:**

- **`folded` is keyed by query:** `{ entities: [23], progress: [12], ledger: [29] }`. I chose keyed over a flat list with a `query` column because C3's list stays readable as it was, under `folded.entities`.
- **Each query's row carries its own column:** `families`, `fields` or `kinds`.

**`--check` after D2, before `--write`: 50 RED.** They were:

- 41 of the form `RED retired: run:<member> — nothing reaches it — it must be RETIRED`, one for each of the 41;
- 6 of the form `RED unlisted: <file>:<line> reaches run:progress|run:ledger — not in the contract table` (botDriverV2:585 and :1374, director:1492 and :1441, solverBot:1473 and :6073);
- 3 `RED fold: seedling-solver-surface.json#folded.<query> the table's folded.<query> list [] ≠ … — run --write`. The entities one fires because the committed `folded` was still C3's flat array.

**The probed re-measure** (`measure-seedling-solver-surface.mjs --write`, once, at the D2 tree, about 28 min):

- **10/10 `SAME`.** The three `regenerate-r*-tapes` rows are `SAME(wall-time normalised)`.
- **Run members reached: 62 → 40.**
- **Family reads of the 41 folded getters: 31 → 0.**
- `run.progress` shows 88,749 family reads (botDriverV2 74,351, solverBot 14,398), and `run.ledger` 10,036 (2,675 and 7,361).
- **Eight folded getters are still read, only by route scripts:** `inventory`, `keys`, `playerHits`, `playerDeaths`, `chestOpens`, `earnedClears`, `spinnerPressHits` and `spinnerKillLockOpens`. The scripts are `solve-seedling-*.mjs` and `provisionalLatch.js`, which are callers, not rows.

**One re-measure, not two.** The brief budgeted two, one to find and one to prove the fix. The first found nothing, and the family and simulation files have not changed since it ran (D3–D5 touch only the census, tests and docs). So its record is the record of the final tree, and a second run would re-measure identical inputs.

**`--write`:** `179 rows — 2 UNCLASSIFIED`. Both were classified by hand in the `run:entities` row's style:

- `run:progress` is **seedling / live-state**;
- `run:ledger` is **seedling / event-ledger**.

`--check` then gave `GREEN: 179 rows match a fresh census`. Across the **177 surviving rows**, class, form, why, files, sites, seen, via, dynamic and families are all **unchanged**; only the informational `line` moved (33 rows). `runObject` went from 175 to 177 (method 11 → 13).

- `run:progress`: sites 49 (botDriverV2 29, director 1, solverBot 19), `fields` summing to 49, `seen: both`.
- `run:ledger`: sites 60 (49 / 4 / 7), `kinds` summing to 60, `seen: both`.

**The gate** went from 24 to 36 tests (28 non-mutant plus the eight C4 mutants), about 12 s:

- **(vi)** C3's check, re-keyed to `folded.entities`.
- **(vii) ×3**, one per fold: no fold findings; the census's names = the dispatch keys = `levelRun.js`'s runtime export = the table's `folded.<query>`; no folded row; the column equals a fresh census and sums to the row's sites; the row carries only its own column.
- **(vii′)** the folds are disjoint, and `transitions` is none of them and is still physics / event-ledger.

## The ten routes, before → after

The table shows stdout md5 with wall times masked; exit was 0 and stderr empty in every run. Each column is the same bank script run at that tree.

| Route | W0 (`ef6be46`) | D1 (`f02d43f` tree) | D2 (`b0b681e` tree) | probed re-measure (D2 tree) |
|---|---|---|---|---|
| `solve-seedling-r8-battery` | `410f27c077b1ee854a14c24b73dc6335` | same | same | SAME |
| `solve-seedling-r8-d2` | `f2cfe3f99f919e769e6b0a102b796c45` | same | same | SAME |
| `solve-seedling-r8-d2-chain` | `b470c14d1d272fb7d0e03fdcde9cf20e` | same | same | SAME |
| `solve-seedling-r8-l18` | `17be7d70e7bf116f9c3438de04be6b15` | same | same | SAME |
| `solve-seedling-r8-tail` | `9a6a31925cb5204eee4cb0ad66febed6` | same | same | SAME |
| `solve-seedling-r9-l3` | `6cd35fe1414af6bf5beb7605f235cb8e` | same | same | SAME |
| `solve-seedling-r9-campaign` | `2823a8112d1cb76e6d0324a5cf713085` | same | same | SAME |
| `regenerate-r2-tapes` | `4c2cad46474555a132a84c78ef1b44fc` | same | same | SAME (wall-time normalised) |
| `regenerate-r3-tapes` | `7e0cf44426ffb65e381ae86a7bfb432f` | same | same | SAME (wall-time normalised) |
| `regenerate-r4-tapes` | `608d2d8c14000365daa466bbc9a95090` | same | same | SAME (wall-time normalised) |

Every md5 equals the recorded one. The bank walls were 133 s, 131 s and 128 s. The D2 tree's family and simulation files are the head's.

## Per-member sites, before → after

**109 → 0.** Every site is a direct `run.<member>` read; the sweep and the dynamic probe found no blind-spot read.

| query | member | before (census) | after |
|---|---|---|---|
| progress | `inventory` | 16 (botDriverV2 7, solverBot 9) | 0 |
| progress | `keys` | 10 (6, 4) | 0 |
| progress | `primaryWeapon` | 6 (3, 3) | 0 |
| progress | `slashInfo` | 5 (3, 2) | 0 |
| progress | `inputRefused` | 3 (2, 1) | 0 |
| progress | `unfiredEquipTicks`, `unfiredGrantLevels` | 2 each (botDriverV2) | 0 |
| progress | `frozenTimer`, `inCeremony`, `primary`, `takenPickups` | 1 each (botDriverV2) | 0 |
| progress | `saveState` | 1 (director) | 0 |
| ledger | `collected` | 7 (botDriverV2) | 0 |
| ledger | `sealCollections` | 6 (botDriverV2) | 0 |
| ledger | `equipsFired`, `roomWrites` | 4 each (botDriverV2) | 0 |
| ledger | `blastFreezes`, `chestOpens`, `playerDeaths`, `playerHits`, `treeBurns` | 3 each (botDriverV2) | 0 |
| ledger | `crusherContacts`, `keyOpens`, `lockSnaps` | 2 each (botDriverV2) | 0 |
| ledger | `spinnerPressHits` | 2 (solverBot) | 0 |
| ledger | `arrowVolleys`, `grantsFired`, `presses`, `pulserHits`, `pulserPlayerHits`, `pulserPushes`, `turretKills` | 1 each (botDriverV2) | 0 |
| ledger | `chaserKillLockOpens`, `ropePulls`, `shieldBossKills`, `shieldBossStabs`, `spinnerKillLockOpens` | 1 each (solverBot) | 0 |
| ledger | `appliedTimedClears`, `bankedClears`, `earnedClears`, `spinnerWrites` | 1 each (director) | 0 |

**The table: 218 → 179.** `transitions` stays a row (physics / event-ledger, 2 sites).

## D4: mutants

Each mutant was predicted first. The predictions were written to the session scratchpad, timestamped, before any mutant ran. The census mutants run over `os.tmpdir()` copies inside the gate's new `describe('the progress and ledger folds (engine-prep C4), mutants over a temporary copy')`. The runtime mutants ran on `levelRun.mut.js` beside the original plus a copy of `levelRun.test.js` importing it, running the C4 block only; both files were deleted afterwards. `git status` was clean of mutant files after every run.

| Mutant | Predicted | Measured |
|---|---|---|
| (a) `run.inventory` read in a copy of `dangerMap.js` | exactly 1 RED "folded behind" | **1**: `dangerMap.js:1055 reads run.inventory directly — it is folded behind run.progress('inventory'); a family file reads it through the query` |
| (a′) `run.collected` read in a copy | 1 RED "folded behind run.ledger" | **1**, as predicted |
| (b) `run.ledger('chestOpen')` | 1 RED "unknown ledger kind" (static) | **Wrong count: 2.** `dangerMap.js:1055 reaches run:ledger — the row names only botDriverV2.js, director.js, solverBot.js`, plus `… run.ledger('chestOpen') — unknown ledger kind; levelRun.js's LEDGER_KINDS holds collected, sealCollections, …`. dangerMap reads no ledger, so the `files` rule also fires. C3's dangerMap mutants never saw this, because dangerMap already asks `entities`. The row now asserts both lines. The runtime half is the D1 unit row: `run.ledger(typo)` throws `unknown ledger kind "…" — the known kinds are …`. |
| (c) `run.progress(f)` with a variable | 1 RED blind spot | **Wrong count: 2**, for the same reason: `reaches run:progress — the row names only …`, plus `run.progress(f) — not a string literal — a BLIND SPOT: the census cannot name the field, so a family file passes a string literal` |
| (d) `inventory: inventoryNow,` removed from `PROGRESS_FIELDS`, census | 16 unknown + 1 names ≠ dispatch = **17** | **17** |
| (d) the same, runtime (the 16 C4 rows) | 13 RED: the progress name and unknown-key rows, 8 tapes, 2 stagings, the witness row. 3 GREEN: the ledger name and unknown-key rows, the disjoint row | **13 RED / 3 GREEN, exactly those** |
| (d′) `collected: sealCollectionsNow`, census | GREEN: the census sees keys, not values | **GREEN**, asserted as a gate row |
| (d′) the same, runtime | RED on the tapes where `collected` or `sealCollections` is ever non-empty (r8-d2, r4-walk-5-spear, r5-totem-entrance-control, and the r5-shaft staging only if its first 2040 ticks collect), plus the witness row: 4 or 5 | **4 RED** (the three tapes and the witness row) **/ 12 GREEN**. The r5-shaft staging stays GREEN: nothing is collected or sealed before tick 2040. |
| (e) comments naming `run.inventory` and `run.collected` | GREEN | GREEN |
| (f) extra: `'keys'` added to `LEDGER_KIND_NAMES` | 3 RED: "folded behind both", ledger names ≠ dispatch, and table `folded.ledger` ≠ names | **3**, as predicted |

## D5: records

- **The doc.** `seedling-solver-surface.md` gains two sections:
  - **§ *The progress and ledger folds*:** what folded (41 getters and 109 sites, by file); why both folds are keyed; why `transitions` did not fold; one function, two faces; the witnesses and the two stagings.
  - **§ *How the census sees a fold*:** the `FOLDS` table, the per-query `folded` and columns, the five refusals, and the five steps to fold another member.

  C3's entities section keeps its content, with its "did not fold" bullets pointing to C4 and its census paragraph pointing to the generalised section. **The page's numbers are updated:**
  - 177 properties (13 methods);
  - the family reads 23 (was 62);
  - the run / seedling cell is 10 / 297 (was 49 / 297); live-state 2 / 221, event-ledger 1 / 60;
  - the heaviest list gains `run.ledger` 60 and `run.progress` 49 and loses `run.inventory` 16;
  - static against dynamic: 21 of 23 run members reached;
  - cold members 16 → 6. Thirteen former cold rows are now cold keys inside warm rows, which is listed.
  - Narrowing ranks 3 and 4 are marked **DONE**. Rank 4's first count, 13 / 50, included `talkCircles`, which C3 folded.
- **No new doc, and no new link.**
- **The generator.** `node scripts/procgen/generate-procgen-reference.mjs` changed only word counts: `README.md` and `procgenDocs/generated/docsIndex.js`, with this page going from 3204 to 3872 words. Then `--check`: `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`.
- **Bounded vitest.** `npx vitest run frontend/modules/seedlingDemo frontend/modules/procgenDocs scripts/procgen/seedlingSolverSurface.test.js scripts/procgen/seedlingConstantsCensus.test.js`: **182 files, 6408 / 6408 passed**, exit 0, **189 s** wall.
- **Census checks at the head.** `census-seedling-solver-surface.mjs --check`: `GREEN: 179 rows match a fresh census`. `census-seedling-constants.mjs --check`: `PASS`.

## What the brief got wrong (measured)

- **"Budget TWO probed re-measures" needed one.** The static sweep this time was complete: 0 non-`run` spellings, and 0 family reads of a folded getter after D2. The first re-measure is also the final one, because the family and simulation trees did not change after it.
- **Mutants (b) and (c) are two RED lines each, not one.** A new query read from a file that never asked that query is also a `files` finding. The brief's "(b) RED unknown kind" holds, but not alone.
- **Two of the 41 members have no committed-tape witness.** `crusherContacts` and `pulserPlayerHits` are never non-trivial on any of the 144 non-noclip tapes. The `r5-shaft` pulse staging had to be found by a branch search.
- **"(d) a dispatch entry removed ⇒ the D1 rows RED" is 13 of 16.** The ledger fold's two name rows and the disjoint row are rightly GREEN when a *progress* entry is removed.
- **The constants census moved five keys, not a hand-written target alone.** `slashInfo`'s two structural literals moved owner too. Only `earnedClears` had a field target to follow.
- **`tapeRunner.test.js` (365) held.** The brief's number was right this time. For the record, the seedlingDemo + procgenDocs + two-census battery is 6408 at the head (C3 reported 6362 at its head); this slice added 28 (levelRun +16, surface gate +12).
- **The page's own "48 files" for the simulation is stale.** The table says 50 (`simulation.files`). It is pre-existing and was left alone.

## Residue: the queue for after the arc

- **`world.roster(family)`** (narrowing rank 2, 11 → 1, 85 sites) is the same fold on the WORLD object: `levelWorld.js`'s `buildLevelWorld` returns the rosters (`activators`, `pressers`, `arrowTraps`, `pushables`, `combat`, …).
  - `FOLDS` generalises to it by adding an entry. It needs a `surface` field (today every fold is a `run` query), and `foldKeysOf` must look for the dispatch table in `buildLevelWorld` rather than `createLevelRun`.
  - The census already tracks world values through `const w = run.world`, parameters named `level` in `botDriverV2.js`, and one level down. So a world fold's blind-spot sweep must cover those spellings (`level.activators`, `w.pressers`), not just `run.world.x`.
  - Some world rosters are arrays read by index or `.find`, not live views. Check each getter-vs-value kind before assuming C3's "one arrow, two faces" applies; a plain value property has no body to move.
- **The forecasts** (rank 11, `run.forecast(kind, h)`, 4 → 1, 16 sites) mix the physics `gameTimeAt` with three Seedling forecasts. By this slice's `transitions` precedent, `gameTimeAt` stays out and the fold is Seedling-only, 3 → 1. Forecasts take arguments (`h`, a horizon), so the dispatch entries are arrows with parameters. That is new for the census: it would read the key from argument 0 and must not treat argument 1 as a blind spot.
- **The import facades** (ranks 5–10, `presses.js`, `spinner.js`, `activators.js`, `arrowTrap.js`, `combat.js` and `combatVerbs.js`) are import folds, not run folds. They belong in `solverView.js` as namespaced re-exports, and the census's door machinery rather than `FOLDS` is what would carry them. `solverView.js` was not touched here.
- **Route scripts still read eight folded getters directly** (listed in D3). They are callers, so nothing requires them to move. If a later gate wants "only the queries" beyond the family, that list is the starting set.
- **Merge note for the coordinator.** R1 edits `seedling-bot.md`, and this slice regenerated the procgen docs index. `docs/json/developer/procgen/README.md` and `frontend/modules/procgenDocs/generated/docsIndex.js` will conflict on word counts only; re-run `generate-procgen-reference.mjs` after merging both.
