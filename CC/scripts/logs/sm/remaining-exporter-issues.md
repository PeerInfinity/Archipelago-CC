# Remaining Exporter Issues

## Issue 1: VARIA logic system not exportable to frontend

**Problem:** Super Metroid uses a complex VARIA logic system with functions like `sm.wor()`, `sm.canFly()`, `sm.haveItem()`, etc. These are called within `evalSMBool()` calls in location access rules. The current approach of simplifying ALL `evalSMBool` calls to `constant True` makes every location accessible from the start, which breaks progression.

**Current State:**
- Exit rules (region transitions) can be simplified to True since most are accessible from start
- Location rules CANNOT all be True - they have real item requirements that need to be checked
- The VARIA logic functions reference an `sm` object that doesn't exist in the frontend context

**Needed Solution:**
The exporter needs to handle `evalSMBool` calls differently based on context:

**Option A**: Selective simplification
- Simplify `evalSMBool` only for exit/entrance rules
- Keep `evalSMBool` for location rules but provide proper VARIA helper implementations

**Option B**: Export VARIA logic results
- Pre-evaluate the VARIA logic during export and convert to simple item checks
- Export what items/abilities each VARIA function requires

**Option C**: Trust sphere log entirely
- Simplify all rules to True
- Rely entirely on the sphere log to drive progression
- May require changes to how the frontend processes spheres

**Test Results:**
- With all evalSMBool simplified: 107 locations accessible in Sphere 0 (should be 2)
- With selective simplification (accessFrom only): Some locations accessible but not all

**Priority:** HIGH - This is the core blocker for Super Metroid support

