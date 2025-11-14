# The Wind Waker - Remaining Helper Issues

*This file tracks helper function issues that still need to be fixed.*

## Status
- Spoiler test has been run
- Test failed at Sphere 6.3
- TWW helper functions need to be implemented

## Required State Methods (from TWWLogic class)

These methods need to be implemented in JavaScript:

1. `_tww_can_defeat_all_required_bosses` - Checks if player can defeat all required bosses
2. `_tww_in_required_bosses_mode` - Returns world option value
3. `_tww_in_swordless_mode` - Returns world option value
4. `_tww_obscure_1` - Returns world option value for obscure logic level 1
5. `_tww_obscure_2` - Returns world option value for obscure logic level 2
6. `_tww_obscure_3` - Returns world option value for obscure logic level 3
7. `_tww_outside_required_bosses_mode` - Returns !required_bosses_mode
8. `_tww_outside_swordless_mode` - Returns !swordless_mode
9. `_tww_precise_1` - Returns world option value for precise logic level 1
10. `_tww_precise_2` - Returns world option value for precise logic level 2
11. `_tww_precise_3` - Returns world option value for precise logic level 3
12. `_tww_rematch_bosses_skipped` - Returns world option value
13. `_tww_has_chart_for_island` - Checks if player has the correct chart for an island

## Required Macro Functions (from Macros.py)

The Macros.py file has 1114 lines with many helper functions. Key ones visible so far:
- `can_play_winds_requiem` - Has Wind Waker + Wind's Requiem
- `can_play_ballad_of_gales` - Has Wind Waker + Ballad of Gales
- `can_play_command_melody` - Has Wind Waker + Command Melody
- `can_play_earth_gods_lyric` - Has Wind Waker + Earth God's Lyric
- `can_play_wind_gods_aria` - Has Wind Waker + Wind God's Aria
- `can_fly_with_deku_leaf_outdoors` - Has Deku Leaf + magic + winds requiem
- Many combat helper functions (can_defeat_*)
- Progressive item helpers (has_heros_sword, has_mirror_shield, etc.)

## Current Test Failure

**Location:** "Forsaken Fortress - Phantom Ganon"
**Sphere:** 6.3
**Issue:** Access rule evaluation failed - location accessible in Python LOG but not in JavaScript STATE

**Access Rule** includes `_tww_obscure_1` state method which is not yet implemented in JavaScript.

## Next Steps
1. Create `frontend/modules/shared/gameLogic/tww/` directory
2. Create `twwLogic.js` file with state methods
3. Create `helpers.js` file with macro functions
4. Implement the state methods first (simpler, mostly return config values)
5. Re-run test to identify which macro functions are actually needed
