# Wargroove - Remaining Exporter Issues

This document tracks issues that need to be fixed in the Wargroove exporter (`exporter/games/wargroove.py`).

## Issue 1: Python `any()` builtin not being expanded

**Status**: Active

**Description**: Region exit rules use Python's `any()` builtin with generator expressions, which creates rules like:
```json
{
  "type": "helper",
  "name": "any",
  "args": [
    {
      "type": "generator_expression",
      ...
    }
  ]
}
```

This happens because `set_region_exit_rules()` in `worlds/wargroove/Rules.py:157` creates rules like:
```python
exit_rule = lambda state: any(location.access_rule(state) for location in locations)
```

**Impact**: All region exits are inaccessible, preventing any progression.

**Error message**: `Helper function "any" NOT FOUND in snapshotInterface`

**Fix approach**: Need to expand `any()` calls with generator expressions into `or` rules that check each location's access rule.
