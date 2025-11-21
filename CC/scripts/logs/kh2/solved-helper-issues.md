# KH2 Solved Helper Issues

## Issue 2: Data Axel Region Not Accessible (Sphere 14.1)

**Status:** FIXED
**Sphere:** 14.1
**Fixed Date:** 2025-11-21

### Description
The "Data Axel" region was not accessible because the helper used `kh2_can_reach` to check for "Limit level 5" location, but this method checks if a location is already marked reachable, not if it can be reached based on current inventory.

### Root Cause
The Python code uses `state.can_reach()` which does forward-looking evaluation to determine if a location CAN be reached given current inventory. The JavaScript `kh2_can_reach` only checks if a location is already in the `locationReachability` map.

During exit evaluation, "Limit level 5" hasn't been marked as reachable yet in the current cycle, so the check fails even though the player has all required items.

### Fix
Replaced the `kh2_can_reach(snapshot, staticData, 'Limit level 5')` call with the actual requirement check: `form_list_unlock(snapshot, staticData, 'Limit Form', 3, false)`.

This directly checks if the player has Limit Form with level 3 requirements met, which is what "Limit level 5" location requires (from worlds/kh2/Rules.py:332).

### Files Modified
- `frontend/modules/shared/gameLogic/kh2/kh2Logic.js:1440-1469` - Updated get_data_axel_rules()

---

## Issue 1: Data Xaldin Region Not Accessible (Sphere 13.5)

**Status:** FIXED
**Sphere:** 13.5
**Fixed Date:** 2025-11-21

### Description
The "Data Xaldin" region was not accessible due to incorrect item names in the NORMAL_DATA_XALDIN, EASY_DATA_XALDIN, and HARD_DATA_XALDIN dictionaries.

### Root Cause
The JavaScript code was using "Flare Force" and "Fantasia" instead of the correct item names "Donald Flare Force" and "Donald Fantasia".

### Fix
Updated the item names in:
- EASY_DATA_XALDIN dictionary
- NORMAL_DATA_XALDIN dictionary
- PARTY_LIMIT array

Changed:
- 'Flare Force' → 'Donald Flare Force'
- 'Fantasia' → 'Donald Fantasia'

### Files Modified
- `frontend/modules/shared/gameLogic/kh2/kh2Logic.js:37-88`
