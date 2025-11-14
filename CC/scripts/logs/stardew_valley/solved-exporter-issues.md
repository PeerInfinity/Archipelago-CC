# Stardew Valley - Solved Exporter Issues

## Issue 1: Reach rules converted to constant true (SOLVED)

**Status**: Solved
**Date Solved**: 2025-11-14
**Priority**: High
**Type**: Exporter Issue

**Description**:
The exporter was converting all "Reach" rules (which check if a region or location is accessible) to `constant true` based on the assumption that "the frontend handles region reachability automatically". This caused locations to be incorrectly accessible at the start of the game when they should have had region accessibility requirements.

**Locations Affected**:
1. Read Mapping Cave Systems - Required "Marlon's bedroom" region
2. Copper Ore (Logic event) - Required specific regions
3. Iron Ore (Logic event) - Required specific regions
4. Gold Ore (Logic event) - Required specific regions
5. Well Blueprint - Had complex requirements with Reach rules
6. Complete Community Center - Had Reach rule requirements
7. Carnival Bundle - Had Reach rule requirements
8. Egg Festival: Strawberry Seeds - Had Reach rule requirements

**Root Cause**:
In exporter/games/stardew_valley.py:117-127, Reach rules were being simplified to:
```python
return {
    'type': 'constant',
    'value': True
}
```

**Solution Implemented**:
1. Modified the exporter to properly convert Reach rules to region_check or location_check based on the resolution_hint:
   - `resolution_hint == 'Region'` → `region_check`
   - `resolution_hint == 'Location'` → `location_check`

2. Added support for `region_check` rule type in the frontend rule engine (frontend/modules/shared/ruleEngine.js)

3. Added `isRegionAccessible` method to the snapshot interface (frontend/modules/stateManager/core/statePersistence.js) as an alias to `isRegionReachable`

**Files Modified**:
- exporter/games/stardew_valley.py
- frontend/modules/shared/ruleEngine.js
- frontend/modules/stateManager/core/statePersistence.js

**Test Command**:
```bash
npm test --mode=test-spoilers --game=stardew_valley --seed=1
```

**Result**: Exporter now correctly exports region accessibility requirements.
