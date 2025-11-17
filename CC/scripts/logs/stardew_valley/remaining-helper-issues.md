# Remaining Helper Issues - Stardew Valley

## Issue 1: Virtual Event Items Not Tracked

**Location:** Read Jack Be Nimble, Jack Be Thick
**Sphere:** 0.16
**Status:** In Progress - Implementation Complete, Needs Debugging

**Description:**
The location "Read Jack Be Nimble, Jack Be Thick" requires `Received Progression Percent >= 4`, but the JavaScript state manager is not properly tracking this virtual event item.

**Root Cause:**
Stardew Valley uses two virtual event items that are computed automatically when progression items are collected:
- `Received Progression Item`: Increments by 1 when any advancement item is collected
- `Received Progression Percent`: Computed as `(received_progression_item_count * 100) // total_progression_items`

These items are not in the itempool but are added dynamically by the Python `collect()` method in `worlds/stardew_valley/__init__.py` (lines 393-399).

**Python Implementation:**
```python
# From worlds/stardew_valley/__init__.py:398
received_progression_count = player_state[Event.received_progression_item]
received_progression_count += 1
if self.total_progression_items:
    player_state[Event.received_progression_percent] = received_progression_count * 100 // self.total_progression_items
player_state[Event.received_progression_item] = received_progression_count
```

**Required Fix:**
The JavaScript state manager needs to:
1. Track when advancement items are collected
2. Auto-increment `Received Progression Item` for each advancement item
3. Recalculate `Received Progression Percent` using the formula: `Math.floor((count * 100) / total_progression_items)`
4. Initialize these items in the starting state

**Details:**
- Total progression items for seed 1: 637
- At Sphere 0.16: Player has received 13 progression items, giving progression percent of 4
- Starting values (Sphere 0): `Received Progression Item: 2`, `Received Progression Percent: 0`

**Test Case:**
```bash
npm test -- --mode=test-spoilers --game=stardew_valley --seed=1
```
Should pass at Sphere 0.16 after fix.

**Implementation Completed:**
1. ✅ Created `frontend/modules/shared/gameLogic/stardew_valley/stardewValleyLogic.js` with hooks
2. ✅ Updated exporter to export `total_progression_items: 322` in game_info
3. ✅ Updated state manager initialization to load totalProgressionItems and call initializeVirtualItems
4. ✅ Added `afterItemAdded` and `afterItemRemoved` hooks in inventoryManager
5. ✅ Registered Stardew Valley logic module in gameLogicRegistry.js

**Files Modified:**
- `frontend/modules/shared/gameLogic/stardew_valley/stardewValleyLogic.js` (created)
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js`
- `exporter/games/stardew_valley.py`
- `frontend/modules/stateManager/core/initialization.js`
- `frontend/modules/stateManager/core/inventoryManager.js`

**Next Debugging Steps:**
1. Verify hooks are being called with console.log
2. Check browser caching issues
3. Add inventory state logging at Sphere 0.16
4. Verify _logDebug messages are enabled

**Current Test Result:**
Test still fails at Sphere 0.16, same error. Module files are being loaded (confirmed via HTTP requests), but debug messages from hooks not appearing in logs.
