# User Guide TODO

User-friendly guides still to be written. See the corresponding technical reference in [developer/modules/](../../developer/modules/) for each.

## Done

- [JSON Panel](./json.md)

## UI Panel Modules

These are the panels users interact with directly — highest priority.

- [ ] dungeons.md — Dungeon bosses and medallion requirements
- [ ] discoveryPanel.md — Discovery mode settings and discovered items
- [ ] editor.md — JSON viewer/editor for inspecting app data
- [ ] editorCodeMirror6.md — CodeMirror 6 editor (syntax highlighting, code folding)
- [ ] events.md — Debug panel for event bus inspection
- [ ] exits.md — Region exits and accessibility status
- [ ] helpers.md — Game helper functions with live evaluation
- [ ] inventory.md — Player item inventory
- [ ] locations.md — Game locations and accessibility status
- [ ] metaGamePanel.md — Loading and managing MetaGame configurations
- [ ] modules.md — Viewing and managing loaded frontend modules
- [ ] pathAnalyzerPanel.md — Path analysis tool
- [ ] playerStatePanel.md — Player's current state (e.g. current region)
- [ ] presets.md — Loading pre-configured game files
- [ ] progressBarPanel.md — Progress bar UI host panel
- [ ] regionGraph.md — Interactive region connectivity visualization
- [ ] regions.md — Game world organized by regions
- [ ] settings.md — Application settings
- [ ] spoilerChecklist.md — Sphere log progression checklist
- [ ] spoilerTest.md — Game logic validation against spoiler log
- [ ] textAdventure.md — Text-based game world interface
- [ ] timerPanel.md — Automated location checking timer
- [ ] iframePanel.md — Generic iframe host panel
- [ ] iframeManagerPanel.md — Loading content into iframe panels
- [ ] windowPanel.md — Status display for a connected browser window
- [ ] windowManagerPanel.md — Opening and managing separate windows

## Core Service Modules

Background modules that power the UI panels — useful for users who want to understand what's happening behind the scenes.

- [ ] stateManager.md — Game state, logic evaluation, and accessibility
- [ ] client.md — WebSocket connection to the Archipelago server
- [ ] timer.md — Automated location checking timer logic
- [ ] discovery.md — Discovered state tracking for Archipelago Loops
- [ ] sphereState.md — Sphere log data and progression tracking
- [ ] metaGame.md — Scripted/tutorial experience orchestration

## Utility Modules

Lower priority — primarily useful to developers.

- [ ] commonUI.md
- [ ] editorCore.md
- [ ] iframe-base.md
- [ ] iframeAdapter.md
- [ ] pathAnalyzer.md
- [ ] playerState.md
- [ ] progressBar.md
- [ ] shared.md
- [ ] window-base.md
- [ ] windowAdapter.md
