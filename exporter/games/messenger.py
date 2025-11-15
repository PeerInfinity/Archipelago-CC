"""The Messenger game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class MessengerGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'The Messenger'

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """
        Export progression mapping for Time Shards -> Shards accumulation.

        In Python, when a Time Shard item is collected, the world.collect() method
        adds its value to a virtual "Shards" item using state.add_item("Shards", value).

        We replicate this using the progression_mapping system with type="additive".
        """
        mapping = {}

        # Get all Time Shard items and their values
        time_shard_items = {}

        # Add all standard Time Shard items with their values
        time_shard_variants = [
            ("Time Shard", 1),
            ("Time Shard (10)", 10),
            ("Time Shard (50)", 50),
            ("Time Shard (100)", 100),
            ("Time Shard (300)", 300),
            ("Time Shard (500)", 500),
        ]

        for item_name, value in time_shard_variants:
            time_shard_items[item_name] = value

        if time_shard_items:
            mapping["Shards"] = {
                "type": "additive",
                "items": time_shard_items,
                "base_item": "Shards"
            }
            logger.debug(f"Created progression mapping for Shards with {len(time_shard_items)} Time Shard items")

        return mapping

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

    def get_custom_location_access_rule(self, location, world):
        """
        Provide custom access rule for Messenger shop locations.

        Shop locations have an access_rule method that returns a 'can_afford' variable,
        which is defined as: state.has("Shards", player, min(self.cost, world.total_shards))

        We replace this with a direct item_check rule for "Shards" with the appropriate count.
        """
        # Check if this is a shop location with a cost attribute
        if hasattr(location, 'cost'):
            try:
                cost = location.cost
                total_shards = world.total_shards if hasattr(world, 'total_shards') else 0
                required_shards = min(cost, total_shards)

                logger.debug(f"Shop location {location.name}: cost={cost}, total_shards={total_shards}, required={required_shards}")

                # Return a custom rule that checks for the required number of shards
                return {
                    'type': 'item_check',
                    'item': {
                        'type': 'constant',
                        'value': 'Shards'
                    },
                    'count': {
                        'type': 'constant',
                        'value': required_shards
                    }
                }
            except Exception as e:
                logger.warning(f"Could not create custom access rule for shop location {location.name}: {e}")
                return None

        # For non-shop locations, return None to use the default access rule
        return None
