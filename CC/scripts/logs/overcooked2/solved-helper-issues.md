# Solved Helper Issues for Overcooked! 2

## Issue 1: Incorrect snapshot property reference (snapshot.items vs snapshot.inventory)

**Status:** SOLVED

**Description:**
- The spoiler test was failing at Sphere 0.1 because region 5-1 was not recognized as reachable
- The helper functions `has_enough_stars`, `has_requirements_for_level_star`, `meets_requirements`, and the internal `checkStarRequirements` function were using `snapshot.items` to check the player's inventory
- However, the actual snapshot object uses `snapshot.inventory`, not `snapshot.items`
- This caused all helper functions to fail their inventory checks and return false

**Error Message:**
```
Locations accessible in LOG but NOT in STATE (or checked): 5-1 (1-Star), 5-1 Completed, 5-1 Level Completed
ISSUE: Region 5-1 is not reachable
```

**Root Cause:**
The helper functions were written to match a different snapshot interface that uses `.items`, but the actual StateManager provides snapshots with an `.inventory` property.

**Fix:**
Updated all references from `snapshot.items` to `snapshot.inventory` in:
- `has_enough_stars()` function
- `has_requirements_for_level_star()` function (via `checkStarRequirements()`)
- `meets_requirements()` function
- `checkStarRequirements()` internal function

**Files Modified:**
- `frontend/modules/shared/gameLogic/overcooked2/helpers.js`

**Test Results:**
After the fix, all 216 sphere events passed successfully:
- Sphere 0: 9 locations accessible (starting state)
- Sphere 0.1: 12 locations accessible (after collecting first star)
- All subsequent spheres passed correctly
- Total: 216/216 events processed, 0 errors

**Commit:** (to be created)
