# Flash Substrate

The flash substrates host recompiled Flash games (SWF → C → WASM via SWFRecomp-CC) as procgen regions. This page covers the generic iframe machinery (`flashSubstrate/`) and the two Seedling entries that play rooms of the real game in the flash panel: `flash_seedling` (a real room from the region atlas) and `flash_seedling_gen` (a generated room).

## The `__swfBridge` contract

The generic `flash` entry lives in `frontend/modules/flashSubstrate/`. It renders a same-origin iframe in `flashSubstratePanel` and ships a placeholder game page, so it can be tested without a real recompiled game.

The game page owns `window.__swfBridge.configure` and `pollItems`. The host injects `bridge.js` into the iframe after it loads, and the bridge:

| Job | How |
|---|---|
| Handshake | Completes the iframeAdapter handshake and announces `appReady`. |
| Configure and items | On the load event, calls `__swfBridge.configure` with the payload; pushes received items through `pollItems` then and on every state change. |
| Locations | When the game calls `__swfBridge.sendLocation(flashName)`, maps it through the payload's `ap_locations` and dispatches `user:locationCheck`. |
| Exits | When the game calls `__swfBridge.sendExit(portalId, side)`, resolves the exit from the payload and dispatches `user:regionMove`. |
| Gates | Evaluates the payload's `gate_rules` against the inventory and pushes booleans through `__swfBridge.setGateStates`. |
| Playback | With `playbackControlEvent` in the iframe URL, forwards bot targets to the optional `__swfBridge.botWalkTo`. |

The load event name comes from the iframe URL's `loadRegionEvent` parameter (default `flash:loadRegion`), so a substrate that reuses the bridge with its own panel ignores other substrates' loads.

## Per-game entries (one panel, many ids)

`createFlashSubstrateEntry` (`flashSubstrateLibrary.js`) is a factory. Each Flash game can register its own substrate id and `supportedFeatures`, while every entry built by the factory shares the `flashSubstratePanel` component and the `flash:loadRegion` event; the bridge keys its behaviour on the payload (`gameId`, `ap_locations`), not the id. The module itself registers only the generic `flash` entry.

The factory also supplies the exits-Map `serializeWorld`/`deserializeWorld` round trip and a null playback stub; [Bounce](./bounce.md) builds on it. The entry's `iframeId` closes an init race: procgenPlayer re-publishes the active region's load event when that iframe announces `appReady`.

By default a flash region is an opaque minigame: `arbitrary_ap_locations` only, no build-time hooks (the sidecar records `gameId` and params) and no playback controller. The entry contract is in the [Substrate Registry Reference](./substrate-registry.md).

## `flash_seedling` — a real game's map as procgen regions

`flash_seedling` (`frontend/modules/flashPanel/flashSeedlingLibrary.js`) makes a region a real Seedling room, marked out in a region atlas and compiled into `preset_sidecars` by `procgenPipeline/regionAtlasCompiler.js`. It is built on `createFlashSubstrateEntry` with two differences:

- **It renders in `flashPanel`,** with its own `flashSeedling:loadRegion` event. flashPanel's `WasmBridgeAdapter` already handles teleports, item writes, progressive items and location checks, and speaks the wasm shim's dialect (`game.configure(json)`, `queueItems`) rather than `__swfBridge`.
- **It has no `iframeId`.** The flash panel's plain `<iframe>` never announces `appReady`, so the glue queues an early arrival itself (below).

`flash_seedling_gen` shares the panel, the load event and most of the glue; it is described in [Generated rooms](#generated-rooms-flash_seedling_gen).

### The region binding: arrival, departure and park

`seedlingRegionBinding.js` is a pure state machine: region loads and game property reports go in, effects come out. `seedlingRegionGlue.js` applies the effects. `SeedlingRegionGlue.substrateIds` lists both Seedling entries as its own.

The binding reads BridgeGeneric state properties declared in `games/seedling.json` `state_properties`. BridgeGeneric reports a property only when its value changes, and reports in declaration order. The ones the binding uses, in order:

| Property | Meaning |
|---|---|
| `Main.playerPositionX`, `playerPositionY` | The last `new Game(level, x, y)` arguments (the spawn). |
| `Game.pendingExit` | `<seq>\|<from>\|<type>\|<x>\|<y>\|<to>`, written by `Teleporter.update()` before the world swaps: which door fired. |
| `Game.pendingCheck` | `<seq>\|<level>\|<tag>\|<0\|1>`, written inside `Game.setPersistence`: which persistence slot changed. |
| `Game.keyMask`, `Game.totemCount` | Boss keys and totem parts held, which do not touch persistence. |
| `Main.level` | The current level. |

The spawn and door reports are declared before `level`, so each arrives before the level change it explains. The `<seq>` prefix makes repeat fires distinct values. The set is fixed at boot: `BridgeGeneric.doConfigure` refuses a second configure for the life of a game instance.

Detection is level-granular: a region binds to a whole level (sub-regions share it), and a crossing is a `level` change, tie-broken on the spawn when two exits reach the same level (`resolveCrossingExit`). Negative levels are ignored (`-1` is the game's "no game" value while a level set mounts).

**Arrival.** A region load teleports the player into the region's level. The binding picks the door the player arrives at by trying, in order: the payload exit whose `exit_id` matches `arrivedFrom.exit_id`, then its `exitName`, then the exit whose `targetRegion` is `arrivedFrom.source_region`. With no match (the synthesized Menu → start hop, or a source outside the warehouse) the first declared exit stands in, logged as info. `arrivedFrom` is consumed host-side; the generic flash bridge drops it.

The player lands on the door's return spawn, not the door tile: the game does not draw the player on a teleporter, and a door fires only after the player steps off it (the `check()` latch). `seedlingReturnSpawns.returnSpawnTable(mapDoc)` gives each door the spawn of the nearest reverse link within `MAX_RETURN_DISTANCE_TILES`, read from the preset's `region_atlas.map_document`; a door with no entry lands on its `entrance_tile`.

**Departure.** An exit marked `external: true` leads to a region another substrate plays. On `pendingExit`, the binding matches the atlas exit id `out_<type>_<x>_<y>` (`seedlingAtlasDerivation.outExitId`), then the door's tile against `exit_tiles`, and a matched external exit publishes one `user:regionMove`. The level report cannot do this: by the time `Main.level` moves, which door fired is lost.

The game still swaps into the door's real destination; Seedling's only transition primitive is a one-way jump. That swap's `level` report is marked as already handled and swallowed. A world link out of Seedling is therefore authored `one_way: true`, with the return leg as a second link from the other side.

**The echo marks.** The glue's own teleports change `level` exactly as walking through a door does. Each arrival, departure and bounce arms a mark that swallows its matching report and expires after `ARRIVAL_ECHO_TIMEOUT_MS`; age is checked before level, so a stale mark cannot eat a later genuine crossing. A teleport to the current level arms nothing.

**First report.** BridgeGeneric reports every declared property at boot, so the first `level` report is where the game already is, not a crossing. It also signals that the game is alive, which releases an arrival queued while the wasm page waited for its ▶ Start gesture.

**Unmapped levels.** The starter atlas covers only a few levels by design. A level change the current region has no exit for warns on the console and the panel log and does not move the AP region: a silent no-op would read as a complete map.

**The park.** While another substrate owns the region the game keeps running (the flash panel has no `SubstrateInactiveOverlay`, since it also serves non-procgen presets). On `procgen:activeSubstrateChanged` the glue parks the binding: reports are dropped and in-flight marks cleared. An arrival published while parked is queued and released once. The default is active, so a preset that never broadcasts is unaffected.

**Focus and keyboard.** A `flashSeedling:loadRegion` publishes `ui:activatePanel` unless loops' `isFocusLocked` pins another panel. The game hears keys only while its canvas has focus (focusing the iframe lands on the frame's body), so `FlashPanelUI.focusGame()` focuses the canvas when the game starts, the panel is shown, a region loads, or the loading overlay closes.

A key held across a door would stay down in the game after another tab takes over, so `gameInput.createHeldKeyRelease` dispatches a synthetic `keyup` on the canvas for each held key on blur, on a `keyup` that missed the canvas, and when the glue parks (`releaseHeldKeys`).

### AP item placement

The randomizer does not write item flags into a running game; it puts AP's item in the room.

**The rewriter.** `seedlingDemo/apPlacementRewriter.js` takes the AP placement (`stateManager.getLocationItem`, injected) and the vanilla level set, and replaces the pickup at each randomized location with an `<apitem>` carrying `@tag` (the persistence slot that addresses the location) and `@look` (the graphic). Nothing else changes, so `region_coords` and the atlas's `map_ref`s still resolve.

`@look` is drawn from `LOOK_VOCABULARY`: the keys of `ITEM_FOR_TAG`, `bosskey0`…`bosskey4`, `seed`, and `ap` (the Archipelago logo, for another player's item or one with no Seedling graphic). Where several tags share an item (`Progressive Shield` is `shield` and `darkshield`), the destination's own vanilla graphic wins, else the first in table order.

`bosskey`, `totempart` and `seed` take no vanilla tag, so their address is allocated through `procgenSeedling.placementTagId`, the single allocator of that rule (a level has 30 persistence slots). The two encounter locations (the boss drop and the witch trade) are not rewritten; they stay on the adapter's property path.

A rewrite invalidates `location_coords` (each vanilla item tile now holds an `apitem`), so every rewritten set carries an `apMappingInvalidation` companion, and the delivery refuses a set without one.

**The delivery.** `flashPanel/seedlingLevelSetDelivery.js` sends the set with `botLoadLevels` per chunk and reads it back with `botLevelSet`. `seedlingRegionGlue` holds the first `flashSeedling:loadRegion` until the delivery finishes, because a region load teleports the player into a room and swapping the room afterwards would be a different game.

**The builds.** Wasm builds are pinned in `flashPanel/wasm/builds.json` (a submodule), each with a `role` and a mandatory `capabilities` list; the default and control builds both declare `apitem`. `Pickups/APItem.as` grants nothing and on collection calls `Game.setPersistence(tag, false)`, seen by the host as `pendingCheck`. Its sprites are re-embedded, because constructing a vanilla `Chest` to borrow one calls `Rng.cos()` and would shift the RNG stream bot tapes depend on.

**Warning:** on a build without `apitem`, an AP location shows nothing, because `Game.as`'s XML loop ignores unknown elements. The randomizer is wasm-only: real Flash's `seedling_injected.swf` has no `bot*` verbs, so `botLoadLevels` does not exist there.

**The check binding.** `flashPanel/seedlingCheckBinding.js` turns a `pendingCheck` report into `user:locationCheck` plus a "found X for Player Y" readout. It accepts only slots in the placement table, and only clears (fourth field `0`): `setPersistence` has many callers, some restore a slot to `true`, and locks clear slots like pickups do. The glue fans the adapter's single `onStateReport` hook out to both bindings.

The adapter stands down on the table's locations (`hostOwnedLocations()`); otherwise an echo would check a location twice and queue an undo that revokes the item. `seedlingRandomizerReadout.js` shows the session's finds beside the panel log.

The gate is `scripts/procgen/check-seedling-ap-placement.mjs`: it drives the default build (`SEEDLING_PAGE` overrides) once with the rewritten set and once with the vanilla set, and requires the difference of the two `botMobiles` rosters to be exactly the rewritten entities swapped for `APItem`s at the same tiles.

### Deciding whether the randomizer applies

There is no setting or flag: the decision comes from data. When the bridge comes up, `flashPanel/seedlingRandomizerEligibility.js` runs its checks in order (`ELIGIBILITY_CHECK_IDS`) and names the first that fails. Two checks divert to another arm (`DIVERTING_CHECK_IDS`, arms `RANDOMIZER_ARMS`).

1. **`transport`** — the transport is wasm and the preset names a page. Under real Flash this is one "wasm-only" log line.
2. **`capability`** — the preset's build declares `apitem`. The panel fetches `wasm/builds.json` and finds the entry named after the page's directory (`buildNameFromWasmPath`). `capabilities: []` means none; a missing field reads as unknown. The vocabulary is `WASM_BUILD_CAPABILITIES`, imported by `check-seedling-wasm-pins.mjs`.
3. **`generated`** — the rules carry generated rooms (`seedlingGenRoomPayload.generatedRoomCensus`). If so, the verdict is the `generated` arm. A world with both generated and real rooms is refused, since the game mounts one level set at a time.
4. **`atlas`** — the rules carry `flash_seedling` rooms and zero goal-ledger locations resolve. If so, the verdict is the `atlas` arm. It stays undecided until that count exists.
5. **`placement`** — at least one goal-ledger location resolves against the loaded placement; the count is reported either way.
6. **`assets`** — the vanilla record set and the room map are reachable. The map is the preset's `region_atlas.map_document` when named, else the atlases default. `region_atlas` is not in the panel's static data, so it is read from `getLastRawJsonData()`.

Check 5 joins by AP id, because presets name locations differently (the stage-1 `seedling` preset uses the upstream APWorld's names). The wiring derives each ledger row's `flash_name` from data and joins row → `flash_name` → `ap_id_offset + ap_locations[k].id` → loaded location. A row that does not resolve is reported and filtered out rather than refusing the preset; it keeps the property path.

### Loading a placement

The load sequence is: loading overlay on → `setDelivery` on the glue → `deliver()` → reset to the set's start → `setCheckBinding` → overlay off. A refusal shows why and neither resets nor binds, so a vanilla room keeps the property path. `runSeedlingRandomizerLoad` runs this for every arm; an arm with no delivery binds at once.

- **Progress is by phase**, because `deliver()` is one synchronous loop the browser cannot paint inside.
- **The set decides the reset.** A start with a position teleports with `new Game(level, x, y)`. A start with only a level (the vanilla set's `{"level": 0}`) takes the game's own new-game path, which is the only thing that knows the spawn.
- **The boot position is reported with its source.** The wiring reads the binding's `lastSpawn`/`lastLevel` without writing binding state; when the binding has seen nothing it falls back to the roster position less half a tile, and logs which source it used.
- **A world swap is confirmed by a roster.** `Main.level` and the spawn are written by `Game`'s constructor before `Engine.checkWorld()` swaps, so the load polls for the expected level and a `botMobiles()` roster with a named timeout, never a sleep.

**Warning:** the randomizer's heavy modules load through a computed specifier built against `document.baseURI`. The bundler (esbuild, `splitting: false`) inlines any literal `import('…')`, and `import.meta.url` would resolve to `dist/` in the bundled build.

### The atlas arm

A world built from real atlas rooms names each location by its atlas region (`Starting House - Chest`), which the goal ledger does not know. The `atlas` arm binds those locations where they stand, without rewriting the room.

`seedlingDemo/seedlingAtlasCheckTable.js` (pure) maps each compiled location → the atlas location of that name → the entity on its tile that grants its vanilla item → `levelWorld.tagOf` → `placementKey(level, tag)` → `{location, item, player}`. `loadSeedlingAtlas` fetches the atlas (through `atlas_files.json`) and hands the table to the same `SeedlingCheckBinding`.

A location the player could never check is refused by name in the panel log; the rest still binds:

| Refused | Why |
|---|---|
| Untagged entity (`bosskey`, `totempart`, `seed`) | Nothing reports its collection — unless the build declares `tag` (below). |
| Entity the property path reports (`hasSword`, …) | Collecting it would check twice, and the property path's undo would take the item back. |
| Tile with no single granting entity | The two encounters. |

On a build declaring `tag`, the three untagged classes read an optional `@tag` (`Game.optionalTag`; absent is `-1`) and collection writes `Game.setPersistence(tag, false)`. `loadSeedlingAtlas` then hands the table `allocateTag` (`placementTagId`) and `optionalTagTypes` (`levelWorld.PICKUP_CLEARS_OPTIONAL_TAG`): such a location is bound at an allocated tag and listed in `retags`, and the arm delivers the vanilla set with those tags written (`apPlacementRewriter.retagRecordSet`). Without retags there is no delivery.

Opening the chest in `seedling_atlas_location` sends one `user:locationCheck` for `Starting House - Chest` and logs "found key_blue for you". The game's chest still hands its vanilla item in-game, and no property reports it, so no second check fires.

### As a content source in the pipeline

The entry is also a zone content source ([Substrate Registry § Build-time — content sources](./substrate-registry.md#build-time--content-sources-zone-based-substrates)), so the shuffled spiral can place a real Seedling room beside generated rooms: `substrateQuotas: {maze: 3, flash_seedling: 1}` builds a world whose `flash_seedling` region plays the real level.

- **The pool is one compile.** `applyPipelineConfig({atlasDoc})` installs an atlas (default `atlases/seedling.json`); the pool is its `compileRegionAtlas` output, one entry per AP region.
- **Only rooms with a wired door are placeable**, because a placed room is entered through a door. `zoneCount` counts them in compile order and `zoneNames` lists them.
- **Doors bind to sides by order** (`bindDoorsToSides`). A Seedling door has no side, so the k-th side the driver asks for takes the k-th door. The door keeps its atlas `exit_id`, `exitName` carries the engine's `exit_<side>`, and a surplus door is left out with a `pruned_exit` note (surfaced on `stats.contentNotes`); it stays in the level and fires the game's own transition. A cell needing more sides than the room has doors is refused by name.
- **Every bound door is `external`**, with `target_level` and `target_spawn` null. The null keeps a door out of `resolveCrossingExit`'s level match, since its far side is whatever the grid put there. `target_substrate` is resolved after stitching through `serializeWorld`'s context argument (`substrateOfRegion`); no consumer reads it. The field is present-or-absent, never `external: false`, so committed sidecars without crossings do not move.
- **Top-level blocks.** Such a world carries the compile's `region_atlas` and `flash_panel` (`rulesJsonBlocks()`); the flash panel engages on `flash_panel`.

A placed room's unbound doors warn and move nothing. The spiral links no reverse exits, so both sides resolve the door by `source_region`: the maze lands the player on its exit back to the room ([Maze Substrate § Panel and runtime](./maze.md#panel-and-runtime)), and the binding picks the door leading to the maze region.

The same atlas also compiles to `seedling_atlas_maze`, playable without wasm ([Maze Substrate](./maze.md#a-real-games-map-as-maze-regions)). An atlas region may name its own `substrate`, so one preset can mix flash and maze rooms (still one sidecar per AP region).

### The atlas knob and the swim census

The bag key `seedlingAtlasId` (`SEEDLING_ATLAS_ID_KEY`) names the atlas the rooms come from, by the `atlas_id` `atlases/atlas_files.json` serves it under; absent means the starter, so no committed preset moves. The installable atlases are the bundled ones (`SEEDLING_INSTALLABLE_ATLASES`: the starter and the 113-level playthrough, both static JSON imports, because the install seams are synchronous and the preset producer has no fetch); any other id is refused by name. Sphere growth installs it in `prepareSphereGrowth`, before the tree's gate veto reads the atlas; the shuffled spiral carries it as `substrateConfig.flash_seedling.atlasId` (`pipelineConfigFromParams`, merged by `presetRun.buildSpiralRun`) into `applyPipelineConfig`; top-down and the APWorld hub's initialise carry it on the zone specs (`buildZoneSpecs`). The panel draws it as an *Atlas* picker (`renderProcgenParams`). `flashPanel/flashSeedlingAtlasKnob.test.js` builds both drivers' worlds from the picker's bag.

Installing the playthrough does **not** make its internal exits pipeline doors. A placed room is one sub-region; its doors are the level's teleporters, and a crossing between sub-regions of one level (a swim, a waterfall climb, a key gate) stays geometry inside the room, carried by no bound door and no location rule. `scripts/procgen/census-seedling-atlas-doors.mjs` (report-only, `--atlas=`, `--json=`) lists every internal exit by rule and by level, flags each `Progressive Swim` level BOT-UNCERTIFIED unless a committed tape boots there with water armed and a swim tag granted, and counts the swim rules the content source carries (0 on the playthrough). `scripts/procgen/seedlingAtlasDoorCensus.test.js` pins its counts. A key gate is one-way since swim T4: a bosslock opens only from its south side (`BossLock.as:62`), so the playthrough rules cross each one south to north only. `census-seedling-bosslocks.mjs` checks all 14 against the committed atlas (11 agree, 2 separate nothing, and L66's off-grid lock claims no whole tile).

### As a sphere-growth leaf

The entry has the sphere zone realiser `generateZoneForSpecs`, so sphere growth can grow a world around a real room ([Sphere Growth § Seedling as a leaf or a host](./sphere-growth.md#seedling-as-a-leaf-or-a-host-flash_seedling)).

- **Room choice.** `generateZoneForSpecs` takes one exit side per door and picks the tightest room no other region holds with enough doors (`chooseSphereRoom`), binding one door per side. `prepareSphereGrowth` clears the placed rooms once per generation.
- **Locations keep their compiled names** (`Starting House - Chest`) through a `global_name`. A 0-item filler takes a room with no location; a node asking for more items than any room holds is refused.
- **The door is paired.** Sphere growth links reverse exits (`insertBackExit`), so an arrival reaches the binding with `arrivedFrom.exit_id` equal to the door's `exitName`, and a departure reaches the maze with the forward exit's own id.
- **Leaf or host.** By default a real room hosts children behind gated doors (below). A state sets `seedlingAtlasHostChildren: false` (read as `regionParams.seedlingAtlas.hostChildren` by `exitGateVeto` and `backPortalGated`) to keep it a leaf; `SEEDLING_SPHERE_ROOM_STATE` does.

When a real room hosts, each side's requirement compiles to rule-lock obstacles (`clear_set_type: 'rule'`, id `seedling_door_lock_<item>`), so the exit rule equals the tree's gate. `canHostExitGates(existing)` asks whether the atlas has a room with a door for one more gate. The host enforces the gate at play time ([Host-enforced door gates](#host-enforced-door-gates)); a refused door's one-frame swap into its real `@to` level is swallowed.

### As the APWorld Editor's atlas-room source

The entry's `zoneConfigFromSlot` and `zoneOfPayload` let the APWorld hub's `replace-region-content` put another real room of the same atlas into a region, without a pipeline run ([APWorld Editor](../../modules/apworldEditor.md)).

- **Which atlas.** A rules.json names its atlas by `region_atlas.atlas_id` (`map_document` is the level map, not an atlas). Any atlas but the bundled starter is resolved through `atlases/atlas_files.json` (`mapDocumentPath.atlasPathInIndex`) and fetched in the generation worker.
- **Which room.** `zoneOfPayload` matches `atlas_region` + `atlas_sub_region`; the picker disables rooms in use and doorless rooms, with the reason.
- **Doors and items.** The k-th door binds to the region's k-th existing exit. `extractZoneRules` takes optional `locationSpecs` (`[{name, item}]`), so AP's fill owns the items and the room owns the geometry.
- **What round-trips.** Content-source documents (e.g. `seedling_spiral_room`, `seedling_atlas_location`) take their own room back byte-identically. The compiler's projections (`seedling_atlas`, `seedling_playthrough`) are refused: their exits are level transitions, not doors bound to sides. The lab's edit arm is refused (`regionRoundTrip.refused`): a payload is an atlas reference, not a room record.

## Generated rooms (`flash_seedling_gen`)

`flash_seedling_gen` (`flashPanel/flashSeedlingGenLibrary.js`) asks the Seedling generator for a new room built to the pipeline's spec: its size, one door per exit, and the AP locations it must hold. The level set is assembled from the sidecars at play time and delivered to the game.

### The entry

- **A second entry, not a mode.** The engine picks a realiser by hook precedence: `generateRegionCore` shadows `generateZoneForSpecs`, so one entry with both would stop placing real rooms. The two entries share the flash panel, the `flashSeedling:loadRegion` event and the `flash_panel` block.
- **Procedural, with sides geometry.** The entry has the full procedural hook set (`generateRegionCore`, `placeFromItems`, `placeFromRules`, …) with `SIDES` geometry, so it serves every driver with no four-side limit.
- **`libraryItems`: the gate items, derived.** The entry declares one progression item per distinct AP name in `seedlingDemo/itemLabels.js`'s `ITEM_LABELS` (`Progressive Sword`, `Progressive Shield`, `Progressive Swim`; the feather is `Progressive Swim` ×2, no fourth row) — the items a generated room can gate on physically, so a shipped world may name them in its scenario and the slow tier's "unknown scenario item" row can tell a declared gate item from a typo (`seedling_generated_swim` names `Progressive Swim`; CI read that row red once, at `17c1c999f5`). The table lives in a leaf with no imports so the light entry never pulls the solver's closure; `procgenRequirements.js` re-exports it.
- **The generator is installed lazily.** The build hooks delegate to `seedlingDemo/seedlingGenRoom.js` (which pulls in the large `procgenSeedling.js`) through `installSeedlingGenRoom`. Headless callers import `flashPanel/flashSeedlingGenBuild.js`; the app's `register()` calls `loadSeedlingGenerator`, a computed-specifier import. A hook called before either is refused, saying to wait or reload. The play-time half is `seedlingGenRoomPayload.js`, which imports nothing heavy.
- **Blocks.** `rulesJsonBlocks()` answers `flash_panel` only (`seedlingFlashPanelBlock()`); a generated world has no map, so no `region_atlas`. A world with both Seedling entries would ask for `flash_panel` twice, and `buildRulesJson` refuses that.
- **Knobs.** `renderProcgenParams` draws the generator's knobs in the pipeline panel and in the APWorld editor's region form (read back with `procgenParamsFromPayload`). Every driver passes them through `buildRegionParams`.

### Declarations (G9)

- **`generationCost: 'light'`**, declared explicitly. A room costs 0.1–1.5 s at 10×10, and the committed generated presets build in 0.3–0.7 s, so its presets stay in CI's slow battery.
- **`locationCapacity`: tiles, with a ceiling** (`seedlingDemo/seedlingGenCapacity.js`). The floor bound is the room's interior less the start and the doors, which growth lifts. The ceiling is **30 locations**, the game's 30 persistence tags, one per location's pickup. No size adds tags. Location 0 takes the goal's own tag, so the ceiling is 30, not 29. The Initialise preview refuses a slot past it by name before building, for example *"flash_seedling_gen: at most 30 locations per room (the game's 30 persistence tags) — 'Act 2' lists 52"*, and the engine refuses such a room before its core runs.
- **The ceiling is the certain bound, not the worst case.** A room's own elements spend tags too: a guard 3, a kill, rock or shield gate 1. The biome-default element list places a guard in about 1 pre-sword draw in 60. A draw that leaves too few tags is re-rolled like one short of cells, so every draw seed seats 30 at the defaults. The slow census, drawn seeds 1–60 in pre-sword and post-sword, seats 30 at every seed and refuses 31 at every seed (re-run green after swim U8's fold, which put the tag-spending `arena`, `rockgate` and `corridorbody` in the post-sword list).
- **`procgenParamsFromPayload({})` answers `{}`**: a payload without `generation` is not a generated room, so no default is invented. A built payload reads every knob back. The APWorld S2 read-back row names its knob from the empty-payload answer, so it skips this entry. Making the entry eligible was measured and not done: with the biome moved to `post-sword` by the row's control, an Initialise of the row's Adventure document is refused by the generator (`Overworld` at 8×6).

### The element defaults by biome (swim U8, ⚖ Q13)

A room whose `elements` knob is empty (`''`, the default) draws its element from its biome's default list, `procgenSeedling.defaultElementsFor(items)`. Since swim U8 that list holds every head the biome's boot lets certify. The heads shipped opt-in after arc 5 joined it by the item that admits them (`BIOME_DEFAULT_FOLD`):

| Biome | Default element list |
|---|---|
| `pre-sword` (the knob's default) | `guard;len=2\|3\|4+blockpocket+chamber;w=2;h=3` (unchanged) |
| `post-sword` | the above with `killgate` second, then `+arena;w=2;h=3+rockgate+shortcut+roam+corridorbody` |
| `post-shield` | post-sword's `+shieldgate` |
| `post-swim` | post-shield's `+watergate+watershortcut` |
| `post-feather` | post-swim's `+waterfallgate` (all 13 heads) |

- **One draw, uniform, decided by the seed.** The list is a choice, not a conjunction: one `rng.pick`, equal over its members. The pick is made before the room is built, so every kind and size at one seed draws the same head. A head that cannot place in the room is a graded drop, and the level ships element-less.
- **Named parameters.** `arena` carries the chamber's `w=2;h=3` (post-sword: 47 placed, 25 certified, against 25 and 12 bare). `roam` stays bare (its `w=2;h=3` measured 11 placed, 2 certified).
- **Draw, not `require`.** `corridorbody`, `shortcut` and `watershortcut` can be drawn but never satisfy a `require` directive (⚖ Q29; their grade is SHORTENS).
- **No committed generated room moved.** `seedling_generated_room`, `_leaf` and `_host` build on the default biome, `pre-sword`, whose list did not change, and `seedling_generated_swim` names `watergate`. All four are byte-identical.
- **The yield, measured** (`sweep-yield-table.mjs --substrate=seedling` with no `--elements=`, F1b's 7 kinds × 10x10/14x14 × seeds 1–12, placed/certified of 168):

  | Biome | Before the fold | After |
  |---|---|---|
  | `pre-sword` | 80 / 70 | 80 / 70 (byte-identical) |
  | `post-sword` | 95 / 64 | 106 / 85 |
  | `post-shield` | 95 / 64 | 104 / 82 |
  | `post-swim` | 95 / 64 | 54 / 50 |
  | `post-feather` | 95 / 64 | 66 / 58 |

  The 12 seeds are 12 draws per biome, so these numbers depend on which heads the seeds landed on. In `post-swim`, three seeds drew `arena`, one drew `roam` and none drew `watergate`. Read them as one 12-draw sample, not as a rate. The per-head yields are in the swim reports. `roam` placed 0 of 14 cells in every sword biome here (10 of 168 on its own sweep). `waterfallgate` placed 0 of 14 in `post-feather`: the default skeleton seats no fall (open, R-m).

### The payload

The sidecar payload is `{gameId: 'seedling', generated: true, seed, size, record, start, goal_cell, generation, locations, level, tile_size: 16, exits, exitGates}`.

| Field | Content |
|---|---|
| `seed` | The seed used: drawn from the engine rng (never 0, which Seedling refuses), or the re-rolled seed. |
| `size` | The final size; always the record's own width and height. |
| `record` | The generator's core record for `seed`, with no door entity and no `apitem` (the assembler adds both). |
| `generation` | The knobs (biome `pre-sword`/`post-sword`/`post-shield`/`post-swim`/`post-feather`, obstacle target, tries, skeleton, elements, areas, fill, optional `require`), plus `rerolls`, `rerollCause` and `grownFrom` when non-zero. |
| `locations` | Each AP location's cell and allocated `tag` (`placementTagId`). |
| `level` | The room's index among the world's `flash_seedling_gen` regions in sidecar order (`ordinalOfRegion`, passed to every serializer). |
| `exits` | Each door: `exit_id` spelled `out_teleporter_<px>_<py>` (the binding's departure spelling), `exitName` (the AP exit name), `entrance_spawn` (the approach cell, in pixels). |
| `exitGates` | The rule `placeFromRules` gave each core exit, keyed by AP exit name; a record only (the host reads gates from static data). |

### Door and approach rules

Doors are minted by the level linker's rule, `levelSetExits.pickDoorCells`: one flood from the start with every solid live, farthest first, never next to another door, never on the start. The k-th exit takes the k-th door. Generated rooms add two rules through the opt-in `keepReachable`:

- **No door may seal an approach.** With every door cell a wall, the start must still reach every door's approach cell and the goal; the generator's own solver re-certifies the goal with the doors as walls.
- **No door, approach or location on a hazard.** Water, lava and pits (`seedlingGenRoom.hazardCells`) are not solid but kill or respawn the player.
- **The hazard set is boot-aware (swim T1).** `hazardCells(record, items)` leaves water out when the biome's items grant `canSwim` and lava when they grant `hasDarkSuit`; pits always count. The seal floods read it with the room's biome items (`GEN_ROOM_BIOMES[biome].items`): the door picker's kept goal, `safeReach` and `bindAllDoors`. A door, its approach and a location still never stand on a lethal cell. A door's approach must also be reached from the start without crossing one (`pickDoorCells`' `keepReachable.approachWalls`, via `pickGenRoomDoors`), because an arrival lands with whatever the player holds, not with the biome's boot. `post-feather` (swim T4) is `post-swim` plus the feather, so it reads the swim set too; no other biome grants either item, so every other room reads the set it always read. ⚠ A waterfall is not lethal, and `approachWalls` is a set of cells, so it cannot say "not UP this tile": a `post-feather` `waterfallgate` room can seat its door past the fall. In `winding` 10×10, seeds 1–12 with `require: hasFeather`, that happened in 4 of the 8 met rooms (`seedlingGenRoomFeather.test.js` pins seed 9).

The `post-swim` biome adds `Progressive Swim` (the conch, `canSwim`) to the boot, making water the third physical gate after the sword and the shield. Its `watergate` builds in a generated room at re-roll 0, with `require: canSwim` met. Before the boot-aware set it re-rolled through every size. S1 measured 83 re-rolls and growth to 28×28. T1's W0 draw took 173 re-rolls and 37 minutes, growing to 48×48.

`entrance_spawn` is the flood cell the door was reached from, never the door tile, for the same `check()` latch reason as real rooms. The first location stands on the generator's goal cell; the rest take the cells nearest the start that are safely reachable, never on the start, a door or a door's neighbour.

An exit the engine adds after the core ran (a sphere back exit, grid links) gets its door at serialize time from the same picker.

### Re-roll and growth

A room that cannot meet the rules is drawn again rather than refused. There are four causes (`GEN_ROOM_REROLL_CAUSES`):

| Cause | Where it runs |
|---|---|
| `doors` — the core cannot seat its own doors | In the core. |
| `engine-added door` — no door fits an exit added after the core | `serializeGenRoom`: first the room as built (`bindAllDoors`), then a re-roll over the final exit list. The serializer is pure. |
| `locations` — the safe reach cannot seat the requested locations, or (G9) the draw's own elements leave too few of the 30 persistence tags | `addLocations`, called by `placeGenItems` and `placeGenRules`; the room is regenerated in place so the engine's world and exit objects keep their identity. |
| `require` — the draw missed the room's `require` directive | In the core; the per-size budget only, no growth. |

`seedlingGenRoom.rerollGenRoom` continues the room's own sequence, `rerollSeed(drawnSeed, k)`, up to `GEN_ROOM_DOOR_REROLLS` per size. No engine rng is used, so no other region moves. A re-roll moves cells, tags, seed and record, never an exit's or location's name, target, item or rule, so the rules.json outside the sidecars is unchanged.

After the budget at a size, the room grows by `GEN_ROOM_GROW_STEP` tiles on each side, capped at `GEN_ROOM_MAX_SIDE` (`procgenLevel.ROOM_TILES_MAX`), and the budget runs again. Attempt `a` uses `sizeOfAttempt(origin, a)` and seed `rerollSeed(drawn, a)`, so the first attempts are unchanged by growth. `generation.grownFrom` records the requested size. Nothing outside the room reads its size (sides geometry), so a grown room moves nothing else.

A room no size seats is refused with a sentence naming the cause, every size tried, and what to lower (`maxItemsPerRegion`, the quota, or the exits). A room asked for more than 30 locations is refused at once (`tagBudget`), never re-rolled or grown, because no size adds a persistence tag. A size that cannot hold the demand (`roomCanHold`) is skipped without a draw. A placer never returns short, so the engine's retry-then-grow loop (which would consume fresh rng) is never entered. **Note:** generating a large room takes seconds or more.

### Delivery and play

The level set of a generated world is not stored; it is rebuilt from the rules.json each time the game starts. `seedlingDemo/seedlingGeneratedSet.js`'s `assembleGeneratedSeedlingSet(rules, {locationItemOf, selfPlayer})` is pure. Room i is level i. Each door becomes a teleporter: to another generated room it arrives on the paired door's approach; to another substrate it leads to the parking room. Each location becomes an `apitem`. The set is built with `buildLevelSet(…, {link: false})`, validated, stamped `seedling-gen-<seed>-<content hash>` and given its `apMappingInvalidation`.

The parking room is level N, after the generated rooms: a walled 3×3 room with no exit. A door out to another substrate swaps the game there, the swap is swallowed (`pendingDeparture`), and the game waits while the other substrate plays.

`flashPanelUI._startSeedlingRandomizer` picks the arm. The generated arm, `seedlingRandomizerWiring.loadSeedlingGenerated`, fetches no map and loads the assembler through a computed specifier (`AP_GENERATED_MODULE_PATHS`); the load sequence is the same as the vanilla arm's.

**Note:** on the first entry the reset re-lands the player on the approach and hides a wrong arrival; only a second entry tests the binding's arrival alone.

### The JS runtime (`runtime: 'js'`)

`moduleSettings.flashPanel.runtime` picks the page the flash panel mounts: `auto` (the default: the wasm page when the preset wires one, real Flash otherwise), `flash`, `wasm`, or `js`. With `js` and a Seedling preset (`flash_panel.config` is `seedling.json`), the panel mounts `seedlingDemo/jsRuntime.html` instead of the wasm build. The page plays the JavaScript model (`createManualSession` over `levelRun`) and draws it in rectangles with the watch page's palette (`seedlingDemo/rectPalette.js`), with no sound. Changing the setting re-initializes the panel. Any other game ignores `js` and uses `auto`.

The page speaks the wasm page's contract, so the host glue is unchanged: `window.__swfBridge` with `game.configure`, `readState`, `wireCheck`, `botStatus`, `botMobiles`, `botLoadLevels` and `botLevelSet`, plus `queueItems` and `onStateChanged`, and `__runtimeReady`. There is no ▶ Start; both readiness questions (`wasmGamePage.js`) answer at once. The contract lives in `seedlingDemo/jsRuntimeCore.js`, which has no DOM and runs in node; `jsRuntimePage.js` adds the canvas, the keyboard (`watchManual.KEYBOARD_BINDINGS`) and a 30-tick requestAnimationFrame accumulator, with a timer pump while the frame gets no animation frames.

How each wasm-side fact maps onto the model:

| Wasm page | JS runtime |
|---|---|
| BridgeGeneric reports a declared property when it changes, in declaration order; the first burst comes on the frame after `configure` | `flush()` after every tick compares each configured `state_properties` entry with its last report. `configure` itself flushes nothing: the host attaches the adapter only after `configure` returns, so a burst sent inside it was dropped and the region binding never saw its baseline |
| `Main.playerPositionX/Y` are the `new Game` constructor args | `run.worldCtor` |
| `APItem` collected → `pendingCheck` `<seq>\|<level>\|<tag>\|0` | The page tests the player's box against the `apitem` row's `apItem` box (`levelWorld.ENTITY_CLASSES`) on the position the previous tick left, and writes the same string |
| Every other `Game.setPersistence(tag, false)` (a chest opened, a lock turned off, a tagged pickup taken) → the same `pendingCheck` | Each slot the run newly clears in its four clear ledgers (`earnedClears`, `bankedClears`, `appliedTimedClears`, out-of-band `spinnerWrites`) is reported once, each as its own report. The game's restoring writes (`\|1`) have no ledger here; the check binding drops them anyway |
| `Teleporter.update()` → `pendingExit` `<seq>\|<from>\|<exitType>\|<x>\|<y>\|<to>`, `exitType` `teleporter` or a `Stairs`'s `stairsup`/`stairsdown` | A new `run.transitions` entry, joined to the teleporter the player stood in; the type is the room's own link entity on that spot. A pit fall through a `control` block writes nothing, as in the game |
| `queueItems`: flag writes, `menu`, `new_instance Game(level, x, y)` | Drained once per tick; a changed flag re-boots the run where the player stands (the run's inventory is fixed at boot), and the teleport boots a fresh run at the args |
| `botLoadLevels` chunks, `botLevelSet` readback | `pending` per chunk and `ok` on the last; the readback carries `active`, `table_levels`, `start_level` (and `vanilla`, the size of the vanilla map) |
| The game's own tables (the 116 levels) and its first frame, `new Game(0, 80, 128)` (`Main.as:51`) | The page fetches the map document (`flashPanel/atlases/seedling-map.json`) and hands it to the core (`setVanilla`). With no set delivered it boots the first frame (`tapeFormat.BUILD_SPAWN`), whose level-0 report is the region binding's baseline. A teleport that arrives before the map is held and replayed. A delivered set takes precedence |
| Items the player picks up in a real room (`Main.hasSword` …) | `Main.*` reports the host's flag or the run's live inventory; a re-boot folds what the run gained into the flags first |

**Death.** The model dies the game's way: a pit in a room with no `control` block, drowning (water without the conch, lava without the dark suit) and a hit at max health all go through `die()` and the game's restart inside the run, so the page respawns nothing. It reads the run's own `playerDeaths` and reports each death to the status line and the walker. A pit with a `control` block is a transition, not a death. Any refusal the model still throws halts the page by name.

**Eligibility.** The JS page is not a build in `builds.json`, so `seedlingRandomizerEligibility` takes `transport: 'js'` and answers the capability check from `JS_RUNTIME_CAPABILITIES` (`apitem`). The JS runtime plays two arms (`JS_RUNTIME_ARMS`): the generated arm and the atlas arm. On `js` the cheap call is also told the rules' real rooms, and while the atlas question is open (real rooms, the ledger not yet resolved) the verdict stays `undecided`. A world that is neither, which means the vanilla arm's whole rewritten 116-room set, is refused by name. `loadSeedlingRandomizer` takes the panel's `transport`. `JS_RUNTIME_CAPABILITIES` has no `tag`, so an atlas location that needs a tag allocated is refused by name, as on a wasm build without it. The wasm transport's answers are unchanged.

#### Real atlas rooms on the JS runtime (slice J3)

The atlas arm delivers nothing (the rooms are the vanilla levels), so the JS page runs its vanilla map, as the wasm game runs its own tables. The binding, the check binding and the door gate are unchanged and read the same reports:

- **Arrival.** The page's first frame (level 0) is the binding's baseline, which releases the region's arrival teleport (`new_instance Game(level, x, y)` at the door's return spawn). The run boots that level at those constructor args.
- **Checks.** The starting house's chest in `seedling_atlas_location` reports `pendingCheck "<seq>|86|0|0"`, the address the atlas check table binds to *Starting House - Chest*. Any persistence clear the model computes is reported the same way, and the check binding decides which ones are locations.
- **Crossings.** A door or stairs reports `pendingExit` with its own type before the level move. The binding resolves a move between atlas regions from the level change, as on wasm, and a door marked `external` from the `pendingExit`. Crossings are level-granular on both runtimes: a boundary cell with no teleporter on it is not a crossing.
- **Halts.** A real level the model refuses halts the page by name, at boot or mid-play (L112: the Owl fight needs `rng.split`; L40 boots since swim R4 modelled its IceTurret, so no committed level refuses at boot today). `botStatus.halted` carries the refusal, and a later teleport to a room the model runs recovers the page. The HALT roster (600 idle + 400 random-key ticks per level) was measured before J3 and re-measured at S3; both are in the plan's as-builts. Since S3 it is 22 census rows over 14 levels (31 before J3): kill locks no longer halt, and the WallFlyer and two-teleporter rows cleared with the swim arc's R2.
- **Clears carry.** What a run cleared (a chest opened, a kill lock opened) is carried into the next boot, so a revisited room finds it gone, as the game's persistence array does.
- **Scratch persistence (solver-walk S3, ⚖ Q4).** Every room boots with `scratchPersistence`, the vanilla rooms as well as a generated set. The page's run has no tape behind it, so no tape owns a kill lock's slot, and the model writes the clear itself (`levelRun` `firePendingKillLockThrows`) on the tick the game's `Lock.turnOff()` would. Before S3 the page halted by name at that kill (*OPENS 1 kill lock … DECLARES no clear*). The clear is reported as the game reports it: `Lock.as:96` calls `Game.setPersistence(tag, false)`, which writes `pendingCheck "<seq>|<level>|<tag>|0"`. The host's check binding keys on its placement table, so a kill lock is no location and no AP check is made. `liveClears` reads the run's `scratchClears` beside the other four ledgers.

Before a set is delivered and before the map has loaded, the page reports level −1.

The in-app row `seedling-js-runtime-generated-room` (`test-substrates`, category `Seedling JS runtime`, default `fast` batch) plays `seedling_generated_room` this way: synthetic keys on the canvas walk to the `apitem` (one `user:locationCheck`) and through the door to the other generated room (one `user:regionMove`). It needs no wasm artifact.

#### The playback bot on the JS runtime

`flash_seedling_gen` declares `getPlaybackController`, which returns `flashPanel/seedlingPlaybackController.js` (injected by `flashPanel/index.js`; `null` before the module initializes). The controller is a host-side object that walks nothing itself:

- **Names to cells.** It maps the bot's AP names to cells with the generated arm's assembly report (`assembleGeneratedSeedlingSet(...).report`, which the panel keeps from its AP placement load): a location to its room and `apitem` tag, an exit to its room and door tile. An exit name may be bare (`exit_0`) or region-prefixed (`region_0_0__exit_0`); a bare name is read against the room the player is in.
- **The walk runs in the page.** It hands the goal synchronously to the page's `window.__seedlingJsRuntime.playback` (the iframe is same-origin, as it is for `__swfBridge`). `seedlingDemo/jsRuntimeWalker.js` then chooses the keys once per tick inside the page's own clock: every 8 ticks it re-plans with `planWaypoints` over the live run (`livePerVisitOpts` plus `snapStart`, so a player standing against a wall or a pit edge still has a start cell), and every tick it holds `driveStepHeld`'s keys toward the first waypoint not yet reached. `driveStepHeld` is `botDriverV2.drive`'s per-tick choice, lifted out of its loop, so the walk holds the keys the solver's walk would. During a ceremony the session's auto-advance cadence replaces the keys, as it does for a player. While a goal is walked, the keyboard is not read.
- **Done.** A location goal is done when the page reports its `pendingCheck`; an exit goal when the door's crossing fires. The host glue turns those into `user:locationCheck` and `user:regionMove` exactly as for keyboard play.
- **Refusals.** Under a runtime the instance does not walk (`flash`; for an instance built without `wasm: true`, also `wasm`), `walkTo` returns `false` and `lastRefusal` names the runtime and the setting to change, so the bot stops on a named `error:` status. Both instances walk the wasm runtime too: the atlas one since W2, the generated one since WG (see *Wasm playback* below). A name the generated rooms do not hold is refused the same way. A goal that arrives before the page or the AP load is up is held and retried every 250 ms. If the held goal later turns out to be unwalkable (the panel came up on another runtime, nothing was handed over within 60 s), or the page gives up on a live walk (`WALK_GIVE_UP_TICKS`, 1800 ticks), the controller publishes `playback:walkFailed` and the bot shows the reason.
- **The other verbs.** `play`, `stop`, `step` (drive one page tick) and `reset` go to the page's walker. `instant` is `play`: the game has one 30-tick clock. The one exception is the solver mode (below): there, `instant` plays a solved plan in one burst. `setRate` does nothing.

- **Atlas rooms (J3).** `flash_seedling` declares `getPlaybackController` too. It returns a second instance of the same class (`substrate: 'flash_seedling'`, `resolve: resolveSeedlingAtlasGoal`, map `surface.atlas`), so both substrates share one page and one walker. The atlas map comes from the panel's atlas-arm load: the bound check-table entries map a location to its level, tag and entity type, and the rules' own `flash_seedling` payloads map an exit name (`exitName` or `exit_id`, the current region's first) to its `exit_tiles`. A location the atlas arm refused is refused here with the same reason. The walker takes a real room's location at the entity's own stance: a chest from below on its two-pixel band (`chest.chestStanceBand`), anything else at its centre. An exit goal may name a set of boundary cells, and the walk heads for the nearest live teleporter among them. A set with none is refused by name.

The walk does not see enemies or arrows. Generated rooms hold only elements the solver certifies; on the atlas rooms the committed presets walk (the starter atlas: the starting house, the overworld around it, the owl's nest and the first dungeon room) the walk completes with no death. The model is not extended to see more. For rooms the walk cannot cross, the solver mode below asks the real solver instead.

The capability chart's "The Playback Bot can walk it" cell is ◐ *with the Flash Panel's JS runtime, or its wasm runtime* for both `flash_seedling_gen` and `flash_seedling`, from each entry's `playbackScope`.

Two in-app rows cover it (same category and batch): `seedling-js-runtime-bot-completes-generated-room` drains `seedling_generated_room`'s sphere log with `runtime: 'js'`, then routes the bot through a generated door and a parking door into a maze region and back, with every crossing read from gameState's path and no `error:` status at any point. `seedling-wasm-runtime-bot-names-refusal` checks that with `runtime: 'wasm'` the bot's status names the refusal that remains there: a tile target in a generated room, which no tape producer serves (the page is never started). Three more cover the atlas rooms: `seedling-js-runtime-atlas-room` plays `seedling_atlas_location` by keys (the real chest is a `user:locationCheck`, the house door a `user:regionMove` with `pendingExit` matching the wasm game field for field); `seedling-js-runtime-bot-completes-atlas-location` has the bot drain that preset's sphere log (all locations checked, `victory` held); and `seedling-js-runtime-bot-walks-atlas-rooms` has it walk between real rooms on `seedling_atlas`: the house door, the owl's-nest stairs (a `stairsdown`) and the descent into the dungeon, each crossing read from gameState's path.

#### The solver mode (`flashPanel.seedlingSolverWalk`)

The setting `moduleSettings.flashPanel.seedlingSolverWalk` (boolean, default on) makes the page's walk ask the real solver (`solverBot.solveSegment`) for the room's plan before it walks. It applies to the atlas rooms on the JS runtime. Generated rooms always keep the walker above. The panel reads the setting at init and on change (without a reinit), hands it to the live page, and the controller hands it to the page again with every goal (`playback.setSolverWalk`). It is on by default since S2. ⚖ Q3 kept it off until the Worker and the budget landed. The solve runs in a module Worker (solver-walk S2), so the page never freezes while the solver plans, and a solve that runs too long is stopped.

`seedlingDemo/jsRuntimeSolver.js` (DOM-free, beside the walker) does the work. The walker asks it first for each tick's keys:

1. **The goal.** An exit becomes `reach-exit` at the live teleporter the walker resolved (its `.oel` x, y), or `reach-pit` at the pit tile it resolved (below). A location becomes `collect-placement` at the entity's `.oel` x, y. A `tile` goal, and every goal of a mounted generated set, stay on the walker.
2. **The shadow.** The page's session is a tape: its staging plus `perTick`. The solver mode replays it into a fresh run (`createRunForStaging`), re-making any equip it played at its tick, and asserts that the shadow's digest equals the live run's. The digest is level, state, run clock, deaths, transitions, chasers, strike bodies and the selected slot. A mismatch is a page bug, and the walk fails by name. It never solves from a state the page is not in.
3. **The solve.** `solveSegment` runs on the shadow with `prefix: session.perTick`, the admission for a run that has already ticked ([Seedling bot](./seedling-bot.md)). The shadow is wrapped in a recording proxy, so each `advance` the solver makes becomes a row of the expected trajectory and each `equipNow` becomes an equip at that row. This works because the solver searches no run futures.
4. **The play.** The page plays one key set per tick on its own clock, with the session's ceremony auto-advance off: the plan already presses every X. Each equip is applied at its tick.
5. **The check.** Before each tick, the live level, position and death count are compared with the expected row. A re-boot also counts as a mismatch (an item flag changed, or the host teleported). A mismatch refutes the plan, and the solver solves again from the live state. The third refutation of one goal fails it by name (`MAX_REFUTATIONS`).
6. **A refusal.** If the solver refuses (or the model refuses inside the solve), the walker walks that goal instead. The solver's reason goes into the walk's status (*the solver declined — …; walking instead*) and into the walk's give-up message, never silently. An example is a sword-gated rock when the player has no sword.
7. **`instant`.** One page tick plays the rest of the plan in a burst. Each key set is still a full page tick, so checks and crossings report as they do on the clock.

Steps 2 and 3 run behind a solve service (solver-walk S2):

- **The worker.** The page builds `jsRuntimeSolveService.createWorkerSolveService()` and hands it to `createJsRuntime`. Each solve is posted to a module Worker (`seedlingDemo/jsRuntimeSolveWorker.js`) as a tape: the staging, the session's `perTick`, the live digest and row, the goal and the equips played so far. The room records go once per worker. The worker runs `jsRuntimeSolver.solveFromTape`, which is steps 2 and 3, and answers `{ok, plan}` or `{ok: false, kind, message}`. The kind is `divergence` (the walk fails), `refusal` (it declines) or `budget`. The worker needs no bundle entry: the JS runtime page is an unbundled module page in both flavours, and the deployed site serves `frontend/` whole, so the worker loads by URL beside its imports. With no service (node, and every S1 row), the solve runs in place, exactly as before.
- **The hold.** While a solve is in flight, the solver mode answers `{solving}` and the core holds the run. The tick drains the host's queue and flushes the reports, but the run does not step. The page's clock, paint and status keep running. Holding is the only way to play a plan from the state it was solved from: an idle tick would move the enemies under it. A run replaced during the solve (an item flag or a host teleport re-boots it) makes the answer stale. A stale answer is refuted and never played, and the goal solves again. Leaving the walk, a new goal, or switching the mode off terminates the worker.
- **The budget.** `SOLVER_BUDGET_MS` is 5 s, counted from the moment the worker starts the solve, so a cold worker's module load is not charged. The atlas legs solve in 6–64 ms, L6 in 0.2–0.7 s, L4 with the kit in about 1 s, and L12 in 2 s from mid-room and 5.2 s from its door. Three legs measured in the planning sweep never returned. A solve past the budget is terminated, and the goal declines by name: *the solver exceeded 5 s on reach-exit in level 12 (terminated) — walking*. A worker that has not started within `LOAD_BUDGET_MS` (30 s) declines the same way. `?solverBudgetMs=<ms>` on the page's URL and `playback.setSolverBudgetMs` set the budget, for tests. The budget is wall-clock, so a loaded machine cuts off more solves. Each one is a named fallback, and the retry below asks again.
- **The retry.** A declined goal is walked, and the walker offers it to the solver again after a death, a crossing, or `SOLVER_RETRY_AFTER_TICKS` (90) walked ticks, at most `SOLVER_RETRY_MAX` (3) times per goal. Each retry is named in the status (*asking the solver again (retry 1/3, after a death)*). A later state can solve where an earlier one refused: L6 refuses from 60 walker ticks in and solves from 150.
- **The status.** While the worker thinks, the walk's status is *solving… (budget 5 s)*. The page shows it, and the controller relays it, and every decline and retry, as `playback:walkNote` (`{substrate, target, note}`, `procgenCore/playbackEvents.js`). The Playback Bot shows the note after its own status. `note: null` clears it.

- **Declarations (S3).** The shadow replays with the live run's own persistence mode, so a kill lock the solver opens in the shadow opens on the live run on the same tick. Because the page's runs are scratch, a kill lock never becomes a pending declaration, which is what `twoPassSolve`'s discovery arm exists for. What still does is a static enemy (L8's sandtrap under the arrowtrap). The model refuses to compute its death, so only the running game may name the tick (a `PendingDeclaration` with `source: 'game'`). The JS page has no game to ask, so the goal declines by name: *the goal waits on a GAME-sourced declaration {8,…} (sandtrap@96,80) … the JS page has no game oracle*. The walker walks.

- **An arrival on the door (S5).** Some arrivals stand the player inside the goal's own teleporter. Level 11's only door lands at (96, 128) in level 3, on level 3's door back to 11. Where no return spawn exists, the binding's `entrance_spawn` fallback lands on the door tile itself. A teleporter fires only on an entry (`Teleporter.check()` latches the one a boot stands on), so a walk to where the player already stands crosses nothing. While the run is latched on the goal's teleporter, the walker heads for the nearest cell around it that the planner can stand on and route to (`jsRuntimeWalker.stepOffPoint`). The latch drops when the box is off, and the walk turns back and earns the crossing. The solver mode leaves that phase to the walker (`solverGoalFor` answers `{walker}`) and solves the walk back. A pocket with no such cell fails at once by name: *the run stands latched on the teleporter … and no cell next to it can be walked to*. This is level 3 until its rock at (96, 112) is broken, and level 37's stairs ringed by lava. Over the committed presets, 11 arrivals land on a door. Five cross (L87, L101, L102, L106, L109) and two are closed pockets. Four are the arrival's fault, not the walk's, where the `entrance_spawn` fallback puts the player somewhere the game never does: under a magical lock (L34), over a pit (L43, L100) or on a deactivated door (L58). The node rows (`seedlingDemo/jsRuntimeArrivalOnDoor.test.js`) derive that set from the presets and fail on a new member until it is classified. The in-app row `seedling-js-runtime-solver-steps-off-the-door` walks level 3's vanilla round trip: the sword is granted, the solver breaks the rock and takes the door to 11, 11's door lands back on it, and the bot steps off and crosses again.
- **Pit exits (S4).** The playthrough's `out_pit_*` exits name a pit tile, not a teleporter. A vanilla room's pit tile is a valid exit goal: the walker heads for the nearest live pit among the exit's cells, planning with that one pit exempted (`allowPit`), and the solver mode asks for `reach-pit`. The fall is the crossing: the core reports it to the walk as `{type: 'pit'}`, a pit exit completes only on a fall and a door exit only on a door. The page writes no `pendingExit` for a fall, because the game writes one only in `Teleporter.update()`; the host reads the level move. A solved pit plan ends after the fall's transport, and the page plays that tail with no keys. On L48, L83 and L84 the walker alone falls through too. On L30 a breakable rock stands on the pit, so only the solver (with the sword) gets through: it breaks the rock and falls. W0 measured the committed atlas worlds: every door exit already reached the solver, every bound location already mapped to `collect-placement`, and of the playthrough's 35 pit exits 24 are now walkable goals (L40's 11 are in a room the model halts on at boot). Of those 24 the solver plays 5 bare (L48, L83 and three in L84) and L30 with the kit. The rest decline by name: L16's danger ladder (and one block-route search bound), L84's pockets with no corridor, L12 and L32 behind a magical lock or a burnable tree, L58's pit with no `control` block, and L110's fall into a teleporter.
- **Equips (S4).** No goal in scope emits an equip. The solver selects a slot only in the BobBoss encounter's burn, and that encounter is deferred until a world needs it. The S1 equip path (`run.equipNow` at the plan's tick, re-made in the next shadow) is unchanged.

What it buys: enemies (L6's bobs are baited, L5's are killed and its kill lock opens), puzzles (L4's shove and hold), chests and pickups (L86, L17, L11 with the kit, L109's Firewand), pit exits (L30's rock on the pit), and walks the J2 walker stalls on (L12). L12's chest behind the shield lock declines by name (no shield) or past the budget (with the kit). Static enemies still decline, as above. The in-app row `seedling-js-runtime-solver-opens-kill-lock` teleports the page into level 5 and walks to the teleporter at (48, 112) behind its kill lock. The solver kills, the crossing to level 6 is reported, the clear is reported once as `<seq>|5|0|0`, and no AP location is checked. Its node rows are in `seedlingDemo/jsRuntimeDeclarations.test.js`. The in-app row `seedling-js-runtime-solver-walks-enemy-room` (same category and batch) sets the mode on, teleports the real page into level 6 through the page handle, and walks it to the stairs at (224, 32) past the bobs. The plan uses `bait`, every planned key is played with no refutation, the stairs crossing is reported, and there is no halt and no `error:` status. Two more rows cover S2. `seedling-js-runtime-solver-budget-falls-back` teleports to level 12's door under a 300 ms budget, and the worker is terminated and the walker takes the goal by name. `seedling-js-runtime-solver-keeps-the-frame-clock` solves level 12 from 120 walker ticks in: the page's 20 ms heartbeat never gaps past 250 ms during the solve, the run does not step, and the plan then plays to level 36. Two rows cover S4. `seedling-js-runtime-solver-falls-through-pit` grants the sword through the AP item path (as the S5 row does), teleports to level 30 and walks to `out_pit_3_34`: the solver breaks the rock on the pit, the walk completes on the fall to level 31, and no `pendingExit` is reported. `seedling-js-runtime-solver-opens-chest` opens level 17's chest through `collect-placement` and reports its clear once. Their node rows are in `seedlingDemo/jsRuntimeVerbs.test.js`. The node rows are in `seedlingDemo/jsRuntimeSolver.test.js` and, for the worker, `jsRuntimeSolveService.test.js`, which runs the real worker entry through `worker_threads`.

#### Wasm playback (solver-walk W1, W2)

The wasm game only replays tapes, so the Playback Bot cannot walk it the way the JS runtime walks itself. Instead, a real room is solved at its arrival on the JS model and the solution is shipped as one tape (`NewDocs/plans/seedling-js-solver-walk-plan.md` §5). W1 built the arrival, the staging and the solve, playing nothing. W2 plays it: the `flash_seedling` controller walks real rooms on the wasm runtime. W3 recovers when the game leaves the plan. WG walks the generated rooms (`flash_seedling_gen`) the same way, with the J2 walker as the tape producer (below).

`seedlingDemo/wasmArrival.js` (DOM-free) does three things:

1. **The arrival.** `isArrival(prev, botSeam())` is true when `botSeam().beginEntry` changes: a new `Game.begin()` has landed. The `level` and `pendingExit` reports do not work as the signal. For a host-issued swap they run one frame ahead of the landed world, and a tape armed on them latches on the outgoing world (the W0 probe's 12g race). The probe sees each arrival about 19 frames before the first stepped tick.
2. **The staging.** `stagingFromWasmArrival({seam, status, state, record})` takes `botSeam()` (read first: `botLoadTape` clears `beginEntry`), one `botStatus` read (it costs 14–16 ms, so read it once per arrival, never per frame), and the bridge's `readState` (the spawn `Main.playerPositionX/Y`; `botStatus` reports the live player, 8 px off). It hands that to `segmentBootFromLatch`, so the latch-to-tape rules are the chain's own. The clock is declared one frame short, the seal log is read as a prefix, and a zero that cannot be declared is refused. The result is a JS staging (`createRunForStaging`) that also round-trips the tape format (`buildStagedTape` → `parseTape`):
   - All three save arrays are declared. `botStart` resets every save array, so an array a tape leaves out is wiped (W0 measured `seal_parts` lost).
   - `persistence` is `persistence_cleared` exactly. A clear the game did not report is a fake check if it sorts last, and a silently cleared flag otherwise.
   - `pins` are the host tape's (`sound`, `dead_frames`, as the JS page pins), not the live game's (none outside a tape). The solver refuses every wet tick on a staging that does not pin `sound`.
   - `ARRIVAL_FIELD_SOURCES` classifies every `SEAM_SIGNATURE` row by where an arrival reads it, and a new signature row without a class throws. No read-only verb carries five of them: `firstUse`, `extended`, `grassCut` and the music set and index. They are left undeclared, never guessed, and no physics reads them. The moonrock's `beam` and `rockSet` are read off `readState` (W5, below), and the staging declares them.
   - A `botStatus` level ahead of the begin record (a swap still pending) is refused, and so is a readout the build lacks.
   - `arrivalStagingWitness` checks the staging against the reads, field for field.
3. **The solve.** `arrivalSolverGoal` maps an AP goal (from `resolveSeedlingAtlasGoal`) with the JS page's own mapping (`solverGoalFor`, the walker's teleporter resolution, `locationEntityOf`). `arrivalSolveRequest` builds the S2 solve service's request for a fresh boot: `perTick: []`, so no `prefix`, and the live digest is the fresh run's. `createWorkerSolveService().start(request)` solves it in the module Worker, unchanged. The plan carries the keys and the expected trajectory (`expected[0]` is where the game's player stands).

**Playing it (W2).** The controller's atlas instance is built with `wasm: true`. A wasm `walkTo` loads the engine `flashPanel/seedlingWasmPlayback.js` on first use, by a computed-URL dynamic import so the panel's static imports stay model-free, and holds the goal until the engine is up. The engine serves one goal in one room:

1. **Arrive.** If the player is in another room, the engine waits for the crossing that lands in the goal's room. If the engine holds the goal's room (W7, below), the goal is solved from it as a continuation. If the player is already in the room but the engine holds no staging of it (the cold start), the engine forces a re-arrival: a host `new Game(level, spawn)` through the panel's own teleport recipe, so the room resets like a death and the solve starts from a real arrival. A goal that comes while a plan tape is still playing waits for that tape to finish, which includes waiting out a `SealController` freeze rather than cutting it with a teleport. A goal in a level the source does not hold is refused by name before anything moves (W1–W4 also refused level 0 here, for its moonrock; W5 lifted that). An exit goal whose arrival stands latched on that same door, and a pit exit, are served as *arrival composites* (W4, below).
2. **Stage and freeze, in one JS turn.** `botSeam()` is sampled on a 0 ms timer in the game's window. At the arrival the engine reads `botStatus` once and builds the staging. It then starts a zero-tick `hold` tape, which waits out the fade and holds on the first live frame, before that frame steps. The room stays still while the solve runs.
3. **Solve** in the S2 module Worker with the S3 page's scratch persistence, under the same budget (`SOLVER_BUDGET_MS`).
4. **Ship** the plan as one tape built from the same staging (`seedlingDemo/wasmPlayback.js` `shippedTape`):
   - `boot` is this level and the spawn, so the tape plays on the same world.
   - `persistence` is the live cleared set, and all three save arrays are declared.
   - `pins` are the solve's.
   - `seam` is null. No partial block is possible: once a tape declares a seam, `botStart` writes `beam`, `rockSet`, `firstUse`, `extended`, `grassCut` and the music pair unconditionally, and no read-only verb carries five of those seven. With `seam` null the game's own values, `beam` and `rockSet` included, are never overwritten.
   - The rng is left alone (seed 0, fp 0). The staging's seeds come from the begin record, before the build drew from the stream, so re-declaring them would rewind the live stream.
   - `split` ships the live value, and a split stream is refused.
   - An exit plan ends un-held: a hold across its crossing would block the glue's redirect. A location plan ends held (W7, below).

   The declarations are checked against a fresh `botStatus` (`exactDeclarationRefusal`). `botLoadTape` keeps the hold and `botStart` releases it.
5. **Watch.** `botDrain()` runs every 100 ms for the progress note (*playing tick k/N*) and for the trajectory compare (`firstDivergence`). Drained row `t` is the row before tick `t`, the same as `expected[t]`. The tolerance is 0 px: every leg W2 measured matched the plan exactly. Once every planned tick has drained, the engine reads `botStatus` every 500 ms to see `finished`.
6. **Recover (W3).** On a divergence the engine reads `botStatus` once and asks `divergenceAction`:
   - If the goal's clear is already in the game's cleared set, the leg is done. Re-solving would only meet the solver's "already open" refusal.
   - Otherwise it `botReset`s, forces a re-arrival at the spawn the arrival recorded, and solves again from the new arrival (steps 2–5). It does this at most `MAX_RECOVERIES` (3) times per goal.
   - The divergence after the third recovery fails by name (`divergenceFailure`, e.g. *the game left the plan 4 times on Starting House - Chest in level 86 (gave up after 3 forced re-arrivals, the bound is 3); last at tick 7: …*). That goes out as `playback:walkFailed`, and the bot shows it as its `error:` status.
   - **An exact repeat fails at once (W4).** A divergence at the same tick with the same game row (level, x, y, compared exactly) as the goal's previous one is a deterministic model/game residue: the re-arrival re-solves the same plan from the same staging, so it would recur on every attempt. `divergenceAction` answers `repeat` and the goal fails by name after two plans (`divergenceRepeatFailure`, *… at the SAME tick with the SAME game row 2 times in a row (gave up after 1 forced re-arrival: …)*). Any other divergence spends a recovery as before.

   A `SealController` freeze drains no rows, so it never counts as a divergence.

   **A reset leaves the tape's keys held.** `botReset` releases none of the keys the tape was holding. A held key survives the re-arrival, and the next plan's press on it is lost: W3 measured `press_totals.up 0`, and once a leftover `down` cancelled the new plan's `up` at tick 1. A lone browser `keyup` does not fix this, because the runtime drops a key-up for a key it never saw go down. So after each reset the engine sends a `keydown` + `keyup` pair on the game canvas. The pair goes only to the keys in `keysHeldAtReset`: keys the plan holds at `solution[tick-1]` that the game's edge echo also reports held. The `keydown` does nothing to a key that is already held, while the same pair on a key nobody holds would be a fresh press.

The check and the crossing are the game's own. The chest opens for real and the check binding reports it; the door is walked and the region binding sees the crossing. **Guard (⚖ W0-Q1):** every `botStart` is bracketed by two reads of `pendingCheck`'s seq, and the range goes to `SeedlingCheckBinding.ignoreHostStart`. A clear reported inside that range that the binding has not already checked is a declaration's echo, never a collection: it is counted in `stats.armingWindow` and makes no AP check. **Kill locks** are left undeclared. In the measurement, the game cleared L5's lock itself, on the plan's tick.

`scripts/procgen/probe-seedling-wasm-playback.mjs` is W2's live witness:

- **G.** On a fresh house, a tape declaring the unearned chest clear is refused by `exactDeclarationRefusal`. Started anyway through the guard, it makes no AP check (`armingWindow` 1, `key_blue` not received).
- **B.** The Playback Bot drains `seedling_atlas_location`'s sphere log on wasm. The chest is checked once, `key_blue` arrives once, and the binding makes one check. One crossing goes to `region_2_3`, with no `error:` status. Both legs follow the plan with no divergence: the chest takes 102 ticks and ends exactly on the plan's end row, and the door takes 6.
- **K** (`--only=K`). L5's teleporter is reached behind its kill lock in 558 ticks (`kill`, `walk`). The game clears {5,0} itself and crosses to L6.

W3 adds two sessions, each on a fresh page (the default run is G+B, R, P), and B now also asserts 0 divergences and 0 recoveries. The injector runs on the game window's timer and holds ArrowRight for about 200 ms into a chest plan tape. The tape never pressed that key, so the drained rows leave the plan by +0.8 px in x at ticks 5–9.

- **R.** The injector fires once. The chest leg diverges, recovers once and finishes on plan. The chest is checked once, the door is crossed, and every `botStart` is bracketed.
- **P.** The injector fires on every chest plan. After 3 recoveries the bot's status reads the named failure, or sooner when one divergence exactly repeats the previous one (W4; the injector is timer-driven, so either can happen, and the probe names which). No check fires, the AP inventory and checked locations are unchanged, and nothing of the engine's is left armed or held. Every key held at each divergence was pressed by that tape, so no key carried over from a reset.

The node rows are in `seedlingDemo/wasmPlayback.test.js` and `flashPanel/seedlingWasmPlayback.test.js`, which runs the engine over a fake game built from W1's recorded arrivals with a real solve. The W3 rows cover one injected divergence that recovers, a persistent one that fails by name after 3, a per-goal bound, a freeze that is not a divergence, a clear that has already landed, and the key release. W4 adds an exact repeat that fails after 2 plans, and the repeat memory being per goal.

**Arrival composites (W4).** Two goal classes the JS page serves with its walker are served on wasm too, still as one tape from the arrival:

- **A pit exit.** No teleporter on the exit's cells → `arrivalSolverGoal` takes the nearest live pit (S4's `nearestPitAt`) → `reach-pit`. The fall is the game's own crossing: no `pendingExit` is written, and the region binding reads the level move. The plan's keyless coast after the fall drains out of the room, where `firstDivergence` counts every row as agreeing.
- **An arrival latched on its goal door** (S5's arrival on the door: a teleporter fires only on an entry). `arrivalSolverGoal` answers the door's `reach-exit` with `stepOff`, and the request goes to the worker as `producer: 'step-off'` (`wasmWalkTape.stepOffSolveFromStaging`). On a fresh run from the staging, the J2 walker steps off (`stepOffPoint`) until the latch drops. Those keys become the solve's `prefix` (`solveFromTape({perTick: stepOff})`, S0, which asserts that their replay is the walker's run), and the solver walks back onto the door. The plan is `solution = stepOff ++ plan`, `expected = walkerRows ++ planRows`, with one join row (the walker's last row is the plan's first, asserted). It is shipped, watched and recovered like any plan. Nothing happens mid-room on the game: the walker→solver seam exists only in the model. A closed pocket (no cell next to the door can be walked to: L3 bare under its rock, L37 ringed by lava) is refused by name at the mapping, before any solve. A step-off that dies, crosses, or is still latched after `STEP_OFF_MAX_TICKS` (240) is refused by name too.

`seedlingDemo/wasmArrivalComposite.test.js` pins both: the house door from (48,64) and S5's five rooms map to a step-off and cross; the composite replayed from a fresh run is `expected` row for row, and the latch drops exactly at the join; the closed pockets are named; the real worker entry gives the in-place plan; and L48/L83/L84's pits fall on plan.

`scripts/procgen/probe-seedling-wasm-arrival-composites.mjs` is the live witness on `seedling_atlas` (p4e, headless logic-only, under the box lock). Each leg is a host jump to an arrival the committed atlas worlds name, then the engine serves one exit goal there. Each session runs on a fresh page, because the wasm game runs out of memory after about 100–140 world swaps:

- **D.** The latched doors: the starter atlas's house door from (48,64) and its two stairs, and S5's five rooms, each crossed on plan by one step-off composite. A divergence at the join would be reported as a STOP. The closed pockets L3 and L37 fail by name. The four `entrance_spawn` fallback arrivals (L34 lock, L43 and L100 pit, L58 dead door) are named, not fixed.
- **T.** The pits of L48, L83 and L84, fallen on plan.
- **X.** The deterministic residue legs (L28, L30, L45, L88 ×2): each fails by name on an exact repeat after 2 plans, not 4.

`scripts/procgen/probe-seedling-wasm-arrival-solve.mjs` is the live witness (headless logic-only, p4e, under the box lock). On `seedling_atlas_location` it takes four arrivals: a host jump into the Starting House; the locked door (the game's door to level 0, then the glue's bounce back); and a jump after the chest is opened for real. Since W5 the level-0 arrival stages too, with `beam` and `rockSet` declared from `readState`. Each is staged and witnessed. The chest and the door are solved in a real module Worker in the host page and agree key for key with the in-place solve: the chest takes 102 key sets (`chest`, `walk`), and the door takes 6 and ends in level 0, the vanilla teleporter's target. After the chest, its goal is the solver's own named refusal. `botLoadTape`, `botStart` and `botReset` are wrapped and counted, and the count is 0. `--record=<path>` writes the reads. `seedlingDemo/wasmArrival.test.js` runs on the recording committed as `fixtures/wasm-arrival-p4e.json`, including the real worker entry through `worker_threads`.

**Level 0, the overworld hub (W5).** Level 0 holds the moonrock, which reads the save statics `beam` and `rockSet` (`Main.as:159-160`). `botStatus` carries neither, so W1–W4 refused every level-0 goal by name. `games/seedling.json` now declares both, before `level`, so the bridge's `readState` carries them: BridgeGeneric takes one `configure` (a second answers `error:already configured`), so they have to be in the panel's own config. `ARRIVAL_FIELD_SOURCES` reads them as `state` rows, `UNREAD_MODELLED_READERS` is empty, and `wasmGoalRefusal` passes level 0. The solve's staging declares them; the shipped tape still has `seam: null`, so the game keeps its own values.

- **The AP path does not act on them.** Neither names a `locations[].property`, and the region and check bindings read only `level`, `playerPositionX/Y`, `pendingExit` and `pendingCheck`. `flashBridgeAdapter.test.js` pins it: the same report stream, configured with and without the two rows, gives the same checks, undos, writes and binding effects, and the reports differ by exactly the two rows.
- **Every bridged build reads them.** The getters are vanilla AS3, so p4e and the `control` p4d both configure with them and report them.
- **The JS runtime page skips them.** Each room there boots from its own staging and the page does not carry the statics across rooms, so `valueOf` answers nothing for them and `readAll`/`flush` skip them, as BridgeGeneric skips a property a build cannot read.
- **After the shield, `beam` is true.** `Shield.removed()` writes `Moonrock.beam`, which is `Main.beam`. The next level-0 arrival stages `beam: true`. While the player stands more than 36 px from the rock, the beam counts down 150 frames, then the rock falls, lands on the owls-nest stairs as a Solid, and the game writes `rockSet: true, beam: false`. The model plans through it: a long enough plan sees the rock land mid-tape, and the owls-nest stairs become unreachable (the solver declines by name).

`scripts/procgen/probe-seedling-wasm-level0.mjs` is the live witness on `seedling_atlas` (p4e, headless logic-only, under the box lock), each session on a fresh page:

- **Z.** From the game's own boot in the hub, with no host jump: the house door's real entry (hub → house), the house door back out, and the owls-nest stairs (→ L2). Each crosses on plan, and each level-0 arrival declared `beam` and `rockSet` read off `readState`.
- **S.** The engine collects the shield in L20 for real, and `readState` then reports `beam: true`. In the hub, `out_teleporter_0_128` is served with `beam: true` staged. The plan outlasts the beam, so the rock lands mid-plan; the crossing is on plan, and afterwards the game itself reports `beam: false, rockSet: true`.
- **B.** The Playback Bot walks the starter `seedling_atlas` on wasm from the hub (`overworld_start__r8c0`): the house door, then the chest. Its status is `finished`, the chest is checked once, and there are no divergences. The bot's queue is the preset's own embedded `sphere_log`, which `region-atlas-compile.mjs --embed-sphere-log` builds with the forward simulator's `generateSphereLog`. The app loads it on boot and nothing is injected; B checks that the loaded log is the committed one.

**Holding the room between goals (W7).** ⚖ The user ruled (2026-10-03) that the solver must not need to exit and re-enter a room, or clear the save, to solve it. Through W6 every goal after the first forced a re-arrival, because the bot's next `walkTo` came seconds after the room had started running freely. W7 keeps the room still between goals and solves the next goal from where the room stands (plan `NewDocs/plans/seedling-wasm-solver-plan.md` §2.4). ⚖ The room may stay frozen, ignoring the keyboard, while the bot drives and waits for its next goal.

- **Location plans end held.** `endsHeld(goal)` is true for a location goal, so its tape ships with `hold`. Exit plans stay un-held, because their crossing must reach the glue. The engine keeps the room's recipe: the arrival's staging plus every key set shipped since.
- **The next goal in a held room is a continuation.** `wasmArrival.continuationSolveRequest` replays the arrival staging with the shipped keys into a shadow (`replayTape`). Its digest becomes the request's `live`, and the shipped keys become S0's `prefix`, so the worker solves `solveFromTape({staging, perTick: shipped})` unchanged. Before solving, the engine checks the held game against the shadow (`wasmPlayback.shadowMismatch`: level, x and y, exact). A mismatch would be a staging bug and is never solved past. The continuation tape boots the same arrival but declares what the game holds now (`liveDeclarations`: the persistence and the three save arrays from a fresh `botStatus`), so `exactDeclarationRefusal` holds.
- **Every arrival while the bot drives is held.** After an exit plan ships, the engine's arrival watch samples `botSeam()` on the game window's 0 ms timer. A begin-record change is staged and held in the same JS turn, unless the glue is about to redirect it. A hold blocks every world swap (W0 i.11), so the engine asks the glue first (`SeedlingRegionGlue.swapState()`, read by `arrivalHoldBlocker`). It has three arms:
  - a region-binding mark (`pendingArrival`, `pendingBounce`, `pendingDeparture`) or the park;
  - a teleport still in the adapter's invoke queue;
  - a teleport pushed while this begin record was live. `WasmBridgeAdapter` stamps each invocation push with the begin record it went under, because a same-level teleport arms no mark and lands as a begin record and nothing else.

  Measured on `seedling_atlas` (hub → house door): the glue queues its redirect in the same frame as the door's report, but the 100 ms push sends it about 0.4 s later. So the door's own begin lands first and is refused, and the redirect's landing is held. A held room with no goal keeps watching the glue: a redirect that raced the hold is released so it can land. An engine built without the glue query (`getSwapState`), or a glue that answers nothing, holds no arrival between goals.
- **Fallbacks are named, never failures.** Each of these falls back to the forced re-arrival (`FALLBACK_POLICY`), counted in `stats.forcedBy` and recorded in the history as `fallback` with its kind:
  - the cold start: the bot's first goal in a room that ran before it drove (`cold-start`);
  - a continuation the solver declines or runs out of budget on (`continuation-declined`, `continuation-budget`);
  - a shadow latched on the goal door (`continuation-refused`), since a step-off composite starts at an arrival;
  - a shadow mismatch (`shadow-mismatch`);
  - the X-split rule (`x-split`, `primarySplitRefusal`). A tape's span releases its keys at the finish, so a continuation that opens on `primary` (X) after a tape that held it would be a fresh `Input.pressed`, a swing the model never planned.

  A divergence is W3's recovery, unchanged.
- **Every pause releases.** `stop()` releases the hold, because a held room ignores human input. That covers the bot's ⏸, its `finished` and `error:` stops, and the substrate change on a crossing.
- **Generated rooms keep W2's flow** (the walker producer has no prefix form).

On `seedling_atlas_location` W7's walk spent one forced re-arrival, the cold start. The chest's plan ends held, and the door is a continuation from it. That made 2 world swaps, where W2 walked 3 (W8 below adopts the cold start: 1).

`scripts/procgen/probe-seedling-wasm-continuation.mjs` is the live witness (p4e, headless logic-only, under the box lock), each session on a fresh page:

- **C.** §1.3's C rows through the engine's own pieces (`wasmContinuationLab.js`, imported by URL). These play on plan: the L6 re-solves at K 60, 150 and 200, the L4 rests at K 40, 80 and 120, and the L86 re-solve at K 10. The held game equals the shadow at every point. L4's re-solve diverges at t 41, and its seam-free composite (prefix ++ re-solve as one tape) diverges at K + 41 with the same rows. That names it model residue on the re-solved shove approach, not the seam.
- **W.** The bot on `seedling_atlas_location`, with 0 forced re-arrivals (W8 adopts the cold start). `--base` makes a report-only run against a server on another tree.
- **A.** The bot on `seedling_atlas` (hub → house → chest). The house's first begin record is refused by the glue query, and the redirect's landing is held. The chest is solved from that held arrival.
- **R.** The chest's plan ends held, and the room ignores ArrowLeft. Then the bot's pause releases it, and ArrowLeft moves the player.

**Adopting the cold start (W8).** The cold start was W7's one remaining forced re-arrival: the bot's first goal finds a room that ran before it drove, and no staging was taken at its arrival. W8 adopts that room where it stands when the live game provably is "its arrival plus N idle stepped ticks". Then the engine holds it and serves the goal as a continuation from the shadow "arrival + 1 idle tick" (`room.shipped = [[]]`, the usual held check first). Measured live on p4e (the house cold start, plus L7, L9 and L13 left unwatched after a host jump): in a room with no `Mobile` but the player and no timed puzzlement, every N from 1 to 2000 gives the same shadow (minus the tick count) and the same plan, and each plan plays on plan. `wasmPlayback.adoptionRefusal` checks these clauses in order, and the first that fails is the refusal (`stats.adoptRefused`, `{clause, why}`):

- **begin**: the begin record names the level `botStatus` reports;
- **tape**: no tape is armed, holding or pending;
- **fade**: more than `ADOPT_MIN_ELAPSED` game frames (two legacy fade bands) since the begin record, so the fade is over and at least one tick stepped;
- **inventory**: `inventory_slots` is empty;
- **player-state**: no hits, i-frames, drowning or freeze, input accepted, no menu or cutscene;
- **mobiles**: `botMobiles` holds the player and nothing else;
- **timed**: the room record holds no `combat.PUZZLEMENT_HAZARDS` type;
- **velocity**: the player row's `vx` and `vy` are 0;
- **position**: the player stands where the shadow does;
- **facing**: the player row's stand animation is the shadow's (`standAnimFor(direction)`, `down-stand` at an arrival).

The engine also asks the glue query (`glue`, as for a held arrival). An engine built without it adopts nothing. Any refusal falls back to the named `cold-start` re-arrival.

What no readout sees, and why the clauses look this way:

- **A person's keys are not logged outside an armed tape** (`Bot.as` `recordEdges` runs below `if (!armed) return`). Measured: a frame-exact right-then-left tap puts the player back on the spawn to the bit, with v = 0, no rng draw and unchanged persistence, yet turned (`side-stand`). Position catches a person who walked away; facing catches this one.
- **Item state is hidden**: slash and spear timers, a cut `Grass`. So a player with anything to use is not adopted.
- **The rng cannot be a clause.** "Live `rng.state` equals the begin record's `rng.gameplay`" is false at every arrival: with `split` false the build's draws land on the gameplay stream (the house build is 91 LFSR steps, level 0 is 1200), and nothing reads that count at a cold start.

On `seedling_atlas_location` the walk now spends **0 forced re-arrivals and 1 world swap** (the door). `seedling_atlas` and `seedling_playthrough` start in level 0, which holds `introchar` and `statue2` (Mobiles), so their cold start still re-arrives. Of the committed arrival regions, 44 of 176 (30 of 113 levels) are no-mobile and untimed.

`scripts/procgen/probe-seedling-wasm-adopt.mjs` is the measurement and the live witness (p4e, headless logic-only, under the box lock), each session on a fresh page. **H**, **P** and **R** measure through `wasmAdoptLab.js`, imported by URL, outside the engine:

- **H**: the house, untouched;
- **P**: the frame-exact person;
- **R**: L7, L9 and L13 left unwatched.

**W** and **K** go through the engine:

- **W**: the bot walks the house with 0 forced re-arrivals in total;
- **K**: real keys move the player first, the adoption is refused by name, and the cold-start re-arrival serves the walk.

**Generated rooms (WG).** The generated instance is built with `wasm: true` and `wasmLevelSetOf` (the surface's `wasm.levelSet`, the set the generated arm assembled and delivered). What differs from the atlas rooms is below; everything else above (the arrival, the freeze, the shipped tape, the guard, the recovery) is the same code:

- **The level source is the mounted set**, never the preset's map document. `loadWasmPlaybackEngine({levelSet})` builds the engine over `seedlingDemo/wasmWalkTape.mountedRecordsOf(set)`: the set through the delivery's own chunk plan (`planLevelSetChunks`, which renders each room to the OEL the game reads) and back, each room parsed by the JS page's `recordOfRoom` under the level id it is mounted as. The node rows pin that these records equal the JS page's after the same delivery. A goal is held until the set is delivered, and a new set is a new engine.
- **The tape comes from the J2 walker, not the solver.** When WG was built the solver had no goal kind for an `apitem` (`collect-placement` there "resolved to NOTHING"). Since F2 it resolves as strategy `apitem`, but the engine has not switched producers. So the arrival's request is `producer: 'walker'`, and the S2 worker runs `wasmWalkTape.walkTapeFromStaging`: the same `jsRuntimeWalker` on a fresh run from the same staging, its held keys recorded tick by tick. The plan has the solver's shape (`solution`, `expected`), so the engine ships, watches and recovers it unchanged. The apitem contact and the crossing are judged as the JS page judges them. The contact uses the player box of the previous tick, and the tape ends on the contact tick: the game clears the slot in that same frame and reports the check itself. Over every committed generated preset room, the producer's keys equal the JS page's own walk tick for tick. The node rows pin each member's tape (keys and expected digest). The one member it cannot produce, `seedling_generated_swim`'s apitem across water the walker does not cross, is refused by name.
- **An apitem clear is lifted from the model's staging only.** A door leg after the apitem arrives with the apitem's clear in `persistence_cleared`. Before F2 the model refused to boot a staging that declared it, because the `apitem` class had no persistence response (F2 added `despawn`). The lift is kept: the apitem has no collider, so the room is the same without it: the producer drops the clear from the run it walks and counts the apitem as collected. The shipped tape still declares the clear exactly (`exactDeclarationRefusal`).
- **Refused by name:** a `tile` target, before anything loads (the walker producer serves a location or an exit); a goal the walker does not reach (*the walker producer declined … (refusal): the walker did not reach …*); a level the mounted set does not hold.

An apitem leg usually ends `stopped`, not `done`. The game reports the check on the tape's last tick, the bot takes it and moves on, and that stops the controller before the engine's `finished` read. Every planned tick has drained on plan by then.

`scripts/procgen/probe-seedling-wasm-generated-playback.mjs` is the live witness (p4e, headless logic-only, under the box lock), each session on a fresh page:

- **R.** The bot drains `seedling_generated_room`'s sphere log on wasm. The apitem is checked once, by the walker's 220-tick tape, on plan. The binding makes one check and catches nothing in a host window. The bot is then sent to the maze region `region_1_1`. The generated door and the parking door are two 7-tick walker legs, and each crossing is reported once. There is no `error:` status, and every `botStart` is bracketed.
- **L.** `seedling_generated_leaf`: the two maze locations, then the generated leaf's apitem behind them (95 ticks), after the crossing into the room.
- **P.** W3's bound on walker tapes. The injector fires on every apitem plan, and after 3 forced re-arrivals the bot's `error:` names the failure, or after 1 when the divergence exactly repeats (W4). No check fires, and no key carries over from a reset.

`--record=<path>` writes the engine's raw arrival reads (`engine.arrivalReads`). `flashPanel/seedlingWasmPlayback.test.js` runs the generated engine over that recording (`seedlingDemo/fixtures/wasm-arrival-gen-p4e.json`: the fresh start room, the room re-entered after the apitem, and room 1 entered by the crossing) with the real walker producer. ⛔ The witness cannot be an in-app row. The in-app runner's Chromium (`playwright.config.js`: `--disable-gpu`, no WebGPU switches) has no WebGPU adapter (`requestAdapter()` returns null), so the recompiled game starts in no in-app row.

### Host-enforced door gates

A generated or real room can host children behind any AP item. The game cannot enforce such a gate: pipeline items (`key_blue`, `victory`) are not Seedling items, and a door is a plain teleporter. The host enforces it instead.

- **The rule.** `flashPanel/seedlingDoorGate.js`'s `createDoorGate` builds `canPass(exit, {region})` from the state manager's latest snapshot, its static data, `createSnapshotInterface` and `evaluateRule`. It looks the rule up as `staticData.regions[region].exits[]` by `exitName` (`staticExitOf`), never by `exit_id`. `True_` or no rule passes without evaluation. Only when static data has no such exit does it use the world's own `access_rule`, and the verdict says so (`source: 'world'`, `DOOR_RULE_FALLBACK`).
- **The bounce.** On `pendingExit`, the binding asks `canPass` before publishing a crossing. A refused door publishes no move. The game has already swapped into the door's `to` level, so the binding arms a `pendingBounce` mark; when that level report arrives it is swallowed and answered with a teleport back onto the door's approach cell. Waiting for the swap matters: a teleport queued at the door report could land first and be overwritten by the swap.
- **The message.** The binding returns `locked` with the region and missing items (`ruleItemNames`). The glue logs e.g. "[door gate] the door to region_2_3 is locked — you need key_blue" and publishes `flashSeedling:doorLocked` (`DOOR_LOCKED_EVENT`), registered as a publisher.
- **Errors open the door.** A missing evaluator, missing snapshot, missing static data or non-boolean result (`DOOR_GATE_ERRORS`) takes `DOOR_GATE_ERROR_DEFAULT = 'open'` with a loud panel line. These failures are systemic, so a locked default would lock every gated door at once, the back door included, and strand the player.
- **Lazy evaluator.** `createSnapshotInterface` pulls in every game's logic, so `register()` loads it lazily (`createSnapshotInterfaceLoader`); until then a gated door takes the open default.
- **Hooks.** For generated rooms, `canHostExitGates` is always true, and `exitGateVeto`/`backPortalGated` read `regionParams.seedlingGen.hostChildren` (`hostsChildren`, the panel bag's `seedlingGenHostChildren`, default true). It steers the sphere tree only and never reaches `generation`. `SEEDLING_GENERATED_LEAF_STATE` sets it false. A back door is gated on the entry gate, which anyone inside already holds.

Nothing in the app exposes a goal-reached state, so the host-world gates evaluate the rules' `game_info[p].completion_condition` against the live snapshot.

### The water-gated world (swim T1)

`SEEDLING_GENERATED_SWIM_STATE` (`seedling_generated_swim`) is a maze START holding the AP item `Progressive Swim`. Its exit is gated `Has(Progressive Swim)` and leads into a `post-swim` generated room (`elements: watergate`, `require: canSwim`) that holds `victory` on its goal cell. The tree's gate and the room's requirement are one item, since the bridge grants `canSwim` on the first `Progressive Swim`.

The boot-aware hazard set seats the room's door on the dry side of the water. The arrival lands at (5,1), one water cell (1,2) separates it from the goal (2,3), and the generator certified that goal REFUSED without the conch.

`check-seedling-generated-swim-play.mjs` plays it with real keys: the conch in the maze, the gated exit, the arrival (`canSwim` true, `botStatus.drown_timer` 0), the swim with `drown_timer` 0 on every sampled step, the victory, and the completion condition.

It has no refusal phase, and that is measured, not skipped. Every maze path from the START's entrance to the gated exit crosses the conch's cell, which the maze collects on step (seeds 1–12 of the state alike). So no player meets the maze's gate or the water without the item.

## Committed worlds and gates

Each world is written by `scripts/procgen/make-seedling-spiral-room-preset.mjs --state=<name>` from a state in `procgenPipeline/presetDefs.js`, and opened as `frontend/?game=<preset>&seed=1`. The box gates in `scripts/procgen/` play them in the real game and skip when the wasm artifact is absent; they share their helpers (including the hazard-aware walker `roomPath`) in `scripts/procgen/seedlingRoomPlay.js`.

| Preset (`--state`) | State | What it shows | Box gate |
|---|---|---|---|
| `seedling_spiral_room` (`spiral`) | `SEEDLING_SPIRAL_ROOM_STATE` | A real room in a maze spiral; departures through `external` doors. | `check-seedling-spiral-room-play.mjs` |
| `seedling_sphere_room` (`sphere`) | `SEEDLING_SPHERE_ROOM_STATE` | A real room as a sphere leaf behind a maze gate. | `check-seedling-sphere-room-play.mjs` |
| `seedling_atlas_host` (`atlas-host`) | `SEEDLING_ATLAS_HOST_STATE` | A real room hosting a gated door; locked, then open. | `check-seedling-atlas-host-play.mjs` |
| `seedling_atlas_location` (`atlas-location`) | `SEEDLING_ATLAS_LOCATION_STATE` | A real room's chest as an AP check (the atlas arm). | `check-seedling-atlas-location-play.mjs` |
| `seedling_generated_room` (`generated`) | `SEEDLING_GENERATED_ROOM_STATE` | Two generated rooms in a spiral; delivery, check, room to room. | `check-seedling-generated-room-play.mjs` |
| `seedling_generated_leaf` (`generated-leaf`) | `SEEDLING_GENERATED_LEAF_STATE` | A generated sphere leaf holding `victory`. | `check-seedling-generated-leaf-play.mjs` |
| `seedling_generated_host` (`generated-host`) | `SEEDLING_GENERATED_HOST_STATE` | A generated start room hosting a gated door. | `check-seedling-generated-host-play.mjs` |
| `seedling_generated_swim` (`generated-swim`) | `SEEDLING_GENERATED_SWIM_STATE` | A generated `post-swim` room behind a maze gate on `Progressive Swim`; its watergate swum to `victory`. | `check-seedling-generated-swim-play.mjs` |

The compiled starter atlas (`seedling_atlas`) is played by `check-seedling-atlas-play.mjs`. Several states also ship as pipeline-panel presets (`shipped:seedling-generated-room-demo`, `shipped:seedling-generated-leaf-demo`, `shipped:seedling-generated-host-demo`, `shipped:seedling-generated-swim-demo`, `shipped:seedling-atlas-host-demo`); see [Pipeline Presets](./pipeline-presets.md).

Headless rows sit beside the code, e.g. `flashPanel/seedling*World.test.js`, `seedlingDoorGate.test.js` and `seedlingDemo/seedlingGenRoom*.test.js`.

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Bounce Substrate](./bounce.md) (built on the flash factory) · [Sphere Growth](./sphere-growth.md) · [Maze Substrate](./maze.md)
