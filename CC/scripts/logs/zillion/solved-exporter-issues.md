# Solved Exporter Issues

## Issue 1: Replaced empirical testing with direct requirement extraction

**Date Solved:** 2025-11-19

**Problem:**
The original Zillion exporter used empirical testing to determine access rules because zilliandomizer's logic was deemed too complex for static analysis. This approach:
- Only tested 1-2 item combinations
- Failed to determine rules for 113 out of 159 locations
- Resulted in `null` access rules that the frontend treated as "always accessible"

**Solution:**
Discovered that zilliandomizer stores exact requirements in the `zz_loc.req` object for each location. Modified the exporter to extract requirements directly from this object instead of empirical testing.

**Changes Made:**
- Rewrote `get_custom_location_access_rule()` to extract from `zz_loc.req`
- Map zilliandomizer requirement fields to Archipelago item names:
  - `gun` → Zillion
  - `jump` → Opa-Opa
  - `floppy` → Floppy Disk
  - `red` → Red ID Card
  - `char` → ignored (starting characters, not requirements)

**Result:**
- All 159 locations now have proper access rules (no more `null` values)
- Warnings reduced from 113 to 0

**Note:**
Still investigating the correct mapping of gun/jump levels to item counts. Initial tests show gun=1 and jump=1 appear to be the starting state.

