# SMZ3 Multiclient Test Debugging Notes

## Test Results Summary

**Test Command:**
```bash
python scripts/test/test-all-templates.py --include-list "SMZ3.yaml" --multiclient --single-client
```

**Results:**
- Spoiler test: **PASS** (16.2/16.2 spheres)
- Multiclient test: **FAIL** (70/316 locations checked)

## Investigation Findings

### What Works

1. **Spoiler test passes completely** - The rule engine, helper functions, and sphere progression all work correctly when simulating item collection.

2. **Item names match** - The Python server (`ItemType.name`) and JavaScript frontend use identical item names:
   - Morph: id=84180 (0xB4 + 84000)
   - PowerBomb: id=84196 (0xC4 + 84000)
   - Super: id=84195 (0xC3 + 84000)
   - etc.

3. **Helper functions are registered** - SMZ3 helpers like `smz3_CanUsePowerBombs`, `smz3_HasEnergyReserves`, etc. are correctly registered in `gameLogicRegistry.js`.

4. **Rules structure is correct** - Location access_rules use proper helper calls and item_checks.

5. **Starting items are defined** - 16 Card items (CardCrateriaL1, etc.) that should unlock initial Super Metroid regions.

### What Fails

The multiclient test stalls at 70/316 locations with these symptoms:

1. **Initial progress**: 70 locations checked in ~14 seconds
2. **Timer stops**: No more accessible locations found
3. **Multi-pass attempts**: 5 passes, each finding 65 "newly accessible" locations (regions reachable) but unable to check them
4. **Final state**: Timer completes but test fails

### Key Observation

The 65 "newly accessible" locations have:
- **Region reachability = TRUE** (computed by `computeReachableRegions`)
- **Location accessibility = FALSE** (access_rule evaluation fails)

This means regions are correctly becoming reachable as items are collected, but individual location access_rules are failing.

### Possible Root Causes

1. **DataPackage Timing Issue**: The ID-to-name mappings might not be initialized when ReceivedItems arrives from the server. If items are added as "Item 84180" instead of "Morph", helper functions won't find them.

2. **Snapshot Propagation Delay**: The timer on the main thread might use stale snapshots that don't reflect the latest inventory from the worker thread.

3. **Batch Update Commit Issue**: Items might be added during batch mode but the snapshot might not be sent after commit.

4. **Worker-Proxy Communication**: The `stateSnapshot` message might not be reaching the proxy correctly.

### Items at Sphere 0 Locations

Key progression items available in sphere 0:
- Morph (Eastern Palace - Compass Chest)
- PowerBomb (Floodgate Chest)
- Multiple Super missiles
- Multiple regular Missiles
- Grapple
- Ice beam
- Book
- Bottle

With Morph + PowerBomb, `smz3_CanUsePowerBombs()` should return true, unlocking many Super Metroid locations.

## Recommended Next Steps

1. **Add logging to ID mapping**: Log every item name mapping in `_handleReceivedItems` to verify correct mapping.

2. **Verify DataPackage initialization timing**: Ensure `initializeMappingsFromDataPackage` completes before any ReceivedItems are processed.

3. **Add inventory logging**: Log the inventory contents before each location accessibility check to verify items are present.

4. **Test with longer timer delay**: Instead of 0ms delay, try 100ms or 500ms to give more time for snapshot propagation.

5. **Add snapshot update logging**: Log when snapshots are sent from worker and received by proxy.

## Files Examined

- `/frontend/modules/shared/gameLogic/smz3/smz3Logic.js` - SMZ3 helper functions
- `/frontend/modules/shared/gameLogic/gameLogicRegistry.js` - Game registration
- `/frontend/modules/shared/stateInterface.js` - Snapshot interface and rule evaluation
- `/frontend/modules/shared/ruleEngine.js` - Rule evaluation logic
- `/frontend/modules/client/core/messageHandler.js` - Server message handling
- `/frontend/modules/client/utils/idMapping.js` - Item/location ID mapping
- `/frontend/modules/timer/timerLogic.js` - Timer logic
- `/frontend/modules/stateManager/core/batchUpdateManager.js` - Batch updates
- `/frontend/presets/smz3/AP_*/AP_*_rules.json` - SMZ3 rules file
- `/frontend/presets/smz3/AP_*/AP_*_sphere_log.jsonl` - Sphere progression log
