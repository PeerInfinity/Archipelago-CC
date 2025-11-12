# Remaining Exporter Issues for Landstalker

This file tracks unresolved issues with the Landstalker exporter.

## Issue 1: Shop Item Rules Not Analyzed (Low Priority)

**Status**: Not fixed - but shop item rules are optional for basic progression

**Description**: The analyzer cannot handle complex shop item rules that use list comprehensions to check for duplicates within the same shop.

**Error Messages**:
```
Failed to analyze left or right side of comparison: Compare(left=Attribute(value=Name(id='item', ctx=Load()), attr='name', ctx=Load()), ops=[NotIn()], comparators=[ListComp(...)])
Failed to analyze or expand rule for LocationItemRule 'Massan: Shop item #1 Item Rule' using runtime analysis.
```

**Affected Locations**: All shop locations (Massan, Gumi, Ryuma, Mercator, Verla, Destel, Kazalt, etc.)

**Python Code** (Rules.py:108-117):
```python
def make_shop_location_requirement_lambda(player: int, location: LandstalkerLocation):
    other_locations_in_shop = [loc for loc in location.parent_region.locations if loc != location]
    return lambda item: \
        item.player != player \
        or (" Gold" not in item.name
            and item.name not in [loc.item.name for loc in other_locations_in_shop if loc.item is not None])
```

**Impact**: These rules prevent duplicate items within the same shop. Without them, the frontend might allow logically invalid item placements. However, this doesn't affect progression logic since shop locations are still accessible.

**Solution Needed**: Custom exporter handling for this pattern or allow-self-locking-items feature.

## Issue 2: Unresolved Variable References in Region Visit Checks

**Status**: Partially fixed with workaround

**Description**: Some `_landstalker_has_visited_regions` calls have unresolved variable references that the static analyzer cannot resolve.

**Example**:
```json
{
  "type": "helper",
  "name": "_landstalker_has_visited_regions",
  "args": [{"type": "name", "name": "required_regions"}]
}
```

**Current Workaround**: The JavaScript helper treats `undefined` (unresolved) as "no regions required" (always pass).

**Impact**: Some exits that require visiting specific regions first may be accessible earlier than intended. This appears to be causing the Witch Helga's Hut accessibility issue (test fails at sphere 1.2).

**Proper Solution**: Extract actual required region data from the world path data during export and embed it in the rules as constants.
