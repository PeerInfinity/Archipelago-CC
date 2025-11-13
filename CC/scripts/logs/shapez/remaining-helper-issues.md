# Shapez Remaining Helper Issues

## Issue 1: Region reachability not updated correctly at sphere 4.9

**Status:** Partially Fixed - Root cause identified
**Priority:** Medium
**Type:** State Manager Issue
**Date Investigated:** 2025-11-13

### Description
At sphere 4.9, the test fails because regions "Levels with 3/4/5 buildings" and "Upgrades with 3/4/5 buildings" are not marked as reachable in the frontend state, even though the access rules evaluate to true.

### Symptoms
- Test fails at sphere 4.9 (event 24/31)
- Regions not marked as reachable: Levels with 3/4/5 buildings, Upgrades with 3/4/5 buildings
- Multiple locations inaccessible: Level 12-25, Belt/Miner/Painting/Processors Upgrade Tier V-VIII, Wires, Even faster, Faster, Goal
- Error: "Regions accessible in LOG but NOT in STATE"

### Root Cause Analysis
Investigation revealed that:
1. **Helper functions are working correctly** - has_logic_list_building evaluates properly and returns true
2. **OPTIONS resolution added** - OPTIONS constants are now properly resolved in frontend (stateInterface.js:329-351)
3. **Access rules evaluate correctly** - The comparison ("3_buildings" == OPTIONS.buildings_3) evaluates to true
4. **includeuseful parameter works** - Correctly checks for Trash, Balancer, and Tunnel items
5. **State manager issue** - Despite access rules evaluating to true, the state manager is not marking regions as reachable

### Investigation Details
- At sphere 4.9, player has: Balancer (sphere 1), Tunnel (sphere 4.4), Trash (sphere 4.9)
- Access rule from "Levels with 2 buildings" → "Levels with 3 buildings" evaluates to true
- Helper returns: `has_logic_list_building(..., index=2, includeuseful=true) = true`
- But region reachability is not updated in the state

### Fixes Implemented
1. **Added OPTIONS support to stateInterface.js** (line 329-351)
   - Resolves OPTIONS.buildings_3 to "3_buildings"
   - Resolves OPTIONS.buildings_5 to "5_buildings"
   - Allows comparison rules like `"3_buildings" == OPTIONS.buildings_3` to evaluate correctly

### Remaining Issue
The state manager is not propagating region reachability correctly even when access rules evaluate to true. This is likely a state update or region traversal issue in the core state management code, not a shapez-specific issue.

### Test Impact
Test progresses to sphere 4.9 (24 events) out of 31 total events = 77% success rate.

### Next Steps
1. Investigate state manager's region reachability calculation logic
2. Check if region connectivity is being updated when inventory changes
3. Verify that exit access rules are being evaluated during state updates, not just during test comparisons
4. May need to file an issue with the core state manager team
