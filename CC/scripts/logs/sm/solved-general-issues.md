# Super Metroid - Solved General Issues

This document tracks resolved general issues not specific to the exporter or helper functions.

## Solved Issues

### Issue 1: SMBool difficulty not checked in and/or rules

**Date**: 2025-11-26

**Problem**: The rule engine's `and` and `or` handlers extracted the boolean value from SMBool objects but ignored the difficulty. This caused locations to be marked as accessible even when the total difficulty exceeded maxDiff.

**Symptom**: At sphere 3.4, "Missile (below Ice Beam)" was marked accessible in STATE but NOT in LOG because the difficulty from `canHellRun('Ice', 1.0, 2)` with 3 energy tanks (difficulty 50) was not being checked against maxDiff (50 for hardcore).

**Root Cause**: In VARIA logic, `wand` accumulates difficulties from all conditions, and the final SMBool is checked against maxDiff. The JavaScript rule engine's `and`/`or` handlers were not accumulating difficulties, so the check never happened.

**Solution**: Updated `frontend/modules/shared/ruleEngine.js`:
1. Modified the `and` handler to track accumulated difficulty from SMBool conditions and return an SMBool with total difficulty
2. Modified the `or` handler to track minimum difficulty among passing conditions and return an SMBool
3. Added a depth 0 check at the end of `evaluateRule()` to convert SMBool to boolean with proper difficulty check against maxDiff

**Files Changed**: `frontend/modules/shared/ruleEngine.js`
