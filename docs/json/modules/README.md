# Frontend Module Reference

This directory is an index for module documentation. Each module has two levels of documentation:

- **User guides** — written for people using the application. Found in [`../user/modules/`](../user/modules/).
- **Technical references** — written for developers working on the codebase. Found in [`../developer/modules/`](../developer/modules/).

Each entry below links to the available documentation for that module; modules without a dedicated page here carry a one-line description inline (the procedural-generation modules are documented in depth under [`../developer/procgen/`](../developer/procgen/README.md) instead). See the [user guide TODO list](../user/modules/TODO.md) for the status of user-facing documentation.

Modules marked *(disabled)* are present in the codebase but not enabled in the default module configuration (`frontend/module-configs/modules.json`); which modules are live depends on the launch mode (`frontend/modes.json`).

---

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

## UI Panel Modules

- [Discovery Panel](./discoveryPanel.md)
- [Dungeons](./dungeons.md)
- [Editor](./editor.md)
- [Editor CodeMirror6](./editorCodeMirror6.md)
- [Events](./events.md)
- [Exits](./exits.md)
- [Helpers](./helpers.md)
- [Inventory](./inventory.md)
- [JSON](./json.md)
- [Locations](./locations.md)
- [Modules](./modules.md)
- [Path Analyzer Panel](./pathAnalyzerPanel.md)
- [Game State Panel](./gameStatePanel.md)
- [Presets](./presets.md)
- [Progress Bar Panel](./progressBarPanel.md)
- [Region Graph](./regionGraph.md)
- [Regions](./regions.md)
- [Settings](./settings.md)
- [Spoiler Checklist](./spoilerChecklist.md)
- [Spoiler Test](./spoilerTest.md)
- [Text Adventure](./textAdventure.md)
- [Text Adventure (Substrate)](./textAdventureSubstrate.md)
- [Timer Panel](./timerPanel.md)
- [Vibe Coding Simulator](./vibeCodingSim.md)
- [Proof Queue](./proofQueue.md)
- [Proof Graph](./proofGraph.md)
- [Meta Game Panel](./metaGamePanel.md)
- [Iframe Panel](./iframePanel.md)
- [Iframe Manager Panel](./iframeManagerPanel.md)
- [Window Panel](./windowPanel.md)
- [Window Manager Panel](./windowManagerPanel.md)

## Procedural Generation and Substrate Modules

Documented in depth in the [procgen developer docs](../developer/procgen/README.md):

- **Procgen Pipeline** (`procgenPipeline`) — the world-generation panel and its layout drivers. See [Architecture](../developer/procgen/architecture.md) and [The Stepped Pipeline](../developer/procgen/stepped-pipeline.md).
- **Procgen Player** (`procgenPlayer`) — headless coordinator that recognizes a procgen `rules.json` and routes region loads to substrate panels. See [Architecture](../developer/procgen/architecture.md).
- **Maze Room** (`mazeRoom`) — the maze substrate: engine, biomes, hazards, autopather. See [Maze Substrate](../developer/procgen/maze.md).
- **Maze Game Data Panel** (`mazeGameDataPanel`) — read-only inspector for A-Mazing-Idle game data.
- **Bounce Demo** (`bounceDemo`) — the Doodle-Jump-style platformer substrate. See [Bounce Substrate](../developer/procgen/bounce.md).
- **Bounce Region Editor** (`bounceRegionEditor`) — edits one bounce region's geometry from the pipeline's Edit ▸ flow. See [The Stepped Pipeline](../developer/procgen/stepped-pipeline.md).
- **Flash Substrate** (`flashSubstrate`) — recompiled Flash games as regions. See [Flash Substrate](../developer/procgen/flash.md).
- **Flash Panel** (`flashPanel`) *(disabled)* — embeds a Flash game with an injected Archipelago bridge.
- **Text Adventure Substrate Wrapper** (`textAdventureSubstrateWrapper`) — the enabled iframe-hosted text-adventure path. See [Text Adventure Substrate](../developer/procgen/text-adventure.md).
- **JtA Substrate Wrapper** (`jtaSubstrateWrapper`) — Journey to Ascension as a zone-based substrate. See [JtA Substrate](../developer/procgen/jta.md).
- **Playback Bot** (`playbackBot`) — sphere-log-driven auto-player over substrate playback controllers. See [Playback and Debugging Tools](../developer/procgen/playback-and-debugging.md).
- **Tile Map Analyzer** (`tileMapAnalyzer`) *(disabled)* — analyzes a tile-based Flash game's map data and emits an Archipelago rules.json.

## Loop Mode Modules

- **Loops** (`loops`) — loop mode logic and UI panel. See the [Loops feature guide](../features/loops.md) and [Loops Module States](../developer/reference/loops-module-states.md).
- **Loop Stats** (`loopStats`) — detailed action-queue analysis with mana cost predictions.
- **Loops Cost Debugger** (`loopsCostDebugger`) — step-through debugger for the loop-cost generation algorithm. See the [loop-cost engine disambiguation](../developer/procgen/gotchas.md#three-loop-cost-engines-one-store).

## Game and Tool Modules

- **APCalc** (`apcalc`) *(disabled)* — calculator-themed puzzle game for Archipelago (enabled in the apcalc launch mode).
- **APCalc Generator** (`apcalcGenerator`) — generates APCalc puzzle data with configurable parameters.
- **APWorld Editor** (`apworldEditor`) — GUI editor for an apworld's rules.json (regions, exits, locations, access rules).
- **Options Panel** (`optionsPanel`) — general application settings and preferences, including the auto-generated All Settings view.
- **Rule Converter** (`ruleConverter`) *(disabled)* — converts between Python code and JSON rule format.
- **JtA panel cluster** *(all disabled; superseded for substrate use by `jtaSubstrateWrapper`)*: `jtaGameDataPanel` (view/control JtA game data), `jtaActionQueue` (queue and execute JtA actions), `jtaQueueEngine` (headless queue execution strategy and predictions), `jtaArchipelago` (bridges JtA game events to AP checks/items), `jtaCostDebugger` (step-through debugger for JtA cost generation).

## Submodules and Non-Module Directories

These live under `frontend/modules/` but are not frontend modules in the registration sense:

- **`shared/`** — git submodule of cross-module utilities and the procgen primitives ([Shared](./shared.md)); `git log`/`blame`/commits happen inside the submodule.
- **`textAdventureEngine/`** — git submodule holding the Archipelago-naive text-adventure engine. See [Text Adventure Substrate](../developer/procgen/text-adventure.md).
- **`journey-to-ascension/`**, **`jta-randomizer/`**, **`jta-remote/`**, **`a-mazing-idle-remote/`** — bundled game builds/forks consumed by their wrapper modules, not modules themselves.
- **`testModule/`** — a minimal dynamically-loaded panel used as a test fixture.

## Utility Modules

- [CommonUI](./commonUI.md)
- [Iframe Base](./iframe-base.md)
- [Path Analyzer](./pathAnalyzer.md)
- [Proof Shared](./proofShared.md)
- [Shared](./shared.md)
- [Window Base](./window-base.md)
- [Tests](./tests.md)
