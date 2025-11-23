# Super Metroid - Remaining General Issues

## Overview
This document tracks general issues that don't fit into exporter or helper categories.

## Issues

### Issue 1: Region Mismatch at Sphere 3.1

**Severity:** Critical
**Category:** Logic Evaluation / State Management
**First Detected:** Initial test run

**Description:**
Test fails at Sphere 3.1 with massive region mismatch. After collecting "Energy Tank, Gauntlet" in Sphere 2.1, the player should receive a Super Missile in Sphere 3.1, which should unlock many new regions. However, the frontend state manager is not making these regions accessible.

**Expected Behavior (from sphere log):**
In Sphere 3.1, after receiving Super Missile, the following should become accessible:
- **Locations:** Bomb, Charge Beam, Energy Tank (Hi-Jump Boots), Hi-Jump Boots, Kraid, Missile (Hi-Jump Boots), Missile (green Brinstar behind missile), Missile (green Brinstar behind reserve tank), Missile (green Brinstar below super missile), Missile (green Brinstar pipe), Missile (pink Brinstar bottom), Missile (pink Brinstar top), Power Bomb (red Brinstar spike room), Reserve Tank Brinstar, Spazer, Spore Spawn, Super Missile (green Brinstar top), Super Missile (pink Brinstar)
- **Regions:** Big Pink, Business Center, Charge Beam, East Tunnel Right, East Tunnel Top Right, Energy Tank (Hi-Jump Boots), Energy Tank Brinstar Gate, Energy Tank Kraid, Energy Tank Waterway, Golden Four, Green Hill Zone Top Right, Hi-Jump Boots, Ice Beam, Keyhunter Room Bottom, Kraid, KraidRoomIn, KraidRoomOut, Missile (Hi-Jump Boots), Missile (Kraid), Missile (below Ice Beam), Missile (green Brinstar pipe), Missile (pink Brinstar bottom), Missile (pink Brinstar top), Missile (red Brinstar spike room), Mother Brain, Noob Bridge Right, Power Bomb (pink Brinstar), Power Bomb (red Brinstar sidehopper room), Power Bomb (red Brinstar spike room), Red Brinstar Elevator, Red Tower Top Left, Spazer, Spore Spawn, Super Missile (pink Brinstar), Varia Suit, Warehouse Entrance Left, Warehouse Entrance Right, Warehouse Zeela Room Left, X-Ray Scope

**Actual Behavior:**
None of these regions become accessible in the frontend state.

**Error Message:**
```
REGION MISMATCH found for: {"type":"state_update","sphere_number":"3.1","player_id":1}
> Regions accessible in LOG but NOT in STATE: [38 regions listed above]
```

**Root Cause Identified:**
The issue is with green door traversal. The path to unlock Sphere 3.1 regions is:

1. Landing Site (accessible from start) →
2. `traverse("LandingSiteRight")` [GREEN DOOR] → Keyhunter Room Bottom →
3. Various downstream regions (Red Brinstar Elevator, Red Tower Top Left, Noob Bridge Right, Green Hill Zone Top Right, Big Pink, Business Center, etc.)

The door "LandingSiteRight" is a **green door**, which requires Super Missiles to pass.

**Confirmed Facts:**
- ✅ Item "Super Missile" has type "Super" in rules.json
- ✅ Door "LandingSiteRight" is colored "green" in game_info.doors
- ✅ `traverse()` function exists in smLogic.js
- ✅ `canOpenGreenDoors()` exists and calls `haveItem(snapshot, staticData, 'Super')`
- ✅ `haveItem()` function exists and should find items by type

**Investigation Needed:**
1. Verify `traverse()` correctly calls `canOpenGreenDoors()` for green doors and returns SMBool
2. Verify `haveItem('Super')` is finding "Super Missile" by its type and returns SMBool
3. Debug actual inventory state during Sphere 3.1 update to see if "Super Missile" is present
4. Check if SMBool return values are being properly handled by rule evaluation

**Related Files:**
- `frontend/modules/shared/gameLogic/sm/smLogic.js` - Helper functions (traverse, canOpenGreenDoors, haveItem)
- `frontend/modules/shared/ruleEngine.js` - Rule evaluation
- `frontend/modules/stateManager/` - State management
- `frontend/presets/sm/AP_14089154938208861744/AP_14089154938208861744_rules.json` - Rules data (door colors, item types)
- `frontend/presets/sm/AP_14089154938208861744/AP_14089154938208861744_spheres_log.jsonl` - Expected behavior

**Next Steps:**
1. Add console.log debugging to haveItem, canOpenGreenDoors, and traverse functions
2. Re-run spoiler test and examine browser console output
3. Verify that SMBool objects are being correctly evaluated
4. If needed, fix any issues with SMBool handling or item type lookups
