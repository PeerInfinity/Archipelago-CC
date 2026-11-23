# Region map: lines end at the level art, and at the door tile when it is known

Branch `region-map-art-ends`, cut at `178b2c16c0` (`git merge-base HEAD origin/main` at launch:
`178b2c16c0a6bcde3756036e47791362a945544e`). The gated code tip is `bbce26c66c`. Before the packet, origin/main was still
`178b2c16c0`, an ancestor of the tip, so there was nothing to merge. This report and its pictures are a docs-only commit after
the code tip.

## The rulings

All in session 84c8ab35 (archipelago-cc-23):

- **2026-11-23T01:20:20.902Z.** Asked "Mark READY?" after seeing `link-ends-shots/seedling_playthrough-group.png` and
  `phone-390-mobile-tab.png`, the user answered: *"End lines at the art. Also, if the arrows have a known source or
  destination tile, then the arrow should start or end at that tile, if possible."*
- **2026-11-22T21:55:35Z** still stands: gap marks between adjacent squares, and no arrowhead on joins. This slice refines
  "the square" that a line ends at to the level ART.
- **2026-11-22T20:24:34Z / ~20:35Z** still stand: which pairs get lines (every link inside a group, on every world). That is
  unchanged.
- Only the user marks a tutorial READY. `tracker-region-map` stays `in-progress`.
- js-22's review (GO WITH 3 EDITS, 2026-11-23): (1) use the link's own exit tile, never "the nearest", and pin a multi-exit
  case; (2) state one rule for where the line and the head end on a tile, and show a short link; (3) the link SET and the gap
  marks must stay byte-identical, and the census must count door-tile, art-clipped and still-centre ends.

## What changed

1. **`regionMap/regionMapLinkGeometry.js` `linkShape`**, the line branch only (cells that are not adjacent). The gap branch
   is untouched.
2. **`_drawLinks`** (`regionMapUI.js`) draws a **door ring** at a door-tile end, outlines a head that sits on a door tile, and
   counts `tileEnds`, `artEnds`, `centreEnds` and `shortHeads` in `lastPaint`.
3. **`regionMapModel.js` is not in the diff.** The link SET and each link's `a` / `b` door tiles are what they were.
4. **The tutorial step and docs.** The groups step of `tracker-region-map` now says that a line starts and ends at the door it
   uses (ringed, or marked by the arrowhead) or at the edge of the level's picture. `docs/json/user/modules/regionMap.md`
   describes the same. `generate-tutorial-docs.mjs --write` changed no file, since an in-progress tutorial has no guide page.

## The rules chosen

- **Which tile (js-22 edit 1).** An end's tile is the one the MODEL already gives the link: `a` is `exitTileOf` of the exit
  that made the link (in `from`'s level), and `b` is its reciprocal exit's tile (in `to`'s level). It is never "the nearest".
  It is deterministic: the model keeps the first exit, in sidecar-then-payload order, that names the pair (one link per
  unordered pair).
  - Pinned on **`level_16` → `level_17`** of `seedling_playthrough`. That pair has 7 pit exits from `level_16__r1c9` plus a
    stairway from `level_16__r3c7`. The link's `level_16` end is the first pit exit's own tile, `out_pit_7_2` `[12, 3]`, and
    the `level_17` end is that exit's reciprocal. It is also pinned on a hand-made pair whose FIRST exit is the far one.
- **Which tiles count.** A door tile counts only on a level whose extent is real. A cell whose substrate gives no extent
  (`ext.estimated`) is drawn as a 20 × 20 placeholder box, and the door's coordinates belong to a level of another size, so
  they have no true spot in it. Before this rule, 476 door tiles on 4 presets (procgen_topdown AP_7–9, the Seedling maze) fell
  OUTSIDE their own box. Such an end is clipped to the art instead (the `tileOnEstimated` column below).
- **Where on the tile (js-22 edit 2): the tile's CENTRE.** The line ends exactly on the door tile's centre: no clipping, and
  the line runs over its own level's art to the door.
  - At a `from` end, and at a `to` end with no head (a join), a **hollow ring** is centred on the tile.
  - At a `to` end with a head (down / up / warp), the **head's tip sits on the tile's centre** and there is no ring: the head
    marks that door. The head is outlined dark so it reads over the art. It keeps its size (8 px) and colour; no arrowhead rule
    changed.
- **An end without a usable tile** is clipped to the level ART rectangle (`f.x / y / w / h`), not the cell (`f.cell`), on the
  straight line between the two aim points.
- **The mixed cases (one fixed rule).** Each end's aim point is its door tile's centre if it has one, else its art's centre.
  The line is the straight segment between the two aim points, and only a no-tile end is cut back to its art's border.
  - Tile → no tile: the line starts at the tile and stops where it enters the target art, aimed at that art's centre.
  - No tile → tile: the line starts where it leaves its own art and ends at the tile.
- **Still-centre ends:** none. An end with no tile is always clipped, because the other end's aim point lies in another cell.
  The code still names the case (`ends.* === 'centre'`), so a census would list one.
- **Visibility (scope 3): the door ring.** I chose a marker, not a minimum length past the border: a door can be deep inside a
  big level, so a length rule would not mark it.
  - The ring's radius is ¾ of a tile on screen, clamped to **3.5–9 px**. The stroke is a 1.5 px line in the link's colour over
    a 3.5 px dark halo.
  - It is hollow, so it does not hide the door, and it does not read as a location square (those are filled).
  - There is no new setting.
- **Gap marks: unchanged** (byte-identical; see below). A door-tile end did not make a clearly better mark: the mark already
  sits at the doors' place along the shared border. So there is no before/after to ask about.

## The census

`scripts/dev/census-region-map-link-ends.mjs` (extended with per-end counts) over every committed preset: **211 presets,
0 errors**. Cells are sized by level.

| preset | gap marks | lines | heads | **door-tile ends** | **art-clipped ends** | still-centre ends | of which: door known, level size estimated | link-set md5 |
|---|---|---|---|---|---|---|---|---|
| `seedling_playthrough/AP_14089154938208861744` | 58 | 80 | 58 | **160** | **0** | 0 | 0 | `f374aede` |
| `seedling_er/AP_1` | 58 | 85 | 63 | **170** | **0** | 0 | 0 | `d9605a7f` |
| `seedling_atlas/AP_1` | 1 | 2 | 2 | **4** | **0** | 0 | 0 | `990c3edf` |
| `seedling_atlas_maze/AP_1` | 7 | 3 | 0 | **0** | **6** | 0 | 6 | `1c3efe03` |
| `seedling_atlas_sphere/AP_1` | 16 | 1 | 0 | **0** | **2** | 0 | 2 | `8d535bb3` |
| `seedling_playthrough_maze/AP_1` | 239 | 431 | 0 | **0** | **862** | 0 | 149 | `b69ccd42` |
| `procgen_maze/AP_1` / `AP_2` / `AP_3` | 2 / 4 / 11 | 0 | 0 | 0 | 0 | 0 | 0 | |
| `procgen_topdown/AP_1` (D0) | 8 | 0 | 0 | **0** | **0** | 0 | 0 | `1eead3de` |
| `procgen_topdown/AP_7` | 124 | 172 | 0 | **0** | **344** | 0 | 295 | `cb25043e` |
| `alttp/AP_14089154938208861744` (D0) | 46 | 251 | 0 | **0** | **502** | 0 | 0 | `8f4ff673` |
| `tunic/AP_14089154938208861744` | 93 | 203 | 0 | **0** | **406** | 0 | 0 | `571f70e6` |

- **All 211 presets:** 5,547 gap marks, 8,753 lines and 181 heads, each the same as link-ends. Of the 17,506 line ends,
  **494 end at a door tile, 17,012 on the art and 0 at a centre**. 1,186 ends have a door tile that is not used, because the
  level's size is estimated. 0 door tiles lie outside their own art.
- **4 presets have door-tile ends**: the two `seedling_playthrough` seeds, `seedling_er` and `seedling_atlas`.
- **alttp has 0 door ends**, as expected. Its cells are generic 20 × 20 boxes, and the box is the whole cell, so its lines
  end where they did.
- **Seedling reconciles:** 80 lines × 2 = 160 ends, all at door tiles. The model gives every Seedling link both `a` and `b`
  (pinned in `regionMapLinks.test.js`).
- **The link SET is byte-identical to base on all 211 presets.** The census ran the base tree's own code (`git archive
  178b2c16c0 frontend/modules frontend/presets` + the unchanged `shared` submodule) and the tip's, and compared the JSON of
  `model.links` + `model.neighbourLinks` per preset: **211 of 211 equal**. `regionMapLinks.test.js` still pins `groupLinks`
  against its frozen base copy (green).
- **The gap marks are byte-identical to base on all 211 presets.** Base `linkShape` (imported from the base tree) and the
  tip's were run over every link of every preset, in both cell-size modes: **11,094 gap marks equal**, and the gap/line split
  is the same for every link. `regionMapArtEnds.test.js` pins the same against a frozen verbatim copy of base
  `cellsAdjacent` / `gapSegment` / the gap branch, on 5 presets × 2 modes.
- **Measured in the app** (`shot-region-map-art-ends.mjs`, `art-ends-shots/measure.json`):
  - Seedling at Fit all drew 58 gap marks, 80 lines and 58 heads, with **160 door-tile ends, 0 art ends and 0 centre ends**,
    each equal to the census;
  - alttp at Fit all drew 46 / 251 / 0, with **0 / 502 / 0**.

## Proof

- **Vitest** (bounded, ⚖ 52): `regionMap/`, `tutorials/`, `modules/tests/`, `app/core/`, `app/initialization/`,
  `app/config/docsBase.test.js`, `quickLaunch/`, `regionView/nodeSelectedRetired.test.js`,
  `storagePanel/storageDeclarationPins.test.js` and `storagePanel/storageCensus.test.js`: **41 files, 614 tests, all
  passing**. These are the importers of every touched file (by `grep -a`), plus the doc-census tests.
  - **`regionMapArtEnds.test.js`** (new, 22 tests):
    - both ends with tiles;
    - a tile at the source only, and at the target only (on the art border, on the line toward the art's centre, inside the
      cell's outline);
    - neither (clipped to both ARTS);
    - art smaller than its cell, and a tall cell with small art;
    - a door tile on the art border;
    - the head's end;
    - a door tile on a level with an estimated size;
    - the own-exit rule, hand-made and on `level_16` → `level_17`;
    - the gap marks against the frozen base copy, on 5 presets × 2 modes. Every line end there is its door tile's centre
      (inside its art) or on its art's border.
  - `regionMapLinkGeometry.test.js`: one test renamed ("clipped to both ARTS"); its assertion is unchanged.
- **In-app rows** at `bbce26c66c`, on port 8143:
  - **the 17 Region Map rows: 17/17**, run twice (before and after the door-ring change);
  - `region-map-seedling-paints` gains one condition: `lastPaint.tileEnds` / `artEnds` / `centreEnds` must equal
    `linkShape`'s `ends` over the model, with tiles > 0 (Seedling: 160 / 0 / 0);
  - `region-map-zoom-pinch-links` and `region-map-mobile-tab` are unchanged and green. **No count was re-pointed**: the
    gap / line / head counts they read did not move.
- **Tutorial walk** `tutorial-walk-tracker-region-map`: passed locally twice (41.5 s, 42.2 s).
  `test-substrates-repeat.yml -f test=tutorial-walk-tracker-region-map -f repeat=8` run 45105658764: **Rate: 8/8 passed**.
- **Pins touched:**
  - `region-map-seedling-paints` (one condition added);
  - the `tracker-region-map` groups-step prose (no pin reads it; `tutorials.test.js` is green);
  - `docs/json/user/modules/regionMap.md` (the doc-census tests `docsBase.test.js` and `moduleDocsPins.test.js` are green).

  No procgen doc moved, and no doc-census pin moved.
- **Closure:** `seedlingDerivedRuleTable.js --print-engine-closure`: 42 files, engineMd5
  `74ae60f575531492ed9eaec1839e1fe3`. Closure ∩ diff = ∅, so the md5 is the same at base and tip. The diff has **0 gitlinks**.
- **CI at the code tip `bbce26c66c`** (each run's `head_sha` is that SHA):
  - JavaScript Unit Tests 45105630831: suite **1422 files / 29875 passed**, 0 failed, 0 skipped; slow battery 446/446.
    Base `178b2c16c0` (run 45093512701): 1421 / 29853. So JSUT is **+1 file, +22 tests (+T), 0 new failures (+F = 0)**: the
    new `regionMapArtEnds.test.js`;
  - unittests 45105630823: success;
  - TT (`test-templates.yml` dispatch) 45105650156, every job green: the ALTTP spoiler and regression, and the fast,
    fast-bundled, playback-bot, seedling-js, seedling-js-solver, seedling-wasm and apworld batches;
  - `test-substrates-manual.yml -f batch=tutorials-tracker` 45105652808: success;
  - `-f batch=tutorials` 45105655997: success;
  - `test-substrates-repeat.yml -f test=tutorial-walk-tracker-region-map -f repeat=8` 45105658764: **Rate: 8/8 passed**.
  - No `train_only` run is owed (closure ∩ diff = ∅).
- **Headroom** (`check-batch-headroom.js` in each job, budget 600 s; one sample each, since none came near a line):

  | batch | main `178b2c16c0` (TT 45101294334) | tip `bbce26c66c` (TT 45105650156 / manual) | delta |
  |---|---|---|---|
  | fast | 313.8 s (52%) | **317.8 s (53%)** | +4.0 s |
  | fast (bundled) | 332.5 s (55%) | **314.6 s (52%)** | −17.9 s |
  | tutorials-tracker | (no main run; link-ends tip: 64.3 s) | **66.4 s (11%)** | +2.1 s vs link-ends |
  | tutorials | (link-ends tip: 164.1 s) | 165.5 s (28%) | +1.4 s |

  Every sample is under 70% and under +20 s. The added condition is one loop over 138 links in a row that runs about 25 s.

## What still reads wrong (for the user)

- **A head can be longer than its line on the phone.** `level_16` → `level_17` (down) is the shortest headed line: 25.6 px at
  desktop Fit all, but **6.5 px at the phone's Fit all**, under the 8 px head, so the head covers the whole line there
  ([phone-390-short.png](art-ends-shots/phone-390-short.png)). It is the only one (`lastPaint.shortHeads` = 1). One pinch
  fixes it. No new style was invented. The desktop view is in
  [seedling_playthrough-short.png](art-ends-shots/seedling_playthrough-short.png).
- **Heads and rings are small when zoomed far in.** The head is a fixed 8 px, and the ring is at most 9 px. At zoom 1.9 a tile
  is 30 px, so the head is small beside the level art
  ([seedling_playthrough-short-zoom.png](art-ends-shots/seedling_playthrough-short-zoom.png)). Arrowhead rules were out of
  scope.
- **Lines now cross their own level's art** to reach the door. At 55% alpha they stay readable, but on busy art (`level_12`)
  they are faint until the ring.
- **Worlds with no level sizes** (the Seedling maze, procgen_topdown AP_7–9) know their doors but cannot place them, so their
  lines end at the placeholder box's border. Their **gap marks still use those door coordinates** to place the mark along the
  shared border (clamped to it). That was true at base, and it is unchanged here, because the gap marks had to stay
  byte-identical. It is worth a look if those worlds' gap marks seem misplaced.
- alttp's generic layout still crowds, as ruled acceptable before.

## Pictures

`art-ends-shots/` (by `scripts/dev/shot-region-map-art-ends.mjs`; the same cameras as `link-ends-shots/`). Each
`compare-*.png` puts the link-ends shot (left) beside the art-ends shot (right):

- [compare-seedling_playthrough-group.png](art-ends-shots/compare-seedling_playthrough-group.png): zoomed on the start
  level's group. Lines now run into the art to ringed doors; blue heads end on the door in `level_2`.
- [compare-seedling_playthrough-fit.png](art-ends-shots/compare-seedling_playthrough-fit.png): Fit all.
- [compare-seedling_playthrough-apart.png](art-ends-shots/compare-seedling_playthrough-apart.png): `level_12 ↔ level_95`,
  placed apart, now door `[0, 22]` to door `[38, 4]`.
- [seedling_playthrough-tall.png](art-ends-shots/seedling_playthrough-tall.png): a tall cell with small art. `level_86`'s cell
  is 96 × 960 world px around an 80 px-tall level. The warp from `level_0` now ends at the ring on its door inside the small art,
  not at the cell's outline (the link-ends report's "tall cells, small art" item).
- [compare-alttp-fit.png](art-ends-shots/compare-alttp-fit.png): a classic world. The generic box is the cell, so it is
  unchanged.
- [compare-phone-390-mobile-tab.png](art-ends-shots/compare-phone-390-mobile-tab.png): 390 px, the mobile layout, after a ×3
  pinch. [phone-390-fit.png](art-ends-shots/phone-390-fit.png): Fit all on the phone.
- [seedling_playthrough-short.png](art-ends-shots/seedling_playthrough-short.png),
  [phone-390-short.png](art-ends-shots/phone-390-short.png),
  [seedling_playthrough-short-zoom.png](art-ends-shots/seedling_playthrough-short-zoom.png): the shortest headed line (above).
- `measure.json`: every view's paint counts.

## For the READY call

Lines now end at the level art, or on the door tile itself (ringed, or under the arrowhead) where the map knows it. Mark READY
once the user has looked at [compare-seedling_playthrough-group.png](art-ends-shots/compare-seedling_playthrough-group.png)
and [compare-phone-390-mobile-tab.png](art-ends-shots/compare-phone-390-mobile-tab.png).
