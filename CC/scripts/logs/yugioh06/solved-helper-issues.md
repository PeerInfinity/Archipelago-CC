# Yu-Gi-Oh! 2006 - Solved Helper Issues

## Fixed: has_from_list_unique State Method Not Implemented

**Fixed:** 2025-11-15
**Files Modified:**
- `frontend/modules/shared/stateInterface.js`
- `frontend/modules/shared/gameLogic/yugioh06/yugioh06Logic.js`

### Problem
Access rules using `state.has_from_list_unique()` were failing because this method wasn't implemented in the JavaScript stateInterface. This method checks if the player has at least N unique (different) items from a list, ignoring duplicates.

### Solution
Implemented `has_from_list_unique` in stateInterface:

```javascript
if (methodName === 'has_from_list_unique' && args.length >= 2) {
  const items = args[0];
  const count = args[1];
  // Count unique items from the list (items with count > 0)
  let uniqueItemsFound = 0;
  for (const itemName of items) {
    if ((finalSnapshotInterface.countItem(itemName) || 0) > 0) {
      uniqueItemsFound++;
    }
  }
  return uniqueItemsFound >= count;
}
```

Also added to yugioh06Logic.js helper registry for consistency.

### Impact
- "Has Back-row removal" location access rule now evaluates correctly
- Test progressed from Sphere 0.33 (step 34) to Sphere 1.45 (step 89)
