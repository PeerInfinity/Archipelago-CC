# Solved Exporter Issues

## Issue 1: RomPatches.has() function calls

**Status:** RESOLVED

**Description:** Access rules contained `RomPatches.has(patch_id)` function calls that the frontend couldn't evaluate.

**Solution:** Added RomPatches resolution to exporter (exporter/games/sm.py:356-381). The exporter now resolves `RomPatches.has()` calls to constant true/false values at generation time, since ROM patches are fixed when the seed is created and don't change during gameplay.

**Files modified:**
- exporter/games/sm.py

## Issue 2: Item type information not exported

**Status:** RESOLVED

**Description:** VARIA items have a `Type` field (e.g., "Morph Ball" has `Type='Morph'`) but this was not being exported to rules.json. This would have caused `haveItem('Morph')` to fail even when the player has "Morph Ball".

**Root cause:** The SM exporter wasn't implementing `get_item_data()` to add VARIA type information. The exporter calls `game_handler.get_item_data(world)` (exporter.py:1229) but the base implementation doesn't know about VARIA types.

**Solution:**
1. Studied ALTTP exporter pattern which implements `get_item_data()`
2. Added `get_item_data()` override in SM exporter (exporter/games/sm.py:68-91)
3. Method loads VARIA item types from `ItemManager.Items` dictionary
4. Maps Archipelago item names to VARIA type names
5. All 33 items now have correct type field exported

**Files modified:**
- exporter/games/sm.py
- exporter/games/generic.py (added hook for custom item types, though not used)

**Verification:** "Morph Ball" now exports with `type: "Morph"` in rules.json

