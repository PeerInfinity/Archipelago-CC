# MegaMan Battle Network 3 - Remaining Exporter Issues

## Issue 1: Location access rule fails for item with special characters

**Status**: Under Investigation
**Priority**: High
**Sphere**: 3.2
**Location**: Job: My Navi is sick
**Region**: SciLab Overworld

### Description
The location "Job: My Navi is sick" has an access rule that requires the item "Recov30 *". The item exists in the game and is correctly defined in the items list. However, the JavaScript frontend is not recognizing the location as accessible even when the player has the item in their inventory.

### Access Rule
```json
{
  "type": "item_check",
  "item": "Recov30 *"
}
```

### Item Definition
```json
{
  "name": "Recov30 *",
  "id": 11735131,
  "groups": ["BattleChips", "Everything"],
  "advancement": true,
  "useful": false,
  "trap": false,
  "event": false,
  "type": null,
  "max_count": 2
}
```

### Expected Behavior
According to sphere log, at Sphere 3.2:
- Player receives "Recov30 *" (count: 1) from location "Job: Legendary Tomes - Treasure"
- Location "Job: My Navi is sick" should become accessible

### Actual Behavior
- Location is accessible in Python backend (LOG)
- Location is NOT accessible in JavaScript frontend (STATE)
- Error: "Locations accessible in LOG but NOT in STATE (or checked): Job: My Navi is sick"
- Issue: "Access rule evaluation failed"

### Hypothesis
The item name contains special characters (space and asterisk: "Recov30 *"). This may be causing issues in:
1. Item name matching in the inventory system
2. Item name handling in the rule evaluator
3. JSON string escaping/parsing

### Debug Investigation Results
Through extensive debug logging, I discovered:

1. **Inventory State**: The inventory object contains the key "Recov30 *" but its count is 0
   - `hasItem("Recov30 *")` returns `false` (count=0)
   - All items with asterisks are initialized in the inventory

2. **Item Not Being Added**: The item is never added to inventory during the test
   - `addItemToInventory("Recov30 *")` is never called
   - `checkLocation("Job: Legendary Tomes - Treasure")` is never called
   - `_addItemToInventory("Recov30 *")` is never called

3. **EventProcessor Not Processing Location**: The spoiler test's eventProcessor doesn't process this location
   - The location should be in sphere_locations at sphere 3.2
   - But it's not being checked by the event processor loop

### Root Cause Hypothesis
The spoiler test is not correctly processing sphere 3.2 locations. Either:
1. The sphere log is not being read correctly
2. The location is being skipped due to some filtering logic
3. There's an issue with how sphere_locations are extracted from the sphere log

### Next Steps
1. Add debug logging to see what sphere_locations are actually in the sphere log for sphere 3.2
2. Check if the eventProcessor is filtering out this location for some reason
3. Verify the sphere log format matches what the eventProcessor expects
4. Check if this is a single-player vs multiworld issue (the sphere log format differs)

### Related Files
- Exporter: `exporter/games/mmbn3.py`
- Frontend helpers: `frontend/modules/shared/gameLogic/mmbn3/helpers.js`
- Rule engine: `frontend/modules/shared/ruleEngine.js`
- State manager: `frontend/modules/state/stateManager.js`
