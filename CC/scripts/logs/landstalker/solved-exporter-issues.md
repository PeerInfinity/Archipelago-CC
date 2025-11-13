# Solved Exporter Issues

## Issue 1: Unresolved `required_regions` variable references in access rules

**Problem**: Lambda parameters containing lists of Region objects were not being resolved during rule export, resulting in `{"type": "name", "name": "required_regions"}` references in the rules.json file instead of the actual region codes.

**Root Cause**: The `visit_Name` method in `exporter/analyzer/ast_visitors.py` did not handle lists of objects. When encountering a closure variable that was a list of `LandstalkerRegion` objects, it would fall through to returning a name reference instead of resolving the list contents.

**Solution**: Added list handling to the `visit_Name` method in `exporter/analyzer/ast_visitors.py` (lines 607-630). The code now:
1. Checks if the closure variable is a list
2. Iterates through each item in the list
3. Extracts the `code` attribute from Region objects (like `LandstalkerRegion`)
4. Returns the serialized list as a constant value

**Result**: Access rules like `route_gumi_ryuma -> helga_hut` now correctly export with resolved region codes:
```json
{
  "type": "helper",
  "name": "_landstalker_has_visited_regions",
  "args": [{
    "type": "constant",
    "value": ["massan"]
  }]
}
```

**Files Changed**:
- `exporter/analyzer/ast_visitors.py`

**Test Impact**: Witch Helga's Hut is now reachable at Sphere 1.2 (previously failed). Tests now progress to Sphere 2.1.

