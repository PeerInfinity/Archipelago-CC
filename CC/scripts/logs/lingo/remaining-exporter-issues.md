# Remaining Exporter Issues for Lingo

## Issue 1: PlayerLocation serialization in lingo_can_use_location

**Status:** Identified
**Type:** Object serialization
**Priority:** Medium

**Description:**
The `lingo_can_use_location` helper function is being called with a PlayerLocation object that's not serializing properly. The location object contains an AccessRequirements object with the actual access logic.

**Current State:**
The location access rule is exporting as:
```json
{
  "type": "helper",
  "name": "lingo_can_use_location",
  "args": [
    {
      "type": "constant",
      "value": ["Starting Room - HI", 444400, "rooms=set("]
    }
  ]
}
```

The third element `"rooms=set("` is a partial string representation of the AccessRequirements object, which indicates improper serialization.

**Root Cause:**
The `make_location_lambda` function creates lambdas like:
```python
return lambda state: lingo_can_use_location(state, location, world)
```

Where `location` is a PlayerLocation object with complex nested data (AccessRequirements) that the analyzer is struggling to serialize properly.

**Impact:**
- Location access rules may not evaluate correctly
- Currently mitigated by placeholder helper function returning `true`
- Causes too many locations to be accessible (136 extra locations in Sphere 0)
- Causes 114 extra regions to be accessible

**Potential Solutions:**
1. Inline the `_lingo_can_satisfy_requirements` logic instead of calling helper
2. Export AccessRequirements data as separate game data structure
3. Modify how location access rules are created in Lingo world to use simpler structures
4. Add custom serialization for PlayerLocation and AccessRequirements objects

**Notes:**
The door variable issue has been solved (see solved-exporter-issues.md). This is the next issue to tackle, though it's lower priority since the helper function infrastructure is in place.
