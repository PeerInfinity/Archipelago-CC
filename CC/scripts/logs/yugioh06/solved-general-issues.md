# Solved General Issues for Yu-Gi-Oh! 2006

## Issue 1: Missing `count_from_list_unique` state method

**Location:** Sphere 1.49 - "Can Stall with Monsters" location

**Symptom:** Location access rule failed because `count_from_list_unique` state method was not implemented in stateInterface.js

**Root Cause:**
The access rule for "Can Stall with Monsters" uses:
```json
{
  "type": "compare",
  "left": {
    "type": "state_method",
    "method": "count_from_list_unique",
    "args": [...]
  },
  "op": ">=",
  "right": {"type": "constant", "value": 2}
}
```

The `count_from_list_unique` method was missing from stateInterface.js (only `has_from_list_unique` existed).

**Fix:**
Added `count_from_list_unique` method to stateInterface.js at line 699-712. This method returns the count of unique items from a list (items with count > 0), matching the Python implementation from BaseClasses.py.

**Files Changed:**
- frontend/modules/shared/stateInterface.js

**Status:** ✅ FIXED - Test now passes Sphere 1.49

---

## Issue 2: Event items not counted properly in yugioh06Logic.js

**Location:** Multiple locations using event items

**Symptom:** The `count` function in yugioh06Logic.js only checked inventory, not events or flags

**Root Cause:**
Event items like "Can Stall with ST" and "Final Countdown" are marked with `event: true` in their item definition. The `count` function was only checking `snapshot.inventory` and missed these events.

**Fix:**
Updated the `count` function in yugioh06Logic.js to check events and flags first before checking inventory:
```javascript
export function count(snapshot, staticData, itemName) {
  // Check events first (events are binary - either 1 or 0)
  if (snapshot.events && snapshot.events.includes(itemName)) {
    return 1;
  }

  // Check flags
  if (snapshot.flags && snapshot.flags.includes(itemName)) {
    return 1;
  }

  // Check inventory
  if (!snapshot.inventory) return 0;
  return snapshot.inventory[itemName] || 0;
}
```

**Files Changed:**
- frontend/modules/shared/gameLogic/yugioh06/yugioh06Logic.js

**Status:** ✅ FIXED (partially) - Improved event handling, but still investigating related issues
