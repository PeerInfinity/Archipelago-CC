# Solved Helper Issues

## Issue 1: `count_from_list_unique` not exported as helper function ✅ SOLVED

**Location:** frontend/modules/shared/gameLogic/yugioh06/yugioh06Logic.js:176

**Problem:** The function `count_from_list_unique` is defined but not exported in the `helperFunctions` object. This caused the access rule for "Can Stall with ST" event to fail, which in turn caused "Final Countdown Finish Bonus" to be inaccessible.

**Access rule that failed:**
```json
{
  "type": "state_method",
  "method": "count_from_list_unique",
  "args": [
    {
      "type": "constant",
      "value": ["Level Limit - Area B", "Gravity Bind", "Messenger of Peace"]
    }
  ]
}
```

**Test failure:** Spoiler test failed at Sphere 4.1 (event 388) because "Final Countdown Finish Bonus" was accessible in the Python log but not in the JavaScript state.

**Root cause:** Player had 2 stall items (Level Limit - Area B, Messenger of Peace) before Sphere 4.1. `count_from_list_unique` should have returned 2, which is >= 2, making "Can Stall with ST" event accessible. This should then make "Final Countdown Finish Bonus" accessible when the player gets "Final Countdown". However, because `count_from_list_unique` was not exported, the state method call failed.

**Fix applied:** Added `count_from_list_unique` to the `helperFunctions` export in yugioh06Logic.js:646

**Verification:** After the fix, spoiler test passed all 971 events with no mismatches.
