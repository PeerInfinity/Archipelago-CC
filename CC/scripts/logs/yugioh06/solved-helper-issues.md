# Yu-Gi-Oh! 2006 - Solved Helper Issues

*Last updated: 2025-11-30*

## Issue 1: `only_dragon` helper had incorrect item name concatenation

**Status:** Solved
**Fixed in commit:** (pending commit)
**File:** `frontend/modules/shared/gameLogic/yugioh06/yugioh06Logic.js`

### Problem

The `only_dragon` helper function incorrectly concatenated "Cave Dragon" and "Armed Dragon LV3" into a single string "Cave DragonArmed Dragon LV3". This was based on an incorrect assumption about a Python string concatenation bug.

### Evidence

The Python code at `worlds/yugioh06/rules.py` lines 671-672 clearly showed two separate items:
```python
        "Cave Dragon",
        "Armed Dragon LV3",
```

But the JavaScript code incorrectly had:
```javascript
    "Cave DragonArmed Dragon LV3",  // Matches Python bug: missing comma causes string concatenation
```

### Impact

The `only_dragon` helper did not correctly count items, causing:
- TD21 Victory D. region to not be accessible when it should be
- Test failure at Sphere 2.26

### Fix Applied

Changed line 426 from:
```javascript
    "Cave DragonArmed Dragon LV3",  // Matches Python bug: missing comma causes string concatenation
```
To:
```javascript
    "Cave Dragon",
    "Armed Dragon LV3",
```

Also removed the incorrect comment about a "Python bug" since there was no bug in the Python code.

### Verification

After the fix, all 971 spoiler test events pass successfully.
