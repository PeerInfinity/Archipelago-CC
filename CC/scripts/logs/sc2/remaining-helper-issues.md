# Remaining Helper Issues for Starcraft 2

This file tracks helper function issues that still need to be fixed.

## Issue 1: Settings accessed incorrectly in all helper functions

**Status:** FIXED (committed)

**Description:** All helpers access settings as `staticData.settings` directly, but they should access `staticData.settings[playerId]` instead. This causes all settings to be undefined, which breaks many helper functions.

**Impact:** Causes the Infinite Cycle mission locations to become accessible too early because `kerriganUnitAvailable` reads as `false` instead of `true`.

**Test failure:** Spoiler test fails at Sphere 7.2 with 7 locations accessible in STATE but not in LOG:
- The Infinite Cycle: Victory
- The Infinite Cycle: First Hall of Revelation
- The Infinite Cycle: Second Hall of Revelation
- The Infinite Cycle: First Xel'Naga Device
- The Infinite Cycle: Second Xel'Naga Device
- The Infinite Cycle: Third Xel'Naga Device
- Beat The Infinite Cycle

**Debug evidence:** Console logging shows `kerriganUnitAvailable: false` when it should be `true`.

**Root cause:** Settings are stored in the JSON as `settings['1']` for player 1, but helpers access `settings` directly.

**Fix:** Update all helpers to access settings as `staticData.settings?.[staticData.player || '1']` instead of `staticData.settings`.

**Affected functions:**
- `isAdvancedTactics`
- `zerg_basic_anti_air`
- `kerrigan_levels`
- `the_infinite_cycle_requirement`
- `brothers_in_arms_requirement`
- Any other function accessing `staticData.settings`
