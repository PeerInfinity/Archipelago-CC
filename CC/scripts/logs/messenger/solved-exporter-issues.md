# The Messenger - Solved Exporter Issues

This document tracks resolved issues with the rules.json exporter for The Messenger.

## Solved Issues

### 1. state_method has_any/has_all rules not handled correctly by frontend

**Date Fixed**: 2025-12-11

**Symptoms**:
- Two locations failed at Sphere 4.3: "Riviere Turquoise Seal - Bounces and Balls" and "Searing Crags Seal - Triple Ball Spinner"
- Error message: "Access rule evaluation failed"
- Both locations use `can_dboost` rule which requires `has_any(["Meditation", "Path of Resilience"]) AND has("Second Wind")`

**Root Cause**:
The generic analyzer was producing `state_method` rules with `has_any` method, but the frontend's `executeStateManagerMethod` wasn't correctly evaluating these rules. The exporter had a capability handler for `dboost` that produces the correct rule format, but it wasn't being triggered.

**Solution**:
Added expansion logic in `exporter/games/messenger.py` `expand_rule()` method to convert:
- `state_method has_any` → `or` with `item_check` for each item
- `state_method has_all` → `and` with `item_check` for each item

**Code Changes**:
```python
# In expand_rule() method:
if rule.get('type') == 'state_method':
    method = rule.get('method')
    args = rule.get('args', [])

    if method == 'has_any' and args:
        items_arg = args[0]
        if items_arg.get('type') == 'constant' and isinstance(items_arg.get('value'), list):
            items = items_arg.get('value')
            return {
                'type': 'or',
                'conditions': [
                    {'type': 'item_check', 'item': {'type': 'constant', 'value': item_name}}
                    for item_name in items
                ]
            }
```

**Affected Locations**:
- Riviere Turquoise Seal - Bounces and Balls
- Searing Crags Seal - Triple Ball Spinner
- Sunken Shrine - Key of Love (uses has_all)

