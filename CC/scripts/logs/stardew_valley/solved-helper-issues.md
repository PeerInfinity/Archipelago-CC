# Stardew Valley - Solved Helper Issues

## Issue 1: Event Items with advancement=true Not Counted ✅ FIXED

### Problem
JavaScript was incorrectly excluding event items from progression tracking:

```javascript
if (!itemDef || !itemDef.advancement || itemDef.event) {
  // Skip event items
  return;
}
```

But Python's CollectionState counts ALL items with `advancement=true`, including event items like "Copper Ore (Logic event)".

### Impact
- JavaScript: Item 64 = Progressive Axe, Progression = 19%
- Python: Item 64 = Copper Ore (event), Item 65 = Progressive Axe, Progression = 20%
- This caused a 1-item offset in progression calculations
- Sphere 8.2 locations (requiring 20% progression) became inaccessible in JavaScript

### Solution
Modified `frontend/modules/shared/gameLogic/stardew_valley/stardewValleyLogic.js`:
- Removed the `|| itemDef.event` check from both `afterItemAdded` and `afterItemRemoved`
- Added comment explaining that event items with advancement=true ARE counted
- Now matches Python's behavior exactly

### Verification
After fix:
- ✅ Test PASSES completely!
- ✅ All 322 spheres processed successfully
- ✅ 0 errors, 0 mismatches

Files modified:
- `frontend/modules/shared/gameLogic/stardew_valley/stardewValleyLogic.js` - Lines 77-84, 120-126
