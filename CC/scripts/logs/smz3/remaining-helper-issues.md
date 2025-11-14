# Remaining Helper Issues

## Issue 1: Missing helper functions smz3_CanDestroyBombWalls and smz3_CanAccessNorfairUpperPortal

**Description**: Two SMZ3 helper functions are referenced in entrance rules but not yet implemented in JavaScript.

**Missing Helpers**:
1. `smz3_CanDestroyBombWalls` - Used in several region entrance rules
2. `smz3_CanAccessNorfairUpperPortal` - Used for Norfair region access

**Impact**: Test now fails at Sphere 0.3 (progress from Sphere 0!). These helpers are needed for proper region accessibility.

**Priority**: HIGH

**Next Steps**: Implement these helpers in `frontend/modules/shared/gameLogic/smz3/smz3Logic.js` by porting the logic from the Python TotalSMZ3 Progression class.

---

## Issue 2: Unresolved variable references ("self" and "items" in some contexts)

**Description**: Some rules still have unresolved variable references:
- "Name self NOT FOUND in context"
- "Name items NOT FOUND in context"

**Likely Cause**: The postprocessing might not be catching all patterns, or there are nested method calls like `self.CanExit(items)` that need special handling.

**Priority**: MEDIUM - Need to investigate which specific rules have these issues

**Next Steps**: Search the rules.json for remaining "name" type references to "self" and "items", then enhance the postprocessing to handle those patterns.

