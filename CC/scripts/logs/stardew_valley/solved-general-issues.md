# Solved General Issues

## Issue 1: count_true exported as helper instead of native rule type

**Location**: `exporter/games/stardew_valley.py:268-276`, `frontend/modules/shared/ruleEngine.js`

**Problem**: The Count rule from Stardew Valley was being exported as a helper with conditions wrapped in constants, which prevented recursive evaluation of the conditions.

**Solution**:
1. Added 'count_true' as a native rule type in the rule engine (similar to 'and', 'or')
2. Updated the exporter to generate count_true rule types with unwrapped conditions
3. Added proper logging for count_true rules

**Test Result**: Fixed - Forager's Bundle now correctly evaluates at Sphere 0.5

