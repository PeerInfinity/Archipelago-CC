# Stardew Valley - Remaining Helper Issues

## Issue 1: Access Rule Evaluation Failing for Museumsanity Locations

### Description
Three Museumsanity locations are not becoming accessible in sphere 2.1 even though their access rules should evaluate to true.

### Failing Locations
- Museumsanity: 3 Artifacts
- Museumsanity: 5 Donations
- Museumsanity: 6 Artifacts

### Test Failure
Sphere 2.1 - These locations should become accessible but are showing as "Access rule evaluation failed"

### Investigation Results
**Virtual item tracking IS working correctly:**
- The `afterItemAdded` hook is being called for all progression items
- `totalProgressionItems` is correctly loaded (322)
- At sphere 2.1, the player has:
  - "Received Progression Item" = 39
  - "Received Progression Percent" = 12
- These values match the Python sphere log exactly

**Access rule structure:**
The failing locations have complex access rules with:
1. `item_check` for "Traveling Merchant Metal Detector" (player has this)
2. `count_true` with count=3 and many nested conditions including:
   - Simple `item_check` rules for "Received Progression Percent" with various counts (24, 20, 12, 8, 4, etc.)
   - Complex `and` rules combining progression percent checks with `region_check` rules

### Suspected Root Cause
The access rule evaluation is returning `undefined` or throwing an error rather than returning `true` or `false`. Possible causes:
1. One or more `region_check` rules in the nested conditions are failing (region doesn't exist)
2. The `count_true` or `and` rule types are not properly handling `undefined` results from sub-rules
3. There may be a bug in how deeply nested rules are evaluated

### Next Steps
1. Add more detailed logging to the rule engine to trace which specific sub-rule is causing the failure
2. Check if all regions referenced in the access rules exist (e.g., "The Mines - Floor 20", "Desert", "Skull Cavern")
3. Verify that `count_true` and `and` rules properly handle `undefined` results
4. Consider simplifying the test case to isolate the specific failing rule condition

### Files Involved
- `frontend/modules/shared/ruleEngine.js` - Rule evaluation logic, especially `count_true` and `and` rule handling
- `frontend/presets/stardew_valley/AP_14089154938208861744/AP_14089154938208861744_rules.json` - Contains the complex access rules
- Exporter may need to simplify or restructure these rules if they're too complex for the frontend to evaluate
