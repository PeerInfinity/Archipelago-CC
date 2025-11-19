# Solved Super Metroid Exporter Issues

## Fixed: Location Access Rules No Longer Export as Constant True

**Severity:** High
**Status:** Fixed
**Date:** 2025-11-19

### Problem
Multiple locations were being exported with `access_rule = {"type": "constant", "value": true}`, making them accessible from the start when they should require specific items.

### Root Cause
The exporter was simplifying `evalSMBool(SMBool(True), ...)` to constant True. While this is mathematically correct (SMBool(True) with difficulty 0 always passes), it was inappropriate for locations with accessFrom restrictions because:
1. The accessFrom comprehension couldn't be exported due to recursion limits
2. Skipping accessFrom and simplifying to constant True lost all requirements
3. Locations became accessible even when their regions weren't accessible

### Solution
Modified `exporter/games/sm.py`:
1. Disabled the simplification of `evalSMBool(SMBool(True), ...)` to constant True
2. Now exports the full evalSMBool structure: `evalSMBool(SMBool(true), state.smbm[1].maxDiff)`
3. Relies on region access rules to provide the necessary restrictions
4. Preserves rule structure for proper frontend evaluation

### Changes Made
- Added `_is_always_true_smbool()` method to detect SMBool(True) patterns
- Modified AND rule handling to preserve evalSMBool structure instead of simplifying
- Removed simplification logic from helper and function_call handling

### Impact
- Locations with accessFrom + SMBool(True) now export properly
- Region connectivity provides the restriction (as intended)
- No more incorrectly accessible locations due to constant True rules

### Related Files
- `exporter/games/sm.py` (lines 106-137, 234-260, 274-302)
