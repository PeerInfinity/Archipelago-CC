# Solved Exporter Issues for shapez

This file tracks exporter-related issues that have been resolved.

## Issues

### Issue 1: has_logic_list_building helper being inlined incorrectly ✓ SOLVED

**Status:** Solved
**Severity:** High
**Location:** exporter/games/shapez.py

**Description:**
The `has_logic_list_building` helper function was being analyzed/inlined by the analyzer instead of being exported as a helper call. This resulted in malformed conditional rules with constant comparisons like `"Cutter" == "Cutter"` that always evaluated the same way.

**Impact:**
- Region "Levels with 1 building" was unreachable in the frontend
- Locations Level 4, 5, 6, 7 were inaccessible
- Test failed at Sphere 1.2

**Root cause:**
The analyzer was attempting to inline the `has_logic_list_building` function body because the shapez exporter didn't implement the `should_preserve_as_helper` callback. The analyzer has a mechanism to check if game handlers want to preserve specific functions as helper calls, but the shapez exporter wasn't using it.

**Solution:**
Added `should_preserve_as_helper` method to `ShapezGameExportHandler` in `exporter/games/shapez.py`. This method tells the analyzer to preserve `has_logic_list_building` and all other shapez helper functions as helper calls instead of attempting to inline them.

The method returns `True` for:
- `has_logic_list_building` - the primary fix
- All other shapez helpers: `can_cut_half`, `can_rotate_90`, `can_stack`, `can_paint`, `can_mix_colors`, etc.

**Result:**
- The access rule is now properly exported as a helper call:
  ```json
  {
    "type": "helper",
    "name": "has_logic_list_building",
    "args": [...]
  }
  ```
- All 31 spheres now pass in the spoiler test
- Region "Levels with 1 building" is properly accessible
