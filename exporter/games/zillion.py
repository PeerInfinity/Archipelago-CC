"""Zillion game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class ZillionGameExportHandler(GenericGameExportHandler):
    """Export handler for Zillion.

    Zillion uses the zilliandomizer library for its logic system, which is too complex
    for static analysis. We use empirical testing to determine what items are needed
    for each location.
    """
    GAME_NAME = 'Zillion'

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions in its access rules."""
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Determine access rules by empirically testing the location with different items.

        Since zilliandomizer's logic is too complex for static analysis, we test
        what items are actually needed by checking accessibility with different
        item combinations.
        """
        from BaseClasses import CollectionState

        if not hasattr(location, 'access_rule') or not location.access_rule:
            return None

        # Get the items available in this game
        item_pool = ["Zillion", "Opa-Opa", "Floppy Disk", "Red ID Card", "Scope",
                     "JJ", "Apple", "Champ"]

        # Test with no items first
        empty_state = CollectionState(world.multiworld)
        if location.access_rule(empty_state):
            # Location is accessible with no items
            return {'type': 'constant', 'value': True}

        # Find minimum items needed
        # Test common combinations
        for item_name in item_pool:
            test_state = CollectionState(world.multiworld)
            if item_name in world.item_name_to_id:
                test_state.prog_items[location.player][item_name] = 1
                if location.access_rule(test_state):
                    # This single item makes it accessible
                    return {
                        'type': 'item_check',
                        'item': item_name
                    }

        # Try two-item combinations
        for i, item1 in enumerate(item_pool):
            for item2 in item_pool[i:]:
                if item1 == item2:
                    # Try multiple of same item
                    test_state = CollectionState(world.multiworld)
                    if item1 in world.item_name_to_id:
                        test_state.prog_items[location.player][item1] = 2
                        if location.access_rule(test_state):
                            return {
                                'type': 'item_check',
                                'item': item1,
                                'count': {'type': 'constant', 'value': 2}
                            }
                else:
                    # Try combination of two different items
                    test_state = CollectionState(world.multiworld)
                    if item1 in world.item_name_to_id and item2 in world.item_name_to_id:
                        test_state.prog_items[location.player][item1] = 1
                        test_state.prog_items[location.player][item2] = 1
                        if location.access_rule(test_state):
                            return {
                                'type': 'and',
                                'conditions': [
                                    {'type': 'item_check', 'item': item1},
                                    {'type': 'item_check', 'item': item2}
                                ]
                            }

        # If we can't figure it out with simple tests, return None to use default analysis
        logger.warning(f"Could not determine access rule for {location.name} through testing")
        return None

