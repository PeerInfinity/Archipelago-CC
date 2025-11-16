# Yu-Gi-Oh! 2006 - Solved General Issues

## Issue 1: Worker Thread Timeout at Sphere 2.108 (SOLVED)

**Status:** ✅ FIXED

**Root Cause:**
The Yu-Gi-Oh! 2006 rules.py file defines 23 custom helper functions (e.g., `only_level`, `only_warrior`, `only_dark`, etc.) that are used in access rules. However, these helper functions were not being preserved during the export process. The exporter was attempting to inline these functions, which either:
1. Created extremely complex nested rules that were expensive to evaluate, or
2. Failed to export them correctly, causing undefined behavior in JavaScript

**Solution:**
1. Updated `exporter/games/yugioh06.py` to override `should_preserve_as_helper()` method
2. Added all 23 custom helper functions to the `CUSTOM_HELPERS` set in the exporter
3. Implemented all 23 helper functions in JavaScript in `frontend/modules/shared/gameLogic/yugioh06/yugioh06Logic.js`
4. Regenerated the rules.json with the fixed exporter

**Files Changed:**
- `exporter/games/yugioh06.py` - Added helper preservation logic
- `frontend/modules/shared/gameLogic/yugioh06/yugioh06Logic.js` - Implemented all helper functions

**Test Results:**
- Spoiler test now passes successfully for seed 1
- All 971 spheres processed without timeout
- No discrepancies found in sphere comparison

**Helper Functions Implemented:**
- only_light
- only_dark
- only_earth
- only_water
- only_fire
- only_wind
- only_fairy
- only_warrior
- only_zombie
- only_dragon
- only_spellcaster
- equip_unions
- can_gain_lp_every_turn
- only_normal
- only_level
- spell_counter
- take_control
- only_toons
- only_spirit
- pacman_deck
- quick_plays
- counter_traps
- back_row_removal
