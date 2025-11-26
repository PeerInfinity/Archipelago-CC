# KH2 Solved Helper Issues

This document tracks issues that have been resolved in the KH2 helper functions (`frontend/modules/shared/gameLogic/kh2/kh2Logic.js`).

## Solved Issues

### 1. Incorrect form level values in `get_cerberus_cup_rules`

**Date Fixed:** 2025-11-26

**Symptom:** Cerberus Cup region was not accessible when it should have been. Test failed at Sphere 5.15 with "Region Cerberus Cup is not reachable" error.

**Root Cause:** The `get_cerberus_cup_rules` function was using incorrect values for the `form_list_unlock` calls:
- For "easy" mode: Was using `5` but should be `3` (form level 5 locations require 3 forms total)
- For "normal" mode: Was using `4` but should be `2` (form level 4 locations require 2 forms total)

The Python code uses `kh2_can_reach_any` to check if form level locations (e.g., "Valor level 5") are accessible. These location access rules use `form_list_unlock(form, 3)` for level 5 and `form_list_unlock(form, 2)` for level 4.

**Fix:** Changed the level values in `get_cerberus_cup_rules`:
```javascript
// Before (incorrect):
helperFunctions.form_list_unlock(snapshot, staticData, form, 5, true)  // easy
helperFunctions.form_list_unlock(snapshot, staticData, form, 4, true)  // normal

// After (correct):
helperFunctions.form_list_unlock(snapshot, staticData, form, 3, true)  // easy
helperFunctions.form_list_unlock(snapshot, staticData, form, 2, true)  // normal
```

**Location:** `frontend/modules/shared/gameLogic/kh2/kh2Logic.js:1850-1857`
