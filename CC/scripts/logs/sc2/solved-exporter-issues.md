# Starcraft 2 - Solved Exporter Issues

## Issue 1: Blacklisted helpers being exported as True_ instead of helper calls

**Date Fixed:** 2025-12-23

**Problem:**
Helpers like `terran_competent_comp`, `protoss_competent_comp`, `zerg_competent_comp`, and various mission requirement helpers were in the `HELPERS_TO_EXPORT_BLACKLIST`. When encountered during rule analysis, they were being exported as `True_` (constant true), which made locations accessible too early.

**Root Cause:**
The blacklist was too aggressive. It was intended to prevent complex helpers from being exported to the `helpers` section, but it was also converting inline calls to `True_`, causing incorrect accessibility logic.

**Solution:**
1. Removed `terran_competent_comp`, `protoss_competent_comp`, `zerg_competent_comp` and many mission requirement helpers from the blacklist since they have JavaScript implementations in `helpers.js`
2. Updated the blacklist comment to clarify its purpose

**Files Modified:**
- `exporter/games/sc2.py` - Updated `HELPERS_TO_EXPORT_BLACKLIST`

---

## Issue 2: weapon_armor_upgrade_count exported as True_ in helper bodies

**Date Fixed:** 2025-12-23

**Problem:**
When analyzing helpers like `terran_competent_comp`, calls to `self.weapon_armor_upgrade_count()` were being converted to `true` (constant) instead of helper calls. This caused the exported helper definitions to have incorrect logic.

**Root Cause:**
Two issues:
1. `weapon_armor_upgrade_count` was in `HELPERS_TO_EXPORT_BLACKLIST`, which prevented its definition from being exported (correct behavior)
2. But in `expand_rule()`, when a blacklisted helper was encountered as a helper node, it was being converted to `True_` (incorrect for helpers with JavaScript implementations)

**Solution:**
1. Added `weapon_armor_upgrade_count` to the blacklist to prevent its (broken) Python definition from being exported
2. Added new set `HELPERS_WITH_JS_IMPLEMENTATION` containing helpers that have JavaScript implementations
3. Modified `expand_rule()` to check if a blacklisted helper is in `HELPERS_WITH_JS_IMPLEMENTATION` - if so, keep it as a helper call instead of converting to `True_`
4. The JavaScript implementation in `helpers.js` (`weapon_armor_upgrade_count`) uses `count(snapshot, upgradeItem)` which correctly counts the upgrade items

**Files Modified:**
- `exporter/games/sc2.py` - Added `HELPERS_WITH_JS_IMPLEMENTATION` set and modified `expand_rule()` logic
