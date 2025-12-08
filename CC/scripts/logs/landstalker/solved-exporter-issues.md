# Landstalker - Solved Exporter Issues

## Issue 1: Unresolved `all_of` iterator with `event_visited_` pattern

**Date Fixed:** 2025-12-08

**Symptom:**
- Test failed at Sphere 1.2
- Region "Witch Helga's Hut" was not reachable in state but was expected to be accessible
- Error: `Regions accessible in LOG but NOT in STATE: Witch Helga's Hut`

**Root Cause:**
The exporter was not properly resolving the `all_of` pattern when the iterator was already a constant list (e.g., `{"type": "constant", "value": ["Massan"]}`). The `_resolve_all_of_iterator` method only handled the case where the iterator was an unresolved `name` type reference.

The Python code pattern was:
```python
def _landstalker_has_visited_regions(state, player, regions):
    return all(state.has("event_visited_" + region.code, player) for region in regions)
```

This was exported as:
```json
{
  "type": "all_of",
  "element_rule": {
    "type": "item_check",
    "item": {
      "type": "binary_op",
      "left": {"type": "constant", "value": "event_visited_"},
      "op": "+",
      "right": {"type": "attribute", "object": {"type": "name", "name": "region"}, "attr": "code"}
    }
  },
  "iterator_info": {
    "iterator": {"type": "constant", "value": ["Massan"]}
  }
}
```

The rule engine couldn't evaluate this because:
1. The iterator value contained region NAMES ("Massan") not CODES ("massan")
2. The element_rule tried to access `.code` on each element, but they were just strings

**Fix:**
Updated `exporter/games/landstalker.py`:

1. Added `_is_event_visited_pattern()` method to detect the `event_visited_` + `.code` binary_op pattern
2. Added `_normalize_region_codes()` method to convert region names to codes (lowercase, replace spaces with underscores, etc.)
3. Added `_build_event_visited_conditions()` helper to create the resolved conditions
4. Updated `_resolve_all_of_iterator()` to handle constant list iterators when the event_visited pattern is detected

**Result:**
The access rule for Witch Helga's Hut is now correctly exported as:
```json
{
  "type": "and",
  "conditions": [
    {"type": "item_check", "item": "Einstein Whistle"},
    {"type": "item_check", "item": "event_visited_massan"}
  ]
}
```

**Files Changed:**
- `exporter/games/landstalker.py`
