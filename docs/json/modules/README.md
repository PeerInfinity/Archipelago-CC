# Frontend Module Reference

This directory is an index for module documentation. Each module has two levels of documentation:

- **User guides** — written for people using the application. Found in [`../user/modules/`](../user/modules/).
- **Technical references** — written for developers working on the codebase. Found in [`../developer/modules/`](../developer/modules/).

Each entry below links to the available documentation for that module; modules without a dedicated page here carry a one-line description inline (the procedural-generation modules are documented in depth under [`../developer/procgen/`](../developer/procgen/README.md) instead). See the [user guide TODO list](../user/modules/TODO.md) for the status of user-facing documentation.

The `## ` module sections below double as the module categories: each panel module declares one of their names, verbatim, as `moduleInfo.category`, and the Quick Launch panel groups *All panels* by them in this order (`CATEGORY_ORDER`, generated from these headings by `scripts/quicklaunch/generate-docs-index.mjs` and pinned by the vitest — rerun the generator after renaming, adding or reordering a section).

Modules marked *(disabled)* are present in the codebase but not enabled in the default module configuration (`frontend/module-configs/modules.json`); which modules are live depends on the launch mode (`frontend/modes.json`).

---

## Tracker Panels

- [Inventory](./inventory.md)
- [Regions](./regions.md)
- [Locations](./locations.md)
- [Exits](./exits.md)
- [Dungeons](./dungeons.md)
- [Helpers](./helpers.md)
- [Game State Panel](./gameStatePanel.md)
- [Progress Bar Panel](./progressBarPanel.md)
- [Spoiler Checklist](./spoilerChecklist.md)

## Game Mode Panels

- [Menu Panel](./menuPanel.md) (`menuPanel`) — the start region's substrate: one button per exit, a Restart that works outside loop mode, and the *skip the menu* setting.
- [Discovery Panel](./discoveryPanel.md)
- [Meta Game Panel](./metaGamePanel.md)
- [Timer Panel](./timerPanel.md) *(disabled)*

## Loop Mode Modules

- **Loops** (`loops`) — loop mode logic and UI panel. See the [Loops feature guide](../features/loops.md) and [Loops Module States](../developer/reference/loops-module-states.md).
- **Loop Stats** (`loopStats`) — detailed action-queue analysis with mana cost predictions.
- [Loops Cost Debugger](./loopsCostDebugger.md) (`loopsCostDebugger`) — step-through debugger for the loop-cost generation algorithm. See also the [loop-cost engine disambiguation](../developer/procgen/gotchas.md#one-loop-cost-engine-one-store--and-the-debugger-is-its-inspector).

## Non-procgen Games

- **APCalc** (`apcalc`) *(disabled)* — calculator-themed puzzle game for Archipelago (enabled in the apcalc launch mode).
- **APCalc Generator** (`apcalcGenerator`) *(disabled)* — generates APCalc puzzle data with configurable parameters.
- **JtA panel cluster** *(all disabled except `jtaQueueEngine`; superseded for substrate use by `jtaSubstrateWrapper`)*: `jtaGameDataPanel` (view/control JtA game data), `jtaActionQueue` (queue and execute JtA actions), `jtaQueueEngine` (headless queue execution strategy and predictions), `jtaArchipelago` (bridges JtA game events to AP checks/items), `jtaCostDebugger` (step-through debugger for JtA cost generation).
- [Proof Queue](./proofQueue.md) *(disabled)*
- [Proof Graph](./proofGraph.md) *(disabled)*
- [Vibe Coding Simulator](./vibeCodingSim.md) *(disabled)*

## Data and Configuration Panels

- [JSON](./json.md)
- [Presets](./presets.md)
- [Settings](./settings.md)
- **Options Panel** (`optionsPanel`) — general application settings and preferences, including the auto-generated All Settings view.
- [Modules](./modules.md)
- [Quick Launch](../user/modules/quickLaunch.md) (`quickLaunch`) — a button per registered panel (opens it, or brings it forward) and a link per user guide; its catalog is read off the live registry and each module's own `moduleInfo` (`docs` = its guide). Code: `frontend/modules/quickLaunch/`.
- [Editor CodeMirror6](./editorCodeMirror6.md)
- [Editor](./editor.md) *(disabled)*
- **Rule Converter** (`ruleConverter`) *(disabled)* — converts between Python code and JSON rule format.

## Analysis Panels

- [Path Analyzer Panel](./pathAnalyzerPanel.md)
- [Region Graph](./regionGraph.md)

## Embedding and Windows

- [Iframe Panel](./iframePanel.md)
- [Iframe Manager Panel](./iframeManagerPanel.md)
- [Window Panel](./windowPanel.md)
- [Window Manager Panel](./windowManagerPanel.md)
- **Flash Panel** (`flashPanel`) — embeds a Flash game with an injected Archipelago bridge.

## Procgen Substrate Panels

Documented in depth in the [procgen developer docs](../developer/procgen/README.md):

- **Maze Room** (`mazeRoom`) — the maze substrate: engine, biomes, hazards, autopather. See [Maze Substrate](../developer/procgen/maze.md).
- **Bounce Demo** (`bounceDemo`) — the Doodle-Jump-style platformer substrate. See [Bounce Substrate](../developer/procgen/bounce.md).
- **Runner Demo** (`runnerDemo`) — the auto-runner platformer substrate. See [Runner Substrate](../developer/procgen/runner.md).
- **Flash Substrate** (`flashSubstrate`) — recompiled Flash games as regions. See [Flash Substrate](../developer/procgen/flash.md).
- [Text Adventure](./textAdventure.md)
- [Text Adventure (substrate wrapper)](../developer/procgen/text-adventure.md)
- **Text Adventure Substrate Wrapper** (`textAdventureSubstrateWrapper`) — the enabled iframe-hosted text-adventure path. See [Text Adventure Substrate](../developer/procgen/text-adventure.md).
- **JtA Substrate Wrapper** (`jtaSubstrateWrapper`) — Journey to Ascension as a zone-based substrate. See [JtA Substrate](../developer/procgen/jta.md).
- **Idle Loops Substrate Wrapper** (`omsiSubstrateWrapper`) — Idle Loops (omsi-loops) as a loop-mode substrate. See [Omsi Substrate (Idle Loops)](../developer/procgen/omsi.md).
- **Maze Game Data Panel** (`mazeGameDataPanel`) — views and edits A-Mazing-Idle game data (points, biome, mazes, saves).

## Procgen Infrastructure Panels

Documented in depth in the [procgen developer docs](../developer/procgen/README.md):

- **Procgen Pipeline** (`procgenPipeline`) — the world-generation panel and its layout drivers. See [Architecture](../developer/procgen/architecture.md) and [The Stepped Pipeline](../developer/procgen/stepped-pipeline.md).
- **Procgen Player** (`procgenPlayer`) — headless coordinator that recognizes a procgen `rules.json` and routes region loads to substrate panels. See [Architecture](../developer/procgen/architecture.md).
- **Procgen Lab** (`procgenLabPanel`) — hosts one substrate's standalone lab page (the maze `lab.html` or Seedling `watch.html`) inside the app. See its [README](../../../frontend/modules/procgenLabPanel/README.md).
- **Substrate Registry** (`substrateRegistryPanel`) — the live `substrateRegistry` in the running app: every entry and field, the playback-controller and shared item-type answers, and drift against the checked-in registry snapshot; a Matrix mode (features × entries, ✓ / ✗ / number) and a Detail mode (one block per entry).
- [APWorld Editor](./apworldEditor.md) (`apworldEditor`) — the HUB over a rules.json: GUI editing of regions, exits, locations, access rules and items, a schema-derived Document tab over every top-level key, a player selector, and links to every other editor that owns part of the document.
- **Bounce Region Editor** (`bounceRegionEditor`) — edits one bounce region's geometry from the pipeline's Edit ▸ flow. See [The Stepped Pipeline](../developer/procgen/stepped-pipeline.md).
- **Playback Bot** (`playbackBot`) — sphere-log-driven auto-player over substrate playback controllers. See [Playback and Debugging Tools](../developer/procgen/playback-and-debugging.md).
- **Region Marking Tool** (`regionMarkingTool`) *(disabled)* — marks a real game's map into procgen regions and writes the region atlas.
- **Tile Map Analyzer** (`tileMapAnalyzer`) *(disabled)* — analyzes a tile-based Flash game's map data and emits an Archipelago rules.json.

## Developer and Testing Panels

- [Tests](./tests.md)
- [Events](./events.md)
- [Spoiler Test](./spoilerTest.md)

## Core Service Modules

- [State Manager](./stateManager.md)
- [Client](./client.md)
- [Discovery](./discovery.md)
- [GameState](./gameState.md)
- [Sphere State](./sphereState.md)
- [Timer](./timer.md)
- [ProgressBar](./progressBar.md)
- [MetaGame](./metaGame.md)
- [Editor Core](./editorCore.md)
- [IframeAdapter](./iframeAdapter.md)
- [WindowAdapter](./windowAdapter.md)
- [CommonUI](./commonUI.md)
- [Iframe Base](./iframe-base.md)
- [Path Analyzer](./pathAnalyzer.md)
- [Proof Shared](./proofShared.md)
- [Shared](./shared.md)
- [Window Base](./window-base.md)

## Submodules and Non-Module Directories

These live under `frontend/modules/` but are not frontend modules in the registration sense:

- **`shared/`** — git submodule of cross-module utilities and the procgen primitives ([Shared](./shared.md)); `git log`/`blame`/commits happen inside the submodule.
- **`textAdventureEngine/`** — git submodule holding the Archipelago-naive text-adventure engine. See [Text Adventure Substrate](../developer/procgen/text-adventure.md).
- **`journey-to-ascension/`**, **`jta-randomizer/`**, **`jta-remote/`**, **`a-mazing-idle-remote/`** — bundled game builds/forks consumed by their wrapper modules, not modules themselves.
- **`testModule/`** — a minimal dynamically-loaded panel used as a test fixture.
