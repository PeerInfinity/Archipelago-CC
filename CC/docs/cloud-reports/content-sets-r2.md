# Content sets R2: the maze loads its baked content from its default pack (as built)

> ⚠ **REWORKED** (§ Rework, near the end): the consumer described in §2–§3 no longer lives in `mazeConcepts.js` /
> `mazeRoomEngine.js`. It moved, with the same behaviour, to `mazeRoom/mazeContent.js` as a presentation pass the
> registry hooks run after the engine; both engine files are byte-identical to main's. §9.10's table regeneration is
> undone (the table is main's).

Branch `content-r2`, based on `origin/content-r1` (`085800fdc8`). `origin/main` did not contain `085800fdc8` when this
slice began. Three code commits, then this report:

| Commit | Part |
|---|---|
| `3faae00e00` | A1. the default pack `frontend/packs/maze/`, registered in `packs.json` |
| `7f1680112b` | A2–A4. the declaration, the consumer, the first declarer's pins, the tests, the regenerated registry modules |
| `1456b060e9` | A4. docs: `maze.md` § Content roles; `concepts.md` names the maze's pack; regenerated index and registry table |

No gitlink moved. No submodule was edited (`frontend/modules/shared/` is read, not touched). No second pack was added
under `frontend/packs/`. Part B built nothing.

## 1. The pack

`frontend/packs/maze/` (id and key namespace `maze`). Hand-made, MIT, credited to this repository's authors
(`pack.json`). One layer, `concepts`; no `text` layer, because generation writes no maze string that is not a name
(measured: the only strings the maze's generation writes into a world are the concept gate's `name` and, from the
shared library, item and obstacle `name`s, which are ids or AP names).

| Key | Kind | Presents | `name` | `look` | Was |
|---|---|---|---|---|---|
| `maze:object/sword` | object | `sword` | Progressive Sword | `#c0a040` / `star` | `CONCEPTS.sword.item` (via `itemRowsOf`) |
| `maze:object/swim` | object | `swim` | Progressive Swim | `#40b0c0` / `star` | `CONCEPTS.swim.item` |
| `maze:character/guardian` | character | `guardian` | Guardian | `#8c5a2c` / `G` | `MAZE_CONCEPT_REALISATIONS.guardian.art` |
| `maze:object/water` | object | `water` | Water | `#2f6fd0` / `~` | `MAZE_CONCEPT_REALISATIONS.water.art` |

Each value was copied from the code it replaced (and the committed `concept_trial` world carries the water row
`"name": "Water", "color": "#2f6fd0", "symbol": "~"` and the sword/swim rows exactly so). `mazeContent.test.js` pins
the item looks equal to the concept table's own rows, so the two cannot drift silently.

## 2. The declaration

`mazeRoomLibrary.js` declares `defaultContentPack: 'maze'` and `contentRoles`, both defined in `mazeConcepts.js`:

| Role | `accepts` | `needs` | Writes | `why` |
|---|---|---|---|---|
| `gate` | `presents: [guardian, water]` | `look` | the concept gate's `name`, `color`, `symbol` | A rule gate the planner selected a concept for is named and painted as that concept. |
| `item` | `presents: [sword, swim]` | `look` | the item row's `color`, `symbol` | An item concept the world names is drawn on its tile in the concept's colour and symbol. |

- **Two roles, split by what the maze writes** (`ROLE_WRITES`, code, ⚖ Q6). An item row's `name` is the AP item
  name: it is logic, so a theme never renames it. The pack concept still carries a `name` (the contract requires one).
- `MAZE_CONCEPT_REALISATIONS` keeps the logic half only: `guardian` / `water` lost their inline `art`.

## 3. The consumer

`mazeConcepts.js`:

- **`presentedLook(contentSet, role, concept)`**: the keys `candidatesForRole` gives (right `presents`, a `look`),
  narrowed to those presenting `concept`, sorted by their pack's position in `contentSet.ids`, latest first; the
  first wins and gives `{name, color, symbol}`. `null` when none.
  ⚠ **Not `concepts.presenting(id)`**, the brief's suggestion. `presenting` returns the last pack that presents the
  id whether or not it fills the role, and in every world with a text-adventure region the text adventure's default
  pack is later in the stack (registry order: `maze` < `text_adventure`) and presents `guardian` / `water` with no
  `look`. `presenting('guardian')` there returns the text adventure's concept. This is R1's delta 4 in another form;
  `mazeContent.test.js` pins it.
- **`conceptGateFor`** resolves the gate's look AFTER `selectRealisation`'s draw, so a content set never changes which
  concept is chosen, and writes the fields in the order the old code did (`name, color, symbol`), so the key order
  and the bytes are unchanged.
- **`presentItemLib(itemLib, contentSet)`**, called by `generateRegionCore` where it threads the item library onto the
  world: every row the world's concept list marked (`concept: '<id>'`, `presetRun.mergedItemLib`) whose concept the
  `item` role accepts gets the role's fields in place (key order kept). A library with no marked row is returned as
  the SAME object and nothing is read, so a world that names no item concept needs no set. A library shared between
  regions is never mutated.
- Refusals by name (`MAZE_CONTENT_REFUSALS.noContentSet`, `.noPresenter`). The region seam always hands the set (C4),
  so no pipeline caller can reach `noContentSet`.

## 4. What the first declarer owed, done

| Pin | Change |
|---|---|
| `presetRun.test.js` | R1's two remaining maze-only exact-shape `regionParams` asserts (spiral, sphere growth) now expect `defaultContentParams(bundle)` |
| `worldContent.test.js` channel tests | they used `maze` for "a substrate that declares nothing"; now an unregistered id (`NO_DEFAULT`). The append test expects `effectiveContentStack(...)` |
| `worldContent.test.js` C4 block | as R1 predicted, "declare the fixture pack on entries that have none" now declares it on NONE. The fixture OVERRIDES one entry's default (`TARGET`, the first of the world's substrates that declares one, the maze). The fixture pack is a copy of TARGET's own committed default pack under its own namespace (every key re-prefixed), so the byte-equality cases still hold, and the cached set is asserted not to contain TARGET's real pack |
| `regionJobContent.test.js` (apworldEditor) | its target is the maze: `memIo` serves a registered default pack from disk (uncounted), ids expect the stack, and the C4 block's control is built at collection (an earlier `afterEach` empties the cache) |
| `conceptSeam.test.js` | the probe entry declares no pack, so the probe hands the maze's default set in `params` (the seam passes it through; the identity assertion holds) |
| `mazeConcepts.test.js`, `mazeConceptPaint.test.js`, `conceptWorld.test.js`, `conceptTrialWorld.test.js` | read the looks from the pack instead of `MAZE_CONCEPT_REALISATIONS[c].art`; direct placer calls that offer a concept hand the default set |
| registry docs | generator re-run: the `contentRoles` / `defaultContentPack` table rows gain the maze column; 0 findings; `--check` passes |
| link census | 402 → 404 (`docLinks.test.js`, `docsRender.test.js`): concepts.md → maze.md § Content roles, and back |

## 5. Byte-equality evidence

**The surface, measured**: 37 committed `rules.json` files carry a `"substrate": "maze"` sidecar; **30** carry
`procgen_metadata` (matching the plan). The other 7 (`omsi_*` ×5, `seedling_atlas_maze`, `seedling_playthrough_maze`)
are not compiled by procgen.

**Why the consumer cannot have moved 29 of them.** Both consumer paths write a row carrying `concept` (a concept gate's
def has `concept`; a presented item row is a marked row, which the serializer always carries). Measured over all 37:
only `concept_trial/AP_1` holds any `"concept":` key (5 rows). The consumer adds no rng draw. The set rides on
`regionParams` with a `toJSON` that answers `undefined`, so it is never written.

| World(s) | Instrument | Result |
|---|---|---|
| `concept_trial/AP_1` (the one that names concepts) | `conceptTrialWorld.test.js` T4 D2 (a fresh build, byte for byte) and the `worldContent.test.js` control | equal |
| same | `make-seedling-spiral-room-preset.mjs --state=concept-trial --check` | equal |
| `seedling_spiral_room`, `seedling_sphere_room`, `seedling_generated_{room,leaf,host,swim,chestdoor}`, `seedling_atlas_{host,location}` | `make-seedling-spiral-room-preset.mjs --state=… --check` (9 states) | all equal |
| `procgen_maze/AP_1..3` | `check-procgen-maze-recipe.mjs` (a headless gate) | all equal |
| `procgen_topdown/AP_1..3, 7..12` | `generate-topdown-preset.js` per `generate_all_templates.sh`'s recipe, then `cmp` | all equal |
| `procgen_topdown/AP_4..6` (APCalc sources) | same | **DIFFER, pre-existing**: only `world["1"].slot_data` (copied from the source preset). The same recipe on `origin/content-r1` gives the same bytes as this branch. The APCalc source presets were re-exported 2026-11-05 (`31644f2ecf`), after these top-down presets (2026-10-23, `779d2c5801`). No maze payload differs. Not this slice's: flag for its owner |
| `cloudberry_maze_mix_worldgen` | `check-cloudberry-sphere.mjs --check` | **not run locally**: it needs Generate.py and a WebGL page (CI `cloudberry-e2e.yml`). No concept row, so unaffected by construction |
| `seedling_atlas_sphere` | `check-atlas-sphere-roundtrip.mjs` | **not run locally** (world_generator + Generate.py). No concept row |
| `multiworld/AP_05594871498841892311` (3 files) | Generate.py over worldgen packages (`generate-presets.yml`) | not run; their maze payloads come from committed worldgen sidecars, not from the JS placer. No concept row |

- **No instrument regenerates every one of the 30**; together the four above cover 25 (concept_trial, 9 seedling
  states, 3 procgen_maze, 12 procgen_topdown of which 3 are drift-red before this slice). The 5 not run here
  (cloudberry mix, atlas sphere, multiworld ×3) are covered only by the "no `concept` row" argument, plus CI.
- ⚠ The `procgen_topdown` regeneration has no standing gate (I ran the recipe by hand); that is how APCalc's drift
  went unseen.
- **The rebuild comparison** (`conceptRebuild.test.js`; `worldContent.test.js`'s append path: rebuild, re-attach,
  append, logic equals the control's) passes.
- `ci-producer-checks.mjs` (the 98 `plan-seedling-*` and tape producers; not preset producers): every producer rc 0.
  The battery printed `TREE-MOVED` with an empty file list: I committed in this tree while it ran, so HEAD moved
  under it. It is re-run by CI at the tip.

## 6. The positive pin

`frontend/modules/mazeRoom/mazeContent.test.js` (new), a FIXTURE theme in memory (default packs from disk): the Gate
presents `guardian` with another name and look; it presents `swim` with a look; it presents `water` WITHOUT a look.

- The declaration holds the contract; every realised concept is accepted by exactly one role and filled by the
  default pack; the items' default looks equal the concept table's rows.
- Precedence: a later pack with a look wins; one without a look falls through; reversed stack order shows the default;
  in a maze + text-adventure stack the text adventure's lookless guardian does not hide the maze's (and
  `presenting()` alone would have returned it).
- Refusals by name (no set; no presenter); a rule no concept realises needs no set.
- `presentItemLib`: an unmarked library is returned as is with no set; the default pack writes back exactly the rows
  it was given (value and key order); a theme recolours what it presents and keeps the AP name; the input is not
  mutated; a marked row with no set is refused.
- **A whole world** (the concept library's D4 maze sphere world, which realises both gates and both items; not a
  committed preset): with `content: ['theme']`, the world minus the concept rows' presentation and the record is
  string-equal to the control's; every guardian gate carries the fixture's name, colour and symbol (the control's
  the default pack's); the water gates and sword rows equal the control's; the swim rows carry the fixture's colour
  and symbol and keep `Progressive Swim`.

## 7. Census: maze content that stays built in

| Where | What | Why it stays |
|---|---|---|
| `shared/procgen/library.js:30` `DEFAULT_ITEMS` (SUBMODULE) | 7 rows: `victory` (`#f5d020`/`star`), `key_{red,green,blue,yellow,purple,orange}` (colour/`key`) | Shared by every tile substrate and the pipeline, in a submodule. Keys are the mechanic concept `key`, which the maze does not realise (`conceptRealisations` has 4), and a role may only `present` a concept its entry realises (C2) |
| `shared/procgen/library.js:98` `DEFAULT_OBSTACLES` (SUBMODULE) | 7 rows: `door_*` ×6 (colour, no symbol), `logic_gate` (`#b06eb8`) | Same; doors are the unrealised concept `door`; `logic_gate` is no concept at all |
| `mazeRoomEngine.js:3737` `logicGateBase` fallback | `Logic Gate`, `#b06eb8` | used only when the world's obstacle library lacks `logic_gate`; not a concept |
| `procgenCore/concepts.js` item rows of `sword` / `swim` / `key` | name, colour, symbol | the neutral table (⚖ Q2): the world-level item library (`mergedItemLib`) every substrate reads. The maze's payload copies now come from the pack; the table's own values stay for the other readers |
| `mazeConcepts.js:210` `paintConceptGate` fallback | `#b06eb8` | play-time default for a gate with no colour |
| `mazeRoomRender.js:600` door fallback | `#b84040` | play-time default |
| `mazeRoomRender.js` `COLORS`, `mazeSeedlingSkin.js`, `mazeSeedlingSprites.js` | the palette, the Seedling skin and sprite tables | play-time, the tileset question (Part B, §8), for R2b |
| per-substrate `libraryItems` (bounce, cloudberry, Seedling gen, noiz2sa) | their item rows | other substrates' content, drawn by the maze only as foreign items |

## 8. Part B: the play-time half (measured; nothing built)

### `COLORS` (`mazeRoomRender.js:133`): 22 keys, not the plan's 25

| Key | Value | Drawn with it (file:line) | Could a pack own it? |
|---|---|---|---|
| `floor` | `#2a2a2a` | tile base layer `mazeRoomRender.js:520`; Seedling skin's edited cells `mazeSeedlingSkin.js:204` | yes: floor tile |
| `wall` | `#000000` | base layer `:520`; facing tick `:816`; skin edits `mazeSeedlingSkin.js:204`; `seedlingDemo/watchGenOverlay.js:220` | yes: wall tile |
| `entrance` | `#3aa85a` | entrance border `:730` | yes: entrance marker |
| `exit` | `#3aa85a` | exit fill `:591` | yes: exit tile |
| `exitBlocked` | `#d04040` | closed-gate exit fill `:591` | partly: a gate state, UI-ish |
| `locationBlocked` | `#d04040` | gated location border `:721` | UI (a state signal) |
| `player` | `#4aa8ff` | the player disc `:807`; `mazeLabView.js:847` | yes: the player |
| `grid` | `#1a1a1a` | grid lines `:739` | UI |
| `manaTile` | `#5ac8e8` | mana refill tile `:684` | yes: a tile kind |
| `laneArmed` / `laneSilent` | `#d04040` / `#808080` | arrow-trap lanes, pulser reach `:393, :401, :769` | state signal (UI) |
| `trap` | `#e0c040` | arrow trap body `:776` | yes: trap |
| `block` / `blockEdge` | `#c8a06a` / `#2a1c0c` | pushable block `:457–474`; `mazeElementOverlay.js:239–240`; `watchGenOverlay.js:236` | yes: block |
| `button` | `#ffd75f` | button `:444–445`; `mazeElementOverlay.js:226, 231`; `watchGenOverlay.js:238` | yes: button |
| `pullLive` / `pullInert` / `pullTrap` / `pullMouth` | `#d0602a` / `#808080` / `#a8401a` / `#000000` | lava pull `:420–432` | body yes; live/inert is a state signal |
| `blockStruck` / `blockDormant` | `#d05a3a` / `#7ab8d8` | block kinds `:463, :471` | yes: block kinds |
| `pulser` | `#e0e070` | pulser body `:400` | yes |

Not in `COLORS` but drawn from the WORLD DOCUMENT: items (`getItemRenderHints`, `shared/procgen/library.js:284`: the
row's `color`, and its `symbol` as a text label, `mazeRoomRender.js:653`: `star` is drawn as the four letters
"star"), doors (`obstacle.color`, `:600`), concept gates (`paintConceptGate`). The composite map uses
`procgenCore/compositeMapRenderer.js`'s own `COLORS`, a different table (`mazeCompositeMap.js:31`).

So of 22 keys, about 14 name a thing (floor, wall, entrance, exit, player, mana tile, trap, block ×4, button,
pulser, pull body) and 8 are state signals or UI (exitBlocked, locationBlocked, grid, lanes ×2, pull live/inert,
pull mouth).

### `BODY_CLASSES` (`mazeSeedlingSprites.js:53`) and how a body class becomes a sprite

10 rows: `rock`, `door`, `rope`, `pole`, `gate`, `block`, `button`, `trap`, `pull`, `pulser`, each a list of Seedling
entity CLASS names (`BreakableRock`, the `LOCKS`, `RopeStart`, `DarkTrap`, …). `seedlingCensus` finds, for each maze
object, the level ENTITY on its cell whose class (`seedlingSemantics.entitySemantics`) is in the row (refused by name
on none or two); the sprite is then that entity's art from the Seedling skin tables (`seedlingSolidsSkin.KEYS` /
`RESPONDER_ART`, `seedlingPuzzleSkin.BLOCKS`, `seedlingTrapSkin.KEYS`, `seedlingPlayerSkin.SUIT_KEYS`,
`seedlingRoomBodySkin.KEYS`, `seedlingMachineSkin.KEYS`; items via `seedlingEnemySkin.apItemOps`, the Archipelago
logo for an item no Seedling table names), frame 0, drawn when `art.has(key)` (`mazeSeedlingSprites.js:266`), else the
maze's marker stays. The room under them is `roomOps` over the level's own tile ids (`seedlingSkinRenderer.js:173–190`,
keys `seedling:tile/ground`, `…/water`, … one per Seedling tile id).

**The art keys** are all `seedling:*` (and `archipelago:pickup/item`), read from the stack `graphics.seedling` =
`["seedling", "archipelago"]` in `packs.json` (`SEEDLING_GRAPHICS_STACK`, `mazeSeedlingSkin.js:33`; loaded by
`loadSeedlingArt`, `:152`, `only: ['art']`).

⚠ **The Seedling skin is not a tileset over maze tile kinds.** It paints the LEVEL's own tiles (the map document's
tile ids), because a Seedling-atlas maze cell IS a level tile; and it finds sprites by the level's entities. A plain
maze world has no level, no map and no entities.

### How the Seedling skin is selected today

- **From the data**: `seedlingSkinFor(world, regionAtlas)` (`mazeSeedlingSkin.js:44`) answers `{level}` only when the
  loaded slot's `region_atlas["<p>"].game === 'seedling'` (per-player; `mapDocumentPath.regionAtlasOf`) and the payload
  carries an integer `level`, `tile_size` 16 and origin (0,0) (`world.atlas`, set by `deserializeMazeWorld`,
  `mazeRoomEngine.js:453`). Never by preset name.
- **A user toggle**: the panel's "Seedling art" checkbox, `this.seedlingArtEnabled` (`mazeRoomUI.js:357`), persisted in
  localStorage under `mazeRoom_view` (`LS_VIEW_KEY`, `:142`). It can only turn it OFF.
- **The stack is a code constant** (`graphics.seedling`). The world document carries the facts the selection is
  derived from (the atlas game and level), but it cannot name a stack, and nothing reads the world's recorded
  `procgen_metadata[p].content` at play.

### What the maze would need to say "this stack supplies my tiles"

**Smallest change: art-library keys per maze tile kind, in the `maze` namespace, that a later pack overrides per key.**
The art layer already does exactly this: keys are namespaced by convention, not by pack (`KEY_PATTERN`,
`contentPacks.js:58`; the archipelago pack's keys are `archipelago:*`, and nothing ties a key's namespace to the pack
that defines it), and a later pack in a stack wins per key. So:

1. a key table in code, `maze tile kind → art key` (`maze:tile/floor`, `maze:tile/wall`, `maze:tile/exit`,
   `maze:object/block`, `maze:character/player`, …), the ~14 "thing" rows above (the state signals stay `COLORS`);
2. one art-lookup seam in `drawWorld`: draw the key's frame 0 when the loaded art has it, else fill the `COLORS` value
   (today's look, so a world with no maze art draws byte-for-byte as now; `drawOpRecorder` hashes can pin that);
3. at play, load the art layer of the world's **recorded** content stack (`procgen_metadata[p].content` plus the
   mix's default packs, `effectiveContentStack`) the way `loadSeedlingArt` loads `graphics.seedling`.

No pack concept per tile kind is needed, and none would fit: a floor or a wall is not a `character` / `place` /
`object` / `info`, and a pack concept can only be bound to a substrate's thing through `presents` (mechanic concept
ids). A role per tile kind would need ~14 roles, each matching on a field the contract lacks.

**What the contract refuses or lacks today:**

- **C3's load reads only `concepts` and `text`** (`CONTENT_LAYERS`, `worldContent.js:58`): a world's content stack
  never loads `art`. Play would need its own `loadPackStack(stack, {only: ['art']})` (the Seedling skin's pattern).
  That is a play-time load, consistent with ⚖ Q8 (art by key at play), not a contract change.
- **An art entry needs a sheet** (`artLibrary.js:49–54`: `file`, `w`, `h`, frame size). A palette-only theme (a
  colour per tile kind, no image) cannot be expressed in the art layer, and a `look` lives only on a pack concept.
  If R2b wants "a theme with no image" for tiles too, it needs either an art entry kind that is a solid colour (a
  field the art manifest lacks) or a small tile-palette table in a pack (a new layer, which this slice did not
  invent). This is the one real gap.
- `roleRefusal` / `needs.art` asks for ONE art key per pack concept; a tileset is a map. Not needed under the
  smallest change (the keys are the substrate's own, not a concept's).
- The Seedling skin stays its own mechanism (level tiles, entity census); a maze-tile tileset would sit beside it,
  used when `seedlingSkinFor` answers null.

## 9. What the code overturned or added

1. **`concepts.presenting(id)` is the wrong lookup for a consumer** (brief's Part A.3): in a mixed world a lookless
   presenter from another substrate's default pack shadows the maze's. The consumer filters by role first, as R1's
   does (§3). This holds for any consumer whose role needs a field another substrate's pack omits.
2. **Two roles split by what is WRITTEN, not only what is needed**: both need only `look`; they differ in whether the
   name is written (an item's name is its AP name).
3. **The maze's item looks were not the maze's**: they came from the neutral concept table through the world-level
   item library. The pack now owns the maze payload's copy; the table keeps its own for every other reader. Two
   copies of the same value, pinned equal by `mazeContent.test.js`.
4. **No `text` layer** (no generated maze string that is not a name).
5. **R1's predicted C4 rework** needed the fixture to be a COPY of the overridden entry's own pack: `concept_trial`'s
   maze needs presenters for water, sword and swim, so a fixture that presents only the guardian would be refused.
6. **`regionJobContent.test.js` was a declarer pin R1 did not list** (C4 named it; its target is the maze): fixed.
7. **`COLORS` has 22 keys, not 25** (measured with an import; §8).
8. **`procgen_topdown/AP_4..6` no longer regenerate byte-equal, before this slice** (APCalc source drift; §5).
9. **`ci-producer-checks.mjs` is not a preset gate**: it runs `plan-seedling-*` and tape producers only. The preset
   producers are `make-seedling-spiral-room-preset.mjs` (10 states), `check-procgen-maze-recipe.mjs`, and the hand
   recipe for top-down.

10. **Defect my bounded run missed, CI found** (JSUT 43048510610 at `95e2233f4b`, default-tier shards 1/3 and 3/3):
    `mazeRoomEngine.js` and `mazeConcepts.js` (and, through them, `contentRoles.js` and `packConcepts.js`) are in
    the engine closure of `tileSpike/certifyPlaythroughMaze.js`, so the committed Seedling derived-rule table's
    `engineMd5` went stale (`derivedRuleTableFresh.test.js`, `seedlingAtlasDerivation.test.js`). Regenerated by the
    test's own recipe: `seedling-probe.yml` run 43058639948 (rc 1 ONLY for "the table differs", every pinned count
    matched), the table copied in, `make-seedling-playthrough-rules.mjs` and `make-seedling-playthrough-maze.mjs`
    re-run (their outputs byte-identical). The table's diff is `measuredAt`, `engineMd5` and `engineFiles` (42 → 45)
    only: no row or exclusion moved (117 rows, 54 regions, 7 excluded), so no designer review is owed. Lesson for
    R2b: any edit to the maze engine's closure owes this table in the same packet.

## 10. Tests

- New: `frontend/modules/mazeRoom/mazeContent.test.js` (§6).
- Updated: §4's list.
- Bounded local run (ruling 52): `npx vitest run` over every test file that calls the maze's placer or core
  (`git grep -al "placeFromRules|ruleGatePlacer|generateRegionCore|spatialCore|conceptGateFor|presentItemLib"`) or
  names concepts (`CONCEPT_TRIAL_STATE|markConceptRow|concepts: [|concept_trial|mazeConcepts`), 41 default-tier files,
  plus `frontend/modules/{contentPacks,packConcepts,textLibrary,procgenDocs}`,
  `procgenCore/contentRoles.test.js`, `procgenPipeline/{contentPreloadSetup,worldContent,conceptTrialWorld,conceptSeam}.test.js`,
  `apworldEditor/{regionGenerationFlow,regionJobContent}.test.js`: all passed (the first pass found
  `regionJobContent.test.js` red, fixed, §9.6). The one slow-tier caller, `apworldEditor/locationCapacity.slow.test.js`,
  passed under `vitest.slow.config.js`.
- `generate-procgen-reference.mjs`: 0 findings; `--check` passes.

## 11. CI

Quoted at the final tip in the REPORT BACK message (not in a further commit). At the code tip `1456b060e9` the push's
`unittests` run 43047552134 succeeded.

## Rework: looks out of the engine closure

**Why** (⚖ tile-primitives-design-4, the derived-rule table's owner, via the planner, 2026-11-11): the maze ENGINE
closure (the import closure of `tileSpike/certifyPlaythroughMaze.js`, whose md5 the Seedling derived-rule table pins)
holds LOGIC only. With looks imported there, every future look edit would move `engineMd5` and restart the table and a
calibration pass.

**What changed** (a merge of `origin/main` `cf4d9a6874` into this branch, then one rework commit; a merge, not a
rebase, because a rebase would force-push a branch that content-sets-r3 builds on):

- `mazeRoomEngine.js` and `mazeConcepts.js` are **byte-identical to main's** (`git diff origin/main` on both: empty).
  The engine writes its built-in looks again (`MAZE_CONCEPT_REALISATIONS[c].art` for a gate, the concept table's row
  for an item): the INERT FALLBACK.
- **New `frontend/modules/mazeRoom/mazeContent.js`** holds everything R2 had added to `mazeConcepts.js`
  (`MAZE_DEFAULT_CONTENT_PACK`, `MAZE_CONTENT_ROLES`, `ROLE_WRITES`, `MAZE_CONTENT_REFUSALS`, `presentedLook`,
  `presentItemLib`) plus the pass: `presentObstacleLib`, `presentMazeWorld(world, contentSet)` and two hook wrappers.
- **The pass.** `mazeRoomLibrary.js` (not in the closure, measured) now declares
  `generateRegionCore: presentingRegionCore(spatialCore)` and `placeFromRules: presentingPlaceFromRules(ruleGatePlacer)`.
  The engine runs first. Then `presentMazeWorld` overwrites the role's fields on every concept row from
  `params.contentSet`: name, color and symbol on a concept gate in `obstacleLib`; color and symbol on a marked row in
  `itemLib`. Key order is kept, the libraries are replaced rather than mutated, and the engine's return value passes
  through. A world with no concept row reads nothing and needs no set. The refusals (no set; no presenter) now belong
  to the pass.
- ⚠ A caller that uses the ENGINE directly (not the registry entry) gets the fallback looks. Every pipeline build goes
  through the entry. The engine-level suites (`mazeConcepts.test.js`, `mazeConceptPaint.test.js`,
  `conceptSeam.test.js`) are main's again, since they test the engine.
- `seedling-playthrough-derived-rules.json` is **main's**: the merge took main's side, so §9.10's regeneration has no
  effect left.

**The closure, measured** (`node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`). I ran it at main
`cf4d9a6874` (in an archive of `origin/main`) and at this tip, and diffed the two listings: they are IDENTICAL. All 42
files are byte-identical to main's (`git diff origin/main` over the 42: 0 lines). None of `mazeRoomLibrary.js`,
`mazeContent.js`, `contentRoles.js`, `packConcepts.js` or `contentPacks.js` is in it:

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

**Pins** (`mazeContent.test.js`):
- the closure, read through `importClosure`, holds the engine and none of `contentRoles.js`, `packConcepts.js`,
  `contentPacks.js`, `mazeContent.js`, `mazeRoomLibrary.js`;
- each gate concept's engine fallback `art` equals the default pack's look (the item rows' table values were already
  pinned equal);
- with the default set, the entry's hooks (placer and core) build the engine's world byte for byte;
- a theme changes the gate's name and look and nothing else, key order kept;
- both refusals;
- a world with no concept row needs no set.

`mazeRoomLibrary.test.js` now asserts that the two hooks wrap the engine (they are not the engine functions
themselves).

**Byte-equality, re-measured after the rework.** The 10 `make-seedling-spiral-room-preset.mjs --check` states,
`check-procgen-maze-recipe.mjs` (AP_1..3) and the top-down recipe (AP_1..3, 7..12) are all equal. AP_4..6 differ
exactly as before (the APCalc source drift, §5). The bounded run passed after the docs index was regenerated. It
covered the 42 caller files and the content and docs suites, plus `derivedRuleTableFresh.test.js` and
`seedlingAtlasDerivation.test.js` (the two that went red before). `maze.md` § Content roles describes the pass.

## Next slice

**R2b, the maze tileset** (planner design first, from §8): the smallest change is a `maze:*` art-key table per tile
kind with one draw seam falling back to `COLORS`, and a play-time art load of the world's recorded stack. The open
design question is the palette-only theme: the art layer has no colour-only entry. Then R3 (the `meta` theme), which
can present the guardian (gate role) and both items (item role) for the maze today.
