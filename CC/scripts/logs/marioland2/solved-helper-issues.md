# Super Mario Land 2 - Solved Helper Issues

This document tracks helper function issues that have been fixed in `frontend/modules/shared/gameLogic/marioland2/`.

## Solved Issues

### 1. `mario_zone_1_normal_exit` - Incorrect Logic (Fixed 2025-12-10)

**Problem:** The JavaScript helper function had inverted logic compared to the Python implementation.

**Python logic (correct):**
```python
has_pipe_right AND (NOT is_auto_scroll OR has_any([powerups/midway bell]))
```

**JavaScript logic (incorrect):**
```javascript
has_pipe_right AND (has_powerups OR is_auto_scroll)
```

**Impact:** At Sphere 0, player with "Pipe Traversal" couldn't access "Mario Zone 1 - Normal Exit" even though Python logic allowed it.

**Fix:** Updated JavaScript to match Python logic:
```javascript
return has_pipe_right(snapshot, staticData) &&
       (!is_auto_scroll(snapshot, staticData, "Mario Zone 1") ||
        hasAny(snapshot, ["Mushroom", "Fire Flower", "Carrot", "Mario Zone 1 Midway Bell"]));
```

**File:** `frontend/modules/shared/gameLogic/marioland2/helpers.js:176-179`

## Last Verified

- Date: 2025-12-10
- Test: `python scripts/test/test-all-templates.py --include-list "Super Mario Land 2.yaml"`
- Result: PASSED (Sphere Reached=10.1, Max Spheres=10.1)
