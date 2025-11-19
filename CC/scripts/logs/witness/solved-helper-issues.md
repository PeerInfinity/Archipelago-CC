# Solved Helper Issues for The Witness

## Issue 1: can_reach_region using wrong snapshot property (SOLVED)

**Status**: Solved
**Priority**: High
**Category**: Helper

**Description**:
The `can_reach_region` helper function in `witnessLogic.js` was trying to access `snapshot.reachableRegions` (a Set), but the snapshot only provides `regionReachability` (an object mapping region names to 'reachable'/'unreachable'). This caused the helper to always return false.

**Affected Locations**:
- All locations using can_reach_region helper (Desert, Shadows laser activations)

**Root Cause**:
Mismatch between snapshot structure and helper expectations. The StateManager's getSnapshot() method creates `regionReachability` as an object, not `reachableRegions` as a Set.

**Solution**:
Updated the helper function to use `regionReachability` instead of `reachableRegions` and check if the value equals 'reachable'.

**Files Modified**:
- `frontend/modules/shared/gameLogic/witness/witnessLogic.js:14-24`

**Code Change**:
```javascript
// Before:
const reachableRegions = snapshot?.reachableRegions;
return reachableRegions.has(regionName);

// After:
const regionReachability = snapshot?.regionReachability;
return regionReachability[regionName] === 'reachable';
```
