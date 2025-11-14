# Remaining Helper Issues for The Messenger

This file tracks helper function issues that still need to be fixed.

## Status
Second test run completed. Helper structure working, but implementation incomplete.

## Issue 1: `can_afford` helper function - Implementation incomplete

**Current Status**: PARTIALLY FIXED
- ✅ Exporter updated to convert `can_afford` variable to helper function call
- ✅ Shop location `cost` attribute now exported in rules.json
- ✅ Helper function created in `frontend/modules/shared/gameLogic/messenger/messengerLogic.js`
- ✅ Messenger logic registered in `gameLogicRegistry.js`
- ❌ Helper implementation currently always returns `true` (temporary)

**Problem**: The helper needs to check if the player has enough "Shards" to afford the shop item.

**Python Logic**:
```
can_afford = state.has("Shards", player, min(self.cost, world.total_shards))
```

**JavaScript Challenge**: The helper receives `(snapshot, staticData, ...args)` but needs access to:
1. The `cost` of the current location being evaluated (now in location.cost)
2. The `total_shards` value (sum of Time Shard items >= 100 in itempool)

**Test Results**:
- All shop locations incorrectly show as accessible in Sphere 0
- Should only be accessible when player has sufficient shards

**Next Steps**:
1. Determine how to pass location context (including cost) to the helper
2. Calculate total_shards from itempool_counts
3. Implement proper shard count checking: `has("Shards", player, min(cost, total_shards))`

**Files Modified**:
- `exporter/games/messenger.py`: Added `get_location_attributes()` and `expand_rule()`
- `frontend/modules/shared/gameLogic/messenger/messengerLogic.js`: Created with temporary implementation
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js`: Added Messenger registration
