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

Represents a node in the dependency graph. Holds hidden completeness values (`docCompleteness`, `codeCompleteness`, `testCompleteness`) and visible state (`hasDoc`, `hasCode`, `hasTests`, `manualTestResult`, `testResultPercent`, `manualReviewIssues`).

### Task

A unit of agent work. Tracks minute-by-minute progress via `elapsedMinutes` and `fractionalMinute`. Contains an array of `TaskEvent` objects and accumulates `pendingQuality` from events. Manual review tasks also hold `_manualReviewEvents` — pre-generated issue events with `{ minute, category, description, revealed }`.

Key getters: `overallProgress`, `reviewProgress`, `currentSubtaskLabel`, `subtaskBoundaries`, `eventMarkers`.

### TaskEvent

An event that occurred during task execution. Types: `quality` (random per-minute), `outcome` (pre-rolled at task start), `step` (subtask transition), `rewind` (rewind marker).

### GameState

The simulation engine. Manages features, tasks, time, credits, and the review system. Provides the game loop (`tick`), task assignment (`assignTask`), review (`startReview`/`stopReview`), rewind (`rewindToFirstNegative`/`rewindOneStep`/`rewindToStart`), and accept/reject (`acceptTask`/`rejectTask`).

Key state flags: `autoAccept`, `autoTest`, `autoRewind`, `_testsDirty`. Manual test state is derived from the task list via computed getters (`isManualTestActive`, `activeManualTestTask`, `manualTestFeatureId`). Completed tasks are pruned to a maximum of 100 via `_pruneCompletedTasks()` (called from `_notify()`), with the count tracked in `clearedTaskCount`.

## UI Architecture

### VibeCodingSimUI

Renders a two-column layout: Features and Tasks. Uses a two-phase rendering model:

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
- `manual-log-entries-{id}` — array of manual review event log entry elements
- `manual-log-empty-{id}` — manual review "Reviewing..." placeholder element

### Event Marker Reveal

All event markers are created at render time but hidden (`display: none`) if their position exceeds the current review fraction. `updateTick` reveals them by comparing each marker's `data-position` against `task.reviewProgress`. The same pattern is used for event log entries (`data-minute` vs `task.reviewMinute`).

If new events are added to a task between renders (from `_rollMinuteEvent` during ticking), `updateTick` detects the event count mismatch and triggers a full `render()`.

## Game Loop

The game loop in `index.js` uses `requestAnimationFrame`. Each frame:

1. Computes real elapsed time since last frame
2. Calls `gameState.tick(dtReal)` to advance the simulation
3. If the render dirty flag is set (from engine callbacks), performs a full `render()`
4. Calls `panelInstance.updateTick()` to update the UI

Engine callbacks (`onStateChanged`, `onLogEntry`) set a `renderDirty` flag rather than calling `render()` directly. This prevents DOM rebuilds mid-tick that could interfere with queued browser click events. The dirty flag is checked once per frame between `tick()` and `updateTick()`, coalescing multiple state changes into a single render.

The simulation tick handles credit/review budget refresh, task progress, review advancement (including auto-rewind), merge conflict updates, auto-test triggering, and test workflow completion.

## Settings Panel

The settings panel is a column view mode (`columnView === 'settings'`) that replaces the feature/task columns. It is rendered by `_renderSettingsPanel(gs)` in the UI class.

### CONFIG_SCHEMA

`CONFIG_SCHEMA` is an exported constant from `simEngine.js` — an array of groups, each containing field descriptors with `key`, `label`, and `step`. The UI iterates this to generate labeled number inputs grouped by category.

### Staging and Apply

When the settings panel opens, the current config is snapshotted into `_pendingConfig`. Inputs modify the staging object. Clicking Apply copies it into `gs.config` via `Object.assign`. This gives explicit-apply semantics.

### Persistence

Save/Load buttons use `localStorage` key `'vcs-config'`. Only config fields described in `CONFIG_SCHEMA` are saved/loaded, and values are validated as numbers before applying.

## Integration Points

- **Region Graph** — provides the dependency graph structure via `slotData.graph_structure`
- **DepGraph presets** — the simulation loads graph data from DepGraph preset files
- **Settings** — persisted via `settings-vibecoding.json` in the frontend settings system
