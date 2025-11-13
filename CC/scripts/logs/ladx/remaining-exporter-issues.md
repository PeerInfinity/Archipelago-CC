# Remaining Exporter Issues for Links Awakening DX

This file tracks issues with the LADX exporter that need to be resolved.

## Issue 1: Color Dungeon Regions Not Reachable at Sphere 4.16

**Status:** Investigating

**Description:**
At sphere 4.16 (event 30), four regions are accessible in the Python sphere log but NOT in the JavaScript frontend:
1. "Bullshit Room (Color Dungeon)"
2. "D9 Room 3"
3. "D9 Room 4"
4. "Zol Chest (Color Dungeon)"

**Test Output:**
```
- [5:07:21 AM] REGION MISMATCH found for: {"type":"state_update","sphere_number":"4.16","player_id":"1"}
- [REGION MISMATCH DETAIL] Missing from state (4): [Bullshit Room (Color Dungeon), D9 Room 3, D9 Room 4, Zol Chest (Color Dungeon)]
- [5:07:21 AM] Test failed at step 30: Comparison failed for event type 'state_update'.
```

**Progress:**
- Test now passes through sphere 4.3 (event 17) which previously failed due to FLIPPERS mapping issue
- Test progresses to event 30 (sphere 4.16) before failing

**Next Steps:**
1. Check the sphere log to see what items are available at sphere 4.16
2. Examine the entrance rules for Color Dungeon regions in the rules.json
3. Check if there are missing item mappings or special LADX mechanics for accessing the Color Dungeon

