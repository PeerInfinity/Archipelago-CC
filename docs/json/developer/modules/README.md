# Frontend Module Reference

<!-- quick-launch-help: order=130 audience=developer -->

This directory contains detailed documentation for each of the major frontend modules in the web client. The application is built on a modular architecture where each distinct piece of functionality is encapsulated within its own module.

This reference is intended for developers who need to understand the specific responsibilities, dependencies, and interactions of a particular module.

## Module Documentation Structure

Each document in this section follows a consistent structure:

-   **Module ID & Purpose:** The unique identifier for the module and a brief summary of its role in the application.
-   **Key Files:** A list of the most important source code files for the module.
-   **Responsibilities:** A detailed breakdown of what the module is designed to do.
-   **Events Published:** A list of events the module sends out on the `eventBus`.
-   **Events Subscribed To:** A list of events the module listens for from the `eventBus` or `eventDispatcher`.
-   **Public Functions:** A list of functions the module registers with the `centralRegistry` for other modules to call directly.
-   **Dependencies & Interactions:** A description of how the module interacts with other core systems or modules.

The sections below are the module categories of the [module index](../../modules/README.md) (each panel module's `moduleInfo.category`); only the categories with a technical reference here are listed.

## Tracker Panels

-   **[Dungeons](./dungeons.md):** Displays dungeon-specific information, such as bosses and medallion requirements.
-   **[Exits](./exits.md):** Displays all region exits and their real-time accessibility status.
-   **[Helpers](./helpers.md):** Displays game helper functions with interactive parameter input and live evaluation.
-   **[Inventory](./inventory.md):** Displays and manages the player's item inventory.
-   **[Locations](./locations.md):** Displays all game locations and their real-time accessibility status.
-   **[Game State Panel](./gameStatePanel.md):** A simple panel for displaying the player's current state (e.g., current region).
-   **[Regions](./regions.md):** Displays the game world organized by regions and their connections.
-   **[Spoiler Checklist](./spoilerChecklist.md):** Interactive checklist for tracking sphere log progression with multiworld support.
-   **[Progress Bar Panel](./progressBarPanel.md):** A panel designed to host UI elements from the `ProgressBar` module.

## Game Mode Panels

-   **[Discovery Panel](./discoveryPanel.md):** Provides a UI for managing discovery mode settings and displaying discovered items.
-   **[Timer Panel](./timerPanel.md):** A dedicated panel that can host the Timer UI component.
-   **[Meta Game Panel](./metaGamePanel.md):** A UI for loading and managing `MetaGame` configurations.

## Loop Mode Modules

-   **[Loops](../../features/loops.md):** The main UI panel for the Archipelago Loops incremental game mode.
-   **[Loops Cost Debugger](./loopsCostDebugger.md):** Step-through planner/verifier for loop-mode mana costs, and the headless path that stamps generated costs into the live store.

## Non-procgen Games

-   **[Proof Queue](./proofQueue.md):** Arrange MetaMath proof steps in dependency order with difficulty-based hypothesis assignment.
-   **[Proof Graph](./proofGraph.md):** Reconstruct proof dependency edges in an interactive Cytoscape.js graph.

## Data and Configuration Panels

-   **[Editor](./editor.md):** A simple JSON viewer for inspecting application data like `rules.json`.
-   **[Editor CodeMirror6](./editorCodeMirror6.md):** CodeMirror 6 based JSON editor with syntax highlighting and code folding.
-   **[JSON](./json.md):** Handles saving and loading of the application's entire configuration state (modes).
-   **[Modules](./modules.md):** A panel for viewing and managing the loaded frontend modules.
-   **[Presets](./presets.md):** Handles loading of pre-configured game files (`rules.json`).
-   **[Settings](./settings.md):** Provides a UI for editing application settings.

## Analysis Panels

-   **[Path Analyzer Panel](./pathAnalyzerPanel.md):** A dedicated panel for running the path analysis tool.
-   **[Region Graph](./regionGraph.md):** Interactive visualization of region connectivity using Cytoscape.js with real-time accessibility updates.

## Embedding and Windows

-   **[Iframe Panel](./iframePanel.md):** A generic panel designed to host an `<iframe>` and connect it to the `iframeAdapter`.
-   **[Iframe Manager Panel](./iframeManagerPanel.md):** A UI for loading content into `iframePanel` instances.
-   **[Window Panel](./windowPanel.md):** A panel that displays the status of a connected separate browser window.
-   **[Window Manager Panel](./windowManagerPanel.md):** A UI for opening and managing separate windows that connect via the `windowAdapter`.

## Procgen Substrate Panels

-   **[Text Adventure](../procgen/text-adventure.md):** Provides a text-based interface for interacting with the game world. Implemented by the `textAdventureSubstrateWrapper` module over the `textAdventureEngine` submodule; documented with the other substrates.

## Developer and Testing Panels

-   **[Events](./events.md):** A debug panel for inspecting registered handlers for the `eventBus` and `eventDispatcher`.
-   **[Spoiler Test](./spoilerTest.md):** The primary tool for validating game logic by replaying a game's progression against its spoiler log.
-   **[Tests](./tests.md):** A developer panel that provides an in-app framework for running automated feature tests and integrates with Playwright for end-to-end validation.

## Core Service Modules

These modules provide foundational services that other modules depend on. They typically do not have their own UI panels (the last six are shared utilities used by other modules).

-   **[State Manager](./stateManager.md):** The most critical module. Manages all game state, logic evaluation, and accessibility in a background Web Worker.
-   **[Client](./client.md):** Handles WebSocket communication with the Archipelago server.
-   **[Discovery](./discovery.md):** Tracks the "discovered" state of regions, locations, and exits for game modes like Archipelago Loops.
-   **[GameState](./gameState.md):** Tracks the player's current region, primarily for UI-centric features like the Text Adventure.
-   **[Sphere State](./sphereState.md):** Manages sphere log data and progression tracking for games supporting the sphere system.
-   **[Timer](./timer.md):** Manages the logic for the automated location checking timer.
-   **[ProgressBar](./progressBar.md):** Provides the core logic for creating and managing generic, event-driven progress bars.
-   **[MetaGame](./metaGame.md):** An event orchestration system for creating scripted, narrative, or tutorial-like experiences.
-   **[Editor Core](./editorCore.md):** Non-UI module providing centralized data management and event coordination for editor implementations.
-   **[IframeAdapter](./iframeAdapter.md):** Core logic for bridging communication between the main app and content running in an `<iframe>`.
-   **[WindowAdapter](./windowAdapter.md):** Core logic for bridging communication between the main app and content running in a separate browser window.
-   **[CommonUI](./commonUI.md):** Provides shared UI utility functions, such as rendering logic trees.
-   **[Iframe Base](./iframe-base.md):** Communication client for standalone apps embedded in iframes.
-   **[Path Analyzer](./pathAnalyzer.md):** The core logic and UI rendering components for the path analysis tool, used by `regionsPanel` and `pathAnalyzerPanel`.
-   **[Proof Shared](./proofShared.md):** Base classes and helpers shared by the Proof Queue and Proof Graph modules.
-   **[Shared](./shared.md):** Thread-agnostic utilities including rule engine, state interface, and game logic modules.
-   **[Window Base](./window-base.md):** Communication client for standalone apps opened via `window.open()`.
## Related Documentation

- **[Developer Guides](../guides/)** - Development guides for working with modules
- **[Module System Guide](../guides/module-system.md)** - How the module system works
- **[Creating Modules Guide](../guides/creating-modules.md)** - Build your own modules
- **[Event System Guide](../guides/event-system.md)** - Inter-module communication
- **[Frontend README](../../../../frontend/README.md)** - Frontend overview and directory structure