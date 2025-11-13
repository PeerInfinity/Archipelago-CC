# Kingdom Hearts 1 - Solved Exporter Issues

This file tracks resolved issues with the Kingdom Hearts 1 exporter (exporter/games/kh1.py).

Last updated: 2025-11-13

## Solved Issues

### Issue #1: Options not exported to settings and not resolved in rules ✅

**Status:** SOLVED
**Priority:** High (was blocking access to End of the World region)
**File:** exporter/games/kh1.py
**Solved Date:** 2025-11-13

**Description:**
The access rule for "End of the World" region contained an attribute reference to `options.keyblades_unlock_chests` that wasn't resolved, causing the error: `Name "options" NOT FOUND in context` in the JavaScript rule evaluator.

**Root Cause:**
1. KH1-specific options were not being exported to the `settings` section of rules.json
2. References to `options.*` in rules were not being resolved to their actual values during export
3. The options cache wasn't populated before region processing

**Solution Implemented:**
1. Added `preprocess_world_data()` method to populate options cache before region processing
2. Added `_resolve_options_in_rule()` method to recursively resolve `options.*` attribute references to constant values
3. Modified `expand_rule()` to call the resolver for all rules
4. Updated `get_settings_data()` to export all KH1 options to the settings section

**Files Modified:**
- exporter/games/kh1.py

**Changes:**
- Added options_cache instance variable
- Implemented preprocess_world_data() to cache all 37 KH1 options early
- Implemented _resolve_options_in_rule() to recursively find and resolve options references
- Updated expand_rule() to resolve options before processing
- Updated get_settings_data() to export cached options

**Result:**
- All 37 KH1 options now exported to settings section
- `options.keyblades_unlock_chests` and other option references resolved to constant values
- "End of the World" region now reachable
- Test progressed from failing at Sphere 10.5 to Sphere 1.4 (different issue)
