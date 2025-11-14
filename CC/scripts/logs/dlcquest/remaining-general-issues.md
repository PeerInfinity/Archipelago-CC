# DLCQuest - Remaining General Issues

This file tracks unresolved general issues with DLCQuest that don't fall under exporter or helper categories.

## Issue 1: Spoiler Test Comparison Timing (CRITICAL - Systemic)

**Status:** Identified
**Priority:** Critical (affects all games with accumulated/progressive items)
**Location:** `frontend/modules/testSpoilers/eventProcessor.js:200-325`

**Problem:**
The spoiler test is comparing accessible locations AFTER collecting items from the current sphere, but it should compare BEFORE collecting items.

**Current Flow:**
1. Check all locations in sphere (lines 227-272) - this collects items
2. Get fresh snapshot (line 298) - snapshot now has collected items
3. Compare accessible locations (line 320) - compares with items already collected

**Expected Flow:**
1. Get snapshot BEFORE checking locations
2. Compare accessible locations using pre-check snapshot
3. Then check all locations to collect items

**Evidence:**
- Test output: "Locations accessible in STATE (and unchecked) but NOT in LOG: Movement Pack"
- Movement Pack requires `state.prog_items[1][" coins"] >= 4`
- In Sphere 0, the "Move Right coins" location gives 4 coins
- Movement Pack should NOT be accessible in Sphere 0 (before collecting coins)
- Movement Pack SHOULD be accessible in Sphere 0.1 (after collecting coins)
- But the test is comparing AFTER collecting coins, so it incorrectly thinks Movement Pack is accessible in Sphere 0

**Sphere Log Evidence:**
```json
Sphere 0: {"new_accessible_locations": ["Move Right coins"], "sphere_locations": []}
Sphere 0.1: {"new_accessible_locations": ["Movement Pack"], "sphere_locations": ["Move Right coins"]}
```

**Impact:**
This is a systemic issue that affects ALL spoiler tests, not just DLCQuest. Any game with progressive/accumulated items will have incorrect test results.

**Fix Required:**
Move the comparison to BEFORE checking locations. The snapshot for comparison should be taken before any items are collected in the current sphere.

**Proposed Fix:**
In `eventProcessor.js`, move lines 285-410 (the comparison code) to BEFORE lines 227-272 (the location checking code).
