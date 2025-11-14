# Remaining SC2 Helper Issues

## Summary
Most SC2 helpers are currently stubs. As testing progresses, more helpers will need to be implemented.

## Known Stub Helpers

The following helpers are implemented as stubs (returning `false` or `0`) and may need implementation:

### Terran Helpers
- `terran_defense_rating` - returns 0
- `terran_mobile_detector` - returns false
- `terran_beats_protoss_deathball` - returns false
- `terran_base_trasher` - returns false
- `terran_can_rescue` - returns false
- `terran_cliffjumper` - returns false
- `terran_able_to_snipe_defiler` - returns false
- `terran_respond_to_colony_infestations` - returns false
- `terran_survives_rip_field` - returns false
- `terran_sustainable_mech_heal` - returns false

### Zerg Helpers
- `zerg_basic_anti_air` - returns false
- `zerg_competent_anti_air` - returns false
- `zerg_competent_comp` - returns false
- `zerg_competent_defense` - returns false
- `zerg_pass_vents` - returns false
- `spread_creep` - returns false
- `morph_brood_lord` - returns false
- `morph_impaler_or_lurker` - returns false
- `morph_viper` - returns false

### Kerrigan Helpers
- `basic_kerrigan` - returns false
- `kerrigan_levels` - returns 0
- `two_kerrigan_actives` - returns false

### Nova Helpers
- `nova_any_weapon` - returns false
- `nova_ranged_weapon` - returns false
- `nova_splash` - returns false
- `nova_full_stealth` - returns false
- `nova_dash` - returns false
- `nova_heal` - returns false
- `nova_escape_assist` - returns false

### Mission-Specific Helpers
- `great_train_robbery_train_stopper` - returns false
- `welcome_to_the_jungle_requirement` - returns false
- `night_terrors_requirement` - returns false
- `engine_of_destruction_requirement` - returns false
- `trouble_in_paradise_requirement` - returns false
- `sudden_strike_requirement` - returns false
- `sudden_strike_can_reach_objectives` - returns false
- `enemy_intelligence_first_stage_requirement` - returns false
- `enemy_intelligence_second_stage_requirement` - returns false
- `enemy_intelligence_third_stage_requirement` - returns false
- `enemy_intelligence_cliff_garrison` - returns false
- `enemy_intelligence_garrisonable_unit` - returns false
- `the_escape_first_stage_requirement` - returns false
- `the_escape_requirement` - returns false
- `the_escape_stuff_granted` - returns false
- `dark_skies_requirement` - returns false
- `last_stand_requirement` - returns false
- `end_game_requirement` - returns false
- `enemy_shadow_first_stage` - returns false
- `enemy_shadow_second_stage` - returns false
- `enemy_shadow_victory` - returns false
- `enemy_shadow_door_controls` - returns false
- `enemy_shadow_door_unlocks_tool` - returns false
- `enemy_shadow_tripwires_tool` - returns false
- `enemy_shadow_domination` - returns false
- `salvation_requirement` - returns false
- `steps_of_the_rite_requirement` - returns false
- `templars_return_requirement` - returns false
- `templars_charge_requirement` - returns false
- `the_infinite_cycle_requirement` - returns false
- `harbinger_of_oblivion_requirement` - returns false
- `supreme_requirement` - returns false
- `the_host_requirement` - returns false
- `into_the_void_requirement` - returns false
- `essence_of_eternity_requirement` - returns false
- `amons_fall_requirement` - returns false
- `the_reckoning_requirement` - returns false
- `all_in_requirement` - returns false
- `flashpoint_far_requirement` - returns false

### Other Helpers
- `marine_medic_upgrade` - returns false
- `can_nuke` - returns false
- `lock_any_item` - returns false

## Next Steps

Helpers should be implemented as they're discovered to be needed by failing tests. The Python implementations can be found in `worlds/sc2/Rules.py`.
