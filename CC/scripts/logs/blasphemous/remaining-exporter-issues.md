# Remaining Exporter Issues

## Boss Strength Export Issue (In Progress)

**Status**: Fix in progress, needs debugging

**Problem**: Boss check methods (like `can_beat_mourning_boss`) are not correctly passing boss names to the `has_boss_strength` helper function. This causes locations like "MaH: Sierpes" to become accessible too early (sphere 3.2 instead of 5.8).

**Root Cause**: The exporter's `override_rule_analysis` method doesn't properly handle boss check methods, resulting in `has_boss_strength` being called without the required boss name argument.

**Attempted Fix**: Modified `override_rule_analysis` to detect boss methods using a mapping and construct rules manually using source code inspection. The boss name is now included in the exported rule.

**Current Issue**: The fix successfully exports boss names but appears to have introduced a side effect causing broader test failures at sphere 0. Need to debug to find the root cause.

**Related Files**:
- `exporter/games/blasphemous.py` (lines 72-134)
- `frontend/modules/shared/gameLogic/blasphemous/blasphemousLogic.js` (lines 264-334)
