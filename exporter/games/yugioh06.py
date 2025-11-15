"""Yu-Gi-Oh! 2006 game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class Yugioh06GameExportHandler(GenericGameExportHandler):
    """Export handler for Yu-Gi-Oh! 2006.

    Uses the GenericGameExportHandler which intelligently handles
    rule analysis and helper function detection.
    """

    GAME_NAME = 'Yu-Gi-Oh! 2006'
