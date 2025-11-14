# Remaining General Issues for Mario & Luigi Superstar Saga

This file tracks known general issues (not specific to exporter or helper) for MLSS.

## Issues

### Issue 1: Shop Chuckolator Flag region not reachable at Sphere 3.10

**Status**: Investigating
**Priority**: Medium
**Test Sphere**: 3.10

**Problem**:
The spoiler test fails at sphere 3.10 with the error:
```
REGION MISMATCH found for: {"type":"state_update","sphere_number":"3.10","player_id":"1"}
> Regions accessible in LOG but NOT in STATE: Shop Chuckolator Flag
```

The "Shop Chuckolator Flag" region should be reachable but the JavaScript StateManager doesn't recognize it as reachable.

**Background**:
The connection from "Shop Starting Flag" to "Shop Chuckolator Flag" has this access rule:
```
(brooch AND fruits AND (thunder OR fire OR hammers))
OR
(piranha_shop OR fungitown_shop OR star_shop OR birdo_shop)
```

The shop helper functions (piranha_shop, etc.) use `can_reach()` to check other shop flag regions, creating circular/indirect dependencies between shops. The Python code uses `register_indirect_condition()` to handle this, which allows regions to become reachable based on other regions' reachability.

**Possible Causes**:
1. The circular dependencies between shop regions aren't being evaluated correctly in the JavaScript StateManager
2. The region reachability update logic may not be iterating enough times to propagate indirect conditions
3. There may be an issue with the evaluation order of shop regions

**Next Steps**:
1. Check if other shop regions are being reached correctly in earlier spheres
2. Examine the StateManager's region reachability update logic
3. May need to add special handling for indirect/circular region dependencies

**Progress**:
- Test successfully reached Sphere 3.10 (previously failed at Sphere 0.3)
- All helper functions are implemented and working correctly
- No "Helper function not found" errors in test output
