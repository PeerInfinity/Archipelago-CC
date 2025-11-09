"""DOOM 1993 game-specific rule expansion handler."""

from typing import Dict, Any
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)

class Doom1993GameExportHandler(BaseGameExportHandler):
    GAME_NAME = 'DOOM 1993'
    """Handle DOOM 1993 specific rule expansions."""
    
    def __init__(self, world=None):
        """Initialize with world context if needed."""
        super().__init__()
        self.world = world
    
    def expand_helper(self, helper_name: str):
        """Expand DOOM 1993 specific helper functions."""
        # Map helper functions to their rule representations
        helper_map = {
            # Weapon helpers
            'has_shotgun': {'type': 'item_check', 'item': 'Shotgun'},
            'has_chaingun': {'type': 'item_check', 'item': 'Chaingun'},
            'has_rocket_launcher': {'type': 'item_check', 'item': 'Rocket launcher'},
            'has_plasma_gun': {'type': 'item_check', 'item': 'Plasma gun'},
            'has_bfg9000': {'type': 'item_check', 'item': 'BFG9000'},
            'has_chainsaw': {'type': 'item_check', 'item': 'Chainsaw'},
            'has_super_shotgun': {'type': 'item_check', 'item': 'Super Shotgun'},
            
            # Key helpers
            'has_red_key': {'type': 'item_check', 'item': 'Red keycard'},
            'has_blue_key': {'type': 'item_check', 'item': 'Blue keycard'},
            'has_yellow_key': {'type': 'item_check', 'item': 'Yellow keycard'},
            'has_red_skull': {'type': 'item_check', 'item': 'Red skull key'},
            'has_blue_skull': {'type': 'item_check', 'item': 'Blue skull key'},
            'has_yellow_skull': {'type': 'item_check', 'item': 'Yellow skull key'},
            
            # Add more helper mappings as discovered during testing
        }
        
        expansion = helper_map.get(helper_name)
        if expansion:
            logger.debug(f"Expanded DOOM 1993 helper {helper_name} to {expansion}")
            return expansion
        
        logger.debug(f"Unknown DOOM 1993 helper: {helper_name}")
        return None  # Let base class handle or preserve as-is
    
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand DOOM 1993 rules."""
        if not rule:
            return rule
        
        # Use base class expansion which calls our expand_helper
        return super().expand_rule(rule)
    
    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Get DOOM 1993 specific item data."""
        # Use the base class generic implementation for now
        # Can be customized later if needed
        return super().get_item_data(world)