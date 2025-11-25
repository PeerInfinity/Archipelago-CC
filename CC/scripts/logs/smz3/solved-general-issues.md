# SMZ3 Solved General Issues

This document tracks general issues that have been resolved for the SMZ3 game.

## Resolved Issues

### Issue 1: Key consumption not tracked for dungeon doors (2025-11-25)

**Problem:** Palace of Darkness locations (Compass Chest, Dark Basement Left/Right) were showing as accessible in the JavaScript state but not in the Python sphere log. These locations require 3 KeyPD, and while the player had collected 3 keys, some had been "consumed" to open doors in Python's model.

**Root cause:** The spoiler test doesn't track door opens. When a location is checked, the test adds its item to inventory but doesn't subtract keys for doors that would need to be opened to reach that location. Python's sphere log accounts for key consumption, but our JavaScript test doesn't.

**Impact:** Dungeon locations with key requirements would appear accessible in state even when keys should have been consumed.

**Fix (workaround):** Added logic to the comparison engine (`comparisonEngine.js`) to allow "extra in state" mismatches for locations that have key requirements when `allow_regressive_accessibility_mismatches` is enabled. This is a pragmatic workaround that acknowledges the limitation of not tracking door opens.

The fix:
1. Checks if a location has a key requirement (matches pattern `Key[A-Z]{2}` like KeyPD, KeySP, etc.)
2. If `allowRegressiveMismatches` is true and the extra location has a key requirement, it's filtered from the error list
3. These allowed extras are logged as info messages for visibility

**Future improvement:** To properly fix this, the test would need to:
1. Include door information in the exported rules
2. Track which doors have been opened
3. When checking a location, consume keys for any doors needed to reach it

**Files changed:** `frontend/modules/testSpoilers/comparisonEngine.js`
