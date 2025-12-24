"""Castlevania - Circle of the Moon specific exporter."""

from typing import Dict, Any, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class CvCotMGameExportHandler(GenericGameExportHandler):
    """Expander for Castlevania - Circle of the Moon specific functions."""

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Return CvCotM item data with corrected classifications.

        The original world has combined classification flags (e.g., useful|progression)
        that aren't properly handled by the generic exporter. This method ensures
        that items required for logic are marked as progression.
        """
        # Get base item data from parent
        item_data = super().get_item_data(world)

        # Items that must be progression for the logic to work:
        # - Roc Wing: Required for has_jump_level_2 through has_jump_level_5
        # - Double: Required for has_jump_level_1 (but locked, so less critical)
        # - Serpent/Cockatrice + Mercury/Mars: Required for has_ice_or_stone
        #   (at least one from each group must be progression)
        progression_items = [
            "Roc Wing",       # Required for jump levels 2-5
            "Double",         # Required for jump level 1
            "Serpent Card",   # Part of has_ice_or_stone
            "Cockatrice Card", # Part of has_ice_or_stone
            "Mercury Card",   # Part of has_ice_or_stone
            "Mars Card",      # Part of has_ice_or_stone
        ]

        for item_name in progression_items:
            if item_name in item_data:
                item_data[item_name]['classification'] = 'progression'

        return item_data

    def expand_helper(self, helper_name: str):
        """Expand CvCotM-specific helper functions."""
        # For now, preserve helper nodes as-is
        return None

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """
        Export CvCotM helper definitions.

        CvCotM helpers are defined as class methods in CVCotMRules, so we need to
        manually export them as rule definitions.
        """
        # Get settings values from the world
        nerf_roc_wing = world.options.nerf_roc_wing.value if hasattr(world.options, 'nerf_roc_wing') else 0
        ignore_cleansing = world.options.ignore_cleansing.value if hasattr(world.options, 'ignore_cleansing') else 0
        iron_maiden_behavior = world.options.iron_maiden_behavior.value if hasattr(world.options, 'iron_maiden_behavior') else 0
        required_last_keys = world.required_last_keys if hasattr(world, 'required_last_keys') else 0

        # Item names from worlds.cvcotm.data.iname
        double = "Double"
        roc_wing = "Roc Wing"
        kick_boots = "Kick Boots"
        tackle = "Tackle"
        heavy_ring = "Heavy Ring"
        serpent = "Serpent Card"
        cockatrice = "Cockatrice Card"
        mercury = "Mercury Card"
        mars = "Mars Card"
        cleansing = "Cleansing"
        maiden_detonator = "Maiden Detonator"
        last_key = "Last Key"

        helpers = {}

        # Helper function to create item_check rule
        def has_item(item_name):
            return {
                'type': 'item_check',
                'item': {'type': 'constant', 'value': item_name}
            }

        # Helper function to create state_method has_any rule
        def has_any_items(items):
            return {
                'type': 'state_method',
                'method': 'has_any',
                'args': [{'type': 'constant', 'value': items}]
            }

        # Helper function to create state_method has_all rule
        def has_all_items(items):
            return {
                'type': 'state_method',
                'method': 'has_all',
                'args': [{'type': 'constant', 'value': items}]
            }

        # has_jump_level_1: Double OR Roc Wing
        helpers['has_jump_level_1'] = has_any_items([double, roc_wing])

        # has_jump_level_2: Roc Wing
        helpers['has_jump_level_2'] = has_item(roc_wing)

        # has_jump_level_3: if nerf_roc_wing: Roc Wing AND (Double OR Kick Boots) else: Roc Wing
        if nerf_roc_wing:
            helpers['has_jump_level_3'] = {
                'type': 'and',
                'conditions': [
                    has_item(roc_wing),
                    has_any_items([double, kick_boots])
                ]
            }
        else:
            helpers['has_jump_level_3'] = has_item(roc_wing)

        # has_jump_level_4: if nerf_roc_wing: Roc Wing AND Kick Boots else: Roc Wing
        if nerf_roc_wing:
            helpers['has_jump_level_4'] = has_all_items([roc_wing, kick_boots])
        else:
            helpers['has_jump_level_4'] = has_item(roc_wing)

        # has_jump_level_5: if nerf_roc_wing: Roc Wing AND Double AND Kick Boots else: Roc Wing
        if nerf_roc_wing:
            helpers['has_jump_level_5'] = has_all_items([roc_wing, double, kick_boots])
        else:
            helpers['has_jump_level_5'] = has_item(roc_wing)

        # has_kick: Kick Boots
        helpers['has_kick'] = has_item(kick_boots)

        # has_tackle: Tackle
        helpers['has_tackle'] = has_item(tackle)

        # has_push: Heavy Ring
        helpers['has_push'] = has_item(heavy_ring)

        # has_ice_or_stone: (Serpent OR Cockatrice) AND (Mercury OR Mars)
        helpers['has_ice_or_stone'] = {
            'type': 'and',
            'conditions': [
                has_any_items([serpent, cockatrice]),
                has_any_items([mercury, mars])
            ]
        }

        # can_touch_water: if ignore_cleansing: True else: Cleansing
        if ignore_cleansing:
            helpers['can_touch_water'] = {
                'type': 'constant',
                'value': True
            }
        else:
            helpers['can_touch_water'] = has_item(cleansing)

        # broke_iron_maidens: if iron_maiden_behavior == 1 (start_broken): True else: Maiden Detonator
        # From options.py: option_start_broken = 1
        if iron_maiden_behavior == 1:
            helpers['broke_iron_maidens'] = {
                'type': 'constant',
                'value': True
            }
        else:
            helpers['broke_iron_maidens'] = has_item(maiden_detonator)

        # can_open_ceremonial_door: Last Key count >= required_last_keys
        if required_last_keys == 0:
            helpers['can_open_ceremonial_door'] = {
                'type': 'constant',
                'value': True
            }
        else:
            helpers['can_open_ceremonial_door'] = {
                'type': 'item_check',
                'item': {'type': 'constant', 'value': last_key},
                'count': {'type': 'constant', 'value': required_last_keys}
            }

        return helpers

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand and fix rules for CvCotM."""
        if not rule:
            return rule

        rule_type = rule.get('type')

        # Convert function_call with self.method_name to helper calls
        if rule_type == 'function_call':
            func = rule.get('function', {})
            if (func.get('type') == 'attribute' and
                func.get('object', {}).get('type') == 'name' and
                func.get('object', {}).get('name') == 'self'):
                # This is a call to self.method_name - convert to helper
                method_name = func.get('attr')
                if method_name:
                    return {
                        'type': 'helper',
                        'name': method_name,
                        'args': rule.get('args', [])
                    }

        # Standard helper processing from base class
        if rule_type == 'helper':
            expanded = self.expand_helper(rule['name'])
            return expanded if expanded else rule

        # Recursively process conditions for and/or rules
        if rule_type in ['and', 'or']:
            if 'conditions' in rule:
                rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule['conditions']]

        return rule
    
    def postprocess_regions(self, multiworld, player: int):
        """Add Menu region if it doesn't exist."""
        try:
            # Get all regions for this player
            player_regions = [r for r in multiworld.get_regions() if r.player == player]
            
            # Check if Menu region exists
            menu_region = None
            for region in player_regions:
                if region.name == 'Menu':
                    menu_region = region
                    break
            
            # If Menu doesn't exist, we need to create it
            if not menu_region:
                logger.info(f"Creating Menu region for CvCotM player {player}")
                # Import the Region class from BaseClasses
                from BaseClasses import Region, Entrance
                
                # Create Menu region
                menu = Region('Menu', player, multiworld)
                multiworld.regions.append(menu)
                
                # Find the starting region (Catacomb)
                catacomb = None
                for region in player_regions:
                    if region.name == 'Catacomb':
                        catacomb = region
                        break
                
                if catacomb:
                    # Create an entrance from Menu to Catacomb
                    menu_to_catacomb = Entrance(player, 'Start Game', menu)
                    menu_to_catacomb.connect(catacomb)
                    menu.exits.append(menu_to_catacomb)
                    catacomb.entrances.append(menu_to_catacomb)
                    logger.info(f"Connected Menu to Catacomb for player {player}")
                else:
                    logger.warning(f"Could not find Catacomb region for player {player}")
                    
        except Exception as e:
            logger.error(f"Error in postprocess_regions for CvCotM: {e}")
    
    def post_process_regions(self, regions_data: Dict[str, Any], world_classes: Dict[str, str] = None) -> Dict[str, Any]:
        """Fix region data structure for CvCotM.

        Args:
            regions_data: Dictionary of player_id -> regions dictionary
            world_classes: Dictionary of player_id -> world class name, used to identify CvCotM players
        """
        # Determine which player IDs are playing CvCotM
        cvcotm_player_ids = set()
        if world_classes:
            for player_id, world_class in world_classes.items():
                if world_class == 'CVCotMWorld':
                    cvcotm_player_ids.add(player_id)
        else:
            # Fallback: if no world_classes provided, assume we should process any player
            # that has a 'Catacomb' region (CvCotM starting area)
            for player_id, player_regions in regions_data.items():
                if isinstance(player_regions, dict) and 'Catacomb' in player_regions:
                    cvcotm_player_ids.add(player_id)

        if not cvcotm_player_ids:
            # No CvCotM players found, return data as-is
            return regions_data

        # Process only CvCotM players, preserving all other players' data
        result = {}
        for player_id, player_regions in regions_data.items():
            if player_id not in cvcotm_player_ids:
                # Not a CvCotM player, preserve their regions as-is
                result[player_id] = player_regions
                continue

            if not isinstance(player_regions, dict):
                result[player_id] = player_regions
                continue

            # Process CvCotM player's regions
            formatted_regions = {}
            player_int = int(player_id) if player_id.isdigit() else 1

            # Add Menu region if it doesn't exist
            if 'Menu' not in player_regions:
                formatted_regions['Menu'] = {
                    'name': 'Menu',
                    'type': 'Region',
                    'player': player_int,
                    'entrances': [],
                    'exits': [
                        {
                            'name': 'Start Game',
                            'connected_region': 'Catacomb',
                            'access_rule': {
                                'type': 'constant',
                                'value': True
                            },
                            'reverse': None,
                            'randomization_type': 1,
                            'direction': None,
                            'type': 'Exit'
                        }
                    ],
                    'locations': [],
                    'time_passes': True,
                    'provides_chest_count': True
                }

                # Add entrance to Catacomb from Menu
                if 'Catacomb' in player_regions:
                    catacomb = player_regions['Catacomb']
                    if isinstance(catacomb, dict):
                        if 'entrances' not in catacomb or not catacomb['entrances']:
                            catacomb['entrances'] = []
                        # Check if entrance from Menu already exists
                        has_menu_entrance = any(e.get('parent_region') == 'Menu' for e in catacomb['entrances'] if isinstance(e, dict))
                        if not has_menu_entrance:
                            catacomb['entrances'].append({
                                'name': 'Start Game',
                                'parent_region': 'Menu',
                                'connected_region': 'Catacomb',
                                'reverse': None,
                                'assumed': False,
                                'randomization_type': 1,
                                'direction': None,
                                'type': 'Entrance'
                            })

            for region_name, region_data in player_regions.items():
                if isinstance(region_data, dict):
                    # Ensure region has required fields
                    if 'name' not in region_data:
                        region_data['name'] = region_name
                    if 'type' not in region_data:
                        region_data['type'] = 'Region'
                    if 'player' not in region_data:
                        region_data['player'] = player_int
                    if 'entrances' not in region_data:
                        region_data['entrances'] = []
                    if 'exits' not in region_data:
                        region_data['exits'] = []
                    if 'locations' not in region_data:
                        region_data['locations'] = []
                    if 'time_passes' not in region_data:
                        region_data['time_passes'] = True
                    if 'provides_chest_count' not in region_data:
                        region_data['provides_chest_count'] = True

                    formatted_regions[region_name] = region_data

            result[player_id] = formatted_regions

        return result
    
    def get_settings_data(self, world, multiworld, player: int) -> Dict[str, Any]:
        """Export CvCotM-specific settings."""
        # Get base settings from parent class
        settings = super().get_settings_data(world, multiworld, player)

        # Add all CvCotM-specific options that affect logic
        if hasattr(world, 'options'):
            options_to_export = [
                'nerf_roc_wing',
                'ignore_cleansing',
                'iron_maiden_behavior',
                'required_last_keys',
                'completion_goal',
            ]

            for option_name in options_to_export:
                if hasattr(world.options, option_name):
                    option_value = getattr(world.options, option_name)
                    # Extract the actual value from the option object
                    settings[option_name] = getattr(option_value, 'value', option_value)

        return settings

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process the exported data to fix any issues."""
        # Fix region data if needed
        if 'regions' in data:
            # Pass world_classes so we know which players are playing CvCotM
            world_classes = data.get('world_classes', {})
            data['regions'] = self.post_process_regions(data['regions'], world_classes)

        return data