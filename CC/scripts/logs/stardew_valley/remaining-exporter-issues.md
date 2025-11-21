# Stardew Valley - Remaining Exporter Issues

## Issue 1: Museumsanity Access Rule Mismatch Between Python and JavaScript

### Description
Three Museumsanity locations become accessible in Python at sphere 2.1, but JavaScript evaluates their access rules as FALSE.

### Failing Locations
- Museumsanity: 3 Artifacts
- Museumsanity: 5 Donations
- Museumsanity: 6 Artifacts

### Root Cause: CONFIRMED
**JavaScript evaluation is CORRECT. The issue is in the exported rules or Python's evaluation.**

At sphere 2.1:
- Player has "Received Progression Percent" = 12
- Location "Museumsanity: 3 Artifacts" has access rule: `AND(has("Traveling Merchant Metal Detector"), count_true(3, 21 conditions))`
- The `count_true(3, 21)` requires at least 3 conditions to be TRUE
- **JavaScript finds only 2 TRUE conditions:**
  - Condition 2: `item_check("Received Progression Percent", count=12)` - TRUE (12 >= 12)
  - Condition 5: `item_check("Received Progression Percent", count=8)` - TRUE (12 >= 8)
  - All other 19 conditions are FALSE (either require higher progression % or require inaccessible regions)
- **Result: 2 < 3, so the rule returns FALSE**

**But Python's sphere log says this location IS accessible at sphere 2.1.**

### Detailed Analysis
JavaScript evaluation with debug logging shows:
```
[count_true DEBUG] Evaluating count_true(3, 21 conditions)
[count_true DEBUG]   Condition 2: TRUE (total true: 1)
[count_true DEBUG]   Condition 5: TRUE (total true: 2)
[count_true DEBUG] Result: FALSE (true:2, undefined:0, false:19, need:3)
```

### Possible Causes
1. **Exporter bug**: The exporter may be incorrectly translating Python's `Count` rules into JavaScript's `count_true` rules
2. **Python evaluation difference**: Python may be evaluating these rules differently than how they're exported
3. **Missing context**: There may be additional state in Python (special items, game-specific logic) that makes more conditions TRUE

### Python Source Analysis
The location uses `can_find_museum_artifacts(3)` which returns:
```python
rules = [can_find_museum_item(artifact) for artifact in all_museum_artifacts]
return logic.count(3, *rules)
```

Each `can_find_museum_item` returns:
```python
(pan_rule | region_rule | geodes_rule) & time_rule
```

Where:
- `region_rule = can_reach_all_except_one(item.locations)`
- `time_rule = has_lived_months((20 - difficulty) // 2)`

The `has_lived_months` function uses `HasProgressionPercent` internally.

### Next Steps
1. **Check the exporter**: Verify that museum rules are being exported correctly in `exporter/games/stardew_valley.py`
2. **Compare Python vs JS evaluation**: Add logging to Python's sphere calculation to see exactly which artifacts/conditions it considers TRUE
3. **Verify time_rule translation**: Check if `has_lived_months` is being translated correctly to progression percent checks

### Files Involved
- `exporter/games/stardew_valley.py` - Stardew Valley exporter (may have bug in museum rule export)
- `worlds/stardew_valley/logic/museum_logic.py` - Python museum logic
- `frontend/modules/shared/ruleEngine.js` - JavaScript rule engine (working correctly)
- `frontend/presets/stardew_valley/AP_14089154938208861744/AP_14089154938208861744_rules.json` - Exported rules
