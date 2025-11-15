# Lingo - Remaining Exporter Issues

This file tracks outstanding issues related to the Lingo game exporter (`exporter/games/lingo.py`).

## Issues

### 1. Unresolved variable references in access rules (PARTIAL FIX)

**Status**: Partially Fixed - Data exported, rule engine update needed
**Severity**: Critical
**File**: `exporter/games/lingo.py` and rule engine

**Description**:
Exit access rules contain unresolved variable references that prevent the rule engine from properly evaluating region accessibility. These variables appear in complex conditional expressions:

- `door` - door parameter from lingo_can_use_entrance calls
- `room` - room name parameter
- `world` - world object reference
- `item_name` - door item name
- `PROGRESSIVE_ITEMS` - global constant
- `PROGRESSIVE_DOORS_BY_ROOM` - world data structure

**Example problematic rule**:
```json
{
  "type": "conditional",
  "test": {
    "type": "compare",
    "left": {"type": "name", "name": "door"},
    "op": "is",
    "right": {"type": "constant", "value": null}
  },
  "if_true": {"type": "constant", "value": true},
  "if_false": { ... nested conditionals with more unresolved names ... }
}
```

**Impact**:
- Regions not being marked as accessible from Menu
- All regions accessible in sphere 0 are failing
- Test fails at very first sphere check

**Work completed**:
1. ✅ Added `get_settings_data` method to export door-related data structures:
   - `item_by_door` - maps room -> door -> item name  (1 room)
   - `door_reqs` - maps room -> door -> AccessRequirements (95 rooms)
   - `PROGRESSIVE_ITEMS` - list of 9 progressive item names
   - `PROGRESSIVE_DOORS_BY_ROOM` - maps room -> door -> progression info

2. ✅ Added `postprocess_entrance_rule` method to simplify entrance rules:
   - Extracts door information from entrance names
   - Simplifies "if door is None" conditionals
   - Replaces 'room' variable references with actual room names
   - Converts world.player_logic.door_reqs lookups to settings.door_reqs lookups

**Remaining work**:
- Further simplify entrance rules by evaluating `item_by_door.get(room)` checks at export time
- Update rule engine to handle remaining unresolved variable patterns (`world`, nested function calls)
- OR complete full evaluation of entrance logic at export time to produce simple rules
