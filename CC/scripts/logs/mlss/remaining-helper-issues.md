# Mario & Luigi Superstar Saga - Remaining Helper Issues

## Issue 1: Test evaluator context doesn't find StateLogic (cosmetic logging issue)

**Status:** 🟢 NOT BLOCKING - Helper functions work correctly

**Description:**
The test evaluator logs "Name 'StateLogic' NOT FOUND in context" errors when analyzing rules for detailed logging. However, the actual rule evaluation DOES find StateLogic and correctly calls all helper functions. This is purely a cosmetic issue with the test evaluator's analysis code path, not the actual game logic.

**Evidence that helpers work correctly:**
1. ✅ Inventory shows 2 Hammers at Sphere 0.4 (accumulation works)
2. ✅ `count(snapshot, staticData, "Hammers")` returns 2
3. ✅ `super_()` correctly returns true (>= 2 Hammers check passes)
4. ✅ Exit rule structure is correct: `StateLogic.super() OR StateLogic.canDash()`

**Actual Problem:**
The real issue is NOT with helper functions but with the reachability engine or test framework:
- Helper functions execute correctly and return correct values
- But TeeheeValley region is not marked as reachable despite super() returning true
- This appears to be a timing or caching issue with how region reachability is computed/updated after inventory changes

**Test Progress:**
- ✅ Sphere 0 (Start): PASS
- ✅ Sphere 0.1 (1 Hammer): PASS
- ✅ Sphere 0.2 (Red Chuckola Fruit): PASS
- ✅ Sphere 0.3 (Red Goblet): PASS
- ❌ Sphere 0.4 (2 Hammers total): FAIL - TeeheeValley not reachable

**Location in Code:**
- Python: `worlds/mlss/StateLogic.py` - All functions implemented
- JavaScript: `frontend/modules/shared/gameLogic/mlss/mlssLogic.js` - All 30 helpers working
- Name resolution: `frontend/modules/shared/stateInterface.js:314` - StateLogic case works for actual evaluation
- Test evaluator: `frontend/modules/testSpoilers/testSpoilerRuleEvaluator.js` - Analysis logging has separate context

**Next Steps:**
1. Investigate reachability engine's exit rule evaluation
2. Check if region reachability is being recomputed after inventory changes
3. Verify timing: does reachability update complete before test checks regions?
4. Consider if this is a test framework issue vs actual StateManager issue

**Hypothesis:**
The StateManager's reachability engine may not be properly evaluating exit rules or may have a timing issue where the test checks regions before reachability computation completes. The helper functions themselves are 100% working correctly.

**Not Urgent:**
The "StateLogic NOT FOUND" message in test logs can be fixed by updating the test evaluator's analysis context, but this is purely cosmetic and doesn't affect actual gameplay or rule evaluation.
