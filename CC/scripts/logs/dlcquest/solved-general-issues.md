# DLCQuest General - Solved Issues

## Issue 1: state.prog_items not accessible in rules
**Status:** Resolved in statePersistence.js

**Description:**
The spoiler test failed at sphere 1.1 with the following error:
```
Locations accessible in LOG but NOT in STATE: Movement Pack coins
Regions accessible in LOG but NOT in STATE: Movement Pack
```

The root cause was that location access rules used expressions like:
```json
{
  "type": "compare",
  "left": {
    "type": "subscript",
    "value": {
      "type": "subscript",
      "value": {
        "type": "attribute",
        "object": {"type": "name", "name": "state"},
        "attr": "prog_items"
      },
      "index": {"type": "constant", "value": 1}
    },
    "index": {"type": "constant", "value": " coins"}
  },
  "op": ">=",
  "right": {"type": "constant", "value": 4}
}
```

This evaluates to: `state.prog_items[1][" coins"] >= 4`

**Problem:**
When the rule engine resolved `name === 'state'`, it returned `sm.gameStateModule`, which only contained `{flags: [], events: []}`. The `prog_items` data was stored separately in `sm.prog_items` and wasn't included in the state object.

**Solution:**
Modified `frontend/modules/stateManager/core/statePersistence.js` in the `resolveName` function (lines 465-494):
- Changed the function to always include `prog_items` when returning the state object
- Added a check: if `sm.prog_items` exists and has content, spread it into the returned state object
- This ensures rules can access `state.prog_items[playerId][itemName]` for coin accumulation

**Code change:**
```javascript
if (name === 'state') {
  let stateObject;
  if (sm.gameStateModule && sm.settings?.game) {
    // ... build state object ...
  }

  // Always include prog_items in the state object for games that use it
  if (sm.prog_items && Object.keys(sm.prog_items).length > 0) {
    return {
      ...stateObject,
      prog_items: sm.prog_items
    };
  }

  return stateObject;
}
```

**Result:**
All 22 spheres now pass the spoiler test successfully.

**Files modified:**
- frontend/modules/stateManager/core/statePersistence.js

**Impact:**
This fix is generic and benefits any game that uses `prog_items` (progressive/accumulated items). DLCQuest uses it for coin tracking via accumulator_rules.
