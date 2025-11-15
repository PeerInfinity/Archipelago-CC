# DLCQuest Remaining General Issues

## Issue 1: Movement Pack Accessible in Sphere 0

**Test Result:**
```
STATE MISMATCH found for: {"type":"state_update","sphere_number":0,"player_id":"1"}
Locations accessible in STATE (and unchecked) but NOT in LOG: Movement Pack
```

**Expected Behavior (from sphere log):**
- Sphere 0: Only "Move Right coins" should be accessible
- Sphere 0.1: After collecting "Move Right coins" (which gives "4 coins"), "Movement Pack" becomes accessible

**Actual Behavior:**
- Sphere 0: "Movement Pack" is incorrectly showing as accessible in JavaScript state

**Access Rule for Movement Pack:**
```json
{
  "type": "compare",
  "left": {
    "type": "subscript",
    "value": {
      "type": "subscript",
      "value": {
        "type": "attribute",
        "object": {
          "type": "name",
          "name": "state"
        },
        "attr": "prog_items"
      },
      "index": {
        "type": "constant",
        "value": 1
      }
    },
    "index": {
      "type": "constant",
      "value": " coins"
    }
  },
  "op": ">=",
  "right": {
    "type": "constant",
    "value": 4
  }
}
```

This translates to: `state.prog_items[1][" coins"] >= 4`

**Investigation:**
1. ✅ The exporter correctly sets up `prog_items_init` with `" coins": 0` in game_info
2. ✅ The StateManager correctly initializes `prog_items` from `game_info.prog_items_init` in loadPlayerData() (initialization.js:185-205)
3. ✅ The snapshot correctly includes `prog_items` (statePersistence.js:187)
4. ✅ Initialization order is correct: loadPlayerData → prog_items init → computeReachableRegions
5. ✅ JavaScript numeric vs string keys work correctly (obj[1] === obj["1"])
6. ✅ Rule engine handles undefined comparisons correctly (returns undefined, not true)

**Detailed Analysis:**
- Python rule: `lambda state: state.prog_items[player][" coins"] >= coin` where player=1, coin=4
- Exported rule structure is correct (verified in rules.json)
- Expected evaluation at Sphere 0:
  - `state` → `snapshot`
  - `snapshot.prog_items` → `{"1": {" coins": 0, " coins freemium": 0}}`
  - `snapshot.prog_items[1]` → `{" coins": 0, " coins freemium": 0}`
  - `snapshot.prog_items[1][" coins"]` → `0`
  - `0 >= 4` → `false`
  - Movement Pack should NOT be accessible

**Current Hypothesis:**
The issue might be related to:
1. Timing of when the spoiler test checks accessibility vs when prog_items is initialized
2. A subtle bug in the attribute or subscript evaluation code
3. The snapshot not properly including prog_items at the moment of the initial check
4. The test itself checking state at the wrong moment (after some implicit state change)

**Next Steps:**
- Need to add debug logging to trace the actual runtime values during rule evaluation
- Check if there's a race condition or timing issue in the test setup
- Verify that sm.prog_items actually exists and has the correct structure when computeReachableRegions is first called
- Check if there's any code path that could bypass prog_items initialization

**BREAKTHROUGH - Root Cause Found:**
Debug logging reveals that `snapshot.prog_items` is `undefined`!

```
[DEBUG] DLCQuest prog_items attribute access: {attr: prog_items, attrValue: undefined, ...}
```

This means `prog_items` is NOT being included in the snapshot when it's created. The rule evaluation chain shows:
1. `state.prog_items` → `snapshot.prog_items` → `undefined`
2. `undefined[1]` → `undefined`
3. `undefined[" coins"]` → `undefined`
4. `undefined >= 4` → `undefined` (comparison with undefined operand)

The comparison returns `undefined` because the left operand is undefined. According to ruleEngine.js:989-992, when a comparison has undefined operands, it returns `undefined`, not `false`. When a location access rule returns `undefined`, the location should NOT be accessible (undefined is falsy).

**The Real Problem:**
The snapshot being passed to the rule engine does NOT include `prog_items`! This means either:
1. `sm.prog_items` is undefined/null in the StateManager instance when the snapshot is created
2. The snapshot is being created via a different code path that doesn't include prog_items
3. There's a timing issue where snapshots are requested before loadPlayerData() initializes prog_items

The code at statePersistence.js:187 should include it:
```javascript
prog_items: sm.prog_items || {},
```

But this would only result in an empty object `{}` if `sm.prog_items` is undefined, not `undefined` itself. So something else is going on.

**Status:** ROOT CAUSE IDENTIFIED - SNAPSHOT MISSING PROG_ITEMS - INVESTIGATING WHY
