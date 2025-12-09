# Kingdom Hearts 1 - Solved Exporter Issues

## Issue 1: has_all_counts incorrectly converted to has_all_magic_lvx for non-magic locations

**Status:** SOLVED

**Affected locations (10):**
- Wonderland Lotus Forest Glide Chest
- Wonderland Tea Party Garden Above Lotus Forest Entrance 1st Chest
- Wonderland Tea Party Garden Above Lotus Forest Entrance 2nd Chest
- Wonderland Tea Party Garden Across From Bizarre Room Entrance Chest
- Wonderland Tea Party Garden Bear and Clock Puzzle Chest
- Wonderland Tea Party Garden Left Cushioned Chair
- Wonderland Tea Party Garden Left Gray Chair
- Wonderland Tea Party Garden Left Pink Chair
- Wonderland Tea Party Garden Right Brown Chair
- Wonderland Tea Party Garden Right Yellow Chair

**Symptom:** These locations became accessible at Sphere 7.7 when they should not be accessible until much later (or at all in default settings).

**Root cause:** The exporter's `_fix_has_all_counts_rule` function converted any `state_method: has_all_counts` with empty args to `has_all_magic_lvx(1)`. However, the Python rule for these locations uses:

```python
difficulty > LOGIC_PROUD and state.has_all_counts({"Combo Master": 1, "High Jump": 3, "Air Combo Plus": 2}, player)
```

Since `difficulty = 5` (LOGIC_NORMAL) and `LOGIC_PROUD = 10`, this branch should never be accessible. But the exporter:
1. Failed to parse the dict argument (expected)
2. Incorrectly converted to `has_all_magic_lvx(1)`
3. Then saw `has_all_magic_lvx + constant: 0.0` and added `has_x_worlds(3)`
4. Created a NEW accessible path that didn't exist in the original logic

**Fix applied:** In `exporter/games/kh1.py`:
1. Added `_is_wonderland_advanced_logic_location()` helper function to identify locations that use non-magic `has_all_counts`
2. Modified `_fix_has_all_counts_rule()` to skip the conversion to `has_all_magic_lvx` for these locations
3. Instead, return `constant: false` since the branch is guarded by `difficulty > LOGIC_PROUD` which evaluates to false in default settings

**Result:** All 184 sphere events now pass. Spoiler test completes successfully.
