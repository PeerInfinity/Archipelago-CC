# The Messenger - Solved Exporter Issues

## Issue 1: can_afford variable not expanded to actual item check

**Status**: FIXED ✓
**Fixed in**: exporter/games/messenger.py
**Test Progress**: Sphere 0 → Sphere 1.2

### Problem

Shop locations used a `can_afford` local variable in their access_rule method, which was being exported as a helper function call instead of being expanded to the actual item check logic.

### Solution Implemented

1. **Custom Access Rules**: Implemented `get_custom_location_access_rule()` method to detect shop locations (those with a `cost` attribute) and generate custom `item_check` rules for "Shards" with `count = min(cost, total_shards)`.

2. **Progression Mapping**: Implemented `get_progression_mapping()` method to export a progression mapping that accumulates Time Shard item values into a virtual "Shards" counter:

```python
{
  "Shards": {
    "type": "additive",
    "items": {
      "Time Shard": 1,
      "Time Shard (10)": 10,
      "Time Shard (50)": 50,
      "Time Shard (100)": 100,
      "Time Shard (300)": 300,
      "Time Shard (500)": 500
    },
    "base_item": "Shards"
  }
}
```

### Impact

- Shop locations now correctly require collecting Time Shards before becoming accessible
- Test progressed from failing at Sphere 0 (19 locations incorrectly accessible) to failing at Sphere 1.2 (13 spheres passing)
- This represents significant progress in game logic accuracy
