# Solved Exporter Issues for Lingo

## Issue 1: RoomAndDoor namedtuple serialization format

**Status:** SOLVED

**Date Fixed:** 2026-01-02

**Description:**
The `RoomAndDoor` namedtuple was being serialized in the rules.json as:
```json
{"_namedtuple_type": "RoomAndDoor", "_namedtuple_fields": ["room", "door"], "_namedtuple_values": ["Starting Room", "Back Right Door"]}
```

But the JavaScript `lingo_can_use_entrance` helper expected an array format:
```json
["Starting Room", "Back Right Door"]
```

**Error Message (before fix):**
```
[lingo_can_use_entrance] Invalid door format: {"_namedtuple_type":"RoomAndDoor"...
```

**Impact:**
All exit rules failed to evaluate, causing all regions to be unreachable.

**Root Cause:**
The `make_json_serializable` function in `exporter/analyzer/utils.py` preserves namedtuple metadata for code generation purposes. This worked well for most cases, but Lingo's `RoomAndDoor` objects needed to be converted to simple arrays for the JavaScript helper to work.

**Solution:**
Added `_convert_namedtuples_to_arrays` method in `exporter/games/lingo.py` that recursively finds and converts `RoomAndDoor` namedtuple objects to arrays in the `expand_rule` method.

**Files Modified:**
- `exporter/games/lingo.py`

**Test Results After Fix:**
- All 12 spheres passed
- No errors or mismatches
