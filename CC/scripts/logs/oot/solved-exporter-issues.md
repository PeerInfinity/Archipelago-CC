# Ocarina of Time - Solved Exporter Issues

## Completed Fixes

### Issue #1: Missing Access Rules (Commit 137bf3e)

**Problem:** 1204 locations and 593 exits had `access_rule: None` because the analyzer couldn't retrieve source code from dynamically-generated lambda functions.

**Solution:** Implemented `override_rule_analysis()` method that:
1. Collects rule strings from all locations/exits during initialization
2. Returns parsed rules using the `parse_oot_rule` helper
3. Passes the original DSL string as an argument to the helper

**Results:**
- Locations with None rules: 1204 → 32 (97% reduction)
- Exits with None rules: 593 → 0 (100% fixed)
- 996 rules now properly exported with rule strings

**Files Modified:**
- `exporter/games/oot.py`: Added `build_rule_string_map()`, `override_rule_analysis()`, `parse_oot_rule_string()`
- `exporter/games/__init__.py`: Modified `get_game_export_handler()` to call initialization methods
