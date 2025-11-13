# Solved Exporter Issues for Ocarina of Time

This file tracks exporter issues that have been resolved.

## Resolved Issues

### 1. Settings not being exported properly ✅ FIXED

**Issue**: The `starting_age` and other settings were exported as `null` instead of their actual values.

**Fix Applied**: Implemented `get_settings_data()` method in `exporter/games/oot.py` to export OOT-specific settings.

**Result**: Settings are now correctly exported. Example from rules.json:
```json
{
  "starting_age": "child",
  "shuffle_child_trade": "vanilla",
  "open_forest": "open"
}
```

**Files Modified**:
- `exporter/games/oot.py` - Added `get_settings_data()` method (lines 85-130)
