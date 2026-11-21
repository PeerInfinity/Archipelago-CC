# cloud-report — rules-k-pursuit-speed: rule K with term (b), wired after T — **STOPPED at the certifier (L78 +2 rows)**

Branch `claude/rules-k-pursuit-speed-0s83t8`, from `origin/main` **`23c6bbab9172ed309bdade32763bd94a442c28ba`** (it carries rule T).

**Setup.**
- `session_bootstrap.sh --seedling` reached READY.
- The six submodules are initialised and no pointer moved.
- Host settings: `minimal-spoilers`.
- **The base is fresh.** `regen-seedling.mjs --check` at base reported every step OK: rules, partition, world, template, host-settings, seed1, maze, er, sphere-order and census, in 51.6 s.

Evidence: `CC/docs/cloud-reports/rules-k-pursuit-speed-evidence/`.

## Answer

| question | result |
|---|---|
| K + (b) ported, general and derived (no level literal, no typed speed) | **DONE**, `0e2c7de72d`: `scripts/procgen/seedlingChaserPursuitGuard.js` plus the producer wiring |
| (b) unit rows: 5 rows, each speed measured in the test, and a mutant per row that reds it | **DONE**: 10/10 green. T's rows are 15/15 (one L77 row now also pays K's arm) |
| Movers = the report's (b) column, with T on | **YES**: 15 routes move, all in the (b) column (table below). L77 L76→L78 composes to T's rule unchanged (§ Compose). Nothing moves outside the column |
| Composition with T on L77/L78 | **DONE**: And(T, K) on shared cells, or a cell is left alone where it already holds the arm or a disjunct of it (§ Compose) |
| Lift rewiring off a gated cell | **NAMED**: L80 `r8c4 → r6c4` (Dark Suit) would vanish. A K-gated from-tile now lifts from the sub-regions beside it at `And(Dark Suit, K arm)` |
| Maze key walk levels (designer term 2) | 71–75, 77, 78, 80, 98, 99, plus **34 and 65**. The L34/L65 changes are table-aside artifacts: L34 `Wand` → `Or(Wand, And(Fire Wand Fusion, Wand, Fire))` is the same truth table, and L65 is a child reorder (§ Term 2) |
| Derived-rule table, regenerated locally | 106 → 99 rows. 7 K-level rows are deleted (L72 ×2, L74 ×3, L75 ×2). The L98 rename row is equal under the map. `excluded` is unchanged and engineMd5 is unchanged |
| **Certifier at tip** | **3 / 16 / 0, vs 1 / 16 / 0 at base.** Two rows are GAINED on **L78**: `level_78__r0c16 → level_78__r6c11` and `level_78__r0c2 → level_78__r6c11`, both holding [Ghost Spear, Progressive Shield, Wand]. Each reads **derived false, atlas true**. **= STOP** (brief term 3: "A row gained in a K/T room = STOP") |
| engineMd5 | `bec369878feb67081187edca62baa951` at base and in the candidate table: unchanged |
| Re-record (rules, partition, maze, ER, world, seed 1, table, sphere order, atlas_files, reference) | **NOT DONE**: stopped before it. The pass-1 outputs are evidence only (`runs/tip-sketch-outputs/`) |
| Seed 1 / ER draw | **NOT RUN**: stopped before `Generate.py` |

⚠ **The branch's code commit leaves the committed artifacts STALE.** The producer now stamps K, but the atlas, maze and table are main's. `rules --check` and the derived-rule freshness test fail on this branch. This is deliberate: nothing was re-recorded past the STOP.

## The STOP: why L78 r6c11 is "derived false" (measured)

1. **K's cut makes `(11,6)` a one-cell sub-region.**
   - At base, `(11,6)` lies inside `r0c16`'s big sub-region B (`runs/tip/L78-partition.txt`).
   - With K, `(11,5)`, `(12,6)`, `(11,4)` and others are gated. `(11,6)` becomes its own sub-region `r6c11` (J).
   - Its only ways in are K or K+T cells (`runs/tip/L78-grid.txt`).
2. **`(11,6)` is in lavatrap (9,6)'s maze pull disc, but not in T's disc.**
   - The maze payload's `pulls[2].from` lists `{x:11, y:6}`. The pulls are `OV.lavaTrapPulls`, which have no line test.
   - T keeps only clear-line cells (`LavaTrap.as:88` `collideLine("Solid")`). The wall at `(10,6)` blocks that line, so T does not gate `(11,6)`.
   - In the game, the trap does not launch at a player on `(11,6)`.
3. **The derivation is not monotone here.** `deriveLevelWorldLogic` (`deriveLevelWorldLogic.js:333-345`) searches the FULL point first and marks a pair `unreachable` when the full reach misses the target. It never revisits that pair.
   - Holding the Dark Suit, a move into `(11,6)` from outside the disc is reeled onto `(9,6)` (`mazeRoomEngine.pullAfterMove`, `:995-998`). So the full-inventory reach never stands on J.
   - The engine's own `step` BFS from `r0c16`'s entrance `(16,1)`, measured in `runs/tip/L78-bfs-from-r0c16.txt`:
     - holding [Ghost Spear, Progressive Shield, Wand], it **reaches `(11,6)`**;
     - with the Dark Suit and Progressive Sword added, it **does not**.
4. **The atlas is right.** Ghost Spear pays K's arm and T's `Or(Dark Suit, Ghost Spear)` on every cell of the path `(15,4) → (14,4) → (13,4) → (12,4) → (11,4) → (11,5) → (11,6)`.

**No general fix is in this slice's scope.** Each candidate touches something the brief puts out of bounds:
- the maze pull disc with T's line test: overlay / maze data;
- a monotone-safe pair search: engine (`deriveLevelWorldLogic`; engineMd5 would move);
- a K exemption for a cell a pull disc covers: a rule change that would make K looser than the game, with no witness.

This is the planner's call. The obvious candidate is to apply T's clear-line test to the pull disc (`OV.lavaTrapPulls`), which is what the game does (`LavaTrap.as:86-88`).

## Term (b): the speeds, measured off the ports (the unit rows re-measure them)

| mover | px/tick | port |
|---|---|---|
| player walk / swim (lava, water) | **1.1746** / **0.45** | `playerPhysicsV1.step` (`Player.as:73`, `:1515-1555`, `:544-548`; `Mobile.as:73-84`) |
| lavarunner walk / swim | **1.25** / **0.75** | `chasers.chaserStep` with `CHASERS.lavarunner.speedByTerrain` (`Bob.as:57-75`, `LavaRunner.as:17-18,84-93`) |
| puncher | 0.75 | `chasers.chaserStep` (`Puncher.as:18,62-73`) |
| drill | 1.0667 | `drill.stepDrill` + `stepDrillGraphic` (`Drill.as:27-28,85-110`) |

**The rule.** K's candidate (nominal speed > dMS, homing with a leash, contact hits) is kept iff `pursuitFaster(tag, flood terrains)` is non-empty. That is strict `>`, per tile type of the body's own flood.

**On the delivered map** (unit row "the delivered set"):
- the guards are **lavarunners only**;
- every puncher and drill K would charge is dropped;
- L72 has three runners: `@80,216`, `@136,88` and `@216,240`.

**The five unit rows and their mutants.** Each mutant reds its row:

| row | expected | mutant that reds it |
|---|---|---|
| runner on floor | charged | `flip` |
| runner in lava vs a swimming player | charged | `walk`: the swim speed taken as walk |
| puncher | dropped | `flip` |
| drill | dropped | `dms`: the player typed at 0.8 |
| a drill beside lava it dies in (its flood has no outrun tile) | dropped | `room`: terrains read off the room, not the flood |

## K's arm per class (task 2)

**The one guarding class** is `lavarunner`. Its arm is `KILL_ARM_CONDITION` = `Or(Progressive Sword, Ghost Spear, Wand, Progressive Shield ×2)`:
- `seedlingPlaythroughOverlay.js:498`;
- the class row `KILL_LOCK_BODY_CLASSES.lavarunner`, `:513-515` (`LavaRunner.as:38,41`).

No class here falls back to `ENEMY_CLASSES.kill`. The arm is neither widened nor narrowed.

**What the (b) rows' GAME YES witnesses actually used** (from rules-k-chaser-narrowing; not re-witnessed):

| row | GAME witness | arm the witness used | vs the census arm |
|---|---|---|---|
| L72 L71→L73, item-less | **GAME NO** (hit t35) | — | charged ✔ |
| L72 L73→L71, item-less | not witnessed item-less | — | charged |
| L72 Dark Suit alone, both ways | **GAME YES** (`beam/L72-71to73-suit`, `-73to71-suit`, t376, 0 hits) | **none** (Dark Suit, no kill) | **FINDING**: the census arm excludes the Dark Suit (`KILL_ARM_EXCLUDED`), so tip charges `Dark Suit & arm`. A known over-charge, kept (⚖ Robert) |
| L73 L72↔L74, Dark Suit | GAME NO (attempts t43, t117) | — | charged ✔ |
| L74 L73→L75 and the Darkshield | GAME NO (attempt t81) | — | charged ✔ |
| L74 L75→L73 | UNWITNESSED (a bulb hits) | — | charged |
| L75 L74→L71, item-less | **GAME YES** (`movers/L75-74to71`, t216) | **none** (the two-runner jam) | **FINDING**, the known over-charge, kept (⚖ Robert) |
| L75 L71→L74 | UNWITNESSED (grenade blast t66) | — | charged |
| L77 L78→L76 | GAME NO item-less (t15–37) | — | charged ✔ |
| L77 L76→L78 | T decides it (trap kills, t32) | — | composed: unchanged (below) |
| L78 L77↔L79, Dark Suit | GAME NO (attempts t212, t57) | — | charged ✔ |
| L80 chest from L71 / from L79, L79→L71 (Dark Suit) | GAME NO (attempts; L79→L71 t153) | — | charged ✔ |

No row is made looser than main: every move is base ⊂ tip in strictness.

## Movers (task 4): the route walk, with T on

`runs/route-diff-b-T-seedling_playthrough{,_maze}.txt` holds the walk for AP_1 and the maze, both with the table aside (as the prior sketch did); the two give the same 15 rows. The T-off sketch's rule is `sketch-route-diff-b-*` on the prior branch.

| route | base (T on) | tip (K+T) |
|---|---|---|
| L72 L71→L73, L73→L71 | FREE | Ghost Spear \| Shield×2 \| Sword \| Wand |
| L73 L72→L74, L74→L72 | Dark Suit \| Ghost Spear \| Sword | Dark Suit&Shield×2 \| Dark Suit&Wand \| Ghost Spear \| Sword |
| L74 L73→L75, L73→Darkshield, L75→L73 | FREE | the arm |
| L75 L71→L74, L74→L71 | FREE | the arm |
| L77 L78→L76 | Dark Suit \| Ghost Spear (T) | Dark Suit&Shield×2 \| Dark Suit&Sword \| Dark Suit&Wand \| Ghost Spear |
| L78 L77→L79, L79→L77 | Dark Suit \| Ghost Spear (T) | as L77 L78→L76 |
| L80 chest from L71, chest from L79, L79→L71 | Dark Suit | Dark Suit & the arm |

**16 T-off routes → 15 here.** The missing one is **L77 L76→L78**. It is not a missing mover; it is the composition:
- T's base rule is `Or(Dark Suit, Ghost Spear)`.
- The T-off sketch's K rule is `Or(Dark Suit, Ghost Spear, Shield×2, Sword, Wand)`.
- Their AND is `Or(Dark Suit, Ghost Spear)`, which is T's rule unchanged.

**Composed with T, every L76↔L78 / L77↔L79 row** (`runs/L76-L79-composed.txt`):
- **L78→L76 and L77↔L79:** were `Dark Suit | Ghost Spear`, and are now `Ghost Spear | Dark Suit & (Sword | Wand | Shield×2)`.
- **L76→L78:** `Dark Suit | Ghost Spear` both sides.
- **The FREE same-door returns:** FREE both sides.

## Compose (task 3) and the two-grid split (designer term 1)

**Composition.**
- K is **measured on the grid before T**. A T-gated cell is not terrain to a body's flood (`FCG.bodyRegion`), so measuring after T would cut the runner off.
- K is then **stamped onto T's grid** with T's own `stampOccupancy`.
- The unit row "K on a T cell composes" pins `[T, arm]` on a shared cell, and pins a cell holding a disjunct of the arm as left alone.
- On L78, `atlas_gate_5` = `(Dark Suit OR Ghost Spear) AND (Sword OR Ghost Spear OR Wand OR Shield×2)` is that AND, laid in the maze.

**The two-grid split.**
- K rides the same `guards:false` exclusions as T: the pit census, the rock Fire narrowings and the block push model.
- Over the pass-1 maze key walk, **0** changed paths name a block (`runs/keywalk-seedling_playthrough_maze_AP_1_rules.txt`).
- A gated cell that a block must cross: none was measured. The levels K stamps hold no pushable block whose path the walk moved.

## Term 2 and term 4 (partial; measured before the STOP)

**Maze key walk** (1362 paths; `runs/keywalk-seedling_playthrough_maze_AP_1_rules.txt`):
- The changed sidecars and regions are on L71, L73, L77, L78, L80, L98 and L99.
- `level_34` and `level_65` also change, both because the table is aside:
  - L34 `Has(Wand)` → `Or(Wand, And(Fire Wand Fusion, Wand, Fire))`: the same truth table;
  - L65 is a child reorder.
- The sphere-log keys change by sub-region names only.
- A key walk with the regenerated table in place was not reached.

**Table** (`runs/table/table-diff.txt`; candidate measured locally at `0e2c7de72d`, payloadMd5 `3bff04ab → e7f7f029`):
- **DEL (K levels, 7):**
  - `level_72|level_72 -> level_71__r0c6`, `level_72|level_72 -> level_73__r3c7`;
  - `level_74|@Level 074 - Darkshield`, `level_74|level_74 -> level_73__r0c4`, `level_74|level_74 -> level_75`;
  - `level_75|level_75 -> level_71__r0c6`, `level_75|level_75 -> level_74`.
- **The rename:** `level_98|level_98 -> level_99__r2c7` → `level_98|level_98 -> level_99__r7c5`. It is equal under the map `level_99__r2c7 → level_99__r7c5`: **True**.
- **No other row moves.**
- The count drift, 17 counts, is in `runs/table/count-drift.txt` (`certifier.problems` 1 → 3 is the STOP above). `seedling-derived-rules-expected.json` was not re-pinned.

## Not done because of the STOP

- the re-record by recipe (atlas, AP_1, partition, maze, `seedling_er`, world, seed 1, sphere order, `atlas_files.json`, `generate-procgen-reference.mjs`, the frontier md5);
- the ER certifier at the tip;
- calib at the tip (base `calib-levels.json` was measured: ALL CHECKS PASSED, 115 levels, at `23c6bbab91`; kept off the tree);
- seed 1's sphere and spoiler check;
- the ER draw.

## Commits

- `0e2c7de72d`: rule K + (b), the producer wiring (measured before T, stamped after it), the L80 lift rewiring, the unit rows, and the T row update.
- `42e5b56c`: evidence.
- this report.
