# Kingdom Hearts 1 - Remaining Helper Issues

This file tracks outstanding issues with the Kingdom Hearts 1 helper functions (frontend/modules/shared/gameLogic/kh1/kh1Logic.js).

Last updated: 2025-11-13

## Issues

### Issue #3: High locations accessible too early

**Status:** Identified
**Priority:** Medium
**File:** frontend/modules/shared/gameLogic/kh1/kh1Logic.js or rules.json

**Description:**
At Sphere 4.6, 4 high locations become accessible in the JavaScript frontend but not in the Python backend:
- Agrabah Cave of Wonders Entrance Tall Tower Chest
- Agrabah Main Street High Above Palace Gates Entrance Chest
- Agrabah Palace Gates High Close to Palace Chest
- Halloween Town Guillotine Square High Tower Chest

**Root Cause:**
Unknown - possibly related to High Jump requirements or other movement abilities

**Investigation Needed:**
1. Check access rules for these locations in rules.json
2. Verify High Jump, Progressive Glide, or other movement ability requirements
3. Compare with Python implementation in worlds/kh1/Rules.py
4. Check if advanced_logic is being used correctly

**Affected Locations:**
4 high chest locations in Agrabah and Halloween Town

**Impact:**
Test fails at Sphere 4.6 with 4 extra accessible locations
