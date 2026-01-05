# Worker-Side Spoiler Test Execution Plan

## Overview

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

## Implementation Plan

### Phase 1: Create Worker-Side Test Runner

**File: `frontend/modules/stateManager/core/workerSpoilerTest.js`**

```javascript
/**
 * Worker-side spoiler test execution
 *
 * Processes sphere events entirely within the worker to eliminate
 * communication overhead with the main thread.
 */

import { profiler } from '../../shared/profiler.js';

export class WorkerSpoilerTest {
  constructor(stateManager, postMessage) {
    this.sm = stateManager;
    this.postMessage = postMessage;
    this.aborted = false;
  }

  /**
   * Run the full spoiler test
   */
  async run(sphereData, config) {
    const { playerId, stopOnFirstError, verboseMode } = config;

    profiler.start('workerSpoilerTest');

    const results = {
      passed: true,
      processedEvents: 0,
      mismatchDetails: [],
      locationsChecked: 0,
      itemsAdded: 0
    };

    try {
      // Disable auto-collect events
      this.sm.setAutoCollectEventsConfig(false);
      this.sm.setSpoilerTestMode(true);

      for (let i = 0; i < sphereData.length; i++) {
        if (this.aborted) break;

        const sphere = sphereData[i];
        const sphereResult = await this.processSphere(sphere, playerId, i);

        results.processedEvents++;
        results.locationsChecked += sphereResult.locationsChecked;
        results.itemsAdded += sphereResult.itemsAdded;

        // Send progress update
        this.postMessage({
          type: 'spoilerTestProgress',
          eventIndex: i,
          totalEvents: sphereData.length,
          sphereIndex: sphere.sphereIndex,
          passed: sphereResult.passed
        });

        if (!sphereResult.passed) {
          results.passed = false;
          results.mismatchDetails.push(sphereResult.mismatch);

          if (stopOnFirstError) break;
        }
      }
    } finally {
      // Re-enable auto-collect events
      this.sm.setAutoCollectEventsConfig(true);
      this.sm.setSpoilerTestMode(false);

      profiler.end('workerSpoilerTest');
      results.profilingData = profiler.getData();
    }

    return results;
  }

  /**
   * Process a single sphere
   */
  async processSphere(sphere, playerId, index) {
    // Implementation details...
  }

  /**
   * Compare accessible locations
   */
  compareLocations(expected, snapshot) {
    // Port comparison logic from comparisonEngine.js
  }

  /**
   * Compare accessible regions
   */
  compareRegions(expected, snapshot) {
    // Port comparison logic from comparisonEngine.js
  }

  /**
   * Abort the test
   */
  abort() {
    this.aborted = true;
  }
}
```

### Phase 2: Add Worker Commands

**File: `frontend/modules/stateManager/stateManagerWorker.js`**

Add new command handlers:

```javascript
import { WorkerSpoilerTest } from './core/workerSpoilerTest.js';

let activeSpoilerTest = null;

// In handleMessage switch:

case 'runSpoilerTest':
  if (!workerInitialized || !stateManagerInstance) {
    throw new Error('Worker not initialized');
  }

  activeSpoilerTest = new WorkerSpoilerTest(
    stateManagerInstance,
    (msg) => self.postMessage(msg)
  );

  const testResult = await activeSpoilerTest.run(
    message.payload.sphereData,
    message.payload.config
  );

  self.postMessage({
    type: 'spoilerTestComplete',
    queryId: message.queryId,
    result: testResult
  });

  activeSpoilerTest = null;
  break;

case 'abortSpoilerTest':
  if (activeSpoilerTest) {
    activeSpoilerTest.abort();
  }
  break;
```

### Phase 3: Update Main Thread

**File: `frontend/modules/stateManager/stateManagerProxy.js`**

Add proxy methods:

```javascript
/**
 * Run spoiler test entirely in worker
 */
async runSpoilerTest(sphereData, config) {
  return new Promise((resolve, reject) => {
    const queryId = this.nextQueryId++;

    // Set up progress handler
    const progressHandler = (msg) => {
      if (msg.type === 'spoilerTestProgress') {
        this.eventBus.publish('spoilerTest:progress', msg);
      }
    };

    // Temporary listener for progress
    this.worker.addEventListener('message', progressHandler);

    // Set up completion handler
    this.pendingQueries.set(queryId, {
      resolve: (result) => {
        this.worker.removeEventListener('message', progressHandler);
        resolve(result);
      },
      reject
    });

    this.sendCommandToWorker({
      command: 'runSpoilerTest',
      queryId,
      payload: { sphereData, config }
    });
  });
}

/**
 * Abort running spoiler test
 */
abortSpoilerTest() {
  this.sendCommandToWorker({
    command: 'abortSpoilerTest'
  });
}
```

**File: `frontend/modules/spoilerTest/testOrchestrator.js`**

Update to use worker-side execution:

```javascript
async runFullSpoilerTest(spoilerLogData, playerId, logPath) {
  // Prepare sphere data (use existing sphereState parsing)
  const sphereData = this.prepareSphereDataForWorker(spoilerLogData, playerId);

  const config = {
    playerId,
    stopOnFirstError: this.stateConfig.stopOnFirstError,
    verboseMode: this.verboseMode
  };

  // Subscribe to progress updates
  const unsubscribe = this.eventBus.subscribe('spoilerTest:progress', (data) => {
    this.updateStepInfo(data.eventIndex, data.totalEvents);
    this.uiCallbacks.log('info', `Sphere ${data.sphereIndex}: ${data.passed ? 'PASS' : 'FAIL'}`);
  });

  try {
    const result = await stateManager.runSpoilerTest(sphereData, config);

    // Handle final result
    if (result.passed) {
      this.uiCallbacks.log('success', 'All spheres passed!');
    } else {
      this.uiCallbacks.log('error', `Test failed with ${result.mismatchDetails.length} mismatches`);
    }

    return result;
  } finally {
    unsubscribe();
  }
}
```

### Phase 4: Testing & Validation

1. **Unit tests** for WorkerSpoilerTest class
2. **Integration tests** comparing results with old implementation
3. **Performance benchmarks** to measure speedup
4. **Edge case testing**:
   - Abort during execution
   - Games with sub-spheres (0.1, 0.2, etc.)
   - Multiworld games
   - Games with add_sphere_items_upfront flag

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `frontend/modules/stateManager/core/workerSpoilerTest.js` | CREATE | Worker-side test runner |
| `frontend/modules/stateManager/stateManagerWorker.js` | MODIFY | Add runSpoilerTest command |
| `frontend/modules/stateManager/stateManagerProxy.js` | MODIFY | Add proxy methods |
| `frontend/modules/stateManager/stateManagerCommands.js` | MODIFY | Add command constants |
| `frontend/modules/spoilerTest/testOrchestrator.js` | MODIFY | Use worker execution |

## Migration Strategy

1. **Parallel implementation**: Keep existing code, add new worker-side path
2. **Feature flag**: Allow switching between old and new implementations
3. **Gradual rollout**: Test with specific games first
4. **Deprecation**: Remove old code path after validation

## Expected Performance Improvement

| Metric | Current | Expected |
|--------|---------|----------|
| ALTTP test time | 13.6s | ~5s |
| Communication overhead | 6.6s | ~0.1s |
| Commands per test | 400+ | 2 |
| Speedup | 1x | 2-3x |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Behavior differences | Extensive testing, parallel run comparison |
| Memory usage (large sphere data) | Stream data if needed, test with large games |
| Abort handling complexity | Clear abort flag checking, cleanup on abort |
| UI responsiveness | One progress update per sphere (see Design Decisions) |

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

## Timeline Estimate

- Phase 1 (Worker test runner): 4-6 hours
- Phase 2 (Worker commands): 1-2 hours
- Phase 3 (Main thread updates): 2-3 hours
- Phase 4 (Testing): 2-4 hours
- **Total**: 9-15 hours of development

## References

- Current profiling data: `window.__profilingData__` after running with `TEST_PROFILING=1`
- Existing comparison logic: `frontend/modules/spoilerTest/comparisonEngine.js`
- Sphere data parsing: `frontend/modules/sphereState/sphereState.js`
- Worker communication: `frontend/modules/stateManager/stateManagerWorker.js`
