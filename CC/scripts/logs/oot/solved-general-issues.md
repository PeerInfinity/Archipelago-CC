# OOT Solved General Issues

## Issues Fixed

### 1. Age Not Initialized from Settings ✅ FIXED

**Date Fixed**: 2025-11-15
**Location**: frontend/modules/stateManager/core/statePersistence.js
**Commit**: fe276b6

**Problem**:
The age was not being included in state snapshots. The gameStateModule had the age set correctly (from loadSettings), but getSnapshot() was not including it in the snapshot object that gets sent to helpers.

**Root Cause**:
The getSnapshot() function in statePersistence.js was hardcoded to only extract `flags` and `events` from gameStateModule. It did not call the game logic module's `getStateForSnapshot()` function, which is the proper way to get game-specific state.

**Solution**:
Modified getSnapshot() to:
1. Call `logicModule.getStateForSnapshot(gameStateModule)` if the function exists
2. Merge the returned game-specific state into the snapshot
3. Fallback to extracting just flags and events for games without getStateForSnapshot

**Code Change**:
```javascript
// Before:
const snapshot = {
  ...
  flags: sm.gameStateModule?.flags || [],
  events: sm.gameStateModule?.events || [],
  ...
};

// After:
let gameSpecificState = {};
if (sm.logicModule && typeof sm.logicModule.getStateForSnapshot === 'function') {
  gameSpecificState = sm.logicModule.getStateForSnapshot(sm.gameStateModule || {});
} else {
  gameSpecificState = {
    flags: sm.gameStateModule?.flags || [],
    events: sm.gameStateModule?.events || [],
  };
}

const snapshot = {
  ...
  ...gameSpecificState,  // Includes age, flags, events
  ...
};
```

**Test Result**:
After fix, spoiler test progressed past Sphere 0. Many regions are now correctly accessible. The helper function `is_starting_age` now correctly evaluates to true because snapshot.age is set to "child".

**Impact**:
This fix benefits ALL games that implement getStateForSnapshot(), not just OOT. Games can now include arbitrary game-specific state in snapshots (age, difficulty, mode, etc.).
