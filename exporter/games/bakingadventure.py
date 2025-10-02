"""Baking Adventure game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class BakingAdventureGameExportHandler(GenericGameExportHandler):
    """Export handler for Baking Adventure."""
    
    def expand_helper(self, helper_name: str):
        """Expand game-specific helper functions for Baking Adventure."""
        # Start with generic expansion
        # Will add game-specific helpers as we discover them during testing
        return super().expand_helper(helper_name)