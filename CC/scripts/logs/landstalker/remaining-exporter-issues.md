# Remaining Exporter Issues for Landstalker

This file tracks unresolved issues with the Landstalker exporter.

## Issue 1: Shop Item Rules Not Analyzed

**Status**: Not fixed yet

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

**Solution Needed**: Create a custom exporter that handles this pattern, possibly by:
- Creating a custom rule type for shop item restrictions
- Or simplifying the rule to something the analyzer can understand
- Or implementing a helper function to handle duplicate checking
