# Region Graph checks: the six disabled rows, and the location-node rebuild bug

Slice `region-graph-checks` (session `region-graph-checks-repair`, planner archipelago-cc-23, reviewer js-21).
Base `e390574969` (train 144). Code tip `53298886f2`; this report and the D0 dumps are a docs-only commit after it.

⚖ **The user's rulings** (session 84c8ab35, archipelago-cc-23):
- 2026-11-17T02:25:35Z: *"Yes, I want to repair the Region Graph checks."* and *"I agree with your recommendation for
  7."* (7 = fix the location-node rebuild bug together with the checks).
- 2026-11-17T18:08:42Z: the order CA-S1 → this slice → CA-S2, *"Yes, go ahead (Recommended)"*.

Before this slice, the Region Graph ran one in-app row on push (the "Go to" picker). Now it runs eight, all in the
`fast` batch. They pin what CA-S2's click-wiring rewrite must keep green (see the end of this report).

## 1. The location-node rebuild bug

Named in `step2-view-model.md` ("Coverage the instrument cannot reach", residue 5). Measured again here, and the
second cause turned out to be different from what step 2 thought.

**(a) A rebuild drops force-show / zoom location nodes for good.** `buildGraphFromRegions` calls
`cy.elements().remove()`, which removes the drawn location nodes as well. `ui.locationsVisible` stayed `true`,
though, so `updateZoomBasedVisibility` (which draws only on a false → true change) never drew them again. Every
rebuild does this: a rules load, any `moduleSettings.regionGraph.*` write (`settings:changed`), discovery, and the
"Show undiscovered" box.

**(b) A persisted `locationVisibility` was never read back.** Step 2 put this down to "`updateZoomBasedVisibility`
runs before the first build". Measured: the setting itself never reached the panel.
- `ui.locationVisibilityMode` was set in only two places: `loadCheckboxSettings` (once, when the panel is set up) and
  the radio's change handler.
- So a write through the settings API (Options panel, JSON editor, a tutorial step, a test) changed nothing on a
  panel that was already set up, beyond triggering the rebuild in (a).
- Step 2's probe also wrote its setting while the app was still booting, and the boot replaced it. Measured: the
  value was gone within 1 s, and `getSetting` returned the call-site default.

**The fix** (commit `2019aa8354`):

| Where | What |
|---|---|
| `regionGraph/graphDataManager.js:518` | After `cy.elements().remove()`: `locationsVisible = false` (the flag now matches the graph) |
| `regionGraph/graphDataManager.js:552`, `:567` `redrawLocationNodesForMode()` | At the end of every build: re-apply the mode through `updateZoomBasedVisibility`. Hover mode re-draws the region still under the pointer; any other mode, or a region the new graph lacks, drops it |
| `regionGraph/graphInteractionManager.js:57` → `graphDataManager.js:589` `reseatLocationNodes()` | When a layout settles: bulk-drawn nodes are re-selected (`refreshLocationNodes`), because the 100-node cap keeps the regions nearest the viewport centre, which depends on the final positions. Hover's one region is moved back around its node. Before, nodes drawn before an animated layout stayed where the regions used to be (they are locked) |
| `regionGraph/layoutControlsManager.js:299` `loadLocationVisibilityMode()`, called at `:224` and from `regionGraphUI.js:906` (`settings:changed`) | Read the mode from the settings on every `settings:changed` that may carry it, and keep the radio in step. When the mode changed on a built graph, re-draw at once |
| `regionGraph/layoutControlsManager.js:704` | `saveNodePositions` skips location nodes. They are drawn around their region, not laid out, and saving them made the next rebuild's size check re-run the layout |

Untouched, as the brief requires: the click handlers, `layoutControlsManager`'s "On Region Node Click" block,
`graphInteractionManager`'s tap wiring, `regionGraph:nodeSelected`, `regionGraph/index.js` (so no conflict with AN-3a)
and `regionMap/`.

**Vitest pin:** `regionGraph/locationNodesRebuild.test.js`, 12 tests. It needs no DOM: a stub `cy` and the real
`GraphDataManager`, `GraphInteractionManager` and `LayoutControlsManager`. It covers:
- each mode after a rebuild;
- the stale-flag reproduction;
- hover re-draw and drop;
- the layoutstop re-select and re-seat;
- the settings read-back, both changed and unchanged, and before the first build.

The vendored `libs/cytoscape/cytoscape.min.js` does not run headless in Node, which is why the `cy` is a stub. The
in-app row below drives the real thing.

### D0 evidence

**The instrument:** `scripts/dev/region-graph-class-snapshot.mjs`. This slice extended it so that S5–S7 really are
"force-show every location node":
- **S5** now also sets "Max location nodes" to 0 (no cap) and picks force-show on the radio, as a user does. Both
  are `moduleSettings.regionGraph.*` writes, so S5 exercises cause (a).
  - The cap had to go: alttp's cose layout is not deterministic, so which regions fall under a 100-node cap varied
    from run to run (measured 740 and 748 elements on two runs).
- **S7** is new. It is a fresh page that BOOTS with force-show persisted: written once the boot has stopped
  replacing settings, checked to have held for 2 s, then a reload. So S7 exercises cause (b).

**Determinism:** BEFORE (at the base app code) was run twice, and so was AFTER (at the fix). Each pair is
byte-identical (`diff -rq` empty). Both are committed in `region-graph-checks-dumps/{before,after}/`, with
`classify.py`, which produced the table below.

Digests (sha256 of `cat <preset>/S*.json`, first 16 hex):

| Preset | BEFORE (×2) | AFTER (×2) |
|---|---|---|
| `seedling_playthrough` | `18dd39c74ed640e2` | `84781c010c2637c1` |
| `alttp` | `c015746f192c3fb3` | `db2c482c342af7a8` |
| `procgen_topdown` AP_1 | `77be64263cde8c73` | `42c8fa729f0adaf5` |

**Control on the instrument change:** S1–S4 of the new BEFORE are byte-identical to step 2's committed
`step2-dumps/before/` for `alttp` and `procgen_topdown`. `seedling_playthrough` differs by 29 lines, all of them
`level_99__r2c7` gaining a location. The preset's rules were regenerated since step 2; that is data, not code.

**What moved, BEFORE → AFTER** (`classify.py`):

| | seedling | alttp | procgen |
|---|---|---|---|
| S1 | `in-path` ×1 | — | `in-path` ×1 |
| S2 | — | — | — |
| S3 | `in-path` ×1 | — | `in-path` ×1 |
| S4 | `in-path` ×1 | — | `in-path` ×1 |
| S5 | +178 location nodes/edges | +536 | +50 |
| S6 | +178, `in-path` ×1 | +536 | +50, `in-path` ×1 |
| S7 | +178, `in-path` ×1 | +536 | +50, `in-path` ×1 |

- **The location nodes in S5–S7.** BEFORE: none drawn in any preset. AFTER: every location, and the counts (178 /
  536 / 50) equal each preset's hover-sweep total. The S5–S7 `hoverSweep` moves with them: in force-show mode a
  mouseover draws nothing new, so the sweep reads the drawn nodes.
- **The `in-path` line.** It is the edge from the start region along the initial path (`Menu-level_0__r7c6`,
  `Menu-Overworld`). It is explained by the fix:
  - `redrawLocationNodesForMode` → `updateZoomBasedVisibility` → `updateLabelVisibility` →
    `highlightPathEdges` (`graphInteractionManager.js:561`, `:654`) re-applies the path highlight that the rebuild's
    `remove()` had stripped.
  - BEFORE, the edge stayed un-highlighted until the next zoom or pan; S2 already had it, because its actions
    re-highlight.
  - alttp shows no change because its start has no such edge drawn on the initial path.
- **Nothing else moved:** no region-node class, label, count or edge outside those lines.

## 2. The rows (`tests/testCases/regionGraphPanelTests.js`; commit `53298886f2`)

**Shared helpers:**
- `graphCy` (`:12`).
- `graphShowsWorld` (`:20`): the region nodes are exactly `staticData.regions`, and there are edges. This is
  durable state, unlike the status bar.
- `layoutSettled` (`:28`).
- `restoreWorld` (`:40`): reloads a `./presets/` world that a row replaced, or changed (`always`).

**Order independence:** every row sets its own state and restores what it changes. They passed together in config
order and in two shuffled orders. Shuffling needs `randomizeOrder: true` in the config, because `--testOrderSeed`
alone is ignored; the flag was flipped locally for those two runs and reverted.

| Row | Cause | Fix | Rate (CI repeat ×8 at `53298886f2`) |
|---|---|---|---|
| `test_region_graph_panel_activation` | passed already | none | — |
| `test_cytoscape_library_loading` | passed already | none | — |
| `test_graph_initial_load` | **ROW.** It polled the status bar for "regions"/"connections", but that text is transient: `runLayout` sets "Running layout…" and layoutstop sets "Layout complete". On a panel an earlier row had shown, it was long gone, so the row was STUCK | Asserts `graphShowsWorld` (no rules load of its own), and that the canvas is rendered | **8/8** (run 44348511475) |
| `test_graph_data_loading` | **ROW.** The same transient status text. It also loaded ALTTP and never put the previous world back, so later rows ran on ALTTP. That is why the picker met `Agahnim 1` | Keeps a node from before the load and asserts that it was `removed()` and that `graphShowsWorld` holds for the new world (a real rebuild, not a stale graph). Reloads the world it replaced | **8/8** (44348517029) |
| `test_control_buttons` | passed, but fragile: a layout still running (after another row's rules load) makes Re-layout a no-op, so "Running layout" never appears | Waits for the build, a settled layout and no "Running layout" before clicking. "Layout completed" now needs "Layout complete", not any text containing "regions" | — |
| `test_node_selection` | **ROW.** It dispatched a DOM `click` on the canvas centre. Cytoscape derives `tap` from mousedown/mouseup (or touch), never from `click`, and the centre need not be a node | Centres a region node (not the player's, sorted for a stable pick) and dispatches mousedown + mouseup at its rendered position on the element there. Asserts `regionGraph:nodeSelected` with `nodeId` = that node and `data.id` = it, and the `selected` class. Reloads the world, because the tap may move the player | **8/8** (44348523132) |
| `test_region_graph_node_picker` | **ROW.** It picked the first unchecked location, which may be inaccessible (`Agahnim 1` in ALTTP, refused by the check gate) | Picks the first location option that `regionViewModel.locationState` calls `accessible`, as the graph colours it | **8/8** (44348529109) |
| `test_region_graph_location_nodes_survive_rebuild` (NEW) | — | Writes force-show through the SETTINGS. It checks that the graph rebuilt (an old node is `removed()`), that the radio follows, and that location nodes are drawn. Then it writes `regionGraph.wheelSensitivity`: another rebuild, and the nodes are still drawn. Restores both, and checks that hover mode then leaves none drawn in bulk. **Negative control:** against the base app code it goes red on exactly the radio and both "drawn" conditions | in-app runs below |

- **No app defect was behind the three failing rows**; each was a row expectation.
- **No row is proposed for deletion.**
  - Activation is the only row that checks the status bar and the Export button.
  - Cytoscape loading names the failing library, where the others would only time out.
  - The rest each pin something none of the others do.
- Each row has a `_comment` in `playwright_tests_config-substrates.json` (category "Region Graph", fast batch).
- The `//enabled: true` registrations stay as they were. An explicit `enabled: false` would have dropped them from
  the `full` config, whose `defaultEnabledState: true` applies only to an undefined value.

**Local runs** (`--port=8141`): all 8 together PASS, then two shuffled orders (seed 7, seed 1234) PASS.

## 3. Gates and CI (all at code tip `53298886f2`)

**CI runs:**

| Run | Id | Result |
|---|---|---|
| JSUT | 44348413357 | green: 28691 passed / 0 failed, 1345 files. Base `e390574969` (run 44242476339): 28679 / 1344. **+1 file / +12 tests**, 0 failures |
| unittests | 44348413405 | green |
| TT dispatch | 44348505215 | every job green |
| Manual `tutorials` | 44348535203 | green |
| Manual `tutorials-tracker` | 44348541523 | green |
| Manual `feature-checks` | 44348549029 | green |

- **Why those manual batches:** the `tutorials` and `tutorials-tracker` walks open the Region Graph
  (`guidedTour.js`, `games/depgraphExtras.js`, `tracker/panels.js`; `grep -a`). `feature-checks` was required by the
  brief.

**Fast headroom** (`check-batch-headroom`, budget 600 s):

| | Base push TT 44337403537 | Main re-measure TT 44353140446 | Tip TT 44348505215 | Tip TT 44352844796 |
|---|---|---|---|---|
| fast | 275.4 s (46%) | 275.1 s (46%) | 277.1 s (46%) | 277.3 s (46%) |
| fast bundled | 268.0 s (45%) | 272.8 s (45%) | 291.0 s (49%) | 290.9 s (48%) |

- **The stop line:** the first bundled sample was +23.0 s over the base push, above the brief's +20 s. I stopped and
  reported it.
- **The rulings:**
  - The planner (archipelago-cc-23) ruled (a): packet with the numbers. No row is trimmed or moved out of `fast`.
  - js-21 (who owns the gate): the line means what the rows add. The rest is measured by one TT at main beside a
    second tip sample. If tip − rows is within ~10 s of main, it is noise.
- **Measured, so the gap is noise:**
  - Tip − rows = 291.0 − 13.4 = **277.6 s** and 290.9 − 14.0 = **276.9 s**.
  - Main is **272.8 s**: a gap of 4.1–4.8 s, under js-21's ~10 s.
  - The two main bundled samples themselves differ by 4.8 s.
- **What the new rows cost**, per row in each sample (unbundled / bundled, s):

  | Row | 44348505215 | 44352844796 |
  |---|---|---|
  | activation | 0.1 / 0.2 | 0.1 / 0.3 |
  | cytoscape | 0.4 / 1.5 | 0.4 / 1.8 |
  | initial_load | 0.3 / 0.5 | 0.3 / 0.4 |
  | data_loading | 3.4 / 4.4 | 3.1 / 4.9 |
  | control_buttons | 3.3 / 5.1 | 3.3 / 4.9 |
  | node_selection | 1.0 / 1.0 | 1.0 / 1.0 |
  | survive_rebuild | 0.6 / 0.7 | 0.6 / 0.7 |
  | **Sum** | **9.1 / 13.4** | **8.7 / 14.0** |

- **Even less than the sums:** the first Region Graph row pays the Cytoscape script load. On main that is the picker
  (2.3 s bundled in 44353140446); at the tip it is the cytoscape row, and the picker drops to 0.6 s.

**Other gates:**
- **Closure ∩ diff = ∅.**
- **engineMd5:** base = tip = `bec369878feb67081187edca62baa951`
  (`seedlingDerivedRuleTable.js --print-engine-closure`, 42 files; base measured with the modified files checked out
  at `e390574969`).
- **Bounded vitest** (⚖ 52), 24 files / 385 tests, all pass:
  - `regionGraph/`, `regionView/`, `regionMap/`, `loops/loopModeExemptions.test.js`, `tests/`;
  - `client/core/messageHandler.outOfLogicGate.test.js`, `tutorials/tutorials.test.js`,
    `quickLaunch/quickLaunchImportOrder.test.js`;
  - `scripts/test/{testWebgpu,compare-runs,inAppSummary}.test.js`.
- **Gitlinks:** 0.
- **The `regionMap/regionMapUI.js:17` comment:** NOT folded in. Train 152, which moves the camera file, was not on
  main when this slice was built (js-21's edit 1).

## 4. Notes for CA-S2 (the click-wiring rewrite)

These rows pin behaviour that the rewrite must keep green:

- **`test_node_selection`** is the only row through the real canvas → Cytoscape `tap` → handler path. A pointer
  mousedown + mouseup on a region node must still:
  - publish `regionGraph:nodeSelected` with `{ nodeId: <region>, data: <node.data()> }` (with `data.id` the region);
  - add the `selected` class to that node.
- **The picker** calls `interactionManager.handleRegionNodeClick(node)` and `handleLocationNodeClick(...)`
  directly (`nodePicker.js:111`, `:124`). If those names or signatures change, the picker must move with them.
  - A picked region publishes `nodeSelected` for it.
  - A picked accessible location ends up in `checkedLocations`.
- **`test_region_graph_location_nodes_survive_rebuild`** pins the radio's `name="locationVisibility"` inputs and
  the `.location-node` class.
- **`graphShowsWorld`** reads `.region` minus `.player` / `.location-node`, through `container._cyreg.cy`.
- **D0** (`scripts/dev/region-graph-class-snapshot.mjs`) taps through `cy.getElementById(id).emit('tap')`, picks
  through the picker, and sets force-show through the radio. Run it before and after the rewrite: a rewrite that
  keeps behaviour leaves `region-graph-checks-dumps/after/` byte-identical, at an unchanged preset.
