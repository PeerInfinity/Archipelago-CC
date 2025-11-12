# Remaining Helper Issues for Ocarina of Time

This file tracks helper function issues that still need to be fixed.

## Issue 1: Missing State Method - "_oot_has_bottle"

**Severity**: HIGH
**Type**: State Method

### Description
Some locations require the `_oot_has_bottle` state method which is not implemented in the frontend.

### Example Usage
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {
      "type": "name",
      "name": "CollectionState"
    },
    "attr": "_oot_has_bottle"
  },
  "args": []
}
```

### Location Examples
- Market Potion Shop Item 1
- Market Potion Shop Item 2
- Market Potion Shop Item 4
- Kak Potion Shop Item 1
- Kak Potion Shop Item 3

### Solution Needed
Implement `_oot_has_bottle` in `frontend/modules/shared/gameLogic/oot/ootLogic.js` (needs to be created).

This method should check if the player has any bottle item (including filled bottles like Blue Potion, Green Potion, etc.).
