# Solved Exporter Issues - Secret of Evermore

## Fixed: Missing Item Fields (event, type, max_count)
**Date:** 2025-11-16
**File:** exporter/games/soe.py
**Impact:** Items were missing required fields that the StateManager expects

**Problem:**
The SOE exporter's `get_item_data()` method was returning item dictionaries without the standard fields that all items need:
- `event`: Boolean indicating if this is an event item
- `type`: Item type classification
- `max_count`: Maximum count of this item

This caused 160 out of 167 items to be missing these fields.

**Solution:**
Added code to set default values for these fields when creating item data:
```python
# Add standard item fields that all items need
# These ensure compatibility with the state manager
if 'event' not in item_data[item.name]:
    item_data[item.name]['event'] = False
if 'type' not in item_data[item.name]:
    item_data[item.name]['type'] = None
if 'max_count' not in item_data[item.name]:
    item_data[item.name]['max_count'] = 1
```

**Location:** exporter/games/soe.py:152-159

**Verification:** After the fix, all 167 items have all required fields.
