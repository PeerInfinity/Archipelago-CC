# Solved Exporter Issues - Kingdom Hearts

## Issue 1: World Map Exit Rules - Broken has_x_worlds Pattern

**Problem**: World Map exit rules had `{"type": "constant", "value": 0.0}` instead of proper `has_x_worlds` helper calls. This made all world regions inaccessible.

**Root Cause**: The Python analyzer couldn't fully evaluate the `has_x_worlds` function and defaulted to outputting a constant 0.0 value.

**Solution**: Extended `_is_broken_has_x_worlds_conditional()` in `exporter/games/kh1.py` to detect `{"type": "constant", "value": 0.0}` as a broken pattern and replace it with proper `has_x_worlds` helper calls.

**Files Modified**: `exporter/games/kh1.py`

---

## Issue 2: has_parasite_cage Rules - Broken worlds Parameter

**Problem**: Locations that use `has_parasite_cage()` (e.g., Geppetto's House) had a broken `worlds` parameter that became `constant 0.0`.

**Pattern Detected**:
```json
{
  "type": "and",
  "conditions": [
    {"type": "constant", "value": 0.0},
    {"type": "or", "conditions": [...]},  // High Jump OR Glide
    {"type": "item_check", "item": "Monstro"}
  ]
}
```

**Solution**: Added pattern detection for `has_parasite_cage` in `_fix_has_all_counts_rule()`. When detecting an AND with constant 0.0 + Monstro item_check + OR condition with High Jump/Glide, replace the constant with `has_x_worlds(3)`.

**Files Modified**: `exporter/games/kh1.py`

---

## Issue 3: has_emblems Rules - Direct and Nested Patterns

**Problem**: Locations requiring `has_emblems` had broken rules. Two patterns:
1. Direct pattern: `AND(constant 0.0, has_all(emblem_pieces))`
2. Complex pattern: `AND(AND(constant 0.0, has_all), constant 0.0, item_check(HB))`

**Solution**: Added multiple pattern detections:
1. Direct has_emblems pattern - replaces with `has_emblems` helper
2. Complex has_emblems pattern with inner AND
3. Simplification for redundant has_emblems rules

**Files Modified**:
- `exporter/games/kh1.py`
- `frontend/modules/shared/gameLogic/kh1/kh1Logic.js` (fixed has_emblems to use 6 worlds instead of 5)

---

## Issue 4: Final Ansem Rule - Broken has_x_worlds(8)

**Problem**: Final Ansem rule had `AND(has_defensive_tools, constant 0.0, OR(...))` where constant 0.0 should be `has_x_worlds(8)`.

**Solution**: Added pattern detection for AND with `has_defensive_tools` helper + constant 0.0 + OR condition, replacing the constant with `has_x_worlds(8)`.

**Files Modified**: `exporter/games/kh1.py`

---

## Issue 5: "Obtained All Arts Items" Rule - Nested Broken has_x_worlds(8)

**Problem**: The rule had a nested AND with `has_all_magic_lvx` + constant 0.0 where constant should be `has_x_worlds(8)`.

**Solution**: Added pattern detection for AND with `has_all_magic_lvx` helper + constant 0.0, replacing the constant with appropriate `has_x_worlds` value based on location name.

**Files Modified**: `exporter/games/kh1.py`

---

## Issue 6: "Wonderland Rabbit Hole Defeat Heartless 3" - All-Falsy OR Pattern

**Problem**: Access rule was an OR with all falsy conditions (constant 0.0 and false) instead of proper `has_x_worlds(6)`.

**Solution**: Added detection for OR rules where all conditions are falsy, replacing with appropriate `has_x_worlds` helper based on `_get_has_x_worlds_requirement()`.

**Files Modified**: `exporter/games/kh1.py`
