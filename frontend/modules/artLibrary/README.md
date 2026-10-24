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
