# Solved General Issues for Pokemon Red/Blue

This document tracks resolved general issues related to Pokemon Red/Blue support.

## Solved Issues

### 1. Sphere 0 state being cleared multiple times

**Date Solved:** 2025-12-02

**Problem:**
The `eventProcessor.js` was resetting the `_sphere0Cleared` flag to `false` in the `setContext()` method, which is called for EVERY event in the test. This caused `clearStateAndReset()` to be called for each sub-sphere (0, 0.1, 0.2, 0.3, etc.), wiping items added in previous sub-spheres.

As a result, Pokemon like Pidgey, Spearow, Rattata, etc. that were added at sphere 0.1 were wiped when sphere 0.2 was processed, making Evolution locations inaccessible later in the test.

**Fix:**
Modified `setContext()` to only reset `_sphere0Cleared` on NEW test runs (when `currentLogIndex === 0` or spoiler log data changes), not for every event:

```javascript
// Before (buggy):
setContext(currentLogIndex, spoilerLogData, playerId) {
  this._sphere0Cleared = false; // Reset for new test run - BUG: called every event!
  ...
}

// After (fixed):
setContext(currentLogIndex, spoilerLogData, playerId) {
  const isNewTestRun = currentLogIndex === 0 || this.spoilerLogData !== spoilerLogData;
  if (isNewTestRun) {
    this._sphere0Cleared = false; // Reset for new test run
  }
  ...
}
```

**Files Modified:**
- `frontend/modules/testSpoilers/eventProcessor.js` (setContext method)

### 2. Sphere number type comparison bug

**Date Solved:** 2025-12-02

**Problem:**
The sphere_number from the JSON sphere log was a string (e.g., "0", "0.1"), but the comparison for sphere 0 clearing was using strict equality which failed for string values.

**Fix:**
Added `parseInt()` to handle both string and number sphere values correctly:

```javascript
const sphereNumberInt = parseInt(String(context.sphere_number), 10);
if (sphereNumberInt === 0 && !this._sphere0Cleared) {
  await stateManager.clearStateAndReset();
  ...
}
```

**Files Modified:**
- `frontend/modules/testSpoilers/eventProcessor.js` (processSingleEvent method)

### 3. Missing sphereLogComparison.js file

**Date Solved:** 2025-12-02

**Problem:**
The test runner was failing with 404 error for `sphereLogComparison.js` module which was expected by the comparison engine but didn't exist.

**Fix:**
Created the missing `sphereLogComparison.js` file with the required exports.

**Files Created:**
- `frontend/modules/testSpoilers/sphereLogComparison.js`
