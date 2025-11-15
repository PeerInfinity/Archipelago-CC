# The Legend of Zelda - Solved Exporter Issues

This file tracks resolved issues with the TLoZ exporter (`exporter/games/tloz.py`).

## Resolved Issues

### Issue 1: Boss Status locations incorrectly simplify can_reach rules

**Status:** ✅ FIXED

**Symptom:** Test initially failed at Sphere 3.5 with "Level 5 Boss Status" accessible in STATE but not in LOG.

**Root Cause:** The exporter was incorrectly simplifying `can_reach(boss_location, "Location")` to `True`, removing the dependency on being able to reach the boss location.

**Details:**
- Boss Status locations have a rule: `lambda state, b=boss: state.can_reach(b, "Location", player)`
- This rule checks if the player can reach the boss location before the boss event can be triggered
- The original exporter was simplifying this to just `True`, removing the dependency
- For example, "Level 5 Boss Status" requires being able to reach "Level 5 Boss", which needs the Recorder
- After incorrect simplification, "Level 5 Boss Status" was missing the Recorder requirement
- The sphere log showed "Level 5 Boss Status" should be accessible at Sphere 6.2, but frontend thought it was accessible at Sphere 3.5

**Fix Applied:**
1. Removed the incorrect simplification that converted `can_reach(boss_location, "Location")` to `True`
2. Added `set_context(location_name)` method to track the current location being processed
3. Added logic to resolve the unresolved variable `b` to the actual boss location name
4. For "Level X Boss Status" locations, the code now resolves the boss location to "Level X Boss" by removing " Status" from the location name
5. The can_reach now correctly has the resolved boss location name as a constant

**Result:** Spoiler test now passes all 52 events (spheres) successfully!

**Files Modified:**
- `exporter/games/tloz.py`: Lines 19-22 (added set_context), Lines 40-62 (updated can_reach handling)
