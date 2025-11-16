# Solved Exporter Issues for Kirby's Dream Land 3

This document tracks exporter issues that have been fixed.

## Fixed Issues

### Issue 1: Array Slicing Not Supported - FIXED

**Location**: `Sand Canyon 6 - Professor Hector & R.O.B`
**Sphere**: 7.57
**Error Message**: `Error visiting value or index in subscript: Subscript(value=Attribute(value=Name(id='enemy_abilities', ctx=Load()), attr='enemy_restrictive', ctx=Load()), slice=Slice(lower=Constant(value=1), upper=Constant(value=5)), ctx=Load())`

**Root Cause**: The exporter was trying to inline the `can_assemble_rob` helper function instead of preserving it as a helper call. When it attempted to analyze the function, it encountered Python array slicing syntax `enemy_abilities.enemy_restrictive[1:5]` which the analyzer cannot handle.

**Solution**: Implemented `should_preserve_as_helper()` method in the KDL3 exporter (exporter/games/kdl3.py:43-58) to preserve all KDL3 helper functions as helper calls rather than attempting to inline them. This prevents the analyzer from trying to parse complex Python syntax that isn't supported.

**Helper Functions Preserved**:
- `can_reach_boss`, `can_reach_rick`, `can_reach_kine`, `can_reach_coo`
- `can_reach_nago`, `can_reach_chuchu`, `can_reach_pitch`
- `can_reach_burning`, `can_reach_stone`, `can_reach_ice`, `can_reach_needle`
- `can_reach_clean`, `can_reach_parasol`, `can_reach_spark`, `can_reach_cutter`
- `can_assemble_rob`, `can_fix_angel_wings`

**Test Result**: All spoiler tests now pass (248 events processed successfully).

**Files Modified**:
- exporter/games/kdl3.py (added should_preserve_as_helper method)
