# Super Metroid - Solved Exporter Issues

## Issue 1: SM-specific settings not exported to correct location (SOLVED)

### Problem
The SM exporter's `get_settings_data` method was adding SM-specific settings (knows, hardRooms, hellRuns, romPatches) to the world data, but the main exporter calls `get_world_data` instead. Since SM exporter overrode `get_settings_data` but not `get_world_data`, these settings were never being added.

### Root Cause
- Base class has `get_settings_data` as an alias for `get_world_data`
- Main exporter.py calls `game_handler.get_world_data()`
- SM exporter overrode `get_settings_data` instead of `get_world_data`
- Result: SM settings were in `slot_data.Preset` (from VARIA) but not in `world[playerId]` where smLogic.js expects them

### Solution
Changed the SM exporter to override `get_world_data` instead of `get_settings_data`:
- File: `exporter/games/sm.py`
- Changed method name from `get_settings_data` to `get_world_data`
- Changed super() call from `super().get_settings_data()` to `super().get_world_data()`

### Verification
After the fix:
- `world[1]` now contains: `knows`, `hardRooms`, `hellRuns`, `romPatches`
- Spoiler test for Sphere 2.1 (Energy Tank, Gauntlet) passes
- 92 knows settings exported
- hardRooms settings exported: `{'X-Ray': [(8, 10), (10, 5), (14, 1)], 'Gauntlet': [(1, 25), (2, 10), (5, 5), (10, 1)]}`
