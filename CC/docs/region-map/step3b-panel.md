# Region Map step 3b: the Region Map panel v1

Session `region-map-step3b-panel` (Opus), 2026-11-15.
- **Planner:** archipelago-cc-23.
- **Reviewer and landing:** seedling-js-planning-20 (js-20, who replaced js-19; js-19's five edits stand).
- **Branch:** `region-map-panel`, cut `--with-wasm` at base `75e45c964d9ce37b3eb6db3c1e887b9b873b484c` (train 115).
- **Code tip:** `03b7880634`: the merge of origin/main `ca966accde` (train 116, at js-20's request) on top of `d6653f47a6`.
  This report and the screenshots are the last commit.

⚖ The user's rulings this slice implements (2026-11-14/15): a SEPARATE panel; discovery hides undiscovered regions; follow
player; green/red location squares with a minimum size; groups with gaps, a group reached by going down placed below;
sub-regions fold into their level; it must load for any world; and cell size is a toggle with *sized by level* as the default
(*"I want an option to toggle between these modes. We can make sized by level the default."*). The slice ships no click
actions; those are step 4.

## What landed

| Commit | What |
|---|---|
| `c620f7b78e` | Seedling hooks `compositeMap.regionExtent` + `remoteLocationTiles`; the registry rows; the generated reference regenerated |
| `7386b54add` | `regionView/`: **step-2 defect found and fixed** (`sidecarIndex`), plus the inverse-entrance index |
| `77b6cf881b` | The panel: `frontend/modules/regionMap/`, enabled in `modules.json`; its docs; the quick-launch docs index |
| `253a557951` | In-app rows, batch placement, tutorial-coverage entry |
| `75b8ff2c09`, `a1a30023e5`, `98c8e8d58d` | The screenshot script; links drawn at partial alpha |
| `ef7fbde4db` | js-20's two review items |
| `d6653f47a6` | `init-bundled.js`: the module and its test-case file registered for the bundled boot (CI red at `98c8e8d58d`, below) |
| `03b7880634` | Merge of origin/main `ca966accde` (train 116). The two generated regions (procgen README, `procgenDocs/generated/docsIndex.js`) were regenerated, not hand-merged |
| this commit | This report and `step3b-shots/` |

### The panel (`frontend/modules/regionMap/`)

| File | What |
|---|---|
| `index.js:23` | `moduleInfo` (`componentType: 'regionMapPanel'`, "Region Map", `requires: ['stateManager', 'gameState']`, docs); `register()` :38 (panel + settings schema). The docblock writes down the loop-mode note for step 4 (residue 10) |
| `regionMapSettings.js:9` | The schema; its defaults are the defaults (`REGION_MAP_SETTING_DEFAULTS` :34). It is a separate module so the UI ↔ index import cycle has no TDZ |
| `regionMapModel.js:52` | **Pure.** `buildRegionMapModel`: the layout (`resolveRegionLayout`), then per display region its members, the painter's region object, the extent, the location tiles, plus `groupLinks` :138 and `unplaced` |
| `regionMapFrames.js:63` | **Pure.** `cellFrames(positions, extents, mode)`; `visibleFrames` :128 (the cull), `frameAt` :138, `tileCentre` :147 |
| `regionMapCamera.js` | **Pure.** `worldToScreen` :14, `screenToWorld` :18, `viewRect` :23, `zoomAround` :30, `panBy` :37, `fitCamera` :42, `centreOn` :51, `easeCamera` :56 |
| `regionMapOverlay.js` | **Pure.** `squareColorKey` :33, `squareSide` :41 (the minimum), `frameSquares` :49, `genericLocationTiles` :63, `squareAt` :71 |
| `regionMapUI.js:46` | `RegionMapUI`: DOM and controls, settings, `_rebuild` :291 / `_reframe` :317 (the static half), `_onView` :451 (the live half), `paint` :499, `_drawArt` :563, `_drawSquares` :614, `_drawLinks` :650, `_drawMarkers` :684, `getDebugState` :707, `dispose` :740 |

**Controls:** Follow player, Show undiscovered, Links, Cells (sized by level / uniform), Grouping (from `GROUPING_RULES`),
Centre on start, Fit all. Drag pans; the wheel zooms around the cursor. Hovering shows the region name and its counts, or the
location under the cursor. A click selects a cell (yellow outline) and publishes nothing. Below the controls, an info line
shows the rule, the groups, the cells, `down/up across → below/above`, the layout source and the cell mode. It is
resize-aware (a `ResizeObserver` and the container's `resize`).

### Docs

- **User guide:** `docs/json/user/modules/regionMap.md` (`moduleInfo.docs`). It says how to open the panel: the panel menu, *Analysis Panels*.
- **Technical reference:** `docs/json/developer/modules/regionMap.md`.
- **Index stub:** `docs/json/modules/regionMap.md`, listed in `docs/json/modules/README.md` § Analysis Panels.
- **Registry rows** for the two new hooks are in `docs/json/developer/procgen/substrate-registry.md` § Entry contract. That
  is the only procgen doc edited; it adds no links (see Gates for the census).

## The ten residue items

1. **`getRules`.** `regionMapUI.js:282` `_rulesOf()` reads `stateManager/index.js` `getLastRawJsonData()` →
   `{rules: rawJsonData, playerId: selectedPlayerInfo.playerId}`. It feeds both `createRegionViewState({getRules})` and the
   model.
   - **⚠ It was not enough on its own: step-2 defect found and fixed.** `regionViewModel.js:319` `sidecarIndex` read
     `preset_sidecars[p]` only as an ARRAY of `{region_id}`. Every committed preset stores it as an OBJECT keyed by region
     name: 60 of 60 slots that carry sidecars, measured over every committed `*_rules.json`.
   - So even with `getRules` wired, no region folded. **On `seedling_playthrough` the view had 267 display groups; with the
     fix it has 116** (115 levels plus the Menu hub; the panel draws 115 cells because the layout strips the hub).
   - The fix reads both shapes. The array form's existing pins pass unchanged.
   - A new row in `regionViewModel.test.js` reads the committed preset's real block and derives the before/after counts, as js-20 asked.
     The end-to-end row in `regionMap.test.js` checks that every model cell is a view display group with the same members.
   - Ruled in scope by archipelago-cc-23. No D0 is owed for this part, since the Region Graph does not call `sidecarIndex`.
2. **A display group is drawn as its whole level, undimmed.** The chosen way: **a region object for the display key with no
   sub-region field** (`regionMapModel.js:76`). It carries the representative member's payload minus `atlas_sub_region`, and
   `exits: []`, so the painter draws no edge squares. `subRegionTiles` then answers null and the painter draws the level
   unmasked, from the same `atlas:<map>#<level>` bake every sub-region shares. No painter change.
3. **Cell sizes.**
   - `cellFrames` implements both modes (`regionMapFrames.js:63`):
     - **(B) `'level'`, the default:** `WORLD_TILE_PX` = 16, and the layout cells are anchors. A column is as wide as its widest
       level and a row as tall as its tallest, plus `GUTTER_PX` = 32.
     - **(A) `'uniform'`:** a `UNIFORM_SIDE_TILES` = 20-tile square, with the level letterboxed.
     - An empty column or row (the gap between groups) is `GAP_PX` = 96 in both modes.
     - Column 0 starts at x = 0 and negative columns extend left; nothing is normalised.
   - **Extents** come from the new hook `compositeMap.regionExtent` (`seedlingCompositeMap.js:257`). It is registered at
     `flashSeedlingLibrary.js:873` (shipped atlases + `ctx.atlases`) and `flashSeedlingGenLibrary.js:560`. It is pinned equal
     to the level record's width × height for every `seedling_playthrough` region and both generated rooms. With no hook, a
     cell is `DEFAULT_EXTENT` 20×20.
   - **The setting** is `moduleSettings.regionMap.cellSize: 'level' | 'uniform'`.
   - **Vitest** covers both modes, signed coordinates, the max-of-column rule, centring, the gap, and the refusal of an
     unknown mode.
4. **Visible-cell repaint.**
   - `paint()` draws only `visibleFrames(frameList, viewRect(camera))`.
   - Every request is coalesced into one animation frame (`_requestPaint`, :71). That covers pan, zoom, a view update, and a
     bake landing (the painter's `requestRedraw` = `_onArt`, :78).
   - **Each level is baked once,** at 16 px per tile (`BAKE_TILE_PX`), and drawn under a canvas transform
     (`_drawArt`), so zooming never re-bakes.
   - Bakes are requested only for cells that were drawn.
   - Numbers are under Performance.
5. **Location squares.**
   - **Positions:** `compositeMap.locationTiles` per member region, unioned per display group, at the tile centre.
   - **Colour (the planner's call, stated):** the **Region Graph's displayed colour** (`regionMapOverlay.js:33`).
     - `checked` → grey, dimmed.
     - The location's region shows `color === null` (filter off, or discovery hiding reachability) → light grey "unknown".
       It is never green or red then, as the Region Graph shows no reachability colour there.
     - Green only when the location's state is `accessible` AND its region shows `accessible`; otherwise red.
   - **Minimum size:** `MIN_SQUARE_PX` = 6 (the `minSquarePx` setting) holds at any zoom. It is pinned in vitest and in-app at `MIN_ZOOM`.
   - **Event locations** are diamonds.
   - **Cross-level events:** placed in the level that holds their object, through the new hook
     `compositeMap.remoteLocationTiles` (`seedlingCompositeMap.js:273`).
     - All 3 `seedling_playthrough` residue events are placed: `L39 flag 8` → `level_39`, `L62 flag 0` → `level_62`,
       `L63 flag 1` → `level_63`. The pin derives the expected set from the rules' `obstacle.level`.
     - The hook divides by the host payload's `tile_size` (js-20 item 1).
   - **"Not on map":** anything still unplaced is listed in a yellow strip above the canvas, never dropped. It is 0 on all
     three presets.
   - **No hook** (a classic AP world): the squares go on generic places inside the cell (`genericLocationTiles`), so
     every location still has a square.
6. **Exits.**
   - No lines between adjacent cells.
   - `groupLinks` (`regionMapModel.js:138`) draws ONLY links between DIFFERENT groups, one per pair. The endpoints are the
     real door tiles: the exit's `x, y`, else `exit_tiles[0]`, and the reciprocal exit (by `targetExitId`) in the target.
     Without them the cell centre is used.
   - Colour by kind: down blue, up orange, join yellow. Each has an arrowhead and is drawn at alpha 0.55 over the art.
   - `showLinks` defaults to on. On `seedling_playthrough` there are 27 links between groups. R1 joins never cross groups,
     so these are all stairs and pits.
7. **Discovery.**
   - `hidden` → not drawn. `placeholder` → a fog cell with "?": no art and no squares.
   - The panel has its own `showUndiscovered` control, passed as the getter.
   - **The recompute cost**, measured in-app on `seedling_playthrough` (267 regions, mean of 20):
     - At the base code: **7.34 ms** per recompute in discovery mode.
     - That is over 4 ms, so the licensed **inverse-entrance index** was added (`regionViewModel.js:178`
       `enteredFromDiscoveredIndex`). `computeRegionView` builds it once per recompute when discovery is on
       (`regionViewState.js:106`).
     - After: **ON 3.17 ms, OFF 3.10 ms.** The discovery decisions alone take **4.59 ms with the scan and 0.14 ms with the index**.
   - **It is additive:** a context without the index (the Region Graph's) keeps the scan and has no extra key. Pinned:
     index ≡ scan over 40 random graphs × every discovered subset, and every region/location/exit decision is equal with
     and without it.
   - **D0 proof:** `scripts/dev/region-graph-class-snapshot.mjs --port=8140` after the change, against the committed step-2
     `CC/docs/region-map/step2-dumps/before/` (`seedling_playthrough`, `alttp`, `procgen_topdown` × S1–S6):
     `diff -rq` → **byte-identical**.
8. **Grouping switch.**
   - The `groupingRule` setting and select are filled from `GROUPING_RULES` (R1 only today).
   - The info line shows the rule and `stats`: on `seedling_playthrough`, *21 groups · 115 cells · down 45 across → 45 below ·
     up 22 across → 22 above · layout: hook (flash_seedling)*.
   - No R2 was built.
9. **Custom Seedling worlds: the panel cannot pass `hookCtx.atlases` yet.**
   - The loaded rules carry `region_atlas[p] = {atlas_id, game, map_document}`, not the atlas body. The derived atlas of a
     set built in the set editor is returned beside the rules and never reaches the stateManager.
   - `regionMapUI.js:289` `_hookCtx()` is the single place it would go (`{atlases: {[id]: atlas}}`), and every Seedling hook
     already merges `ctx.atlases`.
   - **What a custom world gets today:**
     - the layout from its sidecars (`kind` from the `exit_id` prefixes, no directions);
     - the art (the painter fetches the map document itself);
     - `regionExtent` → null, so cells are 20×20 and item squares go on generic places. Event squares do too, because a cell
       without an extent places nothing against a guessed size.
   - **The fix:** the set editor (or the stateManager load) hands the derived atlas on. For example, an inline
     `region_atlas[p].atlas` or a registry-held cache keyed by `atlas_id` that `_hookCtx` reads. That is a cross-module
     question for the planner.
10. **Loop mode.**
    - v1 publishes no moves or checks, so it needs no `loopModeExemptions` entry.
    - Written in `index.js`'s docblock for step 4: a Region Map `source` that does not start with `regionGraph` is not a
      planning source, so step 4 adds its prefix there (with its pin in `loopModeExemptions.test.js`).

## Settings (`moduleSettings.regionMap.*`)

| Key | Default | |
|---|---|---|
| `followPlayer` | `true` | The box saves the setting. A manual pan or zoom only unticks the box: follow is panel state seeded from the setting |
| `cellSize` | `'level'` | `'level'` \| `'uniform'` |
| `groupingRule` | `'R1'` | A `GROUPING_RULES` name |
| `showLinks` | `true` | |
| `showUndiscovered` | `true` | |
| `minSquarePx` | `6` | |

The storage census (`storagePanel/storageCensus.test.js`) is **green**. Module settings live under the one settings key the
census already attributes, and the schema's defaults are the source of truth (js-19 e4). No census pin moved.

## In-app rows (`frontend/modules/tests/testCases/regionMapTests.js`)

**Placement:**
- Category **`Region Map`** → the `fast` batch: `region-map-classic-world`, its one smoke row.
- Category **`Region Map: Seedling`** → the **`playback-bot`** batch (on push): the other three rows.
  - At the base (TT 43745506738) fast was at 62 %, seedling-js at 66 % (these rows would take it past
    `HEADROOM_WARN_FRACTION` 0.7), and playback-bot at 8 %.
  - Pinned in `testBatches.test.js`.

Every row sets its own state (world, panel settings, and discovery state for its row). Every count is DERIVED at run time,
from the loaded rules and an independent `resolveRegionLayout` call (js-19 e3).

| Row | What it holds | Local (playback-bot / fast run) |
|---|---|---|
| `region-map-classic-world` | `adventure`: source `generic`; one cell per display region (9 = the layout's 9); every cell a generic box; every location has a square (25/25) and is painted | 0.3 s |
| `region-map-seedling-paints` | source `hook`; N cells = the layout's 115; groups = 21; fit all paints all N, every one through the painter; the art bakes (115 baked, 0 pending, 0 failed); repaints coalesced; 88/88 placed, 0 not on map; squares on screen = the visible levels' tiles (88 = 88); at `MIN_ZOOM` every square ≥ 6 px; events and items both drawn; the cell-size toggle changes the frames (uniform = equal squares) and back | 17.7 s |
| `region-map-follow-player` | a `setCurrentRegion` into another display region → the camera centre lands on its cell; a manual pan turns follow off and unticks the box | 2.3 s |
| `region-map-discovery` | discovery on; cleared, then the start level discovered → only `level_0` shown; the view's groups cover the cells; hidden never drawn, every placeholder drawn as fog (7) with no squares, 107 hidden; untick → the fog turns hidden (0 fog, 114 hidden); logs the recompute cost | 14.4 s |

## Screenshots (`CC/docs/region-map/step3b-shots/`, by `scripts/dev/shot-region-map.mjs --port=8140`)

| File | What |
|---|---|
| `seedling_playthrough-level.png` | Sized by level (default), fit all: the minimum-size squares, the links between groups, the start level outlined |
| `seedling_playthrough-uniform.png` | Uniform cells, fit all |
| `seedling_playthrough-level-zoom.png` | Zoomed onto the start level: the art at tile size, square and diamond markers, `level_12` at true relative size |
| `seedling_playthrough-discovery.png` | Discovery on, only the start level discovered: the frontier as fog |
| `seedling_playthrough-follow.png` | Follow player after a move into `level_2` (another group), the camera on it |
| `seedling_generated_chestdoor.png` | A generated preset (the stored `grid_cell` path): two Seedling rooms with their squares beside two maze cells |
| `alttp.png` | A classic AP world: generic layout, 238 generic boxes, 3 groups, squares on generic places |
| `perf.json` | The counters below |

## Performance (headless Chromium, 1600×1000, `perf.json`)

| | `seedling_playthrough` | `seedling_generated_chestdoor` | `alttp` |
|---|---|---|---|
| Model build (layout + cells + tiles + links) | 21.3 ms | 3.4 ms | 21.2 ms |
| Panel mount → first paint | 291 ms | 47 ms | 239 ms |
| Bakes (requested / baked / failed) | 115 / 115 / 0 | 4 / 4 / 0 | — |
| First bake request → last bake | 4.11 s | 5.00 s (incl. the first art load) | — |
| Art redraws → paints (of requests) | 58 → 66 paints (70 requests) | 1 → 18 (23) | 0 → 8 (12) |

- Every paint is the viewport only. Step 1's composite map instead did 99 full repaints of 4760×4480.
- **The discovery recompute:** 7.34 ms → 3.17 ms (item 7).

## Gates

**Bounded vitest (⚖ 52), `npx vitest run <paths> --maxWorkers=3`:**

| | Files | Tests | Result |
|---|---|---|---|
| BEFORE (the brief's list, at base) | 14 | 213 | green |
| AFTER, at `98c8e8d58d` (the brief's list + every vitest importing a touched file, `grep -a -l`, + `procgenDocs/`, `quickLaunch/`, `tutorials/`, `storagePanel/`, `moduleImportOrder`, `bindingContract`, `loopModeExemptions`) | 90 | 2,397 | green |

- The first AFTER run had one red: `tutorials.test.js` "each panel is exactly one of covered, NOT_COVERED_YET,
  NO_TUTORIAL". The new panel was in none.
  - Fixed: `regionMapPanel` is now `NOT_COVERED_YET`, with "a Region Map tutorial (planned, after region-map step 4)".
  - Whether a tutorial is wanted is the user's call.
- **CI found one more red** (JSUT at `98c8e8d58d`, Vitest shard 1/3: 9,659 passed, 1 failed). `tests/bundledTestCases.test.js`
  "init-bundled.js imports exactly TEST_CASE_FILES" failed: the hand-kept bundled entry lacked `regionMapTests.js`, and its
  `__BUNDLED_MODULES__` lacked `regionMap`.
  - Fixed in `d6653f47a6`. `npm run build` now reports *all enabled modules present* and *every test case file imported*.
  - The four rows on the **bundled boot** (`npm test -- --bundled --test=…`) pass **4/4**: 2.6 s, 26.7 s, 2.8 s and 18.2 s.

**Generators and checks:**
- `generate-procgen-reference.mjs --check`: *ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE* (registry: 9
  entries, 108 fields).
- `quicklaunch/generate-docs-index.mjs --check`: current.
- `check-procgen-docs.mjs --host=http://localhost:8140`: *ALL CHECKS PASSED*.
- **Doc-link census:** the registry-doc edit adds no links, so **no census pin moved**. `procgenDocs/` is green in the
  bounded set.

**In-app, local** (`npm test -- --port=8140 --mode=test-substrates --batch=<b>`):

| Batch | Result | Headroom |
|---|---|---|
| `fast` | **100/100** | **52 %** (314.7 s) — before: 62 % / 62 % (369.2 / 371.3 s, TT 43745506738, unbundled / bundled). The new fast row adds **0.3 s** |
| `playback-bot` | **11/11** (the 3 new rows 34.4 s) | **15 %** (92.2 s) — before 8 % (45.3 s) |
| `apworld` | **142/142** | 68 % (405.8 s) |

- The STOP rule (fast rows > 20 s, or either boot > 70 %) is not hit.
- The fast local run is not comparable to CI's absolute seconds.
  - The local fast run records `treeMoved: true`: it froze the tree with one uncommitted edit present (the screenshot
    script's wait fix, which no row loads). I parked that edit before the run ended and re-applied it after.
  - Its served modules were loaded at page boot, so no row ran different code.

**Packet facts:**
- **Gitlinks:** 0 (`git diff --raw 75e45c964d HEAD | grep 160000` is empty).
- **Closure ∩ diff = ∅:** `grep -axFf closure.txt` gives 0 lines. Nothing changed under `frontend/modules/shared/` or
  `mazeRoomEngine.js`.
- **`--print-engine-closure`** at the base and at the merge `03b7880634` is `engineMd5 bec369878feb67081187edca62baa951 (42
  files)`. Same file list and md5 at both.
- **`mt.sh origin/main HEAD`:** clean, at origin/main `ca966accde`.
- **CI:** the run ids are in the hand-off message. That covers the JSUT + `unittests` push runs at the last code-carrying
  head `03b7880634`, plus TT, `apworld`, `tutorials-seedling` and `feature-checks` dispatched at the final tip.
- **Review:** js-20 reviewed the flashPanel diff and **ACCEPTED** it. Both items are closed at `ef7fbde4db`.
- ⚠ **A commit under my own lock:** `ef7fbde4db` was committed with `BOX_LOCK_COMMIT_ANYWAY=1` under the screenshot
  script's own lock (same session). It changed HEAD, not a served file that run had loaded.

**Moved pins:** none. Every existing assertion is unchanged; the new rows are additions.

## Residue

**Step 4 (clicks):**
- Route clicks through `regionView/regionActions.js`, with the panel's own dispatcher senders and originator strings
  (`regionMapCheck`, `regionMap-…`), registered in `register()`.
- Add the `regionMap` prefix to `loops/loopModeExemptions.js` + its pin if the clicks should plan in loop mode (residue 10).
- `frameAt` and `squareAt` already give the cell and the square under the pointer. Today a click only selects.

**The grouping experiment (what R1 looks like with art, `seedling_playthrough-level.png`):**
- The overworld group (54 levels: 0, 1, 12, 24, 33–70, 83, 86–95, 98) is one big block that holds the dungeon levels 33–70
  reached by teleporter. Its own stairs therefore stay INSIDE the block, and only 27 links remain between groups.
- The stairs-only floors (13 → 17) stack as one-level groups.
- The source groups (`level_7`, `level_32`) sit top-right, with long arrows down across the map. These are the longest
  lines in the picture. A placement change (3a residue 5) would shorten them without touching grouping.
- 3a's R2a/b/c are the candidates to compare in the panel next.

**Other:**
- **Custom worlds' atlas** (item 9): needs a path for the derived atlas to reach `_hookCtx()`.
- **Bake memory:** each level is one 16 px/tile bake: 32.2 MB of RGBA for the 115 levels (summed extents × 256 × 4). A zoomed-out tier (e.g. 4 px/tile)
  would cut the first fit-all's 4 s, but needs a "tier ready?" query on the painter so cells don't flash the generic box while
  the higher tier bakes.
- **Maze and other substrates** declare no `regionExtent`. Their cells are 20×20 and the maze painter draws its own size
  inside, as in the chestdoor shot. A one-line hook on `mazeRoomLibrary.js` would size them.
- **Mixed `grid_cell` worlds** (3a residue 2) are unchanged.
- **Tutorial:** `regionMapPanel` is `NOT_COVERED_YET`.
