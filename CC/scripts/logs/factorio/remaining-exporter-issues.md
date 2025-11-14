# Remaining Exporter Issues for Factorio

## Issue 1: Comprehension rules not fully evaluating in frontend

**Status:** In Progress
**Priority:** High
**Location:** Frontend rule engine evaluation of `all_of` with comprehensions

**Description:**
The access rules for "Automate" locations are being exported as `all_of` comprehensions that reference `required_technologies`, but the frontend rule engine is failing to fully evaluate these rules.

**Current behavior:**
- Rules are exported as `all_of` with `iterator_info` containing `required_technologies[ingredient]`
- Game variables including `required_technologies` are exported in `game_info.variables`
- Frontend can resolve `required_technologies` name, but rule evaluation is still failing
- Test fails at Sphere 0.1 with "Access rule evaluation failed" for multiple locations

**Progress made:**
1. Removed hardcoded `override_rule_analysis` method that was generating incorrect rules (exporter/games/factorio.py)
2. Added `get_game_info()` method to export `required_technologies` as game variables (exporter/games/factorio.py:22-39)
3. Updated `stateInterface.js` to resolve game variables from `game_info[playerId].variables` (frontend/modules/shared/stateInterface.js:330-334)
4. Fixed syntax error with duplicate `playerId` declaration

**Next steps:**
1. Debug why the `all_of` comprehension evaluation is failing
2. Check if the `attribute` rule type is working correctly for `technology.name`
3. Verify that the comprehension iterator is properly iterating over the array
4. Consider simplifying the exported rules to resolve comprehensions during export

**Test command:**
```bash
npm test --mode=test-spoilers --game=factorio --seed=1
```

**Expected test result after fix:**
All spheres should pass with locations becoming accessible at the correct times.
