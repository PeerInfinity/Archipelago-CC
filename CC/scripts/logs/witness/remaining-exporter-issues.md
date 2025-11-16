# The Witness - Remaining Exporter Issues

This file tracks unresolved issues with the exporter (exporter/games/witness.py).

## Issues

### 1. all_of Iterator Contains Unanalyzed Bound Methods

**Severity**: High
**Test Status**: Failing at Sphere 0 - 1 location mismatch

**Description**: Some locations use `all_of` comprehension patterns where the iterator contains lists of `region.can_reach` bound methods. These should be analyzed and converted to rules, but instead they're being exported as string representations.

**Failing Location**: Keep Laser Activated

**Example**:
```json
{
  "type": "all_of",
  "element_rule": {"type": "helper", "name": "condition", "args": []},
  "iterator_info": {
    "type": "comprehension_details",
    "target": {"type": "name", "name": "condition"},
    "iterator": {
      "type": "constant",
      "value": [
        "<bound method Region.can_reach of Keep 4th Maze>",
        "<bound method Region.can_reach of Keep Tower>",
        ...
      ]
    }
  }
}
```

**Root Cause**: The analyzer converts bound method objects to their string representation when they appear in lists/iterators, rather than recursively analyzing them.

**Impact**: Locations like "Keep Laser Activated" cannot be properly evaluated because the iterator contains unparseable strings instead of rules.

**Note**: This issue was uncovered after fixing issue #2 below. The Keep Laser rule uses OR with multiple all_of patterns that depend on region reachability.
