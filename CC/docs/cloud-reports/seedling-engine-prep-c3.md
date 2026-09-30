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
