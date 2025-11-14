# Remaining Helper Issues for Blasphemous

## Issue 1: Boss name arguments lost during analysis
**Status:** Partially understood, needs deeper fix
**Test Result:** Failed at Sphere 3.2
**Affected Locations:**
- MaH: Sierpes (should require sierpes boss strength 0.70, currently checking easiest boss -0.10)
- MaH: Sierpes' eye
- Potentially other boss locations

**Error:** "Locations accessible in STATE (and unchecked) but NOT in LOG"
**Root Cause:** When the analyzer encounters `self.has_boss_strength(state, "sierpes")` in the Python code, it's converting it to an item_check for "Boss Strength", losing the boss name argument. The postprocess fix converts it back to a helper call, but without the boss name, so the JavaScript checks the easiest boss instead of the specific boss.

**Current Fix Applied:** Converting "Boss Strength" item checks to `has_boss_strength` helper calls (no argument)
**Issue with Current Fix:** Without the boss name argument, all boss checks default to checking the easiest boss (warden, threshold -0.10) instead of the specific boss (sierpes needs 0.70)

**Possible Solutions:**
1. Fix the analyzer to properly recognize `has_boss_strength` as a helper call and preserve arguments
2. Use location/region context in postprocess to infer which boss name should be used
3. Modify the JavaScript helper to infer the boss from accessible regions
4. Override rule analysis for boss check methods to directly return correct helper calls with boss names

**Priority:** High (causes test failure at sphere 3.2)
