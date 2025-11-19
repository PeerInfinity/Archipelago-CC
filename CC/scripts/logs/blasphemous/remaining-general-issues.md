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

**Hypothesis Refined**:
The Python sphere log shows Sphere 0 contains 400+ regions in `new_accessible_regions`. These regions ARE correctly in the log. The test error suggests these regions are accessible in the JavaScript STATE but somehow not being matched against the LOG.

Possible causes:
- StateManager may be initializing regions before Sphere 0 comparison
- Region reachability calculation may be running during initialization
- Test may be comparing against wrong sphere data
- Regions may need to be excluded from Sphere 0 comparison (like "Menu" region for some games)

**Next Steps**:
1. Check if StateManager pre-populates regionReachability during initialization
2. Verify that Sphere 0 comparison is using the right sphere data from the log
3. Check if Blasphemous needs special region filtering like CvCotM (Menu region)
4. Add debug logging to see what regions are in LOG vs STATE at Sphere 0

**Related Files**:
- `frontend/modules/shared/stateManager.js` - Check initialization
- `frontend/modules/testSpoilers/eventProcessor.js` - Check Sphere 0 handling
- `frontend/modules/testSpoilers/comparisonEngine.js` - Check region comparison
- `frontend/modules/sphereState/sphereState.js` - Verified correct
