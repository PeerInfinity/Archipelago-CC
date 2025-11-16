# Starcraft 2 Spoiler Test Progress Summary

## Overview

Started with spoiler test failing at **Sphere 7.2** (step 38).
Currently progressing through **Sphere 12.1+** (step 72+).

## Issues Fixed

### 1. Critical: Settings Access Bug
**Impact:** HIGH - Affected ALL helper functions
**Status:** ✅ FIXED

All helpers were accessing `staticData.settings` directly instead of `staticData.settings[playerId]`. This caused all settings to read as `undefined`, breaking many helper functions.

**Fixed in commit:** 514523f5

**Affected functions:**
- `isAdvancedTactics()`
- `zerg_basic_anti_air()`
- `kerrigan_levels()`
- `the_infinite_cycle_requirement()`
- `brothers_in_arms_requirement()`

### 2. Spawn Banelings Tier Typo
**Impact:** MEDIUM
**Status:** ✅ FIXED

Changed "Spawn Banelings (Kerrigan Tier 1)" to "Spawn Banelings (Kerrigan Tier 4)" in three locations to match Python implementation.

**Fixed in commit:** 514523f5

### 3. Missing Helper Implementations
**Impact:** HIGH
**Status:** ⚠️ PARTIALLY FIXED

Many mission requirement helpers were stubs returning `false`. Implemented:

- ✅ `harbinger_of_oblivion_requirement` (commit 46d986ba)
- ✅ `steps_of_the_rite_requirement` (commit 46d986ba)

## Remaining Work

### Unimplemented Helpers

There are still **23 unimplemented helper functions** that return `false` by default. These need to be implemented based on the Python code in `worlds/sc2/Rules.py`.

Currently failing missions (as of Sphere 12.1):
- Evacuation
- Smash and Grab
- (and likely more in subsequent spheres)

To find unimplemented helpers:
```bash
grep "_requirement: () => false" frontend/modules/shared/gameLogic/sc2/helpers.js
```

### Implementation Pattern

For each helper:
1. Find the Python implementation in `worlds/sc2/Rules.py`
2. Translate the logic to JavaScript in `helpers.js`
3. Ensure proper settings access using `staticData.settings?.[staticData.player || '1']`
4. Use existing helper functions (many are already implemented)
5. Test with `npm test --mode=test-spoilers --game=sc2 --seed=1`

### Next Steps

1. Implement remaining mission requirement helpers one by one
2. Run spoiler test after each implementation to track progress
3. Continue until spoiler test passes completely
4. Once passing, run: `python scripts/test/test-all-templates.py --retest --retest-continue 10 -p`

## Test Progress

| Sphere | Status | Notes |
|--------|--------|-------|
| 7.2 | ✅ PASS | Fixed settings access bug |
| 10.3 | ✅ PASS | The Infinite Cycle locations now correctly accessible |
| 11.1 | ✅ PASS | Harbinger of Oblivion implemented |
| 12.1 | ⚠️ IN PROGRESS | Steps of the Rite implemented, but more helpers needed |
| 12.1+ | ❌ FAIL | Additional mission helpers needed |

## Files Modified

- `frontend/modules/shared/gameLogic/sc2/helpers.js` - Main helper implementations
- `CC/scripts/logs/sc2/*.md` - Issue tracking documents

## Commits

1. `514523f5` - Fix SC2 helper settings access and Kerrigan tier typo
2. `46d986ba` - Implement harbinger_of_oblivion and steps_of_the_rite helpers
