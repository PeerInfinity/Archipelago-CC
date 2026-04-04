# Vibe Coding Simulator — UI Plan

## Overview

The interface serves two modes through the same UI:

- **Simulator mode** — Data comes from the simulation engine. The source of truth is the completion status of each feature, and everything else (tests, task progress, regressions) is simulated. Time controls are visible.
- **Real project mode** — Data comes from actual project files. The source of truth is the code, test results, planning docs, Claw instance status, and GitHub repository. Time controls are hidden.

The UI is a frontend module within the existing Archipelago-CC frontend, using the same module registration, event bus, dispatcher, and panel system.

See also: [Main planning doc](plan.md), [Balance variables](../../projects/VibeCodingSimulator/balance.md)

---

## Data Abstraction Layer

Both modes feed the same data shape into the UI. The interface never knows which mode it's in — it just renders whatever data it receives.

```
Feature:
  id: string
  name: string
  dependencies_upstream: [feature_id]
  dependencies_downstream: [feature_id]
  active_tasks: [task_id]
  # Hidden state (simulator only — not shown directly in UI):
  doc_completeness: 0.0–1.0
  code_completeness: 0.0–1.0
  test_completeness: 0.0–1.0
  # Player-visible state:
  has_planning_doc: boolean
  has_code: boolean
  has_tests: boolean
  test_result_percent: number | null     # from last test run; product of own and upstream results
  test_result_updated: timestamp | null
  manual_test_result: null | "incomplete" | "doc" | "code" | "tests" | "pass"

Task:
  id: string
  type: write_doc | evaluate_doc | implement | write_tests | merge_conflict | test_workflow | manual_test
  target_feature: feature_id | null
  status: running | completed | cancelled | failed | merge_conflict
  progress: 0.0–1.0
  subtask_label: string
  started_at: timestamp
  completed_at: timestamp | null
  reported_success: boolean         # 50% chance of accurately reporting incompleteness
```

### Data sources by mode

**Simulator mode:**
- Features, tests, tasks all produced by the simulation engine

**Real project mode (V1):**
- Features: extracted from PLAN_META in planning docs (extraction script already built)
- Tests: from `results.json` (need adapter)
- Test-to-feature mapping: from `feature_categories.json` (already exists)
- Planning doc content: from the markdown files (need adapter)
- Tasks / Claw instances: deferred from V1
- GitHub workflow status: deferred from V1

---

## Layout

Two-column layout within a single panel. Each column has its own header bar (with controls) and its own action button area at the bottom. A simulator toolbar sits above the columns (simulator mode only).

```
+----------------------------------------------------------+
| [Toolbar: Day/Time | Credits | Speed | Wait controls]    |  <- simulator mode only
+----------------------------------------------------------+
| [Features] [Tasks]              <- column toggle buttons  |
+-------------------------------+--------------------------+
| Features header               | Tasks header             |
| (sort, search, filter)        | (filter)                 |
+-------------------------------+--------------------------+
|                               |                          |
|  [Feature cards]              |  [Task cards]            |
|  (scrollable)                 |  (scrollable)            |
|                               |                          |
+-------------------------------+--------------------------+
| Feature actions               | Task actions             |
| (for selected feature)        | (for selected task)      |
+-------------------------------+--------------------------+
```

### Column visibility

Toggle buttons at the top show/hide each column. Hidden columns' space is redistributed to the visible column. The toggle buttons can optionally work as tabs for narrow layouts.

### Column widths

Columns are resizable by dragging the divider between them.

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
- Dependencies-met indicator (features whose upstream dependencies haven't all passed manual testing show a warning — tasks for these features take twice as long)
- Status indicators showing what exists: doc / code / tests (icons or badges, present/absent)
- Test result percentage (from last test run, if available) — color-coded (green >= 95%, yellow >= 50%, red < 50%, gray = not tested)
- Manual test result if performed (pass / incomplete / which area is the problem)

### Expanded (on click/selection)
- **Dependencies**:
  - Upstream (features this depends on) — clickable, scrolls to that feature
  - Downstream (features that depend on this) — clickable, scrolls to that feature
- **Test result**: Result percentage for this feature, color-coded. The displayed value is the product of this feature's test result and all upstream features' test results, reflecting that tests exercise the full dependency chain.
- **Active tasks**: Claw instances currently working on this feature, each showing progress bar and subtask label
- **Task history**: Recent completed tasks for this feature with Claw's reported outcomes (50% chance of accurately reporting incompleteness, 50% chance of falsely reporting success)

Note: The player does **not** see doc/code/test completeness percentages. They only see binary indicators (exists/doesn't exist), Claw's task reports (which may be optimistic), test result percentages (which are ambiguous — limited by both test completeness and upstream feature quality), and manual test results.

### Controls (in column header)
- **Sort options**: by name, by test result %, by dependency order (topological)
- **Search/filter**: text box to filter by feature name
- **Filter by status**: buttons or checkboxes for passing/failing/blocked/in-progress

### Selection behavior
Clicking a feature card:
- Expands that card (multiple can be expanded)
- Shows available actions in the Feature action area
- Highlights the corresponding node in the Region Graph

### Feature action area

Available actions depend on the feature's current state. Actions are grouped by workflow stage:

**Planning:**
- **"Write Planning Doc"** — creates a new Claw instance to write the planning doc. Only available if no doc exists yet.
- **"Evaluate Doc"** — creates a new Claw instance to review and potentially improve the planning doc. Only available if a doc exists.

**Implementation:**
- **"Implement"** — creates a new Claw instance to implement the feature (first attempt or re-implementation). Only available if a doc exists.
- **"Debug Code"** — creates a new Claw instance to investigate and fix code issues. Same mechanics as re-implementation (universal outcome formula). Only available if code exists.

**Testing:**
- **"Write Tests"** — creates a new Claw instance to write or improve tests. Only available if a doc exists.
- **"Debug Tests"** — creates a new Claw instance to investigate and fix test issues. Same mechanics as test re-implementation (universal outcome formula). Only available if tests exist.

**Verification:**
- **"Manual Test"** — the player manually tests this feature. Takes 1 simulated hour, blocks the player from starting new actions during that time. Available if code and tests exist. First run reveals pass/incomplete; follow-up reveals which of doc/code/tests is the problem.

Note: "Implement" and "Debug Code" use the same underlying mechanics (first implementation vs re-implementation formula). Similarly "Write Tests" and "Debug Tests". The separate labels help the player understand the workflow stage, but they could be combined into single buttons that adapt their label based on whether code/tests already exist.

---

## Task View (right column)

A scrollable list of task entries.

### Running tasks (top section)
Each entry shows:
- Task type and target (e.g., "Implement: DATABASE", "Write Doc: AUTH", "Manual Test: TASKS")
- Progress bar with subtask label (e.g., "investigating", "implementing", "regression testing")
- Time elapsed
- Claw's latest status report (e.g., "implementation looks good" — may be inaccurate)

### Manual test (special entry, when active)
- Shows which feature is being tested
- Progress bar (1 hour duration)
- Player is blocked from starting new actions (indicated visually)

### Test workflow (special entry, always visible)
- If running: progress bar, elapsed time
- If not running: "Run Tests" button
- If complete: summary of results (count of features at various thresholds), time since completion

### Completed/stopped tasks (below section)
- Recent completed tasks with Claw's reported outcome (which may differ from reality)
- Merge conflicts awaiting resolution

### Controls (in column header)
- Filter: show/hide completed tasks

### Task action area

When a running task is selected:
- "Cancel" — cancel the task, discard changes
- "Skip Testing" — end regression testing early, commit now

When a merge conflict is selected:
- "Resolve" — create a new Claw instance to attempt merge conflict resolution
- "Discard" — discard the conflicting changes

---

## Branches and Merging

When a Claw instance is assigned to implement a feature while another instance is already working on the same feature, the second instance works on a separate branch. When the second instance finishes, a merge conflict occurs.

The player must then choose:
- **Resolve** — assign a new Claw instance to resolve the merge conflict. The starting point is the higher completion of the two branches. Uses the universal outcome formula. Can cause regressions.
- **Discard** — discard the second instance's changes. The time and credits spent are lost.

This makes parallel work on the same feature a deliberate risk/reward decision.

---

## Instance Lifecycle

Each task creates a new Claw instance. There is no limit on concurrent instances other than credit cost. When a task completes (or is cancelled), the instance stops.

Context management (reusing instances, context windows, compaction) is deferred to a future version.

---

## Planning Docs

Writing the planning doc is the first step for each feature. The player assigns a Claw instance to write the doc, which has a 50% chance of producing a complete doc and 50% chance of producing a partial one (25–75% completeness). The player doesn't know which outcome occurred.

The player can then assign Claw to evaluate the doc (attempting to improve it), or proceed directly to implementation (risking building on an incomplete plan). This creates a strategic choice: invest time in doc quality, or rush to implementation and discover issues later.

In the real project, planning docs were written as needed — when tasks requiring planning were discovered, not all upfront.

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
1. User selects an unlocked feature
2. Clicks an action in Feature action area (Write Doc, Evaluate Doc, Implement, Write Tests, or Manual Test)
3. For Claw tasks: a new Claw instance is created and assigned the task
4. Task appears in Task view with progress bar
5. Feature card shows the active task
6. For Manual Test: player is blocked from starting new actions for 1 hour

### Task completion
1. Simulation engine completes the task
2. Hidden completeness values update (but the player sees only Claw's report)
3. Task moves to "completed" in Task view, showing Claw's reported outcome
4. If merge conflict: task shows as "merge conflict", resolution actions available
5. Feature card updates status indicators (has_doc, has_code, has_tests)
6. Region Graph node color updates only when test results change (after running tests)

### Manual test completion
1. First manual test for a feature: reveals pass or "incomplete"
2. Feature card updates with the result
3. If incomplete: follow-up manual test available, reveals which of doc/code/tests is the problem
4. If all three are 100% complete: feature passes, Archipelago location check awarded

### Merge conflict
1. Second instance on same feature finishes
2. Merge conflict entry appears in Task view
3. Player clicks it, chooses "Resolve" or "Discard" in Task action area
4. If Resolve: new instance created, uses higher completion of the two branches, can regress

### Test workflow
1. User clicks "Run Tests" in Task view
2. Test workflow entry appears with progress bar
3. On completion: feature cards update with new test result percentages
4. Each feature's displayed test result is the product of: min(code,test)/max(code,test) for that feature and all upstream features
5. Feature card colors update based on new results
6. Previously hidden regressions become visible in test results (but player can't tell if bad results are from bad code, incomplete tests, or upstream regressions)
7. Region Graph node colors update

---

## Design Decisions

- **Editor panel integration**: Deferred from V1. Planning docs will open in the Editor panel in a future version.
- **Task history depth**: Configurable limit, default 100 completed tasks shown.
- **Speed controls**: Discrete buttons (Pause, 1x, 2x, 5x, 10x).
- **"Wait until next event"**: Deferred from V1.
- **Dependencies-met status**: Visible on feature cards. Features whose upstream dependencies haven't all passed manual testing are marked with a warning. Tasks for these features take twice as long, but are not blocked. This allows the player to work ahead at a cost, rather than being forced to wait.
- **Hidden completeness**: The player never sees numeric completeness values. Information is revealed through Claw reports (unreliable), test results (ambiguous), and manual testing (ground truth but costly).
- **Region Graph locked features**: No special styling beyond the existing gray/not-started color. Keep it simple.
- **Region Graph node colors**: Based on last test results, not hidden completeness. Nodes stay gray until tests have been run.
- **Merge conflict visibility**: Only in the Task view. Feature cards don't show a special merge conflict state.
- **Column default widths**: Equal halves.
- **Claw's reported success**: 50% chance of accurately reporting that a task isn't fully complete. 50% chance of falsely reporting complete success. The player can't trust Claw's reports alone.
- **Phases vs features**: Each phase from the original dependency graph is treated as a separate feature in the simulator. This simplifies the model — each "feature" has exactly one doc, one code implementation, and one test suite.
- **Test results include dependency chain**: A feature's test result is the product of its own test result and all upstream features' test results. This reflects the reality that tests exercise the full stack — a broken dependency means downstream tests also fail.
- **Cross-feature side effects**: Any task that modifies code completeness in one feature has a 25% chance to affect another feature's code completeness. The change is a random amount between -25% and +25% (can improve or regress), clamped to [0%, 100%], and NOT limited by the target's doc completeness. The affected feature has a 75% chance of being upstream in the dependency chain and a 25% chance of being unrelated. This models the reality that code changes can have unexpected effects elsewhere — sometimes fixing a bug in one area accidentally fixes (or breaks) something upstream.
