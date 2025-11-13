# Remaining Exporter Issues for Jak and Daxter

This file tracks exporter issues that still need to be fixed.

## Issues

### Issue 1: Spoiler test state manager caching

**Status:** Identified - Not an exporter issue
**Priority:** Low (affects test infrastructure, not actual gameplay)

**Description:**
The spoiler test is failing because the state manager's regionReachability snapshot is stale during test playback. The helper function `can_reach_orbs` is working correctly, but it only sees the initially reachable regions (19 regions, 332 orbs) instead of all regions that should be accessible after collecting progression items during the playthrough.

**Root Cause:**
This is a state manager/test infrastructure issue, not an exporter issue. When items are collected during spoiler test playback, the cache isn't being properly recomputed before location accessibility is checked. The helper is being called with stale data.

**Evidence:**
- Helper correctly calculates orbs from regions it can see (332 orbs from 14 regions with orbs)
- But it only sees the initial 19 reachable regions
- By sphere 3.15, it should see ~100+ regions (giving 1636 total reachable orbs)
- Python sphere log shows locations should be accessible at sphere 3.15 with 1636 orbs

**Impact:**
- Does not affect actual gameplay or generation
- Only affects spoiler test validation
- Exporter and helper function are working correctly

**Next Steps:**
This requires investigation of the state manager's cache invalidation during spoiler test playback. This is outside the scope of the exporter work.
