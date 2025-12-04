"""Yacht Dice game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class YachtDiceGameExportHandler(GenericGameExportHandler):
    """Yacht Dice specific rule expander."""

    GAME_NAME = 'Yacht Dice'

    # Inherit all default behavior from GenericGameExportHandler
    # Only override methods when custom behavior is needed

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

    def should_preserve_as_helper(self, func_name: str) -> bool:
        """
        Determine if a function should be preserved as a helper call rather than inlined.

        For Yacht Dice, dice_simulation_state_change must be preserved as a helper because:
        1. It uses state.prog_items which is not available in JavaScript
        2. It performs complex caching and simulation logic
        3. The JavaScript helper function needs to be called directly

        Args:
            func_name: The name of the function being called

        Returns:
            True if the function should be preserved as a helper, False otherwise
        """
        # Preserve dice_simulation_state_change as a helper function call
        if func_name == 'dice_simulation_state_change':
            logger.debug(f"Preserving {func_name} as helper function")
            return True

        # Use default behavior for other functions
        return False
