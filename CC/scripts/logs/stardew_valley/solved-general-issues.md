# Stardew Valley - Solved General Issues

This document tracks general issues that have been resolved.

## Resolved Issues

### 1. Spoiler Test Timeout

**Problem**: The spoiler test was timing out after processing approximately 100+ spheres (around sphere 13), failing with "Query timed out: runSpoilerTest" error. The default query timeout of 10 seconds was insufficient for Stardew Valley which has 500 locations with complex access rules.

**Symptoms**:
- Test would show progress up to around sphere 13.3 then fail
- Error message: "Error during worker-side spoiler test: Query timed out: runSpoilerTest"
- Final results showed "0/322 events processed" (misleading - actually processed many before timeout)

**Root Cause**: The `sendQueryToWorker` function in `stateManagerProxy.js` uses a default 10-second timeout. Stardew Valley's 500 locations with complex rules (including 1003 region_check evaluations and 243 helper definitions) requires ~25-30 seconds to fully evaluate.

**Solution**: Increased the timeout for `runSpoilerTest` to 5 minutes (300000ms) in `frontend/modules/stateManager/stateManagerProxy.js`.

```javascript
const spoilerTestTimeout = 300000; // 5 minutes
return this.sendQueryToWorker({
  command: 'runSpoilerTest',
  payload: { sphereData, config }
}, spoilerTestTimeout);
```

**Fixed in**: `frontend/modules/stateManager/stateManagerProxy.js`

**Verification**: After the fix, all 322 sphere events are processed successfully in ~27 seconds.

---

Last updated: 2026-01-06
