# Blasphemous General Issues (Remaining)

## Analysis Date
2025-11-19

## Current Status
- Test status: FAILING at Sphere 0

## Issues Found

### Issue 1: Test Failure at Sphere 0 - Region/Location Confusion
**Priority**: CRITICAL
**Category**: Test Infrastructure

**Description**:
The spoiler test fails immediately at Sphere 0 with an error message stating:
"Locations accessible in STATE but NOT in LOG (should be empty)"

However, the listed items are region identifiers (CO01, CO05, D01Z01S01[E], etc.), not location names.

**Error Details**:
- Sphere: 0
- Error type: Comparison failed for event type 'state_update'
- Listed items: Hundreds of region identifiers presented as "locations"

**Analysis**:
1. The sphere log shows Sphere 0 contains:
   - Starting items: Dash Ability, Wall Climb Ability
   - 82 accessible locations
   - 400+ accessible regions (all listed in new_accessible_regions)

2. The Python generation completed successfully with no errors

3. The region list in the error matches the regions shown in the sphere log

**Hypothesis**:
The test comparison logic may be incorrectly categorizing regions as locations, or there's a mismatch in how the StateManager vs the test harness tracks accessible regions.

**Investigation Results**:
1. ✅ sphereState.js correctly maps new_accessible_locations → accessibleLocations
2. ✅ sphereState.js correctly maps new_accessible_regions → accessibleRegions
3. ✅ comparisonEngine.js has separate functions for locations and regions
4. ✅ eventProcessor.js calls the right comparison functions with the right data
5. ✅ Exporter generates correct sphere log with regions in new_accessible_regions

**Root Cause FOUND**:
The Blasphemous sphere log includes 383 regions in Sphere 0's `new_accessible_regions`, including a "Menu" region.

Investigation revealed:
1. ✅ Sphere log correctly lists 383 regions including "Menu"
2. ✅ sphereState.js correctly parses and accumulates all regions for Sphere 0
3. ✅ StateManager correctly adds starting items (Dash Ability, Wall Climb Ability)
4. ✅ StateManager correctly computes region reachability

**THE ISSUE**:
The comparisonEngine.js (lines 351-358) has special handling to filter out the "Menu" region for CvCotM, but this filtering is NOT applied to Blasphemous. The "Menu" region is a structural region added by the exporter that appears in Python sphere logs but may be computed differently by the JavaScript StateManager.

Looking at the code:
```javascript
const isCvCotM = gameName === 'Castlevania - Circle of the Moon';
if (isCvCotM) {
  filteredStateAccessibleRegions = stateAccessibleRegions.filter(name => name !== 'Menu');
}
```

This special case needs to be extended to Blasphemous (and potentially other games that have a Menu region).

**Next Steps**:
1. ~~Check sphere log for Menu region~~ ✅ CONFIRMED: Menu is in Sphere 0
2. Update comparisonEngine.js to filter Menu region for Blasphemous
3. OR: Make Menu filtering game-agnostic (filter for all games)
4. Re-run test to verify fix

**Related Files**:
- `frontend/modules/shared/stateManager.js` - Check initialization
- `frontend/modules/testSpoilers/eventProcessor.js` - Check Sphere 0 handling
- `frontend/modules/testSpoilers/comparisonEngine.js` - Check region comparison
- `frontend/modules/sphereState/sphereState.js` - Verified correct
