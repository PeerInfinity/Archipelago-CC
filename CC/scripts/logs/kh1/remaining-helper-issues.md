# Kingdom Hearts 1 - Remaining Helper Issues

This file tracks outstanding issues with the Kingdom Hearts 1 helper functions (frontend/modules/shared/gameLogic/kh1/kh1Logic.js).

Last updated: 2025-11-13

## Issues

### Issue #2: Missing can_dumbo_skip helper function

**Status:** Identified
**Priority:** High
**File:** frontend/modules/shared/gameLogic/kh1/kh1Logic.js

**Description:**
At Sphere 6.1, the test reports: `Helper function "can_dumbo_skip" NOT FOUND in snapshotInterface`

This causes 14 locations to be accessible too early:
- Traverse Town 1st District Blue Trinity Balcony Chest
- Traverse Town Geppetto's House Chest
- Traverse Town Geppetto's House Geppetto Reward 1-5
- Traverse Town Geppetto's House Postcard
- Traverse Town Geppetto's House Talk to Pinocchio
- Agrabah Palace Gates High Close to Palace Chest
- Monstro Defeat Parasite Cage II Stop Event
- Halloween Town Guillotine Square High Tower Chest
- Halloween Town Guillotine Square Pumpkin Structure Left/Right Chest

**Root Cause:**
The `can_dumbo_skip` helper function is referenced in rules but not implemented in kh1Logic.js

**Investigation Needed:**
1. Find the Python implementation of can_dumbo_skip in worlds/kh1/Rules.py
2. Implement the JavaScript equivalent in kh1Logic.js
3. Verify the logic matches the Python implementation

**Affected Locations:**
14 locations across multiple worlds

**Impact:**
Test fails at Sphere 6.1 with 14 extra accessible locations
