# Solved Exporter Issues for Ocarina of Time

## Issue 1: Missing exit/entrance access rules (FIXED)

**Symptom**: 593 out of 594 exits had `access_rule: null`, causing all regions to be accessible from the start

**Root Cause**:
- OOT defines entrance rules in World JSON files (e.g., `worlds/oot/data/World/Overworld.json`)
- These rules were compiled into lambda functions but the original rule strings weren't being captured
- The exporter couldn't analyze the lambda functions and returned null for all entrance access rules

**Solution**:
Modified `exporter/games/oot.py` to:
1. Added `_load_world_json_files()` method that loads all JSON files from `worlds/oot/data/World/`
2. Extracts entrance rules from the `exits` dictionary in each region
3. Extracts location rules from the `locations` dictionary in each region
4. Adds these rule strings to the `rule_string_map` in `build_rule_string_map()`
5. The existing `override_rule_analysis()` method then uses these rule strings instead of trying to analyze lambdas

**Files Changed**:
- `exporter/games/oot.py`: Added `_load_world_json_files()` and updated `build_rule_string_map()`

**Status**: Fixed in code, needs testing with a successful OOT generation

**Next Steps**: Test with a working OOT seed/template to verify entrance rules are now exported correctly
