# Solved Exporter Issues for Lingo

## Issue 1: Missing mastery_reqs export

**Status**: FIXED ✓

**Description**: The exporter needed to export `world.player_logic.mastery_reqs` to the settings, which is required for checking mastery requirements (the_master flag in AccessRequirements).

**Location**: exporter/games/lingo.py:209 (get_settings_data method)

**Impact**: Caused Orange Tower Basement to be accessible too early (Sphere 3.2) because mastery check always failed.

**Fix**: Added export of mastery_reqs to settings in get_settings_data method. The mastery requirements are now serialized as an array of AccessRequirements objects, with each requirement containing rooms, doors, colors, items, progression, the_master, and postgame fields.
