# MLSS Solved Exporter Issues

This document tracks solved exporter issues for Mario & Luigi Superstar Saga.

## Solved Issues

### Issue 1: Shop helpers should be inlined as can_reach rules (SOLVED)

**Error:** Region "Shop Chuckolator Flag" not reachable at Sphere 3.10
**Cause:** Shop helpers (`piranha_shop`, `fungitown_shop`, etc.) were being exported as helper references, but the JavaScript implementation couldn't check region reachability during the same BFS pass.

**Solution:** Modified `exporter/games/mlss.py` to expand shop helpers into `can_reach` rules:
```python
SHOP_HELPER_REGIONS = {
    'piranha_shop': 'Shop Mom Piranha Flag',
    'fungitown_shop': 'Shop Enter Fungitown Flag',
    'star_shop': 'Shop Beanstar Complete Flag',
    'birdo_shop': 'Shop Birdo Flag',
    'fungitown_birdo_shop': 'Fungitown Shop Birdo Flag',
}

def expand_helper(self, helper_name: str) -> Dict[str, Any]:
    if helper_name in self.SHOP_HELPER_REGIONS:
        return {'type': 'can_reach', 'region': self.SHOP_HELPER_REGIONS[helper_name]}
    return super().expand_helper(helper_name)
```

**Status:** SOLVED

---

### Issue 2: setting_value.value pattern causing undefined access (SOLVED)

**Error:** `postJokes` helper not receiving goal value correctly
**Cause:** In Python, `multiworld.goal[player].value` accesses the `.value` attribute of an Option object. The exporter was generating `{"type": "attribute", "object": {"type": "setting_value", "setting": "goal"}, "attr": "value"}` but `setting_value` already returns the raw value, making the `.value` access return undefined.

**Solution:** Added `_fix_setting_value_access` method to simplify `setting_value.value` to just `setting_value`:
```python
def _fix_setting_value_access(self, rule: Dict[str, Any]) -> Dict[str, Any]:
    if (rule.get('type') == 'attribute' and
        rule.get('attr') == 'value' and
        rule['object'].get('type') == 'setting_value'):
        return rule['object']  # Return setting_value directly
    # Recursively fix nested rules
    ...
    return rule
```

**Status:** SOLVED
