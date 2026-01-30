# Secret of Evermore - Remaining Helper Issues

Last updated: 2026-01-30

## Status

No known helper issues. All tests pass successfully with both default settings and advanced options (fragments mode, logic-based OOB/sequence breaks).

## Verified Working

- `frontend/modules/shared/gameLogic/soe/soeLogic.js` - Custom helper functions for SOE

### Helper Functions

1. **`has(snapshot, staticData, progressId, requiredCount)`**
   - Checks if player has reached a certain progress count
   - Handles special progress IDs (P_ALLOW_OOB, P_ALLOW_SEQUENCE_BREAKS) via settings check
   - Handles energy core fragments mode

2. **`count(snapshot, staticData, itemName)`**
   - Counts how many of an item the player has

3. **`location_item_name(snapshot, staticData, locationName)`**
   - Gets the item placed at a specific location (for self-locking logic)

### Internal Functions

- **`countProgress(snapshot, staticData, progressId, visitedRules)`**
  - Counts progress units from inventory items
  - Evaluates logic rules with recursion protection
  - Special handling for setting-based progress IDs (25=P_ALLOW_OOB, 26=P_ALLOW_SEQUENCE_BREAKS)
  - Maximum recursion depth of 10 to prevent infinite loops

## Notes

The SOE helper system works with pyevermizer's progress system where:
- Items provide progress IDs when collected
- Logic rules grant additional progress when requirements are met
- Access rules check if the player has sufficient progress
- Setting-based progress (OOB, sequence breaks) is determined by game options
