# Remaining Exporter Issues for Lingo

This document tracks outstanding issues with the Lingo exporter (exporter/games/lingo.py).

## Issues

### Issue 1: LEVEL 2 location has incorrect access rule (state_method instead of helper)

**Status:** Identified
**Sphere:** 1.3
**Location:** Second Room - LEVEL 2
**Error:** Access rule evaluation failed

**Problem:**
The location "Second Room - LEVEL 2" has an access_rule that incorrectly uses:
```json
{
  "type": "state_method",
  "method": "update_reachable_regions",
  "args": []
}
```

**Expected:**
The access_rule should be a helper call to `lingo_can_use_level_2_location`:
```json
{
  "type": "helper",
  "name": "lingo_can_use_level_2_location",
  "args": []
}
```

**Root Cause:**
In `worlds/lingo/rules.py` (lines 96-98), the lambda for LEVEL 2 locations calls:
```python
lambda state: lingo_can_use_level_2_location(state, world)
```

The `lingo_can_use_level_2_location` function (lines 36-45) internally calls `state.update_reachable_regions(world.player)` on line 38. The AST analyzer is incorrectly analyzing this internal call as the access rule itself, instead of recognizing that the entire helper function should be called.

**Fix Location:**
- `exporter/analyzer.py` or `exporter/games/lingo.py` - need to ensure that lambdas that call helper functions are properly analyzed as helper calls, not as the internal implementation details of those helper functions.

**Test Command:**
```bash
npm test --mode=test-spoilers --game=lingo --seed=1
```

**Expected Test Result After Fix:**
Sphere 1.3 should pass with "Second Room - LEVEL 2" being accessible.
