# Solved Exporter Issues

## Issue 1: SMBool(True) pattern not being simplified

**Problem:** The exporter has logic to simplify `evalSMBool(SMBool(True), maxDiff)` patterns to just `constant True`, but it wasn't working because the analyzer converts `SMBool()` calls to `helper` type nodes instead of `function_call` type nodes.

**Solution:** Updated `_check_smbool_true_pattern()` in exporter/games/sm.py to check for both `function_call` and `helper` type patterns. Also added a `SMBool` helper function to frontend/modules/shared/gameLogic/sm/smLogic.js to handle cases where the simplification doesn't occur.

**Files Modified:**
- exporter/games/sm.py:27-63
- frontend/modules/shared/gameLogic/sm/smLogic.js:49-67, 125-133

## Issue 2: accessFrom rules hitting recursion limit

**Problem:** Location rules using the `add_accessFrom_rule` pattern create deeply nested `any_of` comprehensions that reference the `accessFrom` closure variable. The analyzer hits its recursion limit (11 levels) when analyzing these rules, resulting in corrupted rule structures with infinitely nested but incomplete comprehensions. The `accessFrom` variable is also not available in the frontend context, making the rules unexecutable.

**Solution:** Added `_check_accessFrom_pattern()` to detect the problematic `any_of` pattern that iterates over `accessFrom.items()`, and simplified these rules to just `constant True`. Also added recursive processing for `any_of` and `all_of` rules to ensure nested comprehensions are properly expanded.

**Files Modified:**
- exporter/games/sm.py:87-136, 233-243

**Result:** This partially fixed Sphere 0 issues - Morphing Ball became accessible. However, it revealed that more work is needed for location-specific rules.

