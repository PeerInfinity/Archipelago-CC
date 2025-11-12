"""Landstalker - The Treasures of King Nole game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class LandstalkerGameExportHandler(GenericGameExportHandler):
    """Export handler for Landstalker - The Treasures of King Nole.

    This handler extends GenericGameExportHandler to provide custom handling
    for Landstalker-specific rule patterns, particularly the complex shop item rules
    and region visit tracking.
    """

    GAME_NAME = 'Landstalker - The Treasures of King Nole'

    def __init__(self):
        super().__init__()
        logger.info(f"Initialized {self.__class__.__name__} for {self.GAME_NAME}")
