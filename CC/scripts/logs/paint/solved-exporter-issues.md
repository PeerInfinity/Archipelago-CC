# Paint Solved Exporter Issues

## Issue 1: max_count not accounting for starting items

**Date Resolved:** 2025-12-09

**Symptom:**
- Spoiler test failed at Sphere 11.2 for "Similarity: 79.5%" location
- Error: "Locations accessible in LOG but NOT in STATE"
- Paint calculation returned 79.37% instead of required 79.5%
- Inventory showed Red=6, Green=6, Blue=6 when it should be Red=7, Green=7, Blue=6

**Root Cause:**
The exporter's `max_count` calculation in `exporter/exporter.py` only counted items placed at locations (`multiworld.get_locations()`), but did NOT count items in `multiworld.precollected_items` (starting items).

Paint game has 1 of each Progressive Color Depth item as a starting item, plus 6 more at locations = 7 total. But the exporter only counted the 6 at locations, resulting in `max_count: 6` instead of `max_count: 7`.

When the stateManager's `_addItemToInventory` tried to add the 7th item, it was capped at `max_count: 6` and the item was not added.

**Fix:**
Added code to count starting items (from `multiworld.precollected_items`) when calculating `max_count` in `exporter/exporter.py` lines 1679-1687:

```python
# Also count starting items (precollected_items) since they contribute to max_count
# This is important for games like Paint where progressive items start with 1 copy
try:
    for starting_item in multiworld.precollected_items.get(player, []):
        if hasattr(starting_item, 'name'):
            item_name = starting_item.name
            placement_counts[item_name] = placement_counts.get(item_name, 0) + 1
except Exception as e:
    logger.warning(f"Could not count starting items for player {player}: {e}")
```

**Files Modified:**
- `exporter/exporter.py` - Added starting item counting to max_count calculation

**Verification:**
After regenerating the rules.json:
- `max_count` for all three color depth items is now 7
- Spoiler test passes with all 27 events processed
