"""Sonic Adventure 2 Battle game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class SA2BGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Sonic Adventure 2 Battle'
    # Disable automatic helper export (use old behavior)
    AUTO_EXPORT_DISCOVERED_HELPERS = False
    AUTO_PRESERVE_LARGE_HELPERS = False


    # Inherit all default behavior from GenericGameExportHandler
    # Override methods only when custom behavior is needed
