# Secret of Evermore - Remaining Helper Issues

## Issue 1: Stale snapshot passed to helper during reachability computation

**Status:** CRITICAL - Test Failure at Sphere 4.1 - ROOT CAUSE IDENTIFIED

**Description:**
The spoiler test fails at Sphere 4.1 with 12 locations that should be accessible but are not:
- Aquagoth, Barrier, Double Drain, Oglin Cave #179, Tiny, Tiny's hideout #158-164

**Root Cause:**
The helper function receives **different snapshots** depending on when it's called:
- **Early calls** (during initial reachability computation): Snapshot #2447 with Diamond Eye = 0 → Returns 0
- **Later calls** (after items collected): Snapshot #12538 with Diamond Eye = 2 → Returns 2

The reachability cache is computed using an old snapshot (before Diamond Eyes are collected), and even though `invalidateCache()` is called after item collection, subsequent reachability checks may still use stale data.

**Evidence:**
```
Call #3598: Snapshot 2447, Diamond Eye count = 0 → Returns 0 for progress 12
  - Checking progress_id 12, visitedRules: [3]
  - Rule 9 NOT activated (requirements not met)
  - RETURN 0 for progress_id 12

Call #35982: Snapshot 12538, Diamond Eye count = 2 → Returns 2 for progress 12
  - Checking progress_id 12, visitedRules: [3]
  - Found Diamond Eye (count 2) provides progress_id 12: +2, total now: 2
  - RETURN 2 for progress_id 12
```

**Access Rule Chain:**
1. Aquagoth requires progress ID 31
2. Rule 3 provides progress 31 if: 1x progress 1 (P_WEAPON) + 2x progress 12
3. Progress 12 is provided by Diamond Eye items
4. When Rule 3 is evaluated with old snapshot (Diamond Eye = 0), it fails
5. When Rule 3 is evaluated with new snapshot (Diamond Eye = 2), it succeeds

**Location in Code:**
- Helper: `frontend/modules/shared/gameLogic/soe/soeLogic.js:20` - `countProgress()` function
- StateManager: Rule evaluation calls `getSnapshot()` which may return stale data
- Issue is NOT in the helper logic itself - it correctly evaluates rules given the snapshot
- Issue is in StateManager snapshot management during reachability computation

**Fix Needed:**
Ensure that when reachability is recomputed after items are collected, it uses a fresh snapshot. The fix should be in the StateManager's reachability engine or how snapshots are passed to helpers during rule evaluation.

**Debugging Added:**
- Added call counter to track which snapshot is used for each `countProgress()` call
- Added snapshot count logging to identify when old snapshots are used
- Confirmed that Diamond Eyes ARE collected correctly (inventory goes 0→1→2)
- Confirmed that helper logic is correct - it just receives wrong snapshot data

**Priority:** CRITICAL - Test failure, but root cause identified

**Location:** frontend/modules/shared/gameLogic/soe/soeLogic.js:20

---

## Issue 2: Settings-based progress not tested

**Status:** Unknown

**Description:**
The helper function has special handling for:
- P_ALLOW_OOB (progress 25) - checks settings.out_of_bounds === 2
- P_ALLOW_SEQUENCE_BREAKS (progress 26) - checks settings.sequence_breaks === 2
- P_ENERGY_CORE (progress 9) - checks if fragments mode is enabled

**Analysis:**
These settings-based checks have not been tested yet. They may work correctly, but we won't know until we test with different settings configurations.

**Priority:** Low (not blocking current test failure)

---

## Summary

**Total Helper Issues:** 1 critical (stale snapshot), 1 untested (settings)

**Root Cause:** NOT a helper bug - the helper is working correctly! The issue is that StateManager passes stale snapshots to the helper during reachability computation.

**Next Steps:**
1. Fix StateManager to ensure fresh snapshots are used after item collection
2. Verify fix by running spoiler test again
3. Test settings-based progress checks with different configurations
