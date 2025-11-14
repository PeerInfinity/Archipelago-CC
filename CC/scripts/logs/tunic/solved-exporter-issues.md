# TUNIC - Solved Exporter Issues

This file tracks exporter issues that have been fixed.

## Fixed Issues

### Issue 1: Missing ability_unlocks data export (PARTIALLY FIXED)

**Status:** Partially Fixed - subscripts resolved, but test still failing
**Date Fixed:** 2025-11-14
**Files Changed:**
- Created `exporter/games/tunic.py`

**Solution Implemented:**
Created a custom TUNIC exporter that:
1. Loads `ability_unlocks` from the TunicWorld instance in `preprocess_world_data()` method
2. Resolves subscript references to `ability_unlocks` during rule expansion
3. Replaces subscript nodes with constant values (e.g., `ability_unlocks["Pages 42-43 (Holy Cross)"]` becomes `1`)
4. Exports the `ability_unlocks` dictionary in settings for reference

**Verification:**
- Rules.json now contains resolved constants instead of subscript references
- Example: `"count": {"type": "constant", "value": 1}` instead of `"count": {"type": "subscript", ...}`
- ability_unlocks is exported in settings: `{"Pages 42-43 (Holy Cross)": 1, "Pages 52-53 (Icebolt)": 1, "Pages 24-25 (Prayer)": 1}`

**Remaining Issue:**
- Test still fails at Sphere 0.14 with "Region Overworld Holy Cross is not reachable"
- The access rule structure appears correct but may not be evaluating properly in the frontend
- Need to investigate frontend rule engine's handling of nested conditionals
