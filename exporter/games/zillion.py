"""Zillion game-specific export handler."""

from typing import Dict, Any, Optional, List
from .generic import GenericGameExportHandler
import logging
import json
import os

logger = logging.getLogger(__name__)

class ZillionGameExportHandler(GenericGameExportHandler):
    """Export handler for Zillion.

    Zillion uses the zilliandomizer library for its logic system.
    The game does not use traditional helper functions - all logic is handled
    by zilliandomizer's internal calculations.

    Access rules need to be determined by testing the location's access_rule function
    with different item combinations.
    """
    GAME_NAME = 'Zillion'

    def __init__(self):
        super().__init__()
        # Zillion doesn't use helper functions - logic is in zilliandomizer library
        self.known_helpers = set()

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions."""
        # Log if we encounter any helpers (shouldn't happen)
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Determine access rule by testing the Zillion location's access_rule function.

        Zillion uses the zilliandomizer library which has complex internal logic.
        We need to test what items are required by calling the actual access_rule.
        """
        # Check if this location has an access_rule we can test
        if not hasattr(location, 'access_rule') or not location.access_rule:
            return None

        # Get the multiworld and player
        multiworld = world.multiworld
        player = world.player

        # Test if the location is accessible with no items (starting state)
        base_state = multiworld.get_all_state(False)
        base_state.sweep_for_advancements()  # Collect events that are always available

        loc_name = location.name if hasattr(location, 'name') else 'unknown'
        is_accessible = location.access_rule(base_state)

        # Debug logging for specific locations
        if loc_name in ['C-3 mid far right', 'B-1 mid far left', 'D-2 top left-center']:
            logger.info(f"Testing {loc_name}: accessible with no items = {is_accessible}")

        if is_accessible:
            # Location is accessible from the start
            return {'type': 'constant', 'value': True}

        # Test common Zillion items to see what's needed
        # Zillion items: Zillion (gun upgrade), Jump Shoes, Scope, Red ID Card, Floppy Disk, Bread
        test_items = ['Zillion', 'Jump Shoes', 'Scope', 'Red ID Card', 'Floppy Disk', 'Bread']

        required_items = []

        # Try each item individually first
        for item_name in test_items:
            if item_name not in world.item_name_to_id:
                continue

            test_state = multiworld.get_all_state(False)
            test_state.sweep_for_advancements()
            test_state.collect(world.create_item(item_name), prevent_sweep=True)

            # If location becomes accessible with this one item, it might be required
            if location.access_rule(test_state):
                # Verify it's actually required by checking if it's not accessible without it
                if not location.access_rule(base_state):
                    required_items.append(item_name)
                    break  # Found the requirement, no need to test more

        # Build the access rule based on what we found
        if not required_items:
            # Couldn't determine requirements - mark as needing analysis
            # Return None to fall back to analyzer
            return None

        if len(required_items) == 1:
            return {
                'type': 'item_check',
                'item': required_items[0]
            }

        # Multiple items required (shouldn't happen with current logic, but handle it)
        return {
            'type': 'and',
            'conditions': [{'type': 'item_check', 'item': item} for item in required_items]
        }
