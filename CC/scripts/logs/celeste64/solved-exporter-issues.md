# Solved Celeste 64 Exporter Issues

## Issue 1: Helper functions were being inlined instead of kept as helper calls

**Status:** SOLVED
**Severity:** CRITICAL
**Location:** exporter/games/celeste64.py

**Description:**
The exporter was inlining the bodies of `location_rule`, `region_connection_rule`, and `goal_rule` functions instead of keeping them as helper call nodes. This caused parameter references like `region_connection` to be exported as NAME nodes without values, making the rules unevaluable.

**Solution:**
Added `handle_special_function_call` method to the Celeste64GameExportHandler that converts calls to these functions into proper helper nodes:

```python
def handle_special_function_call(self, func_name: str, processed_args: list) -> dict:
    """Convert Celeste 64 helper function calls to helper nodes."""
    if func_name in ['location_rule', 'region_connection_rule', 'goal_rule']:
        return {
            'type': 'helper',
            'name': func_name,
            'args': processed_args
        }
    return None
```

**Result:**
- Region exit rules now correctly use `{"type": "helper", "name": "region_connection_rule", "args": [...]}`
- Location access rules now correctly use `{"type": "helper", "name": "location_rule", "args": [...]}`
- All rules are properly evaluable by the JavaScript frontend

**Files Modified:**
- exporter/games/celeste64.py

**Testing:**
Verified by examining exported rules.json and confirmed by passing spoiler tests.
