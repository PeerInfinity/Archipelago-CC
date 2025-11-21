# Remaining General Issues - Factorio

This file tracks outstanding general issues that are not specific to the exporter or helper functions.

## Status

Test failed at Sphere 2.1 with 34 locations inaccessible.

## Issue 1: Event Item Inventory Synchronization

**Severity**: Critical
**Type**: State Management / Test Infrastructure

**Description**:
The spoiler test fails at Sphere 2.1 because "Automated logistic-science-pack" is not properly added to the player's inventory after collecting it from the "Automate logistic-science-pack" location.

**Details**:
- Location "Automate logistic-science-pack" is correctly accessible in Sphere 1.8
- Location is correctly checked in Sphere 2.1
- The location contains the correct event item: "Automated logistic-science-pack"
- However, when access rules are evaluated after checking the location, the item has inventory count 0
- This causes 34 locations that require this item to be incorrectly marked as inaccessible

**Evidence from test logs**:
```
[Sphere 2.1] inventory_from_log: {"Automated logistic-science-pack":1, ...}
[Sphere 2.1] newlyAddedItems: ["Automated logistic-science-pack"]
Checking "Automate logistic-science-pack" (contains: Automated logistic-science-pack)
---
HAS_ITEM "Automated logistic-science-pack": false (✗)
Current inventory count for "Automated logistic-science-pack": 0
```

**Comparison**:
- "Automated automation-science-pack" (collected in Sphere 0.1) works correctly - count is 1
- "Automated logistic-science-pack" (collected in Sphere 2.1) fails - count is 0

**Affected Locations** (34 total):
AP-2-072, AP-2-179, AP-2-255, AP-2-269, AP-2-270, AP-2-272, AP-2-328, AP-2-338, AP-2-413, AP-2-416, AP-2-469, AP-2-473, AP-2-491, AP-2-502, AP-2-507, AP-2-514, AP-2-524, AP-2-569, AP-2-585, AP-2-634, AP-2-644, AP-2-650, AP-2-652, AP-2-654, AP-2-683, AP-2-688, AP-2-763, AP-2-784, AP-2-794, AP-2-861, AP-2-889, AP-2-898, AP-2-901, AP-2-996

**Data Validation**:
✅ Event item properly exported in rules.json with `event: true`
✅ Location properly contains the event item
✅ Access rules correctly structured
✅ Progressive item resolution working
✅ "Automated automation-science-pack" demonstrates event items CAN work

**Root Cause Found**:

✅ **FIXED**: Silent failure bug in location checking
- checkLocation() didn't return success/failure status
- Worker always reported success even when location was rejected
- Fixed by making checkLocation() return result object
- Worker now sends error response when location check fails

❌ **NEW BUG DISCOVERED**: State synchronization issue between main thread and worker

After fixing the silent failure bug, the test now fails with a clear error:
```
Location check rejected: not_accessible. Location was not checked.
```

Evidence of state desync:
1. Main thread pre-check: Location IS accessible ✅
2. Worker check: Location NOT accessible ❌

The worker's state (inventory, reachability) is out of sync with the main thread's snapshot.

**Files Modified (Bug Fix)**:
- `frontend/modules/stateManager/core/locationChecking.js`: Added return value with success/failure/reason
- `frontend/modules/stateManager/stateManagerWorker.js`: Check result and send error response if rejected
- `frontend/modules/stateManager/stateManager.js`: Return result from checkLocation wrapper
- `frontend/modules/testSpoilers/eventProcessor.js`: Direct call to stateManager.checkLocation with proper error handling

**Investigation Results** (Progressive Item Resolution Issue):

✅ **Added diagnostic logging**:
- `frontend/modules/stateManager/core/locationChecking.js`: Added console.log to show worker inventory when checking locations
- `frontend/modules/stateManager/core/inventoryManager.js`: Added detailed logging for progressive item resolution
- `frontend/modules/testSpoilers/eventProcessor.js`: Added main thread state logging before location checks

✅ **Root Cause Identified**: Progressive item resolution in access rules

The "Automate logistic-science-pack" location has this access rule:
```
all_of(technology in required_technologies["logistic-science-pack"]):
  has(technology)
```

Which expands to: "Check if player has all technologies in the list ['logistic-science-pack']"

**The Problem**:
1. Worker inventory shows: `"progressive-science-pack": 2`
2. Access rule checks for: `"logistic-science-pack"` (the resolved tech name)
3. The `hasItem()` function in `inventoryManager.js` HAS progressive resolution logic (lines 437-461)
4. It should check: "Do we have 'progressive-science-pack' >= level of 'logistic-science-pack'?"
5. Level check: `progressiveCount (2) > itemLevel (0)` should return TRUE

**Investigation needed**:
- The progressive resolution logic exists and looks correct
- Need to verify why `hasItem("logistic-science-pack")` returns false in the worker
- Possible issues:
  - `progressionMapping` not loaded in worker?
  - Progressive item not in correct format?
  - Variable binding issue in `all_of` comprehension context?

**Debug logs added but not yet captured in test output** - need to investigate why console.log from inventoryManager.js isn't appearing
