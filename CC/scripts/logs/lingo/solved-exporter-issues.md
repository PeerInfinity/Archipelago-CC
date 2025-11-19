# Solved Exporter Issues

## Fixed: Missing game options in settings export

**Status**: FIXED
**Priority**: Critical (was)
**File**: `exporter/games/lingo.py`

**Problem**:
The Lingo exporter's `get_settings_data()` method was not exporting world-specific options (like `shuffle_colors`, `shuffle_doors`, `shuffle_panels`, etc.) to the rules.json file.

**Impact**:
- Color requirement checks were being SKIPPED in the frontend
- ALL color-gated doors were accessible from the start
- Spoiler test failed at Sphere 0 with hundreds of incorrectly accessible locations

**Solution**:
Added export of Lingo-specific options to `get_settings_data()` method. The method now iterates through `world.options` and exports all relevant settings including:
- `shuffle_colors`
- `shuffle_doors`
- `shuffle_panels`
- `shuffle_paintings`
- `shuffle_sunwarps`
- `shuffle_postgame`
- `group_doors`
- `mastery_achievements`

**Verification**:
After the fix:
- Spoiler test now passes Spheres 0, 0.1, 1.1, 1.2 (previously failed at Sphere 0)
- Only 1 remaining failure at Sphere 1.3 (unrelated issue)
- `shuffle_colors` is now properly exported as `1` (true) in settings

