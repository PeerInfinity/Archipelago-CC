# Blasphemous Exporter Issues (Remaining)

## Analysis Date
2025-11-19

## Current Status
- Generation script: PASSING (no errors during generation)
- Test status: FAILING at Sphere 0

## Issues Found

### Issue 1: Test Infrastructure - Region/Location Confusion
**Priority**: HIGH
**Type**: Test Infrastructure / State Manager

**Description**:
The spoiler test is failing at Sphere 0 with a report that says:
"Locations accessible in STATE but NOT in LOG (should be empty): CO01, CO05, CO11..."

However, these identifiers (CO01, CO05, etc.) are REGION names, not location names. The error message is confusing because it says "Locations" but lists regions.

Looking at the sphere log, Sphere 0 correctly shows:
- Starting items: Dash Ability, Wall Climb Ability
- 82 accessible locations
- 400+ accessible regions

The Python backend and the exported data appear correct. The issue may be in how the JavaScript test harness or StateManager is comparing regions vs locations.

**Investigation needed**:
1. Check if StateManager is correctly distinguishing between regions and locations
2. Verify that the test comparison logic is matching the right data structures
3. Confirm that region reachability is being computed correctly

**Related files**:
- `frontend/modules/shared/stateManager.js`
- `tests/e2e/testSpoilerUI.js`
- `exporter/games/blasphemous.py`

## Notes

The exporter appears to be working correctly:
- All items are exported with proper metadata
- Regions and exits are properly structured
- Access rules are being converted from Python to JSON format
- Starting items are correctly set (Dash Ability, Wall Climb Ability)
- Difficulty setting is properly exported (difficulty: 1)

The sphere log shows consistent progression with the starting abilities allowing access to most of the early game areas, which is expected game behavior.
