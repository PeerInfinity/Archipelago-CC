# SMZ3 Remaining Helper Issues

## Summary
Issues related to SMZ3 helper functions in `frontend/modules/shared/gameLogic/smz3/smz3Logic.js`

## Issues

### 1. Spectacle Rock access rule evaluation failure
- **Status**: ❌ FAILING (Sphere 0.3)
- **Test**: Spoiler test fails at sphere 0.3
- **Location**: Spectacle Rock
- **Expected**: Should be accessible when player has Mirror and can reach Light World Death Mountain West
- **Actual**: "Access rule evaluation failed"
- **Access Rule**: `{"type": "item_check", "item": "Mirror"}`
- **Player Inventory**: Has Mirror (acquired in sphere 0.1), Has Flute (acquired in sphere 0.3)
- **Investigation needed**:
  - Why does `item_check` for Mirror return `undefined` instead of count?
  - Is the snapshot interface properly providing `countItem`?
- **Priority**: HIGH (blocks test progress)

### 2. smz3_GetLocation helper not implemented
- **Status**: ⚠️ NOT IMPLEMENTED
- **Location**: `frontend/modules/shared/gameLogic/smz3/smz3Logic.js`
- **Description**: Some locations use `smz3_GetLocation()` helper to check if the location itself contains a specific item (for key logic)
- **Example**: Palace of Darkness - Harmless Hellway checks if it contains KeyPD
- **Impact**: May cause issues with self-referential location checks
- **Priority**: MEDIUM (may be needed after Spectacle Rock issue is resolved)
