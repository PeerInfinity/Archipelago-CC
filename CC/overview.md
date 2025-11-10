## Project Overview

This document provides a comprehensive guide to the files within the "Archipelago JSON Export Tools" project. This project is a **fork of the main Archipelago project** that focuses on exporting game logic—such as location access rules, region connections, and item data—into a standardized JSON format. This JSON is then consumed by a modular, feature-rich web client designed for advanced game tracking, accessibility analysis, and other utilities, including an incremental game mode called "Archipelago Loops."

**Key Project Relationship**: This fork serves as a powerful companion to the main Archipelago project. It translates the Python-based game logic into a format that a web browser can understand, enabling a suite of web-based tools that parallel the core project's logic.

## Documentation Structure

The primary and most current documentation for this project is located in the `docs/json/` directory. For the best user and developer experience, please refer to these guides first.

-   **[Main Documentation Portal (`docs/json/README.md`)](./docs/json/README.md)**: The central hub for all user and developer documentation.
-   **User Guides (`docs/json/user/`)**: Contains the **[Quick Start Guide](./docs/json/user/quick-start.md)** and other manuals for using the web client.
-   **Developer Guides (`docs/json/developer/`)**: Contains the **[Developer Getting Started Guide](./docs/json/developer/getting-started.md)**, a deep dive into the **[System Architecture](./docs/json/developer/architecture.md)**, and detailed guides on the **[Module System](./docs/json/developer/guides/module-system.md)**, **[Event System](./docs/json/developer/guides/event-system.md)**, and **[State Management](./docs/json/developer/guides/state-management.md)**.
-   **[Project Roadmap (`docs/json/project-roadmap.md`)](./docs/json/project-roadmap.md)**: Outlines the latest status, known issues, and future plans.

The `CC/` directory contains supplementary design documents and Claude Code collaboration files. The `NewDocs/` directory contains historical planning files. While they provide valuable context, the `docs/json/` directory should be considered the authoritative source for the project's current state.

---

## Core Project Files

### `README.md`

The main entry point for understanding the project. It describes:

-   The core system for exporting Archipelago rules to JSON.
-   The features of the modular Web Client, including standard tracking, advanced logic-aware features, and unique game modes like "Archipelago Loops" and "Text Adventure".
-   Key technical features such as the Web Worker-based state manager and the event-driven architecture.
-   Links to the full documentation portal and developer guides.

---

## Data Flow and Testing Architecture

The project implements a comprehensive data extraction and testing pipeline to ensure the JavaScript frontend faithfully replicates the original Python game logic.

1.  **Source**: The original Python game logic from directories like `worlds/alttp/`.
2.  **Extraction**: The `exporter/` tools analyze the Python code and convert its rules, regions, and items into a standardized JSON format.
3.  **Frontend**: The JavaScript web client consumes this JSON, using `ruleEngine.js` and `stateManager.js` to process the game logic.
4.  **Testing & Validation**: The frontend includes a powerful test runner that validates the JavaScript implementation against the progression spheres extracted from the original Python tests.

For detailed information, see **`docs/json/developer/guides/testing-pipeline.md`** for a comprehensive overview of this data flow.

---

## Automated Testing Infrastructure

The project includes extensive automated testing capabilities using both an in-browser test framework and Playwright for end-to-end validation.

#### Playwright End-to-End Testing

-   **`playwright.config.js`**: Configuration file for Playwright, defining test directories, timeouts, and browser settings.
-   **`tests/e2e/app.spec.js`**: The main Playwright test file. It launches the application in test mode and validates the results of the in-app test suite by monitoring flags written to `localStorage`.

#### Running Playwright Tests

To run the automated tests, ensure the local server is running and use the following npm scripts:

-   `npm test`: Run tests in headless mode (recommended).
-   `npm run test:headed`: Run tests in a visible browser for debugging.
-   `npm run test:debug`: Run in debug mode for step-by-step execution.
-   `npm run test:ui`: Open Playwright's interactive UI.

#### Known Cursor Interface Issue

**Important**: There is a known issue with the Cursor code editor where test commands may fail intermittently. This is a bug in the Cursor interface, not the test code.

**Workaround**: If a test command fails, simply run it again. The second attempt usually succeeds.

#### In-Browser Test System

The application features a sophisticated in-browser testing framework (`frontend/modules/tests/`) that:

-   Automatically discovers test cases from the `frontend/modules/tests/testCases/` directory.
-   Provides a `TestController` API for tests to interact with application state and the UI.
-   Handles asynchronous operations to prevent race conditions between UI updates and test assertions.
-   Integrates with Playwright by setting `localStorage` flags upon completion of all test runs.

---

### Backend: The Exporter (`exporter/`)

This directory contains the Python-based tools responsible for analyzing the game logic from the main Archipelago project and converting it into the JSON format used by the frontend.

-   **`exporter/exporter.py`**: The main orchestration script that coordinates the entire export process.
-   **`exporter/analyzer.py`**: The core of the exporter. It uses Python's Abstract Syntax Tree (`ast`) module to parse Python rule functions (like lambdas) and convert them into a structured JSON rule tree.
-   **`exporter/games/`**: Contains game-specific handlers (`alttp.py`, `ahit.py`, etc.) that understand the unique helper functions and data structures for each game, ensuring they are correctly represented in the final JSON. `base.py` provides the parent class, and `generic.py` is used as a fallback.

---

### Backend: Original Archipelago Source (`worlds/`)

This directory contains a subset of the original Python implementation from the main Archipelago project, which serves as the authoritative source for game logic.

-   **`worlds/alttp/`**: Contains the logic for "A Link to the Past," including `Rules.py` and `StateHelpers.py`. These files are analyzed by the exporter.
-   **`worlds/generic/`**: Contains base rules applicable to multiple games.

---

### Frontend: Application Root (`frontend/`)

These files are at the root of the `frontend/` directory and are critical for the application's setup, configuration, and operation.

-   **`init.js`**: The main entry point and initialization script for the entire frontend. It orchestrates the loading of all modules, manages their lifecycle (registration, initialization), and sets up core services like the `PanelManager` and `EventDispatcher`.
-   **`index.html`**: The single HTML file for the web client. It includes the necessary script tags, CSS links, and the root `<div>` container for the Golden Layout interface.
-   **`modules.json`**: The **module manifest**. This critical configuration file defines all available frontend modules, their file paths, default enabled state, and their `loadPriority`, which controls the initialization order.
-   **`modes.json`**: Defines different application "modes" (e.g., `default`, `test`, `adventure`). Each mode can specify overrides for `rules.json`, `modules.json`, `layout_presets.json`, and `settings.json`, allowing for different application behaviors and data sets.
-   **`settings.json`**: Contains the default application settings.
-   **`settings.schema.json`**: A JSON Schema defining the structure and constraints for `settings.json`.
-   **`layout_presets.json`**: Contains predefined UI layout configurations for Golden Layout.
-   **`frontend/schema/rules.schema.json`**: A JSON Schema that defines the structure for the `rules.json` files generated by the exporter, used for validation.
-   **`frontend/styles/index.css`**: The main consolidated stylesheet for the application.

---

### Frontend: Core Architecture (`frontend/app/core/`)

This directory contains the fundamental JavaScript services that underpin the entire web client.

-   **`centralRegistry.js`**: A central "phone book" where modules declare their capabilities (panels, event handlers, public functions) during the registration phase.
-   **`eventBus.js`**: A simple publish-subscribe system for one-to-many broadcast notifications (e.g., `stateManager:snapshotUpdated`).
-   **`eventDispatcher.js`**: A prioritized event system for command-like events that should be handled by a single module in a defined order (e.g., `user:locationCheck`).
-   **`panelManager.js`**: An intermediary service that registers UI component classes from modules with the Golden Layout instance and manages their lifecycle.
-   **`settingsManager.js`**: Manages the loading, storing, and updating of all application settings.
-   **`loggerService.js` & `universalLogger.js`**: The centralized, structured logging system. It provides consistent, filterable, and category-based logging across all modules and contexts, including Web Workers and iframes.

---

### Frontend: State Management (`frontend/modules/stateManager/`)

This is the most critical frontend module. It manages all game-related state and performs all heavy rule computations in a background Web Worker to keep the UI responsive.

-   **`stateManagerWorker.js`**: The entry point for the Web Worker. It receives commands from the main thread.
-   **`stateManager.js`**: The core logic class that runs **exclusively in the worker**. It holds the authoritative game state and performs all computations, including the Breadth-First Search (BFS) for reachability.
-   **`stateManagerProxy.js`**: The proxy that runs on the main UI thread. It is the sole interface for all other modules, sending commands to the worker and receiving state **snapshots**.
-   **`stateManagerProxySingleton.js`**: Exports a singleton instance of the proxy, which is the object all other modules should import and use to interact with the game state.
-   **`frontend/modules/shared/ruleEngine.js`**: The JavaScript engine that recursively evaluates the JSON rule trees. It runs in both the worker (for authoritative checks) and the main thread (on cached snapshots for UI display).
-   **`frontend/modules/shared/gameLogic/`**: Contains game-specific logic modules (`alttpLogic.js`, `ahitLogic.js`, `genericLogic.js`) that are dynamically loaded by the `StateManager`. The `gameLogicRegistry.js` handles the selection.

---

### Frontend: UI Modules (`frontend/modules/`)

Each subdirectory in `frontend/modules/` represents a distinct, self-contained feature or UI panel. They follow a standard pattern with an `index.js` for registration and a UI class (e.g., `[moduleName]UI.js`).

-   **`client/`**: Implements the standard Archipelago client functionality, including WebSocket connection and message handling.
-   **`commonUI/`**: Provides shared, reusable UI utility functions, such as rendering logic trees.
-   **`dungeons/`**: Displays dungeon-specific information, such as bosses and medallion requirements.
-   **`editor/`**: A simple JSON viewer for inspecting application data. Alternative implementations (`editor-codemirror`, `editor-vanilla-jsoneditor`) also exist.
-   **`events/`**: A developer-focused debug panel for inspecting the `eventBus` and `eventDispatcher`.
-   **`exits/`**: Displays all region exits and their real-time accessibility status.
-   **`inventory/`**: Displays and manages the player's item inventory.
-   **`json/`**: A centralized UI for managing the application's complete configuration state (modes).
-   **`locations/`**: Displays all game locations and their real-time accessibility status.
-   **`loops/`**: The main UI and logic for the "Archipelago Loops" incremental game mode.
-   **`metaGame/` & `metaGamePanel/`**: An event orchestration system for creating scripted, narrative, or tutorial-like experiences.
-   **`modules/`**: A panel for viewing and managing the loaded frontend modules.
-   **`pathAnalyzer/` & `pathAnalyzerPanel/`**: Provides the core logic and UI for analyzing accessibility paths between regions.
-   **`playerState/` & `playerStatePanel/`**: Tracks player-specific state that is separate from core game logic, such as the current region in the Text Adventure.
-   **`presets/`**: Handles the loading of pre-configured `rules.json` game files.
-   **`progressBar/` & `progressBarPanel/`**: Provides the core logic for creating and managing generic, event-driven progress bars.
-   **`regions/`**: Displays the game world organized by regions and their connections.
-   **`settings/`**: Provides a UI for editing application settings.
-   **`testModule/`**: A simple module used for testing dynamic module loading.
-   **`testPlaythroughs/`**: A developer tool for replaying a game's progression event-by-event to validate the `StateManager`.
-   **`testSpoilers/`**: A powerful validation tool that replays a game's logical progression against its spoiler log to confirm the accuracy of the exported rules.
-   **`tests/`**: A comprehensive in-app framework for discovering, running, and debugging automated feature tests. It is the core of the project's Playwright-based end-to-end testing strategy.
-   **`textAdventure/`**: Provides a classic text-based adventure interface for interacting with the game world.
-   **`timer/` & `timerPanel/`**: Manages the logic and UI for the automated location checking timer ("Begin" / "Quick Check").
-   **Communication Adapters**:
    -   **`iframeAdapter/`**, **`iframePanel/`**, **`iframeManagerPanel/`**: A system to host external web content in an `<iframe>` and bridge communication with the main application's state and event bus.
    -   **`windowAdapter/`**, **`windowPanel/`**, **`windowManagerPanel/`**: A similar system for content running in a separate browser window.