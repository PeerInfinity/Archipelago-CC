# Solved Helper Issues for Secret of Evermore

## Issue 1: Helper function causing "Access rule evaluation failed" errors

**Status:** SOLVED

**Description:**
The `has` helper function was causing JavaScript errors during evaluation. Originally 163 locations that should be accessible in Sphere 0.1 were not being unlocked.

**Root Cause:**
1. **Incorrect staticData access**: Was trying to access `staticData.items[1]` but StateManager flattens items to `staticData.items` directly
2. **Missing error handling**: No try-catch blocks to catch and log errors
3. **Cache mechanism issues**: Module-level cache variables could cause problems in worker threads
4. **Infinite recursion risk**: Logic rules recursion had no depth limit

**Solutions Applied:**
1. **Fixed item access**: Changed from `staticData.items?.[1]` to `staticData.items`
2. **Added error handling**: Wrapped all helper functions in try-catch with detailed logging
3. **Removed caching**: Eliminated module-level cache to avoid worker thread issues
4. **Added recursion protection**:
   - Pass `visitedRules` Set through recursive calls
   - Maximum recursion depth of 10
   - Skip rules that don't provide the progress ID we're looking for

**Results:**
- Sphere 0: PASSING (57 locations accessible)
- Sphere 0.1: PASSING (163 locations with Knight Basher P_WEAPON requirement)
- Test progressed from failing at Sphere 0.1 to failing at Sphere 1.1
- Reduced error count from 163 missing locations to 46 extra locations

**Code Changes:**
- `frontend/modules/shared/gameLogic/soe/soeLogic.js`: Complete rewrite of helper functions
