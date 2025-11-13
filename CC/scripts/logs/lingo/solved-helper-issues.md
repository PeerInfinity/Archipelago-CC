# Solved Helper Issues for Lingo

## Issue 1: Initial lingo_can_use_entrance implementation

**Status:** Partially Solved
**Solved Date:** 2025-11-13

**Original Problem:**
The `lingo_can_use_entrance` helper was a placeholder that returned `true` for all non-null doors, making everything accessible immediately.

**Solution Implemented:**
Updated `frontend/modules/shared/gameLogic/lingo/lingoLogic.js` to:
1. Check if door is null/undefined and return true (correct for always-accessible entrances)
2. Validate door format is a [room, door_name] array
3. Determine effective room (use door[0] if not null, otherwise use room parameter)
4. Build door item name as `"Room - Door"`
5. Check if the door item exists in the game's item list
6. If door item exists, check if player has it in inventory
7. If door item doesn't exist, return true (needs improvement - see remaining issues)

**Code Changes:**
- File: `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`
- Lines: 14-54
- Added proper door item checking logic
- Added validation and error handling

**Outcome:**
The helper now correctly handles doors with associated items. Doors without items still need proper access requirement checking (see remaining issues).
