# Remaining Exporter Issues for Lingo

## Issue 1: Export door_reqs and item_by_door data

**Status:** Not Fixed
**Priority:** High (required for proper door checking)

**Description:**
The frontend helper functions need access to `door_reqs` and `item_by_door` data from `world.player_logic` to properly check door accessibility. Currently, this data is not being exported to the rules.json file.

**Required data to export:**
1. **item_by_door**: Dictionary mapping `{room: {door: item_name}}`
   - Indicates which doors have associated items that must be collected
   - Example: `{"Starting Room": {"Back Right Door": "Starting Room - Back Right Door"}}`

2. **door_reqs**: Dictionary mapping `{room: {door: AccessRequirements}}`
   - Provides access requirements for doors without associated items
   - These are the doors that are accessible through other means (solving panels, reaching regions, etc.)

**Python source:**
- Location: `worlds/lingo/player_logic.py`
- Attributes: `LingoPlayerLogic.item_by_door` and `LingoPlayerLogic.door_reqs`
- Used by: `worlds/lingo/rules.py` function `_lingo_can_open_door()`

**Export location:**
Should be exported as part of the settings data for each player:
```json
{
  "settings": {
    "1": {
      "game": "Lingo",
      "door_data": {
        "item_by_door": {...},
        "door_reqs": {...}
      }
    }
  }
}
```

**Implementation notes:**
- The data should be exported in the Lingo-specific exporter: `exporter/games/lingo.py`
- May need to add a method to export custom game data
- door_reqs AccessRequirements objects will need to be serialized to JSON format

Currently working features:
- AccessRequirements string sorting
- Door variable resolution (simplifies door=None to constant True)
