# Solved Helper Issues for Yacht Dice

## Issue 1: Async yacht_weights.json loading (SOLVED)

**Problem:** The `yacht_weights.json` file was being loaded asynchronously via `fetch()`, but the helper function was being called synchronously before the data finished loading. This caused the helper to use fallback estimation which gave incorrect (too low) scores.

**Solution:**
1. Converted `yacht_weights.json` to `yacht_weights.js` as a JavaScript module
2. Changed from async `fetch()` to synchronous `import`
3. Data now loads synchronously when the module is imported
4. Helper function can immediately access the data

**Files Changed:**
- Created: `frontend/modules/shared/gameLogic/yachtdice/yacht_weights.js`
- Modified: `frontend/modules/shared/gameLogic/yachtdice/helpers.js`

**Verification:**
Console logs confirm: "[YachtDice] yacht_weights data loaded successfully" appears on module load

## Issue 2: Cache key not including actual inventory (SOLVED - CRITICAL BUG)

**Problem:** The helper function's cache key was using `snapshot.items` which doesn't exist, causing the cache key to always be `"{}"`. This meant the helper would return cached scores from previous sphere checks even when the inventory had changed.

**Root Cause:**
```javascript
// OLD CODE (lines 85-88):
const inventoryKey = JSON.stringify(snapshot?.items || {});
// snapshot.items doesn't exist, so inventoryKey = "{}"
// All calls had same cache key regardless of actual inventory!
```

**Impact:**
- At sphere 0: Helper calculates score with 1 Dice, caches result
- At sphere 0.2: Inventory has 2 Dice, but helper returns cached score from 1 Dice
- Locations requiring score >= 8 (which needs 2 Dice) fail accessibility check

**Solution:**
```javascript
// NEW CODE:
const inventory = snapshot?.items || snapshot?.inventory || {};
const inventoryKey = JSON.stringify(inventory);
// Now correctly uses snapshot.inventory which exists and has actual item counts
```

**Verification:**
- Helper logs now show `Dice=2` at sphere 0.2 (correct!)
- Helper correctly calculates `numDice=2` from inventory
- Cache keys are unique per inventory state

**Files Changed:**
- `frontend/modules/shared/gameLogic/yachtdice/helpers.js`

