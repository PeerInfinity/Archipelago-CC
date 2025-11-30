# Yu-Gi-Oh! 2006 - Solved Helper Issues

*Last updated: 2025-11-30*

## Issue 1: `only_dragon` helper had incorrect item name concatenation

**Status:** Solved
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

Changed the concatenated string to two separate items:
```javascript
    "Cave Dragon",
    "Armed Dragon LV3",
```

Also removed the incorrect comment about a "Python bug" since there was no bug in the Python code.

### Verification

After the fix, all spoiler test events pass for seeds 1-10.

---

## Issue 2: Missing `count_has_materials` and `has_all_materials` helpers

**Status:** Solved
**Files:**
- `frontend/modules/shared/gameLogic/yugioh06/yugioh06Logic.js`
- `exporter/games/yugioh06.py`

### Problem

The `count_has_materials` function from `worlds/yugioh06/fusions.py` was not implemented in JavaScript. This function is used to check if the player can create fusion monsters, which is required for rules like:
- LD19 All except E-Hero's forbidden
- LD34 Normal Summons forbidden
- TD44 Extra Deck Monsters

### Fix Applied

1. Added `count_has_materials` to `CUSTOM_HELPERS` in the exporter to preserve it as a helper call
2. Implemented the fusion data structures in JavaScript:
   - `FUSIONS` object containing all Elemental Hero fusion recipes
   - `FUSION_SUBS` list of fusion substitute monsters
3. Implemented helper functions:
   - `has_all_materials(snapshot, staticData, monster)` - recursively checks if player has all materials
   - `count_has_materials(snapshot, staticData, monsters)` - counts how many fusions can be made

### Verification

After the fix, all spoiler test events pass for seeds 1-10.
