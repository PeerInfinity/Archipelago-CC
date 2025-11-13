# Pokemon Emerald - Solved General Issues

## Issue 1: Missing `has_group_unique` state method

**Status**: Solved
**Priority**: High
**Sphere**: Was failing at Sphere 6.2
**Solved**: 2025-11-13

### Description
The spoiler test was failing at Sphere 6.2 because the `has_group_unique` state method was not implemented in the frontend.

### Details
- **Locations not accessible**: EVENT_DEFEAT_NORMAN, Petalburg Gym - Balance Badge
- **Regions not reachable**: REGION_PETALBURG_CITY_GYM/ROOM_2 through ROOM_9
- **Root cause**: Access rules use `state.has_group_unique("Badge", player, count)` which was not implemented in the frontend

### Example Rule
```json
{
  "type": "state_method",
  "method": "has_group_unique",
  "args": [
    {"type": "constant", "value": "Badge"},
    {"type": "constant", "value": 4}
  ]
}
```

### Solution Implemented
Added `has_group_unique` implementation in three files:

1. **frontend/modules/shared/stateInterface.js**: Added method to executeStateManagerMethod for proxy/snapshot interface
2. **frontend/modules/stateManager/stateManager.js**: Added method that delegates to InventoryModule
3. **frontend/modules/stateManager/core/inventoryManager.js**: Added core implementation

The method:
1. Accepts a group name and count as arguments
2. Gets all items in the group from itemData
3. Counts how many unique items from that group are in the inventory (counts each item type only once, regardless of stack size)
4. Returns true if unique count >= required count

### Files Modified
- `frontend/modules/shared/stateInterface.js:649-713` - Added has_group_unique in executeStateManagerMethod
- `frontend/modules/stateManager/stateManager.js:770-772` - Added method delegation
- `frontend/modules/stateManager/core/inventoryManager.js:464-508` - Added core implementation

### Verification
After implementing this fix, the spoiler test now passes Sphere 6.2 and progresses to Sphere 8.11.
