# Remaining Exporter Issues for Overcooked! 2

## Issue 1: Static data (level_logic) not exported to rules.json

**Status**: ACTIVE
**Priority**: HIGH
**Type**: Exporter / Core Framework

### Description
The `level_logic` dictionary needs to be exported as part of the static_data in the rules.json file so that frontend helper functions can access it. Currently, the `get_static_data` method is defined in the Overcooked! 2 exporter but the main exporter.py doesn't call it or include static_data in the output JSON.

### Root Cause
The main exporter (exporter/exporter.py) doesn't have a mechanism to export static_data from game-specific exporters. The `get_static_data` method exists in overcooked2.py but isn't being called by the export pipeline.

### Impact
- Location access rules using `has_requirements_for_level_star` helper fail
- All locations in levels 1-1, 2-1, and 4-1 are unreachable
- Spoiler test fails with "Access rule evaluation failed" errors
- 9 locations missing from Sphere 0: 1-1 (1-Star), 1-1 Completed, 1-1 Level Completed, 2-1 (1-Star), 2-1 Completed, 2-1 Level Completed, 4-1 (1-Star), 4-1 Completed, 4-1 Level Completed

### Solution Options
1. **Add static_data export to main exporter.py** - Requires modifying core export logic to call `get_static_data()` and add to JSON output
2. **Embed level_logic in settings** - Add level_logic as a game-specific setting
3. **Hard-code level_logic in frontend** - Not ideal, duplicates data and requires manual updates

### Progress
- ✓ Created `get_static_data` method in overcooked2.py exporter
- ✓ Created frontend helper functions (`has_enough_stars`, `has_requirements_for_level_star`, `meets_requirements`)
- ✓ Registered Overcooked! 2 in game logic registry
- ✗ Need to modify main exporter to call and export static_data

### Next Steps
Either:
A. Modify `exporter/exporter.py` to support static_data export from game handlers
B. Or hard-code level_logic in `frontend/modules/shared/gameLogic/overcooked2/helpers.js` as a workaround
