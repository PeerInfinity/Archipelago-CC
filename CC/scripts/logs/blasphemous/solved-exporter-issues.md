# Blasphemous Exporter Issues (Solved)

## Issue 1: item_check/group_check/count_check fields wrapped in constant objects

**Status**: FIXED
**Commit**: cfda0418

### Description
The analyzer was wrapping item/group names in `{'type': 'constant', 'value': '...'}` objects when they should be plain strings according to rules.schema.json.

### Fix
Modified `exporter/analyzer/ast_visitors.py` to:
1. Extract string values from constant objects for item_check rules (line 732, 735)
2. Extract string values from constant objects for group_check rules (line 761-769)
3. Extract string values from constant objects for has_any item lists (line 788-798)
4. Extract string values from constant objects for count_check rules (line 799-810)

### Impact
This fixed hundreds of locations being incorrectly marked as accessible in Sphere 0.

## Issue 2: get_item_data() failing on Blasphemous item_table

**Status**: FIXED
**Commit**: cfda0418

### Description
The Blasphemous exporter's `get_item_data()` method assumed `item_table` was a dict, but in Blasphemous it's a list of dicts with 'name', 'count', and 'classification' keys.

### Fix
Modified `exporter/games/blasphemous.py` to iterate over `item_table` as a list and extract item data from dict elements.

### Impact
Eliminated "Error getting game-specific item data for Blasphemous: 'list' object has no attribute 'items'" error during generation.

## Issue 3: Invalid rule types (capability, boss_check) in _expand_dynamic_helper

**Status**: FIXED
**Commit**: 41a5d100

### Description
The `_expand_dynamic_helper()` method was creating rules with invalid types like 'capability', 'boss_check', and custom 'can_reach' type that don't exist in rules.schema.json, causing "Unknown rule type" errors in the frontend rule engine.

### Fix
Modified `exporter/games/blasphemous.py` to make all dynamic helper expansions use the 'helper' type instead of creating invalid rule types. Now all helpers properly delegate to helper functions in blasphemousLogic.js.

### Impact
Eliminated "Unknown rule type: capability" errors during rule evaluation.
