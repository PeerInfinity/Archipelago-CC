"""The Witness game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class WitnessGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'The Witness'

    # Inherit all default behavior from GenericGameExportHandler
    # Override methods here only when custom behavior is needed
