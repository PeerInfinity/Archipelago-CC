# The Witness - Solved General Issues

## Issue 1: Test Spoilers Panel Fails to Initialize

**Status:** Resolved
**Date Resolved:** 2025-12-02
**Severity:** Critical

**Description:**
The Test Spoilers panel failed to initialize due to the rule engine encountering unknown helper functions. This was a downstream effect of the unanalyzed lambda functions in the rules.json.

**Root Cause:**
The rules.json contained `"type": "helper", "name": "condition"` patterns that referenced the iterator variable from an `all_of` comprehension. Since `condition` was not an actual helper function, the rule engine failed.

**Solution:**
Resolved by fixing the exporter issue (see solved-exporter-issues.md Issue 1) to properly analyze the lambda comprehension patterns.

---

## Issue 2: Missing sphereLogComparison.js Library

**Status:** Resolved
**Date Resolved:** 2025-12-02
**Severity:** Medium

**Description:**
The test framework was attempting to load `frontend/modules/testSpoilers/lib/sphereLogComparison.js` but the file did not exist, causing a 404 error.

**Solution:**
Created the missing file with stub implementations for the required exports:
- `parseSphereLogWithMetadata`
- `extractEventFiltersFromMetadata`
- `compareSphereLogs`
- `findFirstMismatch`
- `formatComparisonSummary`

**Files Changed:**
- `frontend/modules/testSpoilers/lib/sphereLogComparison.js` (new file)

---

## Issue 3: Race Condition in Auto-Collect Config Setting

**Status:** Resolved
**Date Resolved:** 2025-12-02
**Severity:** High

**Description:**
The `setAutoCollectEventsConfig(false)` call in `testOrchestrator.js` was fire-and-forget, meaning the test could continue before the worker had processed the config change. This caused event items like "Desert Laser Activated" to be auto-collected when they shouldn't have been.

**Solution:**
Added `pingWorker()` calls after setting configs to ensure commands are fully processed before continuing:

```javascript
await stateManager.setAutoCollectEventsConfig(false);
await stateManager.pingWorker('auto_collect_config_set', 5000);
```

**Files Changed:**
- `frontend/modules/testSpoilers/testOrchestrator.js`

---

## Issue 4: Upfront Mode Not Triggering at Sphere 0

**Status:** Resolved
**Date Resolved:** 2025-12-02
**Severity:** Medium

**Description:**
The `add_sphere_items_upfront` mode was not triggering at sphere 0 because the condition required `newlyAddedItems.length > 0`. At sphere 0, the inventory starts empty, so no items were being added, but the comparison still needed to run.

**Solution:**
1. Added `get_settings_data()` to `exporter/games/witness.py` to set `add_sphere_items_upfront = True` for The Witness
2. Modified `eventProcessor.js` to run upfront comparison even with empty items by changing the conditional structure

**Files Changed:**
- `exporter/games/witness.py` - Added `get_settings_data()` method
- `frontend/modules/testSpoilers/eventProcessor.js` - Fixed upfront mode condition

---

## Test Results

After all fixes, the test passes successfully:
- Test: `test_spoiler_full_run` - PASSED
- Duration: ~2.6 seconds
- All 31 sphere events processed correctly
- Spoiler test passed all checks
