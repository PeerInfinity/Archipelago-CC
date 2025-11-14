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
    GAME_NAME = "Yoshi's Island"

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract Yoshi's Island settings."""
        settings_dict = {'game': multiworld.game[player]}

        # Set assume_bidirectional_exits to false for Yoshi's Island
        settings_dict['assume_bidirectional_exits'] = False

        # Helper to safely extract option values
        def extract_option(option_name):
            option = getattr(world.options, option_name, None)
            # Check if the option has a 'value' attribute (like Option objects)
            # Otherwise, return the option itself (might be a direct value like bool/int)
            return getattr(option, 'value', option)

        # Yoshi's Island specific settings needed for helper functions
        if hasattr(world, 'options'):
            # Stage Logic (needed for cansee_clouds, combat_item, etc.)
            settings_dict['StageLogic'] = extract_option('stage_logic')

            # Hidden Object Visibility (needed for cansee_clouds)
            settings_dict['HiddenObjectVisibility'] = extract_option('hidden_object_visibility')

            # Shuffle Middle Rings (needed for has_midring)
            settings_dict['ShuffleMiddleRings'] = extract_option('shuffle_midrings')

            # Item Logic / Consumable Logic (needed for combat_item, melon_item)
            settings_dict['ItemLogic'] = extract_option('item_logic')

            # Bowser Door Mode (needed for bowser door helpers)
            settings_dict['BowserDoorMode'] = extract_option('bowser_door_mode')

            # Luigi Pieces Required (needed for reconstitute_luigi)
            settings_dict['LuigiPiecesRequired'] = extract_option('luigi_pieces_required')

        return settings_dict
