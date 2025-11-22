# Solved Helper Issues

## Issue 1: Missing boss-specific helper functions

**Symptom**: Test failed with errors:
```
Helper function 'smz3_CanBeatArmos' NOT FOUND
Helper function 'smz3_CanBeatMoldorm' NOT FOUND
```

**Root Cause**: SMZ3 exporter generated rules that call boss-specific helper functions, but these weren't implemented in smz3Logic.js

**Solution**: Added to `frontend/modules/shared/gameLogic/smz3/smz3Logic.js`:

1. **smz3_CanBeatArmos**: Delegates to generic `smz3_CanBeatBoss` function
   ```javascript
   export function smz3_CanBeatArmos(snapshot, staticData) {
     return smz3_CanBeatBoss(snapshot, staticData);
   }
   ```

2. **smz3_CanBeatMoldorm**: Requires ProgressiveSword or Hammer
   ```javascript
   export function smz3_CanBeatMoldorm(snapshot, staticData) {
     return hasItem(snapshot, staticData, 'ProgressiveSword') ||
            hasItem(snapshot, staticData, 'Hammer');
   }
   ```

**Files Modified**:
- `frontend/modules/shared/gameLogic/smz3/smz3Logic.js` - Added boss helper functions

**Result**: Test progressed from event 114 to event 118

---

## Issue 2: Missing Ganon's Tower navigation helpers

**Symptom**: Test failed with errors:
```
Helper function 'smz3_LeftSide' NOT FOUND
Helper function 'smz3_RightSide' NOT FOUND
```

**Root Cause**: SMZ3 Ganon's Tower regions require complex navigation logic that wasn't implemented

**Initial Failed Approach**:
Simple item checks (Hookshot OR Boots) were too permissive, causing locations to be accessible 3 spheres early (sphere 12.4 instead of 15.1)

**Correct Solution**:
Ganon's Tower navigation requires checking the **locations array parameter** to determine key requirements:
- If any location in the array contains BigKeyGT: need 3 KeyGT
- Otherwise: need 4 KeyGT

Added to `frontend/modules/shared/gameLogic/smz3/smz3Logic.js`:

1. **smz3_LeftSide**: Requires Hammer + Hookshot + KeyGT (count depends on BigKeyGT presence)
   ```javascript
   export function smz3_LeftSide(snapshot, staticData, locations) {
     const hasHammer = hasItem(snapshot, staticData, 'Hammer');
     const hasHookshot = hasItem(snapshot, staticData, 'Hookshot');

     if (!hasHammer || !hasHookshot) {
       return false;
     }

     // Check if any location in the list contains BigKeyGT
     let anyContainsBigKeyGT = false;
     if (locations && Array.isArray(locations)) {
       for (const loc of locations) {
         if (loc && loc.ItemIs && loc.ItemIs('BigKeyGT')) {
           anyContainsBigKeyGT = true;
           break;
         }
       }
     }

     const requiredKeys = anyContainsBigKeyGT ? 3 : 4;
     const keyCount = getItemCount(snapshot, staticData, 'KeyGT');

     return keyCount >= requiredKeys;
   }
   ```

2. **smz3_RightSide**: Requires Somaria + Firerod + KeyGT (count depends on BigKeyGT presence)
   - Same logic as LeftSide but with different item requirements

**Files Modified**:
- `frontend/modules/shared/gameLogic/smz3/smz3Logic.js` - Added Ganon's Tower navigation helpers
- Updated `evaluateSimpleRule` switch statement to call new helpers

**Python Source Reference**:
- `worlds/smz3/TotalSMZ3/Regions/Zelda/GanonsTower.py` - Original Python logic

**Result**:
- Locations now accessible at correct sphere (15.1 instead of 12.4)
- Full test passes all 120 events successfully
- No location accessibility mismatches

---

## Summary

All helper function issues have been resolved. The test now:
- Completes all 120 events successfully
- No helper function errors
- Correct sphere progression for all locations
- Zero mismatches between expected and actual behavior

