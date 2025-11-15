# Solved Exporter Issues for Overcooked! 2

## Issue #2: Entrance Rules Not Being Exported Correctly

**Status**: FIXED ✅
**Priority**: Critical
**Fixed Date**: 2025-11-15

**Original Problem**:
Entrance rules from Overworld to levels were being exported as `{"type": "constant", "value": true}` instead of the actual access requirements, causing all regions to be accessible immediately.

**Root Causes Identified**:
1. Lambda default arguments (like `level_name=level.level_name`) weren't being extracted from `__defaults__` attribute
2. The `override_rule_analysis` returned a helper rule that bypassed the normal expansion flow in `safe_expand_rule`
3. The generic exporter was converting `has_enough_stars` helper to an inferred item "Enough_Stars"

**Solution Implemented**:
1. Modified `override_rule_analysis` to extract lambda default arguments from `__defaults__` attribute (lines 108-117 in overcooked2.py)
2. Made `override_rule_analysis` immediately expand the helper rule using `_expand_level_access_rule` before returning (line 141)
3. Overrode `expand_rule` to prevent generic exporter from converting Overcooked! 2 helpers to items (lines 302-311)

**Files Modified**:
- `exporter/games/overcooked2.py` - Added default argument extraction and helper preservation

**Verification**:
- Entrance rule for "Overworld -> 1-2" now correctly shows: `{"type": "and", "conditions": [{"type": "helper", "name": "has_enough_stars", "args": [{"type": "constant", "value": 2}]}, {"type": "item_check", "item": "1-1 Level Complete"}]}`
- Regions are no longer all accessible at start of the game
