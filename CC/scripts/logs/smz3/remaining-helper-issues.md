# Remaining Helper Issues for SMZ3

This file tracks unresolved issues in the SMZ3 helper functions (`frontend/modules/shared/gameLogic/smz3/smz3Logic.js`).

## Issue 1: Sahasrahla location not accessible at Sphere 5.8

**Status**: FIXED (moved to solved-helper-issues.md)

---

## Issue 2: Palace of Darkness locations not accessible at Sphere 7.7

**Status**: Investigating

**Description**:
- Locations: Palace of Darkness - Compass Chest, Dark Basement - Left, Dark Basement - Right, Harmless Hellway
- Expected: Should be accessible at Sphere 7.7 (when KeyPD is obtained)
- Actual: Not accessible in JavaScript state evaluation
- Error: "Access rule evaluation failed"

**Analysis**:
- At Sphere 7.7, player gets KeyPD (Palace of Darkness Key)
- These 4 locations should become accessible with the key
- Access rules use complex `compare` and `conditional` rule types

**Example Access Rule (Compass Chest)**:
```json
{
  "type": "compare",
  "left": {"type": "item_check", "item": "KeyPD"},
  "op": ">=",
  "right": {
    "type": "conditional",
    "test": {
      "type": "or",
      "conditions": [
        {"type": "and", "conditions": [
          {"type": "item_check", "item": "Hammer"},
          {"type": "item_check", "item": "Bow"},
          {"type": "item_check", "item": "Lamp"}
        ]},
        {"type": "constant", "value": false}
      ]
    },
    "if_true": {"type": "constant", "value": 4},
    "if_false": {...}
  }
}
```

**Note**: This appears to be a rule engine issue, not a helper function issue. The rule engine needs to properly support:
1. `compare` rule type with >= operator and dynamic right side
2. `conditional` rule type (ternary operator)
3. Using the result of conditional as the comparison value

**Next Steps**:
- Check if rule engine properly handles conditional rule types
- May need to move this to remaining-general-issues.md if it's a core rule engine issue
