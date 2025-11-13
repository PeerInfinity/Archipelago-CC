# Kingdom Hearts 1 - Remaining Helper Issues

This file tracks outstanding issues with the Kingdom Hearts 1 helper functions (frontend/modules/shared/gameLogic/kh1/kh1Logic.js).

Last updated: 2025-11-13

## Issues

### Issue #3: High locations accessible too early (PARTIALLY INVESTIGATED)

**Status:** Identified (requires further investigation)
**Priority:** Medium
**File:** Likely exporter/games/kh1.py or rules.json

**Description:**
At Sphere 4.6, 4 high locations become accessible in the JavaScript frontend but not in the Python backend:
- Agrabah Cave of Wonders Entrance Tall Tower Chest
- Agrabah Main Street High Above Palace Gates Entrance Chest
- Agrabah Palace Gates High Close to Palace Chest
- Halloween Town Guillotine Square High Tower Chest

**Investigation So Far:**
Access rules contain patterns like:
```json
OR(
  has_all(["High Jump", "Progressive Glide"]),
  AND(0, OR(Combo Master, can_dumbo_skip)),  // advanced_logic = 0
  High Jump >= 3
)
```

At Sphere 4.6, player has NO High Jump or Glide, so none of these conditions should be true. Yet JavaScript evaluates them as accessible.

**Root Cause Hypothesis:**
1. Could be issue with how constant `0` in AND conditions is being handled
2. Attempted fix to rule evaluator AND/OR logic caused regression (End of the World became unreachable)
3. Original rule evaluator uses strict equality (`=== false`, `=== true`) which doesn't catch numeric 0
4. But changing to falsy checks breaks other functionality

**Affected Locations:**
4 high chest locations in Agrabah and Halloween Town

**Impact:**
Test fails at Sphere 4.6 with 4 extra accessible locations

**Next Steps:**
- Investigate why AND(0, ...) is not properly short-circuiting
- Check if there's an issue with constant node evaluation
- Consider fixing in exporter by resolving these patterns earlier
