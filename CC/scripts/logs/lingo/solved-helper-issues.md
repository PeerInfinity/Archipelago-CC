# Lingo: Solved Helper Issues

## Issue 1: lingo_can_use_level_2_location helper received empty regionReachability

**Status**: Solved

**Description**:
The `lingo_can_use_level_2_location` helper function was returning false incorrectly because the `regionReachability` field in the snapshot was empty.

**Root Cause**:
The helper was being called through `resolveName()` in `statePersistence.js` (lines 691-715), which creates a lightweight snapshot for calling helper functions directly. This lightweight snapshot was missing the `regionReachability` field that the helper needs to count panels in reachable regions.

**Call Chain**:
1. `evaluateRule` sees helper rule `{rule: "lingo_can_use_level_2_location", ...}`
2. `evaluateRuleBuilderRule` handles it and calls `evaluateRule({type: 'helper', name: 'lingo_can_use_level_2_location', args: []})`
3. `case 'helper'` in evaluateRule eventually calls `context.resolveName(rule.name)` to check for bound variables
4. `resolveName` finds the helper function and calls it directly with a minimal snapshot

**Solution**:
Added `regionReachability` to the snapshot created in `resolveName()` when calling helper functions directly:

```javascript
// Create a snapshot for the helper that includes regionReachability
const regionReachability = {};
if (sm.regions) {
  for (const regionName of sm.regions.keys()) {
    if (sm.knownReachableRegions.has(regionName)) {
      regionReachability[regionName] = 'reachable';
    } else {
      regionReachability[regionName] = 'unreachable';
    }
  }
}
const snapshot = {
  inventory: sm.inventory,
  flags: sm.gameStateModule?.flags || [],
  events: sm.gameStateModule?.events || [],
  player: { id: sm.playerId, slot: sm.playerId },
  checkedLocations: Array.from(sm.checkedLocations || []),
  regionReachability: regionReachability
};
```

**Files Modified**:
- `frontend/modules/stateManager/core/statePersistence.js` - Added regionReachability to lightweight snapshot in resolveName()

**Test Result**: Spoiler test now passes for Lingo with seed 1.

Last updated: 2026-01-31
