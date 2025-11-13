# Solved Exporter Issues for Links Awakening DX

This file tracks exporter issues that have been resolved.

## Issue 1: Preset Directory Name Mismatch (FIXED)

**Date Solved:** 2025-11-13

**Description:**
The exporter was creating files in `frontend/presets/links_awakening_dx/` directory instead of `frontend/presets/ladx/` directory. This caused the test suite to fail with "Rules file not found" errors because it was looking for files in the `ladx` directory.

**Root Cause:**
The `get_world_directory_name()` function in `exporter/exporter.py` couldn't handle cases where the game name was assigned to a constant (e.g., `game = LINKS_AWAKENING`) instead of a string literal (e.g., `game = "Links Awakening DX"`). When it couldn't find a match, it fell back to converting the game name to snake_case, resulting in `links_awakening_dx` instead of the actual world directory name `ladx`.

**Solution:**
Enhanced the `get_world_directory_name()` function to:
1. Detect `game = <CONSTANT_NAME>` pattern
2. Search for the constant definition in the same file
3. Handle wildcard imports like `from .Common import *` to find constants in imported modules
4. Return the correct world directory name `ladx` for "Links Awakening DX"

**Files Modified:**
- `exporter/exporter.py` (lines 189-251): Added logic to handle constant references and wildcard imports

**Verification:**
- Function now returns 'ladx' correctly: `get_world_directory_name('Links Awakening DX')` → `'ladx'`
- Generation output confirms: "Detected single game world (Links Awakening DX), using 'ladx' preset folder."
- Test suite now finds files at expected location

## Issue 2: Missing FLIPPERS Item Name Mapping (FIXED)

**Date Solved:** 2025-11-13

**Description:**
At sphere 4.3 (event 17), two regions were accessible in the Python sphere log but NOT in the JavaScript frontend:
1. "Island Bush of Destiny (Martha's Bay)"
2. "Outside D3 Island Bush (Ukuku Prairie)"

These regions require the "Flippers" item to access, but the exporter was outputting "FLIPPERS" (all caps) in some rules instead of "Flippers" (proper case).

**Root Cause:**
The `_map_ladxr_item_name()` function in `exporter/games/ladx.py` was missing the mapping for the LADXR internal name "FLIPPERS" to the Archipelago item name "Flippers". When the mapping was missing, the exporter used the LADXR name directly, causing a mismatch between the item name in the rules ("FLIPPERS") and the actual item name ("Flippers").

**Solution:**
Added the mapping `'FLIPPERS': 'Flippers'` to the `item_name_mapping` dictionary in the `_map_ladxr_item_name()` method.

**Files Modified:**
- `exporter/games/ladx.py` (line 234): Added FLIPPERS mapping

**Verification:**
- Before fix: 0 instances of "FLIPPERS" in all caps in rules.json
- After fix: 83 instances of "Flippers" in proper case in rules.json
- Test progression: Now passes event 17 (sphere 4.3), previously failed at this event
- New failure point: Event 30 (sphere 4.16) - different issue

