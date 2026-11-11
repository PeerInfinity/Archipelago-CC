# The Seedling Editor

How Seedling rooms and level sets are edited: the room op vocabulary and its adapter, the set session that edits a whole level set with its overlay, the world session that joins several set documents, and the EDIT arm of `seedlingDemo/watch.html` that puts them on a page.

These editors are built on the substrate-free machinery in [Procgen Editing Core](./editing-core.md) — the edit core, the editor view, the set-editor mount and the overlay shape. How a Seedling room is played as a pipeline region is in [Flash Substrate](./flash.md).

## The Seedling editor's data model (`seedlingDemo/`)

`watchEdit.js` is the room op vocabulary (`EDIT_OPS`) and `seedlingEditAdapter.js` wraps it as an edit-core adapter. Ops address cells, never list indices, because the edit list is the edit's identity and travels in a payload people read.

| Op | Takes |
|---|---|
| `paint` | `{tx, ty, layer?, terrain \| column}` — either of the game's two tile layers; on `tiles`, any tileset column, not only the generator's four terrain names |
| `place` | `{tx, ty, type, attrs, nodes?}` |
| `attrs` | `{tx, ty, attrs, which?}` — the last entity in the cell, or the `which`th; attributes are replaced, not merged |
| `remove` | `{tx, ty, which?}` — the last entity in the cell, or the `which`th (0-based, in `entities` order) |
| `nodes` | `{tx, ty, nodes, which?}` — replaces that entity's `<node>` children; an empty list removes the field |
| `resize` | `{width, height, anchor}` — the one op about the room rather than a cell |
| `erase` | `{tx, ty, layer?}` — takes the tile off one layer (`tiles` when absent); refused when there is no tile there |

`which` is omitted when it was not given, on all three ops, so an edit list recorded before it existed reads the same. `erase` is what lets a clear, a replace paste of an untiled cell and a move's cut leave a cell with no tile; `paint` can only write a column.

**The entity vocabulary is derived from the game's project file.** `scripts/procgen/extract-seedling-ogmo-schema.py` reads `Shrum.oep` (the Ogmo project file the game's rooms were authored with) into `seedlingDemo/fixtures/seedling-ogmo-schema.json`: the entity declarations with their typed values, defaults and ranges, the two tilesets and the three layers. Its `--check` is byte identity, and `provenance.oep_sha256` tells a changed source apart from a changed script.

The schema, the level source, the vanilla set's `set_id` and the OEL parser are all **injected**, never imported, and each is refused by name when needed but missing. A `node:fs` import anywhere in a page's module graph would break the page, and no module under `frontend/` imports from `scripts/`.

Ogmo does not always write every declared attribute: some shipped entities omit values that have declared defaults. Filling them in is an explicit option (`fillDefaults`), not a property of the format.

**Bases.** The payload's `base` is a `{kind, …}` tag (`BASE_KINDS`):

| Kind | Resolves to |
|---|---|
| `atlas` | a vanilla room from the atlas; refused unless the tag's `set_id` is the vanilla set's content hash |
| `oel` | a pasted OEL document, through the injected parser |
| `set-room` | one room of an injected level set, possibly a live set session (below); an `embed`-sourced room is refused |
| `generate` | always refused by name — the GENERATE arm owns that identity |

**Clearing a cell.** The adapter declares the edit core's optional `clearOps(record, tx, ty, {fields, incoming})`: the ops that empty a cell's tile (`erase`), cliffside (`erase` on `cliffsides`) and bodies (one bare `remove` per body, so each takes the body that is last at that moment). `writeOps` cannot do this because it sees a descriptor, never the record. A tile the incoming descriptor is about to overwrite is not erased first.

**Known limits.** The ADD paste (the default) still does not clear the destination, so pasting onto an occupied cell adds to it; the REPLACE paste is the one that empties the cell first. Every op path writes attributes in sorted order, so editing a vanilla cell reorders that entity's attributes in the saved OEL: the values are unchanged but the bytes differ.

## The Seedling SET session (`seedlingDemo/seedlingSetAdapter.js`)

A room session edits one room. A level set is a different document with different edits — adding, removing and reordering rooms, linking exits, marking locations — so it has its own adapter and session (`createSetSession`, `createSeedlingSetAdapter`).

### Room sources

A level-set room carries exactly one `source` kind:

| Kind | What it is |
|---|---|
| `record` | a JSON level record, `{width, height, layers, entities}` — what `parseOelLevel` returns and `recordToOel` accepts. The exporter writes this. |
| `xml` | OEL text inline; accepted because committed generated sets carry it |
| `embed` | a path into the game SWF's `[Embed]` table; cannot be opened on a page. The committed vanilla manifest uses it. |

**OEL is rendered only at the delivery boundary.** `planLevelSetChunks` turns every `record` room into `{xml}` before sizing and packing chunks, because the game's loader reads `room.source.xml` as text. The size bound is therefore measured on what is actually delivered.

**Two readers.** `roomRecordOf(room, {parseOel, xmlByRoomId?})` is the one way to get a room's record. `indexOfRoom(room)` is the one way to get its cross-reference index (`{size, exits, fallthroughs, buttonRooms, finalBosses, tags, tsets, moonrocks, triggers}`): it uses `indexRoom` on records and the lenient `parseRoomXml` on text, because reduced legacy OEL (with no `<width>`) does not parse as a full record. Tests check that the two give the same index over the vanilla rooms.

**An edit never converts a kind.** An `xml` room is retargeted as text (`retargetRoomXml`, byte-preserving) and a `record` room through its entities (`retargetRoomRecord`); a mixed set edits each room in its own kind. Converting on touch would rewrite rooms nobody edited and change the set's content hash.

### The record, and the derived atlas

The session record is `{set, overlay}`. The region atlas is **derived** from the rooms (`seedlingAtlasDerivation.deriveAtlas`, called through `deriveAtlasOf(record, deps)`), not stored: a region per room, boundary exits read off the `teleporter`/`stairsup`/`stairsdown` entities (`LINK_TAGS`) and pit fallthroughs, and one-way connections between them. Only three things are authored, in the overlay: locations (with their `vanilla_item`), access rules the analyzer cannot derive, and names. No op keeps the atlas in step and no undo unwinds it; a `rules.json` is `compileRegionAtlas` of the derived atlas.

The overlay (`seedlingSetOverlay.js`, built on `procgenCore/setOverlay.js`) is `{schema_version, overlay_id?, rooms: {[i]: {name?, locations?, rules?}}, neverEnter?, regions?}`, keyed by room index. It is pure data: `overlayToDeriveInput` builds the derivation's location guard from it on every derivation, because an op payload cannot hold a function. Rule targets are `exit:<exit_id>` or `loc:<name>`. Exit ids are the derivation's own (`out_<type>_<x>_<y>`, `in_L<from>_<x>_<y>`, and the pit spellings). `regions` lives in the overlay because the level-set schema allows no extra top-level fields.

**Rooms are a one-row grid.** `bounds` is `{w: rooms.length, h: 1}`; row 1 is refused. A room's position is its id, so a second axis would address nothing. (The page's 2D MAP of a set is a view of this grid, not a second axis: see "The map" below.) This also makes `rectCopy`/`rectPasteOps` copy rooms between sets with no extra code. A paste past the end is refused (`writeOps` cannot see where the end is); grow a set with `add-room`. The cell descriptor is `{room: {name, source, music, music_override_exempt?, snow_gradient?}, overlay}`, with no `id`.

### Set ops (`SET_OP_KINDS`)

| Op | Shape | Refuses when |
|---|---|---|
| `add-room` | `{record \| xml, name?, music?, at?}` — the payload's kind is the new room's kind | neither payload or both; the document does not parse or has no size; `at` outside `0..rooms.length`; an exit names a room the new set will not have |
| `remove-room` | `{room, retarget?}` | it would empty the set; a transition targets the room and `retarget` does not say where it goes (the refusal lists them) |
| `reorder` | `{order}` — `rooms_new[i] = rooms_old[order[i]]` | `order` is not a permutation |
| `connect` | `{from: [room, exit], to: [room, exit], one_way?, arrival?}` | an exit ordinal the room lacks; a self-join; a non-integer arrival |
| `disconnect` | `{room, exitIndex}` | no such exit; the exit element has children; the overlay has marked that exit's entity as a location (use `unmark-location` first) |
| `set-field` | `{path, value}` over `SET_FIELDS` (`name`, `description`, `start`, `menu_rooms`, `named_rooms`) | an undeclared path; a value naming a missing room; an empty `menu_rooms`; a `named_rooms` key outside the six allowed |
| `set-room-field` | `{room, field, value}` over `ROOM_FIELDS` (`name`, `music`, `music_override_exempt`, `snow_gradient`) | `id` or `source`; a music index outside `-1..13`; a wrong type |
| `set-access-rule` | `{room, target, rule, path?}` | a target key without a prefix; an unknown exit id or location name; an endpoint that gates nothing (`gateabilityOf`); a rule that fails `ruleSchemaErrors` |
| `mark-location` / `unmark-location` | `{room, entity: {type, x, y}, name, vanilla_item}` / `{room, name}` | an empty `name` or `vanilla_item`; the name already used in that room; no such entity at exactly those pixels; the name is not marked |
| `replace-room` | `{room, record \| xml}` | neither payload or both; the document does not parse; it has a transition outside the set |
| `set-overlay` | `{room, overlay}` | the overlay validator refuses the shape |
| `set-overlay-field` | `{path, value}` over `OVERLAY_FIELDS` (`neverEnter`, `regions`); `value: null` deletes the key | any other path. A `regions` write recomputes the sign on every transition in the set |

Notes on the ops:

- **`reorder` is one atomic op**, not a group, so the edit list shows one reorder. It rewrites every `@to` and `@fallthrough`, `rooms[].id`, `start`, `menu_rooms` and `named_rooms`, and re-keys the overlay's rooms, `neverEnter` and `regions`. Each rewritten transition's sign is recomputed with `signForTransition`, because the sign belongs to the transition's destination region.
- **`connect` is two-way by default**, and the arrival is the destination room's return door. The game handles this without looping because the portal under the arriving player is already latched on the first frame.
- **`disconnect` deletes the exit element.** The format has no inert door: an empty or missing `@to` reads as "no exit" to the validators but still warps the player to room 0 in the game. Later exit ordinals shift down by one. It refuses when a location is marked on that exact entity (compared by pixel coordinates), since the overlay would otherwise name an entity that no longer exists.
- **Location names are unique per room**, because the derived AP name is prefixed with the level (`Level NNN - <name>`).

**Refusal classes.** `apply` catches `SeedlingSetAdapterError`, `SeedlingSetOverlayError`, `LevelSetExitError` and `SeedlingSetDeriveRefusal`, and rethrows everything else so a real defect (a `TypeError`) is not mistaken for a declined edit. `SeedlingSetDeriveRefusal` covers a set that cannot be derived as it stands — a collectible no door reaches, a room with no level number, a `neverEnter` fact that contradicts the doors. It is applied inside `deriveAtlasOf`, which the REPORT and room rows also call, so every reader sees the same class.

**Gateability.** `setEditorCore.gateabilityOf(atlas, regionId, exitId)` says whether a rule on an endpoint can take effect: an endpoint gates if it is a connection's `from`, or the `to` of a two-way connection. The REPORT's `inertRulesOf`, the rule-target list and `set-access-rule` all use it. Every Seedling connection is one-way, so arrival (`in_*`) exits never gate. `set-overlay` writes a whole entry without asking, which is why `inertRulesOf` still reports inert rules.

**The link index.** `linksIndexOf(record)` walks the set once and buckets every inbound link by destination; `whatLinksHere(record, room)` answers from it in a stable order (rooms by index, exits before fallthroughs). The cache is a `WeakMap` keyed on the frozen record, so an edited set (a new object) misses automatically. `linkScanBoundOf(cost, budgetMs)` decides whether the "links here" column is affordable.

### Stamping, and room sessions inside the set

The session's identity is `payload() = {base, edits, certified}`; nothing in it is a hash. `stampLevelSetIdentity` is called once per download, in `downloadSet`, on the folded set. `downloadSet` validates first and refuses a set with errors. `provenance` is copied, never shared, so stamping a download does not stamp the session's own set. The derived atlas is never stamped. Cross-room rules such as room-name uniqueness belong to `validateLevelSet`, not to an op.

`setSessionRoomSource(session)` lets a room session resolve its room from the set session's current fold, checking the tag's `set_id`. `closeRoomSession(setSession, roomSession, room)` commits one `replace-room`, so any number of room edits become one set edit and one undo.

### The vanilla rooms

The committed `fixtures/seedling-vanilla-set.json` has 116 `embed`-sourced rooms, which a page cannot open. `levelSetExporter.vanillaRecordSet(embedSet, mapDoc)` builds a `record`-sourced version from that manifest and `flashPanel/atlases/seedling-map.json` (whose level records are the shape a set room carries), using `buildLevelSet`. Its callers are the export CLI's `--vanilla` flag and the page's `#editLoadVanilla` button; the result is not committed. By default it applies the delivered set's record patches (`seedlingSetPatches.SEEDLING_SET_PATCHES`, the set the randomizer hands the game); `{patches: []}` builds the game's own rooms instead. **The editor opens the game's rooms**: `#editLoadVanilla` calls `watchSetEditor.editorVanillaSet`, which is `vanillaRecordSet` with `{patches: []}`, and the editor's node rows and gates call the same function. An author edits the game, and the delivery's patches are applied downstream to whatever set the author makes. The two copies differ only in the rooms the patch table names. One of those patches removes L0's `moonrock`, which is the trigger for the `moonrock_target` arrival, so the game's map has one more `named_rooms` link (L0 → L2) than the delivered map. `check-seedling-editor-e3.mjs` pins the page's download to `editorVanillaSet` by digest. Rooms are joined **by path** (the record's `path` against the room's `source.embed`), never by index, so the join stays correct if either extractor's order changes. `provenance.invented` coming back empty confirms no field was guessed.

The two sets have different ids by design. The committed set keeps `seedling-vanilla-<hash>`, which the game's save stamps and the page's `atlas` base check. The derived set uses the base `seedling-vanilla-record` and records the other in `provenance.derived_from`.

**`named_rooms` arrivals are connections.** Some rooms are reached only through a manifest entry that the game dereferences from inside a trigger entity, not through an `@to` (for example `level_58` is reached only via `named_rooms.tentacle_beast_mouth`). `levelSetValidator.NAMED_ROOMS` records, per entry, which OEL element triggers it; `namedRoomArrivals` derives a connection from every room holding that trigger element to the entry's arrival position, with the entry key in the arrival id. `watcher_text` is not a warp and derives nothing. A warp whose source is a `neverEnter` room is not made.

This derivation runs only on the editor path: `deriveAtlasOf` passes `record.set.named_rooms`, while `make-seedling-playthrough-rules.mjs` calls `deriveAtlas` without it, so the committed `flashPanel/atlases/seedling-playthrough.json` is unchanged.

**The vanilla overlay.** `scripts/procgen/make-seedling-vanilla-overlay.mjs` lifts from the committed playthrough atlas everything the overlay can express and writes `seedlingDemo/fixtures/seedling-vanilla-overlay.json`. Every location and rule is built by applying a `mark-location` or `set-access-rule` op through the real adapter, so the fixture always loads. It uses `entityForLedgerRow` to find which entity a location row means. It prints, by category, what it cannot express (sub-region graphs, internal exits, per-region annotations and so on). It writes no `neverEnter` or `regions`: those decisions belong to `make-seedling-playthrough-rules.mjs`. A test derives the fixture through `deriveAtlasOf` and checks its location names match the playthrough atlas's.

**End to end on a generated set.** `buildLevelSet({link: true})` → set session → `add-room` → `connect` → `reorder` → `mark-location` → `set-access-rule` → `deriveAtlasOf` → `validateRegionAtlas` (with schema) → `compileRegionAtlas` → `rulesJsonSchemaErrors` empty → the compile report's unwired exits agree with `reachabilityOf` → `reachableRegions` covers every region with an open evaluator and drops the gated one when the evaluator refuses the rule's item → undo back to the base.

### A generated room from a world

A `flash_seedling_gen` region opens on the EDIT arm from the pipeline's Edit ▸ and the APWorld Editor's, through `seedlingDemo/seedlingGenRegionRoundTrip.js` (the entry's `regionRoundTrip`, loaded by dynamic import so the registry entry stays light).

- **What the page is handed.** A one-room `record` level set holding the room as it plays: the sidecar keeps the bare generated record, so `open` adds the `apitem`s and the door `teleporter`s the way `assembleGeneratedSeedlingSet` does (every door leads back into the room, at its own arrival).
- **What a save may change.** Tiles, and every entity except the doors and AP items. A save that moves, removes or adds a door or an AP item, or resizes the room, is refused with a sentence: those cells belong to the world (a neighbour's door lands on a door's `entrance_spawn`; a location's tag is its AP identity). Entities are compared with their attribute values as strings, because `buildLevelSet` writes every OEL attribute as a string.
- **Rules.** An edit moves no rule. A generated room's rules come from the world (`extractGenRules` copies them), and the pipeline keeps the exit fields its serializer does not write (a grown exit's `isBackExit`, from which Compile composes the back exit's gate).
- **Certification.** A changed room is re-checked by `seedlingGenRoom.certifyGenRoom`: the generator's own oracle, under the model of the room's own draw (`redrawGenRoom`, which reproduces the draw from the payload's seed, size and knobs), with every door as a wall, once for the goal cell and once for each other location (given a pickup there). The verdict is stamped on `generation.edited` (`{certified: true}` or `{certified: false, failures}`). A room that fails is saved and flagged, never refused; the entry's `regionEditStatus` turns the stamp into the flag the pipeline and the APWorld Editor show. An unedited save returns the payload byte for byte.
- **Real-game rooms** (`flash_seedling`) do not open from a world. They are read-only there: their access rules come from the committed playthrough atlas, not from their layout, and a change to one goes in as a reviewed `SEEDLING_SET_PATCHES` row.

Tests: `seedlingGenRegionRoundTrip.test.js` (every committed generated room through the APWorld Editor's door; the refusals; certification; an edited room assembled into its world's set and solved on the JS runtime), `procgenPipeline/pipelineRoomEdit.test.js` (every generated room of the sphere presets round-tripped unedited recompiles byte-identically), and the in-app row `procgen-pipeline-seedling-gen-edit-round-trip` (the real page).

## The WORLD — one session over several set documents (`procgenCore/world*.js`)

A world is a set session whose rooms are not all one substrate. **The bundle is the world**: its members are a `level-set`, a `region-library`, and a `world` document holding the manifest, both parts' overlays and the links between them. The overlays live inside the `world` document because a bundle has exactly one entry per kind. A `world` document is recognised by shape: a `parts` object plus a `links` array.

**Three modules, all substrate-free.** `worldDocument.js` (the shape, its refusals and re-keying helpers), `worldDerivation.js` (the merge) and `worldSetAdapter.js` (the composite session) take each part's adapter, readers and record converters as parameters. The part kinds are `WORLD_PART_KINDS` (`level-set`, `region-library`).

**Region ids are namespaced `<part>.<region_id>`** (`namespacedRegionId`). A dot never appears in a committed region id and cannot form the `__` sub-region separator, so splitting on the first dot recovers the pair; a part id may not contain one. Each part's atlas comes from its own derivation; the merge renames regions with `atlasOps`' `rename-region` and concatenates, keeping each region object (`map_ref`, `substrate`, exits, key order) verbatim. The merged atlas passes the normal `validateRegionAtlas`.

- `tile_space.map_document` names the world, so the validator's map-resolution pass is not available for a world atlas; each part resolved its own before the merge.
- `tile_space.tile_size` is the start part's; a disagreement is reported as a note.

**A world link displaces a part-internal connection.** A generated Seedling set has no spare exit, so linking one to the maze would otherwise be impossible. The part's own connection on that exit is unwired first and the displacement is reported by name. A connection an earlier world link made is not displaced; `atlasOps.connect` refuses the second link instead.

**The composite grid** is the parts' rooms concatenated: `bounds` is `{w: Σ widths, h: 1}`, a global index resolves to `(part, local)`, and room ops are forwarded to the owning part with the index re-based and the part's refusal prefixed. `add-room` and `reorder` are addressed by part name (`PART_ADDRESSED_OP_KINDS`), because a reorder cannot cross parts. `set-field` writes the world's `name`/`description` (`WORLD_FIELDS`), or a part's when one is named. The session stores the world-level op, never the re-based one, so replay on undo addresses the right part.

**A cross-part link is a different op shape.** A part's own `connect` takes an array pair; a world link is `connect {from: {part, room, exit}, to: {…}, one_way}` with objects naming derived atlas exit ids. `one_way` is required, since Seedling and maze defaults disagree.

**The cell descriptor gains `part` and `substrate`**, both read-only. `writeOps` strips them, and `apply` checks a cross-part paste.

**`compileRegionAtlas` accepts injected sidecar builders**: `options.sidecarBuilders` is merged over the built-in rows, and the refusal's list of buildable substrates is derived from the merged table.

### The world editor page

The world editor is the maze lab's SET arm: `mazeRoom/lab.html?source=set&world=<bundle>.zip`. A bare `world.json` is refused, because a world names its parts and holds no rooms. Each part is validated by its own validator (`validateLevelSet`, `validateRegionLibrary`), then bound to the world by `doc_id`. The strip shows both parts' rooms, each badged with its substrate (read from `readCell().substrate`). A maze cell is drawn by the maze painter; a Seedling cell is drawn as a card, because `lab.html` does not import Seedling's painter.

A room opens in its own substrate's editor: a maze room on `lab.html`'s canvas, a Seedling room in `watch.html`'s EDIT arm in an iframe on the page (the page and arm come from the registry entry's `roomEditor`). Opening rooms of two substrates at once is refused. The page names which session an undo will reach.

Cross-part links are authored from derived exit ids, and any displacement is previewed before the press by asking the merge. The download is one bundle with one stamp (`world_id` minted at the press): the world, both parts, each part's companion, and the compiled `rules.json` and atlas. Beside it is an **all-maze `rules.json`** (`worldRulesJsonOf` with a `projectRegions` hook that strips each region's `substrate` so the maze row compiles everything), because a mixed world does not yet play in the app.

**End to end on a mixed world.** Two generated Seedling rooms and two entries of `frontend/region-libraries/demo-maze-pack.json` → a world with a maze-internal link and one Seedling→maze link → `deriveWorldAtlas` → `validateRegionAtlas` clean → `compileRegionAtlas` → `rulesJsonSchemaErrors` empty → `report.substrates` = `{flash_seedling: 2, maze: 2}` → every region reachable from the Seedling start → `buildWarehouse` holds four regions across two load events → undo back to the base. Removing the crossing makes the two maze regions unreachable, which the REPORT names and the export refuses.

## The Seedling editor on the page (`watch.html`)

`?source=edit` is the page's EDIT arm, beside REPLAY, SOLVE, MANUAL and GENERATE. It must be asked for by name; `?level=N` alone never opens the editor.

**One edit panel, two hosts.** `#editPanel`, mounted by `seedlingDemo/watchEditor.js` over `procgenCore/editorView.js`, is shown in both the EDIT and GENERATE arms. In EDIT the host is an `editCore.createEditSession`, so `base` + edits is the whole identity. In GENERATE the host is a session-shaped object over the generation ladder's state, folding through `watchEdit.editState`, so GENERATE payloads and `?gen=` replays are unchanged. GENERATE's click-to-anchor template gesture is a page tool of the same view.

**Launching, loading and saving.** `?source=edit&level=N` opens an `atlas` base, checked against the vanilla set's `set_id`. The LOAD box recognises a payload, a raw OEL or a level set by shape; a `generate` base is refused ("open it from GENERATE"). Downloads are the payload, the room as OEL and the whole set with the edited room replaced; the page never writes to `fixtures/`. ▶ load in wasm ships the room as a one-room set with an empty input tape, for keyboard play. "Open in editor" in GENERATE hands the record and its `base` tag across in memory.

### The palette

- **Entity types** come from the whole `.oep` schema: a `<datalist>` grouped by the project file's folders, with a `<select>` to narrow suggestions. The type field stays free text, so an undeclared type can still be placed (and is then refused by `buildLevelWorld` if the model cannot build it). The attribute form is generated from the declaration's values and ranges and writes the JSON box, which remains the single source of the op. Empty means omitted.
- **The default place type** is `watchEditor.DEFAULT_PLACE_TYPE`, checked at import against the first body the generator palette places.
- **Tiles** are addressed by column: every column of `tiles` and every pixelmask of `cliffsides`, behind a layer `<select>`. The generator's four terrain names stay as the first group and keep their own op spelling (`{terrain:'ground'}` and `{column:0}` fold to the same record but are different ops). Columns are grouped by `tileSemantics(type).kind`. Each option shows a colour swatch in the canvas's colour for that tile type. Hovering a cell prints what `readCell` returns, with each body's in-cell ordinal.
- **The tile-art palette** (`#genEditTileArt`) is a grid of one chip per column, drawn from the same sheets the room is drawn with: `watchArt.paletteTileFrame(art, layer, column)` picks the frame through the renderer's own `TILE_ART` rule for an isolated tile (autotile mask 0, an animation's first frame), and a `cliffsides` column draws `seedling:scenery/cliffside` frame = column. Clicking a chip sets the terrain `<select>`, which stays the one value the op is built from. A column whose sheet is missing, or not yet decoded, or the "Seedling art" toggle being off, shows that column's swatch (`data-fallback`). The swatches were chosen when no tileset image was served (the art was only inside the recompiled `.wasm`); the lab's content-pack art (`graphics.seedling`) removed that reason, and a `<select>` option still cannot hold an image, which is why the art is a grid beside it.
- **The body picker** (`#genEditWhich`) says which body of a cell `attrs` and `remove` address. Its default is "the LAST", which writes the bare op. Clicking a cell that holds several bodies in either mode lists them there; pick one and click that cell again to add `which`.
- **Types the JS model cannot build.** `levelWorld.ENTITY_CLASSES` covers a subset of the declared types. A room holding another type still accepts the edit; the readout names the types, and ▶ load in wasm is the certifier.

**Room flags.** `lightalpha`, `daynight`, `snow`, `blur`, `blur2`, `droplet` and `<control>` are entities in the OEL but level properties in the game. Their form uses the existing ops (a presence flag is `place`/`remove`, an attribute flag adds `attrs`), and its roster is `seedlingSemantics.LEVEL_PROPERTY_TAGS`. A new flag is placed at the origin, where the shipped rooms put theirs. Where a flag shares its cell with another entity and is not the last one, both ops address it through `which` (the form passes it only then, so a last-body flag's op is unchanged). Only `<control>`'s `fallthrough` changes the JS model (pits); the page names the wasm as the only certifier of the others.

**The gestures.** All of them are tools of the one editor view, so one is armed at a time and Escape disarms it. Each lands as one group, so one undo takes it back.

| Gesture | Key | What it does |
|---|---|---|
| BRUSH | `b` | paints, places, edits attrs or removes at each cell of a click or drag, per the brush mode |
| RECT (copy) | `r` | two clicks: the corners of the rectangle copied to the clipboard |
| PASTE | `p` | one click: the clipboard's top-left lands there, as ADD or REPLACE (`#genEditPasteMode`), filtered by field (`#genEditPasteOnly`) |
| FLOOD | `f` | one click: the 4-connected cells that look like it are repainted with the brush's target |
| FILL a rectangle | `l` | two clicks: every cell of the rectangle gets the brush's target (a PAINT column or a PLACE body) |
| CLEAR a rectangle | `x` | two clicks: every cell of the rectangle is emptied of everything, or of one field (`#genEditClearWhat`) |
| MOVE the selection | `m` | one click: the RECT selection is cut from where it was copied and pasted there (ADD or REPLACE, same filter); overlapping moves read the destination after the cut. A selection can be moved once; RECT again to move again |
| LINK a group | `k` | first click picks an entity and highlights its partners; the next click moves it into that partner's group. Shift-click gives the two a new group of their own (one edit); Shift-click the picked entity to detach it alone; click it again to drop the pick |
| NODE a rope end | `n` | first click picks a rope; the next click puts its end in that column, on the rope's own row |
| (clear the tool) | `Escape` | disarms whatever is armed |
| UNDO | `Ctrl/Cmd+Z` | the fold over a shorter list |
| REDO | `Ctrl/Cmd+Shift+Z`, `Ctrl/Cmd+Y` | re-applies the last undone edit; any new edit clears the redo list |

REDO lives in the shared edit core (`session.redo()`, `redoCount()`); the redo list is not part of the payload. A page that registers no `redo` command keeps the old keys: `Ctrl/Cmd+Shift+Z` still reaches its undo, and `Ctrl/Cmd+Y` stays unbound. The maze lab's EDIT arm registers one (`#labRedo`). GENERATE's host keeps its own redo list, valid only on the state the last undo left; a STEP, a directive or a load voids it. FILL, CLEAR, MOVE and the paste mode are the editor view's shared tools, which this panel names (Procgen Editing Core, *Shared tools, opt-in*); FILL, CLEAR and MOVE are built by the core's `rectFillOps`, `rectClearOps` and `rectMoveOps`, and the REPLACE paste by `rectReplaceOps`; the last three need the adapter's `clearOps` and refuse by name without it. Removals go through the same ops as always, so every rule that refuses a removal refuses a clear, a replace or a move the same way (an empty cell's `remove`, and a generated room's save refusing a moved door or AP item).

### Entity links

`seedlingDemo/entityLinks.js` reads what a room's entities are wired to, builds the edits and names the problems. It adds no op: a group is edited by `attrs` and a rope's end by `nodes`, so a link edit is an ordinary entry in the edit list. The overlay is drawn through `editorView`'s `shapes()`, with `#genEditShowLinks` to hide it; the shared core draws nothing of its own for it.

| Link | What the game reads | In the editor |
|---|---|---|
| Group (`tset`) | The `Activators` classes share a number; a publisher (`button`, `buttonroom`, `rope`) reaches every other one with the same `t`. A missing attribute is group 0 | Drawn publisher → responder; rewired with LINK |
| Sentinel group (`tset < 0`) | A meaning of its own to the class: on a lock "opens when the room has no enemies", on a crusher "always armed" | Not a wire. Not drawn; refused as a partner |
| Forced group | `shieldlock`, `shieldlocknorm` and `bosslock` take theirs from the constructor | Refused by name |
| Cross-room `buttonroom` (`room` is not -1) | Its `tset` is a persistence flag of that level, not a group of this room | Named in the readout; edit it with ATTRS |
| Implicit publisher | A `wand` pickup and a dying `finalboss` publish group 0 | Drawn and counted as a partner; not editable |
| Rope end (`<node>`) | `rope` alone declares nodes (Ogmo limit 1). The loader keeps the last node and passes only its `x` | Drawn; moved with NODE |

The door links (`to`, `fallthrough`) belong to the set editor's `connect` and are not part of this.

No moving platforms exist in this game, so a rope's end is the only path to edit. Removing a rope's node is not offered, because the game cannot load a rope without one, and there is nothing to reorder with one node.

**What a save refuses.** Only what the game cannot load: a rope with no node, on which the level loader dies, or reuses an earlier rope's end. AS3's `var pt` is function-scoped (`Game.as` ~2419–2427), so a nodeless rope after a noded one in the same room takes that rope's end `x`; with no earlier rope it dies on a null point. The OEL download, ▶ load, closing a room into a set and a generated room's save all refuse it with the same sentence. The payload download still works, since a payload is unfinished work and not something the game reads.

**What only warns**, in `#genEditLinkIssues`, because the room loads and plays:

| Issue | Meaning |
|---|---|
| `group-no-publisher` | Responders nothing in this room activates, which is also what a removed button leaves behind. Some shipped rooms are like this, so it cannot be a refusal |
| `group-no-responder` | A publisher wired to nothing |
| `publisher-sentinel-group` | A publisher in a negative group |
| `rope-many-nodes`, `rope-node-left`, `rope-node-row` | Extra nodes are ignored; an end left of the pulley gives a negative collider; a node's `y` is ignored |
| `tset-unread`, `tset-not-an-integer` | A `tset` on a type that never reads it; a value the game reads as 0 |

**SOLVE and links.** A link edit makes a new record, so the room is uncertified until SOLVE is pressed again, as for any edit. The readout says by name which wires SOLVE cannot see: it asks the model's own `groupResponders` for each responder and reports any that is missing (`rocklock`, `lightpole`, `fallrocklarge`, a grouped `crusher`), and it names cross-room buttons and implicit publishers.

**SOLVE in EDIT.** SOLVE certifies the room on screen through the oracle GENERATE uses (`editSolve.solveEditedRoom` → `procgenSeedling.seedlingOracle`, whose `solve` is `procgenOracle.solve` under the record's own pins). `certifyGenRoom` does not fit: it re-draws a generated room's model from its seed and knobs, which a hand-edited room does not have. The two things the oracle needs that a room with no ladder does not carry are inputs on the page:

- **the goal** (`#editSolveGoal`), one of the room's own (`editSolveGoals`): each pickup, AP item or chest, then each exit. An exit that leads to another level is listed and refused by name, because the oracle's level source is this one record. A room with no goal refuses by name (`NO_GOAL_REFUSAL`).
- **the inventory** (`#editSolveItems`), seam item flags as JSON; `{}` means none, and the verdict names what it was solved under.

The boot is the spawn the still frame drew the player at. A SOLVED verdict stamps `setCertified(true)`, and ▶ load ships the room as a one-room set with the certification tape and the model's expected end state, through the same builder GENERATE's ship uses; any other verdict stamps `false` and shows the oracle's text. An edit makes a new record, so a later edit leaves the room uncertified until SOLVE is pressed again. `window.__editorEdit.solve` reports the last solve and whether it is about the room on screen.

**Resize.** Width, height and anchor build one `resize` op. `resizeWarnings` previews what would be lost, without blocking; a crop that would drop a tile or entity is refused by the op and the refusal is printed verbatim.

### The set editor on this page

A level set loaded in the LOAD box, or `#editLoadVanilla` (which derives the vanilla rooms as a `record` set from the map extract and manifest the page already holds, fetching nothing), opens a set session through `seedlingDemo/watchSetEditor.js`, the Seedling binding of `mountSetEditor` ([Procgen Editing Core](./editing-core.md#the-set-editor)). The room adapter's `levelSetSource` is `setSessionRoomSource(session)`. An overlay pasted into the box is recognised by shape: its `rooms` is an object keyed by index, where a set's is an array.

- **The overview** is one canvas that shows either the MAP (below; the default) or the STRIP. `#editSetMapView` toggles it and `?setView=strip` opens on the strip.
- **The strip** shows one cell per room, matching the adapter's one-row grid. Exits are drawn as arcs above it, one line per pair of rooms; a two-way door is one line with two heads. The selected room's incoming links are highlighted. Thumbnails are drawn by the page's `previewLevel` into an offscreen canvas with its readouts turned off. It is kept because RECT/PASTE between sets addresses a range of room INDICES, which reads as a contiguous run only here.
- **Linking** is a two-click page tool: click the source room, then the target, and one `connect` lands. The return door is chosen by ordinal; a target without that exit is refused with its real count.
- **Two sessions, one undo key.** The overview (map or strip) binds its keys to its canvas, the room editor to the document, and a stopper keeps one keypress from reaching both. The identity line says which session an undo will hit. A renumbering op (`reorder`, `add-room`, `remove-room`) discards an open room session's unsaved edits, saying how many, and reopens the room at its new index. Download is refused while a room session holds unsaved edits.
- **Forms** are derived: the manifest form from `SET_FIELDS`, `named_rooms` keys and arrival positions from `levelSetValidator.NAMED_ROOMS`, the music range from the game's song list. Rule targets are recomputed when the record or selection changes (an op, an undo, a selection), never per keystroke. Arrival (`in_*`) exits are marked as gating nothing.
- **REPORT** runs `rulesJsonOf(session, deps, {compileRegionAtlas})` and lists: `validateLevelSet`, `validateRegionAtlas` with schema, unwired exits by room and ordinal, every free edge (read from the compiled rules, whose `access_rule` is what the world will do), every authored rule that reaches no compiled edge, unreachable regions by name, and the overlay's location count against the compiled one. The `rules.json` download is disabled, with its reason shown, while the graph does not close, the set is invalid or a rule is inert; the set and overlay downloads stay available. A room with no door at all is dropped by the derivation, so what the reachability check catches is an island of two or more rooms linked only to each other.
- **Downloads.** `downloadSet(session)` validates, stamps once and returns the set, the stamped overlay and the `apMappingInvalidation` companion. `rules.json` is written with `stringifyRulesJson`. ▶ load in wasm ships the whole set through `validatedChunks`, booting at the manifest's `start`.
- **Lifetimes.** Each LOAD remounts the panel on its own lifetime, so an old mount's listeners never act on a new session.

### The map

The map (`seedlingDemo/seedlingSetMap.js`, handed to the shared mount as `overviewMap`) is a 2D layout of the set **derived from its exits**. The layout, stability rule and drawing are shared with the maze lab's map (`procgenCore/setMapLayout.js`); this file holds Seedling's half, which way a door leads. The game stores no room position (a room is an id), so nothing about the map is stored: not in the set, its OEL or the overlay. A set always renders as derived, and every click is still answered as a room index.

**Which way a door leads.** A door within 20% of an edge of its room leads through that edge; an interior door takes the side its arrival lands on in the target, reversed; anything else (most stairs, pits, `named_rooms` arrivals) has no direction. Over the vanilla 116 most doors lead through their own edge, and most teleporters leave one edge and arrive at the opposite edge of the target, which is what makes a direction honest.

**The layout.** Breadth-first from the manifest's `start` room: a room reached through a directed door goes one cell that way, or to the nearest free cell on that side; a room reached without a direction takes the nearest free cell; rooms no link reaches start a new group to the right. A uniform grid cannot honour every door (a hub room has several on one side), so the layout aims for the right side rather than adjacency; a unit row pins that the directions place more links on their side than a direction-blind layout does.

**Stability.** The layout is a function of the exit graph alone, so an edit that changes no door moves nothing. While the rooms stay the same rooms (count, names and sizes), a `connect`, a `disconnect` or their undo moves **no** room: the new link is drawn where it falls. A renumbering (`add-room`, `remove-room`, `reorder`) re-derives the layout, and RE-LAYOUT (`#editSetMapRelayout`) asks for it at any time.

**What it draws.** Each room's still (the strip's thumbnail, letterboxed) in its own cell. Doors are one line per pair of rooms, two heads for two-way; pits and `named_rooms` arrivals are separate lines, marked `pit` and `★` (the key is spelled out when highlighted). The selected room's links in and out are highlighted, and its doors are ticked with their ordinals.

**Gestures on the map** (the room editor's table above holds the rest):

| Gesture | Key | What it does |
|---|---|---|
| SELECT | click (nothing armed) | selects the room; its links in and out are highlighted |
| OPEN | double-click | opens the room in the room editor, as the rooms table's OPEN does |
| CONNECT | `c` | the source room, optionally a door tick on it (picks that exit), then the target: one `connect`, with the return door from `#editSetTargetExit` |
| DISCONNECT | `d` | first click on a link picks the door it means (the room at the nearer end; the exit list chooses among several) and says what the op will do, the ordinal shift included (`#editSetMapNote`); a second click on the same link applies one `disconnect`. A pit or a `named_rooms` arrival is refused by name |
| ZOOM | `+` / `=`, `-`, `0` (fit), Ctrl+wheel | zooms the map; the panel scrolls to pan |
| (clear the tool) | `Escape` | disarms CONNECT or DISCONNECT and drops a picked link |
| UNDO / REDO | `Ctrl/Cmd+Z` with the map focused | the SET session's undo |

Every refusal is the adapter's own sentence (self-join, a return ordinal the target lacks, an exit with children, a door a location is marked on). Tests: `seedlingEditorE3.test.js`, the `overviewMap` rows of `procgenCore/setEditorView.test.js`, and the browser row `scripts/procgen/check-seedling-editor-e3.mjs`.

**Control ids.** `genEdit*` is a control both arms mount; `edit*` is a control only the EDIT arm has (inside `#editOnly`). `scripts/procgen/check-seedling-editor-arm.mjs` checks this over the live DOM.

**The OEL round trip.** Over all shipped rooms, `record → recordToOel → parseOelLevel → record` is a value fixed point, and parsing each disk `.oel` reproduces the committed atlas record. The writer's bytes are not identical to Ogmo's: it adds a trailing newline, the extract drops tiles outside the room rectangle, and it escapes a raw `>` inside an attribute value.

## Related documentation

- [Procgen Editing Core](./editing-core.md) — the edit core, editor view, set-editor mount and overlay shape
- [Flash Substrate](./flash.md) — Seedling rooms as pipeline regions
- [Seedling Real-Game Bot](./seedling-bot.md) — the bot, the tape and the level generator
- [Architecture](./architecture.md) — where editing sits in the overall flow
