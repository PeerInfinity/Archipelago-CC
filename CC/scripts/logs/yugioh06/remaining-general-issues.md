# Remaining General Issues for Yu-Gi-Oh! 2006

## Issue 2: Event item "Can Stall with ST" not recognized in location access rules

**Status**: IDENTIFIED
**Priority**: HIGH
**Type**: State Management / Event Item Issue

### Description
The location "Final Countdown Finish Bonus" is not being recognized as accessible by the frontend even though the player should have both required items ("Final Countdown" and "Can Stall with ST").

### Evidence
- Test fails at sphere 4.1 (event 391) with: "Locations accessible in LOG but NOT in STATE: Final Countdown Finish Bonus"
- Error message indicates: "Access rule evaluation failed"
- Sphere log shows:
  - Event 141 (Sphere 2.14): Location "Can Stall with ST" becomes accessible
  - Event 262 (Sphere 3.4): Player gets "Can Stall with ST" event item by checking the location
  - Event 391 (Sphere 4.1): Player gets "Final Countdown", and "Final Countdown Finish Bonus" should become accessible

### Access Rule
"Final Countdown Finish Bonus" requires:
```json
{
  "type": "and",
  "conditions": [
    {"type": "item_check", "item": "Final Countdown"},
    {"type": "item_check", "item": "Can Stall with ST"}
  ]
}
```

### Analysis
The "Can Stall with ST" item is an event item (event: true, type: "Event"). The issue is that:
1. Event items should be added to inventory when their location is checked
2. The frontend may not be properly tracking event items in the inventory
3. Or the item_check rule may not be properly checking for event items

The "Can Stall with ST" location has this access rule that requires 2 unique stall items:
```json
{
  "type": "compare",
  "left": {
    "type": "state_method",
    "method": "count_from_list_unique",
    "args": [{"type": "constant", "value": ["Level Limit - Area B", "Gravity Bind", "Messenger of Peace"]}]
  },
  "op": ">=",
  "right": {"type": "constant", "value": 2}
}
```

### Next Steps
1. Verify that event items are being properly added to inventory when locations are checked
2. Check if item_check rules properly handle event items
3. Debug the state at sphere 4.1 to see what items are in the inventory
4. May need to add detailed logging to track event item collection

### Location
- Likely involves: frontend/modules/stateManager/core/locationChecking.js or inventoryManager.js
- Also may need updates in: frontend/modules/shared/ruleEngine.js (item_check handling)
