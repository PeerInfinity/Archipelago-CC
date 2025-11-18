# Remaining Helper Issues for The Witness

## Issue 1: Need Region Reachability Helpers for Laser Activations

**Status:** Not Started
**Priority:** High
**Related Exporter Issue:** Issue 1 in remaining-exporter-issues.md

**Description:**
Laser activation event locations require checking if specific regions are reachable. The Python code creates `region.can_reach` lambdas, which export as conditional patterns that reference "self" (the region object). The frontend cannot evaluate these because it doesn't know which region "self" refers to.

**Affected Locations:**
- Bunker Laser Activated → requires "Bunker Laser Platform" region
- Swamp Laser Activated → requires "Swamp Laser Area" or similar region
- Town Laser Activated → requires region with Town Laser Panel
- Treehouse Laser Activated → requires region with Treehouse Laser Panel
- Quarry Laser Activated → might also be affected
- Keep Laser Activated → has complex region OR requirements

**Solution Approach:**
1. Create `frontend/public/helpers/witness.js` with helper functions
2. Implement `can_reach_region(state, regionName)` helper
3. Modify Witness exporter to detect laser activation locations
4. Convert their conditional patterns to `{ type: 'helper', name: 'can_reach_region', args: ['RegionName'] }`
5. Map each laser to its required region (may need to inspect rules.json and sphere log)

**Implementation Notes:**
- The helper function should check if the specified region is in state.reachableRegions
- May need to call state.updateReachableRegions() first if state is stale
- Each laser activation needs manual mapping to its region requirement
- Some lasers might have OR conditions (multiple ways to activate)
