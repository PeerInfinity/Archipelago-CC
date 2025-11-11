# Dark Souls III - Solved Exporter Issues

This document tracks resolved exporter issues for Dark Souls III.

## Resolved Issues

### _can_go_to Method Not Handled
**Issue**: The exporter's `postprocess_rule` method only converted `self._can_get()` calls to `location_check` rules, but didn't handle `self._can_go_to()` calls which check entrance/region reachability.

**Solution**: Extended the `postprocess_rule` method to also convert `self._can_go_to(region)` calls to `can_reach` rules.

**Implementation**: Added handling for the `_can_go_to` attribute in `postprocess_rule` method that converts it to:
```python
{
    'type': 'can_reach',
    'region': {'type': 'constant', 'value': region_name}
}
```

**Files Modified**: `exporter/games/dark_souls_3.py:194-206`

**Fixed**: 2025-11-11

---

Last updated: 2025-11-11
