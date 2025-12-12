"""Kingdom Hearts 2 specific helper expander."""

from typing import Dict, Any, List
from .base import BaseGameExportHandler
import re
import logging

logger = logging.getLogger(__name__)

class KH2GameExportHandler(BaseGameExportHandler):
    GAME_NAME = 'Kingdom Hearts 2'
    """KH2-specific expander that handles Kingdom Hearts 2 rules."""

    # Enable automatic export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Module paths containing helper functions
    HELPER_MODULES = ['worlds.kh2.Rules']

    # Module paths containing item name constants
    ITEM_NAME_MODULES = ['worlds.kh2.Names']

    # Mapping of self.<attr> to setting names for the analyzer
    # This enables conversion of patterns like self.fight_logic to setting_value rules
    SELF_ATTR_TO_SETTING = {
        'fight_logic': 'FightLogic',  # self.fight_logic = world.options.FightLogic.current_key
    }

    # Helpers too complex for automatic export
    HELPERS_TO_EXPORT_BLACKLIST = {
        # Form-related helpers with complex logic
        'form_list_unlock',           # Has set operations (.add) and references auto_form_dict
        'get_form_level_requirement', # Has loops counting forms with conditional removal

        # Utility functions using sum() - NOW SUPPORTED via sum() rule type
        # 'kh2_list_count_sum' - Now supported
        # 'kh2_list_any_sum' - Now supported
        # 'kh2_dict_count' - Now supported (uses all() which is supported)
        # 'kh2_dict_one_count' - Now supported
        # 'level_locking_unlock' - Now supported
        # 'summon_levels_unlocked' - Now supported
        # 'kh2_has_all' - Supported via self.player → player_id
        # 'kh2_has_any' - Supported via self.player → player_id

        # Location-based helpers - require multiworld.get_location which isn't available
        'kh2_can_reach',              # Uses multiworld.get_location
        'kh2_can_reach_any',          # Loop over locations with kh2_can_reach
        'kh2_can_reach_all',          # Loop over locations with kh2_can_reach

        # Form region access - uses location.can_reach pattern
        'final_form_region_access',   # Uses any() over location.can_reach

        # Fight rule helpers - NOW SUPPORTED via sum(), closure vars, and setting_value
        # These helpers use kh2_list_any_sum, kh2_dict_count, etc. which are now supported
        # They also access self.fight_logic which maps to setting_value 'FightLogic'
        # Removing from blacklist to allow export

        # Static methods that return True - handled via helper_map expansion
        # 'get_axel_one_rules', 'get_axel_two_rules', 'get_twilight_thorn_rules',
        # 'get_beast_rules', 'get_grim_reaper1_rules', 'get_old_pete_rules', 'get_oogie_rules',
        'limit_form_region_access', 'multi_form_region_access',
    }

    def __init__(self, world=None):
        """Initialize with optional world reference."""
        super().__init__()
        self.world = world

    def prepare_closure_vars(self, rule_func, closure_vars: Dict[str, Any]) -> Dict[str, Any]:
        """Inject KH2 module-level data structures into closure_vars for helper analysis.

        This ensures that constants from Logic.py and Items.py are available
        during rule analysis, even when they're not in the function's direct closure.
        """
        enhanced_closure = closure_vars.copy()

        try:
            # Import KH2 Logic module data
            from worlds.kh2.Logic import (
                auto_form_dict, summons, form_list, form_list_without_final,
                gap_closer, defensive_tool, ground_finisher, party_limit,
                donald_limit, aerial_move, black_magic, magic, three_proofs,
                final_leveling_access, drive_form_list
            )
            from worlds.kh2.Items import visit_locking_dict
            from worlds.kh2.Names import ItemName, RegionName, LocationName

            # Add all the data structures to closure vars
            data_to_inject = {
                'auto_form_dict': auto_form_dict,
                'summons': summons,
                'form_list': form_list,
                'form_list_without_final': form_list_without_final,
                'gap_closer': gap_closer,
                'defensive_tool': defensive_tool,
                'ground_finisher': ground_finisher,
                'party_limit': party_limit,
                'donald_limit': donald_limit,
                'aerial_move': aerial_move,
                'black_magic': black_magic,
                'magic': magic,
                'three_proofs': three_proofs,
                'final_leveling_access': final_leveling_access,
                'drive_form_list': drive_form_list,
                'visit_locking_dict': visit_locking_dict,
                'ItemName': ItemName,
                'RegionName': RegionName,
                'LocationName': LocationName,
            }

            # Also import all the fight rule dicts from Logic.py
            from worlds.kh2 import Logic
            for name in dir(Logic):
                if name.startswith(('easy_', 'normal_', 'hard_', 'not_hard_', 'transport_')):
                    value = getattr(Logic, name)
                    if isinstance(value, dict):
                        data_to_inject[name] = value

            for name, value in data_to_inject.items():
                if name not in enhanced_closure:
                    enhanced_closure[name] = value
                    logger.debug(f"Injected {name} into closure_vars for KH2 helper analysis")

        except ImportError as e:
            logger.warning(f"Could not import KH2 modules for closure injection: {e}")

        return enhanced_closure

    def expand_helper(self, helper_name: str, args=None):
        """Expand KH2-specific helper functions."""
        # Map of KH2 helper functions to their simplified rules
        helper_map = {
            'limit_form_region_access': {'type': 'constant', 'value': True},
            'multi_form_region_access': {'type': 'constant', 'value': True},
            # Static methods that return True (no parameters needed)
            'get_axel_one_rules': {'type': 'constant', 'value': True},
            'get_axel_two_rules': {'type': 'constant', 'value': True},
            'get_twilight_thorn_rules': {'type': 'constant', 'value': True},
            'get_beast_rules': {'type': 'constant', 'value': True},
            'get_grim_reaper1_rules': {'type': 'constant', 'value': True},
            'get_old_pete_rules': {'type': 'constant', 'value': True},
            'get_oogie_rules': {'type': 'constant', 'value': True},
            # final_form_region_access has complex logic - leave as helper
            # valor, wisdom, master forms need investigation
        }

        # form_list_unlock should be kept as a helper call for JavaScript evaluation
        # Don't expand it - let it be processed as a helper in the frontend
        if helper_name == 'form_list_unlock':
            return None  # Return None to preserve as helper

        if helper_name in helper_map:
            return helper_map[helper_name]

        # For now, preserve helper nodes as-is until we identify specific helpers
        return None
        
    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand rule functions for KH2."""
        if not rule:
            return rule

        # Special handling for function_call with self methods
        if rule.get('type') == 'function_call':
            func = rule.get('function', {})
            # Check if this is a self.method_name pattern
            if func.get('type') == 'attribute' and isinstance(func.get('object'), dict):
                obj = func.get('object', {})
                if obj.get('type') == 'name' and obj.get('name') == 'self':
                    # This is a self.method_name call
                    method_name = func.get('attr')
                    args = rule.get('args', [])
                    if method_name:
                        # Try to expand this as a helper with args
                        expanded = self.expand_helper(method_name, args)
                        if expanded:
                            return self.expand_rule(expanded, _depth + 1)  # Recursively expand the result
                        # If not expandable, convert to a helper node with args
                        return {'type': 'helper', 'name': method_name, 'args': args}

        # Special handling for __analyzed_func__
        if rule.get('type') == 'state_method' and rule.get('method') == '__analyzed_func__':
            if 'original' in rule:
                return self._analyze_original_rule(rule['original'])
            return self._infer_rule_type(rule)

        # Special handling for helper nodes
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule.get('name'), rule.get('args'))
            if expanded:
                return self.expand_rule(expanded, _depth + 1)  # Recursively expand
            return rule

        # Handle and/or conditions recursively
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', [])]

        return rule
    
    def _analyze_original_rule(self, original_rule):
        """Analyze the original rule structure for KH2-specific patterns."""
        if original_rule.get('type') == 'state_method':
            method = original_rule.get('method', '')
            args = original_rule.get('args', [])
            
            # Handle 'has' method for item requirements
            if method == 'has' and len(args) >= 1:
                item_check = {
                    'type': 'item_check',
                    'item': args[0]
                }
                # Add count if specified
                if len(args) >= 2:
                    item_check['count'] = {'type': 'constant', 'value': args[1]}
                return item_check
                
            # Handle other known state methods
            if method in ['can_reach', 'has_group', 'has_any']:
                return {
                    'type': 'game_specific_check',
                    'method': method,
                    'args': args,
                    'description': f"Requires {method}({', '.join(str(a) for a in args)})"
                }
        
        return {
            'type': 'generic_rule',
            'description': 'KH2-specific rule',
            'details': 'This rule could not be fully analyzed'
        }
    
    def _infer_rule_type(self, rule):
        """Infer rule type for KH2 based on context clues."""
        args = rule.get('args', [])
        rule_str = str(rule)
        
        # Item check patterns
        if 'has(' in rule_str.lower() or 'state.has' in rule_str.lower():
            item_match = re.search(r"has\(['\"](.*?)['\"]\s*,", rule_str)
            if item_match:
                return {
                    'type': 'item_check',
                    'item': item_match.group(1),
                    'inferred': True
                }
        
        # Location access patterns
        if 'can_reach' in rule_str.lower():
            return {
                'type': 'can_reach',
                'inferred': True,
                'description': 'Requires reaching a specific location'
            }
        
        # Return a generic rule
        return {
            'type': 'generic_rule',
            'description': 'KH2-specific rule',
            'details': 'This rule requires KH2-specific logic'
        }
    
    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export KH2-specific settings for frontend logic."""
        # Get base settings from parent class
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Add KH2-specific settings that affect logic
        kh2_settings = [
            'FightLogic',
            'AutoFormLogic',
            'FinalFormLogic',
            'Promise_Charm',
            'CorSkipToggle'
        ]

        for setting_name in kh2_settings:
            if hasattr(world, 'options') and hasattr(world.options, setting_name):
                option = getattr(world.options, setting_name)
                # Get the value (could be an integer option or boolean)
                if hasattr(option, 'value'):
                    settings_dict[setting_name] = option.value
                else:
                    settings_dict[setting_name] = option

        return settings_dict

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Return KH2-specific item data with classification flags."""
        from BaseClasses import ItemClassification
        
        item_data = {}
        
        # Get items from world.item_name_to_id if available
        if hasattr(world, 'item_name_to_id'):
            for item_name, item_id in world.item_name_to_id.items():
                # Try to get classification from item class
                is_advancement = False
                is_useful = False
                is_trap = False
                
                try:
                    item_class = getattr(world, 'item_name_to_item', {}).get(item_name)
                    if item_class and hasattr(item_class, 'classification'):
                        classification = item_class.classification
                        is_advancement = classification == ItemClassification.progression
                        is_useful = classification == ItemClassification.useful
                        is_trap = classification == ItemClassification.trap
                except Exception as e:
                    logger.debug(f"Could not determine classification for {item_name}: {e}")
                    # Check item pool if available
                    if hasattr(world, 'multiworld'):
                        for item in world.multiworld.itempool:
                            if item.player == world.player and item.name == item_name:
                                is_advancement = item.classification == ItemClassification.progression
                                is_useful = item.classification == ItemClassification.useful
                                is_trap = item.classification == ItemClassification.trap
                                break
                        
                        # Check placed items in locations
                        if not (is_advancement or is_useful or is_trap):
                            for location in world.multiworld.get_locations(world.player):
                                if (location.item and location.item.player == world.player and 
                                    location.item.name == item_name and location.item.code is not None):
                                    is_advancement = location.item.classification == ItemClassification.progression
                                    is_useful = location.item.classification == ItemClassification.useful
                                    is_trap = location.item.classification == ItemClassification.trap
                                    break
                
                # Get groups if available
                groups = []
                if hasattr(world, 'item_name_groups'):
                    groups = [
                        group_name for group_name, items in world.item_name_groups.items()
                        if item_name in items
                    ]
                
                item_data[item_name] = {
                    'name': item_name,
                    'id': item_id,
                    'groups': sorted(groups),
                    'advancement': is_advancement,
                    'useful': is_useful,
                    'trap': is_trap,
                    'event': False,
                    'type': None,
                    'max_count': 1
                }
        
        # Handle event items by scanning locations
        if hasattr(world, 'multiworld'):
            for location in world.multiworld.get_locations(world.player):
                if location.item and location.item.player == world.player:
                    item_name = location.item.name
                    # Check if this is an event item (no code/ID) that we haven't seen
                    if (location.item.code is None and 
                        item_name not in item_data and
                        hasattr(location.item, 'classification')):
                        
                        item_data[item_name] = {
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
        
        return item_data