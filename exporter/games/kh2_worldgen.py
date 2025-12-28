"""Kingdom Hearts 2 WorldGen specific export handler.

This handler exports settings from the worldgen's fill_slot_data() method,
converting numeric option values to string keys that match the helper dictionaries.
"""

from typing import Dict, Any
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)


# Mapping of numeric values to string keys for Choice options
# These must match the keys used in the helper dictionaries (e.g., get_data_roxas_rules)
FIGHT_LOGIC_MAP = {0: 'easy', 1: 'normal', 2: 'hard'}
FINAL_FORM_LOGIC_MAP = {0: 'no_light_and_darkness', 1: 'light_and_darkness', 2: 'just_a_form'}
AUTO_FORM_LOGIC_MAP = {0: 'false', 1: 'true'}  # Boolean as string for consistency


class KH2WorldGenGameExportHandler(BaseGameExportHandler):
    """KH2 WorldGen-specific export handler.

    Exports settings from fill_slot_data() with proper string key conversion
    for frontend rule evaluation.
    """

    # Enable automatic export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Module paths containing helper functions for the worldgen
    HELPER_MODULES = ['worlds.kh2_worldgen.Rules']

    def get_world_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export KH2 WorldGen world data for frontend logic.

        Extracts settings from fill_slot_data() and converts numeric option
        values to string keys that match the helper dictionary keys.
        """
        # Get base world data from parent class
        world_data = super().get_world_data(world, multiworld, player)

        # Get slot data which contains the game settings
        slot_data = {}
        if hasattr(world, 'fill_slot_data') and callable(world.fill_slot_data):
            try:
                slot_data = world.fill_slot_data()
            except Exception as e:
                logger.warning(f"Failed to get fill_slot_data for KH2 WorldGen: {e}")

        # Add KH2-specific settings with string key conversion
        # These override any settings that may have been set by the parent class
        if 'FightLogic' in slot_data:
            value = slot_data['FightLogic']
            world_data['FightLogic'] = FIGHT_LOGIC_MAP.get(value, 'normal')

        if 'FinalFormLogic' in slot_data:
            value = slot_data['FinalFormLogic']
            world_data['FinalFormLogic'] = FINAL_FORM_LOGIC_MAP.get(value, 'light_and_darkness')

        if 'AutoFormLogic' in slot_data:
            value = slot_data['AutoFormLogic']
            world_data['AutoFormLogic'] = AUTO_FORM_LOGIC_MAP.get(value, 'false')

        # Add other settings that don't need conversion
        settings_to_copy = ['CorSkipToggle', 'Goal', 'FinalXemnas',
                           'LuckyEmblemsRequired', 'BountyRequired', 'LevelDepth']
        for setting_name in settings_to_copy:
            if setting_name in slot_data:
                world_data[setting_name] = slot_data[setting_name]

        # Ensure Promise_Charm is set (default to false if not in slot_data)
        if 'Promise_Charm' not in slot_data or slot_data['Promise_Charm'] is None:
            world_data['Promise_Charm'] = 'false'
        else:
            world_data['Promise_Charm'] = str(slot_data['Promise_Charm']).lower()

        # CorSkipToggle should also be a string for consistency
        if 'CorSkipToggle' in slot_data:
            world_data['CorSkipToggle'] = 'true' if slot_data['CorSkipToggle'] else 'false'

        # Ensure the options dict exists and copy key settings there too
        # The frontend may check settings in multiple places
        if 'options' not in world_data:
            world_data['options'] = {}

        # Copy key settings to options dict for consistency with original KH2 export
        options_to_copy = ['FightLogic', 'AutoFormLogic', 'FinalFormLogic',
                          'Promise_Charm', 'CorSkipToggle']
        for key in options_to_copy:
            if key in world_data and key not in world_data['options']:
                world_data['options'][key] = world_data[key]

        return world_data
