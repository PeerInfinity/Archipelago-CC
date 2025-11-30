# Solved SC2 Helper Issues

*Last updated: 2025-11-30*

## Issue 1: terran_respond_to_colony_infestations incorrect logic

**Status:** SOLVED

**Affected Locations:**
- Haven's Fall (Terran): East Colony Base
- Haven's Fall (Terran): Middle Colony Base
- Haven's Fall (Terran): Northeast Colony Base
- Haven's Fall (Terran): Southeast Colony Base
- Haven's Fall (Terran): Southwest Colony Base

**Root Cause:** The JavaScript helper had completely different logic from the Python version - used wrong base requirements and removed the upgrade count check.

**Fix Applied:** Updated to match Python implementation using `terran_havens_fall_requirement` and proper upgrade count checks.

---

## Issue 2: engine_of_destruction_requirement too permissive

**Status:** SOLVED

**Affected Locations:**
- Engine of Destruction (Terran): Victory
- Engine of Destruction (Terran): Loki
- Engine of Destruction (Terran): Various base locations

**Root Cause:** The JavaScript helper was too simple - missing power_rating checks and had incorrect logic.

**Fix Applied:** Updated to match Python implementation with proper power_rating checks (>= 3 base, >= 7 with competent_comp), terran_common_unit check, and correct air unit alternatives.

---

## Issue 3: terran_sustainable_mech_heal missing Field Response Theta

**Status:** SOLVED

**Affected Locations:**
- Various missions requiring mech healing

**Root Cause:** JavaScript helper only checked for 'Medic' but Python also accepts 'Field Response Theta' as an alternative.

**Fix Applied:** Updated to use `has_any(['Medic', 'Field Response Theta'])` with Adaptive Medpacks check.

---

## Issue 4: weapon_armor_upgrade_count returning boolean instead of count

**Status:** SOLVED

**Affected Locations:**
- Maw of the Void (Terran): Victory and all locations
- Any location using weapon_armor_upgrade_count >= N comparisons

**Root Cause:** The helper returned a boolean (`upgradeCount >= 1`) instead of the actual count value, which caused `>= 2` comparisons to fail.

**Fix Applied:** Changed to return the actual count from `count(snapshot, upgradeItem)`.

---

## Summary

All 4 helper issues have been fixed. Seeds 1-10 now pass spoiler tests.
