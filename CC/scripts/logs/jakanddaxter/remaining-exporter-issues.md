# Remaining Exporter Issues for Jak and Daxter

## Issue: Frontend Not Accumulating Reachable Orbs Correctly

**Status:** Partial fix - Exporter fixed, frontend issue remains
**Priority:** High
**Sphere where it fails:** 3.15 (step 120)

**Description:**
The "Reachable Orbs" progressive item was not being updated in the sphere log when new orb-containing regions became accessible. This has been fixed in the exporter, but a frontend accumulation issue remains.

**Fix Applied:**
Modified `exporter/sphere_logger.py` to call `recalculate_reachable_orbs()` before logging each sphere for Jak and Daxter worlds. This ensures that "Reachable Orbs" values are recalculated whenever new orb-containing regions become accessible.

The fix checks if "Reachable Orbs Fresh" is False (indicating a recalculation is needed) and calls the recalculation function before reading the state for logging.

**Verification:**
The sphere log now correctly shows "Reachable Orbs" updates at all appropriate spheres:
- Sphere 0: 332 orbs
- Sphere 0.18: +150 orbs (cumulative: 482)
- Sphere 0.39: +493 orbs (cumulative: 975)
- Sphere 1.5: +184 orbs (cumulative: 1159)
- Sphere 1.43: +12 orbs (cumulative: 1171)
- Sphere 2.9: +288 orbs (cumulative: 1459)
- Sphere 3.15: +177 orbs (cumulative: 1636) ← This is enough for 1530 requirement!

**Remaining Issue:**
The frontend helper function `can_reach_orbs` is now correctly implemented and being called, but the spoiler test still fails at sphere 3.15. The helper should see 1636 orbs (which is enough for the 1530 requirement), but the test indicates the access rules are evaluating to false.

This suggests an issue with how the frontend state manager accumulates the "Reachable Orbs" deltas from the sphere log. The sphere log correctly shows the deltas in `resolved_items`, but the frontend may not be properly summing them into the cumulative `snapshot.inventory['Reachable Orbs']`.

**Affected Locations (at sphere 3.15):**
- RV: Bring 120 Orbs To The Oracle (1) - requires 1740 orbs
- RV: Bring 120 Orbs To The Oracle (2) - requires 1860 orbs
- RV: Bring 90 Orbs To The Gambler - requires 1530 orbs
- RV: Bring 90 Orbs To The Geologist - requires 1620 orbs
- RV: Bring 90 Orbs To The Warrior - requires 1440 orbs
- SV: Bring 120 Orbs To The Oracle (1) - requires 1740 orbs
- SV: Bring 120 Orbs To The Oracle (2) - requires 1860 orbs
- SV: Bring 90 Orbs To The Mayor - requires 1530 orbs
- SV: Bring 90 Orbs to Your Uncle - requires 1350 orbs
- VC: Bring 120 Orbs To The Oracle (1) - requires 1740 orbs
- VC: Bring 120 Orbs To The Oracle (2) - requires 1860 orbs
- VC: Bring 90 Orbs To The Miners (1) - requires 1350 orbs
- VC: Bring 90 Orbs To The Miners (2) - requires 1440 orbs
- VC: Bring 90 Orbs To The Miners (3) - requires 1530 orbs
- VC: Bring 90 Orbs To The Miners (4) - requires 1620 orbs

**Files Modified:**
- `exporter/sphere_logger.py` - Added game-specific recalculation hook
- `frontend/modules/shared/gameLogic/jak_and_daxter__the_precursor_legacy/jak_and_daxter__the_precursor_legacyLogic.js` - Implemented helper functions
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js` - Registered Jak and Daxter game logic

**Next Steps:**
- Investigate the frontend state manager to understand how it accumulates `resolved_items` from the sphere log
- Check if there's special handling needed for progressive items like "Reachable Orbs"
- Consider adding debug logging to the helper function to see what value it's actually receiving
- The frontend accumulation logic may need to be fixed to properly handle dynamically-calculated progressive items
