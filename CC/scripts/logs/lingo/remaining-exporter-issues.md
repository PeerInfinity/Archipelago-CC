# Remaining Exporter Issues for Lingo

## Issue 1: Door variable not resolved from closure in lingo_can_use_entrance

**Status:** Investigated - complex issue
**Type:** Variable resolution / serialization
**Priority:** Critical

**Description:**
The exporter is not resolving the `door` variable from lambda closures when exporting entrance access rules. The variable appears as `{"type": "name", "name": "door"}` in the exported JSON instead of being resolved to its actual value.

**Python Code:**
```python
# In worlds/lingo/regions.py
connection.access_rule = lambda state: lingo_can_use_entrance(state, target_region.name, door, world)
```

Where `door` is a RoomAndDoor NamedTuple or None captured in the closure.

**Exported JSON:**
```json
{
  "type": "helper",
  "name": "lingo_can_use_entrance",
  "args": [
    {"type": "constant", "value": "Starting Room"},
    {"type": "name", "name": "door"}  // <-- Unresolved variable reference
  ]
}
```

**Root Cause:**
1. The analyzer extracts closure variables (`door`) from the lambda
2. The `door` variable is a RoomAndDoor NamedTuple which cannot be directly serialized to JSON
3. The analyzer returns it as a `name` reference instead of resolving it
4. The frontend cannot resolve this variable because it doesn't have access to Python closure context

**Attempted Solutions:**
1. ✅ Created frontend helper functions (placeholder implementation)
2. ✅ Added Lingo exporter with `_resolve_door_variables` method (but doesn't have access to closure vars in `expand_rule`)
3. ❌ Tried to serialize RoomAndDoor NamedTuple (complex, needs custom serialization)
4. ❌ Tried to inline helper function logic (requires significant refactoring)

**Impact:**
- All entrance access rules with `lingo_can_use_entrance` fail to evaluate properly
- 37 regions are not accessible in Sphere 0
- Test completely fails at the first state update

**Next Steps:**
1. Investigate if we can add a hook in the exporter that has access to closure variables during analysis
2. Add custom serialization for RoomAndDoor NamedTuple in the analyzer
3. Consider inlining the `lingo_can_use_entrance` logic instead of keeping it as a helper call
4. Alternatively, modify how regions/entrances are created in Lingo to avoid closure variables
