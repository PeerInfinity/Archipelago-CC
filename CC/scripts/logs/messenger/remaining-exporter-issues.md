# The Messenger - Remaining Exporter Issues

## Issue 1: Location Dependency Pattern Not Handled

**Status**: In Progress

**Test Failure**:
- Sphere 1.2 mismatch
- Locations not accessible: "Ninja Village - Candle" and "Searing Crags - Astral Tea Leaves"
- Error: `Name "state" NOT FOUND in context`

**Root Cause**:
The Python code uses a location-to-location dependency pattern:
```python
"Ninja Village - Candle": lambda state: state.multiworld.get_location("Searing Crags - Astral Tea Leaves", self.player).can_reach(state)
"Searing Crags - Astral Tea Leaves": lambda state: state.multiworld.get_location("Ninja Village - Astral Seed", self.player).can_reach(state)
```

This is being exported as:
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {
      "type": "function_call",
      "function": {
        "type": "attribute",
        "object": {
          "type": "attribute",
          "object": {
            "type": "name",
            "name": "state"
          },
          "attr": "multiworld"
        },
        "attr": "get_location"
      },
      "args": [{"type": "constant", "value": "Searing Crags - Astral Tea Leaves"}]
    },
    "attr": "can_reach"
  },
  "args": []
}
```

The `{"type": "name", "name": "state"}` reference cannot be evaluated by the frontend.

**Solution**:
The exporter needs to recognize the pattern `state.multiworld.get_location(location_name, player).can_reach(state)` and convert it to a location dependency check that the frontend can understand. This could be:
1. A new rule type like `{"type": "location_check", "location": "location_name"}`
2. Or simplify to `{"type": "constant", "value": true}` if the location is in the same region graph
3. Or create a special location accessibility rule

**Files**:
- `worlds/messenger/rules.py` lines 228-230, 256-257
- `exporter/games/messenger.py` (needs fix)
- Frontend rule engine may need support for new rule type
