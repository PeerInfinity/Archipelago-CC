# The Seedling Editor

How Seedling rooms and level sets are edited: the room op vocabulary and its adapter, the set session that edits a whole level set with its overlay, the world session that joins several set documents, and the EDIT arm of `seedlingDemo/watch.html` that puts them on a page.

These editors are built on the substrate-free machinery in [Procgen Editing Core](./editing-core.md) — the edit core, the editor view, the set-editor mount and the overlay shape. How a Seedling room is played as a pipeline region is in [Flash Substrate](./flash.md).

## The Seedling editor's data model (`seedlingDemo/`)

`watchEdit.js` is the room op vocabulary (`EDIT_OPS`) and `seedlingEditAdapter.js` wraps it as an edit-core adapter. Ops address cells, never list indices, because the edit list is the edit's identity and travels in a payload people read.

| Op | Takes |
|---|---|
| `paint` | `{tx, ty, layer?, terrain \| column}` — either of the game's two tile layers; on `tiles`, any tileset column, not only the generator's four terrain names |
| `place` | `{tx, ty, type, attrs, nodes?}` |
| `attrs` | `{tx, ty, attrs}` — the last entity in the cell; attributes are replaced, not merged |
| `remove` | `{tx, ty, which?}` — the last entity in the cell, or the `which`th (0-based, in `entities` order) |
| `nodes` | `{tx, ty, nodes}` — replaces that entity's `<node>` children; an empty list removes the field |
| `resize` | `{width, height, anchor}` — the one op about the room rather than a cell |

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

**Known limits.** A paste does not clear the destination's entities (there is no clear-cell op, and `writeOps` sees a descriptor, not the record), so pasting onto an occupied cell adds to it. Every op path writes attributes in sorted order, so editing a vanilla cell reorders that entity's attributes in the saved OEL: the values are unchanged but the bytes differ.

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

**Rooms are a one-row grid.** `bounds` is `{w: rooms.length, h: 1}`; row 1 is refused. A room's position is its id, so a second axis would address nothing. This also makes `rectCopy`/`rectPasteOps` copy rooms between sets with no extra code. A paste past the end is refused (`writeOps` cannot see where the end is); grow a set with `add-room`. The cell descriptor is `{room: {name, source, music, music_override_exempt?, snow_gradient?}, overlay}`, with no `id`.

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

The committed `fixtures/seedling-vanilla-set.json` has 116 `embed`-sourced rooms, which a page cannot open. `levelSetExporter.vanillaRecordSet(embedSet, mapDoc)` builds a `record`-sourced version from that manifest and `flashPanel/atlases/seedling-map.json` (whose level records are the shape a set room carries), using `buildLevelSet`. Its callers are the export CLI's `--vanilla` flag and the page's `#editLoadVanilla` button; the result is not committed. Rooms are joined **by path** (the record's `path` against the room's `source.embed`), never by index, so the join stays correct if either extractor's order changes. `provenance.invented` coming back empty confirms no field was guessed.

The two sets have different ids by design. The committed set keeps `seedling-vanilla-<hash>`, which the game's save stamps and the page's `atlas` base check. The derived set uses the base `seedling-vanilla-record` and records the other in `provenance.derived_from`.

**`named_rooms` arrivals are connections.** Some rooms are reached only through a manifest entry that the game dereferences from inside a trigger entity, not through an `@to` (for example `level_58` is reached only via `named_rooms.tentacle_beast_mouth`). `levelSetValidator.NAMED_ROOMS` records, per entry, which OEL element triggers it; `namedRoomArrivals` derives a connection from every room holding that trigger element to the entry's arrival position, with the entry key in the arrival id. `watcher_text` is not a warp and derives nothing. A warp whose source is a `neverEnter` room is not made.

This derivation runs only on the editor path: `deriveAtlasOf` passes `record.set.named_rooms`, while `make-seedling-playthrough-rules.mjs` calls `deriveAtlas` without it, so the committed `flashPanel/atlases/seedling-playthrough.json` is unchanged.

**The vanilla overlay.** `scripts/procgen/make-seedling-vanilla-overlay.mjs` lifts from the committed playthrough atlas everything the overlay can express and writes `seedlingDemo/fixtures/seedling-vanilla-overlay.json`. Every location and rule is built by applying a `mark-location` or `set-access-rule` op through the real adapter, so the fixture always loads. It uses `entityForLedgerRow` to find which entity a location row means. It prints, by category, what it cannot express (sub-region graphs, internal exits, per-region annotations and so on). It writes no `neverEnter` or `regions`: those decisions belong to `make-seedling-playthrough-rules.mjs`. A test derives the fixture through `deriveAtlasOf` and checks its location names match the playthrough atlas's.

**End to end on a generated set.** `buildLevelSet({link: true})` → set session → `add-room` → `connect` → `reorder` → `mark-location` → `set-access-rule` → `deriveAtlasOf` → `validateRegionAtlas` (with schema) → `compileRegionAtlas` → `rulesJsonSchemaErrors` empty → the compile report's unwired exits agree with `reachabilityOf` → `reachableRegions` covers every region with an open evaluator and drops the gated one when the evaluator refuses the rule's item → undo back to the base.

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
- **Tiles** are addressed by column: every column of `tiles` and every pixelmask of `cliffsides`, behind a layer `<select>`. The generator's four terrain names stay as the first group and keep their own op spelling (`{terrain:'ground'}` and `{column:0}` fold to the same record but are different ops). Columns are grouped by `tileSemantics(type).kind`. Each option shows a colour swatch in the canvas's colour for that tile type. Hovering a cell prints what `readCell` returns.
- **Types the JS model cannot build.** `levelWorld.ENTITY_CLASSES` covers a subset of the declared types. A room holding another type still accepts the edit; the readout names the types, and ▶ load in wasm is the certifier.

**Room flags.** `lightalpha`, `daynight`, `snow`, `blur`, `blur2`, `droplet` and `<control>` are entities in the OEL but level properties in the game. Their form uses the existing ops (a presence flag is `place`/`remove`, an attribute flag adds `attrs`), and its roster is `seedlingSemantics.LEVEL_PROPERTY_TAGS`. A new flag is placed at the origin, where the shipped rooms put theirs. Where a flag shares its cell with another entity and is not the last one, `attrs` cannot address it and the form refuses; `remove` can, through `which`, but the form does not pass it yet. Only `<control>`'s `fallthrough` changes the JS model (pits); the page names the wasm as the only certifier of the others.

**Resize.** Width, height and anchor build one `resize` op. `resizeWarnings` previews what would be lost, without blocking; a crop that would drop a tile or entity is refused by the op and the refusal is printed verbatim.

### The set editor on this page

A level set loaded in the LOAD box, or `#editLoadVanilla` (which derives the vanilla rooms as a `record` set from the map extract and manifest the page already holds, fetching nothing), opens a set session through `seedlingDemo/watchSetEditor.js`, the Seedling binding of `mountSetEditor` ([Procgen Editing Core](./editing-core.md#the-set-editor)). The room adapter's `levelSetSource` is `setSessionRoomSource(session)`. An overlay pasted into the box is recognised by shape: its `rooms` is an object keyed by index, where a set's is an array.

- **The strip** shows one cell per room, matching the adapter's one-row grid. Exits are drawn as arcs above it, one line per pair of rooms; a two-way door is one line with two heads. The selected room's incoming links are highlighted. Thumbnails are drawn by the page's `previewLevel` into an offscreen canvas with its readouts turned off.
- **Linking** is a two-click page tool: click the source room, then the target, and one `connect` lands. The return door is chosen by ordinal; a target without that exit is refused with its real count.
- **Two sessions, one undo key.** The strip binds its keys to the strip canvas, the room editor to the document, and a stopper keeps one keypress from reaching both. The identity line says which session an undo will hit. A renumbering op (`reorder`, `add-room`, `remove-room`) discards an open room session's unsaved edits, saying how many, and reopens the room at its new index. Download is refused while a room session holds unsaved edits.
- **Forms** are derived: the manifest form from `SET_FIELDS`, `named_rooms` keys and arrival positions from `levelSetValidator.NAMED_ROOMS`, the music range from the game's song list. Rule targets are recomputed when the record or selection changes (an op, an undo, a selection), never per keystroke. Arrival (`in_*`) exits are marked as gating nothing.
- **REPORT** runs `rulesJsonOf(session, deps, {compileRegionAtlas})` and lists: `validateLevelSet`, `validateRegionAtlas` with schema, unwired exits by room and ordinal, every free edge (read from the compiled rules, whose `access_rule` is what the world will do), every authored rule that reaches no compiled edge, unreachable regions by name, and the overlay's location count against the compiled one. The `rules.json` download is disabled, with its reason shown, while the graph does not close, the set is invalid or a rule is inert; the set and overlay downloads stay available. A room with no door at all is dropped by the derivation, so what the reachability check catches is an island of two or more rooms linked only to each other.
- **Downloads.** `downloadSet(session)` validates, stamps once and returns the set, the stamped overlay and the `apMappingInvalidation` companion. `rules.json` is written with `stringifyRulesJson`. ▶ load in wasm ships the whole set through `validatedChunks`, booting at the manifest's `start`.
- **Lifetimes.** Each LOAD remounts the panel on its own lifetime, so an old mount's listeners never act on a new session.

**Control ids.** `genEdit*` is a control both arms mount; `edit*` is a control only the EDIT arm has (inside `#editOnly`). `scripts/procgen/check-seedling-editor-arm.mjs` checks this over the live DOM.

**The OEL round trip.** Over all shipped rooms, `record → recordToOel → parseOelLevel → record` is a value fixed point, and parsing each disk `.oel` reproduces the committed atlas record. The writer's bytes are not identical to Ogmo's: it adds a trailing newline, the extract drops tiles outside the room rectangle, and it escapes a raw `>` inside an attribute value.

## Related documentation

- [Procgen Editing Core](./editing-core.md) — the edit core, editor view, set-editor mount and overlay shape
- [Flash Substrate](./flash.md) — Seedling rooms as pipeline regions
- [Seedling Real-Game Bot](./seedling-bot.md) — the bot, the tape and the level generator
- [Architecture](./architecture.md) — where editing sits in the overall flow
