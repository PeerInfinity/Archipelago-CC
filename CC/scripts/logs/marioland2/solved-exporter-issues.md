# Super Mario Land 2 - Solved Exporter Issues

## Issue 1: has_level_progression not exported as helper call

**Status**: FIXED
**Fixed in**: exporter/exporter.py, exporter/analyzer/ast_visitors.py, exporter/games/marioland2.py

### Problem
The `has_level_progression` function was being exported as an inferred item check for "Level_Progression" instead of as a proper helper call.

### Root Causes
1. Helper functions like `has_level_progression` were not being passed to the analyzer in closure_vars, so the analyzer couldn't recognize them
2. The analyzer was recursively analyzing helper functions instead of preserving them as helper calls
3. The GenericGameExportHandler was auto-expanding helpers matching patterns like `has_*` into inferred item checks

### Solution
1. **exporter/exporter.py** (lines 715-732): Modified to include helper functions from `game_handler.HELPER_FUNCTIONS` in the closure_vars passed to the analyzer
2. **exporter/analyzer/ast_visitors.py** (lines 317-332): Added check for `should_preserve_as_helper` before recursively analyzing closure variables
3. **exporter/games/marioland2.py** (lines 94-115): Overrode `expand_rule` method to prevent auto-expansion of our helper functions

### Result
Exit rules like "Tree Zone 1 -> Tree Zone 2" are now correctly exported as:
```json
{
  "type": "helper",
  "name": "has_level_progression",
  "args": [
    {"type": "constant", "value": "Tree Zone Progression"}
  ]
}
```

Instead of the incorrect inferred rule:
```json
{
  "type": "item_check",
  "item": "Level_Progression",
  "inferred": true
}
```

### Test Results
- Spoiler test now passes sphere 0.1 (previously failing)
- Tree Zone 2 is now accessible in the correct sphere
