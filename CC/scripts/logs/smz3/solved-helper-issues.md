# Solved Helper Issues for SMZ3

This file tracks resolved issues in the SMZ3 helper functions (`frontend/modules/shared/gameLogic/smz3/smz3Logic.js`).

## Issue 1: Sahasrahla location not accessible at Sphere 5.8 - SOLVED

**Status**: FIXED ✓

**Description**:
- Location: Sahasrahla
- Expected: Should be accessible at Sphere 5.8 (when KeySP is obtained)
- Actual: Not accessible in JavaScript state evaluation
- Access rule: `smz3_CanAcquire(2)` where 2 = PendantGreen

**Root Cause**:
- The `smz3_CanAcquire` function was checking `if (snapshot.evaluateRule)` at the beginning (line 507)
- If evaluateRule was not available, it immediately returned false without attempting boss location lookup
- During Sphere 5.8 evaluation in the test harness, snapshot.evaluateRule is not available
- The player DOES have all required items: KeySP=1, Hammer=1, Hookshot=1

**Fix Applied**:
- Restructured the code to find the boss location first (doesn't require evaluateRule)
- Manual evaluation of simple AND rules with item_check conditions now happens before checking for evaluateRule
- Only complex rules require snapshot.evaluateRule as a fallback
- Changes: Lines 505-581 in smz3Logic.js

**Verification**:
- Test now passes Sphere 5.8 successfully
- Progresses to Sphere 7.7 (next issue)
