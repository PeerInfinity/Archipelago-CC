"""Hollow Knight game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class HKExportHandler(GenericGameExportHandler):
    """Export handler for Hollow Knight game-specific rules and items."""
    
    def postprocess_regions(self, multiworld, player: int):
        """
        Hollow Knight has a unique region structure where the actual regions
        are not created during create_regions() but need to be created from
        a separate function in Regions.py
        
        NOTE: This is a complex issue. HK creates all locations in Menu region, 
        and proper redistribution would require modifying the region manager's
        internal state which is not straightforward. For now, we just document
        the issue.
        """
        # Check if we only have Menu region (indicating regions haven't been created)
        player_regions = [r for r in multiworld.regions if r.player == player]
        
        if len(player_regions) == 1 and player_regions[0].name == 'Menu':
            logger.warning(f"[HK] Only Menu region found for player {player}. All {len(player_regions[0].locations)} locations are in Menu.")
            logger.warning(f"[HK] Hollow Knight requires special region handling that is not yet fully implemented.")
            logger.warning(f"[HK] The exported JSON will have all locations in Menu region, which may cause performance issues.")
    
    def expand_helper(self, helper_name: str):
        """Expand Hollow Knight-specific helper functions."""
        # For now, just use the generic implementation
        # We'll add specific helpers as we discover them from test failures
        return super().expand_helper(helper_name)
    
    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Return Hollow Knight-specific item data."""
        # Use the generic implementation to start with
        # We'll enhance this as we discover specific requirements
        return super().get_item_data(world)