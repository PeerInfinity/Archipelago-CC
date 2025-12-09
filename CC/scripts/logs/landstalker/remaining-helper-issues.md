# Remaining Helper Issues for Landstalker

## Status: No Issues

As of 2025-12-09, all spoiler tests pass for Landstalker - The Treasures of King Nole.

The helper functions correctly handle:
- `has` - Basic item checking with progressive item support
- `count` - Item counting
- `_landstalker_has_visited_regions` - Region visit checking
- `_landstalker_has_health` - Health (Life Stock) checking

## Test Results

- **Total spheres tested**: 53
- **Passed**: 53
- **Failed**: 0
- **Error count**: 0

## Helper Implementation

The helper functions are implemented in `frontend/modules/shared/gameLogic/landstalker/landstalkerLogic.js`:

### Core Functions

1. **`has(snapshot, staticData, itemName)`**: Checks item ownership including:
   - Direct inventory checks
   - Event/flag checks
   - Progressive item resolution

2. **`count(snapshot, staticData, itemName)`**: Returns the count of a specific item in inventory

### Game-Specific Helpers

3. **`_landstalker_has_visited_regions(snapshot, staticData, regions)`**:
   - Checks if player has visited all required regions
   - Handles undefined/null regions as "no requirement"
   - Supports both region objects and region code strings

4. **`_landstalker_has_health(snapshot, staticData, health)`**:
   - Checks if player has enough Life Stock items
   - Equivalent to `state.has("Life Stock", player, health)`
