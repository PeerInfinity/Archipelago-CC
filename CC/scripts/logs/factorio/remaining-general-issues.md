# Remaining General Issues for Factorio

This file tracks general issues (not exporter or helper related) for Factorio.

## Issue 1: Event Items Not Being Added to Inventory [ACTIVE INVESTIGATION]

**Severity:** Critical
**Category:** State Management
**First seen:** Sphere 0.1

### Description

When the player collects a location with an event item, the event item is not being properly added to the player's inventory in the JavaScript state manager.

### Evidence

- Location "Automate automation-science-pack" is collected in Sphere 0
- This gives the event item "Automated automation-science-pack" (id: null, event: true)
- In Sphere 0.1, the sphere log shows: `"base_items": {"Automated automation-science-pack": 1}`
- However, the state manager reports: `Current inventory count for "Automated automation-science-pack": 0`

### Impact

32 locations that require the item "Automated automation-science-pack" cannot be accessed, causing the test to fail at Sphere 0.1.

### Affected Locations

AP-1-031, AP-1-055, AP-1-076, AP-1-079, AP-1-080, AP-1-097, AP-1-108, AP-1-126, AP-1-141, AP-1-158, AP-1-194, AP-1-195, AP-1-211, AP-1-235, AP-1-330, AP-1-459, AP-1-475, AP-1-494, AP-1-499, AP-1-633, AP-1-653, AP-1-711, AP-1-754, AP-1-757, AP-1-769, AP-1-798, AP-1-880, AP-1-934, AP-1-951, AP-1-954, AP-1-983, AP-1-997

### Investigation Findings

The issue appears to be in the test flow:

**Sphere Event Flow:**
- Sphere 0: Location "Automate automation-science-pack" becomes accessible (sphere_locations=[])
- Sphere 0.1: Location "Automate automation-science-pack" is checked (sphere_locations=["Automate..."])

**Expected Behavior:**
1. Sphere 0.1 processes the state_update event
2. Checks the location "Automate automation-science-pack" (from sphere_locations)
3. Adds the event item "Automated automation-science-pack" to inventory
4. Takes a snapshot
5. Verifies that 32 locations are now accessible (requiring this item)

**Actual Behavior:**
- The test reports "Recently added item: Automated automation-science-pack" (from sphere log data)
- But when checking accessibility, inventory shows count=0 for this item
- This suggests the location was not checked, or the item was not added to inventory

**Code Review:**
- `locationChecking.js:138`: Calls `sm._addItemToInventory(location.item.name, 1)` when checking location
- `inventoryManager.js:243-324`: `_addItemToInventory` properly adds items to inventory
- `eventProcessor.js:227-272`: Loops through sphere_locations and checks each one

### Next Steps

1. ✅ Verified item addition logic works correctly
2. ✅ Verified event processor checks locations from sphere_locations
3. ✅ Fixed missing region field in exporter (locations now have region: "Nauvis")
4. ⏳ Debug why loop at eventProcessor.js:228-272 isn't running
5. ⏳ Verify sphereData.locations is properly populated for Sphere 0.1
6. ⏳ Add console logging to trace exact values

### Recent Progress

Fixed the missing `region` field in the exporter. After regenerating rules.json, all locations now have `region: "Nauvis"` and `parent_region_name: "Nauvis"` set correctly.

However, the test still fails at the same point. The sphere log clearly shows `sphere_locations: ['Automate automation-science-pack']` at index 1 (Event 2, Sphere 0.1), but the test jumps straight to STATE MISMATCH without any "Checking locations" messages in the logs.

This suggests either:
1. `sphereData.locations` is empty/undefined despite being in the source data
2. The loop condition `if (locationsToCheck.length > 0)` is failing
3. The sphereState module isn't correctly parsing the incremental format

Need to add logging to see what's actually in `sphereData.locations`.
