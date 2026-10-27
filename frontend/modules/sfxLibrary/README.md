# sfxLibrary

**Sound effects by key, for any game.** It reads the `sfx` layer of a content-pack stack (`../contentPacks/`),
merged so that a later pack wins per key. ⚖ The user, 2026-10-26: "a sound effect library, and maybe a separate
music library, that work like the graphics library".

- `createSfxLibrary(stack)` answers:
  - `has(key)`: does any pack in the stack carry this key?
  - `clipsOf(key)`: its variants in index order, `[{ clipRef, url, seconds? }]`. One clip may sit at several
    indices, because the index is what a game names.
  - `variantCount(key)`, `clipsInUse()`: the distinct clips to decode.
- `loadSfxClips(library, decode)` decodes the clips with an injected decoder (`browserSfxDecoder(out)` = `fetch` +
  the `../webAudio/` output's decode). A failed clip is named in `failed`; `bufferFor(key, index)` returns null for
  it and the caller plays nothing. Never a crash.
- ⛔ **It never chooses WHEN to play, or which variant.** A game's cue module does (Seedling's is
  `seedlingDemo/seedlingSoundCues.js` and `seedlingSoundPlayer.js`).

## Sfx manifest

`sfx/manifest.json` inside a pack:

```jsonc
{ "schema_version": 1,
  "clips":  { "Sword1": { "file": "clips/Sword1.mp3", "seconds": 0.10449 } },
  "sounds": { "seedling:sfx/sword": { "clips": ["Sword1", "Sword2", "Sword3"] } } }
```
