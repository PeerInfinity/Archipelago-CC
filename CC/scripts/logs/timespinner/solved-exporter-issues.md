# Solved Exporter Issues

## Issue 1: Missing Timespinner-specific settings in rules.json

**Problem**: The exporter was not exporting Timespinner-specific settings like `specific_keycards`, `eye_spy`, `unchained_keys`, `prism_break`, and the precalculated weight values (`pyramid_keys_unlock`, `present_keys_unlock`, `past_keys_unlock`, `time_keys_unlock`). These settings are required by the helper functions in `timespinnerLogic.js`.

**Impact**: Helper functions like `can_teleport_to`, `has_keycard_B/C/D`, `can_break_walls`, and `can_kill_all_3_bosses` could not evaluate correctly, causing many regions and locations to be unreachable.

**Fix**: Added `get_settings_data()` override in `exporter/games/timespinner.py` to export:
- Option flags: `specific_keycards`, `eye_spy`, `unchained_keys`, `prism_break`
- Precalculated weights: `pyramid_keys_unlock`, `present_keys_unlock`, `past_keys_unlock`, `time_keys_unlock`

**Location**: `exporter/games/timespinner.py:58-79`

