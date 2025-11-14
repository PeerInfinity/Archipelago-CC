# Solved Exporter Issues for KDL3

This file tracks exporter issues that have been fixed.

## Fixed Issues

### Issue 1: F-string subscript/attribute expression not evaluated [FIXED]

**Status**: Fixed ✅
**Priority**: High
**Category**: Exporter
**Date Fixed**: 2025-11-14

**Description**:
The exporter encountered f-strings with complex subscript/attribute expressions that it could not properly evaluate. Specifically:
- Expression: `f"{location_name.level_names_inverse[level]} - Stage Completion"`
- This should resolve to values like "Grass Land - Stage Completion"
- Instead, the raw AST structure was being used as the item name

**Impact**:
- Affected boss purification locations
- Test was failing at Sphere 1.2
- Locations not accessible: "Grass Land - Boss (Whispy Woods) Purified", "Level 1 Boss - Purified"

**Solution Implemented**:
Enhanced the KDL3 exporter (`exporter/games/kdl3.py`) to:
1. Import the `location_name` module and cache `level_names_inverse` dictionary in `__init__`
2. Added `_evaluate_subscript()` method to handle subscript expressions
3. Modified `_convert_f_string()` to detect and evaluate subscript expressions within f-strings
4. When a subscript with a constant index is detected on `level_names_inverse`, it resolves to the actual level name

**Code Changes**:
- File: `exporter/games/kdl3.py`
- Added `importlib` import
- Added `__init__` method to load `level_names_inverse` from `worlds.kdl3.names.location_name`
- Added `_evaluate_subscript()` method (lines 98-137)
- Updated `_convert_f_string()` to handle subscript expressions (lines 82-89)

**Test Results**:
- Spoiler test now passes all 342 state updates
- All boss purification locations are now correctly accessible
- Generated rules.json contains proper item names: `"Grass Land - Stage Completion"` instead of raw AST

**Verification**:
```bash
npm test --mode=test-spoilers --game=kdl3 --seed=1
# Result: ✓ 1 passed (18.6s)
```
