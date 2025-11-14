# Solved Exporter Issues for Mario & Luigi Superstar Saga

This file tracks resolved issues with the exporter for MLSS.

## Solved Issues

### Issue 1: StateLogic module functions not recognized as helpers

**Status**: SOLVED
**Fixed in**: `exporter/analyzer/ast_visitors.py`
**Date**: 2025-11-14

**Problem**:
The analyzer didn't recognize `StateLogic.canDig()` style calls as helper functions. It was exporting them as generic `function_call` types with attribute access on a name "StateLogic", which doesn't exist in the JavaScript context.

**Solution**:
Added special handling in the `visit_Call` method (line 773-826) to recognize module-based helper calls. When a function call is an attribute access on a name ending with "Logic" or named "Rules", it's now converted to a helper function.

**Code Change**:
Added check after `logic.method()` handling:
```python
# Handle module-based helper calls (e.g., StateLogic.canDig, Rules.method)
if obj_name and (obj_name.endswith('Logic') or obj_name == 'Rules'):
    # Convert to helper
    result = {
        'type': 'helper',
        'name': method_name,
        'args': filtered_args
    }
```

**Verification**:
- Before fix: `StateLogic` appeared in rules.json
- After fix: 0 occurrences of `StateLogic` in rules.json
- Helper functions now correctly exported as `{"type": "helper", "name": "canDig", "args": []}`
