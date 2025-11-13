# Pokemon Red and Blue - Remaining Exporter Issues

This file tracks exporter-related issues that still need to be fixed.

## Issues

### Issue 1: logic.oaks_aide() not converted to helper call

**Location:** Route 11 Gate 2F - Oak's Aide (and likely Route 2 Gate and Route 15 Gate 2F)

**Symptom:** Test fails at Sphere 3.7 with error:
- Name "logic" NOT FOUND in context
- Name "world" NOT FOUND in context
- Location "Route 11 Gate 2F - Oak's Aide" not accessible in STATE but is in LOG

**Root Cause:** The rule is exported as a function_call with references to `logic` and `world` variables:
```json
{
  "type": "function_call",
  "function": {"type": "attribute", "object": {"type": "name", "name": "logic"}, "attr": "oaks_aide"},
  "args": [{"type": "name", "name": "world"}, ...]
}
```

**Python Source:**
```python
"Route 11 Gate 2F - Oak's Aide": lambda state: logic.oaks_aide(state, world, world.options.oaks_aide_rt_11.value + 5, player)
```

**Fix Needed:**
1. Analyzer needs to recognize `logic.function_name(state, world, ...)` pattern as a helper call
2. Strip the `state`, `world`, and `player` arguments (implicit in JavaScript)
3. Resolve `world.options.oaks_aide_rt_11.value + 5` to a constant value during export
4. Convert to `{"type": "helper", "name": "oaks_aide", "args": [constant_value]}`

**Affected Locations:**
- Route 2 Gate - Oak's Aide
- Route 11 Gate 2F - Oak's Aide
- Route 15 Gate 2F - Oak's Aide
