# Solved Exporter Issues - Stardew Valley

This document tracks resolved issues in the Stardew Valley exporter.

## Solved Issues

### 1. Received rule with count=0 serialized incorrectly

**Issue**: When a `Received` rule had `count=0` (meaning "has at least 0 items", which is always true), the exporter was serializing it as an `item_check` requiring 1 item instead of a constant true.

**Symptoms**:
- Mine floor regions (Floor 5, Floor 10) were not accessible when they should be
- Test failed at Sphere 0.2 with "Region The Mines - Floor 5 is not reachable"

**Root Cause**: In `exporter/games/stardew_valley.py`, the `_serialize_stardew_rule` method for `Received` rules only added a count when `count > 1`. When count was 0, it created an item_check without count (defaulting to 1 in frontend).

For the elevator check at floor 5:
- `has_mine_elevator_to_floor(5 - 10)` = `has_mine_elevator_to_floor(-5)`
- Negative floor clamped to 0: `received("Progressive Mine Elevator", 0 // 5)` = `received("...", 0)`
- Having 0 of any item is always true, but was exported as requiring 1

**Fix**: Added check for `count == 0` in `_serialize_stardew_rule` to return `{"type": "constant", "value": true}`.

**Code change** (`exporter/games/stardew_valley.py`):
```python
# Handle Received rule (most common)
if rule_type == 'Received':
    # Check for count=0 first - "has at least 0 items" is always true
    if hasattr(rule_obj, 'count') and rule_obj.count == 0:
        return {'type': 'constant', 'value': True}

    result = {
        'type': 'item_check',
        'item': rule_obj.item
    }
    if hasattr(rule_obj, 'count') and rule_obj.count > 1:
        result['count'] = {'type': 'constant', 'value': rule_obj.count}
    return result
```

**Date Fixed**: 2025-11-26
