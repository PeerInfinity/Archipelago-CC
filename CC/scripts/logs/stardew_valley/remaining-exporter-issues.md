# Remaining Exporter Issues

## Issue 1: Virtual Event Items Not Tracked Correctly in State

**Locations Affected:**
- Museumsanity: 3 Artifacts
- Museumsanity: 5 Donations
- Museumsanity: 6 Artifacts

**Symptom:**
Test fails at Sphere 2.1 - these 3 locations are accessible in the Python spoiler log but not in the JavaScript state manager.

**Root Cause:**
The exporter correctly adds virtual event items "Received Progression Percent" and "Received Progression Item" to the items list, but the frontend state manager may not be correctly tracking the cumulative progression percentage.

At sphere 2.1, we should have:
- 39 progression items out of 322 total
- This equals 12% progression (39 * 100 // 322 = 12)

The rules check for `Received Progression Percent >= 12` (among other conditions in a count_true), but the JavaScript state may not be calculating or tracking this virtual item correctly.

**Expected Behavior:**
The state manager should track "Received Progression Percent" as a cumulative value that increases as progression items are collected, calculated as:
```
received_progression_percent = (received_progression_items * 100) // total_progression_items
```

**Code Analysis:**
The code appears to already have proper handling for these virtual items:
1. The exporter (exporter/games/stardew_valley.py) correctly adds virtual items to the items list
2. The game logic module (frontend/modules/shared/gameLogic/stardew_valley/stardewValleyLogic.js) has afterItemAdded/afterItemRemoved hooks
3. The hooks update "Received Progression Item" and "Received Progression Percent" when advancement items are collected
4. The calculation matches Python: Math.floor((receivedProgItem * 100) / totalProgItems)
5. The total_progression_items (322) is correctly loaded from game_info

**Current Status:**
Need to verify the issue still exists and debug why the hooks might not be working as expected. The infrastructure appears correct, but the test is failing, suggesting either:
- The hooks aren't being called
- The virtual items aren't being updated properly
- There's a timing issue with when the items are checked vs when they're updated

