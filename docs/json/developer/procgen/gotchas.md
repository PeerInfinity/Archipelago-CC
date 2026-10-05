# Procgen Gotchas and Disambiguations

Short entries for the things most likely to mislead someone working in the procgen code: each names the misreading, states the fact, and points at the file or doc that owns it.

## Pipeline and generation

### "Braid" is not a pipeline driver

The pipeline's Mode toggle offers four drivers: grid growth, sphere growth, shuffled spiral and top-down (`frontend/modules/procgenPipeline/procgenPipelineUI.js`). "Braid" is a bounce level-generation regime inside `frontend/modules/bounceDemo/generator.js`: the 2-wide branching-path geometry bounce uses for its zones, with Regime 1 (movement arrows free) and Regime 2 (abilities gated as items). Braid code runs inside a driver's realisation of a bounce region, never as a layout mode of its own.

### Byte-identity is a load-bearing invariant

The stepped pipeline must reproduce the one-shot drivers' output byte for byte, so any added, removed or reordered `rng()` draw in generation code breaks it silently. The contract and its checks live in [The byte-identity contract](./stepped-pipeline.md#the-byte-identity-contract).

### Generation budgets count ticks, not wall-clock time

A Seedling solve is bounded only by properties of the candidate (`maxTicksPerTarget`, and the dash planner's internal expansion cap), so a level generated on a busy machine is the level a quiet machine produces. `assertBudget` in `frontend/modules/seedlingDemo/procgenOracle.js` refuses a budget that carries `wallClockMs` rather than ignoring it. Tests that measure elapsed time still depend on machine load, so check load before trusting a timing-only red. Background: [`CC/docs/plans/procgen-deterministic-budget.md`](../../../../CC/docs/plans/procgen-deterministic-budget.md).

### "The `empty` pairs are unchanged" is a gate only for a change that spends no draw

The Seedling seed→level pair dumps (`scripts/procgen/dump-seedling-kind-pairs.mjs`) answer one question: did this change move a draw? Anything that changes the template roster or the draw order moves every kind's pairs, `empty` included, because `rng.pick` lands elsewhere. Decide first whether your change spends a draw. If it does, prove the part you believe is inert with a control run in a worktree at the base commit, or by counting draws (`model.roomDraws` in `procgenSeedling.js`), not by comparing tiles. See [Seedling Real-Game Bot](./seedling-bot.md).

### A payload-shape mover and a behaviour mover are indistinguishable in an md5

A moved artifact hash says something changed, not what kind of thing. Adding a field that reaches a printed payload (for example `certification.geometry`) moves the hash of rows whose generated tiles did not change at all. Before calling an md5 move a behaviour change, diff the rows against a worktree at the base commit and read what differs.

### A schema default is a spelling rule, not a construction rule

`CHAMBERS_PARAM.default` in `frontend/modules/procgenCore/skeletonKinds.js` decides which parameters a URL spells out, not what gets built: `carveSkeleton` adds the chamber post-processor only when the value is off its default, so moving the default changes the URL spelling and leaves the maze byte-identical. The construction knob for Seedling is `SEEDLING_PARAM_DEFAULTS` (`chambers: 1`), applied by `seedlingSkeletonSpec` in `procgenSeedling.js` before normalisation. Because `winding` and `winding;chambers=0` normalise to the same object, the URL reader hands the resolver the string as typed, and the writer spells the parameter explicitly.

### A component flood cannot see a one-way mechanic, and it lies optimistically

A flood fill (`componentsOf` in `scripts/procgen/seedlingRouteGraph.mjs`) treats adjacency as symmetric, so every directed mechanic is invisible to it and the error is always permissive: the graph promises a route the walk cannot take. Seedling examples are a waterfall you cannot climb without the feather, and a lock whose opening button is only on one side.

- List the mechanics that move or resist the player and ask which are directed.
- Model a directed mechanic as a refusal on the step, never on the cell: a waterfall is crossed downward all the time. See `climbsArmedWaterfall` in `frontend/modules/seedlingDemo/botDriverV2.js`.
- Check with a directed flood (the same BFS with the edge predicate) against the undirected one.
- Two one-way branches can be mutually exclusive; sweep each opener alone and all together before reporting a route.

### Generating a procgen world in-page can time out every iframe

`arrangeShuffledSpiral` and `buildRulesJson` (`procgenPipelineEngine.js`) run synchronously on the main thread, and expensive substrates' level generators can block it for minutes. The iframe adapter then declares every substrate bridge dead on heartbeat timeout, and an unrelated test fails. Cheap substrates are fine (`taswBlockModeTests.js` builds a spiral in-page); for an expensive one load a committed preset and generate only the piece you need, as `runnerBlockModeTests.js` does with `runner_worldgen` and `generateLoopCosts`.

## Substrates and runtime

### bounceDemo shares flashSubstrate's code, not its identity

`bounceDemo` has no panel class of its own: its entry is built by `createFlashSubstrateEntry(...)` and its panel comes from `flashSubstrate`'s panel factory and bridge. It registers its own routing identity, though: component type `bounceDemoPanel`, load event `bounce:loadRegion`, iframe id `bounceDemo` (`frontend/modules/bounceDemo/bounceDemoLibrary.js`). Bounce region loads never configure the flash panel's bridge, and host activation brings the bounce panel forward.

### Substrate libraries register on import — headless scripts depend on it

Each substrate library that owns a registry entry ends with the same guarded block:

```js
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
```

The libraries are `mazeRoomLibrary.js`, `bounceDemoLibrary.js`, `runnerDemoLibrary.js`, `textAdventureSubstrateWrapperLibrary.js`, `flashSubstrateLibrary.js`, `jtaSubstrateWrapperLibrary.js`, `omsiSubstrateWrapperLibrary.js`, `flashSeedlingLibrary.js` and `flashSeedlingGenLibrary.js`; `rg -a -l "substrateRegistry.register\(substrateRegistryEntry\)" frontend/modules` lists them with their `index.js` twins. The app registers from each module's `register()`, but headless scripts (`scripts/procgen/*.js`, `scripts/utils/generate-topdown-preset.js`) and engine tests never run `register()`: they get substrates only by importing the libraries.

**Warning:** a substrate that is not registered is not an error. The pipeline skips regions that ask for it, so a script writes a world missing that substrate and exits 0. When you change such an import, assert the registry holds the id afterwards, and check the entry's shape, not just its presence.

### procgenPlayer has no panel

`frontend/modules/procgenPlayer/` recognises a procgen `rules.json` and routes every region transition at play time, but never appears in the layout. It is a headless coordinator: it builds the region warehouse from `preset_sidecars` and publishes each substrate's `loadRegion` event. If play-time routing misbehaves, look here before the substrate panels.

### Which substrates are live depends on the launch mode

`frontend/modes.json` maps each launch mode to a module config in `frontend/module-configs/` (`modules.json`, `modules-nograph.json`, `modules-flash.json`, …), and each enables a different module set; the spoiler-test configs omit the substrate runtimes entirely. When a substrate "is not registered", check which mode the app was launched with before debugging the registry.

### A substrate's replay can depend on a module the config disables

jta's Playback runs its recording through the `jtaQueueEngine` executor (`getEngine()` in `frontend/modules/jtaSubstrateWrapper/index.js`). In a config where that module is disabled, the replay falls back to crossing the recorded exit, which looks from the queue like a working replay. Enable a delegated-to module in every config its substrate runs in, and have replay tests assert the recorded actions were performed, not only that the region changed.

### In managed mode JtA never advances its own zone

The host owns zone transitions, so the fork's `onFullyFinishTask` fires the travel callback and never calls `advanceZone()`; engine code that waits for the zone to change by itself loops forever. `setAutomationEndZone` does not confine a headless driver to a zone range either. The full list is in [Managed-mode zone invariants](./jta.md#managed-mode-zone-invariants).

### A frozen substrate cannot generate the reset that unfreezes it

When the host is the only reset authority, a bridge must never pin a resource in a way that hides the condition the host uses to decide a reset is due. JtA's energy latch is the worked case: see [The energy-reset latch](./jta.md#the-energy-reset-latch).

### `shared/` is a git submodule

`frontend/modules/shared/` (the substrate registry, rng and procgen primitives) is one of eight git submodules; `.gitmodules` lists them all. `git log` and `git blame` from the outer repo do not see submodule commits, so run git inside the submodule directory. A change there is committed inside the submodule, then the outer repo's pointer is bumped in a separate commit.

## Loop mode

### One loop-cost engine, one store — and the debugger is its inspector

Four files deal with loop-mode costs, and only one of them is the model:

| File | Role |
|---|---|
| `frontend/modules/shared/procgen/loopCostPlanner.js` | The model. Pure and headless: simulates a playthrough over the sphere log, prices each region just in time from the mana left when the walk reaches it, prices explore at `DEFAULT_EXPLORE_MULTIPLIER` × the region's cost, then fills defaults for regions the log never reached. Reads a topology (`topologyFromRulesJson`), never a state manager. |
| `frontend/modules/shared/procgen/loopCostGenerator.js` | The block producer (`generateLoopCosts`). Builds the topology, plans, and applies write-by-class. The pipeline calls it at compile time. |
| `frontend/modules/loopsCostDebugger/costPlanner.js` | Driver and inspector. `CostPlanner` extends the shared planner and supplies the state manager, the player id (via `sphereState`) and each region's substrate (via `procgenPlayer.getRegionInfo`). The Loops panel's Generate Costs and the auto-generate on entering loop mode run it, and it stamps the same block the pipeline embeds. |
| `frontend/modules/loops/costDataManager.js` | The runtime store the block is loaded into and the loop simulation reads from. A loaded block is also the loop-mode switch. |

`scripts/procgen/check-loop-costs-one-model.mjs` asserts that the pipeline and runtime produce byte-equal blocks over real documents; it is a differential, so it stays green if both sides are wrong the same way. `loopCostGenerator.test.js` pins the numbers.

The simulation prices every region as if it were coarse; what reaches the block depends on the region's class, decided by `classifyRegion` from the substrate's registry entry:

| Class | Substrates | What the block holds |
|---|---|---|
| coarse | no substrate, text adventure, maze | `{moveCost, xpEffect}` plus its locations' costs |
| summary | runner, bounce (`loopSupport.summaryRecording`) | `{timeDrainPerSecond, xpEffect}` only; a per-action cost would be charged on top of the time drain |
| native | jta, omsi | nothing; their resource-channel router charges the pool with no region attached |

**Note:** maze is coarse even though it has a recorder and declares `sharing.mana`, because it sets `sharing.mana.loopActionDelegation` and hands the loop action back to the host (`mazeRoomUI._perTileMoveCost` divides the region's `moveCost` by `longestShortestPath`). Text adventure also declares `sharing.mana` but has no recorder. The start region's move is free by rule (`START_REGION_MOVE_COST` in `loopCostDefaults.js`), and `loopState._calculateActionCost` applies that rule itself, whatever the block says.

### Two reset flows

Loop mode resets through `gameState.triggerLoopReset()` (`gameState:loopReset`, substrate-driven) and `loopState._resetLoop()` (`loopState:loopReset`, loops-internal). Anything added to one must be checked against the other; see [Two reset flows](./loop-recording.md#two-reset-flows). Automated multi-run walks also need `autoRestartQueue` on: [`autoRestartQueue` governs the resets loops owns](./loop-recording.md#autorestartqueue-governs-the-resets-loops-owns).

## Level sets and room editors

### Re-validating a document that is being edited reads a correct session as broken

`validateLevelSet` (`frontend/modules/seedlingDemo/levelSetValidator.js`) refuses a set whose identity stamp and content disagree, and that is true of every set mid-edit, because the stamp is applied once, at download. Validate a document when it arrives; after that the op list is the authority until the next stamp.

### Two `set_id`s can describe the same 116 rooms, and only one is the save stamp's

The vanilla Seedling rooms exist as two level sets with the same rooms by value and different ids:

| Set | Rooms are | Id | Used by |
|---|---|---|---|
| `fixtures/seedling-vanilla-set.json` | `embed` paths into the SWF | `seedling-vanilla-<hash>` | `VanillaSet.SET_ID` in the AS3, every save stamp, the `?source=edit&level=N` atlas base |
| `levelSetExporter.vanillaRecordSet` | JSON `record`s | `seedling-vanilla-record-<hash>` | the set editor; `provenance.derived_from` names the embed id |

They are not interchangeable. `stampLevelSetIdentity` rebuilds `<base>-<hash>` around the same base on every re-stamp, so the different bases are what keep a derived set from ever claiming to be the one save files name.

### A level set carries JSON records, and OEL exists only inside a chunk

A room's `source` is exactly one of `record`, `xml` or `embed`. The exporter writes `record` (`{width, height, layers, entities}`, what `parseOelLevel` returns and `recordToOel` accepts), and `planLevelSetChunks` renders each to `{xml}` for delivery because the AS3 receiver reads `room.source.xml` (`vendor/seedling/src/LevelSet.as`). So a set with an `xml` room is legacy, a chunk with a `record` room will not load, and the chunk size bound is measured after rendering. `xml` is still accepted everywhere and no edit converts a room's kind. Do not route legacy `xml` text through `parseOelLevel`: those rooms are reduced OEL with no geometry, which is why `indexOfRoom` keeps a lenient reader for the text kinds.

### Seedling edit ops and what they address

- A paste accumulates bodies: Seedling's `remove` takes one entity per op, so a paste onto an occupied cell leaves both sets of bodies. The read → write → read fixed point holds for the whole cell only where it was empty.
- `remove` and `attrs` address the last body in the cell. `remove` also takes a `which` in-cell ordinal (`entityIndicesAt` in `watchEdit.js`); `attrs` does not. A caller using an ordinal must read the record once and build the op from that same read, or the ordinal can name a different body.
- Every op path sorts `attrs` keys, so a saved vanilla room is value-identical but byte-different from the shipped `.oel` in any entity an op touched. Compare cell descriptors with `editCore.canonicalJson`, never a bare `JSON.stringify`.

### Set-editor op invariants

Each of these is enforced by name; a new op or page should follow the same rules.

- `set-access-rule` refuses a target that gates nothing (the arrival end of a `one_way` connection) using `setEditorCore.gateabilityOf`, the same function that marks offered targets. `set-overlay` writes whole room entries unchecked, so `inertRulesOf` still reports inert rules.
- A set whose atlas cannot be derived throws `SeedlingSetDeriveRefusal` from `deriveAtlasOf` (`seedlingSetAdapter.js`), so ops and readouts see the same refusal class; a `TypeError` still escapes as a defect.
- `disconnect` refuses while a marked location names the exit entity (matched on coordinates) and points at `unmark-location`.
- `createEmptyAtlas` (`regionMarkingTool/atlasSession.js`) requires `game`; there is no default substrate.
- `createSetOverlay` takes `locationNameScope` (`'set'` by default). Seedling declares `'room'` because its derivation prefixes the room into each location name; the maze emits names verbatim and keeps set-wide uniqueness.
- Session results carry the adapter's refusal class as `reason` only when the adapter gave one; the core never invents it.
- The set editor's download handlers call `pressScope` first, nulling the readout family and advancing `__editorSetBundlePresses` / `__editorSetRulesPresses`. Drivers wait for the counter to reach `n + 1`, never for a key to exist.

### A class table's `as3: null` answers construction, never reach

`levelWorld.ENTITY_CLASSES` marks the Seedling room-flag tags `as3: null`: they are flags `loadlevel` reads, not entities the model builds. That does not mean the JS model ignores them. `<control>`'s `fallthrough` is read by `Player.checkFallingInPit`, so it changes the world. To ask whether the model sees a flag, build the room with and without it and compare. Likewise ask `ENTITY_CLASSES`, not the generator's palette, whether a type is buildable: the palette places a handful of types, the class table transcribes almost everything `vendor/seedling/Shrum.oep` declares.

### A free edge is a logic obligation, not a door — so authoring locations raises the count

`setEditorCore.freeEdgesOf(rules)` counts every compiled edge whose `access_rule` is `True_` or absent, locations as well as exits, because an ungated collectible is a logic obligation too (`frontend/modules/flashPanel/atlases/README.md`). Authoring an overlay therefore raises the count: each lifted location adds an obligation until something gates it. A rising count after authoring is expected, not a regression.

### `level_58` is unreachable over the room data alone

No entity in the vanilla rooms targets region `level_58` (`Dungeon5_DeadBoss`); the game reaches it through the manifest's `named_rooms.tentacle_beast_mouth`, the room the tentacle beast swallows the player into. `deriveAtlas` takes an optional `deps.namedRooms` and derives that arrival from the entry's trigger element. `make-seedling-playthrough-rules.mjs` passes none, on purpose, so the committed playthrough atlas is unchanged; under its `NEVER_ENTER_LEVELS` the only source room (57) is excluded anyway.

### A maze room session opened from a set lives inside the set arm's lifetime

On the maze lab page, a room opened from a region library draws on the same `#canvas` the `edit` arm uses, but switching `#source` to `edit` would retire the set arm and discard the library session. The room session is mounted under the set arm's lifetime instead. `canvasWorld()` in `mazeLabView.js` is the one answer to which world is on the canvas; the ladder's overlays (area graph, element gadget, solve plan) do not draw over a library room; and the room gets its own palette from the entry's `itemLib` / `obstacleLib`. See [Maze substrate](./maze.md).

## Formats and files

### A gunzip keyed on a name or a header double-decodes a file that was never gzipped

GitHub Pages serves presets with `content-encoding: gzip`, and the browser has already decoded the body before our code sees it, so the header is true of a plain-JSON body. `gunzipIfNeeded` (`frontend/modules/presets/documentBundle.js`) sniffs the `1f 8b` magic bytes and nothing else, which makes it safe to run twice. No committed preset is gzipped; `deriveSphereLogPath` (`frontend/modules/spoilerTest/fileLoader.js`) strips a trailing `.gz` before looking for `_rules.json` anyway.

### `json.dumps(indent=0)` is not minified

`JSON.stringify(obj, null, 0)` is minified; Python's `json.dumps(obj, indent=0)` still writes a newline per element. `exporter/exporter.py` maps 0 to `separators=(',', ':')` and writes non-ASCII unescaped, so `_dump_with_compact_sidecar_tiles` matches its JS twin `stringifyRulesJson` (`frontend/modules/shared/rulesJsonBuilder.js`). `test/test_rules_json_writer_agreement.py` pins that agreement. Committed presets are data, not byte-pinned: they are regenerated only on demand by `.github/workflows/generate-presets.yml`. The trailing newline belongs to the write site: the node scripts append one, `Generate.py` does not.

### A bundle holds four documents and nothing derived

A `.zip` bundle's members are the four documents `rules`, `level-set`, `overlay` and `region-atlas`. `readBundle` refuses a `.chunks.json` by name (it is delivery, and a half-delivered set would look whole), carries `.ap-invalidation.json` as a named extra because `apMappingInvalidation` derives it, and refuses two members of one kind.

### A region library's exit knows its side, and the atlas does not take its word for it

A maze region-library exit carries a tile and a `side`. `atlasOps.addExit` derives the side from the tile (`deriveEdgeSide`), and `mazeAtlasDerivation` refuses an entry whose stated `side` disagrees, naming both. An exit's `kind` is the closed enum `edge | teleporter` in `frontend/schema/region-atlas.schema.json`; the maze's crossings are `edge` exits.

There are two maze serializers, and the wrong one fails silently:

| Pair | Purpose | AP names |
|---|---|---|
| `serializeMazeLevel` / `deserializeMazeLevel` (`mazeRoom/procgenMaze.js`) | the lab's level channel: CLI output, lab download and load | none |
| `serializeMazeWorld` (`mazeRoom/mazeSerializer.js`) / `deserializeMazeWorld` (`mazeRoom/mazeRoomEngine.js`) | region-library payloads | baked in |

A lab payload passes through `deserializeMazeWorld` without complaint but loses each exit's `side` and mints an edit on an unedited room. `mazeSetAdapter.closeRoomSession` owns the choice so no page makes it.

### `recordToOel` is not byte-identical to Ogmo's own output

Round trips of the shipped `.oel` rooms are asserted by value. Three known byte differences remain: this writer ends with a newline and Ogmo does not; tiles painted outside the level rectangle are dropped (and counted in `tiles_outside_level`), as the game's loader drops them; and a raw `>` inside an attribute value is escaped as `&gt;`.

## Related documentation

- [Architecture](./architecture.md)
- [Substrate Registry Reference](./substrate-registry.md)
- [The Stepped Pipeline](./stepped-pipeline.md)
- [Loop Recording and Block Modes](./loop-recording.md)
- [JtA Substrate](./jta.md)
- [Maze substrate](./maze.md)
