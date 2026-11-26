# Region Map: tiled squares never outgrow their tile (region-map-tiled-squares-cap)

## ⚖ The user's rulings (session 84c8ab35, archipelago-cc-23)

1. 2026-11-23, answering the planner's *"the location boxes on levels that do have tiles also have a minimum size (6 px). So when
   zoomed far out, they can also be larger than their tile. Tell me if you want those to shrink the same way."*:
   **"Yes, I also want to prevent the location boxes from growing larger than their tile."**
2. What happens under a 1 px tile. Asked first about the phone only, the user answered **"Skip them"** (2026-11-24T00:35:39.877Z).
   Re-asked with the desktop finding (in the ordinary desktop layout every Seedling square vanished at Fit all), they changed it
   to **"Keep a 1 px dot"** (2026-11-24T00:36:20.300Z). The option read: *"A box never drops below 1 px, so the status colours
   stay faintly visible at Fit all. Below 1 px tiles a box is slightly larger than its tile (2× at 0.5 px)."* **The first answer
   is superseded**; this slice implements the second.

## What the user sees

- **On a level with tiles (Seedling)**, a location square is never larger than its tile. Zoomed in, nothing changes. Once you
  zoom out far enough that a tile is smaller than the **minimum square size** setting (6 px), the square fills its tile instead
  of staying 6 px. Below a 1 px tile it stays a **1 px dot**, so every location keeps its colour at any zoom.
- **Fit all on Seedling:** the squares are 1.59 px (full-window 1600 × 1000) or 1 px dots (the ordinary desktop layout, and the
  390 px phone). They were 6 px boxes that covered several tiles.
- **Clicks and hover follow the drawn size.** At Fit all a square is a 1 to 1.6 px target. ⚠ That is the cost of the ruling, and
  this slice adds no click slop (out of scope). The smallest clickable side at Fit all on `seedling_playthrough`:

  | layout | Fit all zoom | tile on screen | smallest clickable side (before → after) |
  |---|---|---|---|
  | desktop, panel full-window 1600 × 1000 | 0.0997 | 1.59 px | 6 → **1.59 px** |
  | desktop, the ordinary layout (panel in its slot, 1280 × 720, as the in-app rows run) | 0.0310 | 0.50 px | 6 → **1 px** |
  | phone 390 × 844 | 0.0251 | 0.40 px | 6 → **1 px** |

- **Unchanged:** squares in regions without tiles (alttp, the maze levels: squares-rings' rules stand), square positions, the
  set of squares, the door rings (they keep squares-rings' skip under 1 px), links, arrowheads and layout.

## The rule

`frontend/modules/regionMap/regionMapOverlay.js`:

`tiledSquareSide(frame, zoom, minPx) = max(TILED_SQUARE_FLOOR_PX, min(tilePx · zoom, max(minPx, tilePx · zoom · 0.7)))`,
`TILED_SQUARE_FLOOR_PX = 1`.

- `frameSquares(…, { capToTile })` uses it for a tile without `size`; `regionMapUI._drawSquares` passes `capToTile` for a cell
  whose `tileSource === 'substrate'`. Generic (untiled) cells, including the maze's art cells (`legacyGenericLocationTiles`),
  never get the cap: by squares-rings they are "untiled", and the brief kept their sizing out of scope.
- **`minSquarePx` stays** (no new setting). It now holds only while the tile is at least that big on screen.
- Wherever today's side was already ≤ the tile (the tile ≥ `minPx` on screen) the value is unchanged. The side changes only when
  the tile is under `minPx`. The only case where a square is larger than its tile is below a 1 px tile, where it is 1 px.
- **Sub-pixel:** drawn (the 1 px dot), never skipped. The ring's rule (skip) is NOT matched, by ruling 2.
- **Centres never depend on the side**, so positions and the square set are byte-identical (js-23's move-set condition).

## Per preset (measured in the app, `scripts/dev/shot-region-map-tiled-squares-cap.mjs`, desktop 1600 × 1000, panel full-window)

"in" = the start cell, whole cell in view. Centres compared square by square, before vs after (`*-measure.json`).

| preset | view | zoom | tile on screen | squares before / after | skipped at Fit all | `minSquareSide` before → after | centres moved | sides changed |
|---|---|---|---|---|---|---|---|---|
| seedling_playthrough | Fit all | 0.0997 | 1.594 px | 89 / 89 | 0 | 6.00 → **1.594** | 0 | 89 |
| seedling_playthrough | in (level_0) | 0.7907 | 12.65 px | 12 / 12 | — | 8.856 → 8.856 | 0 | 0 |
| seedling_playthrough_maze | Fit all | 0.1229 | — (0 tiled cells of 306) | 89 / 89 | 0 | 6.00 → 6.00 | 0 | 0 |
| seedling_playthrough_maze | in (level_0__r7c6) | 2.3720 | — | 2 / 2 | — | 53.13 → 53.13 | 0 | 0 |
| alttp | Fit all | 0.1116 | — (0 tiled cells of 238) | 268 / 268 | 0 | 6.00 → 6.00 | 0 | 0 |
| alttp | in (Links House) | 2.3720 | — | 8 / 8 | — | 53.13 → 53.13 | 0 | 0 |
| seedling_playthrough, phone 390 | Fit all | 0.0251 | 0.402 px | 89 / 89 | 0 | 6.00 → **1.00** | 0 | 89 |

Zoomed-in values do not move. No square is added, dropped or moved anywhere. The in-app rows also read the ordinary desktop
layout: Fit all zoom 0.0310, tile 0.50 px, all 89 squares drawn at 1 px.

## Pins moved

- **`region-map-seedling-paints`** (`frontend/modules/tests/testCases/regionMapTests.js`), one condition, plus its description
  and its `_comment` in `playwright_tests_config-substrates.json`:
  - old: *at the minimum zoom every square is ≥ `minSquarePx`* (`q.side >= 6`);
  - new: *at the minimum zoom every square is ≤ max(its tile, 1 px) and ≥ max(1 px, min(`minSquarePx`, its tile))*. At
    `MIN_ZOOM` (tile 0.08 px) every square is 1 px.
  - Time: CI playback-bot batch 9.2 s at base 363564bffa and 9.2 s at the tip. Locally (the 18-row list): 21.3 s unbundled,
    29.7 s bundled (base, bundled: 36.6 s).
- **`region-map-clicks-seedling`**: not moved. Under the superseded "Skip them" rule it lost its green and red squares at Fit
  all and was re-pointed. With the 1 px dot it passes at Fit all again, so that re-point was **reverted** (the row is
  byte-identical to base). CI 8.0 s (base 7.7 s).
- **Tutorial:** no step reads a square size. `tutorial-walk-tracker-region-map`'s `squares` step (`canvas[data-squares] > 0`) is
  unaffected, since nothing is skipped.
- **Docs:** `docs/json/user/modules/regionMap.md` (the minimum-size sentence and the `minSquarePx` row) and
  `docs/json/developer/modules/regionMap.md` (the overlay row and the new test). No census pin reads either.

## Proof

- **`regionMap/regionMapTiledSquaresCap.test.js`** (13 tests): a zoom sweep (×1.07 from `MIN_ZOOM` to `MAX_ZOOM`) over every
  tiled cell of seedling_playthrough, in both cell modes and with `minPx` 6, 1 and 20. It checks that centres, locations and kinds
  equal the uncapped call's, and that the uncapped side equals base's formula. The side is ≤ max(tile, 1), equals today's side
  wherever that is ≤ the tile, equals the tile in the cap band, and is 1 px under a 1 px tile. It also checks the formula's
  corners, the sub-pixel case (exactly 1 px, 0.99 of that, half, `MIN_ZOOM`: all 1 px, none skipped) and that untiled squares are
  unchanged. Through the real `RegionMapUI._drawSquares`: a click at a capped square's centre hits it, and 3 px off misses where
  6 px reached. At `MIN_ZOOM` every square is drawn as a hittable 1 px dot. Zoomed in, the panel draws today's side.
- **Bounded vitest** (`regionMap/`, `tutorials/`, `regionView/`, `quickLaunch/`, `procgenDocs/`, `docsBase.test.js`,
  `testBatches.test.js`, `testWebgpu.test.js`, every importer of a touched file): 44 files, 1055 tests, green.
- **Local in-app**, all 17 Region Map rows + `tutorial-walk-tracker-region-map`: unbundled 18/18. Bundled 17/18: the tutorial
  walk fails at step 11 (`click-region`, a Go-to region pick that reads no square size) **only after the other 17 rows**.
  ⚖ Control: base 363564bffa, the same 18-row bundled list, fails the same step the same way. So this is pre-existing and order
  dependent, not this slice. Run solo on the bundled boot at the tip it PASSES (51.7 s), and unbundled at the tip it passes in
  the list (33.4 s).

### CI at the gate tip `d4dd440b81` (= the merge SHA: origin/main had not moved from base 363564bffa)

| Check | Run (headSha d4dd440b81) | Result |
|---|---|---|
| JSUT (push) | 45299704961 | success. Suite **1428 files / 30034 tests**, 0 failed (base 363564bffa run 45293415829: 1427 / 30021) → **+F 1, +T 13** (`regionMapTiledSquaresCap.test.js`); slow battery 37 / 446 at both |
| unittests (push) | 45299704958 | success |
| TT dispatch (`test-templates.yml`) | 45299825088 | every job success. fast 135/135, **HEADROOM OK 319.9 s of 600 s (53 %)**, base 338.5 s. fast bundled 135/135, **334.1 s (56 %)**, base 333.1 s (+1.0 s). playback-bot 17/17, 114.8 s (19 %). ALTTP spoiler & regression, apworld, seedling-js, seedling-js-solver, seedling-wasm all success |
| `test-substrates-manual.yml -f batch=tutorials-tracker` | 45299828841 | 9/9, **headroom 54.1 s of 600 s (9 %)**, base run 45276137574 57.4 s (10 %) |
| `test-substrates-repeat.yml -f test=tutorial-walk-tracker-region-map -f repeat=8` | 45301983869 | **Rate: 8/8 passed**, 16.4 to 17.3 s each (squares-rings' repeat 45268491614: 18.8 to 20.1 s) |

- **Closure ∩ diff = ∅** (`seedlingDerivedRuleTable.js --print-engine-closure`): engineMd5 `74ae60f575531492ed9eaec1839e1fe3`
  over 42 files, the same at base and at the tip. **0 gitlinks** in the diff. `procgenCore/mapCamera.js` is untouched.

## Shots (`tiled-squares-cap-shots/`, `before-*` / `after-*`)

`seedling-fit` (Fit all, 1600 × 1000) · `seedling-fit-crop` (the same, 400 × 300 around the start level: the 6 px boxes become
tile-sized dots) · `seedling-in` (zoomed in: identical) · `phone-390-seedling` (the 390 px mobile layout at Fit all: 1 px dots)
· `*-measure.json` (every drawn square's key, location, centre and side, per view).

## What still reads wrong

- **At Fit all a square is a 1 to 1.6 px target.** You can still click one, but only by hitting its pixel. Zoom in to click
  comfortably. A click slop (hit-testing a few px around a tiny square) would fix it without changing what is drawn. Not done:
  new scope.
- **The maze's art levels keep their 6 px floor** (`legacyGenericLocationTiles`, no `size`, not substrate-tiled), so at Fit all
  their squares can still be larger than the maze art's tiles. By squares-rings they count as untiled, and the brief kept untiled
  sizing out of scope. Say if they should get the cap too: it is the `capToTile` condition in `_drawSquares`.
