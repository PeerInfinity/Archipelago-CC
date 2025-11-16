# Secret of Evermore - Remaining Helper Issues

## Issue 1: Logic rules not providing progress correctly

**Status:** CRITICAL - Test Failure at Sphere 4.1

**Description:**
The spoiler test fails at Sphere 4.1 with 12 locations that should be accessible but are not:
- Aquagoth
- Barrier
- Double Drain
- Oglin Cave #179
- Tiny
- Tiny's hideout #158-164 (7 gourds)

**Evidence:**
```
STATE MISMATCH found for: {"type":"state_update","sphere_number":"4.1","player_id":"1"}
Locations accessible in LOG but NOT in STATE (or checked): Aquagoth, Barrier, Double Drain, ...
ISSUE: Access rule evaluation failed (for all 12 locations)
```

**Root Cause Analysis:**

These locations became accessible in Sphere 1.2 according to the Python backend, but the JavaScript frontend never recognized them as accessible.

Example: Aquagoth requires:
1. Progress ID 1 (P_WEAPON) - provided by Knight Basher ✓
2. Progress ID 31 - provided by Logic Rule 3

Logic Rule 3:
- Requires: 1x progress 1 (P_WEAPON) + 2x progress 12
- Provides: 1x progress 31 (+ progress 23, 24)

Progress 12 is provided by Diamond Eye (collected 2 copies by Sphere 1.2).

**Timeline:**
- Sphere 0.1: Collect Knight Basher → have 1x progress 1
- Sphere 1.1: Collect Diamond Eye #1 → have 1x progress 12
- Sphere 1.2: Collect Diamond Eye #2 from Ivor Sewers #269 → have 2x progress 12
- Sphere 1.2: Rule 3 should activate → should provide progress 31
- Sphere 1.2: Aquagoth et al. should become accessible

**JavaScript Helper Analysis:**

Looking at `frontend/modules/shared/gameLogic/soe/soeLogic.js`:
- `countProgress()` function exists and handles logic rules
- Logic rules are checked with recursion protection
- Rules check requirements before adding provides

**Hypothesis:**
The issue may be one of:
1. Logic rules not being evaluated during reachability calculation
2. Progress counting not working correctly for multi-item scenarios
3. Timing issue - logic rules checked before inventory is updated
4. Diamond Eye max_count issue - may not be counting multiple copies correctly

**Testing Needed:**
1. Add debug logging to `countProgress()` for progress IDs 1, 12, and 31
2. Verify inventory has 2x Diamond Eye in sphere 1.2
3. Check if Rule 3 requirements are being evaluated
4. Verify Rule 3 provides are being added to progress count

**Priority:** CRITICAL - Test failure

---

## Issue 2: Settings-based progress not tested

**Status:** Unknown

**Description:**
The helper function has special handling for:
- P_ALLOW_OOB (progress 25) - checks settings.out_of_bounds === 2
- P_ALLOW_SEQUENCE_BREAKS (progress 26) - checks settings.sequence_breaks === 2
- P_ENERGY_CORE (progress 9) - checks if fragments mode is enabled

**Analysis:**
These settings-based checks have not been tested yet. They may work correctly, but we won't know until we test with different settings configurations.

**Priority:** Low (not blocking current test failure)

---

## Summary

**Total Helper Issues:** 1 critical (logic rules), 1 untested (settings)

**Next Steps:**
1. Debug the logic rule evaluation in countProgress()
2. Check if Diamond Eye inventory counting is correct
3. Verify Rule 3 activation conditions
4. Add comprehensive logging for progress calculation
