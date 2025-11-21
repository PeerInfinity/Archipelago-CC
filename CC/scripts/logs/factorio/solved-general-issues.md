# Solved General Issues - Factorio

This file tracks resolved general issues that were not specific to the exporter or helper functions.

## Solved Issues

### Issue 1: Progressive Item Resolution in Access Rules (FIXED)

**Severity**: Critical
**Type**: State Management / Progressive Items
**Status**: ✅ SOLVED

**Problem**:
Test failed at Sphere 2.1 with location "Automate logistic-science-pack" being incorrectly marked as inaccessible, even though player had `progressive-science-pack: 2`.

**Root Cause**:
The Factorio helper's `has()` function was looking for `staticData.progression_mapping[playerSlot]` but this field wasn't being populated. Only `staticData.progressionMapping` (camelCase, not player-indexed) was available.

**Solution**:
Added fallback in `frontend/modules/shared/gameLogic/factorio/factorioLogic.js`:
```javascript
const progressionMapping = staticData?.progression_mapping?.[playerSlot] || staticData?.progressionMapping;
```

**Result**: All 67 events pass, including Victory at sphere 12.1!

**Files Modified**:
- `frontend/modules/shared/gameLogic/factorio/factorioLogic.js`: Added progressionMapping fallback

**Commits**:
- 89a0c75: Fix Factorio progressive item resolution in access rules

