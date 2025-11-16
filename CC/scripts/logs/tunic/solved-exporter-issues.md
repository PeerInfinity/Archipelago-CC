# TUNIC Exporter Issues - Solved

## Issue 1: if_false branch is null instead of item_check for ability

**Status:** ✅ FIXED
**Sphere:** 0.14
**Priority:** High
**Fixed in:** exporter/analyzer/ast_visitors.py

### Description
The access rule for "Overworld -> Overworld Holy Cross" had a null `if_false` branch where it should have an item_check for the ability item.

### Root Cause
The analyzer's `visit_If` method was not properly handling if-elif-else chains when multistatement processing was disabled (the default). When the `orelse` block contained multiple statements, it would only process the first statement and ignore the rest.

In the case of the `has_ability` function:
```python
if not options.ability_shuffling:
    return True
if options.hexagon_quest and options.hexagon_quest_ability_type == HexagonQuestAbilityUnlockType.option_hexagons:
    return state.has(gold_hexagon, world.player, ability_unlocks[ability])
return state.has(ability, world.player)  # <-- This was being ignored
```

The synthetic If created by `visit_FunctionDef` would have `orelse=[second If, final Return]`. But when `visit_If` processed this orelse (with multistatement disabled), it only processed the second If and ignored the final Return, resulting in `if_false: null`.

### The Fix
Added special handling in `visit_If` (lines 1675-1697) to detect when:
1. The orelse has multiple statements
2. The first statement is an If without an orelse
3. There are more statements after it

In this case, a synthetic If is created where the first If's orelse contains the remaining statements, preserving the proper if-elif-else chain structure.

### Code Changes
File: `exporter/analyzer/ast_visitors.py`
Location: Lines 1675-1697

Added logic to handle if-elif-else chains:
```python
# Special case: If statement without else in orelse, and more statements follow
# This handles if-elif-else chains where elif/else are separate statements
if (isinstance(node.orelse[0], ast.If) and
    not node.orelse[0].orelse and
    len(node.orelse) > 1):
    logging.debug(f"visit_If: If statement without else in orelse, analyzing remaining {len(node.orelse) - 1} statements as implicit else")
    # Create a synthetic If node with the remaining statements as the else block
    if_node = node.orelse[0]
    remaining_stmts = node.orelse[1:]

    # Create a synthetic if-node that includes the remaining statements as the else block
    synthetic_if = ast.If(
        test=if_node.test,
        body=if_node.body,
        orelse=remaining_stmts,
        lineno=if_node.lineno if hasattr(if_node, 'lineno') else 0,
        col_offset=if_node.col_offset if hasattr(if_node, 'col_offset') else 0
    )

    # Visit this synthetic if-statement
    orelse_result = self.visit_If(synthetic_if)
else:
    orelse_result = self.visit(node.orelse[0])
```

### Impact
- All 27 Holy Cross locations are now accessible
- Region "Overworld Holy Cross" is now reachable
- Test passes all 66 spheres (was failing at sphere 0.14)

### Verification
- Regenerated rules.json with the fix
- Confirmed the if_false branch now contains the proper item_check
- All spoiler tests pass (66/66 spheres)
