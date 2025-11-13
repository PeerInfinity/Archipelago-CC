# Remaining Exporter Issues - Stardew Valley

This file tracks remaining issues with the Stardew Valley exporter.

## Issues

### Issue 1: Null Access Rules for Locations

**Priority**: Critical
**Status**: Open
**Sphere**: 0

**Description**:
480 locations have `access_rule: null` in the generated rules.json file. These locations are being treated as immediately accessible when their region is reachable, but they should have actual access requirements.

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
- Created `exporter/games/stardew_valley.py` with basic handler structure
- Handler is automatically registered but doesn't solve the core issue
- The problem is in the analyzer, not the handler
- Need access to the original StardewRule objects to serialize them properly

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
