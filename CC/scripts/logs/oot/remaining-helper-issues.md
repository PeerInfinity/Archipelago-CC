# Remaining Helper Issues for Ocarina of Time

This document tracks unresolved issues with the OOT helper functions (frontend/modules/shared/gameLogic/oot/).

---

## Issues

### Issue 1: Helper functions reference undefined 'context' variable

**File**: `frontend/modules/shared/gameLogic/oot/ootLogic.js`

**Error**: `ReferenceError: context is not defined`

**Affected Functions**:
- `has_bombchus` (line 145-152)
- `has_explosives` (line 153-157)
- `can_blast_or_smash` (line 158-161)
- `can_break_crate` (line 164-168)
- `can_cut_shrubs` (line 169-173)
- `can_dive` (line 174-176)
- `has_bottle` (line 179-181)
- `can_plant_bean` (line 184-192)
- `can_plant_bugs` (line 193-196)
- `can_open_bomb_grotto` (line 199-203)
- `can_open_storm_grotto` (line 204-209)
- `can_summon_gossip_fairy` (line 212-217)
- `can_summon_gossip_fairy_without_suns` (line 218-223)
- `can_ride_epona` (line 226-231)

**Description**:
These helper functions are defined as properties of the context object returned by `createEvaluationContext()`. They try to reference a variable named `context` (e.g., `const ctx = context;`) to call other helper functions, but `context` is not defined in their scope.

**Impact**:
- Functions that depend on these helpers fail to evaluate correctly
- Locations/regions requiring these helpers cannot be determined as accessible
- At Sphere 0, all starting regions show as inaccessible in STATE (though accessible in LOG)

**Detected in test**:
- Sphere 0 comparison - all regions inaccessible in STATE
- Multiple warnings: `[OOT] Failed to parse rule: can_plant_bugs and can_child_attack ReferenceError: context is not defined`
- Multiple warnings: `[OOT] Failed to parse rule: can_summon_gossip_fairy_without_suns and has_bottle ReferenceError: context is not defined`
- Multiple warnings: `[OOT] Failed to parse rule: can_blast_or_smash ReferenceError: context is not defined`

**Solution needed**:
Change the helper functions to properly reference the context object. Options include:
1. Store a reference to the context before returning it
2. Use arrow functions that capture the context after it's created
3. Change `context` references to `this` and bind the functions
4. Restructure to avoid circular references
