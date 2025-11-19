# Solved Exporter Issues

## Issue 1: Keep Laser Activated - Invalid comprehension pattern (SOLVED)

**Status**: Solved

**Location**: Keep Laser Activated

**Problem**: The access rule contained an "all_of" comprehension pattern with bound method objects in the iterator. During the simplification phase, these were Python method objects (not strings), causing the pattern detection to fail.

**Root Cause**: The `_is_all_of_comprehension_with_bound_methods` method only checked for string representations of bound methods (`isinstance(v, str) and '<bound method' in v`), but during the analysis phase, the values are actual Python method objects.

**Solution**: Updated `_is_all_of_comprehension_with_bound_methods` in `exporter/games/witness.py` to handle both cases:
- String representations (for already-serialized JSON)
- Actual method objects (during analysis/simplification)

The fix checks:
```python
has_bound_method = any(
    (isinstance(v, str) and '<bound method' in v) or
    (hasattr(v, '__self__') and hasattr(v, '__name__'))  # Check if it's a bound method object
    for v in values
)
```

**Result**: Keep Laser Activated now correctly simplifies to `can_reach_region('Keep Tower')`, and the spoiler test passes all spheres.

**Files modified**:
- exporter/games/witness.py

This file tracks resolved issues with the exporter (exporter/games/witness.py).
