# KH2 Solved Exporter Issues

This document tracks exporter issues that have been fixed in `exporter/games/kh2.py`.

## Solved Issues

### 1. FinalFormLogic Type Mismatch (2025-12-28)

**Problem:** The `expand_helper` method for `get_form_level_requirement` was comparing `FinalFormLogic` setting against string values like `"no_light_and_darkness"`, `"light_and_darkness"`, and `"just_a_form"`. However, the actual setting was exported as an integer (0, 1, or 2).

**Impact:** This caused the conditional logic to always evaluate incorrectly, making form level locations like "Master level 4" accessible too early (at Sphere 0.2 instead of Sphere 1.10).

**Root Cause:** The exporter's `expand_helper` assumed settings were exported as string keys, but Choice options export their integer values by default.

**Fix:** Changed the comparison values from strings to integers:
- `'no_light_and_darkness'` → `0`
- `'light_and_darkness'` → `1`
- `'just_a_form'` → `2`

**Location:** `exporter/games/kh2.py` lines 371-395

**Test Result:** All 267 spheres pass after fix.
