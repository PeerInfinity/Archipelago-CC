# Secret of Evermore - Solved Exporter Issues

## Issue 1: Duplicate provides data for items

**Status:** Solved

**Description:**
The exporter was adding provides data multiple times for items that appeared multiple times in the combined item lists (get_items(), get_extra_items(), get_sniff_items()). For example, Diamond Eye appeared 3 times in all_items, so its provides data was added 3 times, making it provide 3x P_12 instead of 1x P_12.

**Symptoms:**
- Diamond Eye had 3 separate provides entries in the JSON, each with count=1 for progress_id=12
- This caused locations requiring P_12 to be accessible too early
- Pyramid locations were accessible in Sphere 1.1 instead of Sphere 1.2

**Root Cause:**
In `exporter/games/soe.py`, the `get_item_data` method was appending provides data for every occurrence of an item in all_items, not just the first occurrence.

**Fix:**
Moved the provides data code inside the `if item.name not in item_data:` block so that provides data is only added once per unique item name.

**File:** `exporter/games/soe.py:133-150`

## Issue 2: "Analysis finished without errors but produced no result (None)" warnings

**Status:** Not Actually an Issue

**Description:**
During generation, many locations produced warnings like "Analysis finished without errors but produced no result (None)".

**Explanation:**
This is expected behavior for SOE. SOE locations don't have Python lambda rules - they use the pyevermizer C++ library for logic instead. The analyzer tries to analyze Python rules first, finds none, and logs a warning. Then the `get_location_attributes` method adds the evermizer-based rules to the location data. The warnings are harmless noise and can be ignored.

**Note:**
The actual access rules are correctly added by `get_location_attributes` after the analysis step, so the final JSON has correct access rules.

---
