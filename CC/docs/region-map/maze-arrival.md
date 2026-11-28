# Region map: where a maze exit lands the player

Branch `maze-arrival-spawns`, cut at origin/main `b6863466be`. Before the packet, origin/main `aa749df335` (train an-myst1)
was merged in: **the gated tip is the merge `442a4afdf6`**. This report is a docs-only commit after it.

## The rulings

- Session 84c8ab35 (archipelago-cc-23), **2026-11-28T03:33:37.957Z**: *"I also want to change the maze substrate to know
  where the player arrives, if it doesn't already know. I think it currently assumes that exits come in two-way pairs, and
  the player arrives on the square of the corresponding exit. Is that rule sufficient to resolve the ambiguity you
  mentioned?"*
- Session 84c8ab35, **2026-11-28T03:38:16.825Z** (AskUserQuestion): arrivals **"Copy Seedling's real ones
  (Recommended)"** (generated maze worlds fall back to the pair rule) and **"Maps only for now (Recommended)"** (the Region
  Map / Region Graph use them; gameplay unchanged).
- js-24 (reviewer), 2026-11-28, after this session stopped on the table hash: **option A** (regenerate the maze presets
  and refresh the derived-rule table on CI; option B, hashing the payloads without the new field, rejected because it
  would blind the staleness gate). A move of the committed derived-rule table needs **Robert's explicit OK bound to the
  SHA**, even with 0 verdicts moving. The train is a preset + table train, alone, after hammer's OFF-sweep read.

## What the user sees

Shots from `scripts/dev/shot-region-graph-maze-arrival.mjs` on `seedling_playthrough_maze/AP_1`, desktop 1600 × 1000,
Region Graph merged + map look, Dungeon grouping Two-step + boxes, Direction-aware defaults (the floor-solver shots'
settings). "Before" is the base `b6863466be` hook swapped in; the preset is the same in both (the old hook ignores the
new field).

- `maze-arrival-shots/maze-merged-map-before.png` → `maze-merged-map-after.png`. **Before:** every box is
  "Ground floor · k" (10 boxes, 25 groups): no maze exit was ever a staircase, so the floor solver had nothing to stack.
  **After:** the boxes read Floor −3 to Floor +1 (11 boxes, 43 groups), as Seedling's own `seedling_playthrough` does.
- `before-measure.json` / `after-measure.json`: the layout's floors report, the boxes and the link kinds.

## The field and its source

**`arrivalTile: {x, y}`** on each **boundary** exit of a maze level projected from an atlas: the tile the player lands
on in the TARGET level, in that level's region-local tiles.

- Source: the compiler's maze `wiredExit` (`procgenPipeline/regionAtlasCompiler.js`) now returns the partner exit's
  `entrance_tile` minus the target region's `bounds` origin, the same conversion the projection's own `local` makes.
  It is exactly what the flash payload's `target_spawn` holds, in tiles instead of pixels
  (`target_spawn = toPixels(target exit entrance_tile)`). `regionAtlasMazeProjection.js` writes it on both
  boundary-exit paths (`projectRegionToMaze` and `projectLevelWorld`), present-or-absent.
- **A `__rXcY` target** needs no mapping: every sub-region of one atlas region shares the region's coordinates, so the
  tile is in the level whatever sub-region owns it.
- **In-level crossings** (`cross_*`, between sub-regions of one level) carry none. They fold inside one level, and the
  layout drops them.
- **Gameplay is unchanged.** `mazeRoomEngine.createMazeWorld` copies a fixed list of exit fields and drops this one, so
  `resolveMazeArrival` never sees it. The engine closure is untouched (below).

## The rule: Seedling's, called, not copied

`seedlingExitLayoutKind`, `seedlingEdgeTransitionOf` and `EDGE_ARRIVAL_TILES` moved unchanged from
`flashPanel/seedlingCompositeMap.js` into **`flashPanel/seedlingExitKind.js`**: imports-free, owned by `flashPanel`.
`seedlingCompositeMap.js` re-exports all three (its `seedlingEdgeTransitionOf` keeps the `ts = TILE` default), so no
Seedling caller changed. The factor was needed because `seedlingCompositeMap.js` imports the Seedling skin renderer (for
`TILE`) and the door-direction module, and a maze hook should not pull a substrate's renderer in to classify an exit
(js-24's edit 3).

`mazeRegionMapHooks.mazeExitLayout` on an atlas exit (no `side`):

1. `seedlingExitLayoutKind(atlas_exit_id)`: stairs and pits are `down` / `up`, with no `dir`.
2. Else the arrival decides: the exit's `arrivalTile`, else the door back's tile (the **pair rule**), judged by
   `seedlingEdgeTransitionOf` in tiles (`ts = 1`). An edge transition is a `join` with the border's side; not an edge is
   a `warp`; one it cannot judge (no target extent) stays a `join`, as Seedling's own layout leaves it.
3. With neither arrival: the door alone, as before.

A generated exit (it carries `side`) is classified exactly as before.

**One fix the agreement row found.** A shared-level member with no payload of its own (`level_0__r6c5`, the payload sits
on one member of `level_0`) had no target extent, so 21 of the 320 links could not be judged and stayed `join`.
`mazeLayoutGraph` now reads the target's extent and door back from its LEVEL's payload. With that, all 320 agree.

## The counts

Frozen fixtures under `frontend/modules/mazeRoom/fixtures/region-map-hooks/` (`mazeRegionMapArrival.test.js`):

| preset | exits with / without `arrivalTile` | link kinds before → after |
|---|---|---|
| `seedling_playthrough_maze` | 320 / 2 (both `cross_*`) | join 208 · warp 112 → **join 184 · warp 46 · down 64 · up 26** |
| `seedling_atlas_maze` | 6 / 14 (all `cross_*`) | warp 4 · join 2 → the same |
| `procgen_topdown` (generated) | 0 / 16 | join 16 → the same (layout graph byte-identical) |

**Agreement with Seedling's own classification** (`seedlingLayoutGraph` over Seedling's own sidecar exits for the same
atlas, compared by level pair): `seedling_playthrough_maze` **320 / 320** (before: 209 / 320, 111 disagreed);
`seedling_atlas_maze` 6 / 6 (before too). No exit that came from Seedling disagrees. The after counts are Seedling's own
measured split: 184 edge exits and 46 others (`seedlingEdgeTransitionOf`'s doc comment).

**The floor solver** (`regionGraph/floorSolver.js`, read only) on `seedling_playthrough_maze`:

| | groups | floors | span (pick / min / max) | stretch | connections (stairs / doorways) |
|---|---|---|---|---|---|
| before | 25 | all on the ground floor | 1 / 1 / 9 | 0 | 36 (0 / 36) |
| after | 43 | −5 … +1 | 7 / 7 / 8 | 1 | 55 (31 / 24) |

The after row equals `floorSolver.presets.test.js`'s `seedling_playthrough` pin (43 picked, span 7 / 7 / 8, stretch 1,
55 connections).

**Every other committed maze-bearing preset slot** (40: procgen_maze, procgen_topdown, cloudberry_maze_mix_worldgen,
seedling_atlas_maze, the pool and generated presets): the layout graph is byte-identical before and after (a one-off
sweep against the base hook; durable pins: the generated `procgen_topdown` digest and the `seedling_atlas_maze` kinds).
Non-maze worlds never call the maze hook, and the Seedling classifier moved unchanged (its own tests unchanged and green).
**No `regionGraph/` test moved.**

## The presets and the derived-rule table

- `seedling_playthrough_maze` (`make-seedling-playthrough-maze.mjs`) and `seedling_atlas_maze`
  (`region-atlas-compile.mjs --maze --embed-sphere-log`) regenerated. **Each JSON is identical to its predecessor once
  `arrivalTile` is stripped** (320 and 6 occurrences; a key-by-key JSON comparison). No other committed preset carries
  maze atlas exits.
- The derived-rule table's `payloadMd5` hashes every sidecar, so it moved: `regen-seedling --check` refused `rules`
  (STALE) and passed the other 9 steps. Refreshed by recipe from seedling-probe **46105839363** (at `8f7bc441f1`;
  `refresh-seedling-derived-rules.mjs --run`, with `--allow-sha-mismatch` because the only later commit added the shots):
  **verdicts moved: none**; rows 99 = 99, regions 47 = 47, excluded 6 = 6; every pinned count matches; the producer chain
  moved nothing else. **The committed table's diff is `inputs.payloadMd5` 2cd0114b → 0cdac953 and `measuredAt` only.**
  The certifier in that run: problems 1 / accepted 16 / threw 0.
- ⚠ k-exempt-fix (rule K, queued) also refreshes this table (payload 2cd0114b → 5823405c). Whichever lands second
  re-merges and re-derives by recipe.
- `check-worldgen-package-freshness.py`: 19 / 19 PASS. No worldgen package is built from either maze preset.

## Gates

- **Engine closure** (`seedlingDerivedRuleTable.importClosure`, 42 files): closure ∩ diff = ∅ at the merge; engineMd5
  `6c8cd75145bdf58d2eed7d7cc9e6b512` = origin/main's. Lab-owned `mapCamera.js`, `regionLayout.js`,
  `regionLayoutResolve.js` untouched. 0 gitlinks moved.
- `regen-seedling.mjs --check` at the merge: **10 / 10 OK**.
- Generated pins: `generate-procgen-reference.mjs --write` moved `docsIndex.js` and the procgen README's index line
  (maze.md 26,709 → 26,835 words); at the merge both were regenerated again (the merge's only conflicts), and `--check`
  passes.
- **Bounded vitest (⚖ 52)** at the merge: 105 files / 2,341 tests, all green. That is `regionMap/`, `regionGraph/`,
  `procgenDocs/`, `ciDocsOnly`, and every test importing a touched file or reading either maze preset or the table
  (62 files).
- **In-app**: `region-map-zoom-pinch-links` (fast, procgen_topdown AP_1) gained `mazeArrivalLeg`. Through the registry's
  maze `layoutGraph`, the loaded generated world has no `arrivalTile` and keeps the generated rule (16 links).
  `seedling_playthrough_maze`, fetched as JSON and never loaded, has an `arrivalTile` on every cross-level exit
  (320 / 320), and its stairs / pits are `down` / `up` as `seedlingExitLayoutKind` says (90 / 90). Local, head
  `8f7bc441f1`: unbundled PASS 2.0 s (the leg 111 ms; the row was 1.5 s); bundled PASS 6.3 s (the leg 543 ms). The cap
  was 1 s added.
- CI at the merge `442a4afdf6`, all green:
  - **JSUT 46110893178**: 1475 files / 30,748 tests, against main `aa749df335` (run 46106357008) 1474 / 30,732, so
    **+1 file / +16 tests**. `mazeRegionMapArrival.test.js` is the file (13 tests) and `regionAtlasMazeProjection.test.js`
    gained 2. The 16th I did not attribute. Slow battery 42 / 470 on both.
  - unittests 46110892857: success (3 / 3 jobs).
  - **TT 46110892272, job by job**: On-push substrate batches, ALTTP spoiler & regression, fast, fast (bundled boot),
    seedling-js, seedling-js-solver, seedling-wasm, playback-bot, apworld: all success.
  - `-f batch=tutorials-tracker` 46110894698: success.
  - **Headroom** (`check-batch-headroom`, the median of main's last 3 TT samples: `aa749df335` 46106356955,
    `b6863466be` 46099468708, `9efa7489bd` 46091183358). Fast 338.6 / 325.8 / 330.8 s, median 330.8 → **338.4 s
    (56 %), +7.6 s**. Fast-bundled 315.6 / 318.1 / 318.7 s, median 318.1 → **321.9 s (54 %), +3.8 s**. Neither is over
    +20 s or 70 %, so no re-sample was needed.
  - **seedling-probe 46110896613** (probes `probe-seedling-derived-rules.mjs,probe-seedling-whole-game-certify.mjs`):
    derived-rules ALL CHECKS PASSED ("the derived-rule table matches" the committed one; 99 rows in 47 regions, 6
    excluded; every pinned count matches). Whole-game certify ALL CHECKS PASSED: **1 problem / 16 accepted / 0 threw**,
    the same as before (the one problem is the explained `level_63__r6c9 → level_63__r0c1`, path-vs-edge).

## Files

- `frontend/modules/flashPanel/seedlingExitKind.js` (new), `flashPanel/seedlingCompositeMap.js` (re-exports)
- `frontend/modules/procgenPipeline/regionAtlasCompiler.js`, `regionAtlasMazeProjection.js` (+ 2 tests)
- `frontend/modules/mazeRoom/mazeRegionMapHooks.js`, `mazeRegionMapArrival.test.js` (new, 13 tests), fixtures (2 refreshed,
  3 new)
- `frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json`, `seedling_atlas_maze/AP_1/AP_1_rules.json`
- `frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json` (inputs only)
- `frontend/modules/tests/testCases/regionMapTests.js`, `frontend/test-configs/playwright_tests_config-substrates.json`
- `docs/json/developer/procgen/maze.md` (+ the generated index)
- `scripts/dev/shot-region-graph-maze-arrival.mjs`, `CC/docs/region-map/maze-arrival-shots/`
