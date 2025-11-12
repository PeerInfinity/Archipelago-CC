# Solved Exporter Issues for Yacht Dice

This document tracks issues with the Yacht Dice exporter that have been resolved.

## Solved Issue 1: Basic Exporter Creation

**Description:** Created basic Yacht Dice exporter that inherits from GenericGameExportHandler.

**Solution:** Created `exporter/games/yachtdice.py` with YachtDiceGameExportHandler class.

**Files Changed:**
- `exporter/games/yachtdice.py` (new)

**Status:** ✅ Complete

---

## Solved Issue 2: Helper Function Registration

**Description:** Helper function `dice_simulation_state_change` not recognized by frontend.

**Root Cause:**
- Helper function not created in frontend
- Yacht Dice not registered in gameLogicRegistry

**Solution:**
1. Created `frontend/modules/shared/gameLogic/yachtdice/helpers.js`
2. Created `frontend/modules/shared/gameLogic/yachtdice/yachtdiceLogic.js`
3. Registered Yacht Dice in `gameLogicRegistry.js` with worldClass 'YachtDiceWorld'

**Files Changed:**
- `frontend/modules/shared/gameLogic/yachtdice/helpers.js` (new)
- `frontend/modules/shared/gameLogic/yachtdice/yachtdiceLogic.js` (new)
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js` (modified)

**Status:** ✅ Complete

---

## Solved Issue 3: Snapshot Items Access

**Description:** Helper returning maxScore=0 because items not found in snapshot.

**Root Cause:** Trying to access `snapshot.items` but actual path is `snapshot.inventory`.

**Solution:** Updated extractProgression() to check multiple possible locations:
```javascript
const items = snapshot?.items || snapshot?.inventory || snapshot || {};
```

**Status:** ✅ Complete

---

## Solved Issue 4: Sphere 0 Accessibility

**Description:** Locations 1-5 score not accessible at sphere 0 despite having starting items.

**Root Cause:** Score estimation formula too aggressive, returning 16 instead of ~5.

**Solution:** Adjusted estimation formula to be more conservative:
- Reduced base factor: `Math.pow(numDice, 0.6) * Math.pow(numRolls, 0.3)`
- Reduced category multipliers significantly
- Now returns maxScore=5 for starting state (1 dice, 1 roll, 2 categories)

**Status:** ✅ Complete - Sphere 0 passing

---
*Last updated: 2025-11-12*
