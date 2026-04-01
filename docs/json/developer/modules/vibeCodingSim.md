# Vibe Coding Simulator — Technical Reference

Module architecture and code reference for the Vibe Coding Simulator.

For game mechanics and formulas, see the [game documentation](../../games/vibe-coding-simulator/).

## Module Structure

```
frontend/modules/vibeCodingSim/
├── index.js              — Module registration, game loop, lifecycle
├── simEngine.js          — Simulation engine (GameState, Task, Feature, events)
├── vibeCodingSimUI.js    — UI rendering and dynamic updates
└── vibeCodingSim.css     — Panel styles
```

## Key Classes

### SimulationConfig

All tunable parameters for the simulation. Defined with defaults in `simEngine.js`, overridable via constructor.

### Feature

Represents a node in the dependency graph. Holds hidden completeness values (`docCompleteness`, `codeCompleteness`, `testCompleteness`) and visible state (`hasDoc`, `hasCode`, `hasTests`, `manualTestResult`, `testResultPercent`).

### Task

A unit of agent work. Tracks minute-by-minute progress via `elapsedMinutes` and `fractionalMinute`. Contains an array of `TaskEvent` objects and accumulates `pendingQuality` from events.

Key getters: `overallProgress`, `reviewProgress`, `currentSubtaskLabel`, `subtaskBoundaries`, `eventMarkers`.

### TaskEvent

An event that occurred during task execution. Types: `quality` (random per-minute), `outcome` (pre-rolled at task start), `step` (subtask transition), `rewind` (rewind marker).

### GameState

The simulation engine. Manages features, tasks, time, credits, and the review system. Provides the game loop (`tick`), task assignment (`assignTask`), review (`startReview`/`stopReview`), rewind (`rewindToFirstNegative`/`rewindOneStep`/`rewindToStart`), and accept/reject (`acceptTask`/`rejectTask`).

## UI Architecture

### VibeCodingSimUI

Renders a three-column layout: Features, Tasks, and Log. Uses a two-phase rendering model:

- **`render()`** — Full DOM rebuild. Called on state changes (task completion, user actions, new events). Creates all elements and stores references in `this._dyn` for dynamic updates.
- **`updateTick()`** — Lightweight per-frame update. Updates progress bar widths, reveals event markers and log entries as review progresses, toggles button states. Avoids DOM creation.

### Dynamic Element Tracking

The `_dyn` object maps string keys to DOM elements for `updateTick`:

- `task-bar-{id}` — task progress bar fill element
- `task-review-bar-{id}` — review progress bar fill element
- `task-markers-{id}` — array of event marker elements (with `data-position`)
- `task-label-{id}` — task status label element
- `task-log-entries-{id}` — array of event log entry elements (with `data-minute`)
- `task-log-empty-{id}` — "Reviewing..." placeholder element
- `task-log-summary-{id}` — review summary element
- `task-event-count-{id}` — event count at last render (triggers re-render on mismatch)
- `task-rwneg-{id}` — "First Issue" rewind button (for dynamic disabled state)

### Event Marker Reveal

All event markers are created at render time but hidden (`display: none`) if their position exceeds the current review fraction. `updateTick` reveals them by comparing each marker's `data-position` against `task.reviewProgress`. The same pattern is used for event log entries (`data-minute` vs `task.reviewMinute`).

If new events are added to a task between renders (from `_rollMinuteEvent` during ticking), `updateTick` detects the event count mismatch and triggers a full `render()`.

## Game Loop

The game loop in `index.js` uses `requestAnimationFrame`. Each frame:

1. Computes real elapsed time since last frame
2. Calls `gameState.tick(dtReal)` to advance the simulation
3. Calls `panelInstance.updateTick()` to update the UI

The simulation tick handles credit/review budget refresh, task progress, review advancement, merge conflict updates, test workflow, and manual test completion.

## Integration Points

- **Region Graph** — provides the dependency graph structure via `slotData.graph_structure`
- **DepGraph presets** — the simulation loads graph data from DepGraph preset files
- **Settings** — persisted via `settings-vibecoding.json` in the frontend settings system
