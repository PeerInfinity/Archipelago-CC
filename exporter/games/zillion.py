"""Zillion game-specific export handler."""

from typing import Dict, Any, Optional, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class ZillionGameExportHandler(GenericGameExportHandler):
    """Export handler for Zillion.

    Zillion uses the zilliandomizer library for its logic system. Access rules are
    implemented as functools.partial objects that call the zilliandomizer logic cache,
    making them difficult to analyze statically. We use runtime testing to determine
    which items are required for each location.
    """
    GAME_NAME = 'Zillion'

    def expand_helper(self, helper_name: str):
        """Zillion does not use helper functions in its access rules."""
        if helper_name:
            logger.warning(f"Unexpected helper in Zillion: {helper_name}")
        return None

    def get_custom_location_access_rule(self, location, world) -> Optional[Dict[str, Any]]:
        """
        Test the location's access rule with different item combinations to determine
        which items are required.

        This works by calling the access_rule function with different CollectionStates
        and seeing which items make the location accessible.
        """
        # Import here to avoid circular dependencies
        from BaseClasses import CollectionState

        if not hasattr(location, 'access_rule') or location.access_rule is None:
            return None

        try:
            # Create a minimal collection state with no items
            # Don't sweep for advancements - we want to test the RAW access without item collection
            empty_state = world.multiworld.get_all_state(False)

            # Debug: Check specific locations
            if location.name in ["C-3 mid far right", "A-4 bottom far left"]:
                is_accessible = location.access_rule(empty_state)
                logger.info(f"[RUNTIME DEBUG] {location.name}: accessible with empty state = {is_accessible}")

            # If accessible with no items, return True
            if location.access_rule(empty_state):
                return {'type': 'constant', 'value': True}

            # Test each item type to see if it enables access
            required_items = []
            item_names = ['Zillion', 'Opa-Opa', 'Floppy Disk', 'Red ID Card', 'Scope', 'Bread', 'Apple']

            for item_name in item_names:
                # Skip if this item doesn't exist in the world
                if item_name not in world.item_name_to_id:
                    continue

                # Test with 1 of this item - don't sweep to avoid collecting other items
                test_state = empty_state.copy()
                test_state.collect(world.create_item(item_name), prevent_sweep=True)

                if location.access_rule(test_state):
                    required_items.append(item_name)

            if not required_items:
                # Location is not accessible even with items - might need multiple items
                # or region connectivity. Return None to let the generic analyzer handle it.
                return None

            # Build the access rule from the required items
            if len(required_items) == 1:
                return {'type': 'item_check', 'item': required_items[0]}
            else:
                # Multiple items might be needed - test combinations
                # For now, return OR of all items (one is sufficient)
                return {
                    'type': 'or',
                    'conditions': [{'type': 'item_check', 'item': item} for item in required_items]
                }

        except Exception as e:
            logger.warning(f"Runtime test failed for location {location.name}: {e}")
            return None
