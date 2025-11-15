# OOT General Issues

## Status
Last updated: 2025-11-15
Test Status: FAILING at Sphere 0 - No regions accessible

## Critical Issues

### 1. Age Not Initialized from Settings (BLOCKING ALL TESTS)

**Priority**: CRITICAL - Must fix first
**Location**: frontend/modules/shared/gameLogic/oot/ootLogic.js

**Problem**:
The age is not being properly set when the game state loads. The test fails at Sphere 0 because the rule "is_starting_age or Time_Travel" evaluates to false, preventing access from Root -> Root Exits.

**Evidence**:
- Sphere 0 should make 74 regions accessible
- In STATE, 0 regions are accessible (only Menu is reachable)
- The exit from Root -> Root Exits requires: `is_starting_age or Time_Travel`
- `is_starting_age` checks if `snapshot.age === settings.starting_age`
- Settings correctly shows `starting_age: "child"`
- But `snapshot.age` is not being set to "child"

**Root Cause**:
The `ootStateModule.loadSettings()` function sets `age: startingAge`, but this may not be called during initialization, or the returned state may not be properly merged into the game state.

**Expected Behavior**:
When the game initializes, the player's age should be set to the value of `settings.starting_age` (which is "child" by default).

**Fix Needed**:
Investigate how `loadSettings()` is called in the state initialization flow. Ensure that:
1. `loadSettings()` is actually called during initialization
2. The returned state object is properly merged into the game state
3. `snapshot.age` is set to the correct starting age value
4. The age is included in state snapshots so helpers can access it

**Test to Verify Fix**:
After fixing, the spoiler test should progress past Sphere 0 and start accessing regions.

## Medium Priority Issues

### 2. Missing Helper Functions

**Priority**: MEDIUM - Needed for full test pass
**Location**: frontend/modules/shared/gameLogic/oot/ootLogic.js

Many helper functions are not implemented (see remaining-helper-issues.md for full list). The most important missing helpers are:
- `has_fire_source` / `has_fire_source_with_torch`
- `can_child_attack` / `can_use_projectile`
- `can_stun_deku`
- `can_break_*_beehive` functions

These helpers are needed for evaluating location access rules correctly.

### 3. Special Rule Patterns Not Parsed

**Priority**: MEDIUM
**Location**: frontend/modules/shared/gameLogic/oot/ootLogic.js

Some rules use special patterns that aren't yet handled:
- `at('Region Name', rule)` - Evaluate rule at specific region
- `here(rule)` - Evaluate rule in current context
- `has_projectile(weapon)` - Function call with specific weapon check

**Example Failures**:
- `at('Forest Temple Outside Upper Ledge', can_use(Hookshot) or can_use(Boomerang))`
- `here(has_fire_source_with_torch or can_use(Bow))`

## Low Priority Issues

### 4. Time of Day Logic Not Implemented

**Priority**: LOW - Currently returns true
**Location**: frontend/modules/shared/gameLogic/oot/ootLogic.js

Time-based helpers (`at_night`, `at_day`, `at_dampe`) currently always return true. These may need proper implementation based on items like Sun's Song or game state flags.

### 5. Logic Tricks All Disabled

**Priority**: LOW - Safe default
**Location**: frontend/modules/shared/gameLogic/oot/ootLogic.js

All logic trick helpers currently return false. This is safe and correct for the default "glitchless" logic setting. These only need implementation if testing with tricks enabled.

## Notes

The #1 critical issue (age initialization) must be fixed before any other work can proceed, as it prevents all regions from being accessible in Sphere 0.
