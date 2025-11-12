"""Ocarina of Time game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class OOTGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Ocarina of Time'

    # Inherit all default behavior from GenericGameExportHandler
    # Only override methods when custom behavior is needed
