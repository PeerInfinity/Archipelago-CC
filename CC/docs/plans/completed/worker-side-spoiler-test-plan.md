# Worker-Side Spoiler Test Execution Plan

**Status: COMPLETED**

**Completed:** All phases implemented. Worker-side execution is now the default.

## Implementation Summary

The worker-side spoiler test was successfully implemented, moving test execution from the main thread to the worker thread. This eliminated the communication overhead (~50% of test time) that resulted from hundreds of round-trip messages between threads.

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `frontend/modules/stateManager/core/workerSpoilerTest.js` | CREATED | Worker-side test runner (612 lines) |
| `frontend/modules/stateManager/stateManagerWorker.js` | MODIFIED | Added `runSpoilerTest`, `abortSpoilerTest`, `signalAnalysisComplete` commands |
| `frontend/modules/stateManager/stateManagerProxy.js` | MODIFIED | Added proxy methods and message handlers |
| `frontend/modules/spoilerTest/testOrchestrator.js` | MODIFIED | Integrated worker execution with fallback |

### Key Features Implemented

- **Worker-side test execution**: All sphere processing happens in worker thread
- **Progress updates**: Per-sphere progress messages to main thread
- **Mismatch reporting**: Detailed mismatch information for debugging
- **Abort support**: Clean abort mechanism with proper cleanup
- **Fallback support**: Main-thread execution available if worker unavailable
- **Profiling integration**: Worker profiling data included in results

### Configuration

Worker-side execution is enabled by default via `useWorkerSideSpoilerTest = true` in testOrchestrator.js.

---

## Original Design Document

### Overview

This document outlines a plan to move spoiler test execution from the main thread to the worker thread. Currently, spoiler tests involve hundreds of round-trip communications between the main thread and worker, creating significant overhead (~50% of test time). By moving the test execution to the worker, we can eliminate this overhead and achieve 2-3x speedup.

## Current Architecture

### Main Thread Components

1. **testOrchestrator.js** - Controls the test loop
   - Iterates through sphere events
   - Coordinates eventProcessor and UI updates
   - Handles abort/progress tracking

2. **eventProcessor.js** - Processes individual sphere events
   - Gets sphere data from sphereState module
   - Sends commands to worker (checkLocation, addItem, etc.)
   - Creates snapshotInterface for comparison
   - Tracks inventory changes between spheres

3. **comparisonEngine.js** - Compares expected vs actual state
   - Uses evaluateRule to check location accessibility
   - Identifies mismatches (missing/extra locations/regions)
   - Stores mismatch details for analysis

4. **sphereState.js** - Parses and accumulates sphere log data
   - Handles both verbose and incremental log formats
   - Accumulates inventory across spheres
   - Provides accessibleLocations, accessibleRegions per sphere

### Current Communication Flow (per sphere)

```
Main Thread                          Worker Thread
     |                                    |
     |-- clearStateAndReset ------------->|  (sphere 0 only)
     |<-- response -----------------------|
     |                                    |
     |-- addItemToInventory (x N) ------->|  (for each new item)
     |<-- responses ----------------------|
     |                                    |
     |-- checkLocation (x M) ------------>|  (for each location)
     |<-- responses ----------------------|
     |                                    |
     |-- pingWorker --------------------->|  (sync)
     |<-- response -----------------------|
     |                                    |
     |-- getFullSnapshot ---------------->|  (for comparison)
     |<-- snapshot -----------------------|
     |                                    |
     [Compare on main thread]             |
     |                                    |
```

For ALTTP with 133 sphere events:
- ~400+ individual commands sent to worker
- ~6.6 seconds of communication overhead (50% of 13.6s total test time)

### Profiling Results (ALTTP)

| Section | Time | % of Total |
|---------|------|------------|
| Total test time | 13.6s | 100% |
| checkLocationsLoop | 10.2s | 75% |
| Worker operations | 3.6s | 26% |
| **Communication overhead** | **~6.6s** | **49%** |

## Proposed Architecture

### New Worker-Side Components

1. **workerSpoilerTest.js** - New module in `frontend/modules/stateManager/core/`
   - Processes all sphere events in worker
   - Performs location/region comparison internally
   - Sends progress updates to main thread
   - Returns final results

### New Communication Flow

```
Main Thread                          Worker Thread
     |                                    |
     |-- runSpoilerTest ----------------->|
     |   (sphereData[], config)           |
     |                                    |
     |<-- spoilerTestProgress ------------|  (periodic)
     |<-- spoilerTestProgress ------------|
     |<-- spoilerTestProgress ------------|
     |   ...                              |
     |                                    |
     |<-- spoilerTestComplete ------------|
     |   (final results)                  |
```

Benefits:
- Single initial message with all data
- No round-trip delays during execution
- Progress updates are fire-and-forget (no blocking)

## Data Structures

### Input: Sphere Data (sent to worker)

```javascript
{
  // Pre-processed sphere data (from sphereState parsing)
  sphereData: [
    {
      sphereIndex: "0",           // or "0.1", "1", etc.
      inventoryDetails: {
        base_items: { "Bow": 1, "Hookshot": 1 },
        resolved_items: { "Bow": 1, "Hookshot": 1 }
      },
      accessibleLocations: ["Eastern Palace - Compass Chest", ...],
      accessibleRegions: ["Eastern Palace", "Light World", ...],
      locations: ["Eastern Palace - Big Key Chest", ...]  // locations to check
    },
    // ... more spheres
  ],

  // Test configuration
  config: {
    playerId: 1,
    stopOnFirstError: false,
    verboseMode: false,
    focusedMode: false,
    focusLocations: []
  }
}
```

### Output: Progress Updates

```javascript
// Progress message (sent periodically)
{
  type: 'spoilerTestProgress',
  eventIndex: 45,
  totalEvents: 133,
  sphereIndex: "12",
  passed: true,
  locationsChecked: 15,
  itemsAdded: 3
}

// Mismatch message (sent when error occurs)
{
  type: 'spoilerTestMismatch',
  eventIndex: 45,
  sphereIndex: "12",
  mismatchType: 'locations',  // or 'regions'
  missingFromState: ["Location A", "Location B"],
  extraInState: ["Location C"],
  logCount: 50,
  stateCount: 49
}
```

### Output: Final Result

```javascript
{
  type: 'spoilerTestComplete',
  queryId: 123,
  result: {
    passed: true,
    totalEvents: 133,
    processedEvents: 133,
    totalLocationsChecked: 268,
    totalItemsAdded: 150,
    mismatchDetails: [],  // Array of mismatch objects if any
    executionTimeMs: 4500,
    profilingData: { ... }  // If profiling enabled
  }
}
```

## Design Decisions

### 1. Fallback to Old Implementation

**Decision:** Keep the old implementation as a fallback, but only if it doesn't add significant complexity. If maintaining both paths becomes burdensome, remove the old implementation.

**Implementation:** Add a configuration option (e.g., `useWorkerSideSpoilerTest: true`) that defaults to the new worker-side implementation but can be toggled to use the old main-thread implementation for debugging or compatibility.

### 2. Progress Update Frequency

**Decision:** Send one progress update per sphere.

**Rationale:** This provides good granularity for UI updates without flooding the message channel. For a typical game with 50-150 spheres, this means 50-150 progress messages total.

```javascript
// After each sphere is processed
this.postMessage({
  type: 'spoilerTestProgress',
  eventIndex: sphereIndex,
  totalEvents: totalSpheres,
  sphereIndex: sphere.sphereIndex,
  passed: sphereResult.passed,
  locationsChecked: sphereResult.locationsChecked,
  itemsAdded: sphereResult.itemsAdded
});
```

### 3. Mismatch Analysis Distribution

**Decision:** Split analysis between worker and main thread based on data availability.

| Analysis Type | Location | Rationale |
|---------------|----------|-----------|
| Location/region comparison | Worker | Has snapshot and static data |
| Rule evaluation debugging | Worker | Has evaluateRule and context |
| UI-dependent analysis | Main Thread | Requires DOM/window access |
| Detailed reporting | Main Thread | May need sphereState module |

**Mismatch Handling Options:**

| Option | Default | Behavior |
|--------|---------|----------|
| `stopOnFirstError` | `true` | Halt immediately on first mismatch |
| `waitForMainThreadAnalysis` | `false` | Pause for main thread analysis before continuing (only if stopOnFirstError is false) |

When `stopOnFirstError: true` (default), the worker immediately stops processing and returns results. This is useful for fast failure detection during development.

When `stopOnFirstError: false` and `waitForMainThreadAnalysis: true`, the worker pauses after each mismatch, sends details to main thread, waits for analysis completion signal, then continues.

**Synchronous Analysis Option:** Add a `waitForMainThreadAnalysis` config option (default: `false`). When enabled, the worker will pause after each mismatch and wait for the main thread to signal that it has completed its analysis before proceeding.

```javascript
// Worker-side (when waitForMainThreadAnalysis is enabled)
if (config.waitForMainThreadAnalysis && !sphereResult.passed) {
  this.postMessage({
    type: 'spoilerTestMismatch',
    ...mismatchDetails,
    awaitingAnalysis: true
  });

  // Wait for main thread to signal analysis complete
  await this.waitForAnalysisComplete();
}
```

```javascript
// Main thread handler
eventBus.subscribe('spoilerTest:mismatch', async (data) => {
  if (data.awaitingAnalysis) {
    // Perform main-thread-only analysis
    await this.analysisReporter.analyzeFailingLocations(...);

    // Signal worker to continue
    stateManager.signalAnalysisComplete();
  }
});
```

### 4. Multiworld Handling

**Decision:** Keep the current multiworld logic as-is.

**Rationale:** The existing `_processMultiworldLocations` method in eventProcessor.js already handles:
- Checking locations owned by the current player
- Adding cross-player items (items received from other players)
- Filtering starting items at sphere 0
- Handling resolved_items based on exporter settings

This logic will be ported directly to the worker without modification.

## Expected Performance Improvement

| Metric | Current | Expected |
|--------|---------|----------|
| ALTTP test time | 13.6s | ~5s |
| Communication overhead | 6.6s | ~0.1s |
| Commands per test | 400+ | 2 |
| Speedup | 1x | 2-3x |

## References

- Current profiling data: `window.__profilingData__` after running with `TEST_PROFILING=1`
- Existing comparison logic: `frontend/modules/spoilerTest/comparisonEngine.js`
- Sphere data parsing: `frontend/modules/sphereState/sphereState.js`
- Worker communication: `frontend/modules/stateManager/stateManagerWorker.js`
