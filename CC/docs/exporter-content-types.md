# Exporter Content Types Index

This document categorizes the different types of content that appear in custom game exporters, organized by content type. The goal is to identify content that could potentially be factored out into the base exporter, generic exporter, or shared utilities.

## Processing Status

### Processed Exporters (60)
- ahit.py
- alttp.py
- aquaria.py
- blasphemous.py
- bomb_rush_cyberfunk.py
- celeste64.py
- celeste_open_world.py
- civ_6.py
- cvcotm.py
- dark_souls_3.py
- dlcquest.py
- factorio.py
- ffmq.py
- hk.py
- inscryption.py
- jakanddaxter.py
- kdl3.py
- kh1.py
- kh2.py
- ladx.py
- landstalker.py
- lingo.py
- marioland2.py
- messenger.py
- mlss.py
- mm2.py
- mmbn3.py
- musedash.py
- oot.py
- osrs.py
- overcooked2.py
- paint.py
- pokemon_emerald.py
- pokemon_rb.py
- raft.py
- saving_princess.py
- sc2.py
- sm.py
- sm64ex.py
- smz3.py
- soe.py
- stardew_valley.py
- subnautica.py
- terraria.py
- timespinner.py
- tloz.py
- tunic.py
- tww.py
- v6.py
- wargroove.py
- witness.py
- yachtdice.py
- yoshisisland.py
- yugioh06.py
- zillion.py

### Utility Files (not game exporters)
- base.py (BaseGameExportHandler)
- generic.py (GenericGameExportHandler)
- sm_accessfrom_extractor.py
- sm_traverse_extractor.py
- __init__.py

---

## Content Types

### 1. Class Configuration Attributes

Boolean/string/list attributes set at class level that control exporter behavior.

#### AUTO_EXPORT_DISCOVERED_HELPERS
Controls whether helpers discovered during rule analysis are automatically exported.
- **Default**: True (in GenericGameExportHandler)
- **Exporters setting to False**:
  - inscryption.py: Class methods can't be auto-exported
  - pokemon_emerald.py: Uses manual HM helper conversion
  - yugioh06.py: Helpers implemented in JavaScript

#### AUTO_PRESERVE_LARGE_HELPERS
Controls automatic preservation of large helper functions.
- **Default**: True (in GenericGameExportHandler)
- **Exporters setting to False**:
  - ahit.py
  - civ_6.py
  - cvcotm.py
  - dark_souls_3.py
  - ffmq.py
  - jakanddaxter.py
  - kdl3.py
  - kh1.py
  - landstalker.py
  - marioland2.py
  - messenger.py
  - mlss.py
  - mm2.py
  - mmbn3.py
  - pokemon_emerald.py
  - tloz.py
  - yugioh06.py

#### HELPER_MODULES
List of module paths containing helper functions to search.
- **Default**: [] (in BaseGameExportHandler)
- **Exporters using**:
  - ahit.py: `['worlds.ahit.Rules']`
  - kdl3.py: `['worlds.kdl3.rules']`
  - kh1.py: `['worlds.kh1.Rules']`
  - kh2.py: `['worlds.kh2.Rules']`
  - lingo.py: `['worlds.lingo.rules']`
  - mlss.py: `['worlds.mlss.StateLogic']`
  - raft.py: `['worlds.raft.Rules']`

#### HELPERS_TO_PRESERVE
Set of helper names that should be preserved as callable functions (not inlined).
- **Default**: set() (in BaseGameExportHandler)
- **Exporters using**:
  - ahit.py: `{'can_clear_required_act', 'can_use_hat', 'get_hat_cost', 'has_relic_combo'}`
  - kdl3.py: `{'can_assemble_rob', 'can_fix_angel_wings'}`
  - kh1.py: `{'has_x_worlds'}`
  - marioland2.py: `set()` (empty - all helpers exported to rules.json)
  - yugioh06.py: `{'yugioh06_difficulty', 'only_light', 'only_dark', ...}` (26 deck-building helpers)

#### HELPERS_TO_EXPORT_BLACKLIST
Set of helper names that should NOT be exported (too complex for frontend).
- **Default**: set() (in BaseGameExportHandler)
- **Exporters using**:
  - bomb_rush_cyberfunk.py: `{'graffiti_spots', 'build_access_cache', ...}` (uses globals/loops)
  - kdl3.py: `{'can_assemble_rob', 'can_fix_angel_wings'}` (dynamic function dispatch)
  - kh1.py: `{'has_emblems', 'has_defensive_tools', ...}` (loops, complex logic)
  - kh2.py: `['kh2_can_reach', 'kh2_list_any_sum', ...]` (extensive list)
  - lingo.py: `['_lingo_can_do_late_blue_sun', ...]`

#### ITEM_NAME_MODULES
List of module paths containing item name definitions.
- **Default**: [] (in BaseGameExportHandler)
- **Exporters using**:
  - kh2.py: `['worlds.kh2.Items']`

#### COMPUTED_SETTINGS
Dict mapping setting names to computation functions.
- **Default**: {} (in BaseGameExportHandler)
- **Exporters using**: (none found in processed exporters)

#### USE_RESOLVED_ITEMS
Whether to use resolved item names (True) or original item names (False).
- **Default**: False (in BaseGameExportHandler)
- **Exporters setting to True**:
  - dlcquest.py
  - factorio.py
  - jakanddaxter.py
  - ladx.py
  - landstalker.py
  - raft.py

#### ADD_SPHERE_ITEMS_UPFRONT
Whether to add sphere items at start vs incrementally.
- **Default**: False (in GenericGameExportHandler)
- **Exporters setting to True**:
  - dlcquest.py: Needed for coin-based access rules
  - jakanddaxter.py: Needed for orb tracking
  - raft.py: Needed for resolved progressive items
  - witness.py: Needed for laser activation checks

#### USE_AUTO_INDIRECT_CONDITIONS
Whether to automatically detect indirect conditions in rules.
- **Default**: False (in GenericGameExportHandler)
- **Exporters setting to True**:
  - lingo.py

#### SELF_ATTR_TO_SETTING
Dict mapping self.attr_name to settings names for rule analysis.
- **Default**: {} (in BaseGameExportHandler)
- **Exporters using**:
  - kh2.py: `{'fight_logic': 'FightDifficulty', ...}`

#### NAME_REMAPPING
Dict mapping parameter names to actual setting names.
- **Default**: Not defined in base
- **Exporters using**:
  - kdl3.py: `{'ow_boss_req': 'ow_boss_requirement'}`

#### SETTINGS_TO_CONVERT
Set of setting names that should be converted from 'name' type to 'setting_value' type.
- **Default**: Not defined in base
- **Exporters using**:
  - kdl3.py: `{'open_world', 'ow_boss_requirement'}`

#### HELPER_PARAM_MAPPINGS
Dict mapping helper parameter names to slot_data keys.
- **Default**: Not defined in base
- **Exporters using**:
  - mm2.py: `{'can_defeat_enough_rbms': {'required': 'wily_5_requirement', ...}}`

#### HAS_RULE_HELPER_THRESHOLD
Threshold for preserving Has rules as helpers (custom Stardew Valley attribute).
- **Default**: Not defined in base
- **Exporters using**:
  - stardew_valley.py: `HAS_RULE_HELPER_THRESHOLD = 1`

#### ITEM_CHECK_RULES
Static dict mapping item names to their access rule structures.
- **Default**: Not defined in base
- **Exporters using**:
  - raft.py: Maps 40+ items (Plank, MetalIngot, etc.) to helper-based rules

#### LASER_ACTIVATION_TO_REGION
Dict mapping laser activation keys to region names.
- **Default**: Not defined in base
- **Exporters using**:
  - witness.py: Maps laser IDs to regions for activation detection

#### HM_TO_HELPER
Dict mapping HM item names to helper function names.
- **Default**: Not defined in base
- **Exporters using**:
  - pokemon_emerald.py: Maps HM01-HM08 to can_cut, can_surf, etc.

---

### 2. Rule Processing Methods

Methods that transform or analyze access rules during export.

#### expand_rule(rule, _depth)
Transform rule structures, often to inline or simplify complex patterns.
- **Base implementation**: Returns rule unchanged
- **Exporters overriding**:
  - ahit.py: Resolves can_clear_required_act to can_reach + location_rule_ref
  - celeste64.py: Inlines location_rule, region_connection_rule, goal_rule from logic mappings
  - cvcotm.py: Converts self.method_name function calls to helper nodes
  - factorio.py: Simplifies `technology.name` attribute access
  - ffmq.py: Binary op string concatenation, item_groups subscript resolution
  - inscryption.py: Expands pseudo-items (Camera_And_Meat, All_Epitaph_Pieces, etc.)
  - jakanddaxter.py: Handles can_reach_orbs_level, can_reach_orbs_global, world.can_trade, capability rules
  - kdl3.py: Name remapping, f_string conversion, setting_value conversion
  - kh1.py: Options resolution, self.method conversion, has_all_counts fixes
  - landstalker.py: has_all with set() simplification, all_of iterator resolution
  - marioland2.py: Options resolution, self.options.* pattern handling
  - messenger.py: Handles `inferred_*` item patterns and `items_helper.CAN_*` capabilities
  - pokemon_emerald.py: Converts hm_rules["HM_NAME"]() to helper calls
  - pokemon_rb.py: Validates helper names against known_helpers set
  - subnautica.py: Handles `location.can_reach()` patterns for Aurora Drive Room
  - tloz.py: f_string resolution, can_reach pattern handling for Boss Status

#### expand_helper(helper_def, helper_name)
Transform helper function definitions.
- **Base implementation**: Returns helper unchanged
- **Exporters overriding**:
  - cvcotm.py: Returns None (preserves helper nodes)
  - kh1.py: Maps of KH1 helpers to simplified rules
  - kh2.py: Complex expansion for form abilities, party requirements, visit locks
  - subnautica.py: Expands SwimRule property accesses (base_depth, consider_items)
  - zillion.py: Returns None (Zillion doesn't use helper functions)

#### postprocess_rule(rule)
Post-process rules after initial analysis.
- **Base implementation**: Returns rule unchanged
- **Exporters overriding**:
  - dark_souls_3.py: Transforms _can_get/_can_go_to to location_check/can_reach
  - smz3.py: Handles items.AttributeName, self.AttributeName, SMLogic, RewardType, ItemType, CanBeatBoss, CanAcquire, regressive accessibility simplification
  - witness.py: Complex post-processing with laser activation handling, pattern detection/simplification

#### postprocess_entrance_rule(rule, entrance_name)
Post-process entrance/exit rules specifically.
- **Base implementation**: Returns rule unchanged
- **Exporters overriding**:
  - dark_souls_3.py: Delegates to postprocess_rule
  - ladx.py: Handles isinstance pattern for LADXR conditions

#### handle_special_function_call(function_name, args, func)
Handle game-specific function call patterns.
- **Base implementation**: Returns None (no handling)
- **Exporters overriding**:
  - alttp.py: Handles `has_triforce_pieces`, `has_crystals`, `has_medallions`, etc.
  - celeste64.py: Handles location_rule, region_connection_rule, goal_rule

#### handle_complex_exit_rule(exit_name, access_rule_method)
Handle complex exit/entrance rule extraction.
- **Base implementation**: Returns None
- **Exporters overriding**:
  - ladx.py: Extracts LADXR condition objects from entrance.condition attribute
  - witness.py: Extracts complex exit rules with pattern detection

#### override_rule_analysis(rule_func, rule_target_name)
Completely override rule analysis for specific patterns.
- **Base implementation**: Returns None
- **Exporters overriding**:
  - celeste_open_world.py: Examines closure variables for data-driven patterns (connection.possible_access, only_access, only_item)
  - pokemon_rb.py: Handles complex string manipulation patterns (split/slice)
  - raft.py: Resolves regionChecks pattern to region-specific access rules
  - smz3.py: Handles SMZ3 loc.Available() and entrance rules via TotalSMZ3 extraction
  - stardew_valley.py: Detects and serializes StardewRule objects

#### should_preserve_as_helper(helper_name, helper_def, size)
Decide if a helper should be preserved as a callable.
- **Base implementation**: Size-based decision
- **Exporters overriding**:
  - lingo.py: Preserves specific helpers like `_lingo_can_do_panel_hunt`

---

### 3. Data Export Methods

Methods that export game-specific data structures.

#### get_item_data(world)
Export item classification and properties.
- **Base implementation**: Exports progression/useful/trap classification
- **Exporters overriding**:
  - ahit.py: Custom item_table import and classification mapping
  - alttp.py: Adds dungeon items, crystals, keys with special handling
  - dlcquest.py: Custom handling for coin items and events
  - jakanddaxter.py: Adds pseudo-items for orb tracking
  - kh1.py: item_name_to_id with classification, event item scanning
  - marioland2.py: Event item scanning for vanilla golden coins
  - pokemon_emerald.py: Handles event item conversion at runtime
  - pokemon_rb.py: Handles event items from runtime placement
  - smz3.py: Marks card items and progressive items as advancement
  - stardew_valley.py: Adds virtual event items (Received Progression Percent)

#### get_item_max_counts(world)
Export maximum counts for progressive/stackable items.
- **Base implementation**: Returns empty dict
- **Exporters overriding**:
  - alttp.py: Progressive items, dungeon keys, bottle counts

#### get_progression_mapping(world)
Map item names to their progression identifiers.
- **Base implementation**: Returns empty dict
- **Exporters overriding**:
  - bomb_rush_cyberfunk.py: Additive mapping for REP items (8 REP = 8, etc.)
  - messenger.py: Maps Time Shard variants to 'Time Shard'
  - raft.py: Progressive item mapping from progressives.json
  - smz3.py: Progressive item mappings for ALTTP content

#### get_itempool_counts(world)
Export counts of items in the item pool.
- **Base implementation**: Standard counting
- **Exporters overriding**: (none found in processed exporters)

#### get_settings_data(world, multiworld, player)
Export game settings and options.
- **Base implementation**: Exports option values
- **Exporters overriding**:
  - ahit.py: Game-specific settings (HatItems, UmbrellaLogic, etc.)
  - alttp.py: Complex settings with dungeon info, medallion requirements
  - civ_6.py: Era requirements data
  - cvcotm.py: Game-specific options (nerf_roc_wing, etc.)
  - kdl3.py: copy_abilities dictionary, ability_map
  - kh1.py: Extensive KH1 options cache
  - lingo.py: Door shuffle data, mastery requirements, panel data
  - marioland2.py: required_golden_coins, auto_scroll_levels, sprite_data
  - pokemon_emerald.py: Includes hm_requirements
  - pokemon_rb.py: Extensive option list, use_multipass_timer
  - smz3.py: allow_regressive_accessibility_mismatches, count_non_advancement_items, reward_regions

#### get_game_info(world)
Export general game information.
- **Base implementation**: Returns basic game info
- **Exporters overriding**:
  - ahit.py: chapter_costs, hat_info, relic_groups
  - dlcquest.py: accumulator_rules, prog_items_init for coins
  - factorio.py: `required_technologies` list
  - jakanddaxter.py: accumulator_rules for Tradeable Orbs, prog_items_init
  - ladx.py: `accumulator_rules` for RUPEES and `prog_items_init`
  - lingo.py: panels_by_color, sunwarp configuration
  - pokemon_emerald.py: Exports hm_requirements
  - pokemon_rb.py: extra_badges, local_poke_data, poke_data
  - stardew_valley.py: total_progression_items

#### get_helper_definitions(world)
Export helper function definitions.
- **Base implementation**: Discovers and exports helpers
- **Exporters overriding**:
  - cvcotm.py: Manually builds helper rule definitions based on settings
  - mmbn3.py: Manually exports explore_score helper as conditional rule structure
  - stardew_valley.py: Exports Has rules as helper definitions
  - subnautica.py: Applies SwimRule expansion to all helpers

---

### 4. Region/Location Attribute Methods

Methods that add custom attributes to regions and locations.

#### get_region_attributes(region)
Add custom attributes to region data.
- **Base implementation**: Returns empty dict
- **Exporters overriding**:
  - alttp.py: Adds hint_text, is_light_world, is_dark_world, dungeon info
  - aquaria.py: Adds dynamically_added for post-sphere-calc regions
  - jakanddaxter.py: Adds orb_count

#### get_location_attributes(location)
Add custom attributes to location data.
- **Base implementation**: Returns empty dict
- **Exporters overriding**:
  - alttp.py: Adds dungeon, item_rule, always_allow, hint info
  - lingo.py: Adds AccessRequirements (doors_to_open, colors_required, etc.)

#### get_custom_location_access_rule(location, world)
Override the standard access rule for specific locations.
- **Base implementation**: Returns None
- **Exporters overriding**:
  - lingo.py: Returns rule based on location's AccessRequirements
  - zillion.py: Reads requirements from zilliandomizer location objects (gun, jump, floppy, red, char)

---

### 5. Pre/Post Processing Hooks

Methods called before or after main export phases.

#### preprocess_world_data(world, export_data, player)
Called before main export processing.
- **Base implementation**: Does nothing
- **Exporters overriding**:
  - celeste64.py: Loads logic mappings before rule processing
  - civ_6.py: Captures era requirements data
  - inscryption.py: Stores world data for rule expansion
  - kh1.py: Populates options cache

#### post_process_data(data)
Called after all data export, before serialization.
- **Base implementation**: Returns data unchanged
- **Exporters overriding**:
  - civ_6.py: Fixes era subscript patterns in rules
  - cvcotm.py: Fixes region data structure
  - dlcquest.py: Adds coin items to items dictionary
  - kdl3.py: Resolves f-strings in rules
  - kh1.py: Fixes has_all_counts, has_x_worlds, and other broken patterns

#### post_process_location_data(location_data, location)
Post-process individual location data.
- **Base implementation**: Returns data unchanged
- **Exporters overriding**:
  - smz3.py: Fixes advancement flags

#### postprocess_regions(multiworld, player)
Fix or add missing regions.
- **Base implementation**: Does nothing
- **Exporters overriding**:
  - aquaria.py: Adds missing regions not in multiworld.regions
  - cvcotm.py: Adds Menu region if it doesn't exist

---

### 6. Context Tracking

Methods for tracking context during rule analysis.

#### set_context(location_name)
Set the current location context for rule expansion.
- **Base implementation**: Does nothing
- **Exporters overriding**:
  - tloz.py: Tracks current location for Boss Status rule resolution
  - witness.py: Stores current location name for pattern detection

#### set_exit_context(exit_name)
Set context for exit/entrance analysis.
- **Base implementation**: Does nothing
- **Exporters overriding**: (none found in processed exporters)

#### set_location_context(location_name)
Set context for location analysis.
- **Base implementation**: Does nothing
- **Exporters overriding**: (none found in processed exporters)

---

### 7. External Data Loading

Patterns for loading external rule/data files.

#### DSL Parsing
Loading rules from domain-specific language files.
- **Exporters using**:
  - sm.py: Loads from `VariaRandomizer` DSL files, parses complex access rules

#### Logic Mapping Loading
Loading rule mappings from Python data structures.
- **Exporters using**:
  - celeste64.py: Rules.location_standard_moves_logic, Rules.region_standard_moves_logic
  - kdl3.py: location_name.level_names_inverse

#### JSON Data Loading
Loading rules or data from JSON files.
- **Exporters using**:
  - raft.py: Loads locations.json and progressives.json for region/item mappings

#### build_rule_string_map(world)
Build mapping of rule strings to parsed rules.
- **Exporters using**:
  - sm.py: Maps location/area names to parsed access rules

---

### 8. Item Name Mapping

Patterns for mapping internal item names to export names.

#### Direct Mapping Dicts
Hardcoded mappings from internal to export names.
- **Exporters using**:
  - jakanddaxter.py: `item_id_to_name` mapping in __init__
  - ladx.py: `_map_ladxr_item_name()` with extensive mapping dict

#### Module-Based Resolution
Resolving names from item definition modules.
- **Exporters using**:
  - kh2.py: Uses ITEM_NAME_MODULES to find item definitions

---

### 9. Utility Methods

Game-specific helper utilities.

#### replace_name(name)
Replace/normalize item or location names.
- **Exporters using**:
  - alttp.py: Normalizes item names (e.g., 'Fighter Sword' -> 'Progressive Sword')

#### prepare_closure_vars(rule_func, closure_vars)
Prepare captured closure variables for export.
- **Base implementation**: Returns vars unchanged
- **Exporters overriding**:
  - kh2.py: Resolves form-specific variables, ability mappings
  - landstalker.py: Converts Region objects to codes, stores in stack for expansion
  - mm2.py: Injects module-level data (robot_masters, weapons_to_name)

#### cleanup_settings(settings)
Clean up exported settings before final output.
- **Base implementation**: Returns settings unchanged
- **Exporters overriding**: (none found in processed exporters)

#### should_process_multistatement_if_bodies()
Enable processing of if-statements with multiple statements.
- **Default**: False (in base)
- **Exporters returning True**:
  - marioland2.py: Complex rule functions need multi-statement handling

#### should_recursively_analyze_closures()
Enable recursive analysis of closure variable function calls.
- **Default**: False (in base)
- **Exporters returning True**:
  - marioland2.py: Needs closure variables inlined

#### resolve_f_string(f_string_rule)
Resolve f-string AST nodes to constant strings.
- **Base implementation**: Attempts string concatenation
- **Exporters overriding**:
  - kdl3.py: Handles level_names_inverse subscript expressions
  - tloz.py: Wraps result in constant node

#### recalculate_collection_state_if_needed(state, location, rules_json)
Custom collection state management for complex item interactions.
- **Default**: Not defined in base
- **Exporters overriding**:
  - jakanddaxter.py: Manages Reachable Orbs pseudo-item based on accessible regions

#### _register_helpers_from_rule(rule)
Register helper functions referenced in a rule structure.
- **Default**: Not defined in base
- **Exporters using**:
  - raft.py: Ensures helpers in ITEM_CHECK_RULES are exported

#### _get_region_access_rule(region)
Get access rule for a region from static mapping.
- **Default**: Not defined in base
- **Exporters using**:
  - raft.py: Maps region names to helper-based access rules

---

### 10. Special Pattern Handling

Game-specific patterns that appear in exporters.

#### ALWAYS_EVENT_ITEMS
List of items that should always be treated as events.
- **Exporters using**:
  - alttp.py: Crystal items, Triforce Piece

#### Condition Object Conversion
Converting game-specific condition objects to rule structures.
- **Exporters using**:
  - ladx.py: `_convert_ladxr_condition_to_rule()` for AND/OR/COUNT/FOUND/COUNTS

#### Accumulator Rules
Rules for accumulating item values (e.g., currency).
- **Exporters using**:
  - dlcquest.py: Accumulator rules for coins
  - jakanddaxter.py: Accumulator rules for Tradeable Orbs
  - ladx.py: Accumulator rules for RUPEES from rupee items

#### Custom Rule System Serialization
Serializing game-specific rule objects (not lambdas).
- **Exporters using**:
  - smz3.py: Handles TotalSMZ3 objects via override_rule_analysis
  - stardew_valley.py: `_serialize_stardew_rule()` for StardewRule objects (Received, Reach, And, Or, Count, Has, etc.)
  - zillion.py: Reads from zilliandomizer Req objects (gun, jump, floppy, red, char)

#### Entrance Caching
Caching entrance -> connected_region mappings.
- **Exporters using**:
  - ahit.py: `_get_entrance_connected_region()` with cache

#### Custom Game Data Methods
Additional methods for extracting game-specific data.
- **Exporters using**:
  - ahit.py: `get_chapter_costs()`, `get_hat_costs()`, `get_relic_groups()`

#### Known Helpers Set
Set of helper names that are valid for a game (validation purposes).
- **Exporters using**:
  - pokemon_rb.py: `known_helpers` set with 16 valid helper names

#### Pattern Detection and Simplification
Complex methods for detecting and simplifying rule patterns.
- **Exporters using**:
  - witness.py: Multiple pattern detection methods (`_is_all_of_comprehension_with_only_bound_methods`, `_is_region_reachability_pattern`, etc.) and corresponding simplification methods

#### Base Class Selection
Using BaseGameExportHandler directly instead of GenericGameExportHandler.
- **Exporters using**:
  - pokemon_rb.py: Extends BaseGameExportHandler for more control

---

## Factoring Opportunities

Based on this analysis, potential candidates for factoring into base/generic:

### High Priority
1. **AUTO_PRESERVE_LARGE_HELPERS = False** - 17 exporters disable this; should likely be the default
2. **Options resolution patterns** - kh1.py, marioland2.py, and others all resolve options.* to constants
3. **f_string resolution** - kdl3.py and tloz.py both need f_string handling
4. **Item name mapping patterns** - ladx.py, kh2.py, jakanddaxter.py have similar mapping approaches
5. **Condition object conversion** - The AND/OR/COUNT pattern in ladx.py could be generalized
6. **USE_RESOLVED_ITEMS + ADD_SPHERE_ITEMS_UPFRONT** - Often used together (6 exporters); could be a single config

### Medium Priority
1. **Accumulator rules** - dlcquest.py, jakanddaxter.py, and ladx.py use this pattern for currency/orbs
2. **postprocess_regions()** - aquaria.py and cvcotm.py both add missing regions
3. **prepare_closure_vars()** - landstalker.py, kh2.py, mm2.py all enhance closure vars
4. **post_process_data()** - Many exporters need to fix analyzer output issues
5. **JSON data loading** - raft.py pattern could be abstracted for other games

### Lower Priority
1. **Custom rule system support** - stardew_valley.py, smz3.py, zillion.py all serialize custom rule objects
2. **Logic mapping loading** - celeste64.py's pattern could be abstracted for other games
3. **Entrance caching** - ahit.py's pattern could be useful for other games with entrance shuffling
4. **Pattern detection/simplification** - witness.py's complex patterns could be templated

---

## Notes

- All game exporters have been processed (including previously excluded games)
- Content types may be added/refined as new patterns are discovered
- The goal is to identify common patterns that could reduce code duplication
- 17 exporters set AUTO_PRESERVE_LARGE_HELPERS = False, strongly suggesting this should be reconsidered as a default
- 6 exporters use both USE_RESOLVED_ITEMS and ADD_SPHERE_ITEMS_UPFRONT, suggesting these could be combined
