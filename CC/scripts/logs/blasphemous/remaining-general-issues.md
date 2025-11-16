# Remaining General Issues for Blasphemous

## Overview
This document tracks unresolved general issues that are not specific to the exporter or helper functions.

## Status
Last updated: 2025-11-16

## Critical Issues

### Issue #1: Starting items not being applied correctly in spoiler tests

**Severity:** Critical
**Category:** Test framework / State synchronization
**Status:** In Progress

**Description:**
The spoiler test fails at Sphere 0 because starting items from the sphere log are not properly synchronized with the stateManager during testing. The player should start with:
- Dash Ability (1x)
- Wall Climb Ability (1x)

**Root Cause Analysis:**
1. The exporter correctly exports `starting_items` in the rules.json
2. The sphere log correctly lists these items in `resolved_items` (not `base_items`) for Sphere 0
3. The stateManager initialization correctly applies starting_items when loading rules.json
4. **THE PROBLEM**: The test framework's EventProcessor was only looking at `base_items` from the sphere log, which is empty for starting items

**Progress:**
- ✅ Fixed EventProcessor to use `resolved_items` instead of `base_items` (lines 167, 573 in eventProcessor.js)
- ✅ Added code to explicitly add newly found items to the stateManager's inventory (lines 215-233)
- ⚠️ Test still failing - items are being added but regions still not accessible
- **Current Issue**: Complex timing/synchronization problem requiring further investigation

**Evidence:**
```
Sphere log (Sphere 0):
  "new_inventory_details": {
    "base_items": {},
    "resolved_items": {"Dash Ability": 1, "Wall Climb Ability": 1}
  }

Test output shows items ARE being added:
  [DEBUG] Adding item: Dash Ability
  [DEBUG] Added item: Dash Ability
  [DEBUG] Adding item: Wall Climb Ability
  [DEBUG] Added item: Wall Climb Ability

But regions still not accessible - needs deeper investigation
```

**Files Modified:**
- `frontend/modules/testSpoilers/eventProcessor.js` (lines 167, 215-233, 573)

**Next Steps:**
1. This issue requires deeper investigation into the test framework's state management
2. May be a fundamental architecture issue with how tests sync with the async stateManager
3. Recommend escalating to a developer familiar with the test framework architecture
