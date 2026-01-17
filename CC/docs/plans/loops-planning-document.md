# Loops Module Planning Document

## Executive Summary

This document outlines the remaining work for the Loops module, an incremental game mode for Archipelago-CC. The player queues actions (move, explore, check locations) and watches them execute automatically, consuming mana. XP is earned and persists across loops, reducing future costs.

**Current State**: The module was previously functional but has bugs after major app refactors. Core systems (mana, XP, action queue) exist but need fixes and enhancements.

---

## Progress Tracker

### Completed Work

| Item | Status | Notes |
|------|--------|-------|
| Phase 1: loopStats module | ✅ Complete | `frontend/modules/loopStats/` with queueAnalyzer, UI, tests |
| loopStats public API | ✅ Complete | getQueueAnalyzer, getAnalysis, analyzeQueue exposed via centralRegistry |
| loopStats e2e tests | ✅ Complete | `tests/e2e/loopStats.spec.js` |
| Timer test integration | ✅ Complete | loops queue test uses loopStats, has maxLoops limit |
| Bug investigation tests | ✅ Complete | `tests/e2e/loopBugs.spec.js` |
| Bug 1: Mana 100/110 | ✅ Fixed | Was ALTTP-specific (event item awarded at start) - mana now initializes correctly |
| Bug 5: Unpause mana | ✅ Fixed | Added `_shouldResetOnResume()` to refill mana when queue is complete |
| Bug 8: mode=loop URL | ✅ Clarified | Not a bug - mode is named `loops` (plural), use `?mode=loops` |

### In Progress

| Item | Status | Notes |
|------|--------|-------|
| Phase 2: Cost data files | 🔄 Planning | Decisions made, discussing cost generation algorithm |

### Remaining Bugs (Need UI Testing)

| Bug | Priority | Notes |
|-----|----------|-------|
| Completed action delay | Medium | Needs manual UI observation |
| Region block ordering | Medium | Needs manual UI testing |
| Region links not clickable | Medium | Needs manual UI testing |
| Timer not restarting | Low | Needs investigation |

### Design Decisions Made

**Phase 2 Implementation:**
- **Cost loading location**: In main Loops module as subcomponent
- **Cost loading timing**: When entering loop mode or loading different rules data
- **Cost generation**: Start with manual tool, add automatic option and CLI later
- **Missing files**: Prompt user with options

---

## Core Concepts

### What is a "Loop"?

A loop is a single playthrough attempt:
- **Starts with**: Full mana, player at starting location, action queue begins from the beginning
- **Ends when**: Mana runs out OR player manually resets
- **On reset**: Mana refills to max, player returns to start, queue restarts from beginning
- **Persists across loops**: XP levels (for regions and items), checked locations (Archipelago logic)

### Queue Completion Behavior

When the action queue completes successfully:
- **Option A**: Auto-restart the loop (configurable setting)
- **Option B**: Wait for user to add more actions or manually restart

### Location Checking vs Item Taking

- First time checking a location: "Check Location" - unlocks actions requiring that item in Archipelago
- Subsequent loops: "Take Item" - item was already checked, but must be re-acquired this loop to avoid cost penalty

---

## Implementation Phases

### Phase 0: Bug Fixes (Restore Basic Functionality)

**Goal**: Get loop mode working at its previous level of functionality.

#### Known Bugs to Investigate

| Bug | Description | Priority | Status |
|-----|-------------|----------|--------|
| Mana initialization | Mana starts at 100/110 on fresh load instead of 100/100 | High | ✅ FIXED - ALTTP-specific (event item at start) |
| Completed action delay | Delay in removing completed check location actions from queue | Medium | Needs UI testing |
| Region block ordering | Blocks sometimes appear in wrong order (should match action queue order) | Medium | Needs UI testing |
| Region links not clickable | Links in loop panel don't respond to clicks | Medium | Needs UI testing |
| Unpause mana issue | Unpausing when queue finished restarts without refilling mana | High | ✅ FIXED - Added `_shouldResetOnResume()` |
| Timer not restarting | Timer doesn't restart when queue for undiscovered region finishes | Low | Needs investigation |
| Queue continuation bug | After location check finishes, keeps looping through rest of queue | Medium | Code reviewed - logic appears correct |
| mode=loop URL param | `?mode=loop` URL parameter may not work | Medium | ✅ NOT A BUG - Use `?mode=loops` (plural) |

#### Bug Fix Approach

1. Start the dev server and manually test loop mode
2. Use browser dev tools to trace event flow
3. Compare current behavior to expected behavior
4. Fix each bug with targeted changes
5. Add test cases to prevent regressions

---

### Phase 1: Loop Stats Panel

**Goal**: Create a new panel that displays detailed action queue analysis, showing mana costs and predicted remaining mana.

**Why First**: This panel will help debug issues in later phases by making cost calculations visible.

#### 1.1 Module Structure

Create new module: `frontend/modules/loopStats/`

```
loopStats/
├── index.js                 # Module registration
├── loopStatsUI.js          # Main UI class
├── loopStatsRenderer.js    # Rendering logic
├── queueAnalyzer.js        # Cost calculation engine
├── loopStats.css           # Styling
└── settings-loopStats.json # Default settings
```

#### 1.2 Panel Layout

**Location**: Left column (narrow width design)

```
┌─────────────────────────────────┐
│ [Mana Costs] [Inventory]        │  ← Tabs (Inventory placeholder)
├─────────────────────────────────┤
│ ☑ Show mana cost                │
│ ☑ Show remaining mana           │
├─────────────────────────────────┤
│ Action          Prev    Curr    │  ← Header
├─────────────────────────────────┤
│ ▸ Move: Links H…  95      95    │  ← Collapsed row
│ ▾ Check: Ped…     —       87    │  ← Expanded row
│   Base cost:              10    │
│   Level discount:         -2    │
│   Final cost:              8    │
│   Remaining:              87    │
├─────────────────────────────────┤
│ ▸ Explore: Lig…   82      79    │
│ ▸ Check: Kak…     70      67    │
└─────────────────────────────────┘
```

#### 1.3 Data Model

```javascript
// Queue analysis result
{
  entries: [
    {
      index: 0,
      type: 'move' | 'explore' | 'checkLocation',
      description: 'Move: Links House',        // Full description
      truncatedDescription: 'Move: Links H…',  // For display
      regionName: 'Light World',

      // Cost breakdown
      baseCost: 10,
      levelDiscount: 2,           // From region/item XP
      itemPenalties: [],          // Phase 3: missing item costs
      finalCost: 8,

      // Mana tracking
      manaBeforeAction: 95,
      manaAfterAction: 87,

      // Display flags
      isDoubledCost: false,       // Phase 3: yellow highlight
      hasInsufficientMana: false, // Red warning
    },
    // ...
  ],
  totalCost: 45,
  finalMana: 55,
}
```

#### 1.4 Previous Loop Data

- Store analysis snapshot when loop resets
- Compare current queue to previous:
  - Actions in both: show both columns
  - Actions only in previous: remove from display
  - Actions only in current: show "—" for previous column

#### 1.5 Display Options

| Option | Default | Description |
|--------|---------|-------------|
| Show mana cost | ☐ | Display cost in data columns |
| Show remaining mana | ☑ | Display remaining mana in data columns |

When both checked, display as "cost / remaining" (e.g., "8 / 87").

#### 1.6 Tooltip and Expansion

- **Truncated description**: Show full description on hover
- **Expand/collapse**: Click row to toggle detailed breakdown
- **Color coding**:
  - Normal: default colors
  - Insufficient mana predicted: red text/background
  - Doubled cost (Phase 3): yellow tint

#### 1.7 Event Integration

Subscribe to:
- `loopState:queueUpdated` - Recalculate current loop analysis
- `loopState:loopReset` - Archive current as previous, recalculate
- `loopState:manaChanged` - Update display (optional real-time)
- `loopState:xpChanged` - Recalculate costs

#### 1.8 Inventory Tab (Placeholder)

- Create tab structure now
- Inventory tab shows: "Coming soon" or empty state
- Future: items collected this loop, item XP/levels

---

### Phase 2: Region/Location-Specific Costs

**Goal**: Allow each region and location to have different mana costs, loaded from a JSON file.

#### 2.1 Cost Data File Format

**Location**: `frontend/presets/{game}/AP_{seed_id}/AP_{seed_id}_costs.json`

```json
{
  "version": "1.0",
  "generatedFrom": "AP_14089154938208861744_sphere_log.jsonl",
  "generatedAt": "2024-01-15T10:30:00Z",

  "regions": {
    "Menu": { "moveCost": 0 },
    "Light World": { "moveCost": 10 },
    "Kakariko Village": { "moveCost": 8 },
    "Eastern Palace": { "moveCost": 15 }
  },

  "locations": {
    "Link's House": 5,
    "Kakariko Well - Top": 12,
    "Eastern Palace - Boss": 25
  },

  "defaultRegionCost": 10,
  "defaultLocationCost": 10
}
```

#### 2.2 Cost Formulas

| Action Type | Base Cost Source | Formula |
|-------------|------------------|---------|
| Move to region | `regions[name].moveCost` | `moveCost / (1 + level * 0.05)` |
| Explore region | `regions[name].moveCost * 2` | `(moveCost * 2) / (1 + level * 0.05)` |
| Check location | `locations[name]` | `locationCost / (1 + level * 0.05)` |

#### 2.3 Cost Data Loading

```javascript
// In loopState.js or new costDataManager.js
async loadCostData(presetPath) {
  const costFile = `${presetPath}_costs.json`;
  try {
    const response = await fetch(costFile);
    if (response.ok) {
      this.costData = await response.json();
      return true;
    }
  } catch (e) {
    // File doesn't exist
  }
  return false;
}
```

#### 2.4 Missing Cost Data Handling

When cost file doesn't exist:
1. Show modal: "Cost data not found for this game"
2. Options:
   - **Upload file**: File picker for user-provided costs.json
   - **Generate now**: Run generation process in browser (if fast enough)
   - **Use defaults**: Fall back to uniform costs (current behavior)

#### 2.5 Cost Generation Tool

**Location**: `frontend/tools/costGenerator/` or integrated into loops module

**Algorithm Overview**:

```
1. Initialize:
   - Set Menu region cost to 0
   - Start simulated playthrough at Menu with max mana

2. For each sphere log entry:
   a. Calculate path from Menu to target location
   b. For each region in path without cost set:
      - Assign cost = floor(currentMana / 2 / uncostedRegionsRemaining)
   c. Assign location cost = floor(currentMana)
   d. Simulate traveling path:
      - Explore each unvisited region (costs 2x region move cost)
      - Move through each region
      - Check the location
      - Award XP, reduce mana
   e. If mana runs out mid-path:
      - Set up queue to continue from current position
      - Reset loop (refill mana)
      - Continue from where we stopped
   f. After checking location, reset loop

3. Handle remaining regions/locations without costs:
   - Regions: Use highest cost of neighboring regions
   - Locations: Use highest existing location cost

4. Output costs.json
```

**Detailed Algorithm**:

```javascript
async generateCostData(sphereLog, staticData) {
  const costs = {
    regions: { Menu: { moveCost: 0 } },
    locations: {},
  };

  // Simulated game state
  let currentMana = 100;  // Starting mana
  const maxMana = 100;
  const regionXP = new Map();  // For XP discounts
  const exploredRegions = new Set(['Menu']);
  const checkedLocations = new Set();

  for (const entry of sphereLog) {
    const targetLocation = entry.location;
    const targetRegion = getRegionForLocation(targetLocation, staticData);

    // Calculate path from Menu to target
    const path = findPath('Menu', targetRegion, staticData);

    // Identify regions in path without costs
    const uncostedRegions = path.filter(r => !costs.regions[r]);

    // Assign costs to uncoded regions
    if (uncostedRegions.length > 0) {
      const costPerRegion = Math.floor((currentMana / 2) / uncostedRegions.length);
      for (const region of uncostedRegions) {
        costs.regions[region] = { moveCost: costPerRegion };
      }
    }

    // Assign location cost
    costs.locations[targetLocation] = Math.floor(currentMana);

    // Simulate traveling to location
    for (const region of path) {
      // Explore if not yet explored
      if (!exploredRegions.has(region)) {
        const exploreCost = getExploreCost(region, costs, regionXP);
        currentMana -= exploreCost;
        addRegionXP(region, exploreCost, regionXP);
        exploredRegions.add(region);

        if (currentMana <= 0) {
          // Loop reset
          currentMana = maxMana;
          // Continue from here on next iteration
        }
      }

      // Move cost
      const moveCost = getMoveCost(region, costs, regionXP);
      currentMana -= moveCost;
      addRegionXP(region, moveCost, regionXP);

      if (currentMana <= 0) {
        currentMana = maxMana;
      }
    }

    // Check location
    const locationCost = getLocationCost(targetLocation, costs, regionXP);
    currentMana -= locationCost;
    addRegionXP(targetRegion, locationCost, regionXP);
    checkedLocations.add(targetLocation);

    // Reset loop after successful check
    currentMana = maxMana;
  }

  // Fill in any remaining regions/locations
  fillMissingCosts(costs, staticData);

  return costs;
}
```

#### 2.6 Generation Tool UI

**Implementation**: Integrated into loops module (not a separate page)
- Button in loops panel: "Generate Cost Data"
- Progress indicator during generation
- Auto-save to preset directory (if possible) or download

#### 2.7 Script for Batch Generation

Create `scripts/tools/generate-loop-costs.py`:
- Process all existing presets
- Generate costs.json for each
- Can be run as part of build process

---

### Phase 3: Missing Item Cost Logic

**Goal**: Actions requiring items not yet collected this loop have increased mana costs.

#### 3.1 Cost Penalty Formula

For each required item not collected this loop:
```
additionalCost = baseCost * (1 / (1 + itemLevel * 0.05))
```

Multiple missing items are cumulative:
```
totalCost = baseCost + sum(additionalCost for each missing item)
```

**Example**:
- Base cost: 10
- Missing "Bow" (level 0): +10 (2x total)
- Also missing "Hookshot" (level 5): +10/(1+5*0.05) = +8 (2.8x total)
- Total: 10 + 10 + 8 = 28

#### 3.2 Item XP System

Items gain XP when their cost penalty is paid:
```javascript
// When paying item penalty
itemXP[itemName] += penaltyManaPaid;

// Level up thresholds (same as regions)
xpForNextLevel = 100 + (level * 20);
```

#### 3.3 Tracking Loop Inventory

```javascript
// In loopState.js
this.loopInventory = new Set();  // Items collected THIS loop

// On loop reset
resetLoop() {
  this.loopInventory.clear();
  this.currentMana = this.maxMana;
  // ... restart queue
}

// On item collected (via location check)
collectItem(itemName) {
  this.loopInventory.add(itemName);
}
```

#### 3.4 Required Items Algorithm

To determine which items are required for an action's access rule:

```javascript
getRequiredItems(action, simulatedInventory, itemPriorityOrder) {
  const accessRule = getAccessRuleForAction(action);

  // Step 1: Create temporary inventory WITHOUT untaken items
  const tempInventory = new Set();
  for (const item of simulatedInventory) {
    tempInventory.add(item);
  }

  // Step 2: Check if rule passes without any additional items
  if (evaluateRule(accessRule, tempInventory)) {
    return []; // No items required - already accessible
  }

  // Step 3: Add items one at a time in priority order until rule passes
  const addedItems = [];
  for (const item of itemPriorityOrder) {
    if (!tempInventory.has(item)) {
      tempInventory.add(item);
      addedItems.push(item);
      if (evaluateRule(accessRule, tempInventory)) {
        break; // Rule now passes
      }
    }
  }

  // Step 4: Remove items in reverse order to find minimum required set
  const requiredItems = [];
  for (let i = addedItems.length - 1; i >= 0; i--) {
    const item = addedItems[i];
    tempInventory.delete(item);
    if (!evaluateRule(accessRule, tempInventory)) {
      // Removing this item broke the rule - it's required
      tempInventory.add(item);
      requiredItems.push(item);
    }
  }

  return requiredItems;
}
```

**Notes**:
- `itemPriorityOrder` is user-configurable (affects which items get selected when multiple options exist)
- This algorithm handles OR conditions in rules (e.g., "Bow OR Hookshot")
- The reverse removal step ensures we find the minimal required set

#### 3.5 Cost Calculation Algorithm

When queue changes, recalculate all costs:

```javascript
recalculateCosts() {
  // Make copy of current loop inventory
  const simulatedInventory = new Set(this.loopInventory);

  for (const action of this.actionQueue) {
    if (action.type === 'explore') {
      // Explore actions never have item penalties
      action.itemPenalties = [];
      continue;
    }

    // Get required items for this action's access rule
    const requiredItems = this.getRequiredItems(action, simulatedInventory, this.itemPriorityOrder);

    // Calculate penalties for missing items
    action.itemPenalties = [];
    for (const item of requiredItems) {
      if (!simulatedInventory.has(item)) {
        const itemLevel = this.getItemLevel(item);
        const penalty = action.baseCost / (1 + itemLevel * 0.05);
        action.itemPenalties.push({ item, penalty, level: itemLevel });
        action.isDoubledCost = true;  // For UI highlighting
      }
    }

    // If this is a location check, add item to simulated inventory
    if (action.type === 'checkLocation') {
      const itemAtLocation = this.getItemAtLocation(action.locationName);
      simulatedInventory.add(itemAtLocation);
    }
  }
}
```

#### 3.6 UI Updates

**Loop Stats Panel**:
- Expanded view shows item penalties:
  ```
  Base cost:           10
  Level discount:      -2
  Missing Bow (L0):   +10
  Missing Hook (L5):   +8
  Final cost:          26
  ```
- Rows with penalties highlighted in yellow

**Loops Panel**:
- Action blocks with penalties shown in yellow tint

**Region Graph** (Phase 4):
- Edges for penalized actions shown in yellow

#### 3.6 Multiworld Item Substitution

**Concept**: Foreign items received from other players can substitute for items you pick up that belong to other players.

**Data Model**:
```javascript
{
  receivedForeignItems: ['Bow', 'Hookshot'],  // From other players
  pickedUpForeignItems: ['OtherPlayer_Sword', 'OtherPlayer_Shield'],  // For other players
  substitutions: {
    'Bow': 'OtherPlayer_Sword',      // Bow penalty removed
    // 'Hookshot' has no substitution yet
  },
  substitutionOrder: ['Bow', 'Hookshot'],  // User-controlled priority
}
```

**UI for Substitution Order**:
- List of received foreign items
- Drag-and-drop to reorder priority
- Shows which items have substitutes assigned

**Note**: This is an advanced feature. Implement basic item penalties first, add substitution later.

---

### Phase 4: Region Graph Visualization

**Goal**: Enhance the region graph to display loop-specific information.

#### 4.1 API for Graph Access

Create interface for loops module to communicate with regionGraph:

```javascript
// In regionGraph module, expose API
export function setNodeRenderer(nodeId, renderer) { }
export function setEdgeRenderer(edgeId, renderer) { }
export function animatePlayerMovement(fromNode, toNode, duration) { }
export function getNodePosition(nodeId) { }
```

Or use event-based communication:
```javascript
eventBus.publish('regionGraph:setNodeData', {
  nodeId: 'player',
  data: { manaPercent: 0.75 }
});
```

#### 4.2 Player Node as Pie Chart

Display mana as pie chart:
- Blue segment: remaining mana percentage
- Black segment: consumed mana percentage

```javascript
// SVG pie chart for player node
function renderPlayerNode(manaPercent) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const blueLength = circumference * manaPercent;

  return `
    <circle r="${radius}" fill="black" />
    <circle r="${radius}" fill="blue"
      stroke-dasharray="${blueLength} ${circumference}"
      transform="rotate(-90)" />
  `;
}
```

#### 4.3 Region/Location Node Overlays

Show mana cost as fraction of max mana:
- Region nodes: move cost as pie segment
- Location nodes: check cost as pie segment
- Use path color for the cost segment

#### 4.4 Explore Action Pseudo-Nodes

Add visual indicators for explore actions in queue:
- Small icon or badge on region nodes
- Shows explore is queued for that region

#### 4.5 Node Labels

Update labels to show:
- Region name
- Current XP level
- Mana cost (as number)

#### 4.6 Animated Player Movement

Sync player node position with action queue progress:

```javascript
// When action starts
eventBus.subscribe('loopState:newActionStarted', (action) => {
  if (action.type === 'move') {
    animatePlayerAlongEdge(
      action.fromRegion,
      action.toRegion,
      action.expectedDuration
    );
  }
});

// During action, sync with progress
eventBus.subscribe('loopState:progressUpdated', (data) => {
  updatePlayerPositionOnEdge(data.progress / 100);
});
```

#### 4.7 Edge Coloring for Penalties

- Normal edges: default color
- Edges for actions with item penalties: yellow
- Edges for actions with insufficient mana: red

---

## Settings and Configuration

### New Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `loops.showCostBreakdown` | boolean | true | Show detailed costs in stats panel |
| `loops.autoGenerateCosts` | boolean | false | Auto-generate costs if file missing |
| `loops.warnInsufficientMana` | boolean | true | Visual warning for predicted mana shortage |
| `loops.pauseOnRegion100` | boolean | false | Pause exploring when region fully explored |

### URL Parameters

| Parameter | Effect |
|-----------|--------|
| `?mode=loop` | Auto-enable loop mode on load |
| `?loopSpeed=50` | Set initial game speed |

---

## Data Persistence

### Local Storage

Currently persisted:
- Mana state
- Region XP
- Game speed
- Action queue progress

To add:
- Item XP (Phase 3)
- Loop inventory state
- Previous loop analysis (Phase 1)
- Substitution order (Phase 3)

### Archipelago Server Storage (Future Investigation)

**Goal**: Persist loop game data on server for cross-session/cross-device play.

**Questions to investigate**:
- Can custom data be stored in Archipelago's data storage?
- What's the data size limit?
- How to sync between clients in multiworld?

**Potential approach**:
- Use Archipelago's `Set` and `Get` commands for key-value storage
- Store serialized loop state under player-specific keys
- Sync on connect, save periodically

---

## Testing Strategy

### Primary Test: Loops Queue Test

**Goal**: Adapt the timer test to use the action queue instead of direct location checks.

**Location**: New mode in `timerTests.js` (may refactor to multiple files later)

#### Test Flow

```
1. Enable loop mode
2. Enable test settings (instant mode, no mana depletion reset)
3. Find an accessible location or unexplored region
4. Build path from starting region to target
5. Queue the actions (moves + explore/check)
6. Wait for queue to complete (or target achieved)
7. Start new loop with new target
8. Repeat until all locations checked
```

#### Key Differences from Timer Test

| Aspect | Timer Test | Loops Queue Test |
|--------|------------|------------------|
| Location check | Direct dispatch | Queue actions, wait for completion |
| Navigation | Implicit | Explicit path building |
| Starting point | Current position | Always from start region |
| Mana tracking | N/A | Verify consumption and debt |

#### Test Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `instantMode` | `true` | Actions complete in one frame |
| `noManaDepletionReset` | `true` | Don't restart loop when mana depletes |
| `gameSpeed` | `Infinity` | If instant mode uses speed setting |

#### Success Criteria (v1)

Same as timer test: All manually-checkable locations are checked.

Future enhancements:
- Verify XP gained for each region
- Verify mana consumed correctly
- Track "mana debt" (how negative mana went)

---

### Test Mode Settings

#### Instant Mode

Actions complete in a single frame but use the same cost formulas.

```javascript
// If gameSpeed supports Infinity
loopState.setGameSpeed(Infinity);

// Or add dedicated instant mode
loopState.setInstantMode(true);
```

**Scope**: General setting (usable for "skip animation" in normal play too)

#### No Mana Depletion Reset

When mana reaches zero (or goes negative), don't trigger loop reset.

```javascript
// In loopState
this.noManaDepletionReset = false; // Default

// In mana consumption logic
if (this.currentMana <= 0 && !this.noManaDepletionReset) {
  this.resetLoop();
}
```

**Benefit**: Test can observe mana going negative to verify cost formulas

#### Mana Debt Tracking

Track how negative mana went for test assertions:

```javascript
this.manaDebt = 0; // Reset on loop start

// When mana would go negative
if (newMana < 0) {
  this.manaDebt = Math.abs(newMana);
  this.currentMana = newMana; // Allow negative for tracking
}
```

---

### Architecture Changes for Testing

#### Shared Pathfinding Module

Move pathfinding logic to a shared module accessible by multiple modules:

**Current**: `frontend/modules/regionGraph/pathfinder.js`
**Proposed**: `frontend/modules/shared/pathfinder.js`

Used by:
- `regionGraph` - Navigation visualization
- `loops` - Queue building
- `tests` - Path verification

#### Queue Data Location

**Decision**: Action queue data stays in `playerState` (used by regionGraph, Regions for display). Loop-specific processing logic stays in `loops` module.

#### Event Handling for Queue vs Immediate

**Decision**: Loops module handles the distinction between "queue action" (loop mode) vs "execute immediately" (non-loop mode) via event interception.

```javascript
// In loops/loopEvents.js
export function handleUserLocationCheckForLoops(eventData, propagationOptions) {
  if (isLoopModeActive) {
    // Queue the action, don't propagate for immediate execution
    queueLocationCheck(eventData.locationName, eventData.regionName);
    // Don't propagate - we've handled it
  } else {
    // Propagate for immediate execution
    dispatcher.publishToNextModule(...);
  }
}
```

---

### Unit Tests (Vitest)

| Test File | Coverage |
|-----------|----------|
| `xpFormulas.test.js` | XP calculations (exists) |
| `costCalculator.test.js` | Cost calculations with penalties |
| `queueAnalyzer.test.js` | Queue analysis logic |
| `pathfinder.test.js` | Path finding algorithms |

### Integration Tests (In-App)

- Loop mode toggle
- Action queue management
- Mana consumption (with debt tracking)
- XP awarding
- Loop reset behavior
- Cost data loading
- Instant mode behavior

### E2E Tests (Playwright)

- Full loop playthrough (loops queue test)
- Cost generation tool
- Stats panel display
- Graph visualization

---

## File Changes Summary

### New Files

| Path | Purpose |
|------|---------|
| `frontend/modules/loopStats/` | New stats panel module |
| `frontend/modules/shared/pathfinder.js` | Shared pathfinding logic (moved from regionGraph) |
| `scripts/tools/generate-loop-costs.py` | Batch cost generation script |
| `frontend/presets/*/AP_*_costs.json` | Cost data files |

### Modified Files

| Path | Changes |
|------|---------|
| `frontend/modules/loops/loopState.js` | Item XP, loop inventory, cost loading, instant mode, no-reset mode, cost generation |
| `frontend/modules/loops/loopEvents.js` | Queue vs immediate execution logic |
| `frontend/modules/loops/xpFormulas.js` | Item penalty formulas |
| `frontend/modules/loops/loopUI.js` | Cost display, penalty highlighting |
| `frontend/modules/regionGraph/` | Node/edge rendering hooks, use shared pathfinder |
| `frontend/modules/tests/testCases/timerTests.js` | Add loops queue test mode |
| `frontend/modes.json` | Add `loop` mode entry |

---

## Implementation Order

```
Phase 0: Bug Fixes
├── Fix mana initialization bug
├── Fix unpause mana refill bug
├── Fix region block ordering
├── Fix mode=loop URL parameter
└── Other bug fixes as discovered

Phase 1: Loop Stats Panel
├── 1.1 Create module structure
├── 1.2 Implement basic panel layout
├── 1.3 Implement queue analyzer (current costs only)
├── 1.4 Add previous loop comparison
├── 1.5 Add display options (checkboxes)
├── 1.6 Add expand/collapse rows
└── 1.7 Add inventory tab placeholder

Phase 2: Region/Location Costs
├── 2.1 Define cost data JSON schema
├── 2.2 Implement cost data loader
├── 2.3 Update cost calculations to use loaded data
├── 2.4 Implement cost generation algorithm
├── 2.5 Create generation tool UI
├── 2.6 Create batch generation script
└── 2.7 Update stats panel to show loaded costs

Phase 3: Missing Item Logic
├── 3.1 Implement item XP tracking
├── 3.2 Implement loop inventory tracking
├── 3.3 Implement cost penalty calculation
├── 3.4 Update queue analyzer for penalties
├── 3.5 Update UI for penalty highlighting
└── 3.6 (Later) Multiworld substitution

Phase 4: Graph Visualization
├── 4.1 Create graph API/events
├── 4.2 Implement player node pie chart
├── 4.3 Implement cost overlays on nodes
├── 4.4 Implement animated player movement
└── 4.5 Implement edge coloring for penalties
```

---

## Open Questions

1. **Performance**: Will cost generation be fast enough for in-browser use?
2. **Graph library**: Does the current regionGraph use a library that supports custom node rendering?
3. **Multiworld sync**: How to handle loop state when multiple players are connected?
4. **Mobile support**: Should the stats panel be responsive for mobile?

---

## Appendix: Event Reference

### Events to Subscribe

| Event | Publisher | Data |
|-------|-----------|------|
| `loopState:queueUpdated` | loopState | `{ queue }` |
| `loopState:manaChanged` | loopState | `{ current, max }` |
| `loopState:xpChanged` | loopState | `{ region, xp, level }` |
| `loopState:loopReset` | loopState | `{}` |
| `loopState:actionCompleted` | loopState | `{ action, index }` |
| `loopState:progressUpdated` | loopState | `{ progress, action }` |

### Events to Publish

| Event | Publisher | Data |
|-------|-----------|------|
| `loopStats:analysisUpdated` | loopStats | `{ analysis }` |
| `regionGraph:setNodeData` | loops | `{ nodeId, data }` |
| `regionGraph:animatePlayer` | loops | `{ from, to, duration }` |
