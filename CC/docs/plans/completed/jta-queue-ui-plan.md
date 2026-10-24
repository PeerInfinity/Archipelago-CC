# JTA Action Queue UI — Full Feature Plan

> **Status (2026-07-05): CLOSED — archived by the JtA substrate-integration
> review.** 9 of 11 phases shipped in March 2026. The two remaining phases are
> dropped, not pending: Phase 4 (separable Golden Layout panels) and Phase 11
> (iframe record-mode hooks) targeted the host-side queue stack
> (`jtaActionQueue`/`jtaQueueEngine` driving the `jta-remote/game-bundle` copy),
> whose automation role is superseded by the in-game Fork 1.4/1.5 automation in
> the `journey-to-ascension` submodule (see
> `completed/jta-automation-v2-plan.md`). The fate of the whole host-side stack
> is Phase 5 of `../jta-substrate-integration-plan.md`.

## Context

The JTA Action Queue has a working backend (shared ActionQueue, executor, action catalog, drain strategy, loadout persistence) and a basic UI (action buttons with zone dropdown, flat queue list with remove buttons, start/stop/reset/clear controls, settings panel). This plan upgrades the UI to match the full Idle Loops action queue feature set, adapted for JTA's mechanics.

The Idle Loops action queue (omsi-loops) is the reference implementation. Its UI code lives in:
- `iframe_games/omsi-loops/views/main.view.js` — rendering (D3-based next list, innerHTML current list)
- `iframe_games/omsi-loops/driver.js` — button handlers, drag-and-drop
- `iframe_games/omsi-loops/actions.js` — queue management, zone spans, undo

## Current State

### What exists (Step 1, completed)
- `shared/actionQueue/actionQueue.js` — ActionQueue with cursor, reorder(), serialize/deserialize
- `shared/actionQueue/loadoutManager.js` — named loadout persistence
- `jtaActionQueue/jtaQueueExecutor.js` — executor driving queue via eventBus
- `jtaActionQueue/jtaActionDefs.js` — action catalog from game definitions
- `jtaActionQueue/jtaEnergyDrainStrategy.js` — drain task selection
- `jtaActionQueue/jtaQueuePanelUI.js` — basic queue list display
- `jtaActionQueue/jtaActionsPanelUI.js` — action buttons with zone dropdown
- `jtaActionQueue/index.js` — module registration, panel component with controls and settings

### What's missing
Everything below.

## Feature Plan

### Phase 1: Per-Action Controls

Add control buttons to each queue entry. Idle Loops has 9 buttons per action. For JTA we need 7:

**Buttons per queue entry:**

| Button | Icon | Action | Notes |
|--------|------|--------|-------|
| Move Up | `^` | Swap with entry above | Uses `ActionQueue.reorder()` |
| Move Down | `v` | Swap with entry below | Uses `ActionQueue.reorder()` |
| Add Loop | `+` | Increment `loops` by `addAmount` | Clamp to 1..1e12 |
| Remove Loop | `-` | Decrement `loops` by `addAmount` | Clamp to 1..1e12 |
| Collapse | `v/^` | Toggle collapse of zone span | Hide non-travel actions within a zone |
| Disable | `o/` | Toggle `disabled` flag | Entry stays in queue but is skipped |
| Remove | `x` | Remove entry from queue | Already exists |

No cap button — JTA doesn't have limited-count actions the way Idle Loops does.
No split button — JTA tasks typically want all reps, splitting loop counts isn't useful.

**Zone collapse:** JTA actions are clearly divided by zone with transition points (travel tasks). Although JTA zones have fewer actions than Idle Loops towns, collapsing zones is still useful when the queue is long (many zones queued). The collapse button appears on zone-transition actions and hides non-travel actions within that zone span.

**Loop amount controls:**
JTA tasks typically want "run all reps" rather than a specific count. For items/artifacts, users usually want 1 or all. Instead of Idle Loops' 1/5/10 presets:
- Default `addAmount` is 1
- Custom input field for arbitrary amounts
- Consider a "Max" button per entry that sets loops to the task's `maxReps`
- For items: "Use 1" and "Use All" are already separate action types in the catalog

**Files to modify:**
- `jtaQueuePanelUI.js` — add buttons to entry rendering, add amount selector
- `actionQueue.js` — add `updateEntry(entryId, changes)` method

**HTML structure per entry (reference: main.view.js line 679):**
```html
<div class="aq-entry" data-entry-id="..." draggable="true">
    <span class="aq-entry-label">Task Name x3 (1/3)</span>
    <span class="aq-entry-group">Zone 1</span>
    <span class="aq-entry-state">active</span>
    <div class="aq-entry-buttons">
        <button class="aq-btn-up" title="Move up">^</button>
        <button class="aq-btn-down" title="Move down">v</button>
        <button class="aq-btn-plus" title="Add loops">+</button>
        <button class="aq-btn-minus" title="Remove loops">-</button>
        <button class="aq-btn-collapse" title="Collapse zone">v</button>
        <button class="aq-btn-disable" title="Disable">o/</button>
        <button class="aq-btn-remove" title="Remove">x</button>
    </div>
</div>
```

### Phase 2: Drag-and-Drop Reordering

Reference: `driver.js` lines 633-673, `main.view.js` lines 1899-1914.

**Implementation:**
- Set `draggable="true"` on each `.aq-entry`
- `dragstart`: store `entryId` in `dataTransfer`, add `aq-dragging` class
- `dragover`: `preventDefault()` to allow drop, add `aq-drag-over` class to target
- `dragleave`: remove `aq-drag-over` class
- `drop`: read source `entryId`, calculate new index, call `ActionQueue.reorder()`
- `dragend`: remove all drag classes

**Also support dragging from actions panel to queue:**
- Action buttons get `draggable="true"`
- `dragstart` sets action data (type + id) in `dataTransfer`
- Drop on queue creates new entry at drop position

**CSS classes:**
- `.aq-dragging` — source element opacity reduction
- `.aq-drag-over` — drop target highlight (border or background change)

**Files to modify:**
- `jtaQueuePanelUI.js` — drag event handlers on entries
- `jtaActionsPanelUI.js` — drag support on action buttons

### Phase 3: Dual Queue (Next List / Current List)

Reference: `actions.js` lines 59-77, 290-359.

The core concept: users edit a **next list** (the plan). When execution starts, the next list is copied to a **current list** with runtime state. During execution, the current list shows progress while the next list remains editable.

**Architecture:**

```
ActionQueue (next list) — user edits this, persisted
    |
    | on start/restart: snapshot
    v
ExecutionSnapshot (current list) — read-only, tracks runtime state
    entries[] — copy of next list entries at start time
    statuses[] — per-entry: state, loopsCompleted, ticks, energyUsed, error, etc.
```

**Display modes:**
1. **Stopped/idle**: Only next list shown (editable)
2. **Running**: Current list on top (read-only, with progress), next list below (still editable)
3. **Finished**: Current list shows final state, next list editable

**Current list entry rendering:**
```html
<div class="aq-current-entry" data-entry-id="...">
    <div class="aq-progress-bar" style="width: 65%"></div>
    <img class="aq-entry-icon" src="...">
    <span class="aq-loops-done">3</span>/<span class="aq-loops-total">5</span>
    <span class="aq-entry-label">Task Name</span>
</div>
```

**Runtime state per current entry** (reference: actions.js line 340-358):
```javascript
{
    // Copied from next list:
    entryId, actionType, actionId, label, group, loops, disabled,
    // Runtime tracking:
    loopsLeft,          // loops remaining
    loopsCompleted,     // loops done
    ticks,              // current tick progress within action
    adjustedTicks,      // total ticks needed for this rep
    energyUsed,         // total energy spent on this action
    lastEnergy,         // energy spent on last rep
    energyRemaining,    // predicted energy remaining after action
    timeSpent,          // wall clock time spent
    errorMessage,       // failure reason (null if ok)
}
```

**Files to modify:**
- `jtaQueueExecutor.js` — create execution snapshot on start, track runtime state
- `jtaQueuePanelUI.js` — render current list above next list, update progress bars
- `index.js` — wire up current list display

**Files to create:**
- `jtaExecutionSnapshot.js` — ExecutionSnapshot class (or add to existing executor)

### Phase 4: Separable Golden Layout Panels

The Next List, Current List, and Available Actions should each be registerable as separate Golden Layout panels. When the separate panel module isn't active, it falls back to sharing a single combined panel (current behavior).

**Panel types:**
- `jtaActionQueue` — combined panel (existing, becomes the fallback)
- `jtaNextList` — next list only (middle column)
- `jtaCurrentList` — current list only (left column)
- `jtaAvailableActions` — available actions only (right column)

**Architecture:**
Each sub-panel registers as a separate module with its own `moduleInfo`. The combined panel checks whether the sub-panels are active and hides sections that have their own panel. All panels share the same underlying `queue`, `executor`, and `catalog` instances via module-level exports (`getQueue()`, `getExecutor()`, `getCatalog()`).

**Communication:** The sub-panels use the eventBus to coordinate refreshes. When the queue changes, all active panels refresh.

**Files to create:**
- `jtaNextListPanel/index.js` — module registration for standalone next list panel
- `jtaCurrentListPanel/index.js` — module registration for standalone current list panel
- `jtaAvailableActionsPanel/index.js` — module registration for standalone actions panel

**Files to modify:**
- `jtaActionQueue/index.js` — detect which sub-panels are active, hide corresponding sections

### Phase 5: Progress Bars and State Coloring

Reference: `main.view.js` lines 791-847.

**Current list progress bar:**
- Horizontal fill bar behind entry text
- Width = `100 * ticks / adjustedTicks` percent
- Colors:
  - In progress: `var(--aq-progress-bg)` (blue/teal)
  - Completed: `var(--aq-completed-bg)` (green)
  - Failed: `var(--aq-error-bg)` (red)
  - Skipped: `var(--aq-skipped-bg)` (gray)

**Next list state indicators:**
- Active entry: highlighted border or background
- Disabled entry: dimmed opacity + strikethrough
- Zone color tinting (subtle background based on zone)

**Zone tint colors:**
Assign each zone a subtle background color. JTA has 27 zones, so use a rotating palette. Reference: main.view.js line 718-728 uses `this.zoneTints[townNum]`.

```javascript
const ZONE_TINTS = [
    'rgba(100, 150, 255, 0.08)',  // zone 0
    'rgba(100, 255, 150, 0.08)',  // zone 1
    // ... generate programmatically using HSL
];
```

**Files to modify:**
- `jtaQueuePanelUI.js` — progress bar rendering, state classes, zone tints
- Add CSS variables to the panel's `<style>` block

### Phase 6: Action Tooltips

Reference: `main.view.js` lines 769-784.

**Hover over a current list entry to see:**
- Action name and type
- Energy cost (original / adjusted)
- Energy used so far
- Energy remaining for this action
- Loops completed / total
- Time spent
- Error message (if failed)

**Implementation:**
- `mouseenter` on current entry -> show tooltip div
- `mouseleave` -> hide tooltip
- Tooltip content updated from executor's runtime state
- Position: below the entry or in a fixed tooltip container

**Files to modify:**
- `jtaQueuePanelUI.js` — tooltip rendering and hover handlers

### Phase 7: Undo System

Reference: `actions.js` lines 562-580.

Single-level undo for queue edits. Before any modification, snapshot the current state.

**Implementation:**
```javascript
// In ActionQueue:
#lastSnapshot = null;

recordLast() {
    this.#lastSnapshot = this.serialize();
}

undoLast() {
    if (!this.#lastSnapshot) return;
    const current = this.serialize();
    this.deserialize(this.#lastSnapshot);
    this.#lastSnapshot = current; // swap so undo toggles
}
```

- Call `recordLast()` before: add, remove, reorder, split, clear, updateEntry
- Add "Undo" button to controls bar

**Files to modify:**
- `actionQueue.js` — add `recordLast()` and `undoLast()` methods
- `index.js` — add undo button to controls

### Phase 8: Resource Prediction (Simulator-Based)

Use the existing `jta-randomizer/simulator.js` for cost prediction. The simulator already has all the energy cost formulas, skill effects, perk modifiers, and zone progression math.

**Approach:**
1. Snapshot current game state from iframe (energy, skills, perks, zone, etc.)
2. Feed the queue entries into the simulator as a sequence of actions
3. The simulator calculates energy cost per action based on current state
4. Display predicted energy cost and remaining energy inline in the next list

**If the simulator is missing features needed for prediction:**
- Add them to `simulator.js` rather than building a separate prediction system
- The simulator should be the single source of truth for JTA game math

**Display:**
Following the Idle Loops Koviko predictor pattern, show predictions inline in the next list:
```html
<div class="aq-entry">
    <span class="aq-entry-label">Boss Fight x2</span>
    <span class="aq-prediction">
        <span class="aq-pred-cost">-450 E</span>
        <span class="aq-pred-remaining">1,230 E</span>
    </span>
</div>
```

Color-code remaining energy:
- Green: > 50% max
- Yellow: 10-50% max
- Red: < 10% max
- Dark red + strikethrough: would run out (insufficient energy)

**Files to create:**
- `jtaQueuePredictor.js` — adapter between queue entries and simulator

**Files to modify:**
- `jta-randomizer/simulator.js` — add any missing prediction support
- `jtaQueuePanelUI.js` — display predictions inline

### Phase 9: Settings Enhancements

Reference: index.html lines 378-389.

**Add to settings panel:**

| Setting | Default | Effect |
|---------|---------|--------|
| Add actions to top | off | New actions insert at front of queue |
| Keep current list on restart | off | Don't overwrite current list from next list |
| Auto-drain energy | on | Already exists — keep this JTA-specific feature |
| Drain strategy | mostDraining | Already exists — mostDraining / highestXp |
| Auto-reset on depletion | off | Already exists |

**Files to modify:**
- `index.js` — add new checkboxes to settings panel, persist to localStorage

### Phase 10: Loadout UI and Loadout Sequencing

The `LoadoutManager` already supports multiple named queues. Add UI to switch between them, plus a system for automatically transitioning between loadouts.

**Basic loadout UI:**
- Dropdown showing loadout names
- "Save" button (saves current queue to active loadout)
- "New" button (creates empty loadout)
- "Rename" button (rename active loadout)
- "Delete" button (delete active loadout)

**Loadout sequencing (two options, implement one or both):**

**Option A: Meta-queue**
A separate queue where the "actions" are loadouts. The meta-queue runs loadout 1, then loadout 2, etc. Available actions in the meta-queue are the named loadouts. This reuses the existing queue UI pattern.

**Option B: Per-loadout transitions**
Each loadout has a footer specifying:
- How many times to repeat this loadout (default: 1, 0 = infinite)
- Which loadout to switch to after finishing (default: none / stop)

Option B is simpler to implement and more intuitive for linear progressions.

**Position:** In controls bar or settings panel.

**Files to modify:**
- `index.js` — loadout dropdown and buttons
- `loadoutManager.js` — add repeat count and next-loadout fields
- `jtaQueuePanelUI.js` — refresh on loadout switch

### Phase 11: Iframe Game Button Hooks (Future)

Add a mode where clicking action buttons in the JTA game iframe adds the action to the queue instead of performing it immediately. This provides a more intuitive way to build queues — play the game normally, and your actions get recorded.

**Architecture:**
- New event: `jta:setRecordMode` — tells the iframe to intercept clicks
- When record mode is on, `clickTask()` / `clickItem()` sends `jta:actionRecorded` instead of executing
- Parent receives `jta:actionRecorded` and adds to queue
- Toggle button in the queue panel: "Record Mode"

**Files to modify:**
- `jtaGameClient.js` — intercept game clicks in record mode
- `iframe_games/journey-to-ascension/game.ts` — hook click handlers
- `index.js` — record mode toggle button

## Implementation Order

1. ~~Phase 1 (per-action controls)~~ — DONE
2. ~~Phase 2 (drag-and-drop)~~ — DONE
3. ~~Phase 7 (undo)~~ — DONE
4. ~~Phase 3 (dual queue)~~ — DONE
5. ~~Phase 5 (progress bars + zone tinting)~~ — DONE
6. ~~Phase 6 (tooltips)~~ — DONE
7. Phase 4 (separable panels) — Golden Layout integration
8. ~~Phase 9 (settings)~~ — DONE (add-to-top, stop-after)
9. ~~Phase 10 (loadout UI + sequencing)~~ — DONE
10. ~~Phase 8 (resource prediction)~~ — DONE
11. Phase 11 (iframe hooks) — future enhancement

## Shared Code Considerations

Phases 1, 2, 3, 7 modify `shared/actionQueue/` and create UI patterns that will transfer to future game queue implementations. The rendering code in `jtaQueuePanelUI.js` can serve as a template for a game-agnostic `queuePanelUI.js` in `shared/actionQueue/`.

Phase 8 is inherently game-specific (uses the JTA simulator) but the display pattern (inline predictions with color coding) should be extracted as a shared UI helper.

The auto-drain feature (Phases 9) is JTA-specific but the pattern could apply to other incremental games where resources deplete.
