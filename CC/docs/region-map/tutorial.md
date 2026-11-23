# Region Map: the tutorial (`tracker-region-map`)

Session `region-map-tutorial` (Opus), 2026-11-21/22 (Pacific; the rulings below are UTC).
- **Planner:** archipelago-cc-23. **Reviewer and landing queue:** seedling-js-planning-22 (js-22).
- **Branch:** `region-map-tutorial`, cut `--with-wasm` at base `f96d6b66254cd8c2dd08323a489d5d1f07525600`.
- **Code tip (gated):** `2c92a3ac3b0e9b22ac9be3131fb4f4f874043aca`. This report and `tutorial-shots/` are the last commit.

## ⚖ Rulings this slice carries (session 84c8ab35, archipelago-cc-23)

- 2026-11-16, parked item 5: *"Region Map tutorial: yes, after clicks work."*
- 2026-11-17T18:08:42Z, the order: *"Yes, go ahead (Recommended)"* (… CA-S5 → Region Map tutorial → duplication).
- **2026-11-22T01:26:52Z, the world: *"Seedling playthrough (Recommended)"*.** The option read: *"Shows what the Region Map is for:
  the real Seedling map, item squares on their tiles, the strip, centring the Graph, Follow. It runs in the Seedling tutorial
  batch. It loads only the rules, with no Flash game running, so it skips 'Teleport in Flash' and just mentions that the
  option exists."*
- **2026-11-22T02:05:41Z, the batch: *"Tracker batch (Recommended)"*.** This deviates from the option text's "Seedling tutorial
  batch". It was put to the user with the measurement below: the walk needs no WebGPU.
- 2026-10-10, the coverage rule (`coverage.js`): every panel appears in some tutorial, and `NOT_COVERED_YET` may only shrink.
- Planner decisions (archipelago-cc-23), not user rulings: G1–G3 licensed into the slice (the step-4 ruling to copy the
  Graph's click behaviour onto the Map); G4 licensed as a CA-S4 defect fix.

## What landed

| Commit | What |
|---|---|
| `15464766c8` | G1–G3: the Map's Go-to picker, the squares readout, the Graph's centre readout; vitest; the in-app row `region-map-go-to-equals-canvas-click` |
| `8a81368e52` | The tutorial, its walk row and row hook, coverage, the generated tutorials list |
| `1debb03337` | Docs: the Region Map user page (Go to, a link to the tutorial) and developer page |
| `4eeee0991d` | The walk moves to `tutorials-tracker` (the 02:05:41Z ruling) |
| `e9ed910307` | G4: a centre asked of a hidden map panel is applied when it is shown (both maps), vitest, the step's `done` tightened |
| `2c92a3ac3b` | Docs for G4 (`regionView/README.md`, the developer page) |
| this commit | This report and `tutorial-shots/` |

## The tutorial

`frontend/modules/tutorials/content/tracker/regionMap.js`, `TRACKER_REGION_MAP`: id **`tracker-region-map`**, *"Tracking: the
Region Map"*, track **tracker**, status **in-progress**, `firstFailingStep: null`, `doc: null`.

- It loads **seedling_playthrough seed 1** through the Seedling content's own `loadPlaythrough` / `PLAYTHROUGH`. They are now
  exported from `seedling/seedling.js`, not copied.
- It starts **no Flash game**. *Teleport there in Flash* appears in prose only: an option in the strip, off, that needs a
  running Seedling game.
- A step reaches the Map's cells and squares through the Map's **Go to** picker (G1). A step cannot click a canvas.

### The steps, and what each `done` measures

| # | Step | Action | `done` measures (DOM only) |
|---|---|---|---|
| 1 | `load` | `ctx.loadPreset('seedling_playthrough', 1)` | a rules load since the step began, and the preset is the loaded one |
| 2 | `open-map` | activate the Map | the Map tab showing, its canvas present, and the info line says `layout: hook` (cells from the atlas, not the generic layout) |
| 3 | `squares` | (none) | `canvas[data-squares] > 0` (G2b: squares painted) AND the *Not on map* line hidden (every location placed) |
| 4 | `fit-all` | click **Fit all** | the Follow box unticked (a manual view move turns Follow off) |
| 5 | `groups` | (none) | the Links box ticked, the legend's *edge transition* and *warp* swatches present, and the info line counts `N group(s)` |
| 6 | `follow` | tick **Follow player** (if unticked) | the Follow box ticked |
| 7 | `click-strip` | (none) | the strip's summary is exactly *On click: extend path · Regions — location: check* |
| 8 | `open-click-strip` | ▸ | the strip `data-expanded="true"`, and the *Centre the Region Graph on it* and *Teleport there in Flash* boxes both present and unticked |
| 9 | `open-go-to` | unfold **Go to** | `details.region-map-pick` open |
| 10 | `click-region` | Go to → region `level_2` | the picker status *Went to region level_2.* AND the Regions panel's last block is `level_2` (the path end) |
| 11 | `click-location` | Go to → location `Level 011 - Chest` | the snapshot lists it checked |
| 12 | `tick-centre-graph` | tick *Centre the Region Graph on it* | that box ticked |
| 13 | `centre-graph` | activate the Graph; Go to → `level_4`; activate the Graph | the Graph tab showing AND its root's `data-centred-on="level_4"` with `data-centred-at` since the step began (G3; written when the camera moves, G4) |
| 14 | `put-back` | untick centre; fold the strip and Go to; tick Follow | centre unticked, strip folded with the default summary, Go to folded, Follow ticked |

The strip prose says the Map's settings began as a copy of the Graph's and are now its own. *Placement terms* are main's: edge
transition, group, down / up, warp (door / teleporter).

### The walk row: `tutorial-walk-tracker-region-map`

- **Batch `tutorials-tracker`** (category `Tutorial walks: tracker`, the track's default), beside
  `tutorial-walk-tracker-region-graph`.
- **Its row hook** (`tutorialTests.js` `WALK_HOOKS['tracker-region-map']`) pins the start state: the Map's `clickActions` at the
  defaults (session-only, through the row's `ctx.setSetting`) and Follow on, in the setting and on any live Map. It
  subscribes `tc.eventBus` to `regionView:regionClicked` / `regionView:locationClicked`. After a complete walk it asserts:
  - the Map published `regionClicked {panelId:'regionMap'}` for `level_2` and for `level_4`;
  - it published `locationClicked {panelId:'regionMap'}` for `Level 011 - Chest`;
  - the Map's `clickActions` are back at the defaults (with every panel action's first value);
  - Follow is on, in the panel and its box.
  Its overrides are restored however the walk ends.

## Track and batch, and why

- **Track: tracker.** The Region Map is a tracking panel (*Analysis Panels*), the Region Graph's sibling. The catalogue's
  tracker heading holds one tutorial per tracker panel, and the guide list groups it beside *Tracking: the Region Graph*. The
  Seedling track is about playing the original game on wasm (its header says its walks need WebGPU). This tutorial uses
  Seedling's world but starts no game, so it would mislead there. It lives in its own file, `tracker/regionMap.js`, so
  `tracker/panels.js`'s "each loads A Link to the Past" stays true.
- **Batch: `tutorials-tracker`** (⚖ 02:05:41Z). Measured locally with `--test`, the same code, before the move:
  `tutorials-seedling` (WebGPU browser) **PASSED 37.0 s**; `tutorials-tracker` (`--disable-gpu`) **PASSED 35.9 s**.

## App changes (licensed)

| | What | Where |
|---|---|---|
| **G1** | The Map's **Go to** picker: folded `details.region-map-pick` in the toolbar, a region box and a location box. It lists the drawn (not hidden) cells and their visible locations. Choosing calls the panel's new `clickCell(frame, square)` (the pointer-up path: select, then `clickAt` → `runRegionMapClick`), then `centreOnRegion` | `regionMap/regionMapPicker.js:33` `buildRegionMapPicker`, `:55` `pickableCells`, `:65` `pickableLocations`, `:92` `setupRegionMapPicker`; `regionMapUI.js:204-206` (mounted), `:271` (pointer-up → `clickCell`), `:650` `clickCell` |
| **G2b** | `canvas.dataset.squares`: the number of squares the last paint drew | `regionMapUI.js:717` (no model: `0`), `:760` |
| **G3** | The Graph root's `data-centred-on` / `data-centred-at` after `regionGraph.centre` centres it | `regionGraph/regionGraphCentreAction.js:38` |
| **G4** | A centre asked of a **hidden** map panel (tab not active, 0×0) is applied when the panel is shown. The last one asked wins, a rebuild that no longer draws it drops it, and neither action shows a tab | Graph: `regionGraphCentreAction.js:27-56` (`centreGraphOn` keeps `pendingCentreOn`; `applyPendingCentre`; `dropStalePendingCentre`), `regionGraphUI.js:1106` (`onPanelShow` centres in place of `fit(30)` when one is pending), `graphDataManager.js:519`. Map: `regionMapUI.js:543` (`centreOnRegion` keeps `_pendingCentre`), `:479` (`_resize` applies it), `:403` (`_rebuild` drops it), `:552` `_frameFor` |

**G4: what the screenshots exposed, measured** (seedling_playthrough; Map and Graph share a stack, the default when the Map is
opened; Go to → `level_4` with *Centre the Region Graph on it* ticked):

| | before | after |
|---|---|---|
| Graph, at the click (tab hidden) | cy 0×0, animated anyway; readout written | cy 0×0, nothing animated, `pendingCentreOn = level_4`, no readout |
| Graph, its tab shown | `onPanelShow` → `fit(30)`: zoom **0.137**, `level_4` at (267, 384) of 594×1048, **not centred** ([before](tutorial-shots/g4-before-graph-fits-on-show.png)) | zoom **1.000**, `level_4` at **(297, 524)**, the exact centre of 594×1048 ([after](tutorial-shots/3-graph-centred.png)) |
| Map, `centreOnRegion('level_4')` while hidden (vp 0×0) | the focus camera got zoom **0.000**; shown, it drew nothing | `_pendingCentre`; shown: camera on `level_4` (1008, 2224), zoom **0.470** ([after](tutorial-shots/g4-after-map-centred-while-hidden.png)) |

The Map "before" number is from the probe (`centreOnRegion → true … zoom 0.000`, then shown at `vp 602x927 … zoom 0.000`); its
picture was not kept.

**Proof for G1–G4:**
- **vitest:** `regionMap/regionMapPicker.test.js` (4: the lists; a choice → `clickCell` with the cell's frame and `{location}`;
  unknown, hidden and placeholder names click nothing), `regionGraph/regionGraphCentreAction.test.js` (7: the readout; G4
  pending / applied / dropped / cleared), `regionMap/regionMapPendingCentre.test.js` (3: the real prototype methods).
- **In-app `region-map-go-to-equals-canvas-click`** (category Region Map, fast batch). The same target clicked on the canvas
  and chosen in Go to give the same click record (`lastClick` but its counter), the same bus record (`regionView:*Clicked`,
  `ui:navigateToRegion`) and the same path end. It checks this under the default actions, then with the master switch off for
  a region and a square (the events, no action run). Locally PASSED 7.1 s and 7.4 s (unbundled).
- **D0** (`scripts/dev/region-graph-class-snapshot.mjs --port=8141`): base vs tip, the base being the tip with the three base
  Region Graph files (`regionGraphCentreAction.js`, `regionGraphUI.js`, `graphDataManager.js`) checked out. `diff -rq` →
  **byte-identical** (seedling_playthrough, alttp, procgen_topdown × S1–S7). The committed `step2-dumps/before/` is stale
  against today's main (later slices changed the graph), so it is not the reference.
- `test_control_buttons` and `test_region_graph_panel_activation` (on `onPanelShow`'s path) passed locally. CI ×8 below.

## Screenshots (`tutorial-shots/`)

- [1-map.png](tutorial-shots/1-map.png): the map step, seedling_playthrough at the start (Follow on, `level_0` outlined white,
  its group beside it, down links blue, warps dashed green, squares on their tiles).
- [2-strip-unfolded.png](tutorial-shots/2-strip-unfolded.png): the strip unfolded (the Map's actions, *Centre the Region
  Graph on it* and both Teleports off) and Go to unfolded.
- [3-graph-centred.png](tutorial-shots/3-graph-centred.png): the Graph centred on `level_4` after a Map Go-to with the centre
  option on (after G4).
- [g4-before-graph-fits-on-show.png](tutorial-shots/g4-before-graph-fits-on-show.png): the same before G4 (the Graph fits).
- [g4-after-map-centred-while-hidden.png](tutorial-shots/g4-after-map-centred-while-hidden.png): the Map shown after a
  centre asked while it was hidden (after G4).

## Proof

All at the code tip `2c92a3ac3b` (headSha read from each run) unless named otherwise.

**Local**
- `tutorials.test.js` green (shape, coverage, the generated-doc pin). `generate-tutorial-docs.mjs --check` → *OK: 24 generated
  tutorial doc(s) current*.
- **Bounded vitest** (⚖ 52), over `tutorials/`, `regionMap/`, `regionGraph/`, `regionView/`, `quickLaunch/`, `tests/` and
  `scripts/test/{compare-runs,inAppSummary,testWebgpu}.test.js`, `scripts/procgen/ciDocsOnly.test.js` (every test that
  imports a touched file, found with `git grep -a -l`): **603 passed, 0 failed**.
- **The walk with `--test`:** PASSED twice before the batch move (41.9 s, 37.0 s), 35.9 s in the tracker browser, and 44.5 s
  after G4.
- **Closure ∩ diff = ∅.** `seedlingDerivedRuleTable.js --print-engine-closure`: 42 closure files, 19 diff files, intersection
  empty. **engineMd5 base = tip = `74ae60f575531492ed9eaec1839e1fe3`**. The base was measured with the base versions of the 19
  files swapped in, then restored.
- **0 gitlinks** in the diff.
- **Overlap:** `git merge-tree` against lab-apworld-door-map `9c7d7223ad` (train 189, which edits
  `docs/json/developer/modules/regionMap.md`) is clean. LOOPS-I1/I2 (content-4) touch none of this slice's files.

**CI**
| Run | What | Result |
|---|---|---|
| 44976760630 (TT, dispatched) | Test ALTTP Spoiler & Frontend Regression + every on-push substrate batch | **success**, job by job: ALTTP/regression, fast, fast (bundled boot), seedling-js, seedling-js-solver, seedling-wasm, playback-bot, apworld, on-push resolve |
| 44976763038 | `test-substrates-manual.yml -f batch=tutorials-tracker` | **success**; `[PROGRESS 4/9] tutorial-walk-tracker-region-map PASSED 15.7s` |
| 44976764851 | `test-substrates-manual.yml -f batch=tutorials` (shared tutorial content touched) | **success** |
| 44976766771 | `test-substrates-repeat.yml -f test=tutorial-walk-tracker-region-map -f repeat=8` | **Rate: 8/8 passed** |
| 44976768975 | repeat ×8 `test_control_buttons` (on `onPanelShow`'s path) | **Rate: 8/8 passed** |
| 44976771994 | repeat ×8 `test_region_graph_panel_activation` | **Rate: 8/8 passed** |
| 44976716956 | unittests (push) | **success** (its "Python tests needed?" gate: no Python changed, the legs skipped) |
| 44976716892 | JavaScript Unit Tests (push) | **success**: suite 1407/29505 (29505 passed, 0 failed), slow 36/438. Base `f96d6b6625` (run 44963849314): 1404/29490. **JSUT +3 F / +15 T**: the three new vitest files (4 + 7 + 3 = 14 rows), plus 1 elsewhere (not itemised; the tutorial checks iterate the roster) |

**The walk's timing** (CI, run 44976763038): `[tutorial-walk-timing] tracker-region-map: load 3.4s, open-map 1.1s, squares
0.1s, fit-all 0.3s, groups 0.1s, follow 0.2s, click-strip 0.1s, open-click-strip 0.4s, open-go-to 0.4s, click-region 1.0s,
click-location 0.9s, tick-centre-graph 0.2s, centre-graph 3.0s, put-back 1.4s`.

**Headroom** (`check-batch-headroom.js`):
| Batch | before | after (tip) |
|---|---|---|
| tutorials-tracker | nightly main `84d9ccd29d`: 30.4 s of 600 (5 %); **same-hour control** at base `f96d6b6625` (run 44977005552): **37.5 s (6 %)** | **56.8 s (9 %)**: +19.3 s over the control (the walk is 15.7 s) |
| tutorials | nightly main: 170.9 s (28 %) | 160.5 s (27 %) |
| fast | main `f96d6b6625` (run 44971248463): 318.5 s (53 %) | 320.9 s (53 %) |
| fast (bundled boot) | main `f96d6b6625`: 312.6 s (52 %) | 322.7 s (54 %); `region-map-go-to-equals-canvas-click` **5.9 s** bundled (≤ 8 s) |
| playback-bot | — (no row added) | 120.9 s (20 %); every *Region Map: Seedling* row green |

The first tutorials-tracker comparison, against the nightly, read +26.4 s and tripped the brief's +20 s rule (STOP 3). Per
row, the three rows that run BEFORE the new walk were already +4.3 s slower, so the extra time was the runner. The same-hour
control at base settles it at +19.3 s.

## What the walk measured (for the READY call)

- **Every step's `done` held**, in both browsers. Local runs, all PASSED:
  - in `tutorials-seedling`: 41.9 s, 37.0 s;
  - in `tutorials-tracker`: 35.9 s, and 44.5 s after G4 (alongside three other rows).
  - CI ×8 is below.
- **What it does NOT measure:**
  - **Pixels.** "The real map" is the info line's `layout: hook`. The art itself is the Region Map's own rows
    (`region-map-seedling-paints`).
  - **Pan by drag and wheel zoom:** prose. The step presses **Fit all**, which moves the view the same way and turns Follow off.
  - **Follow's easing onto the player:** the step reads the box. That the camera follows is `region-map-follow-player`.
  - **That a square sits on its own tile:** the squares count and *Not on map* hidden. Placement is the Map's vitest and rows.
  - **Teleport in Flash:** prose only (⚖ the world ruling). The done reads only that its box is present and unticked.
- **On CI:** 8/8 in the repeat (run 44976766771), and green in its batch (15.7 s).
- **The mutant** (one selector broken: `pickStatus` → `.region-map-pick-status-MUTANT`):
  `tracker-region-map — REGRESSION: it fails at step 10 of 14 (click-region): its done check never held; every step worked`.
  So `firstFailingStep` is reported as `click-region`, the step that reads it.
- A person playing it sees the Regions panel come forward after each Go to (`regions.open`, on by default). The next step
  brings the Map back.

## Gaps stopped on

1. **G1–G3** (STOP 1): three things a step could not do or read. A step cannot click the Map's canvas: the executor presses a
   canvas with mouse events at its centre, and the Map listens to pointer events. It cannot read the squares, and it cannot
   read where the Graph is centred. Licensed and closed as above.
2. **G4** (STOP 2): the screenshots showed *Centre the Region Graph on it* did nothing visible whenever the Graph's tab was
   hidden, and the Map's own centre action left a zoom-0 camera. The walk's step passed on a readout that did not match the
   screen. Licensed as a CA-S4 defect fix. The step now also requires the Graph tab showing, and the readout is written only
   when the camera moves.
3. **Headroom** (STOP 3): `tutorials-tracker` read +26.4 s against the nightly. The per-row attribution and a same-hour control
   at base (+19.3 s) cleared it; the planner accepted.

## Docs

- `docs/json/user/modules/regionMap.md`: a **Tutorial** line (`?tutorial=tracker-region-map`, link to the Tutorial panel's
  page) and a **Go to** paragraph under *Clicking*.
- `docs/json/developer/modules/regionMap.md`: the `regionMapPicker.js` row, the click path through `clickCell`, the DOM
  readouts, the G4 paragraph, the new vitest and in-app rows.
- `frontend/modules/regionView/README.md`: the two centre actions' rows say what a hidden panel does (G4).
- `docs/json/user/modules/tutorials.md`: regenerated (`generate-tutorial-docs.mjs --write`; `--check` → *OK: 24 generated
  tutorial doc(s) current*). It gains one line under **In progress**.
- **No guide `docs/json/user/tutorials/tracker-region-map.md`.** The generator writes a guide only for a ready or terminal
  tutorial. It will be written when the user marks this one READY (planner confirmed).
- **Doc-census pins moved:** none. `tutorials.test.js` (the generated-doc pin) regenerates in memory and is green. No procgen
  doc was edited (no link census).

## Notes for the duplication cleanup (Locations / Exits / commonUI)

- **The two pickers are twins.** `regionMap/regionMapPicker.js` ↔ `regionGraph/nodePicker.js`:
  - `buildRegionMapPicker` ≈ `pickerHTML` (class prefix `region-map-pick` vs `rg-pick`; "cell" vs "node"; per-instance
    datalist ids);
  - `fillList` = `fillList`, except the document it creates in;
  - `setupRegionMapPicker` ≈ `setupNodePicker`: the same refresh-on-toggle/focus, the same change handlers and status
    wording. The lists are read from the Map's model, not Cytoscape. The click is the panel's own `clickCell`, not the
    interaction manager.
  - A shared `regionView/goToPicker.js` taking `{ prefix, regions(), locations(), goRegion, goLocation }` would serve both.
    It was not done here, to keep the Graph's DOM untouched.
- **Both maps now have a "pending centre"** (G4) of the same shape: Graph `pendingCentreOn`, Map `_pendingCentre`. Any shared
  map-panel base should carry one.
- **The Regions panel's path view** is what a click step reads (`.region-block[data-region]`, the last block = the path end).
  The Locations and Exits panels were not needed.
- **The tutorial row hook** (`WALK_HOOKS`) is a new per-tutorial seam in `tutorialTests.js`. A later tutorial that needs bus
  assertions can use it rather than a bespoke row.
