# Secret of Evermore - Solved Helper Issues

Last updated: 2026-01-30

## Summary

This document tracks helper issues that have been resolved.

## Solved Issues

### Issue 1: Settings path incorrect (2026-01-30)

**Problem:** The `has()` helper was looking for settings at `staticData.world[1].out_of_bounds` instead of the correct path `staticData.world[1].options.out_of_bounds`.

**Cause:** The rules.json structure has options nested under `world[1].options`, but the helper was accessing `world[1]` directly.

**Fix:** Changed settings access from:
```javascript
const settings = staticData?.world?.[1];
return settings?.out_of_bounds === 2;
```

To:
```javascript
const options = staticData?.world?.[1]?.options;
return options?.out_of_bounds === 2;
```

**Files Modified:** `frontend/modules/shared/gameLogic/soe/soeLogic.js`

---

### Issue 2: Energy core fragments mode check incorrect (2026-01-30)

**Problem:** The fragments mode check was comparing `energy_core === 1` instead of `energy_core === 2`.

**Cause:** Confusion about option value mapping:
- 0: vanilla
- 1: shuffle
- 2: fragments

The code incorrectly assumed fragments was option value 1.

**Fix:** Changed from `settings?.energy_core === 1` to `options?.energy_core === 2`.

**Files Modified:** `frontend/modules/shared/gameLogic/soe/soeLogic.js`

---

### Issue 3: countProgress missing setting-based progress handling (2026-01-30)

**Problem:** The `countProgress()` function didn't handle setting-based progress IDs (25=P_ALLOW_OOB, 26=P_ALLOW_SEQUENCE_BREAKS). When logic rules required these progress IDs, `countProgress` would return 0 even when the settings allowed them.

**Cause:** `countProgress()` only counted progress from items and logic rules, not from settings. When evaluating logic rule requirements like "requires P_ALLOW_OOB", it couldn't determine that the option was enabled.

**Fix:** Added special handling at the start of `countProgress()`:
```javascript
// Special handling for setting-based progress IDs
const options = staticData?.world?.[1]?.options;

if (progressId === 25) { // P_ALLOW_OOB
  return options?.out_of_bounds === 2 ? 1 : 0;
}

if (progressId === 26) { // P_ALLOW_SEQUENCE_BREAKS
  return options?.sequence_breaks === 2 ? 1 : 0;
}
```

**Files Modified:** `frontend/modules/shared/gameLogic/soe/soeLogic.js`

## Test Results After Fixes

### Default Settings Test
- Total events: 20
- Processed events: 20
- Result: PASSED

### Fragments Mode + Logic OOB/Sequence Breaks Test
- Total events: 49
- Processed events: 49
- Result: PASSED
