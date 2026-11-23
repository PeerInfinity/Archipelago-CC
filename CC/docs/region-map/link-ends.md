# Region map: how links end, no arrowhead on joins, and the mobile tab

Branch `region-map-link-ends`, cut at `5634df8868` (`git merge-base HEAD origin/main` at launch:
`5634df8868e21e7963ce7ef4d05ea861bf0c0b1a`). The gated code tip is `a8dd18bf72`. origin/main had not moved when it was cut
(checked again before the packet: origin/main still `5634df8868`, an ancestor of the tip, so there was nothing to merge). This report and its pictures are a docs-only commit after it.

## The rulings

All in session 84c8ab35 (archipelago-cc-23), after the user saw the zoom-links shots (Seedling neighbours, the 390 px phone,
alttp):

- **2026-11-22T21:55Z**, arrowheads: **"No arrowhead on joins (Recommended)"**. The option read: *"Edge transitions inside a
  group draw as plain yellow lines. Down, up and warp keep their arrowheads, since those have a direction."*
- **2026-11-22T21:55Z**, mobile: **"Yes, add it (Recommended)"**. The option read: *"Small slice: add the Region Map to the
  mobile layout preset(s) next to the Region Graph."*
- **2026-11-22T21:55:35Z**, asked "Mark READY?", the user answered instead: *"For arrows between adjacent nodes, I want just a
  yellow line in the gap between the squares, not an arrow pointing to the center of the square. Also, for nodes that aren't
  adjacent, I would like the arrow to end at the edge of the square, not the middle of the square, if possible."*
- Still standing: 2026-11-22T20:24:34Z "Draw lines between neighbours" and ~20:35Z "Every link inside a group". This slice
  changes how lines END, not which pairs get one. Only the user marks a tutorial READY: `tracker-region-map` stays
  `in-progress`.

## What changed

1. **`regionMap/regionMapLinkGeometry.js`** (new, pure). It holds the rules below, and `linkShape(link, frames)`, which is
   the one answer to "how is this link drawn". The panel draws it and the census counts it.
2. **`_drawLinks`** (`regionMapUI.js`) draws `linkShape`:
   - **adjacent cells:** a solid, thick mark across the gap, from one cell's border to the other's. There is no line into
     either square. A join has no head. Another kind keeps its colour and gets a head across the gap.
   - **cells that are not adjacent:** the line from the door tile (or the level's centre) toward the other end, cut to start
     where it leaves its own cell and end where it enters the target cell. The direction is unchanged. The arrowhead (down /
     up / warp) sits on the target's border. A join gets no head here either.
   - `lastPaint` counts `gapMarks`, `edgeLines` and `arrowheads`, beside the `links` / `neighbourLinks` it already counted.
3. **The legend** needed no change. Every swatch was already a plain 14 × 3 px bar with no head, so the *edge transition*
   swatch already shows a plain yellow line, which is now what an edge transition looks like.
4. **The mobile tab**, below.
5. **Tutorial and docs.** The groups step of `tracker-region-map` now says that a short yellow line in the gap joins neighbours
   (no arrowhead, since you can walk both ways), and that arrows end at the edge of the square they point to.
   `docs/json/user/modules/regionMap.md` describes the new ends and the mobile tab. `generate-tutorial-docs.mjs --write`
   changed no file, since an in-progress tutorial has no guide page.

## The rules chosen

- **"The square" is the CELL (`f.cell`).** The panel strokes each cell's rectangle (`COLORS.cellBorder`). That outline is what
  reads as the square in every shot, Seedling and alttp alike. In the default *sized by level* mode, the art is often much
  smaller than its cell: a cell is as wide as its column's widest level and as tall as its row's tallest. A line clipped to the
  art would stop inside another square's outline, so the art was not used.
- **Adjacency (`cellsAdjacent`)** is defined on the cell rectangles. Two cells are adjacent when:
  - they face each other across ONE gap of at most **`GUTTER_PX` (32 world px)**, the gutter between two neighbouring slots;
  - and their facing sides overlap by a positive length.

  The gap between groups is `GAP_PX` + a gutter (128 px), so it never counts. A **corner touch is NOT adjacent**: two
  diagonal cells share no border to put the mark on, so they get a clipped line. The tolerance is inclusive, with an
  epsilon of 1e-9; a gutter of 0 is adjacent. Because a cell fills its column and its row, this is the same answer in both
  cell-size modes.
- **Where the gap mark sits:** at the door tiles' place along the shared border, as the mean of the two projected onto it
  (just the one when only one end has a door), clamped to the shared stretch. With no door tile, it sits at the middle of the
  shared border.
- **The minimum gap mark** (`regionMapUI.js`). The gutter is 32 world px, which is about 3 px on screen at Seedling's Fit all
  (zoom 0.0997 on a 1600 px desktop) and under 1 px on the phone (0.025):
  - length at least **`GAP_MARK_MIN_PX` = 8 px**, or **`GAP_HEAD_MIN_PX` = 12 px** with a head, stretched about the gap's
    middle, so at small zooms it runs a little into both borders;
  - thickness **one level tile** (16 world px × zoom), clamped to **3–6 px**;
  - drawn at alpha **0.9**, where long lines are 0.55, since a mark crosses no art. A warp across a gap is drawn solid, not
    dashed: a 4-px dash pattern is unreadable on an 8-px mark.

## The counts

The census script `scripts/dev/census-region-map-link-ends.mjs` builds the model for every `frontend/presets/*/AP_*/` rules
file (211 presets, 0 errors) and counts its links with `linkShape` (cells sized by level):

| preset | groups | cross-group | in-group | **gap marks** | **clipped lines** | **arrowheads** | non-join gap marks | link-set md5 |
|---|---|---|---|---|---|---|---|---|
| `seedling_playthrough/AP_14089154938208861744` | 43 | 55 | 83 | **58** | **80** | **58** | warp 1 | `f374aede` |
| `seedling_er/AP_1` | 43 | 61 | 82 | 58 | 85 | 63 | warp 1 | `d9605a7f` |
| `seedling_atlas/AP_1` | 3 | 2 | 1 | 1 | 2 | 2 | — | `990c3edf` |
| `seedling_playthrough_maze/AP_1` | 1 | 0 | 670 | 239 | 431 | 0 | — | `b69ccd42` |
| `seedling_atlas_maze/AP_1` | 1 | 0 | 10 | 7 | 3 | 0 | — | `1c3efe03` |
| `procgen_maze/AP_1` / `AP_2` / `AP_3` | 1 | 0 | 2 / 4 / 11 | all | 0 | 0 | — | |
| `procgen_topdown/AP_1` (D0) | 1 | 0 | 8 | 8 | 0 | 0 | — | `1eead3de` |
| `procgen_topdown/AP_7` | 1 | 0 | 296 | 124 | 172 | 0 | — | `cb25043e` |
| `alttp/AP_14089154938208861744` (D0) | 3 | 0 | 297 | 46 | 251 | 0 | — | `8f4ff673` |
| `tunic/AP_14089154938208861744` | 9 | 0 | 296 | 93 | 203 | 0 | — | `571f70e6` |

All 211 presets: **5,547 gap marks, 8,753 clipped lines, 181 arrowheads.**

- **Seedling reconciles with zoom-links.**
  - The 58 gap marks are zoom-links' 58 side-by-side neighbour pairs.
  - The 80 clipped lines are the 55 cross-group links + the 25 in-group links that are not side by side. Of those 25, 23 are
    edge transitions (the "placed-apart" ones, now without a head) and 2 are `level_48 ↔ level_49` (down) and
    `level_51 ↔ level_53` (up).
  - The 58 heads are 55 cross-group (down 20, up 11, warp 24) + those 2 + `level_27 ↔ level_28`.
- **Down / up / warp between adjacent cells:** one per Seedling world, `level_27 ↔ level_28` (the borderline warp). It is drawn
  as a green gap mark with a head. There are no down or up gap marks on any preset.
- **No cross-group link is a join** on any preset (0 of all cross-group links), so "no head on joins" only ever touches
  in-group lines.
- **The link SET is byte-identical to base on all 211 presets.** The census ran the base tree's own model code (`git archive
  5634df8868 frontend/modules frontend/presets` + the unchanged `shared` submodule) and the tip's, and compared the JSON of
  `model.links` + `model.neighbourLinks` per preset: **211 of 211 equal**. `regionMapModel.js` is not in the diff, and
  `regionMapLinks.test.js` still pins `groupLinks` against its frozen base copy (green at the tip).
- **Measured in the app** (`shot-region-map-link-ends.mjs`, `link-ends-shots/measure-desktop.json`). Seedling at Fit all drew
  55 + 83 links: **58 gap marks, 80 lines, 58 arrowheads**, each equal to the census. alttp at Fit all drew 0 + 297:
  **46 / 251 / 0**.

## The mobile tab: its cause and its fix

**Cause: the Region Map WAS a mobile tab, just buried.** The zoom-links report said the mobile layout had no Region Map tab.
That was wrong. Measured at base (`5634df8868`, 390 px, the real mobile layout):

- `mobileLayoutManager.determinePanelOrder` builds the columns from the active layout preset;
- every registered panel the preset does not list goes to the **middle column's tail**;
- so `regionMapPanel` was the **15th of 17 tabs** in the middle column, after Settings and Resources, behind two taps on ▶
  past a scrolling tab bar.

**Fix: mobile only, no preset change.** `moduleInfo.mobileAfter: 'regionGraphPanel'` (in `regionMap/index.js`):

- `determinePanelOrder` puts an unlisted panel that names `mobileAfter` right after that panel, in that panel's column, when
  it is there;
- panels with `mobileAfter` are placed after the other unlisted ones, so an unlisted anchor is already placed whatever the
  registration order;
- with no anchor, the panel goes to the middle column's tail, as before;
- a panel the preset lists is never moved.

`layout_presets.json` is **byte-identical** (not in the diff), so no desktop layout of any world changes (js-22 edit 1: the
diff limited to that file is empty).

**Measured at 390 px on the MOBILE layout** (no `?layout=`; it auto-detects; `isMobile`, `hasTouch`, DPR 3; the touches are
real input through CDP `Input.dispatchTouchEvent`; `measure-phone.json`):

| check | result |
|---|---|
| the tab is present, once, right after the Region Graph's | ✅ middle column: Console, Region Graph, **Region Map**, Playback Bot, … |
| a real tap on the tab opens the panel and it paints | ✅ `activePanel = regionMapPanel` |
| a two-finger pinch on the canvas, 60 → 180 px | map zoom 0.025128 → 0.075384 (×**3.000**); `visualViewport.scale` **1**; clicks 0 → 0; every scroller 0 |
| a one-finger drag on the canvas | camera (4136, 64) → (5197, 1337); zoom unchanged; page and every panel scroller 0; clicks 0 |
| CONTROL: the same pinch on the panel's toolbar | `visualViewport.scale` **2.46**, so the instrument does see a page zoom |
| zoom buttons, the strip, Go to | drawn on the phone ([phone-390-mobile-tab.png](link-ends-shots/phone-390-mobile-tab.png)); the toolbar wraps |

**Saved layouts** (js-22 edit 2). A saved layout reaches the mobile boot as a saved mode blob
(`archipelagoToolSuite_modeData_default`, as the JSON panel saves it), whose `layoutConfig` becomes the presets. The
mobile layout reads no other saved state: `activeLayout` only picks a preset id. I seeded the blob with a desktop
`goldenLayoutInstance.saveLayout()` dump and confirmed the phone booted from it (a marker in the blob was read back):

| saved layout | Region Map tabs | where | page errors |
|---|---|---|---|
| without the Region Map | **1** | right after the Region Graph | none new |
| with the Region Map (opened on desktop, then saved) | **1** | where the saved layout put it (after Window Manager): a listed panel is not moved | none new |

There is no crash and no duplicate panel (one mounted Region Map canvas in each). No migration was needed. The one page error
in every phone boot, *"SecurityError: … Blocked a frame … from accessing a cross-origin frame"*, was there at base too (my
first probe, before any change).

## Proof

- **Vitest** (bounded, ⚖ 52; `regionMap/`, `tutorials/`, `app/core/`, `app/initialization/`, `app/config/docsBase.test.js`,
  `quickLaunch/`, `modules/tests/`, `regionView/nodeSelectedRetired.test.js`, `storagePanel/storageDeclarationPins.test.js`,
  `storagePanel/storageCensus.test.js`): **40 files, 591 tests, all passing** (the importers of every touched file, by `grep
  -a`).
  - `regionMapLinkGeometry.test.js`:
    - a shared border on each of the four sides;
    - a gutter of 0 and of N, and one past the tolerance;
    - a corner touch, NOT adjacent;
    - a partial overlap;
    - the gap mark with no doors, one door, two doors, a door on the border, a door past the shared stretch (clamped);
    - clipping from inside, from outside, a door on the border, a diagonal keeping its slope, overlapping cells;
    - the arrowhead rule;
    - `linkShape` on a hand-made layout;
    - the minimum length, including a zero-length mark.
  - `mobileLayoutPanelOrder.test.js`:
    - the anchor;
    - a preset without the anchor;
    - an unregistered anchor;
    - the registration order;
    - two followers;
    - a listed panel never moved;
    - every committed preset.
- **In-app rows** at `a8dd18bf72`:
  - `region-map-zoom-pinch-links` gains two conditions. `lastPaint.gapMarks` / `edgeLines` / `arrowheads` must equal what
    `linkShape` says over the model (procgen_topdown AP_1: 8 / 0 / 0). No count was re-pointed: the existing `links` /
    `neighbourLinks` conditions are unchanged and still hold.
  - New row **`region-map-mobile-tab`** (category *Region Map*, batch **fast**, about 0.1 s):
    - the registry's own moduleInfo has `mobileAfter`;
    - the mobile order puts the Region Map after the Region Graph on all 7 presets;
    - on a `--layout=mobile` boot it also taps the live tab and waits for a paint.
  - The 17 Region Map rows: **17/17 unbundled and 17/17 bundled**. `region-map-mobile-tab` with `--layout=mobile`: passed on
    both boots, with the live-tab conditions. `mobile-tab-bar-resolves-every-panel` (regression roster): passed unbundled,
    bundled, and with `--layout=mobile`.
- **Tutorial walk** `tutorial-walk-tracker-region-map`: passed locally twice (41.7 s, 38.4 s).
  `test-substrates-repeat.yml -f test=tutorial-walk-tracker-region-map -f repeat=8` run 45086361795: **Rate: 8/8 passed**.
- **Pins touched:** no existing count was re-pointed. Two existing rows changed:
  - `region-map-zoom-pinch-links` (two conditions added);
  - the `tracker-region-map` groups-step prose (no pin reads it; `tutorials.test.js` is green).

  The doc-census tests (`docsBase.test.js`, `moduleDocsPins.test.js`) are green with `regionMap.md` edited. No procgen doc
  moved.
- **Closure:** `seedlingDerivedRuleTable.js --print-engine-closure`: 42 files, engineMd5 `74ae60f575531492ed9eaec1839e1fe3`.
  Closure ∩ diff = ∅, so the md5 is the same at base and tip. No `train_only` is owed. The diff has **0 gitlinks**.
- **CI at the code tip `a8dd18bf72`** (each run's `head_sha` is that SHA):
  - JavaScript Unit Tests 45086356756: suite **1420 files / 29842 passed**, 0 failed, 0 skipped; slow battery 446/446.
    Base `5634df8868` (run 45076241066): 1418 / 29811. So JSUT is **+2 files, +31 tests (+T), 0 new failures (+F = 0)**;
  - unittests 45086356792: success;
  - TT (`test-templates.yml` dispatch) 45086356462, every job green: the ALTTP spoiler and regression, and the fast,
    fast-bundled, playback-bot, seedling-js, seedling-js-solver, seedling-wasm and apworld batches;
  - `test-substrates-manual.yml -f batch=tutorials-tracker` 45086358994: success;
  - `-f batch=tutorials` 45086403319: success. It is owed because `tutorialLayout.js` / `tutorialExecutor.js` import
    `mobileLayoutManager.js`;
  - `test-substrates-repeat.yml -f test=tutorial-walk-tracker-region-map -f repeat=8` 45086361795: **Rate: 8/8 passed**.
- **Headroom** (`check-batch-headroom.js` in each job, budget 600 s):

  | batch | main `5634df8868` (TT 45084264737) | tip `a8dd18bf72`, 1st sample | tip, 2nd sample (job re-run, same SHA) |
  |---|---|---|---|
  | fast | 312.0 s (52%) | 332.1 s (55%), **+20.1 s** | **315.4 s (53%), +3.4 s** |
  | fast (bundled) | 319.8 s (53%) | 337.4 s (56%), +17.6 s | **322.1 s (54%), +2.3 s** |
  | tutorials-tracker | (no main run; zoom-links tip: 62.5 s) | **64.3 s (11%)** | — |
  | tutorials | — | 164.1 s (27%) | — |

  The first fast sample sat 0.1 s over the +20 s line. That is variance, not the diff: the diff adds one row of about
  0.1 s, and a re-run of the same job at the same SHA gave +3.4 s. Every sample is under 70%.

## What still reads wrong (for the user)

- **Generic-layout worlds still crowd** ([alttp-fit.png](link-ends-shots/alttp-fit.png)). Ruled acceptable. The hub's
  starburst now starts at the hub's border, but 251 of alttp's 297 lines still join cells that are not side by side, and
  they cross other cells.
- **Tall cells, small art.** Sized by level, a small level sits in the middle of a cell as tall as its row's tallest level
  (for example `level_0` beside `level_12`). The line ends at the cell's outline, which can be far from the art
  ([seedling_playthrough-apart.png](link-ends-shots/seedling_playthrough-apart.png)). The outline is what reads as the square,
  so that is what was chosen. Clipping to the art would end lines inside another cell's outline.
- **A gap mark is small at Fit all on a phone.** It is 8 px long and 3 px thick, so it is visible but not prominent
  ([phone-390-mobile-tab.png](link-ends-shots/phone-390-mobile-tab.png)). One pinch makes it obvious.

## Pictures

`link-ends-shots/` (by `scripts/dev/shot-region-map-link-ends.mjs`):

- [seedling_playthrough-fit.png](link-ends-shots/seedling_playthrough-fit.png): Fit all, every link;
- [seedling_playthrough-group.png](link-ends-shots/seedling_playthrough-group.png): zoomed on the start level's group: the yellow
  gap marks between neighbours, the arrows ending at the cells' edges;
- [seedling_playthrough-apart.png](link-ends-shots/seedling_playthrough-apart.png): `level_12 ↔ level_95`, an edge transition
  between cells that are not side by side: a headless yellow line from `level_12`'s border to `level_95`'s;
- [alttp-fit.png](link-ends-shots/alttp-fit.png): a classic world;
- [phone-390-mobile-tab.png](link-ends-shots/phone-390-mobile-tab.png): 390 px, the MOBILE layout, the Region Map tab open next
  to the Region Graph's, after a pinch;
- `measure-desktop.json`, `measure-phone.json`: the numbers above.

## For the READY call

Edge transitions are now plain yellow marks in the gaps and arrows stop at the squares' edges; the Region Map has its own
mobile tab next to the Region Graph's. Mark READY once the user has looked at
[seedling_playthrough-group.png](link-ends-shots/seedling_playthrough-group.png) and
[phone-390-mobile-tab.png](link-ends-shots/phone-390-mobile-tab.png).
