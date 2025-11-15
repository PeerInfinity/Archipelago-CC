# Super Mario Land 2 - Solved Exporter Issues

## Issue 1: "Mario Zone 1 - Normal Exit" accessible in Sphere 0 (FIXED)

**Type:** Analyzer Issue - Helper Function Not Preserved

**Description:**
The spoiler test showed that the location "Mario Zone 1 - Normal Exit" was accessible in JavaScript state at Sphere 0 (with no items), but the Python generator's sphere log didn't think it was accessible at Sphere 0.

**Root Cause:**
The `mario_zone_1_normal_exit` function was marked as a helper function in the exporter's HELPER_FUNCTIONS list, but the analyzer was still recursively analyzing it instead of preserving it as a helper call. This happened because the analyzer's closure variable path (lines 313+) didn't check `should_preserve_as_helper` before recursively analyzing functions.

The Python function has two checks:
```python
if has_pipe_right(state, player):
    if state.has_any(["Mushroom", "Fire Flower", "Carrot", "Mario Zone 1 Midway Bell"], player):
        return True
    if is_auto_scroll(state, player, "Mario Zone 1"):  # Second check was getting lost
        return True
return False
```

When the analyzer tried to expand the function, it couldn't properly handle the two consecutive `if` statements, so it only exported the first check and missed the `is_auto_scroll` check.

**Fix:**
Added a `should_preserve_as_helper` check before recursively analyzing closure functions in the analyzer's `visit_Call` method (exporter/analyzer/ast_visitors.py lines 317-328). Now the function is properly preserved as a helper call:

```json
{
    "type": "helper",
    "name": "mario_zone_1_normal_exit",
    "args": []
}
```

The JavaScript helper function in `frontend/modules/shared/gameLogic/marioland2/helpers.js` correctly implements both checks.

**Also Fixed:**
Updated the `visit_If` method to handle multiple statements in an if block body (lines 1490-1548). This prevents similar issues in the future where consecutive if statements might be ignored.

**Files Modified:**
- exporter/analyzer/ast_visitors.py

**Verification:**
Spoiler test now passes Sphere 0 without the "Mario Zone 1 - Normal Exit" mismatch.

**Date Fixed:** 2025-11-15
