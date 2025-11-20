# Solved Exporter Issues for Ocarina of Time

## Status: Tracking Solutions

Last Updated: 2025-11-20

## Completed Fixes

### Setup Issues Resolved

**Issue:** OOT not registered in preset_files.json
**Solution:** Added "oot" entry to `frontend/presets/preset_files.json` with correct flags:
- `has_custom_exporter: true`
- `has_custom_game_logic: false`

**Files Modified:**
- `frontend/presets/preset_files.json`

**Date Resolved:** 2025-11-20

---

*More fixes will be documented here as issues are resolved.*
