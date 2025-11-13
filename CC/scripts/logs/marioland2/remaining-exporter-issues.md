# Remaining Exporter Issues for Super Mario Land 2

This file tracks outstanding issues with the Super Mario Land 2 exporter.

## Status
- ✅ Basic exporter created (inherits from GenericGameExportHandler)
- ✅ Lambda default parameter resolution implemented
- ✅ Game handler function preservation added
- ✅ Helper functions created in frontend/modules/shared/gameLogic/marioland2/
- ✅ Game logic registered in gameLogicRegistry.js
- ⚠️ Helper functions are loading but logic needs refinement

## Issues to Address

### Issue #1: Lambda Default Parameter Resolution (loc_rule and coin_rule)

**Status:** PARTIALLY FIXED - Macro Zone 1 works, but other complex cases remain

**Fix Applied:**
Modified `exporter/analyzer/ast_visitors.py` (lines 200-228) to detect when a function name resolves to a callable via lambda default parameters and recursively analyze that function instead of creating a helper call.

**Results After Fix:**
✅ Fixed: Macro Zone 1 - Midway Bell and Normal Exit now work correctly
❌ Still Failing:
- Pumpkin Zone 1 - Midway Bell and Normal Exit (variable resolution issue)
- Turtle Zone 1 - Normal Exit (list comprehension issue)
- Mario Zone 1 - Normal Exit (conditional/auto-scroll logic issue)

**Original Description:**
The exporter was encountering lambdas with default parameters:
```python
location.access_rule = lambda state, loc_rule=rule: loc_rule(state, self.player)
```

The fix now properly resolves `loc_rule` to the actual function reference and analyzes it recursively.

**Remaining Sub-Issues:** See Issues #2 and #3 below for the new problems discovered.

---

### Issue #2: Variable Resolution in Helper Functions

**Status:** To Be Addressed

**Description:**
When analyzing helper functions like `is_auto_scroll(state, player, level)`, the analyzer cannot resolve function parameters like `level` that are passed as string constants from calling code.

**Example:**
In `pumpkin_zone_1_midway_bell`, it calls `is_auto_scroll(state, player, "Pumpkin Zone 1")`.
The `is_auto_scroll` function does `level_id = level_name_to_id[level]`, but the analyzer exports this as an unresolved subscript instead of resolving it.

**Exported Rule (incorrect):**
```json
{
  "type": "subscript",
  "value": {"type": "name", "name": "level_name_to_id"},
  "index": {"type": "name", "name": "level"}
}
```

**Expected:**
Should resolve `level` to `"Pumpkin Zone 1"` and `level_name_to_id["Pumpkin Zone 1"]` to the actual level ID constant.

**Affected Locations:**
- Pumpkin Zone 1 - Midway Bell
- Pumpkin Zone 1 - Normal Exit
- (And any other location that calls `is_auto_scroll`)

---

### Issue #3: List Comprehension Analysis Failure

**Status:** To Be Addressed

**Description:**
The analyzer fails to handle list comprehensions in helper functions, resulting in malformed rules with `"function": null`.

**Example:**
In `not_blocked_by_sharks` (called by `turtle_zone_1_normal_exit`):
```python
sharks = [state.multiworld.worlds[player].sprite_data["Turtle Zone 1"][i]["sprite"]
          for i in (27, 28)].count("Shark")
```

**Generation Warning:**
```
visit_Attribute: Failed to get result for object in Attribute(value=ListComp(...))
```

**Exported Rule (malformed):**
```json
{
  "type": "function_call",
  "function": null,
  "args": [{"type": "constant", "value": "Shark"}]
}
```

**Affected Locations:**
- Turtle Zone 1 - Normal Exit

**Possible Solutions:**
1. Improve list comprehension analysis in the AST visitor
2. Create a custom helper function for `not_blocked_by_sharks` in the frontend
3. Simplify the Python logic to avoid complex list comprehensions
