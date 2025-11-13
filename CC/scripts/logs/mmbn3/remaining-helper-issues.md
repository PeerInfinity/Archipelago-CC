# Remaining Helper Issues

## Issue 1: Location "Job: My Navi is sick" not accessible after collecting "Recov30 *"

**Status:** Under investigation - Deep dive completed

**Description:**
- Sphere 3.2 test failure
- Location "Job: My Navi is sick" requires item "Recov30 *"
- After collecting "Recov30 *" from "Job: Legendary Tomes - Treasure", the location should become accessible
- Python backend correctly identifies it as accessible
- JavaScript frontend does not recognize it as accessible

**Access Rule:**
```json
{
  "type": "item_check",
  "item": {
    "type": "constant",
    "value": "Recov30 *"
  }
}
```

**Detailed Investigation:**

### What We Know:
1. **Item is correct**: "Recov30 *" exists in items list with `advancement: true`
2. **Region is accessible**: "SciLab Overworld" is accessible by sphere 3.2
3. **Location is in right region**: "Job: My Navi is sick" is in "SciLab Overworld"
4. **Sequence is correct**: In sphere 3.2:
   - Check "Job: Legendary Tomes - Treasure" (contains "Recov30 *")
   - This adds "Recov30 *" to inventory
   - "Job: My Navi is sick" should become accessible
5. **Helper functions added**: `has()` and `count()` functions added to mmbn3/helpers.js
6. **Game registration correct**: mmbn3 is properly registered in gameLogicRegistry
7. **Item should be added**: In `locationChecking.js`, items with `advancement: true` are added in spoiler test mode

### Code Paths Verified:
- `evaluateRule` in ruleEngine.js processes `item_check` rules correctly (lines 1076-1106)
- `hasItem` in stateInterface.js delegates to game-specific `has()` helper (lines 346-356)
- `has()` function in mmbn3/helpers.js checks `snapshot.inventory[itemName] > 0`
- `checkLocation` in locationChecking.js adds items via `_addItemToInventory` (line 138)
- `_addItemToInventory` in inventoryManager.js adds to `sm.inventory[itemName]` (line 254)
- `comparisonEngine.js` evaluates access rules using fresh snapshot after checking locations

### What's Unclear:
- Why `evaluateRule` returns non-true value for the access rule
- Whether the inventory snapshot actually contains "Recov30 *" at comparison time
- Whether there's a timing issue with snapshot updates
- Whether the `has()` helper is actually being called

### Next Steps:
1. Add console.log debugging to `has()` function to verify it's being called
2. Check if inventory snapshot contains "Recov30 *" at comparison time
3. Verify `evaluateRule` is returning exact value (false, undefined, or other)
4. Consider running test with browser devtools open to see console logs
5. May need to examine test infrastructure timing and snapshot freshness guarantees

