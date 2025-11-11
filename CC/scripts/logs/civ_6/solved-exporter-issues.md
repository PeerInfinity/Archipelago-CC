# Solved Exporter Issues for Civilization VI

This file tracks solved issues in the exporter for Civilization VI.

## Issue 1: Variable References in Helper Arguments Not Resolved (SOLVED)

**Status:** Solved
**Severity:** High (was blocking all era transitions)
**Date Solved:** 2025-11-11
**Files Changed:**
- `exporter/analyzer/ast_visitors.py`

### Description

The helper functions `has_progressive_items` and `has_non_progressive_items` were being called with unresolved variable references. In the ERA_ANCIENT -> ERA_CLASSICAL access rule, the helpers received `{"type": "name", "name": "previous_era"}` instead of the resolved era name "ERA_ANCIENT".

### Root Cause

The `visit_Name` method in `ast_visitors.py` only resolved variables to constants if they were simple types (int, float, str, bool). Since `previous_era` was an enum value (`EraType.ERA_ANCIENT`), it wasn't being resolved to its string value.

### Solution

Modified `exporter/analyzer/ast_visitors.py` lines 548-571 to handle enum values by extracting their `.value` attribute:

```python
# Handle enum values by extracting their .value attribute
elif hasattr(value, 'value') and isinstance(value.value, (int, float, str, bool)):
    logging.debug(f"visit_Name: Resolved '{name}' from closure to enum constant value: {value.value}")
    return {'type': 'constant', 'value': value.value}
```

This change applies to both closure variables and function default parameters.

### Result

After the fix, the exported rule correctly resolves `previous_era` to its string value:

```json
{
  "type": "helper",
  "name": "has_progressive_items",
  "args": [
    {
      "type": "constant",
      "value": "ERA_ANCIENT"
    }
  ]
}
```

The JavaScript helper functions can now evaluate the rule correctly, allowing era transitions to work as expected.
