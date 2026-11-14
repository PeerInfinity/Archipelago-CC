# Content sets R5 — a pack concept's art draws the maze's gates and items; the chart says what is themeable

Branch `content-r5`, base origin/main `39e8a29f7f`. Two parts, one commit each:

- Part 1 `b2a2cea36f`: maze concept gates and items draw from a pack concept's `art` key at play.
- Part 2 `1407456ba8`: the substrate chart line "Themeable: <roles>".

Rulings implemented (⚖ the user, 2026-11-14): replan items 2 and 4; Q8 (art resolves by key at play); the tileset
fallback ruling; "simple shapes, simplicity over deliberate silliness".

## Part 1 — how a gate's or item's art is found at play

The brief's recommended design held against the code. Nothing is baked, and no committed world's bytes move.

1. A maze gate or item row already names its mechanic: `obstacleLib[id].concept` (a concept gate) or
   `itemLib[id].concept` (a concept item). In `meta_trial` these are `water`, `sword` and `swim`.
2. **The load.** `mazeRoomUI` passes the maze entry's `contentRoles` to `mazeTileArt.loadMazeTileArt`. With roles,
   the load reads the stack's `concepts` layer as well as `art`, which R2b's load already read. Without roles it reads
   `art` alone, as before.
3. **The lookup.** `mazeTileArt.conceptArtKeys(contentRoles, packConcepts, ids)` works per role and per mechanic the
   role accepts (`accepts.presents`). It picks the pack concept that presents that mechanic and carries C1's top-level
   `art` key, latest pack in the stack first. That ranking is the one `mazeContent.presentedLook` uses for the baked
   look. A role's `needs` are not asked: they say what a concept needs in order to be baked (a `look`), and art is not
   baked. So a theme can give a mechanic a picture without a look of its own. A later pack that presents the mechanic
   without art does not hide an earlier pack's art. The result is `{ role: { mechanic: { key, concept, pack } } }`,
   carried on the view's `tileArt` as `conceptArt`.
4. **The draw.** `mazeRoomRender.drawWorld` (outside the closure) asks `conceptArtFrame(tileArt, role, mechanic)`.
   - A concept gate: when there is a frame, the art fills the cell. A closed gate's art is drawn whole. A passed
     gate's art is drawn at `CONCEPT_ART_CLEARED_ALPHA` (0.4), the cleared skin's own alpha. Otherwise the gate is
     drawn with `mazeConcepts.paintConceptGate`, as before. That function is in the closure and is unchanged.
   - A concept item: when there is a frame, the art replaces the disc and its label. Otherwise the disc is drawn as
     before. A collected item is drawn neither way.
5. **The fallback** (⚖ "If an image isn't available…"). Each of these draws the baked colour and symbol, exactly as
   with no art:
   - no art loaded;
   - no pack concept gives the mechanic an art key;
   - the stack's art does not carry the key;
   - the sheet did not decode or rasterise.

   The filter is written in `mazeTileArt.js`, not taken from `contentRoles.candidatesForRole`. `contentRoles.js`
   imports `procgenCore/concepts.js`, which is in the engine closure. `mazeTileArt.test.js` pins that nothing
   `mazeTileArt.js` imports is in the closure.

### What is drawn over or around the art (read from the painter, state by state)

- **A closed gate on an exit:** the exit's `exitBlocked` red fill is drawn first, and the art goes over it. The Gate
  recipe is inset (its outline runs from 2 to 18 of 20), so the red frame stays visible round it.
- **A closed gate on a location:** the 2 px `locationBlocked` red border is drawn after the art, so it is on top.
- **A passed gate:** the open exit (the meta `maze:tile/exit` art, or the default green) shows under the art, which is
  drawn at 0.4.
- **An item:** only an item that has not been collected is drawn. A red border on a closed location still goes over
  the item.
- **Counts:** the counts of the `exitBlocked` and `locationBlocked` ops are the same with and without art (pinned).

### The recipes added (`frontend/packs/meta/art/manifest.json`; the R4 style: 20×20 box, stroke 2, the R4 palette)

| key | named by | looks like | drawn over it |
|---|---|---|---|
| `meta:object/gate` | `meta:object/gate` (presents `guardian`) | a grey-blue `#a0a8b8` square outlined in ink, inset 3 px, with two ink dot eyes and an ink keyhole (plan §5) | a closed exit's red frame, round it; a blocked location's red border, on top; passed → drawn at 0.4 over the open exit |
| `meta:object/sword` | `meta:object/sword` (presents `sword`) | an upright sword: a pale blade outlined in ink, a crossguard in the maze's sword gold `#c0a040`, an ink grip and pommel | a blocked location's red border, if any |
| `meta:object/swim` | `meta:object/swim` (presents `swim`) | an ink swimmer's head above two rows of waves in the maze's swim teal `#40b0c0` | a blocked location's red border, if any |

- `meta`'s concepts now carry `"art"` on the Gate, the sword and the swim. Water stays unpresented (⚖), so it falls
  through and draws the default way.
- The default `maze` pack carries no art keys, so every plain world draws as before.
- **The bake is unchanged.** `meta`'s sword and swim have no `look`, so `candidatesForRole` (`needs.look`) still
  excludes them from the `item` role. The colour and symbol baked into an item row are still the maze pack's. The
  Gate's baked look is still `#a0a8b8` / `#`. Both are pinned in `mazeConceptArt.test.js`.
- Licence: the recipes are hand-made for this repository under its MIT licence. The pointer is the `meta` pack's
  `pack.json` (`licence: "MIT"`, `credit`), which is unchanged. No image file was added.

### Contact sheet (for the user's review: the meta theme's look is still open)

`CC/docs/cloud-reports/content-sets-r5/contact-sheet.png`, from `contact-sheet.html` through
`render-contact-sheet.mjs`, a sibling of R4's.

- Each card is drawn by the real painter on `meta_trial`'s committed water room (`region_2_3`), default beside meta,
  with the recipe alone.
- The cards are: the Gate closed and passed, Progressive Sword, Progressive Swim, and Water (falls through). The whole
  room is also shown both ways.
- `meta_trial` has no guardian gate and no sword pickup, so those two cards are staged on the same room: the water
  gate is relabelled as a guardian with the Gate's baked look, and the swim pickup is relabelled as the sword.
- Status line: `concept art: gate/guardian → meta:object/gate; item/sword → meta:object/sword; item/swim →
  meta:object/swim; failed sheets: 0`.

## Part 2 — the chart line

Statement **P7** (play group) is `"Themeable"`. Its field is `contentRoles`, and its answer comes from
`contentRolesOf(entry)`: the role ids in the entry's declared order, joined by `", "`. No role or substrate is named
in code; the chart's nameless-source pin still holds.

**The form the chart's conventions forced** (reported as the brief asks):

- The chart is a matrix of statement × substrate. A row's label is the statement, and a ✓ cell's degree is its text.
  So the user's line appears as:
  - **Cards** (the hover text everywhere, `cardText`, and the generated page's card list): `Play — Themeable: gate,
    item`. This is the user's exact `Themeable: <roles>` after the card's standing group prefix.
  - **The matrix row:** `P7 | Themeable | ✓ gate, item | …`.
- **"Blank where none" is blank on the cards only.** A card lists only ✓ and partial lines, so an entry with no roles
  has no Themeable line at all. The matrix has no blank cell kind. Every cell prints a mark from `CELL_MARKS`
  (✓ ✗ ◐ n/a), in both renderers (the generated page and the Registry panel's Plain mode).
- So the seven entries with no roles read **✗**, the "it cannot" mark, not the word "none". "n/a" ("does not apply")
  would claim theming does not apply to them, which is untrue.
- A true blank would need a fifth cell kind in `CELL_MARKS` and both renderers' legends. I did not add one: it is
  outside this slice.

Generated, for every substrate (`docs/json/features/procgen-substrates.md`, from `generate-procgen-reference.mjs`):

| substrate | P7 cell | card line |
|---|---|---|
| bounce | ✗ | — |
| cloudberry | ✗ | — |
| flash_seedling | ✗ | — |
| flash_seedling_gen | ✗ | — |
| jta | ✗ | — |
| maze | ✓ gate, item | *Play* — Themeable: gate, item |
| noiz2sa | ✗ | — |
| omsi | ✗ | — |
| text_adventure | ✓ gate, item, place | *Play* — Themeable: gate, item, place |

The chart now has 30 statements and reads 40 registry fields; `contentRoles` has left the "not yet read" list
(60 → 59). `generate-procgen-reference.mjs --check`: "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE".
Doc-link census (run with `docLinks.test.js`): 29 documents, **415 links**, unchanged by this slice.

## Engine closure — identical at base and tip (diffed)

```
engineMd5 3e333bfa0a7692f8120aeaa9a1591119 (42 files, root frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js)
```

No file in the list changed. The edited painter files are outside the closure: `mazeRoomRender.js`, `mazeTileArt.js`
and `mazeRoomUI.js`.

## Preset checks (nothing baked, so no bytes moved)

- `make-seedling-spiral-room-preset.mjs --state=meta-trial --check`: OK, matches a fresh build.
- `make-seedling-spiral-room-preset.mjs --state=concept-trial --check`: OK, matches a fresh build.
- `extract-seedling-art-packs.mjs --check`: OK. It walks `packs.json`; the art library shared with the Seedling JS
  runtime is not touched.

## Tests

- **New:** `frontend/modules/mazeRoom/mazeConceptArt.test.js` (16 tests).
  - The lookup: the latest presenter with art wins; a later presenter without art does not hide it; `needs` are not
    asked; a mechanic nobody gives art is absent.
  - The load decodes only the concept keys the art carries. Without roles it reads no concepts layer.
  - The fallback, four ways (no art; a load without roles; a key absent from the stack; a sheet not decoded): the
    gate's symbol and the item's disc are drawn exactly as with no art.
  - On `meta_trial`'s water room: the swim pickup is drawn from `"meta#meta:object/swim"` and its disc is gone; the
    water gate keeps its symbol.
  - A staged guardian gate: drawn whole while closed, at 0.4 once passed; its red ops are as many as without art.
  - A collected item is not drawn.
  - The bake is untouched. A plain world resolves no concept art. The Gate recipe is inset.
- **Changed:**
  - `mazeMetaArt.test.js`: the manifest may also carry the keys its own concepts name as `art`, and each one must be
    drawn.
  - `mazeTileArt.test.js`: the empty-stack result now includes `conceptArt: {}`.
  - `procgenCore/substrateCapabilities.test.js`: P7 is in the id list, plus 4 P7 tests, all derived from the entries.
- **In-app row** `meta-trial-maze-tile-art`, batch **fast**, extended:
  - The panel's `getTileArtStatus().conceptArt` resolves the swim item to the theme's key.
  - A repaint draws it from `"meta#meta:object/swim"`.
  - Its cell shows the recipe's first mark (the ink head, `#2e3440`).
  - The water gate resolves no art.
  - The row turns discovery mode off while it reads the canvas, as it already did for fog.
  - One local single-row run: `[PROGRESS 1/1] meta-trial-maze-tile-art PASSED 0.7s`.
- **Bounded vitest:** artLibrary, contentPacks, mazeRoom, procgenCore, procgenDocs, tests, substrateRegistryPanel,
  metaTrialWorld, worldContent, and every suite that walks `frontend/packs/` (found with `grep -a`): 217 files, all
  passed. The suite number comes from CI.

## What the shape format lacked (R4's list held; nothing new was needed)

- **Text:** the Gate's keyhole is a circle plus a polygon, not a glyph.
- **Clipping:** the gate is inset instead of clipped.
- **Per-state variants:** a passed gate is the same recipe at the painter's alpha, not a recipe of its own. A
  dedicated "open Gate" picture would need a state key on the role's art. The painter's alpha reads well enough on
  the contact sheet.
- **A polyline:** the swim waves are eight separate `line`s.

## What the code overturned or added to the brief

- **The painter's split.** `paintConceptGate` lives in `mazeConcepts.js`, which is in the engine closure. So the art
  branch sits in `mazeRoomRender.js`, before the call, and the closure function is untouched.
- **The lookup's filter.** It could not reuse `contentRoles.candidatesForRole`: that module imports `concepts.js`,
  which is in the closure, and the closure pin forbids it. The filter asks only `accepts.presents` and an `art` key.
- **The chart:** "blank where none" is forced to ✗ in the matrix (above).
- **Not covered:** the composite map (`mazeCompositeMap.js`) still draws a concept gate as its skin. It has no
  tile-art seam (R2b gave it none), and the brief scoped this slice to the maze's own painter.
