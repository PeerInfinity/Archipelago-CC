# Content sets R3: the second theme (`meta`), its trial world, and the content picker (as built)

Branch `content-r3`, based on `origin/content-r2` at `98627f3f29` (`origin/main` did not contain it when the slice
began), then MERGED with the reworked `origin/content-r2` `87676367e3` (which itself merged main `cf4d9a6874` and moved
the maze's looks into `mazeRoom/mazeContent.js`, applied by the registry hooks). The merge's conflicts were the two
generated docs-index regions (`procgenDocs/generated/docsIndex.js`, the procgen `README.md` index), resolved by
regenerating; no gitlink moved. This slice reads the maze only through its declared roles and the world document's
rows (no import of `mazeConcepts.js` / `mazeContent.js` internals; every maze world is built through
`prepareRunFromState`, so through the entry's hooks), and edits no file in the maze engine's closure. After the merge:
both producers' `--check` (`concept-trial`, `meta-trial`) match, and the bounded run (34 files, 1034 tests) passes.

| Commit | Part |
|---|---|
| `841d5d27cb` | 1. the pack `frontend/packs/meta/`, registered in `packs.json` (`packs` and the `content` table) |
| `a924fdf63e` | 2. the trial world: `META_TRIAL_STATE`, the committed `frontend/presets/meta_trial/`, its drop-down entry, its vitest pins |
| `4af02b8cd4` | 4. the pipeline panel's content picker |
| `fef63ab2ff` | 3. the in-app row `meta-trial-plays` |
| `ced9119357` | 6. docs; the regenerated procgen index; the link census |

26 files, +1746/−30 against the base `98627f3f29` (before the merge), 0 gitlinks, no submodule edited.

## 1. The pack, and every line of it

`frontend/packs/meta/`: `pack.json` (id `meta`, MIT, credit: written for this repository by its authors, hand-made for
R3, text only, no image), a `concepts` layer and a `text` layer. **No image, no character.** `packs.json` lists it and
names the content set `"content": { "meta": ["meta"] }` (C1's table: a set is a named stack of pack ids).

**Every string of the theme** (the user reviews these):

| Key | Kind / role | Field | Text |
|---|---|---|---|
| `meta:object/gate` | object, presents `guardian` (gate role, both substrates) | name | Gate |
| | | description | A gate that opens for whoever holds Progressive Sword. It knows its rule and says it. |
| | | look | colour `#a0a8b8` (grey-blue), symbol `#` |
| | | text `blocked` | The Gate stays shut. Its rule is one item, Progressive Sword, and you do not have it. Come back with it and the way to {destinationRegion} opens. |
| | | text `passedWith` | The Gate checks for Progressive Sword and finds it. That is its whole rule, so it opens. The way to {destinationRegion} is clear. |
| `meta:object/sword` | object, presents `sword` (text adventure's item role) | name | Progressive Sword |
| | | description | An item in the pool. A rule may ask for it. |
| | | text `checkMessage` | This location is a check. You checked it and received {item}. A rule that asks only for this item now passes. |
| `meta:object/swim` | object, presents `swim` (text adventure's item role) | name | Progressive Swim |
| | | description | An item in the pool. A rule may ask for it. |
| | | text `checkMessage` | This location is a check. You checked it and received {item}. A rule that asks only for this item now passes. |
| `meta:place/room` | place | name / description | The Room — A room in a generated world. It has at least one exit. |
| `meta:place/waypoint` | place | | The Waypoint — One stop on the way through this world. The seed decided where it sits. |
| `meta:place/node` | place | | The Node — On the map, this room is a node. Its exits are the edges. |
| `meta:place/seeded-room` | place | | The Seeded Room — This room was laid out from a seed. The same seed lays it out the same way every time. |
| `meta:place/waiting-room` | place | | The Waiting Room — Nothing here moves until you do. |
| `meta:place/region` | place | | The Region — The rules call this a region. You may call it a room. |
| `meta:place/stopover` | place | | The Stopover — Most rooms are on the way to somewhere else. This one may be too. |
| `meta:place/generated-room` | place | | The Generated Room — Nobody drew this room. A generator made it from a seed and a set of rules. |
| `meta:place/room-with-exits` | place | | The Room With Exits — Like every room here, this one has exits. Try them. |
| `meta:place/grid-cell` | place | | Grid Cell — On the world's grid, this room takes up one cell. |
| `meta:place/known-room` | place | | The Known Room — The logic already knows what it takes to reach this room. You got here, so you had it. |
| `meta:place/spot` | place | | The Spot — The seed picked this spot for a room. It had to put one somewhere. |

Choices against the rulings:

- **True of every world.** The Gate names its item literally: the guardian's realisation needs the `sword` concept,
  whose item is `Progressive Sword` (`CONCEPTS.sword.item.id`), and the gate's rule is `Has(Progressive Sword)` in every
  world that selects it. The text adventure's exit messages have no `{item}` placeholder (play fills
  `{exitName}`, `{destinationRegion}`), so the literal is the only way to say the rule. A place says only what every
  generated room has, including a leaf with one exit and no check ("at least one exit", "may"); no scenery.
- **The check line** says "A rule that asks only for this item now passes" rather than "the gate opens", because a
  world may have no gate on the item, or a rule that needs more than it.
- **No look for the sword and swim.** The maze's item symbol is drawn as text (`star` is drawn as the four letters,
  R2 §8), so a theme symbol would be a letter or two beside the default colour; nothing I could choose was more
  identifiable than the default. Their maze rows fall through (the maze's `item` role needs a `look`, so the theme's
  sword and swim are not candidates there).
- **The Gate is an `object`, not a `character`**: no characters in this slice.
- **Water is not presented** (⚖ the user): it falls through to each substrate's default pack.

## 2. The trial world

`META_TRIAL_STATE` (`presetDefs.js`) = `CONCEPT_TRIAL_STATE` with `params.content: ['meta']`. Committed as
`frontend/presets/meta_trial/AP_1/AP_1_rules.json` by the concept trial's producer,
`node scripts/procgen/make-seedling-spiral-room-preset.mjs --state=meta-trial` (new state row; `--check` compares
bytes), registered with `scripts/utils/register-preset.py --game-id meta_trial --seed-id 1` (`preset_files.json`), and
listed in `scripts/release/preserved-dev-presets.txt` (not public), exactly as `concept_trial`. Also a drop-down entry,
`shipped:meta-trial-demo` (Sphere growth), whose state IS `META_TRIAL_STATE`.

Measured diff against `concept_trial` (the whole document, pretty-printed): the START `region_2_2`'s payload gains
`prose.name` / `prose.description` (*The Generated Room*), its exit prose and its location's check message are the
theme's, and `procgen_metadata["1"]` gains `"content": ["meta"]`. Nothing else. The world has one text-adventure room
(the START); quota text adventure 2 realises one.

`procgenPipeline/metaTrialWorld.test.js` (new; every expected string read from the pack on disk):

- the pack presents guardian, sword and swim, and not water;
- **the compiled logic is the control's**: the document minus text-adventure `prose` and minus `procgen_metadata[p].content`
  is the concept trial's, string for string; the record is `['meta']` for player 1 only;
- the guardian exit carries the Gate's two lines; the sword location the theme's check line;
- every text-adventure room carries a theme place (the control's none);
- **the fall-through**: every maze payload, the water gate among them, is the control's byte for byte;
- the committed `meta_trial` is a fresh build byte for byte, and is listed like `concept_trial`;
- **the Gate's maze look**, on the concept library's D4 maze-only world built in memory with the real pack: every
  guardian gate carries the Gate's name, colour and symbol; water gates and item rows are the control's; the rest of
  the world is the control's.

**To SEE the Gate drawn in a maze** (the planner's ask): in the pipeline panel, Sphere growth, seed 1, start substrate
maze, 3 spheres, 0 fillers, revisit 25, quota maze 99, concepts `sword guardian swim water` ticked, items
Progressive Sword 1, Progressive Swim 1, victory 1, **Content set `meta` ticked**, Generate. Every guardian gate is a
grey-blue `#` named *Gate*; the water gates stay blue `~`.

## 3. The play gate

In-app row **`meta-trial-plays`** (`textAdventureWrapperTests.js`, category `textAdventureSubstrateWrapper`, which no
batch claims, so batch **`fast`**, on push), beside `concept-trial-plays`. It loads `meta_trial` as a document and
reads every expected word from the pack the document records (`procgen_metadata["1"].content`, fetched from `packs/`):

1. the START's title is a `meta` place's name and its arrival line is that place's description;
2. the guarded exit is refused with the Gate's `blocked` line; with the sword granted it opens and moves the player
   with its `passedWith` line (the sword is removed after);
3. the maze's water gate in the deserialized world has the maze DEFAULT pack's water name, colour and symbol, and its
   row is the `concept_trial` preset's byte for byte.

⚠ The brief's "the maze's gate row draws with the Gate's colour and symbol" is not checkable in this world: the
guardian is the TEXT ADVENTURE's gate; the maze's only concept gate is water (`conceptTrialWorld.test.js` pins
`obstacleLib == ['water_gate_0']`). Agreed with the planner: the row checks what this world shows; the Gate's maze
look is pinned in vitest (§2). ⚠ The warehouse cannot tell `meta_trial` from `concept_trial` (same game name, same
regions, identical maze payloads); the text-adventure half is what identifies the document.

## 4. The picker

`procgenPipelineUI.js` `_renderContentField()`: a **Content set** row in the Parameters section, right after the
Concepts row, as small as it: a label, the text *built-in →*, and one checkbox per choice (tooltip = the pack's title).

- **Choices** (`worldContent.selectableContentPacks(packsJson, registry)`): every pack a stack in `packs.json`'s
  `content` table names, in first-named order, less every pack a registry entry declares as `defaultContentPack`. No
  hard-coded list. Fetched once (`loadSelectableContentPacks`, through `browserPackIo`), re-rendered when it lands;
  "…" while loading, "(none available)" when empty, "(unavailable: …)" on a fetch error.
- **A pick** writes `params.content` in the choices' order (`pickedContentList`), so the order shown is the stack
  order; an id the world names that the page does not offer is kept, in front. Saves through `_saveToLocalStorage`,
  so it persists with the params (C3's round trip).
- Tests: `procgenPipelineUI.test.js` (one row after the concepts row in every mode, a box per choice, ordering,
  saves, the kept id, loading/none states; the R1 section-hash pins splice the new row out as they do the concepts
  row); `worldContent.test.js` (the choices rule on a fixture registry, refusal of a bad `packs.json`, no default pack
  offered by the real one, the pick order); **`contentPicker.test.js`: pick `meta` on a panel holding the concept
  trial → `capturePresetState` → `prepareRunFromState` → the world records `content: ['meta']` for player 1 and IS the
  committed `meta_trial` byte for byte; the pick survives save and reload.** No browser row drives the click (the
  vitest covers pick → Generate's assembly; the panel's real Generate over the new drop-down entry is
  `check-procgen-presets.mjs`, a box gate, not run here).

## 5. What can fill what: `rolesFilledBy` for `meta` against every registered substrate

Measured with the real registry (`scripts/procgen/reference/registry.mjs` `loadRegistry`) and `loadContentSet(['meta'])`:

| Substrate | Default pack | Role | Filled by `meta` |
|---|---|---|---|
| bounce | — | (declares no roles) | |
| cloudberry | — | (declares no roles) | |
| flash_seedling | — | (declares no roles) | |
| flash_seedling_gen | — | (declares no roles) | |
| jta | — | (declares no roles) | |
| maze | maze | `gate` | `meta:object/gate` |
| maze | maze | `item` | — (the theme gives the sword and swim no `look`) |
| noiz2sa | — | (declares no roles) | |
| omsi | — | (declares no roles) | |
| text_adventure | text-adventure | `gate` | `meta:object/gate` |
| text_adventure | text-adventure | `item` | `meta:object/sword`, `meta:object/swim` |
| text_adventure | text-adventure | `place` | all 12 `meta:place/*` |

So "as generic as possible, every substrate" is, today, bounded by the roles: two substrates declare any. Nothing
was added to the substrate chart.

## 6. Docs

`docs/json/developer/procgen/concepts.md`: **§ Selecting a content set** (the panel's row, what it offers, the order,
how to add a theme) and **§ The theme trial world** (what `meta` presents in each substrate, the fall-through, the
recipe to see the Gate in a maze). `pipeline-presets.md`: the `meta-trial-demo` row, the committed preset paragraph,
the slow test's `prepareRunFromState`. `frontend/packs/README.md`: the `meta` pack. Generator re-run
(`generate-procgen-reference.mjs`: 0 findings, `--check` passes); link census 404 → 406 (`docLinks.test.js`,
`docsRender.test.js`).

## 7. Tests run locally (bounded, ruling 52)

`npx vitest run` over: the brief's list (`worldContent`, `conceptTrialWorld`, `presetDefs`, `procgenDocs`,
`contentPacks`, `packConcepts`, `textLibrary`), the touched and new files (`metaTrialWorld`, `contentPicker`,
`procgenPipelineUI`), and every default-tier test that reads `preset_files.json`, `preserved-dev-presets.txt`,
`SHIPPED_PRESETS` or `packs.json` (`git grep`; 42 files, 1183 tests): all passed except
`flashPanel/seedlingPlaythroughExportLoad.test.js`, which cannot load in a worktree made without `--with-wasm`
(`flashPanel/wasm/builds.json` ENOENT, the known no-wasm red, not this slice). Also the `engineMd5` tests (green) and
`make-seedling-spiral-room-preset.mjs --state=concept-trial --check` (unchanged). The slow tier's
`presetDefs.generate.slow.test.js` was edited (it now builds each shipped preset with `prepareRunFromState`, as the
new preset names a theme and `buildRunFromState` refuses a non-default stack by C3's guard); it runs in CI's slow tier.

## 8. What the code overturned or added

1. **The Gate cannot be seen in the trial world's maze** (§3): the concept trial puts the guardian in the text
   adventure. Pinned on the D4 maze world instead (planner agreed).
2. **A preset that names a theme cannot go through `buildRunFromState`.** Adding `meta-trial-demo` to
   `SHIPPED_PRESETS` would red the slow shipped-preset test (C3's guard refuses a stack naming `params.content` with no
   awaited load); the test now loads first (`prepareRunFromState`), which is what the panel and
   `check-procgen-presets.mjs` already do. Every other test that picks a shipped preset picks it by id.
3. **The text adventure's gate lines have no `{item}` placeholder**, so a theme that names the rule names the item
   literally. True for the guardian (always the sword); a theme that wants one line for gates of varying items would
   need the wrapper to offer `{item}` (or the rule) to exit messages.
4. **A theme cannot give the maze's items a clearly better look** while the maze draws an item's symbol as text
   (`star` → "star"). A drawn-symbol vocabulary (shapes) is a maze play-time change, R2b territory.
5. **Generic across substrates is bounded by roles**: only the maze and the text adventure declare any (§5).
6. `preset_files.json`'s `meta_trial` row records `"seed": 8` (the state's seed, read from the file by
   `register-preset.py`); `concept_trial`'s says 1. Cosmetic; left as the tool wrote it.

## 9. CI

Quoted at the final tip in the REPORT BACK message (not in a further commit). A browser-batch dispatch
(`test-templates.yml`) ran at the code tip `ced9119357` to surface a red early.

## Next slice

The REPLAN (three slices since the last), with the user: the chart sentence; R2b (the maze tileset; the no-image
tileset gap); whether the next theme step is characters (step 3, the text adventure's schema v0) or more roles for the
substrates that declare none.
