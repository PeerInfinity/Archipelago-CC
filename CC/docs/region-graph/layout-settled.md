# Region Graph: "the layout has finished" means the nodes have stopped

Slice `region-graph-layout-settled` (Opus build session; planner archipelago-cc-23, reviewer and landing queue js-23).

## 1. The ruling

The planner put it to the user (session `84c8ab35`, verified by js-23 at **2026-11-26T21:26:22.046Z**): *"when you switch
to the Merged view, the graph rearranges itself with about a second of animation. The nodes keep moving for that second
even after the layout reports it has finished… **Optional fix:** make the animation actually finish before the graph
reports it's done."* The user: **"Yes please."**

What was asked for: "the layout has finished" must mean the nodes have stopped moving. The animation stays as it is
(`animate: true`, 1000 ms, same look).

## 2. The cause (it was not the animation)

**Cytoscape's `layoutstop` is already the last move of its own run, for every layout the panel uses** (read from the
vendored `frontend/libs/cytoscape/cytoscape.min.js`, not edited):

- `layoutPositions` (preset, fcose, breadthfirst, grid, circle, concentric, and so Direction-aware, procgen grid and
  hierarchical, which are presets) plays one animation per node plus one fit animation, then emits `layoutstop` from
  `Promise.all(animations).then(…)`. Without animation it sets the positions and emits it synchronously.
- cose with `animate: true` moves the nodes live, a few iterations per frame. When it is done it writes the final
  positions, fits, and then emits `layoutstop`.

**The defect was the panel's handling of `layoutstop`.** `graphInteractionManager.js` had a cy-wide
`cy.on('layoutstop', …)` that started a blind `setTimeout(…, 1050)` ("wait for the 1000 ms animation"). When the timer
fired it saved positions, re-seated the location nodes, placed the player marker, cleared `isLayoutRunning` and showed
"Layout complete". There were three problems:

1. **Any `layoutstop` started the timer**, including one from a layout that a rebuild had just stopped.
2. **A stopped cose emits `layoutstop` twice.** It emits once from `stop()`, and then its loop runs one more frame, in
   which it writes its own positions, fits the view (a stray viewport jump) and emits a second `layoutstop`.
3. **The generation guard was bumped before the old layout was stopped** (`graphDataManager.js`:
   `layoutGeneration++` and then `currentLayout.stop()`), so the stale stops captured the *new* generation and passed
   the guard.

The result: after a switch that replaces a running layout (a `subRegionView` switch while the graph is still laying
out, which is what the merged row does when it runs alone), the stale stop's timer showed **"Layout complete" and
cleared `isLayoutRunning` while the new layout was still moving**. A reader that counted `layoutstop`s (the in-app row's
`layoutWatch`) read "stopped" from the stale second stop, 0.5–1 s before the new layout ended. That is the "nodes keep
moving ~1 s after layoutstop" that direction-layout measured (its §10b), and the reason its row needed a
"steady over 3 polls" wait. On a layout that nothing replaced, "Layout complete" arrived **1050 ms after** the nodes had
stopped.

## 3. The fix: one place, `frontend/modules/regionGraph/layoutRun.js`

- **`startLayout(ui, options, { beforeSettle })`**: every layout the panel runs starts here: `runLayout` (cose,
  hierarchical, procgen grid), `runDirectionLayout`, and the layout editor's three apply paths. It supersedes a running
  run first, takes a run token, and listens on **that layout's own** `layoutstop` (`layout.one`, not cy-wide).
- **A run settles once**, on its own `layoutstop` while its token is current. Settling calls `ui.onLayoutSettled`
  (save positions, re-seat location nodes, "Layout complete", first-load player placement), clears
  `ui.isLayoutRunning`, emits the cy event **`rg-layoutsettled`**, and resolves **`whenLayoutSettled(ui)`**. There is no
  timer.
- **`supersedeLayout(ui)`** (the rebuild, and any new run) invalidates the token *before* `stop()`, so a superseded run
  never settles. Before stopping, it empties that layout's `options.eles` and drops its `fit`, so the extra frame a
  stopped cose still runs writes nothing and fits nothing. Waiters on a superseded run resolve when the run that
  replaced it settles, or right away when nothing replaced it (a rebuild that just fits saved positions).
- **`layoutRunOf(cy)`** gives a reader that holds only the cy (the in-app rows) the same state.

**Why this and not "make `layoutstop` last":** `layoutstop` already is last for its own run. What was missing was
telling *which* run a `layoutstop` belongs to, and a single place that every layout goes through.

## 4. The readers

| Reader | What it waited on | What it assumed | Now |
|---|---|---|---|
| `graphInteractionManager` cy-wide `layoutstop` → `setTimeout(1050)` | any `layoutstop` | the animation still runs 1 s after it | **removed**; the same work is `onLayoutSettled`, run by `layoutRun.js` on the run's own stop |
| `graphDataManager` rebuild | `layoutGeneration++`, then `stop()` | the bump drops stale timers | `supersedeLayout(ui)` (token invalidated before `stop()`; cose's extra frame neutered) |
| `layoutControlsManager.runLayout` guard | `isLayoutRunning` | true until the layout really ends | unchanged guard; the flag is now true exactly from start to settle |
| `runDirectionLayout` player re-seat | its layout's `layoutstop` (`one`) | — | `beforeSettle` of `startLayout` |
| layout editor (`applyLayoutFromJson`, hierarchical, procgen grid) | its own `isLayoutRunning`, never cleared | — | `startLayout(regionGraphUI, …)`; the dead flag is removed |
| `navigationManager` player positioning | `isLayoutRunning` | defer while a layout runs | unchanged (the flag is now true to the settle) |
| `nodeOverlayManager` shrink (after the pre-size) | cy-wide `layoutstop` | the run's end | **`rg-layoutsettled`**: a superseded stop no longer shrinks the nodes the next run pre-sized while it moves |
| `groupBadgeLayer` re-place | `viewport resize layoutstop` | — | not touched (badge-resize owns the badge layer); a re-place on a stale stop is harmless |
| in-app `layoutWatch` (merged, map, collapsible steps) | counted `layoutstart` / `layoutstop` from just before a switch | the last stop is the end | **`layoutRunOf(cy).running`**, the settle signal |
| in-app `layoutSettled` (`test_control_buttons`, `test_node_selection`) | positions unchanged over 300 ms | — | the settle signal |
| in-app `test_control_buttons` | status "Layout complete" | — | unchanged; the status is now set at the settle |
| in-app merged row: map look "steady over 3 polls" (direction-layout §10b) | zoom / pan / boxes / squares the same over 3 polls 50 ms apart | — | **removed**: the settle, then 3 animation frames (Cytoscape renders, the map look paints), then no paint pending and every square on its node |
| in-app merged row: Direction-aware restore | `layoutGeneration += 1; isLayoutRunning = false` to drop the timer's save | — | removed (`animate: false` settles inside the call; the row restores the store afterwards) |
| tutorials / walks / feature checks | — | — | none reads "Layout complete", `layoutstop` or `isLayoutRunning` (`grep -a` over `frontend/modules/tutorials/`, `docs/json/user/tutorials/`) |

## 5. Motion after "finished", per layout: before / after

Probe: `CC/docs/region-graph/layout-settled-probe.mjs` (Playwright, seedling_atlas, 1400×900). For each marker it
samples a signature synchronously (every non-location, non-player node's rendered box, plus zoom and pan) and compares
it with every animation frame over the next 2.8 s. "Before" is `b3376a2f61` (this slice's base); "after" is this
slice's fix. Two reps each; the table gives frames that changed / the last change after the marker.

| case | before ES: last `layoutstop` | before ES: "Layout complete" | after ES: settle = "Layout complete" | before bundled: last `layoutstop` | before bundled: "Layout complete" | after bundled: settle |
|---|---|---|---|---|---|---|
| view switch → merged (cose) | 0 f | **23 f / +726 ms; 26 f / +1167 ms** (fired mid-motion, 2×) | 0 f, 0 f | 0 f | **44 f / +1476 ms** (2×); 0 f (3×) | 0 f, 0 f |
| Re-layout (cose) | 0 f | 0 f, +1050 ms late | 0 f | 0 f | 0 f, +1050 ms late | 0 f |
| fcose | 0 f | 0 f, +1051 late | 0 f | 0 f | 0 f, +1051 late | 0 f |
| hierarchical (preset) | 0 f | 0 f, +1051 late | 0 f | 0 f | 0 f, +1051 late | 0 f |
| grid | 0 f | 0 f, +1051 late | 0 f | 0 f | 0 f, +1051 late | 0 f |
| Direction-aware (preset) | 0 f | 0 f, +1051 late | 0 f | 0 f | 0 f, +1051 late | 0 f |
| cose (editor) | 0 f | 0 f, +1051 late | 0 f | 0 f | 0 f, +1051 late | 0 f |
| superseded (Re-layout, view switch 100 ms later) | **104 f / +2047, +1890 ms** after the 3rd stop | 0 f (2–3×) | 0 f, 0 f | **105 f / +2075, +2029 ms** | 0 f (2×) | 0 f, 0 f |

- **After: 0 frames moved after the settle, for every layout and in every rep, on both boots.** The settle comes once
  per run ("settled: 1×" in every row, even where 3–4 `layoutstop`s fired), and "Layout complete" is set in the same
  task.
- Before, "Layout complete" appeared 2–3 times per switch (once per stale stop), and on the merged switch it fired
  while the nodes were still moving. In the superseded case the motion ran on after the last `layoutstop` until the end
  of the 2.8 s window.
- The **player marker** is outside the signature. After the first settle it is placed and then re-placed by path data
  as game state arrives (it is added at a computed spot and is not animated). That is game state, not layout. The same
  happened before, 1050 ms later.
- Superseded-cose extra frame, ES: before, the stale stop was followed by a viewport jump on the next frame (zoom
  0.887 → 0.796, pan (−17,140) → (8,169)); after, that frame writes nothing.
- **Unit level** (`layoutRun.test.js`, the vendored Cytoscape headless with styles, so animations run): an animated
  preset, a non-animated preset and a live cose each settle exactly once, after their last `position` / `viewport`
  event. A superseded run never settles and its waiters resolve with the run that replaced it. A superseded cose's extra
  frame writes no position or fit after the next run's settle. A supersede with no next run releases the waiters
  without a settle. A throwing settle still clears the run. 7/7, and 6 consecutive local runs were green.
- **In-app** (the merged row): right after the merged switch settles, it traces every node's rendered box over 10
  animation frames: **"changed at frames []"** locally on ES and on bundled, and in CI (§6).

## 6. Gates

- Base: cut from direction-layout's re-gated final head `b3376a2f61`. Merged badge-resize's final `c120ee594c`
  (train 224) at `12f5d2b289`, then origin/main `6c9374b8da` at **`1a9d906c16`** (the gate SHA). The report commit
  after it is docs-only.
- **0 gitlinks** in this slice. The only gitlink the merges moved, `frontend/modules/shared` 71b77de → ecdda89, is
  main's (AN-TIME-2 `44945665dd`, an ancestor of origin/main).
- **Closure ∩ diff = ∅**: 0 of the 42 files of `node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`
  are in `git diff --name-only origin/main...HEAD`. **engineMd5 `74ae60f575531492ed9eaec1839e1fe3`** at the tip = base (unchanged across both merges).
- **Bounded vitest** (⚖ 52), `--maxWorkers=3`: regionGraph/ + regionView/ + tutorials/ + every test importing a touched
  file, 41 files / 713 tests at `d1f8262c79`; regionGraph/ + regionView/ + tutorials/ + actionNodes/, 42 / 639 at
  `12f5d2b289`; regionGraph/ + regionView/ + tutorials/, 28 / 410 at `1a9d906c16`. All green.
- Local in-app, at `d1f8262c79`: all 15 Region Graph rows + `tutorial-walk-tracker-region-graph`, **16/16 on ES and
  16/16 on bundled**.

CI at the **exact** gate SHA `1a9d906c16f56f618ec246bdc1637df4e4aafcb8` (headSha of every run below):

| Gate | Run | Result |
|---|---|---|
| JSUT (push) | 45907342369 | success: suite **1456 files / 30416 passed, 0 failed**; slow battery 42 / 470 |
| JSUT +F / +T | vs main `6c9374b8da` (45896948152: 1454 / 30373) | **+0 F, +43 T, +2 files**; vs badge-resize's code head `fbfbb6de4e` (1454 / 30383): **+0 F, +33 T**. This slice's own new file: `layoutRun.test.js` (7 tests); the rest is the union of the branches merged in (direction-layout, badge-resize) |
| unittests (push) | 45907342415 | success |
| type check, Analyze modified files (push) | 45907342349, 45907342295 | success |
| TT (`test-templates.yml`, dispatch) | 45907346071 | success, 9 / 9 jobs: fast (143/143), fast bundled (143/143), seedling-js, seedling-js-solver, seedling-wasm, playback-bot, apworld |
| repeat ×16 bundled, `test_region_graph_sub_region_merged` | 45907343579 | **Rate: 16/16 passed** |
| repeat ×8 ES, same row | 45907341065 | **Rate: 8/8 passed** |
| `-f batch=tutorials` | 45907348756 | 24 run · 24 passed |
| `-f batch=tutorials-tracker` | 45907351242 | 9 run · 9 passed |
| `-f batch=feature-checks` | 45907353716 | 10 run · 10 passed |

The same set was also green one merge earlier, at `12f5d2b289` (badge-resize merged, before main moved): repeat bundled
16/16 (45904677280), ES 8/8 (45904680518), TT 45904683688, tutorials 24/24, tracker 9/9, feature-checks 10/10, JSUT
30391 / 0 failed (45904658755).

**Walk steps:** no tutorial, walk or feature check changed. None reads the signals this slice moved, and no step text or
condition was edited.

**direction-layout's "steady over 3 polls" wait is removed in this slice** (js-23 asked whether it could be). The rates
above (16/16 bundled, 8/8 ES at both SHAs) are with it removed. The row now waits for the settle, 3 animation frames,
no paint pending and every square on its node.

## 7. Headroom (fast batch, per boot)

A comparison of the TT run's `test-results-fast` / `-fast-bundled` (span = first row start → last row end;
budget 600 s). Per-row durations are medians of the base samples.

| | ES span | bundled span |
|---|---|---|
| tip `1a9d906c16` (45907346071) | 329.8 s (55%) | 336.2 s (56%) |
| main `6c9374b8da`, median of its 2 samples (45905110350, 45896762656) | 317.4 s → **Δ +12.4 s** | 329.5 s → **Δ +6.6 s** |
| main, median of the last 5 samples (those 2 + the 3 at `d05f789087`) | 327.1 s → **Δ +2.7 s** | 330.8 s → **Δ +5.3 s** |
| badge-resize `fbfbb6de4e`, median of 2 | 335.9 s → Δ −6.1 s | 320.7 s → Δ +15.5 s |

No sample crosses +20 s or 70%, so there was no re-sample and no attribution repeat. (Main's SHA has only 2 TT samples;
both comparisons are given.) The batch's spread (ES 315–340 s, bundled 319–342 s across these 7 runs) is larger than
the Region Graph rows' total Δ.

Every Region Graph row in fast, tip vs main `6c9374b8da` (ES / bundled, s):

| row | ES tip | ES Δ | bundled tip | bundled Δ |
|---|---|---|---|---|
| test_region_graph_panel_activation | 0.11 | +0.00 | 0.36 | +0.13 |
| test_cytoscape_library_loading | 0.35 | +0.00 | 1.67 | +0.14 |
| test_graph_initial_load | 0.25 | +0.00 | 0.68 | +0.20 |
| test_graph_data_loading | 3.57 | +0.65 | 3.91 | +0.14 |
| **test_control_buttons** (waits for "Layout complete") | 1.80 | **−1.50** | 1.83 | **−2.65** |
| **test_node_selection** (waits for a settled layout) | 0.45 | **−0.53** | 0.47 | **−0.53** |
| test_region_graph_node_picker | 0.56 | +0.02 | 0.58 | +0.02 |
| test_region_graph_location_nodes_survive_rebuild | 0.63 | +0.01 | 0.64 | −0.01 |
| test_region_graph_sub_region_nested | 1.07 | +0.05 | 1.14 | +0.01 |
| test_region_graph_sub_region_merged | 2.60 | +1.17 | 2.58 | +1.00 |
| test_region_graph_click_default | 4.62 | +0.63 | 4.66 | +0.30 |
| test_region_graph_click_master_off | 0.96 | −0.26 | 0.97 | −0.25 |
| test_region_graph_click_location_check | 0.43 | +0.03 | 0.41 | +0.01 |
| test_region_graph_click_discover | 1.88 | +0.05 | 1.89 | +0.02 |
| test_regions_location_click_follows_graph_strip | 0.62 | +0.01 | 0.64 | +0.03 |
| **all 15** | 19.91 | **+0.33** | 22.43 | **−1.45** |

- **"Layout complete" ~1050 ms sooner, per row:** the rows that wait for it or for a settled layout gain. In
  `test_control_buttons` the Re-layout waits for the status (−1.50 s ES, −2.65 s bundled; it also waits out the
  previous row's layout first). `test_node_selection` gains −0.53 s on both boots, and `test_region_graph_click_master_off`
  −0.26 / −0.25 s.
- `test_region_graph_sub_region_merged` +1.17 / +1.00 s vs main is mostly the steps direction-layout and badge-resize
  added (not on main yet). Against badge-resize's own samples it is **+0.24 / +0.36 s**: the 10-frame no-motion trace
  this slice adds (~170 ms) and the settle + 3-frame map-look wait, which replaced the 3-poll wait.
- `test_region_graph_click_default` moves ±1 s between samples (main 3.61–5.11 s bundled); against badge-resize it is
  −0.75 s ES / +1.18 s bundled. It runs no layout of its own: noise.

## 8. Follow-ups

1. `groupBadgeLayer` still re-places on any `layoutstop` (harmless). badge-resize owns it; moving it to
   `rg-layoutsettled` (or adding it alongside) is that layer's call.
2. A layout run outside the panel (`ui.cy.layout(…).run()` directly, as unit tests do) does not settle: nothing in the
   app does this any more. Any new layout path must go through `startLayout`.

## 9. Addendum: the L25 restamp and `directionLayout.test.js` (train 224 STOP, js-23)

After L25 landed (main `104a147842`), main + this branch had `directionLayout.test.js` (direction-layout's file) at
**2 failed / 30 passed**, deterministically: §4 "strength 0 ignores the exit directions" (`prefs.size` 0, expected
> 50) and §6 "two exits on one side" (`twoOnOneSideLevels` 0, expected 13).

- **The live feature is fine** (cc-23 asked for this to be measured first). Main `104a147842` + this branch
  (merge `f23130df44`), live app on the ES boot, seedling_playthrough AP_1, Direction-aware applied: status
  **"116 nodes in 161 ms, 0 overlaps, mean direction error 20°"** (merged) and **"307 nodes in 422 ms, 0 overlaps,
  mean direction error 28°"** (separate). The text for no directions, "no exit directions in this world", does not
  appear. The same panel code run headless over the LIVE preset: merged **99 preferences, 13 two-on-one-side levels**,
  mean error 17.9°; separate **107 preferences, 13 levels**, 25.2°. Over the frozen fixture: 0 and 0 in both views.
- **The cause: a frozen input paired with a live one.** The frozen `seedling_playthrough` rules (groups-c's fixture)
  carry `atlas_ref` **`seedling-b856f0fc`** in their sidecars. `flashSeedlingLibrary.js` resolves an `atlas_ref`
  against the atlases it ships (`KNOWN_ATLASES`, built from the live import of `atlases/seedling-playthrough.json`).
  L25 restamped that atlas to **`seedling-4586de3a`** and rewrote the presets to reference the new id, so the frozen
  refs resolved to nothing: no door tiles, so no preferences. The direction data itself did not change in a way that
  matters (the live preset gives the same 13 levels).
- **The fix (tests only):** `fixtures/sub-region-view/seedling-playthrough.atlas.json.gz` (`seedling-b856f0fc`, taken
  from `1a9d906c16`, the atlas shipped up to L25) and `seedling.atlas.json.gz` (`seedling-9ff3df2a`, the starter atlas
  that the frozen `seedling_atlas` rules reference). `regionGraphElements.testkit.js` gets `FROZEN_ATLASES` and
  `loadFrozenAtlas`, which refuses a fixture whose `atlas_id` is not the pinned one. `directionLayout.test.js` and
  `nodeLook.test.js` `vi.mock` both shipped-atlas imports with the frozen ones. directionLayout: **32/32**.
  nodeLook reads the same pairing but was unaffected (its cells read 89 location tiles from the live atlas and from the
  frozen one alike), so there the mock only pins the input.
- **Re-gate at `6e162e188a8ed099087be20ee18feea99e10ba3d`** (main `104a147842` merged at `f23130df44`, then the fix):
  JSUT 45914232973 success, **1456 / 30417 passed, 0 failed** (+0 F, +43 T vs main `104a147842`, 1454 / 30374);
  unittests 45914232991, type check 45914232965, Analyze 45914232947 success; TT 45914238931 success 9 / 9 jobs (fast
  143/143 on both boots); repeat ×8 bundled 45914232625 **Rate: 8/8 passed**, ×8 ES 45914235898 **Rate: 8/8 passed**.
  Bounded vitest: regionGraph/ + regionView/ + tutorials/ + the library, 29 files / 422 tests. Closure ∩ diff = ∅
  (0 of 42; 41-file diff vs main); engineMd5 `74ae60f575531492ed9eaec1839e1fe3` unchanged.
- **Headroom** vs main `104a147842` (median of its 2 TT samples, 45913251489 and 45905805022): fast ES 324.2 s,
  **Δ −20.4 s**; bundled 335.7 s, **Δ +0.6 s**. Region Graph rows total **−5.20 s** ES, **−1.05 s** bundled;
  `test_control_buttons` −1.50 / −2.63 s; `test_region_graph_sub_region_merged` +0.72 / +1.00 s (the steps
  direction-layout and badge-resize added, plus this slice's trace; see §7).
