# Solved KDL3 Exporter Issues

## Export copy_abilities Dictionary
**Issue**: The `can_assemble_rob` and `can_fix_angel_wings` helper functions require a `copy_abilities` dictionary parameter that maps enemy names to their randomized copy abilities, but this wasn't being exported to the rules.json file.

**Solution**: Added `get_settings_data` override method in `exporter/games/kdl3.py` to export `world.copy_abilities` to the settings section of rules.json.

**Files Modified**:
- exporter/games/kdl3.py:26-37

**Status**: Fixed and verified - copy_abilities now appears in settings["1"] in generated rules.json files.
