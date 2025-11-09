"""Game-specific export handler for Saving Princess."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class SavingPrincessGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Saving Princess'
    """Export handler for Saving Princess using all defaults from GenericGameExportHandler."""
