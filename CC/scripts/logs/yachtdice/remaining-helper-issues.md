# Remaining Helper Issues for Yacht Dice

## Issue 1: Inventory state not updating correctly during test

**Status:** Under Investigation - Appears to be test framework issue

**Error:** Locations "10 score", "8 score", "9 score" are accessible in LOG (sphere 0.2) but NOT in STATE

**Root Cause Analysis:**
- The helper function `dice_simulation_state_change` IS being called correctly
- The yacht_weights data IS loading successfully (fixed async loading issue)
- The helper IS calculating scores correctly based on the inventory it receives
- **PROBLEM**: The helper always sees only 1 Dice in inventory, even at sphere 0.2 when there should be 2

**Evidence from logs:**
```Browser logs show:
- Sphere 0: Dice=1 (correct - starting item)
- Sphere 0.2: Should have Dice=2 (1 starting + 1 added), but helper still sees Dice=1
- Helper calculates: numDice=1, numRolls=1, score=5 (correct for 1 Dice)
- Locations require score >= 8, which needs 2 Dice
```

**Actual Issue:**
The test framework appears to be checking location accessibility BEFORE applying the inventory update from sphere 0.2, or the snapshot is stale/cached. This is NOT a helper function issue - the helper is working correctly with the inventory it receives.

**Next Steps:**
1. Investigate test framework's sphere update mechanism
2. Check how inventory is updated between spheres
3. Verify snapshot invalidation/refresh logic
4. Possible issue in `testSpoilers.js` or state manager's sphere progression

