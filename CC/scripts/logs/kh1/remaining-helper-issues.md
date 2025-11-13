# Kingdom Hearts 1 - Remaining Helper Issues

This file tracks outstanding issues with the Kingdom Hearts 1 helper functions (frontend/modules/shared/gameLogic/kh1/kh1Logic.js).

Last updated: 2025-11-13

## Issues

### Issue #1: Halloween Town locations accessible too early

**Status:** Identified
**Priority:** High
**File:** frontend/modules/shared/gameLogic/kh1/kh1Logic.js

**Description:**
At Sphere 1.4, Halloween Town Oogie's Manor locations become accessible in the JavaScript frontend but not in the Python backend's sphere log. This includes:
- Halloween Town Cemetery Behind Grave Chest
- Halloween Town Cemetery Between Graves Chest
- Halloween Town Cemetery By Cat Shape Chest
- Halloween Town Cemetery By Striped Grave Chest
- Halloween Town Defeat Oogie Boogie Holy Circlet Event
- Halloween Town Defeat Oogie's Manor Gravity Event
- Halloween Town Oogie's Manor Hollow Chest
- Halloween Town Oogie's Manor Lower Iron Cage Chest
- Halloween Town Oogie's Manor Upper Iron Cage Chest
- Halloween Town Seal Keyhole Pumpkinhead Event

**Root Cause:**
The `has_oogie_manor` helper function (kh1Logic.js:324-336) may be too permissive or not matching the Python implementation in worlds/kh1/Rules.py.

**Investigation Needed:**
1. Compare Python implementation of Oogie's Manor access logic in worlds/kh1/Rules.py
2. Verify the `has_oogie_manor` helper function logic
3. Check if advanced_logic parameter is being passed correctly
4. Verify Progressive Fire, High Jump, and Glide requirements

**Affected Locations:**
10 locations in Halloween Town (Cemetery and Oogie's Manor)

**Impact:**
Test fails at Sphere 1.4 with 10 extra accessible locations
