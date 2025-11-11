# Solved Exporter Issues for Blasphemous

## Fixed Issues

### Issue 1: Count methods using count_check instead of helper type - FIXED
**Sphere:** 8.3
**Problem:** The exporter was mapping count-returning methods (red_wax, blue_wax, charged, ranged, dive, lunge, upward, combo) to `count_check` type. However, `count_check` without a `count` field returns a boolean (True if count >= 1), not the actual count value. This caused issues when these were used in compare operations (e.g., `red_wax >= 3`).
**Python implementation:** Methods like `red_wax(state)` and `blue_wax(state)` return integer counts
**Wrong exporter mapping:** `'red_wax': {'type': 'count_check', 'item': 'Bead of Red Wax'}`
**Solution:** Changed these methods to use `helper` type instead, which correctly returns numeric values: `'red_wax': {'type': 'helper', 'name': 'red_wax'}`
**Files modified:** exporter/games/blasphemous.py (lines 507-516)
**Impact:** Fixed access to regions requiring specific bead counts (e.g., D05Z02S08 requiring red_wax >= 3 and blue_wax >= 3)
**Result:** Spoiler test now passes completely!
