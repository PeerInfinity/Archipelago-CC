# Remaining Helper Issues - Lingo

This document tracks outstanding issues with the Lingo game helper functions (`frontend/modules/shared/gameLogic/lingo/lingoLogic.js`).

## Issues

### Issue 1: Helper causes over-accessibility after regionReachability fix (CRITICAL)

**Location:** `frontend/modules/shared/gameLogic/lingo/lingoLogic.js:101-107`

**Problem:**
The helper function `_lingo_can_satisfy_requirements` was using `snapshot.reachableRegions` which doesn't exist in the snapshot. After fixing it to use `snapshot.regionReachability` instead, the spoiler test now fails with 112 regions accessible in STATE but NOT in LOG (should be only 39 regions accessible in Sphere 0).

**Timeline:**
- **Before any fixes**: 37 regions NOT accessible (missing from LOG), 1 region incorrectly accessible (Pilgrim Antechamber)
- **After exporter fix**: 37 regions still NOT accessible, Pilgrim Antechamber no longer incorrectly accessible ✅
- **After helper fix**: 112 EXTRA regions now accessible (opposite problem)

**Root Cause (Suspected):**
The issue appears to be that when checking door requirements like:
```javascript
if (access.rooms && access.rooms.length > 0) {
  const regionReachability = snapshot?.regionReachability || {};
  for (const roomName of access.rooms) {
    if (regionReachability[roomName] !== 'reachable') {
      return false;
    }
  }
}
```

The problem might be one of:
1. **Timing issue**: When evaluating an exit from a newly reachable region (e.g., Starting Room), the region IS already in regionReachability as 'reachable', so doors that require "be in Starting Room" immediately pass. This might be correct behavior, but Python might be doing something different.
2. **Player ID issue**: The regionReachability might not be player-specific, or playerId might not be correctly extracted
3. **Default value issue**: If regionReachability is empty or undefined, the check might be passing when it shouldn't

**Next Steps for Investigation:**
1. Add console.log statements to see what regionReachability actually contains during evaluation
2. Compare with Python's `state.can_reach()` behavior to understand timing differences
3. Check if there's a difference between checking "current region" vs "other regions"
4. Review if the BFS algorithm in reachabilityEngine.js evaluates regions in the right order
5. Consider whether door requirements should check "parent region" differently than "other regions"

**Workaround Considered:**
Reverting the helper change would bring back the original problem (37 regions not accessible). Need a proper fix that allows doors in reachable rooms to work while preventing over-accessibility.
