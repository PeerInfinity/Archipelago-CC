# Remaining Exporter Issues for Blasphemous

## Issue 1: Item data export error
**Status:** Not started
**Location:** `exporter/games/blasphemous.py:get_item_data()`
**Error:** `'list' object has no attribute 'items'`
**Description:** The exporter is trying to call `.items()` on a list when it expects a dictionary. This is in the `get_item_data` method.
**Impact:** Error message appears during generation, but doesn't prevent rule generation
**Priority:** Low (doesn't break generation)
