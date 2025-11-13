# Pokemon Red and Blue - Remaining Exporter Issues

This file tracks exporter-related issues that still need to be fixed.

## Issues

### Issue 1: world.options expressions in entrance rules not resolved

**Symptom:** Safari Zone and Fuchsia City are not reachable at Sphere 3.9, blocking 82 locations

**Root Cause:** The Route 13 -> Route 13-E entrance has a rule with `not world.options.extra_strength_boulders.value`, which is exported as:
```json
{
  "type": "not",
  "condition": {
    "type": "attribute",
    "object": {"type": "attribute", "object": {"type": "attribute", "object": {"type": "name", "name": "world"}, "attr": "options"}, "attr": "extra_strength_boulders"},
    "attr": "value"
  }
}
```

The `"name": "world"` reference is undefined in JavaScript context, causing evaluation to fail.

**Python Source:**
```python
connect(multiworld, player, "Route 13", "Route 13-E", lambda state: logic.can_strength(state, world, player) or logic.can_surf(state, world, player) or not world.options.extra_strength_boulders.value)
```

**Expected Export:**
```json
{
  "type": "or",
  "conditions": [
    {"type": "helper", "name": "can_strength", "args": []},
    {"type": "helper", "name": "can_surf", "args": []},
    {"type": "constant", "value": true}  // or false, depending on the option value
  ]
}
```

**Fix Needed:**
1. Extend the expression resolver to handle `not` unary operations
2. Resolve `world.options.*.value` expressions to constants in ALL contexts (not just helper args)
3. Apply resolution recursively to nested expressions in logical operators (and, or, not)
