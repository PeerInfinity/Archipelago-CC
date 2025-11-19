# Solved General Issues for Stardew Valley

This document tracks general issues that have been fixed.

## Issue 1: Starting items not being added to inventory

**Status:** FIXED
**Priority:** Critical

### Problem
Starting items were not being added to the inventory during initialization, causing all locations and regions that require starting items to be unreachable.

### Root Cause
The initialization code in `frontend/modules/stateManager/core/initialization.js` was incorrectly attempting to look up items by ID when `itemData` is indexed by name in the rules.json.

Code before fix (lines 486-496):
```javascript
const itemId = sm.itemNameToId?.[itemName];
if (itemId !== undefined && sm.itemData?.[itemId]) {
  sm.addItemToInventory(itemName);
} else {
  sm.logger.warn(`Starting item '${itemName}' not found`);
}
```

The code was trying to:
1. Get the item ID from the item name
2. Use that ID to look up the item in itemData

But itemData is indexed by NAME, not ID, so this lookup always failed.

### Fix
Changed the code to directly check if the item exists by name:

```javascript
if (sm.itemData?.[itemName]) {
  sm.addItemToInventory(itemName);
} else {
  sm.logger.warn(`Starting item '${itemName}' not found in itemData`);
}
```

### Impact
- Sphere 0 now passes completely
- Test progressed from failing immediately to processing 37 events before encountering a different issue
- All starting-item-dependent regions (Egg Festival, Flower Dance, Spring Farming) are now accessible

## Issue 2: region_check recursion vulnerability

**Status:** FIXED
**Priority:** High

### Problem
The `isRegionReachable` function could trigger infinite recursion when location access rules contained `region_check` conditions that were evaluated during region computation.

### Root Cause
The `isRegionReachable` function was calling `computeReachableRegions` without checking if a computation was already in progress:

```javascript
export function isRegionReachable(sm, regionName) {
  const reachableRegions = computeReachableRegions(sm);
  return reachableRegions.has(regionName);
}
```

When a location's access rule contained a `region_check`, and this was evaluated during `computeReachableRegions`, it would trigger another call to `computeReachableRegions`, causing recursion.

### Fix
Added recursion protection (similar to what `isLocationAccessible` already had):

```javascript
export function isRegionReachable(sm, regionName) {
  // Recursion protection: if we're already computing reachable regions,
  // use the current state instead of triggering another computation
  const reachableRegions = sm._computing
    ? sm.knownReachableRegions
    : computeReachableRegions(sm);
  return reachableRegions.has(regionName);
}
```

### Impact
- Prevents potential infinite recursion when evaluating complex access rules
- Allows region_check conditions to work correctly during region computation
- Uses the in-progress reachability state when already computing to avoid stale data
