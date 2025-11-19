# Solved Exporter Issues for The Witness

## Issue 1: Region reachability patterns not fully converted in laser activation locations (SOLVED)

**Status**: Solved
**Priority**: High
**Category**: Exporter

**Description**:
Some laser activation locations (Desert, Shadows) had access rules containing region reachability patterns that were not being converted to `can_reach_region` helper calls. These patterns appeared nested inside `and` rules and caused "Access rule evaluation failed" errors.

**Affected Locations**:
- Desert Laser Activated ✓
- Desert Laser Panel ✓
- Shadows Laser Activated ✓
- Shadows Laser Panel ✓
- Shadows Intro 8 ✓
- Shadows Near 5 ✓
- Shadows Far 8 ✓
- Orchard Apple Tree 5 ✓

**Root Cause**:
The `postprocess_rule()` method in `exporter/games/witness.py` only checked if the top-level rule matched the region reachability pattern. When the pattern was nested inside compound rules (like `and`), it wasn't detected and converted.

**Solution**:
Updated `postprocess_rule` to:
1. First call `_simplify_region_reachability_pattern` to recursively simplify the rule
2. After simplification, check if the result is a single region reachability pattern that can be converted to a helper call
3. Handle both direct patterns and patterns nested in compound rules

**Files Modified**:
- `exporter/games/witness.py:230` (postprocess_rule method)

**Commit**: 448953cc
