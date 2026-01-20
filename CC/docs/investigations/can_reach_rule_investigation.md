# Investigation: `can_reach` Rule Resolution in Frontend Code

## Executive Summary

This document details the complete process of how `can_reach` rules are resolved in the Archipelago-CC frontend, with specific focus on **why these rules fail when the player ID isn't 1**.

**Root Cause Identified**: The `can_reach()` function in `reachabilityEngine.js:672-674` contains a player ID filter that returns `false` immediately if the requested player doesn't match `sm.playerSlot`, **without checking actual reachability**. Since `sm.playerSlot` defaults to 1, any `can_reach` call with a different player parameter will always fail.

---

## 1. Overview: Two Types of `can_reach` Rules

The frontend handles `can_reach` checks through two different rule types:

### Type 1: Direct `can_reach` Rule
```json
{
  "type": "can_reach",
  "region": {
    "type": "constant",
    "value": "RegionName"
  }
}
```
- **Handler**: `ruleEngine.js:1789-1803`
- **Does NOT use player parameter** - checks current player's reachability directly
- **No player filtering** - always evaluates for the active StateManager's context

### Type 2: `state_method` with `can_reach`
```json
{
  "type": "state_method",
  "method": "can_reach",
  "args": [
    {"type": "constant", "value": "RegionName"},
    {"type": "constant", "value": "Region"},
    {"type": "constant", "value": 2}  // ← Optional player parameter
  ]
}
```
- **Handler**: `ruleEngine.js:471-492` → delegates to `ruleEvaluator.js:144-148`
- **DOES use player parameter** (defaults to 1 if not provided)
- **⚠️ APPLIES PLAYER FILTERING** - this is where the bug occurs

---

## 2. Complete Call Chain Analysis

### Path A: Direct `can_reach` Rule (Type 1)

```
1. Rule Evaluation Entry
   └─> evaluateRule(rule, context, depth)
       Location: ruleEngine.js:335

2. Switch on rule.type = 'can_reach'
   └─> case 'can_reach': (line 1789)
       ├─> Extract region name: evaluateRule(rule.region, context, depth + 1)
       └─> Call: context.isRegionReachable(regionName)

3. Context Method Resolution
   └─> stateInterface.js:458-471
       isRegionReachable: (regionName) => {
         // During BFS computation
         if (stateManager._computing && stateManager.knownReachableRegions) {
           return stateManager.knownReachableRegions.has(regionName);
         }

         // Otherwise use cached snapshot
         const status = snapshot?.regionReachability?.[regionName];
         if (status === 'reachable' || status === 'checked') return true;
         if (status === 'unreachable') return false;
         return undefined;
       }

4. Result
   └─> Returns boolean indicating if region is reachable
   └─> ✅ NO PLAYER FILTERING OCCURS
```

### Path B: `state_method` with `can_reach` (Type 2)

```
1. Rule Evaluation Entry
   └─> evaluateRule(rule, context, depth)
       Location: ruleEngine.js:335

2. Switch on rule.type = 'state_method'
   └─> case 'state_method': (line 471)
       ├─> Evaluate all args: args.map(arg => evaluateRule(arg, context, depth + 1))
       └─> Call: context.executeStateManagerMethod(rule.method, ...args)

3. State Method Dispatcher
   └─> stateInterface.js:393-409
       executeStateManagerMethod: (methodName, ...args) => {
         return executeStateMethod(stateManager, methodName, ...args);
       }

4. State Method Executor
   └─> ruleEvaluator.js:130-213
       export function executeStateMethod(manager, method, ...args) {

         // Special case for can_reach (line 144-148)
         if (method === 'can_reach' && args.length >= 1) {
           const targetName = args[0];
           const targetType = args[1] || 'Region';
           const player = args[2] || 1;  // ← Default player = 1
           return manager.can_reach(targetName, targetType, player);
         }
       }

5. StateManager Delegate
   └─> stateManager.js:687-688
       can_reach(target, type = 'Region', player = 1) {
         return ReachabilityModule.can_reach(this, target, type, player);
       }

6. ⚠️ PLAYER FILTERING OCCURS HERE ⚠️
   └─> reachabilityEngine.js:670-713
       export function can_reach(sm, target, type = 'Region', player = 1) {

         // 🐛 BUG LOCATION 🐛
         if (player !== sm.playerSlot) {
           sm._logDebug(`[ReachabilityEngine] can_reach check for wrong player (${player})`);
           return false;  // ← Returns false WITHOUT checking reachability!
         }

         // Only reaches here if player === sm.playerSlot
         if (type === 'Region') {
           return isRegionReachable(sm, target);
         } else if (type === 'Location') {
           const location = sm.locations.get(target);
           return location && isLocationAccessible(sm, location);
         } else if (type === 'Entrance') {
           // ... entrance checking logic
         }

         return false;
       }

7. Reachability Check (if player matched)
   └─> isRegionReachable(sm, regionName)
       Location: reachabilityEngine.js:507-514
```

---

## 3. The Player ID Problem: Detailed Analysis

### Where `sm.playerSlot` is Set

**Location**: `stateManager.js:99`
```javascript
// Player identification
this.playerSlot = 1; // Default player slot to 1 for single-player/offline
this.team = 0; // Default team
```

**Key Observation**: `playerSlot` is hardcoded to `1` and never updated in single-player mode.

### The Filter Logic

**Location**: `reachabilityEngine.js:672-674`
```javascript
if (player !== sm.playerSlot) {
  sm._logDebug(`[ReachabilityEngine] can_reach check for wrong player (${player})`);
  return false;
}
```

### Why This Causes Failures

| Scenario | `sm.playerSlot` | Rule Parameter | Result | Reason |
|----------|----------------|----------------|--------|--------|
| Normal single-player | 1 | 1 (default) | ✅ Works | Player matches |
| Explicit player=1 | 1 | 1 | ✅ Works | Player matches |
| **Explicit player=2** | **1** | **2** | **❌ FAILS** | **Player mismatch - returns false immediately** |
| **Missing 3rd arg** | **1** | **1 (default)** | **✅ Works** | **Defaults to 1, matches** |

### Example: Failing Rule

From the codebase, a typical `state_method` can_reach call:
```json
{
  "type": "state_method",
  "method": "can_reach",
  "args": [
    {"type": "constant", "value": "Riverside Race - Flag"},
    {"type": "constant", "value": "Location"}
  ]
}
```

**Analysis**:
- args[0] = "Riverside Race - Flag"
- args[1] = "Location"
- args[2] = **undefined** → defaults to `1` in `ruleEvaluator.js:147`
- Player check: `1 !== 1` → **false** → continues to reachability check
- **This works correctly!**

**Problem Case** (hypothetical but possible):
```json
{
  "type": "state_method",
  "method": "can_reach",
  "args": [
    {"type": "constant", "value": "SomeRegion"},
    {"type": "constant", "value": "Region"},
    {"type": "constant", "value": 2}  // ← Explicit player 2
  ]
}
```

**Analysis**:
- args[0] = "SomeRegion"
- args[1] = "Region"
- args[2] = `2`
- Player check: `2 !== 1` → **true** → **returns false immediately**
- Reachability is **never checked**, even if the region is actually reachable
- **This fails unconditionally!**

---

## 4. Architecture Context

### StateManager Initialization

The StateManager is created with a default player slot that reflects the current player's perspective:

```javascript
// stateManager.js:99
this.playerSlot = 1; // Default player slot to 1 for single-player/offline
```

**Purpose**: This design assumes that each StateManager instance represents a single player's game state. In multiplayer scenarios, each player would have their own StateManager instance with their respective `playerSlot` value.

### Multiworld Considerations

In Archipelago's multiworld system:
- Each player has their own world/slot number
- Items and locations are player-specific
- Reachability should be evaluated from each player's perspective

**Current Behavior**:
- The frontend creates a single StateManager per loaded game
- `playerSlot` is always `1` in single-player mode
- Rules exported from Python that include explicit player parameters (e.g., `state.can_reach("Region", player=2)`) will fail the player check

### Why The Filter Exists

The player filtering appears to be a **safety mechanism** to prevent cross-player state leakage:

```javascript
// The context-aware state manager handles position-specific constraints correctly
if (player !== sm.playerSlot) {
  sm._logDebug(`[ReachabilityEngine] can_reach check for wrong player (${player})`);
  return false;
}
```

**Intent**: Ensure that reachability checks are only performed for the current player's state, preventing:
1. Checking if Player 2 can reach something using Player 1's items
2. Cross-contamination in multiworld scenarios
3. Incorrect logic evaluations in multiplayer contexts

**Problem**: In single-player scenarios or when debugging, this filter becomes overly restrictive.

---

## 5. BFS Reachability Computation

The actual reachability logic (when player check passes) uses a breadth-first search algorithm:

### Core BFS Implementation

**Location**: `reachabilityEngine.js:200-311`

```javascript
export function computeReachableRegions(sm) {
  // 1. Initialize with start regions
  const startRegions = getStartRegions(sm);

  // 2. Run BFS passes until no new regions are discovered
  let changed = true;
  let passCount = 0;
  const maxPasses = 100;

  while (changed && passCount < maxPasses) {
    changed = runBFSPass(sm);
    passCount++;
  }

  // 3. Build and cache results
  sm.knownReachableRegions = new Set(reachableRegions);

  // 4. Store in snapshot for UI
  snapshot.regionReachability = {};
  for (const region of reachableRegions) {
    snapshot.regionReachability[region] = 'reachable';
  }
}
```

### Region Reachability Check

**Location**: `reachabilityEngine.js:507-514`

```javascript
function isRegionReachable(sm, regionName) {
  const reachableRegions = getReachableRegions(sm);
  return reachableRegions.has(regionName);
}
```

**Key Points**:
- BFS results are cached in `sm.knownReachableRegions` (live) and `snapshot.regionReachability` (frozen)
- During BFS computation (`sm._computing = true`), live results are used
- After BFS, cached snapshot data is used
- This caching is invalidated on inventory changes or state updates

---

## 6. Debugging Observations

### Debug Logging

When the player filter triggers, you'll see:
```
[ReachabilityEngine] can_reach check for wrong player (2)
```

This log appears in `reachabilityEngine.js:673` when `sm._logDebug` is enabled.

### How to Detect This Issue

1. **Check Rule Format**: Look for `state_method` type rules with `can_reach` method
2. **Count Arguments**: If there are 3 arguments, check the 3rd one (player parameter)
3. **Verify Player Value**: If player ≠ 1, the rule will fail
4. **Check Console**: Look for the debug log message above

### Example Investigation Commands

```bash
# Find all state_method can_reach rules
grep -A 10 '"method": "can_reach"' rules.json

# Check for explicit player parameters (3 args)
jq '.regions[].exits[] | select(.access_rule.method == "can_reach" and (.access_rule.args | length) > 2)' rules.json

# Verify player_names in the rules file
jq '.player_names' rules.json
```

---

## 7. Real-World Rule Examples

### Example 1: Working Rule (2 Arguments)

From `dkc3/AP_14089154938208861744_rules.json:690-715`:

```json
{
  "name": "Arich's Hoard Region",
  "connected_region": "Arich's Hoard Region",
  "access_rule": {
    "type": "state_method",
    "method": "can_reach",
    "args": [
      {"type": "constant", "value": "Riverside Race - Flag"},
      {"type": "constant", "value": "Location"}
    ]
  }
}
```

**Execution Flow**:
1. `args[0]` = "Riverside Race - Flag"
2. `args[1]` = "Location"
3. `args[2]` = undefined → defaults to `1`
4. Player check: `1 !== 1` → false → **passes filter**
5. Calls `isLocationAccessible(sm, "Riverside Race - Flag")`
6. Returns actual reachability result

**Result**: ✅ Works correctly

### Example 2: Direct can_reach Rule

```json
{
  "type": "can_reach",
  "region": {
    "type": "constant",
    "value": "SomeRegion"
  }
}
```

**Execution Flow**:
1. Evaluates to region name "SomeRegion"
2. Calls `context.isRegionReachable("SomeRegion")`
3. Checks live or cached reachability
4. **No player parameter involved**

**Result**: ✅ Works correctly, no player filtering

### Example 3: Problematic Rule (Hypothetical)

```json
{
  "type": "state_method",
  "method": "can_reach",
  "args": [
    {"type": "constant", "value": "GoalRegion"},
    {"type": "constant", "value": "Region"},
    {"type": "constant", "value": 2}  // ← Explicit player 2
  ]
}
```

**Execution Flow**:
1. `args[0]` = "GoalRegion"
2. `args[1]` = "Region"
3. `args[2]` = `2`
4. Player check: `2 !== 1` → **true** → **RETURNS FALSE**
5. Never checks actual reachability
6. Debug log: `[ReachabilityEngine] can_reach check for wrong player (2)`

**Result**: ❌ Always fails, regardless of actual reachability

---

## 8. Game-Specific Observations

### Kingdom Hearts 2 (kh2)

**File**: `frontend/presets/kh2/AP_14089154938208861744/AP_14089154938208861744_rules.json`

- **Player IDs**: Only player `1` exists
- **Rule Types Used**:
  - 729 `constant` rules
  - 111 `helper` rules (game-specific)
  - 78 `item_check` rules
  - 5 `and` rules
  - **0 `can_reach` rules**

**Observation**: KH2 does not use `can_reach` rules at all, relying instead on custom helpers and item checks. This suggests the `can_reach` issue may not affect all games.

### Donkey Kong Country 3 (dkc3)

**File**: `frontend/presets/dkc3/AP_14089154938208861744/AP_14089154938208861744_rules.json`

- **Player IDs**: Only player `1` exists
- **can_reach Usage**: 4 instances, all `state_method` type
- **All use 2 arguments** (target, type) - no explicit player parameter
- **Result**: All work correctly (default to player 1)

---

## 9. Potential Solutions

### Solution 1: Remove Player Filtering in Single-Player Mode

**Location**: `reachabilityEngine.js:672-674`

```javascript
// Current code:
if (player !== sm.playerSlot) {
  sm._logDebug(`[ReachabilityEngine] can_reach check for wrong player (${player})`);
  return false;
}

// Proposed change:
if (player !== sm.playerSlot) {
  if (sm.isMultiworld) {
    // Only filter in multiworld scenarios
    sm._logDebug(`[ReachabilityEngine] can_reach check for wrong player (${player})`);
    return false;
  } else {
    // In single-player, log but continue checking
    sm._logDebug(`[ReachabilityEngine] can_reach ignoring player mismatch in single-player (${player})`);
  }
}
```

**Pros**:
- Allows debugging and testing with different player values
- Maintains safety in multiworld scenarios
- Minimal code change

**Cons**:
- Requires adding `isMultiworld` flag to StateManager
- May not address root cause if rules are genuinely incorrect

### Solution 2: Normalize Player Parameter During Rule Export

**Location**: Python export code (not shown, but in Archipelago core)

Ensure that when rules are exported from Python to JSON, player parameters are:
1. Omitted if they match the current player
2. Normalized to 1 in single-player scenarios
3. Validated during export

**Pros**:
- Fixes the issue at the source
- Rules files become more correct
- No frontend changes needed

**Cons**:
- Requires changes to Python export logic
- May not be feasible if player parameters serve a different purpose

### Solution 3: Default Player to Current Player

**Location**: `ruleEvaluator.js:147`

```javascript
// Current code:
const player = args[2] || 1;

// Proposed change:
const player = args[2] || manager.playerSlot || 1;
```

**Pros**:
- Simple one-line change
- Automatically uses the correct player
- Backwards compatible

**Cons**:
- Masks the underlying issue
- May not work correctly in multiworld if rules have explicit player values

### Solution 4: Log Warning Instead of Hard Fail

**Location**: `reachabilityEngine.js:672-674`

```javascript
if (player !== sm.playerSlot) {
  sm._logWarn(`[ReachabilityEngine] can_reach check for different player (requested: ${player}, current: ${sm.playerSlot})`);
  // Continue to check reachability anyway
}
```

**Pros**:
- Alerts developers to potential issues
- Doesn't break functionality
- Easy to debug

**Cons**:
- May produce incorrect results in genuine multiworld scenarios
- Could mask real bugs

---

## 10. Recommended Action

Based on this investigation, the recommended approach is:

1. **Verify Rule Export**: Check if the Python rule export is correctly handling player parameters
2. **Add Multiworld Detection**: Implement a way to detect multiworld vs single-player mode
3. **Conditional Filtering**: Only apply strict player filtering in multiworld scenarios
4. **Enhanced Logging**: Add more detailed logs to understand when and why mismatches occur

### Immediate Debug Steps

To debug the current issue:

1. **Enable Debug Logging**:
   ```javascript
   sm._logDebug = console.log.bind(console);
   ```

2. **Search for Player Mismatches**:
   ```bash
   grep -r "wrong player" logs/
   ```

3. **Inspect Rules with 3 Arguments**:
   ```bash
   jq '.regions[].exits[] | select(.access_rule.method == "can_reach" and (.access_rule.args | length) == 3)' rules.json
   ```

4. **Check StateManager Player Slot**:
   ```javascript
   console.log('Current player slot:', stateManager.playerSlot);
   ```

---

## 11. File Reference Summary

### Core Implementation Files

| File | Lines | Key Functions | Purpose |
|------|-------|---------------|---------|
| `reachabilityEngine.js` | 726 | `can_reach()` (670-713)<br>`isRegionReachable()` (507-514)<br>`computeReachableRegions()` (200-311) | ⚠️ Player filtering occurs here<br>BFS implementation<br>Reachability computation |
| `ruleEngine.js` | 2213 | `evaluateRule()` (335-1912)<br>case 'can_reach' (1789-1803)<br>case 'state_method' (471-492) | Main rule evaluation engine<br>Handles both rule types |
| `ruleEvaluator.js` | 604 | `executeStateMethod()` (130-213) | Dispatches state method calls<br>Sets default player=1 |
| `stateInterface.js` | 822 | `isRegionReachable()` (458-471)<br>`executeStateManagerMethod()` (393-409) | Context interface for rule evaluation<br>Bridges rules to StateManager |
| `stateManager.js` | ~800 | `constructor()` (lines ~85-109)<br>`can_reach()` (687-688) | Initializes `playerSlot = 1`<br>Delegates to ReachabilityModule |

### Critical Code Locations

1. **Player Slot Initialization**: `stateManager.js:99`
2. **Player Filter Check**: `reachabilityEngine.js:672-674` ⚠️ **BUG LOCATION**
3. **Default Player Assignment**: `ruleEvaluator.js:147`
4. **Direct can_reach Handler**: `ruleEngine.js:1789-1803`
5. **State Method Handler**: `ruleEngine.js:471-492`

---

## 12. Conclusion

The `can_reach` rule resolution process in the frontend is well-architected with proper caching, BFS computation, and context-aware evaluation. However, the **player ID filtering mechanism in `reachabilityEngine.js:672-674` is overly restrictive for single-player scenarios**.

**Key Finding**: Any `state_method` type `can_reach` rule that explicitly passes a player parameter different from 1 will unconditionally fail, returning `false` without checking actual reachability.

**Impact**: This primarily affects:
- Rules exported from Python with explicit player parameters
- Debugging scenarios where testing different player perspectives
- Any custom rules that specify player ≠ 1

**Next Steps**:
1. Determine if rules with player ≠ 1 are being generated
2. Decide on solution approach (filter removal, normalization, or conditional logic)
3. Implement fix with appropriate tests
4. Update rule export logic if needed

---

**Investigation Date**: November 24, 2025
**Codebase**: Archipelago-CC Frontend
**Branch**: `claude/debug-can-reach-rule-01KRqrTe9uDMemtnuqEgxwue`
