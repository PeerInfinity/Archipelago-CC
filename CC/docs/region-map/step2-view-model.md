# Region Map step 2: the shared region view model

**Session:** `region-map-view-model` (Opus). **Branch:** `region-map-view-model`, cut at `9b99178fa75bb2fc818cd40435c00af0347b40de` (origin/main = train seedling-maze-link, which carries step 1).
**Plan:** `NewDocs/plans/region-map-panel-plan.md` step 2 (⚖ GO, user, 2026-11-14). The Region Graph's rectangular-node redesign is cancelled. The user will soon rethink its click UI, so the actions now live in one place that both panels call.

**Verdict.**
- The renderer-agnostic view model, the view-state wrapper and the shared actions are in `frontend/modules/regionView/`.
- The Region Graph has been rewired onto them.
- **D0 measures that its behaviour is unchanged.** Every dump is byte-identical BEFORE and AFTER: 3 presets × 6 states, plus the hover sweep of every region's location nodes.
- No Region Map panel, canvas or layout was added. The Locations and Regions panels were not touched.

## The API

### `regionView/regionViewModel.js` (pure)

None of these functions imports Cytoscape, the DOM, a panel or a singleton.

| Function | file:line | What |
|---|---|---|
| `isRegionReachable(snapshot, name)` | `regionViewModel.js:29` | The tri-value test (`true`/`'reachable'`/`'checked'`), in one place (`REACHABLE_VALUES` :26) |
| `evaluateAccessRule(rule, {…})` | :38 | A missing rule counts as true. A throw counts as false and is reported through `onError` |
| `locationState(snapshot, staticData, location, {regionName})` | :55 | Returns `'checked' \| 'accessible' \| 'inaccessible'`. Region accessibility comes from the snapshot |
| `locationCounts(snapshot, staticData, regionName, regionData)` | :69 | Moved from `calculateLocationCounts`; same shape, including the zero object when data is missing |
| `regionInteriorState(counts, reachable)` | :112 | Moved from `determineNodeInteriorColor` |
| `regionColorState(snapshot, name, ctx)` | :128 | The colour a view **shows**: `'accessible' \| 'inaccessible' \| null`. It is null when the accessibility filter turns colours off, or when discovery hides an undiscovered region's reachability (see D4) |
| `exitState(snapshot, staticData, exit)` | :142 | Forward and reverse traversability of an exit pair |
| `discoveryContext({...})` | :163 | Builds the context `{active, settings, discovery, regions, showUndiscovered, showAccessibility}` |
| `hasEntranceFromDiscoveredRegion(name, regions, discovery)` | :169 | Moved; takes the discovery state as an argument |
| `regionDiscovery` / `regionVisibility` | :187 / :196 | **The one copy** of the region hide/placeholder decision. Returns `{discovered, hasEntrance, visibility}` |
| `locationDiscovery` / `locationVisibility` | :208 / :220 | The one copy for locations. Returns `{discovered, placeholder, regionHidden, visibility}` |
| `exitDiscovery` / `exitVisibility` | :231 / :244 | The one copy for exits. Returns `{discovered, visibility}` |
| `displayGroupsOf(names, {registry, sidecarOf, substrateOf})` | :267 | Returns `Map<displayKey, rulesRegion[]>`, built through each substrate's `compositeMap.displayRegionOf` |
| `displayKeyIndex` / `sidecarIndex` | :281 / :288 | The inverse map, and the index of `preset_sidecars[player]` by region id |
| `aggregateCounts` / `aggregateVisibility` | :298 / :317 | A display group's counts are the sum of its members'. A group is `'shown'` if any member is |

Every `visibility` is `'shown' | 'placeholder' | 'hidden'`. The Region Graph's `#graph-show-undiscovered` box is passed in as `ctx.showUndiscovered`; the Region Map will pass its own control.

⚠ **Step-1 residue, written down in the module (:260–263) and pinned by a test:** the `displayRegionOf` keys are DISPLAY groups, not rules regions. `level_0` is a key while no `level_0` region exists. A key is never a move target and never looked up in `staticData.regions`.

### `regionView/regionViewState.js` (stateful, for step 3b)

- **`createRegionViewState({ stateManager, eventBus, discovery, gameState, registry, settings, getRules, showUndiscovered, showAccessibility, schedule, cancel, owner })`** (:160)
  - It subscribes to the triggers in `REGION_VIEW_TRIGGERS` (:49): `snapshotUpdated`, `rulesLoaded`, `regionChanged`, `pathUpdated`, `discovery:*` and `settings:changed`.
  - It recomputes at most once per animation frame.
  - A discovery trigger re-reads `moduleSettings.discovery.*` (`readDiscoverySettings` :71) before the recompute.
- **The object it returns:** `get()`, `subscribe(fn)`, `refresh()`, `ready()` and `dispose()`. `dispose()` unsubscribes everything and drops a pending frame.
- **`computeRegionView(...)`** (:92) is the pure core. It returns a **deep-frozen** view; its Maps throw on `set`, `delete` and `clear`. The view has these fields:
  - `regions` (`reachable`, `counts`, `interior`, `color`, `discovered`, `visibility`, `displayKey`);
  - `locations` (`region`, `state`, `discovered`, `visibility`);
  - `exits` (one record per directed exit: `accessible`, `traversable`, plus the pair's discovery);
  - `displayGroups`, `currentRegion`, `currentDisplayRegion`, `path`, `discoveryActive`, `version`.
- The Region Graph does **not** adopt it in this slice; its own trigger wiring is unchanged.

### `regionView/regionActions.js` (shared actions)

Every action takes its handles explicitly: `h = { dispatcher, eventBus, gameState, stateManager, pathFinder, getRules, restart }`. Each one returns a result instead of flashing anything.

- **Queries:** `currentRegionOf` :35, `primaryStartRegion` :45, `isStartRegion` :54, `buildAdjacencyMap` :63 (was `_buildAdjacencyMap`).
- **Moves:**
  - `publishRegionMove` :77 sends the payload.
  - `takeRestartStep` :94 is ⛓ RETURN TO MENU.
  - `planOneStepMove` :116 and `planDirectMove` :134 return `{ok:false, reason:'no-current'|'already-there'|'no-path'|'no-next-exit'|'no-final-exit'}`, or `{ok:true, kind:'move'|'restart', …}`.
  - `moveOneStep` :152 and `moveDirectly` :159 plan and then publish.
- **Path edits:** `addToPath` :176 and `overwritePath` :200. Both take a `beforeExecute` hook, which the Region Graph uses to turn off the Regions panel's "Show All Regions".
- **Location checks:**
  - `locationChecksAllowed` :236 is the discovery `disableLocationCheckUI` gate.
  - `checkLocation` :244 checks one location.
  - `bulkCheckCandidates` :262 and `checkAccessibleLocationsInRegion` :279 do the bulk check.
  - `addLocationCheckToPath` :288 adds a check to the path.
- **Select/show:** `publishNodeSelected` :296 and `showRegionInRegionsPanel` :301.

## What moved from where

| From (base `9b99178fa7`) | To |
|---|---|
| `graphDataManager.js` `determineNodeInteriorColor` (~:66), `calculateLocationCounts` (~:95), `getLocationStatus` (~:1308), `hasEntranceFromDiscoveredRegion` (~:161) | `regionInteriorState`, `locationCounts`, `locationState`, `hasEntranceFromDiscoveredRegion`. The Region Graph methods remain as one-line delegates |
| The tri-value test repeated inline (~:111, ~:797, ~:918–924, ~:1322) | `isRegionReachable` |
| Exit traversability inline in `onStateUpdate` (~:926–1012) | `exitState` (now called at `graphDataManager.js:769`) |
| The discovery hide/placeholder decision **duplicated**: `buildGraphFromRegions` regions (~:253–296) and edges (~:526–566); `onStateUpdate` regions (~:803–859) and edges (~:951–993); `createLocationNodesForRegion` (~:1199–1220) | `regionDiscovery` / `exitDiscovery` / `locationDiscovery`, through one context builder `_discoveryCtx` (`graphDataManager.js:28`) that reads the `#graph-show-undiscovered` box once |
| The class read-backs `parentNode.hasClass('accessible')` (~:753), `region.hasClass('accessible')` (~:1184), `parentNode`/`region`/`sourceNode.hasClass('discovery-hidden')` (~:786, ~:901, ~:1240, ~:1246) | `regionColorState(...) === 'accessible'` (`:644`, `:988`), `locationDiscovery(...).regionHidden` and `regionVisibility(...) === 'hidden'` |
| `navigationManager.js` `getPrimaryStartRegion`, `isStartRegion`, `getCurrentPlayerLocation`, the one-step / direct / restart / add / overwrite bodies, `_buildAdjacencyMap` | `regionActions.js`. `navigationManager.js` supplies the handles (`_handles`, :25) and shows the results (`_flashNoPath`, :40; status lines; logs) |
| `graphInteractionManager.js` location check (~:298), bulk check (~:384–440), nodeSelected / activatePanel / navigateToRegion publishes (~:332–373), the discovery check-gate (~:246, ~:386) | `checkLocation`, `checkAccessibleLocationsInRegion`, `publishNodeSelected`, `showRegionInRegionsPanel`, `locationChecksAllowed` |
| The `source` / `originator` literals | `regionGraph/regionGraphOriginators.js`, byte-identical |

The Region Graph keeps everything that touches Cytoscape: class application, labels, overlays, layout, the player node, hub detection and the status bar.

**Dispatch timing is unchanged.** The Region Graph still reaches its dispatcher through the lazy `import('./index.js')`, as before. The actions are only planned synchronously; the publish happens in the same `.then` it always did.

## D0: the equivalence instrument

- **Instrument:** `scripts/dev/region-graph-class-snapshot.mjs`. It takes the box lock and uses `--port` / `--presets` / `--out`.
- **What it does:**
  - It drives the app with Playwright and reads `cy` off the panel's container (`_cyreg`).
  - It dumps every element's id → group, sorted classes, label, `isDiscovered`, `locationCounts`, `hierarchyDepth`, and `source`/`target` for edges.
  - It also dumps the current region, the path and the path classes.
  - **Every state also carries a `hoverSweep`:** each region's location nodes as hover mode (the default) draws them, one region at a time.
- **Presets:**
  - `seedling_playthrough`;
  - `alttp` (the classic AP world with entrances and rules);
  - `procgen_topdown` AP_1 (a generated procgen preset, loaded by `?rules=` because `?game=procgen_topdown&seed=1` doesn't resolve its `AP_1` folder and fell back to Adventure).

**States:**

| State | What |
|---|---|
| S1 | The initial load |
| S2 | Three location checks through the "Go to" picker (= the location-tap handler), then one region tap (the default "move player directly"). The first check's region is hovered **before** the checks, so its location nodes in `elements` are the ones the check snapshots updated (the `onStateUpdate` location branch, not creation) |
| S3 | S2 + discovery ON (default discovery settings) |
| S4 | S3 with `#graph-show-undiscovered` unticked |
| S5 | Discovery OFF, with both external filters registered (`registerAccessibilityVisibilityFilter(() => false)`, as APCalc hard mode does, and `registerEdgeVisibilityFilter((a, b) => a < b)`) |
| S6 | S5 + discovery ON |

**Results:**
- **BEFORE** (at the base) was run twice; the two runs were byte-identical. One run is committed in `CC/docs/region-map/step2-dumps/before/` (`<preset>/S1–S6.json` + `summary.json`, 0 page errors).
- **AFTER** (at `7b4ae7b5ff`, the code-complete commit; only docs follow it): `diff -rq` against `before/` reports nothing. **BYTE-IDENTICAL.**
- **Sensitivity check: the instrument decides the D4 risk.** I temporarily replaced the location nodes' `region-accessible` source with raw `isRegionReachable`, as the brief suggested, and re-ran `alttp`. 58 dump lines changed in S3, S5 and S6 (discovery and the accessibility filter); S1, S2 and S4 were unchanged. **The class encoded the filter and discovery effects**, so the raw replacement would have been a behaviour change. The slice uses `regionColorState`, which encodes exactly those effects; the swap was reverted.
  - ⚖ **For the Region Map:** its location squares should probably use raw reachability, or `regionColorState` if it honours the same filter. That is step 3b's call.

**Coverage the instrument cannot reach** (a pre-existing behaviour, named and not changed): S5/S6 were first designed as "force-show every location node", and they show none. Two causes:
- A write to any `moduleSettings.regionGraph.*` key fires `settings:changed`, and that rebuilds the graph (`regionGraphUI.js` `subscribeToEvents`). The rebuild removes the drawn location nodes, but `ui.locationsVisible` stays true, so they are never re-shown.
- `force-show` set before the panel's first show never draws them either, because `updateZoomBasedVisibility` runs before the first build.

In practice, `force-show` and `zoom` locations disappear after any rebuild. The hover sweep covers location-node creation instead, and S2's hovered region covers the update path.

## Gates

**Bounded vitest (⚖ 52):**
- **Paths:** `regionView/`, `regionGraph/`, `discovery/`, and every vitest that imports a touched file or `discovery/singleton` (`grep -a -l`): the 4 mazeRoom files, `regions/regionBlockBuilder.undetermined.test.js`, `loops/loopEvents.test.js` and `client/core/messageHandler.outOfLogicGate.test.js`.
- **Results:**

  | | Files | Tests | Result |
  |---|---|---|---|
  | BEFORE | 9 | 278 | passed |
  | AFTER | 13 | 314 | passed |

  The 36 extra tests are the new pins: 13 view model, 4 view state, 15 actions, 4 dispatch.
- **Plus:** the 33 vitest files that scan module directories, and `quickLaunch/`. All pass except `flashPanel/mapDocumentPath.test.js`, which fails with `ENOENT … flashPanel/wasm/builds.json`. That is the no-wasm worktree, as the brief predicted; this slice doesn't touch flashPanel.
- No procgen doc was edited. `generate-procgen-reference.mjs --check` and `generate-docs-index.mjs --check` both report current.

**In-app** (`--port=8130`):

| Run | BEFORE | AFTER |
|---|---|---|
| `--batch=fast` | 97/98: `omsi-step-gate-parks-the-clock` FAILED ("pool did not drain while unparked") | **98/98** (`compare-runs.js`: FIXED 1, no new failures) |
| `--test=test_region_graph_node_picker` alone | PASSED | PASSED |

- ⚠ `compare-runs` flags "tree moved" on both runs. In each case I committed non-code files under my own lock while the run was in progress: the instrument and BEFORE dumps; then docs.
- The BEFORE red is an omsi row and has nothing to do with the Region Graph.

**The six disabled `regionGraphPanelTests` rows, by `--test`.**
- `?testIds=` only narrows the roster, so a disabled row cannot run without being enabled. I added the six to a **local, uncommitted** copy of the substrates config, ran them together with the picker, and reverted the copy (`git checkout`).
- **They are NOT enabled in the committed config.** Whether they should run on push is the planner's question.
- **Results:**

  | Row | BEFORE | AFTER | Failing condition |
  |---|---|---|---|
  | `test_region_graph_panel_activation` | PASS | PASS | |
  | `test_cytoscape_library_loading` | PASS | PASS | |
  | `test_graph_initial_load` | FAIL | FAIL | "Graph loaded without manual rule loading" (STUCK) |
  | `test_graph_data_loading` | FAIL | FAIL | "Status shows region count / connection count" |
  | `test_control_buttons` | PASS | PASS | |
  | `test_node_selection` | FAIL | FAIL | "Node selection event published" |
  | `test_region_graph_node_picker` (in that company) | FAIL | FAIL | Picks `Agahnim 1`, which is not accessible after the rows before it. It passes alone |

- Identical before and after: same passes, same failures, same conditions. The three failures are why those rows were disabled ("test timing is complex"). Note also that the picker picks the first unchecked location without checking that it is accessible.

**CI:** the run ids at the exact tip are in the packet message to js-19. Committing this report moves the tip, so the ids cannot be recorded here.

## Dispatcher and originator notes

**Dispatcher senders are per module.**
- `regionGraph/index.js` registers `user:regionMove` and `user:locationCheck` senders, and takes its `moduleDispatcher` from `initializationApi.getDispatcher()`.
- Every Region Graph dispatch still goes through that `moduleDispatcher`, which `regionActions` receives as `h.dispatcher`. So the module id is unchanged.
- Pinned by `regionGraph/regionGraphDispatch.test.js`: one step, direct, add-to-path, single and bulk checks, and the discovery gate.
- Vitest quirk: two *concurrent* `import('./index.js')` of the mocked module resolve only once, so the test sequences its calls. The browser resolves both.
- How a second panel does it is written in `regionActions.js`'s header and the README:
  1. Register its own senders and publishers in `register()`.
  2. Pass its own dispatcher and event bus.
  3. Pick its own strings.

**Strings (byte-identical, now in `regionGraphOriginators.js`):** `RegionGraphCheck`, `RegionGraphBulkCheck`, `regionGraph-oneStep`, `regionGraph-direct`, `regionGraph-addToPath`, `regionGraph-overwritePath`, `regionGraph:nodeSelected`. Their readers (`git grep -a`):

| String | Readers |
|---|---|
| `RegionGraphCheck` | `client/core/messageHandler.outOfLogicGate.test.js:69` (fixture). `messageHandler.js:2018–2022` passes `originator` through to logs and payloads; no code compares against the value |
| `RegionGraphBulkCheck` | `client/core/checkGate.js:16` (comment: `originalDOMEvent` cannot tell a click from a game report) |
| `regionGraph-*` sources | ⚠ **`loops/loopModeExemptions.js:28`: `source.startsWith('regionGraph')`** — every Region Graph click is a loop-mode *planning source*. Pinned by `loops/loopModeExemptions.test.js:30–33` and `loops/blockModes.test.js:704`. Pre-existing: that test lists `'regionGraph-directMove'`, which is not the real string (`'regionGraph-direct'`); the prefix match makes the mismatch harmless |
| `regionGraph:nodeSelected` | Subscribed by `apcalc/index.js:69`, `discovery/index.js:273` (click discovers region), `flashPanel/flashPanelUI.js:1603`, `vibeCodingSim/index.js:85`. Also published by `regionGraph/nodeOverlayManager.js:344`, and by `seedlingJsRuntimeTests.js:5312` (`publishAs … 'regionGraph'`). Asserted in `regionGraphPanelTests.js` and in `docs/json/developer/modules/regionGraph.md:40` |

## Residue (named, not done)

1. **Locations panel / Regions panel / `regionBlockBuilder` duplication.**
   - The tri-value reachability test and the location accessibility evaluation are repeated inline in these places:
     - `locations/locationUI.js` (~:837, ~:991);
     - `exits/exitUI.js` (~:599, ~:617, ~:704–737, ~:897);
     - `commonUI/commonUI.js` (~:2883, ~:2980–2989), which the region blocks use;
     - `commonUI/checksLine.js:32`.
   - Each could call `isRegionReachable` / `locationState`. That is out of scope here; each has its own tests to move.
2. **Should the Region Graph adopt D2?**
   - **For:** one recompute per frame, where it now recomputes on every trigger without throttling, and one copy of the trigger list.
   - **Against:**
     - `onStateUpdate` takes the event's `snapshot`, while D2 reads the latest snapshot.
     - `loadGraphData` rebuilds on `rulesLoaded` and on settings changes; D2 only recomputes.
     - The location-node rebuild bug above interacts with any change in rebuild timing.
   - **Recommendation:** adopt it only after the location-node rebuild bug is fixed. D0 is the instrument for that change.
3. **What step 3b needs that D2 does not give it yet:**
   - **Cross-level event placement** (step-1 residue): an event whose `obstacle.level` is another level has no tile in its region's level. `locationTiles` leaves it out, and `unplacedSeedlingLocations` names it. The view carries a location's `region` but no tile; 3b calls `compositeMap.locationTiles` itself.
   - **Exit sides / door tiles** (`exit_tiles` in the payload) are not in `exits`.
   - **`getRules`** must be wired to `stateManager/index.js` `getLastRawJsonData` for `preset_sidecars`. Without it every region is its own display group.
   - **Cost in discovery mode:** `hasEntranceFromDiscoveredRegion` scans every region's exits for each undiscovered region, which is O(R²·E) per recompute. That is as before, but D2 runs it per frame. An inverse-entrance index belongs in `computeRegionView` if `seedling_playthrough` (677 elements) shows it.
   - **Loop mode:** a Region Map `source` prefix that is not `regionGraph…` is NOT a loop-mode planning source (`loopModeExemptions.js:28`). 3b must decide, and add its prefix there if its clicks should be exempt in the same way.
   - **Panel-local state:** hover, selection and "show undiscovered" are panel state, so D2 takes them as getters.
4. **Remaining class read-backs (labels only, out of D4's named scope):** `navigationManager.js` `onPathUpdate` and `graphInteractionManager.js` (~:640, ~:716) read `node.hasClass('discovery-hidden')` to choose a label. `nodePicker.js:51` does the same to filter its list. Each could call `regionVisibility`.
5. **The pre-existing location-node rebuild bug** (D0, above): a `moduleSettings.regionGraph.*` write or any rebuild drops force-show/zoom location nodes for good.
6. **One-line exactness note:** the build-time edge discovery now reads `name ? isExitDiscovered(…) : false`. Before, it called `isExitDiscovered(region, name)` whenever the exit object existed, so the two differ only for an exit with an empty name. The update pass always used the `name ?` form, and it wins.

## Packet facts (also sent to js-19)

- **Gitlinks:** 0.
- **Closure ∩ diff = ∅.** Compared against `NewDocs/plans/js-gate-tools/closure.txt`, the diff touches 18 files (plus 19 dump files):
  - `scripts/dev/region-graph-class-snapshot.mjs`;
  - `frontend/modules/regionView/{README.md, regionActions.js, regionActions.test.js, regionViewModel.js, regionViewModel.test.js, regionViewState.js, regionViewState.test.js}`;
  - `frontend/modules/regionGraph/{graphDataManager.js, graphInteractionManager.js, navigationManager.js, regionGraphDispatch.test.js, regionGraphOriginators.js}`;
  - `docs/json/{user,developer}/modules/regionGraph.md`;
  - this report.
- Nothing under `frontend/modules/shared/` changed; the slice only imports from it.
- **Manual batches whose rows open the Region Graph** (`git grep -a` for `regionGraph` / `regionGraphPanel` / `Region Graph` over `tests/testCases/` + `tutorials/content/`):
  - `tutorials`: `guidedTour.js:112` activates it, and `games/depgraphExtras.js:14` uses it.
  - `tutorials-tracker`: `tracker/panels.js:13`.
  - `apworld`: `apworldEditorTests.js:594` asserts that the panel is listed. The batch runs on push only when its paths are hit, so I dispatched it.
  - **Prose-only hits, not dispatched:** `developer/developer.js:43`, `steps/procgen.js:178`, `tracker/trackAGame.js:197`, `tutorialTests.js:3` (comment).
  - **Not dispatched:** `feature-checks` (no rows hit), and `seedling-js` (`seedlingJsRuntimeTests.js:5312` publishes `regionGraph:nodeSelected` directly, without opening the panel).
