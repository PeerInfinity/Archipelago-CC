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
