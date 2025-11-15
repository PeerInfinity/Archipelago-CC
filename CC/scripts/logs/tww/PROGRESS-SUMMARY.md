# The Wind Waker Debugging - Progress Summary

## Session Date
2025-11-15

## Completed Work

### 1. Environment Setup ✅
- Created Python virtual environment
- Installed all dependencies (Python, Node.js, Playwright)
- Generated templates
- Configured host settings for minimal-spoilers mode

### 2. Issue Investigation ✅
- Identified root cause: Exporter was recursively inlining all helper functions
- This created massive rules (763 lines for one location!)
- Rules.json had 0 helper type references initially

### 3. Exporter Fixes ✅
**File Modified:** `exporter/games/tww.py`

**Changes Made:**
1. Implemented `should_preserve_as_helper()` method
   - Returns True for functions starting with 'can_' or 'has_'
   - Prevents recursive inlining of Macros.py helper functions

2. Overrode `expand_rule()` method
   - Prevents generic exporter from transforming helper rules to capability rules
   - Keeps helper functions as callable JavaScript functions

**Results:**
- Rules.json now has 191 helper type references (vs. 0 before)
- Big Key Chest rule reduced from 763 to 94 lines
- Clean, maintainable rule structure

### 4. Helper Function Implementation 🚧 **IN PROGRESS**
**File Created:** `frontend/modules/shared/gameLogic/tww/twwLogic.js` (855 lines)

**Implemented:**
- All 14 state method handlers (_tww_* functions)
- All 64+ helper functions from Macros.py that are used in rules.json

**Issue Discovered:**
Helper functions are calling methods like `snapshot.has()`, but the snapshot parameter is the raw state object, not the stateSnapshotInterface. The raw snapshot has:
- `snapshot.inventory` - Map of item names to counts
- `snapshot.flags` - Array of flags
- `snapshot.events` - Array of events
- `snapshot.player` - Player info

## Remaining Work

### Critical: Fix Helper Function API 🔴

**Problem:**
```
TypeError: snapshot.has is not a function
TypeError: snapshot.hasAll is not a function
TypeError: snapshot.hasGroupUnique is not a function
```

**Solution:**
Need to add core helper functions at the top of twwLogic.js:

```javascript
// Core helper functions for working with raw snapshot
function has(snapshot, itemName, count = 1) {
  return (snapshot.inventory?.[itemName] || 0) >= count;
}

function hasAll(snapshot, items) {
  return items.every(item => has(snapshot, item, 1));
}

function hasAny(snapshot, items) {
  return items.some(item => has(snapshot, item, 1));
}

function hasGroupUnique(snapshot, groupName, count) {
  // Count unique items from a group (e.g., "Shards" group)
  // Need to reference staticData.groups[groupName] to get group members
  // Then count how many we have
}
```

**Then Update All Helper Functions:**
Replace ALL occurrences of:
- `snapshot.has(...)` → `has(snapshot, ...)`
- `snapshot.hasAll(...)` → `hasAll(snapshot, ...)`
- `snapshot.hasAny(...)` → `hasAny(snapshot, ...)`
- `snapshot.hasGroupUnique(...)` → `hasGroupUnique(snapshot, ...)`

This needs to be done in ~64 helper functions throughout the file.

### Testing
After fixing the snapshot API:
1. Run: `npm test --mode=test-spoilers --game=tww --seed=1`
2. If passes, run: `python scripts/test/test-all-templates.py --retest --retest-continue 10 -p`

## Files Modified This Session

1. `exporter/games/tww.py` - Exporter fixes ✅
2. `frontend/modules/shared/gameLogic/tww/twwLogic.js` - Helper implementations 🚧
3. `CC/scripts/logs/tww/*.md` - Issue tracking files ✅
4. `frontend/presets/tww/AP_*/AP_*_rules.json` - Regenerated with preserved helpers ✅

## Git Commits

1. "Fix TWW exporter to preserve helper functions instead of inlining" - **PUSHED**
   - Implements should_preserve_as_helper() and expand_rule()
   - Massive improvement in rule size and structure

## Next Steps

1. **Immediate:** Fix snapshot API in all helper functions
2. **Test:** Run spoiler tests to verify functionality
3. **Iterate:** Fix any remaining logic errors
4. **Complete:** Run full template test suite

## References

- Python Macros: `worlds/tww/Macros.py` (1115 lines, 200+ functions)
- Rules Schema: `frontend/schema/rules.schema.json`
- Example Logic: `frontend/modules/shared/gameLogic/alttp/alttpLogic.js`
