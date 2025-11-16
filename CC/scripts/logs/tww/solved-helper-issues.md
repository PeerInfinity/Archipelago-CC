# The Wind Waker - Solved Helper Issues

## Issue 1: Helper functions using incorrect snapshot API

**Status:** SOLVED
**Solved Date:** 2025-11-16
**Priority:** Critical
**Category:** Helper Implementation

**Description:**
All TWW helper functions in `frontend/modules/shared/gameLogic/tww/twwLogic.js` were calling methods like `snapshot.has()`, `snapshot.hasAny()`, `snapshot.hasAll()`, and `snapshot.hasGroupUnique()` which don't exist on the snapshot object.

**Error Messages:**
```
TypeError: snapshot.has is not a function
TypeError: snapshot.hasAny is not a function
TypeError: snapshot.hasGroupUnique is not a function
```

**Root Cause:**
The helper functions were written assuming the snapshot parameter has methods, but it's actually a plain JavaScript object with properties like `inventory`, `flags`, `events`, etc.

**Solution:**
Rewrote all helper functions in `frontend/modules/shared/gameLogic/tww/twwLogic.js` to follow the pattern used by other games (e.g., ALTTP):
1. Added basic utility functions: `has()`, `count()`, `hasAny()`, `hasAll()`, `hasGroupUnique()`
2. Updated all ~80 helper functions to call these utilities instead of calling methods on snapshot
3. Implemented progressive item handling correctly

**Files Modified:**
- frontend/modules/shared/gameLogic/tww/twwLogic.js

**Result:**
- Test now progresses from Sphere 0 (where it was failing before) to Sphere 12.2
- All basic helper functions work correctly
- Progressive items are handled correctly

---

## Issue 2: hasGroupUnique not accessing items data correctly

**Status:** SOLVED
**Solved Date:** 2025-11-16
**Priority:** High
**Category:** Helper Implementation

**Description:**
The `hasGroupUnique` function was only checking `staticData?.items?.[playerSlot]` for items data, but the items can be stored in multiple possible locations depending on the game.

**Error Messages:**
```
REGION MISMATCH found for: {"type":"state_update","sphere_number":"12.2","player_id":"1"}
> Regions accessible in LOG but NOT in STATE: Master Sword Chamber
ISSUE: Region Master Sword Chamber is not reachable
ISSUE: Access rule evaluation failed
```

**Root Cause:**
The `hasGroupUnique` function was not checking all possible locations for items data. Different games and contexts may store items in `staticData.itemsByPlayer`, `staticData.itemData`, or `staticData.items`.

**Solution:**
Updated `hasGroupUnique` to check multiple possible locations for items data, following the ALTTP pattern:
```javascript
const items = staticData?.itemsByPlayer?.[playerSlot] || staticData?.itemData || staticData?.items?.[playerSlot];
```

**Files Modified:**
- frontend/modules/shared/gameLogic/tww/twwLogic.js

**Result:**
- Test now passes completely with all 67 steps passing
- hasGroupUnique correctly counts Triforce Shards
- Master Sword Chamber region is now accessible
- TWW spoiler test passes completely!
