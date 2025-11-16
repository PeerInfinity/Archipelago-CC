# Remaining Exporter Issues

## Issue 1: Region.can_reach() pattern not recognized

**Symptom:** Three regions fail to be accessible in sphere 0:
- Desert Behind Elevator
- Outside Tutorial Path To Outpost
- Shadows Laser Room

**Root Cause:** The exporter's analyzer (`exporter/analyzer/ast_visitors.py`) handles `Location.can_reach(state)` calls but doesn't recognize `Region.can_reach(state)` calls. When it encounters a lambda like `lambda state: region.can_reach(state)`, it tries to analyze the internal implementation of `Region.can_reach()`, which includes complex Python optimization logic (`state.stale[1]`, `update_reachable_regions()`) that shouldn't be exported.

**Attempted Fix:** Added handling for Region.can_reach() in ast_visitors.py visit_Call method (lines 887-916) to detect when an object with 'name' and 'entrances' attributes calls can_reach(), and convert it to a state_method.

**Status:** Fix added but not working yet. The code may not be reached, or the region variable may not be resolving from closure_vars. Need to:
1. Enable debug logging to see if the code path is being reached
2. Check if the lambda is being analyzed through recursive function inlining instead
3. Consider adding a pre-analysis hook to detect and simplify region.can_reach patterns before full AST analysis

**Next Steps:**
- Enable Python debug logging during generation to see analyzer behavior
- Add print statements to verify code execution
- Consider alternative approaches if current fix path is blocked
