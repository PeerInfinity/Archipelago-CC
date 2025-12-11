"""Mario & Luigi Superstar Saga game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class MLSSGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Mario & Luigi Superstar Saga'
    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = False

    # Module paths containing helper functions
    HELPER_MODULES = ['worlds.mlss.StateLogic']

    # Inherit all default behavior from GenericGameExportHandler
    # Only override methods when you need custom behavior
