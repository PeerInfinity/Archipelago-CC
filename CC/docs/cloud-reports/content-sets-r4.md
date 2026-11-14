# Content sets R4: the `meta` theme draws the maze from shapes (as built)

Branch `content-r4`, based on `origin/content-r3` at `5c5714d585` (`origin/main` did not contain it when the slice
began, nor when this report was written). This is the first real shape art in the repo. The `meta` theme gets an `art`
layer of **shape recipes only**: no image file, no `sheets/` directory, no `sprites`. A world that selects the theme
(`procgen_metadata[p].content` = `['meta']`, ⚠ a per-player map) draws its maze from these recipes at play. **No code
change was needed for that:** R2b's play-time load already reads the world's recorded stack. No engine file, no art
library file and no preset byte changed.

| Commit | Part |
|---|---|
| `8e5a91015e` | 1–2. `frontend/packs/meta/art/manifest.json` (14 shape recipes); `pack.json` declares the `art` layer |
| `bbac7db008` | 4. vitest pins `frontend/modules/mazeRoom/mazeMetaArt.test.js` |
| `effa1cb492` | 5. the contact sheet (HTML, its render script, the PNG); the pulser recipe gains a paper disc (found on the sheet) |
| `12eaa0f708` | 6. the in-app row `meta-trial-maze-tile-art` |
| `d967b00fad` | 7. docs; the regenerated procgen index; the link census |

## Where the layer is declared (measured)

- `pack.json` `layers.art` = `art/manifest.json`. `art` was already in `contentPacks.KNOWN_LAYERS`, so nothing new
  was added there.
- `packs.json` needed no edit: the pack is already listed, and the `content` table (`"meta": ["meta"]`) names the
  stack, not its layers.
- `extract-seedling-art-packs.mjs --check` passes: it walks `packs.json` and refuses only an unlisted pack.
- The vitest setup preloads every committed pack, so it now loads `meta`'s art layer too. Every suite that walks
  `frontend/packs/` passes.

## The recipes

One style throughout. Each recipe sits in a **20×20 box**, not the brief's 16×16: the code says 20 scales better.
The plain maze draws at `TILE_PX = 20` (`mazeRoomRender.js`; the panel's `tilePx` for a non-Seedling world), so a
20-box draws 1:1 in play with no scaling blur, where a 16-box would be smoothed 1.25×. Every stroke is **2 wide**. The
palette is small and flat:

- paper `#c4c9d2`
- ink `#2e3440`
- slate `#4c5464`
- the Gate's grey-blue `#a0a8b8`
- the maze's own meaning colours (exit green, mana cyan, trap yellow, block tan, struck red-orange, dormant pale blue,
  button yellow, pulser yellow, pull dark red)
- one accent for the player, orange `#e8743a`

The idea is a diagram: the world drawn as a generated game's map. Each entry carries a `note` (the shape format's
`note` field) saying what it is meant to look like.

| Key | What it looks like | What the painter draws over or around it (unchanged) |
|---|---|---|
| `maze:tile/floor` | a paper cell with a small grey-blue L tick at its top left | the grid lines over every cell; anything on the floor |
| `maze:tile/wall` | a slate block ruled with three diagonal hatch lines in grey-blue; the lines meet across neighbouring walls (period 10 in a 20 box) | the grid; a pulser on its cell |
| `maze:tile/exit` | an OPEN exit: a green box outline with a green right-pointing triangle in it, on the paper floor | a closed exit is not keyed: it stays the `COLORS.exitBlocked` solid red fill (the recipe uses no red); a concept gate's fill or dashed outline |
| `maze:tile/entrance` | four green L-shaped corner brackets, so it still shows around the player who starts on it | the player |
| `maze:tile/mana` | a hollow cyan diamond with a cyan plus sign in it (refill) | the 0.25-alpha fade once collected |
| `maze:character/player` | an orange disc ringed in ink with a small paper centre (a "you are here" marker) | the facing tick (a black square on the faced side); the recipe has no black edge for it to vanish into |
| `maze:object/trap` | a yellow warning triangle outlined in ink with an ink "!" | its lane's armed/silent tint |
| `maze:object/block` | a tan crate outlined in ink with an X across it | — (`blockEdge` is the default's own outline, not drawn under art) |
| `maze:object/block-struck` | a red-orange block outlined in ink with an ink triangle pointing up (a block that strikes, not a crate) | — |
| `maze:object/block-dormant` | a pale blue disc outlined in ink with a level ink dash (asleep) | — |
| `maze:object/button` | UP: an empty paper plate outlined in ink with a yellow knob in the middle | — |
| `maze:object/button-down` | DOWN: the same plate filled yellow, the knob pressed flat to an ink dot; the plate's corners show around the player or block on it | the player or block standing on it |
| `maze:object/pulser` | a small yellow square outlined in ink with an ink centre dot, on a paper disc | the ring (radius 0.42 cell) stroked armed red or silent grey; the paper disc keeps the grey ring readable on a hatched wall |
| `maze:object/pull` | a dark red ring around a dark red centre (a target that draws things in) | the disc's live/inert tint on the cells around it |

The states stay apart by **form**, not only by colour:

- block, block-struck and block-dormant are a crate, a struck block and a disc;
- a button up shows a knob on an empty plate, and a button down shows a filled plate with a dot;
- an open exit is an outline with a triangle, and a closed one is solid red.

**Omitted keys: none.** For all 14 keys a simple recipe reads better than the default and is clearly different from
it. The test's `OMITTED` table is empty and stays the one place to list one.

## The contact sheet (for the user's review)

`CC/docs/cloud-reports/content-sets-r4/contact-sheet.png`, rendered from
`CC/docs/cloud-reports/content-sets-r4/contact-sheet.html`. The HTML imports the real modules from a static server at
the repo root; `render-contact-sheet.mjs` beside it screenshots the page with the repo's own Playwright, with no new
dependency. It shows each of the 14 things twice, in real surroundings: a 3×3-cell crop at 3×, **default** (no art)
beside **meta** (stack `maze, meta`, loaded by `loadMazeTileArt` with `browserRasteriser`, exactly as play loads it),
plus each recipe alone. Below them, `meta_trial`'s maze `region_2_3` is drawn both ways; its water gate stays the
default's blue. The scenes come from the committed Seedling playthrough payloads. A mana tile, a pulser, a dormant block
and the player on a button are staged on a deserialized world, because no committed payload holds them together. To
re-render:

```
python -m http.server 8130            # at the repo root
node CC/docs/cloud-reports/content-sets-r4/render-contact-sheet.mjs --port=8130 [--dark]
```

## How the art reaches the screen

R2b's chain, unchanged:

1. `MazeRoomUI._tileArtStack()` reads `documentContentOf(rules, player)` and builds
   `effectiveContentStack({substrateIds: ['maze'], content})`. For `meta_trial` that is `['maze', 'meta']`.
2. `loadMazeTileArt` loads the `art` layer of each pack. `maze` has none, and `meta` has the 14 shapes.
3. `loadSheetImages` rasterises each shape once (`browserRasteriser` → `paintShape`) into its own sheet,
   `"meta#<key>"`.
4. `drawWorld`'s seam (`drawTileArt`) blits frame 0 of that sheet into the 20 px cell.

A plain maze world records no `content`, so its stack is `['maze']`, which carries no art: it draws as before (R2b's
pins are untouched). On a Seedling-atlas world the panel passes no tile art. `meta_trial`'s committed bytes did not
change, because art is play-time only: `make-seedling-spiral-room-preset.mjs --state=meta-trial --check` gives "OK …
matches a fresh build".

## Engine closure

`node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure` gives the same output at the base and at the
tip (diffed):

```
engineMd5 3e333bfa0a7692f8120aeaa9a1591119 (42 files, root frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js)
```

No file in the list changed.

## Tests

- **vitest** `frontend/modules/mazeRoom/mazeMetaArt.test.js` (new, 28 tests):
  - the manifest parses (`parseArtManifest`), holds only shapes, and the pack ships no non-JSON file and no
    `art/sheets/`;
  - every key it carries is a `MAZE_ART_KEYS` key, and carried plus `OMITTED` equals the table (derived, no count);
  - each recipe paints inside its box: `paintShape` on `drawOpRecorder`'s recording context. A stroked outline is
    checked with half its width; a line by its end points, since the canvas clips its ends;
  - one box (= `TILE_PX`) and one stroke width; floor and wall fill their whole cell;
  - the states stay apart (three block recipes, two button recipes, no `exitBlocked` red in the exit);
  - **the seam with the real stack** (`loadMazeTileArt(['maze', 'meta'])` over the committed packs, a stub
    rasteriser keyed by shape): the staged scenes draw every carried thing from its `meta#<key>` sheet, and no carried
    thing in its `COLORS` fill (floor, player, mana checked). Each omitted thing would paint its `COLORS` colour. The
    state signals are unchanged with the art on: the facing tick, the pulser's ring, the lane and disc tints, and the
    closed-exit and blocked-location red;
  - a plain world's stack keys nothing;
  - `meta_trial`'s document resolves through `effectiveContentStack` to `['maze', 'meta']`, and that stack keys every
    carried thing from `meta`.
- **The bounded run** passed: 65 files, 2022 tests, every suite in the brief's list plus every suite that walks
  `frontend/packs/`, `packs.json` or the substrates config (`grep -a`), `frontend/modules/tests`, and
  `frontend/modules/procgenDocs`. The only red before the census edit was the link census, below.
- **The link census** moved 412 → 414, measured by the tests: `doc` 309 → 310 (concepts.md → maze.md § Tile art) and
  `repo` 43 → 44 (maze.md → the `meta` art manifest). Both pins were updated: `docLinks.test.js` and
  `docsRender.test.js`.
- **In-app row `meta-trial-maze-tile-art`** (in `frontend/modules/tests/testCases/mazeTileArtTests.js`, beside R2b's
  row; category *Maze tile art*, which no batch claims, so it rides **`fast`**). It loads the committed `meta_trial`
  preset, moves into its maze `region_2_3`, and lets the panel's own load run, with no test seam. It asserts:
  - the stack is `[maze, meta]`, and every carried thing is keyed by `meta`;
  - a repaint draws the floor, wall and player from `meta#<key>` sheets, read off the `drawImage` calls by image
    identity;
  - a floor pixel is the recipe's paper colour;
  - the water gate is the maze default pack's water in name, colour and symbol, and its cell's pixel is `#2f6fd0`.

  One local single-row run (not a batch) PASSED in 0.7 s with all 18 conditions evaluated. CI is the browser run of
  record.

## What the shape format lacked (did without it)

- **No dashes and no line caps or joins.** The entrance's corner brackets are four filled L polygons instead of
  stroked dashes.
- **No clipping.** The wall's hatch lines are placed so that they end on the box edge.
- **No text.** The trap's "!" is a line and a small rect, and the mana tile's "M" became a plus sign.
- **No state in a recipe.** A key has one picture; button up and down are two keys because R2b split them.

None of these blocked a recipe.

## What the code overturned in the brief

- **The box is 20, not 16.** `TILE_PX = 20` is what play draws, so 20 is the 1:1 size. A 16-box would be smoothed when
  drawn.
- **No code was needed to reach the screen.** R2b's load already reads the world's recorded stack, so a manifest alone
  turns the maze on (measured by the in-app row and the vitest seam test).
- **The pulser's silent ring is grey on grey.** On the hatched wall it nearly disappeared on the first contact sheet.
  The recipe now carries a paper disc under the ring. The ring is a state signal and no theme can restyle it, so a
  theme that makes walls mid-grey must give the pulser a backdrop. maze.md's new table says so.
