# DLCQuest General Remaining Issues

## Overview
This document tracks general issues with DLCQuest that don't fit in the exporter or helper categories.

Last updated: 2025-11-13

## Critical Issues

### Issue 1: Location "Movement Pack" Accessible Too Early

**Status**: In Progress
**Priority**: Critical
**Affects**: Spoiler test fails at Sphere 0

**Previous Issue (RESOLVED)**: StateManager was missing `prog_items` support - this has been implemented.

**Current Issue**:
The spoiler test now reports:
```
Locations accessible in STATE (and unchecked) but NOT in LOG: Movement Pack
```

This occurs in Sphere 0, meaning the JavaScript StateManager thinks "Movement Pack" is accessible
immediately at game start, but the Python spoiler log says it shouldn't be accessible until
Sphere 0.1 (after collecting 4 coins).

**Access Rule**:
```javascript
state.prog_items[1][" coins"] >= 4
```

**Current Behavior**:
- Location "Movement Pack" in region "Move Right" is accessible in Sphere 0 according to STATE
- According to LOG, it should NOT be accessible until Sphere 0.1

**Implementation Completed**:
1. ✅ Added `prog_items` to StateManager snapshot structure
2. ✅ Initialize `prog_items[playerId]` as empty object during loadFromJSON
3. ✅ Explicitly initialize DLCQuest coin accumulators (" coins", " coins freemium") to 0
4. ✅ Implement coin accumulation in `_addItemToInventory()` - detects "X coins" pattern and accumulates into " coins"
5. ✅ Implement coin removal in `_removeItemFromInventory()`
6. ✅ Clear prog_items in `clearInventory()`

**Expected Behavior After Fix**:
- Sphere 0: `prog_items[1][" coins"]` = 0, "Movement Pack" NOT accessible (`0 >= 4` is false)
- Sphere 0.1: After collecting "4 coins", `prog_items[1][" coins"]` = 4, "Movement Pack" becomes accessible (`4 >= 4` is true)

**Debugging Next Steps**:
1. Add detailed logging to coin accumulation code to verify when/how coins are being added
2. Add logging to rule evaluation to see what value `state.prog_items[1][" coins"]` returns during Sphere 0 evaluation
3. Check if there's an issue with subscript evaluation returning unexpected values
4. Verify the comparison operator `>=` is working correctly with number values
5. Check if there's a timing issue - maybe reachability is computed before prog_items is initialized?
6. Verify that the rule engine's subscript evaluation correctly handles nested empty objects

**Possible Root Causes**:
1. Subscript evaluation might be returning a truthy non-zero value instead of 0 or undefined
2. The comparison might not be handling the numeric comparison correctly
3. There might be a timing issue where locations are evaluated before prog_items is properly initialized
4. The access rule might be cached from a previous run
5. There might be an issue with how `undefined >= 4` is evaluated (should be false)

**Related Code**:
- Access rule evaluation: `frontend/modules/shared/ruleEngine.js` (subscript and compare types)
- State interface: `frontend/modules/shared/stateInterface.js` (resolveName for "state")
- Initialization: `frontend/modules/stateManager/core/initialization.js`

