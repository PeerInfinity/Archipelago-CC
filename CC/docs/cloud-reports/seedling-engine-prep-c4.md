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
