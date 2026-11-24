# Region Map — technical reference

`frontend/modules/regionMap/` is region-map step 3b: a canvas panel that composes three earlier pieces and re-derives none of them.
- **Step 1, the art:** `procgenCore/compositeMapRenderer.js` `compositeMapPainterFor` and the Seedling painter (`flashPanel/seedlingCompositeMap.js`).
- **Step 2, the live state:** `regionView/regionViewState.js` `createRegionViewState`.
- **Step 3a, the layout:** `procgenCore/regionLayoutResolve.js` `resolveRegionLayout`.

The as-built report is `CC/docs/region-map/step3b-panel.md`.

## Files

| File | What |
|---|---|
| `index.js` | `moduleInfo` (`componentType: 'regionMapPanel'`), `register()` (the panel, its settings schema, and the clicks' dispatcher senders and event publishers), `getPanelInstances()`. |
| `regionMapSettings.js` | The settings schema (its defaults are the defaults) and the live-panel set. It is a separate module so that `index.js` and `regionMapUI.js` never read each other's bindings while the modules are loading. |
| `regionMapModel.js` | **Pure.** `buildRegionMapModel({rules, player, registry, hookCtx, rule})` returns the layout, then per display region: its members, the region object its painter draws, its extent, and its location tiles. It also returns the links between groups and the locations that are not on the map. |
| `regionMapFrames.js` | **Pure.** `cellFrames(positions, extents, mode)` turns signed layout cells into world-px rectangles. Also `visibleFrames` (the cull), `frameAt` and `tileCentre`. |
| `../procgenCore/mapCamera.js` | **Pure.** The camera math, shared with the labs' set maps: `screen = (world − camera) · zoom + viewport/2`. It has zoom around a point, pan, fit, centring and easing. See [the procgenCore modules table](../procgen/editing-core.md). |
| `regionMapOverlay.js` | **Pure.** The location squares (centred on the tile, never under `minSquarePx`; on a substrate-tiled cell `frameSquares(…, {capToTile})` uses `tiledSquareSide`: capped at the tile, floored at `TILED_SQUARE_FLOOR_PX` (1 px), never skipped), the colour rule (`squareColorKey`), generic square places (`genericLocationTiles`: below the label band `labelBandCentreTiles`, a `size` per square, twice the tile square unless crowded; `legacyGenericLocationTiles` for untiled cells that draw art, chosen by `regionMapModel`'s `usesBigGenericPlaces`), the cell label's geometry (`labelFontPx`, `labelBottomPx`), the door ring's radius (`doorRingRadius`: never wider than its tile, skipped under 1 px), and square hit-testing. |
| `regionMapClickActions.js` | What a click runs (CA-S3): `loadRegionMapClickActions` (the first-run copy), `saveRegionMapClickActions`, the schema entry, `runRegionMapClick` (the selection, the generic event, then `runClickActions`), `withClickHandles`, `regionOfCell`, the originators and event names. |
| `regionMapUI.js` | The panel: its DOM, the settings, the "On click" strip, the camera, pointer input and painting. |
| `regionMapPicker.js` | The "Go to" picker (region-map tutorial, G1): a folded `details.region-map-pick` in the toolbar with a region box and a location box. Choosing calls the panel's `clickCell` (the pointer-up path), then `centreOnRegion`. Lists only drawn cells and their visible locations (`pickableCells`, `pickableLocations`). The Map's twin of `regionGraph/nodePicker.js`: both are wired by `regionView/goToPicker.js` (`setupGoToPicker`); the markup, the lists and what a choice does stay here. |

## Two rates

- **Static.** The model is rebuilt on `stateManager:rulesLoaded` or a grouping change. The frames are rebuilt on a cell-size change. **Nothing static is rebuilt per snapshot.**
- **Live.** The region view recomputes at most once per frame. Each recompute re-colours the squares, applies the discovery hiding and fog, and moves the current-region marker.

The raw rules come from `stateManager/index.js` `getLastRawJsonData()`, since the proxy's static data does not keep `preset_sidecars`.

A custom world's atlas comes from `procgenCore/atlasCache.js` (`hookCtxFor`). Two host doors put one there before the rules load: the Presets panel's bundle (its `region-atlas` member) and a lab page's *Open in APWorld Editor* (the atlas the page hands over beside the rules, filed by `procgenLabPanel`). The in-app row for the second door is `region-map-lab-apworld-door-seedling-set` (`tests/testCases/labApworldDoorTests.js`).

## Painting

- **Only the visible cells are drawn.** `visibleFrames` culls against `viewRect(camera)`.
- **One paint per frame.** Every repaint request is coalesced into one animation frame. That includes pan, zoom, a view change, and a bake landing (the painter's `geom.requestRedraw` is `_onArt`).
- **Each level is baked once,** at 16 px per tile (`BAKE_TILE_PX`, the art's own size), and drawn under a canvas transform. So zooming never re-bakes.
- **A display group is drawn as its whole level, undimmed.** The cell's region object carries the display key and the representative member's payload *minus* `atlas_sub_region`, with no `exits` (so no edge squares are drawn). The Seedling painter then draws the level unmasked, from the same bake its sub-regions share.
- **A region with no sidecar** (a classic AP world) is a generic box with its name. A region whose substrate declares no painter gets `drawGenericRegion`.

## Substrate hooks it reads (all through the registry; no substrate is named)

- `compositeMap.drawRegion` — the art.
- `compositeMap.displayRegionOf` — the sub-region fold. Both the layout and the view use it.
- `compositeMap.layoutGraph` — step 3a's layout.
- `compositeMap.regionExtent(region, ctx)` → `{w, h}` tiles (**new in 3b**). Without it the cell is `DEFAULT_EXTENT`, and its squares go on generic places.
- `compositeMap.locationTiles(region, ctx)` → `[{location, x, y, kind}]` level tiles.
- `compositeMap.remoteLocationTiles(region, ctx)` → `[{location, displayRegion, x, y, kind}]` (**new in 3b**): locations whose tile is in another level.

The rows for these hooks are in `docs/json/developer/procgen/substrate-registry.md` § *Entry contract*.

## Clicks (the click-action registry)

A click (a pointer down and up with no drag) on a visible cell runs `clickCell(frame, square)`: it selects the cell, then `clickAt(frame, square)` runs the panel's click actions. The "Go to" picker (`regionMapPicker.js`) calls the same `clickCell`, so a choice there IS a click (pinned by `region-map-go-to-equals-canvas-click`). A location square under the pointer (`squareAt`) makes it a **location** click; anywhere else in the cell is a **region** click on `regionOfCell(key, members)`.

- **The registry.** `runRegionMapClick` calls `regionView/clickActions.js` `runClickActions('regionMap', target, ctx, settings, h)`, in the R8 order: path, then checks, then panel actions. The settings are the panel's own `clickActions`, as held in memory when the click lands. The discovery settings are read at click time (`readDiscoverySettings`); they gate the checks (`disableLocationCheckUI`).
- **The handles** (`_handles()` + `withClickHandles`): this module's dispatcher and event bus (registered in `index.js`), the Map's originators (`regionMapCheck`, `regionMapBulkCheck`), and the Regions panel's *Show All Regions* turned off before a path edit runs.
- **Sources.** A path move goes out with `source: 'regionView-path-regionMap'` (`pathSourceFor`), which `loops/loopModeExemptions.js` classifies as planning. Step 4's `regionMap-*` sources are no longer sent; the prefix stays classified for older callers.
- **The status overlay** shows the route's text (`clickActions.clickStatusOf`) for 2 s.
- **DOM readouts for a tutorial step** (which reads the DOM, never the instance): `canvas.dataset.squares` is the number of squares the last paint drew; the Region Graph's root carries `data-centred-on` / `data-centred-at` after `regionGraph.centre` centres it (`regionGraph/regionGraphCentreAction.js`), written when the camera actually moves.
- **A centre asked of a hidden panel** (G4: its tab is not the active one, so the canvas is 0×0) is kept and applied when it is shown: `centreOnRegion` keeps `_pendingCentre` and `_resize` applies it once the viewport has a size; on the Graph, `centreGraphOn` keeps `pendingCentreOn` and `onPanelShow` centres on it in place of its `fit(30)`. The last one asked wins; a rebuild that no longer draws it drops it; neither action ever shows a tab.
- **The strip** (`regionView/clickActionsUI.js` `mountClickActionsStrip({ panelId: 'regionMap', … })`) is the first row of the panel, above the toolbar. Its save writes `moduleSettings.regionMap.clickActions` only. A write of that key reloads the click actions and re-renders the strip; it re-reads no view setting, repaints nothing and rebuilds nothing.

**Settings.** `moduleSettings.regionMap.clickActions` has the same shape as the Region Graph's (`regionView/README.md` § Click actions). Its schema default is `defaultClickActions()`. It is in the schema but not in `REGION_MAP_SETTING_DEFAULTS`: the view-settings loop does not read it.

**The first run copies the Region Graph's config** (`loadRegionMapClickActions`, ⚖ R4). While the Map's key has never been written (`settingsManager.hasStoredSetting`; `getSetting` cannot tell, because the schema default always answers), the Map takes what `regionGraph/clickActionsSettings.js` `loadRegionGraphClickActions` resolves:
1. the Graph's stored or preset `clickActions`;
2. else the migration of the old `regionGraph.*` click keys (the loader saves that as the Graph's too);
3. else the defaults.

It saves a deep copy once as the Map's. A stored Map value is never overwritten, and a second load writes nothing. After that the two panels are independent. The Map's location choice is its own (since CA-S4 no strip mirrors `addLocationsToPath`). The copy leaves out the CA-S4 panel-owned actions (`withoutPerPanelInitials`): the Map's strip seeds its own first values, all off (⚖ user 2026-11-20T16:29:00Z: the Map's Flash teleport starts OFF).

**Events.** Every click publishes, on this module's bus:
- a region click: `regionView:regionClicked` `{ panelId: 'regionMap', regionName }`;
- a location click: `regionView:locationClicked` `{ panelId: 'regionMap', regionName, locationName }`.

They are published before any action, and also when the ⏸ master switch is off. They are registered as publishers in `index.js` `register()`. The `regionView:*` pair is the generic click event of the mode-toggle design (§4.3); the Region Graph publishes it too (since CA-S4), with `panelId: 'regionGraph'`. CA-S5 retired `regionMap:nodeSelected`, which a region click published first until then: nothing heard it.

## Cell sizes

- **`'level'`, the default.** One world tile scale (`WORLD_TILE_PX` = 16). The layout cells are anchors: each signed column is as wide as its widest level, and each row as tall as its tallest, plus `GUTTER_PX`.
- **`'uniform'`.** Each cell is one square of `UNIFORM_SIDE_TILES`. Each level is scaled to fit it and letterboxed.
- **In both modes,** an empty layout column or row (the gap between groups) is `GAP_PX`.

## The colour rule (`squareColorKey`)

- A checked location is grey.
- If the location's region shows **no** colour (`regionColorState` is null: the accessibility filter is off, or discovery hides an undiscovered region's reachability), the square is light grey. It is never green or red then, just as the Region Graph shows no reachability colour there.
- Otherwise the square is green when the location's rule passes and its region shows accessible, and red when it does not.

## Tests

- **Vitest:**
  - `regionMap/regionMap.test.js` covers frames, the cull, the camera, squares and colours, the settings, and the model over three presets. Every count is derived from the preset itself.
  - `regionMap/regionMapSquaresRings.test.js` pins the three squares-rings rules: no generic square under the cell label over a zoom sweep (and placed as if the label were there below 60 px), the door ring's outer diameter ≤ its tile at every zoom (capped zoomed in, skipped zoomed out), and the doubled / shrink-to-fit generic squares (inside the cell, no overlap, clicks hit), plus the art-cell switch.
  - `regionMap/regionMapTiledSquaresCap.test.js` pins the tiled-squares cap: over a zoom sweep (both cell modes, three `minPx`) a tiled square is ≤ its tile (a 1 px dot under a 1 px tile), equals the uncapped side wherever that was ≤ the tile, and keeps its centre; the panel's `_drawSquares` draws every square, and a click at a capped square's centre hits it.
  - `regionMap/regionMapClickActions.test.js` covers the first-run copy (all three sources, idempotent, a stored Map value kept), independence, the events and the schema.
  - `regionMap/regionMapClicks.equivalence.test.js` measures the adopted click path against step 4's reader, kept verbatim as `legacyRegionMapClicks.testkit.js`.
  - `regionMap/regionMapPicker.test.js` covers the Go-to picker's lists (drawn cells, visible locations) and that a choice calls `clickCell` with the cell's frame (and `{ location }` for a square), then centres. `regionMap/regionMapPicker.markup.test.js` pins the markup byte for byte (by digest) and the focus refresh, a blank box and a click that throws.
- **In-app** (`tests/testCases/regionMapTests.js`):
  - Category **Region Map** (fast batch): `region-map-classic-world`, `region-map-clicks-generated`, `region-map-click-default`, `region-map-click-master-off`, `region-map-click-location-check`, `region-map-go-to-equals-canvas-click` and `region-map-click-settings-independent`.
  - Category **Region Map: Seedling** (playback-bot batch, on push): `region-map-seedling-paints`, `region-map-follow-player`, `region-map-discovery`, `region-map-clicks-seedling`, `region-map-clicks-loop-mode` and `region-map-custom-set-atlas`.

  The rows read `getDebugState()`, never pixels.
- **Screenshots:** `scripts/dev/shot-region-map.mjs --port=<p> --out=<dir>`.
