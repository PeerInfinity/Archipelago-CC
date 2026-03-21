# Loops Panel UI Upgrade Plan

## Status

All 8 phases implemented. All tests pass (497/497).

## Overview

Upgrade the Loops panel UI to incorporate features from the JTA Action Queue panel, including predicted mana costs/remaining, JTA-style action entries with progress bars, and a compact table view. Also fix existing bugs (mana bar display, significant digits) and reorganize the layout.

## Reference Code

| Component | Location |
|-----------|----------|
| Loops panel UI | `frontend/modules/loops/loopUI.js` |
| Loops renderer | `frontend/modules/loops/loopRenderer.js` |
| Loops block builder | `frontend/modules/loops/loopBlockBuilder.js` |
| Loops CSS | `frontend/modules/loops/loop.css` |
| Loops state | `frontend/modules/loops/loopState.js` |
| Action queue manager | `frontend/modules/loops/actionQueueManager.js` |
| XP formulas | `frontend/modules/loops/xpFormulas.js` |
| Queue analyzer | `frontend/modules/loopStats/queueAnalyzer.js` |
| Loop stats UI | `frontend/modules/loopStats/loopStatsUI.js` |
| Player state (path data) | `frontend/modules/playerState/state.js` |
| JTA queue panel UI | `frontend/modules/jtaActionQueue/jtaQueuePanelUI.js` |
| JTA queue CSS (in index.js) | `frontend/modules/jtaActionQueue/index.js` lines 69-427 |

---

## Phase 1: Mana Bar Fix + Color Changes

### 1a. Fix Mana Bar Not Displaying

**Bug**: HTML creates `<div class="mana-bar-fill">` but CSS styles `.mana-bar`. The fill element gets no background color or styling.

**Fix in `loop.css`**: Rename all `.mana-bar` selectors to `.mana-bar-fill`:
- `.mana-bar` → `.mana-bar-fill`
- `.mana-bar.high` → `.mana-bar-fill.high`
- `.mana-bar.medium` → `.mana-bar-fill.medium`
- `.mana-bar.low` → `.mana-bar-fill.low`
- `.mana-bar.reset-flash` → `.mana-bar-fill.reset-flash`

Also verify that `loopRenderer.js:193` (which adds/removes class names like `mana-low`, `mana-medium`, `mana-high`) targets the correct element — it queries `.mana-bar-fill` which is correct.

### 1b. Mana Bar Always Blue

Remove the color-changing behavior. The mana bar should always be `#3498db` (the existing blue), regardless of mana percentage.

**In `loop.css`**: Remove (or comment out) the `.mana-bar-fill.high`, `.mana-bar-fill.medium`, `.mana-bar-fill.low` rules. Keep just:
```css
.mana-bar-fill {
  height: 100%;
  background-color: #3498db;
  transition: width 0.1s linear;
  will-change: width;
}
```

**In `loopRenderer.js`**: Remove the code that adds/removes `mana-low`/`mana-medium`/`mana-high` classes (lines ~193-200). Keep the width calculation and text update.

### 1c. Action Bar Colors

**Main action bar** (`.current-action-progress-bar` in the fixed area under the mana bar): Change from blue `#3498db` to a brighter green, e.g. `#4a4` or `rgba(68, 170, 68, 0.7)`.

**Region action bars** (progress bars inside region header action entries): Dark green matching JTA completed state: `rgba(85, 170, 85, 0.2)`.

These color changes are in `loop.css`:
```css
.current-action-progress-bar {
  background-color: rgba(68, 170, 68, 0.7);  /* brighter green */
}

/* Region action entry progress - see Phase 6 for new structure */
```

---

## Phase 2: Hide Stats + Rearrange Action Text

### 2a. Hide Stats Above Mana Bar

Set the `.loop-stats-container` to hidden. Keep DOM elements for potential future use.

**In `loopUI.js` line ~691**: Add `style="display: none;"` to the `.loop-stats-container` div (it already has inline styles, just add to those). Or add to `loop.css`:
```css
.loop-stats-container {
  display: none;
}
```

### 2b. Rearrange Current Action Display

Move text from inside the progress bar to above it. New layout:

```
Left: "Action 3 of 15: Move to Forest"     Right: "Progress: 35 of 100 mana"
[==================progress bar (no text inside)========================]
```

**In `loopRenderer.js` `updateCurrentActionDisplay()`** (and the duplicate in `loopUI.js`): Change the HTML template:

```javascript
actionContainer.innerHTML = `
  <div class="current-action-label">
    <span>Action ${displayIndex} of ${queueLength}: ${actionName}</span>
    <span class="mana-cost">Progress: ${Math.floor(manaCostSoFar)} of ${actionCost} mana</span>
  </div>
  <div class="current-action-progress">
    <div class="current-action-progress-bar" style="width: ${action.progress}%"></div>
  </div>
`;
```

Remove the `<span class="current-action-value">` that was inside the progress bar.

---

## Phase 3: Significant Digits Fix

**In `loopBlockBuilder.js` `createActionBlockElement()`** (line ~845): The mana cost from `loopState._calculateActionCost()` returns a raw float (e.g. `9.523809523809524`).

**Fix**: Display with 1 decimal place:
```javascript
<span class="action-mana">-${manaCost.toFixed(1)} Mana</span>
```

Also apply the same formatting anywhere else mana costs are displayed. The `_estimateActionCost()` in `loopUI.js` already floors, but we should standardize on `.toFixed(1)` everywhere for consistency.

**Note**: In Phase 6, this display format changes further (action entries get a new layout), so this fix is for the intermediate state.

---

## Phase 4: Store Source Region + Change Grouping

### 4a. Store Source Region in Path Entries

**In `playerState/state.js` `updatePath()`** (line ~180): Add `sourceRegion` to the path entry:

```javascript
this.path.push({
    type: 'regionMove',
    region: targetRegion,
    sourceRegion: sourceRegion || lastPathRegion,  // Store the source
    exitUsed: exitUsed,
    instanceNumber: instanceCount
});
```

The `sourceRegion` parameter is already passed to `updatePath()` and currently only used for validation logging. Now we store it. If not provided, fall back to `lastPathRegion` (derived from the path, same as the validation logic already does).

### 4b. Propagate Source Region Through Action Queue

**In `actionQueueManager.js`** (line ~54): When building the action queue from path entries, include `sourceRegion`:

```javascript
case 'regionMove':
  return {
    id: `action-${index}`,
    type: 'moveToRegion',
    destinationRegion: entry.region,
    sourceRegion: entry.sourceRegion || null,  // Add this
    regionName: entry.region,
    region: entry.region,
    exitUsed: entry.exitUsed || null,
    instanceNumber: entry.instanceNumber,
    pathIndex: index,
  };
```

### 4c. Change Region Grouping

**In `loopRenderer.js` `groupActionsByRegion()`**: For `moveToRegion` actions, group by `sourceRegion` instead of `region`:

```javascript
groupActionsByRegion(actionQueue) {
    const regionGroups = new Map();

    actionQueue.forEach((pathEntry, index) => {
        // For move actions, group under the source region (where we're moving FROM)
        let groupRegion;
        if (pathEntry.type === 'moveToRegion' && pathEntry.sourceRegion) {
            groupRegion = pathEntry.sourceRegion;
        } else {
            groupRegion = pathEntry.region;
        }

        if (!regionGroups.has(groupRegion)) {
            regionGroups.set(groupRegion, []);
        }
        regionGroups.get(groupRegion).push({
            pathEntry,
            index,
            instanceNumber: pathEntry.instanceNumber || 0
        });
    });

    return regionGroups;
}
```

### 4d. Update Action Display Text

**In `loopBlockBuilder.js` `createActionBlockElement()`**: The text for move actions stays the same format ("Move to {destination} via {exit}") — it's just grouped under the source region now.

---

## Phase 5: Region XP Progress Bar in Header

### 5a. Add XP Bar to Region Header

**In `loopBlockBuilder.js` `buildHeader()`** (line ~121): Add a small progress bar and XP text to the right side of the header:

```javascript
// Calculate XP data
const xpData = loopState.getRegionXP(regionName);
const speedBonus = xpData.level * 5;
const xpForNextLevel = xpForLevel(xpData.level + 1);  // Import from xpFormulas
const xpProgress = xpForNextLevel > 0 ? (xpData.xp / xpForNextLevel) * 100 : 0;

headerEl.innerHTML = `
  <span class="loop-expand-indicator" style="margin-right: 8px;">${isExpanded ? '▼' : '▶'}</span>
  <span class="loop-region-name" style="flex: 1;">${regionName}</span>
  <span class="region-xp-level" style="margin-left: 12px;">Level ${xpData.level}</span>
  <span class="region-xp-efficiency" style="margin-left: 8px; color: #8c8;">+${speedBonus}%</span>
  <div class="region-header-xp-bar-container">
    <div class="region-header-xp-bar" style="width: ${xpProgress}%"></div>
    <span class="region-header-xp-text">${Math.floor(xpData.xp)} / ${xpForNextLevel} XP</span>
  </div>
`;
```

### 5b. CSS for Header XP Bar

```css
.region-header-xp-bar-container {
  width: 100px;
  height: 14px;
  background-color: rgba(0, 0, 0, 0.4);
  border-radius: 3px;
  position: relative;
  overflow: hidden;
  margin-left: 8px;
  flex-shrink: 0;
}

.region-header-xp-bar {
  height: 100%;
  background-color: #6a3d9a;  /* dark purple */
  border-radius: 3px;
  transition: width 0.3s ease-in-out;
}

.region-header-xp-text {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7em;
  color: white;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
```

### 5c. Import XP Formula

Need to import or calculate `xpForLevel` — the XP threshold for the next level. Check `xpFormulas.js` for the existing function. Currently uses `levelFromXP(xp)` and `proposedLinearReduction(level)`. The XP-for-next-level formula should already exist or can be derived from the inverse of `levelFromXP`.

---

## Phase 6: JTA-Style Action Entries + Predictions

This is the largest change. Replace the current simple action entries in region blocks with a full JTA Current queue style.

### 6a. Factor Out Queue Analyzer

Move the core cost calculation logic from `loopStats/queueAnalyzer.js` to a new shared module:

**Create `frontend/modules/shared/queueAnalysis.js`**:
- Export `calculateActionCost(action, loopState)` — base cost + XP reduction
- Export `analyzeQueue(actionQueue, loopState)` — returns array of entries with `baseCost`, `finalCost`, `manaBeforeAction`, `manaAfterAction`, `predictedTimeSeconds`
- Export `QueueAnalysis` data structure

**Update `loopStats/queueAnalyzer.js`**: Import from shared module, delegate to it. Keep loopStats-specific features (prev/curr comparison, archiving) in the loopStats module.

**Import in loops module**: `loopBlockBuilder.js` and/or `loopRenderer.js` import from shared module.

### 6b. New Action Entry HTML Structure

Each action entry in a region block becomes:

```html
<div class="loop-action-entry" data-action-index="3">
  <div class="loop-action-progress-bar" style="width: 0%"></div>
  <button class="loop-action-cancel" data-index="3">✕</button>
  <span class="loop-action-index">3</span>
  <span class="loop-action-name">Move to Forest vi…</span>
  <span class="loop-action-cost">-9.5</span>
  <span class="loop-action-remaining">90.5</span>
  <span class="loop-action-time">2.4s</span>
  <span class="loop-action-status">pending</span>
</div>
```

### 6c. Action Name Truncation

Configurable character limit, starting at 20:

```javascript
const ACTION_NAME_MAX_CHARS = 20;

// In CSS:
.loop-action-name {
  width: 20ch;
  min-width: 20ch;
  max-width: 20ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  font-size: 0.85em;
}
```

### 6d. CSS for Action Entries

```css
.loop-action-entry {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  border-radius: 3px;
  position: relative;
  overflow: hidden;
  font-size: 0.9em;
  margin-bottom: 2px;
}

.loop-action-progress-bar {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  background: rgba(85, 170, 85, 0.2);  /* dark green, matching JTA */
  transition: width 0.3s ease;
  z-index: 0;
}

.loop-action-entry > * {
  position: relative;
  z-index: 1;
}

.loop-action-cancel {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  border-radius: 2px;  /* square-ish */
  cursor: pointer;
  font-size: 10px;
  opacity: 0.6;
  flex-shrink: 0;
}

.loop-action-cancel:hover {
  opacity: 1;
  background: rgba(231, 76, 60, 0.8);
}

.loop-action-index {
  min-width: 20px;
  text-align: right;
  opacity: 0.5;
  font-size: 0.8em;
  font-family: monospace;
}

.loop-action-cost {
  opacity: 0.6;
  min-width: 5ch;
  text-align: right;
  font-family: monospace;
  font-size: 0.8em;
}

.loop-action-remaining {
  font-weight: bold;
  min-width: 5ch;
  text-align: right;
  font-family: monospace;
  font-size: 0.8em;
}

.loop-action-time {
  opacity: 0.5;
  min-width: 4ch;
  text-align: right;
  font-family: monospace;
  font-size: 0.8em;
}

.loop-action-status {
  font-size: 0.7em;
  opacity: 0.6;
  min-width: 50px;
  text-align: center;
}
```

### 6e. Mana Remaining Color Coding

Adapt from JTA's `energyColorClass()`:

```javascript
function manaColorClass(remaining, max) {
  if (remaining < 0) return 'loop-mana-insufficient';  // red
  const pct = max > 0 ? remaining / max : 0;
  if (pct > 0.5) return 'loop-mana-good';              // green
  if (pct > 0.1) return 'loop-mana-warn';              // orange
  return 'loop-mana-low';                              // red
}
```

```css
.loop-mana-good { color: #5a5; }
.loop-mana-warn { color: #da5; }
.loop-mana-low { color: #d55; }
.loop-mana-insufficient { color: #a33; text-decoration: line-through; }
```

### 6f. Predicted Time Calculation

From `loopState.js` line 763: `progressIncrement = (deltaTime / 1000) * (20 / actionCost)`

Where `deltaTime` includes the `gameSpeed` multiplier. So:
- Progress rate = `gameSpeed * 20 / actionCost` percent per real second
- Time to complete = `actionCost * 5 / gameSpeed` real seconds

```javascript
function predictedTimeSeconds(actionCost, gameSpeed) {
  if (gameSpeed === Infinity || gameSpeed <= 0) return 0;
  return (actionCost * 5) / gameSpeed;
}
```

Display format: `X.Xs` for values under 60s, `Xm Xs` for longer.

### 6g. Integration with loopBlockBuilder

Replace `createActionBlockElement()` to use the new format. Pass in the queue analysis data (from the shared analyzer) so each entry knows its predicted cost, remaining mana, and time.

The analysis should be computed once per render in `renderLoopPanel()` and passed down through `buildRegionBlock()` → `addActions()` → new entry builder.

---

## Phase 7: Completed Action Styling

### 7a. Progress Bar States

| State | Progress bar width | Color |
|-------|-------------------|-------|
| Pending | 0% | — |
| Active | tick-based progress % | `rgba(85, 170, 85, 0.2)` (dark green) |
| Completed | 100% | `rgba(85, 170, 85, 0.2)` (dark green, solid) |

```css
.loop-action-entry.state-completed .loop-action-progress-bar {
  width: 100% !important;
  background: rgba(85, 170, 85, 0.2);
}

.loop-action-entry.state-active {
  border: 1px solid rgba(85, 170, 153, 0.3);
}

.loop-action-status.completed { color: #5a5; }
.loop-action-status.active { color: #5af; }
.loop-action-status.failed { color: #d55; }
```

### 7b. Status Text

Display status as text: "pending", "active", "completed". Derive from:
- `action.completed === true` → "completed"
- `action === loopState.currentAction && loopState.isProcessing` → "active"
- Otherwise → "pending"

---

## Phase 8: Compact View

### 8a. Compact View Button

Add button next to "Expand All" in the controls bar:

**In `loopUI.js`** (line ~155, after the expand-collapse button):
```html
<button id="loop-ui-compact-view" class="button">Compact View</button>
```

Toggle state stored in `displaySettingsManager` or a simple boolean on `loopUI`.

### 8b. Compact View Rendering

When compact view is active:
- Hide all region blocks (headers, details, etc.)
- Show a single flat table of all action entries
- Add a header row at the top

```html
<div class="loop-compact-table">
  <div class="loop-compact-header">
    <span class="loop-action-cancel-placeholder"></span>
    <span class="loop-action-index">#</span>
    <span class="loop-action-name">Action</span>
    <span class="loop-action-cost">Cost</span>
    <span class="loop-action-remaining">Remaining</span>
    <span class="loop-action-time">Time</span>
    <span class="loop-action-status">Status</span>
  </div>
  <!-- All action entries in queue order, same HTML as in region blocks -->
</div>
```

### 8c. CSS for Compact View

```css
.loop-compact-table {
  display: flex;
  flex-direction: column;
}

.loop-compact-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  font-size: 0.8em;
  font-weight: bold;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  opacity: 0.7;
}
```

The action entries use the exact same `.loop-action-entry` class and layout as in normal view — the only difference is they appear in a flat list without region headers between them.

### 8d. Toggle Behavior

Button text toggles between "Compact View" and "Normal View". The `#loop-regions-area` either renders region blocks (normal) or the compact table (compact).

---

## Data Flow Summary

```
renderLoopPanel()
  ├── Get action queue from loopState
  ├── Run shared queueAnalysis.analyzeQueue(queue, loopState)
  │     → Returns: per-action { finalCost, manaAfter, predictedTime, status }
  ├── If normal view:
  │     ├── groupActionsByRegion(queue)  // move actions grouped by sourceRegion
  │     └── For each region group:
  │           ├── buildRegionBlock() with analysis data
  │           │     ├── Header: name, level, efficiency, XP bar
  │           │     └── Action entries: cancel, #, name, cost, remaining, time, status
  │           └── Append to regions area
  └── If compact view:
        ├── Render header row
        └── Render all actions in order as flat entries
```

---

## Files Modified

| File | Changes |
|------|---------|
| `loop.css` | Fix mana bar selectors, new colors, action entry styles, compact view styles, header XP bar |
| `loopRenderer.js` | Remove mana color switching, update action text layout, pass analysis data, compact view toggle |
| `loopBlockBuilder.js` | New action entry format, header XP bar, source region grouping, significant digits |
| `loopUI.js` | Hide stats, compact view button, analysis integration |
| `playerState/state.js` | Store `sourceRegion` in path entries |
| `actionQueueManager.js` | Propagate `sourceRegion` through queue entries |

## Files Created

| File | Purpose |
|------|---------|
| `frontend/modules/shared/queueAnalysis.js` | Factored-out cost calculation and queue analysis |

## Files Updated (import changes only)

| File | Changes |
|------|---------|
| `loopStats/queueAnalyzer.js` | Import from shared module instead of duplicating logic |
