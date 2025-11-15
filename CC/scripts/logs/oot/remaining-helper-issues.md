# OOT Helper Function Issues

## Status
Last updated: 2025-11-15
Test Status: FAILING at Sphere 0 - No regions accessible

## Missing Helper Functions

Based on browser console warnings during test run, these helpers are not implemented:

### Combat & Interaction
- `can_child_attack` - Check if child can attack
- `can_use_projectile` - Check if player can use projectile weapons
- `can_stun_deku` - Check if player can stun Deku Scrubs
- `can_take_damage` - Check if player can take damage

### Fire & Environment
- `has_fire_source` - Check if player has any fire source
- `has_fire_source_with_torch` - Check if player has fire source including torches
- `can_break_upper_beehive` - Check if player can break upper beehives
- `can_break_upper_beehive_child` - Child-specific upper beehive breaking
- `can_break_lower_beehive` - Check if player can break lower beehives

### Logic Tricks (all currently unimplemented, defaulting to false)
- `logic_gerudo_kitchen` - Gerudo Fortress kitchen trick
- `logic_child_dampe_race_poh` - Child Dampe race heart piece trick
- `logic_dmt_bombable` - Death Mountain Trail bombable wall trick
- `logic_goron_city_leftmost` - Goron City leftmost trick
- `logic_zora_river_upper` - Zora's River upper area trick
- `logic_deku_basement_gs` - Deku Tree basement Gold Skulltula trick
- `logic_dc_scarecrow_gs` - Dodongo's Cavern scarecrow Gold Skulltula trick
- `logic_dc_scrub_room` - Dodongo's Cavern scrub room trick
- `logic_jabu_alcove_jump_dive` - Jabu-Jabu's Belly alcove jump/dive trick
- `logic_forest_first_gs` - Forest Temple first Gold Skulltula trick
- `logic_forest_outdoor_east_gs` - Forest Temple outdoor east Gold Skulltula trick
- `logic_fewer_tunic_requirements` - Fewer tunic requirements trick
- `logic_fire_scarecrow` - Fire Temple scarecrow trick
- `logic_ice_block_gs` - Ice Cavern block Gold Skulltula trick
- `logic_water_central_gs_fw` - Water Temple central Gold Skulltula Farore's Wind trick
- `logic_water_central_gs_irons` - Water Temple central Gold Skulltula Iron Boots trick
- `logic_water_falling_platform_gs_hookshot` - Water Temple falling platform hookshot trick
- `logic_water_falling_platform_gs_boomerang` - Water Temple falling platform boomerang trick
- `logic_water_river_gs` - Water Temple river Gold Skulltula trick
- `logic_shadow_umbrella` - Shadow Temple umbrella trick
- `logic_shadow_umbrella_gs` - Shadow Temple umbrella Gold Skulltula trick
- `logic_spirit_map_chest` - Spirit Temple map chest trick
- `logic_spirit_sun_chest` - Spirit Temple sun chest trick

### Dungeon Shortcuts
- `king_dodongo_shortcuts` - King Dodongo's Lair shortcuts enabled
- `spirit_temple_shortcuts` - Spirit Temple shortcuts enabled

### Special Checks
- `can_finish_GerudoFortress` - Check if Gerudo Fortress can be completed

### Functions (not helpers)
- `has_projectile(weapon)` - Function to check projectile weapons
- `at(location, rule)` - Check rule at specific location
- `here(rule)` - Check rule in current context

## Notes

Most of these helpers are logic tricks that default to false for safety. They only matter if the player enables specific trick settings.

The critical missing helpers that affect normal gameplay are:
- `has_fire_source` / `has_fire_source_with_torch`
- `can_child_attack` / `can_use_projectile`
- `can_stun_deku`
- `can_break_*_beehive` functions
