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

### Next Steps
1. Verify that the item is correctly added to the inventory in the JavaScript state
2. Check if the item_check rule evaluator handles special characters correctly
3. Add debug logging to see what the inventory contains vs what the rule is checking for
4. Consider if the item name needs to be escaped or normalized

### Related Files
- Exporter: `exporter/games/mmbn3.py`
- Frontend helpers: `frontend/modules/shared/gameLogic/mmbn3/helpers.js`
- Rule engine: `frontend/modules/shared/ruleEngine.js`
- State manager: `frontend/modules/state/stateManager.js`
