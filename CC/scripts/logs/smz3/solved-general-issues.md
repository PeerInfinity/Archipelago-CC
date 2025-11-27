# SMZ3 Solved General Issues

This document tracks resolved general issues with SMZ3.

## Resolved Issues

### Issue 1: Starting Items Not Applied During Spoiler Test

**Date Resolved:** 2025-11-27

**Problem:**
When running spoiler tests, the test would fail at locations requiring "Card" items (like CardNorfairL2) because starting items (precollected items) were not being added to the inventory. In SMZ3 with non-Keysanity mode, all keycard items are precollected (starting items), but after the spoiler test cleared the state at sphere 0, these items were never re-added.

**Symptoms:**
- Spoiler test failed at sphere 7.4 with "PRE-CHECK FAILED" for "Missile (Speed Booster)"
- CardNorfairL2 and other Card items showed as 0 in inventory despite being in starting_items
- Locations requiring Card items were inaccessible during test

**Root Cause:**
1. The `EventProcessor.processSingleEvent()` calls `stateManager.clearStateAndReset()` at sphere 0 to ensure a clean start
2. This cleared ALL inventory items, including starting items
3. Starting items are not included in the sphere log (they're precollected, not acquired during play)
4. The starting items were never re-added after clearing state

**Solution:**
Two changes were made:

1. **Added starting_items to static game data** (`statePersistence.js:691`):
   - Added `starting_items: sm.rules?.starting_items` to `getStaticGameData()` return object
   - This makes starting items accessible through `stateManager.getStaticData()`

2. **Re-add starting items after state clear** (`eventProcessor.js:231-245`):
   - After clearing state at sphere 0, the code now retrieves starting items from static data
   - Starting items are added to inventory one by one using `stateManager.addItemToInventory()`
   - A ping is sent to wait for state to stabilize

**Files Changed:**
- `frontend/modules/stateManager/core/statePersistence.js`
- `frontend/modules/testSpoilers/eventProcessor.js`

**Impact:**
This fix affects all games that use starting items (precollected items), not just SMZ3. Any game that has precollected items should now work correctly in spoiler tests.

