# Solved Helper Issues for Starcraft 2

## Issue 1: the_escape_requirement and the_escape_first_stage_requirement implemented

**Fixed**: 2025-11-18
**Test Now Passes**: Sphere 15.22 and earlier
**Solution**:
Implemented both helper functions in `frontend/modules/shared/gameLogic/sc2/helpers.js`:

- `the_escape_first_stage_requirement`: Checks for Nova suit module (Armored, Energy, or Progressive Stealth)
- `the_escape_requirement`: Checks for Nova suit module AND at least 2 Nova weapons

**Analysis**:
By examining the sphere log, we determined that:
- First stage (Grenades/Rifle) requires a suit module
- Full mission (Victory/Agents) requires a suit module + 2 weapons
- Jump Suit Module does not count for The Escape mission
