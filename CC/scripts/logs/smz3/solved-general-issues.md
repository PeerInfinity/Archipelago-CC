# Solved SMZ3 General Issues

## Issue 1: Region reachability not updated after checking locations

**Status**: FIXED

**Description**:
When a location was checked and an item was added to inventory, the region reachability was not being recomputed. This caused the snapshot to have stale region reachability data, leading to false test failures.

**Root Cause**:
In `frontend/modules/stateManager/core/locationChecking.js`, after adding an item to inventory, the code called `_sendSnapshotUpdate()` but did NOT call `computeReachableRegions()` first. This meant the snapshot still had the old region reachability from before the item was added.

**Solution**:
Modified `locationChecking.js` to call `sm.computeReachableRegions()` after checking a location and before sending the snapshot update. This ensures that when new items are added to inventory, the region reachability is recomputed to reflect which new regions become accessible.

**Files Changed**:
- `frontend/modules/stateManager/core/locationChecking.js` - Added `computeReachableRegions()` call

**Code Change**:
```javascript
// Added after sm.invalidateCache():
if (locationWasActuallyChecked) {
  sm.computeReachableRegions();
}
```

**Note**:
This fix is essential for correct region reachability tracking and works together with Issue 2's fix below.

## Issue 2: Non-advancement items skipped in spoiler test mode

**Status**: FIXED

**Description**:
When running spoiler tests in full spoilers mode (`extend_sphere_log_to_all_locations=True`), the JavaScript test harness was skipping non-advancement items during location checking. This caused a mismatch with Python's behavior, where ALL items are collected regardless of advancement flag in full spoilers mode.

The symptom was a region mismatch at sphere 5.3: "Castle Tower" was expected to be accessible but wasn't. Castle Tower requires MasterSword (2 ProgressiveSwords). The first ProgressiveSword at "Sahasrahla's Hut - Middle" had `advancement: false` in the rules.json, causing it to be skipped.

**Root Cause**:
In `frontend/modules/stateManager/core/locationChecking.js`, line 139 had:
```javascript
const shouldAddItem = !sm.spoilerTestMode || location.item.advancement !== false;
```

This filtered out items with `advancement === false` when in spoiler test mode. But Python's sphere logger (when `extend_sphere_log_to_all_locations=True`) collects ALL items including non-advancement ones.

**Solution**:
Removed the advancement filter so ALL items are added to inventory when checking locations, matching Python's behavior in full spoilers mode.

**Files Changed**:
- `frontend/modules/stateManager/core/locationChecking.js` - Removed advancement filter

**Code Change**:
```javascript
// Before:
const shouldAddItem = !sm.spoilerTestMode || location.item.advancement !== false;
if (shouldAddItem) {
  sm._addItemToInventory(location.item.name, 1);
  ...
}

// After:
// Always add items to inventory when checking locations
sm._addItemToInventory(location.item.name, 1);
```

**Test Result**:
After this fix, the SMZ3 spoiler test passes all 315 sphere events with no mismatches.
