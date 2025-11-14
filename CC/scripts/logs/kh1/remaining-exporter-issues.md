# Remaining Exporter Issues

## Issue 1: Python False exported as 0 instead of false

**Status**: Identified
**Sphere**: 4.6
**Failing Locations**:
- Agrabah Cave of Wonders Entrance Tall Tower Chest
- Agrabah Main Street High Above Palace Gates Entrance Chest
- Agrabah Palace Gates High Close to Palace Chest
- Halloween Town Guillotine Square High Tower Chest

**Problem**: The exporter is converting Python boolean `False` to JSON number `0` instead of JSON boolean `false`. This causes the rule engine's AND operator to not short-circuit correctly.

**Example from rules.json**:
```json
{
  "type": "and",
  "conditions": [
    { "type": "constant", "value": 0 },  // Should be false, not 0
    { "type": "item_check", "item": "Combo Master" }
  ]
}
```

**Expected**:
```json
{
  "type": "constant",
  "value": false  // Boolean, not number
}
```

**Impact**: Locations with `False AND something` become accessible when they shouldn't be, because the AND operator checks `conditionResult === false` which doesn't match the number `0`.

**Fix Location**: Fixed in rule engine instead - now handles falsy values correctly.

**Status**: Resolved via rule engine fix

## Issue 2: Helper function calls not being recognized

**Status**: Identified
**Sphere**: 10.3
**Failing Location**: Traverse Town Magician's Study Obtained All LV1 Magic

**Problem**: The exporter is not recognizing `has_all_magic_lvx(state, player, 1)` as a helper function call and is instead exporting the internal `state.has_all_counts()` call as a state_method.

**Exported (incorrect)**:
```json
{
  "type": "state_method",
  "method": "has_all_counts",
  "args": []
}
```

**Expected**:
```json
{
  "type": "helper",
  "name": "has_all_magic_lvx",
  "args": [{"type": "constant", "value": 1}]
}
```

**Python source** (worlds/kh1/Rules.py:944):
```python
add_rule(kh1world.get_location("Traverse Town Magician's Study Obtained All LV1 Magic"),
    lambda state: has_all_magic_lvx(state, player, 1))
```

**JavaScript helper**: Already exists in `frontend/modules/shared/gameLogic/kh1/kh1Logic.js:373`

**Impact**: Location is not accessible when it should be at Sphere 10.3 (when Progressive Thunder is obtained).

**Fix Location**: Need to update the exporter to recognize helper function calls defined in the same module (Rules.py) and export them as helper nodes instead of trying to inline them.

