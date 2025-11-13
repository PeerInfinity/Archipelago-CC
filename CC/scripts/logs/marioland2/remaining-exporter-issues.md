# Remaining Exporter Issues for Super Mario Land 2

This file tracks outstanding issues with the Super Mario Land 2 exporter.

## Status
- ✅ Basic exporter created (inherits from GenericGameExportHandler)
- ✅ Lambda default parameter resolution implemented
- ✅ Game handler function preservation added
- ✅ Helper functions created in frontend/modules/shared/gameLogic/marioland2/ (41 functions)
- ✅ Game logic registered in gameLogicRegistry.js
- ✅ Helper function API fixed (snapshot/staticData parameters)
- ✅ All zone helpers implemented and working
- ✅ **Sphere 0 passes completely!**
- ⚠️ Failing at sphere 0.1 due to entrance rule export issue

## Issues to Address

### Issue #1: Lambda Default Parameter Resolution (loc_rule and coin_rule)

**Status:** ✅ RESOLVED

**Solution:**
Created frontend helper functions for all location-specific logic. Rather than trying to export complex Python logic, all zone-specific rules are now implemented as JavaScript helpers in `frontend/modules/shared/gameLogic/marioland2/helpers.js`.

**Implementation:**
- Modified `exporter/analyzer/ast_visitors.py` (lines 200-238) to:
  1. Detect when function names resolve to callables via lambda defaults
  2. Check with game handler if function should be preserved as helper
  3. Replace parameter name with actual function name for proper helper calls
- Added 41 helper functions covering all zones
- Fixed helper API to use (snapshot, staticData) instead of (state, player)

**Result:**
- ✅ Sphere 0 passes completely
- ✅ All location rules working correctly
- ✅ Mario Zone 1, Pumpkin Zone 1, Turtle Zone 1, Macro Zone 1 all pass

---

###Issue #2: Entrance Rule Helper Export

**Status:** ❌ ACTIVE - Blocking sphere 0.1

**Description:**
Entrance rules that use helper functions like `has_level_progression` are being incorrectly exported as simple `item_check` rules with inferred item names.

**Example:**
Python entrance rule:
```python
"Tree Zone 1 -> Tree Zone 2": lambda state: has_level_progression(state, "Tree Zone Progression", self.player)
```

Exported (incorrect):
```json
{
  "type": "item_check",
  "item": "Level_Progression",
  "inferred": true
}
```

Expected:
```json
{
  "type": "helper",
  "name": "has_level_progression",
  "args": [
    {"type": "constant", "value": "Tree Zone Progression"},
    {"type": "constant", "value": 1}
  ]
}
```

**Impact:**
- Sphere 0.1 cannot access Tree Zone 2 despite having "Tree Zone Progression" item
- Prevents progression through the game
- Affects all entrance rules using has_level_progression

**Root Cause:**
The exporter's item inference system is running before the helper analysis, incorrectly simplifying helper calls into item checks.

**Possible Solutions:**
1. Disable item inference for entrance rules that use helper functions
2. Add has_level_progression to frontend helpers and ensure proper export
3. Modify exporter to preserve helper calls during entrance rule analysis
