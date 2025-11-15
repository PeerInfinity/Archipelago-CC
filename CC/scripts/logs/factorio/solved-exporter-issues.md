# Solved Exporter Issues for Factorio

This file tracks exporter issues that have been resolved.

## Issue 1: Missing region field in location export

**Severity:** Critical
**Fixed in:** Current commit
**File:** `exporter/exporter.py:1157-1158`

### Problem

Locations were not being exported with a `region` or `parent_region_name` field. This caused the JavaScript reachability engine to fail when checking if a location's parent region was reachable, because it would check `location.region` which was `null`.

### Solution

Added both `region` and `parent_region_name` fields to location_data in the exporter:

```python
location_data = {
    'name': location_name,
    'id': location_name_to_id.get(location_name, None),
    'access_rule': access_rule_result,
    'item_rule': item_rule_result,
    'item': None,
    'region': region.name,  # Add region reference for reachability checking
    'parent_region_name': region.name  # Alternative field name for compatibility
}
```

### Impact

This fix ensures that all locations have their parent region properly set, allowing the reachability engine to correctly determine if a location is accessible based on whether its parent region is reachable.

**Note:** This fix alone did not resolve all test failures. The test still fails at the same point, suggesting there's another issue preventing locations from being checked.
