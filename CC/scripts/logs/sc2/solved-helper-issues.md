# Solved Helper Issues

## Issue 1: Incorrect item name in `protoss_heal` helper

**Problem:** The `protoss_heal` helper function used `'Reconstruction Beam'` as the item name, but the actual item name in SC2 is `'Reconstruction Beam (Spear of Adun Auto-Cast)'`.

**Symptom:** Test failed at Sphere 14.9 with Templar's Charge locations being inaccessible. The `templars_charge_requirement` helper calls `protoss_heal`, which was failing because it couldn't find the item.

**Root Cause:** Item name mismatch between Python (`ItemNames.RECONSTRUCTION_BEAM = "Reconstruction Beam (Spear of Adun Auto-Cast)"`) and the JavaScript helper.

**Fix:** Updated `protoss_heal` in `frontend/modules/shared/gameLogic/sc2/helpers.js`:

```javascript
// Before
return has_any(snapshot, ['Carrier', 'Sentry', 'Shield Battery', 'Reconstruction Beam']);

// After
return has_any(snapshot, ['Carrier', 'Sentry', 'Shield Battery', 'Reconstruction Beam (Spear of Adun Auto-Cast)']);
```

**File Changed:** `frontend/modules/shared/gameLogic/sc2/helpers.js`

**Date Fixed:** 2025-11-26

