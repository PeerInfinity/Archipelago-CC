# Region Map — technical reference

`frontend/modules/regionMap/` is region-map step 3b: a canvas panel that composes three earlier pieces and re-derives none of them.
- **Step 1, the art:** `procgenCore/compositeMapRenderer.js` `compositeMapPainterFor` and the Seedling painter (`flashPanel/seedlingCompositeMap.js`).
- **Step 2, the live state:** `regionView/regionViewState.js` `createRegionViewState`.
- **Step 3a, the layout:** `procgenCore/regionLayoutResolve.js` `resolveRegionLayout`.

The as-built report is `CC/docs/region-map/step3b-panel.md`.

## Files

| File | What |
|---|---|
| `index.js` | `moduleInfo` (`componentType: 'regionMapPanel'`), `register()` (the panel and its settings schema), `getPanelInstances()`. It also notes for step 4 what loop mode will need. |
| `regionMapSettings.js` | The settings schema (its defaults are the defaults) and the live-panel set. It is a separate module so that `index.js` and `regionMapUI.js` never read each other's bindings while the modules are loading. |
| `regionMapModel.js` | **Pure.** `buildRegionMapModel({rules, player, registry, hookCtx, rule})` returns the layout, then per display region: its members, the region object its painter draws, its extent, and its location tiles. It also returns the links between groups and the locations that are not on the map. |
| `regionMapFrames.js` | **Pure.** `cellFrames(positions, extents, mode)` turns signed layout cells into world-px rectangles. Also `visibleFrames` (the cull), `frameAt` and `tileCentre`. |
| `../procgenCore/mapCamera.js` | **Pure.** The camera math, shared with the labs' set maps: `screen = (world − camera) · zoom + viewport/2`. It has zoom around a point, pan, fit, centring and easing. See [the procgenCore modules table](../procgen/editing-core.md). |
| `regionMapOverlay.js` | **Pure.** The location squares (centred on the tile, never under `minSquarePx`), the colour rule (`squareColorKey`), generic square places, and square hit-testing. |
| `regionMapUI.js` | The panel: its DOM, the settings, the camera, pointer input and painting. |

## Two rates

- **Static.** The model is rebuilt on `stateManager:rulesLoaded` or a grouping change. The frames are rebuilt on a cell-size change. **Nothing static is rebuilt per snapshot.**
- **Live.** The region view recomputes at most once per frame. Each recompute re-colours the squares, applies the discovery hiding and fog, and moves the current-region marker.

The raw rules come from `stateManager/index.js` `getLastRawJsonData()`, since the proxy's static data does not keep `preset_sidecars`.

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

## Cell sizes

- **`'level'`, the default.** One world tile scale (`WORLD_TILE_PX` = 16). The layout cells are anchors: each signed column is as wide as its widest level, and each row as tall as its tallest, plus `GUTTER_PX`.
- **`'uniform'`.** Each cell is one square of `UNIFORM_SIDE_TILES`. Each level is scaled to fit it and letterboxed.
- **In both modes,** an empty layout column or row (the gap between groups) is `GAP_PX`.

## The colour rule (`squareColorKey`)

- A checked location is grey.
- If the location's region shows **no** colour (`regionColorState` is null: the accessibility filter is off, or discovery hides an undiscovered region's reachability), the square is light grey. It is never green or red then, just as the Region Graph shows no reachability colour there.
- Otherwise the square is green when the location's rule passes and its region shows accessible, and red when it does not.

## Tests

- **Vitest:** `regionMap/regionMap.test.js` covers frames, the cull, the camera, squares and colours, the settings, and the model over three presets. Every count is derived from the preset itself.
- **In-app** (`tests/testCases/regionMapTests.js`):
  - Category **Region Map**: `region-map-classic-world` (fast batch).
  - Category **Region Map: Seedling** (playback-bot batch, on push): `region-map-seedling-paints`, `region-map-follow-player` and `region-map-discovery`.

  The rows read `getDebugState()`, never pixels.
- **Screenshots:** `scripts/dev/shot-region-map.mjs --port=<p> --out=<dir>`.
