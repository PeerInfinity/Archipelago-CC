# OOT Solved Helper Function Issues

## Helpers Already Implemented

The following helpers are already implemented in ootLogic.js:

### Age Checks
- `is_adult()` - Returns true if age is 'adult'
- `is_child()` - Returns true if age is 'child'
- `is_starting_age()` - Returns true if age matches starting_age setting

### Time Checks
- `at_night()` - Currently returns true (placeholder)
- `at_day()` - Currently returns true (placeholder)
- `at_dampe()` - Currently returns true (placeholder)
- `at_dampe_time()` - Alias for at_dampe

### Item Checks
- `hasItem(itemName)` - Check if player has item
- `countItem(itemName)` - Get count of specific item
- `hasGroup(groupName)` - Check if player has any item from group
- `has_bottle()` - Check if player has bottle
- `has_bombchus()` - Check if player has bombchus with proper logic
- `has_explosives()` - Check if player has explosives (bombs or bombchus)

### Combat & Interaction
- `can_blast_or_smash()` - Check if player can blast or smash
- `can_break_crate()` - Check if player can break crates
- `can_cut_shrubs()` - Check if player can cut shrubs
- `can_dive()` - Check if player can dive

### Planting & Environment
- `can_plant_bean()` - Check if player can plant beans
- `can_plant_bugs()` - Check if player can plant bugs

### Grottos
- `can_open_bomb_grotto()` - Check if player can open bomb grottos
- `can_open_storm_grotto()` - Check if player can open storm grottos

### Fairies & Summons
- `can_summon_gossip_fairy()` - Check if player can summon gossip fairy
- `can_summon_gossip_fairy_without_suns()` - Same without Sun's Song

### Travel
- `can_ride_epona()` - Check if player can ride Epona

### Progression Gates
- `can_build_rainbow_bridge()` - Check if rainbow bridge can be built (simplified)
- `can_trigger_lacs()` - Check if LACS can be triggered (simplified)

### Settings Checks
- `shuffle_dungeon_entrances()` - Check dungeon entrance shuffle setting
- `entrance_shuffle()` - Check entrance shuffle setting
- `dodongos_cavern_shortcuts()` - Check Dodongo's Cavern shortcuts setting

## Helper Functions
- `parse_oot_rule(snapshot, staticData, ruleString)` - Main DSL parser
- `has(snapshot, staticData, itemName)` - Standard item check
- `count(snapshot, staticData, itemName)` - Standard count check
