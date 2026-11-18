# frontend/packs: content packs

These are data directories loaded by `frontend/modules/contentPacks/`. They live under `frontend/` because
GitHub Pages serves only `frontend/`.

⚠ **Not every pack is MIT.** Each pack's `pack.json` names its own `licence`: `seedling` is the Unlicense (the
original game's), and the others are MIT. A source in a layer's provenance block may name its own `licence` too.

**Layers.** A pack provides one or more of: `art`, `sfx`, `music` (resolved at play, by key); `concepts`, `text`
(the words: a world's content set); and, since content packs PL-1, `structure` (what exists: tasks, stats,
resources, boons and places, as ids and links), `numbers` (magnitudes, one set per game; defaults) and `bindings`
(per game, what only that game needs). The last three carry logic and are never read by a content set. No committed
pack carries them yet. `frontend/modules/packStructure/` reads them; `fixtures/packs/` there holds examples.

**Provenance.** Every layer manifest carries a `provenance` block naming where its entries came from:
`sources` (each a `game`, `person`, `model`, `authored` or `derived` source, with that type's fields), a `default`
source, optional `groups` (a key prefix → a source), and an optional `src` on an entry that differs. The loader
refuses a layer whose entries do not all resolve, naming the pack, the layer and the key. A model source names the
exact model id, taken from the commit trailer (`Co-Authored-By`) of the files it wrote, or `"unrecorded"` with its
family; `approved` is recorded only where the user approved the entries. `node scripts/procgen/report-pack-provenance.mjs`
counts the entries per source. When you add or change entries, name their source in the block, and add a source
when it is new: an image a person contributed is a `person` source under the name they chose to be credited by.
Details are in `docs/json/developer/procgen/concepts.md` § Provenance.

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

- `text-adventure/` is the text adventure substrate's DEFAULT content pack (content sets R1; the registry entry's
  `defaultContentPack`). It has no art: a `concepts` layer (one pack concept per mechanic concept the text adventure
  realises, each `presents` it and names its text slots) and a `text` layer (every string the substrate's generation
  writes into a world document). It is HAND-MADE, under the repository's MIT licence (see `pack.json`). Every
  committed text-adventure world compiles byte-equal from it, so an edit here changes what a regenerated world says:
  `frontend/modules/procgenPipeline/conceptTrialWorld.test.js` and `check-procgen-presets` hold the committed bytes.
- `maze/` is the maze substrate's DEFAULT content pack (content sets R2). It has a `concepts` layer only: one pack
  concept per mechanic concept the maze realises, each `presents` it and carries the `look` (colour + symbol) the
  maze writes into a world's payload at generation (a gate also takes the concept's `name`; an item keeps its AP
  item name, which is logic). HAND-MADE, under the repository's MIT licence (see `pack.json`). The same edit rule
  holds: `conceptTrialWorld.test.js` and `mazeRoom/mazeContent.test.js` hold the committed bytes.

- `meta/` is the first THEME (content sets R3): a pack a world selects (`packs.json`'s `content` table, stack
  `meta`; the pipeline panel's *Content set* row offers it), not a default. A world that knows it is a generated
  game. It has a `concepts` and a `text` layer, and (content sets R4) an `art` layer of SHAPES ONLY, no image file:
  one recipe for each of the maze's 14 tile-art keys (`mazeRoom/mazeTileArt.js` `MAZE_ART_KEYS`), drawn as a
  diagram — a paper floor cell with a corner tick, a hatched slate wall, an orange marker for the player, one plain
  mark per object — in a 20×20 box (the maze's `TILE_PX`, so a recipe draws 1:1 in play) with one stroke width. A
  world that selects the theme draws its maze from them at play; `mazeRoom/mazeMetaArt.test.js` pins the recipes
  (inside their box, states apart, every key through the draw seam) and the in-app row `meta-trial-maze-tile-art`
  reads them off the canvas. (Content sets R5) three more recipes are named by the theme's own concepts as their
  `art`: the Gate (a square with two dot eyes and a keyhole), Progressive Sword and Progressive Swim. A maze draws a
  concept gate or item from the art key of the latest pack concept that presents its mechanic
  (`mazeTileArt.conceptArtKeys`), else its baked colour and symbol (`mazeRoom/mazeConceptArt.test.js`). (Content
  sets TIDY-1) The composite map's maze cell (the APWorld Editor's Map tab, the pipeline's map) draws the same tiles,
  gates, items and things through the same seams once the world's stack has loaded, and a world with no theme draws
  as before (`mazeRoom/mazeCompositeArt.test.js`; the in-app row `meta-trial-composite-map-art`). (Content sets
  TILE-1) Both views draw every tile kind but the map's player through one fallback chain, `mazeTileArt.drawMazeTile`:
  the theme's art, the kind's default, its declared base, a placeholder (`mazeRoom/mazeTileFallback.test.js`). (Content
  sets TILE-2) A pack's concept row may declare a tile kind's `base` beside its `art` key (`packConcepts.PACK_TILE_BASES`),
  read through `mazeTileArt.mazeTileKind`; no world field places such a kind yet. The art is
  play-time only, so an edit to it owes no preset rebuild. It presents the guardian as **the Gate** (a `look`,
  `#a0a8b8` / `#`, for the maze's gate role; the `blocked` and `passedWith` lines for the text adventure's), gives
  the sword's and the swim's checks a line that knows it is a check (their names stay the AP item names, and the
  theme gives them no look, so the baked colour and symbol stay the default; their art key draws the pickup), and offers twelve `place` concepts for the text
  adventure's rooms. It does NOT present water: water falls through to each substrate's default pack. ⛔ No line
  may claim something untrue of the world: a place describes only what every generated room has, and a
  `description` is not a template, so it names no item or region (the Gate's says only that it knows its own rule;
  the rule itself is in its `blocked` and `passedWith` lines, as `{item}`). HAND-MADE, written
  for this repository, MIT (see `pack.json`). `procgenPipeline/metaTrialWorld.test.js` and the committed
  `frontend/presets/meta_trial/` hold its words; an edit here owes `make-seedling-spiral-room-preset.mjs
  --state=meta-trial`.

⛔ **The seedling and archipelago packs are GENERATED. Do not edit them.** Regenerate with
`node scripts/procgen/extract-seedling-art-packs.mjs`, and check with the same command plus `--check`. The sheets
are the `vendor/seedling` PNGs copied byte for byte, except the font sheet, which
`scripts/procgen/make-seedling-font.mjs` builds from its glyph table (`--check` compares its bytes; the extractor's
`--check` covers it too). The `sfx` layer comes from `scripts/procgen/seedlingSfxLayer.js`, which both
`extract-seedling-art-packs.mjs` (it owns `pack.json`) and `extract-seedling-sfx-pack.mjs` (the layer's own CLI and
`--check`) build from. Its clips are the `vendor/seedling` MP3s copied byte for byte.

Left out by ruling: the 04B_03 font (its licence is unclear; the authored font above replaces it), the promotional, Newgrounds and tank images, and (from the ART) all music and sound. The sound effects are the `sfx` layer; music is the next slice.
