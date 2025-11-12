# Solved Exporter Issues for Lingo

## Issue 1: Door variable resolution from closures - SOLVED ✅

**Solution:** Added NamedTuple support to the analyzer

**Description:**
The exporter was not resolving the `door` variable from lambda closures. The door variable (a RoomAndDoor NamedTuple or None) was appearing as `{"type": "name", "name": "door"}` instead of being resolved to its actual value.

**Fix Applied:**
Modified `exporter/analyzer/ast_visitors.py` in the `visit_Name` method to detect and serialize NamedTuples:

```python
# Handle NamedTuples (like RoomAndDoor) by converting to list/dict
elif hasattr(value, '_fields'):
    # This is a NamedTuple - convert to a serializable format
    # Convert to list to preserve order
    serialized = list(value)
    logging.debug(f"visit_Name: Resolved '{name}' from closure to NamedTuple as list: {serialized}")
    return {'type': 'constant', 'value': serialized}
```

**Result:**
- Doors with value `None` are now properly resolved and the Lingo exporter simplifies them to `{"type": "constant", "value": true}`
- Doors with value `RoomAndDoor(room, door)` are now serialized as `{"type": "constant", "value": [room, door]}`
- The helper function receives the actual door data instead of an unresolved variable reference

**Example:**
Before:
```json
{
  "type": "helper",
  "name": "lingo_can_use_entrance",
  "args": [
    {"type": "constant", "value": "Starting Room"},
    {"type": "name", "name": "door"}  // Unresolved!
  ]
}
```

After (when door is None):
```json
{
  "type": "constant",
  "value": true
}
```

After (when door is RoomAndDoor("Starting Room", "Back Right Door")):
```json
{
  "type": "helper",
  "name": "lingo_can_use_entrance",
  "args": [
    {"type": "constant", "value": "Hidden Room"},
    {"type": "constant", "value": ["Starting Room", "Back Right Door"]}  // Resolved!
  ]
}
```

**Files Modified:**
- `exporter/analyzer/ast_visitors.py` - Added NamedTuple handling in `visit_Name` method

**Date Solved:** 2025-11-12
