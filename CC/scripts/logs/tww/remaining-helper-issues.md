# The Wind Waker - Remaining Helper Issues

## Issue 1: hasGroupUnique not working correctly

**Status:** In Progress
**Priority:** High
**Category:** Helper Implementation

**Description:**
The `hasGroupUnique` function in `frontend/modules/shared/gameLogic/tww/twwLogic.js` is not correctly counting unique items from groups. The test fails at Sphere 12.2 when checking access to "Master Sword Chamber", which requires `can_access_hyrule`, which uses `hasGroupUnique(snapshot, staticData, "Shards", player, 8)` to check if the player has 8 Triforce Shards.

**Error Messages:**
```
REGION MISMATCH found for: {"type":"state_update","sphere_number":"12.2","player_id":"1"}
> Regions accessible in LOG but NOT in STATE: Master Sword Chamber
ISSUE: Region Master Sword Chamber is not reachable
ISSUE: Access rule evaluation failed
```

**Root Cause:**
The `hasGroupUnique` function implementation may have an issue with how it accesses item groups or counts unique items in the inventory.

**Current Status:**
- Basic helper functions (has, hasAny, hasAll) are working correctly
- Test now passes Sphere 0 and progresses to Sphere 12.2
- At Sphere 12.2, player has all 8 Triforce Shards
- Items in rules.json have correct "Shards" group
- `hasGroupUnique` function exists but may have implementation issue

**Impact:**
- Cannot access Hyrule/Master Sword Chamber region
- Test fails at step 48 (Sphere 12.2)

**Fix Required:**
1. Debug and fix `hasGroupUnique` function implementation
2. Ensure it correctly counts unique items from groups
3. Verify it works with Triforce Shards group
