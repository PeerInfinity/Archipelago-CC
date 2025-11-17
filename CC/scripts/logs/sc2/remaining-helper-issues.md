# SC2 Remaining Helper Issues

## Summary
This document tracks remaining issues with the Starcraft 2 helper functions (`frontend/modules/shared/gameLogic/sc2/helpers.js`).

Last updated: 2025-11-17

Test currently progressing to sphere 15.10+. Additional helper stubs remain that will need implementation as testing continues.

## Status

**Fixed Issues:** 5 helpers implemented (see solved-helper-issues.md)
**Test Progress:** Sphere 14.27 → 15.10 (significant improvement)
**Exporter Issues Fixed:** 1 major fix (helper method attribute access)

## Known Remaining Stubs

The following helper functions are still stubbed and may need implementation as testing progresses:

### Mission Requirements
- welcome_to_the_jungle_requirement
- night_terrors_requirement
- engine_of_destruction_requirement
- trouble_in_paradise_requirement
- sudden_strike_requirement
- sudden_strike_can_reach_objectives
- enemy_intelligence_first_stage_requirement
- enemy_intelligence_second_stage_requirement
- enemy_intelligence_third_stage_requirement
- enemy_intelligence_cliff_garrison
- enemy_intelligence_garrisonable_unit
- the_escape_requirement
- the_escape_stuff_granted
- dark_skies_requirement
- enemy_shadow_first_stage
- enemy_shadow_second_stage
- enemy_shadow_victory
- enemy_shadow_door_controls
- enemy_shadow_door_unlocks_tool
- enemy_shadow_tripwires_tool
- enemy_shadow_domination
- salvation_requirement
- templars_charge_requirement (IMPLEMENTED)
- end_game_requirement
- supreme_requirement
- the_host_requirement
- into_the_void_requirement
- essence_of_eternity_requirement
- amons_fall_requirement
- the_reckoning_requirement
- all_in_requirement
- flashpoint_far_requirement

### Terran Helpers
- terran_mobile_detector
- terran_beats_protoss_deathball
- terran_base_trasher
- terran_can_rescue
- terran_cliffjumper
- terran_able_to_snipe_defiler
- terran_survives_rip_field
- terran_sustainable_mech_heal

### Protoss Helpers
(All major ones implemented)

### Zerg Helpers
- zerg_competent_defense

### Nova Helpers
- nova_any_weapon
- nova_ranged_weapon
- nova_splash
- nova_full_stealth
- nova_dash
- nova_heal
- nova_escape_assist

### Other Helpers
- can_nuke
- lock_any_item (may not be needed)
