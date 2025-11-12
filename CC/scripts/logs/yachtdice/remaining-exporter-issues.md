# Remaining Exporter Issues for Yacht Dice

This document tracks outstanding issues with the Yacht Dice exporter.

## Issue 1: `dice_simulation_state_change` Helper Function Not Recognized

**Priority:** HIGH
**Type:** Helper Function Implementation

**Description:**
All Yacht Dice locations use the `dice_simulation_state_change` helper function to determine if a score is reachable. This helper is not being properly recognized or exported, causing all location access rules to fail evaluation.

**Error Message:**
```
Locations accessible in LOG but NOT in STATE (or checked): 1 score, 2 score, 3 score, 4 score, 5 score
ISSUE: Access rule evaluation failed
```

**Root Cause:**
The `dice_simulation_state_change` function in `/worlds/yachtdice/Rules.py` is a complex simulation that:
1. Calculates the maximum achievable score based on collected items (Dice, Rolls, Categories, Multipliers, Points)
2. Uses pre-computed probability distributions from `yacht_weights` (imported from YachtWeights.py)
3. Caches results in `state.prog_items[player]["maximum_achievable_score"]`

**Location Rule Structure:**
```json
{
  "type": "compare",
  "left": {
    "type": "helper",
    "name": "dice_simulation_state_change",
    "args": [
      {"type": "constant", "value": 4},  // frags_per_dice
      {"type": "constant", "value": 4},  // frags_per_roll
      {"type": "constant", "value": ["Category Choice", ...]},  // allowed_categories
      {"type": "constant", "value": 2}   // difficulty
    ]
  },
  "op": ">=",
  "right": {
    "type": "constant",
    "value": 1  // required score
  }
}
```

**Required Implementation:**
1. The helper needs to be recognized by the exporter and not throw errors
2. The helper must be implemented in JavaScript at `frontend/modules/shared/gameLogic/yachtdice/helpers.js`
3. The implementation requires the `yacht_weights` data to be available in JavaScript

**Dependencies:**
- `YachtWeights.py` contains `yacht_weights` dictionary with pre-computed probability distributions
- The simulation algorithm is complex and requires probability calculations

**Status:** Partially fixed - Sphere 0 passing, needs yacht_weights data for full accuracy

**Progress:**
- ✅ Helper function created and registered in gameLogicRegistry
- ✅ Correctly extracts items from snapshot.inventory
- ✅ Sphere 0 (initial state) now passes all tests
- ⚠️ Sphere 0.2+ failing - estimation too conservative with more items
- ❌ Full yacht_weights probability data not yet ported to JavaScript

**Next Steps:**
1. Export yacht_weights dictionary from `worlds/yachtdice/YachtWeights.py` to JSON
2. Load yacht_weights data in JavaScript helper
3. Replace estimation function with actual probability lookups
4. Test full game progression through all spheres

---
*Last updated: 2025-11-12*
