# Remaining Helper Issues for Lingo

## Issue 1: lingo_can_use_entrance - doors without items

**Status:** Partially Fixed
**Priority:** High (causes incorrect sphere progression)

**Description:**
The `lingo_can_use_entrance` helper function in `frontend/modules/shared/gameLogic/lingo/lingoLogic.js` has been partially implemented. It now:
- Returns `true` for null/undefined doors (correct)
- Checks if a door has an associated item and verifies the player has it
- Returns `true` for doors without items (too permissive)

The issue is that doors without associated items still have access requirements that need to be checked. Currently, these doors are treated as always accessible, which causes too many regions to be reachable in sphere 0.

**Evidence:**
- Spoiler test fails at sphere 0
- Many locations accessible in STATE but not in LOG (155+ locations)
- Regions accessible too early due to assuming non-item doors are always open

**Door types:**
1. **Doors with items** (e.g., "Starting Room - Back Right Door"):
   - ✅ Correctly checks if player has the door item

2. **Doors without items** (e.g., "Starting Room - Main Door", painting shortcuts):
   - ❌ Currently returns `true` (always accessible)
   - Should check door's access requirements from `door_reqs` data

**Required fix:**
Need to export `door_reqs` and `item_by_door` data from the Python exporter:
- `item_by_door`: maps `{room: {door: item_name}}` - indicates which doors have items
- `door_reqs`: maps `{room: {door: AccessRequirements}}` - for doors without items

Then update the helper to:
1. Check if door has an item (using item_by_door data)
2. If yes, check if player has that item
3. If no, evaluate the door's access requirements from door_reqs

**Location in code:**
- File: `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`
- Function: `lingo_can_use_entrance`
- Lines: 14-54

**Python reference:**
- File: `worlds/lingo/rules.py`
- Function: `_lingo_can_open_door` (lines 77-89)
- Uses: `world.player_logic.item_by_door` and `world.player_logic.door_reqs`

## Issue 2: lingo_can_use_location placeholder implementation

**Status:** Not Fixed
**Priority:** Medium (may cause issues but masked by Issue 1)

**Description:**
The `lingo_can_use_location` helper function is still a placeholder returning `true`. This function needs to evaluate AccessRequirements objects.

**Required fix:**
Implement proper AccessRequirements evaluation logic.

**Location in code:**
- File: `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`
- Function: `lingo_can_use_location`
- Lines: 56-62
