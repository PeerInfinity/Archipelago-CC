# Project Roadmap and Future Development

_**Status as of July 2025.** This is a living document and priorities may shift._

## Overview

The project has recently completed a major frontend refactor, establishing a modular architecture built on Golden Layout and a Web Worker-based State Manager. This new foundation provides significant improvements in performance, stability, and extensibility.

The current roadmap is focused on three main areas:
1.  **Stabilization:** Addressing bugs and issues that arose during the refactor.
2.  **Enhancement:** Building upon the new architecture to improve existing features.
3.  **Expansion:** Adding new capabilities and modules that are now possible.

---

## Immediate Priorities & Bug Fixes

This section covers critical issues and cleanup tasks that should be addressed before major new feature development.

*   **[TASK]** Correct misleading log messages in the Playwright tests to improve debuggability.
*   **[BUG]** Resolve issues preventing the `testSpoilers` module from passing 100% for "A Link to the Past".
*   **[TASK]** Review and update all documentation for accuracy post-refactor.
*   **[TASK]** General code cleanup and removal of deprecated files and logic.

#### Test Strategy Update
The primary method for validating game logic is now the `testSpoilers` module, which works for any game with a corresponding spoiler log.
*   **[TASK]** Officially deprecate the `testCases` and `testPlaythroughs` modules and the old `test_runner` interface.

#### Loop Mode Stabilization
The "Archipelago Loops" mode was partially broken during the refactor and needs to be brought back to full functionality on the new architecture.
*   **[BUG]** Fix all known issues related to Loops mode, including mana calculation, action queue processing, and server integration.

---

## High Priority Features

These are the next major features to be implemented, building on the new architecture.

#### Player State and Text Adventure Modules
*   **[FEATURE]** Implement the planned **`PlayerState`** module for tracking the player's current region.
*   **[FEATURE]** Implement the **`TextAdventure`** module as a new way to interact with the game world and as a practical test of the event and state management systems.
*   **[FEATURE]** Implement the **`IFrameAdapter`** module to host external web applications (like a standalone version of the Text Adventure) within a Golden Layout panel.

#### Loops Mode Completion
*   **[FEATURE]** Finish the implementation of the `loops` module and its dependencies to restore and complete the incremental game mode.

---

## Medium Priority & Quality of Life Features

These features will improve the user and developer experience.

*   **[FEATURE]** Update the **`JSON`** module to allow live-loading of all data categories (rules, settings, layout, etc.) without requiring a page reload where possible.

#### Generic Progress Bar Module
*   **[FEATURE]** Create the planned generic, configurable **`ProgressBar`** module. This would allow for multiple, event-driven progress bars to be created and displayed for various in-app processes.

#### Configuration and Settings Improvements
*   **[TASK]** Enhance the **`SettingsUI`** to load and use the `settings.schema.json` file, enabling a richer editing experience with validation and descriptions.
*   **[FEATURE]** Allow user-defined modes to be created and managed entirely from the UI via the `JSON` module.

#### Module System Improvements
*   **[FEATURE]** Implement the core logic in `init.js` to handle **dynamic external module loading** from a URL.
*   **[FEATURE]** Implement the reordering logic (`▲`/`▼` buttons) in the **`Modules` panel** and persist the new order via the `JSON` module.

---

## Long-Term & Experimental Ideas

These are ambitious features for future consideration.

*   **Multi-Game Support:** Improve the architecture to more easily support games beyond the current set, with a focus on streamlining the process of adding new game-specific logic handlers.
*   **Reverse Exporter (`APWorld` Generation):** Implement the planned tool to generate a playable `.apworld` file from a `rules.json` file, effectively reversing the export process.
*   **Advanced Analysis Tools:** Add new developer panels for graph visualization of the region map, sphere analysis, and critical path identification.
