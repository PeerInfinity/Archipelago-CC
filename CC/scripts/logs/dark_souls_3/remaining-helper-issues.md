# Remaining Helper Issues

## Issue 1: _can_get Helper Implementation Incorrect

**Error Message:**
```
REGION MISMATCH found for: {"type":"state_update","sphere_number":"0.4","player_id":"1"}
> Regions accessible in LOG but NOT in STATE: Undead Settlement
```

**Description:**
The `_can_get` helper has been added and is now recognized, but it's not working correctly. The current implementation checks if a location is in the `accessibleLocations` array, but this doesn't work for entrance rules because we're evaluating the entrance rule BEFORE the location has been added to accessible locations.

The entrance to Undead Settlement requires:
```json
{
  "type": "and",
  "conditions": [
    { "type": "item_check", "item": "Small Lothric Banner" },
    { "type": "helper", "name": "_can_get", "args": ["HWL: Soul of Boreal Valley Vordt"] }
  ]
}
```

The `_can_get` helper needs to check if the location's access rule evaluates to true given the current state, NOT just check if it's already in the accessible locations list.

**Impact:**
- Region "Undead Settlement" is not reachable
- Test fails at Sphere 0.4
- REGION MISMATCH: Regions accessible in LOG but NOT in STATE

**Priority:** Critical

**Status:** In progress

**Potential Solution:**
The `_can_get` helper should:
1. Find the location in staticData
2. Evaluate the location's access_rule using the current snapshot
3. Return true if the access rule evaluates to true

