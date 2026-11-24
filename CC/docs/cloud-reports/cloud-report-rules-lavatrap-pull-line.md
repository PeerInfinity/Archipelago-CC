# cloud-report — rules-lavatrap-pull-line: a LavaTrap's maze pull disc takes the game's clear-line test — **DONE, no route moves**

Branch `claude/rules-lavatrap-pull-line-6iik6o`, from `origin/main` **`03872f77c017f9d89703200d9305ba7142f88864`** (it carries rule T).

**Setup.**
- `session_bootstrap.sh --seedling` reached READY.
- The six submodules are initialised. No pointer moved.
- Host settings: `minimal-spoilers`.

Evidence: `CC/docs/cloud-reports/rules-lavatrap-pull-line-evidence/` (`runs/`, `tools/`).

## Answer

| question | result |
|---|---|
| One source for the disc (What 1) | **DONE** (`6cdf4280`). `OV.lavaTrapPulls` applies the launch line once (`pullLineClear`), with a required `solid`. The producer's `playthroughLavaTrapPulls` passes its grid's `wall` cells. Rule T (`trapTongueCells`, the arms), the lifts and the maze (`seedlingMazeProjectionDeps({lavaPulls})`, which refuses by name without it) all read that one disc. No level literal |
| What stands for `"Solid"` | The raw analyzer grid's **`wall`** cells: tiles `Tile.as:24-27` types `"Solid"`, plus scenery that sets `type = "Solid"`. **Pits, lava and water are `"Tile"`: they never cut.** Gated solids (lock, chain, breakable rock) do not cut either: the disc is the one for the cleared state. No stamp turns a cell into or out of `wall` (measured: identical walls across the four grid variants, `runs/cuts-grid.txt`) |
| Unit rows (What 1) | **10/10 green** (`seedlingLavaTrapPullLine.test.js`). Pull disc == the game's clear-line disc == T's tongue disc on L77/L78/L80/L108. Plus: cuts by name; wall cut / clear kept / pit kept; omitted `solid` refused; the yields race reads cut discs. **Mutant** `solid: null` (line test dropped) reds the equality row on 77/78/80 |
| Cuts (What 2) | **4 measured vs 8 expected.** Matches: L77 (6,12) cuts (6,10); L78 (9,6) cuts (11,6) and (9,8). Extra: L80 (2,14) cuts (0,14), a **wall** tile, so no player cell. **Not cut** (§ The 8 expected cuts): L80 (2,16), (5,8) and L108 (8,3), (8,6), (8,9) |
| L108's ferry (What 3) | **Untouched.** None of its pulls is cut (its gaps are pits, `sink`), so no ferry edge is removed |
| Cut cells GAME-witnessed (What 3) | **GAME YES, not pulled**, at all three player cells, holding the Dark Suit: L78 (11,6), L78 (9,8), L77 (6,10). Each was stood on and crossed both ways. Both controls on kept disc cells DO reel (§ Witnesses). **No pull fired through a wall** |
| `yields` (What 3b) | **Unchanged**: (6,5) yields (8,4)→(8,5) to (9,6) (it survives), and (9,6) yields (7,7)→(7,6). No entry changes, so no route-semantics change |
| Where the player is next reeled (3b) | L78 (11,6) → east (12..14,6): **none**. L78 (9,8), along row 8 both ways: **none**. L77 (6,10), along row 10 both ways: **none**. L78 (11,6) → **north**: reeled onto **(9,3)** from (11,4)'s west edge. This is a pre-existing tile-centre bound, not a cut; see § Finding |
| Every room (What 4) | AP_1, `seedling_er`, atlas, partition, world, seed 1 and sphere order: **byte-identical** (`regen-seedling --check`, every step OK, before and after the maze re-record). Maze: only 3 `from` cells are DEL. **No route moves** (table: no verdict moves; certifier: every line identical) |
| Re-record (What 5) | Maze (`827eb6b2`). Derived-rule table by REGEN_RECIPE (`efc2fdb3`, local, `GITHUB_SHA=827eb6b202 --shards=2`): only `inputs.payloadMd5` and `measuredAt` move. Procgen reference (`e6ca7f2e`, maze.md word count). Nothing else moves: `atlas_files.json`, the frontier `sources` (AP_1) md5 and every count pin are unchanged |
| Engine nit (B) (What 6) | **Recorded as a test-only row** (`deriveLevelWorldLogic.pullDiscNit.test.js`, 3/3) on rule K's own L78 sketch payload. With the uncut disc, every pair into r6c11 is pruned `unreachable`. With the line-cut disc, the pair derives `[Ghost Spear]` etc. Outside the engine closure |
| Binding terms 1–7 | **all hold** (§ Binding terms) |
| Bounded vitest | **92 files / 1480 tests green.** This covers the 8 JSUT pins that T's landing missed, and every test that imports the overlay, the guard, the atlas analysis or the producers, or reads the maze preset (`runs/tip/bounded-vitest-files.txt`) |

## The change

- **`seedlingPlaythroughOverlay.js`**
  - `lavaTrapPulls(level, tileSize, { solid })` keeps a disc tile only where `pullLineClear(tile, trap, tileSize, solid)` holds.
  - The line is centre-to-centre and sampled per px; the two end tiles never count. This is T's old `lineClear`, moved into the overlay so it is the one test.
  - `yields` is computed after the cut, from the cut discs.
- **`make-seedling-playthrough-rules.mjs`**
  - `playthroughLavaTrapPulls(level)` is memoised per level. Its walls come from `rawBaseGridFor(level, {DIRECTIONAL_LOCKS, arrivals: true})`.
  - `playthroughLavaTrapPullMap()` hands the discs to the maze.
  - The three old `OV.lavaTrapPulls` calls (T's stamp, T's arms, `applyLavaTrapPulls`) now read it.
- **`seedlingTrapTongueGuard.js`**
  - `trapTongueCells` no longer re-cuts. It drops only the trap tile, blocking cells and exempt cells.
  - `lineClear` is removed from the guard, which no longer uses it.
- **`seedlingAtlasAnalysis.js`**
  - The `pull` row reads `lavaPulls`.
  - A level-world compile without it is refused by name, like `rockFire`.
- **`maze.md` § Pulls** and the fence row are updated.

## The 8 expected cuts vs the 4 measured (What 2)

The designer measured with the **maze's wall tiles** standing in for `"Solid"`, and **the maze lays a sink (pit or lava) as a wall tile**. The game does not: `Tile.as:24-27` types pit, lava and water tiles `"Tile"`, so `collideLine("Solid")` passes over them. Crossing a pit is the overlay's own reason a LavaTrap is a transport (`LAVATRAP_PULL`, `Player.as:718`).

| expected cut | measured | why (grid kind of the cell between) |
|---|---|---|
| L77 (6,12): (6,10) | **cut** | (6,11) `wall` |
| L78 (9,6): (11,6) | **cut** | (10,6) `wall` |
| L78 (9,6): (9,8) | **cut** | (9,7) `wall` |
| L80 (2,14): (2,16) | kept | (2,15) `sink` (not Solid) |
| L80 (5,6): (5,8) | kept | (5,7) `sink` |
| L108 (8,5)/(8,8)/(8,11): (8,3), (8,6), (8,9) | kept | (8,4), (8,7), (8,10) `sink`: the ferry's pits (unit row "L108's ferry keeps every hop") |
| (not expected) L80 (2,14): (0,14) | **cut** | (1,14) `wall`. (0,14) is itself a wall, so the maze's `from` never carried it |

**The game agrees on L108.** This is the hop the whole ferry exists for (`(8,3)->(8,5)` … "32 px to the pixel", `LAVATRAP_PULL`'s header). Cutting those three would have sealed the Fire Wand.

**Pixel raycast cross-check** (`tools/measure-cuts-pixel.mjs` → `runs/cuts-pixel.txt`: `crusher.collideLineSolid` over the model's `"Solid"` boxes, centre to centre):
- It agrees on every grid cut.
- It agrees that nothing at L108 or across the L80 pits is cut.
- It also blocks three more standable cells, all **diagonal corner grazes**, which the per-px tile sampling passes:
  - L78 (9,6): (10,5) and (8,7);
  - L78 (9,3): (10,2), by `lavachain@160,32`, a gated solid.

The game sides with the grid on (10,5): the control arm `L78-control-10-6-from-12-5` walks onto (10,5) and **is reeled onto (9,6) at t24**. Those cells stay in the disc, the side that matches the game.

## Witnesses (What 3) — GAME, `seedling_bot_ap_p4g`, headless logic-only, delivered set, Dark Suit granted, `noDamage`

Tool: `tools/pull-line-witness.mjs`, built on `probe-seedling-l78-pull-order.mjs`'s boot/grant/hold tapes. Hand-authored tapes are committed in `runs/witness/*.tape.json`; the per-tick game positions are in `*.game.json.gz` and the rows in `runs/witness/witness.log`. Each arm is a fresh page.

| arm | ticks | tile path (tile@tick) | reeled onto | hits |
|---|---|---|---|---|
| L78-11-6-in-from-north-stand | 160 | 11,5@0 11,6@8 (stands to t160) | **none** | 0 |
| L78-11-6-cross-to-east | 180 | 11,5@0 11,6@8 12,6@37 13,6@51 14,6@65 | **none** | 0 |
| L78-11-6-in-from-east-and-up | 180 | 12,6@0 11,6@8 (stands to t98) 11,5@98 11,4@111 → 9,3@125 | (9,3) at t121–125, from (11,4), § Finding | 0 |
| L78-9-8-row8-west | 165 | 10,8@0 9,8@8 8,8@21 7,8@35 | **none** | 0 |
| L78-9-8-row8-east | 165 | 8,8@0 9,8@8 10,8@21 11,8@35 | **none** | 0 |
| L78-9-8-stand | 160 | 9,8 throughout | **none** | 0 |
| L77-6-10-row10-east | 195 | 4,10@0 5,10@8 6,10@21 7,10@35 8,10@48 9,10@72 | **none** | 0 |
| L77-6-10-row10-west | 195 | 8,10@0 7,10@9 6,10@22 5,10@36 4,10@49 3,10@63 | **none** | 0 |
| L77-6-10-stand | 160 | 6,10 throughout | **none** | 0 |
| control L78 (11,5)→(10,5) | 140 | 11,5@0 10,5@8 … 9,6@24 | **(9,6) at t24** (reel jumps 6.84 px/tick) | 0 |
| control L77 (7,10)→(7,11) | 150 | 7,10@0 7,11@8 6,12@26 | **(6,12) at t26** | 0 |

- **Verdict: GAME YES.** All three cut player cells are **not pulled** with the Dark Suit, standing or crossing.
- The controls prove the harness sees a pull when the game makes one.
- Source lines: `LavaTrap.as:81-90`. `d <= chompRange && !wait`, then `!collideLine("Solid", x, y, player.x, player.y)` → `launch()`; otherwise `play("")`, re-tested every frame.

**Which granted routes cross a cut cell.** No AP route's rule moves: AP_1 and `seedling_er` are byte-identical, and the table has no verdict move. So no route's "new cheapest state" changes. The witnesses cover the cells anyway, because the maze's reachable sets now include standing on them with the suit.

## Finding (pre-existing, not caused by this slice): the tile-centre disc misses a corner pull at L78 (11,4)

In arm `L78-11-6-in-from-east-and-up`:
- The player walks up column x = 178.05 (the west part of tile 11).
- At t117 it is at (178.05, 72.55), 30.9 px from trap (9,3)'s centre (152,56). It is inside range, with a clear line.
- **The game reels it onto (9,3) at t121–125.**
- Tile (11,4)'s centre is 35.8 px away, so **(11,4) is in no disc, on main or here.** The game measures from the player's own position (`LavaTrap.as:81`), and the maze measures from tile centres.

**Why it matters to K:** K's L78 path to r6c11, `(12,4) → (11,4) → (11,5) → (11,6)`, crosses (11,4). A Dark Suit holder who hugs that tile's west edge can be reeled to (9,3). Ghost Spear or the arm alone walks it (no suit, no reel, the trap dead or the cell T-free). Named for K's planner; not acted on (no level literal, and it is a pixel-vs-tile question beyond this slice).

## Engine nit (B) — recorded, not fixed (What 6)

`frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.pullDiscNit.test.js`. Its fixture is `fixtures/l78-k-sketch-pull-nit-payload.json.gz`: rule K's pass-1 sketch L78 payload from `rules-k-pursuit-speed-0s83t8` @b66f327267, `runs/tip-sketch-outputs`.

| row | measured |
|---|---|
| the fixture is K's: r6c11 = the one cell (11,6); trap (9,6)'s disc holds (11,6) and (9,8) | ✓ |
| UNCUT disc: `level_78__r0c16 → level_78__r6c11` and every other pair into r6c11 `unreachable: true` (the full point is reeled, and the pair is never revisited) | ✓ **the nit, pinned** |
| LINE-CUT disc: `unreachable: false`, minimal ⊇ `[Ghost Spear]`, with suit-less sets | ✓ |

- This test is outside the engine closure: engineMd5 is unchanged.
- It rides with the next engineMd5 mover. Its header says to drop the first row's expectation once the engine revisits a pruned pair.
- **Consequence for K:** with this slice's disc, K's two L78 r6c11 rows should derive. On K's own sketch payload, cut this way, `r0c16→r6c11` gives `[[Ghost Spear], [Progressive Sword], [Wand], [Progressive Shield ×2]]` (`tools/nit-repro.mjs`).

## Binding terms (designer)

| term | base `03872f77` | tip | verdict |
|---|---|---|---|
| 1. engineMd5 | `bec369878feb67081187edca62baa951` | `bec369878feb67081187edca62baa951` (42 files) | ✓ |
| 2. Maze key walk: only L77/L78/L80/L108 pulls (+ sub-region effects) | — | 3 `from` cells DEL: `level_77__r2c0` trap (6,12): (6,10); `level_78__r0c2` trap (9,6): (11,6), (9,8). `yields` unchanged; L80 and L108 pulls unchanged; **0** other payload fields, **0** top-level keys, **0** sub-region effects (`runs/maze-pull-setdiff.txt`) | ✓ |
| 3. Derived-rule table | 106 rows / 50 regions / 6 excluded | 106 / 50 / 6. Only `inputs.payloadMd5` `3bff04ab…` → `104e6bf1…` and `measuredAt` move (`runs/table-keywalk.txt`). Every pinned count in `seedling-derived-rules-expected.json` matches (`runs/table-probe-local.log`) | ✓ (no verdict, so no review owed) |
| 4. Certifier vanilla / `--source=er --arms=new` | 1/16/0, 1/16/0 (OPEN_L63) | 1/16/0, 1/16/0. ER PASS against its expected file. Every problem, accepted and line identical; only the compiled bytes (−266) and timings differ | ✓ |
| 5. Calib, same box | ALL CHECKS PASSED, 115 levels | ALL CHECKS PASSED. `--compare --moved=level_77,level_78`: **PASS, flagged none**; median 0.902 over 37 reference levels; L77 1.087, L78 1.059 normalised (`runs/calib-compare.txt`) | ✓ |
| 6. Seed 1 / ER draw | — | `regen-seedling --check` `seed1` OK (4 files + the index row match a fresh build: spheres, locations and `_Spoiler.txt` byte-identical); `er` OK (the committed draw is unchanged) | ✓ |
| 7. Cut cells on a granted route GAME-witnessed | — | all three player cells: GAME YES, not pulled (§ Witnesses) | ✓ |

## Commits

1. `6cdf4280`: the one disc (overlay, producer, guard, atlas analysis, maze producer wiring), the unit rows, the nit (B) row and fixture, and `maze.md`.
2. `827eb6b2`: maze re-record.
3. `efc2fdb3`: derived-rule table (REGEN_RECIPE, local).
4. `e6ca7f2e`: procgen reference.
5. `b37751eb`: evidence.
6. This report.
