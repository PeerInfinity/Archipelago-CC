# OSRS Solved Exporter Issues

## Issue 1: NamedTuple attribute access not resolved (SOLVED)

**Status**: Solved on 2025-12-08

**Description**: The exporter was generating rules with unresolved NamedTuple attribute accesses. For example, `location_row.qp` where `location_row` is a `LocationRow` NamedTuple was exported as:

```json
{
  "type": "attribute",
  "object": {
    "type": "constant",
    "value": ["Total Level 150", "general", [], [], [], 2]
  },
  "attr": "qp"
}
```

Instead of being resolved to:
```json
{
  "type": "constant",
  "value": 2
}
```

**Root Cause**: In `exporter/analyzer/ast_visitors.py`, the `visit_Name` method checked for `isinstance(value, (list, tuple))` BEFORE checking for NamedTuples with `hasattr(value, '_fields')`. Since NamedTuples ARE tuples (they inherit from tuple), they were serialized as arrays before the NamedTuple check was reached.

**Solution**: Moved the NamedTuple check (`hasattr(value, '_fields')`) to BEFORE the general tuple/list check (`isinstance(value, (list, tuple))`) in the `visit_Name` method. This ensures NamedTuples are recognized and kept as name references so their attributes can be properly resolved later in `visit_Attribute`.

**Files Changed**:
- `exporter/analyzer/ast_visitors.py` - Reordered the type checks in `visit_Name` method (around line 1279-1291)

**Affected Locations** (now fixed): Any location with `qp` (quest point) requirements:
- "Total Level 150"
- "Activate the \"Protect Item\" Prayer"
- "Cut a Ruby"
- "Kill a Hill Giant"
- And many others

**Verification**: Test passed - all 65 spheres completed successfully with no mismatches.

---
