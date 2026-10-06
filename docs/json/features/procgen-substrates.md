# What each substrate can do

A **substrate** is the small game engine that owns one region of a generated world — a maze, a platformer level, a text adventure room, an embedded game. They are not interchangeable: some can be walked by the Playback Bot, some can be grown to order by the pipeline, some only run in loop mode. This page says what you can do with each one.

How to read a cell: **✓** is always something you *can* do — no row is phrased as a limitation — and a word or number next to it says how, or how much. **✗** means you cannot, with the reason when the substrate declares one. **◐** is a partial answer, with the degree beside it. **n/a** means the row does not apply: a row it depends on is ✗ (there is no "how a replay works" for a substrate you cannot record), or the question has no answer for that substrate (there is no count of ready-made rooms for one that grows each room to order).

Everything below this paragraph is generated from the code: each row is a question put to every substrate's registry entry, so the chart changes when a substrate does. The field-by-field view a developer reads is the capability matrix in the [substrate registry reference](../developer/procgen/substrate-registry.md#capability-matrix).

The columns here are in id order. In the app, every list of substrates — the pipeline's pickers, the APWorld Editor's Initialise select and room-editor links, the Substrate Registry panel — follows the order you choose with the **Columns** controls of the Substrate Registry panel's Matrix mode (▲ ▼; **Registry order** goes back to id order). The order is saved as a setting, `moduleSettings.substrateRegistryPanel.substrateOrder`.

<!-- GENERATED:substrate-capability-chart BEGIN — by scripts/procgen/generate-procgen-reference.mjs; do not edit; regenerate -->

**29 statements · 10 substrates · 38 registry fields read (41 of the developer matrix's 88, counting the parents of the fields read) · 47 not yet read.**

## Play

| | What you can do | Bounce Demo | Flash | Seedling (region atlas) | Seedling (generated room) | JtA | Maze | Noiz2sa | Idle Loops | Runner Demo | Text Adventure |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | You can play its regions by hand | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| P2 | The Playback Bot can walk it (replaying a world's solution) | ✓ | ✗ | ◐ with the Flash Panel's JS runtime, or its wasm runtime | ◐ with the Flash Panel's JS runtime, or its wasm runtime | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| P3 | It draws its own picture on the composite map (else a labelled box) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| P4 | It brings progression items of its own | ✓ Right arrow, Left arrow, Springs, Jetpacks, Blue platforms, Brown platforms, Victory | ✗ | ✗ | ✓ Progressive Sword, Progressive Shield, Progressive Swim | ✓ 48 items | ✓ Red Key, Green Key, Blue Key, Yellow Key, Purple Key, Orange Key | ✓ Victory, Noiz2sa Star | ✓ Victory | ✓ Double Jump, Blue Platforms, Springs, Glide, Shield, Victory | ✗ |
| P5 | What the generator may do with it | ✓ locations placed anywhere | ✓ locations placed anywhere | ✓ locations placed anywhere | ✓ locations placed anywhere | ✓ its own map becomes the region graph, locations placed anywhere | ✓ item-locked gates, exits on the four sides, its own map becomes the region graph, locations placed anywhere, any rule on a location, any rule on an exit | ✓ locations placed anywhere | ✓ its own map becomes the region graph, locations placed anywhere | ✓ locations placed anywhere | ✓ item-locked gates, exits on the four sides, its own map becomes the region graph, locations placed anywhere, any rule on a location, any rule on an exit |
| P6 | It can show the library's concepts in its own way | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ 4 concepts: sword (mechanic), swim (mechanic), guardian (skin), … | ✗ | ✗ | ✗ | ✓ 4 concepts: sword (mechanic), swim (mechanic), guardian (mechanic), … |

## Loop mode

| | What you can do | Bounce Demo | Flash | Seedling (region atlas) | Seedling (generated room) | JtA | Maze | Noiz2sa | Idle Loops | Runner Demo | Text Adventure |
|---|---|---|---|---|---|---|---|---|---|---|---|
| L1 | You can play it in loop mode | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| L2 | What you can queue for it | ✓ moves between regions, location checks | ✓ moves between regions | ✓ moves between regions | ✓ moves between regions | ✓ moves between regions | ✓ moves between regions, location checks, exploring | ✓ moves between regions, location checks | ✓ moves between regions | ✓ moves between regions, location checks | ✓ moves between regions, location checks, exploring |
| L3 | You can record a visit and replay it | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| L4 | How a replay works | ✓ applies the result instantly | n/a | n/a | n/a | ✓ replays your exact moves | ✓ replays your exact moves | ✓ applies the result instantly | ✓ replays your exact moves | ✓ applies the result instantly | ✓ re-runs the queued actions |
| L5 | Instant fast-forward | ✓ always — a replay is already instant | ✗ | ✗ | ✗ | ✓ a per-block toggle | ✓ a per-block toggle | ✓ always — a replay is already instant | ✓ a per-block toggle | ✓ always — a replay is already instant | ✓ a per-block toggle |
| L6 | A Bot block can play it for you | ✓ the game's own automation walks it | ✗ | ✗ | ✗ | ✓ the game's own automation walks it | ✓ the substrate walks it itself | ✓ the game's own automation walks it | ✓ the game's own automation walks it | ✓ the game's own automation walks it | ✗ |
| L7 | The Bot honours Instant | n/a | n/a | n/a | n/a | ✓ | ✗ | n/a | ✓ | n/a | n/a |
| L8 | You can play it outside loop mode | ✓ | ✓ | ✓ | ✓ | ✗ (note 1) | ✓ | ✓ | ✗ (note 2) | ✓ | ✓ |
| L9 | It shares the loop-mode mana pool | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | ✓ |
| L10 | It shares consumable items with other substrates | ✗ | ✗ | ✗ | ✗ | ✓ its list comes from the running game — see the Substrate Registry panel | ✗ | ✗ | ✓ 18 item types: gold, reputation, herbs, … | ✗ | ✗ |
| L11 | Recorded actions are named in the game's own words | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |

1. JtA: loop mode stays on — it declares `loopSupport.requiresLoopMode`
2. Idle Loops: loop mode stays on — it declares `loopSupport.requiresLoopMode`

## Generate

| | What you can do | Bounce Demo | Flash | Seedling (region atlas) | Seedling (generated room) | JtA | Maze | Noiz2sa | Idle Loops | Runner Demo | Text Adventure |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | The pipeline can build regions of it | ✓ picked from its own levels to fit the plan | ✗ only as content from its own game | ✓ picked from its own levels to fit the plan | ✓ grown to order | ✗ only as content from its own game | ✓ grown to order | ✗ only as content from its own game | ✗ only as content from its own game | ✓ picked from its own levels to fit the plan | ✓ grown to order |
| G2 | How many ready-made rooms / levels it brings | ✓ 5 | ✗ | ✓ 4 Atlas rooms | n/a | ✓ 30 | n/a | ✓ 3 Noiz2sa segments | ✓ 1 | ✓ 6 | n/a |
| G3 | Generates quickly | ✓ | n/a | ✓ | ✓ | n/a | ✓ | n/a | n/a | ✗ its generation cost is declared `heavy` | ✓ |
| G4 | Its rooms can be captured into a library and reused | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ |
| G5 | Exits can be locked behind items | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ |
| G6 | It has its own settings in the generation form | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | ✗ |
| G7 | A world of it can start with an empty inventory | ✗ (note 1) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| G8 | Any number of locations fits in one room | n/a | n/a | n/a | ✗ (note 2) | n/a | ✗ (note 3) | n/a | n/a | n/a | ✓ |

1. Bounce Demo: a world starts with one of Left arrow / Right arrow — a bounce level cannot gate both arrows in one region, and hosts at most one arrowless-gated exit — the sphere route grants one arrow at the start for this reason
2. Seedling (generated room): a room holds `capacityAt(size)` of them — the room grows to hold more, up to 30 (the game's 30 persistence tags), which no size lifts
3. Maze: a room holds `capacityAt(size)` of them — the room grows to hold more

## Edit

| | What you can do | Bounce Demo | Flash | Seedling (region atlas) | Seedling (generated room) | JtA | Maze | Noiz2sa | Idle Loops | Runner Demo | Text Adventure |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E1 | Its rooms can be edited | ✓ in a panel | ✗ | ✓ on a lab page | ✓ on a lab page | ✗ | ✓ on a lab page | ✗ | ✗ | ✗ | ✗ |
| E2 | A region of a saved world can be opened in an editor and saved back | ✓ | ✗ | ✗ (note 1) | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✓ |
| E3 | An exit can be moved to another side (and a side can hold more than one) | ◐ one exit per side | ✗ | ✓ and a side can hold more than one | ✓ and a side can hold more than one | ✓ and a side can hold more than one | ✗ | ✓ and a side can hold more than one | ✓ and a side can hold more than one | ◐ one exit per side | ✓ and a side can hold more than one |
| E4 | The editor's validity report checks its location and exit names | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

1. Seedling (region atlas): a Seedling sidecar payload is an ATLAS REFERENCE (`atlas_ref` / `atlas_region` / `atlas_sub_region` / `level`), not an authored room record — the room lives in the level set and the atlas that the region marking tool and `watch.html` own, and a rules.json carries neither, so there is no one-room document to hand the lab's edit arm.

## Fields behind each row

Each row is answered from these fields of the substrate's registry entry — the names in the developer matrix.

- **P1** — `panelComponentType`, `deserializeWorld`
- **P2** — `getPlaybackController`, `playbackScope`
- **P3** — `compositeMap.drawRegion`
- **P4** — `libraryItems`, `supportedFeatures`
- **P5** — `supportedFeatures`
- **P6** — `conceptRealisations`
- **L1** — `loopSupport.manual`
- **L2** — `loopSupport.queueActions`
- **L3** — `loopSupport.record`, `loopSupport.playback`
- **L4** — `takeLastRecording`, `loopSupport.summaryRecording`
- **L5** — `loopSupport.instant`, `loopSupport.summaryRecording`
- **L6** — `loopSupport.executeVia`, `sharing.mana.loopActionDelegation`
- **L7** — `loopSupport.instant`, `loopSupport.executeVia`, `takeLastRecording`, `loopSupport.summaryRecording`
- **L8** — `loopSupport.requiresLoopMode`
- **L9** — `sharing.mana`
- **L10** — `sharing.items`
- **L11** — `describeAction`
- **G1** — `generateRegionCore`, `generateZoneForSpecs`, `generateZoneForSpecsGen`
- **G2** — `zoneCount`, `zoneSourceLabel`, `generateRegionCore`
- **G3** — `generationCost`
- **G4** — `captureLibraryEntry`, `instantiateLibraryEntry`
- **G5** — `canHostExitGates`, `supportedFeatures`
- **G6** — `renderProcgenParams`
- **G7** — `startingInventory`
- **G8** — `locationCapacity`
- **E1** — `roomEditor`
- **E2** — `regionRoundTrip`
- **E3** — `exitSides`
- **E4** — `apLocationNamesOf`, `apExitNamesOf`

## Each substrate on its own

What each one lets you do — its ✓ and degree cells from the tables above, in the same order.

### Bounce Demo

- *Play* — You can play its regions by hand
- *Play* — The Playback Bot can walk it (replaying a world's solution)
- *Play* — It brings progression items of its own: Right arrow, Left arrow, Springs, Jetpacks, Blue platforms, Brown platforms, Victory
- *Play* — What the generator may do with it: locations placed anywhere
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions, location checks
- *Loop mode* — You can record a visit and replay it
- *Loop mode* — How a replay works: applies the result instantly
- *Loop mode* — Instant fast-forward: always — a replay is already instant
- *Loop mode* — A Bot block can play it for you: the game's own automation walks it
- *Loop mode* — You can play it outside loop mode
- *Generate* — The pipeline can build regions of it: picked from its own levels to fit the plan
- *Generate* — How many ready-made rooms / levels it brings: 5
- *Generate* — Generates quickly
- *Generate* — Its rooms can be captured into a library and reused
- *Generate* — Exits can be locked behind items
- *Generate* — It has its own settings in the generation form
- *Edit* — Its rooms can be edited: in a panel
- *Edit* — A region of a saved world can be opened in an editor and saved back
- *Edit* — An exit can be moved to another side (and a side can hold more than one): one exit per side
- *Edit* — The editor's validity report checks its location and exit names

### Flash

- *Play* — You can play its regions by hand
- *Play* — What the generator may do with it: locations placed anywhere
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions
- *Loop mode* — You can play it outside loop mode
- *Generate* — A world of it can start with an empty inventory
- *Edit* — The editor's validity report checks its location and exit names

### Seedling (region atlas)

- *Play* — You can play its regions by hand
- *Play* — The Playback Bot can walk it (replaying a world's solution): with the Flash Panel's JS runtime, or its wasm runtime
- *Play* — What the generator may do with it: locations placed anywhere
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions
- *Loop mode* — You can play it outside loop mode
- *Generate* — The pipeline can build regions of it: picked from its own levels to fit the plan
- *Generate* — How many ready-made rooms / levels it brings: 4 Atlas rooms
- *Generate* — Generates quickly
- *Generate* — Exits can be locked behind items
- *Generate* — It has its own settings in the generation form
- *Generate* — A world of it can start with an empty inventory
- *Edit* — Its rooms can be edited: on a lab page
- *Edit* — An exit can be moved to another side (and a side can hold more than one): and a side can hold more than one

### Seedling (generated room)

- *Play* — You can play its regions by hand
- *Play* — The Playback Bot can walk it (replaying a world's solution): with the Flash Panel's JS runtime, or its wasm runtime
- *Play* — It brings progression items of its own: Progressive Sword, Progressive Shield, Progressive Swim
- *Play* — What the generator may do with it: locations placed anywhere
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions
- *Loop mode* — You can play it outside loop mode
- *Generate* — The pipeline can build regions of it: grown to order
- *Generate* — Generates quickly
- *Generate* — Exits can be locked behind items
- *Generate* — It has its own settings in the generation form
- *Generate* — A world of it can start with an empty inventory
- *Edit* — Its rooms can be edited: on a lab page
- *Edit* — An exit can be moved to another side (and a side can hold more than one): and a side can hold more than one
- *Edit* — The editor's validity report checks its location and exit names

### JtA

- *Play* — You can play its regions by hand
- *Play* — The Playback Bot can walk it (replaying a world's solution)
- *Play* — It brings progression items of its own: 48 items
- *Play* — What the generator may do with it: its own map becomes the region graph, locations placed anywhere
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions
- *Loop mode* — You can record a visit and replay it
- *Loop mode* — How a replay works: replays your exact moves
- *Loop mode* — Instant fast-forward: a per-block toggle
- *Loop mode* — A Bot block can play it for you: the game's own automation walks it
- *Loop mode* — The Bot honours Instant
- *Loop mode* — It shares the loop-mode mana pool
- *Loop mode* — It shares consumable items with other substrates: its list comes from the running game — see the Substrate Registry panel
- *Loop mode* — Recorded actions are named in the game's own words
- *Generate* — How many ready-made rooms / levels it brings: 30
- *Generate* — A world of it can start with an empty inventory
- *Edit* — An exit can be moved to another side (and a side can hold more than one): and a side can hold more than one
- *Edit* — The editor's validity report checks its location and exit names

### Maze

- *Play* — You can play its regions by hand
- *Play* — The Playback Bot can walk it (replaying a world's solution)
- *Play* — It draws its own picture on the composite map (else a labelled box)
- *Play* — It brings progression items of its own: Red Key, Green Key, Blue Key, Yellow Key, Purple Key, Orange Key
- *Play* — What the generator may do with it: item-locked gates, exits on the four sides, its own map becomes the region graph, locations placed anywhere, any rule on a location, any rule on an exit
- *Play* — It can show the library's concepts in its own way: 4 concepts: sword (mechanic), swim (mechanic), guardian (skin), …
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions, location checks, exploring
- *Loop mode* — You can record a visit and replay it
- *Loop mode* — How a replay works: replays your exact moves
- *Loop mode* — Instant fast-forward: a per-block toggle
- *Loop mode* — A Bot block can play it for you: the substrate walks it itself
- *Loop mode* — You can play it outside loop mode
- *Loop mode* — It shares the loop-mode mana pool
- *Loop mode* — Recorded actions are named in the game's own words
- *Generate* — The pipeline can build regions of it: grown to order
- *Generate* — Generates quickly
- *Generate* — Its rooms can be captured into a library and reused
- *Generate* — Exits can be locked behind items
- *Generate* — It has its own settings in the generation form
- *Generate* — A world of it can start with an empty inventory
- *Edit* — Its rooms can be edited: on a lab page
- *Edit* — A region of a saved world can be opened in an editor and saved back
- *Edit* — The editor's validity report checks its location and exit names

### Noiz2sa

- *Play* — You can play its regions by hand
- *Play* — The Playback Bot can walk it (replaying a world's solution)
- *Play* — It brings progression items of its own: Victory, Noiz2sa Star
- *Play* — What the generator may do with it: locations placed anywhere
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions, location checks
- *Loop mode* — You can record a visit and replay it
- *Loop mode* — How a replay works: applies the result instantly
- *Loop mode* — Instant fast-forward: always — a replay is already instant
- *Loop mode* — A Bot block can play it for you: the game's own automation walks it
- *Loop mode* — You can play it outside loop mode
- *Generate* — How many ready-made rooms / levels it brings: 3 Noiz2sa segments
- *Generate* — It has its own settings in the generation form
- *Generate* — A world of it can start with an empty inventory
- *Edit* — An exit can be moved to another side (and a side can hold more than one): and a side can hold more than one
- *Edit* — The editor's validity report checks its location and exit names

### Idle Loops

- *Play* — You can play its regions by hand
- *Play* — The Playback Bot can walk it (replaying a world's solution)
- *Play* — It brings progression items of its own: Victory
- *Play* — What the generator may do with it: its own map becomes the region graph, locations placed anywhere
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions
- *Loop mode* — You can record a visit and replay it
- *Loop mode* — How a replay works: replays your exact moves
- *Loop mode* — Instant fast-forward: a per-block toggle
- *Loop mode* — A Bot block can play it for you: the game's own automation walks it
- *Loop mode* — The Bot honours Instant
- *Loop mode* — It shares the loop-mode mana pool
- *Loop mode* — It shares consumable items with other substrates: 18 item types: gold, reputation, herbs, …
- *Loop mode* — Recorded actions are named in the game's own words
- *Generate* — How many ready-made rooms / levels it brings: 1
- *Generate* — A world of it can start with an empty inventory
- *Edit* — An exit can be moved to another side (and a side can hold more than one): and a side can hold more than one
- *Edit* — The editor's validity report checks its location and exit names

### Runner Demo

- *Play* — You can play its regions by hand
- *Play* — The Playback Bot can walk it (replaying a world's solution)
- *Play* — It brings progression items of its own: Double Jump, Blue Platforms, Springs, Glide, Shield, Victory
- *Play* — What the generator may do with it: locations placed anywhere
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions, location checks
- *Loop mode* — You can record a visit and replay it
- *Loop mode* — How a replay works: applies the result instantly
- *Loop mode* — Instant fast-forward: always — a replay is already instant
- *Loop mode* — A Bot block can play it for you: the game's own automation walks it
- *Loop mode* — You can play it outside loop mode
- *Generate* — The pipeline can build regions of it: picked from its own levels to fit the plan
- *Generate* — How many ready-made rooms / levels it brings: 6
- *Generate* — Its rooms can be captured into a library and reused
- *Generate* — Exits can be locked behind items
- *Generate* — It has its own settings in the generation form
- *Generate* — A world of it can start with an empty inventory
- *Edit* — An exit can be moved to another side (and a side can hold more than one): one exit per side
- *Edit* — The editor's validity report checks its location and exit names

### Text Adventure

- *Play* — You can play its regions by hand
- *Play* — The Playback Bot can walk it (replaying a world's solution)
- *Play* — It draws its own picture on the composite map (else a labelled box)
- *Play* — What the generator may do with it: item-locked gates, exits on the four sides, its own map becomes the region graph, locations placed anywhere, any rule on a location, any rule on an exit
- *Play* — It can show the library's concepts in its own way: 4 concepts: sword (mechanic), swim (mechanic), guardian (mechanic), …
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions, location checks, exploring
- *Loop mode* — You can record a visit and replay it
- *Loop mode* — How a replay works: re-runs the queued actions
- *Loop mode* — Instant fast-forward: a per-block toggle
- *Loop mode* — You can play it outside loop mode
- *Loop mode* — It shares the loop-mode mana pool
- *Generate* — The pipeline can build regions of it: grown to order
- *Generate* — Generates quickly
- *Generate* — Exits can be locked behind items
- *Generate* — A world of it can start with an empty inventory
- *Generate* — Any number of locations fits in one room
- *Edit* — A region of a saved world can be opened in an editor and saved back
- *Edit* — An exit can be moved to another side (and a side can hold more than one): and a side can hold more than one
- *Edit* — The editor's validity report checks its location and exit names

## Fields no statement reads yet

47 fields of the developer matrix are not behind any row above — plumbing a person does not choose a substrate by, or a capability not yet put into words:

`applyContentModules`, `applyPipelineConfig`, `backPortalGated`, `buildLibraryRegionParams`, `buildRegionContract`, `buildRegionParams`, `buildZoneSpecs`, `canHostExitGatesBraid`, `defaultProcgenParams`, `driftItems`, `emitsSpiralContent`, `exitGateVeto`, `extractPathsAndObstacles`, `extractZoneRules`, `gateHostingHint`, `gateableItems`, `getSpiralContent`, `hostsSurplusExitsNatively`, `id`, `iframeId`, `instantiateAtlasEntryForSpecs`, `instantiateLibraryEntryForSpecs`, `label`, `libraryEntryRefusal`, `loadRegionEvent`, `loopSupport.customQueues`, `loopSupport.playClock`, `onContentEdit`, `pipelineConfigFromParams`, `pipelineConfigKeys`, `placeFromItems`, `placeFromRules`, `prepareSphereGrowth`, `priceRegions`, `procgenParamsFromPayload`, `recordablePipelineConfig`, `regionGeometry`, `renderLibraryProcgenParams`, `restartWarp`, `rulesJsonBlocks`, `serializeWorld`, `sidecarFields`, `spiralContentConfigKey`, `validateLibraryEntry`, `victoryItem`, `zoneConfigFromSlot`, `zoneOfPayload`

<!-- GENERATED:substrate-capability-chart END -->
