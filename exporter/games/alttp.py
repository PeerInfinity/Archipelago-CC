# exporter/games/alttp.py

from .base import BaseGameExportHandler
from typing import Any, Dict, Optional, Set, List
from worlds.alttp.Items import item_table, progression_mapping
from BaseClasses import ItemClassification
import collections
import logging

logger = logging.getLogger(__name__) # Add logger if needed later


class ALttPGameExportHandler(BaseGameExportHandler):
    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = True  # Closure functions are cached during analysis and exported
    # Helper modules containing functions that can be exported as JSON rule definitions
    HELPER_MODULES = ['worlds.alttp.StateHelpers', 'worlds.alttp.Bosses']

    # ALTTP exits are bidirectional - going through an entrance implies being able to return
    ASSUME_BIDIRECTIONAL_EXITS = True

    # Simple world attributes that can be automatically exported via base class
    COMPUTED_SETTINGS = {
        'treasure_hunt_required': lambda w, m, p: getattr(w, 'treasure_hunt_required', 0),
        'can_take_damage': lambda w, m, p: getattr(w, 'can_take_damage', True),
        'logical_heart_pieces': lambda w, m, p: getattr(w, 'logical_heart_pieces', 24),
        'logical_heart_containers': lambda w, m, p: getattr(w, 'logical_heart_containers', 10),
    }

    # Complex helpers that can't be exported (need JavaScript implementations)
    # NOTE: Use set() for empty blacklist - {} creates an empty dict!
    # All helpers now exported via computed definitions or other mechanisms
    HELPERS_TO_EXPORT_BLACKLIST = set()

    # Helpers that MUST be exported as definitions (whitelist)
    # For WorldGen worlds, helpers aren't discovered during AST analysis since rules
    # are already Rule Builder objects. This whitelist ensures all ALTTP helpers
    # are exported for both original and WorldGen worlds.
    HELPERS_TO_EXPORT_WHITELIST = {
        'GanonDefeatRule',
        'basement_key_rule',
        'bottle_count',
        'can_activate_crystal_switch',
        'can_bomb_or_bonk',
        'can_extend_magic',
        'can_get_good_bee',
        'can_hold_arrows',
        'can_kill_most_things',
        'can_lift_heavy_rocks',
        'can_lift_rocks',
        'can_melt_things',
        'can_retrieve_tablet',
        'can_shoot_arrows',
        'can_use_bombs',
        'cross_peg_bridge',
        'has_beam_sword',
        'has_crystals',
        'has_fire_source',
        'has_hearts',
        'has_melee_weapon',
        'has_misery_mire_medallion',
        'has_sword',
        'has_turtle_rock_medallion',
        'heart_count',
        'is_not_bunny',
        # can_buy, can_buy_unlimited, can_defeat_boss are computed helpers
        # defined in get_helper_definitions(), not from StateHelpers
    }

    # Helpers that should be preserved as helper calls (not inlined by generic pattern matching)
    # These are either:
    # - Complex helpers that are exported as definitions via get_helper_definitions()
    # - Computed helpers defined directly in get_helper_definitions()
    # All discovered helpers are automatically exported as definitions when
    # AUTO_EXPORT_DISCOVERED_HELPERS = True, so this set just controls which
    # helpers are preserved as calls vs potentially inlined by pattern matching.
    HELPERS_TO_PRESERVE = {
        'GanonDefeatRule',
        'can_buy',  # Computed helper using shop_items data
        'can_buy_unlimited',  # Computed helper using shop_items data
        'can_extend_magic',
        'can_get_good_bee',  # Uses region_reference and is_not_bunny
        'is_not_bunny',  # Takes region parameter, uses region_attribute
        'can_kill_most_things',
        'can_shoot_arrows',
        'can_use_bombs',
        'has_crystals',  # Exported with group_count support
        'has_hearts',  # Exported with logical_heart settings
        'has_misery_mire_medallion',  # Exported with setting_value index support
        'has_turtle_rock_medallion',  # Exported with setting_value index support
        'can_defeat_boss',  # Computed helper for GT multi-boss locations
        'orig_rule',  # Internal helper that doesn't appear in final export
    }
    
    # Items that are always events, regardless of their static item_code in item_table
    # These items are placed as events during runtime even if they have item codes defined
    # This list comes from the event_pairs in worlds/alttp/ItemPool.py:262-268 where these
    # items are explicitly created as events and placed at event locations
    # Also includes dungeon prizes (Crystals, Pendants, Triforce) which should be auto-collected
    ALWAYS_EVENT_ITEMS = {
        'Activated Flute',  # Placed as event at 'Flute Activation Spot'
        'Beat Agahnim 1',
        'Beat Agahnim 2',
        'Get Frog',
        'Return Smith',
        'Pick Up Purple Chest',
        'Open Floodgate',
        'Capacity Upgrade Shop',
        # Dungeon prizes - should be auto-collected when accessible
        'Crystal 1',
        'Crystal 2',
        'Crystal 3',
        'Crystal 4',
        'Crystal 5',
        'Crystal 6',
        'Crystal 7',
        'Red Pendant',
        'Blue Pendant',
        'Green Pendant',
        'Triforce'
    }
    
    # Note: No __init__ override needed - base class handles initialization
    # Note: No should_preserve_as_helper override needed - base class checks HELPERS_TO_PRESERVE
    # Note: No expand_rule override needed - base class handles rule expansion

    def replace_name(self, name: str) -> str:
        """Replace ALTTP-specific name references with standard equivalents."""
        if name == 'ep_boss' or name == 'ep_prize':
            logger.debug(f"ALTTP: Replacing '{name}' with 'location'")
            return 'location'
        return name
        
    def handle_special_function_call(self, func_name: str, processed_args: list) -> dict:
        """Handle ALTTP-specific special function calls."""
        if func_name == 'tr_big_key_chest_keys_needed':
            # Inline the tr_big_key_chest_keys_needed logic using placement_lookup
            # Original logic:
            #   item = location_item_name(state, 'Turtle Rock - Big Key Chest', player)
            #   if item == ('Small Key (Turtle Rock)', player): return 0
            #   if item == ('Big Key (Turtle Rock)', player): return 4
            #   return 6
            logger.debug(f"ALTTP: Inlining {func_name} logic with placement_lookup")
            return {
                'type': 'conditional',
                'test': {
                    'type': 'compare',
                    'left': {'type': 'placement_lookup', 'location': {'type': 'constant', 'value': 'Turtle Rock - Big Key Chest'}},
                    'op': '==',
                    'right': {'type': 'list', 'value': [
                        {'type': 'constant', 'value': 'Small Key (Turtle Rock)'},
                        {'type': 'constant', 'value': 1}
                    ]}
                },
                'if_true': {'type': 'constant', 'value': 0},
                'if_false': {
                    'type': 'conditional',
                    'test': {
                        'type': 'compare',
                        'left': {'type': 'placement_lookup', 'location': {'type': 'constant', 'value': 'Turtle Rock - Big Key Chest'}},
                        'op': '==',
                        'right': {'type': 'list', 'value': [
                            {'type': 'constant', 'value': 'Big Key (Turtle Rock)'},
                            {'type': 'constant', 'value': 1}
                        ]}
                    },
                    'if_true': {'type': 'constant', 'value': 4},
                    'if_false': {'type': 'constant', 'value': 6}
                }
            }

        # Convert location_item_name calls to placement_lookup rule type
        if func_name == 'location_item_name':
            logger.debug(f"ALTTP: Converting {func_name} to placement_lookup rule")
            # location_item_name takes (state, location_name, player) - we only need location_name
            if processed_args:
                return {
                    'type': 'placement_lookup',
                    'location': processed_args[0]  # First arg is location name
                }
            else:
                logger.warning(f"ALTTP: location_item_name called without location argument")
                return None

        # Convert item_name_in_location_names calls to placement_search rule type
        if func_name == 'item_name_in_location_names':
            logger.debug(f"ALTTP: Converting {func_name} to placement_search rule")
            # item_name_in_location_names takes (state, item, player, location_pairs)
            # After filtering state/player, we have: [item, location_pairs]
            if len(processed_args) >= 2:
                item_arg = processed_args[0]
                locations_arg = processed_args[1]

                # Extract the player ID from the context if available
                # For now, assume player 1 (single-player mode)
                return {
                    'type': 'placement_search',
                    'item': item_arg,
                    'player': {'type': 'constant', 'value': 1},
                    'locations': locations_arg
                }
            else:
                logger.warning(f"ALTTP: item_name_in_location_names missing arguments: {processed_args}")
                return None

        return None
    
    def postprocess_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post-process rules to fix specific complex patterns that can't be handled by the frontend.
        """
        if not isinstance(rule, dict):
            return rule

        # Note: has_crystals now supports dynamic arguments via setting_value,
        # so we no longer need to convert has_crystals(crystals_needed_for_ganon)
        # to has_crystals_for_ganon()

        # Check for state.multiworld.get_region().can_reach() pattern
        # Convert to native can_reach rule type which frontend already supports
        if (rule.get('type') == 'function_call' and
            isinstance(rule.get('function'), dict) and
            rule['function'].get('type') == 'attribute' and
            rule['function'].get('attr') == 'can_reach'):

            # Check if object is a get_region call
            obj = rule['function'].get('object', {})
            if (isinstance(obj, dict) and
                obj.get('type') == 'function_call' and
                isinstance(obj.get('function'), dict) and
                obj['function'].get('attr') == 'get_region'):

                # Extract region name from args
                args = obj.get('args', [])
                if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                    region_name = args[0].get('value')
                    # Replace with native can_reach rule type
                    return {
                        'type': 'can_reach',
                        'region': region_name
                    }
        
        # Check for state.multiworld.get_location().parent_region.dungeon.boss.can_defeat() pattern
        if (rule.get('type') == 'function_call' and 
            isinstance(rule.get('function'), dict) and
            rule['function'].get('type') == 'attribute' and
            rule['function'].get('attr') == 'can_defeat'):
            
            # Check if this is accessing a boss through location
            obj = rule['function'].get('object', {})
            if (isinstance(obj, dict) and 
                obj.get('type') == 'subscript' and
                obj.get('index', {}).get('value') in ['bottom', 'middle', 'top']):
                
                boss_type = obj['index']['value']
                # Try to extract location name from deeper in the chain
                parent_obj = obj.get('value', {})
                while parent_obj and isinstance(parent_obj, dict):
                    if parent_obj.get('type') == 'function_call':
                        func = parent_obj.get('function', {})
                        if func.get('attr') == 'get_location':
                            args = parent_obj.get('args', [])
                            if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                                location_name = args[0].get('value')
                                # Replace with a helper that checks boss defeat
                                return {
                                    'type': 'helper',
                                    'name': 'can_defeat_boss',
                                    'args': [
                                        {'type': 'constant', 'value': location_name},
                                        {'type': 'constant', 'value': boss_type}
                                    ]
                                }
                            break
                    parent_obj = parent_obj.get('object') or parent_obj.get('value')
        
        # Check for world.can_take_damage pattern - convert to setting_value
        # since can_take_damage is already exported in settings
        if (rule.get('type') == 'attribute' and
            rule.get('attr') == 'can_take_damage' and
            isinstance(rule.get('object'), dict) and
            rule['object'].get('type') == 'name' and
            rule['object'].get('name') == 'world'):

            # Replace with setting_value to use the exported setting
            return {
                'type': 'setting_value',
                'setting': 'can_take_damage'
            }
        
        # Recursively process nested rules
        if rule.get('type') == 'and' and rule.get('conditions'):
            rule['conditions'] = [self.postprocess_rule(cond) for cond in rule['conditions']]
        elif rule.get('type') == 'or' and rule.get('conditions'):
            rule['conditions'] = [self.postprocess_rule(cond) for cond in rule['conditions']]
        elif rule.get('type') == 'not' and rule.get('condition'):
            rule['condition'] = self.postprocess_rule(rule['condition'])
            
        return rule

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Return ALTTP-specific item table data."""
        alttp_items_data = {}
        
        # Use the imported item_table
        for item_name, item_data in item_table.items():
            # Get groups this item belongs to (logic moved from exporter.py)
            groups = [
                group_name for group_name, items in getattr(world, 'item_name_groups', {}).items()
                if item_name in items
            ]
            # If no groups and item has a type, add type as a group
            item_type_from_data = getattr(item_data, 'type', None) # Safer getattr for type
            if not groups and item_type_from_data:
                groups = [item_type_from_data]

            item_classification = getattr(item_data, 'classification', None) # Get classification safely
            item_type = getattr(item_data, 'type', None) # Get type safely
            
            # Check if this item should be treated as an event
            is_event_item = (item_type == 'Event') or (item_name in self.ALWAYS_EVENT_ITEMS)
            
            # If it's an event item, override the groups and set appropriate properties
            if is_event_item:
                if 'Event' not in groups:
                    groups = ['Event'] + groups
                item_id = None  # Event items have no ID
                effective_type = 'Event'
            else:
                item_id = getattr(item_data, 'item_code', None)  # Use item_code for non-events
                effective_type = item_type

            alttp_items_data[item_name] = {
                'name': item_name,
                'id': item_id,
                'groups': sorted(groups),
                'advancement': item_classification == ItemClassification.progression if item_classification else False,
                'useful': item_classification == ItemClassification.useful if item_classification else False,
                'trap': item_classification == ItemClassification.trap if item_classification else False,
                'event': is_event_item,
                'type': effective_type,
                'max_count': 1 # Default, overridden by get_item_max_counts if needed
            }

        # Handle dynamically created event items that may not have type='Event' in item_table
        # This matches how Python runtime identifies events: items placed at locations with item.code = None
        if hasattr(world, 'multiworld'):
            multiworld = world.multiworld
            player = world.player
            
            for location in multiworld.get_locations(player):
                if location.item and location.item.player == player:
                    item_name = location.item.name
                    # Check if this is an event item (no code/ID) that we haven't processed yet
                    if location.item.code is None and item_name not in alttp_items_data:
                        # This item is an event by runtime definition, even if not marked in item_table
                        alttp_items_data[item_name] = {
                            'name': item_name,
                            'id': None,
                            'groups': ['Event'],
                            'advancement': location.item.classification == ItemClassification.progression,
                            'useful': location.item.classification == ItemClassification.useful,
                            'trap': location.item.classification == ItemClassification.trap,
                            'event': True,
                            'type': 'Event',
                            'max_count': 1
                        }
                    elif location.item.code is None and item_name in alttp_items_data:
                        # Update existing item to match runtime behavior if it's actually an event
                        if not alttp_items_data[item_name]['event']:
                            logger.info(f"Correcting {item_name} to event based on runtime placement (item.code=None)")
                            alttp_items_data[item_name]['event'] = True
                            alttp_items_data[item_name]['type'] = 'Event'
                            alttp_items_data[item_name]['id'] = None
                            # Add to Event group if not already there
                            if 'Event' not in alttp_items_data[item_name]['groups']:
                                alttp_items_data[item_name]['groups'].append('Event')
                                alttp_items_data[item_name]['groups'].sort()

        return alttp_items_data

    def get_item_max_counts(self, world) -> Dict[str, int]:
        """Return ALTTP-specific maximum counts."""
        # Moved from exporter.py
        return {
            'Piece of Heart': 24,
            'Boss Heart Container': 10,
            'Sanctuary Heart Container': 1,
            'Magic Upgrade (1/2)': 1,
            'Magic Upgrade (1/4)': 1,
            'Progressive Sword': 4,
            'Progressive Shield': 3,
            'Progressive Glove': 2,
            'Progressive Mail': 2,
            'Progressive Bow': 2,
            'Bottle': 4,
            'Bottle (Red Potion)': 4,
            'Bottle (Green Potion)': 4,
            'Bottle (Blue Potion)': 4,
            'Bottle (Fairy)': 4,
            'Bottle (Bee)': 4,
            'Bottle (Good Bee)': 4,
        }

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Return ALTTP-specific progression item mapping."""
        mapping_data = {}
        # Use the imported progression_mapping
        for target_item, (base_item, level) in progression_mapping.items():
            if base_item not in mapping_data:
                mapping_data[base_item] = {
                    'items': [],
                    'base_item': base_item
                }
            mapping_data[base_item]['items'].append({
                'name': target_item,
                'level': level
            })

        # Sort items by level
        for prog_type in mapping_data.values():
            prog_type['items'].sort(key=lambda x: x['level'])

        # Add Progressive Bow (Alt) with same progression as Progressive Bow
        # This handles the runtime conversion that happens in ItemPool.py line 330-335
        # where one Progressive Bow is converted to Progressive Bow (Alt) for hint text
        # IMPORTANT: base_item must be 'Progressive Bow' so both variants count toward
        # the same progression level (needed for Silver Bow which requires 2 bows)
        if 'Progressive Bow' in mapping_data:
            mapping_data['Progressive Bow (Alt)'] = {
                'items': [item.copy() for item in mapping_data['Progressive Bow']['items']],
                'base_item': 'Progressive Bow'
            }

        return mapping_data

    # --- Add overrides for itempool/settings/info/cleanup ---
    def get_itempool_counts(self, world, multiworld, player) -> Dict[str, int]:
        """Calculate ALTTP item counts including dungeon items.

        Note: After the fill process, items are placed in locations, not in itempool.
        We count from precollected items and filled locations to avoid double-counting.
        """
        # Start with generic counts from precollected and filled locations
        itempool_counts = collections.defaultdict(int)

        # Count precollected items (items player starts with)
        if hasattr(multiworld, 'precollected_items'):
            for item in multiworld.precollected_items.get(player, []):
                itempool_counts[item.name] += 1

        # Count items placed in locations (after fill, items are at locations not in pool)
        for location in multiworld.get_filled_locations():
            if location.item and location.item.player == player:
                itempool_counts[location.item.name] += 1

        # Add ALTTP dungeon-specific items
        if hasattr(world, 'dungeons'):
            for dungeon in world.dungeons:
                dungeon_name = getattr(dungeon, 'name', '')
                if dungeon_name:
                    # Count small keys
                    small_key_name = f'Small Key ({dungeon_name})'
                    if hasattr(dungeon, 'small_key_count') and dungeon.small_key_count > 0:
                         # Only add if not already present (e.g., from itempool)
                         if small_key_name not in itempool_counts:
                            itempool_counts[small_key_name] = dungeon.small_key_count

                    # Add big key
                    big_key_name = f'Big Key ({dungeon_name})'
                    if hasattr(dungeon, 'big_key') and dungeon.big_key:
                         if big_key_name not in itempool_counts:
                            itempool_counts[big_key_name] = 1

        # Add ALTTP-specific max counts
        if hasattr(world, 'difficulty_requirements'):
             if hasattr(world.difficulty_requirements, 'progressive_bottle_limit'):
                 itempool_counts['__max_progressive_bottle'] = world.difficulty_requirements.progressive_bottle_limit
             if hasattr(world.difficulty_requirements, 'boss_heart_container_limit'):
                itempool_counts['__max_boss_heart_container'] = world.difficulty_requirements.boss_heart_container_limit
             if hasattr(world.difficulty_requirements, 'heart_piece_limit'):
                itempool_counts['__max_heart_piece'] = world.difficulty_requirements.heart_piece_limit

        # For vanilla placement, report only plain bottles (no variants)
        import os
        if os.environ.get('VANILLA_PLACEMENT') == '1':
            bottle_variants = ["Bottle (Red Potion)", "Bottle (Green Potion)", "Bottle (Blue Potion)",
                             "Bottle (Bee)", "Bottle (Good Bee)", "Bottle (Fairy)"]
            # Remove all bottle variants from the count
            for variant in bottle_variants:
                if variant in itempool_counts:
                    del itempool_counts[variant]
            # Vanilla ALTTP has exactly 4 bottles
            itempool_counts["Bottle"] = 4

        return dict(sorted(itempool_counts.items()))

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract ALTTP settings.

        Uses base class to export all options with their definitions.
        Note: World attributes (difficulty_requirements, medallions, shop_items)
        are now in get_world_attributes() instead.
        """
        # Get all options and option_definitions from base class
        # Note: assume_bidirectional_exits is set via ASSUME_BIDIRECTIONAL_EXITS class attribute
        return super().get_settings_data(world, multiworld, player)

    def get_world_attributes(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract ALTTP world attributes (computed runtime values).

        These are values computed at runtime on the world instance, not
        user-configurable options.
        """
        # Get base world attributes (from COMPUTED_SETTINGS: treasure_hunt_required,
        # can_take_damage, logical_heart_pieces, logical_heart_containers)
        world_attributes = super().get_world_attributes(world, multiworld, player)

        # Difficulty requirements
        if hasattr(world, 'difficulty_requirements'):
            world_attributes['difficulty_requirements'] = {
                'progressive_bottle_limit': getattr(world.difficulty_requirements, 'progressive_bottle_limit', None),
                'boss_heart_container_limit': getattr(world.difficulty_requirements, 'boss_heart_container_limit', None),
                'heart_piece_limit': getattr(world.difficulty_requirements, 'heart_piece_limit', None),
            }
        else:
            world_attributes['difficulty_requirements'] = {}

        # Medallions
        if hasattr(world, 'required_medallions'):
            medallion_names = []
            for med in world.required_medallions:
                med_name = getattr(med, 'name', None)
                if med_name is None:
                    med_name = getattr(med, 'value', str(med))
                medallion_names.append(med_name)

            world_attributes['required_medallions'] = medallion_names
            mire_med = getattr(world, 'misery_mire_medallion', medallion_names[0] if medallion_names else None)
            tr_med = getattr(world, 'turtle_rock_medallion', medallion_names[1] if len(medallion_names) > 1 else None)
            world_attributes['misery_mire_medallion'] = getattr(mire_med, 'value', str(mire_med))
            world_attributes['turtle_rock_medallion'] = getattr(tr_med, 'value', str(tr_med))
        else:
            world_attributes['required_medallions'] = []
            world_attributes['misery_mire_medallion'] = None
            world_attributes['turtle_rock_medallion'] = None

        # Shop item data - maps items to regions where shops sell them
        # Enables can_buy and can_buy_unlimited helper implementation
        shop_items = {}
        if hasattr(world, 'shops'):
            for shop in world.shops:
                region_name = shop.region.name if hasattr(shop, 'region') and shop.region else None
                if not region_name:
                    continue
                for inv in getattr(shop, 'inventory', []):
                    if inv is None:
                        continue
                    item_name = inv.get('item')
                    if not item_name:
                        continue
                    if item_name not in shop_items:
                        shop_items[item_name] = {'unlimited': [], 'limited': []}

                    if inv.get('max'):
                        replacement = inv.get('replacement')
                        if replacement:
                            if replacement not in shop_items:
                                shop_items[replacement] = {'unlimited': [], 'limited': []}
                            if region_name not in shop_items[replacement]['unlimited']:
                                shop_items[replacement]['unlimited'].append(region_name)
                        if region_name not in shop_items[item_name]['limited']:
                            shop_items[item_name]['limited'].append(region_name)
                    else:
                        if region_name not in shop_items[item_name]['unlimited']:
                            shop_items[item_name]['unlimited'].append(region_name)
                        if region_name not in shop_items[item_name]['limited']:
                            shop_items[item_name]['limited'].append(region_name)
        world_attributes['shop_items'] = shop_items

        return world_attributes

    def get_game_info(self, world) -> Dict[str, Any]:
         """ Gets ALTTP game info. """
         return {
             "name": "A Link to the Past",
             "rule_format": { "version": "1.0" } # Or update if specific format version needed
         }

    def cleanup_settings(self, settings_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Clean up ALTTP settings.

        Note: Most cleanup is no longer needed since the base exporter now exports
        Choice options as strings (via current_key) and includes option_definitions.
        This method is kept for any edge case cleanup.
        """
        cleaned_settings = settings_dict.copy()

        # Cleanup medallion names if they were extracted directly from enum objects
        for med_key in ['misery_mire_medallion', 'turtle_rock_medallion']:
            current_value = cleaned_settings.get(med_key)
            if isinstance(current_value, str) and '(' in current_value and 'Medallion' in current_value:
                try:
                    # Extract from format like 'Medallion(Bombos)'
                    extracted = current_value.split('(', 1)[1].split(')', 1)[0]
                    cleaned_settings[med_key] = extracted
                    logger.debug(f"Cleaned medallion '{med_key}' to '{extracted}'")
                except Exception as e:
                    logger.warning(f"Could not clean medallion value: {current_value} - Error: {e}")

        return cleaned_settings

    def get_region_attributes(self, region) -> Dict[str, Any]:
        """
        Add ALTTP-specific region attributes like light/dark world.

        Args:
            region: The region object being processed

        Returns:
            Dictionary with ALTTP-specific region attributes
        """
        attributes = {}

        # Add light/dark world attributes which are specific to ALTTP
        attributes['is_light_world'] = getattr(region, 'is_light_world', False)
        attributes['is_dark_world'] = getattr(region, 'is_dark_world', False)

        return attributes

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """
        Add ALTTP-specific location attributes like crystal.

        Args:
            location: The location object being processed
            world: The world object for this player

        Returns:
            Dictionary with ALTTP-specific location attributes
        """
        attributes = {}

        # Add crystal attribute for dungeon prize locations
        attributes['crystal'] = getattr(location, 'crystal', None)

        return attributes

    def get_collection_data(self, name):
        """
        Return the actual data for known ALTTP collections.
        Used during rule pre-processing to resolve zip() and other operations.
        """
        collections = {
            'randomizer_room_chests': [
                "Ganons Tower - Randomizer Room - Top Left",
                "Ganons Tower - Randomizer Room - Top Right", 
                "Ganons Tower - Randomizer Room - Bottom Left",
                "Ganons Tower - Randomizer Room - Bottom Right"
            ],
            'compass_room_chests': [
                "Ganons Tower - Compass Room - Top Left",
                "Ganons Tower - Compass Room - Top Right",
                "Ganons Tower - Compass Room - Bottom Left",
                "Ganons Tower - Compass Room - Bottom Right",
                "Ganons Tower - Conveyor Star Pits Pot Key"
            ],
            'back_chests': [
                "Ganons Tower - Bob's Chest",
                "Ganons Tower - Big Chest", 
                "Ganons Tower - Big Key Room - Left",
                "Ganons Tower - Big Key Room - Right",
                "Ganons Tower - Big Key Chest"
            ]
        }
        
        return collections.get(name)
    
    def get_effective_item_type(self, item_name: str, original_type: str) -> str:
        """
        Get the effective type for an item, considering ALTTP-specific event item rules.
        
        Args:
            item_name: The name of the item
            original_type: The original type from the item object
            
        Returns:
            The effective type that should be used for export
        """
        if item_name in self.ALWAYS_EVENT_ITEMS or original_type == 'Event':
            return 'Event'
        
        return original_type

    def get_collection_length(self, name):
        """
        Return the length of known ALTTP collections.
        Used during rule pre-processing to resolve len() operations.
        """
        data = self.get_collection_data(name)
        return len(data) if data is not None else None

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """
        Get helper definitions, including computed helpers for can_buy/can_buy_unlimited.

        The can_buy and can_buy_unlimited helpers in Python iterate over Shop objects
        with method calls (shop.has(), region.can_reach()) that can't be directly exported.
        Instead, we define computed helpers that use the exported shop_items data structure
        to achieve the same logic:

        Python: any(shop.has(item) and shop.region.can_reach(state) for shop in shops)
        JSON:   any_of(region in shop_items[item][key], can_reach(region))

        This allows these helpers to be evaluated natively by the rule engine without
        special-case handling.
        """
        # Get standard exported helpers from base class
        helper_defs = super().get_helper_definitions(world)

        # Define computed helper for can_buy
        # Logic: check if any region in shop_items[item]["limited"] is reachable
        helper_defs['can_buy'] = {
            'params': ['item'],
            'body': {
                'type': 'any_of',
                'iterator_info': {
                    'target': {'type': 'name', 'name': 'region'},
                    'iterator': {
                        'type': 'subscript',
                        'value': {
                            'type': 'subscript',
                            'value': {'type': 'setting_value', 'setting': 'shop_items'},
                            'index': {'type': 'name', 'name': 'item'}
                        },
                        'index': {'type': 'constant', 'value': 'limited'}
                    }
                },
                'element_rule': {
                    'type': 'can_reach',
                    'region': {'type': 'name', 'name': 'region'}
                }
            }
        }

        # Define computed helper for can_buy_unlimited
        # Logic: check if any region in shop_items[item]["unlimited"] is reachable
        helper_defs['can_buy_unlimited'] = {
            'params': ['item'],
            'body': {
                'type': 'any_of',
                'iterator_info': {
                    'target': {'type': 'name', 'name': 'region'},
                    'iterator': {
                        'type': 'subscript',
                        'value': {
                            'type': 'subscript',
                            'value': {'type': 'setting_value', 'setting': 'shop_items'},
                            'index': {'type': 'name', 'name': 'item'}
                        },
                        'index': {'type': 'constant', 'value': 'unlimited'}
                    }
                },
                'element_rule': {
                    'type': 'can_reach',
                    'region': {'type': 'name', 'name': 'region'}
                }
            }
        }

        # Define computed helper for can_defeat_boss
        # This is a synthetic helper created by postprocess_rule for GT multi-boss locations.
        # The simplified implementation just calls can_kill_most_things(1), matching JS behavior.
        # For proper boss-specific logic, we'd need to export boss placements and defeat rules.
        helper_defs['can_defeat_boss'] = {
            'params': ['location_name', 'boss_type'],
            'body': {
                'type': 'helper',
                'name': 'can_kill_most_things',
                'args': [{'type': 'constant', 'value': 1}]
            }
        }

        return helper_defs

# Reminder: Ensure get_game_export_handler in exporter/games/__init__.py
# returns an instance of ALttPGameExportHandler for the 'A Link to the Past' game.
