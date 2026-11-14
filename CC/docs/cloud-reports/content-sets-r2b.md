# Content sets R2b: a pack can supply the maze's tiles (images, then shapes)

Slice R2b of the content-sets arc. Branch `content-r2b`, based on `origin/main` `cf4d9a6874` (not on R2: R2 is
being reworked, and nothing here needs it).

- **Part 1 (images):** `2fe1305bf8`.
- **Part 2 (shapes):** `844e681620`.
- **This report:** the commit after Part 2.

The rulings it implements (⚖ the user, 2026-11-11):

- No art library may need an image file for every entry. When art is missing, the maze draws as if there were no
  library.
- Both images and shapes are supported, images first.
- Later packs replace earlier ones per id, using the system that already exists for that: the pack stack.

## 1. The key table

`frontend/modules/mazeRoom/mazeTileArt.js`, `MAZE_ART_KEYS`: one `maze:*` art key per thing that the plain painter
draws in a `COLORS` colour. This table is the maze's declaration of what art it can show. It is documented in
`docs/json/developer/procgen/maze.md` § *Tile art from a content pack*.

| Thing | Key | `COLORS` it replaces | Drawn today as (the fallback) |
|---|---|---|---|
| `floor` | `maze:tile/floor` | `floor` | base-layer fill |
| `wall` | `maze:tile/wall` | `wall` | base-layer fill |
| `exit` | `maze:tile/exit` | `exit` | an OPEN exit's fill (a closed exit stays `exitBlocked`) |
| `entrance` | `maze:tile/entrance` | `entrance` | a 2 px border |
| `manaTile` | `maze:tile/mana` | `manaTile` | a diamond labelled M (the art fades at 0.25 once collected, as the diamond does) |
| `player` | `maze:character/player` | `player` | a disc (the facing tick is drawn over it either way) |
| `trap` | `maze:object/trap` | `trap` | an arrow trap's strip (its lane stays the armed/silent tint) |
| `block` | `maze:object/block` | `block`, `blockEdge` | the walked square |
| `blockStruck` | `maze:object/block-struck` | `blockStruck`, `blockEdge` | the struck square |
| `blockDormant` | `maze:object/block-dormant` | `blockDormant`, `blockEdge` | the dormant disc |
| `button` | `maze:object/button` | `button` | a ring (up) |
| `buttonDown` | `maze:object/button-down` | `button` | a filled ring (down) |
| `pulser` | `maze:object/pulser` | `pulser` | the body disc (its ring stays the armed/silent signal) |
| `pull` | `maze:object/pull` | `pullTrap`, `pullMouth` | the trap cell's disc + mouth (its disc tint stays live/inert) |

These `COLORS` keys get no art key; they are state signals and edges: `exitBlocked`, `locationBlocked`, `grid`,
`laneArmed`, `laneSilent`, `pullLive`, `pullInert`, `pullMouth` (it rides with `pull`) and `blockEdge` (it rides with
the blocks). `mazeTileArt.test.js` states this list independently and holds the table against `COLORS`. A `COLORS`
key added later reds the test until it is given to a thing or to the list.

## 2. The seam and its fallback

`drawTileArt(ctx, tileArt, thing, dx, dy, dw, dh)` draws the key's frame 0, scaled to the cell, and answers `true`.
Otherwise it draws nothing and answers `false`. "Otherwise" covers three cases: no art loaded, the key absent from the
stack, and the sheet not decoded (`tileArtFrame` checks the key and the decoded image).

`drawWorld` calls the seam as `tileArt !== null && drawTileArt(…)` at each thing's site, and skips the thing's fill
when the seam draws. So a `null` runs exactly the ops it always ran.

- **The view contract.** `tileArt` is a new REQUIRED view field. The file's law is that every field is named, and
  `null` means "none". `plainView` defaults it to `null`, and `assertView` refuses a malformed value by name
  (`tileArtRefusal`). `drawLiveMarkers` reads `view.tileArt ?? null`, so a view built before R2b still works.
- **Measured: no art draws exactly as today.**
  - `mazeRoomRender.test.js`'s captured BEFORE hashes (the panel's own draws) are unchanged.
  - `mazeLiveMarkers.test.js`'s golden marker logs are unchanged.
  - `mazeTileArt.test.js` draws all 116 playable payloads of the committed Seedling playthrough preset in three ways:
    `tileArt: null`, a library with no maze key, and a library whose keys exist but whose sheets did not decode. The
    three draw-op logs are equal for every payload.
- **Beside the Seedling skin, not instead of it.**
  - The panel never asks for tile art on a Seedling-atlas world (`_seedlingSkin()` answers a level), whether the
    "Seedling art" toggle is on or off.
  - `drawWorld` also ignores `tileArt` whenever a `seedlingSkin` is drawn.
  - The toggle itself is untouched.

## 3. The play-time load

`mazeRoomUI._tileArtView()` runs on each render.

1. **The stack.** `_tileArtStack()` returns
   `effectiveContentStack({ substrateIds: [substrateRegistryEntry.id], content: documentContentOf(rules, player) })`:
   the maze entry's default pack, if it declares one, and then the loaded slot's `procgen_metadata[p].content` (a
   per-player map). The substrate set is the maze alone, matching what the APWorld editor's region job passes
   (`attachJobContent`: `[args.substrate]`).
2. **An empty stack** resolves at once, reads nothing and draws as today. That is every committed world on this base.
3. **A non-empty stack** loads once per stack (keyed by the joined ids) through `loadMazeTileArt(stack, io)`:
   - It reads `loadPackStack(ids, { only: ['art'] })`, as `loadSeedlingArt` does, and builds `createArtLibrary`.
   - If no pack carries a maze key, it stops there and decodes nothing.
   - Otherwise it decodes ONLY the sheets the maze's keys draw from. A stack could also hold another substrate's art,
     such as the whole Seedling pack.
   - It re-renders once when art lands.
   - A pack that cannot be read, or a sheet that does not decode, is named in the console, and the maze draws in its
     own colours.
4. **A later pack wins.** A later pack overriding `maze:tile/wall` wins through the art library's existing
   `mergeKeyed`. No second merge was built.
5. **In the browser,** `io` is `browserPackIo()` with `browserDecoder()` and `browserRasteriser()`.
6. **Test hooks:** `getTileArtStatus()` (stack, status, keyed things by pack, sheets, failed) and
   `setTileArtSourceForTests(io, { content })`.

## 4. The shape format, as built (Part 2)

In the art manifest, beside `sprites`. The README is `frontend/modules/artLibrary/README.md` § *Shapes: art with no
image file*. A complete pack you can copy:

```jsonc
// frontend/packs/plain-shapes/pack.json
{ "schema_version": 1, "id": "plain-shapes", "title": "Plain shapes", "licence": "CC0-1.0",
  "credit": "…", "layers": { "art": "art/manifest.json" } }

// frontend/packs/plain-shapes/art/manifest.json
{ "schema_version": 1,
  "shapes": {
    "maze:tile/floor": { "w": 16, "h": 16, "draw": [ { "rect": [0, 0, 16, 16], "fill": "#2e2a26" } ] },
    "maze:tile/wall":  { "w": 16, "h": 16, "draw": [
      { "rect": [0, 0, 16, 16], "fill": "#30343c" },
      { "line": [0, 8, 16, 8], "stroke": "#4a505c", "width": 1 } ] },
    "maze:character/player": { "w": 16, "h": 16, "draw": [
      { "circle": [8, 8, 6], "fill": "#4aa8ff", "stroke": "#000000", "width": 1 },
      { "circle": [6, 7, 1], "fill": "#000000" },
      { "circle": [10, 7, 1], "fill": "#000000" } ] },
    "maze:object/trap": { "w": 16, "h": 16, "draw": [
      { "polygon": [[8, 2], [14, 14], [2, 14]], "fill": "#e0c040cc" } ] } } }
```

- **Fields.** `w` and `h` are integers. `draw` is a non-empty list, and each item has exactly one primitive:
  `rect: [x, y, w, h]`, `circle: [cx, cy, r]`, `line: [x1, y1, x2, y2]` or `polygon: [[x, y], …]` (at least 3
  points). It then has `fill` and/or `stroke`, plus `width` for the stroke (default 1). A line is stroke only.
  Colours are `#rrggbb` / `#rrggbbaa`. `origin` is optional.
- **Refusals by name:** an unknown primitive or field, two primitives in one item, another colour notation, an item
  that paints nothing, a filled line, a width without a stroke, and a key that is both a sprite and a shape in one
  pack.
- **Across a stack,** a key is a sprite OR a shape, and the later pack wins whichever kind it is. There is one
  `mergeKeyed` over both tables, and `kindOf(key)` reports the winner.
- **How a shape reaches a painter: the brief's preferred path, and it fit.** `loadSheetImages(library, decode,
  rasterise)` rasterises each winning shape ONCE into an image of its own:
  - `browserRasteriser()` draws `paintShape` on an `OffscreenCanvas`, or on a canvas where there is none.
  - The shape's `sheetRef` is `"<pack>#<key>"`. Pack ids hold no `#`, and an image sheet's ref is `"<pack>/<sheet>"`,
    so the two cannot collide.
  - `resolve` answers a one-frame sprite (`fw = w`, `fh = h`, one frame). `frameRect`, `has`, `sheetsInUse` and the
    sheet lookup therefore work unchanged, and every existing art consumer (the maze seam, the Seedling renderers)
    can draw a shape entry with no change.
  - The library stays DOM-free: the rasteriser is injected, as the decoder is. With no rasteriser, a shape is a named
    failed sheet, and its key falls back.
- **Part 2.4 (one real use): none added.** The maze has no default pack on this base (`frontend/packs/` holds
  `seedling`, `archipelago`, `text-adventure`; the maze entry declares no `defaultContentPack`), so there is nowhere
  to put one.
  - After merging main at `bc0f06a650` (R2), the maze declares `defaultContentPack: 'maze'`, but
    `frontend/packs/maze/` carries only a `concepts` layer. Adding a shape entry to it would change the draw ops of
    every plain maze world, and the BEFORE hashes are the gate, so none was added; the reasoning above stands.

## 5. The engine closure (`node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`)

At the base (`origin/main` `cf4d9a6874`, in the worktree before any edit):

```
frontend/modules/mazeRoom/mazeArrival.js
frontend/modules/mazeRoom/mazeConcepts.js
frontend/modules/mazeRoom/mazeRoomBiomeLibrary.js
frontend/modules/mazeRoom/mazeRoomEngine.js
frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js
frontend/modules/mazeRoom/tileSpike/deriveLevelWorldLogic.js
frontend/modules/mazeRoom/tileSpike/deriveTileLogic.js
frontend/modules/mazeRoom/tileSpike/learnLattice.js
frontend/modules/mazeRoom/tileSpike/tileStep.js
frontend/modules/procgenCore/behaviourBlocks.js
frontend/modules/procgenCore/concepts.js
frontend/modules/procgenCore/differentialGrade.js
frontend/modules/procgenCore/elements.js
frontend/modules/procgenCore/skeletonKinds.js
frontend/modules/procgenCore/templateContract.js
frontend/modules/procgenPipeline/conceptSelection.js
frontend/modules/procgenPipeline/ruleRequirements.js
frontend/modules/shared/gameLogic/generic/genericLogic.js
frontend/modules/shared/playerIdUtils.js
frontend/modules/shared/procgen/library.js
frontend/modules/shared/procgen/mazeAlgorithms/gridTiles.js
frontend/modules/shared/procgen/mazeAlgorithms/postProcessors.js
frontend/modules/shared/procgen/mazeAlgorithms/registry.js
frontend/modules/shared/procgen/spatialPrimitives.js
frontend/modules/shared/profiler.js
frontend/modules/shared/rng.js
frontend/modules/shared/ruleEngine.js
frontend/modules/shared/ruleEngine/astAttributes.js
frontend/modules/shared/ruleEngine/astChecks.js
frontend/modules/shared/ruleEngine/astCollections.js
frontend/modules/shared/ruleEngine/astFunctionCalls.js
frontend/modules/shared/ruleEngine/astHelpers.js
frontend/modules/shared/ruleEngine/astImperative.js
frontend/modules/shared/ruleEngine/astLogic.js
frontend/modules/shared/ruleEngine/astReachability.js
frontend/modules/shared/ruleEngine/core.js
frontend/modules/shared/ruleEngine/helperScope.js
frontend/modules/shared/ruleEngine/helpers.js
frontend/modules/shared/ruleEngine/index.js
frontend/modules/shared/ruleEngine/ruleBuilderEvaluator.js
frontend/modules/shared/rulesJsonBuilder.js
frontend/modules/shared/simulatorCore.js
engineMd5 3e333bfa0a7692f8120aeaa9a1591119 (42 files, root frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js)
```

**Results:**

- **At Part 1 and at Part 2,** the closure is byte-identical to the listing above (`diff` empty, the same 42 lines,
  the same `engineMd5 3e333bfa0a7692f8120aeaa9a1591119`). None of the 42 files is in this branch's diff.
- **Not in the closure:** `mazeRoomRender.js` and `mazeRoomUI.js` (the files edited), and `mazeTileArt.js`,
  `artLibrary.js`, `contentPacks.js` and `worldContent.js` (the files added or imported).
- **The pin:** `mazeTileArt.test.js` asserts through `importClosure` that the closure of `mazeTileArt.js` shares no
  file with the engine's.
- **The primary tree's main** (`a4f57f8c53`, behind `origin/main`) prints a different md5 (`12287756…`) over the same
  42 paths. That is the base's own drift, not this slice.

## 6. What a theme author writes to reskin the maze

1. **The pack:** a directory `frontend/packs/<id>/` with a `pack.json` whose `layers` has `"art": "art/manifest.json"`.
2. **The manifest:** an art manifest with any of the 14 keys above, as `sprites` on a sheet (an image file) or as
   `shapes` (no image).
3. **The registry:** a row in `frontend/packs/packs.json`'s `packs`.
4. **Naming the theme:** the world names the pack in its content list. That is `params.content` (C3) at generation,
   recorded as `procgen_metadata[p].content`; R3's picker sets it.
5. **Fall-through:** every key the theme leaves out falls through to an earlier pack, or to the maze's own `COLORS`.
   No regeneration is needed: the art resolves at play time, and the compiled document does not change.

## 7. Tests

- **New:**
  - `frontend/modules/mazeRoom/mazeTileArt.test.js` (10): the table against `COLORS`, refusals, no art → today over
    every playthrough payload, the fixture override (later wall, earlier floor and block, a failed player sheet →
    disc, an un-keyed trap → strip), a shape entry through the seam, and the closure.
  - `artLibrary.test.js` § SHAPES (7): parse and refusals, both override directions, the rasteriser receiving the
    recipe, a missing rasteriser, and `paintShape`'s ops.
  - **In-app row `maze-tile-art-from-pack-stack`** (category *Maze tile art*, which no batch claims, so it runs in
    **`fast`**). It loads `procgen_maze/AP_1` with a fixture two-pack stack: in-memory `readJson`, sheets painted on
    an `OffscreenCanvas`, and the panel's own `browserRasteriser`. It reads the canvas pixels:
    - the wall is the later pack's sprite;
    - the floor is the later pack's SHAPE, over the earlier pack's sprite;
    - the player falls through to the earlier pack;
    - the un-keyed exit is `COLORS.exit`.
- **Updated:**
  - `mazeRoomRender.test.js`: the field list, and its hand-built view.
  - `procgenDocs/docLinks.test.js` and `docsRender.test.js`: the link census goes 402 → 405 (`doc` +2, `repo` +1).
  - The generated `docsIndex.js` and the docs README index.
  - `testDiscovery.js`, `init-bundled.js` and the substrates config row.
- **Bounded local run (ruling 52): 128 files, all passed.**
  - Every default-tier suite that imports a changed file: `artLibrary`, `mazeRoomRender`, `mazeRoomUI`,
    `mazeTileArt`, `mazeRoom/index`, `mazeSeedlingSkin`, `jsRuntimePage`, `testDiscovery` and `init-bundled`.
  - Plus `frontend/modules/{artLibrary,contentPacks,procgenDocs,mazeRoom}`, `mazeSeedlingSkin.test.js` and
    `scripts/procgen/seedlingSource.test.js`.
  - No slow, train or calib suite imports a changed file.
- **Generator:** `generate-procgen-reference.mjs` reports 0 findings, and `--check` matches.
- **Not run locally:** `check-procgen-docs.mjs`, because the box lock was held by another tree.

## 8. What the code overturned or added

1. **The key table has 14 rows, and they are not one per `COLORS` key.** The button is split into up and down (one
   colour in `COLORS`, two pictures). `blockEdge` and `pullMouth` belong to a thing's body, not to a key of their own.
   The entrance is a border today, so its art replaces a stroke, not a fill.
2. **`tileArt` is a required view field,** under the painter's own law. Every hand-built `drawWorld` view must now name
   it. The only hand-built one in the tree was the render test's.
3. **The play-time stack's substrate set is the maze alone,** as the region job reads it. Another substrate's default
   pack in the world's mix is not in the maze's art stack. That is harmless while art keys are namespaced by
   substrate, but it is a choice.
4. **A Seedling-atlas world never uses the seam,** even with the Seedling toggle off. "Beside, not instead" was read
   literally.
5. **`sheetsInUse` now also lists shape entries** (`url: null`, with `shape`). Its only reader of `url` is
   `loadSheetImages`. No committed stack has shapes, so the Seedling runtime's sheet list is unchanged.
6. **Part 2 fit in the slice:** the rasterise-at-load design needed no change to any consumer.
7. ⚠ **For landing beside R2 and R3:** both also move the `procgenDocs` link-census numbers and edit `maze.md` and
   `concepts.md`. Expect a textual conflict in `docLinks.test.js` / `docsRender.test.js`, which is count arithmetic.
   Once R2 declares `defaultContentPack: 'maze'`, every maze world's stack becomes `['maze', …]`. The panel then reads
   `frontend/packs/maze/pack.json` once per stack: a pack without an `art` layer loads nothing and draws as today.
   **Resolved at the merge of main `bc0f06a650`:**
   - The census was recomputed by the tests, not summed: `doc` 305, `repo` 43, corpus 407.
   - `docsIndex.js` was regenerated.
   - The in-app row's fixture `readJson` now passes paths it does not hold to the real served packs. Before, the
     stack's leading `maze` pack would have thrown "no fixture".
   - A unit row in `mazeTileArt.test.js` checks a plain world's own stack: `['maze']` reads `maze/pack.json` once,
     decodes nothing, and gives `tileArt` null.

## 9. CI

Quoted at the exact final tip in the REPORT BACK message, not in a further commit.
