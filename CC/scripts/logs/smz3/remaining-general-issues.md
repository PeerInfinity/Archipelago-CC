# SMZ3 Remaining General Issues

## Summary
General issues not specific to exporter or helpers

## Issues

### 1. item_check returns count but some code may expect boolean
- **Status**: ⚠️ UNDER INVESTIGATION
- **Location**: `frontend/modules/shared/ruleEngine.js:1261-1265`
- **Description**: Changed `item_check` without count field to return item count instead of boolean
- **Rationale**: Python `items.KeyPD` returns count, needs to work in comparisons like `items.KeyPD >= 3`
- **Potential Impact**:
  - Numeric count works in boolean contexts (0 is falsy, 1+ is truthy)
  - But some code may explicitly check `=== true` or `=== false`
- **Test Results**:
  - ✅ Fixed Palace of Darkness locations (sphere 7.7)
  - ❌ New failure at Spectacle Rock (sphere 0.3) - investigating if related
- **Next Steps**: Determine if Spectacle Rock issue is caused by this change or pre-existing
