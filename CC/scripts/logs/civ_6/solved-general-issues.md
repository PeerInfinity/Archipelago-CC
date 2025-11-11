# Solved General Issues for Civilization VI

This file tracks solved general issues for Civilization VI.

## Issue 1: Missing can_reach_region State Method (SOLVED)

**Status:** Solved
**Severity:** Medium (blocked victory location)
**Date Solved:** 2025-11-11
**Files Changed:**
- `frontend/modules/shared/stateInterface.js`

### Description

The "Complete a victory type" location uses a `state_method` rule calling `can_reach_region`, but this method was not implemented in the JavaScript state interface.

### Python Source

```python
set_rule(
    victory,
    lambda state: state.can_reach_region(EraType.ERA_FUTURE.value, world.player),
)
```

### Solution

Added support for `can_reach_region` and `can_reach_location` methods in `frontend/modules/shared/stateInterface.js`:

```javascript
// Handle can_reach_region method (Python alias for can_reach with Region type)
if (methodName === 'can_reach_region' && args.length >= 1) {
  const regionName = args[0];
  // args[1] would be player_id in Python but we ignore it in single-player context
  return finalSnapshotInterface.isRegionReachable(regionName);
}

// Handle can_reach_location method (Python alias for can_reach with Location type)
if (methodName === 'can_reach_location' && args.length >= 1) {
  const locationName = args[0];
  // args[1] would be player_id in Python but we ignore it in single-player context
  return finalSnapshotInterface.isLocationAccessible(locationName);
}
```

### Result

The victory location is now correctly marked as accessible when the player reaches ERA_FUTURE, allowing the game to complete successfully.
