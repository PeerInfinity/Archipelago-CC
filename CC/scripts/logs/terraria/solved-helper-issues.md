# Solved Helper Issues for Terraria

## Implemented Required Helper Functions

**Status:** SOLVED
**Priority:** High
**Category:** Helpers

**Description:**
Terraria required several game-specific helper functions for rule evaluation:
- `check_setting` - Check if a game setting is enabled (calamity, grindy_achievements, getfixedboi)
- `has_n_from_list` - Check if player has at least N items from a list (for NPC counts and mechanical bosses)
- `has_minions` - Complex calculation for minion slots (base + armor + accessories)

**Solution:**
Created `frontend/modules/shared/gameLogic/terraria/helpers.js` with all required helper functions:
1. `check_setting(snapshot, staticData, settingName)` - Checks game settings from staticData
2. `has_n_from_list(snapshot, staticData, itemList, requiredCount)` - Counts items from a list in inventory
3. `has_minions(snapshot, staticData, requiredCount)` - Calculates total minion slots:
   - Base minion count: 1
   - Armor sets: Only the best one counts
   - Accessories: Stack together

Created `frontend/modules/shared/gameLogic/terraria/terrariaLogic.js` to export the helpers.

Registered Terraria in `frontend/modules/shared/gameLogic/gameLogicRegistry.js`.

**Files created:**
- `frontend/modules/shared/gameLogic/terraria/helpers.js`
- `frontend/modules/shared/gameLogic/terraria/terrariaLogic.js`

**Files modified:**
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js`
