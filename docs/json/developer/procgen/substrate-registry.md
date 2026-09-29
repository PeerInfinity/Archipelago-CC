# Substrate Registry Reference

`frontend/modules/shared/procgen/substrateRegistry.js` connects the pipeline, the runtime player and the substrates: each substrate registers an **entry**, and consumers look entries up by `id` instead of importing substrate modules. This page documents the entry fields, the generated capability matrix, and how to add a substrate.

## Registry mechanics

The registry is a singleton with `register(entry)`, `get(id)`, `has(id)`, `getAll()` and a test-only `clear()`. `register` throws on a missing or duplicate `id`, so callers check `has()` first. It validates only `id` and `sharing`; every other field is a plain declaration that consumers check when they use it, so headless code can read any field without a browser.

Each entry is registered twice, both times behind a `has()` guard: when its `*Library.js` is imported (so `scripts/procgen/` CLIs and tests get a populated registry without panels), and again from the module's `register()` hook in the live app. Headless scripts depend on the first — see [Gotchas](./gotchas.md#substrate-libraries-register-on-import--headless-scripts-depend-on-it).

Entry factories build families of entries: `createFlashSubstrateEntry` (`flashSubstrate/flashSubstrateLibrary.js`) builds one per Flash game, and `createBounceSubstrateEntry` (`bounceDemo/bounceDemoLibrary.js`) builds on it for bounce and runner. The Seedling entries use the Flash factory but render in the flashPanel — see [Flash Substrate](./flash.md#flash_seedling--a-real-games-map-as-procgen-regions).

## Entry contract

Every group after Identity is optional; consumers check for the fields they need when they dispatch. The [capability matrix](#capability-matrix) shows which entry carries which field.

### Identity

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique substrate id (the matrix column headers). Used in sidecar entries, quota flags and every dispatch. |
| `label` | string | Display name for UI such as the panel-status overlay. |

### Runtime

| Field | Type | Meaning |
|-------|------|---------|
| `panelComponentType` | string | Golden Layout component type of the panel that renders this substrate's regions. |
| `loadRegionEvent` | string | eventBus event the panel subscribes to; procgenPlayer publishes it with the deserialized world when the player enters a region. |
| `iframeId` | string | For iframe-hosted panels: the iframeAdapter id. procgenPlayer re-publishes the region's load event when this iframe announces `appReady`, so a load sent before the bridge subscribed is not lost. |
| `supportedFeatures` | string[] | Shared-library feature ids the substrate can realise (for example `logic_gate`, `nesw_exits`, `arbitrary_ap_locations`). |
| `deserializeWorld` | `(playable_payload) → world` | Builds a region's world for the warehouse. The world's `exits` must be a `Map` keyed by exit name (`procgenPlayer.handleRegionMove` calls `world.exits.has(exitName)`), and a payload's `manaEnabled: true` must be copied onto it (`procgenPlayer.getRegionInfo` reads the world). May throw to refuse a payload. |
| `serializeWorld` | `(world, …) → sidecar payload` | Inverse of `deserializeWorld`, used when writing `preset_sidecars` and at the end of procedural generation. |
| `sidecarFields` | `{ [payloadKey]: descriptor }` | Declares each top-level `playable_payload` key `serializeWorld` writes. Required on every entry with a `deserializeWorld`. |
| `apLocationNamesOf` | `(playable_payload) → string[] \| null` | *(optional)* The payload's AP location names, or `null` if it has none. If absent, the validity report says it did not check them. |
| `apExitNamesOf` | `(playable_payload) → string[] \| null` | *(optional)* The region's complete exit list from the payload. If absent, the exit check is skipped and the report says so. |

**Refused payloads.** A throw from `deserializeWorld` loses one region, not the document: through `procgenCore/deserializeRefusal.js` the warehouse and the composite map skip that region, and the sphere rebuild, which cannot drop a node, refuses the document with `SPHERE_REBUILD_REFUSALS.unreadablePayload`.

**Payload declarations.** `rules.schema.json` treats `playable_payload` as opaque, so the shape is declared on the entry. A descriptor is `{type, required?, enum?, derived?, description, schema?, references?}`; `references: {field, key}` means the value must equal a sibling entry's `payload[field][key]`. The vocabulary is `procgenCore/sidecarFields.js`: `validateSidecarFields` checks a declaration and `sidecarFieldsOf(entry)` merges it with the engine-written envelope (`exits`, `entrance`, `manaEnabled`, `fogEnabled`, in `ENVELOPE_SIDECAR_FIELDS`). An entry may not redeclare an envelope key (`ENVELOPE_REDECLARED`) except to mark it always written (`REQUIRED_ENVELOPE_FIELD`). Like every field except `id` and `sharing`, it is not checked by `register()`.

`scripts/procgen/check-sidecar-fields.mjs` checks every tracked `preset_sidecars` entry against its declaration with `sidecarPayloadErrors`, the same check the APWorld editor's validity report (`apworldEditor/sidecarIssues.js`) uses. Shared helpers include `flashZoneSidecarFields`, `tileGridApLocationNames`, `nameMapValues('ap_locations')` and `envelopeExitNames`.

### Playback

| Field | Type | Meaning |
|-------|------|---------|
| `getPlaybackController` | `() → PlaybackController \| null` | Used by the playback bot and the loops `customQueue` action. `null` means no panel is mounted and the caller does nothing; an entry without the field has no bot. |

A **PlaybackController** has `play(rateHz?)`, `stop()`, `step()`, `instant()`, `reset()`, `setRate(rateHz)`, `walkTo(target)` with target `{ kind: 'location'|'exit'|'tile', name?, region?, x?, y? }`, and optional `replayActions(actions, { onComplete, departureExitId, instant })`, which replays a visit's interior and then crosses `departureExitId` itself. Methods return `void` or `Promise<void>`; progress comes back as `user:locationCheck` / `user:regionMove` events. Iframe substrates implement it as a host-side proxy to a bridge in the iframe.

### Action labelling

| Field | Type | Meaning |
|-------|------|---------|
| `describeAction` | `(entry) → string` (optional) | How this substrate names one shared `actionQueue` entry (`'move E'`, `'check Chest'`). Recordings store no label, so every surface that shows an entry calls this, including `blockAnnotations.foldRecordedItemUses`. If absent, callers use the entry's `label`, then its `actionId`. The caller adds any `×n` suffix. The maze's is `describeMazeAction` in `mazeRoom/mazeKeys.js`. |

### Composite map

The composite map is the grid-of-regions canvas in the Procgen Pipeline panel and the APWorld editor's **Map** tab.

| Field | Type | Meaning |
|-------|------|---------|
| `compositeMap` | object (optional) | Declares that this substrate paints its own cells. If absent, the region is a generic box labelled with the substrate id. |
| `compositeMap.drawRegion` | `(ctx, region, { offX, offY, regionSize, tilePx, colors })` | The painter, called once per placed region with the cell's canvas origin. Kept in its own module (`mazeRoom/mazeCompositeMap.js`, `textAdventureSubstrateWrapper/textAdventureCompositeMap.js`) so the library stays node-importable. |

`drawCompositeMap(canvas, grid, regionSize, { selection, tilePx, colors, registry })` in `procgenCore/compositeMapRenderer.js` draws empty and stub cells, borders, connections and the selection, and resolves every other cell through `substrateRegistry.get(region.render_hint ?? region.substrate)?.compositeMap?.drawRegion`. It also exports `resolveExitTilePositions`, `fitTextToWidth`, `canvasPointOf`, `cellAtPoint`, `TILE_PX` and `COLORS`.

### Loop mode

| Field | Type | Meaning |
|-------|------|---------|
| `loopSupport` | object | Which loops-panel features this substrate's regions get. If absent, none. |
| `loopSupport.queueActions` | string[] | Loop-queue action types that can be authored for a region: `'regionMove'`, `'locationCheck'`, `'explore'`. |
| `loopSupport.manual` | boolean | The region can be played by hand in loop mode. |
| `loopSupport.record` | boolean | The Record block mode is offered (requires `playback`); without it the default block mode falls back to Manual. `record` plus `playback` also turns on the strict loop-mode action gate and the live-play drain. |
| `loopSupport.playback` | boolean | Recorded visits can be replayed: by `replayActions` on fine-grained substrates, or by the loops executor for coarse ones. |
| `loopSupport.instant` | boolean | A Playback or Bot block can run in one burst (the per-block Instant toggle; summary substrates declare it without the toggle). For Bot blocks the toggle shows only when `loopState.regionBotHonorsInstant` holds (`instant`, `executeVia: 'solver'` and fine-grained), so wire the Bot before declaring all three. |
| `loopSupport.summaryRecording` | boolean | Summary capture: Record stores the visit's net result and Playback applies it instantly; regions are priced by time. A real recorder (`takeLastRecording`) wins if both are present. |
| `loopSupport.customQueues` | boolean | The legacy custom-queue dropdown (attach a saved queue as a `customQueue` action). |
| `loopSupport.requiresLoopMode` | boolean | A loop game whose regions only work in loop mode; loops refuses a user loop-mode disable while one is loaded. See [loop-recording.md](./loop-recording.md#requiresloopmode--loop-game-substrates). |
| `loopSupport.executeVia` | `'solver'` (optional) | A Bot-mode block drives the substrate's PlaybackController (`walkTo`) and waits for the resulting event. If absent, actions run on the generic timer. |
| `takeLastRecording` | `() → SavedQueue \| null` (top-level entry field) | Pull and clear the recorder's last visit. Loops pulls it only when a Record block leaves through its expected exit. Its presence marks the substrate fine-grained, so declare it together with `record`/`playback`; otherwise loops treats the substrate as coarse and charges `loop_costs` on top of its own economy. |

Loops sorts substrates into three capture categories in one place, `loopState._captureShapeFor`: **fine-grained** (has `takeLastRecording`; actions finer than a queue entry, and it charges its own live play, gated on loops' `livePlayRegion()`), **coarse** (no recorder; the block's queue entries are the recording) and **summary** (`summaryRecording`). Details: [Loop Recording and Block Modes](./loop-recording.md).

### Cross-substrate sharing

The optional `sharing` field declares which resource-channel categories a substrate takes part in; `register()` throws on an unknown category or bad shape. The host side is `frontend/modules/resourceChannels/`: helpers for in-process substrates, a router for iframe channel events (`substrate:resourceDelta`, `substrate:resourceBonus`, `substrate:resourceReset`) that rejects undeclared substrates, and the `crossSubstrate:itemGranted` notification.

| Field | Type | Meaning |
|-------|------|---------|
| `sharing.mana` | object (optional) | Takes part in the shared-mana channel (drain, refill, bonus, reset against the loop-mode pool). |
| `sharing.mana.loopActionDelegation` | boolean (optional) | Loops hands action execution and per-step charging for this substrate's `manaEnabled` regions to the substrate's own walker. |
| `sharing.items` | object (optional) | Offers consumables named `<substrateId>/<type>`, listed by exactly one of `types: string[]` or `getTypes(): string[]`; `grantItem` validates against it. |

### Editing

| Field | Type | Meaning |
|-------|------|---------|
| `roomEditor` | object | The room editor: open room i of a document and get one saved room back. `kind: 'panel'` carries `open({region \| record, base?, contract?, onSave})`, a panel launcher loaded by dynamic import. `kind: 'lab'` carries `page` (the `procgenLabPanel` page, `maze` or `seedling`) and `arm` (its `?source=` for a set document). Resolved by `getRegionEditor(id)` in `procgenPipeline/regionEditors.js`. |
| `regionRoundTrip` | object | How a document region goes into that editor and back. `open({regionId, payload, region, itemPool, expectedItems})` returns `{session, unedited}`; `save(saved, ctx)` returns `{payload, exits, locations}`; either may be async. `{refused: '<why>'}` declares there is none. Optional `rules` (`procgenCore/roundTripRules.js`): `'authored'` when the payload's rules must equal the document's, `'derived'` (default) when rebuilt from geometry. Resolved by `apworldEditor/regionRoundTrip.js`. |
| `exitSides` | object (optional) | What else in the payload is keyed by an exit's `side`: `{keys, relabel}`. `relabel(payload, moves)` is pure and applies `moves = [{exitId, from, to}]` together; the editor writes `payload.exits` itself. If absent, exit-side moves are refused. Read through `exitSidesOf` in `procgenCore/exitSides.js` by the APWorld editor and the pipeline's `moveSphereExitSide` / `swapSphereExitSides`. |

`unedited` is the baseline: if saving an untouched region would already change the document, the APWorld editor disables Edit and says why. A `lab` editor exchanges the document with its page over `load`, `navigate` (`?source=<arm>&room=<n>`) and `levelChanged` (a `procgenCore/labRoomEnvelope`); `onSave` fires when the open-room index returns to `null`. See [The Stepped Pipeline](./stepped-pipeline.md).

For flash zones an exit's `side` keys `params.sidePortals` (`flashSubstrate/bridge.js`), so `flashZoneExitSides` re-keys that map in place and moves `params.backExitSide`, and bounce adds its `BOUNCE_EXIT_SIDES`. Substrates that only label exits by side declare `SIDE_AGNOSTIC_EXIT_SIDES`. The maze declares none: its exits are tiles, so moving one is a geometry edit. `sideMayHoldAnotherExit(entry)` allows a second exit on a side only when `keys` is empty. `sidecarFieldsRegistry.test.js` requires the field on every `'sides'` entry and no `'tiles'` entry.

### Build-time — procedural substrates

Implemented by `maze` (tile-grid helpers in `adapterPrimitives.js`), `text_adventure` (`textAdventureRoom.js`) and `flash_seedling_gen` (`seedlingDemo/seedlingGenRoom.js`, attached by `installSeedlingGenRoom` — see [Flash Substrate](./flash.md#generated-rooms-flash_seedling_gen)).

| Field | Meaning |
|-------|---------|
| `generateRegionCore` | Generate a region's core geometry/world from driver input. |
| `placeFromItems` | Place items and obstacles (the grid-growth placement path). |
| `placeFromRules` | Place gates, items and locations to satisfy the region's access rules. |
| `extractPathsAndObstacles` | Extract the access rules the generated geometry enforces, to check them against the authored ones. |
| `applyContentModules` | Optional post-build pass for content modules (the maze's hazards). |

### Build-time — content sources (zone-based substrates)

A **content source** supplies existing region content by ordinal: its Nth planned cell becomes its Nth entry. The shuffled-spiral driver resolves one per cell through `resolveSpiralContentSource` in `procgenPipelineEngine.js`, and content slots draw no rng ([byte-identity](./stepped-pipeline.md)). The content sources are the zone games (`jta`, `bounce`, `runner`, `omsi`) and `flash_seedling`, whose entries are real atlas rooms ([Flash Substrate](./flash.md#as-a-content-source-in-the-pipeline)).

| Field | Meaning |
|-------|---------|
| `zoneCount` | Pool size. `arrangeShuffledSpiral` allocates no more regions than this, and the APWorld editor's *Zone N* source (`apworldEditor/regionContent.js`) offers `0..zoneCount-1`. |
| `extractZoneRules(zoneIdx, ctx)` | Instantiate one entry: locations, per-side exit rules, obstacle defs and `playable_payload` fragment. |
| `getSpiralContent()` | The installed content document, for the stepped pipeline's content step; `null` when none is installed. |
| `applyPipelineConfig(cfg)` | Install this source's pipeline config (called via `applySubstrateConfig`); `applyPipelineConfig({})` restores defaults. See [The Stepped Pipeline](./stepped-pipeline.md#spiral-mode--four-steps). |
| `pipelineConfigKeys` | The keys `applyPipelineConfig` reads, as a frozen array. Tested in `procgenCore/substrateConfigRecord.test.js`. |
| `pipelineConfigFromParams({params})` | A panel-bag knob turned into this source's `growthParams.substrateConfig[id]` entry, merged by `presetRun.buildSpiralRun` for a quota substrate with no entry yet; `null` adds no key. `flash_seedling`'s `seedlingAtlasId` ([Flash Substrate](./flash.md#the-atlas-knob-and-the-swim-census)). |
| `recordablePipelineConfig()` | The part of the installed config a document should record (defaults included). `buildRulesJson` writes it to `procgen_metadata[<player>].substrate_configs[id]` for each declarer that realised a region. |
| `zoneConfigFromSlot({entries, locations, blocks, fetched})` | Read back the config one player slot's zones were built with, without installing it: `{ok, cfg, assumed, zoneCount, host}`, optionally `zoneNames` and `unplaceable`. The editor verifies `assumed` by re-extracting every zone. Returns `{ok: false, needs: [path]}` when served files are needed (`resolveZoneFetches` fetches them). A `recorded` config wins over read-back. |
| `zoneOfPayload(payload, cfg)` | The zone a region's payload plays, or `null`; the editor refuses a zone already in use. |
| `zoneSourceLabel` | The editor's name for this zone source. If absent, *Zone N*. |
| `onContentEdit(doc)` | Restamp a hand-edited content document (hash, id suffix, validation); idempotent. A changed id clears downstream steps. See [The Stepped Pipeline](./stepped-pipeline.md#spiral-mode--four-steps). |
| `rulesJsonBlocks()` | Top-level `rules.json` blocks this substrate's runtime reads, merged by `buildRulesJson` for substrates that realised a region. A key already present is refused, so one world cannot realise both Seedling entries (both write `flash_panel`). |
| `victoryItem` | The goal item, used as the completion item when the scenario pool has no `is_victory` item. |

A source that feeds a *document* into the pipeline (jta's dataset) declares `emitsSpiralContent: true` and names its config field with `spiralContentConfigKey` (default `datasetDoc`). Only jta is truly pre-built (indices into one game build); bounce and runner generate their zones and store them by value.

### Build-time — region geometry

| Field | Type | Meaning |
|-------|------|---------|
| `regionGeometry` | `'tiles'` \| `'sides'` (optional) | `'tiles'` (the default): each exit stands on a tile, so the engine writes `exits[].x/y`, `exits_placed[].tile_position` and `extracted_rules.exits[].position`. `'sides'`: exits are only sides, and the engine writes none of those and no `entrance` tile. Declare it on the entry, never as a factory default. |

`procgenCore/regionGeometry.js` holds `REGION_GEOMETRY`, `DEFAULT_REGION_GEOMETRY` and `geometryOf(entry)`, the only reader; unknown values are refused. When a tile region mirrors a sides-only neighbour's exit, the engine uses `perimeterMidpoint(side, regionSize)`, so maze regions do not change. jta and omsi reach the engine only through `assembleZoneRegion`; the sphere and top-down drivers refuse substrates without `generateRegionCore` or `generateZoneForSpecs`.

### Build-time — generation cost

| Field | Type | Meaning |
|-------|------|---------|
| `generationCost` | `'light'` \| `'heavy'` (optional) | `'heavy'` means seconds per region, so the CI row `procgenPipeline/presetDefs.generate.slow.test.js` skips presets that use the substrate and requires the skipped set to equal `PRESETS_SKIPPED_AS_HEAVY`. Default `'light'`. Read by `procgenPipeline/presetRun.js` (`substrateGenerationCost`, `heavySubstrateIds`). |

### Build-time — location capacity

| Field | Type | Meaning |
|-------|------|---------|
| `locationCapacity` | `{kind: 'unbounded'}` \| `{kind: 'tiles', capacityAt(size, params, demand)}` (optional) | How many locations a room of this substrate holds. `'unbounded'`: any number at any size (`text_adventure` lists its locations). `'tiles'`: `capacityAt` returns `{locations, gated}` for a room of `size`, or `null` where the floor is not a function of the size. `demand` carries the room's `exits` and `biome`. |

The vocabulary is `procgenCore/locationCapacity.js`. `locationDemandOf(spec)` counts what a realiser spec asks for: locations that take a tile (one with an item or a rule that is not `True_`; an item-less `True_` location puts nothing on its tile and can share one), how many of those are gated, and the exits. `sizeForLocations(entry, start, params, demand)` returns the first size on the realiser's grow ladder (`start`, then `+REGION_GROW_STEP` per axis) whose capacity holds the demand. It returns `null` when the entry declares nothing or cannot answer. `generateRegionProcedural` starts a room at that size instead of re-rolling four times and growing a step per attempt. It never goes below the size asked for, and it keeps the retry-then-grow as a fallback. The spec field `sizeFromCapacity: false` builds at the size asked for. `topDownRoomSizes(layout)` gives the same size per placed region from the layout alone; the APWorld editor's Initialise preview prints it.

The maze declares `mazeCapacityAt` (`mazeRoom/mazeLocationCapacity.js`). In an open room (the classic biome with `maxIterations: 0`, as top-down and the hub realise, or a room with no exit) every tile but the entrance and the exits is floor: `width × height − 1 − exits`. At most the site-percolation share `1 − 0.592746` of that floor may be gated, because a gate on a location's tile is a wall to the placer's reach. A walled room answers `null`. `mazeRoom/mazeLocationCapacity.test.js` holds the floor to what the placer lands. `apworldEditor/locationCapacity.slow.test.js` holds the gated share to the realiser's own growth over every committed classic slot: 11,422 of 11,442 rooms exact, the rest within −1 … +2 grow steps. `flash_seedling_gen` declares nothing: its realiser never re-rolls, and it refuses a level past its persistence-tag budget instead of growing.

### Build-time — region library entries (capture / instantiate / validate)

A **region library** stores a generated region as an entry and re-instantiates it into a later world. Implementations are in `mazeLibraryEntry.js`, `bounceLibraryEntry.js` and `runnerLibraryEntry.js`; the atlas pool is `procgenPipeline/regionAtlasPool.js`.

| Field | Meaning |
|-------|---------|
| `captureLibraryEntry(region, meta)` | Turn a region into an entry. The maze stores geometry only (`carried_rules: null`); bounce and runner store their rules verbatim. |
| `instantiateLibraryEntry(entry, ctx)` | Rebuild a region from an entry for a slot, drawing no rng. |
| `instantiateLibraryEntryForSpecs(entry, ctx)` | Requirement-aware variant, used by sphere placement (`buildSphereLibraryRegion`) and the APWorld editor's *Library entry* source (`apworldEditor/regionRegenerate.js`): relabels openings onto the slot's sides and reassigns items. |
| `libraryEntryRefusal(entry, ctx)` | Why `instantiateLibraryEntryForSpecs` would refuse this entry for `ctx`, or `null`; the editor's picker disables such entries. |
| `validateLibraryEntry(entry)` | Refuse an entry this substrate cannot instantiate. |
| `instantiateAtlasEntryForSpecs(entry, ctx)` | Instantiate a region-atlas entry (a piece of a real map): rules come with the entry, surplus exits are pruned, locations keep their names. |

`regionLibraryValidator.js` keeps its own `LIBRARY_V1_SUBSTRATES` list because it runs with nothing registered; `procgenCore/sidecarFieldsRegistry.test.js` checks it against the registry.

### Build-time — driver-facing adapter hooks (bounce, runner, and the maze's panel subset)

Optional hooks the sphere-growth driver and the Procgen Pipeline panel read, so the engine never names a substrate. Semantics are documented at the consumers, `procgenPipelineEngine.js` and `sphereConfigHooks.js`.

- **Zone generation:** `generateZoneForSpecs` / `generateZoneForSpecsGen`, `buildZoneSpecs`, `gateableItems` (`null` means every item).
- **Gate vetoes and hints:** `canHostExitGates`, `canHostExitGatesBraid`, `exitGateVeto`, `backPortalGated`, `hostsSurplusExitsNatively`, `gateHostingHint`.
- **Region contract:** `buildRegionContract`, used by the panel's Edit flow.
- **Panel parameters:** `defaultProcgenParams`, `prepareSphereGrowth`, `buildRegionParams`, `renderProcgenParams`; for a selected region library, `buildLibraryRegionParams` and `renderLibraryProcgenParams`. `procgenParamsFromPayload(payload)` recovers the params an existing payload records.
- **Placement vocabulary:** `driftItems` (items a driver may put on a surplus exit) and `libraryItems` (merged by the pipeline's `mergedItemLib`).

| slot | kind | declared by | consumer |
|---|---|---|---|
| `startingInventory` | data | bounce | `{needs: [{anyOf: [item…], reason}]}`: items a world needs at the start. Read by `startingInventoryNeeds` (`procgenCore/startingInventory.js`) for the APWorld editor's Starting inventory block. |

`renderRegionGenerationForm({substrateId, params, onChange, generic, seed})` in `procgenCore/regionGenerationForm.js` draws a region's settings for both the pipeline's Parameters section and the APWorld editor: generic rows (`REGION_GENERATION_FIELDS`), then the entry's `renderProcgenParams`. The editor starts from `bagFromPayload`.

## Capability matrix

Generated by `scripts/procgen/generate-procgen-reference.mjs`: one column per registered entry, one row per field an entry carries. Do not edit it by hand; check that it is current with:

```
node scripts/procgen/generate-procgen-reference.mjs --check
```

Rows are grouped by the [Entry contract](#entry-contract) heading that documents each field, so renaming a heading changes the table. The [reference page](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html#section-registry) shows full values.

In the running app, the **Substrate Registry** panel (`frontend/modules/substrateRegistryPanel/`) shows the live registry for the current mode and its drift from this snapshot, formatted by the same code (`frontend/modules/procgenDocs/registryShape.js`). It has three modes and opens in **Plain**, which draws the capability statements of `frontend/modules/procgenCore/substrateCapabilities.js` — one table per group, each cell ✓, ✗, ◐ (partly) or n/a with its degree, filled from the running app where a statement declares a live answer (a `getTypes()` item list). Those statements are the ones the user-facing chart [What each substrate can do](../../features/procgen-substrates.md) is generated from, so Plain is that page read against this app's registry. **Matrix** (one row per field, ✓/✗/a number per entry) and **Detail** (one block per entry, with the live `getPlaybackController()` answer) are one click away.

<!-- GENERATED:substrate-capability-matrix BEGIN — by scripts/procgen/generate-procgen-reference.mjs; do not edit; regenerate -->

**9 registered entries · 83 fields · 15 groups · 0 findings.** One column per entry the registry returns, one row per field an entry CARRIES — `substrateRegistry.getAll()` for the columns and `Object.keys(entry)` for the rows, so a field a substrate grows appears here without anybody editing a table.

Column order: `getAll()` returns the entries ordered by id, so the columns are the same in every boot and in the Substrate Registry panel; the order the generator imports the libraries in (the table at the end of this region) does not move them.

Cell values: a cell in the markdown region is SHORT: a function is `fn`, a boolean is yes/no, an array of at most 3 short values is the list and any longer one is its count, an object is its key set or its key count. The reference page prints the full value.

Groups are this document's own § headings, matched to a field by the section that documents it.

**Identity**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `id` | bounce | flash | flash_seedling | flash_seedling_gen | jta | maze | omsi | runner | text_adventure |
| `label` | Bounce Demo | Flash | Seedling (region atlas) | Seedling (generated room) | JtA | Maze | Idle Loops | Runner Demo | Text Adventure |

**Runtime**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `apExitNamesOf` | fn | fn | — | fn | fn | fn | fn | fn | fn |
| `apLocationNamesOf` | fn | fn | — | fn | fn | fn | fn | fn | fn |
| `deserializeWorld` | fn | fn | fn | fn | fn | fn | fn | fn | fn |
| `iframeId` | bounceDemo | flashSubstrate | — | — | jtaSubstrateWrapper | — | omsiSubstrateWrapper | runnerDemo | — |
| `loadRegionEvent` | bounce:loadRegion | flash:loadRegion | flashSeedling:loadRegion | flashSeedling:loadRegion | jta:loadRegion | maze:loadRegion | omsi:loadRegion | runner:loadRegion | textAdventure:loadRegion |
| `panelComponentType` | bounceDemoPanel | flashSubstratePanel | flashPanel | flashPanel | jtaSubstrateWrapperPanel | mazeRoomPanel | omsiSubstrateWrapperPanel | runnerDemoPanel | textAdventureSubstrateWrapperPanel |
| `serializeWorld` | fn | fn | fn | fn | fn | fn | fn | fn | fn |
| `sharing` | — | — | — | — | {items, mana} | {mana} | {items, mana} | — | {mana} |
| `sidecarFields` | 7 keys | 6 keys | 7 keys | 14 keys | 5 keys | 18 keys | 9 keys | 7 keys | {exitGates, exits, fogEnabled, locations} |
| `supportedFeatures` | arbitrary_ap_locations, bounce_abilities | arbitrary_ap_locations | arbitrary_ap_locations | arbitrary_ap_locations, seedling_items | 2 items | 7 items | 2 items | arbitrary_ap_locations, runner_abilities | 6 items |

**Playback**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `getPlaybackController` | fn | — | — | — | fn | fn | fn | fn | fn |

**Action labelling**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `describeAction` | — | — | — | — | fn | fn | fn | — | — |

**Composite map**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `compositeMap` | — | — | — | — | — | {drawRegion} | — | — | {drawRegion} |
| `compositeMap.drawRegion` | — | — | — | — | — | fn | — | — | fn |

**Loop mode**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `loopSupport` | 8 keys | {customQueues, manual, queueActions} | {customQueues, manual, queueActions} | {customQueues, manual, queueActions} | 8 keys | 6 keys | 8 keys | 8 keys | 6 keys |
| `loopSupport.customQueues` | no | no | no | no | no | yes | no | no | no |
| `loopSupport.executeVia` | solver | — | — | — | solver | — | solver | solver | — |
| `loopSupport.instant` | yes | — | — | — | yes | yes | yes | yes | yes |
| `loopSupport.manual` | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| `loopSupport.playback` | yes | — | — | — | yes | yes | yes | yes | yes |
| `loopSupport.queueActions` | regionMove, locationCheck | regionMove | regionMove | regionMove | regionMove | regionMove, locationCheck, explore | regionMove | regionMove, locationCheck | regionMove, locationCheck, explore |
| `loopSupport.record` | yes | — | — | — | yes | yes | yes | yes | yes |
| `loopSupport.requiresLoopMode` | — | — | — | — | yes | — | yes | — | — |
| `loopSupport.summaryRecording` | yes | — | — | — | — | — | — | yes | — |
| `takeLastRecording` | — | — | — | — | fn | fn | fn | — | — |

**Cross-substrate sharing**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `sharing.items` | — | — | — | — | {getTypes} | — | {types} | — | — |
| `sharing.mana` | — | — | — | — | {} | {loopActionDelegation} | {} | — | {} |
| `sharing.mana.loopActionDelegation` | — | — | — | — | — | yes | — | — | — |

**Editing**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `exitSides` | {keys, relabel} | — | {keys, relabel} | {keys, relabel} | {keys, relabel} | — | {keys, relabel} | {keys, relabel} | {keys, relabel} |
| `regionRoundTrip` | {open, save} | — | {refused} | — | — | {open, save} | — | — | {open, rules, save} |
| `roomEditor` | {kind, open} | — | {arm, kind, page} | {arm, kind, page} | — | {arm, kind, page} | — | — | — |

**Build-time — procedural substrates**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `applyContentModules` | — | — | — | — | — | fn | — | — | — |
| `extractPathsAndObstacles` | — | — | — | fn | — | fn | — | — | fn |
| `generateRegionCore` | — | — | — | fn | — | fn | — | — | fn |
| `placeFromItems` | — | — | — | fn | — | fn | — | — | fn |
| `placeFromRules` | — | — | — | fn | — | fn | — | — | fn |

**Build-time — content sources (zone-based substrates)**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `applyPipelineConfig` | — | — | fn | — | fn | — | fn | — | — |
| `emitsSpiralContent` | — | — | — | — | yes | — | — | — | — |
| `extractZoneRules` | fn | — | fn | — | fn | — | fn | fn | — |
| `getSpiralContent` | — | — | — | — | fn | — | — | — | — |
| `onContentEdit` | — | — | — | — | fn | — | — | — | — |
| `pipelineConfigFromParams` | — | — | fn | — | — | — | — | — | — |
| `pipelineConfigKeys` | — | — | atlasDoc, atlasId | — | 6 items | — | 5 items | — | — |
| `recordablePipelineConfig` | — | — | — | — | fn | — | fn | — | — |
| `rulesJsonBlocks` | — | — | fn | fn | — | — | — | — | — |
| `spiralContentConfigKey` | — | — | — | — | datasetDoc | — | — | — | — |
| `victoryItem` | Victory | — | — | — | Victory | — | Victory | Victory | — |
| `zoneConfigFromSlot` | — | — | fn | — | fn | — | — | — | — |
| `zoneCount` | 5 | — | 4 | — | 30 | — | 1 | 6 | — |
| `zoneOfPayload` | — | — | fn | — | fn | — | — | — | — |
| `zoneSourceLabel` | — | — | Atlas room | — | — | — | — | — | — |

**Build-time — region geometry**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `regionGeometry` | sides | — | sides | sides | sides | — | sides | sides | sides |

**Build-time — generation cost**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `generationCost` | — | — | — | — | — | — | — | heavy | — |

**Build-time — location capacity**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `locationCapacity` | — | — | — | — | — | {capacityAt, kind} | — | — | {kind} |

**Build-time — region library entries (capture / instantiate / validate)**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `captureLibraryEntry` | fn | — | — | — | — | fn | — | fn | — |
| `instantiateAtlasEntryForSpecs` | — | — | — | — | — | fn | — | — | — |
| `instantiateLibraryEntry` | fn | — | — | — | — | fn | — | fn | — |
| `instantiateLibraryEntryForSpecs` | fn | — | — | — | — | fn | — | fn | — |
| `libraryEntryRefusal` | fn | — | — | — | — | fn | — | — | — |
| `validateLibraryEntry` | fn | — | — | — | — | fn | — | fn | — |

**Build-time — driver-facing adapter hooks (bounce, runner, and the maze's panel subset)**

| Field | `bounce` | `flash` | `flash_seedling` | `flash_seedling_gen` | `jta` | `maze` | `omsi` | `runner` | `text_adventure` |
|---|---|---|---|---|---|---|---|---|---|
| `backPortalGated` | fn | — | fn | fn | — | — | — | fn | — |
| `buildLibraryRegionParams` | — | — | — | — | — | fn | — | — | — |
| `buildRegionContract` | fn | — | — | — | — | — | — | fn | — |
| `buildRegionParams` | fn | — | fn | fn | — | — | — | fn | — |
| `buildZoneSpecs` | fn | — | fn | — | — | — | — | fn | — |
| `canHostExitGates` | fn | — | fn | fn | — | — | — | fn | — |
| `canHostExitGatesBraid` | fn | — | — | — | — | — | — | — | — |
| `defaultProcgenParams` | 10 keys | — | — | 7 keys | — | 6 keys | — | 8 keys | — |
| `driftItems` | Left arrow, Right arrow | — | — | — | — | — | — | — | — |
| `exitGateVeto` | fn | — | fn | fn | — | — | — | fn | — |
| `gateHostingHint` | fn | — | — | — | — | — | — | fn | — |
| `gateableItems` | `null` | — | — | — | — | — | — | 5 items | — |
| `generateZoneForSpecs` | fn | — | fn | — | — | — | — | fn | — |
| `generateZoneForSpecsGen` | fn | — | — | — | — | — | — | fn | — |
| `hostsSurplusExitsNatively` | fn | — | — | — | — | — | — | fn | — |
| `libraryItems` | 7 keys | — | — | 3 keys | 48 keys | — | {Victory} | 6 keys | — |
| `prepareSphereGrowth` | fn | — | fn | — | — | — | — | — | — |
| `procgenParamsFromPayload` | fn | — | — | fn | — | — | — | fn | — |
| `renderLibraryProcgenParams` | — | — | — | — | — | fn | — | — | — |
| `renderProcgenParams` | fn | — | fn | fn | — | fn | — | fn | — |
| `startingInventory` | {needs} | — | — | — | — | — | — | — | — |

**Which library registered which entry** — entries self-register on library import, and this is the order the generator imports them in.

| Library | Registers | Loads headless |
|---|---|---|
| `frontend/modules/mazeRoom/mazeRoomLibrary.js` | `maze` | yes |
| `frontend/modules/bounceDemo/bounceDemoLibrary.js` | `bounce`, `flash` | yes |
| `frontend/modules/runnerDemo/runnerDemoLibrary.js` | `runner` | yes |
| `frontend/modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js` | `text_adventure` | yes |
| `frontend/modules/flashSubstrate/flashSubstrateLibrary.js` | — (nothing new) | yes |
| `frontend/modules/flashPanel/flashSeedlingLibrary.js` | `flash_seedling` | yes |
| `frontend/modules/flashPanel/flashSeedlingGenBuild.js` | `flash_seedling_gen` | yes |
| `frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js` | `jta` | yes |
| `frontend/modules/omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js` | `omsi` | yes |

<!-- GENERATED:substrate-capability-matrix END -->

### Hand-kept annotations

What the declarations mean, which the generated table cannot show.

| Substrate | What the declarations mean |
|---|---|
| `maze` | The playback controller is the live panel's own. Fine-grained, with its own per-tile live-play drain. Bot mode works by delegation, not `walkTo`. |
| `bounce` | The playback controller is a host-side proxy (`bounce:playbackControl`) to an in-game bot that plays real physics. Summary capture. |
| `runner` | Like bounce; its `zoneCount` comes from a lazily built zone table. |
| `text_adventure` | The playback controller is a host proxy to an iframe bridge (`textAdventureSubstrateWrapper:control`). Coarse capture. |
| `flash` | No `getPlaybackController`, so the Playback Bot cannot walk a Flash region; a per-game entry that gains a bot declares its own. |
| `flash_seedling` | No bot. Host-side glue turns the game's level changes into region moves ([Flash Substrate](./flash.md#flash_seedling--a-real-games-map-as-procgen-regions)). `zoneCount` counts placeable rooms (with at least one wired door), not all atlas regions. |
| `flash_seedling_gen` | Like `flash_seedling`, but its rooms are built by the Seedling generator; `flashSeedlingGenBuild.js` installs the generator hooks ([Flash Substrate](./flash.md#generated-rooms-flash_seedling_gen)). |
| `jta` | Fine-grained; the Bot honours Instant. Zones are indices into one game build, so it cannot go into a region library. |
| `omsi` | Fine-grained; the recording is the region's authored plan. Bot mode uses the omsi fork's planner; Instant runs the same ticks without waiting. `zoneCount` is the region-split or town count. |

## Adding a substrate

The minimum steps; the matrix above shows which optional groups existing entries declare.

1. **Write the entry** in a `<module>Library.js`, as `export const substrateRegistryEntry = Object.freeze({...})`: identity, `panelComponentType`, `loadRegionEvent`, `supportedFeatures`, `deserializeWorld`/`serializeWorld` (exits as a `Map`), `sidecarFields` (`check-sidecar-fields.mjs` fails the entries of a substrate that declares none), `apLocationNamesOf`/`apExitNamesOf` if the payload carries AP names, and any optional groups that apply. At the bottom of the file, register it behind a guard: `if (!substrateRegistry.has(substrateRegistryEntry.id)) substrateRegistry.register(substrateRegistryEntry);`.
2. **Register from the module** as well: the same guarded call in the module `index.js`'s `register()` hook.
3. **Wire the panel**: `registrationApi.registerPanelComponent(...)` for `panelComponentType`, and subscribe the panel to `loadRegionEvent` (see the [Module System](../guides/module-system.md) guide).
4. **Enable the module** in `frontend/module-configs/modules.json`, and in any other module config that should include it (`frontend/modes.json` maps launch modes to config files).
5. **Add it to the generator** if it should appear in the matrix: add the library to `REGISTRY_LIBRARIES` in `scripts/procgen/reference/registry.mjs` and regenerate.
6. If the substrate takes part in generation, implement the build-time group that fits: the procedural hooks for grown geometry, or the content-source group (`zoneCount` + `extractZoneRules`) for a fixed ordered pool. Then:
   - If exits are only sides, declare `regionGeometry: REGION_GEOMETRY.SIDES` on the entry itself, not as a factory default.
   - If the payload keys anything by exit side (a portal map, an arrow), declare `exitSides`; if nothing but the exit's own `side` is keyed by it, declare `SIDE_AGNOSTIC_EXIT_SIDES`. Without either, the APWorld editor and the pipeline cannot move an exit to another side.
   - If a region takes seconds to generate, declare `generationCost: 'heavy'` so CI skips its presets.
7. If regions should be playable in loop mode or by the playback bot, declare `loopSupport` and implement `getPlaybackController`.
8. If the substrate shares resources across substrates (loop-mode mana, cross-game items), declare `sharing` and use the `resourceChannels` helpers.

## Related documentation

- [Architecture](./architecture.md) — where the registry sits in the overall flow
- [Module System](../guides/module-system.md) — module registration and panels
- [Loop Recording and Block Modes](./loop-recording.md) — block modes, recording flows and the capture categories
- [Loops feature](../../features/loops.md) — what `loopSupport` enables from the user side
