# Exporter Content Types Index

This document categorizes the different types of content that appear in custom game exporters, organized by content type. The goal is to identify content that could potentially be factored out into the base exporter, generic exporter, or shared utilities.

## Processing Status

### Processed Exporters (8)
- alttp.py
- factorio.py
- kh2.py
- ladx.py
- lingo.py
- messenger.py
- sm.py
- subnautica.py

### Unprocessed Exporters (35)
- ahit.py
- aquaria.py
- bomb_rush_cyberfunk.py
- celeste64.py
- celeste_open_world.py
- civ_6.py
- cvcotm.py
- dark_souls_3.py
- dlcquest.py
- ffmq.py
- inscryption.py
- kdl3.py
- kh1.py
- landstalker.py
- marioland2.py
- mlss.py
- mm2.py
- mmbn3.py
- musedash.py
- osrs.py
- overcooked2.py
- paint.py
- saving_princess.py
- sc2.py
- sm64ex.py
- soe.py
- stardew_valley.py
- terraria.py
- timespinner.py
- tloz.py
- tww.py
- v6.py
- wargroove.py
- yachtdice.py
- yoshisisland.py

### Excluded Exporters (per template-exclude-list.json)
- blasphemous.py
- hk.py (Hollow Knight)
- jakanddaxter.py
- oot.py (Ocarina of Time)
- pokemon_emerald.py
- pokemon_rb.py
- raft.py
- smz3.py
- tunic.py
- witness.py
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
- **Exporters using non-default**: (none found in processed exporters)

#### AUTO_PRESERVE_LARGE_HELPERS
Controls automatic preservation of large helper functions.
- **Default**: True (in GenericGameExportHandler)
- **Exporters setting to False**:
  - messenger.py

#### HELPER_MODULES
List of module paths containing helper functions to search.
- **Default**: [] (in BaseGameExportHandler)
- **Exporters using**:
  - kh2.py: `['worlds.kh2.Rules']`
  - lingo.py: `['worlds.lingo.rules']`

#### HELPERS_TO_PRESERVE
List of helper names that should be preserved as callable functions.
- **Default**: [] (in BaseGameExportHandler)
- **Exporters using**: (none found - most use HELPERS_TO_EXPORT_BLACKLIST instead)

#### HELPERS_TO_EXPORT_BLACKLIST
List of helper names that should NOT be exported.
- **Default**: [] (in BaseGameExportHandler)
- **Exporters using**:
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
  - factorio.py
  - ladx.py

#### ADD_SPHERE_ITEMS_UPFRONT
Whether to add sphere items at start vs incrementally.
- **Default**: False (in GenericGameExportHandler)
- **Exporters using**: (none found in processed exporters)

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

---

### 2. Rule Processing Methods

Methods that transform or analyze access rules during export.

#### expand_rule(rule, _depth)
Transform rule structures, often to inline or simplify complex patterns.
- **Base implementation**: Returns rule unchanged
- **Exporters overriding**:
  - messenger.py: Handles `inferred_*` item patterns and `items_helper.CAN_*` capabilities
  - factorio.py: Simplifies `technology.name` attribute access
  - subnautica.py: Handles `location.can_reach()` patterns for Aurora Drive Room

#### expand_helper(helper_def, helper_name)
Transform helper function definitions.
- **Base implementation**: Returns helper unchanged
- **Exporters overriding**:
  - kh2.py: Complex expansion for form abilities, party requirements, visit locks
  - subnautica.py: Expands SwimRule property accesses (base_depth, consider_items)

#### postprocess_rule(rule)
Post-process rules after initial analysis.
- **Base implementation**: Returns rule unchanged
- **Exporters overriding**: (none found in processed exporters)

#### postprocess_entrance_rule(rule, entrance_name)
Post-process entrance/exit rules specifically.
- **Base implementation**: Returns rule unchanged
- **Exporters overriding**:
  - ladx.py: Handles isinstance pattern for LADXR conditions

#### handle_special_function_call(function_name, args, func)
Handle game-specific function call patterns.
- **Base implementation**: Returns None (no handling)
- **Exporters overriding**:
  - alttp.py: Handles `has_triforce_pieces`, `has_crystals`, `has_medallions`, etc.

#### handle_complex_exit_rule(exit_name, access_rule_method)
Handle complex exit/entrance rule extraction.
- **Base implementation**: Returns None
- **Exporters overriding**:
  - ladx.py: Extracts LADXR condition objects from entrance.condition attribute

#### override_rule_analysis(rule)
Completely override rule analysis for specific patterns.
- **Base implementation**: Returns None
- **Exporters overriding**: (none found in processed exporters)

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
  - alttp.py: Adds dungeon items, crystals, keys with special handling

#### get_item_max_counts(world)
Export maximum counts for progressive/stackable items.
- **Base implementation**: Returns empty dict
- **Exporters overriding**:
  - alttp.py: Progressive items, dungeon keys, bottle counts

#### get_progression_mapping(world)
Map item names to their progression identifiers.
- **Base implementation**: Returns empty dict
- **Exporters overriding**:
  - messenger.py: Maps Time Shard variants to 'Time Shard'

#### get_itempool_counts(world)
Export counts of items in the item pool.
- **Base implementation**: Standard counting
- **Exporters overriding**: (none found in processed exporters)

#### get_settings_data(world)
Export game settings and options.
- **Base implementation**: Exports option values
- **Exporters overriding**:
  - alttp.py: Complex settings with dungeon info, medallion requirements
  - lingo.py: Door shuffle data, mastery requirements, panel data

#### get_game_info(world)
Export general game information.
- **Base implementation**: Returns basic game info
- **Exporters overriding**:
  - factorio.py: Adds `required_technologies` list
  - ladx.py: Adds `accumulator_rules` for RUPEES and `prog_items_init`
  - lingo.py: Adds panels_by_color, sunwarp configuration

#### get_helper_definitions(world)
Export helper function definitions.
- **Base implementation**: Discovers and exports helpers
- **Exporters overriding**:
  - subnautica.py: Applies SwimRule expansion to all helpers

---

### 4. Region/Location Attribute Methods

Methods that add custom attributes to regions and locations.

#### get_region_attributes(region)
Add custom attributes to region data.
- **Base implementation**: Returns empty dict
- **Exporters overriding**:
  - alttp.py: Adds hint_text, is_light_world, is_dark_world, dungeon info

#### get_location_attributes(location)
Add custom attributes to location data.
- **Base implementation**: Returns empty dict
- **Exporters overriding**:
  - alttp.py: Adds dungeon, item_rule, always_allow, hint info
  - lingo.py: Adds AccessRequirements (doors_to_open, colors_required, etc.)

#### get_custom_location_access_rule(location)
Override the standard access rule for specific locations.
- **Base implementation**: Returns None
- **Exporters overriding**:
  - lingo.py: Returns rule based on location's AccessRequirements

---

### 5. Pre/Post Processing Hooks

Methods called before or after main export phases.

#### preprocess_world_data(world)
Called before main export processing.
- **Base implementation**: Does nothing
- **Exporters overriding**: (none found in processed exporters)

#### post_process_data(data, world)
Called after all data export, before serialization.
- **Base implementation**: Returns data unchanged
- **Exporters overriding**: (none found in processed exporters)

#### post_process_location_data(location_data, location)
Post-process individual location data.
- **Base implementation**: Returns data unchanged
- **Exporters overriding**: (none found in processed exporters)

---

### 6. Context Tracking

Methods for tracking context during rule analysis.

#### set_context(context_type, context_value)
Set general analysis context.
- **Base implementation**: Does nothing
- **Exporters overriding**: (none found in processed exporters)

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

#### JSON Data Loading
Loading rules or data from JSON files.
- **Exporters using**: (none found in processed exporters - but common in excluded games)

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

#### prepare_closure_vars(captured_vars, helper_name)
Prepare captured closure variables for export.
- **Base implementation**: Returns vars unchanged
- **Exporters overriding**:
  - kh2.py: Resolves form-specific variables, ability mappings

#### cleanup_settings(settings)
Clean up exported settings before final output.
- **Base implementation**: Returns settings unchanged
- **Exporters overriding**: (none found in processed exporters)

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
  - ladx.py: Accumulator rules for RUPEES from rupee items

---

## Factoring Opportunities

Based on this analysis, potential candidates for factoring into base/generic:

### High Priority
1. **Item name mapping patterns** - Both ladx.py and kh2.py have similar mapping approaches
2. **Condition object conversion** - The AND/OR/COUNT pattern in ladx.py could be generalized
3. **Accumulator rules** - The pattern from ladx.py could benefit other games with currency

### Medium Priority
1. **Location dependency patterns** - subnautica.py's location.can_reach() pattern
2. **SwimRule-style property expansion** - Could be generalized for option classes with computed properties
3. **DSL parsing infrastructure** - sm.py's approach could be templated

### Lower Priority
1. **Helper blacklist patterns** - Both kh2.py and lingo.py use similar blacklist approaches
2. **Form/ability expansion** - kh2.py's complex expansion is very game-specific but the pattern could be abstracted

---

## Notes

- This document should be updated as more exporters are processed
- Content types may be added/refined as new patterns are discovered
- The goal is to identify common patterns that could reduce code duplication
