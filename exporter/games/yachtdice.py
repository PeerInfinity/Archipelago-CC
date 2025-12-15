"""Yacht Dice game-specific export handler."""

from typing import Dict, Any, Set
from .generic import GenericGameExportHandler


class YachtDiceGameExportHandler(GenericGameExportHandler):
    """Yacht Dice specific rule expander."""

    # AUTO_EXPORT_DISCOVERED_HELPERS is True by default in GenericGameExportHandler
    # dice_simulation_state_change is too complex to export because:
    # 1. It uses state.prog_items which is not available in JavaScript
    # 2. It has complex loops, probability distributions, and caching
    # 3. The JavaScript helper function must be called directly
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = {
        'dice_simulation_state_change',
    }

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """
        Return settings data for Yacht Dice.

        Yacht Dice calculates the maximum achievable score based on collected items.
        To match the sphere log's expectations during testing, we need to use
        the 'add_sphere_items_upfront' mode which adds items from the sphere log
        to inventory before comparing accessibility (rather than checking locations
        one by one which would increase the achievable score with each item collected).
        """
        settings_dict = super().get_settings_data(world, multiworld, player)

        # Enable upfront item adding for sphere test compatibility
        # This ensures the comparison happens with the exact items from the sphere log
        # rather than accumulating items as locations are checked
        settings_dict['add_sphere_items_upfront'] = True

        return settings_dict
