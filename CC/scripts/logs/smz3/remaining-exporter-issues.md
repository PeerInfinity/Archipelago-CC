# SMZ3 Remaining Exporter Issues

## Issue 1: Medallion Entrance Rules Return None

**Priority:** High
**Status:** Not Started
**Location:** Menu->Misery Mire and Menu->Turtle Rock entrances

### Description
The entrance rules for Misery Mire and Turtle Rock are returning error rules with type "error" and message "Analysis did not produce a result structure (returned None)."

### Root Cause
The CanEnter methods for these dungeons use `self.Medallion` compared to enum values:

```python
def CanEnter(self, items: Progression):
    from ...WorldState import Medallion
    return (items.Bombos if self.Medallion == Medallion.Bombos else (
                items.Ether if self.Medallion == Medallion.Ether else items.Quake)) and items.Sword and \
        items.MoonPearl and (items.Boots or items.Hookshot) and \
        self.world.CanEnter("Dark World Mire", items)
```

The analyzer appears to be unable to handle the nested ternary conditional with `self.Medallion` enum comparisons and returns None.

### Files Affected
- `exporter/games/smz3.py` - SMZ3 game exporter
- `exporter/analyzer.py` - Rule analyzer (may need to handle enum comparisons)
- `worlds/smz3/TotalSMZ3/Regions/Zelda/MiseryMire.py:37-42` - Source Python code
- `worlds/smz3/TotalSMZ3/Regions/Zelda/TurtleRock.py:49-54` - Source Python code

### Proposed Solution
The exporter needs to handle the medallion requirement specially. Options:
1. **Add medallion resolution in the exporter**: Check the region's `Medallion` attribute and generate the appropriate rule directly
2. **Improve analyzer handling of enums**: Make the analyzer better at handling enum comparisons
3. **Use dungeon metadata**: Export medallion requirements as part of dungeon data and check it separately

### Expected Behavior
The entrance rules should correctly reflect the medallion requirement (Bombos, Ether, or Quake) along with the other access requirements (Sword, MoonPearl, Boots/Hookshot, and ability to enter the respective overworld region).

### Testing
After fix:
1. Run generation: `python Generate.py --weights_file_path "Templates/SMZ3.yaml" --multi 1 --seed 1`
2. Check that no error rules exist in rules.json
3. Verify the Misery Mire and Turtle Rock entrance rules are correct
4. Run spoiler test: `npm test --mode=test-spoilers --game=smz3 --seed=1`
