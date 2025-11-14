"""Yacht Dice game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class YachtDiceGameExportHandler(GenericGameExportHandler):
    """Yacht Dice specific rule expander."""

    GAME_NAME = 'Yacht Dice'

    # Inherit all default behavior from GenericGameExportHandler
    # Only override methods when custom behavior is needed
