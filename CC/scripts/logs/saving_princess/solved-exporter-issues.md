# Solved Exporter Issues for Saving Princess

This file tracks issues that have been successfully resolved in the Saving Princess exporter.

## Resolved Issues

### Issue 1: Conditional rules with world.is_pool_expanded not resolved ✅

**Resolved:** 2025-11-13
**Sphere:** 3.1
**Previous Test Failure:** Regions "Electrical" and "Electrical (Power On)" not reachable

**Problem:**
The exporter was generating conditional rules that referenced `world.is_pool_expanded` as a runtime check. Since `world` doesn't exist in the browser context, the JavaScript rule engine failed to evaluate these rules, making the Electrical regions unreachable.

**Solution:**
Implemented a custom `expand_rule` method in `SavingPrincessGameExportHandler` that:
1. Detects conditional rules with `world.is_pool_expanded` tests
2. Resolves the actual value of `is_pool_expanded` from the world instance during export
3. Returns only the appropriate branch (if_true or if_false) based on the actual setting value

Also added an `__init__` method to store the world reference when the handler is instantiated.

**Files Modified:**
- `/home/user/Archipelago-CC/exporter/games/saving_princess.py` - Added `__init__` and custom `expand_rule` method

**Test Result:** All 19 spheres now pass validation ✅
