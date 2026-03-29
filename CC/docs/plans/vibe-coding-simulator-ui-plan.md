# Vibe Coding Simulator — UI Plan

## Overview

The interface serves two modes through the same UI:

- **Simulator mode** — Data comes from the simulation engine. The source of truth is the completion status of each feature, and everything else (tests, task progress, regressions) is simulated. Time controls are visible.
- **Real project mode** — Data comes from actual project files. The source of truth is the code, test results, planning docs, Claude instance status, and GitHub repository. Time controls are hidden.

The UI is a frontend module within the existing Archipelago-CC frontend, using the same module registration, event bus, dispatcher, and panel system.

See also: [Main planning doc](plan.md), [Balance variables](../../projects/VibeCodingSimulator/balance.md)

---

## Data Abstraction Layer

Both modes feed the same data shape into the UI. The interface never knows which mode it's in — it just renders whatever data it receives.

```
Feature:
  id: string
  name: string
  phases: [{id, name, status, completion}]
  dependencies_upstream: [feature_id]
  dependencies_downstream: [feature_id]
  related_tests: [test_id]
  doc_content: string (markdown)
  doc_meta: object (parsed PLAN_META)
  active_tasks: [task_id]

Test:
  id: string
  name: string
  status: pass | fail | partial | unknown
  lines_matching: number
  lines_total: number
  last_updated: timestamp
  related_features: [feature_id]

Task:
  id: string
  type: implement | merge_conflict | test_workflow
  target_feature: feature_id | null
  target_phase: phase_id | null
  status: running | completed | cancelled | failed | merge_conflict
  progress: 0.0–1.0
  subtask_label: string
  started_at: timestamp
  completed_at: timestamp | null
```

### Data sources by mode

**Simulator mode:**
- Features, tests, tasks all produced by the simulation engine

**Real project mode (V1):**
- Features: extracted from PLAN_META in planning docs (extraction script already built)
- Tests: from `results.json` (need adapter)
- Test-to-feature mapping: from `feature_categories.json` (already exists)
- Planning doc content: from the markdown files (need adapter)
- Tasks / Claude instances: deferred from V1
- GitHub workflow status: deferred from V1

---

## Layout

Three-column layout within a single panel. Each column has its own header bar (with show/hide toggles and controls) and its own action button area at the bottom. A simulator toolbar sits above the columns (simulator mode only).

```
+----------------------------------------------------------+
| [Toolbar: Day/Time | Credits | Speed | Wait controls]    |  <- simulator mode only
+----------------------------------------------------------+
| [Features] [Tests] [Tasks]   <- column toggle buttons    |
+------------------+------------------+--------------------+
| Features header  | Tests header     | Tasks header       |
| (sort, search)   | (sort, search)   | (filter)           |
+------------------+------------------+--------------------+
|                  |                  |                    |
|  [Feature cards] |  [Test cards]    |  [Task cards]      |
|  (scrollable)    |  (scrollable)    |  (scrollable)      |
|                  |                  |                    |
+------------------+------------------+--------------------+
| Feature actions  | Test actions     | Task actions       |
| (for selected)   | (for selected)   | (for selected)     |
+------------------+------------------+--------------------+
```

### Column visibility

Toggle buttons at the top show/hide each column. Hidden columns' space is redistributed to visible columns. The toggle buttons can optionally work as tabs (showing only one column at a time) for narrow layouts.

### Column widths

Columns are resizable by dragging the dividers between them.

---

## Region Graph Integration

The existing Region Graph module visualizes the dependency graph. No new graph module needed.

**Configuration:**
- Regions = features
- Nodes colored by test-result-derived status (green = passing, red = failing, yellow = partial, gray = not started)
- Hierarchical layout (DAG-appropriate)

**Click handling:**
- The vibe coding module listens for `user:regionClicked` on the event dispatcher
- It intercepts the event (does not pass it on) since it's near the end of the module list
- On intercept: selects the corresponding feature in the Feature view and scrolls to it

**Settings for this game:**
- `movePlayerOneStep`: false
- `movePlayerDirectly`: false
- `showRegionInPanel`: false
- `checkAllLocationsInRegion`: false

---

## Feature View (left column)

A scrollable list of feature cards. Multiple cards can be expanded simultaneously.

### Always visible (collapsed state)
- Feature name
- Locked/unlocked indicator (locked = dependencies not met, unlocked = ready to work on)
- Status color (derived from test results: green/yellow/red/gray)
- Completion bar (overall feature completion across phases)
- Count of passing/failing tests (compact, e.g., "8/10 tests")

### Expanded (on click/selection)
- **Phases**: List with per-phase completion, status, and locked/unlocked indicator
- **Dependencies**:
  - Upstream (features this depends on) — clickable, scrolls to that feature
  - Downstream (features that depend on this) — clickable, scrolls to that feature
- **Tests**: List of related tests, color-coded by status
- **Active tasks**: Claude instances currently working on this feature, each showing progress bar and subtask label

### Controls (in column header)
- **Sort options**: by name, by status, by completion %, by dependency order (topological)
- **Search/filter**: text box to filter by feature name
- **Filter by status**: buttons or checkboxes for passing/failing/blocked/in-progress

### Selection behavior
Clicking a feature card:
- Expands that card (multiple can be expanded)
- Shows available actions in the Feature action area
- Highlights the corresponding node in the Region Graph

### Feature action area
- "Implement" — creates a new Claude instance and assigns it to implement the next unlocked phase in this feature. Disabled if feature is locked or no unlocked incomplete phases exist.

---

## Test View (middle column)

A scrollable list of test cards.

### Card contents
- Test name
- Status indicator (color-coded: green = pass, red = fail, yellow = partial)
- Line match count (e.g., "54/54" or "309/338")
- Timestamp of last update
- Related features (clickable, scrolls to feature in Feature view)

**Important:** The UI only shows regressions that have been detected by running tests. Undetected regressions are not visible — discovering them is part of the strategy.

### Controls (in column header)
- Sort by name, status, last updated
- Search/filter text box
- Filter by status (pass/fail/partial)

### Test action area
- "View Feature" — scroll to the related feature in Feature view

---

## Task View (right column)

A scrollable list of task entries.

### Running tasks (top section)
Each entry shows:
- Task type and target (e.g., "Implement: DATABASE.3")
- Progress bar with subtask label (e.g., "implementing", "regression testing")
- Time elapsed

### Test workflow (special entry, always visible)
- If running: progress bar, elapsed time
- If not running: "Run Tests" button
- If complete: summary of results ("18/20 passing"), time since completion

### Completed/stopped tasks (below section)
- Recent completed tasks with outcome (completed, cancelled, failed)
- Merge conflicts awaiting resolution

### Controls (in column header)
- Filter: show/hide completed tasks

### Task action area

When a running task is selected:
- "Cancel" — cancel the task, discard changes
- "Skip Testing" — end regression testing early, commit now

When a merge conflict is selected:
- "Resolve" — create a new Claude instance to attempt merge conflict resolution
- "Discard" — discard the conflicting changes

---

## Branches and Merging

When a Claude instance is assigned to implement a feature while another instance is already working on the same feature, the second instance works on a separate branch. When the second instance finishes, a merge conflict occurs.

The player must then choose:
- **Resolve** — assign a new Claude instance to resolve the merge conflict. This is itself a task that takes time and can cause regressions.
- **Discard** — discard the second instance's changes. The time and credits spent are lost.

This makes parallel work on the same feature a deliberate risk/reward decision.

---

## Instance Lifecycle

Each task creates a new Claude instance. There is no limit on concurrent instances other than credit cost. When a task completes (or is cancelled), the instance stops.

Context management (reusing instances, context windows, compaction) is deferred to a future version.

---

## Planning Docs

For V1, implementing a feature does not require a separate "write planning doc" step. Planning docs are assumed to already exist.

In the real project, planning docs were written as needed — when tasks requiring planning were discovered, not all upfront. In a future version, writing the planning doc will be a prerequisite task that Claude instances can be assigned, with its own failure modes (inaccurate information). This will be an important part of the gameplay: discovering what needs to be planned, assigning Claude to write the plan, then assigning implementation.

---

## Simulator Mode Toolbar

A persistent toolbar at the top of the panel, only visible in simulator mode.

Contents:
- **Day and time**: "Day 3 14:30"
- **Credits**: "72.5h remaining" with a subtle weekly usage bar
- **Speed controls**: Pause, 1x, 2x, 5x, 10x (multiplier on `time_scale`)
- **Wait buttons**: "Wait 1h", "Wait 8h"

---

## Event Flow

### Feature selection (from Feature view)
1. User clicks feature card
2. Card expands, action area updates
3. Region Graph highlights corresponding node (via event bus)

### Feature selection (from Region Graph)
1. User clicks node in Region Graph
2. Module intercepts `user:regionClicked` on the dispatcher
3. Feature view scrolls to and expands the corresponding card
4. Feature action area updates

### Task assignment (simulator mode)
1. User selects a feature with unlocked phases
2. Clicks "Implement" in Feature action area
3. If multiple unlocked phases: picker appears. If one: auto-selects.
4. A new Claude instance is created and assigned the task
5. Task appears in Task view with progress bar
6. Feature card shows the active task

### Task completion
1. Simulation engine completes the task
2. Phase completion updates (but regressions are hidden until tests are run)
3. Task moves to "completed" in Task view
4. If merge conflict: task shows as "merge conflict", resolution actions available
5. Feature card updates completion bar
6. Region Graph node color updates based on last known test results

### Merge conflict
1. Second instance on same feature finishes
2. Merge conflict entry appears in Task view
3. Player clicks it, chooses "Resolve" or "Discard" in Task action area
4. If Resolve: new instance created to resolve, can itself regress or fail

### Test workflow
1. User clicks "Run Tests" in Task view
2. Test workflow entry appears with progress bar
3. On completion: Test view cards update with new results
4. Feature card colors update based on new test results
5. Previously hidden regressions become visible

---

## Design Decisions

- **Editor panel integration**: Deferred from V1. Planning docs will open in the Editor panel in a future version.
- **Task history depth**: Configurable limit, default 100 completed tasks shown.
- **Speed controls**: Discrete buttons (Pause, 1x, 2x, 5x, 10x).
- **"Wait until next event"**: Deferred from V1.
- **Locked/unlocked status**: Visible on both feature cards (collapsed) and individual phases (expanded). A feature is locked if any of its upstream dependencies are incomplete.

- **Region Graph locked features**: No special styling beyond the existing gray/not-started color. Keep it simple.
- **Merge conflict visibility**: Only in the Task view. Feature cards don't show a special merge conflict state.
- **Column default widths**: Equal thirds.
