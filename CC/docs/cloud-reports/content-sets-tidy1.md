# Content sets TIDY-1 — the composite map draws themed gates, items and things; the Gate's description tells no untruth

Branch `content-tidy1`, base origin/main `75e45c964d`. Three commits:

- `918c6f5a5c` — Part 1: the composite map's maze cell draws the theme's art. Includes the plain pin.
- `b4dfda9620` — Part 1: the in-app row `meta-trial-composite-map-art`.
- `c3b702be7f` — Part 2: the meta Gate's description. Also two lines in `frontend/packs/README.md`.

Then this report, with its pictures.

## Coordination with the region-map arc (before any edit)

I asked `archipelago-cc-23` (the region-map planner) whether a slice of theirs changes `drawMazeCompositeRegion`, the
maze's `compositeMap` declaration, or the geom contract. Their answer, verbatim:

> archipelago-cc-23 (region-map planner) → content-sets-tidy1: no overlap, go ahead. I checked the region-map-panel
> branch (step 3b, in flight, tip ef7fbde4db) against 75e45c964d. It touches none of mazeCompositeMap.js,
> mazeRoomLibrary.js or compositeMapRenderer.js, and it doesn't change the geom contract. No other region-map slice is
> running.
>
> One thing to know: step 3b adds a SECOND caller of the same painters, the new Region Map panel
> (regionMap/regionMapUI.js, ~:563 `_drawArt`). It passes the same geom shape: `source` = {rules, playerId}, as
> drawCompositeMap does; `requestRedraw` = one STABLE function per panel, so it is safe to dedupe waiters on it. There
> are two differences from the composite map:
> (a) It draws under a canvas transform (setTransform for zoom/dpr), with offX/offY = 0 and a fixed bake tilePx. So draw
> only in the geom's coordinates, and don't reset or assume the identity transform.
> (b) `regionSize` is the level's own extent when the substrate declares `compositeMap.regionExtent`. Maze doesn't, so
> you get the uniform regionSize, as today.
> If your painter keeps to the geom, it works in both places with no change. When 3b lands, a themed maze world will
> show your art in the Region Map too.

The painter keeps to the geom. It draws only at `offX/offY + cell × tilePx`. It never sets a transform. It dedupes
waiters by function identity. `compositeMapRenderer.js` is unchanged.

## Part 1 — the composite map uses the theme's art

### Measured before (base `75e45c964d`)

The themed world is `meta_trial`, with stack `[maze, meta]`. Its maze regions hold one concept gate (water), one
concept item (swim) and 2 things. The plain control is `procgen_maze` seed 1, with no content.

- **Tiles.** The cell drew 4 of R2b's 14 tile kinds, all as `COLORS` fills: floor, wall, an open exit, and the entrance
  border. It never drew the other 10: mana, player, trap, the three block kinds, button up and down, pulser, pull.
  R2b's tile art was never used.
- **Concept gate.** Always `mazeConcepts.paintConceptGate`, the baked colour and symbol. It is always closed, because
  the composite map has no inventory.
- **Item.** Always the disc in the `itemLib` colour, with its label. R5's art was never used.
- **Things (S2).** Not drawn at all. The registry's deserializer does carry `things` on the payload.
- **The art stack.** The composite view loaded none. The painter read nothing but the payload.
  `drawCompositeMap` already passed `geom.source` and `geom.requestRedraw` (region-map step 1, for the Seedling cell).
- **Result:** `meta_trial`'s composite cells drew exactly the same ops as `concept_trial`'s. The pin hashes below
  are equal.

### After

`mazeCompositeMap.drawMazeCompositeRegion` sends each cell through the one-region view's own seams. Each seam keeps
its own fallback:

| what | seam (unchanged) | fallback (as before) |
|---|---|---|
| floor / wall | `mazeTileArt.drawTileArt('floor'/'wall')` (R2b) | the `COLORS` fill |
| open exit | `drawTileArt('exit')`. A closed one is a state signal and stays `exitBlocked` red | `COLORS.exit` |
| entrance | `drawTileArt('entrance')` | the green border |
| concept gate | `conceptArtFrame` / `drawConceptArt('gate', mechanic)` (R5). Drawn at `CONCEPT_ART_CLEARED_ALPHA` once passed, as in `drawWorld` | `paintConceptGate` |
| concept item | `drawConceptArt('item', mechanic)` (R5) | the disc and its label |
| thing | `mazeThingOverlay.drawMazeThings` (S2): thing art, then the sign key, then the baked look | as S2 |

- **No art logic is copied.** The painter only chooses which seam each cell asks. The blocked-location red border
  moved out of the item branch, so it is drawn over item art too, as in `drawWorld`. Its op order without art is
  unchanged (pinned).
- **The one change to a seam:** `drawMazeThings` takes an optional cell origin, `view.offX` / `view.offY` (default 0).
  The panel's call is unchanged.
- **The 10 tile kinds the cell never drew are still not drawn.** Drawing them would change every plain world's cell.
  That is outside this slice.

**The load** follows the Seedling cell painter's pattern (`drawRegion` is synchronous, but the art is not):

- **The stack:** `mazeCompositeStackOf(region, source)`. It is `worldContent.effectiveContentStack` over the region's
  substrate and the slot's `procgen_metadata[p].content`, the rule `mazeRoomUI._tileArtStack` uses.
  - `procgen_metadata` is ⚠ a per-player map. When the host names no slot, the stack reads the document's one slot,
    if it has exactly one. A pipeline run's map names none: `_mapSource` takes the first `region_atlas` slot, and a
    maze world has no `region_atlas`.
- **One load per stack**, through `loadMazeTileArt`, with the substrate entry's `contentRoles`. A module cache shares
  it with every cell and every host.
- **A miss** draws the no-art cell. When the load lands, each waiting host's `requestRedraw` is called once, and only
  if the load brought art.
- **A failed load** draws the no-art cell for good, and the error is logged by name.
- **In node** (no `document`, no test io) nothing loads.
- **A maze world laid on a Seedling atlas** (`world.atlas`) gets no art, as in the one-region view.
- The browser io is `browserPackIo` + `browserDecoder` + `browserRasteriser`, as `mazeRoomUI` uses.

**What draws differently, and what does not.** The drawing changes only for a world whose stack carries art. Today
that is `meta_trial` alone: 2 of the 1,188 committed maze regions, in 38 documents. A world with no theme has the
stack `[maze]`. The maze pack has no art layer, so its load resolves `tileArt: null` and every seam is skipped.

### Pictures

Both pictures are drawn by the real `drawCompositeMap`, called the way the APWorld Editor's Map tab calls it, at 3×.

- `content-sets-tidy1/composite-map-before.png`: the page served from a `git archive` of `75e45c964d`.
- `content-sets-tidy1/composite-map-after.png`: the page served from the tip.
- They come from `composite-map.html` through `render-composite-map.mjs`, a sibling of R5's `render-contact-sheet.mjs`.

What the after picture shows:

- **`meta_trial`:**
  - the meta floor, wall and open-exit recipes;
  - the swim pickup as the meta swimmer;
  - a Narrator in each maze region, from `meta:character/narrator`;
  - the water gate unchanged (⚖ water is unpresented);
  - it was painted twice: once as the fallback, once after the art loaded.
- **The control (`procgen_maze` seed 1):** pixel-identical before and after (PIL `ImageChops.difference` bbox =
  `None`), painted once.

## Part 2 — the Gate's description

`frontend/packs/meta/concepts/manifest.json`, `meta:object/gate`:

- before: "A gate that opens for whoever holds Progressive Sword. It knows its rule and says it."
- after: **"A gate that knows its own rule and says it."**

**Was the old sentence untrue anywhere?** Measured: not in any world generated today.

- A maze concept gate is chosen by `conceptSelection.selectRealisation`. It takes only a placement whose needs EQUAL
  the rule. The guardian's gate placement needs `['sword']`, and the sword's item is `Progressive Sword`
  (`concepts.js`).
- So every guardian gate's rule is exactly `Has(Progressive Sword)`.
- The sentence still restated a rule that the description cannot see. Any other realisation of the guardian, or a
  rename of the item, would have made it false without anyone noticing.
- The rule belongs to the Gate's `blocked` / `passedWith` lines, which say it as `{item}`.

**Where a pack concept's `description` is shown or baked** (searched with `grep -a` for the readers of `packConcepts`,
`resolveRole` and `loadContentSet`):

- **Text adventure, room place:** `textAdventureRoom.roomPlace`. A `place` concept's description, baked into the
  room's prose.
- **Text adventure, things:** `textAdventureRoom` region things. A `character` or `object` holder's description, baked
  into the thing.
- **Maze, things:** `mazeThings.regionThings`. Same as the text adventure. It is read on the maze panel by
  `mazeThingOverlay.mazeThingLines`.
- **No panel lists pack concepts or their descriptions.**
- **The Gate's description is shown nowhere.** The Gate presents a mechanic (`presents: guardian`), and a presenter
  fills no kind role (`contentRoles`: "it is that mechanic's look and fills no kind role"). So it is never a thing or a
  place. A gate row bakes only the look (name, colour, symbol) and the text slots.
- **Baked into no committed world:** `grep -a` finds the old sentence in no preset, only in the historical
  `content-sets-r3.md`, which is left as written. The byte change to every committed world is **0**:
  - `make-seedling-spiral-room-preset.mjs --check` is OK for all 11 states: spiral, sphere, generated,
    generated-leaf, generated-host, generated-swim, generated-chestdoor, atlas-host, atlas-location, concept-trial,
    meta-trial.
  - `make-seedling-er-preset.mjs --check` is OK.

**Other literal names in non-template fields** (`meta`, `maze` and `text-adventure` packs: every concept `name` and
`description`, and every text string):

| where | literal | true? | action |
|---|---|---|---|
| `meta:object/sword` / `swim` `name` | "Progressive Sword" / "Progressive Swim" | yes: a presenter of the `sword` / `swim` mechanic, whose item is named exactly that in `concepts.js`; and R5: no look, so not baked | none |
| `maze:character/guardian` description | "…fought with a sword" | yes: the guardian's `weakness` relation is `['sword']`, and the placement needs it | none |
| `maze:object/water` description | "…crossed by swimming" | yes: `crossedWith: ['swim']` | none |
| `text-adventure:character/guardian` description; `…/guardian/blocked` and `…/passedWith` text | "a sword", "Without a sword", "the sword" | yes, by the same relation (the item itself is `{item}`) | none |
| `text-adventure:object/water`; `…/water/*` text | "swimming", "swim" | yes, by `crossedWith` | none |
| `meta` places, characters and info | no item or region literal; regions only through `{roomName}` / `{regionId}` | yes | none |

Only the Gate's description named an item that its own field could not guarantee. Nothing else is changed.

`frontend/packs/README.md` now says that a `description` is not a template and names no item or region. It also notes
the composite map's art.

## The maze engine's import closure — identical at base and tip (diffed)

```
engineMd5 bec369878feb67081187edca62baa951 (42 files, root frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js)
```

The brief quoted `3e333bfa…` from S2. It has since moved, to `bec36987…` at the base (fire-breaks-rocks), as the brief
expected. Base and tip outputs are byte-identical, and no file this slice changed is in the list. The changed painter
files (`mazeCompositeMap.js`, `mazeThingOverlay.js`) are outside the closure.

## Tests

- **New: `frontend/modules/mazeRoom/mazeCompositeArt.test.js`** (10 tests, in node, on the recorded op log).
  - **The plain pin.** Every maze region of `procgen_maze` seed 1, `meta_trial` and `concept_trial` draws the op-log
    hash captured at `75e45c964d` before any change: `cd828ef4…`, `13619177…`, `13619177…`. `meta_trial` is pinned
    with its things removed, since the cell did not draw them before.
  - **Every committed default-stack maze region** (derived from disk: 1,186 regions) draws the same ops with its
    source, before and after its load, and asks for no redraw.
  - **The theme.** It loads through the real `meta` pack.
    - The item art resolves to the meta pack, and the gate resolves none.
    - The swim, each thing (at its offset cell) and the floor and wall are drawn from their recipes.
    - The water gate's symbol is still written.
  - **The load.**
    - One load per stack.
    - A miss redraws the host exactly once.
    - A failed load draws the fallback for good, with no redraw.
    - Node with no io stays `unavailable`.
    - A source with no slot reads the one slot.
- **New in-app row `meta-trial-composite-map-art`** (`testCases/mazeTileArtTests.js`), category `Maze tile art`. No
  batch claims that category, so it runs in **`fast`**, both boots on push. It opens `meta_trial` on the APWorld
  Editor's Map tab, where the painter loads through the browser's own io, with no seam. It checks:
  - the stack ends with `meta`;
  - the item's art resolves to the meta pack;
  - water has no art;
  - the map canvas's `drawImage` calls blit `meta#meta:object/swim`, `meta#meta:character/narrator` and
    `meta#maze:tile/floor`;
  - **then the plain control:** `procgen_maze` seed 1's stack is `[maze]`, its load brings no art, and its map canvas
    draws no image.

  One local single-row run: `[PROGRESS 1/1] meta-trial-composite-map-art PASSED 1.1s`.
  - **A defect the row found in itself:** the first run failed. `themeArtOf(undefined)` matched the Narrator, a pack
    concept that presents nothing, for an item row with no `concept`. It is fixed with a guard. This was not a defect
    of the painter.
- **Bounded vitest:** 228 files, 6106 tests, all passed. The set was `mazeRoom`, `procgenCore`, `contentPacks`,
  `artLibrary`, `tests`, `procgenPipeline/metaTrialWorld.test.js`, every `git grep -al compositeMap` suite, and every
  suite that reads `frontend/packs/` (56 files). No procgen doc was edited, so `procgenDocs` is not owed.
- **The play gates** (local, `--host` = this tree):
  - `check-concept-trial-play.mjs`: ALL CHECKS PASSED.
  - `check-meta-trial-play.mjs`: ALL CHECKS PASSED.
- **Presets:** every maze preset producer's `--check` is OK (Part 2).
- **CI** at the tip is quoted in the report-back.
