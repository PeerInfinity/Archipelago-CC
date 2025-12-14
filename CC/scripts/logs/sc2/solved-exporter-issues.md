# Starcraft 2 - Solved Exporter Issues

This document tracks exporter issues that have been resolved.

## Solved Issues

### 1. `weapon_armor_upgrade_count` helper export - FIXED 2025-12-14

**Problem:** The `weapon_armor_upgrade_count` helper was being automatically exported with its full Python implementation which contained references to `item_groups` module. The frontend rule engine could not resolve this reference, causing "Could not resolve name: item_groups" errors and "Access rule evaluation failed" during spoiler tests at Sphere 17.3 (Maw of the Void mission).

**Affected locations:** All locations in "Maw of the Void (Terran)" region that used `terran_maw_requirement` helper.

**Root cause:** The auto-export system was including the full Python function body for `weapon_armor_upgrade_count`, which referenced `item_groups.protoss_generic_upgrades`. This is a Python module import that doesn't exist in the JavaScript frontend.

**Solution:** Added `weapon_armor_upgrade_count` to `HELPERS_TO_EXPORT_BLACKLIST` in `exporter/games/sc2.py`. This forces the frontend to use the JavaScript fallback implementation in `frontend/modules/shared/gameLogic/sc2/helpers.js`.

**File changed:** `exporter/games/sc2.py` (line 48-49)

### 2. `is_item_placement` helper export - FIXED 2025-12-14

**Problem:** The `is_item_placement` helper was being exported but is a state check method that determines if the logic is being evaluated during item placement. This concept doesn't translate to the frontend.

**Solution:** Added `is_item_placement` to `HELPERS_TO_EXPORT_BLACKLIST` in `exporter/games/sc2.py`.

**File changed:** `exporter/games/sc2.py` (line 50-51)

---

Last updated: 2025-12-14
