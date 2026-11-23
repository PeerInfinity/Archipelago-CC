# Region Map: squares and rings (region-map-squares-rings)

Three fixes from the user's manual test of the Region Map, plus one ruling made during the slice.

## ⚖ The user's notes (session 84c8ab35, archipelago-cc-23, 2026-11-23, after manual testing)

1. *"In the region map, the title text currently overlaps the boxes for the locations, for regions with no tiles. I want to move the
   location boxes lower so that the title text doesn't overlap it."*
2. *"When the region map zooms out, I don't want the circles to grow larger than the size of the tile they are circling, even if that
   makes them too small to see when zooming out."*
3. *"Also, I want to make the location boxes bigger in the region map, for regions without tiles. I'm not sure how big. Maybe double
   their current width and height. They can be scaled back down for regions that have too many locations to fit at the bigger size."*
4. **The maze ruling** (session 84c8ab35, 2026-11-23T21:05:24Z, put to the user by archipelago-cc-23 after js-23 raised it):
   *"Only levels without art (Recommended)"*. The option read: *"The 116 maze levels that draw art keep today's boxes, so the
   bigger boxes don't cover the art. The other 190 maze levels, and worlds like A Link to the Past, get the change."*

## What the user sees

- **A region with no tiles** (every region of a classic world such as A Link to the Past, TUNIC or Link's Awakening, and the maze's
  levels that draw no picture): its location squares are **twice as wide and tall** (1.4 tiles where they were 0.7), and they start
  **below the region's name**. The name never covers a square at any zoom. When the name is not drawn (the cell is under 60 px),
  the squares stay in the same place.
- **A crowded region** shrinks its squares only as far as it needs to fit all of them inside its cell, below the name. On the
  committed presets only soe's `Ingame` (340 locations) shrinks: its side goes from 0.7 to 0.569 tiles. alttp's most crowded region
  is **Eastern Palace (9)**, and TUNIC's is **Overworld (22)**; both keep the doubled size (54 fit at it).
- **A door ring** is never wider than its tile, halo included. Zoomed in it is capped at the old 9 px radius. When you zoom out it
  shrinks with the tile, and it is **not drawn at all** once it would be under 1 px. At Fit all on Seedling, no ring is drawn.
- **Unchanged:** squares on tiled levels (Seedling), the maze levels that draw art (by the ruling), links, arrowheads, layout and the
  Region Graph.

## The rules and constants

All of them are in `frontend/modules/regionMap/regionMapOverlay.js`, which is pure.

**Rule 1, the label band (zoom-independent: squares placed as if the label were present).** The label is sized in screen pixels,
so measured in world units it is tallest at the smallest zoom it is drawn at, when the cell is `LABEL_MIN_CELL_PX` = 60 px wide.
The first row's square centres sit at

`centreY = max((bottom + clear + minPx/2) · w/60,  (bottom + clear) · w/60 + side/2)` tiles,

where `bottom = labelBottomPx(60) = 9 + 7` (`LABEL_FONT_MIN_PX` + `LABEL_BOX_BOTTOM_PAD_PX`), `clear = LABEL_SQUARE_CLEAR_PX = 2`,
`minPx = MIN_SQUARE_PX = 6`, and `w` is the extent's width in tiles. A generic cell's frame is its cell, so `w` is the cell's width
in tiles. Zoomed in, the label, the gap and the half-side grow no faster than the cell, so the gap only widens. For the 20 × 20
`DEFAULT_EXTENT` this puts the first row's centres at 7 tiles. `_drawLabel` now reads its geometry from the same constants
(`labelFontPx`), so the two cannot drift apart.

**Rule 2, the ring:** `doorRingRadius(tileScreenPx)`:
`r = min(DOOR_RING_MAX_R_PX = 9, tileScreenPx/2 − DOOR_RING_HALO_HALF_PX)`, where `DOOR_RING_HALO_HALF_PX = (1.5 + 2)/2 = 1.75`. The
ring's outer edge, halo included, is therefore ≤ half the tile. **Sub-pixel rule: SKIP.** When `r < DOOR_RING_SKIP_R_PX = 1` (a
tile under 5.5 px on screen), no ring is drawn, and it is counted in `lastPaint.doorRingsSkipped` (`lastPaint.doorRings` counts the
drawn ones). `DOOR_RING_MIN_R_PX` (3.5) is gone. The constants moved to the overlay, and `regionMapUI.js` re-exports them.

**Rule 3, the generic squares:** `genericLocationTiles`. Each square's side is `GENERIC_SQUARE_FRACTION` (0.7) of the grid pitch.
The pitch is at most `GENERIC_PITCH_MAX_TILES` = 2, so the side is 1.4 tiles, twice the old `SQUARE_TILE_FRACTION` 0.7. The margins
are `GENERIC_MARGIN_TILES` = 0.5. When the locations do not fit, the pitch drops in steps of `GENERIC_PITCH_STEP_TILES` (1/16) until
they do. Each tile carries `size` (its side in tiles), and `frameSquares` draws a tile that has one as
`max(minPx, size · tilePx · zoom)`. A tile without one (a substrate's own) still goes through `squareSide`, the unchanged code
path. `squareAt` reads each square's own `side`, so clicks and hover follow the new sizes.

**The art switch:** `regionMapModel.js` `usesBigGenericPlaces(cell)` = `GENERIC_ART_CELLS_GET_BIG_PLACES || !cell.region`, with the
flag set to `false` by the ruling. An untiled cell that draws art keeps `legacyGenericLocationTiles`, which is base 6dbadc7364's
function, verbatim.

## Per preset (measured in the app, `scripts/dev/shot-region-map-squares-rings.mjs`, 1600 × 1000)

Untiled cells, split by whether they draw art: alttp 238 / 0 art · tunic 224 / 0 · ladx 378 / 0 · soe 1 / 0 ·
seedling_playthrough **0** · seedling_playthrough_maze 306 / **116 art** (unchanged) + 190 bare · seedling_generated_chestdoor
2 / 2 art (0 locations).

| preset | view | cell | zoom | squares (before / after) | side before | side after |
|---|---|---|---|---|---|---|
| alttp | Fit all | — | 0.112 | 268 / 268 | 6.00 | 6.00 |
| alttp | in (most crowded) | Eastern Palace | 2.372 | 9 / 9 | 26.57 | 53.13 |
| alttp | label (most crowded) | Eastern Palace | 0.200 | 204 / 204 | 6.00 | 6.00 |
| alttp | in (few) | Sewers Secret Room | 2.372 | 3 / 3 | 26.57 | 53.13 |
| alttp | label (few) | Sewers Secret Room | 0.200 | 165 / 165 | 6.00 | 6.00 |
| tunic | Fit all | — | 0.145 | 317 / 317 | 6.00 | 6.00 |
| tunic | in (most crowded) | Overworld | 2.372 | 24 / 24 | 26.57 | 53.13 |
| tunic | label (most crowded) | Overworld | 0.200 | 268 / 268 | 6.00 | 6.00 |
| ladx | Fit all | — | 0.098 | 226 / 226 | 6.00 | 6.00 |
| ladx | in (most crowded) | D1 Room | 2.372 | 4 / 4 | 26.57 | 53.13 |
| ladx | label (most crowded) | D1 Room | 0.200 | 113 / 113 | 6.00 | 6.00 |
| soe | Fit all | — | 2.691 | 340 / 340 | 30.13 | 24.48 |
| soe | in (most crowded) | Ingame | 2.372 | 340 / 340 | 26.57 | 21.59 |
| soe | label (most crowded) | Ingame | 0.200 | 340 / 340 | 6.00 | 6.00 |
| seedling_playthrough | Fit all | — | 0.100 | 89 / 89 | 6.00 | 6.00 |
| seedling_playthrough | Fit all (ring shot) | — | 0.100 | 89 / 89 | 6.00 | 6.00 |
| seedling_playthrough | in (ring shot) | — | 1.488 | 11 / 11 | 16.67 | 16.67 |
| seedling_playthrough | in (most crowded) | level_0 | 0.791 | 12 / 12 | 8.86 | 8.86 |
| seedling_playthrough | label (most crowded) | level_0 | 0.100 | 85 / 85 | 6.00 | 6.00 |
| seedling_playthrough_maze | Fit all | — | 0.123 | 89 / 89 | 6.00 | 6.00 |
| seedling_playthrough_maze | in (most crowded) | level_12__r0c19 | 2.372 | 4 / 4 | 26.57 | 26.57 |
| seedling_playthrough_maze | label (most crowded) | level_12__r0c19 | 0.200 | 76 / 76 | 6.00 | 6.00 |
| seedling_playthrough_maze | in (no-art cell) | level_12__r42c28 | 2.372 | 5 / 5 | 26.57 | 26.57–53.13 |
| seedling_playthrough_maze | label (no-art cell) | level_12__r42c28 | 0.200 | 75 / 75 | 6.00 | 6.00 |
| alttp, phone 390 | in | Sewers Secret Room | 0.757 | 18 / 18 | 8.48 | 16.95 |

"In" puts the whole cell in view, 85 % of the viewport's smaller side. "label" puts the cell at 64 px, just over the label
threshold. The 6 px floor sets a 16 px-tile cell's square below zoom 0.536 before (0.7 tile) and 0.268 after (1.4 tiles), so Fit all
reads the same before and after. soe is one cell, so its Fit all is zoomed in. On Seedling, `doorRings` after is 0 at Fit all (base drew every ring at its
3.5 px floor), 21 at 0.79 (r 4.58 px; base drew r 9, a ring 21.5 px across on a 12.7 px tile) and 14 at 1.49 (r 9, the cap).

## Identity checks (vitest scratch probes against base's files, `git show 6dbadc7364:…`)

- **Link sets:** `links` and `neighbourLinks` are byte-identical to base on seedling_playthrough (both seeds), seedling_er,
  seedling_playthrough_maze, seedling_generated_chestdoor, procgen_topdown (all 12 seeds), alttp (3 seeds), tunic and ladx.
- **Every substrate-tiled cell:** its tiles, and `frameSquares` at 6 zooms (0.005 to 8) × both cell modes, are byte-identical:
  seedling_playthrough 115 cells × 2 seeds, seedling_er 115, chestdoor 2. A JSON dump of base's model (links + tiled squares)
  for alttp, tunic, ladx, soe and seedling_playthrough has md5 `8e71d48bb82bac6d7a17ec1bc9186fcc` at base and at the tip.
- **The maze's art cells:** their tiles are byte-identical to base (116 cells), pinned in vitest against
  `legacyGenericLocationTiles`.
- **seedling_playthrough has no untiled cell**, so none of its squares move.

## Proof

- `regionMap/regionMapSquaresRings.test.js` (18 rows):
  - (1) the zoom sweep (×1.07 steps from `MIN_ZOOM` to `MAX_ZOOM`, plus the exact label threshold) over every generic cell of
    alttp, tunic, ladx and soe, in both modes: every square's top is below the label box. Below 60 px, each square at its own size
    clears the 60 px label box scaled to that zoom.
  - (2) the ring's outer diameter is ≤ the tile at every zoom, capped at 9 zoomed in, and null for a 1.6 px tile and just under
    the 1 px boundary.
  - (3) Sewers Secret Room (3 locations) gets exactly 2 × 0.7; Eastern Palace (9) keeps it; soe Ingame (340) is under it. Every
    generic cell is inside its cell with no two squares overlapping. `squareAt` hits the centre (and the inner corner) of a
    doubled square and the centre of a shrunk one.
  - (4) the art switch, and the maze split.
- **Bounded vitest:** regionMap/ (all files), tutorials/, regionView/ plus every importer of the touched files (21 files), and the
  docs pins (`docsBase`, `quickLaunch/`, `procgenDocs/`, `tutorials/`: 21 files, 717 tests) are all green.
- `tutorial-walk-tracker-region-map` passed locally on both boots at 15e050094a (40.7 s unbundled, 46.4 s bundled).

### CI at the gate tip `15e050094a3d31bd9cc7b5183cd8536936e532f9` (= the merge SHA: origin/main had not moved from base 6dbadc7364)

| Check | Run (headSha 15e050094a) | Result |
|---|---|---|
| JSUT (push) | 45267641515 | success. Suite 1425 files / 29992 tests, 0 failed (base 6dbadc7364 run 45246512226: 1424 / 29974) → **+F 1, +T 18** (`regionMapSquaresRings.test.js`); slow battery 37 / 446 at both |
| unittests (push) | 45267641677 | success |
| TT dispatch (`test-templates.yml`) | 45268478976 | every job success: ALTTP spoiler & regression; fast (135/135, **HEADROOM OK 317.5 s of 600 s, 53 %**; base 319.2 s); fast bundled (135/135, **316.5 s, 53 %**; base 326.2 s); apworld, seedling-js, seedling-js-solver, seedling-wasm, playback-bot |
| `test-substrates-manual.yml -f batch=tutorials-tracker` | 45268484419 | 9/9; **headroom 66.8 s of 600 s (11 %)**, base run 45246532825 49.5 s (8 %): +17.3 s, under the +20 s STOP. Every row in the run is 30 to 40 % slower than base, e.g. track-a-game 5.5 → 7.8 s, timer 5.5 → 7.4 s, region-map 14.0 → 17.8 s. `compare-runs.js` reports no status, roster or duration outliers |
| `test-substrates-repeat.yml -f test=tutorial-walk-tracker-region-map -f repeat=8` | 45268491614 | **Rate: 8/8 passed**; 18.8 to 20.1 s each (READY's repeat 45234619999 at a2b0986919: 16.4 to 17.4 s) |

- **Closure ∩ diff = ∅** (`seedlingDerivedRuleTable.js --print-engine-closure`): engineMd5 `74ae60f575531492ed9eaec1839e1fe3`
  over 42 files, the same at base and tip. **0 gitlinks** in the diff. `procgenCore/mapCamera.js` is untouched.


## Pins moved

None. No in-app row reads a square size or a ring radius that changed: `region-map-seedling-paints` reads squares ≥ `minSquarePx`
at `MIN_ZOOM` (still true) and the end counts (`tileEnds` and the rest), which this slice does not change. `lastPaint` gains
`doorRings`, `doorRingsSkipped` and `ringR`, all new. The docs changed are `docs/json/user/modules/regionMap.md` (the squares in an
untiled region, and the ring that disappears) and `docs/json/developer/modules/regionMap.md` (the overlay row and the new test). No
census pin reads either file.

## What still reads wrong

- **Zoomed in, a big empty band sits above the squares.** The band is sized for the label at its smallest, a quarter of the cell
  plus a square. Zoomed in, the label is tiny next to that band, so the squares start a third of the way down
  (`after-alttp-crowded-zoom.png`). A band that followed the zoom would move the squares while you zoom. Say if you want that
  instead.
- **The maze's art cells keep the old overlap.** By the ruling they keep base's squares, so where their label is drawn it can still
  cover the first row (the label has a dark box there). That is the old behaviour, unchanged.
- **The band assumes the default `minSquarePx` (6).** With a larger setting, the squares are bigger than their place at the label
  threshold and can touch the label. The setting has no maximum.
- **The rule assumes a generic cell's frame is its cell.** That holds for every generic cell on these presets, in both modes. A
  generic cell that shares a layout column with a much wider tiled level would have a wider cell than its art, so its label would
  appear at a smaller zoom. No committed preset has one.

## Shots (`squares-rings-shots/`, `before-*` / `after-*`)

`alttp-few-zoom` / `alttp-few-label` (Sewers Secret Room, 3) · `alttp-crowded-zoom` / `alttp-crowded-label` (Eastern Palace, 9) ·
`alttp-fit` · `soe-crowded-zoom` (Ingame, 340: shrunk to fit) · `seedling-ring-out` (Fit all: rings gone) · `seedling-ring-in`
(r = 9) · `phone-390-alttp` (the 390 px mobile layout) · `maze-fit`, `maze-art-zoom` / `maze-art-label` (level_12__r0c19, art, 4:
unchanged), `maze-bare-zoom` / `maze-bare-label` (level_12__r42c28, no art: changed) · `*-measure.json`.
