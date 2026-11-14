# Region Map step 1: a Seedling cell painter for the composite map

Session `region-map-seedling-painter` (Opus), 2026-11-14. Planner: archipelago-cc-23. Reviewer and landing:
seedling-js-planning-19.
- Branch `region-map-seedling-painter`, cut `--with-wasm` at base `44beef6a1d7721705d382a0df596dc1beac9e4c7`.
- Code tip `537fd474c1` (two commits); this report is the last commit.

⚖ The user's GO and the agreed side effect (2026-11-14, archipelago-cc-23):
- *"I agree to that side effect. Though if it's easy to implement, we could set up an option to switch between the old
  view and the new view."*
- Standing ruling (2026-09-04): *"each substrate declares whether it supports map rendering … I don't want to hardcode
  support for map rendering for specific substrates."*

## What landed

Since this change, Seedling regions on the APWorld Editor's **Map** tab and on the Procgen Pipeline panel's map show
their level, drawn by the JS Seedling renderer, instead of a generic box labelled `(flash_seedling)`.

### D1: the level-only baker (`seedlingDemo/seedlingLevelBake.js`)

The new module sits beside its real inputs and has **no `mazeRoom/` imports**:
- `levelRecordFor` / `levelWorldFor` (:49 / :55): one patched record and one built world per (map document, level).
  The maze skin and the composite map share this cache, so the renderer's tile-op cache (keyed on the world object)
  hits for both.
- `recordWorldOf` (:65): one built world per free-standing record (a generated room).
- `levelStaticOps` (:86): the tick-0 draw list. It is the old `mazeSeedlingSkin.staticOps` body, with the maze census
  replaced by an `excluded` id set (empty = the whole room).
- `stairsOps` (:72): moved here unchanged.
- `bakeLevel` (:134): takes a record and an injected `newCanvas(w, h)`, and returns a canvas of
  `record.width × cellPx` by `record.height × cellPx`, cleared to `#101014`.
- **Art loader: option 2.** `loadSeedlingArt` (:105) moved here, and `mazeSeedlingSkin` re-exports it, so both readers
  share one load per page and the flashPanel painter never imports `mazeRoom/`.

`mazeRoom/mazeSeedlingSkin.js` is now the maze half only:
- `levelWorldFor` (:60) keeps its size check and its own error messages, then calls the baker's cache.
- `staticOps` (:119) is `levelStaticOps(…, {excluded: censusEntityIds(census)})`.
- `bakeSeedlingLayer` (:153) calls `bakeLevel`, then paints the edited tiles in the maze palette as before.

**Maze inertia:**
- `git diff --diff-filter=MDR --name-only 44beef6a1d HEAD | grep -aE 'fixtures/|golden'` is **empty**.
- The maze Seedling suites are green before and after: `mazeSeedlingSkin` (goldens L0/L4/L12), `mazeBlockKindArt`,
  `mazeSeedlingArtEdit`, `mazeLiveMarkers`, `mazeSeedlingSprites` and `mazeRoomRender`.
- `seedlingLevelBake.test.js` § 2 pins the wrapper directly. `staticOps` over a maze world equals `levelStaticOps` with
  the census excluded, both `levelWorldFor`s return the same world object, and `loadSeedlingArt` is one function.

**New fixtures/goldens:** `frontend/modules/seedlingDemo/fixtures/level-bake-goldens/L0.txt`, `L4.txt` and `L36.txt`.
They pin the whole-level draw list (frame choice at tick 0, nothing excluded), the way `fixtures/skin-goldens/` pins
`roomOps`.

### D2: the level a region shows (`flashPanel/seedlingCompositeMap.js`)

`seedlingLevelSourceOf(payload, source)` (:62) is the one resolver. It reads the payload only, never a preset name or
a region name:
- **A generated room:** `playable_payload.record` → `{kind: 'record', record}`.
- **An atlas region:** `playable_payload.level` → `{kind: 'atlas', levelIndex, mapPath}`, where `mapPath` comes from
  `mapDocumentPath(rules, playerId)`. A slot that names its own `region_atlas[p].map_document` gets that document,
  which is the custom-world case; with no source, it gets `seedling-map.json`.

`resolveSeedlingLevel(source, mapDoc)` (:84) then gives `{record, levelIndex, mapDoc?}`, through `patchedMapDocument`.

It is pinned on three presets (`seedlingCompositeMap.test.js` § 1):

| Preset | What it exercises | Result |
|---|---|---|
| `seedling_playthrough` | atlas, sub-regions | all 266 regions resolve; 115 distinct levels |
| `seedling_generated_room` | embedded record beside maze cells | 2 `record` sources; the maze cells resolve to `null` |
| `seedling_spiral_room` | atlas + `grid_cell` | atlas region `overworld_start` (not `level_N`), sub-region `r8c0` |

### D3: the painter and the registry declaration

**Declaration.** `flashSeedlingLibrary.js:862` and `flashSeedlingGenLibrary.js:550` each declare
`compositeMap: Object.freeze({drawRegion, artwork: true, locationTiles, displayRegionOf})`.
- The flash_seedling hook passes the two atlas documents the library already imports (`KNOWN_ATLASES`, :87).
- Both libraries stay node-importable. The generator reports *"0 library/libraries NOT loadable headless"*, and
  `seedlingCompositeMap.test.js` § 4 imports both with no `document`.

**The async-redraw design** (`createSeedlingCompositePainter`, :226):
1. `drawRegion` (:315) is synchronous. It resolves the source and looks up the bake `${sourceKey}@${cellW}x${cellH}`.
   - The source key is `atlas:<mapPath>#<level>`, or `record:<JSON>` for a generated room. Keying on content means a
     re-deserialized copy is still a hit, so a host that rebuilds its grid on every render cannot loop.
2. **On a miss** it draws `drawGenericRegion` (exactly the old cell), queues the bake and remembers the host's
   `geom.requestRedraw`.
3. **Bakes are lazy and capped** (`pump`, :267). Only cells that were drawn are baked, at most `concurrency = 2` are
   in flight, and each starts in its own macrotask.
   - `runJob` (:275) awaits the art (`loadSeedlingArt`) and the map document (fetched once per path).
   - It bakes at `cellPx = clamp(ceil(fit), 1, 16)` pixels per tile, so a bake is never larger than the cell needs.
4. **The redraw is coalesced.** When a bake lands, `askRedraw` (:261) moves its waiters into one set and arms one
   animation frame. `flushRedraws` (:251) then calls each host callback once.
5. **On a hit**, the cell is drawn like this:
   - it is filled with `#101014`;
   - the baked level is drawn scaled to fit `regionSize × tilePx`, with its aspect ratio kept and centred
     (`imageSmoothingEnabled = false`);
   - the exit squares go on top (`resolveExitTilePositions`, the same positions the renderer's connection lines use).
6. **Failure.** A failed bake keeps the generic box, is never retried, and is listed in `stats().failures`.
7. **No callback.** With no callback nothing throws; the cell stays generic until the host redraws.

**Renderer plumbing** (`procgenCore/compositeMapRenderer.js`):
- `drawCompositeMap` gains `source` and `onCellArtReady` (:427), handed to every painter as `geom.source` /
  `geom.requestRedraw` (:446).
- Both callers repaint **their canvas only**, never the tab or panel, and skip a canvas a later render replaced:
  - `apworldEditorUI._renderMapTab`: `paint` (:4917), wired at :4923;
  - `procgenPipelineUI._drawGrid`: :4003, with `_mapSource()` (:4013) giving the loaded preset's or the last run's
    `{rules, playerId}`.

**Sub-region decision: the WHOLE level, with every tile outside the sub-region dimmed** (`maskedCanvas`, :296;
`subRegionTiles`, :100, over `seedling-subregion-partition.json`).
- Showing the level's tiles only would cut the room off from its context.
- An undimmed whole level would draw several identical cells for one level.
- Dimming is the simplest choice that is not misleading, and one bake serves every sub-region of a level: 266 regions
  → 115 bakes.

**Exit squares** are drawn on top; the exit lines stay the renderer's.

### `locationTiles` coverage (items / events)

`seedlingLocationTiles(region, {rules, playerId, atlases})` (:136) returns `[{location, x, y, kind}]` in level tiles.
`unplacedSeedlingLocations` (:165) names the residue.

Over `seedling_playthrough`, all 88 rules locations are accounted for (`seedlingCompositeMap.test.js` § 2):

| Kind | Source | Placed |
|---|---|---|
| item | the payload's atlas `locations[].tile`, matched by name | **48 / 48** |
| event | `obstacle: {x, y}` pixels ÷ 16 | **37 / 40** |
| generated room | its payload's `locations[].cell` | all (the `seedling_generated_room` pin) |

**Residue: 3 events.** Each is listed on the region that triggers it, but its object is in another level, so it has no
tile in the region's own level:
- `L39 flag 8: wandlock@144,592 cleared` (listed on `level_38`);
- `L63 flag 1: lightpole@64,88 cleared` (on `level_61__r0c10`);
- `L62 flag 0: lightpole@120,200 cleared` (on `level_63__r0c1`).

`displayRegionOf(regionName, sidecar)` (:120) folds `level_N__rRcC` onto `level_N` through the payload's
`atlas_region`, not the name. Every `seedling_playthrough` region and the spiral's `overworld_start` are pinned.
- ⚠ It is a display key. A level split into sub-regions has no `level_N` region in the rules.

## The toggle (D4)

- `compositeMap.artwork: true` on both Seedling declarations.
- `drawCompositeMap(…, {substrateArt})` defaults to `true`. With `false`, `drawRegionCell` (:334) skips every painter
  for which `compositeMapDrawsArtwork` (:328) is true, and those cells get the generic box. Maze and text-adventure
  painters are unaffected; this is pinned on toy painters in `compositeMapRenderer.test.js`.
- **One "Substrate art" checkbox** (`substrateArtToggle`, :203) on each map:
  - `.apworld-map-substrate-art` in the Map tab's bar;
  - `.procgen-pipeline-substrate-art` above the pipeline canvas.

  Each canvas carries `data-substrate-art`.
- **Its state is kept in memory, per panel** (`this._substrateArt`), **not as a setting.** A module setting would need
  a schema in two modules, the settings panel and the storage census entry, so it is not "trivial". The toggle stayed
  a small change.
- **Measured: unchecked is pixel-identical to BEFORE** on both panels for both presets (table below).

## Before / after evidence

Screenshots are in `CC/docs/region-map/step1-shots/`. They were taken headless against this tree on :8130 (after) and
against a scratch copy of `frontend/` with the base versions of the changed files on :8131 (before). The RGB
difference is against the before picture:

| Preset · panel | after, art ON | after, art OFF |
|---|---|---|
| `seedling_spiral_room` · Pipeline | differs only in the Seedling cell, bbox (2,2)–(113,85) | **identical** |
| `seedling_spiral_room` · APWorld Map | differs only in the Seedling cell, bbox (1,1)–(112,84) | **identical** |
| `seedling_generated_room` · Pipeline | differs only in the 2 Seedling cells, bbox (2,2)–(141,281) | **identical** |
| `seedling_generated_room` · APWorld Map | differs only in the 2 Seedling cells, bbox (1,1)–(140,280) | **identical** |

**`seedling_playthrough` draws no map on either panel, before or after.**
- Its sidecars carry no `grid_cell`, so the Map tab prints *"No map for this world (no grid data in the sidecars)"*
  (`seedling_playthrough-apworld-after-nomap.png`) and the pipeline prints *"Click Generate to run the pipeline."*
- Laying it out is step 3's work. Its painter cost is measured below on a synthetic grid instead.

**Time from map open to the last redraw** (headless Chromium; the first Seedling cell drawn → the last host redraw):

| Preset | Pipeline opened first | APWorld Map opened first |
|---|---|---|
| `seedling_spiral_room` (1 cell) | 1,393 ms | 1,407 ms |
| `seedling_generated_room` (2 cells) | 1,300 ms | 1,424 ms |
| `seedling_playthrough`, all 266 regions on a synthetic 17-column grid, in-page `drawCompositeMap` | 6,201 ms | — |

- Both small presets include the first load of the art; the spiral room's also includes the 976 KB map document.
- The second panel opened is a cache hit and draws at once.
- `seedling_playthrough` stress run: 115 bakes, 0 failures, first paint 112 ms, 99 coalesced repaints at about 22 ms
  each of a 4760×4480 canvas.

## Moved pins

**None.** No existing test assertion changed:
- the 21 gate files read 479/479 before and 479/479 after the code change;
- the new rows were added in new files, or appended in `compositeMapRenderer.test.js`'s new describe block.

The generated docs moved, as intended, through their own generator:
- `procgenDocs/generated/registry.js` gains the three new `compositeMap.*` rows (105 fields).
- `capabilities.js` and the `procgen-substrates.md` chart flip **P3** ("It draws its own picture on the composite map")
  to ✓ for `flash_seedling` and `flash_seedling_gen`.
- `docsIndex.js` and the procgen README region changed by word count only.

## Gates

**Bounded vitest** (⚖ 52), `npx vitest run <paths> --maxWorkers=3`:

| Run | Files | Tests | Result |
|---|---|---|---|
| BEFORE (base tree) | 21 | 479 | green |
| After the code change, same 21 files | 21 | 479 | green |
| AFTER, the full bounded set | 36 | 1,063 | green |

- **The 21 gate files:** `compositeMapRenderer`, `compositeMapDocument`, `procgenPipelineUI`, `flashSeedlingLibrary`,
  `flashSeedlingGenLibraryItems`, `mazeRoomLibrary`, the maze Seedling-skin tests (`mazeSeedlingSkin`,
  `mazeBlockKindArt`, `mazeSeedlingArtEdit`, `mazeLiveMarkers`, `mazeSeedlingSprites`, `mazeRoomRender`),
  `seedlingSkinRenderer`, `substrateCapabilities`, `exitSides` ×2, `regionGeometry`, `seedlingGenRoomGrowth`,
  `textAdventureCompositeMap`, and `procgenDocs/` `docLinks` + `docsRender`.
- **The AFTER set adds:**
  - the two new test files;
  - all 8 `procgenDocs/*.test.js`;
  - `scripts/procgen/lintGateLabels.test.js` and `ciDocsOnly.test.js`;
  - `apworldEditor/regionRoundTrip.test.js` and `menuMarker.test.js`;
  - `flashSeedlingGen`, `flashSeedlingContentSource` and `seedlingAtlasHostWorld`.
- `procgenCore/bindingContract.test.js`: 124/124. `procgenCore/` still imports no `mazeRoom/`, `seedlingDemo/` or
  `flashPanel/`.
- `storagePanel/storageCensus.test.js` is not run: the toggle persists nothing.

**Generators and doc checks:**
- `node scripts/procgen/generate-procgen-reference.mjs` (write), then `--check`: *"ALL 7 GENERATED MODULES AND 5
  MARKDOWN REGIONS MATCH THE CODE"*, 0 findings.
- `node scripts/procgen/check-procgen-docs.mjs --host=http://localhost:8130`: *ALL CHECKS PASSED*.

**In-app**, `npm test -- --port=8130 --mode=test-substrates --batch=<b>` on this tree.

| Batch | Result |
|---|---|
| `apworld` | **142/142** |
| `feature-checks` | **7/7** |
| `tutorials-procgen` | **9/9** |

- **`apworld` passed on its second run.** The first run (22:22Z) never started its roster: *"Timeout waiting for tests
  to start"*, with the machine at load 20.13 across 16 CPUs. The rerun at load 3.7 was 142/142. The only console error
  in the failed run was a 404 for optional `customData/*_textadventure.json` files, unrelated to this change.
- **Rows found that draw a Seedling composite map** (grep of the substrates config + tutorial content):

  | Batch | Rows | Result |
  |---|---|---|
  | `feature-checks` | `feature-check-region-edit-seedling-generated`, `-seedling-real-game`, `-apworld-editor`, `-maze-lab-closed` | green here |
  | `tutorials-procgen` | `tutorial-walk-procgen-seedling`, `-mixed-world` | green here |
  | `tutorials-procgen-loops` (WebGPU, manual) | `tutorial-walk-procgen-loop-mode-everything` | dispatched to CI only |
  | `fast` | `procgen-pipeline-seedling-gen-edit-round-trip` | runs in TT |

**CI push runs at the code tip `537fd474c1`:**

| Run | Workflow | Result |
|---|---|---|
| 43647722083 | `unittests` | success |
| 43647722210 | JSUT | suite **27,410 passed / 0 failed** (3 shards); slow battery **437/437** (per `ci-vitest-summary.mjs`) |

**CI dispatches** at the final tip (this report's commit), each with `-R PeerInfinity/Archipelago-CC --ref
region-map-seedling-painter`: TT, `test-substrates-manual` with `batch=apworld`, `feature-checks`, `tutorials-procgen`
and `tutorials-procgen-loops`. The run ids and head SHAs are in the hand-off message to archipelago-cc-23 and
seedling-js-planning-19. Recording them here would move the tip they were dispatched at.

**Packet facts:**
- **0 gitlinks:** `git diff --raw 44beef6a1d HEAD` has no `160000` entry.
- **Nothing under `frontend/modules/shared/` or `mazeRoom/mazeRoomEngine.js` changed.**
- **Closure ∩ diff = ∅:** `grep -axFf closure.txt` over the diff's file list gives 0 lines. The diff's files:
  - **docs:** `docs/json/developer/procgen/{README,substrate-registry}.md`, `docs/json/features/procgen-substrates.md`,
    `docs/json/modules/apworldEditor.md`;
  - **apworldEditor/:** `apworldEditorUI.js`;
  - **flashPanel/:** `flashSeedlingGenLibrary.js`, `flashSeedlingLibrary.js`, `seedlingCompositeMap{,.test}.js`;
  - **mazeRoom/:** `mazeSeedlingSkin.js`;
  - **procgenCore/:** `compositeMapRenderer{,.test}.js`;
  - **procgenDocs/generated/:** `{capabilities,docsIndex,registry}.js`;
  - **procgenPipeline/:** `procgenPipelineUI.js`;
  - **seedlingDemo/:** `fixtures/level-bake-goldens/L{0,4,36}.txt`, `seedlingLevelBake{,.test}.js`;
  - **this report and `CC/docs/region-map/step1-shots/*.png`.**

## Overlap answer (concept-library-content-planning-2, 2026-11-14)

> No: as designed, S2 (the maze information tile) touches neither mazeSeedlingSkin.js nor compositeMapRenderer.js. S2
> hasn't started yet; it begins after S1 (running now) lands. Its planned files are new mazeRoom/mazeThings.js and
> mazeThingOverlay.js, plus edits to mazeContent.js, mazeRoomLibrary.js, mazeSerializer.js, mazeRegionRoundTrip.js,
> mazeRoomUI.js and mazeTileArt.js. One possible overlap: R5 noted that mazeCompositeMap.js draws concept gates as their
> skin, with no tile-art seam. S2 isn't planned to add one there. If that changes, I'll check with you first. When S2
> launches, its brief will tell it to rebase onto your landed changes.

## Residue for steps 2–3

1. **`seedling_playthrough` has no layout.** Step 3's layout (`canonicalLayout`-style, or the generic fallback) is what
   puts it on a map. The painter itself is ready and measured over all 266 regions.
2. **Redraw cadence at scale.** 115 bakes produced 99 full repaints of a 4760×4480 canvas, at most one per frame, as
   asked. A viewer with zoom/pan (step 3) should repaint only the visible cells, or widen the coalescing window.
   `requestRedraw` already carries no cell, so either works without a painter change.
3. **Per-region cell size.** The painter fits whatever `regionSize × tilePx` it is given and keys bakes on the cell
   size, so a non-uniform cell needs no painter change. A 5×5 level beside a 60×58 one still renders about 12× larger
   per tile in a uniform cell (plan open item).
4. **`locationTiles` residue:** the 3 cross-level events above. The obvious rule is to place each in the level that
   holds its object; that is a step-3 display decision.
5. **`locationTiles` for an atlas the library does not ship.** Item tiles come from `KNOWN_ATLASES`, the two atlas
   documents `flashSeedlingLibrary` imports. A custom atlas id would need the atlas index fetch (`atlasPathInIndex`).
   Today every committed preset uses one of the two.
6. **`displayRegionOf` keys are not rules regions** for split levels. Step 2's fold has to treat `level_N` as a display
   group, not look it up in `regions`.
7. **Exit squares sit on the cell's edge by `side`,** where the renderer's lines expect them, not at the door's real
   tile in the level art. A Region Map that wants the real door tile can read `exit_tiles` (level tiles) from the
   payload.
8. **The toggle is not persisted.** If the user wants it to survive a reload, it becomes a module setting plus a
   storage census key, a separate small slice.
