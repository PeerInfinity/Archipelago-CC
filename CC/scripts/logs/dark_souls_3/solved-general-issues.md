# Dark Souls III - Solved General Issues

This document tracks resolved general issues for Dark Souls III.

## Resolved Issues

### 1. Missing isLocationAccessible in StateManager Snapshot Interface
**Issue**: The `_createSelfSnapshotInterface` method in `statePersistence.js` didn't include the `isLocationAccessible` method, causing all `location_check` rule types to fail.

**Solution**: Added `isLocationAccessible` method to the interface in `statePersistence.js:330-357`

**Impact**: Fixed access to regions that require location checks (boss kills). Test progressed from sphere 0.4 to sphere 2.14.

**Files Modified**: `frontend/modules/stateManager/core/statePersistence.js`

**Fixed**: 2025-11-11

### 2. Missing _can_go_to Conversion in Exporter
**Issue**: The Dark Souls III exporter didn't convert `self._can_go_to(region)` calls to proper `can_reach` rules, causing "Name 'self' NOT FOUND in context" errors.

**Root Cause**: The Python world uses `_can_go_to(state, region)` to check if an entrance to a region is reachable. The exporter was only handling `_can_get` but not `_can_go_to`.

**Solution**: Updated `postprocess_rule` method in the Dark Souls III exporter to convert `self._can_go_to(region)` to `can_reach` rules.

**Impact**: Fixed access to 3 Patches-related locations in Cathedral of the Deep and Firelink Shrine. Test now passes all spheres (1194 locations).

**Files Modified**: `exporter/games/dark_souls_3.py`

**Fixed**: 2025-11-11

---

Last updated: 2025-11-11
