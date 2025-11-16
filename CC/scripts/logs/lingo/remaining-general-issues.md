# Remaining General Issues for Lingo

This file tracks outstanding general issues with the Lingo game implementation.

## ROOT CAUSE IDENTIFIED

### Issue 1: snapshot.reachableRegions is undefined (CRITICAL)

**Status**: ROOT CAUSE OF ALL FAILURES

**Problem**: The snapshot object passed to helper functions does not contain a `reachableRegions` property.

**Evidence**: Debug logs show:
```
[_lingo_can_satisfy_requirements] Snapshot reachableRegions type: undefined
[_lingo_can_satisfy_requirements] Reachable regions: []
```

**Impact**:
- Locations requiring room access fail because the helper cannot verify if rooms are reachable
- Locations without room requirements pass unconditionally, causing too many locations to be accessible
- This explains both the "missing" locations (those requiring rooms) and "extra" locations (those with no requirements or non-room requirements)

**Expected behavior**: The snapshot should include a `reachableRegions` Set (or array) containing all currently reachable region/room names.

**Investigation needed**:
1. Check how StateManager creates snapshots
2. Verify if `reachableRegions` should be included by default or if it's game-specific
3. Determine if this is a Lingo-specific configuration issue or a general StateManager issue

**File**: This is NOT an exporter or helper issue - it's a StateManager/snapshot issue

**Status**: RESOLVED - Fixed by using `snapshot.regionReachability` instead of `snapshot.reachableRegions`

### Issue 2: Too many regions accessible at sphere 0 (ACTIVE INVESTIGATION)

**Status**: INVESTIGATING

**Problem**: 114 extra regions are accessible at sphere 0, causing 21 extra locations to be accessible.

**Findings**:
- The 21 remaining extra locations all have empty access requirements (no rooms, doors, colors, or items needed)
- This means they're accessible purely based on their region being accessible
- The regions themselves have entrance rules that are too permissive
- Many entrance access rules are simplified to `constant true` by the exporter
- `lingo_can_use_entrance` helper is NEVER used in the rules.json (0 occurrences)

**Root cause hypothesis**:
The exporter is over-simplifying entrance rules when door=None, replacing `lingo_can_use_entrance(room, None)` with `constant true`. While this might be correct for entrances without doors, it creates a chain reaction where all regions become accessible from any starting region.

**Investigation needed**:
1. Determine if entrances without doors should have additional requirements (e.g., checking door_reqs for non-item doors)
2. Check if entrance rules should be calling `_lingo_can_satisfy_requirements` for door_reqs
3. Verify the logic in the exporter's `postprocess_entrance_rule` and `_simplify_entrance_rule` methods

