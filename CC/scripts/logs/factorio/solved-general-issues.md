# Factorio General Issues - Solved

## Issue 1: progression_mapping not available in staticData (SOLVED)

**Problem:**
The `staticData` object did not include `progression_mapping` with the correct snake_case key name. The Factorio helper function was looking for `staticData.progression_mapping[playerSlot]`, but the staticData only had `progressionMapping` (camelCase).

**Solution:**
Added `progression_mapping` key to staticData in `frontend/modules/stateManager/core/statePersistence.js`:
```javascript
progression_mapping: sm.rules?.progression_mapping,  // Add snake_case version for compatibility with game helpers
```

**Result:**
- Sphere 1.8 now passes! (was previously failing)
- Test now fails at Sphere 2.1 (progress from 1.8 to 2.1)
- Progressive item resolution is now working correctly for technologies

**File Modified:**
- `frontend/modules/stateManager/core/statePersistence.js:672`
