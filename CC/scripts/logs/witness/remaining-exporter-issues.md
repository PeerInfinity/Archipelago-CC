# Remaining Exporter Issues for The Witness

## Issue 1: Keep Laser Activated has bound method strings in iterator

**Status**: Active
**Priority**: High
**Category**: Exporter

**Description**:
Keep Laser Activated has an `all_of` comprehension with an iterator containing string representations of bound methods (e.g., `"<bound method Region.can_reach of Keep>"`) instead of properly converted rules. This causes "Access rule evaluation failed" errors.

**Affected Locations**:
- Keep Laser Activated

**Example Access Rule** (Keep Laser Activated):
```json
{
  "type": "or",
  "conditions": [
    {
      "type": "all_of",
      "element_rule": {
        "type": "helper",
        "name": "condition",
        "args": []
      },
      "iterator_info": {
        "type": "comprehension_details",
        "target": {
          "type": "name",
          "name": "condition"
        },
        "iterator": {
          "type": "constant",
          "value": [
            "<bound method Region.can_reach of Keep>",
            "<bound method Region.can_reach of Keep 2nd Pressure Plate>",
            ...
          ]
        }
      }
    }
  ]
}
```

**Root Cause**:
The analyzer is capturing bound methods as string representations instead of analyzing them. When the Python code uses list comprehensions with callable conditions, the analyzer should recursively analyze each element.

**Expected Behavior**:
The iterator should contain a list of actual rule objects (like `can_reach_region` helper calls) instead of string representations.

**Fix Location**: `exporter/analyzer.py` - comprehension handling

**Fix Approach**:
1. When analyzing list/generator comprehensions, check if iterator elements are callable
2. For each callable in the iterator, analyze it to convert it to a proper rule
3. Convert Region.can_reach bound methods to can_reach_region helper calls
