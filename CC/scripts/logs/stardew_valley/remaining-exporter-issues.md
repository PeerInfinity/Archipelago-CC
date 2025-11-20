# Remaining Exporter Issues for Stardew Valley

## Issue 1: "Received Progression Percent" Virtual Item

**Status**: Identified
**Type**: Virtual Item / State Computation
**Failing Locations**:
- Museumsanity: 3 Artifacts
- Museumsanity: 5 Donations
- Museumsanity: 6 Artifacts

**Description**:
The Stardew Valley exporter correctly exports "Received Progression Percent" as a virtual event item with max_count of 100. However, the frontend StateManager doesn't compute this value automatically.

In Python, the CollectionState.has() method dynamically calculates "Received Progression Percent" based on how many progression items the player has received out of the total progression items in the game.

**Root Cause**:
The virtual item "Received Progression Percent" needs to be computed by the frontend StateManager, not just tracked as a regular item. The StateManager needs special logic to update this value whenever progression items are collected.

**Solution**:
This is not an exporter issue - the exporter is working correctly. This is a StateManager/helper issue. The frontend needs to implement logic to compute "Received Progression Percent" dynamically.

**Files Involved**:
- `exporter/games/stardew_valley.py` (already correctly exports virtual item)
- `frontend/modules/stateManager/core/inventoryManager.js` (needs to compute virtual item)
- `frontend/modules/shared/gameLogic/stardew_valley/helpers.js` (may need helper)
