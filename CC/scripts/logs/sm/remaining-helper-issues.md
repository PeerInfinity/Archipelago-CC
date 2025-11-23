# Remaining Helper Issues for Super Metroid

## Issue 1: Regions requiring Super Missile not accessible at Sphere 3.1

**Status**: In progress
**Priority**: High
**Category**: Helper logic

### Problem
When the player collects a Super Missile at Sphere 3.1, regions that require passing through green doors (which need Super Missiles) are not becoming accessible.

Expected at Sphere 3.1 (per sphere log):
- Big Pink, Business Center, Charge Beam, East Tunnel Right, etc. (39 regions total)

Actual: These regions remain inaccessible

### Root Cause Analysis - EXTENSIVE INVESTIGATION COMPLETE

**VERIFIED SYSTEMS**:
1. ✓ **SMBool unwrapping**: Added in `ruleEvaluator.js:114-120`
2. ✓ **Helper functions**: All working correctly, `haveItem('Super')` finds 'Super Missile' by type
3. ✓ **Inventory UI**: Items DO appear in Inventory panel during tests (user confirmed)
4. ✓ **Inventory update flow**: `checkLocation()` → `_addItemToInventory()` → `invalidateCache()` → `_sendSnapshotUpdate()` → `getSnapshot()` → `computeReachableRegions()`

**THE MYSTERY**: Inventory count shows 0 in helpers but items appear in UI panel!

### How Inventory/Reachability Systems Work

**Inventory Panel** (WORKING):
- Uses `stateManager.getLatestStateSnapshot()` returning cached `uiCache`
- Cache updates when worker posts `stateSnapshot` messages
- **Confirmed: Items appear correctly in UI during tests**

**Spoiler Test Without `add_sphere_items_upfront`** (SM's mode):
- Super Metroid has `add_sphere_items_upfront: None` (defaults to False)
- Items obtained by checking locations sequentially
- Each `checkLocation()` invalidates cache and should trigger recomputation
- Test calls `pingWorker()` then `getFullSnapshot()` after all locations checked
- `getFullSnapshot()` should call `getSnapshot()` which recomputes if cache invalid

**The `getSnapshot()` Guard**:
```javascript
if (!sm.cacheValid && !sm._inHelperExecution) {
  sm.computeReachableRegions();
}
```
If `_inHelperExecution` is true, reachability won't recompute even if cache is invalid!

### Evidence of Timing/State Issue
Browser logs show inconsistent inventory state:
```
[haveItem] Super Missile count: 0  ← During reachability check
...later...
[haveItem] Morph Ball: true  ← After test completes
```

### Investigation Needed
1. Is `_inHelperExecution` true during the comparison's reachability check?
2. Is there a race condition between cache invalidation and snapshot retrieval?
3. Does the comparison use a stale snapshot captured before recomputation?
4. Should `add_sphere_items_upfront` be enabled for SM (like it is for Blasphemous)?
