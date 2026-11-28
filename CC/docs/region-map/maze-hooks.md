# Region map: what a maze level tells the Region Map

Branch `region-map-maze-hooks`, cut at painter-throws' frozen land tip `30c03ad851`
(`git merge-base HEAD origin/main` at launch: `102dcbeb169dc3d039419f64e9538aede92ee270`). The code is `37feffe09a` (hooks
+ tests), `aa4c4f899d` (generated registry) and `1220255935` (the in-app leg). Before the packet, origin/main
`960ff0a862` (train 228, hammer-flip-lhm; no file in common) was merged in: **the gated tip is the merge `af3537dc87`**.
painter-throws was still at its frozen tip `30c03ad851` on origin when I merged. This report, its pictures and the shots
script are a docs-only commit after it.

## The rulings

- Session 84c8ab35 (archipelago-cc-23), **2026-11-27T17:15:27.263Z**, after painter-throws' shots: *"This fixes the crash,
  and makes the region draw, but the region drawing code for the maze substrate is still unfinished. There are features
  that it still needs from the Seedling region drawing code."*
- Session 84c8ab35, **2026-11-27T17:17:15.342Z**: the user picked all four features the planner offered ("Location
  squares", "Level size", "Exit directions", "Sub-region dimming"), adding *"Sub region dimming is the least important of
  these, and it can be dropped if we encounter issues with implementing it."*
- Session dff9eebc (this session), **2026-11-27T17:24:33.938Z**: asked whether maze sub-regions should fold onto their
  level as Seedling's do, given that nothing on the Region Map or the Region Graph dims a sub-region (for Seedling either),
  the user answered **"Fold, no dimming (Recommended)"**.

## What the user sees now on maze levels

Shots from `scripts/dev/shot-region-map-maze-hooks.mjs` on `procgen_topdown/AP_1` (nine maze levels with Seedling names),
1600 × 1000 desktop and a 390 × 844 phone, before (the base `30c03ad851`) and after:

- `maze-hooks-shots/before-region-map-fit.png` → `after-region-map-fit.png` — Fit all, "Cells: sized by level".
  **Before:** every maze cell was framed as a 20 × 20-tile square (the panel's fallback size, no extent known), the 8 × 6
  level drawn in its top-left corner, and the location squares in a generic row, Overworld's running off the art.
  **After:** each cell is its level's own 8 × 6 (128 × 96 world px, the painter's grid), and each square sits on its item's
  tile.
- `before-region-map-BlackCastle.png` → `after-…`, `before-region-map-Overworld.png` → `after-…` — the zoom: the four
  BlackCastle squares on Dungeon0 (1, 5), Dungeon1 (7, 1), Black Castle Foyer (5, 2) and Slay Rhindle (6, 2, ringed: behind
  its logic gate). ⚠ A square now covers its item's disc (the R / B / S / F letters): the Region Map's shared tiled square is
  70 % of a tile (`SQUARE_TILE_FRACTION`), the same rule that covers a Seedling chest. The square rules were out of scope
  here; see Follow-ups.
- `before-region-graph-direction.png` → `after-region-graph-direction.png` — the Region Graph, merged + map look, the
  Direction-aware layout at default settings. **Before:** no maze exit had a direction (0 / 16), and every maze node was a
  74 × 74 square. **After:** 16 / 16, 8 preferred edges, mean angle error 1.9°, max 5.7°, 0 overlaps; each node is the
  level's 74 × 56 rectangle.
- `before-phone-390-region-map.png` → `after-phone-390-region-map.png` — the phone's Region Map tab at Fit all.

`<tag>-measure.json` beside them holds each view's cells, extents, squares and the Direction-aware report. Both phone boots
log the same unrelated page error, `SecurityError … Blocked a frame … from accessing a cross-origin frame` (2 before, 4 after:
a count, not a new error; nothing here touches a frame).

## The hooks and their sources

`frontend/modules/mazeRoom/mazeRegionMapHooks.js` (new, pure, no engine import), declared by `mazeRoomLibrary.js` as
`compositeMap.{regionExtent, locationTiles, displayRegionOf, layoutGraph}` beside `drawRegion`. Every reader was already
substrate-agnostic. **No reader changed, and none needed a maze branch.** The lab-owned files (`mapCamera.js`,
`regionLayout.js`, `regionLayoutResolve.js`) are untouched.

**The source of truth is the sidecar's JSON payload** (`preset_sidecars[p][region].playable_payload`), the shape the
readers already hand DATA hooks (`regionMapModel.js` hydrates only the painter's copy). ⛔ The deserialised world could not
answer `locationTiles`: its `items` Map is `key → item id` and drops each item's `locationName`.

| hook | answers | from |
|---|---|---|
| `regionExtent` | the level's size in tiles | `width` × `height`: exactly the grid `drawMazeCompositeRegion` paints (pinned: the painter's fills end at extent × tilePx) |
| `locationTiles` | `[{location, x, y, kind}]` | each `items[]` entry's `locationName` at its `x, y` (`item`). Events go where the player FIRES them (`event`): a rope (`obstacleLib[id].activates` + `event`) on its first tile, an atlas lock / rock / tree (`obstacleLib[id].events[].name`) on the obstacle, a button latch (`buttonLib[id].latch.event`) on the button. With rules in hand, only names the slot lists as locations |
| `displayRegionOf` | the level a region belongs to | the payload's `atlas_region`, else the sidecar's `shared_world` (a shared-level member with no payload of its own), else the region itself |
| `layoutGraph` | `{nodes, links}` for `regionLayoutResolve` | the payload exits, display-folded. A **generated** exit (it has `side`) is a `join` with `dir: side`, or a `warp` when `isTeleporter` (the pipeline sets that when the target cell is not adjacent). An **atlas** exit (no `side`; its `isTeleporter` is true on 320 / 322 of the shared-level exits, Seedling's Teleporter object, so no signal) is a `join` with the border's side when its door is on the border (and, when it names its door back, that door is on the target's opposite border), else a `warp` |

No `remoteLocationTiles`: a maze location is always a tile in its own level's payload (0 unplaced in every preset).

**One `layoutGraph` per world.** `regionLayoutResolve.hookFor` uses a substrate hook only when every sidecar's substrate
declares the same function. A world mixing the maze with another substrate is laid out generically. In the committed
presets this never matters: every mixed world (e.g. `procgen_topdown/AP_10–12`, maze + text adventure) has a `grid_cell` on
every region, and stored cells win before any hook is asked. The two worlds the hook does lay out are all-maze
(`seedling_atlas_maze`, `seedling_playthrough_maze`). The Region Graph's Direction-aware layout reads door tiles and the
model's extents, not `layoutGraph`, so it gets maze directions in mixed worlds too.

## The counts (every committed preset with a maze region)

Measured with the panel's own model (`buildRegionMapModel`) and `directionLayout.exitDirections`, before (the registry
without the new hooks) and after. *Locations* = location squares placed by the substrate, with the number left with no
tile in brackets. *Exits with a direction* = border doors (the Direction-aware default), then all doors, of all exits.

| Preset (slot) | Maze regions | Cells before → after | Locations: substrate squares (no tile) | Exits with a direction: before → after (border / all doors) | Layout |
|---|---|---|---|---|---|
| `cloudberry_maze_mix_worldgen/AP_14089154938208861744 #1` | 2 | 2 → 2 | 3 (0) | 0 → 5 / 5 of 5 | grid_cell → grid_cell |
| `concept_trial/AP_1 #1` | 2 | 2 → 2 | 2 (0) | 0 → 3 / 3 of 3 | grid_cell → grid_cell |
| `meta_trial/AP_1 #1` | 2 | 2 → 2 | 2 (0) | 0 → 3 / 3 of 3 | grid_cell → grid_cell |
| `multiworld/AP_05594871498841892311 #1` | 3 | 3 → 3 | 3 (0) | 0 → 4 / 4 of 4 | grid_cell → grid_cell |
| `multiworld/AP_05594871498841892311 #2` | 3 | 3 → 3 | 3 (0) | 0 → 4 / 4 of 4 | grid_cell → grid_cell |
| `mystery_street_test/AP_14089154938208861744 #1` | 1 | 1 → 1 | 1 (0) | 0 → 1 / 1 of 1 | grid_cell → grid_cell |
| `omsi_randomized_test/AP_14089154938208861744 #1` | 2 | 2 → 2 | 0 (0) | 0 → 3 / 3 of 3 | grid_cell → grid_cell |
| `omsi_region_split_test/AP_14089154938208861744 #1` | 2 | 2 → 2 | 0 (0) | 0 → 4 / 4 of 4 | grid_cell → grid_cell |
| `omsi_scaled_test/AP_14089154938208861744 #1` | 2 | 2 → 2 | 0 (0) | 0 → 3 / 3 of 3 | grid_cell → grid_cell |
| `omsi_schedule_test/AP_14089154938208861744 #1` | 2 | 2 → 2 | 0 (0) | 0 → 3 / 3 of 3 | grid_cell → grid_cell |
| `omsi_substrate_test/AP_14089154938208861744 #1` | 2 | 2 → 2 | 0 (0) | 0 → 3 / 3 of 3 | grid_cell → grid_cell |
| `procgen_maze/AP_1 #1` | 3 | 3 → 3 | 3 (0) | 0 → 4 / 4 of 4 | grid_cell → grid_cell |
| `procgen_maze/AP_2 #1` | 5 | 5 → 5 | 8 (0) | 0 → 8 / 8 of 8 | grid_cell → grid_cell |
| `procgen_maze/AP_3 #1` | 10 | 10 → 10 | 17 (0) | 0 → 22 / 22 of 22 | grid_cell → grid_cell |
| `procgen_topdown/AP_1 #1` | 9 | 9 → 9 | 25 (0) | 0 → 16 / 16 of 16 | grid_cell → grid_cell |
| `procgen_topdown/AP_10 #1` | 6 | 6 → 6 | 20 (0) | 0 → 11 / 11 of 11 | grid_cell → grid_cell |
| `procgen_topdown/AP_11 #1` | 5 | 5 → 5 | 7 (0) | 0 → 8 / 8 of 8 | grid_cell → grid_cell |
| `procgen_topdown/AP_12 #1` | 2 | 2 → 2 | 3 (0) | 0 → 5 / 5 of 5 | grid_cell → grid_cell |
| `procgen_topdown/AP_2 #1` | 9 | 9 → 9 | 25 (0) | 0 → 16 / 16 of 16 | grid_cell → grid_cell |
| `procgen_topdown/AP_3 #1` | 9 | 9 → 9 | 25 (0) | 0 → 16 / 16 of 16 | grid_cell → grid_cell |
| `procgen_topdown/AP_4 #1` | 81 | 81 → 81 | 161 (0) | 0 → 204 / 204 of 204 | grid_cell → grid_cell |
| `procgen_topdown/AP_5 #1` | 74 | 74 → 74 | 147 (0) | 0 → 172 / 172 of 172 | grid_cell → grid_cell |
| `procgen_topdown/AP_6 #1` | 78 | 78 → 78 | 155 (0) | 0 → 196 / 196 of 196 | grid_cell → grid_cell |
| `procgen_topdown/AP_7 #1` | 235 | 235 → 235 | 268 (0) | 0 → 549 / 549 of 549 | grid_cell → grid_cell |
| `procgen_topdown/AP_8 #1` | 235 | 235 → 235 | 268 (0) | 0 → 549 / 549 of 549 | grid_cell → grid_cell |
| `procgen_topdown/AP_9 #1` | 235 | 235 → 235 | 268 (0) | 0 → 549 / 549 of 549 | grid_cell → grid_cell |
| `seedling_atlas_host/AP_1 #1` | 3 | 3 → 3 | 3 (0) | 0 → 4 / 4 of 4 | grid_cell → grid_cell |
| `seedling_atlas_location/AP_1 #1` | 2 | 2 → 2 | 2 (0) | 0 → 3 / 3 of 3 | grid_cell → grid_cell |
| `seedling_atlas_maze/AP_1 #1` | 10 | 10 → 4 | 1 (0) | 0 → 3 / 20 of 20 | generic → hook |
| `seedling_atlas_sphere/AP_1 #1` | 18 | 18 → 18 | 8 (0) | 0 → 24 / 34 of 34 | grid_cell → grid_cell |
| `seedling_generated_chestdoor/AP_1 #1` | 2 | 2 → 2 | 0 (0) | 0 → 4 / 4 of 4 | grid_cell → grid_cell |
| `seedling_generated_host/AP_1 #1` | 2 | 2 → 2 | 2 (0) | 0 → 3 / 3 of 3 | grid_cell → grid_cell |
| `seedling_generated_leaf/AP_1 #1` | 2 | 2 → 2 | 2 (0) | 0 → 3 / 3 of 3 | grid_cell → grid_cell |
| `seedling_generated_room/AP_1 #1` | 2 | 2 → 2 | 0 (0) | 0 → 4 / 4 of 4 | grid_cell → grid_cell |
| `seedling_generated_swim/AP_1 #1` | 1 | 1 → 1 | 1 (0) | 0 → 1 / 1 of 1 | grid_cell → grid_cell |
| `seedling_playthrough_maze/AP_1 #1` | 306 | 306 → 115 | 89 (0) | 0 → 208 / 318 of 322 | generic → hook |
| `seedling_sphere_room/AP_1 #1` | 3 | 3 → 3 | 3 (0) | 0 → 5 / 5 of 5 | grid_cell → grid_cell |
| `seedling_spiral_room/AP_1 #1` | 3 | 3 → 3 | 0 (0) | 0 → 6 / 6 of 6 | grid_cell → grid_cell |
| `tile_kinds_demo/AP_1 #1` | 9 | 9 → 9 | 25 (0) | 0 → 16 / 16 of 16 | grid_cell → grid_cell |
| **total** | 1382 | | 1550 (0) | 0 → 2645 / 2782 of 2786 | |

The 4 exits with no direction even under "all doors" (`seedling_playthrough_maze`) sit at the exact centre of their level
(staircases: `level_16__r1c9 → level_17 #4`, `level_70 → level_69`, `level_84__r2c4 → level_85 #2`, `level_96 → level_97`),
which `doorOffset` gives no direction by design. Of its 114 border-filter misses, the other 110 are interior doors.

**The fold.** `seedling_playthrough_maze`: 306 maze regions → 115 level cells (the 190 regions with no payload of their
own, which drew as generic boxes, are now members of their level's cell; the 30 events that had no tile (26 cleared locks /
rocks / trees, 4 button latches) now have one). `seedling_atlas_maze`: 10 → 4. Every other maze preset has no sub-regions and folds nothing.

**The angle error on `procgen_topdown` AP_1** (merged + map look, Direction-aware at default settings, scored against the
exits' directions): before, no exit had a direction, so the layout ignored them. Its positions sit at a **mean 73.0°**
(p90 175°) from the directions. After: **mean 2.5°, max 7.6°** in the headless harness (`directionLayoutMaze.test.js`),
**1.9° / 5.7°** in the app (the shots' `after-measure.json`); 0 overlaps either way.

## Sub-region dimming: dropped, by ruling

Nothing on the Region Map or the Region Graph dims a sub-region: `regionMapModel.js` draws each display region as its
whole level, undimmed (its "step-1 residue": the cell's payload loses `atlas_sub_region`), for Seedling too. Seedling's
`OUTSIDE_SUB_REGION_DIM` only shows on the Procgen Pipeline / APWorld Map tab, where each rules region is its own cell. The
maze has sub-regions in two presets (`seedling_atlas_maze`: 8 of 10 payloads name an `atlas_sub_region`;
`seedling_playthrough_maze`: 2 payloads, plus 190 shared-level members). The user chose "Fold, no dimming": the maze now
folds like Seedling, and dims nothing, like Seedling on these two panels.

## Proof

- Vitest (`mazeRoom/mazeRegionMapHooks.test.js`, 24 tests; `regionGraph/directionLayoutMaze.test.js`) over frozen fixtures
  `mazeRoom/fixtures/region-map-hooks/` (verbatim `regions` / `start_regions` / `preset_sidecars` of `procgen_topdown` AP_1,
  `seedling_atlas_maze` AP_1, and levels 0 / 12 / 16 / 20 of `seedling_playthrough_maze` AP_1, cut at `30c03ad851`): each
  hook on a small level; extent = the painter's grid; exit sides and their place along the side; location tiles per frozen
  preset; non-maze worlds byte-identical (frozen `seedling_playthrough`, `seedling_atlas`, `alttp`: model, layout and exit
  directions; the painter-throws mixed fixture's four text-adventure cells); a derived sweep of every committed maze preset
  (every maze location placed, every cell its payload's size).
- Bounded vitest (⚖ 52): at the merge, 174 files / 4,229 tests (before it, 164 / 3,661) over `mazeRoom/` (less the closure files' tests), `regionMap/`,
  `regionGraph/`, `procgenCore/regionLayout*`, `flashPanel/seedlingCompositeMap*` and every test importing
  `mazeRoomLibrary.js`; after the regeneration, `procgenDocs/` and the generated-module readers, 15 files / 744 tests.
- In-app: `region-map-zoom-pinch-links` (fast, `procgen_topdown` AP_1) gained the maze leg: "every maze cell has its level's
  extent and frame, and a substrate square per location (9 cells, 25 squares)", "every maze exit has a direction off the
  panel's model (16/16)". The row ran 1.5 s in all. The 34 Region Map / Region Graph rows and walks
  (`tutorial-walk-tracker-region-map` and `-region-graph` included) are green on both boots, run locally on port 8143: unbundled 34 / 34 (head `30c03ad851` with this slice's 5 tracked changes not yet committed;
  they then landed unchanged as the three code commits) and bundled 34 / 34 (head `1220255935`, 0 tracked changes).
- CI: all green at the merge `af3537dc87`.
  - JSUT run 46047883001: 1464 files / 30,572 tests, against main `960ff0a862` (run 46032669048) 1461 / 30,539, so **+3 files
    / +33 tests**. My two files hold 25 tests and painter-throws' `regionMapPainterHydration.test.js` 6. The other +2 are
    data-driven rows in existing files that I did not attribute. The slow battery is 42 / 470 on both.
  - unittests 46047883125, type check, Analyze modified files: green.
  - TT 46047890586, job by job: On-push substrate batches, ALTTP spoiler & regression, fast, fast (bundled boot),
    seedling-js, seedling-js-solver, seedling-wasm, playback-bot, apworld: all success.
  - `-f batch=tutorials-tracker` 46047893812: success. No `train_only`.
  - **Headroom.** Main `960ff0a862` has only two TT samples (46046640960, 46032672662): fast 337.2 / 338.2 s (median
    337.7), fast-bundled 341.0 / 330.0 s (median 335.5). At the merge: fast **330.3 s (55 %), −7.4 s**; fast-bundled
    **342.8 s (57 %), +7.3 s**. Before the merge, at `1220255935` against main `102dcbeb16`'s three samples (fast 331.2 /
    326.8 / 343.8, bundled 335.7 / 333.8 / 337.8): TT 46045624892 gave fast 335.7 (+4.5 s), bundled 350.1 (+14.4 s, 58 %),
    and the re-sample 46046669564 gave fast 321.1 (−10.1 s), bundled 330.4 (−5.3 s). No sample is over +20 s or 60 %.
  - Before the merge, the same set at `1220255935` was green too: JSUT 46045560527 (1462 / 30,560), unittests 46045560575,
    and tutorials-tracker 46045628063.

## Pins moved

`node scripts/procgen/generate-procgen-reference.mjs` (its own write): `procgenDocs/generated/registry.js` and
`docs/json/developer/procgen/substrate-registry.md` § GENERATED:substrate-capability-matrix, maze column —
`compositeMap` `{drawRegion}` → `5 keys`; `compositeMap.displayRegionOf`, `.layoutGraph`, `.locationTiles`,
`.regionExtent`: `—` → `fn`. `capabilities.js` did not move (the hooks stay in its `uncovered` list). Closure ∩ diff = ∅
(`seedlingDerivedRuleTable.js --print-engine-closure`, 42 files), engineMd5 `74ae60f575531492ed9eaec1839e1fe3` base = tip, at the merge too. 0 gitlinks moved.

## Follow-ups

- **Maze item art under its square.** At 70 % of a tile, a location square hides the maze's item disc. Seedling's chests
  are covered the same way. If the maze's art should show through (a smaller square, or an outline on tiled art cells),
  that is a Region Map square-rule ruling, not a maze change.
- **`layoutGraph` in a mixed world without `grid_cell`.** None is committed today. If one appears, `hookFor` lays it out
  generically. A per-substrate merge of hooks would be a lab-owned `regionLayoutResolve.js` change.
- **Atlas house doors.** A door on the border whose target names no door back (320 of `seedling_playthrough_maze`'s 322 exits
  name none) is taken as a walk-off `join`. Seedling's own rule also reads the arrival point, which maze atlas payloads do
  not carry. Carrying `target_spawn` through the maze projection would let the two rules agree exactly.
