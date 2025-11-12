# Mario & Luigi Superstar Saga - Remaining Helper Issues

## Issue 1: StateLogic name resolution - TeeheeValley accessibility

**Status:** 🟡 PARTIALLY SOLVED - Significant Progress Made

**Description:**
The test evaluator logs "Name 'StateLogic' NOT FOUND in context" errors in some contexts, though actual rule evaluation has progressed significantly. Tests now pass through Sphere 0.3 and fail at Sphere 0.4.

**Test Progress:**
- Initial test: Failed at Sphere 0.1
- After helper implementation: Fails at Sphere 0.4 (major improvement!)

**Current Failure at Sphere 0.4:**
```
Region TeeheeValley is not reachable
Exit from Main Area requires: StateLogic.super() OR StateLogic.canDash()
Player inventory: 2 Hammers total (received in Sphere 0.1 and 0.4)
Expected: super() should return true (checks for >= 2 Hammers)
Actual: Exit not being evaluated as accessible
```

**Python Log Shows (Correct Behavior):**
```json
{"type": "state_update", "sphere_index": "0.4", "player_data": {
  "1": {"new_inventory_details": {"base_items": {"Hammers": 1}, "resolved_items": {"Hammers": 1}},
  "new_accessible_regions": ["TeeheeValley"], ...}}}
```

**Location in Code:**
- Exit rule: Main Area → TeeheeValley in rules.json
- Python: `worlds/mlss/StateLogic.py` - `super()` function (line 24-25)
- JavaScript: `frontend/modules/shared/gameLogic/mlss/mlssLogic.js` - `super_()` function
- Name resolution: `frontend/modules/shared/stateInterface.js` - `resolveName()` case for 'StateLogic'

**Helper Functions Implemented:**
All 30 StateLogic functions have been translated to JavaScript:
- Basic checks: canDig, canMini, canDash, canCrash, hammers, super, ultra
- Item collections: fruits, pieces, neon, beanFruit
- Key items: spangle, rose, brooch, thunder, fire, dressBeanstar, membership, winkle
- Complex logic: surfable, postJokes, teehee, castleTown, fungitown, soul
- Shop access: piranha_shop, fungitown_shop, star_shop, birdo_shop, fungitown_birdo_shop

**Progress Made:**
1. ✅ Created `frontend/modules/shared/gameLogic/mlss/mlssLogic.js` with all helper functions
2. ✅ Registered MLSS in gameLogicRegistry.js with correct game name and world class
3. ✅ Added 'StateLogic' case to resolveName in stateInterface.js
4. ✅ Tests now pass Spheres 0.1, 0.2, and 0.3 (was completely failing at 0.1)
5. ✅ Exported `super: super_` to handle JavaScript reserved keyword

**Next Steps to Debug:**
1. Add console logging to verify:
   - Is `super()` being called at all during TeeheeValley exit evaluation?
   - What does `count(snapshot, staticData, "Hammers")` return in Sphere 0.4?
   - Is the gameName being detected correctly when resolveName is called?
2. Check if there's an inventory aggregation issue (player receives Hammers twice)
3. Verify the function_call evaluation for attribute-based function references
4. Consider if there's a caching or timing issue with helper function resolution

**Hypothesis:**
The most likely issues are:
1. Inventory count might not be aggregating correctly (showing 1 instead of 2)
2. The helper function might not be found in a specific evaluation context
3. There could be a scope issue with gameName in the resolveName closure
