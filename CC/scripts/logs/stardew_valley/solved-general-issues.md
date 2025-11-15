# Stardew Valley - Solved General Issues

This file tracks general issues for Stardew Valley that have been successfully fixed.

## Solved Issues

### 1. Missing `isRegionAccessible` function in rule engine context

**Error:** `context.isRegionAccessible is not a function for region_check`

**Description:** The rule engine was trying to evaluate `region_check` rules but the `isRegionAccessible` function was not defined in the context object. The interface only provided `isRegionReachable`.

**Location:** `frontend/modules/shared/stateInterface.js`

**Solution:** Added an alias `isRegionAccessible` that calls `isRegionReachable` to match the naming convention expected by the rule engine.

**Files Modified:**
- `frontend/modules/shared/stateInterface.js` (added isRegionAccessible alias)
