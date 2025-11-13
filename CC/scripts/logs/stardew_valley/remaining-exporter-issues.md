# Remaining Exporter Issues - Stardew Valley

This file tracks remaining issues with the Stardew Valley exporter.

## Issues

### Issue 1: Null Access Rules for Locations

**Priority**: High → Low (mostly resolved)
**Status**: Mostly Resolved ✅ (472/480 locations fixed, 8 remaining)
**Sphere**: 0

**Description**:
~~480 locations~~ → **8 locations** have incorrect access rules. Major progress achieved through StardewRule serialization implementation.

**Fixed**: 472 locations now have proper access rules
**Remaining**: 8 locations still show as accessible when they shouldn't be:
- Read Mapping Cave Systems
- Copper Ore (Logic event)
- Iron Ore (Logic event)
- Gold Ore (Logic event)
- Well Blueprint
- Complete Community Center
- Carnival Bundle
- Egg Festival: Strawberry Seeds

**Examples**:
- Level 1-10 Farming (should require farming skill levels)
- Level 1-10 Foraging (should require foraging skill levels)
- Level 1-10 Fishing (should require fishing skill levels)
- Level 1-10 Mining (should require mining skill levels)
- Level 1-10 Combat (should require combat skill levels)
- Various quest locations
- Bundle locations
- Shop purchases
- Event locations

**Root Cause - DETAILED ANALYSIS**:

Stardew Valley uses a custom rule system based on `StardewRule` objects instead of Python lambda functions. This is fundamentally incompatible with the current analyzer in `exporter/analyzer/source_extraction.py`.

The analyzer expects rules to be lambdas or regular Python functions, which it can inspect using `inspect.getsource()` and parse with AST. However, Stardew Valley's rules are custom objects from classes like:

- `Received(item, player, count)` - Checks if player has received an item
- `Reach(spot, resolution_hint, player)` - Checks if player can reach a region
- `TotalReceived(count, items, player)` - Checks total count of multiple items
- `And(*rules)` - Logical AND of multiple rules
- `Or(*rules)` - Logical OR of multiple rules
- `Has`, `Count`, and other rule types

These objects are defined in `worlds/stardew_valley/stardew_rule/` and are set as access rules using `set_rule(location, rule_object)`. The analyzer attempts to call `inspect.getsource()` on these objects, which fails with errors like:

```
Failed to get multiline lambda source for Received X: module, class, method, function, traceback, frame, or code object was expected, got Received
```

Since the analyzer cannot extract source code, it returns `null` for the access_rule field.

**Fix Required**:

Option 1: **Modify the Analyzer** (Systemic fix)
- Update `exporter/analyzer/source_extraction.py` to detect StardewRule objects
- Add serialization logic to convert StardewRule objects to JSON format
- Handle recursive rule structures (And/Or containing other rules)
- Map Stardew Valle-specific rule types to generic rule types:
  - `Received(item, player, count)` → `{"type": "item_check", "item": item, "count": count}`
  - `Reach(region, "Region", player)` → Region reachability (handled by state manager)
  - `And(rule1, rule2)` → `{"type": "and", "conditions": [...]}`
  - etc.

Option 2: **Custom Pre-Processing** (Game-specific fix)
- Create a custom method in the Stardew Valley exporter that walks the StardewRule objects
- Convert them to a serializable format before the main analyzer runs
- This would require modifying how the exporter hooks into the analysis process

**Implementation Notes**:
- ✅ Created `exporter/games/stardew_valley.py` with basic handler structure
- ✅ Created `exporter/analyzer/stardew_rule_serializer.py` to detect and serialize StardewRule objects
- ✅ Modified `exporter/analyzer/analysis.py` to detect StardewRule objects before attempting source extraction
- ✅ Implemented serialization for major rule types:
  - `Received` → `{"type": "item_check", "item": ..., "count": ...}`
  - `And` → `{"type": "and", "conditions": [...]}`
  - `Or` → `{"type": "or", "conditions": [...]}`
  - `True_`/`False_` → `{"type": "constant", "value": true/false}`
  - `Has` → Recursively serializes underlying rule
  - `Count` → Converts to AND/OR when possible, helper otherwise
  - `Reach` → `{"type": "constant", "value": true}` (region check handled by graph)
  - `TotalReceived` → item_check or helper depending on item count
  - `HasProgressionPercent` → item_check for progression percentage

**Test Results**:
- Generation: ✅ No errors, all StardewRule types handled
- Spoiler Test: 🟡 8/480 locations still failing (98.3% success rate)
- The 8 remaining failures are likely edge cases or special rules needing investigation

**Test Data**:
```json
{
  "name": "Level 1 Farming",
  "id": 717301,
  "access_rule": null,  // Should have farming skill requirement
  "item": {"name": "Club Card", "player": 1, "advancement": true, "type": "None"},
  "region": "Farm"
}
```
