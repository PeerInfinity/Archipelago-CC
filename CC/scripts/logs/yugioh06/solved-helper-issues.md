# Yu-Gi-Oh! 2006 - Solved Helper Issues

This document tracks resolved issues in the helper functions for Yu-Gi-Oh! 2006.

## Issues

### 1. `only_dragon` helper had incorrect item list (SOLVED)

**Problem:** The JavaScript `only_dragon` helper function had a different item list than the Python version, causing the "TD21 Victory D." region to be incorrectly accessible at Sphere 2.32.

**Root Cause:** The Python code in `worlds/yugioh06/rules.py` has a bug where a missing comma between "Cave Dragon" and "Armed Dragon LV3" causes Python string literal concatenation:

```python
# Python code (bug):
state.count_from_list_unique([
    "Luster Dragon",
    "Spear Dragon",
    "Cave Dragon"          # Missing comma here!
    "Armed Dragon LV3",    # This becomes "Cave DragonArmed Dragon LV3"
    ...
], player)
```

This results in 9 items in the list instead of 10, making the check stricter than intended.

**Solution:** Updated the JavaScript helper to match the Python behavior by using the concatenated string "Cave DragonArmed Dragon LV3" instead of two separate items.

**File Modified:** `frontend/modules/shared/gameLogic/yugioh06/yugioh06Logic.js`

**Commit:** (included in current session)

**Note:** This is a workaround to match Python's buggy behavior. The proper fix would be in the upstream Archipelago world code (`worlds/yugioh06/rules.py`), but we need to match it for test parity.
