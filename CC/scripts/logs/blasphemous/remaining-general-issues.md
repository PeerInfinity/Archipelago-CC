# Remaining General Issues for Blasphemous

This file tracks general issues that still need to be fixed.

## Issues

### CRITICAL: add_sphere_items_upfront not working in Sphere 0

**Status**: Partially Fixed - Code updated but test still failing
**Priority**: CRITICAL
**Type**: Frontend State Manager Bug + Possible Helper Function Issues

**Description**:
The Blasphemous game uses special settings:
- `use_resolved_items: true` - Use resolved_items from sphere log instead of base_items
- `add_sphere_items_upfront: true` - Add items from sphere log to inventory before checking accessibility

In Sphere 0, the Python backend starts with these items in `resolved_items`:
- "Dash Ability": 1
- "Wall Climb Ability": 1

However, the frontend state manager is NOT adding these items to the inventory at the start, causing:
- **0 regions accessible** (should be 500+)
- **0 locations accessible** (should be 78)
- Complete failure to progress through the game

**Expected Behavior**:
When `add_sphere_items_upfront: true`, the state manager should:
1. Load the sphere log
2. For each sphere (starting with sphere 0), add items from `resolved_items` to the inventory BEFORE evaluating accessibility
3. Then check which regions and locations become accessible

**Actual Behavior**:
The state manager is not adding the starting items from sphere 0's `resolved_items` to the inventory, so no regions are reachable from Menu.

**Test Results**:
- Sphere 0 mismatch: 78 locations accessible in LOG but NOT in STATE
- Sphere 0 mismatch: 500+ regions accessible in LOG but NOT in STATE
- Test fails immediately at sphere 0

**Location**:
Frontend state manager code that handles `add_sphere_items_upfront` setting

**Fix Applied**:
Fixed bug in `frontend/modules/testSpoilers/eventProcessor.js:168, 243, 606` where settings were accessed incorrectly:
- Changed `staticData?.settings?.add_sphere_items_upfront` to `staticData?.settings?.[String(this.playerId)]?.add_sphere_items_upfront`
- Changed `staticData?.settings?.use_resolved_items` to `staticData?.settings?.[String(this.playerId)]?.use_resolved_items`
- Settings in rules.json are keyed by player ID ("1"), not directly on settings object
- Player ID needs to be converted to string for proper object key access

**Status After Settings Fix**:
Test still failing at sphere 0. Investigation revealed a second critical bug.

**Second Bug Found: Reachability Not Triggered After Adding Items**
After adding items upfront, the state manager was not recalculating reachability.
This caused 0 regions/locations to be accessible even though items were in inventory.

**Fix Applied (Commit 3ee2822)**:
1. Added call to `stateManager.recalculateAccessibility()` after adding items upfront
2. Added wait for reachability update to complete
3. Changed comparison timing to happen immediately after adding items (not after checking locations)
4. Skip individual location checking when using add_sphere_items_upfront mode

After this fix, 1031 regions and 305 locations became accessible (Python expects 500+ regions, 78 locations).

**Current Status**:
Test times out during comparison phase. Region/location mismatches persist:
- 374 regions missing from state compared to Python backend
- Frontend calculates different set of reachable regions than Python backend
- May indicate issues with Blasphemous helper functions or access rules
- May indicate differences between Python and JavaScript rule evaluation

**Investigation Update**:
Analysis of missing regions reveals a specific pattern:
- ALL D02Z02 regions (Wasteland of the Buried Saints) are NOT accessible according to frontend
- D02Z02S05[W] should be accessible and has an exit to CO01 (Child of Moonlight cherub) with `access_rule: constant=true`
- Since D02Z02 regions aren't accessible, CO (Cherub) regions also can't be reached
- The frontend reports "No exits found from currently accessible regions" for these areas

This suggests the issue is earlier in the region graph - some parent region that should connect to D02Z02 is either:
1. Not accessible itself
2. Has an exit to D02Z02 with a failing access rule
3. Missing the exit definition entirely

**ROOT CAUSE CORRECTION - Menu to D17Z01S01 Connection WORKS, But Many D17Z01 Sub-Regions Missing**:

**Initial Investigation Result (CORRECTED)**:
- Menu → D17Z01S01 connection IS WORKING ✓
- D17Z01S01 IS accessible in frontend ✓
- Problem: Only 8 of 28 expected D17Z01 regions are accessible

**D17Z01 Regions Status**:
Frontend HAS these 8 D17Z01 regions:
- D17Z01S01, D17Z01S01[E]
- D17Z01S02[E], D17Z01S02[W]
- D17Z01S05[E], D17Z01S05[W]
- D17Z01S11, D17Z01S11[W]

Frontend MISSING these 20 D17Z01 regions:
- D17Z01S03[E], D17Z01S03[W]
- D17Z01S04 (and all 5 sub-regions)
- D17Z01S05[S], D17Z01S06[E]
- D17Z01S07 (all 5 sub-regions)
- D17Z01S08, D17Z01S08[E]
- D17Z01S09[E], D17Z01S11[E], D17Z01S12[E]

**Actual Problem**:
The missing D17Z01 regions prevent access to D01Z01 regions (since D17Z01S03[E] → D01Z01S07 connection can't be followed), which in turn blocks the entire region chain (D01Z02 → D01Z03 → D02Z01 → D02Z02 → CO regions).

**Investigation Update - Circular Dependency Found**:

The root cause is a circular dependency in region accessibility:

**The Circular Dependency**:
- D17Z01S11 (accessible) → D17Z01S11[E] (not accessible)
- Access rule requires: `has_boss_strength('warden') AND can_reach_region('D17Z01S05[E]') AND can_reach_region('D17Z01S03[W]')`
- `has_boss_strength('warden')` = TRUE ✓ (threshold -0.10, player strength 0)
- `can_reach_region('D17Z01S05[E]')` = TRUE ✓ (D17Z01S05[E] is accessible)
- `can_reach_region('D17Z01S03[W]')` = FALSE ✗ (D17Z01S03[W] not yet accessible)
- D17Z01S11[E] → D17Z01S03[W] with `constant=true` (only path to D17Z01S03[W])

**The Problem**:
To reach D17Z01S11[E], you must already reach D17Z01S03[W].
But to reach D17Z01S03[W], you must first reach D17Z01S11[E].
This is an impossible circular dependency!

**How Python Resolves It**:
Python's sphere 0 includes both D17Z01S03[W] and D17Z01S11[E] as accessible, meaning Python somehow breaks this cycle.

**Likely Frontend Bug**:
When evaluating `can_reach_region('D17Z01S03[W]')` during BFS exit evaluation, the frontend might be:
1. Recursively calling `computeReachableRegions()` which returns the current cached state (where D17Z01S03[W] is not yet reachable)
2. Not properly using the indirect connections system to re-evaluate this exit after D17Z01S03[W] becomes reachable

The indirect connections system (reachabilityEngine.js:406-423) SHOULD handle this, but it only works if D17Z01S03[W] can become reachable through some other path first. Since there is NO other path, the cycle is never broken.

**Next Step**:
Need to understand how Python's BFS handles `can_reach_region` calls during exit evaluation - does it use a "tentative reachability" approach or evaluate exits in a special order?
