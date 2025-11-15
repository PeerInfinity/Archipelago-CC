# exporter/games/pokemon_emerald.py

from .generic import GenericGameExportHandler
from typing import Any, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class PokemonEmeraldGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Pokemon Emerald'
    """Pokemon Emerald specific export handler."""

    # Mapping of HM names to helper function names
    HM_TO_HELPER = {
        "HM01 Cut": "can_cut",
        "HM02 Fly": "can_fly",
        "HM03 Surf": "can_surf",
        "HM04 Strength": "can_strength",
        "HM05 Flash": "can_flash",
        "HM06 Rock Smash": "can_rock_smash",
        "HM07 Waterfall": "can_waterfall",
        "HM08 Dive": "can_dive",
    }

    def __init__(self, world=None):
        super().__init__()
        self.world = world

    def get_game_info(self, world) -> Dict[str, Any]:
        """Export Pokemon Emerald specific game information."""
        game_info = super().get_game_info(world)

        # Export hm_requirements which maps HM names to badge requirements
        # This is used to build hm_rules in the frontend
        if hasattr(world, 'hm_requirements'):
            game_info['hm_requirements'] = world.hm_requirements
        else:
            game_info['hm_requirements'] = {}

        return game_info

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export Pokemon Emerald specific settings."""
        # Get base settings
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Also include hm_requirements in settings for easy access
        if hasattr(world, 'hm_requirements'):
            settings_dict['hm_requirements'] = world.hm_requirements

        return settings_dict

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Expand Pokemon Emerald specific rule patterns.

        Specifically handles hm_rules["HM_NAME"]() pattern and converts it
        to helper function calls like can_surf(), can_cut(), etc.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Handle function_call with subscript accessing hm_rules
        if rule.get('type') == 'function_call':
            func = rule.get('function', {})
            if (isinstance(func, dict) and
                func.get('type') == 'subscript' and
                isinstance(func.get('value'), dict) and
                func['value'].get('type') == 'name' and
                func['value'].get('name') == 'hm_rules' and
                isinstance(func.get('index'), dict) and
                func['index'].get('type') == 'constant'):

                # Extract the HM name from the subscript index
                hm_name = func['index'].get('value')

                # Convert to helper function call
                if hm_name in self.HM_TO_HELPER:
                    helper_name = self.HM_TO_HELPER[hm_name]
                    logger.debug(f"Converting hm_rules['{hm_name}']() to helper '{helper_name}'")
                    return {
                        'type': 'helper',
                        'name': helper_name,
                        'args': []
                    }
                else:
                    logger.warning(f"Unknown HM in hm_rules: {hm_name}")

        # Recursively expand nested rules
        return super().expand_rule(rule)
