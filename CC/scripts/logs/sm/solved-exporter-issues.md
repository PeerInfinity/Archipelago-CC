# Super Metroid - Solved Exporter Issues

This file tracks resolved issues with the Super Metroid exporter (`exporter/games/sm.py`).

## Issue #1: Door Color Data Not Exported ✅

**Status:** Fixed and tested
**Discovered:** Sphere 0.1 test failure
**Resolved:** 2025-11-22
**Impact:** Critical - prevented correct location accessibility evaluation

### Problem

The `traverse(doorName)` helper function is used extensively in Super Metroid location access rules to check if doors can be passed. Door color information was not being exported in the rules.json file, causing the JavaScript frontend to use a stub implementation that always returned `true`.

### Solution

**Exporter changes:**
1. Added `get_door_data()` method to `SMGameExportHandler` in `exporter/games/sm.py`
2. Modified `prepare_export_data()` in `exporter/exporter.py` to call `get_door_data()` and include door data in rules.json
3. Added 'doors' to the export data structure and key ordering

**Frontend changes:**
1. Updated `traverse()` in `frontend/modules/shared/gameLogic/sm/smLogic.js` to check door colors from staticData
2. Added helper functions: `canOpenRedDoors()`, `canOpenGreenDoors()`, `canOpenYellowDoors()`
3. Modified `getStaticGameData()` in `frontend/modules/stateManager/core/statePersistence.js` to include doors data

### Files Modified

- `exporter/games/sm.py` - added `get_door_data()` method
- `exporter/exporter.py` - added doors export and key ordering
- `frontend/modules/shared/gameLogic/sm/smLogic.js` - implemented proper traverse() and door helpers
- `frontend/modules/stateManager/core/statePersistence.js` - added doors to staticData

### Test Results

✅ Test now passes Sphere 0.1 (was failing before)
✅ "Bomb" location correctly NOT accessible in Sphere 0.1
⏭️ Test progresses to Sphere 1.2 (new issue discovered there)
