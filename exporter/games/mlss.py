"""Mario & Luigi Superstar Saga game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class MLSSGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Mario & Luigi Superstar Saga'
    # Disable automatic helper export (use old behavior)
    AUTO_EXPORT_DISCOVERED_HELPERS = False
    AUTO_PRESERVE_LARGE_HELPERS = False


    # Inherit all default behavior from GenericGameExportHandler
    # Only override methods when you need custom behavior
