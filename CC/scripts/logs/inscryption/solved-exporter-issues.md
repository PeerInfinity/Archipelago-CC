# Solved Exporter Issues

## Issue 1: Pseudo-items created for helper functions (SOLVED)

**Location:** Sphere 2.1
**Affected Locations:**
- Act 2 - Battle Dredger
- Act 2 - Battle Inspector
- Act 2 - Battle Melter
- Act 2 - Boss P03
- Act 2 - Factory Chest 1
- Act 2 - Factory Chest 2
- Act 2 - Factory Chest 3
- Act 2 - Factory Chest 4
- Act 2 - Factory Drawer 1
- Act 2 - Factory Drawer 2
- Act 2 - Factory Trash Can
- Act 2 - Monocle
- Act 2 - Tower Chest 1

**Problem:**
The exporter was creating item_check rules for pseudo-items "Camera_And_Meat" and "All_Epitaph_Pieces" instead of properly exporting the helper functions or expanding them to their actual item requirements.

**Root cause:**
The generic exporter's `_expand_common_helper` method was creating pseudo-item names from method names like `has_camera_and_meat` and `has_all_epitaph_pieces` without properly expanding them to their actual implementation.

**Solution:**
Overrode the `_expand_common_helper` method in the Inscryption exporter to properly expand all Inscryption-specific helper functions to their actual item requirements:

- `has_camera_and_meat` → AND check for "Camera Replica" and "Pile Of Meat"
- `has_all_epitaph_pieces` → Item check for "Epitaph Piece" with count 9
- `has_act2_bridge_requirements` → OR of (camera+meat) or (all epitaph pieces)
- `has_tower_requirements` → Monocle AND (camera+meat OR all epitaph pieces)
- `has_act2_requirements` → Film Roll
- `has_act3_requirements` → Film Roll, Camera Replica, Pile Of Meat, Monocle, and all epitaph pieces
- `has_gems_and_battery` → Gems Module AND Inspectometer Battery
- `has_transcendence_requirements` → Quill, Gems Module, and Inspectometer Battery
- `has_monocle` → Monocle
- `has_inspectometer_battery` → Inspectometer Battery

**Result:**
All access rules are now properly expanded to check for actual items. Spoiler test passes with seed 1.

**File modified:**
`exporter/games/inscryption.py`

