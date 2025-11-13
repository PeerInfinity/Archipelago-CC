# Solved Helper Issues

## Added basic `has` and `count` helper functions

**Date:** 2025-11-13

**Issue:**
- mmbn3/helpers.js was missing basic `has` and `count` functions
- These are required for proper item checking in access rules

**Solution:**
- Added `has(snapshot, staticData, itemName)` function that checks `snapshot.inventory[itemName] > 0`
- Added `count(snapshot, staticData, itemName)` function that returns `snapshot.inventory[itemName] || 0`
- Updated the default export to include these functions

**Files Modified:**
- `frontend/modules/shared/gameLogic/mmbn3/helpers.js`

**Note:**
This fix alone was not sufficient to resolve the test failure for "Job: My Navi is sick" location.

