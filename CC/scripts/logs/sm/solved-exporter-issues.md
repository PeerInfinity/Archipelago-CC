# Super Metroid - Solved Exporter Issues

## Issue 1: Missing game_settings export (hardRooms, knows, hellRuns, romPatches)

### Problem
The SM exporter had a `get_settings_data()` method that exported important game-specific settings (hardRooms, knows, hellRuns, romPatches), but this method was never called by the main exporter. This caused the frontend's smLogic.js helpers to fail when evaluating rules that depend on these settings.

Specifically, the `energyReserveCountOkHardRoom()` helper function in smLogic.js expected to find `hardRooms` settings at `staticData.game_settings[playerId].hardRooms`, but this data was not being exported to the rules.json file.

### Symptoms
- Gauntlet locations (Energy Tank, Gauntlet; Missile (Crateria gauntlet left); Missile (Crateria gauntlet right)) were not accessible at sphere 2.1
- Rule evaluation failed with "Access rule evaluation failed" errors
- The `canEnterAndLeaveGauntlet` helper returned false because `energyReserveCountOkHardRoom` returned false due to missing settings

### Root Cause
1. The main exporter (`exporter/exporter.py`) did not call `get_settings_data()` on game handlers
2. The base class had a deprecated `get_settings_data()` that just aliased `get_world_data()`
3. There was a naming conflict between the old `settings` key (alias for `world` data) and the new game-specific settings

### Solution
1. Added `game_settings` key to `export_data` structure in `exporter/exporter.py`
2. Added code to call `get_settings_data()` on game handlers and store results in `export_data['game_settings']`
3. Updated base class's `get_settings_data()` to return an empty dict (proper base behavior)
4. Updated `statePersistence.js` to include `game_settings` in the static data
5. Updated `smLogic.js` to read from `staticData.game_settings[playerId]` instead of `staticData.settings[playerId]`

### Files Modified
- `exporter/exporter.py`: Added `game_settings` key and code to call `get_settings_data()`
- `exporter/games/base.py`: Updated `get_settings_data()` to return empty dict
- `exporter/games/sm.py`: Updated docstring (method was already implemented)
- `frontend/modules/stateManager/core/statePersistence.js`: Added `game_settings` to static data
- `frontend/modules/shared/gameLogic/sm/smLogic.js`: Changed 20+ references from `settings` to `game_settings`

### Date Fixed
2025-12-27
