# Remaining General Issues

## Issue 1: Starting items not being processed at Sphere 0

**Severity:** Critical
**Type:** General/Systemic

**Description:**
The spoiler test fails at Sphere 0 because starting items are not being properly processed. The sphere log shows that at sphere_index 0, the player should have:
- Dash Ability: 1
- Wall Climb Ability: 1

And these items should make 400+ regions accessible. However, the frontend STATE shows no regions as accessible (except Menu).

**Expected behavior:**
- Starting items from `starting_items` field in rules.json should be added to the player's inventory at initialization
- All regions that are accessible with just the starting items should be marked as reachable at Sphere 0

**Actual behavior:**
- Frontend STATE shows no regions accessible except Menu
- Starting items are not being applied to the initial game state

**Evidence:**
```
Regions accessible in LOG but NOT in STATE: CO01, CO05, CO11, ... [400+ regions]
```

**Location:**
This is likely an issue with:
- StateManager initialization in frontend
- How starting_items are processed
- Initial region reachability calculation

**Investigation findings:**
1. Starting items ("Dash Ability" and "Wall Climb Ability") ARE correctly defined in rules.json starting_items field
2. Both items exist in the items data with proper IDs
3. The processStartingItems() function in initialization.js appears correctly structured
4. The function calls beginBatchUpdate(), adds items, then calls commitBatchUpdate()
5. commitBatchUpdate() should call computeReachableRegions() since inventory changed
6. There's an additional call to buildIndirectConnections() and computeReachableRegions() after processStartingItems completes
7. Start region is correctly defined as "Menu"
8. Menu has an exit to "D17Z01S01" with access_rule: {"type": "constant", "value": true}

**Current hypothesis:**
The issue is NOT with starting items being added to inventory. The issue is that region reachability computation is either:
a) Not happening at all during initialization
b) Happening but exits/regions aren't being traversed correctly
c) Happening but the results aren't being captured/compared correctly in the test

**Next steps:**
- Debug trace initialization flow to verify computeReachableRegions() is called
- Check if regions are being marked as reachable in internal state
- Investigate Menu -> D17Z01S01 transition
- Check if there's an issue with how Blasphemous evaluates exit access rules
- May need to add extensive logging to understand the actual execution flow
