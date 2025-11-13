# DLCQuest General Remaining Issues

## Overview
This document tracks general issues with DLCQuest that don't fit in the exporter or helper categories.

Last updated: 2025-11-13

## Critical Issues

### Issue 1: StateManager Missing `prog_items` Support

**Status**: Not Started
**Priority**: Critical
**Affects**: Sphere 0.1 and all subsequent spheres

**Description**:
The spoiler test fails at Sphere 0.1 because the location "Movement Pack" cannot be accessed. The access rule for this location is:

```javascript
{
  "type": "compare",
  "left": {
    "type": "subscript",
    "value": {
      "type": "subscript",
      "value": {
        "type": "attribute",
        "object": {"type": "name", "name": "state"},
        "attr": "prog_items"
      },
      "index": {"type": "constant", "value": 1}
    },
    "index": {"type": "constant", "value": " coins"}
  },
  "op": ">=",
  "right": {"type": "constant", "value": 4}
}
```

This translates to: `state.prog_items[1][" coins"] >= 4`

**Root Cause**:
The JavaScript StateManager's snapshot does not include a `prog_items` attribute. In Archipelago's Python CollectionState, `prog_items` is a nested dictionary that tracks accumulating/progressive items:

```python
prog_items[player_id][item_name] = count
```

For DLCQuest, the Python code uses:
- `prog_items[player][" coins"]` - tracks total coins in main campaign
- `prog_items[player][" coins freemium"]` - tracks total coins in freemium campaign

When players collect coin bundle items like "4 coins", "46 coins", etc., those amounts are accumulated into the " coins" total:

```python
# From worlds/dlcquest/__init__.py
state.prog_items[self.player][suffix] += item.coins  # Add coins
state.prog_items[self.player][suffix] -= item.coins  # Remove coins
```

**Expected Behavior**:
1. The StateManager snapshot should include a `prog_items` attribute
2. Structure: `prog_items[player_id][item_name] = accumulated_count`
3. When items with accumulation logic are added to inventory, their counts should be accumulated in `prog_items`
4. For DLCQuest specifically:
   - When "4 coins" is collected, `prog_items[1][" coins"]` should increase by 4
   - When "46 coins" is collected, `prog_items[1][" coins"]` should increase by 46
   - The " coins" item is a special accumulator item (exported by the exporter)

**Files to Modify**:
1. `frontend/modules/stateManager/core/statePersistence.js`
   - Add `prog_items` to snapshot structure in `getSnapshot()`
   - Initialize `prog_items` structure (probably in initialization.js or during loadFromJSON)

2. `frontend/modules/stateManager/core/inventoryManager.js`
   - Update `_addItemToInventory()` to accumulate coins in `prog_items`
   - Update `_removeItemFromInventory()` to remove coins from `prog_items`
   - Need to detect coin items and extract the amount (e.g., "4 coins" → 4)

3. `frontend/modules/stateManager/core/initialization.js`
   - Initialize `sm.prog_items` structure during loadFromJSON

**Implementation Details**:
- `prog_items` should be a plain object: `{[playerId]: {[itemName]: count}}`
- For DLCQuest coin items, parse the item name to extract the count:
  - Pattern: `/^(\d+) coins/` to match "4 coins", "46 coins", etc.
  - Accumulate into " coins" or " coins freemium" based on campaign
- The accumulator items (" coins", " coins freemium") should not be added to regular inventory
- They exist only in `prog_items` for rule evaluation

**Test Case**:
After fix, the spoiler test should pass Sphere 0.1:
- Sphere 0: Player starts with no coins, can access "Move Right coins"
- Sphere 0.1: Player collects "4 coins" from "Move Right coins", making `prog_items[1][" coins"] = 4`
- This should make "Movement Pack" accessible (requires >= 4 coins)

**Error Output**:
```
> Locations accessible in LOG but NOT in STATE (or checked): Movement Pack
ISSUE: Access rule evaluation failed
```

