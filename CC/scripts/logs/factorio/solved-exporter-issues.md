# Solved Exporter Issues for Factorio

This file tracks resolved issues with the Factorio exporter.

## Solved Issues

### Issue 1: Automated Items Incorrectly Marked as event=false

**Date Solved**: 2025-11-19

**Problem**: The exporter was marking "Automated" items (like "Automated automation-science-pack") with `event: false`, based on an incorrect understanding of how these items work in Factorio.

**Root Cause**: Lines 217-232 in exporter/games/factorio.py had logic that explicitly set `event: not is_automated_item` (i.e., event=False for Automated items), with a comment claiming these were "not true event items". This was incorrect.

**Solution**: Changed the exporter to treat ALL items with no code (item.code is None) as event items, setting `event: True` for them. This includes "Automated" items which are placed with `place_locked_item()` in the Python code and should be treated as event locations.

**Files Changed**:
- exporter/games/factorio.py lines 217-230

**Code Change**:
```python
# BEFORE:
is_automated_item = item_name.startswith('Automated ')
item_data[item_name] = {
    ...
    'event': not is_automated_item,  # False for Automated items, True for others
    ...
}

# AFTER:
item_data[item_name] = {
    ...
    'event': True,  # All items with no code are event items
    ...
}
```

**Testing**: After regeneration, verified that "Automated automation-science-pack" and "Automated logistic-science-pack" now have `event: True` in the rules.json file.

**Status**: Fix implemented and verified in generated data. However, spoiler test still fails, indicating there may be additional issues (possibly in the frontend/helper code or rule evaluation).
