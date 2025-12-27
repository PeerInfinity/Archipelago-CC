"""Yoshi's Island game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class YoshisIslandGameExportHandler(GenericGameExportHandler):
    """Export handler for Yoshi's Island.

    Inherits from GenericGameExportHandler for default behavior.
    Override methods here only when custom behavior is needed.
    """

    AUTO_PRESERVE_LARGE_HELPERS = True

    # Specify the modules containing helper class methods
    HELPER_MODULES = [
        'worlds.yoshisisland.level_logic',  # YoshiLogic class
        'worlds.yoshisisland.setup_bosses'  # BossReqs class (castle_access, castle_clear)
    ]

    # Whitelist helpers that should always be exported
    # These are from BossReqs class and called via bosses.method_name()
    # and YoshiLogic class helpers needed for location access rules
    HELPERS_TO_EXPORT_WHITELIST = {
        # BossReqs class helpers
        'castle_access',
        'castle_clear',
        # YoshiLogic class helpers - needed for location access rules
        'has_midring',
        'reconstitute_luigi',
        'bandit_bonus',
        'item_bonus',
        'combat_item',
        'melon_item',
        'default_vis',
        'cansee_clouds',
        'bowserdoor_1',
        'bowserdoor_2',
        'bowserdoor_3',
        'bowserdoor_4',
    }

    # Define Yoshi's Island-specific helpers that should NOT be auto-expanded
    YOSHI_HELPERS = {
        'has_midring',
        'reconstitute_luigi',
        'bandit_bonus',
        'item_bonus',
        'combat_item',
        'melon_item',
        'default_vis',
        'cansee_clouds',
        'bowserdoor_1',
        'bowserdoor_2',
        'bowserdoor_3',
        'bowserdoor_4',
    }

    def _is_common_helper_pattern(self, helper_name):
        """
        Override to prevent auto-expansion of Yoshi's Island-specific helpers.
        These helpers have custom implementations in JavaScript and should not be
        automatically converted to item checks or other inferred rules.
        """
        # Don't auto-expand Yoshi's Island helpers
        if helper_name in self.YOSHI_HELPERS:
            return False

        # Don't auto-expand level-specific helpers (pattern: _[0-9][0-9][A-Za-z]+)
        # Examples: _14Clear, _17Game, _27Game, _47Game, etc.
        import re
        if re.match(r'^_\d{2}[A-Z][a-z]+$', helper_name):
            return False

        # Fall back to parent implementation for other patterns
        return super()._is_common_helper_pattern(helper_name)

    def _transform_logic_attribute_access(self, rule: Any) -> Any:
        """
        Recursively transform logic.method and bosses.method attribute access patterns to helper calls.

        Converts patterns like:
            {"type": "attribute", "object": {"type": "name", "name": "logic"}, "attr": "method_name"}
            {"type": "attribute", "object": {"type": "name", "name": "bosses"}, "attr": "method_name"}
        Into:
            {"type": "helper", "name": "method_name", "args": []}

        This handles a bug in the Python code where logic/bosses methods are accessed
        as attributes instead of being called as functions.
        """
        if not isinstance(rule, dict):
            return rule

        # Check if this is a logic or bosses attribute access pattern
        if (rule.get('type') == 'attribute' and
            isinstance(rule.get('object'), dict) and
            rule['object'].get('type') == 'name' and
            rule['object'].get('name') in ['logic', 'bosses']):
            # Convert to helper call
            method_name = rule.get('attr')
            module_name = rule['object'].get('name')
            logger.debug(f"Converting {module_name}.{method_name} attribute access to helper call")
            return {
                'type': 'helper',
                'name': method_name,
                'args': []
            }

        # Recursively process nested structures
        if rule.get('type') in ['and', 'or']:
            if 'conditions' in rule:
                rule['conditions'] = [self._transform_logic_attribute_access(cond)
                                     for cond in rule['conditions']]
        elif rule.get('type') == 'not':
            if 'condition' in rule:
                rule['condition'] = self._transform_logic_attribute_access(rule['condition'])
        elif rule.get('type') == 'conditional':
            if 'test' in rule:
                rule['test'] = self._transform_logic_attribute_access(rule['test'])
            if 'if_true' in rule:
                rule['if_true'] = self._transform_logic_attribute_access(rule['if_true'])
            if 'if_false' in rule:
                rule['if_false'] = self._transform_logic_attribute_access(rule['if_false'])
        elif rule.get('type') == 'function_call':
            # Transform function_call with bosses/logic attribute access to helper
            if 'function' in rule:
                func = rule['function']
                if (isinstance(func, dict) and
                    func.get('type') == 'attribute' and
                    isinstance(func.get('object'), dict) and
                    func['object'].get('type') == 'name' and
                    func['object'].get('name') in ['logic', 'bosses']):
                    # Convert to helper call
                    method_name = func.get('attr')
                    module_name = func['object'].get('name')
                    logger.debug(f"Converting {module_name}.{method_name} function_call to helper call")
                    return {
                        'type': 'helper',
                        'name': method_name,
                        'args': []
                    }

        return rule

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post-process exported data to fix logic attribute access patterns.
        """
        # Transform logic attribute access in all location and exit rules
        if 'regions' in data:
            for player_id, player_regions in data['regions'].items():
                for region_name, region_data in player_regions.items():
                    # Process location access rules
                    if 'locations' in region_data:
                        for location in region_data['locations']:
                            if 'access_rule' in location and location['access_rule']:
                                location['access_rule'] = self._transform_logic_attribute_access(
                                    location['access_rule']
                                )
                    # Process exit access rules
                    if 'exits' in region_data:
                        for exit_data in region_data['exits']:
                            if 'access_rule' in exit_data and exit_data['access_rule']:
                                exit_data['access_rule'] = self._transform_logic_attribute_access(
                                    exit_data['access_rule']
                                )

        return data

    def get_world_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract Yoshi's Island world data including computed settings for helpers."""
        # Get base world data
        world_data = super().get_world_data(world, multiworld, player)

        # Default values for Yoshi's Island options (used for WorldGen worlds that lack these options)
        # These match the defaults in the original Yoshi's Island world
        OPTION_DEFAULTS = {
            'stage_logic': 0,              # StageLogic.option_strict = Easy
            'hidden_object_visibility': 1, # ObjectVis.option_hidden_visible
            'shuffle_midrings': 0,         # Not shuffled (midring_start = True)
            'item_logic': 0,               # Not enabled (consumable_logic = True)
            'bowser_door_mode': 0,         # BowserDoor.option_door_1
            'luigi_pieces_required': 25,   # Default pieces
            'castle_clear_condition': 0,   # Default condition
            'castle_open_condition': 5,    # Default condition
        }

        # Helper to safely extract option values with defaults
        def extract_option(option_name):
            option = getattr(world.options, option_name, None)
            # Check if the option has a 'value' attribute (like Option objects)
            # Otherwise, return the option itself (might be a direct value like bool/int)
            value = getattr(option, 'value', option)
            # If value is None, use the default
            if value is None:
                return OPTION_DEFAULTS.get(option_name)
            return value

        # Yoshi's Island specific settings needed for helper functions
        if hasattr(world, 'options'):
            # Raw option values for backwards compatibility
            world_data['StageLogic'] = extract_option('stage_logic')
            world_data['HiddenObjectVisibility'] = extract_option('hidden_object_visibility')
            world_data['ShuffleMiddleRings'] = extract_option('shuffle_midrings')
            world_data['ItemLogic'] = extract_option('item_logic')
            world_data['BowserDoorMode'] = extract_option('bowser_door_mode')
            world_data['LuigiPiecesRequired'] = extract_option('luigi_pieces_required')
            world_data['CastleClearCondition'] = extract_option('castle_clear_condition')
            world_data['CastleOpenCondition'] = extract_option('castle_open_condition')

            # Computed values that match YoshiLogic instance attributes
            # These are referenced by exported helpers as self.attribute
            stage_logic = extract_option('stage_logic')
            if stage_logic == 0:  # StageLogic.option_strict
                world_data['game_logic'] = "Easy"
            elif stage_logic == 1:  # StageLogic.option_loose
                world_data['game_logic'] = "Normal"
            else:  # StageLogic.option_expert
                world_data['game_logic'] = "Hard"

            # midring_start = not shuffle_midrings
            world_data['midring_start'] = not extract_option('shuffle_midrings')

            # clouds_always_visible = hidden_object_visibility >= ObjectVis.option_clouds_only (2)
            world_data['clouds_always_visible'] = extract_option('hidden_object_visibility') >= 2

            # consumable_logic = not item_logic
            world_data['consumable_logic'] = not extract_option('item_logic')

            # bowser_door with special case for door_4 -> door_3
            bowser_door = extract_option('bowser_door_mode')
            if bowser_door == 4:  # BowserDoor.option_door_4
                bowser_door = 3  # BowserDoor.option_door_3
            world_data['bowser_door'] = bowser_door

            # luigi_pieces from option
            world_data['luigi_pieces'] = extract_option('luigi_pieces_required')

            # Export boss_order list for _xxCanFightBoss helpers
            # This is dynamically set during world setup based on boss shuffle option
            if hasattr(world, 'boss_order') and world.boss_order:
                world_data['boss_order'] = list(world.boss_order)
            else:
                # Default boss order if not shuffled (names must match actual location names)
                world_data['boss_order'] = [
                    "Burt The Bashful's Boss Room",
                    "Salvo The Slime's Boss Room",
                    "Bigger Boo's Boss Room",
                    "Roger The Ghost's Boss Room",
                    "Prince Froggy's Boss Room",
                    "Naval Piranha's Boss Room",
                    "Marching Milde's Boss Room",
                    "Hookbill The Koopa's Boss Room",
                    "Sluggy The Unshaven's Boss Room",
                    "Raphael The Raven's Boss Room",
                    "Tap-Tap The Red Nose's Boss Room"
                ]

            # Settings for BossReqs class (castle_access, castle_clear helpers)
            # These use self.castle_unlock and self.boss_unlock which are from options
            world_data['castle_unlock'] = extract_option('castle_open_condition')
            world_data['boss_unlock'] = extract_option('castle_clear_condition')

        return world_data
