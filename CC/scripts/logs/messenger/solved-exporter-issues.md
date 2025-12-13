# Solved Exporter Issues - The Messenger

**Last Updated**: 2025-12-13

## Issue 1: state_method has_any/has_all not handling "set" type arguments

### Problem Description

The exporter had logic to convert `state_method` `has_any` and `has_all` rules to `or`/`and` rules with `item_check` conditions, but it only handled arguments with `type: "constant"` containing a list value.

When Python code like `state.has_any({"Path of Resilience", "Meditation"}, self.player)` was exported, it produced a rule with a `set` type argument:

```json
{
  "type": "state_method",
  "method": "has_any",
  "args": [
    {
      "type": "set",
      "elements": [
        {"type": "constant", "value": "Meditation"},
        {"type": "constant", "value": "Path of Resilience"}
      ]
    }
  ]
}
```

This caused test failures at Sphere 4.3 for:
- "Riviere Turquoise Seal - Bounces and Balls"
- "Searing Crags Seal - Triple Ball Spinner"

Both locations use `can_dboost` which relies on `state.has_any({"Path of Resilience", "Meditation"}, player)`.

### Root Cause

The messenger.py exporter's conversion logic (lines 147-177) only matched the pattern:
```python
if items_arg.get('type') == 'constant' and isinstance(items_arg.get('value'), list):
```

This didn't match the `set` type that Python sets are exported as.

### Fix Applied

Added a helper method `_extract_items_from_arg()` to handle both formats:
1. `{"type": "constant", "value": ["item1", "item2", ...]}` - list as direct value
2. `{"type": "set", "elements": [{"type": "constant", "value": "item1"}, ...]}` - set with element array

The helper extracts item names from either format, and the `has_any`/`has_all` conversion logic now uses this helper.

### Files Modified

- `exporter/games/messenger.py`: Added `_extract_items_from_arg()` method and updated `expand_rule()` to use it

### Verification

After fix, the rules.json correctly converts the `state_method` rule to:

```json
{
  "type": "or",
  "conditions": [
    {"type": "item_check", "item": {"type": "constant", "value": "Meditation"}},
    {"type": "item_check", "item": {"type": "constant", "value": "Path of Resilience"}}
  ]
}
```

All 52 spheres now pass the spoiler test.
