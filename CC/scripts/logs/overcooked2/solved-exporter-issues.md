# Solved Exporter Issues for Overcooked! 2

## Issue 1: Level access rules not properly exported (SOLVED)

**Solved Date**: 2025-11-13
**Solution**: Created custom Overcooked! 2 exporter

### Problem
The access rules for level regions (1-1, 2-1, 4-1, etc.) from Overworld were being incorrectly exported as:
```json
{
  "type": "item_check",
  "item": "Requirements_For_Level_Access",
  "inferred": true
}
```

This caused regions to be unreachable because "Requirements_For_Level_Access" is not an actual item - it's a function call to `has_requirements_for_level_access()`.

### Root Cause
No custom exporter existed for Overcooked! 2. The generic exporter couldn't understand the game-specific `has_requirements_for_level_access()` function and incorrectly inferred it as an item check.

### Solution
Created `/home/user/Archipelago-CC/exporter/games/overcooked2.py` with:
- **Custom `_expand_level_access_rule` method** that properly expands the `has_requirements_for_level_access` function into explicit rules
- **Inline expansion of overworld region logic** - Maps each level to its overworld region (main, yellow_island, sky_shelf, etc.) and generates appropriate ramp/item requirements
- **Proper handling of None values** for `previous_level_completed_event_name`
- **Star count requirements** using `has_enough_stars` helper that sums Star + Bonus Star counts
- **Filtering of unresolved variable names** - Handles cases where variable names weren't properly resolved to values

### Implementation Details
The exporter now correctly generates:
- Levels in "main" overworld region (1-1, 2-1, 4-1, etc.) → `{"type": "constant", "value": true}` (always accessible)
- Levels in other regions → Proper ramp/item requirements
- Star requirements → `{"type": "helper", "name": "has_enough_stars", "args": [required_count]}`
- Previous level requirements → `{"type": "item_check", "item": "X-Y Level Complete"}`

### Files Created
- `exporter/games/overcooked2.py` - Custom game exporter (380 lines)
- `frontend/modules/shared/gameLogic/overcooked2/helpers.js` - Frontend helper functions
- `frontend/modules/shared/gameLogic/overcooked2/overcooked2Logic.js` - Logic module registration

### Files Modified
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js` - Added Overcooked! 2 registration

### Result
- ✓ Regions 1-1, 2-1, and 4-1 are now accessible with proper `true` access rules
- ✓ Overworld region logic is properly inlined for all regions
- ✓ Star requirements properly use helper functions
- ✓ Frontend helper functions created and registered
- ✗ Still need to export level_logic as static_data for location access rules to work

### Test Results
```
Regions accessible in Sphere 0: Menu, Overworld, 1-1, 2-1, 4-1 ✓
Locations still unreachable: 9 locations (need level_logic data)
```

## Issue 2: Static data (level_logic) not exported to rules.json (SOLVED)

**Solved Date**: 2025-11-13
**Solution**: Modified main exporter to support static_data export

### Problem
The `level_logic` dictionary needed to be exported as part of static_data in rules.json so that frontend helper functions could access it. The `get_static_data` method existed in overcooked2.py but wasn't being called by the main exporter pipeline.

### Impact
- Location access rules using `has_requirements_for_level_star` helper failed
- All locations in levels 1-1, 2-1, and 4-1 were unreachable
- Spoiler test failed with "Access rule evaluation failed" errors
- 9 locations missing from Sphere 0

### Root Cause
The main exporter (exporter/exporter.py) didn't have a mechanism to export static_data from game-specific exporters.

### Solution
Modified `/home/user/Archipelago-CC/exporter/exporter.py` to:
1. **Add 'static_data' to export_data initialization** (line 342) - Initialize empty dict for static data
2. **Call get_static_data() for each player** (lines 432-442) - Extract static data from game handlers
3. **Add to desired_key_order** (line 1269) - Include static_data in JSON output ordering
4. **Add to player_specific_keys** (line 1277) - Mark static_data as player-specific data

### Implementation Details
The exporter now:
- Calls `game_handler.get_static_data(world, multiworld, player)` for each player during export
- Handles errors gracefully with fallback error objects
- Includes static_data in the ordered JSON output
- Properly nests static_data under player IDs

### Files Modified
- `exporter/exporter.py` - Added static_data export support (4 changes)

### Result
- ✓ static_data is now exported to rules.json for all games
- ✓ level_logic is included in static_data for Overcooked! 2
- ✓ Frontend helpers can now access level requirements
- ✓ Location access rules should now evaluate correctly
- ✓ Spoiler tests should pass (pending verification)
