# Procgen Editing Core

The substrate-free editing machinery in `frontend/modules/procgenCore/`: the edit core and editor view that every level editor is built on, the adapter contract a substrate implements, the shared toolkit for `rules.json` and region-atlas documents, and the set editor that edits a whole collection of rooms.

Everything described here is pure JavaScript with no substrate import. A test (`procgenCore/bindingContract.test.js`) reads the `procgenCore/` directory and fails if any module in it imports from `seedlingDemo/`, `mazeRoom/` or `flashPanel/`, so a new module is under that rule as soon as it exists. Substrate knowledge always arrives as a parameter. The Seedling side of these editors is in [The Seedling Editor](./seedling-editor.md).

## The edit core (`procgenCore/editCore.js`)

The edit core knows nothing about any substrate. The caller supplies an **adapter**, a plain object; the core registers none and imports none.

| Member | Contract |
|---|---|
| `name` | What a refusal calls the substrate. |
| `apply(record, op)` | Apply one atomic op and return `{ok, op, description, record?, reason?}`. The returned `op` is the resolved one, with any random parameter already drawn. `ok: false` is a refusal with a sentence. The input record is never mutated. `reason` is optional and names a refusal class (not a sentence) so a page can branch on it; the core never invents one. |
| `equal(a, b)` | Record equality — the "did anything change" test. |
| `bounds(record)` | `{w, h}`, the cell grid. |
| `readCell(record, x, y)` | A closed, comparable cell descriptor. |
| `writeOps(descriptor, x, y)` | The atomic ops that make a cell match the descriptor — the inverse of `readCell`, emitting ops only for fields the descriptor has. |
| `bases` (optional) | `{kind: (tag) => record}` — how a payload's `base` tag becomes a record. Absent means the page resolves it. |

`assertAdapter` checks this shape. `assertAdapterBehaviour(adapter, {record, op, refused, cell, other})` checks the seven behaviours the functions below rely on: positive integer bounds, `apply` follows its contract, `apply` does not mutate its input, `equal` is true of a record against itself and false after a real op, a refusal carries a sentence, `writeOps` returns an array, and `readCell` → `writeOps` → `readCell` reproduces the descriptor **at a different cell** (on the same cell, a `writeOps` that returns nothing would pass). It ships from the core so the next adapter author can run it.

`resolveBase(adapter, tag)` routes a `{kind, …}` tag to the adapter's `bases`; the core never interprets the tag itself. A kind the adapter does not offer, and an adapter with no `bases`, are refused with different sentences.

### The functions

| Function | What it does |
|---|---|
| `foldEdits(adapter, base, ops)` | base → ops in order → `{record, applied, steps, dropped}`. The one reconstruction. `steps` carries each applied op with the adapter's sentence, so a page's readout needs no second pass. |
| `createEditSession(adapter, baseRecord, {base, certified})` | `apply`, `undo`, `ops`, `record`, `certified`, `setCertified`, `payload`. `payload()` is `{base, edits, certified}`, where `base` is an opaque tag. |
| `group(label, ops)` | A stroke, fill or paste: applied all-or-nothing, one entry in the op list, one undo. Nested groups are refused. |
| `rectCopy` / `rectPasteOps` | Copy a rectangle of descriptors; paste it back as one group, clipped to the destination. `only: '<field>'` filters to one descriptor field (`tilesOnly` and `entitiesOnly` are aliases, `FILTER_ALIASES`); a field the descriptor lacks is refused. |
| `floodOps` | Repaint the 4-connected component of cells whose descriptor matches the seed's, as one group (using `gridFlood.reachableFrom`). |
| `describeOps(ops)` | The readout line, for example `3 edit(s) (1 group of 12)`. |

### Two rules

1. **Identity is `base` + `ops`.** Undo is the fold over a shorter list — never an inverse op or a stack of records — so a level reached by undoing is byte-identical to one that never had the undone edit.
2. **A no-op is not an edit.** "Did this change anything" is asked of the record through the adapter's `equal`, never of the op. A click that paints a cell with the tile it already has leaves the edit count and the certification alone.

The core never judges whether an edit is legal for the game. Editing is free; certification is the guard. Every refusal in the core is about the shape of an op or an adapter.

`editCore.test.js` tests the core against a toy adapter defined in the test file and imports nothing from any substrate, so the core cannot quietly depend on one.

### Adapters

| Adapter | Document | Cell space |
|---|---|---|
| `mazeRoom/mazeEditAdapter.js` | a maze room (wraps `mazeRoomEditor.applyEditOp`) | yes |
| `seedlingDemo/seedlingEditAdapter.js` | a Seedling room (wraps `watchEdit`) | yes |
| `seedlingDemo/seedlingSetAdapter.js`, `mazeRoom/mazeSetAdapter.js`, `procgenCore/worldSetAdapter.js` | a set of rooms (one-row grid) | yes |
| `regionMarkingTool/atlasEditAdapter.js` | a region atlas | yes (per level) |
| `bounceRegionEditor/bounceEditAdapter.js` | a bounce level | no |
| `apworldEditor/rulesEditAdapter.js` | a `rules.json` | no |

**Cell-less adapters.** `bounds`, `readCell` and `writeOps` are the cell-space trio (`CELL_SPACE_MEMBERS`). A document that is not a grid of cells — a bounce level places platforms at fractional pixel positions, and a `rules.json` has no canvas — declares all three absent. `hasCellSpace` requires all three or none; a partial trio is refused as a mis-typed adapter. For a cell-less adapter, `rectCopy`, `rectPasteOps`, `floodOps`, `descriptorFieldsOf` and `mountEditorView` refuse by name, and `assertAdapterBehaviour` skips the three cell-space checks (listed in `CELL_SPACE_LAWS`) only when the caller passes `say`, so the skip is always reported.

**Key order is content for documents.** The three document adapters (atlas, bounce level, rules document) use `procgenCore/deepEqualKeyOrder.js` as `equal`. It is deliberately not `canonicalJson`, which sorts keys and is right for cell descriptors. A document's key order is part of its committed bytes, so a sorting `equal` would report a key-order-only op as a no-op while the saved bytes changed. The walk checks `a === b` first at every depth, which is cheap because every op module here is copy-on-write.

## The editor view (`procgenCore/editorView.js`)

`mountEditorView` is the DOM half of the edit core and the one place on a page that decides what a press on the canvas does. It imports only `editCore.js`. It owns four things:

1. **The canvas tool — one `armed` value.** `brush`, `rect`, `paste`, `flood` (`TOOLS`), a page tool, or nothing; `Escape` clears it. A **page tool** is `{id, label, key, at(cell)}`, for gestures the page brings (Seedling's click-to-anchor template placement, the set editor's two-click link).
2. **A stroke is one group.** A drag paints every cell it visits, once each and in order, and records one `group`, so one undo removes the whole stroke. The click the browser fires after release is swallowed.
3. **The command table is the one writer of the key map.** The page supplies `{id, label, key, run}` rows; the view adds the four tools and `Escape`. Two rows claiming one key are refused. `Ctrl/Cmd+Z` resolves to the page's own `undo` row.
4. **The selection overlay.** The page draws the substrate; the view draws, on its own element, the rectangle being copied and the paste anchor. Hover stays the page's. A page may add shapes through an optional `shapes()`, drawn after the view's own.

Shapes are in cell space with fractions allowed (the centre of cell 3 is `{x: 3.5}`). The kinds are `rect`, `paste` and `polyline` (`SHAPE_KINDS`); `arrow` and `arrowBack` are flags on a polyline, and a head is drawn along the last segment. `assertShape` validates a shape and refuses an unknown kind by name.

Everything substrate-specific is injected and refused by name if missing: `cellAt` (canvas geometry), `brushOp` (the palette as an op template), `floodTarget`, `pasteOptions`, `clipWarnings` (printed before a paste lands) and `say`. `brushOp` returns an op, `null` (nothing armed) or `{refused}` (the palette cannot build an op, with the reason).

The returned handle has `repaint()`, which asks `shapes()` again and repaints the overlay without touching the armed tool or firing `onChange`. A host that resizes the target canvas after mounting calls it.

The view is mounted on the maze lab page's EDIT arm, on `watch.html`'s edit panel, and on the set editor's room strip. Each mount has its own lifetime, so a remount never leaves an old listener attached.

## The rules.json and atlas toolkit (`procgenCore/`)

Shared modules for the documents every substrate uses:

| Module | What it provides |
|---|---|
| `contentIdentity.js` | `stableStringify`, `fnv`, `computeContentHash(doc, {idKey})`, `stampIdentity(doc, {idKey, defaultBase, baseId})` — content-hash ids for atlases, libraries, pools, level sets and datasets. |
| `rulesGraph.js` | `regionsOf`, `startRegionsOf`, `walkRulesGraph`, `walkRuleTrees`, `walkRuleTree`, `ruleTreeSlots`, `reachableRegions` — walkers over a `rules.json` region graph and its rule trees. |
| `ruleItemNames.js` | `itemNamesInDocument` and friends — every item name a document's rules reference. |
| `apIdNamespaces.js` | The register of every Archipelago id base in use, with provenance, plus `allocateIdsBySortedName`. |
| `jsonSchemaCheck.js` | A draft-07 evaluator over the keywords this repo's schemas use: `schemaErrors`, `ruleSchemaErrors`, `rulesJsonSchemaErrors`, `atlasSchemaErrors`. `jsonSchemaFiles.js` is the node-only loader. |
| `atlasOps.js` | `applyAtlasOp(atlas, op)` over `ATLAS_OP_KINDS`, pure and copy-on-write; also `deriveEdgeSide` and `unwiredExits`. |
| `ruleTreeOps.js` | `getRuleAt`, `replaceRuleAt`, `removeRuleAt`, `wrapRuleAt`, `ruleTreePaths` — path-addressed rule-tree edits, copy-on-write. |
| `deepEqualKeyOrder.js` | Deep equality in which key order counts (see above). |
| `setEditorCore.js` | The set editor's substrate-free calculations: `roomRowsOf`, `moveOrder` and the renumbering mappings, `renumberDecision`, the `OVERVIEW` strip layout and `exitArrowShapes`, `gateabilityOf`, `inertRulesOf`, `freeEdgesOf`, `reportOver`. |
| `setOverlay.js` | `createSetOverlay(spec)` — the shape of a set's authored overlay — and `applyOverlayRules(atlas, byRoom)`. |
| `setEditorView.js` | `mountSetEditor(opts)` — the set editor's DOM (see below). |
| `worldDocument.js`, `worldDerivation.js`, `worldSetAdapter.js` | A world: one session over several set documents. See [The Seedling Editor](./seedling-editor.md#the-world--one-session-over-several-set-documents-procgencoreworldjs). |
| `labRoomEnvelope.js` | The envelope a lab page sends to its host while a set session is open. |

### Content identity

Committed documents carry ids built by one algorithm: a sorted-key recursive stringify, FNV-1a/32 over UTF-16 code units, computed over the document minus `provenance` and minus its own id key, written as eight lowercase hex digits appended to a base id. Save files keyed on a `set_id`, presets naming an `atlas_id` and the byte-identity checks under `scripts/procgen/` all depend on it, so changing any part moves them all. `contentIdentity.test.js` recomputes the ids of the committed documents. Other hashes in the repo (`shared/rulesHash.js`, the JtA `paramsHash`, omsi's hash, seed derivations) are separate and not part of this family.

### Walking a rules.json

`startRegionsOf` accepts both shapes of `start_regions` — the object form `{"1": {default: […], available: […]}}` used by committed files, and the array form `{"1": […]}` found in test fixtures — and returns `{default, available}`.

A rule tree's sub-rules sit where `ruleTreeSlots` says: `children[i]`, then every rule node under `args` (`args.<key>`, `args.<key>[i]`, a helper call's positional `args[i]`), then `kwargs`. A slot is recognised by shape (a plain object with a string `rule`), never by rule kind; an array or a typed `{type: …}` value is data.

`reachableRegions` takes the rule evaluator as a parameter, because the repo has several rule interpreters and the toolkit commits to none. With no evaluator every edge is open, and the answer is purely structural.

### The id register

`apIdNamespaces.js` records every id base already used in committed data; nothing in it may move. Each row names where the literal lives and what breaks if it changes. A census sweeps the tree for id-base literals and for the `ap_id_offset` fields in per-game configs, and fails on any value the table does not declare. Item ids and location ids are separate Archipelago id spaces, so an item base equal to a location base is not a collision.

### Schema checking

The repo ships no JSON-Schema library for JavaScript; `jsonSchemaCheck.js` covers the keywords `rules.schema.json` and `region-atlas.schema.json` use. An unknown assertion keyword throws by name, so the checker never reports "valid" for something it did not understand. Every entry point takes the parsed schema as a parameter, because `procgenCore/` is loaded by browser pages and a `node:fs` import would break them; `jsonSchemaFiles.js` does the disk read in node. `validateRegionAtlas` runs the structural pass first when given a schema, so a malformed document is reported as a shape error rather than a cascade of reference errors.

Tests run the schemas over every committed atlas in `flashPanel/atlases/` and every committed preset `rules.json`. The atlas connection item is closed (`additionalProperties: false`), so declaring a field such as `vanilla_layout.connections[].one_way` actually constrains it.

## Op vocabularies

Every document editor here uses pure ops: take a document and an op, return a new document, never mutate the input, and share structure along untouched branches. Copy-on-write is what lets an editor hold, log and undo an edit, and it keeps builds that apply many ops (such as the Seedling playthrough atlas) from cloning the whole document per op.

**Key order is preserved exactly:** an overwritten key keeps its position, a new key is appended, and a dropped key is deleted rather than set to `undefined`. Atlases are byte-checked, and key order is part of those bytes.

### Atlas ops (`atlasOps.js`)

The kinds are `ATLAS_OP_KINDS`: region, exit, internal-exit, location and sub-region add/remove/set ops, `connect`/`disconnect`/`unwire`, `rename-region`, the inspector field setters (`set-game`, `set-name`, `set-region-name`, `set-rules-source`, `set-exit-rule`, `set-location-item`), and `apply-analysis`.

- `rename-region` refuses an id that is already used. The Archipelago projection allocates ids by name, so two regions with one id would silently merge.
- `connect` enforces that each endpoint is used at most once, and accepts `one_way`.
- `apply-analysis` is one op carrying the analyzer's proposal as plain JSON (`applyRegionAnalysis` merges analyzer rows with hand-authored ones), so accepting a region split replays deterministically and can be undone.
- `set-exit-rule` takes `null` to clear and refuses an omitted `access_rule`, because `undefined` does not survive a JSON round trip.

**The atlas adapter** (`regionMarkingTool/atlasEditAdapter.js`) makes the region marking tool an edit session, so it has undo; `AtlasSession` wraps `createEditSession`. Its cell descriptor is `{region, exit, entrance, location}` (ids, not objects). A tile carries no sub-region — membership is recomputed by the analyzer — so a location's `sub_region` rides inside the location. Region bounds are local to a level, so the adapter needs a `levelView()` answering `{level, width, height}`; a session opened without one (every headless caller) refuses the cell-space members by name. `writeOps` can write a tile's location (`add-location`) and entrance (`set-entrance-tile`); membership of `exit_tiles` has no op.

### Rule-tree ops (`ruleTreeOps.js`)

A path step is a child index or a named slot from `ruleTreeSlots`; `ruleTreePaths` lists the same slots `walkRuleTree` visits. A named slot can be replaced but not removed.

### rules.json ops (`apworldEditor/rulesDocOps.js`)

The APWorld editor is an edit session too, so it has undo. Its `rulesDoc` is a getter over `session.record()`. The vocabulary is `RULES_OP_KINDS` (`applyRulesDocOp`), and `rulesEditAdapter` is the cell-less `{name, apply, equal}`.

- **Refusals come from the validator.** An op that could break a reference (`delete-region`, `delete-item`) runs `validateRules` over the document it would produce and quotes the first new error. Each has a `…Ops(doc, name)` builder whose list the caller wraps in one `group`.
- **Renames are single ops** that cascade to every reference.
- **Reload is a session boundary; Clear is an op.** A document arriving from outside (the app's publish, the marking tool's hand-off, Reload) starts a new session. Clear is undoable. Apply publishes `session.record()` without resetting the session.
- **An op's payload is copied on entry.** `set-rule-tree`, `set-completion-condition` and `set-item-field` carry JSON that the caller (the rule-tree editor) may keep editing in place. `applyRulesDocOp` copies the op first and returns the copy as the resolved op, so the record and the edit list never alias the caller's object.

## The set editor

A **set** is a collection of rooms edited as one document: a Seedling level set, or a maze region library. The set session's record is `{set, overlay}` (or `{library, overlay}`), and the region atlas is derived from it on demand rather than stored. The Seedling set adapter and its ops are described in [The Seedling Editor](./seedling-editor.md#the-seedling-set-session-seedlingdemoseedlingsetadapterjs).

`mountSetEditor` (`procgenCore/setEditorView.js`) is the set editor's DOM: the room strip and its thumbnail cache, the two-click link gesture, the rooms table, the manifest and room forms, the rule box, the REPORT and the downloads. It is mounted by two pages over the same `edit*` element ids: `watch.html`'s SET arm (bound by `seedlingDemo/watchSetEditor.js`) and `mazeRoom/lab.html?source=set` (bound by `mazeRoom/mazeSetLab.js`).

### Mount parameters

Every substrate-specific input is a named parameter, checked by name at mount so a missing one fails immediately rather than several renders later. The page also passes `compileRegionAtlas` and `validateRegionAtlas`, which the mount does not import itself.

| Parameter | What it is |
|---|---|
| `adapterFns` | `ADAPTER_FNS`: `readSetCell`, `exitsOfRoom`, `whatLinksHere`, `bounds`, `validateForDownload`, `deriveAtlasOf`, `rulesJsonOf`, `closeRoomSession`, `download`. |
| `document` | `{kind, noun, validator, idOf, docOf}` — what the REPORT calls the document and which half of the record it is. |
| `ruleKeys` | `{exit, location}` — the overlay's rule-key builders, so the `exit:` / `loc:` prefixes are never typed as literals. |
| `forms` | `{manifestRows(), roomRows()}` — the set-level and room-level form fields. |
| `exits` | `{valueOf, labelOf, addressOf, targetOptions, disconnectOp}` — a Seedling exit is addressed by ordinal, a maze exit by `exit_id`. |
| `locations` | `{options(cell), emptyWhy, targetOf(value)}` — a Seedling location is an entity at exact pixels; a maze location is an `items[]` index. |
| `drawRoomStill(canvas, cell, index)`, `stillKey(cell)` | The page draws its own substrate; the mount only blits. The key says when a thumbnail is stale. |
| `linkBound(record)` | `{ok, why}` — whether the link scan is affordable, said out loud either way. |
| `isRefusal`, `rulesSchema`, `addRoomOp(at)` | The substrate's refusal classes, the parsed `rules.schema.json`, and a builder for the `add-room` op (called inside a `try`, because building it can refuse). |
| `sourceKind(cell)` | Where a room's contents live (`record`, `xml` or `embed`). The mount records the `embed` answers as it paints and exposes them as `badges()`. |

**Downloads.** `adapterFns.download` returns `{members: [{kind, doc, name, label, readout}], report, apMappingWhy?}`, and the mount writes one file and one readout per member. Download readouts are scoped to the press: the handler clears its readouts and increments `__editorSetBundlePresses` / `__editorSetRulesPresses` before any check, so a test can wait on a counter that changes and tell a refused press from an earlier success. The bundle button refuses a member whose `kind` is not in `documentBundle.BUNDLE_KINDS`, quoting the list, rather than dropping it.

### Change notifications

`onSetChange({why})` is called after the mount's own render on every path, so a page can publish what it reads from the mount as well as from the session. `why` is one of `SET_CHANGE_WHY`: `op` (an applied op or undo, or the follow-up a renumbering sends), `report`, `close`, `select` (only when the selection moves), `room` (the rooms table's OPEN), `download` and `handoff` (the *Open in APWorld Editor* press).

Two controls belong to the page on both pages: it fills the room `<select>` (the mount only sets its value) and enables the set controls. `#editRoomClose` belongs to the mount, which disables it whenever no room is open.

### Overlays (`setOverlay.js`)

Every set substrate's overlay is `rooms` keyed by room index, each room carrying `{name?, locations[], rules{}}`, with rules keyed `exit:<exit_id>` or `loc:<name>`. The prefixes make an exit id and a location name impossible to confuse. `createSetOverlay` takes as parameters the two things that differ per substrate:

| | A location's address | Extra top-level fields | Location-name uniqueness |
|---|---|---|---|
| Seedling | `entity: {type, x, y}` — an OEL element, in pixels | `neverEnter`, `regions` | `'room'` — the derived AP name is prefixed with the level |
| Maze | `item: <index>` into the entry's `payload.items[]` | `links[]`, `start` | `'set'` — the derived name is the authored name |

A binding that declares no `locationFields` is refused. `locationNameScope` defaults to the stricter `'set'`, and an unknown value is refused. The scope matters because `regionAtlasCompiler` allocates AP location ids from the derived name alone, so what an author may repeat depends on whether the derivation prefixes the room into it.

### The maze's derived atlas (`mazeRoom/mazeAtlasDerivation.js`)

A maze set is a region library (`frontend/region-libraries/*.json`). A library entry's exits carry `targetRegion: null` and its `carried_rules` is `null` by contract (`regionLibraryValidator.js`), because entries are interchangeable content that `stitchGrid` wires at instantiation. So the derived atlas takes `region_id` from the entry id, `map_ref` from the entry index, bounds from the payload size, boundary exits from `payload.exits[]` (with their `exit_id`), and locations from the items the overlay has marked. **Connections come from the overlay's `links[]`**, because no maze room carries one.

- A boundary exit is an `edge`, and its `side` is derived by `atlasOps.deriveEdgeSide`; the payload's own `side` is a cross-check that refuses an entry whose metadata disagrees with its tiles.
- `one_way` defaults to `false`, the opposite of Seedling, because a maze crossing is walked both ways. The arrival side of a one-way connection gates nothing (`regionAtlasCompiler` records it as `arrivalOnly`); a two-way arrival does.
- There is no `subgraph`. A maze room is one connected floor by construction, so the derivation floods the payload from its entrance and refuses a split floor by name.
- `mazeGridFor` supplies the grid `compileRegionAtlas`'s maze arm needs; a maze payload's tiles are the grid.

### Opening a room from the app

Both lab pages run inside the app in a `procgenLabPanel` iframe, which also serves as a room-editor host using the existing `procgenLab:` messages: a document goes in over `procgenLab:load` (each page classifies it with the classifier it already has — `documentBundle.classifyDocument` on the maze page, `sniffLoadBox` on Seedling's), one room is opened over `procgenLab:navigate` with `?source=<arm>&room=<n>`, and the folded document comes back over `procgenLab:levelChanged` as a `procgenCore/labRoomEnvelope`. The host's `onSave` fires when the envelope's open-room index goes from `n` to `null` — the close itself, not an edit count. Which substrates open this way is the registry's `roomEditor` declaration; the resolver is `procgenPipeline/regionEditors.js` (see *Region editors* in [The Stepped Pipeline](./stepped-pipeline.md)).

The reverse direction is `procgenLab:openInApworldEditor`, carrying `{substrate, iframeId, rules, source}` — the document the page's REPORT compiled. `procgenLabPanel` forwards it as `apworldEditor:loadRules` followed by `ui:activatePanel`. The button is hidden when the page runs standalone. The bounce region editor is a panel in the same app, so it publishes `apworldEditor:selectRegion {region, player?}` instead ([APWorld editor](../../modules/apworldEditor.md#the-links-tab)).

## Related documentation

- [The Seedling Editor](./seedling-editor.md) — the Seedling room, set and world editors
- [Architecture](./architecture.md) — where editing sits in the overall flow
- [The Stepped Pipeline](./stepped-pipeline.md) — the pipeline's per-region editors
- [Maze Substrate](./maze.md) — the maze lab page
- [Substrate Registry Reference](./substrate-registry.md) — the `roomEditor` declaration
