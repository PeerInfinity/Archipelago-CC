# Remaining Exporter Issues

## Issue 1: Region.can_reach() pattern not recognized

**Symptom:** Three regions fail to be accessible in sphere 0:
- Desert Behind Elevator
- Outside Tutorial Path To Outpost
- Shadows Laser Room

**Root Cause:** The exporter's analyzer (`exporter/analyzer/ast_visitors.py`) handles `Location.can_reach(state)` calls but doesn't recognize `Region.can_reach(state)` calls. When it encounters a lambda like `lambda state: region.can_reach(state)`, it tries to analyze the internal implementation of `Region.can_reach()`, which includes complex Python optimization logic (`state.stale[1]`, `update_reachable_regions()`) that shouldn't be exported.

**Fix:** Add handling for Region.can_reach() similar to Location.can_reach() in the visit_Call method of ast_visitors.py (around line 888).
