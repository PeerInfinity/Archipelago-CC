# Remaining Blasphemous Helper Issues

## Issue 1: Test comparing regions as locations in sphere 0

**Status**: Root cause identified - NOT a helper issue, but a test infrastructure bug

**Description**: The spoiler test fails at sphere 0 with hundreds of "locations" being accessible in the JavaScript STATE but not in the Python-generated sphere LOG.

**Root Cause Identified**:
The error message lists approximately 450+ items as "accessible locations", but these are actually a mix of:
- **79 actual locations** (correctly accessible in both Python and JavaScript)
- **383 regions** (being incorrectly treated as locations by the test)

The Python backend correctly reports:
- 79 accessible locations
- 383 accessible regions

But the JavaScript test infrastructure is somehow conflating regions with locations, reporting 462 total "accessible locations" when it should only report 79.

**Evidence**:
1. Checked rules.json: Total of 305 location definitions, 1031 region definitions
2. Locations like "Boss - Esdras (NG+)" don't exist anywhere in rules.json
3. Items like "D01Z02S05[E]", "HE06", "QI41", "RB08", "RESCUED_CHERUB_08" exist as REGION names, not location names
4. Python sphere log correctly separates:
   - `new_accessible_locations`: 79 items (actual location names like "Albero: Graveyard")
   - `new_accessible_regions`: 383 items (region codes like "D01Z02S05[E]", "HE06", etc.)

**Affected Components**:
- `/home/user/Archipelago-CC/frontend/modules/testSpoilers/comparisonEngine.js` - `compareAccessibleLocations()` function
- Possibly the StateManager's location/region tracking

**Next Steps**:
1. ~~BLOCKED~~ This is NOT a helper issue - it's a test infrastructure issue
2. Need to investigate how `staticData.locations` is populated
3. Check if regions are being added to the locations map during initialization
4. Fix the test code to properly separate locations from regions

**Classification**: This should be moved to "remaining-general-issues.md" as it's a test infrastructure problem, not a helper function problem.

Last updated: 2025-11-17
