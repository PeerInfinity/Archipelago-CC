# Stardew Valley - Solved Helper Issues

## Issue 1: Missing helper function "count_true" (SOLVED)

**Status**: Solved
**Date Solved**: 2025-11-14
**Priority**: High
**Type**: Helper Issue

**Description**:
The spoiler test showed that some locations were using a helper function called "count_true" which was not implemented.

**Solution Implemented**:
Created `frontend/modules/shared/gameLogic/stardew_valley/helpers.js` with the `count_true` function that:
- Takes a required count threshold
- Takes a list of rule objects
- Evaluates each rule using snapshot.evaluateRule()
- Returns true if at least requiredCount rules evaluate to true
- Includes short-circuit optimization for performance

The function corresponds to the Python `Count` class in `stardew_rule/base.py`.

**Files Created**:
- frontend/modules/shared/gameLogic/stardew_valley/helpers.js

**Files Modified**:
- frontend/modules/shared/gameLogic/gameLogicRegistry.js (registered Stardew Valley)

**Test Command**:
```bash
npm test --mode=test-spoilers --game=stardew_valley --seed=1
```

**Result**: count_true helper function is working correctly.
