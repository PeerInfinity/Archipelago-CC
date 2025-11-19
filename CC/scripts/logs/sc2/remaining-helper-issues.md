# SC2 Remaining Helper Issues

## Status: Active - In Progress

Current test status: **Sphere 22.3** (started at 18.23)

## Issue 1: Enemy Shadow Mission Helpers - NOT IMPLEMENTED

### Symptom
- **Test failure at:** Sphere 22.3
- **Locations affected:** All "In the Enemy's Shadow" mission locations
- **Status:** Helpers are stubs returning `false`

### Helpers Needed
- `enemy_shadow_first_stage`
- `enemy_shadow_second_stage`
- `enemy_shadow_victory`
- `enemy_shadow_door_controls`
- `enemy_shadow_door_unlocks_tool`
- `enemy_shadow_tripwires_tool`
- `enemy_shadow_domination`

### Next Steps
1. Implement each helper based on Python `worlds/sc2/Rules.py`
2. Test progression through Enemy Shadow mission
3. Continue to next failing mission

---

## Other Stub Helpers (Not Yet Blocking Tests)

The following helpers are still stubs and may need implementation later:
- `dark_skies_requirement`
- `last_stand_requirement` (implemented in JS but may need verification)
- `end_game_requirement`
- `supreme_requirement`
- `into_the_void_requirement`
- `essence_of_eternity_requirement`
- `amons_fall_requirement`
- `the_reckoning_requirement`

---
Last updated: 2025-11-19
Test progress: Sphere 18.23 → 22.3 (7 issues fixed)
