# Solved Helper Issues for Yacht Dice

## Issue 1: Async yacht_weights.json loading

**Problem:** The `yacht_weights.json` file was being loaded asynchronously via `fetch()`, but the helper function was being called synchronously before the data finished loading. This caused the helper to use fallback estimation which gave incorrect (too low) scores.

**Solution:**
1. Converted `yacht_weights.json` to `yacht_weights.js` as a JavaScript module
2. Changed from async `fetch()` to synchronous `import`
3. Data now loads synchronously when the module is imported
4. Helper function can immediately access the data

**Files Changed:**
- Created: `frontend/modules/shared/gameLogic/yachtdice/yacht_weights.js`
- Modified: `frontend/modules/shared/gameLogic/yachtdice/helpers.js`

**Verification:**
Console logs confirm: "[YachtDice] yacht_weights data loaded successfully" appears on module load

