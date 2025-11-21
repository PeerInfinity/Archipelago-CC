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

**Root Cause Theory**:
The test framework's inventory synchronization may have an issue when:
- Multiple items have been collected (14 checked locations before this point)
- Event items are collected after initial spheres
- The `inventory_from_log` is not properly being used to create the snapshot for rule evaluation

**Next Steps**:
1. Investigate the state manager's handling of event item collection
2. Check if there's a timing issue with when the snapshot is created vs when the inventory is updated
3. Determine if this is Factorio-specific or a general infrastructure issue
4. Test with other event items collected in later spheres (e.g., "Automated military-science-pack")

**Potential Workarounds**:
- None identified yet that wouldn't require infrastructure changes
