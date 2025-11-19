# SMZ3 - Solved Helper Issues

This file tracks resolved issues with the SMZ3 helper functions (`frontend/modules/shared/gameLogic/smz3/smz3Logic.js`).

## Solved Issues

### Issue #1: Missing smz3_CanExit Helper Function - SOLVED

**Fix**: Implemented `smz3_CanExit` function based on the Python source from TotalSMZ3/Regions/SuperMetroid/NorfairLower/East.py.

**Implementation**:
```javascript
export function smz3_CanExit(snapshot, staticData) {
  // Normal mode logic for exiting Norfair Lower East
  const hasMorph = hasItem(snapshot, 'Morph');
  const hasCardNorfairL2 = hasItem(snapshot, 'CardNorfairL2');

  // Bubble Mountain route (simple exit with card)
  if (hasMorph && hasCardNorfairL2) {
    return true;
  }

  // Alternative route: Volcano Room and Blue Gate
  const hasGravity = hasItem(snapshot, 'Gravity');
  const hasWave = hasItem(snapshot, 'Wave');
  const hasGrapple = hasItem(snapshot, 'Grapple');
  const hasSpaceJump = hasItem(snapshot, 'SpaceJump');

  // Morph + Gravity + Wave + (Grapple OR SpaceJump)
  return hasMorph &&
         hasGravity &&
         hasWave &&
         (hasGrapple || hasSpaceJump);
}
```

**Result**: Locations in Norfair Lower East that use the CanExit helper should now be properly evaluated. Using Normal logic (simplified) for now.
