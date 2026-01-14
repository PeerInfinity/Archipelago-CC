# Solved Helper Issues for Starcraft 2

*Last updated: 2026-01-14*

## Overview

This document tracks solved helper function issues for the Starcraft 2 game implementation.

## Solved Issues

### Issue 1: Maw of the Void locations not accessible at sphere 17.3

**Status:** SOLVED

**Date Fixed:** 2026-01-14

**Description:**
At sphere 17.3, when the player receives "Battlecruiser", 14 locations in "Maw of the Void (Terran)" should become accessible. However, the frontend was not recognizing these locations as accessible.

**Root Cause:**
The `weapon_armor_upgrade_count` helper was returning `NaN` (Not a Number) instead of the expected integer value. This caused the comparison `weapon_armor_upgrade_count("Progressive Terran Ship Weapon") >= 2` to fail, since `NaN >= 2` is always false.

The root cause was that the `count_from_list` state method was not implemented in `ruleEvaluator.js`. When the `weapon_armor_upgrade_count` helper called `state.count_from_list(item_list)`, the method lookup failed and returned `undefined`. This resulted in `count += undefined` which produces `NaN`.

**Fix:**
Added `count_from_list` handling to the `executeStateMethod` function in `frontend/modules/stateManager/core/ruleEvaluator.js`:

```javascript
// 2e. Handle count_from_list - returns the total count of items from a list (sums all quantities)
// Used by SC2 for weapon/armor upgrade counting
if (method === 'count_from_list' && args.length >= 1) {
  const items = args[0];
  if (!Array.isArray(items)) return 0;

  // Sum all item counts from the list
  let totalCount = 0;
  for (const itemName of items) {
    totalCount += (manager.inventory[itemName] || 0);
  }
  return totalCount;
}
```

**Files Changed:**
- `frontend/modules/stateManager/core/ruleEvaluator.js` - Added `count_from_list` method handling

**Verification:**
After the fix, the `weapon_armor_upgrade_count` helper correctly returns `2` (the count of Progressive Terran Ship Weapon items), and the comparison `2 >= 2` passes. All 14 Maw of the Void locations are now recognized as accessible at sphere 17.3.

The spoiler test now passes: `1 passed (23.6s)`
