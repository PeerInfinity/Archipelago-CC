# Region map: zoom that works on a phone, and lines between neighbours

Branch `region-map-zoom-links`, cut at `9e8172bf58` (`git merge-base HEAD origin/main` at launch:
`9e8172bf586af02d6275c26e425626bdf5c36ba8`), merged with origin/main `ba36761859` at `2ebee735c9` (the gated code tip).
This report and its pictures are a docs-only commit after it.

## The rulings

All in session 84c8ab35 (archipelago-cc-23), after the user tried the `tracker-region-map` tutorial:

- **2026-11-22T20:18:07Z**, the request: *"The tutorial works. I would like a way to zoom, preferably a way that also works on
  mobile. Also, I don't see the edge transition lines."*
- **2026-11-22T20:24:34Z**, the answer to "how should edge transitions show": **"Draw lines between neighbours"**. The option
  read: *"A yellow line between every pair of side-by-side levels you can walk between, like the links between groups. This
  undoes the 'no lines between adjacent cells' choice from the panel build."*
- **~2026-11-22T20:35Z**, after the census below showed the generic-layout worlds' line counts (alttp 297, 46 of them side
  by side): **"Every link inside a group"**. Every world gets every in-group link; the crowding on classic worlds is
  accepted. The alternatives offered were "generic worlds: side-by-side pairs only" and "side-by-side pairs only everywhere".
- Unchanged: the Region Map is its own panel (2026-11-16), and only the user marks a tutorial READY.

## What changed

1. **Zoom buttons.** **−** and **+** (`region-map-zoom-out`, `region-map-zoom-in`) sit right after *Fit all*. Each press zooms
   around the middle of the view (`zoomStep`, `regionMapUI.js`), inside `mapCamera`'s limits (`zoomAround` is called; `mapCamera.js`
   is not changed), and calls `_manualCamera()` as the wheel does, so *Follow player* unticks the same way. A press stamps
   `canvas.dataset.zoomedAt`, and every paint writes `canvas.dataset.zoom`: the tutorial step reads those, never the instance.
2. **Two-finger pinch.** `regionMap/pinch.js` is a pure gesture machine fed by `pointerId`:
   - one pointer is a drag, exactly as the mouse was: nothing until 3 px, then a pan by each move;
   - two pointers pinch: the midpoint's movement pans (`panBy`), the finger-distance ratio zooms around the new midpoint
     (`zoomAround`), in that order, so the map point between the fingers stays between them;
   - a third pointer does not steer;
   - a gesture that ever had two pointers is never a click, whichever finger lifts first;
   - two → one: the finger left on the glass drags on from where it is, already moving, so there is no jump and no click.
   The canvas keeps `touch-action: none`, and `pointercancel` resets the gesture. The mouse path (drag, wheel, click, hover) goes
   through the same machine with one pointer and behaves as before.
3. **Lines between neighbours.** `regionMapModel.js` now returns `neighbourLinks` beside `links`:
   - `links` (`groupLinks`) is unchanged: the links between different groups, one per unordered pair;
   - `neighbourLinks` holds every pair of display regions in the SAME group that the world links, one per unordered pair, each
     with `neighbour: true`. The endpoints are the real door tiles where the sidecar exits give them (`exitTileOf` and the
     reciprocal exit), else the cell centres. In a group, the layout graph's own links are added too (centre to centre) when no
     sidecar exit names the pair: on the maze world the generic layout's links are what made the group.
   - A pair that sits side by side but is not linked gets no line.
   - Which in-group pairs are drawn is ONE predicate, `neighbourDrawn` (today: all of them, as ruled).
   - `_drawLinks` draws both lists in the existing style (colour by kind, arrowhead, alpha 0.55, warps dashed) under the same
     **Links** box. The paint stats count them apart: `lastPaint.links` (between groups) and `lastPaint.neighbourLinks`.
4. **The legend** is unchanged: its *edge transition* swatch is the yellow `join` colour, which is now what the neighbour lines
   are drawn in.
5. **The tutorial** (`tracker-region-map`, still `in-progress`):
   - the pan/zoom step (`fit-all`) names **+ / −** and pinching;
   - a new step `zoom-buttons` presses **+** then **−**; its `done` is `ctx.sinceStep(canvas.dataset.zoomedAt)` and a painted zoom;
   - the groups step says a yellow line joins each pair of neighbours you walk between, and that **Links** turns them all off.
   The tutorial is now 15 steps. The user guide is regenerated (`generate-tutorial-docs.mjs --write`: no file changed, since
   an in-progress tutorial has no guide page). `docs/json/user/modules/regionMap.md` now describes + / −, pinching, and the
   in-group lines.

## The constants

| constant | value | why |
|---|---|---|
| `ZOOM_BUTTON_NOTCHES` | 3 | "a few wheel notches" |
| `ZOOM_BUTTON_FACTOR` | `exp(3 · 100 · 0.0015)` = **×1.5683** | 3 notches of the wheel's own rate (`WHEEL_ZOOM_RATE` 0.0015 per px of `deltaY`, a notch is 100 px ≈ ×1.16) |
| `ZOOM_BUTTON_PX` | **32 × 32 px** | a tap target over WCAG 2.5.8's 24 px minimum; the rest of the toolbar is not restyled |
| `DRAG_SLOP_PX` | 3 | the mouse's existing drag threshold, now named |

## The counts

Cross-group links are **byte-identical** to the base function on all **211** committed presets (the JSON of every link compared
before and after, and pinned in `regionMapLinks.test.js` against a frozen copy of the base `groupLinks`).

⚠ **The brief's "27" is stale.** At base, `seedling_playthrough` has **55** cross-group links (down 20, up 11, warp 24) and
`seedling_er` **61**. The 27 is the step-3b number, from before placement (A) split the groups 21 → 43 (`placement.md`).

Neighbour lines land on **198 of 211** presets (14,127 lines in all). The presets whose Region Map has groups or that the brief
named ("adjacent" = the two cells are next to each other on the grid; "door ends" = both ends are real door tiles):

| preset | layout | groups | cross-group | neighbour | adjacent | door ends | kinds |
|---|---|---|---|---|---|---|---|
| `seedling_playthrough/AP_14089154938208861744` | hook | 43 | 55 | **83** | 58 | 83 | join 80, warp 1, down 1, up 1 |
| `seedling_er/AP_1` | hook | 43 | 61 | **82** | 58 | 82 | join 80, warp 1, down 1 |
| `seedling_atlas/AP_1` | hook | 3 | 2 | 1 | 1 | 1 | join 1 |
| `seedling_playthrough_maze/AP_1` | generic | 1 | 0 | 670 | 239 | 1 | join 670 |
| `seedling_atlas_maze/AP_1` | generic | 1 | 0 | 10 | 7 | 10 | join 10 |
| `procgen_maze/AP_1` / `AP_2` / `AP_3` | grid_cell | 1 | 0 | 2 / 4 / 11 | all | all | join |
| `procgen_topdown/AP_1` (D0) | grid_cell | 1 | 0 | 8 | 8 | 8 | join 8 |
| `procgen_topdown/AP_7` | grid_cell | 1 | 0 | 296 | 124 | 249 | join 296 |
| `alttp/AP_14089154938208861744` (D0) | generic | 3 | 0 | 297 | 46 | 0 | join 297 |
| `tunic/AP_14089154938208861744` | generic | 9 | 0 | 296 | 93 | 0 | join 296 |

- On Seedling, 25 of the 83 are edge transitions the layout could not place side by side (for example `level_12 ↔ level_95`, one
  diagonal step). Those are exactly the transitions that were invisible before.
- Three in-group Seedling pairs are not `join`, so they draw in their own colour: `level_27 ↔ level_28` (the borderline warp,
  dashed green), `level_48 ↔ level_49` (down, blue), `level_51 ↔ level_53` (up, orange). They are in one group through other
  edge transitions.
- The census script is not committed (a one-off): it builds `buildRegionMapModel` for every `frontend/presets/*/AP_*/` rules file.

## Measured in the app

- **Zoom step** (`region-map-zoom-pinch-links`, procgen_topdown AP_1): Fit all 0.281977 → **+** 0.442228 (×1.5683) → **−** 0.2820.
  Follow unticks on the press.
- **Pinch** (same row, two synthetic `PointerEvent`s, `pointerId` 11 and 12, `pointerType: 'touch'`): 100 → 200 px apart,
  zoom ×**2.0000**, clicks 0 → 0.
- **Neighbour lines** (same row): `lastPaint.neighbourLinks` 8 = the model's 8, `lastPaint.links` 0 = 0; the **Links** box off
  draws neither. On `seedling_playthrough` at Fit all (the shot script, `measure-desktop.json`): **55** cross-group and **83**
  neighbour lines drawn, each equal to the model's; alttp at Fit all: 0 and 297.
- **The phone** (`scripts/dev/shot-region-map-zoom-links.mjs --only=phone`: 390 × 844 px, `isMobile`, `hasTouch`, DPR 3; the
  touches are real input through CDP `Input.dispatchTouchEvent`, so the browser's own pinch-zoom recogniser sees them):

  | after | `visualViewport.scale` | map zoom | clicks | page / panel scroll |
  |---|---|---|---|---|
  | start (Fit all) | 1 | 0.026729 | 0 | 0 / 0 |
  | a two-finger pinch on the canvas, 60 → 180 px | **1** | 0.080186 (×**3.000**) | 0 | 0 / 0 |
  | a one-finger drag on the canvas | **1** | unchanged; the camera moved (4136, 64) → (5134, 1261) | 0 | 0 / 0 |
  | CONTROL: the same pinch on the toolbar | **2.46** | unchanged | 0 | 0 / 0 |

  The control shows the instrument can see a page zoom, so the canvas's 1 is a measurement.

## What a phone user now sees

One finger drags the map; two fingers pinch it, and only the map zooms, never the page. **+** and **−** are 32 px buttons; at
390 px the toolbar wraps and they sit on their own row with *Fit all* ([phone-390-after-pinch.png](zoom-links-shots/phone-390-after-pinch.png)).

⚠ **For the user: the app's MOBILE layout has no Region Map tab.** The mobile layout builds its tabs from the layout preset, and
no preset in `frontend/layout-configs/layout_presets.json` lists `regionMapPanel`. A phone that gets the mobile layout
(auto-detected, or `?layout=mobile`) cannot open the Region Map at all. The measurement above used `?layout=desktop` at 390 px
with the panel lifted to fill the screen. Adding the panel to the mobile layout is not in this slice.

## What reads wrong (for the user)

- **Generic-layout worlds crowd** ([alttp-fit.png](zoom-links-shots/alttp-fit.png)). Ruled acceptable. The hub regions (Light
  World, Dark World) become starbursts of centre-to-centre arrows, and 251 of alttp's 297 lines join cells that are not next
  to each other.
- **Arrowheads on two-way joins.** An edge transition is usually two-way, but the line has one arrowhead, at the end of the
  exit that was read first. On the short neighbour lines across a gutter the 8 px head is a large part of the line
  ([seedling_playthrough-neighbours.png](zoom-links-shots/seedling_playthrough-neighbours.png)). No new style was invented. A
  possible change is no arrowhead on an in-group `join`.
- **Long in-group lines on Seedling.** The 25 non-adjacent edge transitions are long yellow lines across other levels' art
  (for example from `level_12` to `level_95`). That is the point of the ruling, but they do cross art.

## Pictures

`zoom-links-shots/` (by `scripts/dev/shot-region-map-zoom-links.mjs`):

- [seedling_playthrough-neighbours.png](zoom-links-shots/seedling_playthrough-neighbours.png): around the start level, the yellow
  neighbour lines;
- [seedling_playthrough-fit.png](zoom-links-shots/seedling_playthrough-fit.png): Fit all, every link;
- [toolbar.png](zoom-links-shots/toolbar.png): **−** and **+** beside *Fit all*;
- [alttp-fit.png](zoom-links-shots/alttp-fit.png): the generic-layout crowding;
- [phone-390-after-pinch.png](zoom-links-shots/phone-390-after-pinch.png): 390 px, after the pinch;
- `measure-desktop.json`, `measure-phone.json`: the numbers above.

## Proof

- **Vitest** (bounded, ⚖ 52; `regionMap/`, `tutorials/`, `quickLaunch/`, `testBatches.test.js`, `testWebgpu.test.js`,
  `docsBase.test.js`): 21 files, 326 tests, all passing at `2ebee735c9`.
  - `pinch.test.js`: the zoom ratio, the midpoint pan (the world point between the fingers stays put), the zoom limits, the
    two → one hand-off with no jump, a pinch is never a click (either lift order, and with no movement), a third pointer ignored.
  - `regionMapLinks.test.js`: cross-group output byte-identical to the frozen base function on six presets; neighbour pairs drawn
    once, in one group, never also cross-group; every in-group layout-graph pair drawn; on a hand-made layout, the linked pair
    gets one door-to-door line, the unlinked side-by-side pair gets none.
- **In-app row** `region-map-zoom-pinch-links`: category *Region Map*, batch **fast**.
- **Tutorial walk** `tutorial-walk-tracker-region-map`: passed locally twice (38.3 s, 36.8 s).
- **Mutant:** the `zoom-buttons` `done` pointed at `canvas.region-map-canvas-MUTANT` gives *"tracker-region-map — REGRESSION:
  it fails at step 5 of 15 (zoom-buttons): its done check never held; every step worked"*.
- **Pins touched:** none moved. No existing pin counts links by number (the 3b row asserted `> 0` and "different groups only",
  both still true of `links`). The 27 lives only in the step-3b report's prose.
- **CI at the code tip `2ebee735c9`** (every run's `head_sha` is that SHA; all `success`):
  - JavaScript Unit Tests 45069979470: suite 1413 files / **29733 passed**, 0 failed, 0 skipped; slow battery 438/438. Base
    `ba36761859`: 1411 / 29701. So JSUT **+2 files, +32 tests (+T), 0 new failures (+F = 0)**;
  - unittests 45069979472;
  - TT (`test-templates.yml` dispatch) 45069990242, every job green: the ALTTP spoiler and regression, and the fast,
    fast-bundled, playback-bot, seedling-js, seedling-js-solver, seedling-wasm and apworld batches;
  - `test-substrates-manual.yml -f batch=tutorials-tracker` 45069993472;
  - `test-substrates-repeat.yml -f test=tutorial-walk-tracker-region-map -f repeat=8` 45069996293: **Rate: 8/8 passed**.
- **Headroom** (`check-batch-headroom.js`, all under the 600 s budget):

  | batch | base `9e8172bf58` | main `ba36761859` | tip `2ebee735c9` |
  |---|---|---|---|
  | fast | 331.8 s (55%) | 324.0 s (54%) | **314.0 s (52%)** |
  | fast (bundled) | 324.8 s (54%) | 334.1 s (56%) | **321.2 s (54%)** |
  | tutorials-tracker | 67.6 s (11%) | (no run) | **62.5 s (10%)** |

- **Closure:** `seedlingDerivedRuleTable.js --print-engine-closure`: 42 files, engineMd5 `74ae60f575531492ed9eaec1839e1fe3`.
  Closure ∩ diff = ∅, so the md5 is the same at base and tip. No `train_only` is owed. The diff has 0 gitlinks.
- **Overlap:** `git merge-tree` with `origin/region-view-dedup` (`2679997c93`) is clean.

## For the READY call

The zoom and pinch work on touch and the edge transitions now draw; mark it READY once the user has seen
[phone-390-after-pinch.png](zoom-links-shots/phone-390-after-pinch.png), knowing the mobile layout has no Region Map tab.
