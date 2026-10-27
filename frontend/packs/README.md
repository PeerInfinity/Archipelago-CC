# frontend/packs: content packs

These are data directories loaded by `frontend/modules/contentPacks/`. They live under `frontend/` because
GitHub Pages serves only `frontend/`.

- `packs.json` is the hand-kept registry. It lists the packs and the named **stacks** a consumer loads, in
  override order (a later pack wins per key). For example, `graphics.seedling = ["seedling", "archipelago"]`
  is what the Seedling JS runtime page's `?graphics=seedling` loads.
- `seedling/` holds the original Seedling graphics: tiles, cliffsides and static scenery (G1), the player (G2),
  the enemies, the arrow and the AP item looks (G3), the wallflyers, drills, turrets, their shots and the
  Bob Boss (G3b), and the spinning axes, crushers, lava chains, the Boss Totem and its shots, the bomb pusher,
  its bombs and the grenades (G3c), the explosions, slash hits, rain droplets and hearts (G4), the stairs, pushable
  blocks and sand traps (G7), the chests, breakable rocks, burnable trees, locks, buttons, the placed NPCs, the traps, the falling rocks and the torch, orb and light-pole bodies (G8), and the machines — beam towers, pulsers, wires, whirlpools, pods, little stones and their grass, the moonrock and its pile, the final door (G9b), and the bosses (G10; the G3–G10 rows live in
  `frontend/modules/seedlingDemo/seedlingEnemyArt.js`, which the extractor spreads into its table). The art is by
  Connor Ullmann, under the Unlicense (`vendor/seedling/LICENSE`). The ONE exception is the dialogue font
  (`sheets/SeedlingFont.png`, key `seedling:font/default`, G4b): ORIGINAL glyphs authored in this repository, not
  04B_03, under the repository's MIT licence (the manifest's sheet row says `authored`).
- `seedling/sfx/` (the pack's `sfx` LAYER, ⛓ sound effects 2026-10-26) holds the original sound effects, by
  Rekcahdam, under the same Unlicense: every clip `vendor/seedling/src/Music.as` puts in its `sounds` table, one key
  per SET (`seedling:sfx/enemy-hit`), its clips in Music.as's index order. That includes the 23 clips Music.as
  embeds from `assets/sound/Unapproved/` (flagged `unapproved` in the manifest), because the game plays them. The
  songs and jingles are listed in the manifest's `elsewhere` for the music layer (the next slice).
  `packs.json`'s `sfx.seedling` is the stack the JS runtime page's sound loads.
- `archipelago/` holds the fork's AP-item pickup (`ArchipelagoLogo.png`), under MIT (see `pack.json`).

⛔ **Both packs are GENERATED. Do not edit them.** Regenerate with
`node scripts/procgen/extract-seedling-art-packs.mjs`, and check with the same command plus `--check`. The sheets
are the `vendor/seedling` PNGs copied byte for byte, except the font sheet, which
`scripts/procgen/make-seedling-font.mjs` builds from its glyph table (`--check` compares its bytes; the extractor's
`--check` covers it too). The `sfx` layer comes from `scripts/procgen/seedlingSfxLayer.js`, which both
`extract-seedling-art-packs.mjs` (it owns `pack.json`) and `extract-seedling-sfx-pack.mjs` (the layer's own CLI and
`--check`) build from. Its clips are the `vendor/seedling` MP3s copied byte for byte.

Left out by ruling: the 04B_03 font (its licence is unclear; the authored font above replaces it), the promotional, Newgrounds and tank images, and (from the ART) all music and sound. The sound effects are the `sfx` layer; music is the next slice.
