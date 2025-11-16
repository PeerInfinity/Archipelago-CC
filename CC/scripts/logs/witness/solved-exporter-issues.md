# The Witness - Solved Exporter Issues

This file tracks resolved issues with the exporter (exporter/games/witness.py).

## Solved Issues

### 1. Region Reachability Pattern Not Handled

**Severity**: Critical (SOLVED)
**Resolution**: Implemented in exporter/games/witness.py

**Description**: The Witness uses a special region reachability system that involves:
- `state.stale[player]` - a dictionary tracking if region reachability needs updating
- `state.update_reachable_regions(player)` - a method that performs BFS to update reachable regions
- `state.reachable_regions[player]` - a set of currently reachable regions
- `self` - references to the region/location object being checked

The exporter was converting this pattern to JSON, but the JavaScript rule engine doesn't have these concepts.

**Solution Implemented**:
1. Created `_is_region_reachability_pattern()` method to detect the pattern
2. Created `_simplify_region_reachability_pattern()` method to recursively simplify the pattern
   - Detects the pattern and replaces it with `{"type": "constant", "value": true}`
   - Recursively processes compound rules (and, or, not) to find nested patterns
   - Optimizes simplified rules by removing redundant True/False constants
3. Implemented `postprocess_rule()` to post-process location access rules
4. Implemented `handle_complex_exit_rule()` to post-process exit access rules

**Impact**:
- Fixed region access for: Desert Behind Elevator, Outside Tutorial Path To Outpost, Shadows Laser Room
- Fixed location access for most laser locations
- Reduced test failures from 10+ locations and 3 regions down to 1 location

**Files Modified**:
- exporter/games/witness.py

**Test Results**:
- Before: Failed at Sphere 0 with 10 locations and 3 regions inaccessible
- After: Fails at Sphere 0 with only 1 location issue (Keep Laser Activated - see remaining issue #1)
