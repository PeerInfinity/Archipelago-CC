# Region map step 4 — the Region Map's clicks

**Status: built.** A Region Map click now does what the same click does in the Region Graph. It goes through the shared
`regionView/regionActions.js`, under the Region Map's own dispatcher, event bus and strings. The Region Graph is
unchanged: D0 is byte-identical, and `git diff origin/main...<tip> -- frontend/modules/regionGraph/` has 0 lines.

> ⚖ **User (2026-11-17):** *"Yes, let's copy the Region Graph's click behavior for now. The main thing I want to
> reconsider is how the UI should work for toggling between the various modes. The Region Map would need to have its
> own copy of the mode toggling controls."*
>
> ⚖ **Planner (archipelago-cc-23), option A:** the Region Map **reads the Region Graph's existing
> `moduleSettings.regionGraph.*` toggles** at click time, with the same keys and defaults. It adds no new control and
> no new settings key. ⇒ **Today, the Region Graph's control panel drives Region Map clicks too.** The mode-toggle
> discussion (`mode-toggle-ui-discussion`) will give the Region Map its own copy. That copy is a one-argument change
> (`CLICK_OPTIONS_PREFIX`, `regionMapClicks.js:38`).

Inputs: `step3b-panel.md` ("Residue → Step 4", item 10) and `step2-view-model.md` (the shared actions, D0).

## 1. The click census — the Region Graph (the spec that was copied)

Read from `regionGraph/graphInteractionManager.js`, `navigationManager.js`, `layoutControlsManager.js`,
`regionGraphOriginators.js` and `regionGraphDispatch.test.js` at base `ff4077ff2f`.

**Gestures.** The Region Graph handles exactly one pointer gesture: a cytoscape `tap` on a node
(`graphInteractionManager.js:21`).

- It has no double-click, no modifier-click, no right-click, and no tap on an edge (an exit).
- A tap on the player node is ignored.
- Hover only reveals location nodes: `mouseover` on a region, when `locationVisibility` is `'hover'`, its default
  (`:79`). There is no tooltip.
- Drag and dragfree only move location nodes.

**The seven toggles** are the checkboxes in `layoutControlsManager.js:50-74`, saved as `moduleSettings.regionGraph.<key>`
(`:140-146`). Two pairs are mutually exclusive in the UI: add/overwrite path, and one-step/direct.

| Key | Default |
|---|---|
| `movePlayerOneStep` | off |
| `movePlayerDirectly` | **on** |
| `showRegionInPanel` | **on** |
| `addToPath` | **on** |
| `overwritePath` | off |
| `addLocationsToPath` | off (also in the module's settings schema) |
| `checkAllLocationsInRegion` | off |

### Region node — tap (`handleRegionNodeClick`, `:311`)

The steps run in this order:

1. Select the node, and publish `regionGraph:nodeSelected` `{nodeId, data}`.
2. Make **one** move kind, by precedence:
   - `addToPath` on → `actions.addToPath`, one step only if `movePlayerOneStep`, source `regionGraph-addToPath`.
     With an empty path it publishes one `user:regionMove`. Otherwise it walks from the path's end.
   - else `overwritePath` on → `actions.overwritePath`: reset to the start region, then walk. Source
     `regionGraph-overwritePath`.
   - else `movePlayerOneStep` → a one-step move (`regionGraph-oneStep`; or the ⛓ Restart step), **and/or**
     `movePlayerDirectly` → a direct move (`regionGraph-direct`). Both run if both are ticked.
3. If `showRegionInPanel` is on:
   - set the Regions panel's `#show-all-regions` to `!(addToPath || overwritePath)`;
   - publish `ui:activatePanel` (`regionsPanel`) and `ui:navigateToRegion`.
4. If `checkAllLocationsInRegion` is on and discovery allows checks: `RegionGraphBulkCheck` for every unchecked
   location whose own rule passes.

Status-bar texts: "No path to X", "Moving to X (n steps via Y)", "Moving directly to X", "Added n region(s) to path",
"Created path: A → X (n steps)", and "Restart → R (…)".

### Location node — tap (`handleLocationNodeClick`, `:239`)

1. If discovery is on with `disableLocationCheckUI` set, nothing happens.
2. If `addLocationsToPath` is on: the parent region's moves, by the same precedence as a region tap, then
   `gameState.addLocationCheck`. Nothing is dispatched.
3. Otherwise: one `user:locationCheck`, originator `RegionGraphCheck`, `originalDOMEvent: true`, target `bottom`.

### Per mode

| Mode | Region tap | Location tap |
|---|---|---|
| **Normal** | As above | As above |
| **Discovery** | Same actions. A hidden region's node is not drawn, so it cannot be tapped. An undiscovered placeholder (`???`) can be tapped | Refused when `disableLocationCheckUI` is set. A placeholder location's label is `???` |
| **Loop mode** | `regionGraph-*` sources are planning sources (`loops/loopModeExemptions.js`). The strict action gate lets the move through, and `gameState` keeps the path append | The check is a plain `user:locationCheck` (no source tag), so there is no loop-mode special case here |

**An inaccessible location is refused downstream, not by the panel.** The panel dispatches the check. The state
manager then refuses it (`not_accessible`, published as `stateManager:locationCheckRejected`), or, when connected,
the client's `checkGate`. So the refusal does not depend on which panel sent the check.

### Senders and strings

| | Region Graph | Region Map (new) |
|---|---|---|
| Dispatcher senders | `user:regionMove`, `user:locationCheck` (`bottom`, `first`) | the same, registered by `regionMap` (`index.js:45-46`) |
| Event-bus publishers | `ui:activatePanel`, `ui:navigateToRegion`, `regionGraph:nodeSelected` | `ui:activatePanel`, `ui:navigateToRegion`, `regionMap:nodeSelected` |
| `source` | `regionGraph-oneStep` / `-direct` / `-addToPath` / `-overwritePath` | `regionMap-oneStep` / `-direct` / `-addToPath` / `-overwritePath` |
| `originator` | `RegionGraphCheck`, `RegionGraphBulkCheck` | `regionMapCheck`, `regionMapBulkCheck` |

## 2. The mapping — Region Map gesture → the same action

| Region Graph | Region Map | Note |
|---|---|---|
| Tap a region node | Click (pointer down + up, no drag) on a **cell** (`frameAt`), off any square | Acts on `regionOfCell(key, members)`: the cell key when it is itself a rules region (a level), else the group's first member. A hidden cell does nothing. A placeholder cell acts, like a `???` node |
| Tap a location node | Click on a **location square** (`squareAt`, the topmost) | The location's rules region comes from the view (`view.locations.get(name).region`) |
| Tap an exit/edge | — | The Region Graph does not act on edges, so the Region Map's link lines are not clickable either |
| Double-click / modifier-click | — | Neither panel has them |
| Hover a region (reveal locations) | — | The squares are always drawn. The existing cell/square tooltip (step 3b) stays |
| Location-node label | Square tooltip: `name: state`, or **`???`** for a discovery placeholder | The `???` is new in step 4 and copies the Region Graph's label |

A drag of 3 px or more pans and is never a click. That rule is unchanged from 3b.

## 3. What changed

| File | Change |
|---|---|
| `frontend/modules/regionMap/regionMapClicks.js` (new) | The strings (`:22-35`) and `CLICK_OPTIONS_PREFIX` / `CLICK_OPTION_DEFAULTS` / `readClickOptions` (`:38-66`). Also `regionOfCell` (`:72`), `setShowAllRegions` (`:78`) and `statusOf`, which holds the Region Graph's status texts (`:90`). The rest is the Region Graph's logic re-expressed over injectable `actions`: `moveForClick` (precedence, `:112`), `onRegionClick` (`:143`) and `onLocationClick` (`:167`) |
| `frontend/modules/regionMap/regionMapUI.js` | `_onPointerUp` (`:214`) resolves a square first, then the cell; it selects the cell and calls `clickAt` (`:536`). That reads the toggles and the discovery settings (async), then runs the click. `_handles()` (`:519`) supplies the module's own dispatcher and event bus, a `PathFinder`, the game state, the rules, and the Menu panel's restart. A status overlay over the canvas (`_flashStatus`, `:558`) shows the Region Graph's texts for 2 s. The `'???'` tooltip is at `:504`. `getDebugState()` adds `selected`, `clickCount`, `lastClick`, `status` and the squares' `sx, sy`. `setPointerCapture` is wrapped in a try (`:195`) |
| `frontend/modules/regionMap/index.js` | `register()` registers the senders and publishers (`:41-47`). `initialize()` keeps the module's dispatcher and event bus (`:50-54`) in `regionMapSettings.js` `moduleHandles` (`:47`). They are kept there, not in `index.js`, because a UI → index import would be the TDZ cycle |
| `frontend/modules/loops/loopModeExemptions.js` | `|| source.startsWith('regionMap')` (`:33`), plus its docblock |
| `frontend/modules/loops/loopModeExemptions.test.js` | Pins the four `REGION_MAP_SOURCES`, using the module's own constants, as planning sources. Adds `replay-regionMap` to the lookalike-is-play row |
| `frontend/modules/regionMap/regionMapClicks.test.js` (new, 12 rows) | Pins the defaults against `layoutControlsManager.js`'s checkbox list; `readClickOptions`; the region-click precedence, Show-All and bulk check; the location click (default, discovery refusal, add-to-path); the status texts. A real-`regionActions` row checks that every payload equals the Region Graph's byte for byte once the strings are swapped back (the payloads of `regionGraphDispatch.test.js`) |
| `frontend/modules/tests/testCases/regionMapTests.js` | Three in-app rows (§5). `setUp` takes `{rulesPath}` |
| `frontend/modules/tests/testCases/loopsPanelTests.js` | `resetLoopsToIdle` is exported, for the loop-mode row's restore |
| `frontend/test-configs/playwright_tests_config-substrates.json`, `frontend/modules/tests/testBatches.js` | The three roster entries, in the existing categories with no `batch` field; comments updated |
| `docs/json/user/modules/regionMap.md`, `frontend/modules/regionView/README.md` | User doc "Clicking" section; README consumer and planning prefix |

**Not touched:** every `frontend/modules/regionGraph/` file, `regionView/regionActions.js` (no new parameter was
needed), `compositeMapRenderer` (the hit tests are the panel's own `frameAt` / `squareAt`), and the queued
unbounded-grid files.

## 4. Loop mode — the decision

Region Graph clicks **plan** in loop mode, so the Region Map's must too (3b residue 10). `regionMap` is now a
planning prefix in `isLoopModePlanningSource`. Its pin uses `REGION_MAP_SOURCES` itself, so renaming a source turns
the pin red instead of silently making the move count as play.

Nothing else in the tree stamps a `source` beginning with `regionMap` (`git grep -a`). `regionMapCheck` is an
`originator`, which is a different field that the classifier never reads. The in-app row
`region-map-clicks-loop-mode` shows the consumer side: with loop mode on, a Region Map cell click's move is appended
to the path.

## 5. Proof

**D0 — Region Graph byte-identity.** `scripts/dev/region-graph-class-snapshot.mjs`, 3 presets × 6 states (S1–S6) with
the hover sweep. BEFORE was taken with the tree's content equal to base `ff4077ff2f`: the diff against it was empty
while it ran. AFTER was taken at `14ad07d902`. `diff -r` printed nothing: 18/18 dumps identical. Below, the sha256
(first 16 hex) of each preset's six dumps concatenated:

| Preset | BEFORE | AFTER |
|---|---|---|
| `seedling_playthrough` | `7623a7f967aea759` | `7623a7f967aea759` |
| `alttp` | `f8002feb51efada7` | `f8002feb51efada7` |
| `procgen_topdown` AP_1 | `50ab512394e904fd` | `50ab512394e904fd` |

The element counts per state are those in `step2-view-model.md`, for example seedling S1–S6 = 677/680/678/678/678/678.

**In-app rows.** Each row sets its own state, using session-only settings (`ctx.setSetting`, which `restoreSettings`
puts back). A row that checked locations reloads its world, because the state manager's worker has no uncheck
command. Follow-player is turned off so a move does not ease the camera under the next click. Clicks are real
`PointerEvent`s on the canvas.

| Row | Category (batch) | Asserts |
|---|---|---|
| `region-map-clicks-generated` | Region Map (`fast`) | `procgen_topdown` AP_1, by rules path. The hover names a green square. Clicking it checks it. Clicking a reachable region's cell moves the player and selects the cell. Its start reaches no other cell, so the row checks green squares until one opens (7 checks). **The Region Graph panel's own checkboxes change a Region Map click** (below) |
| `region-map-clicks-seedling` | Region Map: Seedling (`playback-bot`) | Check, hover, move. A red square is refused with `not_accessible`, and the Region Graph's own dispatch of the same check (its dispatcher, `RegionGraphCheck`) gets the **same** refusal |
| `region-map-clicks-loop-mode` | Region Map: Seedling (`playback-bot`) | Loop mode is turned on with the Loops panel's own toggle. One reachable level is discovered first, because loop mode shows only discovered levels. A cell click's move (`addToPath`, `regionMap-addToPath`) is appended to the path. Loop mode, the loops state, the path, the player and discovery are all restored |

Local run, all 8 Region Map and Region Graph rows enabled in the substrates roster, port 8142: 8/8 PASSED. That covers
the 4 step-3b rows, the 3 new rows, and `test_region_graph_node_picker`, which is the Region Graph's enabled row and
is unchanged.

**Toggle census — which of the seven the in-app rows exercise:**

| Toggle | In-app | Vitest (`regionMapClicks.test.js`) |
|---|---|---|
| `addToPath` | ON (all three rows' moves) and OFF (the RG-box leg) | ON/OFF, precedence over overwrite |
| `movePlayerDirectly` | OFF → **ON, by clicking the Region Graph's checkbox**, which changes the click from no move to a `direct` move | ON/OFF, both with one-step |
| `overwritePath` | OFF (the RG-box leg) | ON, with `moveOnlyOneStep` |
| `movePlayerOneStep` | OFF (the RG-box leg) | ON, with direct |
| `showRegionInPanel` | ON (default). The rows re-activate the Region Map tab after it | ON (Show All on/off) and OFF |
| `addLocationsToPath` | OFF only | ON: moves, then the path check, with no dispatch |
| `checkAllLocationsInRegion` | OFF only | ON (`regionMapBulkCheck`) and the discovery refusal |

The RG-box leg works through the Region Graph panel's own boxes. It unticks *Add to path*, *Overwrite path*,
*Move one step* and *Move directly*, and each box's own handler saves its setting. A Region Map cell click then moves
nobody. It ticks *Move player directly*, and the same click moves the player. Finally it puts the boxes back by
clicking them, so the Region Graph's DOM and its settings still agree.

## 6. For the mode-toggle discussion (`mode-toggle-ui-discussion`)

Copying the Region Graph exactly needed **no** new control. These are the places where per-panel mode state matters:

1. **One set of toggles drives two panels** (option A). Until the Region Map has its own copy, ticking a box in the
   Region Graph changes what a Region Map click does. With the Region Graph panel closed, its saved settings still
   apply.
2. **Two readers, one source.** The Region Graph acts on its **DOM checkboxes**, which load from the settings when the
   panel mounts. The Region Map reads the **settings**. They agree while the Region Graph panel is the only writer.
   A write from anywhere else, such as a settings editor or a test's session override, changes Region Map clicks at
   once, but Region Graph clicks only after its panel remounts.
3. **"Show region in panel" and "Show All Regions"** activate the Regions panel and set its `#show-all-regions`. That
   is global DOM, shared by both panels. When the Regions panel shares a stack with the Region Map, a Region Map click
   switches the visible tab away from the map. The in-app rows had to switch it back.
4. **Region Graph-only modes with no Region Map counterpart:**
   - `locationVisibility` (hover / zoom / force-show / force-hide). The map always draws squares; its own minimum size
     is `minSquarePx`.
   - The node picker.
   - The layout controls.
5. **A cell is a level, not a rules region.** Seedling folds sub-regions (`level_N__rRcC`) into a level's cell, so a
   cell click targets the level region. A sub-region cannot be targeted from the map today. A mode (or a gesture,
   such as a modifier-click, which neither panel uses yet) could choose between "the level" and "the nearest
   sub-region".
6. **Free gestures.** Neither panel uses double-click, modifier-click or edge/link clicks. A "select only" click (the
   Region Map's step-3b behaviour) is now available only by unticking all of the Region Graph's move boxes and
   *Show region in panel*.
7. **Global modes are read, not owned:**
   - discovery (`enableDiscoveryMode`, `disableLocationCheckUI`, `undiscoveredDisplay`);
   - loop mode.

   Both panels read them the same way, so neither needs a per-panel control for them.

## 7. Not in scope (per the brief)

- Mode-toggle controls.
- The Region Graph's disabled checks and its location-node rebuild bug.
- Source-group placement.
- The custom-world atlas cache.
- The tutorial.
- The Locations/Exits/commonUI duplication.
