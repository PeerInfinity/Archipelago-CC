# Secret of Evermore - Solved Helper Issues

## Issue 1: Infinite recursion in countProgress

**Status:** Solved

**Description:**
The `countProgress` function was getting into infinite recursion when evaluating logic Rule 9, which both requires and provides P_12 (progress ID 12).

**Root Cause:**
The function had a `visitedRules` parameter to track which rules were being evaluated to prevent circular dependencies, but it wasn't actually checking if a rule was in `visitedRules` before processing it.

**Fix:**
Added a check `if (visitedRules.has(i)) continue;` after checking if a rule provides the progress we're looking for. This prevents rules that are already being evaluated in the current call stack from being processed again.

**File:** `frontend/modules/shared/gameLogic/soe/soeLogic.js:67`

---
