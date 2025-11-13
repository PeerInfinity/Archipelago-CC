# Remaining Helper Issues for Castlevania 64

## Issues

### Issue 1: `location_item_name` helper - locationItems map is empty

**Test failure at:** Sphere 1.7

**Symptom:**
- Region "Villa: storeroom" is accessible in LOG but NOT in STATE
- Three locations unreachable:
  - Villa: Storeroom - Left
  - Villa: Storeroom - Right
  - Villa: Storeroom statue

**Root cause:**
- The entrance rule uses `location_item_name` helper for self-locking logic
- Helper function is implemented in `frontend/modules/shared/gameLogic/cv64/helpers.js`
- Helper is registered in gameLogicRegistry.js
- However, `staticData.locationItems` map is empty at runtime
- Need to find where location item placements are stored in the state manager's data structures

**Current Implementation:**
- Helper tries to access `staticData.locationItems[locationName]`
- This map exists but has no entries (`[]`)
- Need to access location items from a different source

**Possible Solutions:**
1. Use raw rules.json data instead of processed staticData
2. Access location items from snapshot or a different data structure
3. Check how other games handle location item queries
4. Investigate state manager initialization to ensure locationItems is populated

**Status:** Blocked - Need to understand state manager data structures better

**Files Modified:**
- `frontend/modules/shared/gameLogic/cv64/helpers.js` (created)
- `frontend/modules/shared/gameLogic/cv64/cv64Logic.js` (created)
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js` (updated)
