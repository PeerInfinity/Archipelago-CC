# Remaining Helper Issues for Stardew Valley

## Issue 1: "Received Progression Percent" Computation

**Status**: Identified
**Type**: Virtual Item State Computation
**Priority**: HIGH

**Description**:
The Stardew Valley game uses a special virtual event item called "Received Progression Percent" that represents the percentage of progression items the player has collected. This is not a regular item but a computed value.

**What needs to be implemented**:
1. The frontend StateManager needs to track progression item counts
2. When a progression item is added to inventory, update "Received Progression Percent"
3. Formula: `Received Progression Percent = (count of progression items collected) * 100 / total_progression_items`

**Implementation Location**:
The computation should likely happen in `frontend/modules/stateManager/core/inventoryManager.js` in the `addItemToInventory()` method or similar.

**Data Available**:
- The exporter adds `total_progression_items` to the game_info section
- The exporter marks items with `advancement: true` for progression items
- The virtual item "Received Progression Percent" is already in the items list with max_count: 100

**Test Case**:
After implementing, test with:
- Museumsanity: 3 Artifacts (requires 24% progression)
- Museumsanity: 5 Donations (unknown percentage, need to check rules)
- Museumsanity: 6 Artifacts (unknown percentage, need to check rules)
