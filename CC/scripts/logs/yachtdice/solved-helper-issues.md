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

## Issue 3: Score calculation algorithm mismatch (SOLVED - CRITICAL BUG)

**Problem:** The JavaScript implementation was fundamentally different from the Python algorithm. JavaScript was calculating percentiles for each category separately and then adding the scores. Python combines all category probability distributions first, then calculates percentiles on the combined total.

**Root Cause:**
- **Python Algorithm:**
  1. For each category, get probability distribution
  2. Apply multipliers using `max_dist`
  3. Combine distributions using `add_distributions`
  4. Calculate percentiles on the final combined distribution
  5. Average those percentiles

- **JavaScript Algorithm (OLD):**
  1. For each category, get probability distribution
  2. Calculate percentiles for that category
  3. Apply multipliers to the percentile values
  4. Add the category scores together

**Example:**
With 1 Dice, 1 Roll, 2 Categories (Choice + Inverse Choice), difficulty 2:
- Distribution: {2: 0.111, 4: 0.444, 6: 0.445}
- **Python:** Percentiles [0.3, 0.7] = [4, 6], Average = 5 ✓
- **JavaScript (OLD):** Percentiles [0.3, 0.7] = [6, 6], Average = 6 ✗

**Additional Bug Found:**
The `percentileDistribution` function was dividing by 100000, but distributions from `addDistributions` and `maxDist` were already normalized to 0-1 probabilities. This caused cumulative probabilities to never reach the percentile threshold.

**Solution:**
1. Added `addDistributions(dist1, dist2)` function to combine probability distributions
2. Added `maxDist(dist1, mults)` function to handle multiple tries with multipliers
3. Rewrote `diceSimulationStrings()` to:
   - Build combined probability distribution from all categories
   - Calculate percentiles on the final combined distribution
   - Average the percentile values
4. Fixed `percentileDistribution()` to not divide by 100000 (values already normalized)
5. Fixed category sorting to use 4 rolls (matching Python) instead of actual numRolls

**Test Results:**
- Initial state (1 Dice, 1 Roll, 2 Categories): 5 (was 6, now correct!)
- With 2 Dice, 3 Categories: 10 (matches Python)
- **Yacht Dice spoiler test now PASSES** (passedCount: 1, failedCount: 0)

**Files Changed:**
- `frontend/modules/shared/gameLogic/yachtdice/helpers.js`

**Commits:**
- Async loading fix: [previous commit hash]
- Cache key fix: [previous commit hash]
- Algorithm fix: b91e8aa
