# Secret of Evermore - Remaining Helper Issues

## Issue 1: Inventory remains empty - items not being added to state

**Status:** Investigating
**Priority:** Critical
**Type:** State Management / Item Collection

### Description
The SOE helper function `has()` is being called correctly, but `snapshot.inventory` is always empty even after items should have been collected. According to the sphere log, Knight Basher should be collected at sphere 0.1, but the inventory remains empty.

### Debug Output
```
[SOE countProgress] Checking progress_id 1
[SOE countProgress] Inventory: []
[SOE countProgress] Items with provides: 41
```

The inventory is empty, so `countProgress` always returns 0, causing all progress checks to fail.

### Expected Behavior
After collecting items from locations, they should be added to `snapshot.inventory`. For example:
- Sphere 0.1: Collect Knight Basher from "FE Village Hut #28"
- Inventory should contain: `{"Knight Basher": 1}`
- Progress check for P_WEAPON (progress_id 1) should return count=1

### Actual Behavior
- Items are collected from locations
- `snapshot.inventory` remains `{}`
- All progress checks return count=0
- No locations become accessible after the initial sphere

### Possible Causes
1. State manager not calling `collectItem()` or equivalent when items are found
2. Items stored under a different key (not `inventory`)
3. SOE-specific item collection mechanism not implemented
4. Event items (like Knight Basher at event locations) not being added to inventory

### Investigation Needed
1. Check how state manager processes collected items
2. Verify snapshot structure for SOE
3. Check if there's a game-specific collection mechanism needed
4. Review how other games handle item collection in helpers

### Files Involved
- `frontend/modules/shared/gameLogic/soe/soeLogic.js` - Helper function
- `frontend/modules/stateManager/` - State management code
- Possibly game-specific state management hooks

### Workaround
None - this is blocking all progress checks from working.
