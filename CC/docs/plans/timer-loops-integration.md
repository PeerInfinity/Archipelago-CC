# Timer + Loops Integration Plan

## Overview

This document outlines the plan to integrate the Timer module with the Loops module via a new `timer:quickCheck` event. This allows the Timer's auto-check functionality to work seamlessly with Loop mode, where actions are queued and executed with mana costs rather than happening instantly.

## Goals

1. Create a new `timer:quickCheck` event that both Timer interval and Quick Check button dispatch
2. Loops module intercepts this event when loop mode is active, queuing appropriate actions
3. Timer module handles the event as a fallback when loop mode is inactive
4. Timer UI works in both modes (currently disabled in loop mode)
5. Refactor timerTests.js to separate the timer and loops-queue tests

---

## Phase 1: Timer Module Changes

### 1.1 Event Registration

**File: `frontend/modules/timer/index.js`**

Add the following registrations:

```javascript
// Register timer:quickCheck as both publisher and receiver
registrationApi.registerEventBusPublisher('timer:quickCheck');

// Register as dispatcher receiver for timer:quickCheck (fallback handler)
registrationApi.registerDispatcherReceiver(
  moduleInfo.name,
  'timer:quickCheck',
  handleTimerQuickCheck,  // New handler function
  { direction: 'up' }
);

// Subscribe to loopState:loopReset for restart in loop mode
registrationApi.registerEventBusSubscriberIntent(
  moduleInfo.name,
  'loopState:loopReset'
);
```

### 1.2 TimerLogic Changes

**File: `frontend/modules/timer/timerLogic.js`**

#### Current Behavior (to change)
- `begin()` sets up an interval that calls `_determineAndDispatchNextLocationCheck()` directly
- Quick Check button calls `determineAndDispatchQuickCheck()` directly
- Timer runs continuously until stopped

#### New Behavior

1. **Dispatch `timer:quickCheck` instead of direct calls**:
   ```javascript
   // In begin() - replace interval callback
   this._dispatchQuickCheck();

   // New method
   _dispatchQuickCheck() {
     this.dispatcher.publish('timer:quickCheck', {
       source: 'timer',
       timestamp: Date.now()
     }, { initialTarget: 'bottom' });
   }
   ```

2. **Timer stops after dispatching, restarts on completion**:
   ```javascript
   // Track pending state
   this.pendingLocationName = null;
   this.isWaitingForCompletion = false;

   // After dispatching timer:quickCheck
   this.isWaitingForCompletion = true;
   this._stopInterval();  // Stop the repeating interval
   ```

3. **Add handler for when Timer receives `timer:quickCheck`** (fallback when Loops passes it on):
   ```javascript
   handleTimerQuickCheck(eventData, propagationOptions) {
     // This is called when loop mode is NOT active
     // Do the current location-finding and dispatching logic
     const targetLocation = this._findNextAccessibleLocation();
     if (targetLocation) {
       this.pendingLocationName = targetLocation.name;
       this._dispatchLocationCheck(targetLocation);
     } else {
       // No accessible locations, restart timer after delay
       this._scheduleNextQuickCheck();
     }
   }
   ```

4. **Restart logic based on mode**:

   **Non-loop mode** - Subscribe to `stateManager:snapshotUpdated`:
   ```javascript
   _handleSnapshotUpdated(eventData) {
     if (!this.pendingLocationName || !this.isWaitingForCompletion) return;

     const snapshot = eventData?.snapshot;
     if (snapshot?.checkedLocations?.includes(this.pendingLocationName)) {
       // Location was checked successfully
       this._onCheckComplete();
     }
   }

   _onCheckComplete() {
     this.pendingLocationName = null;
     this.isWaitingForCompletion = false;
     this._scheduleNextQuickCheck();
   }

   _scheduleNextQuickCheck() {
     if (!this._isRunning) return;
     // Schedule next timer:quickCheck after configured delay
     this._nextCheckTimeout = setTimeout(() => {
       this._dispatchQuickCheck();
     }, this._timerInterval);
   }
   ```

   **Loop mode** - Subscribe to `loopState:loopReset`:
   ```javascript
   _handleLoopReset(eventData) {
     if (!this._isRunning) return;
     // Loop reset means we can queue the next action
     this.isWaitingForCompletion = false;
     this._scheduleNextQuickCheck();
   }
   ```

5. **Handle check rejection**:
   ```javascript
   _handleLocationCheckRejected(eventData) {
     if (eventData.locationName === this.pendingLocationName) {
       this.pendingLocationName = null;
       this.isWaitingForCompletion = false;
       this._scheduleNextQuickCheck();
     }
   }
   ```

### 1.3 TimerUI Changes

**File: `frontend/modules/timer/timerUI.js`**

1. **Remove loop mode disable check**:
   ```javascript
   // Remove or modify the subscription to loop:modeChanged that disables controls
   // Controls should now remain enabled in loop mode
   ```

2. **Quick Check button dispatches event**:
   ```javascript
   if (this.quickCheckButton) {
     this.quickCheckButton.addEventListener('click', () => {
       // Dispatch timer:quickCheck instead of calling timerLogic directly
       this.dispatcher.publish('timer:quickCheck', {
         source: 'quickCheckButton',
         timestamp: Date.now()
       }, { initialTarget: 'bottom' });
     });
   }
   ```

---

## Phase 2: Loops Module Changes

### 2.1 Event Registration

**File: `frontend/modules/loops/index.js`**

```javascript
// Register as dispatcher receiver for timer:quickCheck
registrationApi.registerDispatcherReceiver(
  moduleInfo.name,
  'timer:quickCheck',
  handleTimerQuickCheckForLoops,
  { direction: 'up' }
);
```

### 2.2 New Handler Function

**File: `frontend/modules/loops/loopEvents.js`**

```javascript
import { PathFinder } from '../shared/pathfinder.js';
import { createStateSnapshotInterface } from '../shared/stateInterface.js';
import discoveryStateSingleton from '../discovery/singleton.js';

/**
 * Handles the 'timer:quickCheck' event for the Loops module.
 * When loop mode is active, finds the next target and queues actions.
 * When loop mode is inactive, passes the event to the next handler (Timer).
 */
export function handleTimerQuickCheckForLoops(eventData, propagationOptions) {
  log('info', '[LoopEvents] Received timer:quickCheck event:', eventData);

  const dispatcher = getLoopsModuleDispatcher();

  // If loop mode is NOT active, pass to next handler (Timer)
  if (!isLoopModeActive) {
    log('info', '[LoopEvents] Loop mode not active, passing to next handler');
    if (dispatcher) {
      dispatcher.publishToNextModule(
        moduleInfo.name,
        'timer:quickCheck',
        eventData,
        { direction: 'up' }
      );
    }
    return;
  }

  // Loop mode IS active - handle the quick check
  log('info', '[LoopEvents] Loop mode active, processing timer:quickCheck');

  handleQuickCheckInLoopMode().catch(error => {
    log('error', '[LoopEvents] Error in handleQuickCheckInLoopMode:', error);
  });
}

async function handleQuickCheckInLoopMode() {
  // Get dependencies
  const playerStateAPI = getPlayerStateAPI();
  if (!playerStateAPI) {
    log('error', '[LoopEvents] PlayerState API not available');
    return;
  }

  const loopState = getLoopState();
  if (!loopState) {
    log('error', '[LoopEvents] LoopState not available');
    return;
  }

  // Get fresh snapshot and static data
  const snapshot = stateManager.getSnapshot();
  const staticData = stateManager.getStaticData();
  if (!snapshot || !staticData || !staticData.locations) {
    log('error', '[LoopEvents] Snapshot or static data not available');
    return;
  }

  const snapshotInterface = createStateSnapshotInterface(snapshot, staticData);
  const pathFinder = new PathFinder(stateManager);

  // Get start region
  const startRegions = stateManager.getStartRegions?.() || ['Menu'];
  const startRegion = startRegions[0] || 'Menu';

  // Get manually-checkable locations (locations with IDs)
  const locationsArray = Array.from(staticData.locations.values());
  const manuallyCheckableLocations = locationsArray.filter(
    loc => loc.id !== null && loc.id !== undefined && loc.id !== 0
  );

  // FIRST: Try to find an accessible unchecked location
  let targetLocation = null;
  let targetRegion = null;

  for (const loc of manuallyCheckableLocations) {
    if (snapshot.checkedLocations?.includes(loc.name)) {
      continue;
    }

    if (snapshotInterface.isLocationAccessible(loc.name)) {
      targetLocation = loc;
      targetRegion = loc.parent_region || loc.region;
      break;
    }
  }

  if (targetLocation) {
    log('info', `[LoopEvents] Found accessible location: ${targetLocation.name} in ${targetRegion}`);
    await queueLocationCheck(playerStateAPI, loopState, pathFinder, startRegion, targetLocation, targetRegion);
    return;
  }

  // SECOND: No accessible location - try to find unexplored region
  log('info', '[LoopEvents] No accessible locations, looking for unexplored regions');

  const targetExploreRegion = findUnexploredReachableRegion(snapshot, staticData);

  if (targetExploreRegion) {
    log('info', `[LoopEvents] Found unexplored region: ${targetExploreRegion}`);
    await queueExploreAction(playerStateAPI, loopState, pathFinder, startRegion, targetExploreRegion);
    return;
  }

  // THIRD: Nothing to do
  log('info', '[LoopEvents] No accessible locations and no unexplored regions');
  // Could publish a notification event here for UI feedback
}

/**
 * Find a reachable region that has undiscovered exits
 */
function findUnexploredReachableRegion(snapshot, staticData) {
  const regionReachability = snapshot.regionReachability || {};

  for (const [regionName, status] of Object.entries(regionReachability)) {
    if (status !== 'reachable' && status !== 'checked') {
      continue;
    }

    const region = staticData.regions?.get(regionName);
    if (!region || !region.exits) {
      continue;
    }

    // Check if any exit in this region is undiscovered
    for (const exit of region.exits) {
      if (!discoveryStateSingleton.isExitDiscovered(regionName, exit.name)) {
        return regionName;
      }
    }
  }

  return null;
}

/**
 * Queue a location check with path building
 */
async function queueLocationCheck(playerStateAPI, loopState, pathFinder, startRegion, targetLocation, targetRegion) {
  const dispatcher = getLoopsModuleDispatcher();

  // Clear current queue
  playerStateAPI.trimPath?.(startRegion, 1);

  // Build path from start region to target region
  const path = pathFinder.findPathWithExits(startRegion, targetRegion);

  if (path) {
    // Queue move actions for each path step
    let previousRegion = startRegion;
    for (let i = 1; i < path.steps.length; i++) {
      const step = path.steps[i];
      dispatcher.publish('user:regionMove', {
        sourceRegion: previousRegion,
        targetRegion: step.region,
        exitName: step.exitUsed,
        updatePath: true,
      }, { initialTarget: 'bottom' });
      previousRegion = step.region;
    }
  } else if (targetRegion !== startRegion) {
    log('error', `[LoopEvents] Cannot find path from ${startRegion} to ${targetRegion}`);
    return;
  }

  // Queue the location check
  playerStateAPI.addLocationCheck?.(targetLocation.name, targetRegion);

  // Start processing if not already started
  if (!loopState.isProcessing) {
    loopState.startProcessing();
  }
}

/**
 * Queue an explore action with path building
 */
async function queueExploreAction(playerStateAPI, loopState, pathFinder, startRegion, targetRegion) {
  const dispatcher = getLoopsModuleDispatcher();

  // Clear current queue
  playerStateAPI.trimPath?.(startRegion, 1);

  // Build path from start region to target region
  const path = pathFinder.findPathWithExits(startRegion, targetRegion);

  if (path) {
    // Queue move actions for each path step
    let previousRegion = startRegion;
    for (let i = 1; i < path.steps.length; i++) {
      const step = path.steps[i];
      dispatcher.publish('user:regionMove', {
        sourceRegion: previousRegion,
        targetRegion: step.region,
        exitName: step.exitUsed,
        updatePath: true,
      }, { initialTarget: 'bottom' });
      previousRegion = step.region;
    }
  } else if (targetRegion !== startRegion) {
    log('error', `[LoopEvents] Cannot find path from ${startRegion} to ${targetRegion}`);
    return;
  }

  // Queue explore action with repeat=true
  playerStateAPI.addCustomAction?.('explore', { repeat: true });

  // Start processing if not already started
  if (!loopState.isProcessing) {
    loopState.startProcessing();
  }
}
```

---

## Phase 3: Test Refactoring

### 3.1 Create Standalone Timer Test

**New file: `frontend/modules/tests/testCases/timerTest.js`**

Extract the `timerOfflineTest` function from timerTests.js and register it:

```javascript
import { registerTest } from '../testRegistry.js';

async function timerOfflineTest(testController) {
  // ... existing timer test logic ...
}

registerTest({
  id: 'timerOfflineTest',
  name: 'Timer Offline Test',
  description: 'Tests the timer module location checking in offline mode',
  category: 'Timer',
  run: timerOfflineTest,
});
```

### 3.2 Create Standalone Loops Queue Test

**New file: `frontend/modules/tests/testCases/loopsQueueTest.js`**

Extract the `timerOfflineTestWithLoopsQueue` function and register it:

```javascript
import { registerTest } from '../testRegistry.js';

async function loopsQueueTest(testController) {
  // ... existing loops-queue test logic ...
}

registerTest({
  id: 'loopsQueueTest',
  name: 'Loops Queue Test',
  description: 'Tests location checking using the loops module action queue',
  category: 'Loops',
  run: loopsQueueTest,
});
```

### 3.3 Create Experimental Tests File

**New file: `frontend/modules/tests/testCases/experimentalTimerTests.js`**

Move all other test modes here:
- `sphere-order`
- `snapshot-order`
- `sphere-order-with-accessibility-check`
- `sphere-order-check-rejection-test`
- `ganon-immediate-check`
- `sphere-order-no-autocollect`
- `sphere-order-with-accessibility-check-no-autocollect`

```javascript
/**
 * DEPRECATED: Experimental Timer Tests
 *
 * These tests were used during development to experiment with different
 * location checking strategies. They are preserved for reference but
 * are not part of the standard test suite.
 *
 * To run these tests, they must be explicitly enabled via the test
 * configuration or by changing the testMode variable.
 */

import { registerTest } from '../testRegistry.js';

// ... test functions ...

// Register with "Timer (Experimental)" category
registerTest({
  id: 'sphereOrderTest',
  name: 'Sphere Order Test',
  description: 'EXPERIMENTAL: Checks locations in sphere log order',
  category: 'Timer (Experimental)',
  run: sphereOrderTest,
});

// ... other experimental tests ...
```

### 3.4 Update Original timerTests.js

**File: `frontend/modules/tests/testCases/timerTests.js`**

Option A: Delete the file entirely (tests are now in separate files)

Option B: Keep as an index that imports and re-exports:
```javascript
// Legacy compatibility - tests have been split into separate files
// See: timerTest.js, loopsQueueTest.js, experimentalTimerTests.js

export { timerOfflineTest } from './timerTest.js';
export { loopsQueueTest } from './loopsQueueTest.js';
```

---

## Event Flow Diagrams

### Non-Loop Mode Flow

```
Timer interval fires
    │
    ▼
dispatcher.publish('timer:quickCheck')
    │
    ▼
Loops module receives (isLoopModeActive = false)
    │
    ▼
Loops calls dispatcher.publishToNextModule()
    │
    ▼
Timer module receives (fallback handler)
    │
    ▼
Timer finds accessible location
    │
    ▼
Timer dispatches 'user:locationCheck'
Timer sets pendingLocationName, isWaitingForCompletion = true
    │
    ▼
... normal location check flow ...
    │
    ▼
stateManager:snapshotUpdated fires (location now in checkedLocations)
    │
    ▼
Timer detects completion, clears pending state
    │
    ▼
Timer schedules next timer:quickCheck after delay
```

### Loop Mode Flow

```
Timer interval fires (or Quick Check button clicked)
    │
    ▼
dispatcher.publish('timer:quickCheck')
    │
    ▼
Loops module receives (isLoopModeActive = true)
    │
    ▼
Loops finds accessible location OR unexplored region
    │
    ▼
Loops clears queue, builds path from start region
    │
    ▼
Loops queues move actions + location check (or explore)
    │
    ▼
Loops starts processing if not already started
    │
    ▼
... queue executes, mana depletes or check completes ...
    │
    ▼
loopState:loopReset fires
    │
    ▼
Timer receives loopState:loopReset
    │
    ▼
Timer schedules next timer:quickCheck after delay
```

---

## Files Summary

### Files to Modify

| File | Changes |
|------|---------|
| `frontend/modules/timer/index.js` | Register `timer:quickCheck` publisher/receiver, subscribe to `loopState:loopReset` |
| `frontend/modules/timer/timerLogic.js` | Dispatch `timer:quickCheck`, add fallback handler, track pending location, restart on completion/reset |
| `frontend/modules/timer/timerUI.js` | Enable controls in loop mode, Quick Check dispatches `timer:quickCheck` |
| `frontend/modules/loops/index.js` | Register `timer:quickCheck` receiver |
| `frontend/modules/loops/loopEvents.js` | Add `handleTimerQuickCheckForLoops()` with location check + explore fallback |
| `frontend/modules/tests/testCases/timerTests.js` | Remove all functions or convert to index |

### New Files

| File | Purpose |
|------|---------|
| `frontend/modules/tests/testCases/timerTest.js` | Standalone timer test |
| `frontend/modules/tests/testCases/loopsQueueTest.js` | Standalone loops queue test |
| `frontend/modules/tests/testCases/experimentalTimerTests.js` | Deprecated experimental tests |

---

## Implementation Order

1. **Phase 1.1-1.2**: Timer module event registration and logic changes
2. **Phase 1.3**: Timer UI changes (enable in loop mode)
3. **Phase 2.1-2.2**: Loops module event registration and handler
4. **Phase 3**: Test refactoring (can be done in parallel with Phase 1-2)
5. **Testing**: Verify both modes work correctly
   - Timer works normally when loop mode is off
   - Timer + Loops integration works when loop mode is on
   - Both timer test and loops-queue test pass

---

## Design Decisions

1. **UI Feedback**: When no accessible locations or unexplored regions exist, no UI notification is shown. The timer simply stops. This requires the Loops module to signal back to the Timer when there's nothing to do (see "Nothing To Do" event below).

2. **Progress Tracking**: The Timer progress bar only shows timer progress. The Loops module is responsible for displaying loops-specific data (mana, queue progress, etc.).

3. **Explore Strategy**: Use the current simple strategy (first reachable region with undiscovered exits). Future enhancement: add an option to find all available actions and pick one at random.

4. **Error Recovery**: If path building fails for something that should be reachable, report it as an error. Do not silently skip or try alternatives.

---

## Additional Event: "Nothing To Do"

When the Loops module handles `timer:quickCheck` and finds neither accessible locations nor unexplored regions, it needs to signal back to the Timer so the Timer knows to stop.

### New Event: `loops:nothingToDo`

**Published by**: Loops module (in `handleTimerQuickCheckForLoops`)
**Subscribed by**: Timer module

```javascript
// In loopEvents.js - when nothing to do
if (!targetLocation && !targetExploreRegion) {
  log('info', '[LoopEvents] No accessible locations and no unexplored regions');
  eventBus.publish('loops:nothingToDo', {
    reason: 'no_accessible_locations_or_unexplored_regions',
    timestamp: Date.now()
  }, 'loops');
  return;
}
```

```javascript
// In timerLogic.js - handle nothing to do
_handleNothingToDo(eventData) {
  if (!this._isRunning) return;

  log('info', '[TimerLogic] Received loops:nothingToDo, stopping timer');
  this.stop();

  // Optionally update UI to indicate completion
  this.eventBus.publish('timer:completed', {
    reason: eventData.reason
  }, 'timer');
}
```

### Timer Registration Update

**File: `frontend/modules/timer/index.js`**

```javascript
// Subscribe to loops:nothingToDo
registrationApi.registerEventBusSubscriberIntent(
  moduleInfo.name,
  'loops:nothingToDo'
);
```

---

## Future Enhancements

1. **Random Action Selection**: Add option to find all available actions (accessible locations + unexplored regions) and pick one at random, rather than always taking the first one found.

2. **Priority Strategies**: Allow configuring how to prioritize targets (e.g., closest region, most exits, sphere order).

3. **Completion Statistics**: Track and display statistics about how many locations were checked, how many loops were run, etc.
