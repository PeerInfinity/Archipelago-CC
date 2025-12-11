# Solved Helper Issues - Kirby's Dream Land 3

This document tracks helper function issues that have been resolved.

## Solved Issues

### 1. `can_assemble_rob` and `can_fix_angel_wings` not accessing `copy_abilities` correctly

**Date Solved:** 2025-12-11

**Problem:**
The `can_assemble_rob` and `can_fix_angel_wings` helper functions were expecting the `copy_abilities` dictionary to be passed as an argument. However, the exporter was passing a list of enemy names (the keys of the dictionary) instead of the dictionary itself.

**Symptoms:**
- Test failed at Sphere 7.57 for location "Sand Canyon 6 - Professor Hector & R.O.B"
- Access rule evaluation failed

**Root Cause:**
The Python code calls these helpers with `world.copy_abilities`, which is a dictionary mapping enemy names to their abilities. When the rule analyzer exports this, it captures the dictionary keys as a list instead of the full dictionary. The `copy_abilities` dictionary IS exported correctly in the settings section of rules.json, but the helpers were trying to use the passed argument instead.

**Fix:**
Modified both helper functions to look up `copy_abilities` from `staticData.settings` instead of using the passed argument:

```javascript
// Before (incorrect)
export function can_assemble_rob(snapshot, staticData, copy_abilities) {
  // copy_abilities was a list of enemy names, not the expected dictionary
  ...
}

// After (correct)
export function can_assemble_rob(snapshot, staticData, _unused) {
  const playerId = snapshot?.player?.id || snapshot?.player?.slot || "1";
  const playerSettings = staticData?.settings?.[playerId] || staticData?.settings?.["1"] || {};
  const copy_abilities = playerSettings.copy_abilities || {};
  ...
}
```

**Files Changed:**
- `frontend/modules/shared/gameLogic/kdl3/kdl3Logic.js`
  - Updated `can_assemble_rob()` function
  - Updated `can_fix_angel_wings()` function

**Verification:**
After the fix, all spoiler tests pass (342/342 events processed successfully).
