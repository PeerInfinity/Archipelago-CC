# Solved Exporter Issues for Hollow Knight

This file tracks solved issues with the Hollow Knight exporter (`exporter/games/hk.py`).

## Solved Issues

### 1. Missing Game Options in Settings Export
**Issue**: The exporter was not exporting game-specific options like `ProficientCombat`, `DifficultSkips`, `DarkRooms`, etc. The rules.json file only contained `game` and `assume_bidirectional_exits` settings, but the access rules use `state_method` calls like `_hk_option` that require these options.

**Solution**: Implemented `get_settings_data()` method in `exporter/games/hk.py` that:
- Extracts all options from `world.options`
- Exports option values using the `value` attribute
- Includes all 100+ Hollow Knight-specific options

**Files Modified**:
- `exporter/games/hk.py` - Added `get_settings_data()` method

**Testing**: Verified that settings now include options like `ProficientCombat: 0`, `DifficultSkips: 0`, etc.
