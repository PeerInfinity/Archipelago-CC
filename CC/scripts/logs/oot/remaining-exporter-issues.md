# Remaining Exporter Issues for Ocarina of Time

This file tracks outstanding issues with the OOT exporter (`exporter/games/oot.py`).

## Critical Issues

### Issue #1: Game directory mismatch (FIXED)

**Status**: FIXED
**Priority**: P0 - Was blocking all tests

**Description**:
The spoiler test fails immediately at Sphere 0 because the Menu region is not accessible. The error showed:

```
Expected regions in SPHERE that are NOT accessible in STATE: Menu, Kokiri Forest...
```

**Root Cause**:
The rules.json file has `game_directory: "ocarina_of_time"` but the frontend logic module was in directory `oot/`. The state manager couldn't find the game logic module because of this name mismatch.

**Fix**:
Renamed `frontend/modules/shared/gameLogic/oot/` to `frontend/modules/shared/gameLogic/ocarina_of_time/` to match the game_directory value in rules.json, and updated imports in gameLogicRegistry.js.

**Files Changed**:
- Renamed: `frontend/modules/shared/gameLogic/oot/` → `frontend/modules/shared/gameLogic/ocarina_of_time/`
- Modified: `frontend/modules/shared/gameLogic/gameLogicRegistry.js` - Updated imports from './oot/ootLogic.js' to './ocarina_of_time/ootLogic.js'

---

## Current Issues

No critical exporter issues remaining. The exporter is correctly generating rules.json with the appropriate game_directory value. Issues now are in the helper functions (see remaining-helper-issues.md).
