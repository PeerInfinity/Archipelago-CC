# Remaining Helper Issues for Wargroove

This file tracks issues related to helper functions that need to be implemented.

## Issues

### Issue #1: Missing Helper Functions for Wargroove Logic

**Status**: Identified
**Priority**: High
**Type**: Helper Implementation

**Description**:
The test fails at Sphere 0.1 with the error "Access rule evaluation failed" for location "Corrupted Inlet: Victory". The frontend rule engine cannot evaluate the location's access rules because the required helper functions are not implemented.

**Required Helper Functions**:
Based on `worlds/wargroove/Rules.py` lines 8-16, the following helper functions need to be implemented:
1. `_wargroove_has_item(player, item)` - Check if player has a specific item
2. `_wargroove_has_region(player, region)` - Check if player can reach a specific region
3. `_wargroove_has_item_and_region(player, item, region)` - Check both item and region access

**Test Failure**:
- Sphere 0.1: "Corrupted Inlet: Victory" not accessible (requires Barge OR Merfolk OR Warship)
- Region "Robbed" not accessible (requires completing Corrupted Inlet)

**Location Using These Helpers**:
Many locations use `_wargroove_has_item` and `_wargroove_has_item_and_region`:
- Lines 49-50, 54-57, 61-64: Various locations requiring specific items
- Lines 116-152: Locations requiring both items AND regions (Surrounded, Darkest Knight, Robbed, etc.)

**Solution Approach**:
Create `frontend/modules/shared/gameLogic/wargroove/helpers.js` with implementations of these helper functions following the pattern used in other games (e.g., `generic/genericLogic.js`).
