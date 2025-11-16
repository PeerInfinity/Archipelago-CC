# Remaining General Issues

## Issue 1: count_true exported as helper instead of native rule type

**Location**: `exporter/games/stardew_valley.py:268-276`

**Problem**: The Count rule from Stardew Valley is being exported as a helper with conditions wrapped in constants:
```python
{
    'type': 'helper',
    'name': 'count_true',
    'args': [
        {'type': 'constant', 'value': count_required},
        {'type': 'constant', 'value': conditions}  # Array of rule objects
    ]
}
```

When these args are evaluated by the rule engine, the conditions become raw objects that can't be recursively evaluated.

**Test Failure**: Forager's Bundle location is accessible in LOG but not in STATE at Sphere 0.5

**Solution**:
1. Add 'count_true' as a native rule type in the rule engine (like 'and', 'or')
2. Update the exporter to generate:
```python
{
    'type': 'count_true',
    'count': count_required,
    'conditions': conditions  # Unwrapped array of rule objects
}
```
