# SM64EX Remaining Helper Issues

## Issue 1: Missing can_reach_region helper

**Status:** In Progress
**Priority:** High
**Sphere Failure:** 0.1

### Problem
The frontend doesn't have a `can_reach_region` helper function.

### Evidence
Test error: "Helper function \"can_reach_region\" NOT FOUND in snapshotInterface"

### Solution Needed
Create helper functions file at `frontend/modules/shared/gameLogic/sm64ex/helpers.js` with:
- `can_reach_region(region_name)` - Check if a region is reachable
- `can_reach_location(location_name)` - Check if a location is accessible
- `has_all_items(items)` - Check if player has all items in array
- `has_any_item(items)` - Check if player has any item in array

## Issue 2: Missing has_all_items helper

**Status:** Not started
**Priority:** Medium

Similar to Issue 1 - needs implementation.

## Issue 3: Missing has_any_item helper

**Status:** Not started
**Priority:** Medium

Similar to Issue 1 - needs implementation.

## Issue 4: Missing can_reach_location helper

**Status:** Not started
**Priority:** Medium

Similar to Issue 1 - needs implementation.
