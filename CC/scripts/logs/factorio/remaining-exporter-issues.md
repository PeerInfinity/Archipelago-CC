# Remaining Exporter Issues for Factorio

This file tracks issues that need to be fixed in the exporter (exporter/games/factorio.py).

## Issue 1: List Comprehension with Missing Iterator Data

**Priority**: HIGH - Blocks all spoiler tests

**Description**:
Locations with `all_of` rules that include `iterator_info` are failing because the iterator data (e.g., `ingredients`) is not being exported or resolved.

**Example Location**: AP-1-031
```json
{
  "type": "all_of",
  "element_rule": {
    "type": "item_check",
    "item": {
      "type": "f_string",
      "parts": [
        {"type": "constant", "value": "Automated "},
        {"type": "formatted_value", "value": {"type": "name", "name": "ingredient"}}
      ]
    }
  },
  "iterator_info": {
    "type": "comprehension_details",
    "target": {"type": "name", "name": "ingredient"},
    "iterator": {"type": "name", "name": "ingredients"}
  }
}
```

**Python Source** (worlds/factorio/__init__.py:240-241):
```python
Rules.set_rule(location, lambda state, ingredients=frozenset(location.ingredients):
    all(state.has(f"Automated {ingredient}", player) for ingredient in ingredients))
```

**Root Cause**:
The `location.ingredients` attribute contains the list of ingredients needed, but this data is not being captured in the exported JSON. The comprehension references a variable `ingredients` that doesn't exist in the runtime context.

**Impact**:
32+ locations affected in sphere 0.1, causing test to fail immediately.

**Affected Locations**:
- AP-1-031, AP-1-055, AP-1-076, AP-1-079, AP-1-080, AP-1-097, AP-1-108, AP-1-126, AP-1-141, AP-1-158
- AP-1-194, AP-1-195, AP-1-211, AP-1-235, AP-1-330, AP-1-459, AP-1-475, AP-1-494, AP-1-499
- AP-1-633, AP-1-653, AP-1-711, AP-1-754, AP-1-757, AP-1-769, AP-1-798, AP-1-880, AP-1-934
- AP-1-951, AP-1-954, AP-1-983, AP-1-997

**Possible Solutions**:
1. **Resolve at export time**: The analyzer should detect this pattern and resolve the comprehension by extracting `location.ingredients` and expanding the rule into a concrete AND of item checks
2. **Export static data**: Include `location.ingredients` in the exported location data as a custom field
3. **Enhance rule engine**: Add support for comprehensions with local data binding (more complex)

**Recommended Solution**: Option 1 - Resolve at export time in the analyzer
