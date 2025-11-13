"""Super Metroid game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class SMGameExportHandler(GenericGameExportHandler):
    """Export handler for Super Metroid.

    Super Metroid uses a custom SMBoolManager system for its logic.
    The rules are wrapped in self.evalSMBool() calls with helper functions.
    This exporter inherits from GenericGameExportHandler to handle the basic structure.
    """
    GAME_NAME = 'Super Metroid'

    # Inherit all default behavior from GenericGameExportHandler
    # The rules for Super Metroid are complex due to the SMBoolManager system
    # which evaluates "SMBool" objects that have both a boolean value and a difficulty rating.
    # For now, we'll let the generic handler process these and see what the frontend needs.
