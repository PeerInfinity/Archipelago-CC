# Solved Exporter Issues for Lingo

This document tracks resolved issues with the Lingo exporter (exporter/games/lingo.py).

## Solved Issues

### Issue 1: LEVEL 2 location had incorrect access rule (state_method instead of helper)

**Status:** ✅ SOLVED
**Solution Date:** 2025-11-19
**Sphere:** 1.3
**Location:** Second Room - LEVEL 2

**Problem:**
The location "Second Room - LEVEL 2" had an access_rule that incorrectly used:
```json
{
  "type": "state_method",
  "method": "update_reachable_regions",
  "args": []
}
```

**Root Cause:**
The AST analyzer was recursively analyzing the `lingo_can_use_level_2_location` helper function and inlining its implementation, including an internal call to `state.update_reachable_regions()`. This method call was being incorrectly exported as the access rule itself.

**Solution:**
Added `should_preserve_as_helper()` method to `LingoGameExportHandler` that prevents the analyzer from inlining Lingo-specific helper functions. The list includes:
- `lingo_can_use_entrance`
- `lingo_can_do_pilgrimage`
- `lingo_can_use_mastery_location`
- `lingo_can_use_level_2_location`
- `_lingo_can_satisfy_requirements`
- `_lingo_can_open_door`

Note: `lingo_can_use_location` is intentionally NOT preserved as a helper - it's allowed to be inlined to `_lingo_can_satisfy_requirements` for cleaner rules.

**Files Changed:**
- `exporter/games/lingo.py`: Added `should_preserve_as_helper()` method
- `exporter/games/lingo.py`: Added export of `counting_panel_reqs` and `level_2_requirement` settings
- `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`: Implemented `lingo_can_use_level_2_location` helper function

**Test Result:**
The spoiler test now passes Spheres 0, 1, 2, 3, and 3.1 (previously failed at Sphere 1.3). There's now a different issue at Sphere 3.2 with region reachability, but the LEVEL 2 location access rule issue is resolved.
