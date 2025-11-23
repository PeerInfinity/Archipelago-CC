# Remaining Helper Issues for Super Metroid

## Issue 1: Regions requiring Super Missile not accessible at Sphere 3.1

**Status**: In progress
**Priority**: High
**Category**: Helper logic

### Problem
When the player collects a Super Missile at Sphere 3.1, regions that require passing through green doors (which need Super Missiles) are not becoming accessible.

Expected at Sphere 3.1 (per sphere log):
- Big Pink, Business Center, Charge Beam, East Tunnel Right, etc. (39 regions total)

Actual: These regions remain inaccessible

### Root Cause
**FOUND**: The inventory is not being updated when items are collected during spoiler test playback.

### Detailed Analysis
1. **SMBool unwrapping**: ✓ FIXED - Added SMBool unwrapping in `executeHelper()` in `frontend/modules/stateManager/core/ruleEvaluator.js:114-120`
2. **Helper exports**: ✓ FIXED - Removed incorrect `helpers.js` file, using `smLogic.js` exports directly
3. **Helper logic**: ✓ WORKING - `haveItem('Super')` correctly finds 'Super Missile' by checking type field
4. **Inventory update**: ✗ BROKEN - Inventory shows `{'Super Missile': 0}` when it should be `{'Super Missile': 1}`

### Evidence
From browser debug logs:
```
[haveItem] Checking for Super - inventory has 33 items
[haveItem] Keys containing Super/Missile: [Missile, Super Missile]
[haveItem] Super Missile count: 0  ← Should be 1!
[haveItem] Found item with matching type for Super: {fullItemName: Super Missile, type: Super}
[haveItem] Inventory check result for Super Missile: false
```

From sphere log (Sphere 3.1):
```json
"new_inventory_details": {"base_items": {"Super Missile": 1}}
```

### Files Involved
- `frontend/modules/testSpoilers/eventProcessor.js` - Processes sphere events, should add items to inventory
- `frontend/modules/stateManager/core/inventoryManager.js` - Handles `addItemToInventory()`
- `frontend/modules/shared/gameLogic/sm/smLogic.js` - Helper functions (confirmed working)

### Next Steps
1. Check if `add_sphere_items_upfront` setting is true for SM
2. Add logging to `eventProcessor.js` to see if `addItemToInventory()` is called
3. Check if there's a timing issue between adding items and computing reachability
4. Verify the spoiler test is using the correct mode for SM items
