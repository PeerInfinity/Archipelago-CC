# Solved Exporter Issues - Castlevania 64

This document tracks exporter issues that have been solved.

## Solved Issues

### 1. Block pattern from allow_self_locking_items not handled

**Problem:** The `allow_self_locking_items` function from `worlds.generic.Rules` creates complex rules that check if a key item is placed inside a region. This allows the player to enter a region without the key if the key is placed inside (they'll pick it up while exploring).

The Python analyzer converted these rules to complex `block` patterns with `assign`, `function_call`, `conditional`, etc. statements. The JavaScript rule engine couldn't evaluate these complex patterns, causing region accessibility mismatches at Sphere 1.7.

**Symptom:** Test failed with "Regions accessible in LOG but NOT in STATE: Villa: storeroom"

**Solution:**
1. Added `_extract_location_from_block()` method to detect the pattern
2. Modified `expand_rule()` to convert `block` patterns to simple `helper` calls to `location_item_name`
3. Enabled `AUTO_EXPORT_DISCOVERED_HELPERS = True` for simpler configuration
4. Blacklisted `location_item_name` from export (`HELPERS_TO_EXPORT_BLACKLIST = {'location_item_name'}`) because the Python implementation uses `state.multiworld.get_location()` which isn't available in JavaScript. The JavaScript helper in `helpers.js` uses `staticData.locationItems` instead.

**Files changed:**
- `exporter/games/cv64.py` - Added block pattern handling and configuration

**Related:** This pattern is also used by `messenger` and `alttp` games. The fix could eventually be moved to the generic exporter.
