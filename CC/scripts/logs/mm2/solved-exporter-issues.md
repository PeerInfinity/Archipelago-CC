# Mega Man 2 - Solved Exporter Issues

This file tracks resolved issues with the Mega Man 2 exporter.

## Solved Issues

### Issue 1: Sphere 7.2 Mismatch - Wily Stage 5 Locations Not Accessible

**Sphere:** 7.2 (originally failed)
**Locations affected:**
- Wily Machine 2 - Defeated
- Wily Stage 5 - Completed

**Problem:** Locations accessible in LOG but NOT in STATE. Access rule evaluation failed.

**Root Cause:**
The `can_defeat_enough_rbms` helper function was being converted to a "capability" type rule by the generic exporter, which the JavaScript rule engine doesn't understand. The wily_5_requirement and wily_5_weapons data was not being exported.

**Solution:**
1. Created MM2-specific exporter (`exporter/games/mm2.py`) that:
   - Exports `wily_5_requirement` setting (number of robot masters needed)
   - Exports `wily_5_weapons` data (boss requirements mapping)
   - Overrides `_expand_common_helper` to preserve `can_defeat_enough_rbms` as a helper type

2. Created MM2 helper functions (`frontend/modules/shared/gameLogic/mm2/mm2Logic.js`):
   - Implemented `can_defeat_enough_rbms` helper function that evaluates if player can defeat enough robot masters
   - Logic checks if player has required weapons for each boss
   - Counts defeatable bosses and compares to requirement

3. Registered MM2 game logic in `gameLogicRegistry.js`:
   - Added import for mm2HelperFunctions
   - Added registry entry for 'Mega Man 2' with helper functions

**Result:** Test now passes. All spheres match correctly.
