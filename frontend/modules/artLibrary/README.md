# artLibrary

**Sprites and animations by key, for any renderer.** It reads the `art` layer of a content-pack stack
(`../contentPacks/`), merged so that a later pack wins per key.

- `createArtLibrary(stack)` answers four questions:
  - `has(key)`: does any pack in the stack carry this key?
  - `frameRect(key, frame)`: which sheet and rectangle, with the art's `origin`. This is FlashPunk
    `Spritemap`'s frame → rect, frame index wrapped.
  - `frameAt(key, anim, tick, phase)`: which frame is showing at a **game tick**.
  - `sheetsInUse()`: the sheet URLs to decode.
- `loadSheetImages(library, decode)` decodes the sheets. In a browser, `browserDecoder` uses `fetch` +
  `createImageBitmap`. A failed sheet is named in `failed`; the painter falls back to rectangles for it and
  never crashes.
- ⛔ **Animation runs on the game tick, never wall time.** There are two clocks:
  - `world` is AS3's `Game.worldFrame(n, loops)`, at 45 ticks per frame (`Game.timePerFrame`).
  - `fps` advances `fps × 0.0333` frames per tick: the JS sim's clamped `FP.elapsed`.
- ⛔ **Renderer-agnostic.** The library knows frames, origins and animations. It never knows how Seedling or
  the maze chooses a frame: the autotiler, tree/pole neighbour frames and Y-sort live in the renderer
  (`seedlingDemo/seedlingSkinRenderer.js`).

## Art manifest

The manifest is `art/manifest.json` inside a pack:

```jsonc
{ "schema_version": 1,
  "clocks": { "world": { "ticksPerFrame": 45 } },
  "sheets": { "Shore": { "file": "sheets/Shore.png", "w": 256, "h": 16 } },
  "sprites": {
    "seedling:tile/ground": { "sheet": "Shore", "fw": 16, "fh": 16, "frames": 16 },
    "seedling:scenery/bonetorch": { "sheet": "BoneTorch", "fw": 16, "fh": 24, "origin": [0, 8],
      "anims": { "burn": { "clock": "world", "frames": [0, 1, 2, 1], "loops": 2 } } } } }
```

- `origin` is the frame pixel that sits on the renderer's anchor.
- `only` picks one frame of a shared sheet.

## Shapes: art with no image file

A manifest may also carry `shapes`, beside `sprites`. A shape entry is drawn from basic shapes instead of a sheet, so a
theme can be complete without a single image (content sets R2b, ⚖ the user 2026-11-11).

```jsonc
{ "schema_version": 1,
  "shapes": {
    "maze:tile/wall": { "w": 16, "h": 16, "draw": [
      { "rect": [0, 0, 16, 16], "fill": "#30343c" },
      { "line": [0, 8, 16, 8], "stroke": "#4a505c", "width": 1 } ] },
    "maze:character/player": { "w": 16, "h": 16, "draw": [
      { "circle": [8, 8, 6], "fill": "#4aa8ff", "stroke": "#000000", "width": 1 },
      { "circle": [6, 7, 1], "fill": "#000000" },
      { "circle": [10, 7, 1], "fill": "#000000" } ] },
    "maze:object/trap": { "w": 16, "h": 16, "draw": [
      { "polygon": [[8, 2], [14, 14], [2, 14]], "fill": "#e0c040cc" } ] } } }
```

- `w`, `h` (integers) are the entry's own pixel size. The renderer scales the entry like any frame.
- `draw` is a list painted in order. Each item has exactly one primitive: `rect: [x, y, w, h]`,
  `circle: [cx, cy, r]`, `line: [x1, y1, x2, y2]` or `polygon: [[x, y], …]` (at least 3 points). It then has `fill`
  and/or `stroke`, with an optional `width` for the stroke (default 1). A line takes a stroke only.
- Colours are `#rrggbb` or `#rrggbbaa`. `origin: [x, y]` is optional, as for a sprite.
- Anything else is refused by name: an unknown primitive or field, two primitives in one item, a colour in another
  notation, an item that paints nothing.
- **One key, one kind per pack.** A pack may not carry the same key as a sprite and a shape. Across a stack, the later
  pack wins whichever kind it is, so a shape replaces an earlier pack's sprite and the other way round. `kindOf(key)`
  says which kind won.
- **Rasterised once, then a sprite.** `loadSheetImages(library, decode, rasterise)` turns each winning shape into an
  image of its own (`rasterise(shape)`, which is `browserRasteriser()` in a browser: a canvas with `paintShape` on
  it). From then on the library answers for the key exactly as for a one-frame sprite: `has`, `resolve`,
  `frameRect` (sheet `"<pack>#<key>"`, frame 0) and `sheetsInUse`. Every existing consumer draws a shape with no
  change. Without a rasteriser, a shape is named in `failed` and its key falls back, as for a sheet that did not
  decode.
- `paintShape(ctx, shape)` is DOM-free. `artLibrary.test.js` pins it on a recording context.
