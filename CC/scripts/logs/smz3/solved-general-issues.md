# SMZ3 Solved General Issues

## Summary
General issues that have been resolved

## Resolved Issues

### 1. Palace of Darkness key count comparisons
- **Status**: ✅ SOLVED
- **Location**: `frontend/modules/shared/ruleEngine.js:1241-1273`
- **Description**: Locations like "Palace of Darkness - Compass Chest" require `KeyPD >= 3` but `item_check` was returning boolean instead of count
- **Root Cause**:
  - Python: `items.KeyPD` returns the count of KeyPD items
  - Exporter: Converts to `{"type": "item_check", "item": "KeyPD"}`
  - Rule Engine: Was treating `item_check` without `count` field as boolean check (hasItem)
  - Comparison: `true >= 3` evaluates to `1 >= 3` which is `false`
- **Solution**: Modified `item_check` case to return `context.countItem(itemName)` when no `count` field is present
- **Verification**: Test now progresses past sphere 7.7 (Palace of Darkness locations)
- **Commit**: "Fix item_check to return count for numeric comparisons"
- **Files Changed**: `frontend/modules/shared/ruleEngine.js`
- **Impact**: Allows `item_check` to work in both boolean and numeric contexts:
  - Boolean context: `0` is falsy, `1+` is truthy
  - Numeric context: Returns actual count for comparisons
