# Solved Exporter Issues for Blasphemous

## Issue 1: Boss Strength item check conversion (SOLVED)
**Status:** Solved
**Location:** `exporter/games/blasphemous.py:postprocess_rule()`
**Original Error:** Analyzer was creating `{"type": "item_check", "item": "Boss Strength"}` instead of proper helper calls
**Solution:** Added special handling in `postprocess_rule` to detect "Boss Strength" item checks and convert them to `has_boss_strength` helper calls
**Impact:** Fixed Amanecida boss locations accessibility (GotP, PotSS, WotHP)
**Code Change:** Lines 335-339 in blasphemous.py
