# Solved Helper Issues for Starcraft 2

This file tracks helper function issues that have been successfully fixed.

## Issue 1: Settings accessed incorrectly in all helper functions

**Fixed in commit:** (to be committed)

**Description:** All helpers were accessing settings as `staticData.settings` directly, but they should access `staticData.settings[playerId]` instead.

**Impact:** Caused the Infinite Cycle mission locations to become accessible too early because `kerriganUnitAvailable` read as `false` instead of `true`.

**Fix:** Updated the following functions to access settings as `staticData.settings?.[staticData.player || '1']`:
- `isAdvancedTactics()`
- `zerg_basic_anti_air()`
- `kerrigan_levels()`
- `the_infinite_cycle_requirement()`
- `brothers_in_arms_requirement()`

**Files modified:**
- `frontend/modules/shared/gameLogic/sc2/helpers.js`

## Issue 2: Spawn Banelings listed as Tier 1 instead of Tier 4

**Fixed in commit:** (to be committed)

**Description:** The `two_kerrigan_actives()` and `basic_kerrigan()` functions incorrectly listed "Spawn Banelings (Kerrigan Tier 1)" instead of "Spawn Banelings (Kerrigan Tier 4)".

**Impact:** Minor - would have caused incorrect tier counting if a player had Spawn Banelings.

**Fix:** Changed all three occurrences of "Spawn Banelings (Kerrigan Tier 1)" to "Spawn Banelings (Kerrigan Tier 4)" to match the Python code.

**Files modified:**
- `frontend/modules/shared/gameLogic/sc2/helpers.js` (lines 424, 452, 468)
