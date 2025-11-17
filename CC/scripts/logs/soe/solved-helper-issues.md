# Solved Helper Issues for Secret of Evermore

This file tracks resolved issues with the helper functions (`frontend/modules/shared/gameLogic/soe/soeLogic.js`).

## Solved Issues

### Issue 1: Negative progress counts being added incorrectly ✅ SOLVED

**Status:** Fixed
**Sphere:** 4.6 (where issue was detected)
**Locations affected:** Aquagoth, Barrier, Double Drain, Oglin Cave #179, Tiny, Tiny's hideout #158-#164

**Description:**
The JavaScript `countProgress` function in soeLogic.js was adding all progress counts from logic rules, including negative counts. However, the Python implementation in `worlds/soe/logic.py` only adds positive counts (check `pvd[0] > 0` on line 70).

Logic Rule 9 provides `-2` count of progress ID 12:
```
Rule 9: Requires [{'count': 1, 'progress_id': 13}, {'count': 1, 'progress_id': 14}, {'count': 2, 'progress_id': 12}, {'count': 1, 'progress_id': 1}]
        -> Provides {'count': -2, 'progress_id': 12}
```

When the JavaScript code processed this rule, it subtracted 2 from the progress count, causing locations that require certain progress levels to become inaccessible.

**Fix Applied:**
Modified `frontend/modules/shared/gameLogic/soe/soeLogic.js:88` to only add positive progress counts:
```javascript
if (provide.progress_id === progressId && provide.count > 0) {
  count += provide.count;
}
```

**Result:** All 341 sphere events now pass. Test completed successfully with 0 errors.

**Python reference:** `worlds/soe/logic.py:70`
