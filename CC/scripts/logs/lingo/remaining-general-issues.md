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

