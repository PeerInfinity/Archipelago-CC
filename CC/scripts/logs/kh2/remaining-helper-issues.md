# Kingdom Hearts 2 - Remaining Helper Issues

This document tracks remaining issues with the KH2 helper functions (frontend/modules/shared/gameLogic/kh2/kh2Logic.js).

## Issues

### 1. Missing helper function: get_scar_rules

**Status:** FIXED
**Location:** frontend/modules/shared/gameLogic/kh2/kh2Logic.js:1066-1077
**Python reference:** worlds/kh2/Rules.py:1018-1027

**Description:**
The `get_scar_rules` helper function is missing from the JavaScript implementation. This function checks for different magic element requirements based on the fight_logic setting:
- easy: Reflect Element, Thunder Element, Fire Element (all three)
- normal: Reflect Element, Fire Element (both)
- hard: Reflect Element only

**Test failure:**
- Sphere: 8.30
- Regions not reachable: Scar
- Locations affected: (PL) Scar Bonus: Donald Slot 1, (PL) Scar Bonus: Sora Slot 1, (PL) Scar Fire Element, Scar Event Location

**Fix:**
Added the `get_scar_rules` function to kh2Logic.js that checks for the required magic elements based on the FightLogic setting.

### 2. Missing helper function: get_hostile_program_rules

**Status:** FIXED
**Location:** frontend/modules/shared/gameLogic/kh2/kh2Logic.js:1087-1104
**Python reference:** worlds/kh2/Rules.py:get_hostile_program_rules

**Description:**
The `get_hostile_program_rules` helper function is missing. This function checks for multiple item categories:
- Donald limits: Fantasia, Flare Force
- Drive forms: Valor Form, Wisdom Form, Limit Form, Master Form, Final Form
- Summons: Chicken Little, Stitch, Genie, Peter Pan
- Reflect Element

Requirements based on fight_logic:
- easy: 4 of those categories
- normal: 3 of those categories
- hard: 2 of those categories

**Test failure:**
- Sphere: 8.57
- Regions not reachable: Hostile Program
- Locations affected: Multiple Space Paranoids locations

**Fix:**
Added the `get_hostile_program_rules` function that checks for the required item categories based on the FightLogic setting.
