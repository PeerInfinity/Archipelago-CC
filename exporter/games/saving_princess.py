"""Game-specific export handler for Saving Princess."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class SavingPrincessGameExportHandler(GenericGameExportHandler):
    """Export handler for Saving Princess that ensures consistent item ordering."""

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """
        Return item data with consistent ordering.

        Saving Princess uses set operations to build item_name_to_id which destroys
        dict ordering. This override rebuilds the dict with preserved order.
        """
        # Get the base item data from the generic handler
        item_data = super().get_item_data(world)

        # Return sorted by item ID to ensure consistent ordering
        # Items with None ID (events) will be placed at the end
        return dict(sorted(item_data.items(), key=lambda x: (x[1].get('id') is None, x[1].get('id'))))
