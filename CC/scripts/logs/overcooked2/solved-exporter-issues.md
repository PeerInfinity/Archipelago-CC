# Solved Exporter Issues - Overcooked! 2

## Issue 1: level_logic tuple order reversed in rules.json

**Date Fixed:** 2025-12-10

**Description:**
When exporting the `level_logic` data to rules.json, the tuple elements were being reversed. Python tuples like `('Burn Leniency', 0.15)` (item_name, weight) were being output as JSON arrays `[0.15, 'Burn Leniency']` (weight, item_name).

**Root Cause:**
The `sort_lists_for_consistency()` function in `exporter/exporter.py` was sorting ALL lists where all elements were simple types (str, int, float), even if the types were mixed. The sorting used `key=lambda x: (type(x).__name__, x)`, which sorted by type name first. Since `'float'` < `'str'` alphabetically, numbers were sorted before strings, reversing the intended order.

**Fix Location:** `exporter/exporter.py`, lines 1757-1775

**Fix Applied:**
Modified `sort_lists_for_consistency()` to only sort lists where all items are the SAME type. Lists with mixed types (like `[item_name, weight]` from Python tuples) now preserve their original order.

```python
# Before (buggy):
if processed and all(isinstance(item, (str, int, float)) for item in processed):
    return sorted(processed, key=lambda x: (type(x).__name__, x))

# After (fixed):
if processed and all(isinstance(item, (str, int, float)) for item in processed):
    first_type = type(processed[0])
    if all(type(item) is first_type for item in processed):
        return sorted(processed)
```

**Impact:**
This fix affects all games that export data containing Python tuples with mixed types. The fix ensures the original tuple element order is preserved when converted to JSON arrays.

**Verification:**
- Spoiler test passes with 201 events processed and 0 errors
- `level_logic` data now correctly shows `['Burn Leniency', 0.15]` instead of `[0.15, 'Burn Leniency']`
