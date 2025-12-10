# Kingdom Hearts - Solved Exporter Issues

This file tracks exporter issues that have been resolved.

## Solved Issues

### 1. Final Ansem access rule - broken has_x_worlds(8)

**Problem:** The "Final Ansem" location had a `{"type": "constant", "value": 0.0}` in its access rule instead of `has_x_worlds(8)`. This caused the location to be inaccessible even when all requirements were met.

**Root Cause:** The analyzer couldn't resolve the `has_x_worlds` function call which contains complex loop logic. The `has_defensive_tools` function (containing `has_all_counts` and `has_any_count`) had resolved args, not empty args, so the existing pattern detection for `has_all_magic_lvx` helper didn't match.

**Solution:** Added pattern detection in `exporter/games/kh1.py` for:
1. `has_all_counts` state_method with resolved defensive tools args (Progressive Cure, Leaf Bracer, Dodge Roll)
2. `has_any_count` state_method with resolved defensive tools args (Second Chance, MP Rage, Progressive Aero)

When both patterns are found in an AND condition, it's converted to `has_defensive_tools` helper, which then allows the Final Ansem pattern detection to identify and fix the broken `has_x_worlds(8)`.

**Files Modified:** `exporter/games/kh1.py`
- Added `_is_defensive_tools_has_all_counts()` helper
- Added `_is_defensive_tools_has_any_count()` helper
- Extended has_defensive_tools pattern detection to handle resolved args

### 2. Obtained All Arts Items access rule - broken has_x_worlds(8)

**Problem:** The "Traverse Town Magician's Study Obtained All Arts Items" location had a `{"type": "constant", "value": 0.0}` in its access rule instead of `has_x_worlds(8)`. This caused the location to be inaccessible even when all requirements were met.

**Root Cause:** The rule contains `has_all_magic_lvx(1)` which exports as `has_all_counts` with resolved magic args (Progressive Fire, Progressive Blizzard, etc.). The existing pattern detection only looked for `has_all_magic_lvx` helper (converted from empty args), not the state_method with resolved args.

**Solution:** Added pattern detection in `exporter/games/kh1.py` for:
1. `has_all_counts` state_method with resolved magic level args (Progressive Fire, Progressive Blizzard, Progressive Thunder, etc.)

When this pattern is found along with `constant 0.0` in an AND condition, the constant is replaced with the appropriate `has_x_worlds(N)` call inferred from the location name.

**Files Modified:** `exporter/games/kh1.py`
- Added `_is_magic_level_has_all_counts()` helper
- Extended has_all_magic_lvx pattern detection to include resolved args
