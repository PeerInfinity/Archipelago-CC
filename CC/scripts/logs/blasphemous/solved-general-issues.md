# Blasphemous General Issues (Solved)

## Analysis Date
2025-11-19

## Solved Issues

### Issue 1: Menu Region Filtering
**Date Solved**: 2025-11-19
**Priority**: HIGH

**Problem**:
The comparison engine had special handling to filter "Menu" region only for CvCotM, but Blasphemous also includes a "Menu" region in its sphere log. This caused comparison mismatches.

**Solution**:
Updated `frontend/modules/testSpoilers/comparisonEngine.js` to filter "Menu" region universally for all games, not just CvCotM. Now filters "Menu" from both STATE and LOG accessible regions for consistent comparison.

**Files Modified**:
- `frontend/modules/testSpoilers/comparisonEngine.js` (lines 349-359)

**Commit**: 2f30baf5

---

### Issue 2: Starting Items Not Being Added to Inventory
**Date Solved**: 2025-11-19
**Priority**: CRITICAL

**Problem**:
The `processStartingItems` function in `initialization.js` used incorrect lookup logic:
- `itemData` is indexed by item ID (e.g., "1909132"), not by item name
- The code checked `sm.itemData[itemName]` which always failed
- Starting items (Dash Ability, Wall Climb Ability) were never added to inventory
- This caused all Sphere 0 locations and regions to be inaccessible

**Solution**:
Fixed the lookup logic to:
1. First look up the item ID using `sm.itemNameToId[itemName]`
2. Then check if that ID exists in `sm.itemData`
3. Add logging to confirm item addition

**Files Modified**:
- `frontend/modules/stateManager/core/initialization.js` (lines 485-497)

**Commit**: 2f30baf5

**Impact**:
This was a critical bug affecting ALL games with starting items. The fix ensures starting items are correctly added during initialization, allowing proper game state calculation from the start.
