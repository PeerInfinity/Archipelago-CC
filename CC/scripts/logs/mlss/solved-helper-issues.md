# MLSS Solved Helper Issues

This document tracks solved helper function issues for Mario & Luigi Superstar Saga.

## Solved Issues

### Issue 1: Missing helper functions for mlss (SOLVED)

**Error:** Access rule evaluation failed for "Hoohoo Village Hammer House Block"
**Cause:** The mlss game uses helper functions in access rules (e.g., `hammers`) but no helper JavaScript file existed in the frontend.

**Solution:** Created frontend helper files:
- `frontend/modules/shared/gameLogic/mlss/helpers.js` - All helper functions
- `frontend/modules/shared/gameLogic/mlss/mlssLogic.js` - Module registration
- Updated `gameLogicRegistry.js` to register mlss helpers

**Implemented Helpers:**
- `hammers` - Check if player has "Hammers" item
- `super` - Check if player has at least 2 "Hammers"
- `ultra` - Check if player has at least 3 "Hammers"
- `canDig` - Has "Green Goblet" AND has "Hammers"
- `canMini` - Has "Red Goblet" AND has "Hammers"
- `canDash` - Has "Red Pearl Bean" AND has "Firebrand"
- `canCrash` - Has "Green Pearl Bean" AND has "Thunderhand"
- `fruits` - Has all three Chuckola Fruits
- `pieces` - Has all four Beanstar Pieces
- `neon` - Has all seven Neon Eggs
- `spangle` - Has "Spangle"
- `rose` - Has "Peasley's Rose"
- `brooch` - Has "Beanbean Brooch"
- `thunder` - Has "Thunderhand"
- `fire` - Has "Firebrand"
- `dressBeanstar` - Has "Peach's Extra Dress" AND "Fake Beanstar"
- `membership` - Has "Membership Card"
- `winkle` - Has "Winkle Card"
- `beanFruit` - Has all seven Bean Fruits
- `surfable` - Complex logic combining multiple helpers
- `postJokes` - Complex logic with goal check
- `teehee` - super OR canDash
- `castleTown` - fruits AND brooch
- `fungitown` - Complex logic
- `soul` - Complex logic

**Status:** SOLVED - Basic helpers implemented and working.
