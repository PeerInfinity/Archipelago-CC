"""Shivers game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class ShiversGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Shivers'
    # Disable automatic helper export (use old behavior)
    AUTO_EXPORT_DISCOVERED_HELPERS = False
    AUTO_PRESERVE_LARGE_HELPERS = False

    """Export handler for Shivers."""

    def expand_helper(self, helper_name: str):
        """Expand game-specific helper functions for Shivers."""
        # Start with generic expansion
        # Will add game-specific helpers as we discover them during testing
        return super().expand_helper(helper_name)
