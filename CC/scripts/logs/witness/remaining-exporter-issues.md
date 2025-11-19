# Remaining Exporter Issues for The Witness

## Issue 1: Region reachability patterns not fully converted in laser activation locations

**Status**: Active
**Priority**: High
**Category**: Exporter

**Description**:
Some laser activation locations (Desert, Keep, Shadows) have access rules containing region reachability patterns that are not being converted to `can_reach_region` helper calls. These patterns appear nested inside `and` rules and cause "Access rule evaluation failed" errors.

**Affected Locations**:
- Desert Laser Activated
- Desert Laser Panel
- Keep Laser Activated
- Keep Laser Panel Hedges
- Shadows Laser Activated
- Shadows Laser Panel
- Shadows Intro 8
- Shadows Near 5
- Shadows Far 8
- Orchard Apple Tree 5

**Example Access Rule** (Desert Laser Activated):
```json
{
  "type": "and",
  "conditions": [
    {
      "type": "conditional",
      "test": { "type": "subscript", "value": { "type": "attribute", "object": { "type": "name", "name": "state" }, "attr": "stale" }, ... },
      "if_true": { "type": "state_method", "method": "update_reachable_regions", ... },
      "if_false": { "type": "compare", "left": { "type": "name", "name": "self" }, "op": "in", ... }
    },
    { ... same pattern repeated ... }
  ]
}
```

**Root Cause**:
The `postprocess_rule()` method in `exporter/games/witness.py` only checks if the top-level rule matches the region reachability pattern. When the pattern is nested inside compound rules (like `and`), it's not detected and converted.

**Expected Behavior**:
The exporter should recursively process compound rules to find and simplify region reachability patterns, then convert them to `can_reach_region` helper calls.

**Fix Location**: `exporter/games/witness.py:230` (postprocess_rule method)

**Fix Approach**:
1. Update `postprocess_rule` to first call `_simplify_region_reachability_pattern` to recursively simplify the rule
2. After simplification, check if the result is a single region reachability pattern that can be converted to a helper call
3. This will handle both direct patterns and patterns nested in compound rules
