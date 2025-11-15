# OOT General Issues

## Status
Last updated: 2025-11-15
Test Status: FAILING at Sphere 0 - Subrule locations incorrectly accessible

## Critical Issues

### 1. Subrule Event Locations Incorrectly Accessible (BLOCKING SPHERE 0)

**Priority**: CRITICAL - Must fix next
**Location**: Unknown - needs investigation

**Problem**:
24 "Subrule" event locations are being marked as accessible in STATE when they should not be accessible in LOG at Sphere 0.

**Evidence**:
```
Locations accessible in STATE (and unchecked) but NOT in LOG:
- Kokiri Forest Subrule 1
- Lost Woods Subrule 1, Lost Woods Subrule 2
- LW Beyond Mido Subrule 1
- Hyrule Field Subrule 1, Hyrule Field Subrule 2
- Lake Hylia Subrule 1
- Market Bazaar Item 6
- Market Potion Shop Item 1, 2, 4, 6, 7, 8
- Market Bombchu Shop Item 1-8
- Graveyard Subrule 2
- Deku Tree Lobby Subrule 1
```

**Investigation Needed**:
1. What are "Subrule" locations in OOT? (They appear to be event locations)
2. Why are they being marked as accessible when they shouldn't be?
3. Do they have access rules that are being incorrectly evaluated?
4. Or are they being automatically added to accessible locations?

**Next Steps**:
1. Examine one of these locations in the rules.json to understand its structure
2. Check if it has an access_rule that's being evaluated incorrectly
3. Determine if this is a helper function issue or a rule evaluation issue

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

The age initialization issue has been fixed! Now working on the Subrule location issue.
