# Solved Helper Issues for Hollow Knight

This file tracks solved issues with the Hollow Knight helper functions (`frontend/modules/shared/gameLogic/hk/hkLogic.js`).

## Solved Issues

### 1. Missing State Methods: _hk_option and _hk_start
**Issue**: The access rules use `state_method` type rules that call `_hk_option(player, 'OptionName')` and `_hk_start(player, 'Location')`. These methods were not implemented in the helper functions, causing "Access rule evaluation failed" errors.

**Solution**: Implemented two state methods in `hkLogic.js`:
- `_hk_option(snapshot, staticData, optionName)`: Returns the value of a game option from settings
- `_hk_start(snapshot, staticData, startLocation)`: Checks if the start location matches

Both methods:
- Access settings via `staticData.settings[playerId]`
- Return appropriate defaults if settings are unavailable
- Follow the helper function signature pattern

**Files Modified**:
- `frontend/modules/shared/gameLogic/hk/hkLogic.js` - Added `_hk_option()` and `_hk_start()` methods

**Testing**: These methods are now callable via `executeStateManagerMethod()` in the rule engine.
