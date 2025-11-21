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

**Root Cause Analysis**:

CRITICAL FINDING: The location check appears to complete but the item is NOT actually being added to inventory.

Evidence:
```
Before checking "Automate logistic-science-pack": Fresh snapshot has 14 checked locations
After checking "Automate logistic-science-pack": Fresh snapshot has 14 checked locations
```

The checked location count doesn't increase from 14 to 15, indicating the location was NOT successfully checked despite:
- Pre-check validation passing (location is accessible)
- checkLocationViaEvent being called
- No error messages or rejection events

Comparison with working case:
- Sphere 0.1: "Automate automation-science-pack" → count increases from 0 to 1 ✅
- Sphere 2.1: "Automate logistic-science-pack" → count stays at 14 ❌

This suggests a state-related bug in the web worker or location checking code that manifests after multiple locations have been checked.

**Investigation Trail**:

1. ✅ Fixed: Found bug in `eventProcessor.js` where `staticData.settings` was accessed without player ID
   - Changed `staticData?.settings?.use_resolved_items` to `staticData?.settings?.[this.playerId]?.use_resolved_items`
   - This was preventing game-specific settings from being read correctly

2. ❌ Rejected: Attempted workaround using `add_sphere_items_upfront` setting
   - Added items at START of sphere instead of AFTER checking locations
   - Caused timing issues: locations accessible one sub-sphere too early
   - Reverted this approach

3. 🔍 Current Investigation: Location check silently failing
   - checkLocation is called but location not added to checkedLocations Set
   - No error logs, no rejection events
   - Possible web worker issue or race condition
   - May be related to event item handling after inventory has accumulated items

**Files Modified**:
- `frontend/modules/testSpoilers/eventProcessor.js`: Fixed settings access bug (3 locations)
- `exporter/games/factorio.py`: Reverted add_sphere_items_upfront workaround

**Next Steps**:
1. Add debug logging to locationChecking.js to trace why location not being checked
2. Check web worker command queue for race conditions
3. Test if issue occurs with all event items collected after sphere 0, or only logistic-science-pack
4. Consider if this is related to fractional sphere handling (2.1 vs integer spheres)

**Potential Root Causes**:
- Web worker not processing checkLocation command properly
- Race condition between snapshot retrieval and location checking
- Event item special handling interfering with normal location check flow
- Checked locations Set not being properly updated in worker state
