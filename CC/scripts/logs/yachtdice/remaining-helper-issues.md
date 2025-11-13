# Remaining Helper Issues for Yacht Dice

## Issue 1: Score calculation returns 5 instead of >= 8 with 2 Dice

**Status:** Under Active Investigation

**Error:** Locations "10 score", "8 score", "9 score" are accessible in LOG (sphere 0.2) but NOT in STATE

**Progress Made:**
- ✅ Fixed cache key bug - helper now sees correct inventory
- ✅ Inventory updates correctly at sphere 0.2 (Dice goes from 1 to 2)
- ✅ Helper correctly reads Dice=2 from inventory
- ✅ Helper correctly calculates numDice=2, numRolls=1

**Current Issue:**
Despite correct inventory and numDice calculation, the helper still returns score=5.
Expected: With 2 Dice and 2 categories (Category Choice, Category Inverse Choice), score should be >= 8.
Actual: score=5 (same as with 1 Dice)

**Evidence from logs:**
```
[YachtDice] Item counts: Dice=2, DiceFrags=0, Roll=1, RollFrags=0, numDice=2, numRolls=1
[YachtDice extractProgression] Calculated numDice=2, numRolls=1 from fragsPerDice=4, fragsPerRoll=4
[YachtDice] Final result: simulatedScore=5, maxScore=5
```

**Possible Causes:**
1. `diceSimulationStrings` function not using numDice correctly
2. yacht_weights data missing entry for 2 Dice, 1 Roll
3. Category counting logic incorrect
4. Difficulty parameter affecting calculation unexpectedly

**Next Investigation Steps:**
1. Check yacht_weights.json for entries with numDice=2, numRolls=1
2. Add logging to diceSimulationStrings to see lookup keys and results
3. Verify category list includes Category Choice and Category Inverse Choice
4. Check if difficulty parameter is correct

**Files Involved:**
- `frontend/modules/shared/gameLogic/yachtdice/helpers.js` (diceSimulationStrings function)
- `frontend/modules/shared/gameLogic/yachtdice/yacht_weights.json`

