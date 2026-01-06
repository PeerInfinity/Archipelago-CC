# SC2 Solved General Issues

*Last updated: 2026-01-06*

## Issue #1: Worker Query Timeout for Large Games (FIXED)

### Problem

SC2 spoiler tests were failing with "Query timed out: runSpoilerTest" error. The test would process approximately 100 spheres (through Sphere 14.1) before timing out.

### Root Cause

The `sendQueryToWorker` function in `stateManagerProxy.js` had a default timeout of 10 seconds. SC2 with 135 spheres required approximately 15 seconds to complete, exceeding this timeout.

### Solution

Modified `runSpoilerTest()` in `stateManagerProxy.js` to use a dynamic timeout based on the number of spheres:

```javascript
async runSpoilerTest(sphereData, config) {
  log('info', `[StateManagerProxy] Running worker-side spoiler test with ${sphereData.length} spheres`);
  // Use a longer timeout for spoiler tests - base 10s + 200ms per sphere
  // This handles games with many spheres (e.g., SC2 has 135 spheres)
  const timeoutMs = 10000 + (sphereData.length * 200);
  return this.sendQueryToWorker({
    command: 'runSpoilerTest',
    payload: { sphereData, config }
  }, timeoutMs);
}
```

### File Changed

- `frontend/modules/stateManager/stateManagerProxy.js` (lines 2550-2559)

### Verification

After the fix, the SC2 spoiler test completes successfully:
- All 135 spheres processed
- `passed=true`
- `processedEvents=135/135`
- No errors or mismatches

## Test Results

The SC2 game now passes all spoiler tests with seed 1.
