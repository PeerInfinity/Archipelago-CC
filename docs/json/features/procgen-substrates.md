# What each substrate can do

A **substrate** is the small game engine that owns one region of a generated world — a maze, a platformer level, a text adventure room, an embedded game. They are not interchangeable: some can be walked by the Playback Bot, some can be grown to order by the pipeline, some only run in loop mode. This page says what you can do with each one.

How to read a cell: **✓** is always something you *can* do — no row is phrased as a limitation — and a word or number next to it says how, or how much. **✗** means you cannot, with the reason when the substrate declares one. **◐** is a partial answer, with the degree beside it. **n/a** means the row does not apply because a row it depends on is ✗ (there is no "how a replay works" for a substrate you cannot record).

Everything below this paragraph is generated from the code: each row is a question put to every substrate's registry entry, so the chart changes when a substrate does. The field-by-field view a developer reads is the capability matrix in the [substrate registry reference](../developer/procgen/substrate-registry.md#capability-matrix).

<!-- GENERATED:substrate-capability-chart BEGIN — by scripts/procgen/generate-procgen-reference.mjs; do not edit; regenerate -->

**27 statements · 9 substrates · 35 registry fields read (38 of the developer matrix's 81, counting the parents of the fields read) · 43 not yet read.**

## Play

| | What you can do | Maze | Flash | Bounce Demo | Runner Demo | Text Adventure | Seedling (region atlas) | Seedling (generated room) | JtA | Idle Loops |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | You can play its regions by hand | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| P2 | The Playback Bot can walk it (replaying a world's solution) | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ |
| P3 | It draws its own picture on the composite map (else a labelled box) | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| P4 | It brings progression items of its own | ✓ Red Key, Green Key, Blue Key, Yellow Key, Purple Key, Orange Key | ✗ | ✓ Right arrow, Left arrow, Springs, Jetpacks, Blue platforms, Brown platforms, Victory | ✓ Double Jump, Blue Platforms, Springs, Glide, Shield, Victory | ✗ | ✗ | ✗ | ✓ 48 items | ✓ Victory |
| P5 | What the generator may do with it | ✓ item-locked gates, exits on the four sides, its own map becomes the region graph, locations placed anywhere, any rule on a location, any rule on an exit | ✓ locations placed anywhere | ✓ locations placed anywhere | ✓ locations placed anywhere | ✓ item-locked gates, exits on the four sides, its own map becomes the region graph, locations placed anywhere, any rule on a location, any rule on an exit | ✓ locations placed anywhere | ✓ locations placed anywhere | ✓ its own map becomes the region graph, locations placed anywhere | ✓ its own map becomes the region graph, locations placed anywhere |

## Loop mode

| | What you can do | Maze | Flash | Bounce Demo | Runner Demo | Text Adventure | Seedling (region atlas) | Seedling (generated room) | JtA | Idle Loops |
|---|---|---|---|---|---|---|---|---|---|---|
| L1 | You can play it in loop mode | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| L2 | What you can queue for it | ✓ moves between regions, location checks, exploring | ✓ moves between regions | ✓ moves between regions, location checks | ✓ moves between regions, location checks | ✓ moves between regions, location checks, exploring | ✓ moves between regions | ✓ moves between regions | ✓ moves between regions | ✓ moves between regions |
| L3 | You can record a visit and replay it | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ |
| L4 | How a replay works | ✓ replays your exact moves | n/a | ✓ applies the result instantly | ✓ applies the result instantly | ✓ re-runs the queued actions | n/a | n/a | ✓ replays your exact moves | ✓ replays your exact moves |
| L5 | Instant fast-forward | ✓ a per-block toggle | ✗ | ✓ always — a replay is already instant | ✓ always — a replay is already instant | ✓ a per-block toggle | ✗ | ✗ | ✓ a per-block toggle | ✓ a per-block toggle |
| L6 | A Bot block can play it for you | ✓ the substrate walks it itself | ✗ | ✓ the game's own automation walks it | ✓ the game's own automation walks it | ✗ | ✗ | ✗ | ✓ the game's own automation walks it | ✓ the game's own automation walks it |
| L7 | The Bot honours Instant | ✗ | n/a | ✗ | ✗ | n/a | n/a | n/a | ✓ | ✓ |
| L8 | You can play it outside loop mode | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ (note 1) | ✗ (note 2) |
| L9 | It shares the loop-mode mana pool | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ |
| L10 | It shares consumable items with other substrates | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ its list comes from the running game — see the Substrate Registry panel | ✓ 18 item types: gold, reputation, herbs, … |
| L11 | Recorded actions are named in the game's own words | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

1. JtA: loop mode stays on — it declares `loopSupport.requiresLoopMode`
2. Idle Loops: loop mode stays on — it declares `loopSupport.requiresLoopMode`

## Generate

| | What you can do | Maze | Flash | Bounce Demo | Runner Demo | Text Adventure | Seedling (region atlas) | Seedling (generated room) | JtA | Idle Loops |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | The pipeline can build regions of it | ✓ grown to order | ✗ only as content from its own game | ✓ picked from its own levels to fit the plan | ✓ picked from its own levels to fit the plan | ✓ grown to order | ✓ picked from its own levels to fit the plan | ✓ grown to order | ✗ only as content from its own game | ✗ only as content from its own game |
| G2 | How many ready-made rooms / levels it brings | ✗ | ✗ | ✓ 5 | ✓ 6 | ✗ | ✓ 4 Atlas rooms | ✗ | ✓ 30 | ✓ 1 |
| G3 | Generates quickly | ✓ | n/a | ✓ | ✗ its generation cost is declared `heavy` | ✓ | ✓ | ✓ | n/a | n/a |
| G4 | Its rooms can be captured into a library and reused | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| G5 | Exits can be locked behind items | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| G6 | It has its own settings in the generation form | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| G7 | A world of it can start with an empty inventory | ✓ | ✓ | ✗ (note 1) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

1. Bounce Demo: a world starts with one of Left arrow / Right arrow — a bounce level cannot gate both arrows in one region, and hosts at most one arrowless-gated exit — the sphere route grants one arrow at the start for this reason

## Edit

| | What you can do | Maze | Flash | Bounce Demo | Runner Demo | Text Adventure | Seedling (region atlas) | Seedling (generated room) | JtA | Idle Loops |
|---|---|---|---|---|---|---|---|---|---|---|
| E1 | Its rooms can be edited | ✓ on a lab page | ✗ | ✓ in a panel | ✗ | ✗ | ✓ on a lab page | ✓ on a lab page | ✗ | ✗ |
| E2 | A region of a saved world can be opened in an editor and saved back | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ (note 1) | ✗ | ✗ | ✗ |
| E3 | An exit can be moved to another side (and a side can hold more than one) | ✗ | ✗ | ◐ one exit per side | ◐ one exit per side | ✓ and a side can hold more than one | ✓ and a side can hold more than one | ✓ and a side can hold more than one | ✓ and a side can hold more than one | ✓ and a side can hold more than one |
| E4 | The editor's validity report checks its location and exit names | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |

1. Seedling (region atlas): a Seedling sidecar payload is an ATLAS REFERENCE (`atlas_ref` / `atlas_region` / `atlas_sub_region` / `level`), not an authored room record — the room lives in the level set and the atlas that the region marking tool and `watch.html` own, and a rules.json carries neither, so there is no one-room document to hand the lab's edit arm.

## Fields behind each row

Each row is answered from these fields of the substrate's registry entry — the names in the developer matrix.

- **P1** — `panelComponentType`, `deserializeWorld`
- **P2** — `getPlaybackController`
- **P3** — `compositeMap.drawRegion`
- **P4** — `libraryItems`, `supportedFeatures`
- **P5** — `supportedFeatures`
- **L1** — `loopSupport.manual`
- **L2** — `loopSupport.queueActions`
- **L3** — `loopSupport.record`, `loopSupport.playback`
- **L4** — `takeLastRecording`, `loopSupport.summaryRecording`
- **L5** — `loopSupport.instant`, `loopSupport.summaryRecording`
- **L6** — `loopSupport.executeVia`, `sharing.mana.loopActionDelegation`
- **L7** — `loopSupport.instant`, `loopSupport.executeVia`, `takeLastRecording`
- **L8** — `loopSupport.requiresLoopMode`
- **L9** — `sharing.mana`
- **L10** — `sharing.items`
- **L11** — `describeAction`
- **G1** — `generateRegionCore`, `generateZoneForSpecs`, `generateZoneForSpecsGen`
- **G2** — `zoneCount`, `zoneSourceLabel`
- **G3** — `generationCost`
- **G4** — `captureLibraryEntry`, `instantiateLibraryEntry`
- **G5** — `canHostExitGates`, `supportedFeatures`
- **G6** — `renderProcgenParams`
- **G7** — `startingInventory`
- **E1** — `roomEditor`
- **E2** — `regionRoundTrip`
- **E3** — `exitSides`
- **E4** — `apLocationNamesOf`, `apExitNamesOf`

## Each substrate on its own

What each one lets you do — its ✓ and degree cells from the tables above, in the same order.

### Maze

- *Play* — You can play its regions by hand
- *Play* — The Playback Bot can walk it (replaying a world's solution)
- *Play* — It draws its own picture on the composite map (else a labelled box)
- *Play* — It brings progression items of its own: Red Key, Green Key, Blue Key, Yellow Key, Purple Key, Orange Key
- *Play* — What the generator may do with it: item-locked gates, exits on the four sides, its own map becomes the region graph, locations placed anywhere, any rule on a location, any rule on an exit
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

### Flash

- *Play* — You can play its regions by hand
- *Play* — What the generator may do with it: locations placed anywhere
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions
- *Loop mode* — You can play it outside loop mode
- *Generate* — A world of it can start with an empty inventory
- *Edit* — The editor's validity report checks its location and exit names

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
- *Edit* — A region of a saved world can be opened in an editor and saved back
- *Edit* — An exit can be moved to another side (and a side can hold more than one): and a side can hold more than one
- *Edit* — The editor's validity report checks its location and exit names

### Seedling (region atlas)

- *Play* — You can play its regions by hand
- *Play* — What the generator may do with it: locations placed anywhere
- *Loop mode* — You can play it in loop mode
- *Loop mode* — What you can queue for it: moves between regions
- *Loop mode* — You can play it outside loop mode
- *Generate* — The pipeline can build regions of it: picked from its own levels to fit the plan
- *Generate* — How many ready-made rooms / levels it brings: 4 Atlas rooms
- *Generate* — Generates quickly
- *Generate* — Exits can be locked behind items
- *Generate* — A world of it can start with an empty inventory
- *Edit* — Its rooms can be edited: on a lab page
- *Edit* — An exit can be moved to another side (and a side can hold more than one): and a side can hold more than one

### Seedling (generated room)

- *Play* — You can play its regions by hand
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

## Fields no statement reads yet

43 fields of the developer matrix are not behind any row above — plumbing a person does not choose a substrate by, or a capability not yet put into words:

`applyContentModules`, `applyPipelineConfig`, `backPortalGated`, `buildLibraryRegionParams`, `buildRegionContract`, `buildRegionParams`, `buildZoneSpecs`, `canHostExitGatesBraid`, `defaultProcgenParams`, `driftItems`, `emitsSpiralContent`, `exitGateVeto`, `extractPathsAndObstacles`, `extractZoneRules`, `gateHostingHint`, `gateableItems`, `getSpiralContent`, `hostsSurplusExitsNatively`, `id`, `iframeId`, `instantiateAtlasEntryForSpecs`, `instantiateLibraryEntryForSpecs`, `label`, `libraryEntryRefusal`, `loadRegionEvent`, `loopSupport.customQueues`, `onContentEdit`, `pipelineConfigKeys`, `placeFromItems`, `placeFromRules`, `prepareSphereGrowth`, `procgenParamsFromPayload`, `recordablePipelineConfig`, `regionGeometry`, `renderLibraryProcgenParams`, `rulesJsonBlocks`, `serializeWorld`, `sidecarFields`, `spiralContentConfigKey`, `validateLibraryEntry`, `victoryItem`, `zoneConfigFromSlot`, `zoneOfPayload`

<!-- GENERATED:substrate-capability-chart END -->
