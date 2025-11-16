# Solved Exporter Issues

## Issue 1: Villa: storeroom not accessible (Sphere 1.7) - SOLVED

**Test failure:**
- Locations accessible in LOG but NOT in STATE: Villa: Storeroom - Left, Villa: Storeroom - Right, Villa: Storeroom statue
- Region "Villa: storeroom" is not reachable

**Root cause:**
The entrance rule to Villa: storeroom uses `allow_self_locking_items` logic which checks if the Storeroom Key is placed at one of the locations inside the storeroom. The exported rule tried to access `.item` attribute on a location name string, and the helper was using object property access instead of Map methods.

**Fix applied:**
1. Updated `exporter/games/cv64.py`:
   - Added detection for attribute access on location name constants in `expand_rule()`
   - Converts `location.item` to `location_item_name(location)` helper call
   - Added simplification logic to convert conditionals checking `location_item_name(...) is null` to just use the helper directly
   - Added recursive processing for all rule types (conditional, compare, attribute, list)

2. Updated `frontend/modules/shared/gameLogic/cv64/helpers.js`:
   - Fixed `location_item_name` helper to use Map methods (`.has()`, `.get()`) instead of object property access
   - `locationItems` is a Map, not a plain object

**Result:**
Test now passes. The storeroom is accessible when the Storeroom Key is placed in one of the storeroom locations.

