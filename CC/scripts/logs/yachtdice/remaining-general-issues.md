# Remaining General Issues for Yacht Dice

## Issue 1: Test framework inventory not reflecting checked locations

**Status:** Under Active Investigation

**Problem:** The spoiler test fails at sphere 0.2 because locations that should be accessible are not showing as accessible in the JavaScript state.

**Expected Behavior:**
- Sphere 0: Start with 1 Dice, 1 Roll
- Sphere 0.1: Check "1 score", get Category Threes
- Sphere 0.2: Check "2 score", get second Dice → total 2 Dice
- With 2 Dice, locations "8 score", "9 score", "10 score" should become accessible

**Actual Behavior:**
- Helper function always sees inventory with only 1 Dice
- Helper calculates score=5 (correct for 1 Dice)
- Locations requiring score >= 8 are not accessible (correct for 1 Dice, wrong for 2 Dice)

**Evidence:**
- "2 score" location contains a Dice item (verified in rules.json)
- Event processor should check "2 score" before comparing accessible locations
- Helper logs show: `Dice=1` every time, never `Dice=2`

**Hypothesis:**
One of the following is occurring:
1. The "2 score" location is not being checked despite being in sphere_locations
2. Checking "2 score" doesn't add the Dice to inventory (checkLocation bug)
3. The Dice is added but snapshot doesn't reflect it (snapshot invalidation issue)
4. Helper is using a cached/stale snapshot that doesn't include the new Dice

**Files Involved:**
- `frontend/modules/testSpoilers/eventProcessor.js` - Processes sphere events
- `frontend/modules/stateManager/core/statePersistence.js` - Creates snapshots
- `frontend/modules/stateManager/core/inventoryManager.js` - Manages inventory
- `frontend/modules/shared/gameLogic/yachtdice/helpers.js` - Calculates scores

**Next Investigation Steps:**
1. Add logging to verify "2 score" is actually being checked
2. Add logging to verify Dice is added to inventory after checking "2 score"
3. Add logging to show inventory immediately before and after getFullSnapshot()
4. Check if there's caching or staleness in the snapshot mechanism
5. Verify that checkLocation properly adds items to inventory

