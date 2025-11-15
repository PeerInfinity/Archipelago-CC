"""The Messenger game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class MessengerGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'The Messenger'

    def get_location_attributes(self, location, world) -> Dict[str, Any]:
        """
        Get game-specific location attributes to include in the export.
        For Messenger, this includes shop costs for shop locations.
        """
        attributes = {}

        # Check if this is a shop location by looking for 'cost' attribute
        if hasattr(location, 'cost'):
            try:
                cost = location.cost
                attributes['cost'] = cost
                logger.debug(f"Exported cost {cost} for shop location {location.name}")
            except Exception as e:
                logger.warning(f"Could not get cost for location {location.name}: {e}")

        return attributes

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursively expand rule functions with Messenger-specific handling.

        Handles the 'can_afford' variable that appears in shop location access rules.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Handle the 'can_afford' variable reference for shop locations
        # This variable is defined as: state.has("Shards", player, min(cost, total_shards))
        # We'll convert it to a helper function that can be evaluated in JavaScript
        if rule.get('type') == 'name' and rule.get('name') == 'can_afford':
            # Convert to a helper function call
            # The JavaScript helper will receive the location context and can check the cost
            return {
                'type': 'helper',
                'name': 'can_afford',
                'args': []
            }

        # Call parent class to handle standard rule expansion
        return super().expand_rule(rule)
