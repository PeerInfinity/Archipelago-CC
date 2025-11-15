# MLSS Solved General Issues

## Issue 1: Shop Chuckolator Flag region not reachable at sphere 3.10

**Status:** SOLVED
**Type:** Helper Function Bug
**Sphere:** 3.10
**File:** `frontend/modules/shared/gameLogic/mlss/mlssLogic.js`

**Test Output (Before Fix):**
```
REGION MISMATCH found for: {"type":"state_update","sphere_number":"3.10","player_id":"1"}
> Regions accessible in LOG but NOT in STATE: Shop Chuckolator Flag
```

**Description:**
At sphere 3.10, when the player obtains Thunderhand, the Python backend determines that both "Shop Mom Piranha Flag" and "Shop Chuckolator Flag" become accessible. However, the JavaScript frontend only marks "Shop Mom Piranha Flag" as accessible.

**Root Cause:**
The `can_reach()` helper function was checking for `regionReachability[regionName] === true`, but the StateManager actually sets region reachability to the string `'reachable'`, not the boolean `true`.

In `frontend/modules/stateManager/core/statePersistence.js`:
```javascript
if (sm.knownReachableRegions.has(regionName)) {
  regionReachability[regionName] = 'reachable';  // String value
}
```

But in `frontend/modules/shared/gameLogic/mlss/mlssLogic.js`:
```javascript
export function can_reach(snapshot, staticData, regionName) {
  if (!snapshot.regionReachability) return false;
  return snapshot.regionReachability[regionName] === true;  // Wrong!
}
```

This caused the `piranha_shop()`, `fungitown_shop()`, etc. helper functions to always return `false`, breaking the indirect region dependencies.

**Fix:**
Changed the comparison in `can_reach()` from `=== true` to `=== 'reachable'`:

```javascript
export function can_reach(snapshot, staticData, regionName) {
  if (!snapshot.regionReachability) return false;
  return snapshot.regionReachability[regionName] === 'reachable';
}
```

**Result:**
All 39 sphere updates now pass successfully. The region reachability logic now correctly handles indirect dependencies through the shop helper functions.

**Location:** `frontend/modules/shared/gameLogic/mlss/mlssLogic.js:71-74`
