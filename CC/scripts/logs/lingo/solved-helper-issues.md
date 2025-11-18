# Lingo - Solved Helper Issues

## 1. lingo_can_use_entrance was checking global items instead of item_by_door

**Fixed in:** frontend/modules/shared/gameLogic/lingo/lingoLogic.js

**Problem:**
The `lingo_can_use_entrance` and `_lingo_can_open_door` helper functions were checking if a door item existed in the global item pool, then checking if the player had it. This was incorrect because many doors have items in the pool but don't actually require them - they only require meeting access requirements specified in `door_reqs`.

**Root Cause:**
The helpers were using:
```javascript
const doorItemExists = items && (doorItemName in items);
if (doorItemExists) {
  // Check if player has the item
  return hasItem;
}
```

This checked the global `items` object, but should have been checking `settings.item_by_door` which lists only the doors that actually require items.

**Solution:**
Changed the logic to:
1. First check door_reqs requirements (rooms, colors, items, progression, etc.)
2. Then check if the door is listed in item_by_door
3. If in item_by_door, check if player has the required item
4. Return true if all requirements are met

**Note:** This fixed the logic but there's still an exporter issue preventing the test from passing (see remaining-exporter-issues.md).
