# Remaining Helper Issues for Lingo

This file tracks outstanding issues with the Lingo game helper functions.

## Test Results Summary

- **Sphere 0 Test**: FAILED
- Many locations are marked as accessible that shouldn't be
- 5 locations that should be accessible are not

## Identified Issues

### Issue 1: lingo_can_use_location returns true unconditionally (CRITICAL)

**File**: `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`
**Lines**: 63-69

The `lingo_can_use_location` helper currently returns `true` unconditionally:

```javascript
export function lingo_can_use_location(snapshot, staticData, location) {
  // This is a placeholder implementation
  // The actual logic would need to evaluate AccessRequirements
  // For now, return true to allow progression
  // TODO: Implement proper location access checking
  return true;
}
```

**Impact**: This is likely causing all 96 extra locations to be accessible at sphere 0.

**Expected behavior**: This helper should evaluate the location's AccessRequirements to determine if it's accessible.

**Status**: HIGH PRIORITY - This is likely the main issue

### Issue 2: _lingo_can_satisfy_requirements - Incorrect argument handling

**File**: `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`
**Lines**: 78-169

The helper is called with `location.access` as an argument, but it's unclear if this is being passed correctly from the rule engine. The helper expects an AccessRequirements object directly.

**Investigation needed**:
1. Verify that `location.access` is being resolved correctly in the rule engine
2. Check if the access attribute from the location JSON is available in the rule evaluation context

**Status**: NEEDS INVESTIGATION

### Issue 3: _lingo_can_open_door doesn't check door_reqs for doors without items

**File**: `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`
**Lines**: 207-211

The function returns `true` for doors without items, but should check `door_reqs` data:

```javascript
// Door doesn't have an associated item, so it must be accessible through
// other means (e.g., access requirements).
// For doors without items, we need to check door_reqs from player_logic
// This data would need to be exported in settings or elsewhere
// For now, assume accessible
// TODO: Export and check door_reqs data
return true;
```

**Note**: The exporter DOES export `door_reqs` in settings, so this just needs to be implemented.

**Status**: MEDIUM PRIORITY

### Issue 4: _lingo_can_satisfy_requirements doesn't handle mastery requirement

**File**: `frontend/modules/shared/gameLogic/lingo/lingoLogic.js`
**Lines**: 152-158

The mastery requirement check is not implemented:

```javascript
// Check mastery requirement
if (access.the_master) {
  // This would require checking lingo_can_use_mastery_location
  // For now, we'll skip this as it requires more complex logic
  // TODO: Implement mastery checking
  console.warn('[_lingo_can_satisfy_requirements] Mastery requirement not yet implemented');
}
```

**Status**: LOW PRIORITY (may not affect sphere 0)

