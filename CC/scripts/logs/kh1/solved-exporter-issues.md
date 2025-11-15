# Kingdom Hearts 1 - Solved Exporter Issues

This document tracks exporter issues that have been resolved.

## Solved Issues

### Issue: has_all_counts state method with empty args

**Status**: FIXED ✓
**Locations affected**:
- Traverse Town Magician's Study Obtained All LV1 Magic
- Traverse Town Magician's Study Obtained All LV3 Magic
- Traverse Town Magician's Study Obtained All Arts Items
- Neverland Clock Tower Chest
- Final Ansem

**Root cause**: The analyzer tried to inline `has_all_magic_lvx(state, player, level)` helper function, which calls `state.has_all_counts({dictionary}, player)`. The analyzer could not resolve the dictionary values because they referenced the `level` parameter, resulting in empty args.

**Symptoms**:
- Locations requiring all level X magic were not accessible
- Test failed at Sphere 10.3 for "Obtained All LV1 Magic"

**Fix**: Added `post_process_data()` method in `exporter/games/kh1.py` that:
1. Detects `state_method` nodes with `has_all_counts` and empty args
2. Determines the magic level from location name patterns
3. Converts to proper helper call: `{"type": "helper", "name": "has_all_magic_lvx", "args": [{"type": "constant", "value": level}]}`
4. Defaults to level 1 if level cannot be determined from location name

**Files modified**:
- `exporter/games/kh1.py`: Added `post_process_data()` and `_fix_has_all_counts_rule()` methods

**Testing**: After fix, locations with LV1 and LV3 magic requirements became accessible at the correct sphere levels.

### Issue: has_any_count state method with empty args (has_defensive_tools pattern)

**Status**: FIXED ✓
**Locations affected**:
- Neverland Clock Tower Chest
- Final Ansem (boss fight)

**Root cause**: The analyzer tried to inline `has_defensive_tools(state, player)` helper function, which calls both `state.has_all_counts(...)` and `state.has_any_count(...)`. The analyzer could not resolve the dictionary argument for `has_any_count`, resulting in empty args. The pattern appeared as nested `and` conditions containing both `has_all_magic_lvx` and `has_any_count` with empty args.

**Symptoms**:
- Locations requiring defensive tools were not accessible
- Test failed at Sphere 13.19 for "Neverland Clock Tower Chest"
- Access rule contained unusable `has_any_count` state method

**Fix**: Extended `_fix_has_all_counts_rule()` method in `exporter/games/kh1.py` to:
1. Process rules recursively (depth-first)
2. Detect pattern: `and` condition containing both `has_all_magic_lvx` helper and `has_any_count` state method
3. Replace entire `and` condition with single `has_defensive_tools` helper call

**Files modified**:
- `exporter/games/kh1.py`: Updated `_fix_has_all_counts_rule()` method to detect and fix has_defensive_tools pattern

**Testing**: After fix, locations requiring defensive tools became accessible at the correct sphere levels. Spoiler test passed all 70 spheres.
